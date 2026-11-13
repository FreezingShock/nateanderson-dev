// Brasswork resource models: deposits and stockpiles stay inside one cell, are
// deterministic, and each ore keeps its own colour so it reads at a glance.
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

registerHooks({
    resolve(spec, ctx, next) {
        try {
            return next(spec, ctx);
        } catch (e) {
            if (spec.startsWith(".")) return next(spec + ".ts", ctx);
            throw e;
        }
    },
});
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const R = await import(
    resolve(root, "lib/automation/models/resources/index.ts")
);

const STATES = {
    pure: { purity: 2 },
    normal: { purity: 1 },
    impure: { purity: 0.5 },
    depleted: { purity: 1, remaining: 0 },
};

test("every raw item in the recipe tree has a deposit and a colour", async () => {
    const { RECIPE_TREE } = await import(
        resolve(root, "lib/automation/data/tree.ts")
    );
    for (const n of RECIPE_TREE.nodes) {
        assert.ok(
            R.RESOURCE_IDS.includes(n.item),
            `no deposit model for ${n.item}`
        );
        assert.ok(R.RESOURCE_COLORS[n.item], `no colour for ${n.item}`);
    }
});

test("deposits stay inside one cell, above ground and under machine height", () => {
    for (const id of R.RESOURCE_IDS)
        for (const [name, o] of Object.entries(STATES))
            for (let v = 0; v < R.DEPOSIT_VARIANTS; v++)
                for (const seed of [0, 1, 7, 42]) {
                    const m = R.buildDeposit(id, { ...o, variant: v, seed });
                    const at = `${id} ${name} v${v} s${seed}`;
                    assert.ok(m.count > 20, `${at} is nearly empty`);
                    assert.ok(
                        m.min[0] >= -5 &&
                            m.max[0] <= 4 &&
                            m.min[2] >= -5 &&
                            m.max[2] <= 4,
                        `${at} leaves its cell`
                    );
                    assert.ok(m.min[1] >= 0, `${at} goes below ground`);
                    assert.ok(m.max[1] <= 14, `${at} is taller than 1.4 units`);
                    assert.equal(m.pos.length, m.count * 3);
                }
});

test("deposits are deterministic and variants differ", () => {
    for (const id of R.RESOURCE_IDS) {
        const a = R.buildDeposit(id, { variant: 1, seed: 3 });
        const b = R.buildDeposit(id, { variant: 1, seed: 3 });
        assert.deepEqual(Array.from(a.pos), Array.from(b.pos));
        assert.deepEqual(Array.from(a.color), Array.from(b.color));
        const c = R.buildDeposit(id, { variant: 2, seed: 3 });
        assert.notDeepEqual(
            Array.from(a.pos),
            Array.from(c.pos),
            `${id} variants look the same`
        );
    }
});

test("richer deposits show more ore, depleted ones much less", () => {
    const share = (id, o) => {
        const C = R.RESOURCE_COLORS[id];
        const m = R.buildDeposit(id, { ...o, variant: 0, seed: 1 });
        // compare against the un-jittered ore colours by nearest match
        const near = (c, t) =>
            Math.abs(((c >> 16) & 255) - ((t >> 16) & 255)) +
                Math.abs(((c >> 8) & 255) - ((t >> 8) & 255)) +
                Math.abs((c & 255) - (t & 255)) <
            40;
        let ore = 0;
        for (const c of m.color)
            if (near(c, C.main) || near(c, C.dark) || near(c, C.accent)) ore++;
        return ore;
    };
    for (const id of R.RESOURCE_IDS) {
        const pure = share(id, STATES.pure),
            dep = share(id, STATES.depleted);
        assert.ok(pure > dep * 1.5, `${id}: pure ${pure} vs depleted ${dep}`);
    }
});

test("ore colours are far apart from each other", () => {
    const ids = R.RESOURCE_IDS;
    const d = (a, b) =>
        Math.hypot(
            ((a >> 16) & 255) - ((b >> 16) & 255),
            ((a >> 8) & 255) - ((b >> 8) & 255),
            (a & 255) - (b & 255)
        );
    for (let i = 0; i < ids.length; i++)
        for (let j = i + 1; j < ids.length; j++)
            assert.ok(
                d(
                    R.RESOURCE_COLORS[ids[i]].main,
                    R.RESOURCE_COLORS[ids[j]].main
                ) > 60,
                `${ids[i]} and ${ids[j]} are too close`
            );
});

test("stockpiles fit a cell and rise with fill", () => {
    for (const id of R.STOCK_IDS) {
        let last = -1;
        for (const fill of [0, 0.5, 1]) {
            const m = R.buildStockpile(id, { fill, seed: 2 });
            assert.ok(
                m.min[0] >= -5 &&
                    m.max[0] <= 4 &&
                    m.min[2] >= -5 &&
                    m.max[2] <= 4,
                `${id} leaves its cell`
            );
            assert.ok(m.max[1] >= last, `${id} shrinks as it fills`);
            last = m.max[1];
        }
        assert.ok(last > 3, `${id} full heap never shows over the rim`);
    }
});

test("every model id builds, validates against the shared format and fits its cell", async () => {
    const { validateModel, voxelCount } = await import(
        resolve(root, "lib/automation/models/format.ts")
    );
    const ids = R.allResourceModelIds();
    assert.ok(ids.length >= 80);
    for (const id of ids) {
        const m = R.resourceModel(id);
        assert.ok(m, `${id} did not build`);
        assert.equal(m.id, id);
        validateModel(m);
        const p = m.parts[0].pos;
        for (let i = 0; i < p.length; i += 3)
            assert.ok(
                p[i] >= 0 &&
                    p[i] < 10 &&
                    p[i + 2] >= 0 &&
                    p[i + 2] < 10 &&
                    p[i + 1] >= 0,
                `${id} voxel outside its cell`
            );
        assert.ok(
            voxelCount(m) < 4000,
            `${id} has ${voxelCount(m)} voxels, over budget`
        );
    }
    assert.equal(R.gradeOf(2), "pure");
    assert.equal(R.gradeOf(0.5), "impure");
    assert.equal(R.gradeOf(1, 0), "depleted");
    assert.equal(
        R.resourceModel("resource.stock.coal.60").id,
        "resource.stock.coal.70"
    );
});

test("seam stamps are flat lenses with some pieces standing proud", () => {
    for (const id of R.RESOURCE_IDS) {
        const s = R.seamStamp(id, 4);
        assert.ok(s.length > 10);
        assert.ok(s.every((v) => v.dz === 0 || v.dz === 1));
        assert.ok(s.some((v) => v.dz === 1));
    }
});
