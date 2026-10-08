// api/heatmap.js  ->  /api/heatmap
// Gabungan Binance + Bybit + OKX + Bitget + Gate (futures USDT). Volume, perubahan 24 jam, OI, funding.
// Tambahan: ?type=fng -> Fear & Greed Index dari CoinMarketCap (butuh env CMC_API_KEY)
const H = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36', Accept: 'application/json' };
const get = url =>
  fetch(url, { headers: H, signal: AbortSignal.timeout(7000) }).then(async r => {
    if (r.ok) return r.json();
    throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 80)}`);
  });
const num = v => Number(v) || 0;
const coin = s => String(s).replace(/[-_]?USDT$/, '').replace(/^1(0{3,})(?=[A-Z])/, '');

// cadangan kalau exchangeInfo Binance gagal dimuat; tambah sendiri kalau ada kontrak TradFi lain
const EXTRA_TRADFI = new Set(['XAU', 'XAG', 'XPT', 'XPD', 'CL', 'BZ', 'NG', 'HG']);

// ── Binance: tandai kontrak non-crypto (emas, minyak, saham) lewat exchangeInfo, cache 1 jam ──
let info = { t: 0, set: new Set() };
async function binanceTradfi() {
  if (Date.now() - info.t < 3600e3) return info.set;
  const j = await get('https://fapi.binance.com/fapi/v1/exchangeInfo');
  info = {
    t: Date.now(),
    set: new Set(j.symbols.filter(s => s.underlyingType && !['COIN', 'PREMARKET'].includes(s.underlyingType)).map(s => s.symbol)),
  };
  return info.set;
}

// ── Binance: tidak ada endpoint OI untuk semua simbol, jadi 40 teratas saja, cache 60 detik ──
let oiCache = { t: 0, v: {} };
async function binanceOI(top) {
  if (Date.now() - oiCache.t < 60e3) return oiCache.v;
  const r = await Promise.allSettled(top.map(x => get(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${x.symbol}`)));
  const v = {};
  r.forEach((x, i) => { if (x.status === 'fulfilled') v[top[i].symbol] = num(x.value.openInterest) * num(top[i].lastPrice); });
  oiCache = { t: Date.now(), v };
  return v;
}

const EX = {
  Binance: async () => {
    const [t, pi, tradfi] = await Promise.all([
      get('https://fapi.binance.com/fapi/v1/ticker/24hr'),
      get('https://fapi.binance.com/fapi/v1/premiumIndex').catch(() => []),
      binanceTradfi().catch(() => new Set()),
    ]);
    const rows = t.filter(x => /^[A-Z0-9]+USDT$/.test(x.symbol) && num(x.quoteVolume) > 0);
    const fund = Object.fromEntries(pi.map(x => [x.symbol, num(x.lastFundingRate) * 100]));
    const top = [...rows].sort((a, b) => b.quoteVolume - a.quoteVolume).slice(0, 40);
    const oi = await binanceOI(top).catch(() => ({}));
    return rows.map(x => {
      const c = coin(x.symbol);
      return { ex: 'Binance', c, vol: num(x.quoteVolume), chg: num(x.priceChangePercent), oi: oi[x.symbol] || 0,
               fund: fund[x.symbol], tradfi: tradfi.has(x.symbol) || EXTRA_TRADFI.has(c) };
    });
  },

  Bybit: async () => {
    const j = await get('https://api.bybit.com/v5/market/tickers?category=linear');
    return (j.result?.list || []).filter(x => /USDT$/.test(x.symbol) && num(x.turnover24h) > 0).map(x => ({
      ex: 'Bybit', c: coin(x.symbol), vol: num(x.turnover24h), chg: num(x.price24hPcnt) * 100,
      oi: num(x.openInterestValue), fund: num(x.fundingRate) * 100,
    }));
  },

  OKX: async () => {
    const [t, o] = await Promise.all([
      get('https://www.okx.com/api/v5/market/tickers?instType=SWAP'),
      get('https://www.okx.com/api/v5/public/open-interest?instType=SWAP').catch(() => ({ data: [] })),
    ]);
    const oi = Object.fromEntries((o.data || []).map(x => [x.instId, num(x.oiUsd)]));
    return (t.data || []).filter(x => x.instId.endsWith('-USDT-SWAP')).map(x => {
      const last = num(x.last), open = num(x.open24h);
      return { ex: 'OKX', c: coin(x.instId.split('-')[0]), vol: num(x.volCcy24h) * last,   // volCcy24h = jumlah koin dasar
               chg: open ? (last / open - 1) * 100 : 0, oi: oi[x.instId] || 0 };
    }).filter(r => r.vol > 0);
  },

  Bitget: async () => {
    const j = await get('https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES');
    return (j.data || []).map(x => ({
      ex: 'Bitget', c: coin(x.symbol), vol: num(x.usdtVolume) || num(x.quoteVolume), chg: num(x.change24h) * 100,
      oi: num(x.holdingAmount) * num(x.lastPr), fund: num(x.fundingRate) * 100,
    })).filter(r => r.vol > 0);
  },

  Gate: async () => {
    const j = await get('https://api.gateio.ws/api/v4/futures/usdt/tickers');   // OI Gate dilewati (butuh multiplier per kontrak)
    return j.map(x => ({
      ex: 'Gate', c: coin(x.contract), vol: num(x.volume_24h_quote), chg: num(x.change_percentage), fund: num(x.funding_rate) * 100,
    })).filter(r => r.vol > 0);
  },
};

// ═══════════════════════════════════════════════════════════════
// ─── FEAR & GREED (CoinMarketCap) ───
// Dipanggil lewat /api/heatmap?type=fng
// Butuh environment variable CMC_API_KEY di Vercel (Settings > Environment Variables)
// ═══════════════════════════════════════════════════════════════
async function fearGreed() {
  const key = process.env.CMC_API_KEY;
  if (!key) throw new Error('CMC_API_KEY belum di-set di environment Vercel');

  const r = await fetch('https://pro-api.coinmarketcap.com/v3/fear-and-greed/latest', {
    headers: {
      'X-CMC_PRO_API_KEY': key,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(7000),
  });

  if (!r.ok) {
    const body = (await r.text()).slice(0, 150);
    throw new Error(`CMC HTTP ${r.status}: ${body}`);
  }
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // ─── Route: Fear & Greed ───
  if (req.query.type === 'fng') {
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800'); // cache 15 menit
    try {
      const data = await fearGreed();
      return res.status(200).json(data);
    } catch (e) {
      return res.status(502).json({ error: String(e.message || e) });
    }
  }

  // ─── Route: Heatmap (default, seperti sebelumnya) ───
  res.setHeader('Cache-Control', 's-maxage=4, stale-while-revalidate=10');

  const names = Object.keys(EX);
  const out = await Promise.allSettled(names.map(k => EX[k]()));

  const by = {}, ok = [], failed = {};
  out.forEach((o, i) => {
    if (o.status !== 'fulfilled') { failed[names[i]] = String(o.reason?.message || o.reason).slice(0, 80); return; }
    ok.push(names[i]);
    o.value.forEach(r => {
      const a = by[r.c] || (by[r.c] = { c: r.c, vol: 0, oi: 0, chgW: 0, fundW: 0, fundV: 0, tradfi: false, ex: {} });
      a.vol += r.vol;
      a.oi += r.oi || 0;
      a.chgW += r.chg * r.vol;
      if (r.fund != null && isFinite(r.fund)) { a.fundW += r.fund * r.vol; a.fundV += r.vol; }
      if (r.tradfi) a.tradfi = true;
      a.ex[r.ex] = Math.round(r.vol);
    });
  });

  if (!ok.length) return res.status(502).json({ error: 'Semua bursa gagal', failed });

  const coins = Object.values(by)
    .sort((a, b) => b.vol - a.vol)
    .slice(0, 100)
    .map(a => ({
      c: a.c, vol: a.vol, oi: a.oi, chg: a.chgW / a.vol,           // chg = rata-rata berbobot volume antar bursa
      fund: a.fundV ? a.fundW / a.fundV : null, tradfi: a.tradfi, ex: a.ex,
    }));

  res.status(200).json({ updated_at: new Date().toISOString(), exchanges: ok, failed, coins });
}
