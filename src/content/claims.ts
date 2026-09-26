import type { Claim } from './types';
import { links } from './links';

/**
 * Technical figures and factual statements used anywhere in the demo.
 *
 * Policy (SPEC section 3):
 * - Allowed figures: RSSI "3 to 5 m", AoA "sub-meter", BiLink "room-level" (no meter figure).
 * - No percentage savings, prices or business impact percentages. The site's "up to 60%", "up to 70%" and
 *   "100% room-level accuracy" statements are deliberately not used anywhere.
 * - No customer names, partner names, deployment references or results.
 */
export const claims = {
  rssiAccuracy: {
    id: 'rssiAccuracy',
    text: '3 to 5 m',
    sourceUrl: links.technology,
    approved: true,
    verifiedAt: '2026-09-26',
    note: 'Allowed figure per SPEC section 3. Technology page: "Mid-Level Accuracy: 3-5m BLE RSSI Proximity Positioning".',
  },
  aoaAccuracy: {
    id: 'aoaAccuracy',
    text: 'sub-meter',
    sourceUrl: links.aoa,
    approved: true,
    verifiedAt: '2026-09-26',
    note: 'Allowed figure per SPEC section 3. AoA page: "sub-meter positional accuracy".',
  },
  bilinkAccuracy: {
    id: 'bilinkAccuracy',
    text: 'room-level',
    sourceUrl: links.bilink,
    approved: true,
    verifiedAt: '2026-09-26',
    note: 'Allowed figure per SPEC section 3. Never attach a meter figure: the site states several conflicting ones (see SITE-ISSUES.md).',
  },
  bilinkTagline: {
    id: 'bilinkTagline',
    text: 'Track More, Install Less',
    sourceUrl: links.bilinkBrochure,
    approved: true,
    verifiedAt: '2026-09-26',
    note: 'Quoted in SPEC section 2. Appears on the brochure cover and in an image alt text on the BiLink page, not in the page copy.',
  },
  rssiHospitalLens: {
    id: 'rssiHospitalLens',
    text: "RSSI with corridor gateways only can't tell rooms apart. A full gateway grid gives 3 to 5 m. BiLink gives room-level without one.",
    sourceUrl: links.technology,
    approved: true,
    verifiedAt: '2026-09-26',
    note: 'Wording set at the M1 review. Shown on the RSSI lens in the hospital instead of a meter figure.',
  },
  searchTime: {
    id: 'searchTime',
    text: 'Clinical staff spend around 30 minutes per shift, sometimes up to 60 minutes, searching for equipment.',
    sourceUrl: links.healthcare,
    approved: false,
    verifiedAt: '2026-09-26',
    note: 'Healthcare page, "Medical Equipment Tracking" section, verbatim. Stays unapproved: the site gives no underlying source.',
  },
} as const satisfies Record<string, Claim>;

export type ClaimId = keyof typeof claims;
