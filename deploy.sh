#!/bin/bash
# Deploy this repo's web files to Firebase Hosting (coolcrew.web.app). Run in Google Cloud Shell:
#   git clone https://github.com/yuthachaimyl-del/pilot-tools ; bash pilot-tools/deploy.sh
set -e
PROJECT=crew-brief
SITE=coolcrew
cd ~/pilot-tools && git pull -q || true
firebase hosting:sites:create "$SITE" --project "$PROJECT" --non-interactive 2>&1 | tail -2 || true
rm -rf ~/fbdeploy && mkdir -p ~/fbdeploy/public
cp ~/pilot-tools/*.html ~/pilot-tools/*.js ~/fbdeploy/public/
cp ~/pilot-tools/*.png ~/pilot-tools/*.webmanifest ~/fbdeploy/public/ 2>/dev/null || true
# installable app: manifest + icons on every page
for f in ~/fbdeploy/public/*.html; do grep -q "manifest.webmanifest" "$f" || sed -i 's#</head>#<link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="apple-touch-icon.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="CoolCrew"><meta name="theme-color" content="\#1b1e2b"></head>#' "$f"; done
# donate + feedback buttons on every page
for f in ~/fbdeploy/public/*.html; do grep -q 'src="extras.js"' "$f" || sed -i 's#</body>#<script src="extras.js" defer></script></body>#' "$f"; done
cat > ~/fbdeploy/firebase.json <<JSON
{"hosting":{"site":"$SITE","public":"public","headers":[{"source":"**","headers":[{"key":"Cache-Control","value":"no-cache"}]}]}}
JSON
cd ~/fbdeploy && firebase deploy --only hosting --project "$PROJECT" --non-interactive
echo "DONE https://$SITE.web.app"
