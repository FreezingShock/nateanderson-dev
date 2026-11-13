// Shared voxel model format for Brasswork art (machines, belts, resources, items, props).
// Pure data, no three.js import, so sim and tests can read models too.
//
// Conventions
// - Voxel size is 0.1 world units for machines, belts, items and props. Terrain is 0.2 (terrain
//   is not authored in this format). CELL_VOXELS = 10 voxels per 1-unit board cell at 0.1.
// - Authored at rot 0. Model origin is the footprint's min corner on the ground: x in 0..w,
//   z in 0..d, y up from 0. Inputs sit on the back (-z) side, the output on the front (+z).
// - Positions are integer voxel units. A part's `pos` triples are relative to its `pivot`, so an
//   animated part can rotate about its pivot.
// - Hollow culling is done by the author: only voxels with at least one empty face need to be stored.
//   The loader's baker also culls faces between voxels of the same part.
// - Palette: `colors` index into the model's `palette` (sRGB hex). Palette colours come from
//   LOOK-SPEC.md (Palette section); do not invent new hues without a design call.

/** Rotation in quarter turns. 0 is +z, matching the simulation's Rot (lib/automation/types.ts). */
export type Rot = 0 | 1 | 2 | 3;

export type Axis = "x" | "y" | "z";

/** Machine and building states that parts and lights can key off. */
export type ModelState = "always" | "working" | "idle" | "depleted";

/** Per-voxel render tag. */
export const TAG = {
    /** Lit, fogged block like the terrain. */
    SOLID: 0,
    /** Unlit glow (lamp glass, furnace windows). Drawn as a flat mesh. */
    GLOW: 1,
    /** Sparkle (ore glints). Uses the cheap twinkle shader. */
    GLINT: 2,
} as const;
export type TagValue = (typeof TAG)[keyof typeof TAG];

/** Per-voxel motion, for belts. Static voxels never move. */
export const MOTION = {
    STATIC: 0,
    /** Belt slat: slides along the piece path with the belt phase. */
    SLAT: 1,
    /** Gear: spins around the part pivot. */
    GEAR: 2,
} as const;
export type MotionValue = (typeof MOTION)[keyof typeof MOTION];

/** Shape of a slide or bob motion, in -1..1. "sine" is the default. */
export type AnimWave = "sine" | "stamp" | "crank";

export interface PartAnim {
    /** "swing" rocks about the pivot: angle = amp * sin(2pi(t*speed + phase)), amp in radians. */
    kind: "spin" | "slide" | "bob" | "pulse" | "swing";
    axis: Axis;
    /** Turns per second for spin, cycles per second for the others. */
    speed: number;
    /** Amplitude in voxels for slide and bob, or 0..1 brightness for pulse. */
    amp: number;
    /** Phase offset in turns, 0..1. */
    phase: number;
    /** Which state the animation runs in. */
    when: ModelState;
    /** Shape for slide and bob. "stamp" slams down then lifts slowly, "crank" follows a crank and rod. */
    wave?: AnimWave;
}

export interface ModelPart {
    id: string;
    /** Rotation centre in voxel units, relative to the model origin. */
    pivot: [number, number, number];
    /** x, y, z triples relative to the pivot, length 3 * count. */
    pos: Int16Array;
    /** Palette index per voxel, length count. */
    colors: Uint8Array;
    /** Optional render tag per voxel (TAG values). Missing means SOLID. */
    tags?: Uint8Array;
    /** Optional motion per voxel (MOTION values). Missing means STATIC. */
    motion?: Uint8Array;
    /** Optional sway weight per voxel, 0..255, 0 at the root. Props use it for wind. */
    sway?: Uint8Array;
    /** States in which this part is drawn. Missing means always drawn. */
    when?: ModelState[];
    /** Whole-part animation. Each animated part goes in its own InstancedMesh. */
    anim?: PartAnim;
}

export interface PortRef {
    /** Footprint cell, in cells, from the model origin. */
    cell: { x: number; z: number };
    side: Rot;
}

export interface ModelLight {
    /** Position in voxel units from the model origin. */
    pos: [number, number, number];
    color: number;
    intensity: number;
    distance: number;
    when: "always" | "working";
}

export interface VoxelModel {
    id: string;
    /** Voxel size in world units. 0.1 for every model in this format. */
    voxel: number;
    /** Bounding box in voxels. Optional but recommended, the preview and baker use it. */
    size?: [number, number, number];
    /** Footprint in board cells for buildings. Props and items leave this out. */
    footprint?: { w: number; d: number };
    palette: number[];
    parts: ModelPart[];
    ports?: { in: PortRef[]; out: PortRef[] };
    lights?: ModelLight[];
}

/** Throws if a model breaks the format. Art threads run this on every model before commit. */
export function validateModel(model: VoxelModel): void {
    const fail = (msg: string) => {
        throw new Error(`model ${model.id}: ${msg}`);
    };
    if (!model.id) fail("missing id");
    if (model.voxel !== 0.1) fail(`voxel must be 0.1, got ${model.voxel}`);
    if (model.palette.length === 0 || model.palette.length > 256)
        fail("palette must hold 1..256 colours");
    const ids = new Set<string>();
    for (const part of model.parts) {
        if (ids.has(part.id)) fail(`duplicate part id ${part.id}`);
        ids.add(part.id);
        const count = part.colors.length;
        if (part.pos.length !== count * 3)
            fail(
                `part ${part.id}: pos has ${part.pos.length} values for ${count} voxels`
            );
        for (const [name, arr] of [
            ["tags", part.tags],
            ["motion", part.motion],
            ["sway", part.sway],
        ] as const) {
            if (arr && arr.length !== count)
                fail(
                    `part ${part.id}: ${name} length ${arr.length} != ${count}`
                );
        }
        for (let v = 0; v < count; v++) {
            if (part.colors[v] >= model.palette.length)
                fail(
                    `part ${part.id}: colour index ${part.colors[v]} out of palette`
                );
        }
    }
    for (const p of [...(model.ports?.in ?? []), ...(model.ports?.out ?? [])]) {
        if (model.footprint) {
            if (
                p.cell.x < 0 ||
                p.cell.x >= model.footprint.w ||
                p.cell.z < 0 ||
                p.cell.z >= model.footprint.d
            ) {
                fail(
                    `port at (${p.cell.x}, ${p.cell.z}) is outside the footprint`
                );
            }
        }
    }
}

/** Total voxel count across parts, for the 1.5k to 4k surface-voxel budget checks. */
export function voxelCount(model: VoxelModel): number {
    return model.parts.reduce((n, p) => n + p.colors.length, 0);
}
