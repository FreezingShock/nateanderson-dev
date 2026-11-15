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
const M = GB_LIFE.mini;
const X = GB_LIFE.machines;
type MiniAction = keyof typeof GB_LIFE.mini.actions;

const VEHICLE_LABEL: Record<VehicleKind, string> = {
    dump: "Dump truck\nHauling dirt off the lot", mixer: "Concrete mixer\nFresh concrete for the pour",
    "flat-steel": "Flatbed\nSteel beams for the frame", "flat-rebar": "Flatbed\nRebar for the decks",
    "flat-glass": "Flatbed\nGlass panels for the skin", "flat-pallets": "Flatbed\nPallets of fit-out supplies",
};
const MACHINE_LABEL = {
    excavator: "Excavator\nDigging out the pit", pump: "Concrete pump\nPlacing the slab",
    craneSteel: "Mobile crane\nLifting steel into place", craneGlass: "Mobile crane\nSetting glass panels",
    forklift: "Forklift\nMoving pallets to the door",
};
function crewLabel(action: string, cat: Cat, where: number | "roof" | null): string {
    const job: Record<string, string> = {
        shovel: "Digging", walk: "Walking the site", carry: cat === "skin" ? "Carrying a panel" : "Carrying lumber",
        hammer: cat === "steel" ? "Bolting steel" : cat === "fit" ? "Fitting out" : cat === "skin" ? "Fixing the skin" : "Building forms",
        weld: "Welding the frame", idle: cat === "wait" ? "Waiting on the next job" : "Checking the plans", cheer: "Stage done",
    };
    const place = where === "roof" ? "On the roof" : where ? `Floor ${where}` : "Crew";
    return `${place}\n${job[action] ?? "Working"}`;
}

const hash = (i: number, k: number) => ((Math.sin(i * 127.1 + k * 311.7) * 43758.5453) % 1 + 1) % 1;
const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 2);

type Pick = (label: string, x: number, y: number) => void;
type Tag = { label: string; pick: Pick };

function Sprite({ src, w, h, col, row, x, y, flip, z, tag }: { src: string; w: number; h: number; col: number; row: number; x: number; y: number; flip?: boolean; z?: number; tag?: Tag }) {
    // a tap (no drag) on a sprite shows what it is doing; the page owns pointer capture, so the tap is read from pointerdown
    // and confirmed on the window's pointerup when the pointer barely moved
    const down = (e: React.PointerEvent) => {
        if (!tag) return;
        const sx = e.clientX, sy = e.clientY;
        const up = (u: PointerEvent) => {
            window.removeEventListener("pointerup", up);
            if (Math.hypot(u.clientX - sx, u.clientY - sy) < 6) tag.pick(tag.label, x + w / 2, y);
        };
        window.addEventListener("pointerup", up);
    };
    return (
        <div className={`gbl-sprite${tag ? " gbl-pick" : ""}`} onPointerDown={tag ? down : undefined} title={tag?.label.split("\n")[0]} style={{
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
    outline: readonly (number | readonly number[])[];
    jobKey: string;
    phase: number;
    phaseName: string | null;
    inspecting: boolean;
    done: boolean;
    crews: number;
    reduce: boolean;
    paused: boolean;
    /** Screen pixels per art pixel, so the tap label keeps one size at every zoom. */
    scale: number;
}

type Moment = { kind: "stage" | "done" | "start"; at: number };

export function GbSiteLife({ left, ground, w, outline, jobKey, phase, phaseName, inspecting, done, crews, reduce, paused, scale }: SiteLifeProps) {
    const [sel, setSel] = useState<{ label: string; x: number; y: number; at: number } | null>(null);
    const pick: Pick = (label, x, y) => setSel((s) => (s && s.label === label ? null : { label, x, y, at: clock.current }));
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
    const [roof, bl, br] = outline as unknown as [number, number, number];
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
        parkX = bR + (cat === "pour" ? 74 : -6); // the pump truck backs onto the slab, so the mixer queues behind it
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
        out.push(<Sprite key="veh" src={V.src} w={V.w} h={V.h} col={col} row={row} x={vx} y={ground - 43} z={3} tag={{ label: VEHICLE_LABEL[kind], pick }} />);
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
    const floors = ((outline as readonly unknown[])[3] as readonly number[] | undefined) ?? [];
    for (let i = 0; i < count; i++) {
        let action: Action = roles[i % roles.length];
        const variant = i % C.variants;
        const r1 = hash(i, 1), r2 = hash(i, 2);
        let x = bL + ((i + 0.5) / count + (r1 - 0.5) * 0.5 / count) * span - C.w / 2;
        let y = ground - C.foot;
        let flip = r2 > 0.5;
        if (action === "weld") action = "hammer"; // welders work up on the frame (floor crew below)
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
        const rate = action === "walk" || action === "carry" ? 10 : action === "cheer" ? 5 : action === "idle" ? 1.5 : 6;
        const f = reduce ? 0 : Math.floor(t * rate + r1 * 7) % n;
        out.push(<Sprite key={`c${i}`} src={C.src} w={C.w} h={C.h} col={c0 + f} row={variant} x={x} y={y} flip={flip} z={5} tag={{ label: crewLabel(action, cat, null), pick }} />);
        if (action === "shovel" && !reduce && f === 2 && (Math.floor(t * rate + r1 * 7) % (n * 3)) === 2) {
            out.push(<Sprite key={`g${i}`} src={F.src} w={F.w} h={F.h} col={1} row={F.rows.dust[0]} x={x + (flip ? -10 : 10)} y={ground - F.h + 2} z={4} />);
        }
    }

    // ---- floor crew: small figures on every storey that is up (and the roof), working the stage
    if (cat !== "wait" && cat !== "dig" && cat !== "pour" || (inspecting && floors.length)) {
        const levels = [...floors].sort((a, b) => b - a); // lowest first
        if (roof < -18 && !levels.includes(roof)) levels.push(roof);
        const per = levels.length > 10 ? 1 : 2;
        const MR: Record<string, MiniAction[]> = { steel: ["weld", "walk", "hammer"], skin: ["carry", "hammer", "walk"], fit: ["walk", "hammer", "carry", "idle"], wait: ["idle", "walk"] };
        const roles2 = MR[inspecting ? "wait" : cat] ?? MR.wait;
        // tall towers: crew on a spread of floors so the whole height reads as busy without hundreds of sprites
        const pickLv = levels.length > 14 ? levels.filter((_, k) => k % Math.ceil(levels.length / 14) === 0 || k === levels.length - 1) : levels;
        pickLv.forEach((lv, li) => {
            const storey = levels.indexOf(lv) + 1;
            const onRoof = lv === roof || li === pickLv.length - 1;
            for (let k = 0; k < per; k++) {
                const j = li * 3 + k;
                let action: MiniAction = onRoof && cat === "steel" ? "weld" : roles2[j % roles2.length];
                const r1 = hash(j, 5), r2 = hash(j, 6);
                const lo = bL + 4, hi = bR - 4 - M.w;
                let x = lo + (per === 1 ? 0.08 + 0.84 * r1 : (k + 0.5) / per + (r1 - 0.5) * 0.4 / per) * (hi - lo);
                let flip = r2 > 0.5;
                if ((action === "walk" || action === "carry") && !reduce) {
                    const a = x, b = Math.min(hi, Math.max(lo, x + (r2 > 0.5 ? 1 : -1) * (20 + r1 * 40)));
                    const dur = Math.abs(b - a) / 9 + 0.01;
                    const ph = ((t + r1 * 17) / dur) % 2;
                    x = a + (b - a) * (ph < 1 ? ph : 2 - ph);
                    flip = (b < a) !== (ph >= 1);
                }
                if (cheering) action = "idle";
                const [c0, n] = M.actions[action];
                const rate = action === "walk" || action === "carry" ? 7 : action === "weld" ? 6 : action === "idle" ? 1.2 : 4;
                const f = reduce ? 0 : Math.floor(t * rate + r1 * 5) % n;
                const y = ground + lv - M.foot - 1;
                out.push(<Sprite key={`m${j}`} src={M.src} w={M.w} h={M.h} col={c0 + f} row={j % C.variants} x={x} y={y} flip={flip} z={2}
                    tag={{ label: crewLabel(action, cat, onRoof && lv === roof ? "roof" : storey), pick }} />);
                if (action === "weld" && !reduce && f === 0) {
                    out.push(<Sprite key={`ms${j}`} src={F.src} w={F.w} h={F.h} col={Math.floor(t * 10 + j) % 4} row={F.rows.sparks[0]} x={x + (flip ? 2 : M.w - 2) - F.w / 2} y={y + 3} z={2} />);
                }
            }
        });
    }

    // ---- machines: excavator in the pit, pump over the slab, mobile crane lifting steel or glass, forklift with pallets
    if (cat !== "wait") {
        const ct = reduce ? 6 : t - origin.current;
        const at = (key: string, row: number, col: number, x: number, flip: boolean, label: string) =>
            out.push(<Sprite key={key} src={X.src} w={X.w} h={X.h} col={col} row={row} x={x} y={ground - X.ground} flip={flip} z={3} tag={{ label, pick }} />);
        if (cat === "dig") at("ex", X.rows.excavator, reduce ? 1 : Math.floor(t * 2.2) % 6, bL - 56, false, MACHINE_LABEL.excavator);
        if (cat === "pour") {
            const f = reduce ? 5 : ct < 2 ? Math.min(3, Math.floor(ct / 0.5)) : 4 + (Math.floor(t * 4) % 2);
            at("pump", X.rows.pump, f, bR - 60, false, MACHINE_LABEL.pump);
        }
        if (cat === "steel" || cat === "skin") at("crane", cat === "steel" ? X.rows["crane-steel"] : X.rows["crane-glass"], reduce ? 0 : Math.floor(t * 1.5) % 4, bL - 66, false, cat === "steel" ? MACHINE_LABEL.craneSteel : MACHINE_LABEL.craneGlass);
        if (cat === "fit" || cat === "skin") {
            // forklift shuttles pallets from the delivery truck to the door
            const a = parkX + 10, b = bL + span * 0.55;
            const dur = Math.abs(a - b) / 16 + 0.01;
            const ph = reduce ? 0.5 : ((t + 3) / dur) % 2;
            const p = ph < 1 ? ph : 2 - ph;
            const x = a + (b - a) * p - 64;
            const lift = reduce ? 0 : Math.abs(p - 0.5) > 0.45 ? 2 : 0;
            at("fork", X.rows.forklift, lift * 2 + (Math.floor(t * 6) % 2), x, ph >= 1 ? false : true, MACHINE_LABEL.forklift);
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

    const showSel = sel && (reduce || t - sel.at < 5) ? sel : null;
    return (
        <div className="gbl-life">
            {out}
            {showSel && (
                <div className="gbl-tag" style={{ left: Math.round(showSel.x), top: Math.round(showSel.y) - 2, transform: `translate(-50%, -100%) scale(${1 / scale})` }}>
                    {showSel.label.split("\n").map((l, k) => (k ? <small key={k}>{l}</small> : <b key={k}>{l}</b>))}
                    <small>{phaseName && !inspecting && jobKey !== "lot" ? `${phaseName} · ` : ""}{crews} crew{crews === 1 ? "" : "s"} hired</small>
                </div>
            )}
        </div>
    );
}

export default GbSiteLife;
