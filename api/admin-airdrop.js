module.exports = async function handler(req, res) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'Missing env' });

  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  // GET: bisa dari tabel airdrops (untuk index) atau proyek (untuk guide)
  if (req.method === 'GET') {
    const { id, table = 'airdrops' } = req.query; // default tabel airdrops
    const tableName = table === 'proyek' ? 'proyek' : 'airdrops';
    const endpoint = id
      ? `${url}/rest/v1/${tableName}?id=eq.${id}&limit=1`
      : `${url}/rest/v1/${tableName}?select=*&order=created_at.desc`;
    try {
      const r = await fetch(endpoint, { headers });
      const data = await r.json();
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST: simpan ke kedua tabel
  if (req.method === 'POST') {
    const payload = req.body;
    const commonData = {
      name: payload.name,
      status: payload.status,
      link: payload.link,
      tags: payload.tags,
      RaisedID: payload.RaisedID,
      RaisedEN: payload.RaisedEN,
      tasksID: payload.tasksID,
      tasksEN: payload.tasksEN,
      descriptionID: payload.descriptionID,
      descriptionEN: payload.descriptionEN,
      ticker: payload.ticker,
      total_supply: payload.total_supply,
      network: payload.network,
      tge_date: payload.tge_date,
      logo_url: payload.logo_url,
      twitter: payload.twitter,
      discord: payload.discord,
      telegram: payload.telegram,
      faqID: payload.faqID,
      faqEN: payload.faqEN
    };
    try {
      // Insert ke tabel airdrops
      const r1 = await fetch(`${url}/rest/v1/airdrops`, {
        method: 'POST',
        headers,
        body: JSON.stringify(commonData)
      });
      const data1 = await r1.json();
      if (!r1.ok) return res.status(r1.status).json(data1);
      const newId = data1[0]?.id;
      if (!newId) throw new Error('Gagal dapat ID dari airdrops');

      // Insert ke tabel proyek dengan ID yang sama
      await fetch(`${url}/rest/v1/proyek`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...commonData, id: newId })
      });
      return res.status(201).json(data1);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // PATCH: update kedua tabel
  if (req.method === 'PATCH') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const payload = req.body;
    try {
      await fetch(`${url}/rest/v1/airdrops?id=eq.${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload)
      });
      await fetch(`${url}/rest/v1/proyek?id=eq.${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload)
      });
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // DELETE: hapus dari kedua tabel
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    try {
      await fetch(`${url}/rest/v1/airdrops?id=eq.${id}`, { method: 'DELETE', headers });
      await fetch(`${url}/rest/v1/proyek?id=eq.${id}`, { method: 'DELETE', headers });
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
