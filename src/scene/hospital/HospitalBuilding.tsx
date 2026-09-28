import { useEffect, useMemo } from 'react';
import {
  CircleGeometry,
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  ShadowMaterial,
  type BufferGeometry,
  type Material,
} from 'three';
import type { WorldDef } from '../../sim/world';
import { GROUND_HDR } from '../backdrop';
import { buildDoors, buildFloors, buildSlab, buildWalls } from '../buildingGeometry';
import { cutawayDepthMaterial, withCutaway } from '../materials/cutaway';
import { Occluder } from '../overlay';
import { occluderMaterial } from '../overlays/occluders';
import { usePbrMaps, type TextureTier } from '../materials/textures';
import { hospitalVisualDoors, hospitalWindows } from './dressing';

/** Walls, windows, doors, floors, slab and ground of the ward: a handful of merged meshes. */
export function HospitalBuilding({ world, textures }: { world: WorldDef; textures: TextureTier }) {
  const plaster = usePbrMaps('plaster', textures);
  const vinyl = usePbrMaps('vinyl', textures, 8);
  const tiles = usePbrMaps('bath-tiles', textures);
  const veneer = usePbrMaps('veneer', textures);

  const geo = useMemo(
    () => ({
      walls: buildWalls(world, hospitalWindows, hospitalVisualDoors),
      floors: buildFloors(world),
      doors: buildDoors(world, hospitalVisualDoors),
      slab: buildSlab(world),
      ground: new CircleGeometry(140, 64).rotateX(-Math.PI / 2).translate(20, -0.302, -10),
    }),
    [world],
  );

  const mat = useMemo(() => {
    const wall = withCutaway(
      new MeshStandardMaterial({ ...plaster, color: new Color('#f3f1ed'), vertexColors: true }),
    );
    const frame = withCutaway(
      new MeshStandardMaterial({ color: '#b9bec4', metalness: 0.6, roughness: 0.35, vertexColors: true }),
    );
    const glass = withCutaway(
      new MeshStandardMaterial({
        color: '#dbe7ee',
        metalness: 0,
        roughness: 0.04,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        side: DoubleSide,
        envMapIntensity: 1.6,
      }),
    );
    const leaf = withCutaway(
      new MeshStandardMaterial({ ...veneer, color: new Color('#e8e2d8'), vertexColors: true }),
    );
    const steel = withCutaway(
      new MeshStandardMaterial({ color: '#c4c8cc', metalness: 0.85, roughness: 0.32, vertexColors: true }),
    );
    const floor = new MeshStandardMaterial({ ...vinyl, vertexColors: true });
    const bath = new MeshStandardMaterial({ ...tiles, color: new Color('#f4f4f2') });
    const slab = new MeshStandardMaterial({ color: '#bfc2c5', roughness: 0.92 });
    // Unlit light ground (tone mapped to the page-like background) plus a shadow catcher on top.
    const ground = new MeshBasicMaterial({ color: GROUND_HDR });
    const catcher = new ShadowMaterial({ color: '#1d2230', opacity: 0.22 });
    return {
      wall,
      frame,
      glass,
      leaf,
      steel,
      floor,
      bath,
      slab,
      ground,
      catcher,
      depth: cutawayDepthMaterial(),
      occluder: occluderMaterial(true),
    };
  }, [plaster, vinyl, tiles, veneer]);

  useEffect(
    () => () => {
      const all: Array<BufferGeometry | undefined> = [
        ...Object.values(geo.walls),
        ...Object.values(geo.floors),
        ...Object.values(geo.doors),
        geo.slab,
        geo.ground,
      ];
      for (const g of all) g?.dispose();
    },
    [geo],
  );
  useEffect(
    () => () => {
      for (const m of Object.values(mat) as Material[]) m.dispose();
    },
    [mat],
  );

  const { walls, floors, doors } = geo;
  return (
    <group name="hospital-building">
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
        <mesh geometry={walls.frame} material={mat.frame} customDepthMaterial={mat.depth} castShadow />
      )}
      {walls.glass && <mesh geometry={walls.glass} material={mat.glass} renderOrder={2} />}
      {doors.leaf && (
        <mesh
          geometry={doors.leaf}
          material={mat.leaf}
          customDepthMaterial={mat.depth}
          castShadow
          receiveShadow
        />
      )}
      {doors.steel && <mesh geometry={doors.steel} material={mat.steel} receiveShadow />}
      {floors.vinyl && <mesh geometry={floors.vinyl} material={mat.floor} receiveShadow />}
      {floors.tiles && <mesh geometry={floors.tiles} material={mat.bath} receiveShadow />}
      <mesh geometry={geo.slab} material={mat.slab} receiveShadow />
      <Occluder>
        {walls.solid && <mesh geometry={walls.solid} material={mat.occluder} />}
        {walls.frame && <mesh geometry={walls.frame} material={mat.occluder} />}
        {doors.leaf && <mesh geometry={doors.leaf} material={mat.occluder} />}
        {doors.steel && <mesh geometry={doors.steel} material={mat.occluder} />}
      </Occluder>
      <mesh geometry={geo.ground} material={mat.ground} />
      <mesh geometry={geo.ground} material={mat.catcher} position-y={0.001} receiveShadow />
    </group>
  );
}
