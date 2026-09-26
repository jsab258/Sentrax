import { describe, expect, it } from 'vitest';
import { hospitalWorld } from '../../sim/scenes/hospital';
import { buildDoors, buildFloors, buildSlab, buildWalls, classifyWall, footprint } from '../buildingGeometry';
import { hospitalVisualDoors, hospitalWindows } from '../hospital/dressing';

const world = hospitalWorld();
const zones = world.zones.filter((z) => z.kind !== 'outdoor');

describe('building geometry', () => {
  it('classifies exterior walls and points their normals outwards', () => {
    const south = classifyWall({ x: 0, y: 0 }, { x: 11, y: 0 }, zones);
    expect(south.exterior).toBe(true);
    expect(south.normal.y).toBeLessThan(-0.99);
    const north = classifyWall({ x: 0, y: 20 }, { x: 5, y: 20 }, zones);
    expect(north.exterior).toBe(true);
    expect(north.normal.y).toBeGreaterThan(0.99);
    const corridor = classifyWall({ x: 2, y: 13 }, { x: 5, y: 13 }, zones);
    expect(corridor.exterior).toBe(false);
  });

  it('merges walls into one geometry per material group, with cutaway attributes', () => {
    const walls = buildWalls(world);
    // Door frames go in their own group; glass is the ICU partition.
    expect(Object.keys(walls).sort()).toEqual(['frame', 'glass', 'solid']);
    const solid = walls.solid;
    expect(solid).toBeDefined();
    if (!solid) return;
    const count = solid.getAttribute('position').count;
    expect(solid.getAttribute('aWallNormal').count).toBe(count);
    expect(solid.getAttribute('aTop').count).toBe(count);
    const exterior = solid.getAttribute('aExterior').array as Float32Array;
    expect(exterior.some((v) => v === 1)).toBe(true);
    expect(exterior.some((v) => v === 0)).toBe(true);
    // Walls stand on the floor and reach the ceiling height.
    expect(solid.boundingBox?.min.y).toBeCloseTo(0, 5);
    expect(solid.boundingBox?.max.y).toBeCloseTo(2.8, 5);
  });

  it('adds window panes and bathroom doors from the visual dressing', () => {
    const plain = buildWalls(world);
    const dressed = buildWalls(world, hospitalWindows, hospitalVisualDoors);
    const panes = (w: typeof plain) => w.glass?.getAttribute('position').count ?? 0;
    // Each window adds one pane: a box without a bottom face, 5 faces of 4 vertices.
    expect(panes(dressed) - panes(plain)).toBe(hospitalWindows.length * 20);
    expect(buildDoors(world, hospitalVisualDoors).leaf?.getAttribute('position').count).toBeGreaterThan(
      buildDoors(world).leaf?.getAttribute('position').count ?? 0,
    );
  });

  it('builds vinyl floors for every room and tiles for bathrooms', () => {
    const floors = buildFloors(world);
    expect(floors.vinyl).toBeDefined();
    expect(floors.tiles?.getAttribute('position').count).toBe(6 * 4);
  });

  it('puts the slab under the whole footprint', () => {
    const f = footprint(world);
    expect(f).toEqual({ x0: 0, y0: 0, x1: 40, y1: 20 });
    const slab = buildSlab(world);
    expect(slab.boundingBox?.max.y).toBeLessThanOrEqual(0);
  });

  it('builds door leaves for swing, double and elevator doors only', () => {
    const doors = buildDoors(world);
    expect(doors.leaf).toBeDefined();
    expect(doors.steel).toBeDefined();
  });
});
