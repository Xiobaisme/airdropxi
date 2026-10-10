// About: potong teks, klik = buka/tutup
document.getElementById('ab-toggle')?.addEventListener('click', function () {
    const open = document.getElementById('ab-text').classList.toggle('open');
    this.textContent = open ? 'Tutup ▲' : 'Lihat selengkapnya ▼';
});
;
(function () {
    // ikon kecil di hero
    document.querySelectorAll('[data-ico]').forEach(el => el.innerHTML = icon(el.dataset.ico));
    document.getElementById('lp-year').textContent = new Date().getFullYear();

    // carousel gambar dari folder /roi: tinggal ganti daftar nama file
    
   const ROI = Array.from({ length: 34 }, (_, i) => `roi/roi${i + 1}.webp`);

    const track = document.getElementById('lp-track');
    if (!track) return;
        track.innerHTML = ROI.map(s =>
        `<div class="lp-nft"><img src="${s}" alt="" loading="lazy" onerror="this.parentElement.remove()"></div>`).join('');

    const dots = document.createElement('div');
    dots.className = 'lp-dots';
    track.after(dots);

    const items = () => [...track.children];
    let active = 0, timer = null;

    const centerOf = (el) => el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2;
    const goTo = (i) => {
        const list = items(); if (!list.length) return;
        i = (i + list.length) % list.length;
        track.scrollTo({ left: centerOf(list[i]), behavior: 'smooth' });
    };

    function paint() {
        const list = items(), mid = track.scrollLeft + track.clientWidth / 2;
        let best = 0, bd = Infinity;
        list.forEach((el, i) => {
            const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
            if (d < bd) { bd = d; best = i; }
        });
        active = best;
        list.forEach((el, i) => {
            el.classList.toggle('active', i === best);
            el.classList.toggle('near', Math.abs(i - best) === 1);
        });
        if (dots.children.length !== list.length)
            dots.innerHTML = list.map((_, i) => `<i data-i="${i}"></i>`).join('');
        [...dots.children].forEach((d, i) => d.classList.toggle('on', i === best));
    }

    let raf = 0;
    track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(paint); }, { passive: true });
    dots.addEventListener('click', e => { const d = e.target.closest('[data-i]'); if (d) { goTo(+d.dataset.i); restart(); } });
    document.querySelector('[data-lp="prev"]').onclick = () => { goTo(active - 1); restart(); };
    document.querySelector('[data-lp="next"]').onclick = () => { goTo(active + 1); restart(); };

    // autoplay: jalan sendiri tiap 3 detik, berhenti saat disentuh/hover
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stop = () => { clearInterval(timer); timer = null; };
    const play = () => { if (!reduced && !timer) timer = setInterval(() => goTo(active + 1), 1500); };
    const restart = () => { stop(); play(); };
    ['mouseenter', 'pointerdown', 'touchstart'].forEach(ev => track.addEventListener(ev, stop, { passive: true }));
    ['mouseleave', 'pointerup', 'touchend'].forEach(ev => track.addEventListener(ev, play, { passive: true }));

    setTimeout(() => { goTo(Math.floor(items().length / 2)); paint(); play(); }, 300);
    })();  

// ═══ JUMP BAR (member): klik = scroll ke section, tombol aktif ikut section yang terlihat ═══
(function () {
    const bar = document.getElementById('jump-bar');
    if (!bar) return;
    const btns = [...bar.querySelectorAll('[data-jump]')];
    btns.forEach(b => b.addEventListener('click', () => {
        document.getElementById(b.dataset.jump)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    const io = new IntersectionObserver(es => {
        es.forEach(e => {
            if (e.isIntersecting) btns.forEach(b => b.classList.toggle('active', b.dataset.jump === e.target.id));
        });
    }, { rootMargin: '-35% 0px -55% 0px' });
    btns.forEach(b => { const t = document.getElementById(b.dataset.jump); if (t) io.observe(t); });
})();
;
// ═══ NAVBAR LANDING LOGIN: scroll halus, menu aktif, dan berubah jadi kapsul saat scroll ═══
(function () {
    const root = document.getElementById('login-section');
    const nav = document.getElementById('lp-nav');
    const all = [...document.querySelectorAll('.lp-nav [data-go]')];
    const links = [...document.querySelectorAll('.lp-nav-links [data-go]')];
    if (!root || !nav) return;

    all.forEach(a => a.addEventListener('click', e => {
        e.preventDefault();
        document.getElementById(a.dataset.go)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));

    document.getElementById('lp-nav-logo')?.addEventListener('click', e => {
        e.preventDefault();
        root.scrollTo({ top: 0, behavior: 'smooth' });
    });

    const onScroll = () => {
        nav.classList.toggle('scrolled', root.scrollTop > 40);

        let cur = null;
        links.forEach(a => {
            const t = document.getElementById(a.dataset.go);
            if (t && t.getBoundingClientRect().top <= 140) cur = a;
        });
        if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4) cur = links[links.length - 1];
        links.forEach(a => a.classList.toggle('active', a === cur));
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
})();
