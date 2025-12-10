const js = require("@eslint/js");
const vue = require("eslint-plugin-vue");
const tseslint = require("@typescript-eslint/eslint-plugin");
const vueParser = require("vue-eslint-parser");
const tsParser = require("@typescript-eslint/parser");

module.exports = [
  {
    ignores: ["dist/**", "node_modules/**"]
  },
  js.configs.recommended,
  ...tseslint.configs["flat/recommended"],
  ...vue.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: "latest",
        sourceType: "module"
      }
    }
  },
  {
    files: ["src/**/*.{ts,tsx,js,vue}"],
    rules: {
      "vue/multi-word-component-names": "off",
      "vue/html-self-closing": "off",
      "vue/max-attributes-per-line": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/attributes-order": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off"
    }
  }
];
