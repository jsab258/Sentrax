import type { CardId } from '../../content/alerts';

/**
 * Where the Data layer sits for each scene (SPEC section 5): a clean network plane beside the building
 * with the SOLIX node and the integration target cards. Plan coordinates (x east, y north), height in m.
 */
export interface NetworkLayout {
  plane: { x0: number; y0: number; x1: number; y1: number; height: number };
  solix: [number, number];
  cards: Array<{ id: CardId; at: [number, number]; protocol: 'rest' | 'websocket' }>;
  /** Network closet the conventional comparison runs its cables to. */
  closet: [number, number, number];
}

export const networkLayouts: Record<string, NetworkLayout> = {
  hospital: {
    // North of the ward, raised above the walls so it never covers a room from the default view.
    plane: { x0: 4, y0: 23, x1: 38, y1: 29, height: 5 },
    solix: [9, 26],
    cards: [
      { id: 'alarm', at: [21, 27.6], protocol: 'websocket' },
      { id: 'his', at: [34, 24.6], protocol: 'rest' },
    ],
    closet: [33.3, 9.5, 2.6],
  },
};
