// api/airdrops.js
// PUBLIC endpoint — hanya return proyek yang published=true
// Dipakai oleh index.html. Admin TIDAK pakai ini.

module.exports = async function handler(req, res) {
  // Hanya GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} tidak diizinkan` });
  }

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPA_URL || !SUPA_KEY) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  const BASE = `${SUPA_URL}/rest/v1`;
  const H = {
    'apikey': SUPA_KEY,
    'Authorization': `Bearer ${SUPA_KEY}`,
    'Content-Type': 'application/json',
  };

  const { id } = req.query;

  try {
    let endpoint;
    if (id) {
      // Detail single proyek — tetap filter published=true agar ga bisa diakses langsung via URL
      endpoint = `${BASE}/airdrops?id=eq.${encodeURIComponent(id)}&published=eq.true&limit=1`;
    } else {
      // List semua — hanya yang published
      endpoint = `${BASE}/airdrops?select=*&published=eq.true&order=created_at.desc`;
    }

    const r = await fetch(endpoint, { headers: H });
    const data = await r.json();

    if (!r.ok) {
      const msg = data?.message || JSON.stringify(data);
      return res.status(r.status).json({ error: msg });
    }

    if (id) {
      if (!data || data.length === 0)
        return res.status(404).json({ error: 'Project tidak ditemukan atau belum dipublish' });
      return res.status(200).json(data[0]);
    }

    // Cache 60 detik di CDN Vercel
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(Array.isArray(data) ? data : []);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
