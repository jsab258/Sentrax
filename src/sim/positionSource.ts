import type { Vec3 } from './geometry';
import type { Estimate, Tech } from './positioning/types';

/**
 * What the location system reports for a tag. The UI, the dashboard and the rule engine only ever see
 * reports, never ground truth.
 */
export interface ReportedPosition {
  tagId: string;
  /** Technology behind this report. */
  tech: Tech;
  /** Simulation time of the underlying measurement (s). */
  t: number;
  /** Coordinates for RSSI and AoA reports; absent for BiLink (room-level). */
  position?: Vec3;
  uncertaintyM?: number;
  /**
   * Only one gateway heard the tag: the position is that gateway and means "somewhere near it"
   * (uncertaintyM is the implied range), not a location estimate.
   */
  proximity?: boolean;
  /** BiLink room, when the report is room-level. */
  roomId?: string | null;
  /** Zones containing the report, including parent zones. */
  zoneIds: string[];
  /** No current estimate: this is the last known report, held since `heldSince`. */
  held?: boolean;
  heldSince?: number;
}

export type Lens = Tech | 'hybrid';

/**
 * Source of reported positions (SPEC section 6). The simulator implements it today; a live SOLIX
 * WebSocket feed can implement it later without changes to the UI.
 */
export interface PositionSource {
  /** The system's fused report (hybrid: AoA where covered, otherwise BiLink or RSSI). */
  report(tagId: string): ReportedPosition | undefined;
  reports(): ReadonlyMap<string, ReportedPosition>;
  /** A single technology's estimate, for the technology lens. */
  estimate(tagId: string, tech: Tech): Estimate | undefined;
  /** Time the system last heard from the tag (s). */
  lastSeen(tagId: string): number | undefined;
  /** Called after every update with the tags whose report changed. */
  subscribe(listener: (changedTagIds: readonly string[]) => void): () => void;
}
