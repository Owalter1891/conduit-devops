#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: bash scripts/deploy.sh <image@sha256:digest> [settings-file]" >&2
  exit 1
fi

image=$1
if ! [[ "$image" =~ ^[a-zA-Z0-9][a-zA-Z0-9._:/-]*@sha256:[a-f0-9]{64}$ ]]; then
  echo "Use an image pinned to its full sha256 digest." >&2
  exit 1
fi

repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
settings_file=${2:-"$repo_dir/.env.production"}
if [ ! -f "$settings_file" ]; then
  echo "Deployment settings file does not exist: $settings_file" >&2
  exit 1
fi
if [[ "$settings_file" != /* ]]; then
  settings_file="$PWD/$settings_file"
fi

cd "$repo_dir"
export APP_IMAGE="$image"
compose=(docker compose --env-file "$settings_file" -f compose.production.yaml)
"${compose[@]}" config --quiet
"${compose[@]}" pull app db
"${compose[@]}" up -d --no-build --pull never --wait --wait-timeout 120

echo "Deployment is healthy: $APP_IMAGE"
