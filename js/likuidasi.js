// js/likuidasi.js — logika tabel "Likuidasi per Bursa" di Market Dashboard.
// HTML-nya ada di admin.html (section #sec-liq), data dari /api/market?type=liq (Coinalyze).
// Dimuat SETELAH js/market.js supaya rantai window.xlStart / xlStop berjalan.
(function () {
    const $ = s => document.querySelector(s);
    if (!$('#lq-body')) return;   // section #sec-liq belum ditempel di admin.html

    const TFS = { '1w': '1 minggu', '1m': '1 bulan', '2m': '2 bulan', '3m': '3 bulan', '4m': '4 bulan', '5m': '5 bulan', '6m': '6 bulan', '8m': '8 bulan', '1y': '1 tahun', '2y': '2 tahun' };
    const st = { coin: 'BTC', tf: '1m', run: false, timer: null, token: 0, last: null, coinsLoaded: false };

    const h = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const money = v => { v = Number(v) || 0; const a = Math.abs(v); return '$' + (a >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (v / 1e3).toFixed(2) + 'K' : v.toFixed(0)); };
    const setStatus = t => { $('#lq-status').textContent = t; };
    const msgRow = t => `<div class="tu-empty">${h(t)}</div>`;
    const sumA = a => a.reduce((s, v) => s + v, 0);
    const fmtDay = (t, y) => new Date(t * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', ...(y ? { year: '2-digit' } : {}), timeZone: 'UTC' });

    const box = document.createElement('div');
    box.id = 'lq-chart'; box.className = 'lq-chart';
    $('#lq-body').closest('table').replaceWith(box);
    $('#lq-tf').innerHTML = Object.keys(TFS).map(k => `<option value="${k}">${k.toUpperCase()}</option>`).join('');
    $('#lq-tf').value = st.tf;

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

        function drawChart(d) {
        const days = d.days || [];
        if (!days.length) { box.innerHTML = msgRow('Tidak ada data likuidasi untuk koin ini di rentang ini'); return; }
        const W = 900, H = 340, L = 64, R = 8, T = 10, B = 26, half = (H - T - B) / 2, zero = T + half;
        const bw = (W - L - R) / days.length, w = Math.max(bw * .72, 1);
        const max = Math.max(...days.map(x => Math.max(sumA(x.l), sumA(x.s))), 1);
        const sy = v => v / max * half;
        let g = '';
        [1, .5, 0, -.5, -1].forEach(f => {
            const y = zero - f * half;
            g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="#2A2A2A" stroke-dasharray="3 4"/>`
               + `<text x="${L - 6}" y="${y + 3}" text-anchor="end" font-size="10" fill="#8A8A93">${money(Math.abs(f) * max)}</text>`;
        });
        days.forEach((x, i) => {
            const cx = L + i * bw + (bw - w) / 2, l = sy(sumA(x.l)), s = sy(sumA(x.s));
            g += `<rect x="${cx.toFixed(1)}" y="${(zero - l).toFixed(1)}" width="${w.toFixed(1)}" height="${l.toFixed(1)}" fill="#35E0A1"/>`
               + `<rect x="${cx.toFixed(1)}" y="${zero}" width="${w.toFixed(1)}" height="${s.toFixed(1)}" fill="#EF4444"/>`
               + `<rect data-i="${i}" x="${(L + i * bw).toFixed(1)}" y="${T}" width="${bw.toFixed(1)}" height="${H - T - B}" fill="transparent"/>`;
        });
        const step = Math.max(1, Math.ceil(days.length / 7));
        days.forEach((x, i) => {
            if (i % step) return;
            g += `<text x="${(L + i * bw + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#8A8A93">${fmtDay(x.t, days.length > 200)}</text>`;
        });
        const noRows = (d.rows || []).filter(r => r.error);
        box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">${g}</svg>`
            + `<div class="lq-leg"><i class="g"></i>Long dilikuidasi <i class="r"></i>Short dilikuidasi</div>`
            + (noRows.length ? `<div class="lq-note">Tanpa data dari Coinalyze: ${noRows.map(r => h(r.exchange)).join(', ')}.</div>` : '')
            + `<div class="lq-tip" hidden></div>`;
    }

    box.addEventListener('mousemove', e => {
        const tip = box.querySelector('.lq-tip'), i = e.target.dataset && e.target.dataset.i, d = st.last;
        if (!tip) return;
        if (i == null || !d) { tip.hidden = true; return; }
        const x = d.days[i];
        tip.innerHTML = `<div class="lq-th">${fmtDay(x.t, true)}</div>`
            + d.exchanges.map((n, k) => [n, x.l[k], x.s[k]]).filter(r => r[1] + r[2] > 0).sort((a, b) => (b[1] + b[2]) - (a[1] + a[2]))
                .map(r => `<div><span>${h(r[0])}</span><b class="lq-g">${money(r[1])}</b><b class="lq-r">${money(r[2])}</b></div>`).join('')
            + `<div class="lq-tt"><span>TOTAL</span><b class="lq-g">${money(sumA(x.l))}</b><b class="lq-r">${money(sumA(x.s))}</b></div>`;
        tip.hidden = false;
        const b = box.getBoundingClientRect(), px = e.clientX - b.left, py = e.clientY - b.top;
        tip.style.left = (px > b.width / 2 ? px - tip.offsetWidth - 14 : px + 14) + 'px';
        tip.style.top = Math.max(0, py - 20) + 'px';
    });
    box.addEventListener('mouseleave', () => { const t = box.querySelector('.lq-tip'); if (t) t.hidden = true; });

    function render(d) {
        const t = d.totals || { long: 0, short: 0, total: 0 };
        $('#lq-sum').innerHTML =
            `<div class="lq-card g"><span>Long Liq · ${h(d.coin)}</span><b>${money(t.long)}</b></div>`
          + `<div class="lq-card r"><span>Short Liq · ${h(d.coin)}</span><b>${money(t.short)}</b></div>`
          + `<div class="lq-card"><span>Total · ${TFS[d.tf] || d.tf}</span><b>${money(t.total)}</b></div>`;

           drawChart(d);

        const okN = (d.rows || []).filter(r => !r.error).length;
        const hhmm = new Date(d.updated_at || Date.now()).toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':');
        setStatus(`Coinalyze · ${d.coin} · ${okN}/${(d.rows || []).length} bursa · ${TFS[d.tf] || d.tf} terakhir · ${hhmm} WIB`
            + (d.stale ? ' · data lama (limit/gangguan)' : ''));
    }

    function reset() {
        st.last = null;
        $('#lq-sum').innerHTML = '';
        box.innerHTML = msgRow('Memuat…');
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
            if (!d.days) throw new Error('respon bukan data likuidasi: api/market.js di server belum versi terbaru (cabang type=liq belum ada)');
            render(d); st.last = d;
        } catch (e) {
            if (my !== st.token) return;
            setStatus('Gagal: ' + e.message + (st.last ? ' · menampilkan data terakhir' : ''));
            if (!st.last) box.innerHTML = msgRow(e.message);
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