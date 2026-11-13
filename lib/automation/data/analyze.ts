// Checks and solver for the Brasswork tree. Pure functions, no imports beyond types,
// so scripts/automation/check-recipes.mjs and the tests can run them under Node.
import type { RecipeDef, RecipeTree } from "./types";

export interface Issue {
    level: "error" | "warn";
    msg: string;
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
    }
    const nodes = new Set<string>();
    for (const n of tree.nodes) {
        if (nodes.has(n.item)) err(`duplicate node for ${n.item}`);
        nodes.add(n.item);
        if (!items.has(n.item)) err(`node for unknown item ${n.item}`);
        else if (items.get(n.item)!.kind !== "raw") err(`node for non-raw item ${n.item}`);
        if (!(n.baseRatePerMin > 0)) err(`node ${n.item} needs a positive rate`);
    }

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
            if (made.length === 0) err(`${it.id} has no recipe`);
            if (made.length > 1) err(`${it.id} has ${made.length} recipes (v1 allows one)`);
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

    // Economy: blueprints from milestones must cover every research node needed to craft the megaproject.
    const megaRecipes = new Set<string>();
    const stack: string[] = tree.items.filter((i) => i.kind === "megaproject").map((i) => i.id);
    const seenItems = new Set<string>();
    while (stack.length) {
        const id = stack.pop()!;
        if (seenItems.has(id)) continue;
        seenItems.add(id);
        for (const r of producers.get(id) ?? []) {
            megaRecipes.add(r.id);
            for (const s of r.inputs) stack.push(s.item);
        }
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
    /** Total exact machines per machine id. */
    machineTotals: Record<string, number>;
    /** Demand per item per minute, including intermediates. */
    demand: Record<string, number>;
}

/**
 * Work out what a set of target rates (items per minute) needs.
 * Assumes checkTree passes. Throws if the tree has a cycle.
 */
export function solve(tree: RecipeTree, targets: Record<string, number>): SolveResult {
    const producer = new Map<string, RecipeDef>();
    for (const r of tree.recipes) producer.set(r.output.item, r);
    const speed = new Map(tree.machines.map((m) => [m.id, m.speed] as const));
    const nodeRate = new Map(tree.nodes.map((n) => [n.item, n.baseRatePerMin] as const));

    // remaining[i] = number of recipes that still need item i. An item is ready once none are left.
    const remaining = new Map<string, number>();
    for (const r of tree.recipes) for (const s of r.inputs) remaining.set(s.item, (remaining.get(s.item) ?? 0) + 1);

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
                if (rate) drills[id] = need / rate;
            }
            continue;
        }
        const runs = need / r.output.qty;
        const sp = speed.get(r.machine) ?? 1;
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

    const expected = tree.items.length;
    if (done !== expected) throw new Error(`solve reached ${done} of ${expected} items; the tree has a cycle`);
    return { rows, raw, drills, machineTotals, demand };
}

/** Plain-text ratio report: each megaproject part at 1 per minute, then the whole megaproject at once. */
export function report(tree: RecipeTree): string {
    const lines: string[] = [];
    const name = new Map(tree.items.map((i) => [i.id, i.name] as const));
    const mega = tree.items.filter((i) => i.kind === "megaproject");
    const fmt = (n: number) => (Math.abs(n - Math.round(n)) < 0.005 ? String(Math.round(n)) : n.toFixed(2));
    const show = (title: string, targets: Record<string, number>) => {
        const res = solve(tree, targets);
        lines.push(`== ${title}`);
        lines.push("Raw per min: " + Object.entries(res.raw).map(([k, v]) => `${name.get(k)} ${fmt(v)} (${fmt(res.drills[k] ?? 0)} drills)`).join(", "));
        lines.push("Machines: " + Object.entries(res.machineTotals).map(([k, v]) => `${k} ${fmt(v)}`).join(", "));
        lines.push("Recipes:");
        for (const row of res.rows) lines.push(`  ${row.recipe.padEnd(22)} ${row.machine.padEnd(10)} ${fmt(row.runsPerMin).padStart(6)} runs/min  ${fmt(row.machines).padStart(6)} machines`);
        lines.push("");
    };
    for (const m of mega) show(`${m.name} at 1 per min`, { [m.id]: 1 });
    show("All four parts at 1 per min", Object.fromEntries(mega.map((m) => [m.id, 1])));
    return lines.join("\n");
}
