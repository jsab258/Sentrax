import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { footprint } from '../buildingGeometry';
import { SceneCanvas } from '../SceneCanvas';
import { getSimulation, SimClock } from '../simRuntime';
import { tierSettings } from '../quality';
import { useSceneStore } from '../store';
import { HospitalBuilding } from './HospitalBuilding';
import { SwatchStrip } from '../dev/SwatchStrip';
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
  const sim = getSimulation('hospital');
  const tier = useSceneStore((s) => s.tier);
  const settings = tierSettings[tier];
  const bounds = useMemo(() => footprint(sim.world), [sim]);
  return (
    <SceneCanvas bounds={bounds}>
      <SimClock sim={sim} />
      <HospitalBuilding world={sim.world} textures={settings.textures} />
      <HospitalContents sim={sim} settings={settings} />
      {swatches && <SwatchStrip />}
      <ReadySignal />
    </SceneCanvas>
  );
}
