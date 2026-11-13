// Belt and logistics kit: geometry budgets, paths and tile picking. Three-free parts only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// The kit imports "./paths" without an extension, like the bundler; resolve that to .ts here.
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
const { PIECES, PIECE_KINDS, buildPiece } = await import("../../lib/automation/models/belts/pieces.ts");
const { meshVoxels } = await import("../../lib/automation/models/belts/vox.ts");
const { PathId, pathPoint, pathLen, SLATS_PER_CELL } = await import("../../lib/automation/models/belts/paths.ts");
const { pickBeltTile } = await import("../../lib/automation/models/belts/tiles.ts");
const { BELT_TIERS } = await import("../../lib/automation/models/belts/palette.ts");

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);

test("every piece builds in every tier inside its footprint", () => {
    for (const kind of PIECE_KINDS) {
        const fp = PIECES[kind].footprint;
        for (let t = 0; t < BELT_TIERS.length; t++) {
            const s = buildPiece(kind, t);
            assert.ok(s.size > 0, `${kind} has voxels`);
            for (const v of s.voxels()) {
                assert.ok(v.i >= 0 && v.i < fp.w * 10, `${kind} i=${v.i} inside`);
                assert.ok(v.k >= 0 && v.k < fp.d * 10, `${kind} k=${v.k} inside`);
                assert.ok(v.j >= 0, `${kind} j=${v.j} above ground`);
            }
        }
    }
});

test("triangle budget: belts stay cheap enough to instance by the hundred", () => {
    for (const kind of PIECE_KINDS) {
        const tris = meshVoxels(buildPiece(kind, 0)).triangles;
        const cap = kind === "dock" ? 6000 : kind === "straight" || kind.startsWith("corner") ? 800 : 1400;
        assert.ok(tris <= cap, `${kind}: ${tris} triangles > ${cap}`);
    }
});

test("paths start and end on cell edge midpoints so tiles chain", () => {
    const ends = {
        [PathId.Straight]: [[0.5, 0], [0.5, 1]],
        [PathId.CornerL]: [[0, 0.5], [0.5, 1]],
        [PathId.CornerR]: [[1, 0.5], [0.5, 1]],
        [PathId.RampUp]: [[0.5, 0], [0.5, 1]],
        [PathId.RampDown]: [[0.5, 0], [0.5, 1]],
        [PathId.HalfIn]: [[0.5, 0], [0.5, 0.5]],
        [PathId.HalfOut]: [[0.5, 0.5], [0.5, 1]],
        [PathId.FromLeft]: [[0, 0.5], [0.5, 0.5]],
        [PathId.FromRight]: [[1, 0.5], [0.5, 0.5]],
        [PathId.ToLeft]: [[0.5, 0.5], [0, 0.5]],
        [PathId.ToRight]: [[0.5, 0.5], [1, 0.5]],
    };
    for (const [id, [a, b]] of Object.entries(ends)) {
        const p0 = pathPoint(Number(id), 0),
            p1 = pathPoint(Number(id), 1);
        near(p0.x, a[0], `path ${id} start x`);
        near(p0.z, a[1], `path ${id} start z`);
        near(p1.x, b[0], `path ${id} end x`);
        near(p1.z, b[1], `path ${id} end z`);
        for (const u of [0, 0.3, 1]) {
            const p = pathPoint(Number(id), u);
            near(Math.hypot(p.tx, p.ty, p.tz), 1, `path ${id} heading is unit`);
        }
    }
    // Corners leave heading +z, like the straight they feed.
    near(pathPoint(PathId.CornerL, 1).tz, 1, "cornerL exit heading");
    near(pathPoint(PathId.CornerR, 1).tz, 1, "cornerR exit heading");
    // Ramps meet: up ends where down starts.
    near(pathPoint(PathId.RampUp, 1).y, pathPoint(PathId.RampDown, 0).y, "ramp heights");
});

test("slat count matches the pitch on every path", () => {
    for (const kind of PIECE_KINDS) {
        const slats = new Map();
        for (const v of buildPiece(kind, 0).voxels()) if (v.slat) slats.set(v.group, v.slat.path);
        const expected = PIECES[kind].paths.reduce((n, id) => n + pathLen(id) * SLATS_PER_CELL, 0);
        assert.equal(slats.size, expected, `${kind} slats`);
    }
});

test("tile picker", () => {
    const n = (o) => ({ back: false, left: false, right: false, front: true, ...o });
    assert.equal(pickBeltTile(n({ back: true })), "straight");
    assert.equal(pickBeltTile(n({ left: true })), "cornerL");
    assert.equal(pickBeltTile(n({ right: true })), "cornerR");
    assert.equal(pickBeltTile(n({ back: true, left: true })), "teeL");
    assert.equal(pickBeltTile(n({ back: true, right: true })), "teeR");
    assert.equal(pickBeltTile(n({})), "capStart");
    assert.equal(pickBeltTile(n({ back: true, front: false })), "capEnd");
    assert.equal(pickBeltTile(n({ back: true, frontIsMachine: true })), "portIn");
    assert.equal(pickBeltTile(n({ backIsMachine: true })), "portOut");
});

test("every kit piece converts to a valid shared voxel model", async () => {
    const { BELT_MODELS } = await import("../../lib/automation/models/belts/models.ts");
    const { validateModel } = await import("../../lib/automation/models/format.ts");
    const ids = new Set();
    for (const m of BELT_MODELS) {
        validateModel(m);
        assert.ok(!ids.has(m.id), `unique id ${m.id}`);
        ids.add(m.id);
    }
    assert.equal(BELT_MODELS.length, PIECE_KINDS.length + 2);
});
