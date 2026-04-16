export default async function handler(req, res) {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false');
    const data = await response.json();

    const formattedData = data.map(coin => ({
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      amount: (coin.circulating_supply / 1000000).toFixed(2) + "M",
      percent: Math.round((coin.circulating_supply / (coin.total_supply || coin.circulating_supply)) * 100),
      next_unlock: "Real-time",
      status: coin.price_change_percentage_24h > 0 ? "Bullish" : "Bearish",
      img: coin.image
    }));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(formattedData);
  } catch (error) {
    return res.status(500).json({ error: "Gagal ambil data" });
  }
}
