#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

case "${COMPOSE_PROJECT_NAME:-}" in
  conduit-e2e|conduit-smoke-*) ;;
  *) echo "Use a disposable conduit-e2e or conduit-smoke-* project for persistence checks." >&2; exit 1 ;;
esac

fixture_dir=$(mktemp -d "${TMPDIR:-/tmp}/conduit-persistence.XXXXXX")
export SMOKE_STATE_FILE="$fixture_dir/state.json"
cleanup() {
  if [ -f "$SMOKE_STATE_FILE" ]; then
    node -e 'require("node:fs").unlinkSync(process.argv[1])' "$SMOKE_STATE_FILE"
  fi
  rmdir "$fixture_dir"
}
trap cleanup EXIT

compose=(docker compose --env-file /dev/null -f compose.production.yaml)
SMOKE_PHASE=seed npm run test:smoke

# Replace both containers while keeping the named PostgreSQL volume.
"${compose[@]}" down --remove-orphans
"${compose[@]}" up -d --no-build --pull never --wait --wait-timeout 120

SMOKE_PHASE=verify npm run test:smoke
