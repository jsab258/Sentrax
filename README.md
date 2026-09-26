# Sentrax interactive 3D RTLS demo

Standalone interactive 3D web demo that shows how Sentrax BLE real-time location works (RSSI, AoA, BiLink, SOLIX) in a hospital ward and a warehouse with production. Prototype, built to be embedded later via iframe as a homepage teaser and as a full /demo page.

- Source of truth: SPEC.md
- Decisions: DECISIONS.md
- Assets and licenses: ASSETS.md
- Brand tokens and their sources: BRAND.md
- Device reference sheet: docs/device-reference.md
- Milestone screenshots: docs/screenshots/

Current milestone: M1 (simulation engine and 2D debug view).

## Requirements

- Node 22 or newer
- A browser with WebGL2 (current Chrome, Edge, Firefox, Safari on macOS and iOS)

## Run

```sh
npm install
npm run dev
```

Open http://localhost:5173/.

Useful URL parameters during development:

- `?dev=sim` opens the 2D simulation debug view (add `&scene=hospital|warehouse|test-rssi|test-aoa|test-bilink|test-dock`, `&seed=1`, `&t=120` to fast-forward, `&scenario=h3-out&at=25`, `&select=tag-vent-02`, `&speed=0`)
- `?dev=brand` shows the brand tokens and device catalogue
- `?claims` opens the unapproved-claims overlay
- `?webgl=0` forces the no-WebGL2 fallback

## Check

```sh
npm run lint        # ESLint and Prettier
npm run typecheck   # TypeScript strict
npm test            # Vitest
npm run build       # production build plus initial JS budget check (400 KB gzip)
npm run e2e         # Playwright smoke tests (desktop and 360 px mobile)
```

Milestone screenshots:

```sh
SCREENSHOTS=1 SCREENSHOT_MILESTONE=m0 npx playwright test e2e/screenshots.spec.ts
```

## Research scripts

These need network access to sentrax.com. In a proxied environment, prefix the first one with `NODE_USE_ENV_PROXY=1`.

```sh
npm run refs:fetch     # product photos, PDFs and page text into reference/
npm run brand:extract  # Elementor kit colors, fonts, computed styles and header logo into reference/brand/
```

## Simulation engine (src/sim)

Plain TypeScript, no three.js or React, so it runs in Vitest, in the 2D debug view and later under the 3D scenes.

- Deterministic and seeded, fixed 10 Hz steps; `advance(seconds)` returns the interpolation factor for rendering.
- World data (zones, walls with RF materials, doors, nav graph, devices, tags, agents, rules) in src/sim/scenes.
- Positioning: RSSI (weighted trilateration), AoA (least-squares ray intersection), BiLink (anchor validation, relay, room assignment), hybrid fusion.
- Rule engine: zones, PAR, geofence, sensor thresholds, SOS, dock check-in and check-out, dwell, muster. Events on a typed bus.
- `PositionSource` interface: the UI reads reports through it, so a live SOLIX WebSocket feed can replace the simulator.
- Every parameter is in src/sim/config.ts and marked illustrative.

## Build output

`npm run build` writes a fully static site to dist/ with relative paths, so it can be served from any folder. No backend.

## Embedding (from M6)

- The demo never navigates the top-level window; every CTA opens in a new tab.
- It posts `ready`, `cta_click`, `story_complete` and `content_height` messages to the parent window, each tagged `source: 'sentrax-3d-demo'`.
- Set `VITE_EMBED_PARENT_ORIGIN` at build time to restrict messages to the host origin.

## Deploy

Not set up yet. The target (Hetzner VPS, GitHub Pages or another static host) will be chosen at M7.

## Project layout

```
src/
  analytics/   pluggable track(event, props), console by default
  app/         shell, WebGL2 check, fallback, CTA
  brand/       brand tokens extracted from sentrax.com, self-hosted fonts
  content/     every UI string and claim, with source and approval flag
  dev/         dev-only claims overlay, brand sheet and 2D simulation debug view
  sim/         simulation engine, scenes and engine tests
  embed/       postMessage bridge for iframe hosting
e2e/           Playwright smoke and screenshot specs
scripts/       bundle budget check, reference fetcher, brand extractor
reference/     downloaded product references (modelling only)
docs/          device reference sheet, screenshots
```
