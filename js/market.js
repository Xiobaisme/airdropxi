// ═══ MARKET DASHBOARD: Long vs Short live (WebSocket + /api/market) ═══
(function () {
    const $ = s => document.querySelector(s);
    const state = { coin: 'BTC', tf: '5m' };
    let running = false, hist = {}, lastPush = {}, token = 0, base = null, socks = [], buf = {}, timers = [];

    const fmt = v => v >= 1e9 ? (v/1e9).toFixed(2)+'B' : v >= 1e6 ? (v/1e6).toFixed(2)+'M' : v >= 1e3 ? (v/1e3).toFixed(2)+'K' : v.toFixed(0);

    function tween(el, to, f) {
        const from = +el.dataset.v || 0; el.dataset.v = to;
        const t0 = performance.now();
        (function step(t) {
            const p = Math.min(1, (t - t0) / 300);
            el.textContent = f(from + (to - from) * p);
            if (p < 1) requestAnimationFrame(step);
        })(t0);
    }

    /* ---------- WebSocket: trade masuk dikelompokkan per detik ---------- */
    const add = (ex, usd, buy) => {
        const b = (buf[ex] = buf[ex] || {}), s = Math.floor(Date.now() / 1000);
        const e = (b[s] = b[s] || [0, 0]); e[buy ? 0 : 1] += usd;
        for (const k in b) if (+k < s - 180) delete b[k];
    };

    function connect(url, onOpen, onMsg, ping) {
        let ws, timer, closed = false, tries = 0;
        const open = () => {
            ws = new WebSocket(url);
            ws.onopen = () => { tries = 0; onOpen && onOpen(ws); if (ping) timer = setInterval(() => ws.readyState === 1 && ws.send(ping), 20000); };
            ws.onmessage = e => { try { onMsg(e.data); } catch (_) {} };
            ws.onclose = () => { clearInterval(timer); if (!closed) setTimeout(open, Math.min(15000, 1000 * ++tries)); };
        };
        open();
        return { close() { closed = true; clearInterval(timer); ws && ws.close(); } };
    }

    async function startFeeds(coin) {
        socks.forEach(s => s.close()); socks = []; buf = {};
        const lc = coin.toLowerCase(), kr = `PF_${coin === 'BTC' ? 'XBT' : coin}USD`;
        const agg = ex => m => { const d = JSON.parse(m); if (d.e === 'aggTrade') add(ex, +d.p * +d.q, !d.m); };
        socks.push(connect(`wss://fstream.binance.com/ws/${lc}usdt@aggTrade`, null, agg('Binance')));
        socks.push(connect(`wss://fstream.asterdex.com/ws/${lc}usdt@aggTrade`, null, agg('Aster')));
        socks.push(connect('wss://stream.bybit.com/v5/public/linear',
            ws => ws.send(JSON.stringify({ op: 'subscribe', args: [`publicTrade.${coin}USDT`] })),
            m => { const d = JSON.parse(m); if (d.topic && d.topic.startsWith('publicTrade')) d.data.forEach(x => add('Bybit', +x.v * +x.p, x.S === 'Buy')); },
            '{"op":"ping"}'));
        socks.push(connect('wss://futures.kraken.com/ws/v1',
            ws => ws.send(JSON.stringify({ event: 'subscribe', feed: 'trade', product_ids: [kr] })),
            m => { const d = JSON.parse(m); if (d.feed === 'trade' && d.qty) add('Kraken', +d.qty * +d.price, d.side === 'buy'); }));
        // Bitget
        socks.push(connect('wss://ws.bitget.com/v2/ws/public',
            ws => ws.send(JSON.stringify({ op: 'subscribe', args: [{ instType: 'USDT-FUTURES', channel: 'trade', instId: `${coin}USDT` }] })),
            m => { const d = JSON.parse(m); if (d.action === 'update') (d.data || []).forEach(x => add('Bitget', +x.size * +x.price, x.side === 'buy')); },
            'ping'));
        // Gate.io (size dalam kontrak, dikali quanto_multiplier)
        let gm = 0;
        try { gm = +(await (await fetch(`https://api.gateio.ws/api/v4/futures/usdt/contracts/${coin}_USDT`)).json()).quanto_multiplier; } catch (_) {}
        if (gm && running && coin === state.coin) socks.push(connect('wss://fx-ws.gateio.ws/v4/ws/usdt',
            ws => ws.send(JSON.stringify({ time: Math.floor(Date.now() / 1000), channel: 'futures.trades', event: 'subscribe', payload: [`${coin}_USDT`] })),
            m => { const d = JSON.parse(m); if (d.channel === 'futures.trades' && d.event === 'update') (d.result || []).forEach(x => add('Gate', Math.abs(x.size) * gm * +x.price, x.size > 0)); },
            '{"channel":"futures.ping"}'));

        // OKX melaporkan ukuran dalam kontrak, jadi ambil nilai kontrak dulu
        let ct = 0;
        try { const j = await (await fetch(`https://www.okx.com/api/v5/public/instruments?instType=SWAP&instId=${coin}-USDT-SWAP`)).json(); ct = +j.data[0].ctVal; } catch (_) {}
        if (ct && running && coin === state.coin) socks.push(connect('wss://ws.okx.com:8443/ws/v5/public',
            ws => ws.send(JSON.stringify({ op: 'subscribe', args: [{ channel: 'trades', instId: `${coin}-USDT-SWAP` }] })),
            m => { const d = JSON.parse(m); (d.data || []).forEach(x => add('OKX', +x.sz * ct * +x.px, x.side === 'buy')); },
            'ping'));
    }

    /* ---------- angka dasar (server) + trade live (WebSocket) ---------- */
    function live(r) {
        const bk = buf[r.name];
        if (r.error || !bk) return r;
        const keep = Math.max(0, 1 - (Date.now() - base.t) / (base.minutes * 60000));
        let b = r.buy * keep, s = r.sell * keep;
        const from = Math.floor(base.t / 1000);
        for (const k in bk) if (+k > from) { b += bk[k][0]; s += bk[k][1]; }
        return { ...r, buy: b, sell: s, pct: b + s > 0 ? (b / (b + s)) * 100 : r.pct };
    }

    function view() {
        if (!base) return;
        const rows = base.rows.filter(r => !r.avg).map(live);
        const w = rows.filter(r => !r.error && r.usd);
        const tot = w.reduce((s, r) => s + r.buy + r.sell, 0);
        const all = tot
    ? { name: 'All', avg: true, usd: true, buy: w.reduce((s, r) => s + r.buy, 0), sell: w.reduce((s, r) => s + r.sell, 0), pct: (w.reduce((s, r) => s + r.buy, 0) / tot) * 100 }
    : { name: 'All', error: 'Belum ada data' };
        render([all, ...rows]);
    }

    function render(rows) {
        const box = $('#ls-rows');
        rows.forEach(r => {
            let row = document.getElementById('ls-r-' + r.name);
            if (!row) {
                row = document.createElement('div');
                row.id = 'ls-r-' + r.name;
                row.className = 'ls-row' + (r.avg ? ' avg' : '') + (r.name === 'Coinbase' ? ' spot' : '');
                row.innerHTML = `<span class="ls-nm"></span><div class="ls-bar"><i></i><b class="l"></b><b class="s"></b></div><span class="ls-v ls-lv"></span><span class="ls-v ls-sv"></span><svg class="ls-sp" viewBox="0 0 80 22" preserveAspectRatio="none"><polyline points=""/></svg>`;
                box.appendChild(row);
            }
            const q = s => row.querySelector(s);
            row.classList.toggle('err', !!r.error);
            q('.ls-nm').textContent = r.name + (r.partial ? '*' : '');
            q('.ls-bar').title = r.error || (r.partial ?  `Sampel hanya ${r.secs} detik terakhir; ikut rata-rata All tapi bobotnya kecil` : '');
            if (r.error) { q('i').style.width = '0%'; q('.l').textContent = q('.s').textContent = '—'; q('.ls-lv').textContent = q('.ls-sv').textContent = '—'; return; }

            q('i').style.width = r.pct + '%';
            tween(q('.l'), r.pct, v => v.toFixed(2) + '%');
            tween(q('.s'), 100 - r.pct, v => v.toFixed(2) + '%');
            if (r.usd) { tween(q('.ls-lv'), r.buy, fmt); tween(q('.ls-sv'), r.sell, fmt); }
            else { q('.ls-lv').textContent = q('.ls-sv').textContent = '—'; }

            if (Date.now() - (lastPush[r.name] || 0) >= 1000) {
                lastPush[r.name] = Date.now();
                const h = (hist[r.name] = hist[r.name] || []);
                h.push(r.pct); if (h.length > 40) h.shift();
                const lo = Math.min(...h, 40), hi = Math.max(...h, 60);
                q('polyline').setAttribute('points', h.map((y, i) => `${(i / Math.max(1, h.length - 1)) * 80},${22 - ((y - lo) / (hi - lo)) * 20 - 1}`).join(' '));
            }
        });
    }

    async function pull() {
        const my = ++token;
        try {
            const r = await fetch(`/api/market?coin=${state.coin}&tf=${state.tf}`);
            if (!r.ok) throw 0;
            const d = await r.json();
            if (my !== token) return;
            d.t = Date.now() - (Number(r.headers.get('age')) || 4) * 1000;
            base = d;
            $('#ls-st').className = 'ls-status live';
            $('#ls-info').textContent = `${d.coin} · ${d.minutes >= 60 ? d.minutes / 60 + ' jam' : d.minutes + ' menit'} terakhir · live`;
        } catch (e) {
            if (my === token) { $('#ls-st').className = 'ls-status off'; $('#ls-info').textContent = 'gagal memuat, mencoba lagi…'; }
        }
    }

    function reset() { $('#ls-rows').innerHTML = ''; hist = {}; lastPush = {}; base = null; pull(); }

    function start() {
        if (running) return;
        running = true;
        startFeeds(state.coin); pull();
        timers = [
            setInterval(view, 250),
            setInterval(pull, 30000),
            setInterval(() => { $('#ls-clock').textContent = new Date().toLocaleTimeString('id-ID', { hour12: false }).replace(/\./g, ':'); }, 1000),
        ];
    }
    function stop() {
        running = false;
        timers.forEach(clearInterval); timers = [];
        socks.forEach(s => s.close()); socks = []; buf = {};
    }

    $('#ls-coin').onchange = e => { state.coin = e.target.value; startFeeds(state.coin); reset(); };
    $('#ls-tf').onchange = e => { state.tf = e.target.value; reset(); };
    document.addEventListener('visibilitychange', () => { if (running && !document.hidden) pull(); });
    window.xlStart = start; window.xlStop = stop;
})();

// ═══ TOKEN UNLOCKS (DefiLlama via /api/admin-airdrop?type=token-unlocks) ═══
(function () {
    const $ = s => document.querySelector(s);
    const st = { days: 30, kind: 'all', items: [], t: 0, busy: false, tries: 0, page: 1, size: 10 };
    const SIZES = [10, 20, 50];
    const pretty = s => s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const dateTxt = ts => new Date(ts * 1000).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
    const cdTxt = ts => {
        const ms = ts * 1000 - Date.now();
        if (ms <= 0) return 'sudah rilis';
        const mins = Math.floor(ms / 60000);
        if (mins < 48 * 60) return `${Math.floor(mins / 60)} jam ${mins % 60} mnt`;
        return Math.ceil(ms / 86400000) + ' hari';
    };
    const setStatus = t => { const el = $('#tu-status'); if (el) el.textContent = t; };

    function pager(n) {
        const el = $('#tu-pager');
        if (!el) return;
        if (!n) { el.innerHTML = ''; return; }
        const p = st.page;
        const nums = [...new Set([1, p - 1, p, p + 1, n].filter(x => x >= 1 && x <= n))].sort((a, b) => a - b);
        let h = `<button class="fls-pg" type="button" data-pg="${p - 1}" ${p <= 1 ? 'disabled' : ''}>‹</button>`;
        nums.forEach((x, i) => {
            if (i && x - nums[i - 1] > 1) h += '<span class="fls-dots">…</span>';
            h += `<button class="fls-pg ${x === p ? 'on' : ''}" type="button" data-pg="${x}">${x}</button>`;
        });
        h += `<button class="fls-pg" type="button" data-pg="${p + 1}" ${p >= n ? 'disabled' : ''}>›</button>`;
        h += `<select id="tu-size" aria-label="Baris per halaman">${SIZES.map(v => `<option value="${v}" ${v === st.size ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
        el.innerHTML = h;
    }

    function render() {
        const body = $('#tu-body');
        if (!body) return;
        const all = st.items.filter(i => st.kind === 'all' || i.kind === st.kind);
        const n = Math.max(1, Math.ceil(all.length / st.size));
        if (st.page > n) st.page = n;
        if (!all.length) {
            body.innerHTML = '<tr><td colspan="7" class="tu-empty">Tidak ada unlock di rentang ini.</td></tr>';
            pager(0);
            return;
        }
        const rows = all.slice((st.page - 1) * st.size, st.page * st.size);
        body.innerHTML = rows.map(i => `<tr class="tu-row ${i.pct >= 1 ? 'big' : ''}">
            <td>${dateTxt(i.ts)}</td>
            <td class="tu-tok">${esc(pretty(i.slug))}</td>
            <td class="tu-cat">${esc(i.cat)}</td>
            <td class="r tu-amt">${ocAmt(i.amount)}${i.kind === 'linear' ? ` <small>/ ${i.span} hari</small>` : ''}</td>
            <td class="r tu-pct">${i.pct.toFixed(2)}%</td>
            <td><span class="tu-badge ${i.kind}">${i.kind === 'linear' ? 'Linear' : 'Cliff'}</span></td>
            <td class="r tu-cd" data-ts="${i.ts}">${cdTxt(i.ts)}</td></tr>`).join('');
        pager(n);
    }

    async function load(force, isRetry) {
        if (st.busy) return;
        if (!force && st.items.length && Date.now() - st.t < 10 * 60e3) return;
        if (!isRetry) st.tries = 0;
        st.busy = true;
        setStatus('Memuat…');
        let again = false;
        try {
            const r = await fetch(`/api/admin-airdrop?type=token-unlocks&days=${st.days}`);
            if (r.status === 401) throw new Error('sesi habis, login ulang');
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const d = await r.json();
            st.items = d.items || [];
            st.t = Date.now();
            render();
            const miss = d.missing || [];
            const hhmm = new Date().toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':');
            setStatus(`${st.items.length} event · ${d.loaded}/${d.total} protokol · ${hhmm} WIB`
                + (miss.length ? ` · ${miss.length} belum termuat (${miss.slice(0, 3).join(', ')}${miss.length > 3 ? '…' : ''})` : ''));
            again = miss.length > 0 && st.tries < 3;   // sisanya dimuat di putaran berikutnya (sudah ke-cache)
        } catch (e) {
            setStatus('Gagal: ' + e.message);
        } finally {
            st.busy = false;
        }
        if (again) { st.tries++; setTimeout(() => load(true, true), 2500); }
    }

    $('#tu-days').onchange = e => { st.days = +e.target.value; st.page = 1; load(true); };
    $('#tu-kind').onchange = e => { st.kind = e.target.value; st.page = 1; render(); };
    $('#tu-refresh').onclick = () => load(true);
    $('#tu-pager').addEventListener('click', e => {
        const b = e.target.closest('[data-pg]');
        if (b && !b.disabled) { st.page = +b.dataset.pg; render(); }
    });
    $('#tu-pager').addEventListener('change', e => {
        if (e.target.id !== 'tu-size') return;
        st.size = +e.target.value; st.page = 1; render();
    });

    let tRefresh = null, tTick = null;
    const tick = () => document.querySelectorAll('#tu-body .tu-cd[data-ts]')
        .forEach(el => { el.textContent = cdTxt(+el.dataset.ts); });
    const startTimers = () => {
        if (tRefresh) return;
        tRefresh = setInterval(() => { if (!document.hidden) load(true); }, 10 * 60e3);   // ambil ulang tiap 10 menit
        tTick = setInterval(() => { if (!document.hidden) tick(); }, 30e3);              // countdown jalan tiap 30 detik
    };
    const stopTimers = () => { clearInterval(tRefresh); clearInterval(tTick); tRefresh = tTick = null; };
    document.addEventListener('visibilitychange', () => { if (!document.hidden && tRefresh) { tick(); load(); } });

    const baseStart = window.xlStart, baseStop = window.xlStop;
    window.xlStart = function () { baseStart && baseStart(); load(); startTimers(); };
    window.xlStop  = function () { baseStop && baseStop(); stopTimers(); };
})();

// ═══ CHART BTCUSDT.P vs BTC.D (lightweight-charts, skala persen) ═══
(function () {
    const OFF = 7 * 3600;                                   // tampil dalam WIB
    const TFS = [['5m', '5m'], ['15m', '15m'], ['1h', '1H'], ['4h', '4H'], ['1d', '1D']];
    const st = { tf: '1h', chart: null, sB: null, sD: null, sU: null, usdt: [], btc: [], dom: [], ws: null, timer: null, run: false, token: 0, bB: 0 };
    const $ = s => document.querySelector(s);
    const pct = (v, b) => (v / b - 1) * 100;
    const fmtP = v => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
    const setNote = t => { const el = $('#btc-note'); if (el) el.textContent = t; };
    const setLegend = (b, d, u) => {
    $('#btc-b').textContent = b == null ? '--' : fmtP(b);
    $('#btc-d').textContent = d == null ? '--' : fmtP(d);
    $('#btc-u').textContent = u == null ? '--' : fmtP(u);
    };

    function build() {
    if (st.chart) return;
    const box = $('#btc-chart');
    if (!box) return;
    if (typeof LightweightCharts === 'undefined') {
        setNote('Library chart gagal dimuat (cek koneksi/CDN).');
        return;
    }
    st.chart = LightweightCharts.createChart(box, {
            autoSize: true,
            layout: { background: { type: 'solid', color: '#0A0A0A' }, textColor: '#A1A1AA', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
            grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
            rightPriceScale: { borderColor: '#2A2A2A' },
            timeScale: { borderColor: '#2A2A2A', timeVisible: true, secondsVisible: false },
            crosshair: { mode: 1, vertLine: { color: '#444', labelBackgroundColor: '#1B1B1B' }, horzLine: { color: '#444', labelBackgroundColor: '#1B1B1B' } },
            localization: { priceFormatter: fmtP },
        });
        const opt = color => ({ color, lineWidth: 2, priceFormat: { type: 'custom', formatter: fmtP, minMove: 0.01 } });
        st.sU = st.chart.addLineSeries(opt('#38BDF8'));
        st.sD = st.chart.addLineSeries(opt('#35E0A1'));
        st.sB = st.chart.addLineSeries(opt('#EF4444'));
        st.sB.createPriceLine({ price: 0, color: '#444', lineWidth: 1, lineStyle: 2, axisLabelVisible: false });

        st.chart.subscribeCrosshairMove(p => {
            if (!p.time || !p.seriesData) return;
            setLegend(p.seriesData.get(st.sB)?.value, p.seriesData.get(st.sD)?.value, p.seriesData.get(st.sU)?.value);
        });

        $('#btc-tf').innerHTML = TFS.map(([k, l]) => `<button class="nlf-btn ${k === st.tf ? 'active' : ''}" data-tf="${k}" type="button">${l}</button>`).join('');
        $('#btc-tf').addEventListener('click', e => {
            const b = e.target.closest('[data-tf]');
            if (!b || b.dataset.tf === st.tf) return;
            st.tf = b.dataset.tf;
            $('#btc-tf').querySelectorAll('.nlf-btn').forEach(x => x.classList.toggle('active', x === b));
            Promise.all([loadBtc(), loadDom()]).then(() => render(true));
            connectWs();
        });
    }

    async function loadBtc() {
        const my = ++st.token;
        try {
            const r = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=${st.tf}&limit=1000`);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const k = await r.json();
            if (my !== st.token) return;
            st.btc = k.map(x => [Math.floor(x[0] / 1000), +x[4]]);
        } catch (e) { setNote('Gagal memuat harga BTCUSDT.P dari Binance: ' + e.message); }
    }

    async function loadDom() {
    try {
        const r = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=BTCDOMUSDT&interval=${st.tf}&limit=1000`);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const k = await r.json();
        st.dom = k.map(x => [Math.floor(x[0] / 1000), +x[4]]);
        st.domSrc = 'binance';
        return;
    } catch {}
    try {   // cadangan: rekaman sendiri
        const r = await fetch('/api/admin-airdrop?type=btcd');
        if (r.ok) { st.dom = await r.json(); st.domSrc = 'rec'; }
    } catch {}
}
async function loadUsdt() {
    try {
        const r = await fetch('/api/admin-airdrop?type=usdtd');
        if (!r.ok) return;
        const d = await r.json();
        if (Array.isArray(d)) st.usdt = d;
    } catch {}
}

    function render(fit) {
        if (!st.sB || !st.btc.length) return;
        const hasDom = st.dom.length >= 2;
        let t0 = st.btc[0][0];
        if (hasDom) t0 = Math.max(t0, st.dom[0][0]);          // kedua garis mulai dari 0% di titik BTC.D pertama
        let i = 0;
        for (let j = st.btc.length - 1; j >= 0; j--) if (st.btc[j][0] <= t0) { i = j; break; }
        const b = st.btc.slice(i);
        st.bB = b[0][1];
        const bData = b.map(p => ({ time: p[0] + OFF, value: pct(p[1], st.bB) }));
        st.sB.setData(bData);

        let dLast = null;
        if (hasDom) {
            const d = st.dom.filter(p => p[0] >= t0), seen = new Set(), dData = [];
            const bD = d[0][1];
            d.forEach(p => { if (!seen.has(p[0])) { seen.add(p[0]); dData.push({ time: p[0] + OFF, value: pct(p[1], bD) }); } });
            st.sD.setData(dData);
            dLast = dData[dData.length - 1].value;
            const since = new Date(st.dom[0][0] * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
           setNote(st.domSrc === 'binance'
           ? 'BTC.D memakai index BTCDOMUSDT (Binance Futures), proxy dominance BTC. Kedua garis dimulai dari 0% di awal rentang.'
          : `BTC.D direkam sejak ${since} WIB (1 titik / 5 menit selama dashboard terbuka). Kedua garis dimulai dari 0% di titik itu.`);
        } else {
            st.sD.setData([]);
            setNote('BTC.D baru mulai direkam. Garis hijau muncul setelah ada minimal 2 titik (1 titik / 5 menit selama dashboard terbuka).');
        }

let uLast = null;
const u = st.usdt.filter(p => p[0] >= t0);
if (u.length >= 2) {
    const seenU = new Set(), uData = [];
    u.forEach(p => { if (!seenU.has(p[0])) { seenU.add(p[0]); uData.push({ time: p[0] + OFF, value: pct(p[1], u[0][1]) }); } });
    st.sU.setData(uData);
    uLast = uData[uData.length - 1].value;
  } else st.sU.setData([]);
setLegend(bData[bData.length - 1].value, dLast, uLast);
    }


    function connectWs() {
        if (st.ws) { st.ws.onclose = null; st.ws.close(); st.ws = null; }
        if (!st.run) return;
        const tf = st.tf, w = new WebSocket(`wss://fstream.binance.com/ws/btcusdt@kline_${tf}`);
        st.ws = w;
        w.onmessage = e => {
            const k = JSON.parse(e.data).k;
            if (!k || tf !== st.tf || !st.bB) return;
            const t = Math.floor(k.t / 1000), c = +k.c, last = st.btc[st.btc.length - 1];
            if (last && last[0] === t) last[1] = c; else st.btc.push([t, c]);
            const v = pct(c, st.bB);
            st.sB.update({ time: t + OFF, value: v });
            $('#btc-b').textContent = fmtP(v);
        };
        w.onclose = () => { if (st.run && st.ws === w) setTimeout(connectWs, 3000); };
    }

    function start() {
    if (st.run) return;
    st.run = true;
    build();
    Promise.all([loadBtc(), loadDom(), loadUsdt()]).then(() => render(true));
    connectWs();
    st.timer = setInterval(async () => { await Promise.all([loadDom(), loadUsdt()]); render(false); }, 60000);
}
    function stop() {
        st.run = false;
        clearInterval(st.timer); st.timer = null;
        if (st.ws) { st.ws.onclose = null; st.ws.close(); st.ws = null; }
    }

    const prevStart = window.xlStart, prevStop = window.xlStop;
    window.xlStart = function () { prevStart && prevStart(); start(); };
    window.xlStop  = function () { prevStop && prevStop(); stop(); };
})();
function showMarketDashboard() {
    document.getElementById('halaman-market').style.display = 'block';
    document.getElementById('halaman-airdrop').style.display = 'none';
    window.xlStart && xlStart();
}
function showAirdropDashboard() {
    if (isMember()) return;

    document.getElementById('halaman-market').style.display = 'none';
    document.getElementById('halaman-airdrop').style.display = 'block';
    window.xlStop && xlStop();
}

(function () {
    const $ = s => document.querySelector(s);
    const FAPI = 'https://fapi.binance.com/fapi/v1';
    const TFS = [['5m', 5], ['15m', 15], ['30m', 30], ['1h', 60], ['4h', 240]];
    const DEF_TFS = ['5m', '30m', '1h', '4h'];
    const SIZES = [10, 20, 50, 100], POLL_MS = 30000;

    const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return Array.isArray(v) && v.length ? v : d; } catch { return d; } };
    const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
    const loadSize = () => { try { const v = +localStorage.getItem('flsSize'); return SIZES.includes(v) ? v : 20; } catch { return 20; } };

    const st = {
        tfs: load('flsTfs', DEF_TFS).filter(t => TFS.some(x => x[0] === t)),
        size: loadSize(), page: 1, list: [], tick: null, data: {}, pgSig: '',
        sort: null, filter: 'all', run: false, timer: null, token: 0, busy: false, again: false,
    };
    if (!st.tfs.length) st.tfs = DEF_TFS.slice();

    const activeTfs = () => TFS.map(x => x[0]).filter(t => st.tfs.includes(t));
    const coinOf = s => s.replace(/USDT$/, '').replace(/^1(0{3,})(?=[A-Z])/, '');
    const usd = v => { const a = Math.abs(v); return '$' + (a >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (v / 1e3).toFixed(2) + 'K' : v.toFixed(0)); };
    const price = p => '$' + (p >= 1 ? p.toFixed(2) : String(Number(p.toPrecision(4))));
    const hue = s => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360; return `hsl(${h} 80% 62%)`; };
    const setStatus = t => { const el = $('#fls-status'); if (el) el.textContent = t; };
    const heat = (pct, rgb) => pct > 50 ? `background:rgba(${rgb},${((Math.min(pct, 90) - 50) / 40 * 0.75).toFixed(2)})` : '';

    async function getTicker() {
        const r = await fetch(FAPI + '/ticker/24hr');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const m = {}, list = [];
        (await r.json()).forEach(x => {
            if (!/^[A-Z0-9]+USDT$/.test(x.symbol)) return;      // buang kontrak kuartalan (BTCUSDT_xxxx)
            m[x.symbol] = x;
            if (+x.quoteVolume > 0) list.push(x.symbol);
        });
        list.sort((a, b) => m[b].quoteVolume - m[a].quoteVolume); // default: volume 24h terbesar
        st.tick = m; st.list = list;
        return m;
    }

    const pages = () => Math.max(1, Math.ceil(st.list.length / st.size));

    function ordered() {   // sort global hanya untuk price & 24h (datanya ada di ticker)
        const l = st.list.slice();
        if (st.sort && (st.sort.key === 'price' || st.sort.key === 'chg')) {
            const f = st.sort.key === 'price' ? 'lastPrice' : 'priceChangePercent';
            l.sort((a, b) => (+st.tick[a][f] - +st.tick[b][f]) * st.sort.dir);
        }
        return l;
    }
    const pageSyms = () => ordered().slice((st.page - 1) * st.size, st.page * st.size);

    async function pullCoin(s, t) {
        const r = await fetch(`${FAPI}/klines?symbol=${s}&interval=1m&limit=240`);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const k = await r.json();
        const tf = {};
        TFS.forEach(([key, n]) => {
            const w = k.slice(-n);
            const total = w.reduce((a, x) => a + +x[7], 0);
            const long = w.reduce((a, x) => a + +x[10], 0);
            tf[key] = { long, short: total - long, total, lp: total > 0 ? (long / total) * 100 : 0 };
        });
        return { price: +t[s].lastPrice, chg: +t[s].priceChangePercent, tf };
    }

    async function refresh() {
        if (!st.run) return;
        if (st.busy) { st.again = true; return; }
        st.busy = true;
        const my = ++st.token;
        try {
            const t = await getTicker();
            if (st.page > pages()) st.page = pages();
            const syms = pageSyms();
            const res = await Promise.allSettled(syms.map(s => pullCoin(s, t)));
            if (my !== st.token) return;
            let fail = 0;
            res.forEach((r, i) => {
                if (r.status === 'fulfilled') st.data[syms[i]] = r.value;
                else { fail++; if (!st.data[syms[i]] || st.data[syms[i]].err) st.data[syms[i]] = { err: String(r.reason?.message || r.reason).slice(0, 60) }; }
            });
            pager(); render();
            const hhmm = new Date().toLocaleTimeString('id-ID', { hour12: false, timeZone: 'Asia/Jakarta' }).replace(/\./g, ':');
            setStatus(`Binance Futures · ${st.list.length} koin · halaman ${st.page}/${pages()} (${syms.length - fail}/${syms.length} termuat) · ${hhmm} WIB · update tiap ${POLL_MS / 1000} dtk`);
        } catch (e) {
            setStatus('Gagal memuat dari Binance: ' + e.message + ' · mencoba lagi…');
        } finally {
            st.busy = false;
            if (st.again) { st.again = false; refresh(); }
        }
    }

    const arrow = key => st.sort && st.sort.key === key ? (st.sort.dir > 0 ? '▲' : '▼') : '⇅';

    function render() {
        const head = $('#fls-head'), body = $('#fls-body');
        if (!head || !body) return;
        const tfs = activeTfs();
        const th = (key, label) => `<th data-sort="${key}">${label}<span class="fls-arr">${arrow(key)}</span></th>`;
        head.innerHTML = `<tr><th class="fls-l">Symbol</th>${th('price', 'Price')}${th('chg', '24H (%)')}`
            + tfs.map(t => th('long:' + t, `Long(${t})`) + th('short:' + t, `Short(${t})`)).join('') + '</tr>';

        let list = st.tick ? pageSyms().map(s => ({ s, c: coinOf(s), d: st.data[s] })) : [];

        if (st.filter !== 'all') {
            const ref = tfs[tfs.length - 1];
            list = list.filter(x => x.d && x.d.tf && (st.filter === 'long' ? x.d.tf[ref].lp > 50 : x.d.tf[ref].lp < 50 && x.d.tf[ref].total > 0));
        }
        if (st.sort && st.sort.key.includes(':')) {   // sort kolom Long/Short: hanya dalam halaman ini
            const { key, dir } = st.sort, [side, tf] = key.split(':');
            const val = x => (!x.d || x.d.err || !x.d.tf[tf]) ? null : x.d.tf[tf][side];
            list.sort((a, b) => { const va = val(a), vb = val(b); if (va === null) return 1; if (vb === null) return -1; return (va - vb) * dir; });
        }

        const span = 2 + tfs.length * 2;
        body.innerHTML = list.length ? list.map(({ c, d }) => {
            const sym = `<td class="fls-l"><div class="fls-sym"><span class="fls-ico" style="background:${hue(c)}">${esc(c[0])}</span>${esc(c)}</div></td>`;
            if (!d || d.err) return `<tr>${sym}<td class="fls-err" colspan="${span}">${d ? esc(d.err) : 'Memuat…'}</td></tr>`;
            const chgBg = `background:rgba(${d.chg >= 0 ? '53,224,161' : '239,68,68'},${Math.min(Math.abs(d.chg) / 8, 1) * 0.35})`;
            const cells = tfs.map(t => {
                const x = d.tf[t], sp = x.total > 0 ? 100 - x.lp : 0;
                return `<td class="fls-c" style="${heat(x.lp, '53,224,161')}"><b>${usd(x.long)}</b><span>${x.lp.toFixed(2)}%</span></td>`
                     + `<td class="fls-c" style="${heat(sp, '255,100,100')}"><b>${usd(x.short)}</b><span>${sp.toFixed(2)}%</span></td>`;
            }).join('');
            return `<tr>${sym}<td class="fls-px">${price(d.price)}</td><td class="fls-chg" style="${chgBg}">${d.chg >= 0 ? '+' : ''}${d.chg.toFixed(2)}%</td>${cells}</tr>`;
        }).join('') : `<tr><td class="fls-err" colspan="${span + 1}" style="text-align:center!important;padding:1.6rem">${st.tick ? 'Tidak ada koin yang cocok dengan filter.' : 'Memuat…'}</td></tr>`;
    }

    // ── pagination ──
    function pager(force) {
        const n = pages(), p = st.page, sig = `${n}|${p}|${st.size}`;
        if (!force && sig === st.pgSig) return;   // jangan render ulang tiap polling (dropdown bisa menutup sendiri)
        st.pgSig = sig;
        const nums = [...new Set([1, p - 1, p, p + 1, n].filter(x => x >= 1 && x <= n))].sort((a, b) => a - b);
        let h = `<button class="fls-pg" type="button" data-pg="${p - 1}" ${p <= 1 ? 'disabled' : ''}>‹</button>`;
        nums.forEach((x, i) => {
            if (i && x - nums[i - 1] > 1) h += '<span class="fls-dots">…</span>';
            h += `<button class="fls-pg ${x === p ? 'on' : ''}" type="button" data-pg="${x}">${x}</button>`;
        });
        h += `<button class="fls-pg" type="button" data-pg="${p + 1}" ${p >= n ? 'disabled' : ''}>›</button>`;
        h += `<select id="fls-size" aria-label="Baris per halaman">${SIZES.map(v => `<option value="${v}" ${v === st.size ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
        const el = $('#fls-pager'); if (el) el.innerHTML = h;
    }
    function gotoPage(p) {
        p = Math.min(pages(), Math.max(1, p));
        if (p === st.page) return;
        st.page = p; pager(); render(); refresh();
    }
    $('#fls-pager').addEventListener('click', e => {
        const b = e.target.closest('[data-pg]');
        if (b && !b.disabled) gotoPage(+b.dataset.pg);
    });
    $('#fls-pager').addEventListener('change', e => {
        if (e.target.id !== 'fls-size') return;
        st.size = +e.target.value; st.page = 1;
        try { localStorage.setItem('flsSize', st.size); } catch {}
        pager(true); render(); refresh();
    });

    // ── popup Customize (sekarang hanya timeframe) ──
    function renderPop() {
        $('#fls-pop-tf').innerHTML = TFS.map(([k]) => `<button type="button" class="fls-chip ${st.tfs.includes(k) ? 'on' : ''}" data-tf="${k}">${k}</button>`).join('');
    }
    $('#fls-cust-btn').onclick = e => { e.stopPropagation(); $('#fls-pop').classList.toggle('hidden'); renderPop(); };
    document.addEventListener('click', e => { if (!e.target.closest('.fls-cust')) $('#fls-pop').classList.add('hidden'); });
    $('#fls-pop').addEventListener('click', e => {
        e.stopPropagation();
        const tf = e.target.closest('[data-tf]')?.dataset.tf;
        if (tf) {
            const on = st.tfs.includes(tf);
            if (on && st.tfs.length === 1) return;
            if (on && st.sort && st.sort.key.split(':')[1] === tf) st.sort = null;   // fix sort nyangkut di kolom tersembunyi
            st.tfs = on ? st.tfs.filter(x => x !== tf) : [...st.tfs, tf];
            save('flsTfs', st.tfs); renderPop(); render();
        } else if (e.target.id === 'fls-reset') {
            st.tfs = DEF_TFS.slice(); save('flsTfs', st.tfs); st.sort = null;
            renderPop(); render();
        }
    });

    // ── sort & filter ──
    $('#fls-head').addEventListener('click', e => {
        const key = e.target.closest('[data-sort]')?.dataset.sort;
        if (!key) return;
        if (!st.sort || st.sort.key !== key) st.sort = { key, dir: -1 };
        else if (st.sort.dir < 0) st.sort.dir = 1;
        else st.sort = null;
        st.page = 1; pager(); render(); refresh();   // urutan global berubah, jadi koin di halaman ikut berubah
    });
    $('#fls-filter').onchange = e => { st.filter = e.target.value; render(); };

    function start() {
        if (st.run) return;
        st.run = true;
        pager(true); render(); refresh();
        st.timer = setInterval(() => { if (!document.hidden) refresh(); }, POLL_MS);
    }
    function stop() { st.run = false; clearInterval(st.timer); st.timer = null; }
    document.addEventListener('visibilitychange', () => { if (st.run && !document.hidden) refresh(); });

    const prevStart = window.xlStart, prevStop = window.xlStop;
    window.xlStart = function () { prevStart && prevStart(); start(); };
    window.xlStop  = function () { prevStop && prevStop(); stop(); };
})();

// ═══ HEATMAP 24 JAM + FEAR & GREED ═══
(function () {
    const $ = s => document.querySelector(s);
    const TABS = [['vol', 'Volume'], ['oi', 'Open Interest'], ['tradfi', 'TradFi']];
    const st = { tab: 'vol', coins: [], exchanges: [], failed: {}, run: false, timer: null, fngT: 0 };
    const tiles = new Map();

    const money = v => '$' + (v >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v.toFixed(0));
    const bg = chg => {
        const a = (0.25 + Math.min(Math.abs(chg) / 6, 1) * 0.6).toFixed(2);
        return chg >= 0 ? `rgba(53,224,161,${a})` : `rgba(239,68,68,${a})`;
    };

    // ── squarified treemap ──
    function layout(items, W, H) {
        const total = items.reduce((s, i) => s + i.v, 0);
        if (!total) return [];
        const k = (W * H) / total, nodes = items.map(i => ({ ...i, a: i.v * k }));
        const out = []; let x = 0, y = 0, w = W, h = H, row = [];
        const sum = r => r.reduce((t, n) => t + n.a, 0);
        const worst = (r, side) => {
            const s = sum(r), mx = Math.max(...r.map(n => n.a)), mn = Math.min(...r.map(n => n.a));
            return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
        };
        const place = r => {
            const s = sum(r);
            if (w >= h) { const rw = s / h; let cy = y; r.forEach(n => { const rh = n.a / rw; out.push({ ...n, x, y: cy, w: rw, h: rh }); cy += rh; }); x += rw; w -= rw; }
            else { const rh = s / w; let cx = x; r.forEach(n => { const rw = n.a / rh; out.push({ ...n, x: cx, y, w: rw, h: rh }); cx += rw; }); y += rh; h -= rh; }
        };
        nodes.forEach(n => {
            const side = Math.min(w, h);
            if (!row.length || worst(row.concat(n), side) <= worst(row, side)) row.push(n);
            else { place(row); row = [n]; }
        });
        if (row.length) place(row);
        return out;
    }

    function render() {
        const map = $('#hm-map');
        if (!map) return;
        let list = st.coins;
        if (st.tab === 'tradfi') list = list.filter(c => c.tradfi);
        const key = st.tab === 'oi' ? 'oi' : 'vol';
        const items = list.filter(c => c[key] > 0).map(c => ({ ...c, v: c[key] })).sort((a, b) => b.v - a.v).slice(0, st.tab === 'tradfi' ? 30 : 60);

        if (!items.length) {
            tiles.forEach(t => t.remove()); tiles.clear();
            if (!map.querySelector('.hm-empty')) map.insertAdjacentHTML('beforeend', '<div class="hm-empty">Tidak ada data untuk tab ini.</div>');
            return;
        }
        map.querySelector('.hm-empty')?.remove();

        const W = map.clientWidth, H = map.clientHeight;
        const placed = layout(items, W, H), alive = new Set();
        placed.forEach(n => {
            alive.add(n.c);
            let el = tiles.get(n.c);
            if (!el) { el = document.createElement('div'); el.className = 'hm-t'; el.innerHTML = '<b></b><span></span>'; map.appendChild(el); tiles.set(n.c, el); }
            const fs = Math.max(9, Math.min(26, Math.sqrt(n.w * n.h) / 5));
            el.style.cssText = `left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;background:${bg(n.chg)};`;
            const b = el.firstChild, s = el.lastChild;
            b.textContent = n.c; b.style.fontSize = fs + 'px';
            s.textContent = `${n.chg >= 0 ? '+' : ''}${n.chg.toFixed(2)}%`; s.style.fontSize = Math.max(8, fs * 0.6) + 'px';
            s.style.display = n.h < 38 || n.w < 46 ? 'none' : 'block';
            b.style.display = n.h < 20 || n.w < 28 ? 'none' : 'block';
            el.title = `${n.c}\nVol: ${money(n.vol)}\nOI: ${money(n.oi)}\n24h: ${n.chg.toFixed(2)}%` + (n.fund != null ? `\nFunding: ${n.fund.toFixed(4)}%` : '');
        });
        tiles.forEach((el, c) => { if (!alive.has(c)) { el.remove(); tiles.delete(c); } });
    }

    function renderTabs() {
        $('#hm-tabs').innerHTML = TABS.map(([k, l]) => `<button type="button" class="hm-tab ${k === st.tab ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('');
    }
    $('#hm-tabs').addEventListener('click', e => {
        const b = e.target.closest('[data-tab]');
        if (!b || b.dataset.tab === st.tab) return;
        st.tab = b.dataset.tab; renderTabs(); render();
    });

    async function load() {
        try {
            const r = await fetch('/api/heatmap');
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
            st.coins = d.coins || []; st.exchanges = d.exchanges || []; st.failed = d.failed || {};
            render();
            const hhmm = new Date().toLocaleTimeString('id-ID', { hour12: false, timeZone: 'Asia/Jakarta' }).replace(/\./g, ':');
            const bad = Object.keys(st.failed);
            $('#hm-status').textContent = `${st.exchanges.join(', ')} · ${st.coins.length} koin · ${hhmm} WIB`;
            $('#hm-note').textContent = 'Ukuran kotak = ' + (st.tab === 'oi' ? 'open interest' : 'volume 24 jam')
                + ', warna = perubahan 24 jam (rata-rata berbobot volume antar bursa). Hijau naik, merah turun.'
                + (bad.length ? ` Bursa gagal: ${bad.map(k => k + ' (' + st.failed[k] + ')').join(', ')}.` : '');
        } catch (e) {
            $('#hm-status').textContent = 'Gagal memuat heatmap: ' + e.message + ' · mencoba lagi…';
        }
    }

    // ── Fear & Greed ──
const fngColor = v => v < 25 ? '#EF4444' : v < 45 ? '#F59E0B' : v < 55 ? '#FFD23F' : v < 75 ? '#84cc16' : '#35E0A1';
const fngLabel = v => v < 25 ? 'Extreme Fear' : v < 45 ? 'Fear' : v < 55 ? 'Neutral' : v < 75 ? 'Greed' : 'Extreme Greed';

async function loadFng() {
    if (Date.now() - st.fngT < 15 * 60e3) return;
    try {
        const r = await fetch('/api/heatmap?type=fng');
        const json = await r.json().catch(() => ({}));

        if (!r.ok) throw new Error(json.error || ('HTTP ' + r.status));

        if (!json.data || typeof json.data.value === 'undefined') {
            throw new Error('data Fear & Greed kosong');
        }

        st.fngT = Date.now();
        const v = Number(json.data.value);
        const label = json.data.value_classification || fngLabel(v);

        $('#fng-needle').style.transform = `rotate(${v * 1.8 - 90}deg)`;
        $('#fng-val').textContent = v;
        $('#fng-val').style.color = fngColor(v);
        $('#fng-cls').textContent = label;
        $('#fng-cls').style.color = fngColor(v);

        $('#fng-hist').innerHTML = `
            <div class="fng-row">
                <span>Sekarang</span>
                <b style="background:${fngColor(v)}">${v}</b>
            </div>
        `;
        $('#fng-note').textContent = 'Sumber: CoinMarketCap • Update setiap 15 menit';
    } catch (e) {
        $('#fng-cls').textContent = 'Gagal memuat';
        $('#fng-note').textContent = e.message;
    }
}
    function start() {
        if (st.run) return;
        st.run = true; renderTabs(); load(); loadFng();
        st.timer = setInterval(() => { if (!document.hidden) { load(); loadFng(); } }, 15000);
    }
    function stop() { st.run = false; clearInterval(st.timer); st.timer = null; }
    let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (st.run) render(); }, 150); });

    const ps = window.xlStart, pp = window.xlStop;
    window.xlStart = function () { ps && ps(); start(); };
    window.xlStop  = function () { pp && pp(); stop(); };
})();