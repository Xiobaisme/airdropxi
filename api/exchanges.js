let currentLang = 'id';
let isDark = true;

const translations = {
    id: {
        back: "Kembali ke Beranda",
        title: "Pasar Bursa",
        subtitle: "Data Bursa Kripto Real-Time",
        jurisdiction: "Yurisdiksi",
        loading: "Sinkronisasi Data Pasar..."
    },
    en: {
        back: "Back to Home",
        title: "Exchange Markets",
        subtitle: "Real-time Cryptocurrency Exchange Data",
        jurisdiction: "Jurisdiction",
        loading: "Syncing Market Data..."
    }
};

function toggleLang() {
    currentLang = currentLang === 'id' ? 'en' : 'id';
    updateLabels();
    loadExchanges(window.currentTabType || 'cex');
}

function updateLabels() {
    document.getElementById('txt-back').innerText = translations[currentLang].back;
    document.getElementById('main-title').innerText = translations[currentLang].title;
    document.getElementById('sub-title').innerText = translations[currentLang].subtitle;
}

function toggleTheme() {
    isDark = !isDark;
    document.body.classList.toggle('light-mode');
    document.getElementById('btn-theme').innerText = isDark ? '🌙' : '☀️';
}

async function loadExchanges(type = 'cex') {
    window.currentTabType = type;
    const container = document.getElementById('exchanges-container');
    
    // Update Tab UI
    const tCex = document.getElementById('tab-cex');
    const tDex = document.getElementById('tab-dex');
    if(type === 'cex') {
        tCex.className = "px-6 py-2 bg-green-500 text-black text-[10px] font-bold uppercase rounded-full shadow-lg";
        tDex.className = "px-6 py-2 border border-zinc-800 text-zinc-500 text-[10px] font-bold uppercase rounded-full";
    } else {
        tDex.className = "px-6 py-2 bg-green-500 text-black text-[10px] font-bold uppercase rounded-full shadow-lg";
        tCex.className = "px-6 py-2 border border-zinc-800 text-zinc-500 text-[10px] font-bold uppercase rounded-full";
    }

    try {
        const url = type === 'cex' ? '/api/exchanges' : 'https://api.coingecko.com/api/v3/exchanges?per_page=15';
        const response = await fetch(url);
        const data = await response.json();

        let html = `
            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead>
                        <tr class="text-[9px] text-zinc-600 uppercase tracking-[0.2em] border-b border-zinc-800/50">
                            <th class="p-5">#</th>
                            <th class="p-5">Exchange</th>
                            <th class="p-5 text-right">Vol 24H</th>
                            <th class="p-5 text-center">Score</th>
                            <th class="p-5 text-right">${translations[currentLang].jurisdiction}</th>
                        </tr>
                    </thead>
                    <tbody class="text-[11px] font-medium">
        `;

        data.forEach((ex, i) => {
            html += `
                <tr class="border-b border-zinc-900/30 hover:bg-green-500/5 transition group">
                    <td class="p-5 text-zinc-700">${i+1}</td>
                    <td class="p-5 flex items-center gap-3">
                        <img src="${ex.image}" class="w-5 h-5 rounded-full grayscale group-hover:grayscale-0 transition">
                        <span class="text-zinc-200 group-hover:text-green-500 font-bold">${ex.name.toUpperCase()}</span>
                    </td>
                    <td class="p-5 text-right text-green-500 font-mono">${ex.trade_volume_24h_btc.toFixed(2)} BTC</td>
                    <td class="p-5 text-center">
                        <span class="border border-zinc-800 px-2 py-0.5 rounded text-[9px]">${ex.trust_score}/10</span>
                    </td>
                    <td class="p-5 text-right text-zinc-500 italic">${ex.country || 'Global'}</td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `<div class="p-10 text-red-500 text-center text-[10px]">FAILED TO FETCH DATA</div>`;
    }
}

function switchTab(type) { loadExchanges(type); }
document.addEventListener('DOMContentLoaded', () => {
    updateLabels();
    loadExchanges('cex');
});
