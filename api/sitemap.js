import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  try {
    const { data: airdrops, error } = await supabase
      .from('airdrops') 
      .select('id'); // <--- Di sini saya ganti dari 'slug' menjadi 'id'

    if (error) throw error;

    const baseUrl = 'https://airdropxi.vercel.app';

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <priority>1.0</priority>
  </url>`;

    if (airdrops) {
      airdrops.forEach((drop) => {
        xml += `
  <url>
    <loc>${baseUrl}/detail.html?id=${drop.id}</loc> 
    <priority>0.8</priority>
  </url>`;
      });
    }

    xml += `\n</urlset>`;

    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(xml);
  } catch (error) {
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: error.message });
  }
}
