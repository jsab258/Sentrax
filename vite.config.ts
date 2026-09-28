/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the static build works from any path (iframe embed, /demo page, subfolder hosting).
// The GitHub Pages preview sets VITE_BASE to the site path (for example /Sentrax/).
export default defineConfig({
  base: process.env.VITE_BASE || './',
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Scene tests run minutes of simulated time (about 5 s each on one core); the 5 s default is too tight.
    testTimeout: 30_000,
  },
});
