// A small worked example so art threads can see the format and the preview tool end to end.
// Real models live in their folders (machines/, belts/, resources/, items/, props/).
import { MOTION, TAG, type VoxelModel } from "./format";

type Cell = {
    x: number;
    y: number;
    z: number;
    color: number;
    tag?: number;
    motion?: number;
};

function pack(cells: Cell[], pivot: [number, number, number]) {
    return {
        pivot,
        pos: new Int16Array(cells.flatMap((c) => [c.x, c.y, c.z])),
        colors: new Uint8Array(cells.map((c) => c.color)),
        tags: new Uint8Array(cells.map((c) => c.tag ?? TAG.SOLID)),
        motion: new Uint8Array(cells.map((c) => c.motion ?? MOTION.STATIC)),
    };
}

/** A 20x20x20 voxel brass block (2x2 cells) with a glowing front window and a gear on top. */
export const EXAMPLE_BLOCK: VoxelModel = (() => {
    const body: Cell[] = [];
    for (let x = 0; x < 20; x++)
        for (let y = 0; y < 20; y++)
            for (let z = 0; z < 20; z++) {
                const shell =
                    x === 0 ||
                    x === 19 ||
                    y === 0 ||
                    y === 19 ||
                    z === 0 ||
                    z === 19;
                if (!shell) continue;
                const window = z === 19 && x > 6 && x < 13 && y > 6 && y < 13;
                body.push({
                    x,
                    y,
                    z,
                    color: window ? 2 : 0,
                    tag: window ? TAG.GLOW : TAG.SOLID,
                });
            }
    const gear: Cell[] = [];
    for (let x = 6; x < 13; x++)
        for (let z = 6; z < 13; z++) {
            const dx = x - 9.5;
            const dz = z - 9.5;
            if (dx * dx + dz * dz <= 12)
                gear.push({
                    x: x - 9,
                    y: 0,
                    z: z - 9,
                    color: 1,
                    motion: MOTION.GEAR,
                });
        }
    const b = pack(body, [0, 0, 0]);
    const g = pack(gear, [9, 20, 9]);
    return {
        id: "example-block",
        voxel: 0.1,
        size: [20, 24, 20],
        footprint: { w: 2, d: 2 },
        palette: [0xd29a3c, 0x7f8ca3, 0xffb347],
        parts: [
            {
                id: "body",
                pivot: b.pivot,
                pos: b.pos,
                colors: b.colors,
                tags: b.tags,
            },
            {
                id: "gear",
                pivot: g.pivot,
                pos: g.pos,
                colors: g.colors,
                motion: g.motion,
                when: ["working"],
                anim: {
                    kind: "spin",
                    axis: "y",
                    speed: 0.5,
                    amp: 0,
                    phase: 0,
                    when: "working",
                },
            },
        ],
        ports: {
            in: [{ cell: { x: 0, z: 0 }, side: 0 }],
            out: [{ cell: { x: 1, z: 1 }, side: 2 }],
        },
        lights: [
            {
                pos: [10, 10, 22],
                color: 0xff8a2a,
                intensity: 2,
                distance: 9,
                when: "working",
            },
        ],
    };
})();
