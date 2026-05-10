#!/usr/bin/env bash
# Manual one-shot deploy: build image, push, deploy to Cloud Run.
# CI (Cloud Build) runs this automatically on push to main.
# Use this script only for out-of-band hotfixes or first-deploy verification.
#
# Prerequisites:
#   gcloud auth login && gcloud auth configure-docker us-central1-docker.pkg.dev
#
# Usage: ./scripts/deploy.sh [image-tag]
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-pbd-rjk}"
REGION="${REGION:-us-central1}"
REPO="rjk-sandbox"
SERVICE="rjk-sandbox"
TAG="${1:-$(git rev-parse --short HEAD)}"
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$SERVICE:$TAG"

echo "==> Building image: $IMAGE"
docker build \
  -f home/Dockerfile \
  -t "$IMAGE" \
  -t "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$SERVICE:latest" \
  .

echo "==> Pushing image..."
docker push --all-tags "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$SERVICE"

echo "==> Deploying to Cloud Run ($SERVICE @ $REGION)..."
gcloud run deploy "$SERVICE" \
  --image="$IMAGE" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --platform=managed \
  --port=3000 \
  --timeout=3600s \
  --memory=512Mi \
  --cpu=1 \
  --set-env-vars="NODE_ENV=production,NEXT_PUBLIC_SUPABASE_URL=https://vzwblrdtltsrdimrjutf.supabase.co,NEXT_PUBLIC_APP_URL=https://rjk-sandbox-vdcl3qegiq-uc.a.run.app" \
  --set-secrets="SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,NEXT_PUBLIC_SUPABASE_ANON_KEY=NEXT_PUBLIC_SUPABASE_ANON_KEY:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,SESSION_SECRET=SESSION_SECRET:latest,QUICKBOOKS_CLIENT_ID=QUICKBOOKS_CLIENT_ID:latest,QUICKBOOKS_CLIENT_SECRET=QUICKBOOKS_CLIENT_SECRET:latest,QUICKBOOKS_REDIRECT_URI=QUICKBOOKS_REDIRECT_URI:latest,QUICKBOOKS_SANDBOX=QUICKBOOKS_SANDBOX:latest"

echo ""
echo "==> Deployed: https://rjk-sandbox-vdcl3qegiq-uc.a.run.app"
gcloud run services describe "$SERVICE" --region="$REGION" --project="$PROJECT_ID" --format="value(status.url)"
