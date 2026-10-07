// api/admin-airdrop.js
const crypto = require('crypto');
const { verifyAdminToken, issueSession, clearSession, addCookie } = require('../lib/auth');
const MEMBER_TYPES = ['onchain', 'btcd', 'token-unlocks', 'feed', 'nlf-history', 'nlf-stream', 'broadcast-news'];
const roleOf = (s) => (!s ? null : s.provider === 'google' ? 'admin' : 'member');

// ── lazy load: modul berisiko baru di-require saat dipakai ──
let _redis, _ratelimit;
const getRedis = () => (_redis ||= require('@upstash/redis').Redis.fromEnv());
const getRatelimit = () => (_ratelimit ||= new (require('@upstash/ratelimit').Ratelimit)({
  redis: getRedis(),
  limiter: require('@upstash/ratelimit').Ratelimit.slidingWindow(5, '1 m'),
}));

const redis = new Proxy({}, { get: (_, k) => (...a) => getRedis()[k](...a) });
const ratelimit = { limit: (k) => getRatelimit().limit(k) };
const onchain = new Proxy({}, { get: (_, k) => (...a) => require('../lib/onchain')[k](...a) });
const getAirdrops = () => require('../data/airdrops.json');

// SEMENTARA: putus semua akses ke Supabase sampai DB sehat
const MAINTENANCE = true;

const SESSION_MS_DISCORD = 12 * 60 * 60 * 1000; // member Discord: 12 jam, role dicek ulang tiap login

// PIN wajib tiap kirim ke Discord/Telegram. Salah 5x = kunci 10 menit per IP.
async function checkSendPin(req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const failKey = `pinfail:${ip}`;
  const want = process.env.SEND_PIN;
  if (!want) return { ok: false, status: 500, error: 'SEND_PIN belum di-set' };

  const fails = Number(await redis.get(failKey)) || 0;
  if (fails >= 5) return { ok: false, status: 429, error: 'Terlalu banyak PIN salah, coba lagi 10 menit lagi' };

  const h = (s) => crypto.createHash('sha256').update(String(s)).digest();
  const given = String(req.headers['x-send-pin'] || '');
  if (!given || !crypto.timingSafeEqual(h(given), h(want))) {
    await redis.incr(failKey);
    await redis.expire(failKey, 600);
    return { ok: false, status: 401, error: 'PIN salah' };
  }
  await redis.del(failKey);
  return { ok: true };
}

  module.exports = async function handler(req, res) {
  try {
    return await _handler(req, res);
  } catch (e) {
    console.error('[admin-airdrop] FATAL:', e);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Internal error', detail: e.message });
    }
  }
};

async function _handler(req, res) {
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!MAINTENANCE && (!SUPA_URL || !SUPA_KEY)) {
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
    const { title, description, image_base64, url, source, mention_everyone, queue_id } = req.body || {};
       if (!title) return res.status(400).json({ error: 'title wajib diisi' });
    const everyone = Boolean(mention_everyone) && roleOf(session) === 'admin';

     if (roleOf(session) === 'member' && url && !/^https:\/\/(x\.com|twitter\.com|t\.me)\//i.test(String(url))) {
      return res.status(400).json({ error: 'URL tidak diizinkan' });
    }

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

    const LOGO_URL = 'https://airdropxi.vercel.app/logo1.png';

  const LINKS = {
  tiktok:   'https://tiktok.com/@hellovry',
  telegram: 'https://t.me/CryptoMonk3y',
  ourbit:   'https://www.ourbit.com/register?inviteCode=ourbitCMIC',
};

    const embed = {
    author: { name: '🗣 CMIC BROADCAST', icon_url: LOGO_URL },
    title: String(title).slice(0, 256),
    description:
      String(description || '').slice(0, 3700) +
      '\n\u200b\n\u200b\n' +
      `**COMMUNITY**\n` +
      `[TikTok](${LINKS.tiktok}) • [Telegram](${LINKS.telegram})\n\u200b\n` +
      `**TRADING PLATFORMS**\n` +
      `[Ourbit](${LINKS.ourbit})`,
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
     if (dRes.ok && everyone) {
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
      { text: 'COMMUNITY', callback_data: 'noop' },
    ],
    [
      { text: 'TikTok', url: 'https://tiktok.com/@hellovry', style: 'primary' },
      { text: 'Discord', url: 'https://t.me/Hell0vry?text=Halo%20Bang%2C%20saya%20ingin%20bergabung%20ke%20komunitas%20Discord%20Crypto%20Monkey.%20Mohon%20info%20langkah%20pendaftarannya%20ya.%20Terima%20kasih%20%F0%9F%99%8F', style: 'primary' },
    ],
    [
      { text: 'TRADING PLATFORMS', callback_data: 'noop' },
    ],
    [
      { text: 'Ourbit', url: 'https://www.ourbit.com/register?inviteCode=ourbitCMIC', style: 'primary' },
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

    // kalau dikirim dari antrian News Terminal, tandai "sent" biar nggak bisa kekirim dobel
       if (anyOk && queue_id) {
      try {
        await redis.sadd('news:sent', String(queue_id));
        await redis.expire('news:sent', 60 * 60 * 24 * 6);
      } catch (e) {
        console.warn('[news-queue] gagal tandai sent:', e.message);
      }
    }
    return res.status(anyOk ? 200 : 500).json(results);
      }
  // ─── DISCORD OAUTH (hanya member server + role tertentu) ───
  async function handleDiscordAuth(req, res, step) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method tidak diizinkan' });

    const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_GUILD_ID, DISCORD_ROLE_IDS } = process.env;
    const SITE = (process.env.SITE_URL || 'https://airdropxi.vercel.app').replace(/\/$/, '');
    const REDIRECT = `${SITE}/api/admin-airdrop?type=discord-callback`;
    const STATE_COOKIE = 'Path=/api/admin-airdrop; HttpOnly; Secure; SameSite=Lax';
    const back = (code) => res.redirect(302, `/?login_error=${code}`);

    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !DISCORD_GUILD_ID || !DISCORD_ROLE_IDS) return back('config');

      // 1) arahkan ke Discord
    if (step === 'discord-login') {
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
      let allowed = true;
      try {
        ({ success: allowed } = await ratelimit.limit(`discord:${ip}`));
      } catch (e) {
        console.error('[ratelimit] redis error, skip limiter:', e.message);
      }
      if (!allowed) return back('ratelimit');

      const state = crypto.randomBytes(16).toString('hex');
      addCookie(res, `discord_state=${state}; ${STATE_COOKIE}; Max-Age=600`);
      const qs = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID, response_type: 'code', redirect_uri: REDIRECT,
        scope: 'identify guilds.members.read', state, prompt: 'none',
      });
      return res.redirect(302, `https://discord.com/oauth2/authorize?${qs}`);
    }

    // 2) callback dari Discord
    const { code, state, error } = req.query;
    const saved = (req.headers.cookie || '').match(/discord_state=([^;]+)/)?.[1];
    addCookie(res, `discord_state=; ${STATE_COOKIE}; Max-Age=0`);
    if (error) return back('cancelled');
    if (!code || !state || !saved || state !== saved) return back('state');

    try {
      const tk = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: DISCORD_CLIENT_ID, client_secret: DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code', code: String(code), redirect_uri: REDIRECT,
        }),
      });
      const tok = await tk.json().catch(() => ({}));
      if (!tk.ok || !tok.access_token) return back('token');

      // data member di server kita (butuh scope guilds.members.read, bot tidak perlu ada di server)
      const mr = await fetch(`https://discord.com/api/users/@me/guilds/${encodeURIComponent(DISCORD_GUILD_ID)}/member`, {
        headers: { Authorization: `Bearer ${tok.access_token}` },
      });
      if (mr.status === 404) return back('not_member');
      if (!mr.ok) return back('discord');
      const member = await mr.json();

      const allowed = DISCORD_ROLE_IDS.split(',').map(s => s.trim()).filter(Boolean);
      if (!member.user?.id || !(member.roles || []).some(r => allowed.includes(r))) return back('no_role');

      issueSession(res, { provider: 'discord', id: member.user.id }, SESSION_MS_DISCORD);
      return res.redirect(302, '/');
    } catch (e) {
      console.error('[discord-auth]', e.message);
      return back('error');
    }
  }

  // ─── SESSION / LOGOUT / DISCORD (publik, di atas cek admin) ───
  if (type === 'session') {
  res.setHeader('Cache-Control', 'no-store');
  const s = verifyAdminToken(req);
  return res.status(200).json({ authenticated: !!s, role: roleOf(s) });
}
  if (type === 'logout') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak diizinkan' });
    clearSession(res);
    return res.status(200).json({ success: true });
  }
  if (type === 'discord-login' || type === 'discord-callback') {
    return await handleDiscordAuth(req, res, type);
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

     // ─── CEX FOUND (userbot Telegram -> dashboard) ───
  if (type === 'cex-found') {
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (req.method === 'POST') {
  const given = Buffer.from(String(req.headers['x-secret'] || ''));
  const want = Buffer.from(process.env.ALERT_SECRET || '');
  if (!want.length || given.length !== want.length || !crypto.timingSafeEqual(given, want))
    return res.status(401).json({ error: 'Unauthorized' });

  const { name, ticker, exchange, networks, ts, msg_id } = req.body || {};
  const clean = (v, n) => String(v ?? '').replace(/[<>]/g, '').trim().slice(0, n);
  const tk = clean(ticker, 15).toUpperCase();
  const ex = clean(exchange, 40);
  if (!tk || !ex) return res.status(400).json({ error: 'Payload tidak valid' });
  const nets = Array.isArray(networks) ? networks.slice(0, 10).map(n => clean(n, 40)).filter(Boolean) : [];
  const evTs = Number(ts) || Date.now();

  // UNKNOWN = ticker ga kebaca, dedup per pesan biar ga saling nimpa
  const key = tk === 'UNKNOWN'
    ? `cexfound:seen:UNKNOWN:${ex.toLowerCase()}:${clean(msg_id, 20) || evTs}`
    : `cexfound:seen:${tk}:${ex.toLowerCase()}`;
  const fresh = await redis.set(key, 1, { nx: true, ex: 86400 });
  if (!fresh) return res.status(200).json({ dup: true });

  await redis.lpush('cexfound:events', JSON.stringify({ name: clean(name, 80), ticker: tk, exchange: ex, networks: nets, ts: evTs }));
  await redis.ltrim('cexfound:events', 0, 99);
  return res.status(200).json({ ok: true });
}

      if (req.method === 'GET') {
        if (!verifyAdminToken(req)) return res.status(401).json({ error: 'Unauthorized' });
        const rows = await redis.lrange('cexfound:events', 0, 29);
        return res.status(200).json(rows.map(r => (typeof r === 'string' ? JSON.parse(r) : r)));
      }
      return res.status(405).json({ error: 'Method tidak diizinkan' });
    } catch (e) {
      return res.status(500).json({ error: serializeError(e) });
    }
  }
  
const session = verifyAdminToken(req);
if (!session) return res.status(401).json({ error: 'Unauthorized' });

if (roleOf(session) === 'member' && !MEMBER_TYPES.includes(type)) {
  return res.status(403).json({ error: 'Khusus admin' });
}

    if (type === 'broadcast-news') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method tidak diizinkan untuk broadcast-news' });
    }
    const pin = await checkSendPin(req);
    if (!pin.ok) return res.status(pin.status).json({ error: pin.error });
    return await handleBroadcastNews(req, res);
  }

    // ─── ONCHAIN TRACER ───
  if (type === 'onchain') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method tidak diizinkan' });
    const { action, chain, address } = req.query;
    res.setHeader('Cache-Control', 'no-store');

    if (action === 'chains') return res.status(200).json(onchain.listChains());
    if (action === 'ping')   return res.status(200).json(await onchain.pingAll());

    if (action === 'labels') {
      try {
        const out = await onchain.labels(chain, String(req.query.addresses || '').split(','), {
          get: async (k) => { const v = await redis.get(k); return v == null ? null : (typeof v === 'string' ? JSON.parse(v) : v); },
          set: (k, v) => redis.set(k, JSON.stringify(v), { ex: 60 * 60 * 24 }),
        });
        return res.status(200).json(out);
      } catch { return res.status(200).json({}); }
    }
        if (action === 'balances') {
  try {
    const addrs = String(req.query.addresses || '').split(',').filter(Boolean);
    return res.status(200).json(await onchain.balances(chain, addrs, req.query.full === '1'));
  } catch (e) {
    console.error('[onchain] balances error:', e);   // ← BARU: kelihatan di Vercel logs
    return res.status(200).json({});
  }
}
        if (action === 'live') {
      try {
        return res.status(200).json(await onchain.live(String(chain || ''), {
          gap: Math.min(Math.max(+req.query.gap || 60, 10), 180),
          min: Math.max(+req.query.min || 250000, 10000),
          price: +req.query.price || 0,
        }));
      } catch (e) {
        return res.status(502).json({ error: e.message });
      }
    }

    try {
      const addr = String(address || '').trim();
      const norm = (chain === 'solana' || chain === 'bitcoin') ? addr : addr.toLowerCase();
      const ckey = `onchain:${chain}:${norm}`;
      const hit = await redis.get(ckey);
      if (hit) return res.status(200).json(typeof hit === 'string' ? JSON.parse(hit) : hit);

      const data = await onchain.lookup(chain, addr);
      await redis.set(ckey, JSON.stringify(data), { ex: 120 }); // cache 2 menit, hemat limit API
      return res.status(200).json(data);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }

      // ─── BTC.D RECORDER (CoinGecko /global gratis cuma nilai sekarang, riwayatnya direkam sendiri) ───
  if (type === 'btcd') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method tidak diizinkan' });
    res.setHeader('Cache-Control', 'no-store');
    try {
      const now = Date.now();
      const last = Number(await redis.get('btcd:last')) || 0;
      if (now - last >= 5 * 60 * 1000) {                       // rekam maks 1 titik / 5 menit
        await redis.set('btcd:last', now, { ex: 3600 });
        try {
          const r = await fetch('https://api.coingecko.com/api/v3/global', { headers: { accept: 'application/json' } });
          if (r.ok) {
            const dom = (await r.json())?.data?.market_cap_percentage?.btc;
            if (typeof dom === 'number') {
              await redis.rpush('btcd:hist', JSON.stringify([Math.floor(now / 1000), +dom.toFixed(4)]));
              await redis.ltrim('btcd:hist', -20000, -1);      // simpan ±2 bulan
            }
          }
        } catch (e) { console.warn('[btcd] gagal ambil CoinGecko:', e.message); }
      }
      const rows = await redis.lrange('btcd:hist', 0, -1);
      const pts = rows.map(r => (typeof r === 'string' ? JSON.parse(r) : r)).filter(Array.isArray);
      return res.status(200).json(pts);
    } catch (e) {
      return res.status(500).json({ error: serializeError(e) });
    }
  }

    // ─── TOKEN UNLOCKS (dataset emissions DefiLlama, cache Redis) ───
  if (type === 'token-unlocks') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method tidak diizinkan' });
    res.setHeader('Cache-Control', 'no-store');   // route di belakang cookie admin, jangan di-cache CDN

    const DEFAULT_WATCH = ['aptos', 'arbitrum-foundation', 'optimism-foundation', 'sui-foundation', 'celestia',
      'layerzero', 'hyperliquid', 'berachain', 'monad', 'ethena', 'jupiter', 'pyth', 'sei', 'zksync-era',
      'pendle', 'eigencloud', 'jito', 'movement', 'grass', 'aster', 'kaito', 'walrus-protocol', 'initia', 'ondo-finance'];
    const picked = String(req.query.slugs || '').split(',').map(s => s.trim().toLowerCase())
      .filter(s => /^[a-z0-9.\-]{1,60}$/.test(s)).slice(0, 40);
    const watch = picked.length ? picked : DEFAULT_WATCH;
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 180);

    const DAY = 86400, now = Math.floor(Date.now() / 1000), today = now - (now % DAY);
    const cget = async (k) => { try { const v = await redis.get(k); return v == null ? null : (typeof v === 'string' ? JSON.parse(v) : v); } catch { return null; } };
    const cset = async (k, v, ex) => { try { await redis.set(k, JSON.stringify(v), { ex }); } catch {} };

    // payload asli besar (data harian sejak 2022): ringkas jadi kenaikan "unlocked" ke depan saja
    const compact = (d) => {
      const all = (d?.documentedData?.data || []).map(c => {
        const pts = (c.data || []).slice().sort((a, b) => a.timestamp - b.timestamp);
        const ev = [];
        for (let i = 1; i < pts.length; i++) {
          const delta = (pts[i].unlocked || 0) - (pts[i - 1].unlocked || 0);
          if (delta > 0 && pts[i].timestamp >= now) ev.push([pts[i].timestamp, delta]);
        }
        return { label: c.label || 'Lainnya', last: pts.length ? (pts[pts.length - 1].unlocked || 0) : 0, ev };
      });
      return { grand: all.reduce((s, c) => s + c.last, 0), cats: all.filter(c => c.ev.length).map(c => ({ label: c.label, ev: c.ev })) };
    };

    const loadSlug = async (slug, budget) => {
      const key = `unlocks:v1:${slug}`;
      const hit = await cget(key);
      if (hit) return hit;
      try {
        if (budget < 800) throw new Error('waktu habis');
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), Math.min(budget, 8000));
        const r = await fetch(`https://defillama-datasets.llama.fi/emissions/${encodeURIComponent(slug)}`, { signal: ctrl.signal });
        if (!r.ok) { clearTimeout(timer); throw new Error('llama ' + r.status); }
        const out = compact(await r.json());
        clearTimeout(timer);
        out.slug = slug;
        await cset(key, out, 3 * 3600);               // segar 3 jam
        await cset(key + ':stale', out, 7 * 86400);   // cadangan kalau sumber mati
        return out;
      } catch (e) {
        const stale = await cget(key + ':stale');
        if (stale) return stale;
        throw e;
      }
    };

    // 5 request paralel, berhenti nunggu setelah ~7 detik (batas function Vercel); sisanya dimuat di panggilan berikutnya
    const deadline = Date.now() + 7000;
    const queue = watch.slice(), loaded = [], missing = [];
    const worker = async () => {
      while (queue.length) {
        const slug = queue.shift();
        try { loaded.push(await loadSlug(slug, deadline - Date.now())); } catch { missing.push(slug); }
      }
    };
    await Promise.all(Array.from({ length: 5 }, worker));

    const end = now + days * DAY, items = [];
    for (const s of loaded) {
      const grand = s.grand || 1;
      for (const c of s.cats) {
        const win = c.ev.filter(([t]) => t >= today && t <= end);
        if (!win.length) continue;
        const linear = win.length >= 3 && win[1][0] - win[0][0] === DAY && win[2][0] - win[1][0] === DAY;
        if (linear) {   // unlock harian: ringkas jadi 1 baris
          const amount = win.reduce((a, [, v]) => a + v, 0);
          items.push({ slug: s.slug, cat: c.label, ts: win[0][0], amount, pct: (amount / grand) * 100, kind: 'linear', span: win.length });
        } else {
          win.forEach(([t, v]) => items.push({ slug: s.slug, cat: c.label, ts: t, amount: v, pct: (v / grand) * 100, kind: 'cliff', span: 1 }));
        }
      }
    }
    items.sort((a, b) => a.ts - b.ts || b.pct - a.pct);
    return res.status(200).json({ items: items.slice(0, 500), missing, loaded: loaded.length, total: watch.length });
  }
  
  // ─── RSS FEED (kolom berita publik untuk News Terminal) ───
  if (type === 'feed') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method tidak diizinkan' });
    res.setHeader('Cache-Control', 'no-store');

    const FEEDS = {
      id: {
        antara: 'https://www.antaranews.com/rss/ekonomi.xml',
        cnbcid: 'https://www.cnbcindonesia.com/market/rss',
        detik:  'https://finance.detik.com/rss',
        kontan: 'https://www.kontan.co.id/rss',
      },
      crypto: {
        coindesk: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
        decrypt:  'https://decrypt.co/feed',
        theblock: 'https://www.theblock.co/rss.xml',
      },
    };
    const group = FEEDS[String(req.query.src || '')];
    if (!group) return res.status(400).json({ error: 'src harus id atau crypto' });

    const ckey = `feed:v1:${req.query.src}`;
    try {
      const hit = await redis.get(ckey);
      if (hit) return res.status(200).json(typeof hit === 'string' ? JSON.parse(hit) : hit);
    } catch {}

    const strip = (s) => String(s || '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/&#0?39;|&apos;/g, "'").replace(/&amp;/g, '&')
      .trim();

    const pull = async (src, url) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      try {
        const r = await fetch(url, {
          signal: ctrl.signal,
          headers: { 'user-agent': 'Mozilla/5.0 (compatible; XiobaiiBot/1.0)', accept: 'application/rss+xml, application/xml, text/xml' },
        });
        if (!r.ok) return [];
        const xml = await r.text();
        const out = [];
        for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)) {
          const b = m[0];
          const tag = (n) => (b.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`)) || [])[1];
          const title = strip(tag('title')), link = strip(tag('link')), ts = Date.parse(strip(tag('pubDate')));
          if (!title || !/^https?:\/\//.test(link) || !ts) continue;
          out.push({ src, title, link, ts });
          if (out.length >= 25) break;
        }
        return out;
      } catch { return []; } finally { clearTimeout(t); }
    };

    const lists = await Promise.all(Object.entries(group).map(([s, u]) => pull(s, u)));
    const items = lists.flat().sort((a, b) => b.ts - a.ts);
    if (items.length) { try { await redis.set(ckey, JSON.stringify(items), { ex: 300 }); } catch {} }
    return res.status(200).json(items);
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
    const WebSocket = require('ws'); 
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
      const URLS = [
        'wss://ws.newlistings.pro/v2/full',
        'wss://ws.newlistings.pro/v2/full?exchange=upbit&market_type=spot,caution-spot',
      ];

      let ended = false;
      const sockets = [];
      const keepAlive = setInterval(() => res.write(': ping\n\n'), 15000);
      const maxLife = setTimeout(end, 270000); // tutup sebelum limit, browser auto-reconnect

      function end() {
        if (ended) return;
        ended = true;
        clearInterval(keepAlive);
        clearTimeout(maxLife);
        sockets.forEach(w => { try { w.terminate(); } catch {} });
        res.end();
        resolve();
      }

      URLS.forEach((url, i) => {
        const ws = new WebSocket(url, {
          headers: { authorization: `Bearer ${nlfKey}` },
          handshakeTimeout: 10000,
        });
        sockets.push(ws);

        ws.on('message', (d) => {
          let m; try { m = JSON.parse(d.toString()); } catch { return; }
          if (i === 1 && m.type !== 'announcement' && m.type !== 'tweet') return; // READY socket Upbit jangan dobel
          send(m);
          saveNLFEvent(m);
        });
        ws.on('unexpected-response', (_q, r) => {
          r.resume();
          if (i === 0) {                       // socket utama gagal auth = putus semua
            send({ type: 'error', code: 'AUTHENTICATION_FAILED', status: r.statusCode });
            end();
          }                                    // socket Upbit gagal = feed utama tetap jalan
        });
        ws.on('error', () => {});
        ws.on('close', () => { if (i === 0) end(); });
      });

      req.on('close', end);
    });
   }   
       // ─── AIRDROPS: baca dari file JSON (tanpa Supabase) ───
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');

    if (!id) {
      const list = [...getAirdrops()].sort((a, b) =>
        String(b.created_at).localeCompare(String(a.created_at)));
      return res.status(200).json(list);
    }

    const row = getAirdrops().find(a => String(a.id) === String(id));
    if (!row) return res.status(404).json({ error: 'Project tidak ditemukan' });
    return res.status(200).json({ ...row, view_count: row.view_count || 0 });
  }

    // SEMENTARA: putus semua akses ke Supabase sampai DB sehat
  if (MAINTENANCE) {
    return res.status(503).json({ error: 'Maintenance: database sedang dipulihkan' });
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
