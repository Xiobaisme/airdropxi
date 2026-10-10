# AirdropXI

Platform tracking airdrop crypto dan informasi Web3 untuk komunitas Indonesia, dibangun oleh **Xiobaiishikii**. Satu dashboard (CMIC – Crypto Monkey Inner Circle) yang menggabungkan daftar airdrop, market live, news terminal, onchain tracer, materi edukasi, dan AI Agent.

🌐 **Live:** [airdropxi.vercel.app](https://airdropxi.vercel.app)

> Halaman utama (`/`) di-rewrite ke `admin.html` dan berada di balik login. Admin masuk lewat Google, member komunitas masuk lewat Discord.

---

## Fitur

| Modul | Deskripsi |
|-------|-----------|
| **Airdrop Tracker** | Daftar proyek airdrop (status, raised, backers, tag, task ID/EN, link testnet), dikelola lewat panel admin dengan CRUD penuh. |
| **Market Dashboard** | Long vs Short live (WebSocket + `/api/market`), heatmap futures gabungan Binance, Bybit, OKX, Bitget, Gate, plus Fear & Greed Index. |
| **News Terminal** | Feed berita multi-sumber (Telegram publik, RSS, Lookonchain, CoinMarketCap), terjemahan otomatis ke Bahasa Indonesia, retensi 3 hari. |
| **Onchain Tracer** | Pelacak wallet fullscreen dengan pan/zoom untuk EVM, Solana, dan Bitcoin (31 chain terkonfigurasi di `lib/onchain.js`). |
| **Token Unlocks** | Jadwal unlock token untuk daftar proyek pilihan. |
| **CEX Found / New Listing Feed** | Deteksi token baru dari channel Telegram sumber dan stream new-listing, disimpan di Redis. |
| **Broadcast** | Kirim satu pengumuman (teks + gambar dari clipboard) sekaligus ke Discord dan Telegram. |
| **AI Agent** | Panel chat dengan provider OpenAI-compatible (Agent Router, hcnsec, OpenRouter) dengan fallback antar provider. |
| **Lab Materi** | Reader e-book edukasi dengan animasi flip dan zoom. |
| **Garap Schedule** | Pengingat jadwal garap airdrop harian (13:00 dan 19:00 WIB). |
| **Calc** | Kalkulator bawaan di navbar. |

---

## Tech Stack

- **Frontend:** HTML, CSS, dan vanilla JavaScript (tanpa framework, tanpa build step)
- **Backend:** Vercel Serverless Functions (Node.js, CommonJS)
- **Database / Cache:** Supabase (`news_terminal`) dan Upstash Redis (news queue, rate limit, event CEX/new listing)
- **Auth:** Google OAuth (admin) dan Discord OAuth dengan cek role guild (member), sesi lewat cookie `admin_token` bertanda tangan HMAC
- **Poller:** Python 3.12 + Telethon, dijalankan via GitHub Actions
- **Hosting:** Vercel

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
│   ├── news-queue.js       # News Terminal feed (Upstash Redis)
│   ├── verify-token.js     # Verifikasi Google ID token, issue sesi admin
│   └── cron/fetch-news.js  # Penarik berita RSS/CMC/Lookonchain ke Supabase
├── lib/
│   ├── auth.js             # Sign/verify token sesi
│   └── onchain.js          # Konfigurasi chain dan logika onchain
├── js/                     # Modul frontend (airdrop, market, news, onchain, agent, broadcast, lab, dll)
├── css/                    # Stylesheet per modul
├── data/airdrops.json      # Snapshot data airdrop
├── ebook/hasil/            # Materi edukasi (halaman gambar .webp + index.json)
├── scripts/
│   ├── news_poll.py        # Poller Telegram untuk News Terminal
│   └── cexfound_poll.py    # Poller Telegram untuk deteksi CEX found
├── .github/workflows/      # news-poll.yml dan cexfound.yml
└── vercel.json             # Rewrite "/" ke admin.html
```

---

## API Endpoint

Sebagian besar endpoint dikelola lewat satu fungsi `api/admin-airdrop.js` dengan parameter `?type=`.

| Endpoint | Akses | Fungsi |
|----------|-------|--------|
| `GET /api/admin-airdrop` | Login | Ambil daftar airdrop |
| `POST / PATCH / DELETE /api/admin-airdrop` | Admin | Tambah, ubah, hapus airdrop |
| `?type=session` / `?type=logout` | Publik | Cek dan akhiri sesi |
| `?type=discord-login` / `?type=discord-callback` | Publik | Alur login Discord |
| `?type=markets` | Publik | Ranking pasar (CoinGecko, cache Redis 1 jam) |
| `?type=onchain` | Member | Data onchain wallet |
| `?type=btcd` / `?type=usdtd` | Member | Dominance BTC dan USDT |
| `?type=token-unlocks` | Member | Jadwal unlock token |
| `?type=feed` | Member | Feed berita RSS (ID dan global) |
| `?type=nlf-history` / `?type=nlf-stream` | Member | Riwayat dan stream new-listing |
| `?type=cex-found` | Poller / Login | Terima dan baca event CEX found |
| `GET /api/heatmap` | Login | Heatmap futures (`?type=fng` untuk Fear & Greed) |
| `GET /api/market?coin=BTC&tf=5m` | Login | Aliran long/short |
| `GET / POST /api/news-queue` | Login / `x-secret` | Baca dan tulis antrean berita |
| `POST /api/agent-chat` | Admin | Chat dengan AI Agent |
| `GET /api/cron/fetch-news` | `CRON_SECRET` | Tarik berita terjadwal |

---

## Menjalankan Lokal

Prasyarat: Node.js 18+ dan [Vercel CLI](https://vercel.com/docs/cli).

```bash
git clone https://github.com/Xiobaisme/airdropxi.git
cd airdropxi
npm install
cp .env.example .env   # buat sendiri, isi variabel di bawah
vercel dev
```

Buka `http://localhost:3000`.

---

## Environment Variables

Set di Vercel (Project Settings → Environment Variables) atau di `.env` untuk lokal. File `.env*` sudah masuk `.gitignore`, jangan pernah di-commit.

**Auth dan sesi**

| Variabel | Fungsi |
|----------|--------|
| `ADMIN_SECRET_KEY` | Kunci HMAC untuk menandatangani cookie sesi |
| `ALLOWED_ADMIN_EMAILS` | Daftar email admin (pisah koma) untuk login Google |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | OAuth Discord |
| `DISCORD_GUILD_ID`, `DISCORD_ROLE_IDS` | Server dan role yang boleh jadi member (role pisah koma) |
| `SITE_URL` | Base URL untuk redirect OAuth (default `https://airdropxi.vercel.app`) |

**Database dan cache**

| Variabel | Fungsi |
|----------|--------|
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis (dibaca via `Redis.fromEnv()`) |

**Data eksternal**

| Variabel | Fungsi |
|----------|--------|
| `CMC_API_KEY` | CoinMarketCap (berita dan Fear & Greed) |
| `ETHERSCAN_API_KEY` | Etherscan V2 untuk chain EVM |
| `NODEREAL_API_KEY` | BNB Chain |
| `HELIUS_API_KEY` | Solana |
| `NLF_KEY` | Stream new-listing |

**Broadcast dan notifikasi**

| Variabel | Fungsi |
|----------|--------|
| `DISCORD_WEBHOOK_URL` | Webhook tujuan broadcast Discord |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Bot dan chat tujuan broadcast Telegram |
| `SEND_PIN` | PIN pengaman untuk aksi kirim broadcast |

**AI Agent** (minimal satu terisi)

| Variabel | Fungsi |
|----------|--------|
| `AGENTROUTER_API_KEY` | agentrouter.org |
| `HCNSEC_API_KEY` | api.hcnsec.cn |
| `OPENROUTER_API_KEY` | openrouter.ai |

**Cron dan poller**

| Variabel | Fungsi |
|----------|--------|
| `CRON_SECRET` | Melindungi `/api/cron/fetch-news` dan cron internal |
| `ALERT_SECRET` | Header `x-secret` untuk poller yang menulis ke API |

---

## GitHub Actions (Poller Telegram)

Dua workflow memakai Telethon dan berbagi `concurrency: telegram-session` supaya tidak bentrok di sesi Telegram yang sama.

| Workflow | Pemicu | Fungsi |
|----------|--------|--------|
| `news-poll.yml` | `workflow_dispatch` (dipicu dari cron-job.org) | Tarik berita dari channel onchain (Lookonchain, Whale Alert, dll) ke News Terminal |
| `cexfound.yml` | Cron tiap 5 menit dan manual | Deteksi token baru yang masuk CEX dan kirim ke endpoint `cex-found` |

Secrets repo yang dibutuhkan: `TG_API_ID`, `TG_API_HASH`, `TG_SESSION`, `ALERT_SECRET`, `SOURCE_CHANNELS`.

---

## Materi Edukasi

Disimpan sebagai gambar halaman di `ebook/hasil/` dan diindeks oleh `index.json`:

- Memahami Fundamental Crypto
- On-Chain Analysis
- Strategi Trading New Listing: Binance Alpha vs Upbit
- Cara Menemukan Candle Konfirmasi
- Cara Membaca NEWS untuk Beginner

---

## Deploy

Push ke branch utama dan Vercel akan melakukan deploy otomatis. Tidak ada build step (`npm run build` hanya placeholder), jadi pastikan semua environment variable di atas sudah di-set di Vercel.

---

## Kontak dan Komunitas

- Twitter: [@xiobai06](https://twitter.com/xiobai06)
- Telegram: [@Xiobaii](https://t.me/Xiobaii)
- TikTok: [xiobaii_](https://tiktok.com/Xiobaii)
- Discord: komunitas Crypto Monkey

---

## Disclaimer

Konten dan data di platform ini hanya untuk tujuan informasi dan edukasi, **bukan saran finansial**. Airdrop dan trading crypto berisiko tinggi, selalu DYOR dan jangan pernah membagikan private key atau seed phrase kamu.
