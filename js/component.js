document.addEventListener('DOMContentLoaded', () => {
    renderNavbar();
});

function renderNavbar() {
    const navbarHTML = `
    <nav class="glass-nav sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-16">
                <div class="flex-shrink-0 cursor-pointer flex items-center gap-3" onclick="window.location.href='index.html'">
                    <img src="logo.png" alt="Logo" class="w-8 h-8 object-contain rounded-full border border-primary/50">
                    <h1 class="text-3xl font-black text-white tracking-widest hidden sm:block">AIRDROP<span class="text-primary">XI</span></h1>
                </div>
                <div class="flex items-center space-x-4">
                    <div class="hidden lg:flex space-x-4 items-center">
                        <a href="index.html" class="text-gray-300 hover:text-primary px-3 py-2 text-sm font-medium transition">Home</a>
                        <a href="index.html#airdrops" class="text-gray-300 hover:text-primary px-3 py-2 text-sm font-medium transition">Airdrops</a>
                        <a href="docs.html" class="bg-primary/20 text-primary border border-primary px-4 py-2 rounded-md text-sm font-bold animate-pulse">Intel Archive</a>
                        <a href="index.html#security" class="text-gray-300 hover:text-danger px-3 py-2 text-sm font-medium transition flex items-center gap-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg> Security
                        </a>
                    </div>
                    <!-- Tombol Mobile dll bisa ditambahkan di sini -->
                </div>
            </div>
        </div>
    </nav>`;

    const container = document.getElementById('navbar-container');
    if (container) {
        container.innerHTML = navbarHTML;
    }
}
