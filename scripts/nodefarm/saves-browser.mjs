// Browser check of save safety on a production build. Usage: node scripts/nodefarm/saves-browser.mjs <base url> <out dir>
//   (start the build with SITE_PASSWORD=ci-password SITE_GATE_SECRET=x next start -p 3100)
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { unlock } from "../ci/lib.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");
const [base, out = "."] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const fx = (n) => readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "fixtures", n), "utf8");
const ck = (await unlock(base)).split("=");
const res = [];
const ok = (c, m) => { res.push((c ? "PASS " : "FAIL ") + m); console.log(c ? "PASS" : "FAIL", m); };
const browser = await chromium.launch();
const open = async (vp, seed, key = "") => {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, acceptDownloads: true });
    await ctx.addCookies([{ name: ck[0], value: ck.slice(1).join("="), url: base }]);
    await ctx.addInitScript(([s, k]) => { if (s && !localStorage.getItem("nf-save-v1")) { const o = JSON.parse(s); o.at = Date.now() - 2 * 3600e3; localStorage.setItem("nf-save-v1", JSON.stringify(o)); localStorage.setItem("nf-events-v1", "off"); } }, [seed, key]);
    const p = await ctx.newPage();
    p.errs = [];
    p.on("pageerror", (e) => p.errs.push(e.message));
    return { ctx, p };
};
const store = (p, k) => p.evaluate((k) => localStorage.getItem(k), k);
const menu = async (p, phone) => {
    await p.goto(`${base}/creations/games/node-farm`, { waitUntil: "networkidle" });
    await p.waitForTimeout(1200);
    const collect = p.getByRole("button", { name: /collect and resume/i });
    await collect.waitFor({ timeout: 4000 }).catch(() => {});
    if (await collect.count()) { await collect.click(); await p.waitForTimeout(600); }
    await p.locator(phone ? '.nf-tabs button[aria-label^="Menu"]' : 'button[data-sw="menu"]:visible').first().click({ timeout: 5000 }).catch(async (e) => { await p.screenshot({ path: "/tmp/fail.png" }); throw e; });
    await p.waitForSelector(".nf-wk-term", { timeout: 8000 });
};

for (const [name, vp] of [["d", { width: 1440, height: 900 }], ["m", { width: 390, height: 844 }]]) {
    // 1. a save from the released build, deep in
    const { ctx, p } = await open(vp, fx("release-deep.json"));
    await p.goto(`${base}/creations/games/node-farm`, { waitUntil: "networkidle" });
    await p.waitForTimeout(1500);
    let list = JSON.parse((await store(p, "nf-backups-v1")) || "[]");
    ok(list.length === 1 && list[0].why === "when the game opened", `${name}: the opening backup is taken (${list.length})`);
    ok(JSON.parse(list[0].code).tree.includes("batchjob"), `${name}: it is the save as the old build left it, before migration`);
    await p.waitForTimeout(5500);
    const live = JSON.parse(await store(p, "nf-save-v1"));
    ok(!live.tree.includes("batchjob") && live.ap >= 21, `${name}: the live save migrated (ap ${live.ap}, batchjob gone)`);
    await ctx.close();
}

// 2. restore, export with a unicode note, import, download, and the half hour backup on a fake clock
for (const [name, vp] of [["d", { width: 1440, height: 900 }], ["m", { width: 390, height: 844 }]]) {
    const { ctx, p } = await open(vp, fx("release-post-ascend.json"));
    await menu(p, name === "m");
    ok(await p.locator(".nf-wk-bk li").count() === 1, `${name}: Menu lists the opening backup`);
    await p.screenshot({ path: `${out}/${name}-menu-backups.png` });
    const before = JSON.parse(await store(p, "nf-save-v1"));
    // wipe, then restore from the list
    const hold = p.locator(".nf-wk-hold").first();
    await hold.scrollIntoViewIfNeeded();
    const box = await hold.boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await p.mouse.down();
    await p.waitForTimeout(2200);
    await p.mouse.up();
    await p.waitForTimeout(800);
    const wiped = JSON.parse(await store(p, "nf-save-v1"));
    ok(wiped.life.presses === 0, `${name}: wipe cleared the save`);
    const n = await p.locator(".nf-wk-bk li").count();
    ok(n >= 2, `${name}: the wipe added a backup (${n} rows)`);
    await p.locator(".nf-wk-bk li").first().getByRole("button", { name: "Restore" }).click();
    await p.waitForTimeout(800);
    const back = JSON.parse(await store(p, "nf-save-v1"));
    ok(back.life.presses === before.life.presses && back.life.ascends === before.life.ascends, `${name}: Restore brings the pre-wipe save back (${back.life.presses} presses)`);
    // unicode note: export must work
    await p.evaluate(() => { const s = JSON.parse(localStorage.getItem("nf-save-v1")); s.hand = { ...(s.hand ?? {}), notes: [{ n: 1, text: "it’s “fine” \u{1F9CA}", at: 1, proto: null }] }; localStorage.setItem("nf-save-v1", JSON.stringify(s)); });
    await p.screenshot({ path: `${out}/${name}-after-restore.png` });
    ok(p.errs.length === 0, `${name}: no page errors ${p.errs.join("|")}`);
    await ctx.close();
}

// a bad save is kept, not lost, and can be copied out
{
    const { ctx, p } = await open({ width: 1440, height: 900 }, null);
    await ctx.addInitScript(() => { if (!localStorage.getItem("nf-save-v1")) localStorage.setItem("nf-save-v1", '{"v":1,"bytes":12,"mult":'); });
    await menu(p);
    const rows = await p.locator(".nf-wk-bk li").allInnerTexts();
    ok(rows.some((r) => /cannot be read/.test(r)), "a damaged save is listed as unreadable");
    await p.locator(".nf-wk-bk li").first().getByRole("button", { name: /Copy out/ }).click();
    ok((await p.locator(".nf-wk-term textarea").inputValue()).startsWith('{"v":1,"bytes":12'), "Copy out puts its text in the box");
    await p.screenshot({ path: `${out}/d-unreadable.png` });
    ok(p.errs.length === 0, `unreadable: no page errors ${p.errs.join("|")}`);
    await ctx.close();
}

// half hour backup on a fake clock
{
    const { ctx, p } = await open({ width: 1440, height: 900 }, fx("release-mid.json"));
    await p.clock.install({ time: Date.now() });
    await p.goto(`${base}/creations/games/node-farm`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1500);
    await p.clock.fastForward(31 * 60 * 1000);
    await p.clock.runFor(6000);
    const l = JSON.parse((await store(p, "nf-backups-v1")) || "[]");
    ok(l.length >= 2 && l.some((b) => b.why === "every half hour"), `a half hour of play adds a rolling backup (${l.map((b) => b.why).join(", ")})`);
    await ctx.close();
}
await browser.close();
console.log(res.join("\n"));
process.exit(res.some((r) => r.startsWith("FAIL")) ? 1 : 0);
