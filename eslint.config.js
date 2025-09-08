import js from "@eslint/js";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      "node_modules/**",
      ".output/**",
      ".nitro/**",
      ".tanstack/**",
      "dist/**",
      "build/**",
      "*.config.js",
      "*.config.ts",
      "worker-configuration.d.ts",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        console: "readonly",
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        setTimeout: "readonly",
        React: "readonly",
        KVNamespace: "readonly",
        D1Database: "readonly",
        R2Bucket: "readonly",
        process: "readonly",
        Buffer: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        crypto: "readonly",
        navigator: "readonly",
        getComputedStyle: "readonly",
        HTMLDivElement: "readonly",
        HTMLElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLSpanElement: "readonly",
        HTMLTableElement: "readonly",
        HTMLTableSectionElement: "readonly",
        HTMLTableRowElement: "readonly",
        HTMLTableCellElement: "readonly",
        HTMLTableCaptionElement: "readonly",
        // Browser API globals
        CustomEvent: "readonly",
        Event: "readonly",
        EventInit: "readonly",
        EventListener: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Headers: "readonly",
        HeadersInit: "readonly",
        Response: "readonly",
        Request: "readonly",
        BodyInit: "readonly",
        ResponseInit: "readonly",
        URL: "readonly",
        ExecutionContext: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": typescript,
      react,
      "react-hooks": reactHooks,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/triple-slash-reference": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
];
