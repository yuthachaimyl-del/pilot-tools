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
# per-site overlay (icons, manifest, ...) and settings: sites/<SITE>/ (TG = tgcrew); coolcrew uses the repo root files
APP_TITLE="CoolCrew"; THEME="#1b1e2b"; SW_CACHE="coolcrew-v1"
if [ -d "$SRC/sites/$SITE" ]; then
  find "$SRC/sites/$SITE" -maxdepth 1 -type f ! -name site.env -exec cp {} "$OUT/public/" \;
  [ -f "$SRC/sites/$SITE/site.env" ] && . "$SRC/sites/$SITE/site.env"
fi
sed -i "s#const CACHE=\"coolcrew-v1\"#const CACHE=\"$SW_CACHE\"#" "$OUT/public/sw.js"
# installable app: manifest + icons on every page (scan.html has its own manifest)
for f in "$OUT"/public/*.html; do [ "$(basename "$f")" = scan.html ] && continue; grep -q 'href="manifest.webmanifest"' "$f" || sed -i "s|</head>|<link rel=\"manifest\" href=\"manifest.webmanifest\"><link rel=\"apple-touch-icon\" href=\"apple-touch-icon.png\"><meta name=\"apple-mobile-web-app-capable\" content=\"yes\"><meta name=\"apple-mobile-web-app-title\" content=\"$APP_TITLE\"><meta name=\"theme-color\" content=\"$THEME\"></head>|" "$f"; done
# donate + feedback buttons on every page (not the scanner: they cover its crop screen)
for f in "$OUT"/public/*.html; do [ "$(basename "$f")" = scan.html ] && continue; grep -q 'src="extras.js"' "$f" || sed -i 's#</body>#<script src="extras.js" defer></script></body>#' "$f"; done
cat > "$OUT/firebase.json" <<JSON
{"hosting":{"site":"$SITE","public":"public","headers":[{"source":"**","headers":[{"key":"Cache-Control","value":"no-cache"},{"key":"X-Frame-Options","value":"DENY"},{"key":"Content-Security-Policy","value":"frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self' https://docs.google.com"},{"key":"X-Content-Type-Options","value":"nosniff"},{"key":"Referrer-Policy","value":"strict-origin-when-cross-origin"}]}]}}
JSON
