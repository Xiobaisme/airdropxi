export default async function handler(req, res) {
  try {
    // Kita ambil data market real-time yang stabil
    const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false');
    
    if (!response.ok) throw new Error('API Gege Gagal');
    
    const data = await response.json();

    // Mapping data agar sesuai dengan kebutuhan Dashboard Unlocks Tuan
    const realTimeData = data.map(coin => ({
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      price: coin.current_price,
      image: coin.image,
      market_cap: coin.market_cap,
      circulating_supply: coin.circulating_supply,
      total_supply: coin.total_supply,
      // Simulasi persentase unlock berdasarkan supply yang ada (Real Data)
      unlocked_percent: ((coin.circulating_supply / (coin.total_supply || coin.circulating_supply)) * 100).toFixed(1)
    }));

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    return res.status(200).json(realTimeData);

  } catch (error) {
    return res.status(500).json({ error: "Koneksi API Terputus", detail: error.message });
  }
}
