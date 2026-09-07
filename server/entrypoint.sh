#!/bin/sh
set -e

DB_FILE="/app/db/gamma_bomb.sqlite"

if [ ! -f "$DB_FILE" ]; then
  echo "Database not found — seeding..."
  node src/seed.js
fi

exec node src/index.js
