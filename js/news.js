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
   listingv2:      { label: 'New Listing & Delisting V2', color: '#f97316' },   // BARU

};
const NEWS_POLL_SEC = 30; // cek antrian tiap 10 detik (poller Telegram jalan tiap menit di Supabase)
let newsItems = [], newsFilter = 'all', _newsCountdown = NEWS_POLL_SEC, _newsCountdownInt = null, _newsClockInt = null, _newsSig = '';
let _newsInFlight = false, _newsFails = 0;

function toggleNewsPanel() {
    const drawer = document.getElementById('news-drawer');
    const overlay = document.getElementById('news-overlay');
    if (!drawer) return;
    const opening = !drawer.classList.contains('open');
    drawer.classList.toggle('open'); overlay.classList.toggle('show');
    if (opening) {
        _newsFails = 0; _newsCountdown = NEWS_POLL_SEC;
        loadNews();
        if (!_newsClockInt) { tickNewsClock(); _newsClockInt = setInterval(tickNewsClock, 1000); }
        if (!_newsCountdownInt) _newsCountdownInt = setInterval(tickNewsCountdown, 1000);
    } else {
        // drawer ditutup: hentikan polling sepenuhnya
        clearInterval(_newsClockInt); clearInterval(_newsCountdownInt);
        _newsClockInt = _newsCountdownInt = null;
    }
}
function tickNewsClock() {
    const el = document.getElementById('news-clock');
    if (el) el.textContent = new Date().toLocaleTimeString('id-ID', { hour12: false, timeZone: 'Asia/Jakarta' });
}
function tickNewsCountdown() {
    _newsCountdown--;
    if (_newsCountdown <= 0) {
        // backoff: 10s → 20s → 40s → 80s → maks 120s kalau terus gagal
        _newsCountdown = Math.min(NEWS_POLL_SEC * Math.pow(2, _newsFails), 120);
        loadNews();
    }
    const el = document.getElementById('news-countdown');
    if (el) el.textContent = `${String(Math.floor(_newsCountdown/60)).padStart(2,'0')}:${String(_newsCountdown%60).padStart(2,'0')}`;
}
async function loadNews(manual = false) {
    if (_newsInFlight) return;               // jangan numpuk request
    _newsInFlight = true;
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 10000);   // maks 10 detik per request
    try {
       const res = await fetch('/api/news-queue', { signal: ctrl.signal });
        if (!res.ok) throw new Error('Gagal fetch berita (HTTP ' + res.status + ')');
        const rows = await res.json();
        _newsFails = 0;
        _newsCountdown = NEWS_POLL_SEC;
        const next = rows.map(r => ({
            id: r.id, source: r.source, status: r.status,
            title: r.text, url: r.link, published_at: r.posted_at || r.created_at,
        }));
        const sig = Math.floor(Date.now() / 60000) + JSON.stringify(next.map(n => [n.id, n.status]));
        if (sig === _newsSig && !manual) return;
        _newsSig = sig;
        newsItems = next;
        renderNewsFilters(); renderNewsFeed();
    } catch (e) {
        _newsFails++;
        const msg = e.name === 'AbortError' ? 'Timeout, server terlalu lama merespons' : e.message;
        if (manual) showToast('Gagal muat berita: ' + msg, 'error');
        const feed = document.getElementById('news-feed');
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

function renderNewsFilters() {
    const row = document.getElementById('news-filters');
    if (!row) return;
    const counts = { all: newsItems.length };
    Object.keys(NEWS_SOURCES).forEach(k => counts[k] = newsItems.filter(n => n.source === k).length);
    const chips = [{ key: 'all', label: 'All' }, ...Object.entries(NEWS_SOURCES).map(([key, v]) => ({ key, label: v.label }))];
    row.innerHTML = chips.map(c => `<div class="news-chip ${c.key === newsFilter ? 'active' : ''} ${counts[c.key] ? '' : 'zero'}" data-key="${c.key}">${esc(c.label)} <span class="n">${counts[c.key] || 0}</span></div>`).join('');
    row.querySelectorAll('.news-chip').forEach(el => { el.onclick = () => { newsFilter = el.dataset.key; renderNewsFilters(); renderNewsFeed(); }; });
}

const newsOpen = new Set();   // id kartu yang sedang dibuka penuh (tahan saat auto-refresh)

function renderNewsFeed() {
    const feed = document.getElementById('news-feed');
    const countEl = document.getElementById('news-count');
    if (!feed) return;
    const items = newsItems.filter(n => newsFilter === 'all' || n.source === newsFilter).sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    if (countEl) countEl.textContent = items.length;
    if (!items.length) { feed.innerHTML = `<div class="empty-state">${icon('ghost')}Belum ada berita.</div>`; return; }

    const keep = feed.scrollTop;
    feed.innerHTML = items.map(item => {
        const src = NEWS_SOURCES[item.source] || { label: item.source, color: 'var(--primary)' };
        const sent = item.status === 'sent';
        const open = newsOpen.has(item.id);
        return `<div class="nt-card${open ? ' open' : ''}" style="--src-color:${src.color}">
            <div class="nt-head">
                <span class="nt-src">${esc(src.label)}</span>
                <span class="nt-time"><b>${ntClock(item.published_at)}</b>${newsTimeAgo(item.published_at)}</span>
            </div>
            <div class="nt-text">${ntLinkify(item.title)}</div>
            <button class="nt-more" type="button" data-more="${esc(item.id)}">${open ? 'Tutup ▲' : 'Lihat semua ▼'}</button>
            <div class="nt-foot">
                <button class="btn-save" data-send="${esc(item.id)}" ${sent ? 'disabled' : ''}>${sent ? 'Terkirim ✓' : icon('send') + 'Kirim'}</button>
                ${item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noopener">buka post ↗</a>` : ''}
            </div>
        </div>`;
    }).join('');

    // tombol "Lihat semua" hanya muncul di kartu yang teksnya terpotong
    feed.querySelectorAll('.nt-card').forEach(c => {
        const t = c.querySelector('.nt-text');
        if (c.classList.contains('open') || t.scrollHeight > t.clientHeight + 4) c.classList.add('has-more');
    });
    feed.scrollTop = keep;
}

document.getElementById('news-feed')?.addEventListener('click', e => {
    const b = e.target.closest('[data-more]');
    if (!b) return;
    const card = b.closest('.nt-card'), id = b.dataset.more;
    const open = card.classList.toggle('open');
    open ? newsOpen.add(id) : newsOpen.delete(id);
    b.textContent = open ? 'Tutup ▲' : 'Lihat semua ▼';
});

// Esc menutup News Terminal (kecuali modal Kirim sedang terbuka)
document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
    const dr = document.getElementById('news-drawer');
    const sendOpen = !document.getElementById('news-send-modal').classList.contains('hidden');
    if (dr && dr.classList.contains('open') && !sendOpen) toggleNewsPanel();
});
        
// ─── KIRIM item News Terminal ke Discord & Telegram (lewat endpoint broadcast-news yang sama) ───
let _newsSending = null;
function openNewsSend(id) {
    if (isMember()) return;
    const item = newsItems.find(n => String(n.id) === String(id));
    if (!item) return;
    _newsSending = item;
    const src = NEWS_SOURCES[item.source] || { label: item.source };
    document.getElementById('news-send-close-btn').innerHTML = icon('x');
    document.getElementById('ns-caption').value = item.title + '\n\nSource: ' + src.label;
    document.getElementById('news-send-modal').classList.remove('hidden');
}
function closeNewsSend() {
    document.getElementById('news-send-modal').classList.add('hidden');
    _newsSending = null;
}
async function sendNewsItem() {
    const item = _newsSending;
    if (!item) return;
    const src = NEWS_SOURCES[item.source] || { label: item.source };
    const description = document.getElementById('ns-caption').value.trim();
    if (!description) { showToast('Caption kosong!', 'error'); return; }

    const btn = document.getElementById('btn-news-send');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Mengirim...';
       try {
        const data = await postBroadcast({ title: '🚨 ' + src.label, description, url: item.url, queue_id: item.id });

        const dOk = data.discord === 'ok', tOk = data.telegram === 'ok';
        if (dOk && tOk) showToast('Terkirim ke Discord & Telegram!', 'success');
        else if (dOk || tOk) showToast(`Terkirim sebagian — Discord: ${data.discord}, Telegram: ${data.telegram}`, 'error');
        else throw new Error(`Discord: ${data.discord} | Telegram: ${data.telegram}`);

        item.status = 'sent';   // langsung ditandai, nggak nunggu cek berikutnya
        renderNewsFeed();
        closeNewsSend();
    } catch (e) {
        showToast('Gagal kirim: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = icon('send') + 'Kirim';
    }
}
document.getElementById('news-feed')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-send]');
    if (btn && !btn.disabled) openNewsSend(btn.dataset.send);
});
document.getElementById('news-overlay')?.addEventListener('click', toggleNewsPanel);
// ─── News Terminal: tarik tepi kiri untuk ubah lebar ───
(function initNewsResize() {
    const drawer = document.getElementById('news-drawer');
    const handle = document.getElementById('news-resizer');
    if (!drawer || !handle) return;
    const KEY = 'newsDrawerW', MIN = 320, DEF = 760;
    const maxW = () => Math.round(window.innerWidth * 0.94);
    const apply = (w) => drawer.style.setProperty('--news-w', Math.min(maxW(), Math.max(MIN, Math.round(w))) + 'px');
    try { const saved = +localStorage.getItem(KEY); if (saved) apply(saved); } catch {}

    let dragging = false, moved = false, startX = 0, startW = 0;
    handle.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        dragging = true; moved = false;
        startX = e.clientX; startW = drawer.getBoundingClientRect().width;
        handle.setPointerCapture(e.pointerId);
        document.body.classList.add('news-resizing');
        e.preventDefault();
    });
    handle.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        if (Math.abs(e.clientX - startX) > 3) moved = true;
        apply(startW + (startX - e.clientX));   // drawer nempel kanan: geser kiri = melebar
    });
    const end = (e) => {
        if (!dragging) return;
        dragging = false;
        document.body.classList.remove('news-resizing');
        try { handle.releasePointerCapture(e.pointerId); } catch {}
        try { localStorage.setItem(KEY, String(Math.round(drawer.getBoundingClientRect().width))); } catch {}
        if (moved) {   // cegah klik susulan menutup drawer lewat overlay
            const eat = (ev) => ev.stopPropagation();
            window.addEventListener('click', eat, true);
            setTimeout(() => window.removeEventListener('click', eat, true), 0);
        }
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    handle.addEventListener('dblclick', () => { apply(DEF); try { localStorage.removeItem(KEY); } catch {} });
    window.addEventListener('resize', () => { if (drawer.getBoundingClientRect().width > maxW()) apply(maxW()); });
})();

        // ═══════════════════════════════════════════════════════════
// ─── CRYPTO TICKER — Ranking dari CoinGecko (via /api/markets, cache 1 jam),
//     harga live dari Binance (refresh 15 detik)
// ═══════════════════════════════════════════════════════════
const TICKER_REFRESH_MS = 15000;
const RANK_REFRESH_MS = 60 * 60 * 1000;
const BN = 'https://data-api.binance.vision/api/v3';

// Stablecoin & wrapped/staked token nggak punya pair USDT di Binance
const TICKER_SKIP = new Set(['usdt','usdc','dai','usde','fdusd','usds','tusd','usdd',
    'pyusd','usd1','steth','wsteth','weth','wbtc','weeth','wbeth','cbbtc','bsc-usd']);

let _tickerInterval = null, _rankInterval = null;
let _topCoins = []; // [{ sym, name, image }]

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
            const price = Number(d.lastPrice);
            const chg = Number(d.priceChangePercent);
            const chgCls = chg >= 0 ? 'up' : 'down';
            const chgSign = chg >= 0 ? '+' : '';
            return `
            <div class="ticker-item">
                <span class="ticker-rank">#${i + 1}</span>
                ${c.image ? `<img class="ticker-icon" src="${esc(c.image)}" alt="" onerror="this.style.display='none'" />` : ''}
                <span class="ticker-sym">${esc(c.sym)}</span>
                <span class="ticker-name">${esc(c.name)}</span>
                <span class="ticker-price">${formatTickerPrice(price)}</span>
                <span class="ticker-chg ${chgCls}">${chgSign}${chg.toFixed(2)}%</span>
            </div>`;
        }).join('');

        // Duplikat sekali biar loop scroll-nya mulus
        track.innerHTML = itemsHtml + itemsHtml;
    } catch (e) {
        console.warn('[ticker]', e.message);
        // Kalau udah ada data sebelumnya, biarin tampil (jangan diganti error)
        if (!track.querySelector('.ticker-item')) {
            track.innerHTML = `<div class="empty-state" style="padding:0 1.6rem;">${icon('alert')}Gagal muat harga crypto</div>`;
        }
    }
}

async function startCryptoTicker() {
    await loadTopCoins();
    await loadCryptoTicker();
    clearInterval(_tickerInterval);
    clearInterval(_rankInterval);
    _tickerInterval = setInterval(loadCryptoTicker, TICKER_REFRESH_MS); // harga tiap 15 dtk
    _rankInterval = setInterval(loadTopCoins, RANK_REFRESH_MS);         // ranking tiap 1 jam
}

// ═══ NEW LISTINGS FEED (via /api/nlf-stream) ═══
let _nlfSrc = null, _nlfItems = [], _nlfShowAll = false, _nlfTimer = null;

function setNLFStatus(state, msg) {
    const dot = document.getElementById('nlf-dot'), st = document.getElementById('nlf-status');
    if (!dot || !st) return;
    dot.className = 'nlf-dot' + (state === 'live' ? ' live' : state === 'error' ? ' error' : '');
    st.textContent = state === 'live' ? 'Live ·'
        : state === 'error' ? (msg || 'Terputus') : 'Menghubungkan...';
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
    _nlfTimer = setInterval(renderNLF, 30000); // update "x menit lalu"
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

    // kartu channel Telegram, selalu paling kiri
    const channelCard = `<a class="nlf-card channel" href="https://t.me/NewListingsFeed" target="_blank" rel="noopener">
        <div class="nlf-top"><span class="nlf-ex">Telegram</span><span class="nlf-time">channel</span></div>
        <div class="nlf-text">New Listings Feed — alert listing &amp; delisting semua exchange</div>
        <span class="nlf-badge channel">@NewListingsFeed ↗</span>
    </a>`;

    // 1) new listings
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

    // 2) cex found
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

    // gabung, urut terbaru di kiri
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
        if (sig === _cexSig) return;   // tidak ada perubahan
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
