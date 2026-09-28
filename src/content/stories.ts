import { claims } from './claims';

/**
 * Guided story copy (SPEC sections 4, 7 and 8). Keys match the story definitions in
 * src/experience/stories. Narration cards: a title plus one or two sentences. No figures other than the
 * approved claims and the illustrative thresholds the SPEC defines for the stories.
 */
export interface StepCopy {
  title: string;
  body: string;
}

export interface StoryCopy {
  title: string;
  summary: string;
  steps: Record<string, StepCopy>;
  takeaway: string;
}

export const storyCopy: Record<string, StoryCopy> = {
  h1: {
    title: 'Find the infusion pump',
    summary: 'A nurse needs a pump and storage is empty. Search the ward, then search SOLIX.',
    steps: {
      search: {
        title: 'Searching without RTLS',
        body: 'A nurse needs an infusion pump, but equipment storage is empty. Without location data the only option is to walk the ward and check room after room.',
      },
      dashboard: {
        title: 'With Sentrax: one search',
        body: 'The nurse searches the SOLIX dashboard instead. It shows infusion pump P-07 in room 104, seen moments ago, and the nurse walks straight there.',
      },
      why: {
        title: 'Why it works',
        body: "The pump's PINIX tag advertises. The NODIX anchor in room 104 validates it and relays the event to a corridor gateway, and SOLIX assigns the room.",
      },
    },
    takeaway: 'Staff find equipment with one search instead of a walk around the ward.',
  },
  h2: {
    title: 'How BiLink works',
    summary: 'Battery anchors in every room, filtering at the anchor and clean handovers.',
    steps: {
      advertise: {
        title: 'A tag advertises',
        body: 'The PINIX tag on a wheelchair sends short Bluetooth Low Energy advertisements.',
      },
      bidirectional: {
        title: 'The anchor listens and speaks',
        body: 'The battery-powered NODIX CEN-1 in the room scans for tags and also broadcasts, so the link works in both directions.',
      },
      filter: {
        title: 'Filtered at the anchor',
        body: 'Just outside the door the anchor rejects the tag: its signal through the wall is weak and unsteady. Inside the room the tag is accepted. No hallway bleed.',
      },
      relay: {
        title: 'Relayed to SOLIX',
        body: 'Only the verified event travels on. The anchor relays it to a corridor gateway, SOLIX assigns the room and the dashboard shows it.',
      },
      handover: {
        title: 'Clean handovers',
        body: "As the wheelchair moves on, the next room's anchor takes over. The room changes once per move, without flicker.",
      },
      compare: {
        title: 'Conventional versus BiLink',
        body: 'Compare the infrastructure for this ward. The counts come from the devices in the scene.',
      },
    },
    takeaway: `${capitalize(claims.bilinkAccuracy.text)} visibility with a battery anchor per room and only a few powered gateways. ${claims.bilinkTagline.text}.`,
  },
  h3: {
    title: 'ICU readiness',
    summary: 'A ventilator leaves the ICU. PAR alert, nearest available unit, back to PAR.',
    steps: {
      moved: {
        title: 'A ventilator leaves the ICU',
        body: 'The porter takes a ventilator from the ICU to room 102. The ICU now holds fewer ventilators than its PAR level (illustrative: 3 ventilators and 6 pumps).',
      },
      alert: {
        title: 'Below PAR',
        body: 'SOLIX raises "ICU below PAR: ventilators 2 of 3" on the dashboard and sends it to the CMMS.',
      },
      restore: {
        title: 'Back to PAR',
        body: 'The dashboard points to the nearest available ventilator. The BioMed technician brings it back and the alert clears.',
      },
    },
    takeaway: 'Critical areas stay stocked: SOLIX flags a shortage as soon as equipment leaves.',
  },
  h4: {
    title: 'Cold chain in the medication room',
    summary: 'A fridge door is left open. Live temperature, alert with location and duration, audit trail.',
    steps: {
      chart: {
        title: 'Live temperature',
        body: 'The PINIX TOW-5 on the medication fridge reports its temperature. The chart shows the live reading.',
      },
      open: {
        title: 'The door is left open',
        body: 'The temperature climbs past the threshold. SOLIX raises an alert with the location and duration and logs it for audit.',
      },
      close: {
        title: 'Closed and recorded',
        body: 'A nurse closes the door. The temperature recovers, the alert closes, and the full trail stays on record.',
      },
    },
    takeaway: 'Cold chain excursions are caught, located and documented automatically.',
  },
  h5: {
    title: 'Staff call for help',
    summary: 'An SOS button press in room 105 reaches the alarm platform and a colleague.',
    steps: {
      sos: {
        title: 'A call for help',
        body: 'A nurse presses the SOS button on the PINIX TOB-1 wearable in room 105.',
      },
      routed: {
        title: 'Help is on the way',
        body: 'The alert with the room goes to the alarm and nurse-call platform, and the nearest colleague is routed to room 105.',
      },
    },
    takeaway: 'One button press brings help to the right room.',
  },
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
