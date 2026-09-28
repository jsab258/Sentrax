// Fails the build when the initial JavaScript exceeds the budget (SPEC section 11: 400 KB gzip or less).
// Initial JS = the entry script plus every modulepreload referenced from dist/index.html.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 400;
// Script URLs start with the build's base path ('./' by default, '/Sentrax/' for the Pages preview).
const base = process.env.VITE_BASE || './';
const dist = join(import.meta.dirname, '..', 'dist');
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const refs = new Set();
for (const m of html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)) refs.add(m[1]);
for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g)) refs.add(m[1]);

let total = 0;
for (const ref of refs) {
  const file = ref.startsWith(base) ? ref.slice(base.length) : ref.replace(/^\.?\//, '');
  const bytes = gzipSync(readFileSync(join(dist, file))).length;
  total += bytes;
  console.log(`  ${ref}  ${(bytes / 1024).toFixed(1)} KB gzip`);
}
const kb = total / 1024;
console.log(`Initial JS: ${kb.toFixed(1)} KB gzip (budget ${BUDGET_KB} KB)`);
if (kb > BUDGET_KB) {
  console.error('Initial JS budget exceeded.');
  process.exit(1);
}
