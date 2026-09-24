const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');

const CLIENT_ID = '1041020002267-qj0oaoco5idr8obsfsemcm1n9tihue0p.apps.googleusercontent.com';
const ALLOWED_EMAILS = (process.env.ALLOWED_ADMIN_EMAILS
  ? process.env.ALLOWED_ADMIN_EMAILS.split(',')
  : ['regifrdm@gmail.com']
).map(e => e.trim().toLowerCase());

const client = new OAuth2Client(CLIENT_ID);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ success: false, message: 'Token missing' });
  }
  if (!process.env.ADMIN_SECRET_KEY) {
    return res.status(500).json({ success: false, message: 'Konfigurasi server belum lengkap' });
  }
  try {
    const ticket = await client.verifyIdToken({ idToken: token, audience: CLIENT_ID });
    const gp = ticket.getPayload();

    if (!gp.email_verified) {
      return res.status(403).json({ success: false, message: 'Email belum terverifikasi' });
    }

    const email = String(gp.email || '').toLowerCase();
    if (!ALLOWED_EMAILS.includes(email)) {
      return res.status(403).json({ success: false, message: 'Email tidak diizinkan' });
    }

    // Token admin: format sama persis dengan yang dicek verifyAdminToken di admin-airdrop.js
    const expiry = Date.now() + 1000 * 60 * 60 * 4; // 4 jam
    const payload = `${expiry}`;
    const sig = crypto.createHmac('sha256', process.env.ADMIN_SECRET_KEY).update(payload).digest('hex');
    const adminToken = Buffer.from(`${payload}.${sig}`).toString('base64');

    res.setHeader(
      'Set-Cookie',
      `admin_token=${encodeURIComponent(adminToken)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=14400`
    );
    return res.status(200).json({ success: true, email });
  } catch (err) {
    console.error(err);
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}
