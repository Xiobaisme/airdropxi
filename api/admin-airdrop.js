export default async function handler(req, res) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: 'Missing env variables' });
  }

  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  // ── GET: ambil semua atau satu by id ──────────────────────────────────────
  if (req.method === 'GET') {
    const { id } = req.query;
    const endpoint = id
      ? `${url}/rest/v1/airdrops?id=eq.${id}&limit=1`
      : `${url}/rest/v1/airdrops?select=*&order=created_at.desc`;
    try {
      const r = await fetch(endpoint, { headers });
      const data = await r.json();
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── POST: insert airdrop baru ─────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const r = await fetch(`${url}/rest/v1/airdrops`, {
        method: 'POST',
        headers,
        body: JSON.stringify(req.body)
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json(data);
      return res.status(201).json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── PATCH: update airdrop by id ───────────────────────────────────────────
  if (req.method === 'PATCH') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    try {
      const r = await fetch(`${url}/rest/v1/airdrops?id=eq.${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(req.body)
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json(data);
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── DELETE: hapus airdrop by id ───────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    try {
      const r = await fetch(`${url}/rest/v1/airdrops?id=eq.${id}`, {
        method: 'DELETE',
        headers
      });
      if (!r.ok) {
        const data = await r.json();
        return res.status(r.status).json(data);
      }
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
