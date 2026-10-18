// Kirim broadcast ke Discord & Telegram. Logika & format sama dengan api (miniapp-send).
const LOGO_URL = 'https://airdropxi.vercel.app/logo1.png';
const LINKS = {
  tiktok:   'https://tiktok.com/@hellovry',
  telegram: 'https://t.me/CryptoMonk3y',
  ourbit:   'https://www.ourbit.com/register?inviteCode=ourbitCMIC',
};
const escHtml = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/`([^`]+)`/g, '<code>$1</code>');

async function sendDiscord({ title, description, image, mime, everyone, target }) {
  const webhookUrl = (target === 'ourbit' && process.env.DISCORD_WEBHOOK_URL_OURBIT) || process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) throw new Error('DISCORD_WEBHOOK_URL belum di-set');
  const ext = (mime || 'image/png').split('/')[1] || 'png';
  const embed = {
    author: { name: '🗣 CMIC BROADCAST', icon_url: LOGO_URL },
    title: String(title).slice(0, 256),
    description:
      String(description || '').slice(0, 3700) +
      '\n\u200b\n\u200b\n' +
      `**COMMUNITY**\n[TikTok](${LINKS.tiktok}) • [Telegram](${LINKS.telegram})\n\u200b\n` +
      `**TRADING PLATFORMS**\n[Ourbit](${LINKS.ourbit})`,
    color: 0x3B82F6,
    footer: { text: 'Xiobaii • Crypto Monkey Inner Circle', icon_url: LOGO_URL },
    timestamp: new Date().toISOString(),
  };
  let res;
  if (image) {
    embed.image = { url: `attachment://image.${ext}` };
    const form = new FormData();
    form.append('payload_json', JSON.stringify({ embeds: [embed] }));
    form.append('files[0]', new Blob([image], { type: mime }), `image.${ext}`);
    res = await fetch(webhookUrl, { method: 'POST', body: form });
  } else {
    res = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ embeds: [embed] }) });
  }
  if (res.ok && everyone) {
    await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '@everyone', allowed_mentions: { parse: ['everyone'] } }) });
  }
  return res.ok ? 'ok' : `error ${res.status}`;
}

async function sendTelegram({ title, description, image, mime }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = (process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHANNEL_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!token || !chatIds.length) throw new Error('TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID belum di-set');
  const ext = (mime || 'image/png').split('/')[1] || 'png';
  const FOOT = `<i>Xiobaii • Crypto Monkey Inner Circle</i>`;
  // CATATAN: file aslimu mungkin punya emoji sebelum <b> di bawah (hilang saat copy-paste). Tambahkan lagi kalau ada.
  const fullText = (` <b>${escHtml(title)}</b>\n\n${escHtml(description)}\n\n${FOOT}`).slice(0, 4096);
  const buildCaption = () => {
    const header = ` <b>${escHtml(title)}</b>\n\n`, footer = `\n\n${FOOT}`;
    const max = Math.max(1024 - header.length - footer.length - 3, 0);
    const d = escHtml(description), truncated = d.length > max;
    return { caption: header + (truncated ? d.slice(0, max) + '...' : d) + footer, truncated };
  };
  const kb = { inline_keyboard: [
    [{ text: 'COMMUNITY', callback_data: 'noop' }],
    [
      { text: 'TikTok', url: LINKS.tiktok, style: 'primary' },
      { text: 'Discord', url: 'https://t.me/Xiobaii?text=Halo%20Bang%2C%20saya%20ingin%20bergabung%20ke%20komunitas%20Discord%20Crypto%20Monkey.%20Mohon%20info%20langkah%20pendaftarannya%20ya.%20Terima%20kasih%20%F0%9F%99%8F', style: 'primary' },
    ],
    [{ text: 'TRADING PLATFORMS', callback_data: 'noop' }],
    [{ text: 'Ourbit', url: LINKS.ourbit, style: 'primary' }],
  ] };
  const api = (m) => `https://api.telegram.org/bot${token}/${m}`;
  const errs = [];
  for (const chatId of chatIds) {
    let r;
    if (image) {
      const { caption, truncated } = buildCaption();
      const f = new FormData();
      f.append('chat_id', chatId);
      f.append('photo', new Blob([image], { type: mime }), `image.${ext}`);
      f.append('caption', caption); f.append('parse_mode', 'HTML'); f.append('reply_markup', JSON.stringify(kb));
      r = await fetch(api('sendPhoto'), { method: 'POST', body: f });
      if (truncated) await fetch(api('sendMessage'), { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: fullText, parse_mode: 'HTML' }) });
    } else {
      r = await fetch(api('sendMessage'), { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: fullText, parse_mode: 'HTML', reply_markup: kb }) });
    }
    const d = await r.json().catch(() => ({}));
    if (!(r.ok && d.ok)) errs.push(`${chatId}: ${d.description || r.status}`);
  }
  return errs.length ? `error: ${errs.join('; ')}` : 'ok';
}

// opts: { title, description, image?: Buffer, mime?, everyone?, target? }
async function broadcast(opts) {
  const [d, t] = await Promise.allSettled([sendDiscord(opts), sendTelegram(opts)]);
  return {
    discord:  d.status === 'fulfilled' ? d.value : 'error: ' + d.reason.message,
    telegram: t.status === 'fulfilled' ? t.value : 'error: ' + t.reason.message,
  };
}
module.exports = { broadcast };