// Verifikasi initData Telegram Mini App + cek whitelist admin.
const crypto = require('crypto');

const ADMIN_IDS = () =>
  (process.env.ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

function verifyInitData(initData, maxAgeSec = 3600) {
  if (!initData || !process.env.TELEGRAM_BOT_TOKEN) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const check = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData')
    .update(process.env.TELEGRAM_BOT_TOKEN).digest();
  const calc = crypto.createHmac('sha256', secret).update(check).digest('hex');
  const a = Buffer.from(calc), b = Buffer.from(hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const age = Date.now() / 1000 - Number(params.get('auth_date'));
  if (!Number.isFinite(age) || age > maxAgeSec || age < -60) return null;
  try { return JSON.parse(params.get('user')); } catch { return null; }
}

// Return user kalau valid DAN admin, selain itu null.
function authAdmin(initData) {
  const user = verifyInitData(initData);
  return user && ADMIN_IDS().includes(String(user.id)) ? user : null;
}

module.exports = { verifyInitData, authAdmin, ADMIN_IDS };