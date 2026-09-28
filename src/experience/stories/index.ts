import type { SceneKey, StoryDef } from '../types';
import { hospitalStories } from './hospital';
import { teaserStories } from './teaser';
import { warehouseStories } from './warehouse';

const all: StoryDef[] = [...hospitalStories, ...warehouseStories];

/** The guided stories per scene (teaser versions are not listed). */
export const storiesByScene: Record<SceneKey, StoryDef[]> = {
  hospital: all.filter((s) => s.scene === 'hospital'),
  warehouse: all.filter((s) => s.scene === 'warehouse'),
};

export { teaserStories };

export function storyById(id: string | null | undefined): StoryDef | undefined {
  return all.find((s) => s.id === id) ?? teaserStories.find((s) => s.id === id);
}
