export default async function handler(req, res) {
  try {
    // Menarik 250 koin teratas (mencakup hampir semua Altcoin potensial)
    const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false');
    
    if (!response.ok) throw new Error('Koneksi CoinGecko Gagal');
    
    const data = await response.json();

    // Mapping data agar UI Tuan Regi terlihat profesional
    const altcoinData = data.map(coin => ({
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      img: coin.image,
      price: coin.current_price > 1 ? coin.current_price.toLocaleString() : coin.current_price.toFixed(6),
      market_cap: coin.market_cap.toLocaleString(),
      // Menghitung estimasi persentase sirkulasi (Vesting Progress)
      unlocked_percent: coin.total_supply ? ((coin.circulating_supply / coin.total_supply) * 100).toFixed(1) : "100",
      change_24h: coin.price_change_percentage_24h ? coin.price_change_percentage_24h.toFixed(2) : "0"
    }));

    // Cache di Vercel selama 30 detik agar tetap "Real-time" tapi tidak kena rate limit
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    return res.status(200).json(altcoinData);

  } catch (error) {
    return res.status(500).json({ error: "Gagal memuat Altcoins", detail: error.message });
  }
}
