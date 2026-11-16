#!/usr/bin/env node
// Scaffolds a windowed game for the Games hub in one command: the route, the panel, the engine, the save slot, the
// registry entries, a Creations card, engine tests, the window and shell checks, and the docs.
//
// Every line it adds to a shared file ends with "gen:<slug>", and every new folder is named after the slug, so
// `--remove <slug>` takes the whole game back out. Nothing else in a shared file is touched.
//
// Usage (npm reads flags unless `--` comes first):
//   npm run new-game -- <slug> [--name "Display Name"] [--section incremental|automation|geography]
//                       [--accent "#7fd6a4"] [--resource "Stock"] [--dry-run]
//   npm run new-game -- <slug> --remove [--dry-run]
// Read docs/games/NEW-GAME.md for the steps after this.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TEMPLATE_DIR = join(ROOT, "scripts/games/new-game");
const CHECK_LIST = join(ROOT, "scripts/games/games-under-check.json");
const PACKAGE_JSON = join(ROOT, "package.json");

const SECTIONS = {
    geography: { title: "Geography", icon: "Map" },
    incremental: { title: "Incremental", icon: "Layers" },
    automation: { title: "Automation", icon: "Settings" },
};

/** Shared files that get lines from the template. Each one has anchor lines (`gen-anchor: <name>`) placed by hand once. */
const SHARED_FILES = [
    "lib/games/registry.ts",
    "lib/saves/keys.ts",
    "lib/games/save-slot.ts",
    "lib/game-launch/launch.ts",
    "lib/creations-data.ts",
    "docs/OWNERS.md",
    "docs/README.md",
];

/** Folders that belong to one game only. */
const GAME_DIRS = (slug, camel) => [
    `app/creations/games/${slug}`,
    `components/${slug}`,
    `lib/${slug}`,
    `tests/${slug}`,
    `docs/games/${slug}`,
    `app/camino/${slug}.css`,
];

const RESERVED = new Set([
    "hub", "games", "new", "api", "layout", "page",
    "brasswork", "starwright", "groundbreak", "node-farm", "outline-guesser", "flag-guesser",
]);

function fail(message) {
    console.error(`new-game: ${message}`);
    process.exit(1);
}

function usage(code) {
    console.log(`Usage:
  npm run new-game -- <slug> [--name "Display Name"] [--section incremental|automation|geography]
                      [--accent "#7fd6a4"] [--resource "Stock"] [--dry-run]
  npm run new-game -- <slug> --remove [--dry-run]

<slug> is lowercase letters, digits and single dashes, 3 to 24 characters, starting with a letter.`);
    process.exit(code);
}

function parseArgs(argv) {
    const out = { positional: [], flags: {} };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (!a.startsWith("--")) {
            out.positional.push(a);
            continue;
        }
        const key = a.slice(2);
        if (key === "dry-run" || key === "remove" || key === "help") {
            out.flags[key] = true;
            continue;
        }
        const value = argv[i + 1];
        if (value === undefined || value.startsWith("--")) fail(`--${key} needs a value`);
        out.flags[key] = value;
        i++;
    }
    return out;
}

const titleCase = (slug) => slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const pascal = (name) =>
    name
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean)
        .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
        .join("");
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const today = () => new Date().toISOString().slice(0, 10);

/** Lines that a generated game added to a shared file. Removal drops exactly these. */
function taggedLine(slug, line) {
    return new RegExp(`gen:${escapeRe(slug)}(?![a-z0-9-])`).test(line);
}

function readShared(rel) {
    return readFileSync(join(ROOT, rel), "utf8");
}

/** Inserts lines before the anchor line `gen-anchor: <name>`. Fails if the anchor is missing, so nothing is half-written. */
function insertAtAnchor(text, rel, anchor, lines) {
    const all = text.split("\n");
    const at = all.findIndex((l) => l.includes(`gen-anchor: ${anchor}`));
    if (at < 0) fail(`${rel} has no "gen-anchor: ${anchor}" line. The template needs it.`);
    all.splice(at, 0, ...lines);
    return all.join("\n");
}

function fill(text, tokens) {
    let out = text;
    for (const [token, value] of Object.entries(tokens)) out = out.split(token).join(value);
    return out;
}

function writeFile(path, text, dry) {
    if (dry) return;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
}

function createGame(slug, args) {
    const dry = !!args.flags["dry-run"];
    const name = args.flags.name ?? titleCase(slug);
    if (!/^[A-Za-z][A-Za-z0-9 -]{1,30}$/.test(name)) fail("--name may use letters, digits, spaces and hyphens only.");
    const section = args.flags.section ?? "incremental";
    if (!SECTIONS[section]) fail(`--section must be one of ${Object.keys(SECTIONS).join(", ")}.`);
    const accent = args.flags.accent ?? "#7fd6a4";
    if (!/^#[0-9a-fA-F]{6}$/.test(accent)) fail("--accent must be a 6-digit hex colour, such as #7fd6a4.");
    const resource = args.flags.resource ?? "Stock";
    if (!/^[A-Za-z][A-Za-z ]{1,20}$/.test(resource)) fail("--resource may use letters and spaces only.");
    if (RESERVED.has(slug)) fail(`"${slug}" is reserved. Pick another slug.`);

    const camel = pascal(name);
    if (!camel) fail("--name must contain a letter.");
    const taken = GAME_DIRS(slug, camel).filter((p) => existsSync(join(ROOT, p)));
    if (taken.length) fail(`already exists: ${taken.join(", ")}. Remove it first with --remove, or pick another slug.`);
    if (readShared("lib/games/registry.ts").includes(`"${slug}": {`)) fail(`${slug} is already in lib/games/registry.ts.`);

    const eyebrow = SECTIONS[section].title;
    const tokens = {
        __SLUG__: slug,
        __CAMEL__: camel,
        __NAME__: name,
        __ACCENT__: accent,
        __RESOURCE__: resource,
        __EYEBROW__: eyebrow,
        __DESCRIPTION__: `${name}: a new game in development. Saves in your browser.`,
        __PLAY_TITLE__: `Play ${name}.`,
        __BACK_HREF__: `/creations/games#${section}`,
    };
    const tag = `// gen:${slug}`;
    const tagHtml = `<!-- gen:${slug} -->`;

    // Every shared-file edit is computed first. Nothing is written until all anchors are found.
    const edits = new Map();
    const edit = (rel, anchor, lines) => {
        const base = edits.get(rel) ?? readShared(rel);
        edits.set(rel, insertAtAnchor(base, rel, anchor, lines));
    };

    edit("lib/games/registry.ts", "ids", [`    | "${slug}" ${tag}`]);
    edit("lib/games/registry.ts", "themes", [`    | "${slug}" ${tag}`]);
    edit("lib/games/registry.ts", "games", [
        `    "${slug}": { ${tag}`,
        `        id: "${slug}", ${tag}`,
        `        name: "${name}", ${tag}`,
        `        path: "/creations/games/${slug}", ${tag}`,
        `        eyebrow: "${eyebrow}", ${tag}`,
        `        description: "${tokens.__DESCRIPTION__}", ${tag}`,
        `        playTitle: "${tokens.__PLAY_TITLE__}", ${tag}`,
        `        theme: "${slug}", ${tag}`,
        `        backHref: "${tokens.__BACK_HREF__}", ${tag}`,
        `        backLabel: "Back to Games", ${tag}`,
        `    }, ${tag}`,
    ]);
    edit("lib/saves/keys.ts", "slots", [`    "${slug}": { app: "${slug}", key: "${slug}-save-v1", version: 1 }, ${tag}`]);
    edit("lib/games/save-slot.ts", "slots", [`    "${slug}": SLOTS["${slug}"], ${tag}`]);
    edit("lib/games/save-slot.ts", "defs", [`    if (game === "${slug}") return (await import("@/lib/${slug}/engine")).SAVE_DEF as SaveDef<unknown>; ${tag}`]);
    edit("lib/game-launch/launch.ts", "saves", [
        `    "${slug}": { key: "${slug}-save-v1", kind: "save", read: (o) => ({ savedAt: num(o.savedAt) }) }, ${tag}`,
    ]);
    const section_ = SECTIONS[section];
    edit("lib/creations-data.ts", `games:${section}`, [
        `            { ${tag}`,
        `                slug: "${slug}", ${tag}`,
        `                title: "${name}", ${tag}`,
        `                status: "building", ${tag}`,
        `                icon: Ic.${section_.icon}, ${tag}`,
        `                blurb: "${name} is a new game in development. It will go live in this section when it is playable.", ${tag}`,
        `                features: ["Generators and upgrades", "Offline progress", "Prestige resets"], ${tag}`,
        `                accent: "${accent}", ${tag}`,
        `            }, ${tag}`,
    ]);
    edit("docs/OWNERS.md", "owners", [
        `- ${name} | components/${slug}, lib/${slug}, app/creations/games/${slug}, app/camino/${slug}.css, tests/${slug}, docs/games/${slug} | Build ${name} | ${today()} | docs/games/${slug} ${tagHtml}`,
    ]);
    edit("docs/README.md", "games", [
        `- ${name}: [FEATURES](games/${slug}/FEATURES.md), [BACKLOG](games/${slug}/BACKLOG.md), [README](games/${slug}/README.md) ${tagHtml}`,
    ]);

    // The window check and the shell check read this list. Only generated games are marked, so their checks stay cheap.
    const list = JSON.parse(readFileSync(CHECK_LIST, "utf8"));
    if (list.some((g) => g.id === slug)) fail(`${slug} is already in scripts/games/games-under-check.json.`);
    list.push({ id: slug, name, root: `.${slug}-root`, template: true });
    const listText = `${JSON.stringify(list, null, 2)}\n`;

    // package.json: one script per generated game. The round trip must reproduce the file exactly, or nothing is edited.
    const pkgText = readFileSync(PACKAGE_JSON, "utf8");
    const pkg = JSON.parse(pkgText);
    if (JSON.stringify(pkg, null, 4) + "\n" !== pkgText) fail("package.json is not in the format this script writes. Edit it by hand.");
    pkg.scripts[`test:${slug}`] = `node --experimental-strip-types --no-warnings --test --test-reporter=spec "tests/${slug}/*.test.mjs"`;
    const pkgNext = `${JSON.stringify(pkg, null, 4)}\n`;

    const plan = [];
    for (const [src, dest] of [
        ["layout.tsx.tpl", `app/creations/games/${slug}/layout.tsx`],
        ["page.tsx.tpl", `app/creations/games/${slug}/page.tsx`],
        ["Game.tsx.tpl", `components/${slug}/${camel}.tsx`],
        ["engine.ts.tpl", `lib/${slug}/engine.ts`],
        ["engine.test.mjs.tpl", `tests/${slug}/engine.test.mjs`],
        ["game.css.tpl", `app/camino/${slug}.css`],
        ["README.md.tpl", `docs/games/${slug}/README.md`],
        ["FEATURES.md.tpl", `docs/games/${slug}/FEATURES.md`],
        ["BACKLOG.md.tpl", `docs/games/${slug}/BACKLOG.md`],
    ]) {
        const text = fill(readFileSync(join(TEMPLATE_DIR, src), "utf8"), tokens);
        plan.push(dest);
        writeFile(join(ROOT, dest), text, dry);
    }
    for (const [rel, text] of edits) {
        plan.push(`${rel} (lines tagged gen:${slug})`);
        writeFile(join(ROOT, rel), text, dry);
    }
    plan.push("scripts/games/games-under-check.json", "package.json (test:" + slug + ")");
    writeFile(CHECK_LIST, listText, dry);
    writeFile(PACKAGE_JSON, pkgNext, dry);

    console.log(`${dry ? "Would create" : "Created"} ${name} (${slug}):`);
    for (const p of plan) console.log(`  ${p}`);
    if (dry) return;
    console.log(`
Next:
  npm run test:${slug}                      engine tests
  npm run dev                               then open http://localhost:3000/creations/games/${slug}
  npx tsc --noEmit                          types
Make the card live in the Games hub with status "playable", href "/creations/games/${slug}" and a shot,
in lib/creations-data.ts. Read docs/games/NEW-GAME.md before the first real change.`);
}

function removeGame(slug, args) {
    const dry = !!args.flags["dry-run"];
    const removed = [];
    for (const dir of GAME_DIRS(slug, "")) {
        const full = join(ROOT, dir);
        if (existsSync(full)) {
            removed.push(dir);
            if (!dry) rmSync(full, { recursive: true, force: true });
        }
    }
    for (const rel of SHARED_FILES) {
        const text = readShared(rel);
        const lines = text.split("\n");
        const kept = lines.filter((l) => !taggedLine(slug, l));
        if (kept.length !== lines.length) {
            removed.push(`${rel} (${lines.length - kept.length} tagged lines)`);
            if (!dry) writeFileSync(join(ROOT, rel), kept.join("\n"));
        }
    }
    const list = JSON.parse(readFileSync(CHECK_LIST, "utf8"));
    const nextList = list.filter((g) => g.id !== slug);
    if (nextList.length !== list.length) {
        removed.push("scripts/games/games-under-check.json");
        if (!dry) writeFileSync(CHECK_LIST, `${JSON.stringify(nextList, null, 2)}\n`);
    }
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8"));
    if (pkg.scripts[`test:${slug}`]) {
        delete pkg.scripts[`test:${slug}`];
        removed.push("package.json (test:" + slug + ")");
        if (!dry) writeFileSync(PACKAGE_JSON, `${JSON.stringify(pkg, null, 4)}\n`);
    }
    if (!removed.length) fail(`nothing to remove for ${slug}.`);
    console.log(`${dry ? "Would remove" : "Removed"} ${slug}:`);
    for (const r of removed) console.log(`  ${r}`);
}

const args = parseArgs(process.argv.slice(2));
if (args.flags.help || args.positional.length === 0) usage(args.flags.help ? 0 : 1);
if (args.positional.length > 1) fail("give one slug.");
const slug = args.positional[0];
if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 24) {
    fail("the slug must be lowercase letters, digits and single dashes, 3 to 24 characters, starting with a letter.");
}
if (args.flags.remove) removeGame(slug, args);
else createGame(slug, args);
