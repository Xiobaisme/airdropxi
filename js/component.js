document.addEventListener('DOMContentLoaded', () => {
    renderNavbar();
    renderFooter();
});

function renderNavbar() {
    const navHTML = `
    <nav class="bg-[#0B0E14]/90 backdrop-blur-md border-b border-primary/20 sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div class="flex items-center gap-2 cursor-pointer" onclick="window.location.href='index.html'">
                <img src="logo.png" class="w-8 h-8 rounded-full border border-primary/50">
                <span class="text-xl font-black text-white tracking-tighter">AIRDROP<span class="text-primary">XI</span></span>
            </div>
            <div class="hidden md:flex gap-6 items-center">
                <a href="index.html" class="text-xs font-bold text-gray-400 hover:text-primary transition uppercase tracking-widest">Home</a>
                <a href="docs.html" class="text-xs font-bold px-4 py-2 bg-primary/10 border border-primary/50 rounded-lg text-primary hover:bg-primary hover:text-black transition uppercase tracking-widest">Intel Archive</a>
                <button onclick="toggleLanguage()" class="flex items-center gap-1 border border-gray-700 px-2 py-1 rounded text-[10px] bg-gray-900">
                    <span id="lang-text">EN</span>
                </button>
            </div>
        </div>
    </nav>`;
    const container = document.getElementById('navbar-container');
    if (container) container.innerHTML = navHTML;
}

function renderFooter() {
    const footerHTML = `
    <footer class="bg-[#0B0E14] py-10 border-t border-gray-800">
        <div class="max-w-7xl mx-auto px-4 text-center">
            <p class="text-gray-600 text-[10px] font-mono uppercase tracking-[0.2em]">&copy; 2026 AIRDROPXI. Secure On-Chain Protocol.</p>
        </div>
    </footer>`;
    const container = document.getElementById('footer-container');
    if (container) container.innerHTML = footerHTML;
}
