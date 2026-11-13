// Shared setup for the Node Farm engine tests (node:test). Loads the real engine and every module that hooks itself into the tick.
// rigs.ts, scripts.ts and the others import "./engine" without an extension, so resolve that to .ts like the bundler does.
import { readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const E = await import(resolve(root, "lib/nodefarm/engine.ts"));
export const RG = await import(resolve(root, "lib/nodefarm/zones/rigs.ts"));
export const SC = await import(resolve(root, "lib/nodefarm/systems/scripts.ts"));
export const ZE = await import(resolve(root, "lib/nodefarm/zones/zoneevents.ts"));
export const ST = await import(resolve(root, "lib/nodefarm/systems/stress.ts"));
export const EV = await import(resolve(root, "lib/nodefarm/events.ts"));
export const AD = await import(resolve(root, "lib/nodefarm/systems/admin.ts"));
export const AR = await import(resolve(root, "lib/nodefarm/zones/arcs.ts"));
export const OFF = await import(resolve(root, "lib/nodefarm/offline.ts"));
export const { LOGS } = await import(resolve(root, "lib/nodefarm/content/story.ts"));

export const FIXTURES = resolve(root, "scripts/nodefarm/fixtures");
export const fixtureNames = () => readdirSync(FIXTURES).filter((f) => f.endsWith(".json")).sort();
export const fixtureRaw = (name) => readFileSync(resolve(FIXTURES, name), "utf8");
export const loadFixture = (name) => { const s = E.parseSave(fixtureRaw(name)); if (!s) throw new Error(`${name} does not load`); return s; };
export const clone = (s) => E.parseSave(JSON.stringify(s));

/** Every non-finite number anywhere in a value, as "path". Empty array = clean. */
export function nonFinite(v, path = "state", out = []) {
    if (typeof v === "number") { if (!Number.isFinite(v)) out.push(`${path}=${v}`); }
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) nonFinite(x, `${path}.${k}`, out);
    return out;
}
/** Resources that can never be below zero. Returns "path=value" for each that is. */
export function negatives(s) {
    const out = [];
    for (const k of ["bytes", "mult", "reboot", "ap", ...E.MATS]) if (s[k] < 0) out.push(`${k}=${s[k]}`);
    for (const k of E.MATS) if (s.prod[k] < 0) out.push(`prod.${k}=${s.prod[k]}`);
    for (const k of ["bytes", "reboots", "presses", "secs"]) if (s.life[k] < 0) out.push(`life.${k}=${s.life[k]}`);
    if (s.drones.some((x) => x < 0)) out.push("drones");
    if (s.hand.keys < 0) out.push(`hand.keys=${s.hand.keys}`);
    if (s.lab.intel < 0) out.push(`lab.intel=${s.lab.intel}`);
    return out;
}
export const problems = (s) => [...nonFinite(s), ...negatives(s)];

/** A greedy bot step (the same idea as scripts/nodefarm/sim.mjs): buy what is cheap, Reboot when it pays, drones, tree. */
const ORDER = [...E.MATS].reverse().concat("mult");
export function botStep(s, o = {}) {
    for (const st of ORDER) {
        if (!E.isUnlocked(s, st)) continue;
        for (let k = E.TIERS - 1; k >= 0; k--) {
            const b = E.button(s, st, k);
            if (E.amount(s, b.pays) >= b.cost * 4 || (st === "mult" && E.amount(s, b.pays) >= b.cost && k === 0)) { E.press(s, st, k); break; }
        }
    }
    if (E.isUnlocked(s, "reboot")) for (let k = E.TIERS - 1; k >= 0; k--) { const b = E.button(s, "reboot", k); if (s.mult >= b.cost * 1.3) { E.press(s, "reboot", k); break; } }
    if (E.dronesOpen(s)) for (let k = 0; k < E.TIERS; k++) if (s.aether >= E.droneCost(s, k) * 3) E.buyDrone(s, k);
    for (const r of RG.RIGS) for (const k of r.keys) { const p = RG.rigPrice(s, k.key); if (!p.maxed && E.amount(s, p.pays) >= p.cost * 4) RG.buyRig(s, k.key); }
    E.checkGoals(s);
    if (o.ascend && E.canAscend(s)) E.ascend(s);
    const next = E.TREE.filter((n) => !E.nodeMaxed(s, n) && E.nodeOpen(s, n)).sort((a, b) => E.nodeCost(s, a) - E.nodeCost(s, b))[0];
    if (next) E.buyNode(s, next.id);
}
/** Play `secs` seconds from state `s`: tick at `dt`, run the bot every 3 s, call `each(s, t)` after every tick. */
export function play(s, secs, { dt = 0.5, each, ascend = false } = {}) {
    let next = 0;
    for (let t = 0; t < secs; t += dt) {
        E.tick(s, dt);
        if (t >= next) { next = t + 3; botStep(s, { ascend }); }
        if (each) each(s, t);
    }
    return s;
}
/** A deep endgame state: everything bought, three Handovers' worth of progress, Origin running. Built from admin.maxOut. */
export function maxed() {
    const s = E.fresh(0);
    AD.maxOut(s);
    s.prod.origin = Math.max(s.prod.origin, 5);
    s.origin = Math.max(s.origin, 1e6);
    return s;
}
/** Deep-equal helper input: a save without its `at` stamp (exportSave writes the current time into it). */
export const noAt = (s) => { const c = JSON.parse(JSON.stringify(s)); delete c.at; return c; };
