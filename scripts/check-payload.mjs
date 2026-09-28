// Fails the build when a scene's payload exceeds its budget (SPEC section 11: 20 MB or less compressed
// on high, 8 MB or less on low). Payload of a scene on a tier = the JavaScript it loads (entry, the stage
// and scene chunks and their static imports, the KTX2 transcoder), CSS and fonts, gzip-compressed, plus
// its textures for that tier and its HDRI (already compressed formats, counted as stored).
// The texture and HDRI lists per scene live in src/scene/assets/scenes.json (a unit test keeps them in
// sync with the components).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_MB = { high: 20, low: 8 };
const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');
const assets = join(dist, 'assets');
const manifest = JSON.parse(readFileSync(join(root, 'src', 'scene', 'assets', 'manifest.json'), 'utf8'));
const scenes = JSON.parse(readFileSync(join(root, 'src', 'scene', 'assets', 'scenes.json'), 'utf8'));
const files = readdirSync(assets);

const gz = (file) => gzipSync(readFileSync(file)).length;
const raw = (file) => readFileSync(file).length;

/** A JS chunk plus every chunk it imports statically (not dynamic imports: those load on demand). */
function jsClosure(start, seen = new Set()) {
  if (seen.has(start)) return seen;
  seen.add(start);
  const src = readFileSync(join(assets, start), 'utf8');
  for (const m of src.matchAll(/(?:^|[;\s])import\s*(?:[^'"()]*?from\s*)?["']\.\/([^"']+\.js)["']/g)) {
    if (m[1]) jsClosure(m[1], seen);
  }
  return seen;
}

const chunk = (prefix) => {
  const f = files.find((x) => x.startsWith(`${prefix}-`) && x.endsWith('.js'));
  if (!f) throw new Error(`no chunk ${prefix}`);
  return f;
};

const entry = files.find((x) => /^index-.*\.js$/.test(x));
const css = files.filter((x) => x.endsWith('.css'));
const fonts = files.filter((x) => x.endsWith('.woff2'));
const transcoder = files.filter((x) => x.startsWith('basis_transcoder'));

let failed = false;
for (const [name, scene] of Object.entries(scenes)) {
  const js = new Set();
  for (const start of [entry, chunk('SceneStage'), chunk(scene.chunk)]) jsClosure(start, js);
  const jsBytes = [...js].reduce((s, f) => s + gz(join(assets, f)), 0);
  const fixed =
    jsBytes +
    css.reduce((s, f) => s + gz(join(assets, f)), 0) +
    fonts.reduce((s, f) => s + raw(join(assets, f)), 0) +
    transcoder.reduce((s, f) => s + gz(join(assets, f)), 0) +
    raw(join(dist, manifest.hdri[scene.hdri].path));
  for (const tier of ['high', 'low']) {
    let tex = 0;
    for (const t of scene.textures) {
      for (const map of Object.values(manifest.textures[t].maps)) {
        const file = join(dist, map[tier]);
        if (!existsSync(file)) throw new Error(`missing ${file}`);
        tex += raw(file);
      }
    }
    const mb = (fixed + tex) / 1024 / 1024;
    const ok = mb <= BUDGET_MB[tier];
    failed ||= !ok;
    console.log(
      `${name} ${tier}: ${mb.toFixed(2)} MB (JS ${(jsBytes / 1024).toFixed(0)} KB gzip in ${js.size} chunks, textures ${(tex / 1024 / 1024).toFixed(2)} MB), budget ${BUDGET_MB[tier]} MB${ok ? '' : '  OVER BUDGET'}`,
    );
  }
}
if (failed) {
  console.error('Scene payload budget exceeded.');
  process.exit(1);
}
