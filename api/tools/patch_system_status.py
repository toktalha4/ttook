from pathlib import Path

path = Path(r"C:\ttook\api\app\main.py")
text = path.read_text(encoding="utf-8")

old_import = "from .stream_cache import start_stream_cache\n"
new_import = "from .stream_cache import get_stream_status, start_stream_cache\n"
if old_import in text and new_import not in text:
    text = text.replace(old_import, new_import, 1)

if '@app.get("/system-status")' not in text:
    marker = '@app.get("/health")'
    block = '''
@app.get("/system-status")
def system_status():
    conn = get_db()
    row = conn.execute(
        "SELECT COUNT(*) AS c FROM signals WHERE is_active = 1"
    ).fetchone()
    conn.close()

    return {
        "ok": True,
        "serverTime": now_iso(),
        "activeSignals": int(row["c"] if row else 0),
        "streams": get_stream_status(),
    }


'''
    text = text.replace(marker, block + marker, 1)

path.write_text(text, encoding="utf-8")
print("system-status endpoint eklendi")
