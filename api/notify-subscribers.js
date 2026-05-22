module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (req.headers['x-admin-key'] !== process.env.ADMIN_SECRET_KEY)
    return res.status(401).json({ error: 'Unauthorized' });

  const { projectName, projectUrl, description, raised, tags, network, status } = req.body;

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

    const metaRows = [
      raised  ? { icon: '💰', label: 'Total Raised', value: raised }  : null,
      tags    ? { icon: '📂', label: 'Category',     value: tags }    : null,
      network ? { icon: '🌐', label: 'Network',      value: network } : null,
      status  ? { icon: '📍', label: 'Status',       value: status }  : null,
    ].filter(Boolean);

    const metaHtml = metaRows.map(r => `
      <tr>
        <td style="padding:10px 14px;color:#4a7090;font-size:11px;font-family:monospace;letter-spacing:0.06em;white-space:nowrap;border-bottom:1px solid #0f1e2a">
          ${r.icon} ${r.label.toUpperCase()}
        </td>
        <td style="padding:10px 14px;color:#ddeaf6;font-size:13px;font-weight:600;border-bottom:1px solid #0f1e2a">
          ${r.value}
        </td>
      </tr>`).join('');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#030810">
  <div style="max-width:580px;margin:0 auto;padding:24px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">

    <!-- Header -->
    <div style="margin-bottom:24px">
      <span style="color:#00e87a;font-size:15px;font-weight:800;letter-spacing:0.05em;font-family:monospace">⚡ AIRDROPXI</span>
      <span style="margin-left:10px;background:#0f1e2a;color:#3a6a8a;font-size:10px;font-family:monospace;padding:3px 8px;border-radius:4px;letter-spacing:0.1em;border:1px solid #1c3040">ALERT</span>
    </div>

    <!-- Card -->
    <div style="background:#070f18;border:1px solid #0f2030;border-radius:14px;overflow:hidden">

      <!-- Card Header -->
      <div style="padding:24px 28px 20px;border-bottom:1px solid #0f1e2a;background:linear-gradient(135deg,#080f1a,#050c14)">
        <p style="margin:0 0 8px;color:#3a7060;font-size:10px;font-family:monospace;letter-spacing:0.15em;text-transform:uppercase">New Airdrop Listed</p>
        <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;line-height:1.2">
          ${projectName}
        </h1>
        <div style="margin-top:12px;display:inline-block;background:rgba(0,232,122,0.1);border:1px solid rgba(0,232,122,0.25);border-radius:6px;padding:4px 12px">
          <span style="color:#00e87a;font-size:11px;font-family:monospace;font-weight:700;letter-spacing:0.08em">● LIVE NOW</span>
        </div>
      </div>

      <!-- Description -->
      <div style="padding:20px 28px;border-bottom:1px solid #0f1e2a">
        <p style="margin:0;color:#7a9bb5;font-size:13px;line-height:1.75">
          ${description || 'A new airdrop opportunity has just been listed on AirdropXI. Check it out before it fills up!'}
        </p>
      </div>

      <!-- Meta Table -->
      ${metaHtml ? `
      <div style="padding:0">
        <table style="width:100%;border-collapse:collapse">
          ${metaHtml}
        </table>
      </div>` : ''}

      <!-- CTA -->
      <div style="padding:24px 28px;text-align:center">
        <a href="${projectUrl}"
          style="display:inline-block;background:#00e87a;color:#000000;text-decoration:none;font-weight:800;font-size:13px;letter-spacing:0.08em;padding:14px 36px;border-radius:8px">
          VIEW AIRDROP →
        </a>
        <p style="margin:16px 0 0;color:#2a4a60;font-size:11px;font-family:monospace">
          airdropxi.vercel.app
        </p>
      </div>

    </div>

    <!-- Footer -->
    <div style="margin-top:24px;padding:0 4px;text-align:center">
      <p style="margin:0;color:#1c3040;font-size:10px;font-family:monospace;line-height:1.8">
        You received this because you subscribed to AirdropXI alerts.<br>
        Built for Web3 hunters ⚡
      </p>
    </div>

  </div>
</body>
</html>`;

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'AirdropXI', email: 'regifrdm@gmail.com' },
        to: emails.map(email => ({ email })),
        subject: `🚀 New Airdrop: ${projectName}`,
        htmlContent,
      }),
    });

    const result = await brevoRes.json();
    return res.status(200).json({ success: true, sent: emails.length, result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
