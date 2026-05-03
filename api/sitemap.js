import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  try {
    const { data: airdrops, error } = await supabase
      .from('airdrops')
      .select('id');

    if (error) throw error;

    const baseUrl = 'https://airdropxi.vercel.app';

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}/</loc><priority>1.0</priority></url>
  <url><loc>${baseUrl}/unlocks.html</loc><priority>0.8</priority></url>
  <url><loc>${baseUrl}/exchanges.html</loc><priority>0.8</priority></url>
  <url><loc>${baseUrl}/reward.html</loc><priority>0.8</priority></url>
  <url><loc>${baseUrl}/docs.html</loc><priority>0.8</priority></url>`;

    if (airdrops && airdrops.length > 0) {
      airdrops.forEach((item) => {
        xml += `\n  <url><loc>${baseUrl}/detail.html?id=${item.id}</loc><priority>0.8</priority></url>`;
      });
    }

    xml += `\n</urlset>`;
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(xml);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
