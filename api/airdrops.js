export default async function handler(req, res) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: 'Missing env variables' });
  }

  try {
    const r = await fetch(`${url}/rest/v1/airdrops?select=*`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      }
    });

    const text = await r.text();

    if (!r.ok) {
      return res.status(500).json({ error: text });
    }

    const data = JSON.parse(text);
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
