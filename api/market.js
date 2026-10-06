// api/flow.js  ->  /api/flow?coin=BTC&tf=5m
const TF = { '5m': 5, '15m': 15, '30m': 30, '1h': 60, '2h': 120, '4h': 240, '6h': 360, '12h': 720, '1d': 1440 };
const H = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36', Accept: 'application/json' };

const get = url =>
  fetch(url, { headers: H, signal: AbortSignal.timeout(7000) }).then(async r => {
    if (r.ok) return r.json();
    throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 80)}`);
  });
const sum = (a, f) => a.reduce((s, x) => s + Number(f(x) || 0), 0);
const mult = {};
const gateMult = async c => (mult[c] ??= Number((await get(`https://api.gateio.ws/api/v4/futures/usdt/contracts/${c}_USDT`)).quanto_multiplier));

// Binance & Aster: kline 1 menit punya taker-buy volume (live, update tiap trade)
const klineFlow = base => async (c, n) => {
  const iv = n <= 60 ? 1 : 5; // jendela panjang pakai kline 5 menit
  const k = await get(`${base}/fapi/v1/klines?symbol=${c}USDT&interval=${iv}m&limit=${n / iv}`);
  const buy = sum(k, x => x[10]);          // taker buy quote volume (USDT)
  const total = sum(k, x => x[7]);         // total quote volume (USDT)
  return { buy, sell: total - buy, usd: true };
};

const EX = {
  Binance: klineFlow('https://fapi.binance.com'),
  Aster: klineFlow('https://fapi.asterdex.com'),

  // OKX: bucket 5 menit, format [ts, sellVol, buyVol], terbaru di atas
  OKX: async (c, n) => {
    const hourly = n >= 120; // 2 jam ke atas pakai bucket per jam
    const j = await get(`https://www.okx.com/api/v5/rubik/stat/taker-volume?ccy=${c}&instType=CONTRACTS&period=${hourly ? '1H' : '5m'}`);
    const rows = (j.data || []).slice(0, Math.ceil(n / (hourly ? 60 : 5)));
    return { sell: sum(rows, r => r[1]), buy: sum(rows, r => r[2]), usd: true };
  },

  // Bybit: dari 1000 trade terakhir yang masuk jendela waktu
  Bybit: async (c, n) => {
    const j = await get(`https://api.bybit.com/v5/market/recent-trade?category=linear&symbol=${c}USDT&limit=1000`);
    const all = j.result?.list || [];
    const from = Date.now() - n * 60000;
    const t = all.filter(x => Number(x.time) >= from);
    const oldest = Math.min(...all.map(x => Number(x.time)));
    const partial = all.length >= 1000 && oldest > from; // batas 1000 trade tercapai sebelum jendela penuh
    const usdOf = side => sum(t.filter(x => x.side === side), x => Number(x.size) * Number(x.price));
    return { buy: usdOf('Buy'), sell: usdOf('Sell'), usd: true, partial, secs: Math.round((Date.now() - oldest) / 1000) };
  },

    // Bitget: 100 trade terakhir (batas API)
  Bitget: async (c, n) => {
    const j = await get(`https://api.bitget.com/api/v2/mix/market/fills?symbol=${c}USDT&productType=USDT-FUTURES&limit=100`);
    const all = j.data || [];
    const from = Date.now() - n * 60000;
    const t = all.filter(x => Number(x.ts) >= from);
    const oldest = Math.min(...all.map(x => Number(x.ts)));
    const partial = all.length >= 100 && oldest > from;
    const usdOf = side => sum(t.filter(x => x.side === side), x => Number(x.size) * Number(x.price));
    return { buy: usdOf('buy'), sell: usdOf('sell'), usd: true, partial, secs: Math.round((Date.now() - oldest) / 1000) };
  },

  // Gate.io: 1000 trade terakhir; size + = taker buy, − = taker sell (satuan kontrak)
  Gate: async (c, n) => {
    const [t, m] = await Promise.all([
      get(`https://api.gateio.ws/api/v4/futures/usdt/trades?contract=${c}_USDT&limit=1000`),
      gateMult(c),
    ]);
    const ms = x => { const v = Number(x.create_time_ms || x.create_time); return v < 1e11 ? v * 1000 : v; };
    const from = Date.now() - n * 60000;
    const w = t.filter(x => ms(x) >= from);
    const oldest = Math.min(...t.map(ms));
    const partial = t.length >= 1000 && oldest > from;
    const usd = x => Math.abs(x.size) * m * Number(x.price);
    return { buy: sum(w.filter(x => x.size > 0), usd), sell: sum(w.filter(x => x.size < 0), usd), usd: true, partial, secs: Math.round((Date.now() - oldest) / 1000) };
  },

  // Kraken Futures: analytics cvd per 1 menit (buyVolume / sellVolume)
  Kraken: async (c, n) => {
    const sym = `PF_${c === 'BTC' ? 'XBT' : c}USD`;
    const since = Math.floor(Date.now() / 1000) - (n + 10) * 60;
    const iv = n <= 60 ? 60 : 300; // detik per bucket
    const cnt = (n * 60) / iv;
    const j = await get(`https://futures.kraken.com/api/charts/v1/analytics/${sym}/cvd?since=${since}&interval=${iv}`);
    const d = j.result?.data;
    const keys = d && !Array.isArray(d) ? Object.keys(d) : [];
    const pick = re => { const k = keys.find(k => re.test(k)); return k && Array.isArray(d[k]) ? d[k] : []; };
    const b = pick(/buy/i).slice(-cnt), s = pick(/sell/i).slice(-cnt);
    if (!b.length && !s.length) throw new Error('Kraken data: ' + JSON.stringify(d ?? null).slice(0, 200));
    return { buy: sum(b, x => x), sell: sum(s, x => x) };
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=8, stale-while-revalidate=15');

  const coin = String(req.query.coin || 'BTC').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  const tf = TF[req.query.tf] ? req.query.tf : '5m';
  const n = TF[tf];

  const names = Object.keys(EX);
  const out = await Promise.allSettled(names.map(k => EX[k](coin, n)));

  const rows = out.map((o, i) => {
    if (o.status !== 'fulfilled') return { name: names[i], error: String(o.reason?.message || o.reason).slice(0, 100) };
    const { buy, sell, usd, partial, secs } = o.value;
    const total = buy + sell;
    return total > 0
      ? { name: names[i], buy, sell, pct: (buy / total) * 100, usd: !!usd, partial: !!partial, secs }
      : { name: names[i], error: 'Belum ada trade di jendela ini' };
  });

  const ok = rows.filter(r => !r.error);
  const w = ok.filter(r => r.usd && !r.partial);
  const avg = w.length
    ? (sum(w, r => r.buy) / sum(w, r => r.buy + r.sell)) * 100
    : ok.length ? ok.reduce((s, r) => s + r.pct, 0) / ok.length : null;
  const all = avg === null ? { name: 'All', error: 'Semua bursa gagal' } : { name: 'All', pct: avg, avg: true };

  res.status(200).json({ coin, tf, minutes: n, rows: [all, ...rows], updated_at: new Date().toISOString() });
}
