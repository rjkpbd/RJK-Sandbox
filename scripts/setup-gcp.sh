#!/usr/bin/env bash
# First-time GCP setup for RJK-Sandbox.
# Run once from a gcloud-authenticated shell before the first deploy.
# Usage: ./scripts/setup-gcp.sh
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-pbd-rjk}"
REGION="${REGION:-us-central1}"
REPO="rjk-sandbox"
SERVICE="rjk-sandbox"
SA_EMAIL="843833531624-compute@developer.gserviceaccount.com"

echo "==> Project: $PROJECT_ID  Region: $REGION"

# ── APIs ─────────────────────────────────────────────────────────────────────
echo "==> Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  --project="$PROJECT_ID"

# ── Artifact Registry ────────────────────────────────────────────────────────
echo "==> Creating Artifact Registry repository..."
gcloud artifacts repositories create "$REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --project="$PROJECT_ID" \
  --description="RJK-Sandbox container images" \
  || echo "  (already exists — skipping)"

# ── Service account permissions ───────────────────────────────────────────────
echo "==> Granting Secret Manager access to compute service account..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/secretmanager.secretAccessor"

echo "==> Granting Cloud Run invoker (public traffic)..."
gcloud run services add-iam-policy-binding "$SERVICE" \
  --region="$REGION" \
  --member="allUsers" \
  --role="roles/run.invoker" \
  --project="$PROJECT_ID" \
  || echo "  (service not yet deployed — set after first deploy)"

# ── Cloud Build trigger ───────────────────────────────────────────────────────
echo "==> Granting Cloud Build service account permission to deploy Cloud Run..."
CB_SA="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')@cloudbuild.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$CB_SA" \
  --role="roles/run.admin"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$CB_SA" \
  --role="roles/iam.serviceAccountUser"

echo ""
echo "==> Setup complete."
echo "    Next: create secrets with ./scripts/create-secrets.sh, then push to trigger CI."
