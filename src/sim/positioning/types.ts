import type { Vec3 } from '../geometry';

export type Tech = 'rssi' | 'aoa' | 'bilink';

/** One technology's current estimate for a tag. */
export interface Estimate {
  tagId: string;
  tech: Tech;
  /** Simulation time the estimate was produced (s). */
  t: number;
  /** Coordinates, for RSSI and AoA. BiLink reports a room, not coordinates. */
  position?: Vec3;
  uncertaintyM?: number;
  /** BiLink room assignment. */
  roomId?: string | null;
  /** Receivers that contributed. */
  sources: string[];
  /** Time of the oldest measurement the estimate is based on (RSSI averages over a window). */
  from?: number;
}
