// Browser check of the reset screens on a production build: the confirm copy, the locks during a stress test, and the backups
// each reset takes. Usage: node scripts/nodefarm/reset-browser.mjs <base url> [out dir]
//   (start the build with SITE_PASSWORD=ci-password SITE_GATE_SECRET=x npx next start -p 3100)
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { unlock } from "../ci/lib.mjs";
import { loadEngine, richSave, NOW } from "./reset-fixture.mjs";

const { chromium } = createRequire(import.meta.url)("playwright");
const [base = "http://localhost:3100", out = "/home/user/scratch/reset-shots"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const { E, R, ST } = await loadEngine();
const ck = (await unlock(base)).split("=");
const res = [];
const ok = (c, m) => { res.push(c); console.log(c ? "PASS" : "FAIL", m); };

// three saves: one ready to Ascend, one after an Ascend (Handover is open), and one in the middle of a stress test
const pre = richSave(E, R);
pre.aether = E.ascendNeed(pre) * 2;
const preJson = JSON.stringify(pre);
const post = richSave(E, R);
post.aether = E.ascendNeed(post) * 2;
E.ascend(post);
const postJson = JSON.stringify(post);
const inTest = richSave(E, R);
ST.startTest(inTest, "thin", NOW);
const inTestJson = JSON.stringify(inTest);

const browser = await chromium.launch();
const open = async (vp, seed) => {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    await ctx.addCookies([{ name: ck[0], value: ck.slice(1).join("="), url: base }]);
    await ctx.addInitScript((s) => {
        if (!localStorage.getItem("nf-save-v1")) {
            const o = JSON.parse(s); o.at = Date.now() - 2 * 3600e3;
            localStorage.setItem("nf-save-v1", JSON.stringify(o));
            localStorage.setItem("nf-events-v1", "off");
        }
    }, seed);
    const p = await ctx.newPage();
    p.errs = [];
    p.on("pageerror", (e) => p.errs.push(e.message));
    return { ctx, p };
};
const store = (p, k) => p.evaluate((k) => localStorage.getItem(k), k);
const save = async (p) => JSON.parse(await store(p, "nf-save-v1"));
const backups = async (p) => JSON.parse((await store(p, "nf-backups-v1")) || "[]");
const pageHas = (p, text) => p.getByText(text, { exact: false }).count().then((n) => n > 0);
// each window opens on a fresh load, so a side pane left open cannot cover the switcher
const openWin = async (p, id) => {
    await boot(p);
    await p.locator(`button[data-sw="${id}"]:visible`).first().click({ timeout: 5000 });
    await p.waitForTimeout(500);
};
/** Ascend and Handover are hold buttons: press, keep holding past the hold time, let go. */
const holdGo = async (p, locator, ms = 1600) => {
    await locator.scrollIntoViewIfNeeded();
    const b = await locator.boundingBox();
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await p.mouse.down();
    await p.waitForTimeout(ms);
    await p.mouse.up();
    await p.waitForTimeout(600);
};
const boot = async (p) => {
    await p.goto(`${base}/creations/games/node-farm`, { waitUntil: "networkidle" });
    await p.waitForTimeout(1500);
    const collect = p.getByRole("button", { name: /collect and resume/i });
    if (await collect.count()) { await collect.click(); await p.waitForTimeout(600); }
};

// 1. Ascend from the save that can Ascend: the confirm copy, then the Ascend itself, which takes an "event" backup
{
    const { ctx, p } = await open({ width: 1440, height: 900 }, preJson);
    await boot(p);
    await openWin(p, "ascend");
    ok(await pageHas(p, "Wipes the run, Drones, Parts and Intel."), "Ascend copy names what is wiped and what stays");
    ok(await pageHas(p, "Keys, Firmware, the hangar's postings"), "Ascend copy names Keys, Firmware and the hangar");
    const before = (await save(p)).life.ascends;
    await holdGo(p, p.locator(".nf-ax-go").first());
    const after = await save(p);
    ok(after.life.ascends === before + 1, `Ascend from the Menu-free window runs (${before} -> ${after.life.ascends})`);
    const b = await backups(p);
    const row = b.find((x) => x.why === "before Ascend");
    ok(!!row && row.kind === "event", `"before Ascend" backup is kept as an event backup (${row?.kind ?? "missing"})`);
    ok(p.errs.length === 0, `no page errors on Ascend ${p.errs.join("|")}`);
    await p.screenshot({ path: `${out}/ascend.png` });
    await ctx.close();
}

// 2. In a stress test: Ascend and Handover show they are locked, and a refused press takes no backup
{
    const { ctx, p } = await open({ width: 1440, height: 900 }, inTestJson);
    await boot(p);
    const t0 = await save(p);
    ok(!!t0.ch?.run, "the test is running on load");
    await openWin(p, "ascend");
    const go = p.locator(".nf-ax-go").first();
    ok((await go.textContent()).includes("Locked until you leave the test") && (await go.isDisabled()), "Ascend button reads locked and is disabled in a test");
    await p.screenshot({ path: `${out}/ascend-in-test.png` });
    await openWin(p, "handover");
    const nb = (await backups(p)).length;
    const hgo = p.locator(".nf-hx-go").first();
    ok((await hgo.textContent()).includes("Locked until you leave the test") && (await hgo.isDisabled()), "Handover button reads locked and is disabled in a test");
    ok((await backups(p)).length === nb, "no backup is taken for a Handover that cannot happen");
    ok(p.errs.length === 0, `no page errors in the test ${p.errs.join("|")}`);
    // leaving brings the real run back
    await openWin(p, "stress");
    await p.screenshot({ path: `${out}/stress-in-test.png` });
    await holdGo(p, p.locator(".nf-st-leave").first(), 1300); // a hold button: hold 1 s, then it restores
    const left = await save(p);
    ok(!left.ch?.run, "leaving the test clears the running test");
    ok(left.life.ascends === t0.life.ascends && left.tree.length === t0.tree.length, "leaving keeps the real run's ascends and tree");
    await ctx.close();
}

// 3. Out of a test: the stress window's copy and the Handover ledger's lines
{
    const { ctx, p } = await open({ width: 1440, height: 900 }, postJson);
    await boot(p);
    await openWin(p, "stress");
    ok(await pageHas(p, "Leaving brings your real run back as it was"), "stress window says what leaving keeps");
    await openWin(p, "handover");
    ok(await pageHas(p, "Parts and mod levels in the hangar"), "Handover ledger lists the hangar's Parts and mod levels");
    ok(await pageHas(p, "Cleared stress test ranks"), "Handover ledger lists the cleared stress test ranks");
    ok(p.errs.length === 0, `no page errors on the windows ${p.errs.join("|")}`);
    await p.screenshot({ path: `${out}/handover-ledger.png` });
    await ctx.close();
}

await browser.close();
const failed = res.filter((x) => !x).length;
console.log(`\n${res.length - failed} of ${res.length} browser checks pass${failed ? `, ${failed} FAIL` : ""}`);
process.exit(failed ? 1 : 0);
