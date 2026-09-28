import type { SceneKey, StoryDef } from '../types';
import { hospitalStories } from './hospital';

const all: StoryDef[] = [...hospitalStories];

export const storiesByScene: Record<SceneKey, StoryDef[]> = {
  hospital: all.filter((s) => s.scene === 'hospital'),
  warehouse: all.filter((s) => s.scene === 'warehouse'),
};

export function storyById(id: string | null | undefined): StoryDef | undefined {
  return all.find((s) => s.id === id);
}
