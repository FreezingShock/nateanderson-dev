// Renders every Starwright sound to a WAV file and checks it: not silent, not clipping, does not end on a click.
// It runs the real lib/starwright/sound.ts (transpiled with the repo's TypeScript) inside headless Chromium, through an
// OfflineAudioContext, so it needs no sound card. It cannot tell you whether a sound is pleasant: listen to the WAVs.
// Usage: node scripts/starwright/audio-render.mjs <outDir>
import { createRequire } from "node:module";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const { chromium } = require("playwright");
const OUT = process.argv[2] ?? "audio-out";
mkdirSync(OUT, { recursive: true });

const src = readFileSync(new URL("../../lib/starwright/sound.ts", import.meta.url), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;

// each sound once, plus the variants that sound different (rows, tiers, constellations, nova kinds)
const JOBS = [
    ["click"], ["open"], ["close"], ["tab"], ["page", { dir: 1 }, "page-forward"], ["page", { dir: -1 }, "page-back"], ["toggleOn"], ["toggleOff"], ["deny"],
    ["buy", { tier: 0, row: 0 }, "buy-tier1-hydrogen"], ["buy", { tier: 1, row: 0 }, "buy-tier2-hydrogen"], ["buy", { tier: 2, row: 0 }, "buy-tier3-hydrogen"],
    ["buy", { tier: 0, row: 6 }, "buy-tier1-silicon"], ["buy", { tier: 2, row: 8 }, "buy-tier3-gold"],
    ["milestone", { row: 2 }, "milestone-doubled"],
    ["ignite", { row: 1 }, "ignite-helium"], ["ignite", { row: 7 }, "ignite-iron"], ["ignite", { row: 9 }, "ignite-uranium"],
    ["perk", { con: "lantern" }, "star-lantern"], ["perk", { con: "kiln" }, "star-kiln"], ["perk", { con: "anvil" }, "star-anvil"], ["perk", { con: "loom" }, "star-loom"], ["perk", { con: "pulsar" }, "star-pulsar"],
    ["deep"], ["planet"], ["badge"], ["ready"], ["visitor"], ["answer"], ["cloud"],
    ["nova", { kind: 0 }, "supernova"], ["nova", { kind: 1 }, "neutron-star"], ["nova", { kind: 2 }, "black-hole"], ["reset"],
];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("about:blank");
const results = await page.evaluate(async ({ code, jobs }) => {
    const mod = await import(`data:text/javascript;base64,${btoa(unescape(encodeURIComponent(code)))}`);
    const out = [];
    for (const [name, opt, label] of jobs) {
        const rate = 44100;
        const probe = new OfflineAudioContext(2, rate, rate);
        const len = mod.renderSound(mod.buildChain(probe), name, 0, opt ?? {});
        const secs = Math.ceil((len + 1.6) * 10) / 10;
        const ctx = new OfflineAudioContext(2, Math.ceil(secs * rate), rate);
        mod.renderSound(mod.buildChain(ctx), name, 0.01, opt ?? {});
        const buf = await ctx.startRendering();
        const L = buf.getChannelData(0), R = buf.getChannelData(1);
        let peak = 0, sum = 0, last = 0;
        for (let i = 0; i < L.length; i++) { const v = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (v > peak) peak = v; sum += L[i] * L[i]; if (v > 0.001) last = i; }
        // 16-bit stereo WAV
        const n = L.length, bytes = new DataView(new ArrayBuffer(44 + n * 4));
        const w = (o, s) => [...s].forEach((ch, i) => bytes.setUint8(o + i, ch.charCodeAt(0)));
        w(0, "RIFF"); bytes.setUint32(4, 36 + n * 4, true); w(8, "WAVEfmt "); bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 2, true);
        bytes.setUint32(24, rate, true); bytes.setUint32(28, rate * 4, true); bytes.setUint16(32, 4, true); bytes.setUint16(34, 16, true); w(36, "data"); bytes.setUint32(40, n * 4, true);
        for (let i = 0; i < n; i++) { bytes.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); bytes.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
        const tail = Math.abs(L[L.length - 1]) + Math.abs(R[R.length - 1]);
        out.push({ name: label ?? name, peak, rms: Math.sqrt(sum / n), secs: last / rate, tail, wav: Array.from(new Uint8Array(bytes.buffer)).reduce((a, b, i) => (i % 1 === 0 ? a + String.fromCharCode(b) : a), "") });
    }
    return out;
}, { code: js, jobs: JOBS });
await browser.close();

let bad = 0;
for (const r of results) {
    writeFileSync(`${OUT}/${r.name}.wav`, Buffer.from(r.wav, "binary"));
    const problems = [];
    if (r.peak < 0.02) problems.push("silent");
    if (r.peak > 0.98) problems.push("clips");
    if (r.tail > 0.002) problems.push("ends on a click");
    if (r.secs > 4) problems.push("too long");
    if (problems.length) bad++;
    console.log(`${problems.length ? "FAIL" : "ok  "} ${r.name.padEnd(22)} peak ${r.peak.toFixed(2)} rms ${r.rms.toFixed(3)} audible for ${r.secs.toFixed(2)}s ${problems.join(", ")}`);
}
console.log(bad ? `\n${bad} sound(s) need a look` : "\nall sounds pass");
process.exit(bad ? 1 : 0);
