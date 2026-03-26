document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.docs-link');
    
    // Fungsi untuk memindahkan class 'active' saat menu diklik
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            navLinks.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Opsional: Scroll Spy (Highlight menu otomatis saat di-scroll)
    window.addEventListener('scroll', () => {
        let fromTop = window.scrollY + 150;
        navLinks.forEach(link => {
            let section = document.querySelector(link.hash);
            if (
                section.offsetTop <= fromTop &&
                section.offsetTop + section.offsetHeight > fromTop
            ) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    });
});
