const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { issueSession } = require('../lib/auth');

const SESSION_MS_GOOGLE = 7 * 24 * 60 * 60 * 1000; // admin: 7 hari (sebelumnya 4 jam)

const CLIENT_ID = '1041020002267-qj0oaoco5idr8obsfsemcm1n9tihue0p.apps.googleusercontent.com';
const ALLOWED_EMAILS = (process.env.ALLOWED_ADMIN_EMAILS
  ? process.env.ALLOWED_ADMIN_EMAILS.split(',')
  : ['regifrdm@gmail.com']
).map(e => e.trim().toLowerCase());

const client = new OAuth2Client(CLIENT_ID);

module.exports = async function handler(req, res) {
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

        // id pakai gp.sub (angka, aman di payload), bukan email
    issueSession(res, { provider: 'google', id: gp.sub }, SESSION_MS_GOOGLE);
    return res.status(200).json({ success: true, email });
  } catch (err) {
    console.error(err);
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}
