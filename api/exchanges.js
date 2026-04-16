/**
 * Exchanges Logic for AirdropXI
 * Author: XIOBAIISHIKII
 */

let currentTab = 'cex';

async function loadExchanges(type = 'cex') {
    const container = document.getElementById('exchanges-container');
    const btnCex = document.getElementById('btn-cex');
    const btnDex = document.getElementById('btn-dex');

    // 1. Update UI Button States
    if (type === 'cex') {
        btnCex.classList.add('border-green-500', 'text-green-500');
        btnCex.classList.remove('border-transparent', 'text-zinc-500');
        btnDex.classList.add('border-transparent', 'text-zinc-500');
        btnDex.classList.remove('border-green-500', 'text-green-500');
    } else {
        btnDex.classList.add('border-green-500', 'text-green-500');
        btnDex.classList.remove('border-transparent', 'text-zinc-500');
        btnCex.classList.add('border-transparent', 'text-zinc-500');
        btnCex.classList.remove('border-green-500', 'text-green-500');
    }

    // 2. Show Loading State
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20">
            <div class="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p class="text-[10px] text-zinc-500 font-mono tracking-tighter uppercase">Fetching ${type} data...</p>
        </div>
    `;

    try {
        /** * Logic Endpoint:
         * CEX menggunakan Serverless Function (api/exchanges.js)
         * DEX menggunakan direct API CoinGecko (atau Tuan bisa buat api/dex.js nanti)
         */
        const url = type === 'cex' ? '/api/exchanges' : 'https://api.coingecko.com/api/v3/exchanges?per_page=15&page=1';
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();

        // 3. Build Table Structure
        let tableHtml = `
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse cursor-default">
                    <thead>
                        <tr class="bg-zinc-900/40 text-[10px] text-zinc-500 uppercase tracking-widest border-b border-zinc-800">
                            <th class="p-4">#</th>
                            <th class="p-4 font-medium">Name</th>
                            <th class="p-4 text-right font-medium uppercase">Adj. Vol (24h)</th>
                            <th class="p-4 text-center font-medium uppercase">Trust</th>
                            <th class="p-4 font-medium uppercase">Jurisdiction</th>
                        </tr>
                    </thead>
                    <tbody class="text-[11px] md:text-xs text-zinc-300">
        `;

        // 4. Map Data to Rows
        data.forEach((ex, index) => {
            const volume = ex.trade_volume_24h_btc ? ex.trade_volume_24h_btc.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00';
            const trustColor = ex.trust_score >= 8 ? 'text-green-500' : (ex.trust_score >= 5 ? 'text-yellow-500' : 'text-red-500');
            
            tableHtml += `
                <tr class="border-b border-zinc-900/50 hover:bg-zinc-500/5 transition-all group">
                    <td class="p-4 text-zinc-600 font-mono">${index + 1}</td>
                    <td class="p-4 flex items-center gap-3">
                        <img src="${ex.image}" class="w-5 h-5 rounded-full filter grayscale group-hover:grayscale-0 transition-all shadow-sm">
                        <span class="font-bold text-zinc-200 uppercase tracking-tight">${ex.name}</span>
                    </td>
                    <td class="p-4 text-right text-green-400 font-mono">
                        ${volume} <span class="text-[9px] text-zinc-600">BTC</span>
                    </td>
                    <td class="p-4 text-center">
                        <span class="px-2 py-0.5 rounded-sm bg-zinc-900/80 border border-zinc-800 text-[9px] ${trustColor}">
                            ${ex.trust_score || 'N/A'}/10
                        </span>
                    </td>
                    <td class="p-4 text-zinc-500 italic font-light">
                        ${ex.country || (type === 'dex' ? 'Decentralized' : 'International')}
                    </td>
                </tr>
            `;
        });

        tableHtml += `</tbody></table></div>`;
        container.innerHTML = tableHtml;

    } catch (error) {
        console.error("AirdropXI Error:", error);
        container.innerHTML = `
            <div class="py-20 text-center">
                <p class="text-red-500 font-mono text-[10px] uppercase">Gagal memuat data market.</p>
                <button onclick="loadExchanges('${type}')" class="mt-4 text-[9px] text-zinc-500 underline uppercase hover:text-green-500">Retry Connection</button>
            </div>
        `;
    }
}

// Global Switch Function
window.switchTab = function(type) {
    if (currentTab === type) return;
    currentTab = type;
    loadExchanges(type);
};

// Auto Start
document.addEventListener('DOMContentLoaded', () => {
    loadExchanges('cex');
});
