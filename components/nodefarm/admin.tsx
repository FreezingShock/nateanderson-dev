"use client";

import { memo, useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
    BRANCHES, GOALS, GOAL_TIERS, MATS, PERKS, SECRETS, TIERS, TIER_NAMES, TREE, TREE_FULL, apOnAscend, adminFlags, derive, droneMax, exportSave, fmt, fmtTime, fresh, parseSave, statDef, treeFx,
    STATS, isUnlocked, type MatId, type State, type StatId,
} from "@/lib/nodefarm/engine";
import { ZONE_EVENTS, ensureZe, zeClear, zeStart, zoneLabel } from "@/lib/nodefarm/zoneevents";
import {
    ARMABLE, RESOURCES, addKeys, addStat, forceHandover, maxProtoRanks, ownAllFw, clearLab, clearLogs, clearPerks, dropSnap, forceAscend, grantGoals, grantLab, grantLogs, grantSecrets, jumpEra, maxDrones, maxOut, maxPerks, overwrite, ownAllNodes, parseAmount, refundTree,
    forgetScript, forgetScripts, grantScripts, scriptCount, teachScript, revokeGoals, setAP, setDrone, setPerk, setProd, setStat, skipTime, snapState, snaps, takeSnap, toggleNode, toggleSecret, type Snap,
} from "@/lib/nodefarm/admin";
import { SCRIPTS, isOn, setRunning } from "@/lib/nodefarm/scripts";
import { EVENTS, type EventKind } from "@/lib/nodefarm/events";
import { ERAS } from "@/lib/nodefarm/scenery";
import { LOGS } from "@/lib/nodefarm/story";
import { codeReveal, cxClear } from "@/lib/nodefarm/cx";
import { RIGS, clearRigs, fillRigs, maxRigs, rigLine } from "@/lib/nodefarm/rigs";

// Node Farm admin panel ("root console"): a full-screen operator console opened by `nf admin on` in the naOS console.
// Plain bracket panels with data lines, no tabs or chips. Sections fold with the shared code reveal. Styles:
// app/camino/nodefarm-admin.css (classes nf-ad*). Pure rules live in lib/nodefarm/admin.ts. The panel reads the live
// game through `host.get()` and calls `host.changed()` after every edit so the game redraws and saves.

export interface AdminHost {
    get: () => State;
    changed: () => void;
    log: (text: string, tone?: "good" | "warn" | "hot") => void;
    getSpeed: () => number;
    setSpeed: (n: number) => void;
    /** show the offline report for this many seconds away without banking anything */
    previewAway: (secs: number) => void;
    fire: (kind: EventKind) => void;
    close: () => void;
    exit: () => void;
}

const ago = (ms: number) => {
    const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`;
};
const SPEEDS = [1, 2, 5, 10, 50, 100];
const SKIPS: [string, number][] = [["1m", 60], ["10m", 600], ["1h", 3600], ["8h", 28800], ["24h", 86400], ["7d", 604800]];

function Btn({ children, onClick, on, danger, wide, disabled, title }: { children: ReactNode; onClick: () => void; on?: boolean; danger?: boolean; wide?: boolean; disabled?: boolean; title?: string }) {
    return (
        <button type="button" className="nf-ad-b" aria-pressed={on === undefined ? undefined : on} data-danger={danger ? "" : undefined} data-wide={wide ? "" : undefined} disabled={disabled} title={title} onClick={onClick}>
            {children}
        </button>
    );
}

/** A section: a header line that folds, and a body that prints in and deletes out with the shared code reveal. */
function Sec({ n, title, hint, open, onToggle, children }: { n: number; title: string; hint: string; open: boolean; onToggle: () => void; children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    const [shown, setShown] = useState(open);
    const first = useRef(true);
    const openRef = useRef(open);
    openRef.current = open;
    useEffect(() => {
        if (first.current) { first.current = false; return; }
        if (open) {
            setShown(true);
            requestAnimationFrame(() => codeReveal(ref.current, { bare: true, rows: ":scope > *", ms: 260 }));
        } else if (ref.current) {
            codeReveal(ref.current, { dir: "out", bare: true, rows: ":scope > *", ms: 200 }).then(() => { if (!openRef.current) setShown(false); });
        }
    }, [open]);
    return (
        <section className="nf-ad-sec" data-cx-i={n} data-open={open ? "" : undefined}>
            <button type="button" className="nf-ad-sh" aria-expanded={open} onClick={onToggle}>
                <span className="nf-ad-n">{String(n).padStart(2, "0")}</span>
                <b>{title}</b>
                <em>{hint}</em>
                <i aria-hidden="true">{open ? "−" : "+"}</i>
            </button>
            {shown && <div className="nf-ad-sb" ref={ref}>{children}</div>}
        </section>
    );
}

/** One number line: name, value, a box that takes 1e9 or 5M, and set / add / x10 / zero. */
function NumRow({ name, color, value, onSet, onAdd, onMul, suffix }: { name: string; color: string; value: number; onSet: (v: number) => void; onAdd: (v: number) => void; onMul?: (k: number) => void; suffix?: string }) {
    const box = useRef<HTMLInputElement>(null);
    const [bad, setBad] = useState(false);
    const take = (f: (v: number) => void) => {
        const v = parseAmount(box.current?.value ?? "");
        if (v === null) { setBad(true); return; }
        setBad(false);
        f(v);
    };
    return (
        <div className="nf-ad-nr" style={{ ["--c" as string]: color } as CSSProperties}>
            <span className="nf-ad-k"><i />{name}</span>
            <b className="nf-ad-v">{fmt(value)}{suffix ? <small>{suffix}</small> : null}</b>
            <span className="nf-ad-ctl">
                <input ref={box} className="nf-ad-in" data-bad={bad ? "" : undefined} placeholder="1e9 · 5M" aria-label={`${name} amount`} inputMode="text" autoCapitalize="off" autoCorrect="off" spellCheck={false} enterKeyHint="done" onKeyDown={(e) => { if (e.key === "Enter") take(onSet); e.stopPropagation(); }} />
                <Btn onClick={() => take(onSet)}>Set</Btn>
                <Btn onClick={() => take(onAdd)}>Add</Btn>
                {onMul && <Btn onClick={() => onMul(10)}>×10</Btn>}
                <Btn onClick={() => onSet(0)}>Zero</Btn>
            </span>
        </div>
    );
}

/** − level / max + */
function Step({ name, color, lvl, max, note, onSet }: { name: string; color?: string; lvl: number; max: number; note?: string; onSet: (n: number) => void }) {
    return (
        <div className="nf-ad-st" style={{ ["--c" as string]: color ?? "var(--ad)" } as CSSProperties}>
            <span className="nf-ad-k"><i />{name}</span>
            <span className="nf-ad-lv"><button type="button" className="nf-ad-x" aria-label={`${name} down`} onClick={() => onSet(lvl - 1)}>−</button><b>{lvl}<small> / {max}</small></b><button type="button" className="nf-ad-x" aria-label={`${name} up`} onClick={() => onSet(lvl + 1)}>+</button></span>
            <Btn onClick={() => onSet(0)}>0</Btn>
            <Btn onClick={() => onSet(max)}>Max</Btn>
            {note && <small className="nf-ad-note">{note}</small>}
        </div>
    );
}

const GEO_KEY = "nf-admin-ui-v1"; // window position, size and minimized state (per device)
interface Geo { x: number; y: number; w: number; h: number; min: boolean }
function clampGeo(g: Geo): Geo {
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = Math.round(Math.max(300, Math.min(g.w, vw - 8)));
    const h = Math.round(Math.max(240, Math.min(g.h, vh - 8)));
    const bh = g.min ? 44 : h;
    return { min: g.min, w, h, x: Math.round(Math.max(4, Math.min(g.x, vw - w - 4))), y: Math.round(Math.max(4, Math.min(g.y, vh - bh - 4))) };
}
function loadGeo(): Geo {
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = Math.min(400, vw - 16), h = Math.min(560, vh - 120);
    const def: Geo = { x: vw - w - 16, y: vw < 700 ? Math.max(60, vh - h - 70) : 72, w, h, min: false };
    try { const o = JSON.parse(localStorage.getItem(GEO_KEY) ?? "null"); if (o && [o.x, o.y, o.w, o.h].every(Number.isFinite)) return clampGeo({ ...o, min: !!o.min }); } catch {}
    return clampGeo(def);
}

function AdminPanelInner({ host }: { host: AdminHost }) {
    const root = useRef<HTMLDivElement>(null);
    const [, rev] = useState(0);
    const [note, setNote] = useState("> root console ready");
    const [openSec, setOpenSec] = useState<Record<string, boolean>>(() => {
        return { grant: true, time: false, run: false, snap: false, res: false, prod: false, tree: false, perks: false, goals: false };
    });
    const [speed, setSpeedState] = useState(host.getSpeed());
    const [reveal, setReveal] = useState(adminFlags.reveal);
    const [confirm, setConfirm] = useState<"" | "wipe" | "exit">("");
    const [snapList, setSnapList] = useState<Snap[]>(() => snaps());
    const [io, setIo] = useState("");
    const labelBox = useRef<HTMLInputElement>(null);
    const s = host.get();
    const d = derive(s);

    useEffect(() => { const iv = setInterval(() => rev((n) => n + 1), 600); return () => clearInterval(iv); }, []);

    // ---- the window: a small floating panel you can drag, resize and minimize. Position and size are kept per device.
    const scrollEl = useRef<HTMLDivElement>(null);
    const [geo, setGeo] = useState<Geo>(() => loadGeo());
    const geoRef = useRef(geo);
    geoRef.current = geo;
    const commit = useCallback((g: Geo) => {
        const c = clampGeo(g);
        geoRef.current = c;
        setGeo(c);
        try { localStorage.setItem(GEO_KEY, JSON.stringify(c)); } catch {}
    }, []);
    // open: the CRT switch-on; close: it switches off, then the panel unmounts (the "root" tab brings it back)
    const closing = useRef(false);
    useEffect(() => {
        const el = root.current;
        cxClear(el);
        codeReveal(el, { dir: "in", style: "crt", rows: ":scope [data-cx-i]" });
    }, []);
    const close = useCallback(() => {
        if (closing.current) return;
        closing.current = true;
        codeReveal(root.current, { dir: "out", style: "crt", rows: ":scope [data-cx-i]" }).then(host.close);
    }, [host]);
    const minimize = useCallback(() => {
        const sc = scrollEl.current;
        const g = geoRef.current;
        if (g.min) {
            commit({ ...g, min: false });
            requestAnimationFrame(() => codeReveal(scrollEl.current, { bare: true, rows: ":scope [data-cx-i]", ms: 240 }));
        } else {
            codeReveal(sc, { dir: "out", bare: true, rows: ":scope [data-cx-i]", ms: 180 }).then(() => { cxClear(sc); commit({ ...geoRef.current, min: true }); });
        }
    }, [commit]);
    useEffect(() => {
        const onAdmin = (e: Event) => { const d = (e as CustomEvent<{ open?: boolean }>).detail; if (d?.open && geoRef.current.min) minimize(); };
        const onResize = () => commit(geoRef.current);
        window.addEventListener("nf:admin", onAdmin);
        window.addEventListener("resize", onResize);
        return () => { window.removeEventListener("nf:admin", onAdmin); window.removeEventListener("resize", onResize); };
    }, [minimize, commit]);
    const drag = (e: RPointerEvent, mode: "move" | "size") => {
        if ((e.pointerType === "mouse" && e.button !== 0) || (e.target as HTMLElement).closest("button")) return;
        const el = root.current;
        if (!el) return;
        e.preventDefault();
        const start = { px: e.clientX, py: e.clientY, ...geoRef.current };
        let cur: Geo = start;
        const move = (ev: PointerEvent) => {
            const dx = ev.clientX - start.px, dy = ev.clientY - start.py;
            cur = clampGeo(mode === "move" ? { ...start, x: start.x + dx, y: start.y + dy } : { ...start, w: start.w + dx, h: start.h + dy });
            el.style.left = `${cur.x}px`; el.style.top = `${cur.y}px`; el.style.width = `${cur.w}px`;
            if (!cur.min) el.style.height = `${cur.h}px`;
        };
        const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); el.removeAttribute("data-drag"); commit(cur); };
        el.setAttribute("data-drag", mode);
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
    };

    const [zeZone, setZeZone] = useState<StatId>("copper");
    const act = (fn: (s: State) => void | string, msg: string) => {
        const r = fn(host.get());
        host.changed();
        setNote(`> ${typeof r === "string" ? r : msg}`);
        rev((n) => n + 1);
    };
    const toggle = (k: string) => setOpenSec((o) => ({ ...o, [k]: !o[k] }));
    const sec = (k: string) => ({ open: !!openSec[k], onToggle: () => toggle(k) });
    const taken = snapList.find((x) => x.real);

    const treeOwned = s.tree.length;
    const goalN = GOALS.filter((g) => s.ach.includes(g.id)).length;
    const secretN = SECRETS.filter((x) => s.ach.includes(x.id)).length;
    const gain = apOnAscend(s);

    return createPortal(
        <div className="ctos nf-ad-host">
            <div className="nf-ad" ref={root} role="region" aria-label="Node Farm root console" data-min={geo.min ? "" : undefined} style={{ left: geo.x, top: geo.y, width: geo.w, height: geo.min ? undefined : geo.h }}>
                <header className="nf-ad-bar" onPointerDown={(e) => drag(e, "move")} onDoubleClick={minimize}>
                    <span className="nf-ad-bt">naOS // root console</span>
                    <span className="nf-ad-arm" aria-live="polite"><i />armed</span>
                    <button type="button" className="nf-ad-bb" onClick={minimize} aria-label={geo.min ? "Expand the root console" : "Minimize the root console"} aria-expanded={!geo.min}><i data-min={geo.min ? "" : undefined} /></button>
                    <button type="button" className="nf-ad-bb nf-ad-close" onClick={close} aria-label="Hide the root console"><i /></button>
                </header>
                <div className="nf-ad-scroll" ref={scrollEl}>
                    <div className="nf-ad-wrap">
                        {/* banner: code readout over dither */}
                        <div className="nf-ad-stage" data-cx-i={0}>
                            <i className="nf-ad-dith" aria-hidden="true" />
                            <i className="nf-ad-scan" aria-hidden="true" />
                            <div className="nf-ad-code">
                                <span className="nf-ad-ps" data-cx-scr="">root@node-01:~#<u aria-hidden="true" /></span>
                                <span><b>save</b><em>{taken ? `real save stored ${ago(taken.at)}` : "no snapshot yet"}</em></span>
                                <span><b>tree</b><em>{treeOwned}/{TREE_FULL} nodes · {fmt(s.ap)} AP · ×{fmt(d.global)}</em></span>
                                <span><b>clock</b><em>×{speed} speed · fog {reveal ? "off" : "on"}</em></span>
                                <span className="nf-ad-last">{note}</span>
                            </div>
                        </div>

                        <div className="nf-ad-cols">
                            <div className="nf-ad-col">
                                <Sec n={1} title="Grant" hint="one click each" {...sec("grant")}>
                                    <button type="button" className="nf-ad-go" onClick={() => act(maxOut, "everything granted: tree, perks, Drones, goals, secrets, logs, lab, prestiges, materials")}>
                                        <i aria-hidden="true" />
                                        <span>Max out everything</span>
                                        <small>{TREE_FULL} tree nodes · every perk · Drones · goals · secrets · logs · lab · scripts · all materials</small>
                                    </button>
                                    <div className="nf-ad-grid">
                                        <Btn onClick={() => act(ownAllNodes, "every tree node owned")}>Own every tree node</Btn>
                                        <Btn onClick={() => act((x) => { refundTree(x); }, "tree cleared, AP refunded")}>Clear tree, refund AP</Btn>
                                        <Btn onClick={() => act(maxPerks, "every perk maxed")}>Max every perk</Btn>
                                        <Btn onClick={() => act(clearPerks, "perks cleared")}>Clear perks</Btn>
                                        <Btn onClick={() => act(maxDrones, "Drones maxed and armed")}>Max Drones, arm all</Btn>
                                        <Btn onClick={() => act((x) => { grantGoals(x); grantSecrets(x); }, "every goal and secret done")}>Every goal and secret</Btn>
                                        <Btn onClick={() => act(grantLogs, "every story log recovered")}>Recover all logs</Btn>
                                        <Btn onClick={() => act(grantLab, "lab researched, Intel and stock filled")}>Research the whole lab</Btn>
                                        <Btn onClick={() => act(clearLab, "lab research cleared")}>Clear lab</Btn>
                                        <Btn on={reveal} onClick={() => { adminFlags.reveal = !adminFlags.reveal; setReveal(adminFlags.reveal); host.changed(); setNote(`> tree fog ${adminFlags.reveal ? "off" : "on"}`); }}>Reveal whole tree</Btn>
                                    </div>
                                </Sec>

                                <Sec n={2} title="Time" hint="speed, skip, offline" {...sec("time")}>
                                    <div className="nf-ad-line">
                                        <span className="nf-ad-k">Game speed</span>
                                        <span className="nf-ad-opts">{SPEEDS.map((v) => <Btn key={v} on={speed === v} onClick={() => { host.setSpeed(v); setSpeedState(v); setNote(`> game speed ×${v}`); }}>×{v}</Btn>)}</span>
                                    </div>
                                    <div className="nf-ad-line">
                                        <span className="nf-ad-k">Skip ahead</span>
                                        <span className="nf-ad-opts">{SKIPS.map(([l, secs]) => <Btn key={l} onClick={() => act((x) => `skipped ${l}: +${fmt(skipTime(x, secs))} Bytes`, `skipped ${l}`)}>+{l}</Btn>)}</span>
                                    </div>
                                    <div className="nf-ad-line">
                                        <span className="nf-ad-k">Preview report</span>
                                        <span className="nf-ad-opts">{([["1h", 3600], ["8h", 28800], ["24h", 86400]] as [string, number][]).map(([l, secs]) => <Btn key={l} onClick={() => host.previewAway(secs)}>{l} away</Btn>)}</span>
                                    </div>
                                    <p className="nf-ad-p">Skip runs the real rules without the offline cap. Preview shows the welcome-back report for that long away and banks nothing. Standby cap is {fmtTime(d.offlineCap)}.</p>
                                </Sec>

                                <Sec n={3} title="Run" hint="ascend, eras, events" {...sec("run")}>
                                    <div className="nf-ad-line">
                                        <span className="nf-ad-k">Ascend</span>
                                        <Btn onClick={() => act((x) => `ascended: +${forceAscend(x)} AP`, "forced an Ascend")}>Force Ascend now</Btn>
                                        <small className="nf-ad-note">{gain >= 1 ? `+${gain} AP available` : "adds the Aether it needs first"}</small>
                                    </div>
                                    <div className="nf-ad-line">
                                        <span className="nf-ad-k">Handover</span>
                                        <Btn onClick={() => act((x) => `handed over: +${forceHandover(x)} Keys`, "forced a Handover")}>Force Handover</Btn>
                                        <Btn onClick={() => act((x) => addKeys(x, 20), "+20 Keys")}>+20 Keys</Btn>
                                        <Btn onClick={() => act(ownAllFw, "every Firmware flashed")}>All Firmware</Btn>
                                        <Btn onClick={() => act(maxProtoRanks, "every protocol at rank III")}>Max ranks</Btn>
                                    </div>
                                    <div className="nf-ad-line">
                                        <span className="nf-ad-k">Overclock</span>
                                        <Btn onClick={() => act((x) => { x.overclock = 60; }, "overclock 60 s")}>60 s</Btn>
                                        <Btn onClick={() => act((x) => { x.overclock = 600; }, "overclock 10 min")}>10 min</Btn>
                                        <Btn onClick={() => act((x) => { x.overclock = 0; }, "overclock off")}>Off</Btn>
                                    </div>
                                    <div className="nf-ad-line">
                                        <span className="nf-ad-k">Quick-time event</span>
                                        <span className="nf-ad-opts">{EVENTS.map((e) => <Btn key={e.kind} onClick={() => { host.fire(e.kind); setNote(`> ${e.title} sent`); }}>{e.title}</Btn>)}</span>
                                    </div>
                                    <div className="nf-ad-line">
                                        <span className="nf-ad-k">Zone event</span>
                                        <select className="nf-ad-in" aria-label="Zone for the event" value={zeZone} onChange={(e) => setZeZone(e.target.value as StatId)} onKeyDown={(e) => e.stopPropagation()}>
                                            {STATS.filter((x) => isUnlocked(host.get(), x.id)).map((x) => <option key={x.id} value={x.id}>{zoneLabel(x.id)}</option>)}
                                        </select>
                                    </div>
                                    <div className="nf-ad-line">
                                        <span className="nf-ad-k" />
                                        <span className="nf-ad-opts">
                                            {ZONE_EVENTS.map((e) => <Btn key={e.kind} onClick={() => act((x) => { zeStart(x, e.kind, isUnlocked(x, zeZone) ? zeZone : "bytes"); }, `${e.title} on ${zoneLabel(zeZone)}`)}>{e.title}</Btn>)}
                                            <Btn onClick={() => act((x) => { zeClear(x); }, "zone events cleared")}>Clear</Btn>
                                            <Btn onClick={() => act((x) => { ensureZe(x).wait = 5; }, "next zone event in 5 s")}>Next in 5 s</Btn>
                                        </span>
                                    </div>
                                    <div className="nf-ad-line">
                                        <span className="nf-ad-k">Jump to era</span>
                                        <span className="nf-ad-opts">{ERAS.map((e, i) => <Btn key={e.name} onClick={() => act((x) => jumpEra(x, i), `era ${i + 1}: ${e.name} (materials after it emptied)`)}>{i + 1} {e.name}</Btn>)}</span>
                                    </div>
                                    <p className="nf-ad-p">Jumping opens every material up to that era and empties the ones after it. Snapshot first if that matters.</p>
                                </Sec>

                                <Sec n={4} title="Snapshots" hint="your real save is stored" {...sec("snap")}>
                                    <div className="nf-ad-line">
                                        <input ref={labelBox} className="nf-ad-in nf-ad-grow" placeholder="snapshot name" aria-label="Snapshot name" maxLength={40} autoCapitalize="off" spellCheck={false} onKeyDown={(e) => e.stopPropagation()} />
                                        <Btn onClick={() => { takeSnap(host.get(), labelBox.current?.value || "snapshot"); if (labelBox.current) labelBox.current.value = ""; setSnapList(snaps()); setNote("> snapshot saved"); }}>Take</Btn>
                                    </div>
                                    <ul className="nf-ad-list">
                                        {snapList.length === 0 && <li className="nf-ad-empty">no snapshots yet</li>}
                                        {snapList.map((x) => (
                                            <li key={x.id} data-real={x.real ? "" : undefined}>
                                                <span><b>{x.real ? "real save" : x.label}</b><small>{ago(x.at)}</small></span>
                                                <Btn onClick={() => { const n = snapState(x.id); if (!n) return setNote("> that snapshot would not load"); act((st) => overwrite(st, n), `restored ${x.real ? "your real save" : x.label}`); }}>Restore</Btn>
                                                {!x.real && <Btn onClick={() => { dropSnap(x.id); setSnapList(snaps()); }}>Delete</Btn>}
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="nf-ad-line">
                                        <Btn onClick={() => { const c = exportSave(host.get()); setIo(c); navigator.clipboard?.writeText(c).then(() => setNote("> save code copied")).catch(() => setNote("> save code below")); }}>Export code</Btn>
                                        <Btn onClick={() => { const n = parseSave(io); if (!n) return setNote("> that is not a save code"); act((st) => overwrite(st, n), "save imported"); }}>Import code</Btn>
                                        <Btn danger on={confirm === "wipe"} onClick={() => { if (confirm !== "wipe") { setConfirm("wipe"); setTimeout(() => setConfirm((c) => (c === "wipe" ? "" : c)), 3500); return; } setConfirm(""); act((st) => overwrite(st, fresh()), "save wiped (restore a snapshot to undo)"); }}>{confirm === "wipe" ? "Sure? Wipe" : "Wipe save"}</Btn>
                                    </div>
                                    <textarea className="nf-ad-in nf-ad-ta" value={io} onChange={(e) => setIo(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="paste a save code to import" aria-label="Save code" spellCheck={false} rows={2} />
                                    <div className="nf-ad-line">
                                        <Btn danger on={confirm === "exit"} onClick={() => { if (confirm !== "exit") { setConfirm("exit"); setTimeout(() => setConfirm((c) => (c === "exit" ? "" : c)), 3500); return; } host.exit(); }}>{confirm === "exit" ? "Sure? Leave admin" : "Leave admin mode"}</Btn>
                                        <small className="nf-ad-note">keeps the game as it is. nf admin restore real brings your real save back.</small>
                                    </div>
                                </Sec>
                            </div>

                            <div className="nf-ad-col">
                                <Sec n={5} title="Resources" hint="set or add any stat" {...sec("res")}>
                                    {RESOURCES.map((id) => {
                                        const def = statDef(id as StatId);
                                        return (
                                            <NumRow key={id} name={def.name} color={def.color} value={host.get()[id] as number}
                                                onSet={(v) => act((x) => setStat(x, id, v), `${def.name} set`)}
                                                onAdd={(v) => act((x) => addStat(x, id, v), `${def.name} added`)}
                                                onMul={(k) => act((x) => setStat(x, id, Math.max(1, (x[id] as number) * k)), `${def.name} ×${k}`)} />
                                        );
                                    })}
                                    <NumRow name="AP" color="#ff2d8a" value={s.ap} onSet={(v) => act((x) => setAP(x, v), "AP set")} onAdd={(v) => act((x) => setAP(x, x.ap + v), "AP added")} onMul={(k) => act((x) => setAP(x, Math.max(1, x.ap * k)), `AP ×${k}`)} />
                                </Sec>

                                <Sec n={6} title="Producers" hint="nodes per material" {...sec("prod")}>
                                    {MATS.map((m) => (
                                        <NumRow key={m} name={statDef(m).name} color={statDef(m).color} value={s.prod[m as MatId]} suffix=" nodes"
                                            onSet={(v) => act((x) => setProd(x, m as MatId, v), `${statDef(m).name} nodes set`)}
                                            onAdd={(v) => act((x) => setProd(x, m as MatId, x.prod[m as MatId] + v), `${statDef(m).name} nodes added`)}
                                            onMul={(k) => act((x) => setProd(x, m as MatId, Math.max(1, x.prod[m as MatId] * k)), `${statDef(m).name} nodes ×${k}`)} />
                                    ))}
                                </Sec>

                                <Sec n={7} title="Prestige tree" hint={`${treeOwned} / ${TREE_FULL} owned`} {...sec("tree")}>
                                    <div className="nf-ad-line">
                                        <Btn onClick={() => act(ownAllNodes, "every node owned")}>All</Btn>
                                        <Btn onClick={() => act((x) => { x.tree = []; x.mounts = []; }, "tree emptied (no refund)")}>None</Btn>
                                        <Btn onClick={() => act((x) => { refundTree(x); }, "tree cleared, AP refunded")}>None, refund AP</Btn>
                                    </div>
                                    {BRANCHES.map((b) => (
                                        <div className="nf-ad-br" key={b.id} style={{ ["--c" as string]: b.color } as CSSProperties}>
                                            <h4><i />{b.name}<small>{TREE.filter((n) => n.branch === b.id && s.tree.includes(n.id)).length}/{TREE.filter((n) => n.branch === b.id).length}</small></h4>
                                            <div className="nf-ad-nodes">
                                                {TREE.filter((n) => n.branch === b.id).map((n) => {
                                                    const own = s.tree.includes(n.id);
                                                    return (
                                                        <button key={n.id} type="button" className="nf-ad-node" aria-pressed={own} title={n.blurb} onClick={() => act((x) => { toggleNode(x, n.id); }, `${n.name} ${own ? "revoked" : "granted"}`)}>
                                                            <i aria-hidden="true" />
                                                            <span>{n.name}</span>
                                                            <small>{n.cost}</small>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </Sec>

                                <Sec n={8} title="Perks, Drones, mounts" hint="levels" {...sec("perks")}>
                                    {PERKS.map((p) => <Step key={p.id} name={p.name} lvl={s.perks[p.id]} max={p.max} onSet={(n) => act((x) => setPerk(x, p.id, n), `${p.name} level ${n}`)} />)}
                                    <p className="nf-ad-p">Drones, one per button tier. Max is {droneMax(s)} per tier with this tree.</p>
                                    {Array.from({ length: TIERS }, (_, k) => <Step key={k} name={`Drone tier ${k + 1}`} color="#6bffc9" lvl={s.drones[k]} max={droneMax(s)} onSet={(n) => act((x) => setDrone(x, k, n), `Drone tier ${k + 1} level ${n}`)} />)}
                                    <div className="nf-ad-line">
                                        <Btn on={s.armed.length >= ARMABLE.length} onClick={() => act((x) => { x.armed = x.armed.length >= ARMABLE.length ? [] : [...ARMABLE]; }, "Drone arming toggled")}>Arm every stat</Btn>
                                        <small className="nf-ad-note">{s.armed.length} of {ARMABLE.length} stats armed · {treeFx(s).mounts} mount slot{treeFx(s).mounts === 1 ? "" : "s"}</small>
                                    </div>
                                </Sec>

                                <Sec n={9} title="Goals, secrets, logs" hint={`${goalN}/${GOALS.length} · ${secretN}/${SECRETS.length} · ${s.logs.length}/${LOGS.length}`} {...sec("goals")}>
                                    <div className="nf-ad-line"><Btn onClick={() => act((x) => grantGoals(x), "every goal done")}>All goals</Btn><Btn onClick={() => act((x) => revokeGoals(x), "goals cleared")}>Clear goals</Btn></div>
                                    {Array.from({ length: GOAL_TIERS }, (_, i) => i + 1).map((t) => {
                                        const gs = GOALS.filter((g) => g.tier === t);
                                        const n = gs.filter((g) => s.ach.includes(g.id)).length;
                                        return (
                                            <div className="nf-ad-line" key={t}>
                                                <span className="nf-ad-k">{t} {TIER_NAMES[t]}</span>
                                                <b className="nf-ad-v">{n}/{gs.length}</b>
                                                <Btn onClick={() => act((x) => grantGoals(x, t), `tier ${t} done`)}>Grant</Btn>
                                                <Btn onClick={() => act((x) => revokeGoals(x, t), `tier ${t} cleared`)}>Revoke</Btn>
                                            </div>
                                        );
                                    })}
                                    <h4 className="nf-ad-h">Secrets</h4>
                                    <div className="nf-ad-nodes">
                                        {SECRETS.map((x) => {
                                            const on = s.ach.includes(x.id);
                                            return <button key={x.id} type="button" className="nf-ad-node" aria-pressed={on} onClick={() => act((st) => { toggleSecret(st, x.id); }, `${x.name} ${on ? "revoked" : "found"}`)}><i aria-hidden="true" /><span>{x.name}</span></button>;
                                        })}
                                    </div>
                                    <h4 className="nf-ad-h">Story logs</h4>
                                    <div className="nf-ad-line"><b className="nf-ad-v">{s.logs.length}/{LOGS.length}</b><Btn onClick={() => act(grantLogs, "every log recovered")}>Recover all</Btn><Btn onClick={() => act(clearLogs, "logs cleared")}>Clear</Btn></div>
                                </Sec>

                                <Sec n={10} title="Zone rigs" hint="one machine per zone" {...sec("rigs")}>
                                    <div className="nf-ad-grid">
                                        <Btn onClick={() => act(maxRigs, "every rig maxed and rewritten")}>Max every rig</Btn>
                                        <Btn onClick={() => act(fillRigs, "rig meters filled: cache, casts, growth, stillness, afterglow, storm, beacon")}>Fill rig meters</Btn>
                                        <Btn onClick={() => act(clearRigs, "rigs cleared")}>Clear rigs</Btn>
                                    </div>
                                    {RIGS.map((r) => <p key={r.zone} className="nf-ad-p">{rigLine(s, r.zone)}</p>)}
                                </Sec>

                                <Sec n={11} title="Scripts" hint={`${scriptCount(s)}/${SCRIPTS.length} learned`} {...sec("scripts")}>
                                    <div className="nf-ad-line">
                                        <Btn onClick={() => act(grantScripts, "every script learned (stopped)")}>Teach all</Btn>
                                        <Btn onClick={() => act((x) => { grantScripts(x); for (const sc of SCRIPTS) setRunning(x, sc.id, true); }, "every script learned and running")}>Teach all and run</Btn>
                                        <Btn onClick={() => act(forgetScripts, "scripts forgotten")}>Forget all</Btn>
                                    </div>
                                    {SCRIPTS.map((sc) => {
                                        const own = s.auto?.own.includes(sc.id) ?? false;
                                        const on = isOn(s, sc.id);
                                        return (
                                            <div className="nf-ad-line" key={sc.id}>
                                                <span className="nf-ad-k">{sc.file}</span>
                                                <b className="nf-ad-v">{own ? (on ? "running" : "stopped") : "not learned"}</b>
                                                <Btn on={own} onClick={() => act((x) => { if (own) forgetScript(x, sc.id); else teachScript(x, sc.id); }, `${sc.file} ${own ? "forgotten" : "learned"}`)}>{own ? "Forget" : "Teach"}</Btn>
                                                <Btn disabled={!own} on={on} onClick={() => act((x) => { setRunning(x, sc.id, !on); }, `${sc.file} ${on ? "stopped" : "running"}`)}>{on ? "Stop" : "Run"}</Btn>
                                            </div>
                                        );
                                    })}
                                </Sec>
                            </div>
                        </div>
                        <p className="nf-ad-foot">admin mode is on this device only. nf admin off hides it. nf admin restore real returns your real save.</p>
                    </div>
                </div>
                <i className="nf-ad-rz" onPointerDown={(e) => drag(e, "size")} aria-hidden="true" />
            </div>
        </div>,
        document.body,
    );
}

export const AdminPanel = memo(AdminPanelInner);
