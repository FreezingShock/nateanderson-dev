"use client";

import { useRef, type CSSProperties } from "react";
import { useFoldReveal } from "@/lib/nodefarm/cx";
import { PAYLOADS, STATS, TIERS, apOnAscend, dropFill, fmt, fmtTime, hasRecipe, isUnlocked, type ScriptId, type State } from "@/lib/nodefarm/engine";
import {
    BUY_STATS, RIG_ZONES, SCRIPTS, SCRIPT_COLOR, SCRIPT_TUNE, ascendTarget, auto, buyCycle, buyVer, cycleAnswer, cycleSetting, cycleStock, flip, isOn, learnLeft, learnPart,
    restoreLeft, runAge, schedStage, toggleRigZone, scriptGate, scriptNext, scriptOpen, setRunning, taughtMask, toggleBuyStat, toggleBuyTier, toggleDeploy, type ScriptDef,
} from "@/lib/nodefarm/scripts";
import { capCharge, rigCap, rigDef, rigLv, rigOpen, zoneNo } from "@/lib/nodefarm/rigs";
import "@/app/camino/nodefarm-scripts.css";

/**
 * Scripts zone: the scheduler's crontab. Each script is learned by doing its job by hand (a recording meter shows how far),
 * then runs on a few plain rules you set here. Rules live in lib/nodefarm/scripts.ts; this file draws and calls back.
 * Styles: app/camino/nodefarm-scripts.css. Art: scripts/naos-art/nodefarm-sched-scene.py (zone-sched, sched-icons).
 */
const statName = (id: string) => STATS.find((x) => x.id === id)!;
const ROW: Record<ScriptId, number> = { buy: 0, reboot: 1, compile: 2, deploy: 3, drop: 4, ascend: 5, rig: 6, event: 7, restore: 8 };

export function ScriptIcon({ id, on }: { id: ScriptId; on?: boolean }) {
    return <span className="nf-sch-ic" aria-hidden="true" data-on={on ? "" : undefined} style={{ ["--r" as string]: ROW[id] } as CSSProperties} />;
}

export function ScriptsZone({ s, open, onToggle, onChange, guided }: { s: State; open: boolean; onToggle: () => void; onChange: (msg?: string) => void; guided?: boolean }) {
    const bodyIn = useRef<HTMLDivElement>(null);
    useFoldReveal(bodyIn, open);
    const a = auto(s);
    const owned = a.own.length;
    const running = SCRIPTS.filter((x) => isOn(s, x.id)).length;
    const next = scriptNext(s);
    return (
        <article className="nf-row nf-sch" style={{ ["--c" as string]: SCRIPT_COLOR }} data-open={open ? "true" : "false"} data-stat="sched" data-guide={guided ? "" : undefined}>
            <div className="nf-bar-t">
                <span>SCHED // SCRIPTS</span>
                <span className="nf-bar-s">{owned ? `${running}/${owned} running` : "recording"}</span>
                <button type="button" className="nf-fold" aria-expanded={open} aria-controls="nf-body-sched" aria-label={`${open ? "Minimize" : "Expand"} Scripts`} onClick={onToggle}>
                    <i aria-hidden="true" />
                </button>
            </div>
            <div className="nf-body" id="nf-body-sched">
                <div className="nf-body-in" ref={bodyIn} inert={!open}>
                    <div className="nf-sch-hero" data-cx-i="">
                        <i className="nf-sch-scene" aria-hidden="true" style={{ ["--st" as string]: schedStage(s) } as CSSProperties} />
                        <div className="nf-sch-top">
                            <span className="nf-sch-ps" aria-hidden="true">root@node:~# crontab -l</span>
                            <div className="nf-sch-count">
                                <b>{owned}<small>/{SCRIPTS.length}</small></b>
                                <span>scripts learned <small>{running} running · the scheduler learns each one by watching you do it</small></span>
                            </div>
                        </div>
                        <p className="nf-sch-note">
                            <b>next //</b> {next ? next.text : "Every script is learned and running. Tune the rules below whenever the run changes."}
                            <small>Learned scripts and their rules are kept through every Ascend. Drones press fast and blind; scripts follow your rules.</small>
                        </p>
                    </div>
                    <ol className="nf-sch-list" aria-label="Scripts">
                        {SCRIPTS.map((x) => <ScriptLine key={x.id} x={x} s={s} onChange={onChange} />)}
                    </ol>
                </div>
            </div>
        </article>
    );
}

function ScriptLine({ x, s, onChange }: { x: ScriptDef; s: State; onChange: (msg?: string) => void }) {
    const a = auto(s);
    const own = a.own.includes(x.id);
    const opened = scriptOpen(s, x.id);
    const on = isOn(s, x.id);
    const part = learnPart(s, x.id);
    const st = !opened && !own ? "lock" : !own ? "rec" : on ? "run" : "stop";
    return (
        <li className="nf-sch-s" data-st={st} style={{ ["--c" as string]: x.color } as CSSProperties} data-cx-i="">
            <div className="nf-sch-h">
                <ScriptIcon id={x.id} on={on} />
                <span className="nf-sch-n">
                    <b>{x.file}</b>
                    <small>{x.name}{x.id === "buy" && own ? ` · v${buyVer(s) + 1} · every ${buyCycle(s)} s` : ""}</small>
                </span>
                <span className="nf-sch-st">{st === "lock" ? "encrypted" : st === "rec" ? `recording ${Math.floor(part * 100)}%` : on ? "running" : "stopped"}</span>
                {own && (
                    <button type="button" className="nf-sch-run" aria-pressed={on} onClick={() => { setRunning(s, x.id, !on); onChange(`${x.file} ${on ? "stopped" : "running"}`); }}>
                        {on ? "Stop" : "Run"}
                    </button>
                )}
            </div>
            {st === "lock" && <p className="nf-sch-d">{scriptGate[x.id]}.</p>}
            {st === "rec" && (
                <div className="nf-sch-rec">
                    <span className="nf-sch-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(part * 100)} aria-label={`${x.file} learned`}><i style={{ ["--f" as string]: part } as CSSProperties} /></span>
                    <p className="nf-sch-d"><b>teach //</b> {x.teach(learnLeft(s, x.id))} <span>{x.blurb}</span></p>
                </div>
            )}
            {own && (
                <div className="nf-sch-rules">
                    <p className="nf-sch-d">{x.blurb}</p>
                    <Rules id={x.id} s={s} onChange={onChange} />
                </div>
            )}
        </li>
    );
}

/** A yes/no rule: a square you tick. */
function Tick({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
    return (
        <button type="button" className="nf-sch-tick nf-sch-chain" aria-pressed={on} onClick={onPress}>
            <i aria-hidden="true" />{label}
        </button>
    );
}

/** A rule value you press to cycle. */
function Cyc({ v, label, onPress }: { v: string; label: string; onPress: () => void }) {
    return (
        <button type="button" className="nf-sch-cyc" onClick={onPress} aria-label={`${label}: ${v}. Press to change.`}>
            {v}<i aria-hidden="true">▸</i>
        </button>
    );
}

function Rules({ id, s, onChange }: { id: ScriptId; s: State; onChange: (msg?: string) => void }) {
    const a = auto(s);
    if (id === "buy") {
        const ver = buyVer(s);
        const nextAt = SCRIPT_TUNE.buyVer[ver + 1];
        const stats = BUY_STATS.filter((st) => isUnlocked(s, st));
        return (
            <>
                <p className="nf-sch-line">
                    keep <Cyc v={`×${a.keep}`} label="Reserve" onPress={() => { cycleSetting(s, "keep"); onChange(); }} /> the price in reserve
                    <span>{fmt(a.ran.buy ?? 0)} buy{(a.ran.buy ?? 0) === 1 ? "" : "s"} so far{nextAt ? ` · v${ver + 2} at ${fmt(nextAt)} (runs every ${SCRIPT_TUNE.buyCycle[ver + 1]} s)` : " · top version"}</span>
                </p>
                <ul className="nf-sch-grid" aria-label="Stats and tiers buy.sh may press">
                    {stats.map((st) => {
                        const def = statName(st);
                        const taught = taughtMask(s, st);
                        const mask = a.buy[st] ?? 0;
                        return (
                            <li key={st} style={{ ["--c" as string]: def.color } as CSSProperties}>
                                <button type="button" className="nf-sch-stat" aria-pressed={!!mask} disabled={!taught} onClick={() => { toggleBuyStat(s, st); onChange(); }}>
                                    <i aria-hidden="true" />{def.name}
                                </button>
                                <span className="nf-sch-tiers">
                                    {Array.from({ length: TIERS }, (_, k) => {
                                        const t = !!(taught & (1 << k));
                                        const onK = !!(mask & (1 << k)) && t;
                                        const left = SCRIPT_TUNE.teachTier - Math.floor(a.taught[st]?.[k] ?? 0);
                                        return (
                                            <button
                                                key={k}
                                                type="button"
                                                data-t={t ? "" : undefined}
                                                aria-pressed={onK}
                                                disabled={!t}
                                                title={t ? `T${k + 1} ${onK ? "on" : "off"}` : `Press ${def.name} T${k + 1} by hand ${left} more time${left === 1 ? "" : "s"} to teach it`}
                                                aria-label={t ? `${def.name} T${k + 1}` : `${def.name} T${k + 1}, not taught yet`}
                                                onClick={() => { if (toggleBuyTier(s, st, k)) onChange(); }}
                                            >
                                                T{k + 1}
                                            </button>
                                        );
                                    })}
                                </span>
                            </li>
                        );
                    })}
                </ul>
                <p className="nf-sch-hint">A tier can be pressed by buy.sh once you pressed it by hand {SCRIPT_TUNE.teachTier} times. Hollow tiers are not taught yet.</p>
            </>
        );
    }
    if (id === "reboot") {
        return (
            <>
            <p className="nf-sch-line">
                Reboot when Multipliers reach <Cyc v={`×${a.rebootX}`} label="Reboot at" onPress={() => { cycleSetting(s, "rebootX"); onChange(); }} /> the best tier&apos;s price
                <span>{fmt(a.ran.reboot ?? 0)} Reboots run so far · shares the Watchdog switch</span>
            </p>
            <div className="nf-sch-chains">
                <Tick on={!!a.capWait} label={`wait for a full Capacitor (now ${Math.floor(capCharge(s) * 100)}%)`} onPress={() => { flip(s, "capWait"); onChange(); }} />
                {s.lab.seen && <Tick on={!!a.bombFirst} label={`arm a Logic bomb first when one is stocked (${s.lab.stock.logicbomb ?? 0} in stock)`} onPress={() => { flip(s, "bombFirst"); onChange(); }} />}
            </div>
            </>
        );
    }
    if (id === "rig") {
        const zones = RIG_ZONES.filter((z) => rigOpen(s, z));
        return (
            <>
                <p className="nf-sch-line">
                    upgrade when you hold <Cyc v={`×${a.rigX ?? 5}`} label="Rig reserve" onPress={() => { cycleSetting(s, "rigX"); onChange(); }} /> the price
                    <span>{fmt(a.ran.rig ?? 0)} levels bought so far · runs every {SCRIPT_TUNE.cycle.rig} s · the cheapest level first</span>
                </p>
                <ul className="nf-sch-pay nf-sch-rigs" aria-label="Rigs rig.sh upgrades">
                    {zones.map((z) => {
                        const def = rigDef(z)!;
                        const lv = def.keys.reduce((n, k) => n + rigLv(s, k.key), 0);
                        const cap = rigCap(s, z) * def.keys.length;
                        return (
                            <li key={z} style={{ ["--c" as string]: statName(z).color } as CSSProperties}>
                                <b>{zoneNo(z)} {def.name}</b>
                                <small>lv {lv}/{cap}</small>
                                <button type="button" className="nf-sch-tick" aria-pressed={!!a.rigs?.[z]} onClick={() => { toggleRigZone(s, z); onChange(); }} aria-label={`rig.sh upgrades ${def.name}`}>
                                    <i aria-hidden="true" />{lv >= cap ? "maxed" : "upgrade"}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </>
        );
    }
    if (id === "event") {
        return (
            <>
                <p className="nf-sch-line">
                    Rich vein: <Cyc v={(a.vein ?? "mine") === "mine" ? "mine it now" : "let it run"} label="Rich vein" onPress={() => { cycleAnswer(s, "vein"); onChange(); }} />
                    Fault: <Cyc v={(a.fault ?? "patch") === "patch" ? "patch it" : "wait it out"} label="Fault" onPress={() => { cycleAnswer(s, "fault"); onChange(); }} />
                    <span>{fmt(a.ran.event ?? 0)} answered so far · checks every second</span>
                </p>
                <p className="nf-sch-hint">Mining pays 4 minutes of the zone at once; letting it run doubles it for 4 minutes. A patch costs a little Bytes; a Fault you can&apos;t pay for waits until you can.</p>
            </>
        );
    }
    if (id === "restore") {
        const [t, p] = restoreLeft(s);
        const saved = a.build?.length ?? 0;
        return (
            <>
                <p className="nf-sch-line">
                    {a.rebuild ? "Rebuilding" : "Build saved"}: {saved} tree node{saved === 1 ? "" : "s"} in the order you bought them
                    <span>{a.rebuild ? `${t} node${t === 1 ? "" : "s"} and ranks left, ${p} perk level${p === 1 ? "" : "s"} left · waits for AP` : "it keeps copying your tree as you build it, and rebuilds after each Handover"}</span>
                </p>
                <div className="nf-sch-chains">
                    <Tick on={a.restPerks !== false} label="rebuild perks too, after the tree" onPress={() => { flip(s, "restPerks"); onChange(); }} />
                </div>
            </>
        );
    }
    if (id === "compile" || id === "deploy") {
        const list = PAYLOADS.filter((p) => hasRecipe(s, p.id));
        if (!list.length) return <p className="nf-sch-hint">No payloads yet. Research one in the Exploit Lab and it shows up here.</p>;
        return (
            <ul className="nf-sch-pay" aria-label={id === "compile" ? "Stock levels" : "Payloads to deploy"}>
                {list.map((p) => (
                    <li key={p.id}>
                        <b>{p.name}</b>
                        <small>{s.lab.stock[p.id] ?? 0} in stock</small>
                        {id === "compile" ? (
                            <span className="nf-sch-pv">keep <Cyc v={String(a.stockTo[p.id] ?? 0)} label={`${p.name} stock`} onPress={() => { cycleStock(s, p.id); onChange(); }} /></span>
                        ) : (
                            <button type="button" className="nf-sch-tick" aria-pressed={a.dep.includes(p.id)} onClick={() => { toggleDeploy(s, p.id); onChange(); }} aria-label={`Auto-deploy ${p.name}`}>
                                <i aria-hidden="true" />{p.kind === "buff" ? "when it ends" : p.kind === "charge" ? "keep armed" : p.id === "trojan" ? "outside Overclock" : p.id === "polymorph" ? "with 2 buffs up" : "when stocked"}
                            </button>
                        )}
                    </li>
                ))}
            </ul>
        );
    }
    if (id === "drop") {
        return <p className="nf-sch-line">Opens the Dead drop when full <span>{Math.floor(dropFill(s) * 100)}% full now · {fmt(a.ran.drop ?? 0)} opened</span></p>;
    }
    // ascend
    const target = ascendTarget(s);
    const now = apOnAscend(s);
    const age = runAge(s);
    return (
        <>
            <p className="nf-sch-line">
                Ascend when the AP on offer reaches <Cyc v={`×${a.ascX}`} label="Ascend at" onPress={() => { cycleSetting(s, "ascX"); onChange(); }} /> your last Ascend
                <span>target {fmt(target)} AP · on offer {fmt(now)} AP · run {fmtTime(age)}{age < SCRIPT_TUNE.ascMinSecs ? ` (waits for ${fmtTime(SCRIPT_TUNE.ascMinSecs)})` : ""}</span>
            </p>
            {s.lab.seen && (
                <div className="nf-sch-chains">
                    <Tick on={!!a.zeroFirst} label={`arm a Zero-click first when one is stocked (${s.lab.stock.zeroclick ?? 0} in stock)`} onPress={() => { flip(s, "zeroFirst"); onChange(); }} />
                </div>
            )}
            <p className="nf-sch-hint">Ascend wipes the run, the same as pressing it yourself. It only fires while the game is open, never during time away.</p>
        </>
    );
}
