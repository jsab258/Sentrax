import { door, hWall, NavBuilder, vWall } from '../builder';
import { rect, vec3, type Vec3 } from '../geometry';
import { Rng } from '../rng';
import type {
  AgentDef,
  AssetDef,
  InfraDeviceDef,
  RackSlot,
  RuleDef,
  TagDef,
  WallDef,
  WorldDef,
  ZoneDef,
} from '../world';

/**
 * Warehouse and manufacturing (SPEC section 8): hall of 80 x 50 m (y 0 to 50) plus a yard to the south
 * (y below 0). x runs east, y north.
 *
 *   south-west   receiving with dock doors 1 to 3, trailers docked outside
 *   south-centre picking and staging;  south-east cold storage room
 *   centre-west  battery charging cage (restricted), office
 *   north-west   production: line-side buffer and assembly stations 1 to 3
 *   north-east   high-bay racking: aisles A to D, bays 1 to 30 (odd south face, even north face), 5 levels
 *   yard         parked trailers, yard tractor, ZENIX LEF-3 on a pole, outdoor muster point
 *
 * All positions and thresholds are illustrative.
 */

const HALL_H = 11;
export const RACK = {
  x0: 35,
  bayPitch: 2.8,
  baysPerFace: 15,
  aisles: { A: 24.5, B: 31, C: 37.5, D: 44 } as Record<string, number>,
  /** Rack face centre offset from the aisle centre line. */
  faceOffset: 2.3,
  levelHeights: [0, 1.8, 3.6, 5.4, 7.2],
};
const DOCKS = [6, 15, 24];
const DOCK_HALF = 1.75;

/** Plan position of a rack slot (pallet base). */
export function slotPosition(s: RackSlot): Vec3 {
  const aisleY = RACK.aisles[s.aisle];
  if (aisleY === undefined) throw new Error(`unknown aisle ${s.aisle}`);
  const index = Math.ceil(s.bay / 2) - 1;
  const north = s.bay % 2 === 0;
  return vec3(
    RACK.x0 + RACK.bayPitch / 2 + index * RACK.bayPitch,
    aisleY + (north ? RACK.faceOffset : -RACK.faceOffset),
    (RACK.levelHeights[s.level - 1] ?? 0) + 0.15,
  );
}

function zones(): ZoneDef[] {
  const z: ZoneDef[] = [
    { id: 'hall', kind: 'area', polygon: rect(0, 0, 80, 50), tags: ['hall', 'building'] },
    { id: 'receiving', kind: 'area', polygon: rect(0, 0, 30, 12), parent: 'hall', tags: ['receiving'] },
    { id: 'staging', kind: 'area', polygon: rect(32, 2, 60, 16), parent: 'hall', tags: ['staging'] },
    { id: 'racking', kind: 'area', polygon: rect(33, 20, 78, 48), parent: 'hall', tags: ['racking'] },
    { id: 'production', kind: 'area', polygon: rect(0, 22, 30, 50), parent: 'hall', tags: ['production'] },
    { id: 'buffer', kind: 'area', polygon: rect(3, 27, 27, 30), parent: 'production', tags: ['buffer'] },
    {
      id: 'station-1',
      kind: 'area',
      polygon: rect(4.5, 34, 9.5, 39),
      parent: 'production',
      tags: ['station-wip'],
    },
    {
      id: 'station-2',
      kind: 'area',
      polygon: rect(12.5, 34, 17.5, 39),
      parent: 'production',
      tags: ['station-wip'],
    },
    {
      id: 'station-3',
      kind: 'area',
      polygon: rect(20.5, 34, 25.5, 39),
      parent: 'production',
      tags: ['station-wip'],
    },
    { id: 'cold', kind: 'room', polygon: rect(64, 2, 78, 16), parent: 'hall', tags: ['cold'] },
    { id: 'cold-entry', kind: 'room', polygon: rect(64, 6, 68, 12.5), parent: 'cold', tags: ['cold'] },
    { id: 'cage', kind: 'area', polygon: rect(22, 14, 30, 20), parent: 'hall', tags: ['restricted'] },
    { id: 'office', kind: 'area', polygon: rect(0, 14, 12, 20), parent: 'hall', tags: ['office'] },
    { id: 'yard', kind: 'outdoor', polygon: rect(-10, -45, 90, 0), tags: ['yard'] },
    { id: 'muster', kind: 'outdoor', polygon: rect(66, -38, 76, -30), parent: 'yard', tags: ['muster'] },
  ];
  for (const [aisle, y] of Object.entries(RACK.aisles)) {
    z.push({
      id: `aisle-${aisle}`,
      kind: 'area',
      polygon: rect(RACK.x0, y - 1.75, 77, y + 1.75),
      parent: 'racking',
    });
  }
  DOCKS.forEach((x, i) => {
    z.push({
      id: `dock-${i + 1}`,
      kind: 'room',
      polygon: rect(x - 3, 0, x + 3, 4.5),
      parent: 'receiving',
      tags: ['dock'],
    });
    z.push({
      id: `trailer-dock-${i + 1}`,
      kind: 'outdoor',
      polygon: rect(x - 1.3, -14, x + 1.3, -0.5),
      parent: 'yard',
      tags: ['trailer'],
    });
  });
  return z;
}

function walls(): WallDef[] {
  const w: WallDef[] = [];
  const dockGaps = DOCKS.map((x) => [x - DOCK_HALF, x + DOCK_HALF] as [number, number]);
  w.push(...hWall('ext-s', 0, 0, 80, 'concrete', HALL_H, [...dockGaps, [31, 32.2]]));
  w.push(...hWall('ext-n', 50, 0, 80, 'concrete', HALL_H));
  w.push(...vWall('ext-w', 0, 0, 50, 'concrete', HALL_H));
  w.push(...vWall('ext-e', 80, 0, 50, 'concrete', HALL_H, [[20, 21.2]]));
  // Cold room: insulated panels.
  w.push(...vWall('cold-w', 64, 2, 16, 'insulated', 5, [[8, 10.5]]));
  w.push(...hWall('cold-s', 2, 64, 78, 'insulated', 5));
  w.push(...hWall('cold-n', 16, 64, 78, 'insulated', 5));
  w.push(...vWall('cold-e', 78, 2, 16, 'insulated', 5));
  // Office: drywall with a glass front.
  w.push(...vWall('office-e', 12, 14, 20, 'drywall', 3, [[16, 17]]));
  w.push(...hWall('office-s', 14, 0, 12, 'glass', 3));
  w.push(...hWall('office-n', 20, 0, 12, 'drywall', 3));
  // Battery charging cage: mesh fence with a gate.
  w.push(...vWall('cage-w', 22, 14, 20, 'mesh', 2.5));
  w.push(...vWall('cage-e', 30, 14, 20, 'mesh', 2.5));
  w.push(...hWall('cage-s', 14, 22, 30, 'mesh', 2.5, [[25, 27]]));
  w.push(...hWall('cage-n', 20, 22, 30, 'mesh', 2.5));
  // Trailers docked at the doors: metal box, rear open to the dock.
  DOCKS.forEach((x, i) => {
    w.push(...vWall(`trailer-${i + 1}-w`, x - 1.3, -14, -0.5, 'metal', 4));
    w.push(...vWall(`trailer-${i + 1}-e`, x + 1.3, -14, -0.5, 'metal', 4));
    w.push(...hWall(`trailer-${i + 1}-front`, -14, x - 1.3, x + 1.3, 'metal', 4));
  });
  return w;
}

function doors() {
  const d = DOCKS.map((x, i) =>
    door(`dock-door-${i + 1}`, { x: x - DOCK_HALF, y: 0 }, { x: x + DOCK_HALF, y: 0 }, 'dock', true),
  );
  d.push(
    door('exit-south', { x: 31, y: 0 }, { x: 32.2, y: 0 }, 'swing', false),
    door('exit-east', { x: 80, y: 20 }, { x: 80, y: 21.2 }, 'swing', false),
    door('cold-door', { x: 64, y: 8 }, { x: 64, y: 10.5 }, 'sliding', false),
    door('office-door', { x: 12, y: 16 }, { x: 12, y: 17 }, 'swing', true),
    door('cage-gate', { x: 25, y: 14 }, { x: 27, y: 14 }, 'gate', false),
  );
  return d;
}

function nav() {
  const n = new NavBuilder();
  // Main east-west forklift lane (y 18) and a southern lane (y 8) linked by north-south lanes.
  const laneN = [2, 15, 31, 33, 46, 61, 72, 79];
  laneN.forEach((x) => n.node(`ln-${x}`, x, 18));
  n.link(...laneN.map((x) => `ln-${x}`));
  const laneS = [2, 6, 15, 24, 31, 33, 46, 55, 61];
  laneS.forEach((x) => n.node(`ls-${x}`, x, 8));
  n.link(...laneS.map((x) => `ls-${x}`));
  n.link('ls-2', 'ln-2');
  n.link('ls-15', 'ln-15');
  n.link('ls-33', 'ln-33');
  n.link('ls-46', 'ln-46');
  n.link('ls-61', 'ln-61');
  // Docks and trailers.
  DOCKS.forEach((x, i) => {
    const k = i + 1;
    n.node(`dock-${k}`, x, 2).node(`dock-${k}-door`, x, 0).node(`trailer-${k}`, x, -8);
    n.link(`ls-${x}`, `dock-${k}`, `dock-${k}-door`, `trailer-${k}`);
  });
  // Racking: each aisle has an entry at its west end and a node at every bay position.
  for (const [aisle, y] of Object.entries(RACK.aisles)) {
    const ids: string[] = [];
    n.node(`aisle-${aisle}-w`, 33.5, y);
    ids.push(`aisle-${aisle}-w`);
    for (let i = 0; i < RACK.baysPerFace; i++) {
      const id = `aisle-${aisle}-${i + 1}`;
      n.node(id, RACK.x0 + RACK.bayPitch / 2 + i * RACK.bayPitch, y);
      ids.push(id);
    }
    n.link(...ids);
  }
  n.node('rack-spine', 33.5, 18);
  n.link('ln-33', 'rack-spine', 'aisle-A-w', 'aisle-B-w', 'aisle-C-w', 'aisle-D-w');
  // Staging.
  n.node('staging-1', 40, 12).node('staging-2', 50, 12);
  n.link('ls-46', 'staging-1');
  n.link('ls-46', 'staging-2');
  // Cold room through its door.
  n.node('cold-out', 62, 9.2).node('cold-door', 64, 9.2).node('cold-in', 66, 9.2).node('cold-store', 72, 8);
  n.link('ls-61', 'cold-out', 'cold-door', 'cold-in', 'cold-store');
  // Production: buffer and stations.
  n.node('buffer-w', 6, 28.5).node('buffer-e', 22, 28.5);
  n.node('station-1', 7, 36.5).node('station-2', 15, 36.5).node('station-3', 23, 36.5).node('prod-n', 15, 44);
  n.node('prod-entry', 15, 24);
  n.link('ln-15', 'prod-entry', 'buffer-w', 'station-1', 'station-2', 'station-3', 'buffer-e', 'prod-entry');
  n.link('station-2', 'prod-n');
  // Office and battery cage.
  n.node('office-door', 12, 16.5).node('office', 6, 17);
  n.link('ln-15', 'office-door', 'office');
  n.node('cage-gate', 26, 14).node('cage', 26, 17.5);
  n.link('ls-24', 'cage-gate', 'cage');
  // Exits, yard and muster point.
  n.node('exit-south-in', 31.6, 2).node('exit-south', 31.6, 0).node('yard-path', 31.6, -18);
  n.link('ls-31', 'exit-south-in', 'exit-south', 'yard-path');
  n.node('exit-east', 80, 20.6).node('yard-east', 84, 20.6).node('yard-se', 84, -20);
  n.link('ln-79', 'exit-east', 'yard-east', 'yard-se');
  n.node('muster', 71, -34);
  n.link('yard-path', 'muster', 'yard-se');
  // Yard tractor loop and trailer parking.
  n.node('yard-1', 10, -22).node('yard-2', 44, -24).node('yard-3', 58, -24).node('yard-4', 58, -14);
  n.link('yard-path', 'yard-1', 'yard-2', 'yard-3', 'yard-4', 'yard-path');
  DOCKS.forEach((_, i) => n.link(`trailer-${i + 1}`, 'yard-1'));
  return n.build();
}

function devices(): InfraDeviceDef[] {
  const d: InfraDeviceDef[] = [];
  let k = 0;
  // AoA locators over the racking: one row above every aisle and one above each outer rack face, 7.5 m
  // apart, 10.5 m up (hall 11 m, racks about 9 m). Top-level pallets sit only about 2 m below the ceiling,
  // so every rack face needs locators close by for full coverage at all five levels.
  const outerFaces = [(RACK.aisles.A ?? 0) - RACK.faceOffset, (RACK.aisles.D ?? 0) + RACK.faceOffset];
  for (const x of [37, 44.5, 52, 59.5, 67, 74.5]) {
    for (const y of [...Object.values(RACK.aisles), ...outerFaces]) {
      d.push({
        id: `lon2-r${++k}`,
        model: 'ZENIX LON-2',
        kind: 'locator',
        position: vec3(x, y, 10.5),
        mount: 'ceiling',
        power: 'poe',
      });
    }
  }
  k = 0;
  for (const x of [7, 15, 23]) {
    for (const y of [30, 42]) {
      d.push({
        id: `lon2-p${++k}`,
        model: 'ZENIX LON-2',
        kind: 'locator',
        position: vec3(x, y, 9),
        mount: 'ceiling',
        power: 'poe',
      });
    }
  }
  // ZENIX LEN-2 gateways for general coverage and climate: a grid about 14 m apart at 6 m height. The one
  // at (74, 6) sits inside the cold room (lower ceiling) and also reports its climate.
  const len2: Array<[string, number, number, number]> = [];
  for (const y of [6, 20, 34, 46]) {
    for (const x of [6, 20, 34, 48, 62, 74]) len2.push([`len2-${x}-${y}`, x, y, x === 74 && y === 6 ? 4 : 6]);
  }
  for (const [id, x, y, z] of len2) {
    d.push({
      id,
      model: 'ZENIX LEN-2',
      kind: 'gateway',
      position: vec3(x, y, z),
      mount: 'ceiling',
      power: 'poe',
    });
  }
  // NODIX CEN-1 on each dock door header and at the cold room entrance: short-range zone check-in and out.
  const gate = { enterDbm: -72, exitDbm: -75, validateS: 1, filterAlpha: 0.5 };
  DOCKS.forEach((x, i) => {
    d.push({
      id: `cen-dock-${i + 1}`,
      model: 'NODIX CEN-1',
      kind: 'anchor',
      position: vec3(x, 0.6, 3.2),
      mount: 'header',
      roomId: `dock-${i + 1}`,
      bilink: gate,
      power: 'battery',
    });
  });
  d.push({
    id: 'cen-cold',
    model: 'NODIX CEN-1',
    kind: 'anchor',
    position: vec3(65, 9.2, 3),
    mount: 'wall',
    roomId: 'cold-entry',
    bilink: gate,
    power: 'battery',
  });
  // Outdoor gateway on a yard pole.
  d.push({
    id: 'lef3-yard',
    model: 'ZENIX LEF-3',
    kind: 'gateway',
    position: vec3(40, -18, 6),
    mount: 'pole',
    power: 'poe',
  });
  return d;
}

function assetsAndTags(): { assets: AssetDef[]; tags: TagDef[] } {
  const assets: AssetDef[] = [];
  const tags: TagDef[] = [];
  const tow1 = (a: AssetDef, h = 0.9) => {
    assets.push(a);
    tags.push({
      id: `tag-${a.id}`,
      model: 'PINIX TOW-1',
      carrier: { type: 'asset', id: a.id },
      mountHeightM: h,
    });
  };
  // The pallet from W1, and other tagged pallets in racks, staging and receiving.
  const w1: RackSlot = { aisle: 'C', bay: 14, level: 4 };
  tow1({ id: 'pallet-2291', cls: 'pallet', position: slotPosition(w1), slot: w1 });
  const rng = new Rng('warehouse-pallets');
  const used = new Set(['C-14-4']);
  for (let i = 1; i <= 24; i++) {
    let slot: RackSlot;
    let key: string;
    do {
      slot = { aisle: rng.pick(['A', 'B', 'C', 'D']), bay: rng.int(1, 30), level: rng.int(1, 5) };
      key = `${slot.aisle}-${slot.bay}-${slot.level}`;
    } while (used.has(key));
    used.add(key);
    tow1({ id: `pallet-22${String(i).padStart(2, '0')}`, cls: 'pallet', position: slotPosition(slot), slot });
  }
  [
    [38, 5],
    [42, 5],
    [46, 5],
    [50, 5],
  ].forEach(([x, y], i) =>
    tow1({ id: `pallet-23${i + 1}0`, cls: 'pallet', position: vec3(x as number, y as number, 0) }),
  );
  tow1({ id: 'pallet-2401', cls: 'pallet', position: vec3(12, 8.5, 0) });
  tow1({ id: 'pallet-2402', cls: 'pallet', position: vec3(18, 8.5, 0) });
  // Cold pallets with multi-sensor tags: three in the cold room, one on the truck at dock 3.
  const cold: Array<[string, Vec3]> = [
    ['cold-pallet-01', vec3(70, 5, 0)],
    ['cold-pallet-02', vec3(73, 5, 0)],
    ['cold-pallet-03', vec3(76, 12, 0)],
    ['cold-pallet-04', vec3(24, -6, 0)],
  ];
  for (const [id, p] of cold) {
    assets.push({ id, cls: 'cold_pallet', position: p });
    tags.push({
      id: `tag-${id}`,
      model: 'PINIX TOW-5',
      carrier: { type: 'asset', id },
      mountHeightM: 0.9,
      sensors: ['temperature', 'humidity'],
    });
  }
  // WIP carriers in production: two in circulation (pushed by the assembly workers), four waiting in the
  // line-side buffer.
  [
    [6, 28.5],
    [22, 28.5],
    [9, 28.5],
    [12, 28.5],
    [15, 28.5],
    [18, 28.5],
  ].forEach(([x, y], i) =>
    tow1({ id: `wip-0${i + 1}`, cls: 'wip_carrier', position: vec3(x as number, y as number, 0) }, 0.8),
  );
  // Trailers: three docked, three parked in the yard. Each carries an asset tag on the outside of its nose
  // (a tag inside the metal box would not be heard). The asset position is the nose.
  DOCKS.forEach((x, i) =>
    tow1({ id: `trailer-0${i + 1}`, cls: 'trailer', position: vec3(x, -14.4, 0), headingDeg: 90 }, 3),
  );
  [44, 50, 56].forEach((x, i) =>
    tow1({ id: `trailer-0${i + 4}`, cls: 'trailer', position: vec3(x, -30, 0), headingDeg: 90 }, 3),
  );
  return { assets, tags };
}

function agents(): { agents: AgentDef[]; tags: TagDef[] } {
  const a: AgentDef[] = [
    {
      id: 'forklift-1',
      role: 'forklift',
      kind: 'vehicle',
      start: 'dock-1',
      routine: [
        { to: 'dock-1', dwellS: 15 },
        { to: 'aisle-A-5', dwellS: 10 },
        { to: 'staging-1', dwellS: 10 },
      ],
    },
    {
      id: 'forklift-2',
      role: 'forklift',
      kind: 'vehicle',
      start: 'staging-2',
      routine: [
        { to: 'aisle-C-7', dwellS: 12 },
        { to: 'staging-2', dwellS: 12 },
        { to: 'aisle-D-11', dwellS: 12 },
      ],
    },
    {
      id: 'forklift-3',
      role: 'forklift',
      kind: 'vehicle',
      start: 'dock-3',
      routine: [
        { to: 'dock-3', dwellS: 20 },
        { to: 'cold-out', dwellS: 10 },
        { to: 'staging-1', dwellS: 10 },
      ],
    },
    { id: 'driver-1', role: 'forklift_driver', kind: 'person', start: 'dock-1', rideOn: 'forklift-1' },
    { id: 'driver-2', role: 'forklift_driver', kind: 'person', start: 'staging-2', rideOn: 'forklift-2' },
    { id: 'driver-3', role: 'forklift_driver', kind: 'person', start: 'dock-3', rideOn: 'forklift-3' },
    {
      id: 'picker-1',
      role: 'picker',
      kind: 'person',
      start: 'staging-1',
      routine: [
        { to: 'aisle-A-9', dwellS: 25 },
        { to: 'staging-1', dwellS: 15 },
      ],
    },
    {
      id: 'picker-2',
      role: 'picker',
      kind: 'person',
      start: 'staging-2',
      routine: [
        { to: 'aisle-B-12', dwellS: 25 },
        { to: 'staging-2', dwellS: 15 },
      ],
    },
    {
      id: 'picker-3',
      role: 'picker',
      kind: 'person',
      start: 'staging-1',
      routine: [
        { to: 'aisle-C-4', dwellS: 25 },
        { to: 'staging-1', dwellS: 20 },
      ],
    },
    {
      id: 'picker-4',
      role: 'picker',
      kind: 'person',
      start: 'staging-2',
      routine: [
        { to: 'aisle-D-14', dwellS: 25 },
        { to: 'staging-2', dwellS: 20 },
      ],
    },
    {
      id: 'assembly-1',
      role: 'assembly',
      kind: 'person',
      start: 'buffer-w',
      routine: [
        { to: 'buffer-w', pickup: 'wip-01', dwellS: 5 },
        { to: 'station-1', dwellS: 60 },
        { to: 'station-2', dwellS: 60 },
        { to: 'station-3', dwellS: 60 },
        { to: 'buffer-e', dwellS: 5 },
        { to: 'buffer-w', drop: 'wip-01', dropAt: vec3(6, 28.5, 0), dwellS: 20 },
      ],
    },
    {
      id: 'assembly-2',
      role: 'assembly',
      kind: 'person',
      start: 'buffer-e',
      routine: [
        { to: 'buffer-e', pickup: 'wip-02', dwellS: 5 },
        { to: 'buffer-w', dwellS: 5 },
        { to: 'station-1', dwellS: 50 },
        { to: 'station-2', dwellS: 70 },
        { to: 'station-3', dwellS: 50 },
        { to: 'buffer-e', drop: 'wip-02', dropAt: vec3(22, 28.5, 0), dwellS: 30 },
      ],
    },
    {
      id: 'yard-tractor',
      role: 'yard_tractor',
      kind: 'vehicle',
      start: 'yard-2',
      routine: [
        { to: 'yard-3', dwellS: 20 },
        { to: 'yard-4', dwellS: 5 },
        { to: 'yard-1', dwellS: 20 },
      ],
    },
  ];
  const tags: TagDef[] = [];
  for (const x of a) {
    if (x.role === 'forklift') {
      tags.push({
        id: `tag-${x.id}`,
        model: 'PINIX TOW-1',
        carrier: { type: 'agent', id: x.id },
        mountHeightM: 2.2,
      });
    } else if (x.kind === 'person') {
      tags.push({
        id: `tag-${x.id}`,
        model: 'PINIX TOB-1',
        carrier: { type: 'agent', id: x.id },
        mountHeightM: 1.0,
        sosButton: true,
      });
    }
  }
  return { agents: a, tags };
}

const workerRoles = ['forklift_driver', 'picker', 'assembly'] as const;

function rules(): RuleDef[] {
  const r: RuleDef[] = DOCKS.map((_, i) => ({
    id: `gate-dock-${i + 1}`,
    type: 'gate',
    gateZoneId: `dock-${i + 1}`,
    insideZoneIds: ['hall'],
    outsideZoneIds: ['yard'],
    appliesTo: ['pallet', 'cold_pallet'],
  }));
  r.push(
    {
      id: 'gate-cold',
      type: 'gate',
      gateZoneId: 'cold-entry',
      insideZoneIds: ['cold'],
      outsideZoneIds: ['receiving', 'staging'],
      appliesTo: ['pallet', 'cold_pallet'],
    },
    // Only forklift drivers are authorised in the battery charging cage.
    { id: 'cage', type: 'geofence', zoneId: 'cage', appliesTo: ['picker', 'assembly'] },
    {
      id: 'dwell-station-1',
      type: 'dwell',
      zoneId: 'station-1',
      maxS: 150,
      appliesTo: ['wip_carrier'],
      mode: 'inside',
    },
    {
      id: 'dwell-station-2',
      type: 'dwell',
      zoneId: 'station-2',
      maxS: 150,
      appliesTo: ['wip_carrier'],
      mode: 'inside',
    },
    {
      id: 'dwell-station-3',
      type: 'dwell',
      zoneId: 'station-3',
      maxS: 150,
      appliesTo: ['wip_carrier'],
      mode: 'inside',
    },
    {
      id: 'cold-chain',
      type: 'dwell',
      zoneId: 'cold',
      maxS: 300,
      appliesTo: ['cold_pallet'],
      mode: 'outside',
      withinZoneId: 'hall',
    },
    { id: 'muster', type: 'muster', zoneId: 'muster', roles: [...workerRoles] },
    { id: 'sos', type: 'sos' },
  );
  for (let i = 1; i <= 4; i++) {
    r.push({
      id: `cold-pallet-0${i}-temp`,
      type: 'sensor',
      tagId: `tag-cold-pallet-0${i}`,
      metric: 'temperature',
      max: 8,
    });
  }
  return r;
}

export function warehouseWorld(): WorldDef {
  const at = assetsAndTags();
  const ag = agents();
  return {
    id: 'warehouse',
    bounds: { min: { x: -10, y: -45 }, max: { x: 90, y: 50 } },
    zones: zones(),
    walls: walls(),
    doors: doors(),
    nav: nav(),
    devices: devices(),
    assets: at.assets,
    tags: [...at.tags, ...ag.tags],
    agents: ag.agents,
    sensors: at.assets
      .filter((a) => a.cls === 'cold_pallet')
      // The truck at dock 3 is a reefer: its trailer keeps cold pallets cold.
      .map((a) => ({
        id: `${a.id}-thermal`,
        kind: 'coldPallet' as const,
        assetId: a.id,
        coldZoneIds: ['cold', 'trailer-dock-3'],
      })),
    rules: rules(),
    figures: [],
  };
}
