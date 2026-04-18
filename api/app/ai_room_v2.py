import json
import math
import time
from statistics import mean
from urllib.parse import urlencode
from urllib.request import urlopen

from .stream_cache import (
    get_book_ticker_snapshot,
    get_liquidation_snapshot,
    get_mark_stream_snapshot,
)

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


def _round(v: float, ndigits: int = 6):
    return round(float(v), ndigits)


def _fetch_allowed_symbols():
    data = _fetch_json(f"{FUTURES_BASE}/fapi/v1/exchangeInfo")
    rows = data.get("symbols", [])

    allowed = []
    for row in rows:
        if row.get("status") != "TRADING":
            continue
        if row.get("contractType") != "PERPETUAL":
            continue
        if row.get("quoteAsset") != "USDT":
            continue

        symbol = row.get("symbol", "")
        if symbol:
            allowed.append(symbol)

    allowed.sort()
    return allowed


def _fetch_tickers():
    raw = _fetch_json(f"{FUTURES_BASE}/fapi/v1/ticker/24hr")
    allowed = set(_cached("ai_allowed_symbols", 900, _fetch_allowed_symbols))

    out = {}
    for row in raw:
        symbol = row.get("symbol", "")
        if symbol not in allowed:
            continue

        try:
            out[symbol] = {
                "lastPrice": float(row.get("lastPrice", 0) or 0),
                "changePct": float(row.get("priceChangePercent", 0) or 0),
                "quoteVolume": float(row.get("quoteVolume", 0) or 0),
                "count": int(float(row.get("count", 0) or 0)),
                "highPrice": float(row.get("highPrice", 0) or 0),
                "lowPrice": float(row.get("lowPrice", 0) or 0),
            }
        except Exception:
            continue

    return out


def _fetch_marks():
    raw = _fetch_json(f"{FUTURES_BASE}/fapi/v1/premiumIndex")
    out = {}

    if isinstance(raw, list):
        for row in raw:
            symbol = row.get("symbol", "")
            if not symbol:
                continue
            try:
                mark = float(row.get("markPrice", 0) or 0)
                index = float(row.get("indexPrice", 0) or 0)
                funding = float(row.get("lastFundingRate", 0) or 0)
            except Exception:
                continue

            basis_bps = 0.0
            if index > 0:
                basis_bps = ((mark - index) / index) * 10000.0

            out[symbol] = {
                "markPrice": mark,
                "indexPrice": index,
                "fundingRate": funding,
                "basisBps": basis_bps,
            }

    return out


def _fetch_open_interest(symbol: str):
    raw = _fetch_json(f"{FUTURES_BASE}/fapi/v1/openInterest?symbol={symbol}")
    return float(raw.get("openInterest", 0) or 0)


def _fetch_klines(symbol: str, interval: str, limit: int):
    params = urlencode({
        "symbol": symbol,
        "interval": interval,
        "limit": limit,
    })
    return _fetch_json(f"{FUTURES_BASE}/fapi/v1/klines?{params}")


def _fetch_depth(symbol: str, limit: int = 50):
    params = urlencode({
        "symbol": symbol,
        "limit": limit,
    })
    return _fetch_json(f"{FUTURES_BASE}/fapi/v1/depth?{params}")


def _trend_name(last_close: float, sma_fast: float, sma_slow: float):
    if last_close > sma_fast > sma_slow:
        return "pozitif"
    if last_close < sma_fast < sma_slow:
        return "negatif"
    return "kararsiz"


def _momentum_name(last_close: float, ref_close: float):
    diff_pct = ((last_close - ref_close) / ref_close) * 100 if ref_close else 0
    if diff_pct >= 1.8:
        return "guclu"
    if diff_pct >= 0.5:
        return "pozitif"
    if diff_pct <= -1.8:
        return "zayif"
    if diff_pct <= -0.5:
        return "negatif"
    return "dengeli"


def _volatility_name(ranges_pct):
    avg_range = mean(ranges_pct) if ranges_pct else 0
    if avg_range >= 2.8:
        return "sert"
    if avg_range >= 1.4:
        return "yuksek"
    return "dengeli"


def _uniq_levels(values, reverse=False, n=3):
    seen = []
    for v in sorted(values, reverse=reverse):
        rv = round(float(v), 8)
        if rv not in seen:
            seen.append(rv)
        if len(seen) >= n:
            break
    return seen


def _orderbook_summary(symbol: str):
    live = get_book_ticker_snapshot(symbol)
    raw = _cached(f"ai_depth:{symbol}", 8, lambda: _fetch_depth(symbol, 50))

    bids = raw.get("bids", [])[:15]
    asks = raw.get("asks", [])[:15]

    bid_notional = 0.0
    ask_notional = 0.0

    for px, qty in bids:
        try:
            bid_notional += float(px) * float(qty)
        except Exception:
            continue

    for px, qty in asks:
        try:
            ask_notional += float(px) * float(qty)
        except Exception:
            continue

    total = bid_notional + ask_notional
    imbalance = (bid_notional / total) if total > 0 else 0.5

    live_spread_bps = None
    live_bias = "dengeli"

    if live and live.get("bid", 0) > 0 and live.get("ask", 0) > 0:
        mid = (live["bid"] + live["ask"]) / 2
        if mid > 0:
            live_spread_bps = ((live["ask"] - live["bid"]) / mid) * 10000.0

        bq = float(live.get("bidQty", 0) or 0)
        aq = float(live.get("askQty", 0) or 0)
        if bq > aq * 1.18:
            live_bias = "alim baskisi"
        elif aq > bq * 1.18:
            live_bias = "satis baskisi"

    if imbalance >= 0.58:
        pressure = "alim baskisi"
    elif imbalance <= 0.42:
        pressure = "satis baskisi"
    else:
        pressure = live_bias

    return {
        "bidNotional": bid_notional,
        "askNotional": ask_notional,
        "imbalance": round(imbalance * 100, 2),
        "pressure": pressure,
        "liveSpreadBps": round(live_spread_bps, 2) if live_spread_bps is not None else None,
    }


def _reason_lines(change_pct: float, funding_rate: float, basis_bps: float, pressure: str, quote_volume: float, liq: dict | None):
    lines = []

    if abs(change_pct) >= 4:
        lines.append(f"24s fiyat hareketi sert (%{round(change_pct, 2)})")
    elif abs(change_pct) >= 2:
        lines.append(f"24s tarafta hizlanma var (%{round(change_pct, 2)})")

    if quote_volume >= 100_000_000:
        lines.append("hacim baya dolu, piyasa bu coinle ciddi ilgileniyor")
    elif quote_volume >= 20_000_000:
        lines.append("hacim zayif degil, radar hakli cikariyor")

    if abs(funding_rate) >= 0.0005:
        lines.append(f"funding baskisi belirgin (%{round(funding_rate * 100, 4)})")

    if abs(basis_bps) >= 8:
        lines.append(f"mark/index farki acilmis ({round(basis_bps, 2)} bps)")

    if pressure != "dengeli":
        lines.append(f"orderbook tarafinda {pressure} var")

    if liq and liq.get("qty", 0) > 0:
        side = "short patlamasi" if liq.get("side") == "BUY" else "long patlamasi"
        lines.append(f"son liquidation snapshot {side} izi veriyor")

    if not lines:
        lines.append("coin sakin gorunse de yapida ince bir enerji birikiyor")

    return lines[:5]


def _pick_joke(symbol: str, trend: str, momentum: str, pressure: str):
    base = symbol.replace("USDT", "").replace(".P", "")

    if trend == "pozitif" and momentum == "guclu" and pressure == "alim baskisi":
        return f"{base} uslu duruyor gibi ama fişi cekilirse kosuya kalkabilir."
    if trend == "negatif" and momentum in {"zayif", "negatif"} and pressure == "satis baskisi":
        return f"{base} biraz tripli, ustune atlayana ters yapabilir."
    if pressure == "dengeli":
        return f"{base} kararsiz sevgili modu acmis, teyit gelmeden naz yapar."
    return f"{base} nazli ama dogru yerden tutulursa guzel is cikarabilir."


def _mini_alarm(change_pct: float, funding_rate: float, basis_bps: float, pressure: str, liq: dict | None):
    if liq and liq.get("qty", 0) > 0 and abs(change_pct) >= 3:
        return "LIKIDITE ALARMI"
    if pressure == "alim baskisi" and change_pct >= 2:
        return "LONG BASKI"
    if pressure == "satis baskisi" and change_pct <= -2:
        return "SHORT BASKI"
    if abs(funding_rate) >= 0.001 or abs(basis_bps) >= 12:
        return "TUREV GERILIMI"
    return "IZLEMEDE"


def build_ai_room_symbols():
    tickers = _cached("ai_tickers", 15, _fetch_tickers)
    marks = _cached("ai_marks", 12, _fetch_marks)

    rows = []
    for symbol, row in tickers.items():
        if row["quoteVolume"] < 2_000_000:
            continue

        mark = marks.get(symbol, {"fundingRate": 0.0, "basisBps": 0.0})
        score = (
            abs(row["changePct"]) * 1.6
            + min(18.0, math.log10(max(row["quoteVolume"], 1.0)) * 3.2)
            + min(7.0, abs(mark["basisBps"]) * 0.25)
            + min(6.0, abs(mark["fundingRate"]) * 10000.0 * 0.8)
        )

        rows.append(
            {
                "symbol": symbol,
                "displaySymbol": f"{symbol}.P",
                "score": round(score, 2),
                "lastPrice": row["lastPrice"],
                "changePct": round(row["changePct"], 2),
                "quoteVolume": row["quoteVolume"],
            }
        )

    rows.sort(key=lambda x: (x["score"], x["quoteVolume"]), reverse=True)
    return rows


def build_ai_coin(symbol: str):
    symbol = symbol.upper().strip().replace(".P", "")

    allowed = set(_cached("ai_allowed_symbols", 900, _fetch_allowed_symbols))
    if symbol not in allowed:
        return None

    tickers = _cached("ai_tickers", 15, _fetch_tickers)
    marks = _cached("ai_marks", 12, _fetch_marks)

    ticker = tickers.get(symbol)
    mark = marks.get(symbol)
    mark_live = get_mark_stream_snapshot(symbol)

    if not ticker or not mark:
        return None

    if mark_live:
        mark["markPrice"] = mark_live.get("markPrice", mark["markPrice"])
        mark["indexPrice"] = mark_live.get("indexPrice", mark["indexPrice"])
        mark["fundingRate"] = mark_live.get("fundingRate", mark["fundingRate"])
        if mark["indexPrice"] > 0:
            mark["basisBps"] = ((mark["markPrice"] - mark["indexPrice"]) / mark["indexPrice"]) * 10000.0

    k15 = _cached(f"ai:{symbol}:15m", 45, lambda: _fetch_klines(symbol, "15m", 80))
    k1h = _cached(f"ai:{symbol}:1h", 90, lambda: _fetch_klines(symbol, "1h", 80))
    k4h = _cached(f"ai:{symbol}:4h", 180, lambda: _fetch_klines(symbol, "4h", 80))
    depth = _orderbook_summary(symbol)
    liq = get_liquidation_snapshot(symbol)

    close_15 = [float(x[4]) for x in k15]
    high_15 = [float(x[2]) for x in k15]
    low_15 = [float(x[3]) for x in k15]

    close_1h = [float(x[4]) for x in k1h]
    high_1h = [float(x[2]) for x in k1h]
    low_1h = [float(x[3]) for x in k1h]

    close_4h = [float(x[4]) for x in k4h]
    high_4h = [float(x[2]) for x in k4h]
    low_4h = [float(x[3]) for x in k4h]

    last_close = close_15[-1]
    sma_1h_fast = mean(close_1h[-12:])
    sma_1h_slow = mean(close_1h[-30:])
    trend = _trend_name(last_close, sma_1h_fast, sma_1h_slow)
    momentum = _momentum_name(close_15[-1], close_15[-6])

    ranges_pct = []
    for h, l, c in zip(high_15[-20:], low_15[-20:], close_15[-20:]):
        if c > 0:
            ranges_pct.append(((h - l) / c) * 100)
    volatility = _volatility_name(ranges_pct)

    supports = _uniq_levels(low_1h[-24:], reverse=True, n=3)
    resistances = _uniq_levels(high_1h[-24:], reverse=False, n=3)

    upper_stop_hunt = round(max(high_15[-12:]), 8)
    lower_sweep = round(min(low_15[-12:]), 8)

    whale_level_1 = round(mean(close_15[-8:]), 8)
    whale_level_2 = round(mean(close_1h[-8:]), 8)
    whale_levels = _uniq_levels([whale_level_1, whale_level_2, mean(close_4h[-6:])], reverse=True, n=3)

    if trend == "pozitif" and momentum in {"guclu", "pozitif"}:
        bias = "LONG"
        entry_low = supports[1] if len(supports) > 1 else supports[0]
        entry_high = supports[0]
        tp1 = resistances[0] if len(resistances) > 0 else round(last_close * 1.01, 8)
        tp2 = resistances[1] if len(resistances) > 1 else round(last_close * 1.02, 8)
        tp3 = resistances[2] if len(resistances) > 2 else round(last_close * 1.03, 8)
        stop = round(min(supports) * 0.985, 8)
        invalidation = f"{supports[-1]} alti yapıyı zayiflatir, {stop} civari daha sert bozulma bolgesi."
    elif trend == "negatif" and momentum in {"zayif", "negatif"}:
        bias = "SHORT"
        entry_low = resistances[0]
        entry_high = resistances[1] if len(resistances) > 1 else resistances[0]
        tp1 = supports[0] if len(supports) > 0 else round(last_close * 0.99, 8)
        tp2 = supports[1] if len(supports) > 1 else round(last_close * 0.98, 8)
        tp3 = supports[2] if len(supports) > 2 else round(last_close * 0.97, 8)
        stop = round(max(resistances) * 1.015, 8)
        invalidation = f"{resistances[0]} ustu ilk alarm, {stop} ustu short senaryoyu bozar."
    else:
        bias = "NÖTR"
        entry_low = supports[1] if len(supports) > 1 else supports[0]
        entry_high = resistances[0] if len(resistances) > 0 else round(last_close * 1.01, 8)
        tp1 = round(last_close * 1.01, 8)
        tp2 = round(last_close * 1.02, 8)
        tp3 = round(last_close * 1.03, 8)
        stop = round(min(supports) * 0.985, 8)
        invalidation = f"{stop} alti ya da {resistances[0]} uzeri kirilim gelmeden net yon teyidi eksik."

    spot_invalid = round(min(supports) * 0.974, 8)
    oi = _cached(f"ai_oi:{symbol}", 25, lambda: _fetch_open_interest(symbol))

    reason_lines = _reason_lines(
        ticker["changePct"],
        mark["fundingRate"],
        mark["basisBps"],
        depth["pressure"],
        ticker["quoteVolume"],
        liq,
    )

    mini_alarm = _mini_alarm(
        ticker["changePct"],
        mark["fundingRate"],
        mark["basisBps"],
        depth["pressure"],
        liq,
    )

    liquidation = None
    if liq:
        liquidation = {
            "side": liq.get("side"),
            "qty": _round(liq.get("qty", 0), 4),
            "price": _round(liq.get("avgPrice") or liq.get("price") or 0, 8),
            "ageSec": max(0, int(time.time() - float(liq.get("ts", time.time())))),
        }

    return {
        "symbol": symbol,
        "displaySymbol": f"{symbol}.P",
        "price": _round(ticker["lastPrice"], 10),
        "trend": trend,
        "momentum": momentum,
        "volatility": volatility,
        "supports": supports,
        "resistances": resistances,
        "liquidity": {
            "up": upper_stop_hunt,
            "down": lower_sweep,
        },
        "whaleLevels": whale_levels,
        "futuresPlan": {
            "bias": bias,
            "entryLow": _round(entry_low, 10),
            "entryHigh": _round(entry_high, 10),
            "tp1": _round(tp1, 10),
            "tp2": _round(tp2, 10),
            "tp3": _round(tp3, 10),
            "stop": _round(stop, 10),
        },
        "spotPlan": {
            "buy1": supports[0],
            "buy2": supports[1] if len(supports) > 1 else supports[0],
            "buy3": supports[2] if len(supports) > 2 else supports[-1],
            "sell1": resistances[0],
            "sell2": resistances[1] if len(resistances) > 1 else resistances[0],
            "invalid": spot_invalid,
        },
        "marketStats": {
            "changePct": round(ticker["changePct"], 2),
            "quoteVolume": ticker["quoteVolume"],
            "fundingRatePct": round(mark["fundingRate"] * 100, 4),
            "basisBps": round(mark["basisBps"], 2),
            "openInterest": _round(oi, 2),
            "tradeCount": ticker["count"],
        },
        "orderBook": {
            "pressure": depth["pressure"],
            "imbalancePct": depth["imbalance"],
            "bidNotional": depth["bidNotional"],
            "askNotional": depth["askNotional"],
            "liveSpreadBps": depth["liveSpreadBps"],
        },
        "liquidation": liquidation,
        "reasonLines": reason_lines,
        "miniAlarm": mini_alarm,
        "invalidation": invalidation,
        "comment": _pick_joke(symbol, trend, momentum, depth["pressure"]),
        "disclaimer": "Bu finansal tavsiye/sinyal degildir. Egitim amacli AI yorumudur.",
    }


def build_ai_room_feed():
    rows = build_ai_room_symbols()[:6]
    items = []

    for row in rows:
        direction = "LONG" if row["changePct"] >= 0 else "SHORT"
        items.append(
            {
                "title": f"{row['displaySymbol']} AI ozeti",
                "text": f"{row['displaySymbol']} tarafinda {direction} tarafi dikkat cekiyor. Son fiyat {row['lastPrice']}, 24s degisim %{row['changePct']} ve radar skoru {row['score']}.",
            }
        )

    return items[:6]
