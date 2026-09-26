import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { devices } from '../../content/devices';
import { hospitalWorld } from '../../sim/scenes/hospital';
import { pointInPolygon } from '../../sim/geometry';
import { deviceModels } from '../devices/deviceModels';
import { devicePlacement } from '../devices/devicePlacement';
import { framing, MAX_DISTANCE } from '../framing';
import { hospitalFurniture } from '../hospital/furnitureLayout';
import { hospitalFurnitureModels } from '../hospital/furnitureModels';
import type { ModelParts } from '../kit/instancing';
import { poseCharacter } from '../characters/pose';

function bounds(parts: ModelParts): Box3 {
  const box = new Box3();
  for (const g of Object.values(parts)) {
    g?.computeBoundingBox();
    if (g?.boundingBox) box.union(g.boundingBox);
  }
  return box;
}

const mm = (v: number) => v * 1000;

describe('Sentrax device models', () => {
  const models = deviceModels();

  it('match the datasheet footprint to the millimetre', () => {
    for (const [model, parts] of Object.entries(models) as Array<[keyof typeof devices, ModelParts]>) {
      const s = devices[model].sizeMm;
      const size = bounds(parts).getSize(new Vector3());
      if (s.shape === 'round') {
        // The TOB-1 wearable includes its strap; check the housing puck only for the others.
        if (model === 'PINIX TOB-1') continue;
        expect(mm(size.x), model).toBeCloseTo(s.diameter, 0);
        expect(mm(size.z), model).toBeCloseTo(s.diameter, 0);
        expect(mm(size.y), model).toBeCloseTo(s.h, 0);
      } else if (model === 'PINIX TOK-1') {
        expect(mm(size.z), model).toBeCloseTo(s.w, 0);
        expect(mm(size.x), model).toBeCloseTo(s.d, 0);
      } else {
        // Housing footprint. Antennas stick out above; the LEF-3 also has side antennas and front glands.
        if (model === 'ZENIX LEF-3') continue;
        expect(mm(size.z), model).toBeCloseTo(s.w, 0);
        expect(mm(size.x), model).toBeCloseTo(s.d, 0);
      }
    }
  });

  it('hang ceiling devices upside down and point wall devices into the room', () => {
    const world = hospitalWorld();
    const cen = world.devices.find((d) => d.id === 'cen-r101');
    const len2 = world.devices.find((d) => d.id === 'len2-med');
    if (!cen || !len2) throw new Error('missing devices');
    expect(devicePlacement(world, cen).pitch).toBeCloseTo(Math.PI);
    const wall = devicePlacement(world, len2);
    expect(wall.pitch).toBeCloseTo(-Math.PI / 2);
    // The medication room wall is to the west, so the device faces east.
    expect(wall.heading ?? 0).toBeCloseTo(0, 0);
  });
});

describe('hospital furniture', () => {
  const world = hospitalWorld();
  const placements = hospitalFurniture(world);
  const models = hospitalFurnitureModels();
  const indoor = world.zones.filter((z) => z.kind !== 'outdoor' && !z.parent);

  it('uses only defined models and stands inside the building', () => {
    for (const p of placements) {
      expect(models[p.model], p.model).toBeDefined();
      expect(
        indoor.some((z) => pointInPolygon({ x: p.x, y: p.y }, z.polygon)),
        `${p.model} at ${p.x}, ${p.y}`,
      ).toBe(true);
    }
  });

  it('puts a bed under every patient', () => {
    expect(placements.filter((p) => p.model === 'bed')).toHaveLength(world.figures.length);
  });

  it('attaches wall-mounted pieces to a wall for the cutaway', () => {
    const mounted = placements.filter((p) =>
      ['headwall', 'wallMonitor', 'sink', 'upperCabinets'].includes(p.model),
    );
    expect(mounted.length).toBeGreaterThan(10);
    for (const p of mounted) expect(p.wall, `${p.model} at ${p.x}, ${p.y}`).toBeDefined();
    // ICU headwalls hang on the exterior south wall.
    const icu = mounted.find((p) => p.model === 'headwall' && p.y < 1);
    expect(icu?.wall?.exterior).toBe(1);
  });
});

describe('character poses', () => {
  const base = { id: 'x', role: 'nurse', position: new Vector3(0, 0, 0), yaw: 0, phase: 0, time: 0 };

  it('stands about 1.75 m tall', () => {
    const r = poseCharacter({ ...base, pose: 'idle' });
    const head = r.parts.find((p) => p.part === 'head');
    const top = new Vector3(0.01, 0.27, 0).applyMatrix4(head?.matrix ?? r.chest);
    expect(top.y).toBeGreaterThan(1.65);
    expect(top.y).toBeLessThan(1.85);
  });

  it('swings the legs in opposite directions when walking', () => {
    const r = poseCharacter({ ...base, pose: 'walk', phase: Math.PI / 2 });
    const feet = r.parts
      .filter((p) => p.part === 'shin')
      .map((p) => new Vector3(0, -0.43, 0).applyMatrix4(p.matrix).x);
    expect(feet).toHaveLength(2);
    expect(Math.sign(feet[0] ?? 0)).toBe(-Math.sign(feet[1] ?? 0));
  });

  it('lays patients on their back with the head towards the heading and hides the legs', () => {
    const r = poseCharacter({ ...base, pose: 'lie', yaw: 0 });
    const head = r.parts.find((p) => p.part === 'head');
    const pos = new Vector3().applyMatrix4(head?.matrix ?? r.chest);
    expect(pos.x).toBeGreaterThan(1.3);
    expect(Math.abs(pos.y)).toBeLessThan(0.05);
    const thigh = r.parts.find((p) => p.part === 'thigh');
    expect(thigh?.matrix.determinant()).toBe(0);
  });
});

describe('initial framing', () => {
  const b = { x0: 0, y0: 0, x1: 40, y1: 20 };
  it('turns the ward upright on portrait screens and stays within the zoom limits', () => {
    const land = framing(b, 1.6, 35);
    const port = framing(b, 0.46, 35);
    expect(port.azimuth).not.toBeCloseTo(land.azimuth);
    for (const f of [land, port]) {
      expect(f.distance).toBeGreaterThanOrEqual(24);
      expect(f.distance).toBeLessThanOrEqual(MAX_DISTANCE);
    }
  });
});
