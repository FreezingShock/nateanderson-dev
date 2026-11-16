// Unified browser checks for the games and the game route shell, run against a production build.
//
//   node scripts/ci/checks/run.mjs [suites|all] <base-url> [out-dir] [--game <id>]
//       suites: window (windowed panel), shell (framed game route), hud (Groundbreak HUD). Comma-separate to pick several.
//       Exits 1 if any check fails. With an out-dir, writes results.json and summary.md there and keeps the screenshots.
//   node scripts/ci/checks/run.mjs shots <base-url> <out-dir>       screenshot every route (run from the build's repo root)
//   node scripts/ci/checks/run.mjs diff <base-shots> <head-shots> <diff-dir>   advisory screenshot diff, always exits 0
//
// Games come from games.mjs (registerGame). Each suite checks only the games that have its config.
// Environment: SITE_PASSWORD (default ci-password), CHROMIUM_PATH (optional browser binary), SHELL_HEADER_ROUTE (one-off header check).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import "./games.mjs";
import { listGames } from "./registry.mjs";
import { Report, gateCookie, launch } from "./kit.mjs";
import { waitFor } from "../lib.mjs";
import * as windowSuite from "./suites/window.mjs";
import * as shellSuite from "./suites/shell.mjs";
import * as hudSuite from "./suites/hud.mjs";
import * as shotsSuite from "./suites/shots.mjs";
import * as diffSuite from "./suites/diff.mjs";

const SUITES = { window: windowSuite, shell: shellSuite, hud: hudSuite };

function takeFlag(args, flag) {
    const i = args.indexOf(flag);
    if (i < 0) return null;
    const value = args[i + 1];
    args.splice(i, 2);
    return value ?? null;
}

async function runChecks(names, base, out, onlyGame) {
    const baseUrl = base.replace(/\/$/, "");
    await waitFor(baseUrl);
    const cookie = await gateCookie(baseUrl);
    const report = new Report();
    const browser = await launch();
    const counts = {};
    try {
        for (const name of names) {
            if (!SUITES[name]) throw new Error(`unknown suite "${name}" (use window, shell, hud, or all)`);
            console.log(`\n== ${name} ==`);
            const before = report.items.length;
            const games = listGames(name).filter((g) => !onlyGame || g.id === onlyGame);
            if (onlyGame && !games.length) console.log(`(no ${name} config for ${onlyGame})`);
            await SUITES[name].run({
                base: baseUrl,
                browser,
                cookie,
                outDir: out ? join(out, name) : "",
                games,
                check: (suite, ok, msg) => report.check(suite, ok, msg),
                skip: (msg) => report.skip(msg),
                log: console.log,
            });
            counts[name] = report.items.slice(before);
        }
    } finally {
        await browser.close();
    }

    const failed = report.failed;
    const total = report.items.length;
    console.log(`\n${total - failed.length} of ${total} checks passed`);
    if (out) {
        mkdirSync(out, { recursive: true });
        writeFileSync(join(out, "results.json"), JSON.stringify({ passed: total - failed.length, total, failed: failed.map((f) => ({ suite: f.suite, msg: f.msg })) }, null, 2));
        let md = `### Game checks: ${total - failed.length} of ${total} passed\n\n`;
        for (const name of names) {
            const items = counts[name] ?? [];
            md += `- ${name}: ${items.filter((i) => i.ok).length} of ${items.length} passed\n`;
        }
        if (failed.length) md += `\n**Failed**\n\n${failed.map((f) => `- [${f.suite}] ${f.msg}`).join("\n")}\n`;
        writeFileSync(join(out, "summary.md"), md);
    }
    return failed.length;
}

const args = process.argv.slice(2);
const onlyGame = takeFlag(args, "--game");
const [first = "all", ...rest] = args;

if (first === "shots") {
    const [base = "http://localhost:3123", out = "shots"] = rest;
    await shotsSuite.run({ base, outDir: out });
    process.exit(0);
} else if (first === "diff") {
    diffSuite.run(rest);
    process.exit(0);
}

// A bare URL first means "all suites on that URL".
const [suiteArg, base, out] = first.startsWith("http") ? ["all", first, rest[0]] : [first, rest[0] ?? "http://localhost:3123", rest[1]];
const names = suiteArg === "all" ? Object.keys(SUITES) : suiteArg.split(",");
const failures = await runChecks(names, base, out || "", onlyGame);
process.exit(failures ? 1 : 0);
