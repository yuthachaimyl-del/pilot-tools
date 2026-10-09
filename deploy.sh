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
cat > ~/fbdeploy/firebase.json <<JSON
{"hosting":{"site":"$SITE","public":"public","headers":[{"source":"**","headers":[{"key":"Cache-Control","value":"no-cache"}]}]}}
JSON
cd ~/fbdeploy && firebase deploy --only hosting --project "$PROJECT" --non-interactive
echo "DONE https://$SITE.web.app"
