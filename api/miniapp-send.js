// Broadcast dari Telegram Mini App. Format pesan = salinan sendDiscord/sendTelegram di admin-airdrop.js.
const { authAdmin } = require('../lib/tg-auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  if (!authAdmin(req.headers['x-telegram-init-data'])) return res.status(403).json({ error: 'Akses ditolak' });

  const { title, description, image_base64, mention_everyone, discord_target } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title wajib diisi' });
  const everyone = Boolean(mention_everyone);

  let imageBuffer = null, imageMime = 'image/png';
  if (image_base64 && image_base64.startsWith('data:')) {
    const m = image_base64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (m) { imageMime = m[1]; imageBuffer = Buffer.from(m[2], 'base64'); }
  }
  const ext = imageMime.split('/')[1] || 'png';

  // ─── DISCORD ───
  async function sendDiscord() {
    const useOurbit = discord_target === 'ourbit';
    const webhookUrl = (useOurbit && process.env.DISCORD_WEBHOOK_URL_OURBIT) || process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) throw new Error('DISCORD_WEBHOOK_URL belum di-set');

    const LOGO_URL = 'https://airdropxi.vercel.app/logo1.png';
    const LINKS = {
      tiktok:   'https://tiktok.com/@hellovry',
      telegram: 'https://t.me/CryptoMonk3y',
      ourbit:   'https://www.ourbit.com/register?inviteCode=ourbitCMIC',
    };
    const embed = {
      author: { name: '🗣 CMIC BROADCAST', icon_url: LOGO_URL },
      title: String(title).slice(0, 256),
      description:
        String(description || '').slice(0, 3700) +
        '\n\u200b\n\u200b\n' +
        `**COMMUNITY**\n` +
        `[TikTok](${LINKS.tiktok}) • [Telegram](${LINKS.telegram})\n\u200b\n` +
        `**TRADING PLATFORMS**\n` +
        `[Ourbit](${LINKS.ourbit})`,
      color: 0x3B82F6,
      footer: { text: 'Xiobaii • Crypto Monkey Inner Circle', icon_url: LOGO_URL },
      timestamp: new Date().toISOString(),
    };

    let dRes;
    if (imageBuffer) {
      embed.image = { url: `attachment://image.${ext}` };
      const form = new FormData();
      form.append('payload_json', JSON.stringify({ embeds: [embed] }));
      form.append('files[0]', new Blob([imageBuffer], { type: imageMime }), `image.${ext}`);
      dRes = await fetch(webhookUrl, { method: 'POST', body: form });
    } else {
      dRes = await fetch(webhookUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });
    }
    if (dRes.ok && everyone) {
      await fetch(webhookUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '@everyone', allowed_mentions: { parse: ['everyone'] } }),
      });
    }
    return dRes.ok ? 'ok' : `error ${dRes.status}`;
  }

  // ─── TELEGRAM ───
  async function sendTelegram() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatIds = (process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHANNEL_IDS || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    if (!token || !chatIds.length) throw new Error('TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID belum di-set');

    const escHtml = (s) => String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

    const buildText = () =>
      ` <b>${escHtml(title)}</b>\n\n` +
      `${escHtml(description || '')}\n\n` +
      `<i>Xiobaii • Crypto Monkey Inner Circle</i>`;

    const buildCaption = () => {
      const header = ` <b>${escHtml(title)}</b>\n\n`;
      const footer = `\n\n<i>Xiobaii • Crypto Monkey Inner Circle</i>`;
      const maxDescLen = Math.max(1024 - header.length - footer.length - 3, 0);
      const descEsc = escHtml(description || '');
      const truncated = descEsc.length > maxDescLen;
      const desc = truncated ? descEsc.slice(0, maxDescLen) + '...' : descEsc;
      return { caption: header + desc + footer, truncated };
    };

    const inlineKeyboard = {
      inline_keyboard: [
        [{ text: 'COMMUNITY', callback_data: 'noop' }],
        [
          { text: 'TikTok', url: 'https://tiktok.com/@hellovry', style: 'primary' },
          { text: 'Discord', url: 'https://t.me/Xiobaii?text=Halo%20Bang%2C%20saya%20ingin%20bergabung%20ke%20komunitas%20Discord%20Crypto%20Monkey.%20Mohon%20info%20langkah%20pendaftarannya%20ya.%20Terima%20kasih%20%F0%9F%99%8F', style: 'primary' },
        ],
        [{ text: 'TRADING PLATFORMS', callback_data: 'noop' }],
        [{ text: 'Ourbit', url: 'https://www.ourbit.com/register?inviteCode=ourbitCMIC', style: 'primary' }],
      ],
    };

    const fullText = buildText().slice(0, 4096);
    const errs = [];
    for (const chatId of chatIds) {
      let tRes;
      if (imageBuffer) {
        const { caption, truncated } = buildCaption();
        const f = new FormData();
        f.append('chat_id', chatId);
        f.append('photo', new Blob([imageBuffer], { type: imageMime }), `image.${ext}`);
        f.append('caption', caption);
        f.append('parse_mode', 'HTML');
        f.append('reply_markup', JSON.stringify(inlineKeyboard));
        tRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: f });
        if (truncated) {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: fullText, parse_mode: 'HTML' }),
          });
        }
      } else {
        tRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: fullText, parse_mode: 'HTML', reply_markup: inlineKeyboard }),
        });
      }
      const tData = await tRes.json().catch(() => ({}));
      if (!(tRes.ok && tData.ok)) errs.push(`${chatId}: ${tData.description || tRes.status}`);
    }
    return errs.length ? `error: ${errs.join('; ')}` : 'ok';
  }

  const [d, t] = await Promise.allSettled([sendDiscord(), sendTelegram()]);
  res.status(200).json({
    discord:  d.status === 'fulfilled' ? d.value : 'error: ' + d.reason.message,
    telegram: t.status === 'fulfilled' ? t.value : 'error: ' + t.reason.message,
  });
};
module.exports.config = { api: { bodyParser: { sizeLimit: '4mb' } } };