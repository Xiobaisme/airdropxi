(function () {
  function $(id) { return document.getElementById(id); }

  function fmt(ms) {
    if (!ms || isNaN(ms)) return '-';
    return new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  async function load() {
    var d = null;
    try {
      var r = await fetch('/api/admin-airdrop?type=session', { cache: 'no-store' });
      if (r.ok) d = await r.json();
    } catch (e) {}
    if (!d || !d.authenticated) return;

    // ⚠ nama field ditebak, disesuaikan setelah lihat isi response session
    var name  = d.name || d.username || d.global_name || d.email || 'User';
    var ava   = d.avatar || d.picture || d.image || '/cmic-icon.svg';
    var via   = d.provider || d.via || (d.email ? 'google' : 'discord');
    var did   = d.discord_id || d.discordId || d.id;
    var ident = d.email || did || '-';

    $('pf-name').textContent  = name;
    $('pf-name2').textContent = name;
    $('pf-sub').textContent   = d.role === 'admin' ? 'Administrator' : 'Member';
    $('pf-role').textContent  = d.role || '-';
    $('pf-via').textContent   = via;
    $('pf-id').textContent    = ident;
    $('pf-ava').src = $('pf-ava2').src = ava;

        try {
      var nm = String(name).trim().toLowerCase()
        .replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
      if (nm) {
        var u = new URL(location.href);
        u.searchParams.set('user', nm);
        history.replaceState(null, '', u.pathname + u.search + u.hash);
      }
    } catch (e) {}

    if (did && /^\d{15,}$/.test(String(did))) {
      $('pf-created').textContent = fmt(Number((BigInt(did) >> 22n) + 1420070400000n));
    }
    var joined = d.joined_at || d.joinedAt;
    $('pf-joined').textContent = joined ? fmt(Date.parse(joined)) : '-';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btn = $('pf-btn'), pop = $('pf-pop');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = pop.classList.toggle('hidden') === false;
      btn.setAttribute('aria-expanded', open);
    });
    document.addEventListener('click', function (e) {
      if (!pop.contains(e.target)) pop.classList.add('hidden');
    });
  });

  window.addEventListener('load', function () { setTimeout(load, 600); });
})();