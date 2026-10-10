// ═══ NEWS TERMINAL: terjemahan otomatis ke Bahasa Indonesia + batas kartu per tabel ═══
(function () {
    const NT_CAP = 20;   // kartu per tabel sebelum "Tampilkan semua". Ganti ke Infinity kalau mau full tanpa batas
    const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } },
                    set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

    // cache terjemahan (disimpan di browser biar nggak translate ulang)
    const cache = new Map();
    try { Object.entries(JSON.parse(store.get('ntTrCache') || '{}')).forEach(([k, v]) => cache.set(k, v)); } catch {}
    let saveT = null;
    const saveCache = () => { clearTimeout(saveT); saveT = setTimeout(() => {
        const arr = [...cache.entries()].slice(-400);
        store.set('ntTrCache', JSON.stringify(Object.fromEntries(arr)));
    }, 1500); };

    let on = store.get('ntTranslate') !== '0';

    // ── terjemah via Google (endpoint gratis, tidak resmi) ──
    function chunks(s, max = 1500) {
        const out = []; let cur = '';
        for (const line of s.split('\n')) {
            if (cur && (cur + '\n' + line).length > max) { out.push(cur); cur = line; }
            else cur = cur ? cur + '\n' + line : line;
        }
        if (cur) out.push(cur);
        return out;
    }
    async function gt(str) {
        const [, lead, core, trail] = str.match(/^(\s*)([\s\S]*?)(\s*)$/);
        if (!core || !/\p{L}/u.test(core)) return str;
        if (cache.has(str)) return cache.get(str);
        const parts = [];
        for (const c of chunks(core)) {
            const r = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=id&dt=t&q=' + encodeURIComponent(c));
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const d = await r.json();
            parts.push(d[0].map(s => s[0]).join(''));
        }
        const res = lead + parts.join('\n') + trail;
        cache.set(str, res); saveCache();
        return res;
    }

    // antrian: maks 3 request bersamaan
    const queue = []; let active = 0;
    function enqueue(job) { queue.push(job); pump(); }
    function pump() {
        while (active < 3 && queue.length) {
            const job = queue.shift(); active++;
            job().catch(() => {}).finally(() => { active--; pump(); });
        }
    }

    const recheck = (el) => {
        const c = el.closest('.nt-card');
        if (c) c.classList.toggle('has-more', c.classList.contains('open') || el.scrollHeight > el.clientHeight + 4);
    };
    const textNodes = (el) => [...el.childNodes].filter(n => n.nodeType === 3 && n.nodeValue.trim());

    function applyCached(el) {
        // return true kalau semua node sudah ada di cache (langsung terpasang tanpa kedip)
        const nodes = textNodes(el);
        if (!nodes.every(n => !/\p{L}/u.test(n.nodeValue) || cache.has(n.nodeValue))) return false;
        nodes.forEach(n => { if (cache.has(n.nodeValue)) { n.__o = n.nodeValue; n.nodeValue = cache.get(n.nodeValue); } });
        el.dataset.tr = '1'; recheck(el);
        return true;
    }

    const io = new IntersectionObserver((entries) => {
        entries.forEach(en => {
            if (!en.isIntersecting) return;
            const el = en.target; io.unobserve(el);
            if (!on || el.dataset.tr) return;
            el.dataset.tr = '1';
            textNodes(el).forEach(n => enqueue(async () => {
                const orig = n.nodeValue;
                const tr = await gt(orig);
                if (on && n.isConnected && n.nodeValue === orig) { n.__o = orig; n.nodeValue = tr; recheck(el); }
            }));
        });
    }, { rootMargin: '400px' });

    function scan() {
        if (!on) return;
        document.querySelectorAll('#news-feed .nt-text:not([data-tr]), #new-list .nlf-card:not(.channel) .nlf-text:not([data-tr])')
            .forEach(el => { if (!applyCached(el)) io.observe(el); });
    }

    function restoreAll() {
        document.querySelectorAll('[data-tr]').forEach(el => {
            textNodes(el).forEach(n => { if (n.__o != null) { n.nodeValue = n.__o; n.__o = null; } });
            delete el.dataset.tr; recheck(el);
        });
    }

    // ── batas kartu per tabel + tombol "Tampilkan semua" ──
    const openCols = new Set();
    function capCols() {
        document.querySelectorAll('#news-feed .nt-col').forEach(col => {
            const list = col.querySelector('.nt-col-list'); if (!list) return;
            const cards = [...list.children].filter(c => c.classList.contains('nt-card'));
            const head = col.querySelector('.nt-col-head');
            const key = (head ? head.textContent : '').replace(/\d+/g, '').trim();
            let btn = col.querySelector('.nt-col-more');
            if (cards.length <= NT_CAP) { if (btn) btn.remove(); return; }
            const open = openCols.has(key);
            cards.forEach((c, i) => { const h = !open && i >= NT_CAP; if (c.hidden !== h) c.hidden = h; });
            if (!btn) {
                btn = document.createElement('button');
                btn.className = 'nt-col-more'; btn.type = 'button';
                btn.onclick = () => { openCols.has(key) ? openCols.delete(key) : openCols.add(key); capCols(); };
                col.appendChild(btn);
            }
            const txt = open ? 'Tampilkan lebih sedikit ▲' : `Tampilkan semua (${cards.length}) ▼`;
            if (btn.textContent !== txt) btn.textContent = txt;
        });
    }

    // ── tombol ON/OFF terjemahan di header News Terminal ──
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'nlf-btn nt-tr-btn' + (on ? ' active' : ' off');
    const label = () => { btn.textContent = on ? '🌐 Terjemah: ID' : '🌐 Terjemah: Asli'; };
    label();
    btn.onclick = () => {
        on = !on; store.set('ntTranslate', on ? '1' : '0');
        btn.classList.toggle('active', on); btn.classList.toggle('off', !on); label();
        on ? scan() : restoreAll();
    };
    document.querySelector('.news-head-top')?.prepend(btn);

    // pantau render ulang (auto-refresh berita & strip NEW)
    const mo = new MutationObserver(() => { scan(); capCols(); });
    ['news-feed', 'new-list'].forEach(id => {
        const el = document.getElementById(id);
        if (el) mo.observe(el, { childList: true, subtree: true });
    });
    scan(); capCols();
})();
