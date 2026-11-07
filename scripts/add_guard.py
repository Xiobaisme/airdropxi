from pathlib import Path
import re

GUARD = '<style>html{visibility:hidden}</style>\n    <script src="/js/guard.js"></script>\n'
ADMIN = {"broadcast", "agent"}

for f in Path("pages").glob("*.html"):
    t = f.read_text(encoding="utf-8")
    if "/js/guard.js" not in t:
        t = t.replace("<head>", "<head>\n    " + GUARD, 1)
    if f.stem in ADMIN and "data-require" not in t:
        t = t.replace('<html lang="id">', '<html lang="id" data-require="admin">', 1)
    if f.stem == "news":
        t = re.sub(r'[ \t]*<button[^>]*onclick="logout\(\)"[^>]*>Logout</button>\n?', '', t)
    f.write_text(t, encoding="utf-8")
    print("OK", f)