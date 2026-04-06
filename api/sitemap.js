import { createClient } from '@supabase/supabase-js';

// Setup Supabase (pastikan environment variables sudah di-set di dashboard Vercel)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  // Wajib: Beri tahu browser dan Google bot bahwa output ini adalah XML
  res.setHeader('Content-Type', 'text/xml');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate'); // Cache 1 hari agar tidak berat

  try {
    // Tarik data airdrop (sesuaikan 'slug' dengan nama kolom di tabelmu)
    const { data: airdrops, error } = await supabase
      .from('airdrops') // Ganti dengan nama tabelmu
      .select('slug, updated_at'); 

    if (error) throw error;

    const baseUrl = 'https://airdropxi.vercel.app';

    // Rangkai struktur XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // 1. Masukkan Halaman Utama (Homepage)
    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}/</loc>\n`;
    xml += `    <priority>1.0</priority>\n`;
    xml += `  </url>\n`;

    // 2. Looping Data Airdrop Dinamis
    if (airdrops) {
      airdrops.forEach((drop) => {
        xml += `  <url>\n`;
        // PERHATIAN: Sesuaikan format URL ini dengan cara web kamu menampilkan detail
        xml += `    <loc>${baseUrl}/detail.html?id=${drop.slug}</loc>\n`; 
        xml += `    <priority>0.8</priority>\n`;
        xml += `  </url>\n`;
      });
    }

    xml += `</urlset>`;

    // Kirim response
    res.status(200).send(xml);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
