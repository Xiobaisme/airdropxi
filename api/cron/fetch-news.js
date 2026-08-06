// api/cron/fetch-news.js
// Endpoint ini yang beneran narik data LIVE dari internet. Dia gak dipanggil
// browser — dipanggil terjadwal (lihat .github/workflows/fetch-news.yml)
// tiap beberapa menit, upsert hasilnya ke tabel `news_terminal`.
//
// Sumber:
//  - Cointelegraph, CoinDesk, ForexFactory -> RSS resmi masing-masing, gratis.
//  - CoinMarketCap -> endpoint resmi /v1/content/latest, butuh API key gratis
//    (daftar di coinmarketcap.com/api, tier Basic). Kalau CMC_API_KEY kosong,
//    sumber ini di-skip aja (gak bikin gagal semua).
//  - Lookonchain -> di-scrape dari lookonchain.com/feeds (situs resmi dia,
//    bukan Twitter). CATATAN: ini bergantung struktur HTML mereka saat ini —
//    kalau situsnya redesign, bagian fetchLookonchain() yg pertama perlu dicek.
//
// Setup: npm install rss-parser cheerio @supabase/supabase-js

const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');
const cheerio = require('cheerio');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const rssParser = new Parser({ timeout: 10000 });

const RSS_SOURCES = [
  { source: 'cointelegraph', url: 'https://cointelegraph.com/rss', category: 'crypto' },
  { source: 'coindesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', category: 'crypto' },
  { source: 'forexfactory', url: 'https://www.forexfactory.com/rss.php', category: 'forex' },
];

function stripHtml(html = '') {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

async function fetchRSSSource({ source, url, category }) {
  try {
    const feed = await rssParser.parseURL(url);
    return (feed.items || []).slice(0, 20).map((item) => ({
      source,
      title: (item.title || '').trim(),
      url: item.link,
      excerpt: item.contentSnippet ? stripHtml(item.contentSnippet).slice(0, 220) : null,
      published_at: item.isoDate || (item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()),
      category,
      is_breaking: false,
    })).filter((i) => i.title && i.url);
  } catch (err) {
    console.error(`[fetch-news] ${source} RSS gagal:`, err.message);
    return [];
  }
}

async function fetchLookonchain() {
  try {
    const res = await fetch('https://www.lookonchain.com/feeds', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AirdropXI-NewsTerminal/1.0)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    const items = [];
    $('a[href^="/feeds/"]').each((_, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr('href');
      const match = text.match(/^(.*?)\s+(\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2})$/);
      const title = match ? match[1].trim() : text;
      const dateStr = match ? match[2] : null;
      if (!title || !href) return;
      items.push({
        source: 'lookonchain',
        title,
        url: `https://www.lookonchain.com${href}`,
        excerpt: null,
        published_at: dateStr
          ? new Date(dateStr.replace(/\./g, '-').replace(' ', 'T') + 'Z').toISOString()
          : new Date().toISOString(),
        category: 'onchain',
        is_breaking: false,
      });
    });
    return items.slice(0, 20);
  } catch (err) {
    console.error('[fetch-news] lookonchain gagal:', err.message);
    return [];
  }
}

async function fetchCoinMarketCap() {
  const apiKey = process.env.CMC_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch(
      'https://pro-api.coinmarketcap.com/v1/content/latest?news_type=news&content_type=news&limit=20',
      { headers: { 'X-CMC_PRO_API_KEY': apiKey } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return (json.data || []).map((item) => ({
      source: 'coinmarketcap',
      title: item.title,
      url: item.sourceUrl || item.url,
      excerpt: item.subtitle || null,
      published_at: item.releasedAt || new Date().toISOString(),
      category: 'crypto',
      is_breaking: false,
    })).filter((i) => i.title && i.url);
  } catch (err) {
    console.error('[fetch-news] CMC gagal:', err.message);
    return [];
  }
}

module.exports = async (req, res) => {
  // Lindungi endpoint ini — cuma yang punya CRON_SECRET yang boleh manggil,
  // biar orang lain gak bisa spam trigger fetch dari luar.
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results = await Promise.all([
    ...RSS_SOURCES.map(fetchRSSSource),
    fetchLookonchain(),
    fetchCoinMarketCap(),
  ]);

  const allItems = results.flat();

  if (!allItems.length) {
    return res.status(500).json({ ok: false, message: 'Semua sumber gagal difetch' });
  }

  const { error: upsertError } = await supabase
    .from('news_terminal')
    .upsert(allItems, { onConflict: 'url', ignoreDuplicates: true });

  if (upsertError) {
    console.error('[fetch-news] upsert gagal:', upsertError);
    return res.status(500).json({ ok: false, error: upsertError.message });
  }

  // Beresin data lama biar tabel gak numpuk terus.
  await supabase
    .from('news_terminal')
    .delete()
    .lt('published_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  return res.status(200).json({ ok: true, fetched: allItems.length });
};
