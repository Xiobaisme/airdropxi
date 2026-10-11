# CMIC – Crypto Monkey Inner Circle

Dashboard untuk memantau airdrop, market crypto, berita, dan data onchain, dibuat untuk komunitas Indonesia. Seluruh isinya berada di balik login, jadi halaman utama hanya menampilkan landing page dan kartu login sampai kamu masuk.

Ada dua jenis akun:

- **Admin** (login Google): akses penuh, termasuk mengelola daftar airdrop, Broadcast, OURBIT, dan AI Agent.
- **Member** (login Discord): akses baca ke Market, News Terminal, Onchain, dan Lab Materi.

Menu di navbar setelah login: **Market**, **Airdrop**, **News Terminal**, **Onchain**, **OURBIT**, **Broadcast**, **AI Agent**, dan **Calc**. Tombol **Logout** ada di pojok kanan atas.

---

## Daftar Isi

1. [Akses dan Login](#akses-dan-login)
2. [Tur Dashboard](#tur-dashboard)
3. [Panduan Fitur](#panduan-fitur)
4. [Setup dan Konfigurasi](#setup-dan-konfigurasi)
5. [Struktur Repo](#struktur-repo)
6. [Troubleshooting](#troubleshooting)
7. [Kontak dan Disclaimer](#kontak-dan-disclaimer)

---

## Akses dan Login

Buka halaman utama, lalu pilih salah satu dari dua tombol di kartu "Selamat datang kembali" (atau klik **Login** / **Mulai Gratis** di navbar landing page).

**Login admin (Google)**

1. Klik tombol Google di bawah label **Admin**.
2. Pilih akun Google yang emailnya terdaftar sebagai admin. Email lain ditolak dengan pesan "Email tidak diizinkan".
3. Sesi admin berlaku **7 hari**.

**Login member (Discord)**

1. Klik **Login dengan Discord** di bawah label **Member Discord**.
2. Setujui akses di halaman Discord.
3. Akunmu harus sudah join server komunitas dan punya role yang diizinkan. Sesi member berlaku **12 jam**, lalu role dicek ulang saat login lagi.

Sesi disimpan di cookie, jadi refresh halaman tidak membuatmu keluar. Klik **Logout** untuk mengakhiri sesi.

Jika login Discord gagal, pesan di kartu login menunjukkan penyebabnya:

| Pesan | Artinya | Yang dilakukan |
| --- | --- | --- |
| Akun Discord kamu belum join server. | Akun belum jadi anggota server | Join server komunitas, lalu coba lagi |
| Kamu belum punya role yang diizinkan. | Sudah join, tapi role belum sesuai | Minta role ke admin komunitas |
| Login Discord dibatalkan. | Kamu menutup atau menolak otorisasi | Ulangi dan setujui otorisasi |
| Sesi login kedaluwarsa, coba lagi. | Proses login terlalu lama | Klik tombol Discord sekali lagi |
| Terlalu banyak percobaan, coba lagi sebentar. | Kena batas percobaan login | Tunggu sebentar |
| Login Discord belum dikonfigurasi di server. | Variabel Discord belum diisi di server | Hubungi pemilik web |

Belum punya akses? Di bawah tombol Discord ada tautan **Daftar Gratis** yang mengarah ke profil Discord pemilik web.

---

## Tur Dashboard

Setelah login kamu langsung masuk ke halaman **Market**; menu lain membuka halaman atau panel tambahan di atasnya. Akun member tidak melihat menu Airdrop, OURBIT, Broadcast, dan AI Agent.

| Menu | Yang terbuka | Admin | Member |
| --- | --- | --- | --- |
| Market | Halaman utama: chart, long vs short, likuidasi, heatmap, jadwal unlock | Ya | Ya |
| Airdrop | Daftar proyek airdrop dan formulir tambah/edit | Ya | Tidak |
| News Terminal | Panel berita multi-sumber dengan titik live | Ya | Ya |
| Onchain | Pelacak wallet layar penuh | Ya | Ya |
| OURBIT | Popup "Send sekarang?" untuk promo siap kirim | Ya | Tidak |
| Broadcast | Form kirim pengumuman ke Discord dan Telegram | Ya | Tidak |
| AI Agent | Panel chat AI | Ya | Tidak |
| Calc | Kalkulator melayang | Ya | Ya |
| Logout | Mengakhiri sesi | Ya | Ya |

### Halaman Market

Bar tombol di atas halaman melompat ke tiap bagian: **Live Chart**, **Long vs Short**, **Futures L/S**, **Likuidasi**, **Heatmap 24H**, dan **Jadwal Unlock**.

- **Live Chart**: grafik BTCUSDT.P dibandingkan dengan dominasi BTC (BTC.D) dan USDT (USDT.D). Pilih timeframe lewat tombol di kanan atas kartu.
- **Long vs Short**: taker buy dan taker sell per bursa secara live. Pilih koin (BTC, ETH, SOL, XRP, DOGE, BNB) dan timeframe dari 5m sampai 1d. Baris **All** adalah rata-rata berbobot volume dari semua bursa yang berhasil dimuat.
- **Futures L/S**: tabel Longs vs Shorts untuk banyak koin dari Binance Futures. Klik judul kolom untuk mengurutkan, **Customize** untuk memilih timeframe, dan dropdown ALL / Long dominan / Short dominan untuk menyaring.
- **Likuidasi**: total likuidasi long dan short per bursa dari Coinalyze. Pilih koin dan rentang 1, 4, 12, atau 24 jam, lalu klik **Refresh**.
- **Heatmap 24H**: peta warna futures USDT gabungan Binance, Bybit, OKX, Bitget, dan Gate, diwarnai menurut perubahan harga 24 jam. Tab Volume, Open Interest, dan TradFi mengganti data yang dipetakan. Ada juga gauge **Fear & Greed** di sampingnya.
- **Jadwal Unlock**: tabel unlock token. Filter rentang 7 sampai 90 hari dan tipe Cliff atau Linear. Baris merah berarti unlock sebesar 1% alokasi atau lebih.

### Elemen yang selalu ada

- **NEW**: strip listing baru dari newlistings.pro. Tombol **Semua event** menampilkan semua jenis event, dan **Riwayat lengkap** membuka situsnya.
- **Lab Materi**: tombol melayang di layar yang membuka perpustakaan e-book edukasi.
- Ticker harga crypto berjalan di bagian bawah layar.

---

## Panduan Fitur

### Airdrop Tracker (admin)

Klik **Airdrop** di navbar. Di bagian atas ada ringkasan jumlah proyek (Total, Live, Draft, Confirmed, No Link) dan widget **Garap Schedule**. Di bawahnya ada kartu proyek.

1. Klik **Tambah Proyek**.
2. Isi **Nama Proyek** (wajib), pilih **Status Airdrop**, lalu isi Tags (pisah koma), Total Raised versi ID dan EN, deskripsi ID dan EN, serta Link Official.
3. Klik **Tambah**. Kartu baru muncul di daftar.

Status yang tersedia: Active, Waitlist, Season 1 sampai 5, Seed Round, Private Round, Potential, Confirmed, Testnet, Mainnet, Listing / Selesai, Ended, dan TBA.

Untuk memfilter, klik tab **Semua**, **Active**, **Waitlist**, **Ended**, **Confirmed**, **Potential**, **Live**, **Draft**, **Ada Link**, atau **No Link**. Kotak ringkasan di atas daftar juga bisa diklik sebagai filter. Setiap kartu punya tombol **Buka Website**, **Edit** (formulir yang sama dengan Tambah, lalu **Simpan**), dan **Hapus** (meminta konfirmasi "Ya, Hapus").

> Catatan: di kode repo saat ini fitur ini mengembalikan pesan maintenance, lihat [Troubleshooting](#troubleshooting).

### Garap Schedule

Widget di halaman Airdrop yang menampilkan jam WIB dan UTC, hitung mundur ke slot garap airdrop pukul **13:00** dan **19:00 WIB**, serta sesi pasar forex yang sedang aktif (Sydney, Tokyo, London, New York). Slot dianggap aktif selama 60 menit sejak jamnya.

### News Terminal

Klik **News Terminal** untuk membuka panel layar penuh.

- Ikon dan chip sumber di atas feed menyaring berita per sumber, misalnya Lookonchain, Whale Alert, Cointelegraph, Wu Blockchain, Nansen, REKT, dan Upbit (TG). Pilih **All** untuk semua sumber.
- Feed memeriksa berita baru tiap 30 detik. Tombol **REFRESH** di bawah memuat ulang seketika.
- Strip **NEW** berisi listing baru dan event bursa. Tombol **Semua event** memperluas jenis event yang tampil.
- Waktu tiap berita ditampilkan dalam WIB, dan tautan di dalam berita bisa diklik. Tutup panel dengan tombol silang di pojok.
- Admin melihat tombol **Kirim** di tiap berita. Klik, edit caption di popup "Send sekarang?", lalu **Kirim** dan masukkan PIN untuk meneruskannya ke Discord dan Telegram. Item yang sudah terkirim ditandai "Terkirim".

### Onchain Tracer

Klik **Onchain** untuk membuka layar penuh.

1. Tempel alamat wallet (EVM `0x...`, Bitcoin `bc1...`, atau alamat Solana).
2. Pilih jaringan di dropdown. Pilihannya mencakup puluhan chain EVM L1 dan L2 (Ethereum, BNB Chain, Arbitrum, Base, dan lainnya) plus Solana dan Bitcoin.
3. Klik **Lacak**. Diagram aliran dana, tabel **Aset Wallet**, dan tabel **Transaksi** muncul.
4. Scroll untuk zoom, drag untuk menggeser, tombol **Fit** untuk pas layar. Klik sebuah node untuk menelusuri wallet itu, dan klik label panah untuk membuka transaksinya di explorer.
5. Centang **Sembunyikan dust** untuk menyembunyikan transfer bernilai sangat kecil.

Panel **Live Transfers** di kiri menampilkan transfer besar secara langsung. Pilih mode **Semua**, **Whale ≥ $1M**, atau **Bertag**, atur nilai minimal ($100 ribu sampai $1 juta, bawaan $250 ribu), dan cari berdasarkan alamat, ENS, token, atau hash. Tombol Live menjeda dan melanjutkan aliran.

### Broadcast (admin)

Kirim satu pengumuman ke Discord dan Telegram sekaligus.

1. Klik **Broadcast**.
2. Isi **Judul** (wajib). Klik salah satu **Quick Tags** seperti WHALE ALERT, BREAKING, atau ANNOUNCEMENT untuk menempelkannya ke judul; klik tag yang sama lagi untuk melepasnya.
3. Tulis **Deskripsi**.
4. Untuk gambar, klik kotak putus-putus lalu tekan **Ctrl+V** untuk menempel dari clipboard. Tombol edit di pojok gambar membuka editor untuk menambah logo OURBIT × CMIC atau SVG lain, menggeser, mengubah ukuran, dan menempel ke grid, lalu **Terapkan**.
5. Klik **Kirim**, masukkan **PIN**, dan klik **Verifikasi**. PIN diminta pada setiap pengiriman.

### OURBIT (admin)

Tombol **OURBIT** membuka popup "Send sekarang?" berisi pratinjau pesan promo OURBIT × CMIC yang sudah jadi. Klik **Kirim** (dengan PIN) untuk mengirimnya ke Discord dan Telegram, atau **Batal** untuk menutup.

### AI Agent (admin)

Klik **AI Agent** (label BETA) untuk membuka panel chat.

- Baris **Agent** memilih model: Claude Opus 5, Claude Opus 4.8, GPT 5.6, Llama 3.1 8B, atau **Auto** yang memilih yang tercepat. Tiap model punya riwayat chat sendiri, jadi berpindah model tidak menghapus chat model lain.
- Baris **Mode** memilih **Chat**, **Code**, atau **Gambar**. Mode gambar menerima lampiran lewat ikon penjepit.
- Tulis pesan, tekan **Enter** untuk kirim dan **Shift+Enter** untuk baris baru. **Chat baru** hanya mereset chat model yang sedang aktif.
- Jika satu penyedia gagal, server mencoba penyedia lain secara otomatis. Bila semua gagal, panel menampilkan pesan error.

### Calc

**Calc** membuka kalkulator melayang di layar; klik tombol silang untuk menutup.

### Lab Materi

Tombol biru **Lab Materi** di layar membuka perpustakaan. Pilih sebuah kartu untuk membaca e-book per halaman: panah kiri dan kanan berpindah halaman, dropdown melompat ke halaman tertentu, tombol **+**, **−**, dan **1x** mengatur zoom, dan **Buka** membuka berkas di tab baru. Materi yang ada mencakup fundamental crypto, on-chain analysis, strategi trading new listing, candle konfirmasi, cara membaca berita, zine liquidity sweep dan RSI, serta satu video materi teknikal.

---

## Setup dan Konfigurasi

Bagian ini untuk kamu yang menjalankan atau men-deploy salinan sendiri. Repo ini tidak punya build step: frontend berupa HTML, CSS, dan JavaScript biasa, dan backend berupa Vercel Serverless Functions di folder `api/`.

### Menjalankan di komputer lokal

Butuh Node.js 18 atau lebih baru dan [Vercel CLI](https://vercel.com/docs/cli).

```bash
git clone <url-repo-ini>
cd <folder-repo>
npm install
vercel dev
```

Buka `http://localhost:3000`. Buat file `.env` sendiri di folder proyek (repo tidak menyertakan `.env.example`) dan isi variabel di bawah. File `.env*` sudah masuk `.gitignore`, jangan pernah di-commit.

Halaman `/` diarahkan ke `admin.html`, dan akses langsung ke `/admin.html` dialihkan balik ke `/` (diatur di `vercel.json`).

### Environment variable

Set di Vercel lewat Project Settings, Environment Variables, atau di `.env` untuk lokal.

| Kelompok | Variabel | Fungsi |
| --- | --- | --- |
| Login dan sesi | `ADMIN_SECRET_KEY` | Kunci penanda tangan cookie sesi. Wajib; tanpanya login Google gagal dengan "Konfigurasi server belum lengkap" |
| Login dan sesi | `ALLOWED_ADMIN_EMAILS` | Email admin untuk login Google, pisah koma. Jika kosong, dipakai satu email bawaan di `api/verify-token.js` |
| Login dan sesi | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | OAuth Discord untuk login member |
| Login dan sesi | `DISCORD_GUILD_ID`, `DISCORD_ROLE_IDS` | Server dan role (pisah koma) yang boleh masuk sebagai member |
| Login dan sesi | `SITE_URL` | Base URL untuk redirect OAuth. Isi dengan domain deploy kamu |
| Database dan cache | `NEXT_PUBLIC_SUPABASE_URL` atau `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase |
| Database dan cache | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis untuk antrean berita, rate limit, dan event listing |
| Data eksternal | `CMC_API_KEY` | CoinMarketCap |
| Data eksternal | `ETHERSCAN_API_KEY` | Etherscan V2 untuk chain EVM di Onchain Tracer |
| Data eksternal | `NODEREAL_API_KEY` | BNB Chain |
| Data eksternal | `HELIUS_API_KEY` | Solana |
| Data eksternal | `COINALYZE_API_KEY` (atau `COINALYZE_API_KEYS`) | Data bagian Likuidasi |
| Data eksternal | `NLF_KEY` | Stream new listing |
| Broadcast | `DISCORD_WEBHOOK_URL` | Webhook tujuan Discord |
| Broadcast | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Bot dan chat tujuan Telegram |
| Broadcast | `SEND_PIN` | PIN yang diminta tiap kali kirim |
| AI Agent | `AGENTROUTER_API_KEY`, `HCNSEC_API_KEY`, `OPENROUTER_API_KEY` | Isi minimal satu; penyedia tanpa key dilewati |
| Cron dan poller | `CRON_SECRET` | Melindungi `/api/cron/fetch-news` |
| Cron dan poller | `ALERT_SECRET` | Header `x-secret` untuk poller yang menulis ke API |

### Poller Telegram (GitHub Actions)

Dua workflow di `.github/workflows/` mengambil data dari channel Telegram memakai Telethon dan berbagi satu sesi, jadi tidak berjalan bersamaan.

- `news-poll.yml` mengisi News Terminal dari channel onchain. Dipicu manual (`workflow_dispatch`), dan menurut komentar di berkasnya dipanggil dari cron-job.org.
- `cexfound.yml` mendeteksi token baru yang masuk bursa, otomatis tiap 5 menit dan bisa dijalankan manual.

Di Settings, Secrets and variables, Actions pada repo GitHub, isi secret `TG_API_ID`, `TG_API_HASH`, `TG_SESSION`, dan `ALERT_SECRET`. Workflow `cexfound.yml` juga membutuhkan `SOURCE_CHANNELS`. Berkas `scripts/news_poll.py` dan `scripts/cexfound_poll.py` adalah skrip yang dijalankannya.

### Deploy

Push ke branch `main` dan Vercel men-deploy otomatis, selama semua environment variable di atas sudah diisi di Vercel. Script `npm run build` hanya placeholder.

---

## Struktur Repo

```
.
├── admin.html              # Entry point dashboard (di-rewrite ke "/")
├── api/
│   ├── admin-airdrop.js    # Router utama: CRUD airdrop, auth, onchain, feed, unlocks, broadcast, CEX found
│   ├── agent-chat.js       # Backend AI Agent (multi-provider + fallback)
│   ├── heatmap.js          # Heatmap futures multi-exchange + Fear & Greed
│   ├── market.js           # Data long/short flow per koin dan timeframe
│   ├── news-queue.js       # Antrean News Terminal (Upstash Redis)
│   ├── verify-token.js     # Verifikasi Google ID token, issue sesi admin
│   └── cron/fetch-news.js  # Penarik berita RSS/CMC/Lookonchain ke Supabase
├── lib/
│   ├── auth.js             # Sign/verify token sesi
│   ├── onchain.js          # Konfigurasi chain dan logika onchain
│   └── server/coinalyze-liq.js
├── js/                     # Modul frontend (airdrop, market, news, onchain, agent, broadcast, lab, dll)
├── css/                    # Stylesheet per modul
├── data/airdrops.json      # Snapshot data airdrop
├── ebook/hasil/            # Materi edukasi (halaman gambar .webp + index.json)
├── scripts/                # Poller Telegram (news_poll.py, cexfound_poll.py)
├── .github/workflows/      # news-poll.yml dan cexfound.yml
└── vercel.json             # Rewrite "/" ke admin.html
```

---

## Troubleshooting

| Gejala | Penyebab | Yang dilakukan |
| --- | --- | --- |
| Daftar Airdrop kosong, atau tambah, edit, hapus gagal dengan pesan "Maintenance: database sedang dipulihkan" (HTTP 503) | Di `api/admin-airdrop.js` flag `MAINTENANCE` bernilai `true`, sehingga semua akses ke Supabase diputus sementara | Ubah ke `false` dan deploy ulang setelah database siap |
| "Akses ditolak: Email tidak diizinkan" saat login Google | Email belum masuk `ALLOWED_ADMIN_EMAILS` | Tambahkan emailnya ke variabel itu di Vercel |
| "Konfigurasi server belum lengkap" saat login Google | `ADMIN_SECRET_KEY` belum diisi | Isi variabel itu lalu deploy ulang |
| Pesan "Khusus admin" (403) | Akun member memanggil fitur yang hanya untuk admin | Login dengan Google admin untuk fitur itu |
| Tiba-tiba kembali ke layar login | Sesi habis (member 12 jam, admin 7 hari) | Login ulang |
| Kirim Broadcast, OURBIT, atau berita terus ditolak | PIN salah, atau variabel `SEND_PIN` belum diisi di server. Lima kali salah mengunci pengiriman 10 menit per alamat IP | Tunggu 10 menit, lalu pastikan PIN sama dengan `SEND_PIN` |
| Broadcast terkirim ke satu tujuan saja | Webhook Discord atau token Telegram belum diisi atau salah | Periksa `DISCORD_WEBHOOK_URL`, `TELEGRAM_BOT_TOKEN`, dan `TELEGRAM_CHAT_ID` |
| AI Agent menjawab "model tidak tersedia" atau akses ditolak | Key penyedia kosong, habis kuota, atau dibatasi | Isi atau ganti key penyedia, atau pindah ke model lain atau **Auto** |
| Onchain Tracer kosong untuk BNB Chain, Solana, atau chain EVM lain | API key chain itu belum diisi | Isi `NODEREAL_API_KEY`, `HELIUS_API_KEY`, atau `ETHERSCAN_API_KEY` |
| Bagian Likuidasi tidak memuat | Key Coinalyze belum diisi | Isi `COINALYZE_API_KEY` |
| News Terminal tidak ada berita baru | Poller Telegram tidak berjalan | Jalankan workflow `news-poll.yml` manual di tab Actions dan cek secret Telegram |
| Tanda `!` pada baris Long vs Short | Satu bursa gagal dimuat | Arahkan kursor ke bar untuk melihat alasannya; baris **All** tetap dihitung dari bursa lain |

Tips penggunaan:

- Data Long vs Short dan Heatmap hanya untuk informasi, bukan saran finansial.
- Angka unlock berasal dari dataset DefiLlama yang tidak resmi; cek ulang ke sumber resmi proyek sebelum mengambil keputusan.
- Jangan pernah membagikan private key atau seed phrase. Onchain Tracer hanya membutuhkan alamat wallet publik.

---

## Kontak dan Disclaimer

- Twitter: [@xiobai06](https://twitter.com/xiobai06)
- Telegram: [@Xiobaii](https://t.me/Xiobaii)
- Discord: komunitas Crypto Monkey

Konten dan data di platform ini hanya untuk tujuan informasi dan edukasi, **bukan saran finansial**. Airdrop dan trading crypto berisiko tinggi, selalu DYOR.