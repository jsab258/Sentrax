import { Vector3 } from 'three';
import type { CameraShot } from '../experience/types';
import type { WorldDef } from '../sim/world';
import { frameBox, type SceneFrameBounds } from './framing';
import type { NetworkLayout } from './layers/sceneLayout';

export function zoneBounds(world: WorldDef, ids: readonly string[]): SceneFrameBounds | null {
  const pts = world.zones.filter((z) => ids.includes(z.id)).flatMap((z) => z.polygon);
  if (!pts.length) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** Camera position and target for a shot, in three.js coordinates. */
export function resolveShot(
  shot: CameraShot,
  world: WorldDef,
  aspect: number,
  fov: number,
  network?: NetworkLayout['plane'],
): { position: Vector3; target: Vector3 } | null {
  let box = shot.target
    ? { x0: shot.target[0] - 3, y0: shot.target[1] - 3, x1: shot.target[0] + 3, y1: shot.target[1] + 3 }
    : zoneBounds(world, shot.zones ?? (shot.zone ? [shot.zone] : []));
  if (!box) return null;
  if (network)
    box = {
      x0: Math.min(box.x0, network.x0),
      y0: Math.min(box.y0, network.y0),
      x1: Math.max(box.x1, network.x1),
      y1: Math.max(box.y1, network.y1),
    };
  const f = frameBox(box, aspect, fov, {
    distance: network ? undefined : shot.distance,
    azimuth: shot.azimuth,
    polar: shot.polar,
  });
  const target = new Vector3(f.center.x, 0.8, -f.center.y);
  const position = new Vector3().setFromSphericalCoords(f.distance, f.polar, f.azimuth).add(target);
  return { position, target };
}
