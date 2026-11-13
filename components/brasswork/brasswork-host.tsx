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
    footprintCells,
    offerSites,
    hudData,
    resolve,
    serialize,
    windAt,
    type HudSettings,
    type Rot,
    type World,
} from "@/lib/automation/sim";
import type { HudData as HudViewData } from "@/components/automation/types";
import type { VoxelIsland } from "@/lib/automation/render";

const W = 18;
const D = 12;
const SAVE_KEY = "brasswork-save-v1";
const CAT = DEFAULT_CATALOG;
const START_SETTINGS: HudSettings = { sound: false, reduceMotion: false, lowFx: false, numberFormat: "short", showRates: true };

// Resource node spots, one per ore in the recipe tree. Placeholder layout until the site design lands.
const NODE_SPOTS: [number, number][] = [[2, 2], [2, 8], [15, 2], [15, 8], [8, 1]];

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

// The sim's research nodes carry no grid position, glyph or unlock line; the HUD's research screen needs them.
// Column is the depth in the requires chain (0..4), row is the order within a column.
function forHud(d: ReturnType<typeof hudData>, seed: number): HudViewData {
    const byId = new Map(d.research.map((n) => [n.id, n]));
    const depth = new Map<string, number>();
    const depthOf = (id: string, seen = new Set<string>()): number => {
        if (depth.has(id)) return depth.get(id)!;
        if (seen.has(id)) return 0;
        seen.add(id);
        const n = byId.get(id);
        const v = n && n.requires.length ? 1 + Math.max(...n.requires.map((r) => depthOf(r, seen))) : 0;
        depth.set(id, v);
        return v;
    };
    const rows: Record<number, number> = {};
    const research = d.research.map((n) => {
        const column = Math.min(4, depthOf(n.id));
        const row = Math.min(4, (rows[column] = (rows[column] ?? -1) + 1));
        return { ...n, glyph: n.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?", unlocks: n.note, column, row };
    });
    const sites = offerSites(seed).map((x) => ({
        id: x.id,
        name: x.name,
        floor: `${x.width} by ${x.depth} floor`,
        ore: `${x.nodes.length} resource nodes`,
        bonus: `x${x.bonus.miner} mining, x${x.bonus.power} power`,
    }));
    const prestige = { ready: d.prestige.ready, requirement: d.prestige.requirement, keeps: ["Blueprints", "Research", "Belts"], leaves: ["Machines", "Stock"], sites };
    return { ...d, research, prestige };
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
        return forHud(hudData(w, CAT, null, START_SETTINGS), 1);
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
            const [{ createVoxelIsland, heightAt }, THREE] = await Promise.all([import("@/lib/automation/render"), import("three")]);
            const canvas = canvasRef.current;
            if (dead || !canvas) return;
            const { world: w0, savedAt } = loadWorld();
            const world = w0;
            let settings = { ...START_SETTINGS };
            let tool: string | null = null;
            let rot: Rot = 0;
            let selectedId: number | null = null;
            const stamped = new Set<number>();

            const island: VoxelIsland = createVoxelIsland(canvas, { quality: "auto", dither: true, timeOfDay: 0.4, cycle: false });
            const center = (x: number, z: number, w: number, d: number): [number, number] => [x + w / 2 - W / 2, z + d / 2 - D / 2];

            const stampNew = () => {
                for (const b of Object.values(world.buildings)) {
                    if (stamped.has(b.id)) continue;
                    stamped.add(b.id);
                    const r = resolve(CAT, b.type);
                    if (!r) continue;
                    const cells = footprintCells(b, r.footprint);
                    const xs = cells.map((c) => c[0]);
                    const zs = cells.map((c) => c[1]);
                    const bw = Math.max(...xs) - Math.min(...xs) + 1;
                    const bd = Math.max(...zs) - Math.min(...zs) + 1;
                    const [cx, cz] = center(Math.min(...xs), Math.min(...zs), bw, bd);
                    const color = TYPE_COLORS[b.type] ?? (r.kind === "generator" ? TYPE_COLORS.power : 0x9aa4b8);
                    island.stamp((s) => s.box(cx, 0, cz, bw * 0.9, 0.7, bd * 0.9, color));
                }
            };
            island.stamp((s) => {
                for (const [key, dep] of Object.entries(world.deposits)) {
                    const [x, z] = key.split(",").map(Number);
                    const [cx, cz] = center(x, z, 1, 1);
                    s.box(cx, 0, cz, 0.8, 0.25, 0.8, ORE_COLORS[dep.item] ?? 0x888888);
                }
            });
            stampNew();

            // Away time: catch up the simulation for the time the tab was closed (capped by the catalog).
            const away = Math.max(0, (Date.now() - savedAt) / 1000);
            if (away > 5) advance(world, Math.min(away, CAT.tune.maxAwaySeconds), 1, CAT);

            const refresh = () => setData(forHud(hudData(world, CAT, selectedId, settings), world.progress.prestiges + 1));
            const save = () => {
                try {
                    localStorage.setItem(SAVE_KEY, JSON.stringify({ text: serialize(world), savedAt: Date.now() }));
                } catch {
                    /* private mode or full storage: play without saving */
                }
            };

            ctl.current = {
                setTool: (id) => {
                    tool = tool === id ? null : id;
                    setNote(tool ? `Click the floor to place ${resolve(CAT, tool)?.name ?? tool}. R rotates, Esc cancels.` : "");
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
                    window.location.reload(); // the renderer has no way to clear stamped machines yet
                },
                settings: (p) => {
                    settings = { ...settings, ...p };
                    island.setLowFx(settings.lowFx || settings.reduceMotion);
                    refresh();
                },
            };

            // Click to place: a pointer that barely moved is a click, otherwise it was an orbit drag.
            let down: { x: number; y: number; t: number } | null = null;
            const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY, t: performance.now() });
            const onUp = (e: PointerEvent) => {
                const d0 = down;
                down = null;
                if (!d0 || !tool || Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 6 || performance.now() - d0.t > 500) return;
                const rect = canvas.getBoundingClientRect();
                const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -(((e.clientY - rect.top) / rect.height) * 2 - 1));
                island.camera.updateMatrixWorld();
                const ray = new THREE.Raycaster();
                ray.setFromCamera(ndc, island.camera);
                const o = ray.ray.origin;
                const dir = ray.ray.direction;
                if (dir.y >= -1e-6) return;
                const t = (heightAt(0, 0) - o.y) / dir.y;
                const px = o.x + dir.x * t + W / 2;
                const pz = o.z + dir.z * t + D / 2;
                const res = simActions.place(world, tool, Math.floor(px), Math.floor(pz), rot, CAT);
                if (res.ok) {
                    stampNew();
                    setNote("");
                } else setNote(res.reason);
                refresh();
            };
            const onKey = (e: KeyboardEvent) => {
                if ((e.target as HTMLElement | null)?.closest("input,textarea,select")) return;
                if (e.key === "Escape" && tool) {
                    tool = null;
                    setNote("");
                } else if ((e.key === "r" || e.key === "R") && tool) rot = ((rot + 1) % 4) as Rot;
            };
            canvas.addEventListener("pointerdown", onDown);
            canvas.addEventListener("pointerup", onUp);
            window.addEventListener("keydown", onKey);
            const onResize = () => island.resize();
            window.addEventListener("resize", onResize);

            // Simulation clock: fixed steps from real time, paused while the tab is hidden.
            let last = performance.now();
            let sinceHud = 0;
            let sinceSave = 0;
            const timer = window.setInterval(() => {
                const now = performance.now();
                const dt = Math.min(1, (now - last) / 1000);
                last = now;
                if (document.hidden) return;
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
            }, 100);

            island.resize();
            island.start();
            refresh();
            cleanup = () => {
                window.clearInterval(timer);
                save();
                canvas.removeEventListener("pointerdown", onDown);
                canvas.removeEventListener("pointerup", onUp);
                window.removeEventListener("keydown", onKey);
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
