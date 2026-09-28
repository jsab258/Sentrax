import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import scenes from '../assets/scenes.json';

/** The payload budget check (scripts/check-payload.mjs) counts the textures listed in scenes.json. */
const src = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8');
const texturesIn = (code: string) => [...code.matchAll(/usePbrMaps\('([a-z-]+)'/g)].map((m) => m[1]);

describe('scene asset lists (payload budget input)', () => {
  const shared = texturesIn(src('materials', 'palette.ts'));
  it('lists exactly the textures each scene loads', () => {
    expect(new Set(scenes.hospital.textures)).toEqual(
      new Set([...texturesIn(src('hospital', 'HospitalBuilding.tsx')), ...shared]),
    );
    expect(new Set(scenes.warehouse.textures)).toEqual(
      new Set([...texturesIn(src('warehouse', 'WarehouseBuilding.tsx')), ...shared]),
    );
  });
  it('names the HDRI each scene uses', () => {
    expect(src('SceneCanvas.tsx')).toContain(`hdri = '${scenes.hospital.hdri}'`);
    expect(src('hospital', 'HospitalScene.tsx')).not.toContain('hdri=');
    expect(src('warehouse', 'WarehouseScene.tsx')).toContain(`hdri="${scenes.warehouse.hdri}"`);
  });
});
