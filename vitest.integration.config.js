import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["backend/integration/**/*.test.js"],
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 10000,
    env: {
      NODE_ENV: "test",
      JWT_KEY: "integration-tests-only-not-a-production-secret",
      TEST_DB_USERNAME: "conduit_test",
      TEST_DB_PASSWORD: "conduit_test",
      TEST_DB_NAME: "conduit_test",
      TEST_DB_HOSTNAME: "127.0.0.1",
      TEST_DB_PORT: "5433",
      TEST_DB_DIALECT: "postgres",
    },
  },
});
