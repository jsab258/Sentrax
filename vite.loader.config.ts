import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * Third build: the scroll story's embed loader as one small classic script (IIFE) at dist/scroll-embed.js,
 * so host pages can include it with a plain script tag (EMBED.md).
 */
export default defineConfig({
  publicDir: false,
  build: {
    target: 'es2019',
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/scroll/loader.ts'),
      name: 'SentraxScrollEmbed',
      formats: ['iife'],
      fileName: () => 'scroll-embed.js',
    },
  },
});
