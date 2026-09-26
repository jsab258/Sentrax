import { useEffect, useMemo, useRef, useState } from 'react';
import { assetLabel, roleLabels, techLabels, zoneLabels } from '../content/scenes';
import { ui } from '../content/ui';
import { simConfig } from '../sim/config';
import { Simulation } from '../sim/engine';
import type { AlertInfo, SimEvent } from '../sim/events';
import { dist2, median } from '../sim/geometry';
import { hospitalWorld } from '../sim/scenes/hospital';
import { aoaArea, bilinkRooms, dockLayout, rssiHall, withBilinkProbeTags } from '../sim/scenes/testLayouts';
import { warehouseWorld } from '../sim/scenes/warehouse';
import type { WorldDef } from '../sim/world';
import { computeView, drawScene, toWorld, type DebugLayers, type View } from './simDraw';
import { scenarios } from './simScenarios';

const worlds: Record<string, () => WorldDef> = {
  hospital: hospitalWorld,
  warehouse: warehouseWorld,
  'test-rssi': () => rssiHall(),
  'test-aoa': () => aoaArea(),
  'test-bilink': () => withBilinkProbeTags(bilinkRooms()),
  'test-dock': dockLayout,
};

const speeds = [0, 1, 4, 16] as const;
const t = ui.simDebug;

interface Stats {
  rssi: number;
  aoa: number;
  bilink: number;
}

function params() {
  const p = new URLSearchParams(window.location.search);
  const scene = p.get('scene') ?? 'hospital';
  return {
    scene: scene in worlds ? scene : 'hospital',
    seed: Number(p.get('seed') ?? 1) || 1,
    speed: Number(p.get('speed') ?? 1),
    // Same pre-roll as the 3D scenes unless ?t= is given.
    startAt: Number(p.get('t') ?? simConfig.preRollS),
    scenario: p.get('scenario'),
    scenarioAt: Number(p.get('at') ?? 25),
    select: p.get('select'),
  };
}

function tagLabel(sim: Simulation, tagId: string): string {
  const def = sim.tagDef(tagId);
  if (def.carrier.type === 'asset') return assetLabel(def.carrier.id);
  const agent = sim.agents.agents.get(def.carrier.id);
  const n = def.carrier.id.match(/(\d+)$/)?.[1];
  return `${roleLabels[agent?.role ?? ''] ?? def.carrier.id}${n ? ` ${n}` : ''}`;
}

function zoneName(id: string | null | undefined): string {
  if (!id) return t.none;
  return zoneLabels[id] ?? id;
}

function describeAlert(sim: Simulation, a: AlertInfo): string {
  const where = zoneName(a.locationZoneId);
  switch (a.kind) {
    case 'par':
      return `${zoneName(a.zoneId)} below PAR: ${a.data.cls} ${a.data.count} of ${a.data.min}`;
    case 'geofence':
      return `${a.tagId ? tagLabel(sim, a.tagId) : ''} in ${zoneName(a.zoneId)}, ${a.data.durationS} s`;
    case 'sensor':
      return `${a.tagId ? tagLabel(sim, a.tagId) : ''} ${a.data.metric} ${a.data.value} (limit ${a.data.limit}) in ${where}, ${a.data.durationS} s`;
    case 'sos':
      return `SOS from ${a.tagId ? tagLabel(sim, a.tagId) : ''} in ${where}`;
    case 'dwell':
      return `${a.tagId ? tagLabel(sim, a.tagId) : ''} dwell ${a.data.dwellS} s (max ${a.data.maxS}) in ${where}`;
  }
}

function describeEvent(sim: Simulation, e: SimEvent): string | null {
  switch (e.type) {
    case 'position.room':
      return `${tagLabel(sim, e.tagId)}: BiLink room ${zoneName(e.roomId)}`;
    case 'zone.enter':
      return `${tagLabel(sim, e.tagId)} entered ${zoneName(e.zoneId)}`;
    case 'gate.checkout':
      return `${tagLabel(sim, e.tagId)} checked out through ${zoneName(e.gateZoneId)}`;
    case 'gate.checkin':
      return `${tagLabel(sim, e.tagId)} checked in through ${zoneName(e.gateZoneId)}`;
    case 'alert.raised':
      return `Alert raised: ${describeAlert(sim, e.alert)}`;
    case 'alert.cleared':
      return `Alert cleared: ${describeAlert(sim, e.alert)}`;
    case 'button.pressed':
      return `${tagLabel(sim, e.tagId)} pressed SOS`;
    case 'muster.update':
      return `Muster: ${e.present} of ${e.total}`;
    case 'asset.pickedUp':
      return `${assetLabel(e.assetId)} picked up`;
    case 'asset.dropped':
      return `${assetLabel(e.assetId)} put down`;
    case 'door.changed':
      return `${e.doorId} ${e.open ? 'opened' : 'closed'}`;
    default:
      return null;
  }
}

interface Snapshot {
  time: number;
  stats: Stats;
  log: string[];
  alerts: string[];
  selected: { label: string; model: string; lines: string[] } | null;
}

/** Owns one simulation run plus the debug bookkeeping (event log, rolling stats, deep-linked scenario). */
class DebugController {
  readonly sim: Simulation;
  private readonly log: string[] = [];
  private readonly stats: Stats = { rssi: NaN, aoa: NaN, bilink: NaN };
  private readonly samples: Array<{ t: number; rssi: number[]; aoa: number[]; ok: number; n: number }> = [];
  private readonly lastMoved = new Map<string, number>();
  private pending: { at: number; run: (s: Simulation) => void } | null;
  private accumulator = 0;

  constructor(scene: string, seed: number, scenario: { at: number; run: (s: Simulation) => void } | null) {
    this.sim = new Simulation(worlds[scene]?.() ?? hospitalWorld(), { seed });
    this.pending = scenario;
    this.sim.bus.onAny((e) => {
      const text = describeEvent(this.sim, e);
      if (!text) return;
      this.log.unshift(`${e.t.toFixed(1)} s  ${text}`);
      if (this.log.length > 40) this.log.length = 40;
    });
  }

  step(): void {
    this.sim.step();
    if (this.pending && this.sim.time >= this.pending.at) {
      const run = this.pending.run;
      this.pending = null;
      run(this.sim);
    }
    for (const id of this.sim.tagIds()) {
      const a = this.sim.truth(id);
      const b = this.sim.truthInterpolated(id, 0);
      if (Math.hypot(a.x - b.x, a.y - b.y) > 0.01 || !this.lastMoved.has(id))
        this.lastMoved.set(id, this.sim.time);
    }
    sampleStats(this.sim, this.samples, this.stats, this.lastMoved);
  }

  fastForward(t: number): void {
    while (this.sim.time < t) this.step();
  }

  /** Fixed-step accumulation, like Simulation.advance; returns the interpolation factor. */
  advance(seconds: number): number {
    this.accumulator += seconds;
    let n = 0;
    while (this.accumulator >= this.sim.dt && n < this.sim.cfg.maxStepsPerAdvance) {
      this.step();
      this.accumulator -= this.sim.dt;
      n++;
    }
    return Math.min(1, this.accumulator / this.sim.dt);
  }

  snapshot(selectedTag: string | null): Snapshot {
    const sim = this.sim;
    let selected: Snapshot['selected'] = null;
    if (selectedTag && sim.tagIds().includes(selectedTag)) {
      const r = sim.report(selectedTag);
      const truth = sim.truth(selectedTag);
      const lines: string[] = [
        `${techLabels.hybrid}: ${r ? techLabels[r.tech] : t.none}${r?.roomId ? `, ${zoneName(r.roomId)}` : ''}${
          r?.position ? `, (${r.position.x.toFixed(1)}, ${r.position.y.toFixed(1)})` : ''
        }${r?.held ? ', last known' : ''}`,
      ];
      for (const tech of ['rssi', 'aoa'] as const) {
        const e = sim.estimate(selectedTag, tech);
        if (e?.position) lines.push(`${techLabels[tech]} error ${dist2(e.position, truth).toFixed(2)} m`);
      }
      lines.push(
        `${techLabels.bilink}: ${zoneName(sim.estimate(selectedTag, 'bilink')?.roomId)}. Truth: ${zoneName(sim.truthRoom(selectedTag))}.`,
      );
      selected = { label: tagLabel(sim, selectedTag), model: sim.tagDef(selectedTag).model, lines };
    }
    return {
      time: sim.time,
      stats: { ...this.stats },
      log: this.log.slice(0, 16),
      alerts: sim.rules.activeAlerts().map((a) => describeAlert(sim, a)),
      selected,
    };
  }
}

/** 2D top-down view of the simulation (SPEC section 12, M1): verifies the engine without 3D. */
export function SimDebugView() {
  const [init] = useState(params);
  const [scene, setScene] = useState(init.scene);
  const [seed, setSeed] = useState(init.seed);
  const [speed, setSpeed] = useState(init.speed);
  const [resetKey, setResetKey] = useState(0);
  const [layers, setLayers] = useState<DebugLayers>({
    truth: true,
    rssi: false,
    aoa: true,
    bilink: true,
    hybrid: true,
    errors: true,
    nav: false,
    labels: true,
  });
  const [selected, setSelected] = useState<string | null>(init.select);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<View | null>(null);

  const controller = useMemo(() => {
    const deepLinked = scene === init.scene && seed === init.seed && resetKey === 0;
    const sc = deepLinked ? scenarios[scene]?.find((x) => x.id === init.scenario) : undefined;
    const c = new DebugController(scene, seed, sc ? { at: init.scenarioAt, run: sc.run } : null);
    // Fast-forward for deep links and screenshots (?t=120).
    if (deepLinked && init.startAt > 0) c.fastForward(init.startAt);
    return c;
  }, [scene, seed, resetKey, init]);

  const [snap, setSnap] = useState<Snapshot>(() => controller.snapshot(selected));

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const alpha = speed > 0 ? controller.advance(dt * speed) : 0;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const view = computeView(controller.sim, w, h);
        viewRef.current = view;
        drawScene(ctx, controller.sim, view, layers, alpha, selected);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const timer = window.setInterval(() => setSnap(controller.snapshot(selected)), 250);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(timer);
    };
  }, [controller, speed, layers, selected]);

  const onCanvasClick = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    const view = viewRef.current;
    if (!view) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    const p = toWorld(view, ev.clientX - rect.left, ev.clientY - rect.top);
    let best: string | null = null;
    let bestD = Math.max(1, 12 / view.scale);
    for (const id of controller.sim.tagIds()) {
      const d = dist2(p, controller.sim.truth(id));
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    setSelected(best);
  };

  const fmt = (v: number, unit: string) =>
    Number.isFinite(v) ? `${v.toFixed(unit === '%' ? 1 : 2)} ${unit}` : t.none;

  return (
    <main className="simdebug" data-testid="sim-debug">
      <div className="simdebug-stage">
        <canvas ref={canvasRef} className="simdebug-canvas" onClick={onCanvasClick} aria-label={t.title} />
        <p className="simdebug-legend">{t.legend}</p>
        <span className="simdebug-badge">{ui.simulatedData}</span>
      </div>
      <aside className="simdebug-panel">
        <h1>{t.title}</h1>
        <div className="simdebug-row">
          <label>
            {t.scene}
            <select value={scene} onChange={(e) => setScene(e.target.value)}>
              {Object.keys(worlds).map((id) => (
                <option key={id} value={id}>
                  {t.sceneNames[id as keyof typeof t.sceneNames]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.seed}
            <input
              type="number"
              value={seed}
              min={1}
              onChange={(e) => setSeed(Number(e.target.value) || 1)}
            />
          </label>
        </div>
        <div className="simdebug-row" role="group" aria-label={t.speed}>
          <span className="simdebug-time" data-testid="sim-time">
            {t.time}: {snap.time.toFixed(1)} s
          </span>
          {speeds.map((s) => (
            <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)}>
              {s === 0 ? t.pause : `${s}x`}
            </button>
          ))}
          <button type="button" onClick={() => setResetKey((k) => k + 1)}>
            {t.reset}
          </button>
        </div>

        <h2>{t.layers}</h2>
        <div className="simdebug-layers">
          {(Object.keys(layers) as Array<keyof DebugLayers>).map((k) => (
            <label key={k}>
              <input
                type="checkbox"
                checked={layers[k]}
                onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })}
              />
              {t.layerNames[k]}
            </label>
          ))}
        </div>

        <h2>{t.stats}</h2>
        <dl className="simdebug-stats" data-testid="sim-stats">
          <dt>{t.rssiMedian}</dt>
          <dd>{fmt(snap.stats.rssi, 'm')}</dd>
          <dt>{t.aoaMedian}</dt>
          <dd>{fmt(snap.stats.aoa, 'm')}</dd>
          <dt>{t.bilinkCorrect}</dt>
          <dd>{fmt(snap.stats.bilink * 100, '%')}</dd>
        </dl>

        {scenarios[scene] && (
          <>
            <h2>{t.scenarios}</h2>
            <div className="simdebug-scenarios">
              {scenarios[scene]?.map((s) => (
                <button key={s.id} type="button" onClick={() => s.run(controller.sim)}>
                  {s.label}
                </button>
              ))}
            </div>
          </>
        )}

        <h2>{t.selected}</h2>
        {snap.selected ? (
          <div className="simdebug-selected">
            <strong>{snap.selected.label}</strong> <code>{snap.selected.model}</code>
            {snap.selected.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : (
          <p className="simdebug-hint">{t.clickHint}</p>
        )}

        <h2>{t.alerts}</h2>
        <ul className="simdebug-alerts" data-testid="sim-alerts">
          {snap.alerts.length === 0 ? <li>{t.none}</li> : snap.alerts.map((a) => <li key={a}>{a}</li>)}
        </ul>

        <h2>{t.events}</h2>
        <ol className="simdebug-log">
          {snap.log.map((line, i) => (
            <li key={`${i}-${line}`}>{line}</li>
          ))}
        </ol>
      </aside>
    </main>
  );
}

/** Rolling accuracy against ground truth, sampled every 0.5 s over the last 30 s. */
function sampleStats(
  sim: Simulation,
  samples: Array<{ t: number; rssi: number[]; aoa: number[]; ok: number; n: number }>,
  out: Stats,
  lastMoved: ReadonlyMap<string, number>,
) {
  if (sim.steps % 5 !== 0) return;
  const rssi: number[] = [];
  const aoa: number[] = [];
  let ok = 0;
  let n = 0;
  for (const id of sim.tagIds()) {
    const truth = sim.truth(id);
    const r = sim.estimate(id, 'rssi');
    if (r?.position) rssi.push(dist2(r.position, truth));
    const a = sim.estimate(id, 'aoa');
    if (a?.position && (sim.lastRays.get(id)?.length ?? 0) >= 2) aoa.push(dist2(a.position, truth));
    if (sim.bilink.assignment(id) && sim.anchorsList.length) {
      // Steady state only: the tag has been still for at least 6 s.
      const settled = sim.time - (lastMoved.get(id) ?? sim.time) >= 6;
      if (settled) {
        const tr = sim.truthRoom(id);
        const expected = tr && sim.anchorsList.some((d) => d.roomId === tr) ? tr : null;
        n++;
        if ((sim.estimate(id, 'bilink')?.roomId ?? null) === expected) ok++;
      }
    }
  }
  samples.push({ t: sim.time, rssi, aoa, ok, n });
  while (samples.length && (samples[0]?.t ?? 0) < sim.time - 30) samples.shift();
  out.rssi = median(samples.flatMap((s) => s.rssi));
  out.aoa = median(samples.flatMap((s) => s.aoa));
  const totalN = samples.reduce((s, x) => s + x.n, 0);
  out.bilink = totalN ? samples.reduce((s, x) => s + x.ok, 0) / totalN : NaN;
}
