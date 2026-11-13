"use client";

// The touch layer: what on the board answers a tap (rules in lib/nodefarm/poke.ts).
// - Exact-number tips on every figure (HUD, core readout, zone numbers, spec lines, signal chain) through the shared tip
//   layer, found by delegation so the panels themselves need no change. Hover on desktop, a tap on touch.
// - Links: a signal chain stop or a "Feeds ..." spec line jumps to that zone.
// - Zone quick menu: right-click or long-press a zone panel: scan it, tick it for buy.sh, jump to its neighbours.
// Nothing here runs per frame: it all waits for input.

import { useContext, useEffect, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import { createPortal } from "react-dom";
import "@/app/camino/nodefarm/poke.css";
import { nfx } from "@/lib/nodefarm/sound";
import type { SfxName } from "@/lib/sound/sounds";

// scans play in the "world" mix
const sfx = (n: SfxName, a?: unknown) => nfx(n, a, "world");
import { STATS, achPoints, apGlobal, derive, fmt, fmtTime, isUnlocked, overclockMult, singularityAll, sunstoneAll, statDef, MATS, TUNE, type State, type StatId, type MatId } from "@/lib/nodefarm/engine";
import { exact, type Target, type TipInfo } from "@/lib/nodefarm/content/guide";
import { LORE } from "@/lib/nodefarm/content/lore";
import { call, id as idTok, num, p as pun, str as strTok, type FeedStore } from "@/lib/nodefarm/feed";
import { shownStage, hasZoneArt } from "@/lib/nodefarm/zones/zone-art";
import { neighbours, zoneRate } from "@/lib/nodefarm/poke";
import type { CoreFeed } from "../zones/core";
import { TipCtx } from "./guide";

type D = ReturnType<typeof derive>;
const zoneNo = (z: StatId) => String(STATS.findIndex((x) => x.id === z) + 1).padStart(2, "0");
const zoneName = (z: StatId) => LORE[z]?.zone ?? statDef(z).name;
const isTouch = (e: { pointerType?: string }) => e.pointerType === "touch" || e.pointerType === "pen";

// ---- tips for the figures already on the board
function rate3(r: number): [string, string][] {
    return [["Per second", `${fmt(r)}`], ["Per minute", fmt(r * 60)], ["Per hour", fmt(r * 3600)]];
}
function zoneTip(s: State, d: D, z: StatId): TipInfo {
    const def = statDef(z);
    const amt = s[z] as number;
    const isMat = (MATS as readonly string[]).includes(z);
    const rate = z === "bytes" ? d.bytesPerSec : isMat ? d.rates[z as MatId] : 0;
    const rows: [string, string][] = [["Exact", exact(amt)]];
    if (rate > 0) rows.push(...rate3(rate), ["Doubles in", amt > 0 ? fmtTime(amt / rate) : "now"]);
    if (isMat) rows.push(["Nodes", exact(s.prod[z as MatId])]);
    const n = neighbours(z);
    return {
        color: def.color,
        kicker: `ZONE ${zoneNo(z)} // EXACT`,
        title: def.name,
        rows,
        note: n.feeds ? `Feeds ${statDef(n.feeds).name}.` : undefined,
        status: hasZoneArt(z) ? `Scene stage ${shownStage(s, z)} of 7. Right-click or hold for more.` : "Right-click or hold for more.",
        tone: "ok",
    };
}
/** "Feeds Copper" -> copper; "Feeds Reboot power" -> reboot. */
function fedStat(label: string): StatId | undefined {
    if (!label.startsWith("Feeds ")) return undefined;
    const w = label.slice(6).split(" ")[0].toLowerCase();
    return STATS.find((x) => x.name.toLowerCase().startsWith(w.replace(/s$/, "")))?.id;
}
function specTip(s: State, z: StatId, label: string, value: string): TipInfo {
    const def = statDef(z);
    const to = fedStat(label);
    const rows: [string, string][] = [[label, value], ["From", `${exact(s[z] as number)} ${def.name}`]];
    if (to) rows.push(["Into", `${exact(s[to] as number)} ${statDef(to).name}`]);
    return {
        color: def.color,
        kicker: `ZONE ${zoneNo(z)} // ${label.toUpperCase()}`,
        title: value,
        rows,
        status: to ? (isUnlocked(s, to) ? `Tap to jump to ${zoneName(to)}.` : "That zone is still encrypted.") : "Updates live.",
        tone: "ok",
    };
}
function globalTip(s: State, d: D): TipInfo {
    const ap = apGlobal(s);
    const goals = 1 + achPoints(s) * TUNE.achBonus;
    const oc = s.overclock > 0 ? overclockMult(s) : 1;
    const ch = d.boosts.chAll;
    const sn = singularityAll(s) * sunstoneAll(s);
    const known = ap * goals * oc * ch * sn;
    const rows: [string, string][] = [["Ascension Points", `×${fmt(ap)}`], ["Goals and secrets", `×${fmt(goals)}`]];
    if (oc > 1) rows.push(["Overclock", `×${fmt(oc)}`]);
    if (ch > 1) rows.push(["Chrono", `×${fmt(ch)}`]);
    if (sn > 1.0001) rows.push(["Singularity and Sunstone", `×${fmt(sn)}`]);
    rows.push(["Perks, tree and the rest", `×${fmt(d.global / known)}`]);
    return { color: "#2fd8e8", kicker: "CORE // GLOBAL BOOST", title: `×${exact(d.global)}`, note: "Multiplies Bytes and every material.", rows, status: "Every source multiplies the others.", tone: "ok" };
}
function bytesTip(s: State, d: D): TipInfo {
    const rows: [string, string][] = [["Exact", exact(s.bytes)], ...rate3(d.bytesPerSec), ["Global boost", `×${fmt(d.global)}`]];
    if (s.overclock > 0) rows.push(["Overclock", `×${fmt(overclockMult(s))} for ${Math.ceil(s.overclock)}s`]);
    return { color: "#2fd8e8", kicker: "HUD // BYTES", title: `${fmt(d.bytesPerSec)} per second`, rows, status: `Lifetime ${fmt(s.life.bytes)} Bytes.`, tone: "ok" };
}
interface MenuState { z: StatId; x: number; y: number }

export function PokeLayer({ s, d, root, coreFeed, feed, reduced, onChange, onGo, onArm }: {
    s: State;
    d: D;
    root: MutableRefObject<HTMLDivElement | null>;
    coreFeed: MutableRefObject<CoreFeed>;
    feed: FeedStore;
    reduced: boolean;
    /** something changed the save: save and re-render */
    onChange: () => void;
    onGo: (t: Target) => void;
    onArm: (z: StatId) => void;
}) {
    const tip = useContext(TipCtx);
    const [menu, setMenu] = useState<MenuState | null>(null);
    // latest props for the delegated listeners, which are bound once
    const live = useRef({ s, d, onGo, onChange, reduced });
    live.current = { s, d, onGo, onChange, reduced };
    const swallow = useRef(0);
    const menuRef = useRef<HTMLDivElement>(null);

    // ---- delegated: figure tips, links, quick menu
    useEffect(() => {
        const host = root.current;
        if (!host) return;
        const zoneOf = (el: Element | null) => (el?.closest<HTMLElement>(".nf-row[data-stat]")?.dataset.stat as StatId | undefined) ?? undefined;
        const chainStat = (li: Element) => {
            const short = li.querySelector("b")?.textContent?.trim();
            return STATS.find((x) => x.short === short)?.id;
        };
        /** the figure under a target and how to describe it */
        const figure = (t: Element): { el: HTMLElement; build: () => TipInfo } | null => {
            const L = () => live.current;
            const big = t.closest<HTMLElement>(".nf-hud .nf-big, .nf-hud-main");
            if (big) return { el: big, build: () => bytesTip(L().s, L().d) };
            const hn = t.closest<HTMLElement>(".nf-hud-n");
            if (hn) {
                const k = hn.querySelector("small")?.textContent;
                const z: StatId | null = k === "RBT" ? "reboot" : k === "MUL" ? "mult" : null;
                if (z) return { el: hn, build: () => zoneTip(L().s, L().d, z) };
                if (k === "AP") return { el: hn, build: () => ({ color: "#ff2d8a", kicker: "HUD // ASCENSION", title: `${L().s.ap} AP`, rows: [["Global boost", `×${fmt(apGlobal(L().s))}`], ["Lifetime AP", fmt(L().s.life.apTotal ?? 0)], ["Ascends", String(L().s.life.ascends)]], status: "Spend it in the prestige tree.", tone: "ok" }) };
                return null;
            }
            const ro = t.closest<HTMLElement>(".nf-readout > div");
            if (ro) {
                const k = ro.querySelector("dt")?.textContent ?? "";
                if (k.startsWith("Global")) return { el: ro, build: () => globalTip(L().s, L().d) };
                if (k.startsWith("Bytes")) return { el: ro, build: () => bytesTip(L().s, L().d) };
                return null;
            }
            const rn = t.closest<HTMLElement>(".nf-row[data-stat] .nf-row-n");
            if (rn) { const z = zoneOf(rn)!; if (STATS.some((x) => x.id === z)) return { el: rn, build: () => zoneTip(L().s, L().d, z) }; }
            const sp = t.closest<HTMLElement>(".nf-row[data-stat] .nf-spec > div");
            if (sp) {
                const z = zoneOf(sp)!;
                if (!STATS.some((x) => x.id === z)) return null;
                return { el: sp, build: () => specTip(L().s, z, sp.querySelector("dt")?.textContent ?? "", sp.querySelector("dd")?.textContent ?? "") };
            }
            const li = t.closest<HTMLElement>(".nf-chain li[data-open]");
            if (li) {
                const z = chainStat(li);
                if (z) return { el: li, build: () => { const t = zoneTip(L().s, L().d, z); return { ...t, kicker: `CHAIN // ZONE ${zoneNo(z)}`, status: "Tap to jump to this zone." }; } };
            }
            return null;
        };
        let hovered: HTMLElement | null = null;
        const over = (e: PointerEvent) => {
            if (isTouch(e)) return;
            const f = figure(e.target as Element);
            if (!f) { if (hovered) { tip.hide(hovered); hovered = null; } return; }
            if (f.el === hovered) return;
            hovered = f.el;
            f.el.removeAttribute("title"); // the native tooltip would double up
            tip.show(f.el, f.build);
        };
        const leave = (e: PointerEvent) => {
            if (!hovered || isTouch(e)) return;
            const to = e.relatedTarget as Node | null;
            if (to && hovered.contains(to)) return;
            if (to && to instanceof Element && figure(to)?.el === hovered) return;
            tip.hide(hovered);
            hovered = null;
        };
        // last pointer type, so a click knows if it came from touch
        let lastType = "mouse";
        const down = (e: PointerEvent) => { lastType = e.pointerType; };
        const click = (e: MouseEvent) => {
            if (Date.now() - swallow.current < 450) { e.preventDefault(); e.stopPropagation(); swallow.current = 0; return; }
            const t = e.target as Element;
            if (t.closest("button, a, input, select, textarea, [role='button']")) return;
            // links: a chain stop or a "Feeds ..." line jumps to that zone
            const li = t.closest<HTMLElement>(".nf-chain li[data-open]");
            const sp = t.closest<HTMLElement>(".nf-row[data-stat] .nf-spec > div");
            const to = li ? chainStat(li) : sp ? fedStat(sp.querySelector("dt")?.textContent ?? "") : undefined;
            if (to && isUnlocked(live.current.s, to)) {
                live.current.onGo({ stat: to as Target["stat"] });
                const row = () => document.querySelector(`.nf [data-stat="${to}"]`);
                setTimeout(() => { const r = row(); r?.setAttribute("data-pk-ping", ""); setTimeout(() => r?.removeAttribute("data-pk-ping"), 900); }, 120);
                tip.hide();
                return;
            }
            if (lastType === "mouse") return;
            const f = figure(t);
            if (!f) return;
            tip.show(f.el, f.build, { ms: 2600 });
            // a tap on an open zone's number reads it; the header's blank-space fold would otherwise close the panel
            if (f.el.matches(".nf-row[data-open='true'] .nf-row-n")) e.stopPropagation();
        };
        // quick menu: right-click, or hold a finger still on a zone panel for 520 ms
        const openMenu = (z: StatId, x: number, y: number) => {
            setMenu({ z, x, y });
            sfx("tab");
            tip.hide();
        };
        const ctx = (e: MouseEvent) => {
            const row = (e.target as Element).closest<HTMLElement>(".nf-row[data-stat]");
            const z = row?.dataset.stat as StatId | undefined;
            if (!row || !z || !STATS.some((x) => x.id === z) || row.classList.contains("nf-locked")) return;
            if ((e.target as Element).closest("input, textarea")) return;
            e.preventDefault();
            if (Date.now() - swallow.current < 700) return; // the long-press already opened it
            openMenu(z, e.clientX, e.clientY);
        };
        let hold: ReturnType<typeof setTimeout> | null = null;
        let start = { x: 0, y: 0 };
        const cancel = () => { if (hold) clearTimeout(hold); hold = null; };
        const tdown = (e: PointerEvent) => {
            if (!isTouch(e)) return;
            const t = e.target as Element;
            const row = t.closest<HTMLElement>(".nf-row[data-stat]");
            const z = row?.dataset.stat as StatId | undefined;
            if (!row || !z || !STATS.some((x) => x.id === z) || row.classList.contains("nf-locked") || t.closest(".nf-btn, button, input")) return;
            start = { x: e.clientX, y: e.clientY };
            cancel();
            hold = setTimeout(() => {
                hold = null;
                swallow.current = Date.now();
                navigator.vibrate?.(8);
                openMenu(z, start.x, start.y);
            }, 520);
        };
        const tmove = (e: PointerEvent) => { if (hold && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) cancel(); };
        host.addEventListener("pointerover", over);
        host.addEventListener("pointerout", leave);
        host.addEventListener("pointerdown", down, true);
        host.addEventListener("pointerdown", tdown);
        host.addEventListener("pointermove", tmove, { passive: true });
        host.addEventListener("pointerup", cancel);
        host.addEventListener("pointercancel", cancel);
        host.addEventListener("click", click, true);
        host.addEventListener("contextmenu", ctx);
        window.addEventListener("scroll", cancel, { passive: true });
        return () => {
            cancel();
            host.removeEventListener("pointerover", over);
            host.removeEventListener("pointerout", leave);
            host.removeEventListener("pointerdown", down, true);
            host.removeEventListener("pointerdown", tdown);
            host.removeEventListener("pointermove", tmove);
            host.removeEventListener("pointerup", cancel);
            host.removeEventListener("pointercancel", cancel);
            host.removeEventListener("click", click, true);
            host.removeEventListener("contextmenu", ctx);
            window.removeEventListener("scroll", cancel);
        };
    }, [root, tip]);

    // close the menu on Escape, a tap elsewhere or a scroll; focus its first item
    useEffect(() => {
        if (!menu) return;
        menuRef.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
        const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setMenu(null); } };
        const away = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(null); };
        const y0 = window.scrollY;
        const scroll = () => { if (Math.abs(window.scrollY - y0) > 24) setMenu(null); }; // a scroll still settling from before must not close it
        window.addEventListener("keydown", key, true);
        window.addEventListener("pointerdown", away, true);
        window.addEventListener("scroll", scroll, { passive: true });
        return () => { window.removeEventListener("keydown", key, true); window.removeEventListener("pointerdown", away, true); window.removeEventListener("scroll", scroll); };
    }, [menu]);

    const scan = (z: StatId) => {
        coreFeed.current.lastPulse = performance.now();
        coreFeed.current.pulseStat = STATS.findIndex((x) => x.id === z); // the core answers in the scanned zone's colour
        const r = zoneRate(s, z);
        const row = document.querySelector(`.nf [data-stat="${z}"]`);
        row?.setAttribute("data-pk-ping", "");
        setTimeout(() => row?.removeAttribute("data-pk-ping"), 900);
        sfx("tab");
        feed.push([
            ...call(idTok("scan", statDef(z).color), "zone", [num(zoneNo(z))]),
            pun(" → "),
            strTok(zoneName(z).toLowerCase()),
            pun(", "),
            num(fmt(s[z] as number)),
            pun(" held, "),
            num(`+${fmt(r.rate)}/s`),
            ...(hasZoneArt(z) ? [pun(", stage "), num(`${shownStage(s, z)}/7`)] : []),
        ]);
    };

    // ---- the quick menu
    let menuEl: React.ReactNode = null;
    if (menu && typeof document !== "undefined") {
        const z = menu.z;
        const n = neighbours(z);
        const canArm = z !== "bytes" && z !== "reboot" && !!s.auto?.own.includes("buy");
        const items: { k: string; label: string; act: () => void }[] = [{ k: "scan", label: "Scan zone", act: () => scan(z) }];
        if (canArm) items.push({ k: "arm", label: s.auto?.buy[z] ? "Stop buy.sh here" : "Let buy.sh buy here", act: () => onArm(z) });
        if (n.fedBy && isUnlocked(s, n.fedBy)) items.push({ k: "up", label: `Feeder: ${zoneName(n.fedBy)}`, act: () => onGo({ stat: n.fedBy as Target["stat"] }) });
        if (n.feeds) items.push({ k: "down", label: `Feeds: ${zoneName(n.feeds)}`, act: () => onGo({ stat: n.feeds as Target["stat"] }) });
        if (isUnlocked(s, "aether")) items.push({ k: "bay", label: "Open the Drone bay", act: () => onGo({ drone: 0 }) });
        const vw = window.innerWidth, vh = window.innerHeight;
        const x = Math.max(8, Math.min(menu.x, vw - 268));
        const y = Math.max(8, Math.min(menu.y, vh - (items.length * 40 + 44)));
        menuEl = createPortal(
            <div className="ctos nf-pk-mhost">
                <div ref={menuRef} className="nf-pk-menu" role="menu" aria-label={`${zoneName(z)} actions`} style={{ left: x, top: y, ["--c" as string]: statDef(z).color } as CSSProperties}>
                    <span className="nf-pk-mh">ZONE {zoneNo(z)} // {zoneName(z).toUpperCase()}</span>
                    {items.map((it) => (
                        <button key={it.k} type="button" role="menuitem" onClick={() => { setMenu(null); it.act(); }}>
                            <span aria-hidden="true">&gt;</span>{it.label}
                        </button>
                    ))}
                </div>
            </div>,
            document.body,
        );
    }

    return <>{menuEl}</>;
}
