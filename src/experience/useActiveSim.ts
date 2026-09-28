import { activeSim } from './runtime';
import { useExperience } from './store';

/** The active simulation; components re-render (and rebuild their systems) when it is replaced. */
export function useActiveSim() {
  useExperience((s) => s.simVersion);
  useExperience((s) => s.mode);
  useExperience((s) => s.scene);
  return activeSim();
}
