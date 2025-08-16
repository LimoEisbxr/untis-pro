#!/bin/sh
set -e

# Ensure DATABASE_URL is present
if [ -z "${DATABASE_URL}" ]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

# Run Prisma migrations and generate client (idempotent in runtime)
# If migration history is empty, deploy will apply existing migrations
npx prisma migrate deploy

# Start the server
node dist/index.js
