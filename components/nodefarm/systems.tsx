"use client";

import { PixelIcon } from "@/components/cm/pixel-icons";
import { BRANCHES, GOALS, GOAL_TIERS, PERKS, TREE, hasNode, SECRETS, TIER_NAMES, TUNE, apOnAscend, canAscend, derive, fmt, fmtTime, goalDone, tiersDone, type State } from "@/lib/nodefarm/engine";
import { goalCounts, recordSections } from "@/lib/nodefarm/records";
import { LOGS, logNo } from "@/lib/nodefarm/story";
import { NfIcon } from "./icon";

type D = ReturnType<typeof derive>;
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
            <header className="nf-sys-h">
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
                        <section key={t} className="nf-tier" data-full={full ? "" : undefined} style={{ ["--c" as string]: TIER_COLOR[t] }}>
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
            <section className="nf-secrets" aria-label="Secrets">
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

/** Summary of the prestige tree on the Ascend pane, with the way into the full-screen menu. */
function TreeCard({ s, onOpen }: { s: State; onOpen: () => void }) {
    const owned = s.tree.length;
    return (
        <section className="nf-tree-wrap nf-tree-card">
            <header className="nf-sys-h">
                <h3>Prestige tree</h3>
                <p>{TREE.length} upgrades in five sections, bought with AP and kept through every Ascend. {s.ap} AP to spend, {owned} of {TREE.length} owned.</p>
            </header>
            <ul className="nf-tree-sum">
                {BRANCHES.map((b) => {
                    const mine = TREE.filter((n) => n.branch === b.id);
                    return <li key={b.id} style={{ ["--c" as string]: b.color }}><b>{b.name}</b><small>{mine.filter((n) => hasNode(s, n.id)).length}/{mine.length}</small></li>;
                })}
            </ul>
            <button type="button" className="nf-mini nf-tree-open" onClick={onOpen}>Open the tree</button>
        </section>
    );
}

export function AscendPanel({ s, d, confirm, onAscend, onPerk, onTree }: { s: State; d: D; confirm: boolean; onAscend: () => void; onPerk: (id: (typeof PERKS)[number]["id"]) => void; onTree: () => void }) {
    const gain = apOnAscend(s);
    const after = (1 + (s.ap + gain) * TUNE.apBonus) / (1 + s.ap * TUNE.apBonus);
    return (
        <div className="nf-sys nf-asc-grid">
            <section className="nf-asc">
                <header className="nf-sys-h">
                    <h3>Ascend</h3>
                    <p>Wipe the whole run. You keep goals, perks, the tree and lifetime stats, and get Ascension Points (AP). Each AP adds +{TUNE.apBonus * 100}% to everything, permanently.</p>
                </header>
                <div className="nf-asc-art" aria-hidden="true" />
                <div className="nf-asc-card">
                    <NfIcon name="ascend" large />
                    <div className="nf-asc-stats">
                        <span><small>Aether</small><b>{fmt(s.aether)} / {fmt(TUNE.ascendAether)}</b></span>
                        {s.runes > 0 && <span><small>Deep materials add</small><b>{`Runes ${fmt(s.runes)}`}{s.starglass > 0 ? ` · Starglass ${fmt(s.starglass)}` : ""}</b></span>}
                        <span><small>AP now</small><b>{s.ap}</b></span>
                        <span><small>On ascend</small><b>{gain > 0 ? `+${gain} AP` : "locked"}</b></span>
                        <span><small>Global</small><b>{gain > 0 ? `×${fmt(d.global)} → ×${fmt(d.global * after)}` : `×${fmt(d.global)}`}</b></span>
                    </div>
                    <div className="nf-bar" role="progressbar" aria-valuemin={0} aria-valuemax={TUNE.ascendAether} aria-valuenow={Math.min(s.aether, TUNE.ascendAether)} aria-label="Aether toward Ascend"><i style={{ width: `${Math.min(100, (s.aether / TUNE.ascendAether) * 100)}%` }} /></div>
                    <button type="button" className="nf-ascend" disabled={!canAscend(s)} onClick={onAscend}>
                        {canAscend(s) ? (confirm ? `Confirm: wipe and gain ${gain} AP` : `Ascend for ${gain} AP`) : `Need ${fmt(TUNE.ascendAether)} Aether`}
                    </button>
                </div>
            </section>
            <section className="nf-perks-wrap">
                <header className="nf-sys-h"><h3>Perks</h3><p>{s.ap} AP to spend. Perks survive every Ascend.</p></header>
                <ul className="nf-perks">
                    {PERKS.map((p) => {
                        const lvl = s.perks[p.id];
                        const cost = p.cost(lvl);
                        const maxed = lvl >= p.max;
                        return (
                            <li key={p.id} data-maxed={maxed ? "" : undefined}>
                                <span className="nf-perk-t">
                                    <b>{p.name}</b>
                                    <small>{p.blurb}</small>
                                    <span className="nf-pipbar" aria-label={`Level ${lvl} of ${p.max}`}>
                                        {Array.from({ length: p.max }, (_, i) => <i key={i} data-on={i < lvl ? "" : undefined} />)}
                                    </span>
                                </span>
                                <button type="button" className="nf-mini" disabled={maxed || s.ap < cost} onClick={() => onPerk(p.id)}>
                                    {maxed ? "Max" : `${cost} AP`}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </section>
            <TreeCard s={s} onOpen={onTree} />
        </div>
    );
}

export function MenuPanel({
    s, soundOn, onSound, humOn, onHum, eventsOn, onEvents, ioText, setIoText, ioMsg, onExport, onImport, confirm, onReset,
}: {
    s: State; soundOn: boolean; onSound: () => void; humOn: boolean; onHum: () => void; eventsOn: boolean; onEvents: () => void; ioText: string; setIoText: (v: string) => void; ioMsg: string; onExport: () => void; onImport: () => void; confirm: boolean; onReset: () => void;
}) {
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
                    <button type="button" className="nf-mini" aria-pressed={soundOn} onClick={onSound}>Sound: {soundOn ? "on" : "off"}</button>
                    <button type="button" className="nf-mini" aria-pressed={humOn} onClick={onHum}>Hum: {humOn ? "on" : "off"}</button>
                    <button type="button" className="nf-mini" aria-pressed={eventsOn} onClick={onEvents}>Events: {eventsOn ? "on" : "off"}</button>
                    <button type="button" className="nf-mini" onClick={onExport}>Export</button>
                    <button type="button" className="nf-mini" onClick={onImport}>Import</button>
                </div>
                <label className="nf-io">
                    <span>Save code</span>
                    <textarea value={ioText} onChange={(e) => setIoText(e.target.value)} rows={3} spellCheck={false} placeholder="Export to get a code, or paste one here and press Import." />
                </label>
                {ioMsg && <p className="nf-io-msg" role="status">{ioMsg}</p>}
            </section>
            <section className="nf-danger-zone">
                <header className="nf-sys-h"><h3>Danger</h3><p>Deletes this save. Export first if unsure.</p></header>
                <button type="button" className="nf-mini nf-danger" onClick={onReset}>{confirm ? "Confirm wipe" : "Reset everything"}</button>
            </section>
        </div>
    );
}
