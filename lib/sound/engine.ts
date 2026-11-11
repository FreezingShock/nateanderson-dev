// The site's sound engine: every sound is synthesized with the Web Audio API (no audio files), from one small voice
// family so the whole site sounds like one instrument. Soft sine and triangle tones with a gentle attack, low-passed
// so nothing is bright or clicky, notes taken from a single pentatonic scale so quick sequences stay pleasant, and a
// touch of room reverb for a smooth tail.
//
// Hierarchy (quietest to loudest), see sounds.ts for which sound is which tier:
//   0 ambient  hover ticks
//   1 interface  taps, tabs, toggles, menus (the most frequent, so the softest)
//   2 transaction  buying, equipping
//   3 reward  level ups, trophies, rebirth
//   4 hero  rare hatches, ascension
//
// Nothing plays before the first click, tap or key press (browsers require one), the context sleeps while the tab is
// hidden, and a rate limiter plus a voice cap keep auto-buyers and held clicks from stacking into noise.

export type Bus = "ui" | "game";
export type Prefs = { on: boolean; master: number; ui: number; game: number; clickMute: number };

const KEY = "fi-sound-v1";
const DEFAULTS: Prefs = { on: true, master: 0.8, ui: 1, game: 1, clickMute: 4 };

let prefs: Prefs = { ...DEFAULTS };
let loaded = false;
const subs = new Set<() => void>();

const clampSec = (n: unknown, d: number) => (typeof n === "number" && Number.isFinite(n) ? Math.min(30, Math.max(0, Math.round(n))) : d);
const clamp01 = (n: unknown, d: number) => (typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : d);

function load() {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
        const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
        if (raw && typeof raw === "object") {
            prefs = { on: raw.on !== false, master: clamp01(raw.master, DEFAULTS.master), ui: clamp01(raw.ui, 1), game: clamp01(raw.game, 1), clickMute: clampSec(raw.clickMute, DEFAULTS.clickMute) };
        }
    } catch {
        /* private mode: keep defaults */
    }
}

export function getPrefs(): Prefs {
    load();
    return prefs;
}
export function subscribePrefs(fn: () => void) {
    subs.add(fn);
    return () => subs.delete(fn);
}
export function setPrefs(p: Partial<Prefs>) {
    load();
    prefs = { ...prefs, ...p, master: clamp01(p.master ?? prefs.master, prefs.master), ui: clamp01(p.ui ?? prefs.ui, prefs.ui), game: clamp01(p.game ?? prefs.game, prefs.game), clickMute: clampSec(p.clickMute ?? prefs.clickMute, prefs.clickMute) };
    try {
        localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
        /* ignore */
    }
    applyVolumes();
    subs.forEach((f) => f());
}

// ---------------------------------------------------------------- the audio graph

type Graph = { ctx: AudioContext; master: GainNode; ui: GainNode; game: GainNode; dry: GainNode; wet: GainNode; noise: AudioBuffer };
let g: Graph | null = null;

function impulse(ctx: AudioContext) {
    // A short, dark synthetic room: decaying noise, low-passed by averaging.
    const len = Math.floor(ctx.sampleRate * 0.9);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c);
        let last = 0;
        for (let i = 0; i < len; i++) {
            const white = Math.random() * 2 - 1;
            last = last * 0.82 + white * 0.18;
            d[i] = last * Math.pow(1 - i / len, 2.6);
        }
    }
    return b;
}

function build(): Graph | null {
    if (typeof window === "undefined") return null;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC({ latencyHint: "interactive" });
    const master = ctx.createGain();
    const ui = ctx.createGain();
    const game = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const room = ctx.createConvolver();
    room.buffer = impulse(ctx);
    const tone = ctx.createBiquadFilter(); // takes the top off everything
    tone.type = "lowpass";
    tone.frequency.value = 5200;
    tone.Q.value = 0.4;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 18;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    dry.gain.value = 0.9;
    wet.gain.value = 0.2;
    ui.connect(dry);
    game.connect(dry);
    ui.connect(wet);
    game.connect(wet);
    wet.connect(room);
    room.connect(tone);
    dry.connect(tone);
    tone.connect(comp);
    comp.connect(master);
    master.connect(ctx.destination);
    // one second of white noise, reused by every whoosh
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return { ctx, master, ui, game, dry, wet, noise };
}

function applyVolumes() {
    if (!g) return;
    const t = g.ctx.currentTime;
    // squared so the sliders feel even to the ear
    g.master.gain.setTargetAtTime(prefs.on ? prefs.master * prefs.master * 1.6 : 0, t, 0.03);
    g.ui.gain.setTargetAtTime(prefs.ui * prefs.ui, t, 0.03);
    g.game.gain.setTargetAtTime(prefs.game * prefs.game, t, 0.03);
}

let armed = false;
/** Wire the "first gesture" unlock and the hidden-tab sleep. Safe to call more than once. */
export function armSound() {
    if (armed || typeof window === "undefined") return;
    armed = true;
    load();
    const unlock = () => {
        if (!g) {
            g = build();
            applyVolumes();
        }
        if (g && g.ctx.state === "suspended") void g.ctx.resume();
    };
    for (const ev of ["pointerdown", "keydown", "touchstart"] as const) window.addEventListener(ev, unlock, { capture: true, passive: true });
    document.addEventListener("visibilitychange", () => {
        if (!g) return;
        if (document.hidden) void g.ctx.suspend();
        else if (prefs.on) void g.ctx.resume();
    });
}

// ---------------------------------------------------------------- voices

const lastPlay = new Map<string, number>();
let active = 0;
let lastTier = 0;
let lastTierAt = 0;
let lastBig = -1e9;
const MAX_VOICES = 24;

/** Whether a sound may start now: sound on, audio unlocked, rate limit, no quieter sound right on top of a louder one. */
export function gate(id: string, tier: number, minGap: number): boolean {
    load();
    if (!prefs.on || !g || g.ctx.state !== "running") return false;
    const now = performance.now();
    if (now - (lastPlay.get(id) ?? -1e9) < minGap) return false;
    if (tier < lastTier && now - lastTierAt < 90) return false; // a click that also bought something stays one sound
    if (tier >= 3 && tier < 4 && now - lastBig < 450) return false; // two reward jingles never pile up
    if (active > MAX_VOICES) return false;
    lastPlay.set(id, now);
    if (tier >= 3) lastBig = now;
    if (tier >= lastTier || now - lastTierAt > 90) {
        lastTier = tier;
        lastTierAt = now;
    }
    return true;
}

const semi = (n: number) => 2 ** (n / 12);
const SCALE = [0, 2, 4, 7, 9]; // major pentatonic
/** Frequency of scale degree i (0 = C4), going up through octaves, and down for negatives. */
export function note(i: number) {
    const oct = Math.floor(i / SCALE.length);
    const deg = ((i % SCALE.length) + SCALE.length) % SCALE.length;
    return 261.63 * semi(SCALE[deg] + oct * 12);
}

export type Tone = {
    f: number; // start frequency (Hz)
    at?: number; // start offset (s)
    dur?: number; // total length (s)
    gain?: number;
    type?: OscillatorType;
    glide?: number; // end frequency multiplier over the first part of the note
    attack?: number;
    cutoff?: number; // per-voice low-pass
    detune?: number; // cents
    harm?: number; // gain of a soft octave partial
};

export function tone(bus: Bus, o: Tone) {
    if (!g) return;
    const { ctx } = g;
    const t0 = ctx.currentTime + (o.at ?? 0) + 0.004;
    const dur = o.dur ?? 0.16;
    const peak = (o.gain ?? 0.2) * 0.9;
    const atk = o.attack ?? 0.008;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.linearRampToValueAtTime(peak, t0 + atk);
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
    end.connect(bus === "ui" ? g.ui : g.game);
    const mk = (f: number, gm: number, type: OscillatorType) => {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(f, t0);
        if (o.glide && o.glide !== 1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f * o.glide), t0 + Math.min(dur, 0.18));
        if (o.detune) osc.detune.value = o.detune;
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
        };
    };
    mk(o.f, 1, o.type ?? "sine");
    if (o.harm) mk(o.f * 2, o.harm, "sine");
    window.setTimeout(() => out.disconnect(), (o.at ?? 0) * 1000 + dur * 1000 + 200);
}

export type Whoosh = { at?: number; dur?: number; gain?: number; from: number; to: number; q?: number };
/** A soft filtered-noise sweep (menus opening, charge swells). */
export function whoosh(bus: Bus, o: Whoosh) {
    if (!g) return;
    const { ctx } = g;
    const t0 = ctx.currentTime + (o.at ?? 0) + 0.004;
    const dur = o.dur ?? 0.2;
    const src = ctx.createBufferSource();
    src.buffer = g.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = o.q ?? 0.9;
    bp.frequency.setValueAtTime(o.from, t0);
    bp.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.linearRampToValueAtTime((o.gain ?? 0.1) * 0.9, t0 + dur * 0.35);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp);
    bp.connect(out);
    out.connect(bus === "ui" ? g.ui : g.game);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
    active++;
    src.onended = () => {
        active--;
        out.disconnect();
        bp.disconnect();
    };
}

export type KeyClick = { at?: number; gain?: number; f: number; q?: number };
/** A very short band-passed noise burst: the keypad and relay clicks of the security set. */
export function keyClick(bus: Bus, o: KeyClick) {
    if (!g) return;
    const { ctx } = g;
    const t0 = ctx.currentTime + (o.at ?? 0) + 0.002;
    const dur = 0.018;
    const src = ctx.createBufferSource();
    src.buffer = g.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = o.f;
    bp.Q.value = o.q ?? 4;
    const out = ctx.createGain();
    out.gain.setValueAtTime(o.gain ?? 0.04, t0);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp);
    bp.connect(out);
    out.connect(bus === "ui" ? g.ui : g.game);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.02);
    active++;
    src.onended = () => {
        active--;
        out.disconnect();
        bp.disconnect();
    };
}

/** For callers that want round-robin without repeats. */
const lastPick = new Map<string, number>();
export function pick(id: string, n: number) {
    let i = Math.floor(Math.random() * n);
    if (n > 1 && i === lastPick.get(id)) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
    lastPick.set(id, i);
    return i;
}
