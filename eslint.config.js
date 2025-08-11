// Minimal ESLint flat config for ESM Node projects
export default [
  {
    files: ["**/*.ts", "**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      // keep it very light to avoid churn
      "no-unused-vars": "warn",
      "no-undef": "error",
    },
  },
];
