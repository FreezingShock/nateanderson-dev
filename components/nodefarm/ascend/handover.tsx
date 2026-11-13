"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
    ARC_MATS, arcGateNeed, FEATURE_NAME, FW, FW_SECS, HAND_BASE, PREINSTALLED, HAND_TUNE, PROTOS, canSwitchProto, droneFx, fmt, fmtTime, fwNode, fwNodeOpen, fwTotals, fwVis, handFx, handKeeps, handOpen, isUnlocked,
    chOff, keysOnHandover, masteryRanks, protoDef, protoRank, ROMAN, statDef, treeCount, treeSpent, type ProtoId, type State,
} from "@/lib/nodefarm/engine";
import { NfIcon } from "../board/icon";
import type { TreeModel } from "../tree/tree";
import "@/app/camino/nodefarm/handover.css";

/**
 * Handover window (the reset past Ascend) and the Firmware tree model. Once Origin is producing you can hand node-01 to the
 * next operator: the run, AP, perks, the prestige tree, Drones and the lab's Intel and stock are wiped; Keys come back and
 * buy Firmware, which changes how every later run plays. You pick the protocol the next operator runs and can leave them
 * a note. Rules: the Handover section of lib/nodefarm/engine.ts. Styles: app/camino/nodefarm/handover.css (nf-hx*).
 * Rows carry data-cx-i for the shared code-reveal primitive (lib/nodefarm/cx.ts).
 */
export const ROOT_GREEN = "#3dff6e";
const HOLD_MS = 1600;
const FRAMES = 4;

/** The Firmware tree as a model for the shared tree menu (green phosphor "root" skin). */
export function fwModel(s: State): TreeModel {
    return {
        theme: "root", title: "handover // firmware", label: "Firmware tree", nodes: FW, sections: FW_SECS, owned: s.hand.fw, wallet: s.hand.keys, unit: "Keys",
        open: (n) => fwNodeOpen(s, fwNode(n.id)), vis: (n) => fwVis(s, fwNode(n.id)), totals: () => fwTotals(s), totalsLabel: "Firmware gives",
        keptNote: "kept through every Handover", buyWord: "Flash", prompt: "root@node0:/fw#", respec: true, fitMin: [0.34, 0.5],
        spent: () => s.hand.fw.reduce((a, id) => a + fwNode(id).cost, 0),
        fogText: "Unsigned firmware. Flash a node next to it to read this one.",
        core: { kicker: "node.zero", name: "Node zero", fx: "Keys from every Handover flash Firmware here. Firmware is kept through every Handover and changes how each later run plays. Respec is free and refunds every Key.", quote: "One small box and one wire. It remembers you.", color: ROOT_GREEN },
    };
}

/** How many Firmware nodes you could flash right now. */
export const fwReady = (s: State) => FW.filter((n) => !s.hand.fw.includes(n.id) && fwNodeOpen(s, n) && s.hand.keys >= n.cost).length;

/** Press and hold to hand over. A click with no press behind it (screen readers) asks twice instead. */
function HoldHandover({ ready, keys, locked, onGo }: { ready: boolean; keys: number; locked: boolean; onGo: () => void }) {
    const [hold, setHold] = useState(false);
    const [nudge, setNudge] = useState(false);
    const [ask, setAsk] = useState(false);
    const t = useRef<number | undefined>(undefined);
    const started = useRef(0);
    const keyed = useRef(false);
    const fired = useRef(false);
    const stop = (done = false) => {
        window.clearTimeout(t.current);
        t.current = undefined;
        if (!done && started.current && performance.now() - started.current < HOLD_MS) {
            setNudge(true);
            window.setTimeout(() => setNudge(false), 1600);
        }
        started.current = 0;
        setHold(false);
    };
    const start = () => {
        if (!ready || t.current) return;
        fired.current = false;
        started.current = performance.now();
        setHold(true);
        setNudge(false);
        t.current = window.setTimeout(() => { fired.current = true; stop(true); onGo(); }, HOLD_MS);
    };
    useEffect(() => () => window.clearTimeout(t.current), []);
    return (
        <button
            type="button"
            className="nf-hx-go"
            disabled={!ready}
            data-hold={hold ? "" : undefined}
            style={{ ["--hold" as string]: `${HOLD_MS}ms` } as CSSProperties}
            onPointerDown={(e) => { if (e.button === 0) { e.currentTarget.setPointerCapture?.(e.pointerId); start(); } }}
            onPointerUp={() => stop()}
            onPointerCancel={() => stop()}
            onLostPointerCapture={() => { if (t.current) stop(); }}
            onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); keyed.current = true; start(); } }}
            onKeyUp={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); keyed.current = false; if (t.current) stop(); } }}
            onBlur={() => { if (t.current) stop(); setAsk(false); }}
            onContextMenu={(e) => e.preventDefault()}
            onClick={(e) => {
                if (e.detail !== 0 || keyed.current || fired.current || !ready) return;
                if (ask) { setAsk(false); onGo(); } else { setAsk(true); window.setTimeout(() => setAsk(false), 4000); }
            }}
        >
            <i className="nf-hx-go-fill" aria-hidden="true" />
            <span className="nf-hx-go-t">
                {locked ? "Locked until you leave the test" : !ready ? "Reach node zero first" : ask ? `Confirm: hand over for ${keys} Keys` : hold ? "Keep holding" : nudge ? "Keep holding to hand over" : `Hold to hand over · +${keys} Keys`}
            </span>
        </button>
    );
}

/** The banner: the Root Chamber, node zero and a turning key, with the cycle readout. */
function Stage({ s, keys }: { s: State; keys: number }) {
    const ready = keys > 0;
    const zone = isUnlocked(s, "origin") ? "ROOT CHAMBER" : isUnlocked(s, "engrams") ? "ORIGIN ARC" : "DEEP SPACE";
    const cycle = s.hand.count + 1;
    return (
        <section className="nf-hx-stage" data-cx-i="0" data-ready={ready ? "" : undefined} aria-label="Node zero">
            <div className="nf-hx-art" aria-hidden="true" style={{ ["--frames" as string]: FRAMES } as CSSProperties}><i className="nf-hx-scan" /></div>
            <div className="nf-hx-code" aria-hidden="true">
                <span>HANDOVER.SYS // NODE-00 // CYCLE {String(cycle).padStart(2, "0")}</span>
                <span><b>zone</b> {zone}</span>
                <span><b>origin</b> {fmt(s.origin)} · {fmt(s.prod.origin)} producers</span>
                <span><b>status</b> <em data-st={ready ? "ready" : "lock"}>{ready ? "READY TO HAND OVER" : "LOCKED"}</em></span>
            </div>
        </section>
    );
}

/** Reach node zero -> hand over -> flash Firmware, as three data steps, with the hold button. */
function Flow({ s, keys, onGo }: { s: State; keys: number; onGo: () => void }) {
    const open = handOpen(s);
    const nodes = treeCount(s);
    const fwOwned = s.hand.fw.length;
    // zones this Handover opens (ARC_GATE): two at a time, so each early Handover has something new to climb to
    const opens = ARC_MATS.filter((m) => arcGateNeed(m) === s.hand.count + 1).map((m) => statDef(m).name);
    return (
        <section className="nf-hx-flow" data-cx-i="1">
            <ol className="nf-hx-steps" data-ready={open ? "" : undefined}>
                <li style={{ ["--c" as string]: statDef("origin").color }}>
                    <span className="nf-hx-k" data-cx-scr="">01 // Reach node zero</span>
                    <span className="nf-hx-v"><NfIcon name="origin" /><b>{fmt(s.prod.origin)}</b><small>/ {HAND_TUNE.needProd} Origin producer</small></span>
                    <small className="nf-hx-n">{open ? "Origin is running. Node zero is listening." : isUnlocked(s, "origin") ? "Buy one Origin button in the Root Chamber." : "Open the Root Chamber, zone 17, at the end of the Origin arc."}</small>
                </li>
                <li style={{ ["--c" as string]: "#ffc53a" }}>
                    <span className="nf-hx-k" data-cx-scr="">02 // Hand over</span>
                    <span className="nf-hx-v"><b>{keys > 0 ? `+${keys}` : "0"}</b><small>Keys</small></span>
                    <small className="nf-hx-n">From {nodes} tree nodes and ranks, plus {fmt(s.origin)} Origin.{handFx(s).keys ? ` Keysmith x${fmt(1 + handFx(s).keys)}.` : ""}{opens.length ? ` Unlocks ${opens.join(" and ")} once you climb back.` : ""}</small>
                </li>
                <li style={{ ["--c" as string]: ROOT_GREEN }}>
                    <span className="nf-hx-k" data-cx-scr="">03 // Flash firmware</span>
                    <span className="nf-hx-v"><b>{s.hand.keys}</b><small>Keys held · {fwOwned}/{FW.length} Firmware</small></span>
                    <small className="nf-hx-n">Firmware is kept through every Handover.</small>
                </li>
            </ol>
            <HoldHandover ready={keys > 0} keys={keys} locked={chOff(s, "prestige")} onGo={onGo} />
        </section>
    );
}

/** What goes and what stays, as two plain lists. */
function Ledger({ s }: { s: State }) {
    const kept = handKeeps(s).length;
    const baseMod = HAND_BASE.modKeep ?? 0;
    const modKeep = Math.max(baseMod, droneFx(s).modKeep);
    const back = Math.floor(treeSpent(s) * (HAND_BASE.apRefund ?? 0));
    const wipes = [
        "This run: every stat, button and producer",
        "AP and perks (half of every perk's levels stay)",
        `The prestige tree${kept ? ` (${kept} nodes stay: the entry and upper path of each section)` : ""}${back ? `, and ${fmt(back)} AP back, a quarter of what it cost` : ""}`,
        "Drones, Mounted drives and Exploit Lab Intel and stock",
        `Parts and mod levels in the hangar (${Math.round(modKeep * 100)}% stay${modKeep > baseMod ? ": Black box" : ""})`,
        "Rig levels (half of every level stays)",
    ];
    const keeps = [
        `Every Ascend after this starts with ${HAND_TUNE.warmReboots} Reboots, ${HAND_TUNE.bootProd} producers on CU to AE and a ${Math.round(HAND_TUNE.afterglow / 60)} minute Overclock, and keeps Intel, payloads and half the Drone levels`,
        `${PREINSTALLED.map((k) => FEATURE_NAME[k]).join(", ").replace(/, ([^,]*)$/, " and $1")} work without their tree nodes`,
        "Goals, secrets and operator logs",
        "Exploit Lab research",
        "Cleared stress test ranks",
        ...(s.auto?.own.length ? ["Scripts you have learned"] : []),
        ...(s.dr?.nodes.length || masteryRanks(s) ? ["The hangar: postings, mastery and the drone tree"] : []),
        "Rig switches and zone event history",
        "Lifetime stats and your Ascend count",
        "Keys, Firmware, protocol ranks and your notes",
    ];
    return (
        <section className="nf-hx-ledger" data-cx-i="3">
            <div><h4>Wipes</h4><ul>{wipes.map((x) => <li key={x}>{x}</li>)}</ul></div>
            <div><h4>Keeps</h4><ul>{keeps.map((x) => <li key={x}>{x}</li>)}</ul></div>
        </section>
    );
}

/** Pick the protocol the next operator runs (one of the four past operators), and the second one under Dual boot. */
function Protocols({ s, pick, pick2, onPick, onPick2 }: { s: State; pick: ProtoId; pick2: ProtoId | null; onPick: (id: ProtoId) => void; onPick2: (id: ProtoId | null) => void }) {
    const dual = handFx(s).dual;
    const live = canSwitchProto(s);
    const running = s.hand.proto;
    return (
        <section className="nf-hx-proto" data-cx-i="2">
            <header className="nf-sys-h" data-path="handover/protocol">
                <h3>Protocol</h3>
                <p>
                    {s.hand.count === 0 ? "The next operator runs one of the old operators' protocols for the whole cycle. Pick it before you hand over." : live ? "Operator's desk: a change takes effect at once." : "Your pick takes effect at the next Handover."}
                    {running ? ` Running now: ${protoDef(running).op}, ${protoDef(running).name}.` : ""}
                    {" "}Hand over on a protocol and it ranks up (I to III), each rank 25% stronger.
                </p>
            </header>
            <div className="nf-hx-ops" role="radiogroup" aria-label="Protocol">
                {PROTOS.map((p) => {
                    const on = pick === p.id;
                    const rk = protoRank(s, p.id);
                    return (
                        <button key={p.id} type="button" role="radio" aria-checked={on} className="nf-hx-op" data-run={running === p.id ? "" : undefined} style={{ ["--c" as string]: p.color } as CSSProperties} onClick={() => onPick(p.id)}>
                            <span className="nf-hx-op-k">{p.op.toUpperCase()} // {running === p.id ? "RUNNING" : on ? "PICKED" : "PROTOCOL"}</span>
                            <span className="nf-hx-rank" aria-label={`Rank ${rk} of ${HAND_TUNE.rankMax}`}>{Array.from({ length: HAND_TUNE.rankMax }, (_, i) => <i key={i} data-on={i < rk ? "" : undefined} />)}<small>{rk ? `RANK ${ROMAN[rk]} · x${(1 + HAND_TUNE.rankStep * rk).toFixed(2)}` : "UNRANKED"}</small></span>
                            <b>{p.name}</b>
                            <span className="nf-hx-op-fx">{p.blurb}</span>
                            <q>{p.flavor}</q>
                        </button>
                    );
                })}
            </div>
            {dual && (
                <div className="nf-hx-dual" role="radiogroup" aria-label="Second protocol, Dual boot">
                    <span className="nf-hx-k">Dual boot // second protocol at half strength</span>
                    {PROTOS.filter((p) => p.id !== pick).map((p) => (
                        <button key={p.id} type="button" role="radio" aria-checked={pick2 === p.id} className="nf-mini" style={{ ["--c" as string]: p.color }} onClick={() => onPick2(pick2 === p.id ? null : p.id)}>{p.op}</button>
                    ))}
                </div>
            )}
        </section>
    );
}

/** The way into the Firmware tree. */
function Gateway({ s, onFirmware }: { s: State; onFirmware: () => void }) {
    const ready = fwReady(s);
    return (
        <section className="nf-hx-gate" data-cx-i="4">
            <header className="nf-sys-h" data-path="handover/firmware">
                <h3>Firmware</h3>
                <p>{FW.length} new rules in {["one", "two", "three", "four", "five"][FW_SECS.length - 1]} sections, flashed with Keys. {s.hand.keys} Keys held{ready ? `, ${ready} ready to flash` : ""}.</p>
            </header>
            <button type="button" className="nf-hx-portal" onClick={onFirmware} aria-label="Open the Firmware tree" disabled={s.hand.count === 0 && s.hand.keys === 0} title={s.hand.count === 0 && s.hand.keys === 0 ? "Your first Handover pays the Keys" : undefined}>
                <span className="nf-hx-glass" aria-hidden="true"><i data-l="0" /><i data-l="1" /><i className="nf-hx-glass-core" /></span>
                <span className="nf-hx-pc" aria-hidden="true">
                    <span className="nf-hx-pk">FIRMWARE // {s.hand.fw.length}/{FW.length} FLASHED // {s.hand.keys} KEYS</span>
                    <ul className="nf-hx-secs">
                        {FW_SECS.map((b) => {
                            const mine = FW.filter((n) => n.branch === b.id);
                            return <li key={b.id} style={{ ["--c" as string]: b.color }}><b>{b.name}</b><small>{mine.filter((n) => s.hand.fw.includes(n.id)).length}/{mine.length}</small></li>;
                        })}
                    </ul>
                    <span className="nf-hx-cmd"><em>#</em> flash /firmware<i /></span>
                </span>
            </button>
        </section>
    );
}

/** The note for the next operator, and every note you left before. */
function Notes({ s, note, setNote }: { s: State; note: string; setNote: (v: string) => void }) {
    return (
        <section className="nf-hx-notes" data-cx-i="5">
            <header className="nf-sys-h" data-path="handover/note">
                <h3>Handover note</h3>
                <p>Optional. Every operator before you left one. Yours shows up here and in Records.</p>
            </header>
            <label className="nf-hx-field">
                <span className="nf-hx-k">note // for the next operator</span>
                <textarea value={note} maxLength={HAND_TUNE.noteMax} rows={2} placeholder="The coffee machine is on the left shelf." onChange={(e) => setNote(e.target.value)} />
                <small>{note.length}/{HAND_TUNE.noteMax}</small>
            </label>
            {s.hand.notes.length > 0 && (
                <ol className="nf-hx-log" aria-label="Your past notes">
                    {[...s.hand.notes].reverse().map((n) => (
                        <li key={`${n.n}-${n.at}`} style={{ ["--c" as string]: n.proto ? protoDef(n.proto).color : ROOT_GREEN } as CSSProperties}>
                            <span className="nf-hx-k">cycle {String(n.n).padStart(2, "0")}{n.proto ? ` // ${protoDef(n.proto).op}` : ""}</span>
                            <p>{n.text}</p>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}

export function HandoverPanel({ s, onHandover, onFirmware, onProto }: {
    s: State;
    onHandover: (proto: ProtoId, note: string, proto2: ProtoId | null) => void;
    onFirmware: () => void;
    /** change the running protocol (Operator's desk) */
    onProto: (id: ProtoId, second: boolean) => void;
}) {
    const [pick, setPick] = useState<ProtoId>(s.hand.proto ?? "wren");
    const [pick2, setPick2] = useState<ProtoId | null>(s.hand.proto2);
    const [note, setNote] = useState("");
    const keys = keysOnHandover(s);
    const live = canSwitchProto(s);
    const cycleFor = s.life.secs - s.hand.cycleAt;
    return (
        <div className="nf-sys nf-hx">
            <Stage s={s} keys={keys} />
            <Flow s={s} keys={keys} onGo={() => { onHandover(pick, note, pick2); setNote(""); }} />
            <Protocols
                s={s}
                pick={pick}
                pick2={pick2}
                onPick={(id) => { setPick(id); if (pick2 === id) setPick2(null); if (live) onProto(id, false); }}
                onPick2={(id) => { setPick2(id); if (live && id) onProto(id, true); }}
            />
            <Ledger s={s} />
            <Gateway s={s} onFirmware={onFirmware} />
            <Notes s={s} note={note} setNote={setNote} />
            {s.hand.count > 0 && (
                <p className="nf-hx-foot" data-cx-i="6">
                    {s.hand.count} Handover{s.hand.count > 1 ? "s" : ""} done · {s.hand.keysTotal} Keys earned · this cycle {fmtTime(cycleFor)} and {fmt(s.hand.cycleAp)} AP
                </p>
            )}
        </div>
    );
}
