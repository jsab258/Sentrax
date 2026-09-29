/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Dev server only: serves the scroll story's embed loader at /scroll-embed.js, where the production build
 * puts it (vite.scroll.config.ts), so host pages use the same snippet in development and production.
 */
function scrollEmbedDev(): Plugin {
  return {
    name: 'sentrax-scroll-embed-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/scroll-embed.js', async (_req, res) => {
        const out = await server.transformRequest('/src/scroll/loader.ts');
        res.setHeader('Content-Type', 'text/javascript');
        res.end(out?.code ?? '');
      });
    },
  };
}

// Relative base so the static build works from any path (iframe embed, /demo page, subfolder hosting).
// The GitHub Pages preview sets VITE_BASE to the site path (for example /Sentrax/).
export default defineConfig({
  base: process.env.VITE_BASE || './',
  plugins: [react(), scrollEmbedDev()],
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
