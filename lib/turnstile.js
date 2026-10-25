async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret || !token) return false;
  try {
    const body = new URLSearchParams({ secret, response: String(token).slice(0, 2048) });
    if (ip) body.set('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body, signal: AbortSignal.timeout(5000),
    });
    const d = await r.json();
    return d.success === true;
  } catch { return false; }
}
module.exports = { verifyTurnstile };