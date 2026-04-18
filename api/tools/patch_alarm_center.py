from pathlib import Path

path = Path(r"C:\ttook\api\app\main.py")
text = path.read_text(encoding="utf-8")

if '@app.get("/alarm-center")' not in text:
    marker = '@app.get("/system-status")'
    block = '''
@app.get("/alarm-center")
def alarm_center():
    radar_items = build_radar_v2()
    hot = radar_items[:3]

    alerts = []
    for row in radar_items[:6]:
        item = build_ai_coin(row["symbol"])
        if not item:
            continue

        alerts.append(
            {
                "symbol": row["symbol"],
                "displaySymbol": row.get("displaySymbol", f'{row["symbol"]}.P'),
                "direction": row.get("direction", "long"),
                "miniAlarm": item.get("miniAlarm", "IZLEMEDE"),
                "pressure": item.get("orderBook", {}).get("pressure", "dengeli"),
                "price": item.get("price"),
                "changePct": item.get("marketStats", {}).get("changePct"),
                "fundingRatePct": item.get("marketStats", {}).get("fundingRatePct"),
                "basisBps": item.get("marketStats", {}).get("basisBps"),
            }
        )

    return {
        "market": "futures",
        "hot": hot,
        "alerts": alerts,
        "radar": radar_items,
    }


'''
    text = text.replace(marker, block + marker, 1)

path.write_text(text, encoding="utf-8")
print("alarm-center endpoint eklendi")
