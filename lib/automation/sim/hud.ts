// Builds the panel data (HudData from lib/automation/types.ts) from the world, and wraps the actions the HUD calls.
// Rates are theoretical: what the machines make and use right now at full buffers and current power, not measured over time.
// The HUD never edits the world; it calls the actions below.
import type {
    ActionResult,
    AreaView,
    Building,
    Catalog,
    HudData,
    HudSettings,
    Line,
    MachineDetail,
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
import { unlockedRecipes, dayClock, buyResearch as buyResearchRaw, prestige as prestigeRaw } from "./progress";
import { place as placeRaw, setRecipe as setRecipeRaw, setFilter as setFilterRaw, resolve, BATTERIES } from "./world";

export const DEFAULT_SETTINGS: HudSettings = { sound: false, reduceMotion: false, lowFx: false, numberFormat: "short", showRates: true };

// Bonus as a signed percent line, e.g. 1.15 becomes "+15%".
const pct = (x: number): string => {
    const v = Math.round((x - 1) * 100);
    return `${v >= 0 ? "+" : ""}${v}%`;
};

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
    const isWind = !battery && def.generatesKw !== undefined;
    const wind = world.wind;
    const producedKw = battery ? 0 : r.supply * Math.min(1, 2 * wind);
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
        const dep = world.deposits[`${b.x},${b.z}`];
        const node = dep ? cat.tree.nodes.find((n) => n.item === dep.item) : undefined;
        if (!dep || !node) return { ...flow, status: "starved" };
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
        const perCraft = (r.speed * sat) / rec.craftSeconds;
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
    const dep = world.deposits[`${x},${z}`];
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

// A plain reason for a blocked or idle machine. Null when it is running.
function reasonOf(world: World, cat: Catalog, b: Building, status: MachineStatus, rec: { id: string } | undefined): string | undefined {
    if (status === "running") return undefined;
    const r = resolve(cat, b.type);
    if (!r) return undefined;
    if (r.kind === "generator") {
        if (BATTERIES.includes(r.id)) return "Storing or releasing wind power";
        const produced = r.supply * Math.min(1, 2 * world.wind);
        return produced > 0 ? undefined : "Calm air: no wind to turn it";
    }
    if (r.kind === "miner") {
        if (!world.deposits[`${b.x},${b.z}`]) return "No resource node under it";
        if (world.power.satisfaction < 1) return "No power";
        return "Output full, take items off it";
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

function machinesFor(world: World, cat: Catalog): MachineView[] {
    return hudData(world, cat).machines;
}

export function unlockedMachine(world: World, cat: Catalog, unlockStage: number): boolean {
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

    const resources: ResourceView[] = [...new Set<string>([...Object.keys(hub.input), ...Object.keys(net)])].sort().map((item) => {
        const name = nameOf(cat, item);
        const stage = cat.tree.items.find((i) => i.id === item)?.stage ?? 0;
        return { id: item, name, group: stage === 0 ? "raw" : "part", glyph: glyphOf(name), amount: Math.floor(hub.input[item] ?? 0), perSecond: net[item] ?? 0 };
    });

    // Palette: crafting machines, then power generators from the tree, then logistics (belts and the
    // engine-only pieces). The hub is never listed.
    const machines: MachineView[] = cat.tree.machines.map((m) => {
        const unlocked = unlockedMachine(world, cat, m.unlockStage);
        return {
            id: m.id,
            name: m.name,
            glyph: glyphOf(m.name),
            unlocked,
            lockedReason: unlocked ? undefined : `Unlocks at stage ${m.unlockStage}`,
            count: count[m.id] ?? 0,
            cost: lines(m.buildCost ?? []),
            status: statusOf[m.id] ?? "idle",
            group: m.generatesKw ? "power" : "machines",
        };
    });
    for (const [id, e] of Object.entries(cat.engine)) {
        if (e.kind === "hub" || e.placeable === false) continue;
        const st = cat.tree.structures?.find((x) => x.id === id);
        const unlocked = st?.unlockStage === undefined || unlockedMachine(world, cat, st.unlockStage);
        const name = st?.name ?? e.name;
        machines.push({
            id,
            name,
            glyph: glyphOf(name),
            unlocked,
            lockedReason: unlocked ? undefined : `Unlocks at stage ${st?.unlockStage}`,
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
            done,
            items: m.deliver.map((s) => ({
                id: s.item,
                name: nameOf(cat, s.item),
                have: Math.min(s.qty, world.progress.delivered[s.item] ?? 0),
                need: s.qty,
            })),
        };
    });

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

    const allDone = milestones.length > 0 && milestones.every((m) => m.done);
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

function nextStepOf(world: World, cat: Catalog, machines: MachineView[], milestones: MilestoneView[]): NextStepView {
    const drills = machines.find((m) => m.id === "drill")?.count ?? 0;
    const crafters = machines.filter((m) => m.id !== "drill").reduce((a, m) => a + m.count, 0);
    const next = milestones.find((m) => !m.done);
    if (drills === 0) return { text: "Place a drill on a resource node to start the flow.", actionLabel: "Select drill", actionId: "drill" };
    if (crafters === 0) return { text: "Add a kiln and set its recipe to smelt ore into ingots.", actionLabel: "Select kiln", actionId: "kiln" };
    if (world.power.satisfaction < 1) return { text: "Machines are short of power. Place a windmill within 6 cells of them.", actionLabel: "Select windmill", actionId: "windmill" };
    if (next) {
        // Progress per item, capped at the target, so the bar says how far the delivery has got.
        const def = cat.tree.milestones.find((m) => m.id === next.id);
        const parts = (def?.deliver ?? []).map((s) => {
            const have = Math.min(s.qty, world.progress.delivered[s.item] ?? 0);
            return `${nameOf(cat, s.item)} ${have} of ${s.qty}`;
        });
        const detail = parts.length ? ` (${parts.join(", ")})` : "";
        return { text: `Next delivery: ${next.goal}${detail} for ${next.blueprintReward} blueprints.` };
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
