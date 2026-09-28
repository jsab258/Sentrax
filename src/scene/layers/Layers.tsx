import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { useExperience } from '../../experience/store';
import type { Simulation } from '../../sim/engine';
import type { WorldDef } from '../../sim/world';
import { flatGround, type Elevation } from '../elevation';
import { Overlay } from '../overlay';
import { simFrame } from '../simRuntime';
import { labelBridge } from './labels';
import { LayerRenderer } from './layerRenderer';
import type { NetworkLayout } from './sceneLayout';

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Radio, Data and Insight layers for the active simulation, drawn in the overlay pass. */
export function Layers({
  sim,
  world,
  network,
  glow,
  ground = flatGround,
}: {
  sim: Simulation;
  world: WorldDef;
  network?: NetworkLayout;
  glow: boolean;
  ground?: Elevation;
}) {
  const renderer = useMemo(
    () => new LayerRenderer(sim, world, network, { reducedMotion: reducedMotion(), glow }, ground),
    [sim, world, network, glow, ground],
  );
  useEffect(() => () => renderer.dispose(), [renderer]);
  const size = useThree((s) => s.size);
  useFrame(() => {
    labelBridge.begin();
    renderer.update(useExperience.getState(), simFrame.alpha, performance.now() / 1000);
  }, -10);
  // Labels are placed after the camera controls have moved the camera for this frame.
  useFrame(({ camera }) => labelBridge.flush(camera, size.width, size.height), 3);
  return (
    <Overlay>
      {renderer.objects.map((o) => (
        <primitive key={o.uuid} object={o} />
      ))}
    </Overlay>
  );
}
