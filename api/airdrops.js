// api/airdrops.js
// Endpoint publik untuk GET semua airdrop — dipanggil dari app.js di index.html

export default async function handler(req, res) {
  // Hanya izinkan GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPA_URL || !SUPA_KEY) {
    return res.status(500).json({ error: 'Missing env variables' });
  }

  try {
    const r = await fetch(
      `${SUPA_URL}/rest/v1/airdrops?select=*&order=created_at.desc`,
      {
        headers: {
          'apikey': SUPA_KEY,
          'Authorization': `Bearer ${SUPA_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const text = await r.text();

    if (!r.ok) {
      return res.status(r.status).json({ error: text });
    }

    const data = JSON.parse(text);
    return res.status(200).json(Array.isArray(data) ? data : []);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
