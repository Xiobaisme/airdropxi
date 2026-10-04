"""
CEX Found poller — dijalankan GitHub Actions tiap 5 menit.
Baca pesan terbaru dari grup sumber, parse, kirim ke dashboard AirdropXI.

Aturan utama: SETIAP pesan yang mengandung "Found in" harus terkirim.
Exchange & Networks bebas/beda-beda. Networks cuma tambahan opsional.

Dedup 24 jam per ticker+exchange ditangani server (admin-airdrop.js).
"""
import asyncio
import os
import re
import sys
from datetime import datetime, timedelta, timezone

import requests
from telethon import TelegramClient
from telethon.sessions import StringSession

API_ID = int(os.environ["TG_API_ID"])
API_HASH = os.environ["TG_API_HASH"]
SESSION = os.environ["TG_SESSION"]
ALERT_SECRET = os.environ["ALERT_SECRET"]
API_URL = os.environ.get(
    "CEXFOUND_API_URL",
    "https://airdropxi.vercel.app/api/admin-airdrop?type=cex-found",
)


def _ch(c):
    c = c.strip().lstrip("@")
    return int(c) if c.lstrip("-").isdigit() else c


CHANNELS = [_ch(c) for c in os.environ["SOURCE_CHANNELS"].split(",") if c.strip()]
# Default 30 menit (> interval cron). Backfill: isi 4320 = 3 hari (lewat Run workflow).
LOOKBACK_MIN = int(os.environ.get("LOOKBACK_MIN") or "30")
MSG_LIMIT = 2000  # grup ini ramai, 3 hari bisa lebih dari 500 pesan

# Format B: "Concrete ($CT) Found in OKX"
INLINE_RE = re.compile(
    r"^\W*(?P<name>.+?)\s*\(\s*\$?(?P<ticker>[A-Za-z0-9]{1,15})\s*\)\s*Found in\s+(?P<exchange>.+?)\s*$",
    re.I,
)
# Format A header: "New Found in HTX"
HEADER_RE = re.compile(r"^\W*(?:New\s+)?Found in\s+(?P<exchange>.+?)\s*$", re.I)
# Format A token (di bawah header): "Dolphin ($POD)"
TOKEN_RE = re.compile(
    r"^\W*(?P<name>[^()]+?)\s*\(\s*\$?(?P<ticker>[A-Za-z0-9]{1,15})\s*\)\s*$"
)
NETWORKS_RE = re.compile(r"^\W*Networks?\s*:\s*(?P<nets>.+?)\s*$", re.I)

# Fallback longgar
FOUND_ANY_RE = re.compile(r"Found in\s+(?P<exchange>[^\n]+)", re.I)
TICKER_ANY_RE = re.compile(r"\$(?P<ticker>[A-Za-z0-9]{1,15})")
NETS_ANY_RE = re.compile(r"Networks?\s*:\s*(?P<nets>[^\n]+)", re.I)


def _item(name, ticker, exchange, networks=None):
    return {
        "name": (name or "Unknown").strip()[:80] or "Unknown",
        "ticker": (ticker or "UNKNOWN").upper(),
        "exchange": (exchange or "Unknown").strip(" `*_.") or "Unknown",
        "networks": networks or [],
    }


def _split_nets(s: str):
    return [n.strip(" _") for n in re.split(r"[,;]", s) if n.strip(" _")]


def parse(text: str):
    """Parser rapi. Support:
    A) 'New Found in HTX' + baris 'Dolphin ($POD)' (bisa banyak token)
    B) 'Concrete ($CT) Found in OKX' + 'Networks: CT-ERC20'
    Footer seperti 'Notifer: @CexAlerts' otomatis diabaikan.
    Header tanpa token di bawahnya tetap dikirim (ticker dari $ di pesan / UNKNOWN).
    """
    clean = re.sub(r"[*`]", "", text)
    any_tk = TICKER_ANY_RE.search(clean)
    items, last = [], None
    cur_ex, header_used = None, True

    def flush_header():
        if cur_ex and not header_used:
            items.append(_item("Unknown", any_tk["ticker"] if any_tk else "UNKNOWN", cur_ex))

    for line in clean.splitlines():
        line = line.strip()
        if not line:
            continue
        if m := INLINE_RE.match(line):
            last = _item(m["name"], m["ticker"], m["exchange"])
            items.append(last)
        elif m := HEADER_RE.match(line):
            flush_header()
            cur_ex, header_used = m["exchange"], False
        elif m := NETWORKS_RE.match(line):
            if last:
                last["networks"] = _split_nets(m["nets"])
        elif cur_ex and (m := TOKEN_RE.match(line)):
            last = _item(m["name"], m["ticker"], cur_ex)
            items.append(last)
            header_used = True
    flush_header()
    return items


def parse_any(text: str):
    """Selalu hasilkan alert kalau ada 'Found in', walau formatnya aneh."""
    items = parse(text)
    if items:
        return items
    if "found in" not in text.lower():
        return []
    clean = re.sub(r"[*`]", "", text)
    ex = FOUND_ANY_RE.search(clean)
    tk = TICKER_ANY_RE.search(clean)
    nets = NETS_ANY_RE.search(clean)
    first = next((l.strip() for l in clean.splitlines() if l.strip()), "")
    p = _item(
        re.sub(r"\(.*", "", first).strip(),
        tk["ticker"] if tk else None,
        ex["exchange"] if ex else None,
        _split_nets(nets["nets"]) if nets else [],
    )
    p["raw"] = clean[:500]
    return [p]


def post_alert(p: dict) -> bool:
    try:
        r = requests.post(
            API_URL,
            json=p,
            headers={"x-secret": ALERT_SECRET, "Content-Type": "application/json"},
            timeout=15,
        )
        print(f"[POST] {p['ticker']} @ {p['exchange']} -> {r.status_code} {r.text[:120]}")
        return r.ok
    except requests.RequestException as e:
        print(f"[POST-ERR] {p['ticker']} @ {p['exchange']} -> {e}")
        return False


async def main():
    since = datetime.now(timezone.utc) - timedelta(minutes=LOOKBACK_MIN)
    print(f"Lookback: {LOOKBACK_MIN} menit")
    failed = 0
    async with TelegramClient(StringSession(SESSION), API_ID, API_HASH) as client:
        await client.get_dialogs()  # isi cache entity, wajib buat grup private
        for ch in CHANNELS:
            found = []
            total = 0
            async for msg in client.iter_messages(ch, limit=MSG_LIMIT):
                if msg.date < since:
                    break
                total += 1
                text = msg.message or ""
                items = parse_any(text)
                for p in items:
                    p["ts"] = int(msg.date.timestamp() * 1000)  # waktu asli pesan
                    found.append(p)
                if "found in" in text.lower() and any(i["ticker"] == "UNKNOWN" for i in items):
                    # cuma log pesan yang ga ke-parse rapi (jangan print semua pesan, repo bisa public)
                    print(f"[FALLBACK] id={msg.id} {text[:120]!r}")
            # kirim dari yang paling lama biar urutan di dashboard benar
            for p in reversed(found):
                if not post_alert(p):
                    failed += 1
            print(f"[{ch}] total={total}, alert={len(found)}")
    if failed:
        print(f"{failed} alert gagal dikirim")
        sys.exit(1)  # biar run di Actions jadi merah kalau ada POST gagal


if __name__ == "__main__":
    asyncio.run(main())
