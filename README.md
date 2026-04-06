<div align="center">

<img src="logo.png" alt="AirdropXI Logo" width="80" height="80" style="border-radius:16px"/>

# AirdropXI

**🇮🇩 Platform Tracker Airdrop Web3 Terpercaya di Indonesia**  
**🇬🇧 Indonesia's Most Trusted Web3 Airdrop Tracker**

[![Live Demo](https://img.shields.io/badge/Live-Demo-00e87a?style=for-the-badge&logo=vercel&logoColor=black)](https://airdropxi.vercel.app)
[![Twitter](https://img.shields.io/badge/Twitter-@xiobai06-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white)](https://x.com/xiobai06)
[![Telegram](https://img.shields.io/badge/Telegram-@Xiobaiishikii-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/Xiobaiishikii)
![Version](https://img.shields.io/badge/Version-2.0.0-00e87a?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

</div>

---

<div align="center">

[🇮🇩 Bahasa Indonesia](#-bahasa-indonesia) &nbsp;|&nbsp; [🇬🇧 English](#-english)

</div>

---

# 🇮🇩 Bahasa Indonesia

## 📖 Tentang AirdropXI

**AirdropXI** adalah platform tracker airdrop Web3 real-time yang dirancang khusus untuk komunitas crypto Indonesia. Website ini membantu para hunter menemukan, memantau, dan menggarap airdrop dari project-project Web3 terbaik — sebelum orang lain tahu.

> 💡 **Filosofi:** Jangan ketinggalan airdrop karena kurang informasi. AirdropXI hadir sebagai "radar" yang selalu aktif memantau ekosistem Web3 untuk kamu.

---

## ✨ Fitur Utama

### 🔴 Live Price Ticker
- Menampilkan harga real-time **100+ cryptocurrency** dari CoinGecko API
- Auto-refresh setiap 5 menit
- Tampilkan simbol, harga USD, dan perubahan 24 jam (+/-)
- Ticker berjalan otomatis, bisa di-hover untuk pause

### 📰 Live News Ticker
- Berita dan update terbaru langsung dari database Supabase
- Tag kategori: `LAUNCH`, `SNAPSHOT`, `RELEASE`, `SALE`, `ALERT`, `NEWS`
- Auto-refresh setiap 1 menit

### 🌌 Crypto Universe (Hero Visual)
- Animasi solar system interaktif dengan Bitcoin sebagai "matahari"
- 6 planet (ETH, BNB, SOL, XRP, ADA, DOGE) mengorbit secara animasi
- Float cards menampilkan airdrop terbaru dan total raised

### 📊 Airdrop Dashboard
- **Counter animasi** untuk total airdrop, status aktif, dan yang sudah listing
- Filter dan search real-time berdasarkan nama project
- Tombol filter: `All`, `Active`, `Listed`

### 🃏 Airdrop Cards
- Setiap card menampilkan: nama project, tags, status, total raised, progress bar, dan daftar tugas
- Efek hover dengan radial gradient yang mengikuti posisi kursor
- Tombol langsung menuju link resmi project
- Support status: `Active`, `Waitlist`, `Mint`, `Listing`, `Default`

### 🎓 Guide & Tutorial
- Panduan persiapan: wallet, sosmed, browser, gas fee
- Penjelasan status airdrop: Confirmed, Potential, Ended
- Aturan keamanan anti-scam

### 🤖 AI Agent Chatbot
- Powered by AI — jawab pertanyaan seputar airdrop, Web3, DeFi, NFT, dll
- **Deteksi bahasa otomatis** — jawab Bahasa Indonesia jika ditanya Indo, jawab English jika ditanya English
- Quick buttons untuk pertanyaan populer
- Riwayat percakapan (10 pesan terakhir dikirim sebagai konteks)

### 🌙☀️ Dark / Light Theme
- Toggle tema gelap dan terang dengan satu klik
- Pilihan tema tersimpan di `localStorage` (permanen)
- Semua komponen menyesuaikan warna secara smooth

### 🌐 Bilingual (ID / EN)
- Seluruh konten tersedia dalam Bahasa Indonesia dan English
- Toggle bahasa di navbar, langsung mengubah semua teks

---

## 🗂️ Struktur Proyek

```
airdropxi/
├── index.html          # Halaman utama
├── logo.png            # Logo AirdropXI
├── css/
│   └── style.css       # Semua styling (dark/light theme, responsive)
├── js/
│   └── app.js          # Logic utama: data, render, AI, ticker, tema
└── README.md           # Dokumentasi ini
```

---

## 🛠️ Teknologi yang Digunakan

| Teknologi | Kegunaan |
|-----------|----------|
| **HTML5 / CSS3 / Vanilla JS** | Core frontend, tanpa framework berat |
| **Supabase** | Database airdrop & news ticker (PostgreSQL) |
| **CoinGecko API** | Data harga cryptocurrency real-time |
| **Plus Jakarta Sans** | Font utama (modern, ringan) |
| **JetBrains Mono** | Font monospace untuk data & kode |
| **Canvas API** | Animasi grid background |
| **CSS Custom Properties** | Sistem dark/light theme |
| **IntersectionObserver** | Scroll reveal animation |

---

## 🗄️ Struktur Database (Supabase)

### Tabel `airdrops`
| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | int8 | Primary key |
| `name` | text | Nama project |
| `status` | text | Status airdrop (Active, Listing, dll) |
| `tags` | text | Tags dipisah koma (DeFi, NFT, Gaming, dll) |
| `RaisedID` | text | Total raised — teks Bahasa Indonesia |
| `RaisedEN` | text | Total raised — teks English |
| `tasksID` | text | Daftar tugas — Bahasa Indonesia |
| `tasksEN` | text | Daftar tugas — English |
| `link` | text | URL resmi project |
| `created_at` | timestamp | Waktu ditambahkan |

### Tabel `ticker_news`
| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | int8 | Primary key |
| `text` | text | Isi berita |
| `tag` | text | Kategori (launch/snapshot/release/sale/alert/news) |
| `created_at` | timestamp | Waktu dibuat |

---

## 🚀 Cara Menjalankan

### 1. Clone / Download
```bash
git clone https://github.com/username/airdropxi.git
cd airdropxi
```

### 2. Konfigurasi Supabase
Edit `js/app.js` bagian paling atas:
```javascript
const SB_URL = 'https://YOUR_PROJECT.supabase.co';
const SB_KEY = 'YOUR_ANON_KEY';
```

### 3. Setup Backend AI (Opsional)
AI chatbot memanggil endpoint `/api/chat`. Buat file backend yang menerima:
```json
{
  "message": "teks pesan user",
  "lang": "id",
  "system": "system prompt dinamis",
  "history": [...]
}
```
Dan mengembalikan format OpenAI-compatible:
```json
{
  "choices": [{ "message": { "content": "jawaban AI" } }]
}
```

### 4. Deploy
Langsung upload ke **Vercel**, **Netlify**, atau hosting statis apapun. Tidak perlu build step — pure HTML/CSS/JS.

```bash
# Vercel
vercel deploy

# Netlify
netlify deploy --prod
```

---

## 📱 Responsivitas

| Breakpoint | Layout |
|-----------|--------|
| `> 1024px` | 2 kolom hero, 3 kolom dashboard, 2 kolom guide |
| `768px – 1024px` | 1 kolom hero, 2 kolom dashboard |
| `< 768px` | Semua single kolom, nav links disembunyikan |
| `< 480px` | Hero text lebih kecil, tombol full-width |

---

## ⚠️ Disclaimer

> Semua informasi di AirdropXI hanya untuk tujuan **edukasi**. Bukan merupakan saran investasi. Selalu lakukan riset mandiri (DYOR) sebelum berpartisipasi dalam airdrop apapun. AirdropXI tidak bertanggung jawab atas kerugian finansial yang terjadi.

---

## 📬 Kontak & Komunitas

- 🐦 Twitter: [@xiobai06](https://x.com/xiobai06)
- 📱 Telegram: [@Xiobaiishikii](https://t.me/Xiobaiishikii)

---
---

# 🇬🇧 English

## 📖 About AirdropXI

**AirdropXI** is a real-time Web3 airdrop tracker platform built specifically for the Indonesian crypto community — and anyone in the Web3 space who doesn't want to miss out on free token rewards.

> 💡 **Philosophy:** Never miss an airdrop due to lack of information. AirdropXI acts as your always-on "radar" monitoring the Web3 ecosystem for you.

---

## ✨ Key Features

### 🔴 Live Price Ticker
- Displays real-time prices of **100+ cryptocurrencies** via CoinGecko API
- Auto-refreshes every 5 minutes
- Shows symbol, USD price, and 24h change (+/-)
- Auto-scrolling ticker, hover to pause

### 📰 Live News Ticker
- Latest news and updates pulled directly from Supabase database
- Category tags: `LAUNCH`, `SNAPSHOT`, `RELEASE`, `SALE`, `ALERT`, `NEWS`
- Auto-refreshes every 1 minute

### 🌌 Crypto Universe (Hero Visual)
- Interactive solar system animation with Bitcoin as the "sun"
- 6 orbiting planets (ETH, BNB, SOL, XRP, ADA, DOGE) with smooth animations
- Floating cards display the latest airdrop and total raised

### 📊 Airdrop Dashboard
- **Animated counters** for total airdrops, active status, and listed projects
- Real-time filter and search by project name
- Filter buttons: `All`, `Active`, `Listed`

### 🃏 Airdrop Cards
- Each card shows: project name, tags, status badge, total raised, progress bar, and task list
- Hover effect with radial gradient that follows the cursor position
- Direct button linking to official project URL
- Status support: `Active`, `Waitlist`, `Mint`, `Listing`, `Default`

### 🎓 Guide & Tutorial
- Preparation guide: wallets, social media, browser, gas fees
- Airdrop status explanations: Confirmed, Potential, Ended
- Anti-scam security rules

### 🤖 AI Agent Chatbot
- AI-powered — answers questions about airdrops, Web3, DeFi, NFT, and more
- **Automatic language detection** — responds in Indonesian if asked in Indonesian, English if asked in English
- Quick buttons for popular questions
- Conversation history (last 10 messages sent as context)

### 🌙☀️ Dark / Light Theme
- Toggle between dark and light mode with a single click
- Theme preference saved in `localStorage` (persists across sessions)
- All components transition smoothly

### 🌐 Bilingual (ID / EN)
- All content available in Indonesian and English
- Language toggle in the navbar instantly switches all text

---

## 🗂️ Project Structure

```
airdropxi/
├── index.html          # Main page
├── logo.png            # AirdropXI logo
├── css/
│   └── style.css       # All styles (dark/light theme, responsive)
├── js/
│   └── app.js          # Core logic: data, render, AI, ticker, theme
└── README.md           # This documentation
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **HTML5 / CSS3 / Vanilla JS** | Core frontend, no heavy frameworks |
| **Supabase** | Airdrop & news ticker database (PostgreSQL) |
| **CoinGecko API** | Real-time cryptocurrency price data |
| **Plus Jakarta Sans** | Primary font (modern, lightweight) |
| **JetBrains Mono** | Monospace font for data & code |
| **Canvas API** | Animated grid background |
| **CSS Custom Properties** | Dark/light theme system |
| **IntersectionObserver** | Scroll reveal animations |

---

## 🗄️ Database Schema (Supabase)

### Table `airdrops`
| Column | Type | Description |
|--------|------|-------------|
| `id` | int8 | Primary key |
| `name` | text | Project name |
| `status` | text | Airdrop status (Active, Listing, etc.) |
| `tags` | text | Comma-separated tags (DeFi, NFT, Gaming, etc.) |
| `RaisedID` | text | Total raised — Indonesian text |
| `RaisedEN` | text | Total raised — English text |
| `tasksID` | text | Task list — Indonesian |
| `tasksEN` | text | Task list — English |
| `link` | text | Official project URL |
| `created_at` | timestamp | Creation timestamp |

### Table `ticker_news`
| Column | Type | Description |
|--------|------|-------------|
| `id` | int8 | Primary key |
| `text` | text | News content |
| `tag` | text | Category (launch/snapshot/release/sale/alert/news) |
| `created_at` | timestamp | Creation timestamp |

---

## 🚀 Getting Started

### 1. Clone / Download
```bash
git clone https://github.com/username/airdropxi.git
cd airdropxi
```

### 2. Configure Supabase
Edit the top of `js/app.js`:
```javascript
const SB_URL = 'https://YOUR_PROJECT.supabase.co';
const SB_KEY = 'YOUR_ANON_KEY';
```

### 3. Setup AI Backend (Optional)
The AI chatbot calls the `/api/chat` endpoint. Create a backend that accepts:
```json
{
  "message": "user's message text",
  "lang": "en",
  "system": "dynamic system prompt",
  "history": [...]
}
```
And returns an OpenAI-compatible format:
```json
{
  "choices": [{ "message": { "content": "AI reply" } }]
}
```

### 4. Deploy
Upload directly to **Vercel**, **Netlify**, or any static hosting. No build step required — pure HTML/CSS/JS.

```bash
# Vercel
vercel deploy

# Netlify
netlify deploy --prod
```

---

## 📱 Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| `> 1024px` | 2-col hero, 3-col dashboard, 2-col guide |
| `768px – 1024px` | 1-col hero, 2-col dashboard |
| `< 768px` | All single column, nav links hidden |
| `< 480px` | Smaller hero text, full-width buttons |

---

## 🎨 Design System

### Color Palette
| Variable | Dark | Light | Usage |
|----------|------|-------|-------|
| `--g` | `#00e87a` | `#00e87a` | Primary green accent |
| `--c` | `#00c8f0` | `#00c8f0` | Cyan accent |
| `--bg` | `#080f0c` | `#f0f7f4` | Main background |
| `--text` | `#e6f2ec` | `#0d2018` | Primary text |
| `--text2` | `#8aa898` | `#3d6652` | Secondary text |
| `--border` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.1)` | Borders |

### Typography
- **Display / Headings:** Plus Jakarta Sans (800 weight)
- **Body:** Plus Jakarta Sans (400–600 weight)
- **Data / Code / Mono:** JetBrains Mono (400–700 weight)

---

## ⚠️ Disclaimer

> All information on AirdropXI is for **educational purposes only**. This is not financial or investment advice. Always do your own research (DYOR) before participating in any airdrop. AirdropXI is not responsible for any financial losses incurred.

---

## 📬 Contact & Community

- 🐦 Twitter: [@xiobai06](https://x.com/xiobai06)
- 📱 Telegram: [@Xiobaiishikii](https://t.me/Xiobaiishikii)

---

<div align="center">

Made with ⚡ for Web3 hunters

**© 2025 AirdropXI — Stay Safe & Keep Grinding**

</div>
