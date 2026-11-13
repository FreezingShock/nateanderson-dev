// Progression: milestone deliveries grant blueprints, research is bought with blueprints, and the one prestige resets the factory.
// Imports types only, so world.ts can call checkMilestones without a cycle.
import type { ActionResult, Building, Catalog, World } from "../types";
import { SITES, type SiteDef } from "./data";

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

// Three sites to choose from, drawn from the list by a seed, so one run offers the same three every time.
export function offerSites(seed: number, count = 3): SiteDef[] {
    const pool = [...SITES];
    let state = (seed >>> 0) || 1;
    const next = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
    const out: SiteDef[] = [];
    while (out.length < count && pool.length > 0) {
        const i = Math.floor(next() * pool.length);
        out.push(pool.splice(i, 1)[0]);
    }
    return out;
}

// Prestige: "Open a new workshop". Keeps blueprints, research, milestones done, and any belt that still fits the new floor.
// Resets machines, drills, generators and the hub stock. The hub and the nodes move to the chosen site.
export function prestige(world: World, cat: Catalog, siteId: string): ActionResult {
    const site = SITES.find((x) => x.id === siteId);
    if (!site) return { ok: false, reason: "no such site" };
    const hub = world.buildings[world.hubId];
    const newHub: Building = { ...hub, x: site.hub.x, z: site.hub.z, input: {}, output: {}, lane: [], recipe: null, crafting: false, progress: 0, acc: 0 };
    const keep: World["buildings"] = { [world.hubId]: newHub };
    const taken = new Set<string>([`${site.hub.x},${site.hub.z}`, `${site.hub.x + 1},${site.hub.z}`, `${site.hub.x},${site.hub.z + 1}`, `${site.hub.x + 1},${site.hub.z + 1}`]);
    for (const id of Object.keys(world.buildings).map(Number)) {
        if (id === world.hubId) continue;
        const b = world.buildings[id];
        if (b.type !== "belt" && b.type !== "belt-copper" && b.type !== "belt-steel") continue;
        if (b.x < 0 || b.z < 0 || b.x >= site.width || b.z >= site.depth) continue;
        if (taken.has(`${b.x},${b.z}`)) continue;
        keep[id] = { ...b, input: {}, output: {}, lane: [] };
        taken.add(`${b.x},${b.z}`);
    }
    world.buildings = keep;
    world.width = site.width;
    world.depth = site.depth;
    world.deposits = {};
    for (const n of site.nodes) world.deposits[`${n.x},${n.z}`] = { item: n.item, purity: n.purity };
    world.power = { supply: 0, demand: 0, satisfaction: 1 };
    world.progress.prestiges += 1;
    world.progress.delivered = {};
    world.progress.site = site.id;
    world.progress.bonus = { ...site.bonus };
    return { ok: true };
}
