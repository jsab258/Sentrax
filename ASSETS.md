# Assets

Every third-party model, texture, HDRI and font used in the demo is recorded here and shown in the in-app Credits panel (M6).

License policy (SPEC section 10):

- Prefer CC0. CC-BY is allowed with attribution.
- Never use NC, ND, editorial-only or unclear licenses.
- If no acceptable model exists, build it procedurally. If quality is still inadequate, list it under Purchase candidates and ask before buying.
- Sentrax product photos are used only as modelling reference and on product cards.

## Status at M1

Nothing is bundled in the app yet except the brand fonts (below). Candidates are listed with real asset ids from the source APIs; final picks are made visually at M2.

Source reachability from the build environment (checked 2026-09-26):

| Source                                         | Reachable | Notes                                                                                    |
| ---------------------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| sentrax.com                                    | Yes       | Product photos, datasheets, brand and logo downloaded (reference/).                      |
| polyhaven.com, api.polyhaven.com               | Yes       | API listing works.                                                                       |
| dl.polyhaven.org                               | Yes       | Test download of a texture file succeeded.                                               |
| ambientcg.com (site and API)                   | Yes       | API search works.                                                                        |
| acg-download.struffelproductions.com           | No        | ambientCG redirects every download here; blocked by the proxy (403). Needs allowlisting. |
| raw.githubusercontent.com (pmndrs/drei-assets) | Yes       | Mirror of a few Poly Haven HDRIs; no longer needed now that Poly Haven is reachable.     |
| registry.npmjs.org                             | Yes       | Fonts via @fontsource.                                                                   |

## Recorded assets

| Asset                     | Source URL                                                       | Author              | License           | Modifications                               |
| ------------------------- | ---------------------------------------------------------------- | ------------------- | ----------------- | ------------------------------------------- |
| Lato (400, 700, latin)    | https://www.npmjs.com/package/@fontsource/lato (Google Fonts)    | Lukasz Dziedzic     | SIL OFL 1.1       | Subset to latin by the package; self-hosted |
| Poppins (500, 600, latin) | https://www.npmjs.com/package/@fontsource/poppins (Google Fonts) | Indian Type Foundry | SIL OFL 1.1       | Subset to latin by the package; self-hosted |
| Sentrax logo              | https://sentrax.com/wp-content/uploads/2023/10/sentrax_logo.png  | Sentrax GmbH        | Client's own mark | None                                        |

## Plan: environment lighting

Download directly from Poly Haven (CC0), 1k or 2k HDR, then self-host.

| Need                             | Candidates (Poly Haven ids)                               | License |
| -------------------------------- | --------------------------------------------------------- | ------- |
| Neutral interior HDRI (hospital) | studio_small_03, brown_photostudio_02, st_fagans_interior | CC0     |
| Industrial HDRI (warehouse)      | empty_warehouse_01, abandoned_factory_canteen_01          | CC0     |
| Outdoor yard HDRI                | an overcast outdoor HDRI, for example belfast_open_field  | CC0     |

## Plan: textures (PBR sets: base color, normal, roughness, optional AO)

Real CC0 PBR textures are required for M2. Code-generated textures are temporary placeholders only. Candidate ids come from the ambientCG and Poly Haven APIs; the pick is made visually at M2. All sets are downsized to 1k or 2k and converted to KTX2.

| Material                              | Scene     | Candidates                                                                  | License |
| ------------------------------------- | --------- | --------------------------------------------------------------------------- | ------- |
| Hospital floor (sheet vinyl look)     | Hospital  | ambientCG Terrazzo005, Terrazzo013, Rubber004; Poly Haven grey_tiles        | CC0     |
| Painted plaster walls                 | Hospital  | ambientCG PaintedPlaster017, PaintedPlaster016; Poly Haven white_plaster_02 | CC0     |
| Ceramic tiles (bathroom pods)         | Hospital  | ambientCG Tiles074, Tiles078; Poly Haven floor_tiles_06                     | CC0     |
| Stainless steel (brushed)             | Both      | ambientCG Metal009, Metal011, Metal012                                      | CC0     |
| Laminate or wood (nurse station)      | Hospital  | Poly Haven laminate_floor_02; ambientCG WoodFloor043                        | CC0     |
| Plastic (equipment housings)          | Both      | ambientCG Plastic010, Plastic006                                            | CC0     |
| Upholstery fabric (chairs)            | Hospital  | ambientCG fabric sets; Poly Haven cotton_jersey                             | CC0     |
| Sealed concrete floor                 | Warehouse | Poly Haven concrete_floor_02, concrete_floor_painted; ambientCG Concrete034 | CC0     |
| Painted steel (racking)               | Warehouse | ambientCG PaintedMetal004, PaintedMetal006; Poly Haven metal_plate          | CC0     |
| Pallet wood                           | Warehouse | ambientCG Planks023A, Planks037A; Poly Haven worn_planks                    | CC0     |
| Cardboard (boxes)                     | Warehouse | ambientCG Cardboard001, Cardboard004                                        | CC0     |
| Floor marking paint                   | Warehouse | Decals drawn in code                                                        | Own     |
| Asphalt (yard)                        | Warehouse | Poly Haven asphalt_02, clean_asphalt                                        | CC0     |
| Corrugated metal (trailers, cladding) | Warehouse | Poly Haven corrugated_iron_02, container_side; ambientCG CorrugatedSteel005 | CC0     |

ambientCG files cannot be downloaded until acg-download.struffelproductions.com is allowed. Every material above has a Poly Haven option, so M2 is not blocked if that host stays closed.

## Plan: models

Default approach: procedural geometry in code (parametric, instanced), because it keeps payload small, has no license risk and allows exact dimensions. CC0 models are used where they clearly look better.

### Hospital

| Model                             | Approach                            | Candidate                                      | License                              |
| --------------------------------- | ----------------------------------- | ---------------------------------------------- | ------------------------------------ |
| Walls, doors, bathroom pods       | Procedural from world schema        | Own                                            | Own                                  |
| Hospital bed                      | Procedural (frame, mattress, rails) | Poly Haven or Sketchfab search as alternative  | Own, or CC0/CC-BY verified per model |
| Bedside monitor, mobile monitor   | Procedural                          | Own                                            | Own                                  |
| IV pole                           | Procedural                          | Own                                            | Own                                  |
| Infusion pump                     | Procedural                          | Own                                            | Own                                  |
| Ventilator                        | Procedural                          | Sketchfab CC-BY search as alternative          | Own, or CC-BY verified               |
| Wheelchair                        | Procedural                          | Sketchfab CC-BY search as alternative          | Own, or CC-BY verified               |
| Crash cart                        | Procedural                          | Own                                            | Own                                  |
| Chairs, nurse station desk        | Procedural or Poly Haven furniture  | Poly Haven SchoolChair_01, modern_arm_chair_01 | CC0                                  |
| Medication fridge                 | Procedural                          | Own                                            | Own                                  |
| Elevator doors                    | Procedural                          | Own                                            | Own                                  |
| Patient figures (static, in beds) | Character component, lying pose     | Own                                            | Own                                  |

### Warehouse and manufacturing

| Model                                   | Approach                           | Candidate                                    | License                |
| --------------------------------------- | ---------------------------------- | -------------------------------------------- | ---------------------- |
| Hall shell, dock doors, cage, cold room | Procedural from world schema       | Own                                          | Own                    |
| High-bay racking (4 aisles, 5 levels)   | Procedural, instanced              | Own                                          | Own                    |
| Pallets and loads                       | Procedural, instanced              | Own                                          | Own                    |
| Assembly stations, line-side buffer     | Procedural                         | Own                                          | Own                    |
| WIP carriers                            | Procedural                         | Own                                          | Own                    |
| Forklift                                | Procedural                         | Sketchfab CC-BY search as alternative        | Own, or CC-BY verified |
| Truck and trailers                      | Procedural                         | Sketchfab CC-BY search as alternative        | Own, or CC-BY verified |
| Yard tractor                            | Procedural                         | Sketchfab CC-BY search as alternative        | Own, or CC-BY verified |
| Office furniture                        | Poly Haven furniture or procedural | Poly Haven metal_office_desk, SchoolChair_01 | CC0                    |
| Yard pole, muster point sign            | Procedural                         | Own                                          | Own                    |

### People

| Need                                              | Approach                                                                                  | License                   |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------- |
| Faceless mannequin figures, realistic proportions | Procedural segmented mannequin with a code-built skeleton, behind one Character component | Own                       |
| Alternative base mesh                             | MakeHuman export (exported models are CC0), head smoothed to mannequin style              | CC0 (verify at selection) |
| Walk, idle, push animations                       | Procedural (bone rotations driven by gait phase)                                          | Own                       |
| Clothing colors                                   | Scrub colors per hospital role, hi-vis vests in the warehouse                             | Own                       |

Mixamo is avoided: its terms restrict redistributing the raw files, which is unclear for a repository and a public static build.

### Sentrax devices

All nine devices are modelled procedurally (or glTF generated by script) from the product photos and datasheet dimensions in reference/devices/. See docs/device-reference.md.

### UI and overlays

| Need                                 | Approach                                                   | License     |
| ------------------------------------ | ---------------------------------------------------------- | ----------- |
| Device billboard icons               | Own SVG icons                                              | Own         |
| SOLIX node (server rack, cloud icon) | Procedural rack, own SVG cloud icon                        | Own         |
| Integration target cards             | HTML/CSS in brand style                                    | Own         |
| Brand fonts                          | Lato and Poppins, self-hosted from @fontsource             | SIL OFL 1.1 |
| Sentrax logo                         | From the sentrax.com header, used as the client's own mark | Sentrax     |

## Optimization pipeline

- gltf-transform for glTF: meshopt geometry compression, KTX2 textures (ETC1S for color, UASTC for normals).
- KTX2 encoding needs the KTX-Software `toktx` binary. Plan: run the pipeline locally or in a dedicated script and commit the optimized files, so CI does not need `toktx`. Decision to confirm at M2.
- Budgets: 20 MB or less (compressed) per scene on high, 8 MB or less on low.

## Purchase candidates

None yet. Watch list if procedural quality is not good enough at the M2 and M4 checkpoints: ventilator, wheelchair, forklift, truck and trailer.
