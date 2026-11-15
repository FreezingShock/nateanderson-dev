// Builds the panel data (HudData from lib/automation/types.ts) from the world, and wraps the actions the HUD calls.
// Rates are theoretical: what the machines make and use right now at full buffers and current power, not measured over time.
// The HUD never edits the world; it calls the actions below.
import type {
    ActionResult,
    AreaView,
    Building,
    Catalog,
    HudData,
    HubStep,
    HubUnlock,
    HudSettings,
    Line,
    MachineDetail,
    RecipeEntry,
    MachineStatus,
    MachineView,
    MilestoneView,
    NextStepView,
    PlaceResult,
    ResearchNode,
    ResourceView,
    Rot,
    StatLine,
    World,
} from "../types";
import { DEFAULT_CATALOG, SITES } from "./data";
import { unlockedRecipes, dayClock, requestDone, currentCommission, buyResearch as buyResearchRaw, prestige as prestigeRaw } from "./progress";
import { hubStageFor } from "../models/machines/hub";
import { place as placeRaw, setRecipe as setRecipeRaw, setFilter as setFilterRaw, resolve, BATTERIES, SPRING, depositUnder, hasOutputNeighbour } from "./world";

/** Items the resource bar always shows, even before the first one arrives: the early chain a new player builds. */
export const ESSENTIAL_RESOURCES = ["iron_ore", "copper_ore", "coal", "iron_ingot", "copper_ingot", "iron_plate", "copper_wire", "iron_gear"];

export const DEFAULT_SETTINGS: HudSettings = { sound: false, reduceMotion: false, lowFx: false, numberFormat: "short", showRates: true };

// Bonus as a signed percent line, e.g. 1.15 becomes "+15%".
const pct = (x: number): string => {
    const v = Math.round((x - 1) * 100);
    return `${v >= 0 ? "+" : ""}${v}%`;
};

// The supply crate as hub tiles: one per item, with its icon.
const crateTiles = (cat: Catalog, reward: { item: string; qty: number }[] | undefined): HubUnlock[] =>
    (reward ?? []).map((x): HubUnlock => ({ kind: "crate", id: `crate-${x.item}`, name: `${x.qty} ${nameOf(cat, x.item)}`, icon: x.item, qty: x.qty, label: nameOf(cat, x.item) }));

// "+12 blueprints and 20 Iron plate, 20 Copper wire" for a milestone or commission payout.
function rewardLineOf(cat: Catalog, blueprints: number, reward: { item: string; qty: number }[] | undefined): string {
    const crate = (reward ?? []).map((x) => `${x.qty} ${nameOf(cat, x.item)}`).join(", ");
    const bp = `+${blueprints} blueprint${blueprints === 1 ? "" : "s"}`;
    return crate ? `${bp} and a crate: ${crate}` : bp;
}

const glyphOf = (name: string): string => name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";

function nameOf(cat: Catalog, id: string): string {
    return cat.tree.items.find((i) => i.id === id)?.name ?? id;
}

function lines(stacks: { item: string; qty: number }[]): Line[] {
    return stacks.map((s) => ({ resourceId: s.item, amount: s.qty }));
}

// Generators: what they produce now, their rating, wind, reach and the machines they feed.
function generatorDetail(world: World, cat: Catalog, b: Building): Partial<MachineDetail> | null {
    const r = resolve(cat, b.type);
    const def = r0(cat, b.type);
    if (!r || r.kind !== "generator" || !def) return null;
    const battery = BATTERIES.includes(r.id);
    const steady = r.id === SPRING;
    const isWind = !battery && !steady && def.generatesKw !== undefined;
    const wind = world.wind;
    const producedKw = battery ? 0 : r.supply * (steady ? 1 : Math.min(1, 2 * wind)) * world.progress.bonus.power;
    const range = r.range;
    const fedCount = Object.values(world.buildings).filter((o) => {
        const orr = resolve(cat, o.type);
        if (!orr || (orr.kind !== "miner" && orr.kind !== "crafter") || !(orr.power > 0)) return false;
        return Math.max(Math.abs(o.x - b.x), Math.abs(o.z - b.z)) <= range + 1;
    }).length;
    return {
        producedKw: Math.round(producedKw * 10) / 10,
        maxKw: r.supply,
        windPct: isWind ? Math.round(wind * 100) / 100 : undefined,
        fedCount,
        rangeCells: range,
    };
}

// Consumers: what they need, how much of it they get, and whether they are fully powered.
function consumerDetail(world: World, cat: Catalog, b: Building): Partial<MachineDetail> | null {
    const r = resolve(cat, b.type);
    if (!r || !(r.power > 0)) return null;
    const satisfied = b.powerSat ?? 1;
    return { usedKw: r.power, satisfied: Math.round(satisfied * 100) / 100, fullyPowered: satisfied >= 0.999 };
}

// Per-building flow: what it makes and uses per second, its status, and the batch progress.
interface Flow {
    makes: Record<string, number>;
    uses: Record<string, number>;
    status: MachineStatus;
    progress: number;
}

function flowOf(world: World, cat: Catalog, b: Building): Flow {
    const flow: Flow = { makes: {}, uses: {}, status: "idle", progress: 0 };
    const r = resolve(cat, b.type);
    if (!r) return flow;
    // Each consumer runs at the share of power it received on the last step, so rates match what machines make.
    const sat = b.powerSat ?? world.power.satisfaction;
    if (r.kind === "miner") {
        const dep = depositUnder(world, b, r.footprint)?.dep;
        const node = dep ? cat.tree.nodes.find((n) => n.item === dep.item) : undefined;
        if (!dep || !node) return { ...flow, status: "starved" };
        // Nothing beside the drill takes ore, so none is made: the rate under the item must match what really arrives.
        if (!hasOutputNeighbour(world, b, cat) && (b.output[dep.item] ?? 0) >= r.outputCap) return { ...flow, status: "blocked" };
        if (sat <= 0 || (b.output[dep.item] ?? 0) >= r.outputCap) return { ...flow, status: "blocked" };
        flow.makes[dep.item] = (node.baseRatePerMin / 60) * dep.purity * r.speed * sat * world.progress.bonus.miner;
        flow.status = "running";
        return flow;
    }
    if (r.kind === "crafter") {
        const rec = b.recipe ? cat.tree.recipes.find((x) => x.id === b.recipe) : undefined;
        if (!rec) return flow;
        flow.progress = Math.min(1, b.progress / rec.craftSeconds);
        const fed = b.crafting || rec.inputs.every((s) => (b.input[s.item] ?? 0) >= s.qty);
        const room = (b.output[rec.output.item] ?? 0) + rec.output.qty <= r.outputCap;
        if (!room) return { ...flow, status: "blocked" };
        if (!fed) return { ...flow, status: "starved" };
        if (sat <= 0) return { ...flow, status: "blocked" };
        const perCraft = (r.speed * sat * (world.progress.bonus.craft ?? 1)) / rec.craftSeconds;
        flow.makes[rec.output.item] = rec.output.qty * perCraft;
        for (const s of rec.inputs) flow.uses[s.item] = s.qty * perCraft;
        flow.status = "running";
        return flow;
    }
    return flow;
}

function bufferCap(cat: Catalog, rec: { inputs: { item: string; qty: number }[] }, item: string): number {
    const inp = rec.inputs.find((s) => s.item === item);
    return inp ? inp.qty * cat.tune.inputBufferMult : cat.tune.defaultOutputCap;
}

// A stage-N machine opens once a milestone of stage N-1 or later is delivered. Stage 1 finishes the first milestone,
// and each later stage opens on the one before it, so the chain never waits on itself.
function r0(cat: Catalog, type: string) {
    return cat.tree.machines.find((m) => m.id === type);
}

// Drills mine the node under them. Rate is per minute at the node's purity, with the drill's speed and the site bonus.
function minesOf(cat: Catalog, type: string, x: number, z: number, world: World): MachineDetail["mines"] {
    const r = resolve(cat, type);
    if (!r || r.kind !== "miner") return undefined;
    const dep = depositUnder(world, { x, z, rot: 0 }, r.footprint)?.dep;
    const node = dep ? cat.tree.nodes.find((n) => n.item === dep.item) : undefined;
    if (!dep || !node) return [];
    return [{ resourceId: dep.item, name: nameOf(cat, dep.item), purity: dep.purity >= 2 ? "pure" : dep.purity < 1 ? "impure" : "normal", perMin: node.baseRatePerMin * dep.purity * r.speed * world.progress.bonus.miner }];
}

// A drill with a node shows "Mines iron ore" in the recipe line, rate per minute as the craft time.
function minedRecipe(world: World, cat: Catalog, type: string, x: number, z: number): MachineDetail["recipe"] | undefined {
    const mines = minesOf(cat, type, x, z, world);
    if (!mines || mines.length === 0) return undefined;
    const m = mines[0];
    return { name: `Mines ${m.name}`, inputs: [], outputs: [{ resourceId: m.resourceId, amount: 1 }], seconds: 60 / m.perMin };
}

// Every unlocked recipe a crafter of this type can run, with its inputs, outputs and time.
function recipeChoicesOf(world: World, cat: Catalog, type: string): MachineDetail["recipeChoices"] {
    return unlockedRecipes(world, cat)
        .map((id) => cat.tree.recipes.find((x) => x.id === id)!)
        .filter((r) => r.machine === type)
        .map((r) => ({ id: r.id, name: nameOf(cat, r.output.item), alternate: !!r.alternate, inputs: lines(r.inputs), outputs: lines([r.output]), seconds: r.craftSeconds }));
}

// Why a recipe is shut, in one line for the picker. Hub requests come first (they open recipes directly), then research.
function lockReasonOf(world: World, cat: Catalog, recipeId: string): string | undefined {
    const req = (cat.tree.requests ?? []).find((q) => !requestDone(world, q.id) && q.unlocks.recipes.includes(recipeId));
    if (req) return `Hub request: ${req.name}`;
    const node = cat.tree.research.find((n) => n.recipes.includes(recipeId) && !world.progress.researched.includes(n.id));
    if (!node) return "Not yet available";
    const missing = node.requires.map((id) => cat.tree.research.find((n) => n.id === id)).find((n) => n && !world.progress.researched.includes(n.id));
    if (missing) return `Needs ${missing.name} first`;
    return `Research: ${node.name}, ${node.cost} blueprints`;
}

// Every recipe a crafter of this type can run, open ones first, with its rate at this building's speed and the research bonus.
function recipeLibraryOf(world: World, cat: Catalog, b: Building): RecipeEntry[] {
    const r = resolve(cat, b.type);
    const speed = r?.speed ?? 1;
    const craftBonus = world.progress.bonus.craft ?? 1;
    const open = new Set(unlockedRecipes(world, cat));
    return cat.tree.recipes
        .filter((x) => x.machine === b.type)
        .map((x) => {
            const isOpen = open.has(x.id);
            const state: RecipeEntry["state"] = b.recipe === x.id ? "selected" : isOpen ? "open" : "locked";
            return {
                id: x.id,
                name: nameOf(cat, x.output.item),
                alternate: !!x.alternate,
                inputs: lines(x.inputs),
                outputs: lines([x.output]),
                seconds: x.craftSeconds,
                perMin: (x.output.qty * 60 * speed * craftBonus) / x.craftSeconds,
                state,
                lockReason: isOpen ? undefined : lockReasonOf(world, cat, x.id),
            };
        })
        .sort((a, b2) => (a.state === "locked" ? 1 : 0) - (b2.state === "locked" ? 1 : 0) || Number(a.alternate) - Number(b2.alternate));
}

// A plain reason for a blocked or idle machine. Null when it is running.
function reasonOf(world: World, cat: Catalog, b: Building, status: MachineStatus, rec: { id: string } | undefined): string | undefined {
    if (status === "running") return undefined;
    const r = resolve(cat, b.type);
    if (!r) return undefined;
    if (r.kind === "generator") {
        if (BATTERIES.includes(r.id)) return "Storing or releasing wind power";
        const produced = r.supply * (r.id === SPRING ? 1 : Math.min(1, 2 * world.wind));
        return produced > 0 ? undefined : "Calm air: no wind to turn it";
    }
    if (r.kind === "miner") {
        if (!depositUnder(world, b, r.footprint)) return "No resource node under it";
        if (world.power.satisfaction <= 0) return "No power. Put a windmill within its range";
        if (!hasOutputNeighbour(world, b, cat)) return "Nothing beside it takes ore. Run a belt from a side of the drill to the hub";
        return "Output backed up. Check the belt reaches the hub, or a machine that takes this ore";
    }
    if (r.kind === "crafter") {
        if (!b.recipe || !rec) return "No recipe chosen";
        if (world.power.satisfaction < 1) return "No power";
        if (status === "starved") return "Waiting for inputs";
        return "Output full, take items off it";
    }
    if (world.power.satisfaction < 1 && (r0(cat, b.type)?.powerKw ?? 0) > 0) return "No power";
    return status === "blocked" ? "Blocked" : "Idle";
}

// Detail for a machine type that is not placed yet, so the palette's Details can show it before the first build.
export function previewMachine(world: World, cat: Catalog, type: string): MachineDetail | null {
    const palette = machinesFor(world, cat);
    const m = palette.find((x) => x.id === type);
    if (!m) return null;
    const def = r0(cat, type);
    return {
        ...m,
        status: "idle",
        recipe: { name: "No recipe chosen", inputs: [], outputs: [], seconds: 0 },
        rates: [],
        buffers: [],
        powerKw: def?.powerKw,
        reason: m.unlocked ? undefined : m.lockedReason,
        recipeChoices: def && def.id !== "drill" && cat.tree.recipes.some((x) => x.machine === type) ? recipeChoicesOf(world, cat, type) : undefined,
        mines: def?.id === "drill" ? cat.tree.nodes.map((n) => ({ resourceId: n.item, name: nameOf(cat, n.item), purity: "normal", perMin: n.baseRatePerMin * world.progress.bonus.miner })) : undefined,
    };
}

function lockReason(cat: Catalog, id: string, stage: number | undefined): string {
    const req = requestFor(cat, id);
    return req ? `Hub request: ${req.name}` : `Unlocks at stage ${stage}`;
}

function machinesFor(world: World, cat: Catalog): MachineView[] {
    return hudData(world, cat).machines;
}

// A hub request that names this machine or piece controls it, in place of the stage rule.
function requestFor(cat: Catalog, id: string | undefined) {
    return id === undefined ? undefined : (cat.tree.requests ?? []).find((q) => q.unlocks.machines.includes(id));
}

export function unlockedMachine(world: World, cat: Catalog, unlockStage: number, id?: string): boolean {
    const req = requestFor(cat, id);
    if (req) return requestDone(world, req.id);
    if (unlockStage === 0) return true;
    return cat.tree.milestones.some((m) => m.stage >= unlockStage - 1 && world.progress.milestonesDone.includes(m.id));
}

// selectedId is a building id (the id the HUD got from a placed building), not a machine type id.
export function hudData(world: World, cat: Catalog = DEFAULT_CATALOG, selectedId: number | null = null, settings: HudSettings = DEFAULT_SETTINGS): HudData {
    const clock = dayClock(world, cat);
    const hub = world.buildings[world.hubId];

    // Net flow per item, machine counts, and the status to show for each machine type.
    const net: Record<string, number> = {};
    const count: Record<string, number> = {};
    const statusOf: Record<string, MachineStatus> = {};
    const flows = new Map<number, Flow>();
    for (const id of Object.keys(world.buildings).map(Number)) {
        const b = world.buildings[id];
        const r = resolve(cat, b.type);
        if (!r || r.kind === "hub") continue;
        // Belts and generators are palette entries too: count them, but they have no item flow of their own here.
        if (r.kind === "belt" || r.kind === "generator") {
            count[b.type] = (count[b.type] ?? 0) + 1;
            continue;
        }
        const f = flowOf(world, cat, b);
        flows.set(id, f);
        for (const k of Object.keys(f.makes)) net[k] = (net[k] ?? 0) + f.makes[k];
        for (const k of Object.keys(f.uses)) net[k] = (net[k] ?? 0) - f.uses[k];
        count[b.type] = (count[b.type] ?? 0) + 1;
        if (f.status === "running" || !statusOf[b.type]) statusOf[b.type] = f.status;
    }

    // Essentials always sit on the bar (at zero until the first one arrives), so a new player sees what the early chain
    // makes; anything else joins once it is in stock or flowing. Raw first, then by stage, then name.
    const essentials = ESSENTIAL_RESOURCES.filter((id) => cat.tree.items.some((i) => i.id === id));
    const stageOf = (id: string) => cat.tree.items.find((i) => i.id === id)?.stage ?? 0;
    const resourceIds = [...new Set<string>([...essentials, ...Object.keys(hub.input), ...Object.keys(net)])]
        .sort((a, b) => stageOf(a) - stageOf(b) || a.localeCompare(b));
    const resources: ResourceView[] = resourceIds.map((item) => {
        const name = nameOf(cat, item);
        const stage = cat.tree.items.find((i) => i.id === item)?.stage ?? 0;
        return { id: item, name, group: stage === 0 ? "raw" : "part", glyph: glyphOf(name), amount: Math.floor(hub.input[item] ?? 0), perSecond: net[item] ?? 0 };
    });

    // Palette: crafting machines, then power generators from the tree, then logistics (belts and the
    // engine-only pieces). The hub is never listed.
    const machines: MachineView[] = cat.tree.machines.map((m) => {
        const unlocked = unlockedMachine(world, cat, m.unlockStage, m.id);
        return {
            id: m.id,
            name: m.name,
            glyph: glyphOf(m.name),
            unlocked,
            lockedReason: unlocked ? undefined : lockReason(cat, m.id, m.unlockStage),
            count: count[m.id] ?? 0,
            cost: lines(m.buildCost ?? []),
            status: statusOf[m.id] ?? "idle",
            group: m.generatesKw ? "power" : "machines",
        };
    });
    for (const [id, e] of Object.entries(cat.engine)) {
        if (e.kind === "hub" || e.placeable === false) continue;
        const st = cat.tree.structures?.find((x) => x.id === id);
        const unlocked = (st?.unlockStage === undefined && !requestFor(cat, id)) || unlockedMachine(world, cat, st?.unlockStage ?? 0, id);
        const name = st?.name ?? e.name;
        machines.push({
            id,
            name,
            glyph: glyphOf(name),
            unlocked,
            lockedReason: unlocked ? undefined : lockReason(cat, id, st?.unlockStage),
            count: count[id] ?? 0,
            cost: lines(st?.buildCost ?? e.cost),
            status: statusOf[id] ?? "idle",
            group: "logistics",
        });
    }

    let selected: MachineDetail | null = null;
    if (selectedId !== null && world.buildings[selectedId]) {
        const b = world.buildings[selectedId];
        const m = machines.find((x) => x.id === b.type);
        const rec = b.recipe ? cat.tree.recipes.find((x) => x.id === b.recipe) : undefined;
        const f = flows.get(selectedId) ?? flowOf(world, cat, b);
        if (m) {
            const bufferIds = new Set<string>([...Object.keys(b.input), ...Object.keys(b.output)]);
            const gen = generatorDetail(world, cat, b);
            selected = {
                ...m,
                // A generator running in wind is working, whatever the flow pass says about it.
                status: gen && (gen.producedKw ?? 0) > 0 ? "running" : f.status,
                recipe: rec
                    ? { name: rec.id, inputs: lines(rec.inputs), outputs: lines([rec.output]), seconds: rec.craftSeconds }
                    : minedRecipe(world, cat, b.type, b.x, b.z) ?? { name: "No recipe chosen", inputs: [], outputs: [], seconds: 0 },
                recipeId: b.recipe,
                recipeOptions: unlockedRecipes(world, cat)
                    .map((id) => cat.tree.recipes.find((x) => x.id === id)!)
                    .filter((r) => r.machine === b.type)
                    .map((r) => ({ id: r.id, name: nameOf(cat, r.output.item), alternate: !!r.alternate })),
                rates: [
                    ...Object.keys(f.makes).map((k) => ({ label: `${nameOf(cat, k)} out`, value: `${f.makes[k].toFixed(2)} /s` })),
                    ...Object.keys(f.uses).map((k) => ({ label: `${nameOf(cat, k)} in`, value: `${f.uses[k].toFixed(2)} /s` })),
                ],
                powerKw: r0(cat, b.type)?.powerKw,
                ...(generatorDetail(world, cat, b) ?? {}),
                ...(consumerDetail(world, cat, b) ?? {}),
                reason: reasonOf(world, cat, b, f.status, rec),
                mines: minesOf(cat, b.type, b.x, b.z, world),
                recipeChoices: rec ? undefined : recipeChoicesOf(world, cat, b.type),
                recipeLibrary: resolve(cat, b.type)?.kind === "crafter" ? recipeLibraryOf(world, cat, b) : undefined,
                buffers: [...bufferIds].map((k) => ({
                    resourceId: k,
                    have: Math.floor((b.input[k] ?? 0) + (b.output[k] ?? 0)),
                    max: rec ? bufferCap(cat, rec, k) : cat.tune.defaultOutputCap,
                })),
            };
        }
    }

    // Areas are the island sites: the current one, and the others once the first workshop is open (locked before that).
    const areas: AreaView[] = SITES.map((s) => ({
        id: s.id,
        name: s.name,
        note: `${s.nodes.length} nodes, ${s.width} by ${s.depth} floor`,
        state: world.progress.site === s.id ? "current" : world.progress.prestiges === 0 ? "locked" : "open",
    }));

    const milestones: MilestoneView[] = cat.tree.milestones.map((m) => {
        const done = world.progress.milestonesDone.includes(m.id);
        const progress = done ? 1 : Math.min(1, ...m.deliver.map((s) => (world.progress.delivered[s.item] ?? 0) / s.qty));
        return {
            id: m.id,
            name: m.name,
            goal: m.deliver.map((s) => `Deliver ${s.qty} ${nameOf(cat, s.item)}`).join(", "),
            progress: Math.max(0, progress),
            blueprintReward: m.blueprints,
            rewardLine: rewardLineOf(cat, m.blueprints, m.reward),
            done,
            items: m.deliver.map((s) => ({
                id: s.item,
                name: nameOf(cat, s.item),
                have: Math.min(s.qty, world.progress.delivered[s.item] ?? 0),
                need: s.qty,
            })),
        };
    });
    // Prestige waits on the first run's milestones only; commissions come after and repeat.
    const firstRunDone = milestones.length > 0 && milestones.every((m) => m.done);
    const commission = currentCommission(world, cat);
    if (commission) {
        const base = world.progress.commissionBase ?? {};
        const items = commission.deliver.map((s) => ({ id: s.item, name: nameOf(cat, s.item), have: Math.min(s.qty - (base[s.item] ?? 0), Math.max(0, (world.progress.delivered[s.item] ?? 0) - (base[s.item] ?? 0))), need: s.qty - (base[s.item] ?? 0) }));
        milestones.push({
            id: "commission",
            name: `Commission ${commission.n + 1}: ${commission.name}`,
            goal: items.map((i) => `Deliver ${i.need} ${i.name}`).join(", "),
            progress: Math.min(1, ...items.map((i) => i.have / i.need)),
            blueprintReward: commission.blueprints,
            rewardLine: rewardLineOf(cat, commission.blueprints, commission.reward),
            commission: true,
            done: false,
            items,
        });
    }

    // Board layout: a node sits one column right of its deepest prerequisite; rows are slots in tree order.
    const depth = new Map<string, number>();
    const depthOf = (id: string, seen = new Set<string>()): number => {
        if (depth.has(id)) return depth.get(id)!;
        if (seen.has(id)) return 0; // a cycle in the tree would be a data bug; do not loop on it
        seen.add(id);
        const node = cat.tree.research.find((x) => x.id === id);
        const d = node && node.requires.length ? 1 + Math.max(...node.requires.map((q) => depthOf(q, seen))) : 0;
        depth.set(id, d);
        return d;
    };
    const slotInColumn = new Map<number, number>();
    const research: ResearchNode[] = cat.tree.research.map((n) => {
        const done = world.progress.researched.includes(n.id);
        const ready = n.requires.every((q) => world.progress.researched.includes(q));
        const column = depthOf(n.id);
        const row = slotInColumn.get(column) ?? 0;
        slotInColumn.set(column, row + 1);
        const unlocks = n.recipes.map((rid) => {
            const rec = cat.tree.recipes.find((x) => x.id === rid);
            return rec ? nameOf(cat, rec.output.item) : rid;
        });
        return { id: n.id, name: n.name, glyph: glyphOf(n.name), note: n.note ?? "", blueprintCost: n.cost, requires: n.requires, unlocks, column, row, state: done ? "done" : ready ? "available" : "locked" };
    });

    const hubSteps = hubStepsOf(world, cat);
    const allDone = firstRunDone;
    const stats: StatLine[] = [
        { label: "Day", value: String(clock.day + 1) },
        { label: "Time", value: clock.isNight ? "Night" : "Day" },
        { label: "Wind", value: `${Math.round(world.wind * 100)}%` },
        { label: "Power", value: `${Math.round(world.power.supply)} / ${Math.round(world.power.demand)} kW` },
        { label: "Workshops", value: String(world.progress.prestiges + 1) },
    ];

    return {
        resources,
        machines,
        selected,
        areas,
        milestones,
        hub: { stage: hubStageFor(world.progress.milestonesDone.length), steps: hubSteps, doneCount: hubSteps.filter((x) => x.state === "done").length, blueprints: world.progress.blueprints },
        blueprints: world.progress.blueprints,
        research,
        prestige: {
            ready: allDone,
            requirement: allDone ? "Ready: choose one of three sites" : "Finish every milestone delivery",
            gain: `Keeps ${cat.tree.prestige.keeps.join(", ")}. Resets ${cat.tree.prestige.resets.join(" and ")}.`,
            keeps: [...cat.tree.prestige.keeps],
            leaves: [...cat.tree.prestige.resets],
            sites: SITES.map((s) => ({
                id: s.id,
                name: s.name,
                blurb: s.blurb,
                modifiers: [`Miners ${pct(s.bonus.miner)}`, `Power ${pct(s.bonus.power)}`],
                plan: { width: s.width, depth: s.depth, hub: s.hub, nodes: s.nodes, miner: s.bonus.miner, power: s.bonus.power },
            })),
        },
        stats,
        nextStep: nextStepOf(world, cat, machines, milestones),
        settings,
    };
}

// What each milestone opens: the machines and pieces whose stage rule first becomes true with it, plus its blueprints.
// Pieces a hub request controls are left out (the request lists them), and tier variants fold into one line per tier.
function milestoneUnlocks(cat: Catalog, index: number): HubUnlock[] {
    const ms = cat.tree.milestones;
    const first = (stage: number) => ms.findIndex((m) => m.stage >= stage - 1);
    const out: HubUnlock[] = [];
    const seenTier = new Set<string>();
    for (const m of cat.tree.machines) {
        if (m.unlockStage > 0 && !requestFor(cat, m.id) && first(m.unlockStage) === index) out.push({ kind: "machine", id: m.id, name: m.name, icon: m.id });
    }
    for (const st of cat.tree.structures ?? []) {
        if (st.unlockStage === undefined || st.unlockStage === 0 || requestFor(cat, st.id) || first(st.unlockStage) !== index) continue;
        if (st.tier && st.tier !== "brass") {
            if (seenTier.has(st.tier)) continue;
            seenTier.add(st.tier);
            out.push({ kind: "machine", id: st.id, name: `${st.tier[0].toUpperCase()}${st.tier.slice(1)} logistics`, icon: st.id });
            continue;
        }
        out.push({ kind: "machine", id: st.id, name: st.name, icon: st.id });
    }
    return out;
}

// The hub ladder: early requests first (they open recipes and machines directly), then the blueprint milestones.
function hubStepsOf(world: World, cat: Catalog): HubStep[] {
    const delivered = world.progress.delivered;
    const itemsOf = (deliver: { item: string; qty: number }[]) =>
        deliver.map((s) => ({ id: s.item, name: nameOf(cat, s.item), have: Math.min(s.qty, Math.floor(delivered[s.item] ?? 0)), need: s.qty }));
    const frac = (items: { have: number; need: number }[]) => (items.length ? Math.min(...items.map((i) => i.have / i.need)) : 1);
    const steps: HubStep[] = [];
    for (const q of cat.tree.requests ?? []) {
        const items = itemsOf(q.deliver);
        const done = requestDone(world, q.id);
        const unlocks: HubUnlock[] = [
            ...q.unlocks.recipes.map((rid): HubUnlock => {
                const out = cat.tree.recipes.find((r) => r.id === rid)?.output.item ?? rid;
                return { kind: "recipe", id: rid, name: nameOf(cat, out), icon: out };
            }),
            ...q.unlocks.machines.map((mid): HubUnlock => ({ kind: "machine", id: mid, name: cat.tree.machines.find((m) => m.id === mid)?.name ?? cat.tree.structures?.find((x) => x.id === mid)?.name ?? mid, icon: mid })),
        ];
        steps.push({ id: q.id, kind: "request", name: q.name, note: q.note, state: done ? "done" : "ahead", progress: done ? 1 : frac(items), items, unlocks: [...unlocks, ...crateTiles(cat, q.reward)] });
    }
    cat.tree.milestones.forEach((m, i) => {
        const items = itemsOf(m.deliver);
        const done = world.progress.milestonesDone.includes(m.id);
        steps.push({
            id: m.id,
            kind: "milestone",
            name: m.name,
            state: done ? "done" : "ahead",
            progress: done ? 1 : frac(items),
            items,
            unlocks: [{ kind: "blueprints", id: "blueprints", name: `${m.blueprints} blueprints`, qty: m.blueprints }, ...milestoneUnlocks(cat, i), ...crateTiles(cat, m.reward)],
        });
    });
    const commission = currentCommission(world, cat);
    if (commission) {
        const base = world.progress.commissionBase ?? {};
        const items = commission.deliver.map((s) => {
            const need = s.qty - (base[s.item] ?? 0);
            return { id: s.item, name: nameOf(cat, s.item), have: Math.min(need, Math.max(0, Math.floor((delivered[s.item] ?? 0) - (base[s.item] ?? 0)))), need };
        });
        steps.push({
            id: "commission",
            kind: "milestone",
            name: `Commission ${commission.n + 1}: ${commission.name}`,
            state: "ahead",
            progress: frac(items),
            items,
            unlocks: [{ kind: "blueprints", id: "blueprints", name: `${commission.blueprints} blueprints`, qty: commission.blueprints }, ...crateTiles(cat, commission.reward)],
        });
    }
    const now = steps.find((x) => x.state !== "done");
    if (now) now.state = "now";
    return steps;
}

function nextStepOf(world: World, cat: Catalog, machines: MachineView[], milestones: MilestoneView[]): NextStepView {
    const drills = machines.find((m) => m.id === "drill")?.count ?? 0;
    const crafters = machines.filter((m) => m.id !== "drill").reduce((a, m) => a + m.count, 0);
    const next = milestones.find((m) => !m.done);
    const req = hubStepsOf(world, cat).find((x) => x.kind === "request" && x.state === "now");
    if (drills === 0) return { text: "Place a drill on a resource node to start the flow.", actionLabel: "Select drill", actionId: "drill" };
    if (crafters === 0) return { text: "Add a kiln and set its recipe to smelt ore into ingots.", actionLabel: "Select kiln", actionId: "kiln" };
    if (world.power.satisfaction < 1) return { text: "Machines are short of power. A windmill feeds machines within 8 cells of its centre.", actionLabel: "Select windmill", actionId: "windmill" };
    // The first order needs ingots on the hub, which takes a recipe on the kiln and belts. Say so before the order does,
    // so a newcomer is never left with a banner asking for ingots from a kiln that has nothing to smelt.
    const untouched = !(world.progress.requestsDone ?? []).length && !(world.progress.delivered.iron_ingot ?? 0);
    if (untouched) {
        const idle = Object.values(world.buildings).find((b) => b.type === "kiln" && !b.recipe);
        if (idle) return { text: "Select the kiln and pick Iron ingot as its recipe, so it smelts the drill's ore.", actionLabel: "Select kiln", actionId: "inspect", selectId: idle.id };
        const belts = Object.values(world.buildings).filter((b) => b.type.startsWith("belt")).length;
        if (belts < 2) return { text: "Belt the drill to the kiln, then the kiln to the hub. Drag with the belt tool and it routes around machines.", actionLabel: "Select belt", actionId: "belt" };
    }
    if (req) {
        const parts = req.items.map((i) => `${i.name} ${i.have} of ${i.need}`);
        const opens = req.unlocks.map((u) => u.name).join(", ");
        return { title: req.name, progress: req.progress, text: `Deliver ${parts.join(", ")}. Opens ${opens}.`, actionLabel: "Open hub", actionId: "hub-menu" };
    }
    if (next) {
        // Progress per item, capped at the target, so the bar says how far the delivery has got.
        const def = cat.tree.milestones.find((m) => m.id === next.id);
        const parts = (def?.deliver ?? []).map((s) => {
            const have = Math.min(s.qty, world.progress.delivered[s.item] ?? 0);
            return `${nameOf(cat, s.item)} ${have} of ${s.qty}`;
        });
        const detail = parts.length ? ` (${parts.join(", ")})` : "";
        return { title: next.name, progress: next.progress, text: `${next.goal}${detail}. Reward: ${next.rewardLine ?? `${next.blueprintReward} blueprints`}.` };
    }
    return { text: "Keep the factory running and plan the next milestone." };
}

// Actions for the HUD. The HUD passes the building id of what it selected (hudData's selectedId), never a type id. Each one is a thin wrapper, so the HUD never edits the world directly.
export const actions = {
    place(world: World, type: string, x: number, z: number, rot: Rot, cat: Catalog = DEFAULT_CATALOG): PlaceResult {
        return placeRaw(world, type, x, z, rot, cat);
    },
    setRecipe(world: World, id: number, recipe: string | null, cat: Catalog = DEFAULT_CATALOG): ActionResult {
        return setRecipeRaw(world, id, recipe, cat);
    },
    setFilter(world: World, id: number, item: string | null, cat: Catalog = DEFAULT_CATALOG): ActionResult {
        return setFilterRaw(world, id, item, cat);
    },
    buyResearch(world: World, nodeId: string, cat: Catalog = DEFAULT_CATALOG): ActionResult {
        return buyResearchRaw(world, cat, nodeId);
    },
    prestige(world: World, siteId: string, cat: Catalog = DEFAULT_CATALOG): ActionResult {
        return prestigeRaw(world, cat, siteId);
    },
};
