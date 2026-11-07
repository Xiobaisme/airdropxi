from pathlib import Path

root = Path(".")
src = (root / "admin.html").read_text(encoding="utf-8")

def cut(a, b):
    i = src.index(a)
    j = src.index(b)
    return src[i:j]

M_BROADCAST = "<!-- ─── BROADCAST MODAL"
M_NEWSSEND  = "<!-- ─── NEWS SEND MODAL"
M_IMGEDIT   = "<!-- ─── EDITOR GAMBAR BROADCAST"
M_CONFIRM   = "<!-- ─── CONFIRM MODAL"
M_AGENT     = "<!-- ─── AI AGENT PANEL"
M_CALC      = '<div id="calc-panel"'
M_NEWS      = "<!-- ─── NEWS TERMINAL"
M_WEEX      = "<!-- ─── WEEX PROMO MODAL"
M_PIN       = "<!-- ─── PIN MODAL"
M_LABFAB    = "<!-- ─── LAB MATERI: tombol"
M_LAB       = "<!-- ─── LAB MATERI: popup"
M_TOAST     = "<!-- ─── TOAST"

B = {
    "broadcast": cut(M_BROADCAST, M_NEWSSEND),
    "newssend":  cut(M_NEWSSEND, M_IMGEDIT),
    "imgedit":   cut(M_IMGEDIT, M_CONFIRM),
    "confirm":   cut(M_CONFIRM, M_AGENT),
    "agent":     cut(M_AGENT, M_CALC),
    "calc":      cut(M_CALC, M_NEWS),
    "news":      cut(M_NEWS, M_WEEX),
    "pin":       cut(M_PIN, M_LABFAB),
    "lab":       cut(M_LAB, M_TOAST),
}

PAGES = {
    "news": dict(
        title="News Terminal",
        blocks=["news", "newssend", "confirm", "pin"],
        js=["core", "news", "broadcast"],
        opener="toggleNewsPanel()",
        closers=["toggleNewsPanel"],
    ),
    "calc": dict(
        title="Calculator",
        blocks=["calc"],
        js=["core", "calc"],
        opener="toggleCalc()",
        closers=["toggleCalc"],
    ),
    "broadcast": dict(
        title="Broadcast",
        blocks=["broadcast", "imgedit", "confirm", "pin"],
        js=["core", "broadcast"],
        opener="openBroadcastModal()",
        closers=["closeBroadcastModal"],
    ),
    "agent": dict(
        title="AI Agent",
        blocks=["agent", "confirm"],
        js=["core", "agent"],
        opener="toggleAgentPanel()",
        closers=["toggleAgentPanel"],
    ),
    "lab": dict(
        title="Lab Materi",
        blocks=["lab"],
        js=["core", "lab"],
        opener="openLab()",
        closers=["closeLab"],
    ),
}

TEMPLATE = """<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>__TITLE__ · CMIC</title>
    <link rel="icon" type="image/svg+xml" href="/cmic-icon.svg" />
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/css/base.css">
    <link rel="stylesheet" href="/css/app.css">
    <link rel="stylesheet" href="/css/news.css">
    <link rel="stylesheet" href="/css/onchain.css">
    <link rel="stylesheet" href="/css/lab.css">
</head>
<body>

__BLOCKS__

    <div class="toast" id="toast"></div>

__SCRIPTS__
    <script>
        window.addEventListener('DOMContentLoaded', function () {
            __OPENER__;
            __CLOSERS__.forEach(function (n) {
                window[n] = function () { location.href = '/'; };
            });
        });
    </script>
</body>
</html>
"""

for name, p in PAGES.items():
    blocks = "\n".join(B[k] for k in p["blocks"])
    scripts = "\n".join(f'    <script src="/js/{j}.js"></script>' for j in p["js"])
    closers = "[" + ", ".join(f"'{c}'" for c in p["closers"]) + "]"
    html = (TEMPLATE
            .replace("__TITLE__", p["title"])
            .replace("__BLOCKS__", blocks)
            .replace("__SCRIPTS__", scripts)
            .replace("__OPENER__", p["opener"])
            .replace("__CLOSERS__", closers))
    out = root / "pages" / f"{name}.html"
    out.write_text(html, encoding="utf-8")
    print("OK ->", out, "|", len(html.splitlines()), "baris")