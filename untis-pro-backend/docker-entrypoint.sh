#!/bin/sh
# POSIX sh: no pipefail available
set -eu

echo "[entrypoint] Starting backend container..."

# Ensure DATABASE_URL is present
if [ -z "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

echo "[entrypoint] Waiting for database to accept connections..."
max_tries=10
i=1
while [ "$i" -le "$max_tries" ]; do
  if printf 'SELECT 1;' | npx prisma db execute --stdin >/dev/null 2>&1; then
    echo "[entrypoint] Database is ready."
    break
  fi
  echo "[entrypoint] DB not ready yet, retry $i/$max_tries..."
  i=$((i+1))
  sleep 3
done

echo "[entrypoint] Generating Prisma client..."
npx prisma generate

echo "[entrypoint] Applying migrations (prisma migrate deploy)..."
if ! npx prisma migrate deploy 2>/dev/null; then
  echo "[entrypoint] No migrations found or migrate deploy failed. This is normal for fresh installations."
  echo "[entrypoint] Using 'prisma db push' to initialize database schema..."
  if ! npx prisma db push --accept-data-loss; then
    echo "[entrypoint] ERROR: prisma db push failed" >&2
    npx prisma migrate status || true
    exit 1
  fi
else
  echo "[entrypoint] Migrations applied successfully."
fi

# Verify critical tables exist; if not, attempt another sync (dev-friendly fallback)
if ! printf 'SELECT 1 FROM "User" LIMIT 1;' | npx prisma db execute --stdin >/dev/null 2>&1; then
  echo "[entrypoint] WARNING: 'User' table not found. Running additional 'prisma db push' to ensure schema sync."
  if ! npx prisma db push --accept-data-loss; then
    echo "[entrypoint] ERROR: Additional prisma db push failed" >&2
    npx prisma migrate status || true
    exit 1
  fi
fi

echo "[entrypoint] Starting server..."
exec node dist/index.js
