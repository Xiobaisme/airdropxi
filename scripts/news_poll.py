"""
News poller — dijalankan GitHub Actions (dipicu cron-job.org).
Sumber:
  1) Channel Telegram publik  (NEWS_CHANNELS)
  2) Tree News via REST history (TREE_NEWS=1)  -> delayed, bukan realtime
Semua dikirim ke /api/news-queue. Dedup ditangani server lewat msg_id.
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

import requests
from telethon import TelegramClient
from telethon.sessions import StringSession

API_ID = int(os.environ["TG_API_ID"])
API_HASH = os.environ["TG_API_HASH"]
SESSION = os.environ["TG_SESSION"]
ALERT_SECRET = os.environ["ALERT_SECRET"]
API_URL = os.environ.get("NEWS_API_URL", "https://airdropxi.vercel.app/api/news-queue")

# Format: "lookonchain=lookonchainchannel,investigations=investigations,..."
# Kiri  = nama source yang dibaca dashboard (jangan diubah)
# Kanan = username channel Telegram
SOURCES = {}
for pair in os.environ["NEWS_CHANNELS"].split(","):
    if "=" in pair:
        k, v = pair.split("=", 1)
        SOURCES[k.strip().lower()] = v.strip().lstrip("@")

LOOKBACK_MIN = int(os.environ.get("LOOKBACK_MIN") or "30")  # backfill 3 hari = 4320
MSG_LIMIT = 1000

TREE_ENABLED = os.environ.get("TREE_NEWS") == "1"
TREE_URL = os.environ.get("TREE_API_URL", "https://news.treeofalpha.com/api/news?limit=200")


def post_news(p: dict) -> bool:
    try:
        r = requests.post(
            API_URL,
            json=p,
            headers={"x-secret": ALERT_SECRET, "Content-Type": "application/json"},
            timeout=15,
        )
        print(f"[POST] {p['source']}:{p['msg_id']} -> {r.status_code} {r.text[:80]}")
        return r.ok
    except requests.RequestException as e:
        print(f"[POST-ERR] {p['source']}:{p['msg_id']} -> {e}")
        return False


def fetch_tree(since_ms: int):
    r = requests.get(TREE_URL, timeout=20)
    r.raise_for_status()
    out = []
    for n in r.json():
        t = int(n.get("time") or 0)
        if t < since_ms:
            continue
        title = (n.get("title") or "").strip()
        body = (n.get("body") or "").strip()
        text = f"{title}\n{body}".strip() if body else title
        if len(text) < 10:
            continue
        out.append(
            {
                "source": "treenews",
                "text": text,
                "link": n.get("link") or "",
                "posted_at": t,
                "msg_id": str(n.get("_id") or t),
            }
        )
    return sorted(out, key=lambda x: x["posted_at"])  # paling lama dulu


async def main():
    since = datetime.now(timezone.utc) - timedelta(minutes=LOOKBACK_MIN)
    print(f"Lookback: {LOOKBACK_MIN} menit, source: {', '.join(SOURCES)}")
    failed = 0

    async with TelegramClient(StringSession(SESSION), API_ID, API_HASH) as client:
        for source, username in SOURCES.items():
            posts, total = [], 0
            try:
                async for msg in client.iter_messages(username, limit=MSG_LIMIT):
                    if msg.date < since:
                        break
                    total += 1
                    text = (msg.message or "").strip()
                    if len(text) < 10:  # skip pesan kosong / gambar tanpa caption
                        continue
                    posts.append(
                        {
                            "source": source,
                            "text": text,
                            "link": f"https://t.me/{username}/{msg.id}",
                            "posted_at": int(msg.date.timestamp() * 1000),
                            "msg_id": str(msg.id),
                        }
                    )
            except Exception as e:  # satu channel error jangan bikin yang lain batal
                print(f"[{source}] GAGAL baca @{username}: {e}")
                failed += 1
                continue
            for p in reversed(posts):  # paling lama dulu
                if not post_news(p):
                    failed += 1
            print(f"[{source}] total={total}, kirim={len(posts)}")

    if TREE_ENABLED:
        try:
            posts = fetch_tree(int(since.timestamp() * 1000))
            for p in posts:
                if not post_news(p):
                    failed += 1
            print(f"[treenews] kirim={len(posts)}")
        except Exception as e:
            print(f"[treenews] gagal: {e}")
            failed += 1

    if failed:
        print(f"{failed} error")
        sys.exit(1)  # run di Actions jadi merah kalau ada yang gagal


if __name__ == "__main__":
    asyncio.run(main())
