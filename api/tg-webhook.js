// Webhook bot: admin dapat tombol untuk membuka Mini App (miniapp.html), selain admin dapat balasan pedas.
const { ADMIN_IDS } = require('../lib/tg-auth');

const API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const call = (method, body) => fetch(`${API()}/${method}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const MINIAPP_URL = (process.env.PUBLIC_BASE_URL || 'https://airdropxi.vercel.app').replace(/\/$/, '') + '/miniapp.html';

// Balasan untuk yang bukan admin (dipilih acak)
const ROASTS = [
  'Bot ini bukan buat kamu. Tombolnya cuma muncul buat yang punya akses, dan kamu bukan salah satunya.',
  'Penasaran boleh, masuk jangan. Balik sana ke kerjaan masing-masing.',
  'Kamu kira ini pintu umum? Ini dapur, bukan warung. Yang boleh masuk cuma yang pegang kunci.',
  'Akses ditolak. Ngetik /start sampai jempol pegel pun hasilnya tetap sama.',
  'Nyasar ya? Baca beritanya di channel aja, jangan ke dapurnya.',
  'Editor ini khusus admin. Mau ikut-ikutan? Bikin bot sendiri sana.',
  'Udah dibilang ditolak, masih dicoba juga. Gigih sih, tapi salah alamat.',
];
const pick = a => a[Math.floor(Math.random() * a.length)];

module.exports = async (req, res) => {
  if (req.headers['x-telegram-bot-api-secret-token'] !== process.env.WEBHOOK_SECRET)
    return res.status(401).end();

  const body = req.body || {};

  // Tombol judul di post channel (COMMUNITY / TRADING PLATFORMS) memakai callback 'noop'.
  // Harus dijawab supaya tombolnya tidak loading terus. Tombol menu lama (sudah dihapus) diberi tahu.
  const q = body.callback_query;
  if (q) {
    const stale = q.data !== 'noop';
    await call('answerCallbackQuery', {
      callback_query_id: q.id,
      ...(stale && { text: 'Menu ini sudah tidak aktif. Ketik /start lagi.', show_alert: true }),
    }).catch(() => {});
    return res.status(200).json({ ok: true });
  }

  const msg = body.message;
  if (msg && msg.chat.type === 'private') {
    const chat_id = msg.chat.id;

    if (ADMIN_IDS().includes(String(msg.from.id))) {
      // Tombol "Editor" (Mini App) di samping kolom ketik
      await call('setChatMenuButton', {
        chat_id,
        menu_button: { type: 'web_app', text: 'Editor', web_app: { url: MINIAPP_URL } },
      }).catch(() => {});

      const name = msg.from.first_name || msg.from.username || 'Admin';
      await call('sendMessage', {
        chat_id,
        text: `Hallo <code>${esc(name)}</code>, tekan tombol di bawah untuk membuka Editor.`,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '🚀 Buka Editor', web_app: { url: MINIAPP_URL } }]] },
      });
    } else {
      // Bukan admin: catat di log Vercel + balas pedas (tanpa tombol apa pun)
      console.log('[tg] ditolak:', msg.from.id, msg.from.username || '-');
      await call('sendMessage', { chat_id, text: pick(ROASTS) });
    }
  }
  res.status(200).json({ ok: true });
};