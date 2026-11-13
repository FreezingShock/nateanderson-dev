"use client";

// Node Farm window switcher: the desktop module rail under the HUD, the phone section grid, and the coloured title bar
// every window wears (with its own switch strip, so one window can hop to another without closing first).
// Each window keeps one colour everywhere (rail slot, phone tab, title bar, frame) and its letter key. Styles:
// app/camino/nodefarm-switcher.css (nf-sw-*). Window open/close still runs through node-farm.tsx and lib/nodefarm/cx.ts.

import { useRef, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import { PixelIcon, type PixelName } from "@/components/cm/pixel-icons";
import { scrambleNow } from "@/lib/motion/engine";
import { GOALS, STATS, TREE, TUNE, apOnAscend, canAscend, fmt, isUnlocked, nodeOpen, type State, ascendNeed, handSeen, keysOnHandover } from "@/lib/nodefarm/engine";
import { goalCounts } from "@/lib/nodefarm/records";
import { LOGS } from "@/lib/nodefarm/story";
import { RANKS_ALL, chOpen, chRun, ranksTotal, testDef } from "@/lib/nodefarm/stress";
import { codexNew, unlocked as codexOpen } from "@/lib/nodefarm/codex";

export type WinId = "map" | "goals" | "records" | "ascend" | "handover" | "stress" | "codex" | "menu" | "tree";
/** Everything the rail and hop strip can open: the windows plus the full-screen menus (tree, lab). */
export type OpenId = WinId | "lab";
export type SwId = OpenId | "core" | "stats" | "full";

type Def = { label: string; key?: string; icon: PixelName; color: string; path: string };
export const SW: Record<SwId, Def> = {
    core: { label: "Core", icon: "target", color: "#6bffc9", path: "core" },
    stats: { label: "Zones", icon: "chart", color: "#4aa8ff", path: "zones" },
    map: { label: "Map", key: "M", icon: "map", color: "#2fd8e8", path: "map" },
    goals: { label: "Goals", key: "O", icon: "trophy", color: "#ffc53a", path: "goals" },
    records: { label: "Records", key: "L", icon: "book", color: "#f0a53c", path: "records" },
    ascend: { label: "Ascend", key: "A", icon: "ascend", color: "#ff2d8a", path: "ascend" },
    tree: { label: "Tree", key: "T", icon: "tree", color: "#a98bff", path: "tree" },
    handover: { label: "Handover", key: "H", icon: "key", color: "#3dff6e", path: "handover" },
    stress: { label: "Stress", key: "X", icon: "zap", color: "#ff2a2a", path: "stress" },
    lab: { label: "Lab", icon: "code", color: "#9fd0ff", path: "lab" },
    codex: { label: "Codex", key: "C", icon: "bulb", color: "#ff6b57", path: "codex" },
    menu: { label: "Menu", key: "S", icon: "settings", color: "#b6f04a", path: "config" },
    full: { label: "Full screen", key: "F", icon: "expand", color: "#e8e8e8", path: "fs" },
};
const WIN_ORDER: OpenId[] = ["map", "goals", "records", "ascend", "tree", "lab", "stress", "handover", "codex", "menu"];
/** Tree and lab show once seen; anything else can hide itself through its info line (Handover, before the Origin arc ends). */
const shown = (w: OpenId, tree: boolean, lab: boolean, info?: SwInfo) => (w !== "tree" || tree) && (w !== "lab" || lab) && !info?.[w]?.hide;

/** One line of live state per slot, and whether that window wants a look (a lit pip). */
export type SwInfo = Record<SwId, { read: string; hot?: boolean; hide?: boolean }>;

// Records shows a pip for logs recovered since it was last opened. Kept per browser, not in the save. Cached in the
// module because swInfo runs on every game render (10 a second) and the game component returns early before it boots.
const SEEN_KEY = "nf-sw-v1";
let seenLogs: number | null = null;
function logsSeen(): number {
    if (seenLogs === null) {
        try { seenLogs = Number(JSON.parse(localStorage.getItem(SEEN_KEY) || "{}").logs) || 0; } catch { seenLogs = 0; }
    }
    return seenLogs;
}
function markLogsSeen(n: number) {
    seenLogs = n;
    try { localStorage.setItem(SEEN_KEY, JSON.stringify({ logs: n })); } catch {}
}

/** Plain function, not a hook: the game calls it after its boot early-return. */
export function swInfo(s: State, bps: number, lastSave: number, fs: boolean, labReady: number, recordsOpen: boolean): SwInfo {
    if (recordsOpen && logsSeen() !== s.logs.length) markLogsSeen(s.logs.length);
    const seen = logsSeen();
    const zones = STATS.filter((x) => isUnlocked(s, x.id)).length;
    const g = goalCounts(s);
    const ready = canAscend(s);
    const hkeys = keysOnHandover(s);
    const spend = s.ap > 0 && TREE.some((n) => !s.tree.includes(n.id) && nodeOpen(s, n) && n.cost <= s.ap);
    const newLogs = Math.max(0, s.logs.length - seen);
    const ago = lastSave ? Math.max(0, Math.round((Date.now() - lastSave) / 1000)) : -1;
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
        core: { read: `${fmt(bps)}/s` },
        stats: { read: `${pad(zones)}/${pad(STATS.length)} open` },
        map: { read: `zone ${pad(zones)}` }, // same numbering as the Map window and the zone names everywhere else (Bytes is zone 01, Sunstone 25)
        goals: { read: `${g.goals}/${GOALS.length}` },
        records: { read: newLogs ? `${newLogs} new` : `${s.logs.length} logs`, hot: newLogs > 0 },
        ascend: { read: ready ? `ready +${fmt(apOnAscend(s))}` : `${fmt(s.aether)}/${fmt(ascendNeed(s))} AE`, hot: ready, hide: !isUnlocked(s, "aether") && s.life.ascends === 0 },
        tree: { read: spend ? `${s.ap} AP free` : `${s.tree.length}/${TREE.length}`, hot: spend },
        codex: (() => { const n = codexNew(s).length; return { read: n ? `${n} new` : `${codexOpen(s).length} entries`, hot: n > 0, hide: s.reboot < 1 && s.life.ascends === 0 }; })(),
        menu: { read: ago < 0 ? "not saved" : ago < 60 ? `saved ${ago}s` : `saved ${Math.floor(ago / 60)}m` },
        lab: { read: labReady ? `${labReady} ready` : `${fmt(s.lab.intel)} intel`, hot: labReady > 0 },
        full: { read: fs ? "on" : "off" },
        stress: { read: chRun(s) ? testDef(chRun(s)!.id).name.toLowerCase() : `${ranksTotal(s)}/${RANKS_ALL} ranks`, hot: !!chRun(s), hide: !chOpen(s) },
        handover: { read: hkeys > 0 ? `ready +${hkeys} keys` : s.hand.count ? `${s.hand.keys} keys` : "node zero", hot: hkeys > 0, hide: !handSeen(s) },
    };
}

/** Decode the label once per hover (site rule: titles scramble once per hover, never stuck). */
function useHoverScramble() {
    const ref = useRef<HTMLSpanElement>(null);
    const onEnter = (e: RPointerEvent) => {
        if (e.pointerType !== "mouse" || !ref.current) return;
        if (document.body.classList.contains("nf-calm") || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        scrambleNow(ref.current, 260);
    };
    return { ref, onEnter };
}

const vars = (id: SwId) => ({ ["--sw" as string]: SW[id].color }) as CSSProperties;

function Slot({ id, info, active, guide, onClick, compact = false }: { id: SwId; info: SwInfo; active?: boolean; guide?: boolean; onClick: () => void; compact?: boolean }) {
    const def = SW[id];
    const { ref, onEnter } = useHoverScramble();
    const it = info[id];
    return (
        <button
            type="button"
            className="nf-sw-b"
            style={vars(id)}
            data-sw={id}
            data-hot={it.hot ? "" : undefined}
            data-on={active ? "" : undefined}
            data-compact={compact ? "" : undefined}
            data-guide={guide ? "" : undefined}
            aria-haspopup={id === "full" ? undefined : "dialog"}
            aria-pressed={id === "full" ? active : undefined}
            aria-label={`${def.label}${def.key ? ` (${def.key})` : ""}: ${it.read}`}
            onPointerEnter={onEnter}
            onClick={onClick}
        >
            <i className="nf-sw-ic" aria-hidden="true"><PixelIcon name={def.icon} size={24} /></i>
            {!compact && (
                <span className="nf-sw-t" aria-hidden="true">
                    <span className="nf-sw-l" ref={ref}>{def.label}</span>
                    <span className="nf-sw-r">{it.read}</span>
                </span>
            )}
            {def.key && <kbd className="nf-sw-k" aria-hidden="true">{def.key}</kbd>}
            {it.hot && <span className="nf-sw-pip" aria-hidden="true" />}
        </button>
    );
}

/** Desktop: one rail of window modules under the HUD. */
export function Dock({ info, open, treeSeen, lab, guideWin, fs, onOpen, onFs }: { info: SwInfo; open: WinId | ""; treeSeen: boolean; lab: boolean; guideWin?: string; fs: boolean; onOpen: (w: OpenId) => void; onFs: () => void }) {
    const ids = WIN_ORDER.filter((w) => shown(w, treeSeen, lab, info));
    return (
        <nav className="nf-dock nf-sw" aria-label="Game windows" data-many={ids.length >= 8 ? "" : undefined} style={{ ["--n" as string]: ids.length } as CSSProperties}>
            <span className="nf-sw-cap" aria-hidden="true">$ open</span>
            {ids.map((w) => (
                <Slot key={w} id={w} info={info} active={open === w} guide={guideWin === w} onClick={() => onOpen(w)} />
            ))}
            <Slot id="full" info={info} active={fs} compact onClick={onFs} />
        </nav>
    );
}

/** Phone: the section grid (Core and Zones are in-page sections, the rest are the same windows as desktop). */
export function PhoneTabs({ info, tab, treeSeen, lab, guideWin, onTab, onTree, onLab }: { info: SwInfo; tab: string; treeSeen: boolean; lab: boolean; guideWin?: string; onTab: (t: Exclude<SwId, "tree" | "lab" | "full">) => void; onTree: () => void; onLab: () => void }) {
    const ids: Exclude<SwId, "full">[] = ["core", "stats", ...WIN_ORDER.filter((w) => shown(w, treeSeen, lab, info))];
    // 8 sections sit four across, 9 three across, 10 five across, so no row is left with one; 11 and 12 go four across
    return (
        <nav className="nf-tabs nf-sw-ph" aria-label="Game sections" data-cols={ids.length === 10 ? 5 : undefined} style={{ ["--cols" as string]: ids.length === 9 || ids.length === 6 ? 3 : ids.length === 10 ? 5 : 4 } as CSSProperties}>
            {ids.map((t) => {
                const def = SW[t];
                const on = tab === t;
                return (
                    <button
                        key={t}
                        type="button"
                        className="nf-tab"
                        style={vars(t)}
                        data-tab-btn={t}
                        data-hot={info[t].hot ? "" : undefined}
                        data-guide={guideWin === t ? "" : undefined}
                        aria-pressed={t === "tree" || t === "lab" ? undefined : on}
                        aria-haspopup={t === "tree" || t === "lab" ? "dialog" : undefined}
                        aria-label={`${def.label}: ${info[t].read}`}
                        onClick={() => (t === "tree" ? onTree() : t === "lab" ? onLab() : onTab(t))}
                    >
                        <i className="nf-sw-ic" aria-hidden="true"><PixelIcon name={def.icon} size={20} /></i>
                        <span className="nf-sw-l" aria-hidden="true">{def.label}</span>
                        <span className="nf-sw-r" aria-hidden="true">{info[t].read}</span>
                        {info[t].hot && <span className="nf-sw-pip" aria-hidden="true" />}
                    </button>
                );
            })}
        </nav>
    );
}

/** The title bar every desktop window wears: its colour, icon and path, a strip to hop to another window, its key, close. */
export function WinBar({ id, info, treeSeen, lab, onSwitch, onClose }: { id: WinId; info: SwInfo; treeSeen: boolean; lab: boolean; onSwitch: (w: OpenId) => void; onClose: () => void }) {
    const def = SW[id];
    const ids = WIN_ORDER.filter((w) => shown(w, treeSeen, lab, info));
    return (
        <div className="nf-win-bar nf-sw-bar" style={vars(id)}>
            <i className="nf-sw-bar-ic" aria-hidden="true"><PixelIcon name={def.icon} size={20} /></i>
            <span className="nf-sw-bar-t">
                <span className="sr-only">{def.label}</span>
                <b aria-hidden="true" data-cx-scr="">{def.label}</b>
                <span className="nf-sw-bar-p" aria-hidden="true">naos://node.farm/{def.path}</span>
            </span>
            <span className="nf-sw-bar-r" aria-hidden="true">{info[id].read}</span>
            <span className="nf-sw-hop" role="group" aria-label="Switch window">
                {ids.map((w) => (
                    <button
                        key={w}
                        type="button"
                        className="nf-sw-hb"
                        style={vars(w)}
                        data-on={w === id ? "" : undefined}
                        data-hot={info[w].hot ? "" : undefined}
                        aria-current={w === id ? "true" : undefined}
                        aria-label={`${SW[w].label}${SW[w].key ? ` (${SW[w].key})` : ""}: ${info[w].read}`}
                        onClick={() => w !== id && onSwitch(w)}
                    >
                        <PixelIcon name={SW[w].icon} size={16} />
                        {/* hover / focus card: the name types in, then its live line and key print under it */}
                        <span className="nf-sw-tip" aria-hidden="true">
                            <b style={{ ["--len" as string]: SW[w].label.length } as CSSProperties}>{SW[w].label}</b>
                            <span className="nf-sw-tip-r">{w === id ? "you are here" : info[w].read}</span>
                            {SW[w].key && <kbd>{SW[w].key}</kbd>}
                        </span>
                    </button>
                ))}
            </span>
            {def.key && <kbd className="nf-sw-k" aria-hidden="true">{def.key}</kbd>}
            <button type="button" className="nf-win-x" onClick={onClose} aria-label={`Close ${def.label}`}>
                <i />
            </button>
        </div>
    );
}
