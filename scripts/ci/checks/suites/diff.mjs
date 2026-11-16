// Screenshot diff: compares two folders of PNGs (base and head) pixel by pixel, writes a diff image for each page that
// changed by 0.5% of its pixels or more, and a summary.md for the PR comment and the job summary.
//   node scripts/ci/checks/run.mjs diff base-shots head-shots diff-out
// Advisory: always exits 0. Judge the diff images by eye; the animated pages (Brasswork's scene) show about 1% noise.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";

export const suite = "diff";

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");
const pixelmatch = require("pixelmatch").default ?? require("pixelmatch");
const THRESH = 0.5; // percent of pixels; below this is treated as noise

export function run([a, b, out]) {
    mkdirSync(out, { recursive: true });
    const rows = [];
    for (const f of readdirSync(b).filter((x) => x.endsWith(".png")).sort()) {
        const name = f.replace(/\.png$/, "");
        if (!existsSync(`${a}/${f}`)) { rows.push({ name, pct: null, note: "new page" }); continue; }
        const A = PNG.sync.read(readFileSync(`${a}/${f}`));
        const B = PNG.sync.read(readFileSync(`${b}/${f}`));
        if (A.width !== B.width || A.height !== B.height) { rows.push({ name, pct: null, note: "size changed" }); continue; }
        const D = new PNG({ width: A.width, height: A.height });
        const n = pixelmatch(A.data, B.data, D.data, A.width, A.height, { threshold: 0.15 });
        const pct = (n / (A.width * A.height)) * 100;
        if (pct >= THRESH) writeFileSync(`${out}/${f}`, PNG.sync.write(D));
        rows.push({ name, pct });
    }
    for (const f of readdirSync(a).filter((x) => x.endsWith(".png"))) if (!existsSync(`${b}/${f}`)) rows.push({ name: f.replace(/\.png$/, ""), pct: null, note: "page removed" });

    const changed = rows.filter((r) => r.pct === null || r.pct >= THRESH);
    let md = `### Screenshot diff vs base\n\n`;
    if (!changed.length) md += `No visual changes above ${THRESH}% on ${rows.length} screenshots.\n`;
    else {
        md += `${changed.length} of ${rows.length} screenshots changed (viewport only, animations frozen). Diff images are in the \`screenshot-diff\` artifact.\n\n| Page | Change |\n|---|---|\n`;
        for (const r of changed) md += `| ${r.name} | ${r.pct === null ? r.note : r.pct.toFixed(1) + "% of pixels"} |\n`;
    }
    writeFileSync(`${out}/summary.md`, md);
    console.log(md);
}
