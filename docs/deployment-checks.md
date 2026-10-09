# Deployment checks

`npm run test:smoke` checks the built frontend, its JavaScript bundle, deep links,
and database-backed read endpoints at `http://127.0.0.1:8080`. Set
`SMOKE_BASE_URL` to check a different address.

For a disposable test deployment, enable the write checks:

```bash
SMOKE_BASE_URL=http://127.0.0.1:8080 SMOKE_WRITE_TESTS=1 npm run test:smoke
```

These register a unique test account, log in, create an article, retrieve it,
and delete that article afterwards. The account remains in the test database;
the CI and E2E runners remove their disposable databases at the end.

`npm run test:e2e` runs these checks against the PR's built Docker image before
the browser tests. On `main`, the deployment verification job runs them against
the exact image digest published to GHCR.

## Persistence

The E2E runner and published-image verification also run `npm run test:persistence`.
It creates an account and article, removes the app and database containers without
deleting the database volume, and starts fresh containers using the same image.
It then logs in with the original credentials and checks the original article,
author and tags. This verifies storage beyond a restart of an existing container.

The script only accepts the disposable `conduit-e2e` and `conduit-smoke-*` Compose
project names. It keeps its generated credentials in a temporary file readable
only by its owner, then deletes that file on exit. The surrounding CI/E2E runner
removes the test database at the end.
