// ==========================================
// A. CORE CONFIG & INIT
// ==========================================

let allData = [], currentLang = 'id', activeFilter = 'all', currentPage = 1;
const PAGE_SIZE = 10;

// Restore bahasa dari URL path dulu, fallback ke localStorage
(function () {
  const _pathLang = window.location.pathname.replace(/\//g, '');
  if (_pathLang === 'en' || _pathLang === 'id') {
    currentLang = _pathLang;
  } else {
    const saved = localStorage.getItem('axi-lang');
    if (saved === 'en' || saved === 'id') currentLang = saved;
  }
})();

async function init() {
  try {
    const res = await fetch('/api/airdrops'); // ← BENAR
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Data tidak valid');

    allData = data;

    updateDash();
    setLang(currentLang); // render cards + terjemahan sekaligus

    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('airdrop-container').style.display = 'block';

  } catch (e) {
    document.getElementById('loading-state').style.display = 'none';
    const errState = document.getElementById('error-state');
    if (errState) errState.style.display = 'block';
    const errMsg = document.getElementById('error-msg');
    if (errMsg) errMsg.textContent = e.message;
    console.error('init error:', e);
  }
}

// ==========================================
// B. THEME TOGGLE
// ==========================================
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  document.getElementById('themeToggle').textContent = next === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('axi-theme', next);
}

(function () {
  const saved = localStorage.getItem('axi-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = saved === 'dark' ? '☀️' : '🌙';
})();

// ==========================================
// C. VISUAL EFFECTS (CANVAS & CURSOR)
// ==========================================
const cur  = document.getElementById('cursor');
const ring = document.getElementById('cursor-ring');

document.addEventListener('mousemove', e => {
  if (cur)  { cur.style.left  = e.clientX + 'px'; cur.style.top  = e.clientY + 'px'; }
  if (ring) { ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px'; }
});

function bindHoverEffects() {
  document.querySelectorAll('a, button, .acard, .guide-card').forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('hovering'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('hovering'));
  });
}
bindHoverEffects();

document.addEventListener('mousemove', e => {
  document.querySelectorAll('.acard').forEach(card => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', ((e.clientX - r.left) / r.width  * 100) + '%');
    card.style.setProperty('--my', ((e.clientY - r.top)  / r.height * 100) + '%');
  });
});

(function () {
  const c = document.getElementById('bg-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  let W, H, t = 0;
  const CELL = 64;
  function resize() { W = c.width = innerWidth; H = c.height = innerHeight; }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    t += 0.004;
    for (let x = 0; x < W; x += CELL) {
      const b = (Math.sin(t * .4 + x * .02) + 1) / 2;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H);
      ctx.strokeStyle = b > .9 ? `rgba(0,232,122,${.1 + b * .08})` : 'rgba(0,232,122,0.03)';
      ctx.lineWidth = b > .9 ? 1 : .4; ctx.stroke();
    }
    for (let y = 0; y < H; y += CELL) {
      const b = (Math.sin(t * .3 + y * .02) + 1) / 2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y);
      ctx.strokeStyle = b > .9 ? `rgba(0,200,240,${.08 + b * .07})` : 'rgba(0,200,240,0.025)';
      ctx.lineWidth = b > .9 ? 1 : .4; ctx.stroke();
    }
    const sy = ((t * 48) % (H + 60)) - 30;
    const g = ctx.createLinearGradient(0, sy - 30, 0, sy + 30);
    g.addColorStop(0, 'transparent');
    g.addColorStop(.5, 'rgba(0,232,122,0.03)');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.fillRect(0, sy - 30, W, 60);
    requestAnimationFrame(draw);
  }
  window.addEventListener('resize', resize); resize(); draw();
})();

const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
  });
}, { threshold: .1 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ==========================================
// D. LANGUAGE SYSTEM
// ==========================================
const T = {
  id: {
    badge:'🔥 Peluang Langsung',
    title:'Daftar Airdrop Crypto Terbaru & Potensial<br><span>Sebelum Semua Orang</span>',
    sub:'Peluang airdrop yang dikurasi dengan data terstruktur dan pengoptimalan snapshot.',
    btn1:'Explore Airdrops', btn2:'Guide & Tutorial',
    tDash:'DASHBOARD', tTitle:'Airdrop Radar',
    tSub:'Pantau status, total dana, dan tugas dari project-project potensial di ekosistem Web3.',
    raised:'Dana Terkumpul', tasks:'Tugas', cta:'Garap Sekarang', unknown:'Menunggu Info', empty:'Belum ada airdrop nih, bro.',
    totalL:'Total Airdrop', activeL:'Status Aktif', endedL:'Listing / Selesai', fbAll:'Semua',
    gTag:'PEMULA', gTitle:'Guide & Tutorial',
    gSub:'Selamat datang di pusat informasi AirdropXI. Panduan lengkap untuk memaksimalkan cuan dari ekosistem Crypto.',
    gPrepT:'Persiapan Wajib', gPrepD:'Apa yang harus disiapkan sebelum mulai menggarap?',
    gP1:'MetaMask (EVM), Phantom (Solana), Keplr (Cosmos).',
    gP2:'Akun Twitter (X), Discord, dan Telegram yang aktif.',
    gP3:'Mises Browser atau Kiwi Browser (HP) agar bisa pasang Extension.',
    gP4:'Siapkan sedikit ETH/BNB/SOL untuk transaksi on-chain.',
    gRuleT:'Aturan & Status Airdrop', gRuleD:'Keamanan adalah prioritas. Pahami status sebelum eksekusi.',
    gR1:'Selalu gunakan wallet khusus airdrop (bukan utama).',
    gR2:'Admin AirdropXI tidak akan pernah meminta Private Key kamu.',
    gR3:'Lakukan riset mandiri, kelola waktu dan aset dengan bijak.',
    gS1:'Airdrop sudah dikonfirmasi oleh dev.', gS2:'Belum ada info resmi, sangat layak digarap.', gS3:'Periode garap selesai, tinggal tunggu distribusi.',
    aiGreet:'Halo! Saya <strong>AirdropXI Bot</strong> 👋<br><br>Tanya apa aja soal airdrop, Web3, atau crypto. Saya siap bantu! (AI, bisa salah ya 🙏)',
    aiQ1:'🔥 Apa Itu airdrop', aiQ2:'📖 Cara ikut', aiQ3:'🌐 Web3', aiQ4:'🗿 jangan diklik',
    aiP1:'Apa Itu airdrop', aiP2:'Cara ikut airdrop untuk pemula?', aiP3:'Apa itu Web3?', aiP4:'aku ganteng apa jelek?',
    aiPlaceholder:'Tanya tentang airdrop, Web3, crypto...',
    docsLabel:'BARU! Web3 Docs Lengkap →', docsSub:'DeFi · GameFi · Staking · NFT · Airdrop Guide',
    docsCta:'Dokumentasi Lengkap', docsTitle:'Mau Belajar Lebih Dalam?',
    docsDesc:'Web3 · DeFi · GameFi · NFT · Staking · DEX · CEX · Keamanan · Glosarium', docsBtnTxt:'Buka Docs →',
    footerDyor:'⚠️ DYOR — Semua informasi hanya untuk edukasi. Selalu lakukan riset sendiri sebelum berinvestasi.',
    footerDesc:'Peluang airdrop yang dikurasi dengan data terstruktur.',
    footerNav:'Navigate', footerContact:'Social Media', footerCopy:'© 2025 AirdropXI — Stay Safe & Keep Grinding',
    aiLabel:'AI Agent', fcLatestTitle:'DROP TERBARU', fcActiveNow:'Aktif Sekarang',
    fcRaisedTitle:'TOTAL DANA', fcAcross:'Dari semua proyek',
    hsTotalL:'Total Airdrops', hsActiveL:'Aktif Sekarang',
    showMore:'Tampilkan Lebih Banyak',
  },
  en: {
    badge:'🔥 Live Opportunities',
    title:'Latest & Potential Crypto Airdrop List<br><span>Before Everyone Else</span>',
    sub:'Curated airdrop opportunities with structured data and snapshot optimization.',
    btn1:'Explore Airdrops', btn2:'Guide & Tutorial',
    tDash:'DASHBOARD', tTitle:'Airdrop Radar',
    tSub:'Monitor status, total raised, and tasks from potential projects in the Web3 ecosystem.',
    raised:'Total Raised', tasks:'Tasks', cta:'Start Task', unknown:'TBA', empty:'No airdrops listed yet, bro.',
    totalL:'Total Airdrops', activeL:'Active Now', endedL:'Ended', fbAll:'All',
    gTag:'BEGINNER', gTitle:'Guide & Tutorial',
    gSub:'Welcome to the AirdropXI info center. Comprehensive guides to maximize your Crypto gains.',
    gPrepT:'Preparation', gPrepD:'What do you need before starting?',
    gP1:'MetaMask (EVM), Phantom (Solana), Keplr (Cosmos).',
    gP2:'Active Twitter (X), Discord, and Telegram accounts.',
    gP3:'Use Mises or Kiwi Browser (mobile) to install Extensions.',
    gP4:'Prepare a small amount of ETH/BNB/SOL for on-chain gas fees.',
    gRuleT:'Rules & Status', gRuleD:'Security is priority. Understand statuses before executing.',
    gR1:'Always use a dedicated burner wallet for airdrops.',
    gR2:'AirdropXI admins will never ask for your Private Key.',
    gR3:'Do your own research, manage time and assets wisely.',
    gS1:'Confirmed by developers.', gS2:'No official info yet, but highly farmable.', gS3:'Farming period ended, waiting for distribution.',
    aiGreet:'Hello! I\'m <strong>AirdropXI Bot</strong> 👋<br><br>Ask me anything about airdrops, Web3, or crypto. I\'m here to help! (AI, can make mistakes 🙏)',
    aiQ1:'🔥 What is airdrop', aiQ2:'📖 How to join', aiQ3:'🌐 Web3', aiQ4:'🗿 don\'t click',
    aiP1:'What is an airdrop?', aiP2:'How to join an airdrop for beginners?', aiP3:'What is Web3?', aiP4:'am I handsome or ugly?',
    aiPlaceholder:'Ask about airdrops, Web3, crypto...',
    docsLabel:'NEW! Complete Web3 Docs →', docsSub:'DeFi · GameFi · Staking · NFT · Airdrop Guide',
    docsCta:'Full Documentation', docsTitle:'Want to Learn More?',
    docsDesc:'Web3 · DeFi · GameFi · NFT · Staking · DEX · CEX · Security · Glossary', docsBtnTxt:'Open Docs →',
    footerDyor:'⚠️ DYOR — All information is for educational purposes only. Always do your own research.',
    footerDesc:'Curated airdrop opportunities with structured data and snapshot optimization.',
    footerNav:'Navigate', footerContact:'Social Media', footerCopy:'© 2025 AirdropXI — Stay Safe & Keep Grinding',
    aiLabel:'AI Agent', fcLatestTitle:'LATEST DROP', fcActiveNow:'Active Now',
    fcRaisedTitle:'TOTAL RAISED', fcAcross:'Across all projects',
    hsTotalL:'Total Airdrops', hsActiveL:'Active Now',
    showMore:'Show More',
  }
};

function setLang(l) {
  if (l !== 'id' && l !== 'en') l = 'id';
  currentLang = l;
  localStorage.setItem('axi-lang', l);

  // Update URL ke /id atau /en tanpa reload
  const currentPath = window.location.pathname.replace(/\//g, '');
  if (currentPath !== l) {
    window.history.replaceState(null, '', '/' + l);
  }

  ['btn-id','btn-en','m-btn-id','m-btn-en'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const isActive = (id.includes('-id') && l === 'id') || (id.includes('-en') && l === 'en');
    el.className = 'lang-btn' + (isActive ? ' active' : '');
  });

  const t = T[l];

  // Hero
  setEl('h-badge',      t.badge);
  setElHTML('h-title',  t.title);
  setEl('h-sub',        t.sub);
  setEl('h-btn1',       t.btn1);
  setEl('h-btn2',       t.btn2);
  setEl('h-docs-label', t.docsLabel);
  setEl('h-docs-sub',   t.docsSub);

  // Float cards
  setEl('fc-latest-title', t.fcLatestTitle);
  setEl('fc-active-now',   t.fcActiveNow);
  setEl('fc-raised-title', t.fcRaisedTitle);
  setEl('fc-across',       t.fcAcross);

  // Hero stats labels
  setEl('hs-total-l',  t.hsTotalL);
  setEl('hs-active-l', t.hsActiveL);

  // Dashboard
  setEl('t-dash',     t.tDash);
  setEl('t-title',    t.tTitle);
  setEl('t-sub',      t.tSub);
  setEl('lbl-total',  t.totalL);
  setEl('lbl-active', t.activeL);
  setEl('lbl-ended',  t.endedL);
  setEl('fb-all',     t.fbAll);

  // Guide
  setEl('g-tag',        t.gTag);
  setEl('g-title',      t.gTitle);
  setEl('g-sub',        t.gSub);
  setEl('g-prep-title', t.gPrepT);
  setEl('g-prep-desc',  t.gPrepD);
  setEl('g-prep-1',     t.gP1);
  setEl('g-prep-2',     t.gP2);
  setEl('g-prep-3',     t.gP3);
  setEl('g-prep-4',     t.gP4);
  setEl('g-rule-title', t.gRuleT);
  setEl('g-rule-desc',  t.gRuleD);
  setEl('g-rule-1',     t.gR1);
  setEl('g-rule-2',     t.gR2);
  setEl('g-rule-3',     t.gR3);
  setEl('g-st-1',       t.gS1);
  setEl('g-st-2',       t.gS2);
  setEl('g-st-3',       t.gS3);

  // Docs CTA
  setEl('docs-cta-tag',   t.docsCta);
  setEl('docs-cta-title', t.docsTitle);
  setEl('docs-cta-desc',  t.docsDesc);
  setEl('docs-cta-btn',   t.docsBtnTxt);

  // Footer
  setEl('footer-dyor',   t.footerDyor);
  setEl('footer-desc',   t.footerDesc);
  setEl('footer-nav-h',  t.footerNav);
  setEl('footer-comm-h', t.footerContact);
  setEl('footer-copy',   t.footerCopy);
  setEl('f-explore',     t.btn1);
  setEl('f-guide',       t.btn2);

  // AI
  setEl('nav-ai-label', t.aiLabel);
  applyAILang(l);

  renderCards();
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined) el.textContent = val;
}

function setElHTML(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined) el.innerHTML = val;
}

function applyAILang(l) {
  window._lang = l;
  const t = T[l];
  const firstBubble = document.querySelector('#aiMessages .ai-msg-bot .ai-msg-bubble');
  if (firstBubble) firstBubble.innerHTML = t.aiGreet;
  const qbtns = document.querySelectorAll('.ai-qbtn');
  const qKeys = ['aiQ1','aiQ2','aiQ3','aiQ4'];
  const pKeys = ['aiP1','aiP2','aiP3','aiP4'];
  qbtns.forEach((btn, i) => {
    if (qKeys[i]) btn.innerHTML      = t[qKeys[i]];
    if (pKeys[i]) btn.dataset.prompt = t[pKeys[i]];
  });
  const input = document.getElementById('aiInput');
  if (input) input.placeholder = t.aiPlaceholder;
}

// ==========================================
// E. FILTER & RENDER
// ==========================================
function setFilter(el, f) {
  document.querySelectorAll('.fbtn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  activeFilter = f;
  currentPage = 1;
  renderCards();
}

function filterCards() {
  currentPage = 1;
  renderCards();
}

function esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

const LISTED_STATUSES = [
  'listing / selesai',
  'listing/selesai',
  'listed',
  'ended',
  'end',
  'selesai',
];

function isListed(s) {
  const clean = (s || '').trim().toLowerCase();
  return LISTED_STATUSES.some(v => clean === v || clean.includes(v));
}

function isActive(s) {
  const clean = (s || '').trim().toLowerCase();
  if (clean.includes('waitlist')) return false;
  if (isListed(clean))            return false;
  return true;
}

function getStatusClass(s) {
  if (!s) return 'st-default';
  const l = s.toLowerCase();
  if (l.includes('waitlist')) return 'st-waitlist';
  if (isListed(l))            return 'st-listing';
  if (l.includes('mint'))     return 'st-mint';
  return 'st-active';
}

function getStatusLabel(s) {
  if (!s) return 'TBA';
  if (isListed(s.toLowerCase())) return 'Ended';
  return s;
}

function getIcon(tags) {
  if (!tags) return '🪂';
  const t = String(tags).toLowerCase();
  if (t.includes('gaming'))     return '🎮';
  if (t.includes('defi'))       return '💰';
  if (t.includes('nft'))        return '🖼';
  if (t.includes('social'))     return '💬';
  if (t.includes('blockchain')) return '⛓';
  if (t.includes('ai'))         return '🤖';
  return '⚡';
}

function renderCards() {
  const cont = document.getElementById('airdrop-container');
  if (!cont) return;

  const t = T[currentLang];
  const q = (document.getElementById('search-input')?.value || '').toLowerCase().trim();

  const filtered = allData.filter(item => {
    if (q) {
      const name   = (item.name   || '').toLowerCase();
      const tags   = (item.tags   || '').toLowerCase();
      const ticker = (item.ticker || '').toLowerCase();
      if (!name.includes(q) && !tags.includes(q) && !ticker.includes(q)) return false;
    }
    if (activeFilter !== 'all') {
      const s = (item.status || '').toLowerCase().trim();
      if (activeFilter === 'active'   && !isActive(s))            return false;
      if (activeFilter === 'waitlist' && !s.includes('waitlist')) return false;
      if (activeFilter === 'listing'  && !isListed(s))            return false;
    }
    return true;
  });

  if (!filtered.length) {
    cont.innerHTML = `<div style="text-align:center;padding:60px;border:1px dashed var(--border);border-radius:14px;color:var(--text2);font-family:'JetBrains Mono',monospace">${t.empty}</div>`;
    return;
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  if (currentPage > totalPages) currentPage = 1;
  const start   = (currentPage - 1) * PAGE_SIZE;
  const pageData = filtered.slice(start, start + PAGE_SIZE);

  const rows = pageData.map((item, i) => {
    const rowNum = start + i + 1;
    const raised = currentLang === 'id'
      ? (item.RaisedID || item.RaisedEN || t.unknown)
      : (item.RaisedEN || item.RaisedID || t.unknown);

    const stCls   = getStatusClass(item.status);
    const stLabel = getStatusLabel(item.status);
    const guideUrl = `/guide/${currentLang}/${encodeURIComponent(item.id)}`;

    const logoHtml = item.logo_url
      ? `<img src="${esc(item.logo_url)}" class="tbl-logo" alt="${esc(item.name)}" onerror="this.src='';this.style.display='none'">`
      : `<div style="width:28px;height:28px;border-radius:7px;background:rgba(0,229,160,0.08);border:1px solid rgba(0,229,160,0.18);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">${getIcon(item.tags)}</div>`;

    const firstTag = item.tags ? String(item.tags).split(',')[0].trim() : '';

    return `<tr onclick="window.location.href='${guideUrl}'">
      <td class="tbl-num">${rowNum}</td>
      <td>
        <div class="tbl-name-wrap">
          ${logoHtml}
          <div>
            <div class="tbl-name">${esc(item.name) || 'Unknown'}</div>
            ${item.ticker ? `<div class="tbl-ticker">${esc(item.ticker)}</div>` : ''}
          </div>
        </div>
      </td>
      <td>${firstTag ? `<span class="tbl-tag">${esc(firstTag)}</span>` : '—'}</td>
      <td class="tbl-raised">${esc(raised)}</td>
      <td><span class="acard-status ${stCls}" style="font-size:10px;padding:3px 8px">${stLabel}</span></td>
      <td style="text-align:right">
        <a href="${guideUrl}" onclick="event.stopPropagation()" style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#00e5a0;text-decoration:none;border:1px solid rgba(0,229,160,0.25);padding:4px 10px;border-radius:6px;white-space:nowrap">⚡ ${t.cta}</a>
      </td>
    </tr>`;
  }).join('');

  // Pagination buttons
  const maxBtns = 5;
  let pagBtns = '';
  let startP = Math.max(1, currentPage - 2);
  let endP   = Math.min(totalPages, startP + maxBtns - 1);
  if (endP - startP < maxBtns - 1) startP = Math.max(1, endP - maxBtns + 1);
  for (let p = startP; p <= endP; p++) {
    pagBtns += `<button class="pag-btn${p===currentPage?' active':''}" onclick="goPage(${p})">${p}</button>`;
  }

  cont.innerHTML = `
    <div class="airdrop-table-wrap">
      <table class="airdrop-table">
        <thead>
          <tr>
            <th class="tbl-num">#</th>
            <th>Project</th>
            <th>Category</th>
            <th>${t.raised}</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="airdrop-pagination">
      <span class="pag-info">${start+1}–${Math.min(start+PAGE_SIZE, filtered.length)} of ${filtered.length} projects</span>
      <div class="pag-btns">
        <button class="pag-btn" onclick="goPage(currentPage-1)" ${currentPage===1?'disabled':''}>← Prev</button>
        ${pagBtns}
        <button class="pag-btn" onclick="goPage(currentPage+1)" ${currentPage===totalPages?'disabled':''}>Next →</button>
      </div>
    </div>`;

  bindHoverEffects();
}

function goPage(p) {
  const q = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
  const filtered = allData.filter(item => {
    if (q) {
      const name   = (item.name   || '').toLowerCase();
      const tags   = (item.tags   || '').toLowerCase();
      const ticker = (item.ticker || '').toLowerCase();
      if (!name.includes(q) && !tags.includes(q) && !ticker.includes(q)) return false;
    }
    if (activeFilter !== 'all') {
      const s = (item.status || '').toLowerCase().trim();
      if (activeFilter === 'active'   && !isActive(s))            return false;
      if (activeFilter === 'waitlist' && !s.includes('waitlist')) return false;
      if (activeFilter === 'listing'  && !isListed(s))            return false;
    }
    return true;
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  if (p < 1 || p > totalPages) return;
  currentPage = p;
  renderCards();
  document.getElementById('airdrops')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function animateNum(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let current = 0;
  const step = Math.max(1, Math.ceil(target / 30));
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(timer);
  }, 40);
}

function setElText(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined) el.textContent = val;
}

// ==========================================
// F. DASHBOARD CHART
// ==========================================
let _radarChart = null;

function updateDash() {
  let active = 0, listing = 0, waitlist = 0;
  allData.forEach(item => {
    const s = (item.status || '').toLowerCase().trim();
    if (isListed(s))                 listing++;
    else if (s.includes('waitlist')) waitlist++;
    else                             active++;
  });

  // update legend values
  const elA = document.getElementById('legend-active-val');
  const elW = document.getElementById('legend-waitlist-val');
  const elL = document.getElementById('legend-listing-val');
  if (elA) elA.textContent = active;
  if (elW) elW.textContent = waitlist;
  if (elL) elL.textContent = listing;

  // hero stats
  animateNum('hs-total',  allData.length);
  animateNum('hs-active', active);
  setElText('fc-raised', `${allData.length} Projects`);
  if (allData[0]) setElText('fc-latest', allData[0].name || '—');

  // build time-series: snapshot setiap N detik → simpan ke history
  if (!window._chartHistory) {
    window._chartHistory = [];
  }
  const now = new Date();
  const label = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0') + ':' + now.getSeconds().toString().padStart(2,'0');
  window._chartHistory.push({ label, active, waitlist, listing });
  if (window._chartHistory.length > 20) window._chartHistory.shift();

  const hist = window._chartHistory;
  const labels   = hist.map(h => h.label);
  const dActive  = hist.map(h => h.active);
  const dWait    = hist.map(h => h.waitlist);
  const dListing = hist.map(h => h.listing);

  const canvas = document.getElementById('radar-chart');
  if (!canvas) return;

  if (!_radarChart) {
    // load Chart.js dulu
    if (!window.Chart) {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
      s.onload = () => buildChart(canvas, labels, dActive, dWait, dListing);
      document.head.appendChild(s);
    } else {
      buildChart(canvas, labels, dActive, dWait, dListing);
    }
  } else {
    _radarChart.data.labels = labels;
    _radarChart.data.datasets[0].data = dActive;
    _radarChart.data.datasets[1].data = dWait;
    _radarChart.data.datasets[2].data = dListing;
    _radarChart.update('none');
    const el = document.getElementById('chart-refresh-label');
    if (el) el.textContent = '⟳ ' + label;
  }
}

function buildChart(canvas, labels, dActive, dWait, dListing) {
  _radarChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Active',
          data: dActive,
          borderColor: '#00e5a0',
          backgroundColor: 'rgba(0,229,160,0.08)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#00e5a0',
          tension: 0.4,
          fill: true,
        },
        {
          label: 'Waitlist',
          data: dWait,
          borderColor: '#f0b429',
          backgroundColor: 'rgba(240,180,41,0.06)',
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 3,
          pointBackgroundColor: '#f0b429',
          tension: 0.4,
          fill: false,
        },
        {
          label: 'Listed',
          data: dListing,
          borderColor: '#7c6dfa',
          backgroundColor: 'rgba(124,109,250,0.07)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#7c6dfa',
          tension: 0.4,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0c1822',
          borderColor: 'rgba(0,229,160,0.3)',
          borderWidth: 1,
          titleColor: '#00e5a0',
          bodyColor: '#8899aa',
          titleFont: { family: 'JetBrains Mono', size: 11 },
          bodyFont:  { family: 'JetBrains Mono', size: 11 },
        },
      },
      scales: {
        x: {
          ticks: { color: '#4a6070', font: { family: 'JetBrains Mono', size: 10 }, maxRotation: 0 },
          grid:  { color: 'rgba(255,255,255,0.04)' },
          border: { color: 'rgba(0,229,160,0.1)' },
        },
        y: {
          ticks: { color: '#4a6070', font: { family: 'JetBrains Mono', size: 10 }, stepSize: 1, precision: 0 },
          grid:  { color: 'rgba(255,255,255,0.04)' },
          border: { color: 'rgba(0,229,160,0.1)' },
          beginAtZero: true,
        },
      },
    },
  });
}

// ==========================================
// G. TICKERS
// ==========================================
async function loadNews() {
  try {
    const client = window.supabase.createClient(
      'https://hmjjujirktpqviayfehe.supabase.co',
      'sb_publishable_Q0wdrJl_H0VIV-XpE8eiVQ_ziLgpMVx'
    );
    const { data, error } = await client
      .from('ticker_news')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const el = document.getElementById('news-ticker');
    if (!el) return;
    if (!data || !data.length) {
      el.innerHTML = '<span class="ni"><span class="ni-dot">◆</span>Belum ada berita terbaru.</span>';
      return;
    }
    const all = [...data, ...data];
    el.innerHTML = all.map(b =>
      `<span class="ni"><span class="ni-dot">◆</span><span class="ni-tag tag-${esc(b.tag)}">${esc(b.tag).toUpperCase()}</span>${esc(b.text)}</span>`
    ).join('');
    const dur = Math.max(25, Math.round(el.scrollWidth / 90));
    el.style.animationDuration = dur + 's';
  } catch(e) { console.warn('News ticker:', e.message); }
}
loadNews(); setInterval(loadNews, 60000);

async function loadPrices() {
  const el = document.getElementById('price-ticker');
  if (!el) return;
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,sui,binancecoin,hyperliquid&order=market_cap_desc&sparkline=false');
    if (!r.ok) throw new Error('rate limit');
    const data = await r.json();
    let html = '';
    data.forEach(c => {
      const price = new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD',
        maximumFractionDigits: c.current_price > 1 ? 2 : 6
      }).format(c.current_price);
      const ch   = c.price_change_percentage_24h ? c.price_change_percentage_24h.toFixed(2) : 0;
      const cls  = ch >= 0 ? 'ptick-up' : 'ptick-dn';
      const sign = ch >= 0 ? '+' : '';
      html += `<div class="ptick"><img src="${c.image}" alt="${c.symbol}" onerror="this.style.display='none'"><span class="ptick-sym">${c.symbol}</span><span class="ptick-price">${price}</span><span class="${cls}">${sign}${ch}%</span></div>`;
    });
    if (window.innerWidth >= 768) {
  el.innerHTML = html;
  el.style.animation = 'none';
  el.style.display = 'flex';
  el.style.flexWrap = 'wrap';
  el.style.justifyContent = 'center';
  el.style.gap = '8px';
  el.style.padding = '4px 12px';
  el.style.transform = 'none';
} else {
    el.innerHTML = html + html;
  }
  } catch(e) {
    el.innerHTML = '<span style="padding:0 20px;font-family:\'JetBrains Mono\',monospace;font-size:11px;color:#ff2d55">Reconnecting to market data...</span>';
  }
}
loadPrices(); setInterval(loadPrices, 300000);

// ==========================================
// H. AI AGENT CHATBOT
// ==========================================
(function () {
  let aiOpen = false, aiLoading = false;
  const aiHistory = [];

  window.toggleAI = function () {
    aiOpen = !aiOpen;
    document.getElementById('aiPanel').classList.toggle('open', aiOpen);
  };

  window.aiHandleKey = function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aiSend(); }
  };

  window.aiAutoResize = function (el) {
    el.style.height = '36px';
    el.style.height = Math.min(el.scrollHeight, 88) + 'px';
  };

  window.aiSendQuick = function (text) {
    document.getElementById('aiInput').value = text;
    aiSend();
  };

  function aiAddMsg(role, html) {
    const box = document.getElementById('aiMessages');
    const d   = document.createElement('div');
    d.className = 'ai-msg ' + (role === 'user' ? 'ai-msg-user' : 'ai-msg-bot');
    d.innerHTML = `<div class="ai-msg-avatar">${role === 'user'
      ? '👤'
      : '<img src="logo.png" style="width:20px;height:20px;object-fit:contain;border-radius:4px;">'
    }</div><div class="ai-msg-bubble">${html}</div>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
  }

  function aiShowTyping() {
    const box = document.getElementById('aiMessages');
    const d   = document.createElement('div');
    d.className = 'ai-msg ai-msg-bot'; d.id = 'aiTyping';
    d.innerHTML = `<div class="ai-msg-avatar"><img src="logo.png" style="width:20px;height:20px;object-fit:contain;border-radius:4px;"></div><div class="ai-msg-bubble"><div class="ai-typing"><div class="ai-tdot"></div><div class="ai-tdot"></div><div class="ai-tdot"></div></div></div>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
  }

  function aiRemoveTyping() {
    const t = document.getElementById('aiTyping');
    if (t) t.remove();
  }

  function detectLang(text) {
    const idWords = /\b(apa|itu|cara|untuk|dan|yang|ini|ada|bisa|saya|kamu|bagaimana|kenapa|mengapa|gimana|gak|tidak|ya|iya|dong|nih|loh|sih|juga|atau|dari|dengan|di|ke|mau|harus|perlu|buat|bikin|pakai|kalau|kapan|siapa)\b/i;
    return idWords.test(text) ? 'id' : 'en';
  }

  function getSystemPrompt(lang) {
    if (lang === 'id') {
      return `Kamu adalah AirdropXI Bot, asisten AI resmi dari AirdropXI — platform tracker airdrop crypto terpercaya di Indonesia.
Kepribadian: Friendly, santai, informatif, antusias soal crypto & Web3. Bahasa Indonesia natural dan mudah dipahami. Selalu ingatkan soal keamanan & scam.
Keahlian: Airdrop crypto, Web3, DeFi, NFT, GameFi, blockchain, keamanan crypto, wallet, gas fee, DEX, CEX, tokenomics.
PENTING: Jawab dalam Bahasa Indonesia. Ingatkan user hanya gunakan link resmi AirdropXI dan jangan share private key / seed phrase.`;
    }
    return `You are AirdropXI Bot, the official AI assistant from AirdropXI — a trusted crypto airdrop tracker platform.
Personality: Friendly, informative, enthusiastic about crypto & Web3. Clear natural English. Always remind users about security and scams.
Expertise: Crypto airdrops, Web3, DeFi, NFT, GameFi, blockchain, crypto security, wallets, gas fees, DEX, CEX, tokenomics.
IMPORTANT: Respond in English. Remind users to only use official AirdropXI links and never share their private key or seed phrase.`;
  }

  window.aiSend = async function () {
    if (aiLoading) return;
    const input = document.getElementById('aiInput');
    const text  = input.value.trim();
    if (!text) return;
    input.value = ''; input.style.height = '36px';
    aiAddMsg('user', text.replace(/</g,'&lt;').replace(/>/g,'&gt;'));
    const msgLang = detectLang(text);
    aiHistory.push({ role: 'user', content: text });
    aiLoading = true;
    document.getElementById('aiSendBtn').disabled = true;
    aiShowTyping();
    try {
      const res  = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          lang: msgLang,
          system: getSystemPrompt(msgLang),
          history: aiHistory.slice(-10),
        }),
      });
      const data = await res.json();
      aiRemoveTyping();
      if (data.choices && data.choices[0]) {
        const reply = data.choices[0].message.content;
        aiHistory.push({ role: 'assistant', content: reply });
        aiAddMsg('bot', reply
          .replace(/\n/g,'<br>')
          .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>'));
      } else {
        aiAddMsg('bot', msgLang === 'id' ? 'AI tidak merespon, coba lagi ya 🙏' : 'AI did not respond, please try again 🙏');
      }
    } catch(e) {
      aiRemoveTyping();
      aiAddMsg('bot', 'Koneksi error, coba lagi 🔌');
    }
    aiLoading = false;
    document.getElementById('aiSendBtn').disabled = false;
  };
})();

// ==========================================
// I. TOKEN UNLOCKS
// ==========================================
async function loadTokenUnlocks() {
  const tableBody = document.getElementById('unlock-table-body');
  if (!tableBody) return;
  try {
    const response = await fetch('/api/unlocks');
    const data = await response.json();
    tableBody.innerHTML = `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
        <td style="padding:15px">${data.name || 'Ethereum'}</td>
        <td style="padding:15px;color:#10b981">${data.unlocked || 'Loading...'}</td>
        <td style="padding:15px">Real-time Data</td>
      </tr>`;
  } catch (err) {
    console.error('Gagal render token unlocks:', err);
  }
}

if (window.location.pathname.includes('unlocks.html')) {
  loadTokenUnlocks();
}

// ==========================================
// INIT
// ==========================================
// INIT
init();
setInterval(() => { if (allData.length) updateDash(); }, 30000);
