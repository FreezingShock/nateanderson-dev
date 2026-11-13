// Away-time check for Node Farm. Builds five stage saves with a greedy bot (early, pre-Ascend, post-Ascend, post-Handover, endgame),
// then runs each stage through catch-up for 10 minutes, 1 hour, 8 hours and 24 hours and compares the result with the same time
// with the tab open (ticked in 1 s steps at the same Drone speed the away path uses). Also checks the report's numbers, NaN, and a
// save round trip. Lifetime totals are compared, not s.bytes (a sawtooth that every Reboot resets).
//   node --experimental-strip-types scripts/nodefarm/away-check.mjs [outdir]
// outdir (default: scratchpad-free ./away-check-out) gets report.json, report.md and the five stage saves.
import { registerHooks } from "node:module";
// Zone events and a few rolls use Math.random. A seeded generator makes runs repeat; the seed is set again before every compared run.
let seed = 1;
const seedRandom = (n) => { seed = n >>> 0; };
Math.random = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const E = await import("../../lib/nodefarm/engine.ts");
const RG = await import("../../lib/nodefarm/rigs.ts");
const ZE = await import("../../lib/nodefarm/zoneevents.ts");
const O = await import("../../lib/nodefarm/offline.ts");
const OUT = resolve(process.argv[2] || "away-check-out");
const STAGES_DIR = resolve(OUT, "stages");
mkdirSync(STAGES_DIR, { recursive: true });
const clone = (s) => JSON.parse(JSON.stringify(s));
const FULL = new Set(E.fullTreeIds());
const labOrder = [...E.LAB].sort((a, b) => a.cost - b.cost);
const order = [...E.MATS].reverse().concat("mult");
const MATS_BOT = ["chrono", "voidsteel", "starglass", "runes", "aether"];

// ---------- stage bot (same policy as scripts/nodefarm/sim.mjs, with the rigs, Lab and zone events in play, dt 1 s)
function botStages(log) {
    const s = E.fresh(0);
    s.armed = ["mult", ...E.MATS];
    const stages = {};
    const snap = (name, t) => { if (stages[name]) return; s.at = Date.now(); stages[name] = JSON.stringify(s); log(`stage ${name.padEnd(12)} at ${(t / 3600).toFixed(2)} h  ascends ${s.life.ascends}  hand ${s.hand.count}  tree ${s.tree.length}`); };
    const ascents = []; let t = 0, nextBuy = 0, labDone = false;
    const HANDS = 3;
    while (t < 200 * 3600 && !stages.endgame) {
        E.tick(s, 1);
        t += 1;
        if (t < nextBuy) continue;
        nextBuy = t + 3;
        if (t >= 1200) snap("early", t);
        for (const st of order) {
            if (!E.isUnlocked(s, st)) continue;
            for (let k = E.TIERS - 1; k >= 0; k--) {
                const b = E.button(s, st, k);
                if (E.amount(s, b.pays) >= b.cost * 4 || (st === "mult" && E.amount(s, b.pays) >= b.cost && k === 0)) { E.press(s, st, k); break; }
            }
        }
        if (E.isUnlocked(s, "reboot")) for (let k = E.TIERS - 1; k >= 0; k--) {
            const b = E.button(s, "reboot", k);
            if (s.mult >= b.cost && (s.mult >= b.cost * 1.3 || t - (s.__lastRb ?? 0) > 900)) { E.press(s, "reboot", k); s.__lastRb = t; break; }
        }
        if (E.isUnlocked(s, "voidsteel")) RG.setRig(s, "draw", 0.1);
        for (const d of RG.RIGS) for (const k of d.keys) { const p = RG.rigPrice(s, k.key); if (!p.maxed && E.amount(s, p.pays) >= p.cost * 4) RG.buyRig(s, k.key); }
        if (E.isUnlocked(s, "origin") && s.origin >= RG.rewritePrice(s) * 4) { const z = RG.RIGS.find((d) => d.zone !== "origin" && (RG.rig(s).re[d.zone] ?? 0) < 3); if (z) RG.rewrite(s, z.zone); }
        if (E.dronesOpen(s)) for (let k = 0; k < E.TIERS; k++) if (s.aether >= E.droneCost(s, k) * 3) E.buyDrone(s, k);
        if (s.drones.some((x) => x > 0)) {
            if (t % 120 < 3) {
                const open = E.POSTABLE.filter((st) => E.isUnlocked(s, st)).sort((a, b) => E.zoneRank(s, a) - E.zoneRank(s, b) || E.POSTABLE.indexOf(b) - E.POSTABLE.indexOf(a));
                for (let k = 0; k < E.TIERS; k++) E.setPost(s, k, s.drones[k] > 0 ? open[k % open.length] ?? null : null);
            }
            for (let more = true; more;) {
                more = false; let best = null;
                for (let k = 0; k < E.TIERS; k++) for (let m = 0; m < E.MOD_COUNT; m++) if (!E.modBlock(s, k, m)) { const c = E.modCost(s, k, m); if (!best || c < best[2]) best = [k, m, c]; }
                if (best && E.buyMod(s, best[0], best[1])) more = true;
            }
            for (const n of [...E.DRONE_TREE].sort((a, b) => a.cost - b.cost)) E.buyDroneNode(s, n.id);
        }
        E.checkGoals(s);
        if (s.ze) for (const e of [...s.ze.act]) { if (e.kind === "vein") ZE.zeChoose(s, e.id, "mine"); else if (e.kind === "fault") ZE.zeChoose(s, e.id, "patch"); }
        if (E.canAscend(s) && !stages.preAscend) snap("preAscend", t);
        if (E.canAscend(s)) {
            const gain = E.apOnAscend(s);
            const last = ascents.length ? ascents[ascents.length - 1] : [0, 0];
            const gapOk = t - last[0] >= 3600;
            if (gapOk && ((s.life.ascends === 0 && gain >= 2) || gain >= last[1] * 1.4 || t - last[0] > 3600 * (s.tree.length >= 40 ? 3 : 60))) {
                E.ascend(s); ascents.push([t, gain, s.ap]);
                if (s.life.ascends === 1) { s.__postAsc = t; }
            }
        }
        if (s.__postAsc && t >= s.__postAsc + 3600) snap("postAscend", t);
        for (let more = true; more;) {
            more = false;
            const next = E.TREE.filter((n) => FULL.has(n.id) && !E.nodeMaxed(s, n) && E.nodeOpen(s, n)).sort((a, b) => E.nodeCost(s, a) - E.nodeCost(s, b))[0];
            if (next && E.buyNode(s, next.id)) more = true;
        }
        if (s.lab.seen) {
            for (const n of labOrder) if (!s.lab.nodes.includes(n.id)) E.buyLabNode(s, n.id);
            for (const p of E.PAYLOADS) if ((s.lab.stock[p.id] ?? 0) < 2) E.compile(s, p.id);
            for (const p of E.PAYLOADS) {
                if ((s.lab.stock[p.id] ?? 0) < 1) continue;
                if (p.kind === "buff" && !E.isRunning(s, p.id)) E.deploy(s, p.id);
                else if (p.kind === "charge" && !E.isArmed(s, p.id)) E.deploy(s, p.id);
                else if (p.id === "ransom" || p.id === "trojan") E.deploy(s, p.id);
            }
        }
        const mats = MATS_BOT.filter((m) => s.prod[m] > 0).slice(0, E.mountSlots(s));
        mats.forEach((m, i) => E.setMount(s, i, m));
        E.openDrop(s, t * 1000);
        if (s.ap > 40) { while (E.buyPerk(s, "power")); }
        if (E.treeComplete(s) && E.handOpen(s) && s.hand.count < HANDS) {
            E.handover(s, "wren", "", "osk");
            if (s.hand.count === 1 && !s.__h1) s.__h1 = t;
            if (s.hand.count === HANDS) s.__h3 = t;
            for (let more = true; more;) {
                more = false;
                const next = E.FW.filter((n) => !s.hand.fw.includes(n.id) && E.fwNodeOpen(s, n)).sort((a, b) => a.cost - b.cost)[0];
                if (next && E.buyFw(s, next.id)) more = true;
            }
            ascents.length = 0;
            continue;
        }
        if (s.__h1 && t >= s.__h1 + 1800) snap("postHandover", t);
        if (s.__h3 && t >= s.__h3 + 1800) snap("endgame", t);
    }
    // a stage the bot never reached is reported, not invented
    for (const n of ["early", "preAscend", "postAscend", "postHandover", "endgame"]) if (!stages[n]) log(`stage ${n} NOT reached`);
    return stages;
}

// ---------- helpers
const eff = (s) => (E.handFx(s).standby ? 1 : Math.min(1, E.TUNE.drone.offline + E.treeFx(s).droneOff + E.droneFx(s).off));
const life = (s) => ({ bytes: s.life.bytes, presses: s.life.presses, reboots: s.life.reboots, intel: s.life.intel ?? 0, mats: Object.fromEntries(E.MATS.map((m) => [m, s[m]])) });
const scan = (v, path = "$", out = []) => {
    if (typeof v === "number" && !Number.isFinite(v)) out.push(`${path}=${v}`);
    else if (v && typeof v === "object") for (const k of Object.keys(v)) scan(v[k], `${path}.${k}`, out);
    return out;
};
const rel = (a, b) => (b === 0 ? (a === 0 ? 0 : Infinity) : Math.abs(a - b) / Math.abs(b));
const DURS = [["10 min", 600], ["1 h", 3600], ["8 h", 8 * 3600], ["24 h", 24 * 3600]];
const TAB_STEP = Number(process.env.AWAY_TAB_STEP || 1); // pass B reference step
const REF_DT = Number(process.env.AWAY_REF_DT || 0.25); // pass A reference step (the live game ticks at 0.1 s; 0.25 converges within 0.3% here)

function tabOpen(s, secs, speed, step = TAB_STEP) {
    // the same time with the tab open: tick in steps, at the same Drone speed (speed) or at full speed (1)
    for (let t = 0; t < secs - 1e-9; t += step) E.tick(s, Math.min(step, secs - t), speed);
    return s;
}

// ---------- run
const log = (m) => console.log(m);
let stages;
const cached = ["early", "preAscend", "postAscend", "postHandover", "endgame"].every((n) => existsSync(resolve(STAGES_DIR, `${n}.json`)));
if (cached && !process.env.AWAY_REBUILD) {
    stages = Object.fromEntries(["early", "preAscend", "postAscend", "postHandover", "endgame"].map((n) => [n, readFileSync(resolve(STAGES_DIR, `${n}.json`), "utf8")]));
    log("stages loaded from " + STAGES_DIR);
} else {
    const t0 = Date.now();
    stages = botStages(log);
    for (const [n, txt] of Object.entries(stages)) writeFileSync(resolve(STAGES_DIR, `${n}.json`), txt);
    log(`stages built in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

const results = [];
const problems = [];
// Pass A: zone events off (ZE_TUNE.gap huge), so the away path and the tab-open path see the same game. Compared against the tab
// ticked at REF_DT, the live game's own tick is 0.1 s. Pass B: zone events on, three seeds for the tab, one for the away path.
const ZT = E.ZE_TUNE ?? ZE.ZE_TUNE;
const GAP_KEEP = [...ZT.gap];
for (const [name, text] of Object.entries(stages)) {
    if (!text) continue;
    for (const [label, secs] of DURS) {
        const t0 = Date.now();
        // ---- pass A
        ZT.gap = [1e12, 1e12];
        const s = E.parseSave(text);
        s.life.bytes = 0; // a counter near 1e43 cannot show a few thousand Bytes in a double; zeroed in every copy so the delta is exact
        const before = life(s);
        const e0 = eff(s);
        seedRandom(7);
        const r = O.catchUp(s, secs);
        const after = life(s);
        // each reference starts from the same seed as the away run, so zone events roll the same way (without this, a one-hour
        // comparison measured the random stream, not the step size)
        seedRandom(7);
        const ref = E.parseSave(text); ref.life.bytes = 0;
        tabOpen(ref, r.secs, e0, REF_DT);
        seedRandom(7);
        const refFull = E.parseSave(text); refFull.life.bytes = 0;
        tabOpen(refFull, r.secs, 1, REF_DT);
        const rb = life(ref), rf = life(refFull);
        const rec = {
            stage: name, away: label, banked: r.secs, capped: r.capped, cap: E.derive(s).offlineCap, drone_speed_away: e0,
            life_bytes: after.bytes - before.bytes,
            report_bytes: r.gain.bytes ?? 0,
            presses: after.presses - before.presses,
            reboots: after.reboots - before.reboots,
            report_drones: r.drones,
            sys: r.sys.map((g) => ({ id: g.id, title: g.title, lines: g.lines })),
            nan: scan(s),
        };
        rec.dev_bytes_pct = +(100 * (rec.life_bytes - (rb.bytes)) / Math.max(1, rb.bytes)).toFixed(3);
        rec.dev_presses_pct = +(100 * (rec.presses - (rb.presses - before.presses)) / Math.max(1, rb.presses - before.presses)).toFixed(3);
        rec.full_speed_bytes = rf.bytes;
        rec.drone_cost_pct = rf.bytes > 0 ? +(100 * (rf.bytes - rb.bytes) / rf.bytes).toFixed(2) : 0;
        rec.report_vs_life_pct = rec.life_bytes > 0 ? +(100 * (rec.report_bytes - rec.life_bytes) / rec.life_bytes).toFixed(1) : null;
        rec.mat_dev = E.MATS.map((m) => { const a = after.mats[m] - before.mats[m]; const b = rb.mats[m] - before.mats[m]; return [m, a, b]; })
            .filter(([, a, b]) => Math.abs(a) > 1e-9 || Math.abs(b) > 1e-9)
            .map(([m, a, b]) => ({ m, dev: +(100 * (a - b) / Math.max(1e-300, Math.abs(b))).toFixed(3) }))
            .filter((x) => Math.abs(x.dev) > 1)
            .slice(0, 4);
        // ---- pass B: zone events on
        ZT.gap = GAP_KEEP;
        const refs = [];
        for (const sd of [11, 12, 13]) { seedRandom(sd); const x = E.parseSave(text); x.life.bytes = 0; tabOpen(x, r.secs, e0, REF_DT); refs.push(x.life.bytes); }
        seedRandom(11);
        const sb = E.parseSave(text); sb.life.bytes = 0; const bb = sb.life.bytes;
        O.catchUp(sb, secs);
        rec.events_on = { away_bytes: sb.life.bytes, tab_min: Math.min(...refs), tab_max: Math.max(...refs), tab_mean: refs.reduce((a, b) => a + b, 0) / refs.length };
        rec.events_on.dev_pct = +(100 * (sb.life.bytes - rec.events_on.tab_mean) / Math.max(1, rec.events_on.tab_mean)).toFixed(2);
        rec.ms = Date.now() - t0;
        results.push(rec);
        const flag = rec.nan.length ? " NAN" : "";
        log(`${name.padEnd(13)} ${label.padEnd(7)} banked ${(r.secs / 3600).toFixed(2)}h  A: bytes ${rec.dev_bytes_pct}%  presses ${rec.dev_presses_pct}%  report/life ${rec.report_vs_life_pct}%  reboots ${rec.reboots}  | B (events on): ${rec.events_on.dev_pct}% vs tab mean${flag}  ${rec.ms}ms`);
        if (rec.nan.length) problems.push(`${name} ${label}: non-finite values ${rec.nan.slice(0, 5).join(", ")}`);
        if (Math.abs(rec.dev_bytes_pct) > 1.5) problems.push(`${name} ${label}: away Bytes differ from tab-open at the same Drone speed by ${rec.dev_bytes_pct}% (zone events off)`);
        if (Math.abs(rec.dev_presses_pct) > 1.5 && rec.presses > 0) problems.push(`${name} ${label}: away presses differ by ${rec.dev_presses_pct}%`);
        if (rec.report_vs_life_pct !== null && Math.abs(rec.report_vs_life_pct) > 1) problems.push(`${name} ${label}: standby report shows ${rec.report_bytes.toExponential(3)} Bytes, the life counter moved ${rec.life_bytes.toExponential(3)} (${rec.report_vs_life_pct}%)`);
        const rt = E.parseSave(JSON.stringify(s));
        if (!rt || rt.life.bytes !== s.life.bytes) problems.push(`${name} ${label}: save round trip changed life bytes`);
    }
}
writeFileSync(resolve(OUT, "report.json"), JSON.stringify({ results, problems }, null, 2));
log("problems:" + (problems.length ? "\n  " + problems.join("\n  ") : " none"));
