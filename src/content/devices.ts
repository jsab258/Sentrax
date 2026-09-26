import type { Claim } from './types';

/**
 * Sentrax device catalogue used by product cards, the device reference sheet and (from M2) the 3D models.
 *
 * Verified on 2026-09-26 against the live product pages and the official datasheets
 * (reference/devices/<model>/). Descriptions are the product descriptors from the sentrax.com main menu,
 * verbatim. Physical data comes from the datasheets. See docs/device-reference.md for sources.
 */

export type DeviceFamily = 'NODIX' | 'ZENIX' | 'PINIX';
export type DeviceKind = 'anchor' | 'gateway' | 'locator' | 'tag' | 'badge' | 'wearable';
export type Technology = 'rssi' | 'aoa' | 'bilink';

export type DeviceSize =
  { shape: 'box'; w: number; d: number; h: number } | { shape: 'round'; diameter: number; h: number };

export interface DeviceSpec {
  model: string;
  family: DeviceFamily;
  kind: DeviceKind;
  /** Positioning methods this device takes part in within the demo scenes (not a product capability list). */
  technologies: Technology[];
  productUrl: string;
  datasheetUrl: string;
  /** One-line description from the site (main menu product descriptor). */
  description: Claim;
  /** Outer dimensions in millimetres, from the datasheet. Used to build true-to-scale models. */
  sizeMm: DeviceSize;
  weightG: number;
  /** Housing color as named in the datasheet. */
  color: string;
  ipRating: string | null;
  mounting: string;
  /** Where the Sentrax logo or other markings appear on the real device (from product photos). */
  markings: string;
  /** Role text per scene, shown on the product card. */
  roles: Partial<Record<'hospital' | 'warehouse', string>>;
}

const verifiedAt = '2026-09-26';
const menuNote = 'Main menu product descriptor on sentrax.com, verbatim. Verified on the live site.';
const datasheet = (file: string) => `https://sentrax.com/docs/datasheets/${encodeURIComponent(file)}.pdf`;

export const devices = {
  'NODIX CEN-1': {
    model: 'NODIX CEN-1',
    family: 'NODIX',
    kind: 'anchor',
    technologies: ['bilink'],
    productUrl: 'https://sentrax.com/product/nodix-cen-1/',
    datasheetUrl: datasheet('NODIX CEN-1 Device Specification'),
    description: {
      id: 'device.cen1.description',
      text: 'BiLink BLE Relay Anchor - Battery Operated Scanner and Beacon',
      sourceUrl: 'https://sentrax.com/product/nodix-cen-1/',
      approved: false,
      verifiedAt,
      note: menuNote,
    },
    sizeMm: { shape: 'round', diameter: 70.95, h: 26.2 },
    weightG: 72,
    color: 'White',
    ipRating: 'IP54',
    mounting: 'Double-sided tape or mounting screw',
    markings: 'Grey embossed BiLink symbol on top; small oval LED window on the side. No wordmark visible.',
    roles: {
      hospital:
        'Room anchor: scans tags in its room, validates presence and relays verified room events to a corridor gateway.',
      warehouse: 'Zone anchor at dock doors and the cold room entrance for automatic check-in and check-out.',
    },
  },
  'ZENIX LEN-1': {
    model: 'ZENIX LEN-1',
    family: 'ZENIX',
    kind: 'gateway',
    technologies: ['rssi', 'bilink'],
    productUrl: 'https://sentrax.com/product/zenix-len-1/',
    datasheetUrl: datasheet('Zenix LEN-1 Device Specification'),
    description: {
      id: 'device.len1.description',
      text: 'BLE (RSSI) Indoor Gateway for Proximity Positioning',
      sourceUrl: 'https://sentrax.com/product/zenix-len-1/',
      approved: false,
      verifiedAt,
      note: menuNote,
    },
    sizeMm: { shape: 'box', w: 125, d: 125, h: 29 },
    weightG: 166,
    color: 'Off-white',
    ipRating: null,
    mounting: 'Wall or ceiling mount',
    markings:
      'Light grey "sentrax" wordmark on the top face, near one corner. Front panel: PoE port, 12 V DC jack, power and status LEDs, "ZENIX LEN-1" label. One white rod antenna on top (optional external antenna).',
    roles: {
      hospital: 'Corridor gateway: receives BiLink relays from the room anchors and forwards them to SOLIX.',
    },
  },
  'ZENIX LEN-2': {
    model: 'ZENIX LEN-2',
    family: 'ZENIX',
    kind: 'gateway',
    technologies: ['rssi'],
    productUrl: 'https://sentrax.com/product/zenix-len-2/',
    datasheetUrl: datasheet('Zenix LEN-2 Device Specification'),
    description: {
      id: 'device.len2.description',
      text: 'BLE (RSSI) Indoor Gateway for Proximity Positioning + Environmental Sensing',
      sourceUrl: 'https://sentrax.com/product/zenix-len-2/',
      approved: false,
      verifiedAt,
      note: menuNote,
    },
    sizeMm: { shape: 'box', w: 125, d: 125, h: 29 },
    weightG: 166,
    color: 'Off-white',
    ipRating: 'IP54',
    mounting: 'Wall or ceiling mount',
    markings:
      'Same housing as LEN-1 with a black PIR dome in the centre of the top face and two vent slots on the front. "sentrax" wordmark on top near one corner; "ZENIX LEN-2" on the front panel. One white rod antenna.',
    roles: {
      hospital: 'Environmental sensing in the medication room.',
      warehouse: 'General BLE coverage and hall climate monitoring.',
    },
  },
  'ZENIX LON-2': {
    model: 'ZENIX LON-2',
    family: 'ZENIX',
    kind: 'locator',
    technologies: ['aoa'],
    productUrl: 'https://sentrax.com/product/zenix-lon-2/',
    datasheetUrl: datasheet('Zenix LON-2 Device Specifications'),
    description: {
      id: 'device.lon2.description',
      text: 'BLE (AoA) Indoor Scanner for Precise Submeter Location Tracking',
      sourceUrl: 'https://sentrax.com/product/zenix-lon-2/',
      approved: false,
      verifiedAt,
      note: `${menuNote} Trailing period dropped.`,
    },
    sizeMm: { shape: 'box', w: 240, d: 240, h: 60 },
    weightG: 950,
    color: 'Off-white',
    ipRating: 'IP40',
    mounting: 'Ceiling mount',
    markings:
      '"sentrax" wordmark on the top face near one corner. Front panel: USB, PoE port, 12 V DC jack, status and power LEDs, reset, "ZENIX LON-2" label. No external antennas (internal array).',
    roles: {
      hospital: 'AoA locators over the ICU for bed-bay-level positioning in the hybrid setup.',
      warehouse: 'Ceiling grid over racking and production for rack-slot and station-level positioning.',
    },
  },
  'ZENIX LEF-3': {
    model: 'ZENIX LEF-3',
    family: 'ZENIX',
    kind: 'gateway',
    technologies: ['rssi'],
    productUrl: 'https://sentrax.com/product/zenix-lef-3/',
    datasheetUrl: datasheet('Zenix LEF-3 Device Specification'),
    description: {
      id: 'device.lef3.description',
      text: 'BLE (RSSI) Outdoor Gateway for Proximity Positioning with Wi-Fi, LTE Connectivity & GPS',
      sourceUrl: 'https://sentrax.com/product/zenix-lef-3/',
      approved: false,
      verifiedAt,
      note: menuNote,
    },
    sizeMm: { shape: 'box', w: 175, d: 130, h: 45 },
    weightG: 266,
    color: 'Off-white',
    ipRating: 'IP67',
    mounting: 'Wall or pole mount',
    markings:
      'Two white rod antennas on the left and right sides. Front: sealed cable glands, a round button, LEDs and a "ZENIX LEF-3" label. Small wordmark on the top edge.',
    roles: {
      warehouse:
        'Outdoor gateway on a yard pole: keeps trailers and yard assets visible after they leave the hall.',
    },
  },
  'PINIX TOW-1': {
    model: 'PINIX TOW-1',
    family: 'PINIX',
    kind: 'tag',
    technologies: ['rssi', 'aoa', 'bilink'],
    productUrl: 'https://sentrax.com/product/pinix-tow-1/',
    datasheetUrl: datasheet('PINIX TOW-1 Device Specifications'),
    description: {
      id: 'device.tow1.description',
      text: 'Hybrid BLE (AoA) & (RSSI) Asset Tag',
      sourceUrl: 'https://sentrax.com/product/pinix-tow-1/',
      approved: false,
      verifiedAt,
      note: menuNote,
    },
    sizeMm: { shape: 'box', w: 51, d: 51, h: 20 },
    weightG: 45,
    color: 'Beige (datasheet); photos show off-white',
    ipRating: 'IP65',
    mounting: 'Double-sided tape or mounting screw (two flanges with screw holes)',
    markings:
      'Square housing with two mounting flanges. Light grey circular area on top. "sentrax" wordmark and "PINIX TOW-1" printed on one side face.',
    roles: {
      hospital: 'Asset tag on infusion pumps, ventilators, wheelchairs, the crash cart and mobile monitors.',
      warehouse: 'Asset tag on pallets, WIP carriers and forklifts.',
    },
  },
  'PINIX TOW-5': {
    model: 'PINIX TOW-5',
    family: 'PINIX',
    kind: 'tag',
    technologies: ['aoa', 'rssi', 'bilink'],
    productUrl: 'https://sentrax.com/product/pinix-tow-5/',
    datasheetUrl: datasheet('PINIX TOW-5 Device Specifications'),
    description: {
      id: 'device.tow5.description',
      text: 'BLE (AoA) Asset Tag with Multi-Sensors',
      sourceUrl: 'https://sentrax.com/product/pinix-tow-5/',
      approved: false,
      verifiedAt,
      note: menuNote,
    },
    sizeMm: { shape: 'box', w: 51, d: 51, h: 20 },
    weightG: 45,
    color: 'Beige (datasheet); photos show off-white',
    ipRating: 'IP65',
    mounting: 'Double-sided tape or mounting screw (two flanges with screw holes)',
    markings: 'Same housing as TOW-1. "sentrax" wordmark and "PINIX TOW-5" printed on one side face.',
    roles: {
      hospital: 'Multi-sensor tag on the medication fridge for cold chain monitoring.',
      warehouse: 'Multi-sensor tag on cold pallets to track temperature during transfer.',
    },
  },
  'PINIX TOK-1': {
    model: 'PINIX TOK-1',
    family: 'PINIX',
    kind: 'badge',
    technologies: ['aoa', 'rssi', 'bilink'],
    productUrl: 'https://sentrax.com/product/pinix-tok-1/',
    datasheetUrl: datasheet('PINIX TOK-1 Device Specifications'),
    description: {
      id: 'device.tok1.description',
      text: 'Smart Badge BLE (AoA) Tag with Temperature Sensor',
      sourceUrl: 'https://sentrax.com/product/pinix-tok-1/',
      approved: false,
      verifiedAt,
      note: menuNote,
    },
    sizeMm: { shape: 'box', w: 38.6, d: 8.4, h: 55.3 },
    weightG: 12,
    color: 'White',
    ipRating: 'IP65',
    mounting: 'Lanyard or key ring through the top loop',
    markings:
      'Rounded rectangle with a lanyard loop at the top and a QR code on the front. No wordmark visible.',
    roles: {
      hospital: 'Staff badge for nurses, the BioMed technician and the porter.',
    },
  },
  'PINIX TOB-1': {
    model: 'PINIX TOB-1',
    family: 'PINIX',
    kind: 'wearable',
    technologies: ['aoa', 'rssi', 'bilink'],
    productUrl: 'https://sentrax.com/product/pinix-tob-1/',
    datasheetUrl: datasheet('PINIX TOB-1 Device Specification'),
    description: {
      id: 'device.tob1.description',
      text: 'BLE AoA Wearable Beacon Tag with SoS Button and Accelerometer',
      sourceUrl: 'https://sentrax.com/product/pinix-tob-1/',
      approved: false,
      verifiedAt,
      note: menuNote,
    },
    sizeMm: { shape: 'round', diameter: 36, h: 11 },
    weightG: 12,
    color: 'White',
    ipRating: 'IP67',
    mounting: 'Detachable wristband strap',
    markings:
      'Round white puck with a raised centre (SOS button) on a white perforated wristband. No wordmark visible.',
    roles: {
      hospital: 'Staff wearable with SOS button for calling for help.',
      warehouse: 'Worker wearable for duress alerts, zone safety and muster counts.',
    },
  },
} as const satisfies Record<string, DeviceSpec>;

export type DeviceModel = keyof typeof devices;
export const deviceList: DeviceSpec[] = Object.values(devices);
