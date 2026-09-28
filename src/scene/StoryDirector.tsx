import { useThree } from '@react-three/fiber';
import { prefersReducedMotion } from '../app/motion';
import { useEffect, useRef } from 'react';
import { devToolsEnabled, urlParam } from '../app/devtools';
import { useExperience } from '../experience/store';
import { activePlayer } from '../experience/runtime';
import type { WorldDef } from '../sim/world';
import { cameraApi } from './cameraApi';
import type { NetworkLayout } from './layers/sceneLayout';
import { resolveShot } from './shots';
import { useSceneStore } from './store';
import { visibleFrustum } from './viewInset';

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
    // Dev tool: a fixed ?cam= view wins over the story camera, for reproducible close-ups.
    if (devToolsEnabled && urlParam('cam')) return;
    const { aspect, fov } = visibleFrustum(size, insets);
    const cam = player.step.camera;
    const shot = resolveShot(cam, world, aspect, fov, cam.network && data ? network?.plane : undefined);
    if (!shot) return;
    cameraApi.fly(shot.position, shot.target, !first.current && !prefersReducedMotion());
    first.current = false;
  }, [storyId, step, simVersion, data, world, network, size, insets]);
  // Explore mode presets: fly to the requested shot.
  const request = useExperience((s) => s.cameraRequest);
  useEffect(() => {
    if (!request || !cameraApi.fly) return;
    const { aspect, fov } = visibleFrustum(size, insets);
    const shot = resolveShot(request.shot, world, aspect, fov);
    if (shot) cameraApi.fly(shot.position, shot.target, !prefersReducedMotion());
    // Only a new request flies; resizes keep the visitor's view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);
  return null;
}
