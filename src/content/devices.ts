import type { Claim } from './types';
import { PLACEHOLDER_PREFIX } from './types';

/**
 * Sentrax device catalogue used by product cards, the device reference sheet and (from M2) the 3D models.
 *
 * Status at M0: sentrax.com is blocked by the build environment's network policy, so product pages,
 * photos and datasheets could not be read directly. Descriptions below come from web search snippets of
 * the product pages and are therefore unapproved. Physical dimensions are unknown and left null on purpose.
 */

export type DeviceFamily = 'NODIX' | 'ZENIX' | 'PINIX';
export type DeviceKind = 'anchor' | 'gateway' | 'locator' | 'tag' | 'badge' | 'wearable';
export type Technology = 'rssi' | 'aoa' | 'bilink';

export interface DeviceSpec {
  model: string;
  family: DeviceFamily;
  kind: DeviceKind;
  /** Positioning methods this device takes part in within the demo scenes (not a product capability list). */
  technologies: Technology[];
  productUrl: string;
  /** One-line description from the product page. */
  description: Claim;
  /** Outer dimensions in millimetres (width, height, depth). Null until read from a datasheet. */
  dimensionsMm: { w: number; h: number; d: number } | null;
  /** Unverified facts seen in search snippets, kept for the reference sheet only. Never shown in the UI. */
  unverifiedNotes: string[];
  /** Role text per scene, shown on the product card. */
  roles: Partial<Record<'hospital' | 'warehouse', string>>;
}

const unverified = 'From a web search snippet of the product page. Verify wording on the live page.';

export const devices = {
  'NODIX CEN-1': {
    model: 'NODIX CEN-1',
    family: 'NODIX',
    kind: 'anchor',
    technologies: ['bilink'],
    productUrl: 'https://sentrax.com/product/nodix-cen-1/',
    description: {
      id: 'device.cen1.description',
      text: 'Bi-directional BLE anchor relay that delivers reliable room-level visibility in complex indoor environments.',
      sourceUrl: 'https://sentrax.com/product/nodix-cen-1/',
      approved: false,
      note: unverified,
    },
    dimensionsMm: null,
    unverifiedNotes: [
      'Battery powered, replaceable high-capacity battery.',
      'Scans its room, bundles tag data with its Room ID and relays wirelessly to the nearest ZENIX hallway gateway.',
    ],
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
    description: {
      id: 'device.len1.description',
      text: 'Indoor BLE scanner and locator gateway with PoE and Wi-Fi interfaces and a wall mount system.',
      sourceUrl: 'https://sentrax.com/product/zenix-len-1/',
      approved: false,
      note: unverified,
    },
    dimensionsMm: null,
    unverifiedNotes: ['PoE and Wi-Fi.', 'Wall mount.'],
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
    description: {
      id: 'device.len2.description',
      text: 'Indoor BLE locator and gateway with climatic and air quality monitoring.',
      sourceUrl: 'https://sentrax.com/product/zenix-len-2/',
      approved: false,
      note: unverified,
    },
    dimensionsMm: null,
    unverifiedNotes: ['PoE and Wi-Fi.', 'FAQ snippet: range 50 m in open area, depends on installation.'],
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
    description: {
      id: 'device.lon2.description',
      text: 'Indoor BLE Angle of Arrival locator and gateway for sub-meter positioning, with PoE and optional Wi-Fi.',
      sourceUrl: 'https://sentrax.com/product/zenix-lon-2/',
      approved: false,
      note: unverified,
    },
    dimensionsMm: null,
    unverifiedNotes: ['Antenna array for AoA.', 'PoE, optional Wi-Fi.'],
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
    description: {
      id: 'device.lef3.description',
      text: 'Outdoor BLE RSSI locator and gateway with LTE, GPS and an IP67 enclosure.',
      sourceUrl: 'https://sentrax.com/product/zenix-lef-3/',
      approved: false,
      note: unverified,
    },
    dimensionsMm: null,
    unverifiedNotes: ['IP67 outdoor enclosure.', 'External antennas.', 'PoE, Wi-Fi, LTE, GPS/GNSS.'],
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
    description: {
      id: 'device.tow1.description',
      text: 'Hybrid BLE RSSI and AoA asset tag with accelerometer.',
      sourceUrl: 'https://sentrax.com/product/pinix-tow-1/',
      approved: false,
      note: unverified,
    },
    dimensionsMm: null,
    unverifiedNotes: ['Accelerometer.'],
    roles: {
      hospital: 'Asset tag on infusion pumps, ventilators, wheelchairs, the crash cart and mobile monitors.',
      warehouse: 'Asset tag on pallets, WIP carriers and forklifts.',
    },
  },
  'PINIX TOW-5': {
    model: 'PINIX TOW-5',
    family: 'PINIX',
    kind: 'tag',
    technologies: ['aoa'],
    productUrl: 'https://sentrax.com/product/pinix-tow-5/',
    description: {
      id: 'device.tow5.description',
      text: 'BLE AoA asset tag with temperature, humidity and pressure sensing.',
      sourceUrl: 'https://sentrax.com/product/pinix-tow-5/',
      approved: false,
      note: unverified,
    },
    dimensionsMm: null,
    unverifiedNotes: ['Temperature, humidity and pressure sensors.'],
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
    description: {
      id: 'device.tok1.description',
      text: 'Smart badge BLE AoA tag with motion and temperature sensing, a user button and LED indicators.',
      sourceUrl: 'https://sentrax.com/product/pinix-tok-1/',
      approved: false,
      note: unverified,
    },
    dimensionsMm: null,
    unverifiedNotes: ['IP65.', 'Replaceable 800 mAh lithium battery, 4 to 6 months.', 'User button, LEDs.'],
    roles: {
      hospital: 'Staff badge for nurses, the BioMed technician and the porter.',
    },
  },
  'PINIX TOB-1': {
    model: 'PINIX TOB-1',
    family: 'PINIX',
    kind: 'wearable',
    technologies: ['rssi', 'bilink'],
    productUrl: 'https://sentrax.com/product/pinix-tob-1/',
    description: {
      id: 'device.tob1.description',
      text: `${PLACEHOLDER_PREFIX} Wearable with SOS button. Product description not yet verified.`,
      sourceUrl: 'https://sentrax.com/product/pinix-tob-1/',
      approved: false,
      note: 'Search snippets conflict: some describe TOB-1 as a battery-operated BiLink relay anchor, and PINIX TEP-1 as the wearable with optional SOS. Needs confirmation from Sentrax.',
    },
    dimensionsMm: null,
    unverifiedNotes: ['Conflicting search snippets. See description note.'],
    roles: {
      hospital: 'Wearable with SOS button for staff call for help.',
      warehouse: 'Worker tag for zone safety and muster counts.',
    },
  },
} as const satisfies Record<string, DeviceSpec>;

export type DeviceModel = keyof typeof devices;
export const deviceList: DeviceSpec[] = Object.values(devices);
