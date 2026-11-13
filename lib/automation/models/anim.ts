// Evaluates a part's looping motion at time t (seconds of the machine's own working clock).
// Feed t from the machine's own clock so parts stop where they are when the machine idles.
import type { AnimWave, Axis, ModelState, PartAnim } from "./format";

export interface PartPose {
    /** Rotation about `axis` through the pivot, radians. */
    angle: number;
    /** Offset along `axis`, in voxels. */
    offset: number;
    axis: Axis;
    /** Glow strength, 0..1. 1 for parts without a pulse. */
    glow: number;
}

const TAU = Math.PI * 2;
const frac = (v: number) => v - Math.floor(v);

/** Wave in -1..1 for a cycle position p (any real number; the fraction is used). */
export function wave(kind: AnimWave | undefined, p: number): number {
    const f = frac(p);
    if (kind === "stamp") {
        // Up at +1, slams to -1 in the first 12% of the cycle, dwells, then lifts slowly.
        if (f < 0.12) return 1 - 2 * (f / 0.12) ** 2;
        if (f < 0.22) return -1;
        const u = (f - 0.22) / 0.78;
        return -1 + 2 * (u * u * (3 - 2 * u));
    }
    if (kind === "crank") {
        // Piston on a crank with rod length 3x the throw, normalised to -1..1.
        const th = f * TAU;
        const L = 3;
        const x = Math.cos(th) + Math.sqrt(L * L - Math.sin(th) ** 2);
        return x - L;
    }
    return Math.sin(f * TAU);
}

/** Pose of an animated part at time t, for a machine that is working or idle. */
export function poseAt(
    anim: PartAnim | undefined,
    t: number,
    working = true
): PartPose {
    const pose: PartPose = {
        angle: 0,
        offset: 0,
        axis: anim?.axis ?? "y",
        glow: 1,
    };
    if (!anim) return pose;
    const active =
        anim.when === "always" ||
        (anim.when === "working" && working) ||
        (anim.when === "idle" && !working);
    if (anim.kind === "pulse") {
        pose.glow = active
            ? 1 -
              anim.amp / 2 +
              (anim.amp / 2) * Math.sin(frac(t * anim.speed + anim.phase) * TAU)
            : 0.18;
        return pose;
    }
    if (!active) return pose;
    const p = t * anim.speed + anim.phase;
    if (anim.kind === "spin") pose.angle = p * TAU;
    else if (anim.kind === "swing")
        pose.angle = anim.amp * Math.sin(frac(p) * TAU);
    else if (anim.kind === "bob")
        pose.offset = anim.amp * Math.sin(frac(p) * TAU);
    else pose.offset = anim.amp * wave(anim.wave, p);
    return pose;
}
