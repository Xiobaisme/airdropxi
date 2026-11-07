/* shell.js · header + footer + ticker untuk halaman non-index (news, onchain, calc, lab, broadcast, agent).
   Pasang di akhir <body>, SEBELUM core.js. Aman kalau kepanggil dua kali. */
(function () {
    if (document.getElementById('app-nav')) return;

    // CSS pendukung, dilewati kalau halaman sudah memuatnya. 'shell' selalu terakhir supaya menang.
    ['landing', 'footer', 'profile', 'shell'].forEach(function (n) {
        if (document.querySelector('link[href="/css/' + n + '.css"]')) return;
        var l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = '/css/' + n + '.css';
        document.head.appendChild(l);
    });

    var S = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
    var TG = S + '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
    var DC = S + '<path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>';
    var XX = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>';
    var DCLINK = 'https://t.me/Xiobaii?text=Halo%20Bang%2C%20saya%20ingin%20bergabung%20ke%20komunitas%20Discord%20Crypto%20Monkey.%20Mohon%20info%20langkah%20pendaftarannya%20ya.%20Terima%20kasih%20%F0%9F%99%8F';

    var HEADER = `
<header class="lp-nav app-nav" id="app-nav">
    <div class="lp-nav-inner">
        <a class="lp-nav-logo" id="app-nav-logo" href="/"><img src="/cmic-footer.svg" alt="CMIC"></a>
        <div class="lp-nav-links">
            <a href="#" data-nav="market" onclick="showMarketDashboard()">Market</a>
            <a href="#" data-nav="airdrop" data-role="admin" onclick="showAirdropDashboard()">Airdrop</a>
            <a href="/news" id="news-toggle-btn"><span class="news-live-dot"></span>News Terminal</a>
            <a href="/onchain" id="onchain-toggle-btn">Onchain</a>
            <a href="#" id="btnWeexPromo"><span class="ourbit-fire">🔥</span> OURBIT</a>
            <a href="/broadcast" id="broadcast-toggle-btn" data-role="admin">Broadcast</a>
            <a href="/agent" id="agent-toggle-btn" data-role="admin">AI Agent</a>
            <a href="/calc" id="calc-toggle-btn">Calc</a>
        </div>
        <div class="pf" id="pf">
            <button class="pf-btn" id="pf-btn" type="button" aria-expanded="false">
                <img class="pf-ava" id="pf-ava" alt="">
                <span class="pf-name" id="pf-name">...</span>
                <i>▾</i>
            </button>
            <div class="pf-pop hidden" id="pf-pop">
                <div class="pf-head">
                    <img class="pf-ava big" id="pf-ava2" alt="">
                    <div><b id="pf-name2">-</b><small id="pf-sub">-</small></div>
                </div>
                <div class="pf-row"><span>Role</span><b id="pf-role">-</b></div>
                <div class="pf-row"><span>Login via</span><b id="pf-via">-</b></div>
                <div class="pf-row"><span>ID / Email</span><b id="pf-id">-</b></div>
                <div class="pf-row"><span>Akun dibuat</span><b id="pf-created">-</b></div>
                <div class="pf-row"><span>Join server</span><b id="pf-joined">-</b></div>
                <button class="pf-logout" type="button" onclick="logout()">Logout</button>
            </div>
        </div>
    </div>
</header>`;

    var FOOTER = `
<footer id="cmic-footer">
    <section class="cf-support">
        <div>
            <div class="cf-kicker">Pantau market tanpa jeda, dari satu dashboard</div>
            <h2>CMIC<br>𝐈𝐧𝐧𝐞𝐫 𝐂𝐢𝐫𝐜𝐥𝐞</h2>
            <div class="cf-seals">
                <div class="cf-seal"><b>24/7</b><span>Live feed</span></div>
                <div class="cf-seal"><b>7</b><span>Bursa CEX</span></div>
                <div class="cf-seal"><b>25+</b><span>Sumber berita</span></div>
                <div class="cf-seal"><b>6+</b><span>Chain onchain</span></div>
            </div>
        </div>
        <div class="cf-cards">
            <a class="cf-card c1" href="${DCLINK}" target="_blank" rel="noopener">
                <span class="t"><span class="icon">${DC}</span>Discord</span>
                <span class="d">Ngobrol dengan member dan dapat alert langsung di server CMIC.</span>
            </a>
            <a class="cf-card c2" href="https://t.me/CryptoMonk3y" target="_blank" rel="noopener">
                <span class="t"><span class="icon">${TG}</span>Telegram</span>
                <span class="d">Channel berita dan broadcast Crypto Monkey.</span>
            </a>
        </div>
    </section>

    <section class="cf-sources">
        <p>Data pasar, unlock, dan listing</p>
        <div class="cf-pills">
            <span class="cf-pill">Binance</span><span class="cf-pill">Bybit</span><span class="cf-pill">OKX</span>
            <span class="cf-pill">Bitget</span><span class="cf-pill">Gate</span><span class="cf-pill">Kraken</span>
            <span class="cf-pill">Aster</span><span class="cf-pill">CoinGecko</span><span class="cf-pill">DefiLlama</span>
            <span class="cf-pill">New Listings Feed</span>
        </div>
        <p>Sumber berita &amp; onchain (News Terminal)</p>
        <div class="cf-pills">
            <span class="cf-pill">Lookonchain</span><span class="cf-pill">Investigations</span><span class="cf-pill">OnchainLens</span>
            <span class="cf-pill">Wu Blockchain</span><span class="cf-pill">Whale Alert</span><span class="cf-pill">Tree News</span>
            <span class="cf-pill">Nansen</span><span class="cf-pill">Crypto Media</span><span class="cf-pill">SM News</span>
            <span class="cf-pill">WatcherGuru</span><span class="cf-pill">REKT</span><span class="cf-pill">Cointelegraph</span>
            <span class="cf-pill">BRICS News</span><span class="cf-pill">CryptoRank</span><span class="cf-pill">Upbit (TG)</span>
            <span class="cf-pill">New Listing &amp; Delisting V2</span>
        </div>
    </section>

    <div class="cf-main">
        <div class="cf-cols">
            <div class="cf-brand">
                <img src="/cmic-footer.svg" alt="CMIC" />
                <p>Crypto Monkey Inner Circle Crypto Media Market Intelligence Market Analysis Daily News</p>
            </div>
            <div class="cf-col">
                <h4>Market</h4>
                <a onclick="showMarketDashboard(); window.scrollTo({top:0,behavior:'smooth'})">Chart BTC vs BTC.D</a>
                <a onclick="showMarketDashboard(); window.scrollTo({top:0,behavior:'smooth'})">Long vs Short</a>
                <a onclick="showMarketDashboard(); window.scrollTo({top:0,behavior:'smooth'})">Jadwal Token Unlock</a>
            </div>
            <div class="cf-col">
                <h4>Tools</h4>
                <a href="/news">News Terminal</a>
                <a href="/onchain">Onchain Tracer</a>
                <a class="cf-hide-member" href="/broadcast">Broadcast</a>
                <a href="/calc">Kalkulator</a>
                <a href="/lab">Lab Materi</a>
            </div>
            <div class="cf-col">
                <h4>Kemitraan</h4>
                <a class="cf-partner" href="https://www.ourbit.com/register?inviteCode=ourbitCMIC" target="_blank" rel="noopener">
                    <img src="/ourbit-logo.svg" alt="OURBIT" width="106" height="24" onerror="this.remove()" />
                    <span>Daftar OURBIT ↗</span>
                </a>
                <a class="cf-partner" href="https://www.hibt.com/register?promotionCode=3I9I" target="_blank" rel="noopener">
                    <img src="/HIBT.svg" alt="HIBT" width="106" height="24" onerror="this.remove()" />
                    <span>Daftar HIBT ↗</span>
                </a>
                <div class="cf-follow">
                    <h4>Ikuti Kami</h4>
                    <div class="cf-social">
                        <a href="#" target="_blank" rel="noopener" aria-label="X">${XX}</a>
                        <a href="https://t.me/CryptoMonk3y" target="_blank" rel="noopener" aria-label="Telegram">${TG}</a>
                        <a href="${DCLINK}" target="_blank" rel="noopener" aria-label="Discord">${DC}</a>
                    </div>
                </div>
            </div>
        </div>
        <div class="cf-bar">
            <span>© <span id="cf-year"></span> <b>CMIC</b> · Private Control Center</span>
            <span>Trade smart. Manage risk. DYOR.</span>
        </div>
    </div>
</footer>`;

    var TICKER = `
<div id="crypto-ticker">
    <div class="ticker-label"><span class="dot"></span>LIVE</div>
    <div class="ticker-track" id="ticker-track">
        <div class="empty-state" style="padding:0 1.6rem;">Loading market data...</div>
    </div>
</div>`;

    // Di index fungsi ini mengganti section. Di halaman lain artinya balik ke dashboard.
    function goHome(e) {
        var ev = e || window.event;
        if (ev && ev.preventDefault) ev.preventDefault();
        location.href = '/';
    }
    if (typeof window.showMarketDashboard !== 'function') window.showMarketDashboard = goHome;
    if (typeof window.showAirdropDashboard !== 'function') window.showAirdropDashboard = goHome;

    // Modal yang dipakai tombol OURBIT. Hanya disuntik kalau halaman belum punya.
    var MODALS = {
        'confirm-modal': `
<div id="confirm-modal" class="modal hidden">
    <div class="modal-box confirm-box">
        <div class="confirm-icon" id="confirm-icon"></div>
        <div class="confirm-title" id="confirm-title">Konfirmasi</div>
        <div class="confirm-msg" id="confirm-msg">Yakin ingin melanjutkan?</div>
        <div class="confirm-actions">
            <button class="btn-cancel" id="confirm-cancel-btn">Batal</button>
            <button class="btn-danger-confirm" id="confirm-ok-btn">Ya, Hapus</button>
        </div>
    </div>
</div>`,
        'weex-modal': `
<div id="weex-modal" class="modal hidden">
    <div class="modal-box">
        <div class="modal-head">
            <div class="modal-title">Send sekarang?</div>
            <button class="modal-close" id="weex-close-btn"></button>
        </div>
        <div class="modal-body">
            <div class="confirm-msg" style="margin:0;text-align:left;">Pesan OURBIT × CMIC akan dikirim ke Discord &amp; Telegram Crypto Monkey.</div>
            <pre id="weex-preview" style="max-height:260px;overflow:auto;white-space:pre-wrap;background:var(--card-2);border:2px solid var(--border);border-radius:var(--r-sm);padding:12px;color:var(--text2);font-family:var(--sans);font-size:0.8rem;line-height:1.5;"></pre>
        </div>
        <div class="modal-actions">
            <button class="btn-cancel" id="weex-cancel-btn">Batal</button>
            <button class="btn-save" id="weex-send-btn">Kirim</button>
        </div>
    </div>
</div>`,
        'pin-modal': `
<div id="pin-modal" class="modal hidden" style="z-index:1800">
    <div class="modal-box confirm-box">
        <div class="confirm-title">Masukkan PIN</div>
        <div class="confirm-msg">Verifikasi dulu sebelum kirim ke Discord &amp; Telegram.</div>
        <div class="field">
            <input id="pin-input" type="password" inputmode="numeric" autocomplete="off"
                   placeholder="••••••" style="text-align:center;letter-spacing:.4em;" />
        </div>
        <div class="confirm-actions" style="margin-top:1.2rem;">
            <button class="btn-cancel" id="pin-cancel-btn">Batal</button>
            <button class="btn-save" id="pin-ok-btn">Verifikasi</button>
        </div>
    </div>
</div>`
    };
    var EXTRA = Object.keys(MODALS).filter(function (id) { return !document.getElementById(id); })
        .map(function (id) { return MODALS[id]; }).join('');

    var b = document.body;
    b.classList.add('shell-page');
    b.insertAdjacentHTML('afterbegin', HEADER);
    b.insertAdjacentHTML('beforeend', FOOTER + TICKER + EXTRA);

    // menu aktif sesuai URL (/news, /onchain, /calc, ...)
    var path = location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
    document.querySelectorAll('#app-nav .lp-nav-links a').forEach(function (a) {
        if (a.getAttribute('href') === path) a.classList.add('active');
    });
    var y = document.getElementById('cf-year');
    if (y) y.textContent = new Date().getFullYear();

    // header fixed -> geser isi halaman ke bawah header; --shell-top dipakai shell.css buat tinggi area penuh
    function offset() {
        var h = document.getElementById('app-nav');
        var top = Math.ceil(h.getBoundingClientRect().bottom) + 24;
        document.documentElement.style.setProperty('--shell-top', top + 'px');
        b.style.paddingTop = getComputedStyle(h).position === 'fixed' ? top + 'px' : '';
    }
    offset();
    window.addEventListener('load', offset);
    window.addEventListener('resize', offset);
})();