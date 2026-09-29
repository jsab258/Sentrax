import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../../scene/assets/manifest.json';
import lookTextures from '../three/lookTextures.json';

/**
 * The texture list the build's budget check counts per look (scripts/check-scroll.mjs) must be the
 * textures the story's 3D code actually loads.
 */
describe('scroll story textures', () => {
  const src = (f: string) => readFileSync(join(import.meta.dirname, '..', 'three', f), 'utf8');

  it('lookTextures.json lists exactly the textures ward.ts and props.ts load for look C', () => {
    const ward = [...src('ward.ts').matchAll(/loadSet\([^,]+,\s*'([\w-]+)'/g)].map((m) => m[1]);
    const props = [...src('props.ts').matchAll(/set\('\w+',\s*'([\w-]+)'\)/g)].map((m) => m[1]);
    expect(lookTextures.c.map((t) => t.name).sort()).toEqual([...ward, ...props].sort());
    // ward.ts loads diffuse, normal and roughness; props.ts diffuse and normal.
    for (const t of lookTextures.c) {
      expect(t.maps).toEqual(ward.includes(t.name) ? ['diff', 'nor', 'rough'] : ['diff', 'nor']);
    }
    expect(lookTextures.a).toEqual([]);
    expect(lookTextures.b).toEqual([]);
  });

  it('every listed texture has its maps in the asset manifest', () => {
    const textures = manifest.textures as Record<string, { maps: Record<string, { low: string }> }>;
    for (const t of lookTextures.c) {
      for (const m of t.maps) expect(textures[t.name]?.maps[m]?.low).toMatch(/\.ktx2$/);
    }
  });
});
