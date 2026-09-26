import { useEffect, useMemo } from 'react';
import type { Palette } from '../materials/palette';
import { buildInstances, type ModelParts, type Placement } from './instancing';

/** Renders static placements as instanced meshes (one draw call per model and material). */
export function StaticModels({
  models,
  placements,
  palette,
  castShadow,
}: {
  models: Record<string, ModelParts>;
  placements: readonly Placement[];
  palette: Palette;
  castShadow: boolean;
}) {
  const meshes = useMemo(
    () => buildInstances(models, placements, palette, { cast: castShadow, receive: true }),
    [models, placements, palette, castShadow],
  );
  useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes]);
  return (
    <>
      {meshes.map((m) => (
        <primitive key={m.name} object={m} />
      ))}
    </>
  );
}
