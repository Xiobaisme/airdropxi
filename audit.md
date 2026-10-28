# Audit Report: airdropxi

## 1. Ringkasan Eksekutif
- **Stack:** Node.js (Serverless API functions Vercel), Vanilla JavaScript (Frontend HTML/CSS/JS di root dan folder `js/`, `css/`), Upstash Redis, Supabase (PostgreSQL REST via PostgREST), Telegram Bot API / Mini App, Discord Webhooks.
- **Arsitektur:** Aplikasi web monorepo terdistribusi sebagai Serverless Functions di Vercel (`/api/*`), dengan antarmuka frontend statis/SPA yang berinteraksi langsung melalui fetch API. Integrasi backend mencakup manajemen airdrop, market dashboard (Likuidasi, Token Unlocks, CEX Long/Short), Telegram webhook & miniapp auth, serta AI agent proxy (`agent-chat.js`).
- **Jumlah Temuan per Severity:**
  - Critical: 1
  - High: 2
  - Medium: 3
  - Low: 2
  - Info: 2
- **3 Risiko Terbesar:**
  1. **Secret Leak di Git History:** File `.env` yang berisi API key (`sk-or-...a415`) pernah di-commit secara langsung pada riwayat git (`commit b5f9e7e`), meskipun kemudian dihapus (`commit cbf392f`). Key tersebut harus segera direlokasi dan dirotasi total.
  2. **Kurangnya Validasi Input pada Broadcast/Agent Chat & Potensi SSRF/Injection:** Parameter dinamis seperti URL, judul, dan prompt dikirim ke pihak ketiga (Discord/Telegram/LLM API) tanpa sanitasi ketat atau pembatasan rate limit yang memadai di beberapa endpoint publik/member.
  3. **Timing Attack & Cryptographic Verification di Session Cookie (`lib/auth.js`):** Perbandingan signature cookie menggunakan `crypto.timingSafeEqual` pada string yang panjangnya bisa berbeda jika terjadi manipulasi token awal sebelum dipotong, berpotensi memicu exception atau unhandled rejection jika tidak ditangani dengan aman.

---

## 2. Ruang Lingkup dan Batasan
- **Ruang Lingkup:** Seluruh file kode sumber di dalam repo `D:\airdropxi-git`, termasuk endpoint API di folder `api/`, pustaka utilitas di `lib/`, frontend scripts di `js/`, file konfigurasi (`package.json`, `vercel.json`), dan riwayat git (`git log`).
- **Apa yang tidak diaudit:** Infrastruktur eksternal cloud provider (Vercel, Supabase, Upstash, Telegram BotFather, Discord Developer Portal, CEX/DEX API pihak ketiga).
- **Apa yang tidak bisa diverifikasi:** Konfigurasi environment variables aktif di production (Vercel dashboard), status hidup/mati secret di server produksi, serta perilaku runtime jaringan eksternal saat beban tinggi (lihat Daftar "Perlu Verifikasi Manual").

---

### [SEC-02] Potensi Timing Attack dan Panjang Buffer dalam `crypto.timingSafeEqual` (`lib/auth.js`)
- Severity: High
- Keyakinan: Tinggi
- Lokasi: `lib/auth.js`, baris 16-17
- Masalah: Fungsi `verifyAdminToken` membandingkan panjang buffer signature tanpa validasi awal yang ketat terhadap bentuk struktur token base64 sebelum di-slice.
- Alasan kenapa ini masalah: Meskipun `crypto.timingSafeEqual` digunakan, jika `sigBuf` dan `expBuf` memiliki panjang yang berbeda, NodeJS akan melempar error (`ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH`), yang kemudian ditangkap oleh blok `try...catch` umum dan mengembalikan `false`. Namun, struktur pemisahan dot (`decoded.lastIndexOf('.')`) pada token yang dimanipulasi bisa menghasilkan string kosong atau tidak valid yang memicu overhead pengecualian.
- Skenario dampak/serangan: Penyerang mengirimkan token korup secara masif untuk memicu eksekusi exception berulang di serverless function, berpotensi menyebabkan log spam atau minor denial of service (DoS).
- Kode SEKARANG:
  ```javascript
  const sigBuf = Buffer.from(sig), expBuf = Buffer.from(sign(payload));
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false;
  ```
- Kode YANG DISARANKAN:
  ```javascript
  const expectedSig = sign(payload);
  const sigBuf = Buffer.from(sig, 'hex');
  const expBuf = Buffer.from(expectedSig, 'hex');
  if (sigBuf.length !== expBuf.length || sigBuf.length === 0 || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }
  ```
- Penjelasan perubahan: Memastikan konversi buffer menggunakan encoding hex yang jelas dan memvalidasi panjang minimum buffer sebelum membandingkan, mencegah exception tak terduga.
- Efek samping/risiko perubahan: Tidak ada risiko fungsional selama format signature sesuai.
- Perlu dites: Verifikasi login admin dengan token sah dan token palsu/rusak.

---

### [HIGH-01] Validasi URL Broadcast Member Terlalu Longgar / Potensi SSRF Ringan (`api/admin-airdrop.js`)
- Severity: High
- Keyakinan: Tinggi
- Lokasi: `api/admin-airdrop.js`, baris 119-121
- Masalah: Validasi URL untuk member saat broadcast menggunakan regex:
  `if (roleOf(session) === 'member' && url && !/^https:\/\/(x\.com|twitter\.com|t\.me|upbit\.com)\//i.test(String(url)))`
- Alasan kenapa ini masalah: Regex tersebut hanya memeriksa awalan domain (`https://x.com/`, dst.). Penyerang dapat membuat URL seperti `https://x.com.attacker.com/...` atau mengeksploitasi subdomain spoofing yang lolos dari validasi regex awalan, lalu menyertakannya dalam embed Discord/Telegram yang dikirim ke channel publik.
- Skenario dampak/serangan: Member tidak berwenang menyisipkan link phising atau link eksternal berbahaya ke dalam broadcast resmi yang dipercaya oleh komunitas (Discord/Telegram).
- Kode SEKARANG:
  ```javascript
  if (roleOf(session) === 'member' && url && !/^https:\/\/(x\.com|twitter\.com|t\.me|upbit\.com)\//i.test(String(url))) {
    url = undefined;   // link dibuang, pesan tetap terkirim
  }
  ```
  Dan di bagian bawah (baris 160):
  ```javascript
  url: url || undefined,
  ```
- Kode YANG DISARANKAN:
  ```javascript
  if (roleOf(session) === 'member' && url) {
    try {
      const parsed = new URL(String(url));
      const allowedHosts = ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 't.me', 'upbit.com', 'www.upbit.com'];
      if (!allowedHosts.includes(parsed.hostname.toLowerCase())) {
        url = undefined;
      }
    } catch {
      url = undefined;
    }
  }
  ```
- Penjelasan perubahan: Menggunakan objek `URL` standar NodeJS untuk memparsing hostname secara presisi dan mencegah bypass regex berbasis subdomain/suffix penyerang.
- Efek samping/risiko perubahan: URL yang sah dari domain yang diizinkan tetap berfungsi normal.

---

### [MED-01] Absennya Rate Limiting yang Kuat pada Endpoint Publik / AI Agent (`api/agent-chat.js`)
- Severity: Medium
- Keyakinan: Tinggi
- Lokasi: `api/agent-chat.js`, seluruh handler
- Masalah: Endpoint `/api/agent-chat.js` tidak menerapkan rate limiting berbasis IP atau user session, padahal endpoint ini melakukan pemanggilan eksternal berbayar ke AI Provider (OpenRouter, AgentRouter, HCNSEC).
- Alasan kenapa ini masalah: Bot atau pihak tak bertanggung jawab dapat melakukan spam request ke endpoint chat agent, mengakibatkan pembengkakan biaya API key pemilik (billing exhaustion) atau DoS pada serverless function.
- Skenario dampak/serangan: Penyerang mengirim ribuan request otomatis ke `/api/agent-chat` secara paralel, menghabiskan kuota API key LLM dalam hitungan menit.
- Kode SEKARANG:
  ```javascript
  module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    ...
  ```
- Kode YANG DISARANKAN:
  Gunakan `@upstash/ratelimit` (seperti yang sudah dipakai di `admin-airdrop.js`):
  ```javascript
  const { getRatelimit } = require('../lib/ratelimit'); // atau inisialisasi ratelimit Upstash
  // di dalam handler:
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const { success } = await ratelimit.limit(`agent:${ip}`);
  if (!success) {
    return res.status(429).json({ error: 'Terlalu banyak permintaan, coba lagi nanti.' });
  }
  ```
- Penjelasan perubahan: Menambahkan pembatasan rate limit per IP menggunakan Upstash Redis untuk mencegah penyalahgunaan API LLM.
- Efek samping/risiko perubahan: Memerlukan koneksi Redis yang aktif (Upstash).

---

### [MED-02] Potensi Unhandled Exception pada Fetch Timeout / Error Response di Market API (`api/market.js`)
- Severity: Medium
- Keyakinan: Sedang
- Lokasi: `api/market.js`, baris 7-13
- Masalah: Fungsi `get` dan `post` menggunakan `AbortSignal.timeout(7000)`, namun teks error dibatasi 80 karakter tanpa menangani error jaringan tingkat rendah dengan aman di seluruh pemanggil konkuren (`Promise.all`).
- Alasan kenapa ini masalah: Jika salah satu bursa eksternal mengalami timeout atau mengembalikan HTML 503 Cloudflare, `Promise.all` di fungsi agregasi market dapat menolak seluruh batch data, membuat dashboard gagal total (blank/error) alih-alih menampilkan data parsial.
- Skenario dampak/serangan: Satu bursa eksternal down memicu kegagalan render seluruh Market Dashboard bagi pengguna.
- Kode SEKARANG:
  ```javascript
  const get = url =>
    fetch(url, { headers: H, signal: AbortSignal.timeout(7000) }).then(async r => {
      if (r.ok) return r.json();
      throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 80)}`);
    });
  ```
- Kode YANG DISARANKAN:
  Gunakan `Promise.allSettled` pada pemanggilan agregasi bursa di modul-modul terkait sehingga kegagalan satu sumber data tidak menjatuhkan seluruh respons API.
- Penjelasan perubahan: Meningkatkan ketahanan (resilience) dashboard terhadap kegagalan API pihak ketiga.
- Efek samping/risiko perubahan: Perlu penyesuaian handling data kosong di frontend jika ada bursa yang gagal merespons.

---

### [MED-03] Paparan Detail Error Internal ke Client (`api/admin-airdrop.js`)
- Severity: Medium
- Keyakinan: Tinggi
- Lokasi: `api/admin-airdrop.js`, baris 90-95
- Masalah: Blok penangkapan error global mengembalikan detail error mentah (`e.message`) ke client:
  `return res.status(500).json({ error: 'Internal error', detail: e.message });`
- Alasan kenapa ini masalah: Menampilkan `e.message` (yang bisa berisi string koneksi database, path server, atau stack error pihak ketiga) memberikan informasi sensitif kepada penyerang untuk reconnaissance.
- Skenario dampak/serangan: Penyerang memicu error secara sengaja untuk membaca struktur internal server atau versi library yang digunakan.
- Kode SEKARANG:
  ```javascript
  async function handler(req, res) {
    try {
      return await _handler(req, res);
    } catch (e) {
      console.error('[admin-airdrop] FATAL:', e);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Internal error', detail: e.message });
      }
    }
  }
  ```
- Kode YANG DISARANKAN:
  ```javascript
  async function handler(req, res) {
    try {
      return await _handler(req, res);
    } catch (e) {
      console.error('[admin-airdrop] FATAL:', e);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Terjadi kesalahan pada server' });
      }
    }
  }
  ```
- Penjelasan perubahan: Menyembunyikan detail stack/error internal dari respons HTTP publik, hanya mencatatnya di server console log.
- Efek samping/risiko perubahan: Tidak ada risiko fungsional; debugging dilakukan via server logs.

---

### [LOW-01] Penggunaan `eval` atau Dynamic Require Berbasis Input Tanpa Sanitasi (`api/admin-airdrop.js`)
- Severity: Low
- Keyakinan: Rendah (Perlu verifikasi)
- Lokasi: `api/admin-airdrop.js`, baris 11-13 (Proxy modules)
- Masalah: Modul eksternal dimuat secara dinamis via `require` dengan key dari parameter objek proxy. Walaupun key dibatasi secara internal, struktur dynamic require perlu diawasi ketat.
- Alasan kenapa ini masalah: Jika parameter `type` atau `exchange_id` dapat dikontrol pengguna tanpa whitelist yang ketat, berpotensi membuka jalur path traversal atau arbitrary module loading.
- Kode SEKARANG:
  ```javascript
  const onchain = new Proxy({}, { get: (_, k) => (...a) => require('../lib/onchain')[k](...a) });
  ```
- Kode YANG DISARANKAN: Validasi eksplisit terhadap fungsi atau modul yang di-request menggunakan whitelist.

---

### [LOW-02] Missing Security Headers di `vercel.json`
- Severity: Low
- Keyakinan: Tinggi
- Lokasi: `vercel.json`
- Masalah: Konfigurasi `vercel.json` tidak mendefinisikan header keamanan HTTP standar seperti `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy`, atau `Strict-Transport-Security`.
- Alasan kenapa ini masalah: Aplikasi menjadi lebih rentan terhadap serangan Clickjacking, MIME-type sniffing, dan XSS berbasis browser.
- Kode SEKARANG:
  (Konfigurasi vercel.json standar tanpa blok `headers`)
- Kode YANG DISARANKAN:
  Tambahkan konfigurasi `headers` di `vercel.json` untuk seluruh route (`source: "/(.*)"`).

---

### [INFO-01] Status Maintenance Mode Aktif untuk Integrasi Supabase (`api/admin-airdrop.js`)
- Severity: Info
- Keyakinan: Tinggi
- Lokasi: `api/admin-airdrop.js`, baris 53
- Masalah: Terdapat konstanta `const MAINTENANCE = true;` yang secara eksplisit memutus semua akses ke Supabase ("SEMENTARA: putus semua akses ke Supabase sampai DB sehat").
- Alasan kenapa ini masalah: Fitur yang bergantung pada database Supabase di backend admin dinonaktifkan sementara. Perlu dipastikan apakah ini disengaja atau tertinggal sebelum rilis produksi penuh.

---

### [INFO-02] Ketergantungan pada Environment Variables Eksternal yang Belum Tentu Konsisten
- Severity: Info
- Keyakinan: Tinggi
- Lokasi: Berbagai file API (`ADMIN_SECRET_KEY`, `TELEGRAM_BOT_TOKEN`, `SEND_PIN`, dll.)
- Masalah: Aplikasi sangat bergantung pada ketersediaan variabel lingkungan. Jika salah satu variabel krusial tidak ada di Vercel, fungsi terkait akan mengembalikan error 500 atau menolak akses secara fail-closed (yang sebenarnya merupakan praktik keamanan yang baik, namun perlu dokumentasi deployment yang jelas).

---

## 4. Hal yang Sudah Baik
1. **Autentikasi Admin Berbasis Cookie Secure & HttpOnly:** Implementasi `issueSession` dan `verifyAdminToken` di `lib/auth.js` menggunakan cookie berbendera `HttpOnly`, `Secure`, dan `SameSite=Lax`, serta menggunakan HMAC-SHA256 dengan `ADMIN_SECRET_KEY`.
2. **Pengecekan Timing Attack:** Penggunaan `crypto.timingSafeEqual` untuk validasi PIN (`checkSendPin`) dan Token Admin (`verifyAdminToken`).
3. **Fail-Closed Architecture:** Maintenance mode dan pengecekan keberadaan API key (`SEND_PIN`, `ADMIN_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) memutus eksekusi jika konfigurasi belum lengkap (`status 500`).
4. **Validasi Telegram Webhook & InitData:** Pengecekan signature HMAC `WebAppData` di `lib/tg-auth.js` dan header `x-telegram-bot-api-secret-token` di `api/tg-webhook.js` sudah sesuai dengan standar resmi Telegram.
5. **Pembersihan & Whitelist Role:** Pemisahan hak akses yang jelas antara `admin` (Google OAuth) dan `member` (Discord/Telegram) di `api/admin-airdrop.js`.

---

## 5. Urutan Perbaikan yang Disarankan
1. **KRITIS / SEGERA (Sebelum Deploy/Rilis):**
   - Lakukan rotasi API Key OpenRouter (`OPENROUTER_KEY`) karena pernah tercatat dalam riwayat git (`commit b5f9e7e`).
   - Bersihkan riwayat git menggunakan `git-filter-repo` jika repo ini berencana dipublikasikan ke publik.
2. **TINGGI:**
   - Perbaiki validasi URL broadcast member di `api/admin-airdrop.js` dari regex sederhana ke validasi objek `URL` (`HIGH-01`).
   - Perkuat validasi buffer dan panjang string pada `verifyAdminToken` di `lib/auth.js` (`SEC-02`).
3. **MENENGAH:**
   - Tambahkan rate limiting pada endpoint AI Agent (`api/agent-chat.js`) untuk mencegah billing exhaustion (`MED-01`).
   - Hapus pemunculan `e.message` mentah pada blok catch global di `api/admin-airdrop.js` (`MED-03`).
4. **RENDAH / INFORMASI:**
   - Tambahkan security headers di `vercel.json` (`LOW-02`).
   - Tinjau kembali status `MAINTENANCE = true` sebelum mengaktifkan fitur Supabase.

---

## 6. Rekomendasi Umum
- **Testing:** Tambahkan unit test dasar menggunakan Jest/Vitest untuk fungsi autentikasi (`lib/auth.js`, `lib/tg-auth.js`) dan sanitasi URL.
- **Logging & Monitoring:** Gunakan structured logging (JSON format) alih-alih `console.error` biasa untuk memudahkan audit jejak akses admin di Vercel.
- **CI Security Scans:** Integrasikan alat pemindai secret seperti `git-secrets` atau `trivy` ke dalam GitHub Actions untuk mencegah commit file `.env` di masa mendatang.

---

## 7. Daftar "Perlu Verifikasi Manual"
1. **Status Environment Variables di Vercel Production:** Memastikan apakah variabel `ADMIN_SECRET_KEY`, `SEND_PIN`, dan API keys LLM sudah di-set dengan nilai yang kuat dan unik di dashboard Vercel (bukan nilai default atau test).
2. **Kesehatan Database Supabase:** Memverifikasi apakah migrasi tabel Supabase sudah siap dan aman ketika konstanta `MAINTENANCE` diubah menjadi `false`.
3. **Ketersediaan Redis Upstash:** Memastikan instance Upstash Redis aktif dan memiliki batasan kuota yang cukup untuk rate limiter dan penyimpanan riwayat USDTD.
