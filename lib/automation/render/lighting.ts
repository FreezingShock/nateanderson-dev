// Sun, hemisphere, fill and rim lights, the furnace lamps, and the sky dome. Values interpolate
// between TIME_KEYS (dusk is the approved look). The fill and rim lights are fixed.
import * as THREE from "three";
import {
    FILL_LIGHT,
    LAMP_DISTANCE,
    LAMP_POSITIONS,
    RIM_LIGHT,
    SUN_POSITION,
    TIME_KEYS,
    type TimeKey,
} from "./config";
import { fogUniforms } from "./fog";
import { SkyDome } from "./sky";

export class Lighting {
    readonly hemi: THREE.HemisphereLight;
    readonly sun: THREE.DirectionalLight;
    readonly lamps: THREE.PointLight[] = [];
    readonly sky: SkyDome;
    private readonly colA = new THREE.Color();
    private readonly colB = new THREE.Color();
    private lastT = -1;

    constructor(scene: THREE.Scene, shadowMapSize: number) {
        this.hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 2);
        scene.add(this.hemi);

        this.sun = new THREE.DirectionalLight(0xffffff, 3);
        this.sun.position.set(...SUN_POSITION);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
        Object.assign(this.sun.shadow.camera, {
            left: -14,
            right: 14,
            top: 12,
            bottom: -12,
            near: 1,
            far: 50,
        });
        this.sun.shadow.bias = -0.0006;
        scene.add(this.sun);

        const fill = new THREE.DirectionalLight(
            FILL_LIGHT.color,
            FILL_LIGHT.intensity
        );
        fill.position.set(...FILL_LIGHT.position);
        scene.add(fill);
        const rim = new THREE.DirectionalLight(
            RIM_LIGHT.color,
            RIM_LIGHT.intensity
        );
        rim.position.set(...RIM_LIGHT.position);
        scene.add(rim);

        for (const [x, y, z] of LAMP_POSITIONS) {
            const lamp = new THREE.PointLight(0xff8a2a, 30, LAMP_DISTANCE);
            lamp.position.set(x, y, z);
            scene.add(lamp);
            this.lamps.push(lamp);
        }

        this.sky = new SkyDome(scene);
        this.setTime(0.5, false);
    }

    setShadows(on: boolean): void {
        this.sun.castShadow = on;
    }

    /** Sets the time of day in 0..1 (wraps). `flicker` adds the lamp shimmer. */
    setTime(t: number, flicker = true): void {
        const tt = ((t % 1) + 1) % 1;
        if (Math.abs(tt - this.lastT) < 1e-4 && !flicker) return;
        this.lastT = tt;
        const [a, b, k] = segment(tt);
        this.sun.color.copy(
            this.colA.setHex(a.sunColor).lerp(this.colB.setHex(b.sunColor), k)
        );
        this.sun.intensity = lerp(a.sunIntensity, b.sunIntensity, k);
        this.hemi.color.copy(
            this.colA.setHex(a.hemiSky).lerp(this.colB.setHex(b.hemiSky), k)
        );
        this.hemi.groundColor.copy(
            this.colA
                .setHex(a.hemiGround)
                .lerp(this.colB.setHex(b.hemiGround), k)
        );
        this.hemi.intensity = lerp(a.hemiIntensity, b.hemiIntensity, k);
        fogUniforms.uFogColor.value.copy(
            this.colA.setHex(a.fogColor).lerp(this.colB.setHex(b.fogColor), k)
        );
        fogUniforms.uFogDensity.value = lerp(a.fogDensity, b.fogDensity, k);
        const shimmer = flicker
            ? 1 +
              0.04 * Math.sin(tt * 2 * Math.PI * 240) +
              0.02 * Math.sin(tt * 2 * Math.PI * 610)
            : 1;
        const lampLevel = lerp(a.lampIntensity, b.lampIntensity, k) * shimmer;
        for (const lamp of this.lamps) lamp.intensity = lampLevel;
        this.sky.setColors(
            a.fogColor === b.fogColor
                ? a.fogColor
                : mixHex(a.fogColor, b.fogColor, k),
            mixHex(a.skyMid, b.skyMid, k),
            mixHex(a.skyTop, b.skyTop, k)
        );
    }

    dispose(): void {
        this.sky.dispose();
    }
}

function segment(t: number): [TimeKey, TimeKey, number] {
    const keys = TIME_KEYS;
    for (let i = 0; i < keys.length - 1; i++) {
        const a = keys[i];
        const b = keys[i + 1];
        if (t >= a.t && t <= b.t) return [a, b, (t - a.t) / (b.t - a.t || 1)];
    }
    return [keys[0], keys[0], 0];
}

function mixHex(a: number, b: number, k: number): number {
    return new THREE.Color(a).lerp(new THREE.Color(b), k).getHex();
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}
