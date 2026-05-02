// api/admin-airdrop.js
// CRUD handler untuk tabel airdrops — khusus ADMIN
// FIX: error handling object, published flag, error serialization

module.exports = async function handler(req, res) {
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
    'Prefer': 'return=representation',
  };

  const { id } = req.query;

  // Helper: serialize error Supabase ke string yang readable
  function serializeError(val) {
    if (!val) return 'Unknown error';
    if (typeof val === 'string') return val;
    // Supabase error object punya .message, .details, .hint, .code
    if (val.message) {
      let msg = val.message;
      if (val.details) msg += ` | ${val.details}`;
      if (val.hint)    msg += ` | Hint: ${val.hint}`;
      if (val.code)    msg += ` (code: ${val.code})`;
      return msg;
    }
    return JSON.stringify(val);
  }

  // ── GET (admin: semua data, tanpa filter published) ───────
  if (req.method === 'GET') {
    try {
      const endpoint = id
        ? `${BASE}/airdrops?id=eq.${encodeURIComponent(id)}&limit=1`
        : `${BASE}/airdrops?select=*&order=created_at.desc`;

      const r = await fetch(endpoint, { headers: H });
      const data = await r.json();

      if (!r.ok) return res.status(r.status).json({ error: serializeError(data) });

      if (id) {
        if (!data || data.length === 0)
          return res.status(404).json({ error: 'Project tidak ditemukan' });
        return res.status(200).json(data[0]);
      }

      return res.status(200).json(Array.isArray(data) ? data : []);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── POST ─────────────────────────────────────────────────
  if (req.method === 'POST') {
    if (!req.body?.name)
      return res.status(400).json({ error: 'Field "name" wajib diisi' });

    const data = buildPayload(req.body);

    try {
      const r1 = await fetch(`${BASE}/airdrops`, {
        method: 'POST', headers: H, body: JSON.stringify(data),
      });
      const result = await r1.json();

      if (!r1.ok) return res.status(r1.status).json({ error: serializeError(result) });

      const newId = Array.isArray(result) ? result[0]?.id : result?.id;
      if (!newId) throw new Error('Gagal dapat ID setelah insert');

      return res.status(201).json(Array.isArray(result) ? result : [result]);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── PATCH ────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    if (!id) return res.status(400).json({ error: 'Query param "id" wajib ada' });
    if (!req.body || !Object.keys(req.body).length)
      return res.status(400).json({ error: 'Request body kosong' });

    const data = buildPayload(req.body);

    try {
      const r1 = await fetch(`${BASE}/airdrops?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: H, body: JSON.stringify(data),
      });

      let result = null;
      const text = await r1.text();
      if (text) {
        try { result = JSON.parse(text); } catch(e) { result = null; }
      }

      if (!r1.ok) {
        return res.status(r1.status).json({ error: serializeError(result || text) });
      }

      const updated = Array.isArray(result) ? result : (result ? [result] : [{ id, ...data }]);
      return res.status(200).json(updated);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── DELETE ───────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'Query param "id" wajib ada' });

    try {
      const r1 = await fetch(`${BASE}/airdrops?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE', headers: H,
      });

      if (!r1.ok) {
        const errData = await r1.json().catch(() => ({}));
        return res.status(r1.status).json({ error: serializeError(errData) });
      }

      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.setHeader('Allow', ['GET','POST','PATCH','DELETE']);
  return res.status(405).json({ error: `Method ${req.method} tidak diizinkan` });
};

function buildPayload(p) {
  return {
    name:           p.name           || null,
    status:         p.status         || null,
    published:      p.published !== undefined ? Boolean(p.published) : false,
    link:           p.link           || null,
    tags:           p.tags           || null,
    RaisedID:       p.RaisedID       || null,
    RaisedEN:       p.RaisedEN       || null,
    tasksID:        p.tasksID        || null,
    tasksEN:        p.tasksEN        || null,
    descriptionID:  p.descriptionID  || null,
    descriptionEN:  p.descriptionEN  || null,
    ticker:         p.ticker         || null,
    total_supply:   p.total_supply   || null,
    network:        p.network        || null,
    tge_date:       p.tge_date       || null,
    logo_url:       p.logo_url       || null,
    twitter:        p.twitter        || null,
    discord:        p.discord        || null,
    telegram:       p.telegram       || null,
    faqID:          p.faqID          || null,
    faqEN:          p.faqEN          || null,
    testnet_links:  p.testnet_links  || null,
  };
}
