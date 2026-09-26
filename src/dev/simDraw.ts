import { brand } from '../brand/brand';
import { zoneLabels } from '../content/scenes';
import type { Simulation } from '../sim/engine';
import { polygonCentroid, type Vec2 } from '../sim/geometry';
import type { WallMaterial, ZoneDef } from '../sim/world';

export interface DebugLayers {
  truth: boolean;
  rssi: boolean;
  aoa: boolean;
  bilink: boolean;
  hybrid: boolean;
  errors: boolean;
  nav: boolean;
  labels: boolean;
}

export interface View {
  scale: number;
  ox: number;
  oy: number;
  height: number;
}

const wallStyle: Record<WallMaterial, { color: string; width: number; dash?: number[] }> = {
  concrete: { color: '#4a4f57', width: 3 },
  drywall: { color: '#8a9099', width: 2 },
  glass: { color: '#8fb8d8', width: 2 },
  insulated: { color: '#3f6f7a', width: 4 },
  mesh: { color: '#8a9099', width: 1.5, dash: [3, 3] },
  metal: { color: '#5c6470', width: 2.5 },
};

const zoneFill: Record<ZoneDef['kind'], string> = {
  room: '#ffffff',
  corridor: '#f1f2f4',
  area: 'rgba(0,0,0,0)',
  outdoor: '#eef2ec',
};

export function computeView(sim: Simulation, width: number, height: number, pad = 24): View {
  const { min, max } = sim.world.bounds;
  const bw = max.x - min.x;
  const bh = max.y - min.y;
  const scale = Math.min((width - 2 * pad) / bw, (height - 2 * pad) / bh);
  const ox = (width - bw * scale) / 2 - min.x * scale;
  const oy = (height - bh * scale) / 2 - min.y * scale;
  return { scale, ox, oy, height };
}

export function toScreen(v: View, p: Vec2): [number, number] {
  return [v.ox + p.x * v.scale, v.height - (v.oy + p.y * v.scale)];
}

export function toWorld(v: View, sx: number, sy: number): Vec2 {
  return { x: (sx - v.ox) / v.scale, y: (v.height - sy - v.oy) / v.scale };
}

function poly(ctx: CanvasRenderingContext2D, v: View, pts: readonly Vec2[]) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const [x, y] = toScreen(v, p);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  sim: Simulation,
  v: View,
  layers: DebugLayers,
  interp: number,
  selectedTag: string | null,
): void {
  const o = brand.overlay;
  const w = sim.world;
  ctx.save();
  ctx.fillStyle = '#e4e7eb';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Zones: outdoor first, then rooms and corridors, then logical areas as outlines.
  const order: ZoneDef['kind'][] = ['outdoor', 'corridor', 'room', 'area'];
  for (const kind of order) {
    for (const z of w.zones.filter((x) => x.kind === kind)) {
      poly(ctx, v, z.polygon);
      if (kind === 'area') {
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = z.tags?.includes('restricted') ? alpha(o.alert, 0.7) : 'rgba(80,90,100,0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
        if (z.tags?.includes('restricted')) {
          ctx.fillStyle = alpha(o.alert, 0.06);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = z.tags?.includes('cold') ? '#eaf4f7' : zoneFill[kind];
        ctx.fill();
      }
    }
  }

  // BiLink rooms with assigned tags glow.
  if (layers.bilink) {
    const occupied = new Map<string, number>();
    for (const id of sim.tagIds()) {
      const room = sim.estimate(id, 'bilink')?.roomId;
      if (room) occupied.set(room, (occupied.get(room) ?? 0) + 1);
    }
    for (const [room] of occupied) {
      const z = sim.zones.byId.get(room);
      if (!z) continue;
      poly(ctx, v, z.polygon);
      ctx.fillStyle = alpha(o.bilink, 0.12);
      ctx.fill();
    }
  }

  // Nav graph.
  if (layers.nav) {
    ctx.strokeStyle = 'rgba(120,130,140,0.35)';
    ctx.lineWidth = 1;
    const pos = new Map(w.nav.nodes.map((n) => [n.id, n.p]));
    for (const [a, b] of w.nav.edges) {
      const pa = pos.get(a);
      const pb = pos.get(b);
      if (!pa || !pb) continue;
      ctx.beginPath();
      ctx.moveTo(...toScreen(v, pa));
      ctx.lineTo(...toScreen(v, pb));
      ctx.stroke();
    }
  }

  // Walls and doors.
  for (const wall of w.walls) {
    const s = wallStyle[wall.material];
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.setLineDash(s.dash ?? []);
    ctx.beginPath();
    ctx.moveTo(...toScreen(v, wall.a));
    ctx.lineTo(...toScreen(v, wall.b));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const d of w.doors) {
    if (d.open || d.kind === 'opening') continue;
    ctx.strokeStyle = '#b07a3b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(...toScreen(v, d.a));
    ctx.lineTo(...toScreen(v, d.b));
    ctx.stroke();
  }

  // Zone labels.
  if (layers.labels) {
    ctx.fillStyle = '#6b7380';
    ctx.font = `${Math.max(9, Math.min(12, v.scale * 0.9))}px ${brand.fonts.body.family}, sans-serif`;
    ctx.textAlign = 'center';
    for (const z of w.zones) {
      if (
        z.kind !== 'room' &&
        z.kind !== 'corridor' &&
        !z.tags?.some((t) =>
          ['station', 'restricted', 'muster', 'staging', 'station-wip', 'buffer', 'receiving'].includes(t),
        )
      )
        continue;
      if (z.parent && z.kind === 'area' && !z.tags?.length) continue;
      const label = zoneLabels[z.id];
      if (!label) continue;
      const c = polygonCentroid(z.polygon);
      const [x, y] = toScreen(v, c);
      ctx.fillText(label, x, y);
    }
  }

  // BiLink relays in flight: anchor to gateway.
  if (layers.bilink) {
    ctx.strokeStyle = alpha(o.bilink, 0.8);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    for (const m of sim.bilink.inFlight()) {
      const a = sim.device(m.anchorId).position;
      const g = sim.device(m.gatewayId).position;
      const k = Math.min(1, Math.max(0, (sim.time - m.sentAt) / Math.max(0.01, m.arrivesAt - m.sentAt)));
      ctx.beginPath();
      ctx.moveTo(...toScreen(v, a));
      ctx.lineTo(...toScreen(v, { x: a.x + (g.x - a.x) * k, y: a.y + (g.y - a.y) * k }));
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // Devices.
  for (const d of w.devices) {
    const [x, y] = toScreen(v, d.position);
    if (d.kind === 'anchor') {
      circle(ctx, x, y, 4);
      ctx.fillStyle = o.bilink;
      ctx.fill();
    } else if (d.kind === 'gateway') {
      ctx.fillStyle = o.rssi;
      ctx.fillRect(x - 4, y - 4, 8, 8);
    } else {
      ctx.fillStyle = o.aoa;
      ctx.beginPath();
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x + 5, y);
      ctx.lineTo(x, y + 5);
      ctx.lineTo(x - 5, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Ground truth: agents and assets.
  if (layers.truth) {
    for (const a of sim.agents.agents.values()) {
      if (a.mode === 'riding') continue;
      const p = {
        x: a.prevPos.x + (a.pos.x - a.prevPos.x) * interp,
        y: a.prevPos.y + (a.pos.y - a.prevPos.y) * interp,
      };
      const [x, y] = toScreen(v, p);
      if (a.kind === 'vehicle') {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-a.heading);
        ctx.fillStyle = a.role === 'yard_tractor' ? '#4b5563' : '#d4a017';
        const len = (a.role === 'yard_tractor' ? 5 : 2.6) * v.scale;
        ctx.fillRect(-len / 2, -0.6 * v.scale, len, 1.2 * v.scale);
        ctx.restore();
      } else {
        circle(ctx, x, y, Math.max(3, 0.3 * v.scale));
        ctx.fillStyle = '#374151';
        ctx.fill();
      }
    }
    for (const s of sim.agents.assets.values()) {
      const [x, y] = toScreen(v, s.pos);
      const size = Math.max(3, (s.cls === 'trailer' ? 2.5 : 0.7) * v.scale);
      ctx.fillStyle = s.cls === 'trailer' ? '#9aa3ad' : '#b9c0c8';
      if (s.cls === 'trailer') ctx.fillRect(x - size / 2, y - 6.5 * v.scale, size, 13 * v.scale);
      else ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }
  }

  // Estimates per tag.
  for (const tagId of sim.tagIds()) {
    const truth = sim.truthInterpolated(tagId, interp);
    const [tx, ty] = toScreen(v, truth);
    const selected = tagId === selectedTag;
    if (layers.rssi) {
      const e = sim.estimate(tagId, 'rssi');
      if (e?.position) {
        const [x, y] = toScreen(v, e.position);
        if (selected && e.uncertaintyM) {
          circle(ctx, x, y, e.uncertaintyM * v.scale);
          ctx.strokeStyle = alpha(o.rssi, 0.6);
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        if (layers.errors) line(ctx, tx, ty, x, y, alpha(o.rssi, 0.35));
        circle(ctx, x, y, 3);
        ctx.fillStyle = o.rssi;
        ctx.fill();
      }
    }
    if (layers.aoa) {
      const e = sim.estimate(tagId, 'aoa');
      if (e?.position) {
        const [x, y] = toScreen(v, e.position);
        if (selected) {
          for (const r of sim.lastRays.get(tagId) ?? []) {
            const len = Math.hypot(
              e.position.x - r.origin.x,
              e.position.y - r.origin.y,
              e.position.z - r.origin.z,
            );
            const end = { x: r.origin.x + r.dir.x * len, y: r.origin.y + r.dir.y * len };
            line(ctx, ...toScreen(v, r.origin), ...toScreen(v, end), alpha(o.aoa, 0.7));
          }
        }
        if (layers.errors) line(ctx, tx, ty, x, y, alpha(o.aoa, 0.5));
        circle(ctx, x, y, 3);
        ctx.fillStyle = o.aoa;
        ctx.fill();
      }
    }
    if (layers.hybrid) {
      const r = sim.report(tagId);
      const p = r?.position ?? (r?.roomId ? polygonCentroid(sim.zones.get(r.roomId).polygon) : undefined);
      if (p) {
        const [x, y] = toScreen(v, p);
        circle(ctx, x, y, 5.5);
        ctx.strokeStyle = r?.held ? 'rgba(120,120,120,0.6)' : o.insight;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    if (layers.truth) {
      circle(ctx, tx, ty, selected ? 4 : 2);
      ctx.fillStyle = '#111827';
      ctx.fill();
      if (selected) {
        circle(ctx, tx, ty, 9);
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
