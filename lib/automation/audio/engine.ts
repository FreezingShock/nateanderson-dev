// Brasswork's audio engine: one Web Audio graph, built on the first click, tap or key press (browsers require one),
// with every sound synthesized in code (no audio files, nothing third-party). The graph is
//
//   effects ──┬─ dry ───────────┐
//             └─ room (reverb) ─┤
//   ambient ──────────────────── ┴─ tone (low-pass) ─ compressor ─ master ─ speakers
//
// so the Settings sliders are master, effects and ambient. The context is suspended while the tab is hidden and while
// sound is switched off, so a muted or background game costs no audio CPU. A voice cap and per-sound rate limits keep
// a big factory from stacking into noise.

export type Bus = "fx" | "amb";
export type Mix = { master: number; effects: number; ambient: number };

const KEY = "bw-audio-v1";
const DEFAULT_MIX: Mix = { master: 0.8, effects: 0.9, ambient: 0.6 };

let mix: Mix = { ...DEFAULT_MIX };
let loaded = false;
let enabled = true; // the Settings "Sound" switch; muted games keep the context suspended
const subs = new Set<() => void>();

const clamp01 = (n: unknown, d: number) => (typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : d);

function load() {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
        const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
        if (raw && typeof raw === "object") mix = { master: clamp01(raw.master, DEFAULT_MIX.master), effects: clamp01(raw.effects, DEFAULT_MIX.effects), ambient: clamp01(raw.ambient, DEFAULT_MIX.ambient) };
    } catch {
        /* private window: keep the defaults for this visit */
    }
}

export function getMix(): Mix {
    load();
    return mix;
}
export function subscribeMix(fn: () => void) {
    subs.add(fn);
    return () => {
        subs.delete(fn);
    };
}
export function setMix(p: Partial<Mix>) {
    load();
    mix = { master: clamp01(p.master, mix.master), effects: clamp01(p.effects, mix.effects), ambient: clamp01(p.ambient, mix.ambient) };
    try {
        localStorage.setItem(KEY, JSON.stringify(mix));
    } catch {
        /* ignore */
    }
    applyMix();
    subs.forEach((f) => f());
}

// ---------------------------------------------------------------- the graph

export type Graph = { ctx: AudioContext; fx: GainNode; amb: GainNode; master: GainNode; noise: AudioBuffer };
let g: Graph | null = null;
let armed = false;
let removeArm: (() => void) | null = null;

function impulse(ctx: AudioContext) {
    // A small dark workshop room: decaying noise, low-passed by averaging.
    const len = Math.floor(ctx.sampleRate * 0.7);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c);
        let last = 0;
        for (let i = 0; i < len; i++) {
            last = last * 0.8 + (Math.random() * 2 - 1) * 0.2;
            d[i] = last * Math.pow(1 - i / len, 2.8);
        }
    }
    return b;
}

function build(): Graph | null {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC({ latencyHint: "interactive" });
    const fx = ctx.createGain();
    const amb = ctx.createGain();
    const master = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const room = ctx.createConvolver();
    room.buffer = impulse(ctx);
    const tone = ctx.createBiquadFilter(); // takes the top off everything: warm, never bright
    tone.type = "lowpass";
    tone.frequency.value = 6000;
    tone.Q.value = 0.4;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -22;
    comp.knee.value = 20;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.2;
    dry.gain.value = 0.9;
    wet.gain.value = 0.16;
    fx.connect(dry);
    fx.connect(wet);
    wet.connect(room);
    room.connect(tone);
    dry.connect(tone);
    amb.connect(tone);
    tone.connect(comp);
    comp.connect(master);
    master.connect(ctx.destination);
    // four seconds of white noise, looped by the wind, water and every click
    const noise = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return { ctx, fx, amb, master, noise };
}

// squared, so the sliders feel even to the ear
const curve = (v: number) => v * v;

function applyMix() {
    if (!g) return;
    const t = g.ctx.currentTime;
    g.master.gain.setTargetAtTime(curve(mix.master) * 1.5, t, 0.03);
    g.fx.gain.setTargetAtTime(curve(mix.effects), t, 0.03);
    g.amb.gain.setTargetAtTime(curve(mix.ambient), t, 0.03);
}

/** The context sleeps while the tab is hidden or sound is off; it wakes only when both allow it. */
function sync() {
    if (!g) return;
    const want = enabled && !document.hidden;
    if (want && g.ctx.state === "suspended") void g.ctx.resume();
    else if (!want && g.ctx.state === "running") void g.ctx.suspend();
    readyListeners.forEach((f) => f(want));
}

const readyListeners = new Set<(running: boolean) => void>();
/** Called whenever the graph starts or sleeps (true = awake). The ambient layer uses it to start and stop its beds. */
export function onRunState(fn: (running: boolean) => void) {
    readyListeners.add(fn);
    return () => {
        readyListeners.delete(fn);
    };
}

/** Start listening for the first gesture. Call once when the game mounts; `disposeAudio` undoes it. */
export function armAudio() {
    if (armed || typeof window === "undefined") return;
    armed = true;
    load();
    const unlock = () => {
        if (!g) {
            g = build();
            applyMix();
        }
        sync();
    };
    const vis = () => sync();
    for (const ev of ["pointerdown", "keydown", "touchstart"] as const) window.addEventListener(ev, unlock, { capture: true, passive: true });
    document.addEventListener("visibilitychange", vis);
    removeArm = () => {
        for (const ev of ["pointerdown", "keydown", "touchstart"] as const) window.removeEventListener(ev, unlock, { capture: true });
        document.removeEventListener("visibilitychange", vis);
    };
}

export function disposeAudio() {
    removeArm?.();
    removeArm = null;
    armed = false;
    readyListeners.clear();
    if (g) void g.ctx.close();
    g = null;
    active = 0;
    lastPlay.clear();
}

export function setEnabled(on: boolean) {
    if (enabled === on) return;
    enabled = on;
    sync();
}
export const isEnabled = () => enabled;
export const graph = () => (g && g.ctx.state === "running" ? g : null);
/** The graph even while it is still waking (beds are built as soon as the context exists). */
export const rawGraph = () => g;

// ---------------------------------------------------------------- voices

let active = 0;
const MAX_VOICES = 22;
const lastPlay = new Map<string, number>();

/** Rate limit and voice cap. Returns false when a sound should be skipped. */
export function gate(id: string, minGapMs: number): boolean {
    if (!graph() || active > MAX_VOICES) return false;
    const now = performance.now();
    if (now - (lastPlay.get(id) ?? -1e9) < minGapMs) return false;
    lastPlay.set(id, now);
    return true;
}

const bus = (gr: Graph, b: Bus) => (b === "fx" ? gr.fx : gr.amb);

export type Tone = { f: number; at?: number; dur?: number; gain?: number; type?: OscillatorType; glide?: number; attack?: number; cutoff?: number; harm?: number; bus?: Bus };
export function tone(o: Tone) {
    const gr = graph();
    if (!gr) return;
    const { ctx } = gr;
    const t0 = ctx.currentTime + (o.at ?? 0) + 0.004;
    const dur = o.dur ?? 0.16;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.linearRampToValueAtTime(Math.max(0.0002, (o.gain ?? 0.15) * 0.9), t0 + (o.attack ?? 0.006));
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let end: AudioNode = out;
    if (o.cutoff) {
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = o.cutoff;
        lp.Q.value = 0.5;
        out.connect(lp);
        end = lp;
    }
    end.connect(bus(gr, o.bus ?? "fx"));
    const mk = (f: number, gm: number) => {
        const osc = ctx.createOscillator();
        osc.type = o.type ?? "sine";
        osc.frequency.setValueAtTime(f, t0);
        if (o.glide && o.glide !== 1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f * o.glide), t0 + Math.min(dur, 0.18));
        const vg = ctx.createGain();
        vg.gain.value = gm;
        osc.connect(vg);
        vg.connect(out);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
        active++;
        osc.onended = () => {
            active--;
            vg.disconnect();
            osc.disconnect();
            if (gm === 1) end.disconnect();
        };
    };
    mk(o.f, 1);
    if (o.harm) mk(o.f * 2, o.harm);
}

export type Click = { f: number; q?: number; at?: number; dur?: number; gain?: number; bus?: Bus; sweepTo?: number };
/** A short band-passed noise burst: relay clicks, ratchets, crackle and thumps' attack. `sweepTo` slides the band. */
export function click(o: Click) {
    const gr = graph();
    if (!gr) return;
    const { ctx } = gr;
    const t0 = ctx.currentTime + (o.at ?? 0) + 0.002;
    const dur = o.dur ?? 0.02;
    const src = ctx.createBufferSource();
    src.buffer = gr.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(o.f, t0);
    if (o.sweepTo) bp.frequency.exponentialRampToValueAtTime(o.sweepTo, t0 + dur);
    bp.Q.value = o.q ?? 4;
    const out = ctx.createGain();
    out.gain.setValueAtTime((o.gain ?? 0.04) * 1.2, t0);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp);
    bp.connect(out);
    out.connect(bus(gr, o.bus ?? "fx"));
    src.start(t0, Math.random() * 3);
    src.stop(t0 + dur + 0.02);
    active++;
    src.onended = () => {
        active--;
        out.disconnect();
        bp.disconnect();
    };
}

export type Sweep = { from: number; to: number; at?: number; dur?: number; gain?: number; q?: number; bus?: Bus };
/** A soft filtered-noise sweep: menus opening, swells. */
export function sweep(o: Sweep) {
    const gr = graph();
    if (!gr) return;
    const { ctx } = gr;
    const t0 = ctx.currentTime + (o.at ?? 0) + 0.004;
    const dur = o.dur ?? 0.2;
    const src = ctx.createBufferSource();
    src.buffer = gr.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = o.q ?? 0.9;
    bp.frequency.setValueAtTime(o.from, t0);
    bp.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.linearRampToValueAtTime((o.gain ?? 0.08) * 0.9, t0 + dur * 0.35);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp);
    bp.connect(out);
    out.connect(bus(gr, o.bus ?? "fx"));
    src.start(t0, Math.random() * 3);
    src.stop(t0 + dur + 0.05);
    active++;
    src.onended = () => {
        active--;
        out.disconnect();
        bp.disconnect();
    };
}

const semi = (n: number) => 2 ** (n / 12);
const SCALE = [0, 2, 4, 7, 9]; // major pentatonic: any run of notes sounds pleasant
/** Frequency of scale degree i (0 = C4). */
export function note(i: number) {
    const oct = Math.floor(i / SCALE.length);
    const deg = ((i % SCALE.length) + SCALE.length) % SCALE.length;
    return 261.63 * semi(SCALE[deg] + oct * 12);
}

const lastPick = new Map<string, number>();
export function pick(id: string, n: number) {
    let i = Math.floor(Math.random() * n);
    if (n > 1 && i === lastPick.get(id)) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
    lastPick.set(id, i);
    return i;
}
