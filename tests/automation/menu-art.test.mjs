// Menu art must follow the 3D machine models: each portrait stores a hash of its model source. If a model changes,
// redraw the machine in scripts/brasswork/bw_machines.py to match and run `python3 scripts/brasswork/build-menu-art.py`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { PORTRAIT_MODEL_HASH, PORTRAITS, RARITY_FRAMES, MACHINE_RARITY } from "../../lib/automation/art/index.ts";

const DIR = new URL("../../lib/automation/models/machines/", import.meta.url);
const FILE = { spring_store: "springstore.ts", spring_winder: "winder.ts" };
const SHARED = ["common.ts", "palette.ts", "builder.ts"];

test("portraits match the current machine models", () => {
    const stale = [];
    for (const id of Object.keys(PORTRAITS)) {
        const h = createHash("sha1");
        // A Windows checkout may hold CRLF; the stored hash is over LF source, so normalise before hashing.
        for (const f of [FILE[id] ?? `${id}.ts`, ...SHARED]) h.update(readFileSync(new URL(f, DIR), "utf8").replace(/\r\n/g, "\n"));
        if (h.digest("hex").slice(0, 12) !== PORTRAIT_MODEL_HASH[id]) stale.push(id);
    }
    assert.deepEqual(stale, [], `Machine models changed: ${stale.join(", ")}. Update their drawings in scripts/brasswork/bw_machines.py, then run python3 scripts/brasswork/build-menu-art.py`);
});

test("every machine has a rarity with a frame, and every art file exists", () => {
    for (const id of Object.keys(PORTRAITS)) assert.ok(RARITY_FRAMES[MACHINE_RARITY[id]], id);
    for (const f of ["portraits.webp", "milestones.webp", "research.webp", "sites.webp", "frame-gilt.png", "quest.png", "seal.png"])
        assert.ok(existsSync(new URL(`../../public/brasswork/art/${f}`, import.meta.url)), f);
});
