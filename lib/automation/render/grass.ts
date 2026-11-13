// Instanced grass. Each blade is two crossed quads; the vertex shader sways the tip with a wind
// field that varies with blade position. The draw count can be cut at runtime (`setDensity`), so
// the governor can thin grass without rebuilding anything.
import * as THREE from "three";
import { GRASS_HEX } from "./config";
import { makeRandom } from "./noise";
import { applyHeightFog } from "./fog";

/** Shared animation values. Set `uWind` or `uWave` to 0 to freeze motion (low-fx). */
export const animUniforms = {
    uTime: { value: 0 },
    uWind: { value: 1 },
    uWave: { value: 1 },
};

const BLADE_HEIGHT = 0.36;
const BLADE_HALF_WIDTH = 0.025;

function bladeGeometry(): THREE.BufferGeometry {
    const h = BLADE_HEIGHT;
    const w = BLADE_HALF_WIDTH;
    // Quad A lies in the XY plane, quad B in the ZY plane, so a blade reads from any side.
    const positions = [
        -w,
        0,
        0,
        w,
        0,
        0,
        w,
        h,
        0,
        -w,
        h,
        0,
        0,
        0,
        -w,
        0,
        0,
        w,
        0,
        h,
        w,
        0,
        h,
        -w,
    ];
    const normals = [
        0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    ];
    // Sway weight is 0 at the root and 1 at the tip, so the tip moves and the root stays put.
    const ys = [0, 0, 1, 1, 0, 0, 1, 1];
    const sway = ys.slice();
    const colors: number[] = [];
    for (let v = 0; v < 8; v++) {
        const shade = 0.55 + 0.45 * ys[v];
        colors.push(shade, shade, shade);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3)
    );
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute("aSway", new THREE.Float32BufferAttribute(sway, 1));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    return geo;
}

export class GrassLayer {
    readonly mesh: THREE.InstancedMesh;
    private readonly capacity: number;

    constructor(
        sites: [number, number, number][],
        bladesPerSite: number,
        seed: number
    ) {
        const rnd = makeRandom(seed);
        const geo = bladeGeometry();
        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.9,
            metalness: 0,
        });
        applyHeightFog(material, "grass-wind", {
            uniforms: animUniforms,
            vertex: (sh) => {
                sh.vertexShader = sh.vertexShader
                    .replace(
                        "#include <common>",
                        "#include <common>\nattribute float aSway;\nuniform float uTime;\nuniform float uWind;"
                    )
                    .replace(
                        "#include <begin_vertex>",
                        `#include <begin_vertex>
            float phase = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 1.3;
            float gust = (sin(uTime * 1.9 + phase) * 0.09 + sin(uTime * 3.3 + phase * 2.1) * 0.03) * uWind;
            transformed.x += gust * aSway * 1.08;
            transformed.z += gust * 0.6 * aSway * 1.08;`
                    );
            },
        });

        this.capacity = Math.max(1, sites.length * bladesPerSite);
        this.mesh = new THREE.InstancedMesh(geo, material, this.capacity);
        this.mesh.frustumCulled = false;
        const m4 = new THREE.Matrix4();
        const quat = new THREE.Quaternion();
        const pos = new THREE.Vector3();
        const scale = new THREE.Vector3();
        const euler = new THREE.Euler();
        const col = new THREE.Color();
        let n = 0;
        for (const [x, y, z] of sites) {
            for (let b = 0; b < bladesPerSite; b++) {
                pos.set(x + (rnd() - 0.5) * 0.17, y, z + (rnd() - 0.5) * 0.17);
                euler.set(
                    (rnd() - 0.5) * 0.3,
                    rnd() * Math.PI,
                    (rnd() - 0.5) * 0.3
                );
                quat.setFromEuler(euler);
                const s = 0.7 + rnd() * 1.1;
                scale.set(1, s, 1);
                m4.compose(pos, quat, scale);
                this.mesh.setMatrixAt(n, m4);
                col.setHex(
                    GRASS_HEX[Math.floor(rnd() * GRASS_HEX.length)]
                ).multiplyScalar(1 + rnd() * 0.25);
                this.mesh.setColorAt(n, col);
                n++;
            }
        }
        this.mesh.count = n;
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }

    get total(): number {
        return this.capacity;
    }

    /** Draws only the first `fraction` of blades. Blades are in random order, so this stays even. */
    setDensity(fraction: number): void {
        this.mesh.count = Math.floor(
            this.capacity * Math.min(1, Math.max(0, fraction))
        );
    }

    dispose(): void {
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
        this.mesh.dispose();
    }
}
