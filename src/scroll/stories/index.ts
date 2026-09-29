import { hospitalBilink } from './hospital-bilink';
import timeline from './hospital-bilink.timeline.json';
import type { TimelineData } from '../timeline/timeline';
import type { ScrollStory } from './types';

/** Stories and their recorded timelines, by id. */
export const scrollStories: Record<string, { story: ScrollStory; timeline: TimelineData }> = {
  [hospitalBilink.id]: { story: hospitalBilink, timeline: timeline as unknown as TimelineData },
};

export const defaultStoryId = hospitalBilink.id;
