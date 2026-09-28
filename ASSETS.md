# Assets

Every third-party model, texture, HDRI and font used in the demo is recorded here and shown in the in-app Credits panel (`src/content/credits.ts`, checked against this table by a unit test).

License policy (SPEC section 10):

- Prefer CC0. CC-BY is allowed with attribution.
- Never use NC, ND, editorial-only or unclear licenses.
- If no acceptable model exists, build it procedurally. If quality is still inadequate, list it under Purchase candidates and ask before buying.
- Sentrax product photos are used only as modelling reference and on product cards.

Sources (M1 review): textures and HDRIs come from Poly Haven only. Clean finishes Poly Haven does not offer (stainless steel, painted metal, equipment plastics, cardboard) are untextured PBR materials (color, metalness, roughness), which read correctly at dollhouse distance.

## Recorded assets

| Asset                                     | Source URL                                                       | Author                                | License               | Modifications                                                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------- | ------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Texture `vinyl`: Terrazzo Tiles           | https://polyhaven.com/a/terrazzo_tiles                           | Amal Kumar                            | CC0                   | Color map desaturated to 12 percent and brightened 35 percent; resized; encoded to KTX2 (ETC1S color and roughness, UASTC normal) |
| Texture `plaster`: Painted Plaster Wall   | https://polyhaven.com/a/painted_plaster_wall                     | Amal Kumar                            | CC0                   | Color map turned into an off-white paint (saturation 10 percent, variation halved, mean near sRGB 225); resized; encoded to KTX2  |
| Texture `bath-tiles`: Interior Tiles      | https://polyhaven.com/a/interior_tiles                           | Charlotte Baglioni                    | CC0                   | None; resized; encoded to KTX2 (ETC1S color and roughness, UASTC normal)                                                          |
| Texture `veneer`: Grey Oak Veneer 01      | https://polyhaven.com/a/grey_oak_veneer_01                       | Jenelle van Heerden                   | CC0                   | None; resized; encoded to KTX2 (ETC1S color and roughness, UASTC normal)                                                          |
| Texture `leather`: Fabric Leather 01      | https://polyhaven.com/a/fabric_leather_01                        | Rob Tuytel                            | CC0                   | Color map made a neutral light grey (grain kept) so vertex colours tint it; resized; encoded to KTX2                              |
| Texture `linen`: Cotton Jersey            | https://polyhaven.com/a/cotton_jersey                            | colormass, Rico Cilliers              | CC0                   | Color map desaturated to 12 percent and brightened 35 percent; resized; encoded to KTX2 (ETC1S color and roughness, UASTC normal) |
| HDRI: Hospital Room                       | https://polyhaven.com/a/hospital_room                            | Oliksiy Yakovlyev                     | CC0                   | None (1k HDR)                                                                                                                     |
| Texture `concrete`: Smooth Concrete Floor | https://polyhaven.com/a/smooth_concrete_floor                    | Dimitrios Savva                       | CC0                   | Color map made a light neutral grey (saturation 15 percent, mean near sRGB 180); resized; encoded to KTX2                         |
| Texture `asphalt`: Clean Asphalt          | https://polyhaven.com/a/clean_asphalt                            | Dimitrios Savva                       | CC0                   | None; resized; encoded to KTX2                                                                                                    |
| Texture `cladding`: Corrugated Iron 02    | https://polyhaven.com/a/corrugated_iron_02                       | Jenelle van Heerden, Sergej Majboroda | CC0                   | Color map desaturated to 12 percent and brightened 35 percent; resized; encoded to KTX2                                           |
| HDRI: Empty Warehouse 01                  | https://polyhaven.com/a/empty_warehouse_01                       | Sergej Majboroda                      | CC0                   | None (1k HDR)                                                                                                                     |
| Lato (400, 700, latin)                    | https://www.npmjs.com/package/@fontsource/lato (Google Fonts)    | Lukasz Dziedzic                       | SIL OFL 1.1           | Subset to latin by the package; self-hosted                                                                                       |
| Poppins (500, 600, latin)                 | https://www.npmjs.com/package/@fontsource/poppins (Google Fonts) | Indian Type Foundry                   | SIL OFL 1.1           | Subset to latin by the package; self-hosted                                                                                       |
| Basis Universal transcoder                | https://github.com/mrdoob/three.js (examples/jsm/libs/basis)     | Binomial LLC                          | Apache 2.0            | None; bundled from the three package by Vite                                                                                      |
| Sentrax logo                              | https://sentrax.com/wp-content/uploads/2023/10/sentrax_logo.png  | Sentrax GmbH                          | Client's own mark     | None (no device wordmark decals: illegible at true scale)                                                                         |
| Sentrax product photos                    | https://sentrax.com/ (product pages)                             | Sentrax GmbH                          | Client's own material | Resized to 360 px WebP for the device product cards; also modelling reference                                                     |

## Pipeline

`node scripts/assets.mjs` downloads the Poly Haven sources (cached in .asset-cache/, not committed), applies the modifications above, resizes and encodes KTX2 with `toktx` (KTX-Software 4.3), writes public/assets/ and src/scene/assets/manifest.json (paths, real-world texture size, credits). `node scripts/assets.mjs plaster` re-encodes one set and keeps the rest. The encoded files are committed, so CI and the build do not need `toktx`.

Encoding: colour and roughness maps ETC1S, normal maps UASTC with zstd and all three channels (three.js reads xyz). Images are stored bottom-up (`--lower_left_maps_to_s0t0`) because compressed textures cannot be flipped at upload.

Texture sizes per quality tier (high / low): floor vinyl 2048 / 1024; everything else 1024 / 512.

Payload measured at the M2 checkpoint (textures, gzipped HDRI, gzipped scene JavaScript and Basis transcoder): 12.0 MB on high, 4.2 MB on low (budgets 20 MB and 8 MB). Initial JavaScript: 70 KB gzip (budget 400 KB).

## Warehouse (M4)

Used: the concrete floor, asphalt yard, corrugated cladding and warehouse HDRI above. Racking, pallets, cartons,
vehicles and dock equipment are procedural with untextured PBR materials (the pallet wood uses the `veneer` set).
Payload per scene and tier is checked on every build (scripts/check-payload.mjs): hospital 12.0 MB high and 4.5 MB
low, warehouse 14.0 MB high and 5.3 MB low (budgets 20 MB and 8 MB).

## Models

Default approach: procedural geometry in code (parametric, instanced), because it keeps payload small, has no license risk and allows exact dimensions.

| Model group                                                                                                                        | Approach                                                                                           | License |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------- |
| Walls, floors, doors, bathroom pods, racking, docks                                                                                | Procedural from the world data                                                                     | Own     |
| Hospital furniture and equipment (bed, monitors, IV pole, pump, ventilator, wheelchair, crash cart, chairs, desk, shelves, fridge) | Procedural, instanced                                                                              | Own     |
| Warehouse vehicles and equipment (forklift, truck, trailer, yard tractor, pallets, WIP carriers, stations)                         | Procedural, instanced (M4)                                                                         | Own     |
| People                                                                                                                             | Procedural faceless mannequins with procedural walk, idle and push animation, one Character system | Own     |
| Sentrax devices (all nine)                                                                                                         | Procedural, true to scale from the datasheets, materials matched to the product photos             | Own     |
| Device billboard icons (canvas-drawn at runtime), SOLIX node, integration cards                                                    | Own code, SVG and HTML                                                                             | Own     |

Mixamo is avoided: its terms restrict redistributing the raw files.

## Purchase candidates

None. Watch list if procedural quality is not good enough at the M2 and M4 checkpoints: ventilator, wheelchair, forklift, truck and trailer.
