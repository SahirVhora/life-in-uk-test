"""Render scripts/preview.html to preview.png (1200x630) for Open Graph and X cards.

Usage: python scripts/render_preview.py   (needs: pip install playwright && playwright install chromium)
"""

from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1200, "height": 630}, color_scheme="light")
        page.goto((ROOT / "scripts" / "preview.html").as_uri())
        page.evaluate("document.fonts.ready")
        page.screenshot(path=str(ROOT / "preview.png"))
        browser.close()


if __name__ == "__main__":
    main()
