// api/agent-chat.js
//
// Endpoint backend untuk panel "AI Agent" di admin dashboard.
// Menghubungkan ke provider OpenAI-compatible (chat/completions):
//   - Agent Router      https://agentrouter.org
//   - hcnsec (mirror)   https://api.hcnsec.cn
//   - OpenRouter        https://openrouter.ai
//
// API key TIDAK PERNAH ditaruh di kode ini. Set sebagai Environment
// Variable di server/Vercel:
//
//   AGENTROUTER_API_KEY   -> key dari agentrouter.org (API Token page)
//   HCNSEC_API_KEY        -> key dari api.hcnsec.cn (API Keys page)
//   OPENROUTER_API_KEY    -> key dari openrouter.ai (API Keys page)
//
// Kalau salah satu env var kosong, provider itu otomatis dilewati /
// dianggap tidak tersedia (tidak akan bikin request gagal ke provider lain).

const PROVIDERS = {
  agentrouter: {
    baseUrl: 'https://agentrouter.org/v1',
    apiKeyEnv: 'AGENTROUTER_API_KEY',
  },
  hcnsec: {
    baseUrl: 'https://api.hcnsec.cn/v1',
    apiKeyEnv: 'HCNSEC_API_KEY',
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    // OpenRouter mewajibkan header referrer/title, opsional tapi disarankan
    extraHeaders: {
      'HTTP-Referer': 'https://airdropxi.vercel.app',
      'X-Title': 'Xiobaii Admin',
    },
  },
};

// Mapping id agent yang dikirim dari frontend (lihat AGENTS di admin.html)
// ke provider + nama model asli yang dipanggil.
//
// Model per provider (sesuai konfirmasi user):
//   - agentrouter.org  -> claude-opus-5, claude-opus-4-8, gpt-5.6-sol
//   - api.hcnsec.cn    -> "auto" (router internal milih model otomatis)
//   - openrouter.ai    -> meta-llama/llama-3.1-8b-instruct
const AGENT_MODEL_MAP = {
  opus5: { provider: 'agentrouter', model: 'claude-opus-5' },
  opus48: { provider: 'agentrouter', model: 'claude-opus-4-8' },
  gpt56: { provider: 'agentrouter', model: 'gpt-5.6-sol' },
  auto: { provider: 'hcnsec', model: 'auto' },
  llama: { provider: 'openrouter', model: 'meta-llama/llama-3.1-8b-instruct' },
};

function getApiKey(providerName) {
  const cfg = PROVIDERS[providerName];
  if (!cfg) return null;
  return process.env[cfg.apiKeyEnv] || null;
}

function buildSystemPrompt(mode) {
  if (mode === 'code') {
    return 'Kamu adalah asisten coding. Jawab dengan kode yang siap pakai, ' +
      'beri komentar singkat kalau perlu. Jangan tambahkan basa-basi panjang di luar kode.';
  }
  if (mode === 'image') {
    return 'Kamu menerima gambar dari user. Karena endpoint ini adalah model ' +
      'chat/vision (bukan model generate/edit gambar), jelaskan apa yang kamu ' +
      'lihat di gambar dan berikan instruksi/edit yang diminta secara tekstual. ' +
      'Jujur kalau kamu tidak bisa menghasilkan file gambar baru.';
  }
  return 'Kamu adalah asisten AI yang membantu admin mengelola dashboard airdrop. Jawab singkat dan jelas dalam Bahasa Indonesia kecuali diminta lain.';
}

async function callProvider({ providerName, model, systemPrompt, history, prompt, image }) {
  const cfg = PROVIDERS[providerName];
  const apiKey = getApiKey(providerName);
  if (!cfg || !apiKey) {
    const err = new Error(`Provider "${providerName}" belum dikonfigurasi (env var ${cfg?.apiKeyEnv || '?'} kosong)`);
    err.code = 'NO_API_KEY';
    throw err;
  }

  const messages = [{ role: 'system', content: systemPrompt }];

  (history || []).forEach((h) => {
    if (h && h.role && h.content) {
      messages.push({ role: h.role, content: h.content });
    }
  });

  // Kalau ada gambar terlampir dan modelnya kemungkinan vision-capable,
  // kirim sebagai content multi-part (format vision OpenAI-compatible).
  if (image) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: image } },
      ],
    });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...(cfg.extraHeaders || {}),
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 1200,
    }),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (e) {
    throw new Error(`Provider "${providerName}" mengembalikan respons non-JSON (HTTP ${res.status})`);
  }

  if (!res.ok) {
    const msg = data?.error?.message || data?.message || JSON.stringify(data);
    const err = new Error(`Provider "${providerName}" error: ${msg}`);
    err.status = res.status;
    throw err;
  }

  const replyText = data?.choices?.[0]?.message?.content;
  if (!replyText) {
    throw new Error(`Provider "${providerName}" tidak mengembalikan konten balasan.`);
  }

  return {
    text: replyText,
    modelUsed: data.model || model,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} tidak diizinkan` });
  }

  const { agent, mode, prompt, image, history } = req.body || {};

  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({ error: 'Field "prompt" wajib diisi' });
  }

  const mapping = AGENT_MODEL_MAP[agent] || AGENT_MODEL_MAP.auto;
  const systemPrompt = buildSystemPrompt(mode);
  const t0 = Date.now();

  try {
    const result = await callProvider({
      providerName: mapping.provider,
      model: mapping.model,
      systemPrompt,
      history,
      prompt,
      image: mode === 'image' ? image : null,
    });

    return res.status(200).json({
      kind: mode === 'code' ? 'code' : 'text', // generate gambar asli butuh model image-gen terpisah, lihat catatan di atas
      text: result.text,
      modelUsed: result.modelUsed,
      ms: Date.now() - t0,
    });
  } catch (primaryErr) {
    // Fallback: kalau provider utama gagal (mis. quota habis / key kosong),
    // coba provider lain yang keynya tersedia, supaya panel tetap hidup.
    const fallbackOrder = Object.keys(PROVIDERS).filter((p) => p !== mapping.provider && getApiKey(p));

    for (const providerName of fallbackOrder) {
      try {
        const fallbackModel = providerName === 'openrouter'
          ? 'meta-llama/llama-3.1-8b-instruct'
          : (providerName === 'hcnsec' ? 'auto' : mapping.model);
        const result = await callProvider({
          providerName,
          model: fallbackModel,
          systemPrompt,
          history,
          prompt,
          image: mode === 'image' ? image : null,
        });
        return res.status(200).json({
          kind: mode === 'code' ? 'code' : 'text',
          text: result.text,
          modelUsed: `${result.modelUsed} (fallback dari ${mapping.provider})`,
          ms: Date.now() - t0,
        });
      } catch (fallbackErr) {
        continue; // coba provider fallback berikutnya
      }
    }

    console.error('[agent-chat] semua provider gagal:', primaryErr.message);
    return res.status(500).json({ error: primaryErr.message });
  }
};
