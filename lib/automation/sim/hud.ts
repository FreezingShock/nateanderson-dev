// Read-only snapshots for the panels, plus the action wrappers the HUD calls.
// Rates are theoretical: what the machines make right now at full buffers, not measured over time.
import type { ActionResult, Building, Catalog, HudBuilding, HudData, HudMachineRow, HudMilestone, HudResearch, HudStockRow, MachineStatus, World, PlaceResult, Rot } from "../types";
import { DEFAULT_CATALOG } from "./data";
import { dayClock, buyResearch as buyResearchRaw, prestige as prestigeRaw } from "./progress";
import { place as placeRaw, setRecipe as setRecipeRaw, resolve } from "./world";

function nameOf(cat: Catalog, id: string): string {
    return cat.tree.items.find((i) => i.id === id)?.name ?? id;
}

function rateOf(world: World, cat: Catalog, b: Building): { perSecond: number; status: MachineStatus } {
    const r = resolve(cat, b.type);
    if (!r) return { perSecond: 0, status: "idle" };
    if (r.kind === "miner") {
        const dep = world.deposits[`${b.x},${b.z}`];
        const node = dep ? cat.tree.nodes.find((n) => n.item === dep.item) : undefined;
        if (!dep || !node) return { perSecond: 0, status: "missing-input" };
        const sat = world.power.satisfaction;
        const status: MachineStatus = sat <= 0 ? "unpowered" : (b.output[dep.item] ?? 0) >= r.outputCap ? "stalled-output" : "running";
        return { perSecond: (node.baseRatePerMin / 60) * dep.purity * r.speed * sat, status };
    }
    if (r.kind === "crafter") {
        const rec = b.recipe ? cat.tree.recipes.find((x) => x.id === b.recipe) : undefined;
        if (!rec) return { perSecond: 0, status: "no-recipe" };
        if (world.power.satisfaction <= 0) return { perSecond: 0, status: "unpowered" };
        const fed = rec.inputs.every((s) => (b.input[s.item] ?? 0) >= s.qty);
        const room = (b.output[rec.output.item] ?? 0) + rec.output.qty <= r.outputCap;
        const status: MachineStatus = b.crafting ? (room ? "running" : "stalled-output") : fed ? (room ? "running" : "stalled-output") : "missing-input";
        const perSecond = status === "running" ? (rec.output.qty / rec.craftSeconds) * r.speed * world.power.satisfaction : 0;
        return { perSecond, status };
    }
    return { perSecond: 0, status: "idle" };
}

export function hudData(world: World, cat: Catalog = DEFAULT_CATALOG, selectedId: number | null = null): HudData {
    const clock = dayClock(world, cat);
    const hub = world.buildings[world.hubId];

    // Per-item theoretical rate, summed over every running producer.
    const rate: Record<string, number> = {};
    const machines = new Map<string, HudMachineRow>();
    const ids = Object.keys(world.buildings).map(Number);
    for (const id of ids) {
        const b = world.buildings[id];
        const r = resolve(cat, b.type);
        if (!r || r.kind === "hub" || r.kind === "belt" || r.kind === "generator") continue;
        const { perSecond, status } = rateOf(world, cat, b);
        if (r.kind === "miner") {
            const dep = world.deposits[`${b.x},${b.z}`];
            if (dep) rate[dep.item] = (rate[dep.item] ?? 0) + perSecond;
        } else if (b.recipe) {
            const rec = cat.tree.recipes.find((x) => x.id === b.recipe);
            if (rec) rate[rec.output.item] = (rate[rec.output.item] ?? 0) + perSecond;
        }
        const row = machines.get(b.type) ?? { id: b.id, type: b.type, name: r.name, count: 0, status };
        row.count += 1;
        if (status === "running") row.status = "running";
        machines.set(b.type, row);
    }

    const stockItems = new Set<string>([...Object.keys(hub.input), ...Object.keys(rate)]);
    const stock: HudStockRow[] = [...stockItems]
        .sort()
        .map((item) => ({ item, name: nameOf(cat, item), qty: Math.floor(hub.input[item] ?? 0), perSecond: rate[item] ?? 0 }));

    let selected: HudBuilding | null = null;
    if (selectedId !== null && world.buildings[selectedId]) {
        const b = world.buildings[selectedId];
        const r = resolve(cat, b.type);
        if (r) {
            const { perSecond, status } = rateOf(world, cat, b);
            const rec = b.recipe ? cat.tree.recipes.find((x) => x.id === b.recipe) : undefined;
            selected = {
                id: b.id,
                type: b.type,
                name: r.name,
                recipe: b.recipe,
                status,
                progress: rec ? Math.min(1, b.progress / rec.craftSeconds) : 0,
                perSecond,
                input: { ...b.input },
                output: { ...b.output },
            };
        }
    }

    const milestones: HudMilestone[] = cat.tree.milestones.map((m) => {
        const done = world.progress.milestonesDone.includes(m.id);
        const progress = done ? 1 : Math.min(...m.deliver.map((s) => Math.min(1, (world.progress.delivered[s.item] ?? 0) / s.qty)), 1);
        return { id: m.id, name: m.name, blueprints: m.blueprints, done, progress: Math.max(0, progress) };
    });

    const research: HudResearch[] = cat.tree.research.map((n) => {
        const bought = world.progress.researched.includes(n.id);
        const ready = n.requires.every((q) => world.progress.researched.includes(q));
        return { id: n.id, name: n.name, cost: n.cost, state: bought ? "bought" : ready ? "available" : "locked" };
    });

    const hasDrill = ids.some((id) => resolve(cat, world.buildings[id].type)?.kind === "miner");
    const hasCrafter = ids.some((id) => resolve(cat, world.buildings[id].type)?.kind === "crafter");
    const nextMilestone = milestones.find((m) => !m.done);
    let nextStep: string;
    if (!hasDrill) nextStep = "Place a drill on a resource node to start the flow.";
    else if (!hasCrafter) nextStep = "Add a smelter and set its recipe so ore becomes plates.";
    else if (world.power.satisfaction < 1) nextStep = "Add power: machines are short of power.";
    else if (nextMilestone) nextStep = `Deliver for "${nextMilestone.name}" to earn ${nextMilestone.blueprints} blueprints.`;
    else nextStep = "Keep the factory running and plan the next milestone.";

    return {
        time: world.time,
        day: clock.day,
        isNight: clock.isNight,
        wind: world.wind,
        power: { ...world.power },
        blueprints: world.progress.blueprints,
        stock,
        machines: [...machines.values()],
        selected,
        milestones,
        research,
        prestige: { name: cat.tree.prestige.name, count: world.progress.prestiges, keeps: cat.tree.prestige.keeps, resets: cat.tree.prestige.resets },
        nextStep,
    };
}

// Actions for the HUD. Each one is a thin wrapper, so the HUD never edits the world directly.
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
    prestige(world: World, cat: Catalog = DEFAULT_CATALOG): ActionResult {
        return prestigeRaw(world, cat);
    },
};
