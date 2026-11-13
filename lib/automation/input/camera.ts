import { type Vec3, clamp, vec } from "./math";
import { type View, eyeFrom } from "./picking";

export interface CameraBounds {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
}

export interface CameraLimits {
    bounds: CameraBounds;
    minDistance: number;
    maxDistance: number;
    minPitch: number;
    maxPitch: number;
    topDownPitch: number;
    fovY: number;
    // How fast zoom, rotate and tilt settle toward their goal, in 1/s. Higher is snappier.
    smoothing: number;
}

export interface OrbitPose {
    target: Vec3;
    yaw: number;
    pitch: number;
    distance: number;
}

export const DEFAULT_LIMITS: CameraLimits = {
    bounds: { minX: -4, maxX: 36, minZ: -4, maxZ: 36 },
    minDistance: 6,
    maxDistance: 70,
    minPitch: 0.35,
    maxPitch: 1.2,
    topDownPitch: 1.5,
    fovY: 0.8,
    smoothing: 12,
};

// Orbit camera around a target on the ground. The "pose" is what the renderer reads each frame.
// Pan is applied straight away so the map follows the finger. Zoom, rotate, tilt and the top-down
// toggle ease toward their goals inside update(dt).
export class OrbitCamera {
    readonly limits: CameraLimits;
    private cur: OrbitPose;
    private goal: OrbitPose;
    private topDown = false;
    private savedPitch: number;

    constructor(limits: CameraLimits = DEFAULT_LIMITS, initial: Partial<OrbitPose> = {}) {
        this.limits = limits;
        const start: OrbitPose = {
            target: initial.target ?? vec(16, 0, 16),
            yaw: initial.yaw ?? 0.6,
            pitch: initial.pitch ?? 0.9,
            distance: initial.distance ?? 30,
        };
        this.cur = this.clampPose({ ...start, target: { ...start.target } });
        this.goal = this.clampPose({ ...start, target: { ...start.target } });
        this.savedPitch = this.goal.pitch;
    }

    pose(): OrbitPose {
        return { target: { ...this.cur.target }, yaw: this.cur.yaw, pitch: this.cur.pitch, distance: this.cur.distance };
    }

    eye(): Vec3 {
        return eyeFrom(this.cur.target, this.cur.yaw, this.cur.pitch, this.cur.distance);
    }

    view(aspect: number): View {
        return { eye: this.eye(), target: { ...this.cur.target }, fovY: this.limits.fovY, aspect };
    }

    isTopDown(): boolean {
        return this.topDown;
    }

    setTopDown(on: boolean): void {
        if (on === this.topDown) return;
        this.topDown = on;
        if (on) {
            this.savedPitch = this.goal.pitch;
            this.goal.pitch = this.limits.topDownPitch;
        } else {
            this.goal.pitch = clamp(this.savedPitch, this.limits.minPitch, this.limits.maxPitch);
        }
        this.goal = this.clampPose(this.goal);
    }

    toggleTopDown(): boolean {
        this.setTopDown(!this.topDown);
        return this.topDown;
    }

    // Finger-follow pan. dx and dy are in CSS pixels, viewportHeight is the canvas height in pixels.
    // Dragging right moves the map right. Dragging down moves the map down the screen.
    panPixels(dx: number, dy: number, viewportHeight: number): void {
        const worldPerPx = (2 * this.cur.distance * Math.tan(this.limits.fovY / 2)) / Math.max(1, viewportHeight);
        const { forward, right } = this.groundBasis(this.cur.yaw);
        const sinP = Math.max(0.2, Math.sin(this.cur.pitch));
        const dX = -dx * worldPerPx;
        const dZ = (dy * worldPerPx) / sinP;
        const ddx = right.x * dX + forward.x * dZ;
        const ddz = right.z * dX + forward.z * dZ;
        this.moveTarget(ddx, ddz);
    }

    // Moves the target in camera-relative world units. Used by the arrow keys.
    panWorld(forwardUnits: number, rightUnits: number): void {
        const { forward, right } = this.groundBasis(this.cur.yaw);
        this.moveTarget(forward.x * forwardUnits + right.x * rightUnits, forward.z * forwardUnits + right.z * rightUnits);
    }

    rotate(dYaw: number): void {
        this.goal.yaw += dYaw;
    }

    // Orbit tilt from a drag. Leaves top-down mode if it is on.
    tilt(dPitch: number): void {
        if (this.topDown) {
            this.topDown = false;
        }
        this.goal.pitch = clamp(this.goal.pitch + dPitch, this.limits.minPitch, this.pitchMax());
        this.savedPitch = this.goal.pitch;
    }

    // factor above 1 zooms out, below 1 zooms in.
    zoom(factor: number): void {
        this.goal.distance = clamp(this.goal.distance * factor, this.limits.minDistance, this.limits.maxDistance);
    }

    // Moves the target to a ground point at once, clamped to the bounds. Used to frame a point, e.g. a
    // building picked from a list.
    setTarget(x: number, z: number): void {
        const b = this.limits.bounds;
        const tx = clamp(x, b.minX, b.maxX);
        const tz = clamp(z, b.minZ, b.maxZ);
        this.cur.target = vec(tx, this.cur.target.y, tz);
        this.goal.target = vec(tx, this.goal.target.y, tz);
    }

    // Snaps everything to the goal. Used by tests and on first frame.
    settle(): void {
        this.cur = this.clampPose(this.goal);
        this.cur.target = { ...this.goal.target };
    }

    update(dt: number): void {
        const k = 1 - Math.exp(-this.limits.smoothing * Math.max(0, dt));
        this.cur.yaw += (this.goal.yaw - this.cur.yaw) * k;
        this.cur.pitch += (this.goal.pitch - this.cur.pitch) * k;
        this.cur.distance += (this.goal.distance - this.cur.distance) * k;
        this.cur.target = { ...this.goal.target };
        this.cur = this.clampPose(this.cur);
    }

    settled(): boolean {
        const e = 1e-3;
        return (
            Math.abs(this.cur.yaw - this.goal.yaw) < e &&
            Math.abs(this.cur.pitch - this.goal.pitch) < e &&
            Math.abs(this.cur.distance - this.goal.distance) < e
        );
    }

    private moveTarget(dx: number, dz: number): void {
        const b = this.limits.bounds;
        this.cur.target.x = clamp(this.cur.target.x + dx, b.minX, b.maxX);
        this.cur.target.z = clamp(this.cur.target.z + dz, b.minZ, b.maxZ);
        this.goal.target.x = this.cur.target.x;
        this.goal.target.z = this.cur.target.z;
    }

    private groundBasis(yaw: number) {
        // The camera sits at target + offset(yaw). Forward is the horizontal direction from eye to target.
        return {
            forward: vec(-Math.sin(yaw), 0, -Math.cos(yaw)),
            right: vec(Math.cos(yaw), 0, -Math.sin(yaw)),
        };
    }

    // Top-down is allowed to go past the tilt limit. Everything else stops at maxPitch.
    private pitchMax(): number {
        return this.topDown ? this.limits.topDownPitch : this.limits.maxPitch;
    }

    private clampPose(p: OrbitPose): OrbitPose {
        const L = this.limits;
        const b = L.bounds;
        return {
            target: vec(clamp(p.target.x, b.minX, b.maxX), p.target.y, clamp(p.target.z, b.minZ, b.maxZ)),
            yaw: p.yaw,
            pitch: clamp(p.pitch, L.minPitch, L.topDownPitch),
            distance: clamp(p.distance, L.minDistance, L.maxDistance),
        };
    }
}
