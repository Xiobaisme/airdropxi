/**
 * AirdropXI Intelligence - Exchange Logic
 * Optimized for Supabase & Vercel
 */

window.currentTab = 'cex';

async function loadExchanges(type) {
    const container = document.getElementById('exchanges-container');
    window.currentTab = type;

    // 1. Tampilkan Loading State & Bersihkan Pesan Error Sebelumnya
    container.innerHTML = `
        <div class="py-32 text-center">
            <div class="inline-block w-4 h-4 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin mb-4"></div>
            <div class="text-zinc-600 text-[10px] uppercase tracking-widest animate-pulse">Menghubungkan ke Supabase...</div>
        </div>
    `;

    // Update Gaya Tab secara Visual
    const btnCex = document.getElementById('tab-cex');
    const btnDex = document.getElementById('tab-dex');
    
    if (type === 'cex') {
        btnCex.className = "tab-active px-8 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all";
        btnDex.className = "border border-zinc-800 text-zinc-500 px-8 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:border-green-400 transition-all";
    } else {
        btnDex.className = "tab-active px-8 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all";
        btnCex.className = "border border-zinc-800 text-zinc-500 px-8 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:border-green-400 transition-all";
    }

    try {
        // 2. Ambil Data dari API
        const response = await fetch(`/api/exchanges?type=${type}`);
        
        if (!response.ok) {
            throw new Error(`HTTP Error! Status: ${response.status}`);
        }

        const data = await response.json();

        // 3. Cek Jika Data Kosong
        if (!data || data.length === 0) {
            container.innerHTML = `<div class="py-32 text-center text-zinc-600 text-[10px] uppercase tracking-widest">Belum ada data ${type.toUpperCase()} di database</div>`;
            return;
        }

        // 4. Susun Header Tabel
        let html = `
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="text-[9px] text-zinc-600 uppercase tracking-[0.2em] border-b border-zinc-900 bg-zinc-900/20">
                            <th class="p-6">Rank</th>
                            <th class="p-6">Exchange</th>
                            <th class="p-6">Negara Asal</th>
                            <th class="p-6">Kelebihan Utama</th>
                            <th class="p-6">Cocok Untuk</th>
                        </tr>
                    </thead>
                    <tbody class="text-[11px] font-medium italic">
        `;

        // 5. Render Baris Data
        data.forEach((ex) => {
            html += `
                <tr class="border-b border-zinc-900/50 hover:bg-green-500/5 transition group">
                    <td class="p-6 text-zinc-500 font-mono">${ex.rank || '-'}</td>
                    <td class="p-6 flex items-center gap-3">
                        ${ex.logo_url ? 
                            `<img src="${ex.logo_url}" class="w-5 h-5 rounded-full grayscale group-hover:grayscale-0 transition duration-500" onerror="this.src='https://via.placeholder.com/20?text=?'">` 
                            : `<div class="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[8px] text-zinc-600">?</div>`}
                        <span class="text-white border-b border-zinc-800 border-dotted group-hover:text-green-400 transition uppercase tracking-tighter">
                            ${ex.exchange_name}
                        </span>
                    </td>
                    <td class="p-6 text-zinc-400">${ex.country || 'Global'}</td>
                    <td class="p-6 text-zinc-500 leading-relaxed font-light">${ex.key_features || '-'}</td>
                    <td class="p-6">
                        <span class="bg-zinc-900/80 px-3 py-1 rounded border border-zinc-800 text-[9px] text-zinc-300 group-hover:border-green-500/30 transition uppercase">
                            ${ex.best_for || '-'}
                        </span>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;
        
        // 6. Tampilkan Tabel (Menghapus Loading State)
        container.innerHTML = html;

    } catch (error) {
        console.error("Supabase Connection Error:", error);
        // HANYA menampilkan error jika proses di atas gagal total
        container.innerHTML = `
            <div class="py-32 text-center">
                <div class="text-red-500 text-[10px] font-mono uppercase mb-2">Gagal Terhubung ke Database Supabase</div>
                <div class="text-zinc-700 text-[8px] uppercase tracking-widest font-mono">${error.message}</div>
                <button onclick="loadExchanges('${type}')" class="mt-4 px-4 py-2 border border-zinc-800 text-zinc-500 text-[9px] hover:text-white hover:border-white transition-all">COBA LAGI</button>
            </div>
        `;
    }
}

function switchTab(t) {
    loadExchanges(t);
}

// Inisialisasi awal
document.addEventListener('DOMContentLoaded', () => loadExchanges('cex'));
