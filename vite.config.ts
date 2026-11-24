/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { standInApi } from './vite/apiMiddleware';
import { i18nReport } from './vite/i18nReport';

export default defineConfig({
  plugins: [react(), tailwindcss(), i18nReport(), standInApi()],
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    css: false,
  },
});
