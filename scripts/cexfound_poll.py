"""
CEX Found poller — dijalankan GitHub Actions tiap 5 menit.
Baca pesan terbaru dari channel sumber, parse, kirim ke dashboard AirdropXI.
Dedup 24 jam per ticker+exchange sudah ditangani server (admin-airdrop.js).
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
LOOKBACK_MIN = int(os.environ.get("LOOKBACK_MIN", "30"))  # > interval cron, biar gak ada yang kelewat

EXCHANGES = [
    "Binance", "Bybit", "OKX", "Bitget", "MEXC", "Gate", "KuCoin", "Coinbase",
    "Upbit", "Bithumb", "HTX", "Kraken", "WEEX", "Ourbit", "BingX", "Aster",
    "Hyperliquid", "Crypto.com", "Bitfinex", "Phemex", "LBank", "Poloniex",
]
NETWORKS = [
    "Solana", "Ethereum", "BSC", "BNB Chain", "Base", "Arbitrum", "Optimism",
    "Polygon", "Avalanche", "TON", "Tron", "Sui", "Aptos", "Linea", "zkSync",
]
TICKER_RE = re.compile(r"\$([A-Za-z0-9]{2,12})\b")


def parse(text: str):
    m = TICKER_RE.search(text)
    if not m:
        return None
    exchange = next((e for e in EXCHANGES if re.search(rf"\b{re.escape(e)}\b", text, re.I)), None)
    if not exchange:
        return None
    networks = [n for n in NETWORKS if re.search(rf"\b{re.escape(n)}\b", text, re.I)]
    first = next((l.strip() for l in text.splitlines() if l.strip()), "")
    return {
        "name": re.sub(r"[*_`#>]", "", first)[:80],
        "ticker": m.group(1).upper(),
        "exchange": exchange,
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
    async with TelegramClient(StringSession(SESSION), API_ID, API_HASH) as client:
        await client.get_dialogs()  # isi cache entity, wajib buat grup private
        for ch in CHANNELS:
            sent = 0
            async for msg in client.iter_messages(ch, limit=40):
                if msg.date < since:
                    break
                text = msg.message or ""
                print(f"[MSG:{ch}] id={msg.id} len={len(text)}")
                p = parse(text)
                if p:
                    post_alert(p)
                    sent += 1
            print(f"[{ch}] selesai, {sent} alert dikirim")


asyncio.run(main())
