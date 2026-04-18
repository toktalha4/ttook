from pathlib import Path
import re

path = Path(r"C:\ttook\api\app\main.py")
text = path.read_text(encoding="utf-8")

import_line = "from .ai_room_v2 import build_ai_coin, build_ai_room_feed, build_ai_room_symbols\n"
if import_line not in text:
    text = text.replace("import json\n", "import json\n" + import_line, 1)

pattern = r'@app\.get\("/ai"\)\ndef ai\(\):\n.*?(?=\n@app\.get\("/spot-longterm"\))'
replacement = '''@app.get("/ai")
def ai():
    return {
        "market": "futures",
        "items": build_ai_room_feed(),
    }


@app.get("/ai-symbols")
def ai_symbols():
    return {
        "market": "futures",
        "items": build_ai_room_symbols(),
    }


@app.get("/ai-coin")
def ai_coin(
    symbol: str = Query(default="TRBUSDT"),
):
    item = build_ai_coin(symbol)
    return {
        "market": "futures",
        "item": item,
    }

'''

new_text = re.sub(pattern, replacement, text, flags=re.S)

path.write_text(new_text, encoding="utf-8")
print("AI Room v2 patch tamam")
