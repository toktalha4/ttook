from pathlib import Path

path = Path(r"C:\ttook\web\src\app\ai\page.tsx")
text = path.read_text(encoding="utf-8")

if "useSearchParams" not in text:
    text = text.replace(
        "import { useEffect, useState } from 'react';",
        "import { useEffect, useState } from 'react';\nimport { useSearchParams } from 'next/navigation';",
        1,
    )

if "const searchParams = useSearchParams();" not in text:
    text = text.replace(
        "export default function AiPage() {\n",
        "export default function AiPage() {\n  const searchParams = useSearchParams();\n",
        1,
    )

if "const qsSymbol = (searchParams.get('symbol') || '').toUpperCase().replace('.P', '');" not in text:
    marker = "  const filtered = symbols\n"
    add = """  useEffect(() => {
    const qsSymbol = (searchParams.get('symbol') || '').toUpperCase().replace('.P', '');
    if (qsSymbol) {
      setSelected(qsSymbol);
    }
  }, [searchParams]);

"""
    text = text.replace(marker, add + marker, 1)

path.write_text(text, encoding="utf-8")
print("AI query param patch tamam")
