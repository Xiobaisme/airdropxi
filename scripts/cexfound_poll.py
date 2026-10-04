"""
CEX Found poller — dijalankan GitHub Actions tiap 5 menit.
Baca pesan terbaru dari grup sumber, parse, kirim ke dashboard AirdropXI.

Format pesan yang dikenali:
    Concrete ($CT) Found in OKX
    Networks: CT-ERC20

Dedup 24 jam per ticker+exchange ditangani server (admin-airdrop.js).
"""
import asyncio
import os
import re
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
MSG_LIMIT = 500

FOUND_RE = re.compile(
    r"^\s*(?P<name>.+?)\s*\(\$(?P<ticker>[A-Za-z0-9]{1,15})\)\s*Found in\s+(?P<exchange>.+?)\s*$",
    re.I,
)
NETWORKS_RE = re.compile(r"^\s*Networks?\s*:\s*(?P<nets>.+?)\s*$", re.I | re.M)


def parse(text: str):
    """'Concrete ($CT) Found in OKX' + 'Networks: CT-ERC20' -> dict, selain itu None."""
    first = next((l.strip() for l in text.splitlines() if l.strip()), "")
    first = re.sub(r"[*`]", "", first)
    m = FOUND_RE.match(first)
    if not m:
        return None
    nets = NETWORKS_RE.search(text)
    networks = (
        [n.strip() for n in re.split(r"[,;]", nets.group("nets")) if n.strip()]
        if nets
        else []
    )
    return {
        "name": m.group("name").strip()[:80],
        "ticker": m.group("ticker").upper(),
        "exchange": m.group("exchange").strip(),
        "networks": networks,
    }


def post_alert(p: dict):
    r = requests.post(
        API_URL,
        json=p,
        headers={"x-secret": ALERT_SECRET, "Content-Type": "application/json"},
        timeout=15,
    )
    print(f"[POST] {p['ticker']} @ {p['exchange']} -> {r.status_code} {r.text[:120]}")


async def main():
    since = datetime.now(timezone.utc) - timedelta(minutes=LOOKBACK_MIN)
    print(f"Lookback: {LOOKBACK_MIN} menit")
    async with TelegramClient(StringSession(SESSION), API_ID, API_HASH) as client:
        await client.get_dialogs()  # isi cache entity, wajib buat grup private
        for ch in CHANNELS:
            found = []
            async for msg in client.iter_messages(ch, limit=MSG_LIMIT):
                if msg.date < since:
                    break
                text = msg.message or ""
                print(f"[MSG:{ch}] id={msg.id} len={len(text)}")
                p = parse(text)
                if p:
                    p["ts"] = int(msg.date.timestamp() * 1000)  # waktu asli pesan
                    found.append(p)
            for p in reversed(found):  # kirim dari yang paling lama biar urutan di dashboard benar
                post_alert(p)
            print(f"[{ch}] selesai, {len(found)} alert dikirim")


if __name__ == "__main__":
    asyncio.run(main())
