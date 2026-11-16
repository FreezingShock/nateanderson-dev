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
import { buildHorizon } from "./horizon";
import type { WaterPaletteName } from "./config";
import type { Placement } from "../models/props";
import { Scenery } from "./scenery";
import {
    ModelRenderer,
    type ModelCell,
    type ObjectState,
    type PlaceOptions,
} from "./models";
import type { VoxelModel, Rot as ModelRot } from "../models/format";
import {
    createBeltKit,
    type BeltKit,
    type PiecePlacement,
} from "../models/belts";
import type { Matrix4 } from "three";
import { FrameGovernor } from "./governor";
import { MachineEffects, type BurstKind } from "./effects";
import { SelectionOutline, type HighlightCell } from "./highlight";
import { GhostPath, type PathCell } from "./ghostpath";
import { PortArrows, type PortArrow } from "./portarrows";

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
    /**
     * Replaces all scenery. Each placement is a props catalog id with a free position, rotY and scale.
     * Drawn instanced with LOD past LOD_DISTANCE and wind sway.
     */
    setScenery(placements: readonly Placement[]): void;
    /** 0..1 share of placements to keep (low fx uses 0.5). Keeps the same subset as it drops. */
    setSceneryDensity(d: number): void;
    /** Places belt pieces (cells in the board frame). Replaces every belt piece. */
    setBelts(list: readonly PiecePlacement[]): void;
    /** Cells per second for a belt tier (0 stops it). Tiers are brass 0, copper 1, steel 2. */
    setBeltSpeed(tier: number, cellsPerSecond: number): void;
    /** Outlines board cells in brass, for a selected belt run or building. Empty clears it. Same frame as setBelts. */
    setHighlight(cells: readonly HighlightCell[]): void;
    /** Sets the ghost's validity tint: brass when valid, red when refused. */
    setGhostValidity(valid: boolean): void;
    /**
     * Draws a belt stroke ghost in path order: plates, arrows, corners and end caps. Refused cells
     * (valid: false) use the red treatment. Pass an empty list to clear. Hide the single-building
     * ghost (clearGhost) while a stroke is shown.
     */
    setGhostPath(cells: readonly PathCell[]): void;
    /** Input (green) and output (brass) arrows in the tiles beside a machine. Empty clears them. */
    setPortArrows(arrows: readonly PortArrow[]): void;
    /**
     * One-shot effect on a board cell: "place" for a placement pop, "remove" for a removal puff,
     * "milestone" for the hub's gold fountain. Off for low fx. Board frame, like setBelts.
     */
    burst(cell: { x: number; z: number }, kind: BurstKind): void;
    /** Matrix for an item riding a belt piece. `t` is 0..1 over the cell. */
    beltItemMatrix(
        p: PiecePlacement,
        t: number,
        out: Matrix4,
        path?: number
    ): Matrix4;
    setDither(on: boolean): void;
    setPixelSize(px: number): void;
    setQuality(level: number | "auto"): void;
    setLowFx(on: boolean): void;
    /** Sea colours: "verdigris" (default, olive-bronze), "lagoon", or "spec" (the original reference blue). */
    setWaterPalette(name: WaterPaletteName): void;
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
    /** The scene, for add-on layers such as island life (render/life). */
    readonly scene: THREE.Scene;
    /** Runs `fn` every rendered frame after the world animates. Returns an unsubscribe. */
    onFrame(fn: FrameHook): () => void;
    /** The built-in orbit controls, or null when `orbit: false`. */
    readonly controls: OrbitControls | null;
    dispose(): void;
}

export type FrameHook = (
    dt: number,
    info: { time: number; timeOfDay: number; wind: number; lowFx: boolean }
) => void;

/** Machines that puff smoke while working, and the ones that also throw sparks. */
const SMOKING_MODELS = /furnace|kiln|smelter|press|lathe|fabricator|assembler/;
const SPARKING_MODELS = /furnace|smelter|press|fabricator/;
/** Ghost and selection tints. Brass glows when valid; red flares when refused. */
const GHOST_VALID_TINT = 0xffd27a;
const GHOST_VALID_HOT = 0xfff2c0;
const GHOST_REFUSED_TINT = 0xff4a3a;
const GHOST_REFUSED_HOT = 0xff9a80;

/** Smoke starts just above the model's top, in world units. */
function chimneyHeight(model: VoxelModel): number {
    const h = model.size?.[1] ?? 10;
    return h * model.voxel + 0.05;
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
    renderer.info.autoReset = false;
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
    // Terrain is flat ground: no per-voxel jitter, so the base tone reads as one surface.
    const terrainMesher = new ChunkMesher(terrainGrid, blocks, blockMaterial, 0);
    const objectMesher = new ChunkMesher(objectGrid, blocks, blockMaterial);
    const models = new ModelRenderer(scene, heightAt);
    const scenery = new Scenery(scene);
    const effects = new MachineEffects(scene);
    const selection = new SelectionOutline(scene);
    // Footprint frame under the placement ghost, tinted by validity.
    const beltGhost = new GhostPath(scene);
    const portArrows = new PortArrows(scene);
    const ghostFrame = new SelectionOutline(scene, {
        color: GHOST_VALID_TINT,
        hot: GHOST_VALID_HOT,
        additive: true,
    });
    // Belt kit, created on first use. Its slats and gears run on the GPU from one phase per tier.
    let belts: BeltKit | null = null;
    const ensureBelts = (): BeltKit => {
        if (!belts) {
            belts = createBeltKit();
            scene.add(belts.object);
        }
        return belts;
    };
    scene.add(terrainMesher.group, objectMesher.group);

    const { grassSites } = buildTerrain(terrainGrid, blocks);
    terrainMesher.update();

    const grass = new GrassLayer(grassSites, bladesPerSite, seed);
    scene.add(grass.mesh);
    const water = buildWater();
    scene.add(water.mesh);

    const glowGrid = new VoxelGrid(OBJECT_CELL);
    const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xffd070 });
    const glowMesher = new ChunkMesher(glowGrid, blocks, glowMaterial);
    scene.add(glowMesher.group);

    const clouds = buildClouds(blocks, seed);
    scene.add(clouds.group);
    const horizon = buildHorizon(blocks, seed);
    scene.add(horizon.group);
    const glintDir = new THREE.Vector3();
    const glintCol = new THREE.Color();
    const GLINT_SUN = new THREE.Color(0xffd08a);
    const GLINT_MOON = new THREE.Color(0x9a937e);

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
    const frameHooks = new Set<FrameHook>();

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
        effects.setDensity(preset.grassDensity);
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

    function setGhostTint(valid: boolean): void {
        ghostFrame.setColor(
            valid ? GHOST_VALID_TINT : GHOST_REFUSED_TINT,
            valid ? GHOST_VALID_HOT : GHOST_REFUSED_HOT
        );
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
        effects.setWind(windStrength);
        effects.update(dt);
        selection.update(dt);
        ghostFrame.update(dt);
        beltGhost.update(dt);
        portArrows.update(dt);
        animUniforms.uWind.value = lowFx ? 0 : windStrength / 0.5;
        animUniforms.uWave.value = lowFx ? 0 : 1;
        // Belts keep moving under low fx: one uniform per tier, so it costs nothing.
        belts?.update(dt);
        if (cycle) lighting.setTime(cycleT, !lowFx);
        lighting.sky.follow(camera.position);
        lighting.sky.tick(elapsed, !lowFx);
        horizon.update(elapsed, lighting.night, !lowFx);
        // Water glints follow the sun by day and the moon at night.
        const night = lighting.night;
        glintDir.copy(night > 0.5 ? lighting.moonDir : lighting.sunDir);
        glintCol.copy(GLINT_SUN).lerp(GLINT_MOON, Math.min(1, night * 1.4));
        water.update(1 - night * 0.62, glintDir, glintCol);
        clouds.setNight(night);
        clouds.update();
        if (frameHooks.size) {
            const info = { time: elapsed, timeOfDay: cycleT, wind: windStrength, lowFx };
            for (const fn of frameHooks) fn(dt, info);
        }

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

        models.update(dt);
        scenery.update(camera.position);
        // The post pass renders more than once per frame, so count across all of it, then reset.
        renderer.info.reset();
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
        scene,
        onFrame(fn) {
            frameHooks.add(fn);
            return () => frameHooks.delete(fn);
        },
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
            // Placed models (placeModel) never write voxels, so they have no record here. Drop the model and its
            // emitter first, whether or not voxels were recorded, or a removed building's model stays on the island.
            models.remove(id);
            effects.removeEmitter(id);
            const rec = objectCells.get(id);
            if (!rec) return;
            for (const [i, j, k] of rec.solid) objectGrid.set(i, j, k, 0);
            for (const [i, j, k] of rec.glow) glowGrid.set(i, j, k, 0);
            objectCells.delete(id);
            objectMesher.update();
            glowMesher.update();
        },
        clearObjects() {
            for (const id of [...objectCells.keys()]) this.removeObject(id);
            models.clear();
            effects.clearEmitters();
        },
        placeModel(id, model, opts) {
            models.place(id, model, opts);
            // Chimney point: top middle of the footprint. Smoke only for the smelting and forming machines.
            const fw = model.footprint?.w ?? 1;
            const fd = model.footprint?.d ?? 1;
            if (SMOKING_MODELS.test(model.id)) {
                effects.setEmitter(
                    id,
                    opts.cell.x + fw / 2,
                    heightAt(opts.cell.x + 0.5, opts.cell.z + 0.5) + chimneyHeight(model),
                    opts.cell.z + fd / 2,
                    SPARKING_MODELS.test(model.id),
                    false
                );
            } else {
                // Every other machine breathes a little white steam while it works, so the island reads busy at default zoom.
                effects.setEmitter(
                    id,
                    opts.cell.x + fw / 2,
                    heightAt(opts.cell.x + 0.5, opts.cell.z + 0.5) + chimneyHeight(model),
                    opts.cell.z + fd / 2,
                    false,
                    true
                );
            }
        },
        setObjectState(id, state) {
            models.setState(id, state);
            if (state.working !== undefined) effects.setWorking(id, state.working);
        },
        setGhost(model, cell, rot, valid) {
            models.setGhost(model, cell, rot, valid);
            // Footprint cells, turned with the building's rotation (odd turns swap width and depth).
            const w = model.footprint?.w ?? 1;
            const d = model.footprint?.d ?? 1;
            const [fw, fd] = rot % 2 ? [d, w] : [w, d];
            const cells: HighlightCell[] = [];
            for (let i = 0; i < fw; i++)
                for (let j = 0; j < fd; j++)
                    cells.push({ x: cell.x + i, z: cell.z + j });
            ghostFrame.setCells(cells, heightAt);
            setGhostTint(valid);
        },
        setGhostValidity(valid) {
            setGhostTint(valid);
        },
        setPortArrows(arrows) {
            portArrows.set(arrows, heightAt);
        },
        setGhostPath(cells) {
            beltGhost.set(cells, heightAt);
        },
        burst(cell, kind) {
            const x = cell.x + 0.5;
            const z = cell.z + 0.5;
            effects.burst(x, heightAt(x, z) + 0.15, z, kind);
        },
        setScenery(placements: readonly Placement[]) {
            scenery.setPlacements(placements);
        },
        setSceneryDensity(d) {
            scenery.setDensity(d);
        },
        setBelts(list: readonly PiecePlacement[]) {
            ensureBelts().setPieces(list);
        },
        setHighlight(cells) {
            selection.setCells(cells, heightAt);
        },
        setBeltSpeed(tier, cellsPerSecond) {
            ensureBelts().setSpeed(tier, cellsPerSecond);
        },
        beltItemMatrix(p, t, out: Matrix4, path) {
            return ensureBelts().itemMatrix(p, t, out, path);
        },
        clearGhost() {
            models.clearGhost();
            ghostFrame.setCells([], heightAt);
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
            effects.setEnabled(!on);
            models.setGlowPulse(!on);
            selection.setPulsing(!on);
            ghostFrame.setPulsing(!on);
            beltGhost.setPulsing(!on);
            portArrows.setPulsing(!on);
            lighting.setShadows(!on && QUALITY_PRESETS[level].shadows);
        },
        setWaterPalette(name) {
            water.setPalette(name);
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
            scenery.dispose();
            effects.dispose();
            selection.dispose();
            ghostFrame.dispose();
            beltGhost.dispose();
            portArrows.dispose();
            if (belts) {
                scene.remove(belts.object);
                belts.dispose();
            }
            clouds.dispose();
            horizon.dispose();
            water.dispose();
            grass.dispose();
            blockMaterial.dispose();
            lighting.dispose();
            post.dispose();
            renderer.dispose();
        },
    };
}
