// ═══════════════════════════════════════════════════════════
        // ─── AI AGENT PANEL ───
        // Dulu file terpisah (agent-panel.html), sekarang jadi modal
        // di dalam admin panel ini, dibuka lewat tombol nav "AI Agent".
        //
        // Baru ada 2 agent aktif dulu (Claude Opus 5 & GPT 5.6),
        // tinggal un-comment baris "Claude Opus 4.8" kalau mau nambah.
        //
        // Backend: coba panggil /api/agent-chat dulu. Kalau endpoint itu
        // belum ada (mis. file ini dibuka standalone), otomatis fallback
        // ke mockCallAgent() biar tetap kerasa hidup. API key TIDAK PERNAH
        // ada di file ini — dia cuma hidup di server (env var), dipakai
        // di api/agent-chat.js.
        // ═══════════════════════════════════════════════════════════
        const AGENTS = [
               { id: 'opus5', name: 'Claude Opus 5', color: '#7c5cff', tag: 'Reasoning' },
               { id: 'opus48', name: 'Claude Opus 4.8', color: '#38bdf8', tag: 'Vision' },
               { id: 'gpt56', name: 'GPT 5.6', color: '#22c55e', tag: 'Fast' },
               { id: 'llama', name: 'Llama 3.1 8B', color: '#f59e0b', tag: 'Ringan' },
               { id: 'auto', name: 'Auto', color: null, tag: 'Tercepat' },
           ];

        const MODES = [
            { id: 'chat', label: 'Chat', placeholder: 'Tulis pesan...',
                icon: '<path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>' },
            { id: 'code', label: 'Code', placeholder: 'Deskripsikan kode yang mau dibuat...',
                icon: '<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>' },
            { id: 'image', label: 'Gambar', placeholder: 'Deskripsikan editan gambar, lalu lampirkan file...',
                icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>' },
        ];

        let agentState = {
            agent: 'opus5',
            mode: 'chat',
            attachedImage: null, // {dataUrl, name}
            busy: false,
        };

        // Riwayat chat sekarang dipisah PER AGENT — ganti model = pindah ke
        // "tab" percakapan yang beda, bukan nyambung ke satu riwayat bersama.
        // Struktur: { [agentId]: { messages: [...record], history: [...] } }
        //   - messages: dipakai buat render ulang bubble pas pindah tab
        //   - history:  konteks {role, content} yang dikirim ke /api/agent-chat
        let agentChats = {};

        function ensureAgentChat(id) {
            if (!agentChats[id]) agentChats[id] = { messages: [], history: [] };
            return agentChats[id];
        }

        const agentEl = {
            agentRow: document.getElementById('agentRow'),
            modeTrack: document.getElementById('agentModeTrack'),
            messages: document.getElementById('agentMessages'),
            input: document.getElementById('agentComposerInput'),
            sendBtn: document.getElementById('agentSendBtn'),
            attachBtn: document.getElementById('agentAttachBtn'),
            fileInput: document.getElementById('agentFileInput'),
            attachSlot: document.getElementById('agentAttachPreviewSlot'),
            hint: document.getElementById('agentHintText'),
            newChatBtn: document.getElementById('agentNewChatBtn'),
        };

        function toggleAgentPanel() {
    if (isMember()) return;

    const panel = document.getElementById('agent-modal');
    if (!panel) return;

    panel.classList.toggle('hidden');

    if (!panel.classList.contains('hidden') && agentEl.input) {
        agentEl.input.focus();
    }
}

        /* ---------- render: agent chips ---------- */
        function renderAgents() {
            agentEl.agentRow.querySelectorAll('.agent-chip').forEach(n => n.remove());
            AGENTS.forEach(a => {
                const chip = document.createElement('button');
                chip.className = 'agent-chip' + (a.id === 'auto' ? ' auto' : '') + (agentState.agent === a.id ? ' active' : '');
                chip.innerHTML = `
                    <span class="agent-dot" style="background:${a.color || 'var(--grad)'}"></span>
                    ${esc(a.name)}
                    <span class="tag">${esc(a.tag)}</span>
                `;
                chip.onclick = () => {
                    if (agentState.agent === a.id) return; // udah di tab ini
                    agentState.agent = a.id;
                    renderAgents();
                    renderMessagesForAgent(a.id);
                };
                agentEl.agentRow.appendChild(chip);
            });
        }

        /* ---------- render: mode track ---------- */
        function renderModes() {
            agentEl.modeTrack.innerHTML = '';
            MODES.forEach(m => {
                const btn = document.createElement('button');
                btn.className = 'agent-mode-btn' + (agentState.mode === m.id ? ' active' : '');
                btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${m.icon}</svg>${esc(m.label)}`;
                btn.onclick = () => {
                    agentState.mode = m.id;
                    agentEl.input.placeholder = m.placeholder;
                    agentEl.attachBtn.style.display = (m.id === 'image') ? 'flex' : 'none';
                    renderModes();
                };
                agentEl.modeTrack.appendChild(btn);
            });
        }

        /* ---------- attach image ---------- */
        agentEl.attachBtn.onclick = () => agentEl.fileInput.click();
        agentEl.fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                agentState.attachedImage = { dataUrl: reader.result, name: file.name };
                renderAttachPreview();
            };
            reader.readAsDataURL(file);
        };
        function renderAttachPreview() {
            if (!agentState.attachedImage) { agentEl.attachSlot.innerHTML = ''; return; }
            agentEl.attachSlot.innerHTML = `
                <div class="agent-attach-preview">
                    <img src="${agentState.attachedImage.dataUrl}" />
                    <span>${esc(agentState.attachedImage.name)}</span>
                    <button id="agentRemoveAttach">${icon('x')}</button>
                </div>`;
            document.getElementById('agentRemoveAttach').onclick = () => {
                agentState.attachedImage = null; renderAttachPreview();
            };
        }

        /* ---------- message rendering ----------
           renderMessageNode() cuma bikin & nempel elemen DOM (nggak nyimpen
           apa-apa) — dipakai baik buat pesan baru maupun buat render ulang
           riwayat lama pas pindah tab.
           addMessage() yang nyimpen record ke chat milik agent tsb, BARU
           render ke layar kalau agent itu yang lagi kebuka (`forAgentId`,
           default ke tab yang lagi aktif). Kalau balasan model A baru
           datang sementara user udah pindah lihat tab B, tetap kesimpen di
           chat si A tapi nggak nongol dadakan di tab B.
        ---------- */
        function renderMessageNode({ role, kind = 'text', text = '', imgSrc = null, meta = null }) {
            const wrap = document.createElement('div');
            wrap.className = 'agent-msg ' + role;

            const bubble = document.createElement('div');
            bubble.className = 'agent-bubble';

            if (kind === 'code') {
                bubble.innerHTML = `<div class="agent-code-wrap"><pre class="agent-code-block"><code class="language-javascript"></code></pre><button class="agent-copy-btn">Copy</button></div>`;
                bubble.querySelector('code').textContent = text;
                bubble.querySelector('.agent-copy-btn').onclick = (ev) => {
                    navigator.clipboard.writeText(text);
                    ev.target.textContent = 'Copied';
                    setTimeout(() => ev.target.textContent = 'Copy', 1200);
                };
            } else if (kind === 'image') {
                bubble.innerHTML = `<img class="agent-result-img" src="${imgSrc}"/><div class="agent-img-caption">${esc(text)}</div>`;
            } else {
                bubble.textContent = text;
            }

            wrap.appendChild(bubble);

            if (meta) {
                const metaEl = document.createElement('div');
                metaEl.className = 'agent-meta';
                metaEl.innerHTML = `<span class="agent-meta-dot" style="background:${meta.color}"></span>${esc(meta.label)}`;
                wrap.appendChild(metaEl);
            }

            agentEl.messages.appendChild(wrap);
            agentEl.messages.scrollTop = agentEl.messages.scrollHeight;

            if (kind === 'code' && window.hljs) {
                wrap.querySelectorAll('pre code').forEach(b => hljs.highlightElement(b));
            }
            return wrap;
        }

        function addMessage(record, forAgentId = agentState.agent) {
            ensureAgentChat(forAgentId).messages.push(record);
            // Cuma render langsung ke layar kalau tab si agent itu yang lagi kebuka.
            if (forAgentId === agentState.agent) {
                return renderMessageNode(record);
            }
            return null;
        }

        function renderMessagesForAgent(id) {
            agentEl.messages.innerHTML = '';
            const chat = ensureAgentChat(id);
            if (chat.messages.length === 0) {
                seedAgentWelcome(); // agentState.agent udah = id di titik ini, jadi kesimpen di chat yang bener
            } else {
                chat.messages.forEach(record => renderMessageNode(record));
            }
            agentEl.messages.scrollTop = agentEl.messages.scrollHeight;
        }

        function addTyping() {
            const wrap = document.createElement('div');
            wrap.className = 'agent-msg assistant';
            wrap.id = 'agentTypingIndicator';
            wrap.innerHTML = `<div class="agent-bubble"><div class="agent-typing"><span></span><span></span><span></span></div></div>`;
            agentEl.messages.appendChild(wrap);
            agentEl.messages.scrollTop = agentEl.messages.scrollHeight;
        }
        function removeTyping() {
            document.getElementById('agentTypingIndicator')?.remove();
        }

       /* ---------- backend integration ---------- */
        async function callAgent({ agent, mode, prompt, image }) {
            const t0 = Date.now();
            let res;
            try {
                res = await fetch('/api/agent-chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        agent, mode, prompt,
                        image: image ? image.dataUrl : null,
                        history: ensureAgentChat(agent).history,
                    }),
                });
            } catch (networkErr) {
                // Fetch gagal total (endpoint belum ada / tidak terjangkau sama sekali)
                // -> fallback ke mock, biar panel tetap kerasa hidup pas dev lokal.
                console.warn('[agent-panel] /api/agent-chat tidak terjangkau, pakai mock:', networkErr.message);
                return mockCallAgent({ agent, mode, prompt, image });
            }

            if (!res.ok) {
                // Endpoint ADA tapi balikin error (500, quota habis, key salah, dll)
                // -> jangan mock, kasih tau user secara jujur & ramah.
                let detail = '';
                try { const errBody = await res.json(); detail = errBody?.error || ''; } catch (e) {}

                const friendlyMap = {
                    401: 'Model ini butuh API key yang valid, tapi sepertinya belum terpasang atau salah.',
                    403: 'Akses ke model ini ditolak. Cek key atau restriction di dashboard provider.',
                    429: 'Model ini lagi kena limit permintaan (rate limit). Coba lagi sebentar ya.',
                    500: 'Ada gangguan teknis waktu manggil model. Coba lagi, atau pilih model lain dulu.',
                    502: 'Server model lagi nggak merespons dengan benar. Coba lagi sebentar lagi.',
                    503: 'Model ini lagi nggak tersedia (kemungkinan quota/key habis). Coba ganti ke model lain.',
                };
                const friendlyMsg = friendlyMap[res.status]
                    || 'Waduh, semua model lagi susah dihubungi. Coba lagi sebentar ya, atau cek koneksi API di pengaturan.';

                const err = new Error(friendlyMsg + (detail ? ` (${detail})` : ''));
                err.isApiError = true;
                throw err;
            }

            const data = await res.json();
            return {
                kind: data.kind || (mode === 'image' ? 'image' : mode === 'code' ? 'code' : 'text'),
                agentUsed: AGENTS.find(a => a.id === agent) || AGENTS[0],
                ms: data.ms ?? (Date.now() - t0),
                text: data.text,
                imgSrc: data.imgSrc,
                modelUsedLabel: data.modelUsed, // nama model asli yg dipakai router, kalau ada
            };
        }

        async function mockCallAgent({ agent, mode, prompt, image }) {
            const routedAgent = agent === 'auto'
                ? AGENTS.filter(a => a.id !== 'auto')[Math.floor(Math.random() * 2)]
                : AGENTS.find(a => a.id === agent);
            const ms = 140 + Math.floor(Math.random() * 380);
            await new Promise(r => setTimeout(r, 500 + Math.random() * 500));

            if (mode === 'code') {
                return {
                    kind: 'code', agentUsed: routedAgent, ms,
                    text:
`function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// contoh pemakaian
const onSearch = debounce((q) => {
  console.log("mencari:", q);
}, 400);`
                };
            }

            if (mode === 'image') {
                const outUrl = await mockEditImage(image);
                return { kind: 'image', agentUsed: routedAgent, ms, imgSrc: outUrl,
                    text: image ? 'Hasil edit gambar (simulasi filter, ganti dengan hasil model gambar asli).' : 'Belum ada gambar dilampirkan — ini contoh output placeholder.' };
            }

            return {
                kind: 'text', agentUsed: routedAgent, ms,
                text: `Ini balasan contoh dari ${routedAgent.name} untuk: "${prompt}". Ganti fungsi callAgent() di kode ini dengan request ke endpoint backend kamu.`
            };
        }

        function mockEditImage(image) {
            return new Promise(resolve => {
                if (!image) {
                    const canvas = document.createElement('canvas');
                    canvas.width = 320; canvas.height = 200;
                    const ctx = canvas.getContext('2d');
                    const g = ctx.createLinearGradient(0, 0, 320, 200);
                    g.addColorStop(0, '#7c5cff'); g.addColorStop(1, '#2E8BFF');
                    ctx.fillStyle = g; ctx.fillRect(0, 0, 320, 200);
                    resolve(canvas.toDataURL());
                    return;
                }
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width; canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.filter = 'contrast(1.15) saturate(1.35) hue-rotate(8deg)';
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL());
                };
                img.src = image.dataUrl;
            });
        }

        /* ---------- send flow ---------- */
        async function handleSend() {
            const prompt = agentEl.input.value.trim();
            if (!prompt || agentState.busy) return;

            // Kunci agent & mode di titik ini — kalau user pindah tab sementara
            // nunggu balasan, balasannya tetap nyasar ke chat yang BENER
            // (bukan ke tab yang kebetulan lagi kebuka pas response-nya nyampe).
            const originAgent = agentState.agent;
            const originMode = agentState.mode;

            addMessage({ role: 'user', text: prompt }, originAgent);
            if (agentState.attachedImage) {
                addMessage({ role: 'user', kind: 'image', imgSrc: agentState.attachedImage.dataUrl, text: agentState.attachedImage.name }, originAgent);
            }
            const attachedImg = agentState.attachedImage;
            agentEl.input.value = '';
            agentState.attachedImage = null;
            renderAttachPreview();
            agentAutosize();
            agentState.busy = true;
            agentEl.sendBtn.disabled = true;
            if (originAgent === agentState.agent) addTyping();

            try {
                const result = await callAgent({ agent: originAgent, mode: originMode, prompt, image: attachedImg });

                if (originAgent === agentState.agent) removeTyping();
                const shownName = result.modelUsedLabel || result.agentUsed.name;
                addMessage({
                    role: 'assistant',
                    kind: result.kind,
                    text: result.text,
                    imgSrc: result.imgSrc,
                    meta: {
                        color: result.agentUsed.color || 'var(--secondary)',
                        label: originAgent === 'auto'
                            ? `Auto → dialihkan ke ${shownName} · ${result.ms}ms`
                            : `via ${shownName} · ${result.ms}ms`
                    }
                }, originAgent);

                // simpan konteks buat multi-turn (mode chat/code aja, gambar nggak perlu),
                // masuk ke riwayat milik agent ASALNYA, bukan tab yang lagi kebuka sekarang.
                if (originMode !== 'image' && typeof result.text === 'string') {
                    const chat = ensureAgentChat(originAgent);
                    chat.history.push({ role: 'user', content: prompt });
                    chat.history.push({ role: 'assistant', content: result.text });
                    if (chat.history.length > 20) chat.history = chat.history.slice(-20);
                }
            } catch (err) {
                // Error asli dari API (bukan mock) -> tampilkan bubble merah, jujur ke user.
                if (originAgent === agentState.agent) removeTyping();
                const bubble = addMessage({
                    role: 'assistant',
                    text: err.message || 'Terjadi kesalahan yang tidak diketahui.',
                    meta: { color: 'var(--danger)', label: 'Gagal mendapat balasan' }
                }, originAgent);
                if (bubble) {
                    bubble.querySelector('.agent-bubble').style.borderColor = 'var(--danger-line)';
                    bubble.querySelector('.agent-bubble').style.background = 'var(--danger-dim)';
                }
            }

            agentState.busy = false;
            agentEl.sendBtn.disabled = false;
        }

        agentEl.sendBtn.onclick = handleSend;
        agentEl.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
        });
        function agentAutosize() {
            agentEl.input.style.height = 'auto';
            agentEl.input.style.height = Math.min(agentEl.input.scrollHeight, 120) + 'px';
        }
        agentEl.input.addEventListener('input', agentAutosize);

        agentEl.newChatBtn.onclick = () => {
            // "Chat baru" cuma reset chat milik model yang lagi aktif —
            // chat model lain (di tab lain) tetap utuh, nggak ikut kehapus.
            agentChats[agentState.agent] = { messages: [], history: [] };
            agentEl.messages.innerHTML = '';
            seedAgentWelcome();
        };

        function seedAgentWelcome() {
            addMessage({
                role: 'assistant',
                text: 'Halo! Pilih agent & mode di atas, terus mulai chat. Mode Code buat generate/jelasin kode, mode Gambar buat edit gambar (lampirkan file dulu).',
                meta: { color: 'var(--primary)', label: 'AI Agent' }
            });
        }

        renderAgents();
        renderModes();
        renderMessagesForAgent(agentState.agent);
