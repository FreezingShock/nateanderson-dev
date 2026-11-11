"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sfx } from "@/lib/sound/sounds";
import { useSoundPrefs } from "@/lib/sound/use-sound";
import {
    TUNE, ascend, autoBuy, breach, button, buyPerk, checkGoals, derive, exportSave, fmt, fmtTime, fresh, isUnlocked, offline, parseSave, press, STATS, tick,
    type ButtonStat, type State,
} from "@/lib/nodefarm/engine";
import { Core, type CoreFeed } from "./core";
import { NfIcon } from "./icon";
import { Hack } from "./hack";
import { Chain, StatRow } from "./stat-row";
import { AscendPanel, GoalsPanel, MenuPanel } from "./systems";

const KEY = "nf-save-v1";
type Tab = "core" | "stats" | "goals" | "ascend" | "menu";
const SIDE: Tab[] = ["goals", "ascend", "menu"];
const TAB_LABEL: Record<Tab, string> = { core: "Core", stats: "Stats", goals: "Goals", ascend: "Ascend", menu: "Menu" };
type Line = { id: number; t: string; text: string; tone?: "good" | "warn" | "hot" };

const gapMs = (s: State) => (TUNE.intrusionEvery[0] + Math.random() * (TUNE.intrusionEvery[1] - TUNE.intrusionEvery[0])) * 1000 * Math.max(0.4, 1 - s.perks.scanner * 0.08);
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
    const [away, setAway] = useState<{ secs: number; capped: boolean; gain: Record<string, number> } | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [alertAt, setAlertAt] = useState<{ x: number; y: number; id: number } | null>(null);
    const [hack, setHack] = useState(false);
    const [reduced, setReduced] = useState(false);
    const [confirm, setConfirm] = useState<"" | "ascend" | "reset">("");
    const [ioText, setIoText] = useState("");
    const [ioMsg, setIoMsg] = useState("");
    const [snd, setSnd] = useSoundPrefs();
    const feed = useRef<CoreFeed>({ progress: 0, overclock: false, unlocked: 1, speed: 0, lastPulse: -1e9 });
    const ids = useRef(1);
    const nextAlert = useRef(0);
    const alertEnd = useRef(0);
    const saved = useRef(0);
    const tickN = useRef(0);

    const log = useCallback((text: string, tone?: Line["tone"]) => {
        setLines((l) => [...l.slice(-39), { id: ids.current++, t: clock(), text, tone }]);
    }, []);

    // ---- boot: load the save, bank offline time, print the greeting
    useEffect(() => {
        setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        const s = load() ?? fresh();
        const first = s.life.secs === 0 && s.life.presses === 0;
        const gap = (Date.now() - s.at) / 1000;
        g.current = s;
        if (gap > 60 && !first) {
            const r = offline(s, gap);
            setAway({ secs: r.secs, capped: r.capped, gain: r.gain });
        }
        s.at = Date.now();
        nextAlert.current = performance.now() + gapMs(s);
        const greet = first
            ? ["naOS // node.farm online", "Link established. 1 node, no clearance.", "Buy your first Multiplier. The core grows with everything you build."]
            : ["naOS // node.farm resumed", `Session restored. ${fmt(s.life.presses)} buttons pressed, ${fmt(s.life.reboots)} reboots on record.`];
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

    const scheduleAlert = useCallback(() => {
        nextAlert.current = performance.now() + gapMs(g.current);
    }, []);

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
            if (++tickN.current % 10 === 0 && s.perks.auto > 0) autoBuy(s);
            const d = derive(s);
            const f = feed.current;
            f.progress = Math.min(1, s.mult / button(s, "reboot", 0).cost);
            f.overclock = s.overclock > 0;
            f.speed = Math.min(1, Math.log10(1 + d.bytesPerSec) / 12);
            f.unlocked = STATS.filter((x) => isUnlocked(s, x.id)).length;
            // intrusion: a target appears, you have a few seconds to open it
            const pn = performance.now();
            if (alertEnd.current && pn > alertEnd.current) {
                alertEnd.current = 0;
                setAlertAt(null);
                log("Intrusion lost. The trace went cold.", "warn");
                scheduleAlert();
            } else if (!alertEnd.current && !hack && pn > nextAlert.current && !document.hidden && s.life.reboots + s.mult >= 5) {
                alertEnd.current = pn + TUNE.intrusionLife * 1000;
                setAlertAt({ x: 8 + Math.random() * 78, y: 22 + Math.random() * 60, id: ids.current++ });
                sfx("nfAlert");
                log("INTRUSION DETECTED. Open the trace before it closes.", "hot");
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
    }, [ready, log, hack, scheduleAlert]);

    // ---- actions
    const doPress = useCallback(
        (stat: ButtonStat, tier: number, quiet = false) => {
            const s = g.current;
            const was = s.reboot;
            if (!press(s, stat, tier)) {
                if (!quiet) sfx("deny");
                return false;
            }
            feed.current.lastPulse = performance.now();
            if (stat === "reboot") {
                sfx("nfReboot");
                log(`REBOOT x${fmt(s.reboot - was)}. Cache wiped, power up. Reboots: ${fmt(s.reboot)}`, "good");
            } else sfx("nfBuy", { tier });
            bump((n) => n + 1);
            return true;
        },
        [log],
    );

    const openHack = () => {
        alertEnd.current = 0;
        setAlertAt(null);
        setHack(true);
        sfx("open");
    };
    const hackDone = (won: boolean) => {
        setHack(false);
        const s = g.current;
        scheduleAlert();
        if (won) {
            breach(s);
            sfx("nfBreach");
            log(`TRACE WON. Overclock x${TUNE.overclockMult} for ${TUNE.overclockSecs + s.perks.overclock * 5} s.`, "good");
        } else log("Trace failed. They got away.", "warn");
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
                    <button key={t} type="button" className="nf-tab" aria-pressed={tab === t} data-tab-btn={t} onClick={() => setTabBoth(t)}>
                        {TAB_LABEL[t]}
                    </button>
                ))}
            </nav>

            {toast && <div className="nf-toast" role="status"><NfIcon name="spark" /> Goal: {toast}</div>}

            {alertAt && (
                <button type="button" key={alertAt.id} className="nf-alert" style={{ left: `${alertAt.x}%`, top: `${alertAt.y}%`, ["--life" as string]: `${TUNE.intrusionLife}s` }} onClick={openHack} aria-label="Intrusion detected. Open the trace for a timed Overclock boost.">
                    <NfIcon name="alert" large />
                    <span>TRACE</span>
                </button>
            )}
            {hack && <Hack onDone={hackDone} />}

            <section className="nf-pane nf-corepane" data-pane="core" aria-label="Core">
                <div className="nf-core-wrap">
                    <div className="nf-core" role="img" aria-label={`Reactor core. ${fmt(d.bytesPerSec)} Bytes per second.`}>
                        <Core feed={feed} reduced={reduced} />
                        <span className="nf-core-tag">NODE 01 // ONLINE</span>
                    </div>
                </div>
                <dl className="nf-readout">
                    <div><dt>Bytes/s</dt><dd>{fmt(d.bytesPerSec)}</dd></div>
                    <div><dt>Reboot</dt><dd>{Math.round(feed.current.progress * 100)}%</dd></div>
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
                <Chain s={s} d={d} />
                {STATS.map((def) => (
                    <StatRow key={def.id} id={def.id} s={s} d={d} onPress={doPress} />
                ))}
            </section>

            <section className="nf-pane nf-sidepane" data-pane="goals" aria-label="Goals"><GoalsPanel s={s} /></section>
            <section className="nf-pane nf-sidepane" data-pane="ascend" aria-label="Ascend">
                <AscendPanel s={s} d={d} confirm={confirm === "ascend"} onAscend={doAscend} onPerk={(id) => { if (buyPerk(s, id)) { sfx("nfBuy", { tier: 3 }); bump((n) => n + 1); } }} />
            </section>
            <section className="nf-pane nf-sidepane" data-pane="menu" aria-label="Menu">
                <MenuPanel
                    s={s}
                    soundOn={snd.on}
                    onSound={() => setSnd({ on: !snd.on })}
                    ioText={ioText}
                    setIoText={setIoText}
                    ioMsg={ioMsg}
                    onExport={() => { save(); const code = exportSave(g.current); setIoText(code); setIoMsg("Copy this code to move your save."); navigator.clipboard?.writeText(code).then(() => setIoMsg("Save code copied.")).catch(() => {}); }}
                    onImport={() => { const n = parseSave(ioText); if (n) { n.at = Date.now(); g.current = n; save(); setIoMsg("Save loaded."); log("Save imported.", "good"); } else setIoMsg("That code isn't a Node Farm save."); }}
                    confirm={confirm === "reset"}
                    onReset={doReset}
                />
            </section>
        </div>
    );
}
