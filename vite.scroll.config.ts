import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * Second build for the homepage scroll story (SCROLL-SPEC.md): the story page, the homepage mock and the
 * plain embed test page (the embed loader has its own build, vite.loader.config.ts). It writes next to
 * the full demo's build in dist/ without touching it (own assets folder, no public copy), so the demo's
 * output and budget checks stay as they are.
 */
export default defineConfig({
  // Relative by default: each page links its assets relative to itself (the pages sit one folder below the
  // site root); runtime URLs of textures, clips and the logo go through src/scroll/paths.ts.
  base: process.env.VITE_BASE || './',
  publicDir: false,
  build: {
    target: 'es2022',
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: false,
    assetsDir: 'story-assets',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        scroll: resolve(import.meta.dirname, 'scroll/index.html'),
        homePreview: resolve(import.meta.dirname, 'home-preview/index.html'),
        embedTest: resolve(import.meta.dirname, 'embed-test/index.html'),
      },
    },
  },
});
