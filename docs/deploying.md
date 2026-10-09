# Deploy a published image

Use Docker with the Compose plugin and a checkout of this repository. The command
pulls an image pinned to its full digest, starts it with PostgreSQL, waits for both
services to be healthy, and checks the frontend and database-backed API.

Create `.env.production` with these settings and keep it private (`chmod 600
.env.production`). The file is ignored by Git.

```dotenv
POSTGRES_PASSWORD=<random database password>
JWT_KEY=<random signing key>
APP_BIND_ADDRESS=127.0.0.1
APP_PORT=8080
```

After the `main` workflow publishes an image, copy the image and digest from its
summary. Replace both placeholders before running:

```bash
bash scripts/deploy.sh 'ghcr.io/owalter1891/conduit-devops:sha-<commit>@sha256:<digest>'
```

For another settings file, pass its path as the second argument. Set
`COMPOSE_PROJECT_NAME` to keep a separate instance; otherwise the project is
`conduit-production`. The app is available at `http://127.0.0.1:8080` with the
settings above. The checks run inside the app container, so the deployment machine
does not need Node.js or npm.

Run the command again with the same digest to check the current deployment, or
with a new digest to update it. The command keeps the PostgreSQL volume and does
not create test accounts. Keep the same database password and signing key between
deployments.

Stop the default instance while preserving its data:

```bash
docker compose --env-file .env.production -f compose.production.yaml down
```
