import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { RACK } from '../../sim/scenes/warehouse';
import type { Simulation } from '../../sim/engine';
import type { WorldDef } from '../../sim/world';
import { Characters } from '../characters/Characters';
import { deviceModels } from '../devices/deviceModels';
import { InfrastructureDevices } from '../devices/InfrastructureDevices';
import type { Elevation } from '../elevation';
import { StaticModels } from '../kit/StaticModels';
import { TrackedAssets, type AssetGround } from '../kit/TrackedAssets';
import { useDisposeModels } from '../kit/useDisposeModels';
import { usePalette, type Palette } from '../materials/palette';
import { Occluder } from '../overlay';
import { mergedPlacements, occluderMaterial } from '../overlays/occluders';
import type { TierSettings } from '../quality';
import { simFrame } from '../simRuntime';
import { warehouseEquipmentModels, warehouseTagMounts } from './equipmentModels';
import { BEAM_LEVELS, warehouseLayout } from './layout';
import { VehicleSystem } from './vehicles';
import { FORKLIFT_SEAT, forkCarriage, forklift, yardTractor } from './vehicleModels';
import { warehouseStaticModels } from './warehouseModels';

/** Drivers sit on their forklift's seat. */
const SEATS = { forklift: FORKLIFT_SEAT };

/** Pieces large enough to hide an overlay mark (depth dimming). */
const OCCLUDING = new Set([
  'rackFrame',
  'rackBeams',
  'stock-low',
  'stock-mid',
  'stock-high',
  'workstation',
  'flowRack',
  'dockDoorClosed',
  'coolingUnit',
]);

function Vehicles({
  sim,
  palette,
  castShadow,
  ground,
}: {
  sim: Simulation;
  palette: Palette;
  castShadow: boolean;
  ground: Elevation;
}) {
  const models = useMemo(
    () => ({ forklift: forklift(), carriage: forkCarriage(), tractor: yardTractor() }),
    [],
  );
  useDisposeModels(models);
  const system = useMemo(
    () => new VehicleSystem(sim, models, palette, castShadow, ground),
    [sim, models, palette, castShadow, ground],
  );
  useEffect(() => () => system.dispose(), [system]);
  useFrame((_, delta) => system.update(simFrame.alpha, delta), -25);
  return (
    <>
      {system.objects.map((o) => (
        <primitive key={o.name} object={o} />
      ))}
    </>
  );
}

/** Racks, stock, docks, stations, devices, tracked assets, vehicles and people of the warehouse. */
export function WarehouseContents({
  world,
  sim,
  settings,
  physical,
  ground,
}: {
  world: WorldDef;
  sim: Simulation;
  settings: TierSettings;
  physical: boolean;
  ground: Elevation;
}) {
  const palette = usePalette(settings.textures);
  const statics = useMemo(() => warehouseStaticModels(RACK.bayPitch, BEAM_LEVELS), []);
  const equipment = useMemo(() => warehouseEquipmentModels(), []);
  const tags = useMemo(() => deviceModels(), []);
  useDisposeModels(statics);
  useDisposeModels(equipment);
  useDisposeModels(tags);
  const placements = useMemo(() => warehouseLayout(world), [world]);
  const allCast = settings.shadows && settings.shadowCasters === 'all';
  const occluder = useMemo(() => mergedPlacements(statics, placements, OCCLUDING), [statics, placements]);
  const occluderMat = useMemo(() => occluderMaterial(false), []);
  // A load inside a trailer stands on the trailer floor, which is level with the hall floor.
  const assetGround = useMemo<AssetGround>(() => (x, y, a) => (a.inside ? 0 : ground(x, y)), [ground]);
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
        <StaticModels models={statics} placements={placements} palette={palette} castShadow={allCast} />
      </group>
      {occluder && physical && (
        <Occluder>
          <mesh geometry={occluder} material={occluderMat} />
        </Occluder>
      )}
      <InfrastructureDevices world={world} palette={palette} ground={ground} />
      <group visible={physical}>
        <TrackedAssets
          sim={sim}
          models={equipment}
          tagModels={tags}
          tagMounts={warehouseTagMounts}
          palette={palette}
          castShadow={allCast}
          ground={assetGround}
        />
        <Vehicles sim={sim} palette={palette} castShadow={settings.shadows} ground={ground} />
        <Characters
          sim={sim}
          palette={palette}
          showFigures={false}
          castShadow={settings.shadows}
          tagModels={tags}
          ground={ground}
          seats={SEATS}
        />
      </group>
    </>
  );
}
