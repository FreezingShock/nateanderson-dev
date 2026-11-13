// Evaluate a part's looping motion at time t (seconds of the machine's own working clock).

import type { Axis, PartAnim, ModelState } from "../format";

/**
 * The shared PartAnim plus two things the machines need (requested from the Renderer thread):
 * kind "swing" (rock about the axis, amp in radians) and `wave` on slides ("stamp" slams down then
 * lifts slowly, "crank" follows a crank and rod). A renderer that ignores `wave` falls back to a sine.
 */
export interface MachineAnim {
    kind: PartAnim["kind"] | "swing";
    axis: Axis;
    speed: number;
    amp: number;
    phase: number;
    when: ModelState;
    wave?: "sine" | "stamp" | "crank";
}

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

/** Wave in -1..1. */
export function wave(kind: MachineAnim["wave"], p: number): number {
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
        return x - L; // spans -1..1 as the crank turns
    }
    return Math.sin(f * TAU);
}

/** Pose of an animated part at time t. Feed t from the machine's own clock so parts stop where they are. */
export function poseAt(anim: MachineAnim | PartAnim | undefined, t: number, working = true): PartPose {
    const pose: PartPose = { angle: 0, offset: 0, axis: anim?.axis ?? "y", glow: 1 };
    if (!anim) return pose;
    const active = anim.when === "always" || (anim.when === "working" && working) || (anim.when === "idle" && !working);
    if (anim.kind === "pulse") {
        pose.glow = active ? 1 - anim.amp / 2 + (anim.amp / 2) * Math.sin(frac(t * anim.speed + anim.phase) * TAU) : 0.18;
        return pose;
    }
    if (!active) return pose;
    const p = t * anim.speed + anim.phase;
    if (anim.kind === "spin") pose.angle = (t * anim.speed + anim.phase) * TAU;
    else if (anim.kind === "swing") pose.angle = anim.amp * Math.sin(frac(p) * TAU);
    else if (anim.kind === "bob") pose.offset = anim.amp * Math.sin(frac(p) * TAU);
    else pose.offset = anim.amp * wave((anim as MachineAnim).wave, p);
    return pose;
}
