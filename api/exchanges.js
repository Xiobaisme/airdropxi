/**
 * AirdropXI Intelligence - Exchange Logic
 * Real-time CEX/DEX Data Integration
 */

let currentLang = 'id';
let isDark = true;
window.currentTabType = 'cex';

const translations = {
    id: {
        back: "Kembali ke Beranda",
        title: "Pasar Bursa",
        subtitle: "Data Real-Time Bursa Cryptocurrency",
        loading: "MENYINKRONKAN DATA PASAR...",
        jurisdiction: "Yurisdiksi",
        vol: "Volume 24J",
        score: "Skor",
        dyor: "DYOR: Konten hanya untuk tujuan edukasi."
    },
    en: {
        back: "Back to Home",
        title: "Exchange Markets",
        subtitle: "Real-time Cryptocurrency Exchange Data",
        loading: "SYNCING MARKET DATA...",
        jurisdiction: "Jurisdiction",
        vol: "Vol 24H",
        score: "Score",
        dyor: "DYOR: Content for educational purposes only."
    }
};

function toggleLang() {
    currentLang = currentLang === 'id' ? 'en' : 'id';
    document.getElementById('btn-lang').innerText = currentLang === 'id' ? 'EN' : 'ID';
    updateLabels();
    loadExchanges(window.currentTabType);
}

function updateLabels() {
    const t = translations[currentLang];
    document.getElementById('txt-back').innerText = t.back;
    document.getElementById('main-title').innerText = t.title;
    document.getElementById('sub-title').innerText = t.subtitle;
    if(document.getElementById('txt-loading')) document.getElementById('txt-loading').innerText = t.loading;
}

function toggleTheme() {
    isDark = !isDark;
    document.body.classList.toggle('light-mode');
    document.getElementById('btn-theme').innerText = isDark ? '🌙' : '☀️';
}

async function loadExchanges(type = 'cex') {
    window.currentTabType = type;
    const container = document.getElementById('exchanges-container');
    const tCex = document.getElementById('tab-cex');
    const tDex = document.getElementById('tab-dex');

    // Update Tab UI
    const activeClass = "px-8 py-2 bg-green-500 text-black text-[10px] font-bold uppercase rounded-full shadow-lg transition";
    const inactiveClass = "px-8 py-2 border border-zinc-800 text-zinc-500 text-[10px] font-bold uppercase rounded-full hover:border-green-500 transition";
    
    tCex.className = type === 'cex' ? activeClass : inactiveClass;
    tDex.className = type === 'dex' ? activeClass : inactiveClass;

    try {
        // Panggil api/exchanges.js untuk CEX, direct CoinGecko untuk DEX
        const url = type === 'cex' ? '/api/exchanges' : 'https://api.coingecko.com/api/v3/exchanges?per_page=20';
        const response = await fetch(url);
        const data = await response.json();

        let html = `
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="text-[9px] text-zinc-600 uppercase tracking-[0.2em] border-b border-zinc-800/50">
                            <th class="p-6">#</th>
                            <th class="p-6">Exchange</th>
                            <th class="p-6 text-right">${translations[currentLang].vol}</th>
                            <th class="p-6 text-center">${translations[currentLang].score}</th>
                            <th class="p-6 text-right">${translations[currentLang].jurisdiction}</th>
                        </tr>
                    </thead>
                    <tbody class="text-[11px] font-bold uppercase tracking-tight">
        `;

        data.forEach((ex, i) => {
            html += `
                <tr class="border-b border-zinc-900/30 hover:bg-green-500/5 transition group">
                    <td class="p-6 text-zinc-700 font-mono text-[10px]">${i+1}</td>
                    <td class="p-6 flex items-center gap-4">
                        <img src="${ex.image}" class="w-6 h-6 rounded-full grayscale group-hover:grayscale-0 transition duration-500">
                        <span class="text-zinc-200 group-hover:text-green-500 transition">${ex.name}</span>
                    </td>
                    <td class="p-6 text-right text-green-500 font-mono text-[10px]">
                        ${ex.trade_volume_24h_btc.toLocaleString(undefined, {maximumFractionDigits: 2})} <span class="text-[8px] opacity-50">BTC</span>
                    </td>
                    <td class="p-6 text-center">
                        <span class="border border-zinc-800 px-3 py-1 rounded text-[9px] group-hover:border-green-500/50 transition">
                            ${ex.trust_score || '?'}/10
                        </span>
                    </td>
                    <td class="p-6 text-right text-zinc-500 font-light italic normal-case">${ex.country || 'Global'}</td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `<div class="p-20 text-red-500 text-center text-[10px] font-mono tracking-tighter">DATA FETCH ERROR: RECHECK API CONNECTION</div>`;
    }
}

function switchTab(type) { loadExchanges(type); }

document.addEventListener('DOMContentLoaded', () => {
    updateLabels();
    loadExchanges('cex');
});
