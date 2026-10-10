#!/bin/bash
# Deploy this repo's web files to Firebase Hosting (coolcrew.web.app). Run in Google Cloud Shell:
#   git clone https://github.com/yuthachaimyl-del/pilot-tools ; bash pilot-tools/deploy.sh
# (Pushes to main also deploy automatically via .github/workflows/deploy.yml once tools/setup-auto-deploy.sh has been run.)
set -e
PROJECT=crew-brief
SITE=coolcrew
cd ~/pilot-tools && git pull -q || true
firebase hosting:sites:create "$SITE" --project "$PROJECT" --non-interactive 2>&1 | tail -2 || true
bash ~/pilot-tools/tools/build-hosting.sh ~/fbdeploy "$SITE"
cd ~/fbdeploy && firebase deploy --only hosting --project "$PROJECT" --non-interactive
echo "DONE https://$SITE.web.app"
