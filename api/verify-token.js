const { OAuth2Client } = require('google-auth-library');

const CLIENT_ID = '1041020002267-qj0oaoco5idr8obsfsemcm1n9tihue0p.apps.googleusercontent.com';
const ALLOWED_EMAILS = process.env.ALLOWED_ADMIN_EMAILS
  ? process.env.ALLOWED_ADMIN_EMAILS.split(',')
  : ['regifrdm@gmail.com'];

const client = new OAuth2Client(CLIENT_ID);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, message: 'Token missing' });
  }
  try {
    const ticket = await client.verifyIdToken({ idToken: token, audience: CLIENT_ID });
    const email = ticket.getPayload().email;
    if (ALLOWED_EMAILS.includes(email)) {
      return res.status(200).json({ success: true, email });
    } else {
      return res.status(403).json({ success: false, message: 'Email tidak diizinkan' });
    }
  } catch (err) {
    console.error(err);
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}
