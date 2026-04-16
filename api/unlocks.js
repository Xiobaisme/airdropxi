// api/unlocks.js
export default async function handler(req, res) {
  try {
    // Kita ambil data dari DefiLlama (Gratis & Real-time)
    const response = await fetch('https://api.llama.fi/unlocks/ethereum'); 
    const data = await response.json();

    // Beritahu Vercel untuk simpan data di cache selama 1 menit (efisiensi)
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: "Gagal memuat data token" });
  }
}
