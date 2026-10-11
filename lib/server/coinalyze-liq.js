// lib/server/coinalyze-liq.js
// Backend tabel likuidasi (Coinalyze). Dipanggil dari api/market.js lewat /api/market?type=liq&coin=BTC&tf=24h
// Butuh env var COINALYZE_API_KEY di Vercel.

const sum = (a, f) => a.reduce((s, x) => s + Number(f(x) || 0), 0);
// nama koin Binance (1000PEPE) -> nama umum bursa lain (PEPE)
const P = c => c.replace(/^1(0{3,})(?=[A-Z])/, '');

const CZ = 'https://api.coinalyze.net/v1';
// tf -> [menit, interval bucket Coinalyze]
const LQ_TF = { '1h': [60, '5min'], '4h': [240, '15min'], '12h': [720, '1hour'], '24h': [1440, '1hour'] };
const LQ_PRIO = ['binance', 'bybit', 'okx', 'bitget', 'gate', 'hyperliquid', 'htx', 'mexc', 'kucoin', 'bitmex', 'deribit', 'dydx', 'kraken'];
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const rank = name => { const i = LQ_PRIO.findIndex(p => norm(name).includes(p)); return i < 0 ? 99 : i; };

const czGet = async (path, params, key) => {
  const qs = new URLSearchParams({ ...params, api_key: key }).toString();
  const r = await fetch(`${CZ}${path}?${qs}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (r.ok) return r.json();
  const e = new Error('Coinalyze HTTP ' + r.status);
  e.status = r.status; e.retry = Number(r.headers.get('retry-after')) || 0;
  throw e;
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

export default async function liqHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  const fail = (code, error) => { res.setHeader('Cache-Control', 'no-store'); return res.status(code).json({ error }); };

  const key = process.env.COINALYZE_API_KEY;
  if (!key) return fail(500, 'COINALYZE_API_KEY belum diset di Vercel (Settings > Environment Variables), lalu Redeploy');

  const coin = String(req.query.coin || 'BTC').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'BTC';
  const tf = LQ_TF[req.query.tf] ? req.query.tf : '24h';
  const ck = coin + '|' + tf;
  const hit = czCache.get(ck);
  if (hit && Date.now() - hit.t < 60000) return res.status(200).json(hit.data);

  try {
    const meta = await czLoadMeta(key);
    const picks = czPick(meta, coin);
    if (!picks.length) return fail(404, `${coin} tidak ditemukan di Coinalyze`);

    const [mins, interval] = LQ_TF[tf];
    const to = Math.floor(Date.now() / 1000), from = to - mins * 60;
    const j = await czGet('/liquidation-history', {
      symbols: picks.map(p => p.symbol).join(','), interval, from, to, convert_to_usd: 'true',
    }, key);
    const bySym = new Map((Array.isArray(j) ? j : []).map(x => [x.symbol, x.history || []]));

    const rows = picks.map(p => {
      const h = bySym.get(p.symbol);
      if (!h || !h.length) return { exchange: p.name, symbol: p.symbol, error: 'Tidak ada data di rentang ini' };
      const long = sum(h, x => x.l), short = sum(h, x => x.s);   // l = long yang dilikuidasi, s = short yang dilikuidasi (USD)
      return { exchange: p.name, symbol: p.symbol, long, short, total: long + short };
    });
    const ok = rows.filter(r => !r.error);
    const totals = { long: sum(ok, r => r.long), short: sum(ok, r => r.short) };
    totals.total = totals.long + totals.short;
    rows.sort((a, b) => (b.total || -1) - (a.total || -1));

    const data = { coin, tf, from, to, rows, totals, updated_at: new Date().toISOString() };
    if (czCache.size > 200) czCache.clear();
    czCache.set(ck, { t: Date.now(), data });
    return res.status(200).json(data);
  } catch (e) {
    // gagal (mis. kena limit 429) tapi ada data lama -> tampilkan data lama
    if (hit && Date.now() - hit.t < 15 * 60000) { res.setHeader('Cache-Control', 'no-store'); return res.status(200).json({ ...hit.data, stale: true }); }
    if (e.status === 401) return fail(502, 'API key Coinalyze ditolak, cek nilai COINALYZE_API_KEY');
    if (e.status === 429) return fail(429, `Limit Coinalyze (40 panggilan/menit) tercapai, coba lagi sekitar ${e.retry || 60} detik`);
    return fail(502, String(e.message || e).slice(0, 120));
  }
}