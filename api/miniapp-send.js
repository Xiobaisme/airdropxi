// Terima gambar final (sudah di-render di Mini App) lalu broadcast.
const { authAdmin } = require('../lib/tg-auth');

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const user = authAdmin(req.headers['x-telegram-init-data']);
  if (!user) return res.status(403).json({ error: 'Akses ditolak' });

  const { title, description = '', image } = req.body || {};
  if (!title || !image) return res.status(400).json({ error: 'Judul dan gambar wajib diisi' });
  const buf = Buffer.from(image.replace(/^data:image\/\w+;base64,/, ''), 'base64');

  const result = { telegram: [], discord: null };

  // Telegram (caption maks 1024 karakter)
  let caption = `<b>${esc(title)}</b>` + (description ? `\n\n${esc(description)}` : '');
  if (caption.length > 1024) caption = caption.slice(0, 1020) + '…';
  const channels = (process.env.TELEGRAM_CHANNEL_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  for (const chat of channels) {
    const fd = new FormData();
    fd.append('chat_id', chat);
    fd.append('caption', caption);
    fd.append('parse_mode', 'HTML');
    fd.append('photo', new Blob([buf], { type: 'image/jpeg' }), 'image.jpg');
    const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendPhoto`, { method: 'POST', body: fd });
    result.telegram.push({ chat, ok: r.ok });
  }

  // Discord webhook (embed + gambar)
  if (process.env.DISCORD_WEBHOOK_URL) {
    const fd = new FormData();
    fd.append('payload_json', JSON.stringify({
      embeds: [{ title: title.slice(0, 256), description: description.slice(0, 4000),
                 color: 0x3b82f6, image: { url: 'attachment://image.jpg' } }]
    }));
    fd.append('files[0]', new Blob([buf], { type: 'image/jpeg' }), 'image.jpg');
    const r = await fetch(process.env.DISCORD_WEBHOOK_URL, { method: 'POST', body: fd });
    result.discord = r.ok;
  }

  const ok = result.telegram.every(t => t.ok) && result.discord !== false;
  res.status(ok ? 200 : 502).json(result);
};

module.exports.config = { api: { bodyParser: { sizeLimit: '4mb' } } };