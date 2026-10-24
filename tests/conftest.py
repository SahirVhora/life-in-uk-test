import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_bank():
    """Read the question bank out of assets/questions.js (window.LIUK = {...};)."""
    src = (ROOT / "assets" / "questions.js").read_text(encoding="utf-8")
    body = src.split("window.LIUK =", 1)[1].strip()
    assert body.endswith(";"), "questions.js must end with a semicolon"
    return json.loads(body[:-1])
