export default async function handler(req, res) {
  const apiKey = process.env.CRYPTORANK_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "API Key v2 belum terpasang di Vercel!" });
  }

  try {
    // Menggunakan endpoint v2 sesuai permintaan Tuan
    const response = await fetch(`https://api.cryptorank.io/v2/token-unlocks?api_key=${apiKey}&limit=50`);
    
    if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json({ 
            error: `CryptoRank v2 Error: ${response.status}`, 
            message: errorData.message || "Akses Ditolak" 
        });
    }
    
    const result = await response.json();

    // Struktur v2 biasanya membungkus data di dalam objek 'data'
    const rawData = result.data || [];

    const formattedData = rawData.map(item => ({
      name: item.name || 'Unknown',
      symbol: item.symbol || '',
      img: item.images?.x60 || 'https://cryptorank.io/static/logo.png', 
      price: item.price?.value || 0,
      change_24h: item.price?.change24h?.toFixed(2) || "0.00",
      unlocked_percent: item.tokensUnlockedPercent || 0, // Field v2 mungkin berbeda nama
      next_unlock_date: item.nextUnlock?.date || 'N/A',
      next_unlock_amount: item.nextUnlock?.tokens?.toLocaleString() || '0',
      market_cap: item.marketCap?.toLocaleString() || '0'
    }));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(formattedData);

  } catch (error) {
    return res.status(500).json({ error: "Gagal memproses API v2", detail: error.message });
  }
}
