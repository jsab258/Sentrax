// Fails the build when the homepage scroll story exceeds a budget of SCROLL-SPEC.md section 8:
// - embed loader (dist/scroll-embed.js): 10 KB gzip or less;
// - story JavaScript beyond the loader (everything the story page loads, static and dynamic): 350 KB gzip;
// - 3D assets (story JavaScript, CSS and fonts gzip or as stored, the textures and the KTX2 transcoder):
//   the budget of the realistic look (look C in the spec, the one kept): 9 MB desktop and 4 MB phone.
//   Desktop and phone load the same files today (textures on the low tier); the phone number is checked
//   separately so a later desktop-only upgrade cannot slip through;
// - video fallback, all clips combined at phone resolution (the portrait set, the larger of the MP4 and
//   WebM sets plus the posters): 4 MB.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const KB = 1024;
const MB = 1024 * 1024;
const BUDGET = {
  loaderKB: 10,
  storyJsKB: 350,
  assetsMB: { desktop: 9, phone: 4 },
  videoMB: 4,
};
const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');
const assets = join(dist, 'story-assets');
const manifest = JSON.parse(readFileSync(join(root, 'src', 'scene', 'assets', 'manifest.json'), 'utf8'));
const storyTextures = JSON.parse(readFileSync(join(root, 'src', 'scroll', 'three', 'textures.json'), 'utf8'));
const gz = (file) => gzipSync(readFileSync(file)).length;
const raw = (file) => statSync(file).size;
let failed = false;
const report = (label, value, budget, unit) => {
  const ok = value <= budget;
  failed ||= !ok;
  console.log(
    `${label}: ${value.toFixed(unit === 'KB' ? 1 : 2)} ${unit} (budget ${budget} ${unit})${ok ? '' : '  OVER BUDGET'}`,
  );
};

// Loader.
report('Embed loader', gz(join(dist, 'scroll-embed.js')) / KB, BUDGET.loaderKB, 'KB');

// Story JavaScript: the story page's entry and everything it imports, statically or dynamically.
const html = readFileSync(join(dist, 'scroll', 'index.html'), 'utf8');
const start = [...html.matchAll(/<script[^>]+src="[^"]*story-assets\/([^"]+\.js)"/g)].map((m) => m[1]);
const js = new Set();
const walk = (file) => {
  if (js.has(file)) return;
  js.add(file);
  const src = readFileSync(join(assets, file), 'utf8');
  for (const m of src.matchAll(/["'`]\.\/([\w.-]+\.js)["'`]/g))
    if (existsSync(join(assets, m[1]))) walk(m[1]);
};
start.forEach(walk);
const jsBytes = [...js].reduce((s, f) => s + gz(join(assets, f)), 0);
report(`Story JS (${js.size} chunks)`, jsBytes / KB, BUDGET.storyJsKB, 'KB');

// 3D assets.
const files = readdirSync(assets);
const cssFiles = [
  ...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="[^"]*story-assets\/([^"]+\.css)"/g),
].map((m) => m[1]);
const css = cssFiles.reduce((s, f) => s + gz(join(assets, f)), 0);
const fonts = files.filter((f) => f.endsWith('.woff2')).reduce((s, f) => s + raw(join(assets, f)), 0);
const transcoder = files
  .filter((f) => f.startsWith('basis_transcoder'))
  .reduce((s, f) => s + gz(join(assets, f)), 0);
const textures = storyTextures.flatMap((t) =>
  t.maps.map((m) => join(dist, manifest.textures[t.name].maps[m].low)),
);
for (const t of textures) if (!existsSync(t)) throw new Error(`missing ${t}`);
const tex = textures.reduce((s, f) => s + raw(f), 0);
const total = jsBytes + css + fonts + tex + transcoder;
for (const device of ['desktop', 'phone']) {
  report(
    `3D assets, ${device} (textures ${(tex / MB).toFixed(2)} MB)`,
    total / MB,
    BUDGET.assetsMB[device],
    'MB',
  );
}

// Video fallback at phone resolution.
const dir = join(dist, 'scroll-media', 'portrait');
if (!existsSync(dir)) throw new Error(`missing ${dir} (run node scripts/scroll-clips.mjs)`);
const list = readdirSync(dir);
const sum = (ext) => list.filter((f) => f.endsWith(ext)).reduce((s, f) => s + raw(join(dir, f)), 0);
report(
  `Video, phone (MP4 ${(sum('.mp4') / MB).toFixed(2)} MB, WebM ${(sum('.webm') / MB).toFixed(2)} MB, posters ${(sum('.webp') / MB).toFixed(2)} MB)`,
  (Math.max(sum('.mp4'), sum('.webm')) + sum('.webp')) / MB,
  BUDGET.videoMB,
  'MB',
);

if (failed) {
  console.error('Scroll story budget exceeded.');
  process.exit(1);
}
