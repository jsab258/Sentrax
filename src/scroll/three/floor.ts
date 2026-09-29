import { CircleGeometry, Mesh, MeshStandardMaterial, Vector2, type Vector3 } from 'three';
import { LOOK } from './look';

export interface StageFloor {
  mesh: Mesh;
  dispose(): void;
}

/** Dark matte stage floor under the model, fading out into the background around it. */
export function buildStageFloor(center: Vector3, y: number): StageFloor {
  const radius = 34;
  const geo = new CircleGeometry(radius * 1.1, 64);
  const mat = new MeshStandardMaterial({
    color: LOOK.stageFloor.color,
    roughness: LOOK.stageFloor.roughness,
    metalness: LOOK.stageFloor.metalness,
    envMapIntensity: 0,
    transparent: true,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCenter = { value: new Vector2(center.x, center.z) };
    shader.uniforms.uRadius = { value: radius };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFloorWorld;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvFloorWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec2 uCenter;\nuniform float uRadius;\nvarying vec3 vFloorWorld;',
      )
      .replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\ngl_FragColor.a *= 1.0 - smoothstep(0.35, 1.0, length(vFloorWorld.xz - uCenter) / uRadius);',
      );
  };
  const mesh = new Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(center.x, y, center.z);
  mesh.receiveShadow = true;
  return {
    mesh,
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}
