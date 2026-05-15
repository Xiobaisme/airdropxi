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

  const { id } = req.query;

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

  function buildAirdropsPayload(p) {
    return {
      name:          p.name          || null,
      status:        p.status        || null,
      published:     p.published !== undefined ? Boolean(p.published) : false,
      link:          p.link          || null,
      tags:          p.tags          || null,
      RaisedID:      p.RaisedID      || null,
      RaisedEN:      p.RaisedEN      || null,
      tasksID:       p.tasksID       || null,
      tasksEN:       p.tasksEN       || null,
      logo_url:      p.logo_url      || null,
      testnet_links: p.testnet_links || null,
    };
  }

  function buildProyekPayload(p, airdropsId) {
    const payload = {
      name:          p.name          || null,
      status:        p.status        || null,
      published:     p.published !== undefined ? Boolean(p.published) : false,
      link:          p.link          || null,
      tags:          p.tags          || null,
      RaisedID:      p.RaisedID      || null,
      RaisedEN:      p.RaisedEN      || null,
      tasksID:       p.tasksID       || null,
      tasksEN:       p.tasksEN       || null,
      descriptionID: p.descriptionID || null,
      descriptionEN: p.descriptionEN || null,
      ticker:        p.ticker        || null,
      total_supply:  p.total_supply  || null,
      network:       p.network       || null,
      tge_date:      p.tge_date      || null,
      logo_url:      p.logo_url      || null,
      twitter:       p.twitter       || null,
      discord:       p.discord       || null,
      telegram:      p.telegram      || null,
      linkedin:      p.linkedin      || null,
      youtube:       p.youtube       || null,
      instagram:     p.instagram     || null,
      faqID:         p.faqID         || null,
      faqEN:         p.faqEN         || null,
      testnet_links: p.testnet_links || null,
    };
    if (airdropsId !== undefined) payload.airdrop_id = airdropsId;
    return payload;
  }

  // ── GET ──────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      if (!id) {
        const r = await fetch(`${BASE}/airdrops?select=*&order=created_at.desc`, { headers: H });
        const data = await r.json();
        if (!r.ok) return res.status(r.status).json({ error: serializeError(data) });
        return res.status(200).json(Array.isArray(data) ? data : []);
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
      const merged = { ...base, ...extra, id: base.id };

      // Fetch roadmap untuk project ini
      const intId = extra.airdrop_id || base.id;
      const rRoadmap = await fetch(
        `${BASE}/project_roadmaps?airdrop_id=eq.${intId}&order=sort_order.asc`,
        { headers: H }
      );
      const roadmapData = rRoadmap.ok ? await rRoadmap.json() : [];
      merged._roadmap = Array.isArray(roadmapData) ? roadmapData : [];

      return res.status(200).json(merged);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── POST ─────────────────────────────────────────────
  if (req.method === 'POST') {
    if (!req.body?.name)
      return res.status(400).json({ error: 'Field "name" wajib diisi' });

    try {
      const r1 = await fetch(`${BASE}/airdrops`, {
        method: 'POST', headers: H,
        body: JSON.stringify(buildAirdropsPayload(req.body)),
      });
      const result1 = await r1.json();
      if (!r1.ok) return res.status(r1.status).json({ error: serializeError(result1) });

      const newId = Array.isArray(result1) ? result1[0]?.id : result1?.id;
      if (!newId) throw new Error('Gagal dapat ID setelah insert ke airdrops');

      const r2 = await fetch(`${BASE}/proyek`, {
        method: 'POST', headers: H,
        body: JSON.stringify(buildProyekPayload(req.body, newId)),
      });
      if (!r2.ok) {
        const err2 = await r2.json().catch(() => ({}));
        console.error('Sync proyek gagal:', JSON.stringify(err2));
      }

       // Simpan roadmap kalau ada
      if (req.body._roadmap && Array.isArray(req.body._roadmap) && req.body._roadmap.length > 0) {
        await saveRoadmap(BASE, H, newId, req.body._roadmap);
      }

      // Notify subscribers
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
            description: req.body.descriptionID || req.body.descriptionEN || '',
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
 
  // ── PATCH ────────────────────────────────────────────
  if (req.method === 'PATCH') {
    if (!id) return res.status(400).json({ error: 'Query param "id" wajib ada' });

    try {
      // 1. Update tabel airdrops
      const r1 = await fetch(`${BASE}/airdrops?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: H,
        body: JSON.stringify(buildAirdropsPayload(req.body)),
      });

      let result = null;
      const text = await r1.text();
      if (text) { try { result = JSON.parse(text); } catch(e) { result = null; } }
      if (!r1.ok) return res.status(r1.status).json({ error: serializeError(result || text) });

      // 2. Ambil integer id dari airdrops
      const rCheck = await fetch(`${BASE}/airdrops?id=eq.${encodeURIComponent(id)}&select=id`, { headers: H });
      const checkData = await rCheck.json();
      const intId = checkData?.[0]?.id;

      // 3. Update tabel proyek
      if (intId !== undefined) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
          await fetch(`${BASE}/proyek?airdrop_id=eq.${intId}`, {
            method: 'PATCH',
            headers: H,
            body: JSON.stringify(buildProyekPayload(req.body)),
            signal: controller.signal,
          });
        } catch(e) {
          console.warn('Sync proyek PATCH timeout/error:', e.message);
        } finally {
          clearTimeout(timeout);
        }

        // 4. Update roadmap kalau ada di payload
        if (req.body._roadmap !== undefined && intId !== undefined) {
          await saveRoadmap(BASE, H, intId, req.body._roadmap || []);
        }
      }

      const updated = Array.isArray(result) ? result : (result ? [result] : [{ id, ...buildAirdropsPayload(req.body) }]);
      return res.status(200).json(updated);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── DELETE ───────────────────────────────────────────
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
          fetch(`${BASE}/proyek?airdrop_id=eq.${intId}`, { method: 'DELETE', headers: H }),
          fetch(`${BASE}/project_roadmaps?airdrop_id=eq.${intId}`, { method: 'DELETE', headers: H })
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

// ── HELPER: save roadmap (delete all + re-insert) ────
async function saveRoadmap(BASE, H, airdropId, items) {
  try {
    // Hapus semua roadmap lama untuk project ini
    await fetch(`${BASE}/project_roadmaps?airdrop_id=eq.${airdropId}`, {
      method: 'DELETE', headers: H,
    });

    // Insert baru kalau ada isinya
    if (!items || items.length === 0) return;

    const rows = items
      .filter(item => item.phase_label && item.phase_title)
      .map((item, idx) => ({
        airdrop_id:   airdropId,
        phase_label:  item.phase_label  || '',
        phase_title:  item.phase_title  || '',
        phase_desc:   item.phase_desc   || null,
        status:       ['done','in_progress','planned'].includes(item.status) ? item.status : 'planned',
        sort_order:   idx,
        source_url:   item.source_url   || null,
        source_label: item.source_label || 'Official Roadmap',
      }));

    if (rows.length === 0) return;

    await fetch(`${BASE}/project_roadmaps`, {
      method: 'POST',
      headers: { ...H, 'Prefer': 'return=minimal' },
      body: JSON.stringify(rows),
    });
  } catch(e) {
    console.warn('saveRoadmap error:', e.message);
  }
}
