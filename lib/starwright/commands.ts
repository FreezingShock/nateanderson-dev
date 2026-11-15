// The `sw` console commands. Pure: they act on a State and return printed lines. The console (components/cm/console.tsx)
// runs them against the open game's live state, or against the saved game when the game is not open.
import { ACHIEVEMENTS, ACH_BONUS, CLOUDS, CONSTELLATIONS, ELEMENTS, TUNE, PERKS, PLANETS, PULSAR_PERKS, ROWS, TIERS, TIER_NAMES } from "./data";
import {
    answer, blackHole, buy, checkAch, chooseCloud, eventOf, buyPerk, buyPlanet, buyPulsar, canBlackHole, canNeutron, canSupernova, collapse, cost, effects, fmt, fmtAge, fmtHeat,
    heaviest, horizonNeed, neutronGain, neutronStar, rowOpen, seeds, step, supernova, type State,
} from "./engine";
import { BACKUP_KEY, CORRUPT_KEY, lastAway, readBackup, writeBackup } from "./session";
import { AUTO_NOVA_STEPS, AUTO_VISITOR_STEPS, getSettings, setSettings, unlockName, unlocked, UNLOCKS, type Settings } from "./settings";

export interface SwLine { t: string; k?: "dim" | "hi" | "err" }
export interface SwResult { lines: SwLine[]; changed: boolean }

export const SW_SAVE_KEY = "sw-save-v1";
export const SW_PATH = "/creations/games/starwright";
export const SW_SUBS = ["stats", "fuse", "collapse", "neutron", "hole", "perks", "pulsar", "planets", "visitor", "cloud", "almanac", "name", "save", "backup", "restore", "corrupt", "away", "settings", "set", "keys", "admin", "open"];

const l = (t: string, k?: SwLine["k"]): SwLine => ({ t, k });
const elIndex = (q: string) => ELEMENTS.findIndex((e) => e.sym.toLowerCase() === q || e.name.toLowerCase() === q);


export const SW_KEYS: Array<[string, string]> = [
    ["1 to 9", "buy tier I of that row (Shift tier II, Alt tier III)"],
    ["N", "go supernova when the core is ready"],
    ["Q · W", "answer a visitor with its first or second card"],
    ["Space", "pause or resume"],
    ["F", "full screen"],
    ["U", "sound on or off"],
    ["C · P · O · A · M", "constellations, pulsar map, orbit, almanac, menu"],
    ["Esc", "close a panel"],
    ["` · Ctrl+J", "console"],
];

const store = () => (typeof window !== "undefined" ? window.localStorage : null);
const when = (t: number) => `${fmtAge(Math.max(0, Date.now() - t) / 1000)} ago`;

const SET_HELP = [
    "fx full|simple          scene drawing (simple is lighter on slow machines)",
    "notices on|off         the notes over the scene",
    "welcome on|off         the welcome-back card",
    `autonova off|${AUTO_NOVA_STEPS.slice(1).map((n) => `${n * 100}%`).join("|")}   supernova by itself (unlocks: ${UNLOCKS.autoNova.need})`,
    `autovisitor ${AUTO_VISITOR_STEPS.join("|")}  answer visitors (unlocks: ${UNLOCKS.autoVisitor.need})`,
];

function showSettings(s: State): SwLine[] {
    const v = getSettings();
    const lock = (k: keyof typeof UNLOCKS) => (unlocked(s, k) ? "" : `  (locked: ${UNLOCKS[k].need})`);
    return [
        l("settings · sw set <name> <value>", "hi"),
        l(`fx ${v.fx} · notices ${v.notices ? "on" : "off"} · welcome ${v.welcome ? "on" : "off"}`),
        l(`autonova ${v.autoNova ? `${v.autoNova * 100}%` : "off"}${lock("autoNova")}`, unlocked(s, "autoNova") ? undefined : "dim"),
        l(`autovisitor ${v.autoVisitor}${lock("autoVisitor")}`, unlocked(s, "autoVisitor") ? undefined : "dim"),
    ];
}

function setSetting(s: State, name: string, val: string): SwLine[] {
    const on = (x: string) => (["on", "true", "yes", "1"].includes(x) ? true : ["off", "false", "no", "0"].includes(x) ? false : null);
    const bad = () => [l(`not a valid value for ${name}.`, "err"), ...SET_HELP.map((x) => l(x, "dim"))];
    if (name === "fx") { if (val !== "full" && val !== "simple") return bad(); setSettings({ fx: val }); return [l(`scene drawing: ${val}.`)]; }
    if (name === "notices" || name === "welcome") { const b = on(val); if (b === null) return bad(); setSettings({ [name]: b } as Partial<Settings>); return [l(`${name} ${b ? "on" : "off"}.`)]; }
    if (name === "autonova") {
        if (!unlocked(s, "autoNova")) return [l(`locked. ${UNLOCKS.autoNova.need} ("${unlockName("autoNova")}") to unlock it.`, "err")];
        const n = val === "off" ? 0 : parseFloat(val) / (val.endsWith("%") ? 100 : 1);
        const hit = AUTO_NOVA_STEPS.find((x) => x === n);
        if (hit === undefined) return bad();
        setSettings({ autoNova: hit });
        return [l(hit ? `the star will go supernova by itself at ${hit * 100}% of its collapse.` : "automatic supernova off.")];
    }
    if (name === "autovisitor") {
        if (!unlocked(s, "autoVisitor")) return [l(`locked. ${UNLOCKS.autoVisitor.need} ("${unlockName("autoVisitor")}") to unlock it.`, "err")];
        const hit = AUTO_VISITOR_STEPS.find((x) => x === val);
        if (!hit) return bad();
        setSettings({ autoVisitor: hit });
        return [l(hit === "off" ? "visitors wait for you." : `visitors are answered with ${hit === "lump" ? "the lump of output" : "the timed boost"}.`)];
    }
    return bad();
}

function admin(s: State, args: string[]): SwResult {
    const what = (args[1] ?? "").toLowerCase();
    const n = Number(args[what === "give" ? 3 : 2]);
    const help = [l("sw admin give <element> <n> · dust <n> · neutrons <n> · time <minutes>", "dim"), l("a testing tool: it counts toward milestones, so use it on a save you can lose.", "dim")];
    if (what === "give") {
        const i = elIndex((args[2] ?? "").toLowerCase());
        if (i < 0 || !(n > 0)) return { lines: help, changed: false };
        s.amt[i] += n;
        return { lines: [l(`+${fmt(n)} ${ELEMENTS[i].name}.`)], changed: true };
    }
    if (what === "dust" && n > 0) { s.stardust += n; s.sdLayer += n; s.sdAll += n; return { lines: [l(`+${fmt(n)} stardust.`)], changed: true }; }
    if (what === "neutrons" && n > 0) { s.neutrons += n; s.neutronsAll += n; return { lines: [l(`+${fmt(n)} neutrons.`)], changed: true }; }
    if (what === "time" && n > 0) {
        const secs = Math.min(n * 60, 24 * 3600);
        const steps = Math.min(7200, Math.ceil(secs / 2));
        for (let k = 0; k < steps; k++) step(s, secs / steps, effects(s));
        return { lines: [l(`the star burned for ${fmtAge(secs)} more.`)], changed: true };
    }
    return { lines: help, changed: false };
}

export function swCommand(s: State, args: string[]): SwResult {
    const f = effects(s);
    const sub = (args[0] ?? "stats").toLowerCase();
    const out = (lines: SwLine[], changed = false): SwResult => ({ lines, changed });

    if (sub === "stats" || sub === "stars") {
        return out([
            l(`${s.name} · age ${fmtAge(s.age)} · heat ${fmtHeat(s.heat)} · heaviest ${ELEMENTS[heaviest(s)].name}`, "hi"),
            l(ELEMENTS.slice(0, 8).map((e, i) => `${e.sym} ${fmt(s.amt[i], 1)}`).join("  ")),
            l(`collapse ${Math.floor(collapse(s, f) * 100)}% · a supernova now seeds ${fmt(seeds(s, f))} stardust`),
            l(`stardust ${fmt(s.stardust)} · supernovas ${s.novasAll} · neutron stars ${s.neutronStars} · singularities ${s.sing}`, "dim"),
        ]);
    }
    if (sub === "fuse") {
        const i = elIndex((args[1] ?? "").toLowerCase());
        const tier = Math.max(1, Math.min(TIERS, parseInt(args[2] ?? "1", 10) || 1));
        if (i < 0 || i >= ROWS) return out([l(`sw fuse <element> [1-${TIERS}] · elements ${ELEMENTS.slice(0, ROWS).map((e) => e.sym.toLowerCase()).join(" ")}`, "dim")]);
        if (!rowOpen(s, i)) return out([l(`${ELEMENTS[i].name} cannot fuse yet: it needs a neutron star first.`, "err")]);
        if (!buy(s, i, tier - 1)) return out([l(`not enough ${ELEMENTS[i].name}: tier ${TIER_NAMES[tier - 1]} costs ${fmt(cost(s, i, tier - 1))}.`, "err")]);
        return out([l(`${ELEMENTS[i].sym} tier ${TIER_NAMES[tier - 1]} bought.`)], true);
    }
    if (sub === "collapse" || sub === "supernova") {
        if (!canSupernova(s, f)) return out([l(`the core is at ${Math.floor(collapse(s, f) * 100)}%. it collapses at 100%.`, "err")]);
        const g = supernova(s);
        return out([l(`supernova. +${fmt(g)} stardust. a new star takes its place.`, "hi")], true);
    }
    if (sub === "neutron") {
        if (!canNeutron(s)) return out([l(`a neutron star needs ${fmt(TUNE.neutronAt)} stardust earned in this layer (you have ${fmt(s.sdLayer)}).`, "err")]);
        if (args[1] !== "now") return out([l(`this resets stardust and the constellation map for ${neutronGain(s)} neutrons. sw neutron now to do it.`, "hi")]);
        const g = neutronStar(s);
        return out([l(`neutron star formed. +${g} neutrons. gold and uranium can fuse now.`, "hi")], true);
    }
    if (sub === "hole") {
        if (!canBlackHole(s, f)) return out([l(s.neutronStars ? `a black hole needs ${fmt(horizonNeed(f))} uranium (you have ${fmt(s.amt[9])}).` : "a black hole needs a neutron star first.", "err")]);
        if (args[1] !== "now") return out([l("this ends the star's story and restarts everything for one singularity. sw hole now to do it.", "hi")]);
        blackHole(s);
        return out([l("the star falls in. one singularity gained.", "hi")], true);
    }
    if (sub === "perks" || sub === "pulsar") {
        const list = sub === "perks" ? PERKS : PULSAR_PERKS;
        const owned = sub === "perks" ? s.perks : s.pulsar;
        const cur = sub === "perks" ? s.stardust : s.neutrons;
        const id = (args[1] ?? "").toLowerCase();
        if (id) {
            const ok = sub === "perks" ? buyPerk(s, id) : buyPulsar(s, id);
            const p = list.find((x) => x.id === id);
            return out([ok ? l(`${p?.name} bought.`) : l(p ? `cannot buy ${p.name} yet: it needs ${fmt(p.cost)} and its neighbours.` : `no perk ${id}.`, "err")], ok);
        }
        const rows = list.map((p) => l(`${p.id}  ${owned.includes(p.id) ? "owned" : fmt(p.cost).padStart(5)}  ${p.name}: ${p.desc}`, owned.includes(p.id) ? "dim" : undefined));
        return out([l(`${sub === "perks" ? "stardust" : "neutrons"} ${fmt(cur)} · sw ${sub} <id> buys`, "hi"), ...rows]);
    }
    if (sub === "planets") {
        const id = (args[1] ?? "").toLowerCase();
        if (id) {
            const p = PLANETS.find((x) => x.id === id);
            if (!p) return out([l(`no planet ${id}.`, "err")]);
            const ok = buyPlanet(s, id);
            return out([ok ? l(`${p.name} forms in orbit. ${p.bonus}.`) : l(`not enough material for ${p.name}.`, "err")], ok);
        }
        return out([l("sw planets <id> accretes one", "hi"), ...PLANETS.map((p) => l(`${p.id}  ${s.planets.includes(p.id) ? "in orbit" : p.cost.map(([e, q]) => `${fmt(q)} ${ELEMENTS[e].sym}`).join(" + ")}  ${p.bonus}`, s.planets.includes(p.id) ? "dim" : undefined))]);
    }
    if (sub === "save") {
        const st = store();
        let raw: string | null = null;
        try { raw = st?.getItem(SW_SAVE_KEY) ?? null; } catch { /* blocked */ }
        const back = readBackup(st);
        return out([
            l(raw ? `saved game ${(raw.length / 1024).toFixed(1)} KB, written ${when(s.savedAt)}.` : "nothing saved in this browser yet.", "hi"),
            l(back ? `backup from ${when(back.savedAt)} (played ${fmtAge(back.totalAge)}). sw restore now brings it back.` : "no backup yet. one is kept before every neutron star and black hole, before an import or reset, and every 10 minutes of play.", "dim"),
            l("the menu exports a file you can keep. saves live in this browser only.", "dim"),
        ]);
    }
    if (sub === "backup") {
        const ok = writeBackup(store(), s, true);
        return out([ok ? l("backup written. sw restore now brings it back.") : l("the browser refused the write: storage is full or blocked.", "err")]);
    }
    if (sub === "restore") {
        const back = readBackup(store());
        if (!back) return out([l("no backup to restore.", "err")]);
        if (args[1] !== "now") return out([l(`backup from ${when(back.savedAt)}: ${back.novasAll} supernovas, ${fmt(back.stardust)} stardust, played ${fmtAge(back.totalAge)}. sw restore now replaces this game with it (the current game becomes the backup).`, "hi")]);
        const keep = { ...s };
        Object.assign(s, back, { savedAt: Date.now() });
        writeBackup(store(), keep as State, true);
        return out([l("backup restored.", "hi")], true);
    }
    if (sub === "corrupt") {
        let raw: string | null = null;
        try { raw = store()?.getItem(CORRUPT_KEY) ?? null; } catch { /* blocked */ }
        if (!raw) return out([l("no damaged save is kept.", "dim")]);
        return out([l(`a damaged save of ${(raw.length / 1024).toFixed(1)} KB is kept under ${CORRUPT_KEY}. it starts:`, "hi"), l(raw.slice(0, 160), "dim"), l(`(backup key ${BACKUP_KEY})`, "dim")]);
    }
    if (sub === "away") {
        const r = lastAway(store());
        if (!r) return out([l("no time away yet.", "dim")]);
        return out([l(`last welcome back, ${when(r.at)}:`, "hi"), ...r.lines.map((x) => l(x))]);
    }
    if (sub === "settings") return out(showSettings(s));
    if (sub === "set") {
        if (!args[1]) return out([...showSettings(s), ...SET_HELP.map((x) => l(x, "dim"))]);
        return out(setSetting(s, args[1].toLowerCase(), (args[2] ?? "").toLowerCase()));
    }
    if (sub === "keys") return out([l("keys", "hi"), ...SW_KEYS.map(([k, d]) => l(`${k.padEnd(18)} ${d}`))]);
    if (sub === "admin") return admin(s, args);
    if (sub === "name") {
        const n = args.slice(1).join(" ").trim().slice(0, 24);
        if (!n) return out([l(`your star is ${s.name}. sw name <new name> renames it.`)]);
        s.name = n;
        return out([l(`the star is ${n}.`)], true);
    }
    if (sub === "visitor" || sub === "visit") {
        const ev = eventOf(s);
        if (!ev) return out([l("nothing is near the star right now.", "dim")]);
        const n = parseInt(args[1] ?? "", 10);
        if (n !== 1 && n !== 2) return out([l(`${ev.name}. ${ev.text}`, "hi"), ...ev.opts.map((o, i) => l(`sw visitor ${i + 1}  ${o.label}: ${o.desc}`))]);
        const o = answer(s, n - 1);
        return out([l(`${ev.name}: ${o?.label.toLowerCase()}.`)], true);
    }
    if (sub === "cloud") {
        if (!s.offer.length) return out([l(s.cloud ? `this star was born from a ${CLOUDS.find((c) => c.id === s.cloud)?.name.toLowerCase()}.` : "no birth cloud on offer. they come after a supernova.", "dim")]);
        const id = (args[1] ?? "").toLowerCase();
        if (id && chooseCloud(s, id)) return out([l(`${CLOUDS.find((c) => c.id === id)?.name} chosen.`)], true);
        return out([l("sw cloud <id> picks one", "hi"), ...s.offer.map((x) => l(`${x}  ${CLOUDS.find((c) => c.id === x)?.name}: ${CLOUDS.find((c) => c.id === x)?.desc}`))]);
    }
    if (sub === "almanac") {
        const got = checkAch(s);
        return out([
            l(`${s.ach.length} of ${ACHIEVEMENTS.length} milestones · everything +${Math.round(ACH_BONUS * 100 * s.ach.length)}% · elements made ${s.found.join(" ")}`, "hi"),
            ...ACHIEVEMENTS.map((a) => l(`${s.ach.includes(a.id) ? "done " : "     "} ${a.name}: ${a.desc}`, s.ach.includes(a.id) ? "dim" : undefined)),
        ], got.length > 0);
    }
    if (sub === "constellations") return out(CONSTELLATIONS.map((c) => l(`${c.name}: ${c.blurb}`)));
    return out([l(`sw ${SW_SUBS.join(" · ")}`, "dim")]);
}
