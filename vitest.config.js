import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["backend/**/*.test.js", "frontend/src/**/*.test.js"],
    exclude: ["backend/integration/**", "**/node_modules/**"],
    restoreMocks: true,
    env: { TZ: "UTC" },
  },
});
