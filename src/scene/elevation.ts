/**
 * Height of the ground under a plan position, relative to the building floor (m). The simulation is 2.5D:
 * heights are above the local floor. A scene with more than one ground level (the warehouse yard lies
 * below its loading docks) passes its own function to the renderers, which add it to every position they
 * draw; the simulation and its tests are unaffected.
 */
export type Elevation = (x: number, y: number) => number;

export const flatGround: Elevation = () => 0;
