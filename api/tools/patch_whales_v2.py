from pathlib import Path
import re

path = Path(r"C:\ttook\api\app\main.py")
text = path.read_text(encoding="utf-8")

import_line = "from .whales_v2 import build_whales_v2\n"
if import_line not in text:
    text = text.replace("import json\n", "import json\n" + import_line, 1)

pattern = r'@app\.get\("/whales"\)\ndef whales\(\):\n.*?(?=\n@app\.get\()'
replacement = '''@app.get("/whales")
def whales():
    return {
        "market": "futures",
        "items": build_whales_v2(),
    }
'''

new_text = re.sub(pattern, replacement, text, flags=re.S)

path.write_text(new_text, encoding="utf-8")
print("Whales v2 patch tamam")
