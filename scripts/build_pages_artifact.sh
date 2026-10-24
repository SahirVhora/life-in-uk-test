#!/usr/bin/env bash
# Build the public GitHub Pages artifact into dist/. Only allow-listed files ship.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"
rm -rf "$DIST"
mkdir -p "$DIST"

for path in index.html favicon.svg preview.png robots.txt sitemap.xml assets; do
  cp -R "$ROOT/$path" "$DIST/$path"
done

touch "$DIST/.nojekyll"
find "$DIST" -type f | sort | sed "s#^$DIST/##"
