// ─── ICON LIBRARY (feather-style, currentColor, no emoji) ───
        const ICONS = {
            calculator: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10.01"/><line x1="12" y1="10" x2="12" y2="10.01"/><line x1="16" y1="10" x2="16" y2="10.01"/><line x1="8" y1="14" x2="8" y2="14.01"/><line x1="12" y1="14" x2="12" y2="14.01"/><line x1="16" y1="14" x2="16" y2="14.01"/><line x1="8" y1="18" x2="8" y2="18.01"/><line x1="12" y1="18" x2="12" y2="18.01"/></svg>',
            link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
            plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
            edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
            trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
            externalLink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
            x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
            save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
            rocket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
            hourglass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41a2 2 0 0 0-.59 1.42V22"/><path d="M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41a2 2 0 0 0 .59-1.42V2"/></svg>',
            ghost: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8Z"/></svg>',
            alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
            target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
            box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/></svg>',
            clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
            chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>',
            send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',        
        };
        function icon(name) { return `<span class="icon">${ICONS[name] || ''}</span>`; }

        // ─── STATUS OPTIONS ───
        const STATUS_OPTIONS = ['Active', 'Waitlist', 'Season 1', 'Season 2', 'Season 3', 'Season 4', 'Season 5',
            'Seed Round', 'Private Round', 'Potential', 'Confirmed', 'Testnet', 'Mainnet',
            'Listing / Selesai', 'Ended', 'TBA'
        ];

        const isMember = () => document.body.classList.contains('is-member');

        // ─── STATE ───
        let projects = [];
        let _plFilter = 'all';
        let _editingId = null;

        // ─── HELPERS ───
        function esc(s) {
            return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        // Normalisasi untuk matching status (trim + lowercase), fix bug status ke-reset
        function normStatus(s) {
            return String(s || '').trim().toLowerCase();
        }

        function getStatusClass(s) {
            const l = (s || '').toLowerCase();
            if (l.includes('active') || l.includes('mainnet')) return 'st-a';
            if (l.includes('wait')) return 'st-w';
            if (l.includes('season')) return 'st-s';
            if (l.includes('confirmed') || l.includes('testnet')) return 'st-c';
            if (l.includes('potential')) return 'st-p';
            return 'st-d';
        }

        function showToast(msg, type = 'success') {
            const t = document.getElementById('toast');
            if (!t) return;
            t.innerHTML = icon(type === 'error' ? 'alert' : 'check') + `<span>${esc(msg)}</span>`;
            t.className = `toast ${type} show`;
            clearTimeout(t._hide);
            t._hide = setTimeout(() => t.classList.remove('show'), 3200);
        }

        // ─── CUSTOM CONFIRM MODAL (ganti native confirm()) ───
let _confirmResolve = null;
function showConfirmModal({ title = 'Konfirmasi', message = 'Yakin ingin melanjutkan?', okLabel = 'Ya, Lanjutkan' } = {}) {
    return new Promise(resolve => {
        _confirmResolve = resolve;
        document.getElementById('confirm-icon').innerHTML = icon('alert');
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-msg').textContent = message;
        document.getElementById('confirm-ok-btn').textContent = okLabel;
        document.getElementById('confirm-modal').classList.remove('hidden');
    });
}
function closeConfirmModal(result) {
    document.getElementById('confirm-modal').classList.add('hidden');
    if (_confirmResolve) { _confirmResolve(result); _confirmResolve = null; }
}
document.getElementById('confirm-cancel-btn').onclick = () => closeConfirmModal(false);
document.getElementById('confirm-ok-btn').onclick = () => closeConfirmModal(true);

        // ─── PIN GATE: dipakai semua pengiriman ke Discord/Telegram ───
let _pinResolve = null;
function askSendPin() {
    return new Promise(resolve => {
        _pinResolve = resolve;
        const inp = document.getElementById('pin-input');
        inp.value = '';
        document.getElementById('pin-modal').classList.remove('hidden');
        setTimeout(() => inp.focus(), 50);
    });
}
function closePinModal(val) {
    document.getElementById('pin-modal').classList.add('hidden');
    document.getElementById('pin-input').value = '';
    if (_pinResolve) { _pinResolve(val); _pinResolve = null; }
}
document.getElementById('pin-cancel-btn').onclick = () => closePinModal(null);
document.getElementById('pin-ok-btn').onclick = () =>
    closePinModal(document.getElementById('pin-input').value.trim() || null);
document.getElementById('pin-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('pin-ok-btn').click();
    if (e.key === 'Escape') closePinModal(null);
});

async function postBroadcast(payload) {

    const pin = await askSendPin();
    if (!pin) throw new Error('Dibatalkan, PIN tidak diisi');
    const res = await fetch('/api/admin-airdrop?type=broadcast-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-send-pin': pin },
        body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.discord || data.telegram || `HTTP ${res.status}`);
    return data;
}
      

        // Count-up animation helper (GSAP kalau ada, fallback manual)
        function animateCount(el, target) {
            if (!el) return;
            if (typeof gsap !== 'undefined') {
                const obj = { val: +el.textContent.replace(/,/g,'') || 0 };
                gsap.to(obj, {
                    val: target, duration: 0.9, ease: 'power2.out',
                    onUpdate: () => el.textContent = Math.floor(obj.val).toLocaleString('en-US')
                });
            } else {
                el.textContent = target.toLocaleString('en-US');
            }
        }

document.getElementById('cf-year').textContent = new Date().getFullYear();
