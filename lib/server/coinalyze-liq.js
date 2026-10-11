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

// bursa yang terbukti tidak punya data likuidasi di Coinalyze -> dilewati 6 jam (hemat jatah 40 panggilan/menit)
const czNoData = new Map();   // nama bursa -> waktu ditandai
const NO_DATA_TTL = 6 * 3600e3;

export default async function liqHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  const fail = (code, error) => { res.setHeader('Cache-Control', 'no-store'); return res.status(code).json({ error }); };

  const key = process.env.COINALYZE_API_KEY;
  if (!key) return fail(500, 'COINALYZE_API_KEY belum diset di Vercel (Settings > Environment Variables), lalu Redeploy');

  const coin = String(req.query.coin || 'BTC').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'BTC';
  const tfq = String(req.query.tf || '').toLowerCase();
  const tf = LQ_TF[tfq] ? tfq : '1m';
  const ck = coin + '|' + tf;
  const hit = czCache.get(ck);
  if (hit && Date.now() - hit.t < 60000) return res.status(200).json(hit.data);

  try {
    const meta = await czLoadMeta(key);
    const picks = czPick(meta, coin);
    if (!picks.length) return fail(404, `${coin} tidak ditemukan di Coinalyze`);

    const [mins, interval] = LQ_TF[tf];
    const to = Math.floor(Date.now() / 1000), from = to - mins * 60;

    // lewati bursa yang sudah terbukti tidak punya data likuidasi (tidak memakai jatah panggilan)
    const now = Date.now();
    const active = picks.filter(p => now - (czNoData.get(p.name) || 0) >= NO_DATA_TTL);
    const j = active.length
      ? await czGet('/liquidation-history', { symbols: active.map(p => p.symbol).join(','), interval, from, to, convert_to_usd: 'true' }, key)
      : [];
    const bySym = new Map((Array.isArray(j) ? j : []).map(x => [x.symbol, x.history || []]));

    // BTC/ETH di rentang >= 12 jam pasti ada likuidasi di bursa yang datanya didukung.
    // Kalau kosong, bursa itu ditandai "tidak punya data" selama 6 jam.
    const probe = (coin === 'BTC' || coin === 'ETH') && mins >= 720;

    const rows = picks.map(p => {
      if (!active.includes(p)) return { exchange: p.name, symbol: p.symbol, error: 'Tidak ada data likuidasi dari Coinalyze' };
      const h = bySym.get(p.symbol);
      if (!h || !h.length) {
        if (probe) czNoData.set(p.name, now);
        return { exchange: p.name, symbol: p.symbol, error: 'Tidak ada data di rentang ini' };
      }
      czNoData.delete(p.name);
      const long = sum(h, x => x.l), short = sum(h, x => x.s);   // l = long yang dilikuidasi, s = short yang dilikuidasi (USD)
      return { exchange: p.name, symbol: p.symbol, long, short, total: long + short };
    });
    const ok = rows.filter(r => !r.error);
    const totals = { long: sum(ok, r => r.long), short: sum(ok, r => r.short) };
    totals.total = totals.long + totals.short;
    rows.sort((a, b) => (b.total || -1) - (a.total || -1));

        // gabung per hari: array l/s sejajar dengan urutan `exchanges`
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
     
        // OI history, volume, dan OI saat ini untuk semua bursa terpilih (1 panggilan per jenis)
    const syms = picks.map(p => p.symbol).join(',');
    const [oiH, ohlc, oiNow] = await Promise.all([
      czGet('/open-interest-history', { symbols: syms, interval, from, to, convert_to_usd: 'true' }, key),
      czGet('/ohlcv-history', { symbols: syms, interval, from, to }, key),
      czGet('/open-interest', { symbols: syms, convert_to_usd: 'true' }, key),
    ]);
    // gabung per hari: v[] sejajar dengan urutan exchanges
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
    const vol = series(ohlc, x => (Number(x.v) || 0) * (Number(x.c) || 0));   // volume (koin) x harga close = USD
    const oiCur = (Array.isArray(oiNow) ? oiNow : [])
      .map(x => ({ exchange: (picks.find(p => p.symbol === x.symbol) || {}).name, value: Number(x.value) || 0 }))
      .filter(x => x.exchange && x.value > 0)
      .sort((a, b) => b.value - a.value);

    const data = { coin, tf, from, to, rows, totals, exchanges, days, oi, vol, oiCur, updated_at: new Date().toISOString() };
    
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