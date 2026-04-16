export default async function handler(req, res) {
  try {
    // Mengambil top 20 koin dari CoinGecko (Gratis & Tanpa API Key untuk demo)
    // Jika Tuan punya API Key CoinGecko, tambahkan ke header
    const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false');
    const data = await response.json();

    const formattedData = data.map(coin => {
      // Logika kalkulasi unlock: (Circulating / Total) * 100
      const total = coin.total_supply || coin.max_supply || coin.circulating_supply;
      const unlockedPercent = ((coin.circulating_supply / total) * 100).toFixed(1);

      return {
        name: coin.name,
        symbol: coin.symbol.toUpperCase(),
        img: coin.image,
        price: coin.current_price,
        change_24h: coin.price_change_percentage_24h?.toFixed(2) || 0,
        market_cap: coin.market_cap.toLocaleString(),
        unlocked_percent: unlockedPercent,
        // Karena API gratis jarang kasih tanggal unlock, kita buat placeholder premium
        next_unlock_date: "Scheduled", 
        next_unlock_amount: "Check App"
      };
    });

    return res.status(200).json(formattedData);
  } catch (error) {
    return res.status(500).json({ error: "Koneksi CoinGecko Gagal" });
  }
}
