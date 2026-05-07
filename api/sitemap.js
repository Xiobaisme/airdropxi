import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const baseUrl = 'https://airdropxi.vercel.app';
  const today = new Date().toISOString().split('T')[0]; // 2025-05-07

  try {
    const { data: airdrops, error } = await supabase
      .from('airdrops')
      .select('id, updated_at'); // ambil updated_at kalau ada

    if (error) throw error;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/unlocks.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/exchanges.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/reward.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/docs.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;

    airdrops?.forEach((item) => {
      const lastmod = item.updated_at
        ? item.updated_at.split('T')[0]
        : today;

      xml += `
  <url>
    <loc>${baseUrl}/detail.html?id=${item.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
    });

    xml += `\n</urlset>`;

    res.setHeader('Content-Type', 'application/xml'); // ← lebih proper dari text/xml
    res.setHeader('Cache-Control', 's-maxage=3600'); // cache 1 jam di Vercel
    res.status(200).send(xml);

  } catch (err) {
    // Return valid XML even on error (bukan JSON)
    res.setHeader('Content-Type', 'application/xml');
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`);
  }
}
