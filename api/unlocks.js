export default async function handler(req, res) {
  try {
    // Menarik 100 koin agar daftar Altcoin Tuan melimpah
    const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false', {
      headers: { 'Cache-Control': 'no-cache' } // Memaksa data terbaru setiap request
    });
    
    const data = await response.json();

    const formattedData = data.map(coin => {
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
        next_unlock_date: "TBA",
        next_unlock_amount: "Syncing..."
      };
    });

    // Header untuk mencegah caching di sisi Vercel
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json(formattedData);
  } catch (error) {
    return res.status(500).json({ error: "Gagal memuat data Altcoin" });
  }
}
