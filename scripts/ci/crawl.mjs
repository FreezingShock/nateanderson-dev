// Broken-link crawl. Usage: node scripts/ci/crawl.mjs http://localhost:3123
// Starts from "/" and every static route Next built, follows every internal href/src,
// and fails on any 4xx/5xx. External links are not checked (too flaky for a PR gate).
import { readFileSync } from "node:fs";
import { unlock, waitFor } from "./lib.mjs";

const base = (process.argv[2] || "http://localhost:3123").replace(/\/$/, "");
await waitFor(base);
const cookie = await unlock(base);

const seeds = new Set(["/"]);
try {
    const m = JSON.parse(readFileSync(".next/server/app-paths-manifest.json", "utf8"));
    for (const k of Object.keys(m)) {
        if (!k.endsWith("/page") || k.includes("[") || k.startsWith("/_")) continue;
        seeds.add(k.replace(/\/page$/, "") || "/");
    }
} catch {}

const seen = new Map(); // path -> { status, from }
const queue = [...seeds].map((p) => ({ p, from: "(seed)" }));
const attr = /(?:href|src)=["']([^"'#]+)[^"']*["']/g;
const skip = (p) => p.startsWith("/api/");

while (queue.length) {
    const { p, from } = queue.shift();
    if (seen.has(p) || skip(p)) continue;
    let status = 0, type = "";
    let body = "";
    try {
        const r = await fetch(base + p, { headers: { cookie, accept: "text/html,*/*" }, redirect: "follow" });
        status = r.status;
        type = r.headers.get("content-type") || "";
        body = type.includes("text/html") ? await r.text() : (await r.arrayBuffer(), "");
    } catch (e) {
        status = 0;
    }
    seen.set(p, { status, from });
    if (!body) continue;
    for (const m of body.matchAll(attr)) {
        let u = m[1].replace(/&amp;/g, "&");
        if (/^(mailto:|tel:|data:|javascript:|blob:)/.test(u)) continue;
        if (/^https?:\/\//.test(u)) {
            if (!u.startsWith(base)) continue;
            u = u.slice(base.length) || "/";
        }
        if (!u.startsWith("/") || u.startsWith("//")) continue;
        if (!seen.has(u)) queue.push({ p: u, from: p });
    }
}

const bad = [...seen].filter(([, v]) => v.status === 0 || v.status >= 400);
console.log(`Crawled ${seen.size} URLs (${seeds.size} seeded routes).`);
if (bad.length) {
    console.log(`\n${bad.length} broken:`);
    for (const [p, v] of bad) console.log(`  ${v.status || "ERR"}  ${p}   (linked from ${v.from})`);
    process.exit(1);
}
console.log("No broken internal links or assets.");
