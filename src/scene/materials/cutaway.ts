import { MeshDepthMaterial, RGBADepthPacking, Vector2, type Material } from 'three';

/**
 * Dollhouse cutaway (SPEC section 7): ceilings are not built, and walls that face the camera are cut
 * down to `uCutHeight` in the vertex shader. Each wall compares its normal with the horizontal ray from
 * the camera to the wall's centre, so walls at the edge of a perspective view behave like central ones.
 *
 * Geometry carries per-vertex attributes (see GeometryBuilder):
 * - aWallNormal: horizontal wall normal in the xz plane; zero for anything that is not a wall.
 * - aWallCenter: the wall's centre (xz), shared by all its pieces so a wall cuts as one.
 * - aExterior: 1 when aWallNormal points outwards. Exterior walls on the near side are cut, the far
 *   side stays full height. Interior walls are cut by how directly they face the camera.
 * - aTop: kept for callers that need to know the top face; every vertex is clamped, so wall pieces that
 *   lie entirely above the cut (window heads) fold down onto it.
 *
 * Geometry is built in world coordinates, so position.y is the height above the floor.
 */
export const cutawayUniforms = {
  /** Camera position (x, z). */
  uCamPos: { value: new Vector2(0, 30) },
  uCutHeight: { value: 1.1 },
  /** 0 shows full-height walls, 1 applies the cutaway. */
  uCutAmount: { value: 1 },
};

const vertexHeader = /* glsl */ `
attribute vec2 aWallNormal;
attribute vec2 aWallCenter;
attribute float aExterior;
uniform vec2 uCamPos;
uniform float uCutHeight;
uniform float uCutAmount;
`;

const vertexCut = /* glsl */ `
vec2 cutRay = aWallCenter - uCamPos;
float cutFacing = dot(aWallNormal, cutRay / max(length(cutRay), 0.001));
float cutK = aExterior > 0.5 ? smoothstep(0.05, 0.3, -cutFacing) : smoothstep(0.3, 0.6, abs(cutFacing));
cutK *= uCutAmount * step(0.0001, dot(aWallNormal, aWallNormal));
float cutY = mix(position.y, min(position.y, uCutHeight), cutK);
vec2 cutUv = uv;
// Side faces map v to height in metres; keep the texture scale when the wall is shortened.
if (abs(normal.y) < 0.5) cutUv.y = cutY;
#define uv cutUv
#include <uv_vertex>
#undef uv
`;

function patch(shader: { uniforms: Record<string, { value: unknown }>; vertexShader: string }): void {
  Object.assign(shader.uniforms, cutawayUniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${vertexHeader}`)
    .replace('#include <uv_vertex>', vertexCut)
    .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y = cutY;');
}

/** Adds the cutaway to a material (in place) and returns it. */
export function withCutaway<T extends Material>(material: T): T {
  material.onBeforeCompile = patch;
  material.customProgramCacheKey = () => 'sentrax-cutaway';
  return material;
}

/** Depth material for shadow casting, so cut walls cast cut shadows. */
export function cutawayDepthMaterial(): MeshDepthMaterial {
  return withCutaway(new MeshDepthMaterial({ depthPacking: RGBADepthPacking }));
}
