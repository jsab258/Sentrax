import { useEffect, useMemo } from 'react';
import type { Simulation } from '../../sim/engine';
import type { WorldDef } from '../../sim/world';
import { Characters } from '../characters/Characters';
import { deviceModels } from '../devices/deviceModels';
import { InfrastructureDevices } from '../devices/InfrastructureDevices';
import { StaticModels } from '../kit/StaticModels';
import { TrackedAssets } from '../kit/TrackedAssets';
import { useDisposeModels } from '../kit/useDisposeModels';
import { usePalette } from '../materials/palette';
import { Occluder } from '../overlay';
import { mergedPlacements, occluderMaterial } from '../overlays/occluders';
import type { TierSettings } from '../quality';
import { hospitalEquipmentModels, tagMounts } from './equipmentModels';
import { hospitalFurniture } from './furnitureLayout';
import { hospitalFurnitureModels } from './furnitureModels';

/** Furniture large enough to hide an overlay mark. */
const OCCLUDING = new Set([
  'bed',
  'bedsideCabinet',
  'wardrobe',
  'tallCabinet',
  'wireShelf',
  'counter',
  'sinkCounter',
  'stationCounter',
  'desk',
  'linenCart',
]);

/** Everything inside the building: furniture, Sentrax devices, tracked equipment with tags, people. */
export function HospitalContents({
  world,
  sim,
  settings,
  physical,
}: {
  world: WorldDef;
  sim: Simulation;
  settings: TierSettings;
  physical: boolean;
}) {
  const palette = usePalette(settings.textures);
  const furniture = useMemo(() => hospitalFurnitureModels(), []);
  const equipment = useMemo(() => hospitalEquipmentModels(), []);
  const tags = useMemo(() => deviceModels(), []);
  useDisposeModels(furniture);
  useDisposeModels(equipment);
  useDisposeModels(tags);
  const placements = useMemo(() => hospitalFurniture(world), [world]);
  const allCast = settings.shadows && settings.shadowCasters === 'all';
  // Large furniture hides overlays behind it (depth dimming): one merged, depth-only draw call.
  const occluder = useMemo(() => mergedPlacements(furniture, placements, OCCLUDING), [furniture, placements]);
  const occluderMat = useMemo(() => occluderMaterial(false), []);
  useEffect(
    () => () => {
      occluder?.dispose();
      occluderMat.dispose();
    },
    [occluder, occluderMat],
  );
  return (
    <>
      <group visible={physical}>
        <StaticModels models={furniture} placements={placements} palette={palette} castShadow={allCast} />
      </group>
      {occluder && physical && (
        <Occluder>
          <mesh geometry={occluder} material={occluderMat} />
        </Occluder>
      )}
      <InfrastructureDevices world={world} palette={palette} />
      <group visible={physical}>
        <TrackedAssets
          sim={sim}
          models={equipment}
          tagModels={tags}
          tagMounts={tagMounts}
          palette={palette}
          castShadow={allCast}
        />
        <Characters
          sim={sim}
          palette={palette}
          showFigures={settings.extraFigures}
          castShadow={settings.shadows}
          tagModels={tags}
        />
      </group>
    </>
  );
}
