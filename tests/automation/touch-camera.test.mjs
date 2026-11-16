// Touch camera: one finger drags to orbit, two fingers pinch to zoom, and the pad's turn and zoom keys move the camera.
// Drives PointerInput with plain pointer-event objects on a fake element, so no browser is needed.
import test from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers.mjs";

const A = await load("lib/automation/input/index.ts");
const { OrbitCamera, PointerInput, BuildController } = A;
const board = { width: 20, depth: 20 };

function fakeElement() {
    const handlers = {};
    return {
        style: {},
        addEventListener: (type, fn) => (handlers[type] = fn),
        removeEventListener: (type) => delete handlers[type],
        setPointerCapture() {},
        releasePointerCapture() {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 664, right: 390, bottom: 664 }),
        fire: (type, e) => handlers[type]?.({ pointerType: "touch", button: 0, ...e }),
    };
}

function setup() {
    const el = fakeElement();
    const camera = new OrbitCamera(undefined, { target: { x: 16, y: 0, z: 16 }, yaw: 0.6, pitch: 0.9, distance: 24 });
    const world = { get: () => null, set: () => {}, check: undefined };
    const build = new BuildController({ world, board, onEvent: () => {}, lineKinds: [] });
    const pointer = new PointerInput({ element: el, camera, build, board });
    pointer.attach();
    return { el, camera, pointer };
}

test("one finger dragging across the view orbits the camera instead of panning it", () => {
    const { el, camera } = setup();
    camera.settle();
    const yaw0 = camera.pose().yaw;
    const target0 = camera.pose().target;
    el.fire("pointerdown", { pointerId: 1, clientX: 100, clientY: 300 });
    el.fire("pointermove", { pointerId: 1, clientX: 160, clientY: 300 });
    el.fire("pointerup", { pointerId: 1, type: "pointerup", clientX: 160, clientY: 300 });
    camera.settle();
    // 60 px to the right at 0.0075 rad per px turns the view right (yaw goes down).
    assert.ok(Math.abs(camera.pose().yaw - (yaw0 - 60 * 0.0075)) < 1e-6, `yaw moved ${camera.pose().yaw - yaw0}`);
    assert.deepEqual(camera.pose().target, target0, "the target does not move on a one-finger drag");
});

test("a short touch that does not travel places or selects and leaves the camera alone", () => {
    const { el, camera } = setup();
    camera.settle();
    const yaw0 = camera.pose().yaw;
    el.fire("pointerdown", { pointerId: 2, clientX: 100, clientY: 300 });
    el.fire("pointermove", { pointerId: 2, clientX: 104, clientY: 302 });
    el.fire("pointerup", { pointerId: 2, type: "pointerup", clientX: 104, clientY: 302 });
    camera.settle();
    assert.equal(camera.pose().yaw, yaw0);
});

test("two fingers spreading apart zoom in, and moving together pan the map", () => {
    const { el, camera } = setup();
    camera.settle();
    const d0 = camera.pose().distance;
    el.fire("pointerdown", { pointerId: 3, clientX: 150, clientY: 300 });
    el.fire("pointerdown", { pointerId: 4, clientX: 250, clientY: 300 });
    // Spread from 100 px apart to 200 px apart, both moving 0 px vertically.
    el.fire("pointermove", { pointerId: 3, clientX: 100, clientY: 300 });
    el.fire("pointermove", { pointerId: 4, clientX: 300, clientY: 300 });
    camera.settle();
    assert.ok(camera.pose().distance < d0, "spreading the fingers zooms in");
    // Both fingers slide right together: the midpoint moves, so the map pans.
    const before = camera.pose().target;
    el.fire("pointermove", { pointerId: 3, clientX: 140, clientY: 300 });
    el.fire("pointermove", { pointerId: 4, clientX: 340, clientY: 300 });
    camera.settle();
    assert.notDeepEqual(camera.pose().target, before, "a two-finger slide pans the target");
    el.fire("pointerup", { pointerId: 3, type: "pointerup", clientX: 140, clientY: 300 });
    el.fire("pointerup", { pointerId: 4, type: "pointerup", clientX: 340, clientY: 300 });
});

test("the pad's held turn and zoom move the camera each frame, and stop when released", () => {
    const camera = new OrbitCamera(undefined, { yaw: 0.6, pitch: 0.9, distance: 24 });
    camera.settle();
    const yaw0 = camera.pose().yaw;
    // Turn right is a negative yaw step (see the groundBasis note in camera.ts).
    camera.rotate(-1.5 * 0.5);
    camera.settle();
    assert.ok(Math.abs(camera.pose().yaw - (yaw0 - 0.75)) < 1e-6);
    camera.zoom(Math.exp(-1.2 * 0.5));
    camera.settle();
    assert.ok(camera.pose().distance < 24, "zoom in shrinks the distance");
});
