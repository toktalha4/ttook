from pathlib import Path

path = Path(r"C:\ttook\api\app\main.py")
text = path.read_text(encoding="utf-8")

if "from .stream_cache import start_stream_cache" not in text:
    text = text.replace(
        "from fastapi.middleware.cors import CORSMiddleware\n",
        "from fastapi.middleware.cors import CORSMiddleware\nfrom .stream_cache import start_stream_cache\n",
        1,
    )

text = text.replace(
    "def startup_event():\n    init_db()",
    "def startup_event():\n    init_db()\n    start_stream_cache()",
)

path.write_text(text, encoding="utf-8")
print("stream cache startup eklendi")
