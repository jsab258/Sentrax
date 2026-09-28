// Downloads the Poly Haven textures and HDRIs the scenes use (CC0), processes them and encodes KTX2.
//
//   node scripts/assets.mjs            fetch missing sources, then (re)encode everything
//   node scripts/assets.mjs plaster    only (re)encode the named texture sets or HDRIs, keep the rest
//
// Output (committed): public/assets/textures/<name>/<map>-<size>.ktx2, public/assets/hdri/<id>-1k.hdr,
// src/scene/assets/manifest.json (paths, real-world size, credits). Sources are cached in .asset-cache/.
// Needs `toktx` from KTX-Software 4.x on PATH. See ASSETS.md for licenses and modifications.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const root = join(import.meta.dirname, '..');
const cache = join(root, '.asset-cache');
const out = join(root, 'public', 'assets');
const API = 'https://api.polyhaven.com';

/**
 * name: our material name. id: Poly Haven asset. sizes: [high, low] texture sizes in px.
 * process: optional change to the color map (documented in ASSETS.md).
 */
const TEXTURES = [
  { name: 'vinyl', id: 'terrazzo_tiles', sizes: [2048, 1024], process: 'desaturate-light' },
  { name: 'plaster', id: 'painted_plaster_wall', sizes: [1024, 512], process: 'white-paint' },
  { name: 'bath-tiles', id: 'interior_tiles', sizes: [1024, 512] },
  { name: 'veneer', id: 'grey_oak_veneer_01', sizes: [1024, 512] },
  { name: 'leather', id: 'fabric_leather_01', sizes: [1024, 512], process: 'neutral-light' },
  { name: 'linen', id: 'cotton_jersey', sizes: [1024, 512], process: 'desaturate-light' },
  // Warehouse (M4): hall floor, yard, wall cladding.
  { name: 'concrete', id: 'smooth_concrete_floor', sizes: [2048, 1024], process: 'light-concrete' },
  { name: 'asphalt', id: 'clean_asphalt', sizes: [1024, 512] },
  { name: 'cladding', id: 'corrugated_iron_02', sizes: [1024, 512], process: 'desaturate-light' },
];
const HDRIS = [
  { id: 'hospital_room', size: '1k' },
  { id: 'empty_warehouse_01', size: '1k' },
];
const MAPS = { diff: 'Diffuse', nor: 'nor_gl', rough: 'Rough' };

async function json(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function download(url, file) {
  if (existsSync(file)) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

function kb(file) {
  return Math.round(statSync(file).size / 1024);
}

async function processColor(src, dst, size, mode) {
  let img = sharp(src).resize(size, size);
  if (mode === 'desaturate') img = img.modulate({ saturation: 0.25 });
  if (mode === 'desaturate-light') img = img.modulate({ saturation: 0.12, brightness: 1.35 });
  // Off-white paint: nearly neutral, mean near sRGB 225, texture variation halved. Sources are 16-bit,
  // so convert to 8-bit first; linear() offsets are in the image's own value range.
  // Neutral light grey that keeps the grain, so vertex colours can tint it (upholstery).
  if (mode === 'neutral-light') {
    const eight = await img.modulate({ saturation: 0 }).png().toBuffer();
    const mean = (await sharp(eight).stats()).channels[0].mean;
    img = sharp(eight).linear(1.2, 205 - 1.2 * mean);
  }
  // Light, neutral polished concrete for the warehouse hall: mean near sRGB 180, variation kept at 80 percent.
  if (mode === 'light-concrete') {
    const eight = await img.modulate({ saturation: 0.15 }).png().toBuffer();
    const mean = (await sharp(eight).stats()).channels[0].mean;
    img = sharp(eight).linear(0.8, 180 - 0.8 * mean);
  }
  if (mode === 'white-paint') {
    const eight = await img.modulate({ saturation: 0.1 }).png().toBuffer();
    img = sharp(eight).linear(0.5, 142);
  }
  await img.png().toFile(dst);
}

function encode(input, output, kind) {
  // Images are stored bottom-up so they sample like a flipY PNG (KTX2 textures cannot be flipped at upload).
  const common = ['--t2', '--genmipmap', '--lower_left_maps_to_s0t0'];
  const args =
    kind === 'nor'
      ? // Normals stay three-channel (no --normal_mode): three.js reads xyz from the normal map.
        [...common, '--encode', 'uastc', '--uastc_quality', '2', '--zcmp', '19', '--assign_oetf', 'linear']
      : kind === 'rough'
        ? [...common, '--encode', 'etc1s', '--clevel', '4', '--qlevel', '160', '--assign_oetf', 'linear']
        : [...common, '--encode', 'etc1s', '--clevel', '4', '--qlevel', '192', '--assign_oetf', 'srgb'];
  execFileSync('toktx', [...args, output, input], { stdio: 'inherit' });
}

async function main() {
  mkdirSync(cache, { recursive: true });
  const only = process.argv.slice(2);
  const manifestFile = join(root, 'src', 'scene', 'assets', 'manifest.json');
  const manifest =
    only.length && existsSync(manifestFile)
      ? JSON.parse(readFileSync(manifestFile, 'utf8'))
      : { textures: {}, hdri: {} };
  for (const t of TEXTURES) {
    if (only.length && !only.includes(t.name)) continue;
    const info = await json(`${API}/info/${t.id}`);
    const files = await json(`${API}/files/${t.id}`);
    const srcRes = t.sizes[0] >= 2048 ? '2k' : '1k';
    const dir = join(out, 'textures', t.name);
    mkdirSync(dir, { recursive: true });
    const entry = {
      source: `https://polyhaven.com/a/${t.id}`,
      polyHavenId: t.id,
      title: info.name,
      authors: Object.keys(info.authors ?? {}),
      license: 'CC0',
      sizeM: (info.dimensions ?? [1000, 1000]).map((mm) => mm / 1000),
      modified: t.process ?? null,
      maps: {},
    };
    for (const [key, polyKey] of Object.entries(MAPS)) {
      const url = files[polyKey]?.[srcRes]?.png?.url ?? files[polyKey]?.[srcRes]?.jpg?.url;
      if (!url) throw new Error(`${t.id}: no ${polyKey} at ${srcRes}`);
      const src = join(cache, `${t.id}_${key}_${srcRes}${url.endsWith('.png') ? '.png' : '.jpg'}`);
      await download(url, src);
      entry.maps[key] = {};
      for (const [tier, size] of [
        ['high', t.sizes[0]],
        ['low', t.sizes[1]],
      ]) {
        const png = join(cache, `${t.name}_${key}_${size}.png`);
        if (key === 'diff') await processColor(src, png, size, t.process);
        else await sharp(src).resize(size, size).png().toFile(png);
        const ktx = join(dir, `${key}-${size}.ktx2`);
        encode(png, ktx, key);
        entry.maps[key][tier] = `assets/textures/${t.name}/${key}-${size}.ktx2`;
        console.log(`${t.name} ${key} ${size}: ${kb(ktx)} KB`);
      }
    }
    manifest.textures[t.name] = entry;
  }
  for (const h of HDRIS) {
    if (only.length && !only.includes(h.id)) continue;
    const info = await json(`${API}/info/${h.id}`);
    const files = await json(`${API}/files/${h.id}`);
    const url = files.hdri[h.size].hdr.url;
    const dir = join(out, 'hdri');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${h.id}-${h.size}.hdr`);
    await download(url, file);
    manifest.hdri[h.id] = {
      source: `https://polyhaven.com/a/${h.id}`,
      title: info.name,
      authors: Object.keys(info.authors ?? {}),
      license: 'CC0',
      path: `assets/hdri/${h.id}-${h.size}.hdr`,
    };
    console.log(`hdri ${h.id}: ${kb(file)} KB`);
  }
  const manifestDir = join(root, 'src', 'scene', 'assets');
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
