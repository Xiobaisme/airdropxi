// ═══════════════════════════════════════════════════════════
// NEWS TERMINAL v2 — panel tetap, scroll per panel, cuaca dari IP
// GANTI semua kode dari "const NEWS_SOURCES" sampai sebelum
// "// ═══ CRYPTO TICKER" dengan isi file ini.
// ═══════════════════════════════════════════════════════════
const NEWS_SOURCES = {
    lookonchain:    { label: 'Lookonchain',    color: 'var(--secondary)' },
    investigations: { label: 'Investigations', color: '#f59e0b' },
    onchainlens:    { label: 'OnchainLens',    color: '#38bdf8' },
    wublockchain:   { label: 'Wu Blockchain',  color: '#22c55e' },
    whalealert:     { label: 'Whale Alert',    color: '#FFD23F' },
    treenews:       { label: 'Tree News',      color: '#84cc16' },
    nansen:         { label: 'Nansen',         color: '#818cf8' },
    cryptomedia:    { label: 'Crypto Media',   color: '#fb923c' },
    smnews:         { label: 'SM News',        color: '#60a5fa' },
    watcherguru:    { label: 'WatcherGuru',    color: '#2dd4bf' },
    rekt:           { label: 'REKT',           color: '#ef4444' },
    cointelegraph:  { label: 'Cointelegraph',  color: '#fbbf24' },
    brics:          { label: 'BRICS News',     color: '#3b82f6' },
    cryptorank:     { label: 'CryptoRank',     color: '#94a3b8' },
    upbittg:        { label: 'Upbit (TG)',     color: '#06b6d4' },
    listingv2:      { label: 'New Listing & Delisting V2', color: '#f97316' },
    // sumber RSS publik (datang dari /api/admin-airdrop?type=feed)
    antara:   { label: 'Antara',         color: '#ef4444' },
    cnbcid:   { label: 'CNBC Indonesia', color: '#38bdf8' },
    detik:    { label: 'Detik Finance',  color: '#22c55e' },
    kontan:   { label: 'Kontan',         color: '#f59e0b' },
    coindesk: { label: 'CoinDesk',       color: '#60a5fa' },
    decrypt:  { label: 'Decrypt',        color: '#a78bfa' },
    theblock: { label: 'The Block',      color: '#fb7185' },
};
const NEWS_ABBR = {
    lookonchain: 'LO', investigations: 'IV', onchainlens: 'OL', wublockchain: 'WU', whalealert: 'WA',
    treenews: 'TN', nansen: 'NA', cryptomedia: 'CM', smnews: 'SM', watcherguru: 'WG', rekt: 'RK',
    cointelegraph: 'CT', brics: 'BR', cryptorank: 'CR', upbittg: 'UP', listingv2: 'LV',
    antara: 'AN', cnbcid: 'CN', detik: 'DE', kontan: 'KD', coindesk: 'CD', decrypt: 'DC', theblock: 'TH',
};
const NEWS_POLL_SEC = 30;
const PANEL_PAGE = 20;      // berita per panel, tombol "Muat lagi" nambah 20
let newsItems = [], _newsCountdown = NEWS_POLL_SEC, _newsCountdownInt = null, _newsClockInt = null, _newsSig = '';
let _newsInFlight = false, _newsFails = 0, _newsQuery = '';
const _newsUnread = {}, _newsPanelSig = {}, _newsShown = {}, _newsHidden = new Set();
try { JSON.parse(localStorage.getItem('newsHidden') || '[]').forEach(k => _newsHidden.add(k)); } catch {}

const $n = (id) => document.getElementById(id);
let rssItems = [];
const allNews = () => { const s = new Set(); return [...newsItems, ...rssItems].filter(n => !s.has(n.id) && s.add(n.id)); };
const newsKeys = () => {
    const extra = [...new Set(allNews().map(n => n.source))].filter(k => !NEWS_SOURCES[k]);
    return [...Object.keys(NEWS_SOURCES), ...extra];
};
const newsSrc = (k) => NEWS_SOURCES[k] || { label: k, color: 'var(--primary)' };
const newsAbbr = (k) => {
    if (NEWS_ABBR[k]) return NEWS_ABBR[k];
    const w = newsSrc(k).label.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean);
    return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || '?').slice(0, 2)).toUpperCase();
};

// ─── buka / tutup ───
function toggleNewsPanel() {
    const drawer = $n('news-drawer'), overlay = $n('news-overlay');
    if (!drawer) return;
    const opening = !drawer.classList.contains('open');
    drawer.classList.toggle('open'); overlay?.classList.toggle('show');
    if (opening) {
        _newsFails = 0; _newsCountdown = NEWS_POLL_SEC;
        ensureNewsUI(); loadWeather(); loadNews(); loadRss();
        if (!_newsClockInt) { tickNewsClock(); _newsClockInt = setInterval(tickNewsClock, 1000); }
        if (!_newsCountdownInt) _newsCountdownInt = setInterval(tickNewsCountdown, 1000);
    } else {
        clearInterval(_newsClockInt); clearInterval(_newsCountdownInt);
        _newsClockInt = _newsCountdownInt = null;
    }
}
function refreshNewsAgo() {
    document.querySelectorAll('#news-feed .nt-time[data-ts]').forEach(t => {
        const l = t.lastChild; if (l && l.nodeType === 3) l.nodeValue = newsTimeAgo(t.dataset.ts);
    });
}
function tickNewsClock() {
    if (new Date().getSeconds() === 0) refreshNewsAgo();
    const el = $n('news-clock');
    if (el) el.textContent = new Date().toLocaleTimeString('id-ID', { hour12: false, timeZone: 'Asia/Jakarta' });
}
function tickNewsCountdown() {
    _newsCountdown--;
    if (_newsCountdown <= 0) {
        _newsCountdown = Math.min(NEWS_POLL_SEC * Math.pow(2, _newsFails), 120);
        loadNews();
    }
    const el = $n('news-countdown');
    if (el) el.textContent = `${String(Math.floor(_newsCountdown / 60)).padStart(2, '0')}:${String(_newsCountdown % 60).padStart(2, '0')}`;
}

// ─── CUACA dari IP (ipwho.is → Open-Meteo, tanpa API key) ───
let _wxLoc = null, _wxData = null, _wxAt = 0;
const wxIcon = (c) => c === 0 ? '☀️' : c <= 2 ? '⛅' : c === 3 ? '☁️' : c <= 48 ? '🌫️' : c <= 57 ? '🌦️' : c <= 67 ? '🌧️' : c <= 77 ? '❄️' : c <= 82 ? '🌧️' : c <= 86 ? '🌨️' : '⛈️';
function paintWeather(msg) {
    const el = $n('news-wx'); if (!el) return;
    if (msg || !_wxData) { el.textContent = msg || '…'; return; }
    const d = _wxData;
    el.textContent = `${wxIcon(d.weather_code)} ${Math.round(d.temperature_2m)}°C · ${_wxLoc.city}`;
    el.title = `Terasa ${Math.round(d.apparent_temperature)}°C · Lembap ${d.relative_humidity_2m}% · Angin ${Math.round(d.wind_speed_10m)} km/j`;
}
async function loadWeather() {
    if (_wxData && Date.now() - _wxAt < 15 * 60000) return paintWeather();
    paintWeather('…');
    try {
        if (!_wxLoc) {
            const g = await (await fetch('https://ipwho.is/')).json();
            if (!g.success) throw new Error('ip');
            _wxLoc = { lat: g.latitude, lon: g.longitude, city: g.city };
        }
        const u = `https://api.open-meteo.com/v1/forecast?latitude=${_wxLoc.lat}&longitude=${_wxLoc.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
        const j = await (await fetch(u)).json();
        _wxData = j.current; _wxAt = Date.now();
        paintWeather();
    } catch { paintWeather('Cuaca n/a'); }
}

// ─── UI tambahan di header (cuaca + pencarian + bar sumber) ───
function ensureNewsUI() {
    const head = document.querySelector('#news-drawer .news-head');
    if (!head || $n('news-wx')) return;
    const top = head.querySelector('.news-head-top');
    const wx = document.createElement('div'); wx.id = 'news-wx'; wx.className = 'news-wx';
    const s = document.createElement('input');
    s.id = 'news-search'; s.className = 'news-search'; s.type = 'search'; s.placeholder = 'Cari berita  ( / )';
    let t; s.oninput = () => { clearTimeout(t); t = setTimeout(() => { _newsQuery = s.value.trim().toLowerCase(); renderNewsFeed(); }, 200); };
    head.insertBefore(wx, top); head.insertBefore(s, top);
    if (!$n('news-src-bar')) {
        const bar = document.createElement('div'); bar.id = 'news-src-bar'; bar.className = 'news-src-bar';
        head.insertBefore(bar, top);
    }
}

// ─── fetch ───
async function loadNews(manual = false) {
    if (_newsInFlight) return;
    _newsInFlight = true;
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 10000);
    try {
        const res = await fetch('/api/news-queue', { signal: ctrl.signal });
        if (!res.ok) throw new Error('Gagal fetch berita (HTTP ' + res.status + ')');
        const rows = await res.json();
        _newsFails = 0; _newsCountdown = NEWS_POLL_SEC;
        const next = rows.map(r => ({
            id: r.id, source: r.source, status: r.status,
            title: r.text, url: r.link, published_at: r.posted_at || r.created_at,
        }));
        const sig = Math.floor(Date.now() / 60000) + JSON.stringify(next.map(n => [n.id, n.status]));
        if (sig === _newsSig && !manual) return;
        _newsSig = sig;
        if (newsItems.length) {   // hitung berita baru per sumber (badge di ikon)
            const known = new Set(newsItems.map(n => n.id));
            next.forEach(n => { if (!known.has(n.id)) _newsUnread[n.source] = (_newsUnread[n.source] || 0) + 1; });
        }
        newsItems = next;
        renderNewsFeed();
    } catch (e) {
        _newsFails++;
        const msg = e.name === 'AbortError' ? 'Timeout, server terlalu lama merespons' : e.message;
        if (manual) showToast('Gagal muat berita: ' + msg, 'error');
        const feed = $n('news-feed');
        if (feed && !newsItems.length) feed.innerHTML = `<div class="empty-state">${icon('alert')}${esc(msg)}</div>`;
    } finally {
        clearTimeout(to);
        _newsInFlight = false;
    }
}
function newsTimeAgo(iso) {
    const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    if (diff < 1) return 'baru saja';
    if (diff < 60) return diff + 'm lalu';
    const h = Math.floor(diff / 60);
    if (h < 24) return h + 'j lalu';
    return Math.floor(h / 24) + 'h lalu';
}
function ntLinkify(s) {
    return esc(s).replace(/(https?:\/\/[^\s<]+)/g, (u) =>
        `<a href="${u}" target="_blank" rel="noopener">${u.length > 56 ? u.slice(0, 55) + '…' : u}</a>`);
}
function ntClock(iso) {
    return new Date(iso).toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':');
}

// ─── RENDER: panel dibuat sekali & urutannya tetap; hanya isi list yang berubah ───
const newsOpen = new Set();

function newsCardHtml(item) {
    const sent = item.status === 'sent', open = newsOpen.has(item.id);
    return `<div class="nt-card${open ? ' open' : ''}" data-id="${esc(item.id)}">
        <div class="nt-head"><span class="nt-time" data-ts="${esc(item.published_at)}"><b>${ntClock(item.published_at)}</b>${newsTimeAgo(item.published_at)}</span></div>
        <div class="nt-text">${ntLinkify(item.title)}</div>
        <button class="nt-more" type="button" data-more="${esc(item.id)}">${open ? 'Tutup ▲' : 'Lihat semua ▼'}</button>
        <div class="nt-foot">
            <button class="btn-save" data-send="${esc(item.id)}" ${sent ? 'disabled' : ''}>${sent ? 'Terkirim ✓' : icon('send') + 'Kirim'}</button>
            ${/^https?:\/\//i.test(String(item.url || '')) ? `<a href="${esc(item.url)}" target="_blank" rel="noopener">buka post ↗</a>` : ''}
        </div>
    </div>`;
}

function buildNewsPanel(k) {
    const src = newsSrc(k);
    const p = document.createElement('section');
    p.className = 'nt-col'; p.dataset.col = k; p.style.setProperty('--src-color', src.color);
    p.innerHTML = `<div class="nt-col-head"><span class="nt-src">${esc(src.label)}</span>
        <span class="nt-col-tools"><span class="n">0</span><button class="nt-x" type="button" data-hide="${esc(k)}" title="Sembunyikan panel">×</button></span></div>
        <div class="nt-col-list"></div>`;
    return p;
}

function updateNewsPanel(p, k, items) {
    // update INKREMENTAL: kartu yang sudah ada tidak dibuat ulang (terjemahan & posisi scroll aman)
    p.querySelector('.n').textContent = items.length;
    p.classList.toggle('is-empty', !items.length);
    if (p.hidden) return;
    const list = p.querySelector('.nt-col-list');
    const sig = _newsQuery + '|' + items.map(n => n.id + n.status).join();
    if (_newsPanelSig[k] === sig) return;
    _newsPanelSig[k] = sig;

    const t0 = list.scrollTop, h0 = list.scrollHeight;
    const want = new Set(items.map(n => String(n.id)));
    const have = new Map([...list.querySelectorAll(':scope > .nt-card')].map(c => [c.dataset.id, c]));
    have.forEach((c, id) => { if (!want.has(id)) { c.remove(); have.delete(id); } });
    list.querySelector('.nt-empty')?.remove();
    const fresh = [];
    let prev = null;
    items.forEach(n => {
        const id = String(n.id);
        let c = have.get(id);
        if (!c) {
            const t = document.createElement('template'); t.innerHTML = newsCardHtml(n).trim();
            c = t.content.firstElementChild; fresh.push(c);
        } else if (n.status === 'sent') {
            const b = c.querySelector('[data-send]');
            if (b && !b.disabled) { b.disabled = true; b.textContent = 'Terkirim ✓'; }
        }
        const expected = prev ? prev.nextElementSibling : list.firstElementChild;
        if (c !== expected) list.insertBefore(c, expected);
        prev = c;
    });
    if (!items.length) list.innerHTML = `<div class="nt-empty">${_newsQuery ? 'Tidak ada yang cocok' : 'Belum ada berita'}</div>`;
    fresh.forEach(c => {
        const t = c.querySelector('.nt-text');
        if (c.classList.contains('open') || t.scrollHeight > t.clientHeight + 4) c.classList.add('has-more');
    });
    // browser tanpa scroll-anchoring (Safari): kompensasi manual supaya tidak loncat
    if (t0 > 8 && list.scrollTop === t0) list.scrollTop = t0 + (list.scrollHeight - h0);
    if (list.scrollTop < 30) _newsUnread[k] = 0;
}

function renderNewsSrcBar(by) {
    const bar = $n('news-src-bar'); if (!bar) return;
    bar.innerHTML = newsKeys().map(k => {
        const n = (by[k] || []).length, u = _newsUnread[k] || 0, hid = _newsHidden.has(k);
        return `<button class="nsb-ico${n ? '' : ' empty'}${u ? ' has-new' : ''}${hid ? ' off' : ''}" type="button" style="--c:${newsSrc(k).color}" data-jump="${esc(k)}" title="${esc(newsSrc(k).label)}${hid ? ' (disembunyikan, klik untuk tampilkan)' : ''}">${newsAbbr(k)}${u ? `<span class="nsb-badge">${u > 99 ? '99+' : u}</span>` : ''}</button>`;
    }).join('');
}

function renderNewsFeed() {
    const feed = $n('news-feed'); if (!feed) return;
    if (!feed.querySelector('.nt-col')) feed.innerHTML = '';
    const by = {};
    newsKeys().forEach(k => by[k] = []);
    allNews().forEach(n => {
        if (_newsQuery && !String(n.title || '').toLowerCase().includes(_newsQuery)) return;
        (by[n.source] ||= []).push(n);
    });
    Object.values(by).forEach(a => a.sort((x, y) => new Date(y.published_at) - new Date(x.published_at)));
    newsKeys().forEach(k => {
        let p = feed.querySelector(`.nt-col[data-col="${CSS.escape(k)}"]`);
        if (!p) { p = buildNewsPanel(k); feed.appendChild(p); }
        p.hidden = _newsHidden.has(k);
        updateNewsPanel(p, k, by[k]);
    });
    renderNewsSrcBar(by);
    const c = $n('news-count'); if (c) c.textContent = allNews().length;
}

// ─── event: satu delegasi di feed + bar sumber ───
const _newsFeedEl = $n('news-feed');
_newsFeedEl?.addEventListener('click', e => {
    const more = e.target.closest('[data-more]');
    if (more) {
        const card = more.closest('.nt-card'), id = more.dataset.more;
        const open = card.classList.toggle('open');
        open ? newsOpen.add(id) : newsOpen.delete(id);
        more.textContent = open ? 'Tutup ▲' : 'Lihat semua ▼';
        return;
    }
    const send = e.target.closest('[data-send]');
    if (send && !send.disabled) return openNewsSend(send.dataset.send);
    const hide = e.target.closest('[data-hide]');
    if (hide) {
        _newsHidden.add(hide.dataset.hide);
        try { localStorage.setItem('newsHidden', JSON.stringify([..._newsHidden])); } catch {}
        renderNewsFeed();
    }
});
// scroll tidak bubble → pakai capture. Balik ke atas panel = berita baru dianggap sudah dibaca
_newsFeedEl?.addEventListener('scroll', e => {
    const list = e.target; if (!list.classList?.contains('nt-col-list')) return;
    const k = list.closest('.nt-col')?.dataset.col;
    if (k && list.scrollTop < 30 && _newsUnread[k]) { _newsUnread[k] = 0; renderNewsFeed(); }
}, true);
document.addEventListener('click', e => {
    const b = e.target.closest('#news-src-bar [data-jump]'); if (!b) return;
    const k = b.dataset.jump;
    if (_newsHidden.has(k)) {
        _newsHidden.delete(k); delete _newsPanelSig[k];
        try { localStorage.setItem('newsHidden', JSON.stringify([..._newsHidden])); } catch {}
    }
    _newsUnread[k] = 0; renderNewsFeed();
    const p = document.querySelector(`#news-feed .nt-col[data-col="${CSS.escape(k)}"]`);
    if (!p) return;
    p.scrollIntoView({ behavior: 'smooth', block: 'start' });
    p.classList.remove('nt-flash'); void p.offsetWidth; p.classList.add('nt-flash');
});

// Esc menutup terminal; "/" fokus ke pencarian
document.addEventListener('keydown', e => {
    const dr = $n('news-drawer');
    if (!dr || !dr.classList.contains('open')) return;
    if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) { e.preventDefault(); $n('news-search')?.focus(); return; }
    if (e.key !== 'Escape') return;
    const s = $n('news-search');
    if (document.activeElement === s && s.value) { s.value = ''; _newsQuery = ''; renderNewsFeed(); return; }
    const sendOpen = !$n('news-send-modal').classList.contains('hidden');
    if (!sendOpen) toggleNewsPanel();
});
$n('news-overlay')?.addEventListener('click', toggleNewsPanel);

// ─── KIRIM item ke Discord & Telegram (tidak berubah) ───
let _newsSending = null;
function openNewsSend(id) {
    if (isMember()) return;
    const item = allNews().find(n => String(n.id) === String(id));
    if (!item) return;
    _newsSending = item;
    const src = newsSrc(item.source);
    $n('news-send-close-btn').innerHTML = icon('x');
    $n('ns-caption').value = item.title + '\n\nSource: ' + src.label;
    $n('news-send-modal').classList.remove('hidden');
}
function closeNewsSend() {
    $n('news-send-modal').classList.add('hidden');
    _newsSending = null;
}
async function sendNewsItem() {
    const item = _newsSending;
    if (!item) return;
    const src = newsSrc(item.source);
    const description = $n('ns-caption').value.trim();
    if (!description) { showToast('Caption kosong!', 'error'); return; }
    const btn = $n('btn-news-send');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Mengirim...';
    try {
        const data = await postBroadcast({ title: '🚨 ' + src.label, description, url: item.url, queue_id: item.id });
        const dOk = data.discord === 'ok', tOk = data.telegram === 'ok';
        if (dOk && tOk) showToast('Terkirim ke Discord & Telegram!', 'success');
        else if (dOk || tOk) showToast(`Terkirim sebagian — Discord: ${data.discord}, Telegram: ${data.telegram}`, 'error');
        else throw new Error(`Discord: ${data.discord} | Telegram: ${data.telegram}`);
        item.status = 'sent';
        renderNewsFeed();
        closeNewsSend();
    } catch (e) {
        showToast('Gagal kirim: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = icon('send') + 'Kirim';
    }
}

// ─── RSS publik (Antara, CNBC ID, Detik, Kontan, CoinDesk, Decrypt, The Block) ───
async function loadRss() {
    try {
        const got = await Promise.all(['id', 'crypto'].map(src =>
            fetch('/api/admin-airdrop?type=feed&src=' + src).then(r => (r.ok ? r.json() : [])).catch(() => [])));
        const old = new Map(rssItems.map(n => [n.id, n.status]));
        const next = got.filter(Array.isArray).flat().filter(n => NEWS_SOURCES[n.src]).map(n => ({
            id: 'rss:' + n.link, source: n.src, title: n.title, url: n.link,
            published_at: new Date(n.ts).toISOString(), status: old.get('rss:' + n.link) || 'pending',
        }));
        if (rssItems.length) next.forEach(n => { if (!old.has(n.id)) _newsUnread[n.source] = (_newsUnread[n.source] || 0) + 1; });
        rssItems = next;
        renderNewsFeed();
    } catch {}
}
setInterval(() => { if ($n('news-drawer')?.classList.contains('open') && !document.hidden) loadRss(); }, 5 * 60e3);

// ═══ TERJEMAHAN otomatis ke Bahasa Indonesia + batas kartu per panel ═══
(function () {
    const NT_CAP = 20;
    const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } },
                    set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
    const cache = new Map();
    try { Object.entries(JSON.parse(store.get('ntTrCache') || '{}')).forEach(([k, v]) => cache.set(k, v)); } catch {}
    let saveT = null;
    const saveCache = () => { clearTimeout(saveT); saveT = setTimeout(() => {
        store.set('ntTrCache', JSON.stringify(Object.fromEntries([...cache.entries()].slice(-400))));
    }, 1500); };
    let on = store.get('ntTranslate') !== '0';

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

    const openCols = new Set();
    function capCols() {
        document.querySelectorAll('#news-feed .nt-col').forEach(col => {
            const list = col.querySelector('.nt-col-list'); if (!list) return;
            const cards = [...list.children].filter(c => c.classList.contains('nt-card'));
            const key = col.dataset.col;
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

    const mo = new MutationObserver(() => { scan(); capCols(); });
    ['news-feed', 'new-list'].forEach(id => {
        const el = document.getElementById(id);
        if (el) mo.observe(el, { childList: true, subtree: true });
    });
    scan(); capCols();
})();


// ═══════════════════════════════════════════════════════════
// ─── CRYPTO TICKER — ranking CoinGecko (cache 1 jam), harga live Binance (15 dtk)
// ═══════════════════════════════════════════════════════════
const TICKER_REFRESH_MS = 15000;
const RANK_REFRESH_MS = 60 * 60 * 1000;
const BN = 'https://data-api.binance.vision/api/v3';
const TICKER_SKIP = new Set(['usdt','usdc','dai','usde','fdusd','usds','tusd','usdd',
    'pyusd','usd1','steth','wsteth','weth','wbtc','weeth','wbeth','cbbtc','bsc-usd']);
let _tickerInterval = null, _rankInterval = null;
let _topCoins = [];

function formatTickerPrice(n) {
    if (n >= 1) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 0 : 2 });
    return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 6 });
}
async function loadTopCoins() {
    try {
        const [cg, all] = await Promise.all([
            fetch('/api/admin-airdrop?type=markets').then(r => { if (!r.ok) throw new Error('markets ' + r.status); return r.json(); }),
            fetch(`${BN}/ticker/price`).then(r => r.json()),
        ]);
        const pairs = new Set(all.map(x => x.symbol));
        _topCoins = cg
            .filter(c => !TICKER_SKIP.has(c.symbol.toLowerCase()) && pairs.has(c.symbol.toUpperCase() + 'USDT'))
            .slice(0, 10)
            .map(c => ({ sym: c.symbol.toUpperCase(), name: c.name, image: c.image }));
    } catch (e) {
        console.warn('[ticker] ranking gagal, pakai list lama/fallback:', e.message);
        if (!_topCoins.length) {
            _topCoins = ['BTC','ETH','BNB','SOL','XRP','DOGE','ADA','TRX','AVAX','LINK']
                .map(s => ({ sym: s, name: s, image: null }));
        }
    }
}
async function loadCryptoTicker() {
    const track = document.getElementById('ticker-track');
    if (!track) return;
    try {
        if (!_topCoins.length) await loadTopCoins();
        const symbols = _topCoins.map(c => c.sym + 'USDT');
        const res = await fetch(`${BN}/ticker/24hr?symbols=` + encodeURIComponent(JSON.stringify(symbols)));
        if (!res.ok) throw new Error('Gagal fetch harga Binance');
        const data = await res.json();
        const map = Object.fromEntries(data.map(d => [d.symbol, d]));
        const itemsHtml = _topCoins.map((c, i) => {
            const d = map[c.sym + 'USDT'];
            if (!d) return '';
            const price = Number(d.lastPrice), chg = Number(d.priceChangePercent);
            return `
            <div class="ticker-item">
                <span class="ticker-rank">#${i + 1}</span>
                ${c.image ? `<img class="ticker-icon" src="${esc(c.image)}" alt="" onerror="this.style.display='none'" />` : ''}
                <span class="ticker-sym">${esc(c.sym)}</span>
                <span class="ticker-name">${esc(c.name)}</span>
                <span class="ticker-price">${formatTickerPrice(price)}</span>
                <span class="ticker-chg ${chg >= 0 ? 'up' : 'down'}">${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%</span>
            </div>`;
        }).join('');
        track.innerHTML = itemsHtml + itemsHtml;   // duplikat biar loop mulus
    } catch (e) {
        console.warn('[ticker]', e.message);
        if (!track.querySelector('.ticker-item')) {
            track.innerHTML = `<div class="empty-state" style="padding:0 1.6rem;">${icon('alert')}Gagal muat harga crypto</div>`;
        }
    }
}
async function startCryptoTicker() {
    await loadTopCoins();
    await loadCryptoTicker();
    clearInterval(_tickerInterval); clearInterval(_rankInterval);
    _tickerInterval = setInterval(loadCryptoTicker, TICKER_REFRESH_MS);
    _rankInterval = setInterval(loadTopCoins, RANK_REFRESH_MS);
}

// ═══ NEW LISTINGS FEED (via /api/nlf-stream) ═══
let _nlfSrc = null, _nlfItems = [], _nlfShowAll = false, _nlfTimer = null;

function setNLFStatus(state, msg) {
    const dot = document.getElementById('nlf-dot'), st = document.getElementById('nlf-status');
    if (!dot || !st) return;
    dot.className = 'nlf-dot' + (state === 'live' ? ' live' : state === 'error' ? ' error' : '');
    st.textContent = state === 'live' ? 'Live ·' : state === 'error' ? (msg || 'Terputus') : 'Menghubungkan...';
}
async function loadNLFHistory() {
    try {
        const res = await fetch('/api/admin-airdrop?type=nlf-history');
        if (!res.ok) return;
        const rows = await res.json();
        const seen = new Set(_nlfItems.map(x => x.detected_time_us));
        rows.forEach(r => { if (!seen.has(r.detected_time_us)) _nlfItems.push(r); });
        _nlfItems.sort((a, b) => b.sent_time_us - a.sent_time_us);
        renderNLF();
    } catch {}
}
function startNLF() {
    if (_nlfSrc) return;
    loadNLFHistory();
    setNLFStatus('connecting');
    const src = new EventSource('/api/admin-airdrop?type=nlf-stream');
    _nlfSrc = src;
    src.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (/upbit/i.test(e.data)) console.log('[NLF upbit]', m);
        if (m.type === 'success' && m.code === 'READY') { setNLFStatus('live'); return; }
        if (m.type === 'error') {
            if (m.code === 'AUTHENTICATION_FAILED' || m.code === 'KEY_EXPIRED') {
                src.close(); _nlfSrc = null; setNLFStatus('error', 'Key ditolak / expired');
            }
            return;
        }
        if (m.type === 'announcement' || m.type === 'tweet') {
            if (_nlfItems.some(x => x.detected_time_us === m.detected_time_us)) return;
            _nlfItems.unshift(m);
            if (_nlfItems.length > 100) _nlfItems.pop();
            renderNLF();
        }
    };
    src.onerror = () => {
        if (src.readyState === EventSource.CLOSED) {
            _nlfSrc = null; setNLFStatus('error', 'Offline — login lewat terminal untuk aktifin feed');
        } else setNLFStatus('connecting');
    };
    clearInterval(_nlfTimer);
    _nlfTimer = setInterval(renderNLF, 30000);
}
function toggleNLFAll() {
    _nlfShowAll = !_nlfShowAll;
    document.getElementById('nlf-toggle').classList.toggle('active', _nlfShowAll);
    renderNLF();
}

let _cexItems = [];

function renderNLF() {
    const list = document.getElementById('new-list');
    if (!list) return;
    const channelCard = `<a class="nlf-card channel" href="https://t.me/NewListingsFeed" target="_blank" rel="noopener">
        <div class="nlf-top"><span class="nlf-ex">Telegram</span><span class="nlf-time">channel</span></div>
        <div class="nlf-text">New Listings Feed — alert listing &amp; delisting semua exchange</div>
        <span class="nlf-badge channel">@NewListingsFeed ↗</span>
    </a>`;

    const listings = _nlfItems
        .filter(m => _nlfShowAll || /upbit/i.test(JSON.stringify(m)) || (m.parser?.classification?.event && m.parser.classification.event !== 'none'))
        .map(m => {
            const c = m.parser?.classification || {};
            const ev = c.event || 'none';
            const isUpbit = /upbit/i.test(m.exchange || m.parser?.exchange || m.username || '');
            const assets = (m.parser?.assets || []).map(a => '$' + a.symbol).join(', ');
            const mk = (c.markets || []).map(x => String(x).toUpperCase()).join(', ');
            const text = isUpbit && assets
                ? `${assets} · Upbit spot${mk ? ' (' + mk + ')' : ''}`
                : (m.parser?.display || m.content?.title || m.content?.text || '(tanpa teks)');
            const ex = isUpbit ? 'Upbit' : (m.parser?.exchange || m.username || '');
            const href = /^https?:\/\//.test(m.url || '') ? m.url : '#';
            const ts = m.sent_time_us / 1000;
            return { ts, html: `<a class="nlf-card ${esc(ev)}" href="${esc(href)}" target="_blank" rel="noopener">
                <div class="nlf-top"><span class="nlf-ex">${esc(ex)}</span><span class="nlf-time">${newsTimeAgo(new Date(ts).toISOString())}</span></div>
                <div class="nlf-text">${esc(text)}</div>
                ${ev !== 'none' ? `<span class="nlf-badge ${esc(ev)}">${esc(ev)}${c.type ? ' · ' + esc(c.type) : ''}</span>` : ''}
            </a>` };
        });

    const founds = _cexItems.map(a => {
        const unk = a.ticker === 'UNKNOWN';
        const text = unk ? esc(a.name || 'Ticker tidak terbaca')
                         : `$${esc(a.ticker)}${a.name ? ' · ' + esc(a.name) : ''}`;
        const ts = Number(a.ts) || Date.now();
        const nets = (a.networks || []).join(', ');
        return { ts, html: `<div class="nlf-card listing">
            <div class="nlf-top"><span class="nlf-ex">${esc(a.exchange)}</span><span class="nlf-time">${newsTimeAgo(new Date(ts).toISOString())}</span></div>
            <div class="nlf-text">${text}</div>
            <span class="nlf-badge listing">found${nets ? ' · ' + esc(nets) : ''}</span>
        </div>` };
    });

    const all = [...listings, ...founds].sort((a, b) => b.ts - a.ts);
    list.innerHTML = channelCard + (all.length
        ? all.map(x => x.html).join('')
        : '<div class="nlf-empty">Menunggu listing baru...</div>');
}

// ═══ CEX FOUND (dari userbot Telegram) ═══
let _cexTimer = null, _cexSig = '';
async function loadCexFound() {
    if (document.hidden) return;
    try {
        const res = await fetch('/api/admin-airdrop?type=cex-found');
        if (res.status === 401) { _cexItems = []; _cexSig = ''; renderNLF(); return; }
        if (!res.ok) return;
        const rows = await res.json();
        const sig = rows.map(a => `${a.ticker}${a.exchange}${a.ts}`).join();
        if (sig === _cexSig) return;
        _cexSig = sig;
        _cexItems = rows;
        renderNLF();
    } catch {}
}
function startCexFound() {
    if (_cexTimer) return;
    loadCexFound();
    _cexTimer = setInterval(loadCexFound, 20000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) loadCexFound(); });
}