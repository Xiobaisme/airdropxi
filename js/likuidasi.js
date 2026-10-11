// js/likuidasi.js — Tabel "Likuidasi per Bursa" (data: Coinalyze lewat /api/market?type=liq)
// Berdiri sendiri: TIDAK bergantung pada js/market.js dan tidak mengubah file lain.
// Tabel muncul di dalam #halaman-market (Market Dashboard) dan hanya aktif saat halaman itu terlihat.
// Opsional: taruh <div id="lq-mount"></div> di admin.html kalau mau menentukan posisi tabelnya.
(function () {
    const $ = s => document.querySelector(s);
    const TFS = [['1h', '1 jam'], ['4h', '4 jam'], ['12h', '12 jam'], ['24h', '24 jam']];
    const FALLBACK_COINS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'HYPE', 'SUI', 'ADA', 'LINK'];
    const st = { coin: 'BTC', tf: '24h', run: false, timer: null, token: 0, coinsLoaded: false, last: null };

    const h = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const money = v => { const a = Math.abs(v); return '$' + (a >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (v / 1e3).toFixed(2) + 'K' : v.toFixed(0)); };
    const tfLabel = () => (TFS.find(x => x[0] === st.tf) || [0, st.tf])[1];
    const setStatus = t => { const el = $('#lq-status'); if (el) el.textContent = t; };

    function loadCss() {
        if ($('#lq-css')) return;
        const l = document.createElement('link');
        l.id = 'lq-css'; l.rel = 'stylesheet'; l.href = '/css/likuidasi.css';
        document.head.appendChild(l);
    }

    function mount(host) {
        if ($('#lq-box')) return;
        loadCss();
        const box = document.createElement('section');
        box.id = 'lq-box'; box.className = 'lq';
        box.innerHTML = `
            <div class="lq-head">
                <div><div class="lq-title">Likuidasi per Bursa</div><div class="lq-sub" id="lq-status">Memuat…</div></div>
                <div class="lq-ctl">
                    <input id="lq-coin" list="lq-coins" value="${st.coin}" spellcheck="false" autocomplete="off" aria-label="Koin">
                    <datalist id="lq-coins">${FALLBACK_COINS.map(c => `<option value="${c}">`).join('')}</datalist>
                    <div class="lq-tf" id="lq-tf">${TFS.map(([k, l]) => `<button type="button" data-tf="${k}" class="${k === st.tf ? 'on' : ''}">${l}</button>`).join('')}</div>
                </div>
            </div>
            <div class="lq-sum" id="lq-sum"></div>
            <div class="lq-wrap"><table class="lq-tbl">
                <thead><tr><th class="lq-l">Bursa</th><th>Long Liq</th><th>Short Liq</th><th>Total</th><th>Long vs Short</th></tr></thead>
                <tbody id="lq-body"><tr class="lq-na"><td colspan="5">Memuat…</td></tr></tbody>
            </table></div>
            <div class="lq-note">Long Liq = nilai posisi <b>long</b> yang dilikuidasi paksa, Short Liq = posisi <b>short</b> yang dilikuidasi (dalam USD).
                Angka dihitung per bucket waktu, jadi bucket paling awal/akhir bisa sebagian. Kontrak yang dipakai: perpetual, satu per bursa.
                Data: <a href="https://coinalyze.net" target="_blank" rel="noopener">Coinalyze</a>.</div>`;
        ($('#lq-mount') || host).appendChild(box);

        const inp = $('#lq-coin');
        inp.addEventListener('focus', () => inp.select());
        inp.addEventListener('change', () => {
            const c = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'BTC';
            inp.value = c;
            if (c === st.coin) return;
            st.coin = c; reset();
        });
        $('#lq-tf').addEventListener('click', e => {
            const b = e.target.closest('[data-tf]');
            if (!b || b.dataset.tf === st.tf) return;
            st.tf = b.dataset.tf;
            $('#lq-tf').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
            reset();
        });
    }

    // daftar koin untuk saran ketikan (top 200 volume Binance Futures); kalau gagal, daftar pendek bawaan tetap dipakai
    async function loadCoins() {
        if (st.coinsLoaded) return;
        try {
            const r = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr');
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const list = (await r.json())
                .filter(x => /^[A-Z0-9]+USDT$/.test(x.symbol) && +x.quoteVolume > 0)
                .sort((a, b) => b.quoteVolume - a.quoteVolume)
                .slice(0, 200)
                .map(x => x.symbol.replace(/USDT$/, ''));
            const dl = $('#lq-coins');
            if (dl && list.length) { dl.innerHTML = list.map(c => `<option value="${c}">`).join(''); st.coinsLoaded = true; }
        } catch (_) {}
    }

    function render(d) {
        const t = d.totals || { long: 0, short: 0, total: 0 };
        $('#lq-sum').innerHTML =
            `<div class="lq-card g"><span>Long Liq (${h(d.coin)})</span><b>${money(t.long)}</b></div>`
          + `<div class="lq-card r"><span>Short Liq (${h(d.coin)})</span><b>${money(t.short)}</b></div>`
          + `<div class="lq-card"><span>Total · ${tfLabel()}</span><b>${money(t.total)}</b></div>`;

        $('#lq-body').innerHTML = (d.rows || []).map(r => {
            if (r.error) return `<tr class="lq-na"><td class="lq-l">${h(r.exchange)}</td><td colspan="4">${h(r.error)}</td></tr>`;
            const p = r.total > 0 ? (r.long / r.total) * 100 : 50;
            return `<tr><td class="lq-l">${h(r.exchange)}</td>`
                 + `<td class="lq-g">${money(r.long)}</td><td class="lq-r">${money(r.short)}</td><td>${money(r.total)}</td>`
                 + `<td class="lq-bar"><div class="lq-b"><i style="width:${p.toFixed(1)}%"></i></div><div class="lq-pc">${p.toFixed(0)}% long · ${(100 - p).toFixed(0)}% short</div></td></tr>`;
        }).join('');

        const okN = (d.rows || []).filter(r => !r.error).length;
        const hhmm = new Date(d.updated_at || Date.now()).toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':');
        setStatus(`${d.coin} · ${okN}/${(d.rows || []).length} bursa · ${tfLabel()} terakhir · ${hhmm} WIB · Coinalyze` + (d.stale ? ' · data lama (limit/gangguan)' : ''));
    }

    function reset() {
        st.last = null;
        const body = $('#lq-body'), sum = $('#lq-sum');
        if (body) body.innerHTML = '<tr class="lq-na"><td colspan="5">Memuat…</td></tr>';
        if (sum) sum.innerHTML = '';
        load();
    }

    async function load() {
        const my = ++st.token;
        if (!st.last) setStatus('Memuat…');
        try {
            const r = await fetch(`/api/market?type=liq&coin=${encodeURIComponent(st.coin)}&tf=${st.tf}`);
            const d = await r.json().catch(() => ({}));
            if (my !== st.token) return;
            if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
            st.last = d; render(d);
        } catch (e) {
            if (my !== st.token) return;
            setStatus('Gagal: ' + e.message + (st.last ? ' · menampilkan data terakhir' : ''));
            if (!st.last && $('#lq-body')) $('#lq-body').innerHTML = `<tr class="lq-na"><td colspan="5">${h(e.message)}</td></tr>`;
        }
    }

    function start(host) {
        mount(host);
        if (st.run) return;
        st.run = true;
        loadCoins(); load();
        st.timer = setInterval(() => { if (!document.hidden) load(); }, 60000);   // cache server 60 detik, jadi tidak boros limit
    }
    function stop() { st.run = false; clearInterval(st.timer); st.timer = null; }

    // aktif hanya saat Market Dashboard terlihat (dipantau lewat perubahan style/class pada #halaman-market)
    function check() {
        const host = $('#halaman-market');
        const visible = !!host && host.getClientRects().length > 0;
        if (visible) start(host); else stop();
    }
    function boot() {
        const host = $('#halaman-market');
        if (!host) return;
        new MutationObserver(check).observe(host, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
        document.addEventListener('visibilitychange', () => { if (st.run && !document.hidden) load(); });
        check();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();