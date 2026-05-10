#!/usr/bin/env bash
# Create or update all Google Cloud Secret Manager secrets required by the app.
# Run from an authenticated shell before the first Cloud Run deployment.
# Usage: ./scripts/create-secrets.sh
#
# Secrets are read from the environment. Export them before running:
#   export SUPABASE_SERVICE_ROLE_KEY="..."
#   export NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
#   ... etc.
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-pbd-rjk}"

upsert_secret() {
  local name="$1"
  local value="$2"
  if gcloud secrets describe "$name" --project="$PROJECT_ID" &>/dev/null; then
    echo "  Updating $name..."
    echo -n "$value" | gcloud secrets versions add "$name" --data-file=- --project="$PROJECT_ID"
  else
    echo "  Creating $name..."
    echo -n "$value" | gcloud secrets create "$name" --data-file=- --project="$PROJECT_ID" --replication-policy=automatic
  fi
}

echo "==> Project: $PROJECT_ID"
echo "==> Upserting secrets..."

upsert_secret "SUPABASE_SERVICE_ROLE_KEY"      "${SUPABASE_SERVICE_ROLE_KEY:?}"
upsert_secret "NEXT_PUBLIC_SUPABASE_ANON_KEY"  "${NEXT_PUBLIC_SUPABASE_ANON_KEY:?}"
upsert_secret "GOOGLE_CLIENT_ID"               "${GOOGLE_CLIENT_ID:?}"
upsert_secret "GOOGLE_CLIENT_SECRET"           "${GOOGLE_CLIENT_SECRET:?}"
upsert_secret "SESSION_SECRET"                 "${SESSION_SECRET:?}"
upsert_secret "QUICKBOOKS_CLIENT_ID"           "${QUICKBOOKS_CLIENT_ID:?}"
upsert_secret "QUICKBOOKS_CLIENT_SECRET"       "${QUICKBOOKS_CLIENT_SECRET:?}"
upsert_secret "QUICKBOOKS_REDIRECT_URI"        "${QUICKBOOKS_REDIRECT_URI:?}"
upsert_secret "QUICKBOOKS_SANDBOX"             "${QUICKBOOKS_SANDBOX:?}"

echo ""
echo "==> All secrets upserted."
