// ═══════════════════════════════════════════════════════════
        // ─── GARAP SCHEDULE WIDGET ───
        // Reminder waktu garap airdrop: dua slot per hari, 13:00 & 19:00 WIB.
        // Widget ini menghitung waktu WIB langsung dari client (Asia/Jakarta),
        // jadi gak butuh backend/API tambahan.
        // ═══════════════════════════════════════════════════════════
        const GARAP_SLOTS = [13, 19]; // jam garap (WIB, 24h)
        const GARAP_WINDOW_MIN = 60;  // dianggap "aktif" selama 60 menit sejak jam slot

        // ─── SESI MARKET (forex, jam dalam UTC) ───
const MARKET_SESSIONS = [
    { id: 'sydney',  label: 'Sesi Sydney',         color: '#1D4ED8', start: 22, end: 7 },
    { id: 'tokyo',   label: 'Sesi Tokyo / Asia',   color: '#8B5CF6', start: 0,  end: 9 },
    { id: 'london',  label: 'Sesi London / Eropa', color: '#38BDF8', start: 8,  end: 17 },
    { id: 'newyork', label: 'Sesi New York / US',  color: '#22C55E', start: 13, end: 22 },
];

function isHourInSession(hourUTC, start, end) {
    if (start < end) return hourUTC >= start && hourUTC < end;
    return hourUTC >= start || hourUTC < end; // sesi yang lewat tengah malam (Sydney)
}

function getActiveMarketSessions(hourUTC) {
    return MARKET_SESSIONS.filter(s => isHourInSession(hourUTC, s.start, s.end));
}

function updateMarketSessionBadge(hourUTC) {
    const dot = document.getElementById('garap-session-dot');
    const label = document.getElementById('garap-session-label');
    if (!dot || !label) return;

    const active = getActiveMarketSessions(hourUTC);
    if (!active.length) {
        dot.style.background = 'var(--text3)';
        label.textContent = 'Market Tutup';
    } else if (active.length > 1) {
        dot.style.background = 'var(--grad)';
        label.textContent = active.map(s => s.label.replace('Sesi ', '')).join(' + ') + ' (Overlap)';
    } else {
        dot.style.background = active[0].color;
        label.textContent = active[0].label;
    }
}

        function getWIBParts() {
            // Ambil waktu WIB (Asia/Jakarta) tanpa bikin objek Date yang salah timezone,
            // cukup ambil komponen jam/menit/detiknya via Intl.
            const fmt = new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Asia/Jakarta',
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
            });
            const parts = fmt.formatToParts(new Date());
            const get = (t) => +parts.find(p => p.type === t).value;
            return { h: get('hour'), m: get('minute'), s: get('second') };
        }
         function getUTCParts() {
            const now = new Date();
            return { h: now.getUTCHours(), m: now.getUTCMinutes(), s: now.getUTCSeconds() };
        }

        function formatHMS(h, m, s) {
            const p = (n) => String(n).padStart(2, '0');
            return `${p(h)}:${p(m)}:${p(s)}`;
        }

        function formatCountdown(totalMinutes) {
            const h = Math.floor(totalMinutes / 60);
            const m = totalMinutes % 60;
            if (h <= 0) return `${m} menit`;
            return `${h} jam ${m} menit`;
        }

        function updateGarapWidget() {
            const { h, m, s } = getWIBParts();
            const nowTimeEl = document.getElementById('garap-now-time');
            if (nowTimeEl) nowTimeEl.textContent = formatHMS(h, m, s);
            const utc = getUTCParts();
    const utcTimeEl = document.getElementById('garap-now-utc');
    if (utcTimeEl) utcTimeEl.textContent = `UTC ${formatHMS(utc.h, utc.m, utc.s)}`;
    updateMarketSessionBadge(utc.h);

            const nowMinutes = h * 60 + m;
            const card = document.getElementById('garap-card');
            const mainEl = document.getElementById('garap-status-main');
            const subEl = document.getElementById('garap-status-sub');
            const clockIconEl = document.getElementById('garap-clock-icon');

            // Cek apakah sekarang lagi dalam window aktif salah satu slot
            let activeSlot = null;
            for (const slot of GARAP_SLOTS) {
                const slotStart = slot * 60;
                const diff = nowMinutes - slotStart;
                if (diff >= 0 && diff < GARAP_WINDOW_MIN) { activeSlot = slot; break; }
            }
            

            // Tandai slot chip mana yang aktif / berikutnya
            GARAP_SLOTS.forEach(slot => {
                const el = document.getElementById(`garap-slot-${slot}`);
                if (el) el.classList.remove('slot-active', 'slot-next');
            });

            if (activeSlot !== null) {
                card.classList.add('is-active');
                if (clockIconEl) clockIconEl.innerHTML = icon('rocket');
                const remain = (activeSlot * 60 + GARAP_WINDOW_MIN) - nowMinutes;
                mainEl.textContent = `Sekarang jam ${String(activeSlot).padStart(2,'0')}:00 WIB — waktunya garap airdrop!`;
                subEl.innerHTML = `Sisa <b>${remain} menit</b> di window ini.`;
                const activeEl = document.getElementById(`garap-slot-${activeSlot}`);
                if (activeEl) activeEl.classList.add('slot-active');
            } else {
                card.classList.remove('is-active');
                if (clockIconEl) clockIconEl.innerHTML = icon('clock');

                // Cari slot berikutnya (hari ini, atau slot pertama besok kalau semua sudah lewat)
                let nextSlot = GARAP_SLOTS.find(slot => slot * 60 > nowMinutes);
                let minutesUntil;
                if (nextSlot !== undefined) {
                    minutesUntil = nextSlot * 60 - nowMinutes;
                } else {
                    nextSlot = GARAP_SLOTS[0];
                    minutesUntil = (24 * 60 - nowMinutes) + nextSlot * 60;
                }

                mainEl.textContent = `Garap berikutnya jam ${String(nextSlot).padStart(2,'0')}:00 WIB`;
                subEl.innerHTML = `${formatCountdown(minutesUntil)} lagi.`;
                const nextEl = document.getElementById(`garap-slot-${nextSlot}`);
                if (nextEl) nextEl.classList.add('slot-next');
            }
        }

        let _garapInterval = null;
        function startGarapWidget() {
            if (document.getElementById('garap-clock-icon')) {
                document.getElementById('garap-clock-icon').innerHTML = icon('clock');
            }
            updateGarapWidget();
            clearInterval(_garapInterval);
            _garapInterval = setInterval(updateGarapWidget, 1000);
        }
