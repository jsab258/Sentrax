import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import type { Simulation } from '../../sim/engine';
import type { AgentRole, TagModel } from '../../sim/world';
import type { Elevation } from '../elevation';
import type { ModelParts } from '../kit/instancing';
import type { Palette } from '../materials/palette';
import { simFrame } from '../simRuntime';
import { CharacterSystem } from './characterSystem';

/**
 * The one Character component (SPEC section 10): every person in a scene goes through it, so the
 * mannequins can be swapped for other figures later without touching the scenes. People come from the
 * simulation (staff) and from static figures (patients in bed, skipped on the low tier).
 */
export function Characters({
  sim,
  palette,
  showFigures,
  castShadow,
  tagModels,
  ground,
  seats,
}: {
  sim: Simulation;
  palette: Palette;
  showFigures: boolean;
  castShadow: boolean;
  tagModels: Partial<Record<TagModel, ModelParts>>;
  ground?: Elevation;
  seats?: Partial<Record<AgentRole, [number, number, number]>>;
}) {
  const system = useMemo(
    () => new CharacterSystem(sim, palette, { showFigures, castShadow, tagModels, ground, seats }),
    [sim, palette, showFigures, castShadow, tagModels, ground, seats],
  );
  useEffect(() => () => system.dispose(), [system]);
  useFrame((state, delta) => system.update(simFrame.alpha, delta, state.clock.elapsedTime), -20);
  return (
    <>
      {system.objects.map((o) => (
        <primitive key={o.name} object={o} />
      ))}
    </>
  );
}
