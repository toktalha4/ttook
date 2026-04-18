import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from .ai_room_v2 import build_ai_coin, build_ai_room_symbols
from .radar_v2 import build_radar_v2

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "ttook.db"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso(value: str | None):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value))
    except Exception:
        return None


def _get_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_tables(conn):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS alarm_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            market TEXT NOT NULL,
            direction TEXT NOT NULL,
            mini_alarm TEXT NOT NULL,
            pressure TEXT,
            price REAL,
            change_pct REAL,
            funding_rate_pct REAL,
            basis_bps REAL,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS signal_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            signal_id INTEGER,
            symbol TEXT NOT NULL,
            market TEXT NOT NULL,
            event_type TEXT NOT NULL,
            tp_level INTEGER,
            price REAL,
            note TEXT,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.commit()


def _validation(direction: str, alarm_price: float | None, current_price: float | None, age_sec: int | None):
    if not alarm_price or not current_price:
        return "BELIRSIZ", None

    try:
        delta_pct = ((float(current_price) - float(alarm_price)) / float(alarm_price)) * 100.0
    except Exception:
        return "BELIRSIZ", None

    direction = (direction or "").strip().lower()

    if direction == "short":
        if delta_pct <= -0.35:
            return "DOGRU", round(delta_pct, 2)
        if delta_pct >= 0.35:
            return "YANLIS", round(delta_pct, 2)
    else:
        if delta_pct >= 0.35:
            return "DOGRU", round(delta_pct, 2)
        if delta_pct <= -0.35:
            return "YANLIS", round(delta_pct, 2)

    if age_sec is not None and age_sec < 1800:
        return "IZLEMEDE", round(delta_pct, 2)

    return "KARARSIZ", round(delta_pct, 2)


def _row_to_alarm(row: sqlite3.Row, current_price: float | None = None) -> dict:
    created = _parse_iso(row["created_at"])
    age_sec = None
    if created is not None:
        now = datetime.now(timezone.utc)
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        age_sec = max(0, int((now - created.astimezone(timezone.utc)).total_seconds()))

    validation, delta_pct = _validation(
        row["direction"],
        row["price"],
        current_price,
        age_sec,
    )

    return {
        "id": row["id"],
        "symbol": row["symbol"],
        "displaySymbol": f'{row["symbol"]}.P' if row["market"] == "futures" else row["symbol"],
        "market": row["market"],
        "direction": row["direction"],
        "miniAlarm": row["mini_alarm"],
        "pressure": row["pressure"],
        "price": row["price"],
        "currentPrice": current_price,
        "deltaPct": delta_pct,
        "validation": validation,
        "changePct": row["change_pct"],
        "fundingRatePct": row["funding_rate_pct"],
        "basisBps": row["basis_bps"],
        "created_at": row["created_at"],
        "ageSec": age_sec,
    }


def _tp_row_to_dict(row: sqlite3.Row | None):
    if not row:
        return None
    return {
        "id": row["id"],
        "symbol": row["symbol"],
        "displaySymbol": f'{row["symbol"]}.P' if row["market"] == "futures" else row["symbol"],
        "market": row["market"],
        "eventType": row["event_type"],
        "tpLevel": row["tp_level"],
        "price": row["price"],
        "note": row["note"],
        "created_at": row["created_at"],
    }


def _close_row_to_dict(row: sqlite3.Row | None):
    if not row:
        return None
    return {
        "id": row["id"],
        "symbol": row["symbol"],
        "displaySymbol": f'{row["symbol"]}.P' if row["market"] == "futures" else row["symbol"],
        "market": row["market"],
        "direction": row["direction"],
        "entry": row["entry"],
        "tp1": row["tp1"],
        "tp2": row["tp2"],
        "tp3": row["tp3"],
        "stop": row["stop"],
        "setup": row["setup"],
        "updated_at": row["updated_at"],
    }


def _should_insert(conn, symbol: str, mini_alarm: str, direction: str):
    row = conn.execute(
        """
        SELECT created_at
        FROM alarm_history
        WHERE symbol = ?
          AND mini_alarm = ?
          AND direction = ?
        ORDER BY id DESC
        LIMIT 1
        """,
        (symbol, mini_alarm, direction),
    ).fetchone()

    if not row:
        return True

    created = _parse_iso(row["created_at"])
    if created is None:
        return True
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)

    age_sec = max(0, int((datetime.now(timezone.utc) - created.astimezone(timezone.utc)).total_seconds()))
    return age_sec >= 480


def _record_current_alerts(conn):
    radar_rows = build_radar_v2()[:8]

    for row in radar_rows:
        symbol = row["symbol"]
        item = build_ai_coin(symbol)
        if not item:
            continue

        mini_alarm = item.get("miniAlarm", "IZLEMEDE")
        pressure = item.get("orderBook", {}).get("pressure", "dengeli")
        direction = row.get("direction", "long")

        if not _should_insert(conn, symbol, mini_alarm, direction):
            continue

        conn.execute(
            """
            INSERT INTO alarm_history (
                symbol, market, direction, mini_alarm, pressure,
                price, change_pct, funding_rate_pct, basis_bps, created_at
            )
            VALUES (?, 'futures', ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                symbol,
                direction,
                mini_alarm,
                pressure,
                item.get("price"),
                item.get("marketStats", {}).get("changePct"),
                item.get("marketStats", {}).get("fundingRatePct"),
                item.get("marketStats", {}).get("basisBps"),
                _now_iso(),
            ),
        )

    conn.commit()


def fetch_alarm_overview(limit: int = 50) -> dict:
    conn = _get_db()
    _ensure_tables(conn)
    _record_current_alerts(conn)

    current_map = {}
    try:
        for row in build_ai_room_symbols():
            current_map[row["symbol"]] = row.get("lastPrice")
    except Exception:
        current_map = {}

    rows = conn.execute(
        """
        SELECT *
        FROM alarm_history
        ORDER BY created_at DESC, id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()

    last_liq = conn.execute(
        """
        SELECT *
        FROM alarm_history
        WHERE mini_alarm = 'LIKIDITE ALARMI'
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        """
    ).fetchone()

    last_tp = conn.execute(
        """
        SELECT *
        FROM signal_events
        WHERE event_type = 'tp_hit'
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        """
    ).fetchone()

    last_close = conn.execute(
        """
        SELECT *
        FROM signals
        WHERE is_active = 0
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
        """
    ).fetchone()

    conn.close()

    return {
        "ok": True,
        "items": [
            _row_to_alarm(row, current_map.get(row["symbol"]))
            for row in rows
        ],
        "lastLiquidation": _row_to_alarm(last_liq, current_map.get(last_liq["symbol"])) if last_liq else None,
        "lastTpEvent": _tp_row_to_dict(last_tp),
        "lastCloseSignal": _close_row_to_dict(last_close),
    }
