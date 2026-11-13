"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { nfx as sfx, nfx, humVol } from "@/lib/nodefarm/sound";
import { setHum } from "@/lib/sound/engine";
import { useSoundPrefs } from "@/lib/sound/use-sound";
import {
    TUNE, overclockMult, overclockSecs, respec, ascend, canAscend, breach, button, buyDrone, buyNode, canAfford, buyPerk, checkGoals, derive, exportSave, fmt, fmtTime, fresh, getNumFmt, setNumFmt, type NumFmt, isUnlocked, parseSave, press, STATS, tick,
    apEach, dropFill, hasFeature, openDrop, setMount, statDef,
    buyLabNode, cancelCompile, compile, deploy, labNode, labOpen, payload, type PayloadId,
    chOff, buyFw, fwNode, handSeen, handover, keysOnHandover, protoDef, protoRank, respecFw, setProto, type ProtoId,
    type ButtonStat, type MatId, type State, type StatId,
} from "@/lib/nodefarm/engine";
import { initFx } from "@/lib/nodefarm/fx";
import { keyIsTyping, keyOverlay } from "@/lib/nodefarm/keys";
import type { NfLive } from "@/lib/nodefarm/records";
import { Core, freshCoreFeed, type CoreFeed } from "./core";
import { PART_WHY, SKIN_WHY, coreLook, corePreview, skinOpen } from "@/lib/nodefarm/core-look";
import { PART_ORDER, SKINS } from "@/lib/nodefarm/core-parts";
import { NfIcon } from "./icon";
import { EventLayer } from "./events";
import { MiniHud } from "./mini-hud";
import { RARITY, payLoot, type Loot } from "@/lib/nodefarm/events";
import { AwayReport, type Away } from "./away";
import { catchUp } from "@/lib/nodefarm/offline";
import { Scenery, SceneWindow } from "./scenery";
import dynamic from "next/dynamic";
// The prestige tree (menu, backdrop, sprites) is the biggest piece of the game and most visits never open it, so it loads on its
// own and is fetched quietly once the board is idle.
const loadTree = () => import("./tree");
const TreeMenu = dynamic(() => loadTree().then((m) => ({ default: m.TreeMenu })), { ssr: false });
import { LabHud, LabZone, labModel, labReady } from "./lab";
import { ScriptsZone } from "./scripts";
import { SCRIPTS, SCRIPT_BY, toggleBuyStat, ascendDue, ascendPrep, learnStep, teachEvent, schedOpen, teachAscend, teachCompile, teachDeploy, teachDrop, teachPress } from "@/lib/nodefarm/scripts";
import { eraOf } from "@/lib/nodefarm/scenery";
import { DroneBay, droneModel } from "./drones";
import { rigManual } from "@/lib/nodefarm/rigs";
import { Chain, StatRow } from "./stat-row";
import { Feed } from "./feed";
import { FeedStore, buyToks, call, com, droneToks, fromText, id as idTok, num, p as pun, str as strTok, txt, unlockToks, type FeedTone } from "@/lib/nodefarm/feed";
import { markSeen, newsToks, pickNews } from "@/lib/nodefarm/news";
import { LORE } from "@/lib/nodefarm/lore";
import { LOGS, logNo, recoverLogs } from "@/lib/nodefarm/story";
import { Juice, juice, checkMilestones, onJuice } from "./juice";
import { GuideStrip, Tip, TipCtx, type TipApi, type TipState, type TipStore } from "./guide";
import { MapPanel } from "./map";
import { nextStep, type Target } from "@/lib/nodefarm/guide";
import { GoalsPanel, MenuPanel, RecordsPanel } from "./systems";
import { AscendPanel } from "./ascend";
import { HandoverPanel, fwModel } from "./handover";
import { CodexPanel } from "./codex";
import { unlocked as codexUnlocked } from "@/lib/nodefarm/codex";
import { HandoverCut, type HandCutInfo } from "./handover-cut";
import { Dock, PhoneTabs, WinBar, swInfo } from "./switcher";
import { AdminPanel, type AdminHost } from "./admin";
import { isAdmin, setAdmin } from "@/lib/nodefarm/admin";
import { adminFlags, buyDroneNode, buyMod, droneNode, masteryRanks, MODS, respecDrones, setPost } from "@/lib/nodefarm/engine";
import { DRONE_NAMES } from "@/lib/nodefarm/guide";
import { codeReveal, cxClear } from "@/lib/nodefarm/cx";
import { ZoneEventCard } from "./zone-event";
import { zeChoose, zoneEvDef, zoneLabel, type ZeChoice } from "@/lib/nodefarm/zoneevents";
import { ARCS, arcKey, arcOf } from "@/lib/nodefarm/arcs";
import { ArcHead } from "./arcs";
import { Hold } from "./hold";
import { useOffscreenPause } from "./offscreen";
import { ArcRail, ArcStep } from "./arc-rail";
import { PokeLayer } from "./poke";
import { StressPanel, StressStrip } from "./stress";
import { chOpen, leaveTest, startTest, takeChNews, testDef, RANKS, type TestId } from "@/lib/nodefarm/stress";
import { ACC_KEY, blankFoldTarget, readyCount, shownArcIds, soloArc } from "@/lib/nodefarm/layout";

import { AUTO_GAP, addBackup, readBackups, type Backup } from "@/lib/nodefarm/backups";

const KEY = "nf-save-v1";
const EV_KEY = "nf-events-v1"; // "off" when quick-time events are switched off (per device)
const FS_KEY = "nf-fs-v1"; // full screen mode on or off (per device)
const HUM_KEY = "nf-hum-v1"; // reactor hum on or off (per device)
const UI_KEY = "nf-ui-v1"; // which stat panels are minimized (per device, not part of the game save)
const JUMP_KEY = "nf-jump-v1"; // "off" when the page should not scroll to the board on a return visit (per device)
const CALM_KEY = "nf-calm-v1"; // "1" when motion is forced calm, on top of the OS setting (per device)
const FMT_KEY = "nf-numfmt-v1"; // number format: short | sci | eng (per device)
type Tab = "core" | "stats" | "map" | "goals" | "records" | "ascend" | "handover" | "stress" | "codex" | "menu";
const SIDE: Tab[] = ["map", "goals", "records", "ascend", "handover", "stress", "codex", "menu"];
type Win = "map" | "goals" | "records" | "ascend" | "handover" | "stress" | "codex" | "menu";

function load(): { s: State | null; unreadable: boolean; raw: string } {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return { s: null, unreadable: false, raw: "" };
        const s = parseSave(raw);
        // a save that will not parse (damaged, or from a newer build) must not be overwritten five seconds later: its text goes
        // to the backup list (lib/nodefarm/backups.ts) where it can be copied out
        if (!s) addBackup("lost", "could not be read", raw);
        return { s, unreadable: !s, raw };
    } catch {
        return { s: null, unreadable: false, raw: "" };
    }
}

const hasProgress = (s: State) => s.life.presses > 0 || s.life.secs > 60;

export function NodeFarm() {
    const g = useRef<State>(null as unknown as State);
    const [ready, setReady] = useState(false);
    const [ver, bump] = useState(0); // bumped by whatever the player or a system just did
    const [, tickBump] = useState(0); // bumped by the 10 Hz loop only (see Hold: hidden parts follow ver, not this)
    const [tab, setTab] = useState<Tab>("core");
    const [side, setSide] = useState<Tab>("goals");
    const [win, setWin] = useState<"" | Win>("");
    const [treeOpen, setTreeOpen] = useState(false);
    /** the Exploit Lab's research tree (same menu as the prestige tree, blue lab skin) */
    const [labTree, setLabTree] = useState(false);
    /** the drone tree (same menu, amber hangar skin) */
    const [droneTree, setDroneTree] = useState(false);
    const closeDrones = useCallback(() => setDroneTree(false), []);
    /** mastery ranks last seen, so a rank up gets one feed line and a banner */
    const rankPrev = useRef<{ s: State | null; n: number }>({ s: null, n: 0 });
    /** zone events: the one announced by the centered card, and the last event id this screen has seen (for the feed) */
    const [zeCard, setZeCard] = useState<number | null>(null);
    const closeZeCard = useCallback(() => setZeCard(null), []);
    const zeSeen = useRef<{ s: State | null; n: number }>({ s: null, n: 0 });
    const labPrev = useRef<{ s: State | null; seen: boolean; compiled: number }>({ s: null, seen: false, compiled: 0 });
    // stable on purpose: the tree's modal effect re-runs whenever this changes, and this component re-renders ten times a second
    const closeTree = useCallback(() => setTreeOpen(false), []);
    const closeLab = useCallback(() => setLabTree(false), []);
    /** the Handover Firmware tree (same menu, green phosphor skin) */
    const [fwTree, setFwTree] = useState(false);
    // the Handover moment (handover-cut.tsx); `after` runs when it closes
    const [cut, setCut] = useState<(HandCutInfo & { after: () => void }) | null>(null);
    const closeFw = useCallback(() => setFwTree(false), []);
    const treeOpenRef = useRef(false);
    // a full-screen tree (prestige, Exploit Lab, Drone, Firmware) hides the board, so the game loop barely re-renders it
    treeOpenRef.current = treeOpen || labTree || droneTree || fwTree;

    // admin mode (lib/nodefarm/admin.ts): turned on from the naOS console with `nf admin on`; unadvertised
    const [adminOn, setAdminOn] = useState(false);
    const [adminOpen, setAdminOpen] = useState(false);
    const speedRef = useRef(1);
    const [folded, setFolded] = useState<Record<string, boolean>>({});
    const feedStore = useMemo(() => new FeedStore(), []);
    useEffect(() => () => feedStore.dispose(), [feedStore]);
    const dronePrev = useRef<{ s: State | null; presses: number; manual: number }>({ s: null, presses: 0, manual: 0 });
    // Scripts (lib/nodefarm/scripts.ts): what each script had done at the last check, for the feed, and its own presses
    const schedPrev = useRef<{ s: State | null; ran: Record<string, number> }>({ s: null, ran: {} });
    const schedPress = useRef<{ s: State | null; n: number }>({ s: null, n: 0 });
    const schedRef = useRef<(s: State) => void>(() => {});
    const [away, setAway] = useState<Away | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [evOn, setEvOn] = useState(true);
    const [osReduced, setReduced] = useState(false);
    const [calm, setCalm] = useState(false);
    const reduced = osReduced || calm;
    const [lastSave, setLastSave] = useState(0);
    const [confirm, setConfirm] = useState<"" | "ascend" | "reset" | "import">("");
    const [stale, setStale] = useState(false); // another tab wrote the save: this tab stops saving so it cannot overwrite it
    const staleRef = useRef(false);
    staleRef.current = stale;
    const [numFmt, setNumFmtState] = useState<NumFmt>("short");
    const [backups, setBackups] = useState<Backup[]>([]);
    const autoAt = useRef(0); // when the last automatic backup was checked for
    const [ioText, setIoText] = useState("");
    const [ioMsg, setIoMsg] = useState("");
    const [fs, setFsState] = useState(false);
    const fsApi = useRef(false);
    // full screen: the board fills the viewport and the site's bar and dock step aside. Where the browser has a Fullscreen API (not iPhone) it goes truly full screen too.
    const setFs = useCallback((on: boolean) => {
        setFsState(on);
        try { localStorage.setItem(FS_KEY, on ? "1" : "0"); } catch {}
        const d = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
        const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
        try {
            if (on && !(d.fullscreenElement || d.webkitFullscreenElement)) {
                if (el.requestFullscreen) { fsApi.current = true; el.requestFullscreen().catch(() => { fsApi.current = false; }); }
                else if (el.webkitRequestFullscreen) { fsApi.current = true; el.webkitRequestFullscreen(); }
            } else if (!on && (d.fullscreenElement || d.webkitFullscreenElement)) {
                fsApi.current = false;
                if (d.exitFullscreen) d.exitFullscreen().catch(() => {}); else d.webkitExitFullscreen?.();
            }
        } catch {}
    }, []);
    const fsRef = useRef(fs);
    fsRef.current = fs;
    // ---- window open/close: every window prints in and deletes out with the shared code reveal (lib/nodefarm/cx.ts)
    const closing = useRef(0);
    const paneOf = (w: string) => root.current?.querySelector<HTMLElement>(`[data-pane="${w}"]`) ?? null;
    const paneRows = (el: HTMLElement) => (el.querySelector("[data-cx-i]") ? ":scope > .nf-win-bar, [data-cx-i]" : ":scope > .nf-win-bar, :scope > :not(.nf-win-bar) > *");
    const closeWin = useCallback(() => {
        const w = winRef.current;
        if (!w) return;
        const el = paneOf(w);
        const n = ++closing.current;
        root.current?.setAttribute("data-closing", "");
        codeReveal(el, { dir: "out", style: "crt", rows: el ? paneRows(el) : undefined }).then(() => {
            if (closing.current !== n) return;
            root.current?.removeAttribute("data-closing");
            setWin((cur) => (cur === w ? "" : cur));
        });
    }, []);
    // phone: switching tabs prints the new section in (rows only, no frame)
    const firstTab = useRef(true);
    useLayoutEffect(() => {
        if (firstTab.current) { firstTab.current = false; return; }
        if (matchMedia("(min-width: 1000px)").matches) return;
        const el = paneOf(tab);
        if (el) codeReveal(el, { bare: true, style: "crt", rows: paneRows(el), ms: 240 });
    }, [tab]);
    const winRef = useRef(win);
    winRef.current = win;
    useLayoutEffect(() => {
        if (!win) return;
        closing.current++;
        root.current?.removeAttribute("data-closing");
        const el = paneOf(win);
        if (!el) return;
        cxClear(el);
        el.scrollTop = 0;
        codeReveal(el, { dir: "in", style: "crt", rows: paneRows(el) });
    }, [win]);
    useEffect(() => {
        if (!win) return;
        // Escape closes only the top layer: search, the console, an event, a tree or a full-screen moment above the window keep their own Escape
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !keyOverlay() && !document.querySelector(".nf-tm-host")) closeWin(); };
        // capture phase: the console or search closes itself on this same Escape, and must still count as open here
        window.addEventListener("keydown", onKey, true);
        // clears reveal transforms and lifts the board above the hero while a window is open (see nodefarm.css)
        document.body.classList.add("nf-win-open");
        document.querySelector<HTMLElement>(`.nf [data-pane="${win}"] .nf-win-x`)?.focus();
        return () => { window.removeEventListener("keydown", onKey, true); document.body.classList.remove("nf-win-open"); };
    }, [win]);
    useEffect(() => {
        try { if (localStorage.getItem(FS_KEY) === "1") setFsState(true); } catch {}
        // the browser left real full screen (Esc): leave the in-page mode with it
        const onChange = () => {
            const d = document as Document & { webkitFullscreenElement?: Element };
            if (!(d.fullscreenElement || d.webkitFullscreenElement) && fsApi.current) { fsApi.current = false; setFsState(false); try { localStorage.setItem(FS_KEY, "0"); } catch {} }
        };
        const onCmd = (e: Event) => {
            const v = (e as CustomEvent<{ on?: boolean }>).detail?.on;
            setFs(v === undefined ? !fsRef.current : v);
        };
        const onKey = (e: KeyboardEvent) => {
            if (keyIsTyping(e) || keyOverlay() || document.querySelector(".nf-tm-host")) return;
            if (e.key === "f" || e.key === "F") { e.preventDefault(); setFs(!fsRef.current); }
            else if (e.key === "Escape" && fsRef.current && !winRef.current) setFs(false);
        };
        document.addEventListener("fullscreenchange", onChange);
        document.addEventListener("webkitfullscreenchange", onChange);
        window.addEventListener("nf:fs", onCmd);
        window.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("fullscreenchange", onChange);
            document.removeEventListener("webkitfullscreenchange", onChange);
            window.removeEventListener("nf:fs", onCmd);
            window.removeEventListener("keydown", onKey);
        };
    }, [setFs]);
    useEffect(() => {
        document.body.classList.toggle("nf-fs", fs);
        return () => document.body.classList.remove("nf-fs");
    }, [fs]);
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
    // the tooltip lives in its own little store so hovering a button does not re-render the whole board (components/nodefarm/guide.tsx Tip)
    const tipStore = useMemo<TipStore>(() => {
        let cur: TipState | null = null;
        const subs = new Set<() => void>();
        return {
            get: () => cur,
            set: (f) => { const n = typeof f === "function" ? f(cur) : f; if (n !== cur) { cur = n; subs.forEach((x) => x()); } },
            sub: (fn) => { subs.add(fn); return () => { subs.delete(fn); }; },
        };
    }, []);
    const setTip = tipStore.set;
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
        [setTip],
    );
    const feed = useRef<CoreFeed>(freshCoreFeed());
    const skinsWas = useRef<boolean[] | null>(null);
    // the core flares on milestones, unlocks and tier-ups
    useEffect(() => onJuice((e) => {
        if (e.t === "milestone" || e.t === "unlock" || e.t === "tier") feed.current.flareAt = performance.now();
        if (e.t === "milestone") nfx("nfGoal");
    }), []);
    const saved = useRef(0);
    const warnedSave = useRef(false);
    const tickN = useRef(0);

    // plain text lines get a level tag and highlighted numbers; code-style lines go through feedStore.push with tokens
    const log = useCallback((text: string, tone?: FeedTone) => feedStore.push(fromText(text, tone), { tone, type: true }), [feedStore]);
    /** Ascend, Handover, the tree and Firmware are locked while a stress test runs: say so instead of doing nothing. */
    const lockedNote = (what: string) => {
        if (!g.current || !chOff(g.current, "prestige")) return false;
        log(`${what} is locked while a stress test runs. Leave the test to use it.`, "warn");
        sfx("deny");
        return true;
    };

    // ---- boot: load the save, bank offline time, print the greeting
    useEffect(() => {
        setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        initFx();
        try {
            const u = localStorage.getItem(UI_KEY);
            if (u) setFolded(JSON.parse(u));
            if (localStorage.getItem(EV_KEY) === "off") setEvOn(false);
            if (localStorage.getItem(CALM_KEY) === "1") setCalm(true);
            if (localStorage.getItem(JUMP_KEY) === "off") setJumpOn(false);
            const nf = localStorage.getItem(FMT_KEY);
            if (nf === "sci" || nf === "eng") { setNumFmt(nf); setNumFmtState(nf); }
            if (localStorage.getItem(HUM_KEY) === "0") {
                humRef.current = false;
                setHumOn(false);
            }
        } catch {}
        const timers: ReturnType<typeof setTimeout>[] = [];
        const got = load();
        const s = got.s ?? fresh();
        // the save exactly as the last visit left it, before anything below touches it
        if (got.s && hasProgress(got.s)) addBackup("auto", "when the game opened", got.raw);
        autoAt.current = Date.now();
        setBackups(readBackups());
        if (got.unreadable) timers.push(setTimeout(() => log("The saved game could not be read. It is kept in this browser; a new game starts.", "warn"), 1800));
        const first = s.life.secs === 0 && s.life.presses === 0;
        const gap = (Date.now() - s.at) / 1000;
        g.current = s;
        if (gap > 60 && !first) {
            const r = catchUp(s, gap);
            if (r.capped) s.life.capped += 1;
            setAway({ ...r, gap, cap: derive(s).offlineCap });
        }
        s.at = Date.now();
        const greet = first
            ? ["naOS // node.farm online", "Link established. 1 node, no clearance.", "Buy your first Multiplier. The core grows with everything you build."]
            : ["naOS // node.farm resumed", `Session restored. ${fmt(s.life.presses)} buttons pressed, ${fmt(s.life.reboots)} reboots on record.`];
        if (s.treeRefund) {
            // the 40-node tree replaced the old one: say once what came back
            greet.push(`The prestige tree was rebuilt with 40 new nodes. ${fmt(s.treeRefund)} AP from your old nodes is back to spend.`);
            delete s.treeRefund;
        }
        greet.forEach((t, i) => timers.push(setTimeout(() => log(t, i === 0 || i === 2 ? "good" : undefined), 180 + i * 900)));
        setReady(true);
        // React StrictMode (npm run dev) runs this twice: drop the first run's greeting so every line prints once
        return () => timers.forEach(clearTimeout);
    }, [log]);

    // ---- news lines: every so often one short line (past operator, operator, node note, hint) drops into the feed,
    // chosen for how far the farm has got. Skipped when the tab is hidden, a window is open, or the feed is busy.
    const busyRef = useRef(false);
    busyRef.current = !!win || treeOpen || droneTree || fwTree || !!cut || !!away || !!confirm;
    useEffect(() => {
        if (!ready) return;
        let to: ReturnType<typeof setTimeout>;
        const recent: number[] = [];
        const next = () => {
            to = setTimeout(() => {
                const idle = Date.now() - (feedStore.lines[feedStore.lines.length - 1]?.at ?? 0) > 5000;
                if (!document.hidden && !busyRef.current && idle) {
                    const pick = pickNews(g.current, recent);
                    if (pick) {
                        recent.push(pick.key);
                        if (recent.length > 40) recent.shift();
                        if (pick.k === "past") markSeen(pick.key);
                        feedStore.push(newsToks(pick.k, pick.text, pick.op), { type: true });
                    }
                }
                next();
            }, 20000 + Math.random() * 10000);
        };
        next();
        return () => clearTimeout(to);
    }, [ready, feedStore]);

    // ---- the naOS console's `nf` command asks for the live state here (see components/cm/console.tsx)
    useEffect(() => {
        if (!ready) return;
        const onLive = (e: Event) => {
            (e as CustomEvent<{ live?: NfLive }>).detail.live = {
                s: g.current,
                // admin tools rewrote the state (lib/nodefarm/admin.ts): no banner flood, save, redraw
                changed: () => { prevIds.current = null; tipApi.hide(); save(); bump((n) => n + 1); },
                notify: (found) => {
                    for (const f of found) {
                        feedStore.push([...call(idTok("secret"), "found", [strTok(f.name)])], { tone: "good", type: true });
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
    }, [ready, feedStore]);

    // ---- save
    const save = useCallback(() => {
        const s = g.current;
        if (!s || staleRef.current) return;
        try {
            s.at = Date.now();
            const text = JSON.stringify(s);
            localStorage.setItem(KEY, text);
            saved.current = Date.now();
            setLastSave(saved.current);
            // a rolling backup every half hour of play (skipped when nothing changed since the last one)
            if (saved.current - autoAt.current >= AUTO_GAP && hasProgress(s)) {
                autoAt.current = saved.current;
                setBackups(addBackup("auto", "every half hour", text));
            }
        } catch {
            // storage full or blocked (private mode): say so once instead of failing silently
            if (!warnedSave.current) { warnedSave.current = true; log("This browser would not store the save. Export a code from Menu so nothing is lost.", "warn"); }
        }
    }, [log]);
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

    useEffect(() => {
        if (!ready) return;
        const w = window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (n: number) => void };
        const idle = typeof w.requestIdleCallback === "function";
        const id = idle ? w.requestIdleCallback!(() => void loadTree(), { timeout: 4000 }) : window.setTimeout(() => void loadTree(), 2500);
        return () => (idle ? w.cancelIdleCallback?.(id) : window.clearTimeout(id));
    }, [ready]);

    // ---- admin mode: the console flips `nf-admin-v1` and fires `nf:admin`; the panel is components/nodefarm/admin.tsx
    useEffect(() => {
        if (!ready) return;
        const on = isAdmin();
        setAdminOn(on);
        setAdminOpen(on); // once admin is on the panel floats over the game on every visit
        const onAdmin = (e: Event) => {
            const d = (e as CustomEvent<{ on?: boolean; open?: boolean }>).detail ?? {};
            if (d.on === false) { setAdminOn(false); setAdminOpen(false); speedRef.current = 1; adminFlags.reveal = false; }
            else if (d.on) { setAdminOn(true); if (d.open) setAdminOpen(true); }
        };
        window.addEventListener("nf:admin", onAdmin);
        return () => window.removeEventListener("nf:admin", onAdmin);
    }, [ready]);
    const adminHost = useMemo<AdminHost>(
        () => ({
            get: () => g.current,
            changed: () => { prevIds.current = null; tipApi.hide(); save(); bump((n) => n + 1); },
            log: (text, tone) => log(text, tone),
            getSpeed: () => speedRef.current,
            setSpeed: (n) => { speedRef.current = n; },
            previewAway: (secs) => {
                const copy = structuredClone(g.current);
                const r = catchUp(copy, secs);
                setAway({ ...r, gap: secs, cap: derive(copy).offlineCap });
            },
            fire: (kind) => window.dispatchEvent(new CustomEvent("nf:fire", { detail: kind })),
            close: () => setAdminOpen(false),
            exit: () => { setAdmin(false, null); },
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [log, save, tipApi],
    );

    const setFold = useCallback((next: Record<string, boolean>) => {
        setFolded(next);
        try {
            localStorage.setItem(UI_KEY, JSON.stringify(next));
        } catch {}
    }, []);

    // ---- board layout: one arc open at a time. An old save is tidied once to show only the newest arc, and when a new
    // arc reaches the board it opens and the others fold. "Expand all" still opens everything.
    const arcCount = ready && g.current ? shownArcIds(g.current).length : 0;
    const arcCountRef = useRef(-1);
    useEffect(() => {
        if (!ready || !g.current) return;
        const ids = shownArcIds(g.current);
        const prev = arcCountRef.current;
        arcCountRef.current = ids.length;
        if (!ids.length) return;
        setFolded((f) => {
            // a reset (Ascend, Handover, starting or leaving a stress test) can shrink the board: the newest arc left opens then too
            if (!(prev === -1 ? !f[ACC_KEY] : ids.length !== prev)) return f;
            // the first tidy also folds the big system panels (Lab, Scripts, Hangar): their title bars still show what they are doing
            const next = { ...soloArc(f, ids[ids.length - 1]), [ACC_KEY]: true, ...(prev === -1 ? { lab: true, sched: true, drones: true } : {}) };
            try { localStorage.setItem(UI_KEY, JSON.stringify(next)); } catch {}
            return next;
        });
    }, [ready, arcCount]); // eslint-disable-line react-hooks/exhaustive-deps

    useOffscreenPause(root, ready);

    // ---- the game loop: 10 ticks a second, real elapsed time, so a throttled background tab catches up on return
    useEffect(() => {
        if (!ready) return;
        const iv = setInterval(() => {
            const s = g.current;
            const now = Date.now();
            const gap = (now - s.at) / 1000;
            s.at = now;
            if (gap > 3) {
                const r = catchUp(s, gap);
                if (gap > 60 && r.capped) s.life.capped += 1;
                if (gap > 60) setAway({ ...r, gap, cap: derive(s).offlineCap });
            } else {
                const sp = speedRef.current;
                if (sp > 1) { const n = Math.ceil((gap * sp) / 5); for (let i = 0; i < n; i++) tick(s, (gap * sp) / n); }
                else tick(s, Math.max(0, gap));
                // presses nobody clicked (posted Drones) are counted from the lifetime total, then batched into one feed line
                const dp = dronePrev.current;
                const scriptMade = schedPress.current.s === s ? (s.auto?.presses ?? 0) - schedPress.current.n : 0;
                schedPress.current = { s, n: s.auto?.presses ?? 0 };
                if (dp.s === s) {
                    const made = s.life.presses - dp.presses - dp.manual - scriptMade;
                    if (made > 0) feedStore.batch("drone", (n, sum) => droneToks(sum, s.dr.post.filter((p, k) => p && s.drones[k] > 0).length), made, 4000);
                }
                dronePrev.current = { s, presses: s.life.presses, manual: 0 };
                // zone mastery: a rank up gets a feed line and a banner (only for ranks earned while this save is loaded)
                const rp = rankPrev.current;
                const rn = masteryRanks(s);
                if (rp.s === s && rn > rp.n) {
                    feedStore.push([...call(idTok("hangar"), "mastery", [num(`+${rn - rp.n}`)]), pun(" → "), strTok(`${rn} ranks, +${rn - rp.n} Core${rn - rp.n === 1 ? "" : "s"}`)], { tone: "hot", type: true });
                    juice.emit({ t: "milestone", title: "Zone mastery up", sub: `Your posted Drones earned a rank. ${rn} ranks so far; spend the Core in the drone tree.` });
                }
                rankPrev.current = { s, n: rn };
                // zone events: a new one gets a feed line and the centered card (only while this save is loaded and the tab is showing)
                const zs = zeSeen.current;
                const zn = s.ze?.seen ?? 0;
                if (zs.s === s && zn > zs.n && s.ze) {
                    const ev = s.ze.act[s.ze.act.length - 1];
                    if (ev && !document.hidden) {
                        const zd = zoneEvDef(ev.kind);
                        feedStore.push([...call(idTok("zone"), "event", [strTok(ev.kind)]), pun(" → "), strTok(zoneLabel(ev.zone))], { tone: zd.good ? "hot" : "warn", type: true });
                        setZeCard(ev.id);
                        nfx("nfZone", { good: zd.good });
                    }
                }
                zeSeen.current = { s, n: zn };
            }
            ++tickN.current;
            const d = derive(s);
            const f = feed.current;
            f.progress = Math.min(1, s.mult / button(s, "reboot", 0).cost);
            f.overclock = s.overclock > 0;
            f.speed = Math.min(1, Math.log10(1 + d.bytesPerSec) / 12);
            const openIds = STATS.filter((x) => isUnlocked(s, x.id)).map((x) => x.id);
            f.unlocked = openIds.length;
            if (prevIds.current)
                for (const id of openIds)
                    if (!prevIds.current.includes(id)) {
                        juice.emit({ t: "unlock", id });
                        feedStore.push(unlockToks(id, LORE[id].zone, STATS.findIndex((x) => x.id === id) + 1), { tone: "good", type: true });
                    }
            prevIds.current = openIds;
            if (tickN.current % 10 === 5) checkMilestones(s, d.bytesPerSec);
            if (tickN.current % 10 === 3) schedRef.current(s);
            if (tickN.current % 10 === 7) {
                // story logs: a log is stored the first time it is within reach. A save from before logs existed gets them all at once, quietly.
                const got = recoverLogs(s);
                if (got.length) {
                    const loud = got.length <= 2;
                    for (const l of got.slice(loud ? 0 : -1)) {
                        const no = logNo(LOGS.findIndex((x) => x.id === l.id));
                        feedStore.push([...call(idTok("logs"), "recover", [strTok(no)]), txt(" "), com(`// ${l.title.toLowerCase()}`)], { tone: "hot", type: true });
                        if (loud) juice.emit({ t: "milestone", title: `Log ${no} recovered`, sub: `${l.title}. Read it in Records.` });
                    }
                    if (!loud) log(`${got.length} old logs recovered. Read them in Records.`, "hot");
                    save();
                }
            }
            // Exploit Lab: say when it opens and when a compile lands in stock
            const lp = labPrev.current;
            if (lp.s === s) {
                if (s.lab.seen && !lp.seen) {
                    juice.emit({ t: "milestone", title: "Exploit Lab decrypted", sub: "Intel now runs alongside Bytes. Research a payload, compile it, deploy it." });
                    feedStore.push([...call(idTok("lab"), "mount", [strTok("~/lab")]), pun(" → "), strTok("intel online")], { tone: "good", type: true });
                    sfx("nfDecrypt");
                }
                const made = s.life.compiled - lp.compiled;
                if (made > 0) feedStore.batch("lab:compiled", () => [...call(idTok("gcc"), "link", [strTok(`${s.lab.last ?? "payload"}.c`)]), pun(" → "), num(`+${made}`), txt(" "), com("// in stock")], made, 4000);
            }
            labPrev.current = { s, seen: s.lab.seen, compiled: s.life.compiled };
            f.reboots = s.reboot;
            f.ap = s.ap;
            // the core's colours and structures (lib/nodefarm/core-look.ts); a structure that bolts on says so in the feed
            const look = coreLook(s);
            const partsWas = f.parts;
            f.zone = look.zone;
            f.skin = look.skin;
            f.event = look.event;
            f.rigs = look.rigs;
            f.fw = look.fw;
            f.parts = look.parts;
            f.drones = look.drones;
            f.glyphs = look.glyphs;
            if (partsWas >= 0 && corePreview() == null) {
                const added = PART_ORDER.filter((_, k) => look.parts & (1 << k) && !(partsWas & (1 << k)));
                // an imported or restored save can bring several at once: one line for those
                if (added.length > 2) feedStore.push([...call(idTok("core"), "attach", [num(added.length)]), txt(" "), com("// structures restored")], { tone: "good", type: true });
                else for (const p of added) feedStore.push([...call(idTok("core"), "attach", [strTok(p)]), txt(" "), com(`// ${PART_WHY[p]}`)], { tone: "good", type: true });
            }
            // a core skin unlocking says so once, with the command that turns it on
            const skins = SKINS.map((k) => skinOpen(s, k));
            if (skinsWas.current)
                SKINS.forEach((k, i) => {
                    if (k !== "zone" && skins[i] && !skinsWas.current![i]) feedStore.push([...call(idTok("core"), "unlock", [strTok(k)]), txt(" "), com(`// ${SKIN_WHY[k]}. nf core ${k} in the console`)], { tone: "hot", type: true });
                });
            skinsWas.current = skins;
            if (prevUnlocked.current && f.unlocked > prevUnlocked.current) sfx("nfDecrypt");
            prevUnlocked.current = f.unlocked;
            setHum(humRef.current ? { level: Math.min(1, f.speed * 0.75 + (f.unlocked / 7) * 0.25), boost: f.overclock, vol: humVol() } : null);
            for (const n of takeChNews(s)) {
                const t = testDef(n.id);
                sfx("nfTierUp", { tier: 3 });
                juice.emit({ t: "milestone", title: `${t.name}: rank ${RANKS[n.rank - 1]} cleared`, sub: `Kept for good: ${t.pays(n.rank)}.` });
                feedStore.push([...call(idTok("stress"), "rank", [strTok(n.id), strTok(RANKS[n.rank - 1])]), pun(" → "), strTok(t.pays(n.rank))], { tone: "good", type: true });
            }
            for (const goal of checkGoals(s)) {
                feedStore.push(call(idTok(goal.secret ? "secret" : "goal"), goal.secret ? "found" : "done", [strTok(goal.name)]), { tone: "good", type: true });
                setToast(goal.name);
                sfx("nfGoal");
                setTimeout(() => setToast((t) => (t === goal.name ? null : t)), 3200);
            }
            // a full-screen tree hides the board, so the page only needs to follow once a second (the game itself still ticks ten times a second)
            if (!treeOpenRef.current || tickN.current % 10 === 0) tickBump((n) => n + 1);
        }, 100);
        return () => {
            clearInterval(iv);
            setHum(null);
        };
    }, [ready, feedStore]);

    // ---- actions
    const doPress = useCallback(
        (stat: ButtonStat, tier: number, quiet = false) => {
            const s = g.current;
            const was = s.reboot;
            const intelWas = s.lab.intel;
            const owned = stat === "reboot" ? 0 : s.bought[stat][tier];
            let gainNow = button(s, stat, tier).gain;
            const n = press(s, stat, tier) ? 1 : 0;
            if (!n) {
                if (!quiet) sfx("deny");
                return false;
            }
            gainNow *= n;
            teachPress(s, stat, tier, n);
            rigManual(s);
            feed.current.lastPulse = performance.now();
            feed.current.pulseStat = Math.max(0, STATS.findIndex((x) => x.id === stat));
            dronePrev.current.manual += 1;
            juice.emit({ t: "press", stat, tier, gain: gainNow, quiet });
            if (owned === 0 && tier > 0 && !quiet && stat !== "reboot") juice.emit({ t: "tier", stat, tier });
            if (stat === "reboot") {
                sfx("nfReboot");
                feedStore.push([...call(idTok("system"), "reboot"), pun(" → "), num(`×${fmt(s.reboot - was)}`), txt(" "), { k: "c", v: `// cache wiped, reboot #${fmt(s.reboot)}${s.lab.intel - intelWas >= 1 ? `, crash dump +${fmt(s.lab.intel - intelWas)} intel` : ""}` }], { tone: "good", type: true });
            } else {
                if (owned === 0 && tier > 0 && !quiet) sfx("nfTierUp", { tier });
                else sfx("nfBuy", { tier, stat });
            }
            if (stat !== "reboot") {
                const name = LORE[stat].tiers[tier];
                feedStore.batch(`buy:${stat}:${tier}`, (n, sum) => buyToks(stat, name, n, sum), gainNow);
            }
            bump((n) => n + 1);
            return true;
        },
        [log, feedStore],
    );

    // ---- quick-time events (components/nodefarm/events.tsx): a win gives the timed Overclock plus its loot roll, a miss costs nothing
    const evResult = useCallback(
        (def: { title: string }, won: boolean, loot?: Loot | null) => {
            const s = g.current;
            if (won) {
                const r = breach(s);
                if (loot) payLoot(s, loot);
                bump((x) => x + 1);
                log(`${def.title.toUpperCase()} CLEARED. Overclock x${fmt(overclockMult(s))} ${r.stacked ? `extended to ${Math.round(s.overclock)} s` : `for ${Math.round(overclockSecs(s))} s`}.`, "good");
                if (loot) log(`LOOT // ${RARITY[loot.rarity].name.toUpperCase()}: ${loot.label}.`, loot.rarity >= 3 ? "hot" : "good");
                if (r.zero) log(`ZERO-DAY: ${fmt(r.zero.bytes ?? 0)} Bytes and 10 minutes of every material paid out.`, "good");
                if (r.echo) log("ECHO: something knocked back. Another event is coming.", "hot");
                if (r.intel >= 1) feedStore.push([...call(idTok("lab"), "capture", [strTok("trace")]), pun(" → "), num(`+${fmt(r.intel)} intel`)], { tone: "good", type: true });
                if (r.paid) log(`PATIENT: ${fmt(r.paid.bytes ?? 0)} Bytes and 5 minutes of every material paid out.`, "good");
                if (r.frenzy) log("SWARM ALARM: the Drones are in a frenzy, x4 speed for 60 s.", "hot");
                return { echo: r.echo };
            } else log(`${def.title} lost. No cost.`, "warn");
        },
        [log],
    );
    const evMiss = useCallback((def: { title: string }) => log(`${def.title} ignored. It passed.`, "warn"), [log]);
    const onZoneEv = useCallback(
        (id: number, c: ZeChoice) => {
            const r = zeChoose(g.current, id, c);
            if (!r.ok) { sfx("deny"); return; }
            teachEvent(g.current);
            nfx("nfBuy", { tier: 2 }, "events");
            if (c === "mine") log(`Vein mined: +${fmt(r.paid ?? 0)} ${statDef(r.stat ?? "bytes").name}.`, "good");
            else if (c === "patch") log(`Fault patched for ${fmt(r.paid ?? 0)} Bytes.`, "good");
            else log(c === "run" ? "Vein left running." : "Fault left to run out.", "good");
            save();
            bump((x) => x + 1);
        },
        [log, save],
    );
    const evEngage = useCallback((def: { title: string }) => log(`${def.title} engaged.`, "hot"), [log]);
    const setEvents = useCallback((on: boolean) => {
        setEvOn(on);
        try {
            localStorage.setItem(EV_KEY, on ? "on" : "off");
        } catch {}
        if (!on) log("Quick-time events off. Turn them back on in the Menu.", "warn");
    }, [log]);

    // ---- Scripts: announce newly learned scripts, batch what each one did into the feed, and run ascend.sh (online only)
    schedRef.current = (s: State) => {
        const a = s.auto;
        if (!a) return;
        const got = learnStep(s);
        for (const id of got) {
            const x = SCRIPT_BY.get(id)!;
            juice.emit({ t: "milestone", title: `${x.file} learned`, sub: `${x.name}. Press Run in Scripts to start it.` });
            feedStore.push([...call(idTok("cron"), "install", [strTok(x.file)]), pun(" → "), strTok("learned")], { tone: "hot", type: true });
            sfx("nfGoal");
        }
        const sp = schedPrev.current;
        if (sp.s === s)
            for (const x of SCRIPTS) {
                const n = (a.ran[x.id] ?? 0) - (sp.ran[x.id] ?? 0);
                if (n > 0 && x.id !== "ascend") feedStore.batch(`cron:${x.id}`, (_n, sum) => [...call(idTok("cron"), "run", [strTok(x.file)]), txt(" "), num(`×${fmt(sum)}`)], n, 6000);
            }
        if (ascendDue(s)) {
            ascendPrep(s);
            const gain = ascend(s);
            if (gain) {
                a.ran.ascend = (a.ran.ascend ?? 0) + 1;
                sfx("nfAscend");
                juice.emit({ t: "milestone", title: `ascend.sh: +${gain} AP`, sub: "A new run has started. Stop ascend.sh in Scripts to Ascend by hand again." });
                feedStore.push([...call(idTok("cron"), "run", [strTok("ascend.sh")]), pun(" → "), num(`+${gain} AP`), txt(" "), com("// everything else wiped")], { tone: "good", type: true });
            }
        }
        schedPrev.current = { s, ran: { ...a.ran } };
        if (got.length || a.ran.ascend !== sp.ran.ascend) save();
    };

    const doAscend = (now = false) => {
        if (lockedNote("Ascend")) return;
        if (!now && confirm !== "ascend") {
            setConfirm("ascend");
            setTimeout(() => setConfirm((c) => (c === "ascend" ? "" : c)), 4000);
            return;
        }
        if (g.current && canAscend(g.current)) keepBackup("before Ascend");
        const gain = ascend(g.current);
        setConfirm("");
        if (gain) {
            teachAscend(g.current);
            sfx("nfAscend");
            juice.emit({ t: "ascend", gain, ap: g.current.ap, n: g.current.life.ascends, each: apEach(g.current) });
            feedStore.push([...call(idTok("system"), "ascend"), pun(" → "), num(`+${gain} AP`), txt(" "), { k: "c", v: "// everything else wiped" }], { tone: "good", type: true });
            setSide("ascend");
            save();
        }
    };

    // ---- save safety
    const keepBackup = (why: string, force = true) => {
        setBackups(addBackup("event", why, JSON.stringify(g.current), { force }));
    };
    // two tabs on one save overwrite each other: when another tab writes, this one stops saving and says so
    useEffect(() => {
        if (!ready) return;
        const onStore = (e: StorageEvent) => { if (e.key === KEY && e.newValue) setStale(true); };
        window.addEventListener("storage", onStore);
        return () => window.removeEventListener("storage", onStore);
    }, [ready]);
    const applySave = (n: State, msg: string) => {
        n.at = Date.now();
        if (n.treeRefund) { log(`Old tree nodes refunded: ${fmt(n.treeRefund)} AP.`, "good"); delete n.treeRefund; }
        g.current = n;
        tipApi.hide();
        prevIds.current = null;
        setStale(false);
        staleRef.current = false;
        save();
        setIoMsg(msg);
        log(msg, "good");
    };
    const doImport = () => {
        const n = parseSave(ioText);
        if (!n) { setIoMsg("That code isn't a Node Farm save."); return; }
        // a save with progress in it is only replaced after a second press, and the old one goes to the backup slot
        if (hasProgress(g.current) && confirm !== "import") {
            setConfirm("import");
            setIoMsg("This replaces your current save. Press Import again to confirm; the old save is kept as a backup.");
            setTimeout(() => setConfirm((c) => (c === "import" ? "" : c)), 6000);
            return;
        }
        if (hasProgress(g.current)) keepBackup("before import");
        setConfirm("");
        applySave(n, "Save imported.");
    };
    const doRestore = (b: Backup) => {
        const n = b.kind === "lost" ? null : parseSave(b.code);
        if (!n) { setIoMsg("That backup cannot be read."); return; }
        // the save in play goes to the list first, so a restore can be undone
        if (hasProgress(g.current)) keepBackup("before restore");
        applySave(n, "Backup restored.");
    };
    /** a save that could not be read: its text goes in the box so it can be copied out and mended */
    const doRecover = (b: Backup) => { setIoText(b.code); setIoMsg("The unreadable save is in the box. Copy it somewhere safe before you do anything else."); };
    const doDownload = () => {
        save();
        try {
            const url = URL.createObjectURL(new Blob([exportSave(g.current)], { type: "text/plain" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = `node-farm-save-${new Date().toISOString().slice(0, 10)}.txt`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setIoMsg("Save file downloaded.");
        } catch { setIoMsg("Could not make a file. Use Export and copy the code."); }
    };
    const doUpload = (f: File) => {
        f.text().then((txt) => { setIoText(txt.trim()); setIoMsg(parseSave(txt) ? "File read. Press Import to load it." : "That file isn't a Node Farm save."); }).catch(() => setIoMsg("Could not read that file."));
    };
    useEffect(() => {
        document.body.classList.toggle("nf-calm", calm);
        return () => document.body.classList.remove("nf-calm");
    }, [calm]);
    const [jumpOn, setJumpOn] = useState(true);
    const toggleJump = () => {
        const v = !jumpOn;
        setJumpOn(v);
        try { localStorage.setItem(JUMP_KEY, v ? "on" : "off"); } catch {}
    };
    const toggleCalm = () => {
        const v = !calm;
        setCalm(v);
        try { localStorage.setItem(CALM_KEY, v ? "1" : "0"); } catch {}
    };
    const setFormat = (f: NumFmt) => {
        setNumFmt(f);
        setNumFmtState(f);
        try { localStorage.setItem(FMT_KEY, f); } catch {}
    };

    // ---- coming back to a save: the page opens with the intro on top, so bring the board into view once (a first visit still reads the intro)
    const brought = useRef(false);
    useEffect(() => {
        if (!ready || brought.current) return;
        brought.current = true;
        const s = g.current;
        let off = false;
        try { off = localStorage.getItem(JUMP_KEY) === "off"; } catch {}
        if (off || !s || s.life.presses < 20 || location.hash || window.scrollY > 120) return;
        // the page settles for a moment (fonts, backdrop), so align twice and stop as soon as the player scrolls themselves
        let y = -1;
        const align = () => {
            const el = document.querySelector<HTMLElement>(".nf");
            if (!el || (y >= 0 && Math.abs(window.scrollY - y) > 2)) return;
            y = Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - 70));
            window.scrollTo({ top: y, behavior: "auto" });
        };
        const t = setTimeout(align, 350);
        const t2 = setTimeout(align, 1300);
        const t3 = setTimeout(align, 2600);
        return () => { clearTimeout(t); clearTimeout(t2); clearTimeout(t3); };
    }, [ready]);

    // ---- tab title: while the tab is in the background it shows the rate, so progress is visible from the tab strip
    useEffect(() => {
        if (!ready) return;
        const base = document.title;
        const upd = () => {
            const s = g.current;
            if (!s) return;
            const d = derive(s);
            const st = nextStep(s, d);
            const ready = st.target?.stat !== undefined && st.frac >= 1 ? "● ready · " : "";
            document.title = document.visibilityState === "hidden" ? `${ready}${fmt(d.bytesPerSec)}/s · Node Farm` : base;
        };
        document.addEventListener("visibilitychange", upd);
        const iv = setInterval(upd, 2000);
        return () => { clearInterval(iv); document.removeEventListener("visibilitychange", upd); document.title = base; };
    }, [ready]);

    // ---- keyboard: one letter per window. Off while typing, with a modifier, over another panel or during an event.
    const keyApi = useRef<{ open: (w: Win | "tree") => void; lab: () => void; fw: () => void; go: () => void; press: (held: boolean) => void; tier: (k: number, held: boolean) => void; arc: (dir: number) => void; fold: () => void }>({ open: () => {}, lab: () => {}, fw: () => {}, go: () => {}, press: () => {}, tier: () => {}, arc: () => {}, fold: () => {} });
    useEffect(() => {
        if (!ready) return;
        const onKey = (e: KeyboardEvent) => {
            if (keyIsTyping(e) || keyOverlay()) return;
            // P presses the glowing button of the next step; holding it keeps buying like holding the button does
            if (e.key.toLowerCase() === "p") { e.preventDefault(); keyApi.current.press(e.repeat); return; }
            // 1 to 6 press that tier on the zone in the middle of the screen
            if (/^[1-6]$/.test(e.key)) { e.preventDefault(); keyApi.current.tier(Number(e.key) - 1, e.repeat); return; }
            if (e.repeat) return;
            const w = ({ m: "map", o: "goals", l: "records", a: "ascend", h: "handover", x: "stress", c: "codex", s: "menu", t: "tree" } as const)[e.key.toLowerCase() as "m"];
            if (w) { e.preventDefault(); keyApi.current.open(w); }
            else if (e.key.toLowerCase() === "k") { e.preventDefault(); keyApi.current.fw(); }
            else if (e.key.toLowerCase() === "r") { e.preventDefault(); keyApi.current.lab(); }
            else if (e.key.toLowerCase() === "g") { e.preventDefault(); keyApi.current.go(); }
            // Q and E step to the previous or next arc ([ and ] belong to the site); Z folds or opens the zone in the middle
            else if (e.key.toLowerCase() === "q" || e.key.toLowerCase() === "e") { e.preventDefault(); keyApi.current.arc(e.key.toLowerCase() === "e" ? 1 : -1); }
            else if (e.key.toLowerCase() === "z") { e.preventDefault(); keyApi.current.fold(); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [ready]);

    // codex: a feed line when a system you just reached gets its entry
    const codexAnn = useRef<Set<string> | null>(null);
    useEffect(() => {
        if (!ready) return;
        const timer = window.setInterval(() => {
            const st = g.current;
            if (!st) return;
            const now = codexUnlocked(st);
            const prev = codexAnn.current;
            codexAnn.current = new Set(now.map((e) => e.id));
            if (!prev) return;
            for (const e of now) if (!prev.has(e.id)) feedStore.push([...call(idTok("codex"), "entry", [strTok(e.id)]), pun(" "), com(`// ${e.title.toLowerCase()}. press C`)], { tone: "good", type: true });
        }, 2000);
        return () => window.clearInterval(timer);
    }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

    const doReset = (now = false) => {
        if (!now && confirm !== "reset") {
            setConfirm("reset");
            setTimeout(() => setConfirm((c) => (c === "reset" ? "" : c)), 4000);
            return;
        }
        if (hasProgress(g.current)) keepBackup("before wipe");
        g.current = fresh();
        prevIds.current = null;
        tipApi.hide();
        setConfirm("");
        feedStore.clear();
        log("Save wiped. The old save is kept as a backup in Menu.", "warn");
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
        // phones: the section opens under the tab grid, usually below the fold, so a tap would look like nothing happened
        if (window.innerWidth < 1000) {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                const bar = document.querySelector<HTMLElement>(".nf-tabs");
                if (!bar) return;
                window.scrollTo({ top: Math.max(0, bar.getBoundingClientRect().top + window.scrollY - 64), behavior: reduced ? "auto" : "smooth" });
            }));
        }
    };
    const openWin = (w: Win | "tree") => {
        if (w === "tree") { setWin(""); setTreeOpen(true); sfx("tab"); return; }
        if (w === "handover" && !handSeen(s)) return;
        if (w === "stress" && !chOpen(s)) return;
        setWin(w);
        setTabBoth(w);
    };
    const openLab = () => { if (!labOpen(s)) return; setWin(""); setTreeOpen(false); setFwTree(false); setLabTree(true); sfx("tab"); };
    const fwSeen = s.hand.count > 0 || s.hand.keys > 0;
    const openFw = () => { if (!fwSeen) return; setWin(""); setTreeOpen(false); setLabTree(false); setFwTree(true); sfx("tab"); };
    const doHandover = (proto: ProtoId, note: string, proto2: ProtoId | null) => {
        if (lockedNote("Handover")) return;
        if (keysOnHandover(s) < 1) return sfx("deny"); // nothing to hand over yet: no backup for a press that does nothing
        keepBackup("before Handover");
        const from = s.hand.proto;
        const keys = handover(s, proto, note, proto2);
        if (!keys) return sfx("deny");
        sfx("nfHandover");
        const p = protoDef(proto);
        const milestone = () => juice.emit({ t: "milestone", title: `Handover ${s.hand.count}: +${keys} Keys`, sub: `${p.op}'s protocol is running: ${p.name}. Flash Firmware with your Keys.` });
        setCut({ n: s.hand.count, keys, from, fromRank: from ? protoRank(s, from) : 0, to: proto, note: s.hand.notes.at(-1)?.n === s.hand.count ? s.hand.notes.at(-1)!.text : "", after: milestone });
        feedStore.push([...call(idTok("system"), "handover", [strTok(p.op.toLowerCase())]), pun(" → "), num(`+${keys} Keys`), txt(" "), { k: "c", v: "// node handed over" }], { tone: "good", type: true });
        prevIds.current = null;
        save();
        bump((n) => n + 1);
    };
    // stress tests (lib/nodefarm/stress.ts): the real run is stored inside the save and comes back on leave
    const doStress = (id: TestId) => {
        keepBackup("before a stress test");
        if (!startTest(s, id)) return sfx("deny");
        const t = testDef(id);
        sfx("nfStress");
        juice.emit({ t: "milestone", title: `Stress test: ${t.name}`, sub: `${t.rule} Your run is stored and comes back when you leave.` });
        feedStore.push([...call(idTok("stress"), "start", [strTok(id)]), pun(" → "), strTok("run stored"), txt(" "), com("// fresh run under the fault")], { tone: "hot", type: true });
        prevIds.current = null;
        closeWin();
        save();
        bump((n) => n + 1);
    };
    const doLeaveStress = () => {
        const got = leaveTest(s);
        if (got < 0) return sfx("deny");
        nfx("nfGoal", undefined, "runs");
        juice.emit({ t: "milestone", title: "Run restored", sub: `${got} rank${got === 1 ? "" : "s"} cleared in that test. Everything else is as you left it.` });
        feedStore.push([...call(idTok("stress"), "leave"), pun(" → "), strTok("run restored")], { tone: "good", type: true });
        prevIds.current = null;
        save();
        bump((n) => n + 1);
    };
    const doDeploy = (id: PayloadId) => {
        const p = payload(id);
        const r = deploy(s, id);
        if (!r.ok) return sfx("deny");
        teachDeploy(s);
        sfx(p.kind === "buff" ? "nfTierUp" : "nfGoal", { tier: 3 });
        juice.emit({ t: "milestone", title: `${p.name} deployed`, sub: r.stacked ? "Already running: its time was extended." : p.blurb });
        const tail = r.paid ? `paid ${fmt(r.paid.bytes ?? 0)} B` : r.stacked ? "extended" : p.kind === "charge" ? "armed" : p.kind === "buff" ? "running" : "done";
        feedStore.push([...call(idTok("payload"), "deploy", [strTok(id)]), pun(" → "), strTok(tail)], { tone: "hot", type: true });
        save();
        bump((n) => n + 1);
    };
    const treeSeenK = s.life.ascends > 0 || s.ap > 0 || s.tree.length > 0;
    keyApi.current = {
        go: () => {},
        press: () => {},
        tier: () => {},
        arc: () => {},
        fold: () => {},
        lab: () => { if (labTree) setLabTree(false); else if (!treeOpen && !fwTree && !droneTree) openLab(); },
        fw: () => { if (fwTree) setFwTree(false); else if (!treeOpen && !labTree && !droneTree) openFw(); },
        open: (w) => {
            if (labTree || fwTree || droneTree) return;
            if (treeOpen) { if (w === "tree") setTreeOpen(false); return; }
            if (w === "tree") { if (treeSeenK) openWin("tree"); return; }
            if (win === w) closeWin();
            else openWin(w);
        },
    };
    // the next-step guide: what to do, and a button that opens the right zone and scrolls to what glows
    const step = nextStep(s, d);
    const goTo = (t?: Target) => {
        if (!t) return;
        if (t.win === "lab") return openLab();
        if (t.win) return openWin(t.win);
        if (t.lab) {
            setTab("stats");
            if (folded.lab) setFold({ ...folded, lab: false });
            sfx("tab");
            setTimeout(() => document.querySelector<HTMLElement>(`.nf [data-stat="lab"]`)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" }), 90);
            return;
        }
        if (t.dtree) { setWin(""); setTreeOpen(false); setLabTree(false); setDroneTree(true); sfx("tab"); return; }
        setTab("stats");
        if (t.sched) {
            if (folded.sched) setFold({ ...folded, sched: false });
            sfx("tab");
            setTimeout(() => document.querySelector<HTMLElement>(`.nf [data-stat="sched"]`)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" }), 90);
            return;
        }
        const key = t.drone !== undefined ? "drones" : t.stat;
        if (!key) return;
        const arc = arcOf(key);
        if (folded[key] || (arc && folded[arcKey(arc.id)])) setFold({ ...(arc ? soloArc(folded, arc.id) : folded), [key]: false });
        sfx("tab");
        setTimeout(() => document.querySelector<HTMLElement>(`.nf [data-stat="${key}"]`)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" }), 90);
    };
    // the arc rail: the picked arc is the newest one not folded (the fold record keeps the pick across reloads)
    const liveArcs = shownArcIds(s);
    const selArc = [...liveArcs].reverse().find((id) => !folded[arcKey(id)]) ?? liveArcs[liveArcs.length - 1];
    // pick an arc on the rail: fold the others, and bring its header up if it is off screen
    const focusArc = (id: string) => {
        setFold(soloArc(folded, id));
        sfx("tab");
        setTimeout(() => {
            const h = document.querySelector<HTMLElement>(`.nf-arcgrp[data-arc="${id}"]`);
            if (!h) return;
            const top = h.getBoundingClientRect().top;
            if (top < 70 || top > window.innerHeight * 0.55) window.scrollTo({ top: window.scrollY + top - 96, behavior: reduced ? "auto" : "smooth" });
        }, 40);
    };
    keyApi.current.arc = (dir) => {
        if (win || treeOpenRef.current) return;
        const ids = liveArcs;
        if (!ids.length) return;
        const cur = ids.indexOf(selArc);
        setTab("stats");
        focusArc(ids[cur < 0 ? (dir > 0 ? 0 : ids.length - 1) : (cur + dir + ids.length) % ids.length]);
    };
    keyApi.current.fold = () => {
        if (win || treeOpenRef.current) return;
        const mid = window.innerHeight / 2;
        let best: HTMLElement | null = null;
        let gap = Infinity;
        document.querySelectorAll<HTMLElement>(".nf-statspane .nf-row[data-open]").forEach((row) => {
            const r = row.getBoundingClientRect();
            if (!r.height) return;
            const dist = r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
            if (dist < gap) { gap = dist; best = row; }
        });
        (best as HTMLElement | null)?.querySelector<HTMLButtonElement>(":scope > .nf-bar-t .nf-fold")?.click();
    };
    // fold every zone with nothing to buy, so the zones that need you sit together
    const foldIdle = () => {
        const next = { ...folded };
        for (const x of STATS) if (isUnlocked(s, x.id)) next[x.id] = x.id === "bytes" || readyCount(s, x.id) === 0;
        setFold(next);
        sfx("tab");
    };
    keyApi.current.tier = (k, held) => {
        if (win || treeOpenRef.current) return;
        // the open zone nearest the middle of the screen
        const mid = window.innerHeight / 2;
        let best: HTMLElement | null = null;
        let gap = Infinity;
        document.querySelectorAll<HTMLElement>(".nf-row[data-open='true']").forEach((row) => {
            if (!row.querySelector(".nf-btn")) return;
            const r = row.getBoundingClientRect();
            const dist = r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
            if (dist < gap) { gap = dist; best = row; }
        });
        const row = best as HTMLElement | null;
        if (!row || gap > window.innerHeight) return;
        if (held && row.dataset.stat === "reboot") return;
        const b = row.querySelector<HTMLButtonElement>(`.nf-btn[data-tier="${k}"]`);
        if (b) b.click();
    };
    keyApi.current.go = () => { if (!win && !treeOpenRef.current) goTo(step.target); };
    keyApi.current.press = (held) => {
        const t = step.target;
        if (win || treeOpenRef.current || !t) return;
        // nothing to press (a window, a Drone or the lab): P does what Show me does
        if (!t.stat || t.tier === undefined) { if (!held) goTo(t); return; }
        if (held && t.stat === "reboot") return;
        if (!canAfford(s, t.stat, t.tier)) { if (!held) { sfx("deny"); goTo(t); } return; }
        doPress(t.stat, t.tier, held);
    };
    const doDrone = (k: number) => {
        if (buyDrone(s, k)) { sfx("nfDrone", { tier: k }); feedStore.push([...call(idTok("drones"), "deploy", [strTok(`T${k + 1}`)]), pun(" → "), strTok("online")], { tone: "good", type: true }); bump((n) => n + 1); return true; }
        sfx("deny");
        return false;
    };
    // the guide's big button does the step itself when it can: press the glowing button, or build the Drone
    const doStep = (t?: Target) => {
        if (t?.stat !== undefined && t.tier !== undefined) return doPress(t.stat, t.tier);
        if (t?.drone !== undefined) return doDrone(t.drone);
        return false;
    };
    const treeSeen = s.life.ascends > 0 || s.ap > 0 || s.tree.length > 0;
    const sw = swInfo(s, d.bytesPerSec, lastSave, fs, labReady(s), win === "records" || (tab === "records" && !win));
    const era = eraOf(s);
    const firstLocked = STATS.find((x) => !isUnlocked(s, x.id))?.id;
    const laterLocked = STATS.filter((x) => !isUnlocked(s, x.id) && x.id !== firstLocked);
    const guideTarget = step.target && !step.target.win ? step.target : undefined;

    // Hold keys: a hidden copy refreshes about three times a second (slow) or at once when something was done (ver)
    const slow = Math.floor(tickN.current / 3);
    const slow2 = Math.floor(tickN.current / 2); // open system panels follow at 5 Hz
    const hk = `${ver}|${slow}`;
    const foldSig = JSON.stringify(folded);
    const guideKey = `${step.target?.drone ?? ""}${step.target?.lab ?? ""}${step.target?.win ?? ""}`;
    const onPane = (id: string) => win === id || tab === id;
    return (
        <TipCtx.Provider value={tipApi}>
        <div className="nf" ref={root} data-tab={tab} data-side={sideShown} data-win={win || undefined} data-fs={fs ? "" : undefined} data-oc={s.overclock > 0 ? "" : undefined}>
            {fs && (
                <div className="nf-fsbar">
                    <span>NODE.FARM // FULL SCREEN</span>
                    <button type="button" className="nf-fsbar-x" onClick={() => { setFs(false); sfx("tab"); }} aria-label="Exit full screen">Exit <kbd>F</kbd></button>
                </div>
            )}
            <Scenery era={era} />
            <header className="nf-hud">
                <div className="nf-hud-main">
                    <NfIcon name="bytes" responsive />
                    <div>
                        <b className="nf-big">{fmt(s.bytes)}</b>
                        <span className="nf-sub">Bytes · +{fmt(d.bytesPerSec)}/s</span>
                    </div>
                </div>
                <LabHud s={s} />
                {s.overclock > 0 && (
                    <div className="nf-oc" role="status">
                        <NfIcon name="spark" /> OVERCLOCK x{fmt(overclockMult(s))} · {Math.ceil(s.overclock)}s
                    </div>
                )}
                <div className="nf-hud-side">
                    {!fs && <button type="button" className="nf-fsb" onClick={() => { setFs(true); sfx("tab"); }} aria-label="Full screen">Full</button>}
                    <button type="button" className="nf-fsb nf-keysb" onClick={() => window.dispatchEvent(new Event("cm:keys"))} aria-haspopup="dialog" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">Keys ?</button>
                    <span className="nf-hud-n"><NfIcon name="reboot" /> {fmt(s.reboot)}<small>RBT</small></span>
                    <span className="nf-hud-n"><NfIcon name="mult" /> {fmt(s.mult)}<small>MUL</small></span>
                    {s.ap > 0 && <span className="nf-hud-n"><NfIcon name="ascend" /> {s.ap}<small>AP</small></span>}
                    {hasFeature(s, "deaddrop") && <DeadDrop s={s} onOpen={() => {
                        const got = openDrop(s);
                        if (!got) return sfx("deny");
                        teachDrop(s);
                        sfx("nfGoal");
                        log(`Dead drop opened: ${Object.entries(got).map(([k, v]) => `${fmt(v ?? 0)} ${statDef(k as MatId).name}`).join(", ")}.`, "good");
                        save();
                        bump((x) => x + 1);
                    }} />}
                </div>
                <Hold live={false} k={`${hk}|${win}|${fs}|${treeSeen}|${guideKey}`}><Dock info={sw} open={win} treeSeen={treeSeen} lab={labOpen(s)} guideWin={step.target?.win} fs={fs} onOpen={(w) => (w === "lab" ? openLab() : win === w ? closeWin() : openWin(w))} onFs={() => { setFs(!fs); sfx("tab"); }} /></Hold>
                <Hold live={false} k={hk}><StressStrip s={s} onOpen={() => openWin("stress")} /></Hold>
            </header>
            <GuideStrip s={s} d={d} step={step} onGo={() => goTo(step.target)} onDo={() => doStep(step.target)} onCell={goTo} onMap={() => openWin("map")} mapOpen={win === "map"} />
            <MiniHud bytes={s.bytes} rate={d.bytesPerSec} step={step} onGo={() => goTo(step.target)} paused={!!win || treeOpen || labTree || !!away || !!confirm} />
            {win && <button type="button" className="nf-scrim" aria-label="Close window" tabIndex={-1} onClick={closeWin} />}

            <Hold live={false} k={`${hk}|${tab}|${treeSeen}|${guideKey}`}><PhoneTabs info={sw} tab={tab} treeSeen={treeSeen} lab={labOpen(s)} guideWin={step.target?.win} onTab={(t) => setTabBoth(t)} onTree={() => openWin("tree")} onLab={openLab} /></Hold>

            {stale && (
                <div className="nf-stale" role="alert">
                    <span>Node Farm is open in another tab. This tab stopped saving so the two don&apos;t overwrite each other.</span>
                    <button type="button" className="nf-mini" onClick={() => location.reload()}>Load latest save</button>
                    <button type="button" className="nf-mini" onClick={() => { try { const other = localStorage.getItem(KEY); if (other) setBackups(addBackup("event", "before this tab saved over another", other, { force: true })); } catch {} setStale(false); staleRef.current = false; save(); }}>Save from here</button>
                </div>
            )}
            {toast && <div className="nf-toast" role="status"><NfIcon name="spark" /> Goal: {toast}</div>}

            <ZoneEventCard s={s} id={zeCard} onChoose={onZoneEv} onClose={closeZeCard} reduced={reduced} />
            <EventLayer game={g} ready={ready} enabled={evOn && !chOff(s, "events")} busy={!!win || treeOpen || labTree || droneTree || fwTree || !!cut || !!away || !!confirm} reduced={reduced} onEngage={evEngage} onResult={evResult} onMiss={evMiss} onDisable={() => setEvents(false)} />
            <Juice reduced={reduced} />
            {d && <PokeLayer s={s} d={d} root={root} coreFeed={feed} feed={feedStore} reduced={reduced} onChange={() => { save(); bump((n) => n + 1); }} onGo={goTo} onArm={(z) => { toggleBuyStat(s, z); sfx("tab"); log(`buy.sh ${s.auto?.buy[z] ? "now buys" : "stopped on"} ${statDef(z).name}.`, "good"); save(); bump((n) => n + 1); }} />}

            <section className="nf-pane nf-corepane" data-pane="core" aria-label="Core">
                <div className="nf-core-wrap">
                    <div className="nf-core" role="img" aria-label={`Reactor core. ${fmt(d.bytesPerSec)} Bytes per second.`}>
                        <Core feed={feed} reduced={reduced} />
                        <span className="nf-core-tag">{s.ap > 0 ? `NODE 01 // ASCENDED ×${s.life.ascends || 1}` : feed.current.unlocked >= 6 ? "NODE 01 // CRYSTAL" : "NODE 01 // ONLINE"}</span>
                    </div>
                </div>
                <dl className="nf-readout">
                    <div><dt>Bytes/s</dt><dd>{fmt(d.bytesPerSec)}</dd></div>
                    <div><dt>To reboot</dt><dd>{Math.round(feed.current.progress * 100)}%</dd></div>
                    <div><dt>Global</dt><dd>×{fmt(d.global)}</dd></div>
                </dl>
                <Feed store={feedStore} reduced={reduced} />
                <SceneWindow era={era} />
            </section>

            <section className="nf-pane nf-statspane" data-pane="stats" aria-label="Stats and buttons" onClick={(e) => blankFoldTarget(e.target as HTMLElement)?.click()}>
                <Hold live={false} k={`${hk}|${foldSig}`}><Chain s={s} d={d} allOpen={!STATS.every((x) => folded[x.id])} onAll={(open) => setFold({ ...folded, ...Object.fromEntries(STATS.map((x) => [x.id, !open])) })} onIdle={foldIdle} onJump={(id) => goTo({ stat: id as Target["stat"] })} /></Hold>
                {labOpen(s) && (
                    <Hold live={false} k={`${ver}|${folded.lab ? slow : slow2}|${foldSig}|${guideKey}`}>
                    <LabZone
                        s={s}
                        d={d}
                        open={!folded.lab}
                        onToggle={() => { setFold({ ...folded, lab: !folded.lab }); sfx("tab"); }}
                        onResearch={openLab}
                        guided={!!step.target?.lab || step.target?.win === "lab"}
                        onCompile={(id) => { if (compile(s, id)) { teachCompile(s); sfx("nfBuy", { tier: 2 }); feedStore.push([...call(idTok("gcc"), "compile", [strTok(`${id}.c`)]), pun(" → "), strTok("queued")], { tone: "good" }); bump((n) => n + 1); } else sfx("deny"); }}
                        onCancel={(i) => { if (cancelCompile(s, i)) { sfx("tab"); bump((n) => n + 1); } }}
                        onDeploy={(id) => doDeploy(id)}
                    />
                    </Hold>
                )}
                {schedOpen(s) && (
                    <Hold live={false} k={`${ver}|${folded.sched ? slow : slow2}|${foldSig}|${guideKey}`}>
                    <ScriptsZone
                        s={s}
                        open={!folded.sched}
                        onToggle={() => { setFold({ ...folded, sched: !folded.sched }); sfx("tab"); }}
                        onChange={(msg) => { nfx(msg ? "nfScript" : "tab", { on: !!msg?.endsWith("running") }, "automation"); if (msg) feedStore.push([...call(idTok("cron"), msg.endsWith("running") ? "start" : "stop", [strTok(msg.split(" ")[0])])], { tone: msg.endsWith("running") ? "good" : "warn" }); save(); bump((n) => n + 1); }}
                    />
                    </Hold>
                )}
                {isUnlocked(s, "aether") && (
                    <Hold live={false} k={`${ver}|${folded.drones ? slow : slow2}|${foldSig}|${guideKey}`}>
                    <DroneBay
                        s={s}
                        guided={step.target?.drone}
                        open={!folded.drones}
                        onToggle={() => { setFold({ ...folded, drones: !folded.drones }); sfx("tab"); }}
                        onBuy={doDrone}
                        onPost={(k, st) => {
                            if (!setPost(s, k, st)) return sfx("deny");
                            sfx("tab");
                            feedStore.push([...call(idTok("drones"), st ? "post" : "dock", [strTok(`T${k + 1}`), ...(st ? [pun(", "), strTok(st)] : [])]), pun(" → "), strTok(st ? `${DRONE_NAMES[k]} on station` : "docked, idle")], { tone: "good" });
                            save();
                            bump((n) => n + 1);
                        }}
                        onMod={(k, m) => {
                            if (!buyMod(s, k, m)) return sfx("deny");
                            sfx("nfDrone", { tier: Math.min(5, k + 1) });
                            feedStore.push([...call(idTok("drones"), "refit", [strTok(`T${k + 1}`), pun(", "), strTok(MODS[m].id)]), pun(" → "), num(`lv ${s.dr.mods[k][m]}`)], { tone: "good" });
                            bump((n) => n + 1);
                        }}
                        onTree={() => { setWin(""); setTreeOpen(false); setLabTree(false); setDroneTree(true); sfx("tab"); }}
                    />
                    </Hold>
                )}
                <Hold live={false} k={`${hk}|${foldSig}|${selArc}`}><ArcRail s={s} arcs={liveArcs} sel={selArc} onPick={focusArc} /></Hold>
                {ARCS.map((arc, ai) => {
                    const shown = arc.zones.filter((z) => isUnlocked(s, z as StatId) || z === firstLocked);
                    if (!shown.length) return null;
                    const preview = !shown.some((z) => isUnlocked(s, z as StatId)); // only the next encrypted zone: always shown
                    if (!preview && arc.id !== selArc) return null; // the rail shows one arc at a time
                    const arcOpen = true;
                    return (
                        <div key={arc.id} className="nf-arcgrp" data-arc={arc.id} data-preview={preview ? "" : undefined} data-rail="" role="group" aria-label={arc.name} style={{ ["--arc" as string]: arc.color } as CSSProperties}>
                            <Hold live={false} k={`${hk}|${foldSig}`}><ArcHead arc={arc} no={ai + 1} s={s} open={arcOpen} onToggle={() => {}} /></Hold>
                            {arcOpen && (
                                <div id={`nf-arc-${arc.id}`} className="nf-arc-zones">
                                    {shown.map((id) => (
                                        <StatRow key={id} id={id as StatId} s={s} d={d} guide={guideTarget} onPress={doPress} onArm={() => { toggleBuyStat(s, id); sfx("tab"); bump((n) => n + 1); }} onWatchdog={() => { s.watchdog = !s.watchdog; sfx("tab"); log(`Watchdog timer ${s.watchdog ? "on: Reboots run themselves" : "off"}.`, s.watchdog ? "good" : "warn"); bump((n) => n + 1); }} open={!folded[id]} onToggle={() => { setFold({ ...folded, [id]: !folded[id] }); sfx("tab"); }} onZoneEv={onZoneEv} zeCard={zeCard} />
                                    ))}
                                    {!preview && <ArcStep s={s} arcs={liveArcs} sel={selArc} onPick={focusArc} />}
                                </div>
                            )}
                        </div>
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
                <Hold live={onPane("map")} k=""><WinBar id="map" info={sw} treeSeen={treeSeen} lab={labOpen(s)} onSwitch={(w) => (w === "lab" ? openLab() : openWin(w))} onClose={closeWin} /></Hold>
                <Hold live={onPane("map")} k=""><MapPanel s={s} d={d} onTree={() => openWin("tree")} onWin={(w) => openWin(w)} onLab={() => { closeWin(); openLab(); }} /></Hold>
            </section>
            <section className="nf-pane nf-sidepane" data-pane="goals" aria-label="Goals" role="dialog" aria-modal="false">
                <Hold live={onPane("goals")} k=""><WinBar id="goals" info={sw} treeSeen={treeSeen} lab={labOpen(s)} onSwitch={(w) => (w === "lab" ? openLab() : openWin(w))} onClose={closeWin} /></Hold><Hold live={onPane("goals")} k=""><GoalsPanel s={s} /></Hold></section>
            <section className="nf-pane nf-sidepane" data-pane="records" aria-label="Records" role="dialog" aria-modal="false">
                <Hold live={onPane("records")} k=""><WinBar id="records" info={sw} treeSeen={treeSeen} lab={labOpen(s)} onSwitch={(w) => (w === "lab" ? openLab() : openWin(w))} onClose={closeWin} /></Hold><Hold live={onPane("records")} k=""><RecordsPanel s={s} /></Hold></section>
            <section className="nf-pane nf-sidepane" data-pane="ascend" aria-label="Ascend" role="dialog" aria-modal="false">
                <Hold live={onPane("ascend")} k=""><WinBar id="ascend" info={sw} treeSeen={treeSeen} lab={labOpen(s)} onSwitch={(w) => (w === "lab" ? openLab() : openWin(w))} onClose={closeWin} /></Hold>
                <Hold live={onPane("ascend")} k=""><AscendPanel s={s} d={d} confirm={confirm === "ascend"} onAscend={doAscend} onPerk={(id) => { if (buyPerk(s, id)) { sfx("nfBuy", { tier: 3 }); bump((n) => n + 1); } else lockedNote("Perks"); }} onTree={() => openWin("tree")} onMount={(i, m) => { if (setMount(s, i, m)) { sfx("tab"); save(); bump((n) => n + 1); } }} /></Hold>
            </section>
            {handSeen(s) && (
                <section className="nf-pane nf-sidepane" data-pane="handover" aria-label="Handover" role="dialog" aria-modal="false">
                    <Hold live={onPane("handover")} k=""><WinBar id="handover" info={sw} treeSeen={treeSeen} lab={labOpen(s)} onSwitch={(w) => (w === "lab" ? openLab() : openWin(w))} onClose={closeWin} /></Hold>
                    <Hold live={onPane("handover")} k="">
                    <HandoverPanel
                        s={s}
                        onHandover={doHandover}
                        onFirmware={openFw}
                        onProto={(id, second) => { if (setProto(s, id, second)) { sfx("tab"); log(`Protocol: ${protoDef(id).op}, ${protoDef(id).name}${second ? " (Dual boot, half strength)" : ""}.`, "good"); save(); bump((n) => n + 1); } }}
                    />
                    </Hold>
                </section>
            )}
            {chOpen(s) && (
                <section className="nf-pane nf-sidepane" data-pane="stress" aria-label="Stress tests" role="dialog" aria-modal="false">
                    <Hold live={onPane("stress")} k=""><WinBar id="stress" info={sw} treeSeen={treeSeen} lab={labOpen(s)} onSwitch={(w) => (w === "lab" ? openLab() : openWin(w))} onClose={closeWin} /></Hold>
                    <Hold live={onPane("stress")} k=""><StressPanel s={s} onStart={doStress} onLeave={doLeaveStress} /></Hold>
                </section>
            )}
            <section className="nf-pane nf-sidepane" data-pane="codex" aria-label="Codex" role="dialog" aria-modal="false">
                <Hold live={onPane("codex")} k=""><WinBar id="codex" info={sw} treeSeen={treeSeen} lab={labOpen(s)} onSwitch={(w) => (w === "lab" ? openLab() : openWin(w))} onClose={closeWin} /></Hold>
                <Hold live={onPane("codex")} k=""><CodexPanel s={s} shown={win === "codex" || (tab === "codex" && !win)} onOpen={(w) => (w === "lab" ? (closeWin(), openLab()) : openWin(w))} /></Hold>
            </section>
            <section className="nf-pane nf-sidepane" data-pane="menu" aria-label="Menu" role="dialog" aria-modal="false">
                <Hold live={onPane("menu")} k=""><WinBar id="menu" info={sw} treeSeen={treeSeen} lab={labOpen(s)} onSwitch={(w) => (w === "lab" ? openLab() : openWin(w))} onClose={closeWin} /></Hold>
                <Hold live={onPane("menu")} k="">
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
                    onImport={doImport}
                    importConfirm={confirm === "import"}
                    onDownload={doDownload}
                    onUpload={doUpload}
                    backups={backups}
                    onRestore={doRestore}
                    onRecover={doRecover}
                    volume={snd.master}
                    onVolume={(v) => setSnd({ master: v })}
                    calm={calm}
                    osCalm={osReduced}
                    onCalm={toggleCalm}
                    jumpOn={jumpOn}
                    onJump={toggleJump}
                    lastSave={lastSave}
                    numFmt={numFmt}
                    onNumFmt={setFormat}
                    onReset={() => doReset(true)}
                />
                </Hold>
            </section>
            {adminOn && !adminOpen && <button type="button" className="nf-ad-tab" onClick={() => setAdminOpen(true)} aria-label="Open the root console"><i />root</button>}
            {adminOn && adminOpen && <AdminPanel host={adminHost} />}
            {labTree && (
                <TreeMenu
                    s={s}
                    model={labModel(s)}
                    ver={`${s.lab.nodes.length}|${Math.floor(s.lab.intel)}`}
                    reduced={reduced}
                    onBuy={(id) => {
                        if (!buyLabNode(s, id)) return sfx("deny");
                        sfx("nfBuy", { tier: 4 });
                        const n = labNode(id);
                        feedStore.push([...call(idTok("lab"), "research", [strTok(n.name)]), pun(" → "), strTok(n.fx.recipe ? "payload unlocked" : "installed")], { tone: "good", type: true });
                        save();
                        bump((x) => x + 1);
                    }}
                    onClose={closeLab}
                />
            )}
            {droneTree && (
                <TreeMenu
                    s={s}
                    model={droneModel(s)}
                    ver={`${s.dr.nodes.join(",")}|${masteryRanks(s)}`}
                    reduced={reduced}
                    onBuy={(id) => {
                        if (!buyDroneNode(s, id)) return sfx("deny");
                        nfx("nfDrone", { tier: 4 });
                        feedStore.push([...call(idTok("hangar"), "fit", [strTok(droneNode(id).name)]), pun(" → "), strTok("installed")], { tone: "good", type: true });
                        save();
                        bump((x) => x + 1);
                    }}
                    onRespec={() => { const back = respecDrones(s); sfx("tab"); log(`Drone tree respec: ${fmt(back)} Cores back.`, "good"); save(); bump((n) => n + 1); return back; }}
                    onClose={closeDrones}
                />
            )}
            {cut && <HandoverCut info={cut} reduced={reduced} onDone={() => { const a = cut.after; setCut(null); a(); }} />}
            {fwTree && (
                <TreeMenu
                    s={s}
                    model={fwModel(s)}
                    ver={`${s.hand.fw.join(",")}|${s.hand.keys}`}
                    reduced={reduced}
                    onBuy={(id) => {
                        if (!buyFw(s, id)) { if (!lockedNote("Firmware")) sfx("deny"); return; }
                        sfx("nfBuy", { tier: 5 });
                        feedStore.push([...call(idTok("fw"), "flash", [strTok(fwNode(id).name)]), pun(" → "), strTok("ok")], { tone: "good", type: true });
                        save();
                        bump((x) => x + 1);
                    }}
                    onRespec={() => { if (lockedNote("The Firmware respec")) return 0; const back = respecFw(s); sfx("tab"); log(`Firmware respec: ${fmt(back)} Keys back.`, "good"); save(); bump((n) => n + 1); return back; }}
                    onClose={closeFw}
                />
            )}
            {treeOpen && (
                <TreeMenu
                    s={s}
                    ver={`${s.tree.join(",")}|${s.ap}|${JSON.stringify(s.treeLv ?? {})}`}
                    reduced={reduced}
                    onBuy={(id) => { if (buyNode(s, id)) { sfx("nfBuy", { tier: 4 }); bump((n) => n + 1); } else if (!lockedNote("The prestige tree")) sfx("deny"); }}
                    onRespec={() => { if (lockedNote("The tree respec")) return 0; const back = respec(s); sfx("tab"); log(`Tree respec: ${fmt(back)} AP refunded.`, "good"); save(); bump((n) => n + 1); return back; }}
                    onClose={closeTree}
                />
            )}
            <Tip host={root} store={tipStore} />
            {away && <AwayReport away={away} era={era} reduced={reduced} onClose={() => setAway(null)} />}
        </div>
        </TipCtx.Provider>
    );
}

/** Dead drop (Systems node): a cache that fills over real hours. A thin meter in the HUD, a button once it is full. */
function DeadDrop({ s, onOpen }: { s: State; onOpen: () => void }) {
    const f = dropFill(s);
    const left = (1 - f) * TUNE.dropHours * 3600;
    return f >= 1
        ? <button type="button" className="nf-drop" data-ready="" onClick={onOpen} aria-label="Open the Dead drop">DROP READY</button>
        : <span className="nf-drop" title={`Dead drop fills in ${fmtTime(left)}`} aria-label={`Dead drop ${Math.floor(f * 100)}% full, ready in ${fmtTime(left)}`}><i style={{ width: `${f * 100}%` }} />DROP {Math.floor(f * 100)}%</span>;
}

