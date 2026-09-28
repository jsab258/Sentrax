# Progress

Working file for resuming after a restart or context compaction. On restart read this file, SPEC.md and
DECISIONS.md first. Branch: `claude/sentrax-3d-rtls-demo-jtoerz`. Preview: https://jsab258.github.io/Sentrax/

## Done

- M0 scaffold, research, brand, content model, CI.
- M1 simulation engine, hospital and warehouse world data, 2D debug view (`?dev=sim`).
- M2 hospital world in 3D: building with cutaway, furniture, equipment, devices with markers, people,
  quality tiers, overlay pass, swatch sheet. Reviewed and approved (DECISIONS.md 55 to 69).
- M2b preview workflow (`.github/workflows/pages.yml`), base path, noindex, dev tools behind URL parameters.
  Rehearsed locally under `/Sentrax/`: textures, HDRI and transcoder load, no errors.
- M3 hospital experience (DECISIONS 70, 76 to 88): Radio, Data and Insight layers with casings and depth
  dimming, halo glow, SOLIX node and integration cards on the network plane, SOLIX dashboard (asset search,
  alerts with acknowledge, KPIs, mini map, temperature chart, dwell heatmap), in-scene DOM labels, stories
  H1 to H5 with narration, back/next/autoplay/skip, arrow keys, end cards, deep links, explore mode base.
  Tests: exact-event story tests (`src/experience/__tests__/hospitalStories.test.ts`), integration log and
  heatmap tests, Playwright guided spec (e2e/guided.spec.ts). Screenshots in docs/screenshots/m3, including
  overlay-depth-before/after.

- M4 warehouse (DECISIONS 89 to 103): hall with cutaway, racks and stock (instanced), docks with shelters and
  trailers, yard one dock height below the hall, cold room, cage, office, stations, forklifts with a moving
  carriage, yard tractor towing, seated drivers, hi-vis workers; stories W1 to W5 with exact-event tests
  (`src/experience/__tests__/warehouseStories.test.ts`); dashboard slot, stations and muster panels; per-scene
  chunks and a payload check in the build. Engine: RSSI fix floor, fresh-fix rule after BiLink, towing, loads
  in trailers, reverse legs, fork lowering, muster anchor. Overlay lines now render (shader fix).
  Screenshots: `docs/screenshots/m4`; M3 set recaptured with lines. Captures run against a production build
  with dev tools (`VITE_ENABLE_DEV_TOOLS=true npx vite build --outDir dist-shots`, `vite preview --port 4173`,
  `E2E_BASE_URL=http://127.0.0.1:4173/ SCREENSHOTS=1 SCREENSHOT_MILESTONE=m4 npx playwright test e2e/screenshots.spec.ts`).

- M5 explore mode (DECISIONS 104 to 108): panel with time controls, camera presets and event triggers per
  scene, drag people and tagged assets, device product cards with photos (`public/devices`), ?device= deep
  link, dev handle `window.__sentrax`. Tests: `src/experience/__tests__/triggers.test.ts`,
  `e2e/sandbox.spec.ts` (drag included).

- M6 polish (DECISIONS 109 to 119): teaser mode (`?mode=teaser`, H1 and W1 teaser loop, pause, no camera
  input, offscreen pause), iframe `ready` after the first frame, Credits dialog (`src/content/credits.ts`, checked
  against ASSETS.md), accessibility fixes, simulation performance pass (warehouse step 1.25 to 0.53 ms, results
  unchanged). Tests: `teaserStories.test.ts`, `credits.test.ts`, e2e `teaser`, `embed` (postMessage), `analytics`
  (all eight events, no cookies, no third-party requests), `a11y` (axe WCAG A and AA, keyboard, reduced
  motion), `credits`, `stories` (all ten stories end to end with their narration and takeaway).

## Next

1. M7 (deploy target) is not started: it needs the user's choice of host (SPEC section 12).

## Open issues

- None blocking. GitHub Pages was enabled on 2026-09-28; the Pages workflow deploys every push to this branch and
  its verify job runs `e2e/preview.spec.ts` against the live URL (both scenes, H1, W1, the teaser, both tiers).
  The same spec passed 4/4 from this session against https://jsab258.github.io/Sentrax/ (run 36473404314).
