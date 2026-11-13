// The `sw` console commands. Pure: they act on a State and return printed lines. The console (components/cm/console.tsx)
// runs them against the open game's live state, or against the saved game when the game is not open.
import { CONSTELLATIONS, ELEMENTS, TUNE, PERKS, PLANETS, PULSAR_PERKS, ROWS, TIERS, TIER_NAMES } from "./data";
import {
    blackHole, buy, buyPerk, buyPlanet, buyPulsar, canBlackHole, canNeutron, canSupernova, collapse, cost, effects, fmt, fmtAge, fmtHeat,
    heaviest, horizonNeed, neutronGain, neutronStar, rowOpen, seeds, supernova, type State,
} from "./engine";

export interface SwLine { t: string; k?: "dim" | "hi" | "err" }
export interface SwResult { lines: SwLine[]; changed: boolean }

export const SW_SAVE_KEY = "sw-save-v1";
export const SW_PATH = "/creations/games/starwright";
export const SW_SUBS = ["stats", "fuse", "collapse", "neutron", "hole", "perks", "pulsar", "planets", "name", "open"];

const l = (t: string, k?: SwLine["k"]): SwLine => ({ t, k });
const elIndex = (q: string) => ELEMENTS.findIndex((e) => e.sym.toLowerCase() === q || e.name.toLowerCase() === q);

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
    if (sub === "name") {
        const n = args.slice(1).join(" ").trim().slice(0, 24);
        if (!n) return out([l(`your star is ${s.name}. sw name <new name> renames it.`)]);
        s.name = n;
        return out([l(`the star is ${n}.`)], true);
    }
    if (sub === "constellations") return out(CONSTELLATIONS.map((c) => l(`${c.name}: ${c.blurb}`)));
    return out([l(`sw ${SW_SUBS.join(" · ")}`, "dim")]);
}
