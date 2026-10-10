// ─── MOUSE GLOW ───
        // Dimatikan lewat CSS (.mouse-glow { display:none }) supaya gak ada
        // repaint tiap mousemove. Listener dibiarkan no-op ringan kalau nanti
        // mau diaktifkan lagi tinggal hapus display:none di CSS.
        window.addEventListener('mousemove', e => {
            const glow = document.getElementById('mouse-glow');
            if (glow) { glow.style.left = e.clientX + 'px'; glow.style.top = e.clientY + 'px'; }
        }, { passive: true });

        // ─── LOGIN PARTICLES (efek visual doang, gak ada suara) ───
function spawnLoginParticles(count = 22) {
    const wrap = document.getElementById('login-particles');
    if (!wrap) return;
    wrap.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const p = document.createElement('span');
        p.className = 'login-particle';
        const size = 2 + Math.random() * 4;
        p.style.left = Math.random() * 100 + '%';
        p.style.width = size + 'px';
        p.style.height = size + 'px';
        p.style.animationDuration = (5 + Math.random() * 6) + 's';
        p.style.animationDelay = (Math.random() * 6) + 's';
        p.style.setProperty('--drift', (Math.random() * 60 - 30) + 'px');
        p.style.background = Math.random() > 0.5 ? 'var(--primary)' : 'var(--secondary)';
        wrap.appendChild(p);
    }
}
        // ─── HURUF BERJATUHAN DI LOGIN (X I O B A I I, warna-warni) ───
function spawnLoginLetters(count = 30) {
    const wrap = document.getElementById('login-letters');
    if (!wrap) return;
    const letters = '𝐈𝐧𝐧𝐞𝐫 𝐂𝐢𝐫𝐜𝐥𝐞'.split('');
    const colors = ['#8B5CF6', '#2E8BFF', '#35E0A1', '#FFD23F', '#38BDF8', '#F59E0B'];
    wrap.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const el = document.createElement('span');
        el.className = 'login-letter';
        el.textContent = letters[Math.floor(Math.random() * letters.length)];
        const dur = 8 + Math.random() * 10;
        el.style.left = Math.random() * 100 + '%';
        el.style.fontSize = (20 + Math.random() * 40) + 'px';
        el.style.color = colors[Math.floor(Math.random() * colors.length)];
        el.style.animationDuration = dur + 's';
        el.style.animationDelay = (-Math.random() * dur) + 's';   // negatif: langsung sudah jatuh saat dibuka
        el.style.setProperty('--op', (0.18 + Math.random() * 0.25).toFixed(2));
        el.style.setProperty('--rot0', (Math.random() * 60 - 30) + 'deg');
        el.style.setProperty('--rot1', (Math.random() * 360 - 180) + 'deg');
        wrap.appendChild(el);
    }
}

        // ─── KOIN CRYPTO BERJATUHAN DI LOGIN — TOP 20 MARKETCAP (dinamis) ───
const FC_TOP_N = 20;
const FC_SLOTS = 16;
const FC_RANK_REFRESH_MS = 60 * 60 * 1000; // cek ulang ranking tiap 1 jam
const FC_FALLBACK = ['BTC','ETH','BNB','SOL','XRP','DOGE','ADA','TRX','AVAX','LINK',
    'DOT','TON','SHIB','LTC','BCH','NEAR','UNI','APT','ICP','ETC'];
const _fc = { coins: [], price: {}, chg: {}, ws: null, run: false, rankTimer: null };

function fcFmt(n) {
    if (!n) return '--';
    if (n >= 1) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 0 : 2 });
    return '$' + n.toLocaleString('en-US', { maximumSignificantDigits: 4 });
}

function fcColor(sym) { // warna fallback konsisten per simbol kalau logo gagal load
    let h = 0; for (const ch of sym) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return `hsl(${h} 80% 62%)`;
}

function fcRefreshDom(sym) {
    const p = _fc.price[sym], ch = _fc.chg[sym] || 0;
    document.querySelectorAll(`.fall-coin[data-sym="${sym}"]`).forEach(el => {
        el.querySelector('.fc-price').textContent = fcFmt(p);
        el.classList.toggle('up', ch >= 0);
        el.classList.toggle('down', ch < 0);
    });
}

// Ambil ranking top 20 dari CoinGecko (via /api/markets), cocokkan dengan pair Binance
async function fcLoadRanking() {
    let next = [];
    try {
        const [cg, all] = await Promise.all([
          fetch('/api/admin-airdrop?type=markets').then(r => { if (!r.ok) throw new Error('markets ' + r.status); return r.json(); }),
         fetch(`${BN}/ticker/price`).then(r => r.json()),
         ]);
        const pairs = new Set(all.map(x => x.symbol));
        const seen = new Set();
        next = cg
            .filter(c => {
                const s = c.symbol.toUpperCase();
                if (TICKER_SKIP.has(c.symbol.toLowerCase()) || seen.has(s)) return false;
                if (!pairs.has(s + 'USDT')) return false;
                seen.add(s); return true;
            })
            .slice(0, FC_TOP_N)
            .map(c => ({ sym: c.symbol.toUpperCase(), name: c.name, image: c.image }));
    } catch (e) {
        console.warn('[fall-coins] ranking gagal:', e.message);
        if (_fc.coins.length) return false; // pakai list lama
        next = FC_FALLBACK.map(s => ({ sym: s, name: s, image: null }));
    }
    const changed = next.map(c => c.sym).join() !== _fc.coins.map(c => c.sym).join();
    _fc.coins = next;
    return changed;
}

async function fcLoadPrices() {
    try {
        const syms = _fc.coins.map(c => c.sym + 'USDT');
        const res = await fetch(`${BN}/ticker/24hr?symbols=` + encodeURIComponent(JSON.stringify(syms)));
        const data = await res.json();
        data.forEach(d => {
            const s = d.symbol.replace('USDT', '');
            _fc.price[s] = +d.lastPrice; _fc.chg[s] = +d.priceChangePercent;
        });
    } catch (e) { console.warn('[fall-coins] REST gagal:', e.message); }
}

function fcConnectWS() {
    if (_fc.ws) { _fc.ws.onclose = null; _fc.ws.close(); _fc.ws = null; } // tutup koneksi lama dulu
    if (!_fc.run || !_fc.coins.length) return;
    try {
        const streams = _fc.coins.map(c => c.sym.toLowerCase() + 'usdt@miniTicker').join('/');
        const ws = new WebSocket('wss://data-stream.binance.vision/stream?streams=' + streams);
        _fc.ws = ws;
        ws.onmessage = (e) => {
            const d = JSON.parse(e.data).data;
            if (!d) return;
            const s = d.s.replace('USDT', '');
            const price = +d.c, open = +d.o;
            _fc.price[s] = price;
            _fc.chg[s] = open ? ((price - open) / open) * 100 : 0;
            fcRefreshDom(s);
        };
        ws.onclose = () => { if (_fc.run && _fc.ws === ws) setTimeout(fcConnectWS, 3000); };
    } catch (e) { console.warn('[fall-coins] WS gagal:', e.message); }
}

// Dipanggil tiap jam: kalau ranking bergeser, update list + resubscribe WS
async function fcRefreshRanking() {
    const changed = await fcLoadRanking();
    if (changed) { await fcLoadPrices(); fcConnectWS(); }
}

function fcImpact(wrap, x, y, color) {
    const ring = document.createElement('div');
    ring.className = 'coin-impact';
    ring.style.cssText = `left:${x}px;top:${y}px;--c:${color}`;
    wrap.appendChild(ring);
    ring.animate(
        [{ transform: 'scale(.15)', opacity: .9 }, { transform: 'scale(1.8)', opacity: 0 }],
        { duration: 650, easing: 'ease-out' }
    ).onfinish = () => ring.remove();

    for (let i = 0; i < 8; i++) {
        const sh = document.createElement('div');
        sh.className = 'coin-shard';
        sh.style.cssText = `left:${x}px;top:${y}px;--c:${color}`;
        wrap.appendChild(sh);
        const dx = (Math.random() - .5) * 220, up = 40 + Math.random() * 110;
        sh.animate([
            { transform: 'translate(0,0) rotate(0)', opacity: 1, offset: 0 },
            { transform: `translate(${dx * .6}px,${-up}px) rotate(180deg)`, opacity: 1, offset: .45 },
            { transform: `translate(${dx}px,${up * .4}px) rotate(420deg)`, opacity: 0, offset: 1 },
        ], { duration: 700 + Math.random() * 300, easing: 'ease-out' }).onfinish = () => sh.remove();
    }
}

function fcSpawn(wrap) {
    if (!_fc.run || !_fc.coins.length) return;
    const idx = Math.floor(Math.random() * _fc.coins.length);
    const coin = _fc.coins[idx];
    const ch = _fc.chg[coin.sym] || 0;
    const dumping = ch < 0;

    const el = document.createElement('div');
    el.className = 'fall-coin ' + (dumping ? 'down' : 'up');
    el.dataset.sym = coin.sym;
    const fallbackIco = `<span class="fc-ico" style="background:${fcColor(coin.sym)}">${esc(coin.sym.slice(0, 3))}</span>`;
    el.innerHTML = `${coin.image ? `<img class="fc-ico fc-img" src="${esc(coin.image)}" alt="" />` : fallbackIco}
    <span class="fc-price"></span>`;
    const img = el.querySelector('.fc-img');
    if (img) img.onerror = () => img.outerHTML = fallbackIco;
    wrap.appendChild(el);
    fcRefreshDom(coin.sym);

    const W = wrap.clientWidth, H = wrap.clientHeight;
    const x = Math.random() * Math.max(80, W - 100);
    const drift = (Math.random() - .5) * 120;
    const scale = .75 + Math.random() * .35;
    const r0 = (Math.random() - .5) * 20, r1 = r0 + (dumping ? 1 : -1) * (15 + Math.random() * 40);
    // koin merah jatuh cepat & brutal, koin hijau lebih "melayang"
    const dur = dumping ? 1800 + Math.random() * 1400 : 3800 + Math.random() * 2600;
    const yEnd = H - 34;

    el.style.opacity = .9;
    el.animate([
        { transform: `translate(${x}px,-70px) scale(${scale}) rotate(${r0}deg)` },
        { transform: `translate(${x + drift}px,${yEnd}px) scale(${scale}) rotate(${r1}deg)` },
    ], {
        duration: dur,
        easing: 'cubic-bezier(.55,.05,.95,.4)', // pelan di awal, makin ngebut (gravitasi)
        fill: 'forwards',
    }).onfinish = () => {
        fcImpact(wrap, x + drift + 42, yEnd + 30, dumping ? '#EF4444' : '#35E0A1');
        el.animate([{ opacity: .9 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }).onfinish = () => el.remove();
        setTimeout(() => fcSpawn(wrap), 200 + Math.random() * 1200);
    };
}

async function startFallingCoins() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const wrap = document.getElementById('login-coins');
    if (!wrap) return;
    _fc.run = true;
    await fcLoadRanking();
    await fcLoadPrices();
    if (!_fc.run) return;
    fcConnectWS();
    clearInterval(_fc.rankTimer);
    _fc.rankTimer = setInterval(fcRefreshRanking, FC_RANK_REFRESH_MS);
    for (let i = 0; i < FC_SLOTS; i++) setTimeout(() => fcSpawn(wrap), Math.random() * 5000);
}

function stopFallingCoins() {
    _fc.run = false;
    clearInterval(_fc.rankTimer);
    if (_fc.ws) { _fc.ws.onclose = null; _fc.ws.close(); _fc.ws = null; }
    document.getElementById('login-coins')?.replaceChildren();
}

        // ─── GOOGLE LOGIN ───
        const YOUR_CLIENT_ID = '1041020002267-qj0oaoco5idr8obsfsemcm1n9tihue0p.apps.googleusercontent.com';

        async function handleCredentialResponse(response) {
    try {
        const res = await fetch('/api/verify-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: response.credential }),
        });
        const result = await res.json();
        if (res.ok && result.success) {
          enterAdmin();
        } else {
            alert(`Akses ditolak: ${result.message || 'Unauthorized'}`);
            google.accounts.id.disableAutoSelect();
        }
    } catch (err) {
        alert('Verifikasi gagal. Coba lagi nanti.');
    }
}

               // ─── MASUK PANEL (dipakai login Google & restore sesi) ───
let _entered = false;
function enterAdmin(role = 'admin') {
    if (_entered) return;
    _entered = true;
    document.body.classList.toggle('is-member', role === 'member');
    stopFallingCoins();
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('admin-content').classList.remove('hidden');
    if (role !== 'member') loadProjects();
    startNLF();
    startCexFound();
    xlStart();
}

async function checkSession() {
    try {
        const r = await fetch('/api/admin-airdrop?type=session', { cache: 'no-store' });
        if (!r.ok) return null;
        const d = await r.json();
        return d.authenticated ? d : null;
    } catch { return null; }
}

const LOGIN_ERRORS = {
    not_member: 'Akun Discord kamu belum join server.',
    no_role:    'Kamu belum punya role yang diizinkan.',
    cancelled:  'Login Discord dibatalkan.',
    state:      'Sesi login kedaluwarsa, coba lagi.',
    ratelimit:  'Terlalu banyak percobaan, coba lagi sebentar.',
    config:     'Login Discord belum dikonfigurasi di server.',
};
function showLoginError() {
    const code = new URLSearchParams(location.search).get('login_error');
    if (!code) return;
    const el = document.getElementById('login-error');
    el.textContent = LOGIN_ERRORS[code] || 'Login gagal, coba lagi.';
    el.classList.remove('hidden');
    history.replaceState(null, '', location.pathname);
}

function showLogin() {
    document.getElementById('login-section').classList.remove('checking');
    showLoginError();
    google.accounts.id.initialize({ client_id: YOUR_CLIENT_ID, callback: handleCredentialResponse });
    google.accounts.id.renderButton(document.getElementById('google-btn'), {
        theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', logo_alignment: 'left', width: 280,
    });
    google.accounts.id.prompt();
}

async function logout() {
    try { await fetch('/api/admin-airdrop?type=logout', { method: 'POST' }); } catch {}
    try { google.accounts.id.disableAutoSelect(); } catch {}
    location.reload();
}

        // ─── INIT (juga menyuntik semua icon SVG ke tombol/label statis) ───
            window.onload = async function() {
            spawnLoginParticles();
            spawnLoginLetters();
            startFallingCoins();

            // Icon-fill untuk elemen statis (bukan hasil render dinamis)
            document.getElementById('section-label-link-icon').innerHTML = icon('link') + 'Project Links';
            document.getElementById('add-proj-btn').innerHTML = icon('plus') + 'Tambah Proyek';
            document.getElementById('initial-loading-state').innerHTML = icon('hourglass') + 'Loading projects...';
            document.getElementById('edit-modal-title').innerHTML = icon('edit') + 'Edit Proyek';
            document.getElementById('edit-modal-close-btn').innerHTML = icon('x');
            document.getElementById('add-modal-title').innerHTML = icon('plus') + 'Tambah Proyek Baru';
            document.getElementById('add-modal-close-btn').innerHTML = icon('x');
            document.getElementById('btn-save-edit').innerHTML = icon('save') + 'Simpan';
            document.getElementById('btn-save-add').innerHTML = icon('rocket') + 'Tambah';
            document.getElementById('calc-title').innerHTML = icon('calculator') + 'Kalkulator';
            document.getElementById('calc-close-btn').innerHTML = icon('x');
            document.getElementById('news-close-btn').innerHTML = icon('x');
            document.getElementById('ftab-haslink').innerHTML = icon('check') + 'Ada Link';
            document.getElementById('ftab-nolink').innerHTML = icon('x') + 'No Link';
            document.getElementById('onchain-close-btn').innerHTML = icon('x');

            // Populate status selects
            const statusSelects = ['e-status', 'a-status'];
            statusSelects.forEach(id => {
                const sel = document.getElementById(id);
                if (sel) {
                    sel.innerHTML = STATUS_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('');
                }
            });

     buildCalcGrid();
    startGarapWidget();
    startCryptoTicker();

const sess = await checkSession();
if (sess) enterAdmin(sess.role); else showLogin();
};
