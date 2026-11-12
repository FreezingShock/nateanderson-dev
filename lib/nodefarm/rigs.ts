// Node Farm zone rigs: one machine per zone, so the seventeen zones stop playing the same. Each rig has a meter, one rule and
// a level track bought with minutes of the zone's own output (Bytes for the first three zones). Everything runs while you
// are idle; the few choices are switches you set once. Rules are pure (no React); importing this file fills the engine's
// RIG_HOOKS. The panel is components/nodefarm/rig.tsx. See docs/node-farm.md "Zone rigs".
//
// Adding a zone: add a RIGS entry, and a case in muls() and/or step() if the rig changes output or runs on a clock.
// Keep every boost to its own zone or a named neighbour, and never a power-law boost on everything.
import {
    MATS, RIG_HOOKS, STATS, TUNE, derive, isUnlocked, overclockMult, overclockSecs, sinceReboot,
    type Derived, type MatId, type RigState, type State, type StatId,
} from "./engine";

export const RIG_TUNE = {
    /** minutes of the zone's own output each level costs, by the level you are buying (index 0 buys level 1) */
    minutes: [2, 6, 15, 40, 100, 240, 600, 1500],
    baseCap: 5,
    /** Root chamber: extra levels a rewrite can add per rig, and its price in minutes of Origin output */
    rewriteMax: 3,
    rewriteMins: 20,
    rewriteGrowth: 1.2,
    // 01 Packet cache
    cacheFill: 0.05, cacheFillLv: 0.02, cacheSecs: 60, cacheSecsLv: 30,
    // 02 Gain staging
    stage: 0.015, stageLv: 0.005,
    // 03 Capacitor
    capSecs: 300, capSecsLv: 0.08, capPay: 0.2, capPayLv: 0.04,
    // 04 Batch pour
    pourSecs: 60, pourLv: 0.06, pourPays: 15, castEach: 0.0075, casts: 25, castsLv: 5,
    // 05 Air scrubbers (real drain: full dust takes Silicon down to dustFloor of its rate)
    dustUp: 600, dustDown: 120, dustFloor: 0.6, scrubBonus: 0.15, scrubBonusLv: 0.04, burn: 0.1, burnLv: 0.012,
    // 06 Crystal growth: minutes of running Quartz to reach each stage
    growMins: [5, 15, 35, 70, 120], growLv: 0.08, growEach: 0.06, growEachLv: 0.015,
    // 07 Afterglow
    glowK: 0.25, glowKLv: 0.07, glowMax: 4, glowMins: 10, glowMinsLv: 4,
    // 08 Carvings
    glyph: 0.05,
    // 09 Prism beam
    prism: 0.05, prismLv: 0.015, prismMax: 4,
    // 10 Void draw
    draws: [0, 0.1, 0.25], drawK: 1, drawKLv: 0.2,
    // 11 Stillness: minutes without a press of your own to reach the full boost
    stillMins: 20, stillLv: 0.15, stillMax: 1,
    // 12 Weather: one cycle, storm minutes, storm boost
    wxMins: 12, stormMins: 3, stormLv: 0.6, storm: 1.5, front: 3,
    // 13 Beacon
    pulseSecs: 30, pulseLv: 0.06, pulsesPer: 40,
    // 14 Gravity well
    well: 0.025, wellLv: 0.008,
    // 15 Index
    index: 0.005, indexLv: 0.002,
    // 16 Mirror
    mirror: 0.1, mirrorLv: 0.025, mirrorMax: 4,
    // 18 Spread: per material zone running this run
    spread: 0.01, spreadLv: 0.004,
    // 19 Knots: per Spores or Mycelium tier owned this run (12 knots, all tied doubles it)
    knot: 0.015, knotLv: 0.005,
    // 20 Daylight: one cycle, night minutes, day boost to Pollen, night drag on Pollen, night boost to Spores and Mycelium
    sunMins: 10, nightMins: 4, day: 1.4, dayLv: 0.06, night: 0.8, nightGrow: 1.3,
    // 21 Seed bank: seeds banked per tenfold Bloom at Ascend, bank size, boost per seed
    seedMax: 30, seedMaxLv: 6, seed: 0.02,
    // 22 Drill bit (real drain: a worn bit takes Basalt down to wearFloor of its rate)
    wearUp: 1200, wearDown: 180, wearFloor: 0.5, coolBonus: 0.1, coolBonusLv: 0.03, coolBurn: 0.12, coolBurnLv: 0.015,
    // 23 Eruptions: pressure clock, seconds of Magma each pays, shaft heat (Basalt boost) and how long it lasts
    ventSecs: 180, ventLv: 0.06, ventPays: 20, heat: 1.5, heatSecs: 60, heatSecsLv: 10,
    // 24 Ringing: Geodes grow with the Quartz you hold (log), capped
    ring: 0.04, ringLv: 0.012, ringMax: 3,
    // 25 Convection: per rig level owned across zones 18 to 24
    conv: 0.01, convLv: 0.003,
};
const T = RIG_TUNE;

export type RigKind = "carry" | "set" | "timing" | "cycle" | "hazard" | "growth" | "shop" | "aim" | "link" | "idle" | "collection" | "catch-up" | "meta";
export interface RigDef {
    zone: StatId;
    name: string;
    kind: RigKind;
    /** one line: what the rig does */
    rule: string;
    /** what a level does, for the upgrade line */
    perLv: string;
    /** level keys (most rigs have one, the zone id; the Glyph hall has three) */
    keys: { key: string; name: string; perLv: string }[];
}
const R = (zone: StatId, name: string, kind: RigKind, rule: string, perLv: string): RigDef => ({ zone, name, kind, rule, perLv, keys: zone === "origin" ? [] : [{ key: zone, name, perLv }] });

export const RIGS: RigDef[] = [
    R("bytes", "Packet cache", "carry", "A slice of every Byte earned fills a cache that survives Reboot. Each Reboot pours it back into Bytes.", "fills faster and holds 30 s more output"),
    R("mult", "Gain staging", "set", "Each Multiplier tier you own this Reboot lights a stage and makes Multiplier buttons stronger. All six lit doubles it.", "+0.5% per lit stage"),
    R("reboot", "Capacitor", "timing", "Charges while you wait between Reboots. The next Reboot spends the charge for extra Reboots.", "charges 8% faster and pays 4% more"),
    R("copper", "Batch pour", "cycle", "The mould fills on its own clock. Each pour pays a lump of Copper and adds a cast, and every cast raises Copper output this run.", "pours 6% sooner and holds 5 more casts"),
    R("silicon", "Air scrubbers", "hazard", "Dust settles while the scrubbers are off and drags Silicon down to 60%. Scrubbers clear it and add a bonus, but burn a share of Copper.", "+4% clean bonus and 1.2% less Copper burned"),
    R("quartz", "Crystal growth", "growth", "Crystals grow while Quartz runs: shard, crystal, cluster, geode, cavern. Each stage multiplies Quartz until you Ascend.", "grows 8% faster, +1.5% per stage"),
    R("aether", "Afterglow", "carry", "Aether past what Ascend needs is kept as Afterglow, which speeds Copper, Silicon and Quartz at the start of the next run.", "stronger glow that lasts 4 min longer"),
    { zone: "runes", name: "Carvings", kind: "shop", rule: "Spend Runes on three glyphs. Echo strengthens Aether, Ward strengthens Runes, Root strengthens Quartz.", perLv: "+5% to its zone",
      keys: [{ key: "runes:echo", name: "Echo", perLv: "+5% Aether" }, { key: "runes:ward", name: "Ward", perLv: "+5% Runes" }, { key: "runes:root", name: "Root", perLv: "+5% Quartz" }] },
    R("starglass", "Prism beam", "aim", "Aim the beam at any zone below. That zone gets a boost that grows with the Starglass you hold.", "a brighter beam"),
    R("voidsteel", "Void draw", "link", "Siphon part of Starglass output into the forge. The more you draw, the more Voidsteel comes out.", "each siphoned share pays 20% more"),
    R("chrono", "Stillness", "idle", "Chrono runs faster the longer you go without pressing a button yourself, up to ×2. Drones and scripts don't break it.", "reaches full stillness 15% sooner"),
    R("nebula", "Weather", "cycle", "Clear skies, a front, then a storm, on a 12 minute clock. Storms add half again to Nebula; fronts thin it.", "storms last 36 s longer"),
    R("pulsars", "Beacon", "link", "The spire pulses on a steady clock. Every 40 pulses fires a free Overclock.", "pulses 6% faster"),
    R("singularity", "Gravity well", "link", "Every material button pressed this run, by anyone, drops mass into the well. Mass strengthens Singularity.", "+0.8% per tenfold mass"),
    R("engrams", "Index", "collection", "Every goal, secret and story log you own is filed here, and each one strengthens Engrams.", "+0.2% per filed record"),
    R("paradox", "Mirror", "catch-up", "The material zone furthest behind is mirrored: it gets a boost that grows with the Paradox you hold.", "a stronger reflection"),
    R("spores", "Spread", "collection", "Spores drift into every zone that is running. Each material zone with producers this run strengthens Spores.", "+0.4% per running zone"),
    R("mycelium", "Knots", "set", "Each Spores and Mycelium tier you own this run ties a knot in the web. Each knot strengthens Mycelium, and all twelve double it.", "+0.5% per knot"),
    R("pollen", "Daylight", "cycle", "Day and night on a 10 minute clock. Days lift Pollen; nights slow it but feed Spores and Mycelium below.", "brighter days, +6% Pollen"),
    R("bloom", "Seed bank", "carry", "Every Ascend banks seeds from the Bloom you hold, one per tenfold. Seeds stay through Ascend and each one strengthens Bloom.", "the bank holds 6 more seeds"),
    R("basalt", "Drill bit", "hazard", "The bit wears while Basalt runs and a worn bit drags Basalt down to 50%. Coolant clears the wear and adds a bonus, but burns a share of Bloom.", "+3% cool bonus and 1.5% less Bloom burned"),
    R("magma", "Eruptions", "timing", "Pressure builds on its own clock. Each eruption pays a lump of Magma and heats the shaft above, so Basalt runs at ×1.5 for a minute.", "erupts 6% sooner and heat lasts 10 s longer"),
    R("geodes", "Ringing", "link", "The vault rings with the Crystal vault far above. Geodes grow with the Quartz you hold, up to ×3.", "a louder ring"),
    R("core", "Convection", "meta", "Heat rises through the arc. Every rig level owned in zones 18 to 24 strengthens the core.", "+0.3% per level below"),
    R("origin", "Rewrite", "meta", "Spend Origin to rewrite another zone's rig. Each rewrite raises that rig's level cap by one, up to three, forever.", ""),
];
export const RIG_BY = new Map(RIGS.map((r) => [r.zone, r]));
export const rigDef = (id: StatId) => RIG_BY.get(id);
const KEY_ZONE = new Map(RIGS.flatMap((r) => r.keys.map((k) => [k.key, r.zone] as const)));

export function freshRig(): RigState {
    return { lv: {}, re: {}, rw: 0, scrub: true, aim: "copper", draw: 0, rwAim: "bytes", cool: true, seeds: 0, cache: 0, quiet: 0, pour: 0, casts: 0, dust: 0, grow: 0, glow: 0, glowLeft: 0, wx: 0, pulse: 0, pulses: 0, fired: 0, well: 0, sun: 0, wear: 0, vent: 0, heat: 0 };
}
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
/** The rig state, made or repaired on first use (old saves have none). */
export function rig(s: State): RigState {
    const x = s.rig as Partial<RigState> | undefined;
    if (x && checked.has(x)) return x as RigState;
    const b = freshRig();
    const o = (x && typeof x === "object" ? x : {}) as Partial<RigState>;
    const rec = (v: unknown) => Object.fromEntries(Object.entries(v && typeof v === "object" ? v : {}).filter(([, n]) => num(n) > 0).map(([k, n]) => [k, Math.floor(num(n))]));
    const r: RigState = {
        ...b,
        lv: rec(o.lv), re: rec(o.re), rw: Math.max(0, Math.floor(num(o.rw))),
        scrub: typeof o.scrub === "boolean" ? o.scrub : true,
        aim: typeof o.aim === "string" && PRISM_AIMS.includes(o.aim as StatId) ? o.aim : b.aim,
        draw: T.draws.includes(num(o.draw)) ? num(o.draw) : 0,
        rwAim: typeof o.rwAim === "string" && RIG_BY.has(o.rwAim as StatId) && o.rwAim !== "origin" ? o.rwAim : b.rwAim,
        cool: typeof o.cool === "boolean" ? o.cool : true,
    };
    for (const k of ["cache", "quiet", "pour", "casts", "dust", "grow", "glow", "glowLeft", "wx", "pulse", "pulses", "fired", "well", "seeds", "sun", "wear", "vent", "heat"] as const) r[k] = Math.max(0, num(o[k]));
    r.dust = Math.min(1, r.dust);
    r.wear = Math.min(1, r.wear ?? 0);
    s.rig = r;
    checked.add(r);
    return r;
}
const checked = new WeakSet<object>();

export const PRISM_AIMS: StatId[] = ["bytes", "copper", "silicon", "quartz", "aether", "runes"];
const zoneName = (id: string) => STATS.find((x) => x.id === id)?.name ?? id;
export const zoneNo = (id: StatId) => String(STATS.findIndex((x) => x.id === id) + 1).padStart(2, "0");

// ---- levels and prices
export const rigCap = (s: State, zone: StatId) => T.baseCap + Math.min(T.rewriteMax, rig(s).re[zone] ?? 0);
export const rigLv = (s: State, key: string) => rig(s).lv[key] ?? 0;
/** The zone's level for its rule (the Glyph hall uses its three keys separately). */
const L = (s: State, zone: StatId) => rigLv(s, zone);
export const rigOpen = (s: State, zone: StatId) => isUnlocked(s, zone);
/** What the rig's prices are paid in. */
export const rigPays = (zone: StatId): StatId => (zone === "bytes" || zone === "mult" || zone === "reboot" ? "bytes" : zone);
/** Output per second of a stat without any Overclock (so prices don't jump during one). */
function baseRate(s: State, id: StatId, d = derive(s)): number {
    const oc = s.overclock > 0 ? overclockMult(s) : 1;
    if (id === "bytes") return d.bytesPerSec / oc;
    return (MATS as readonly string[]).includes(id) ? d.rates[id as MatId] / oc : 0;
}
export function rigPrice(s: State, key: string, d?: Derived): { pays: StatId; cost: number; maxed: boolean } {
    const zone = KEY_ZONE.get(key)!;
    const lv = rigLv(s, key);
    const pays = rigPays(zone);
    const maxed = lv >= rigCap(s, zone);
    const rate = baseRate(s, pays, d);
    const cost = rate > 0 ? rate * 60 * T.minutes[Math.min(lv, T.minutes.length - 1)] : Infinity;
    return { pays, cost, maxed };
}
export function buyRig(s: State, key: string): boolean {
    const zone = KEY_ZONE.get(key);
    if (!zone || !rigOpen(s, zone)) return false;
    const p = rigPrice(s, key);
    if (p.maxed || !Number.isFinite(p.cost) || (s[p.pays] as number) < p.cost) return false;
    (s[p.pays] as number) -= p.cost;
    const r = rig(s);
    r.lv[key] = (r.lv[key] ?? 0) + 1;
    return true;
}
export function rewritePrice(s: State, d?: Derived) {
    const rate = baseRate(s, "origin", d);
    return rate > 0 ? rate * 60 * T.rewriteMins * Math.pow(T.rewriteGrowth, rig(s).rw) : Infinity;
}
export function rewrite(s: State, zone?: StatId): boolean {
    const r = rig(s);
    const z = (zone ?? r.rwAim) as StatId;
    if (!rigOpen(s, "origin") || z === "origin" || !RIG_BY.has(z) || (r.re[z] ?? 0) >= T.rewriteMax) return false;
    const c = rewritePrice(s);
    if (!Number.isFinite(c) || s.origin < c) return false;
    s.origin -= c;
    r.re[z] = (r.re[z] ?? 0) + 1;
    r.rw += 1;
    return true;
}
export function setRig(s: State, k: "scrub" | "aim" | "draw" | "rwAim" | "cool", v: boolean | string | number) {
    const r = rig(s);
    if (k === "scrub") r.scrub = !!v;
    if (k === "cool") r.cool = !!v;
    if (k === "aim" && PRISM_AIMS.includes(v as StatId)) r.aim = v as string;
    if (k === "draw" && T.draws.includes(v as number)) r.draw = v as number;
    if (k === "rwAim" && RIG_BY.has(v as StatId) && v !== "origin") r.rwAim = v as string;
}

// ---- the rules
export const cacheCap = (s: State, bps: number) => bps * (T.cacheSecs + T.cacheSecsLv * L(s, "bytes"));
export const stagesLit = (s: State) => s.bought.mult.filter((n) => n > 0).length;
export const stagingMul = (s: State) => { const n = stagesLit(s); return 1 + n * (T.stage + T.stageLv * L(s, "mult")) * (n >= 6 ? 2 : 1); };
export const capSecs = (s: State) => T.capSecs * Math.max(0.3, 1 - T.capSecsLv * L(s, "reboot"));
export const capCharge = (s: State) => Math.min(1, sinceReboot(s) / capSecs(s));
export const capPay = (s: State) => T.capPay + T.capPayLv * L(s, "reboot");
export const pourSecs = (s: State) => T.pourSecs * Math.max(0.3, 1 - T.pourLv * L(s, "copper"));
export const castMax = (s: State) => T.casts + T.castsLv * L(s, "copper");
export const scrubBonus = (s: State) => T.scrubBonus + T.scrubBonusLv * L(s, "silicon");
export const scrubBurn = (s: State) => Math.max(0.02, T.burn - T.burnLv * L(s, "silicon"));
/** Silicon yield: clean air adds the scrubber bonus when they run; dust takes it down to dustFloor. */
export const siliconYield = (s: State) => { const r = rig(s); return (1 + (r.scrub ? scrubBonus(s) : 0)) * (1 - r.dust) + T.dustFloor * r.dust; };
export const growStage = (s: State) => { const g = rig(s).grow / 60 / Math.max(0.3, 1 - T.growLv * L(s, "quartz")); return T.growMins.filter((m) => g >= m).length; };
export const growNext = (s: State) => { const k = Math.max(0.3, 1 - T.growLv * L(s, "quartz")); const st = growStage(s); return st >= T.growMins.length ? 0 : T.growMins[st] * 60 * k - rig(s).grow; };
export const growMul = (s: State) => 1 + growStage(s) * (T.growEach + T.growEachLv * L(s, "quartz"));
export const GROW_NAMES = ["seed", "shard", "crystal", "cluster", "geode", "cavern"];
export const glowMul = (s: State) => { const r = rig(s); return r.glowLeft > 0 ? 1 + r.glow : 1; };
/** The Afterglow an Ascend right now would leave. */
export const glowFor = (s: State) => { const ex = s.aether - TUNE.ascendAether; return ex > 0 ? Math.min(T.glowMax, Math.log10(1 + ex) * (T.glowK + T.glowKLv * L(s, "aether"))) : 0; };
export const glowSecs = (s: State) => (T.glowMins + T.glowMinsLv * L(s, "aether")) * 60;
export const glyphMul = (s: State, key: string) => 1 + T.glyph * rigLv(s, key);
export const prismMul = (s: State) => Math.min(T.prismMax, 1 + (T.prism + T.prismLv * L(s, "starglass")) * Math.log10(1 + Math.max(0, s.starglass)));
export const drawPay = (s: State) => 1 + rig(s).draw * (T.drawK + T.drawKLv * L(s, "voidsteel"));
export const stillFrac = (s: State) => Math.min(1, rig(s).quiet / (T.stillMins * 60 * Math.max(0.3, 1 - T.stillLv * L(s, "chrono"))));
export const stillMul = (s: State) => 1 + T.stillMax * stillFrac(s);
export const stormMins = (s: State) => Math.min(T.wxMins - 2, T.stormMins + T.stormLv * L(s, "nebula"));
/** Weather now: the phase, the boost, and seconds left in it. Order: clear, front (2 min), storm. */
export function weather(s: State): { phase: "clear" | "front" | "storm"; mul: number; left: number } {
    const t = rig(s).wx;
    const cyc = T.wxMins * 60, storm = stormMins(s) * 60, front = 2 * 60;
    const clear = cyc - storm - front;
    if (t < clear) return { phase: "clear", mul: 1, left: clear - t };
    if (t < clear + front) return { phase: "front", mul: 1 - 1 / T.front, left: clear + front - t };
    return { phase: "storm", mul: T.storm, left: cyc - t };
}
export const pulseSecs = (s: State) => T.pulseSecs * Math.max(0.3, 1 - T.pulseLv * L(s, "pulsars"));
export const wellMul = (s: State) => 1 + (T.well + T.wellLv * L(s, "singularity")) * Math.log10(1 + rig(s).well);
export const indexed = (s: State) => s.ach.length + s.logs.length;
export const indexMul = (s: State) => 1 + (T.index + T.indexLv * L(s, "engrams")) * indexed(s);
/** The material zone furthest behind (fewest producers among those running, Copper to Engrams). */
export function mirrored(s: State): MatId | null {
    let best: MatId | null = null;
    for (const m of MATS.slice(0, MATS.indexOf("paradox"))) if (s.prod[m] > 0 && (best === null || s.prod[m] < s.prod[best])) best = m;
    return best;
}
export const mirrorMul = (s: State) => Math.min(T.mirrorMax, 1 + (T.mirror + T.mirrorLv * L(s, "paradox")) * Math.log10(1 + Math.max(0, s.paradox)));

// ---- the Overgrowth and Descent rigs (zones 18 to 25)
export const runningZones = (s: State) => MATS.filter((m) => s.prod[m] > 0).length;
export const spreadMul = (s: State) => 1 + runningZones(s) * (T.spread + T.spreadLv * L(s, "spores"));
export const knotsTied = (s: State) => s.bought.spores.filter((n) => n > 0).length + s.bought.mycelium.filter((n) => n > 0).length;
export const knotMul = (s: State) => { const n = knotsTied(s); return 1 + n * (T.knot + T.knotLv * L(s, "mycelium")) * (n >= 12 ? 2 : 1); };
/** Daylight now: day or night, the Pollen boost, the boost below at night, and seconds left in the phase. */
export function daylight(s: State): { phase: "day" | "night"; mul: number; below: number; left: number } {
    const t = rig(s).sun ?? 0;
    const day = (T.sunMins - T.nightMins) * 60;
    if (t < day) return { phase: "day", mul: T.day + T.dayLv * L(s, "pollen"), below: 1, left: day - t };
    return { phase: "night", mul: T.night, below: T.nightGrow, left: T.sunMins * 60 - t };
}
export const seedMax = (s: State) => T.seedMax + T.seedMaxLv * L(s, "bloom");
export const seedMul = (s: State) => 1 + T.seed * (rig(s).seeds ?? 0);
/** Seeds an Ascend right now would bank (one per tenfold Bloom held). */
export const seedsFor = (s: State) => Math.floor(Math.log10(1 + Math.max(0, s.bloom)));
export const coolBonus = (s: State) => T.coolBonus + T.coolBonusLv * L(s, "basalt");
export const coolBurn = (s: State) => Math.max(0.02, T.coolBurn - T.coolBurnLv * L(s, "basalt"));
export const basaltYield = (s: State) => { const r = rig(s); const w = r.wear ?? 0; return (1 + (r.cool ? coolBonus(s) : 0)) * (1 - w) + T.wearFloor * w; };
export const ventSecs = (s: State) => T.ventSecs * Math.max(0.3, 1 - T.ventLv * L(s, "magma"));
export const heatSecs = (s: State) => T.heatSecs + T.heatSecsLv * L(s, "magma");
export const ringMul = (s: State) => Math.min(T.ringMax, 1 + (T.ring + T.ringLv * L(s, "geodes")) * Math.log10(1 + Math.max(0, s.quartz)));
export const DESCENT_RIGS: StatId[] = ["spores", "mycelium", "pollen", "bloom", "basalt", "magma", "geodes"];
export const convLevels = (s: State) => DESCENT_RIGS.reduce((a, z) => a + rigLv(s, z), 0);
export const convMul = (s: State) => 1 + convLevels(s) * (T.conv + T.convLv * L(s, "core"));

/** Every rig's output multiplier, by zone. Only open zones count. */
export function muls(s: State): Partial<Record<StatId, number>> {
    const r = rig(s);
    const m: Partial<Record<StatId, number>> = {};
    const mul = (id: StatId, v: number) => { if (v !== 1) m[id] = (m[id] ?? 1) * v; };
    const open = (id: StatId) => isUnlocked(s, id);
    mul("mult", stagingMul(s));
    if (open("copper")) mul("copper", 1 + r.casts * T.castEach);
    if (open("silicon")) {
        mul("silicon", siliconYield(s));
        if (r.scrub) mul("copper", 1 - scrubBurn(s));
    }
    if (open("quartz")) mul("quartz", growMul(s));
    if (r.glowLeft > 0) for (const z of ["copper", "silicon", "quartz"] as const) mul(z, glowMul(s));
    if (open("runes")) { mul("aether", glyphMul(s, "runes:echo")); mul("runes", glyphMul(s, "runes:ward")); mul("quartz", glyphMul(s, "runes:root")); }
    if (open("starglass") && s.starglass > 0) mul(r.aim as StatId, prismMul(s));
    if (open("voidsteel") && r.draw > 0) { mul("starglass", 1 - r.draw); mul("voidsteel", drawPay(s)); }
    if (open("chrono")) mul("chrono", stillMul(s));
    if (open("nebula")) mul("nebula", weather(s).mul);
    if (open("singularity")) mul("singularity", wellMul(s));
    if (open("engrams")) mul("engrams", indexMul(s));
    if (open("paradox")) { const z = mirrored(s); if (z) mul(z, mirrorMul(s)); }
    if (open("spores")) mul("spores", spreadMul(s));
    if (open("mycelium")) mul("mycelium", knotMul(s));
    if (open("pollen")) { const dl = daylight(s); mul("pollen", dl.mul); mul("spores", dl.below); mul("mycelium", dl.below); }
    if (open("bloom")) mul("bloom", seedMul(s));
    if (open("basalt")) { mul("basalt", basaltYield(s)); if (r.cool) mul("bloom", 1 - coolBurn(s)); }
    if (open("magma") && (r.heat ?? 0) > 0) mul("basalt", T.heat);
    if (open("geodes")) mul("geodes", ringMul(s));
    if (open("core")) mul("core", convMul(s));
    return m;
}

/** A press made by your own hand (not a Drone or script): Stillness starts over. */
export function rigManual(s: State) { rig(s).quiet = 0; }

function step(s: State, dt: number, d: Derived) {
    const r = rig(s);
    r.quiet += dt;
    const oc = s.overclock > 0 ? overclockMult(s) : 1;
    // 01 Packet cache
    const bps = d.bytesPerSec / oc;
    r.cache = Math.min(cacheCap(s, bps), r.cache + bps * (T.cacheFill + T.cacheFillLv * L(s, "bytes")) * dt);
    // 04 Batch pour
    if (s.prod.copper > 0) {
        r.pour += dt;
        const per = pourSecs(s);
        if (r.pour >= per) {
            const n = Math.floor(r.pour / per);
            r.pour -= n * per;
            s.copper += (d.rates.copper / oc) * T.pourPays * n;
            r.casts = Math.min(castMax(s), r.casts + n);
        }
    }
    // 05 Air scrubbers
    if (isUnlocked(s, "silicon")) r.dust = r.scrub ? Math.max(0, r.dust - dt / T.dustDown) : Math.min(1, r.dust + dt / T.dustUp);
    // 06 Crystal growth
    if (s.prod.quartz > 0) r.grow += dt;
    // 07 Afterglow
    if (r.glowLeft > 0) r.glowLeft = Math.max(0, r.glowLeft - dt);
    // 12 Weather
    if (s.prod.nebula > 0) r.wx = (r.wx + dt) % (T.wxMins * 60);
    // 13 Beacon
    if (s.prod.pulsars > 0) {
        r.pulse += dt;
        const per = pulseSecs(s);
        if (r.pulse >= per) {
            const n = Math.floor(r.pulse / per);
            r.pulse -= n * per;
            r.pulses += n;
            if (r.pulses >= T.pulsesPer) {
                r.pulses %= T.pulsesPer;
                r.fired += 1;
                s.overclock = Math.max(s.overclock, overclockSecs(s));
            }
        }
    }
    // 20 Daylight
    if (s.prod.pollen > 0) r.sun = ((r.sun ?? 0) + dt) % (T.sunMins * 60);
    // 22 Drill bit
    if (s.prod.basalt > 0) r.wear = r.cool ? Math.max(0, (r.wear ?? 0) - dt / T.wearDown) : Math.min(1, (r.wear ?? 0) + dt / T.wearUp);
    // 23 Eruptions
    if ((r.heat ?? 0) > 0) r.heat = Math.max(0, (r.heat ?? 0) - dt);
    if (s.prod.magma > 0) {
        r.vent = (r.vent ?? 0) + dt;
        const per = ventSecs(s);
        if (r.vent >= per) {
            const n = Math.floor(r.vent / per);
            r.vent -= n * per;
            s.magma += (d.rates.magma / oc) * T.ventPays * n;
            r.heat = heatSecs(s);
        }
    }
}

RIG_HOOKS.muls = muls;
RIG_HOOKS.step = step;
RIG_HOOKS.reboot = (s, gain) => Math.max(gain, Math.round(gain * (1 + capCharge(s) * capPay(s))));
RIG_HOOKS.afterReboot = (s) => { const r = rig(s); s.bytes += r.cache; r.cache = 0; };
RIG_HOOKS.spend = (s, stat, tier) => { if (stat !== "mult" && isUnlocked(s, "singularity")) rig(s).well += tier + 1; };
RIG_HOOKS.ascend = (s) => {
    const r = rig(s);
    const glow = glowFor(s);
    const seeds = isUnlocked(s, "bloom") ? Math.min(seedMax(s), (r.seeds ?? 0) + seedsFor(s)) : r.seeds ?? 0;
    return { ...freshRig(), lv: r.lv, re: r.re, rw: r.rw, scrub: r.scrub, aim: r.aim, draw: r.draw, rwAim: r.rwAim, cool: r.cool, seeds, quiet: r.quiet, glow, glowLeft: glow > 0 ? glowSecs(s) : 0 };
};

/** Short live readouts for the console and the admin panel. */
export function rigLine(s: State, zone: StatId): string {
    const def = rigDef(zone);
    if (!def) return "";
    const lv = def.keys.map((k) => rigLv(s, k.key)).join("/");
    return `${zoneNo(zone)} ${zoneName(zone)}: ${def.name}${def.keys.length ? ` lv ${lv}` : ""}`;
}

// ---- admin
/** Every rig at its full cap, every rewrite done. */
export function maxRigs(s: State) {
    const r = rig(s);
    for (const d of RIGS) if (d.zone !== "origin") r.re[d.zone] = T.rewriteMax;
    r.rw = Math.max(r.rw, T.rewriteMax * (RIGS.length - 1));
    for (const d of RIGS) for (const k of d.keys) r.lv[k.key] = rigCap(s, d.zone);
}
/** Meters, charges and clocks filled to their best point (levels untouched). */
export function fillRigs(s: State) {
    const r = rig(s);
    const d = derive(s);
    r.cache = cacheCap(s, d.bytesPerSec);
    r.casts = castMax(s);
    r.pour = pourSecs(s) - 1;
    r.dust = 0;
    r.grow = T.growMins[T.growMins.length - 1] * 60;
    r.quiet = T.stillMins * 60;
    r.pulses = T.pulsesPer - 1;
    r.well = Math.max(r.well, 1e8);
    r.glow = T.glowMax;
    r.glowLeft = glowSecs(s);
    r.wx = (T.wxMins - stormMins(s)) * 60;
    s.rebootAt = Math.max(0, s.life.secs - capSecs(s));
    r.seeds = seedMax(s);
    r.wear = 0;
    r.vent = ventSecs(s) - 1;
    r.sun = 0;
}
export function clearRigs(s: State) { s.rig = freshRig(); }
