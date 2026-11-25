import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { GAME_TITLE } from './src/config.ts';

// Relative base works on any GitHub Pages path because routing is hash-based.
// Override with VITE_BASE_PATH (e.g. "/ashen-road/") if you need absolute URLs.
const base = process.env.VITE_BASE_PATH || './';

export default defineConfig({
  base,
  plugins: [
    react(),
    {
      name: 'inject-title',
      transformIndexHtml: (html) => html.replace(/%GAME_TITLE%/g, GAME_TITLE),
    },
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
