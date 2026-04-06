export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ✅ Baca semua field yang dikirim frontend (message, lang, system, history)
  const { message, lang, system, history } = req.body;

  // System prompt dinamis — pakai yang dikirim frontend, fallback ke default
  const systemPrompt = system || (lang === "en"
    ? `You are AirdropXI Bot, the official AI assistant from AirdropXI — a trusted Web3 airdrop tracker.
Rules:
- Always respond in ENGLISH
- Focus on airdrops, crypto, Web3, DeFi, NFT
- Give clear, practical steps — not just theory
- Keep answers concise and useful
- If unsure, say: "check the official link"
- Never ask for private keys or seed phrases
- Mindset: 2026, always current`
    : `Kamu adalah AirdropXI Bot, asisten AI resmi dari AirdropXI — platform tracker airdrop Web3 terpercaya.
Aturan:
- Selalu jawab dalam BAHASA INDONESIA
- Fokus pada airdrop, crypto, Web3, DeFi, NFT
- Berikan langkah praktis, bukan teori panjang
- Jawaban singkat, padat, dan berguna
- Kalau tidak yakin, bilang: "cek official link ya"
- Jangan pernah minta private key atau seed phrase
- Mindset: 2026, selalu update`
  );

  // Bangun messages array — sertakan history jika ada
  const messages = [
    { role: "system", content: systemPrompt }
  ];

  // Tambahkan history percakapan (maks 10 pesan) untuk konteks
  if (Array.isArray(history) && history.length > 0) {
    const recentHistory = history.slice(-10); // ambil 10 terakhir
    recentHistory.forEach(h => {
      if (h.role && h.content) {
        messages.push({ role: h.role, content: h.content });
      }
    });
  } else {
    // Kalau tidak ada history, langsung tambah pesan user
    messages.push({ role: "user", content: message });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_KEY}`,
        "HTTP-Referer": "https://airdropxi.vercel.app", // ganti domain kamu
        "X-Title": "AirdropXI Bot",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3-8b-instruct",
        messages,
        temperature: 0.7,
        max_tokens: 400
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter error:", errText);
      return res.status(response.status).json({ error: "AI service error", detail: errText });
    }

    const data = await response.json();
    res.status(200).json(data);

  } catch (error) {
    console.error("Handler error:", error);
    res.status(500).json({ error: "Server error", detail: error.message });
  }
}
