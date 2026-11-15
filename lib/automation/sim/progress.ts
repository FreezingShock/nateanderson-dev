// Progression: milestone deliveries grant blueprints, research is bought with blueprints, and the one prestige resets the factory.
// Imports types only, so world.ts can call checkMilestones without a cycle.
import type { ActionResult, Building, Catalog, World } from "../types";
import { SITES, commissionDef, workshopKit, type SiteDef } from "./data";
import type { MilestoneDef, Stack } from "../types";

function researchedIn(world: World, nodeId: string): boolean {
    return world.progress.researched.includes(nodeId);
}

export function requestDone(world: World, id: string): boolean {
    return (world.progress.requestsDone ?? []).includes(id);
}

// Recipes the player may use right now, given what has been researched.
export function unlockedRecipes(world: World, cat: Catalog): string[] {
    const open = new Set<string>();
    for (const r of cat.tree.recipes) open.add(r.id);
    // Recipes a hub request opens stay shut until that request is done.
    for (const q of cat.tree.requests ?? []) {
        if (requestDone(world, q.id)) continue;
        for (const rec of q.unlocks.recipes) open.delete(rec);
    }
    for (const n of cat.tree.research) {
        if (researchedIn(world, n.id)) continue;
        for (const rec of n.recipes) open.delete(rec);
    }
    return cat.tree.recipes.filter((r) => open.has(r.id)).map((r) => r.id);
}

function pay(world: World, items: Stack[] | undefined): void {
    if (!items) return;
    const hub = world.buildings[world.hubId];
    for (const s of items) hub.input[s.item] = (hub.input[s.item] ?? 0) + s.qty;
}

// The multipliers in force: the chosen site's bonus times every mastery node bought. Stored on progress so the engine reads one field.
export function refreshBonus(world: World, cat: Catalog): void {
    const site = SITES.find((x) => x.id === world.progress.site);
    const b = { miner: site?.bonus.miner ?? 1, power: site?.bonus.power ?? 1, craft: 1 };
    for (const n of cat.tree.research) {
        if (!researchedIn(world, n.id) || !n.bonus) continue;
        b.miner *= n.bonus.miner ?? 1;
        b.power *= n.bonus.power ?? 1;
        b.craft *= n.bonus.craft ?? 1;
    }
    world.progress.bonus = b;
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
    refreshBonus(world, cat);
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
        pay(world, m.reward);
    }
    checkCommission(world, cat);
}

// The commission now open, once every first-run milestone is delivered. Counts only items delivered after it opened.
export function currentCommission(world: World, cat: Catalog): (MilestoneDef & { n: number }) | null {
    const all = cat.tree.milestones;
    if (all.length === 0 || !all.every((m) => world.progress.milestonesDone.includes(m.id))) return null;
    const n = world.progress.commissions ?? 0;
    const def = commissionDef(n);
    const base = world.progress.commissionBase ?? {};
    return { id: "commission", n, name: def.name, stage: 5, blueprints: def.blueprints, reward: def.reward, deliver: def.deliver.map((s) => ({ item: s.item, qty: s.qty + (base[s.item] ?? 0) })) };
}

function checkCommission(world: World, cat: Catalog): void {
    for (let guard = 0; guard < 20; guard++) {
        if (!world.progress.commissionBase && cat.tree.milestones.every((m) => world.progress.milestonesDone.includes(m.id))) world.progress.commissionBase = { ...world.progress.delivered };
        const c = currentCommission(world, cat);
        if (!c) return;
        // Targets already include the delivered counts from when the commission opened, so reaching them means a fresh delivery.
        if (!c.deliver.every((s) => (world.progress.delivered[s.item] ?? 0) >= s.qty)) return;
        world.progress.commissions = (world.progress.commissions ?? 0) + 1;
        world.progress.blueprints += c.blueprints;
        pay(world, c.reward);
        world.progress.commissionBase = { ...world.progress.delivered };
    }
}

// Complete every hub request whose delivery is now met. Runs at the end of each step, next to the milestones.
export function checkRequests(world: World, cat: Catalog): void {
    for (const q of cat.tree.requests ?? []) {
        if (requestDone(world, q.id)) continue;
        if (!q.deliver.every((s) => (world.progress.delivered[s.item] ?? 0) >= s.qty)) continue;
        (world.progress.requestsDone ??= []).push(q.id);
        pay(world, q.reward);
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
    const kit: Record<string, number> = {};
    for (const s of workshopKit(world.progress.prestiges)) kit[s.item] = s.qty;
    const newHub: Building = { ...hub, x: site.hub.x, z: site.hub.z, input: kit, output: {}, lane: [], recipe: null, crafting: false, progress: 0, acc: 0 };
    const keep: World["buildings"] = { [world.hubId]: newHub };
    const taken = new Set<string>();
    for (let dz = 0; dz < 3; dz++) for (let dx = 0; dx < 3; dx++) taken.add(`${site.hub.x + dx},${site.hub.z + dz}`); // hub is 3 by 3
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
    world.progress.commissionBase = {};
    refreshBonus(world, cat);
    return { ok: true };
}
