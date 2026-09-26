import { door, hWall, NavBuilder, vWall } from '../builder';
import { rect, vec3 } from '../geometry';
import { Rng } from '../rng';
import type {
  AgentDef,
  AssetDef,
  InfraDeviceDef,
  RuleDef,
  TagDef,
  WallDef,
  WorldDef,
  ZoneDef,
} from '../world';

/**
 * Small layouts used by the engine tests (SPEC section 6) and selectable in the 2D debug view.
 * They isolate one technology each so its error can be measured against ground truth.
 */

function emptyWorld(id: string, w: number, h: number): WorldDef {
  return {
    id,
    bounds: { min: { x: 0, y: 0 }, max: { x: w, y: h } },
    zones: [],
    walls: [],
    doors: [],
    nav: { nodes: [], edges: [] },
    devices: [],
    assets: [],
    tags: [],
    agents: [],
    sensors: [],
    rules: [],
    figures: [],
  };
}

/** Static asset with a tag, placed at (x, y). */
function taggedAsset(id: string, x: number, y: number, z = 0): { asset: AssetDef; tag: TagDef } {
  return {
    asset: { id, cls: 'pallet', position: vec3(x, y, z) },
    tag: { id: `tag-${id}`, model: 'PINIX TOW-1', carrier: { type: 'asset', id }, mountHeightM: 1.0 },
  };
}

/** Open 60 x 40 m hall with ZENIX LEN-2 gateways on a 15 m grid, static tags and walking people. */
export function rssiHall(seed = 7, tagCount = 30): WorldDef {
  const w = emptyWorld('test-rssi', 60, 40);
  w.zones.push({ id: 'hall', kind: 'area', polygon: rect(0, 0, 60, 40), tags: ['hall'] });
  let i = 0;
  for (const x of [7.5, 22.5, 37.5, 52.5]) {
    for (const y of [5, 20, 35]) {
      w.devices.push({
        id: `gw${++i}`,
        model: 'ZENIX LEN-2',
        kind: 'gateway',
        position: vec3(x, y, 6),
        mount: 'ceiling',
        power: 'poe',
      });
    }
  }
  const rng = new Rng(seed);
  for (let k = 0; k < tagCount; k++) {
    const { asset, tag } = taggedAsset(`a${k}`, rng.range(4, 56), rng.range(4, 36));
    w.assets.push(asset);
    w.tags.push(tag);
  }
  addWalkers(w, rng, 4, { x0: 5, x1: 55, y0: 5, y1: 35 });
  return w;
}

/** 30 x 30 m area with four ZENIX LON-2 locators on a 10 m grid at the given ceiling height. */
export function aoaArea(seed = 11, ceilingM = 4, tagCount = 20): WorldDef {
  const w = emptyWorld('test-aoa', 30, 30);
  w.zones.push({ id: 'area', kind: 'area', polygon: rect(0, 0, 30, 30) });
  w.zones.push({ id: 'coverage', kind: 'area', polygon: rect(8, 8, 22, 22), parent: 'area' });
  let i = 0;
  for (const x of [10, 20]) {
    for (const y of [10, 20]) {
      w.devices.push({
        id: `loc${++i}`,
        model: 'ZENIX LON-2',
        kind: 'locator',
        position: vec3(x, y, ceilingM),
        mount: 'ceiling',
        power: 'poe',
      });
    }
  }
  const rng = new Rng(seed);
  for (let k = 0; k < tagCount; k++) {
    const { asset, tag } = taggedAsset(`a${k}`, rng.range(9, 21), rng.range(9, 21));
    w.assets.push(asset);
    w.tags.push(tag);
  }
  addWalkers(w, rng, 3, { x0: 9, x1: 21, y0: 9, y1: 21 });
  return w;
}

function addWalkers(
  w: WorldDef,
  rng: Rng,
  n: number,
  box: { x0: number; x1: number; y0: number; y1: number },
) {
  const nav = new NavBuilder();
  const ids: string[] = [];
  for (let k = 0; k < 8; k++) {
    const id = `n${k}`;
    nav.node(id, rng.range(box.x0, box.x1), rng.range(box.y0, box.y1));
    ids.push(id);
  }
  for (let a = 0; a < ids.length; a++)
    for (let b = a + 1; b < ids.length; b++) nav.link(ids[a] as string, ids[b] as string);
  w.nav = nav.build();
  for (let k = 0; k < n; k++) {
    const routine = Array.from({ length: 6 }, () => ({ to: rng.pick(ids), dwellS: rng.range(2, 10) }));
    const agent: AgentDef = {
      id: `walker${k}`,
      role: 'picker',
      kind: 'person',
      start: rng.pick(ids),
      routine,
      loop: true,
    };
    w.agents.push(agent);
    w.tags.push({
      id: `tag-walker${k}`,
      model: 'PINIX TOB-1',
      carrier: { type: 'agent', id: agent.id },
      mountHeightM: 1.0,
    });
  }
}

/**
 * Corridor (y 10 to 13) with five rooms on each side, a NODIX CEN-1 in each room and two ZENIX LEN-1
 * gateways in the corridor. Room walls are concrete, doors open onto the corridor.
 */
export function bilinkRooms(): WorldDef {
  const w = emptyWorld('test-bilink', 30, 20);
  const roomW = 6;
  const walls: WallDef[] = [];
  const zones: ZoneDef[] = [{ id: 'corridor', kind: 'corridor', polygon: rect(0, 10, 30, 13) }];
  const nav = new NavBuilder();
  const northDoors: Array<[number, number]> = [];
  const southDoors: Array<[number, number]> = [];
  for (let r = 0; r < 5; r++) {
    const x0 = r * roomW;
    const dx0 = x0 + 0.8;
    const dx1 = dx0 + 1.2;
    northDoors.push([dx0, dx1]);
    southDoors.push([dx0, dx1]);
    for (const side of ['n', 's'] as const) {
      const id = `${side}${r + 1}`;
      const [y0, y1] = side === 'n' ? [13, 20] : [3, 10];
      zones.push({ id, kind: 'room', polygon: rect(x0, y0, x0 + roomW, y1), tags: ['patient'] });
      w.devices.push({
        id: `cen-${id}`,
        model: 'NODIX CEN-1',
        kind: 'anchor',
        // Over the bed area: deep in the room and away from the door, so the line of sight to the
        // corridor runs through the wall rather than the door opening.
        position: vec3(x0 + 4.4, side === 'n' ? 17.3 : 5.7, 2.7),
        mount: 'ceiling',
        roomId: id,
        power: 'battery',
      });
      const doorY = side === 'n' ? 13 : 10;
      w.doors.push(door(`d-${id}`, { x: dx0, y: doorY }, { x: dx1, y: doorY }, 'swing', true));
      const inY = side === 'n' ? 16.5 : 6.5;
      nav
        .node(`${id}-door`, dx0 + 0.6, doorY)
        .node(`${id}-in`, x0 + roomW / 2, inY)
        .node(`c-${id}`, dx0 + 0.6, 11.5);
      nav.link(`c-${id}`, `${id}-door`, `${id}-in`);
    }
    walls.push(
      ...vWall(`wall-x${r}`, x0, 13, 20, 'concrete', 2.8),
      ...vWall(`wall-sx${r}`, x0, 3, 10, 'concrete', 2.8),
    );
  }
  walls.push(
    ...vWall('wall-x5', 30, 13, 20, 'concrete', 2.8),
    ...vWall('wall-sx5', 30, 3, 10, 'concrete', 2.8),
  );
  walls.push(...hWall('wall-cn', 13, 0, 30, 'concrete', 2.8, northDoors));
  walls.push(...hWall('wall-cs', 10, 0, 30, 'concrete', 2.8, southDoors));
  walls.push(...hWall('wall-n', 20, 0, 30, 'concrete', 2.8), ...hWall('wall-s', 3, 0, 30, 'concrete', 2.8));
  for (let r = 0; r < 4; r++) nav.link(`c-n${r + 1}`, `c-s${r + 1}`, `c-n${r + 2}`);
  nav.link('c-n5', 'c-s5');
  w.walls = walls;
  w.zones = zones;
  w.nav = nav.build();
  w.devices.push(
    {
      id: 'gw-a',
      model: 'ZENIX LEN-1',
      kind: 'gateway',
      position: vec3(7.5, 11.5, 2.8),
      mount: 'ceiling',
      power: 'poe',
    },
    {
      id: 'gw-b',
      model: 'ZENIX LEN-1',
      kind: 'gateway',
      position: vec3(22.5, 11.5, 2.8),
      mount: 'ceiling',
      power: 'poe',
    },
  );
  return w;
}

/** Adds static tags at fixed positions: 3 per room and 10 in the corridor, 5 of them in front of doors. */
export function withBilinkProbeTags(w: WorldDef): WorldDef {
  const rooms = w.zones.filter((z) => z.kind === 'room');
  let k = 0;
  for (const z of rooms) {
    const [a, , c] = z.polygon as [{ x: number; y: number }, unknown, { x: number; y: number }];
    for (const [fx, fy] of [
      [0.3, 0.3],
      [0.7, 0.5],
      [0.5, 0.75],
    ] as const) {
      const { asset, tag } = taggedAsset(`p${k++}`, a.x + (c.x - a.x) * fx, a.y + (c.y - a.y) * fy);
      w.assets.push(asset);
      w.tags.push(tag);
    }
  }
  // Corridor probes, including one right in front of every door (the hardest case for hallway bleed).
  for (const x of [3.5, 8.5, 14.5, 20.5, 26.5, 1.4, 7.4, 13.4, 19.4, 25.4]) {
    const { asset, tag } = taggedAsset(`p${k++}`, x, 11.5);
    w.assets.push(asset);
    w.tags.push(tag);
  }
  return w;
}

/** An ICU-like room with a PAR rule for ventilators and a porter who can move them. */
export function parLayout(): WorldDef {
  const w = bilinkRooms();
  w.zones = w.zones.map((z) => (z.id === 'n3' ? { ...z, tags: ['icu'] } : z));
  for (let v = 1; v <= 3; v++) {
    const id = `vent${v}`;
    w.assets.push({ id, cls: 'ventilator', position: vec3(12.5 + v, 17.5, 0) });
    w.tags.push({ id: `tag-${id}`, model: 'PINIX TOW-1', carrier: { type: 'asset', id }, mountHeightM: 1.0 });
  }
  w.agents.push({ id: 'porter', role: 'porter', kind: 'person', start: 'c-n3' });
  w.tags.push({
    id: 'tag-porter',
    model: 'PINIX TOK-1',
    carrier: { type: 'agent', id: 'porter' },
    mountHeightM: 1.3,
  });
  const rule: RuleDef = { id: 'par-icu-vent', type: 'par', zoneId: 'n3', cls: 'ventilator', min: 3 };
  w.rules.push(rule);
  return w;
}

/**
 * Hall (y 0 to 20) with dock door 1 in the south wall, a dock zone in front of it with a NODIX CEN-1 on
 * the door header, a trailer outside and a yard covered by a ZENIX LEF-3. A forklift carries a pallet.
 */
export function dockLayout(): WorldDef {
  const w = emptyWorld('test-dock', 30, 20);
  w.bounds = { min: { x: 0, y: -30 }, max: { x: 30, y: 20 } };
  w.zones = [
    { id: 'hall', kind: 'area', polygon: rect(0, 0, 30, 20), tags: ['hall', 'building'] },
    { id: 'dock1', kind: 'room', polygon: rect(10.5, 0, 17, 4), parent: 'hall', tags: ['dock'] },
    { id: 'yard', kind: 'outdoor', polygon: rect(0, -30, 30, 0), tags: ['yard'] },
    {
      id: 'trailer1',
      kind: 'outdoor',
      polygon: rect(12, -14, 15.5, -0.5),
      parent: 'yard',
      tags: ['trailer'],
    },
  ];
  w.walls = [
    ...hWall('south', 0, 0, 30, 'concrete', 8, [[12, 15.5]]),
    ...hWall('north', 20, 0, 30, 'concrete', 8),
    ...vWall('west', 0, 0, 20, 'concrete', 8),
    ...vWall('east', 30, 0, 20, 'concrete', 8),
    ...vWall('trailer-w', 12, -14, -0.5, 'metal', 3),
    ...vWall('trailer-e', 15.5, -14, -0.5, 'metal', 3),
    ...hWall('trailer-front', -14, 12, 15.5, 'metal', 3),
  ];
  w.doors = [door('dock-door-1', { x: 12, y: 0 }, { x: 15.5, y: 0 }, 'dock', true)];
  const devices: InfraDeviceDef[] = [
    {
      id: 'cen-dock1',
      model: 'NODIX CEN-1',
      kind: 'anchor',
      position: vec3(13.75, 0.6, 3.2),
      mount: 'header',
      roomId: 'dock1',
      // Dock doors: short-range proximity, validated quickly so a forklift driving through registers.
      bilink: { enterDbm: -73, exitDbm: -78, validateS: 0.5, filterAlpha: 0.6 },
      power: 'battery',
    },
    {
      id: 'len2-a',
      model: 'ZENIX LEN-2',
      kind: 'gateway',
      position: vec3(8, 10, 6),
      mount: 'ceiling',
      power: 'poe',
    },
    {
      id: 'len2-b',
      model: 'ZENIX LEN-2',
      kind: 'gateway',
      position: vec3(22, 10, 6),
      mount: 'ceiling',
      power: 'poe',
    },
    {
      id: 'lef3',
      model: 'ZENIX LEF-3',
      kind: 'gateway',
      position: vec3(20, -12, 6),
      mount: 'pole',
      power: 'poe',
    },
  ];
  w.devices = devices;
  w.nav = new NavBuilder()
    .node('hall', 13.75, 12)
    .node('dock', 13.75, 2)
    .node('door', 13.75, 0)
    .node('trailer', 13.75, -9)
    .link('hall', 'dock', 'door', 'trailer')
    .build();
  w.assets.push({ id: 'pallet', cls: 'pallet', position: vec3(13.75, 13, 0) });
  w.tags.push({
    id: 'tag-pallet',
    model: 'PINIX TOW-1',
    carrier: { type: 'asset', id: 'pallet' },
    mountHeightM: 1.0,
  });
  w.agents.push({ id: 'forklift', role: 'forklift', kind: 'vehicle', start: 'hall' });
  w.rules.push({
    id: 'gate-dock1',
    type: 'gate',
    gateZoneId: 'dock1',
    insideZoneIds: ['hall'],
    outsideZoneIds: ['yard'],
    appliesTo: ['pallet'],
  });
  return w;
}
