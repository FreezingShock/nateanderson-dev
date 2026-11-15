// Tooltip content for Brasswork, built from the game's own data (the recipe tree, the engine table and the HUD views).
// Pure, so it runs in Node tests. The layer that draws it is components/brasswork-ui/tip.tsx.
import type { Catalog, EngineDef, ItemDef, Line, MachineDef, MachineView, MilestoneView, RecipeDef, RecipeTree, ResearchNode, Stack, StructureDef } from "./types";

/** What a tag says. Mirrors the type in components/brasswork-ui/tip.tsx (kept here so lib/ has no React import). */
export type TipData = {
  title: string;
  tag?: string;
  text?: string;
  rows?: { k: string; v: string; tone?: "good" | "bad" }[];
  key?: string;
  note?: string;
};

const TAG_OF_KIND: Record<ItemDef["kind"], string> = {
  raw: "Raw resource",
  material: "Material",
  part: "Part",
  module: "Module",
  megaproject: "Megaproject",
};

/** A number with at most two decimals and no trailing zeros. */
export function num(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 100) / 100);
}

function itemName(tree: RecipeTree, id: string): string {
  return tree.items.find((i) => i.id === id)?.name ?? id;
}

function machineName(tree: RecipeTree, id: string): string {
  return tree.machines.find((m) => m.id === id)?.name ?? id;
}

/** "2 Iron ore, 1 Coal". Empty input gives "Nothing". */
export function stackText(tree: RecipeTree, stacks: readonly Stack[] | readonly Line[]): string {
  if (!stacks.length) return "Nothing";
  return stacks
    .map((s) => {
      const id = "item" in s ? s.item : s.resourceId;
      const qty = "qty" in s ? s.qty : s.amount;
      return `${num(qty)} ${itemName(tree, id)}`;
    })
    .join(", ");
}

/** Base (non-alternate) recipes a machine runs, in tree order. */
export function recipesOf(tree: RecipeTree, machineId: string): RecipeDef[] {
  return tree.recipes.filter((r) => r.machine === machineId && !r.alternate);
}

/** The machine or structure a build-list id refers to, with the engine table as a fallback for belts and hubs. */
function definitionOf(catalog: Catalog, id: string): MachineDef | StructureDef | EngineDef | null {
  return (
    catalog.tree.machines.find((m) => m.id === id) ??
    catalog.tree.structures?.find((s) => s.id === id) ??
    catalog.engine[id] ??
    null
  );
}

const GROUP_TAG: Record<NonNullable<MachineView["group"]>, string> = {
  machines: "Machine",
  power: "Power",
  logistics: "Logistics",
};

const STATUS_TEXT: Record<MachineView["status"], string> = {
  running: "Running",
  idle: "Idle",
  starved: "Waiting for input",
  blocked: "Output full",
};

/** Rows that come from the definition alone: speed, power, reach, storage, size and what it makes. */
function defRows(catalog: Catalog, id: string): NonNullable<TipData["rows"]> {
  const tree = catalog.tree;
  const def = definitionOf(catalog, id);
  const rows: NonNullable<TipData["rows"]> = [];
  if (def && "speed" in def && def.speed !== undefined) rows.push({ k: "Speed", v: `${num(def.speed)}×` });
  if (def && "powerKw" in def && def.powerKw) rows.push({ k: "Power use", v: `${num(def.powerKw)} kW` });
  if (def && "generatesKw" in def && def.generatesKw) rows.push({ k: "Makes", v: `${num(def.generatesKw)} kW` });
  if (def && "supplyRange" in def && def.supplyRange) rows.push({ k: "Reach", v: `${num(def.supplyRange)} cells` });
  if (def && "storageKj" in def && def.storageKj) rows.push({ k: "Stores", v: `${num(def.storageKj)} kJ` });
  if (def && "rate" in def && def.rate) rows.push({ k: "Moves", v: `${num(def.rate)} items/s` });
  if (def && "capacity" in def && def.capacity) rows.push({ k: "Holds", v: `${num(def.capacity)} each` });
  if (def && "footprint" in def) rows.push({ k: "Size", v: `${def.footprint.w} × ${def.footprint.d} cells` });
  const made = recipesOf(tree, id).map((r) => itemName(tree, r.output.item));
  if (made.length) rows.push({ k: "Makes", v: made.slice(0, 3).join(", ") + (made.length > 3 ? "…" : "") });
  return rows;
}

/** Tag for a placed building, by its type id (the name tag on the island, before any HUD view exists). */
export function kindTip(catalog: Catalog, id: string): TipData | null {
  const def = definitionOf(catalog, id);
  if (!def) return null;
  const engine = catalog.engine[id];
  const tag = catalog.tree.machines.some((m) => m.id === id)
    ? "Machine"
    : engine?.kind === "hub"
      ? "Hub"
      : engine?.kind === "generator"
        ? "Power"
        : engine
          ? "Logistics"
          : "Structure";
  return {
    title: def.name,
    tag,
    text: "note" in def ? def.note : undefined,
    rows: defRows(catalog, id),
  };
}

/**
 * Build-list tag for a machine, belt or power piece: what it is, its cost, speed, power and what it makes.
 * `key` is the number-key hint (1 to 9) when the row has one.
 */
export function machineTip(catalog: Catalog, view: MachineView, key?: number): TipData {
  const tree = catalog.tree;
  const def = definitionOf(catalog, view.id);
  const rows: NonNullable<TipData["rows"]> = [];
  if (view.unlocked) {
    rows.push({ k: "Cost", v: view.cost.length ? stackText(tree, view.cost) : "Free" });
    rows.push({ k: "Built", v: String(view.count) });
  }
  rows.push(...defRows(catalog, view.id));
  if (view.unlocked && view.count > 0) {
    rows.push({ k: "Status", v: STATUS_TEXT[view.status], tone: view.status === "running" ? "good" : view.status === "blocked" ? "bad" : undefined });
  }
  return {
    title: view.name,
    tag: GROUP_TAG[view.group ?? "machines"],
    text: def && "note" in def ? def.note : undefined,
    rows,
    key: key !== undefined ? String(key) : undefined,
    note: !view.unlocked ? view.lockedReason : undefined,
  };
}

/** Item tag: what it is, what makes it and what it takes. */
export function itemTip(tree: RecipeTree, itemId: string): TipData {
  const item = tree.items.find((i) => i.id === itemId);
  const rows: NonNullable<TipData["rows"]> = [];
  const base = tree.recipes.find((r) => r.output.item === itemId && !r.alternate);
  if (base) {
    rows.push({ k: "Made in", v: machineName(tree, base.machine) });
    rows.push({ k: "Takes", v: stackText(tree, base.inputs) });
    rows.push({ k: "Per craft", v: `${num(base.output.qty)} in ${num(base.craftSeconds)} s` });
  }
  const node = tree.nodes.find((n) => n.item === itemId);
  if (node) rows.push({ k: "Mined at", v: `${num(node.baseRatePerMin)} a minute per drill` });
  return {
    title: item?.name ?? itemId,
    tag: item ? TAG_OF_KIND[item.kind] : undefined,
    text: item?.note,
    rows,
  };
}

/** Recipe tag for a crafter's recipe choice: inputs, output and craft time. */
export function recipeTip(tree: RecipeTree, recipe: RecipeDef, tag = "Recipe"): TipData {
  return {
    title: itemName(tree, recipe.output.item),
    tag: recipe.alternate ? "Alternate recipe" : tag,
    rows: [
      { k: "Takes", v: stackText(tree, recipe.inputs) },
      { k: "Makes", v: `${num(recipe.output.qty)} ${itemName(tree, recipe.output.item)}` },
      { k: "Craft time", v: `${num(recipe.craftSeconds)} s` },
      { k: "Machine", v: machineName(tree, recipe.machine) },
    ],
  };
}

/** Research node tag: cost in blueprints, what it unlocks and what it needs first. `short` is blueprints still missing. */
export function researchTip(tree: RecipeTree, node: ResearchNode, short = 0): TipData {
  const rows: NonNullable<TipData["rows"]> = [{ k: "Cost", v: `${node.blueprintCost} blueprint${node.blueprintCost === 1 ? "" : "s"}` }];
  if (node.unlocks.length) rows.push({ k: "Unlocks", v: node.unlocks.join(", ") });
  const reqs = node.requires.map((id) => tree.research.find((r) => r.id === id)?.name ?? id);
  if (reqs.length) rows.push({ k: "Needs", v: reqs.join(", ") });
  const stateText =
    node.state === "done"
      ? "Researched"
      : node.state === "available"
        ? short > 0
          ? `${short} more blueprint${short === 1 ? "" : "s"}`
          : "Ready to buy"
        : "Locked";
  rows.push({ k: "State", v: stateText, tone: node.state === "done" || (node.state === "available" && short === 0) ? "good" : undefined });
  return { title: node.name, tag: "Research", text: node.note, rows };
}

/** Milestone tag: the goal, the reward and how far along it is. */
export function milestoneTip(m: MilestoneView): TipData {
  const pct = Math.round(Math.min(1, Math.max(0, m.progress)) * 100);
  const rows: NonNullable<TipData["rows"]> = [
    { k: "Reward", v: m.rewardLine ?? `${m.blueprintReward} blueprint${m.blueprintReward === 1 ? "" : "s"}` },
    { k: "Progress", v: m.done ? "Done" : `${pct}%`, tone: m.done ? "good" : undefined },
  ];
  return { title: m.name, tag: m.commission ? "Commission" : "Milestone", text: m.goal, rows };
}

/** Static tags for buttons and toggles that have no game data of their own. Keyed by a short control id. */
export const CONTROL_TIPS: Record<string, TipData> = {
  research: { title: "Research", tag: "Board", text: "Spend blueprints to unlock recipes and machines." },
  hub: { title: "Hub", tag: "Menu", text: "The hub stock, the hub requests and the workshop goals." },
  expedition: { title: "Expedition", tag: "Drawer", text: "The islands you can open and the sites you can reach." },
  stats: { title: "Production", tag: "Drawer", text: "What each machine makes and uses, per minute." },
  settings: { title: "Settings", tag: "Drawer", text: "Sound, motion, number format and the visual level." },
  milestones: { title: "Milestones", tag: "Goals", text: "Deliver items to the hub to earn blueprints." },
  quest: { title: "Starter quest", tag: "Scroll", text: "The first steps. Open it to see what is next." },
  rotate: { title: "Rotate", tag: "Tool", text: "Turn the ghost or the selected building a quarter turn.", key: "R" },
  topdown: { title: "Top-down view", tag: "Camera", text: "Look straight down at the island, or go back to the orbit view.", key: "T" },
  undo: { title: "Undo", tag: "Edit", text: "Take back the last placement or removal.", key: "Ctrl Z" },
  redo: { title: "Redo", tag: "Edit", text: "Put back what you undid.", key: "Ctrl Y" },
  remove: { title: "Remove", tag: "Tool", text: "Click a building to take it away. Half its cost comes back. X toggles the tool.", key: "X" },
  cancel: { title: "Cancel", tag: "Tool", text: "Put down whatever you are holding.", key: "Esc" },
  next: { title: "Next step", tag: "Objective", text: "Do the step shown here to move the workshop on." },
};

/** Adds one "Recipe" row to a placed building's tag, at the top. A null line leaves the tag as it is. */
export function withRecipe(tip: TipData | null, line: string | null): TipData | null {
  if (!tip || !line) return tip;
  return { ...tip, rows: [{ k: "Recipe", v: line }, ...(tip.rows ?? [])] };
}
