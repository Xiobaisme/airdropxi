from pathlib import Path

root = Path(".")
src = (root / "admin.html").read_text(encoding="utf-8")

start = src.index("<!-- ─── ONCHAIN TRACER")
end = src.index("<!-- ─── PIN MODAL")
block = src[start:end]

# di halaman sendiri tidak boleh 'hidden'
block = block.replace('id="onchain-modal" class="oc-screen hidden"',
                      'id="onchain-modal" class="oc-screen"')

page = f"""<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Onchain · CMIC</title>
    <link rel="icon" type="image/svg+xml" href="/cmic-icon.svg" />
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/css/base.css">
    <link rel="stylesheet" href="/css/app.css">
    <link rel="stylesheet" href="/css/onchain.css">
</head>
<body>

{block}

    <div class="toast" id="toast"></div>

    <script src="/js/core.js"></script>
    <script src="/js/onchain.js"></script>
    <script>
        window.addEventListener('DOMContentLoaded', function () {{
            window.closeOnchain = function () {{ location.href = '/admin'; }};
            openOnchain();
        }});
    </script>
</body>
</html>
"""

out = root / "pages" / "onchain.html"
out.write_text(page, encoding="utf-8")
print("OK ->", out, "|", len(block.splitlines()), "baris blok onchain")