import { stillAgents } from '../../experience/stories/helpers';
import { vec3 } from '../../sim/geometry';
import type { ScrollStory } from './types';

/**
 * Homepage scroll story (SCROLL-SPEC.md section 3): finding an infusion pump with BiLink. Draft copy,
 * every line unapproved. The recording (hospital-bilink.timeline.json) comes from the hospital simulation
 * on this seed and starting state; `npm run scroll:record` regenerates it after a change here.
 */
export const hospitalBilink: ScrollStory = {
  id: 'hospital-bilink',
  scene: 'hospital',
  seed: 301,
  recordS: 60,
  world: (base) => {
    const w = stillAgents(base, {
      'nurse-1': 'station',
      'nurse-2': 'r105-bed',
      'nurse-3': 'icu-bay-a',
      biomed: 'storage-park',
      porter: 'c-east',
    });
    // A little life on the ward: one nurse doing rounds, the porter walking the corridor.
    for (const a of w.agents) {
      if (a.id === 'nurse-2') {
        a.routine = [
          { to: 'r106-bed', dwellS: 10 },
          { to: 'station-desk', dwellS: 8 },
          { to: 'r105-bed', dwellS: 10 },
        ];
        a.loop = true;
      }
      if (a.id === 'porter') {
        a.routine = [
          { to: 'c-storage', dwellS: 5 },
          { to: 'c-east', dwellS: 5 },
        ];
        a.loop = true;
      }
    }
    // Every room in the shot has tagged equipment: a wheelchair waits in room 105.
    const wheelchair = w.assets.find((x) => x.id === 'wheelchair-03');
    if (wheelchair) wheelchair.position = vec3(27.2, 18.4, 0);
    return w;
  },
  // Rooms 103 to 106, the corridor from the west gateway to the station, storage, utility, medication.
  crop: { x0: 8, y0: 0, x1: 34, y1: 20 },
  solix: [21, 10, 12],
  label: 'Illustrative animation',
  beats: [
    {
      id: 'establish',
      span: 1,
      timeline: [0, 10],
      copy: {
        headline: 'Where is the infusion pump?',
        body: 'A nurse needs one now. It could be in any room on the ward.',
        approved: false,
      },
      camera: [
        {
          at: 0,
          landscape: { position: [-2, -22, 31], target: [22, 10, 0], fov: 34 },
          portrait: { position: [-20, 9, 38], target: [22, 10, 0], fov: 42 },
        },
        {
          at: 1,
          landscape: { position: [16, -9, 13], target: [28, 7, 0.8], fov: 34 },
          portrait: { position: [42, -6, 17], target: [29, 7, 0.8], fov: 42 },
        },
      ],
      effects: [{ kind: 'lookAround', agentId: 'nurse-1', from: 0.1, to: 1 }],
    },
    {
      id: 'tag',
      span: 1,
      timeline: [10, 18],
      copy: {
        headline: 'Every device carries a Sentrax tag.',
        body: 'Small, battery-powered, and always signalling where it is.',
        approved: false,
      },
      camera: [
        {
          at: 0.35,
          landscape: { position: [18.6, 13.4, 3.2], target: [21.2, 18.8, 0.9], fov: 32, blur: 1 },
          portrait: { position: [20.8, 12.6, 3.6], target: [21.2, 18.8, 0.9], fov: 40, blur: 1 },
        },
        {
          at: 1,
          landscape: { position: [18.2, 14.4, 2.5], target: [21.2, 18.8, 0.95], fov: 32, blur: 1 },
          portrait: { position: [20.4, 13.4, 3.0], target: [21.2, 18.8, 0.95], fov: 40, blur: 1 },
        },
      ],
      effects: [{ kind: 'tagPulse', tagId: 'tag-pump-07', from: 0.2, to: 1 }],
    },
    {
      id: 'rooms',
      span: 1.2,
      timeline: [18, 30],
      copy: {
        headline: 'Each room listens.',
        body: 'A BiLink anchor in every room hears its tags and knows which room they are in.',
        approved: false,
      },
      camera: [
        {
          at: 0.3,
          landscape: { position: [21, -2, 21], target: [22.5, 15, 0.5], fov: 36 },
          portrait: { position: [22, -10, 32], target: [22, 14.5, 0], fov: 42 },
        },
        {
          at: 1,
          landscape: { position: [25, 0, 19], target: [22.5, 15, 0.5], fov: 36 },
          portrait: { position: [25, -8, 30], target: [22, 14, 0], fov: 42 },
        },
      ],
      effects: [
        { kind: 'rooms', rooms: ['r103', 'r104', 'r105', 'r106'], from: 0.1, to: 0.8 },
        { kind: 'unassigned', tagId: 'tag-crashcart-01', from: 0.75, to: 1 },
      ],
    },
    {
      id: 'relay',
      span: 1.1,
      timeline: [30, 40],
      copy: {
        headline: 'No gateway in every room.',
        body: 'Anchors relay verified room events to a shared gateway, and on into SOLIX. No cables to each room.',
        approved: false,
      },
      camera: [
        {
          at: 0.25,
          landscape: { position: [5, -16, 19], target: [21, 11, 4.5], fov: 36 },
          portrait: { position: [21, -22, 30], target: [21, 11, 5], fov: 42 },
        },
        {
          at: 1,
          landscape: { position: [1, -17, 23], target: [21, 10, 6], fov: 34 },
          portrait: { position: [21, -26, 36], target: [21, 10, 7], fov: 42 },
        },
      ],
      effects: [
        { kind: 'relays', anchors: ['cen-r103', 'cen-r104', 'cen-r105', 'cen-r106'], from: 0, to: 0.6 },
        { kind: 'stream', from: 0.45, to: 1 },
      ],
    },
    {
      id: 'find',
      span: 1.6,
      timeline: [40, 52],
      copy: {
        headline: 'Try it: find the pump.',
        body: '',
        approved: false,
      },
      camera: [
        {
          at: 0.2,
          landscape: { position: [21, -13, 22], target: [21, 10, 1], fov: 34 },
          portrait: { position: [21, -18, 34], target: [21, 11, 1], fov: 42 },
        },
      ],
      effects: [],
    },
  ],
  find: {
    button: 'Find the pump',
    tagId: 'tag-pump-07',
    roomId: 'r104',
    card: { title: 'Infusion pump P-07', place: 'Room 104', when: 'just now', approved: false },
    found: {
      headline: 'Found. Room 104.',
      body: 'Every tagged device, visible on screen in real time.',
      approved: false,
    },
    camera: { position: [18.4, 12.2, 6.2], target: [21.2, 18.8, 0.8], fov: 34, blur: 0.6 },
    cameraPortrait: { position: [21.2, 9.5, 9.5], target: [21.2, 18.4, 0.8], fov: 42, blur: 0.6 },
    auto: [0.35, 0.7],
    durationS: 2.4,
  },
};
