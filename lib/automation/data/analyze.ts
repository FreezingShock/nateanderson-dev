// Checks and solver for the Brasswork tree. Pure functions, no imports beyond types,
// so scripts/automation/check-recipes.mjs and the tests can run them under Node.
import type { RecipeDef, RecipeTree } from "../types";

export interface Issue {
    level: "error" | "warn";
    msg: string;
}

/** Recipes flagged alternate. Everything else is a base recipe. */
export function alternateIds(tree: RecipeTree): Set<string> {
    const out = new Set<string>();
    for (const r of tree.recipes) if (r.alternate) out.add(r.id);
    return out;
}

/** The base recipe per item: the one recipe for that item that is not an alternate. */
export function baseRecipes(tree: RecipeTree): Map<string, RecipeDef> {
    const map = new Map<string, RecipeDef>();
    for (const r of tree.recipes) if (!r.alternate && !map.has(r.output.item)) map.set(r.output.item, r);
    return map;
}

/** Checks the tree is well formed, every item can be made from raw resources, and the research and milestone economy can pay for the megaproject. */
export function checkTree(tree: RecipeTree): Issue[] {
    const issues: Issue[] = [];
    const err = (msg: string) => issues.push({ level: "error", msg });
    const warn = (msg: string) => issues.push({ level: "warn", msg });

    const items = new Map<string, RecipeTree["items"][number]>();
    for (const it of tree.items) {
        if (items.has(it.id)) err(`duplicate item id ${it.id}`);
        items.set(it.id, it);
    }
    const machines = new Map<string, RecipeTree["machines"][number]>();
    for (const m of tree.machines) {
        if (machines.has(m.id)) err(`duplicate machine id ${m.id}`);
        machines.set(m.id, m);
        if (!(m.powerKw >= 0)) err(`machine ${m.id} needs powerKw of 0 or more`);
        if (m.storageKj !== undefined && !(m.storageKj > 0)) err(`store ${m.id} needs storageKj above 0`);
        if (m.generatesKw !== undefined) {
            if (!(m.generatesKw > 0)) err(`generator ${m.id} needs generatesKw above 0`);
            if (!(m.supplyRange !== undefined && m.supplyRange > 0)) err(`generator ${m.id} needs a supplyRange above 0`);
        }
        for (const s of m.buildCost ?? []) {
            const it = items.get(s.item);
            if (!it) err(`machine ${m.id} costs unknown item ${s.item}`);
            else if (it.stage > m.unlockStage) err(`machine ${m.id} (stage ${m.unlockStage}) costs ${s.item} from stage ${it.stage}`);
            if (!(Number.isInteger(s.qty) && s.qty > 0)) err(`machine ${m.id} build cost for ${s.item} must be a positive integer`);
        }
    }
    const structureIds = new Set<string>();
    for (const st of tree.structures) {
        if (structureIds.has(st.id)) err(`duplicate structure id ${st.id}`);
        structureIds.add(st.id);
        if (machines.has(st.id)) err(`structure ${st.id} clashes with a machine id`);
        if (!(st.footprint.w > 0 && st.footprint.d > 0)) err(`structure ${st.id} needs a positive footprint`);
    }
    const nodes = new Set<string>();
    for (const n of tree.nodes) {
        if (nodes.has(n.item)) err(`duplicate node for ${n.item}`);
        nodes.add(n.item);
        if (!items.has(n.item)) err(`node for unknown item ${n.item}`);
        else if (items.get(n.item)!.kind !== "raw") err(`node for non-raw item ${n.item}`);
        if (!(n.baseRatePerMin > 0)) err(`node ${n.item} needs a positive rate`);
    }

    const alt = alternateIds(tree);
    const producers = new Map<string, RecipeDef[]>();
    const recipeIds = new Set<string>();
    const consumed = new Set<string>();
    for (const r of tree.recipes) {
        if (recipeIds.has(r.id)) err(`duplicate recipe id ${r.id}`);
        recipeIds.add(r.id);
        const m = machines.get(r.machine);
        if (!m) err(`${r.id} uses unknown machine ${r.machine}`);
        if (!(r.craftSeconds > 0)) err(`${r.id} needs a positive craft time`);
        const out = items.get(r.output.item);
        if (!out) err(`${r.id} outputs unknown item ${r.output.item}`);
        if (!(Number.isInteger(r.output.qty) && r.output.qty > 0)) err(`${r.id} output qty must be a positive integer`);
        if (r.inputs.length === 0) err(`${r.id} has no inputs`);
        for (const s of r.inputs) {
            const inp = items.get(s.item);
            if (!inp) err(`${r.id} uses unknown input ${s.item}`);
            if (!(Number.isInteger(s.qty) && s.qty > 0)) err(`${r.id} input ${s.item} qty must be a positive integer`);
            if (s.item === r.output.item) err(`${r.id} consumes its own output`);
            consumed.add(s.item);
            if (inp && out && inp.stage > out.stage) err(`${r.id}: input ${s.item} (stage ${inp.stage}) is later than output (stage ${out.stage})`);
        }
        if (m && out && m.unlockStage > out.stage) err(`${r.id}: machine ${m.id} unlocks at stage ${m.unlockStage}, after output stage ${out.stage}`);
        if (out) {
            const list = producers.get(out.id) ?? [];
            list.push(r);
            producers.set(out.id, list);
        }
    }

    for (const it of items.values()) {
        const made = producers.get(it.id) ?? [];
        if (it.kind === "raw") {
            if (made.length) err(`raw item ${it.id} must not have a recipe`);
            if (!nodes.has(it.id)) err(`raw item ${it.id} has no resource node`);
        } else {
            const base = made.filter((r) => !alt.has(r.id));
            if (made.length === 0) err(`${it.id} has no recipe`);
            else if (base.length !== 1) err(`${it.id} needs exactly one base recipe, has ${base.length}`);
            if (!consumed.has(it.id) && it.kind !== "megaproject") warn(`${it.id} is never used as an input`);
        }
    }

    // Solvable: every item is reachable from raw resources. A cycle would leave its items unresolved.
    const resolved = new Set<string>();
    for (const it of items.values()) if (it.kind === "raw") resolved.add(it.id);
    let changed = true;
    while (changed) {
        changed = false;
        for (const r of tree.recipes) {
            if (resolved.has(r.output.item)) continue;
            if (r.inputs.every((s) => resolved.has(s.item))) {
                resolved.add(r.output.item);
                changed = true;
            }
        }
    }
    for (const it of items.values()) if (!resolved.has(it.id)) err(`${it.id} cannot be made from raw resources (cycle or missing recipe)`);

    // Research: ids unique, requires exist and form no cycle, each recipe unlocked by at most one node.
    const researchIds = new Set<string>();
    const unlockedBy = new Map<string, string>();
    for (const n of tree.research) {
        if (researchIds.has(n.id)) err(`duplicate research id ${n.id}`);
        researchIds.add(n.id);
        if (!(n.cost > 0)) err(`research ${n.id} needs a positive cost`);
        for (const rid of n.recipes) {
            if (!recipeIds.has(rid)) err(`research ${n.id} unlocks unknown recipe ${rid}`);
            if (unlockedBy.has(rid)) err(`recipe ${rid} is unlocked by two research nodes`);
            unlockedBy.set(rid, n.id);
        }
    }
    for (const n of tree.research) for (const q of n.requires) if (!researchIds.has(q)) err(`research ${n.id} requires unknown node ${q}`);
    const researchById = new Map(tree.research.map((n) => [n.id, n] as const));
    const state = new Map<string, number>(); // 1 = visiting, 2 = done
    const visit = (id: string): void => {
        if (state.get(id) === 2) return;
        if (state.get(id) === 1) {
            err(`research cycle through ${id}`);
            return;
        }
        state.set(id, 1);
        for (const q of researchById.get(id)?.requires ?? []) visit(q);
        state.set(id, 2);
    };
    for (const n of tree.research) visit(n.id);

    // Milestones: deliveries must be real items no later than the milestone's stage.
    for (const ms of tree.milestones) {
        if (!(ms.blueprints > 0)) err(`milestone ${ms.id} grants no blueprints`);
        for (const s of ms.deliver) {
            const it = items.get(s.item);
            if (!it) err(`milestone ${ms.id} delivers unknown item ${s.item}`);
            else if (it.stage > ms.stage) err(`milestone ${ms.id} (stage ${ms.stage}) delivers ${s.item} from stage ${it.stage}`);
            if (!(Number.isInteger(s.qty) && s.qty > 0)) err(`milestone ${ms.id} qty for ${s.item} must be a positive integer`);
        }
    }

    // Economy: blueprints from milestones must cover every research node the base path needs for the megaproject.
    // Alternates are optional, so they are left out of this walk.
    const base = baseRecipes(tree);
    const megaRecipes = new Set<string>();
    const stack: string[] = tree.items.filter((i) => i.kind === "megaproject").map((i) => i.id);
    const seenItems = new Set<string>();
    while (stack.length) {
        const id = stack.pop()!;
        if (seenItems.has(id)) continue;
        seenItems.add(id);
        const r = base.get(id);
        if (!r) continue;
        megaRecipes.add(r.id);
        for (const s of r.inputs) stack.push(s.item);
    }
    const neededNodes = new Set<string>();
    const need = (id: string): void => {
        if (neededNodes.has(id)) return;
        neededNodes.add(id);
        for (const q of researchById.get(id)?.requires ?? []) need(q);
    };
    for (const rid of megaRecipes) {
        const node = unlockedBy.get(rid);
        if (node) need(node);
    }
    const researchCost = [...neededNodes].reduce((sum, id) => sum + (researchById.get(id)?.cost ?? 0), 0);
    const income = tree.milestones.reduce((sum, m) => sum + m.blueprints, 0);
    if (income < researchCost) err(`milestones pay ${income} blueprints but the megaproject needs ${researchCost} in research`);
    else if (income > researchCost) warn(`milestones pay ${income} blueprints, ${income - researchCost} more than the megaproject research needs`);

    return issues;
}

export interface SolveRow {
    recipe: string;
    machine: string;
    output: string;
    runsPerMin: number;
    /** Machines needed at this recipe's speed, exact (fractional). */
    machines: number;
}

export interface SolveResult {
    rows: SolveRow[];
    /** Raw items needed per minute, keyed by item id. */
    raw: Record<string, number>;
    /** Drills needed per raw item, exact, on normal nodes. */
    drills: Record<string, number>;
    /** Total exact machines per machine id (drills included). */
    machineTotals: Record<string, number>;
    /** Demand per item per minute, including intermediates. */
    demand: Record<string, number>;
    /** Power drawn by all machines and drills, in kW. */
    powerKw: number;
}

/**
 * Work out what a set of target rates (items per minute) needs.
 * choice maps an item id to an alternate recipe id to use instead of its base recipe.
 * Assumes checkTree passes. Throws if the tree has a cycle.
 */
export function solve(tree: RecipeTree, targets: Record<string, number>, choice: Record<string, string> = {}): SolveResult {
    const producer = new Map<string, RecipeDef>();
    const base = baseRecipes(tree);
    const byId = new Map(tree.recipes.map((r) => [r.id, r] as const));
    for (const [item, r] of base) producer.set(item, r);
    for (const [item, rid] of Object.entries(choice)) {
        const r = byId.get(rid);
        if (!r || r.output.item !== item) throw new Error(`choice ${rid} does not make ${item}`);
        producer.set(item, r);
    }
    const machineDef = new Map(tree.machines.map((m) => [m.id, m] as const));
    const nodeRate = new Map(tree.nodes.map((n) => [n.item, n.baseRatePerMin] as const));

    // Only recipes on the chosen path count. remaining[i] = chosen recipes that still need item i.
    const chosen = new Set<RecipeDef>(producer.values());
    const remaining = new Map<string, number>();
    for (const r of chosen) for (const s of r.inputs) remaining.set(s.item, (remaining.get(s.item) ?? 0) + 1);

    const demand: Record<string, number> = {};
    for (const [id, rate] of Object.entries(targets)) demand[id] = (demand[id] ?? 0) + rate;
    const ready: string[] = tree.items.map((i) => i.id).filter((id) => (remaining.get(id) ?? 0) === 0);

    const rows: SolveRow[] = [];
    const raw: Record<string, number> = {};
    const drills: Record<string, number> = {};
    const machineTotals: Record<string, number> = {};
    let done = 0;

    while (ready.length) {
        const id = ready.shift()!;
        done++;
        const need = demand[id] ?? 0;
        const r = producer.get(id);
        if (!r) {
            if (need > 0) {
                raw[id] = need;
                const rate = nodeRate.get(id);
                if (rate) {
                    drills[id] = need / rate;
                    machineTotals.drill = (machineTotals.drill ?? 0) + need / rate;
                }
            }
            continue;
        }
        const runs = need / r.output.qty;
        const sp = machineDef.get(r.machine)?.speed ?? 1;
        const machines = (runs * r.craftSeconds) / 60 / sp;
        if (need > 0) {
            rows.push({ recipe: r.id, machine: r.machine, output: id, runsPerMin: runs, machines });
            machineTotals[r.machine] = (machineTotals[r.machine] ?? 0) + machines;
        }
        for (const s of r.inputs) {
            demand[s.item] = (demand[s.item] ?? 0) + runs * s.qty;
            const left = (remaining.get(s.item) ?? 0) - 1;
            remaining.set(s.item, left);
            if (left === 0) ready.push(s.item);
        }
    }

    // Every item is processed once, after all its chosen consumers. Fewer means a cycle.
    if (done !== tree.items.length) throw new Error(`solve reached ${done} of ${tree.items.length} items; the tree has a cycle`);

    let powerKw = 0;
    for (const [mid, count] of Object.entries(machineTotals)) powerKw += count * (machineDef.get(mid)?.powerKw ?? 0);
    return { rows, raw, drills, machineTotals, demand, powerKw };
}

/** Generators that the given power demand needs, one generator id at a time (exact, fractional). */
export function generatorsFor(tree: RecipeTree, powerKw: number, generatorId: string): number {
    const g = tree.machines.find((m) => m.id === generatorId);
    if (!g || !g.generatesKw) throw new Error(`${generatorId} is not a generator`);
    return powerKw / g.generatesKw;
}

/** Plain-text ratio report: each Sky orrery part at 1 per minute, the whole orrery, then each alternate's effect. */
export function report(tree: RecipeTree): string {
    const lines: string[] = [];
    const name = new Map(tree.items.map((i) => [i.id, i.name] as const));
    const mega = tree.items.filter((i) => i.kind === "megaproject");
    const fmt = (n: number) => (Math.abs(n - Math.round(n)) < 0.005 ? String(Math.round(n)) : n.toFixed(2));
    const show = (title: string, targets: Record<string, number>, choice: Record<string, string> = {}) => {
        const res = solve(tree, targets, choice);
        lines.push(`== ${title}`);
        lines.push("Raw per min: " + Object.entries(res.raw).map(([k, v]) => `${name.get(k)} ${fmt(v)} (${fmt(res.drills[k] ?? 0)} drills)`).join(", "));
        lines.push("Machines: " + Object.entries(res.machineTotals).filter(([k]) => k !== "drill").map(([k, v]) => `${k} ${fmt(v)}`).join(", "));
        lines.push(`Power: ${fmt(res.powerKw)} kW (${fmt(generatorsFor(tree, res.powerKw, "windmill"))} windmills or ${fmt(generatorsFor(tree, res.powerKw, "spring_winder"))} spring winders at peak)`);
        lines.push("Recipes:");
        for (const row of res.rows) lines.push(`  ${row.recipe.padEnd(22)} ${row.machine.padEnd(10)} ${fmt(row.runsPerMin).padStart(6)} runs/min  ${fmt(row.machines).padStart(6)} machines`);
        lines.push("");
    };
    for (const m of mega) show(`${m.name} at 1 per min`, { [m.id]: 1 });
    show("All four parts at 1 per min", Object.fromEntries(mega.map((m) => [m.id, 1])));

    // Alternates: swap one item's base recipe for the alternate, on the whole orrery, and show the difference.
    const allFour = Object.fromEntries(mega.map((m) => [m.id, 1]));
    const baseRes = solve(tree, allFour);
    lines.push("== Alternates (whole orrery at 1 per min, change against base)");
    const base = baseRecipes(tree);
    for (const r of tree.recipes) {
        if (!r.alternate) continue;
        const res = solve(tree, allFour, { [r.output.item]: r.id });
        const rawDelta = Object.entries(res.raw).map(([k, v]) => `${name.get(k)} ${fmt(v - (baseRes.raw[k] ?? 0))}`).join(", ");
        const mDelta = (res.machineTotals[r.machine] ?? 0) - (baseRes.machineTotals[r.machine] ?? 0);
        lines.push(`  ${r.id.padEnd(22)} replaces ${base.get(r.output.item)!.id} for ${name.get(r.output.item)}; raw change: ${rawDelta || "none"}; ${r.machine} change ${fmt(mDelta)}`);
    }
    lines.push("");
    return lines.join("\n");
}
