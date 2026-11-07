from pathlib import Path

adm = Path("admin.html")
t = adm.read_text(encoding="utf-8")

# 1. link profile.css
if "/css/profile.css" not in t:
    t = t.replace('<link rel="stylesheet" href="/css/footer.css">',
                  '<link rel="stylesheet" href="/css/footer.css">\n    <link rel="stylesheet" href="/css/profile.css">', 1)

# 2. ganti seluruh header nav atas
NEW_HEADER = '''<header class="lp-nav app-nav" id="app-nav">
            <div class="lp-nav-inner">
                <a class="lp-nav-logo" id="app-nav-logo" href="/"><img src="cmic-footer.svg" alt="CMIC"></a>

                <div class="lp-nav-links">
                    <a href="#" data-nav="market" onclick="showMarketDashboard()">Market</a>
                    <a href="#" data-nav="airdrop" data-role="admin" onclick="showAirdropDashboard()">Airdrop</a>
                    <a href="/news" id="news-toggle-btn"><span class="news-live-dot"></span>News Terminal</a>
                    <a href="/onchain" id="onchain-toggle-btn">Onchain</a>
                    <a href="#" id="btnWeexPromo"><span class="ourbit-fire">🔥</span> OURBIT</a>
                    <a href="/broadcast" id="broadcast-toggle-btn" data-role="admin">Broadcast</a>
                    <a href="/agent" id="agent-toggle-btn" data-role="admin">AI Agent</a>
                    <a href="/calc" id="calc-toggle-btn">Calc</a>
                </div>

                <div class="pf" id="pf">
                    <button class="pf-btn" id="pf-btn" type="button" aria-expanded="false">
                        <img class="pf-ava" id="pf-ava" alt="">
                        <span class="pf-name" id="pf-name">...</span>
                        <i>▾</i>
                    </button>
                    <div class="pf-pop hidden" id="pf-pop">
                        <div class="pf-head">
                            <img class="pf-ava big" id="pf-ava2" alt="">
                            <div><b id="pf-name2">-</b><small id="pf-sub">-</small></div>
                        </div>
                        <div class="pf-row"><span>Role</span><b id="pf-role">-</b></div>
                        <div class="pf-row"><span>Login via</span><b id="pf-via">-</b></div>
                        <div class="pf-row"><span>ID / Email</span><b id="pf-id">-</b></div>
                        <div class="pf-row"><span>Akun dibuat</span><b id="pf-created">-</b></div>
                        <div class="pf-row"><span>Join server</span><b id="pf-joined">-</b></div>
                        <button class="pf-logout" type="button" onclick="logout()">Logout</button>
                    </div>
                </div>
            </div>
        </header>'''

if 'id="pf-btn"' not in t:
    a = t.index('<header class="lp-nav app-nav" id="app-nav">')
    b = t.index('</header>', a) + len('</header>')
    t = t[:a] + NEW_HEADER + t[b:]

# 3. script profile.js
if "/js/profile.js" not in t:
    t = t.replace('<script src="/js/app-nav.js"></script>',
                  '<script src="/js/app-nav.js"></script>\n<script src="/js/profile.js"></script>', 1)

adm.write_text(t, encoding="utf-8")

# 4. css: sembunyikan menu admin dari member
css = Path("css/profile.css")
c = css.read_text(encoding="utf-8")
if "is-member" not in c:
    css.write_text(c.rstrip() + '\nbody.is-member [data-role="admin"]{display:none!important}\n', encoding="utf-8")

# 5. cek profile.js versi final
p = Path("js/profile.js").read_text(encoding="utf-8")
print("profile.js versi final:", "OK" if "pf-created" in p else "BELUM, ganti dengan versi final")
print("admin.html: pf-btn", 'id="pf-btn"' in t, "| profile.js", "/js/profile.js" in t, "| profile.css", "/css/profile.css" in t)