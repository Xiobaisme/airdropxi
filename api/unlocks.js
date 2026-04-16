export default async function handler(req, res) {
  // Membaca key dari Environment Variables secara aman
  const apiKey = process.env.CRYPTORANK_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "API Key tidak ditemukan di Environment Variables Vercel." });
  }

  try {
    // Menembak endpoint CryptoRank dengan key rahasia
    const response = await fetch(`https://api.cryptorank.io/v1/token-unlocks?api_key=${apiKey}`);
    
    if (!response.ok) throw new Error('CryptoRank API Error atau Limit Tercapai');
    
    const result = await response.json();

    // Mapping data agar sesuai dengan struktur dashboard premium
    const formattedData = result.data.map(item => ({
      name: item.name,
      symbol: item.symbol,
      img: item.image?.x64 || '', 
      price: item.price?.value || 0,
      unlocked_percent: item.unlockedPercent || 0,
      next_unlock_date: item.nextUnlock?.date || 'N/A',
      next_unlock_amount: item.nextUnlock?.tokens || 0,
      market_cap: item.marketCap?.toLocaleString() || '0',
      status: item.type || 'Vesting'
    }));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(formattedData);

  } catch (error) {
    return res.status(500).json({ error: "Gagal memuat data dari CryptoRank", details: error.message });
  }
}
