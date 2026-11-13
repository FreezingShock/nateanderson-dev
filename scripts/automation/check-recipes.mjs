// Checks the Brasswork recipe tree is solvable and prints the ratios.
// Run: npm run check:automation   (exit code 1 when there are errors)
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const { RECIPE_TREE } = await import(resolve(root, "lib/automation/data/tree.ts"));
const { checkTree, report } = await import(resolve(root, "lib/automation/data/analyze.ts"));

const issues = checkTree(RECIPE_TREE);
const errors = issues.filter((i) => i.level === "error");
const warns = issues.filter((i) => i.level === "warn");

console.log(`Brasswork tree: ${RECIPE_TREE.items.length} items, ${RECIPE_TREE.recipes.length} recipes, ${RECIPE_TREE.machines.length} machines, ${RECIPE_TREE.research.length} research nodes, ${RECIPE_TREE.milestones.length} milestones`);
for (const i of warns) console.log(`warn  ${i.msg}`);
for (const i of errors) console.log(`error ${i.msg}`);
if (errors.length === 0) console.log("ok: every item is makeable from raw resources, research and milestones cover the megaproject\n");
console.log(report(RECIPE_TREE));

process.exit(errors.length ? 1 : 0);
