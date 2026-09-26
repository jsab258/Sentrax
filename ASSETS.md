# Assets

Every third-party model, texture, HDRI and font used in the demo is recorded here and shown in the in-app Credits panel (M6).

License policy (SPEC section 10):

- Prefer CC0. CC-BY is allowed with attribution.
- Never use NC, ND, editorial-only or unclear licenses.
- If no acceptable model exists, build it procedurally. If quality is still inadequate, list it under Purchase candidates and ask before buying.
- Sentrax product photos are used only as modelling reference and on product cards.

## Status at M0

Nothing has been downloaded yet. This is the plan.

Source reachability from the build environment:

| Source                                         | Reachable | Notes                                                                                  |
| ---------------------------------------------- | --------- | -------------------------------------------------------------------------------------- |
| sentrax.com                                    | No        | Blocked by network policy. Needed for product photos, datasheets, brand, logo.         |
| polyhaven.com, dl.polyhaven.org, api.polyhaven | No        | Blocked. Needed for CC0 textures and models.                                           |
| ambientcg.com and its download CDN             | No        | Blocked. Needed for CC0 textures.                                                      |
| raw.githubusercontent.com (pmndrs/drei-assets) | Yes       | Mirrors a set of Poly Haven HDRIs (CC0, credited to HDRI Haven in that repo's README). |
| registry.npmjs.org                             | Yes       | Fonts via @fontsource packages once the brand fonts are known.                         |
| fonts.googleapis.com                           | Yes       | Only used to look up font files at build time if needed; never loaded by the app.      |

## Recorded assets

| Asset    | Source URL | Author | License | Modifications |
| -------- | ---------- | ------ | ------- | ------------- |
| none yet |            |        |         |               |

## Plan: environment lighting

| Need                             | Candidate                                                      | License | Status                                                            |
| -------------------------------- | -------------------------------------------------------------- | ------- | ----------------------------------------------------------------- |
| Neutral interior HDRI (hospital) | Poly Haven studio_small_03 (1k, via pmndrs/drei-assets mirror) | CC0     | Reachable, verified to download. Select at M2.                    |
| Interior HDRI alternative        | Poly Haven st_fagans_interior (1k, via mirror)                 | CC0     | Reachable, verified to download.                                  |
| Industrial HDRI (warehouse)      | Poly Haven empty_warehouse_01 (1k, via mirror)                 | CC0     | Reachable, verified to download.                                  |
| Outdoor yard HDRI                | Poly Haven, overcast outdoor HDRI (specific asset to select)   | CC0     | Needs polyhaven.com access, or a mirror file from the list above. |

## Plan: textures (PBR sets: base color, normal, roughness, optional AO)

Specific asset ids are chosen at M2 when the sources are reachable. All sets are downsized to 1k or 2k and converted to KTX2.

| Material                              | Scene     | Candidate source                          | License | Fallback                            |
| ------------------------------------- | --------- | ----------------------------------------- | ------- | ----------------------------------- |
| Hospital vinyl flooring               | Hospital  | ambientCG (vinyl or linoleum floor sets)  | CC0     | Procedural shader (speckle noise)   |
| Painted plaster walls                 | Hospital  | ambientCG or Poly Haven (painted plaster) | CC0     | Procedural (flat paint, fine noise) |
| Ceramic tiles (bathroom pods)         | Hospital  | ambientCG (tiles)                         | CC0     | Procedural grid                     |
| Stainless steel (brushed)             | Both      | ambientCG (metal, brushed)                | CC0     | Procedural anisotropic noise        |
| Laminate or wood (nurse station)      | Hospital  | Poly Haven or ambientCG (wood, laminate)  | CC0     | Procedural                          |
| Upholstery fabric (chairs)            | Hospital  | ambientCG (fabric)                        | CC0     | Flat PBR color                      |
| Sealed concrete floor                 | Warehouse | ambientCG or Poly Haven (concrete floor)  | CC0     | Procedural noise                    |
| Painted steel (racking)               | Warehouse | ambientCG (painted metal)                 | CC0     | Flat PBR color                      |
| Pallet wood                           | Warehouse | Poly Haven or ambientCG (rough wood)      | CC0     | Procedural                          |
| Cardboard (boxes)                     | Warehouse | ambientCG (cardboard)                     | CC0     | Flat PBR color                      |
| Floor marking paint                   | Warehouse | Decals drawn in code                      | Own     | n/a                                 |
| Asphalt (yard)                        | Warehouse | ambientCG or Poly Haven (asphalt)         | CC0     | Procedural noise                    |
| Corrugated metal (trailers, cladding) | Warehouse | ambientCG (corrugated steel)              | CC0     | Procedural normal map               |

## Plan: models

Default approach: procedural geometry in code (parametric, instanced), because it keeps payload small, has no license risk and allows exact dimensions. CC0 models are used where they clearly look better.

### Hospital

| Model                             | Approach                            | Candidate                                     | License                              |
| --------------------------------- | ----------------------------------- | --------------------------------------------- | ------------------------------------ |
| Walls, doors, bathroom pods       | Procedural from world schema        | Own                                           | Own                                  |
| Hospital bed                      | Procedural (frame, mattress, rails) | Poly Haven or Sketchfab search as alternative | Own, or CC0/CC-BY verified per model |
| Bedside monitor, mobile monitor   | Procedural                          | Own                                           | Own                                  |
| IV pole                           | Procedural                          | Own                                           | Own                                  |
| Infusion pump                     | Procedural                          | Own                                           | Own                                  |
| Ventilator                        | Procedural                          | Sketchfab CC-BY search as alternative         | Own, or CC-BY verified               |
| Wheelchair                        | Procedural                          | Sketchfab CC-BY search as alternative         | Own, or CC-BY verified               |
| Crash cart                        | Procedural                          | Own                                           | Own                                  |
| Chairs, nurse station desk        | Procedural or Poly Haven furniture  | Poly Haven furniture category                 | CC0                                  |
| Medication fridge                 | Procedural                          | Own                                           | Own                                  |
| Elevator doors                    | Procedural                          | Own                                           | Own                                  |
| Patient figures (static, in beds) | Character component, lying pose     | Own                                           | Own                                  |

### Warehouse and manufacturing

| Model                                   | Approach                           | Candidate                             | License                |
| --------------------------------------- | ---------------------------------- | ------------------------------------- | ---------------------- |
| Hall shell, dock doors, cage, cold room | Procedural from world schema       | Own                                   | Own                    |
| High-bay racking (4 aisles, 5 levels)   | Procedural, instanced              | Own                                   | Own                    |
| Pallets and loads                       | Procedural, instanced              | Own                                   | Own                    |
| Assembly stations, line-side buffer     | Procedural                         | Own                                   | Own                    |
| WIP carriers                            | Procedural                         | Own                                   | Own                    |
| Forklift                                | Procedural                         | Sketchfab CC-BY search as alternative | Own, or CC-BY verified |
| Truck and trailers                      | Procedural                         | Sketchfab CC-BY search as alternative | Own, or CC-BY verified |
| Yard tractor                            | Procedural                         | Sketchfab CC-BY search as alternative | Own, or CC-BY verified |
| Office furniture                        | Poly Haven furniture or procedural | Poly Haven furniture category         | CC0                    |
| Yard pole, muster point sign            | Procedural                         | Own                                   | Own                    |

### People

| Need                                              | Approach                                                                                  | License                   |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------- |
| Faceless mannequin figures, realistic proportions | Procedural segmented mannequin with a code-built skeleton, behind one Character component | Own                       |
| Alternative base mesh                             | MakeHuman export (exported models are CC0), head smoothed to mannequin style              | CC0 (verify at selection) |
| Walk, idle, push animations                       | Procedural (bone rotations driven by gait phase)                                          | Own                       |
| Clothing colors                                   | Scrub colors per hospital role, hi-vis vests in the warehouse                             | Own                       |

Mixamo is avoided: its terms restrict redistributing the raw files, which is unclear for a repository and a public static build.

### Sentrax devices

All nine devices are modelled procedurally (or glTF generated by script) from the product photos and datasheets. Blocked until sentrax.com is reachable. See docs/device-reference.md.

### UI and overlays

| Need                                 | Approach                                                                                 | License  |
| ------------------------------------ | ---------------------------------------------------------------------------------------- | -------- |
| Device billboard icons               | Own SVG icons                                                                            | Own      |
| SOLIX node (server rack, cloud icon) | Procedural rack, own SVG cloud icon                                                      | Own      |
| Integration target cards             | HTML/CSS in brand style                                                                  | Own      |
| Brand fonts                          | Self-hosted, from @fontsource or the files the site serves, after checking their license | Per font |
| Sentrax logo                         | From the sentrax.com header, used as the client's own mark                               | Sentrax  |

## Optimization pipeline

- gltf-transform for glTF: meshopt geometry compression, KTX2 textures (ETC1S for color, UASTC for normals).
- KTX2 encoding needs the KTX-Software `toktx` binary. Plan: run the pipeline locally or in a dedicated script and commit the optimized files, so CI does not need `toktx`. Decision to confirm at M2.
- Budgets: 20 MB or less (compressed) per scene on high, 8 MB or less on low.

## Purchase candidates

None yet. Watch list if procedural quality is not good enough at the M2 and M4 checkpoints: ventilator, wheelchair, forklift, truck and trailer.
