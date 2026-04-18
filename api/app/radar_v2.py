import json
import math
import time
from urllib.request import urlopen

FUTURES_BASE = "https://fapi.binance.com"

_CACHE = {}


def _fetch_json(url: str):
    with urlopen(url, timeout=15) as response:
        return json.loads(response.read().decode("utf-8"))


def _cached(key: str, ttl: int, builder):
    now = time.time()
    item = _CACHE.get(key)
    if item and (now - item["ts"] < ttl):
        return item["data"]

    data = builder()
    _CACHE[key] = {"ts": now, "data": data}
    return data


def _fmt_money(value: float) -> str:
    if value >= 1_000_000_000:
        return f"${value / 1_000_000_000:.2f}B"
    if value >= 1_000_000:
        return f"${value / 1_000_000:.2f}M"
    if value >= 1_000:
        return f"${value / 1_000:.2f}K"
    return f"${value:.0f}"


def _fetch_allowed_symbols():
    data = _fetch_json(f"{FUTURES_BASE}/fapi/v1/exchangeInfo")
    rows = data.get("symbols", [])

    allowed = set()
    for row in rows:
        if row.get("status") != "TRADING":
            continue
        if row.get("contractType") != "PERPETUAL":
            continue
        if row.get("quoteAsset") != "USDT":
            continue
        symbol = row.get("symbol", "")
        if symbol:
            allowed.add(symbol)

    return allowed


def _fetch_tickers():
    allowed = _cached("radar_allowed_symbols", 900, _fetch_allowed_symbols)
    raw = _fetch_json(f"{FUTURES_BASE}/fapi/v1/ticker/24hr")

    items = []
    for row in raw:
        symbol = row.get("symbol", "")
        if symbol not in allowed:
            continue

        try:
            change_pct = float(row.get("priceChangePercent", 0) or 0)
            quote_volume = float(row.get("quoteVolume", 0) or 0)
            last_price = float(row.get("lastPrice", 0) or 0)
            trades = int(float(row.get("count", 0) or 0))
        except Exception:
            continue

        if quote_volume < 2_000_000:
            continue
        if last_price <= 0:
            continue

        score = round(
            abs(change_pct) * 1.9
            + min(22.0, math.log10(max(quote_volume, 1.0)) * 3.6)
            + min(8.0, math.log10(max(trades, 1.0)) * 1.2),
            2,
        )

        confidence = int(
            max(
                58,
                min(
                    95,
                    58
                    + abs(change_pct) * 2.0
                    + min(12.0, math.log10(max(quote_volume, 1.0)) * 1.4),
                ),
            )
        )

        items.append(
            {
                "symbol": symbol,
                "displaySymbol": f"{symbol}.P",
                "direction": "long" if change_pct >= 0 else "short",
                "score": score,
                "confidence": confidence,
                "lastPrice": round(last_price, 6),
                "changePct": round(change_pct, 2),
                "quoteVolume": _fmt_money(quote_volume),
                "trades": trades,
                "market": "futures",
            }
        )

    return items


def build_radar_v2():
    rows = _cached("radar_tickers", 15, _fetch_tickers)

    longs = sorted(
        [x for x in rows if x["direction"] == "long"],
        key=lambda x: (x["score"], x["trades"]),
        reverse=True,
    )[:4]

    shorts = sorted(
        [x for x in rows if x["direction"] == "short"],
        key=lambda x: (x["score"], x["trades"]),
        reverse=True,
    )[:4]

    items = longs + shorts
    items.sort(key=lambda x: x["score"], reverse=True)
    return items
