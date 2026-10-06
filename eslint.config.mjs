import js from "@eslint/js";
import globals from "globals";
import hooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["**/node_modules/**", "**/dist/**", "**/coverage/**", "**/.venv/**"] },
  {
    files: ["**/*.{js,jsx,mjs}", "backend/.sequelizerc"],
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["backend/**/*.js", "backend/.sequelizerc"],
    languageOptions: { sourceType: "commonjs", globals: globals.node },
  },
  {
    files: ["frontend/src/**/*.{js,jsx}"],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: globals.browser,
    },
    plugins: { "react-hooks": hooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    files: ["*.{js,mjs}", "frontend/vite.config.js"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["**/*.test.js"],
    languageOptions: {
      globals: Object.fromEntries(
        ["describe", "it", "test", "expect", "vi", "beforeEach", "afterEach", "beforeAll", "afterAll"]
          .map((name) => [name, "readonly"]),
      ),
    },
  },
];
