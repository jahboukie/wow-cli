import typescriptParser from '@typescript-eslint/parser';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';

// Minimal ESLint flat config for ESM Node projects
export default [
  {
    files: ["src/**/*.{ts,js,mjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parser: typescriptParser,
      globals: {
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        setInterval: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin,
    },
    rules: {
      'no-unused-vars': 'warn',
      'eqeqeq': 'warn',
      'curly': 'warn',
      'prefer-const': 'warn',
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
];
