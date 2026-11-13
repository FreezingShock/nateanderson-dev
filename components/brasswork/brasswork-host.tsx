"use client";

// Mounts Brasswork: the simulation (lib/automation/sim), the voxel island renderer (lib/automation/render, loaded
// with a dynamic import so Three.js stays off every other route) and the 2D HUD (components/automation).
// The world is 18 by 12 cells at one world unit per cell, which is the renderer's factory plateau.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AutomationHud } from "@/components/automation/automation-hud";
import {
    DEFAULT_CATALOG,
    actions as simActions,
    advance,
    addDeposit,
    createWorld,
    dayClock,
    deserialize,
    gridView,
    footprintCells,
    hudData,
    resolve,
    SITES,
    serialize,
    windAt,
    type HudData,
    type HudSettings,
    type Rot,
    type World,
} from "@/lib/automation/sim";
import type { HudData as HudViewData } from "@/components/automation/types";
import type { Stamper } from "@/lib/automation/render";
import type { VoxelIsland } from "@/lib/automation/render";
import type { BuildWorld, MountedInput } from "@/lib/automation/input";
import { getMachineModel } from "@/lib/automation/models/machines";
import type { VoxelModel } from "@/lib/automation/models/format";
import { TAG } from "@/lib/automation/models/format";

const W = 18;
const D = 12;
const SAVE_KEY = "brasswork-save-v1";
const CAT = DEFAULT_CATALOG;
const START_SETTINGS: HudSettings = { sound: false, reduceMotion: false, lowFx: false, numberFormat: "short", showRates: true };

// Resource node spots, one per ore in the recipe tree. Placeholder layout until the site design lands.
const NODE_SPOTS: [number, number][] = [[2, 2], [2, 8], [15, 2], [15, 8], [8, 1]];

// Sim cells run 0..W-1, 0..D-1. The renderer and the input module share one frame where the plateau starts at (-9, -6).
const BOARD = { width: W, depth: D, originX: -W / 2, originZ: -D / 2 };

/** Stamps a machine model into the voxel scene, rotated about its footprint. Static: animated parts are not played yet. */
function stampModel(s: Stamper, glow: Stamper, model: VoxelModel, wx: number, wz: number, rot: number, fw: number, fd: number) {
    const Wv = fw * 10;
    const Dv = fd * 10;
    for (const part of model.parts) {
        if (part.when && !part.when.includes("always")) continue;
        const n = part.colors.length;
        for (let i = 0; i < n; i++) {
            const x = part.pos[i * 3] + part.pivot[0];
            const y = part.pos[i * 3 + 1] + part.pivot[1];
            const z = part.pos[i * 3 + 2] + part.pivot[2];
            const [rx, rz] = rot === 1 ? [z, Wv - 1 - x] : rot === 2 ? [Wv - 1 - x, Dv - 1 - z] : rot === 3 ? [Dv - 1 - z, x] : [x, z];
            const target = part.tags && part.tags[i] === TAG.GLOW ? glow : s;
            target.box(wx + rx * 0.1 + 0.05, y * 0.1, wz + rz * 0.1 + 0.05, 0.1, 0.1, 0.1, model.palette[part.colors[i]]);
        }
    }
}

const TYPE_COLORS: Record<string, number> = { hub: 0xc59a52, drill: 0x7f8ca3, power: 0xc4682f };
const ORE_COLORS: Record<string, number> = { iron_ore: 0x8e3b28, copper_ore: 0x58b09a, coal: 0x25252b, quartz: 0xf2cfe0, aluminium_ore: 0x98b2d4 };

function freshWorld(): World {
    const w = createWorld({ width: W, depth: D, hub: { x: 8, z: 5 } }, CAT);
    CAT.tree.nodes.forEach((n, i) => {
        const s = NODE_SPOTS[i];
        if (s) addDeposit(w, s[0], s[1], n.item, 1);
    });
    return w;
}

// The HUD's research screen shows one unlock line per node; the sim returns a list of names.
function forHud(d: HudData): HudViewData {
    const sites = SITES.filter((x) => d.prestige.sites.includes(x.name)).map((x) => ({
        id: x.id,
        name: x.name,
        floor: `${x.width} by ${x.depth} floor`,
        ore: `${x.nodes.length} resource nodes`,
        bonus: `x${x.bonus.miner} mining, x${x.bonus.power} power`,
    }));
    return { ...d, research: d.research.map((n) => ({ ...n, unlocks: n.unlocks.join(", ") })), prestige: { ...d.prestige, sites } };
}

function loadWorld(): { world: World; savedAt: number } {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) {
            const { text, savedAt } = JSON.parse(raw) as { text: string; savedAt: number };
            return { world: deserialize(text), savedAt };
        }
    } catch {
        /* a bad save falls through to a fresh world */
    }
    return { world: freshWorld(), savedAt: Date.now() };
}

export function BrassworkHost() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [data, setData] = useState<HudViewData>(() => {
        const w = freshWorld();
        return forHud(hudData(w, CAT, null, START_SETTINGS));
    });
    const [note, setNote] = useState("");
    const ctl = useRef<{
        setTool: (id: string | null) => void;
        select: (id: string | null) => void;
        research: (id: string) => void;
        prestige: (id: string) => void;
        settings: (p: Partial<HudSettings>) => void;
    } | null>(null);

    useEffect(() => {
        let dead = false;
        let cleanup = () => {};
        (async () => {
            const [{ createVoxelIsland, heightAt }, { mount }] = await Promise.all([import("@/lib/automation/render"), import("@/lib/automation/input")]);
            const canvas = canvasRef.current;
            if (dead || !canvas) return;
            const { world, savedAt } = loadWorld();
            let settings = { ...START_SETTINGS };
            let selectedId: number | null = null;
            const drawn = new Set<number>();

            const island: VoxelIsland = createVoxelIsland(canvas, { quality: "auto", dither: true, timeOfDay: 0.4, cycle: false, orbit: false });
            const center = (x: number, z: number, w: number, d: number): [number, number] => [x + w / 2 - W / 2, z + d / 2 - D / 2];

            // Keep the scene in step with the world: draw new buildings, remove the ones that are gone.
            const syncScene = () => {
                for (const id of [...drawn]) {
                    if (!world.buildings[id]) {
                        island.removeObject(`b${id}`);
                        island.removeObject(`g${id}`);
                        drawn.delete(id);
                    }
                }
                for (const b of Object.values(world.buildings)) {
                    if (drawn.has(b.id)) continue;
                    drawn.add(b.id);
                    const r = resolve(CAT, b.type);
                    if (!r) continue;
                    const cells = footprintCells(b, r.footprint);
                    const minX = Math.min(...cells.map((c) => c[0]));
                    const minZ = Math.min(...cells.map((c) => c[1]));
                    const bw = Math.max(...cells.map((c) => c[0])) - minX + 1;
                    const bd = Math.max(...cells.map((c) => c[1])) - minZ + 1;
                    const model = getMachineModel(b.type);
                    if (model) {
                        const fp = model.footprint ?? { w: bw, d: bd };
                        const swap = b.rot === 1 || b.rot === 3;
                        const mw = swap ? fp.d : fp.w;
                        const md = swap ? fp.w : fp.d;
                        // A model bigger than its sim footprint (the hub) is centred on it.
                        const ox = minX - W / 2 + (bw - mw) / 2;
                        const oz = minZ - D / 2 + (bd - md) / 2;
                        island.addObject(`b${b.id}`, (s) => island.addGlow(`g${b.id}`, (g) => stampModel(s, g, model, ox, oz, b.rot, fp.w, fp.d)));
                    } else {
                        const [cx, cz] = center(minX, minZ, bw, bd);
                        const color = TYPE_COLORS[b.type] ?? (r.kind === "generator" ? TYPE_COLORS.power : 0x9aa4b8);
                        island.addObject(`b${b.id}`, (s) => s.box(cx, 0, cz, bw * 0.9, 0.3, bd * 0.9, color));
                    }
                }
            };
            island.addObject("deposits", (s) => {
                for (const [key, dep] of Object.entries(world.deposits)) {
                    const [x, z] = key.split(",").map(Number);
                    const [cx, cz] = center(x, z, 1, 1);
                    s.box(cx, 0, cz, 0.8, 0.25, 0.8, ORE_COLORS[dep.item] ?? 0x888888);
                }
            });
            syncScene();

            // Away time: catch up the simulation for the time the tab was closed (capped by the catalog).
            const away = Math.max(0, (Date.now() - savedAt) / 1000);
            if (away > 5) advance(world, Math.min(away, CAT.tune.maxAwaySeconds), 1, CAT);

            const refresh = () => setData(forHud(hudData(world, CAT, selectedId, settings)));
            const save = () => {
                try {
                    localStorage.setItem(SAVE_KEY, JSON.stringify({ text: serialize(world), savedAt: Date.now() }));
                } catch {
                    /* private mode or full storage: play without saving */
                }
            };

            // The input module owns the camera and placement. It talks to the sim through this adapter, in the shared
            // frame where the plateau starts at (-9, -6), so cells are shifted into the sim's 0..W-1 range.
            const grid = gridView(world, CAT);
            const ox = W / 2;
            const oz = D / 2;
            const buildWorld: BuildWorld = {
                get: (x, z) => grid.get(x + ox, z + oz),
                set: (x, z, item) => {
                    const r = grid.set(x + ox, z + oz, item);
                    if (!r.ok) setNote(r.reason);
                },
                check: (kind, x, z, rot) => grid.check(kind, x + ox, z + oz, rot),
            };
            const tools = [...CAT.tree.machines.map((m) => m.id), "power-plant"].map((id) => ({ id, label: resolve(CAT, id)?.name ?? id, line: false }));
            const input: MountedInput = mount(island.camera, canvas, {
                board: BOARD,
                world: buildWorld,
                tools,
                heightAt,
                initialPose: { target: { x: 0, y: 0, z: 0 }, yaw: 0.6, pitch: 0.75, distance: 18 },
                limits: { bounds: { minX: -14, maxX: 14, minZ: -10, maxZ: 10 }, minDistance: 5, maxDistance: 34, minPitch: 0.35, maxPitch: 1.2, topDownPitch: 1.5, fovY: 0.55, smoothing: 12 },
                onEvent: (e) => {
                    if (e.type === "invalid") setNote(e.reason);
                    else if (e.type === "place" || e.type === "remove") {
                        setNote("");
                        syncScene();
                        refresh();
                    } else syncScene();
                },
            });

            ctl.current = {
                setTool: (id) => {
                    input.controller.setToolById(id);
                    setNote(id ? `Click the floor to place ${resolve(CAT, id)?.name ?? id}. R rotates, Esc cancels.` : "");
                },
                select: (id) => {
                    if (id === null) selectedId = null;
                    else {
                        const asNum = Number(id);
                        const b = Number.isInteger(asNum) && world.buildings[asNum] ? world.buildings[asNum] : Object.values(world.buildings).find((x) => x.type === id);
                        selectedId = b ? b.id : null;
                    }
                    refresh();
                },
                research: (id) => {
                    const r = simActions.buyResearch(world, id, CAT);
                    setNote(r.ok ? "" : r.reason);
                    refresh();
                },
                prestige: (id) => {
                    const r = simActions.prestige(world, id, CAT);
                    if (!r.ok) return setNote(r.reason);
                    save();
                    syncScene();
                    refresh();
                },
                settings: (p) => {
                    settings = { ...settings, ...p };
                    island.setLowFx(settings.lowFx || settings.reduceMotion);
                    refresh();
                },
            };

            const onResize = () => island.resize();
            window.addEventListener("resize", onResize);

            // Simulation clock: fixed steps from real time, paused while the tab is hidden. Same loop moves the camera.
            let last = performance.now();
            let sinceHud = 0;
            let sinceSave = 0;
            let raf = 0;
            const frame = () => {
                const now = performance.now();
                const dt = Math.min(1, (now - last) / 1000);
                last = now;
                input.update(dt);
                if (!document.hidden) {
                    advance(world, dt, 0.1, CAT);
                    island.setWind(world.wind ?? windAt(world.time));
                    island.setTimeOfDay(dayClock(world, CAT).phase);
                    sinceHud += dt;
                    sinceSave += dt;
                    if (sinceHud >= 0.25) {
                        sinceHud = 0;
                        refresh();
                    }
                    if (sinceSave >= 10) {
                        sinceSave = 0;
                        save();
                    }
                }
                raf = requestAnimationFrame(frame);
            };
            raf = requestAnimationFrame(frame);

            island.resize();
            island.start();
            refresh();
            cleanup = () => {
                cancelAnimationFrame(raf);
                save();
                input.destroy();
                window.removeEventListener("resize", onResize);
                island.dispose();
                ctl.current = null;
            };
        })();
        return () => {
            dead = true;
            cleanup();
        };
    }, []);

    const onBuild = useCallback((id: string) => ctl.current?.setTool(id), []);
    const onSelect = useCallback((id: string | null) => ctl.current?.select(id), []);
    const onResearch = useCallback((id: string) => ctl.current?.research(id), []);
    const onPrestige = useCallback((id: string) => ctl.current?.prestige(id), []);
    const onSettings = useCallback((p: Partial<HudSettings>) => ctl.current?.settings(p), []);

    return (
        <div className="bw-root">
            <AutomationHud data={data} actions={{ onBuild, onSelect, onResearch, onPrestige, onSettings }}>
                <canvas ref={canvasRef} className="bw-canvas" />
                <Link href="/creations/games" className="bw-back">
                    Back to Games
                </Link>
                {note && <p className="bw-note">{note}</p>}
            </AutomationHud>
        </div>
    );
}
