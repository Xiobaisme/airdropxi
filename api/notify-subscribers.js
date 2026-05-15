module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (req.headers['x-admin-key'] !== process.env.ADMIN_SECRET_KEY)
    return res.status(401).json({ error: 'Unauthorized' });

  const { projectName, projectUrl, description } = req.body;
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const H = {
    apikey: SUPA_KEY,
    Authorization: `Bearer ${SUPA_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    const subRes = await fetch(`${SUPA_URL}/rest/v1/subscribers?select=email`, { headers: H });
    const subs = await subRes.json();
    const emails = subs.map(s => s.email).filter(Boolean);

    if (!emails.length)
      return res.status(200).json({ success: false, message: 'No subscribers' });

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'AirdropXI', email: 'regifrdm@gmail.com' },
        to: emails.map(email => ({ email })),
        subject: `🚀 New Airdrop Alert: ${projectName}`,
htmlContent: `
  <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#050b10;color:#ddeaf6;padding:32px;border-radius:16px">
    <h1 style="color:#00e87a;font-size:22px;margin-bottom:4px">⚡ AirdropXI</h1>
    <p style="color:#3a5a72;font-size:11px;margin-bottom:24px;font-family:monospace;letter-spacing:0.1em">AIRDROP ALERT</p>
    <h2 style="font-size:20px;margin-bottom:12px;color:#fff">New Airdrop: <span style="color:#00e87a">${projectName}</span></h2>
    <p style="color:#7a9bb5;line-height:1.7;margin-bottom:28px;font-size:14px">
      ${description || 'A new airdrop opportunity has just been listed on AirdropXI. Check it out before it fills up!'}
    </p>
    <a href="${projectUrl}"
      style="background:#00e87a;color:#000;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;font-size:13px;letter-spacing:0.05em">
      VIEW AIRDROP →
    </a>
    <hr style="border:none;border-top:1px solid #1c2733;margin:32px 0">
    <p style="color:#3a5a72;font-size:11px;font-family:monospace">
      You received this because you subscribed to AirdropXI alerts.<br>
      Built for Web3 hunters ⚡
       </p>
      </div>
       `,
      }),
    });

    const result = await brevoRes.json();
    return res.status(200).json({ success: true, sent: emails.length, result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
