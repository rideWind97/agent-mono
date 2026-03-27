import eslint from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import-x";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: [
      "dist/**",
      "build/**",
      "node_modules/**",
      ".turbo/**",
      "coverage/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.es2022,
      },
    },
    plugins: {
      "@typescript-eslint": eslint,
      "import-x": importPlugin,
    },
    rules: {
      // TypeScript
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      // Import
      "import-x/order": [
        "warn",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc" },
        },
      ],
      "import-x/no-duplicates": "warn",

      // General
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  eslintConfigPrettier,
];
