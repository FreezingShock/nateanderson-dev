"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sfx } from "@/lib/sound/sounds";
import { setHum } from "@/lib/sound/engine";
import { useSoundPrefs } from "@/lib/sound/use-sound";
import {
    TUNE, ascend, autoBuy, breach, button, buyDrone, buyNode, buyPerk, toggleArm, checkGoals, derive, exportSave, fmt, fmtTime, fresh, isUnlocked, offline, parseSave, press, STATS, tick,
    type ButtonStat, type State,
} from "@/lib/nodefarm/engine";
import type { NfLive } from "@/lib/nodefarm/records";
import { Core, type CoreFeed } from "./core";
import { NfIcon } from "./icon";
import { AwayReport, type Away } from "./away";
import { Hack } from "./hack";
import { DroneBay } from "./drones";
import { Chain, StatRow } from "./stat-row";
import { Juice, juice, checkMilestones } from "./juice";
import { GuideStrip, Tip, TipCtx, type TipApi, type TipState } from "./guide";
import { MapPanel } from "./map";
import { nextStep, type Target } from "@/lib/nodefarm/guide";
import { AscendPanel, GoalsPanel, MenuPanel, RecordsPanel } from "./systems";

const KEY = "nf-save-v1";
const HUM_KEY = "nf-hum-v1"; // reactor hum on or off (per device)
const UI_KEY = "nf-ui-v1"; // which stat panels are minimized (per device, not part of the game save)
type Tab = "core" | "stats" | "map" | "goals" | "records" | "ascend" | "menu";
const SIDE: Tab[] = ["map", "goals", "records", "ascend", "menu"];
const TAB_LABEL: Record<Tab, string> = { core: "Core", stats: "Stats", map: "Map", goals: "Goals", records: "Records", ascend: "Ascend", menu: "Menu" };
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
    const [win, setWin] = useState<"" | "map" | "goals" | "records" | "ascend" | "menu">("");
    const [folded, setFolded] = useState<Record<string, boolean>>({});
    const [lines, setLines] = useState<Line[]>([]);
    const [away, setAway] = useState<Away | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [alertAt, setAlertAt] = useState<{ x: number; y: number; id: number } | null>(null);
    const [hack, setHack] = useState(false);
    const [reduced, setReduced] = useState(false);
    const [confirm, setConfirm] = useState<"" | "ascend" | "reset">("");
    const [ioText, setIoText] = useState("");
    const [ioMsg, setIoMsg] = useState("");
    useEffect(() => {
        if (!win) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setWin(""); };
        window.addEventListener("keydown", onKey);
        // a settled scroll-reveal leaves a transform on the section, which would pin fixed windows to the section instead of the viewport
        document.body.classList.add("nf-win-open");
        document.querySelector<HTMLElement>(`.nf [data-pane="${win}"] .nf-win-x`)?.focus();
        return () => { window.removeEventListener("keydown", onKey); document.body.classList.remove("nf-win-open"); };
    }, [win]);
    const [snd, setSnd] = useSoundPrefs();
    const [hum, setHumOn] = useState(true);
    const humRef = useRef(true);
    const prevUnlocked = useRef(0);
    const prevIds = useRef<string[] | null>(null);
    const toggleHum = () => {
        const next = !humRef.current;
        humRef.current = next;
        setHumOn(next);
        try {
            localStorage.setItem(HUM_KEY, next ? "1" : "0");
        } catch {}
        if (!next) setHum(null);
    };
    // tooltips: one layer at the root, driven from the buttons (hover and focus on desktop, a short flash after a tap on touch)
    const root = useRef<HTMLDivElement>(null);
    const [tip, setTip] = useState<TipState | null>(null);
    const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const tipApi = useMemo<TipApi>(
        () => ({
            show: (el, build, o) => {
                if (tipTimer.current) clearTimeout(tipTimer.current);
                tipTimer.current = null;
                setTip({ el, build, guided: o?.guided });
                if (o?.ms) tipTimer.current = setTimeout(() => setTip((t) => (t?.el === el ? null : t)), o.ms);
            },
            hide: (el) => {
                if (tipTimer.current) clearTimeout(tipTimer.current);
                tipTimer.current = null;
                setTip((t) => (!el || t?.el === el ? null : t));
            },
        }),
        [],
    );
    const feed = useRef<CoreFeed>({ progress: 0, overclock: false, unlocked: 1, speed: 0, lastPulse: -1e9, reboots: 0, ap: 0 });
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
        try {
            const u = localStorage.getItem(UI_KEY);
            if (u) setFolded(JSON.parse(u));
            if (localStorage.getItem(HUM_KEY) === "0") {
                humRef.current = false;
                setHumOn(false);
            }
        } catch {}
        const s = load() ?? fresh();
        const first = s.life.secs === 0 && s.life.presses === 0;
        const gap = (Date.now() - s.at) / 1000;
        g.current = s;
        if (gap > 60 && !first) {
            const r = offline(s, gap);
            if (r.capped) s.life.capped += 1;
            setAway({ ...r, gap, cap: derive(s).offlineCap });
        }
        s.at = Date.now();
        nextAlert.current = performance.now() + gapMs(s);
        const greet = first
            ? ["naOS // node.farm online", "Link established. 1 node, no clearance.", "Buy your first Multiplier. The core grows with everything you build."]
            : ["naOS // node.farm resumed", `Session restored. ${fmt(s.life.presses)} buttons pressed, ${fmt(s.life.reboots)} reboots on record.`];
        greet.forEach((t, i) => setTimeout(() => log(t, i === 0 ? "good" : undefined), 180 + i * 360));
        setReady(true);
    }, [log]);

    // ---- the naOS console's `nf` command asks for the live state here (see components/cm/console.tsx)
    useEffect(() => {
        if (!ready) return;
        const onLive = (e: Event) => {
            (e as CustomEvent<{ live?: NfLive }>).detail.live = {
                s: g.current,
                notify: (found) => {
                    for (const f of found) {
                        log(`Secret found: ${f.name}`, "good");
                        setToast(f.name);
                        sfx("nfGoal");
                        setTimeout(() => setToast((t) => (t === f.name ? null : t)), 3200);
                    }
                    bump((n) => n + 1);
                },
            };
        };
        window.addEventListener("nf:live", onLive);
        return () => window.removeEventListener("nf:live", onLive);
    }, [ready, log]);

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

    const setFold = useCallback((next: Record<string, boolean>) => {
        setFolded(next);
        try {
            localStorage.setItem(UI_KEY, JSON.stringify(next));
        } catch {}
    }, []);

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
                if (gap > 60 && r.capped) s.life.capped += 1;
                if (gap > 60) setAway({ ...r, gap, cap: derive(s).offlineCap });
            } else tick(s, Math.max(0, gap));
            if (++tickN.current % 10 === 0 && s.perks.auto > 0) autoBuy(s);
            const d = derive(s);
            const f = feed.current;
            f.progress = Math.min(1, s.mult / button(s, "reboot", 0).cost);
            f.overclock = s.overclock > 0;
            f.speed = Math.min(1, Math.log10(1 + d.bytesPerSec) / 12);
            const openIds = STATS.filter((x) => isUnlocked(s, x.id)).map((x) => x.id);
            f.unlocked = openIds.length;
            if (prevIds.current) for (const id of openIds) if (!prevIds.current.includes(id)) juice.emit({ t: "unlock", id });
            prevIds.current = openIds;
            if (tickN.current % 10 === 5) checkMilestones(s, d.bytesPerSec);
            f.reboots = s.reboot;
            f.ap = s.ap;
            if (prevUnlocked.current && f.unlocked > prevUnlocked.current) sfx("nfDecrypt");
            prevUnlocked.current = f.unlocked;
            setHum(humRef.current ? { level: Math.min(1, f.speed * 0.75 + (f.unlocked / 7) * 0.25), boost: f.overclock } : null);
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
                log(goal.secret ? `Secret found: ${goal.name}` : `Goal: ${goal.name}`, "good");
                setToast(goal.name);
                sfx("nfGoal");
                setTimeout(() => setToast((t) => (t === goal.name ? null : t)), 3200);
            }
            bump((n) => n + 1);
        }, 100);
        return () => {
            clearInterval(iv);
            setHum(null);
        };
    }, [ready, log, hack, scheduleAlert]);

    // ---- actions
    const doPress = useCallback(
        (stat: ButtonStat, tier: number, quiet = false) => {
            const s = g.current;
            const was = s.reboot;
            const owned = stat === "reboot" ? 0 : s.bought[stat][tier];
            const gainNow = button(s, stat, tier).gain;
            if (!press(s, stat, tier)) {
                if (!quiet) sfx("deny");
                return false;
            }
            feed.current.lastPulse = performance.now();
            juice.emit({ t: "press", stat, tier, gain: gainNow, quiet });
            if (owned === 0 && tier > 0 && !quiet && stat !== "reboot") juice.emit({ t: "tier", stat, tier });
            if (stat === "reboot") {
                sfx("nfReboot");
                log(`REBOOT x${fmt(s.reboot - was)}. Cache wiped, power up. Reboots: ${fmt(s.reboot)}`, "good");
            } else if (owned === 0 && tier > 0 && !quiet) sfx("nfTierUp", { tier });
            else sfx("nfBuy", { tier, stat });
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
            juice.emit({ t: "ascend", gain, ap: g.current.ap, n: g.current.life.ascends });
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
        prevIds.current = null;
        tipApi.hide();
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
    const openWin = (w: "map" | "goals" | "records" | "ascend" | "menu") => {
        setWin(w);
        setTabBoth(w);
    };
    // the next-step guide: what to do, and a button that opens the right zone and scrolls to what glows
    const step = nextStep(s, d);
    const goTo = (t?: Target) => {
        if (!t) return;
        if (t.win) return openWin(t.win);
        setTab("stats");
        const key = t.drone !== undefined ? "drones" : t.stat;
        if (!key) return;
        if (folded[key]) setFold({ ...folded, [key]: false });
        sfx("tab");
        setTimeout(() => document.querySelector<HTMLElement>(`.nf [data-stat="${key}"]`)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" }), 90);
    };
    const firstLocked = STATS.find((x) => !isUnlocked(s, x.id))?.id;
    const laterLocked = STATS.filter((x) => !isUnlocked(s, x.id) && x.id !== firstLocked);
    const guideTarget = step.target && !step.target.win ? step.target : undefined;

    return (
        <TipCtx.Provider value={tipApi}>
        <div className="nf" ref={root} data-tab={tab} data-side={sideShown} data-win={win || undefined} data-oc={s.overclock > 0 ? "" : undefined}>
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
                <div className="nf-dock" role="group" aria-label="Game windows">
                    {(["map", "goals", "records", "ascend", "menu"] as const).map((w) => (
                        <button key={w} type="button" className="nf-dock-b" aria-haspopup="dialog" data-guide={step.target?.win === w ? "" : undefined} onClick={() => { setWin(w); sfx("tab"); }}>
                            {TAB_LABEL[w]}
                        </button>
                    ))}
                </div>
            </header>
            <GuideStrip step={step} onGo={() => goTo(step.target)} onMap={() => openWin("map")} mapOpen={win === "map"} />
            {win && <button type="button" className="nf-scrim" aria-label="Close window" tabIndex={-1} onClick={() => setWin("")} />}

            <nav className="nf-tabs" aria-label="Game sections">
                {(["core", "stats", "map", "goals", "records", "ascend", "menu"] as Tab[]).map((t) => (
                    <button key={t} type="button" className="nf-tab" aria-pressed={tab === t} data-guide={step.target?.win === t ? "" : undefined} data-tab-btn={t} onClick={() => setTabBoth(t)}>
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
            <Juice reduced={reduced} />

            <section className="nf-pane nf-corepane" data-pane="core" aria-label="Core">
                <div className="nf-core-wrap">
                    <div className="nf-core" role="img" aria-label={`Reactor core. ${fmt(d.bytesPerSec)} Bytes per second.`}>
                        <Core feed={feed} reduced={reduced} />
                        <span className="nf-core-tag">{s.ap > 0 ? `NODE 01 // ASCENDED ×${s.life.ascends || 1}` : feed.current.unlocked >= 6 ? "NODE 01 // CRYSTAL" : "NODE 01 // ONLINE"}</span>
                    </div>
                </div>
                <dl className="nf-readout">
                    <div><dt>Bytes/s</dt><dd>{fmt(d.bytesPerSec)}</dd></div>
                    <div><dt>Reboot</dt><dd>{Math.round(feed.current.progress * 100)}%</dd></div>
                    <div><dt>Global</dt><dd>×{fmt(d.global)}</dd></div>
                </dl>
                <ol className="nf-log" aria-label="Event log" role="log" aria-live="polite">
                    {lines.slice(-7).map((l) => (
                        <li key={l.id} data-tone={l.tone}>
                            <time>{l.t}</time> <span>{l.text}</span>
                        </li>
                    ))}
                </ol>
            </section>

            <section className="nf-pane nf-statspane" data-pane="stats" aria-label="Stats and buttons">
                <Chain s={s} d={d} allOpen={!STATS.every((x) => folded[x.id])} onAll={(open) => setFold(Object.fromEntries(STATS.map((x) => [x.id, !open])))} />
                {isUnlocked(s, "aether") && (
                    <DroneBay s={s} guided={step.target?.drone} open={!folded.drones} onToggle={() => { setFold({ ...folded, drones: !folded.drones }); sfx("tab"); }} onBuy={(k) => { if (buyDrone(s, k)) { sfx("nfBuy", { tier: k }); log(`Drone T${k + 1} online.`, "good"); bump((n) => n + 1); } else sfx("deny"); }} />
                )}
                {STATS.map((def) => {
                    if (!isUnlocked(s, def.id) && def.id !== firstLocked) return null;
                    return (
                        <StatRow key={def.id} id={def.id} s={s} d={d} guide={guideTarget} onPress={doPress} onArm={() => { toggleArm(s, def.id); sfx("tab"); bump((n) => n + 1); }} open={!folded[def.id]} onToggle={() => { setFold({ ...folded, [def.id]: !folded[def.id] }); sfx("tab"); }} />
                    );
                })}
                {laterLocked.length > 0 && (
                    <article className="nf-row nf-locked nf-more">
                        <span className="nf-plate"><NfIcon name="lock" /></span>
                        <div className="nf-lk">
                            <span className="nf-lk-k">BEYOND // ENCRYPTED</span>
                            <b>{laterLocked.length} more zone{laterLocked.length > 1 ? "s" : ""}</b>
                            <small>{laterLocked.map((x) => x.name).join(", ")}. Each one opens after the one before it.</small>
                        </div>
                    </article>
                )}
            </section>

            <section className="nf-pane nf-sidepane" data-pane="map" aria-label="Progress map" role="dialog" aria-modal="false">
                <WinBar title="Map" onClose={() => setWin("")} />
                <MapPanel s={s} d={d} onNode={(id) => { if (buyNode(s, id)) { sfx("nfBuy", { tier: 3 }); bump((n) => n + 1); } }} onWin={(w) => openWin(w)} />
            </section>
            <section className="nf-pane nf-sidepane" data-pane="goals" aria-label="Goals" role="dialog" aria-modal="false">
                <WinBar title="Goals" onClose={() => setWin("")} /><GoalsPanel s={s} /></section>
            <section className="nf-pane nf-sidepane" data-pane="records" aria-label="Records" role="dialog" aria-modal="false">
                <WinBar title="Records" onClose={() => setWin("")} /><RecordsPanel s={s} /></section>
            <section className="nf-pane nf-sidepane" data-pane="ascend" aria-label="Ascend" role="dialog" aria-modal="false">
                <WinBar title="Ascend" onClose={() => setWin("")} />
                <AscendPanel s={s} d={d} confirm={confirm === "ascend"} onAscend={doAscend} onPerk={(id) => { if (buyPerk(s, id)) { sfx("nfBuy", { tier: 3 }); bump((n) => n + 1); } }} onNode={(id) => { if (buyNode(s, id)) { sfx("nfBuy", { tier: 4 }); bump((n) => n + 1); } }} />
            </section>
            <section className="nf-pane nf-sidepane" data-pane="menu" aria-label="Menu" role="dialog" aria-modal="false">
                <WinBar title="Menu" onClose={() => setWin("")} />
                <MenuPanel
                    s={s}
                    soundOn={snd.on}
                    humOn={hum}
                    onHum={toggleHum}
                    onSound={() => setSnd({ on: !snd.on })}
                    ioText={ioText}
                    setIoText={setIoText}
                    ioMsg={ioMsg}
                    onExport={() => { save(); const code = exportSave(g.current); setIoText(code); setIoMsg("Copy this code to move your save."); navigator.clipboard?.writeText(code).then(() => setIoMsg("Save code copied.")).catch(() => {}); }}
                    onImport={() => { const n = parseSave(ioText); if (n) { n.at = Date.now(); g.current = n; tipApi.hide(); prevIds.current = null; save(); setIoMsg("Save loaded."); log("Save imported.", "good"); } else setIoMsg("That code isn't a Node Farm save."); }}
                    confirm={confirm === "reset"}
                    onReset={doReset}
                />
            </section>
            <Tip host={root} tip={tip} />
            {away && <AwayReport away={away} reduced={reduced} onClose={() => setAway(null)} />}
        </div>
        </TipCtx.Provider>
    );
}

function WinBar({ title, onClose }: { title: string; onClose: () => void }) {
    return (
        <div className="nf-win-bar">
            <span>naOS // node.farm // {title}</span>
            <button type="button" className="nf-win-x" onClick={onClose} aria-label={`Close ${title}`}>
                <i />
            </button>
        </div>
    );
}
