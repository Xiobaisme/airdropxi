// api/flow.js  ->  /api/flow?coin=BTC&tf=5m
const TF = { '5m': 5, '15m': 15, '30m': 30, '1h': 60 };
const H = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36', Accept: 'application/json' };

const get = url =>
  fetch(url, { headers: H, signal: AbortSignal.timeout(7000) }).then(async r => {
    if (r.ok) return r.json();
    throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 80)}`);
  });
const sum = (a, f) => a.reduce((s, x) => s + Number(f(x) || 0), 0);

// Binance & Aster: kline 1 menit punya taker-buy volume (live, update tiap trade)
const klineFlow = base => async (c, n) => {
  const k = await get(`${base}/fapi/v1/klines?symbol=${c}USDT&interval=1m&limit=${n}`);
  const buy = sum(k, x => x[10]);          // taker buy quote volume (USDT)
  const total = sum(k, x => x[7]);         // total quote volume (USDT)
  return { buy, sell: total - buy, usd: true };
};

const EX = {
  Binance: klineFlow('https://fapi.binance.com'),
  Aster: klineFlow('https://fapi.asterdex.com'),

  // OKX: bucket 5 menit, format [ts, sellVol, buyVol], terbaru di atas
  OKX: async (c, n) => {
    const j = await get(`https://www.okx.com/api/v5/rubik/stat/taker-volume?ccy=${c}&instType=CONTRACTS&period=5m`);
    const rows = (j.data || []).slice(0, Math.ceil(n / 5));
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

  // Kraken Futures: analytics cvd per 1 menit (buyVolume / sellVolume)
  Kraken: async (c, n) => {
    const sym = `PF_${c === 'BTC' ? 'XBT' : c}USD`;
    const since = Math.floor(Date.now() / 1000) - (n + 10) * 60;
    const j = await get(`https://futures.kraken.com/api/charts/v1/analytics/${sym}/cvd?since=${since}&interval=60`);
    const d = j.result?.data || {};
    const b = (d.buyVolume || []).slice(-n), s = (d.sellVolume || []).slice(-n);
    if (!b.length && !s.length) throw new Error('Kraken kosong: ' + JSON.stringify(j).slice(0, 160));
    return { buy: sum(b, x => x), sell: sum(s, x => x) };
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=4, stale-while-revalidate=8');

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
