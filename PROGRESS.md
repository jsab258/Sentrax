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

## Next (goal: M3 to M6 without checkpoint stops)

1. Rule 1 of the goal: re-run the Pages workflow and confirm the live preview loads (blocked, see below).
2. M6 teaser mode, iframe hooks, accessibility, analytics, Credits panel, performance pass, Playwright smoke
   test per story, live-preview checks. Performance: the warehouse simulation costs about 1.4 ms per step
   (hospital 0.26 ms); profile the radio sampling first.

## Open issues

- BLOCKED (2026-09-28 13:04 UTC): GitHub Pages is not enabled on the repository (configure-pages: "Get
  Pages site failed ... Not Found", run 36425931480), and this session's network policy denies
  jsab258.github.io (proxy 403), so the live preview cannot be opened from here.
