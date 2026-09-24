// api/temnilan.js — TEMNILAN Degen Terminal (semua endpoint dalam 1 function)
//
// Dipanggil lewat ?resource=<nama>, tapi URL lama tetap jalan berkat
// rewrites di vercel.json (lihat catatan di bawah):
//
//   /api/temnilan-wallets    -> ?resource=wallets
//     GET    (?id=123&range=7D|30D|90D|ALL)   list / detail wallet
//     POST                                    tambah wallet
//     PATCH  ?id=123                          edit wallet
//     DELETE ?id=123                          hapus wallet
//
//   /api/temnilan-activity   -> ?resource=activity
//     GET ?limit=50&wallet_id=123&side=buy&before=<iso>   feed transaksi
//
//   /api/temnilan-positions  -> ?resource=positions
//     GET ?wallet_id=123&status=open|closed               posisi wallet
//
//   /api/temnilan-alerts     -> ?resource=alerts
//     GET   ?unread=true&limit=50                         feed alert
//     PATCH ?id=123                                       tandai dibaca
//
//   /api/temnilan-webhook    -> ?resource=webhook
//     POST  dari provider indexer (Helius Enhanced Webhooks, dll)
const { verifyAdminToken } = require('./_auth');

const { createClient } = require('@supabase/supabase-js');

// Ganti ke require('../lib/supabase') kalau kamu udah punya util client sendiri.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LARGE_TX_USD_THRESHOLD = Number(process.env.TEMNILAN_LARGE_TX_USD || 2000);
const MULTI_WALLET_WINDOW_MS = 90 * 1000; // ">=X wallet beli token sama dalam 90 detik"
const MULTI_WALLET_MIN_COUNT = 3;

// ─────────────────────────────────────────────────────────────
// ROUTER
// ─────────────────────────────────────────────────────────────

const ROUTES = {
  wallets: handleWallets,
  activity: handleActivity,
  positions: handlePositions,
  alerts: handleAlerts,
  webhook: handleWebhook,
  sync: handleSync,
  backfill: handleBackfill,
};

module.exports = async function handler(req, res) {
  const { resource } = req.query;
  if (!resource || !Object.prototype.hasOwnProperty.call(ROUTES, resource)) {
    return res.status(404).json({
      error: `Unknown resource "${resource || ''}". Valid: ${Object.keys(ROUTES).join(', ')}`,
    });
  }
    const publicRead = req.method === 'GET' && ['wallets', 'activity', 'positions', 'alerts'].includes(resource);
  if (resource !== 'webhook' && !publicRead && !verifyAdminToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return ROUTES[resource](req, res);
};

// ─────────────────────────────────────────────────────────────
// WALLETS
// ─────────────────────────────────────────────────────────────

async function handleWallets(req, res) {
  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      return id ? await getWalletDetail(req, res, id) : await listWallets(req, res);
    }
    if (req.method === 'POST') return await createWallet(req, res);
    if (req.method === 'PATCH') return await updateWallet(req, res, id);
    if (req.method === 'DELETE') return await deleteWallet(req, res, id);

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (err) {
    console.error('[temnilan-wallets]', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

async function listWallets(req, res) {
  const { data: wallets, error } = await supabase
    .from('temnilan_wallets')
    .select('*')
    .order('last_activity', { ascending: false, nullsFirst: false });
  if (error) throw error;

  // Statistik global (section "2. GLOBAL STATISTICS" di spek)
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: tx24h, error: txErr } = await supabase
    .from('temnilan_transactions')
    .select('amount_usd')
    .gte('occurred_at', since24h);
  if (txErr) throw txErr;

  const volume24h = (tx24h || []).reduce((sum, t) => sum + (Number(t.amount_usd) || 0), 0);
  const activeNow = wallets.filter(w => w.status === 'active').length;
  const walletsWithSummary = await attachPnlSummary(wallets);

  return res.status(200).json({
    wallets: walletsWithSummary,
    stats: {
      tracked_wallets: wallets.length,
      active_now: activeNow,
      volume_24h: volume24h,
      transactions_24h: (tx24h || []).length,
    },
  });
}

async function getWalletDetail(req, res, id) {
  const { data: wallet, error } = await supabase
    .from('temnilan_wallets')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  if (!wallet) return res.status(404).json({ error: 'Wallet tidak ditemukan' });

  const { range = 'all' } = req.query; // 7D | 30D | 90D | ALL (time filter section 4)

  const [{ data: transactions, error: txErr }, { data: positions, error: posErr }] = await Promise.all([
    supabase
      .from('temnilan_transactions')
      .select('*')
      .eq('wallet_id', id)
      .gte('occurred_at', rangeToSince(range))
      .order('occurred_at', { ascending: false })
      .limit(500),
    supabase
      .from('temnilan_positions')
      .select('*')
      .eq('wallet_id', id)
      .order('opened_at', { ascending: false }),
  ]);
  if (txErr) throw txErr;
  if (posErr) throw posErr;

  // Statistik ikut filter periode: posisi dihitung dari waktu tutup (atau waktu buka kalau masih terbuka).
  const sinceMs = new Date(rangeToSince(range)).getTime();
  const inRange = (positions || []).filter(p => new Date(p.closed_at || p.opened_at).getTime() >= sinceMs);
  const stats = computeWalletStats(transactions || [], inRange);
  const behavior = computeBehavior(transactions || [], inRange);

  return res.status(200).json({
    wallet,
    stats,
    behavior,
    positions: (positions || []).filter(p => !p.closed_at),
    transactions,
  });
}

function rangeToSince(range) {
  const days = { '7D': 7, '30D': 30, '90D': 90 }[range];
  if (!days) return '1970-01-01T00:00:00Z'; // ALL
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function attachPnlSummary(wallets) {
  if (!wallets.length) return wallets;
  const { data: positions, error } = await supabase
    .from('temnilan_positions')
    .select('wallet_id, pnl_usd')
    .in('wallet_id', wallets.map(w => w.id));
  if (error) throw error;

  const pnlByWallet = {};
  for (const p of positions || []) {
    pnlByWallet[p.wallet_id] = (pnlByWallet[p.wallet_id] || 0) + (Number(p.pnl_usd) || 0);
  }
  return wallets.map(w => ({ ...w, total_pnl: pnlByWallet[w.id] ?? 0 }));
}

// Semua angka di sini HARUS berasal dari data yang ada — kalau belum ada
// transaksi, baliknya null (frontend nampilin "INSUFFICIENT DATA", bukan
// angka ngarang). Sesuai poin 9 & 14 di spek.
function computeWalletStats(transactions, positions) {
  if (!transactions.length) {
    return { total_pnl: null, roi_pct: null, win_rate: null, total_trades: 0, avg_hold_ms: null };
  }
  const closed = positions.filter(p => p.closed_at);
  const totalPnl = positions.reduce((s, p) => s + (Number(p.pnl_usd) || 0), 0);
  const wins = closed.filter(p => Number(p.pnl_usd) > 0).length;
  const winRate = closed.length ? (wins / closed.length) * 100 : null;

  // ROI = PnL (USD) / total modal beli (USD). Dulu dibagi size_sol (SOL) -> beda satuan.
  const totalInvested = positions.reduce((s, p) => s + (Number(p.bought_usd) || 0), 0) || null;
  const roiPct = totalInvested ? (totalPnl / totalInvested) * 100 : null;

  const holdTimesMs = closed
    .filter(p => p.opened_at && p.closed_at)
    .map(p => new Date(p.closed_at) - new Date(p.opened_at));
  const avgHoldMs = holdTimesMs.length ? holdTimesMs.reduce((a, b) => a + b, 0) / holdTimesMs.length : null;

  return { total_pnl: totalPnl, roi_pct: roiPct, win_rate: winRate, total_trades: transactions.length, avg_hold_ms: avgHoldMs };
}

// Section "9. WALLET BEHAVIOR" — juga wajib "INSUFFICIENT DATA" kalau datanya tipis.
function computeBehavior(transactions, positions) {
  const MIN_SAMPLE = 5; // ambang minimal biar gak narik kesimpulan dari 1-2 data poin
  if (transactions.length < MIN_SAMPLE) return { insufficient_data: true };

  const closed = positions.filter(p => p.closed_at && p.opened_at);
  const holdTimesMin = closed.map(p => (new Date(p.closed_at) - new Date(p.opened_at)) / 60000);
  const avgHold = holdTimesMin.length ? holdTimesMin.reduce((a, b) => a + b, 0) / holdTimesMin.length : null;

  const oldestMs = new Date(transactions[transactions.length - 1].occurred_at).getTime();
  const days = Math.max(1, (Date.now() - oldestMs) / 86400000);
  const tradesPerDay = transactions.length / days;

  return {
    insufficient_data: false,
    avg_hold_minutes: avgHold,
    trades_per_day: tradesPerDay,
    scalping_score: clamp01(1 - (avgHold ?? 999) / 60),      // hold <1 jam -> scalping tinggi
    long_hold_score: clamp01((avgHold ?? 0) / (60 * 24)),     // hold mendekati 1 hari+ -> long hold
  };
}
function clamp01(n) { return Math.max(0, Math.min(1, n || 0)); }

async function createWallet(req, res) {
  const { address, name, chain = 'solana', category = 'trader', tags = [] } = req.body || {};
  if (!address || !name) return res.status(400).json({ error: 'address dan name wajib diisi' });

  const { data, error } = await supabase
    .from('temnilan_wallets')
    .insert({ address, name, chain, category, tags })
    .select()
    .single();
  if (error) throw error;
  return res.status(201).json({ ...data, helius_sync: await safeSync() });
}

async function updateWallet(req, res, id) {
  if (!id) return res.status(400).json({ error: 'id wajib ada di query' });
  const { data, error } = await supabase
    .from('temnilan_wallets')
    .update(req.body || {})
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  const touchesAddress = req.body && ('address' in req.body || 'chain' in req.body);
  return res.status(200).json(touchesAddress ? { ...data, helius_sync: await safeSync() } : data);
}

async function deleteWallet(req, res, id) {
  if (!id) return res.status(400).json({ error: 'id wajib ada di query' });
  const { error } = await supabase.from('temnilan_wallets').delete().eq('id', id);
  if (error) throw error;
  return res.status(200).json({ success: true, helius_sync: await safeSync() });
}

// ─────────────────────────────────────────────────────────────
// SYNC WALLET -> HELIUS
//
// Database = sumber kebenaran. Setiap wallet Solana di temnilan_wallets otomatis
// dimasukkan ke daftar accountAddresses webhook Helius lewat Helius API
// (maks 100.000 alamat per webhook). Cuma kirim PUT kalau daftarnya beda, karena
// tiap edit webhook via API kena 100 credit.
//
// Env: HELIUS_API_KEY, HELIUS_WEBHOOK_ID (+ TEMNILAN_WEBHOOK_SECRET yang sudah ada)
// Manual / bulk: POST /api/temnilan?resource=sync
// ─────────────────────────────────────────────────────────────

async function syncHelius() {
  const key = process.env.HELIUS_API_KEY;
  const id = process.env.HELIUS_WEBHOOK_ID;
  if (!key || !id) return { synced: false, reason: 'HELIUS_API_KEY / HELIUS_WEBHOOK_ID belum diisi' };

  const { data: rows, error } = await supabase
    .from('temnilan_wallets')
    .select('address')
    .eq('chain', 'solana'); // wallet Robinhood chain tidak ikut dikirim ke Helius
  if (error) throw error;
  const addresses = [...new Set((rows || []).map(r => r.address))].sort();
  if (!addresses.length) return { synced: false, reason: 'belum ada wallet Solana di database' };

  const url = `https://api.helius.xyz/v0/webhooks/${id}?api-key=${key}`;
  const curRes = await fetch(url);
  if (!curRes.ok) throw new Error(`Helius GET webhook gagal (HTTP ${curRes.status})`);
  const cur = await curRes.json();

  const current = [...(cur.accountAddresses || [])].sort();
  if (JSON.stringify(current) === JSON.stringify(addresses)) {
    return { synced: true, changed: false, count: addresses.length };
  }

  // PUT butuh konfigurasi webhook lengkap, jadi field lain dibawa dari config yang sekarang.
  const putRes = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      webhookURL: cur.webhookURL,
      transactionTypes: cur.transactionTypes,
      webhookType: cur.webhookType,
      authHeader: process.env.TEMNILAN_WEBHOOK_SECRET,
      accountAddresses: addresses,
    }),
  });
  if (!putRes.ok) throw new Error(`Helius PUT webhook gagal (HTTP ${putRes.status})`);
  return { synced: true, changed: true, count: addresses.length }; // Helius butuh sampai ~2 menit buat aktif
}

// Gagal sync tidak boleh menggagalkan tambah/hapus wallet; hasilnya dikembalikan di respons.
async function safeSync() {
  try { return await syncHelius(); }
  catch (err) { console.error('[temnilan-sync]', err); return { synced: false, reason: err.message }; }
}

async function handleSync(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
  try {
    return res.status(200).json(await syncHelius());
  } catch (err) {
    console.error('[temnilan-sync]', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

// ─────────────────────────────────────────────────────────────
// BACKFILL HISTORY
//
// Menarik swap lama sebuah wallet dari Helius (terbaru -> lama, sampai batas hari),
// menyimpan ke temnilan_transactions, lalu MEMBANGUN ULANG posisi & PnL per trade
// dari seluruh transaksi wallet itu secara berurutan waktu (aman dijalankan ulang).
//
// POST /api/temnilan?resource=backfill&id=1&days=90[&cursor=...]   (dipanggil berulang sampai done=true)
// POST /api/temnilan?resource=backfill&id=1&rebuild=1               (hitung ulang saja, tanpa Helius)
//
// Harga SOL historis dari CoinGecko (tier gratis/Demo maks 365 hari). Opsional: COINGECKO_API_KEY.
// ─────────────────────────────────────────────────────────────

let _solSeries = { days: 0, at: 0, pts: [] };
async function getSolSeries(days) {
  if (_solSeries.days === days && _solSeries.pts.length && Date.now() - _solSeries.at < 600000) return _solSeries.pts;
  const headers = process.env.COINGECKO_API_KEY ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY } : {};
  const r = await fetch(`https://api.coingecko.com/api/v3/coins/solana/market_chart?vs_currency=usd&days=${days}`, { headers });
  if (!r.ok) throw new Error(`Harga SOL historis gagal diambil (CoinGecko HTTP ${r.status}). Coba lagi sebentar, atau isi COINGECKO_API_KEY.`);
  const pts = (await r.json()).prices;
  if (!Array.isArray(pts) || !pts.length) throw new Error('Data harga SOL historis kosong');
  _solSeries = { days, at: Date.now(), pts };
  return pts;
}
function solPriceAt(pts, ms) { // titik harga terdekat dengan waktu transaksi
  let lo = 0, hi = pts.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (pts[mid][0] < ms) lo = mid + 1; else hi = mid; }
  const a = pts[Math.max(0, lo - 1)], b = pts[lo];
  return Math.abs(a[0] - ms) <= Math.abs(b[0] - ms) ? a[1] : b[1];
}

async function handleBackfill(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
  try {
    const { id, cursor, rebuild } = req.query;
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 90));
    const key = process.env.HELIUS_API_KEY;
    if (!id) return res.status(400).json({ error: 'id wajib ada di query' });

    const { data: wallet, error: wErr } = await supabase.from('temnilan_wallets').select('id, address, chain').eq('id', id).maybeSingle();
    if (wErr) throw wErr;
    if (!wallet) return res.status(404).json({ error: 'Wallet tidak ditemukan' });
    if (wallet.chain !== 'solana') return res.status(400).json({ error: 'Import history baru mendukung wallet Solana' });
    if (rebuild) return res.status(200).json({ done: true, ...(await rebuildWallet(wallet.id)) });
    if (!key) return res.status(400).json({ error: 'HELIUS_API_KEY belum diisi' });

    const t0 = Date.now(), cutoff = t0 - days * 864e5;
    const prices = await getSolSeries(Math.min(365, days + 1));
    let before = cursor || null, pages = 0, seen = 0, old = 0, skipped = 0, sample = null, done = false;
    const rows = [];

    // Beberapa halaman per request supaya muat di batas waktu function; frontend memanggil ulang pakai cursor.
    while (!done && pages < 8 && Date.now() - t0 < 6000) {
      const url = `https://api-mainnet.helius-rpc.com/v0/addresses/${wallet.address}/transactions?api-key=${key}&type=SWAP&limit=100` +
        (before ? `&before-signature=${before}` : '');
      const r = await fetch(url);
      const page = await r.json().catch(() => null);
      if (!r.ok || !Array.isArray(page)) throw new Error('Helius: ' + ((page && page.error) || `HTTP ${r.status}`));
      pages++;
      if (!page.length) { done = true; break; }
      before = page[page.length - 1].signature;
      for (const tx of page) {
        seen++;
        if (tx.timestamp * 1000 < cutoff) { old++; done = true; continue; } // lebih lama dari batas hari
        const p = parseSwap(tx, wallet.address);
        if (!p) {
          skipped++;
          if (!sample) sample = { type: tx.type, source: tx.source, feePayerIsWallet: tx.feePayer === wallet.address, hasSwapEvent: !!(tx.events && tx.events.swap), tokenTransfers: (tx.tokenTransfers || []).length };
          continue;
        }
        const sp = solPriceAt(prices, tx.timestamp * 1000), usd = tradeUsd(p, sp);
        if (!(usd > 0)) { skipped++; continue; }
        rows.push({
          wallet_id: wallet.id, signature: p.signature, token_address: p.tokenAddress, token_symbol: p.tokenSymbol,
          side: p.side, amount_sol: usd / sp, amount_usd: usd, token_amount: p.tokenAmount,
          price: p.tokenAmount ? usd / p.tokenAmount : null, dex: p.dex, occurred_at: p.occurredAt,
        });
      }
    }

    for (let i = 0; i < rows.length; i += 500) {
      // data Helius = sumber otoritatif, jadi baris yang sudah ada ikut diperbarui (pnl_usd dihitung ulang oleh rebuild)
      const { error } = await supabase.from('temnilan_transactions').upsert(rows.slice(i, i + 500), { onConflict: 'signature' }); // update: import ulang memperbaiki baris lama yang salah
      if (error) throw error;
    }
    const out = { done, cursor: done ? null : before, pages, seen, old, skipped, sample, swaps: rows.length };
    if (done) Object.assign(out, await rebuildWallet(wallet.id));
    return res.status(200).json(out);
  } catch (err) {
    console.error('[temnilan-backfill]', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

// Posisi & PnL per trade = turunan dari temnilan_transactions. Dihitung ulang dari nol, berurutan waktu.
async function rebuildWallet(walletId) {
  const txs = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('temnilan_transactions').select('*').eq('wallet_id', walletId)
      .order('occurred_at', { ascending: true }).order('id', { ascending: true }).range(from, from + 999);
    if (error) throw error;
    txs.push(...data);
    if (data.length < 1000) break;
  }

  const open = new Map(), positions = [], sellPnl = new Map();
  for (const t of txs) {
    const tokens = Number(t.token_amount), usd = Number(t.amount_usd), sol = Number(t.amount_sol);
    if (!t.token_address || !tokens || !isFinite(usd)) continue;
    let pos = open.get(t.token_address);
    if (t.side === 'buy') {
      if (!pos) {
        pos = { wallet_id: walletId, token_address: t.token_address, token_symbol: t.token_symbol, token_amount: 0, cost_usd: 0,
          bought_usd: 0, realized_usd: 0, size_sol: 0, opened_at: t.occurred_at, closed_at: null, current_price: null, sold: false };
        open.set(t.token_address, pos); positions.push(pos);
      }
      pos.token_amount += tokens; pos.cost_usd += usd; pos.bought_usd += usd; pos.size_sol += sol;
      pos.entry_price = pos.cost_usd / pos.token_amount; // harga masuk rata-rata
    } else {
      if (!pos || !pos.token_amount) continue; // sell tanpa posisi di data yang ada -> dilewati, bukan angka karangan
      const fraction = Math.min(1, tokens / pos.token_amount), costSold = pos.cost_usd * fraction, pnl = usd - costSold;
      sellPnl.set(t.id, pnl); pos.realized_usd += pnl; pos.sold = true;
      if (fraction >= 0.99) {
        pos.token_amount = 0; pos.cost_usd = 0; pos.closed_at = t.occurred_at; pos.current_price = usd / tokens; open.delete(t.token_address);
      } else { pos.token_amount -= tokens; pos.cost_usd -= costSold; pos.size_sol *= 1 - fraction; }
    }
  }

  const out = positions.map(({ sold, ...p }) => ({
    ...p, pnl_usd: sold ? p.realized_usd : null, roi_pct: sold && p.bought_usd ? (p.realized_usd / p.bought_usd) * 100 : null,
  }));
  const del = await supabase.from('temnilan_positions').delete().eq('wallet_id', walletId);
  if (del.error) throw del.error;
  for (let i = 0; i < out.length; i += 500) {
    const { error } = await supabase.from('temnilan_positions').insert(out.slice(i, i + 500));
    if (error) throw error;
  }

  const changed = txs.filter(t => sellPnl.has(t.id) && Number(t.pnl_usd) !== sellPnl.get(t.id)).map(t => ({ ...t, pnl_usd: sellPnl.get(t.id) }));
  for (let i = 0; i < changed.length; i += 500) {
    const { error } = await supabase.from('temnilan_transactions').upsert(changed.slice(i, i + 500), { onConflict: 'id' });
    if (error) throw error;
  }

  const latest = txs.length ? txs[txs.length - 1].occurred_at : null;
  const { data: w } = await supabase.from('temnilan_wallets').select('last_activity').eq('id', walletId).maybeSingle();
  if (latest && (!w || !w.last_activity || new Date(latest) > new Date(w.last_activity))) {
    await supabase.from('temnilan_wallets').update({ last_activity: latest }).eq('id', walletId); // status TIDAK diubah
  }
  return { trades: txs.length, positions: out.length, open_positions: out.filter(p => !p.closed_at).length };
}

// ─────────────────────────────────────────────────────────────
// ACTIVITY  (LIVE WALLET ACTIVITY section 6 & TRADE HISTORY section 8)
//
// Update live di frontend TIDAK lewat polling endpoint ini — lewat Supabase
// Realtime subscription ke tabel temnilan_transactions. Endpoint ini cuma
// buat initial load & pagination (`before` buat infinite scroll).
// ─────────────────────────────────────────────────────────────

async function handleActivity(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { limit = 50, wallet_id, side, before } = req.query;

    let query = supabase
      .from('temnilan_transactions')
      .select('*, temnilan_wallets ( id, name, address, category )')
      .order('occurred_at', { ascending: false })
      .limit(Math.min(Number(limit) || 50, 200));

    if (wallet_id) query = query.eq('wallet_id', wallet_id);
    if (side) query = query.eq('side', side);
    if (before) query = query.lt('occurred_at', before);

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json(data);
  } catch (err) {
    console.error('[temnilan-activity]', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

// ─────────────────────────────────────────────────────────────
// POSITIONS  (section 7)
//
// CATATAN — "CURRENT PRICE" & unrealized PnL: current_price di tabel
// positions cuma ke-update kalau ada job terpisah yang nanya harga terkini
// (misal Vercel Cron tiap 30-60 detik, manggil Jupiter Price API / Birdeye
// buat tiap token_address yang lagi open position, lalu UPDATE
// temnilan_positions SET current_price=..., pnl_usd=..., roi_pct=...).
// Belum dibuatkan di sini.
// ─────────────────────────────────────────────────────────────

async function handlePositions(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
  try {
    const { wallet_id, status = 'open' } = req.query;
    if (!wallet_id) return res.status(400).json({ error: 'wallet_id wajib diisi' });

    let query = supabase.from('temnilan_positions').select('*').eq('wallet_id', wallet_id);
    query = status === 'open' ? query.is('closed_at', null) : query.not('closed_at', 'is', null);

    const { data, error } = await query.order('opened_at', { ascending: false });
    if (error) throw error;

    return res.status(200).json(data);
  } catch (err) {
    console.error('[temnilan-positions]', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

// ─────────────────────────────────────────────────────────────
// ALERTS  (section 10)
// ─────────────────────────────────────────────────────────────

async function handleAlerts(req, res) {
  try {
    if (req.method === 'GET') {
      const { unread, limit = 50 } = req.query;
      let query = supabase
        .from('temnilan_alerts')
        .select('*, temnilan_wallets ( id, name, address )')
        .order('created_at', { ascending: false })
        .limit(Math.min(Number(limit) || 50, 200));
      if (unread === 'true') query = query.eq('is_read', false);

      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'PATCH') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id wajib diisi' });
      const { data, error } = await supabase
        .from('temnilan_alerts')
        .update({ is_read: true })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (err) {
    console.error('[temnilan-alerts]', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

// ─────────────────────────────────────────────────────────────
// WEBHOOK  (TRANSACTION PROCESSOR, poin 12 spek)
//
// event masuk -> identifikasi wallet -> identifikasi BUY/SELL ->
// parse token & amount -> simpan transaksi -> update wallet stats ->
// (broadcast otomatis lewat Supabase Realtime)
//
// parseSwapEvent() ngikutin bentuk payload Helius enhanced webhook
// (array of parsed tx, tiap tx punya field `events.swap`). Kalau pakai
// provider lain, cukup sesuaikan parseSwapEvent().
// ─────────────────────────────────────────────────────────────

async function handleWebhook(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // Verifikasi shared secret dari provider webhook (Helius kirim di header Authorization).
  const secret = req.headers['authorization'] || req.headers['x-webhook-secret'];
  if (!process.env.TEMNILAN_WEBHOOK_SECRET || secret !== process.env.TEMNILAN_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    const results = [];
    for (const evt of events) {
      for (const address of await trackedAddressesIn(evt)) {
        const parsed = parseSwap(evt, address);
        if (parsed) results.push(await processSwap(parsed)); // bukan swap token yang jelas -> dilewati
      }
    }
    return res.status(200).json({ processed: results.filter(Boolean).length });
  } catch (err) {
    console.error('[temnilan-webhook]', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

const WSOL = 'So11111111111111111111111111111111111111112';
const STABLES = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
]);

// rawTokenAmount berisi bilangan bulat mentah; harus dibagi 10^decimals biar jadi jumlah token sebenarnya.
function tokenAmt(leg) {
  if (leg && leg.rawTokenAmount) return Number(leg.rawTokenAmount.tokenAmount) / 10 ** (Number(leg.rawTokenAmount.decimals) || 0);
  return Number(leg && leg.tokenAmount || 0);
}

// Baca satu transaksi Helius sebagai BUY/SELL SATU token untuk wallet `address`.
// Dasarnya perubahan saldo wallet itu sendiri (bukan ringkasan events.swap, yang bisa menyesatkan pada rute
// bercabang lewat wSOL). Aset yang diperdagangkan = satu-satunya token non-SOL non-stablecoin yang saldonya berubah;
// SOL/wSOL dan USDC/USDT dianggap sebagai "kuotasi" (pembayaran). Swap SOL <-> stablecoin bukan trade token -> null.
function parseSwap(evt, address) {
  if (!evt || !address) return null;
  const base = {
    address, signature: evt.signature, dex: evt.source || null,
    occurredAt: evt.timestamp ? new Date(evt.timestamp * 1000).toISOString() : new Date().toISOString(),
  };
  const mk = (side, mint, amount, quoteSol, quoteUsd, symbol) => ({
    ...base, side, tokenAddress: mint, tokenSymbol: symbol || mint.slice(0, 4), tokenAmount: amount, quoteSol, quoteUsd,
  });

  const data = evt.accountData || [];
  if (data.length) {
    let lamports = 0;
    const tok = new Map();
    for (const a of data) {
      if (a.account === address) lamports += Number(a.nativeBalanceChange || 0);
      for (const c of a.tokenBalanceChanges || []) {
        if (c.userAccount === address) tok.set(c.mint, (tok.get(c.mint) || 0) + tokenAmt(c));
      }
    }
    const quoteSol = lamports / 1e9 + (tok.get(WSOL) || 0);          // perubahan SOL bersih (wSOL ikut)
    let quoteUsd = 0;
    for (const m of STABLES) quoteUsd += tok.get(m) || 0;             // perubahan stablecoin (USD)
    const moved = [...tok].filter(([m, d]) => m !== WSOL && !STABLES.has(m) && d !== 0);
    if (moved.length !== 1) return null;                              // 0 atau >1 token -> bukan trade satu token yang jelas
    const [mint, d] = moved[0];
    if (d > 0 && (quoteSol < 0 || quoteUsd < 0)) return mk('buy', mint, d, quoteSol, quoteUsd);
    if (d < 0 && (quoteSol > 0 || quoteUsd > 0)) return mk('sell', mint, -d, quoteSol, quoteUsd);
    return null;
  }

  // Cadangan kalau payload tidak membawa accountData: events.swap (hanya swap SOL <-> token).
  const sw = evt.events && evt.events.swap;
  if (!sw) return null;
  const net = Number(sw.nativeInput?.amount || 0) / 1e9 - Number(sw.nativeOutput?.amount || 0) / 1e9;
  const outs = sw.tokenOutputs || [], ins = sw.tokenInputs || [];
  const outLeg = outs.find(t => t.mint && t.mint !== WSOL && !STABLES.has(t.mint));
  const inLeg = ins.find(t => t.mint && t.mint !== WSOL && !STABLES.has(t.mint));
  const sum = (legs, mint) => legs.filter(t => t.mint === mint && (!t.userAccount || t.userAccount === address)).reduce((x, t) => x + tokenAmt(t), 0);
  if (net > 0 && outLeg) return mk('buy', outLeg.mint, sum(outs, outLeg.mint), -net, 0, outLeg.symbol);
  if (net < 0 && inLeg) return mk('sell', inLeg.mint, sum(ins, inLeg.mint), -net, 0, inLeg.symbol);
  return null;
}

// Nilai trade dalam USD = nilai kuotasi bersih (SOL x harga SOL + stablecoin). Hasil <= 0 berarti tidak jelas.
function tradeUsd(p, solPrice) {
  const v = p.quoteSol * solPrice + p.quoteUsd;
  return p.side === 'buy' ? -v : v;
}

// Wallet ter-track yang terlibat di transaksi ini. Fee payer sering BUKAN wallet-nya (co-signer, relayer, bot trading),
// jadi semua akun yang saldonya berubah ikut dicek.
async function trackedAddressesIn(evt) {
  const seen = new Set();
  if (evt.feePayer) seen.add(evt.feePayer);
  for (const a of evt.accountData || []) {
    if (a.account) seen.add(a.account);
    for (const c of a.tokenBalanceChanges || []) if (c.userAccount) seen.add(c.userAccount);
  }
  if (!seen.size) return [];
  const { data, error } = await supabase.from('temnilan_wallets').select('address').eq('chain', 'solana').in('address', [...seen].slice(0, 150));
  if (error) throw error;
  return (data || []).map(w => w.address);
}

async function processSwap(p) {
  // 1) Wallet ini beneran di-track? Kalau gak ada di DB, abaikan — bukan
  //    fitur "input wallet bebas" (poin 1 & 11 spek).
  const { data: wallet } = await supabase
    .from('temnilan_wallets')
    .select('id')
    .eq('address', p.address)
    .maybeSingle();
  if (!wallet) return null;

  // Tanpa harga SOL, nilai USD jadi 0 (data palsu). Lempar error -> respons 500 -> provider retry nanti.
  const solPriceUsd = await getSolPriceUsd();
  if (!solPriceUsd) throw new Error('SOL price unavailable');
  const amountUsd = tradeUsd(p, solPriceUsd);
  if (!(amountUsd > 0)) return null; // nilai kuotasi tidak jelas -> dilewati, bukan angka karangan
  p.amountSol = amountUsd / solPriceUsd; // setara SOL (untuk tampilan)

  // 2) Simpan transaksi (upsert by signature). .select() cuma balikin baris yang BENAR-BENAR baru.
  const { data: inserted, error: txErr } = await supabase.from('temnilan_transactions').upsert({
    wallet_id: wallet.id,
    signature: p.signature,
    token_address: p.tokenAddress,
    token_symbol: p.tokenSymbol,
    side: p.side,
    amount_sol: p.amountSol,
    amount_usd: amountUsd,
    token_amount: p.tokenAmount,
    price: p.tokenAmount ? amountUsd / p.tokenAmount : null,
    dex: p.dex,
    occurred_at: p.occurredAt,
  }, { onConflict: 'signature', ignoreDuplicates: true }).select('id');
  if (txErr) throw txErr;
  // Signature sudah pernah diproses (webhook retry) -> jangan hitung posisi & alert dua kali.
  if (!inserted || !inserted.length) return null;

  // 3) Update status wallet.
  await supabase.from('temnilan_wallets')
    .update({ status: 'active', last_activity: p.occurredAt })
    .eq('id', wallet.id);

  // 4) Buka/tutup posisi (simplifikasi: 1 posisi aktif per token per wallet).
  const tradePnl = await upsertPosition(wallet.id, p, amountUsd); // angka hanya untuk SELL yang punya posisi
  if (typeof tradePnl === 'number') {
    await supabase.from('temnilan_transactions').update({ pnl_usd: tradePnl }).eq('id', inserted[0].id);
  }

  // 5) Evaluasi alert (poin 10).
  await evaluateAlerts(wallet.id, p, amountUsd);

  return true;
}

async function upsertPosition(walletId, p, amountUsd) {
  // Tanpa jumlah token, posisi tidak bisa dihitung. Transaksinya tetap tersimpan.
  if (!p.tokenAmount) return;
  const price = amountUsd / p.tokenAmount;

  const { data: pos } = await supabase
    .from('temnilan_positions')
    .select('*')
    .eq('wallet_id', walletId)
    .eq('token_address', p.tokenAddress)
    .is('closed_at', null)
    .maybeSingle();

  // Kolom posisi:
  //   token_amount = token yang masih dipegang | cost_usd = modal (USD) dari token yang masih dipegang
  //   bought_usd   = total USD yang pernah dipakai beli (penyebut ROI)
  //   realized_usd = profit/loss yang sudah terealisasi dari sell | size_sol = sisa modal dalam SOL
  if (p.side === 'buy') {
    if (pos) {
      const tokens = Number(pos.token_amount || 0) + p.tokenAmount;
      const cost = Number(pos.cost_usd || 0) + amountUsd;
      await supabase.from('temnilan_positions').update({
        token_amount: tokens,
        cost_usd: cost,
        bought_usd: Number(pos.bought_usd || 0) + amountUsd,
        size_sol: Number(pos.size_sol || 0) + p.amountSol,
        entry_price: cost / tokens, // harga masuk rata-rata
      }).eq('id', pos.id);
    } else {
      await supabase.from('temnilan_positions').insert({
        wallet_id: walletId,
        token_address: p.tokenAddress,
        token_symbol: p.tokenSymbol,
        entry_price: price,
        current_price: null, // belum ada harga terkini (price refresher belum ada)
        size_sol: p.amountSol,
        token_amount: p.tokenAmount,
        cost_usd: amountUsd,
        bought_usd: amountUsd,
        opened_at: p.occurredAt,
      });
    }
    return;
  }

  // SELL tanpa posisi terbuka (trade lama sebelum tracking dimulai) -> dilewati, bukan bikin angka karangan.
  const held = pos ? Number(pos.token_amount) : 0;
  if (!pos || !held) return;

  const fraction = Math.min(1, p.tokenAmount / held);   // porsi posisi yang dijual
  const costSold = Number(pos.cost_usd) * fraction;
  const realized = Number(pos.realized_usd || 0) + (amountUsd - costSold);
  const closing = fraction >= 0.99;
  const bought = Number(pos.bought_usd || 0);

  const update = {
    token_amount: closing ? 0 : held - p.tokenAmount,
    cost_usd: closing ? 0 : Number(pos.cost_usd) - costSold,
    size_sol: closing ? pos.size_sol : Number(pos.size_sol) * (1 - fraction),
    realized_usd: realized,
    pnl_usd: realized,
    roi_pct: bought ? (realized / bought) * 100 : null,
  };
  if (closing) {
    update.closed_at = p.occurredAt;
    update.current_price = price;
  }
  await supabase.from('temnilan_positions').update(update).eq('id', pos.id);
  return amountUsd - costSold; // realized PnL dari sell ini
}

async function evaluateAlerts(walletId, p, amountUsd) {
  if (amountUsd >= LARGE_TX_USD_THRESHOLD) {
    await supabase.from('temnilan_alerts').insert({
      wallet_id: walletId,
      type: p.side === 'buy' ? 'large_buy' : 'large_sell',
      token_symbol: p.tokenSymbol,
      amount_sol: p.amountSol,
      amount_usd: amountUsd,
    });
  }

  if (p.side === 'buy') {
    const since = new Date(Date.now() - MULTI_WALLET_WINDOW_MS).toISOString();
    const { data: recent } = await supabase
      .from('temnilan_transactions')
      .select('wallet_id')
      .eq('token_address', p.tokenAddress)
      .eq('side', 'buy')
      .gte('occurred_at', since);

    const distinctWallets = new Set((recent || []).map(r => r.wallet_id));
    if (distinctWallets.size >= MULTI_WALLET_MIN_COUNT) {
      await supabase.from('temnilan_alerts').insert({
        wallet_id: null,
        type: 'multi_wallet',
        token_symbol: p.tokenSymbol,
        meta: { wallet_count: distinctWallets.size, window_seconds: MULTI_WALLET_WINDOW_MS / 1000 },
      });
    }
  }
}

let _solPriceCache = { value: null, at: 0 };
async function getSolPriceUsd() {
  if (_solPriceCache.value && Date.now() - _solPriceCache.at < 30_000) return _solPriceCache.value;
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const j = await r.json();
    _solPriceCache = { value: j?.solana?.usd || 0, at: Date.now() };
  } catch {
    _solPriceCache = { value: _solPriceCache.value || 0, at: Date.now() };
  }
  return _solPriceCache.value;
}
