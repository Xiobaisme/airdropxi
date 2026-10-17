// Webhook bot: hanya admin yang dibalas tombol Mini App.
const { ADMIN_IDS } = require('../lib/tg-auth');

module.exports = async (req, res) => {
  if (req.headers['x-telegram-bot-api-secret-token'] !== process.env.WEBHOOK_SECRET)
    return res.status(401).end();

  const msg = req.body && req.body.message;
  if (msg && msg.chat.type === 'private' && ADMIN_IDS().includes(String(msg.from.id))) {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: msg.chat.id,
        text: 'Buka editor broadcast:',
        reply_markup: { inline_keyboard: [[
          { text: '🖼 Buka Editor', web_app: { url: process.env.MINIAPP_URL } }
        ]] }
      })
    });
  }
  // Non-admin: diabaikan tanpa balasan.
  res.status(200).json({ ok: true });
};