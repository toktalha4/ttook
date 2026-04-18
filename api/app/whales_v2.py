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


def _fmt_num(value: float) -> str:
    if value >= 1_000_000:
        return f"{value / 1_000_000:.2f}M"
    if value >= 1_000:
        return f"{value / 1_000:.2f}K"
    return f"{value:.0f}"


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
    allowed = _cached("whales_allowed_symbols", 900, _fetch_allowed_symbols)
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

        if quote_volume < 3_000_000:
            continue
        if last_price <= 0:
            continue

        items.append(
            {
                "symbol": symbol,
                "changePct": round(change_pct, 2),
                "quoteVolumeRaw": quote_volume,
                "quoteVolume": _fmt_money(quote_volume),
                "lastPrice": round(last_price, 6),
                "trades": trades,
            }
        )

    return items


def _fetch_mark_prices():
    raw = _fetch_json(f"{FUTURES_BASE}/fapi/v1/premiumIndex")
    data = {}

    if isinstance(raw, list):
        for row in raw:
            symbol = row.get("symbol", "")
            if not symbol:
                continue
            try:
                mark_price = float(row.get("markPrice", 0) or 0)
                index_price = float(row.get("indexPrice", 0) or 0)
                funding_rate = float(row.get("lastFundingRate", 0) or 0)
            except Exception:
                continue

            if index_price <= 0:
                basis_bps = 0.0
            else:
                basis_bps = ((mark_price - index_price) / index_price) * 10000.0

            data[symbol] = {
                "markPrice": round(mark_price, 6),
                "indexPrice": round(index_price, 6),
                "fundingRate": funding_rate,
                "basisBps": round(basis_bps, 2),
            }

    return data


def _fetch_open_interest(symbol: str):
    raw = _fetch_json(f"{FUTURES_BASE}/fapi/v1/openInterest?symbol={symbol}")
    return float(raw.get("openInterest", 0) or 0)


def _classify(change_pct: float, funding_rate: float, basis_bps: float):
    if change_pct >= 2.5 and funding_rate > 0 and basis_bps > 0:
        return "Agresif Long Birikimi", "Fiyat, funding ve basis aynı yönde güçleniyor."
    if change_pct <= -2.5 and funding_rate < 0 and basis_bps < 0:
        return "Agresif Short Birikimi", "Aşağı yön baskı türev tarafında da teyit alıyor."
    if change_pct >= 2.0 and funding_rate < 0:
        return "Short Squeeze Riski", "Fiyat yukarı giderken funding negatif kalmış."
    if change_pct <= -2.0 and funding_rate > 0:
        return "Long Squeeze Riski", "Fiyat aşağı kayarken funding pozitif kalmış."
    if abs(basis_bps) >= 8:
        return "Premium/Basis Sapması", "Mark ve index fiyatı arasında dikkat çeken fark var."
    return "Yüksek Türev Baskısı", "Hacim yüksek, türev tarafta belirgin baskı gözleniyor."


def build_whales_v2():
    tickers = _cached("whales_tickers", 15, _fetch_tickers)
    marks = _cached("whales_marks", 12, _fetch_mark_prices)

    candidates = []
    for row in tickers:
        symbol = row["symbol"]
        mark = marks.get(symbol)
        if not mark:
            continue

        raw_score = (
            abs(row["changePct"]) * 1.8
            + min(18.0, math.log10(max(row["quoteVolumeRaw"], 1.0)) * 3.2)
            + min(10.0, abs(mark["basisBps"]) * 0.35)
            + min(8.0, abs(mark["fundingRate"]) * 10000.0 * 0.9)
        )

        candidates.append(
            {
                **row,
                **mark,
                "premiumScore": round(raw_score, 2),
            }
        )

    leaders = sorted(
        candidates,
        key=lambda x: (x["premiumScore"], x["quoteVolumeRaw"], x["trades"]),
        reverse=True,
    )[:8]

    items = []
    for row in leaders:
        symbol = row["symbol"]
        oi = _cached(f"whales_oi:{symbol}", 25, lambda s=symbol: _fetch_open_interest(s))
        whale_type, detail = _classify(row["changePct"], row["fundingRate"], row["basisBps"])

        items.append(
            {
                "symbol": symbol,
                "displaySymbol": f"{symbol}.P",
                "type": whale_type,
                "detail": detail,
                "oi_change": _fmt_num(oi),
                "volume": row["quoteVolume"],
                "lastPrice": row["lastPrice"],
                "changePct": row["changePct"],
                "fundingRate": round(row["fundingRate"] * 100, 4),
                "basisBps": row["basisBps"],
                "premiumScore": row["premiumScore"],
                "trades": row["trades"],
                "market": "futures",
            }
        )

    return items
