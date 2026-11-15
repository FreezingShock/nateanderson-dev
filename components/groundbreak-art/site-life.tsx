// Life on the Groundbreak job site: drawn crew with walk and work cycles, delivery vehicles that pull in, unload and
// leave, dust, weld sparks, and a golden burst when a stage or the whole job is finished. Sprites come from
// scripts/groundbreak-art/build-life.py (public/groundbreak/life). Coordinates are art pixels of the scene's near plane,
// so everything scales with the camera and stays sharp at 5x (image-rendering: pixelated).
"use client";

import { useEffect, useRef, useState } from "react";
import { GB_LIFE } from "./life-data";

type Cat = "dig" | "pour" | "steel" | "skin" | "fit" | "wait";
type VehicleKind = "dump" | "mixer" | "flat-steel" | "flat-glass" | "flat-pallets" | "flat-rebar";

/** Which kind of work a phase is, from its name (engine phase names and the art's frame names both map here). */
export function phaseCat(name: string | null | undefined): Cat {
    const n = (name ?? "").toLowerCase();
    if (!n) return "wait";
    if (/site|form|gravel|dig|lot|caisson|pier/.test(n)) return "dig";
    if (/pour|slab|found|pile/.test(n)) return "pour";
    if (/envelope|skin|glass|door|rail|roof$/.test(n)) return "skin";
    if (/mep|fit/.test(n)) return "fit";
    return "steel";
}

const VEHICLE: Record<Exclude<Cat, "wait">, VehicleKind[]> = {
    dig: ["dump"], pour: ["mixer"], steel: ["flat-steel", "flat-rebar"], skin: ["flat-glass"], fit: ["flat-pallets"],
};
type Action = keyof typeof GB_LIFE.crew.actions;
const ROLES: Record<Cat, Action[]> = {
    dig: ["shovel", "walk", "shovel", "idle", "walk", "shovel"],
    pour: ["shovel", "walk", "idle", "shovel", "walk"],
    steel: ["weld", "carry", "hammer", "weld", "carry", "walk", "hammer"],
    skin: ["carry", "hammer", "carry", "walk", "hammer"],
    fit: ["carry", "walk", "hammer", "carry", "idle"],
    wait: ["walk", "idle", "walk", "idle"],
};

const FPS = 12;
const CYCLE = 18; // seconds per delivery: in 0-4, parked 4-13, out 13-18
const G = GB_LIFE.gutter;
const C = GB_LIFE.crew;
const V = GB_LIFE.vehicles;
const F = GB_LIFE.fx;

const hash = (i: number, k: number) => ((Math.sin(i * 127.1 + k * 311.7) * 43758.5453) % 1 + 1) % 1;
const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 2);

function Sprite({ src, w, h, col, row, x, y, flip, z }: { src: string; w: number; h: number; col: number; row: number; x: number; y: number; flip?: boolean; z?: number }) {
    return (
        <div className="gbl-sprite" style={{
            left: Math.round(x), top: Math.round(y), width: w, height: h, zIndex: z,
            backgroundImage: `url("${src}")`, backgroundPosition: `${-col * (w + 2 * G) - G}px ${-row * (h + 2 * G) - G}px`,
            transform: flip ? "scaleX(-1)" : undefined,
        }} />
    );
}

export interface SiteLifeProps {
    /** Left edge of the job strip frame and the ground line, in near-plane art px; w is the strip frame width. */
    left: number;
    ground: number;
    w: number;
    /** [roof offset from the ground (negative), building left, building right] for the frame on show. */
    outline: readonly [number, number, number] | readonly number[];
    jobKey: string;
    phase: number;
    phaseName: string | null;
    inspecting: boolean;
    done: boolean;
    crews: number;
    reduce: boolean;
    paused: boolean;
}

type Moment = { kind: "stage" | "done" | "start"; at: number };

export function GbSiteLife({ left, ground, w, outline, jobKey, phase, phaseName, inspecting, done, crews, reduce, paused }: SiteLifeProps) {
    const [t, setT] = useState(6);
    const clock = useRef(6);
    const origin = useRef(0);
    const moment = useRef<Moment | null>(null);
    const last = useRef({ jobKey, phase, done });

    useEffect(() => {
        if (reduce || paused) return;
        let prev = performance.now();
        const id = window.setInterval(() => {
            const now = performance.now();
            clock.current += Math.min(0.25, (now - prev) / 1000);
            prev = now;
            setT(clock.current);
        }, 1000 / FPS);
        return () => window.clearInterval(id);
    }, [reduce, paused]);

    // stage and job moments: a new job or phase restarts the delivery so a truck rolls in right away
    useEffect(() => {
        const p = last.current;
        const now = clock.current;
        if (p.jobKey !== jobKey) {
            moment.current = { kind: p.jobKey && p.jobKey !== "lot" && jobKey === "lot" ? "done" : "start", at: now };
            origin.current = now;
        } else if (p.phase !== phase) {
            moment.current = { kind: "stage", at: now };
            origin.current = now + 1.2;
        } else if (done && !p.done) {
            moment.current = { kind: "done", at: now };
        }
        last.current = { jobKey, phase, done };
    }, [jobKey, phase, done]);

    const cat: Cat = inspecting || jobKey === "lot" ? "wait" : phaseCat(phaseName);
    const [roof, bl, br] = outline as [number, number, number];
    const bL = left + bl, bR = left + br;
    const mid = (bL + bR) / 2;
    const m = moment.current;
    const since = m ? t - m.at : 99;
    const cheering = !reduce && m && m.kind !== "start" && since < 1.8;
    const out: React.ReactNode[] = [];

    // ---- vehicle
    let parkX = 0, vehicleIn = false;
    if (cat !== "wait") {
        const kinds = VEHICLE[cat];
        const ct = reduce ? 6 : t - origin.current;
        const n = Math.floor(ct / CYCLE);
        const kind = kinds[((n % kinds.length) + kinds.length) % kinds.length];
        const c = ((ct % CYCLE) + CYCLE) % CYCLE;
        parkX = bR - 6;
        const enter = 300, exit = -(parkX - left) - V.w - 160;
        let dx = 0, moving = false;
        if (c < 4) { dx = enter * (1 - ease(c / 4)); moving = c < 3.8; }
        else if (c > 13) { dx = exit * Math.pow((c - 13) / 5, 2); moving = true; }
        vehicleIn = c >= 4 && c <= 13;
        const row = V.rows[kind as keyof typeof V.rows];
        const roll = Math.floor(Math.abs(dx) / 4) % 2;
        let col = roll;
        if (kind === "dump") {
            if (c >= 6 && c < 10) col = 2 + Math.min(3, Math.floor((c - 6) / 0.5)) - (c > 9 ? Math.floor((c - 9) / 0.25) : 0);
            if (c >= 10) col = 6 + roll;
            col = Math.max(0, Math.min(7, col));
        } else if (kind === "mixer") {
            col = Math.floor(t * 8) % 8;
        } else if (c >= 10.5) {
            col = 2 + roll; // flatbed unloaded
        }
        if (!moving && kind !== "mixer" && kind !== "dump") col = c >= 10.5 ? 2 : 0;
        if (!moving && kind === "dump" && (c < 6)) col = 0;
        const vx = parkX + dx;
        out.push(<Sprite key="veh" src={V.src} w={V.w} h={V.h} col={col} row={row} x={vx} y={ground - 43} z={3} />);
        if (!reduce) {
            // dust off the wheels when pulling in and pulling away, grit when the dump bed tips
            const dust = (key: string, x: number, at: number, row: readonly number[]) => {
                const f = Math.floor((c - at) * 10);
                if (f >= 0 && f < row[1]) out.push(<Sprite key={key} src={F.src} w={F.w} h={F.h} col={f} row={row[0]} x={x - F.w / 2} y={ground - F.h + 2} z={4} />);
            };
            dust("d-in", vx + 70, 3.6, F.rows.dust);
            dust("d-out", vx + 70, 13, F.rows.dust);
            if (kind === "dump") dust("grit", parkX + V.w - 2, 7.2, F.rows.dust);
            if (kind === "mixer" && c > 6 && c < 11) dust("pour", parkX + V.w - 2 + 0, 6 + Math.floor((c - 6) / 0.6) * 0.6, F.rows.grit);
        }
    }

    // ---- crew
    const count = Math.min(12, 2 + Math.floor(crews / 2));
    const roles = ROLES[cat];
    const span = Math.max(40, bR - bL);
    const hasFrame = roof < -18;
    for (let i = 0; i < count; i++) {
        let action: Action = roles[i % roles.length];
        const variant = i % C.variants;
        const r1 = hash(i, 1), r2 = hash(i, 2);
        let x = bL + ((i + 0.5) / count + (r1 - 0.5) * 0.5 / count) * span - C.w / 2;
        let y = ground - C.foot;
        let flip = r2 > 0.5;
        if (action === "weld") {
            if (hasFrame) { y = ground + roof - C.foot; x = bL + 6 + r1 * Math.max(10, span - 12) - C.w / 2; }
            else action = "hammer";
        }
        if ((action === "carry" || action === "walk") && !reduce) {
            // carriers shuttle between the truck and the build; walkers pace their stretch of the lot
            const a = action === "carry" && cat !== "wait" ? parkX + 30 : x;
            const b = action === "carry" && cat !== "wait" ? bL + 10 + r2 * Math.max(10, span * 0.6) : x + 30 + r2 * 50;
            const dur = Math.abs(b - a) / (action === "carry" ? 14 : 18) + 0.01;
            const ph = ((t + r1 * 20) / dur) % 2;
            const p = ph < 1 ? ph : 2 - ph;
            x = a + (b - a) * p - C.w / 2;
            flip = (b < a) !== (ph >= 1);
            if (action === "carry" && cat !== "wait" && !vehicleIn && hash(i, 3) > 0.4) action = "walk";
        }
        if (inspecting || cheering) action = cheering || done ? "cheer" : "idle";
        const [c0, n] = C.actions[action];
        const rate = action === "walk" || action === "carry" ? 10 : action === "weld" ? 8 : action === "cheer" ? 5 : action === "idle" ? 1.5 : 6;
        const f = reduce ? 0 : Math.floor(t * rate + r1 * 7) % n;
        out.push(<Sprite key={`c${i}`} src={C.src} w={C.w} h={C.h} col={c0 + f} row={variant} x={x} y={y} flip={flip} z={y < ground - C.foot ? 1 : 5} />);
        if (action === "weld" && !reduce) {
            const sf = Math.floor(t * 10 + i * 3) % 4;
            const tipX = flip ? x + C.w - 18 : x + 18;
            out.push(<Sprite key={`s${i}`} src={F.src} w={F.w} h={F.h} col={sf} row={F.rows.sparks[0]} x={tipX - F.w / 2} y={y + 16 - 8} z={2} />);
        }
        if (action === "shovel" && !reduce && f === 2 && (Math.floor(t * rate + r1 * 7) % (n * 3)) === 2) {
            out.push(<Sprite key={`g${i}`} src={F.src} w={F.w} h={F.h} col={1} row={F.rows.dust[0]} x={x + (flip ? -10 : 10)} y={ground - F.h + 2} z={4} />);
        }
    }

    // ---- moments: a burst over the roof and dust kicked up at both ends of the build
    if (m && !reduce && since < 1.4) {
        const big = m.kind === "done";
        const bf = Math.floor(since * 8);
        if (m.kind !== "start" && bf < 8) {
            const by = ground + Math.min(roof, -20) - F.h / 2;
            out.push(<Sprite key="burst" src={F.src} w={F.w} h={F.h} col={bf} row={F.rows.burst[0]} x={mid - F.w / 2} y={by} z={6} />);
            if (big) {
                out.push(<Sprite key="burstL" src={F.src} w={F.w} h={F.h} col={Math.max(0, bf - 2)} row={F.rows.burst[0]} x={mid - span / 3 - F.w / 2} y={by + 10} z={6} />);
                out.push(<Sprite key="burstR" src={F.src} w={F.w} h={F.h} col={Math.max(0, bf - 3)} row={F.rows.burst[0]} x={mid + span / 3 - F.w / 2} y={by + 6} z={6} />);
            }
        }
        const df = Math.floor(since * 6);
        if (df < 6) {
            out.push(<Sprite key="mL" src={F.src} w={F.w} h={F.h} col={df} row={F.rows.dust[0]} x={bL - F.w / 2} y={ground - F.h + 2} z={4} />);
            out.push(<Sprite key="mR" src={F.src} w={F.w} h={F.h} col={df} row={F.rows.dust[0]} x={bR - F.w / 2} y={ground - F.h + 2} z={4} />);
        }
    }

    return <div className="gbl-life">{out}</div>;
}

export default GbSiteLife;
