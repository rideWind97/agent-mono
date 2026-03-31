import vuePlugin from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";

import baseConfig from "./base.js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: "@typescript-eslint/parser",
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      vue: vuePlugin,
    },
    rules: {
      ...vuePlugin.configs["vue3-recommended"].rules,
      "vue/multi-word-component-names": "off",
    },
  },
];
