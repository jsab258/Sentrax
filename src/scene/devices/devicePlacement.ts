import type { InfraDeviceDef, WorldDef } from '../../sim/world';
import type { Placement } from '../kit/instancing';

/** Heading (deg) pointing away from the nearest wall, for wall-mounted devices. */
function awayFromWall(world: WorldDef, d: InfraDeviceDef): number {
  let best = { dist: Infinity, heading: 0 };
  for (const w of world.walls) {
    const dx = w.b.x - w.a.x;
    const dy = w.b.y - w.a.y;
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((d.position.x - w.a.x) * dx + (d.position.y - w.a.y) * dy) / l2));
    const px = w.a.x + t * dx;
    const py = w.a.y + t * dy;
    const dist = Math.hypot(d.position.x - px, d.position.y - py);
    if (dist < best.dist)
      best = { dist, heading: (Math.atan2(d.position.y - py, d.position.x - px) * 180) / Math.PI };
  }
  return best.heading;
}

export function devicePlacement(world: WorldDef, d: InfraDeviceDef): Placement {
  const base = { model: d.model, x: d.position.x, y: d.position.y, z: d.position.z };
  if (d.mount === 'ceiling') return { ...base, pitch: Math.PI };
  return { ...base, heading: awayFromWall(world, d), pitch: -Math.PI / 2 };
}
