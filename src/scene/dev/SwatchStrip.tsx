import { useMemo } from 'react';
import { CircleGeometry, Color, MeshBasicMaterial, RingGeometry } from 'three';
import { CASING, SWATCHES } from '../../dev/swatches';
import { Overlay } from '../overlay';

/**
 * Dev-only: every overlay colour drawn in the overlay pass on the corridor floor, as a translucent disc
 * (fills) or a ring with a centre dot (marks); the back row adds the white casing.
 */
export function SwatchStrip({ from = [1.2, 11.5], step = 2.0 }: { from?: [number, number]; step?: number }) {
  const items = useMemo(() => {
    const disc = new CircleGeometry(0.42, 40).rotateX(-Math.PI / 2);
    const ring = new RingGeometry(0.3, 0.42, 40).rotateX(-Math.PI / 2);
    const dot = new CircleGeometry(0.1, 24).rotateX(-Math.PI / 2);
    const casingRing = new RingGeometry(0.24, 0.48, 40).rotateX(-Math.PI / 2);
    const casingDot = new CircleGeometry(0.16, 24).rotateX(-Math.PI / 2);
    return SWATCHES.map((s, i) => {
      const white = new MeshBasicMaterial({ color: s.casing ?? CASING, toneMapped: false, depthTest: false });
      const color = new Color(s.hex);
      const mat = new MeshBasicMaterial({
        color,
        toneMapped: false,
        depthTest: false,
        transparent: s.kind === 'fill',
        opacity: s.kind === 'fill' ? 0.55 : 1,
      });
      return {
        key: s.key,
        x: from[0] + i * step,
        kind: s.kind,
        mat,
        white,
        disc,
        ring,
        dot,
        casingRing,
        casingDot,
      };
    });
  }, [from, step]);
  return (
    <Overlay>
      {items.map((it) => {
        const [x, y] = [it.x, from[1]];
        return (
          <group key={it.key}>
            {it.kind === 'fill' ? (
              <>
                <mesh geometry={it.disc} material={it.mat} position={[x, 0.03, -(y - 0.55)]} />
                <mesh geometry={it.disc} material={it.mat} position={[x, 0.03, -(y + 0.55)]} />
              </>
            ) : (
              <>
                <mesh geometry={it.ring} material={it.mat} position={[x, 0.03, -(y - 0.55)]} />
                <mesh geometry={it.dot} material={it.mat} position={[x, 0.03, -(y - 0.55)]} />
                <mesh
                  geometry={it.casingRing}
                  material={it.white}
                  position={[x, 0.029, -(y + 0.55)]}
                  renderOrder={1}
                />
                <mesh
                  geometry={it.casingDot}
                  material={it.white}
                  position={[x, 0.029, -(y + 0.55)]}
                  renderOrder={1}
                />
                <mesh
                  geometry={it.ring}
                  material={it.mat}
                  position={[x, 0.03, -(y + 0.55)]}
                  renderOrder={2}
                />
                <mesh geometry={it.dot} material={it.mat} position={[x, 0.03, -(y + 0.55)]} renderOrder={2} />
              </>
            )}
          </group>
        );
      })}
    </Overlay>
  );
}
