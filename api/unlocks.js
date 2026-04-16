export default async function handler(req, res) {
  const apiKey = process.env.CRYPTORANK_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "404." });
  }

  try {
    // Kita kirim lewat URL dan Header sekaligus agar pasti tembus
    const apiUrl = `https://api.cryptorank.io/v2/token-unlocks?api_key=${apiKey}`;
    
    const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
            'x-api-key': apiKey, // Beberapa endpoint v2 mewajibkan ini
            'Accept': 'application/json'
        }
    });

    const result = await response.json();

    if (!response.ok) {
        return res.status(response.status).json({ 
            error: "CryptoRank Menolak Akses", 
            message: result.message || "Periksa apakah paket API v2 Tuan mendukung endpoint ini." 
        });
    }

    // Mapping data sesuai struktur dashboard premium image_bd9e9e.png
    const formattedData = (result.data || []).map(item => ({
      name: item.name || 'Unknown',
      symbol: item.symbol || '',
      img: item.images?.x60 || '',
      price: item.price?.value || 0,
      change_24h: item.price?.change24h || 0,
      unlocked_percent: item.tokensUnlockedPercent || 0,
      next_unlock_date: item.nextUnlock?.date || 'N/A',
      next_unlock_amount: item.nextUnlock?.tokens || 0,
      market_cap: item.marketCap || 0
    }));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(formattedData);

  } catch (error) {
    return res.status(500).json({ error: "Server Error", detail: error.message });
  }
}
