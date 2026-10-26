import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          motion: ['framer-motion'],
          charts: ['recharts'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/v1': { target: 'http://127.0.0.1:3100', changeOrigin: true },
      // Same VOD tree the PHP site serves: /web/hrde/html/contents → /vod/contents, via the timeless.uz alias.
      '/contents': { target: 'https://127.0.0.1', secure: false, changeOrigin: false, headers: { host: 'timeless.uz' } },
      '/upload': { target: 'https://127.0.0.1', secure: false, changeOrigin: false, headers: { host: 'timeless.uz' } },
    },
  },
  // testTimeout: the parity pages render large legacy tables; under a full parallel run jsdom needs more than the 5 s default.
  // include: only src — the Playwright specs under e2e/ (*.spec.ts) run with `npm run test:e2e`, never under vitest.
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test/setup.ts'], testTimeout: 20_000, include: ['src/**/*.{test,spec}.{ts,tsx}'] },
});
