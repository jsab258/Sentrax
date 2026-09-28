import { ui } from '../content/ui';
import { useEffect, useRef } from 'react';
import { brand } from '../brand/brand';
import type { Simulation } from '../sim/engine';
import type { WorldDef } from '../sim/world';

const techColors = {
  rssi: brand.overlay.rssiLine,
  aoa: brand.overlay.aoa,
  bilink: brand.overlay.bilink,
} as const;

/** Mini floor map: rooms, and every asset where the system reports it (rooms for BiLink, dots otherwise). */
export function MiniMap({
  sim,
  world,
  focus,
}: {
  sim: Simulation;
  world: WorldDef;
  focus: readonly string[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Fit the building (indoor zones); outdoor positions fall outside the map and are not drawn.
    const indoor = world.zones.filter((z) => z.kind !== 'outdoor').flatMap((z) => z.polygon);
    const min = { x: Math.min(...indoor.map((p) => p.x)) - 1, y: Math.min(...indoor.map((p) => p.y)) - 1 };
    const max = { x: Math.max(...indoor.map((p) => p.x)) + 1, y: Math.max(...indoor.map((p) => p.y)) + 1 };
    const s = Math.min((w - 8) / (max.x - min.x), (h - 8) / (max.y - min.y));
    const X = (x: number) => 4 + (x - min.x) * s;
    const Y = (y: number) => h - 4 - (y - min.y) * s;
    ctx.clearRect(0, 0, w, h);
    const rooms = new Map<string, { x: number; y: number }>();
    for (const z of world.zones) {
      // Rooms and areas; parts of a room (bathrooms, bed bays, a cold room entrance) stay inside it.
      const parent = z.parent ? world.zones.find((p) => p.id === z.parent) : undefined;
      if (z.kind === 'outdoor' || parent?.kind === 'room') continue;
      ctx.beginPath();
      z.polygon.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))));
      ctx.closePath();
      ctx.fillStyle = z.kind === 'corridor' ? '#F3F3F3' : '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = '#C9CBCC';
      ctx.lineWidth = 1;
      ctx.stroke();
      const xs = z.polygon.map((p) => p.x);
      const ys = z.polygon.map((p) => p.y);
      rooms.set(z.id, {
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: (Math.min(...ys) + Math.max(...ys)) / 2,
      });
    }
    const perRoom = new Map<string, number>();
    for (const tag of world.tags) {
      if (tag.carrier.type !== 'asset') continue;
      const r = sim.report(tag.id);
      if (!r) continue;
      let px: number;
      let py: number;
      if (r.position) {
        px = r.position.x;
        py = r.position.y;
      } else if (r.roomId && rooms.has(r.roomId)) {
        const n = perRoom.get(r.roomId) ?? 0;
        perRoom.set(r.roomId, n + 1);
        const c0 = rooms.get(r.roomId) as { x: number; y: number };
        px = c0.x + ((n % 3) - 1) * 0.9;
        py = c0.y + (Math.floor(n / 3) - 0.5) * 0.9;
      } else continue;
      const focused = focus.includes(tag.id);
      ctx.beginPath();
      ctx.arc(X(px), Y(py), focused ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = techColors[r.tech];
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });
  return <canvas ref={ref} className="mini-map" role="img" aria-label={ui.dashboard.mapLabel} />;
}
