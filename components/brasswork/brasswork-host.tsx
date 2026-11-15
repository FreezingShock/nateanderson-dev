"use client";

// Mounts Brasswork: the simulation (lib/automation/sim), the voxel island renderer (lib/automation/render, loaded
// with a dynamic import so Three.js stays off every other route) and the 2D HUD (components/automation).
// The world is 18 by 12 cells at one world unit per cell, which is the renderer's factory plateau.
import { useCallback, useEffect, useRef, useState } from "react";
import { AutomationHud } from "@/components/automation/automation-hud";
import { openHubMenu } from "@/components/automation/hub-menu";
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
    autoRoute,
    suggestSpot,
    footprintCells,
    hudData,
    resolve,
    SITES,
    START_NODE_SPOTS,
    serialize,
    windAt,
    type HudData,
    type HudSettings,
    type Rot,
    type World,
} from "@/lib/automation/sim";
import type { VoxelIsland } from "@/lib/automation/render";
import type { BuildWorld, InputController, MountedInput, ToolSpec } from "@/lib/automation/input";
import { openRowsOf, type GroupId } from "@/components/automation/build-bar";
import { DELETE_TOOL } from "@/lib/automation/input/build";
import { getMachineModel, getHubModel, hubStageFor } from "@/lib/automation/models/machines";
import { rotateCell, rotateSide } from "@/lib/automation/input/ports";
import { nodeModel, variantForCell, type ResourceId } from "@/lib/automation/models/resources";
import { pickBeltTile, type PieceKind, type PiecePlacement } from "@/lib/automation/models/belts";
import { WATER_LEVEL } from "@/lib/automation/render/config";
import { createBeltItems } from "@/lib/automation/render/beltitems";
import { scatterProps } from "@/lib/automation/models/props";
import { BrassworkExtras, MOODS, type AwayReport, type Mood } from "./extras";
import { useFirstRunQuest } from "./first-run";
import { BuildPopover, TrashButton } from "./build-popover";
import { NextMarker, type NextTarget } from "./next-marker";
import { HoverName } from "./hover-name";
import { attachUiSounds, playSound, setAmbient, setEnabled as setSoundOn, startAudio } from "@/lib/automation/audio";
import { LightingRow, SaveRows } from "./settings-extras";
import { VolumeRows } from "./audio-rows";
import { loadSettings, saveSettings } from "@/lib/brasswork/settings";
import "@/components/brasswork-ui/type.css";

const W = 18;
const D = 12;
const SAVE_KEY = "brasswork-save-v1";
const CAT = DEFAULT_CATALOG;
const START_SETTINGS: HudSettings = { sound: true, reduceMotion: false, lowFx: false, numberFormat: "short", showRates: true };

// Sim cells run 0..W-1, 0..D-1. The renderer and the input module share one frame where the plateau starts at (-9, -6).
const BOARD = { width: W, depth: D, originX: -W / 2, originZ: -D / 2 };

const BELT_TIER: Record<string, number> = { belt: 0, "belt-copper": 1, "belt-steel": 2 };
// The build dock's sections in display order. Tab and Shift+Tab step through them, and the number keys pick from the open one.
const DOCK_ORDER: GroupId[] = ["logistics", "machines", "power"];
const toolSpecOf = (id: string): ToolSpec => {
    const r = resolve(CAT, id);
    return { id, label: r?.name ?? id, line: id in BELT_TIER, footprint: r ? { w: r.footprint.w, d: r.footprint.d } : undefined };
};
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

function freshWorld(): World {
    const w = createWorld({ width: W, depth: D, hub: { x: 8, z: 5 } }, CAT);
    CAT.tree.nodes.forEach((n, i) => {
        const s = START_NODE_SPOTS[i];
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

// Yields to the browser between slices of work. A MessageChannel is not clamped in a background tab the way setTimeout is.
const yieldToBrowser = () =>
    new Promise<void>((done) => {
        const c = new MessageChannel();
        c.port1.onmessage = () => done();
        c.port2.postMessage(0);
    });

/**
 * Away time: catches the simulation up for the time the tab was closed (capped by the catalog). Same one-second steps as a
 * single advance(), run in slices of about 10 ms so a long gap never freezes the page.
 */
async function catchUpAway(world: World, savedAt: number, settings: HudSettings, setAway: (a: AwayReport) => void, isDead: () => boolean): Promise<void> {
    const away = Math.max(0, (Date.now() - savedAt) / 1000);
    if (away <= 5) return;
    const total = Math.min(away, CAT.tune.maxAwaySeconds);
    const before = new Map(hudData(world, CAT, null, settings).resources.map((r) => [r.id, r.amount]));
    let left = total;
    while (left > 1e-9) {
        const sliceEnds = performance.now() + 10;
        while (left > 1e-9 && performance.now() < sliceEnds) {
            const h = Math.min(1, left);
            advance(world, h, 1, CAT);
            left -= h;
        }
        if (left > 1e-9) {
            await yieldToBrowser();
            if (isDead()) return;
        }
    }
    const gains = hudData(world, CAT, null, settings)
        .resources.map((r) => ({ name: r.name, amount: r.amount - (before.get(r.id) ?? 0) }))
        .filter((g) => g.amount >= 1)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8);
    if (away >= 120) setAway({ seconds: total, gains });
}

export function BrassworkHost() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [data, setData] = useState<HudData>(() => hudData(freshWorld(), CAT, null, START_SETTINGS));
    const [note, setNote] = useState("");
    // What the armed tool does, shown until something else needs the line. Follows the input layer's tool, however it was armed.
    const [hint, setHint] = useState("");
    // Placed-piece pop-up: the building's anchor, what it is, and where to pin it on screen.
    const [pop, setPop] = useState<{ anchor: { x: number; z: number }; kind: string; kindLabel: string; x: number; y: number } | null>(null);
    const [inputCtl, setInputCtl] = useState<InputController | null>(null);
    const nameOfKind = useCallback((kind: string) => resolve(CAT, kind)?.name ?? kind, []);
    const [nextTarget, setNextTarget] = useState<NextTarget | null>(null);
    const [away, setAway] = useState<AwayReport | null>(null);
    const [mood, setMood] = useState<Mood>("Auto");
    const quest = useFirstRunQuest(data);
    const moodRef = useRef<Mood>("Auto");
    const onMood = useCallback((m: Mood) => {
        moodRef.current = m;
        setMood(m);
        try { localStorage.setItem("bw-mood-v1", m); } catch { /* private mode: lighting still changes for this visit */ }
    }, []);
    useEffect(() => {
        try {
            const m = localStorage.getItem("bw-mood-v1");
            if (m && (MOODS as readonly string[]).includes(m)) { moodRef.current = m as Mood; setMood(m as Mood); }
        } catch { /* no storage */ }
    }, []);
    const snap = useRef<(() => string) | null>(null);
    const snapshot = useCallback(() => snap.current?.() ?? null, []);
    // The palette tool the player armed (null when none). Mirrors the input module's tool so the palette can show it.
    const armedRef = useRef<string | null>(null);
    // The build dock section that is open, mirrored from the HUD and the Tab keys.
    const [dockGroup, setDockGroup] = useState<GroupId | null>(null);
    const onDockGroup = useCallback((g: GroupId | null) => {
        setDockGroup(g);
        if (g) ctl.current?.group(DOCK_ORDER.indexOf(g));
    }, []);
    const ctl = useRef<{
        setTool: (id: string | null) => void;
        group: (index: number) => void;
        select: (id: string | null) => void;
        research: (id: string) => void;
        setRecipe: (id: string) => void;
        prestige: (id: string) => void;
        settings: (p: Partial<HudSettings>) => void;
        details: (anchor: { x: number; z: number }) => void;
    } | null>(null);

    useEffect(() => {
        let dead = false;
        let cleanup = () => {};
        (async () => {
            // The save loads at once. The away-time catch-up runs in slices beside the chunk downloads, so the page stays
            // responsive (an 8 hour gap is 28,800 one-second steps) and costs no wall time the download was not already taking.
            const { world, savedAt } = loadWorld();
            let settings = loadSettings(START_SETTINGS);
            const caughtUp = catchUpAway(world, savedAt, settings, setAway, () => dead);
            const [{ createVoxelIsland, heightAt }, { mount }, { attachLife }] = await Promise.all([import("@/lib/automation/render"), import("@/lib/automation/input"), import("@/lib/automation/render/life"), caughtUp]);
            const canvas = canvasRef.current;
            if (dead || !canvas) return;
            let selectedId: number | null = null;
            const drawn = new Set<number>();
            let hubStage = -1;
            const shownNodes = new Map<string, string>();
            // How tall each machine stands above its cells (input frame), so a click on a machine's body picks the machine
            // and not the ground behind it. Belts stay flat. Rebuilt by syncScene.
            const bodyTop = new Map<string, number>();
            const pickHeightAt = (x: number, z: number) => heightAt(x, z) + (bodyTop.get(`${Math.floor(x)},${Math.floor(z)}`) ?? 0);

            const island: VoxelIsland = createVoxelIsland(canvas, { quality: "auto", dither: true, timeOfDay: 0.4, cycle: false, orbit: false });
            [1.2, 2, 3].forEach((v, tier) => island.setBeltSpeed(tier, v));
            // Island life: leaves, birds, fireflies, smoke, shore glints, drizzle and reward bursts.
            const life = attachLife(island, heightAt);
            // Items riding the belts, redrawn each frame from the sim's lanes.
            const beltItems = createBeltItems();
            island.scene.add(beltItems.object);
            const beltPieces = new Map<number, PiecePlacement>();
            // Handle for the browser console and headless captures: __bwLife.burst("milestone", 0, 0), __bwLife.setRain(1).
            (window as unknown as { __bwLife?: typeof life }).__bwLife = life;
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
                bodyTop.clear();
                for (const b of Object.values(world.buildings)) {
                    if (b.type in BELT_TIER) continue;
                    const r = resolve(CAT, b.type);
                    const model = b.type === "hub" ? getHubModel(hubStage < 0 ? 0 : hubStage) : getMachineModel(b.type);
                    if (!r || !model) continue;
                    // Most of the model's height, so a click near the very top edge still counts as the machine.
                    const top = (model.size?.[1] ?? 8) * model.voxel * 0.75;
                    for (const [cx, cz] of footprintCells(b, r.footprint)) bodyTop.set(`${cx - W / 2},${cz - D / 2}`, top);
                }
                for (const id of [...drawn]) {
                    if (!world.buildings[id]) {
                        island.removeObject(`b${id}`);
                        drawn.delete(id);
                    }
                }
                // Belts pick their tile from their neighbours, so a placement or removal can change the cells around it.
                const pieces: PiecePlacement[] = [];
                beltPieces.clear();
                for (const b of Object.values(world.buildings)) {
                    if (!(b.type in BELT_TIER)) continue;
                    const piece: PiecePlacement = { kind: beltTile(world, b), tier: BELT_TIER[b.type], x: b.x - W / 2, z: b.z - D / 2, rot: b.rot as 0 | 1 | 2 | 3 };
                    pieces.push(piece);
                    beltPieces.set(b.id, piece);
                    drawn.add(b.id);
                }
                island.setBelts(pieces);
                // The hub grows with the milestones: redraw it when its stage changes.
                const stageNow = hubStageFor(world.progress.milestonesDone.length);
                if (stageNow !== hubStage) {
                    hubStage = stageNow;
                    for (const b of Object.values(world.buildings))
                        if (b.type === "hub" && drawn.has(b.id)) {
                            island.removeObject(`b${b.id}`);
                            drawn.delete(b.id);
                        }
                }
                // Resource nodes: shown while free, hidden under a drill (the drill model covers the same 2x2).
                const occupied = new Set(Object.values(world.buildings).map((b) => `${b.x},${b.z}`));
                for (const [key, sig] of [...shownNodes]) {
                    const dep = world.deposits[key];
                    if (!dep || occupied.has(key) || sig !== `${dep.item}:${dep.purity}`) {
                        island.removeObject(`n${key}`);
                        shownNodes.delete(key);
                    }
                }
                for (const [key, dep] of Object.entries(world.deposits)) {
                    if (occupied.has(key) || shownNodes.has(key)) continue;
                    const [x, z] = key.split(",").map(Number);
                    island.placeModel(`n${key}`, nodeModel(dep.item as ResourceId, dep.purity, variantForCell(x, z)), { cell: { x: x - W / 2 - 0.5, z: z - D / 2 - 0.5 }, rot: 0 });
                    shownNodes.set(key, `${dep.item}:${dep.purity}`);
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
                    const model = b.type === "hub" ? getHubModel(hubStage) : getMachineModel(b.type);
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
            syncScene();

            // Sound cues from what changed since the last refresh: a milestone finished, a blueprint bought.
            const doneMilestones = new Set<string>();
            let doneResearch = -1;
            let unlockedCount = -1;
            let hubStock = -1;
            let lastDelivery = 0;
            let started = false;
            // Where celebrations play: over the hub, or the board centre before one exists.
            const hubAt = (): [number, number] => {
                const hub = Object.values(world.buildings).find((b) => b.type === "hub");
                return hub ? center(hub.x - 1, hub.z - 1, 3, 3) : [0, 0];
            };
            // The number keys' tool lists, one per dock section, rebuilt on every refresh so they match the open rows.
            const dockTools: ToolSpec[][] = DOCK_ORDER.map(() => []);
            // Where the NEXT banner wants you to build, in the input frame. Only the state changes when the spot does.
            let targetKey = "";
            const syncTarget = (actionId: string | undefined) => {
                let t: NextTarget | null = null;
                const fpOf = (id: string) => CAT.tree.machines.find((m) => m.id === id)?.footprint ?? { w: 1, d: 1 };
                if (actionId === "drill") {
                    const free = Object.entries(world.deposits)
                        .map(([k, v]) => ({ k, item: v.item, c: k.split(",").map(Number) }))
                        .filter((e) => !buildingAt(world, e.c[0], e.c[1], CAT))
                        .sort((a, b) => (a.item === "iron_ore" ? 0 : 1) - (b.item === "iron_ore" ? 0 : 1))[0];
                    if (free) t = { x: free.c[0] - W / 2, z: free.c[1] - D / 2, w: 1, d: 1, label: "Place the drill here" };
                } else if (actionId === "kiln" || actionId === "windmill") {
                    const fp = fpOf(actionId);
                    const spot = suggestSpot(world, fp, CAT);
                    if (spot) t = { x: spot.x - W / 2, z: spot.z - D / 2, w: fp.w, d: fp.d, label: `${actionId === "kiln" ? "Kiln" : "Windmill"} fits here` };
                } else if (actionId === "hub-menu") {
                    const hub = world.buildings[world.hubId];
                    if (hub) t = { x: hub.x - W / 2, z: hub.z - D / 2, w: 3, d: 3, label: "Deliver to the hub" };
                }
                const key = t ? `${t.x},${t.z},${t.w},${t.d},${t.label}` : "";
                if (key === targetKey) return;
                targetKey = key;
                setNextTarget(t);
            };
            const refresh = () => {
                const d = hudData(world, CAT, selectedId, settings);
                syncTarget(d.nextStep.actionId);
                d.armed = armedRef.current;
                d.rotation = input.controller.build.getRot() * 90;
                DOCK_ORDER.forEach((g, i) => {
                    dockTools[i].splice(0, dockTools[i].length, ...openRowsOf(d.machines, g).slice(0, 9).map((r) => toolSpecOf(r.id)));
                });
                const ms = d.milestones.filter((m) => m.done);
                const rs = d.research.filter((r) => r.state === "done").length;
                const unlocked = d.research.filter((r) => r.state !== "locked").length;
                const stockNow = d.resources.reduce((a, r) => a + r.amount, 0);
                if (started) {
                    const [hx, hz] = hubAt();
                    if (ms.some((m) => !doneMilestones.has(m.id))) {
                        playSound("milestone");
                        life.burst("milestone", hx, hz);
                        island.burst({ x: hx - W / 2, z: hz - D / 2 }, "milestone");
                    } else if (rs > doneResearch) {
                        playSound("research");
                        life.burst("research", hx, hz);
                    } else if (unlocked > unlockedCount && unlockedCount >= 0) {
                        playSound("unlock");
                        life.burst("unlock", hx, hz);
                    }
                    else if (stockNow > hubStock + 0.5 && performance.now() - lastDelivery > 2500) {
                        lastDelivery = performance.now();
                        playSound("delivery");
                        life.burst("delivery", hx, hz);
                    }
                }
                unlockedCount = unlocked;
                hubStock = stockNow;
                ms.forEach((m) => doneMilestones.add(m.id));
                doneResearch = rs;
                started = true;
                const running = Object.values(world.buildings).filter((b) => b.crafting).length;
                const total = Object.keys(world.buildings).length;
                const kinds: Record<string, number> = {};
                for (const b of Object.values(world.buildings)) if (b.crafting) kinds[b.type] = (kinds[b.type] ?? 0) + 1;
                setAmbient({ wind: world.wind ?? windAt(world.time), night: 1 - dayClock(world, CAT).solar, working: total > 1 ? Math.min(1, 0.25 + running / Math.max(1, total - 1)) : 0, kinds });
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
                // The grid reports anchors in sim cells. Shift them back so every anchor the input layer sees is in its frame.
                get: (x, z) => {
                    const it = grid.get(x + ox, z + oz);
                    if (!it || !it.anchor) return it;
                    return { ...it, anchor: { x: it.anchor.x - ox, z: it.anchor.z - oz } };
                },
                set: (x, z, item) => {
                    const r = grid.set(x + ox, z + oz, item);
                    if (!r.ok) setNote(r.reason);
                },
                check: (kind, x, z, rot) => grid.check(kind, x + ox, z + oz, rot),
                // Ports that face out of a machine cell, for belt joins. Rotated with the machine (see lib/automation/input/ports.ts).
                portsAt: (x, z) => {
                    const it = buildWorld.get(x, z);
                    if (!it || it.kind.startsWith("belt")) return [];
                    const model = getMachineModel(it.kind);
                    const fp = CAT.tree.machines.find((m) => m.id === it.kind)?.footprint;
                    if (!model || !fp) return [];
                    const anchor = it.anchor ?? { x, z };
                    const out: Rot[] = [];
                    for (const p of [...(model.ports?.out ?? []), ...(model.ports?.in ?? [])]) {
                        const c = rotateCell(p.cell.x, p.cell.z, fp.w, fp.d, it.rot as Rot);
                        if (anchor.x + c.x === x && anchor.z + c.z === z) out.push(rotateSide(p.side, it.rot as Rot));
                    }
                    return out;
                },
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
                groups: dockTools,
                // Press a belt on a machine and drag to another: the sim finds the shortest clear route (input frame in, input frame out).
                route: (from, to, toolId) => {
                    const r = autoRoute(world, { x: from.x + ox, z: from.z + oz }, { x: to.x + ox, z: to.z + oz }, toolId, CAT);
                    return r.ok ? { ok: true, cells: r.cells.map((c) => ({ x: c.x - ox, z: c.z - oz, rot: c.rot })) } : r;
                },
                onGroup: (i) => setDockGroup(DOCK_ORDER[i] ?? null),
                heightAt: pickHeightAt,
                groundHeightAt: heightAt,
                initialPose: { target: { x: -2.4, y: 0, z: -2.2 }, yaw: 0.6, pitch: 0.75, distance: 21 },
                limits: { bounds: { minX: -14, maxX: 14, minZ: -10, maxZ: 10 }, minDistance: 5, maxDistance: 34, minPitch: 0.35, maxPitch: 1.2, topDownPitch: 1.5, fovY: 0.55, smoothing: 12 },
                onEvent: (e) => {
                    if (e.type === "invalid") {
                        setNote(e.reason);
                        playSound("invalid");
                    } else if (e.type === "place" || e.type === "remove") {
                        const toolId = input.controller.build.getTool()?.id ?? "";
                        if (e.type === "place" && toolId.startsWith("belt") && e.cells.length > 1) playSound("belt", { n: e.cells.length });
                        else playSound(e.type, { size: e.cells.length });
                        // One burst per changed cell, capped so a long drag stays readable.
                        for (const c of e.cells.slice(0, 40)) island.burst(c, e.type);
                        setNote("");
                        syncScene();
                        refresh();
                    } else if (e.type === "rotate" || e.type === "undo") {
                        playSound(e.type);
                    } else if (e.type === "route-source") {
                        playSound("select");
                        setNote(e.active ? "Now tap the machine to feed, or an empty cell. Cancel drops it." : "");
                    } else if (e.type === "deselect") {
                        // Bare ground or Esc: put the inspector and the pop-up away.
                        if (selectedId !== null) {
                            selectedId = null;
                            refresh();
                        }
                        setPop(null);
                    } else if (e.type === "select") {
                        playSound("select");
                        // A short click or tap on a placed building (no tool active) opens its inspector.
                        // e.cell is in the shared input frame; the sim is offset by half the board (see buildWorld below).
                        const b = buildingAt(world, e.cell.x + W / 2, e.cell.z + D / 2, CAT);
                        // The hub opens its own menu in place of the inspector and quick actions.
                        if (b?.type === "hub") {
                            openHubMenu();
                            return;
                        }
                        // Phone: the click opens only the pop-up; its Details button opens the inspector sheet.
                        if (!window.matchMedia("(max-width: 767px)").matches) {
                            selectedId = b ? b.id : null;
                            refresh();
                        }
                        // Quick actions by the piece. Same click, so the inspector and the pop-up open together.
                        const at = input.controller.screenPoint(e.anchor);
                        if (b && at) setPop({ anchor: e.anchor, kind: e.kind, kindLabel: resolve(CAT, e.kind)?.name ?? e.kind, x: at.x, y: at.y });
                    } else syncScene();
                },
            });

            setInputCtl(input.controller);
            // The selected belt run (or building) glows in the 3D view. Same board frame as setBelts.
            // Placement preview: the input module owns the ghost, the renderer draws it.
            let ghostKey = "";
            // Only touch the highlight when a selection is or was showing. Every pointer move emits, and writing an empty
            // selection each time wiped the Remove preview, which the ghost below only redraws when its cells change.
            let hadSelection = false;
            input.controller.build.subscribe(() => {
                if (dead) return;
                const sel = input.controller.build.getHighlight();
                if (sel.length === 0 && !hadSelection) return;
                hadSelection = sel.length > 0;
                island.setHighlight(sel);
                ghostKey = "";
            });
            const updateGhost = () => {
                const g = input.controller.build.ghost();
                // Remove preview: outline every building cell the delete tool would clear, so a multi-cell machine shows whole.
                if (g && g.tool.id === DELETE_TOOL.id) {
                    const cells = g.cells.filter((k) => k.existing).map((k) => ({ x: k.x, z: k.z }));
                    const dk = "del:" + cells.map((k) => `${k.x},${k.z}`).join(";");
                    if (dk === ghostKey) return;
                    if (ghostKey.startsWith("path:")) island.setGhostPath([]);
                    ghostKey = dk;
                    island.clearGhost();
                    island.setHighlight(cells);
                    return;
                }
                // A belt stroke glows as one path, cells in drag order, each facing the next.
                if (g && g.tool.line && g.stroking && g.cells.length) {
                    const pk = "path:" + g.cells.map((k) => `${k.x},${k.z},${k.rot},${k.valid ? 1 : 0}`).join(";");
                    if (pk === ghostKey) return;
                    if (!ghostKey.startsWith("path:")) island.clearGhost();
                    ghostKey = pk;
                    island.setGhostPath(g.cells.map((k) => ({ x: k.x, z: k.z, rot: k.rot, valid: k.valid })));
                    return;
                }
                const c = g && g.cells.length ? { x: Math.min(...g.cells.map((k) => k.x)), z: Math.min(...g.cells.map((k) => k.z)), valid: g.cells.every((k) => k.valid) } : undefined;
                const model = g ? getMachineModel(g.tool.id) : undefined;
                const key = g && c && model ? `${g.tool.id}:${c.x},${c.z},${g.rot},${c.valid}` : "";
                if (key === ghostKey) return;
                if (ghostKey.startsWith("path:")) island.setGhostPath([]);
                ghostKey = key;
                if (g && c && model) {
                    island.setGhost(model, { x: c.x, z: c.z }, g.rot, c.valid);
                    island.setGhostValidity(c.valid);
                } else island.clearGhost();
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
                details: (anchor) => {
                    const b = buildingAt(world, anchor.x + W / 2, anchor.z + D / 2, CAT);
                    selectedId = b ? b.id : null;
                    refresh();
                },
                group: (index) => input.controller.setGroup(index),
                setTool: (id) => {
                    input.controller.setToolById(id);
                    setNote("");
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
                    playSound("prestige");
                    save();
                    syncScene();
                    refresh();
                },
                settings: (p) => {
                    settings = { ...settings, ...p };
                    if (Object.keys(p).length) saveSettings(settings);
                    setSoundOn(settings.sound);
                    island.setLowFx(settings.lowFx || settings.reduceMotion);
                    life.setLowFx(settings.lowFx || settings.reduceMotion);
                    island.setSceneryDensity(settings.lowFx || settings.reduceMotion ? 0.5 : 1);
                    [1.2, 2, 3].forEach((v, tier) => island.setBeltSpeed(tier, settings.reduceMotion ? 0 : v));
                    refresh();
                },
            };

            // Dev-only test hook for the headless playthrough. Off unless the URL has ?bwdev=1; it changes nothing for players.
            const devHook = new URLSearchParams(window.location.search).has("bwdev");
            if (devHook) {
                (window as unknown as { __bwdev: unknown }).__bwdev = {
                    getWorld: () => world,
                    beltItems,
                    CAT,
                    sim: simActions,
                    placeAt: (type: string, x: number, z: number, rot: Rot = 0) => {
                        const r = simActions.place(world, type, x, z, rot, CAT);
                        syncScene();
                        refresh();
                        return r;
                    },
                    refresh,
                    // Arms a build tool by its id, the same call the palette makes. Lets the headless check skip the palette.
                    setTool: (id: string | null) => input.controller.setToolById(id),
                    armedTool: () => input.controller.build.getTool()?.id ?? null,
                    // Close-up for visual checks: moves the orbit camera to look at (tx, ty, tz) from `distance` away.
                    setCamera: (tx: number, ty: number, tz: number, distance: number) => {
                        const c = island.controls;
                        if (!c) return false;
                        c.target.set(tx, ty, tz);
                        island.camera.position.set(tx - distance * 0.6, ty + distance * 0.7, tz + distance * 0.8);
                        c.update();
                        return true;
                    },
                    // Client pixel of a sim cell's centre, so a headless run can click the real floor.
                    cellPx: (sx: number, sz: number) => input.controller.screenPoint({ x: sx - W / 2, z: sz - D / 2 }),
                    // The sim cell the pointer would pick at a client pixel, or null off the board.
                    pickAt: (px: number, py: number) => {
                        const c = input.controller.pointer.cellAt(px, py);
                        return c ? { x: c.x + W / 2, z: c.z + D / 2 } : null;
                    },
                    selectedId: () => selectedId,
                    ghostCells: () => (input.controller.build.ghost()?.cells ?? []).map((c) => [c.x, c.z, c.valid ? 1 : 0, c.reason ?? ""]),
                };
            }

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
                    beltItems.update(
                        (function* () {
                            for (const [id, piece] of beltPieces) {
                                const b = world.buildings[id];
                                if (b && b.lane.length) yield { piece, lane: b.lane };
                            }
                        })(),
                        (p, t, out) => island.beltItemMatrix(p, t, out)
                    );
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
            window.addEventListener("bw:save", save); // the Settings window asks for a fresh save before exporting
            // Sound: wait for the first gesture, then ambient beds, machine sounds and menu / button sounds.
            const stopAudio = startAudio();
            const stopUiSounds = attachUiSounds((canvas.closest(".bw-root") as HTMLElement | null) ?? document.body);
            ctl.current?.settings({}); // apply the saved settings to the sound, scenery and belts
            island.resize();
            island.start();
            refresh();
            // Keys can change the armed tool or its rotation without a palette click (Escape, Q, R, Tab groups).
            // After each key, mirror the input layer's tool into the HUD so the palette and the dock stay true.
            let hintedId: string | null = null;
            const syncFromInput = () => {
                const id = input.controller.build.getTool()?.id ?? null;
                if (armedRef.current !== id) armedRef.current = id;
                if (id !== hintedId) {
                    hintedId = id;
                    const touch = window.matchMedia("(pointer: coarse)").matches;
                    const name = id ? resolve(CAT, id)?.name ?? id : "";
                    setHint(
                        !id
                            ? ""
                            : id === DELETE_TOOL.id
                              ? touch
                                  ? "Tap a building to remove it, or drag along belts. Cancel stops."
                                  : "Click a building to remove it, drag along belts, Shift-drag clears an area. Esc stops."
                              : id.startsWith("belt")
                                ? touch
                                  ? `Press and drag to lay ${name.toLowerCase()}, or tap one machine then another to route it. Cancel stops.`
                                  : `Drag to lay ${name.toLowerCase()}, or drag from one machine to another to route it for you. Esc stops.`
                                : touch
                                  ? `Tap a spot to preview ${name}, tap it again to place. Hold to turn it. Cancel stops.`
                                  : `Click to place ${name}. R turns it, Esc stops.`
                    );
                }
                refresh();
            };
            const onKeySync = () => window.setTimeout(syncFromInput, 0);
            // Clicks on the dock's Remove button arm the tool too, so the pointer counts as well as the keys.
            window.addEventListener("keydown", onKeySync);
            window.addEventListener("pointerup", onKeySync);
            cleanup = () => {
                cancelAnimationFrame(raf);
                window.removeEventListener("bw:save", save);
                window.removeEventListener("keydown", onKeySync);
                window.removeEventListener("pointerup", onKeySync);
                save();
                input.destroy();
                window.removeEventListener("resize", onResize);
                life.dispose();
                beltItems.dispose();
                island.dispose();
                stopUiSounds();
                stopAudio();
                ctl.current = null;
                setInputCtl(null);
                setPop(null);
                setNextTarget(null);
                snap.current = null;
            };
        })();
        return () => {
            dead = true;
            cleanup();
        };
    }, []);

    const onBuild = useCallback((id: string) => {
        // Tapping the armed row again disarms it.
        armedRef.current = armedRef.current === id ? null : id;
        ctl.current?.setTool(armedRef.current);
    }, []);
    const onSelect = useCallback((id: string | null) => ctl.current?.select(id), []);
    const onResearch = useCallback((id: string) => ctl.current?.research(id), []);
    const onSetRecipe = useCallback((id: string) => ctl.current?.setRecipe(id), []);
    const onPrestige = useCallback((id: string) => ctl.current?.prestige(id), []);
    const onSettings = useCallback((p: Partial<HudSettings>) => ctl.current?.settings(p), []);

    return (
        <div className="bw-root">
            <AutomationHud data={data} actions={{ onBuild, onSelect, onResearch, onSetRecipe, onPrestige, onSettings }} settingsSlots={{ sound: <VolumeRows />, display: <LightingRow mood={mood} onMood={onMood} />, save: <SaveRows /> }} removeSlot={inputCtl ? <TrashButton input={inputCtl} variant="dock" /> : undefined} quest={quest ?? undefined} dockGroup={dockGroup} onDockGroup={onDockGroup}>
                <canvas ref={canvasRef} className="bw-canvas" />
                <BrassworkExtras snapshot={snapshot} away={away} mood={mood} onMood={onMood} />
                {inputCtl && <HoverName input={inputCtl} nameOf={nameOfKind} canvas={canvasRef} />}
                {inputCtl && nextTarget && <NextMarker input={inputCtl} target={nextTarget} canvas={canvasRef} />}
                {inputCtl && pop && (
                    <BuildPopover
                        input={inputCtl}
                        anchor={pop.anchor}
                        kind={pop.kind}
                        kindLabel={pop.kindLabel}
                        x={pop.x}
                        y={pop.y}
                        lineKinds={["belt", "belt-copper", "belt-steel"]}
                        showDetails={typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches}
                        onDetails={(a) => {
                            ctl.current?.details(a);
                            setPop(null);
                        }}
                        onClose={() => setPop(null)}
                    />
                )}
                {(note || hint) && <p className="bw-note">{note || hint}</p>}
            </AutomationHud>
        </div>
    );
}
