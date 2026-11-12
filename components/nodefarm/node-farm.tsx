"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { sfx } from "@/lib/sound/sounds";
import { setHum } from "@/lib/sound/engine";
import { useSoundPrefs } from "@/lib/sound/use-sound";
import {
    TUNE, overclockMult, overclockSecs, respec, ascend, autoBuy, breach, button, buyDrone, buyNode, buyPerk, toggleArm, checkGoals, derive, exportSave, fmt, fmtTime, fresh, getNumFmt, setNumFmt, type NumFmt, isUnlocked, offline, parseSave, press, STATS, tick,
    apEach, dropFill, hasFeature, openDrop, pressMax, setMount, statDef,
    buyLabNode, cancelCompile, compile, deploy, labNode, labOpen, payload, type PayloadId,
    type ButtonStat, type MatId, type State,
} from "@/lib/nodefarm/engine";
import type { NfLive } from "@/lib/nodefarm/records";
import { Core, type CoreFeed } from "./core";
import { NfIcon } from "./icon";
import { EventLayer } from "./events";
import { RARITY, payLoot, type Loot } from "@/lib/nodefarm/events";
import { AwayReport, type Away } from "./away";
import { Scenery, SceneWindow } from "./scenery";
import dynamic from "next/dynamic";
// The prestige tree (menu, backdrop, sprites) is the biggest piece of the game and most visits never open it, so it loads on its
// own and is fetched quietly once the board is idle.
const loadTree = () => import("./tree");
const TreeMenu = dynamic(() => loadTree().then((m) => ({ default: m.TreeMenu })), { ssr: false });
import { LabHud, LabZone, labModel, labReady } from "./lab";
import { ScriptsZone } from "./scripts";
import { SCRIPTS, SCRIPT_BY, ascendDue, learnStep, schedOpen, teachAscend, teachCompile, teachDeploy, teachDrop, teachPress } from "@/lib/nodefarm/scripts";
import { eraOf } from "@/lib/nodefarm/scenery";
import { DroneBay } from "./drones";
import { Chain, StatRow } from "./stat-row";
import { Feed } from "./feed";
import { FeedStore, buyToks, call, com, droneToks, fromText, id as idTok, num, p as pun, str as strTok, txt, unlockToks, type FeedTone } from "@/lib/nodefarm/feed";
import { markSeen, newsToks, pickNews } from "@/lib/nodefarm/news";
import { LORE } from "@/lib/nodefarm/lore";
import { LOGS, logNo, recoverLogs } from "@/lib/nodefarm/story";
import { Juice, juice, checkMilestones } from "./juice";
import { GuideStrip, Tip, TipCtx, type TipApi, type TipState } from "./guide";
import { MapPanel } from "./map";
import { nextStep, type Target } from "@/lib/nodefarm/guide";
import { GoalsPanel, MenuPanel, RecordsPanel } from "./systems";
import { AscendPanel } from "./ascend";
import { Dock, PhoneTabs, WinBar, swInfo } from "./switcher";
import { AdminPanel, type AdminHost } from "./admin";
import { isAdmin, setAdmin } from "@/lib/nodefarm/admin";
import { adminFlags } from "@/lib/nodefarm/engine";
import { codeReveal, cxClear } from "@/lib/nodefarm/cx";

const KEY = "nf-save-v1";
const EV_KEY = "nf-events-v1"; // "off" when quick-time events are switched off (per device)
const FS_KEY = "nf-fs-v1"; // full screen mode on or off (per device)
const HUM_KEY = "nf-hum-v1"; // reactor hum on or off (per device)
const UI_KEY = "nf-ui-v1"; // which stat panels are minimized (per device, not part of the game save)
const MAX_KEY = "nf-max-v1"; // "1" when Buy max (Batch job node) is switched on (per device)
const CALM_KEY = "nf-calm-v1"; // "1" when motion is forced calm, on top of the OS setting (per device)
const FMT_KEY = "nf-numfmt-v1"; // number format: short | sci | eng (per device)
const BACKUP_KEY = "nf-backup-v1"; // the save as it was just before an import, a wipe or a failed load (one slot)
const CORRUPT_KEY = "nf-corrupt-v1"; // raw text of a save that could not be read, kept instead of being overwritten
type Tab = "core" | "stats" | "map" | "goals" | "records" | "ascend" | "menu";
const SIDE: Tab[] = ["map", "goals", "records", "ascend", "menu"];

function load(): { s: State | null; unreadable: boolean } {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return { s: null, unreadable: false };
        const s = parseSave(raw);
        // a save that will not parse (damaged, or from a newer build) must not be overwritten five seconds later
        if (!s) {
            try { localStorage.setItem(CORRUPT_KEY, raw); } catch {}
        }
        return { s, unreadable: !s };
    } catch {
        return { s: null, unreadable: false };
    }
}

export type Backup = { at: number; why: string; code: string };
function readBackup(): Backup | null {
    try {
        const b = JSON.parse(localStorage.getItem(BACKUP_KEY) ?? "null");
        return b && typeof b.code === "string" && parseSave(b.code) ? b : null;
    } catch {
        return null;
    }
}

const hasProgress = (s: State) => s.life.presses > 0 || s.life.secs > 60;

export function NodeFarm() {
    const g = useRef<State>(null as unknown as State);
    const [ready, setReady] = useState(false);
    const [, bump] = useState(0);
    const [tab, setTab] = useState<Tab>("core");
    const [side, setSide] = useState<Tab>("goals");
    const [win, setWin] = useState<"" | "map" | "goals" | "records" | "ascend" | "menu">("");
    const [treeOpen, setTreeOpen] = useState(false);
    /** the Exploit Lab's research tree (same menu as the prestige tree, blue lab skin) */
    const [labTree, setLabTree] = useState(false);
    const labPrev = useRef<{ s: State | null; seen: boolean; compiled: number }>({ s: null, seen: false, compiled: 0 });
    // stable on purpose: the tree's modal effect re-runs whenever this changes, and this component re-renders ten times a second
    const closeTree = useCallback(() => setTreeOpen(false), []);
    const closeLab = useCallback(() => setLabTree(false), []);
    const treeOpenRef = useRef(false);
    treeOpenRef.current = treeOpen;

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
    const [backup, setBackup] = useState<Backup | null>(null);
    const [ioText, setIoText] = useState("");
    const [ioMsg, setIoMsg] = useState("");
    const [buyMax, setBuyMax] = useState(false);
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
    const buyMaxRef = useRef(false);
    buyMaxRef.current = buyMax;
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
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeWin(); };
        window.addEventListener("keydown", onKey);
        // clears reveal transforms and lifts the board above the hero while a window is open (see nodefarm.css)
        document.body.classList.add("nf-win-open");
        document.querySelector<HTMLElement>(`.nf [data-pane="${win}"] .nf-win-x`)?.focus();
        return () => { window.removeEventListener("keydown", onKey); document.body.classList.remove("nf-win-open"); };
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
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const t = e.target as HTMLElement | null;
            if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
            if (document.querySelector(".cn-panel, .nv-find, .nf-tm-host, .nf-aw")) return;
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
    const saved = useRef(0);
    const warnedSave = useRef(false);
    const tickN = useRef(0);

    // plain text lines get a level tag and highlighted numbers; code-style lines go through feedStore.push with tokens
    const log = useCallback((text: string, tone?: FeedTone) => feedStore.push(fromText(text, tone), { tone, type: true }), [feedStore]);

    // ---- boot: load the save, bank offline time, print the greeting
    useEffect(() => {
        setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        try {
            const u = localStorage.getItem(UI_KEY);
            if (u) setFolded(JSON.parse(u));
            if (localStorage.getItem(EV_KEY) === "off") setEvOn(false);
            if (localStorage.getItem(MAX_KEY) === "1") setBuyMax(true);
            if (localStorage.getItem(CALM_KEY) === "1") setCalm(true);
            const nf = localStorage.getItem(FMT_KEY);
            if (nf === "sci" || nf === "eng") { setNumFmt(nf); setNumFmtState(nf); }
            setBackup(readBackup());
            if (localStorage.getItem(HUM_KEY) === "0") {
                humRef.current = false;
                setHumOn(false);
            }
        } catch {}
        const timers: ReturnType<typeof setTimeout>[] = [];
        const got = load();
        const s = got.s ?? fresh();
        if (got.unreadable) timers.push(setTimeout(() => log("The saved game could not be read. It is kept in this browser; a new game starts.", "warn"), 1800));
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
    busyRef.current = !!win || treeOpen || !!away || !!confirm;
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
            localStorage.setItem(KEY, JSON.stringify(s));
            saved.current = Date.now();
            setLastSave(saved.current);
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
                const r = offline(copy, secs);
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
            } else {
                const sp = speedRef.current;
                if (sp > 1) { const n = Math.ceil((gap * sp) / 5); for (let i = 0; i < n; i++) tick(s, (gap * sp) / n); }
                else tick(s, Math.max(0, gap));
                // presses nobody clicked (Drones, Autoloader) are counted from the lifetime total, then batched into one feed line
                const dp = dronePrev.current;
                const scriptMade = schedPress.current.s === s ? (s.auto?.presses ?? 0) - schedPress.current.n : 0;
                schedPress.current = { s, n: s.auto?.presses ?? 0 };
                if (dp.s === s) {
                    const made = s.life.presses - dp.presses - dp.manual - scriptMade;
                    if (made > 0) feedStore.batch("drone", (n, sum) => droneToks(sum, s.armed.length, !s.drones.some((x) => x > 0)), made, 4000);
                }
                dronePrev.current = { s, presses: s.life.presses, manual: 0 };
            }
            if (++tickN.current % 10 === 0 && s.perks.auto > 0) autoBuy(s);
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
                    juice.emit({ t: "milestone", title: "Exploit Lab decrypted", sub: "Intel now runs alongside Bytes. Research a recipe, compile it, deploy it." });
                    feedStore.push([...call(idTok("lab"), "mount", [strTok("~/lab")]), pun(" → "), strTok("intel online")], { tone: "good", type: true });
                    sfx("nfDecrypt");
                }
                const made = s.life.compiled - lp.compiled;
                if (made > 0) feedStore.batch("lab:compiled", () => [...call(idTok("gcc"), "link", [strTok(`${s.lab.last ?? "payload"}.c`)]), pun(" → "), num(`+${made}`), txt(" "), com("// in stock")], made, 4000);
            }
            labPrev.current = { s, seen: s.lab.seen, compiled: s.life.compiled };
            f.reboots = s.reboot;
            f.ap = s.ap;
            if (prevUnlocked.current && f.unlocked > prevUnlocked.current) sfx("nfDecrypt");
            prevUnlocked.current = f.unlocked;
            setHum(humRef.current ? { level: Math.min(1, f.speed * 0.75 + (f.unlocked / 7) * 0.25), boost: f.overclock } : null);
            for (const goal of checkGoals(s)) {
                feedStore.push(call(idTok(goal.secret ? "secret" : "goal"), goal.secret ? "found" : "done", [strTok(goal.name)]), { tone: "good", type: true });
                setToast(goal.name);
                sfx("nfGoal");
                setTimeout(() => setToast((t) => (t === goal.name ? null : t)), 3200);
            }
            // the full-screen tree hides the board, so it only needs to follow twice a second (the game itself still ticks ten times a second)
            if (!treeOpenRef.current || tickN.current % 5 === 0) bump((n) => n + 1);
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
            // Buy max (Batch job node): one press buys as many as the balance allows
            const n = stat !== "reboot" && buyMaxRef.current && hasFeature(s, "buymax") ? pressMax(s, stat, tier) : press(s, stat, tier) ? 1 : 0;
            if (!n) {
                if (!quiet) sfx("deny");
                return false;
            }
            gainNow *= n;
            teachPress(s, stat, tier, n);
            feed.current.lastPulse = performance.now();
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
        if (!now && confirm !== "ascend") {
            setConfirm("ascend");
            setTimeout(() => setConfirm((c) => (c === "ascend" ? "" : c)), 4000);
            return;
        }
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
    const keepBackup = (why: string) => {
        try {
            const b: Backup = { at: Date.now(), why, code: exportSave(g.current) };
            localStorage.setItem(BACKUP_KEY, JSON.stringify(b));
            setBackup(b);
        } catch {}
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
    const doRestore = () => {
        const b = readBackup();
        const n = b && parseSave(b.code);
        if (!b || !n) { setIoMsg("No backup to restore."); return; }
        const swap = { at: Date.now(), why: "before restore", code: exportSave(g.current) };
        applySave(n, "Backup restored.");
        try { localStorage.setItem(BACKUP_KEY, JSON.stringify(swap)); setBackup(swap); } catch {}
    };
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

    // ---- tab title: while the tab is in the background it shows the rate, so progress is visible from the tab strip
    useEffect(() => {
        if (!ready) return;
        const base = document.title;
        const upd = () => {
            const s = g.current;
            if (!s) return;
            document.title = document.visibilityState === "hidden" ? `${fmt(derive(s).bytesPerSec)}/s · Node Farm` : base;
        };
        document.addEventListener("visibilitychange", upd);
        const iv = setInterval(upd, 2000);
        return () => { clearInterval(iv); document.removeEventListener("visibilitychange", upd); document.title = base; };
    }, [ready]);

    // ---- keyboard: one letter per window. Off while typing, with a modifier, over another panel or during an event.
    const keyApi = useRef<{ open: (w: "map" | "goals" | "records" | "ascend" | "menu" | "tree") => void; max: () => void; lab: () => void }>({ open: () => {}, max: () => {}, lab: () => {} });
    useEffect(() => {
        if (!ready) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || e.repeat) return;
            const el = e.target as HTMLElement | null;
            if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
            if (document.querySelector(".nv-scrim, .nf-ev-scrim:not([data-out]), .nf-aw, .nf-rx")) return;
            const w = ({ m: "map", o: "goals", l: "records", a: "ascend", s: "menu", t: "tree" } as const)[e.key.toLowerCase() as "m"];
            if (w) { e.preventDefault(); keyApi.current.open(w); }
            else if (e.key.toLowerCase() === "b") keyApi.current.max();
            else if (e.key.toLowerCase() === "r") { e.preventDefault(); keyApi.current.lab(); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [ready]);

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
    };
    const openWin = (w: "map" | "goals" | "records" | "ascend" | "menu" | "tree") => {
        if (w === "tree") { setWin(""); setTreeOpen(true); sfx("tab"); return; }
        setWin(w);
        setTabBoth(w);
    };
    const openLab = () => { if (!labOpen(s)) return; setWin(""); setTreeOpen(false); setLabTree(true); sfx("tab"); };
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
        lab: () => { if (labTree) setLabTree(false); else if (!treeOpen) openLab(); },
        open: (w) => {
            if (labTree) return;
            if (treeOpen) { if (w === "tree") setTreeOpen(false); return; }
            if (w === "tree") { if (treeSeenK) openWin("tree"); return; }
            if (win === w) closeWin();
            else openWin(w);
        },
        max: () => { if (hasFeature(s, "buymax")) { const v = !buyMax; setBuyMax(v); sfx("tab"); try { localStorage.setItem(MAX_KEY, v ? "1" : "0"); } catch {} } },
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
        setTab("stats");
        const key = t.drone !== undefined ? "drones" : t.stat;
        if (!key) return;
        if (folded[key]) setFold({ ...folded, [key]: false });
        sfx("tab");
        setTimeout(() => document.querySelector<HTMLElement>(`.nf [data-stat="${key}"]`)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" }), 90);
    };
    const treeSeen = s.life.ascends > 0 || s.ap > 0 || s.tree.length > 0;
    const sw = swInfo(s, d.bytesPerSec, lastSave, fs, labReady(s), win === "records" || (tab === "records" && !win));
    const era = eraOf(s);
    const firstLocked = STATS.find((x) => !isUnlocked(s, x.id))?.id;
    const laterLocked = STATS.filter((x) => !isUnlocked(s, x.id) && x.id !== firstLocked);
    const guideTarget = step.target && !step.target.win ? step.target : undefined;

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
                    <span><NfIcon name="reboot" /> {fmt(s.reboot)}</span>
                    <span><NfIcon name="mult" /> {fmt(s.mult)}</span>
                    {s.ap > 0 && <span><NfIcon name="ascend" /> {s.ap} AP</span>}
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
                <Dock info={sw} open={win} treeSeen={treeSeen} lab={labOpen(s)} guideWin={step.target?.win} fs={fs} onOpen={(w) => (w === "lab" ? openLab() : win === w ? closeWin() : openWin(w))} onFs={() => { setFs(!fs); sfx("tab"); }} />
            </header>
            <GuideStrip step={step} onGo={() => goTo(step.target)} onMap={() => openWin("map")} mapOpen={win === "map"} />
            {win && <button type="button" className="nf-scrim" aria-label="Close window" tabIndex={-1} onClick={closeWin} />}

            <PhoneTabs info={sw} tab={tab} treeSeen={treeSeen} lab={labOpen(s)} guideWin={step.target?.win} onTab={(t) => setTabBoth(t)} onTree={() => openWin("tree")} onLab={openLab} />

            {stale && (
                <div className="nf-stale" role="alert">
                    <span>Node Farm is open in another tab. This tab stopped saving so the two don&apos;t overwrite each other.</span>
                    <button type="button" className="nf-mini" onClick={() => location.reload()}>Load latest save</button>
                    <button type="button" className="nf-mini" onClick={() => { setStale(false); staleRef.current = false; save(); }}>Save from here</button>
                </div>
            )}
            {toast && <div className="nf-toast" role="status"><NfIcon name="spark" /> Goal: {toast}</div>}

            <EventLayer game={g} ready={ready} enabled={evOn} busy={!!win || treeOpen || labTree || !!away || !!confirm} reduced={reduced} onEngage={evEngage} onResult={evResult} onMiss={evMiss} onDisable={() => setEvents(false)} />
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
                    <div><dt>To reboot</dt><dd>{Math.round(feed.current.progress * 100)}%</dd></div>
                    <div><dt>Global</dt><dd>×{fmt(d.global)}</dd></div>
                </dl>
                <Feed store={feedStore} reduced={reduced} />
                <SceneWindow era={era} />
            </section>

            <section className="nf-pane nf-statspane" data-pane="stats" aria-label="Stats and buttons">
                <Chain s={s} d={d} allOpen={!STATS.every((x) => folded[x.id])} onAll={(open) => setFold(Object.fromEntries(STATS.map((x) => [x.id, !open])))} max={buyMax} onMax={() => { const v = !buyMax; setBuyMax(v); sfx("tab"); try { localStorage.setItem(MAX_KEY, v ? "1" : "0"); } catch {} }} />
                {labOpen(s) && (
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
                )}
                {schedOpen(s) && (
                    <ScriptsZone
                        s={s}
                        open={!folded.sched}
                        onToggle={() => { setFold({ ...folded, sched: !folded.sched }); sfx("tab"); }}
                        onChange={(msg) => { sfx("tab"); if (msg) feedStore.push([...call(idTok("cron"), msg.endsWith("running") ? "start" : "stop", [strTok(msg.split(" ")[0])])], { tone: msg.endsWith("running") ? "good" : "warn" }); save(); bump((n) => n + 1); }}
                    />
                )}
                {isUnlocked(s, "aether") && (
                    <DroneBay s={s} guided={step.target?.drone} open={!folded.drones} onToggle={() => { setFold({ ...folded, drones: !folded.drones }); sfx("tab"); }} onBuy={(k) => { if (buyDrone(s, k)) { sfx("nfBuy", { tier: k }); feedStore.push([...call(idTok("drones"), "deploy", [strTok(`T${k + 1}`)]), pun(" → "), strTok("online")], { tone: "good", type: true }); bump((n) => n + 1); } else sfx("deny"); }} />
                )}
                {STATS.map((def) => {
                    if (!isUnlocked(s, def.id) && def.id !== firstLocked) return null;
                    return (
                        <StatRow key={def.id} id={def.id} s={s} d={d} guide={guideTarget} onPress={doPress} onArm={() => { toggleArm(s, def.id); sfx("tab"); bump((n) => n + 1); }} onWatchdog={() => { s.watchdog = !s.watchdog; sfx("tab"); log(`Watchdog timer ${s.watchdog ? "on: Reboots run themselves" : "off"}.`, s.watchdog ? "good" : "warn"); bump((n) => n + 1); }} open={!folded[def.id]} onToggle={() => { setFold({ ...folded, [def.id]: !folded[def.id] }); sfx("tab"); }} />
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
                <WinBar id="map" info={sw} treeSeen={treeSeen} lab={labOpen(s)} onSwitch={(w) => (w === "lab" ? openLab() : openWin(w))} onClose={closeWin} />
                <MapPanel s={s} d={d} onTree={() => openWin("tree")} onWin={(w) => openWin(w)} onLab={() => { closeWin(); openLab(); }} />
            </section>
            <section className="nf-pane nf-sidepane" data-pane="goals" aria-label="Goals" role="dialog" aria-modal="false">
                <WinBar id="goals" info={sw} treeSeen={treeSeen} lab={labOpen(s)} onSwitch={(w) => (w === "lab" ? openLab() : openWin(w))} onClose={closeWin} /><GoalsPanel s={s} /></section>
            <section className="nf-pane nf-sidepane" data-pane="records" aria-label="Records" role="dialog" aria-modal="false">
                <WinBar id="records" info={sw} treeSeen={treeSeen} lab={labOpen(s)} onSwitch={(w) => (w === "lab" ? openLab() : openWin(w))} onClose={closeWin} /><RecordsPanel s={s} /></section>
            <section className="nf-pane nf-sidepane" data-pane="ascend" aria-label="Ascend" role="dialog" aria-modal="false">
                <WinBar id="ascend" info={sw} treeSeen={treeSeen} lab={labOpen(s)} onSwitch={(w) => (w === "lab" ? openLab() : openWin(w))} onClose={closeWin} />
                <AscendPanel s={s} d={d} confirm={confirm === "ascend"} onAscend={doAscend} onPerk={(id) => { if (buyPerk(s, id)) { sfx("nfBuy", { tier: 3 }); bump((n) => n + 1); } }} onTree={() => openWin("tree")} onMount={(i, m) => { if (setMount(s, i, m)) { sfx("tab"); save(); bump((n) => n + 1); } }} />
            </section>
            <section className="nf-pane nf-sidepane" data-pane="menu" aria-label="Menu" role="dialog" aria-modal="false">
                <WinBar id="menu" info={sw} treeSeen={treeSeen} lab={labOpen(s)} onSwitch={(w) => (w === "lab" ? openLab() : openWin(w))} onClose={closeWin} />
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
                    backup={backup}
                    onRestore={doRestore}
                    volume={snd.master}
                    onVolume={(v) => setSnd({ master: v })}
                    calm={calm}
                    osCalm={osReduced}
                    onCalm={toggleCalm}
                    lastSave={lastSave}
                    numFmt={numFmt}
                    onNumFmt={setFormat}
                    hasMax={hasFeature(s, "buymax")}
                    onReset={() => doReset(true)}
                />
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
                        feedStore.push([...call(idTok("lab"), "research", [strTok(n.name)]), pun(" → "), strTok(n.fx.recipe ? "recipe unlocked" : "installed")], { tone: "good", type: true });
                        save();
                        bump((x) => x + 1);
                    }}
                    onClose={closeLab}
                />
            )}
            {treeOpen && (
                <TreeMenu
                    s={s}
                    ver={`${s.tree.join(",")}|${s.ap}|${JSON.stringify(s.treeLv ?? {})}`}
                    reduced={reduced}
                    onBuy={(id) => { if (buyNode(s, id)) { sfx("nfBuy", { tier: 4 }); bump((n) => n + 1); } else sfx("deny"); }}
                    onRespec={() => { const back = respec(s); sfx("tab"); log(`Tree respec: ${fmt(back)} AP refunded.`, "good"); save(); bump((n) => n + 1); return back; }}
                    onClose={closeTree}
                />
            )}
            <Tip host={root} tip={tip} />
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

