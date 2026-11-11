"use client";

import { PixelIcon } from "@/components/cm/pixel-icons";
import { GOALS, PERKS, TIER_NAMES, TUNE, apOnAscend, canAscend, derive, fmt, fmtTime, goalDone, tiersDone, type State } from "@/lib/nodefarm/engine";
import { NfIcon } from "./icon";

type D = ReturnType<typeof derive>;
const ROMAN = ["", "I", "II", "III", "IV", "V"];
const TIER_COLOR = ["", "#2fd8e8", "#b6f04a", "#f0a53c", "#ff2d8a", "#f4f4f2"];

export function GoalsPanel({ s }: { s: State }) {
    return (
        <div className="nf-sys">
            <header className="nf-sys-h">
                <h3>Goals</h3>
                <p>
                    {s.ach.length} of {GOALS.length} done. Each goal adds +{TUNE.achBonus * 100}% to everything, and a finished tier adds +{TUNE.tierBonus * 100}% more.
                    <b> Now +{fmt(((1 + s.ach.length * TUNE.achBonus) * (1 + tiersDone(s) * TUNE.tierBonus) - 1) * 100)}%.</b>
                </p>
            </header>
            <div className="nf-tiers">
                {[1, 2, 3, 4, 5].map((t) => {
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
                                            <span className="nf-goal-n">{done ? <PixelIcon name="check" size={12} /> : `${fmt(cur)}/${fmt(tgt)}`}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    );
                })}
            </div>
        </div>
    );
}

export function AscendPanel({ s, d, confirm, onAscend, onPerk }: { s: State; d: D; confirm: boolean; onAscend: () => void; onPerk: (id: (typeof PERKS)[number]["id"]) => void }) {
    const gain = apOnAscend(s);
    const after = (1 + (s.ap + gain) * TUNE.apBonus) / (1 + s.ap * TUNE.apBonus);
    return (
        <div className="nf-sys nf-asc-grid">
            <section className="nf-asc">
                <header className="nf-sys-h">
                    <h3>Ascend</h3>
                    <p>Wipe the whole run. You keep goals, perks and lifetime stats, and get Ascension Points (AP). Each AP adds +{TUNE.apBonus * 100}% to everything, permanently.</p>
                </header>
                <div className="nf-asc-card">
                    <NfIcon name="ascend" large />
                    <div className="nf-asc-stats">
                        <span><small>Aether</small><b>{fmt(s.aether)} / {fmt(TUNE.ascendAether)}</b></span>
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
        </div>
    );
}

export function MenuPanel({
    s, soundOn, onSound, eventsOn, onEvents, ioText, setIoText, ioMsg, onExport, onImport, confirm, onReset,
}: {
    s: State; soundOn: boolean; onSound: () => void; eventsOn: boolean; onEvents: () => void; ioText: string; setIoText: (v: string) => void; ioMsg: string; onExport: () => void; onImport: () => void; confirm: boolean; onReset: () => void;
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
