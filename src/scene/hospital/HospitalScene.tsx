import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { useActiveSim } from '../../experience/useActiveSim';
import { useExperience } from '../../experience/store';
import { baseWorld } from '../../experience/worlds';
import { footprint } from '../buildingGeometry';
import { SwatchStrip } from '../dev/SwatchStrip';
import { Heatmap } from '../layers/Heatmap';
import { Layers } from '../layers/Layers';
import { flatGround } from '../elevation';
import { Picker } from '../Picker';
import { networkLayouts } from '../layers/sceneLayout';
import { tierSettings } from '../quality';
import { SceneCanvas } from '../SceneCanvas';
import { SimClock } from '../simRuntime';
import { useSceneStore } from '../store';
import { StoryDirector } from '../StoryDirector';
import { HospitalBuilding } from './HospitalBuilding';
import { HospitalContents } from './HospitalContents';

/** Marks the scene ready after its first frame with all content mounted (hides the loading poster). */
function ReadySignal() {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    useSceneStore.getState().setReady(true);
  });
  return null;
}

export default function HospitalScene({ swatches = false }: { swatches?: boolean }) {
  const world = baseWorld('hospital');
  const sim = useActiveSim();
  const tier = useSceneStore((s) => s.tier);
  const physical = useExperience((s) => s.layers.physical);
  const settings = tierSettings[tier];
  const network = networkLayouts.hospital;
  const bounds = useMemo(() => footprint(world), [world]);
  const reach = useMemo(
    () =>
      network
        ? {
            x0: Math.min(bounds.x0, network.plane.x0),
            y0: Math.min(bounds.y0, network.plane.y0),
            x1: Math.max(bounds.x1, network.plane.x1),
            y1: Math.max(bounds.y1, network.plane.y1),
          }
        : bounds,
    [bounds, network],
  );
  return (
    <SceneCanvas bounds={bounds} reach={reach}>
      <SimClock />
      <HospitalBuilding world={world} textures={settings.textures} />
      <HospitalContents world={world} sim={sim} settings={settings} physical={physical} />
      <Heatmap sim={sim} world={world} bounds={bounds} />
      <Layers sim={sim} world={world} network={network} glow={settings.glow} />
      <StoryDirector world={world} network={network} />
      <Picker sim={sim} world={world} ground={flatGround} />
      {swatches && <SwatchStrip />}
      <ReadySignal />
    </SceneCanvas>
  );
}
