from pathlib import Path

path = Path(r"C:\ttook\api\app\main.py")
text = path.read_text(encoding="utf-8")

if "from .alarm_history import fetch_alarm_overview" not in text:
    text = text.replace(
        "import json\n",
        "import json\nfrom .alarm_history import fetch_alarm_overview\n",
        1,
    )

if '@app.get("/alarm-history")' not in text:
    marker = '@app.get("/system-status")'
    block = '''
@app.get("/alarm-history")
def alarm_history(
    limit: int = Query(default=50, ge=1, le=200),
):
    return fetch_alarm_overview(limit=limit)


'''
    text = text.replace(marker, block + marker, 1)

path.write_text(text, encoding="utf-8")
print("alarm-history endpoint eklendi")
