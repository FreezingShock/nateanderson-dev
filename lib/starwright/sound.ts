// Starwright sound: every sound is made in code with the Web Audio API (oscillators, filtered noise and a small made-up room
// reverb). No audio files, nothing downloaded. Browsers only start audio after a click or key, so the context is made on first
// use. The on/off switch and the volume are saved in this browser (sw-sound-v1, sw-volume-v1). Never runs under node.
//
// One sound language: the ladder is a pentatonic scale, so buying up the rows climbs a tune; tier I is a single pluck, tier II a
// fifth, tier III an arpeggio. Elements ignite as a warm chord that is higher for heavier elements. Each constellation has its own
// timbre. Menus open with a rising air sweep and close with a falling one. `renderSound` is exported so a test can draw any sound
// into an OfflineAudioContext (scripts/starwright/audio-render.mjs).
const KEY = "sw-sound-v1";
const VOL_KEY = "sw-volume-v1";
let ctx: AudioContext | null = null;
let chain: Chain | null = null;
let on: boolean | null = null;
let vol: number | null = null;
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

/** Volume steps: the label the Menu shows and the gain behind it. */
export const VOLUMES: ReadonlyArray<[label: string, gain: number]> = [["Low", 0.4], ["Medium", 0.75], ["High", 1.1]];
export const DEFAULT_VOLUME = 1;

/** Index into VOLUMES. */
export function getVolume(): number {
    if (vol === null) {
        try {
            const raw = window.localStorage.getItem(VOL_KEY);
            const n = raw === null ? DEFAULT_VOLUME : Number(raw);
            vol = Number.isInteger(n) && n >= 0 && n < VOLUMES.length ? n : DEFAULT_VOLUME;
        } catch { vol = DEFAULT_VOLUME; }
    }
    return vol;
}

export function setVolume(i: number) {
    vol = Math.max(0, Math.min(VOLUMES.length - 1, Math.round(i)));
    try { window.localStorage.setItem(VOL_KEY, String(vol)); } catch { /* private mode */ }
    if (chain) chain.master.gain.setTargetAtTime(VOLUMES[vol][1] * MASTER, chain.ctx.currentTime, 0.02);
}

export type SoundName =
    | "buy" | "milestone" | "ignite" | "perk" | "planet" | "deep" | "badge" | "ready"
    | "nova" | "visitor" | "answer" | "cloud"
    | "click" | "open" | "close" | "tab" | "page" | "toggleOn" | "toggleOff" | "deny" | "reset";

/** What a sound is told about the thing that made it. Everything is optional. */
export interface SoundOpt {
    /** Ladder row (0 is hydrogen): sets the pitch of buys and ignitions. */
    row?: number;
    /** Tier button 0, 1 or 2. */
    tier?: number;
    /** Constellation id (lantern, kiln, anvil, loom, pulsar, deep) for a lit star. */
    con?: string;
    /** 0 supernova, 1 neutron star, 2 black hole. */
    kind?: number;
    /** Page direction for a page flip: 1 forward, -1 back. */
    dir?: number;
}

// ---- the synth ---------------------------------------------------------------------------------------------------------------

const MASTER = 0.9;
export interface Chain { ctx: BaseAudioContext; master: GainNode; dry: GainNode; wet: GainNode }

/** A short made-up room: noise that fades out, a little different in each ear. */
function impulse(ctx: BaseAudioContext): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * 1.3);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
    for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        let lp = 0;
        for (let i = 0; i < len; i++) {
            const t = i / len;
            lp += (rnd() * 2 - lp) * (0.55 - 0.4 * t);
            d[i] = lp * Math.pow(1 - t, 2.6);
        }
    }
    return buf;
}

/** Master gain -> soft limiter -> speakers, with a dry bus and a reverb bus feeding it. */
export function buildChain(ctx: BaseAudioContext, gain = 1): Chain {
    const master = ctx.createGain();
    master.gain.value = gain * MASTER;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -14; lim.knee.value = 12; lim.ratio.value = 6; lim.attack.value = 0.004; lim.release.value = 0.18;
    master.connect(lim).connect(ctx.destination);
    const dry = ctx.createGain();
    dry.connect(master);
    const wet = ctx.createGain();
    wet.gain.value = 0.34;
    const conv = ctx.createConvolver();
    conv.buffer = impulse(ctx);
    wet.connect(conv).connect(master);
    return { ctx, master, dry, wet };
}

interface ToneOpt { type?: OscillatorType; vol?: number; attack?: number; to?: number; lp?: number; hp?: number; q?: number; detune?: number; room?: number; pan?: number; curve?: "exp" | "lin" }

/** One pitched voice: oscillator -> optional filters -> envelope -> dry and reverb buses. */
function tone(c: Chain, t: number, f: number, len: number, o: ToneOpt = {}) {
    const { ctx } = c;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + len);
    if (o.detune) osc.detune.value = o.detune;
    let node: AudioNode = osc;
    if (o.lp) { const b = ctx.createBiquadFilter(); b.type = "lowpass"; b.frequency.value = o.lp; b.Q.value = o.q ?? 0.7; node.connect(b); node = b; }
    if (o.hp) { const b = ctx.createBiquadFilter(); b.type = "highpass"; b.frequency.value = o.hp; node.connect(b); node = b; }
    const g = ctx.createGain();
    const a = o.attack ?? 0.006;
    const v = o.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    node.connect(g);
    let out: AudioNode = g;
    if (o.pan && "createStereoPanner" in ctx) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; g.connect(p); out = p; }
    out.connect(c.dry);
    if (o.room) { const r = ctx.createGain(); r.gain.value = o.room; out.connect(r).connect(c.wet); }
    osc.start(t);
    osc.stop(t + len + 0.03);
}

interface NoiseOpt { vol?: number; attack?: number; type?: BiquadFilterType; f?: number; to?: number; q?: number; room?: number }
let noiseBuf: AudioBuffer | null = null;
let noiseFor: BaseAudioContext | null = null;

/** A burst of filtered noise; the filter can sweep from `f` to `to`. */
function noise(c: Chain, t: number, len: number, o: NoiseOpt = {}) {
    const { ctx } = c;
    if (noiseFor !== ctx || !noiseBuf) {
        noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        let seed = 13;
        for (let i = 0; i < d.length; i++) { seed = (seed * 16807) % 2147483647; d[i] = seed / 2147483647 * 2 - 1; }
        noiseFor = ctx;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const b = ctx.createBiquadFilter();
    b.type = o.type ?? "bandpass";
    b.frequency.setValueAtTime(o.f ?? 1200, t);
    if (o.to) b.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), t + len);
    b.Q.value = o.q ?? 0.9;
    const g = ctx.createGain();
    const a = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol ?? 0.1, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(b).connect(g).connect(c.dry);
    if (o.room) { const r = ctx.createGain(); r.gain.value = o.room; g.connect(r).connect(c.wet); }
    src.start(t, 0.1);
    src.stop(t + len + 0.03);
}

/** A struck bell: a sine with two inharmonic partials that die faster. */
function bell(c: Chain, t: number, f: number, len: number, v: number, room = 0.5) {
    tone(c, t, f, len, { vol: v, room, attack: 0.003 });
    tone(c, t, f * 2.76, len * 0.5, { vol: v * 0.35, room, attack: 0.003 });
    tone(c, t, f * 5.4, len * 0.25, { vol: v * 0.16, room, attack: 0.003 });
}

/** The ladder as a scale: five notes to the octave, rising with the row. */
const PENT = [0, 2, 4, 7, 9];
const hz = (semis: number, base = 220) => base * Math.pow(2, semis / 12);
const rowHz = (row: number, base = 196) => hz(PENT[row % 5] + 12 * Math.floor(row / 5), base);

const SCALES: Record<string, { base: number; steps: number[]; type: OscillatorType; lp: number; hit: "air" | "heat" | "metal" | "wool" | "pulse" | "deep" }> = {
    lantern: { base: 523, steps: [0, 4, 7, 12], type: "sine", lp: 6000, hit: "air" },
    kiln: { base: 330, steps: [0, 3, 7, 10], type: "triangle", lp: 3200, hit: "heat" },
    anvil: { base: 262, steps: [0, 7, 12, 19], type: "square", lp: 2200, hit: "metal" },
    loom: { base: 392, steps: [0, 2, 7, 9], type: "triangle", lp: 4000, hit: "wool" },
    pulsar: { base: 659, steps: [0, 5, 12, 17], type: "sine", lp: 8000, hit: "pulse" },
    deep: { base: 98, steps: [0, 7, 12, 19], type: "sine", lp: 1600, hit: "deep" },
};

/** How loud each sound is against the others (UI ticks are small and quiet by nature, so they get the most lift). */
const LEVEL: Record<string, number> = {
    click: 2.2, open: 2, close: 2.2, tab: 2.2, page: 2.2, toggleOn: 1.9, toggleOff: 1.9, deny: 2.2, buy0: 2.1, buy1: 1.7, buy2: 1.35, milestone: 1.5,
    ignite: 1.35, perk: 1.4, deep: 1.1, planet: 1.5, badge: 1.5, ready: 1.6, visitor: 1.7, answer: 1.9, cloud: 1.6, nova: 1.25, reset: 1.9,
};

/** Draws one sound into a chain starting at time `t`, at its own level. Returns how long it lasts. */
export function renderSound(c: Chain, name: SoundName, t: number, o: SoundOpt = {}): number {
    const k = LEVEL[name === "buy" ? `buy${Math.min(2, o.tier ?? 0)}` : name] ?? 1;
    const dry = c.ctx.createGain();
    const wet = c.ctx.createGain();
    dry.gain.value = k;
    wet.gain.value = k;
    dry.connect(c.dry);
    wet.connect(c.wet);
    return draw({ ...c, dry, wet }, name, t, o);
}

function draw(c: Chain, name: SoundName, t: number, o: SoundOpt): number {
    switch (name) {
        case "click":
            tone(c, t, 1100, 0.035, { type: "triangle", vol: 0.1, to: 640, attack: 0.002 });
            noise(c, t, 0.02, { vol: 0.05, type: "highpass", f: 3000 });
            return 0.06;
        case "open":
            noise(c, t, 0.32, { vol: 0.07, f: 260, to: 2600, q: 1.1, attack: 0.05, room: 0.5 });
            tone(c, t, 196, 0.3, { type: "sine", vol: 0.1, to: 392, attack: 0.04, room: 0.3 });
            tone(c, t + 0.14, 1318, 0.2, { type: "sine", vol: 0.05, room: 0.6 });
            return 0.5;
        case "close":
            noise(c, t, 0.22, { vol: 0.055, f: 2200, to: 220, q: 1.1, attack: 0.012, room: 0.3 });
            tone(c, t, 392, 0.2, { type: "sine", vol: 0.08, to: 196, attack: 0.01, room: 0.2 });
            return 0.3;
        case "tab":
            tone(c, t, 520, 0.09, { type: "triangle", vol: 0.1, to: 780, attack: 0.004, room: 0.25 });
            tone(c, t + 0.05, 780, 0.12, { type: "sine", vol: 0.07, room: 0.35 });
            return 0.22;
        case "page": {
            const d = (o.dir ?? 1) >= 0 ? 1 : -1;
            tone(c, t, d > 0 ? 600 : 760, 0.05, { type: "triangle", vol: 0.09, attack: 0.003, room: 0.2 });
            tone(c, t + 0.035, d > 0 ? 780 : 580, 0.07, { type: "triangle", vol: 0.08, attack: 0.003, room: 0.25 });
            return 0.14;
        }
        case "toggleOn":
            tone(c, t, 440, 0.07, { type: "triangle", vol: 0.1, room: 0.2 });
            tone(c, t + 0.06, 660, 0.12, { type: "triangle", vol: 0.1, room: 0.3 });
            return 0.22;
        case "toggleOff":
            tone(c, t, 660, 0.07, { type: "triangle", vol: 0.09, room: 0.2 });
            tone(c, t + 0.06, 440, 0.12, { type: "triangle", vol: 0.08, room: 0.3 });
            return 0.22;
        case "deny":
            tone(c, t, 190, 0.11, { type: "triangle", vol: 0.13, to: 120, lp: 900, attack: 0.004 });
            noise(c, t, 0.05, { vol: 0.04, type: "lowpass", f: 700 });
            return 0.16;
        case "buy": {
            // tier I is one pluck, tier II adds the fifth, tier III runs up an arpeggio and ends on a soft thump
            const tier = o.tier ?? 0;
            const f = rowHz(o.row ?? 0);
            if (tier === 0) {
                tone(c, t, f, 0.16, { type: "triangle", vol: 0.16, lp: 3400, room: 0.18 });
                tone(c, t, f * 2, 0.07, { type: "sine", vol: 0.05 });
                noise(c, t, 0.018, { vol: 0.05, type: "highpass", f: 2500 });
                return 0.22;
            }
            if (tier === 1) {
                tone(c, t, f, 0.2, { type: "triangle", vol: 0.15, lp: 3600, room: 0.22 });
                tone(c, t + 0.055, f * 1.5, 0.22, { type: "triangle", vol: 0.14, lp: 3800, room: 0.25 });
                tone(c, t + 0.055, f * 3, 0.1, { type: "sine", vol: 0.04, room: 0.3 });
                noise(c, t, 0.02, { vol: 0.05, type: "highpass", f: 2500 });
                return 0.3;
            }
            [1, 1.25, 1.5, 2].forEach((m, k) => tone(c, t + k * 0.05, f * m, 0.26, { type: "triangle", vol: 0.14 + k * 0.012, lp: 4200, room: 0.3 }));
            tone(c, t, f / 4, 0.22, { type: "sine", vol: 0.2, to: f / 5, attack: 0.004 });
            tone(c, t + 0.15, f * 4, 0.3, { type: "sine", vol: 0.04, room: 0.6 });
            return 0.5;
        }
        case "milestone": {
            // a row's burners double: a bright run up the row's own scale, with a bell on top
            const f = rowHz(o.row ?? 0, 262);
            [0, 4, 7, 12].forEach((s, k) => tone(c, t + k * 0.065, hz(s, f), 0.22, { type: "triangle", vol: 0.12, lp: 5000, room: 0.35 }));
            bell(c, t + 0.22, f * 4, 0.7, 0.07, 0.7);
            tone(c, t, f / 2, 0.3, { type: "sine", vol: 0.14, to: f / 2.5 });
            return 0.95;
        }
        case "ignite": {
            // a new element ignites: air rushes in, a warm chord opens, a flash rings. Heavier elements sit higher and burn longer.
            const row = o.row ?? 0;
            const f = hz(row * 1.4, 98);
            noise(c, t, 0.7, { vol: 0.08, type: "lowpass", f: 300, to: 3200, q: 0.7, attack: 0.18, room: 0.4 });
            tone(c, t, f, 1.0, { type: "sawtooth", vol: 0.07, lp: 900 + row * 140, attack: 0.12, room: 0.4 });
            tone(c, t + 0.02, f * 1.5, 0.95, { type: "triangle", vol: 0.09, attack: 0.12, room: 0.5 });
            tone(c, t + 0.04, f * 2, 0.9, { type: "triangle", vol: 0.08, attack: 0.12, room: 0.5 });
            bell(c, t + 0.28, f * 8, 0.9, 0.05 + Math.min(0.04, row * 0.004), 0.8);
            return 1.3;
        }
        case "perk": {
            // a star is lit: its constellation plays four notes in its own voice
            const sc = SCALES[o.con ?? "lantern"] ?? SCALES.lantern;
            sc.steps.forEach((s, k) => {
                const f = hz(s, sc.base);
                if (sc.hit === "metal") {
                    tone(c, t + k * 0.075, f, 0.34, { type: "square", vol: 0.07, lp: sc.lp, room: 0.35 });
                    bell(c, t + k * 0.075, f * 2, 0.5, 0.05, 0.5);
                } else if (sc.hit === "heat") {
                    tone(c, t + k * 0.075, f, 0.4, { type: sc.type, vol: 0.13, lp: sc.lp, room: 0.3 });
                    noise(c, t + k * 0.075, 0.05, { vol: 0.03, type: "highpass", f: 4000 });
                } else if (sc.hit === "deep") {
                    tone(c, t + k * 0.12, f, 0.9, { type: "sine", vol: 0.15, room: 0.6, attack: 0.03 });
                    tone(c, t + k * 0.12, f * 4, 0.5, { type: "sine", vol: 0.04, room: 0.7 });
                } else if (sc.hit === "pulse") {
                    tone(c, t + k * 0.07, f, 0.22, { type: "sine", vol: 0.12, to: f * 1.01, room: 0.6 });
                    tone(c, t + k * 0.07, f * 2, 0.1, { type: "sine", vol: 0.05, room: 0.6 });
                } else if (sc.hit === "wool") {
                    tone(c, t + k * 0.08, f, 0.45, { type: sc.type, vol: 0.12, lp: sc.lp, detune: -7, room: 0.35, attack: 0.012 });
                    tone(c, t + k * 0.08, f, 0.45, { type: sc.type, vol: 0.1, lp: sc.lp, detune: 7, room: 0.35, attack: 0.012 });
                } else {
                    bell(c, t + k * 0.07, f, 0.6, 0.1, 0.6);
                }
            });
            const end = sc.steps.length * (sc.hit === "deep" ? 0.12 : 0.075);
            if (sc.hit === "deep") tone(c, t, 49, 0.9, { type: "sine", vol: 0.2, to: 41 });
            tone(c, t + end, hz(sc.steps[sc.steps.length - 1] + 12, sc.base), 0.7, { type: "sine", vol: 0.04, room: 0.8 });
            return end + 0.8;
        }
        case "deep":
            return draw(c, "perk", t, { con: "deep" });
        case "planet": {
            // a world forms: a swell rises, then a low note and a chime settle
            noise(c, t, 0.5, { vol: 0.05, f: 200, to: 1800, q: 0.9, attack: 0.2, room: 0.5 });
            tone(c, t, 130, 0.6, { type: "sine", vol: 0.13, to: 260, attack: 0.2, room: 0.4 });
            tone(c, t + 0.4, 196, 0.8, { type: "triangle", vol: 0.12, lp: 2200, room: 0.5 });
            bell(c, t + 0.42, 784, 0.9, 0.08, 0.8);
            bell(c, t + 0.55, 1175, 0.8, 0.05, 0.8);
            return 1.4;
        }
        case "badge": {
            [523, 659, 784, 1047].forEach((f, k) => bell(c, t + k * 0.085, f, 0.5, 0.09, 0.6));
            return 0.9;
        }
        case "ready":
            bell(c, t, 659, 0.5, 0.09, 0.6);
            bell(c, t + 0.14, 988, 0.7, 0.09, 0.7);
            return 0.9;
        case "visitor":
            bell(c, t, 740, 0.7, 0.08, 0.8);
            bell(c, t + 0.18, 988, 0.9, 0.07, 0.8);
            tone(c, t, 185, 0.5, { type: "sine", vol: 0.06, attack: 0.05, room: 0.5 });
            return 1.1;
        case "answer":
            tone(c, t, 440, 0.08, { type: "triangle", vol: 0.1, room: 0.2 });
            tone(c, t + 0.06, 660, 0.14, { type: "triangle", vol: 0.1, room: 0.3 });
            tone(c, t + 0.12, 880, 0.2, { type: "sine", vol: 0.05, room: 0.5 });
            return 0.34;
        case "cloud":
            noise(c, t, 0.5, { vol: 0.045, f: 500, to: 2400, q: 0.8, attack: 0.15, room: 0.6 });
            tone(c, t, 330, 0.5, { type: "sine", vol: 0.1, attack: 0.08, room: 0.6 });
            tone(c, t + 0.1, 495, 0.55, { type: "sine", vol: 0.08, attack: 0.08, room: 0.6 });
            tone(c, t + 0.2, 660, 0.6, { type: "sine", vol: 0.05, attack: 0.08, room: 0.7 });
            return 0.9;
        case "nova": {
            // supernova: a rising breath, a deep boom, a wash of noise falling away, and a faint ring left over
            const kind = o.kind ?? 0;
            const low = kind === 2 ? 36 : kind === 1 ? 48 : 58;
            noise(c, t, 0.45, { vol: 0.06, type: "bandpass", f: 200, to: 3000, q: 0.8, attack: 0.4, room: 0.4 });
            const b = t + 0.45;
            tone(c, b, low * 2, 1.8, { type: "sine", vol: 0.34, to: low * 0.55, attack: 0.008, room: 0.3 });
            tone(c, b, low * 4, 0.9, { type: "sawtooth", vol: 0.07, to: low, lp: 700, room: 0.3 });
            noise(c, b, 1.6, { vol: 0.2, type: "lowpass", f: 4200, to: 140, q: 0.6, attack: 0.01, room: 0.5 });
            if (kind === 1) bell(c, b + 0.3, 1480, 2.4, 0.07, 0.9);
            if (kind === 2) tone(c, b + 0.2, 55, 2.6, { type: "sine", vol: 0.2, to: 24, attack: 0.3, room: 0.8 });
            if (kind === 0) bell(c, b + 0.6, 880, 1.6, 0.05, 0.9);
            return 3.2;
        }
        case "reset":
            tone(c, t, 440, 0.4, { type: "triangle", vol: 0.1, to: 110, lp: 1600, room: 0.4 });
            noise(c, t, 0.3, { vol: 0.05, type: "lowpass", f: 1500, to: 120 });
            return 0.5;
    }
}

// ---- playing -----------------------------------------------------------------------------------------------------------------

const lastAt: Partial<Record<string, number>> = {};
/** Same sound twice within this many milliseconds is dropped, so a held key does not turn into a buzz. */
const GAP: Partial<Record<SoundName, number>> = { buy: 45, click: 30, page: 60, tab: 90, open: 120, close: 120, deny: 150 };

export function play(name: SoundName, opt: SoundOpt = {}) {
    if (typeof window === "undefined" || !armed || !soundOn() || document.hidden) return;
    const now = performance.now();
    const gap = GAP[name] ?? 0;
    const key = `${name}${name === "buy" ? opt.row ?? "" : ""}`;
    if (gap && now - (lastAt[key] ?? -1e9) < gap) return;
    lastAt[key] = now;
    try {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        if (!ctx) { ctx = new AC(); chain = buildChain(ctx, VOLUMES[getVolume()][1]); }
        if (ctx.state === "suspended") void ctx.resume();
        if (!chain) return;
        renderSound(chain, name, ctx.currentTime + 0.01, opt);
    } catch { /* no audio on this device */ }
}
