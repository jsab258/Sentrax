import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../../scene/assets/manifest.json';
import storyTextures from '../three/textures.json';

/**
 * The texture list the build's budget check counts (scripts/check-scroll.mjs) must be the textures the
 * story's 3D code actually loads.
 */
describe('scroll story textures', () => {
  const src = (f: string) => readFileSync(join(import.meta.dirname, '..', 'three', f), 'utf8');

  it('textures.json lists exactly the textures ward.ts and props.ts load', () => {
    const ward = [...src('ward.ts').matchAll(/loadSet\([^,]+,\s*'([\w-]+)'/g)].map((m) => m[1]);
    const props = [...src('props.ts').matchAll(/set\('\w+',\s*'([\w-]+)'\)/g)].map((m) => m[1]);
    expect(storyTextures.map((t) => t.name).sort()).toEqual([...ward, ...props].sort());
    // ward.ts loads diffuse, normal and roughness; props.ts diffuse and normal.
    for (const t of storyTextures) {
      expect(t.maps).toEqual(ward.includes(t.name) ? ['diff', 'nor', 'rough'] : ['diff', 'nor']);
    }
  });

  it('every listed texture has its maps in the asset manifest', () => {
    const textures = manifest.textures as Record<string, { maps: Record<string, { low: string }> }>;
    for (const t of storyTextures) {
      for (const m of t.maps) expect(textures[t.name]?.maps[m]?.low).toMatch(/\.ktx2$/);
    }
  });
});
