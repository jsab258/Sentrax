import type { Claim } from './types';
import { links } from './links';

/**
 * Technical figures and factual statements used anywhere in the demo.
 *
 * Policy (SPEC section 3):
 * - Allowed figures: RSSI "3 to 5 m", AoA "sub-meter", BiLink "room-level" (no meter figure).
 * - No percentage savings, prices or business impact percentages.
 * - No customer names, partner names, deployment references or results.
 */
export const claims = {
  rssiAccuracy: {
    id: 'rssiAccuracy',
    text: '3 to 5 m',
    sourceUrl: links.proximity,
    approved: true,
    note: 'Allowed technical figure per SPEC section 3.',
  },
  aoaAccuracy: {
    id: 'aoaAccuracy',
    text: 'sub-meter',
    sourceUrl: links.aoa,
    approved: true,
    note: 'Allowed technical figure per SPEC section 3.',
  },
  bilinkAccuracy: {
    id: 'bilinkAccuracy',
    text: 'room-level',
    sourceUrl: links.bilink,
    approved: true,
    note: 'Allowed technical figure per SPEC section 3. Never attach a meter figure.',
  },
  bilinkTagline: {
    id: 'bilinkTagline',
    text: 'Track More, Install Less',
    sourceUrl: links.bilink,
    approved: true,
    note: 'Tagline quoted in SPEC section 2. Wording on the live page not yet re-checked (site blocked from build environment).',
  },
  searchTime: {
    id: 'searchTime',
    text: 'Clinical staff can spend 30 to 60 minutes per shift searching for equipment.',
    sourceUrl: links.healthcare,
    approved: false,
    note: 'Flagged in SPEC section 3. Must stay unapproved until Sentrax confirms the source.',
  },
} as const satisfies Record<string, Claim>;

export type ClaimId = keyof typeof claims;
