import asyncio
import json
import threading
import time
from typing import Any

import websockets

STREAM_CACHE = {
    "liquidations": {},
    "book_ticker": {},
    "mark_price": {},
    "status": {
        "market": "starting",
        "public": "starting",
        "last_market_msg": 0.0,
        "last_public_msg": 0.0,
    },
}

_LOCK = threading.RLock()
_STARTED = False


def _set_status(key: str, value: str):
    with _LOCK:
        STREAM_CACHE["status"][key] = value


def _set_last_msg(key: str):
    with _LOCK:
        STREAM_CACHE["status"][key] = time.time()


def get_liquidation_snapshot(symbol: str) -> dict | None:
    with _LOCK:
        item = STREAM_CACHE["liquidations"].get(symbol.upper())
        return dict(item) if item else None


def get_book_ticker_snapshot(symbol: str) -> dict | None:
    with _LOCK:
        item = STREAM_CACHE["book_ticker"].get(symbol.upper())
        return dict(item) if item else None


def get_mark_stream_snapshot(symbol: str) -> dict | None:
    with _LOCK:
        item = STREAM_CACHE["mark_price"].get(symbol.upper())
        return dict(item) if item else None


def get_stream_status() -> dict:
    with _LOCK:
        return dict(STREAM_CACHE["status"])


def _handle_liquidation(payload: dict[str, Any]):
    order = payload.get("o") or {}
    symbol = str(order.get("s", "")).upper().strip()
    if not symbol:
        return

    item = {
        "symbol": symbol,
        "side": str(order.get("S", "")).upper(),
        "qty": float(order.get("q", 0) or 0),
        "price": float(order.get("p", 0) or 0),
        "avgPrice": float(order.get("ap", 0) or 0),
        "tradeTime": int(order.get("T", 0) or 0),
        "eventTime": int(payload.get("E", 0) or 0),
        "ts": time.time(),
    }

    with _LOCK:
        STREAM_CACHE["liquidations"][symbol] = item


def _handle_book_ticker(payload: dict[str, Any]):
    symbol = str(payload.get("s", "")).upper().strip()
    if not symbol:
        return

    item = {
        "symbol": symbol,
        "bid": float(payload.get("b", 0) or 0),
        "bidQty": float(payload.get("B", 0) or 0),
        "ask": float(payload.get("a", 0) or 0),
        "askQty": float(payload.get("A", 0) or 0),
        "eventTime": int(payload.get("E", 0) or 0),
        "ts": time.time(),
    }

    with _LOCK:
        STREAM_CACHE["book_ticker"][symbol] = item


def _handle_mark_price(payload: dict[str, Any]):
    symbol = str(payload.get("s", "")).upper().strip()
    if not symbol:
        return

    item = {
        "symbol": symbol,
        "markPrice": float(payload.get("p", 0) or 0),
        "indexPrice": float(payload.get("i", 0) or 0),
        "fundingRate": float(payload.get("r", 0) or 0),
        "eventTime": int(payload.get("E", 0) or 0),
        "ts": time.time(),
    }

    with _LOCK:
        STREAM_CACHE["mark_price"][symbol] = item


async def _market_loop():
    url = "wss://fstream.binance.com/market/stream?streams=!forceOrder@arr/!markPrice@arr@1s"

    while True:
        try:
            _set_status("market", "connecting")
            async with websockets.connect(url, ping_interval=20, ping_timeout=20) as ws:
                _set_status("market", "open")
                async for raw in ws:
                    msg = json.loads(raw)
                    data = msg.get("data", msg)

                    if isinstance(data, list):
                        for item in data:
                            if item.get("e") == "markPriceUpdate":
                                _handle_mark_price(item)
                    elif isinstance(data, dict):
                        if data.get("e") == "forceOrder":
                            _handle_liquidation(data)
                        elif data.get("e") == "markPriceUpdate":
                            _handle_mark_price(data)

                    _set_last_msg("last_market_msg")
        except Exception:
            _set_status("market", "reconnecting")
            await asyncio.sleep(3)


async def _public_loop():
    url = "wss://fstream.binance.com/public/stream?streams=!bookTicker"

    while True:
        try:
            _set_status("public", "connecting")
            async with websockets.connect(url, ping_interval=20, ping_timeout=20) as ws:
                _set_status("public", "open")
                async for raw in ws:
                    msg = json.loads(raw)
                    data = msg.get("data", msg)

                    if isinstance(data, list):
                        for item in data:
                            if item.get("s"):
                                _handle_book_ticker(item)
                    elif isinstance(data, dict):
                        if data.get("s"):
                            _handle_book_ticker(data)

                    _set_last_msg("last_public_msg")
        except Exception:
            _set_status("public", "reconnecting")
            await asyncio.sleep(3)


def _runner():
    async def main():
        await asyncio.gather(
            _market_loop(),
            _public_loop(),
        )

    asyncio.run(main())


def start_stream_cache():
    global _STARTED
    with _LOCK:
        if _STARTED:
            return
        _STARTED = True

    thread = threading.Thread(target=_runner, daemon=True, name="ttook-stream-cache")
    thread.start()
