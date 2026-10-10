// ═══ NAVBAR DASHBOARD: flat → kapsul saat scroll, menu aktif ═══
(function () {
    const nav = document.getElementById('app-nav');
    if (!nav) return;

    // kapsul saat scroll (di landing pakai scroll #login-section, di sini scroll window)
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // link href="#": jangan menambah # di URL
    nav.addEventListener('click', e => { if (e.target.closest('a[href="#"]')) e.preventDefault(); });

    // menu aktif = halaman yang sedang dibuka (Market / Airdrop)
    const setActive = (name) => nav.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === name));
    const toMarket = window.showMarketDashboard, toAirdrop = window.showAirdropDashboard;
    window.showMarketDashboard = function () { setActive('market'); return toMarket.apply(this, arguments); };
    window.showAirdropDashboard = function () { if (isMember()) return; setActive('airdrop'); return toAirdrop.apply(this, arguments); };
    setActive('market');

    // logo = kembali ke Market, scroll ke atas
    document.getElementById('app-nav-logo').addEventListener('click', e => {
        e.preventDefault();
        window.showMarketDashboard();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
})();