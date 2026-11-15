// Pure logic for the automation input layer: grid lines, keys, camera limits, picking and placement.
import test from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers.mjs";

const A = await load("lib/automation/input/index.ts");
const { DEFAULT_LIMITS, mapKey } = A;
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
    // Pencil: east from 4 to 9 along z=2, then turns south to z=4. Eight cells.
    assert.equal(g.cells.length, 8, "east run then a turn south");
    assert.equal(g.rot, 0, "the last cell faces the way the stroke was going (south)");
    assert.equal(g.validCount, 7, "the blocked cell at 7,2 is skipped");
    assert.equal(b.endStroke(), 7);
    assert.equal(world.get(7, 2), null);
    assert.deepEqual(world.get(5, 2), { kind: "belt", rot: 1 }, "mid-run cells face east");
    assert.deepEqual(world.get(9, 3), { kind: "belt", rot: 0 }, "the turn faces south");
    assert.ok(b.undo());
    assert.equal(world.cells.size, 0, "one undo reverts the whole stroke");
    assert.ok(b.redo());
    assert.equal(world.cells.size, 7);
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

test("mount writes the camera view to a Three-shaped sink each frame", () => {
    const writes = [];
    const sink = {
        position: { set: (x, y, z) => writes.push(["pos", x, y, z]) },
        lookAt: (x, y, z) => writes.push(["look", x, y, z]),
        fov: 0,
        aspect: 1,
        updateProjectionMatrix() {
            writes.push(["proj"]);
        },
    };
    const el = { style: {}, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 800 }) };
    const m = A.mount(sink, el, { board, world: memWorld(), tools: [belt, machine], keyTarget: null, initialPose: { target: A.vec(10, 0, 10), distance: 30 } });
    assert.deepEqual(writes.find((w) => w[0] === "look").slice(1), [10, 0, 10]);
    assert.ok(Math.abs(sink.fov - (DEFAULT_LIMITS.fovY * 180) / Math.PI) < 1e-9, "fov written in degrees");
    assert.equal(sink.aspect, 0.5);
    writes.length = 0;
    m.update(1 / 60);
    assert.ok(writes.some((w) => w[0] === "pos") && writes.some((w) => w[0] === "proj"), "update writes each frame");
    m.destroy();
});

// A world that keeps multi-cell buildings whole, like the sim: one anchor, a footprint of cells pointing at it.
function fpWorld(sizes, check) {
    const buildings = new Map(); // anchorKey -> { kind, rot, anchor }
    const owner = new Map(); // cellKey -> anchorKey
    const cellsOf = (kind, ax, az, rot) => {
        const f = sizes[kind] ?? { w: 1, d: 1 };
        return A.footprintOffsets(f, rot).map((o) => ({ x: ax + o.dx, z: az + o.dz }));
    };
    return {
        buildings,
        owner,
        get(x, z) {
            const k = owner.get(`${x},${z}`);
            return k ? buildings.get(k) : null;
        },
        set(x, z, item) {
            if (item === null) {
                const k = owner.get(`${x},${z}`);
                if (!k) return;
                const b = buildings.get(k);
                for (const c of cellsOf(b.kind, b.anchor.x, b.anchor.z, b.rot)) owner.delete(`${c.x},${c.z}`);
                buildings.delete(k);
                return;
            }
            const anchor = { x, z };
            const key = `${x},${z}`;
            buildings.set(key, { kind: item.kind, rot: item.rot, anchor });
            for (const c of cellsOf(item.kind, x, z, item.rot)) owner.set(`${c.x},${c.z}`, key);
        },
        check,
    };
}

test("footprint offsets match the sim: rotation 1 and 3 swap width and depth", () => {
    const f = { w: 3, d: 1 };
    assert.deepEqual(A.footprintOffsets(f, 0), [{ dx: 0, dz: 0 }, { dx: 1, dz: 0 }, { dx: 2, dz: 0 }]);
    assert.deepEqual(A.footprintOffsets(f, 1), [{ dx: 0, dz: 0 }, { dx: 0, dz: 1 }, { dx: 0, dz: 2 }]);
    assert.deepEqual(A.footprintOffsets(f, 3).length, 3);
    assert.equal(A.footprintOffsets({ w: 2, d: 2 }, 2).length, 4);
    assert.equal(A.footprintOffsets(undefined, 0).length, 1);
});

test("2x2 ghost covers four cells; one occupied cell makes the whole footprint invalid", () => {
    const world = fpWorld({ smelter: { w: 2, d: 2 } });
    const b = new A.BuildController({ world, board });
    const smelter = { id: "smelter", label: "Smelter", line: false, footprint: { w: 2, d: 2 } };
    b.setTool(smelter);
    b.setHover({ x: 4, z: 4 });
    let g = b.ghost();
    assert.equal(g.cells.length, 4);
    assert.ok(g.cells.every((c) => c.valid && c.ax === 4 && c.az === 4));
    assert.equal(g.validCount, 1);
    // A machine sits on (5, 5): the footprint overlaps it.
    world.set(5, 5, { kind: "drill", rot: 0 });
    g = b.ghost();
    const bad = g.cells.filter((c) => !c.valid);
    assert.equal(bad.length, 1, "only the overlapping cell is marked");
    assert.equal(bad[0].reason, "occupied");
    assert.equal(g.validCount, 0);
    assert.equal(b.tap({ x: 4, z: 4 }), 0, "a footprint that does not fit places nothing");
});

test("placing a 2x2 stores one building; undo and redo treat it as a whole", () => {
    const world = fpWorld({ smelter: { w: 2, d: 2 } });
    const b = new A.BuildController({ world, board });
    b.setTool({ id: "smelter", label: "Smelter", line: false, footprint: { w: 2, d: 2 } });
    assert.equal(b.tap({ x: 2, z: 3 }), 1);
    assert.equal(world.buildings.size, 1);
    assert.equal(world.get(3, 4).anchor.x, 2, "covered cell resolves to the anchor");
    assert.ok(b.undo());
    assert.equal(world.buildings.size, 0, "one undo removes the whole building");
    assert.ok(b.redo());
    assert.equal(world.buildings.size, 1);
});

test("rotating a 2x1 footprint changes which cells the ghost covers", () => {
    const world = fpWorld({ press: { w: 2, d: 1 } });
    const b = new A.BuildController({ world, board });
    b.setTool({ id: "press", label: "Press", line: false, footprint: { w: 2, d: 1 } });
    b.setHover({ x: 6, z: 6 });
    const east = b.ghost().cells.map((c) => [c.x, c.z]);
    assert.deepEqual(east, [[6, 6], [7, 6]]);
    b.rotateCw();
    const north = b.ghost().cells.map((c) => [c.x, c.z]);
    assert.deepEqual(north, [[6, 6], [6, 7]]);
});

test("delete on a multi-cell building removes it once, even when several of its cells are selected", () => {
    const world = fpWorld({ smelter: { w: 2, d: 2 } });
    const b = new A.BuildController({ world, board });
    b.setTool({ id: "smelter", label: "Smelter", line: false, footprint: { w: 2, d: 2 } });
    b.tap({ x: 8, z: 8 });
    b.setTool(A.DELETE_TOOL);
    b.beginStroke({ x: 8, z: 8 });
    b.updateStroke({ x: 9, z: 9 });
    // The count is cells cleared: the whole 2 by 2 footprint, once, however many of its cells the stroke touched.
    assert.equal(b.endStroke(), 4, "all four footprint cells cleared once");
    assert.equal(world.buildings.size, 0);
});

test("rotateAt turns a building in place, keeps it whole, and undo restores it in one step", () => {
    const world = fpWorld({ press: { w: 2, d: 1 } });
    const b = new A.BuildController({ world, board });
    b.setTool({ id: "press", label: "Press", line: false, footprint: { w: 2, d: 1 } });
    b.tap({ x: 6, z: 6 });
    assert.deepEqual(world.buildings.get("6,6").rot, 0);
    assert.equal(b.rotateAt({ x: 7, z: 6 }), true, "a covered cell turns the building");
    assert.equal(world.buildings.size, 1, "still one building");
    assert.equal(world.buildings.get("6,6").rot, 1);
    assert.equal(world.get(6, 7)?.anchor?.z, 6, "the new footprint covers (6, 7)");
    assert.ok(b.undo());
    assert.equal(world.buildings.get("6,6").rot, 0, "undo restores the old rotation");
    assert.ok(b.redo());
    assert.equal(world.buildings.get("6,6").rot, 1, "redo turns it again");
});

test("rotateAt refuses a turn that would overlap another building, and leaves the building as it was", () => {
    // The sim's check covers the whole footprint. Here the turned press (rot 1) runs into a block on (6, 7).
    const world = fpWorld({ press: { w: 2, d: 1 } }, (kind, x, z, rot) => (rot === 1 && x === 6 && z === 6 ? "blocked" : null));
    const b = new A.BuildController({ world, board });
    b.setTool({ id: "press", label: "Press", line: false, footprint: { w: 2, d: 1 } });
    b.tap({ x: 6, z: 6 });
    const events = [];
    const b2 = new A.BuildController({ world, board, onEvent: (e) => events.push(e) });
    assert.equal(b2.rotateAt({ x: 6, z: 6 }), false);
    assert.equal(world.buildings.get("6,6").rot, 0, "building unchanged");
    assert.equal(events.at(-1).type, "invalid");
});

test("rotateAt on an empty cell does nothing", () => {
    const world = fpWorld({ press: { w: 2, d: 1 } });
    const b = new A.BuildController({ world, board });
    assert.equal(b.rotateAt({ x: 3, z: 3 }), false);
    assert.equal(b.canUndo(), false);
});

test("WASD maps to held walk actions, not keydown pans", () => {
    assert.deepEqual(mapKey({ key: "w", type: "keydown" }), { type: "walk", dir: "w", down: true });
    assert.deepEqual(mapKey({ key: "D", type: "keydown" }), { type: "walk", dir: "d", down: true });
    assert.deepEqual(mapKey({ key: "a", type: "keyup" }), { type: "walk", dir: "a", down: false });
    assert.equal(mapKey({ key: "s", ctrlKey: true, type: "keydown" }), null);
});

test("select: a placed building reports its anchor and kind; empty cells report nothing", () => {
    const w = memWorld();
    const events = [];
    const b = new A.BuildController({ world: w, board, onEvent: (e) => events.push(e) });
    w.set(4, 4, { kind: "machine", rot: 0, anchor: { x: 3, z: 4 } });
    assert.equal(b.select({ x: 4, z: 4 }), true);
    assert.deepEqual(events.at(-1), { type: "select", cell: { x: 4, z: 4 }, anchor: { x: 3, z: 4 }, kind: "machine" });
    assert.equal(b.select({ x: 9, z: 9 }), false);
    assert.deepEqual(events.slice(1).map((e) => e.type), ["deselect"], "bare ground only asks the host to let go");
});

test("rotateHover: with no tool R turns the building under the cursor; with a tool armed it turns the ghost", () => {
    const w = memWorld();
    const b = new A.BuildController({ world: w, board });
    w.set(5, 5, { kind: "machine", rot: 0 });
    b.setHover({ x: 5, z: 5 });
    b.rotateHover();
    assert.equal(w.get(5, 5).rot, 1, "no tool: placed building turned");
    assert.equal(b.getRot(), 0, "ghost rotation untouched");
    b.undo();
    assert.equal(w.get(5, 5).rot, 0, "one undo step reverts the turn");
    b.setTool(machine);
    b.setHover({ x: 5, z: 5 });
    b.rotateHover();
    assert.equal(w.get(5, 5).rot, 0, "tool armed: the building under the cursor stays put");
    assert.equal(b.getRot(), 1, "tool armed: the ghost turns");
    b.setHover({ x: 8, z: 8 });
    b.rotateHover();
    assert.equal(b.getRot(), 2, "empty cell turns the ghost");
});

test("ghost reason: a refused preview names why; a valid one has none", () => {
    const w = memWorld({ check: (kind, x) => (x === 6 ? "needs power" : null) });
    const b = new A.BuildController({ world: w, board });
    b.setTool(machine);
    b.setHover({ x: 2, z: 2 });
    assert.equal(b.ghost().reason, null);
    b.setHover({ x: 6, z: 2 });
    assert.equal(b.ghost().reason, "needs power");
    b.setTool(A.DELETE_TOOL);
    b.setHover({ x: 1, z: 1 });
    assert.equal(b.ghost().reason, "nothing to remove");
});

test("zoomAt keeps the anchor ground point near the same screen spot", () => {
    const cam = new A.OrbitCamera(A.DEFAULT_LIMITS, { target: { x: 16, y: 0, z: 16 }, yaw: 0.6, pitch: 0.9, distance: 30 });
    const anchor = { x: 22, z: 20 };
    cam.zoomAt(0.5, anchor);
    cam.settle();
    const t = cam.pose().target;
    // Target moved toward the anchor by the zoom fraction: 1 - 15/30 = half way.
    assert.ok(Math.abs(t.x - 19) < 1e-6 && Math.abs(t.z - 18) < 1e-6, `target ${t.x},${t.z}`);
    assert.equal(cam.pose().distance, 15);
});

test("zoomAt with no anchor behaves like zoom", () => {
    const cam = new A.OrbitCamera(A.DEFAULT_LIMITS, { target: { x: 16, y: 0, z: 16 }, distance: 30 });
    cam.zoomAt(2, null);
    cam.settle();
    assert.equal(cam.pose().distance, 60);
    assert.equal(cam.pose().target.x, 16);
});

test("zoomAt eases the target: one frame moves part of the way, not all of it", () => {
    const cam = new A.OrbitCamera(A.DEFAULT_LIMITS, { target: { x: 16, y: 0, z: 16 }, distance: 30 });
    cam.zoomAt(0.5, { x: 22, z: 16 });
    cam.update(1 / 60);
    const x = cam.pose().target.x;
    assert.ok(x > 16 && x < 19, `eased target x ${x}`);
    for (let i = 0; i < 240; i++) cam.update(1 / 60);
    assert.ok(Math.abs(cam.pose().target.x - 19) < 1e-2, "settles at the zoom point");
});

test("panPixels stays instant: the target moves on the same frame", () => {
    const cam = new A.OrbitCamera(A.DEFAULT_LIMITS, { target: { x: 16, y: 0, z: 16 }, distance: 30 });
    const before = cam.pose().target.x;
    cam.panPixels(-100, 0, 800);
    cam.update(1 / 60);
    assert.ok(Math.abs(cam.pose().target.x - before) > 0.5, "pan is not eased");
});

test("runAt follows connected line pieces only; removeCells clears a whole run in one undo step", () => {
    const w = memWorld();
    const b = new A.BuildController({ world: w, board, lineKinds: ["belt"] });
    for (let x = 2; x <= 6; x++) w.set(x, 3, { kind: "belt", rot: 0 });
    w.set(4, 4, { kind: "belt", rot: 1 }); // a branch off the run
    w.set(4, 9, { kind: "machine", rot: 0 }); // not a belt, stays out
    w.set(9, 3, { kind: "belt", rot: 0 }); // a separate run with a gap
    const run = b.runAt({ x: 3, z: 3 });
    assert.equal(run.length, 6, "five in the row plus the branch");
    assert.equal(b.runAt({ x: 9, z: 3 }).length, 1);
    assert.deepEqual(b.runAt({ x: 4, z: 9 }), [], "machines are not runs");
    b.setHighlight(run);
    assert.equal(b.getHighlight().length, 6);
    const n = b.removeCells(run);
    assert.equal(n, 6);
    assert.equal(w.get(4, 3), null);
    assert.ok(w.get(9, 3), "the separate run is untouched");
    assert.equal(b.getHighlight().length, 0, "removing clears the highlight");
    b.undo();
    assert.equal(w.get(4, 3)?.kind, "belt", "one undo brings the whole run back");
    assert.equal(b.getHighlight().length, 0);
});

test("pencil: dragging back over the stroke erases its tail; a stroke is one undo step", () => {
    const world = memWorld();
    const b = new A.BuildController({ world, board });
    b.setTool(belt);
    b.beginStroke({ x: 2, z: 2 });
    b.updateStroke({ x: 2, z: 6 });
    assert.equal(b.ghost().cells.length, 5, "south from 2 to 6");
    b.updateStroke({ x: 2, z: 4 });
    assert.equal(b.ghost().cells.length, 3, "retracing to 4 erases the last two cells");
    b.updateStroke({ x: 5, z: 4 });
    assert.equal(b.ghost().cells.length, 6, "then east from 4 to 5 adds cells again");
    assert.equal(b.endStroke(), 6);
    assert.equal(world.cells.size, 6);
    b.undo();
    assert.equal(world.cells.size, 0, "undo removes the whole stroke at once");
});

test("pencil: a fast jump still draws a connected path", () => {
    const world = memWorld();
    const b = new A.BuildController({ world, board });
    b.setTool(belt);
    b.beginStroke({ x: 0, z: 0 });
    b.updateStroke({ x: 3, z: 3 });
    const cells = b.ghost().cells.map((c) => `${c.x},${c.z}`);
    for (let i = 1; i < cells.length; i++) {
        const [ax, az] = cells[i - 1].split(",").map(Number);
        const [bx, bz] = cells[i].split(",").map(Number);
        assert.equal(Math.abs(ax - bx) + Math.abs(az - bz), 1, "every step is one cell");
    }
    assert.equal(cells.length, 7);
});

// Stroke joins: a line stroke reports belts and facing ports next to its two ends.
test("a line stroke joins an adjacent belt and a port that faces it", async () => {
    const { BuildController } = await import("../../lib/automation/input/build.ts");
    const belt = { kind: "belt", rot: 0 };
    const board = new Map();
    board.set("3,0", belt);
    const world = {
        get: (x, z) => board.get(`${x},${z}`) ?? null,
        set: (x, z, item) => board.set(`${x},${z}`, item),
        portsAt: (x, z) => (x === 0 && z === 2 ? [2] : []),
    };
    const tool = { id: "belt", name: "Brass belt", footprint: { w: 1, d: 1 }, line: true };
    const b = new BuildController({ world, board: { width: 20, depth: 20 }, lineKinds: ["belt"] });
    b.setTool(tool);
    b.beginStroke({ x: 2, z: 0 });
    b.updateStroke({ x: 1, z: 0 });
    const g = b.ghost();
    const kinds = g.joins.map((j) => `${j.kind}:${j.cell.x},${j.cell.z}:${j.dir}`).sort();
    assert.deepEqual(kinds, ["belt:2,0:e"]);
});

// Rotated machine ports: one machine at each of the four rotations.
test("a 1 by 1 machine's port turns with the machine, one quarter per rot", async () => {
    const { rotateCell, rotateSide } = await import("../../lib/automation/input/ports.ts");
    for (let r = 0; r < 4; r++) {
        assert.equal(rotateSide(0, r), r, `side at rot ${r}`);
        assert.deepEqual(rotateCell(0, 0, 1, 1, r), { x: 0, z: 0 }, `cell at rot ${r}`);
    }
});

test("a 2 by 1 machine's far cell and its port side follow each rotation", async () => {
    const { rotateCell, rotateSide } = await import("../../lib/automation/input/ports.ts");
    // Authored along x (w 2, d 1), with the front (side 0, +z) on the +x end cell (1,0).
    assert.deepEqual(rotateCell(1, 0, 2, 1, 0), { x: 1, z: 0 });
    assert.equal(rotateSide(0, 0), 0);
    // Rot 1 runs along z. The footprint is now 1 by 2, the +x end moves to z 0, and the front faces +x.
    assert.deepEqual(rotateCell(1, 0, 2, 1, 1), { x: 0, z: 0 });
    assert.equal(rotateSide(0, 1), 1);
    // Rot 2 runs along x again, flipped, so the +x end becomes cell (0,0) and the front faces -z.
    assert.deepEqual(rotateCell(1, 0, 2, 1, 2), { x: 0, z: 0 });
    assert.equal(rotateSide(0, 2), 2);
    // Rot 3 runs along z, flipped, so the +x end lands on the +z end, cell (0,1), and the front faces -x.
    assert.deepEqual(rotateCell(1, 0, 2, 1, 3), { x: 0, z: 1 });
    assert.equal(rotateSide(0, 3), 3);
});

// Delete on a multi-cell building previews and removes the whole footprint, from any of its cells.
function buildingWorld(cells, anchor, kind) {
    const board = new Map();
    for (const [x, z] of cells) board.set(`${x},${z}`, { kind, rot: 0, anchor });
    return {
        board,
        get: (x, z) => board.get(`${x},${z}`) ?? null,
        set: (x, z, item) => (item ? board.set(`${x},${z}`, item) : board.delete(`${x},${z}`)),
    };
}

for (const [label, cells] of [
    ["2 by 2", [[0, 0], [1, 0], [0, 1], [1, 1]]],
    ["2 by 1 along x", [[0, 0], [1, 0]]],
    ["1 by 2 along z", [[0, 0], [0, 1]]],
    ["3 by 3", [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]]],
]) {
    test(`delete previews the whole ${label} footprint from any cell`, async () => {
        const { BuildController, DELETE_TOOL } = await import("../../lib/automation/input/build.ts");
        for (const hover of cells) {
            const world = buildingWorld(cells, { x: 0, z: 0 }, "drill");
            const b = new BuildController({ world, board: { width: 20, depth: 20 }, lineKinds: [] });
            b.setTool(DELETE_TOOL);
            b.setHover({ x: hover[0], z: hover[1] });
            const g = b.ghost();
            const got = g.cells.map((c) => `${c.x},${c.z}`).sort();
            assert.deepEqual(got, cells.map(([x, z]) => `${x},${z}`).sort(), `hover ${hover}`);
            assert.ok(g.cells.every((c) => c.valid), "every cell of the building is removable");
        }
    });

    test(`deleting from any cell removes the whole ${label} footprint`, async () => {
        const { BuildController, DELETE_TOOL } = await import("../../lib/automation/input/build.ts");
        for (const hover of cells) {
            const world = buildingWorld(cells, { x: 0, z: 0 }, "drill");
            const b = new BuildController({ world, board: { width: 20, depth: 20 }, lineKinds: [] });
            b.setTool(DELETE_TOOL);
            b.setHover({ x: hover[0], z: hover[1] });
            b.deleteAt({ x: hover[0], z: hover[1] });
            for (const [x, z] of cells) assert.equal(world.get(x, z), null, `cell ${x},${z} after deleting from ${hover}`);
        }
    });
}

test("mapKey: Q is the pipette, and a repeat is ignored", () => {
    assert.deepEqual(mapKey({ key: "q", type: "keydown", repeat: false }), { type: "pipette" });
    assert.equal(mapKey({ key: "q", type: "keydown", repeat: true }), null);
});

test("mapKey: Tab cycles build groups forward, Shift+Tab backward", () => {
    assert.deepEqual(mapKey({ key: "Tab", type: "keydown", repeat: false, shiftKey: false }), { type: "group", dir: 1 });
    assert.deepEqual(mapKey({ key: "Tab", type: "keydown", repeat: false, shiftKey: true }), { type: "group", dir: -1 });
});

test("a tap with the delete tool removes the whole building under the cell", async () => {
    const { BuildController, DELETE_TOOL } = await import("../../lib/automation/input/build.ts");
    const cells = [[0, 0], [1, 0], [0, 1], [1, 1]];
    const world = buildingWorld(cells, { x: 0, z: 0 }, "kiln");
    const b = new BuildController({ world, board: { width: 20, depth: 20 }, lineKinds: [] });
    b.setTool(DELETE_TOOL);
    const n = b.tap({ x: 1, z: 1 });
    assert.equal(n, 4, "all four cells changed");
    for (const [x, z] of cells) assert.equal(world.get(x, z), null, `cell ${x},${z}`);
});

test("an area Remove clears every building in the dragged rectangle in one undo step", async () => {
    const { BuildController, DELETE_TOOL, rectCells } = await import("../../lib/automation/input/build.ts");
    assert.equal(rectCells({ x: 3, z: 2 }, { x: 1, z: 1 }).length, 6, "corners in any order");
    const world = memWorld();
    for (let x = 0; x < 6; x++) world.set(x, 1, { kind: "belt", rot: 1 });
    world.set(9, 9, { kind: "belt", rot: 1 });
    const b = new BuildController({ world, board: { width: 20, depth: 20 }, lineKinds: ["belt"] });
    b.setTool(DELETE_TOOL);
    b.beginStroke({ x: 0, z: 0 }, true);
    assert.ok(b.isRectStroke());
    b.updateStroke({ x: 5, z: 2 });
    assert.equal(b.endStroke(), 6, "six belts cleared");
    assert.ok(world.get(9, 9), "belt outside the rectangle stays");
    assert.ok(b.undo());
    for (let x = 0; x < 6; x++) assert.ok(world.get(x, 1), `belt ${x} back after one undo`);
    // Without the rectangle flag the same drag is a path, not an area.
    b.beginStroke({ x: 0, z: 0 }, false);
    assert.ok(!b.isRectStroke());
});

test("selecting bare ground and Esc with nothing armed both report a deselect", () => {
    const events = [];
    const world = memWorld();
    world.set(3, 3, { kind: "machine", rot: 0 });
    const el = { addEventListener() {}, removeEventListener() {}, style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) };
    const ctl = A.createInputController({ element: el, board, world, tools: [belt, machine], keyTarget: null, onEvent: (e) => events.push(e.type) });
    assert.equal(ctl.build.select({ x: 1, z: 1 }), false);
    assert.equal(events.at(-1), "deselect");
    assert.equal(ctl.build.select({ x: 3, z: 3 }), true);
    assert.equal(events.at(-1), "select");
});

test("the pipette copies the turn of the building it picks", () => {
    const world = memWorld();
    world.set(4, 4, { kind: "machine", rot: 2 });
    const el = { addEventListener() {}, removeEventListener() {}, style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) };
    const kt = new EventTarget();
    const ctl = A.createInputController({ element: el, board, world, tools: [belt, machine], keyTarget: kt });
    ctl.build.setHover({ x: 4, z: 4 });
    const ev = new Event("keydown");
    Object.defineProperties(ev, { key: { value: "q" }, target: { value: null } });
    kt.dispatchEvent(ev);
    assert.equal(ctl.build.getTool()?.id, "machine");
    assert.equal(ctl.build.getRot(), 2);
});

test("a belt pressed on a machine and dragged to another places the route the finder returns", async () => {
    const { BuildController } = await import("../../lib/automation/input/build.ts");
    const world = memWorld();
    world.set(0, 0, { kind: "machine", rot: 0 });
    world.set(6, 0, { kind: "machine", rot: 0 });
    const calls = [];
    const route = (from, to, id) => {
        calls.push([from, to, id]);
        return { ok: true, cells: [1, 2, 3, 4, 5].map((x) => ({ x, z: 1, rot: 1 })) };
    };
    const b = new BuildController({ world, board, lineKinds: ["belt"], route });
    b.setTool(belt);
    b.beginStroke({ x: 0, z: 0 });
    assert.ok(b.isRoutedStroke());
    b.updateStroke({ x: 0, z: 0 });
    assert.equal(b.ghost().cells.length, 0, "no route while still on the source machine");
    b.updateStroke({ x: 6, z: 0 });
    assert.equal(b.ghost().cells.length, 5);
    assert.equal(b.endStroke(), 5);
    assert.equal(world.get(3, 1).kind, "belt");
    assert.deepEqual(calls.at(-1)[2], "belt");
    // A failed route reports why and places nothing.
    const events = [];
    const w2 = memWorld();
    w2.set(0, 0, { kind: "machine", rot: 0 });
    const b2 = new BuildController({ world: w2, board, lineKinds: ["belt"], onEvent: (e) => events.push(e), route: () => ({ ok: false, reason: "no clear route" }) });
    b2.setTool(belt);
    b2.beginStroke({ x: 0, z: 0 });
    b2.updateStroke({ x: 5, z: 5 });
    assert.equal(b2.endStroke(), 0);
    assert.deepEqual(events.at(-1), { type: "invalid", reason: "no clear route" });
    // A press on bare ground is still a hand-drawn path.
    b.beginStroke({ x: 9, z: 9 });
    assert.ok(!b.isRoutedStroke());
});
