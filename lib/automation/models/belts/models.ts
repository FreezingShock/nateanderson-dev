// The kit in the shared voxel model format (lib/automation/models/format.ts), for the
// registry, the preview tool and anything that wants the pieces as plain data.
// In game, belts render through createBeltKit (kit.ts), which adds the slat path animation
// the shared format has no field for; these models carry the slats at their rest pose.

import { MOTION, TAG, type ModelPart, type VoxelModel } from "../format";
import { PIECES, PIECE_KINDS, buildPiece, type PieceKind } from "./pieces";
import { BELT_TIERS } from "./palette";
import { framePoint } from "./paths";
import { Motion, VOX, type Voxel } from "./vox";

const TIER_SLUG = ["brass", "copper", "steel"];

export function beltModelId(kind: PieceKind, tier = 0): string {
    const base = `belt-${kind.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}`;
    return PIECES[kind].tiered && tier > 0 ? `${base}-${TIER_SLUG[tier]}` : base;
}

export function toVoxelModel(kind: PieceKind, tier = 0): VoxelModel {
    const def = PIECES[kind];
    const set = buildPiece(kind, tier);
    const palette: number[] = [];
    const pal = (c: number) => {
        let n = palette.indexOf(c);
        if (n < 0) n = palette.push(c) - 1;
        return n;
    };
    const groups = new Map<number, Voxel[]>();
    for (const v of set.voxels()) {
        let g = groups.get(v.group);
        if (!g) groups.set(v.group, (g = []));
        g.push(v);
    }
    const parts: ModelPart[] = [];
    let nSlat = 0,
        nGear = 0;
    for (const [g, list] of groups) {
        const first = list[0];
        let pivot: [number, number, number] = [0, 0, 0];
        let cells: [number, number, number][] = list.map((v) => [v.i, v.j, v.k]);
        let id = "body";
        let motion: number = MOTION.STATIC;
        let anim: ModelPart["anim"];
        if (g !== 0 && first.motion === Motion.Slat && first.slat) {
            const sl = first.slat;
            // Rest pose: each template voxel centre through the path frame, snapped to the grid.
            cells = list.map((v) => {
                const off: [number, number, number] = [(v.i + 0.5) * VOX - sl.centre[0], (v.j + 0.5) * VOX - sl.centre[1], (v.k + 0.5) * VOX - sl.centre[2]];
                const p = framePoint(sl.path, sl.rest / sl.len, off);
                return [Math.floor(p[0] / VOX), Math.floor(p[1] / VOX), Math.floor(p[2] / VOX)];
            });
            pivot = cells[Math.floor(cells.length / 2)];
            id = `slat${nSlat++}`;
            motion = MOTION.SLAT;
        } else if (g !== 0 && first.motion === Motion.Spin && first.spin) {
            const sp = first.spin;
            pivot = [Math.round(sp.pivot[0] / VOX - 0.5), Math.round(sp.pivot[1] / VOX - 0.5), Math.round(sp.pivot[2] / VOX - 0.5)];
            const ax = sp.axis;
            const axis = Math.abs(ax[0]) > 0.5 ? "x" : Math.abs(ax[1]) > 0.5 ? "y" : "z";
            const sign = ax[0] + ax[1] + ax[2] < 0 ? -1 : 1;
            id = `gear${nGear++}`;
            motion = MOTION.GEAR;
            // At the tier's default speed: radians per cell times cells per second, in turns.
            anim = { kind: "spin", axis, speed: (sign * sp.rate * BELT_TIERS[def.tiered ? tier : 0].speed) / (Math.PI * 2), amp: 0, phase: 0, when: "working" };
        } else if (g !== 0) {
            id = `part${g}`;
        }
        const pos = new Int16Array(cells.length * 3);
        const colors = new Uint8Array(cells.length);
        const tags = new Uint8Array(cells.length);
        const mo = new Uint8Array(cells.length).fill(motion);
        cells.forEach((c, n) => {
            pos[n * 3] = c[0] - pivot[0];
            pos[n * 3 + 1] = c[1] - pivot[1];
            pos[n * 3 + 2] = c[2] - pivot[2];
            colors[n] = pal(list[n].color);
            tags[n] = list[n].glow ? TAG.GLOW : TAG.SOLID;
        });
        parts.push({ id, pivot, pos, colors, tags, motion: mo, ...(anim ? { anim } : {}) });
    }
    // Keep the body first so readers can find it.
    parts.sort((a, b) => (a.id === "body" ? -1 : b.id === "body" ? 1 : 0));
    const fp = def.footprint;
    const isBuilding = !def.paths.length || kind === "dock";
    return {
        id: beltModelId(kind, tier),
        voxel: 0.1,
        size: [fp.w * 10, 30, fp.d * 10],
        footprint: fp,
        palette,
        parts,
        ...(isBuilding ? {} : { ports: { in: [{ cell: { x: 0, z: 0 }, side: 2 as const }], out: [{ cell: { x: 0, z: 0 }, side: 0 as const }] } }),
    };
}

/** Every kit piece at the brass tier, plus the plain belt in the other two tiers. */
export const BELT_MODELS: VoxelModel[] = [...PIECE_KINDS.map((k) => toVoxelModel(k, 0)), toVoxelModel("straight", 1), toVoxelModel("straight", 2)];
