// Shared fixture for the reset checks (scripts/nodefarm/reset-audit.mjs and reset-browser.mjs): loads the engine and the
// modules that fill its hooks the way the game does, and builds a save with something in every field.
import { registerHooks } from "node:module";
registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });

export const NOW = 1_700_000_000_000;

export async function loadEngine() {
    const E = await import("../../lib/nodefarm/engine.ts");
    // importing these fills the engine hooks (rig, stress, zone event, script, arc and poke rules) the same way the game does
    const R = await import("../../lib/nodefarm/zones/rigs.ts");
    const ST = await import("../../lib/nodefarm/systems/stress.ts");
    await import("../../lib/nodefarm/zones/zoneevents.ts");
    await import("../../lib/nodefarm/systems/scripts.ts");
    await import("../../lib/nodefarm/zones/arcs.ts");
    await import("../../lib/nodefarm/poke.ts");
    return { E, R, ST };
}

// ---- a save with something in every field
export function richSave(E, R) {
    const s = E.fresh(NOW);
    s.at = NOW;
    s.started = NOW - 9e6;
    s.life = { ...s.life, secs: 4 * 3600, bytes: 9e9, taps: 120, reboots: 40, ascends: 3, intrusions: 2, presses: 900, capped: 0, peakBps: 500, apTotal: 60, intel: 300, compiled: 4, deployed: 3 };
    s.reboot = 40; s.bytes = 1234; s.mult = 55;
    for (const m of E.MATS) { s[m] = 1000; s.prod[m] = 5; }
    s.aether = 9000; s.prod.origin = 3; s.origin = 800; s.engrams = 50; s.bloom = 20;
    for (const k of Object.keys(s.bought)) s.bought[k] = [3, 2, 1, 0, 0, 0];
    s.ap = 40;
    s.perks = { scanner: 2, overclock: 1, offline: 1, start: 1, power: 1 }; // no Autoloader: the perk was removed (migrateAutomation refunds old saves)
    s.ach = ["goal_first", "secret_x"]; s.achAt = { goal_first: NOW - 5e6, secret_x: NOW - 1e6 };
    s.logs = ["log_1", "log_2"];
    s.drones = [2, 1, 0, 0, 0, 0]; s.droneAcc = [0.4, 0, 0, 0, 0, 0];
    s.armed = ["mult", "copper"];
    const ranked = E.TREE.find((n) => n.ranks);
    s.tree = [...E.fullTreeIds().slice(0, 12), ranked.id];
    s.treeLv = { [ranked.id]: 2 };
    s.mounts = ["copper"];
    s.watchdog = false; s.dropAt = NOW - 1000; s.runWins = 3; s.autoArmed = ["copper"];
    s.frenzy = 30; s.overclock = 100; s.rebootAt = 3000;
    s.seen = { copper: 0b111, reboot: 0b1, mult: 0b11 };
    const lab = E.LAB.filter((n) => n.links.includes("core"));
    s.lab = { ...E.freshLab(), seen: true, intel: 300, nodes: [E.LAB[0].id, E.LAB[1].id, E.LAB[2].id], stock: { sniffer: 2 }, queue: [{ id: "worm", left: 20 }], run: [{ id: "sniffer", left: 30 }], armed: ["logicbomb"], last: "sniffer", dump: 5 };
    void lab;
    s.dr = { ...E.freshDr(), post: ["copper", null, null, null, null, null], svc: { copper: 50 }, parts: 300, mods: Array.from({ length: E.TIERS }, () => Array(E.MOD_COUNT).fill(1)), nodes: [E.DRONE_TREE[0].id], pacc: [0.2, 0, 0, 0, 0, 0], racc: [0, 0, 0, 0, 0, 0] };
    s.hand = { ...E.freshHand(), keys: 40, fw: [E.FW.find((n) => n.entry)?.id ?? E.FW[0].id], proto: "wren", proto2: null, count: 2, keysTotal: 60, cycleAp: 12, cycleAt: 2000, notes: [{ n: 1, text: "left a note", at: NOW, proto: "wren" }], rank: { wren: 1 } };
    s.ch = { done: { brownout: 1, thin: 2 }, run: null, tries: 2, news: [], last: null };
    s.rig = { ...R.freshRig(), lv: { copper: 3, silicon: 2 }, re: { copper: 1 }, rw: 2, scrub: false, aim: "silicon", seeds: 4, cache: 50, wear: 2, well: 3, dust: 2, pulses: 4 };
    s.ze = { act: [{ id: 7, kind: "surge", zone: "copper", left: 30, total: 150, picked: false }], wait: 100, seen: 5, kinds: { surge: 3 }, last: "copper", log: [{ kind: "surge", zone: "copper", at: 1000 }] };
    s.poke = { c: [{ id: 1, z: "copper", x: 0.5 }], next: 30, vent: 10, got: 3, vents: 1, n: 1 };
    s.auto = { taught: { copper: [1, 1, 0, 0, 0, 0] }, learn: { buy: 3 }, own: ["buy", "reboot"], on: { buy: true }, buy: { copper: 3 }, keep: 1, rebootX: 2, stockTo: {}, dep: [], ascX: 1.5, lastAp: 4, runAt: 0, seenAsc: 3, seenAp: 10, acc: {}, ran: { reboot: 4 }, presses: 7 };
    return s;
}

