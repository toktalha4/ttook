from pathlib import Path
import re

path = Path(r"C:\ttook\api\app\main.py")
text = path.read_text(encoding="utf-8")

import_line = "from .live_rooms import build_ai_live, build_radar_live, build_spot_longterm_live, build_whales_live\n"
if import_line not in text:
    text = text.replace("import json\n", "import json\n" + import_line, 1)

text = re.sub(
    r'@app\.get\("/radar"\)\ndef radar\(\):\n.*?(?=@app\.get\("/whales"\))',
    '''@app.get("/radar")
def radar():
    return {
        "market": "futures",
        "items": build_radar_live(),
    }

''',
    text,
    flags=re.S,
)

text = re.sub(
    r'@app\.get\("/whales"\)\ndef whales\(\):\n.*?(?=@app\.get\("/ai"\))',
    '''@app.get("/whales")
def whales():
    return {
        "market": "futures",
        "items": build_whales_live(),
    }

''',
    text,
    flags=re.S,
)

text = re.sub(
    r'@app\.get\("/ai"\)\ndef ai\(\):\n.*?$',
    '''@app.get("/ai")
def ai():
    return {
        "market": "futures",
        "items": build_ai_live(),
    }


@app.get("/spot-longterm")
def spot_longterm():
    return {
        "market": "spot",
        "items": build_spot_longterm_live(),
    }
''',
    text,
    flags=re.S,
)

path.write_text(text, encoding="utf-8")
print("main.py patch tamam")
