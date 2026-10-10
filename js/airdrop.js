// ─── LOAD PROJECTS ───
        async function loadProjects() {
            try {
                const res = await fetch('/api/admin-airdrop');
                if (!res.ok) throw new Error('Gagal fetch data');
                projects = await res.json();
                renderStatusSummary();
                renderProjectLinks();
            } catch (e) {
                const list = document.getElementById('proj-links-list');
                if (list) {
                    list.innerHTML =
                        `<div class="empty-state">${icon('alert')}${esc(e.message)}</div>`;
                }
            }
        }

        // ─── STATUS SUMMARY + HERO METRICS (now clickable filters) ───
        function renderStatusSummary() {
            const wrap = document.getElementById('status-summary');
            if (!wrap) return;

            const total = projects.length;
            const live = projects.filter(p => p.published === true).length;
            const draft = total - live;
            const active = projects.filter(p => (p.status || '').toLowerCase().includes('active')).length;
            const waitlist = projects.filter(p => (p.status || '').toLowerCase().includes('wait')).length;
            const ended = projects.filter(p => (p.status || '').toLowerCase().includes('end') || (p.confirmation_status || '')
                .toLowerCase().includes('ended')).length;
            const confirmed = projects.filter(p => (p.confirmation_status || '').toLowerCase().includes('confirmed')).length;
            const potential = projects.filter(p => (p.confirmation_status || '').toLowerCase().includes('potential')).length;
            const hasLink = projects.filter(p => !!p.link).length;
            const noLink = total - hasLink;

            // [label, value, color, filterKey] — filterKey ties this block to setPLFilter()
            const blocks = [
                ['Total', total, 'var(--primary)', 'all'],
                ['Live', live, 'var(--success)', 'live'],
                ['Draft', draft, 'var(--danger)', 'draft'],
                ['Active', active, 'var(--success)', 'active'],
                ['Waitlist', waitlist, 'var(--danger)', 'waitlist'],
                ['Confirmed', confirmed, 'var(--primary)', 'confirmed'],
                ['Potential', potential, 'var(--secondary)', 'potential'],
                ['Ended', ended, 'var(--text3)', 'ended'],
                ['Ada Link', hasLink, 'var(--success)', 'haslink'],
                ['No Link', noLink, 'var(--secondary)', 'nolink'],
            ];

            wrap.innerHTML = blocks.map(([label, val, color, key]) =>
                `<div class="stat-block" data-filter="${key}" onclick="setPLFilter('${key}')"><div class="n" style="color:${color}">${val}</div><div class="l">${esc(label)}</div></div>`
            ).join('');

            syncFilterUI();

            // Animate hero metrics (top command deck numbers)
            animateCount(document.querySelector('[data-metric="total"]'), total);
            animateCount(document.querySelector('[data-metric="live"]'), live);
            animateCount(document.querySelector('[data-metric="draft"]'), draft);
            animateCount(document.querySelector('[data-metric="confirmed"]'), confirmed);
            animateCount(document.querySelector('[data-metric="nolink"]'), noLink);
        }

        // ─── FILTER ───
        // Baik stat-block (di panel atas) maupun ftab (tab filter) sama-sama pakai
        // data-filter + setPLFilter, jadi klik dari manapun tetap sinkron.
        function setPLFilter(mode) {
            _plFilter = mode;
            syncFilterUI();
            renderProjectLinks();
        }

        function syncFilterUI() {
            document.querySelectorAll('[data-filter]').forEach(el => {
                el.classList.toggle('active', el.dataset.filter === _plFilter);
            });
        }

        // ─── RENDER PROJECT LINKS ───
        function renderProjectLinks() {
            const list = document.getElementById('proj-links-list');
            const count = document.getElementById('proj-links-count');
            if (!list) return;

            let filtered = [...projects];
            if (_plFilter === 'active') filtered = filtered.filter(p => (p.status || '').toLowerCase().includes('active'));
            if (_plFilter === 'waitlist') filtered = filtered.filter(p => (p.status || '').toLowerCase().includes('wait'));
            if (_plFilter === 'ended') filtered = filtered.filter(p => (p.status || '').toLowerCase().includes('end') || (p
                .confirmation_status || '').toLowerCase().includes('ended'));
            if (_plFilter === 'confirmed') filtered = filtered.filter(p => (p.confirmation_status || '').toLowerCase()
                .includes('confirmed'));
            if (_plFilter === 'potential') filtered = filtered.filter(p => (p.confirmation_status || '').toLowerCase()
                .includes('potential'));
            if (_plFilter === 'nolink') filtered = filtered.filter(p => !p.link);
            if (_plFilter === 'haslink') filtered = filtered.filter(p => !!p.link);
            if (_plFilter === 'live') filtered = filtered.filter(p => p.published === true);
            if (_plFilter === 'draft') filtered = filtered.filter(p => p.published !== true);

            if (count) count.textContent = `${filtered.length}/${projects.length}`;

            if (!filtered.length) {
                list.innerHTML =
                    `<div class="empty-state">${icon('ghost')}Tidak ada proyek dengan filter ini.</div>`;
                return;
            }

            list.innerHTML = filtered.map((p, i) => {
                const hasLink = !!(p.link);
                const isLive = p.published === true;
                const confVal = (p.confirmation_status || '').toLowerCase();
                let confCls = '', confIcon = '', confLbl = '';
                if (confVal.includes('confirmed')) { confCls = 'confirmed'; confIcon = 'check'; confLbl = 'Conf'; }
                else if (confVal.includes('potential')) { confCls = 'potential'; confIcon = 'target'; confLbl = 'Pot'; }
                else if (confVal.includes('ended')) { confCls = 'ended'; confIcon = 'x'; confLbl = 'End'; }

                const tags = (p.tags || '').split(',').map(t => t.trim()).filter(Boolean);

                return `
                <div class="proj-card ${hasLink?'':'nolink'}" style="animation-delay:${Math.min(i,10)*0.03}s">
                    <div class="top">
                        <div class="logo-wrap">
                            ${p.logo_url ? `<img src="${esc(p.logo_url)}" data-fallback="1" />` : ICONS.box}
                        </div>
                        <div class="info">
                            <div class="name">${esc(p.name)}</div>
                            ${tags.length ? `<div class="tags">${tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
                        </div>
                    </div>
                    <div class="badges">
                        <span class="badge-status ${getStatusClass(p.status)}">${esc(p.status||'TBA')}</span>
                        <span class="badge-live ${isLive?'on':'off'}"><span class="dot"></span>${isLive?'LIVE':'DRAFT'}</span>
                        ${confCls ? `<span class="badge-conf ${confCls}">${icon(confIcon)}${confLbl}</span>` : ''}
                    </div>
                     ${(p.RaisedID || p.descriptionID) ? `<div class="body">
                    ${p.RaisedID ? `<div class="raised"><span>RAISED</span>${esc(p.RaisedID)}</div>` : ''}
                   ${p.descriptionID ? `<p class="desc">${esc(p.descriptionID)}</p>` : ''}
                </div>` : ''}
                    <div class="actions">
                        ${hasLink
                            ? `<a href="${esc(p.link)}" target="_blank" rel="noopener" class="link-btn">${icon('externalLink')}Buka Website</a>`
                            : `<span class="link-btn nolink">${icon('x')}Belum ada link</span>`
                        }
                        <button class="edit-btn" onclick="openEditModal(${p.id})">${icon('edit')}Edit</button>
                        <button class="edit-btn delete-btn" onclick="deleteProject(${p.id})">${icon('trash')}Hapus</button>
                    </div>
                </div>
            `;
            }).join('');
            list.querySelectorAll('img[data-fallback]').forEach(img => {
                img.addEventListener('error', () => { img.parentElement.innerHTML = ICONS.box; }, { once: true });
            });
    
        }

        // ─── EDIT MODAL ───
        function openEditModal(id) {
            const p = projects.find(x => x.id === id);
            if (!p) return;
            _editingId = id;

            // Fix: matching status pakai normalisasi (trim + case-insensitive)
            // supaya status yang beda casing/spasi di DB gak silently ke-reset ke opsi pertama.
            const currentNorm = normStatus(p.status);
            const matchedOption = STATUS_OPTIONS.find(s => normStatus(s) === currentNorm);

            const statusSel = document.getElementById('e-status');
            let optionsHtml = STATUS_OPTIONS.map(s =>
                `<option value="${esc(s)}" ${matchedOption === s ? 'selected' : ''}>${esc(s)}</option>`
            ).join('');

            // Kalau status di DB gak match opsi manapun, tambahkan sebagai opsi custom
            // supaya nilai aslinya tetap kelihatan & gak ketimpa diam-diam.
            if (!matchedOption && p.status) {
                optionsHtml = `<option value="${esc(p.status)}" selected>${esc(p.status)} (custom)</option>` + optionsHtml;
            }
            statusSel.innerHTML = optionsHtml;

            document.getElementById('edit-modal-title').innerHTML = `${icon('edit')}<span>Edit: ${esc(p.name || '—')}</span>`;
            document.getElementById('e-name').value = p.name || '';
            document.getElementById('e-tags').value = p.tags || '';
            document.getElementById('e-raisedid').value = p.RaisedID || '';
            document.getElementById('e-raisedn').value = p.RaisedEN || '';
            document.getElementById('e-descid').value = p.descriptionID || '';
            document.getElementById('e-descen').value = p.descriptionEN || '';
            document.getElementById('e-link').value = p.link || '';

            document.getElementById('edit-modal').classList.remove('hidden');
        }

        function closeEditModal() {
            _editingId = null;
            document.getElementById('edit-modal').classList.add('hidden');
        }

        async function saveEdit() {
            if (!_editingId) return;

            const name = document.getElementById('e-name')?.value?.trim() || null;
            if (!name) {
                showToast('Nama proyek wajib diisi!', 'error');
                return;
            }

            const payload = {
                name,
                status: document.getElementById('e-status')?.value || null,
                tags: document.getElementById('e-tags')?.value?.trim() || null,
                RaisedID: document.getElementById('e-raisedid')?.value?.trim() || null,
                RaisedEN: document.getElementById('e-raisedn')?.value?.trim() || null,
                descriptionID: document.getElementById('e-descid')?.value?.trim() || null,
                descriptionEN: document.getElementById('e-descen')?.value?.trim() || null,
                link: document.getElementById('e-link')?.value?.trim() || null,
            };

            const btn = document.getElementById('btn-save-edit');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner"></span> Menyimpan...';
            }

            try {
                const res = await fetch(`/api/admin-airdrop?id=${_editingId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || `HTTP ${res.status}`);
                }
                showToast('Perubahan tersimpan!', 'success');
                closeEditModal();
                await loadProjects();
            } catch (e) {
                showToast('Error: ' + e.message, 'error');
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = icon('save') + 'Simpan';
                }
            }
        }

        // ─── TAMBAH PROYEK ─────────────────────────────────────
        function openAddModal() {
            document.getElementById('a-name').value = '';
            document.getElementById('a-status').value = 'Active';
            document.getElementById('a-tags').value = '';
            document.getElementById('a-raisedid').value = '';
            document.getElementById('a-raisedn').value = '';
            document.getElementById('a-descid').value = '';
            document.getElementById('a-descen').value = '';
            document.getElementById('a-link').value = '';
            document.getElementById('add-modal').classList.remove('hidden');
        }

        function closeAddModal() {
            document.getElementById('add-modal').classList.add('hidden');
        }

        async function saveAdd() {
            const name = document.getElementById('a-name').value.trim();
            if (!name) {
                showToast('Nama proyek wajib diisi!', 'error');
                return;
            }

            const payload = {
                name,
                status: document.getElementById('a-status').value || null,
                tags: document.getElementById('a-tags').value.trim() || null,
                RaisedID: document.getElementById('a-raisedid').value.trim() || null,
                RaisedEN: document.getElementById('a-raisedn').value.trim() || null,
                descriptionID: document.getElementById('a-descid').value.trim() || null,
                descriptionEN: document.getElementById('a-descen').value.trim() || null,
                link: document.getElementById('a-link').value.trim() || null,
            };

            const btn = document.getElementById('btn-save-add');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner"></span> Menyimpan...';
            }

            try {
                const res = await fetch('/api/admin-airdrop', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || `HTTP ${res.status}`);
                }
                showToast('Proyek berhasil ditambahkan!', 'success');
                closeAddModal();
                await loadProjects();
            } catch (e) {
                showToast('Error: ' + e.message, 'error');
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = icon('rocket') + 'Tambah';
                }
            }
        }

        // ─── HAPUS PROYEK ─────────────────────────────────────
           async function deleteProject(id) {
           const ok = await showConfirmModal({
            title: 'Hapus Proyek?',
            message: 'Yakin ingin menghapus proyek ini? Tindakan ini tidak dapat dibatalkan.',
             okLabel: 'Ya, Hapus'
             });
             if (!ok) return;
            try {
                const res = await fetch(`/api/admin-airdrop?id=${id}`, { method: 'DELETE' });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || `HTTP ${res.status}`);
                }
                showToast('Proyek berhasil dihapus', 'success');
                loadProjects();
            } catch (e) {
                showToast('Error: ' + e.message, 'error');
            }
        }
