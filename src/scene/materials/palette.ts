import { useEffect, useMemo } from 'react';
import { Color, MeshStandardMaterial, Vector2, type MeshDepthMaterial } from 'three';
import type { Bucket } from '../kit/parts';
import { cutawayDepthMaterial, withCutaway } from './cutaway';
import { usePbrMaps, type TextureTier } from './textures';

export interface Palette {
  mats: Record<Bucket, MeshStandardMaterial>;
  /** The same materials with the wall cutaway, for wall-mounted pieces (headwalls, mirrors). */
  cut: Record<Bucket, MeshStandardMaterial>;
  cutDepth: MeshDepthMaterial;
}

/**
 * Roughness from the vertex colour alpha (set per part by PartBuilder). Opaque materials force alpha to
 * 1 afterwards, so the alpha never reaches the screen.
 */
function withVertexRoughness(m: MeshStandardMaterial): MeshStandardMaterial {
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\n#ifdef USE_COLOR_ALPHA\nroughnessFactor *= vColor.a;\n#endif',
    );
  };
  m.customProgramCacheKey = () => 'sentrax-vertex-roughness';
  return m;
}

/**
 * The shared materials for furniture, equipment, devices and people. Every one uses vertex colours (set
 * per part) and supports instance colours, so a few materials cover the whole scene.
 */
export function usePalette(textures: TextureTier): Palette {
  const linen = usePbrMaps('linen', textures);
  const leather = usePbrMaps('leather', textures);
  const veneer = usePbrMaps('veneer', textures);
  const palette = useMemo<Palette>(() => {
    const mats: Record<Bucket, MeshStandardMaterial> = {
      plain: withVertexRoughness(
        new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
      ),
      metal: withVertexRoughness(
        new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0.85 }),
      ),
      fabric: new MeshStandardMaterial({ ...linen, vertexColors: true, normalScale: new Vector2(0.6, 0.6) }),
      upholstery: new MeshStandardMaterial({
        ...leather,
        vertexColors: true,
        normalScale: new Vector2(0.5, 0.5),
      }),
      wood: new MeshStandardMaterial({ ...veneer, vertexColors: true }),
      screen: new MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.12,
        metalness: 0.1,
        emissive: new Color('#0d2a33'),
        emissiveIntensity: 0.7,
      }),
    };
    const cut = Object.fromEntries(
      Object.entries(mats).map(([k, m]) => [k, withCutaway(m.clone())]),
    ) as Record<Bucket, MeshStandardMaterial>;
    return { mats, cut, cutDepth: cutawayDepthMaterial() };
  }, [linen, leather, veneer]);
  useEffect(
    () => () => {
      for (const m of [...Object.values(palette.mats), ...Object.values(palette.cut), palette.cutDepth])
        m.dispose();
    },
    [palette],
  );
  return palette;
}
