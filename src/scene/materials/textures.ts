import { useLoader, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { RepeatWrapping, type Texture } from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { assetUrl } from '../../app/assetUrl';
import manifest from '../assets/manifest.json';

/**
 * PBR texture sets from Poly Haven (see ASSETS.md), encoded as KTX2 by scripts/assets.mjs. Colour maps
 * are sRGB, normal and roughness maps linear; the loader reads that from the files.
 */

export type TextureName = keyof typeof manifest.textures;
export type TextureTier = 'high' | 'low';

export function texturePaths(name: TextureName, tier: TextureTier): [string, string, string] {
  const maps = manifest.textures[name].maps;
  return [assetUrl(maps.diff[tier]), assetUrl(maps.nor[tier]), assetUrl(maps.rough[tier])];
}

export function hdriPath(id: keyof typeof manifest.hdri): string {
  return assetUrl(manifest.hdri[id].path);
}

export interface PbrMaps {
  map: Texture;
  normalMap: Texture;
  roughnessMap: Texture;
}

function tile(textures: Texture[], name: TextureName, anisotropy: number): PbrMaps {
  const [sx, sy] = manifest.textures[name].sizeM as [number, number];
  for (const t of textures) {
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.repeat.set(1 / sx, 1 / sy);
    t.anisotropy = anisotropy;
    t.needsUpdate = true;
  }
  const [map, normalMap, roughnessMap] = textures;
  if (!map || !normalMap || !roughnessMap) throw new Error(`texture set ${name} is incomplete`);
  return { map, normalMap, roughnessMap };
}

/**
 * Loads a texture set and tiles it in world metres: geometry UVs are metres, so repeat is 1 / tile size.
 * Suspends while loading (wrap the caller in Suspense).
 */
export function usePbrMaps(name: TextureName, tier: TextureTier, anisotropy = 4): PbrMaps {
  const gl = useThree((s) => s.gl);
  // No transcoder path: three's KTX2Loader then loads the Basis transcoder bundled with the three
  // package (Vite emits it with the build), so its version always matches the loader.
  const textures = useLoader(KTX2Loader, texturePaths(name, tier), (loader) => {
    loader.detectSupport(gl);
  });
  const maps = useMemo(() => tile(textures, name, anisotropy), [textures, name, anisotropy]);
  // Upload now rather than on first use, so the first frame does not stall.
  useEffect(() => {
    for (const t of textures) gl.initTexture(t);
  }, [gl, textures]);
  return maps;
}
