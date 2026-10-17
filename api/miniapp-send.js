// Broadcast ke Telegram + Discord. Format request/response disamakan dengan postBroadcast di web.
const { authAdmin } = require('../lib/tg-auth');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const errOf = async r => { try { return (await r.json()).description || ('HTTP ' + r.status); } catch { return 'HTTP ' + r.status; } };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  if (!authAdmin(req.headers['x-telegram-init-data'])) return res.status(403).json({ error: 'Akses ditolak' });

  const { title, description = '', image_base64, mention_everyone, discord_target } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Judul wajib diisi' });

  const isJpg = (image_base64 || '').startsWith('data:image/jpeg');
  const mime = isJpg ? 'image/jpeg' : 'image/png', name = isJpg ? 'image.jpg' : 'image.png';
  const buf = image_base64 ? Buffer.from(image_base64.replace(/^data:image\/\w+;base64,/, ''), 'base64') : null;
  const out = { discord: 'skip', telegram: 'skip' };

  // ── Telegram ──
  const chats = (process.env.TELEGRAM_CHANNEL_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!chats.length) out.telegram = 'TELEGRAM_CHANNEL_IDS kosong';
  else {
    const text = `<b>${esc(title)}</b>` + (description ? `\n\n${esc(description)}` : '');
    const errs = [];
    for (const chat of chats) {
      let r;
      if (buf) {
        const fd = new FormData();
        fd.append('chat_id', chat);
        fd.append('caption', text.length > 1024 ? text.slice(0, 1020) + '…' : text);
        fd.append('parse_mode', 'HTML');
        fd.append('photo', new Blob([buf], { type: mime }), name);
        r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendPhoto`, { method: 'POST', body: fd });
      } else {
        r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chat, text: text.slice(0, 4096), parse_mode: 'HTML' })
        });
      }
      if (!r.ok) errs.push(`${chat}: ${await errOf(r)}`);
    }
    out.telegram = errs.length ? errs.join('; ') : 'ok';
  }

  // ── Discord ── (discord_target 'ourbit' → webhook khusus; sesuaikan nama env-nya)
  const hook = discord_target === 'ourbit' ? process.env.DISCORD_WEBHOOK_URL_OURBIT : process.env.DISCORD_WEBHOOK_URL;
  if (!hook) out.discord = discord_target === 'ourbit' ? 'DISCORD_WEBHOOK_URL_OURBIT kosong' : 'DISCORD_WEBHOOK_URL kosong';
  else {
    const embed = { title: title.slice(0, 256), description: description.slice(0, 4000), color: 0x3b82f6 };
    if (buf) embed.image = { url: 'attachment://' + name };
    const fd = new FormData();
    fd.append('payload_json', JSON.stringify({
      content: mention_everyone ? '@everyone' : undefined,
      allowed_mentions: { parse: mention_everyone ? ['everyone'] : [] },
      embeds: [embed]
    }));
    if (buf) fd.append('files[0]', new Blob([buf], { type: mime }), name);
    const r = await fetch(hook, { method: 'POST', body: fd });
    out.discord = r.ok ? 'ok' : await errOf(r);
  }

  res.status(200).json(out);
};
module.exports.config = { api: { bodyParser: { sizeLimit: '4mb' } } };