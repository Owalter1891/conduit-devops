#!/usr/bin/env bash
set -euo pipefail
cd /opt/conduit

# Preserve these values across deployments, especially the database password.
set -a
source .env.production
set +a
export APP_IMAGE APP_DOMAIN
export APP_BIND_ADDRESS=127.0.0.1 APP_PORT=8080
export COMPOSE_PROJECT_NAME=conduit-production
export COMPOSE_FILE=compose.production.yaml:infra/aws/compose.aws.yaml

docker compose --env-file /dev/null pull --quiet
docker compose --env-file /dev/null up -d --no-build --wait --wait-timeout 180

# Record what is actually running without writing secrets to command output.
printf '%s\n' "$APP_IMAGE" > deployed-image
printf '%s\n' "$APP_DOMAIN" > deployed-domain

# Only this application's old images are removed; database volumes are kept.
while read -r image; do
  if [ "$image" = "${APP_IMAGE%@*}" ]; then continue; fi
  docker image rm "$image" || true
done < <(docker image ls ghcr.io/owalter1891/conduit-devops --format '{{.Repository}}:{{.Tag}}' | grep -v ':<none>$')
docker image prune -f
