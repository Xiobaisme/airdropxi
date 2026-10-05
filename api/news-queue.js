// api/news-queue.js — News Terminal feed (Upstash Redis, retensi 3 hari, tanpa Supabase)
//   POST  -> dipanggil poller (auth: header x-secret = ALERT_SECRET)
//   GET   -> dibaca dashboard admin (auth: cookie admin_token)
const crypto = require('crypto');
const { Redis } = require('@upstash/redis');
const redis = Redis.fromEnv();

const NEWS_TTL = 60 * 60 * 24 * 3; // 3 hari (detik)
const NEWS_LIMIT = 150;            // jumlah berita yang dikirim ke dashboard (makin besar = makin boros bandwidth Redis)

function verifyAdminToken(req) {
  const match = (req.headers.cookie || '').match(/admin_token=([^;]+)/);
  if (!match) return false;
  try {
    const decoded = Buffer.from(decodeURIComponent(match[1]), 'base64').toString();
    const [payload, sig] = decoded.split('.');
    if (!payload || !sig) return false;
    const expected = crypto.createHmac('sha256', process.env.ADMIN_SECRET_KEY).update(payload).digest('hex');
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    return Date.now() < Number(payload.split(':')[0]);
  } catch { return false; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const parse = (r) => (typeof r === 'string' ? JSON.parse(r) : r);
  const clean = (v, n) => String(v ?? '').trim().slice(0, n);

  try {
    // ─── poller push berita baru ───
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
