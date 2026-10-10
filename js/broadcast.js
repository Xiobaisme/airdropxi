// ═══════════════════════════════════════════════════════════
// ─── BROADCAST MODAL (compose manual, kirim ke Discord & Telegram) ───
// Judul + deskripsi diketik manual, gambar di-paste langsung (Ctrl+V)
// dari clipboard — dikirim sebagai FILE, bukan link, jadi nggak perlu
// upload/download dulu di kedua platform.
// ═══════════════════════════════════════════════════════════
let _broadcastImageBase64 = null;

function openBroadcastModal() {
    if (isMember()) return;

    document.getElementById('b-title').value = '';
    document.getElementById('b-desc').value = '';
    _activeBroadcastTag = null;
    renderBroadcastTags();
    removeBroadcastImage();
    document.getElementById('broadcast-modal').classList.remove('hidden');
}

        
function closeBroadcastModal() {
    document.getElementById('broadcast-modal').classList.add('hidden');
}

let _broadcastImageOriginal = null;   // gambar asli (sebelum ditempel SVG)

function removeBroadcastImage(e) {
    if (e) e.stopPropagation();
    _broadcastImageBase64 = null;
    _broadcastImageOriginal = null;
    document.getElementById('b-image-preview').classList.add('hidden');
    document.getElementById('b-image-preview').src = '';
    document.getElementById('b-image-placeholder').classList.remove('hidden');
    document.getElementById('b-image-remove').classList.add('hidden');
    document.getElementById('b-image-edit').classList.add('hidden');
}

const BROADCAST_TAGS = [
    // TAG 
    { key:'WHALE ALERT',  label:'WHALE ALERT',  emoji:'🐋', color:'var(--danger)' },
    { key:'BIG',          label:'BIG',          emoji:'🔥', color:'var(--danger)' },
    { key:'INSIGHT',      label:'INSIGHT',      emoji:'💡', color:'var(--danger)' },
    { key:'JUST IN',      label:'JUST IN',      emoji:'⚡', color:'var(--danger)' },
    { key:'NEW',          label:'NEW',          emoji:'🔔', color:'var(--danger)' },
    { key:'BREAKING',     label:'BREAKING',     emoji:'🔴', color:'var(--danger)' },
    { key:'ALERT',        label:'ALERT',        emoji:'🚨', color:'var(--danger)' },
    { key:'UPDATE ',      label:'UPDATE ',      emoji:'🔄', color:'var(--danger)' },
    { key:'MARKET',       label:'MARKET',       emoji:'📊', color:'var(--danger)' },
    { key:'ANNOUNCEMENT', label:'ANNOUNCEMENT', emoji:'📢', color:'var(--danger)' },
    { key:'LATEST',       label:'LATEST',       emoji:'⏳',  color:'var(--danger)' },
    { key:'INTERESTING',  label:'INTERESTING ', emoji:'🌐', color:'var(--danger)' },
];
let _activeBroadcastTag = null;

function renderBroadcastTags() {
    const row = document.getElementById('b-tag-row');
    if (!row) return;
    row.innerHTML = BROADCAST_TAGS.map(t => `
        <button type="button" class="btag ${_activeBroadcastTag === t.key ? 'active' : ''}" data-key="${t.key}" style="--tag-color:${t.color}">
            <span class="dot" style="background:${t.color}"></span>${t.emoji} ${esc(t.label)}
        </button>
    `).join('');
    row.querySelectorAll('.btag').forEach(btn => {
        btn.onclick = () => applyBroadcastTag(btn.dataset.key);
    });
}

function applyBroadcastTag(key) {
    const tag = BROADCAST_TAGS.find(t => t.key === key);
    if (!tag) return;
    const input = document.getElementById('b-title'); // ganti ke 'b-desc' kalau mau nempel ke deskripsi
    if (!input) return;

    // buang prefix tag lama dulu biar gak numpuk pas ganti-ganti tag
    let current = input.value;
    BROADCAST_TAGS.forEach(t => {
        const prefix = `${t.emoji} ${t.label}: `;
        if (current.startsWith(prefix)) current = current.slice(prefix.length);
    });

    if (_activeBroadcastTag === key) {
        _activeBroadcastTag = null; // klik tag yang sama -> lepas
        input.value = current;
    } else {
        _activeBroadcastTag = key;
        input.value = `${tag.emoji} ${tag.label}: ${current}`;
    }
    renderBroadcastTags();
    input.focus();
}
document.getElementById('b-image-paste').addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            const reader = new FileReader();
            reader.onload = () => {
    _broadcastImageBase64 = reader.result;
    _broadcastImageOriginal = reader.result;
    const preview = document.getElementById('b-image-preview');
    preview.src = _broadcastImageBase64;
    preview.classList.remove('hidden');
    document.getElementById('b-image-placeholder').classList.add('hidden');
    document.getElementById('b-image-remove').classList.remove('hidden');
    document.getElementById('b-image-edit').classList.remove('hidden');
};
            reader.readAsDataURL(blob);
            e.preventDefault();
            break;
        }
    }
});

   // ─── EDITOR GAMBAR: tambah SVG, geser, atur ukuran, lalu digabung ke gambar ───
const IE_LOGO_URL = '/ourbit-cmic.svg';
const IE_SNAP = 0.015;                      // jarak tarik snap (1.5% dari gambar)
const IE_TARGETS = [0, 1/3, 0.5, 2/3, 1];   // tepi, sepertiga, tengah
const ie = { layers: [], sel: null, drag: null };
const ieEl = (id) => document.getElementById(id);
const iePct = (v) => String(Math.round(v * 1000) / 10);
const ieClamp = (v, a, b) => Math.min(b, Math.max(a, v));
ieEl('b-image-edit').innerHTML = icon('edit');
ieEl('ie-close-btn').innerHTML = icon('x');

// grid patokan (dibangun sekali)
(function ieBuildGuides() {
    let h = '';
    for (let p = 10; p <= 90; p += 10) {
        const c = p === 50 ? ' c' : '';
        h += `<i class="ie-gv${c}" style="left:${p}%"></i><i class="ie-gh${c}" style="top:${p}%"></i>`
           + `<span class="ie-gl x" style="left:${p}%">${p}</span><span class="ie-gl y" style="top:${p}%">${p}</span>`;
    }
    h += '<i class="ie-gv t" style="left:33.333%"></i><i class="ie-gv t" style="left:66.667%"></i>'
       + '<i class="ie-gh t" style="top:33.333%"></i><i class="ie-gh t" style="top:66.667%"></i>';
    ieEl('ie-guides').innerHTML = h;
})();
ieEl('ie-grid').addEventListener('change', e => ieEl('ie-guides').classList.toggle('off', !e.target.checked));

function ieLoad(src) {
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
}
// tinggi logo sebagai fraksi tinggi gambar
function ieHf(L) {
    const r = ieEl('ie-stage').getBoundingClientRect();
    return r.height ? (L.wf * r.width / L.ar) / r.height : 0;
}

function ieLayout(L) {
    const s = L.el.style;
    s.left = (L.x * 100) + '%'; s.top = (L.y * 100) + '%'; s.width = (L.wf * 100) + '%';
    L.el.dataset.info = `${iePct(L.wf)}% · X ${iePct(L.x)} · Y ${iePct(L.y)}`;
    if (L === ie.sel) ieSync();
}

// isi kolom angka + keterangan sisa jarak
function ieSync() {
    const L = ie.sel, ro = ieEl('ie-readout');
    ['ie-x', 'ie-y', 'ie-w', 'ie-size', 'ie-preset'].forEach(id => { ieEl(id).disabled = !L; });
    if (!L) { ro.textContent = 'Klik logo untuk melihat posisi & ukuran.'; ieEl('ie-size-v').textContent = '–'; return; }
    const hf = ieHf(L);
    const set = (id, v) => { const el = ieEl(id); if (document.activeElement !== el) el.value = iePct(v); };
    set('ie-x', L.x); set('ie-y', L.y); set('ie-w', L.wf);
    ieEl('ie-size').value = Math.round(L.wf * 100);
    ieEl('ie-size-v').textContent = iePct(L.wf) + '%';
    ro.innerHTML = `Kiri <b>${iePct(L.x)}%</b> · Atas <b>${iePct(L.y)}%</b> · Lebar <b>${iePct(L.wf)}%</b> · Tinggi <b>${iePct(hf)}%</b><br>`
                 + `Sisa kanan <b>${iePct(1 - L.x - L.wf)}%</b> · Sisa bawah <b>${iePct(1 - L.y - hf)}%</b>`;
}

function ieSelect(L) {
    ie.sel = L;
    ie.layers.forEach(x => x.el.classList.toggle('sel', x === L));
    ieEl('ie-del').disabled = !L;
    ieSync();
}

function ieResize(L, wf) {
    L.wf = ieClamp(wf, 0.05, 1);
    L.x = ieClamp(L.x, 0, Math.max(0, 1 - L.wf));
    L.y = ieClamp(L.y, 0, Math.max(0, 1 - ieHf(L)));
}

// snap: tepi kiri/tengah/kanan logo ke garis patokan terdekat
function ieSnap1(pos, size) {
    let best = null;
    for (const off of [0, size / 2, size]) for (const t of IE_TARGETS) {
        const d = t - (pos + off);
        if (Math.abs(d) <= IE_SNAP && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, t };
    }
    return best;
}
function ieSnapLines(gx, gy) {
    const v = ieEl('ie-snap-v'), h = ieEl('ie-snap-h');
    v.style.display = gx == null ? 'none' : 'block'; if (gx != null) v.style.left = (gx * 100) + '%';
    h.style.display = gy == null ? 'none' : 'block'; if (gy != null) h.style.top = (gy * 100) + '%';
}

function openImageEditor(e) {
    if (e) e.stopPropagation();
    if (!_broadcastImageOriginal) return;
    ie.layers = []; ie.sel = null; ie.drag = null;
    ieEl('ie-stage').querySelectorAll('.ie-logo').forEach(n => n.remove());
    ieSelect(null); ieSnapLines(null, null);
    const base = ieEl('ie-base');
    base.onload = () => {
        const maxW = Math.min(820, window.innerWidth - 90), maxH = window.innerHeight * 0.5;
        const k = Math.min(maxW / base.naturalWidth, maxH / base.naturalHeight, 1);
        base.style.width = Math.round(base.naturalWidth * k) + 'px';
        base.style.height = Math.round(base.naturalHeight * k) + 'px';
    };
    base.src = _broadcastImageOriginal;
    ieEl('image-edit-modal').classList.remove('hidden');
}
function closeImageEditor() { ieEl('image-edit-modal').classList.add('hidden'); }

async function ieAddLogo(src) {
    let probe;
    try { probe = await ieLoad(src); } catch { showToast('SVG gagal dimuat: ' + src, 'error'); return; }
    const L = { src, ar: probe.naturalWidth / probe.naturalHeight, x: 0.05, y: 0.05, wf: 0.4 };
    const el = document.createElement('div');
    el.className = 'ie-logo';
    el.innerHTML = `<img src="${src}" alt="" draggable="false">`;
    L.el = el;
    ieEl('ie-stage').appendChild(el);
    ie.layers.push(L);
    ieLayout(L); ieSelect(L);

    el.addEventListener('pointerdown', ev => {
        ieSelect(L);
        ie.drag = { L, sx: ev.clientX, sy: ev.clientY, x0: L.x, y0: L.y, r: ieEl('ie-stage').getBoundingClientRect() };
        el.setPointerCapture(ev.pointerId);
        ev.preventDefault();
    });
    el.addEventListener('pointermove', ev => {
        const d = ie.drag; if (!d || d.L !== L) return;
        const hf = (L.wf * d.r.width / L.ar) / d.r.height;
        let nx = d.x0 + (ev.clientX - d.sx) / d.r.width;
        let ny = d.y0 + (ev.clientY - d.sy) / d.r.height;
        let gx = null, gy = null;
        if (ieEl('ie-snapon').checked && !ev.altKey) {
            const bx = ieSnap1(nx, L.wf), by = ieSnap1(ny, hf);
            if (bx) { nx += bx.d; gx = bx.t; }
            if (by) { ny += by.d; gy = by.t; }
        }
        L.x = ieClamp(nx, 0, Math.max(0, 1 - L.wf));
        L.y = ieClamp(ny, 0, Math.max(0, 1 - hf));
        ieSnapLines(gx, gy);
        ieLayout(L);
    });
    const end = () => { ie.drag = null; ieSnapLines(null, null); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
}

function ieDelete() {
    const L = ie.sel; if (!L) return;
    L.el.remove();
    ie.layers = ie.layers.filter(x => x !== L);
    ieSelect(null);
}

// slider + kolom angka
ieEl('ie-size').addEventListener('input', e => {
    const L = ie.sel; if (!L) return;
    ieResize(L, +e.target.value / 100); ieLayout(L);
});
const ieNum = (id, fn) => ieEl(id).addEventListener('input', e => {
    const L = ie.sel, v = parseFloat(e.target.value);
    if (!L || isNaN(v)) return;
    fn(L, v / 100); ieLayout(L);
});
ieNum('ie-x', (L, v) => { L.x = ieClamp(v, 0, Math.max(0, 1 - L.wf)); });
ieNum('ie-y', (L, v) => { L.y = ieClamp(v, 0, Math.max(0, 1 - ieHf(L))); });
ieNum('ie-w', (L, v) => ieResize(L, v));

// posisi cepat (margin 3% dari tepi)
ieEl('ie-preset').addEventListener('change', e => {
    const L = ie.sel; if (!L || !e.target.value) return;
    const [h, v] = e.target.value.split(','), hf = ieHf(L), m = 0.03;
    L.x = h === 'l' ? m : h === 'r' ? 1 - L.wf - m : (1 - L.wf) / 2;
    L.y = v === 't' ? m : v === 'b' ? 1 - hf - m : (1 - hf) / 2;
    L.x = ieClamp(L.x, 0, Math.max(0, 1 - L.wf)); L.y = ieClamp(L.y, 0, Math.max(0, 1 - hf));
    ieLayout(L);
    e.target.value = '';
});

// panah keyboard = geser halus
document.addEventListener('keydown', e => {
    const L = ie.sel;
    if (!L || ieEl('image-edit-modal').classList.contains('hidden') || e.target.matches('input,select,textarea')) return;
    const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!k) return;
    e.preventDefault();
    const st = e.shiftKey ? 0.05 : 0.005;
    L.x = ieClamp(L.x + k[0] * st, 0, Math.max(0, 1 - L.wf));
    L.y = ieClamp(L.y + k[1] * st, 0, Math.max(0, 1 - ieHf(L)));
    ieLayout(L);
});

ieEl('ie-stage').addEventListener('pointerdown', e => { if (e.target === ieEl('ie-base')) ieSelect(null); });
ieEl('ie-file').addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) ieAddLogo(URL.createObjectURL(f));
    e.target.value = '';
});

// gabungkan gambar asli + semua SVG jadi satu gambar → dipakai sendBroadcast()
async function applyImageEditor() {
    const base = ieEl('ie-base');
    const c = document.createElement('canvas');
    c.width = base.naturalWidth; c.height = base.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(base, 0, 0);
    try {
        for (const L of ie.layers) {
            const im = await ieLoad(L.src);
            const w = L.wf * c.width;
            ctx.drawImage(im, L.x * c.width, L.y * c.height, w, w / L.ar);
        }
    } catch { showToast('Gagal menggabungkan SVG', 'error'); return; }
    let out = c.toDataURL('image/png');
    if (out.length > 3.5e6) out = c.toDataURL('image/jpeg', 0.9);
    _broadcastImageBase64 = out;
    ieEl('b-image-preview').src = out;
    closeImageEditor();
}
        

async function sendBroadcast() {
    const title = document.getElementById('b-title').value.trim();
    const description = document.getElementById('b-desc').value.trim();
    if (!title) { showToast('Judul wajib diisi!', 'error'); return; }

    const btn = document.getElementById('btn-send-broadcast');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Mengirim...';

        try {
        const data = await postBroadcast({ title, description, image_base64: _broadcastImageBase64 });

        const dOk = data.discord === 'ok', tOk = data.telegram === 'ok';
        if (dOk && tOk) showToast('Terkirim ke Discord & Telegram!', 'success');
        else if (dOk || tOk) showToast(`Terkirim sebagian — Discord: ${data.discord}, Telegram: ${data.telegram}`, 'error');
        else throw new Error(`Discord: ${data.discord} | Telegram: ${data.telegram}`);

        closeBroadcastModal();
    } catch (e) {
        showToast('Gagal kirim: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = icon('send') + 'Kirim';
    }
}

        // ─── OURBIT PROMO (quick send ke Discord & Telegram) ───
const WEEX_TITLE = '🚨 CMIC × OURBIT | TRADE SMARTER, PAY LESS';
const WEEX_BODY = `Masih cari platform trading dengan fee kompetitif + minimum deposit rendah?
Mungkin ini bisa jadi salah satu opsi yang kamu cek.

🔥 OURBIT FEATURES

💰 Deposit mulai $1

💸 Withdrawal mulai $1

📊 Fee mulai 0,02% Maker | 0,04% Taker

🌎 Akses global & likuiditas tinggi

⚡ Proses trading cepat & praktis

🎧 Support 24/7

Buat yang sering trading, biaya transaksi juga bagian dari strategi.
Semakin efisien biaya, semakin banyak ruang untuk mengatur posisi.
🎯 Ready to trade smarter?

🔗 REGISTER OURBIT
https://www.ourbit.com/register?inviteCode=ourbitCMIC

OURBIT × CMIC
Trade smart. Manage risk. DYOR.`;

const weexModal = document.getElementById('weex-modal');
document.getElementById('weex-close-btn').innerHTML = icon('x');
document.getElementById('weex-preview').textContent = WEEX_TITLE + '\n\n' + WEEX_BODY;

document.getElementById('btnWeexPromo').onclick = () => { if (isMember()) return; weexModal.classList.remove('hidden'); };
document.getElementById('weex-close-btn').onclick = () => weexModal.classList.add('hidden');
document.getElementById('weex-cancel-btn').onclick = () => weexModal.classList.add('hidden');

async function urlToDataUrl(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('Gambar tidak ditemukan: ' + url);
    const blob = await r.blob();
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
    });
}
        
document.getElementById('weex-send-btn').onclick = async () => {
    const btn = document.getElementById('weex-send-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Mengirim...';
    try {
               const img = await urlToDataUrl('/ourbit-promo.png');
        const data = await postBroadcast({ title: WEEX_TITLE, description: WEEX_BODY, image_base64: img, mention_everyone: true });

        const dOk = data.discord === 'ok', tOk = data.telegram === 'ok';
        if (dOk && tOk) showToast('Terkirim ke Discord & Telegram!', 'success');
        else if (dOk || tOk) showToast(`Terkirim sebagian — Discord: ${data.discord}, Telegram: ${data.telegram}`, 'error');
        else throw new Error(`Discord: ${data.discord} | Telegram: ${data.telegram}`);

        weexModal.classList.add('hidden');
    } catch (e) {
        showToast('Gagal kirim: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = icon('send') + 'Kirim';
    }
};
