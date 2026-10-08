// api/news-queue.js — News Terminal feed (Upstash Redis, retensi 3 hari, tanpa Supabase)
//   POST  -> dipanggil poller lama (auth: header x-secret = ALERT_SECRET)
//   GET   -> dibaca dashboard admin (auth: cookie admin_token)
//            + sekalian narik 8 channel Telegram publik lewat t.me/s/<channel> (maks 1x / 60 detik)
const crypto = require('crypto');
const { verifyAdminToken } = require('../lib/auth');
const { Redis } = require('@upstash/redis');
const redis = Redis.fromEnv();

const NEWS_TTL = 60 * 60 * 24 * 3; // 3 hari (detik)
const NEWS_LIMIT = 300;            // jumlah berita yang dikirim ke dashboard (makin besar = makin boros bandwidth Redis)

// key (kiri) HARUS sama dengan key di NEWS_SOURCES milik index.html
const TG_CHANNELS = {
  nansen:        'NansenSmartAlerts',
  cryptomedia:   'cryptocurrency_media',
  smnews:        'SM_News_24h',
  watcherguru:   'WatcherGuru',
  rekt:          'REKTbinance',
  cointelegraph: 'cointelegraph',
  brics:         'bricsnews',
  cryptorank:    'cryptorank_fundraising',
  upbittg:       'upbit_news',
  listingv2:     ['NewListingsFeed', 'NewListingsFeedPlus', 'DelistingsFeed'],  // BARU: 3 channel -> 1 kolom
};

// BARU: penanda asal channel (supaya di 1 kolom kelihatan postingan dari mana)
const TG_TAGS = { NewListingsFeed: 'LISTING', NewListingsFeedPlus: 'LISTING+', DelistingsFeed: 'DELISTING' };

// BARU: ratakan jadi daftar job. Channel lama tetap pakai key lama, jadi data "id terakhir" mereka tidak reset
const TG_JOBS = Object.entries(TG_CHANNELS).flatMap(([src, v]) =>
  (Array.isArray(v) ? v : [v]).map((ch) => ({
    src, ch, multi: Array.isArray(v), key: Array.isArray(v) ? `${src}:${ch}` : src,
  })));

const TG_EVERY_SEC = 60;   // jeda minimal antar penarikan (semua tab berbagi kunci ini)
const TG_PER_PAGE = 20;    // post terakhir yang dilihat per channel
const TG_FIRST_RUN = 10;   // pertama kali jalan: ambil 10 post terbaru saja per channel
const TG_TEXT_MAX = 1200;  // batas karakter per berita Telegram (hemat bandwidth Upstash)
const TG_TIMEOUT = 5000;   // ms per channel

const TG_TRANSLATE = new Set(['upbittg']);   // channel yang diterjemahkan Korea -> Indonesia

async function koToId(text) {
  if (!/[\uac00-\ud7af]/.test(text)) return text;        // nggak ada huruf Korea, biarkan
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(
      'https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=id&dt=t&q=' + encodeURIComponent(text.slice(0, 1500)),
      { signal: ctrl.signal }
    );
    if (!r.ok) return text;
    const j = await r.json();
    const out = (j[0] || []).map((s) => s[0]).join('');
    return out ? `${out}\n\n— Asli (KR) —\n${text}` : text;
  } catch { return text; }
  finally { clearTimeout(timer); }
}

const parse = (r) => (typeof r === 'string' ? JSON.parse(r) : r);
const clean = (v, n) => String(v ?? '').trim().slice(0, n);


// ─── Telegram: HTML preview -> teks biasa ───
function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(+n); } catch { return ''; } })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return ''; } })
    .replace(/&amp;/g, '&');
}

function htmlToText(h) {
  let s = String(h || '')
    // link http(s): kalau teks link bukan URL/@mention/#hashtag, sertakan URL-nya
    .replace(/<a\b[^>]*href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, url, inner) => {
      const txt = inner.replace(/<[^>]+>/g, '').trim();
      return /^(https?:|@|#|\$)/i.test(txt) || !txt ? txt || url : `${txt} ${url}`;
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(s).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function parseChannel(html, channel) {
  const out = [];
  for (const blk of html.split('tgme_widget_message_wrap').slice(1)) {
    const post = blk.match(/data-post="([^"]+)"/);
    if (!post) continue;
    const id = Number(post[1].split('/')[1]);
    if (!id) continue;
    // abaikan teks di kotak "reply", ambil teks utama post
    const tx = blk.match(/<div class="tgme_widget_message_text(?![^"]*reply)[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    if (!tx) continue;                       // post media tanpa teks dilewati
    const text = htmlToText(tx[1]);
    if (!text) continue;
    const tm = blk.match(/<time[^>]*datetime="([^"]+)"/);
    const ms = tm ? Date.parse(tm[1]) : NaN;
    if (!isFinite(ms)) continue;
    out.push({ id, text, ms, link: `https://t.me/${channel}/${id}` });
  }
  return out;
}

// Tarik semua channel paralel. Dedup pakai "id post terakhir per channel" (1 hash),
// jadi tidak butuh ratusan SET per menit.
async function pullTelegram() {
  const got = await redis.set('news:tg:lock', 1, { nx: true, ex: TG_EVERY_SEC });
  if (!got) return;                          // baru ditarik < 60 detik lalu

  const last = (await redis.hgetall('news:tg:last')) || {};

  const results = await Promise.allSettled(TG_JOBS.map(async ({ src, ch, multi, key }) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TG_TIMEOUT);
    try {
      const r = await fetch(`https://t.me/s/${ch}`, {
        signal: ctrl.signal,
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; XiobaiiNews/1.0)', 'accept-language': 'en' },
      });
      if (!r.ok) throw new Error(`${ch} HTTP ${r.status}`);
      const posts = parseChannel(await r.text(), ch).sort((a, b) => a.id - b.id).slice(-TG_PER_PAGE);
      const seen = Number(last[key]) || 0;
      let fresh = posts.filter((p) => p.id > seen && p.ms > Date.now() - NEWS_TTL * 1000);
      if (!seen) fresh = fresh.slice(-TG_FIRST_RUN);
          if (TG_TRANSLATE.has(src)) fresh = await Promise.all(fresh.map(async (x) => ({ ...x, text: await koToId(x.text) })));
      // BARU: sumber multi-channel dikasih tag + id unik (id post antar channel bisa kembar)
      if (multi) fresh = fresh.map((x) => ({ ...x, text: `[${TG_TAGS[ch] || ch}] ${x.text}`, uid: `${src}:${ch}:${x.id}` }));
      return { src, key, fresh, max: posts.length ? posts[posts.length - 1].id : 0, seen };
    } finally { clearTimeout(timer); }
  }));

  const p = redis.pipeline();
  let added = 0;
  const upd = {};
  results.forEach((r) => {
    if (r.status !== 'fulfilled') { console.warn('[news-queue] tg gagal:', r.reason?.message); return; }
        const { src, key, fresh, max, seen } = r.value;
    fresh.forEach((x) => {
      p.zadd('news:queue', {
        score: x.ms,
        member: JSON.stringify({
          id: x.uid || `${src}:${x.id}`,
          source: src,
          text: clean(x.text, TG_TEXT_MAX),
          link: x.link,
          posted_at: new Date(x.ms).toISOString(),
        }),
      });
      added++;
    });
       if (max > seen) upd[key] = max;
  });
  if (added) p.zremrangebyscore('news:queue', 0, Date.now() - NEWS_TTL * 1000); // buang > 3 hari
  if (Object.keys(upd).length) p.hset('news:tg:last', upd);
  if (added || Object.keys(upd).length) await p.exec();
}

// ─── Upbit: hanya listing / delisting / suspend / warning ───
const UPBIT_URL = 'https://api-manager.upbit.com/api/v1/announcements?os=web&page=1&per_page=20&category=all';
const UPBIT_EVERY_SEC = 30;
const UPBIT_RULES = [
  ['DELISTING',   ['거래지원 종료', 'Termination of Market Support', 'Delisting']],
  ['NEW LISTING', ['신규 거래지원', 'Market Support for']],
  ['SUSPENSION',  ['입출금 일시 중단', '거래 일시 중단', '거래지원 일시 중단', 'Temporary Suspension']],
  ['WARNING',     ['유의 종목 지정', '투자유의', 'Investment Warning']],
];
const upbitLabel = (t) => {
  if (/completed|완료|resum|재개/i.test(t)) return null;   // buang pengumuman "selesai/dibuka lagi"
  for (const [label, keys] of UPBIT_RULES) if (keys.some((k) => t.includes(k))) return label;
  return null;
};

async function pullUpbit() {
  const got = await redis.set('news:upbit:lock', 1, { nx: true, ex: UPBIT_EVERY_SEC });
  if (!got) return;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  let list;
  try {
    const r = await fetch(UPBIT_URL, { signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0', accept: 'application/json' } });
    if (!r.ok) throw new Error('upbit HTTP ' + r.status);
    list = (await r.json())?.data?.notices || [];
  } finally { clearTimeout(timer); }

  const seen = Number(await redis.get('news:upbit:last2')) || 0;
  const all = list.map((n) => ({
    id: Number(n.id), title: String(n.title || ''),
    ms: Date.parse(n.listed_at || n.first_listed_at),
  })).filter((n) => n.id && isFinite(n.ms));

  let fresh = all
    .map((n) => ({ ...n, label: upbitLabel(n.title) }))
    .filter((n) => n.label && n.id > seen && n.ms > Date.now() - NEWS_TTL * 1000)
    .sort((a, b) => a.id - b.id);
  if (!seen) fresh = fresh.slice(-5);

  const maxId = Math.max(seen, ...all.map((n) => n.id));
  const p = redis.pipeline();
  fresh.forEach((n) => p.zadd('news:queue', {
    score: n.ms,
    member: JSON.stringify({
      id: `upbit:${n.id}`,
      source: 'upbit',
      text: `[${n.label}] ${n.title}`,
      link: `https://upbit.com/service_center/notice?id=${n.id}`,
      posted_at: new Date(n.ms).toISOString(),
    }),
  }));
 if (maxId > seen) p.set('news:upbit:last2', maxId);
  await p.exec();
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    // ─── poller lama push berita baru ───
    if (req.method === 'POST') {
      const given = Buffer.from(String(req.headers['x-secret'] || ''));
      const want = Buffer.from(process.env.ALERT_SECRET || '');
      if (!want.length || given.length !== want.length || !crypto.timingSafeEqual(given, want))
        return res.status(401).json({ error: 'Unauthorized' });

      const { source, text, link, posted_at, msg_id } = req.body || {};
      const src = clean(source, 30).toLowerCase();
      const body = clean(text, 3500);
      if (!src || !body) return res.status(400).json({ error: 'Payload tidak valid' });

      const mid = clean(msg_id, 30) || crypto.createHash('sha1').update(body).digest('hex').slice(0, 16);

      // dedup: pesan yang sama nggak masuk dua kali
      const fresh = await redis.set(`news:seen:${src}:${mid}`, 1, { nx: true, ex: NEWS_TTL });
      if (!fresh) return res.status(200).json({ dup: true });

      const ms = Number(posted_at) || Date.now();
      const item = {
        id: `${src}:${mid}`,
        source: src,
        text: body,
        link: /^https?:\/\//.test(link || '') ? clean(link, 500) : '',
        posted_at: new Date(ms).toISOString(),
      };

      await redis.zadd('news:queue', { score: ms, member: JSON.stringify(item) });
      await redis.zremrangebyscore('news:queue', 0, Date.now() - NEWS_TTL * 1000); // buang > 3 hari
      return res.status(200).json({ ok: true });
    }

    // ─── dashboard baca antrian ───
    if (req.method === 'GET') {
      if (!verifyAdminToken(req)) return res.status(401).json({ error: 'Unauthorized' });

      // tarik Telegram dulu; kalau gagal, dashboard tetap dapat berita yang sudah ada
      const pulls = await Promise.allSettled([pullTelegram(), pullUpbit()]);
      pulls.forEach((r) => { if (r.status === 'rejected') console.warn('[news-queue] pull:', r.reason?.message); });
      
      const p = redis.pipeline();
      p.zrange('news:queue', 0, NEWS_LIMIT - 1, { rev: true });
      p.smembers('news:sent');
      const [rows, sent] = await p.exec();
      const sentSet = new Set(sent || []);

      return res.status(200).json(
        (rows || []).map(parse).map((r) => ({ ...r, status: sentSet.has(r.id) ? 'sent' : 'pending' }))
      );
    }

    return res.status(405).json({ error: 'Method tidak diizinkan' });
  } catch (e) {
    console.error('[news-queue]', e);
    return res.status(500).json({ error: 'Terjadi kesalahan internal' });
  }
};
