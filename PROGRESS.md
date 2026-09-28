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

## Next (goal: M3 to M6 without checkpoint stops)

1. Rule 1 of the goal: re-run the Pages workflow and confirm the live preview loads (blocked, see below).
2. M3 hospital experience: Radio, Data and Insight layers with casings and depth dimming (DECISIONS 61, 70),
   halo glow, SOLIX node and integration cards on a network plane, dashboard (asset search, alerts with
   acknowledge, KPIs, mini map, in-scene labels, heatmap), stories H1 to H5 with narration, controls,
   end cards, deep links, one fixed-seed story test each (exact events, nothing unexpected).
3. M4 warehouse world in 3D plus stories W1 to W5 with the same tests.
4. M5 sandbox: drag, lens, event triggers, time controls, heatmap, device product cards, camera presets.
5. M6 teaser mode, iframe hooks, accessibility, analytics, Credits panel, performance pass, Playwright smoke
   test per story, live-preview checks.

## Open issues

- BLOCKED (2026-09-28 13:04 UTC): GitHub Pages is not enabled on the repository (configure-pages: "Get
  Pages site failed ... Not Found", run 36425931480), and this session's network policy denies
  jsab258.github.io (proxy 403), so the live preview cannot be opened from here.
