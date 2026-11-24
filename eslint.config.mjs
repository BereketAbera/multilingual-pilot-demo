import js from '@eslint/js';
import i18next from 'eslint-plugin-i18next';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Screens that have been through the "enable another screen" steps. A literal string in
// their JSX is an error. Add a file here as step one of enabling it: the lint output is
// the string inventory.
const ENABLED_SCREENS = ['src/screens/pilot/**/*.tsx', 'src/components/*.tsx'];

export default tseslint.config(
  { ignores: ['dist', 'node_modules', '.vercel', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ENABLED_SCREENS,
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          'jsx-attributes': { include: ['aria-label', 'alt', 'title', 'placeholder'] },
        },
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.{ts,mjs}', 'vite/**/*.ts', 'api/**/*.ts', 'e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
);
