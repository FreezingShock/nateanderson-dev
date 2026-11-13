// Sea plane at WATER_LEVEL, spec colour. The surface has a two-wave vertex displacement with a
// small amplitude, so it reads as moving water without changing the approved colour. The blue fix
// is not approved yet (LOOK-SPEC.md), so it stays at the reference colour for now.
import * as THREE from "three";
import { WATER_HEX, WATER_LEVEL, WATER_OPACITY } from "./config";
import { animUniforms } from "./grass";
import { applyHeightFog } from "./fog";

export function buildWater(extent = 240): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(extent, extent, 96, 96);
  const material = new THREE.MeshStandardMaterial({
    color: WATER_HEX,
    roughness: 0.25,
    metalness: 0.2,
    transparent: true,
    opacity: WATER_OPACITY,
  });
  applyHeightFog(material, "water-wave", {
    uniforms: animUniforms,
    vertex: (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform float uWave;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          transformed.z += (sin(position.x * 0.4 + uTime * 1.2) * 0.05 + cos(position.y * 0.33 - uTime * 0.9) * 0.05) * uWave;`,
        );
    },
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = WATER_LEVEL;
  mesh.receiveShadow = true;
  return mesh;
}
