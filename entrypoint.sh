#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy

# If needed, you can generate the Prisma client here:
# npx prisma generate

echo "Starting application..."
exec node dist/main.js
