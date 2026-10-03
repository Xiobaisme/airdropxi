// api/admin-airdrop.js
const { Ratelimit } = require('@upstash/ratelimit');
const { Redis } = require('@upstash/redis');
const WebSocket = require('ws');
const redis = Redis.fromEnv();

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '1 m'),
});

const crypto = require('crypto');

function verifyAdminToken(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/admin_token=([^;]+)/);
  if (!match) return false;
  try {
    const decoded = Buffer.from(decodeURIComponent(match[1]), 'base64').toString();
    const [payload, sig] = decoded.split('.');
    if (!payload || !sig) return false;
    const expectedSig = crypto.createHmac('sha256', process.env.ADMIN_SECRET_KEY).update(payload).digest('hex');
    const sigBuf = Buffer.from(sig), expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false;
    return Date.now() < Number(payload);
  } catch { return false; }
}

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
    console.error('[admin-airdrop] internal error:', val);
    return 'Terjadi kesalahan internal';
  }
    // ─── BROADCAST NEWS KE DISCORD & TELEGRAM ───
  async function handleBroadcastNews(req, res) {
    const { title, description, image_base64, url, source, mention_everyone } = req.body || {};
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
    // ▼▼▼ TAMBAHKAN BLOK INI ▼▼▼
    fields: [
      {
        name: '\u200b',
        value: '[TikTok](https://tiktok.com/@hellovry)  •  [Telegram](https://t.me/CryptoMonk3y)',
        inline: false,
      },
      {
        name: 'TRADING PLATFORMS',
        value: '[HIBT](https://hibt6.com/id/register?promotionCode=D95M)  •  [LBank](https://www.lbank.com/signup?icode=61ZWJ)  •  [Ourbit](https://www.ourbit.com/register?inviteCode=ourbitCMIC)',
        inline: false,
      },
    ],
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
    if (dRes.ok && mention_everyone) {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '@everyone',
        allowed_mentions: { parse: ['everyone'] },
      }),
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
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/`([^`]+)`/g, '<code>$1</code>');

      const buildText = () =>
        ` <b>${escHtml(title)}</b>\n\n` +
        `${escHtml(description || '')}\n\n` +
        `<i>Xiobaii • Crypto Monkey Inner Circle</i>`;

      // Khusus buat caption sendPhoto: description dipotong SEBELUM dibungkus tag,
      // jadi hasil potongannya nggak pernah motong di tengah <b> atau <i>
      const buildCaption = () => {
        const header = ` <b>${escHtml(title)}</b>\n\n`;
        const footer = `\n\n<i>Xiobaii • Crypto Monkey Inner Circle</i>`;
        const maxDescLen = Math.max(1024 - header.length - footer.length - 3, 0);
        const descEsc = escHtml(description || '');
        const truncated = descEsc.length > maxDescLen;
        const desc = truncated ? descEsc.slice(0, maxDescLen) + '...' : descEsc;
        return { caption: header + desc + footer, truncated };
      };

        const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: 'TikTok', url: 'https://tiktok.com/@hellovry' },
            { text: 'Discord', url: 'https://discord.gg/xvm9eZEjwf' },
          ],
          [
            { text: 'TRADING PLATFORMS', callback_data: 'noop' },
          ],
          [
            { text: 'HIBT', url: 'https://hibt6.com/id/register?promotionCode=D95M' },
            { text: 'LBank', url: 'https://www.lbank.com/signup?icode=61ZWJ' },
            { text: 'Ourbit', url: 'https://www.ourbit.com/register?inviteCode=ourbitCMIC' },
          ],
        ],
      };

      const fullText = buildText().slice(0, 4096);
      let tRes;

      if (imageBuffer) {
        const { caption, truncated } = buildCaption();

        const formPhoto = new FormData();
        formPhoto.append('chat_id', chatId);
        formPhoto.append('photo', new Blob([imageBuffer], { type: imageMime }), `image.${ext}`);
        formPhoto.append('caption', caption);
        formPhoto.append('parse_mode', 'HTML');
        formPhoto.append('reply_markup', JSON.stringify(inlineKeyboard));

        tRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: formPhoto });

        if (truncated) {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: fullText, parse_mode: 'HTML' }),
          });
        }
      } else {
        tRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: fullText, parse_mode: 'HTML', reply_markup: inlineKeyboard }),
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
  // ─── TERMINAL LOGIN (verifikasi kata sandi custom di halaman login) ───
  // Secret-nya HANYA hidup di env var TERMINAL_LOGIN_SECRET (server-side),
  // gak pernah dikirim/ditulis di HTML/JS yang jalan di browser.
    async function handleTerminalLogin(req, res) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    const { success } = await ratelimit.limit(`login:${ip}`);
    if (!success) {
      return res.status(429).json({ success: false, error: 'Terlalu banyak percobaan, coba lagi nanti' });
    }
    const { input } = req.body || {};
    const secret = process.env.TERMINAL_LOGIN_SECRET;

      if (!secret || !process.env.ADMIN_SECRET_KEY) {
      return res.status(500).json({ success: false, error: 'Konfigurasi server belum lengkap' });
    }
        const inputBuf = Buffer.from(typeof input === 'string' ? input : '');
    const secretBuf = Buffer.from(secret);
    const valid = inputBuf.length === secretBuf.length && crypto.timingSafeEqual(inputBuf, secretBuf);
    if (!valid) {
      return res.status(401).json({ success: false });
    }

    const expiry = Date.now() + 1000 * 60 * 60 * 4;
    const payload = `${expiry}`;
    const sig = crypto.createHmac('sha256', process.env.ADMIN_SECRET_KEY).update(payload).digest('hex');
    const token = Buffer.from(`${payload}.${sig}`).toString('base64');
    res.setHeader('Set-Cookie', `admin_token=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=14400`);
    return res.status(200).json({ success: true });
  }

  if (type === 'terminal-login') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method tidak diizinkan untuk terminal-login' });
    }
    return await handleTerminalLogin(req, res);
  }
    // ─── MARKETS (publik: ranking CoinGecko, cache Redis 1 jam) ───
  // Dipakai ticker bawah + koin jatuh di halaman login, jadi harus di atas cek admin.
  if (type === 'markets') {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method tidak diizinkan untuk markets' });
    }
    const CACHE_KEY = 'markets:top50';
    const STALE_KEY = 'markets:top50:stale';
    const parse = (v) => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } }
      return null;
    };
    try {
      let data = parse(await redis.get(CACHE_KEY));

      if (!data || !data.length) {
        const r = await fetch(
          'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false',
          { headers: { accept: 'application/json' } }
        );
        if (!r.ok) throw new Error('coingecko ' + r.status);
        const raw = await r.json();
        data = raw.map(c => ({
          id: c.id,
          symbol: c.symbol,
          name: c.name,
          image: c.image,
          market_cap_rank: c.market_cap_rank,
        }));
        await redis.set(CACHE_KEY, JSON.stringify(data), { ex: 60 * 60 });
        await redis.set(STALE_KEY, JSON.stringify(data), { ex: 60 * 60 * 24 * 7 });
      }

      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
      return res.status(200).json(data);
    } catch (e) {
      // CoinGecko down / kena rate limit: pakai salinan lama kalau ada
      try {
        const stale = parse(await redis.get(STALE_KEY));
        if (stale && stale.length) return res.status(200).json(stale);
      } catch {}
      return res.status(502).json({ error: serializeError(e) });
    }
  }
    if (!verifyAdminToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (type === 'broadcast-news') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method tidak diizinkan untuk broadcast-news' });
    }
    return await handleBroadcastNews(req, res);
  }

    // ─── NLF HISTORY (riwayat yang kita simpan sendiri) ───
  if (type === 'nlf-history') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method tidak diizinkan' });
    try {
      const rows = await redis.lrange('nlf:events', 0, 99);
      const events = rows.map(r => (typeof r === 'string' ? JSON.parse(r) : r));
      return res.status(200).json(events);
    } catch (e) {
      return res.status(500).json({ error: serializeError(e) });
    }
  }

  async function saveNLFEvent(m) {
    try {
      if (m.type !== 'announcement' && m.type !== 'tweet') return;
      const ev = m.parser?.classification?.event;
      const isUpbit = /upbit/i.test(JSON.stringify(m));
      if ((!ev || ev === 'none') && !isUpbit) return;             // simpan listing/delisting saja
      // anti-dobel kalau ada beberapa tab yang buka relay
      const ok = await redis.set(`nlf:seen:${m.detected_time_us}`, 1, { nx: true, ex: 60 * 60 * 24 * 7 });
      if (!ok) return;
      await redis.lpush('nlf:events', JSON.stringify(m));
      await redis.ltrim('nlf:events', 0, 199);      // simpan 200 terakhir
    } catch (e) {
      console.warn('[nlf] save gagal:', e.message);
    }
  }

  // ─── NEW LISTINGS FEED (SSE relay ke NLF WebSocket) ───
  if (type === 'nlf-stream') {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method tidak diizinkan untuk nlf-stream' });
    }
    const nlfKey = process.env.NLF_KEY;
    if (!nlfKey) return res.status(500).json({ error: 'NLF_KEY belum di-set' });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 5000\n\n');

    // Promise ini baru resolve pas stream selesai, biar Vercel nggak matiin fungsi lebih awal
    return new Promise((resolve) => {
      const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
      const ws = new WebSocket('wss://ws.newlistings.pro/v2/full', {
        headers: { authorization: `Bearer ${nlfKey}` },
        handshakeTimeout: 10000,
      });

      let ended = false;
      const keepAlive = setInterval(() => res.write(': ping\n\n'), 15000);
      const maxLife = setTimeout(end, 270000); // tutup sebelum limit, browser auto-reconnect

      function end() {
        if (ended) return;
        ended = true;
        clearInterval(keepAlive);
        clearTimeout(maxLife);
        try { ws.terminate(); } catch {}
        res.end();
        resolve();
      }

      ws.on('message', (d) => {
  let m; try { m = JSON.parse(d.toString()); } catch { return; }
  send(m);
  saveNLFEvent(m);
});
      ws.on('unexpected-response', (_q, r) => {
        send({ type: 'error', code: 'AUTHENTICATION_FAILED', status: r.statusCode });
        r.resume();
        end();
      });
      ws.on('error', () => {});
      ws.on('close', end);
      req.on('close', end);
    });
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
      return res.status(500).json({ error: serializeError(e) });
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
        return res.status(500).json({ error: serializeError(err2) });
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
     return res.status(500).json({ error: serializeError(e) });
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
          return res.status(500).json({ error: serializeError(proyekText) });
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
           return res.status(500).json({ error: serializeError(errInsert) });
          }
        }
      }

      return res.status(200).json({ success: true, updated: result });
    } catch (e) {
     return res.status(500).json({ error: serializeError(e) });
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

      const proyekAirdropId = intId !== undefined ? intId : id;
      deletePromises.push(
        fetch(`${BASE}/proyek?airdrop_id=eq.${encodeURIComponent(proyekAirdropId)}`, { method: 'DELETE', headers: H })
      );

      const [r1] = await Promise.all(deletePromises);

      if (!r1.ok) {
        const err = await r1.json().catch(() => ({}));
        return res.status(r1.status).json({ error: serializeError(err) });
      }

      return res.status(200).json({ success: true });
    } catch (e) {
     return res.status(500).json({ error: serializeError(e) });
    }
  }

  res.setHeader('Allow', ['GET','POST','PATCH','DELETE']);
  return res.status(405).json({ error: `Method ${req.method} tidak diizinkan` });
};
