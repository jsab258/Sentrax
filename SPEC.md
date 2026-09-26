SENTRAX INTERACTIVE 3D RTLS DEMO: BUILD SPEC AND INSTRUCTIONS

0. YOUR ROLE AND HOW TO WORK
- You are building a standalone interactive 3D web demo for Sentrax GmbH (sentrax.com), a Swiss company selling BLE real-time location systems (RTLS): tags, anchors, locators/gateways and the SOLIX software platform.
- The demo explains visually how the system works and why it matters. It is a prototype: not integrated into the WordPress site yet, but it must be built so it can later be embedded via iframe as a homepage teaser and as a full /demo page.
- Create a new repo "sentrax-3d-demo". Save this entire spec verbatim as SPEC.md in the repo root. It is the source of truth.
- Before writing code, read the pages listed in section 2, then post a short plan plus only the questions that block you. For non-blocking choices, decide sensibly and log them in DECISIONS.md with a one-line reason.
- If a decision changes scope, priority or anything in this spec, tell me plainly in your status message. Do not only log it.
- Work milestone by milestone (section 12). After each milestone: run lint, typecheck, tests and build, commit, and post a short status with screenshots captured via Playwright. At each CHECKPOINT, stop and wait for my go-ahead.
- Never invent product specifications, customer names, deployments or results. If information is missing, use a clearly marked placeholder in the content files.
- No em-dashes and no italic text in any UI copy or documentation you write.

1. GOAL, AUDIENCE, CONVERSION
- Audiences: (a) prospective end customers: hospital medical technology and technical services leads; warehouse, logistics and manufacturing operations leads. (b) Partners and system integrators who resell or integrate Sentrax.
- Tell every story from the customer's operational problem. The partner angle lives in the Data layer (APIs, integration targets) and in the device product cards.
- Single conversion goal: "Book a meeting", opening in a new tab:
  https://outlook.office365.com/owa/calendar/MeetupwithSentrax@sentrax.com/bookings/s/FxdD_oVcP0iFwXRGfHzGfQ2
- Language: English only. All UI strings live in content files, ready for later translation.

2. GROUND TRUTH: WHAT SENTRAX SELLS
Read these pages yourself for detail, wording and product images:
- https://sentrax.com/
- https://sentrax.com/technology/
- https://sentrax.com/solutions/bilink-tracking/
- https://sentrax.com/solutions/proximity-track/
- https://sentrax.com/solutions/aoa-rtls/
- https://sentrax.com/solutions/hybrid-tracking/
- https://sentrax.com/applications/healthcare/
- https://sentrax.com/applications/manufacturing/
- https://sentrax.com/product/solix/
- https://sentrax.com/documents/ (datasheets, if publicly accessible)
- https://sentrax.com/docs/brochures/BiLink-Proximity-Tracking-Brochure.pdf
Summary:
- Hardware families: NODIX (BiLink relay anchor), PINIX (tags and beacons), ZENIX (locators and gateways). Software: SOLIX RTLS and IoT platform with APIs, SDM device manager.
- BLE RSSI: position estimated from signal strength at multiple gateways; 3 to 5 m; low infrastructure cost; minimal calibration.
- BLE AoA: multi-antenna locators measure the angle of arrival; triangulation from several locators; sub-meter; needs planned layout and calibration.
- BiLink: battery-powered NODIX CEN-1 anchors in each room scan tags and also broadcast (bidirectional). They filter and validate at the anchor, and relay only verified events to a gateway, then into SOLIX. Result: room-level visibility, no hallway bleed, fewer gateways, no cabling to each room. Tagline on site: "Track More, Install Less". BiLink can complement AoA in hybrid deployments.
- Hybrid: AoA in critical hotspots, RSSI or BiLink in transitional areas.
- SOLIX: positioning engine, rule engine (geofencing, alerts, automation), sensor service, device manager, REST and WebSocket APIs to ERP, MES, WMS, BMS and hospital systems. On-premise or cloud.
- Environmental sensing: temperature, humidity, air quality, motion/vibration, pressure (ZENIX LEN-2 gateway, PINIX TOW-5 multi-sensor tag).

3. CONTENT AND CLAIMS POLICY (STRICT)
- All copy, labels and numbers live in /src/content/*.ts. Each claim has fields: text, sourceUrl, approved (boolean). A dev-only overlay lists every unapproved item.
- Allowed technical figures: RSSI "3 to 5 m"; AoA "sub-meter"; BiLink "room-level" (no meter figure).
- Search-time claim, approved: false: "Clinical staff can spend 30 to 60 minutes per shift searching for equipment." Source: healthcare page.
- No percentage savings, prices or business impact percentages anywhere.
- The BiLink infrastructure comparison shows counts computed live from the scene (gateways, powered devices, cable runs), never percentages.
- No customer names, partner names, deployment references or results. Integration targets are generic: "Alarm and nurse-call platform", "Hospital information system / CMMS", "WMS / ERP", "MES".
- The dashboard and all data carry a visible "Simulated data" label.
- People are anonymous. No patient tracking stories.

4. EXPERIENCE STRUCTURE (ONE ENGINE, THREE MODES)
- Guided mode (default):
  - Scene switcher: "Hospital" and "Warehouse and Manufacturing". Each scene has a story list.
  - A story is a sequence of steps. Each step defines: camera target and move, narration card (title plus 1 to 2 sentences), layer states, lens state and simulation events.
  - Controls: next, back, autoplay, skip.
  - End card: one takeaway sentence, "Book a meeting", "Explore freely" (switches to sandbox in the same scene).
- Sandbox mode:
  - Constrained orbit, pan and zoom, plus camera presets per zone.
  - Layer toggles and technology lens.
  - Drag any tagged asset or person.
  - Click any device for its product card.
  - Event trigger panel, time controls (pause, 1x, 4x, reset) and dwell heatmap.
- Teaser mode (?mode=teaser), for the later homepage embed:
  - Autoplay loop of short versions of H1 and W1, minimal UI.
  - Two buttons: "Explore the interactive demo" and "Book a meeting".
  - No scroll hijacking, no sound.
- No first-person controls.
- Deep links: URL params for mode, scene, story, step, layers and lens. Keep the URL in sync via replaceState.

5. THE FOUR LAYERS
1. Physical: building, furniture, equipment, people, vehicles.
   - Dollhouse cutaway view: ceilings removed, and walls facing the camera fade or cut down automatically based on view direction.
2. Radio: subtle BLE advertising pulses from tags, plus technology-specific visuals, color-coded per technology from the brand palette:
   - RSSI: range rings, trilateration circles and an uncertainty disk.
   - AoA: rays from locators to the tag, converging on an estimate dot.
   - BiLink: room volume glow on detection, plus a relay arc from the anchor to the gateway.
3. Data: packets travel from gateway to a SOLIX node (server rack for on-prem, or a cloud icon) to integration target cards.
   - Protocol labels: REST, WebSocket.
   - Place the SOLIX node and the targets on a clean "network plane" beside or above the building.
4. Insight: mock SOLIX dashboard, as a right-side panel on desktop and a bottom sheet on mobile.
   - Asset list with search, current room or zone, and last-seen time.
   - Alerts feed with acknowledge.
   - KPIs.
   - Mini floor map.
   - In-scene labels (asset name plus room) and an optional dwell heatmap on the floor.
   - Match the look of SOLIX screenshots on the site loosely, in brand style.

6. SIMULATION ENGINE (CORE, MUST BE HONEST)
Loop:
- Deterministic and seeded. Fixed-timestep simulation at 10 Hz; rendering interpolates between steps.
World schema (data, not code):
- Zones and rooms as polygons with id and name.
- Walls with RF attenuation values, doors, and a navigation graph for agents.
- Devices with type, model, position, orientation and range.
Agents:
- People and assets carrying tags.
- They follow waypoint routes along the nav graph with dwell times. Forklifts carry pallets; people push carts and move equipment.
Ground truth versus reported position:
- The engine knows each tag's true position. Each technology produces its own reported estimate:
  - RSSI: log-distance path loss plus wall attenuation plus Gaussian noise. Weighted estimate from the gateways in range, with an uncertainty radius. Tune so typical error is 3 to 5 m.
  - AoA: azimuth and elevation from each locator with angular noise of about 2 to 5 degrees. Least-squares intersection from 2 or more locators. Tune to a sub-meter median error inside AoA coverage.
  - BiLink:
    - Each room anchor keeps a filtered RSSI (moving average) per tag.
    - A tag is assigned to a room when the filtered value is above threshold and stronger than neighboring anchors, with hysteresis and a minimum dwell time so there is no flicker and no corridor bleed.
    - The anchor relays the event to the nearest gateway with a short latency.
    - The reported value is a room id, not coordinates.
  - Hybrid: AoA where covered, otherwise BiLink or RSSI.
Rule engine:
- Zone enter and exit, geofence violation, PAR level per zone and asset class, sensor thresholds, SOS button.
- Automatic check-in and check-out when crossing a zone boundary, and dwell-time thresholds.
Event bus:
- Consumed by the dashboard, narration, integration cards and analytics.
Interfaces and parameters:
- Keep reported positions behind an interface (PositionSource) so a live SOLIX WebSocket feed can replace the simulator later.
- All parameters live in one config file, commented as illustrative, not product specifications.
Tests (Vitest):
- RSSI error distribution falls in the expected band.
- AoA median error is below 1 m inside coverage.
- BiLink assigns the correct room in at least 95 percent of steady-state samples in a test layout, and never changes room faster than the minimum dwell.
- PAR alerts fire and clear correctly.
- Dock-door check-out fires exactly once per crossing.

7. HOSPITAL SCENE
Layout: one ward floor, roughly 40 x 25 m.
- Corridor spine.
- Patient rooms 101 to 106: bed, bedside monitor, IV pole, chair, bathroom pod.
- ICU with 2 bed bays: ventilators, monitors, infusion pumps.
- Clean utility and equipment storage: parked pumps and wheelchairs.
- Dirty utility and nurse station.
- Medication room with a medication/vaccine fridge.
- Elevator lobby at the ward exit, used as a geofence edge.
Devices:
- NODIX CEN-1 in every room, the ICU, storage, the utility rooms and the medication room.
- 2 ZENIX LEN-1 gateways in the corridor, receiving BiLink relays.
- ZENIX LEN-2 in the medication room for environmental sensing.
- PINIX TOW-5 on the fridge.
- ZENIX LON-2 AoA locators over the ICU, for the hybrid bed-bay-level demonstration.
Tags:
- PINIX TOW-1 on 8 infusion pumps, 3 ventilators, 3 wheelchairs, 1 crash cart and mobile monitors.
- PINIX TOK-1 staff badges.
- 1 PINIX TOB-1 wearable with SOS button.
Agents: 3 nurses, 1 BioMed technician, 1 porter. Patients are static figures in beds and are not tracked.

H1 Find the infusion pump (lead story, 60 to 90 s):
1. A nurse at the station needs an infusion pump and storage is empty. A "Without RTLS" stopwatch runs while the nurse checks rooms, sped up. Show the flagged search-time claim.
2. "With Sentrax": the nurse searches on the dashboard. Result: "Infusion pump P-07: Room 104, last seen 12 s ago". The camera flies to room 104, the pump is highlighted and the room anchor glows.
3. The Radio and Data layers reveal why: the pump tag advertises, the room anchor detects and validates, relays to the corridor gateway, and SOLIX assigns room 104.
4. End card with takeaway and CTA.

H2 How BiLink works:
1. A tag advertises.
2. The room anchor scans and also broadcasts (bidirectional).
3. Filtering at the anchor: a tag in the corridor just outside is rejected, a tag inside is accepted.
4. The anchor relays to the gateway, then SOLIX, then the room assignment appears in the dashboard.
5. The tag moves room to room with clean handovers.
6. Toggle "Conventional" versus "BiLink":
   - Conventional: a powered gateway in every room with cable runs back to the network closet.
   - BiLink: battery anchors per room plus a few gateways.
   - Live counters for gateways, powered devices and cable runs, computed from the scene.

H3 ICU readiness (PAR level, illustrative thresholds 3 ventilators and 6 pumps):
1. The porter moves a ventilator from the ICU to room 102. The ICU drops below PAR.
2. Alert "ICU below PAR: ventilators 2 of 3", shown on the dashboard and the CMMS integration card.
3. The dashboard shows the nearest available ventilator. The BioMed technician returns one and the alert clears.

H4 Cold chain in the medication room:
1. A live temperature chart for the fridge.
2. The door is left open, the temperature crosses the threshold, and an alert fires with location and duration, logged for audit.
3. A nurse closes the door, the temperature recovers, and the alert closes with an audit trail.

H5 Staff call for help (short):
1. A nurse presses SOS on the wearable in room 105.
2. An alert with the room location goes to the "Alarm and nurse-call platform" card, and a colleague is routed there.

8. WAREHOUSE AND MANUFACTURING SCENE
Layout: hall of roughly 80 x 50 m plus an outdoor yard.
- Receiving area with 3 dock doors and trucks.
- High-bay racking: 4 aisles, 5 levels, labeled bays.
- Picking and staging area.
- Production area: 3 assembly stations and a line-side buffer.
- Cold storage room.
- Restricted zone: battery charging cage.
- Marked forklift lanes, office, and an outdoor muster point.
- Yard with trailers and a yard tractor.
Devices:
- ZENIX LON-2 AoA locators on a ceiling grid over the racking and production.
- ZENIX LEN-2 gateways for general coverage and climate.
- NODIX CEN-1 at each dock door and at the cold room entrance, for zone check-in and check-out.
- ZENIX LEF-3 outdoor gateway on a yard pole.
Tags:
- PINIX TOW-1 on pallets, WIP carriers and forklifts.
- PINIX TOW-5 on cold pallets.
- PINIX TOB-1 on workers.
Agents: 3 forklifts with drivers, 4 pickers, 2 assembly workers, 1 yard tractor.

W1 Find the pallet (rack level):
1. Pallet PL-2291 is needed. A short "without RTLS" walk through the aisles.
2. Dashboard search shows "Aisle C, bay 14, level 4". AoA rays converge from the ceiling locators, and a 3D marker shows the exact rack slot with the level highlighted.
3. A forklift is dispatched, picks the pallet, and its movement is tracked.

W2 Dock door check-out and yard visibility:
1. The pallet crosses the dock door 2 zone and triggers an automatic check-out event with timestamp. The WMS/ERP card updates.
2. The loaded trailer moves to the yard. Coverage hands over from indoor to the outdoor LEF-3 and the trailer stays visible.

W3 WIP flow and bottleneck:
1. Carriers move through stations 1 to 3, with dwell times shown.
2. Station 2 dwell exceeds its threshold: bottleneck highlight, heatmap, and WIP count per station on the dashboard and MES card.

W4 Restricted zone and evacuation:
1. A worker enters the battery charging cage without authorization. A zone violation alert shows who, where and how long.
2. Evacuation drill: the muster count updates live as badges reach the muster point, and the last missing person is located on the map.

W5 Cold storage transfer:
1. A cold pallet is unloaded from a truck. TOW-5 temperature is tracked during transfer.
2. If its dwell outside the cold room exceeds the threshold, an excursion alert fires with location and duration.

9. SENTRAX DEVICES: RECONSTRUCT FROM PRODUCT IMAGES
Process for each device:
- Open its product page and download the product images to /reference/devices/<model>/.
- Read dimensions from the specs or datasheets where publicly available.
- Build an accurate model procedurally, or as glTF generated by script, with PBR materials matching the photos.
- Place the Sentrax logo only where it appears on the real device.
Devices:
- NODIX CEN-1, BiLink relay anchor, battery. https://sentrax.com/product/nodix-cen-1/
- ZENIX LEN-1, RSSI gateway, PoE and WiFi. https://sentrax.com/product/zenix-len-1/
- ZENIX LEN-2, RSSI gateway with climatic sensors. https://sentrax.com/product/zenix-len-2/
- ZENIX LON-2, AoA locator. https://sentrax.com/product/zenix-lon-2/
- ZENIX LEF-3, outdoor RSSI gateway with LTE and GPS. https://sentrax.com/product/zenix-lef-3/
- PINIX TOW-1, hybrid asset tag. https://sentrax.com/product/pinix-tow-1/
- PINIX TOW-5, AoA multi-sensor asset tag. https://sentrax.com/product/pinix-tow-5/
- PINIX TOK-1, smart badge. https://sentrax.com/product/pinix-tok-1/
- PINIX TOB-1, wearable with SOS button. https://sentrax.com/product/pinix-tob-1/
Scale and visibility:
- Devices stay true to scale.
- Because they are tiny in a dollhouse view, show a clean billboard icon marker at distance that hands over to the real model when zoomed in.
Product card on click:
- Product image, model name, one-line description from the site, its role in this scene, and a "View product" link to the product page (new tab).
- Use Sentrax product photos only for modeling reference and product cards. Use no other imagery from the site.

10. VISUAL DIRECTION: REALISTIC
Rendering:
- PBR throughout, HDRI environment lighting, AgX or ACES tone mapping, correct color space.
- Soft shadows with a limited set of casters, SSAO.
- Bloom only on Radio, Data and Insight effects.
- If real-time lighting does not look convincing, propose a lightmap baking pipeline (for example Blender CLI) at the M2 checkpoint. Do not add it silently.
Materials:
- CC0 textures from ambientCG or Poly Haven: hospital vinyl flooring, painted walls, stainless steel, sealed concrete, painted steel racking, and so on.
Model licensing:
- Prefer CC0 (for example Poly Haven). CC-BY is allowed with attribution. Never use NC, ND, editorial-only or unclear licenses.
- Record every asset in ASSETS.md (source URL, author, license, modifications) and show credits in an in-app Credits panel.
- If no acceptable model exists, build it procedurally. If quality is still inadequate, list it under "Purchase candidates" in ASSETS.md and ask me.
People:
- Realistic proportions but faceless, mannequin-style figures, as in architectural visualization.
- Realistic clothing colors by role: scrub colors per hospital role, hi-vis vests in the warehouse.
- Simple walk, idle and push animations. No photoreal faces.
- Everything goes through one Character component so the figures can be swapped later.
Brand:
- Extract the current brand colors, fonts and logo from sentrax.com: the Elementor global kit CSS, computed styles on the homepage, and the header logo.
- Save them as /src/brand/brand.ts and document the sources in BRAND.md. Do not change them.
- UI panels, cards and buttons use the brand fonts and colors.
- The 3D world uses realistic colors. Reserve brand colors for the Radio, Data and Insight overlays so the technology stands out.
- Keep the UI minimal and professional.

11. TECHNICAL REQUIREMENTS
Stack:
- Vite, React, TypeScript strict, React Three Fiber, drei, @react-three/postprocessing, zustand.
- Vitest, Playwright, ESLint, Prettier.
- gltf-transform for asset optimization (meshopt geometry, KTX2 textures).
CI:
- GitHub Actions running lint, typecheck, test and build on every push. No deployment in CI until I choose a target.
Quality tiers:
- High, medium and low, auto-detected with a manual override.
- The low tier disables SSAO and most shadows and reduces agents and effects.
Budgets:
- High tier: 60 fps on an Apple M1 class laptop.
- Low tier: 30 fps or better on a mid-range phone such as iPhone 12 or Pixel 6.
- Initial JS 400 KB gzip or less.
- Scene payload 20 MB or less (compressed) on high and 8 MB or less on low.
- Under 300 draw calls on high.
- Use instancing for racks, pallets and repeated furniture, and LODs where useful.
Loading:
- Per-scene lazy loading with a progress indicator and a poster image. Interactive within about 4 s on desktop broadband.
Iframe readiness:
- Works at any width of 360 px or more.
- No top-level navigation; CTAs open in a new tab.
- postMessage events: ready, cta_click, story_complete, content_height.
Accessibility:
- Keyboard navigation for guided mode, visible focus states, sufficient contrast.
- prefers-reduced-motion: cut camera flights and disable pulses.
- Narration available as text.
Analytics:
- A pluggable track(event, props) interface with a console default. No third-party scripts, no cookies.
- Events: scene_opened, story_started, story_step, story_completed, sandbox_opened, device_inspected, lens_changed, cta_clicked.
Browsers:
- Current Chrome, Edge, Firefox, and Safari on macOS and iOS. WebGL2 required.
- Without WebGL2, show a fallback with poster, short text and CTA.
Output:
- Static build only, no backend.

12. MILESTONES
M0 Setup and research:
- Repo scaffold, CI, SPEC.md.
- BRAND.md and brand.ts.
- Device reference images and a device reference sheet.
- ASSETS.md asset plan: every model and texture needed, with candidate source and license.
- DECISIONS.md.
- CHECKPOINT: post the palette, fonts, device reference sheet, asset plan and blocking questions.
M1 Engine:
- World schema, simulation loop, agents, positioning models, rule engine, event bus, tests.
- A 2D top-down debug view (canvas) to verify the simulation without 3D.
- CHECKPOINT: 2D debug screenshots or GIF plus test results.
M2 Hospital world:
- Geometry, materials, lighting, devices, people, cutaway camera, quality tiers.
- CHECKPOINT: screenshots on high and low tiers plus measured fps.
M3 Hospital experience:
- All four layers, dashboard, integration cards.
- Stories H1 to H5, end cards, CTA, deep links.
- CHECKPOINT.
M4 Warehouse and manufacturing world plus stories W1 to W5:
- CHECKPOINT.
M5 Sandbox features across both scenes:
- Drag, lens, triggers, time controls, heatmap, device cards, camera presets.
M6 Polish:
- Teaser mode, iframe hooks, accessibility, analytics hooks, Credits panel.
- Performance pass and Playwright smoke tests for every story.
- CHECKPOINT: full review.
M7 Deploy:
- Ask me for the target first (options include my Hetzner VPS, GitHub Pages or a static host), then add the deploy workflow.

13. OUT OF SCOPE FOR NOW
- WordPress integration, live SOLIX data, German, configurator or quote tool, first-person mode, real customer data.

14. DELIVERABLES
- Repo with source and tests.
- SPEC.md, DECISIONS.md, ASSETS.md, BRAND.md.
- README with run, build and deploy instructions.
- Screenshots per milestone in /docs/screenshots.
