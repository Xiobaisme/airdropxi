// ==========================================
// A. CORE CONFIG & INIT
// ==========================================
const SB_URL = 'https://hmjjujirktpqviayfehe.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtamp1amlya3RwcXZpYXlmZWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1ODE1NzQsImV4cCI6MjA4OTE1NzU3NH0.nmCK3b66fU8Zh-mwQw5YUS_I3dFJAYnvfWlO050doSY';
let sb, allData = [], currentLang = 'id', activeFilter = 'all';

async function init() {
  try {
    if (!window.supabase) throw new Error('Supabase failed to load');
    sb = window.supabase.createClient(SB_URL, SB_KEY);
    const { data, error } = await sb.from('airdrops').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    allData = data || [];
    updateDash();
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('airdrop-container').style.display = 'grid';
    setLang(currentLang);
  } catch (e) {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('error-state').style.display = 'block';
    document.getElementById('error-msg').textContent = e.message;
  }
}

// ==========================================
// B. THEME TOGGLE (DARK / LIGHT)
// ==========================================
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('themeToggle').textContent = isDark ? '🌙' : '☀️';
  // Persist
  localStorage.setItem('axi-theme', isDark ? 'light' : 'dark');
}

// Load saved theme
(function () {
  const saved = localStorage.getItem('axi-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = saved === 'dark' ? '☀️' : '🌙';
})();

// ==========================================
// C. VISUAL EFFECTS (CANVAS & CURSOR)
// ==========================================
const cur = document.getElementById('cursor');
const ring = document.getElementById('cursor-ring');

document.addEventListener('mousemove', e => {
  cur.style.left = e.clientX + 'px';
  cur.style.top  = e.clientY + 'px';
  ring.style.left = e.clientX + 'px';
  ring.style.top  = e.clientY + 'px';
});

function bindHoverEffects() {
  document.querySelectorAll('a, button, .acard, .guide-card').forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('hovering'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('hovering'));
  });
}
bindHoverEffects();

// Acard mouse gradient
document.addEventListener('mousemove', e => {
  document.querySelectorAll('.acard').forEach(card => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
    card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
  });
});

// Background canvas
(function () {
  const c = document.getElementById('bg-canvas'), ctx = c.getContext('2d');
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

// Scroll reveal
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
}, { threshold: .1 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ==========================================
// D. LANGUAGE SYSTEM
// ==========================================
const T = {
  id: {
    badge:'🔥 20+ Airdrop Aktif Sekarang',
    title:'Find Legit Airdrops<br><span>Sebelum Semua Orang</span>',
    sub:'Auto-filtered, verified, dan siap snapshot. Jangan sampai ketinggalan reward dari project Web3 terbaik.',
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
    aiPlaceholder:'Tanya tentang airdrop, Web3, crypto...'
  },
  en: {
    badge:'🔥 20+ Active Airdrops Right Now',
    title:'Find Legit Airdrops<br><span>Before Everyone Else</span>',
    sub:'Auto-filtered, verified, and snapshot-ready. Never miss rewards from the best Web3 projects.',
    btn1:'Explore Airdrops', btn2:'Guide & Tutorial',
    tDash:'DASHBOARD', tTitle:'Airdrop Radar',
    tSub:'Monitor status, total raised, and tasks from potential projects in the Web3 ecosystem.',
    raised:'Total Raised', tasks:'Tasks', cta:'Start Task', unknown:'TBA', empty:'No airdrops listed yet, bro.',
    totalL:'Total Airdrops', activeL:'Active Now', endedL:'Listed / Ended', fbAll:'All',
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
    aiPlaceholder:'Ask about airdrops, Web3, crypto...'
  }
};

function setLang(l) {
  currentLang = l;
  document.getElementById('btn-id').className = 'lang-btn' + (l === 'id' ? ' active' : '');
  document.getElementById('btn-en').className = 'lang-btn' + (l === 'en' ? ' active' : '');
  const t = T[l];
  document.getElementById('h-badge').textContent    = t.badge;
  document.getElementById('h-title').innerHTML      = t.title;
  document.getElementById('h-sub').textContent      = t.sub;
  document.getElementById('h-btn1').textContent     = t.btn1;
  document.getElementById('h-btn2').textContent     = t.btn2;
  document.getElementById('t-dash').textContent     = t.tDash;
  document.getElementById('t-title').textContent    = t.tTitle;
  document.getElementById('t-sub').textContent      = t.tSub;
  document.getElementById('lbl-total').textContent  = t.totalL;
  document.getElementById('lbl-active').textContent = t.activeL;
  document.getElementById('lbl-ended').textContent  = t.endedL;
  document.getElementById('fb-all').textContent     = t.fbAll;
  document.getElementById('g-tag').textContent      = t.gTag;
  document.getElementById('g-title').textContent    = t.gTitle;
  document.getElementById('g-sub').textContent      = t.gSub;
  document.getElementById('g-prep-title').textContent = t.gPrepT;
  document.getElementById('g-prep-desc').textContent  = t.gPrepD;
  document.getElementById('g-prep-1').textContent = t.gP1;
  document.getElementById('g-prep-2').textContent = t.gP2;
  document.getElementById('g-prep-3').textContent = t.gP3;
  document.getElementById('g-prep-4').textContent = t.gP4;
  document.getElementById('g-rule-title').textContent = t.gRuleT;
  document.getElementById('g-rule-desc').textContent  = t.gRuleD;
  document.getElementById('g-rule-1').textContent = t.gR1;
  document.getElementById('g-rule-2').textContent = t.gR2;
  document.getElementById('g-rule-3').textContent = t.gR3;
  document.getElementById('g-st-1').textContent   = t.gS1;
  document.getElementById('g-st-2').textContent   = t.gS2;
  document.getElementById('g-st-3').textContent   = t.gS3;
  applyAILang(l);
  renderCards();
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
    if (qKeys[i]) btn.innerHTML = t[qKeys[i]];
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
  filterCards();
}

function filterCards() {
  const q = document.getElementById('search-input').value.toLowerCase();
  document.querySelectorAll('.acard').forEach(card => {
    const name   = (card.dataset.name   || '').toLowerCase();
    const status = (card.dataset.status || '').toLowerCase();
    const matchQ = !q || name.includes(q);
    let matchF = true;
    if (activeFilter === 'active')  matchF = status.includes('active');
    if (activeFilter === 'listing') matchF = status.includes('listing') || status.includes('end') || status.includes('selesai');
    card.style.display = (matchQ && matchF) ? '' : 'none';
  });
}

function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function getStatusClass(s) {
  if (!s) return 'st-default';
  const l = s.toLowerCase();
  if (l.includes('active'))  return 'st-active';
  if (l.includes('waitlist'))return 'st-waitlist';
  if (l.includes('mint'))    return 'st-mint';
  if (l.includes('listing') || l.includes('end') || l.includes('selesai')) return 'st-listing';
  return 'st-default';
}

function renderCards() {
  const cont = document.getElementById('airdrop-container');
  const t = T[currentLang];
  cont.innerHTML = '';
  if (!allData.length) {
    cont.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;border:1px dashed var(--border);border-radius:var(--radius);color:var(--text2);font-family:'JetBrains Mono',monospace">${t.empty}</div>`;
    return;
  }
  const first = allData[0];
  if (first) {
    document.getElementById('fc-latest').textContent = first.name || '—';
    document.getElementById('fc-raised').textContent = first.RaisedEN || first.RaisedID || 'N/A';
  }
  allData.forEach((item, i) => {
    const raised = currentLang === 'id' ? (item.RaisedID || t.unknown) : (item.RaisedEN || t.unknown);
    const tasks  = currentLang === 'id' ? (item.tasksID  || t.unknown) : (item.tasksEN  || t.unknown);
    const stCls  = getStatusClass(item.status);
    let tagsHTML = '';
    if (item.tags) try { tagsHTML = String(item.tags).split(',').map(x => `<span class="atag">${x.trim()}</span>`).join(''); } catch(e) {}
    const prog = 20 + Math.floor(Math.random() * 75);
    cont.insertAdjacentHTML('beforeend', `
      <div class="acard reveal" data-name="${esc(item.name)}" data-status="${esc(item.status)}" style="animation-delay:${i * .05}s">
        <div class="acard-top">
          <div>
            <div class="acard-name">${esc(item.name) || 'Unknown'}</div>
            <div class="acard-tags" style="margin-top:7px">${tagsHTML}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:7px">
            <div class="acard-icon">${getIcon(item.tags)}</div>
            <span class="acard-status ${stCls}">${esc(item.status) || 'TBA'}</span>
          </div>
        </div>
        <div class="acard-raised">
          <div class="raised-ico">$</div>
          <div><div class="raised-lbl">${t.raised}</div><div class="raised-val">${esc(raised)}</div></div>
        </div>
        <div class="prog-wrap">
          <div class="prog-meta"><span>${t.tasks}</span><span>${prog}%</span></div>
          <div class="prog-bar"><div class="prog-fill" style="width:${prog}%"></div></div>
        </div>
        <div class="acard-tasks">
          <div class="tasks-lbl">${t.tasks}</div>
          <div class="tasks-body">${esc(tasks)}</div>
        </div>
        <a href="${esc(item.link || '#')}" target="_blank" rel="noopener noreferrer" class="acard-btn">⚡ ${t.cta}</a>
      </div>`);
  });
  document.querySelectorAll('.acard.reveal').forEach(el => observer.observe(el));
  bindHoverEffects();
}

function getIcon(tags) {
  if (!tags) return '🪂';
  const t = String(tags).toLowerCase();
  if (t.includes('gaming'))    return '🎮';
  if (t.includes('defi'))      return '💰';
  if (t.includes('nft'))       return '🖼';
  if (t.includes('social'))    return '💬';
  if (t.includes('blockchain'))return '⛓';
  if (t.includes('ai'))        return '🤖';
  return '⚡';
}

function updateDash() {
  let active = 0, listing = 0;
  allData.forEach(i => {
    const s = (i.status || '').toLowerCase();
    if (s.includes('listing') || s.includes('end') || s.includes('selesai')) listing++;
    else active++;
  });
  animateNum('dash-total',   allData.length);
  animateNum('dash-active',  active);
  animateNum('dash-listing', listing);
  animateNum('hs-total',     allData.length);
  animateNum('hs-active',    active);
}

function animateNum(id, target) {
  const el = document.getElementById(id);
  let cur = 0, step = Math.ceil(target / 30);
  const timer = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = cur;
    if (cur >= target) clearInterval(timer);
  }, 40);
}

// ==========================================
// F. TICKERS
// ==========================================
async function loadNews() {
  try {
    const client = window.supabase.createClient(SB_URL, SB_KEY);
    const { data, error } = await client.from('ticker_news').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    const el = document.getElementById('news-ticker');
    if (!data || !data.length) { el.innerHTML = '<span class="ni"><span class="ni-dot">◆</span>Belum ada berita terbaru.</span>'; return; }
    const all = [...data, ...data];
    el.innerHTML = all.map(b => `<span class="ni"><span class="ni-dot">◆</span><span class="ni-tag tag-${esc(b.tag)}">${esc(b.tag).toUpperCase()}</span>${esc(b.text)}</span>`).join('');
    const dur = Math.max(25, Math.round(el.scrollWidth / 90));
    el.style.animationDuration = dur + 's';
  } catch(e) { console.warn('News:', e.message); }
}
loadNews(); setInterval(loadNews, 60000);

async function loadPrices() {
  const el = document.getElementById('price-ticker');
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false');
    if (!r.ok) throw new Error('rate limit');
    const data = await r.json();
    let html = '';
    data.forEach(c => {
      const price = new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits: c.current_price > 1 ? 2 : 6 }).format(c.current_price);
      const ch  = c.price_change_percentage_24h ? c.price_change_percentage_24h.toFixed(2) : 0;
      const cls = ch >= 0 ? 'ptick-up' : 'ptick-dn';
      const sign = ch >= 0 ? '+' : '';
      html += `<div class="ptick"><img src="${c.image}" alt="${c.symbol}" onerror="this.style.display='none'"><span class="ptick-sym">${c.symbol}</span><span class="ptick-price">${price}</span><span class="${cls}">${sign}${ch}%</span></div>`;
    });
    el.innerHTML = html + html;
  } catch(e) {
    el.innerHTML = '<span style="padding:0 20px;font-family:\'JetBrains Mono\',monospace;font-size:11px;color:#ff2d55">Reconnecting to market data...</span>';
  }
}
loadPrices(); setInterval(loadPrices, 300000);

init();

// ==========================================
// G. AI AGENT CHATBOT
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
    const d = document.createElement('div');
    d.className = 'ai-msg ' + (role === 'user' ? 'ai-msg-user' : 'ai-msg-bot');
    d.innerHTML = `<div class="ai-msg-avatar">${role === 'user' ? '👤' : '<img src="logo.png" style="width:20px;height:20px;object-fit:contain;border-radius:4px;">'}</div><div class="ai-msg-bubble">${html}</div>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
  }

  function aiShowTyping() {
    const box = document.getElementById('aiMessages');
    const d = document.createElement('div');
    d.className = 'ai-msg ai-msg-bot'; d.id = 'aiTyping';
    d.innerHTML = `<div class="ai-msg-avatar"><img src="logo.png" style="width:20px;height:20px;object-fit:contain;border-radius:4px;"></div><div class="ai-msg-bubble"><div class="ai-typing"><div class="ai-tdot"></div><div class="ai-tdot"></div><div class="ai-tdot"></div></div></div>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
  }

  function aiRemoveTyping() {
    const t = document.getElementById('aiTyping');
    if (t) t.remove();
  }

  // Deteksi bahasa dari teks user (sederhana tapi efektif)
  function detectLang(text) {
    // Kata-kata umum Bahasa Indonesia
    const idWords = /\b(apa|itu|cara|untuk|dan|yang|ini|ada|bisa|saya|kamu|bagaimana|kenapa|mengapa|gimana|gak|tidak|ya|iya|dong|nih|loh|sih|juga|atau|dari|dengan|di|ke|nya|nya|mau|harus|perlu|buat|bikin|pakai|kalau|kapan|siapa)\b/i;
    return idWords.test(text) ? 'id' : 'en';
  }

  function getSystemPrompt(lang) {
    if (lang === 'id') {
      return `Kamu adalah AirdropXI Bot, asisten AI resmi dari AirdropXI — platform tracker airdrop crypto terpercaya di Indonesia.

Kepribadian: Friendly, santai, informatif, antusias soal crypto & Web3. Gunakan Bahasa Indonesia yang natural dan mudah dipahami. Selalu ingatkan soal keamanan & scam.

Keahlian: Airdrop crypto, Web3, DeFi, NFT, GameFi, blockchain, keamanan crypto, wallet, gas fee, DEX, CEX, tokenomics.

PENTING: Selalu jawab dalam Bahasa Indonesia. Ingatkan user untuk hanya gunakan link resmi AirdropXI dan jangan share private key / seed phrase.`;
    } else {
      return `You are AirdropXI Bot, the official AI assistant from AirdropXI — a trusted crypto airdrop tracker platform.

Personality: Friendly, informative, enthusiastic about crypto & Web3. Use clear, natural English. Always remind users about security and scams.

Expertise: Crypto airdrops, Web3, DeFi, NFT, GameFi, blockchain, crypto security, wallets, gas fees, DEX, CEX, tokenomics.

IMPORTANT: Always respond in English. Remind users to only use official AirdropXI links and never share their private key or seed phrase.`;
    }
  }

  window.aiSend = async function () {
    if (aiLoading) return;
    const input = document.getElementById('aiInput');
    const text  = input.value.trim();
    if (!text) return;
    input.value = ''; input.style.height = '36px';
    aiAddMsg('user', text.replace(/</g,'&lt;').replace(/>/g,'&gt;'));

    // Deteksi bahasa dari pesan user — prioritaskan bahasa yang diketik user
    const msgLang = detectLang(text);

    aiHistory.push({ role:'user', content:text });
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
          history: aiHistory.slice(-10) // kirim history biar kontekstual
        })
      });
      const data = await res.json();
      aiRemoveTyping();
      if (data.choices && data.choices[0]) {
        const reply = data.choices[0].message.content;
        aiHistory.push({ role:'assistant', content:reply });
        aiAddMsg('bot', reply.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>'));
      } else {
        const errMsg = msgLang === 'id' ? 'AI tidak merespon, coba lagi ya 🙏' : 'AI did not respond, please try again 🙏';
        aiAddMsg('bot', errMsg);
      }
    } catch(e) {
      aiRemoveTyping();
      const errMsg = msgLang === 'id' ? 'Koneksi error, coba lagi 🔌' : 'Connection error, please retry 🔌';
      aiAddMsg('bot', errMsg);
    }
    aiLoading = false;
    document.getElementById('aiSendBtn').disabled = false;
  };
})();
