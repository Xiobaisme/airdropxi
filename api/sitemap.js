import { createClient } from '@supabase/supabase-js';

// Inisialisasi client Supabase dengan environment variables dari Vercel
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  try {
    // Ambil semua ID dari tabel 'airdrops' di database-mu
    const { data: airdrops, error } = await supabase
      .from('airdrops')
      .select('id');

    if (error) throw error;
    
    // GANTI dengan domain asli milikmu ya!
    const baseUrl = 'https://airdropxi.vercel.app';

    // --- AWAL PEMBENTUKAN XML ---
    // 1. Header XML dan pembuka tag <urlset>
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Halaman Statis Utama -->
  <url>
    <loc>${baseUrl}/</loc>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/guide.html</loc>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/unlocks.html</loc>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/exchanges.html</loc>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/reward.html</loc>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/docs.html</loc>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/admin.html</loc>
    <priority>0.5</priority>
  </url>`;

    // 2. Jika ada data airdrop, tambahkan URL dinamis untuk setiap ID
    if (airdrops && airdrops.length > 0) {
      airdrops.forEach((item) => {
        xml += `
  <!-- Halaman Dinamis untuk Airdrop -->
  <url>
    <loc>${baseUrl}/detail.html?id=${item.id}</loc>
    <priority>0.8</priority>
  </url>`;
      });
    }

    // 3. Tutup tag </urlset>
    xml += `
</urlset>`;
    // --- AKHIR PEMBENTUKAN XML ---

    // Kirim response sebagai file XML
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(xml);
  } catch (error) {
    // Jika ada error, kirim pesan error dalam format JSON
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: error.message });
  }
}
