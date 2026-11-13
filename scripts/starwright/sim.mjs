// Balance sim for Starwright. A simple bot plays the game at 1 s steps and prints when each landmark happens.
// Run: node --experimental-strip-types --no-warnings scripts/starwright/sim.mjs [hours]
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const E = await import(resolve(root, "lib/starwright/engine.ts"));
const D = await import(resolve(root, "lib/starwright/data.ts"));

const hours = Number(process.argv[2] ?? 12);
const s = E.fresh(0);
const log = [];
const t0 = () => (s._t ?? 0);
s._t = 0;
const mark = (m) => log.push(`${(s._t / 3600).toFixed(2).padStart(6)} h  ${m}`);
let lastNova = 0;
while (s._t < hours * 3600) {
    s._t += 1;
    let f = E.effects(s);
    E.step(s, 1, f);
    // spend: higher rows first, biggest tier that costs under 45% of the stock
    for (let i = D.ROWS - 1; i >= 0; i--) {
        if (!E.rowOpen(s, i)) continue;
        for (let k = D.TIERS - 1; k >= 0; k--) {
            let n = 0;
            while (n++ < 30 && E.cost(s, i, k) <= s.amt[i] * 0.45) E.buy(s, i, k);
        }
    }
    // planets
    for (const p of D.PLANETS) if (E.canPlanet(s, p.id) && p.cost.every(([e, q]) => s.amt[e] >= q * 1.5)) { E.buyPlanet(s, p.id) }
    f = E.effects(s);
    if (E.canSupernova(s, f) && (s.neutronStars === 0 || s._t - lastNova > 5400) && (E.collapse(s, f) >= 1.2 || s._t - lastNova > 1500)) {
        const g = E.supernova(s);
        mark(`supernova #${s.novasAll}: +${g} stardust (age ${E.fmtAge(s._t - lastNova)})`);
        lastNova = s._t;
        let again = true;
        while (again) {
            again = false;
            const opts = D.PERKS.filter((p) => E.perkReady(D.PERKS, s.perks, p) && p.cost <= s.stardust).sort((a, b) => a.cost - b.cost);
            if (opts[0]) { E.buyPerk(s, opts[0].id); again = true; }
        }
    }
    if (s.neutronStars === 0 && E.canNeutron(s) && s.perks.length >= 18 && E.collapse(s, f) >= 1) { const g = E.neutronStar(s); mark(`NEUTRON STAR #${s.neutronStars}: +${g} neutrons`); }
    if (s.neutrons > 0) for (const p of D.PULSAR_PERKS) if (E.perkReady(D.PULSAR_PERKS, s.pulsar, p) && p.cost <= s.neutrons) E.buyPulsar(s, p.id);
    if (E.canBlackHole(s, f)) { E.blackHole(s); mark(`BLACK HOLE (singularities ${s.sing})`); break; }
    if (s._t % 1800 === 0 && s.neutronStars > 0) mark(`  heat ${E.fmtHeat(s.heat)} amt ${s.amt.map((x)=>E.fmt(x,1)).join(" ")} lvl ${[...Array(9).keys()].map((i)=>E.levels(s,i)).join(" ")}`)
}
console.log(log.join("\n"));
