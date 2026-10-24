"""SEO and integrity tests for the GitHub Pages site.

These run in CI so that metadata, links and advertised facts cannot drift.
"""

import json
import re
import struct
import subprocess
import xml.etree.ElementTree as ET
from html import unescape
from html.parser import HTMLParser
from urllib.parse import urlsplit

import pytest
from conftest import ROOT

CANONICAL = "https://sahirvhora.github.io/life-in-uk-test/"
REPO = "https://github.com/SahirVhora/life-in-uk-test"
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta: dict[str, str] = {}
        self.links: list[str] = []
        self.ids: list[str] = []
        self.canonical = None
        self.h1 = 0
        self.lang = None
        self.title = ""
        self.faq: list[list[str]] = []
        self.jsonld: list[str] = []
        self.imgs_without_alt = 0
        self.inline_scripts = 0
        self._in = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang")
        if tag == "meta":
            key = a.get("name") or a.get("property")
            if key:
                self.meta[key] = a.get("content", "")
        if tag == "link" and a.get("rel") == "canonical":
            self.canonical = a.get("href")
        for attr in ("href", "src"):
            if a.get(attr):
                self.links.append(a[attr])
        if a.get("id"):
            self.ids.append(a["id"])
        if tag == "h1":
            self.h1 += 1
        if tag == "img" and a.get("alt") is None:
            self.imgs_without_alt += 1
        if tag == "title":
            self._in = "title"
        if tag == "summary":
            self._in = "summary"
            self.faq.append(["", ""])
        if tag == "p" and self.faq and self._in is None and not self.faq[-1][1]:
            self._in = "answer"
        if tag == "script":
            if a.get("type") == "application/ld+json":
                self._in = "jsonld"
                self.jsonld.append("")
            elif not a.get("src"):
                self.inline_scripts += 1

    def handle_endtag(self, tag):
        if tag in ("title", "summary", "script") or (tag == "p" and self._in == "answer"):
            self._in = None
        if tag == "details":
            self._in = None

    def handle_data(self, data):
        if self._in == "title":
            self.title += data
        elif self._in == "summary":
            self.faq[-1][0] += data
        elif self._in == "answer":
            self.faq[-1][1] += data
        elif self._in == "jsonld":
            self.jsonld[-1] += data


@pytest.fixture(scope="module")
def page():
    p = Page()
    p.feed(INDEX)
    return p


@pytest.fixture(scope="module")
def dist():
    out = subprocess.run(
        ["bash", str(ROOT / "scripts" / "build_pages_artifact.sh")], capture_output=True, text=True, check=False
    )
    assert out.returncode == 0, out.stderr
    return ROOT / "dist"


def test_title_and_description_lengths(page):
    assert 30 <= len(page.title) <= 60, page.title
    assert 70 <= len(page.meta["description"]) <= 160, len(page.meta["description"])
    assert "life in the uk test" in page.title.lower()


def test_lang_single_h1_unique_ids_alt_text(page):
    assert page.lang == "en-GB"
    assert page.h1 == 1
    assert len(page.ids) == len(set(page.ids))
    assert page.imgs_without_alt == 0


def test_canonical_urls_agree(page):
    assert page.canonical == CANONICAL
    assert page.meta["og:url"] == CANONICAL
    assert page.meta["twitter:url"] == CANONICAL
    assert page.meta["robots"].startswith("index, follow")


def test_social_image_is_1200x630_png(page):
    for key in ("og:image", "twitter:image"):
        assert page.meta[key] == CANONICAL + "preview.png"
    data = (ROOT / "preview.png").read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    width, height = struct.unpack(">II", data[16:24])
    assert (width, height) == (1200, 630)
    assert page.meta["og:image:width"] == "1200" and page.meta["og:image:height"] == "630"
    assert page.meta["twitter:card"] == "summary_large_image"


def test_structured_data_valid_and_matches_visible_faq(page):
    assert len(page.jsonld) == 1
    graph = json.loads(page.jsonld[0])["@graph"]
    types = {node["@type"] for node in graph}
    assert {"WebApplication", "Person", "FAQPage"} <= types
    app = next(n for n in graph if n["@type"] == "WebApplication")
    assert app["url"] == CANONICAL
    assert app["sameAs"] == REPO
    person = next(n for n in graph if n["@type"] == "Person")
    assert person["@id"] == "https://sahirvhora.github.io/#person"
    faq = next(n for n in graph if n["@type"] == "FAQPage")
    # Google requires FAQ structured data to match content visible on the page.
    visible = [(q.strip(), re.sub(r"\s+", " ", unescape(a)).strip()) for q, a in page.faq]
    data = [(q["name"], q["acceptedAnswer"]["text"]) for q in faq["mainEntity"]]
    assert data == visible


def test_robots_and_sitemap():
    robots = (ROOT / "robots.txt").read_text()
    assert f"Sitemap: {CANONICAL}sitemap.xml" in robots
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    locs = [e.text for e in ET.parse(ROOT / "sitemap.xml").getroot().findall("s:url/s:loc", ns)]
    assert locs == [CANONICAL]


def test_local_links_resolve_in_published_site(page, dist):
    missing = []
    for raw in page.links:
        parts = urlsplit(raw)
        if parts.scheme or parts.netloc or raw.startswith(("#", "mailto:")):
            continue
        if not (dist / parts.path).exists():
            missing.append(raw)
    assert not missing, missing


def test_in_page_anchors_exist(page):
    targets = {u[1:] for u in page.links if u.startswith("#") and len(u) > 1}
    assert targets <= set(page.ids), targets - set(page.ids)


def test_published_site_contents(dist):
    for name in (
        "index.html",
        "preview.png",
        "favicon.svg",
        "robots.txt",
        "sitemap.xml",
        ".nojekyll",
        "assets/app.js",
        "assets/questions.js",
        "assets/style.css",
    ):
        assert (dist / name).exists(), name
    assert not (dist / "tests").exists() and not (dist / "scripts").exists()


def test_fonts_are_self_hosted_and_shipped(dist):
    css = (ROOT / "assets" / "style.css").read_text(encoding="utf-8")
    fonts = re.findall(r'url\("(fonts/[^"]+)"\)', css)
    assert fonts
    for f in fonts:
        assert (dist / "assets" / f).exists(), f


def test_csp_allows_only_self_and_no_inline_scripts(page):
    csp = page.meta.get("Content-Security-Policy") or re.search(r'Content-Security-Policy" content="([^"]+)"', INDEX)[1]
    assert "script-src 'self'" in csp and "unsafe-eval" not in csp
    assert page.inline_scripts == 0
    assert "fonts.googleapis.com" not in INDEX


def test_external_links_use_https(page):
    insecure = [u for u in page.links if u.startswith("http://")]
    assert not insecure, insecure


def test_keywords_appear_in_visible_copy():
    body = re.sub(r"<[^>]+>", " ", INDEX.split("<body>", 1)[1]).lower()
    for phrase in ("life in the uk test", "mock test", "ilr", "citizenship", "handbook"):
        assert phrase in body, phrase


def test_advertised_format_is_consistent():
    for fact in ("24", "45", "18", "£50"):
        assert f'<strong class="num">{fact}</strong>' in INDEX
    js = (ROOT / "assets" / "app.js").read_text(encoding="utf-8")
    assert "const MOCK_SIZE = 24;" in js and "const MOCK_SECONDS = 45 * 60;" in js and "const PASS = 0.75;" in js
