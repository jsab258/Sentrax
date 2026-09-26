# Device reference sheet

Status: M0, incomplete. sentrax.com (product pages, photos, datasheets) is blocked by the build environment's network policy. Everything below comes from web search result snippets of the product pages and is unverified. No dimensions, colors or logo placements are known yet, and none have been guessed.

To complete this sheet: allow sentrax.com, run `npm run refs:fetch`, then fill the empty fields from `reference/devices/<model>/`.

Legend for each device:

- Source: product page (SPEC section 9)
- Seen in snippets: unverified facts, not shown in the UI
- Demo role: where the device appears (SPEC sections 7 and 8)
- Still needed: what the photos and datasheet must answer before modelling

## NODIX CEN-1 (BiLink relay anchor)

- Source: https://sentrax.com/product/nodix-cen-1/
- Seen in snippets: bi-directional BLE anchor relay, scanner and broadcaster; battery powered with a replaceable high-capacity battery; scans its room, bundles tag data with its Room ID and relays wirelessly to the nearest ZENIX hallway gateway.
- Demo role: hospital, one per patient room, ICU, storage, clean and dirty utility, medication room. Warehouse, one per dock door and at the cold room entrance.
- Still needed: dimensions, housing shape and color, mounting (wall or ceiling), LED position, logo position, battery door.

## ZENIX LEN-1 (RSSI gateway, PoE and Wi-Fi)

- Source: https://sentrax.com/product/zenix-len-1/
- Seen in snippets: indoor BLE scanner and locator gateway; PoE and Wi-Fi interfaces; wall mount system.
- Demo role: hospital, 2 units in the corridor receiving BiLink relays.
- Still needed: dimensions, housing shape and color, antenna (internal or external), cable entry, LEDs, logo position.

## ZENIX LEN-2 (RSSI gateway with climatic sensors)

- Source: https://sentrax.com/product/zenix-len-2/
- Seen in snippets: indoor BLE locator and gateway; climatic and air quality monitoring (temperature, humidity); PoE and Wi-Fi; FAQ snippet mentions a range of 50 m in open area depending on installation.
- Demo role: hospital, medication room environmental sensing. Warehouse, general coverage and climate.
- Still needed: dimensions, housing shape and color, sensor vents, mounting, logo position. The 50 m range needs confirmation before it drives any simulation parameter; the simulator config will treat ranges as illustrative either way.

## ZENIX LON-2 (AoA locator)

- Source: https://sentrax.com/product/zenix-lon-2/
- Seen in snippets: indoor BLE Angle of Arrival locator and gateway; antenna array; sub-meter positioning; PoE and optional Wi-Fi.
- Demo role: hospital, over the ICU bed bays (hybrid demonstration). Warehouse, ceiling grid over racking and production.
- Still needed: dimensions, housing shape (antenna array footprint), color, mounting orientation (ceiling), logo position.

## ZENIX LEF-3 (outdoor RSSI gateway, LTE and GPS)

- Source: https://sentrax.com/product/zenix-lef-3/
- Seen in snippets: outdoor BLE RSSI locator and gateway; IP67 enclosure; external antennas; PoE, Wi-Fi, LTE, GPS/GNSS; LEDs; wall mount.
- Demo role: warehouse yard, mounted on a pole.
- Still needed: dimensions, enclosure shape and color, number and position of external antennas, pole bracket, logo position.

## PINIX TOW-1 (hybrid asset tag)

- Source: https://sentrax.com/product/pinix-tow-1/
- Seen in snippets: hybrid BLE RSSI and AoA asset tag; accelerometer.
- Demo role: hospital, on 8 infusion pumps, 3 ventilators, 3 wheelchairs, 1 crash cart and mobile monitors. Warehouse, on pallets, WIP carriers and forklifts.
- Still needed: dimensions, shape, color, fixing method (adhesive, screw, strap), logo position.

## PINIX TOW-5 (AoA multi-sensor asset tag)

- Source: https://sentrax.com/product/pinix-tow-5/
- Seen in snippets: BLE AoA asset tag with temperature, humidity and pressure monitoring.
- Demo role: hospital, on the medication fridge. Warehouse, on cold pallets.
- Still needed: dimensions, shape, color, sensor opening, fixing method, logo position.

## PINIX TOK-1 (smart badge)

- Source: https://sentrax.com/product/pinix-tok-1/
- Seen in snippets: smart badge BLE 5.x AoA tag; motion sensor, internal temperature sensor, user button, LED indicators; IP65; replaceable 800 mAh lithium battery, 4 to 6 months.
- Demo role: hospital staff badges (nurses, BioMed technician, porter).
- Still needed: dimensions (card format or not), color, lanyard or clip, button and LED positions, logo position.

## PINIX TOB-1 (wearable with SOS button)

- Source: https://sentrax.com/product/pinix-tob-1/
- Seen in snippets: conflicting. Some snippets describe PINIX TOB-1 as a "BiLink BLE Relay Anchor, Battery Operated Scanner and Beacon". PINIX TEP-1 is described as the tamper-proof wearable bracelet with optional SOS button, and TOK-1 as having a user button.
- Demo role (per SPEC): hospital, 1 wearable with SOS button (H5). Warehouse, worker tags (W4).
- Still needed: confirmation of what TOB-1 is. If it is not a wearable with SOS, the SOS wearable role needs a different model (possibly TEP-1 or TOK-1). This is a blocking question for M3 (H5) and M4 (W4), not for M1.

## Modelling approach (all devices, from M2)

- Procedural geometry in code, or glTF generated by script, true to scale once dimensions are known.
- PBR materials matched to the photos.
- Sentrax logo only where it appears on the real device.
- Billboard icon marker at distance, handing over to the real model when zoomed in.
