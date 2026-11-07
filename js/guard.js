(async function () {
  var d = null;
  try {
    var r = await fetch('/api/admin-airdrop?type=session', { cache: 'no-store' });
    if (r.ok) { var j = await r.json(); if (j.authenticated) d = j; }
  } catch (e) {}

  if (!d) { location.replace('/'); return; }            // belum login → ke halaman login

  var need = document.documentElement.getAttribute('data-require');
  if (need === 'admin' && d.role !== 'admin') {         // halaman khusus admin
    location.replace('/');
    return;
  }

  window.CMIC_SESSION = d;                              // dipakai profil nanti
    // tempel ?user=nama di URL (hanya tampilan)
  try {
    var nm = String(d.name || d.username || d.global_name || '').trim().toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
    if (nm) {
      var u = new URL(location.href);
      u.searchParams.set('user', nm);
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    }
  } catch (e) {}
  document.documentElement.style.visibility = 'visible';
  window.addEventListener('DOMContentLoaded', function () {
    document.body.classList.toggle('is-member', d.role === 'member');
  });
})();