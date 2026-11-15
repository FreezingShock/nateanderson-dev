// Every planet has a drawn sheet at every stage, so the Orbit panel and the scene never fall back to the code drawing once loaded.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import * as D from "../../lib/starwright/data.ts";

const manifest = JSON.parse(readFileSync("public/starwright/manifest.json", "utf8"));

test("all 8 planets have drawn sheets at all 4 stages, and the files exist", () => {
    assert.equal(D.PLANETS.length, 8);
    for (const p of D.PLANETS) {
        for (let st = 0; st < 4; st++) {
            const e = manifest.sheets[`planet/${p.id}-s${st}`];
            assert.ok(e, `no sheet for ${p.id} stage ${st}`);
            assert.ok(existsSync(`public${e.src}`), `missing file ${e.src}`);
            assert.ok(e.frames >= 1 && e.w > 0 && e.h > 0);
        }
    }
});

test("every sheet in the manifest has its file", () => {
    for (const [id, e] of Object.entries(manifest.sheets)) assert.ok(existsSync(`public${e.src}`), `${id}: ${e.src}`);
});
