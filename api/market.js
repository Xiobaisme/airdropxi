// api/market.js

const TF = { '5m': 5, '15m': 15, '30m': 30, '1h': 60, '2h': 120, '4h': 240, '6h': 360, '12h': 720, '1d': 1440 };
const H = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36', Accept: 'application/json' };

const get = url =>
  fetch(url, { headers: H, signal: AbortSignal.timeout(7000) }).then(async r => {
    if (r.ok) return r.json();
    throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 80)}`);
  });
const post = (url, body) =>
  fetch(url, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(7000) }).then(async r => {
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

// ── helper Bitget & Gate ──
const ivOf  = n => (n <= 120 ? 5 : n <= 360 ? 15 : 60);            // menit per bucket
const ivStr = iv => (iv >= 60 ? '1h' : iv + 'm');
// bucket yang mulai sebelum awal jendela dihitung sebagian; bucket yang sedang berjalan dihitung penuh
const frac = (t0ms, ivMs, n) => Math.min(1, Math.max(0, (t0ms + ivMs - (Date.now() - n * 60000)) / ivMs));

// cadangan kalau endpoint statistik gagal: daftar trade terakhir (bisa partial)
const bitgetTrades = async (c, n) => {
  const j = await get(`https://api.bitget.com/api/v2/mix/market/fills?symbol=${c}USDT&productType=USDT-FUTURES&limit=100`);
  const all = j.data || [];
  const from = Date.now() - n * 60000;
  const t = all.filter(x => Number(x.ts) >= from);
  const oldest = Math.min(...all.map(x => Number(x.ts)));
  const partial = all.length >= 100 && oldest > from;
  const usdOf = side => sum(t.filter(x => String(x.side).toLowerCase() === side), x => Number(x.size) * Number(x.price));
  return { buy: usdOf('buy'), sell: usdOf('sell'), usd: true, partial, secs: Math.round((Date.now() - oldest) / 1000) };
};
const gateTrades = async (c, n) => {
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
};

// ── helper CEX/DEX baru: hitung taker buy/sell dari daftar trade terakhir (pola sama kayak Bybit) ──
// f(x) -> { t: timestamp ms, buy: true kalau taker buy, v: nilai USD }
// capped = true kalau endpoint kena batas jumlah trade (jendela mungkin belum penuh)
const tally = (list, n, capped, f) => {
  const rows = list.map(f).filter(r => r && r.t && r.v > 0);
  if (!rows.length) return { buy: 0, sell: 0, usd: true };
  const from = Date.now() - n * 60000;
  const w = rows.filter(r => r.t >= from);
  const oldest = Math.min(...rows.map(r => r.t));
  const partial = capped && oldest > from;
  return {
    buy: sum(w.filter(r => r.buy), r => r.v),
    sell: sum(w.filter(r => !r.buy), r => r.v),
    usd: true, partial, secs: Math.round((Date.now() - oldest) / 1000),
  };
};
// cache ukuran kontrak per bursa+koin (hanya disimpan kalau berhasil)
const csz = {};
const sizeOf = async (k, fn) => {
  if (csz[k]) return csz[k];
  const v = Number(await fn());
  if (!v) throw new Error('ukuran kontrak kosong');
  return (csz[k] = v);
};
const rootXbt = c => (c === 'BTC' ? 'XBT' : c);
// Coinbase: kalau hasilnya kebalik dibanding Binance, ubah jadi true (arti field side beda-beda antar API)
const COINBASE_FLIP = true;

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

  // Bitget: statistik taker buy/sell per bucket (jendela penuh); cadangan: daftar trade
  Bitget: async (c, n) => {
    const iv = ivOf(n), ivMs = iv * 60000, cnt = Math.ceil(n / iv) + 1;
    try {
      const [j, f] = await Promise.all([
        get(`https://api.bitget.com/api/v2/mix/market/taker-buy-sell?symbol=${c}USDT&period=${ivStr(iv)}`),
        get(`https://api.bitget.com/api/v2/mix/market/fills?symbol=${c}USDT&productType=USDT-FUTURES&limit=1`),
      ]);
      const px = Number(f.data?.[0]?.price);
      const b = (j.data || []).map(x => ({ t: Number(x.ts), buy: Number(x.buyVolume), sell: Number(x.sellVolume) }))
        .sort((x, y) => x.t - y.t).slice(-cnt);
      if (!px || b.length < cnt - 1) throw new Error('data kurang');
      const from = Date.now() - n * 60000;
const now = Date.now();

const complete = b.filter(x =>
  x.t >= from &&
  x.t + ivMs <= now
);

return {
  buy: sum(complete, x => x.buy * px),
  sell: sum(complete, x => x.sell * px),
  usd: true,
  partial: true,
  secs: Math.round((now - Math.min(...complete.map(x => x.t))) / 1000)
};
    } catch (_) { return bitgetTrades(c, n); }
  },

  // Gate.io: statistik taker per bucket (jendela penuh); cadangan: daftar trade
  Gate: async (c, n) => {
    const iv = ivOf(n), ivS = iv * 60, cnt = Math.ceil(n / iv) + 1;
    try {
      const startSec = Math.floor(Date.now() / 1000 / ivS) * ivS - (cnt - 1) * ivS;
      
  const [rows, m] = await Promise.all([
  get(`https://api.gateio.ws/api/v4/futures/usdt/contract_stats?contract=${c}_USDT&interval=${ivStr(iv)}&from=${startSec}&limit=${cnt}`),
  gateMult(c),
]);

      const b = (Array.isArray(rows) ? rows : []).sort((x, y) => x.time - y.time).slice(-cnt);
      if (b.length < cnt - 1) throw new Error('data kurang');
      const from = Date.now() - n * 60000;
const now = Date.now();

const complete = b.filter(x =>
  x.time * 1000 >= from &&
  (x.time + ivS) * 1000 <= now
);

const usd = (size, x) =>
  Number(size || 0) * m * Number(x.mark_price);

return {
  buy: sum(complete, x => usd(x.long_taker_size, x)),
  sell: sum(complete, x => usd(x.short_taker_size, x)),
  usd: true,
  partial: true,
  secs: complete.length
    ? Math.round((now - Math.min(...complete.map(x => x.time * 1000))) / 1000)
    : 0
};
    } catch (_) { return gateTrades(c, n); }
  },

  // Kraken Futures: analytics cvd (buy_volume / sell_volume dalam BTC) x harga terakhir = USD
  Kraken: async (c, n) => {
    const sym = `PF_${c === 'BTC' ? 'XBT' : c}USD`;
    const since = Math.floor(Date.now() / 1000) - (n + 10) * 60;
    const iv = n <= 60 ? 60 : 300; // detik per bucket
    const cnt = (n * 60) / iv;
    const [j, tk] = await Promise.all([
      get(`https://futures.kraken.com/api/charts/v1/analytics/${sym}/cvd?since=${since}&interval=${iv}`),
      get(`https://futures.kraken.com/derivatives/api/v3/tickers/${sym}`),
    ]);
    const px = Number(tk.ticker?.last);
    const d = j.result?.data;
    const keys = d && !Array.isArray(d) ? Object.keys(d) : [];
    const pick = re => { const k = keys.find(k => re.test(k)); return k && Array.isArray(d[k]) ? d[k] : []; };
    const b = pick(/buy/i).slice(-cnt), s = pick(/sell/i).slice(-cnt);
    if (!b.length && !s.length) throw new Error('Kraken data: ' + JSON.stringify(d ?? null).slice(0, 200));
    if (!px) throw new Error('Kraken harga tidak ada');
    return { buy: sum(b, x => x) * px, sell: sum(s, x => x) * px, usd: true };
  },

  // ───────────── Bursa baru (semua endpoint publik, tanpa API key) ─────────────

  // Coinbase: SPOT (BTC-USD), bukan perp. 100 trade terakhir
  Coinbase: async (c, n) => {
    const j = await get(`https://api.coinbase.com/api/v3/brokerage/market/products/${c}-USD/ticker?limit=100`);
    const t = j.trades || [];
    return tally(t, n, t.length >= 100, x => ({
      t: Date.parse(x.time),
      buy: (String(x.side).toUpperCase() === 'BUY') !== COINBASE_FLIP,
      v: Number(x.size) * Number(x.price),
    }));
  },

  // MEXC Futures: 100 trade terakhir, T: 1 = taker buy, 2 = taker sell, v = jumlah kontrak
  MEXC: async (c, n) => {
    const s = `${c}_USDT`;
    const [j, cs] = await Promise.all([
      get(`https://contract.mexc.com/api/v1/contract/deals/${s}?limit=100`),
      sizeOf('mexc:' + c, async () => (await get(`https://contract.mexc.com/api/v1/contract/detail?symbol=${s}`)).data?.contractSize),
    ]);
    const t = j.data || [];
    return tally(t, n, t.length >= 100, x => ({ t: Number(x.t), buy: Number(x.T) === 1, v: Number(x.v) * cs * Number(x.p) }));
  },

  // KuCoin Futures: 100 trade terakhir, side = sisi taker, ts dalam nanodetik, size dalam lot
  KuCoin: async (c, n) => {
    const s = `${rootXbt(c)}USDTM`;
    const [j, ml] = await Promise.all([
      get(`https://api-futures.kucoin.com/api/v1/trade/history?symbol=${s}`),
      sizeOf('kucoin:' + c, async () => (await get(`https://api-futures.kucoin.com/api/v1/contracts/${s}`)).data?.multiplier),
    ]);
    const t = j.data || [];
    return tally(t, n, t.length >= 100, x => ({
      t: Number(x.ts) / 1e6,
      buy: String(x.side).toLowerCase() === 'buy',
      v: Number(x.size) * ml * Number(x.price),
    }));
  },

  // HTX linear swap: sampai 2000 entri, direction = sisi taker, trade_turnover = nilai USDT
  HTX: async (c, n) => {
    const j = await get(`https://api.hbdm.com/linear-swap-ex/market/history/trade?contract_code=${c}-USDT&size=2000`);
    const raw = j.data || [];
    const t = raw.flatMap(d => d.data || []);
    return tally(t, n, raw.length >= 2000, x => ({
      t: Number(x.ts),
      buy: x.direction === 'buy',
      v: Number(x.trade_turnover) || Number(x.price) * Number(x.quantity),
    }));
  },

  // BingX swap: sampai 1000 trade, buyerMaker=true berarti taker sell
  BingX: async (c, n) => {
    const j = await get(`https://open-api.bingx.com/openApi/swap/v2/quote/trades?symbol=${c}-USDT&limit=1000`);
    const t = j.data || [];
    return tally(t, n, t.length >= 1000, x => {
      const bm = x.isBuyerMaker ?? x.buyerMaker ?? x.m;
      return {
        t: Number(x.time),
        buy: !(bm === true || String(bm) === 'true'),
        v: Number(x.quoteQty) || Number(x.price) * Number(x.qty),
      };
    });
  },

  // Hyperliquid (perp DEX): POST /info recentTrades, side B = taker buy, A = taker sell, sz dalam koin
  Hyperliquid: async (c, n) => {
    const j = await post('https://api.hyperliquid.xyz/info', { type: 'recentTrades', coin: c });
    const t = Array.isArray(j) ? j : [];
    return tally(t, n, true, x => ({ t: Number(x.time), buy: x.side === 'B', v: Number(x.sz) * Number(x.px) }));
  },

  // dYdX v4 (perp DEX): indexer publik, 100 trade terakhir, side = sisi taker, size dalam koin
  dYdX: async (c, n) => {
    const j = await get(`https://indexer.dydx.trade/v4/trades/perpetualMarket/${c}-USD?limit=100`);
    const t = j.trades || [];
    return tally(t, n, t.length >= 100, x => ({
      t: Date.parse(x.createdAt),
      buy: String(x.side).toUpperCase() === 'BUY',
      v: Number(x.size) * Number(x.price),
    }));
  },

  // Deribit: BTC/ETH = inverse perp (amount sudah USD), koin lain = USDC linear (amount dalam koin)
  Deribit: async (c, n) => {
    const lin = c !== 'BTC' && c !== 'ETH';
    const inst = lin ? `${c}_USDC-PERPETUAL` : `${c}-PERPETUAL`;
    const now = Date.now(), from = now - n * 60000;
    const j = await get(`https://www.deribit.com/api/v2/public/get_last_trades_by_instrument_and_time?instrument_name=${inst}&start_timestamp=${from}&end_timestamp=${now}&count=1000&sorting=desc`);
    const t = j.result?.trades || [];
    return tally(t, n, !!j.result?.has_more, x => ({
      t: Number(x.timestamp),
      buy: x.direction === 'buy',
      v: lin ? Number(x.amount) * Number(x.price) : Number(x.amount),
    }));
  },

  // Crypto.com Exchange: perp BTCUSD-PERP, s = BUY/SELL, q dalam koin, maks 150 trade
  'Crypto.com': async (c, n) => {
    const j = await get(`https://api.crypto.com/exchange/v1/public/get-trades?instrument_name=${c}USD-PERP&count=150`);
    const t = j.result?.data || [];
    return tally(t, n, t.length >= 150, x => ({
      t: Number(x.t),
      buy: String(x.s).toUpperCase() === 'BUY',
      v: Number(x.q) * Number(x.p),
    }));
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

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

const ok = rows.filter(r => !r.error && r.usd);
const totalBuy = sum(ok, r => r.buy);
const totalSell = sum(ok, r => r.sell);
const total = totalBuy + totalSell;

const all = total > 0
  ? {
      name: 'All',
      buy: totalBuy,
      sell: totalSell,
      pct: (totalBuy / total) * 100,
      usd: true,
      avg: true
    }
  : { name: 'All', error: 'Semua bursa gagal' };

  res.status(200).json({ coin, tf, minutes: n, rows: [all, ...rows], updated_at: new Date().toISOString() });
}