// api/news-terminal.js

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data, error } = await supabase
      .from('news_terminal')
      .select('source, title, url, excerpt, published_at, category, is_breaking')
      .order('published_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Cache 60 detik di edge — cukup buat "terasa" real-time tanpa nge-hit
    // Supabase tiap request, sementara isinya sendiri di-refresh oleh cron.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json(data || []);
  } catch (err) {
    console.error('[news-terminal] fetch failed:', err);
    return res.status(500).json({ error: err.message });
  }
};
