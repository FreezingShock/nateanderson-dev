"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PixelIcon } from "@/components/cm/pixel-icons";
import { sfx } from "@/lib/sound/sounds";
import { useSoundPrefs } from "@/lib/sound/use-sound";
import {
    GOALS, PERKS, STATS, TIERS, TUNE, apOnAscend, ascend, breach, button, buyPerk, canAscend, checkGoals, derive, exportSave, fmt, fmtTime,
    fresh, isUnlocked, offline, parseSave, press, statDef, tap, tick, type ButtonStat, type State, type StatId,
} from "@/lib/nodefarm/engine";
import { Core, type CoreFeed } from "./core";
import { NfIcon, type NfIconName } from "./icon";

const KEY = "nf-save-v1";
type Tab = "core" | "stats" | "goals" | "ascend" | "menu";
const SIDE: Tab[] = ["goals", "ascend", "menu"];
const TAB_LABEL: Record<Tab, string> = { core: "Core", stats: "Stats", goals: "Goals", ascend: "Ascend", menu: "Menu" };
const CODE = ["bytes", "mult", "reboot", "copper", "silicon", "quartz", "aether"] as const;
const UNLOCK_HINT: Record<string, string> = {
    reboot: "Reach 600 Bytes earned",
    copper: "Reboot once",
    silicon: `Hold ${TUNE.unlockAt.silicon} Copper`,
    quartz: `Hold ${TUNE.unlockAt.quartz} Silicon`,
    aether: `Hold ${TUNE.unlockAt.aether} Quartz`,
};

type Line = { id: number; t: string; text: string; tone?: "good" | "warn" | "hot" };
type Floater = { id: number; x: number; y: number; text: string };

const clock = () => new Date().toTimeString().slice(0, 8);

function load(): State | null {
    try {
        const raw = localStorage.getItem(KEY);
        return raw ? parseSave(raw) : null;
    } catch {
        return null;
    }
}

export function NodeFarm() {
    const g = useRef<State>(null as unknown as State);
    const [ready, setReady] = useState(false);
    const [, bump] = useState(0);
    const [tab, setTab] = useState<Tab>("core");
    const [side, setSide] = useState<Tab>("goals");
    const [lines, setLines] = useState<Line[]>([]);
    const [floaters, setFloaters] = useState<Floater[]>([]);
    const [away, setAway] = useState<{ secs: number; capped: boolean; gain: Record<string, number> } | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [alertAt, setAlertAt] = useState<{ x: number; y: number; id: number } | null>(null);
    const [reduced, setReduced] = useState(false);
    const [confirm, setConfirm] = useState<"" | "ascend" | "reset">("");
    const [ioText, setIoText] = useState("");
    const [ioMsg, setIoMsg] = useState("");
    const [snd, setSnd] = useSoundPrefs();
    const feed = useRef<CoreFeed>({ heat: 0, overclock: false, speed: 0, lastTap: -1e9 });
    const ids = useRef(1);
    const nextAlert = useRef(0);
    const alertEnd = useRef(0);
    const saved = useRef(0);

    const log = useCallback((text: string, tone?: Line["tone"]) => {
        setLines((l) => [...l.slice(-39), { id: ids.current++, t: clock(), text, tone }]);
    }, []);

    // ---- boot: load the save, bank offline time, print the greeting
    useEffect(() => {
        setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        const s = load() ?? fresh();
        const first = s.life.secs === 0 && s.life.taps === 0;
        const gap = (Date.now() - s.at) / 1000;
        g.current = s;
        if (gap > 60 && !first) {
            const r = offline(s, gap);
            setAway({ secs: r.secs, capped: r.capped, gain: r.gain });
        }
        s.at = Date.now();
        nextAlert.current = performance.now() + (TUNE.intrusionEvery[0] + Math.random() * 30) * 1000;
        const greet = first
            ? ["naOS // node.farm online", "Link established. 1 node, no clearance.", "Tap the core to start hacking. Buy Multipliers to grow."]
            : ["naOS // node.farm resumed", `Session restored. ${fmt(s.life.taps)} taps, ${fmt(s.life.reboots)} reboots on record.`];
        greet.forEach((t, i) => setTimeout(() => log(t, i === 0 ? "good" : undefined), 180 + i * 360));
        setReady(true);
    }, [log]);

    // ---- save
    const save = useCallback(() => {
        const s = g.current;
        if (!s) return;
        try {
            s.at = Date.now();
            localStorage.setItem(KEY, JSON.stringify(s));
            saved.current = Date.now();
        } catch {}
    }, []);
    useEffect(() => {
        if (!ready) return;
        const iv = setInterval(save, 5000);
        const hide = () => document.visibilityState === "hidden" && save();
        document.addEventListener("visibilitychange", hide);
        window.addEventListener("pagehide", save);
        return () => {
            clearInterval(iv);
            document.removeEventListener("visibilitychange", hide);
            window.removeEventListener("pagehide", save);
            save();
        };
    }, [ready, save]);

    // ---- the game loop: 10 ticks a second, real elapsed time, so a throttled background tab catches up on return
    useEffect(() => {
        if (!ready) return;
        const iv = setInterval(() => {
            const s = g.current;
            const now = Date.now();
            const gap = (now - s.at) / 1000;
            s.at = now;
            if (gap > 3) {
                const r = offline(s, gap);
                if (gap > 60) setAway({ secs: r.secs, capped: r.capped, gain: r.gain });
            } else tick(s, Math.max(0, gap));
            const d = derive(s);
            const f = feed.current;
            f.heat = s.combo;
            f.overclock = s.overclock > 0;
            f.speed = Math.min(1, Math.log10(1 + d.bytesPerSec) / 12);
            // intrusion
            const pn = performance.now();
            if (alertEnd.current && pn > alertEnd.current) {
                alertEnd.current = 0;
                setAlertAt(null);
                log("Intrusion lost. The trace went cold.", "warn");
                nextAlert.current = pn + (TUNE.intrusionEvery[0] + Math.random() * (TUNE.intrusionEvery[1] - TUNE.intrusionEvery[0])) * 1000;
            } else if (!alertEnd.current && pn > nextAlert.current && !document.hidden && s.life.reboots + s.mult >= 5) {
                alertEnd.current = pn + TUNE.intrusionLife * 1000;
                setAlertAt({ x: 8 + Math.random() * 78, y: 22 + Math.random() * 60, id: ids.current++ });
                sfx("nfAlert");
                log("INTRUSION DETECTED. Trace it before it closes.", "hot");
            }
            for (const goal of checkGoals(s)) {
                log(`Goal: ${goal.name}`, "good");
                setToast(goal.name);
                sfx("nfGoal");
                setTimeout(() => setToast((t) => (t === goal.name ? null : t)), 3200);
            }
            bump((n) => n + 1);
        }, 100);
        return () => clearInterval(iv);
    }, [ready, log]);

    // ---- actions
    const doTap = useCallback((x?: number, y?: number) => {
        const s = g.current;
        const v = tap(s);
        feed.current.lastTap = performance.now();
        sfx("nfTap", { heat: s.combo });
        const id = ids.current++;
        setFloaters((f) => [...f.slice(-9), { id, x: x ?? 50, y: y ?? 40, text: `+${fmt(v)}` }]);
        setTimeout(() => setFloaters((f) => f.filter((q) => q.id !== id)), 900);
    }, []);

    const doPress = useCallback(
        (stat: ButtonStat, tier: number, quiet = false) => {
            const s = g.current;
            const was = s.reboot;
            if (!press(s, stat, tier)) {
                if (!quiet) sfx("deny");
                return false;
            }
            if (stat === "reboot") {
                sfx("nfReboot");
                log(`REBOOT x${fmt(s.reboot - was)}. Cache wiped, power up. Reboots: ${fmt(s.reboot)}`, "good");
                setFloaters([]);
            } else sfx("nfBuy", { tier });
            bump((n) => n + 1);
            return true;
        },
        [log],
    );

    const doBreach = () => {
        const s = g.current;
        breach(s);
        alertEnd.current = 0;
        setAlertAt(null);
        nextAlert.current = performance.now() + (TUNE.intrusionEvery[0] + Math.random() * (TUNE.intrusionEvery[1] - TUNE.intrusionEvery[0])) * 1000;
        sfx("nfBreach");
        log(`BREACH. Overclock x${TUNE.overclockMult} for ${TUNE.overclockSecs + s.perks.overclock * 5} s.`, "good");
    };

    const doAscend = () => {
        if (confirm !== "ascend") {
            setConfirm("ascend");
            setTimeout(() => setConfirm((c) => (c === "ascend" ? "" : c)), 4000);
            return;
        }
        const gain = ascend(g.current);
        setConfirm("");
        if (gain) {
            sfx("nfAscend");
            log(`ASCENDED. +${gain} Ascension Points. Everything else was wiped.`, "good");
            setFloaters([]);
            setSide("ascend");
            save();
        }
    };

    const doReset = () => {
        if (confirm !== "reset") {
            setConfirm("reset");
            setTimeout(() => setConfirm((c) => (c === "reset" ? "" : c)), 4000);
            return;
        }
        g.current = fresh();
        setConfirm("");
        setLines([]);
        log("Save wiped. Starting clean.", "warn");
        save();
    };

    const s = g.current;
    const d = useMemo(() => (s ? derive(s) : null), [s, s?.bytes]); // eslint-disable-line react-hooks/exhaustive-deps
    if (!ready || !s || !d) {
        return (
            <div className="nf nf-boot" role="status">
                <span className="nf-boot-t">naOS // node.farm</span>
                <span>Linking node…</span>
            </div>
        );
    }

    const sideShown = SIDE.includes(tab) ? tab : side;
    const setTabBoth = (t: Tab) => {
        setTab(t);
        if (SIDE.includes(t)) setSide(t);
        sfx("tab");
    };

    return (
        <div className="nf" data-tab={tab} data-side={sideShown} data-oc={s.overclock > 0 ? "" : undefined}>
            <header className="nf-hud">
                <div className="nf-hud-main">
                    <NfIcon name="bytes" responsive />
                    <div>
                        <b className="nf-big">{fmt(s.bytes)}</b>
                        <span className="nf-sub">Bytes · +{fmt(d.bytesPerSec)}/s</span>
                    </div>
                </div>
                {s.overclock > 0 && (
                    <div className="nf-oc" role="status">
                        <NfIcon name="spark" /> OVERCLOCK x{TUNE.overclockMult} · {Math.ceil(s.overclock)}s
                    </div>
                )}
                <div className="nf-hud-side">
                    <span><NfIcon name="reboot" /> {fmt(s.reboot)}</span>
                    <span><NfIcon name="mult" /> {fmt(s.mult)}</span>
                    {s.ap > 0 && <span><NfIcon name="ascend" /> {s.ap} AP</span>}
                </div>
            </header>

            <nav className="nf-tabs" aria-label="Game sections">
                {(["core", "stats", "goals", "ascend", "menu"] as Tab[]).map((t) => (
                    <button key={t} type="button" className="nf-tab" aria-pressed={tab === t} data-tab-btn={t} data-desk={SIDE.includes(t) ? "" : undefined} onClick={() => setTabBoth(t)}>
                        {TAB_LABEL[t]}
                    </button>
                ))}
            </nav>

            {toast && <div className="nf-toast" role="status"><NfIcon name="spark" /> Goal: {toast}</div>}

            {alertAt && (
                <button type="button" key={alertAt.id} className="nf-alert" style={{ left: `${alertAt.x}%`, top: `${alertAt.y}%`, ["--life" as string]: `${TUNE.intrusionLife}s` }} onClick={doBreach} aria-label="Intrusion detected. Press to trace it for a timed Overclock boost.">
                    <NfIcon name="alert" large />
                    <span>TRACE</span>
                </button>
            )}

            <section className="nf-pane nf-corepane" data-pane="core" aria-label="Core">
                <div className="nf-core-wrap">
                    <button
                        type="button"
                        className="nf-core"
                        aria-label={`Hack the core: +${fmt(d.tapValue)} Bytes per tap`}
                        onPointerDown={(e) => {
                            if (e.pointerType === "mouse" && e.button !== 0) return;
                            const r = e.currentTarget.getBoundingClientRect();
                            doTap(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
                        }}
                        onClick={(e) => e.detail === 0 && doTap()}
                        onContextMenu={(e) => e.preventDefault()}
                    >
                        <Core feed={feed} reduced={reduced} />
                        <span className="nf-core-tag">TAP TO HACK</span>
                    </button>
                    <div className="nf-floaters" aria-hidden="true">
                        {floaters.map((f) => (
                            <span key={f.id} className="nf-float" style={{ left: `${f.x}%`, top: `${f.y}%` }}>{f.text}</span>
                        ))}
                    </div>
                </div>
                <dl className="nf-readout">
                    <div><dt>Per tap</dt><dd>+{fmt(d.tapValue)}</dd></div>
                    <div><dt>Heat</dt><dd>{Math.round(s.combo * 100)}%</dd></div>
                    <div><dt>Global</dt><dd>×{fmt(d.global)}</dd></div>
                </dl>
                {away && (
                    <div className="nf-away" role="status">
                        <b>While you were gone · {fmtTime(away.secs)}{away.capped ? " (cap)" : ""}</b>
                        <span>
                            +{fmt(away.gain.bytes)} Bytes
                            {away.gain.copper > 0 && ` · +${fmt(away.gain.copper)} Cu`}
                            {away.gain.silicon > 0 && ` · +${fmt(away.gain.silicon)} Si`}
                            {away.gain.quartz > 0 && ` · +${fmt(away.gain.quartz)} Qz`}
                            {away.gain.aether > 0 && ` · +${fmt(away.gain.aether)} Ae`}
                        </span>
                        <button type="button" className="nf-mini" onClick={() => setAway(null)}>Dismiss</button>
                    </div>
                )}
                <ol className="nf-log" aria-label="Event log" role="log" aria-live="polite">
                    {lines.slice(-7).map((l) => (
                        <li key={l.id} data-tone={l.tone}>
                            <time>{l.t}</time> <span>{l.text}</span>
                        </li>
                    ))}
                </ol>
            </section>

            <section className="nf-pane nf-statspane" data-pane="stats" aria-label="Stats and buttons">
                {STATS.map((def) => (
                    <StatRow key={def.id} id={def.id} s={s} d={d} onPress={doPress} />
                ))}
            </section>

            <section className="nf-pane nf-sidepane" data-pane="goals" aria-label="Goals">
                <h3 className="nf-h">Goals <small>{s.ach.length}/{GOALS.length} · +{Math.round(s.ach.length * TUNE.achBonus * 100)}% to everything</small></h3>
                <ul className="nf-goals">
                    {[...GOALS].sort((a, b) => Number(s.ach.includes(a.id)) - Number(s.ach.includes(b.id))).map((q) => {
                        const done = s.ach.includes(q.id);
                        return (
                            <li key={q.id} data-done={done ? "" : undefined}>
                                <PixelIcon name={done ? "check" : "target"} size={12} />
                                <span><b>{q.name}</b><small>{q.hint}</small></span>
                            </li>
                        );
                    })}
                </ul>
            </section>

            <section className="nf-pane nf-sidepane" data-pane="ascend" aria-label="Ascend">
                <h3 className="nf-h">Ascend <small>{s.ap} AP to spend</small></h3>
                <div className="nf-asc">
                    <NfIcon name="ascend" large />
                    <p>
                        Wipe everything except goals, perks and lifetime stats, and earn Ascension Points. Each point adds +{TUNE.apBonus * 100}% to everything, forever. You need {fmt(TUNE.ascendAether)} Aether.
                    </p>
                    <div className="nf-bar" role="progressbar" aria-valuemin={0} aria-valuemax={TUNE.ascendAether} aria-valuenow={Math.min(s.aether, TUNE.ascendAether)} aria-label="Aether toward Ascend"><i style={{ width: `${Math.min(100, (s.aether / TUNE.ascendAether) * 100)}%` }} /></div>
                    <button type="button" className="nf-ascend" disabled={!canAscend(s)} onClick={doAscend}>
                        {canAscend(s) ? (confirm === "ascend" ? `Confirm: wipe and gain ${apOnAscend(s)} AP` : `Ascend for ${apOnAscend(s)} AP`) : `Locked: ${fmt(s.aether)} / ${fmt(TUNE.ascendAether)} Aether`}
                    </button>
                </div>
                <ul className="nf-perks">
                    {PERKS.map((p) => {
                        const lvl = s.perks[p.id];
                        const cost = p.cost(lvl);
                        const maxed = lvl >= p.max;
                        return (
                            <li key={p.id}>
                                <span><b>{p.name} <em>{lvl}/{p.max}</em></b><small>{p.blurb}</small></span>
                                <button type="button" className="nf-mini" disabled={maxed || s.ap < cost} onClick={() => { if (buyPerk(s, p.id)) { sfx("nfBuy", { tier: 3 }); bump((n) => n + 1); } }}>
                                    {maxed ? "Max" : `${cost} AP`}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </section>

            <section className="nf-pane nf-sidepane" data-pane="menu" aria-label="Menu">
                <h3 className="nf-h">Menu <small>saved on this device</small></h3>
                <dl className="nf-readout nf-facts">
                    <div><dt>Played</dt><dd>{fmtTime(s.life.secs)}</dd></div>
                    <div><dt>Taps</dt><dd>{fmt(s.life.taps)}</dd></div>
                    <div><dt>Bytes ever</dt><dd>{fmt(s.life.bytes)}</dd></div>
                    <div><dt>Reboots ever</dt><dd>{fmt(s.life.reboots)}</dd></div>
                    <div><dt>Intrusions</dt><dd>{s.life.intrusions}</dd></div>
                    <div><dt>Ascensions</dt><dd>{s.life.ascends}</dd></div>
                </dl>
                <div className="nf-menu-row">
                    <button type="button" className="nf-mini" aria-pressed={snd.on} onClick={() => setSnd({ on: !snd.on })}>Sound: {snd.on ? "on" : "off"}</button>
                    <button type="button" className="nf-mini" onClick={() => { save(); setIoText(exportSave(g.current)); setIoMsg("Copy this code to move your save."); navigator.clipboard?.writeText(exportSave(g.current)).then(() => setIoMsg("Save code copied.")).catch(() => {}); }}>Export</button>
                    <button type="button" className="nf-mini" onClick={() => { const n = parseSave(ioText); if (n) { n.at = Date.now(); g.current = n; save(); setIoMsg("Save loaded."); log("Save imported.", "good"); } else setIoMsg("That code isn't a Node Farm save."); }}>Import</button>
                    <button type="button" className="nf-mini nf-danger" onClick={doReset}>{confirm === "reset" ? "Confirm wipe" : "Reset"}</button>
                </div>
                <label className="nf-io">
                    <span>Save code</span>
                    <textarea value={ioText} onChange={(e) => setIoText(e.target.value)} rows={3} spellCheck={false} placeholder="Export to get a code, or paste one here and press Import." />
                </label>
                {ioMsg && <p className="nf-io-msg" role="status">{ioMsg}</p>}
            </section>
        </div>
    );
}

// ---- one stat: header (icon, amount, rate, boosts) and its six buttons
function StatRow({ id, s, d, onPress }: { id: StatId; s: State; d: ReturnType<typeof derive>; onPress: (stat: ButtonStat, tier: number, quiet?: boolean) => boolean }) {
    const def = statDef(id);
    const open = isUnlocked(s, id);
    const icon = id as NfIconName;
    if (!open) {
        return (
            <article className="nf-row nf-locked" style={{ ["--c" as string]: def.color }}>
                <NfIcon name="lock" />
                <div>
                    <b>ENCRYPTED // {def.name}</b>
                    <small>{UNLOCK_HINT[id]} to decrypt.</small>
                </div>
            </article>
        );
    }
    const amt = s[id] as number;
    const rate = id === "bytes" ? d.bytesPerSec : id === "copper" || id === "silicon" || id === "quartz" || id === "aether" ? d.rates[id] : 0;
    const chips: string[] = [];
    if (id === "mult") chips.push(`Buttons ×${fmt(d.multGainMult)}`);
    if (id === "reboot") chips.push(`Each Reboot: +${fmt(d.rebootStrength * 100)}% to Multiplier buttons`);
    if (id === "copper") chips.push(`Reboot power ×${fmt(d.boosts.cuReboot)}`, `Bytes ×${fmt(d.boosts.cuBytes)}`);
    if (id === "silicon") chips.push(`Copper ×${fmt(d.boosts.siCu)}`);
    if (id === "quartz") chips.push(`Silicon ×${fmt(d.boosts.qzSi)}`);
    if (id === "aether") chips.push(`Quartz ×${fmt(d.boosts.aeQz)}`);
    const prod = id === "copper" || id === "silicon" || id === "quartz" || id === "aether" ? s.prod[id] : 0;
    return (
        <article className="nf-row" style={{ ["--c" as string]: def.color }} data-stat={id}>
            <header className="nf-row-h">
                <NfIcon name={icon} responsive />
                <div className="nf-row-t">
                    <b>{def.name} <em>{def.short}</em></b>
                    <small>{def.role}</small>
                </div>
                <div className="nf-row-n">
                    <b>{fmt(amt)}</b>
                    {rate > 0 && <small>+{fmt(rate)}/s</small>}
                    {prod > 0 && <small>{fmt(prod)} nodes</small>}
                </div>
            </header>
            {chips.length > 0 && <ul className="nf-chips">{chips.map((c) => <li key={c}>{c}</li>)}</ul>}
            {id !== "bytes" && (
                <div className="nf-btns">
                    {Array.from({ length: TIERS }, (_, k) => (
                        <BuyBtn key={k} s={s} stat={id as ButtonStat} tier={k} onPress={onPress} />
                    ))}
                </div>
            )}
        </article>
    );
}

// A buy button. Press once to buy; hold to keep buying (starts after 0.4 s, then 10 a second).
function BuyBtn({ s, stat, tier, onPress }: { s: State; stat: ButtonStat; tier: number; onPress: (stat: ButtonStat, tier: number, quiet?: boolean) => boolean }) {
    const b = button(s, stat, tier);
    const pays = statDef(b.pays);
    const afford = (s[b.pays] as number) >= b.cost;
    const t = useRef<ReturnType<typeof setTimeout> | null>(null);
    const iv = useRef<ReturnType<typeof setInterval> | null>(null);
    const stop = () => {
        if (t.current) clearTimeout(t.current);
        if (iv.current) clearInterval(iv.current);
        t.current = iv.current = null;
    };
    useEffect(() => stop, []);
    const isReboot = stat === "reboot";
    return (
        <button
            type="button"
            className="nf-btn"
            data-afford={afford ? "" : undefined}
            data-tier={tier}
            data-reboot={isReboot ? "" : undefined}
            aria-label={`${isReboot ? "Reboot for" : "Buy"} +${fmt(b.gain)} ${statDef(stat).name} for ${fmt(b.cost)} ${pays.name}`}
            onPointerDown={(e) => {
                if (e.pointerType === "mouse" && e.button !== 0) return;
                onPress(stat, tier);
                if (isReboot) return;
                stop();
                t.current = setTimeout(() => {
                    iv.current = setInterval(() => {
                        if (!onPress(stat, tier, true)) stop();
                    }, 100);
                }, 400);
            }}
            onPointerUp={stop}
            onPointerLeave={stop}
            onPointerCancel={stop}
            onClick={(e) => e.detail === 0 && onPress(stat, tier)}
            onContextMenu={(e) => e.preventDefault()}
        >
            <span className="nf-btn-g">{isReboot ? "REBOOT " : "+"}{fmt(b.gain)}</span>
            <span className="nf-btn-c">{fmt(b.cost)} {pays.short}</span>
        </button>
    );
}
