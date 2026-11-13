// Belt paths in tile-local units. Three-free; the same maths is mirrored in GLSL (shader.ts).
//
// Tile-local space: the cell spans x 0..1 and z 0..1, flow is +z (rot 0), ground is y 0.
// A path maps u in 0..1 to a point on the belt surface and a unit heading.

/** Height of the belt surface (bottom of the slats). */
export const BELT_Y = 0.2;
/** Top of the slats. Items sit here. */
export const ITEM_Y = 0.3;
/** How far a ramp climbs over one cell. Two ramp cells make one floor of 1 unit. */
export const RAMP_RISE = 0.5;
/** Slats per cell of belt. Pitch 0.25. */
export const SLATS_PER_CELL = 4;

export const PathId = {
    Straight: 0,
    /** Fed from the left side (-x), turns to exit +z. */
    CornerL: 1,
    /** Fed from the right side (+x), turns to exit +z. */
    CornerR: 2,
    RampUp: 3,
    RampDown: 4,
    /** Back edge to the centre. */
    HalfIn: 5,
    /** Centre to the front edge. */
    HalfOut: 6,
    /** Left edge (-x) to the centre. */
    FromLeft: 7,
    /** Right edge (+x) to the centre. */
    FromRight: 8,
    /** Centre to the left edge. */
    ToLeft: 9,
    /** Centre to the right edge. */
    ToRight: 10,
} as const;
export type PathId = (typeof PathId)[keyof typeof PathId];

/** Path length in cells, as the sim counts it (BeltItem.pos runs 0..1 over a whole cell). */
export function pathLen(id: number): number {
    return id >= PathId.HalfIn ? 0.5 : 1;
}

export interface PathPoint {
    x: number;
    y: number;
    z: number;
    /** Unit heading. */
    tx: number;
    ty: number;
    tz: number;
}

export function pathPoint(id: number, u: number, out: PathPoint = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 1 }): PathPoint {
    let x = 0.5,
        y = BELT_Y,
        z = u,
        tx = 0,
        ty = 0,
        tz = 1;
    const H = Math.PI / 2;
    switch (id) {
        case PathId.CornerL: {
            const a = u * H;
            x = 0.5 * Math.sin(a);
            z = 1 - 0.5 * Math.cos(a);
            tx = Math.cos(a);
            tz = Math.sin(a);
            break;
        }
        case PathId.CornerR: {
            const a = u * H;
            x = 1 - 0.5 * Math.sin(a);
            z = 1 - 0.5 * Math.cos(a);
            tx = -Math.cos(a);
            tz = Math.sin(a);
            break;
        }
        case PathId.RampUp: {
            y = BELT_Y + u * RAMP_RISE;
            const l = Math.hypot(RAMP_RISE, 1);
            ty = RAMP_RISE / l;
            tz = 1 / l;
            break;
        }
        case PathId.RampDown: {
            y = BELT_Y + (1 - u) * RAMP_RISE;
            const l = Math.hypot(RAMP_RISE, 1);
            ty = -RAMP_RISE / l;
            tz = 1 / l;
            break;
        }
        case PathId.HalfIn:
            z = u * 0.5;
            break;
        case PathId.HalfOut:
            z = 0.5 + u * 0.5;
            break;
        case PathId.FromLeft:
            x = u * 0.5;
            z = 0.5;
            tx = 1;
            tz = 0;
            break;
        case PathId.FromRight:
            x = 1 - u * 0.5;
            z = 0.5;
            tx = -1;
            tz = 0;
            break;
        case PathId.ToLeft:
            x = 0.5 - u * 0.5;
            z = 0.5;
            tx = -1;
            tz = 0;
            break;
        case PathId.ToRight:
            x = 0.5 + u * 0.5;
            z = 0.5;
            tx = 1;
            tz = 0;
            break;
        default:
            break;
    }
    out.x = x;
    out.y = y;
    out.z = z;
    out.tx = tx;
    out.ty = ty;
    out.tz = tz;
    return out;
}

/**
 * Position of an offset given in the path frame (x across to the right of travel,
 * y up, z along). Used for the rest pose of slats; the GPU does the same each frame.
 */
export function framePoint(id: number, u: number, off: [number, number, number]): [number, number, number] {
    const p = pathPoint(id, u);
    // right = up x tangent, up' = tangent x right
    const rx = p.tz,
        ry = 0,
        rz = -p.tx;
    const rl = Math.hypot(rx, ry, rz) || 1;
    const Rx = rx / rl,
        Ry = ry / rl,
        Rz = rz / rl;
    const Ux = p.ty * Rz - p.tz * Ry,
        Uy = p.tz * Rx - p.tx * Rz,
        Uz = p.tx * Ry - p.ty * Rx;
    return [
        p.x + Rx * off[0] + Ux * off[1] + p.tx * off[2],
        p.y + Ry * off[0] + Uy * off[1] + p.ty * off[2],
        p.z + Rz * off[0] + Uz * off[1] + p.tz * off[2],
    ];
}
