// Brasswork's sounds, built from the site engine (lib/sound/engine.ts) so the site-wide switch, master volume,
// first-gesture unlock and hidden-tab sleep all apply. Voices are warm and mechanical: brass chimes, wood and metal
// thunks, a ratchet click. Call bw("name") from the host; keep the game's own `sound` setting in bwSetEnabled.
import { gate, keyClick, note, pick, setHum, tone, whoosh } from "@/lib/sound/engine";

export type BwSound = "place" | "remove" | "invalid" | "select" | "rotate" | "research" | "milestone" | "prestige" | "open";

let enabled = true;
export function bwSetEnabled(on: boolean) {
    enabled = on;
    if (!on) setHum(null);
}

type Def = { tier: number; gap: number; play: () => void };

const DEFS: Record<BwSound, Def> = {
    // a machine set down: a low wooden thunk, a brass tick on top
    place: {
        tier: 1,
        gap: 70,
        play: () => {
            tone("game", { f: 150, dur: 0.14, gain: 0.16, glide: 0.55, type: "triangle", cutoff: 900, attack: 0.004 });
            keyClick("game", { f: 1800, gain: 0.05, q: 5 });
            tone("game", { f: note(8 + pick("bwplace", 3)), at: 0.04, dur: 0.12, gain: 0.05, type: "triangle", cutoff: 2800 });
        },
    },
    remove: {
        tier: 1,
        gap: 70,
        play: () => {
            tone("game", { f: 330, dur: 0.16, gain: 0.1, glide: 0.5, type: "triangle", cutoff: 1400 });
            keyClick("game", { f: 900, gain: 0.04, q: 3 });
        },
    },
    invalid: {
        tier: 1,
        gap: 160,
        play: () => {
            tone("game", { f: 118, dur: 0.12, gain: 0.1, type: "square", cutoff: 500 });
            tone("game", { f: 105, at: 0.07, dur: 0.12, gain: 0.09, type: "square", cutoff: 500 });
        },
    },
    select: { tier: 0, gap: 50, play: () => keyClick("game", { f: 2200, gain: 0.035, q: 6 }) },
    rotate: {
        tier: 0,
        gap: 40,
        play: () => {
            keyClick("game", { f: 1500, gain: 0.04, q: 4 });
            keyClick("game", { f: 2100, at: 0.035, gain: 0.03, q: 4 });
        },
    },
    open: { tier: 1, gap: 120, play: () => whoosh("game", { from: 400, to: 1800, dur: 0.22, gain: 0.05 }) },
    // blueprint bought: two bright chimes
    research: {
        tier: 2,
        gap: 120,
        play: () => {
            tone("game", { f: note(7), dur: 0.35, gain: 0.1, type: "triangle", harm: 0.25, cutoff: 3200 });
            tone("game", { f: note(9), at: 0.09, dur: 0.45, gain: 0.1, type: "triangle", harm: 0.25, cutoff: 3200 });
        },
    },
    // a delivery milestone: a rising brass arpeggio
    milestone: {
        tier: 3,
        gap: 400,
        play: () => [5, 7, 9, 12].forEach((d, i) => tone("game", { f: note(d), at: i * 0.1, dur: 0.5, gain: 0.11, type: "triangle", harm: 0.3, cutoff: 3000, attack: 0.012 })),
    },
    // opening a new workshop: a slow swell and a wide chord
    prestige: {
        tier: 4,
        gap: 1500,
        play: () => {
            whoosh("game", { from: 200, to: 2600, dur: 1.1, gain: 0.08 });
            [0, 4, 7, 9, 14].forEach((d, i) => tone("game", { f: note(d), at: 0.5 + i * 0.07, dur: 1.6, gain: 0.1, type: "triangle", harm: 0.3, cutoff: 3000, attack: 0.05 }));
        },
    },
};

export function bw(name: BwSound) {
    if (!enabled) return;
    const d = DEFS[name];
    if (!gate(`bw-${name}`, d.tier, d.gap)) return;
    d.play();
}

/** The workshop's ambient drone. `working` is the share of machines running (0..1); pass null to fade it out. */
export function bwHum(working: number | null) {
    if (!enabled || working === null) return setHum(null);
    setHum({ level: Math.min(1, Math.max(0, working)), vol: 0.5 });
}
