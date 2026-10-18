// Webhook bot: admin dapat Menu Utama (tombol), selain admin dapat balasan pedas.
const { ADMIN_IDS } = require('../lib/tg-auth');
const handleAdminBot = require('../lib/tg-admin-bot');

const API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const call = (method, body) => fetch(`${API()}/${method}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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

  // Fitur admin (tombol menu, balasan judul/gambar, preview, kirim). true = sudah ditangani.
  try {
    if (await handleAdminBot(req.body)) return res.status(200).json({ ok: true });
  } catch (e) { console.error('[tg] admin-bot:', e); }

  const msg = req.body && req.body.message;
  if (msg && msg.chat.type === 'private') {
    const chat_id = msg.chat.id;

    if (ADMIN_IDS().includes(String(msg.from.id))) {
      // Hapus tombol "Editor" (Mini App) lama di samping kolom ketik
      await call('setChatMenuButton', { chat_id, menu_button: { type: 'default' } }).catch(() => {});

      const name = msg.from.first_name || msg.from.username || 'Admin';
      const text = `🏠 <b>Menu Utama</b>\nHallo: <code>${esc(name)}</code>\n──────────────\nPilih salah satu menu di bawah ini:`;
      const reply_markup = { inline_keyboard: [
        [
          { text: '🎨 Generate Prompt', callback_data: 'cmic:gen' },
          { text: '📣 Broadcast', callback_data: 'cmic:bc', style: 'primary' },
        ],
        [{ text: '🚀 Promo OURBIT', callback_data: 'cmic:promo' }],
      ] };
      await call('sendMessage', { chat_id, text, parse_mode: 'HTML', reply_markup });
    } else {
      // Bukan admin: catat di log Vercel + balas pedas (tanpa tombol apa pun)
      console.log('[tg] ditolak:', msg.from.id, msg.from.username || '-');
      await call('sendMessage', { chat_id, text: pick(ROASTS) });
    }
  }
  res.status(200).json({ ok: true });
};