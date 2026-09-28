import { describe, expect, it } from 'vitest';
import { HEATMAP_CELL_M, HeatmapGrid } from '../../scene/layers/heatmap';
import { footprint } from '../../scene/buildingGeometry';
import type { Simulation } from '../../sim/engine';
import { pointInPolygon } from '../../sim/geometry';
import type { ReportedPosition } from '../../sim/positionSource';
import { createPrerolledSimulation } from '../../sim/prewarm';
import { hospitalWorld } from '../../sim/scenes/hospital';
import { alertFeed } from '../alertFeed';
import { attachIntegrationLog } from '../integrationLog';
import { forwardedTags } from '../runtime';
import { h1, h3, h5 } from '../stories/hospital';
import { StoryPlayer } from '../storyPlayer';
import type { StoryDef } from '../types';

const base = hospitalWorld();

/** A player that records like the app does: log and alert feed attached before any step runs. */
function recordingPlayer(story: StoryDef) {
  const p = new StoryPlayer(story, base);
  const log = attachIntegrationLog(p.sim, base, () => forwardedTags(p));
  alertFeed(p.sim);
  return { p, log };
}

describe('integration cards and alert feed', () => {
  it('a deep link shows the same cards and alerts as a full playthrough', () => {
    const live = recordingPlayer(h3);
    live.p.runStep(0);
    live.p.runStep(1);
    live.p.enter(2);
    const deep = recordingPlayer(h3);
    deep.p.seek(2);
    expect(deep.log.messages.get('his')).toEqual(live.log.messages.get('his'));
    expect(deep.log.messages.get('his')?.[0]).toBe('ICU below PAR: ventilators 2 of 3');
    expect(alertFeed(deep.p.sim).map((a) => a.ruleId)).toEqual(['par-icu-ventilators']);
  });

  it('routes the SOS to the alarm and nurse-call card and the clear to the same card', () => {
    const { p, log } = recordingPlayer(h5);
    for (let i = 0; i < h5.steps.length; i++) p.runStep(i);
    expect(log.messages.get('alarm')).toEqual([
      'SOS: Room 105 (cleared)',
      'Nurse, badge 2: Room 105',
      'SOS: Room 105',
    ]);
    expect(log.messages.get('his') ?? []).toEqual([]);
    const [sos] = alertFeed(p.sim);
    expect(sos?.acknowledgedAt).toBeDefined();
    expect(sos?.clearedAt).toBeDefined();
  });

  it('does not forward staff movements from steps without the Data layer', () => {
    const { p, log } = recordingPlayer(h1);
    for (let i = 0; i < h1.steps.length; i++) p.runStep(i);
    expect(log.messages.get('alarm') ?? []).toEqual([]);
  });
});

describe('dwell heatmap', () => {
  it('adds one unit of dwell per located tag and sample, from reports only', () => {
    const sim = createPrerolledSimulation(base, { seed: 7 });
    const grid = new HeatmapGrid(base, footprint(base));
    let expected = 0;
    for (let i = 0; i < 20; i++) {
      for (let k = 0; k < 10; k++) sim.step();
      const reports = [...sim.reports().values()].filter((r) => !r.held && (r.position || r.roomId));
      if (grid.sample(sim)) expected += reports.length;
    }
    const total = grid.values.reduce((a, b) => a + b, 0);
    expect(expected).toBeGreaterThan(0);
    expect(total).toBeCloseTo(expected, 3);
  });

  it('spreads a room-level report evenly over its room and a coordinate report around its point', () => {
    const report = (r: Partial<ReportedPosition>) =>
      ({
        time: 10,
        reports: () => new Map([['t', { tagId: 't', tech: 'bilink', t: 10, zoneIds: [], ...r }]]),
      }) as unknown as Simulation;
    const bounds = footprint(base);
    const room = new HeatmapGrid(base, bounds);
    room.sample(report({ roomId: 'r101' }));
    const r101 = base.zones.find((z) => z.id === 'r101');
    const hot = [...room.values.keys()].filter((i) => (room.values[i] ?? 0) > 0);
    expect(hot.length).toBeGreaterThan(10);
    for (const i of hot) {
      expect(room.values[i]).toBeCloseTo(1 / hot.length, 6);
      const p = {
        x: bounds.x0 + ((i % room.cols) + 0.5) * HEATMAP_CELL_M,
        y: bounds.y0 + (Math.floor(i / room.cols) + 0.5) * HEATMAP_CELL_M,
      };
      expect(pointInPolygon(p, r101?.polygon ?? [])).toBe(true);
    }
    const point = new HeatmapGrid(base, bounds);
    point.sample(report({ tech: 'aoa', position: { x: 12.2, y: 4.3, z: 1 }, uncertaintyM: 1 }));
    expect(point.values.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    const peak = point.values.indexOf(Math.max(...point.values));
    expect(bounds.x0 + ((peak % point.cols) + 0.5) * HEATMAP_CELL_M).toBeCloseTo(12.2, 0);
    expect(bounds.y0 + (Math.floor(peak / point.cols) + 0.5) * HEATMAP_CELL_M).toBeCloseTo(4.3, 0);
  });
});
