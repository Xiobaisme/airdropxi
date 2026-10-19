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

// ── Prank non-admin ──
// Tahap per user disimpan di memori. Kalau instance Vercel restart, prank mulai dari awal (aman).
const stage = new Map(); // userId -> 'passed' | 'denied'

const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
function makeChallenge() {
  const t = rnd(0, 2);
  let q, ans;
  if (t === 0) { const a = rnd(12, 49), b = rnd(12, 49); q = `${a} + ${b}`; ans = a + b; }
  else if (t === 1) { const a = rnd(40, 99), b = rnd(11, 39); q = `${a} - ${b}`; ans = a - b; }
  else { const a = rnd(3, 12), b = rnd(3, 12); q = `${a} × ${b}`; ans = a * b; }
  const opts = new Set([ans]);
  while (opts.size < 4) { const d = rnd(-9, 9); if (d && ans + d > 0) opts.add(ans + d); }
  const buttons = [...opts].sort(() => Math.random() - 0.5)
    .map(o => ({ text: String(o), callback_data: o === ans ? 'v:1' : 'v:0' }));
  return { q, buttons };
}

const SAVAGE = [
  'Sudah dibilang kurang ganteng. Ngetik /start seratus kali pun mukamu tidak ikut ter-upgrade.',
  'Kamu masih di sini? Cermin di rumahmu pasti sudah menyerah.',
  'Matematikanya lolos, mukanya yang tidak. Dunia memang tidak adil.',
  'Bot ini punya standar. Kamu belum sampai.',
  'Coba lagi besok. Itu pun kalau ada perubahan signifikan di wajah.',
  'Sistem sudah memutuskan. Tidak ada banding, tidak ada remedial.',
  'Gigihmu patut diacungi jempol. Gantengmu yang belum.',
  'Udah, tidur aja. Hasilnya tidak akan berubah, mukamu juga.',
];

// Prompt poster siap salin. Ganti hanya bagian "JUDUL BERITA DI SINI".
const POSTER_PROMPT = `Buat poster berita crypto profesional bergaya fotojurnalistik editorial: dramatis, realistis, premium, high-contrast. Rasio 4:5 vertikal.

JUDUL BERITA:
"JUDUL BERITA DI SINI"

Pahami makna dan konteks judul terlebih dahulu, lalu pilih SATU objek utama yang paling kuat mewakili inti beritanya sebagai hero image. Jangan memakai lebih dari satu objek utama agar fokus visual tidak terpecah.

1. HERO IMAGE (±60% bagian atas)
- Satu objek utama yang realistis, tajam, dan relevan dengan berita.
- Gaya fotografi studio / jurnalistik: pencahayaan sinematik, detail tajam, depth of field profesional.
- Palet dominan hitam pekat (#050505) dengan aksen biru #1E50FF. Hindari warna-warni.
- Bagian bawah hero memudar lewat gradient gelap yang sangat halus langsung menyatu ke panel teks, tanpa hard cut, garis pemisah, atau batas kotak.
- Area tengah-bawah hero dibiarkan bersih dan gelap, tanpa objek atau detail penting (akan diisi elemen lain secara manual).

2. HEADLINE (di tengah panel gelap, bukan di dasar poster)
- Font wajib sama di semua poster: Roboto Condensed Bold. Jangan mengganti font, ketebalan, atau lebar huruf.
- Semua huruf kapital, rata kiri, line-height rapat (±1.0), letter-spacing normal, margin kiri-kanan sama dan aman.
- Baris biasa berwarna putih #FFFFFF dengan ukuran seragam.
- Satu frasa terpenting (focal point) berwarna biru #1E50FF, sekitar 1.4x lebih besar dari baris lain, dengan font yang sama persis.
- Teks tegak lurus: tanpa italic, tanpa perspektif miring, tanpa teks terpotong atau bertabrakan.
- Hierarki hanya lewat ukuran dan warna. Tanpa glow, outline, shadow, atau efek 3D.

3. PANEL & FINISH
- Panel teks hitam pekat #050505 dengan kontras tinggi terhadap tipografi.
- Biru #1E50FF hanya untuk frasa focal point dan aksen penting.

4. TIDAK BOLEH ADA
Logo, nama brand dalam bentuk teks apa pun, watermark, teks selain headline, garis dekoratif, QR code, ikon tambahan, elemen UI, frame atau border, subheadline, tanggal, sumber berita, ticker, dan caption.

HASIL AKHIR
Terasa seperti cover berita media crypto profesional untuk X/Twitter, bukan poster iklan. Prioritas: hierarki visual, keterbacaan headline, hero image yang kuat, transisi gradient halus. Dramatis, premium, editorial, modern, minimalis, dominan hitam dengan aksen biru.`;

module.exports = async (req, res) => {
  if (req.headers['x-telegram-bot-api-secret-token'] !== process.env.WEBHOOK_SECRET)
    return res.status(401).end();

  const body = req.body || {};

  // Tombol judul di post channel (COMMUNITY / TRADING PLATFORMS) memakai callback 'noop'.
  // Harus dijawab supaya tombolnya tidak loading terus. Tombol menu lama (sudah dihapus) diberi tahu.
  const q = body.callback_query;
  if (q) {
      if (q.data === 'prompt') {
    if (ADMIN_IDS().includes(String(q.from.id))) {
      await call('answerCallbackQuery', {
        callback_query_id: q.id,
        text: 'Prompt dikirim. Tap untuk salin, lalu ganti bagian JUDUL.',
      }).catch(() => {});
      await call('sendMessage', {
        chat_id: q.message.chat.id,
        text: `<pre>${esc(POSTER_PROMPT)}</pre>`,
        parse_mode: 'HTML',
      });
    } else {
      await call('answerCallbackQuery', {
        callback_query_id: q.id, text: 'Khusus admin.', show_alert: true,
      }).catch(() => {});
    }
    return res.status(200).json({ ok: true });
  }

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
      // ?v=... supaya Telegram tidak memakai halaman miniapp lama dari cache
      const url = `${MINIAPP_URL}?v=${Date.now()}`;

      // Tombol "Editor" (Mini App) di samping kolom ketik
      await call('setChatMenuButton', {
        chat_id,
        menu_button: { type: 'web_app', text: 'Editor', web_app: { url } },
      }).catch(() => {});

      const name = msg.from.first_name || msg.from.username || 'Admin';
      await call('sendMessage', {
        chat_id,
        text: `Hallo <code>${esc(name)}</code>, tekan tombol di bawah untuk membuka Editor.`,
        parse_mode: 'HTML',
           reply_markup: { inline_keyboard: [[
          { text: '🚀 Buka Editor', web_app: { url } },
          { text: '📋 Prompt Poster', callback_data: 'prompt' },
        ]] },
      });
    } else {
      // Bukan admin: catat di log Vercel + balas pedas (tanpa tombol apa pun)
      console.log('[tg] ditolak:', msg.from.id, msg.from.username || '-');
      await call('sendMessage', { chat_id, text: pick(ROASTS) });
    }
  }
  res.status(200).json({ ok: true });
};