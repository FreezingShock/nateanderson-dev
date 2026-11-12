"use client";

import { PixelIcon } from "@/components/cm/pixel-icons";
import { GOALS, GOAL_TIERS, SECRETS, TIER_NAMES, TUNE, fmt, fmtTime, goalDone, tiersDone, type NumFmt, type State } from "@/lib/nodefarm/engine";
import { goalCounts, recordSections } from "@/lib/nodefarm/records";
import { LOGS, logNo } from "@/lib/nodefarm/story";
import { NfIcon } from "./icon";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII"];
const TIER_COLOR = ["", "#2fd8e8", "#b6f04a", "#f0a53c", "#ff2d8a", "#f4f4f2", "#ffc53a", "#9a7bff"];
const stamp = (ms?: number) => {
    if (!ms) return "done";
    const d = new Date(ms);
    return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${d.toTimeString().slice(0, 5)}`;
};

export function GoalsPanel({ s }: { s: State }) {
    return (
        <div className="nf-sys">
            <header className="nf-sys-h" data-cx-i="0">
                <h3>Goals</h3>
                <p>
                    {goalCounts(s).goals} of {GOALS.length} done, {goalCounts(s).secrets} of {SECRETS.length} secrets found. Each goal or secret adds +{TUNE.achBonus * 100}% to everything, and a finished tier adds +{TUNE.tierBonus * 100}% more.
                    <b> Now +{fmt(((1 + s.ach.length * TUNE.achBonus) * (1 + tiersDone(s) * TUNE.tierBonus) - 1) * 100)}%.</b>
                </p>
            </header>
            <div className="nf-tiers">
                {Array.from({ length: GOAL_TIERS }, (_, i) => i + 1).map((t) => {
                    const goals = GOALS.filter((g) => g.tier === t);
                    const n = goals.filter((g) => goalDone(s, g)).length;
                    const full = n === goals.length;
                    return (
                        <section key={t} className="nf-tier" data-cx-i={t} data-full={full ? "" : undefined} style={{ ["--c" as string]: TIER_COLOR[t] }}>
                            <header>
                                <span className="nf-tier-n">{ROMAN[t]}</span>
                                <b>{TIER_NAMES[t]}</b>
                                <span className="nf-tier-s">{n}/{goals.length}{full ? " · bonus on" : ` · +${TUNE.tierBonus * 100}% at ${goals.length}`}</span>
                                <span className="nf-bar sm" aria-hidden="true"><i style={{ width: `${(n / goals.length) * 100}%` }} /></span>
                            </header>
                            <ul>
                                {goals.map((g) => {
                                    const done = goalDone(s, g);
                                    const first = g.target < 1;
                                    const cur = first ? (g.cur(s) > 0 ? 1 : 0) : Math.min(g.cur(s), g.target);
                                    const tgt = first ? 1 : g.target;
                                    return (
                                        <li key={g.id} data-done={done ? "" : undefined}>
                                            <NfIcon name={g.icon} />
                                            <span className="nf-goal-t">
                                                <b>{g.name}</b>
                                                <small>{g.hint}</small>
                                                <span className="nf-bar sm" aria-hidden="true"><i style={{ width: `${Math.min(100, (cur / tgt) * 100)}%` }} /></span>
                                            </span>
                                            <span className="nf-goal-n">{done ? <><PixelIcon name="check" size={12} /><time>{stamp(s.achAt[g.id])}</time></> : `${fmt(cur)}/${fmt(tgt)}`}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    );
                })}
            </div>
            <section className="nf-secrets" aria-label="Secrets" data-cx-i="9">
                <header>
                    <b>Secrets</b>
                    <span className="nf-tier-s">{goalCounts(s).secrets}/{SECRETS.length} found</span>
                </header>
                <ul>
                    {SECRETS.map((x) => {
                        const done = s.ach.includes(x.id);
                        return (
                            <li key={x.id} data-done={done ? "" : undefined}>
                                <NfIcon name={done ? "spark" : "lock"} />
                                <span className="nf-goal-t">
                                    <b>{done ? x.name : "????"}</b>
                                    <small>{done ? x.how : x.clue}</small>
                                </span>
                                <span className="nf-goal-n">{done ? <><PixelIcon name="check" size={12} /><time>{stamp(s.achAt[x.id])}</time></> : "hidden"}</span>
                            </li>
                        );
                    })}
                </ul>
            </section>
        </div>
    );
}

export function RecordsPanel({ s }: { s: State }) {
    return (
        <div className="nf-sys nf-rec-grid">
            {recordSections(s).map((sec) => (
                <section key={sec.id}>
                    <header className="nf-sys-h"><h3>{sec.title}</h3><p>{sec.blurb}</p></header>
                    <dl className="nf-recs">
                        {sec.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
                    </dl>
                </section>
            ))}
            <section className="nf-logs">
                <header className="nf-sys-h"><h3>Operator logs</h3><p>{s.logs.length} of {LOGS.length} recovered. Left by whoever ran this node before you.</p></header>
                <ol className="nf-log-list">
                    {LOGS.map((l, i) => (s.logs.includes(l.id)
                        ? <li key={l.id}><b>LOG {logNo(i)} // {l.title}</b><p>{l.text}</p></li>
                        : <li key={l.id} className="lock"><b>LOG {logNo(i)} // ????</b></li>))}
                </ol>
            </section>
        </div>
    );
}

export function MenuPanel({
    s, soundOn, onSound, humOn, onHum, eventsOn, onEvents, ioText, setIoText, ioMsg, onExport, onImport, importConfirm, onDownload, onUpload, backup, onRestore, volume, onVolume, calm, osCalm, onCalm, lastSave, numFmt, onNumFmt, hasMax, confirm, onReset,
}: {
    s: State; soundOn: boolean; onSound: () => void; humOn: boolean; onHum: () => void; eventsOn: boolean; onEvents: () => void; ioText: string; setIoText: (v: string) => void; ioMsg: string; onExport: () => void; onImport: () => void; importConfirm: boolean; onDownload: () => void; onUpload: (f: File) => void;
    backup: { at: number; why: string } | null; onRestore: () => void; volume: number; onVolume: (v: number) => void; calm: boolean; osCalm: boolean; onCalm: () => void; lastSave: number; numFmt: NumFmt; onNumFmt: (f: NumFmt) => void; hasMax: boolean; confirm: boolean; onReset: () => void;
}) {
    const FORMATS: [NumFmt, string][] = [["short", "1.2M"], ["sci", "1.2e6"], ["eng", "1.2e6 / e3"]];
    const facts: [string, string][] = [
        ["Played", fmtTime(s.life.secs)],
        ["Presses", fmt(s.life.presses)],
        ["Bytes ever", fmt(s.life.bytes)],
        ["Reboots ever", fmt(s.life.reboots)],
        ["Events cleared", String(s.life.intrusions)],
        ["Ascensions", String(s.life.ascends)],
    ];
    return (
        <div className="nf-sys nf-menu-grid">
            <section>
                <header className="nf-sys-h"><h3>Lifetime</h3><p>Survives every Ascend.</p></header>
                <dl className="nf-facts">
                    {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
                </dl>
            </section>
            <section>
                <header className="nf-sys-h"><h3>Save</h3><p>Stored in this browser. Move it with a code.</p></header>
                <div className="nf-menu-row">
                    <button type="button" className="nf-mini" onClick={onExport}>Export code</button>
                    <button type="button" className="nf-mini" onClick={onDownload}>Download file</button>
                    <label className="nf-mini nf-file">Open file<input type="file" accept=".txt,text/plain" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} /></label>
                    <button type="button" className="nf-mini" data-guide={importConfirm ? "" : undefined} onClick={onImport}>{importConfirm ? "Confirm import" : "Import"}</button>
                </div>
                <label className="nf-io">
                    <span>Save code</span>
                    <textarea value={ioText} onChange={(e) => setIoText(e.target.value)} rows={3} spellCheck={false} placeholder="Export to get a code, or paste one here and press Import." />
                </label>
                <p className="nf-io-msg">{lastSave ? `Last saved ${new Date(lastSave).toLocaleTimeString()}. Saves every 5 s and when you leave.` : "Saves every 5 s and when you leave."}</p>
                {ioMsg && <p className="nf-io-msg" role="status">{ioMsg}</p>}
                {backup && (
                    <div className="nf-backup">
                        <span>Backup from {new Date(backup.at).toLocaleString()} ({backup.why}).</span>
                        <button type="button" className="nf-mini" onClick={onRestore}>Restore backup</button>
                    </div>
                )}
            </section>
            <section>
                <header className="nf-sys-h"><h3>Settings</h3><p>Kept on this device, not in the save.</p></header>
                <div className="nf-menu-row">
                    <button type="button" className="nf-mini" aria-pressed={soundOn} onClick={onSound}>Sound: {soundOn ? "on" : "off"}</button>
                    <button type="button" className="nf-mini" aria-pressed={humOn} onClick={onHum}>Hum: {humOn ? "on" : "off"}</button>
                    <button type="button" className="nf-mini" aria-pressed={eventsOn} onClick={onEvents}>Events: {eventsOn ? "on" : "off"}</button>
                    <button type="button" className="nf-mini" aria-pressed={calm || osCalm} disabled={osCalm} onClick={onCalm} title={osCalm ? "Your device already asks for less motion" : undefined}>Calm motion: {calm || osCalm ? "on" : "off"}</button>
                </div>
                <label className="nf-io nf-vol">
                    <span>Volume {Math.round(volume * 100)}%</span>
                    <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => onVolume(Number(e.target.value))} aria-label="Master volume (all site sounds)" />
                </label>
                <div className="nf-fmt" role="group" aria-label="Number format">
                    <span className="nf-fmt-l">Numbers</span>
                    {FORMATS.map(([k, ex]) => <button key={k} type="button" className="nf-mini" aria-pressed={numFmt === k} onClick={() => onNumFmt(k)}>{ex}</button>)}
                </div>
            </section>
            <section className="nf-keys-sec">
                <header className="nf-sys-h"><h3>Keys</h3><p>Single letters, off while typing.</p></header>
                <dl className="nf-facts nf-keys">
                    {([["M", "Map"], ["O", "Goals"], ["L", "Records"], ["A", "Ascend"], ["S", "Menu"], ["T", "Tree"], ...(hasMax ? [["B", "Buy max on or off"]] : []), ["Esc", "Close the open window"], ["Hold a button", "Keep buying"]] as [string, string][]).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
                </dl>
            </section>
            <section className="nf-danger-zone">
                <header className="nf-sys-h"><h3>Danger</h3><p>Deletes this save. Export first if unsure.</p></header>
                <button type="button" className="nf-mini nf-danger" onClick={onReset}>{confirm ? "Confirm wipe" : "Reset everything"}</button>
            </section>
        </div>
    );
}
