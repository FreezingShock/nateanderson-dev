"use client";

// The touch layer: what on the board answers a tap (rules in lib/nodefarm/poke.ts).
// - Caches waiting in zone art (portaled into their zone panel), a tap opens one.
// - The core vent: a button over the reactor core with a charge gauge; a tap when full pays a lump, earlier it pulses and
//   shows the readout.
// - Exact-number tips on every figure (HUD, core readout, zone numbers, spec lines, signal chain) through the shared tip
//   layer, found by delegation so the panels themselves need no change. Hover on desktop, a tap on touch.
// - Links: a signal chain stop or a "Feeds ..." spec line jumps to that zone.
// - Zone quick menu: right-click or long-press a zone panel: scan it, open its cache, arm Drones, jump to its neighbours.
// Nothing here runs per frame: the gauge redraws with the game's own 10 Hz render, the rest waits for input.

import { useContext, useEffect, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import { createPortal } from "react-dom";
import "@/app/camino/nodefarm-poke.css";
import { nfx } from "@/lib/nodefarm/sound";
import type { SfxName } from "@/lib/sound/sounds";

// scans, caches and the core vent play in the "world" mix
const sfx = (n: SfxName, a?: unknown) => nfx(n, a, "world");
import { STATS, apGlobal, derive, fmt, fmtTime, isUnlocked, overclockMult, singularityAll, sunstoneAll, statDef, MATS, TUNE, type State, type StatId, type MatId } from "@/lib/nodefarm/engine";
import { exact, type Target, type TipInfo } from "@/lib/nodefarm/guide";
import { LORE } from "@/lib/nodefarm/lore";
import { call, id as idTok, num, p as pun, str as strTok, type FeedStore } from "@/lib/nodefarm/feed";
import { shownStage, hasZoneArt } from "@/lib/nodefarm/zone-art";
import { POKE_TUNE, cachePay, lumpText, neighbours, openCache, poke, vent, ventFrac, ventPay, ventReady, zoneRate, dropCache } from "@/lib/nodefarm/poke";
import type { CoreFeed } from "./core";
import { ARCS, arcOf } from "@/lib/nodefarm/arcs";
import { TipCtx } from "./guide";

type D = ReturnType<typeof derive>;
const zoneNo = (z: StatId) => String(STATS.findIndex((x) => x.id === z) + 1).padStart(2, "0");
const zoneName = (z: StatId) => LORE[z]?.zone ?? statDef(z).name;
const isTouch = (e: { pointerType?: string }) => e.pointerType === "touch" || e.pointerType === "pen";

// ---- the cache sprite: a 12 x 12 data crate in the zone's colour. 0 empty, 1 dark edge, 2 colour, 3 light, 4 white glint
const CRATE = [
    "000111111000",
    "001222222100",
    "012233332210",
    "122344443221",
    "122333333221",
    "111111111111",
    "122222222221",
    "123212212321",
    "122222222221",
    "123212212321",
    "122222222221",
    "011111111110",
];
const FILL = ["", "var(--pk-d)", "var(--pk-c)", "var(--pk-l)", "#fff"];
function Crate() {
    const rects: React.ReactNode[] = [];
    CRATE.forEach((row, y) => {
        for (let x = 0; x < 12; x++) {
            const v = +row[x];
            if (v) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={FILL[v]} data-g={v === 4 ? "" : undefined} />);
        }
    });
    return <svg className="nf-pk-crate" viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true">{rects}</svg>;
}

/** A floating "+1.2K Cu" over an element: a plain DOM node in a fixed layer on <body>, removed when it ends. */
function popAt(el: Element | null, text: string, color: string, reduced: boolean) {
    if (!el || typeof document === "undefined") return;
    const r = el.getBoundingClientRect();
    let host = document.querySelector<HTMLElement>("body > .nf-pk-pops");
    if (!host) {
        host = document.createElement("div");
        host.className = "ctos nf-pk-pops";
        host.setAttribute("aria-hidden", "true");
        document.body.appendChild(host);
    }
    const n = document.createElement("span");
    n.className = "nf-pk-pop";
    n.textContent = text;
    n.style.left = `${Math.round(r.left + r.width / 2)}px`;
    n.style.top = `${Math.round(r.top + r.height * 0.35)}px`;
    n.style.setProperty("--c", color);
    host.appendChild(n);
    setTimeout(() => n.remove(), reduced ? 1400 : 1500);
}

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
    const c = poke(s).c.find((x) => x.z === z);
    return {
        color: def.color,
        kicker: `ZONE ${zoneNo(z)} // EXACT`,
        title: def.name,
        rows,
        note: n.feeds ? `Feeds ${statDef(n.feeds).name}.` : undefined,
        status: c ? "A cache is waiting in this zone." : hasZoneArt(z) ? `Scene stage ${shownStage(s, z)} of 7. Right-click or hold for more.` : "Right-click or hold for more.",
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
    const goals = 1 + s.ach.length * TUNE.achBonus;
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
function ventTip(s: State): TipInfo {
    const f = ventFrac(s);
    const left = POKE_TUNE.ventCharge - poke(s).vent;
    const pay = ventPay(s);
    return {
        color: f >= 1 ? "#ff2d8a" : "#2fd8e8",
        kicker: "REACTOR // VENT",
        title: f >= 1 ? "Vent ready" : `Vent ${Math.floor(f * 100)}%`,
        note: `A full vent pays ${POKE_TUNE.ventSecs} s of every output at once. It waits for you once it is full.`,
        rows: [["Charge", `${Math.floor(f * 100)}%`], ["Full in", f >= 1 ? "now" : fmtTime(left)], ["Pays now", lumpText(pay)], ["Vents", String(poke(s).vents)]],
        status: f >= 1 ? "Tap the core to vent." : "Charges while you play.",
        tone: f >= 1 ? "ok" : "wait",
    };
}
function cacheTip(s: State, z: StatId): TipInfo {
    const pay = cachePay(s, z);
    return {
        color: statDef(z).color,
        kicker: `ZONE ${zoneNo(z)} // CACHE`,
        title: `+${fmt(pay.amount)} ${statDef(pay.stat).name}`,
        note: `${POKE_TUNE.cacheSecs} s of this zone's output. It waits here until you open it.`,
        rows: [["Waiting", `${poke(s).c.length} of ${POKE_TUNE.cacheMax}`], ["Opened", String(poke(s).got)]],
        status: "Tap to open.",
        tone: "ok",
    };
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
    const [, rerender] = useState(0);
    // latest props for the delegated listeners, which are bound once
    const live = useRef({ s, d, onGo, onChange, reduced });
    live.current = { s, d, onGo, onChange, reduced };
    const swallow = useRef(0);
    const menuRef = useRef<HTMLDivElement>(null);
    const p = poke(s);

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
                return { el: ro, build: () => ventTip(L().s) };
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

    // admin and tests: drop a cache or fill the vent now
    useEffect(() => {
        const on = (e: Event) => {
            const k = (e as CustomEvent).detail as string | undefined;
            const st = live.current.s;
            if (k === "vent") poke(st).vent = POKE_TUNE.ventCharge;
            else dropCache(st, Math.random, k && STATS.some((x) => x.id === k) ? (k as StatId) : undefined);
            live.current.onChange();
        };
        window.addEventListener("nf:poke", on);
        return () => window.removeEventListener("nf:poke", on);
    }, []);

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

    const doOpen = (id: number, el: Element | null) => {
        const got = openCache(s, id);
        if (!got) return nfx("deny");
        sfx("nfCache");
        popAt(el, `+${fmt(got.amount)} ${statDef(got.stat).short}`, statDef(got.zone).color, reduced);
        feed.push([...call(idTok("cache", statDef(got.zone).color), "open", [strTok(zoneName(got.zone).toLowerCase())]), pun(" → "), num(`+${fmt(got.amount)}`), pun(" "), idTok(statDef(got.stat).short, statDef(got.stat).color)], { tone: "good" });
        tip.hide();
        onChange();
    };
    const doVent = (el: HTMLElement) => {
        coreFeed.current.lastPulse = performance.now();
        if (!ventReady(s)) {
            sfx("tab");
            tip.show(el, () => ventTip(live.current.s), { ms: 2600 });
            return;
        }
        const got = vent(s);
        if (!got) return;
        coreFeed.current.flareAt = performance.now(); // the core's big flash and shockwave
        sfx("nfVent");
        navigator.vibrate?.(12);
        popAt(el, lumpText(got), "#ff2d8a", reduced);
        feed.push([...call(idTok("core"), "vent"), pun(" → "), num(lumpText(got))], { tone: "good", type: true });
        tip.hide();
        onChange();
    };
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

    // ---- caches: one button per waiting cache, portaled into its zone panel. Placed with the art box's own inline sizes
    // (no layout read): --t/--b are its top and floor, --s the art scale, so x runs along the visible scene.
    // caches whose zone sits in a folded arc show as a count on that arc's header (it opens the arc on a tap, like the rest of it)
    const hidden: Record<string, number> = {};
    const caches = typeof document === "undefined" ? [] : p.c.map((c) => {
        const row = document.querySelector<HTMLElement>(`.nf .nf-row[data-stat="${c.z}"]:not(.nf-locked)`);
        if (!row) {
            const a = arcOf(c.z);
            if (a) hidden[a.id] = (hidden[a.id] ?? 0) + 1;
            return null;
        }
        // a folded panel shows no scene: the crate sits in its title bar instead
        const bar = row.dataset.open === "false" ? row.querySelector<HTMLElement>(":scope > .nf-bar-t") : null;
        const art = row.querySelector<HTMLElement>(":scope > .nf-art");
        const g = (k: string) => parseFloat(art?.style.getPropertyValue(k) ?? "") || 0;
        const sc = g("--s") || 2;
        const t = g("--t"), b = g("--b");
        const top = b > t ? t + (b - t) * 0.42 : 44;
        const def = statDef(c.z);
        const style = { "--c": def.color, "--pkt": `${Math.round(top)}px`, "--pkr": `${Math.round(24 + c.x * 200 * sc)}px` } as CSSProperties;
        return createPortal(
            <button
                key={c.id}
                type="button"
                className="nf-pk-cache"
                style={style}
                aria-label={`Open cache in ${zoneName(c.z)}`}
                onClick={(e) => { e.stopPropagation(); doOpen(c.id, e.currentTarget); }}
                onPointerEnter={(e) => { if (!isTouch(e)) tip.show(e.currentTarget, () => cacheTip(live.current.s, c.z)); }}
                onPointerLeave={(e) => { if (!isTouch(e)) tip.hide(e.currentTarget); }}
                onFocus={(e) => tip.show(e.currentTarget, () => cacheTip(live.current.s, c.z))}
                onBlur={(e) => tip.hide(e.currentTarget)}
            >
                <Crate />
                <span className="nf-pk-tag">CACHE</span>
            </button>,
            bar ?? row,
            `pk-${c.id}`,
        );
    });

    const arcBadges = typeof document === "undefined" ? [] : Object.entries(hidden).map(([id, n]) => {
        const no = ARCS.findIndex((a) => a.id === id) + 1;
        const head = [...document.querySelectorAll<HTMLElement>(".nf .nf-arc")].find((h) => h.querySelector(".nf-arc-k")?.textContent?.startsWith(`ARC ${String(no).padStart(2, "0")} `));
        if (!head) return null;
        return createPortal(
            <span className="nf-pk-arcb" aria-hidden="true"><Crate />{n > 1 ? `${n} CACHES` : "CACHE"}</span>,
            head,
            `pk-arc-${id}`,
        );
    });

    // ---- the vent: a button over the core with a charge gauge
    const coreEl = typeof document === "undefined" ? null : root.current?.querySelector<HTMLElement>(".nf-core") ?? null;
    const f = ventFrac(s);
    const ready = f >= 1;
    const segs = 10;
    const ventBtn = coreEl
        ? createPortal(
            <button
                type="button"
                className="nf-pk-core"
                data-ready={ready ? "" : undefined}
                aria-label={ready ? "Vent the core" : `Core vent ${Math.floor(f * 100)} percent charged`}
                onClick={(e) => doVent(e.currentTarget)}
                onPointerEnter={(e) => { if (!isTouch(e)) tip.show(e.currentTarget, () => ventTip(live.current.s)); }}
                onPointerLeave={(e) => { if (!isTouch(e)) tip.hide(e.currentTarget); }}
                onFocus={(e) => tip.show(e.currentTarget, () => ventTip(live.current.s))}
                onBlur={(e) => tip.hide(e.currentTarget)}
            >
                <span className="nf-pk-gauge" aria-hidden="true">
                    <b>{ready ? "VENT READY" : "VENT"}</b>
                    <span className="nf-pk-segs">
                        {Array.from({ length: segs }, (_, i) => <i key={i} data-on={f * segs > i ? "" : undefined} />)}
                    </span>
                </span>
                <span className="nf-pk-brk" aria-hidden="true" />
            </button>,
            coreEl,
            "pk-core",
        )
        : null;
    // the core element appears after the first render; render once more so the vent finds it
    useEffect(() => { if (!coreEl && root.current?.querySelector(".nf-core")) rerender((n) => n + 1); }, [coreEl, root]);

    // ---- the quick menu
    let menuEl: React.ReactNode = null;
    if (menu && typeof document !== "undefined") {
        const z = menu.z;
        const n = neighbours(z);
        const c = p.c.find((x) => x.z === z);
        const canArm = z !== "bytes" && z !== "reboot" && s.drones.some((x) => x > 0);
        const items: { k: string; label: string; act: () => void }[] = [{ k: "scan", label: "Scan zone", act: () => scan(z) }];
        if (c) items.push({ k: "cache", label: `Open cache +${fmt(cachePay(s, z).amount)} ${statDef(cachePay(s, z).stat).short}`, act: () => doOpen(c.id, document.querySelector(`.nf [data-stat="${z}"] .nf-pk-cache`)) });
        if (canArm) items.push({ k: "arm", label: s.armed.includes(z) ? "Disarm Drones here" : "Arm Drones here", act: () => onArm(z) });
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

    return <>{caches}{arcBadges}{ventBtn}{menuEl}</>;
}
