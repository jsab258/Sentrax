// Generates the scroll story's video and poster fallbacks (SCROLL-SPEC.md section 6) from the recorded
// timeline: renders every frame headlessly in the story page's capture mode (?capture=1&force=3d), then
// encodes one short seamless loop per beat as MP4 (H.264) and WebM (VP9), plus a WebP poster, for each
// orientation, into public/scroll-media/<orientation>/.
//
//   node scripts/scroll-clips.mjs                      all clips
//   SKIP_EXISTING=1 node scripts/scroll-clips.mjs      only the missing ones (resume an interrupted run)
//
// Needs ffmpeg with libx264, libvpx-vp9 and libwebp on the PATH. Commit the output.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const root = join(import.meta.dirname, '..');
const FPS = 24;
const SECONDS = 4;
/** Frames blended at the end of each clip into its start, so the loop has no cut. */
const BLEND = 18;
const FRAMES = FPS * SECONDS + BLEND;
const ORIENTATIONS = {
  landscape: { width: 1280, height: 720 },
  // Phone resolution (the video budget in SCROLL-SPEC.md section 8 is measured on this set).
  portrait: { width: 540, height: 960 },
};
/** One clip per beat, plus the last beat's try and found states: [beat, local from, local to, find]. */
const CLIPS = {
  establish: [0, 0.1, 0.9, 0],
  tag: [1, 0.35, 0.95, 0],
  rooms: [2, 0.15, 0.85, 0],
  relay: [3, 0.15, 0.9, 0],
  try: [4, 0.0, 0.3, 0],
  found: [4, 0.72, 1.0, 1],
};
/** Where in each clip the poster (and the reduced-motion still) is taken, 0 to 1. */
const POSTER_AT = { establish: 0.5, tag: 0.7, rooms: 0.85, relay: 0.7, try: 0.3, found: 0.8 };

/** SKIP_EXISTING=1 keeps clips that already have all three files (to resume an interrupted run). */
const skipExisting = process.env.SKIP_EXISTING === '1';
const ffmpeg = (args) =>
  new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`))));
  });
const encoding = new Set();

async function encode({ dir, out, clip, orientation, label, t0 }, poster) {
  await ffmpeg([
    '-i',
    join(dir, `${poster}.jpg`),
    '-c:v',
    'libwebp',
    '-quality',
    '78',
    join(out, `${clip}.webp`),
  ]);
  // Seamless loop: frames BLEND..end, with the last BLEND frames crossfading into the first ones.
  const loop = `[0:v]split[s1][s2];[s1]trim=start_frame=${BLEND},setpts=PTS-STARTPTS[a];[s2]trim=end_frame=${BLEND},setpts=PTS-STARTPTS[b];[a][b]xfade=transition=fade:duration=${BLEND / FPS}:offset=${(FRAMES - 2 * BLEND) / FPS},format=yuv420p[v]`;
  const input = [
    '-framerate',
    String(FPS),
    '-i',
    join(dir, '%04d.jpg'),
    '-filter_complex',
    loop,
    '-map',
    '[v]',
    '-an',
  ];
  // Constant quality with a bitrate ceiling, so busy shots (bloom, fine detail) stay inside the budget.
  const crf =
    orientation === 'portrait' ? { h264: '30', vp9: '40', max: 450 } : { h264: '28', vp9: '38', max: 1000 };
  await ffmpeg([
    ...input,
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    crf.h264,
    '-maxrate',
    `${crf.max}k`,
    '-bufsize',
    `${crf.max * 2}k`,
    '-profile:v',
    'main',
    '-movflags',
    '+faststart',
    join(out, `${clip}.mp4`),
  ]);
  await ffmpeg([
    ...input,
    '-c:v',
    'libvpx-vp9',
    '-crf',
    crf.vp9,
    '-b:v',
    `${crf.max}k`,
    '-row-mt',
    '1',
    '-deadline',
    'good',
    '-cpu-used',
    '4',
    join(out, `${clip}.webm`),
  ]);
  rmSync(dir, { recursive: true, force: true });
  const kb = (f) => (statSync(join(out, f)).size / 1024).toFixed(0);
  console.log(
    `${label}: done in ${((Date.now() - t0) / 1000).toFixed(0)} s, mp4 ${kb(`${clip}.mp4`)} KB, webm ${kb(`${clip}.webm`)} KB, poster ${kb(`${clip}.webp`)} KB`,
  );
}

// Serves the story with the Vite dev server (or an already running one passed as SCROLL_BASE).
const PORT = 5199;
const server = process.env.SCROLL_BASE
  ? null
  : spawn(
      process.execPath,
      [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'],
      {
        cwd: root,
        stdio: 'ignore',
      },
    );
const base = process.env.SCROLL_BASE ?? `http://localhost:${PORT}/`;
for (let i = 0; server && i < 60; i++) {
  if (
    await fetch(base).then(
      (r) => r.ok,
      () => false,
    )
  )
    break;
  await new Promise((r) => setTimeout(r, 500));
}
console.log(`capturing from ${base}`);
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const work = mkdtempSync(join(tmpdir(), 'scroll-clips-'));

try {
  for (const [orientation, size] of Object.entries(ORIENTATIONS)) {
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => console.error(`pageerror: ${e.message}`));
    await page.goto(`${base}scroll/?capture=1&force=3d`);
    await page.waitForSelector('[data-capture="ready"][data-ready="true"]', {
      state: 'attached',
      timeout: 180_000,
    });
    console.log(`${orientation}: page ready`);
    const out = join(root, 'public', 'scroll-media', orientation);
    mkdirSync(out, { recursive: true });
    for (const [clip, [beat, from, to, find]] of Object.entries(CLIPS)) {
      if (skipExisting && ['mp4', 'webm', 'webp'].every((e) => existsSync(join(out, `${clip}.${e}`))))
        continue;
      const dir = join(work, `${orientation}-${clip}`);
      mkdirSync(dir, { recursive: true });
      const t0 = Date.now();
      for (let i = 0; i < FRAMES; i++) {
        const u = i / (FRAMES - 1);
        const local = from + (to - from) * u;
        const data = await page.evaluate(
          ([b, l, f]) => {
            const cap = window.__scrollCapture;
            cap.frame(cap.progressOf(b, l), f);
            return document.querySelector('.ss-canvas').toDataURL('image/jpeg', 0.92);
          },
          [beat, local, find],
        );
        writeFileSync(
          join(dir, `${String(i).padStart(4, '0')}.jpg`),
          Buffer.from(data.split(',')[1], 'base64'),
        );
      }
      const poster = String(Math.round(POSTER_AT[clip] * (FRAMES - 1))).padStart(4, '0');
      const target = { dir, out, clip, orientation, label: `${orientation}/${clip}`, t0 };
      // Encode in the background while the next clip renders (at most two encodes at a time).
      while (encoding.size >= 2) await Promise.race(encoding);
      const job = encode(target, poster).finally(() => encoding.delete(job));
      encoding.add(job);
    }
    await page.close();
  }
  await Promise.all(encoding);
} finally {
  await browser.close();
  server?.kill();
  rmSync(work, { recursive: true, force: true });
}
