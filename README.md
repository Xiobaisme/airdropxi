<div align="center">

<img src="https://airdropxi.vercel.app/logo.png" width="90" alt="AirdropXI Logo" />

<h1>AirdropXI</h1>

**The #1 Real-Time Web3 Airdrop Tracker**

<p>
  <a href="https://airdropxi.vercel.app">
    <img src="https://img.shields.io/badge/🌐_Live_Site-airdropxi.vercel.app-00e87a?style=for-the-badge&labelColor=0d1117" alt="Live Site" />
  </a>
  <a href="https://x.com/xiobai06">
    <img src="https://img.shields.io/badge/𝕏_Twitter-@xiobai06-000000?style=for-the-badge&logo=x&logoColor=white" alt="Twitter" />
  </a>
  <a href="https://t.me/Xiobaiishikii">
    <img src="https://img.shields.io/badge/Telegram-@Xiobaiishikii-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram" />
  </a>
  <a href="https://tiktok.com/@xiobaiishikii_">
    <img src="https://img.shields.io/badge/TikTok-@xiobaiishikii__-FF0050?style=for-the-badge&logo=tiktok&logoColor=white" alt="TikTok" />
  </a>
</p>

<p>
  <img src="https://img.shields.io/badge/Version-2.1.0-00e87a?style=for-the-badge&labelColor=0d1117" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge&labelColor=0d1117" />
  <img src="https://img.shields.io/badge/Deployed_on-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" />
  <img src="https://img.shields.io/badge/Database-Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" />
</p>

*Never miss a free token drop again. AirdropXI is your always-on Web3 radar.*

</div>

---

## 🌐 Live

> **[https://airdropxi.vercel.app](https://airdropxi.vercel.app)**

---

## 📖 About

**AirdropXI** is a real-time Web3 airdrop tracker built for the Indonesian crypto community. Find, monitor, and complete token airdrops — before everyone else does.

Built with pure HTML/CSS/JS, powered by Supabase and deployed on Vercel. Tracks active airdrops, delivers step-by-step participation guides, live exchange data, real-time crypto prices, and a built-in AI chatbot to guide users through Web3.

---

## ✨ Features

### 🔴 Live Price Ticker
- Real-time prices for **100+ cryptocurrencies** via CoinGecko API
- Auto-refreshes every 5 minutes
- Shows symbol, USD price, and 24h change
- Auto-scrolling ticker — hover to pause

### 📰 Live News Ticker
- Latest airdrop news via Telegram bot → Supabase integration
- Category tags: `LAUNCH` `SNAPSHOT` `RELEASE` `SALE` `ALERT` `NEWS`
- Auto-refreshes every 1 minute

### 🌌 Crypto Universe (Hero)
- Interactive solar system animation — Bitcoin as the "sun"
- 6 orbiting planets: ETH, BNB, SOL, XRP, ADA, DOGE
- Floating cards showing latest airdrops and total raised

### 📊 Airdrop Dashboard
- Animated counters for total, active, and listed airdrops
- Real-time search and filter by project name
- Filter tabs: `Active` `Waitlist`
- Drag-to-reorder projects (persisted via `sort_order` in Supabase)

### 🃏 Airdrop Cards
- Project name, tags, status badge, total raised, progress bar
- Hover effect with cursor-following radial gradient
- Direct link to step-by-step guide per project
- Statuses: `Active` `Waitlist` `Mint` `Listing`

### 📖 Step-by-Step Guides (`guide.html`)
- Per-task start buttons with direct link redirect (`testnet_links`)
- Image instructions with lightbox zoom
- Bilingual toggle ID / EN via `history.replaceState`
- URL routing: `/guide/id/slug` & `/guide/en/slug`
- View count tracking per project

### 💱 Exchange Explorer (`exchanges.html`)
- Filter tabs: `CEX` `DEX` `Hybrid`
- Live market data: price, volume, market cap from CoinGecko (auto-refresh 30s)
- Sparkline charts per exchange
- SPA-style routing via `?exchange=slug`
- Sticky table headers & pagination
- Detail panel per exchange
- Full bilingual support ID / EN

### 🗺️ Project Roadmap
- Timeline per project phase with status indicators
- Phases: `Completed` `In Progress` `Upcoming`

### 🤖 AI Chatbot
- Answers questions about airdrops, Web3, DeFi, NFT
- Auto language detection — responds in user's language
- Quick-reply buttons for common questions
- Conversation history (last 10 messages as context)

### 🔐 Admin Panel (`admin.html`)
- Login via Google OAuth — session persisted in localStorage
- Full CRUD: airdrops, projects, tasks, roadmap, exchanges
- Drag-to-reorder project listings
- Image upload per task via GitHub Contents API + canvas editor (crop & annotation)
- Published / Draft toggle per project
- Email notifications to subscribers via Brevo

### 🌙 Dark / Light Theme
- One-click toggle, saved to `localStorage`

### 🌐 Bilingual (ID / EN)
- Full content in Indonesian and English
- Language-prefixed URL routing via `vercel.json`

### 🔍 SEO
- Dynamic sitemap at `/api/sitemap.js`
- `robots.txt` configured
- Open Graph & JSON-LD meta tags
- Clean URLs (`cleanUrls: true` in Vercel)

---

## 🗂️ Project Structure

```
airdropxi/
├── index.html          # Homepage — airdrop list + hero + tickers
├── guide.html          # Step-by-step participation guide per project
├── exchanges.html      # CEX/DEX/Hybrid explorer with live data
├── admin.html          # Admin panel (CRUD, drag reorder, image upload)
├── unlocks.html        # Token unlock schedule tracker
├── reward.html         # Rewards & bounties
├── docs.html           # Web3 encyclopedia & guides
├── logo.png            # AirdropXI logo
├── robots.txt          # SEO crawl config
├── vercel.json         # Routing config (cleanUrls, rewrites, lang prefix)
├── css/
│   └── style.css       # All styles (dark/light theme, responsive)
├── js/
│   └── app.js          # Core logic: data, render, AI, ticker, theme
└── api/
    ├── airdrops.js     # Supabase airdrop list endpoint
    ├── guide.js        # Project detail & tasks endpoint (+ view count)
    ├── chat.js         # AI chatbot endpoint
    ├── exchanges.js    # Exchange data endpoint
    ├── sitemap.js      # Dynamic XML sitemap
    └── unlocks.js      # Token unlock data endpoint
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| <img src="https://skillicons.dev/icons?i=html" width="16"/> **HTML5 / CSS3 / Vanilla JS** | Core frontend — no frameworks |
| <img src="https://skillicons.dev/icons?i=supabase" width="16"/> **Supabase** | PostgreSQL DB — airdrops, news, exchanges |
| <img src="https://skillicons.dev/icons?i=vercel" width="16"/> **Vercel** | Serverless hosting & API routes |
| <img src="https://skillicons.dev/icons?i=github" width="16"/> **GitHub Contents API** | Image storage per task row |
| 🦎 **CoinGecko API** | Real-time crypto price & market data |
| 📧 **Brevo** | Email notifications to subscribers |
| 🔑 **Google OAuth** | Admin panel authentication |

---

## 🗄️ Database Schema (Supabase)

### `airdrops` — list view

| Column | Type | Description |
|---|---|---|
| `id` | int8 | Primary key |
| `name` | text | Project name |
| `slug` | text | URL-safe identifier |
| `logo_url` | text | Project logo |
| `status` | text | Active / Waitlist / Mint / Listing |
| `tags` | text | Comma-separated tags |
| `sort_order` | int4 | Drag-to-reorder index |
| `published` | bool | Published / Draft toggle |
| `created_at` | timestamp | Record creation time |

### `proyek` — guide detail

| Column | Type | Description |
|---|---|---|
| `id` | int8 | Primary key |
| `airdrop_id` | int8 | FK → airdrops |
| `title` | text | Project title |
| `tasks` | jsonb | Task list per step |
| `testnet_links` | jsonb | Direct links per task (1-to-1) |
| `task_images` | jsonb | Image URLs per task |
| `published` | bool | Visibility toggle |
| `view_count` | int4 | Page view counter |

### `project_roadmaps` — timeline

| Column | Type | Description |
|---|---|---|
| `id` | int8 | Primary key |
| `airdrop_id` | int8 | FK → airdrops |
| `phase` | text | Phase name |
| `status` | text | completed / in_progress / upcoming |
| `order_index` | int4 | Display order |

### `exchange_details` — exchange explorer

| Column | Type | Description |
|---|---|---|
| `id` | int8 | Primary key |
| `name` | text | Exchange name |
| `slug` | text | URL-safe identifier |
| `type` | text | cex / dex / hybrid |
| `coingecko_id` | text | CoinGecko ID for live data |

### `ticker_news` — news ticker

| Column | Type | Description |
|---|---|---|
| `id` | int8 | Primary key |
| `text` | text | News content |
| `tag` | text | launch / snapshot / release / sale / alert / news |
| `created_at` | timestamp | Timestamp |

---

## 🚀 Getting Started

### 1. Clone

```bash
git clone https://github.com/Xiobaisme/airdropxi.git
cd airdropxi
```

### 2. Configure Environment Variables

Add to Vercel dashboard or create `.env.local`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
GITHUB_TOKEN=your-github-pat
GITHUB_REPO=username/repo-for-images
BREVO_API_KEY=your-brevo-api-key
```

### 3. Deploy

No build step required — pure static files + serverless API.

```bash
# Vercel (recommended)
vercel deploy
```

---

## 🎨 Design System

### Color Palette

| Variable | Value | Usage |
|---|---|---|
| `--g` | `#00e87a` | Primary green accent |
| `--c` | `#00c8f0` | Cyan accent |
| `--bg` | `#080f0c` | Main background |
| `--text` | `#e6f2ec` | Primary text |
| `--text2` | `#8aa898` | Secondary / muted text |
| `--border` | `rgba(255,255,255,0.08)` | Borders & dividers |

### Typography

- **Headings:** Plus Jakarta Sans 800
- **Body:** Plus Jakarta Sans 400–600
- **Code / Data:** JetBrains Mono 400–700

---

## ⚠️ Disclaimer

All information on AirdropXI is for **educational purposes only** and does not constitute financial or investment advice. Always DYOR before participating in any airdrop. AirdropXI is not responsible for any financial losses.

---

## 📬 Contact

<p>
  <a href="https://x.com/xiobai06"><img src="https://img.shields.io/badge/𝕏-@xiobai06-000000?style=flat-square&logo=x&logoColor=white" /></a>
  <a href="https://t.me/Xiobaiishikii"><img src="https://img.shields.io/badge/Telegram-@Xiobaiishikii-2CA5E0?style=flat-square&logo=telegram&logoColor=white" /></a>
  <a href="https://tiktok.com/@xiobaiishikii_"><img src="https://img.shields.io/badge/TikTok-@xiobaiishikii__-FF0050?style=flat-square&logo=tiktok&logoColor=white" /></a>
  <a href="https://airdropxi.vercel.app"><img src="https://img.shields.io/badge/🌐_Website-airdropxi.vercel.app-00e87a?style=flat-square&labelColor=0d1117" /></a>
</p>

---

<div align="center">

Made with ⚡ for Web3 hunters

**© 2026 AirdropXI — Stay Safe & Keep Grinding**

</div>
