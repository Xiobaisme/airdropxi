// lib/server/coinalyze-liq.js
// Backend tabel likuidasi (Coinalyze). Dipanggil dari api/market.js lewat /api/market?type=liq&coin=BTC&tf=24h
// Butuh env var COINALYZE_API_KEY di Vercel.

const sum = (a, f) => a.reduce((s, x) => s + Number(f(x) || 0), 0);
// nama koin Binance (1000PEPE) -> nama umum bursa lain (PEPE)
const P = c => c.replace(/^1(0{3,})(?=[A-Z])/, '');

const CZ = 'https://api.coinalyze.net/v1';
// tf -> [menit, interval bucket Coinalyze]; semua harian seperti chart Coinalyze
const LQ_TF = Object.fromEntries(Object.entries({ '1w': 7, '1m': 30, '2m': 60, '3m': 90, '4m': 120, '5m': 150, '6m': 180, '8m': 240, '1y': 365, '2y': 730 })
  .map(([k, d]) => [k, [d * 1440, 'daily']]));

const LQ_PRIO = ['binance', 'bybit', 'okx', 'bitget', 'gate', 'hyperliquid', 'htx', 'mexc', 'kucoin', 'bitmex', 'deribit', 'dydx', 'kraken'];
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const rank = name => { const i = LQ_PRIO.findIndex(p => norm(name).includes(p)); return i < 0 ? 99 : i; };

const czGetOne = async (path, params, key) => {
  const qs = new URLSearchParams({ ...params, api_key: key }).toString();
  const r = await fetch(`${CZ}${path}?${qs}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (r.ok) return r.json();
  const e = new Error('Coinalyze HTTP ' + r.status);
  e.status = r.status; e.retry = Number(r.headers.get('retry-after')) || 0;
  throw e;
};

// pool key: env COINALYZE_API_KEYS="key1,key2,key3" (atau COINALYZE_API_KEY tunggal)
const czKeys = () => (process.env.COINALYZE_API_KEYS || process.env.COINALYZE_API_KEY || '').split(',').map(s => s.trim()).filter(Boolean);
const keyBlocked = new Map();   // key -> diblokir sampai kapan
let keyIdx = 0;
const czGet = async (path, params) => {
  const keys = czKeys();
  let lastErr;
  for (let n = 0; n < keys.length; n++) {
    const i = (keyIdx + n) % keys.length, k = keys[i];
    if (Date.now() < (keyBlocked.get(k) || 0)) continue;
    try {
      const out = await czGetOne(path, params, k);
      keyIdx = (i + 1) % keys.length;   // panggilan berikutnya pakai key lain (bagi rata)
      return out;
    } catch (e) {
      lastErr = e;
      if (e.status === 429) { keyBlocked.set(k, Date.now() + (e.retry || 60) * 1000); continue; }
      throw e;
    }
  }
  throw lastErr || Object.assign(new Error('Coinalyze HTTP 429'), { status: 429, retry: 60 });
};

// daftar bursa + market perpetual (jarang berubah, simpan 6 jam)
let czMeta = null;
const czLoadMeta = async key => {
  if (czMeta && Date.now() - czMeta.t < 6 * 3600e3) return czMeta;
  const [ex, mk] = await Promise.all([czGet('/exchanges', {}, key), czGet('/future-markets', {}, key)]);
  const names = {};
  (ex || []).forEach(x => { names[x.code] = x.name; });
  const perps = (mk || []).filter(m => m.is_perpetual).map(m => ({
    symbol: m.symbol, exchange: m.exchange, base: m.base_asset, quote: m.quote_asset, stable: m.margined === 'STABLE',
  }));
  return (czMeta = { t: Date.now(), names, perps });
};

// satu simbol terbaik per bursa (prioritas: stablecoin USDT > USDC > lainnya, lalu coin-margined)
const czPick = (meta, coin) => {
  const bases = new Set([coin, P(coin)]);
  const best = {};
  for (const m of meta.perps) {
    if (!bases.has(m.base)) continue;
    const name = meta.names[m.exchange] || m.exchange;
    const score = (m.base === coin ? 0 : 10) + (m.stable ? 0 : 5) + (m.quote === 'USDT' ? 0 : m.quote === 'USDC' ? 1 : 2);
    if (!best[name] || score < best[name].score) best[name] = { name, symbol: m.symbol, score };
  }
  return Object.values(best).sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name)).slice(0, 15);
};

const czCache = new Map();   // cache 60 detik per koin+timeframe (limit Coinalyze cuma 40 panggilan/menit)

// bursa yang terbukti tidak punya data likuidasi di Coinalyze -> dilewati 6 jam (hemat jatah 40 panggilan/menit)
const czNoData = new Map();   // nama bursa -> waktu ditandai
const NO_DATA_TTL = 6 * 3600e3;
// cache bersama lintas instance (Upstash Redis, env sama dengan admin-airdrop)
let _rd;
const rd = async () => (_rd ||= (await import('@upstash/redis')).Redis.fromEnv());
const rGet = async k => { try { const v = await (await rd()).get(k); return v == null ? null : (typeof v === 'string' ? JSON.parse(v) : v); } catch { return null; } };
const rSet = async (k, v, ex) => { try { await (await rd()).set(k, JSON.stringify(v), { ex: Math.max(1, Math.ceil(ex)) }); } catch {} };
let czBlockedUntil = 0;

export default async function liqHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  const fail = (code, error) => { res.setHeader('Cache-Control', 'no-store'); return res.status(code).json({ error }); };
  const stale = data => { res.setHeader('Cache-Control', 'no-store'); return res.status(200).json({ ...data, stale: true }); };

  const key = (process.env.COINALYZE_API_KEYS || process.env.COINALYZE_API_KEY || '').split(',')[0].trim();
  if (!key) return fail(500, 'COINALYZE_API_KEY belum diset di Vercel (Settings > Environment Variables), lalu Redeploy');

  const coin = String(req.query.coin || 'BTC').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'BTC';
  const tfq = String(req.query.tf || '').toLowerCase();
  const tf = LQ_TF[tfq] ? tfq : '1m';
  const ck = coin + '|' + tf, rk = `liq:v1:${coin}:${tf}`;

  // 1) cache memori instance ini, 2) cache Redis (dipakai semua instance)
  const mem = czCache.get(ck);
  if (mem && Date.now() - mem.t < 300000) return res.status(200).json(mem.data);
  const shared = await rGet(rk);
  if (shared) return res.status(200).json(shared);

  // 3) lagi diblokir Coinalyze: jangan nembak, pakai data lama
  const lastGood = async () => (mem && mem.data) || await rGet(rk + ':stale');
  const until = Math.max(czBlockedUntil, Number(await rGet('liq:blocked')) || 0);
  if (Date.now() < until) {
    const old = await lastGood();
    if (old) return stale(old);
    return fail(429, `Limit Coinalyze tercapai, coba lagi sekitar ${Math.ceil((until - Date.now()) / 60000)} menit`);
  }

  try {
    const meta = await czLoadMeta(key);
    const picks = czPick(meta, coin);
    if (!picks.length) return fail(404, `${coin} tidak ditemukan di Coinalyze`);

    const [mins, interval] = LQ_TF[tf];
    const to = Math.floor(Date.now() / 1000), from = to - mins * 60;

    const now = Date.now();
    const active = picks.filter(p => now - (czNoData.get(p.name) || 0) >= NO_DATA_TTL);
    const j = active.length
      ? await czGet('/liquidation-history', { symbols: active.map(p => p.symbol).join(','), interval, from, to, convert_to_usd: 'true' }, key)
      : [];
    const bySym = new Map((Array.isArray(j) ? j : []).map(x => [x.symbol, x.history || []]));
    const probe = (coin === 'BTC' || coin === 'ETH') && mins >= 720;

    const rows = picks.map(p => {
      if (!active.includes(p)) return { exchange: p.name, symbol: p.symbol, error: 'Tidak ada data likuidasi dari Coinalyze' };
      const h = bySym.get(p.symbol);
      if (!h || !h.length) {
        if (probe) czNoData.set(p.name, now);
        return { exchange: p.name, symbol: p.symbol, error: 'Tidak ada data di rentang ini' };
      }
      czNoData.delete(p.name);
      const long = sum(h, x => x.l), short = sum(h, x => x.s);
      return { exchange: p.name, symbol: p.symbol, long, short, total: long + short };
    });
    const ok = rows.filter(r => !r.error);
    const totals = { long: sum(ok, r => r.long), short: sum(ok, r => r.short) };
    totals.total = totals.long + totals.short;
    rows.sort((a, b) => (b.total || -1) - (a.total || -1));

    // likuidasi per hari: array l/s sejajar dengan urutan `exchanges`
    const exchanges = ok.map(r => r.exchange);
    const dayMap = new Map();
    ok.forEach((r, i) => {
      for (const x of bySym.get(r.symbol) || []) {
        let d = dayMap.get(x.t);
        if (!d) dayMap.set(x.t, d = { t: x.t, l: exchanges.map(() => 0), s: exchanges.map(() => 0) });
        d.l[i] += Number(x.l) || 0; d.s[i] += Number(x.s) || 0;
      }
    });
    const days = [...dayMap.values()].sort((a, b) => a.t - b.t);

    // OI history, volume, dan OI saat ini (1 panggilan per jenis)
    const syms = picks.map(p => p.symbol).join(',');
    const [oiH, ohlc, oiNow] = await Promise.all([
      czGet('/open-interest-history', { symbols: syms, interval, from, to, convert_to_usd: 'true' }, key),
      czGet('/ohlcv-history', { symbols: syms, interval, from, to }, key),
      czGet('/open-interest', { symbols: syms, convert_to_usd: 'true' }, key),
    ]);
    const series = (arr, f) => {
      const m = new Map((Array.isArray(arr) ? arr : []).map(x => [x.symbol, x.history || []]));
      const ex = [], map = new Map();
      picks.forEach(p => {
        const hs = m.get(p.symbol);
        if (!hs || !hs.length) return;
        const i = ex.push(p.name) - 1;
        for (const x of hs) {
          let d = map.get(x.t);
          if (!d) map.set(x.t, d = { t: x.t, v: [] });
          d.v[i] = (d.v[i] || 0) + f(x);
        }
      });
      return { exchanges: ex, days: [...map.values()].sort((a, b) => a.t - b.t).map(d => ({ t: d.t, v: ex.map((_, i) => d.v[i] || 0) })) };
    };
    const oi = series(oiH, x => Number(x.c) || 0);
    const vol = series(ohlc, x => (Number(x.v) || 0) * (Number(x.c) || 0));
    const oiCur = (Array.isArray(oiNow) ? oiNow : [])
      .map(x => ({ exchange: (picks.find(p => p.symbol === x.symbol) || {}).name, value: Number(x.value) || 0 }))
      .filter(x => x.exchange && x.value > 0)
      .sort((a, b) => b.value - a.value);

    const data = { coin, tf, from, to, rows, totals, exchanges, days, oi, vol, oiCur, updated_at: new Date().toISOString() };
    if (czCache.size > 200) czCache.clear();
    czCache.set(ck, { t: Date.now(), data });
    await rSet(rk, data, 300);            // segar 5 menit, dipakai semua instance
    await rSet(rk + ':stale', data, 86400);   // cadangan 24 jam kalau Coinalyze bermasalah
    return res.status(200).json(data);
  } catch (e) {
    if (e.status === 429) {
      const secs = e.retry || 60;
      czBlockedUntil = Date.now() + secs * 1000;
      await rSet('liq:blocked', czBlockedUntil, secs);   // semua instance ikut berhenti nembak
    }
    const old = await lastGood();
    if (old) return stale(old);
    if (e.status === 401) return fail(502, 'API key Coinalyze ditolak, cek nilai COINALYZE_API_KEY');
    if (e.status === 429) return fail(429, `Limit Coinalyze tercapai, coba lagi sekitar ${Math.ceil((e.retry || 60) / 60)} menit`);
    return fail(502, String(e.message || e).slice(0, 120));
  }
}