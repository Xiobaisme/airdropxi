// ═══ LAB MATERI: reader dengan animasi flip + zoom + mode video ═══
(function () {
    const $ = (id) => document.getElementById(id);
    const store = {
        get(k) { try { return localStorage.getItem(k); } catch { return null; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const FLIP_MS = 650, ZMIN = 1, ZMAX = 5;

    let LAB_EBOOKS = [], labLoaded = false;
    let cur = null, page = 1, touchX = null, flipping = false;
    const Z = { s: 1, x: 0, y: 0 };

    const pageUrl = (b, n) => b.dir + String(n).padStart(2, '0') + '.webp';
    const isVideo = (b) => b.type === 'video';

    async function loadLab() {
        if (labLoaded) return true;
        try {
            const r = await fetch('ebook/hasil/index.json', { cache: 'no-cache' });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            LAB_EBOOKS = await r.json();
            labLoaded = true;
            return true;
        } catch (e) {
            $('lab-grid').innerHTML = `<div class="lab-err" style="position:static">Gagal memuat daftar ebook: ${esc(e.message)}</div>`;
            return false;
        }
    }

    function renderGrid() {
        $('lab-grid').innerHTML = LAB_EBOOKS.map(b => {
            const last = +store.get('labPage:' + b.id) || 0;
            const vid = isVideo(b);
            const cover = vid
                ? (b.cover
                    ? `<img src="${esc(b.cover)}" alt="" loading="lazy" decoding="async">`
                    : `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:42px">▶</div>`)
                : `<img src="${esc(b.dir + 'cover.webp')}" alt="" loading="lazy" decoding="async">`;
            return `<article class="lab-card" data-id="${esc(b.id)}">
                <div class="lab-cover">${cover}</div>
                <div class="lab-meta"><span class="lab-chip">${vid ? esc(b.duration || 'Video') : b.pages + ' hal'}</span><span class="lab-chip">${esc(b.level)}</span>${(b.tags || []).map(t => `<span class="lab-chip">${esc(t)}</span>`).join('')}</div>
                <h3>${esc(b.title)}</h3>
                <p>${esc(b.desc)}</p>
                <button class="lab-read" type="button">${vid ? 'Putar' : last > 1 ? 'Lanjut hal. ' + last : 'Baca'}</button>
            </article>`;
        }).join('');
        $('lab-fab-n').textContent = LAB_EBOOKS.length + ' ebook';
    }

    // ── ZOOM ──
    const zoomEl = () => $('lab-zoom');
    function clampPan() {
        const el = zoomEl();
        const mx = Math.max(0, (el.offsetWidth * Z.s - el.offsetWidth) / 2);
        const my = Math.max(0, (el.offsetHeight * Z.s - el.offsetHeight) / 2);
        Z.x = Math.min(mx, Math.max(-mx, Z.x));
        Z.y = Math.min(my, Math.max(-my, Z.y));
    }
    function applyZ() {
        clampPan();
        const el = zoomEl();
        el.style.transform = `translate(${Z.x}px, ${Z.y}px) scale(${Z.s})`;
        el.classList.toggle('zoomed', Z.s > 1.01);
        $('lab-zreset').textContent = Z.s > 1.01 ? Z.s.toFixed(1) + 'x' : '1x';
    }
    function resetZoom() { Z.s = 1; Z.x = 0; Z.y = 0; applyZ(); }
    // zoom ke titik (clientX, clientY); tanpa titik = tengah halaman
    function zoomTo(s2, cx, cy) {
        s2 = Math.min(ZMAX, Math.max(ZMIN, s2));
        const el = zoomEl(), r = el.getBoundingClientRect();
        // titik relatif ke pusat elemen (tanpa transform)
        const ox = r.left + r.width / 2 - Z.x, oy = r.top + r.height / 2 - Z.y;
        const px = (cx ?? (r.left + r.width / 2)) - ox, py = (cy ?? (r.top + r.height / 2)) - oy;
        const k = s2 / Z.s;
        Z.x = px - (px - Z.x) * k;
        Z.y = py - (py - Z.y) * k;
        Z.s = s2;
        if (Z.s <= 1.01) { Z.s = 1; Z.x = 0; Z.y = 0; }
        applyZ();
    }

    // ── TAMPILKAN HALAMAN (dir: 1 = maju, -1 = mundur, kosong = tanpa animasi) ──
    function show(n, dir) {
        if (!cur || flipping || isVideo(cur)) return;
        const img = $('lab-img'), err = $('lab-err');
        const oldSrc = img.getAttribute('src');
        page = Math.min(cur.pages, Math.max(1, n));
        const url = pageUrl(cur, page);

        err.classList.add('hidden');
        $('lab-open').href = url;
        $('lab-count').textContent = page + ' / ' + cur.pages;
        $('lab-prog').style.width = (page / cur.pages * 100) + '%';
        $('lab-jump').value = page;
        $('lab-prev').disabled = page === 1;
        $('lab-next').disabled = page === cur.pages;
        store.set('labPage:' + cur.id, page);
        img.alt = cur.title + ' — halaman ' + page;
        resetZoom();
        [page + 1, page - 1].forEach(p => { if (p >= 1 && p <= cur.pages) new Image().src = pageUrl(cur, p); });

        img.onerror = () => { err.textContent = 'Halaman tidak ditemukan: ' + url; err.classList.remove('hidden'); };

        if (!dir || !oldSrc || reduced || !img.classList.contains('ready')) {
            img.classList.remove('ready');
            img.onload = () => img.classList.add('ready');
            img.src = url;
            return;
        }

        // animasi buku: lembar lama/baru berputar dari tepi kiri
        flipping = true;
        const clone = document.createElement('img');
        clone.className = 'lab-page lab-flip ready';
        clone.draggable = false;
        const next = dir > 0;
        clone.src = next ? oldSrc : url;
        zoomEl().appendChild(clone);

        if (next) img.src = url;   // halaman baru sudah ada di bawah lembar yang diputar

        const from = { transform: 'rotateY(0deg)', filter: 'brightness(1)', boxShadow: '0 20px 60px rgba(0,0,0,.6)' };
        const to   = { transform: 'rotateY(-100deg)', filter: 'brightness(.55)', boxShadow: '30px 20px 80px rgba(0,0,0,.9)' };
        const anim = clone.animate(next ? [from, to] : [to, from], {
            duration: FLIP_MS, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'forwards',
        });
        anim.onfinish = async () => {
            if (!next) {
                img.src = url;
                try { await img.decode(); } catch {}
            }
            clone.remove();
            flipping = false;
        };
        anim.oncancel = () => { clone.remove(); flipping = false; };
    }
    const go = (d) => show(page + d, d);

    // ── MODE VIDEO ──
    const videoUiIds = ['lab-prev', 'lab-next', 'lab-jump', 'lab-zin', 'lab-zout', 'lab-zreset'];
    function resetVideoUi() {
        const v = $('lab-video');
        if (v) { v.pause(); v.remove(); }
        videoUiIds.forEach(id => { $(id).style.display = ''; });
        $('lab-book').style.display = '';
        $('lab-prog').style.display = '';
    }
    function openVideo(b) {
        resetVideoUi();
        $('lab-rtitle').textContent = b.title;
        $('lab-count').textContent = b.duration || '';
        $('lab-open').href = b.src;
        $('lab-err').classList.add('hidden');
        $('lab-library').classList.add('hidden');
        $('lab-reader').classList.remove('hidden');
        videoUiIds.forEach(id => { $(id).style.display = 'none'; });
        $('lab-book').style.display = 'none';
        $('lab-prog').style.display = 'none';
        const v = document.createElement('video');
        v.id = 'lab-video';
        v.src = b.src;
        v.controls = true;
        v.preload = 'metadata';
        v.playsInline = true;
        v.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000';
        $('lab-stage').appendChild(v);
    }

    function openBook(id) {
        cur = LAB_EBOOKS.find(b => b.id === id);
        if (!cur) return;
        if (isVideo(cur)) { openVideo(cur); return; }
        resetVideoUi();
        $('lab-rtitle').textContent = cur.title;
        $('lab-jump').innerHTML = Array.from({ length: cur.pages }, (_, i) => `<option value="${i + 1}">Hal. ${i + 1}</option>`).join('');
        $('lab-library').classList.add('hidden');
        $('lab-reader').classList.remove('hidden');
        $('lab-img').classList.remove('ready');
        $('lab-img').removeAttribute('src');
        show(+store.get('labPage:' + cur.id) || 1);
    }
    function backToLibrary() {
        resetVideoUi();
        cur = null; flipping = false;
        zoomEl().querySelectorAll('.lab-flip').forEach(n => n.remove());
        $('lab-img').removeAttribute('src');
        $('lab-reader').classList.add('hidden');
        $('lab-library').classList.remove('hidden');
        renderGrid();
    }

    window.openLab = async function () {
        $('lab-reader').classList.add('hidden');
        $('lab-library').classList.remove('hidden');
        $('lab-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        if (await loadLab()) renderGrid();
    };
    window.closeLab = function () {
        resetVideoUi();
        $('lab-modal').classList.add('hidden');
        document.body.style.overflow = '';
        cur = null;
    };

    $('lab-close-btn').innerHTML = icon('x');
    $('lab-grid').addEventListener('click', e => { const c = e.target.closest('.lab-card'); if (c) openBook(c.dataset.id); });
    $('lab-back').onclick = backToLibrary;
    $('lab-prev').onclick = () => go(-1);
    $('lab-next').onclick = () => go(1);
    $('lab-jump').onchange = (e) => { const n = +e.target.value; show(n, n > page ? 1 : n < page ? -1 : 0); };
    $('lab-zin').onclick = () => zoomTo(Z.s * 1.4);
    $('lab-zout').onclick = () => zoomTo(Z.s / 1.4);
    $('lab-zreset').onclick = resetZoom;

    // ── interaksi zoom: wheel, dblclick, drag, pinch ──
    const book = $('lab-book');
    book.addEventListener('wheel', e => {
        e.preventDefault();
        zoomTo(Z.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY);
    }, { passive: false });
    book.addEventListener('dblclick', e => {
        e.preventDefault();
        Z.s > 1.01 ? resetZoom() : zoomTo(2.5, e.clientX, e.clientY);
    });

    const ptrs = new Map();
    let pinch0 = null, drag0 = null;
    book.addEventListener('pointerdown', e => {
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        book.setPointerCapture(e.pointerId);
        if (ptrs.size === 2) {
            const [a, b] = [...ptrs.values()];
            pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), s: Z.s };
            drag0 = null;
        } else if (Z.s > 1.01) {
            drag0 = { x: e.clientX, y: e.clientY, zx: Z.x, zy: Z.y };
            zoomEl().classList.add('dragging');
        }
    });
    book.addEventListener('pointermove', e => {
        if (!ptrs.has(e.pointerId)) return;
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (ptrs.size === 2 && pinch0) {
            const [a, b] = [...ptrs.values()];
            zoomTo(pinch0.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch0.d, (a.x + b.x) / 2, (a.y + b.y) / 2);
        } else if (drag0) {
            Z.x = drag0.zx + (e.clientX - drag0.x);
            Z.y = drag0.zy + (e.clientY - drag0.y);
            applyZ();
        }
    });
    const endPtr = e => {
        ptrs.delete(e.pointerId);
        if (ptrs.size < 2) pinch0 = null;
        if (!ptrs.size) { drag0 = null; zoomEl().classList.remove('dragging'); }
    };
    book.addEventListener('pointerup', endPtr);
    book.addEventListener('pointercancel', endPtr);

    // swipe ganti halaman (hanya saat tidak di-zoom)
    const stage = $('lab-stage');
    stage.addEventListener('touchstart', e => { touchX = e.touches.length === 1 && Z.s <= 1.01 ? e.touches[0].clientX : null; }, { passive: true });
    stage.addEventListener('touchend', e => {
        if (touchX === null || Z.s > 1.01) { touchX = null; return; }
        const dx = e.changedTouches[0].clientX - touchX; touchX = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    });

    // keyboard
    document.addEventListener('keydown', e => {
        if ($('lab-modal').classList.contains('hidden') || e.target.matches('select,input,textarea')) return;
        if (e.key === 'Escape') cur ? backToLibrary() : closeLab();
        else if (!cur) return;
        else if (e.key === 'ArrowRight' || e.key === 'PageDown') go(1);
        else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1);
        else if (e.key === '+' || e.key === '=') zoomTo(Z.s * 1.4);
        else if (e.key === '-') zoomTo(Z.s / 1.4);
        else if (e.key === '0') resetZoom();
    });
    window.addEventListener('resize', () => { if (cur) applyZ(); });
})();