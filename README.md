# Conduit DevOps project

Course project for KTH DD2482 by Oscar Walter and Gabriel Räätäri Nyström.

Conduit is a small website where users can sign up, log in and write articles.
We use an [existing example Conduit app](https://github.com/TonyMckes/conduit-realworld-example-app)
and add tests, Docker, CI/CD and dependency checks to it. The app uses React, Express and PostgreSQL.

## 1. Install the tools

Install:

- [Git](https://git-scm.com/downloads).
- [Node.js 24](https://nodejs.org/en/download), which includes npm.
- [Docker Desktop](https://www.docker.com/products/docker-desktop/), which includes Docker Compose.
  On Linux, Docker Engine with the Compose plugin also works.

Open Docker Desktop and leave it running. Check the tools in a terminal:

```bash
git --version
node --version
npm --version
docker compose version
```

The commands below use a macOS or Linux terminal. On Windows, use WSL2 with Docker integration.

## 2. Download the project

```bash
git clone https://github.com/Owalter1891/conduit-devops.git
cd conduit-devops
npm ci
```

Run all later commands from this folder. `npm ci` installs the versions saved in
`package-lock.json`.

## 3. Run the app for development

Create the local settings file. Only copy it on first setup:

```bash
cp backend/.env.example backend/.env
```

The example already matches the local PostgreSQL setup. Start the database and app:

```bash
docker compose up -d --wait
npm run dev
```

Open **http://localhost:3000**. Click **Sign up** to create an account, then try
**New Article**. You do not need an existing account or sample data.

The API runs at http://localhost:3001/api/tags. Docker creates the database, and
the backend creates its tables when it starts.

To stop, press **Ctrl+C**, then run:

```bash
docker compose down
```

Your development database is kept for the next run.

## 4. Run the checks

These commands do not need the app running:

```bash
npm run infra:validate  # Check the Docker Compose files
npm run lint            # Check code style and common mistakes
npm run audit           # Check dependencies for known vulnerabilities
npm test                # Run unit tests
```

The audit blocks high and critical findings. Lower-severity findings are still shown.

### API integration tests

These test the API with a separate PostgreSQL database on port 5433:

```bash
docker compose -f compose.test.yaml up -d --wait
npm run test:integration
docker compose -f compose.test.yaml down
```

Run the last command even if a test fails. These tests reset their own database
and do not use your development data.

### Browser tests

Install Chromium once, then run the four Playwright tests:

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

Docker must be running. The command starts a separate app and database on port
18083, runs the tests, and removes the test containers and data afterward.
On Linux, installing Chromium's system dependencies may ask for sudo access.
Use `npm run test:e2e -- --headed` to watch the tests.

The browser tests cover signup and login, publishing an article, profile updates
and password changes. The runner also checks API write flows and that data survives
replacing the app and database containers. See [deployment checks](docs/deployment-checks.md)
for details.

## 5. Run the full app in Docker

This runs the built frontend, backend and database together. It is separate from
the development setup above.

Copy the settings file once:

```bash
cp .env.production.example .env.production
```

Run this command twice to generate two different secrets:

```bash
openssl rand -hex 32
```

Edit `.env.production`. Paste one value after `POSTGRES_PASSWORD=` and the other
after `JWT_KEY=`. The first is the database password; the second signs login tokens.
Keep this file private. Git and Docker builds ignore it.

Start the app and check it:

```bash
docker compose --env-file .env.production -f compose.production.yaml up -d --build --wait
npm run test:smoke
```

Open **http://localhost:8080**. The smoke test checks the frontend and API responses.

For deployment by image digest, see [the deployment command](docs/deploying.md).
The [local deployment guide](docs/local-deployment.md) also explains how to run
browser tests against an existing instance.

To see logs or stop:

```bash
docker compose --env-file .env.production -f compose.production.yaml logs --tail 100
docker compose --env-file .env.production -f compose.production.yaml down
```

Stopping with `down` keeps the database. Adding `--volumes` deletes its data.
Keep the same database password when reusing an existing database volume.

### Use an image from GitHub instead

Copy an image tag from a successful GitHub Actions run. Add it to `.env.production`:

```dotenv
APP_IMAGE=ghcr.io/owalter1891/conduit-devops:sha-REPLACE_WITH_FULL_COMMIT_SHA
```

Then run:

```bash
docker compose --env-file .env.production -f compose.production.yaml up -d --no-build --pull always --wait
```

If the image is private, first run `docker login ghcr.io -u YOUR_GITHUB_USERNAME`
and enter a GitHub token with `read:packages` when prompted. Published images are
Linux amd64; on an ARM Mac, use the local build above or Docker's amd64 emulation.

## Course requirements

- **CI:** GitHub Actions runs Compose validation, dependency checks, lint, unit tests,
  API tests, e2e tests and a frontend build on PRs targeting any branch and pushes to `main`.
  Manual runs also run these checks, but do not publish images.
- **CD:** After checks pass on `main`, Actions publishes a commit-tagged image to GHCR.
  Another job runs that exact image with PostgreSQL, runs smoke tests and cleans up.
  The deployment is temporary; it does not leave a website running online.
- **IaC:** The three Compose files define the containers, ports, health checks and
  database storage. CI uses the same test and production files as local runs.
- **Security:** `npm audit` checks dependencies. Dependabot opens update PRs for npm
  packages and GitHub Actions each week.
- **Collaboration:** Use a branch and PR for changes, and have the other team member
  review them. Set branch protection and required reviews in GitHub settings; they are not set by these files.
- **AI:** Codex helped with configuration, tests and documentation. Changes were
  checked with local tests and CI. Document the use of AI and its limitations in the course report.

Check the repository's **Actions** tab for run results and **Packages** for images.
The workflow uses GitHub's built-in token, so it needs no deployment passwords.

## License

The original app and this repository use the [MIT License](LICENSE).
