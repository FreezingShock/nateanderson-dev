// Checks that a save owning a removed tree node loads cleanly and gets its AP back.
// Run: node --experimental-strip-types scripts/nodefarm/removed-nodes-check.mjs
import * as E from "../../lib/nodefarm/engine.ts";

let failed = 0;
const check = (name, ok) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}`); if (!ok) failed++; };

check("batchjob is no longer in the tree", !E.TREE.some((n) => n.id === "batchjob"));
const keep = E.TREE.find((n) => n.id !== "batchjob" && !n.form && !n.ranks).id;

// an old save: Batch job plus one node that still exists, with 3 AP spare
const old = { v: 1, bytes: 0, ap: 3, tree: ["batchjob", keep] };
const s = E.parseSave(JSON.stringify(old));
check("old save parses", !!s);
if (s) {
    check("batchjob dropped from the tree", !s.tree.includes("batchjob"));
    check("the other node is kept", s.tree.includes(keep));
    check("AP refunded for batchjob (3 + 10)", s.ap === 13);
    check("refund is recorded as treeRefund", (s.treeRefund ?? 0) === 10);
    let threw = false;
    try { E.derive(s); for (const n of E.TREE) E.nodeVis(s, n); E.treeSpent(s); E.hasFeature(s, "watchdog"); } catch { threw = true; }
    check("derive and tree visibility run on the migrated save", !threw);
}

// a save that never had Batch job is untouched
const fresh = E.parseSave(JSON.stringify({ v: 1, bytes: 0, ap: 3, tree: [keep] }));
check("save without batchjob keeps its AP", !!fresh && fresh.ap === 3 && fresh.tree.length === 1);

console.log(failed ? `${failed} check(s) failed` : "all checks passed");
process.exit(failed ? 1 : 0);
