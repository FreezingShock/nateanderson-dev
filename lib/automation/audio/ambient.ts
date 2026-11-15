// The island's living sound: a wind bed that follows the sim's gusts, water lapping on the shore, a quiet clockwork
// tick, a low workshop hum, and the machines themselves. Beds are four looped noise sources and two oscillators in
// total, however big the factory is. Machine sounds are scheduled from per-kind counts (not per machine) and capped
// at two voices per slot, so a large factory gets louder and busier, never noisier than a handful of machines.
import { click, graph, isEnabled, onRunState, rawGraph, tone } from "./engine";

export type AmbientState = {
    wind: number; // 0..1, from the sim
    night: number; // 0 (day) .. 1 (night)
    working: number; // share of machines running, 0..1
    kinds: Record<string, number>; // working machines per machine id
};

const state: AmbientState = { wind: 0.5, night: 0, working: 0, kinds: {} };

type Beds = {
    windLp: BiquadFilterNode; windGain: GainNode; gustBp: BiquadFilterNode; gustGain: GainNode;
    waterGain: GainNode; waterLfo: OscillatorNode;
    humA: OscillatorNode; humB: OscillatorNode; humLp: BiquadFilterNode; humGain: GainNode;
    sources: AudioBufferSourceNode[];
};
let beds: Beds | null = null;
let timer = 0;
let nextTick = 0;
let tock = false;

function startBeds() {
    const gr = rawGraph();
    if (!gr || beds) return;
    const { ctx, noise } = gr;
    const loop = () => {
        const s = ctx.createBufferSource();
        s.buffer = noise;
        s.loop = true;
        return s;
    };
    const sources: AudioBufferSourceNode[] = [];
    // wind: low rumble plus a higher gust layer that only opens in strong wind
    const w = loop();
    const windLp = ctx.createBiquadFilter();
    windLp.type = "lowpass";
    windLp.frequency.value = 380;
    windLp.Q.value = 0.6;
    const windGain = ctx.createGain();
    windGain.gain.value = 0;
    w.connect(windLp).connect(windGain).connect(gr.amb);
    const gu = loop();
    const gustBp = ctx.createBiquadFilter();
    gustBp.type = "bandpass";
    gustBp.frequency.value = 900;
    gustBp.Q.value = 0.8;
    const gustGain = ctx.createGain();
    gustGain.gain.value = 0;
    gu.connect(gustBp).connect(gustGain).connect(gr.amb);
    // water: low-passed noise swelling slowly in and out, like small waves on a shore
    const wa = loop();
    const waterLp = ctx.createBiquadFilter();
    waterLp.type = "lowpass";
    waterLp.frequency.value = 520;
    const waterGain = ctx.createGain();
    waterGain.gain.value = 0.012;
    const waterLfo = ctx.createOscillator();
    waterLfo.frequency.value = 0.14;
    const depth = ctx.createGain();
    depth.gain.value = 0.01;
    waterLfo.connect(depth).connect(waterGain.gain);
    wa.connect(waterLp).connect(waterGain).connect(gr.amb);
    // workshop hum: a detuned pair under a low-pass, rising with the share of machines working
    const humLp = ctx.createBiquadFilter();
    humLp.type = "lowpass";
    humLp.frequency.value = 160;
    const humGain = ctx.createGain();
    humGain.gain.value = 0;
    const humA = ctx.createOscillator();
    const humB = ctx.createOscillator();
    humA.type = "sawtooth";
    humB.type = "sine";
    humA.frequency.value = 55;
    humB.frequency.value = 27.5;
    humA.connect(humLp);
    humB.connect(humLp);
    humLp.connect(humGain).connect(gr.amb);
    const offset = () => Math.random() * 3;
    for (const s of [w, gu, wa]) {
        s.start(0, offset());
        sources.push(s);
    }
    waterLfo.start();
    humA.start();
    humB.start();
    beds = { windLp, windGain, gustBp, gustGain, waterGain, waterLfo, humA, humB, humLp, humGain, sources };
    nextTick = ctx.currentTime + 0.5;
    applyBeds();
}

function stopBeds() {
    if (!beds) return;
    const b = beds;
    beds = null;
    for (const s of b.sources) {
        try {
            s.stop();
        } catch {
            /* already stopped */
        }
    }
    for (const o of [b.waterLfo, b.humA, b.humB]) {
        try {
            o.stop();
        } catch {
            /* already stopped */
        }
    }
    b.windGain.disconnect();
    b.gustGain.disconnect();
    b.waterGain.disconnect();
    b.humGain.disconnect();
}

function applyBeds() {
    const gr = rawGraph();
    if (!gr || !beds) return;
    const t = gr.ctx.currentTime;
    const wind = Math.min(1, Math.max(0, state.wind));
    const day = 1 - state.night * 0.35; // wind sits back a little at night
    beds.windGain.gain.setTargetAtTime((0.02 + wind * 0.06) * day, t, 0.6);
    beds.windLp.frequency.setTargetAtTime(260 + wind * 700, t, 0.6);
    beds.gustGain.gain.setTargetAtTime(wind * wind * wind * 0.05 * day, t, 0.5);
    beds.gustBp.frequency.setTargetAtTime(700 + wind * 900, t, 0.5);
    const w = Math.min(1, Math.max(0, state.working));
    beds.humGain.gain.setTargetAtTime(state.working > 0 ? 0.006 + w * 0.014 : 0, t, 0.8);
    beds.humLp.frequency.setTargetAtTime(120 + w * 380, t, 0.8);
    beds.humA.frequency.setTargetAtTime(55 * (1 + w * 0.4), t, 0.8);
    beds.humB.frequency.setTargetAtTime(27.5 * (1 + w * 0.4), t, 0.8);
}

// ---------------------------------------------------------------- machines

type Voice = { period: number; play: (g: number) => void };
const VOICES: Record<string, Voice> = {
    // a drill: a dull, low thump
    drill: { period: 1.1, play: (g) => { tone({ f: 95, dur: 0.16, gain: 0.1 * g, glide: 0.6, type: "triangle", cutoff: 420, attack: 0.004 }); click({ f: 700, gain: 0.03 * g, q: 2, dur: 0.03 }); } },
    // a kiln: crackle, a few tiny irregular ticks
    kiln: { period: 0.9, play: (g) => { for (let i = 0; i < 3; i++) click({ f: 2400 + Math.random() * 2400, at: Math.random() * 0.3, gain: 0.024 * g, q: 3, dur: 0.01 }); } },
    // a furnace: the same, lower, with a soft whoomp
    furnace: { period: 1.4, play: (g) => { tone({ f: 70, dur: 0.4, gain: 0.07 * g, type: "sine", cutoff: 240, attack: 0.08 }); for (let i = 0; i < 2; i++) click({ f: 1800 + Math.random() * 1400, at: Math.random() * 0.4, gain: 0.02 * g, q: 3, dur: 0.012 }); } },
    // a stamp press: a clunk, then the return ratchet
    press: { period: 1.7, play: (g) => { tone({ f: 110, dur: 0.18, gain: 0.12 * g, glide: 0.5, type: "triangle", cutoff: 700, attack: 0.003 }); click({ f: 1100, gain: 0.05 * g, q: 3, dur: 0.02 }); click({ f: 1900, at: 0.45, gain: 0.025 * g, q: 5, dur: 0.012 }); click({ f: 2100, at: 0.5, gain: 0.025 * g, q: 5, dur: 0.012 }); } },
    // a lathe: a short whirr sweeping up
    lathe: { period: 1.2, play: (g) => { click({ f: 1400, sweepTo: 3400, gain: 0.03 * g, q: 6, dur: 0.22 }); } },
    // an assembler: a quick cascade of three small clicks
    assembler: { period: 1.3, play: (g) => { [0, 0.07, 0.15].forEach((a, i) => click({ f: 1500 + i * 450, at: a, gain: 0.03 * g, q: 5, dur: 0.014 })); } },
    // a spring winder: a slow wind-up ratchet
    spring_winder: { period: 2.0, play: (g) => { for (let i = 0; i < 4; i++) click({ f: 1300 + i * 90, at: i * 0.07, gain: 0.025 * g, q: 5, dur: 0.014 }); } },
};
VOICES.drawer = VOICES.lathe;
VOICES.fabricator = VOICES.assembler;
const FALLBACK: Voice = { period: 1.5, play: (g) => click({ f: 1700, gain: 0.025 * g, q: 5, dur: 0.014 }) };

const due = new Map<string, number>();
/** Louder and busier with more machines of a kind, but flattened: 1 machine = 0.55, 12 = 1.0. */
const crowd = (n: number) => Math.min(1, 0.55 + 0.45 * (Math.log2(1 + n) / Math.log2(13)));

function schedule() {
    const gr = graph();
    if (!gr || !beds) return;
    const now = gr.ctx.currentTime;
    // clockwork: a soft tick-tock each second, a little more present at night
    while (nextTick < now + 0.12) {
        const dt = nextTick - now;
        if (dt > -0.5) {
            const g = 0.55 + state.night * 0.5;
            click({ f: tock ? 1700 : 2300, at: Math.max(0, dt), gain: 0.012 * g, q: 8, dur: 0.012, bus: "amb" });
            tone({ f: tock ? 880 : 1175, at: Math.max(0, dt), dur: 0.05, gain: 0.005 * g, type: "sine", bus: "amb" });
        }
        tock = !tock;
        nextTick += 1;
    }
    // machines: at most two voices per slot, the kinds that are due first
    let budget = 2;
    for (const [kind, n] of Object.entries(state.kinds)) {
        if (n <= 0 || budget <= 0) continue;
        const v = VOICES[kind] ?? FALLBACK;
        const at = due.get(kind) ?? 0;
        if (now < at) continue;
        // a few machines of a kind sound a little more often, never by more than a third
        due.set(kind, now + (v.period / (1 + Math.min(0.33, n * 0.04))) * (0.8 + Math.random() * 0.4));
        v.play(crowd(n) * 1.0);
        budget--;
    }
}

export function setAmbient(s: Partial<AmbientState>) {
    Object.assign(state, s);
    applyBeds();
}

let unsub: (() => void) | null = null;
/** Begin the beds and the scheduler; they follow the engine's run state (first gesture, hidden tab, mute). */
export function startAmbient() {
    if (unsub) return;
    unsub = onRunState((running) => {
        if (running) {
            startBeds();
            if (!timer) timer = window.setInterval(schedule, 100);
        } else {
            window.clearInterval(timer);
            timer = 0;
            stopBeds();
        }
    });
    // the context may already be running if the engine unlocked before the beds were requested
    if (rawGraph() && isEnabled() && !document.hidden) {
        startBeds();
        timer = window.setInterval(schedule, 100);
    }
}
export function stopAmbient() {
    unsub?.();
    unsub = null;
    window.clearInterval(timer);
    timer = 0;
    stopBeds();
    due.clear();
}
