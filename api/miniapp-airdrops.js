// api/miniapp-airdrops.js
const { authAdmin } = require('../lib/tg-auth');
const { Redis } = require('@upstash/redis');
const { loadAirdrops, saveAirdrops } = require('../lib/airdropStore');

const redis = Redis.fromEnv();
const FIELDS = ['name', 'status', 'confirmation_status', 'link', 'website_url',
  'tags', 'RaisedID', 'RaisedEN', 'tasksID', 'tasksEN'];

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!authAdmin(req.headers['x-telegram-init-data'])) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }

  try {
    const list = await loadAirdrops(redis);
    const body = req.body || {};

    if (req.method === 'GET') {
      return res.status(200).json(
        [...list].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      );
    }

    if (req.method === 'POST') {            // tambah / update (kalau ada id)
      const name = String(body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'name wajib diisi' });

      const clean = {};
      for (const f of FIELDS) if (f in body) clean[f] = body[f] === '' ? null : body[f];
      clean.name = name;
      if ('published' in body) clean.published = Boolean(body.published);

      const idx = body.id != null ? list.findIndex(a => String(a.id) === String(body.id)) : -1;
      if (idx >= 0) {
        if (Array.isArray(list[idx].tags) && typeof clean.tags === 'string')
          clean.tags = clean.tags.split(',').map(s => s.trim()).filter(Boolean);
        list[idx] = { ...list[idx], ...clean };
      } else {
        const nums = list.map(a => Number(a.id)).filter(Number.isFinite);
        const newId = nums.length ? Math.max(...nums) + 1 : 1;
        if (typeof clean.tags === 'string' && list.some(a => Array.isArray(a.tags)))
          clean.tags = clean.tags.split(',').map(s => s.trim()).filter(Boolean);
        list.push({ published: false, ...clean, id: newId, created_at: new Date().toISOString() });
      }
      await saveAirdrops(redis, list);
      return res.status(200).json({ ok: true, total: list.length });
    }

    if (req.method === 'DELETE') {
      const next = list.filter(a => String(a.id) !== String(req.query.id));
      if (next.length === list.length) return res.status(404).json({ error: 'Tidak ditemukan' });
      await saveAirdrops(redis, next);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method tidak diizinkan' });
  } catch (e) {
    console.error('[miniapp-airdrops]', e);
    return res.status(500).json({ error: 'Internal error' });
  }
};