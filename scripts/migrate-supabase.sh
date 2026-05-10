#!/usr/bin/env bash
# Apply Claude Inbox Supabase migrations to the linked project.
# Requires: Supabase CLI (brew install supabase/tap/supabase)
#           SUPABASE_ACCESS_TOKEN set, or `supabase login` completed.
#
# Usage:
#   # Preview (dry run):
#   ./scripts/migrate-supabase.sh --dry-run
#
#   # Apply to production:
#   ./scripts/migrate-supabase.sh
set -euo pipefail

MIGRATIONS_DIR="modules/claude-inbox/supabase/migrations"
SUPABASE_PROJECT_ID="${SUPABASE_PROJECT_ID:-vzwblrdtltsrdimrjutf}"
DRY_RUN=false

for arg in "$@"; do
  [[ "$arg" == "--dry-run" ]] && DRY_RUN=true
done

if ! command -v supabase &>/dev/null; then
  echo "ERROR: supabase CLI not found."
  echo "  Install: brew install supabase/tap/supabase"
  exit 1
fi

echo "==> Supabase project: $SUPABASE_PROJECT_ID"
echo "==> Migrations directory: $MIGRATIONS_DIR"
echo ""

if [[ "$DRY_RUN" == "true" ]]; then
  echo "==> [DRY RUN] Migration files that would be applied:"
  ls -1 "$MIGRATIONS_DIR"/*.sql
  echo ""
  echo "    Run without --dry-run to apply."
  exit 0
fi

echo "==> Pushing migrations via Supabase CLI..."
supabase db push \
  --project-ref "$SUPABASE_PROJECT_ID" \
  --include-all \
  --linked

echo ""
echo "==> Migrations applied successfully."
