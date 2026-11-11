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
import { EventLayer } from "./events";
import { AwayReport, type Away } from "./away";
import { DroneBay } from "./drones";
import { Chain, StatRow } from "./stat-row";
import { Juice, juice, checkMilestones } from "./juice";
import { AscendPanel, GoalsPanel, MenuPanel, RecordsPanel } from "./systems";

const KEY = "nf-save-v1";
const EV_KEY = "nf-events-v1"; // "off" when quick-time events are switched off (per device)
const HUM_KEY = "nf-hum-v1"; // reactor hum on or off (per device)
const UI_KEY = "nf-ui-v1"; // which stat panels are minimized (per device, not part of the game save)
type Tab = "core" | "stats" | "goals" | "records" | "ascend" | "menu";
const SIDE: Tab[] = ["goals", "records", "ascend", "menu"];
const TAB_LABEL: Record<Tab, string> = { core: "Core", stats: "Stats", goals: "Goals", records: "Records", ascend: "Ascend", menu: "Menu" };
type Line = { id: number; t: string; text: string; tone?: "good" | "warn" | "hot" };

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
    const [win, setWin] = useState<"" | "goals" | "records" | "ascend" | "menu">("");
    const [folded, setFolded] = useState<Record<string, boolean>>({});
    const [lines, setLines] = useState<Line[]>([]);
    const [away, setAway] = useState<Away | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [evOn, setEvOn] = useState(true);
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
    const feed = useRef<CoreFeed>({ progress: 0, overclock: false, unlocked: 1, speed: 0, lastPulse: -1e9, reboots: 0, ap: 0 });
    const ids = useRef(1);
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
            if (localStorage.getItem(EV_KEY) === "off") setEvOn(false);
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
    }, [ready, log]);

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

    // ---- quick-time events (components/nodefarm/events.tsx): a win gives the timed Overclock, a miss costs nothing
    const evResult = useCallback(
        (def: { title: string }, won: boolean) => {
            const s = g.current;
            if (won) {
                breach(s);
                log(`${def.title.toUpperCase()} CLEARED. Overclock x${TUNE.overclockMult} for ${TUNE.overclockSecs + s.perks.overclock * 5} s.`, "good");
            } else log(`${def.title} lost. No cost.`, "warn");
        },
        [log],
    );
    const evMiss = useCallback((def: { title: string }) => log(`${def.title} ignored. It passed.`, "warn"), [log]);
    const evEngage = useCallback((def: { title: string }) => log(`${def.title} engaged.`, "hot"), [log]);
    const setEvents = useCallback((on: boolean) => {
        setEvOn(on);
        try {
            localStorage.setItem(EV_KEY, on ? "on" : "off");
        } catch {}
        if (!on) log("Quick-time events off. Turn them back on in the Menu.", "warn");
    }, [log]);

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
        <div className="nf" data-tab={tab} data-side={sideShown} data-win={win || undefined} data-oc={s.overclock > 0 ? "" : undefined}>
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
                    {(["goals", "records", "ascend", "menu"] as const).map((w) => (
                        <button key={w} type="button" className="nf-dock-b" aria-haspopup="dialog" onClick={() => { setWin(w); sfx("tab"); }}>
                            {TAB_LABEL[w]}
                        </button>
                    ))}
                </div>
            </header>
            {win && <button type="button" className="nf-scrim" aria-label="Close window" tabIndex={-1} onClick={() => setWin("")} />}

            <nav className="nf-tabs" aria-label="Game sections">
                {(["core", "stats", "goals", "records", "ascend", "menu"] as Tab[]).map((t) => (
                    <button key={t} type="button" className="nf-tab" aria-pressed={tab === t} data-tab-btn={t} onClick={() => setTabBoth(t)}>
                        {TAB_LABEL[t]}
                    </button>
                ))}
            </nav>

            {toast && <div className="nf-toast" role="status"><NfIcon name="spark" /> Goal: {toast}</div>}

            <EventLayer game={g} ready={ready} enabled={evOn} busy={!!win || !!away || !!confirm} reduced={reduced} onEngage={evEngage} onResult={evResult} onMiss={evMiss} onDisable={() => setEvents(false)} />
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
                <DroneBay s={s} open={!folded.drones} onToggle={() => { setFold({ ...folded, drones: !folded.drones }); sfx("tab"); }} onBuy={(k) => { if (buyDrone(s, k)) { sfx("nfBuy", { tier: k }); log(`Drone T${k + 1} online.`, "good"); bump((n) => n + 1); } else sfx("deny"); }} />
                {STATS.map((def) => (
                    <StatRow key={def.id} id={def.id} s={s} d={d} onPress={doPress} onArm={() => { toggleArm(s, def.id); sfx("tab"); bump((n) => n + 1); }} open={!folded[def.id]} onToggle={() => { setFold({ ...folded, [def.id]: !folded[def.id] }); sfx("tab"); }} />
                ))}
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
                    eventsOn={evOn}
                    onEvents={() => setEvents(!evOn)}
                    ioText={ioText}
                    setIoText={setIoText}
                    ioMsg={ioMsg}
                    onExport={() => { save(); const code = exportSave(g.current); setIoText(code); setIoMsg("Copy this code to move your save."); navigator.clipboard?.writeText(code).then(() => setIoMsg("Save code copied.")).catch(() => {}); }}
                    onImport={() => { const n = parseSave(ioText); if (n) { n.at = Date.now(); g.current = n; prevIds.current = null; save(); setIoMsg("Save loaded."); log("Save imported.", "good"); } else setIoMsg("That code isn't a Node Farm save."); }}
                    confirm={confirm === "reset"}
                    onReset={doReset}
                />
            </section>
            {away && <AwayReport away={away} reduced={reduced} onClose={() => setAway(null)} />}
        </div>
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
