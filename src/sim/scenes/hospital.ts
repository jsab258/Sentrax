import { door, hWall, NavBuilder, vWall } from '../builder';
import { rect, vec3 } from '../geometry';
import type {
  AgentDef,
  AssetDef,
  FigureDef,
  InfraDeviceDef,
  RuleDef,
  TagDef,
  WallDef,
  WorldDef,
  ZoneDef,
} from '../world';

/**
 * Hospital ward (SPEC section 7), about 40 x 20 m. x runs east, y north.
 *
 *   y 13-20  patient rooms 101 to 106 (bathroom pod by the corridor, bed by the window)
 *   y 10-13  corridor spine, ending east in the elevator lobby (ward exit, geofence edge)
 *   y  0-10  ICU (2 bed bays), clean utility and equipment storage, dirty utility, medication room,
 *            nurse station (open counter to the corridor)
 *
 * Room anchors sit on the ceiling over the bed or work area, away from the door, so the line of sight
 * from anchor to corridor runs through the wall. All positions are illustrative.
 */

const H = 2.8;
const ROOM_W = 34 / 6;
const roomNumbers = ['101', '102', '103', '104', '105', '106'] as const;
const roomX0 = (i: number) => i * ROOM_W;

const south = {
  icu: { x0: 0, x1: 11, door: [8, 10] as const },
  storage: { x0: 11, x1: 17.5, door: [11.6, 12.8] as const },
  dirty: { x0: 17.5, x1: 21.5, door: [18, 19.2] as const },
  med: { x0: 21.5, x1: 26.5, door: [22, 23.2] as const },
  station: { x0: 26.5, x1: 34 },
};

function zones(): ZoneDef[] {
  const z: ZoneDef[] = [
    { id: 'corridor', kind: 'corridor', polygon: rect(0, 10, 34, 13) },
    { id: 'icu', kind: 'room', polygon: rect(south.icu.x0, 0, south.icu.x1, 10), tags: ['icu'] },
    { id: 'icu-bay-a', kind: 'area', polygon: rect(0.2, 0.2, 5.4, 6.5), parent: 'icu', tags: ['icu'] },
    { id: 'icu-bay-b', kind: 'area', polygon: rect(5.6, 0.2, 10.8, 6.5), parent: 'icu', tags: ['icu'] },
    {
      id: 'storage',
      kind: 'room',
      polygon: rect(south.storage.x0, 0, south.storage.x1, 10),
      tags: ['storage'],
    },
    { id: 'dirty', kind: 'room', polygon: rect(south.dirty.x0, 0, south.dirty.x1, 10), tags: ['utility'] },
    { id: 'med', kind: 'room', polygon: rect(south.med.x0, 0, south.med.x1, 10), tags: ['medication'] },
    {
      id: 'station',
      kind: 'area',
      polygon: rect(south.station.x0, 0, south.station.x1, 10),
      tags: ['station'],
    },
    { id: 'lobby', kind: 'room', polygon: rect(34, 4, 40, 17), tags: ['lobby', 'exit'] },
  ];
  roomNumbers.forEach((n, i) => {
    const x0 = roomX0(i);
    z.push({ id: `r${n}`, kind: 'room', polygon: rect(x0, 13, x0 + ROOM_W, 20), tags: ['patient'] });
    z.push({
      id: `r${n}-bath`,
      kind: 'area',
      polygon: rect(x0 + 3.3, 13, x0 + ROOM_W, 15.5),
      parent: `r${n}`,
    });
  });
  return z;
}

function walls(): WallDef[] {
  const w: WallDef[] = [];
  const roomDoors = roomNumbers.map((_, i) => [roomX0(i) + 0.8, roomX0(i) + 2.0] as [number, number]);
  // Exterior and corridor walls.
  w.push(...hWall('ext-s', 0, 0, 34, 'concrete', H));
  w.push(...hWall('ext-n', 20, 0, 34, 'concrete', H));
  w.push(...vWall('ext-w', 0, 0, 20, 'concrete', H));
  w.push(...vWall('ext-e-south', 34, 0, 4, 'concrete', H));
  w.push(...vWall('ext-e-station', 34, 4, 10, 'concrete', H));
  w.push(...vWall('ext-e-corridor', 34, 10, 13, 'concrete', H, [[10.5, 12.5]]));
  w.push(...vWall('ext-e-north', 34, 13, 20, 'concrete', H));
  w.push(...hWall('corr-n', 13, 0, 34, 'concrete', H, roomDoors));
  w.push(
    ...hWall('corr-s', 10, 0, south.station.x0, 'concrete', H, [
      south.icu.door,
      south.storage.door,
      south.dirty.door,
      south.med.door,
    ]),
  );
  // Room separators.
  for (let i = 1; i < 6; i++) w.push(...vWall(`sep-n${i}`, roomX0(i), 13, 20, 'concrete', H));
  for (const x of [south.icu.x1, south.storage.x1, south.dirty.x1, south.med.x1]) {
    w.push(...vWall(`sep-s${x}`, x, 0, 10, 'concrete', H));
  }
  // Bathroom pods (drywall), door facing the room.
  roomNumbers.forEach((n, i) => {
    const x0 = roomX0(i);
    w.push(...vWall(`bath-w-${n}`, x0 + 3.3, 13, 15.5, 'drywall', H, [[13.8, 14.6]]));
    w.push(...hWall(`bath-n-${n}`, 15.5, x0 + 3.3, x0 + ROOM_W, 'drywall', H));
  });
  // ICU: glass partition between the two bed bays.
  w.push(...vWall('icu-glass', 5.5, 0, 6.5, 'glass', H));
  // Elevator lobby.
  w.push(...hWall('lobby-s', 4, 34, 40, 'concrete', H));
  w.push(...hWall('lobby-n', 17, 34, 40, 'concrete', H));
  w.push(
    ...vWall('lobby-e', 40, 4, 17, 'concrete', H, [
      [7, 8.2],
      [12, 13.2],
    ]),
  );
  return w;
}

function doors() {
  const d = roomNumbers.map((n, i) =>
    door(`door-r${n}`, { x: roomX0(i) + 0.8, y: 13 }, { x: roomX0(i) + 2.0, y: 13 }, 'swing', true),
  );
  d.push(
    door('door-icu', { x: south.icu.door[0], y: 10 }, { x: south.icu.door[1], y: 10 }, 'double', true),
    door(
      'door-storage',
      { x: south.storage.door[0], y: 10 },
      { x: south.storage.door[1], y: 10 },
      'swing',
      true,
    ),
    door('door-dirty', { x: south.dirty.door[0], y: 10 }, { x: south.dirty.door[1], y: 10 }, 'swing', true),
    door('door-med', { x: south.med.door[0], y: 10 }, { x: south.med.door[1], y: 10 }, 'swing', false),
    door(
      'door-station',
      { x: south.station.x0 + 0.5, y: 10 },
      { x: south.station.x1 - 0.5, y: 10 },
      'opening',
      true,
    ),
    door('door-ward-exit', { x: 34, y: 10.5 }, { x: 34, y: 12.5 }, 'double', true),
    door('door-elevator-1', { x: 40, y: 7 }, { x: 40, y: 8.2 }, 'elevator', false),
    door('door-elevator-2', { x: 40, y: 12 }, { x: 40, y: 13.2 }, 'elevator', false),
  );
  return d;
}

function nav() {
  const n = new NavBuilder();
  // Corridor spine: one node in front of every door, linked west to east.
  const spine: Array<{ id: string; x: number }> = [{ id: 'c-west', x: 0.8 }];
  roomNumbers.forEach((num, i) => spine.push({ id: `c-r${num}`, x: roomX0(i) + 1.4 }));
  spine.push(
    { id: 'c-icu', x: 9 },
    { id: 'c-storage', x: 12.2 },
    { id: 'c-dirty', x: 18.6 },
    { id: 'c-med', x: 22.6 },
    { id: 'c-station', x: 30 },
    { id: 'c-east', x: 33.2 },
  );
  spine.sort((a, b) => a.x - b.x);
  for (const s of spine) n.node(s.id, s.x, 11.5);
  n.link(...spine.map((s) => s.id));

  roomNumbers.forEach((num, i) => {
    const x0 = roomX0(i);
    n.node(`r${num}-door`, x0 + 1.4, 13)
      .node(`r${num}-in`, x0 + 1.6, 16.2)
      .node(`r${num}-bed`, x0 + 2.0, 18.3)
      .node(`r${num}-bath`, x0 + 4.5, 14.2);
    n.link(`c-r${num}`, `r${num}-door`, `r${num}-in`, `r${num}-bed`);
    n.link(`r${num}-in`, `r${num}-bath`);
  });

  n.node('icu-door', 9, 10).node('icu-c', 7.5, 8.2).node('icu-bay-a', 3.2, 4.2).node('icu-bay-b', 8.4, 4.2);
  n.node('icu-alcove', 1.2, 8.8).node('icu-bay-a-head', 3.6, 1.8).node('icu-bay-b-head', 8.8, 1.8);
  n.link('icu-bay-a', 'icu-bay-a-head');
  n.link('icu-bay-b', 'icu-bay-b-head');
  n.link('c-icu', 'icu-door', 'icu-c', 'icu-bay-a');
  n.link('icu-c', 'icu-bay-b');
  n.link('icu-c', 'icu-alcove');

  n.node('storage-door', 12.2, 10).node('storage-in', 13.4, 7.5).node('storage-park', 15.5, 3.5);
  n.link('c-storage', 'storage-door', 'storage-in', 'storage-park');

  n.node('dirty-door', 18.6, 10).node('dirty-in', 19.5, 6);
  n.link('c-dirty', 'dirty-door', 'dirty-in');

  n.node('med-door', 22.6, 10).node('med-in', 23.5, 6.5).node('med-fridge', 25, 2.5);
  n.link('c-med', 'med-door', 'med-in', 'med-fridge');

  n.node('station', 30, 7.2).node('station-desk', 28.5, 5);
  n.link('c-station', 'station', 'station-desk');

  n.node('exit-door', 34, 11.5)
    .node('lobby', 37, 11)
    .node('elevator-1', 39.2, 7.6)
    .node('elevator-2', 39.2, 12.6);
  n.link('c-east', 'exit-door', 'lobby', 'elevator-1');
  n.link('lobby', 'elevator-2');
  return n.build();
}

function devices(): InfraDeviceDef[] {
  const d: InfraDeviceDef[] = [];
  roomNumbers.forEach((num, i) => {
    d.push({
      id: `cen-r${num}`,
      model: 'NODIX CEN-1',
      kind: 'anchor',
      position: vec3(roomX0(i) + 4.4, 17.3, 2.7),
      mount: 'ceiling',
      roomId: `r${num}`,
      power: 'battery',
    });
  });
  const bigRoom = { enterDbm: -80, exitDbm: -85 };
  d.push(
    {
      id: 'cen-icu',
      model: 'NODIX CEN-1',
      kind: 'anchor',
      position: vec3(4, 3.5, 2.9),
      mount: 'ceiling',
      roomId: 'icu',
      bilink: { enterDbm: -83, exitDbm: -87, validateS: 3 },
      power: 'battery',
    },
    {
      id: 'cen-storage',
      model: 'NODIX CEN-1',
      kind: 'anchor',
      position: vec3(15.8, 3.2, 2.7),
      mount: 'ceiling',
      roomId: 'storage',
      bilink: bigRoom,
      power: 'battery',
    },
    {
      id: 'cen-dirty',
      model: 'NODIX CEN-1',
      kind: 'anchor',
      position: vec3(20.4, 3, 2.7),
      mount: 'ceiling',
      roomId: 'dirty',
      bilink: bigRoom,
      power: 'battery',
    },
    {
      id: 'cen-med',
      model: 'NODIX CEN-1',
      kind: 'anchor',
      position: vec3(25.3, 3.5, 2.7),
      mount: 'ceiling',
      roomId: 'med',
      bilink: bigRoom,
      power: 'battery',
    },
    {
      id: 'cen-lobby',
      model: 'NODIX CEN-1',
      kind: 'anchor',
      position: vec3(38, 6.5, 2.7),
      mount: 'ceiling',
      roomId: 'lobby',
      bilink: { enterDbm: -82, exitDbm: -86 },
      power: 'battery',
    },
    {
      id: 'len1-west',
      model: 'ZENIX LEN-1',
      kind: 'gateway',
      position: vec3(8.5, 11.5, 2.8),
      mount: 'ceiling',
      power: 'poe',
    },
    {
      id: 'len1-east',
      model: 'ZENIX LEN-1',
      kind: 'gateway',
      position: vec3(27, 11.5, 2.8),
      mount: 'ceiling',
      power: 'poe',
    },
    {
      id: 'len2-med',
      model: 'ZENIX LEN-2',
      kind: 'gateway',
      // On the west wall of the medication room (wall face at x 21.6).
      position: vec3(21.6, 1.2, 2.2),
      mount: 'wall',
      relayTarget: false,
      power: 'poe',
    },
  );
  // AoA locators over the ICU bed bays and the central area (hybrid: bed-bay level in the ICU). With a
  // 2.9 m ceiling each locator covers about 5 m around it, so every parking spot sees at least two.
  [
    [2.7, 1.8],
    [8.3, 1.8],
    [2.7, 6.0],
    [8.3, 6.0],
    [5.5, 8.6],
  ].forEach(([x, y], i) => {
    d.push({
      id: `lon2-icu-${i + 1}`,
      model: 'ZENIX LON-2',
      kind: 'locator',
      position: vec3(x as number, y as number, 2.9),
      mount: 'ceiling',
      power: 'poe',
    });
  });
  return d;
}

function assetsAndTags(): { assets: AssetDef[]; tags: TagDef[] } {
  const assets: AssetDef[] = [];
  const tags: TagDef[] = [];
  const add = (a: AssetDef, mountHeightM = 1.0) => {
    assets.push(a);
    tags.push({
      id: `tag-${a.id}`,
      model: 'PINIX TOW-1',
      carrier: { type: 'asset', id: a.id },
      mountHeightM,
    });
  };
  // Infusion pumps: six in the ICU (PAR 6), P-07 in room 104, P-08 in room 106. Storage is empty.
  const icuPumps: Array<[number, number]> = [
    [1.4, 2.2],
    [1.4, 3.2],
    [4.6, 5.6],
    [6.6, 2.2],
    [6.6, 3.2],
    [9.8, 5.6],
  ];
  icuPumps.forEach(([x, y], i) =>
    add({ id: `pump-0${i + 1}`, cls: 'infusion_pump', position: vec3(x, y, 0) }),
  );
  add({ id: 'pump-07', cls: 'infusion_pump', position: vec3(roomX0(3) + 4.2, 18.8, 0) });
  add({ id: 'pump-08', cls: 'infusion_pump', position: vec3(roomX0(5) + 4.2, 18.8, 0) });
  // Ventilators: three in the ICU (PAR 3).
  add({ id: 'vent-01', cls: 'ventilator', position: vec3(4.4, 1.2, 0) });
  add({ id: 'vent-02', cls: 'ventilator', position: vec3(9.6, 1.2, 0) });
  add({ id: 'vent-03', cls: 'ventilator', position: vec3(3.0, 8.6, 0) });
  // Wheelchairs: two parked in storage, one in the lobby.
  add({ id: 'wheelchair-01', cls: 'wheelchair', position: vec3(16.6, 1.2, 0) });
  add({ id: 'wheelchair-02', cls: 'wheelchair', position: vec3(16.6, 2.4, 0) });
  add({ id: 'wheelchair-03', cls: 'wheelchair', position: vec3(35.5, 8.5, 0) });
  // Crash cart in the corridor by the nurse station; mobile monitors in the ICU and room 103.
  add({ id: 'crashcart-01', cls: 'crash_cart', position: vec3(26, 12.6, 0) });
  add({ id: 'monitor-01', cls: 'mobile_monitor', position: vec3(4.5, 8.8, 0) });
  add({ id: 'monitor-02', cls: 'mobile_monitor', position: vec3(roomX0(2) + 4.25, 19.3, 0) });
  // Medication fridge with a multi-sensor tag.
  assets.push({ id: 'fridge-01', cls: 'fridge', position: vec3(26, 1.2, 0) });
  tags.push({
    id: 'tag-fridge-01',
    model: 'PINIX TOW-5',
    carrier: { type: 'asset', id: 'fridge-01' },
    mountHeightM: 1.7,
    sensors: ['temperature', 'humidity'],
  });
  return { assets, tags };
}

function agents(): { agents: AgentDef[]; tags: TagDef[] } {
  const a: AgentDef[] = [
    {
      id: 'nurse-1',
      role: 'nurse',
      kind: 'person',
      start: 'station',
      routine: [
        { to: 'r101-bed', dwellS: 40 },
        { to: 'r102-bed', dwellS: 30 },
        { to: 'station', dwellS: 20 },
        { to: 'med-in', dwellS: 25 },
        { to: 'station', dwellS: 30 },
      ],
    },
    {
      id: 'nurse-2',
      role: 'nurse',
      kind: 'person',
      start: 'station-desk',
      routine: [
        { to: 'r103-bed', dwellS: 30 },
        { to: 'r104-bed', dwellS: 40 },
        { to: 'r105-bed', dwellS: 30 },
        { to: 'station-desk', dwellS: 30 },
      ],
    },
    {
      id: 'nurse-3',
      role: 'nurse',
      kind: 'person',
      start: 'icu-c',
      routine: [
        { to: 'icu-bay-a', dwellS: 40 },
        { to: 'icu-bay-b', dwellS: 40 },
        { to: 'station', dwellS: 20 },
        { to: 'r106-bed', dwellS: 30 },
      ],
    },
    {
      id: 'biomed',
      role: 'biomed',
      kind: 'person',
      start: 'storage-in',
      routine: [
        { to: 'storage-park', dwellS: 40 },
        { to: 'dirty-in', dwellS: 30 },
        { to: 'icu-c', dwellS: 20 },
      ],
    },
    {
      id: 'porter',
      role: 'porter',
      kind: 'person',
      start: 'lobby',
      routine: [
        { to: 'lobby', dwellS: 30 },
        { to: 'storage-in', dwellS: 20 },
        { to: 'c-west', dwellS: 10 },
      ],
    },
  ];
  const tags: TagDef[] = a.map((x) => ({
    id: `tag-${x.id}`,
    model: 'PINIX TOK-1',
    carrier: { type: 'agent', id: x.id },
    mountHeightM: 1.3,
  }));
  // Nurse 3 also wears the SOS wearable (H5).
  tags.push({
    id: 'tag-sos-nurse-3',
    model: 'PINIX TOB-1',
    carrier: { type: 'agent', id: 'nurse-3' },
    mountHeightM: 1.0,
    sosButton: true,
  });
  return { agents: a, tags };
}

function figures(): FigureDef[] {
  const f: FigureDef[] = roomNumbers.map((n, i) => ({
    id: `patient-${n}`,
    kind: 'patient',
    position: vec3(roomX0(i) + 3.2, 18.3, 0.6),
    headingDeg: 90,
  }));
  f.push(
    { id: 'patient-icu-a', kind: 'patient', position: vec3(2.8, 1.6, 0.6), headingDeg: 270 },
    { id: 'patient-icu-b', kind: 'patient', position: vec3(8, 1.6, 0.6), headingDeg: 270 },
  );
  return f;
}

const rules: RuleDef[] = [
  { id: 'par-icu-ventilators', type: 'par', zoneId: 'icu', cls: 'ventilator', min: 3 },
  { id: 'par-icu-pumps', type: 'par', zoneId: 'icu', cls: 'infusion_pump', min: 6 },
  { id: 'fridge-temperature', type: 'sensor', tagId: 'tag-fridge-01', metric: 'temperature', max: 8, min: 2 },
  { id: 'sos', type: 'sos' },
  {
    id: 'ward-exit',
    type: 'geofence',
    zoneId: 'lobby',
    appliesTo: ['infusion_pump', 'ventilator', 'mobile_monitor', 'crash_cart'],
  },
];

export function hospitalWorld(): WorldDef {
  const at = assetsAndTags();
  const ag = agents();
  return {
    id: 'hospital',
    bounds: { min: { x: 0, y: 0 }, max: { x: 40, y: 20 } },
    zones: zones(),
    walls: walls(),
    doors: doors(),
    nav: nav(),
    devices: devices(),
    assets: at.assets,
    tags: [...at.tags, ...ag.tags],
    agents: ag.agents,
    sensors: [{ id: 'fridge-01-thermal', kind: 'fridge', assetId: 'fridge-01', doorId: 'fridge-01-door' }],
    rules,
    figures: figures(),
  };
}
