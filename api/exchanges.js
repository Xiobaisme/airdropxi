// api/exchanges.js
export default async function handler(req, res) {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/exchanges?per_page=10&page=1');
    const data = await response.json();
    
    // Berikan response ke frontend
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data market' });
  }
}
