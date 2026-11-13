// The `nf` console: help, next, rate and find. Pure text out of nfCommand, so these run in Node.
import test from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { E, loadFixture, clone, fixtureNames } from "./helpers.mjs";

const R = await import(resolve(dirname(fileURLToPath(import.meta.url)), "../../lib/nodefarm/records.ts"));
const G = await import(resolve(dirname(fileURLToPath(import.meta.url)), "../../lib/nodefarm/content/guide.ts"));
const text = (r) => r.lines.map((l) => `${l.a ? `${l.a} ${l.b}` : l.t ?? ""}`).join("\n");
const run = (s, ...args) => R.nfCommand(s, args);

test("help lists every command, and a bare nf prints the same list", () => {
    const s = loadFixture(fixtureNames()[0]);
    const bare = text(run(s));
    const help = text(run(s, "help"));
    for (const c of ["nf next", "nf rate", "nf find", "nf stats"]) assert.ok(help.includes(c), `help lists ${c}`);
    assert.ok(bare.includes("nf next"), "bare nf lists the new commands");
});

test("next prints the guide's step with its progress", () => {
    for (const f of fixtureNames()) {
        const s = loadFixture(f);
        const st = G.nextStep(s, E.derive(s));
        const out = text(run(s, "next"));
        assert.ok(out.includes(st.title.toLowerCase()), `${f}: next names ${st.title}`);
        assert.ok(out.includes("progress"), `${f}: has a progress line`);
    }
});

test("rate shows bytes per second and every stat that is producing", () => {
    const s = loadFixture(fixtureNames()[0]);
    const d = E.derive(s);
    const out = text(run(s, "rate"));
    assert.ok(out.includes("income per second"));
    assert.ok(out.includes("bytes"), "bytes row");
    const producing = E.MATS.filter((m) => d.rates[m] > 0);
    for (const m of producing) assert.ok(out.includes(E.statDef(m).name.toLowerCase()), `rate lists ${m}`);
});

test("find with no word explains itself, and never searches locked secrets", () => {
    const s = clone(loadFixture(fixtureNames()[0]));
    assert.ok(text(run(s, "find")).includes("nf find <word>"));
    s.ach = s.ach.filter((id) => id !== "x_fork");
    const locked = E.SECRETS.find((x) => x.id === "x_fork");
    const out = text(run(s, "find", locked.name.split(" ")[0]));
    assert.ok(!out.includes(locked.name.toLowerCase()), "a locked secret does not leak its name");
});

test("find returns a found goal by name and says so when nothing matches", () => {
    const s = clone(loadFixture(fixtureNames()[0]));
    const g = E.GOALS[0];
    const word = g.name.split(" ").find((w) => w.length > 3) ?? g.name;
    assert.ok(text(run(s, "find", word)).toLowerCase().includes(g.name.toLowerCase()), "goal found");
    assert.ok(text(run(s, "find", "zzqqxx")).includes("nothing found"), "no match message");
});

test("why explains a stat, and says so for unknown names", () => {
    const s = clone(loadFixture(fixtureNames()[0]));
    const out = text(run(s, "why", "copper"));
    assert.ok(out.includes("why it moves") && out.includes("you have") && out.includes("paid in"), "copper breakdown");
    assert.ok(text(run(s, "why", "bytes")).includes("multipliers"), "bytes breakdown");
    assert.ok(text(run(s, "why", "nope")).includes("no stat called"), "unknown stat");
    assert.ok(text(run(s, "why")).includes("nf why <stat>"), "usage line");
});
