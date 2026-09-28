import { vec3 } from '../../sim/geometry';
import type { StoryDef } from '../types';
import { inRoom, is, onArrive, stillAgents } from './helpers';

/**
 * Hospital guided stories (SPEC section 7). Content (titles, narration, takeaways) lives in
 * src/content/stories.ts under the same keys. Each story has a fixed seed and a test asserting the exact
 * events it produces (src/experience/__tests__/hospitalStories.test.ts).
 */

const calmWard = {
  'nurse-1': 'station',
  'nurse-2': 'station-desk',
  'nurse-3': 'icu-bay-a',
  biomed: 'dirty-in',
  porter: 'lobby',
};

export const h1: StoryDef = {
  id: 'h1',
  scene: 'hospital',
  seed: 101,
  world: (base) => stillAgents(base, calmWard),
  steps: [
    {
      key: 'search',
      camera: { zones: ['station', 'storage', 'r101', 'r103'] },
      focus: ['tag-nurse-1'],
      speed: 4,
      enter: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'nurse-1',
          steps: [
            { to: 'storage-park', dwellS: 4 },
            { to: 'r101-in', dwellS: 3 },
            { to: 'r102-in', dwellS: 3 },
            { to: 'r103-in', dwellS: 3 },
          ],
        }),
      until: { event: is.arrived('nurse-1', 'r103-in'), plusS: 3, maxS: 240 },
      ui: { stopwatch: true, claim: 'searchTime' },
    },
    {
      key: 'dashboard',
      camera: { zone: 'r104' },
      layers: { insight: true },
      focus: ['tag-pump-07'],
      highlight: ['pump-07', 'cen-r104'],
      speed: 1.5,
      enter: (sim) =>
        sim.command({ type: 'route', agentId: 'nurse-1', steps: [{ to: 'r104-in', dwellS: 600 }] }),
      until: { event: is.arrived('nurse-1', 'r104-in'), plusS: 2, minS: 6, maxS: 60 },
      ui: { search: 'pump', panel: 'assets' },
    },
    {
      key: 'why',
      camera: { zones: ['r104', 'corridor'], network: true },
      layers: { radio: true, data: true, insight: true },
      lens: 'bilink',
      focus: ['tag-pump-07'],
      highlight: ['pump-07', 'cen-r104', 'len1-west'],
      until: { event: is.relay('tag-pump-07'), plusS: 4, minS: 6, maxS: 30 },
    },
  ],
};

export const h2: StoryDef = {
  id: 'h2',
  scene: 'hospital',
  seed: 102,
  world: (base) => stillAgents(base, { ...calmWard, porter: 'storage-park' }),
  steps: [
    {
      key: 'advertise',
      camera: { zone: 'storage' },
      layers: { radio: true },
      lens: 'bilink',
      focus: ['tag-wheelchair-02'],
      highlight: ['wheelchair-02'],
      until: { maxS: 6 },
    },
    {
      key: 'bidirectional',
      camera: { zone: 'storage' },
      layers: { radio: true },
      lens: 'bilink',
      focus: ['tag-wheelchair-02'],
      highlight: ['cen-storage'],
      until: { maxS: 7 },
    },
    {
      key: 'filter',
      camera: { zones: ['r101', 'corridor'], distance: 20 },
      layers: { radio: true },
      lens: 'bilink',
      focus: ['tag-wheelchair-02'],
      highlight: ['cen-r101'],
      speed: 2,
      enter: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'porter',
          steps: [
            { to: 'storage-park', pickup: 'wheelchair-02' },
            { to: 'c-r101', dwellS: 10 },
            { to: 'r101-in', dwellS: 600 },
          ],
        }),
      until: {
        event: (e) =>
          e.type === 'bilink.presence' &&
          e.anchorId === 'cen-r101' &&
          e.tagId === 'tag-wheelchair-02' &&
          e.present,
        plusS: 2,
        maxS: 180,
      },
    },
    {
      key: 'relay',
      camera: { zones: ['r101', 'corridor'], network: true },
      layers: { radio: true, data: true, insight: true },
      lens: 'bilink',
      focus: ['tag-wheelchair-02'],
      highlight: ['cen-r101', 'len1-west'],
      until: { check: inRoom('tag-wheelchair-02', 'r101'), plusS: 4, minS: 5, maxS: 30 },
    },
    {
      key: 'handover',
      camera: { zones: ['r101', 'r102', 'r103'] },
      layers: { radio: true, insight: true },
      lens: 'bilink',
      focus: ['tag-wheelchair-02'],
      speed: 2,
      enter: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'porter',
          steps: [
            { to: 'r102-in', dwellS: 10 },
            { to: 'r103-in', dwellS: 600 },
          ],
        }),
      until: { check: inRoom('tag-wheelchair-02', 'r103'), plusS: 3, minS: 8, maxS: 180 },
    },
    {
      key: 'compare',
      camera: { zones: ['r101', 'r106', 'icu', 'med'] },
      layers: { radio: true, data: true },
      lens: 'bilink',
      until: { maxS: 12 },
      ui: { compare: true },
    },
  ],
};

export const h3: StoryDef = {
  id: 'h3',
  scene: 'hospital',
  seed: 103,
  world: (base) => stillAgents(base, { ...calmWard, porter: 'icu-c', biomed: 'storage-in' }),
  steps: [
    {
      key: 'moved',
      camera: { zones: ['icu', 'r102'] },
      layers: { insight: true },
      focus: ['tag-vent-02'],
      highlight: ['vent-02'],
      speed: 2,
      enter: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'porter',
          steps: [
            { to: 'icu-bay-b-head', pickup: 'vent-02' },
            { to: 'r102-bed', drop: 'vent-02', dwellS: 600 },
          ],
        }),
      until: { event: is.alertRaised('par-icu-ventilators'), plusS: 2, maxS: 180 },
    },
    {
      key: 'alert',
      camera: { zones: ['icu', 'r102'], network: true },
      layers: { insight: true, data: true },
      focus: ['tag-vent-02'],
      speed: 2,
      until: { check: inRoom('tag-vent-02', 'r102'), plusS: 2, minS: 8, maxS: 120 },
      ui: { panel: 'alerts' },
    },
    {
      key: 'restore',
      camera: { zones: ['icu', 'r102'] },
      layers: { insight: true, data: true },
      focus: ['tag-vent-02'],
      highlight: ['vent-02'],
      speed: 2,
      enter: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'biomed',
          steps: [
            { to: 'r102-bed', pickup: 'vent-02' },
            { to: 'icu-bay-b-head', drop: 'vent-02', dropAt: vec3(9.6, 1.2, 0), dwellS: 600 },
          ],
        }),
      // The alert clears as soon as AoA sees the ventilator back in the ICU; the step runs on until the
      // room assignment follows, so every event of the move happens inside the story.
      until: { check: inRoom('tag-vent-02', 'icu'), plusS: 3, maxS: 240 },
      ui: { nearest: { cls: 'ventilator', zoneId: 'icu' }, panel: 'alerts' },
    },
  ],
};

export const h4: StoryDef = {
  id: 'h4',
  scene: 'hospital',
  seed: 104,
  world: (base) => stillAgents(base, calmWard),
  steps: [
    {
      key: 'chart',
      camera: { zone: 'med' },
      layers: { insight: true },
      focus: ['tag-fridge-01'],
      highlight: ['fridge-01'],
      until: { maxS: 8 },
      ui: { chart: { tagId: 'tag-fridge-01' } },
    },
    {
      key: 'open',
      camera: { zone: 'med' },
      layers: { insight: true, data: true },
      focus: ['tag-fridge-01'],
      highlight: ['fridge-01'],
      speed: 12,
      enter: (sim) => sim.command({ type: 'setDoor', doorId: 'fridge-01-door', open: true }),
      until: { event: is.alertRaised('fridge-temperature'), plusS: 20, maxS: 1800 },
      ui: { chart: { tagId: 'tag-fridge-01' }, panel: 'alerts' },
    },
    {
      key: 'close',
      camera: { zones: ['med', 'station'] },
      layers: { insight: true, data: true },
      focus: ['tag-fridge-01'],
      highlight: ['fridge-01'],
      speed: 12,
      enter: (sim) => {
        sim.command({ type: 'route', agentId: 'nurse-1', steps: [{ to: 'med-fridge', dwellS: 600 }] });
        return onArrive(sim, 'nurse-1', 'med-fridge', () =>
          sim.command({ type: 'setDoor', doorId: 'fridge-01-door', open: false }),
        );
      },
      until: { event: is.alertCleared('fridge-temperature'), plusS: 20, maxS: 2400 },
      ui: { chart: { tagId: 'tag-fridge-01' }, panel: 'alerts' },
    },
  ],
};

export const h5: StoryDef = {
  id: 'h5',
  scene: 'hospital',
  seed: 105,
  world: (base) => stillAgents(base, { ...calmWard, 'nurse-3': 'r105-bed' }),
  steps: [
    {
      key: 'sos',
      camera: { zone: 'r105' },
      layers: { radio: true, insight: true },
      lens: 'bilink',
      focus: ['tag-sos-nurse-3'],
      highlight: ['cen-r105'],
      enter: (sim) => sim.schedule(sim.time + 2, { type: 'pressButton', tagId: 'tag-sos-nurse-3' }),
      until: { event: is.alertRaised('sos'), plusS: 3, maxS: 30 },
      ui: { panel: 'alerts' },
    },
    {
      key: 'routed',
      camera: { zones: ['r105', 'station'], network: true },
      layers: { insight: true, data: true },
      focus: ['tag-sos-nurse-3', 'tag-nurse-2'],
      speed: 1.5,
      enter: (sim) => {
        sim.command({ type: 'route', agentId: 'nurse-2', steps: [{ to: 'r105-bed', dwellS: 600 }] });
        return onArrive(sim, 'nurse-2', 'r105-bed', () => {
          const alert = sim.rules.activeAlerts().find((a) => a.ruleId === 'sos');
          if (alert) sim.command({ type: 'acknowledge', alertId: alert.id });
        });
      },
      until: { event: is.alertAcknowledged('sos'), plusS: 3, maxS: 120 },
      ui: { panel: 'alerts' },
    },
  ],
};

export const hospitalStories: StoryDef[] = [h1, h2, h3, h4, h5];
