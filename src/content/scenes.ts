/**
 * Display names for scene entities, keyed by the ids used in the world data (src/sim/scenes). Kept here so
 * every visible label can be reviewed and translated in one place.
 */

const hospitalZones: Record<string, string> = {
  corridor: 'Corridor',
  icu: 'ICU',
  'icu-bay-a': 'ICU bed bay A',
  'icu-bay-b': 'ICU bed bay B',
  storage: 'Clean utility and equipment storage',
  dirty: 'Dirty utility',
  med: 'Medication room',
  station: 'Nurse station',
  lobby: 'Elevator lobby',
};
for (const n of ['101', '102', '103', '104', '105', '106']) {
  hospitalZones[`r${n}`] = `Room ${n}`;
  hospitalZones[`r${n}-bath`] = `Room ${n} bathroom`;
}

const warehouseZones: Record<string, string> = {
  hall: 'Hall',
  receiving: 'Receiving',
  staging: 'Picking and staging',
  racking: 'High-bay racking',
  production: 'Production',
  buffer: 'Line-side buffer',
  'station-1': 'Station 1',
  'station-2': 'Station 2',
  'station-3': 'Station 3',
  cold: 'Cold storage',
  'cold-entry': 'Cold storage entrance',
  cage: 'Battery charging cage',
  office: 'Office',
  yard: 'Yard',
  muster: 'Muster point',
};
for (const a of ['A', 'B', 'C', 'D']) warehouseZones[`aisle-${a}`] = `Aisle ${a}`;
for (const d of [1, 2, 3]) {
  warehouseZones[`dock-${d}`] = `Dock door ${d}`;
  warehouseZones[`trailer-dock-${d}`] = `Trailer at dock door ${d}`;
}

export const zoneLabels: Record<string, string> = { ...hospitalZones, ...warehouseZones };

/** Asset labels. Short codes follow the pattern used in the stories ("Infusion pump P-07"). */
export function assetLabel(assetId: string): string {
  const m = assetId.match(/^([a-z-]+?)-(\d+)$/);
  if (!m) return assetId;
  const [, kind, num] = m as unknown as [string, string, string];
  switch (kind) {
    case 'pump':
      return `Infusion pump P-${num}`;
    case 'vent':
      return `Ventilator V-${num}`;
    case 'wheelchair':
      return `Wheelchair W-${num}`;
    case 'crashcart':
      return `Crash cart C-${num}`;
    case 'monitor':
      return `Mobile monitor M-${num}`;
    case 'fridge':
      return 'Medication fridge';
    case 'pallet':
      return `Pallet PL-${num}`;
    case 'cold-pallet':
      return `Cold pallet CP-${num}`;
    case 'wip':
      return `WIP carrier WIP-${num}`;
    case 'trailer':
      return `Trailer T-${num}`;
    default:
      return assetId;
  }
}

export const roleLabels: Record<string, string> = {
  nurse: 'Nurse',
  biomed: 'BioMed technician',
  porter: 'Porter',
  forklift: 'Forklift',
  forklift_driver: 'Forklift driver',
  picker: 'Picker',
  assembly: 'Assembly worker',
  yard_tractor: 'Yard tractor',
};

export const techLabels = {
  rssi: 'BLE RSSI',
  aoa: 'BLE AoA',
  bilink: 'BiLink',
  hybrid: 'Hybrid',
} as const;
