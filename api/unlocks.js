// api/unlocks.js
export default async function handler(req, res) {
  // Masukkan API Key CryptoRank Tuan di sini atau di Environment Variable Vercel
  const CRYPTORANK_API_KEY = process.env; 

  try {
    // Memanggil data vesting/unlocks dari CryptoRank
    const response = await fetch(`https://api.cryptorank.io/v1/token-unlocks?api_key=${CRYPTORANK_API_KEY}`);
    
    if (!response.ok) throw new Error('CryptoRank API Error');
    
    const result = await response.json();

    // Mapping data agar UI Dashboard Tuan tetap gahar dan informatif
    const formattedData = result.data.map(item => ({
      name: item.name,
      symbol: item.symbol,
      img: item.image?.x64 || '', // Logo koin
      price: item.price?.value || 0,
      unlocked_percent: item.unlockedPercent || 0,
      next_unlock_date: item.nextUnlock?.date || 'N/A',
      next_unlock_amount: item.nextUnlock?.tokens || 0,
      status: item.type || 'Vesting'
    }));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(formattedData);

  } catch (error) {
    return res.status(500).json({ error: "Gagal memuat data CryptoRank" });
  }
}
