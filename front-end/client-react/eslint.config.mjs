// Reuse the repository's backend lint toolchain; no second lint dependency tree.
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../back-end/package.json", import.meta.url),
);
const js = require("@eslint/js");
const ts = require("typescript-eslint");
const globals = require("globals");
export default ts.config(
  { ignores: ["node_modules/**"] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx,mjs}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-useless-escape": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
);
