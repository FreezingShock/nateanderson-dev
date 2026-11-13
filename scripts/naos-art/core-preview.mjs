// Renders the reactor core (lib/nodefarm/art/core-art.ts) at every structure stage into a contact sheet, plus animation frames.
// usage: node scripts/naos-art/core-preview.mjs <outDir> [frames]
// Writes sheet.png (one row per look, one column per stage) and, with frames > 0, f000.png... of the same sheet over time.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const { chromium } = require("playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const out = process.argv[2] ?? "core-preview";
const frames = Number(process.argv[3] ?? 0);
mkdirSync(out, { recursive: true });

// core-art.ts imports its part list from core-parts.ts; inline both so the page needs no bundler
const src = readFileSync(join(root, "lib/nodefarm/art/core-parts.ts"), "utf8") + readFileSync(join(root, "lib/nodefarm/art/core-art.ts"), "utf8").replace(/^import .*$|^export \{.*$/gm, "");
const js = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText.replace(/export /g, "");
const eng = readFileSync(join(root, "lib/nodefarm/engine.ts"), "utf8");
const colors = [...eng.matchAll(/\{ id: "(\w+)", name: "[^"]+", short: "[^"]+", role: "[^"]*",(?: pays: "\w+",)? color: "(#[0-9a-f]{6})" \}/g)].map((m) => m[2]);

const html = `<!doctype html><body style="margin:0;background:#0c0c0c"><canvas id=c></canvas><script>${js}
const COLORS = ${JSON.stringify(colors)};
const STAGES = 14, SC = 2, PAD = 8, CS = CORE_S * SC + PAD;
// rows: [zone, skin, overclock, event]: zone 01 / copper / aether / origin / bloom / core / chroma / aurora / gold / mono / overclock / each zone event
const ROWS = [[0, 0, false, 0], [3, 0, false, 0], [6, 0, false, 0], [16, 0, false, 0], [20, 0, false, 0], [24, 0, false, 0], [0, 1, false, 0], [0, 2, false, 0], [0, 3, false, 0], [0, 4, false, 0], [6, 0, true, 0], [9, 0, false, 1], [9, 0, false, 2], [9, 0, false, 3], [9, 0, false, 4], [9, 0, false, 5]];
const c = document.getElementById("c");
c.width = CS * STAGES; c.height = CS * ROWS.length;
const ctx = c.getContext("2d"); ctx.imageSmoothingEnabled = false;
const tmp = document.createElement("canvas"); tmp.width = tmp.height = CORE_S;
const tctx = tmp.getContext("2d");
const img = tctx.createImageData(CORE_S, CORE_S);
const R = makeCoreRenderer(COLORS);
window.render = (t) => {
  ctx.fillStyle = "#0c0c0c"; ctx.fillRect(0, 0, c.width, c.height);
  ROWS.forEach(([zone, skin, oc, event], row) => {
    for (let st = 0; st < STAGES; st++) {
      let parts = 0; for (let k = 0; k < st; k++) parts |= 1 << k;
      const unlocked = Math.max(zone + 1, [2, 3, 4, 6, 7, 9, 12, 13, 15, 17, 17, 17, 21, 25][st]);
      R.draw(img.data, { progress: 0.62, overclock: oc, unlocked, speed: st / 10, pulse: 0, pulseStat: 1, reboots: st * 6, ap: st * 3, zone, prevZone: zone, zoneMix: 1, skin, flare: 0, event, rigs: Array.from({ length: COLORS.length }, (_, i) => (i < unlocked && i % 3 !== 2 ? 1 + (i % 4) : 0)), fw: 0.6, parts, build: Array(13).fill(1), drones: st >= 4 ? 3 : 0, glyphs: st >= 6 ? 4 : 0 }, t);
      tctx.putImageData(img, 0, 0);
      ctx.drawImage(tmp, st * CS + PAD / 2, row * CS + PAD / 2, CORE_S * SC, CORE_S * SC);
    }
  });
  return c.toDataURL("image/png");
};
</script>`;

const b = await chromium.launch();
const p = await b.newPage();
await p.setContent(html);
const save = async (name, t) => writeFileSync(join(out, name), Buffer.from((await p.evaluate((t) => window.render(t), t)).split(",")[1], "base64"));
await save("sheet.png", 3.3);
for (let i = 0; i < frames; i++) await save(`f${String(i).padStart(3, "0")}.png`, 3.3 + i / 20);
const perf = await p.evaluate(() => {
  const R = makeCoreRenderer(COLORS), d = new Uint8ClampedArray(CORE_S * CORE_S * 4);
  const f = { progress: 0.6, overclock: false, unlocked: 25, speed: 1, pulse: 0, pulseStat: 1, reboots: 99, ap: 30, zone: 16, prevZone: 15, zoneMix: 0.5, skin: 0, flare: 0, event: 3, rigs: Array(25).fill(3), fw: 0.5, parts: 8191, build: Array(13).fill(1), drones: 4, glyphs: 6 };
  for (let i = 0; i < 30; i++) R.draw(d, f, i / 40);
  const t0 = performance.now(); for (let i = 0; i < 200; i++) R.draw(d, f, i / 40); const full = (performance.now() - t0) / 200;
  const f0 = { ...f, event: 0, unlocked: 3, parts: 0, drones: 0, glyphs: 0, zone: 0, prevZone: 0, zoneMix: 1 };
  const t1 = performance.now(); for (let i = 0; i < 200; i++) R.draw(d, f0, i / 40); return [full, (performance.now() - t1) / 200];
});
console.log(`colors ${colors.length}, full core ${perf[0].toFixed(2)} ms/frame, bare core ${perf[1].toFixed(2)} ms/frame`);
await b.close();
