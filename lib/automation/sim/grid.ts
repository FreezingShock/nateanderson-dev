// Grid view for the camera and placement thread: get, set, check over single cells, plus auto-routing for belts.
// Multi-cell buildings are anchored at one cell. set() on any other cell that the same building covers is a no-op.
import type { ActionResult, Catalog, Cell, Rot, World } from "../types";
import { DIR_DX, DIR_DZ } from "../types";
import { DEFAULT_CATALOG } from "./data";
import { footprintCells, keyOf, placeError, place, remove, resolve, buildingAt } from "./world";

export interface GridItem {
    kind: string;
    rot: Rot;
    /** The cell the building is anchored at. Returned by get() so undo puts a multi-cell building back in place. */
    anchor?: Cell;
}

export interface GridView {
    get(x: number, z: number): GridItem | null;
    set(x: number, z: number, item: GridItem | null): ActionResult;
    check(kind: string, x: number, z: number, rot: Rot): null | string;
}

export function gridView(world: World, cat: Catalog = DEFAULT_CATALOG): GridView {
    return {
        get(x, z) {
            const b = buildingAt(world, x, z, cat);
            return b ? { kind: b.type, rot: b.rot, anchor: { x: b.x, z: b.z } } : null;
        },
        set(x, z, item) {
            const here = buildingAt(world, x, z, cat);
            if (item === null) {
                if (!here) return { ok: true };
                return remove(world, here.id, cat);
            }
            if (here) {
                // Covered by a building already: same kind and rotation is a no-op, anything else is refused.
                if (here.type === item.kind && here.rot === item.rot) return { ok: true };
                return { ok: false, reason: "occupied" };
            }
            const res = place(world, item.kind, x, z, item.rot, cat);
            return res.ok ? { ok: true } : { ok: false, reason: res.reason };
        },
        check(kind, x, z, rot) {
            // Checks the whole footprint, not just the anchor cell.
            return placeError(world, kind, x, z, rot, cat);
        },
    };
}

export interface RouteCell {
    x: number;
    z: number;
    rot: Rot;
    kind: string;
}

export type RouteResult = { ok: true; cells: RouteCell[] } | { ok: false; reason: string };

const MAX_ROUTE = 400;

// Shortest belt route from one cell to another over free cells.
// `from` may be a building (the route starts at a free cell beside it) or a free cell (the route starts there).
// `to` may be a building (the last belt faces into it) or a free cell (the last belt sits there and faces onward).
// Each belt faces the next cell on the route; the last belt faces `to`.
export function autoRoute(world: World, from: Cell, to: Cell, belt = "belt", cat: Catalog = DEFAULT_CATALOG): RouteResult {
    if (!resolve(cat, belt) || resolve(cat, belt)!.kind !== "belt") return { ok: false, reason: "not a belt" };
    const fromB = buildingAt(world, from.x, from.z, cat);
    const toB = buildingAt(world, to.x, to.z, cat);
    const free = (x: number, z: number) => x >= 0 && z >= 0 && x < world.width && z < world.depth && !buildingAt(world, x, z, cat);

    const starts: Cell[] = fromB ? neighbours(world, cellsOf(world, fromB.id, cat)) : [from];
    const goals = new Set<string>();
    if (toB) for (const n of neighbours(world, cellsOf(world, toB.id, cat))) goals.add(keyOf(n.x, n.z));
    else goals.add(keyOf(to.x, to.z));

    const prev = new Map<string, string | null>();
    const queue: Cell[] = [];
    for (const s of starts) {
        if (!free(s.x, s.z)) continue;
        const k = keyOf(s.x, s.z);
        if (!prev.has(k)) {
            prev.set(k, null);
            queue.push(s);
        }
    }
    let found: string | null = null;
    for (let qi = 0; qi < queue.length && found === null; qi++) {
        const c = queue[qi];
        const ck = keyOf(c.x, c.z);
        if (goals.has(ck)) {
            found = ck;
            break;
        }
        if (prev.size > MAX_ROUTE) break;
        for (let d = 0; d < 4; d++) {
            const nx = c.x + DIR_DX[d];
            const nz = c.z + DIR_DZ[d];
            const nk = keyOf(nx, nz);
            if (prev.has(nk) || !free(nx, nz)) continue;
            prev.set(nk, ck);
            queue.push({ x: nx, z: nz });
        }
    }
    if (found === null) return { ok: false, reason: "no free path" };

    // Walk back from the goal cell to the start.
    const path: Cell[] = [];
    for (let k: string | null = found; k !== null; k = prev.get(k) ?? null) {
        const [x, z] = k.split(",").map(Number);
        path.push({ x, z });
    }
    path.reverse();
    const cells: RouteCell[] = [];
    for (let i = 0; i < path.length; i++) {
        const c = path[i];
        let rot: Rot;
        if (i + 1 < path.length) rot = dirTo(c, path[i + 1]);
        else rot = toB ? intoBuildingRot(c, toB.id, cat, world) : dirOfGoalFallback(c, to);
        cells.push({ x: c.x, z: c.z, rot, kind: belt });
    }
    return { ok: true, cells };
}

function dirOfGoalFallback(c: Cell, to: Cell): Rot {
    // A free goal cell: the belt keeps going the way it came, so it has a valid rotation.
    if (c.x === to.x && c.z === to.z) return 0;
    return dirTo(c, to);
}

function dirTo(a: Cell, b: Cell): Rot {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    for (let d = 0; d < 4; d++) if (DIR_DX[d] === dx && DIR_DZ[d] === dz) return d as Rot;
    return 0;
}

function cellsOf(world: World, id: number, cat: Catalog): Cell[] {
    const b = world.buildings[id];
    const r = resolve(cat, b.type);
    if (!r) return [{ x: b.x, z: b.z }];
    return footprintCells(b, r.footprint).map(([x, z]) => ({ x, z }));
}

function neighbours(world: World, cells: Cell[]): Cell[] {
    const inside = new Set(cells.map((c) => keyOf(c.x, c.z)));
    const out: Cell[] = [];
    const seen = new Set<string>();
    for (const c of cells) {
        for (let d = 0; d < 4; d++) {
            const x = c.x + DIR_DX[d];
            const z = c.z + DIR_DZ[d];
            const k = keyOf(x, z);
            if (inside.has(k) || seen.has(k)) continue;
            if (x < 0 || z < 0 || x >= world.width || z >= world.depth) continue;
            seen.add(k);
            out.push({ x, z });
        }
    }
    return out;
}

// The last belt must face the building it feeds, whichever side of it the route reached. Aiming at the building's anchor
// points the belt away from a 3 by 3 hub when the route arrives on its far edge.
function intoBuildingRot(c: Cell, buildingId: number, cat: Catalog, world: World): Rot {
    for (let d = 0; d < 4; d++) {
        const adj = { x: c.x + DIR_DX[d], z: c.z + DIR_DZ[d] };
        if (buildingAt(world, adj.x, adj.z, cat)?.id === buildingId) return dirTo(c, adj);
    }
    return 0;
}
