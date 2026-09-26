import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Vector3 } from 'three';
import type { InfraKind, WorldDef } from '../../sim/world';
import { StaticModels } from '../kit/StaticModels';
import { useDisposeModels } from '../kit/useDisposeModels';
import type { Palette } from '../materials/palette';
import { Overlay } from '../overlay';
import { deviceModels, deviceSizeM } from './deviceModels';
import { devicePlacement } from './devicePlacement';
import { createMarkers, setMarkerViewport, type MarkerIcon } from './markers';

const ICON: Record<InfraKind, MarkerIcon> = { anchor: 'anchor', gateway: 'gateway', locator: 'locator' };

/** Anchors, gateways and locators at true scale, with billboard markers that hand over when zoomed in. */
export function InfrastructureDevices({ world, palette }: { world: WorldDef; palette: Palette }) {
  const models = useMemo(() => deviceModels(), []);
  useDisposeModels(models);
  const placements = useMemo(() => world.devices.map((d) => devicePlacement(world, d)), [world]);
  const markers = useMemo(
    () =>
      createMarkers(
        world.devices.map((d) => ({
          position: new Vector3(d.position.x, d.position.z - 0.05, -d.position.y),
          icon: ICON[d.kind],
          sizeM: deviceSizeM(d.model),
        })),
      ),
    [world],
  );
  const size = useThree((s) => s.size);
  useEffect(() => setMarkerViewport(markers, size.width, size.height), [markers, size.width, size.height]);
  useEffect(
    () => () => {
      markers.geometry.dispose();
      markers.dispose();
    },
    [markers],
  );
  return (
    <>
      <StaticModels models={models} placements={placements} palette={palette} castShadow={false} />
      <Overlay>
        <primitive object={markers} />
      </Overlay>
    </>
  );
}
