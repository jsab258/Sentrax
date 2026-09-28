import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useExperience } from '../experience/store';
import { activePlayer } from '../experience/runtime';
import type { WorldDef } from '../sim/world';
import { cameraApi } from './cameraApi';
import type { NetworkLayout } from './layers/sceneLayout';
import { resolveShot } from './shots';
import { useSceneStore } from './store';
import { visibleFrustum } from './viewInset';

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Moves the camera for each guided story step (SPEC section 4: camera target and move per step). Camera
 * flights are cut when the visitor prefers reduced motion, and on the very first frame.
 */
export function StoryDirector({ world, network }: { world: WorldDef; network?: NetworkLayout }) {
  const storyId = useExperience((s) => s.storyId);
  const step = useExperience((s) => s.step);
  const simVersion = useExperience((s) => s.simVersion);
  const data = useExperience((s) => s.layers.data);
  const size = useThree((s) => s.size);
  const insets = useSceneStore((s) => s.insets);
  const first = useRef(true);
  useEffect(() => {
    const player = activePlayer();
    if (!storyId || !player || !cameraApi.fly) return;
    const { aspect, fov } = visibleFrustum(size, insets);
    const cam = player.step.camera;
    const shot = resolveShot(cam, world, aspect, fov, cam.network && data ? network?.plane : undefined);
    if (!shot) return;
    cameraApi.fly(shot.position, shot.target, !first.current && !prefersReducedMotion());
    first.current = false;
  }, [storyId, step, simVersion, data, world, network, size, insets]);
  return null;
}
