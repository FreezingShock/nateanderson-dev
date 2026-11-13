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
            const tools = [...CAT.tree.machines.map((m) => m.id), "power-plant"].map((id) => {
                const r = resolve(CAT, id);
                return { id, label: r?.name ?? id, line: false, footprint: r ? { w: r.footprint.w, d: r.footprint.d } : undefined };
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
    const onPrestige = useCallback((id: string) => ctl.current?.prestige(id), []);
    const onSettings = useCallback((p: Partial<HudSettings>) => ctl.current?.settings(p), []);

    return (
        <div className="bw-root">
            <AutomationHud data={data} actions={{ onBuild, onSelect, onResearch, onPrestige, onSettings }}>
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
