// Ambil gambar dari Telegram lewat file_id, kembalikan sebagai data URL (same-origin, canvas aman).
const crypto = require('crypto');
const { ADMIN_IDS } = require('../lib/tg-auth');

function verify(initData) {
  const p = new URLSearchParams(initData);
  const hash = p.get('hash'); p.delete('hash');
  if (!hash) return null;
  const str = [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest();
  const calc = crypto.createHmac('sha256', secret).update(str).digest('hex');
  if (calc.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
  try { return JSON.parse(p.get('user')); } catch { return null; }
}

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

module.exports = async (req, res) => {
  const user = verify(req.headers['x-telegram-init-data'] || '');
  if (!user || !ADMIN_IDS().includes(String(user.id))) return res.status(403).json({ error: 'forbidden' });

  const fileId = String((req.body && req.body.file_id) || '');
  if (!fileId) return res.status(400).json({ error: 'file_id kosong' });

  try {
    const tok = process.env.TELEGRAM_BOT_TOKEN;
    const info = await (await fetch(`https://api.telegram.org/bot${tok}/getFile?file_id=${encodeURIComponent(fileId)}`)).json();
    if (!info.ok) return res.status(404).json({ error: 'file tidak ditemukan' });

    const path = info.result.file_path;
    const r = await fetch(`https://api.telegram.org/file/bot${tok}/${path}`);
    if (!r.ok) return res.status(502).json({ error: 'gagal unduh dari Telegram' });

    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 3.3e6) return res.status(413).json({ error: 'gambar terlalu besar, kirim sebagai foto (bukan file) atau pakai galeri' });

    const mime = MIME[path.split('.').pop().toLowerCase()] || 'image/jpeg';
    res.status(200).json({ data_url: `data:${mime};base64,${buf.toString('base64')}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};