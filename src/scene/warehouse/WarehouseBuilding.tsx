import { useEffect, useMemo } from 'react';
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  ShadowMaterial,
  SRGBColorSpace,
  type BufferGeometry,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { WorldDef } from '../../sim/world';
import { GROUND_HDR } from '../backdrop';
import { buildSlab, buildWalls, FLOOR_LAYERS } from '../buildingGeometry';
import { GeometryBuilder } from '../geometryBuilder';
import { cutawayDepthMaterial, withCutaway } from '../materials/cutaway';
import { usePbrMaps, type TextureTier } from '../materials/textures';
import { Occluder } from '../overlay';
import { occluderMaterial } from '../overlays/occluders';
import { DOCK_HEIGHT } from './ground';
import { floorLines } from './layout';

const LINE_COLORS = {
  lane: [0.62, 0.52, 0.16] as [number, number, number],
  walk: [0.92, 0.92, 0.9] as [number, number, number],
  zone: [0.85, 0.86, 0.87] as [number, number, number],
};

/** Floors: the hall in polished concrete with subtle zone tints, painted lines on top. */
function buildHallFloors(world: WorldDef) {
  const concrete = new GeometryBuilder();
  const tint = (id: string): [number, number, number] => {
    if (id === 'cold') return [0.92, 0.96, 1.0];
    if (id === 'office') return [0.98, 0.96, 0.92];
    if (id === 'cage') return [0.9, 0.9, 0.9];
    return [1, 1, 1];
  };
  const hall = world.zones.find((z) => z.id === 'hall');
  const rect = (id: string, y: number) => {
    const z = world.zones.find((x) => x.id === id);
    if (!z) return;
    const xs = z.polygon.map((p) => p.x);
    const ys = z.polygon.map((p) => p.y);
    concrete.floorRect(Math.min(...xs), -Math.max(...ys), Math.max(...xs), -Math.min(...ys), y, {
      color: tint(id),
    });
  };
  if (hall) rect('hall', FLOOR_LAYERS.base);
  for (const id of ['cold', 'office', 'cage']) rect(id, FLOOR_LAYERS.inset);
  const lines = new GeometryBuilder();
  for (const l of floorLines())
    lines.floorRect(l.x0, -l.y1, l.x1, -l.y0, FLOOR_LAYERS.lines, { color: LINE_COLORS[l.color] });
  // Yard: parking bay lines for the trailer parking at y -47 to -31.
  for (let x = 35; x <= 59; x += 6)
    lines.floorRect(x - 0.06, 31, x + 0.06, 47, -DOCK_HEIGHT + FLOOR_LAYERS.lines, {
      color: LINE_COLORS.walk,
    });
  return { concrete: concrete.build(), lines: lines.build() };
}

/** Pedestrian ramps from the south and east exits down to the yard. */
function buildRamps(): BufferGeometry {
  const len = 4;
  const slope = Math.atan2(DOCK_HEIGHT, len);
  const run = Math.hypot(len, DOCK_HEIGHT);
  const south = new BoxGeometry(3, 0.2, run).rotateX(-slope).translate(31.6, -DOCK_HEIGHT / 2 - 0.1, len / 2);
  const east = new BoxGeometry(run, 0.2, 3)
    .rotateZ(-slope)
    .translate(80 + len / 2, -DOCK_HEIGHT / 2 - 0.1, -20.6);
  const merged = mergeGeometries([south, east], false);
  south.dispose();
  east.dispose();
  if (!merged) throw new Error('ramp geometry');
  return merged;
}

/** Wire mesh for the battery cage fence: a small tiling texture of thin bars, mostly transparent. */
function meshTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  if (g) {
    g.clearRect(0, 0, 32, 32);
    g.fillStyle = 'rgba(150,158,166,0.7)';
    g.fillRect(0, 0, 32, 3);
    g.fillRect(0, 0, 3, 32);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  // Box UVs are in metres: a 5 cm mesh.
  t.repeat.set(20, 20);
  t.anisotropy = 4;
  return t;
}

/**
 * Hall, cold room, office and cage walls with the cutaway; floors, painted lines, the dock plinth, exit
 * ramps and the yard one dock height below the hall floor. Trailer boxes in the world data are RF walls
 * only: the trailers are drawn as tracked assets.
 */
export function WarehouseBuilding({ world, textures }: { world: WorldDef; textures: TextureTier }) {
  const cladding = usePbrMaps('cladding', textures);
  const concrete = usePbrMaps('concrete', textures, 8);
  const asphalt = usePbrMaps('asphalt', textures, 8);

  const geo = useMemo(() => {
    const floors = buildHallFloors(world);
    const walls = buildWalls(world);
    const yardW = 110;
    const yardD = 60;
    return {
      walls,
      floors,
      slab: buildSlab(world, DOCK_HEIGHT + 0.05, 0.05),
      ramps: buildRamps(),
      yard: new PlaneGeometry(yardW, yardD).rotateX(-Math.PI / 2).translate(40, -DOCK_HEIGHT, yardD / 2 - 2),
      ground: new PlaneGeometry(420, 420).rotateX(-Math.PI / 2).translate(40, -DOCK_HEIGHT - 0.02, 0),
    };
  }, [world]);

  const mat = useMemo(() => {
    const wall = withCutaway(
      new MeshStandardMaterial({ ...cladding, color: new Color('#e9ebec'), vertexColors: true }),
    );
    const glass = withCutaway(
      new MeshStandardMaterial({
        color: '#dbe7ee',
        roughness: 0.04,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        side: DoubleSide,
        envMapIntensity: 1.6,
      }),
    );
    const fence = withCutaway(
      new MeshStandardMaterial({
        map: meshTexture(),
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        metalness: 0.6,
        roughness: 0.4,
      }),
    );
    return {
      wall,
      glass,
      fence,
      floor: new MeshStandardMaterial({ ...concrete, color: new Color('#ffffff'), vertexColors: true }),
      lines: new MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.6,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
      slab: new MeshStandardMaterial({ ...concrete, color: new Color('#a9aaa7') }),
      yard: new MeshStandardMaterial({ ...asphalt, color: new Color('#9a9b9d') }),
      ground: new MeshBasicMaterial({ color: GROUND_HDR }),
      catcher: new ShadowMaterial({ color: '#1d2230', opacity: 0.22 }),
      depth: cutawayDepthMaterial(),
      occluder: occluderMaterial(true),
    };
  }, [cladding, concrete, asphalt]);

  useEffect(
    () => () => {
      const all: Array<BufferGeometry | undefined> = [
        ...Object.values(geo.walls),
        geo.floors.concrete,
        geo.floors.lines,
        geo.slab,
        geo.ramps,
        geo.yard,
        geo.ground,
      ];
      for (const g of all) g?.dispose();
    },
    [geo],
  );
  useEffect(
    () => () => {
      mat.fence.map?.dispose();
      for (const m of Object.values(mat) as Material[]) m.dispose();
    },
    [mat],
  );

  const { walls } = geo;
  return (
    <group name="warehouse-building">
      {walls.solid && (
        <mesh
          geometry={walls.solid}
          material={mat.wall}
          customDepthMaterial={mat.depth}
          castShadow
          receiveShadow
        />
      )}
      {walls.frame && (
        <mesh geometry={walls.frame} material={mat.wall} customDepthMaterial={mat.depth} castShadow />
      )}
      {walls.glass && <mesh geometry={walls.glass} material={mat.glass} renderOrder={2} />}
      {walls.mesh && <mesh geometry={walls.mesh} material={mat.fence} renderOrder={2} />}
      <mesh geometry={geo.floors.concrete} material={mat.floor} receiveShadow />
      <mesh geometry={geo.floors.lines} material={mat.lines} receiveShadow />
      <mesh geometry={geo.slab} material={mat.slab} receiveShadow />
      <mesh geometry={geo.ramps} material={mat.slab} receiveShadow castShadow />
      <mesh geometry={geo.yard} material={mat.yard} receiveShadow />
      <Occluder>
        {walls.solid && <mesh geometry={walls.solid} material={mat.occluder} />}
        {walls.frame && <mesh geometry={walls.frame} material={mat.occluder} />}
      </Occluder>
      <mesh geometry={geo.ground} material={mat.ground} />
      <mesh geometry={geo.ground} material={mat.catcher} position-y={FLOOR_LAYERS.catcher} receiveShadow />
    </group>
  );
}
