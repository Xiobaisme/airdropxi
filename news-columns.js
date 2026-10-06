/* news-columns.js — pasang SETELAH </script> inline terakhir di index.html.
   Cuma mengganti cara render News Terminal; fitur lain tidak disentuh. */
(function () {
  // kolom tambahan (sumber RSS publik, datang dari endpoint ?type=feed)
  Object.assign(NEWS_SOURCES, {
    antara:   { label: 'Antara',         color: '#ef4444' },
    cnbcid:   { label: 'CNBC Indonesia', color: '#38bdf8' },
    detik:    { label: 'Detik Finance',  color: '#22c55e' },
    kontan:   { label: 'Kontan',         color: '#f59e0b' },
    coindesk: { label: 'CoinDesk',       color: '#60a5fa' },
    decrypt:  { label: 'Decrypt',        color: '#a78bfa' },
    theblock: { label: 'The Block',      color: '#fb7185' },
  });

  let rssItems = [];
  const drawerOpen = () => document.getElementById('news-drawer')?.classList.contains('open');

  async function loadRss() {
    try {
      const got = await Promise.all(['id', 'crypto'].map(s =>
        fetch('/api/admin-airdrop?type=feed&src=' + s).then(r => (r.ok ? r.json() : [])).catch(() => [])));
      const old = new Map(rssItems.map(n => [n.id, n.status]));
      rssItems = got.filter(Array.isArray).flat().filter(n => NEWS_SOURCES[n.src]).map(n => ({
        id: 'rss:' + n.link, source: n.src, title: n.title, url: n.link,
        published_at: new Date(n.ts).toISOString(), status: old.get('rss:' + n.link) || 'pending',
      }));
      renderNewsFeed();
    } catch {}
  }

  function card(n) {
    const sent = n.status === 'sent', open = newsOpen.has(n.id);
    return `<div class="nt-card${open ? ' open' : ''}">
      <div class="nt-head"><span class="nt-time"><b>${ntClock(n.published_at)}</b>${newsTimeAgo(n.published_at)}</span></div>
      <div class="nt-text">${ntLinkify(n.title)}</div>
      <button class="nt-more" type="button" data-more="${esc(n.id)}">${open ? 'Tutup ▲' : 'Lihat semua ▼'}</button>
      <div class="nt-foot">
        <button class="btn-save" data-send="${esc(n.id)}" ${sent ? 'disabled' : ''}>${sent ? 'Terkirim ✓' : icon('send') + 'Kirim'}</button>
        ${n.url ? `<a href="${esc(n.url)}" target="_blank" rel="noopener">buka post ↗</a>` : ''}
      </div></div>`;
  }

  // menggantikan renderNewsFeed lama: 1 kolom per sumber
  renderNewsFeed = function () {
    const feed = document.getElementById('news-feed');
    if (!feed) return;
    const seen = new Set();
    const all = [...newsItems, ...rssItems].filter(n => !seen.has(n.id) && seen.add(n.id));
    const cnt = document.getElementById('news-count'); if (cnt) cnt.textContent = all.length;

    // simpan posisi scroll supaya auto-refresh tidak melempar kamu ke atas
    const left = feed.scrollLeft, pos = {};
    feed.querySelectorAll('.nt-col').forEach(c => { pos[c.dataset.src] = c.querySelector('.nt-col-list').scrollTop; });

    const by = {};
    all.forEach(n => (by[n.source] = by[n.source] || []).push(n));
    const keys = Object.keys(NEWS_SOURCES).filter(k => by[k]);
    if (!keys.length) { feed.innerHTML = `<div class="empty-state">${icon('ghost')}Belum ada berita.</div>`; return; }

    feed.innerHTML = keys.map(k => {
      const src = NEWS_SOURCES[k];
      const list = by[k].sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
      return `<section class="nt-col" data-src="${k}" style="--src-color:${src.color}">
        <div class="nt-col-head"><span class="nt-src">${esc(src.label)}</span><span class="n">${list.length}</span></div>
        <div class="nt-col-list">${list.slice(0, 40).map(card).join('')}</div></section>`;
    }).join('');

    feed.querySelectorAll('.nt-card').forEach(c => {
      const t = c.querySelector('.nt-text');
      if (c.classList.contains('open') || t.scrollHeight > t.clientHeight + 4) c.classList.add('has-more');
    });
    feed.scrollLeft = left;
    feed.querySelectorAll('.nt-col').forEach(c => { c.querySelector('.nt-col-list').scrollTop = pos[c.dataset.src] || 0; });
  };

  // tombol Kirim untuk item RSS: daftarkan dulu ke newsItems supaya openNewsSend lama bisa menemukannya
  const ons = openNewsSend;
  openNewsSend = function (id) {
    const it = rssItems.find(n => String(n.id) === String(id));
    if (it && !newsItems.includes(it)) newsItems.push(it);
    ons(id);
  };

  // muat RSS tiap panel dibuka, lalu tiap 5 menit selama panel terbuka
  const tg = toggleNewsPanel;
  toggleNewsPanel = function () { tg(); if (drawerOpen()) loadRss(); };
  setInterval(() => { if (drawerOpen() && !document.hidden) loadRss(); }, 5 * 60e3);
})();
