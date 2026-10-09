# Run and test locally

Docker with the Compose plugin is enough to run the app. The database stays in a
named volume, and the app binds to your machine at `http://127.0.0.1:8080`.

## Create local settings

From the repository root, create `.env.production` once. If it already exists,
reuse it; replacing the password would stop the app accessing its existing
database. These commands generate private local credentials:

```bash
umask 077
printf 'POSTGRES_PASSWORD=%s\nJWT_KEY=%s\nAPP_BIND_ADDRESS=127.0.0.1\nAPP_PORT=8080\n' \
  "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env.production
```

The settings file is ignored by Git. Change `APP_PORT` if port 8080 is occupied.

## Start the app

Build from your checkout and wait for the app and database:

```bash
docker compose --env-file .env.production -f compose.production.yaml up -d --build --wait --wait-timeout 120
```

Open `http://127.0.0.1:8080`, create an account, log in and publish an article.
You can also edit your profile with the password field empty, or enter a new
password and log in with it afterwards.

To test the exact image published by CI instead of a local build, follow
[Deploy a published image](deploying.md). The published image targets
`linux/amd64`; Docker Desktop on Apple Silicon can run it using emulation. Local
builds use your machine's architecture.

## Automated checks

The development tests need Node.js 24 and the repository dependencies:

```bash
npm ci
npx playwright install chromium
npm run test:e2e
```

This builds and tests a separate instance on port 18083, then removes its
containers and test database. The browser tests cover registration, logout and
login, publishing and reading an article, profile updates with an unchanged
password, and changing a password.

To run the same browser tests against the instance you already started:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 npx playwright test
```

These tests create unique accounts and articles that remain in that database.
For read-only checks:

```bash
SMOKE_BASE_URL=http://127.0.0.1:8080 npm run test:smoke
```

## Stop and start again

Stop the default instance without deleting its data:

```bash
docker compose --env-file .env.production -f compose.production.yaml down
```

Start it again with the command above. The same accounts and articles should
still be there. Use `down --volumes` only when you want to delete the local
database. If you used a separate `COMPOSE_PROJECT_NAME`, use that same name for
all start and stop commands.

This is a local deployment. A public URL for the course submission still needs
a host; running these checks locally does not provide one.
