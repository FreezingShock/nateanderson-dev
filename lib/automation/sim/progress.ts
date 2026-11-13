// Progression: milestone deliveries grant blueprints, research is bought with blueprints, and the one prestige resets the factory.
// Imports types only, so world.ts can call checkMilestones without a cycle.
import type { ActionResult, Catalog, World } from "../types";

function researchedIn(world: World, nodeId: string): boolean {
    return world.progress.researched.includes(nodeId);
}

// Recipes the player may use right now, given what has been researched.
export function unlockedRecipes(world: World, cat: Catalog): string[] {
    const open = new Set<string>();
    for (const r of cat.tree.recipes) open.add(r.id);
    for (const n of cat.tree.research) {
        if (researchedIn(world, n.id)) continue;
        for (const rec of n.recipes) open.delete(rec);
    }
    return cat.tree.recipes.filter((r) => open.has(r.id)).map((r) => r.id);
}

// Buy a research node with blueprints. Its prerequisites must already be bought.
export function buyResearch(world: World, cat: Catalog, nodeId: string): ActionResult {
    const node = cat.tree.research.find((n) => n.id === nodeId);
    if (!node) return { ok: false, reason: "no such research" };
    if (researchedIn(world, nodeId)) return { ok: false, reason: "already researched" };
    if (!node.requires.every((r) => researchedIn(world, r))) return { ok: false, reason: "needs earlier research first" };
    if (world.progress.blueprints < node.cost) return { ok: false, reason: `needs ${node.cost} blueprints` };
    world.progress.blueprints -= node.cost;
    world.progress.researched.push(nodeId);
    return { ok: true };
}

// Grant blueprints for every milestone whose cumulative delivery is now met. Runs at the end of each step.
export function checkMilestones(world: World, cat: Catalog): void {
    for (const m of cat.tree.milestones) {
        if (world.progress.milestonesDone.includes(m.id)) continue;
        const met = m.deliver.every((s) => (world.progress.delivered[s.item] ?? 0) >= s.qty);
        if (!met) continue;
        world.progress.milestonesDone.push(m.id);
        world.progress.blueprints += m.blueprints;
    }
}

// Day-night clock. phase is 0 at dawn, 0.5 at dusk; solar is 0 at night and 1 at noon.
export function dayClock(world: World, cat: Catalog): { phase: number; day: number; isNight: boolean; solar: number } {
    const len = cat.tune.dayLength;
    const t = world.time / len;
    const day = Math.floor(t);
    const phase = t - day;
    const isNight = phase >= 0.5;
    const solar = isNight ? 0 : Math.sin(phase * Math.PI * 2);
    return { phase, day, isNight, solar };
}

// Prestige: "Open a new workshop". Keeps blueprints, research, milestones done, routes (belts) and counts the run.
// Resets machines, drills, generators and the hub stock. Belts stay where they are so routes survive.
export function prestige(world: World, cat: Catalog): ActionResult {
    const keptBelts: World["buildings"] = {}; // belts keep their place and their type
    for (const id of Object.keys(world.buildings).map(Number)) {
        const b = world.buildings[id];
        if (b.type === "belt" || b.type === "belt-fast") keptBelts[id] = { ...b, input: {}, output: {}, lane: [] };
    }
    const hubId = world.hubId;
    const hub = world.buildings[hubId];
    const kept: World["buildings"] = { [hubId]: { ...hub, input: {}, output: {}, lane: [], recipe: null, crafting: false, progress: 0, acc: 0 } };
    for (const id of Object.keys(keptBelts).map(Number)) kept[id] = keptBelts[id];
    world.buildings = kept;
    world.power = { supply: 0, demand: 0, satisfaction: 1 };
    world.progress.prestiges += 1;
    world.progress.delivered = {};
    return { ok: true };
}
