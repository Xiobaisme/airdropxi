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
  // EXCHANGE DETAILS HANDLER
  // ─────────────────────────────────────────────
  if (type === 'exchange-details') {
    if (req.method === 'GET') {
      try {
        if (id) {
          const r = await fetch(`${BASE}/exchange_details?id=eq.${encodeURIComponent(id)}&select=*`, { headers: H });
          const data = await r.json();
          if (!r.ok) return res.status(r.status).json({ error: serializeError(data) });
          if (!data || data.length === 0) return res.status(404).json({ error: 'Exchange detail tidak ditemukan' });
          const detail = data[0];
          const exRes = await fetch(`${BASE}/exchanges?id=eq.${detail.exchange_id}&select=exchange_name,type`, { headers: H });
          const exData = await exRes.json();
          if (exRes.ok && exData && exData[0]) {
            detail.exchange_name = exData[0].exchange_name;
            detail.type = exData[0].type || 'cex';
          }
          return res.status(200).json(detail);
        }
        else if (exchange_id) {
          const r = await fetch(`${BASE}/exchange_details?exchange_id=eq.${encodeURIComponent(exchange_id)}&select=*`, { headers: H });
          const data = await r.json();
          if (!r.ok) return res.status(r.status).json({ error: serializeError(data) });
          if (!data || data.length === 0) return res.status(404).json({ error: 'Exchange detail tidak ditemukan untuk exchange_id tersebut' });
          const detail = data[0];
          const exRes = await fetch(`${BASE}/exchanges?id=eq.${detail.exchange_id}&select=exchange_name,type`, { headers: H });
          const exData = await exRes.json();
          if (exRes.ok && exData && exData[0]) {
            detail.exchange_name = exData[0].exchange_name;
            detail.type = exData[0].type || 'cex';
          }
          return res.status(200).json(detail);
        }
        else {
          // Ambil semua — include rank, about_id, about_en
          const r = await fetch(`${BASE}/exchange_details?select=*`, { headers: H });
          const data = await r.json();
          if (!r.ok) return res.status(r.status).json({ error: serializeError(data) });
          const enriched = await Promise.all(data.map(async (detail) => {
            const exRes = await fetch(`${BASE}/exchanges?id=eq.${detail.exchange_id}&select=exchange_name,type`, { headers: H });
            const exData = await exRes.json();
            if (exRes.ok && exData && exData[0]) {
              detail.exchange_name = exData[0].exchange_name;
              detail.type = exData[0].type || 'cex';
            }
            return detail;
          }));
          return res.status(200).json(enriched);
        }
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    // PATCH — ✅ tambah rank, about_id, about_en
    if (req.method === 'PATCH') {
      if (!id && !exchange_id) {
        return res.status(400).json({ error: 'Query param "id" atau "exchange_id" wajib ada' });
      }

      try {
        let targetFilter = '';
        if (id) targetFilter = `id=eq.${encodeURIComponent(id)}`;
        else    targetFilter = `exchange_id=eq.${encodeURIComponent(exchange_id)}`;

        // Hanya masukkan field yang dikirim (tidak overwrite dengan null kalau tidak ada)
        const body = req.body;
        const payload = {};

        // Field lama
        if ('about'     in body) payload.about     = body.about     ?? null;
        if ('website'   in body) payload.website   = body.website   ?? null;
        if ('twitter'   in body) payload.twitter   = body.twitter   ?? null;
        if ('telegram'  in body) payload.telegram  = body.telegram  ?? null;
        if ('discord'   in body) payload.discord   = body.discord   ?? null;
        if ('instagram' in body) payload.instagram = body.instagram ?? null;
        if ('facebook'  in body) payload.facebook  = body.facebook  ?? null;
        if ('linkedin'  in body) payload.linkedin  = body.linkedin  ?? null;
        if ('github'    in body) payload.github    = body.github    ?? null;
        if ('youtube'   in body) payload.youtube   = body.youtube   ?? null;
        if ('medium'    in body) payload.medium    = body.medium    ?? null;

        // ✅ Field baru
        if ('rank'     in body) payload.rank     = body.rank     ? parseInt(body.rank, 10) : null;
        if ('about_id' in body) payload.about_id = body.about_id ?? null;
        if ('about_en' in body) payload.about_en = body.about_en ?? null;

        payload.updated_at = new Date().toISOString();

        const r = await fetch(`${BASE}/exchange_details?${targetFilter}`, {
          method: 'PATCH',
          headers: H,
          body: JSON.stringify(payload),
        });

        const text = await r.text();
        let result = null;
        if (text) { try { result = JSON.parse(text); } catch(e) { result = null; } }
        if (!r.ok) return res.status(r.status).json({ error: serializeError(result || text) });

        return res.status(200).json({ success: true, updated: result });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    // POST
    if (req.method === 'POST') {
      if (!req.body.exchange_id) {
        return res.status(400).json({ error: 'Field "exchange_id" wajib diisi' });
      }
      try {
        const payload = {
          exchange_id:  req.body.exchange_id,
          rank:         req.body.rank      ? parseInt(req.body.rank, 10) : null,
          about:        req.body.about     ?? null,
          about_id:     req.body.about_id  ?? null,
          about_en:     req.body.about_en  ?? null,
          website:      req.body.website   ?? null,
          twitter:      req.body.twitter   ?? null,
          telegram:     req.body.telegram  ?? null,
          discord:      req.body.discord   ?? null,
          instagram:    req.body.instagram ?? null,
          facebook:     req.body.facebook  ?? null,
          linkedin:     req.body.linkedin  ?? null,
          github:       req.body.github    ?? null,
          youtube:      req.body.youtube   ?? null,
          medium:       req.body.medium    ?? null,
        };
        const r = await fetch(`${BASE}/exchange_details`, {
          method: 'POST',
          headers: H,
          body: JSON.stringify(payload),
        });
        const data = await r.json();
        if (!r.ok) return res.status(r.status).json({ error: serializeError(data) });
        return res.status(201).json(data);
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    // DELETE
    if (req.method === 'DELETE') {
      if (!id && !exchange_id) {
        return res.status(400).json({ error: 'Query param "id" atau "exchange_id" wajib ada' });
      }
      try {
        let targetFilter = '';
        if (id) targetFilter = `id=eq.${encodeURIComponent(id)}`;
        else    targetFilter = `exchange_id=eq.${encodeURIComponent(exchange_id)}`;

        const r = await fetch(`${BASE}/exchange_details?${targetFilter}`, {
          method: 'DELETE',
          headers: H,
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          return res.status(r.status).json({ error: serializeError(err) });
        }
        return res.status(200).json({ success: true });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
    return res.status(405).json({ error: `Method ${req.method} tidak diizinkan untuk exchange-details` });
  }

  // ============================================================
  // AIRDROP & PROYEK — TIDAK BERUBAH
  // ============================================================
  function buildAirdropsPayload(p) {
    return {
      name:                 p.name                 || null,
      status:               p.status               || null,
      confirmation_status:  p.confirmation_status  || null,
      published:            p.published !== undefined ? Boolean(p.published) : false,
      link:                 p.link                 || null,
      tags:                 p.tags                 || null,
      RaisedID:             p.RaisedID             || null,
      RaisedEN:             p.RaisedEN             || null,
      tasksID:              p.tasksID              || null,
      tasksEN:              p.tasksEN              || null,
      logo_url:             p.logo_url             || null,
      testnet_links:        p.testnet_links        || null,
    };
  }

  function buildProyekPayload(p, airdropsId) {
    const payload = {
      name:                 p.name                 || null,
      status:               p.status               || null,
      confirmation_status:  p.confirmation_status  || null,
      published:            p.published !== undefined ? Boolean(p.published) : false,
      link:                 p.link                 || null,
      tags:                 p.tags                 || null,
      RaisedID:             p.RaisedID             || null,
      RaisedEN:             p.RaisedEN             || null,
      tasksID:              p.tasksID              || null,
      tasksEN:              p.tasksEN              || null,
      descriptionID:        p.descriptionID        || null,
      descriptionEN:        p.descriptionEN        || null,
      ticker:               p.ticker               || null,
      total_supply:         p.total_supply         || null,
      network:              p.network              || null,
      tge_date:             p.tge_date             || null,
      logo_url:             p.logo_url             || null,
      twitter:              p.twitter              || null,
      discord:              p.discord              || null,
      telegram:             p.telegram             || null,
      linkedin:             p.linkedin             || null,
      youtube:              p.youtube              || null,
      instagram:            p.instagram            || null,
      faqID:                p.faqID                || null,
      faqEN:                p.faqEN                || null,
      testnet_links:        p.testnet_links        || null,
    };
    if (airdropsId !== undefined) payload.airdrop_id = airdropsId;
    return payload;
  }

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
      const merged = { ...base, ...extra, id: base.id, view_count: base.view_count || 0 };

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

      if (req.body._roadmap && Array.isArray(req.body._roadmap) && req.body._roadmap.length > 0) {
        await saveRoadmap(BASE, H, newId, req.body._roadmap);
      }

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

  if (req.method === 'PATCH') {
    if (!id) return res.status(400).json({ error: 'Query param "id" wajib ada' });

    try {
      const r1 = await fetch(`${BASE}/airdrops?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: H,
        body: JSON.stringify(buildAirdropsPayload(req.body)),
      });

      let result = null;
      const text = await r1.text();
      if (text) { try { result = JSON.parse(text); } catch(e) { result = null; } }
      if (!r1.ok) return res.status(r1.status).json({ error: serializeError(result || text) });

      const rCheck = await fetch(`${BASE}/airdrops?id=eq.${encodeURIComponent(id)}&select=id`, { headers: H });
      const checkData = await rCheck.json();
      const intId = checkData?.[0]?.id;

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

// ── HELPER: save roadmap ─────────────────────────────────
async function saveRoadmap(BASE, H, airdropId, items) {
  try {
    await fetch(`${BASE}/project_roadmaps?airdrop_id=eq.${airdropId}`, {
      method: 'DELETE', headers: H,
    });

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

function clearTokenLogo() {
  document.getElementById('ex-native-token-logo').value = '';
  document.getElementById('ex-token-logo-url-display').textContent = 'Belum ada logo';
  const preview = document.getElementById('ex-token-logo-preview');
  if (preview) preview.innerHTML = '🪙';
  const status = document.getElementById('ex-token-logo-status');
  if (status) { status.className = 'logo-upload-status'; status.textContent = ''; }
}

async function handleTokenLogoUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const allowed = ['image/png','image/jpeg','image/jpg','image/webp','image/svg+xml','image/gif'];
  if (!allowed.includes(file.type)) { showToast('Format tidak didukung.', 'error'); return; }
  if (file.size > 2 * 1024 * 1024) { showToast('File terlalu besar. Maks 2MB.', 'error'); return; }

  const statusEl = document.getElementById('ex-token-logo-status');
  statusEl.className = 'logo-upload-status uploading';
  statusEl.innerHTML = '<span class="spinner"></span> Mengupload...';

  try {
    const tokenName = document.getElementById('ex-native-token')?.value?.trim() || 'token';
    const url = await uploadImageToGitHub(file, tokenName + '-logo');
    document.getElementById('ex-native-token-logo').value = url;
    document.getElementById('ex-token-logo-url-display').textContent = url;
    const preview = document.getElementById('ex-token-logo-preview');
    if (preview) preview.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    statusEl.className = 'logo-upload-status success';
    statusEl.textContent = '✓ Upload berhasil!';
    showToast('✓ Token logo terupload!', 'success');
  } catch(err) {
    statusEl.className = 'logo-upload-status error';
    statusEl.textContent = '✕ ' + err.message;
    showToast('Upload gagal: ' + err.message, 'error');
  } finally {
    e.target.value = '';
  }
}


// Init token logo preview kalau udah ada
const existingTokenLogo = ex.native_token_logo;
if (existingTokenLogo) {
  document.getElementById('ex-native-token-logo').value = existingTokenLogo;
  document.getElementById('ex-token-logo-url-display').textContent = existingTokenLogo;
  const preview = document.getElementById('ex-token-logo-preview');
  if (preview) preview.innerHTML = `<img src="${existingTokenLogo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
}
