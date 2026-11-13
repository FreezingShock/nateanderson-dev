// Brasswork voxel island renderer. Public entry point: createVoxelIsland(canvas, options).
//
// Scene layout: terrain voxels (TERRAIN_CELL) and object voxels (OBJECT_CELL) share one block palette
// and one material, each in its own sparse chunk grid. Grass is instanced and wind-swayed. Water is a
// plane at WATER_LEVEL. A pixel/dither pass finishes the frame. A frame governor steps quality down
// when frames run over budget.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
    BLOCK_ID_BASE,
    DAY_LENGTH_SEC,
    OBJECT_CELL,
    QUALITY_PRESETS,
    TERRAIN_CELL,
} from "./config";
import { VoxelGrid } from "./grid";
import { BlockRegistry, ChunkMesher } from "./mesher";
import { Stamper, type StampTarget } from "./stamps";
import { buildTerrain, heightAt } from "./terrain";
import { applyHeightFog } from "./fog";
import { animUniforms, GrassLayer } from "./grass";
import { buildWater } from "./water";
import { PixelDitherPass } from "./postfx";
import { Lighting } from "./lighting";
import { buildClouds } from "./clouds";
import {
    ModelRenderer,
    type ModelCell,
    type ObjectState,
    type PlaceOptions,
} from "./models";
import type { VoxelModel, Rot as ModelRot } from "../models/format";
import { FrameGovernor } from "./governor";

export { heightAt, Stamper, VoxelGrid, TERRAIN_CELL, OBJECT_CELL };
export { QUALITY_PRESETS } from "./config";
export type { QualityPreset } from "./config";

export interface VoxelIslandOptions {
    /** Seed for grass placement and the terrain jitter. */
    seed?: number;
    /** A fixed quality level index into QUALITY_PRESETS, or "auto" to let the governor pick. */
    quality?: number | "auto";
    /** Quantise to dither levels. Off gives the readable, un-dithered pixel look. */
    dither?: boolean;
    /** Pixel size of the scene target in CSS pixels. Defaults to the preset. */
    pixelSize?: number;
    /** Time of day in 0..1, where 0.5 is dusk. */
    timeOfDay?: number;
    /** Advance the day-night cycle, one full day per DAY_LENGTH_SEC. */
    cycle?: boolean;
    /** Low-fx: stops wind, waves and the cycle, and lamp shimmer. */
    lowFx?: boolean;
    /** Frame budget in ms for the governor. 16.7 is 60 fps. */
    budgetMs?: number;
    /** Blades per grass site before the quality density is applied. */
    bladesPerSite?: number;
    /**
     * Built-in orbit camera with the top-down tween. Default true. Pass false when an input module owns
     * the camera: the renderer then never moves it, and the caller sets position, target and fov. The
     * renderer still sets the aspect ratio on resize.
     */
    orbit?: boolean;
}

export interface IslandStats {
    fps: number;
    frameMs: number;
    p95Ms: number;
    quality: number;
    qualityName: string;
    grassDrawn: number;
    grassTotal: number;
    chunks: number;
    pendingRebuilds: number;
    drawCalls: number;
    triangles: number;
}

export interface VoxelIsland {
    /** Stamp object voxels (machines, props). Chunks mesh before this returns. Not removable. */
    stamp(build: (s: Stamper) => void): void;
    /**
     * Add object voxels under a stable id, so they can be removed later. Objects should not overlap;
     * removing one clears every cell it wrote, including cells another object also wrote.
     */
    addObject(id: string, build: (s: Stamper) => void): void;
    /** Glow voxels under a stable id (unlit mesh). See addObject. */
    addGlow(id: string, build: (s: Stamper) => void): void;
    /** Removes the object or glow voxels added under `id`. Unknown ids are ignored. */
    removeObject(id: string): void;
    /** Removes every voxel added with addObject, addGlow or the legacy stamp calls. */
    clearObjects(): void;
    /**
     * Places an animated voxel model under a stable id. It is removed by removeObject and clearObjects.
     * Its footprint sits on opts.cell, one world unit per board cell.
     */
    placeModel(id: string, model: VoxelModel, opts: PlaceOptions): void;
    /** Drives a placed model: working flag, its own clock in seconds, and charge 0..1. Unknown ids are ignored. */
    setObjectState(id: string, state: ObjectState): void;
    /** Shows a translucent placement preview. Green when valid, red when not. */
    setGhost(
        model: VoxelModel,
        cell: ModelCell,
        rot: ModelRot,
        valid: boolean
    ): void;
    /** Hides the placement preview. */
    clearGhost(): void;
    setDither(on: boolean): void;
    setPixelSize(px: number): void;
    setQuality(level: number | "auto"): void;
    setLowFx(on: boolean): void;
    /** Wind strength 0..1 from the simulation. 0.5 is the approved baseline sway; grass reads it. */
    setWind(strength: number): void;
    setTimeOfDay(t: number): void;
    /** Orbit camera. `on` tweens to a straight-down view, `off` returns to the default angle. */
    setTopDown(on: boolean): void;
    resize(): void;
    start(): void;
    stop(): void;
    /** Renders one frame now and returns it as a PNG data URL. */
    snapshot(): string;
    stats(): IslandStats;
    /** Stamp unlit glow voxels (furnace windows). Drawn as a separate flat mesh at 0xffd070. */
    stampGlow(build: (s: Stamper) => void): void;
    readonly camera: THREE.PerspectiveCamera;
    /** The built-in orbit controls, or null when `orbit: false`. */
    readonly controls: OrbitControls | null;
    dispose(): void;
}

const DEFAULT_CAMERA = new THREE.Vector3(-9.5, 10.5, 14.5);
const DEFAULT_TARGET = new THREE.Vector3(0.6, 0.2, 0.2);
const TOP_CAMERA = new THREE.Vector3(0.6, 30, 0.2 + 0.01);

export function createVoxelIsland(
    canvas: HTMLCanvasElement,
    options: VoxelIslandOptions = {}
): VoxelIsland {
    const isCoarse =
        typeof window !== "undefined" &&
        window.matchMedia?.("(pointer: coarse)").matches;
    const seed = options.seed ?? 7;
    const bladesPerSite = options.bladesPerSite ?? 2;

    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        powerPreference: "high-performance",
    });
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 900);
    camera.position.copy(DEFAULT_CAMERA);
    camera.lookAt(DEFAULT_TARGET);

    // One material for every voxel chunk; fog and per-vertex colour come from the mesher.
    const blockMaterial = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.85,
        metalness: 0.05,
    });
    applyHeightFog(blockMaterial, "voxel-blocks");

    const blocks = new BlockRegistry(BLOCK_ID_BASE);
    const terrainGrid = new VoxelGrid(TERRAIN_CELL);
    const objectGrid = new VoxelGrid(OBJECT_CELL);
    const terrainMesher = new ChunkMesher(terrainGrid, blocks, blockMaterial);
    const objectMesher = new ChunkMesher(objectGrid, blocks, blockMaterial);
    const models = new ModelRenderer(scene, heightAt);
    scene.add(terrainMesher.group, objectMesher.group);

    const { grassSites } = buildTerrain(terrainGrid, blocks);
    terrainMesher.update();

    const grass = new GrassLayer(grassSites, bladesPerSite, seed);
    scene.add(grass.mesh);
    const water = buildWater();
    scene.add(water);

    const glowGrid = new VoxelGrid(OBJECT_CELL);
    const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xffd070 });
    const glowMesher = new ChunkMesher(glowGrid, blocks, glowMaterial);
    scene.add(glowMesher.group);

    const clouds = buildClouds(blocks, seed);
    scene.add(clouds.group);

    const lighting = new Lighting(scene, 2048);
    lighting.setTime(options.timeOfDay ?? 0.5);

    const initialPreset = Math.min(QUALITY_PRESETS.length - 1, 1);
    let level =
        typeof options.quality === "number"
            ? clampLevel(options.quality)
            : initialPreset;
    const pixelOverride = options.pixelSize;
    const post = new PixelDitherPass(
        renderer,
        pixelOverride ?? QUALITY_PRESETS[level].pixelSize
    );
    post.setDither(options.dither ?? true);

    const governor = new FrameGovernor(
        options.budgetMs ?? 16.7,
        level,
        0,
        QUALITY_PRESETS.length - 1
    );
    let auto = options.quality === undefined || options.quality === "auto";
    if (auto) level = isCoarse ? 0 : 2;
    governor.level = level;

    let lowFx = options.lowFx ?? false;
    let windStrength = 0.5;
    let cycle = options.cycle ?? true;
    let cycleT = options.timeOfDay ?? 0.5;
    let elapsed = 0;

    const orbit = options.orbit ?? true;
    const controls: OrbitControls | null = orbit
        ? new OrbitControls(camera, canvas)
        : null;
    if (controls) {
        controls.target.copy(DEFAULT_TARGET);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.minDistance = 6;
        controls.maxDistance = 60;
        controls.maxPolarAngle = Math.PI * 0.47;
        controls.update();
    }

    // Object voxels keyed by id, so removeObject can clear exactly what an object wrote.
    const objectCells = new Map<
        string,
        { solid: [number, number, number][]; glow: [number, number, number][] }
    >();
    let anonCount = 0;
    const recordFor = (id: string) => {
        let rec = objectCells.get(id);
        if (!rec) {
            rec = { solid: [], glow: [] };
            objectCells.set(id, rec);
        }
        return rec;
    };
    const recorder = (
        grid: VoxelGrid,
        sink: [number, number, number][]
    ): StampTarget => ({
        cell: grid.cell,
        set(i, j, k, id) {
            sink.push([i, j, k]);
            grid.set(i, j, k, id);
        },
    });

    // Top-down tween state.
    let topDown = false;
    let tweening = false;

    function applyLevel(next: number): void {
        level = clampLevel(next);
        const preset = QUALITY_PRESETS[level];
        grass.setDensity(preset.grassDensity);
        lighting.setShadows(preset.shadows);
        post.resize(
            canvas.width,
            canvas.height,
            pixelOverride ?? preset.pixelSize
        );
    }

    function clampLevel(n: number): number {
        return Math.max(0, Math.min(QUALITY_PRESETS.length - 1, Math.round(n)));
    }

    function resize(): void {
        const w = Math.max(
            1,
            Math.floor(canvas.clientWidth || window.innerWidth)
        );
        const h = Math.max(
            1,
            Math.floor(canvas.clientHeight || window.innerHeight)
        );
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        post.resize(w, h, pixelOverride ?? QUALITY_PRESETS[level].pixelSize);
    }

    applyLevel(level);
    resize();

    // Frame timing for stats.
    const ring: number[] = [];
    let lastNow = 0;
    let frameMsLast = 16.7;
    let drawCalls = 0;
    let triangles = 0;
    let rafId = 0;
    let running = false;

    function renderFrame(dt: number): void {
        if (!lowFx) {
            elapsed += dt;
            if (cycle) cycleT += dt / DAY_LENGTH_SEC;
        }
        animUniforms.uTime.value = elapsed;
        animUniforms.uWind.value = lowFx ? 0 : windStrength / 0.5;
        animUniforms.uWave.value = lowFx ? 0 : 1;
        if (cycle) lighting.setTime(cycleT, !lowFx);
        lighting.sky.follow(camera.position);
        clouds.update();

        if (controls) {
            if (tweening) {
                const k = 1 - Math.exp(-dt * 6);
                const goalPos = topDown ? TOP_CAMERA : DEFAULT_CAMERA;
                const goalTarget = DEFAULT_TARGET;
                camera.position.lerp(goalPos, k);
                controls.target.lerp(
                    topDown ? new THREE.Vector3(0.6, 0, 0.2) : goalTarget,
                    k
                );
                if (camera.position.distanceTo(goalPos) < 0.02)
                    tweening = false;
            }
            controls.update();
        }

        const preset = QUALITY_PRESETS[level];
        terrainMesher.update(preset.rebuildsPerFrame);
        objectMesher.update(preset.rebuildsPerFrame);

        models.update();
        post.render(scene, camera);
        const info = renderer.info.render;
        drawCalls = info.calls;
        triangles = info.triangles;
    }

    function tick(now: number): void {
        if (!running) return;
        rafId = requestAnimationFrame(tick);
        const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 1 / 60;
        frameMsLast = lastNow ? now - lastNow : 16.7;
        lastNow = now;
        ring.push(frameMsLast);
        if (ring.length > 240) ring.shift();
        renderFrame(dt);
        if (auto) {
            const next = governor.observe(frameMsLast);
            if (next !== null) applyLevel(next);
        }
    }

    return {
        camera,
        controls,
        stamp(build) {
            this.addObject(`anon-${anonCount++}`, build);
        },
        addObject(id, build) {
            build(
                new Stamper(recorder(objectGrid, recordFor(id).solid), blocks)
            );
            objectMesher.update();
        },
        addGlow(id, build) {
            build(new Stamper(recorder(glowGrid, recordFor(id).glow), blocks));
            glowMesher.update();
        },
        removeObject(id) {
            const rec = objectCells.get(id);
            if (!rec) return;
            for (const [i, j, k] of rec.solid) objectGrid.set(i, j, k, 0);
            for (const [i, j, k] of rec.glow) glowGrid.set(i, j, k, 0);
            objectCells.delete(id);
            models.remove(id);
            objectMesher.update();
            glowMesher.update();
        },
        clearObjects() {
            for (const id of [...objectCells.keys()]) this.removeObject(id);
            models.clear();
        },
        placeModel(id, model, opts) {
            models.place(id, model, opts);
        },
        setObjectState(id, state) {
            models.setState(id, state);
        },
        setGhost(model, cell, rot, valid) {
            models.setGhost(model, cell, rot, valid);
        },
        clearGhost() {
            models.clearGhost();
        },
        setDither(on) {
            post.setDither(on);
        },
        setPixelSize(px) {
            post.resize(canvas.width, canvas.height, px);
        },
        setQuality(next) {
            auto = next === "auto";
            if (next !== "auto") applyLevel(next);
        },
        setWind(strength) {
            windStrength = Math.min(1, Math.max(0, strength));
        },
        setLowFx(on) {
            lowFx = on;
            lighting.setShadows(!on && QUALITY_PRESETS[level].shadows);
        },
        setTimeOfDay(t) {
            cycleT = t;
            lighting.setTime(t, !lowFx);
        },
        setTopDown(on) {
            // Only the built-in orbit camera tweens. With orbit: false the input module owns the view.
            if (!controls) return;
            topDown = on;
            tweening = true;
        },
        resize,
        start() {
            if (running) return;
            running = true;
            lastNow = 0;
            rafId = requestAnimationFrame(tick);
        },
        stampGlow(build) {
            this.addGlow(`anon-${anonCount++}`, build);
        },
        stop() {
            running = false;
            cancelAnimationFrame(rafId);
        },
        snapshot() {
            renderFrame(0);
            return canvas.toDataURL("image/png");
        },
        stats() {
            const sorted = [...ring].sort((a, b) => a - b);
            const avg =
                ring.reduce((a, b) => a + b, 0) / Math.max(1, ring.length);
            const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
            return {
                fps: avg ? 1000 / avg : 0,
                frameMs: avg,
                p95Ms: p95,
                quality: level,
                qualityName: QUALITY_PRESETS[level].name,
                grassDrawn: grass.mesh.count,
                grassTotal: grass.total,
                chunks: terrainMesher.chunkCount + objectMesher.chunkCount,
                pendingRebuilds: terrainGrid.dirty.size + objectGrid.dirty.size,
                drawCalls,
                triangles,
            };
        },
        dispose() {
            this.stop();
            controls?.dispose();
            terrainMesher.dispose();
            objectMesher.dispose();
            glowMesher.dispose();
            glowMaterial.dispose();
            models.dispose();
            clouds.dispose();
            grass.dispose();
            water.geometry.dispose();
            (water.material as THREE.Material).dispose();
            blockMaterial.dispose();
            lighting.dispose();
            post.dispose();
            renderer.dispose();
        },
    };
}
