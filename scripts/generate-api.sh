#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
# Keep build progress out of the generated JSON; replace only after a successful export.
docker compose --profile test build test
temp_schema=$(mktemp)
trap 'rm -f "$temp_schema"' EXIT
docker compose --profile test run --rm --no-deps -T test cargo run --locked --quiet --bin export-openapi > "$temp_schema"
node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' "$temp_schema"
cp "$temp_schema" openapi.json
cd frontend
npm ci
npm run generate:api
