module.exports = async function handler(req, res) {
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { id }   = req.query;

  if (!id) return res.status(400).send('Missing id');

  try {
    const r    = await fetch(
      `${SUPA_URL}/rest/v1/airdrops?id=eq.${id}&limit=1`,
      { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` } }
    );
    const data = await r.json();
    const p    = data?.[0];
    if (!p) return res.status(404).send('Not found');

    const title = p.name || 'AirdropXI';
    const desc  = (p.descriptionID || p.descriptionEN || 'Temukan airdrop terbaru di AirdropXI').slice(0, 200);
    const image = p.logo_url || 'https://raw.githubusercontent.com/Xiobaisme/airdropxi/main/airdrop-template.png';
    const url   = `https://airdropxi.vercel.app/guide/${id}`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 's-maxage=3600');
    return res.status(200).send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta property="og:type"         content="article">
  <meta property="og:url"          content="${url}">
  <meta property="og:title"        content="🚀 ${title} — AirdropXI">
  <meta property="og:description"  content="${desc}">
  <meta property="og:image"        content="${image}">
  <meta property="og:image:width"  content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name"    content="AirdropXI">
  <meta http-equiv="refresh"       content="0;url=${url}">
</head>
<body><script>window.location.href="${url}"</script></body>
</html>`);

  } catch(e) {
    return res.status(500).send(e.message);
  }
};
