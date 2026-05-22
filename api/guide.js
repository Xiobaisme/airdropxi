// api/guide.js
// Public endpoint — fetch detail project dari tabel proyek by airdrop_id
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPA_URL || !SUPA_KEY) {
    return res.status(500).json({ error: 'Missing env vars' });
  }
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Query param "id" wajib ada' });
  const BASE = `${SUPA_URL}/rest/v1`;
  const H = {
    'apikey': SUPA_KEY,
    'Authorization': `Bearer ${SUPA_KEY}`,
    'Content-Type': 'application/json',
  };
  try {
    const r = await fetch(
      `${BASE}/proyek?airdrop_id=eq.${encodeURIComponent(id)}&limit=1`,
      { headers: H }
    );
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data });
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Project tidak ditemukan' });
    }

    // Fetch view_count dari airdrops
    const airdropRes = await fetch(
      `${SUPA_URL}/rest/v1/airdrops?id=eq.${encodeURIComponent(id)}&select=view_count&limit=1`,
      { headers: H }
    );
    const airdropData = await airdropRes.json();
    const currentCount = airdropData?.[0]?.view_count || 0;

    // Increment view_count
    await fetch(
      `${SUPA_URL}/rest/v1/airdrops?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: { ...H, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ view_count: currentCount + 1 })
      }
    );

    return res.status(200).json(data[0]);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
