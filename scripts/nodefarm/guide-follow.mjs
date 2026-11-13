// A player who only follows the next step: every second, press the glowing button if it can be paid, build the Drone the step asks
// for, open the window it points at (spend AP, Ascend). Logs each step change with the guide's promised wait next to the real one.
//   node --experimental-strip-types scripts/nodefarm/guide-follow.mjs [minutes=90]
const { registerHooks } = await import("node:module");
registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const E = await import("../../lib/nodefarm/engine.ts");
const G = await import("../../lib/nodefarm/guide.ts");
const mins = Number(process.argv[2] || 90);
const s = E.fresh(0);
let last = "", since = 0, promised = null;
for (let t = 0; t < mins * 60; t++) {
    for (let i = 0; i < 10; i++) E.tick(s, 0.1);
    const d = E.derive(s);
    const st = G.nextStep(s, d);
    const tg = st.target;
    if (tg?.stat !== undefined && tg.tier !== undefined && E.canAfford(s, tg.stat, tg.tier)) E.press(s, tg.stat, tg.tier);
    else if (tg?.drone !== undefined) E.buyDrone(s, tg.drone);
    else if (tg?.win === "lab" || tg?.lab) { for (const n of [...E.LAB].sort((a, b) => a.cost - b.cost)) if (E.buyLabNode(s, n.id)) break; for (const p of E.PAYLOADS) if ((s.lab.stock[p.id] ?? 0) < 1) E.compile(s, p.id); }
    else if (st.id === "ascend" && E.canAscend(s)) E.ascend(s);
    else if (st.id === "spend-ap") { for (const n of [...E.TREE].sort((a, b) => a.cost - b.cost)) if (E.buyNode(s, n.id)) break; }
    if (st.id !== last) {
        if (last) console.log(`${String(Math.floor(since / 60)).padStart(3)}m  ${last.padEnd(18)} took ${((t - since) / 60).toFixed(1)}m${promised ? `, guide said ${(promised / 60).toFixed(1)}m` : ""}`);
        last = st.id; since = t; promised = st.eta;
    }
}
console.log(`end: step ${last} "${G.nextStep(s, E.derive(s)).title}" since ${(since / 60).toFixed(0)}m; zones ${E.MATS.filter((m) => E.isUnlocked(s, m)).length}`);
