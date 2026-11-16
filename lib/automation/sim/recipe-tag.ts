// The one-line recipe note shown when the mouse hovers a placed machine. Pure: takes the world and catalog and
// returns plain text. The name tag itself is components/brasswork/hover-name.tsx.
import type { Catalog, World } from "../types";
import { DEFAULT_CATALOG } from "./data";
import { buildingAt, depositUnder, resolve } from "./world";

function itemName(cat: Catalog, id: string): string {
    return cat.tree.items.find((i) => i.id === id)?.name ?? id;
}

/**
 * Recipe note for the building under a board cell. Crafters say what they make, or that no recipe is set.
 * Drills say what they mine. Everything else gets null, and the name tag alone is enough.
 */
export function recipeTagAt(world: World, x: number, z: number, cat: Catalog = DEFAULT_CATALOG): string | null {
    const b = buildingAt(world, x, z, cat);
    if (!b) return null;
    const r = resolve(cat, b.type);
    if (!r) return null;
    if (r.kind === "miner") {
        const dep = depositUnder(world, b, r.footprint)?.dep;
        return dep ? `Mines ${itemName(cat, dep.item)}` : "No resource node under it";
    }
    if (r.kind !== "crafter") return null;
    if (!b.recipe) return "No recipe set. Not running";
    const rec = cat.tree.recipes.find((x2) => x2.id === b.recipe);
    return rec ? `Making ${itemName(cat, rec.output.item)}, ${rec.craftSeconds} s a craft` : null;
}
