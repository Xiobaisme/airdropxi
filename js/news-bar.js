// ═══ NEWS TERMINAL: ikon sumber di header (klik = lompat ke tabel, badge = berita baru) ═══
(function () {
    const bar = document.getElementById('news-src-bar');
    if (!bar) return;

    // singkatan di dalam bulatan. Ubah sesuka lu
    const ABBR = {
        lookonchain: 'LO', investigations: 'IV', onchainlens: 'OL', wublockchain: 'WU', whalealert: 'WA',
        treenews: 'TN', nansen: 'NA', cryptomedia: 'CM', smnews: 'SM', watcherguru: 'WG',
               rekt: 'RK', cointelegraph: 'CT', brics: 'BR', cryptorank: 'CR', upbittg: 'UP', listingv2: 'LV',
    };
    const abbr = (k) => ABBR[k] || (NEWS_SOURCES[k]?.label || k).slice(0, 2).toUpperCase();
    const ts = (n) => new Date(n.published_at).getTime() || 0;

    // "sudah dibaca sampai kapan" per sumber, disimpan di browser
    const KEY = 'nsbSeen';
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(seen)); } catch {} };

    // bikin ikon (urutan sama dengan NEWS_SOURCES)
    bar.innerHTML = Object.entries(NEWS_SOURCES).map(([k, v]) =>
        `<button type="button" class="nsb-ico" data-src="${k}" style="--c:${v.color}">
            <span>${esc(abbr(k))}</span><span class="nsb-badge hidden"></span>
        </button>`).join('');

    // hitung jumlah berita & berita baru per sumber, lalu update tampilan ikon
    function update() {
        if (!newsItems.length) return;
        let dirty = false;
        Object.keys(NEWS_SOURCES).forEach(k => {
            const mine = newsItems.filter(n => n.source === k);
            const max = Math.max(0, ...mine.map(ts));
            if (seen[k] == null) { seen[k] = max || Date.now() - 60000; dirty = true; }   // pertama kali: yang ada sekarang dianggap lama
            const fresh = mine.filter(n => ts(n) > seen[k]).length;

            const btn = bar.querySelector(`[data-src="${k}"]`);
            if (!btn) return;
            const badge = btn.querySelector('.nsb-badge');
            btn.classList.toggle('empty', !mine.length);
            btn.classList.toggle('has-new', fresh > 0);
            badge.classList.toggle('hidden', !fresh);
            badge.textContent = fresh > 99 ? '99+' : fresh;
            btn.title = `${NEWS_SOURCES[k].label} · ${mine.length} berita` + (fresh ? ` · ${fresh} baru` : '');
        });
        if (dirty) save();
    }

    // cari tabel (.nt-col) milik sumber, dicocokkan lewat teks header tabel
    function findCol(k) {
        const label = NEWS_SOURCES[k].label.toLowerCase();
        const head = (c) => (c.querySelector('.nt-col-head')?.textContent || '').trim().toLowerCase();
        const cols = [...document.querySelectorAll('#news-feed .nt-col')];
        return cols.find(c => head(c).startsWith(label)) || cols.find(c => head(c).includes(label));
    }

    bar.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-src]');
        if (!btn) return;
        const k = btn.dataset.src;

        // tandai sudah dibaca
        const max = Math.max(0, ...newsItems.filter(n => n.source === k).map(ts));
        if (max) { seen[k] = Math.max(seen[k] || 0, max); save(); }
        update();

        const col = findCol(k);
        if (!col) { showToast('Belum ada berita dari ' + NEWS_SOURCES[k].label, 'error'); return; }
        col.scrollIntoView({ behavior: 'smooth', block: 'start' });
        col.classList.remove('nt-flash'); void col.offsetWidth; col.classList.add('nt-flash');
        setTimeout(() => col.classList.remove('nt-flash'), 1500);
    });

    // update badge tiap kali feed berita dirender ulang (auto-refresh 30 detik)
    const base = window.renderNewsFeed;
    window.renderNewsFeed = function () {
        const r = base.apply(this, arguments);
        update();
        return r;
    };
    update();
})();
