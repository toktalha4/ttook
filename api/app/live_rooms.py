import json
import math
import time
from statistics import mean
from urllib.parse import urlencode
from urllib.request import urlopen

SPOT_BASE = "https://data-api.binance.vision"
FUTURES_BASE = "https://fapi.binance.com"

SPOT_LONGTERM_SYMBOLS = [
    "BTCUSDT",
    "ETHUSDT",
    "SOLUSDT",
    "BNBUSDT",
    "XRPUSDT",
]

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


def _fetch_futures_symbols():
    data = _fetch_json(f"{FUTURES_BASE}/fapi/v1/exchangeInfo")
    rows = data.get("symbols", [])
    return {
        row["symbol"]
        for row in rows
        if row.get("status") == "TRADING"
        and row.get("contractType") == "PERPETUAL"
        and row.get("quoteAsset") == "USDT"
    }


def _fetch_futures_tickers():
    allowed = _cached("futures_symbols", 900, _fetch_futures_symbols)
    raw = _fetch_json(f"{FUTURES_BASE}/fapi/v1/ticker/24hr")

    items = []
    for row in raw:
        symbol = row.get("symbol", "")
        if symbol not in allowed:
            continue

        try:
            pct = float(row.get("priceChangePercent", 0) or 0)
            quote_volume = float(row.get("quoteVolume", 0) or 0)
            last_price = float(row.get("lastPrice", 0) or 0)
            count = int(float(row.get("count", 0) or 0))
        except Exception:
            continue

        if quote_volume <= 0 or last_price <= 0:
            continue

        score = round(abs(pct) + min(25.0, math.log10(max(quote_volume, 1.0)) * 4.0), 2)
        confidence = int(
            max(
                55,
                min(
                    95,
                    55 + abs(pct) * 1.7 + min(12.0, math.log10(max(quote_volume, 1.0)) * 1.5),
                ),
            )
        )

        items.append(
            {
                "symbol": symbol,
                "pct": pct,
                "quote_volume": quote_volume,
                "last_price": last_price,
                "count": count,
                "score": score,
                "confidence": confidence,
            }
        )

    return items


def _fetch_open_interest(symbol: str):
    raw = _fetch_json(f"{FUTURES_BASE}/fapi/v1/openInterest?symbol={symbol}")
    return float(raw.get("openInterest", 0) or 0)


def _fetch_spot_klines(symbol: str, interval: str, limit: int):
    params = urlencode(
        {
            "symbol": symbol,
            "interval": interval,
            "limit": limit,
        }
    )
    return _fetch_json(f"{SPOT_BASE}/api/v3/klines?{params}")


def build_radar_live():
    rows = _cached("futures_tickers", 15, _fetch_futures_tickers)

    longs = sorted(
        [row for row in rows if row["pct"] > 0],
        key=lambda x: (x["quote_volume"], x["score"]),
        reverse=True,
    )[:4]

    shorts = sorted(
        [row for row in rows if row["pct"] < 0],
        key=lambda x: (x["quote_volume"], x["score"]),
        reverse=True,
    )[:4]

    items = []
    for row in longs:
        items.append(
            {
                "symbol": row["symbol"],
                "direction": "long",
                "score": row["score"],
                "confidence": row["confidence"],
            }
        )

    for row in shorts:
        items.append(
            {
                "symbol": row["symbol"],
                "direction": "short",
                "score": row["score"],
                "confidence": row["confidence"],
            }
        )

    items.sort(key=lambda x: x["score"], reverse=True)
    return items[:8]


def build_whales_live():
    rows = _cached("futures_tickers", 15, _fetch_futures_tickers)
    leaders = sorted(
        rows,
        key=lambda x: (x["quote_volume"], abs(x["pct"]), x["count"]),
        reverse=True,
    )[:8]

    items = []
    for row in leaders:
        symbol = row["symbol"]
        oi = _cached(f"oi:{symbol}", 30, lambda s=symbol: _fetch_open_interest(s))

        if row["pct"] >= 3:
            whale_type = "Agresif Long Akışı"
            detail = "Hacim ve fiyat aynı yönde hızlanıyor."
        elif row["pct"] <= -3:
            whale_type = "Agresif Short Akışı"
            detail = "Aşağı yönlü baskı hacimle destekleniyor."
        else:
            whale_type = "Yüksek Hacim Baskısı"
            detail = "Hacim yüksek, yön teyidi yakından izlenmeli."

        items.append(
            {
                "symbol": symbol,
                "type": whale_type,
                "detail": detail,
                "oi_change": _fmt_num(oi),
                "volume": _fmt_money(row["quote_volume"]),
            }
        )

    return items


def build_ai_live():
    radar = build_radar_live()
    whales = build_whales_live()

    top_long = next((x for x in radar if x["direction"] == "long"), None)
    top_short = next((x for x in radar if x["direction"] == "short"), None)
    whale_top = whales[0] if whales else None

    items = []

    if top_long:
        items.append(
            {
                "title": "Futures Long Öne Çıkan",
                "text": f"{top_long['symbol']} tarafında momentum öne çıkıyor. Skor {top_long['score']} ve güven %{top_long['confidence']} seviyesinde.",
            }
        )

    if top_short:
        items.append(
            {
                "title": "Futures Short Öne Çıkan",
                "text": f"{top_short['symbol']} tarafında aşağı yön baskısı güçlü. Skor {top_short['score']} ve güven %{top_short['confidence']} seviyesinde.",
            }
        )

    if whale_top:
        items.append(
            {
                "title": "Balina Radar Yorumu",
                "text": f"{whale_top['symbol']} için {whale_top['type']} görünüyor. Hacim {whale_top['volume']} ve açık pozisyon {whale_top['oi_change']} civarında.",
            }
        )

    if not items:
        items.append(
            {
                "title": "Futures Genel Görünüm",
                "text": "Şu an öne çıkan belirgin bir futures akışı görünmüyor.",
            }
        )

    return items[:3]


def build_spot_longterm_live():
    items = []

    for symbol in SPOT_LONGTERM_SYMBOLS:
        daily = _cached(f"spot:{symbol}:1d", 300, lambda s=symbol: _fetch_spot_klines(s, "1d", 60))
        weekly = _cached(f"spot:{symbol}:1w", 900, lambda s=symbol: _fetch_spot_klines(s, "1w", 20))

        if not daily or not weekly:
            continue

        daily_closes = [float(x[4]) for x in daily]
        daily_lows = [float(x[3]) for x in daily]
        daily_highs = [float(x[2]) for x in daily]
        weekly_closes = [float(x[4]) for x in weekly]

        last_close = daily_closes[-1]
        daily_avg = mean(daily_closes[-20:])
        weekly_avg = mean(weekly_closes[-8:])

        if last_close > daily_avg and weekly_closes[-1] > weekly_avg:
            bias = "Pozitif"
        elif last_close < daily_avg and weekly_closes[-1] < weekly_avg:
            bias = "Zayıf"
        else:
            bias = "Nötr"

        daily_trend = "Yukarı" if last_close > daily_avg else "Aşağı"
        weekly_trend = "Yukarı" if weekly_closes[-1] > weekly_avg else "Aşağı"

        support = min(daily_lows[-20:])
        resistance = max(daily_highs[-20:])

        items.append(
            {
                "symbol": symbol,
                "bias": bias,
                "dailyTrend": daily_trend,
                "weeklyTrend": weekly_trend,
                "lastClose": round(last_close, 4),
                "support": round(support, 4),
                "resistance": round(resistance, 4),
            }
        )

    return items
