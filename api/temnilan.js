// api/temnilan.js — TEMNILAN Degen Terminal (semua endpoint dalam 1 function)

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
};

module.exports = async function handler(req, res) {
  const { resource } = req.query;
  if (!resource || !Object.prototype.hasOwnProperty.call(ROUTES, resource)) {
    return res.status(404).json({
      error: `Unknown resource "${resource || ''}". Valid: ${Object.keys(ROUTES).join(', ')}`,
    });
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

  const stats = computeWalletStats(transactions || [], positions || []);
  const behavior = computeBehavior(transactions || [], positions || []);

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

  const totalInvested = positions.reduce((s, p) => s + (Number(p.size_sol) || 0), 0) || null;
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
  return res.status(201).json(data);
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
  return res.status(200).json(data);
}

async function deleteWallet(req, res, id) {
  if (!id) return res.status(400).json({ error: 'id wajib ada di query' });
  const { error } = await supabase.from('temnilan_wallets').delete().eq('id', id);
  if (error) throw error;
  return res.status(200).json({ success: true });
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
      const parsed = parseSwapEvent(evt);
      if (!parsed) continue; // bukan swap / bukan wallet yang di-track
      results.push(await processSwap(parsed));
    }
    return res.status(200).json({ processed: results.filter(Boolean).length });
  } catch (err) {
    console.error('[temnilan-webhook]', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

function parseSwapEvent(evt) {
  const swap = evt?.events?.swap;
  if (!swap) return null;

  const feePayer = evt.feePayer;
  const signature = evt.signature;
  const timestamp = evt.timestamp ? new Date(evt.timestamp * 1000).toISOString() : new Date().toISOString();

  // Helius: nativeInput/nativeOutput dalam lamports SOL.
  const solIn = Number(swap.nativeInput?.amount || 0) / 1e9;
  const solOut = Number(swap.nativeOutput?.amount || 0) / 1e9;
  const isBuy = solIn > 0 && solOut === 0;   // SOL keluar dari wallet -> beli token
  const isSell = solOut > 0 && solIn === 0;  // SOL masuk ke wallet -> jual token
  if (!isBuy && !isSell) return null;

  const tokenLeg = isBuy ? swap.tokenOutputs?.[0] : swap.tokenInputs?.[0];
  if (!tokenLeg) return null;

  return {
    address: feePayer,
    signature,
    side: isBuy ? 'buy' : 'sell',
    amountSol: isBuy ? solIn : solOut,
    tokenAddress: tokenLeg.mint,
    tokenSymbol: tokenLeg.symbol || (tokenLeg.mint ? tokenLeg.mint.slice(0, 4) : '???'),
    tokenAmount: Number(tokenLeg.tokenAmount || tokenLeg.rawTokenAmount?.tokenAmount || 0),
    dex: evt.source || null,
    occurredAt: timestamp,
  };
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

  const solPriceUsd = await getSolPriceUsd();
  const amountUsd = p.amountSol * solPriceUsd;

  // 2) Simpan transaksi (upsert by signature -> aman kalau webhook retry).
  const { error: txErr } = await supabase.from('temnilan_transactions').upsert({
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
  }, { onConflict: 'signature', ignoreDuplicates: true });
  if (txErr) throw txErr;

  // 3) Update status wallet.
  await supabase.from('temnilan_wallets')
    .update({ status: 'active', last_activity: p.occurredAt })
    .eq('id', wallet.id);

  // 4) Buka/tutup posisi (simplifikasi: 1 posisi aktif per token per wallet).
  await upsertPosition(wallet.id, p, amountUsd);

  // 5) Evaluasi alert (poin 10).
  await evaluateAlerts(wallet.id, p, amountUsd);

  return true;
}

async function upsertPosition(walletId, p, amountUsd) {
  const { data: existing } = await supabase
    .from('temnilan_positions')
    .select('*')
    .eq('wallet_id', walletId)
    .eq('token_address', p.tokenAddress)
    .is('closed_at', null)
    .maybeSingle();

  if (p.side === 'buy') {
    if (existing) {
      const newSize = Number(existing.size_sol) + p.amountSol;
      await supabase.from('temnilan_positions').update({ size_sol: newSize }).eq('id', existing.id);
    } else {
      await supabase.from('temnilan_positions').insert({
        wallet_id: walletId,
        token_address: p.tokenAddress,
        token_symbol: p.tokenSymbol,
        entry_price: p.tokenAmount ? amountUsd / p.tokenAmount : null,
        current_price: p.tokenAmount ? amountUsd / p.tokenAmount : null,
        size_sol: p.amountSol,
        opened_at: p.occurredAt,
      });
    }
  } else if (existing) {
    // Sell -> tutup posisi & hitung realized PnL sederhana.
    const entryValueUsd = Number(existing.size_sol) * Number(existing.entry_price || 0);
    const pnlUsd = amountUsd - entryValueUsd;
    const roiPct = entryValueUsd ? (pnlUsd / entryValueUsd) * 100 : null;
    await supabase.from('temnilan_positions').update({
      closed_at: p.occurredAt,
      current_price: p.tokenAmount ? amountUsd / p.tokenAmount : existing.current_price,
      pnl_usd: pnlUsd,
      roi_pct: roiPct,
    }).eq('id', existing.id);
  }
  // Sell tapi gak ada posisi terbuka (data historis sebelum tracking dimulai)
  // -> sengaja dilewati, bukan bikin posisi negatif ngarang (poin 14).
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
