import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { useActiveSim } from '../../experience/useActiveSim';
import { useExperience } from '../../experience/store';
import { baseWorld } from '../../experience/worlds';
import { footprint } from '../buildingGeometry';
import { Heatmap } from '../layers/Heatmap';
import { Layers } from '../layers/Layers';
import { networkLayouts } from '../layers/sceneLayout';
import { tierSettings } from '../quality';
import { SceneCanvas } from '../SceneCanvas';
import { SimClock } from '../simRuntime';
import { useSceneStore } from '../store';
import { StoryDirector } from '../StoryDirector';
import { warehouseGround } from './ground';
import { WarehouseBuilding } from './WarehouseBuilding';
import { WarehouseContents } from './WarehouseContents';

function ReadySignal() {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    useSceneStore.getState().setReady(true);
  });
  return null;
}

/** The warehouse and manufacturing scene (SPEC section 8): hall, yard, docks and production. */
export default function WarehouseScene() {
  const world = baseWorld('warehouse');
  const sim = useActiveSim();
  const tier = useSceneStore((s) => s.tier);
  const physical = useExperience((s) => s.layers.physical);
  const settings = tierSettings[tier];
  const network = networkLayouts.warehouse;
  const bounds = useMemo(() => footprint(world), [world]);
  // The overview includes the docked trailers south of the hall.
  const frame = useMemo(() => ({ ...bounds, y0: bounds.y0 - 16 }), [bounds]);
  const reach = useMemo(() => {
    const yard = world.zones.find((z) => z.id === 'yard');
    const ys = yard?.polygon.map((p) => p.y) ?? [bounds.y0];
    const y0 = Math.min(bounds.y0, ...ys);
    return {
      x0: Math.min(bounds.x0, network?.plane.x0 ?? bounds.x0),
      y0,
      x1: Math.max(bounds.x1, network?.plane.x1 ?? bounds.x1),
      y1: Math.max(bounds.y1, network?.plane.y1 ?? bounds.y1),
    };
  }, [world, bounds, network]);
  return (
    <SceneCanvas bounds={frame} reach={reach} hdri="empty_warehouse_01" fog={[160, 320]}>
      <SimClock />
      <WarehouseBuilding world={world} textures={settings.textures} />
      <WarehouseContents
        world={world}
        sim={sim}
        settings={settings}
        physical={physical}
        ground={warehouseGround}
      />
      <Heatmap sim={sim} world={world} bounds={bounds} />
      <Layers sim={sim} world={world} network={network} glow={settings.glow} ground={warehouseGround} />
      <StoryDirector world={world} network={network} />
      <ReadySignal />
    </SceneCanvas>
  );
}
