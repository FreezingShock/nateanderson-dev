"use client";

import type { CSSProperties } from "react";
import { PixelIcon } from "@/components/cm/pixel-icons";
import { fmtTime, statDef, type State } from "@/lib/nodefarm/engine";
import { CH_TUNE, RANKS, RANKS_ALL, RANK_MAX, TESTS, chRun, chSecs, chTotals, leashLeft, ranksDone, ranksTotal, testDef, type TestDef, type TestId } from "@/lib/nodefarm/stress";
import { DataLines, Frame, HoldButton, WinBanner } from "./win-kit";
import "@/app/camino/nodefarm-stress.css";

/**
 * Stress tests window (challenge runs). Eight tests, each a fresh run under one fault, with three ranks that pay permanent
 * boosts. The real run is stored while a test runs and comes back when you leave. Rules: lib/nodefarm/stress.ts.
 * Styles: app/camino/nodefarm-stress.css (nf-st-*), on top of the shared window kit (win-kit.tsx). Rows carry data-cx-i
 * for the code reveal.
 */
export const STRESS_RED = "#ff5a3c";
const GOALS = CH_TUNE.goals.map((g) => statDef(g));
const pad = (n: number) => String(n).padStart(2, "0");

function Pips({ got, of = RANK_MAX }: { got: number; of?: number }) {
    return (
        <span className="nf-st-pips" aria-label={`${got} of ${of} ranks`}>
            {RANKS.slice(0, of).map((r, i) => (
                <i key={r} data-on={i < got ? "" : undefined}>{r}</i>
            ))}
        </span>
    );
}

function Card({ s, t, i, busy, onStart }: { s: State; t: TestDef; i: number; busy: boolean; onStart: (id: TestId) => void }) {
    const done = ranksDone(s, t.id);
    const running = chRun(s)?.id === t.id;
    const next = done < RANK_MAX ? `rank ${RANKS[done]}: open ${GOALS[done].name}` : "all ranks cleared";
    return (
        <article className="nf-st-card" data-cx-i={i} data-run={running ? "" : undefined} data-full={done >= RANK_MAX ? "" : undefined}>
            <header>
                <span className="nf-st-n">{pad(t.n)}</span>
                <i className="nf-st-ic" aria-hidden="true"><PixelIcon name={t.icon} size={20} /></i>
                <h4>{t.name}</h4>
                <Pips got={done} />
            </header>
            <p className="nf-st-rule">{t.rule}</p>
            <p className="nf-st-plan">{t.plan}</p>
            <DataLines
                className="nf-st-dl"
                rows={[
                    ["pays now", done ? t.pays(done) : "nothing yet"],
                    ["next", next],
                    ...(done < RANK_MAX ? ([["at rank III", t.pays(RANK_MAX)]] as [string, string][]) : []),
                ]}
            />
            {running ? (
                <p className="nf-st-state">running now</p>
            ) : (
                <button type="button" className="nf-wk-btn nf-st-go" disabled={busy} onClick={() => onStart(t.id)}>
                    {done >= RANK_MAX ? "run again" : "start test"}
                </button>
            )}
        </article>
    );
}

export function StressPanel({ s, onStart, onLeave }: { s: State; onStart: (id: TestId) => void; onLeave: () => void }) {
    const run = chRun(s);
    const def = run ? testDef(run.id) : null;
    const total = ranksTotal(s);
    const left = leashLeft(s);
    const last = s.ch?.last && !run ? s.ch.last : null;
    const totals = chTotals(s);
    return (
        <div className="nf-st" style={{ ["--c" as string]: STRESS_RED } as CSSProperties}>
            <WinBanner
                art="stress"
                color={STRESS_RED}
                readout={[
                    ["~/stress", ""],
                    ["status", run && def ? `running ${def.name.toLowerCase()}` : "idle"],
                    ["ranks", `${total}/${RANKS_ALL}`],
                    ["goals", GOALS.map((g) => g.name.toLowerCase()).join(" > ")],
                ]}
                big={`${total}/${RANKS_ALL}`}
                bigLabel="ranks cleared"
            />
            <p className="nf-wk-lead" data-cx-i="1">
                Run the node under one fault. Your real run is <b>stored aside</b> and comes back exactly as it was when you leave. Ranks open at{" "}
                {GOALS.map((g, i) => `${g.name} (${RANKS[i]})`).join(", ")}, and each one pays a boost you keep through Ascend and Handover.
            </p>

            {run && def && (
                <Frame path="stress/running" title={def.name} i={2} className="nf-st-live" aside={<>{fmtTime(chSecs(s))}<em>in test</em></>}>
                    <p className="nf-st-rule">{def.rule}</p>
                    <ol className="nf-st-ladder">
                        {GOALS.map((g, k) => {
                            const st = k < run.got ? "done" : k === run.got && !run.out ? "now" : run.out && k === run.got ? "out" : "wait";
                            return (
                                <li key={g.id} data-st={st} style={{ ["--g" as string]: g.color } as CSSProperties}>
                                    <span className="nf-st-r">{RANKS[k]}</span>
                                    <span className="nf-st-g">open {g.name}</span>
                                    {run.id === "leash" && <span className="nf-st-lim">{CH_TUNE.leash[k]} min</span>}
                                    <span className="nf-st-s">{st === "done" ? "cleared" : st === "now" ? "in progress" : st === "out" ? "time ran out" : "after the one above"}</span>
                                </li>
                            );
                        })}
                    </ol>
                    {left !== null && !run.out && <p className="nf-st-timer">{fmtTime(left)} left for rank {RANKS[run.got]}</p>}
                    <p className="nf-wk-note">
                        {run.got >= RANK_MAX
                            ? "Every rank is cleared. Leave the test to get your run back."
                            : run.out
                              ? "Time ran out for the next rank. The ranks you cleared are kept. Leave to get your run back, and try again once your tree is stronger."
                              : "Ascend, Handover, the tree, perks and Firmware are locked until you leave. Leaving keeps every rank you cleared."}
                    </p>
                    <HoldButton ms={1000} className="nf-st-leave" label="hold to leave test" holding="restoring your run..." armed="press again to leave" onFire={onLeave} />
                </Frame>
            )}

            {last && (
                <p className="nf-st-last" data-cx-i="2">
                    <b>{testDef(last.id).name}</b> ended after {fmtTime(last.secs)} with {last.got} rank{last.got === 1 ? "" : "s"} cleared. Your run is back.
                </p>
            )}

            <Frame path="stress/tests" title="eight faults" i={3} note={run ? "One test at a time. Leave the running test to start another." : "Starting a test stores your run and starts a fresh one under the rule. Nothing is lost."}>
                <div className="nf-st-grid">
                    {TESTS.map((t, i) => <Card key={t.id} s={s} t={t} i={4 + i} busy={!!run} onStart={onStart} />)}
                </div>
            </Frame>

            <div className="nf-wk-cols">
                <Frame path="stress/boosts" title="what you keep" i={13}>
                    {totals.length ? <DataLines rows={totals} /> : <p className="nf-wk-note">Clear a rank in any test and its boost shows here.</p>}
                </Frame>
                <Frame path="stress/rules" title="how a test runs" i={14}>
                    <DataLines
                        rows={[
                            ["your run", "stored, back on leave"],
                            ["kept", "ranks, goals, logs, scripts"],
                            ["locked", "Ascend, Handover, tree, Firmware"],
                            ["undone on leave", "lab, hangar and rig buys"],
                            ["time away", "counts as test time"],
                        ]}
                    />
                </Frame>
            </div>
        </div>
    );
}

/** A slim bar over the board while a test runs: which test, the next rank, and a way back. */
export function StressStrip({ s, onOpen }: { s: State; onOpen: () => void }) {
    const run = chRun(s);
    if (!run) return null;
    const def = testDef(run.id);
    const left = leashLeft(s);
    const next = run.got >= RANK_MAX ? "all ranks cleared" : run.out ? "time ran out" : `rank ${RANKS[run.got]}: open ${GOALS[run.got].name}`;
    return (
        <div className="nf-st-strip" role="status" style={{ ["--c" as string]: STRESS_RED } as CSSProperties}>
            <i className="nf-st-ic" aria-hidden="true"><PixelIcon name={def.icon} size={16} /></i>
            <span className="nf-st-strip-k">stress test</span>
            <b>{def.name}</b>
            <span className="nf-st-strip-r">{def.rule}</span>
            <span className="nf-st-strip-n">{next}{left !== null && !run.out ? ` · ${fmtTime(left)} left` : ""}</span>
            <button type="button" className="nf-st-strip-b" onClick={onOpen}>{run.got >= RANK_MAX || run.out ? "leave test" : "stress window"}</button>
        </div>
    );
}
