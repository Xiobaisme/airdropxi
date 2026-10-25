const crypto = require('crypto');

const getKey = () => {
  const k = process.env.ADMIN_SECRET_KEY;
  if (!k || k.length < 32) throw new Error('ADMIN_SECRET_KEY missing or too short');
  return k;
};

const sign = (payload) =>
  crypto.createHmac('sha256', getKey()).update(payload).digest('hex');

// payload = "<expiryMs>" (lama) atau "<expiryMs>:<provider>:<id>"
// return false kalau tidak valid, kalau valid return { exp, provider, id } (truthy)

function verifyAdminToken(req) {
  const match = (req.headers.cookie || '').match(/(?:^|;\s*)admin_token=([^;]+)/);
  if (!match) return false;
  try {
    const decoded = Buffer.from(decodeURIComponent(match[1]), 'base64').toString();
    const dot = decoded.lastIndexOf('.');
    if (dot < 1) return false;
    const payload = decoded.slice(0, dot), sig = decoded.slice(dot + 1);
    const sigBuf = Buffer.from(sig), expBuf = Buffer.from(sign(payload));
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false;
    const [exp, provider = 'google', id = ''] = payload.split(':');
    if (!(Date.now() < Number(exp))) return false;
    return { exp: Number(exp), provider, id };
  } catch { return false; }
}

function addCookie(res, cookie) {
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', prev ? [].concat(prev, cookie) : cookie);
}

function issueSession(res, { provider, id }, ttlMs) {
  if (!/^[a-z]{2,20}$/.test(String(provider)) || !/^[A-Za-z0-9_.@+-]{1,128}$/.test(String(id))) {
  throw new Error('bad session identity');
}
  const payload = `${Date.now() + ttlMs}:${provider}:${id}`;
  const token = Buffer.from(`${payload}.${sign(payload)}`).toString('base64');
  addCookie(res, `admin_token=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Math.floor(ttlMs / 1000)}`);
}

function clearSession(res) {
  addCookie(res, 'admin_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
}

module.exports = { verifyAdminToken, issueSession, clearSession, addCookie };
