// Pure logic for the automation input layer: grid lines, keys, camera limits, picking and placement.
import test from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers.mjs";

const A = await load("lib/automation/input/index.ts");
const { DEFAULT_LIMITS } = A;
const board = { width: 20, depth: 20 };

// A tiny in-memory world with the same shape the simulation will provide.
function memWorld(extra = {}) {
    const cells = new Map();
    return {
        cells,
        get: (x, z) => cells.get(`${x},${z}`) ?? null,
        set: (x, z, item) => (item ? cells.set(`${x},${z}`, item) : cells.delete(`${x},${z}`)),
        check: extra.check,
    };
}

const belt = { id: "belt", label: "Belt", line: true };
const machine = { id: "machine", label: "Machine", line: false };

test("lineCells snaps to the dominant axis and faces the way it was drawn", () => {
    const east = A.lineCells({ x: 2, z: 5 }, { x: 6, z: 7 }, 0);
    assert.deepEqual(east.cells.map((c) => [c.x, c.z]), [[2, 5], [3, 5], [4, 5], [5, 5], [6, 5]]);
    assert.equal(east.rot, 1);
    const north = A.lineCells({ x: 4, z: 4 }, { x: 5, z: 9 }, 3);
    assert.equal(north.cells.length, 6);
    assert.equal(north.rot, 0);
    const back = A.lineCells({ x: 4, z: 4 }, { x: 4, z: 1 }, 0);
    assert.equal(back.rot, 2);
    const zero = A.lineCells({ x: 4, z: 4 }, { x: 4, z: 4 }, 3);
    assert.deepEqual(zero, { cells: [{ x: 4, z: 4 }], rot: 3 });
});

test("rotate cycles through the four directions", () => {
    assert.equal(A.rotate(0), 1);
    assert.equal(A.rotate(3), 0);
    assert.equal(A.rotate(0, -1), 3);
});

test("mapKey: game keys, site keys left alone, typing modifiers ignored", () => {
    assert.deepEqual(A.mapKey({ key: "r" }), { type: "rotate" });
    assert.deepEqual(A.mapKey({ key: "r", repeat: true }), null);
    assert.deepEqual(A.mapKey({ key: "z", ctrlKey: true }), { type: "undo" });
    assert.deepEqual(A.mapKey({ key: "z", metaKey: true, shiftKey: true }), { type: "redo" });
    assert.deepEqual(A.mapKey({ key: "3" }), { type: "tool", index: 2 });
    assert.deepEqual(A.mapKey({ key: "`" }), null, "backtick belongs to the console");
    assert.deepEqual(A.mapKey({ key: "j", ctrlKey: true }), null, "Ctrl+J belongs to the console");
    assert.deepEqual(A.mapKey({ key: "/" }), null, "slash opens search");
    assert.deepEqual(A.mapKey({ key: "r", altKey: true }), null);
    assert.deepEqual(A.mapKey({ key: " ", type: "keydown" }), { type: "space", down: true });
    assert.deepEqual(A.mapKey({ key: " ", type: "keyup" }), { type: "space", down: false });
});

test("camera stays inside its limits and top-down reaches past the tilt max", () => {
    const cam = new A.OrbitCamera(DEFAULT_LIMITS, { target: { x: 0, y: 0, z: 0 }, distance: 20 });
    cam.panPixels(100000, 0, 800);
    assert.ok(cam.pose().target.x >= DEFAULT_LIMITS.bounds.minX - 1e-9, "x clamped to board");
    cam.zoom(1000);
    cam.settle();
    assert.equal(cam.pose().distance, DEFAULT_LIMITS.maxDistance);
    cam.zoom(0.0000001);
    cam.settle();
    assert.equal(cam.pose().distance, DEFAULT_LIMITS.minDistance);

    cam.setTopDown(true);
    for (let i = 0; i < 200; i++) cam.update(1 / 60);
    assert.ok(Math.abs(cam.pose().pitch - DEFAULT_LIMITS.topDownPitch) < 1e-3, "top-down pitch reached");
    cam.setTopDown(false);
    for (let i = 0; i < 200; i++) cam.update(1 / 60);
    assert.ok(cam.pose().pitch <= DEFAULT_LIMITS.maxPitch + 1e-9, "back under the tilt max");
    cam.tilt(10);
    cam.settle();
    assert.ok(cam.pose().pitch <= DEFAULT_LIMITS.maxPitch + 1e-9);
});

test("camera pan follows the finger: dragging right moves the map right", () => {
    const cam = new A.OrbitCamera(DEFAULT_LIMITS, { target: { x: 16, y: 0, z: 16 }, yaw: 0, pitch: 0.9, distance: 20 });
    const before = cam.view(1);
    const b = A.viewBasis(before);
    cam.panPixels(50, 0, 600); // finger moves right
    const after = cam.pose().target;
    const dx = after.x - 16;
    const dz = after.z - 16;
    // Target should move left of screen-right, i.e. opposite to the camera's right vector.
    assert.ok(dx * b.right.x + dz * b.right.z < 0);
});

test("picking: a projected cell centre picks that same cell (flat and with heights)", () => {
    const cam = new A.OrbitCamera(DEFAULT_LIMITS, { target: { x: 10, y: 0, z: 10 }, yaw: 0.7, pitch: 0.95, distance: 24 });
    const view = cam.view(390 / 844);
    for (const [cx, cz] of [[10, 10], [4, 15], [17, 3], [0, 19]]) {
        const p = A.vec(cx + 0.5, 0, cz + 0.5);
        const proj = A.project(view, p);
        assert.ok(proj.visible);
        const ray = A.screenRay(view, proj.ndcX, proj.ndcY);
        const hit = A.pickGround(ray, board);
        assert.deepEqual(hit.cell, { x: cx, z: cz });
    }
    // A tower one cell wide and 3 high should be picked on its top face when it is in front of the ground cell.
    const heightAt = (x, z) => (x === 10 && z === 10 ? 3 : 0);
    const top = A.vec(10.5, 3, 10.5);
    const proj = A.project(view, top);
    const hit = A.pickGround(A.screenRay(view, proj.ndcX, proj.ndcY), board, heightAt);
    assert.deepEqual(hit.cell, { x: 10, z: 10 });
    assert.ok(Math.abs(hit.point.y - 3) < 0.05, "hit lands on the tower top");
});

test("picking misses off the board", () => {
    const cam = new A.OrbitCamera(DEFAULT_LIMITS, { target: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 1.0, distance: 10 });
    const view = cam.view(1);
    const sky = A.screenRay(view, 0, 0.99);
    assert.equal(A.pickGround(sky, board), null, "ray pointing at the sky");
    const off = A.project(view, A.vec(5.5, 0, -3.5));
    assert.equal(A.pickGround(A.screenRay(view, off.ndcX, off.ndcY), board), null, "ground behind the board edge");
});

test("placement: one press places, ghost is valid for empty cells and invalid for occupied", () => {
    const world = memWorld();
    const events = [];
    const b = new A.BuildController({ world, board, onEvent: (e) => events.push(e) });
    b.setTool(machine);
    b.setHover({ x: 3, z: 3 });
    let g = b.ghost();
    assert.equal(g.cells.length, 1);
    assert.equal(g.cells[0].valid, true);
    assert.equal(b.tap({ x: 3, z: 3 }), 1);
    assert.deepEqual(world.get(3, 3), { kind: "machine", rot: 0 });
    b.setHover({ x: 3, z: 3 });
    g = b.ghost();
    assert.equal(g.cells[0].valid, false);
    assert.equal(g.cells[0].reason, "same", "identical item is reported as same");
    b.setTool({ id: "belt", label: "Belt", line: true });
    b.setHover({ x: 3, z: 3 });
    assert.equal(b.ghost().cells[0].reason, "occupied", "different item is occupied");
    b.setTool(machine);
    assert.equal(b.tap({ x: 3, z: 3 }), 0);
    assert.equal(events.at(-1).type, "invalid", "a blocked tap reports why");
});

test("placement: world.check reasons show on the ghost and block placement", () => {
    const world = memWorld({ check: (kind, x) => (x === 5 ? "blocked" : null) });
    const b = new A.BuildController({ world, board });
    b.setTool(machine);
    b.setHover({ x: 5, z: 1 });
    assert.equal(b.ghost().cells[0].reason, "blocked");
    assert.equal(b.tap({ x: 5, z: 1 }), 0);
});

test("drag a belt line: ghost snaps, invalid cells skipped, one undo reverts the whole line", () => {
    const world = memWorld({ check: (kind, x, z) => (x === 7 && z === 2 ? "blocked" : null) });
    const b = new A.BuildController({ world, board });
    b.setTool(belt);
    b.beginStroke({ x: 4, z: 2 });
    b.updateStroke({ x: 9, z: 4 });
    const g = b.ghost();
    assert.equal(g.stroking, true);
    assert.equal(g.cells.length, 6, "dominant axis x, from 4 to 9");
    assert.equal(g.rot, 1);
    assert.equal(g.validCount, 5);
    assert.equal(b.endStroke(), 5);
    assert.equal(world.get(7, 2), null);
    assert.deepEqual(world.get(5, 2), { kind: "belt", rot: 1 });
    assert.ok(b.undo());
    assert.equal(world.cells.size, 0, "one undo reverts the whole stroke");
    assert.ok(b.redo());
    assert.equal(world.cells.size, 5);
});

test("rotate changes the ghost; placed items keep the rotation they had", () => {
    const world = memWorld();
    const b = new A.BuildController({ world, board });
    b.setTool(machine);
    b.rotateCw();
    b.setHover({ x: 1, z: 1 });
    assert.equal(b.ghost().rot, 1);
    b.tap({ x: 1, z: 1 });
    assert.deepEqual(world.get(1, 1), { kind: "machine", rot: 1 });
});

test("delete tool and Delete key: remove an item, invalid when empty", () => {
    const world = memWorld();
    const b = new A.BuildController({ world, board });
    b.setTool(machine);
    b.tap({ x: 2, z: 2 });
    b.setTool(A.DELETE_TOOL);
    b.setHover({ x: 9, z: 9 });
    assert.equal(b.ghost().cells[0].reason, "empty");
    assert.equal(b.deleteAt({ x: 2, z: 2 }), 1);
    assert.equal(world.get(2, 2), null);
    assert.equal(b.deleteAt({ x: 2, z: 2 }), 0);
});

test("a new edit clears redo, history is capped", () => {
    const world = memWorld();
    const b = new A.BuildController({ world, board, historyLimit: 2 });
    b.setTool(machine);
    b.tap({ x: 0, z: 0 });
    b.tap({ x: 1, z: 0 });
    b.tap({ x: 2, z: 0 });
    assert.ok(b.undo());
    assert.ok(b.undo());
    assert.equal(b.undo(), false, "only two steps kept");
    assert.deepEqual(world.get(0, 0), { kind: "machine", rot: 0 }, "oldest step fell out of history, so its cell stays filled");
    b.redo();
    b.tap({ x: 9, z: 9 });
    assert.equal(b.redo(), false, "new edit cleared redo");
});

test("cancelStroke drops a drag without placing anything", () => {
    const world = memWorld();
    const b = new A.BuildController({ world, board });
    b.setTool(belt);
    b.beginStroke({ x: 1, z: 1 });
    b.updateStroke({ x: 5, z: 1 });
    b.cancelStroke();
    assert.equal(world.cells.size, 0);
    assert.equal(b.isStroking(), false);
});

test("createInputController wires tools by id and keys without a DOM", () => {
    const world = memWorld();
    const el = { style: {}, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 800 }) };
    const ctl = A.createInputController({ element: el, board, world, tools: [belt, machine], keyTarget: null });
    ctl.setToolById("machine");
    assert.equal(ctl.build.getTool().id, "machine");
    ctl.setToolById("nope");
    assert.equal(ctl.build.getTool(), null);
    ctl.update(1 / 60);
    ctl.destroy();
});

test("board with an origin: cells outside its window are rejected", () => {
    const b = { width: 18, depth: 12, originX: -9, originZ: -6 };
    assert.equal(A.cellInBoard({ x: -9, z: -6 }, b), true);
    assert.equal(A.cellInBoard({ x: 8, z: 5 }, b), true);
    assert.equal(A.cellInBoard({ x: 9, z: 0 }, b), false);
    assert.equal(A.cellInBoard({ x: 0, z: -7 }, b), false);
    const world = memWorld();
    const c = new A.BuildController({ world, board: b });
    c.setTool(machine);
    assert.equal(c.tap({ x: -9, z: -6 }), 1);
    assert.equal(c.tap({ x: 0, z: 0 }), 1);
    assert.equal(c.tap({ x: 20, z: 0 }), 0);
});
