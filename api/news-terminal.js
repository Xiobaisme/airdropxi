// api/news-terminal.js
const { createClient } = require('@supabase/supabase-js');

// SEMENTARA: putus akses ke Supabase sampai DB sehat
const MAINTENANCE = true;

module.exports = async (req, res) => {
  if (MAINTENANCE) {
    return res.status(503).json({ error: 'Maintenance: database sedang dipulihkan' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Client dibuat di dalam handler, setelah cek flag, jadi nggak ada koneksi
  // ke Supabase selama MAINTENANCE = true.
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { data, error } = await supabase
      .from('news_terminal')
      .select('source, title, url, excerpt, published_at, category, is_breaking')
      .order('published_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Cache 60 detik di edge, isinya di-refresh oleh cron.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json(data || []);
  } catch (err) {
    console.error('[news-terminal] fetch failed:', err);
    return res.status(500).json({ error: 'Terjadi kesalahan internal' });
  }
};
