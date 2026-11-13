// Next-step audit: loads saves (sim.mjs with NF_SNAP=<dir> writes them) and prints what the guide says at each one, next to a list of
// every other thing the player could do right now. If the guide's pick is not on that list, or the list holds things the guide never
// mentions, the next step is not obvious. Run: node --experimental-strip-types scripts/nodefarm/guide-audit.mjs <dir> [name filter]
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
const { registerHooks } = await import("node:module");
registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const E = await import("../../lib/nodefarm/engine.ts");
const G = await import("../../lib/nodefarm/guide.ts");
const dir = process.argv[2];
const filt = process.argv[3] ? new RegExp(process.argv[3]) : null;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json") && (!filt || filt.test(x))).sort()) {
    const s = E.parseSave(readFileSync(resolve(dir, f), "utf8"));
    if (!s) { console.log(f, "DOES NOT LOAD"); continue; }
    const d = E.derive(s);
    const st = G.nextStep(s, d);
    const ready = G.readyNow ? G.readyNow(s, d).map((r) => r.id) : [];
    console.log(f.replace(".json", "").padEnd(28), "|", st.id.padEnd(16), "|", st.title.slice(0, 54).padEnd(54), "|", `${Math.round(st.frac * 100)}%`.padStart(4), "| ready:", ready.join(",") || "-");
}
