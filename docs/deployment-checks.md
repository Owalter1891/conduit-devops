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
