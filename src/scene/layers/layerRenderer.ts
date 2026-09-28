import {
  BoxGeometry,
  GreaterDepth,
  LessEqualDepth,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
  type DepthModes,
  type Object3D,
} from 'three';
import { brand } from '../../brand/brand';
import { tagName, zoneName, type CardId } from '../../content/alerts';
import { integrationLog } from '../../experience/integrationLog';
import { ui } from '../../content/ui';
import type { Simulation } from '../../sim/engine';
import type { InfraDeviceDef, WorldDef } from '../../sim/world';
import type { ExperienceState } from '../../experience/store';
import type { Lens } from '../../experience/types';
import { DotBatch, HIDDEN_OPACITY, LineBatch, RingBatch, type StrokeStyle } from '../overlays/primitives';
import { labelBridge } from './labels';
import type { NetworkLayout } from './sceneLayout';

const o = brand.overlay;

/** Mark colour per technology. */
export const techColor: Record<Exclude<Lens, 'hybrid'>, string> = {
  rssi: o.rssiLine,
  aoa: o.aoa,
  bilink: o.bilink,
};

const P = (x: number, y: number, h: number) => new Vector3(x, h, -y);

interface Relay {
  anchorId: string;
  gatewayId: string;
  tagId: string;
  start: number;
}

interface Packet {
  path: Vector3[];
  start: number;
  duration: number;
  color: string;
}

const ARC_S = 0.9;
const PULSE_S = 0.9;

function pathPoint(path: readonly Vector3[], t: number, out: Vector3): Vector3 {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += (path[i] as Vector3).distanceTo(path[i - 1] as Vector3);
  let d = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1] as Vector3;
    const b = path[i] as Vector3;
    const seg = a.distanceTo(b);
    if (d <= seg || i === path.length - 1) return out.copy(a).lerp(b, seg > 0 ? Math.min(1, d / seg) : 0);
    d -= seg;
  }
  return out.copy(path[0] as Vector3);
}

function arc(a: Vector3, b: Vector3, lift: number, n = 18): Vector3[] {
  const mid = a.clone().lerp(b, 0.5);
  mid.y = Math.max(a.y, b.y) + lift;
  const pts: Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = a
      .clone()
      .multiplyScalar((1 - t) * (1 - t))
      .add(mid.clone().multiplyScalar(2 * (1 - t) * t))
      .add(b.clone().multiplyScalar(t * t));
    pts.push(p);
  }
  return pts;
}

function dimmedPair(color: string, opacity: number): [MeshBasicMaterial, MeshBasicMaterial] {
  const make = (hidden: boolean) =>
    new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: hidden ? opacity * HIDDEN_OPACITY : opacity,
      depthWrite: false,
      depthTest: true,
      depthFunc: (hidden ? GreaterDepth : LessEqualDepth) as DepthModes,
      toneMapped: false,
    });
  return [make(false), make(true)];
}

/**
 * Draws the Radio, Data and Insight layers for one simulation (SPEC section 5). Rebuilt when the active
 * simulation changes; `update` runs once per frame and refills the overlay batches.
 */
export class LayerRenderer {
  readonly objects: Object3D[] = [];
  private readonly lines = new LineBatch();
  private readonly rings = new RingBatch();
  private readonly dots = new DotBatch();
  private readonly glow = new DotBatch('overlay-glow', true);
  private readonly devices = new Map<string, InfraDeviceDef>();
  private readonly devicePos = new Map<string, Vector3>();
  private readonly roomCenter = new Map<string, Vector3>();
  private readonly roomOutline = new Map<string, Vector3[]>();
  private readonly roomVolumes = new Map<string, Mesh[]>();
  private readonly plane: Mesh;
  private readonly uplinks = new Map<string, Vector3[]>();
  private readonly cardLinks = new Map<CardId, Vector3[]>();
  private readonly cardPos = new Map<CardId, Vector3>();
  private readonly solixPos: Vector3;
  private relays: Relay[] = [];
  private packets: Packet[] = [];
  private readonly advSeen = new Map<string, number>();
  private readonly pulseStart = new Map<string, number>();
  private readonly anchorPulse = new Map<string, number>();
  private lastTraffic = 0;
  private readonly off: Array<() => void> = [];
  private focus: readonly string[] = [];
  private readonly tmp = new Vector3();
  private readonly tagIds: Set<string>;

  constructor(
    private readonly sim: Simulation,
    private readonly world: WorldDef,
    private readonly layout: NetworkLayout | undefined,
    private readonly opts: { reducedMotion: boolean; glow: boolean },
  ) {
    this.tagIds = new Set(world.tags.map((t) => t.id));
    for (const d of world.devices) {
      this.devices.set(d.id, d);
      this.devicePos.set(d.id, P(d.position.x, d.position.y, d.position.z));
    }
    const bilinkRooms = new Set(world.devices.filter((d) => d.kind === 'anchor').map((d) => d.roomId));
    for (const z of world.zones) {
      const xs = z.polygon.map((p) => p.x);
      const ys = z.polygon.map((p) => p.y);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      this.roomCenter.set(z.id, P((x0 + x1) / 2, (y0 + y1) / 2, 0));
      const outline = z.polygon.map((p) => P(p.x, p.y, 0.04));
      const firstPt = outline[0];
      if (firstPt) outline.push(firstPt.clone());
      this.roomOutline.set(z.id, outline);
      if (bilinkRooms.has(z.id)) {
        const g = new BoxGeometry(x1 - x0 - 0.2, 2.4, y1 - y0 - 0.2).translate(
          (x0 + x1) / 2,
          1.2,
          -(y0 + y1) / 2,
        );
        const meshes = dimmedPair(o.bilinkFill, 0.2).map((m, i) => {
          const mesh = new Mesh(g, m);
          mesh.visible = false;
          mesh.renderOrder = i === 0 ? 0 : -1;
          mesh.name = `room-glow:${z.id}`;
          return mesh;
        });
        this.roomVolumes.set(z.id, meshes);
        this.objects.push(...meshes);
      }
    }
    const L = layout;
    this.solixPos = L ? P(L.solix[0], L.solix[1], L.plane.height) : new Vector3();
    const planeGeo = L
      ? new PlaneGeometry(L.plane.x1 - L.plane.x0, L.plane.y1 - L.plane.y0)
          .rotateX(-Math.PI / 2)
          .translate((L.plane.x0 + L.plane.x1) / 2, L.plane.height - 0.02, -(L.plane.y0 + L.plane.y1) / 2)
      : new PlaneGeometry(1, 1);
    this.plane = new Mesh(
      planeGeo,
      new MeshBasicMaterial({
        color: '#FFFFFF',
        transparent: true,
        opacity: 0.72,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.plane.renderOrder = -5;
    this.plane.visible = false;
    this.plane.name = 'network-plane';
    if (L) {
      for (const g of world.devices.filter((d) => d.kind === 'gateway' && d.relayTarget !== false)) {
        const p = this.devicePos.get(g.id) as Vector3;
        this.uplinks.set(g.id, [
          p,
          P(g.position.x, g.position.y, L.plane.height),
          P(g.position.x, L.plane.y0 + 1, L.plane.height),
          this.solixPos,
        ]);
      }
      for (const c of L.cards) {
        const at = P(c.at[0], c.at[1], L.plane.height);
        this.cardPos.set(c.id, at);
        this.cardLinks.set(c.id, [this.solixPos, at]);
      }
    }
    this.objects.push(
      this.plane,
      this.lines.hidden,
      this.lines.visible,
      this.rings.hidden,
      this.rings.visible,
    );
    this.objects.push(this.dots.hidden, this.dots.visible, this.glow.visible);
    this.glow.hidden.visible = false;

    const now = () => performance.now() / 1000;
    this.off.push(
      sim.bus.on('bilink.relay', (e) => {
        this.relays.push({ anchorId: e.anchorId, gatewayId: e.gatewayId, tagId: e.tagId, start: now() });
        if (this.relays.length > 40) this.relays.shift();
        const up = this.uplinks.get(e.gatewayId);
        if (up) this.packets.push({ path: up, start: now() + ARC_S, duration: 1.1, color: o.data });
      }),
    );
    const log = integrationLog(sim);
    if (log) {
      const onMessage = (card: CardId) => {
        const link = this.cardLinks.get(card);
        if (link) this.packets.push({ path: link, start: now() + 0.2, duration: 0.9, color: o.data });
      };
      log.listeners.add(onMessage);
      this.off.push(() => log.listeners.delete(onMessage));
    }
  }

  /** The lens technology has no measurement for this tag: say so next to it instead of drawing nothing. */
  private noFix(tagId: string, alpha: number, text: string): void {
    const p = this.tagPos(tagId, alpha);
    labelBridge.add({
      id: `nofix:${tagId}`,
      kind: 'state',
      at: p.setY(p.y + 0.4),
      title: text,
      tone: 'warning',
    });
  }

  private tagPos(tagId: string, alpha: number): Vector3 {
    const p = this.sim.truthInterpolated(tagId, alpha);
    return P(p.x, p.y, p.z);
  }

  private entityPos(id: string, alpha: number): Vector3 | undefined {
    const d = this.devicePos.get(id);
    if (d) return d;
    const tag = this.world.tags.find(
      (t) => t.id === id || (t.carrier.type === 'asset' && t.carrier.id === id),
    );
    return tag ? this.tagPos(tag.id, alpha) : undefined;
  }

  update(state: ExperienceState, alpha: number, now: number): void {
    const sim = this.sim;
    const wanted = state.focus.length ? state.focus : state.selectedTag ? [state.selectedTag] : [];
    this.focus = wanted.filter((id) => this.tagIds.has(id));
    const focus = this.focus;
    const focusSet = new Set(focus);
    this.lines.begin();
    this.rings.begin();
    this.dots.begin();
    this.glow.begin();
    for (const meshes of this.roomVolumes.values()) for (const m of meshes) m.visible = false;
    this.plane.visible = false;

    const style = (color: string, widthPx: number, opacity = 1, casingPx = 1.5): StrokeStyle => ({
      color,
      widthPx,
      casingPx,
      opacity,
    });
    const lensOf = (tagId: string): Exclude<Lens, 'hybrid'> =>
      state.lens === 'hybrid' ? (sim.report(tagId)?.tech ?? 'rssi') : state.lens;

    if (state.layers.radio) {
      // Advertising pulses from tags (subtle; focus tags stronger).
      if (!this.opts.reducedMotion) {
        for (const tag of this.world.tags) {
          const adv = sim.lastAdvertised(tag.id);
          if (adv !== this.advSeen.get(tag.id)) {
            this.advSeen.set(tag.id, adv);
            if (now - (this.pulseStart.get(tag.id) ?? -10) > 0.5) this.pulseStart.set(tag.id, now);
          }
          const age = now - (this.pulseStart.get(tag.id) ?? -10);
          if (age < PULSE_S) {
            const weight = focusSet.size ? (focusSet.has(tag.id) ? 1 : 0.3) : 0.55;
            const k = 1 - age / PULSE_S;
            this.rings.ring(
              this.tagPos(tag.id, alpha),
              0.2 + age * 1.5,
              style(techColor[lensOf(tag.id)], 1, k * weight, 1),
            );
          }
        }
        // Anchors broadcast too (BiLink is bidirectional): pulses from highlighted anchors.
        for (const id of state.highlight) {
          const d = this.devices.get(id);
          if (!d || d.kind !== 'anchor' || state.lens !== 'bilink') continue;
          const start = this.anchorPulse.get(id) ?? -10;
          if (now - start > 1.1) this.anchorPulse.set(id, now);
          const age = now - (this.anchorPulse.get(id) ?? now);
          if (age < PULSE_S) {
            const p = this.devicePos.get(id) as Vector3;
            this.rings.ring(
              this.tmp.set(p.x, p.y - 0.05, p.z),
              0.3 + age * 2.2,
              style(o.bilink, 1.2, 1 - age / PULSE_S),
            );
          }
        }
      }

      for (const tagId of focus) {
        const lens = lensOf(tagId);
        if (lens === 'rssi') {
          const tagH = sim.truth(tagId).z;
          const ranges = sim.rssi.ranges(tagId, sim.time);
          if (!ranges.length) this.noFix(tagId, alpha, ui.lens.noFix.rssi);
          for (const r of ranges) {
            const g = this.devices.get(r.gatewayId);
            if (!g) continue;
            const dz = g.position.z - tagH;
            const radius = Math.sqrt(Math.max(0.04, r.distanceM * r.distanceM - dz * dz));
            this.rings.ring(P(g.position.x, g.position.y, tagH), radius, style(o.rssiLine, 1.2, 0.85));
          }
          const est = sim.estimate(tagId, 'rssi');
          if (est?.position) {
            const c = P(est.position.x, est.position.y, 0.05);
            this.rings.ring(c, Math.max(0.5, est.uncertaintyM ?? 1), style(o.rssiLine, 1.5), {
              color: o.rssi,
              opacity: 0.3,
            });
            this.dots.dot(P(est.position.x, est.position.y, est.position.z), style(o.rssiLine, 4.5));
          }
        } else if (lens === 'aoa') {
          const est = sim.estimate(tagId, 'aoa');
          if (!est && !(sim.lastRays.get(tagId) ?? []).length) this.noFix(tagId, alpha, ui.lens.noFix.aoa);
          const target = est?.position ?? sim.truth(tagId);
          for (const ray of sim.lastRays.get(tagId) ?? []) {
            const origin = P(ray.origin.x, ray.origin.y, ray.origin.z);
            const len = Math.hypot(target.x - ray.origin.x, target.y - ray.origin.y, target.z - ray.origin.z);
            const end = P(
              ray.origin.x + ray.dir.x * len,
              ray.origin.y + ray.dir.y * len,
              ray.origin.z + ray.dir.z * len,
            );
            this.lines.segment(origin, end, style(o.aoa, 1.2, 0.9));
          }
          if (est?.position)
            this.dots.dot(P(est.position.x, est.position.y, est.position.z), style(o.aoa, 4.5));
        } else {
          const roomId = sim.bilink.assignment(tagId)?.roomId;
          if (roomId) {
            for (const m of this.roomVolumes.get(roomId) ?? []) m.visible = true;
            const outline = this.roomOutline.get(roomId);
            if (outline) this.lines.polyline(outline, style(o.bilink, 2));
            const anchor = this.world.devices.find((d) => d.kind === 'anchor' && d.roomId === roomId);
            if (anchor && this.opts.glow)
              this.glow.dot(this.devicePos.get(anchor.id) as Vector3, {
                color: o.bilinkFill,
                widthPx: 0,
                casingPx: 26,
                opacity: 0.9,
              });
          }
        }
      }

      // Anchor verdicts for the focus tag (H2: rejected in the corridor, accepted in the room).
      if (state.lens === 'bilink') {
        for (const id of state.highlight) {
          const d = this.devices.get(id);
          const tagId = focus[0];
          if (!d || d.kind !== 'anchor' || !tagId) continue;
          const pres = sim.bilink.anchorPresence(id, tagId);
          if (!pres) continue;
          labelBridge.add({
            id: `state:${id}`,
            kind: 'state',
            at: this.devicePos.get(id) as Vector3,
            title: pres.present ? ui.anchorState.accepted : ui.anchorState.rejected,
            tone: pres.present ? 'ok' : 'warning',
          });
        }
      }

      // Relay arcs: anchor to gateway, with the verified event travelling along.
      for (const r of this.relays) {
        const age = now - r.start;
        if (age > ARC_S + 0.8) continue;
        if (focusSet.size && !focusSet.has(r.tagId)) continue;
        const a = this.devicePos.get(r.anchorId);
        const b = this.devicePos.get(r.gatewayId);
        if (!a || !b) continue;
        const pts = arc(a, b, 1.6);
        const fade = age > ARC_S ? 1 - (age - ARC_S) / 0.8 : 1;
        this.lines.polyline(pts, style(o.bilink, 1.5, fade * (focusSet.size ? 1 : 0.5)));
        if (age < ARC_S) this.dots.dot(pathPoint(pts, age / ARC_S, this.tmp).clone(), style(o.bilink, 3.5));
      }
      this.relays = this.relays.filter((r) => now - r.start < ARC_S + 0.8);
    }

    if (state.layers.data && this.layout) {
      this.plane.visible = true;
      const L = this.layout;
      const corners = [
        P(L.plane.x0, L.plane.y0, L.plane.height),
        P(L.plane.x1, L.plane.y0, L.plane.height),
        P(L.plane.x1, L.plane.y1, L.plane.height),
        P(L.plane.x0, L.plane.y1, L.plane.height),
        P(L.plane.x0, L.plane.y0, L.plane.height),
      ];
      this.lines.polyline(corners, style(o.data, 1, 0.5, 1));
      for (const path of this.uplinks.values()) this.lines.polyline(path, style(o.data, 1.2, 0.75));
      for (const [id, path] of this.cardLinks) {
        this.lines.polyline(path, style(o.data, 1.5, 0.85));
        const proto = L.cards.find((c) => c.id === id)?.protocol;
        // Near the target card, where the two links are furthest apart.
        const mid = (path[0] as Vector3).clone().lerp(path[1] as Vector3, 0.62);
        labelBridge.add({
          id: `proto:${id}`,
          kind: 'protocol',
          at: mid,
          title: proto === 'websocket' ? ui.integrations.websocket : ui.integrations.rest,
          tone: 'data',
        });
      }
      // Background traffic from gateways that hear the focus tags.
      if (focus.length && now - this.lastTraffic > 1.4) {
        this.lastTraffic = now;
        for (const [gwId, path] of this.uplinks) {
          if (focus.some((t) => sim.rssi.ranges(t, sim.time).some((r) => r.gatewayId === gwId))) {
            this.packets.push({ path, start: now, duration: 1.3, color: o.data });
          }
        }
      }
      for (const pk of this.packets) {
        const t = (now - pk.start) / pk.duration;
        if (t < 0 || t > 1) continue;
        this.dots.dot(pathPoint(pk.path, t, this.tmp).clone(), style(pk.color, 3.5));
      }
      this.packets = this.packets.filter((p) => now - p.start < p.duration);
      labelBridge.add({
        id: 'card:solix',
        kind: 'card',
        at: this.solixPos,
        title: ui.integrations.solix,
        lines: [ui.integrations.solixDeployment],
        tone: 'insight',
      });
      for (const c of L.cards) {
        const msgs = integrationLog(this.sim)?.messages.get(c.id) ?? [];
        labelBridge.add({
          id: `card:${c.id}`,
          kind: 'card',
          at: this.cardPos.get(c.id) as Vector3,
          title: ui.integrations[c.id],
          lines: msgs.length ? msgs : [ui.integrations.idle],
          tone: 'data',
        });
      }
    } else {
      this.packets = this.packets.filter((p) => now - p.start < p.duration);
    }

    // Highlight halos (Insight): the asset, its room anchor, the gateway.
    if (this.opts.glow) {
      for (const id of state.highlight) {
        const p = this.entityPos(id, alpha);
        if (p) this.glow.dot(p, { color: o.highlight, widthPx: 0, casingPx: 34, opacity: 0.95 });
      }
    }
    for (const id of state.highlight) {
      const p = this.entityPos(id, alpha);
      if (p && !this.devices.has(id))
        this.rings.ring(this.tmp.set(p.x, 0.05, p.z).clone(), 0.75, style(o.insight, 2));
    }

    if (state.layers.insight) {
      for (const tagId of focus) {
        const r = sim.report(tagId);
        const room = r?.roomId ?? r?.zoneIds[0] ?? null;
        const at = r?.position
          ? P(r.position.x, r.position.y, 2.3)
          : room
            ? (this.roomCenter.get(room)?.clone().setY(2.3) ?? this.tagPos(tagId, alpha))
            : this.tagPos(tagId, alpha);
        labelBridge.add({
          id: `asset:${tagId}`,
          kind: 'asset',
          at,
          title: tagName(this.world, tagId),
          lines: [room ? zoneName(room) : ui.dashboard.unknownLocation],
          tone: r ? (r.tech === 'bilink' ? 'bilink' : r.tech) : 'insight',
        });
      }
    }

    if (state.stepUi.compare && this.layout) this.drawCompare(state.compare, style);

    this.lines.end();
    this.rings.end();
    this.dots.end();
    this.glow.end();
  }

  private drawCompare(
    mode: 'bilink' | 'conventional',
    style: (c: string, w: number, op?: number) => StrokeStyle,
  ) {
    const [cx, cy, cz] = this.layout?.closet ?? [0, 0, 0];
    const closet = P(cx, cy, cz);
    const cable = (from: Vector3, x: number, y: number) =>
      this.lines.polyline(
        [from, P(x, y, cz), P(x, 11.5, cz), P(cx, 11.5, cz), closet],
        style(o.data, 1.2, 0.9),
      );
    this.dots.dot(closet, style(o.data, 6));
    for (const d of this.world.devices) {
      const p = this.devicePos.get(d.id) as Vector3;
      if (mode === 'conventional' && d.kind === 'anchor') {
        this.dots.dot(p, style(o.data, 5));
        cable(p, d.position.x, d.position.y);
      }
      if (mode === 'bilink' && d.kind === 'anchor') {
        const gw = this.world.devices.find(
          (g) => g.kind === 'gateway' && g.relayTarget !== false && g.id === this.sim.bilink.gatewayFor(d.id),
        );
        if (gw)
          this.lines.polyline(
            arc(p, this.devicePos.get(gw.id) as Vector3, 1.2, 12),
            style(o.bilink, 1.2, 0.8),
          );
      }
      if (mode === 'bilink' && d.kind === 'gateway' && d.relayTarget !== false)
        cable(p, d.position.x, d.position.y);
    }
  }

  dispose(): void {
    for (const f of this.off) f();
    this.lines.dispose();
    this.rings.dispose();
    this.dots.dispose();
    this.glow.dispose();
    for (const meshes of this.roomVolumes.values()) {
      meshes[0]?.geometry.dispose();
      for (const m of meshes) (m.material as MeshBasicMaterial).dispose();
    }
    this.plane.geometry.dispose();
    (this.plane.material as MeshBasicMaterial).dispose();
  }
}
