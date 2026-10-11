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

        // 4 panel ala Coinalyze
    const PANELS = { oi: 'Open Interest', vol: 'Volume', liq: 'Liquidations', cur: 'Current OI per Exchange' };
    const grid = document.createElement('div');
    grid.className = 'lq-grid';
    grid.innerHTML = Object.keys(PANELS).map(k => `<div class="lq-panel"><div class="lq-pt"></div><div class="lq-chart" id="lq-c-${k}"></div></div>`).join('');
    $('#lq-body').closest('table').replaceWith(grid);
    const bx = {};
    Object.keys(PANELS).forEach(k => { bx[k] = grid.querySelector('#lq-c-' + k); });
    const setAll = html => Object.values(bx).forEach(el => { el.innerHTML = html; el._tt = null; });

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

            const FB = ['#0B7A75', '#2437A6', '#6FBFA8', '#5B9BD5', '#1E6FD9', '#3E9C7F', '#D9A89A', '#D2765A', '#B5522A', '#0E8F7A'];
    const COL = { Binance: '#0B7A75', Bybit: '#2437A6', Hyperliquid: '#6FBFA8', OKX: '#5B9BD5', Huobi: '#1E6FD9', HTX: '#1E6FD9', Deribit: '#3E9C7F', Bitfinex: '#D9A89A', Kraken: '#D2765A', dYdX: '#B5522A', 'WOO X': '#0E8F7A' };
    const col = (n, k) => COL[n] || FB[k % FB.length];
    const W = 560, H = 270, L = 56, R = 8, T = 10, B = 24;

    const gridY = (max, ih) => [0, .25, .5, .75, 1].map(f => {
        const y = T + ih - f * ih;
        return `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="#2A2A2A" stroke-dasharray="3 4"/>`
             + `<text x="${L - 6}" y="${y + 3}" text-anchor="end" font-size="10" fill="#8A8A93">${money(f * max)}</text>`;
    }).join('');
    const xTicks = (days, bw) => {
        const step = Math.max(1, Math.ceil(days.length / 6));
        return days.map((x, i) => i % step ? '' : `<text x="${(L + i * bw + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#8A8A93">${fmtDay(x.t, days.length > 200)}</text>`).join('');
    };
    const hover = (days, bw, ih) => days.map((x, i) => `<rect data-i="${i}" x="${(L + i * bw).toFixed(1)}" y="${T}" width="${bw.toFixed(1)}" height="${ih}" fill="transparent"/>`).join('');
    const legend = ex => `<div class="lq-leg">${ex.map((n, k) => `<span><i style="background:${col(n, k)}"></i>${h(n)}</span>`).join('')}</div>`;
    const shell = (g, extra) => `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">${g}</svg>${extra || ''}<div class="lq-tip" hidden></div>`;

    // OI (area bertumpuk) dan Volume (bar bertumpuk) per bursa
    function drawStack(el, s, area) {
        const days = (s && s.days) || [];
        if (!days.length) { el.innerHTML = msgRow('Tidak ada data di rentang ini'); el._tt = null; return; }
        const ih = H - T - B, bw = (W - L - R) / days.length, w = Math.max(bw * .72, 1);
        const max = Math.max(...days.map(x => sumA(x.v)), 1);
        const y = v => T + ih - v / max * ih;
        let g = gridY(max, ih);
        if (area) {
            const cum = days.map(() => 0), cx = i => (L + i * bw + bw / 2).toFixed(1);
            s.exchanges.forEach((n, k) => {
                const top = days.map((x, i) => cum[i] + x.v[k]);
                const pts = top.map((v, i) => `${cx(i)},${y(v).toFixed(1)}`).concat(cum.map((v, i) => `${cx(i)},${y(v).toFixed(1)}`).reverse());
                g += `<polygon points="${pts.join(' ')}" fill="${col(n, k)}"/>`;
                top.forEach((v, i) => { cum[i] = v; });
            });
        } else {
            days.forEach((x, i) => {
                let c = 0;
                x.v.forEach((v, k) => {
                    g += `<rect x="${(L + i * bw + (bw - w) / 2).toFixed(1)}" y="${y(c + v).toFixed(1)}" width="${w.toFixed(1)}" height="${(v / max * ih).toFixed(1)}" fill="${col(s.exchanges[k], k)}"/>`;
                    c += v;
                });
            });
        }
        el.innerHTML = shell(g + xTicks(days, bw) + hover(days, bw, ih), legend(s.exchanges));
        el._tt = i => {
            const x = days[i];
            return `<div class="lq-th">${fmtDay(x.t, true)}</div>`
                + s.exchanges.map((n, k) => [n, x.v[k], k]).filter(r => r[1] > 0).sort((a, b) => b[1] - a[1])
                    .map(r => `<div><span><i style="background:${col(r[0], r[2])}"></i>${h(r[0])}</span><b>${money(r[1])}</b></div>`).join('')
                + `<div class="lq-tt"><span>TOTAL</span><b>${money(sumA(x.v))}</b></div>`;
        };
    }

    // Liquidations: long hijau ke atas, short merah ke bawah
    function drawLiq(el, d) {
        const days = d.days || [];
        if (!days.length) { el.innerHTML = msgRow('Tidak ada data likuidasi untuk koin ini di rentang ini'); el._tt = null; return; }
        const ih = H - T - B, half = ih / 2, zero = T + half, bw = (W - L - R) / days.length, w = Math.max(bw * .72, 1);
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
               + `<rect x="${cx.toFixed(1)}" y="${zero}" width="${w.toFixed(1)}" height="${s.toFixed(1)}" fill="#EF4444"/>`;
        });
        const noRows = (d.rows || []).filter(r => r.error);
        el.innerHTML = shell(g + xTicks(days, bw) + hover(days, bw, ih),
            `<div class="lq-leg"><span><i style="background:#35E0A1"></i>Long dilikuidasi</span><span><i style="background:#EF4444"></i>Short dilikuidasi</span></div>`
            + (noRows.length ? `<div class="lq-note">Tanpa data dari Coinalyze: ${noRows.map(r => h(r.exchange)).join(', ')}.</div>` : ''));
        el._tt = i => {
            const x = days[i];
            return `<div class="lq-th">${fmtDay(x.t, true)}</div>`
                + d.exchanges.map((n, k) => [n, x.l[k], x.s[k]]).filter(r => r[1] + r[2] > 0).sort((a, b) => (b[1] + b[2]) - (a[1] + a[2]))
                    .map(r => `<div><span>${h(r[0])}</span><b class="lq-g">${money(r[1])}</b><b class="lq-r">${money(r[2])}</b></div>`).join('')
                + `<div class="lq-tt"><span>TOTAL</span><b class="lq-g">${money(sumA(x.l))}</b><b class="lq-r">${money(sumA(x.s))}</b></div>`;
        };
    }

    // Current OI per Exchange: bar vertikal
    function drawCur(el, rows) {
        if (!rows.length) { el.innerHTML = msgRow('Tidak ada data'); el._tt = null; return; }
        const BT = 58, ih = H - T - BT, bw = (W - L - R) / rows.length, max = rows[0].value;
        let g = gridY(max, ih);
        rows.forEach((r, i) => {
            const bh = r.value / max * ih, cx = L + i * bw + bw / 2, yb = T + ih;
            g += `<rect x="${(cx - bw * .3).toFixed(1)}" y="${(yb - bh).toFixed(1)}" width="${(bw * .6).toFixed(1)}" height="${bh.toFixed(1)}" fill="#0E8F8A"/>`
               + `<text x="${cx.toFixed(1)}" y="${(yb - bh - 4).toFixed(1)}" text-anchor="middle" font-size="9" fill="#cfcfd6">${money(r.value)}</text>`
               + `<text transform="translate(${cx.toFixed(1)} ${yb + 10}) rotate(-35)" text-anchor="end" font-size="10" fill="#8A8A93">${h(r.exchange)}</text>`;
        });
        el.innerHTML = shell(g); el._tt = null;
    }

    function drawAll(d) {
        Object.keys(PANELS).forEach(k => { bx[k].previousElementSibling.innerHTML = `<b>${h(d.coin)}:</b> ${PANELS[k]}`; });
        drawStack(bx.oi, d.oi, true);
        drawStack(bx.vol, d.vol, false);
        drawLiq(bx.liq, d);
        drawCur(bx.cur, d.oiCur || []);
    }

    // tooltip hover, satu handler per panel
    Object.values(bx).forEach(el => {
        el.addEventListener('mousemove', e => {
            const tip = el.querySelector('.lq-tip'), i = e.target.dataset && e.target.dataset.i;
            if (!tip) return;
            if (i == null || !el._tt) { tip.hidden = true; return; }
            tip.innerHTML = el._tt(+i);
            tip.hidden = false;
            const b = el.getBoundingClientRect(), px = e.clientX - b.left, py = e.clientY - b.top;
            tip.style.left = (px > b.width / 2 ? px - tip.offsetWidth - 14 : px + 14) + 'px';
            tip.style.top = Math.max(0, py - 20) + 'px';
        });
        el.addEventListener('mouseleave', () => { const t = el.querySelector('.lq-tip'); if (t) t.hidden = true; });
    });

    function render(d) {
        const t = d.totals || { long: 0, short: 0, total: 0 };
        $('#lq-sum').innerHTML =
            `<div class="lq-card g"><span>Long Liq · ${h(d.coin)}</span><b>${money(t.long)}</b></div>`
          + `<div class="lq-card r"><span>Short Liq · ${h(d.coin)}</span><b>${money(t.short)}</b></div>`
          + `<div class="lq-card"><span>Total · ${TFS[d.tf] || d.tf}</span><b>${money(t.total)}</b></div>`;

        drawAll(d)

        const okN = (d.rows || []).filter(r => !r.error).length;
        const hhmm = new Date(d.updated_at || Date.now()).toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':');
        setStatus(`Coinalyze · ${d.coin} · ${okN}/${(d.rows || []).length} bursa · ${TFS[d.tf] || d.tf} terakhir · ${hhmm} WIB`
            + (d.stale ? ' · data lama (limit/gangguan)' : ''));
    }

    function reset() {
        st.last = null;
        $('#lq-sum').innerHTML = '';
        setAll(msgRow('Memuat…'));
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
            if (!d.days || !d.oi) throw new Error('respon bukan data likuidasi: api/market.js di server belum versi terbaru (cabang type=liq belum ada)');
            render(d); st.last = d;
        } catch (e) {
            if (my !== st.token) return;
            setStatus('Gagal: ' + e.message + (st.last ? ' · menampilkan data terakhir' : ''));
            if (!st.last) setAll(msgRow(e.message));
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