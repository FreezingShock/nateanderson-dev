// A resource node as the player sees it on the board: the ore outcrop from deposits.ts sitting in a
// weathered 2x2 patch of the ground it broke out of. Reads at a glance from orbit and top-down:
//   - the outcrop in the middle, shaped and coloured per ore (deposits.ts)
//   - a ring of broken host rock and ore-stained rubble around it, so it sits in the terrain
//   - ore chips scattered outward, denser on richer nodes
//   - survey stakes on the rim: 1 rust stake impure, 2 brass normal, 3 patina pure (pure stakes glow at the tip)
// The node is 2x2 like the drill and centred on its sim cell, so a drill placed on it covers it exactly.

import type { VoxelModel } from "../format";
import { buildDeposit } from "./deposits";
import { RESOURCE_COLORS, type ResourceId } from "./palette";
import { Tag, VoxelBuilder, hash3, mix, rng, toModel } from "./voxel";

export type NodeGrade = "impure" | "normal" | "pure";

export function nodeGrade(purity: number): NodeGrade {
    return purity <= 0.5 ? "impure" : purity >= 2 ? "pure" : "normal";
}

const GRADE_PURITY: Record<NodeGrade, number> = { impure: 0.5, normal: 1, pure: 2 };
/** Stake colour and count per grade. Count is the cue that survives the dither; colour backs it up. */
export const NODE_STAKES: Record<NodeGrade, { n: number; color: number; tip: number }> = {
    impure: { n: 1, color: 0x8a4a30, tip: 0xb0623c },
    normal: { n: 2, color: 0xa87a3a, tip: 0xe0b45a },
    pure: { n: 3, color: 0x3f8a74, tip: 0x9df0c8 },
};

const R = 10; // half of the 2x2 footprint in voxels

function ground(b: VoxelBuilder, item: ResourceId, grade: NodeGrade, seed: number) {
    const C = RESOURCE_COLORS[item];
    const r = rng(seed * 97 + 13);
    const rich = grade === "pure" ? 1 : grade === "normal" ? 0.6 : 0.3;
    // Stained, broken ground: a rough disc that fades out with distance and a wobbly edge.
    for (let x = -R; x < R; x++)
        for (let z = -R; z < R; z++) {
            const d = Math.hypot(x + 0.5, z + 0.5);
            const edge = 8.2 + hash3(x, 7, z, seed) * 1.6;
            if (d > edge) continue;
            const h = hash3(x, 0, z, seed + 3);
            const stain = Math.max(0, 1 - d / edge) * (0.55 + rich * 0.45);
            const c = h < stain * 0.45 ? C.dark : h < stain * 0.75 ? mix(C.host, C.main, 0.35) : h < 0.8 ? C.host : C.hostDark;
            b.add(x, 0, z, c);
        }
    // Rubble: chunks of host rock with ore faces, in a loose ring around the outcrop.
    const chunks = 5 + Math.round(rich * 4);
    for (let i = 0; i < chunks; i++) {
        const a = (i / chunks) * Math.PI * 2 + r() * 0.6;
        const dist = 5.6 + r() * 2.2;
        const cx = Math.cos(a) * dist,
            cz = Math.sin(a) * dist;
        const s = 0.9 + r() * 0.9;
        b.blob(cx, 0.6, cz, s * 1.2, s * 0.9, s, (x, y, z) => {
            const t = hash3(x, y, z, seed + 11);
            return t < 0.3 * rich + 0.1 ? C.main : t < 0.6 ? C.host : C.hostDark;
        });
    }
    // Ore chips flung outward, flush with the ground.
    const chips = 6 + Math.round(rich * 10);
    for (let i = 0; i < chips; i++) {
        const a = r() * Math.PI * 2;
        const dist = 4.5 + r() * 4.5;
        const x = Math.round(Math.cos(a) * dist),
            z = Math.round(Math.sin(a) * dist);
        if (x < -R || x >= R || z < -R || z >= R) continue;
        b.set(x, 1, z, r() < 0.5 ? C.main : C.accent, r() < 0.3 ? Tag.Glint : Tag.Solid);
    }
}

function stakes(b: VoxelBuilder, grade: NodeGrade, seed: number) {
    const s = NODE_STAKES[grade];
    // Stakes stand on the front-left rim, spaced so their count reads from any angle.
    for (let i = 0; i < s.n; i++) {
        const a = Math.PI * (0.62 + i * 0.16) + (hash3(i, 0, 0, seed) - 0.5) * 0.05;
        const x = Math.round(Math.cos(a) * 8),
            z = Math.round(Math.sin(a) * 8);
        b.add(x, 0, z, 0x4a423c);
        for (let y = 1; y <= 6; y++) b.set(x, y, z, s.color);
        b.set(x, 7, z, s.tip, grade === "pure" ? Tag.Glow : Tag.Solid);
        // A little pennant on the top, pointing away from the outcrop.
        const px = x + Math.sign(x || 1),
            pz = z;
        b.set(px, 6, pz, s.tip);
        b.set(px, 5, pz, s.color);
    }
}

const cache = new Map<string, VoxelModel>();

/** The board model for a resource node, 2x2 voxel footprint (20 x 20 at 0.1), origin at the min corner. */
export function nodeModel(item: ResourceId, purity: number, variant = 0): VoxelModel {
    const grade = nodeGrade(purity);
    const v = ((variant % 3) + 3) % 3;
    const id = `resource.node.${item}.${grade}.v${v}`;
    const hit = cache.get(id);
    if (hit) return hit;
    const seed = 31 + v * 7 + item.length;
    const b = new VoxelBuilder();
    ground(b, item, grade, seed);
    stakes(b, grade, seed);
    // The outcrop, raised one voxel onto the broken ground.
    const dep = buildDeposit(item, { purity: GRADE_PURITY[grade], remaining: 1, variant: v, seed: 0 });
    for (let i = 0; i < dep.count; i++) {
        const x = dep.pos[i * 3],
            y = dep.pos[i * 3 + 1],
            z = dep.pos[i * 3 + 2];
        b.set(x, y + 1, z, dep.color[i], dep.tag[i] as Tag);
    }
    b.clip(-R, R - 1, -R, R - 1);
    const m = toModel(id, b.build(), { w: 2, d: 2 });
    // toModel centres one cell; shift to the 2x2 footprint.
    const pos = m.parts[0].pos;
    for (let i = 0; i < pos.length; i += 3) {
        pos[i] += R - 5;
        pos[i + 2] += R - 5;
    }
    m.size = [2 * R, m.size?.[1] ?? 12, 2 * R];
    cache.set(id, m);
    return m;
}
