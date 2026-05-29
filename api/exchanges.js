// pages/api/exchanges.js (atau api/exchanges.js)
export default async function handler(req, res) {
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPA_URL || !SUPA_KEY) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  const BASE = `${SUPA_URL}/rest/v1`;
  const H = {
    'apikey': SUPA_KEY,
    'Authorization': `Bearer ${SUPA_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    // Ambil semua data exchanges + join dengan exchange_details
    const r = await fetch(
      `${BASE}/exchanges?select=*,exchange_details(*)&order=rank.asc`,
      { headers: H }
    );
    const data = await r.json();
    if (!r.ok) throw new Error(data.message);

    // Transformasi: flatten exchange_details ke level utama
    const transformed = data.map(ex => {
      const details = ex.exchange_details || {};
      return {
        // dari tabel exchanges
        id: ex.id,
        rank: ex.rank,
        exchange_name: ex.exchange_name,
        logo_url: ex.logo_url,
        country: ex.country,
        key_features: ex.key_features,
        best_for: ex.best_for,
        type: ex.type || 'cex',
        year_founded: details.year_founded || null,
        headquarters: details.headquarters || null,
        ceo: details.ceo || null,
        regulatory_info: details.regulatory_info || null,
        // dari exchange_details
        about: details.about || null,
        website: details.website || null,
        twitter: details.twitter || null,
        telegram: details.telegram || null,
        discord: details.discord || null,
        instagram: details.instagram || null,
        facebook: details.facebook || null,
        linkedin: details.linkedin || null,
        github: details.github || null,
        youtube: details.youtube || null,
        medium: details.medium || null,
        native_token: details.native_token || null,
        native_token_logo: details.native_token_logo || null,
        native_token_link: details.native_token_link || null,
      };
    });

    res.status(200).json(transformed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch exchange data' });
  }
}
