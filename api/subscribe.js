module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  
  const { email } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Email tidak valid' });

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const H = { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' };

  const r = await fetch(`${SUPA_URL}/rest/v1/subscribers`, {
    method: 'POST',
    headers: { ...H, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ email }),
  });

  if (r.status === 409) return res.status(409).json({ error: 'Email sudah terdaftar' });
  if (!r.ok) return res.status(500).json({ error: 'Gagal simpan' });

  return res.status(200).json({ success: true });
};
