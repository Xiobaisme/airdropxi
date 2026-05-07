<div align="center">

<img src="https://airdropxi.vercel.app/logo.png" width="80" alt="AirdropXI Logo" />

# AirdropXI

**The #1 Real-Time Web3 Airdrop Tracker**

[![Live Demo](https://img.shields.io/badge/Live-Demo-00e87a?style=for-the-badge&logo=vercel&logoColor=black)](https://airdropxi.vercel.app)
[![Twitter](https://img.shields.io/badge/Twitter-@xiobai06-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white)](https://x.com/xiobai06)
[![Telegram](https://img.shields.io/badge/Telegram-@Xiobaiishikii-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/Xiobaiishikii)
![Version](https://img.shields.io/badge/Version-2.0.0-00e87a?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

*Never miss a free token drop again. AirdropXI is your always-on Web3 radar.*

</div>

---

## 🌐 Live

> **[https://airdropxi.vercel.app](https://airdropxi.vercel.app)**

---

## 📖 About

**AirdropXI** is a real-time Web3 airdrop tracker that helps crypto hunters find, monitor, and participate in the best token airdrops — before everyone else does.

Built with pure HTML/CSS/JS and powered by Supabase, it tracks 29+ active airdrops, delivers live crypto prices, and includes a built-in AI chatbot to guide users through Web3.

---

## ✨ Features

### 🔴 Live Price Ticker
- Real-time prices for **100+ cryptocurrencies** via CoinGecko API
- Auto-refreshes every 5 minutes
- Shows symbol, USD price, and 24h change
- Auto-scrolling ticker — hover to pause

### 📰 Live News Ticker
- Latest airdrop news pulled directly from Supabase
- Category tags: `LAUNCH` `SNAPSHOT` `RELEASE` `SALE` `ALERT` `NEWS`
- Auto-refreshes every 1 minute

### 🌌 Crypto Universe (Hero)
- Interactive solar system animation — Bitcoin as the "sun"
- 6 orbiting planets: ETH, BNB, SOL, XRP, ADA, DOGE
- Floating cards showing latest airdrops and total raised

### 📊 Airdrop Dashboard
- Animated counters for total, active, and listed airdrops
- Real-time search and filter by project name
- Filter tabs: `All` `Active` `Listed`

### 🃏 Airdrop Cards
- Project name, tags, status badge, total raised, progress bar, task list
- Hover effect with cursor-following radial gradient
- Direct link to official project URL
- Statuses: `Active` `Waitlist` `Mint` `Listing`

### 🤖 AI Chatbot
- Powered by AI — answers questions about airdrops, Web3, DeFi, NFT
- Auto language detection — responds in the user's language
- Quick-reply buttons for common questions
- Conversation history (last 10 messages as context)

### 🌙 Dark / Light Theme
- One-click theme toggle
- Saved to `localStorage` — persists across sessions

### 🌐 Bilingual (ID / EN)
- Full content in Indonesian and English
- Navbar language toggle switches all text instantly

---

## 🗂️ Project Structure

```
airdropxi/
├── index.html          # Main landing page
├── exchanges.html      # Crypto exchanges list
├── unlocks.html        # Token unlock schedule tracker
├── reward.html         # Rewards & bounties
├── docs.html           # Web3 encyclopedia & guides
├── logo.png            # AirdropXI logo
├── vercel.json         # Vercel routing config
├── robots.txt          # SEO crawl config
├── css/
│   └── style.css       # All styles (dark/light theme, responsive)
├── js/
│   └── app.js          # Core logic: data, render, AI, ticker, theme
└── api/
    ├── airdrops.js     # Supabase airdrop data endpoint
    ├── chat.js         # AI chatbot endpoint
    ├── exchanges.js    # Exchange data endpoint
    ├── sitemap.js      # Dynamic XML sitemap generator
    └── unlocks.js      # Token unlock data endpoint
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| **HTML5 / CSS3 / Vanilla JS** | Core frontend — no frameworks |
| **Supabase** | PostgreSQL database for airdrops & news |
| **CoinGecko API** | Real-time crypto price data |
| **Vercel** | Serverless deployment & API functions |
| **Plus Jakarta Sans** | Primary UI font |
| **JetBrains Mono** | Monospace font for data & code |
| **Canvas API** | Animated grid background |
| **CSS Custom Properties** | Dark/light theming system |
| **IntersectionObserver** | Scroll-reveal animations |

---

## 🗄️ Database Schema (Supabase)

### `airdrops` table

| Column | Type | Description |
|---|---|---|
| `id` | int8 | Primary key |
| `name` | text | Project name |
| `status` | text | Airdrop status (Active, Listing, Waitlist…) |
| `tags` | text | Comma-separated tags (DeFi, NFT, Gaming…) |
| `RaisedID` | text | Total raised — Indonesian |
| `RaisedEN` | text | Total raised — English |
| `tasksID` | text | Task list — Indonesian |
| `tasksEN` | text | Task list — English |
| `link` | text | Official project URL |
| `created_at` | timestamp | Record creation time |

### `ticker_news` table

| Column | Type | Description |
|---|---|---|
| `id` | int8 | Primary key |
| `text` | text | News content |
| `tag` | text | Category (launch / snapshot / release / sale / alert / news) |
| `created_at` | timestamp | Creation timestamp |

---

## 🚀 Getting Started

### 1. Clone

```bash
git clone https://github.com/Xiobaisme/airdropxi.git
cd airdropxi
```

### 2. Configure Supabase

Edit the top of `js/app.js`:

```js
const SB_URL = 'https://YOUR_PROJECT.supabase.co';
const SB_KEY = 'YOUR_ANON_KEY';
```

### 3. Set Environment Variables

Create a `.env` file (for local dev) or add to Vercel dashboard:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### 4. Deploy

No build step required — pure static files + serverless API.

```bash
# Vercel (recommended)
vercel deploy

# Netlify
netlify deploy --prod
```

---

## 📱 Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| `> 1024px` | 2-col hero, 3-col dashboard, 2-col guide |
| `768px – 1024px` | 1-col hero, 2-col dashboard |
| `< 768px` | Single column, nav links hidden |
| `< 480px` | Compact hero text, full-width buttons |

---

## 🎨 Design System

### Color Palette

| Variable | Value (Dark) | Usage |
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

All information on AirdropXI is for **educational purposes only** and does not constitute financial or investment advice. Always do your own research (DYOR) before participating in any airdrop. AirdropXI is not responsible for any financial losses incurred.

---

## 📬 Contact

- 🐦 Twitter: [@xiobai06](https://x.com/xiobai06)
- 📱 Telegram: [@Xiobaiishikii](https://t.me/Xiobaiishikii)
- 🌐 Website: [airdropxi.vercel.app](https://airdropxi.vercel.app)

---

<div align="center">

Made with ⚡ for Web3 hunters

**© 2026 AirdropXI — Stay Safe & Keep Grinding**

</div>
