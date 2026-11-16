// Game kit (lib/game-kit): formatting parity with the copies each game shipped, catch-up math, settings store,
// toast queue. Run with npm run test:nodefarm.
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const K = await import(resolve(root, "lib/game-kit/index.ts"));

// ---- the formatters as each game shipped them before the kit (copied verbatim, so drift shows up here) ------------

function gbFmt(n, digits = 2) {
    if (!Number.isFinite(n)) return "0";
    if (n < 0) return "-" + gbFmt(-n, digits);
    if (n < 1000) return n < 10 && n % 1 !== 0 ? n.toFixed(digits) : Math.floor(n).toString();
    if (n < 1e6) return (n / 1e3).toFixed(n < 1e4 ? 2 : n < 1e5 ? 1 : 0) + "K";
    const sfx = ["M", "B", "T", "Qa", "Qi"];
    const e = Math.floor(Math.log10(n) / 3);
    if (e - 2 < sfx.length) return (n / Math.pow(10, e * 3)).toFixed(digits) + sfx[e - 2];
    const x = Math.floor(Math.log10(n));
    return `${(n / Math.pow(10, x)).toFixed(digits)}e${x}`;
}
function swFmt(n, digits = 2) {
    if (!Number.isFinite(n)) return "0";
    if (n < 0) return "-" + swFmt(-n, digits);
    if (n < 1000) return n < 10 && n % 1 !== 0 ? n.toFixed(digits) : Math.floor(n).toString();
    if (n < 1e6) return Math.floor(n).toLocaleString("en-US");
    const e = Math.floor(Math.log10(n));
    return `${(n / Math.pow(10, e)).toFixed(digits)}e${e}`;
}
const SUF = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
function nfFmt(n, digits = 2, numFmt = "short") {
    if (!Number.isFinite(n)) return "∞";
    if (n < 0) return "-" + nfFmt(-n, digits, numFmt);
    if (n < 1000) return n < 10 && n % 1 ? n.toFixed(digits) : n < 100 && n % 1 ? n.toFixed(Math.max(0, digits - 1)) : Math.floor(n).toString();
    if (numFmt === "sci") return n.toExponential(2).replace("+", "");
    const e = Math.floor(Math.log10(n) / 3);
    if (numFmt === "eng") { const v = n / Math.pow(1000, e); return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0)) + "e" + e * 3; }
    if (e >= SUF.length) return n.toExponential(2).replace("+", "");
    const v = n / Math.pow(1000, e);
    return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0)) + SUF[e];
}
function bwFmt(n, mode = "short") {
    if (!Number.isFinite(n)) return "–";
    if (mode === "full") return Math.round(n).toLocaleString("en-US");
    const abs = Math.abs(n);
    for (const [value, suffix] of [[1e9, "B"], [1e6, "M"], [1e3, "K"]]) {
        if (abs >= value) { const x = n / value; const text = Math.abs(x) < 10 ? x.toFixed(2) : x.toFixed(1); return text.replace(/\.?0+$/, "") + suffix; }
    }
    if (abs < 10 && !Number.isInteger(n)) return n.toFixed(1);
    return String(Math.round(n));
}

// A sweep over every magnitude, fractions, edges and the odd values that break formatters.
const SAMPLES = [0, 0.004, 0.5, 1, 1.25, 9.999, 10, 12.5, 99.95, 100, 999, 999.9, 1000, 1234, 9999, 10000, 12345.6, 99999, 100000, 999999, 1e6, 1.5e7,
    123456789, 1e9, 2.5e12, 1e15, 7.7e17, 1e18, 3e20, 1e21, 1e30, 1e33, 5e35, 1e40, 1e100, Infinity, -Infinity, NaN, -1, -0.5, -1234, -1e7];
for (let e = -3; e <= 60; e += 0.37) SAMPLES.push(Math.pow(10, e), 3 * Math.pow(10, e));

test("kilo style matches Groundbreak's fmt", () => {
    for (const n of SAMPLES) for (const d of [0, 1, 2]) assert.equal(K.formatNumber(n, "kilo", d), gbFmt(n, d), `n=${n} d=${d}`);
});
test("grouped style matches Starwright's fmt", () => {
    for (const n of SAMPLES) for (const d of [0, 1, 2]) assert.equal(K.formatNumber(n, "grouped", d), swFmt(n, d), `n=${n} d=${d}`);
});
test("suffix, sci and eng match Node Farm's fmt", () => {
    for (const n of SAMPLES) for (const d of [1, 2]) {
        assert.equal(K.formatNumber(n, "suffix", d), nfFmt(n, d, "short"), `short n=${n}`);
        assert.equal(K.formatNumber(n, "sci", d), nfFmt(n, d, "sci"), `sci n=${n}`);
        assert.equal(K.formatNumber(n, "eng", d), nfFmt(n, d, "eng"), `eng n=${n}`);
    }
});
test("compact and full match Brasswork's fmtNum", () => {
    for (const n of SAMPLES) {
        assert.equal(K.formatNumber(n, "compact"), bwFmt(n, "short"), `n=${n}`);
        assert.equal(K.formatNumber(n, "full"), bwFmt(n, "full"), `n=${n}`);
    }
});
test("numberFormatter binds a style and keeps the digits argument", () => {
    const fmt = K.numberFormatter("kilo");
    assert.equal(fmt(1.5e7), "15.00M");
    assert.equal(fmt(1.5e7, 1), "15.0M");
});
test("rate, age, clock and duration", () => {
    assert.equal(K.formatRate(1234, "compact"), "+1.23K/s");
    assert.equal(K.formatRate(-2, "compact"), "-2/s");
    assert.equal(K.formatRate(0, "compact"), "0/s");
    assert.equal(K.formatAge(45), "45 s");
    assert.equal(K.formatAge(600), "10 min");
    assert.equal(K.formatAge(9000), "2.5 h");
    assert.equal(K.formatClock(7.2), "0:08");
    assert.equal(K.formatClock(-3), "0:00");
    assert.equal(K.formatClock(750), "12:30");
    assert.equal(K.formatDuration(45), "45s");
    assert.equal(K.formatDuration(200), "3m 20s");
    assert.equal(K.formatDuration(7500), "2h 5m");
    assert.equal(K.plural(1, "star"), "1 star");
    assert.equal(K.plural(3, "star"), "3 stars");
});

// ---- time -----------------------------------------------------------------------------------------------------------

test("catchUp pays the capped gap in equal steps, like the engines did", () => {
    const steps = [];
    const secs = K.catchUp(100, { capS: 3600, stepCap: 7200 }, (dt) => steps.push(dt));
    assert.equal(secs, 100);
    assert.equal(steps.length, 50);
    assert.ok(Math.abs(steps.reduce((a, b) => a + b, 0) - 100) < 1e-9);
    // capped
    const capped = [];
    assert.equal(K.catchUp(1e6, { capS: 7200, stepCap: 100 }, (dt) => capped.push(dt)), 7200);
    assert.equal(capped.length, 100);
    assert.equal(capped[0], 72);
    // too short
    let called = 0;
    assert.equal(K.catchUp(1.5, { capS: 3600, stepCap: 10 }, () => called++), 0);
    assert.equal(called, 0);
    assert.equal(K.catchUp(-5, { capS: 3600, stepCap: 10 }, () => called++), 0);
});
test("classifyGap, capAway and gapSeconds", () => {
    assert.equal(K.classifyGap(0, 2, 30), "none");
    assert.equal(K.classifyGap(NaN, 2, 30), "none");
    assert.equal(K.classifyGap(0.1, 2, 30), "step");
    assert.equal(K.classifyGap(5, 2, 30), "catchup");
    assert.equal(K.classifyGap(30, 2, 30), "away");
    assert.deepEqual(K.capAway(100, 50), { secs: 50, capped: true });
    assert.deepEqual(K.capAway(10, 50), { secs: 10, capped: false });
    assert.equal(K.gapSeconds(1000, 500), 0);
    assert.equal(K.gapSeconds(1000, 3500), 2.5);
});

// ---- settings -------------------------------------------------------------------------------------------------------

const fakeStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const parse = (raw) => { const r = raw && typeof raw === "object" ? raw : {}; return { sound: K.pick.bool(r.sound, true), fx: K.pick.oneOf(r.fx, ["full", "simple"], "full"), vol: K.pick.num(r.vol, 0.8, 0, 1) }; };

test("settings store: defaults, set, persist, subscribe, reset", () => {
    const st = fakeStorage();
    const s = K.createSettingsStore({ key: "demo-settings-v1", parse, storage: () => st });
    assert.deepEqual(s.get(), { sound: true, fx: "full", vol: 0.8 });
    let calls = 0;
    const off = s.subscribe(() => calls++);
    s.set({ fx: "simple", vol: 4 });
    assert.deepEqual(s.get(), { sound: true, fx: "simple", vol: 1 });
    assert.deepEqual(JSON.parse(st.m.get("demo-settings-v1")), { sound: true, fx: "simple", vol: 1 });
    // a second store over the same storage reads what the first wrote
    assert.equal(K.createSettingsStore({ key: "demo-settings-v1", parse, storage: () => st }).get().fx, "simple");
    s.reset();
    assert.equal(s.get().fx, "full");
    assert.equal(calls, 2);
    off();
    s.set({ sound: false });
    assert.equal(calls, 2);
});
test("settings store survives damaged and blocked storage", () => {
    const bad = { getItem: () => "{not json", setItem: () => { throw new Error("full"); } };
    const s = K.createSettingsStore({ key: "x", parse, storage: () => bad });
    assert.equal(s.get().sound, true);
    assert.equal(s.set({ sound: false }).sound, false);
    const none = K.createSettingsStore({ key: "x", parse, storage: () => null });
    assert.equal(none.get().fx, "full");
});
test("cycle wraps", () => {
    assert.equal(K.cycle([0, 1, 2], 2), 0);
    assert.equal(K.cycle(["off", "lump"], "off"), "lump");
});

// ---- toasts ---------------------------------------------------------------------------------------------------------

const t = (id, text, sticky = false) => ({ id, text, sticky });
test("toast queue keeps stickies and the newest ordinary toasts", () => {
    // Groundbreak's rule: keep 1, dedupe
    let list = [];
    list = K.pushToast(list, t(1, "a"), { keep: 1, dedupe: true });
    list = K.pushToast(list, t(2, "warn", true), { keep: 1, dedupe: true });
    list = K.pushToast(list, t(3, "b"), { keep: 1, dedupe: true });
    list = K.pushToast(list, t(4, "c"), { keep: 1, dedupe: true });
    assert.deepEqual(list.map((x) => x.id), [2, 3, 4]);
    list = K.pushToast(list, t(5, "c"), { keep: 1, dedupe: true });
    assert.deepEqual(list.map((x) => x.id), [2, 3, 5]);
    assert.deepEqual(K.dropToast(list, 2).map((x) => x.id), [3, 5]);
});
test("toast queue with keep 3 and no dedupe equals Starwright's slice(-3)", () => {
    let mine = [], theirs = [];
    for (let i = 1; i <= 9; i++) {
        const next = t(i, i % 2 ? "same" : `n${i}`);
        mine = K.pushToast(mine, next, { keep: 3 });
        theirs = [...theirs.slice(-3), next];
        assert.deepEqual(mine, theirs);
    }
});

// ---- idle math ------------------------------------------------------------------------------------------------------

test("costs: next, many, affordable agree", () => {
    assert.equal(K.costAt(10, 1.15, 0), 10);
    assert.ok(Math.abs(K.costAt(10, 1.15, 2) - 13.225) < 1e-9);
    const many = K.costOfMany(10, 1.15, 3, 5);
    let sum = 0; for (let i = 3; i < 8; i++) sum += K.costAt(10, 1.15, i);
    assert.ok(Math.abs(many - sum) < 1e-6);
    assert.equal(K.costOfMany(5, 1, 0, 4), 20);
    for (const money of [0, 9, 10, 100, 12345, 1e12, 1e60]) {
        const n = K.affordable(10, 1.15, 3, money);
        assert.ok(K.costOfMany(10, 1.15, 3, n) <= money, `fits ${money}`);
        assert.ok(K.costOfMany(10, 1.15, 3, n + 1) > money, `max ${money}`);
    }
    assert.equal(K.affordable(5, 1, 0, 23), 4);
    assert.equal(K.timeTo(100, 40, 6), 10);
    assert.equal(K.timeTo(100, 140, 6), 0);
    assert.equal(K.timeTo(100, 0, 0), Infinity);
});
test("milestones and upgrades", () => {
    assert.equal(K.milestoneMult(9, [10, 25, 50, 100]), 1);
    assert.equal(K.milestoneMult(30, [10, 25, 50, 100]), 4);
    assert.equal(K.milestoneMult(230, [10, 25, 50, 100], 2, 100), 32);
    assert.equal(K.nextMilestone(30, [10, 25, 50, 100]), 50);
    assert.equal(K.nextMilestone(130, [10, 25, 50, 100], 100), 200);
    assert.equal(K.nextMilestone(130, [10, 25, 50, 100]), null);
    const ups = [{ id: "a", target: "drill", mult: 2 }, { id: "b", target: "all", mult: 3 }, { id: "c", target: "kiln", mult: 5 }];
    assert.equal(K.upgradeMult(ups, ["a", "b", "c"], "drill"), 6);
    assert.equal(K.upgradeMult(ups, new Set(["c"]), "drill"), 1);
});
test("generator chain feeds down a tier", () => {
    const gens = [{ id: "g0", rate: 1, baseCost: 10, growth: 1.1 }, { id: "g1", rate: 0.5, baseCost: 100, growth: 1.2 }];
    const counts = [2, 4];
    const got = K.stepChain(gens, counts, [1, 2], 1);
    assert.equal(got, 2);
    assert.equal(counts[0], 6);
    assert.deepEqual(K.rates(gens, [6, 4], [1, 2]), [6, 4]);
});
test("prestige gain, need, progress and reset", () => {
    assert.equal(K.prestigeGain(1e6, 1e4), 10);
    assert.equal(K.prestigeGain(1e6, 1e4, 0.5, 4), 6);
    assert.equal(K.prestigeGain(0, 1e4), 0);
    assert.equal(K.prestigeNeed(10, 1e4), 1e6);
    assert.ok(Math.abs(K.prestigeProgress(1e6, 1e4)) < 1e-9);
    const mid = K.prestigeProgress((1e6 + 1.21e6) / 2, 1e4);
    assert.ok(mid > 0.49 && mid < 0.51);
    const s = { money: 500, gens: [3], dust: 7, life: 900 };
    assert.deepEqual(K.resetKeeping(s, () => ({ money: 0, gens: [0], dust: 0, life: 0 }), ["dust", "life"]), { money: 0, gens: [0], dust: 7, life: 900 });
});
