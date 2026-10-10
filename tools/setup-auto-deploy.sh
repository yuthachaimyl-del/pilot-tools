#!/bin/bash
# One-time setup so GitHub Actions can deploy to Firebase Hosting without any stored key
# (Workload Identity Federation: only this repo's workflows can act as the deploy account).
# Run once in Google Cloud Shell:
#   git clone https://github.com/yuthachaimyl-del/pilot-tools ; bash pilot-tools/tools/setup-auto-deploy.sh
# Safe to re-run.
set -e
P=crew-brief
REPO=yuthachaimyl-del/pilot-tools
SA_NAME=github-deploy
SA=$SA_NAME@$P.iam.gserviceaccount.com
q(){ "$@" >/dev/null 2>&1 || true; }  # ignore "already exists" on re-runs

gcloud config set project "$P" >/dev/null
echo "1/5 enabling APIs…"
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com firebasehosting.googleapis.com
echo "2/5 deploy service account…"
q gcloud iam service-accounts create "$SA_NAME" --display-name="GitHub deploy (pilot-tools)"
for r in roles/firebasehosting.admin roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$P" --member="serviceAccount:$SA" --role="$r" --condition=None -q >/dev/null
done
echo "3/5 GitHub identity pool…"
q gcloud iam workload-identity-pools create github --location=global --display-name="GitHub Actions"
q gcloud iam workload-identity-pools providers create-oidc github --location=global --workload-identity-pool=github \
  --display-name="GitHub" --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='$REPO'"
N=$(gcloud projects describe "$P" --format='value(projectNumber)')
echo "4/5 allow $REPO to use the deploy account…"
gcloud iam service-accounts add-iam-policy-binding "$SA" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$N/locations/global/workloadIdentityPools/github/attribute.repository/$REPO" -q >/dev/null
echo "5/5 check…"
gcloud iam workload-identity-pools providers describe github --location=global --workload-identity-pool=github --format='value(state)'
echo
echo "เสร็จแล้ว ✅  ส่งบรรทัดนี้ให้ Claude:"
echo "PROJECT_NUMBER=$N"
