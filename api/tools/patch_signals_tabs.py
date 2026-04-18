from pathlib import Path

path = Path(r"C:\ttook\api\app\main.py")
text = path.read_text(encoding="utf-8")

if "class TPEventIn(BaseModel):" not in text:
    marker = """class CloseSignalIn(BaseModel):
    symbol: str
    market: str
"""
    insert = """class CloseSignalIn(BaseModel):
    symbol: str
    market: str


class TPEventIn(BaseModel):
    symbol: str
    market: str
    tp_level: int
    price: float | None = None
    note: str | None = None
"""
    text = text.replace(marker, insert, 1)

if 'CREATE TABLE IF NOT EXISTS signal_events (' not in text:
    marker = """    conn.execute(
        \"\"\"
        CREATE TABLE IF NOT EXISTS signals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            market TEXT NOT NULL,
            direction TEXT NOT NULL,
            entry REAL NOT NULL,
            tp1 REAL NOT NULL,
            tp2 REAL NOT NULL,
            tp3 REAL NOT NULL,
            stop REAL NOT NULL,
            confidence INTEGER NOT NULL,
            setup TEXT NOT NULL,
            exchange TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'manual',
            note TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        \"\"\"
    )
"""
    add = """    conn.execute(
        \"\"\"
        CREATE TABLE IF NOT EXISTS signals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            market TEXT NOT NULL,
            direction TEXT NOT NULL,
            entry REAL NOT NULL,
            tp1 REAL NOT NULL,
            tp2 REAL NOT NULL,
            tp3 REAL NOT NULL,
            stop REAL NOT NULL,
            confidence INTEGER NOT NULL,
            setup TEXT NOT NULL,
            exchange TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'manual',
            note TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        \"\"\"
    )
    conn.execute(
        \"\"\"
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
        \"\"\"
    )
"""
    text = text.replace(marker, add, 1)

if "def row_to_event(" not in text:
    marker = """def row_to_signal(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "symbol": row["symbol"],
        "market": row["market"],
        "direction": row["direction"],
        "entry": row["entry"],
        "tp1": row["tp1"],
        "tp2": row["tp2"],
        "tp3": row["tp3"],
        "stop": row["stop"],
        "confidence": row["confidence"],
        "setup": row["setup"],
        "exchange": row["exchange"],
        "source": row["source"],
        "note": row["note"],
        "is_active": bool(row["is_active"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }
"""
    add = """def row_to_signal(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "symbol": row["symbol"],
        "market": row["market"],
        "direction": row["direction"],
        "entry": row["entry"],
        "tp1": row["tp1"],
        "tp2": row["tp2"],
        "tp3": row["tp3"],
        "stop": row["stop"],
        "confidence": row["confidence"],
        "setup": row["setup"],
        "exchange": row["exchange"],
        "source": row["source"],
        "note": row["note"],
        "is_active": bool(row["is_active"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def row_to_event(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "signal_id": row["signal_id"],
        "symbol": row["symbol"],
        "market": row["market"],
        "event_type": row["event_type"],
        "tp_level": row["tp_level"],
        "price": row["price"],
        "note": row["note"],
        "created_at": row["created_at"],
    }
"""
    text = text.replace(marker, add, 1)

old_signals = """@app.get("/signals")
def signals():
    conn = get_db()
    rows = conn.execute(
        \"\"\"
        SELECT *
        FROM signals
        WHERE is_active = 1
        ORDER BY updated_at DESC, id DESC
        \"\"\"
    ).fetchall()
    conn.close()

    return {
        "items": [row_to_signal(row) for row in rows]
    }
"""
new_signals = """@app.get("/signals")
def signals(
    status: str = Query(default="active"),
    limit: int = Query(default=50, ge=1, le=500),
):
    status = status.strip().lower()

    if status == "active":
        where_clause = "is_active = 1"
    elif status == "closed":
        where_clause = "is_active = 0"
    else:
        raise HTTPException(status_code=400, detail="Geçersiz status")

    conn = get_db()
    rows = conn.execute(
        f\"\"\"
        SELECT *
        FROM signals
        WHERE {where_clause}
        ORDER BY updated_at DESC, id DESC
        LIMIT ?
        \"\"\",
        (limit,),
    ).fetchall()
    conn.close()

    return {
        "status": status,
        "items": [row_to_signal(row) for row in rows]
    }
"""
if old_signals in text:
    text = text.replace(old_signals, new_signals, 1)

if '@app.get("/signals/events")' not in text:
    marker = '@app.get("/radar")'
    add = """
@app.get("/signals/events")
def signal_events(
    kind: str = Query(default="tp"),
    limit: int = Query(default=50, ge=1, le=500),
):
    kind = kind.strip().lower()
    event_type = "tp_hit" if kind == "tp" else kind

    conn = get_db()
    rows = conn.execute(
        \"\"\"
        SELECT *
        FROM signal_events
        WHERE event_type = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
        \"\"\",
        (event_type, limit),
    ).fetchall()
    conn.close()

    return {
        "kind": kind,
        "items": [row_to_event(row) for row in rows]
    }


@app.post("/signals/tp-event")
def signals_tp_event(payload: TPEventIn):
    market = normalize_market(payload.market)
    symbol = payload.symbol.upper().strip()
    ts = now_iso()

    conn = get_db()
    signal_row = conn.execute(
        \"\"\"
        SELECT id
        FROM signals
        WHERE market = ?
          AND symbol = ?
        ORDER BY is_active DESC, updated_at DESC, id DESC
        LIMIT 1
        \"\"\",
        (market, symbol),
    ).fetchone()

    signal_id = int(signal_row["id"]) if signal_row else None

    cur = conn.execute(
        \"\"\"
        INSERT INTO signal_events (
            signal_id, symbol, market, event_type,
            tp_level, price, note, created_at
        )
        VALUES (?, ?, ?, 'tp_hit', ?, ?, ?, ?)
        \"\"\",
        (
            signal_id,
            symbol,
            market,
            int(payload.tp_level),
            payload.price,
            payload.note,
            ts,
        ),
    )
    event_id = cur.lastrowid
    conn.commit()

    row = conn.execute(
        "SELECT * FROM signal_events WHERE id = ?",
        (event_id,),
    ).fetchone()
    conn.close()

    return {
        "ok": True,
        "item": row_to_event(row),
    }


"""
    text = text.replace(marker, add + marker, 1)

path.write_text(text, encoding="utf-8")
print("main.py signals tabs patch tamam")
