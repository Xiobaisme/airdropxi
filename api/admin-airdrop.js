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

    // ─── BROADCAST NEWS KE DISCORD & TELEGRAM ───
  async function handleBroadcastNews(req, res) {
    const { title, description, image_base64, url, source } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title wajib diisi' });

    // Decode gambar dari data URL (hasil paste) jadi Buffer, biar bisa
    // di-attach sebagai FILE langsung — bukan link URL.
    let imageBuffer = null, imageMime = 'image/png';
    if (image_base64 && image_base64.startsWith('data:')) {
      const match = image_base64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) { imageMime = match[1]; imageBuffer = Buffer.from(match[2], 'base64'); }
    }
    const ext = imageMime.split('/')[1] || 'png';

    // ─── DISCORD ───
async function sendDiscord() {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) throw new Error('DISCORD_WEBHOOK_URL belum di-set');

  const LOGO_URL = 'https://airdropxi.vercel.app/logo1.png'; // ganti kalau path logo asli beda

  const embed = {
    author: { name: '🗣 CMIC BROADCAST', icon_url: LOGO_URL },
    title: String(title).slice(0, 256),
    description: String(description || '').slice(0, 4096),
    url: url || undefined,
    color: 0x3B82F6,
    footer: { text: 'Xiobaii • Crypto Monkey Inner Circle', icon_url: LOGO_URL },
    timestamp: new Date().toISOString(),
  };

  let dRes;
  if (imageBuffer) {
    embed.image = { url: `attachment://image.${ext}` };
    const form = new FormData();
    form.append('payload_json', JSON.stringify({ embeds: [embed] }));
    form.append('files[0]', new Blob([imageBuffer], { type: imageMime }), `image.${ext}`);
    dRes = await fetch(webhookUrl, { method: 'POST', body: form });
  } else {
    dRes = await fetch(webhookUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
  }
  return dRes.ok ? 'ok' : `error ${dRes.status}`;
}

        // ─── TELEGRAM ───
    async function sendTelegram() {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (!token || !chatId) throw new Error('TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID belum di-set');

      const escHtml = (s) => String(s || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      const buildCaption = (desc) =>
        ` <b>${escHtml(title)}</b>\n\n` +
        `${escHtml(desc)}\n\n` +
        `<i>Xiobaii • Crypto Monkey Inner Circle</i>`;

      const inlineKeyboard = {
        inline_keyboard: [[
          { text: 'TikTok', url: 'https://tiktok.com/@hellovry' },
          { text: 'Discord', url: 'https://discord.gg/xvm9eZEjwf' },
        ]],
      };

      let tRes;
      if (imageBuffer) {
        const shortDesc = (description || '').length > 650
          ? description.slice(0, 650) + '…'
          : (description || '');
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('caption', buildCaption(shortDesc));
        form.append('parse_mode', 'HTML');
        form.append('reply_markup', JSON.stringify(inlineKeyboard));
        form.append('photo', new Blob([imageBuffer], { type: imageMime }), `image.${ext}`);
        tRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form });
      } else {
        tRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: buildCaption(description || ''), parse_mode: 'HTML', reply_markup: inlineKeyboard }),
        });
      }
      const tData = await tRes.json().catch(() => ({}));
      return tRes.ok && tData.ok ? 'ok' : `error: ${tData.description || tRes.status}`;
    }

    const [discordSettled, telegramSettled] = await Promise.allSettled([
      sendDiscord(),
      sendTelegram(),
    ]);

    const results = {
      discord:  discordSettled.status  === 'fulfilled' ? discordSettled.value  : 'error: ' + discordSettled.reason.message,
      telegram: telegramSettled.status === 'fulfilled' ? telegramSettled.value : 'error: ' + telegramSettled.reason.message,
    };

    const anyOk = results.discord === 'ok' || results.telegram === 'ok';
    return res.status(anyOk ? 200 : 500).json(results);
  }

  if (type === 'broadcast-news') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method tidak diizinkan untuk broadcast-news' });
    }
    return await handleBroadcastNews(req, res);
  }
  
  function buildAirdropsPayload(p) {
    return {
      name:                p.name                || null,
      status:              p.status              || null,
      confirmation_status: p.confirmation_status || null,
      published:           p.published !== undefined ? Boolean(p.published) : false,
      link:                p.link                || null,
      website_url:         p.website_url         || null,
      tags:                p.tags                || null,
      RaisedID:            p.RaisedID            || null,
      RaisedEN:            p.RaisedEN            || null,
      tasksID:             p.tasksID             || null,
      tasksEN:             p.tasksEN             || null,
      testnet_links:       p.testnet_links       || null,
      backers:             p.backers             || null,
    };
  }

  function buildProyekPayload(p, airdropsId) {
    return {
      name:                p.name                || null,
      status:              p.status              || null,
      confirmation_status: p.confirmation_status || null,
      published:           p.published !== undefined ? Boolean(p.published) : false,
      link:                p.link                || null,
      website_url:         p.website_url         || null,
      tags:                p.tags                || null,
      RaisedID:            p.RaisedID            || null,
      RaisedEN:            p.RaisedEN            || null,
      tasksID:             p.tasksID             || null,
      tasksEN:             p.tasksEN             || null,
      descriptionID:       p.descriptionID       || null,
      descriptionEN:       p.descriptionEN       || null,
      ticker:              p.ticker              || null,
      total_supply:        p.total_supply        || null,
      network:             p.network             || null,
      tge_date:            p.tge_date            || null,
      twitter:             p.twitter             || null,
      discord:             p.discord             || null,
      telegram:            p.telegram            || null,
      linkedin:            p.linkedin            || null,
      youtube:             p.youtube             || null,
      instagram:           p.instagram           || null,
      faqID:               p.faqID               || null,
      faqEN:               p.faqEN               || null,
      testnet_links:       p.testnet_links       || null,
      tasks_images:        p.tasks_images        || null,
      backers:             p.backers             || null,
      airdrop_id:          airdropsId,
    };
  }

  if (req.method === 'GET') {
    try {
      if (!id) {
        const [rA, rP] = await Promise.all([
          fetch(`${BASE}/airdrops?select=*&order=created_at.desc&limit=5000`, { headers: H }),
          fetch(`${BASE}/proyek?select=*&limit=5000`, { headers: H }),
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
        await fetch(`${BASE}/airdrops?id=eq.${encodeURIComponent(newId)}`, {
          method: 'DELETE', headers: H,
        });
        return res.status(500).json({ error: 'Gagal insert ke proyek: ' + serializeError(err2) });
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
      const airdropFields = [
        'name', 'status', 'confirmation_status', 'published', 'link', 'website_url',
        'tags', 'RaisedID', 'RaisedEN', 'tasksID', 'tasksEN',
        'logo_url', 'testnet_links', 'backers'
      ];
      const airdropPayload = {};
      airdropFields.forEach(f => {
        if (f in req.body) {
          if (f === 'name') {
            if (req.body.name && String(req.body.name).trim()) {
              airdropPayload.name = String(req.body.name).trim();
            }
          } else {
            airdropPayload[f] = req.body[f] === undefined ? null : req.body[f];
          }
        }
      });
      if ('published' in req.body) airdropPayload.published = Boolean(req.body.published);

      const proyekFields = [
        'name', 'status', 'confirmation_status', 'published', 'link', 'website_url',
        'tags', 'RaisedID', 'RaisedEN', 'tasksID', 'tasksEN',
        'descriptionID', 'descriptionEN', 'ticker', 'total_supply',
        'network', 'tge_date', 'twitter', 'discord',
        'telegram', 'linkedin', 'youtube', 'instagram',
        'faqID', 'faqEN', 'testnet_links', 'tasks_images', 'backers'
      ];
      const proyekPayload = {};
      proyekFields.forEach(f => {
        if (f in req.body) {
          if (f === 'name') {
            if (req.body.name && String(req.body.name).trim()) {
              proyekPayload.name = String(req.body.name).trim();
            }
          } else {
            proyekPayload[f] = req.body[f] === undefined ? null : req.body[f];
          }
        }
      });
      if ('published' in req.body) proyekPayload.published = Boolean(req.body.published);

      const r1 = await fetch(`${BASE}/airdrops?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: H,
        body: JSON.stringify(airdropPayload),
      });
      const text = await r1.text();
      let result = null;
      if (text) { try { result = JSON.parse(text); } catch(e) {} }
      if (!r1.ok) return res.status(r1.status).json({ error: serializeError(result || text) });

      if (Object.keys(proyekPayload).length > 0) {
        const rProyek = await fetch(
          `${BASE}/proyek?airdrop_id=eq.${encodeURIComponent(id)}`,
          { method: 'PATCH', headers: H, body: JSON.stringify(proyekPayload) }
        );
        const proyekText = await rProyek.text();
        if (!rProyek.ok) {
          console.error('PATCH proyek gagal:', proyekText);
          return res.status(500).json({ error: 'PATCH proyek gagal: ' + proyekText });
        }

        let proyekResult = [];
        try { proyekResult = proyekText ? JSON.parse(proyekText) : []; } catch (e) {}

        if (Array.isArray(proyekResult) && proyekResult.length === 0) {
          const insertPayload = {
            ...proyekPayload,
            name: proyekPayload.name || (result?.[0]?.name ?? req.body.name ?? null),
            airdrop_id: Number(id),
          };
          const rInsert = await fetch(`${BASE}/proyek`, {
            method: 'POST', headers: H,
            body: JSON.stringify(insertPayload),
          });
          if (!rInsert.ok) {
            const errInsert = await rInsert.json().catch(() => ({}));
            console.error('Auto-create proyek gagal:', JSON.stringify(errInsert));
            return res.status(500).json({
              error: 'Row proyek belum ada dan gagal dibuat otomatis: ' + serializeError(errInsert)
            });
          }
        }
      }

      return res.status(200).json({ success: true, updated: result });
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
          fetch(`${BASE}/proyek?airdrop_id=eq.${intId}`, { method: 'DELETE', headers: H })
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
