document.addEventListener('DOMContentLoaded', () => {
    renderNavbar();
    renderFooter();
});

function renderNavbar() {
    const navHTML = `
    <nav class="glass-nav sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-16">
                <div class="flex-shrink-0 cursor-pointer flex items-center gap-3" onclick="window.location.href='index.html'">
                    <img src="logo.png" alt="Logo" class="w-8 h-8 object-contain rounded-full border border-primary/50">
                    <h1 class="text-3xl font-black text-white tracking-widest hidden sm:block">AIRDROP<span class="text-primary">XI</span></h1>
                </div>
                <div class="flex items-center space-x-4">
                    <div class="hidden lg:flex space-x-4 items-center">
                        <a href="index.html#" class="text-gray-300 hover:text-primary px-3 py-2 text-sm font-bold transition" id="nav-home">Home</a>
                        <a href="index.html#airdrops" class="text-gray-300 hover:text-primary px-3 py-2 text-sm font-bold transition" id="nav-list">Airdrops</a>
                        <a href="docs.html" class="bg-primary/20 text-primary border border-primary px-4 py-2 rounded-md text-sm font-bold hover:bg-primary hover:text-black transition">Intel Archive</a>
                        <a href="index.html#categories" class="text-gray-300 hover:text-primary px-3 py-2 text-sm font-bold transition" id="nav-cat">Narratives</a>
                        <a href="index.html#security" class="text-gray-300 hover:text-danger px-3 py-2 text-sm font-bold transition" id="nav-security">Security</a>
                    </div>
                    <button onclick="toggleLanguage()" class="flex items-center space-x-1 border border-gray-600 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1 rounded text-xs transition">
                        <span id="lang-icon">🇺🇸</span> <span id="lang-text">EN</span>
                    </button>
                    <button id="mobile-menu-btn" class="lg:hidden text-primary">
                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                    </button>
                </div>
            </div>
        </div>
    </nav>`;
    const container = document.getElementById('navbar-container');
    if (container) container.innerHTML = navHTML;
}

function renderFooter() {
    const footerHTML = `
    <footer class="bg-[#0B0E14] py-12 text-center border-t border-gray-800">
        <div class="max-w-7xl mx-auto px-4">
            <div class="flex justify-center space-x-6 mb-8">
                <a href="https://x.com/xiobai06" target="_blank" class="text-gray-500 hover:text-white transition transform hover:scale-110"><svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
                <a href="https://t.me/Xiobaiishikii" target="_blank" class="text-gray-500 hover:text-[#229ED9] transition transform hover:scale-110"><svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0z"/></svg></a>
            </div>
            <p class="text-gray-600 text-sm font-mono">&copy; 2026 AIRDROPXI. Designed for Web3 Community.</p>
        </div>
    </footer>`;
    const container = document.getElementById('footer-container');
    if (container) container.innerHTML = footerHTML;
}
