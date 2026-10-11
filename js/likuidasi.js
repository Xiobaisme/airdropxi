// js/likuidasi.js — logika tabel "Likuidasi per Bursa" di Market Dashboard.
// HTML-nya ada di admin.html (section #sec-liq), data dari /api/market?type=liq (Coinalyze).
// Dimuat SETELAH js/market.js supaya rantai window.xlStart / xlStop berjalan.
(function () {
    const $ = s => document.querySelector(s);
    if (!$('#lq-body')) return;   // section #sec-liq belum ditempel di admin.html

    const TFS = { '1h': '1 jam', '4h': '4 jam', '12h': '12 jam', '24h': '24 jam' };
    const st = { coin: 'BTC', tf: '24h', run: false, timer: null, token: 0, last: null, coinsLoaded: false };

    const h = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const money = v => { const a = Math.abs(v); return '$' + (a >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (v / 1e3).toFixed(2) + 'K' : v.toFixed(0)); };
    const setStatus = t => { $('#lq-status').textContent = t; };
    const msgRow = t => `<tr><td colspan="5" class="tu-empty">${h(t)}</td></tr>`;

    // isi dropdown koin: top 200 volume Binance Futures (kalau gagal, pilihan bawaan di HTML tetap dipakai)
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
            if (!list.length) return;
            if (!list.includes(st.coin)) list.unshift(st.coin);
            const sel = $('#lq-coin');
            sel.innerHTML = list.map(c => `<option value="${c}">${c}</option>`).join('');
            sel.value = st.coin;
            st.coinsLoaded = true;
        } catch (_) {}
    }

    function render(d) {
        const t = d.totals || { long: 0, short: 0, total: 0 };
        $('#lq-sum').innerHTML =
            `<div class="lq-card g"><span>Long Liq · ${h(d.coin)}</span><b>${money(t.long)}</b></div>`
          + `<div class="lq-card r"><span>Short Liq · ${h(d.coin)}</span><b>${money(t.short)}</b></div>`
          + `<div class="lq-card"><span>Total · ${TFS[d.tf] || d.tf}</span><b>${money(t.total)}</b></div>`;

        $('#lq-body').innerHTML = (d.rows || []).map(r => {
            if (r.error) return `<tr class="tu-row"><td class="tu-tok">${h(r.exchange)}</td><td colspan="4" class="tu-empty">${h(r.error)}</td></tr>`;
            const p = r.total > 0 ? (r.long / r.total) * 100 : 50;
            return `<tr class="tu-row"><td class="tu-tok">${h(r.exchange)}</td>`
                 + `<td class="r lq-g">${money(r.long)}</td><td class="r lq-r">${money(r.short)}</td><td class="r">${money(r.total)}</td>`
                 + `<td><div class="lq-b"><i style="width:${p.toFixed(1)}%"></i></div><div class="lq-pc">${p.toFixed(0)}% long · ${(100 - p).toFixed(0)}% short</div></td></tr>`;
        }).join('');

        const okN = (d.rows || []).filter(r => !r.error).length;
        const hhmm = new Date(d.updated_at || Date.now()).toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':');
        setStatus(`Coinalyze · ${d.coin} · ${okN}/${(d.rows || []).length} bursa · ${TFS[d.tf] || d.tf} terakhir · ${hhmm} WIB`
            + (d.stale ? ' · data lama (limit/gangguan)' : ''));
    }

    function reset() {
        st.last = null;
        $('#lq-sum').innerHTML = '';
        $('#lq-body').innerHTML = msgRow('Memuat…');
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
            if (!st.last) $('#lq-body').innerHTML = msgRow(e.message);
        }
    }

    $('#lq-coin').onchange = e => { st.coin = e.target.value; reset(); };
    $('#lq-tf').onchange = e => { st.tf = e.target.value; reset(); };
    $('#lq-refresh').onclick = () => load();
    document.addEventListener('visibilitychange', () => { if (st.run && !document.hidden) load(); });

    function start() {
        if (st.run) return;
        st.run = true;
        loadCoins(); load();
        st.timer = setInterval(() => { if (!document.hidden) load(); }, 60000);   // cache server 60 detik, jadi tidak boros limit
    }
    function stop() { st.run = false; clearInterval(st.timer); st.timer = null; }

    const ps = window.xlStart, pp = window.xlStop;
    window.xlStart = function () { ps && ps(); start(); };
    window.xlStop  = function () { pp && pp(); stop(); };
})();