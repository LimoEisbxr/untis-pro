#!/bin/sh
# POSIX sh: no pipefail available
set -eu

echo "[entrypoint] Starting backend container..."

# Ensure DATABASE_URL is present
if [ -z "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

# We already depend_on a healthy DB via docker-compose healthcheck, so no extra long poll.
# Perform a fast sanity check (single attempt) so we fail fast if networking is misconfigured.
if ! printf 'SELECT 1;' | npx prisma db execute --stdin >/dev/null 2>&1; then
  echo "[entrypoint] WARNING: Initial DB probe failed; proceeding (compose healthcheck should have ensured readiness)." >&2
fi

# Skip runtime generate if PRISMA_SKIP_RUNTIME_GENERATE=1 (image build already generated client)
if [ "${PRISMA_SKIP_RUNTIME_GENERATE:-0}" != "1" ]; then
  echo "[entrypoint] Generating Prisma client (override by setting PRISMA_SKIP_RUNTIME_GENERATE=1)..."
  npx prisma generate || {
    echo "[entrypoint] ERROR: prisma generate failed" >&2
    exit 1
  }
else
  echo "[entrypoint] Skipping prisma generate (PRISMA_SKIP_RUNTIME_GENERATE=1)."
fi

echo "[entrypoint] Applying migrations (prisma migrate deploy)..."
set +e
migrate_output=$(npx prisma migrate deploy 2>&1)
migrate_rc=$?
set -e

if [ $migrate_rc -ne 0 ]; then
  echo "[entrypoint] Migration deploy failed (exit $migrate_rc)."
  # Detect failed migration scenario (P3009) and abort with guidance instead of masking.
  if printf '%s' "$migrate_output" | grep -q 'P3009'; then
    echo "[entrypoint] ERROR: Detected failed migration (P3009). A previous migration is marked failed in the target DB."
    echo "[entrypoint] ----- migrate output begin -----"
    printf '%s\n' "$migrate_output"
    echo "[entrypoint] ----- migrate output end -----"
    echo "[entrypoint] ACTION REQUIRED: Fix by either (a) resetting dev DB: 'docker compose down -v' then 'docker compose up', or (b) marking the failed migration resolved after ensuring schema objects exist: 'docker compose exec backend npx prisma migrate resolve --applied <migration_name>' then rerun. Exiting to avoid hidden drift." >&2
    exit 1
  fi
  # If no migrations found (fresh DB with only schema) allow dev convenience fallback
  if printf '%s' "$migrate_output" | grep -qi 'No.*migrations'; then
    echo "[entrypoint] No migrations found; using 'prisma db push' to sync schema (dev fallback)."
    npx prisma db push --accept-data-loss || {
      echo "[entrypoint] ERROR: prisma db push failed" >&2
      exit 1
    }
  else
    echo "[entrypoint] Non-P3009 migrate failure; attempting one-time 'prisma db push' dev fallback..."
    if ! npx prisma db push --accept-data-loss; then
      echo "[entrypoint] ERROR: Fallback prisma db push also failed" >&2
      echo "[entrypoint] ----- migrate output begin -----"
      printf '%s\n' "$migrate_output"
      echo "[entrypoint] ----- migrate output end -----"
      exit 1
    fi
  fi
else
  echo "[entrypoint] Migrations applied successfully."
fi

echo "[entrypoint] Starting server..."
exec node dist/index.js
