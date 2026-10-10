// ═══════════════════════════════════════════════════════════
// ─── ONCHAIN TRACER (fullscreen, pan/zoom) ───
// ═══════════════════════════════════════════════════════════
const OC_DUST = 0.001;
const OC_ROOT_EDGES = 80;   // maksimal garis dari wallet utama
const OC_NODE_EDGES = 20;   // maksimal garis tiap wallet yang di-klik
const oc = { chains: null, chain: null, root: null, ex: null, raw: new Map(), nodes: new Map(), edges: new Map(), txs: [],
             names: {}, tried: new Set(), vp: { x: 0, y: 0, k: 1 }, bounds: null, moved: false, hideDust: true,
             bal: new Map(), pos: null };

const ocShort = (a) => a.length > 16 ? a.slice(0, 8) + '…' + a.slice(-6) : a;
const ocName = (a) => { const l = oc.names[a]?.label; return l ? (l.length > 26 ? l.slice(0, 25) + '…' : l) : ocShort(a); };
const ocAmt = (n) => {
    if (!isFinite(n)) return '0';
    const a = Math.abs(n);
    for (const [v, s] of [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']])
        if (a >= v) return (n / v).toLocaleString('en-US', { maximumFractionDigits: 2 }) + s;
    return a >= 1 ? n.toLocaleString('en-US', { maximumFractionDigits: 4 })
                  : n.toLocaleString('en-US', { maximumSignificantDigits: 4 });
};
const ocDate = (ts) => new Date(ts).toISOString().slice(0, 10);

async function openOnchain() {
    document.getElementById('onchain-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.getElementById('oc-address').focus();
    ocLiveStart();
    if (oc.chains) return;
    try {
        const r = await fetch('/api/admin-airdrop?type=onchain&action=chains');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        oc.chains = await r.json();
        const groups = {};
        oc.chains.forEach(c => (groups[c.g] = groups[c.g] || []).push(c));
        document.getElementById('oc-chain').innerHTML = Object.entries(groups).map(([g, list]) =>
            `<optgroup label="${esc(g)}">${list.map(c =>
                `<option value="${esc(c.key)}" ${c.off ? 'disabled' : ''}>${esc(c.name)}${c.off ? ' (belum)' : ''}</option>`).join('')}</optgroup>`
        ).join('');
    } catch (e) { showToast('Gagal muat daftar chain: ' + e.message, 'error'); }
}
function closeOnchain() {
    document.getElementById('onchain-modal').classList.add('hidden');
    document.body.style.overflow = '';
    ocLiveStop();
}

async function ocFetch(chain, address) {
    const r = await fetch(`/api/admin-airdrop?type=onchain&chain=${encodeURIComponent(chain)}&address=${encodeURIComponent(address)}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
    return d;
}

async function ocSearch() {
    const addr = document.getElementById('oc-address').value.trim();
    const chain = document.getElementById('oc-chain').value;
    if (!addr) { showToast('Isi alamat wallet dulu', 'error'); return; }
    const btn = document.getElementById('oc-go');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Melacak...';
    try {
        const d = await ocFetch(chain, addr);
        oc.chain = chain; oc.root = d.address; oc.ex = d.explorer;
        oc.raw = new Map([[d.address, d]]);
        oc.names = {}; oc.tried = new Set();
        ocBuild();
        ocSummary(d);
        document.getElementById('oc-empty').classList.add('hidden');
        document.getElementById('oc-tx').classList.remove('hidden');
        document.getElementById('oc-main').classList.add('has-tx');
        ocRender(true);
        ocLoadLabels();
        ocLoadAssets();
    } catch (e) { showToast('Gagal: ' + e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Lacak'; }
}

// Ambil nama (ENS/tag/kontrak) untuk node yang belum punya, lalu gambar ulang
async function ocLoadLabels() {
    if (!/^0x/i.test(oc.root || '')) return;
    const need = [...oc.nodes.keys()].filter(a => !oc.tried.has(a) && (!oc.names[a] || oc.names[a].auto)).slice(0, 20);
    if (!need.length) return;
    need.forEach(a => oc.tried.add(a));
    const tag = oc.chain + oc.root;
    try {
        const r = await fetch(`/api/admin-airdrop?type=onchain&action=labels&chain=${encodeURIComponent(oc.chain)}&addresses=${need.join(',')}`);
        if (!r.ok || tag !== oc.chain + oc.root) return;
        const got = await r.json();
        const keys = Object.keys(got);
         if (!keys.length) { ocLoadLabels(); return; }
        keys.forEach(a => { oc.names[a] = { ...(oc.names[a] || {}), ...got[a], auto: false }; });
        ocBuild();
        ocRender(false);
        ocLoadLabels();
    } catch {}
}

// Bangun ulang graf dari data mentah (dipakai saat expand & toggle dust)
function ocBuild() {
    oc.nodes = new Map([[oc.root, { col: 0 }]]);
    oc.edges = new Map();
    oc.txs = [];
    oc.raw.forEach((d, addr) => { if (oc.nodes.has(addr)) ocMerge(d, addr === oc.root ? OC_ROOT_EDGES : OC_NODE_EDGES); });
    oc.nodes.forEach((n, a) => { const nm = oc.names[a]; if (nm) Object.assign(n, nm); });
    oc.txs.sort((a, b) => b.ts - a.ts);
   if (oc.txs.length > 500) oc.txs.length = 500;
}

function ocMerge(d, limit) {
    const base = d.address, baseCol = oc.nodes.get(base).col;
    const dust = (amount) => oc.hideDust && amount < (oc.chain === 'bitcoin' ? 0.00001 : OC_DUST);
    const swapFirst = (a, b) => (b.kind === 'swap') - (a.kind === 'swap');

    d.edges.filter(e => e.kind === 'swap' || !dust(e.amount))
        .sort((a, b) => swapFirst(a, b) || b.count - a.count || b.last_ts - a.last_ts)
        .slice(0, limit)
        .forEach(e => {
            const k = `${e.from}|${e.to}|${e.sym}`;
            if (!oc.edges.has(k)) oc.edges.set(k, e);
            const other = e.from === base ? e.to : e.from;
            if (!oc.nodes.has(other)) oc.nodes.set(other, { par: base, col: e.from === base ? baseCol + 1 : baseCol - 1 });
        });

    Object.entries(d.labels || {}).forEach(([a, l]) => { if (!oc.names[a] || oc.names[a].auto) oc.names[a] = l; });

    const seen = new Set(oc.txs.map(t => t.key));
    d.txs.filter(t => t.kind === 'swap' || !dust(t.value)).forEach(t => {
        t.key = t.hash + (t.kind || '') + t.from + t.to + t.sym + t.value;
        t.me = base;
        if (!seen.has(t.key)) { seen.add(t.key); oc.txs.push(t); }
    });
}

function ocToggleDust() {
    oc.hideDust = document.getElementById('oc-dust').checked;
    if (!oc.root) return;
    ocBuild();
    ocRender(false);
    ocLoadLabels();
}

async function ocExpand(addr) {
    if (oc.moved) return;
    if (oc.raw.has(addr)) return;
    if (oc.nodes.get(addr)?.type) { showToast('Kontrak/layanan dikenal, tidak ditelusuri', 'error'); return; }
    showToast('Memuat ' + ocShort(addr) + '…');
    try {
        const d = await ocFetch(oc.chain, addr);
        oc.raw.set(addr, d);
        ocBuild();
        ocRender(false);
        ocLoadLabels();
    } catch (e) { showToast('Gagal: ' + e.message, 'error'); }
}

function ocSummary(d) {
    const me = d.address;
    const inn = d.edges.filter(e => e.to === me).reduce((s, e) => s + e.count, 0);
    const out = d.edges.filter(e => e.from === me && e.kind !== 'swap').reduce((s, e) => s + e.count, 0);
    const peers = new Set(d.edges.map(e => e.from === me ? e.to : e.from)).size;
    const total = d.total_tx != null ? d.total_tx.toLocaleString('en-US') : d.fetched + (d.fetched >= 500 ? '+' : '');
    const el = document.getElementById('oc-summary');
    el.innerHTML = `
        <div class="oc-stat"><div class="n"><a href="${esc(d.explorer.addr + me)}" target="_blank" rel="noopener">${esc(ocShort(me))}</a></div><div class="l">${esc(d.name)} · Wallet</div></div>
        <div class="oc-stat"><div class="n">${esc(total)}</div><div class="l">Total TX</div></div>
        <div class="oc-stat"><div class="n" style="color:var(--success)">${inn}</div><div class="l">Transfer Masuk</div></div>
        <div class="oc-stat"><div class="n" style="color:var(--secondary)">${out}</div><div class="l">Transfer Keluar</div></div>
        <div class="oc-stat"><div class="n" style="color:#FFD23F">${d.swap_count || 0}</div><div class="l">Swap</div></div>
        <div class="oc-stat"><div class="n">${peers}</div><div class="l">Counterparty</div></div>`;
    el.classList.remove('hidden');
}

// ── pan / zoom ──
function ocApply() {
    const g = document.getElementById('oc-vp');
    if (g) g.setAttribute('transform', `translate(${oc.vp.x} ${oc.vp.y}) scale(${oc.vp.k})`);
    ocBalSchedule();
}

function ocFit() {
    if (!oc.bounds) return;
    const st = document.getElementById('oc-diagram');
    const { w, h } = oc.bounds, cw = st.clientWidth, ch = st.clientHeight;
    const k = Math.max(0.1, Math.min(cw / w, ch / h, 1.6));
    oc.vp = { k, x: w * k <= cw ? (cw - w * k) / 2 : 20, y: h * k <= ch ? (ch - h * k) / 2 : 20 };
    ocApply();
}
function ocZoom(f, cx, cy) {
    const r = document.getElementById('oc-diagram').getBoundingClientRect();
    cx = cx ?? r.width / 2; cy = cy ?? r.height / 2;
    const k = Math.min(3, Math.max(0.08, oc.vp.k * f)), real = k / oc.vp.k;
    oc.vp.x = cx - (cx - oc.vp.x) * real;
    oc.vp.y = cy - (cy - oc.vp.y) * real;
    oc.vp.k = k;
    ocApply();
}
(function ocInitPan() {
    const st = document.getElementById('oc-diagram');
    if (!st) return;
    let drag = null;
    st.addEventListener('pointerdown', e => {
        if (e.target.closest('a')) return;
        drag = { x: e.clientX, y: e.clientY, vx: oc.vp.x, vy: oc.vp.y };
        oc.moved = false;
    });
    window.addEventListener('pointermove', e => {
        if (!drag) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!oc.moved && Math.abs(dx) + Math.abs(dy) > 4) { oc.moved = true; st.classList.add('grabbing'); }
        if (oc.moved) { oc.vp.x = drag.vx + dx; oc.vp.y = drag.vy + dy; ocApply(); }
    });
    window.addEventListener('pointerup', () => {
        drag = null; st.classList.remove('grabbing');
        setTimeout(() => { oc.moved = false; }, 0);
    });
    st.addEventListener('wheel', e => {
        e.preventDefault();
        const r = st.getBoundingClientRect();
        ocZoom(e.deltaY < 0 ? 1.12 : 0.89, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
})();

        // Tata letak radial: wallet utama di tengah, counterparty melingkar (beberapa ring),
// wallet yang di-klik membuka cabangnya ke arah luar.
function ocLayout() {
    const GAP = 160, PAD = 100, STRETCH = 1.45;   // STRETCH = seberapa melebar ke samping
    const kids = new Map();
    oc.nodes.forEach((n, a) => {
        if (a === oc.root) return;
        const p = n.par && oc.nodes.has(n.par) ? n.par : oc.root;
        if (!kids.has(p)) kids.set(p, []);
        kids.get(p).push(a);
    });

    const pos = new Map([[oc.root, { x: 0, y: 0 }]]);

    // cabang wallet yang sudah di-expand: kipas ke arah menjauhi induknya
    const fan = (a, dir) => {
        const list = (kids.get(a) || []).filter(c => !pos.has(c));
        if (!list.length) return;
        const m = list.length, p = pos.get(a);
        const span = Math.min(Math.PI * 1.4, Math.max(0.9, m * 0.4));
        const rad = Math.max(200, (m * GAP) / span);
        list.forEach((c, j) => {
            const ang = m === 1 ? dir : dir - span / 2 + (span * (j + 0.5)) / m;
            pos.set(c, { x: p.x + Math.cos(ang) * rad, y: p.y + Math.sin(ang) * rad });
            fan(c, ang);
        });
    };

        // counterparty wallet utama: cincin oval, tiap cincin kapasitasnya kelipatan cincin pertama
    // supaya node cincin luar jatuh DI ANTARA node cincin dalam (garis tidak menembus node lain)
    const first = kids.get(oc.root) || [];
    const R0 = 280;
    const n1 = Math.max(8, Math.floor((2 * Math.PI * R0 * ((1 + STRETCH) / 2)) / GAP));
    const rings = [];
    for (let i = 0, k = 0; i < first.length; k++) {
        const slots = n1 * (k + 1);
        rings.push({ k, slots, r: R0 * (k + 1), items: first.slice(i, i + slots) });
        i += slots;
    }
    rings.forEach(ring => {
        const step = (2 * Math.PI) / ring.slots;
        const off = ring.k === 0 ? 0 : step / 2;          // cincin luar digeser setengah langkah
        const n = ring.items.length;
        ring.items.forEach((a, j) => {
            const slot = Math.floor((j * ring.slots) / n);  // cincin terakhir yang belum penuh tetap tersebar rata
            const ang = -Math.PI / 2 + off + step * slot;
            pos.set(a, { x: Math.cos(ang) * ring.r * STRETCH, y: Math.sin(ang) * ring.r });
        });
    });
    first.forEach(a => { const p = pos.get(a); fan(a, Math.atan2(p.y, p.x)); });

    // geser semua koordinat supaya positif
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pos.forEach(p => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
    const ox = PAD - x0, oy = PAD - y0;
    pos.forEach(p => { p.x += ox; p.y += oy; });
    return { pos, W: x1 - x0 + PAD * 2, H: y1 - y0 + PAD * 2, ox, oy };
}

// ── render ──
function ocRender(fit) {
    if (!oc.root) return;
        const R = 28;
    const { pos, W, H, ox, oy } = ocLayout();
        oc.pos = pos;
    // jaga posisi layar saat expand supaya diagram tidak "loncat"
    if (!fit && oc.shift) { oc.vp.x -= (ox - oc.shift.x) * oc.vp.k; oc.vp.y -= (oy - oc.shift.y) * oc.vp.k; }
    oc.shift = { x: ox, y: oy };
    const rp = pos.get(oc.root);
    const dist = (p) => Math.hypot(p.x - rp.x, p.y - rp.y);
    const dense = oc.edges.size > 40;   // garis banyak: baris tanggal di label dibuang

    let animN = 0;
    const pairIdx = {};
    const edgeLabelSvg = [];
    const edgeSvg = [...oc.edges.values()].map(e => {
        const a = pos.get(e.from), b = pos.get(e.to);
        if (!a || !b) return '';
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len < 1) return '';
        const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
        const x1 = a.x + ux * R, y1 = a.y + uy * R;
        const x2 = b.x - ux * (R + 5), y2 = b.y - uy * (R + 5);

        // garis ganda antar pasangan yang sama dibengkokkan bergantian biar tidak menumpuk
        const pk = [e.from, e.to].sort().join('|');
        const n = (pairIdx[pk] = (pairIdx[pk] || 0) + 1);
        const k = Math.ceil((n - 1) / 2) * 32, bend = n === 1 ? 0 : (n % 2 === 0 ? k : -k);
        const cx = (x1 + x2) / 2 - uy * bend * 2, cy = (y1 + y2) / 2 + ux * bend * 2;
        const path = `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;

        // label dekat ujung yang lebih jauh dari wallet utama (biar tidak numpuk di tengah)
        const t = dist(a) > dist(b) ? 0.3 : 0.7, s = 1 - t;
        const lx = s * s * x1 + 2 * s * t * cx + t * t * x2;
        const ly = s * s * y1 + 2 * s * t * cy + t * t * y2 - 10;

        const isSwap = e.kind === 'swap';
        const special = oc.nodes.get(e.to)?.type;
        const color = isSwap ? '#FFD23F' : (e.from === oc.root ? 'var(--secondary)' : 'var(--primary)');
        const l1 = isSwap ? `${ocAmt(e.sold.amount)} ${e.sold.sym} → ${ocAmt(e.bought.amount)} ${e.bought.sym}` : `${ocAmt(e.amount)} ${e.sym}`;
        const l2 = (isSwap ? (e.wrap ? 'WRAP ' : 'SWAP ') : '') + `×${e.count} · ${ocDate(e.last_ts)}`;
        edgeLabelSvg.push(`<a href="${esc(oc.ex.tx + e.hashes[0])}" target="_blank" rel="noopener">
            <text class="oc-elabel" ${isSwap ? 'style="fill:#FFD23F"' : ''} x="${lx}" y="${ly}" text-anchor="middle">${esc(l1)}</text>
            ${dense ? '' : `<text class="oc-esub" x="${lx}" y="${ly + 16}" text-anchor="middle">${esc(l2)}</text>`}
        </a>`);
        return `<path d="${path}" fill="none" stroke="${color}" stroke-opacity=".85" stroke-width="2.2" ${isSwap || special ? 'stroke-dasharray="7 6"' : ''} marker-end="url(#oc-arrow)"/>
        ${(animN++ < 60) ? `<path class="oc-flow ${isSwap ? 'swap' : ''}" d="${path}" stroke="${color}"/>` : ''}`;
    }).join('');

        const nodeLabelSvg = [];   // label node juga digambar paling atas
    const nodeSvg = [...oc.nodes.entries()].map(([a, n]) => {
        const p = pos.get(a), isRoot = a === oc.root;
        if (!p) return '';
        const fill = n.type === 'mixer' ? 'var(--danger)' : n.type === 'bridge' ? '#F59E0B' : n.type ? 'var(--success)' : isRoot ? 'var(--secondary)' : 'var(--primary)';
        const hasName = !!n.label;

        nodeLabelSvg.push(`
            ${hasName ? `<text class="oc-nlabel" x="${p.x}" y="${p.y + R + 20}" text-anchor="middle">${esc(ocName(a))}</text>` : ''}
            <a href="${esc(oc.ex.addr + a)}" target="_blank" rel="noopener">
                <text class="oc-addr" x="${p.x}" y="${p.y + R + (hasName ? 38 : 20)}" text-anchor="middle">${esc(ocShort(a))}</text></a>`);

        return `<g class="oc-node" onclick="ocExpand('${esc(a)}')">
            <title>${esc((n.label ? n.label + '\n' : '') + a)}</title>
            <circle cx="${p.x}" cy="${p.y}" r="${R + 8}" fill="${fill}" opacity=".12"/>
            <circle class="main" cx="${p.x}" cy="${p.y}" r="${R}" fill="${fill}" stroke="${oc.raw.has(a) ? '#fff' : 'transparent'}" stroke-width="2"/>
            <text x="${p.x}" y="${p.y + 6}" text-anchor="middle" font-size="17" font-weight="800" fill="#000">${isRoot ? '★' : n.type ? '◆' : '•'}</text>
            ${ocBalBadge(a, p, R)}
        </g>`;
    }).join('');

    oc.bounds = { w: W, h: H };
    document.getElementById('oc-diagram').innerHTML = `<svg>
        <defs><marker id="oc-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#8a8a92"/></marker></defs>
        <g id="oc-vp">${edgeSvg}${nodeSvg}${edgeLabelSvg.join('')}${nodeLabelSvg.join('')}</g></svg>`;
    fit ? ocFit() : ocApply();

    document.getElementById('oc-tx-head').textContent = `Transaksi (${oc.txs.length})`;
    document.getElementById('oc-tx-body').innerHTML = oc.txs.map(t => {
        const hash = `<a href="${esc(oc.ex.tx + t.hash)}" target="_blank" rel="noopener">${esc(t.hash.slice(0, 10))}…${esc(t.hash.slice(-6))}</a>`;
        if (t.kind === 'swap') {
            return `<tr><td>${hash}</td><td>${ocDate(t.ts)}</td>
                <td><span class="oc-dir swap">${t.wrap ? 'WRAP' : 'SWAP'}</span>${esc(ocName(t.to))}</td>
                <td>${ocAmt(t.sold.amount)} ${esc(t.sold.sym)} → ${ocAmt(t.bought.amount)} ${esc(t.bought.sym)}</td></tr>`;
        }
        const out = t.from === t.me, peer = out ? t.to : t.from;
        return `<tr><td>${hash}</td><td>${ocDate(t.ts)}</td>
            <td><span class="oc-dir ${out ? 'out' : 'in'}">${out ? 'OUT' : 'IN'}</span><a href="${esc(oc.ex.addr + peer)}" target="_blank" rel="noopener" title="${esc(peer)}">${esc(ocName(peer))}</a></td>
            <td>${ocAmt(t.value)} ${esc(t.sym)}</td></tr>`;
    }).join('');
}

// ═══ SALDO PER ALAMAT (ikon kiri-bawah node) ═══
const OC_BAL_BATCH = 10;         // alamat per request
const OC_BAL_PER_RUN = 150;      // maks alamat per proses (naikkan kalau API kuat, turunkan kalau kena limit)
const OC_BAL_FRESH = 5 * 60e3, OC_BAL_RETRY = 60e3;
let _ocBalRun = false, _ocBalAgain = false, _ocBalTimer = null;

const ocBalText = (b) => (b.partial ? '~' : '') + (b.usd == null
    ? `${ocAmt(b.native.amount)} ${b.native.sym}`
    : (b.usd > 0 && b.usd < 1 ? '<$1' : '$' + ocAmt(b.usd)));

function ocBalTip(b) {
    const L = [b.usd != null ? 'Total ≈ $' + ocAmt(b.usd) : 'Total USD tidak diketahui'];
    L.push(`${ocAmt(b.native.amount)} ${b.native.sym}`);
    (b.tokens || []).forEach(t => L.push(`${ocAmt(t.amount)} ${t.sym} ($${ocAmt(t.usd)})`));
    if (b.n > (b.tokens || []).length) L.push(`+${b.n - b.tokens.length} token lain`);
    if (b.partial) L.push('(sebagian: token tidak ikut dihitung di chain ini)');
    return L.join('\n');
}

function ocBalInner(cx, cy, b) {
    const ok = b && !b.err;
    const tip = ok ? ocBalTip(b) : (b && b.err ? 'Saldo gagal dimuat' : 'Memuat saldo…');
    return `<title>${esc(tip)}</title>
        <circle class="oc-bal-dot" cx="${cx}" cy="${cy}" r="10"/>
        <text class="oc-bal-g" x="${cx}" y="${cy + 4}" text-anchor="middle">$</text>
        ${ok ? `<text class="oc-bal-txt" x="${cx - 14}" y="${cy + 4}" text-anchor="end">${esc(ocBalText(b))}</text>` : ''}`;
}

function ocBalBadge(a, p, R) {
    const b = oc.bal.get(oc.chain + ':' + a), cx = p.x - R * 0.72, cy = p.y + R * 0.72;
    return `<g class="oc-bal ${b && !b.err ? '' : 'loading'}" id="ocb-${esc(a)}" data-cx="${cx}" data-cy="${cy}">${ocBalInner(cx, cy, b)}</g>`;
}

// update satu badge tanpa render ulang seluruh diagram
function ocBalPaint(a, chain) {
    const g = document.getElementById('ocb-' + a);
    if (!g) return;
    const b = oc.bal.get(chain + ':' + a);
    g.innerHTML = ocBalInner(+g.dataset.cx, +g.dataset.cy, b);
    g.classList.toggle('loading', !b || !!b.err);
}

// alamat yang kelihatan di layar & belum punya saldo segar, urut dari yang paling dekat tengah
function ocBalVisible() {
    const st = document.getElementById('oc-diagram');
    if (!st || !oc.pos) return [];
    const cw = st.clientWidth, ch = st.clientHeight, { x, y, k } = oc.vp, m = 40, now = Date.now(), out = [];
    oc.pos.forEach((p, a) => {
        const sx = p.x * k + x, sy = p.y * k + y;
        if (sx < -m || sy < -m || sx > cw + m || sy > ch + m) return;
        const hit = oc.bal.get(oc.chain + ':' + a);
        if (hit && now - hit.t < (hit.err ? OC_BAL_RETRY : OC_BAL_FRESH)) return;
        out.push([a, a === oc.root ? -1 : Math.hypot(sx - cw / 2, sy - ch / 2)]);
    });
    return out.sort((a, b) => a[1] - b[1]).map(v => v[0]);
}

function ocBalSchedule() {
    clearTimeout(_ocBalTimer);
    _ocBalTimer = setTimeout(ocLoadBalances, 350);   // tunggu geser/zoom berhenti dulu
}

async function ocLoadBalances() {
    if (!oc.root) return;
    if (_ocBalRun) { _ocBalAgain = true; return; }
    _ocBalRun = true;
    const chain = oc.chain, tag = chain + oc.root;
    try {
        let done = 0;
        while (done < OC_BAL_PER_RUN) {
            if (tag !== oc.chain + oc.root) break;                 // user ganti wallet/chain
            const batch = ocBalVisible().slice(0, OC_BAL_BATCH);
            if (!batch.length) break;
            done += batch.length;
            let got = {};
            try {
                const r = await fetch(`/api/admin-airdrop?type=onchain&action=balances&chain=${encodeURIComponent(chain)}&addresses=${batch.join(',')}`);
                if (r.ok) got = await r.json();
            } catch {}
            if (tag !== oc.chain + oc.root) break;
            batch.forEach(a => {
                const v = got[a.toLowerCase()] || got[a];
                oc.bal.set(chain + ':' + a, v && !v.err ? { ...v, t: Date.now() } : { err: true, t: Date.now() });
                ocBalPaint(a, chain);
            });
            await new Promise(r => setTimeout(r, 250));
        }
    } finally {
        _ocBalRun = false;
        if (_ocBalAgain) { _ocBalAgain = false; ocBalSchedule(); }
    }
}

    // ═══ TABEL ASET WALLET UTAMA ═══
async function ocLoadAssets() {
    const head = document.getElementById('oc-assets-head'), body = document.getElementById('oc-assets-body');
    if (!head || !body || !oc.root) return;
    const chain = oc.chain, root = oc.root, tag = chain + root;
    head.textContent = 'Aset Wallet · memuat…';
    body.innerHTML = '';
    try {
        const r = await fetch(`/api/admin-airdrop?type=onchain&action=balances&chain=${encodeURIComponent(chain)}&addresses=${encodeURIComponent(root)}&full=1`);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const got = await r.json();
        if (tag !== oc.chain + oc.root) return;                    // user sudah ganti wallet
        const b = got[root] || got[root.toLowerCase()];
        if (!b || b.err) throw new Error(b?.err || 'tidak ada data');

        const total = b.usd > 0 ? b.usd : 0;
        const pct = (u) => (total && u > 0 ? (u / total * 100).toFixed(u / total >= 0.1 ? 1 : 2) + '%' : '—');
        const usdTxt = (u) => (u > 0 ? '$' + ocAmt(u) : '—');
        const rows = [];
        if (b.native.amount > 0) rows.push({ sym: b.native.sym, amount: b.native.amount, usd: b.native.usd || 0 });
        (b.all || b.tokens || []).forEach(t => rows.push(t));
        rows.sort((a, c) => (c.usd || 0) - (a.usd || 0));

        const more = b.n - (b.all || b.tokens || []).length;
        body.innerHTML = rows.map(t => `<tr>
            <td>${esc(t.sym)}</td><td class="r">${ocAmt(t.amount)}</td>
            <td class="r usd">${usdTxt(t.usd)}</td><td class="r mut">${pct(t.usd)}</td></tr>`).join('')
            + (more > 0 ? `<tr><td class="mut" colspan="4">+${more} token lain</td></tr>` : '')
            + (b.partial ? `<tr><td class="mut" colspan="4">Sebagian: chain ini hanya menghitung koin native, token tidak ikut.</td></tr>` : '')
            || `<tr><td class="mut" colspan="4">Tidak ada aset yang terdeteksi.</td></tr>`;
        head.textContent = `Aset Wallet · ${total ? '≈ $' + ocAmt(total) : 'nilai USD tidak diketahui'}${b.partial ? ' (sebagian)' : ''}`;
    } catch (e) {
        if (tag !== oc.chain + oc.root) return;
        head.textContent = 'Aset Wallet · gagal dimuat';
        body.innerHTML = `<tr><td class="mut" colspan="4">${esc(e.message)}</td></tr>`;
    }
}

// ═══════════════════════════════════════════════════════════
// ─── LIVE TRANSFERS (panel kiri / bottom sheet) ───
// ═══════════════════════════════════════════════════════════
const OC_LIVE_CHAINS = ['ethereum', 'bnb', 'base', 'arbitrum', 'polygon', 'op'];   // kalau status bilang "Sebagian gagal", kurangi chain di sini
const OC_LIVE_POLL_MS = 20000;             // cek transfer baru tiap 20 detik
const OC_LIVE_PAGE = 20;                   // jumlah kartu per "Muat lebih banyak"
const OC_LIVE_MAX = 300;                   // batas kartu di memori
const OC_LIVE_PAIRS = { ETH: 'ETHUSDT', BNB: 'BNBUSDT', POL: 'POLUSDT' };
const OC_LIVE_NATIVE = { ethereum: 'ETH', bnb: 'BNB', base: 'ETH', arbitrum: 'ETH', op: 'ETH', polygon: 'POL' };
const OC_LIVE_GAP_FIRST = 150;   // detik ke belakang saat pertama kali (maks 180 di backend)
const OC_LIVE_GAP = 45;          // detik ke belakang tiap polling
const OC_LIVE_SRC_MIN = 100000;  // batas minimal di server; filter di UI dilakukan di client
const OC_LIVE_EXPLORER = { ethereum: 'https://etherscan.io/tx/' };
const OC_LIVE_MODES = [['all', 'Semua'], ['whale', 'Whale ≥ $1M'], ['tag', 'Bertag']];

const ocLive = { items: [], queue: [], seen: new Set(), names: {}, tried: new Set(),
    prices: { USDT: 1, USDC: 1 }, shown: OC_LIVE_PAGE, minUsd: 250000, mode: 'all', q: '',
        on: false, paused: false, busy: false, first: true, done: new Set(), timer: null, labelBusy: false };
        
const ocLiveUsd = (it) => {
    if (it.usd != null && isFinite(it.usd)) return it.usd;   // backend sudah hitung untuk semua token
    const p = ocLive.prices[it.sym];
    return p ? it.amount * p : null;
};
const ocLiveLabel = (a) => ocLive.names[a]?.label || null;
const ocLiveShow = (a) => { const l = ocLiveLabel(a); return l ? (l.length > 22 ? l.slice(0, 21) + '…' : l) : ocShort(a); };

function ocLiveStatus(t) { const el = document.getElementById('oc-live-status'); if (el) el.textContent = t; }

function ocLiveToggle(force) {
    const main = document.getElementById('oc-main');
    const off = force === undefined ? !main.classList.contains('live-off') : !force;
    main.classList.toggle('live-off', off);
    document.getElementById('oc-live-toggle').classList.toggle('active', !off);
    if (!off) ocLiveRender();
    setTimeout(() => { if (oc.bounds) ocFit(); }, 60);   // diagram menyesuaikan lebar baru
}

function ocLiveStart() {
    if (ocLive.on) return;
                ocLive.on = true; ocLive.first = true; ocLive.paused = false; ocLive.done = new Set();
    document.getElementById('oc-live-btn')?.classList.add('on');
    const bt = document.getElementById('oc-live-btn-t'); if (bt) bt.textContent = 'Live';
    ocLiveStatus('Memuat…');
    ocLiveTick();
    ocLive.timer = setInterval(ocLiveTick, OC_LIVE_POLL_MS);
}
function ocLiveStop() {
    ocLive.on = false;
    clearInterval(ocLive.timer); ocLive.timer = null;
}

async function ocLivePrices() {
    for (const [sym, pair] of Object.entries(OC_LIVE_PAIRS)) {
        try {
            const r = await fetch(`${BN}/ticker/price?symbol=${pair}`);
            const j = await r.json();
            if (+j.price) ocLive.prices[sym] = +j.price;
        } catch {}
    }
}

async function ocLiveFetch(chain, gap) {
    const price = ocLive.prices[OC_LIVE_NATIVE[chain]] || 0;   // 0 = transfer native dilewati
    const r = await fetch(`/api/admin-airdrop?type=onchain&action=live&chain=${encodeURIComponent(chain)}&gap=${gap}&min=${OC_LIVE_SRC_MIN}&price=${price}`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    return d.items || [];
}

async function ocLiveTick() {
    if (!ocLive.on || ocLive.paused || ocLive.busy) return;
    ocLive.busy = true;
    try {
        await ocLivePrices();
        // chain yang sudah pernah sukses cukup ambil 3 block terakhir; yang belum, ambil ±4 menit ke belakang
        const res = await Promise.allSettled(OC_LIVE_CHAINS.map(c =>
    ocLiveFetch(c, ocLive.done.has(c) ? OC_LIVE_GAP : OC_LIVE_GAP_FIRST).then(items => { ocLive.done.add(c); return items; })));
     const fresh = [], failedNames = [];
        res.forEach((r, i) => {
            if (r.status !== 'fulfilled') { failedNames.push(OC_LIVE_CHAINS[i]); return; }
            r.value.forEach(it => {
                const id = it.chain + ':' + (it.id || it.hash);
                if (ocLive.seen.has(id)) return;
                ocLive.seen.add(id); it._id = id; fresh.push(it);
            });
        });
        ocLive.queue.push(...fresh);

        // kalau user lagi scroll ke bawah, jangan geser list: tampilkan pill "N transaksi baru"
        const list = document.getElementById('oc-live-list');
        if (!ocLive.items.length || (list && list.scrollTop <= 40)) ocLiveFlush(); else ocLiveRender();

        const t = new Date().toLocaleTimeString('id-ID', { hour12: false, timeZone: 'Asia/Jakarta' });
        ocLiveStatus(failedNames.length
            ? `Gagal: ${failedNames.join(', ')} · ${ocLive.items.length} tx`
            : `Live · ${OC_LIVE_CHAINS.length} chain · ${t} · ${ocLive.items.length} tx`);
    } catch (e) {
        ocLiveStatus('Gagal: ' + e.message);
    } finally { ocLive.busy = false; }
}

function ocLiveFlush() {
    ocLive.items = ocLive.queue.concat(ocLive.items).sort((a, b) => b.ts - a.ts).slice(0, OC_LIVE_MAX);
    ocLive.queue = [];
    if (ocLive.seen.size > OC_LIVE_MAX * 8) ocLive.seen = new Set(ocLive.items.map(i => i._id));
    ocLiveRender();
}

 // Gabungkan leg swap (1 tx, 1 wallet kirim token A & terima token B) jadi 1 kartu
function ocLiveGroup(items) {
    const byHash = new Map();
    items.forEach(it => {
        if (!it.hash) return;
        const k = it.chain + ':' + it.hash;
        if (!byHash.has(k)) byHash.set(k, []);
        byHash.get(k).push(it);
    });

    const drop = new Set(), merged = [];
    byHash.forEach((list, key) => {
        if (list.length < 2) return;
        let best = null;
        new Set(list.map(i => i.to)).forEach(w => {
            const outs = list.filter(x => x.from === w), ins = list.filter(x => x.to === w);
            if (!outs.length || !ins.length) return;
            const usdOf = (x) => ocLiveUsd(x) || 0;
            const sold = outs.reduce((a, b) => (usdOf(b) > usdOf(a) ? b : a));
            const gotList = ins.filter(x => x.sym !== sold.sym);
            if (!gotList.length) return;                       // token sama = deposit/withdraw, bukan swap
            const bought = gotList.reduce((a, b) => (usdOf(b) > usdOf(a) ? b : a));
            // wallet yang punya label (router/pool) kalah dari wallet tanpa label (si penukar)
            const score = usdOf(sold) - (ocLive.names[w] ? 1e12 : 0);
            if (!best || score > best.score) best = { w, sold, bought, score };
        });
        if (!best) return;

        list.forEach(i => drop.add(i));
        const wrap = ('W' + best.sold.sym === best.bought.sym) || ('W' + best.bought.sym === best.sold.sym);
        merged.push({
            ...best.sold, kind: 'swap', wrap,
            from: best.w, to: best.sold.to,
            sold: { sym: best.sold.sym, amount: best.sold.amount },
            bought: { sym: best.bought.sym, amount: best.bought.amount },
            usd: ocLiveUsd(best.sold),
            ts: Math.max(...list.map(i => i.ts)),
            _id: key + ':swap',
        });
    });

    return items.filter(i => !drop.has(i)).concat(merged).sort((a, b) => b.ts - a.ts);
}

function ocLiveFiltered() {
    const q = ocLive.q.trim().toLowerCase();
    return ocLiveGroup(ocLive.items).filter(it => {
        const usd = ocLiveUsd(it);
        if (usd === null) return false;
        if (!q && usd < ocLive.minUsd) return false;      // pas mencari, batas minimal diabaikan
        if (ocLive.mode === 'whale' && usd < 1e6) return false;
        const lf = ocLiveLabel(it.from), lt = ocLiveLabel(it.to);
        if (ocLive.mode === 'tag' && !lf && !lt) return false;
        if (!q) return true;
        return [it.hash, it.from, it.to, lf, lt, it.sym, it.bought?.sym, it.chain].some(v => v && String(v).toLowerCase().includes(q));
    });
}

function ocLiveCard(it) {
    const usd = ocLiveUsd(it), whale = usd !== null && usd >= 1e6, swap = it.kind === 'swap';
    const lf = ocLiveLabel(it.from), lt = ocLiveLabel(it.to);
    const tagTxt = [lf, lt].some(l => l && /\.eth$/i.test(l)) ? 'ENS' : 'TAG';
    const link = it.url || (OC_LIVE_EXPLORER[it.chain] ? OC_LIVE_EXPLORER[it.chain] + it.hash : '');
    const addr = (a) => `<button class="oc-lv-addr ${ocLiveLabel(a) ? 'named' : ''}" data-addr="${esc(a)}" data-chain="${esc(it.chain)}" title="${esc((ocLiveLabel(a) ? ocLiveLabel(a) + '\n' : '') + a)}">${esc(ocLiveShow(a))}</button>`;
    const amt = swap
        ? `${ocAmt(it.sold.amount)} $${esc(it.sold.sym)}<span class="sw">→</span>${ocAmt(it.bought.amount)} $${esc(it.bought.sym)}`
        : `${ocAmt(it.amount)} $${esc(it.sym)}`;
    return `<div class="oc-lv ${whale ? 'whale' : ''}" data-addr="${esc(it.from)}" data-chain="${esc(it.chain)}">
        <div class="oc-lv-top">
            <span class="oc-lv-chain">${esc(it.chain)}</span>
            ${swap ? `<span class="oc-lv-badge swap">${it.wrap ? 'Wrap' : 'Swap'}</span>` : ''}
            ${whale ? '<span class="oc-lv-badge whale">Whale</span>' : ''}
            ${(lf || lt) ? `<span class="oc-lv-badge tag">${tagTxt}</span>` : ''}
            <span class="oc-lv-time">${newsTimeAgo(new Date(it.ts).toISOString())}${/^https?:\/\//.test(link) ? `<a href="${esc(link)}" target="_blank" rel="noopener">tx ↗</a>` : ''}</span>
        </div>
        <div class="oc-lv-amt">${amt}${usd !== null ? `<small>$${ocAmt(usd)}</small>` : ''}</div>
        <div class="oc-lv-route">${addr(it.from)}<span class="arr">→</span>${addr(it.to)}</div>
    </div>`;
}

function ocLiveRender() {
    const list = document.getElementById('oc-live-list');
    if (!list) return;
    const all = ocLiveFiltered();
    const shown = all.slice(0, ocLive.shown);
    const st = list.scrollTop;
    const pill = ocLive.queue.length ? `<button class="oc-live-new" data-act="new">↑ ${ocLive.queue.length} transaksi baru</button>` : '';
    const more = all.length > shown.length ? `<button class="oc-live-more" data-act="more">Muat lebih banyak (${all.length - shown.length})</button>` : '';
    list.innerHTML = pill + (shown.length
        ? shown.map(ocLiveCard).join('')
        : `<div class="oc-live-empty">${ocLive.items.length ? 'Tidak ada yang cocok dengan filter.' : 'Menunggu transaksi besar…'}</div>`) + more;
    list.scrollTop = st;
    const badge = document.getElementById('oc-live-up-n');
    if (badge) { badge.textContent = ocLive.queue.length; badge.classList.toggle('hidden', !ocLive.queue.length); }
    ocLiveLabels(shown);
}

// Ambil nama ENS/tag untuk alamat yang tampil, lalu gambar ulang kalau ada yang dapat nama
async function ocLiveLabels(visible) {
    if (ocLive.labelBusy) return;
    const byChain = {};
    visible.forEach(it => [it.from, it.to].forEach(a => {
        if (/^0x/i.test(a) && !ocLive.tried.has(a)) (byChain[it.chain] = byChain[it.chain] || new Set()).add(a);
    }));
    const jobs = Object.entries(byChain);
    if (!jobs.length) return;
    ocLive.labelBusy = true;
    let changed = false;
    try {
        for (const [chain, set] of jobs) {
            const addrs = [...set].slice(0, 60);
            addrs.forEach(a => ocLive.tried.add(a));
            for (let i = 0; i < addrs.length; i += 20) {
                const r = await fetch(`/api/admin-airdrop?type=onchain&action=labels&chain=${encodeURIComponent(chain)}&addresses=${addrs.slice(i, i + 20).join(',')}`);
                if (!r.ok) continue;
                const got = await r.json();
                Object.entries(got).forEach(([a, l]) => { ocLive.names[a.toLowerCase()] = l; changed = true; });
            }
        }
    } catch {} finally { ocLive.labelBusy = false; }
    if (changed) ocLiveRender();
}

// Klik kartu/alamat -> isi kolom alamat lalu langsung Lacak
function ocLivePick(addr, chain) {
    document.getElementById('oc-address').value = addr;
    const sel = document.getElementById('oc-chain');
    if ([...sel.options].some(o => o.value === chain && !o.disabled)) sel.value = chain;
    if (window.innerWidth <= 1100) ocLiveToggle(false);   // di HP, tutup bottom sheet biar diagram kelihatan
    ocSearch();
}

function ocLiveInit() {
    document.getElementById('oc-live-close').innerHTML = icon('x');
    const chips = document.getElementById('oc-live-chips');
    chips.innerHTML = OC_LIVE_MODES.map(([k, l]) => `<button class="oc-lchip ${k === ocLive.mode ? 'active' : ''}" data-mode="${k}" type="button">${l}</button>`).join('')
        + `<select id="oc-live-min" title="Nilai minimal">${[100000, 250000, 500000, 1000000].map(v => `<option value="${v}" ${v === ocLive.minUsd ? 'selected' : ''}>≥ $${ocAmt(v)}</option>`).join('')}</select>`;

    chips.addEventListener('click', e => {
        const b = e.target.closest('.oc-lchip');
        if (!b) return;
        ocLive.mode = b.dataset.mode; ocLive.shown = OC_LIVE_PAGE;
        chips.querySelectorAll('.oc-lchip').forEach(x => x.classList.toggle('active', x === b));
        ocLiveRender();
    });
    document.getElementById('oc-live-min').addEventListener('change', e => {
        ocLive.minUsd = +e.target.value; ocLive.shown = OC_LIVE_PAGE; ocLiveRender();
    });

    let tm;
    const search = document.getElementById('oc-live-search');
    search.addEventListener('input', e => {
        clearTimeout(tm);
        tm = setTimeout(() => { ocLive.q = e.target.value; ocLive.shown = OC_LIVE_PAGE; ocLiveRender(); }, 150);
    });
    search.addEventListener('keydown', e => {   // Enter + alamat 0x lengkap = langsung lacak
        const v = e.target.value.trim();
        if (e.key === 'Enter' && /^0x[a-f0-9]{40}$/i.test(v)) ocLivePick(v, 'ethereum');
    });

    document.getElementById('oc-live-list').addEventListener('click', e => {
        if (e.target.closest('a')) return;
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'more') { ocLive.shown += OC_LIVE_PAGE; ocLiveRender(); return; }
        if (act === 'new') { ocLiveFlush(); document.getElementById('oc-live-list').scrollTop = 0; return; }
        const el = e.target.closest('.oc-lv-addr') || e.target.closest('.oc-lv');
        if (el) ocLivePick(el.dataset.addr, el.dataset.chain);
    });

    ocLiveRender();

    // tombol Live (jeda / lanjut) + panah atas/bawah di bagian bawah panel
    const liveBtn = document.getElementById('oc-live-btn');
    liveBtn.addEventListener('click', () => {
        ocLive.paused = !ocLive.paused;
        liveBtn.classList.toggle('on', !ocLive.paused);
        document.getElementById('oc-live-btn-t').textContent = ocLive.paused ? 'Jeda' : 'Live';
        if (ocLive.paused) ocLiveStatus('Dijeda · klik Live untuk lanjut');
        else ocLiveTick();
    });
    document.querySelector('.oc-live-arrows').addEventListener('click', e => {
        const b = e.target.closest('[data-dir]');
        if (!b) return;
        const list = document.getElementById('oc-live-list');
        if (b.dataset.dir === 'up') {
            if (ocLive.queue.length) ocLiveFlush();
            list.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
        }
    });
}
ocLiveInit();
        
// ── input & shortcut ──
document.getElementById('oc-address')?.addEventListener('keydown', e => { if (e.key === 'Enter') ocSearch(); });
document.getElementById('oc-address')?.addEventListener('input', e => {
    const v = e.target.value.trim(), sel = document.getElementById('oc-chain');
    if (/^0x/i.test(v)) { if (sel.value === 'solana' || sel.value === 'bitcoin') sel.value = 'ethereum'; }
    else if (/^bc1/i.test(v)) sel.value = 'bitcoin';
    else if (v.length > 30 && sel.value !== 'bitcoin') sel.value = 'solana';
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.getElementById('onchain-modal').classList.contains('hidden')) closeOnchain();
});
