// Sea plane at WATER_LEVEL. The surface keeps the two-wave vertex displacement, and the shader now
// paints the water itself: a deep colour that steps up to a shallow shelf colour over the sand (read
// from a baked height map of the island), animated foam lines that roll in on the shore, a broad
// warm sheen on the sun side and sparkling glints that follow the sun by day and the moon at night.
// Colour steps are quantised so the dither pass keeps clean bands instead of mush.
import * as THREE from "three";
import {
    DEFAULT_WATER,
    WATER_LEVEL,
    WATER_OPACITY,
    WATER_PALETTES,
    type WaterPaletteName,
} from "./config";
import { animUniforms } from "./grass";
import { applyHeightFog } from "./fog";
import { heightAt } from "./terrain";

/** Area the shore height map covers, in world units. Outside it the sea is deep everywhere. */
const MAP_MIN_X = -40;
const MAP_MIN_Z = -36;
const MAP_W = 80;
const MAP_D = 72;
const MAP_RES = 2; // texels per world unit
/** Height range the map stores, relative to the water line. */
const H_LO = -4;
const H_HI = 1;

export interface Water {
    readonly mesh: THREE.Mesh;
    /** Light level for foam (1 day, lower at night) and the glint direction (sun or moon). */
    update(light: number, glintDir: THREE.Vector3, glintColor: THREE.Color): void;
    setPalette(name: WaterPaletteName): void;
    dispose(): void;
}

function bakeShoreMap(): THREE.DataTexture {
    const w = MAP_W * MAP_RES;
    const d = MAP_D * MAP_RES;
    const data = new Uint8Array(w * d * 4);
    for (let j = 0; j < d; j++)
        for (let i = 0; i < w; i++) {
            const x = MAP_MIN_X + (i + 0.5) / MAP_RES;
            const z = MAP_MIN_Z + (j + 0.5) / MAP_RES;
            const rel = heightAt(x, z) - WATER_LEVEL;
            const v = Math.max(0, Math.min(1, (rel - H_LO) / (H_HI - H_LO)));
            const o = (j * w + i) * 4;
            data[o] = Math.round(v * 255);
            data[o + 3] = 255;
        }
    const tex = new THREE.DataTexture(data, w, d, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
}

export function buildWater(extent = 900): Water {
    // Wide enough to meet the horizon islands; the wave mesh is densest where the camera looks.
    const geo = new THREE.PlaneGeometry(extent, extent, 220, 220);
    const pal = WATER_PALETTES[DEFAULT_WATER];
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.3,
        metalness: 0.15,
        transparent: true,
        opacity: WATER_OPACITY,
    });
    const shore = bakeShoreMap();
    const uniforms = {
        ...animUniforms,
        uShore: { value: shore },
        uShoreMin: { value: new THREE.Vector2(MAP_MIN_X, MAP_MIN_Z) },
        uShoreSize: { value: new THREE.Vector2(MAP_W, MAP_D) },
        uDeep: { value: new THREE.Color(pal.deep) },
        uShallow: { value: new THREE.Color(pal.shallow) },
        uFoam: { value: new THREE.Color(pal.foam) },
        uLight: { value: 1 },
        uGlintDir: { value: new THREE.Vector3(0.7, 0.075, -0.71).normalize() },
        uGlintCol: { value: new THREE.Color(0xffd08a) },
    };
    applyHeightFog(material, "water-shaded", {
        uniforms,
        vertex: (sh) => {
            sh.vertexShader = sh.vertexShader
                .replace(
                    "#include <common>",
                    "#include <common>\nuniform float uTime;\nuniform float uWave;\nvarying vec3 vWPos;"
                )
                .replace(
                    "#include <begin_vertex>",
                    `#include <begin_vertex>
          transformed.z += (sin(position.x * 0.4 + uTime * 1.2) * 0.05 + cos(position.y * 0.33 - uTime * 0.9) * 0.05) * uWave;`
                )
                .replace(
                    "#include <worldpos_vertex>",
                    `#include <worldpos_vertex>
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
                );
        },
        fragment: (sh) => {
            sh.fragmentShader = sh.fragmentShader
                .replace(
                    "#include <common>",
                    `#include <common>
        uniform float uTime;
        uniform float uWave;
        uniform sampler2D uShore;
        uniform vec2 uShoreMin;
        uniform vec2 uShoreSize;
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform vec3 uFoam;
        uniform float uLight;
        uniform vec3 uGlintDir;
        uniform vec3 uGlintCol;
        varying vec3 vWPos;
        float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float shoreDepth() {
          vec2 uv = (vWPos.xz - uShoreMin) / uShoreSize;
          if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 9.0;
          float rel = mix(${H_LO.toFixed(1)}, ${H_HI.toFixed(1)}, texture2D(uShore, uv).r);
          return -rel;
        }`
                )
                .replace(
                    "#include <color_fragment>",
                    `#include <color_fragment>
        float wDepth = shoreDepth();
        float shelf = 1.0 - smoothstep(0.0, 2.6, wDepth);
        shelf = floor(shelf * 4.0 + 0.5) / 4.0;
        diffuseColor.rgb = mix(uDeep, uShallow, shelf);`
                )
                .replace(
                    "#include <fog_fragment>",
                    `{
          // Foam: a solid lip at the waterline plus lines that roll in toward the sand.
          float lip = 1.0 - smoothstep(0.02, 0.14, wDepth);
          float roll = fract(wDepth * 2.4 + uTime * 0.32);
          float lines = step(0.78, roll) * (1.0 - smoothstep(0.1, 0.9, wDepth));
          float breakup = step(0.35, wHash(floor(vWPos.xz * 3.0)));
          float foam = max(lip, lines * breakup) * step(-0.05, wDepth);
          // Open-sea whitecaps, sparse and slow.
          float cap = step(0.992, wHash(floor(vWPos.xz * 0.9) + floor(uTime * 0.6 + wHash(floor(vWPos.xz * 0.9)) * 7.0))) * step(1.5, wDepth) * uWave;
          foam = max(foam, cap * 0.6);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uFoam * uLight, clamp(foam, 0.0, 1.0) * 0.85);

          // Sun or moon path: a broad sheen plus sparkling glints.
          vec3 vdir = normalize(cameraPosition - vWPos);
          vec3 ref = reflect(-vdir, vec3(0.0, 1.0, 0.0));
          float toward = max(dot(ref, normalize(uGlintDir)), 0.0);
          float sheen = pow(toward, 9.0) * 0.28;
          float spark = step(0.9, wHash(floor(vWPos.xz * 2.6) + floor(uTime * 3.0 * uWave)));
          float glint = pow(toward, 30.0) * spark * 1.6;
          gl_FragColor.rgb += uGlintCol * (sheen + glint);
        }
        #include <fog_fragment>`
                );
        },
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = WATER_LEVEL;
    mesh.receiveShadow = true;
    return {
        mesh,
        update(light, glintDir, glintColor) {
            uniforms.uLight.value = light;
            uniforms.uGlintDir.value.copy(glintDir);
            uniforms.uGlintCol.value.copy(glintColor);
        },
        setPalette(name) {
            const p = WATER_PALETTES[name] ?? pal;
            uniforms.uDeep.value.setHex(p.deep);
            uniforms.uShallow.value.setHex(p.shallow);
            uniforms.uFoam.value.setHex(p.foam);
        },
        dispose() {
            geo.dispose();
            material.dispose();
            shore.dispose();
        },
    };
}
