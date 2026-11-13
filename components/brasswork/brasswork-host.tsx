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
    buildingAt,
    chargeOf,
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
import type { VoxelIsland } from "@/lib/automation/render";
import type { BuildWorld, MountedInput } from "@/lib/automation/input";
import { getMachineModel } from "@/lib/automation/models/machines";
import { pickBeltTile, type PieceKind, type PiecePlacement } from "@/lib/automation/models/belts";
import { WATER_LEVEL } from "@/lib/automation/render/config";
import { scatterProps } from "@/lib/automation/models/props";
import { BrassworkExtras, type AwayReport, type Mood } from "./extras";
import { bw, bwHum, bwSetEnabled } from "@/lib/brasswork/sound";

const W = 18;
const D = 12;
const SAVE_KEY = "brasswork-save-v1";
const CAT = DEFAULT_CATALOG;
const START_SETTINGS: HudSettings = { sound: true, reduceMotion: false, lowFx: false, numberFormat: "short", showRates: true };

// Resource node spots, one per ore in the recipe tree. Placeholder layout until the site design lands.
const NODE_SPOTS: [number, number][] = [[2, 2], [2, 8], [15, 2], [15, 8], [8, 1]];

// Sim cells run 0..W-1, 0..D-1. The renderer and the input module share one frame where the plateau starts at (-9, -6).
const BOARD = { width: W, depth: D, originX: -W / 2, originZ: -D / 2 };

const BELT_TIER: Record<string, number> = { belt: 0, "belt-copper": 1, "belt-steel": 2 };
const FACE: readonly (readonly [number, number])[] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

/** Which belt tile a plain sim belt cell should show, from what feeds it and what it feeds. */
function beltTile(world: World, b: { x: number; z: number; rot: number; type: string }): PiecePlacement["kind"] {
    const at = (x: number, z: number) => buildingAt(world, x, z, CAT);
    const isBelt = (t?: string) => !!t && t in BELT_TIER;
    const [fx, fz] = FACE[b.rot];
    const [lx, lz] = FACE[(b.rot + 3) % 4];
    const [rx, rz] = FACE[(b.rot + 1) % 4];
    const back = at(b.x - fx, b.z - fz);
    const left = at(b.x + lx, b.z + lz);
    const right = at(b.x + rx, b.z + rz);
    const front = at(b.x + fx, b.z + fz);
    const feeds = (n: ReturnType<typeof at>, dx: number, dz: number) => !!n && isBelt(n.type) && FACE[n.rot][0] === dx && FACE[n.rot][1] === dz;
    const kind: PieceKind = pickBeltTile({
        back: feeds(back, fx, fz),
        left: feeds(left, -lx, -lz),
        right: feeds(right, -rx, -rz),
        front: !!front,
        frontIsMachine: !!front && !isBelt(front.type),
        backIsMachine: !!back && !isBelt(back.type) && back.type !== "hub",
    });
    return kind;
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
    const [data, setData] = useState<HudData>(() => hudData(freshWorld(), CAT, null, START_SETTINGS));
    const [note, setNote] = useState("");
    const [away, setAway] = useState<AwayReport | null>(null);
    const [mood, setMood] = useState<Mood>("Auto");
    const moodRef = useRef<Mood>("Auto");
    const onMood = useCallback((m: Mood) => {
        moodRef.current = m;
        setMood(m);
    }, []);
    const snap = useRef<(() => string) | null>(null);
    const snapshot = useCallback(() => snap.current?.() ?? null, []);
    const ctl = useRef<{
        setTool: (id: string | null) => void;
        select: (id: string | null) => void;
        research: (id: string) => void;
        setRecipe: (id: string) => void;
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
            [1.2, 2, 3].forEach((v, tier) => island.setBeltSpeed(tier, v));
            // Natural scenery around the plateau; nothing grows on it, and trees keep clear of the machines.
            island.setScenery(
                scatterProps({
                    heightAt,
                    isFree: (x, z) => !(Math.abs(x) < 9.6 && Math.abs(z) < 6.6),
                    waterLevel: WATER_LEVEL,
                    minX: -26, maxX: 26, minZ: -20, maxZ: 20,
                    seed: 7,
                    factoryDistance: (x, z) => Math.hypot(Math.max(Math.abs(x) - 9.2, 0), Math.max(Math.abs(z) - 6.2, 0)),
                    clearRadius: 2.5,
                })
            );
            const center = (x: number, z: number, w: number, d: number): [number, number] => [x + w / 2 - W / 2, z + d / 2 - D / 2];

            // Keep the scene in step with the world: draw new buildings, remove the ones that are gone.
            const syncScene = () => {
                for (const id of [...drawn]) {
                    if (!world.buildings[id]) {
                        island.removeObject(`b${id}`);
                        drawn.delete(id);
                    }
                }
                // Belts pick their tile from their neighbours, so a placement or removal can change the cells around it.
                const pieces: PiecePlacement[] = [];
                for (const b of Object.values(world.buildings)) {
                    if (!(b.type in BELT_TIER)) continue;
                    pieces.push({ kind: beltTile(world, b), tier: BELT_TIER[b.type], x: b.x - W / 2, z: b.z - D / 2, rot: b.rot as 0 | 1 | 2 | 3 });
                    drawn.add(b.id);
                }
                island.setBelts(pieces);
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
                        island.placeModel(`b${b.id}`, model, { cell: { x: ox, z: oz }, rot: b.rot });
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
            if (away > 5) {
                const before = new Map(hudData(world, CAT, null, settings).resources.map((r) => [r.id, r.amount]));
                advance(world, Math.min(away, CAT.tune.maxAwaySeconds), 1, CAT);
                const gains = hudData(world, CAT, null, settings)
                    .resources.map((r) => ({ name: r.name, amount: r.amount - (before.get(r.id) ?? 0) }))
                    .filter((g) => g.amount >= 1)
                    .sort((a, b) => b.amount - a.amount)
                    .slice(0, 8);
                if (away >= 120) setAway({ seconds: Math.min(away, CAT.tune.maxAwaySeconds), gains });
            }

            // Sound cues from what changed since the last refresh: a milestone finished, a blueprint bought.
            const doneMilestones = new Set<string>();
            let doneResearch = -1;
            let started = false;
            const refresh = () => {
                const d = hudData(world, CAT, selectedId, settings);
                const ms = d.milestones.filter((m) => m.done);
                const rs = d.research.filter((r) => r.state === "done").length;
                if (started) {
                    if (ms.some((m) => !doneMilestones.has(m.id))) bw("milestone");
                    else if (rs > doneResearch) bw("research");
                }
                ms.forEach((m) => doneMilestones.add(m.id));
                doneResearch = rs;
                started = true;
                const running = Object.values(world.buildings).filter((b) => b.crafting).length;
                const total = Object.keys(world.buildings).length;
                bwHum(settings.sound && total > 1 ? Math.min(1, 0.25 + running / Math.max(1, total - 1)) : null);
                setData(d);
            };
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
            const tools = [...CAT.tree.machines.map((m) => m.id), "belt", "belt-copper", "belt-steel"].map((id) => {
                const r = resolve(CAT, id);
                return { id, label: r?.name ?? id, line: id in BELT_TIER, footprint: r ? { w: r.footprint.w, d: r.footprint.d } : undefined };
            });
            const input: MountedInput = mount(island.camera, canvas, {
                touchBar: true,
                board: BOARD,
                world: buildWorld,
                tools,
                heightAt,
                initialPose: { target: { x: 0, y: 0, z: 0 }, yaw: 0.6, pitch: 0.75, distance: 18 },
                limits: { bounds: { minX: -14, maxX: 14, minZ: -10, maxZ: 10 }, minDistance: 5, maxDistance: 34, minPitch: 0.35, maxPitch: 1.2, topDownPitch: 1.5, fovY: 0.55, smoothing: 12 },
                onEvent: (e) => {
                    if (e.type === "invalid") {
                        setNote(e.reason);
                        bw("invalid");
                    } else if (e.type === "place" || e.type === "remove") {
                        bw(e.type);
                        setNote("");
                        syncScene();
                        refresh();
                    } else syncScene();
                },
            });

            // Placement preview: the input module owns the ghost, the renderer draws it.
            let ghostKey = "";
            const updateGhost = () => {
                const g = input.controller.build.ghost();
                const c = g && g.cells.length ? { x: Math.min(...g.cells.map((k) => k.x)), z: Math.min(...g.cells.map((k) => k.z)), valid: g.cells.every((k) => k.valid) } : undefined;
                const model = g ? getMachineModel(g.tool.id) : undefined;
                const key = g && c && model ? `${g.tool.id}:${c.x},${c.z},${g.rot},${c.valid}` : "";
                if (key === ghostKey) return;
                ghostKey = key;
                if (g && c && model) island.setGhost(model, { x: c.x, z: c.z }, g.rot, c.valid);
                else island.clearGhost();
            };

            // Push each machine's working flag, clock and charge to the renderer so parts move and lamps glow.
            const pushStates = () => {
                const charge = chargeOf(world, CAT);
                const sat = world.power.satisfaction;
                for (const id of drawn) {
                    const b = world.buildings[id];
                    if (!b) continue;
                    const r = resolve(CAT, b.type);
                    const working = r ? (r.kind === "miner" ? sat > 0 : r.kind === "generator" ? true : b.crafting) : false;
                    island.setObjectState(`b${id}`, { working, t: world.time, charge: charge[id] ?? 1 });
                }
            };

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
                setRecipe: (recipeId) => {
                    if (selectedId === null) return;
                    const r = simActions.setRecipe(world, selectedId, recipeId, CAT);
                    setNote(r.ok ? "" : r.reason);
                    refresh();
                },
                prestige: (id) => {
                    const r = simActions.prestige(world, id, CAT);
                    if (!r.ok) return setNote(r.reason);
                    bw("prestige");
                    save();
                    syncScene();
                    refresh();
                },
                settings: (p) => {
                    settings = { ...settings, ...p };
                    bwSetEnabled(settings.sound);
                    island.setLowFx(settings.lowFx || settings.reduceMotion);
                    island.setSceneryDensity(settings.lowFx || settings.reduceMotion ? 0.5 : 1);
                    [1.2, 2, 3].forEach((v, tier) => island.setBeltSpeed(tier, settings.reduceMotion ? 0 : v));
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
                updateGhost();
                pushStates();
                if (!document.hidden) {
                    advance(world, dt, 0.1, CAT);
                    island.setWind(world.wind ?? windAt(world.time));
                    const m = moodRef.current;
                    island.setTimeOfDay(m === "Auto" ? dayClock(world, CAT).phase : m === "Day" ? 0.05 : m === "Dusk" ? 0.5 : 0.75);
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

            snap.current = () => island.snapshot();
            island.resize();
            island.start();
            refresh();
            cleanup = () => {
                cancelAnimationFrame(raf);
                save();
                input.destroy();
                window.removeEventListener("resize", onResize);
                island.dispose();
                bwHum(null);
                ctl.current = null;
                snap.current = null;
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
    const onSetRecipe = useCallback((id: string) => ctl.current?.setRecipe(id), []);
    const onPrestige = useCallback((id: string) => ctl.current?.prestige(id), []);
    const onSettings = useCallback((p: Partial<HudSettings>) => ctl.current?.settings(p), []);

    return (
        <div className="bw-root">
            <AutomationHud data={data} actions={{ onBuild, onSelect, onResearch, onSetRecipe, onPrestige, onSettings }}>
                <canvas ref={canvasRef} className="bw-canvas" />
                <Link href="/creations/games" className="bw-back">
                    Back to Games
                </Link>
                <BrassworkExtras snapshot={snapshot} away={away} mood={mood} onMood={onMood} />
                {note && <p className="bw-note">{note}</p>}
            </AutomationHud>
        </div>
    );
}
