/* dashboard.js — pasang SETELAH </script> inline terakhir di index.html:
   <script src="dashboard.js"></script>
   Memakai fungsi/variabel lama: esc, ocAmt, BN, newsItems, loadNews, NEWS_SOURCES, newsTimeAgo,
   openNewsSend, ocLive*, openOnchain, ocLivePick. */
(function () {
  const $ = s => document.querySelector(s);
  const fmt = (n, d = 2) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
  const J = async (u, o) => { const r = await fetch(u, o); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
  const kv = (l, v, c = '') => `<div class="kv"><span>${l}</span><b class="${c}">${v}</b></div>`;
  const pc = n => `<span class="${n >= 0 ? 'up' : 'dn'}">${n >= 0 ? '+' : ''}${n.toFixed(2)}%</span>`;
  const usd = n => '$' + ocAmt(n);
  const wib = () => new Date().toLocaleTimeString('id-ID', { hour12: false, timeZone: 'Asia/Jakarta' });
  const find = k => DEFS.find(d => d.k === k);
  const LQ = { ev: [], ws: null };
  const FEED = { s: 'id' };
  let run = false, timers = [];

  /* ───────── DAFTAR CARD (urutan = round-robin ke kolom) ───────── */
  const DEFS = [
    { k: 'news', t: 'News Terminal', b: 'live', every: 15000, load: async b => {
        if (!b.querySelector('select')) {
          b.innerHTML = `<select class="dgsel"><option value="all">Semua sumber</option>${Object.entries(NEWS_SOURCES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select><div class="lst"></div>`;
          b.querySelector('select').onchange = newsRender;
          b.addEventListener('click', e => { const x = e.target.closest('[data-send]'); if (x && !x.disabled) openNewsSend(x.dataset.send); });
        }
        const f = b.querySelector('select').value;
        const items = newsItems.filter(n => f === 'all' || n.source === f)
          .sort((a, c) => new Date(c.published_at) - new Date(a.published_at)).slice(0, 15);
        b.querySelector('.lst').innerHTML = items.map(n => {
          const sc = NEWS_SOURCES[n.source] || { label: n.source, color: 'var(--primary)' };
          return `<div class="it" style="--c:${sc.color}"><div class="meta"><b>${esc(sc.label)}</b><span>${newsTimeAgo(n.published_at)}</span></div>
            <div class="tx">${esc(n.title)}</div>
            <button class="btn-save" data-send="${esc(n.id)}" ${n.status === 'sent' ? 'disabled' : ''}>${n.status === 'sent' ? 'Terkirim ✓' : 'Kirim'}</button></div>`;
        }).join('') || '<div class="mut">Belum ada berita</div>';
    } },

    { k: 'btcnet', t: 'BTC Network', b: 'mempool.space', every: 60000, load: async b => {
        const M = 'https://mempool.space/api';
        const [h, m, f, d] = await Promise.all([J(M + '/blocks/tip/height'), J(M + '/mempool'), J(M + '/v1/fees/recommended'), J(M + '/v1/difficulty-adjustment')]);
        b.innerHTML = `<div class="big">${fmt(h, 0)}</div><div class="mut">block height</div>`
          + kv('Mempool', fmt(m.count, 0) + ' tx') + kv('Fee cepat', f.fastestFee + ' sat/vB')
          + kv('Fee sedang', f.halfHourFee + ' sat/vB') + kv('Fee hemat', f.economyFee + ' sat/vB')
          + kv('Difficulty adj', pc(d.difficultyChange) + ' · ' + d.remainingBlocks + ' blok');
    } },

    { k: 'idr', t: 'Pasar Indonesia', b: 'IDR', every: 120000, load: async b => {
        const [g, fx, t] = await Promise.all([J('https://api.alternative.me/fng/'), J('https://open.er-api.com/v6/latest/USD'),
          J(BN + '/ticker/price?symbols=' + encodeURIComponent('["BTCUSDT","ETHUSDT","SOLUSDT"]'))]);
        const idr = fx.rates.IDR, p = Object.fromEntries(t.map(x => [x.symbol, +x.price])), f = g.data[0];
        b.innerHTML = kv('USD / IDR', 'Rp' + fmt(idr, 0))
          + ['BTC', 'ETH', 'SOL'].map(c => kv(c + ' / IDR', 'Rp' + fmt(p[c + 'USDT'] * idr, 0))).join('')
          + kv('Fear & Greed', f.value + ' · ' + f.value_classification, +f.value >= 50 ? 'up' : 'dn')
          + '<div class="mut" style="margin-top:6px">harga IDR = konversi kurs, bukan harga Indodax</div>';
    } },

    { k: 'liq', t: 'Liquidations', b: 'binance perps', every: 3000, load: async b => {
        const cut = Date.now() - 15 * 60e3, ev = LQ.ev.filter(e => e.t > cut);
        const L = ev.filter(e => e.long), S = ev.filter(e => !e.long), sum = a => a.reduce((s, e) => s + e.usd, 0);
        const big = ev.reduce((m, e) => (e.usd > (m?.usd || 0) ? e : m), null);
        b.innerHTML = kv('Long (15m)', usd(sum(L)) + ' · ' + L.length, 'dn') + kv('Short (15m)', usd(sum(S)) + ' · ' + S.length, 'up')
          + (big ? kv('Terbesar', `${big.s} ${big.long ? 'long' : 'short'} ${usd(big.usd)}`) : '')
          + '<div class="sub">terakhir</div>'
          + ev.slice(-7).reverse().map(e => kv(e.s, `<span class="${e.long ? 'dn' : 'up'}">${e.long ? 'LONG' : 'SHORT'}</span> ${usd(e.usd)}`)).join('')
          || '<div class="mut">menunggu data…</div>';
    } },

    { k: 'oi', t: 'Open Interest', b: 'hyperliquid', every: 60000, load: async b => {
        const [meta, ctx] = await J('https://api.hyperliquid.xyz/info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'metaAndAssetCtxs' }) });
        const rows = meta.universe.map((u, i) => ({ n: u.name, oi: +ctx[i].openInterest * +ctx[i].markPx, c: (+ctx[i].markPx / +ctx[i].prevDayPx - 1) * 100 })).sort((a, c) => c.oi - a.oi);
        const tot = rows.reduce((s, r) => s + r.oi, 0);
        b.innerHTML = `<div class="big up">${usd(tot)}</div><div class="mut">total · ${rows.length} market</div>`
          + rows.slice(0, 10).map(r => kv(r.n, usd(r.oi) + ' ' + pc(r.c))).join('');
    } },

    { k: 'movers', t: 'Top Movers', b: 'binance 24h', every: 60000, load: async b => {
        const u = (await J(BN + '/ticker/24hr')).filter(x => x.symbol.endsWith('USDT') && +x.quoteVolume > 3e7 && !/(UP|DOWN)USDT$/.test(x.symbol))
          .map(x => ({ s: x.symbol.slice(0, -4), p: +x.lastPrice, c: +x.priceChangePercent })).sort((a, c) => c.c - a.c);
        const row = r => kv(r.s, '$' + fmt(r.p, r.p >= 1 ? 2 : 6) + ' ' + pc(r.c));
        b.innerHTML = '<div class="sub">gainers</div>' + u.slice(0, 6).map(row).join('')
          + '<div class="sub">losers</div>' + u.slice(-6).reverse().map(row).join('');
    } },

    { k: 'rss', t: 'Berita', b: 'RSS publik', every: 300000, load: async b => {
        if (!b.querySelector('.chips')) {
          b.innerHTML = '<div class="chips"><button data-s="id" class="on">Indonesia</button><button data-s="crypto">Crypto</button></div><div class="lst"></div>';
          b.querySelector('.chips').onclick = e => {
            const x = e.target.closest('button'); if (!x) return;
            FEED.s = x.dataset.s;
            b.querySelectorAll('.chips button').forEach(y => y.classList.toggle('on', y === x));
            find('rss').load(b).catch(() => {});
          };
        }
        const r = await J('/api/admin-airdrop?type=feed&src=' + FEED.s);
        b.querySelector('.lst').innerHTML = r.map(n => `<a class="it" href="${esc(n.link)}" target="_blank" rel="noopener">
          <div class="meta"><b>${esc(n.src)}</b><span>${newsTimeAgo(new Date(n.ts).toISOString())}</span></div><div class="tx">${esc(n.title)}</div></a>`).join('')
          || '<div class="mut">Belum ada berita</div>';
    } },

    { k: 'whale', t: 'Whale Transfers', b: 'klik → tracer', every: 10000, init: el => {
        el.addEventListener('click', async e => {
          const x = e.target.closest('.oc-lv-addr,.oc-lv'); if (!x || e.target.closest('a')) return;
          await openOnchain(); ocLivePick(x.dataset.addr, x.dataset.chain);
        });
      }, load: async b => {
        b.innerHTML = ocLiveFiltered().slice(0, 10).map(ocLiveCard).join('') || '<div class="mut">Menunggu transaksi besar…</div>';
    } },

    { k: 'hours', t: 'Market Hours', b: 'global', every: 30000, load: async b => {
        const EX = [['IDX', 'Asia/Jakarta', 540, 960], ['TSE', 'Asia/Tokyo', 540, 900], ['HKEX', 'Asia/Hong_Kong', 570, 960],
          ['SGX', 'Asia/Singapore', 540, 1020], ['LSE', 'Europe/London', 480, 990], ['NYSE', 'America/New_York', 570, 960]];
        b.innerHTML = EX.map(([n, tz, o, c]) => {
          const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value]));
          const m = (+p.hour % 24) * 60 + +p.minute, open = !/Sat|Sun/.test(p.weekday) && m >= o && m < c;
          return kv(n, `<span class="${open ? 'up' : 'dn'}">${open ? 'OPEN' : 'CLOSED'}</span> <span class="mut">${p.hour}:${p.minute}</span>`);
        }).join('') + '<div class="mut" style="margin-top:6px">jam reguler, belum termasuk libur & istirahat siang</div>';
    } },

    { k: 'weather', t: 'Cuaca Jakarta', b: 'open-meteo', every: 600000, load: async b => {
        const d = await J('https://api.open-meteo.com/v1/forecast?latitude=-6.2&longitude=106.85&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FBangkok');
        const c = d.current, w = c.weather_code;
        const txt = w === 0 ? 'Cerah' : w < 4 ? 'Berawan' : w < 50 ? 'Kabut' : w < 70 ? 'Hujan' : w >= 95 ? 'Badai petir' : 'Hujan deras';
        b.innerHTML = `<div class="big">${Math.round(c.temperature_2m)}°C</div><div class="mut">${txt} · terasa ${Math.round(c.apparent_temperature)}°C</div>`
          + kv('Kelembapan', c.relative_humidity_2m + '%') + kv('Angin', c.wind_speed_10m + ' km/j')
          + kv('Hari ini', `${Math.round(d.daily.temperature_2m_min[0])}° / ${Math.round(d.daily.temperature_2m_max[0])}°`);
    } },

    { k: 'status', t: 'Service Status', b: 'statuspage', every: 120000, load: async b => {
        const S = [['Cloudflare', 'https://www.cloudflarestatus.com'], ['GitHub', 'https://www.githubstatus.com'], ['Discord', 'https://discordstatus.com'],
          ['Vercel', 'https://www.vercel-status.com'], ['Claude', 'https://status.claude.com'], ['npm', 'https://status.npmjs.org']];
        const r = await Promise.allSettled(S.map(([, u]) => J(u + '/api/v2/status.json')));
        b.innerHTML = S.map(([n], i) => {
          if (r[i].status !== 'fulfilled') return kv(n, '?', 'mut');
          const ind = r[i].value.status.indicator;
          return kv(n, ind === 'none' ? 'Operational' : esc(r[i].value.status.description), ind === 'none' ? 'up' : ind === 'minor' ? 'warn' : 'dn');
        }).join('');
    } },
  ];

  /* ───────── mesin card ───────── */
  function newsRender() { const d = find('news'); if (d && d.el) d.load(d.el.querySelector('.body')).catch(() => {}); }

  function mount() {
    const dg = $('#dg'); if (!dg || dg.children.length) return;
    const n = innerWidth > 1400 ? 4 : innerWidth > 1000 ? 3 : innerWidth > 640 ? 2 : 1;
    for (let i = 0; i < n; i++) dg.insertAdjacentHTML('beforeend', '<div class="dgcol"></div>');
    DEFS.forEach((d, i) => {
      const s = document.createElement('section');
      s.className = 'dgc';
      s.innerHTML = `<header><i></i>${d.t}<span class="b">${d.b}</span></header><div class="body">memuat…</div><footer></footer>`;
      dg.children[i % n].appendChild(s);
      d.el = s; d.init && d.init(s);
    });
  }

  async function tick(d) {
    if (!run || document.hidden || !d.el) return;
    const b = d.el.querySelector('.body');
    try { await d.load(b); b.dataset.ok = 1; d.el.querySelector('footer').textContent = 'update ' + wib() + ' WIB'; }
    catch (e) { if (!b.dataset.ok) b.textContent = 'gagal: ' + e.message; }
  }

  function liqWs() {
    if (!run) return;
    const w = new WebSocket('wss://fstream.binance.com/ws/!forceOrder@arr'); LQ.ws = w;
    w.onmessage = e => { try { const o = JSON.parse(e.data).o; LQ.ev.push({ t: Date.now(), s: o.s.replace('USDT', ''), long: o.S === 'SELL', usd: +o.ap * +o.z }); if (LQ.ev.length > 2000) LQ.ev.shift(); } catch {} };
    w.onclose = () => { if (run && LQ.ws === w) setTimeout(liqWs, 3000); };
  }

  function start() {
    if (run) return;
    run = true; mount();
    DEFS.forEach(d => { tick(d); if (d.every) timers.push(setInterval(() => tick(d), d.every)); });
    liqWs(); loadNews(); ocLiveStart();
    timers.push(setInterval(() => { if (!document.hidden) loadNews(); }, 30000));
    timers.push(setInterval(() => { const c = $('#dg-clock'); if (c) c.textContent = wib(); }, 1000));
  }
  function stop() {
    run = false; timers.forEach(clearInterval); timers = [];
    if (LQ.ws) { LQ.ws.onclose = null; LQ.ws.close(); LQ.ws = null; }
    ocLiveStop();
  }

  /* ───────── hook ke fungsi lama ───────── */
  const rn = renderNewsFeed;   renderNewsFeed = function () { rn(); newsRender(); };
  const rl = ocLiveRender;     ocLiveRender = function () { rl(); const d = find('whale'); d && d.el && d.load(d.el.querySelector('.body')); };
  const co = closeOnchain;     closeOnchain = function () { co(); if (run) ocLiveStart(); };
  const s0 = window.xlStart, x0 = window.xlStop;
  window.xlStart = function () { s0 && s0(); start(); };
  window.xlStop = function () { x0 && x0(); stop(); };
  document.addEventListener('visibilitychange', () => { if (run && !document.hidden) DEFS.forEach(tick); });
  mount();
})();
