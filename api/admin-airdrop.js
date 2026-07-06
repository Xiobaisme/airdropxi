// api/admin-airdrop.js
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

  const { id, exchange_id, type } = req.query;

  function serializeError(val) {
    if (!val) return 'Unknown error';
    if (typeof val === 'string') return val;
    if (val.message) {
      let msg = val.message;
      if (val.details) msg += ` | ${val.details}`;
      if (val.hint)    msg += ` | Hint: ${val.hint}`;
      if (val.code)    msg += ` (code: ${val.code})`;
      return msg;
    }
    return JSON.stringify(val);
  }

  // ─────────────────────────────────────────────
  // EXCHANGES HANDLER
  // ─────────────────────────────────────────────
  if (type === 'exchanges') {
    // ... (kode sama seperti sebelumnya)
    // (Saya tidak menulis ulang seluruh kode di sini, tapi di file akhir akan tetap ada)
  }

  // ─────────────────────────────────────────────
  // EXCHANGE DETAILS HANDLER
  // ─────────────────────────────────────────────
  if (type === 'exchange-details') {
    // ... (kode sama)
  }

  // ─────────────────────────────────────────────
  // CHAT HANDLER
  // ─────────────────────────────────────────────
  if (type === 'chat') {
    // ... (kode sama)
  }

  // ─────────────────────────────────────────────
  // NOTES HANDLER
  // ─────────────────────────────────────────────
  if (type === 'notes') {
    // ... (kode sama)
  }

  // ─────────────────────────────────────────────
  // REORDER HANDLER
  // ─────────────────────────────────────────────
  if (type === 'reorder') {
    // ... (kode sama)
  }

  // ============================================================
  // AIRDROP & PROYEK (tanpa roadmap)
  // ============================================================

  // ── Helper: buat payload untuk tabel airdrops (hanya field yang dikirim) ──
  function buildAirdropsPayload(p, includeAll = false) {
    const payload = {};
    const fields = ['name', 'status', 'confirmation_status', 'published', 'link', 'website_url', 'tags', 'RaisedID', 'RaisedEN', 'tasksID', 'tasksEN', 'logo_url', 'testnet_links', 'backers'];
    fields.forEach(f => {
      if (f in p) {
        payload[f] = p[f] === undefined ? null : p[f];
      }
    });
    // khusus published: jika ada, ubah ke boolean
    if ('published' in p) payload.published = Boolean(p.published);
    return payload;
  }

  // ── Helper: buat payload untuk tabel proyek (hanya field yang dikirim) ──
  function buildProyekPayload(p, airdropsId = null) {
    const payload = {};
    const fields = ['name', 'status', 'confirmation_status', 'published', 'link', 'website_url', 'tags', 'RaisedID', 'RaisedEN', 'tasksID', 'tasksEN', 'descriptionID', 'descriptionEN', 'ticker', 'total_supply', 'network', 'tge_date', 'logo_url', 'twitter', 'discord', 'telegram', 'linkedin', 'youtube', 'instagram', 'faqID', 'faqEN', 'testnet_links', 'tasks_images', 'backers'];
    fields.forEach(f => {
      if (f in p) {
        payload[f] = p[f] === undefined ? null : p[f];
      }
    });
    if (airdropsId !== null) payload.airdrop_id = airdropsId;
    if ('published' in p) payload.published = Boolean(p.published);
    return payload;
  }

  // ── GET ─────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      if (!id) {
        const [rA, rP] = await Promise.all([
          fetch(`${BASE}/airdrops?select=*&order=created_at.desc`, { headers: H }),
          fetch(`${BASE}/proyek?select=*`, { headers: H }),
        ]);
        const airdrops = await rA.json();
        const proyeks  = await rP.json();
        if (!rA.ok) return res.status(rA.status).json({ error: serializeError(airdrops) });

        const merged = airdrops.map(a => {
          const p = Array.isArray(proyeks) ? proyeks.find(x => x.airdrop_id === a.id) || {} : {};
          return { ...p, ...a, id: a.id };
        });
        return res.status(200).json(merged);
      }

      const [r1, r2] = await Promise.all([
        fetch(`${BASE}/airdrops?id=eq.${encodeURIComponent(id)}&limit=1`, { headers: H }),
        fetch(`${BASE}/proyek?airdrop_id=eq.${encodeURIComponent(id)}&limit=1`, { headers: H }),
      ]);

      const airdropsData = await r1.json();
      const proyekData   = await r2.json();

      if (!r1.ok) return res.status(r1.status).json({ error: serializeError(airdropsData) });
      if (!airdropsData || airdropsData.length === 0)
        return res.status(404).json({ error: 'Project tidak ditemukan' });

      const base   = airdropsData[0];
      const extra  = (proyekData && proyekData.length > 0) ? proyekData[0] : {};
      const merged = { ...base, ...extra, id: base.id, view_count: base.view_count || 0 };

      return res.status(200).json(merged);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── POST ─────────────────────────────────────────
  if (req.method === 'POST') {
    if (!req.body?.name)
      return res.status(400).json({ error: 'Field "name" wajib diisi' });

    try {
      const airdropPayload = buildAirdropsPayload(req.body);
      const r1 = await fetch(`${BASE}/airdrops`, {
        method: 'POST', headers: H,
        body: JSON.stringify(airdropPayload),
      });
      const result1 = await r1.json();
      if (!r1.ok) return res.status(r1.status).json({ error: serializeError(result1) });

      const newId = Array.isArray(result1) ? result1[0]?.id : result1?.id;
      if (!newId) throw new Error('Gagal dapat ID setelah insert ke airdrops');

      const proyekPayload = buildProyekPayload(req.body, newId);
      const r2 = await fetch(`${BASE}/proyek`, {
        method: 'POST', headers: H,
        body: JSON.stringify(proyekPayload),
      });
      if (!r2.ok) {
        const err2 = await r2.json().catch(() => ({}));
        console.error('Sync proyek gagal:', JSON.stringify(err2));
        await fetch(`${BASE}/airdrops?id=eq.${encodeURIComponent(newId)}`, {
          method: 'DELETE', headers: H,
        });
        return res.status(500).json({ error: 'Gagal insert ke proyek: ' + serializeError(err2) });
      }

      // Notifikasi (tetap ada)
      try {
        await fetch(`https://airdropxi.vercel.app/api/notify-subscribers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': process.env.ADMIN_SECRET_KEY,
          },
          body: JSON.stringify({
            projectName: req.body.name,
            projectUrl:  `https://airdropxi.vercel.app/guide/${newId}`,
            description: req.body.descriptionEN || req.body.descriptionID || '',
            raised:      req.body.RaisedEN      || req.body.RaisedID      || null,
            tags:        req.body.tags          || null,
            network:     req.body.network       || null,
            status:      req.body.status        || null,
          }),
        });
      } catch(e) {
        console.warn('Notify gagal:', e.message);
      }

      return res.status(201).json(Array.isArray(result1) ? result1 : [result1]);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── PATCH ─────────────────────────────────────────
  if (req.method === 'PATCH') {
    if (!id) return res.status(400).json({ error: 'Query param "id" wajib ada' });

    try {
      // Buat payload hanya dari field yang dikirim
      const airdropPayload = buildAirdropsPayload(req.body);
      const proyekPayload = buildProyekPayload(req.body);

      // Update airdrops
      const r1 = await fetch(`${BASE}/airdrops?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: H,
        body: JSON.stringify(airdropPayload),
      });
      const text = await r1.text();
      let result = null;
      if (text) { try { result = JSON.parse(text); } catch(e) {} }
      if (!r1.ok) return res.status(r1.status).json({ error: serializeError(result || text) });

      // Update proyek (hanya jika ada field yang dikirim)
      if (Object.keys(proyekPayload).length > 0) {
        const rProyek = await fetch(`${BASE}/proyek?airdrop_id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH', headers: H,
          body: JSON.stringify(proyekPayload),
        });
        const proyekText = await rProyek.text();
        if (!rProyek.ok) {
          console.error('PATCH proyek gagal:', proyekText);
          return res.status(500).json({ error: 'PATCH proyek gagal: ' + proyekText });
        }
      }

      const updated = Array.isArray(result) ? result : (result ? [result] : [{ id, ...airdropPayload }]);
      return res.status(200).json(updated);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── DELETE ─────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'Query param "id" wajib ada' });

    try {
      const rCheck = await fetch(`${BASE}/airdrops?id=eq.${encodeURIComponent(id)}&select=id`, { headers: H });
      const checkData = await rCheck.json();
      const intId = checkData?.[0]?.id;

      const deletePromises = [
        fetch(`${BASE}/airdrops?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: H }),
      ];

      if (intId !== undefined) {
        deletePromises.push(
          fetch(`${BASE}/proyek?airdrop_id=eq.${intId}`, { method: 'DELETE', headers: H })
          // roadmap sudah dihapus
        );
      }

      const [r1] = await Promise.all(deletePromises);

      if (!r1.ok) {
        const err = await r1.json().catch(() => ({}));
        return res.status(r1.status).json({ error: serializeError(err) });
      }

      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.setHeader('Allow', ['GET','POST','PATCH','DELETE']);
  return res.status(405).json({ error: `Method ${req.method} tidak diizinkan` });
};
