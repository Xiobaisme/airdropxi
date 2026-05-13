const { Resend } = require('resend');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Simple auth biar gak disalahgunain
  if (req.headers['x-admin-key'] !== process.env.ADMIN_SECRET_KEY)
    return res.status(401).json({ error: 'Unauthorized' });

  const { projectName, projectUrl, description } = req.body;

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const H = { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` };

  // Ambil semua subscriber
await fetch('https://api.brevo.com/v3/smtp/email', {
  method: 'POST',
  headers: {
    'api-key': process.env.BREVO_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    sender: { name: 'airdropxi', email: 'regifrdm@gmail.com' },
    to: emails.map(e => ({ email: e })),
    subject: `🚀 New Airdrop: ${projectName}`,
    htmlContent:`
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#050b10;color:#ddeaf6;padding:32px;border-radius:16px">
        <h1 style="color:#00e87a;font-size:24px;margin-bottom:8px">⚡ AirdropXI</h1>
        <h2 style="font-size:18px;margin-bottom:16px">Airdrop baru tersedia: ${projectName}</h2>
        <p style="color:#7a9bb5;line-height:1.6;margin-bottom:24px">${description || 'Cek sekarang sebelum ketinggalan!'}</p>
        <a href="${projectUrl}" style="background:#00e87a;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">
          Lihat Sekarang →
        </a>
        <p style="color:#3a5a72;font-size:12px;margin-top:32px">
          Kamu menerima email ini karena subscribe di AirdropXI.<br>
        </p>
      </div>
    `,
  });

  return res.status(200).json({ sent: emails.length });
};
