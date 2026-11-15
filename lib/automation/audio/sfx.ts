// Brasswork's one-shot sounds: warm and mechanical. Brass chimes for rewards, wood and metal thunks for building,
// ratchet clicks for belts and menus. Every sound has a rate limit so drags and held keys never pile up.
import { click, gate, note, pick, sweep, tone } from "./engine";

export type BwSound =
    | "place" | "remove" | "invalid" | "select" | "rotate" | "undo"
    | "belt" | "delivery" | "unlock" | "research" | "milestone" | "prestige"
    | "open" | "close" | "hover" | "press" | "toggle";

export type SoundArg = { n?: number; size?: number };

/** A line of belt laid: soft ratchet ticks climbing in pitch (capped at 8 so a long drag stays a purr), then a settle. */
function belt(n: number) {
    const steps = Math.min(8, Math.max(2, n));
    for (let i = 0; i < steps; i++) {
        click({ f: 1500 + i * 110, q: 5, at: i * 0.032, gain: 0.034, dur: 0.016 });
        if (i % 2 === 0) tone({ f: 190 + i * 14, at: i * 0.032, dur: 0.05, gain: 0.04, type: "triangle", cutoff: 800 });
    }
    tone({ f: 150, at: steps * 0.032, dur: 0.12, gain: 0.09, glide: 0.6, type: "triangle", cutoff: 900 });
}

const DEFS: Record<BwSound, { gap: number; play: (a: SoundArg) => void }> = {
    // a machine set down: a low wooden thunk with a brass tick; heavier footprints sit lower and louder
    place: {
        gap: 70,
        play: (a) => {
            const big = Math.min(1, ((a.size ?? 1) - 1) / 8);
            tone({ f: 150 - big * 40, dur: 0.14 + big * 0.1, gain: 0.15 + big * 0.06, glide: 0.55, type: "triangle", cutoff: 900, attack: 0.004 });
            click({ f: 1800, gain: 0.05, q: 5 });
            tone({ f: note(8 + pick("bwplace", 3)), at: 0.04, dur: 0.12, gain: 0.045, type: "triangle", cutoff: 2800 });
        },
    },
    belt: { gap: 90, play: (a) => belt(a.n ?? 3) },
    remove: {
        gap: 70,
        play: () => {
            tone({ f: 330, dur: 0.16, gain: 0.1, glide: 0.5, type: "triangle", cutoff: 1400 });
            click({ f: 900, gain: 0.04, q: 3 });
        },
    },
    undo: { gap: 60, play: () => tone({ f: 420, dur: 0.1, gain: 0.07, glide: 0.7, type: "triangle", cutoff: 1800 }) },
    invalid: {
        gap: 160,
        play: () => {
            tone({ f: 118, dur: 0.12, gain: 0.1, type: "square", cutoff: 500 });
            tone({ f: 105, at: 0.07, dur: 0.12, gain: 0.09, type: "square", cutoff: 500 });
        },
    },
    select: { gap: 50, play: () => click({ f: 2200, gain: 0.035, q: 6 }) },
    rotate: {
        gap: 40,
        play: () => {
            click({ f: 1500, gain: 0.04, q: 4 });
            click({ f: 2100, at: 0.035, gain: 0.03, q: 4 });
        },
    },
    // an item arriving at the hub: one small brass tick, never a fanfare (deliveries are constant)
    delivery: { gap: 900, play: () => tone({ f: note(10 + pick("bwdeliv", 3)), dur: 0.22, gain: 0.05, type: "triangle", harm: 0.2, cutoff: 3200, attack: 0.004 }) },
    // a blueprint or recipe becoming available: two soft rising notes
    unlock: {
        gap: 400,
        play: () => {
            tone({ f: note(6), dur: 0.22, gain: 0.07, type: "triangle", cutoff: 3000 });
            tone({ f: note(8), at: 0.08, dur: 0.3, gain: 0.07, type: "triangle", cutoff: 3000 });
        },
    },
    research: {
        gap: 120,
        play: () => {
            tone({ f: note(7), dur: 0.35, gain: 0.1, type: "triangle", harm: 0.25, cutoff: 3200 });
            tone({ f: note(9), at: 0.09, dur: 0.45, gain: 0.1, type: "triangle", harm: 0.25, cutoff: 3200 });
        },
    },
    // a hub order complete: a rising brass arpeggio
    milestone: {
        gap: 400,
        play: () => [5, 7, 9, 12].forEach((d, i) => tone({ f: note(d), at: i * 0.1, dur: 0.5, gain: 0.11, type: "triangle", harm: 0.3, cutoff: 3000, attack: 0.012 })),
    },
    // opening a new workshop: a slow swell and a wide chord
    prestige: {
        gap: 1500,
        play: () => {
            sweep({ from: 200, to: 2600, dur: 1.1, gain: 0.08 });
            [0, 4, 7, 9, 14].forEach((d, i) => tone({ f: note(d), at: 0.5 + i * 0.07, dur: 1.6, gain: 0.1, type: "triangle", harm: 0.3, cutoff: 3000, attack: 0.05 }));
        },
    },
    // a menu window: a short sweep up on open, down on close, with a latch click
    open: {
        gap: 120,
        play: () => {
            sweep({ from: 400, to: 1800, dur: 0.2, gain: 0.05 });
            click({ f: 1300, at: 0.16, gain: 0.04, q: 4 });
        },
    },
    close: {
        gap: 120,
        play: () => {
            sweep({ from: 1500, to: 380, dur: 0.16, gain: 0.04 });
            click({ f: 900, gain: 0.035, q: 4 });
        },
    },
    // button hover: the faintest tick. press: a firmer latch. toggle: a two-part clank
    hover: { gap: 55, play: () => click({ f: 3000 + pick("bwhover", 3) * 250, gain: 0.014, q: 7, dur: 0.012 }) },
    press: {
        gap: 40,
        play: () => {
            click({ f: 1700, gain: 0.05, q: 4 });
            tone({ f: 210, dur: 0.06, gain: 0.05, glide: 0.7, type: "triangle", cutoff: 900 });
        },
    },
    toggle: {
        gap: 80,
        play: () => {
            click({ f: 1200, gain: 0.05, q: 4 });
            click({ f: 2400, at: 0.05, gain: 0.04, q: 5 });
            tone({ f: 260, at: 0.05, dur: 0.08, gain: 0.05, type: "triangle", cutoff: 1200 });
        },
    },
};

export function playSound(name: BwSound, arg: SoundArg = {}) {
    const d = DEFS[name];
    if (!gate(`bw-${name}`, d.gap)) return;
    d.play(arg);
}
