// Fitur admin di bot: /generate (prompt poster), /broadcast (edit logo + kirim), /promo.
// Stateless: state disimpan di Telegram sendiri (force_reply, reply_to_message, callback_data).
// Pakai: const handled = await require('../lib/tg-admin-bot')(req.body); if (handled) return res.status(200).end();
const sharp = require('sharp');
const { broadcast } = require('./tg-broadcast');
const { ADMIN_IDS } = require('./tg-auth');   // whitelist admin yang sama dengan authAdmin

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;
const BASE = (process.env.PUBLIC_BASE_URL || 'https://airdropxi.vercel.app').replace(/\/$/, '');

const P_GEN = '🎨 Judul berita untuk poster?';
const P_BC = '📣 Broadcast';
const TAGS = [['WHALE ALERT','🐋'],['BIG','🔥'],['INSIGHT','💡'],['JUST IN','⚡'],['NEW','🔔'],['BREAKING','🔴'],['ALERT','🚨'],['UPDATE','🔄'],['MARKET','📊'],['ANNOUNCEMENT','📢'],['LATEST','⏳'],['INTERESTING','🌐']];
const POS = [['lt','↖'],['ct','⬆'],['rt','↗'],['lc','⬅'],['cc','⏺'],['rc','➡'],['lb','↙'],['cb','⬇'],['rb','↘']];

const PROMO_TITLE = '🚨 CMIC × OURBIT | TRADE SMARTER, PAY LESS';
const PROMO_BODY = `Masih cari platform trading dengan fee kompetitif + minimum deposit rendah?
Mungkin ini bisa jadi salah satu opsi yang kamu cek.

🔥 OURBIT FEATURES

💰 Deposit mulai $1

💸 Withdrawal mulai $1

📊 Fee mulai 0,02% Maker | 0,04% Taker

🌎 Akses global & likuiditas tinggi

⚡ Proses trading cepat & praktis

🎧 Support 24/7

Buat yang sering trading, biaya transaksi juga bagian dari strategi.
Semakin efisien biaya, semakin banyak ruang untuk mengatur posisi.
🎯 Ready to trade smarter?

🔗 REGISTER OURBIT
https://www.ourbit.com/register?inviteCode=ourbitCMIC

OURBIT × CMIC
Trade smart. Manage risk. DYOR.`;

const PROMPT = (judul) => `Buat poster berita crypto profesional bergaya fotojurnalistik / editorial studio: dramatis, realistis, premium, high-contrast. Rasio 4:5 vertikal.

JUDUL BERITA:
"${judul}"

Analisis makna dan konteks judul terlebih dahulu, lalu pilih satu objek utama yang paling relevan sebagai hero image. Jangan memakai banyak objek utama agar fokus visual tidak terpecah.

1. HERO IMAGE (±60% bagian atas)
- Satu objek utama yang kuat, realistis, dan relevan dengan berita.
- Gaya fotojurnalistik / studio: pencahayaan sinematik, detail tajam, depth of field profesional.
- Dominasi hitam / near-black dengan aksen biru tua neon. Hindari warna-warni.
- Bagian bawah hero memudar lewat dark gradient yang sangat halus langsung ke panel teks.
- Tidak boleh ada hard cut, garis pemisah, atau batas kotak antara hero dan panel teks.
- Area tengah-bawah hero (sekitar batas transisi ke panel teks) dibiarkan bersih dan gelap, tanpa objek atau detail penting, karena akan diisi elemen lain secara manual.

2. HEADLINE (tengah panel gelap, bukan di dasar poster)
- Semua huruf KAPITAL, Extra Bold, Roboto Condensed Bold atau sans-serif condensed terdekat.
- Warna putih, rata kiri, beberapa baris yang rapat dan terkontrol.
- Semua teks tegak lurus: tanpa italic, tanpa perspektif miring.
- Tidak ada teks yang bertabrakan atau terpotong. Beri margin kiri-kanan yang aman.
- Pilih satu baris atau frasa terpenting sebagai focal point: warnai biru tua neon dan buat jelas lebih besar dari baris lain.
- Hierarki cukup lewat perbedaan ukuran dan warna. Tanpa glow besar, outline, shadow berat, atau efek 3D.

3. PANEL & FINISH
- Panel teks hitam pekat / near-black dengan kontras tinggi terhadap tipografi.
- Aksen biru neon hanya untuk elemen penting.

4. YANG TIDAK BOLEH ADA
Logo, nama brand dalam bentuk teks apa pun, watermark, teks apa pun selain headline, garis dekoratif, QR code, ikon tambahan, elemen UI, frame atau border, subheadline, tanggal, sumber berita, ticker, dan caption.

HASIL AKHIR
Terasa seperti cover berita media crypto profesional untuk X/Twitter, bukan poster iklan atau promosi. Prioritas: hierarki visual → keterbacaan headline → hero image kuat → transisi gradient halus. Dramatis, premium, editorial, modern, minimalis, dominan hitam dengan aksen biru tua neon.`;

// ── helpers ──
const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
async function tg(method, body, form) {
  const r = await fetch(`${API}/${method}`, form ? { method: 'POST', body: form }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!d.ok && !/not modified/i.test(d.description || '')) console.error('tg', method, d.description);
  return d;
}
function photoForm(fields, buf, name) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  f.append(name, new Blob([buf], { type: 'image/jpeg' }), 'p.jpg');
  return f;
}
const say = (chat_id, text, extra) => tg('sendMessage', { chat_id, text, parse_mode: 'HTML', ...extra });
const isAdmin = id => ADMIN_IDS().includes(String(id));

async function download(fileId) {
  const f = await tg('getFile', { file_id: fileId });
  if (!f.ok) throw new Error('Gagal mengambil gambar dari Telegram');
  const r = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${f.result.file_path}`);
  return Buffer.from(await r.arrayBuffer());
}
const fileIdOf = m => m.photo ? m.photo[m.photo.length - 1].file_id
  : (m.document && /^image\//.test(m.document.mime_type || '')) ? m.document.file_id : null;

function parseMsg(m) {
  const [first, ...rest] = (m.caption || m.text || '').trim().split('\n');
  return { title: (first || '').trim(), desc: rest.join('\n').trim() };
}
const titleWith = (tag, title) => tag !== '-' && TAGS[+tag] ? `${TAGS[+tag][1]} ${TAGS[+tag][0]}: ${title}` : title;
const caption = (tag, t) => `<b>${esc(titleWith(tag, t.title))}</b>\n\n${esc(t.desc.slice(0, 700))}${t.desc.length > 700 ? '…' : ''}\n\n<i>Preview. Atur lalu tekan Kirim.</i>`;

// ── state tombol: "x:<tag>:<pos>:<size>:<logo>" ──
const parseState = s => { const [tag, pos, size, logo] = s.split(':'); return { tag, pos, size: +size || 40, logo }; };
const enc = (p, s) => `${p}:${s.tag}:${s.pos}:${s.size}:${s.logo}`;
function keyboard(s, hasImg) {
  const b = (text, o) => ({ text, callback_data: enc('x', { ...s, ...o }) });
  const rows = [];
  for (let i = 0; i < TAGS.length; i += 2) rows.push([i, i + 1].filter(j => j < TAGS.length).map(j =>
    b(`${String(j) === s.tag ? '✅' : TAGS[j][1]} ${TAGS[j][0]}`, { tag: String(j) === s.tag ? '-' : String(j) })));
  if (hasImg) {
    rows.push([b(s.logo === '1' ? '🖼 Logo: ON' : '🖼 Logo: OFF', { logo: s.logo === '1' ? '0' : '1' })]);
    if (s.logo === '1') {
      for (let i = 0; i < 9; i += 3) rows.push(POS.slice(i, i + 3).map(([c, a]) => b(s.pos === c ? '🔘' : a, { pos: c })));
      rows.push([b('➖', { size: Math.max(10, s.size - 5) }), b(`${s.size}%`, {}), b('➕', { size: Math.min(100, s.size + 5) })]);
    }
  }
  rows.push([{ text: '✅ Kirim', callback_data: enc('k', s) }, { text: '❌ Batal', callback_data: 'c' }]);
  return { inline_keyboard: rows };
}

// ── render gambar + logo (posisi/ukuran sama seperti editor mini app) ──
let logoCache;
async function logoSvg() {
  if (!logoCache) {
    const r = await fetch(BASE + '/ourbit-cmic.svg');
    if (!r.ok) throw new Error('Logo ourbit-cmic.svg tidak ditemukan di ' + BASE);
    logoCache = Buffer.from(await r.arrayBuffer());
  }
  return logoCache;
}
async function render(buf, s, { maxW, final } = {}) {
  let p = sharp(buf).rotate();
  if (maxW) p = p.resize({ width: maxW, withoutEnlargement: true });
  const { data, info } = await p.toBuffer({ resolveWithObject: true });
  let img = sharp(data);
  if (s.logo === '1') {
    const W = info.width, H = info.height, m = 0.03, [h, v] = s.pos.split('');
    const logo = await sharp(await logoSvg(), { density: 300 })
      .resize({ width: Math.round(W * s.size / 100), height: H, fit: 'inside' }).png().toBuffer();
    const lm = await sharp(logo).metadata();
    const left = h === 'l' ? W * m : h === 'r' ? W - lm.width - W * m : (W - lm.width) / 2;
    const top = v === 't' ? H * m : v === 'b' ? H - lm.height - H * m : (H - lm.height) / 2;
    img = img.composite([{ input: logo, left: Math.max(0, Math.round(left)), top: Math.max(0, Math.round(top)) }]);
  }
  if (final) { const png = await img.clone().png().toBuffer(); if (png.length <= 3.5e6) return { buf: png, mime: 'image/png' }; }
  return { buf: await img.jpeg({ quality: final ? 90 : 85 }).toBuffer(), mime: 'image/jpeg' };
}

// ── alur ──
const askTitle = chat => say(chat, P_GEN, { reply_markup: { force_reply: true, input_field_placeholder: 'Judul berita…' } });
const askBroadcast = chat => say(chat, `${P_BC}\nKirim gambar (paste atau lampirkan) dengan caption:\nbaris 1 = judul, baris berikutnya = deskripsi.\nTanpa gambar? Kirim teks dengan format yang sama.`,
  { reply_markup: { force_reply: true, input_field_placeholder: 'Gambar + caption…' } });
const askPromo = chat => say(chat, 'Kirim promo OURBIT × CMIC ke Discord & Telegram (@everyone di Discord)?',
  { reply_markup: { inline_keyboard: [[{ text: '✅ Kirim', callback_data: 'p:y' }, { text: '❌ Batal', callback_data: 'p:n' }]] } });

async function onMessage(m) {
  if (!isAdmin(m.from && m.from.id) || m.chat.type !== 'private') return false;
  const text = (m.text || '').trim();
  const rt = m.reply_to_message && m.reply_to_message.from && m.reply_to_message.from.is_bot ? (m.reply_to_message.text || '') : '';
  const chat = m.chat.id;
  try {
    if (/^\/(generate|poster)(@\w+)?$/i.test(text)) { await askTitle(chat); return true; }
    if (/^\/broadcast(@\w+)?$/i.test(text)) { await askBroadcast(chat); return true; }
    if (/^\/promo(@\w+)?$/i.test(text)) { await askPromo(chat); return true; }

    if (rt.startsWith(P_GEN)) {
      if (!text) { await askTitle(chat); return true; }
      await say(chat, `🎨 Prompt siap. Tap teks di bawah untuk menyalin, lalu tempel ke generator gambar:\n\n<pre>${esc(PROMPT(text))}</pre>\n\nSetelah gambar jadi, kirim lewat /broadcast.`);
      return true;
    }
    if (rt.startsWith(P_BC)) {
      const t = parseMsg(m);
      if (!t.title) { await say(chat, 'Judul kosong. Ulangi /broadcast, baris pertama = judul.'); return true; }
      const s = { tag: '-', pos: 'lt', size: 40, logo: '1' }, fid = fileIdOf(m), reply_parameters = { message_id: m.message_id };
      if (fid) {
        const out = await render(await download(fid), s, { maxW: 1280 });
        await tg('sendPhoto', null, photoForm({ chat_id: chat, caption: caption(s.tag, t), parse_mode: 'HTML', reply_markup: keyboard(s, true), reply_parameters }, out.buf, 'photo'));
      } else {
        await say(chat, caption(s.tag, t), { reply_markup: keyboard(s, false), reply_parameters });
      }
      return true;
    }
  } catch (e) { console.error('cmic-bot msg', e); await say(chat, '⚠️ ' + esc(e.message)); return true; }
  return false;
}

async function finish(q, text) {
  const msg = q.message, base = { chat_id: msg.chat.id, message_id: msg.message_id, reply_markup: { inline_keyboard: [] } };
  if (msg.photo) await tg('editMessageCaption', { ...base, caption: text, parse_mode: 'HTML' });
  else await tg('editMessageText', { ...base, text, parse_mode: 'HTML' });
}
const report = r => `${r.discord === 'ok' && r.telegram === 'ok' ? '✅' : '⚠️'} <b>Broadcast</b>\nDiscord: ${esc(r.discord)}\nTelegram: ${esc(r.telegram)}`;

async function onCallback(q) {
  const d = q.data || '', ack = (text, alert) => tg('answerCallbackQuery', { callback_query_id: q.id, text, show_alert: !!alert });
  if (d === 'noop') { await ack(); return true; }   // tombol judul di post channel
  if (!/^(cmic:|x:|k:|c$|p:)/.test(d)) return false;
  if (!isAdmin(q.from.id)) { await ack('Khusus admin', true); return true; }
  const msg = q.message, chat = msg.chat.id;
  try {
    if (d === 'cmic:gen') { await ack(); await askTitle(chat); return true; }
    if (d === 'cmic:bc') { await ack(); await askBroadcast(chat); return true; }
    if (d === 'cmic:promo') { await ack(); await askPromo(chat); return true; }
    if (d === 'c' || d === 'p:n') { await ack(); await tg('deleteMessage', { chat_id: chat, message_id: msg.message_id }); return true; }

    if (d === 'p:y') {
      await ack('Mengirim…');
      const r = await fetch(BASE + '/ourbit-promo.png'); if (!r.ok) throw new Error('Gambar promo tidak ditemukan');
      const res = await broadcast({ title: PROMO_TITLE, description: PROMO_BODY, image: Buffer.from(await r.arrayBuffer()), mime: 'image/png', everyone: true, target: 'ourbit' });
      await tg('editMessageText', { chat_id: chat, message_id: msg.message_id, text: report(res), parse_mode: 'HTML' });
      return true;
    }

    // x: ubah preview, k: kirim — keduanya butuh pesan asli (balasan user)
    const orig = msg.reply_to_message;
    if (!orig) { await ack('Pesan asli hilang. Ulangi /broadcast.', true); return true; }
    const s = parseState(d.slice(2)), t = parseMsg(orig), fid = fileIdOf(orig);

    if (d.startsWith('x:')) {
      await ack();
      const cap = caption(s.tag, t), reply_markup = keyboard(s, !!fid);
      if (fid) {
        const out = await render(await download(fid), s, { maxW: 1280 });
        await tg('editMessageMedia', null, photoForm({ chat_id: chat, message_id: msg.message_id,
          media: { type: 'photo', media: 'attach://p', caption: cap, parse_mode: 'HTML' }, reply_markup }, out.buf, 'p'));
      } else {
        await tg('editMessageText', { chat_id: chat, message_id: msg.message_id, text: cap, parse_mode: 'HTML', reply_markup });
      }
      return true;
    }

    if (d.startsWith('k:')) {
      await ack('Mengirim…');
      let image = null, mime;
      if (fid) { const out = await render(await download(fid), s, { final: true }); image = out.buf; mime = out.mime; }
      const res = await broadcast({ title: titleWith(s.tag, t.title), description: t.desc, image, mime });
      await finish(q, report(res));
      return true;
    }
  } catch (e) { console.error('cmic-bot cb', e); await ack('Gagal: ' + e.message, true); return true; }
  return false;
}

module.exports = async function handleUpdate(u) {
  if (!u) return false;
  if (u.callback_query) return onCallback(u.callback_query);
  if (u.message) return onMessage(u.message);
  return false;
};