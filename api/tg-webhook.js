// Webhook bot: admin dapat editor, selain admin dapat balasan pedas.
const { ADMIN_IDS } = require('../lib/tg-auth');

const API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const call = (method, body) => fetch(`${API()}/${method}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

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

  const msg = req.body && req.body.message;
  if (msg && msg.chat.type === 'private') {
    const chat_id = msg.chat.id;

    if (ADMIN_IDS().includes(String(msg.from.id))) {
      const url = process.env.MINIAPP_URL;

      // Tombol "Editor" permanen di samping kolom ketik
      await call('setChatMenuButton', {
        chat_id, menu_button: { type: 'web_app', text: 'Editor', web_app: { url } },
      }).catch(() => {});

      const caption = '<b>CMIC Newswire</b>\nBroadcast ke Discord & Telegram dari satu tempat.\n\nTambah logo, atur posisi, lalu kirim.';
      const reply_markup = { inline_keyboard: [[{ text: 'Buka Editor', web_app: { url }, style: 'primary' }]] };

      // Pakai logo sebagai gambar; kalau gagal, kirim teks saja
      const r = await call('sendPhoto', {
        chat_id, photo: 'https://airdropxi.vercel.app/logo1.png', caption, parse_mode: 'HTML', reply_markup,
      });
      if (!r.ok) await call('sendMessage', { chat_id, text: caption, parse_mode: 'HTML', reply_markup });
    } else {
      // Bukan admin: catat di log Vercel + balas pedas (tanpa tombol apa pun)
      console.log('[tg] ditolak:', msg.from.id, msg.from.username || '-');
      await call('sendMessage', { chat_id, text: pick(ROASTS) });
    }
  }
  res.status(200).json({ ok: true });
};