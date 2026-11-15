// Starwright sound: a few synthesized blips, no audio files. Browsers only start audio after a click or key, so the
// context is made on first use. Off switch is saved in this browser (sw-sound-v1). Never runs under node.
const KEY = "sw-sound-v1";
let ctx: AudioContext | null = null;
let on: boolean | null = null;
let armed = false;

/** Audio may only start after a click, tap or key press; until one happens every sound is skipped quietly. */
function arm() {
    armed = true;
    window.removeEventListener("pointerdown", arm);
    window.removeEventListener("keydown", arm);
}
if (typeof window !== "undefined") {
    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
}

export function soundOn(): boolean {
    if (on === null) {
        try { on = window.localStorage.getItem(KEY) !== "off"; } catch { on = true; }
    }
    return on;
}

export function setSound(v: boolean) {
    on = v;
    try { window.localStorage.setItem(KEY, v ? "on" : "off"); } catch { /* private mode */ }
}

type Name = "buy" | "ignite" | "nova" | "visitor" | "answer" | "badge" | "cloud" | "milestone";

const PLAN: Record<Name, Array<[freq: number, at: number, len: number, type?: OscillatorType, vol?: number]>> = {
    buy: [[520, 0, 0.05, "square", 0.05]],
    milestone: [[392, 0, 0.08, "triangle", 0.09], [588, 0.07, 0.08, "triangle", 0.09], [784, 0.14, 0.16, "triangle", 0.09]],
    ignite: [[110, 0, 0.5, "sawtooth", 0.07], [220, 0.05, 0.4, "triangle", 0.08], [440, 0.1, 0.3, "triangle", 0.06]],
    nova: [[55, 0, 1.4, "sawtooth", 0.14], [82, 0.05, 1.2, "square", 0.08], [880, 0.4, 0.8, "triangle", 0.05]],
    visitor: [[660, 0, 0.12, "sine", 0.08], [880, 0.16, 0.2, "sine", 0.08]],
    answer: [[440, 0, 0.07, "triangle", 0.08], [660, 0.06, 0.12, "triangle", 0.08]],
    badge: [[523, 0, 0.09, "square", 0.05], [659, 0.09, 0.09, "square", 0.05], [784, 0.18, 0.09, "square", 0.05], [1047, 0.27, 0.2, "square", 0.05]],
    cloud: [[330, 0, 0.2, "sine", 0.09], [495, 0.1, 0.3, "sine", 0.07]],
};

export function play(name: Name) {
    if (typeof window === "undefined" || !armed || !soundOn()) return;
    try {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        ctx ??= new AC();
        if (ctx.state === "suspended") void ctx.resume();
        const t0 = ctx.currentTime + 0.01;
        for (const [freq, at, len, type = "sine", vol = 0.06] of PLAN[name]) {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = type;
            o.frequency.setValueAtTime(freq, t0 + at);
            if (name === "nova") o.frequency.exponentialRampToValueAtTime(freq * 0.4, t0 + at + len);
            g.gain.setValueAtTime(0.0001, t0 + at);
            g.gain.exponentialRampToValueAtTime(vol, t0 + at + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
            o.connect(g).connect(ctx.destination);
            o.start(t0 + at);
            o.stop(t0 + at + len + 0.02);
        }
    } catch { /* no audio on this device */ }
}
