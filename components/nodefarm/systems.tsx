"use client";

import { backupLine, type Backup } from "@/lib/nodefarm/backups";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { PixelIcon } from "@/components/cm/pixel-icons";
import { codeReveal } from "@/lib/nodefarm/cx";
import { GOALS, GOAL_TIERS, SECRETS, TIER_NAMES, TUNE, fmt, fmtTime, goalDone, tiersDone, type Goal, type NumFmt, type State } from "@/lib/nodefarm/engine";
import { goalCounts, recordSections } from "@/lib/nodefarm/records";
import { LOGS, logNo } from "@/lib/nodefarm/story";
import { NfIcon } from "./icon";
import { SettingsFrame } from "./settings";
import { DataLines, Frame, HoldButton, WinBanner } from "./win-kit";

// Goals, Records and Menu windows (rebuilt 2026-11-12): art banner, bracket frames, data lines. Shared parts in ./win-kit.
// Styles: app/camino/nodefarm-windows.css. Rows carry data-cx-i so the window's code reveal prints them in order.

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const TIER_COLOR = ["", "#2fd8e8", "#b6f04a", "#f0a53c", "#ff2d8a", "#f4f4f2", "#ffc53a", "#9a7bff", "#3dff6e", "#ff9a3c", "#4ad0ff", "#6bffc9", "#a5ff3d"];
const SECRET_COLOR = "#9a7bff";
const stamp = (ms?: number) => {
    if (!ms) return "done";
    const d = new Date(ms);
    return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${d.toTimeString().slice(0, 5)}`;
};
const bonusNow = (s: State) => ((1 + s.ach.length * TUNE.achBonus) * (1 + tiersDone(s) * TUNE.tierBonus) - 1) * 100;

// ---------------------------------------------------------------------------------------------------------------------
// Goals: each tier is a circuit rail of badge nodes that light up when done. The line under the rail reads out one goal:
// the one under the pointer, else the one you tapped, else the next one to do in that tier.

function goalProg(s: State, g: Goal) {
    const first = g.target < 1;
    const cur = first ? (g.cur(s) > 0 ? 1 : 0) : Math.min(g.cur(s), g.target);
    const tgt = first ? 1 : g.target;
    return { cur, tgt, frac: Math.min(1, cur / tgt) };
}

type RailItem = { id: string; name: string; text: string; icon: Goal["icon"]; done: boolean; frac: number; count: string; at?: number };

function Rail({ items, color, label, i }: { items: RailItem[]; color: string; label: string; i: number }) {
    const [hover, setHover] = useState<string | null>(null);
    const [pick, setPick] = useState<string | null>(null);
    const next = items.find((x) => !x.done) ?? items[items.length - 1];
    const shown = items.find((x) => x.id === (hover ?? pick)) ?? next;
    const lit = items.filter((x) => x.done).length;
    return (
        <div className="nf-wk-rail" data-cx-i={i} style={{ ["--c" as string]: color, ["--n" as string]: items.length, ["--lit" as string]: lit } as CSSProperties}>
            <ol className="nf-wk-nodes" aria-label={label}>
                {items.map((x) => (
                    <li key={x.id} data-done={x.done ? "" : undefined} data-next={x === next && !x.done ? "" : undefined} data-on={x === shown ? "" : undefined}>
                        <button
                            type="button"
                            aria-pressed={x === shown}
                            aria-label={`${x.name}: ${x.done ? "done" : x.count}`}
                            onPointerEnter={(e) => { if (e.pointerType === "mouse") setHover(x.id); }}
                            onPointerLeave={(e) => { if (e.pointerType === "mouse") setHover(null); }}
                            onFocus={() => setPick(x.id)}
                            onClick={() => setPick(x.id)}
                        >
                            <NfIcon name={x.icon} />
                            <span className="nf-wk-ring" aria-hidden="true"><i style={{ height: `${x.frac * 100}%` }} /></span>
                            {x.done && <span className="nf-wk-tick" aria-hidden="true"><PixelIcon name="check" size={12} /></span>}
                        </button>
                    </li>
                ))}
            </ol>
            <p className="nf-wk-read" aria-live="polite">
                <span className="nf-wk-read-k">{shown.done ? "[done]" : shown === next ? "[next]" : "[ -- ]"}</span>
                <b>{shown.name}</b>
                <span className="nf-wk-read-t">{shown.text}</span>
                <em>{shown.done ? stamp(shown.at) : shown.count}</em>
            </p>
        </div>
    );
}

export function GoalsPanel({ s }: { s: State }) {
    const c = goalCounts(s);
    const tiers = tiersDone(s);
    return (
        <div className="nf-sys nf-wk">
            <WinBanner
                art="goals"
                color="#ffc53a"
                readout={[
                    ["~/goals", ""],
                    ["DONE", `${c.goals} / ${GOALS.length}`],
                    ["TIERS", `${tiers} / ${GOAL_TIERS}`],
                    ["SECRETS", `${c.secrets} / ${SECRETS.length}`],
                ]}
                big={`+${fmt(bonusNow(s))}%`}
                bigLabel="to everything"
            />
            <p className="nf-wk-lead" data-cx-i="1">
                Every goal or secret adds <b>+{TUNE.achBonus * 100}%</b> to everything. Finish all six in a tier for <b>+{TUNE.tierBonus * 100}%</b> more.
            </p>
            <div className="nf-wk-tiers">
                {Array.from({ length: GOAL_TIERS }, (_, k) => k + 1).map((t) => {
                    const goals = GOALS.filter((g) => g.tier === t);
                    const items: RailItem[] = goals.map((g) => {
                        const p = goalProg(s, g);
                        return { id: g.id, name: g.name, text: g.hint, icon: g.icon, done: goalDone(s, g), frac: p.frac, count: `${fmt(p.cur)} / ${fmt(p.tgt)}`, at: s.achAt[g.id] };
                    });
                    const n = items.filter((x) => x.done).length;
                    const full = n === goals.length;
                    const open = t === 1 || GOALS.filter((g) => g.tier === t - 1).some((g) => goalDone(s, g)) || n > 0;
                    return (
                        <Frame
                            key={t}
                            i={t + 1}
                            color={TIER_COLOR[t]}
                            className={`nf-wk-tier${full ? " is-full" : ""}${open ? "" : " is-dim"}`}
                            path={`tier.${ROMAN[t]}`}
                            title={TIER_NAMES[t]}
                            aside={<>{n}/{goals.length} <em>{full ? "bonus on" : `+${TUNE.tierBonus * 100}% at ${goals.length}`}</em></>}
                        >
                            <Rail items={items} color={TIER_COLOR[t]} label={`${TIER_NAMES[t]} goals`} i={t + 1} />
                        </Frame>
                    );
                })}
                <Frame
                    i={GOAL_TIERS + 2}
                    color={SECRET_COLOR}
                    className="nf-wk-tier nf-wk-sec"
                    path="tier.??"
                    title="Secrets"
                    aside={<>{c.secrets}/{SECRETS.length} <em>found</em></>}
                >
                    <Rail
                        i={GOAL_TIERS + 2}
                        color={SECRET_COLOR}
                        label="Secrets"
                        items={SECRETS.map((x) => {
                            const done = s.ach.includes(x.id);
                            return { id: x.id, name: done ? x.name : "????", text: done ? x.how : x.clue, icon: done ? "spark" : "lock", done, frac: done ? 1 : 0, count: "hidden", at: s.achAt[x.id] };
                        })}
                    />
                </Frame>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------------------------------------------------
// Records: an operator dossier (big readouts, then data lines) and a two-pane log reader that types the picked log out.

function LogReader({ s }: { s: State }) {
    const got = LOGS.map((l) => s.logs.includes(l.id));
    const latest = (() => { for (let i = LOGS.length - 1; i >= 0; i--) if (got[i]) return i; return 0; })();
    const [sel, setSel] = useState(latest);
    const body = useRef<HTMLDivElement>(null);
    const first = useRef(true);
    useEffect(() => {
        if (first.current) { first.current = false; return; }
        codeReveal(body.current, { bare: true, rows: ":scope > *", ms: 320, sound: false });
    }, [sel]);
    const l = LOGS[sel];
    const open = got[sel];
    return (
        <div className="nf-wk-logs">
            <ol className="nf-wk-loglist" aria-label="Operator logs">
                {LOGS.map((x, i) => (
                    <li key={x.id}>
                        <button
                            type="button"
                            aria-pressed={i === sel}
                            data-lock={got[i] ? undefined : ""}
                            onClick={() => {
                                setSel(i);
                                if (matchMedia("(max-width: 719px)").matches) setTimeout(() => body.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 40);
                            }}
                        >
                            <span>{logNo(i)}</span>
                            <b>{got[i] ? x.title : "encrypted"}</b>
                        </button>
                    </li>
                ))}
            </ol>
            <div className="nf-wk-logbody" ref={body} aria-live="polite">
                <p className="nf-wk-logh">LOG {logNo(sel)} // {open ? l.title : "????"}</p>
                {open
                    ? <p className="nf-wk-logt">{l.text}<span className="nf-wk-caret" aria-hidden="true" /></p>
                    : <p className="nf-wk-logt is-lock">This log is still encrypted. It decrypts as the farm grows.<span className="nf-wk-caret" aria-hidden="true" /></p>}
                <p className="nf-wk-logf">signed: operator, node-01</p>
            </div>
        </div>
    );
}

export function RecordsPanel({ s }: { s: State }) {
    const secs = recordSections(s);
    const run = secs.find((x) => x.id === "run")!;
    const life = secs.find((x) => x.id === "life")!;
    const pick = (rows: [string, string][], k: string) => rows.find((r) => r[0] === k)?.[1] ?? "";
    const big: [string, string, string][] = [
        ["Time played", fmtTime(s.life.secs), "#2fd8e8"],
        ["Peak Bytes/s", pick(life.rows, "Peak Bytes/s"), "#b6f04a"],
        ["Global bonus", pick(run.rows, "Global bonus"), "#ffc53a"],
        ["Ascensions", String(s.life.ascends), "#ff2d8a"],
    ];
    const colours: Record<string, string> = { run: "#2fd8e8", mats: "#f08a3c", life: "#b6f04a", prog: "#ffc53a", zev: "#ffa23a" };
    return (
        <div className="nf-sys nf-wk">
            <WinBanner
                art="records"
                color="#f0a53c"
                readout={[
                    ["~/records", ""],
                    ["RUN", String(s.life.ascends + 1).padStart(2, "0")],
                    ["FIRST BOOT", new Date(s.started).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })],
                    ["LOGS", `${s.logs.length} / ${LOGS.length} recovered`],
                ]}
            />
            <dl className="nf-wk-bigs" data-cx-i="1">
                {big.map(([k, v, c]) => (
                    <div key={k} style={{ ["--c" as string]: c } as CSSProperties}><dt>{k}</dt><dd>{v}</dd></div>
                ))}
            </dl>
            <div className="nf-wk-cols">
                {secs.map((sec, i) => (
                    <Frame key={sec.id} i={i + 2} color={colours[sec.id]} path={`records/${sec.id}`} title={sec.title} note={sec.blurb}>
                        <DataLines rows={sec.rows} />
                    </Frame>
                ))}
            </div>
            <Frame i={8} color="#6bffc9" className="nf-wk-logfr" path="records/logs" title="Operator logs" aside={<>{s.logs.length}/{LOGS.length}</>} note="Left by whoever ran this node before you. New ones decrypt as the farm grows.">
                <LogReader s={s} />
            </Frame>
        </div>
    );
}

// ---------------------------------------------------------------------------------------------------------------------
// Menu: a config file. Each setting is one line you click to flip; the save code is a terminal block; reset is a hold.
// Save files, backup, volume, calm motion, number format and keys came in with #170 and keep their behaviour.

export function MenuPanel({
    s, soundOn, onSound, humOn, onHum, eventsOn, onEvents, ioText, setIoText, ioMsg, onExport, onImport, importConfirm, onDownload, onUpload, backups, onRestore, onRecover, volume, onVolume, calm, osCalm, onCalm, jumpOn, onJump, lastSave, numFmt, onNumFmt, onReset,
}: {
    s: State; soundOn: boolean; onSound: () => void; humOn: boolean; onHum: () => void; eventsOn: boolean; onEvents: () => void; ioText: string; setIoText: (v: string) => void; ioMsg: string; onExport: () => void; onImport: () => void; importConfirm: boolean; onDownload: () => void; onUpload: (f: File) => void;
    backups: Backup[]; onRestore: (b: Backup) => void; onRecover: (b: Backup) => void; volume: number; onVolume: (v: number) => void; calm: boolean; osCalm: boolean; onCalm: () => void; jumpOn: boolean; onJump: () => void; lastSave: number; numFmt: NumFmt; onNumFmt: (f: NumFmt) => void; confirm?: boolean; onReset: () => void;
}) {
    const keys: [string, string][] = [["M", "Map"], ["O", "Goals"], ["L", "Records"], ["A", "Ascend"], ["S", "Menu"], ["T", "Tree"], ["G", "Show me the next step"], ["P", "Press the glowing button (hold to keep going)"], ["1 to 6", "Press that tier on the zone in the middle of the screen"], ["Esc", "Close the open window"], ["Hold a button", "Keep buying"]];
    return (
        <div className="nf-sys nf-wk">
            <WinBanner
                art="menu"
                color="#b6f04a"
                readout={[
                    ["~/config", ""],
                    ["SAVE", "this browser · every 5s"],
                    ["LAST SAVE", lastSave ? new Date(lastSave).toLocaleTimeString() : "not yet"],
                    ["PLAYED", fmtTime(s.life.secs)],
                ]}
            />
            <div className="nf-wk-cols nf-wk-menu">
                <SettingsFrame soundOn={soundOn} onSound={onSound} humOn={humOn} onHum={onHum} eventsOn={eventsOn} onEvents={onEvents} volume={volume} onVolume={onVolume} calm={calm} osCalm={osCalm} onCalm={onCalm} jumpOn={jumpOn} onJump={onJump} numFmt={numFmt} onNumFmt={onNumFmt} />
                <Frame i={2} color="#2fd8e8" path="config/save.key" title="Save code" note="Your save lives in this browser. Export a code or a file to move it, or paste one to load it. Restoring a backup keeps the save you leave as a new backup.">
                    <label className="nf-wk-term">
                        <span className="nf-wk-term-h"><span aria-hidden="true">$</span> cat save.key</span>
                        <textarea value={ioText} onChange={(e) => setIoText(e.target.value)} rows={4} spellCheck={false} placeholder="Export to print a code here, or paste one and press Import." aria-label="Save code" />
                    </label>
                    <div className="nf-wk-acts">
                        <button type="button" className="nf-wk-btn is-main" onClick={onExport}>Export + copy</button>
                        <button type="button" className="nf-wk-btn" data-armed={importConfirm ? "" : undefined} onClick={onImport}>{importConfirm ? "Confirm import" : "Import"}</button>
                        <button type="button" className="nf-wk-btn" onClick={onDownload}>Download file</button>
                        <label className="nf-wk-btn nf-wk-file">Open file<input type="file" accept=".txt,text/plain" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} /></label>
                    </div>
                    {ioMsg && <p className="nf-wk-msg" role="status">{"> "}{ioMsg}</p>}
                    {backups.length > 0 && (
                        <div className="nf-wk-backup">
                            <p className="nf-wk-msg nf-wk-bk-h">{"> "}backups // the game keeps these for you</p>
                            <ul className="nf-wk-bk">
                                {backups.map((b) => {
                                    const l = backupLine(b);
                                    return (
                                        <li key={`${b.at}-${b.kind}`}>
                                            <span className="nf-wk-bk-t"><b>{l.when}</b> {l.what}{b.daily ? " (daily)" : ""}<small>{l.how}</small></span>
                                            <button type="button" className="nf-wk-btn" onClick={() => (b.kind === "lost" ? onRecover(b) : onRestore(b))}>{b.kind === "lost" ? "Copy out" : "Restore"}</button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </Frame>
                <Frame i={3} color="#ff2d8a" className="nf-wk-danger" path="config/wipe.sh" title="Wipe save" note="Deletes this save, tree and goals too. The old save is kept as a backup above.">
                    <HoldButton label="Hold to wipe" holding="Keep holding" armed="Press again to wipe" onFire={onReset} />
                </Frame>
                <Frame i={4} color="#ffc53a" className="nf-wk-keys" path="config/keys.map" title="Keys" note="Single letters, off while typing.">
                    <DataLines rows={keys} />
                </Frame>
            </div>
        </div>
    );
}
