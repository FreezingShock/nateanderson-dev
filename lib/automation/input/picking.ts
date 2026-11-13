import { type Vec3, add, cross, dot, mul, norm, sub, UP, vec } from "./math";
import { type BoardSize, type Cell, cellInBoard } from "./grid";

// A view is the eye and target the camera looks at. Matches THREE.PerspectiveCamera + lookAt(eye, target)
// with up (0, 1, 0) and a vertical fov, so the renderer can pass the same numbers.
export interface View {
    eye: Vec3;
    target: Vec3;
    fovY: number;
    aspect: number;
}

export interface Ray {
    origin: Vec3;
    dir: Vec3;
}

// Surface height of the voxel column at cell (x, z). Optional. Without it, picking hits the y = 0 ground.
export type HeightFn = (x: number, z: number) => number;

export function viewBasis(view: View) {
    const forward = norm(sub(view.target, view.eye));
    const right = norm(cross(forward, UP));
    const up = cross(right, forward);
    return { forward, right, up };
}

// ndcX and ndcY run from -1 to 1, with +y pointing up the screen.
export function screenRay(view: View, ndcX: number, ndcY: number): Ray {
    const { forward, right, up } = viewBasis(view);
    const t = Math.tan(view.fovY / 2);
    const dir = norm(add(add(forward, mul(right, ndcX * t * view.aspect)), mul(up, ndcY * t)));
    return { origin: view.eye, dir };
}

// Inverse of screenRay: projects a world point to NDC. visible is false when the point is behind the eye.
export function project(view: View, p: Vec3): { ndcX: number; ndcY: number; visible: boolean } {
    const { forward, right, up } = viewBasis(view);
    const d = sub(p, view.eye);
    const z = dot(d, forward);
    const t = Math.tan(view.fovY / 2);
    if (z <= 0) return { ndcX: 0, ndcY: 0, visible: false };
    return {
        ndcX: dot(d, right) / (z * t * view.aspect),
        ndcY: dot(d, up) / (z * t),
        visible: true,
    };
}

export interface GroundHit {
    cell: Cell;
    point: Vec3;
}

const MARCH_STEP = 0.1;
const MARCH_MAX = 400;

// Finds the board cell under a ray. Flat board: analytic hit with the y = 0 plane.
// With heightAt: march the ray and refine the hit by bisection, so tall machines are picked on top.
export function pickGround(ray: Ray, board: BoardSize, heightAt?: HeightFn): GroundHit | null {
    if (!heightAt) {
        if (ray.dir.y >= -1e-6) return null;
        const t = -ray.origin.y / ray.dir.y;
        if (t <= 0) return null;
        const point = add(ray.origin, mul(ray.dir, t));
        const cell = { x: Math.floor(point.x), z: Math.floor(point.z) };
        return cellInBoard(cell, board) ? { cell, point } : null;
    }
    let prevT = 0;
    for (let t = MARCH_STEP; t <= MARCH_MAX; t += MARCH_STEP) {
        const p = add(ray.origin, mul(ray.dir, t));
        const cell = { x: Math.floor(p.x), z: Math.floor(p.z) };
        if (cellInBoard(cell, board) && p.y <= heightAt(cell.x, cell.z)) {
            let lo = prevT;
            let hi = t;
            for (let i = 0; i < 12; i++) {
                const mid = (lo + hi) / 2;
                const m = add(ray.origin, mul(ray.dir, mid));
                if (m.y <= heightAt(Math.floor(m.x), Math.floor(m.z))) hi = mid;
                else lo = mid;
            }
            const point = add(ray.origin, mul(ray.dir, hi));
            return { cell: { x: Math.floor(point.x), z: Math.floor(point.z) }, point };
        }
        prevT = t;
    }
    return null;
}

export const eyeFrom = (target: Vec3, yaw: number, pitch: number, distance: number): Vec3 =>
    add(target, vec(Math.sin(yaw) * Math.cos(pitch) * distance, Math.sin(pitch) * distance, Math.cos(yaw) * Math.cos(pitch) * distance));
