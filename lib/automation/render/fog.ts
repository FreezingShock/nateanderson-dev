// Fog shared by every lit material. It is computed in the shader rather than through scene.fog so
// chunks, grass, water and objects all share one curve. The default is exactly FogExp2 (spec). An
// optional extra ground fog can be turned on with uFogHeight.
import * as THREE from "three";

export const fogUniforms = {
  uFogColor: { value: new THREE.Color(0xb87a4c) },
  uFogDensity: { value: 0.0115 },
  /** Extra fog density near the ground. 0 keeps the approved FogExp2 look. */
  uFogHeight: { value: 0 },
  /** How fast the extra ground fog thins with height. */
  uFogFalloff: { value: 0.8 },
  /** 1 gives exactly three.js FogExp2 (squared exponent). */
  uFogBase: { value: 1 },
};

type Shader = { vertexShader: string; fragmentShader: string; uniforms: Record<string, { value: unknown }> };

/**
 * Patches a MeshStandardMaterial with height fog. `cacheKey` must be unique per patched variant,
 * because three.js caches compiled programs by key when onBeforeCompile changes the source.
 * `vertex` and `fragment` run after the fog patch so a caller can add its own code (grass wind).
 */
export function applyHeightFog(
  material: THREE.MeshStandardMaterial,
  cacheKey: string,
  hooks?: { vertex?: (sh: Shader) => void; uniforms?: Record<string, { value: unknown }> },
): void {
  material.customProgramCacheKey = () => cacheKey;
  material.onBeforeCompile = (shader) => {
    const sh = shader as unknown as Shader;
    Object.assign(sh.uniforms, fogUniforms, hooks?.uniforms ?? {});
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vFogDepth;\nvarying float vFogWY;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vFogDepth = -mvPosition.z;
        #ifdef USE_INSTANCING
          vFogWY = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).y;
        #else
          vFogWY = (modelMatrix * vec4(transformed, 1.0)).y;
        #endif`,
      );
    if (hooks?.vertex) hooks.vertex(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec3 uFogColor;
        uniform float uFogDensity;
        uniform float uFogHeight;
        uniform float uFogFalloff;
        uniform float uFogBase;
        varying float vFogDepth;
        varying float vFogWY;`,
      )
      .replace(
        "#include <fog_fragment>",
        `#include <fog_fragment>
        float fogDist = uFogDensity * vFogDepth;
        float heightTerm = uFogBase + uFogHeight * exp(-uFogFalloff * max(vFogWY, 0.0));
        float fogAmt = 1.0 - exp(-fogDist * fogDist * heightTerm);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, clamp(fogAmt, 0.0, 1.0));`,
      );
  };
  material.needsUpdate = true;
}
