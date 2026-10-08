#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Dedicated project, image and port; never use local production credentials.
export COMPOSE_PROJECT_NAME=conduit-e2e
export APP_IMAGE=conduit-devops:e2e
export APP_BIND_ADDRESS=127.0.0.1
export APP_PORT=18083
export POSTGRES_PASSWORD=e2e-database-only
export JWT_KEY=e2e-signing-key-only
compose=(docker compose --env-file /dev/null -f compose.production.yaml)

cleanup() {
  result=$?
  trap - EXIT
  if [ "$result" -ne 0 ]; then
    "${compose[@]}" logs --no-color --tail 100 || true
  fi
  "${compose[@]}" down --volumes --remove-orphans || result=1
  exit "$result"
}
trap cleanup EXIT

# Start each run with a fresh database, even after a previously interrupted run.
"${compose[@]}" down --volumes --remove-orphans
"${compose[@]}" up -d --build --wait --wait-timeout 120
SMOKE_BASE_URL="http://127.0.0.1:${APP_PORT}" SMOKE_WRITE_TESTS=1 npm run test:smoke
SMOKE_BASE_URL="http://127.0.0.1:${APP_PORT}" npm run test:persistence
node node_modules/playwright/cli.js test "$@"
