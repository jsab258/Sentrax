# Device reference sheet

Status: verified on 2026-09-26 against the live product pages and the official datasheets. Reference files (photos, technical diagrams, datasheet PDFs, page text) are in reference/devices/<model>/, fetched with `npm run refs:fetch`. A contact sheet of the main product photos is in docs/device-photos-sheet.jpg.

Descriptions are the sentrax.com main menu product descriptors, verbatim (src/content/devices.ts). They are verified but still unapproved until Sentrax signs them off.

Box sizes are width x depth x height as mounted. For the TOK-1 badge, height is the length as worn.

## Summary

| Model       | Role in demo                       | Size (mm)         | Weight | Color     | IP   | Mounting                |
| ----------- | ---------------------------------- | ----------------- | ------ | --------- | ---- | ----------------------- |
| NODIX CEN-1 | BiLink room anchor                 | 70.95 dia x 26.2  | 72 g   | White     | IP54 | Tape or screw           |
| ZENIX LEN-1 | Corridor gateway (hospital)        | 125 x 125 x 29    | 166 g  | Off-white | n/a  | Wall or ceiling         |
| ZENIX LEN-2 | Gateway with environmental sensing | 125 x 125 x 29    | 166 g  | Off-white | IP54 | Wall or ceiling         |
| ZENIX LON-2 | AoA locator                        | 240 x 240 x 60    | 950 g  | Off-white | IP40 | Ceiling                 |
| ZENIX LEF-3 | Outdoor yard gateway               | 175 x 130 x 45    | 266 g  | Off-white | IP67 | Wall or pole            |
| PINIX TOW-1 | Asset tag                          | 51 x 51 x 20      | 45 g   | Beige     | IP65 | Tape or screw (flanges) |
| PINIX TOW-5 | Multi-sensor asset tag             | 51 x 51 x 20      | 45 g   | Beige     | IP65 | Tape or screw (flanges) |
| PINIX TOK-1 | Staff badge                        | 38.6 x 8.4 x 55.3 | 12 g   | White     | IP65 | Lanyard or key ring     |
| PINIX TOB-1 | SOS wearable (H5 nurse, W4 worker) | 36 dia x 11       | 12 g   | White     | IP67 | Wristband strap         |
| PINIX TEP-1 | Not used (patient bracelet)        | not checked       |        |           |      |                         |

## NODIX CEN-1 (BiLink relay anchor)

- Product page: https://sentrax.com/product/nodix-cen-1/
- Datasheet: NODIX CEN-1 Device Specification.pdf
- Descriptor: "BiLink BLE Relay Anchor - Battery Operated Scanner and Beacon"
- Datasheet facts: BLE 5.x, bi-directional (scanning and broadcasting), PCB omni antenna, battery with about 2 years 2 months life (estimate), user button, 1 red LED, internal temperature sensor, optional accelerometer, -20 to 70 C.
- Appearance (photos): round white puck with a rounded top edge, a grey embossed BiLink symbol on top, small oval LED window on the side. No wordmark.
- Demo role: one per patient room, ICU, storage, clean and dirty utility and medication room (hospital); one per dock door and at the cold room entrance (warehouse).

## ZENIX LEN-1 (RSSI gateway, PoE and Wi-Fi)

- Product page: https://sentrax.com/product/zenix-len-1/
- Datasheet: Zenix LEN-1 Device Specification.pdf
- Descriptor: "BLE (RSSI) Indoor Gateway for Proximity Positioning"
- Datasheet facts: BLE 5.1 scanner, RJ45 PoE 802.3af, Wi-Fi 2.4 GHz, internal antenna (external optional), range 10 to 50 m (depends on installation), 1 user button, red power LED, green status LED, 0 to 60 C.
- Appearance: square off-white box with rounded corners, one white rod antenna on top, light grey "sentrax" wordmark on the top face near a corner, recessed front panel with PoE port, 12 V DC jack, LEDs and a "ZENIX LEN-1" label.
- Demo role: 2 units in the hospital corridor receiving BiLink relays.

## ZENIX LEN-2 (RSSI gateway with environmental sensing)

- Product page: https://sentrax.com/product/zenix-len-2/
- Datasheet: Zenix LEN-2 Device Specification.pdf
- Descriptor: "BLE (RSSI) Indoor Gateway for Proximity Positioning + Environmental Sensing"
- Datasheet facts: as LEN-1, plus temperature (0 to 65 C), humidity (0 to 100 %RH), pressure (0.3 to 1.2 bar), light (1 to 65535 lux), TVOC (1 to 500) and a PIR motion sensor (100 degrees); IP54; DC adapter 12 V option.
- Appearance: same housing as LEN-1 with a black PIR dome in the centre of the top face and two vertical vent slots on the front panel.
- Demo role: medication room environmental sensing (hospital); general coverage and climate (warehouse).

## ZENIX LON-2 (AoA locator)

- Product page: https://sentrax.com/product/zenix-lon-2/
- Datasheet: Zenix LON-2 Device Specifications.pdf
- Descriptor: "BLE (AoA) Indoor Scanner for Precise Submeter Location Tracking."
- Datasheet facts: BLE 5.1 AoA, antenna array, range 5 to 30 m, PoE 802.3at or 12 V DC, 5 W, Wi-Fi 2.4 GHz, ABS UL94V-0, 0 to 60 C.
- Appearance: large flat square off-white box, wordmark on the top face near a corner, front panel with USB, PoE, DC, LEDs, reset and a "ZENIX LON-2" label. No external antennas.
- Demo role: over the ICU bed bays (hospital, hybrid); ceiling grid over racking and production (warehouse).

## ZENIX LEF-3 (outdoor RSSI gateway, LTE and GPS)

- Product page: https://sentrax.com/product/zenix-lef-3/
- Datasheet: Zenix LEF-3 Device Specification.pdf
- Descriptor: "BLE (RSSI) Outdoor Gateway for Proximity Positioning with Wi-Fi, LTE Connectivity & GPS"
- Datasheet facts: BLE scanner, two external antennas, GPS, LTE (SIM slot), PoE 802.3af, Wi-Fi, 18 W supply rating, range 10 to 50 m, IP67, 0 to 60 C.
- Appearance: rectangular off-white enclosure, two white rod antennas on the left and right, sealed cable glands on the front, round button, LEDs, "ZENIX LEF-3" label.
- Demo role: on a pole in the warehouse yard.

## PINIX TOW-1 (hybrid asset tag)

- Product page: https://sentrax.com/product/pinix-tow-1/
- Datasheet: PINIX TOW-1 Device Specifications.pdf
- Descriptor: "Hybrid BLE (AoA) & (RSSI) Asset Tag"
- Datasheet facts: BLE 5.1 AoA, CR2477 1000 mAh (2000 mAh optional), about 2 to 3 years depending on advertising rate, 3-axis accelerometer, 1 button, 1 red LED, IP65, ABS, -30 to 85 C.
- Appearance: square housing with two mounting flanges with screw holes, light grey circle on top, "sentrax" and "PINIX TOW-1" printed on one side. The datasheet says beige; the renders look off-white.
- Demo role: infusion pumps (8), ventilators (3), wheelchairs (3), crash cart (1), mobile monitors (hospital); pallets, WIP carriers, forklifts (warehouse).

## PINIX TOW-5 (AoA multi-sensor asset tag)

- Product page: https://sentrax.com/product/pinix-tow-5/
- Datasheet: PINIX TOW-5 Device Specifications.pdf
- Descriptor: "BLE (AoA) Asset Tag with Multi-Sensors"
- Datasheet facts: BLE 5.1 AoA, internal temperature sensor, 3-axis accelerometer, humidity (0 to 100 %RH) and pressure (0.3 to 1.2 bar) on the enhanced version, IP65, same housing as TOW-1.
- Appearance: same as TOW-1 with "PINIX TOW-5" printed on the side.
- Demo role: on the medication fridge (hospital); on cold pallets (warehouse).

## PINIX TOK-1 (smart badge)

- Product page: https://sentrax.com/product/pinix-tok-1/
- Datasheet: PINIX TOK-1 Device Specifications.pdf
- Descriptor: "Smart Badge BLE (AoA) Tag with Temperature Sensor"
- Datasheet facts: BLE 5.x, CR2032 225 mAh, 4 to 6 months, 3-axis accelerometer, internal temperature sensor, 1 button, 3 LEDs (blue, red, green), IP65, ABS white, key ring.
- Appearance: white rounded rectangle with a lanyard loop at the top and a QR code on the front. No wordmark.
- Demo role: staff badges (nurses, BioMed technician, porter).

## PINIX TOB-1 (SOS wearable)

- Product page: https://sentrax.com/product/pinix-tob-1/
- Datasheet: PINIX TOB-1 Device Specification.pdf
- Descriptor: "BLE AoA Wearable Beacon Tag with SoS Button and Accelerometer"
- Datasheet facts: BLE 5.x with AoA support, integrated SOS button, CR2032 220 mAh, 4 to 6 months, 3-axis accelerometer, indication LED, IP67, ABS white, detachable wristband strap.
- Appearance: round white puck with a raised centre on a white perforated wristband, smartwatch style.
- Verified: the live site confirms TOB-1 is the SOS wearable (main menu, product page, manufacturing page "Staff Duress & Safety Monitoring"). The earlier snippet linking it to a relay anchor came from the related-products carousel on the CEN-1 page.
- Demo role: nurse SOS in H5 (hospital); worker duress, zone safety and muster in W4 (warehouse).

## PINIX TEP-1 (not used)

- Product page: https://sentrax.com/product/pinix-tep-1/
- Page title: "PINIX TEP-1 - Tamper-proof wearable BLE bracelet/Beacon Tag". Page copy: a BLE RSSI wearable bracelet for person positioning in hospitals and nursing homes, with tamper and cut-off alerts and an optional SOS button.
- Not used in the demo: it is aimed at patients, and patient tracking is out of scope.

## Modelling approach (from M2)

- Procedural geometry or glTF generated by script, true to scale from the sizes above.
- PBR materials matched to the photos: off-white or white ABS with a slight satin sheen; black PIR dome on LEN-2.
- Sentrax wordmark only where the photos show it: top face of LEN-1, LEN-2 and LON-2, top edge of LEF-3, side of TOW-1 and TOW-5. None on CEN-1 (BiLink symbol instead), TOK-1 or TOB-1.
- Billboard icon marker at distance, handing over to the real model when zoomed in.
