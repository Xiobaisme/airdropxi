// api/market.js
export default async function handler(req, res) {
  // Set CORS biar bisa diakses dari frontend lu
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  try {
    // Fetch data dari ketiga exchange secara paralel
    const [binance, bybit, okx] = await Promise.all([
      fetch('https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1').then(r => r.json()),
      fetch('https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=BTCUSDT&period=5min&limit=1').then(r => r.json()),
      fetch('https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=BTC&period=5m').then(r => r.json())
    ]);

    // Gabungin datanya jadi satu format yang rapi
    const result = {
      binance: {
        long: binance[0]?.longAccount || '0',
        short: binance[0]?.shortAccount || '0',
        ratio: binance[0]?.longShortRatio || '0'
      },
      bybit: {
        long: bybit.result?.list[0]?.buyRatio || '0',
        short: bybit.result?.list[0]?.sellRatio || '0'
      },
      okx: {
        ratio: okx.data?.[0]?.[1] || '0'
      },
      updated_at: new Date().toISOString()
    };

    // Kirim response JSON ke frontend
    res.status(200).json(result);

  } catch (error) {
    console.error('Error fetching market data:', error);
    res.status(500).json({ error: 'Gagal mengambil data dari exchange' });
  }
}
