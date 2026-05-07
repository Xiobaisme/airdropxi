import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SITEMAP_KEY
);

export default async function handler(req, res) {
  const baseUrl = 'https://airdropxi.vercel.app';
  const today = new Date().toISOString().split('T')[0];

  try {
    const { data: airdrops, error } = await supabase
      .from('airdrops')
      .select('id');

    if (error) throw error;

    // DEBUG SEMENTARA
    if (!airdrops || airdrops.length === 0) {
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json({ 
        message: 'query sukses tapi data kosong',
        count: airdrops?.length,
        airdrops: airdrops
      });
      return;
    }

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

    airdrops.forEach((item) => {
      xml += `
  <url>
    <loc>${baseUrl}/detail.html?id=${item.id}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
    });

    xml += `\n</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 's-maxage=3600');
    res.status(200).send(xml);

  } catch (err) {
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ 
      error: err.message,
      supabase_url: process.env.SUPABASE_URL ? 'ADA' : 'TIDAK ADA',
      supabase_key: process.env.SUPABASE_SITEMAP_KEY ? 'ADA' : 'TIDAK ADA'
    });
  }
}
