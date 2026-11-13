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
import { dayClock, buyResearch as buyResearchRaw, prestige as prestigeRaw } from "./progress";
import { place as placeRaw, setRecipe as setRecipeRaw, resolve } from "./world";

export const DEFAULT_SETTINGS: HudSettings = { sound: false, reduceMotion: false, lowFx: false, numberFormat: "short", showRates: true };

const glyphOf = (name: string): string => name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";

function nameOf(cat: Catalog, id: string): string {
    return cat.tree.items.find((i) => i.id === id)?.name ?? id;
}

function lines(stacks: { item: string; qty: number }[]): Line[] {
    return stacks.map((s) => ({ resourceId: s.item, amount: s.qty }));
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
    const sat = world.power.satisfaction;
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

function unlockedMachine(world: World, cat: Catalog, unlockStage: number): boolean {
    if (unlockStage === 0) return true;
    return cat.tree.milestones.some((m) => m.stage >= unlockStage && world.progress.milestonesDone.includes(m.id));
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
        if (!r || r.kind === "hub" || r.kind === "belt" || r.kind === "generator") continue;
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
        };
    });

    let selected: MachineDetail | null = null;
    if (selectedId !== null && world.buildings[selectedId]) {
        const b = world.buildings[selectedId];
        const m = machines.find((x) => x.id === b.type);
        const rec = b.recipe ? cat.tree.recipes.find((x) => x.id === b.recipe) : undefined;
        const f = flows.get(selectedId) ?? flowOf(world, cat, b);
        if (m) {
            const bufferIds = new Set<string>([...Object.keys(b.input), ...Object.keys(b.output)]);
            selected = {
                ...m,
                status: f.status,
                recipe: rec
                    ? { name: rec.id, inputs: lines(rec.inputs), outputs: lines([rec.output]), seconds: rec.craftSeconds }
                    : { name: "No recipe", inputs: [], outputs: [], seconds: 0 },
                rates: [
                    ...Object.keys(f.makes).map((k) => ({ label: `${nameOf(cat, k)} out`, value: `${f.makes[k].toFixed(2)} /s` })),
                    ...Object.keys(f.uses).map((k) => ({ label: `${nameOf(cat, k)} in`, value: `${f.uses[k].toFixed(2)} /s` })),
                ],
                buffers: [...bufferIds].map((k) => ({
                    resourceId: k,
                    have: Math.floor((b.input[k] ?? 0) + (b.output[k] ?? 0)),
                    max: rec ? bufferCap(cat, rec, k) : cat.tune.defaultOutputCap,
                })),
            };
        }
    }

    // Areas are the island sites: the current one, and the others once the first workshop is open.
    const areas: AreaView[] = SITES.map((s) => ({
        id: s.id,
        name: s.name,
        note: `${s.nodes.length} nodes, ${s.width} by ${s.depth} floor`,
        state: world.progress.site === s.id ? "current" : world.progress.prestiges === 0 ? "open" : "locked",
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
            sites: SITES.map((s) => s.name),
        },
        stats,
        nextStep: nextStepOf(world, machines, milestones),
        settings,
    };
}

function nextStepOf(world: World, machines: MachineView[], milestones: MilestoneView[]): NextStepView {
    const drills = machines.find((m) => m.id === "drill")?.count ?? 0;
    const crafters = machines.filter((m) => m.id !== "drill").reduce((a, m) => a + m.count, 0);
    const next = milestones.find((m) => !m.done);
    if (drills === 0) return { text: "Place a drill on a resource node to start the flow.", actionLabel: "Select drill", actionId: "drill" };
    if (crafters === 0) return { text: "Add a smelter and set its recipe so ore becomes plates.", actionLabel: "Select smelter", actionId: "smelter" };
    if (world.power.satisfaction < 1) return { text: "Machines are short of power. Add a generator." };
    if (next) return { text: `Next delivery: ${next.goal} for ${next.blueprintReward} blueprints.` };
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
    buyResearch(world: World, nodeId: string, cat: Catalog = DEFAULT_CATALOG): ActionResult {
        return buyResearchRaw(world, cat, nodeId);
    },
    prestige(world: World, siteId: string, cat: Catalog = DEFAULT_CATALOG): ActionResult {
        return prestigeRaw(world, cat, siteId);
    },
};
