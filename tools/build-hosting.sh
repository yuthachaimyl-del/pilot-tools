#!/bin/bash
# Build the Firebase Hosting folder from this repo's web files.
#   bash tools/build-hosting.sh OUT_DIR SITE
# Writes OUT_DIR/public/* and OUT_DIR/firebase.json. Used by deploy.sh and .github/workflows/deploy.yml.
set -e
OUT=${1:?usage: build-hosting.sh OUT_DIR SITE}
SITE=${2:?usage: build-hosting.sh OUT_DIR SITE}
SRC=$(cd "$(dirname "$0")/.." && pwd)
rm -rf "$OUT" && mkdir -p "$OUT/public"
cp "$SRC"/*.html "$SRC"/*.js "$OUT/public/"
cp "$SRC"/*.png "$SRC"/*.webmanifest "$OUT/public/" 2>/dev/null || true
# installable app: manifest + icons on every page
for f in "$OUT"/public/*.html; do grep -q "manifest.webmanifest" "$f" || sed -i 's#</head>#<link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="apple-touch-icon.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="CoolCrew"><meta name="theme-color" content="\#1b1e2b"></head>#' "$f"; done
# donate + feedback buttons on every page (not the scanner: they cover its crop screen)
for f in "$OUT"/public/*.html; do [ "$(basename "$f")" = scan.html ] && continue; grep -q 'src="extras.js"' "$f" || sed -i 's#</body>#<script src="extras.js" defer></script></body>#' "$f"; done
cat > "$OUT/firebase.json" <<JSON
{"hosting":{"site":"$SITE","public":"public","headers":[{"source":"**","headers":[{"key":"Cache-Control","value":"no-cache"}]}]}}
JSON
