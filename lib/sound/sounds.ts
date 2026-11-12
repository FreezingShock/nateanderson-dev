import { gate, getPrefs, keyClick, note, pick, tone, whoosh, type Bus } from "./engine";

// The sound catalogue. Every entry is a tier (see engine.ts), a bus (site interface vs game), a minimum gap between
// plays, and a small recipe made from the engine's voices. Two families share one file:
//   - the naOS interface set (hover, taps, panels, nav, access results): square blips, keypad clicks and short
//     packet bursts, in the style of a terminal or a security system (keypad, access granted, access denied, a scan).
//   - the game set (buying, unlocking, rewards): softer triangle and square voices on one pentatonic scale, so quick
//     sequences always agree. Notes are scale degrees (0 = C4, 5 = C5).

type Def = { tier: number | ((a: any) => number); bus: Bus; gap: number; play: (a: any) => void };

const seq = (bus: Bus, degs: number[], step: number, o: { dur: number; gain: number; harm?: number; type?: OscillatorType; cutoff?: number; at?: number }) =>
    degs.forEach((d, i) => tone(bus, { f: note(d), at: (o.at ?? 0) + i * step, dur: o.dur, gain: o.gain, harm: o.harm, type: o.type, cutoff: o.cutoff ?? 3200, attack: 0.012 }));

// naOS voice helpers. Square blips and one sawtooth scan, all low-passed, so the chrome never bites.
const JITTER = [1, 1.122, 0.892]; // a whole step up or a minor sixth down, so repeated taps don't sound identical
const calm = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
type Blip = { at?: number; dur?: number; gain?: number; glide?: number; cutoff?: number; type?: OscillatorType };
const blip = (bus: Bus, f: number, o: Blip) => tone(bus, { f, at: o.at, dur: o.dur ?? 0.05, gain: o.gain ?? 0.06, glide: o.glide, cutoff: o.cutoff ?? 2400, type: o.type ?? "square", attack: 0.003 });
const scan = (from: number, to: number, dur: number, gain: number) => tone("ui", { f: from, dur, gain, glide: to / from, cutoff: 1400, type: "sawtooth", attack: 0.02 });

const streak = { start: 0, last: -1e9 };

const DEFS = {
    // ---- the naOS interface set. Site chrome: hover, taps, tabs, toggles, panels, route changes, access results.
    // Under prefers-reduced-motion the scan sweeps and hover ticks drop out; the confirm blips always play.
    hover: {
        tier: 0,
        bus: "ui",
        gap: 60,
        play: () => {
            if (!calm()) keyClick("ui", { f: 2600, gain: 0.012, q: 6 });
        },
    },

    tip: { tier: 0, bus: "ui", gap: 90, play: () => { if (!calm()) blip("ui", 1980 * JITTER[pick("tip", 2)], { dur: 0.03, gain: 0.012, cutoff: 3000 }); } },

    // ---- tier 1: interface
    // a keypad press: a short noise click under a square blip that drops a little, like a key bottoming out
    tap: {
        tier: 1,
        bus: "ui",
        gap: 35,
        play: () => {
            keyClick("ui", { f: 1800, gain: 0.03, q: 3 });
            blip("ui", 1320 * JITTER[pick("tap", 3)], { dur: 0.035, gain: 0.055, glide: 0.72, cutoff: 2200 });
        },
    },
    // switching a terminal session: two blips and a short scan
    tab: {
        tier: 1,
        bus: "ui",
        gap: 50,
        play: () => {
            blip("ui", 990, { dur: 0.04, gain: 0.06, cutoff: 2200 });
            blip("ui", 1485, { at: 0.035, dur: 0.05, gain: 0.05, cutoff: 2600 });
            if (!calm()) scan(420, 1500, 0.14, 0.018);
        },
    },
    // Node Farm code reveal (lib/nodefarm/cx.ts): rows printing in are soft key ticks, one per row; closing is a short
    // run of ticks falling in pitch, like a line being backspaced. Quiet on purpose: menus open often.
    nfPrint: {
        tier: 1,
        bus: "ui",
        gap: 120,
        play: (n?: number) => {
            const k = Math.max(2, Math.min(6, n ?? 4));
            for (let i = 0; i < k; i++) keyClick("ui", { f: 2300 + (i % 2) * 400, gain: 0.014, q: 5, at: i * 0.034 });
            blip("ui", 1760, { at: k * 0.034, dur: 0.03, gain: 0.02, cutoff: 2800 });
        },
    },
    nfDelete: {
        tier: 1,
        bus: "ui",
        gap: 120,
        play: () => {
            for (let i = 0; i < 3; i++) keyClick("ui", { f: 2200 - i * 380, gain: 0.012, q: 5, at: i * 0.03 });
            blip("ui", 660, { at: 0.1, dur: 0.04, gain: 0.025, glide: 0.7, cutoff: 1800 });
        },
    },
    // a toggle switching on: the system accepting a setting
    on: {
        tier: 1,
        bus: "ui",
        gap: 60,
        play: () => {
            blip("ui", 880, { dur: 0.06, gain: 0.065, cutoff: 2400 });
            blip("ui", 1320, { at: 0.07, dur: 0.09, gain: 0.065, cutoff: 2800 });
        },
    },
    off: {
        tier: 1,
        bus: "ui",
        gap: 60,
        play: () => {
            blip("ui", 1320, { dur: 0.06, gain: 0.06, cutoff: 2800 });
            blip("ui", 880, { at: 0.07, dur: 0.09, gain: 0.06, cutoff: 2200 });
        },
    },
    // a panel opening (site map, search, console): a scan sweeping up, then a confirm blip
    open: {
        tier: 1,
        bus: "ui",
        gap: 90,
        play: () => {
            if (!calm()) scan(300, 1200, 0.16, 0.026);
            blip("ui", 1320, { at: 0.12, dur: 0.05, gain: 0.05, cutoff: 2600 });
        },
    },
    // a panel closing: the scan sweeps back down
    close: {
        tier: 1,
        bus: "ui",
        gap: 90,
        play: () => {
            if (!calm()) scan(1200, 300, 0.14, 0.022);
            blip("ui", 660, { at: 0.1, dur: 0.05, gain: 0.05, cutoff: 2000 });
        },
    },
    // the route change: a three-note data packet landing on the next page
    nav: {
        tier: 1,
        bus: "ui",
        gap: 300,
        play: () => {
            blip("ui", 660, { dur: 0.025, gain: 0.05, cutoff: 2600 });
            blip("ui", 880, { at: 0.03, dur: 0.025, gain: 0.05, cutoff: 2600 });
            blip("ui", 1320, { at: 0.06, dur: 0.04, gain: 0.05, cutoff: 3000 });
        },
    },
    // access granted: a rising square chirp that lands on a held note. Used for a correct guess and confirmations.
    granted: {
        tier: 2,
        bus: "ui",
        gap: 150,
        play: () => {
            [660, 880, 1100].forEach((f, i) => blip("ui", f, { at: i * 0.055, dur: 0.08, gain: 0.06, cutoff: 2600 }));
            blip("ui", 1320, { at: 0.19, dur: 0.22, gain: 0.07, cutoff: 3000 });
        },
    },
    // access denied: two low square buzzes. Used for a wrong guess, a rejected command, a blocked action.
    deny: {
        tier: 2,
        bus: "ui",
        gap: 150,
        play: () => {
            blip("ui", 150, { dur: 0.07, gain: 0.06, cutoff: 800 });
            blip("ui", 118, { at: 0.09, dur: 0.09, gain: 0.06, cutoff: 800 });
        },
    },
    // a security alert: two soft triangle tones falling a fourth
    popup: {
        tier: 1,
        bus: "ui",
        gap: 400,
        play: () => {
            tone("ui", { f: 1320, dur: 0.12, gain: 0.05, type: "triangle", attack: 0.004, cutoff: 3000 });
            tone("ui", { f: 990, at: 0.14, dur: 0.18, gain: 0.05, type: "triangle", attack: 0.004, cutoff: 3000 });
        },
    },

    // ---- Node Farm (the incremental game): the same naOS security-terminal voices as the interface set.
    // Buys are access-granted pairs; a Reboot is a power-down scan
    // followed by a power-up arpeggio; an intrusion is a three-pulse alarm; a breach is a fast lock-picked arpeggio.
    // A press has a voice per stat, and the tier sets pitch and length: Multipliers are keypad presses, Copper relay clacks,
    // Silicon fast high ticks, Quartz glassy chimes, Aether an airy swell. `stat` is optional so older callers still work.
    nfBuy: {
        tier: 2,
        bus: "game",
        gap: 45,
        play: (a: { tier?: number; stat?: string } | undefined) => {
            const t = Math.max(0, Math.min(5, a?.tier ?? 0));
            const base = 880 * Math.pow(1.0595, t * 2);
            switch (a?.stat) {
                case "mult":
                    keyClick("game", { f: 1900, gain: 0.04, q: 3 });
                    blip("game", base * 0.75, { dur: 0.045, gain: 0.06, glide: 0.8, cutoff: 2400 });
                    blip("game", base * 1.125, { at: 0.05, dur: 0.06, gain: 0.055, cutoff: 2800 });
                    break;
                case "copper":
                    keyClick("game", { f: 900, gain: 0.07, q: 2 });
                    blip("game", base * 0.5, { dur: 0.07, gain: 0.07, glide: 0.6, cutoff: 1500 });
                    blip("game", base * 0.75, { at: 0.06, dur: 0.06, gain: 0.05, cutoff: 1800 });
                    break;
                case "silicon":
                    [1, 1.5, 2].slice(0, 2 + (t >= 3 ? 1 : 0)).forEach((m, i) => blip("game", base * 1.5 * m, { at: i * 0.035, dur: 0.03, gain: 0.045, cutoff: 3600 }));
                    break;
                case "quartz":
                    tone("game", { f: base * 1.5, dur: 0.22 + t * 0.03, gain: 0.05, harm: 0.4, attack: 0.004, cutoff: 4200 });
                    tone("game", { f: base * 2.25, at: 0.05, dur: 0.2 + t * 0.03, gain: 0.035, harm: 0.3, attack: 0.004, cutoff: 4200 });
                    break;
                case "aether":
                    if (!calm()) whoosh("game", { from: 500, to: 1800 + t * 200, dur: 0.18, gain: 0.03 });
                    tone("game", { f: base, dur: 0.3, gain: 0.05, harm: 0.25, attack: 0.04, cutoff: 3000 });
                    tone("game", { f: base * 1.5, at: 0.06, dur: 0.3, gain: 0.04, attack: 0.04, cutoff: 3000 });
                    break;
                case "runes":
                    keyClick("game", { f: 1400, gain: 0.05, q: 2 });
                    tone("game", { f: base * 0.75, dur: 0.18, gain: 0.06, harm: 0.5, attack: 0.004, cutoff: 2200, type: "triangle" });
                    blip("game", base * 1.125, { at: 0.07, dur: 0.05, gain: 0.04, cutoff: 3000 });
                    break;
                case "starglass":
                    [2, 3, 4].forEach((m, i) => tone("game", { f: base * m * 0.75, at: i * 0.03, dur: 0.26, gain: 0.03, harm: 0.4, attack: 0.003, cutoff: 5000 }));
                    break;
                case "voidsteel":
                    tone("game", { f: base * 0.25, dur: 0.22, gain: 0.08, glide: 0.5, cutoff: 600, attack: 0.01 });
                    keyClick("game", { f: 600, gain: 0.06, q: 1.5 });
                    break;
                case "chrono":
                    [0, 0.07, 0.14].forEach((at, i) => blip("game", base * (i % 2 ? 1.2 : 1), { at, dur: 0.025, gain: 0.05, cutoff: 3200 }));
                    tone("game", { f: base * 0.5, at: 0.2, dur: 0.25, gain: 0.04, glide: 1.5, cutoff: 1800, attack: 0.02 });
                    break;
                case "nebula":
                    // a soft swell, like gas catching light
                    if (!calm()) whoosh("game", { from: 300, to: 900 + t * 120, dur: 0.25, gain: 0.025 });
                    tone("game", { f: base * 0.75, dur: 0.35, gain: 0.045, attack: 0.08, cutoff: 2200 });
                    break;
                case "pulsars":
                    // three exact ticks, the last one higher
                    [0, 0.05, 0.1].forEach((at, i) => blip("game", base * (i === 2 ? 2 : 1.5), { at, dur: 0.018, gain: 0.05, cutoff: 5200 }));
                    break;
                case "singularity":
                    // a deep note bending down into silence
                    tone("game", { f: base * 0.5, dur: 0.4, gain: 0.07, glide: 0.4, cutoff: 1200, attack: 0.01 });
                    break;
                case "engrams":
                    // a tape deck: the play key thunks, then a short warble as the tape comes up to speed
                    keyClick("game", { f: 700, gain: 0.06, q: 1.5 });
                    tone("game", { f: base * 0.5, at: 0.04, dur: 0.24, gain: 0.05, glide: 1.06, cutoff: 1600, attack: 0.03, type: "triangle" });
                    break;
                case "paradox":
                    // the same note twice, one rising and one falling, so it lands in two places at once
                    tone("game", { f: base, dur: 0.2, gain: 0.04, glide: 1.5, cutoff: 3600, attack: 0.005 });
                    tone("game", { f: base * 1.5, dur: 0.2, gain: 0.04, glide: 0.667, cutoff: 3600, attack: 0.005 });
                    break;
                case "origin":
                    // a terminal bell: one low root note under a clean high blip
                    tone("game", { f: base * 0.25, dur: 0.35, gain: 0.07, harm: 0.3, cutoff: 900, attack: 0.01 });
                    blip("game", base * 2, { at: 0.03, dur: 0.05, gain: 0.05, cutoff: 4200 });
                    break;
                case "spores":
                case "mycelium":
                case "pollen":
                case "bloom":
                    // Overgrowth: a soft woody pluck that rises, like a stem springing back
                    tone("game", { f: base * 0.75, dur: 0.22, gain: 0.05, glide: 1.25, cutoff: 1800, attack: 0.008, type: "triangle" });
                    blip("game", base * 1.5, { at: 0.05, dur: 0.06, gain: 0.035, cutoff: 3000 });
                    break;
                case "basalt":
                case "magma":
                case "geodes":
                case "sunstone":
                    // Descent: a low struck-stone thud with a bright chip on top
                    tone("game", { f: base * 0.25, dur: 0.3, gain: 0.07, glide: 0.8, harm: 0.4, cutoff: 700, attack: 0.004 });
                    blip("game", base * 3, { at: 0.02, dur: 0.03, gain: 0.03, cutoff: 5200 });
                    break;
                default:
                    blip("game", base, { dur: 0.05, gain: 0.06, cutoff: 2600 });
                    blip("game", base * 1.5, { at: 0.055, dur: 0.07, gain: 0.06, cutoff: 3000 });
                    if (t >= 4) blip("game", base * 2, { at: 0.12, dur: 0.1, gain: 0.05, cutoff: 3200 });
            }
        },
    },
    // the first time a button tier is bought: a lock being picked, one pin at a time, ending on access granted
    nfTierUp: {
        tier: 3,
        bus: "game",
        gap: 500,
        play: (a: { tier?: number } | undefined) => {
            const t = Math.max(1, Math.min(5, a?.tier ?? 1));
            for (let i = 0; i < t; i++) {
                keyClick("game", { at: i * 0.06, f: 2400 + i * 300, gain: 0.05, q: 4 });
                blip("game", 660 * Math.pow(1.122, i * 2), { at: i * 0.06, dur: 0.04, gain: 0.045, cutoff: 2800 });
            }
            const end = t * 0.06 + 0.04;
            tone("game", { f: 1320, at: end, dur: 0.3, gain: 0.06, harm: 0.2, attack: 0.005, cutoff: 3600 });
            tone("game", { f: 1980, at: end + 0.07, dur: 0.34, gain: 0.05, harm: 0.2, attack: 0.005, cutoff: 3800 });
        },
    },
    // a stat decrypting: a bolt thunk, a rising scan and the access chirp
    nfDecrypt: {
        tier: 3,
        bus: "game",
        gap: 900,
        play: () => {
            keyClick("game", { f: 500, gain: 0.09, q: 1.5 });
            blip("game", 110, { dur: 0.14, gain: 0.08, cutoff: 600, type: "sine" });
            if (!calm()) scan(300, 2200, 0.35, 0.03);
            [660, 990, 1320].forEach((f, i) => blip("game", f, { at: 0.38 + i * 0.07, dur: 0.1, gain: 0.06, cutoff: 3200 }));
        },
    },
    nfReboot: {
        tier: 3,
        bus: "game",
        gap: 600,
        play: () => {
            if (!calm()) scan(1400, 180, 0.28, 0.03);
            [440, 660, 880, 1320, 1760].forEach((f, i) => blip("game", f, { at: 0.3 + i * 0.07, dur: 0.1, gain: 0.06, cutoff: 3200 }));
        },
    },
    nfAlert: {
        tier: 3,
        bus: "game",
        gap: 800,
        play: () => [0, 0.16, 0.32].forEach((at) => { blip("game", 1040, { at, dur: 0.08, gain: 0.05, cutoff: 2400 }); blip("game", 780, { at: at + 0.08, dur: 0.07, gain: 0.045, cutoff: 2200 }); }),
    },
    nfBreach: {
        tier: 3,
        bus: "game",
        gap: 400,
        play: () => {
            if (!calm()) scan(300, 2400, 0.2, 0.03);
            [660, 880, 990, 1320, 1980].forEach((f, i) => blip("game", f, { at: 0.12 + i * 0.05, dur: 0.07, gain: 0.06, cutoff: 3200 }));
        },
    },
    nfGoal: {
        tier: 3,
        bus: "game",
        gap: 500,
        play: () => {
            tone("game", { f: 1760, dur: 0.35, gain: 0.05, harm: 0.12, attack: 0.005, cutoff: 4000 });
            blip("game", 1320, { at: 0.08, dur: 0.08, gain: 0.05, cutoff: 2800 });
        },
    },
    // root access: bolts retracting, a deep power-up swell, then a rising ladder that lands on a held chord
    nfAscend: {
        tier: 4,
        bus: "game",
        gap: 1500,
        play: () => {
            [0, 0.14, 0.28, 0.42].forEach((at, i) => { keyClick("game", { at, f: 700 + i * 250, gain: 0.08, q: 2 }); blip("game", 90 + i * 25, { at, dur: 0.1, gain: 0.07, cutoff: 500, type: "sine" }); });
            if (!calm()) scan(120, 3200, 1.4, 0.045);
            whoosh("game", { from: 160, to: 3000, dur: 1.4, gain: 0.07, at: 0.2 });
            tone("game", { f: 82, dur: 2.4, gain: 0.1, attack: 0.5, cutoff: 420 });
            [440, 660, 880, 1100, 1320, 1760, 2200].forEach((f, i) => blip("game", f, { at: 0.8 + i * 0.09, dur: 0.14, gain: 0.06, cutoff: 3400 }));
            [880, 1320, 1760].forEach((f) => tone("game", { f, at: 1.5, dur: 1.4, gain: 0.05, harm: 0.25, attack: 0.04, cutoff: 3600 }));
        },
    },

    // the big button: a soft low bloop that climbs with the combo, and a small sparkle on a crit
    click: {
        tier: 1,
        bus: "game",
        gap: 42,
        play: (a: { mult?: number; crit?: boolean } | undefined) => {
            // Continuous clicking (no pause longer than 1.2 s) counts as one streak. After `clickMute` seconds of it the
            // button goes quiet, fading over the last stretch; a short pause brings it back. 0 means never mute.
            const now = performance.now();
            if (now - streak.last > 1200) streak.start = now;
            streak.last = now;
            const limit = getPrefs().clickMute * 1000;
            let vol = 1;
            if (limit > 0) {
                const t = now - streak.start;
                if (t >= limit) return;
                const fadeFrom = limit * 0.6;
                if (t > fadeFrom) vol = 1 - (t - fadeFrom) / (limit - fadeFrom);
            }
            const m = Math.max(1, a?.mult ?? 1);
            const deg = Math.max(0, Math.min(9, Math.round(Math.log2(m) * 2.2))) + pick("click", 2) - 1;
            tone("game", { f: note(deg - 1), dur: 0.1, gain: 0.13 * vol, glide: 0.8, attack: 0.005, cutoff: 2000, harm: 0.18 });
            tone("game", { f: note(deg - 6), dur: 0.09, gain: 0.09 * vol, attack: 0.004, cutoff: 800 });
            if (a?.crit && vol > 0.3) seq("game", [deg + 4, deg + 7], 0.05, { dur: 0.2, gain: 0.08 * vol, harm: 0.35, at: 0.02 });
        },
    },

    // ---- tier 2: transactions
    // a transfer: two quick square packets up
    buy: { tier: 2, bus: "game", gap: 40, play: () => seq("game", [4, 7], 0.06, { dur: 0.2, gain: 0.12, type: "square", cutoff: 2600 }) },
    bulk: { tier: 2, bus: "game", gap: 60, play: () => seq("game", [3, 5, 7, 9], 0.045, { dur: 0.2, gain: 0.11, type: "square", cutoff: 2600 }) },
    // an unlock: a key click, then a soft rising pair
    equip: {
        tier: 2,
        bus: "game",
        gap: 60,
        play: () => {
            keyClick("game", { f: 2000, gain: 0.05, q: 3 });
            seq("game", [2, 6], 0.075, { dur: 0.26, gain: 0.12, harm: 0.2, type: "triangle", at: 0.02 });
        },
    },
    // a collected item: a short high packet
    collect: { tier: 2, bus: "game", gap: 60, play: () => seq("game", [7, 11], 0.045, { dur: 0.14, gain: 0.12, type: "square", cutoff: 2800 }) },

    // ---- tier 3: rewards
    level: { tier: 3, bus: "game", gap: 300, play: () => seq("game", [4, 6, 8, 10], 0.09, { dur: 0.4, gain: 0.13, harm: 0.25, type: "triangle" }) },
    // a fanfare for a finished run: the access-granted chirp, held longer
    trophy: { tier: 3, bus: "game", gap: 300, play: () => seq("game", [5, 7, 9, 12], 0.08, { dur: 0.36, gain: 0.12, type: "square", cutoff: 3000 }) },
    tier: { tier: 3, bus: "game", gap: 300, play: () => seq("game", [6, 8], 0.08, { dur: 0.35, gain: 0.12, harm: 0.3 }) },
    // a system reset: a rising sweep, then the level ladder
    rebirth: {
        tier: 3,
        bus: "game",
        gap: 800,
        play: () => {
            whoosh("game", { from: 260, to: 2400, dur: 0.6, gain: 0.07 });
            seq("game", [2, 4, 6, 8, 10], 0.08, { dur: 0.5, gain: 0.12, harm: 0.3, type: "triangle", at: 0.1 });
            seq("game", [5, 7, 9], 0, { dur: 1.1, gain: 0.1, harm: 0.2, at: 0.55 });
        },
    },

    // ---- tier 4: hero
    // root access: a sweep, a low tone and a long rising ladder
    ascend: {
        tier: 4,
        bus: "game",
        gap: 1200,
        play: () => {
            whoosh("game", { from: 200, to: 3200, dur: 1.0, gain: 0.09 });
            tone("game", { f: note(-8), dur: 1.8, gain: 0.14, attack: 0.3, cutoff: 500 });
            seq("game", [0, 2, 4, 6, 8, 10, 12], 0.09, { dur: 0.6, gain: 0.11, harm: 0.35, type: "triangle", at: 0.15 });
            seq("game", [7, 9, 11, 14], 0, { dur: 1.7, gain: 0.09, harm: 0.25, at: 0.85 });
        },
    },

    // egg and enchant reveals, scaled by rarity index 0..7
    charge: {
        tier: 2,
        bus: "game",
        gap: 80,
        play: (a: { r: number; ms: number }) => {
            // one soft rising breath, only ever the last second and a half of the charge
            const d = Math.min(1.5, Math.max(0.3, a.ms / 1000));
            whoosh("game", { from: 260, to: 800 + a.r * 220, dur: d, gain: 0.018 + a.r * 0.003, q: 1.2, at: Math.max(0, a.ms / 1000 - d) });
        },
    },
    reveal: {
        tier: (a: { r: number }) => (a.r >= 5 ? 3 : 2),
        bus: "game",
        gap: 80,
        play: (a: { r: number }) => {
            // a small soft chord that grows a little with rarity, never longer than about 0.8 s and never a drone
            const r = Math.max(0, Math.min(7, a.r));
            const n = Math.min(4, 2 + (r >= 3 ? 1 : 0) + (r >= 6 ? 1 : 0));
            seq("game", [4, 6, 7, 9].slice(0, n), 0.07, { dur: 0.3 + r * 0.03, gain: 0.07 + r * 0.004, harm: 0.15, cutoff: 2400 });
            if (r >= 4) whoosh("game", { from: 500, to: 2200, dur: 0.35, gain: 0.018 + (r - 4) * 0.005 });
            if (r >= 5) tone("game", { f: note(12), at: 0.16, dur: 0.45, gain: 0.04, harm: 0.3, cutoff: 3000, attack: 0.02 });
            if (r >= 7) tone("game", { f: note(-5), at: 0.05, dur: 0.7, gain: 0.05, attack: 0.12, cutoff: 500 });
        },
    },
} satisfies Record<string, Def>;

export type SfxName = keyof typeof DEFS;

/**
 * Play a named sound if sound is on, unlocked, and the rate limit allows it. Safe on the server (does nothing).
 * Games call this directly, e.g. `sfx("granted")` on a correct guess, `sfx("deny")` on a wrong one, `sfx("trophy")` on a win.
 */
export function sfx(name: SfxName, arg?: unknown) {
    const d: Def = DEFS[name];
    if (!gate(name, typeof d.tier === "function" ? d.tier(arg) : d.tier, d.gap)) return;
    d.play(arg);
}
