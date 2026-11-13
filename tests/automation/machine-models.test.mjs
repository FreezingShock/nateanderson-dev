// Brasswork machine models: every machine builds, stays in its footprint, has ports on its edge,
// animates with known kinds and stays inside the face budget for a few hundred on screen.
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve extensionless imports inside lib/automation to .ts, like the bundler does.
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
const M = await import(resolve(root, "lib/automation/models/machines/index.ts"));
const F = await import(resolve(root, "lib/automation/models/format.ts"));

const TREE_MACHINES = ["drill", "kiln", "furnace", "press", "lathe", "drawer", "assembler", "fabricator"];
const FOOTPRINTS = { drill: [2, 2], kiln: [2, 2], furnace: [2, 3], press: [2, 3], lathe: [1, 2], drawer: [1, 2], assembler: [3, 3], fabricator: [4, 4] };

test("every recipe-tree machine has a model with the tree's footprint", () => {
    for (const id of TREE_MACHINES) {
        const m = M.getMachineModel(id);
        assert.ok(m, `missing model ${id}`);
        assert.deepEqual([m.footprint.w, m.footprint.d], FOOTPRINTS[id], id);
    }
});

test("power buildings, the hub and the orrery are present", () => {
    for (const id of ["hub", "windmill", "spring_winder", "spring_store", "orrery_4"]) assert.ok(M.getMachineModel(id), id);
    for (let s = 0; s <= M.ORRERY_MAX_STAGE; s++) assert.ok(M.getOrreryModel(s).parts.length > 0);
    assert.equal(M.ORRERY_STAGES.length, M.ORRERY_MAX_STAGE + 1);
});

test("ground footprint is respected (overhangs only above head height)", () => {
    for (const id of M.MACHINE_IDS) {
        const m = M.getMachineModel(id);
        const W = m.footprint.w * 10, D = m.footprint.d * 10;
        for (const p of m.parts) {
            for (let i = 0; i < p.colors.length; i++) {
                const x = p.pos[i * 3] + p.pivot[0], y = p.pos[i * 3 + 1] + p.pivot[1], z = p.pos[i * 3 + 2] + p.pivot[2];
                assert.ok(y >= 0, `${id}/${p.id} below ground`);
                if (y < 30) assert.ok(x >= 0 && x < W && z >= 0 && z < D, `${id}/${p.id} voxel ${x},${y},${z} outside footprint`);
            }
        }
    }
});

test("ports sit on the footprint edge and face outward", () => {
    for (const id of M.MACHINE_IDS) {
        const m = M.getMachineModel(id);
        for (const p of [...m.ports.in, ...m.ports.out]) {
            const { x, z } = p.cell;
            assert.ok(x >= 0 && x < m.footprint.w && z >= 0 && z < m.footprint.d, `${id} port cell inside`);
            const ok = (p.side === 0 && z === m.footprint.d - 1) || (p.side === 2 && z === 0) || (p.side === 1 && x === m.footprint.w - 1) || (p.side === 3 && x === 0);
            assert.ok(ok, `${id} port ${x},${z} side ${p.side} not on an outer edge`);
        }
        if (TREE_MACHINES.includes(id)) assert.ok(m.ports.out.length > 0, `${id} needs an output`);
        if (TREE_MACHINES.includes(id) && id !== "drill") assert.ok(m.ports.in.length > 0, `${id} needs an input`);
    }
});

test("every machine animates and poses are finite", () => {
    for (const id of M.MACHINE_IDS) {
        const m = M.getMachineModel(id);
        const moving = m.parts.filter((p) => p.anim);
        assert.ok(moving.length > 0, `${id} has no moving parts`);
        for (const p of moving) {
            assert.ok(["spin", "slide", "swing", "pulse"].includes(p.anim.kind));
            for (const t of [0, 0.37, 1.9, 1234.5]) {
                const pose = M.poseAt(p.anim, t, true);
                assert.ok(Number.isFinite(pose.angle) && Number.isFinite(pose.offset) && pose.glow >= 0 && pose.glow <= 1, `${id}/${p.id}`);
            }
        }
    }
});

test("idle stops working parts", () => {
    const m = M.getMachineModel("press");
    const ram = m.parts.find((p) => p.id === "ram");
    assert.equal(M.poseAt(ram.anim, 3.3, false).offset, 0);
});

test("face budget: production machines under 12k faces, the orrery under 30k", () => {
    for (const id of M.MACHINE_IDS) {
        const f = M.faceCount(M.getMachineModel(id));
        assert.ok(f < (id.startsWith("orrery") ? 30000 : 12000), `${id} has ${f} faces`);
    }
});

test("every model passes the shared format validator, glow voxels are tagged", () => {
    for (const m of M.allMachineModels()) {
        F.validateModel(m);
        if (!["orrery_0", "orrery_1"].includes(m.id)) assert.ok(m.parts.some((p) => p.tags && p.tags.includes(F.TAG.GLOW)), `${m.id} has no glow (status lamp)`);
    }
});

test("spin and swing pivots are whole voxels", () => {
    for (const m of M.allMachineModels()) for (const p of m.parts) assert.ok(p.pivot.every(Number.isInteger), `${m.id}/${p.id}`);
});
