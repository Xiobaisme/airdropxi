// api/market.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.google.com/'
  };

  const [binanceRes, bybitRes, okxRes, gateRes] = await Promise.allSettled([
    fetch('https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1', { headers }).then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)),
    fetch('https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=BTCUSDT&period=5min&limit=1', { headers }).then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)),
    fetch('https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=BTC&period=5m', { headers }).then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)),
    fetch('https://api.gateio.ws/api/v4/futures/usdt/contract_stats?contract=BTC_USDT', { headers }).then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
  ]);

  const result = {
    binance: binanceRes.status === 'fulfilled'
      ? { long: Number(binanceRes.value?.[0]?.longAccount || 0), short: Number(binanceRes.value?.[0]?.shortAccount || 0), ratio: Number(binanceRes.value?.[0]?.longShortRatio || 0) }
      : { error: binanceRes.reason?.toString() || 'Gagal' },
    bybit: bybitRes.status === 'fulfilled'
      ? { long: Number(bybitRes.value?.result?.list?.[0]?.buyRatio || 0), short: Number(bybitRes.value?.result?.list?.[0]?.sellRatio || 0) }
      : { error: bybitRes.reason?.toString() || 'Gagal' },
    okx: okxRes.status === 'fulfilled'
      ? { ratio: Number(okxRes.value?.data?.[0]?.[1] || 0) }
      : { error: okxRes.reason?.toString() || 'Gagal' },
    gate: gateRes.status === 'fulfilled' && Array.isArray(gateRes.value) && gateRes.value.length > 0
      ? { 
          lsr_taker: Number(gateRes.value[0]?.lsr_taker || 0), 
          lsr_account: Number(gateRes.value[0]?.lsr_account || 0) 
        }
      : { error: gateRes.reason?.toString() || 'Gagal' },
    updated_at: new Date().toISOString()
  };

  res.status(200).json(result);
}
