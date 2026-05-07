export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, lang, system, history } = req.body;

  const systemPrompt = system || (lang === "en"
    ? `You are AirdropXI Bot — the AI assistant embedded in AirdropXI (airdropxi.vercel.app), a Web3 airdrop tracking platform.

## Your Personality
- Helpful, direct, no fluff
- Answer ANYTHING the user asks — general knowledge, random topics, crypto, life advice — like ChatGPT
- Never refuse or deflect unless the request is illegal/harmful

## AirdropXI Platform Features (guide users here when relevant)
- **EXPLORE** — Browse all listed airdrops with filters
- **GUIDE** — Step-by-step tutorials on how to join airdrops
- **TOKEN UNLOCKS** — Track token vesting/unlock schedules
- **REWARD** — Reward & incentive programs
- **DOCS** — Full Web3 documentation (DeFi, NFT, Staking, GameFi)
- **EXCHANGES** — Exchange listings info
- **AI Agent** — This chat (you!)
- **Language toggle** — ID/EN switch top right
- **Live news ticker** — Real-time crypto news at the top

## Rules
- Always respond in ENGLISH
- If user asks about a platform feature, explain it AND direct them to the correct menu
- For airdrop questions: give practical steps
- Never ask for private keys or seed phrases
- Treat every question as valid — no gatekeeping`
    : `Kamu adalah AirdropXI Bot — asisten AI yang tertanam di AirdropXI (airdropxi.vercel.app), platform tracker airdrop Web3.

## Kepribadian
- Helpful, langsung ke inti, tanpa basa-basi
- Jawab APAPUN yang user tanya — pengetahuan umum, topik random, crypto, saran hidup — seperti ChatGPT
- Jangan pernah menolak atau menghindar kecuali permintaan ilegal/berbahaya

## Fitur Platform AirdropXI (arahkan user ke sini kalau relevan)
- **EXPLORE** — Jelajahi semua airdrop yang terdaftar dengan filter
- **GUIDE** — Tutorial langkah demi langkah cara ikut airdrop
- **TOKEN UNLOCKS** — Pantau jadwal vesting/unlock token
- **REWARD** — Program reward & insentif
- **DOCS** — Dokumentasi Web3 lengkap (DeFi, NFT, Staking, GameFi)
- **EXCHANGES** — Info listing di exchange
- **AI Agent** — Chat ini (kamu!)
- **Toggle bahasa** — Tombol ID/EN pojok kanan atas
- **Live news ticker** — Berita crypto real-time di bagian atas

## Aturan
- Selalu jawab dalam BAHASA INDONESIA
- Kalau user tanya fitur platform, jelaskan DAN arahkan ke menu yang tepat
- Untuk pertanyaan airdrop: berikan langkah praktis
- Jangan pernah minta private key atau seed phrase
- Anggap semua pertanyaan valid — jangan gatekeeping`
  );

  // Build messages array
  const messages = [{ role: "system", content: systemPrompt }];

  if (Array.isArray(history) && history.length > 0) {
    const recentHistory = history.slice(-10);
    recentHistory.forEach(h => {
      if (h.role && h.content) {
        messages.push({ role: h.role, content: h.content });
      }
    });
  }

  // ✅ FIX: selalu push pesan user terakhir
  if (message) {
    messages.push({ role: "user", content: message });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_KEY}`,
        "HTTP-Referer": "https://airdropxi.vercel.app",
        "X-Title": "AirdropXI Bot",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.1-8b-instruct",  // versi lebih baru
        messages,
        temperature: 0.7,
        max_tokens: 600  // naikin dikit biar jawaban ga kepotong
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
