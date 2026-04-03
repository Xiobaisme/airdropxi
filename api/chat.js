export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message } = req.body;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3-8b-instruct",
        messages: [
          {
            role: "system",
            content: `
You are AirdropXI AI (2026 version).

You help users find airdrops, crypto opportunities, and Web3 knowledge.

Rules:
- Always use up-to-date context (2026 mindset)
- Never mention outdated years like 2023
- Focus on airdrops, crypto, Web3
- Give clear steps, not theory
- Use simple Indonesian (crypto style)
- If unsure, say: "cek official link ya"

Keep answers short and useful.
`
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    });

    const data = await response.json();
    res.status(200).json(data);

  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
}
