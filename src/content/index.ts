import { claims } from './claims';
import { deviceList } from './devices';
import type { Claim } from './types';

/** Every claim used anywhere in the content files. The claims overlay and the content tests read this. */
export function allClaims(): Claim[] {
  return [...Object.values(claims), ...deviceList.map((d) => d.description)];
}

export function unapprovedClaims(): Claim[] {
  return allClaims().filter((c) => !c.approved);
}
