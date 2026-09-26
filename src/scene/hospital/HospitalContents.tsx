import { useMemo } from 'react';
import type { Simulation } from '../../sim/engine';
import { Characters } from '../characters/Characters';
import { deviceModels } from '../devices/deviceModels';
import { InfrastructureDevices } from '../devices/InfrastructureDevices';
import { StaticModels } from '../kit/StaticModels';
import { TrackedAssets } from '../kit/TrackedAssets';
import { useDisposeModels } from '../kit/useDisposeModels';
import { usePalette } from '../materials/palette';
import type { TierSettings } from '../quality';
import { hospitalEquipmentModels, tagMounts } from './equipmentModels';
import { hospitalFurniture } from './furnitureLayout';
import { hospitalFurnitureModels } from './furnitureModels';

/** Everything inside the building: furniture, Sentrax devices, tracked equipment with tags, people. */
export function HospitalContents({ sim, settings }: { sim: Simulation; settings: TierSettings }) {
  const palette = usePalette(settings.textures);
  const furniture = useMemo(() => hospitalFurnitureModels(), []);
  const equipment = useMemo(() => hospitalEquipmentModels(), []);
  const tags = useMemo(() => deviceModels(), []);
  useDisposeModels(furniture);
  useDisposeModels(equipment);
  useDisposeModels(tags);
  const placements = useMemo(() => hospitalFurniture(sim.world), [sim]);
  const allCast = settings.shadows && settings.shadowCasters === 'all';
  return (
    <>
      <StaticModels models={furniture} placements={placements} palette={palette} castShadow={allCast} />
      <InfrastructureDevices world={sim.world} palette={palette} />
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
    </>
  );
}
