// Plain test scene: a canvas grid drawn with the same projection the renderer will use, so picking is checked
// against real screen positions. No Three.js here; the renderer thread owns that.
import { createInputController, project, vec } from "./input/index.js";

const board = { width: 20, depth: 20 };
const items = new Map();
const key = (x, z) => `${x},${z}`;
const world = {
    get: (x, z) => items.get(key(x, z)) ?? null,
    set: (x, z, item) => (item ? items.set(key(x, z), item) : items.delete(key(x, z))),
    // Water on one cell, to exercise the blocked ghost state.
    check: (kind, x, z) => (x === 14 && z === 14 ? "water" : null),
};
const canvas = document.getElementById("c");
const ctx2d = canvas.getContext("2d");
const dpr = Math.min(2, window.devicePixelRatio || 1);
let lastEvent = null;

const aspect = () => innerWidth / innerHeight;
const ctl = createInputController({
    element: canvas,
    board,
    world,
    tools: [
        { id: "belt", label: "Belt", line: true },
        { id: "machine", label: "Machine", line: false },
    ],
    initialPose: { target: vec(10, 0, 10), yaw: 0.6, pitch: 0.9, distance: aspect() < 1 ? 40 : 26 },
    onEvent: (e) => (lastEvent = e),
    onChange: () => {},
});
ctl.camera.settle();

function resize() {
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
}
resize();
addEventListener("resize", resize);

const toScreen = (view, p) => {
    const pr = project(view, p);
    return { x: ((pr.ndcX + 1) / 2) * innerWidth, y: ((1 - pr.ndcY) / 2) * innerHeight };
};
const quad = (view, x, z, fill) => {
    ctx2d.beginPath();
    [[x, z], [x + 1, z], [x + 1, z + 1], [x, z + 1]].forEach(([qx, qz], i) => {
        const s = toScreen(view, vec(qx, 0, qz));
        i ? ctx2d.lineTo(s.x, s.y) : ctx2d.moveTo(s.x, s.y);
    });
    ctx2d.closePath();
    ctx2d.fillStyle = fill;
    ctx2d.fill();
};

function draw() {
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2d.fillStyle = "#0b1410";
    ctx2d.fillRect(0, 0, innerWidth, innerHeight);
    const view = ctl.camera.view(aspect());
    for (let x = 0; x < board.width; x++)
        for (let z = 0; z < board.depth; z++) quad(view, x, z, (x + z) % 2 ? "#14231c" : "#172a21");
    for (const [k, it] of items) {
        const [x, z] = k.split(",").map(Number);
        quad(view, x, z, it.kind === "belt" ? "#3aa9d8" : "#f2c14e");
    }
    const g = ctl.build.ghost();
    if (g) for (const c of g.cells) quad(view, c.x, c.z, c.valid ? "rgba(90,255,140,0.55)" : "rgba(255,80,80,0.6)");
}

let last = performance.now();
function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctl.update(dt);
    draw();
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__auto = {
    ctl,
    cellPx(x, z) {
        const r = canvas.getBoundingClientRect();
        const s = toScreen(ctl.camera.view(r.width / r.height), vec(x + 0.5, 0, z + 0.5));
        return { x: s.x, y: s.y };
    },
    snapshot() {
        const pose = ctl.camera.pose();
        return {
            items: [...items.entries()].map(([k, v]) => {
                const [x, z] = k.split(",").map(Number);
                return { x, z, kind: v.kind, rot: v.rot };
            }),
            ghost: ctl.build.ghost(),
            rot: ctl.build.getRot(),
            topDown: ctl.camera.isTopDown(),
            pitch: pose.pitch,
            yaw: pose.yaw,
            distance: pose.distance,
            target: pose.target,
            lastEvent,
        };
    },
};
