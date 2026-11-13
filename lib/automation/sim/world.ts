// Core simulation: placement, the fixed tick, belts, crafting, mining, power, and offline catch-up.
// Deterministic: buildings update in id order, so the same world and the same steps always give the same result.
import type { ActionResult, Building, Catalog, Cell, Footprint, Deposit, PlaceResult, Rot, Stack, World, EngineDef, LogisticsKind } from "../types";
import { DIR_DX, DIR_DZ} from "../types";
import { DEFAULT_CATALOG } from "./data";
import { checkMilestones } from "./progress";

export const DRILL = "drill"; // the tree machine that sits on a resource node
export const SPRING = "spring_winder"; // the battery generator
export const BATTERIES = ["spring_winder", "spring_store"]; // wound springs: store wind surplus, release it in calm air
export const HUB = "hub";

export type Kind = "hub" | "dock" | "belt" | "generator" | "miner" | "crafter" | "storage" | LogisticsKind;

// Logistics pieces that pass items through a small buffer (in b.output) and push them on each tick.
const JUNCTIONS: Kind[] = ["splitter", "merger", "tunnel-in", "tunnel-out", "loader", "unloader"];
const TUNNEL_REACH = 5; // cells a tunnel can jump
const isJunction = (k: Kind) => JUNCTIONS.includes(k);

export interface Resolved {
    id: string;
    kind: Kind;
    name: string;
    footprint: Footprint;
    placeable: boolean;
    cost: Stack[];
    power: number;
    supply: number;
    range: number; // generators: covers consumers whose centre is within this many cells
    speed: number;
    spacing: number;
    beltSpeed: number;
    outputCap: number;
    storageKj: number; // batteries: capacity in kJ from the tree (0 when the machine stores nothing)
    rate: number; // logistics: items per second
    capacity: number; // storage: per item; logistics: buffer size
}

// Capacity of a battery in kJ. The tree's storageKj wins; otherwise a wound spring holds springSeconds of its own output.
export function capacityOf(r: Resolved, cat: Catalog): number {
    return r.storageKj > 0 ? r.storageKj : r.supply * cat.tune.springSeconds;
}

export function resolve(cat: Catalog, type: string): Resolved | null {
    const e: EngineDef | undefined = cat.engine[type];
    if (e) {
        return {
            id: type,
            kind: e.kind,
            name: e.name,
            footprint: e.footprint,
            placeable: e.placeable !== false,
            cost: e.cost,
            power: 0,
            supply: e.supply ?? 0,
            range: 0,
            speed: 1,
            spacing: e.belt?.spacing ?? 0,
            beltSpeed: e.belt?.speed ?? 0,
            outputCap: cat.tune.defaultOutputCap,
            storageKj: 0,
            rate: e.rate ?? 0,
            capacity: e.capacity ?? 0,
        };
    }
    const m = cat.tree.machines.find((x) => x.id === type);
    if (!m) return null;
    const gen = m.generatesKw ?? 0;
    const battery = BATTERIES.includes(type);
    return {
        id: type,
        kind: gen > 0 || battery ? "generator" : type === DRILL ? "miner" : "crafter",
        name: m.name,
        footprint: m.footprint,
        placeable: true,
        cost: m.buildCost ?? [],
        power: m.powerKw,
        supply: gen,
        range: m.supplyRange ?? 0,
        speed: m.speed,
        spacing: 0,
        beltSpeed: 0,
        outputCap: cat.tune.defaultOutputCap,
        storageKj: m.storageKj ?? 0,
        rate: 0,
        capacity: 0,
    };
}

export interface CreateOptions {
    width?: number;
    depth?: number;
    hub?: Cell;
    startStock?: Stack[];
}

export const keyOf = (x: number, z: number): string => `${x},${z}`;

// Cell -> building id. Derived from world.buildings, never saved, rebuilt after every change to the building set.
const indexCache = new WeakMap<World, { ref: World["buildings"]; map: Map<string, number> }>();

function rebuildIndex(world: World, cat: Catalog): Map<string, number> {
    const map = new Map<string, number>();
    for (const id of Object.keys(world.buildings).map(Number)) {
        const b = world.buildings[id];
        const r = resolve(cat, b.type);
        if (!r) continue;
        for (const [x, z] of footprintCells(b, r.footprint)) map.set(keyOf(x, z), id);
    }
    indexCache.set(world, { ref: world.buildings, map });
    return map;
}

function indexOf(world: World, cat: Catalog): Map<string, number> {
    const cached = indexCache.get(world);
    if (cached && cached.ref === world.buildings) return cached.map;
    return rebuildIndex(world, cat);
}

// Footprint with rotation: rot 1 or 3 (east-west) swaps w and d.
export function footprintCells(b: { x: number; z: number; rot: Rot }, fp: Footprint): [number, number][] {
    const swap = b.rot === 1 || b.rot === 3;
    const fw = swap ? fp.d : fp.w;
    const fd = swap ? fp.w : fp.d;
    const out: [number, number][] = [];
    for (let dz = 0; dz < fd; dz++) for (let dx = 0; dx < fw; dx++) out.push([b.x + dx, b.z + dz]);
    return out;
}

// Stock a new world starts with when the caller gives none: enough for two drills, a kiln and a run of belts.
// Drill and kiln have no build cost in the Recipe tree yet, so this covers them and the belts; see STATUS.md.
export const STARTER_KIT: Stack[] = [
    { item: "iron_plate", qty: 40 },
    { item: "copper_wire", qty: 20 },
    { item: "iron_gear", qty: 6 },
];

export function createWorld(opts: CreateOptions = {}, cat: Catalog = DEFAULT_CATALOG): World {
    const width = opts.width ?? 64;
    const depth = opts.depth ?? 64;
    const hubDef = resolve(cat, HUB);
    if (!hubDef) throw new Error("catalog has no hub");
    const hubCell = opts.hub ?? { x: Math.floor(width / 2) - 1, z: Math.floor(depth / 2) - 1 };
    const world: World = {
        version: 1,
        time: 0,
        width,
        depth,
        nextId: 1,
        hubId: 0,
        deposits: {},
        buildings: {},
        power: { supply: 0, demand: 0, satisfaction: 1 },
        progress: { blueprints: 0, researched: [], milestonesDone: [], delivered: {}, prestiges: 0, site: null, bonus: { miner: 1, power: 1 } },
        wind: 0.5,
        windPin: null,
    };
    const hub = newBuilding(world, HUB, hubCell.x, hubCell.z, 0);
    world.hubId = hub.id;
    for (const s of opts.startStock ?? STARTER_KIT) hub.input[s.item] = (hub.input[s.item] ?? 0) + s.qty;
    rebuildIndex(world, cat);
    return world;
}

// Gusts from summed sines of the clock, so the same time always gives the same wind (no RNG to save).
export function windAt(t: number): number {
    const v = 0.5 + 0.25 * Math.sin(t / 37) + 0.15 * Math.sin(t / 11 + 1) + 0.1 * Math.sin(t / 5.3 + 2.5);
    return Math.min(1, Math.max(0, v));
}

function newBuilding(world: World, type: string, x: number, z: number, rot: Rot): Building {
    const id = world.nextId++;
    const b: Building = { id, type, x, z, rot, recipe: null, crafting: false, progress: 0, input: {}, output: {}, acc: 0, lane: [], rr: 0, charge: 0 };
    world.buildings[id] = b;
    return b;
}

export function addDeposit(world: World, x: number, z: number, item: string, purity = 1): void {
    world.deposits[keyOf(x, z)] = { item, purity };
}

export function allCells(world: World, cat: Catalog = DEFAULT_CATALOG): Map<string, number> {
    return indexOf(world, cat);
}

export function stock(world: World, item: string): number {
    return world.buildings[world.hubId]?.input[item] ?? 0;
}

export function buildingAt(world: World, x: number, z: number, cat: Catalog = DEFAULT_CATALOG): Building | null {
    const id = indexOf(world, cat).get(keyOf(x, z));
    return id === undefined ? null : world.buildings[id];
}

// Why a building cannot go at (x, z) with this rotation, or null if it can. Pure: changes nothing.
export function placeError(world: World, type: string, x: number, z: number, rot: Rot = 0, cat: Catalog = DEFAULT_CATALOG): string | null {
    const r = resolve(cat, type);
    if (!r) return `unknown building ${type}`;
    if (!r.placeable) return `${r.name} cannot be placed`;
    const cells = footprintCells({ x, z, rot }, r.footprint);
    const index = indexOf(world, cat);
    for (const [cx, cz] of cells) {
        if (cx < 0 || cz < 0 || cx >= world.width || cz >= world.depth) return "off the island";
        if (index.has(keyOf(cx, cz))) return "occupied";
    }
    if (r.kind === "miner" && !world.deposits[keyOf(x, z)]) return "needs a resource node";
    const hub = world.buildings[world.hubId];
    for (const c of r.cost) {
        if ((hub.input[c.item] ?? 0) < c.qty) return `needs ${c.qty} ${cat.tree.items.find((i) => i.id === c.item)?.name ?? c.item}`;
    }
    return null;
}

// Place a building anchored at (x, z). Pays the cost from the hub stock.
export function place(world: World, type: string, x: number, z: number, rot: Rot = 0, cat: Catalog = DEFAULT_CATALOG): PlaceResult {
    const err = placeError(world, type, x, z, rot, cat);
    if (err) return { ok: false, reason: err };
    const r = resolve(cat, type)!;
    const hub = world.buildings[world.hubId];
    for (const c of r.cost) hub.input[c.item] -= c.qty;
    const b = newBuilding(world, type, x, z, rot);
    rebuildIndex(world, cat);
    return { ok: true, id: b.id };
}

function refund(hub: Building, b: Building): void {
    for (const k of Object.keys(b.input)) hub.input[k] = (hub.input[k] ?? 0) + b.input[k];
    for (const k of Object.keys(b.output)) hub.input[k] = (hub.input[k] ?? 0) + b.output[k];
    for (const it of b.lane) hub.input[it.item] = (hub.input[it.item] ?? 0) + 1;
    b.input = {};
    b.output = {};
    b.lane = [];
}

// Remove a building. Half the cost comes back, and anything it held goes back to the hub.
export function remove(world: World, id: number, cat: Catalog = DEFAULT_CATALOG): ActionResult {
    const b = world.buildings[id];
    if (!b) return { ok: false, reason: "no such building" };
    const r = resolve(cat, b.type);
    if (!r) return { ok: false, reason: "unknown building" };
    if (r.kind === "hub") return { ok: false, reason: "the hub cannot be removed" };
    const hub = world.buildings[world.hubId];
    for (const c of r.cost) hub.input[c.item] = (hub.input[c.item] ?? 0) + Math.floor(c.qty / 2);
    refund(hub, b);
    delete world.buildings[id];
    rebuildIndex(world, cat);
    return { ok: true };
}

// Set or clear the recipe on a crafter. Buffers go back to the hub, so a recipe change never destroys items.
export function setRecipe(world: World, id: number, recipe: string | null, cat: Catalog = DEFAULT_CATALOG): ActionResult {
    const b = world.buildings[id];
    if (!b) return { ok: false, reason: "no such building" };
    const r = resolve(cat, b.type);
    if (!r || r.kind !== "crafter") return { ok: false, reason: "this building does not craft" };
    if (recipe !== null) {
        const rec = cat.tree.recipes.find((x) => x.id === recipe);
        if (!rec || rec.machine !== b.type) return { ok: false, reason: "that recipe does not run here" };
    }
    refund(world.buildings[world.hubId], b);
    b.recipe = recipe;
    b.crafting = false;
    b.progress = 0;
    return { ok: true };
}

function recipeById(cat: Catalog, id: string | null) {
    return id === null ? undefined : cat.tree.recipes.find((x) => x.id === id);
}

// Does the tile (tx, tz) take this item from the tile (fromX, fromZ)? If yes, it takes it.
function accept(world: World, cat: Catalog, index: Map<string, number>, tx: number, tz: number, item: string, fromX: number, fromZ: number, carry = 0): boolean {
    const id = index.get(keyOf(tx, tz));
    if (id === undefined) return false;
    const b = world.buildings[id];
    const r = resolve(cat, b.type);
    if (!r) return false;
    switch (r.kind) {
        case "hub":
        case "dock":
            b.input[item] = (b.input[item] ?? 0) + 1;
            world.progress.delivered[item] = (world.progress.delivered[item] ?? 0) + 1;
            return true;
        case "storage":
            if ((b.input[item] ?? 0) >= r.capacity) return false;
            b.input[item] = (b.input[item] ?? 0) + 1;
            return true;
        case "splitter":
        case "merger":
        case "tunnel-in":
        case "tunnel-out":
        case "loader": {
            // Buffers hold up to `capacity` items in all, and move them on in pushOutput.
            const held = Object.values(b.output).reduce((a, n) => a + n, 0);
            if (held >= r.capacity) return false;
            b.output[item] = (b.output[item] ?? 0) + 1;
            return true;
        }
        case "crafter": {
            const rec = recipeById(cat, b.recipe);
            const need = rec?.inputs.find((s) => s.item === item);
            if (!need) return false;
            if ((b.input[item] ?? 0) >= need.qty * cat.tune.inputBufferMult) return false;
            b.input[item] = (b.input[item] ?? 0) + 1;
            return true;
        }
        case "belt": {
            // A belt never takes from the cell in front of it: that would be a head-on feed.
            if (fromX === b.x + DIR_DX[b.rot] && fromZ === b.z + DIR_DZ[b.rot]) return false;
            // Items keep exactly `spacing` between them, so the carry-over from the last tick is not lost.
            const last = b.lane[b.lane.length - 1];
            if (last && last.pos < r.spacing) return false;
            b.lane.push({ item, pos: last ? last.pos - r.spacing : carry });
            return true;
        }
        default:
            return false;
    }
}

interface Port {
    tx: number;
    tz: number;
    fx: number;
    fz: number;
}

// Cells next to a building's footprint, each paired with the footprint cell it touches.
function portsOf(b: Building, fp: Footprint): Port[] {
    const cells = footprintCells(b, fp);
    const inside = new Set(cells.map(([x, z]) => keyOf(x, z)));
    const out: Port[] = [];
    const seen = new Set<string>();
    for (const [fx, fz] of cells) {
        for (let d = 0; d < 4; d++) {
            const tx = fx + DIR_DX[d];
            const tz = fz + DIR_DZ[d];
            const k = keyOf(tx, tz);
            if (inside.has(k) || seen.has(k)) continue;
            seen.add(k);
            out.push({ tx, tz, fx, fz });
        }
    }
    return out;
}

// Which neighbouring cells a building may push into. Miners and crafters push everywhere; logistics pieces are directional.
function allowedPort(world: World, cat: Catalog, index: Map<string, number>, b: Building, r: Resolved, p: Port): boolean {
    const fwdX = b.x + DIR_DX[b.rot];
    const fwdZ = b.z + DIR_DZ[b.rot];
    const behindX = b.x - DIR_DX[b.rot];
    const behindZ = b.z - DIR_DZ[b.rot];
    const target = index.get(keyOf(p.tx, p.tz));
    const tk = target === undefined ? null : resolve(cat, world.buildings[target].type)?.kind ?? null;
    switch (r.kind) {
        case "splitter": return !(p.tx === behindX && p.tz === behindZ);
        case "merger": return p.tx === fwdX && p.tz === fwdZ;
        case "tunnel-out": return p.tx === fwdX && p.tz === fwdZ;
        case "loader": return tk === "storage" || tk === "dock" || tk === "hub";
        case "unloader": return tk === "belt";
        default: return true;
    }
}

// Push buffered items out. `budget` caps how many items go this tick (junctions move `rate` a second; miners and crafters are unlimited).
function pushOutput(world: World, cat: Catalog, index: Map<string, number>, b: Building, r: Resolved, budget = Infinity): number {
    const items = Object.keys(b.output);
    if (items.length === 0) return 0;
    const ports = portsOf(b, r.footprint).filter((p) => allowedPort(world, cat, index, b, r, p));
    if (ports.length === 0) return 0;
    let moved = 0;
    for (const item of items) {
        let n = b.output[item];
        for (let i = 0; i < ports.length && n > 0 && moved < budget; i++) {
            const p = ports[(b.rr + i) % ports.length];
            if (accept(world, cat, index, p.tx, p.tz, item, p.fx, p.fz)) {
                n--;
                moved++;
                b.rr = (b.rr + i + 1) % ports.length;
            }
        }
        if (n > 0) b.output[item] = n;
        else delete b.output[item];
    }
    return moved;
}

// A tunnel entrance sends each item to the exit up to TUNNEL_REACH cells ahead; the items skip the cells between.
function pushTunnel(world: World, cat: Catalog, index: Map<string, number>, b: Building, budget: number): number {
    let moved = 0;
    for (let d = 1; d <= TUNNEL_REACH && moved < budget; d++) {
        const tx = b.x + DIR_DX[b.rot] * d;
        const tz = b.z + DIR_DZ[b.rot] * d;
        const id = index.get(keyOf(tx, tz));
        if (id === undefined) continue;
        const exit = world.buildings[id];
        if (resolve(cat, exit.type)?.kind !== "tunnel-out") break;
        for (const item of Object.keys(b.output)) {
            while ((b.output[item] ?? 0) > 0 && moved < budget) {
                if (!accept(world, cat, index, tx, tz, item, b.x, b.z)) return moved;
                b.output[item]--;
                moved++;
            }
            if (!b.output[item]) delete b.output[item];
        }
        return moved;
    }
    return moved;
}

// Unloader: pulls up to `budget` items out of the storage or hub cells beside it into its own buffer. Returns how many it took.
function pullIntoUnloader(world: World, cat: Catalog, index: Map<string, number>, b: Building, r: Resolved, budget: number): number {
    let took = 0;
    for (const p of portsOf(b, r.footprint)) {
        const id = index.get(keyOf(p.tx, p.tz));
        if (id === undefined) continue;
        const src = world.buildings[id];
        const sk = resolve(cat, src.type)?.kind;
        if (sk !== "storage" && sk !== "hub") continue;
        for (const item of Object.keys(src.input)) {
            while (took < budget && (src.input[item] ?? 0) > 0) {
                const held = Object.values(b.output).reduce((a, n) => a + n, 0);
                if (held >= r.capacity) return took;
                src.input[item]--;
                b.output[item] = (b.output[item] ?? 0) + 1;
                took++;
            }
            if (!src.input[item]) delete src.input[item];
        }
    }
    return took;
}

function stepMiner(world: World, cat: Catalog, b: Building, r: Resolved, dt: number, sat: number): void {
    const dep: Deposit | undefined = world.deposits[keyOf(b.x, b.z)];
    if (!dep) return;
    const node = cat.tree.nodes.find((n) => n.item === dep.item);
    if (!node) return;
    const perSecond = (node.baseRatePerMin / 60) * dep.purity * r.speed * sat * world.progress.bonus.miner;
    b.acc += perSecond * dt;
    while (b.acc >= 1) {
        const have = b.output[dep.item] ?? 0;
        if (have >= r.outputCap) {
            b.acc = 1; // stalled: keep one unit ready, bank nothing more
            break;
        }
        b.output[dep.item] = have + 1;
        b.acc -= 1;
    }
}

function stepCrafter(cat: Catalog, b: Building, r: Resolved, dt: number, sat: number): void {
    const rec = recipeById(cat, b.recipe);
    if (!rec) return;
    b.progress += dt * r.speed * sat;
    for (let guard = 0; guard < 1000; guard++) {
        if (!b.crafting) {
            const ready = rec.inputs.every((s) => (b.input[s.item] ?? 0) >= s.qty);
            if (!ready) {
                b.progress = 0;
                break;
            }
            for (const s of rec.inputs) b.input[s.item] -= s.qty;
            b.crafting = true;
        }
        if (b.progress < rec.craftSeconds) break;
        const out = rec.output;
        if ((b.output[out.item] ?? 0) + out.qty > r.outputCap) break; // stalled on output; progress waits
        b.output[out.item] = (b.output[out.item] ?? 0) + out.qty;
        b.progress -= rec.craftSeconds;
        b.crafting = false;
    }
    if (b.crafting && b.progress > rec.craftSeconds) b.progress = rec.craftSeconds;
    for (const k of Object.keys(b.input)) if (b.input[k] <= 0) delete b.input[k];
}

function moveLane(world: World, cat: Catalog, index: Map<string, number>, b: Building, r: Resolved, dt: number): void {
    const lane = b.lane;
    if (lane.length === 0) return;
    // The lead may run past the exit; the overshoot is carried onto the next belt, so no time is lost at a hop.
    for (let i = 0; i < lane.length; i++) {
        const it = lane[i];
        const limit = i === 0 ? Infinity : lane[i - 1].pos - r.spacing;
        const next = Math.min(it.pos + r.beltSpeed * dt, limit);
        if (next > it.pos) it.pos = next;
    }
    while (lane.length > 0 && lane[0].pos >= 1) {
        const tx = b.x + DIR_DX[b.rot];
        const tz = b.z + DIR_DZ[b.rot];
        const lead = lane[0];
        if (!accept(world, cat, index, tx, tz, lead.item, b.x, b.z, lead.pos - 1)) {
            lead.pos = 1; // blocked at the exit
            break;
        }
        lane.shift();
    }
}

// Power. Generators cover consumers by range (centre to centre, Chebyshev). A windmill gives its peak
// scaled by wind (full at wind 0.5 and above). A wound spring is a battery: it charges while the wind is
// above 0.5 and releases its stored energy in calm air. Each generator shares its output among the
// consumers it covers, and a consumer runs at the share it receives (capped at 1).
function centreOf(b: Building, fp: Footprint): [number, number] {
    const cells = footprintCells(b, fp);
    const xs = cells.map((c) => c[0]);
    const zs = cells.map((c) => c[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
}

function updatePower(world: World, cat: Catalog, defs: Map<number, Resolved>, dt: number): Map<number, number> {
    const gens: { id: number; cx: number; cz: number; range: number; out: number }[] = [];
    const consumers: { id: number; cx: number; cz: number; need: number }[] = [];
    let supply = 0;
    let demand = 0;
    for (const id of Object.keys(world.buildings).map(Number)) {
        const b = world.buildings[id];
        const r = defs.get(id);
        if (!r) continue;
        if (r.kind === "generator") {
            const [cx, cz] = centreOf(b, r.footprint);
            let out: number;
            if (BATTERIES.includes(r.id)) {
                const cap = capacityOf(r, cat);
                if (world.wind > 0.5) {
                    b.charge = Math.min(cap, b.charge + r.supply * (world.wind - 0.5) * 2 * dt);
                    out = 0;
                } else {
                    out = Math.min(r.supply, b.charge / dt);
                    b.charge = Math.max(0, b.charge - out * dt);
                }
            } else {
                out = r.supply * Math.min(1, 2 * world.wind);
            }
            gens.push({ id, cx, cz, range: r.range, out });
            supply += out;
        } else if ((r.kind === "miner" || r.kind === "crafter") && r.power > 0) {
            const [cx, cz] = centreOf(b, r.footprint);
            consumers.push({ id, cx, cz, need: r.power });
            demand += r.power;
        }
    }
    // How many consumers each generator reaches, so its output can be shared.
    const reach = gens.map((g) => consumers.filter((c) => Math.max(Math.abs(c.cx - g.cx), Math.abs(c.cz - g.cz)) <= g.range));
    const received = new Map<number, number>();
    gens.forEach((g, gi) => {
        const share = g.out / Math.max(1, reach[gi].length);
        for (const c of reach[gi]) received.set(c.id, (received.get(c.id) ?? 0) + share);
    });
    const sat = new Map<number, number>();
    let got = 0;
    for (const c of consumers) {
        const v = Math.min(1, (received.get(c.id) ?? 0) / c.need);
        sat.set(c.id, v);
        got += Math.min(c.need, received.get(c.id) ?? 0);
    }
    world.power = { supply, demand, satisfaction: demand <= 0 ? 1 : Math.min(1, got / demand) };
    return sat;
}

// Advance the world by dt seconds. Order: wind, power, machines, belts, output pushes, milestones.
export function step(world: World, dt: number, cat: Catalog = DEFAULT_CATALOG): void {
    if (dt <= 0) return;
    const index = indexOf(world, cat);
    const ids = Object.keys(world.buildings).map(Number);
    const defs = new Map<number, Resolved>();
    for (const id of ids) {
        const r = resolve(cat, world.buildings[id].type);
        if (r) defs.set(id, r);
    }
    world.wind = world.windPin ?? windAt(world.time);
    const sat = updatePower(world, cat, defs, dt);

    for (const id of ids) {
        const r = defs.get(id);
        if (!r) continue;
        const b = world.buildings[id];
        const s = sat.get(id) ?? 1;
        if (r.kind === "miner") stepMiner(world, cat, b, r, dt, s);
        else if (r.kind === "crafter") stepCrafter(cat, b, r, dt, s);
    }
    for (const id of ids) {
        const r = defs.get(id);
        if (r && r.kind === "belt") moveLane(world, cat, index, world.buildings[id], r, dt);
    }
    for (const id of ids) {
        const r = defs.get(id);
        if (!r) continue;
        const b = world.buildings[id];
        if (r.kind === "miner" || r.kind === "crafter") pushOutput(world, cat, index, b, r);
        else if (isJunction(r.kind)) {
            // Junctions move `rate` items a second; spare time does not bank up.
            b.acc = Math.min((b.acc ?? 0) + r.rate * dt, r.rate);
            const budget = Math.floor(b.acc);
            let moved: number;
            if (r.kind === "unloader") {
                // The unloader's rate limits what it takes from storage; its buffer then goes out unlimited.
                moved = pullIntoUnloader(world, cat, index, b, r, budget);
                pushOutput(world, cat, index, b, r);
            } else if (r.kind === "tunnel-in") {
                moved = pushTunnel(world, cat, index, b, budget);
            } else {
                moved = pushOutput(world, cat, index, b, r, budget);
            }
            b.acc -= moved;
        }
    }
    world.time += dt;
    checkMilestones(world, cat);
}

// Run exactly `seconds` of simulated time at a fixed step.
export function advance(world: World, seconds: number, dt: number, cat: Catalog = DEFAULT_CATALOG): void {
    let left = seconds;
    while (left > 1e-9) {
        const h = Math.min(dt, left);
        step(world, h, cat);
        left -= h;
    }
}

export interface CatchUpResult {
    simulated: number;
    skipped: number;
}

// Offline catch-up: the first fineWindow seconds run at the fine step, the rest at the coarse step.
// Time past maxAwaySeconds is dropped and reported as skipped.
export function catchUp(world: World, seconds: number, cat: Catalog = DEFAULT_CATALOG): CatchUpResult {
    const away = Math.max(0, seconds);
    const simulated = Math.min(away, cat.tune.maxAwaySeconds);
    const fine = Math.min(simulated, cat.tune.fineWindow);
    advance(world, fine, cat.tune.fineDt, cat);
    advance(world, simulated - fine, cat.tune.coarseDt, cat);
    return { simulated, skipped: away - simulated };
}

export function summary(world: World) {
    const counts: Record<string, number> = {};
    for (const id of Object.keys(world.buildings)) {
        const t = world.buildings[Number(id)].type;
        counts[t] = (counts[t] ?? 0) + 1;
    }
    return { time: world.time, counts, stock: { ...world.buildings[world.hubId].input }, power: { ...world.power } };
}

// Stored charge of every battery, as 0 to 1 of its capacity. The spring-store needle is driven from this.
export function chargeOf(world: World, cat: Catalog = DEFAULT_CATALOG): Record<number, number> {
    const out: Record<number, number> = {};
    for (const id of Object.keys(world.buildings).map(Number)) {
        const b = world.buildings[id];
        const r = resolve(cat, b.type);
        if (!r || !BATTERIES.includes(r.id)) continue;
        const cap = capacityOf(r, cat);
        out[id] = cap > 0 ? Math.min(1, b.charge / cap) : 0;
    }
    return out;
}
