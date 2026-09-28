import type { SimEvent } from '../../sim/events';

/**
 * The events a guided story is judged on (SPEC section 12 review item 7): room changes, check-ins,
 * check-outs and alerts. A story test lists every one of them in order; anything else is a failure.
 */
export type StoryEvent =
  | ['room', string, string | null]
  | ['checkin' | 'checkout', string, string]
  | ['raised' | 'cleared' | 'acknowledged', string];

export function storyEvents(events: readonly SimEvent[]): StoryEvent[] {
  const out: StoryEvent[] = [];
  for (const e of events) {
    if (e.type === 'position.room') out.push(['room', e.tagId, e.roomId]);
    else if (e.type === 'gate.checkin') out.push(['checkin', e.tagId, e.gateZoneId]);
    else if (e.type === 'gate.checkout') out.push(['checkout', e.tagId, e.gateZoneId]);
    else if (e.type === 'alert.raised') out.push(['raised', e.alert.ruleId]);
    else if (e.type === 'alert.cleared') out.push(['cleared', e.alert.ruleId]);
    else if (e.type === 'alert.acknowledged') out.push(['acknowledged', e.alert.ruleId]);
  }
  return out;
}
