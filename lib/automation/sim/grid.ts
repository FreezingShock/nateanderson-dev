// Grid view for the camera and placement thread: get, set, check over single cells, plus auto-routing for belts.
// Multi-cell buildings are anchored at one cell. set() on any other cell that the same building covers is a no-op.
import type { ActionResult, Catalog, Cell, Footprint, Rot, World } from "../types";
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
const TUNNEL_REACH = 5; // cells a tunnel can hop, same as lib/automation/sim/world.ts

// Shortest belt route from one cell to another over free cells.
// `from` may be a building (the route starts at a free cell beside it) or a free cell (the route starts there).
// `to` may be a building (the last belt faces into it) or a free cell (the last belt sits there and faces onward).
// Each belt faces the next cell on the route; the last belt faces `to`.
export function autoRoute(world: World, from: Cell, to: Cell, belt = "belt", cat: Catalog = DEFAULT_CATALOG): RouteResult {
    if (!resolve(cat, belt) || resolve(cat, belt)!.kind !== "belt") return { ok: false, reason: "not a belt" };
    const fromB = buildingAt(world, from.x, from.z, cat);
    const toB = buildingAt(world, to.x, to.z, cat);
    // A drill pushes its ore into any belt beside it, so a route must not pass next to a drill it was not sent from.
    const beside = (x: number, z: number, id: number | undefined) =>
        DIR_DX.some((dx, d) => {
            const b = buildingAt(world, x + dx, z + DIR_DZ[d], cat);
            return !!b && b.id !== id && resolve(cat, b.type)?.kind === "miner";
        });
    // The drill a route starts from is the one next to its first cell, even when the start is an empty cell.
    const ownMiner = fromB?.id ?? DIR_DX.map((dx, d) => buildingAt(world, from.x + dx, from.z + DIR_DZ[d], cat)).find((b) => b && resolve(cat, b.type)?.kind === "miner")?.id;
    // A drill is 2 by 2 from its node cell, so routes keep the node and the three cells that would hold the drill free.
    const onNode = (x: number, z: number) => [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([dx, dz]) => world.deposits[keyOf(x + dx, z + dz)] !== undefined);
    const free = (x: number, z: number) =>
        x >= 0 && z >= 0 && x < world.width && z < world.depth && !buildingAt(world, x, z, cat) && !beside(x, z, ownMiner) && !onNode(x, z);

    const starts: Cell[] = fromB ? neighbours(world, cellsOf(world, fromB.id, cat)) : [from];
    const goals = new Set<string>();
    if (toB) for (const n of neighbours(world, cellsOf(world, toB.id, cat))) goals.add(keyOf(n.x, n.z));
    else goals.add(keyOf(to.x, to.z));
    // A route may also side-load onto a belt that already feeds the target, so a busy hub edge is not a dead end.
    const joins = new Map<string, Cell>();
    if (toB) {
        // Every belt whose line ends in the target, however far back: walk the belts upstream from the target.
        const isBelt = (b: { type: string }) => resolve(cat, b.type)?.kind === "belt";
        const feeding = new Set<number>();
        const frontier: { x: number; z: number }[] = [];
        for (const b of Object.values(world.buildings)) {
            if (!isBelt(b)) continue;
            if (buildingAt(world, b.x + DIR_DX[b.rot], b.z + DIR_DZ[b.rot], cat)?.id !== toB.id) continue;
            feeding.add(b.id);
            frontier.push({ x: b.x, z: b.z });
        }
        for (let qi = 0; qi < frontier.length; qi++) {
            const cur = frontier[qi];
            for (let d = 0; d < 4; d++) {
                const up = buildingAt(world, cur.x + DIR_DX[d], cur.z + DIR_DZ[d], cat);
                if (!up || feeding.has(up.id) || !isBelt(up)) continue;
                // Upstream belt must point into the current one.
                if (up.x + DIR_DX[up.rot] !== cur.x || up.z + DIR_DZ[up.rot] !== cur.z) continue;
                feeding.add(up.id);
                frontier.push({ x: up.x, z: up.z });
            }
        }
        for (const id of feeding) {
            const b = world.buildings[id];
            for (let d = 0; d < 4; d++) {
                const n = { x: b.x + DIR_DX[d], z: b.z + DIR_DZ[d] };
                if (!free(n.x, n.z)) continue;
                if (goals.has(keyOf(n.x, n.z))) continue;
                goals.add(keyOf(n.x, n.z));
                joins.set(keyOf(n.x, n.z), { x: b.x, z: b.z });
            }
        }
    }

    // Search without tunnels first, so a route only hops under other belts when no plain route exists.
    const search = (allowTunnels: boolean): { found: string | null; prev: Map<string, { from: string | null; tunnel: boolean }> } => {
        // A landing node is a tunnel exit: its key carries the direction it must keep going, and it cannot be a goal.
        const prev = new Map<string, { from: string | null; tunnel: boolean }>();
        const queue: { key: string; x: number; z: number; exitDir: number }[] = [];
        for (const st of starts) {
            if (!free(st.x, st.z)) continue;
            const k = keyOf(st.x, st.z);
            if (!prev.has(k)) {
                prev.set(k, { from: null, tunnel: false });
                queue.push({ key: k, x: st.x, z: st.z, exitDir: -1 });
            }
        }
        for (let qi = 0; qi < queue.length; qi++) {
            const c = queue[qi];
            if (c.exitDir < 0 && goals.has(c.key)) return { found: c.key, prev };
            if (prev.size > MAX_ROUTE) break;
            if (c.exitDir >= 0) {
                // Forced: the exit pushes straight on. If that is the target building, the exit feeds it directly.
                const nx = c.x + DIR_DX[c.exitDir];
                const nz = c.z + DIR_DZ[c.exitDir];
                const nk = keyOf(nx, nz);
                if (toB && buildingAt(world, nx, nz, cat)?.id === toB.id) return { found: c.key, prev };
                if (!prev.has(nk) && free(nx, nz)) {
                    prev.set(nk, { from: c.key, tunnel: false });
                    queue.push({ key: nk, x: nx, z: nz, exitDir: -1 });
                }
                continue;
            }
            for (let d = 0; d < 4; d++) {
                const nx = c.x + DIR_DX[d];
                const nz = c.z + DIR_DZ[d];
                const nk = keyOf(nx, nz);
                if (!prev.has(nk) && free(nx, nz)) {
                    prev.set(nk, { from: c.key, tunnel: false });
                    queue.push({ key: nk, x: nx, z: nz, exitDir: -1 });
                }
                if (!allowTunnels) continue;
                // Hop 2 to TUNNEL_REACH cells ahead, under whatever is between. The entrance sits on this cell.
                for (let k = 2; k <= TUNNEL_REACH; k++) {
                    const lx = c.x + DIR_DX[d] * k;
                    const lz = c.z + DIR_DZ[d] * k;
                    const lk = `${keyOf(lx, lz)}#${d}`;
                    if (prev.has(lk) || !free(lx, lz)) continue;
                    prev.set(lk, { from: c.key, tunnel: true });
                    queue.push({ key: lk, x: lx, z: lz, exitDir: d });
                }
            }
        }
        return { found: null, prev };
    };
    let result = search(false);
    if (result.found === null) result = search(true);
    const { found, prev } = result;
    if (found === null) return { ok: false, reason: "no clear route: belts cannot cross machines, the hub or other belts. Leave a gap or use a tunnel." };

    // Walk back from the goal to the start. Landing nodes are tunnel exits; the cell before one is its entrance.
    const path: { key: string; x: number; z: number; exitDir: number; tunnelIn: boolean }[] = [];
    for (let k: string | null = found; k !== null; ) {
        const entry = prev.get(k);
        const [pos, dirPart] = k.split("#");
        const [x, z] = pos.split(",").map(Number);
        path.push({ key: k, x, z, exitDir: dirPart === undefined ? -1 : Number(dirPart), tunnelIn: false });
        k = entry?.from ?? null;
    }
    path.reverse();
    // A cell is a tunnel entrance when the next node is a tunnel landing.
    for (let i = 0; i + 1 < path.length; i++) {
        const nextEntry = prev.get(path[i + 1].key);
        if (nextEntry?.tunnel && nextEntry.from === path[i].key) path[i].tunnelIn = true;
    }
    const cells: RouteCell[] = [];
    for (let i = 0; i < path.length; i++) {
        const c = path[i];
        const cell = { x: c.x, z: c.z };
        if (c.exitDir >= 0) {
            cells.push({ x: c.x, z: c.z, rot: c.exitDir as Rot, kind: `${belt}-underground-out` });
            continue;
        }
        if (c.tunnelIn) {
            const landing = path[i + 1];
            cells.push({ x: c.x, z: c.z, rot: landing.exitDir as Rot, kind: `${belt}-underground-in` });
            continue;
        }
        let rot: Rot;
        if (i + 1 < path.length) rot = dirTo(cell, path[i + 1]);
        else if (joins.has(keyOf(c.x, c.z))) rot = dirTo(cell, joins.get(keyOf(c.x, c.z))!);
        else rot = toB ? intoBuildingRot(cell, toB.id, cat, world) : dirOfGoalFallback(cell, to);
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

// A spot for a new machine. It must cover free ground that is not a resource node, and must have at least one free cell
// beside it so a belt can reach it. Nearest to the hub first. Returns null when nothing fits. It only suggests; it places nothing.
export function suggestSpot(world: World, footprint: Footprint, cat: Catalog = DEFAULT_CATALOG): { x: number; z: number } | null {
    const hub = world.buildings[world.hubId];
    // Keep each node and the cells its 2 by 2 drill would cover open, so a machine cannot take the node.
    const nodeCover = (x: number, z: number) => [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([dx, dz]) => world.deposits[keyOf(x + dx, z + dz)] !== undefined);
    const open = (x: number, z: number) => x >= 0 && z >= 0 && x < world.width && z < world.depth && !buildingAt(world, x, z, cat) && !nodeCover(x, z);
    let best: { x: number; z: number; d: number } | null = null;
    for (let z = 0; z + footprint.d <= world.depth; z++) {
        for (let x = 0; x + footprint.w <= world.width; x++) {
            let fits = true;
            for (let dz = 0; dz < footprint.d && fits; dz++) for (let dx = 0; dx < footprint.w && fits; dx++) if (!open(x + dx, z + dz)) fits = false;
            if (!fits) continue;
            // One free cell beside the footprint, so a belt can reach it.
            let port = false;
            for (let dz = -1; dz <= footprint.d && !port; dz++) {
                for (let dx = -1; dx <= footprint.w && !port; dx++) {
                    const inside = dx >= 0 && dz >= 0 && dx < footprint.w && dz < footprint.d;
                    if (!inside && open(x + dx, z + dz)) port = true;
                }
            }
            if (!port) continue;
            const d = Math.abs(x - hub.x) + Math.abs(z - hub.z);
            if (!best || d < best.d) best = { x, z, d };
        }
    }
    return best ? { x: best.x, z: best.z } : null;
}
