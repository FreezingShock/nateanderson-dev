"use client";

import "@/app/camino/nodefarm/juice.css";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { codeReveal } from "@/lib/nodefarm/cx";
import { createPortal } from "react-dom";
import { TUNE, STATS, fmt, isUnlocked, statDef, type ButtonStat, type State, type StatId } from "@/lib/nodefarm/engine";
import { LORE } from "@/lib/nodefarm/content/lore";
import { ascendNote } from "@/lib/nodefarm/content/story";
import { Core, freshCoreFeed, type CoreFeed } from "../zones/core";
import { coreLook } from "@/lib/nodefarm/art/core-look";
import { PART } from "@/lib/nodefarm/art/core-parts";
import type { NfLive } from "@/lib/nodefarm/records";
import { NfIcon, type NfIconName } from "./icon";

// Game feel for Node Farm: number pop-ups on presses, banners when a stat decrypts / a button tier opens / a milestone is
// reached, and the full-screen Ascend sequence built around the reactor core. The game talks to this file through `juice.emit`
// and `checkMilestones`, so none of it touches the engine or the save. Everything is drawn into portal layers on <body>
// (outside `.nf`, so the board's layout never moves) with transform/opacity animations only.
//
// Rules this file keeps: pop-ups are plain DOM nodes, never React state (a press must not re-render anything), capped at 14
// alive at once, and held-button repeats are merged into one pop every 300 ms. Banners queue and never stack. Under
// prefers-reduced-motion there are no pop-ups, no scramble, no flash and no count-up; banners and the Ascend card just appear.

export type JuiceEvent =
    | { t: "press"; stat: ButtonStat; tier: number; gain: number; quiet: boolean }
    | { t: "tier"; stat: ButtonStat; tier: number }
    | { t: "unlock"; id: StatId }
    | { t: "milestone"; title: string; sub: string }
    | { t: "ascend"; gain: number; ap: number; n: number; each?: number };

const subs = new Set<(e: JuiceEvent) => void>();
export const juice = { emit: (e: JuiceEvent) => subs.forEach((f) => f(e)) };
/** listen to game-feel events from outside the Juice layer (the reactor core flares on them); returns the unsubscribe */
export const onJuice = (f: (e: JuiceEvent) => void) => {
    subs.add(f);
    return () => void subs.delete(f);
};

// ---- milestones: thresholds on things already in the game state. Seen ones are remembered per device (not in the save).
const SEEN_KEY = "nf-juice-v1";
const BPS = [1e2, 1e3, 1e4, 1e6, 1e9, 1e12, 1e15, 1e18, 1e24, 1e30];
const PRESSES = [100, 1e3, 1e4, 1e5];
const REBOOTS = [1, 10, 100, 1e3];
const ASCENDS = [1, 3, 10];
const MS: { id: string; title: string; test: (s: State, bps: number) => boolean }[] = [
    ...BPS.map((v) => ({ id: `bps${v}`, title: `${fmt(v)} Bytes per second`, test: (_: State, bps: number) => bps >= v })),
    ...PRESSES.map((v) => ({ id: `pr${v}`, title: `${fmt(v)} buttons pressed`, test: (s: State) => s.life.presses >= v })),
    ...REBOOTS.map((v) => ({ id: `rb${v}`, title: v === 1 ? "First Reboot" : `${fmt(v)} Reboots`, test: (s: State) => s.life.reboots >= v })),
    ...ASCENDS.map((v) => ({ id: `as${v}`, title: v === 1 ? "First Ascension" : `${v} Ascensions`, test: (s: State) => s.life.ascends >= v })),
];
let seen: Set<string> | null = null;
function loadSeen() {
    if (seen) return seen;
    seen = new Set();
    try {
        const raw = localStorage.getItem(SEEN_KEY);
        if (raw) for (const x of JSON.parse(raw) as string[]) seen.add(x);
        else seen.add("__new");
    } catch {}
    return seen;
}
function saveSeen() {
    try {
        if (seen) localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
    } catch {}
}
/** Call a couple of times a second. The first call on a device only records what is already done, so a returning
 *  player is not greeted with a pile of old milestones. */
export function checkMilestones(s: State, bps: number) {
    const sn = loadSeen();
    const silent = sn.has("__new");
    if (silent) sn.delete("__new");
    let dirty = silent;
    for (const x of STATS) if (isUnlocked(s, x.id) && !sn.has(`u:${x.id}`)) { if (silent) { sn.add(`u:${x.id}`); dirty = true; } }
    for (const m of MS) {
        if (sn.has(m.id) || !m.test(s, bps)) continue;
        sn.add(m.id);
        dirty = true;
        if (!silent) juice.emit({ t: "milestone", title: m.title, sub: "Logged to Records." });
    }
    if (dirty) saveSeen();
}

/** Haptics, only after the player has touched the page (browsers refuse and log an error otherwise). */
const buzz = (p: number | number[]) => {
    try {
        if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(p);
    } catch {}
};
const calm = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A new button tier lights up on the board: a bright flash and a ring that opens and fades, in the stat's colour.
 *  Transform-free and short; skipped in low effects (box-shadow is paint-heavy) and under reduced motion. */
function tierRing(stat: ButtonStat, tier: number) {
    if (typeof document === "undefined" || document.body.classList.contains("nf-lowfx")) return;
    const b = document.querySelector<HTMLElement>(`.nf-row[data-stat="${stat}"] .nf-btn[data-tier="${tier}"]`);
    if (!b) return;
    const c = statDef(stat).color;
    try {
        b.getAnimations().filter((x) => (x as Animation & { id?: string }).id === "nf-tier").forEach((x) => x.cancel());
        b.animate(
            [
                { boxShadow: `0 0 0 0px ${c}, 0 0 0px 0px ${c}`, filter: "brightness(2)" },
                { boxShadow: `0 0 0 3px ${c}, 0 0 24px 6px ${c}`, filter: "brightness(1.3)", offset: 0.3 },
                { boxShadow: `0 0 0 16px ${c}00, 0 0 0px 0px ${c}00`, filter: "none" },
            ],
            { duration: 640, easing: "cubic-bezier(.2,.7,.3,1)", id: "nf-tier" },
        );
    } catch {}
}

// ---- pop-ups
const MAX_POPS = 14;
function popAt(layer: HTMLElement, rect: DOMRect, text: string, color: string, o: { big?: boolean; sparks?: number }) {
    while (layer.childElementCount >= MAX_POPS) layer.firstElementChild?.remove();
    const el = document.createElement("div");
    el.className = o.big ? "nf-pop big" : "nf-pop";
    el.style.cssText = `left:${rect.left + rect.width / 2 + (Math.random() * 30 - 15)}px;top:${rect.top + rect.height * 0.3}px;--c:${color}`;
    el.textContent = text;
    for (let i = 0; i < (o.sparks ?? 0); i++) {
        const p = document.createElement("i");
        const a = (i / (o.sparks ?? 1)) * Math.PI * 2 + Math.random() * 0.6;
        const r = 16 + Math.random() * 22;
        p.style.cssText = `--dx:${Math.round(Math.cos(a) * r)}px;--dy:${Math.round(Math.sin(a) * r - 6)}px`;
        el.appendChild(p);
    }
    el.addEventListener("animationend", (e) => { if (e.target === el) el.remove(); });
    layer.appendChild(el);
}

// ---- banners
type Banner = { key: number; kind: "unlock" | "tier" | "milestone"; label: string; title: string; sub: string; icon: NfIconName; color: string; pips?: number; ms: number; first: boolean };
let bk = 1;

/** Text that decrypts in from noise, left to right, then settles. Always ends on the real text. */
function Scr({ text, on }: { text: string; on: boolean }) {
    const [out, setOut] = useState(text);
    useEffect(() => {
        if (!on) { setOut(text); return; }
        const glyphs = "#%&*+=<>/\\01";
        let f = 0;
        const frames = 14;
        const iv = setInterval(() => {
            f++;
            if (f >= frames) { clearInterval(iv); setOut(text); return; }
            const keep = Math.floor((f / frames) * text.length);
            setOut(text.split("").map((c, i) => (i < keep || c === " " ? c : glyphs[Math.floor(Math.random() * glyphs.length)])).join(""));
        }, 38);
        const done = setTimeout(() => setOut(text), frames * 38 + 60);
        return () => { clearInterval(iv); clearTimeout(done); setOut(text); };
    }, [text, on]);
    return <>{out}</>;
}

export function Juice({ reduced }: { reduced: boolean }) {
    const [host, setHost] = useState<HTMLElement | null>(null);
    const layer = useRef<HTMLDivElement>(null);
    const [cur, setCur] = useState<(Banner & { out?: boolean }) | null>(null);
    const [asc, setAsc] = useState<{ gain: number; ap: number; n: number; each?: number } | null>(null);
    const queue = useRef<Banner[]>([]);
    const showing = useRef(false);
    const holding = useRef(false);
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
    const seenU = useRef<Set<string>>(new Set());
    const lastBtn = useRef<HTMLElement | null>(null);
    const acc = useRef<{ sum: number; stat: ButtonStat; el: HTMLElement | null; timer: ReturnType<typeof setTimeout> | null }>({ sum: 0, stat: "mult", el: null, timer: null });
    useEffect(() => setHost(document.body), []);

    const later = useCallback((fn: () => void, ms: number) => {
        const t = setTimeout(fn, ms);
        timers.current.push(t);
    }, []);

    const next = useCallback(() => {
        if (holding.current) { showing.current = false; return; }
        // a window or the tree is open: the page (and the window with it) sits under a banner portaled to <body>, so hold banners until it closes
        if (queue.current.length && document.body.classList.contains("nf-win-open")) { showing.current = true; later(next, 350); return; }
        const b = queue.current.shift();
        if (!b) { showing.current = false; setCur(null); return; }
        showing.current = true;
        setCur(b);
        later(() => setCur((c) => (c && c.key === b.key ? { ...c, out: true } : c)), b.ms - 220);
        later(() => { setCur(null); later(next, 90); }, b.ms);
    }, [later]);

    const push = useCallback((b: Banner) => {
        const q = queue.current;
        if (b.kind === "unlock") q.unshift(b); // an unlock jumps ahead of tier-ups and milestones
        else q.push(b);
        while (q.length > 4) { const i = q.findIndex((x) => x.kind === "tier"); q.splice(i < 0 ? q.length - 1 : i, 1); }
        if (!showing.current) next();
    }, [next]);

    // which button was last touched: the pop-up appears over it
    useEffect(() => {
        const down = (e: PointerEvent) => {
            const b = (e.target as Element | null)?.closest?.(".nf-btn");
            if (b) lastBtn.current = b as HTMLElement;
        };
        document.addEventListener("pointerdown", down, true);
        return () => document.removeEventListener("pointerdown", down, true);
    }, []);

    useEffect(() => {
        const rm = calm() || reduced;
        const flush = () => {
            const a = acc.current;
            a.timer = null;
            const el = a.el;
            if (!layer.current || !el || !el.isConnected || a.sum <= 0) { a.sum = 0; return; }
            popAt(layer.current, el.getBoundingClientRect(), `+${fmt(a.sum)}`, statDef(a.stat).color, {});
            a.sum = 0;
        };
        const on = (e: JuiceEvent) => {
            if (e.t === "press") {
                if (rm || !layer.current) return;
                const el = lastBtn.current?.isConnected ? lastBtn.current : (document.activeElement as HTMLElement | null)?.closest?.(".nf-btn") as HTMLElement | null;
                if (!el) return;
                const color = statDef(e.stat).color;
                try {
                    el.getAnimations().filter((x) => (x as Animation & { id?: string }).id === "nf-hit").forEach((x) => x.cancel());
                    el.animate([{ filter: "brightness(1.7) saturate(1.3)" }, { filter: "none" }], { duration: 150, easing: "steps(3)", id: "nf-hit" });
                } catch {}
                if (e.quiet) {
                    const a = acc.current;
                    a.sum += e.gain; a.stat = e.stat; a.el = el;
                    if (!a.timer) a.timer = setTimeout(flush, 300);
                    return;
                }
                if (e.stat === "reboot") popAt(layer.current, el.getBoundingClientRect(), `REBOOT +${fmt(e.gain)}`, color, { big: true, sparks: 8 });
                else popAt(layer.current, el.getBoundingClientRect(), `+${fmt(e.gain)}`, color, { big: e.tier >= 3, sparks: e.tier >= 3 ? 6 : 3 });
            } else if (e.t === "tier") {
                if (!rm) tierRing(e.stat, e.tier);
                const def = statDef(e.stat);
                push({ key: bk++, kind: "tier", label: "Tier online", title: LORE[e.stat].tiers[e.tier], sub: `${def.name} button ${e.tier + 1} of 6`, icon: e.stat as NfIconName, color: def.color, pips: e.tier + 1, ms: 1500, first: false });
            } else if (e.t === "unlock") {
                const def = statDef(e.id);
                const first = !seenU.current.has(e.id) && !loadSeen().has(`u:${e.id}`);
                seenU.current.add(e.id);
                loadSeen().add(`u:${e.id}`);
                saveSeen();
                push({ key: bk++, kind: "unlock", label: "Decrypted", title: `${def.name} // ${LORE[e.id].zone}`, sub: first ? def.role : LORE[e.id].code, icon: e.id as NfIconName, color: def.color, ms: first ? 2800 : 1500, first });
                if (!rm) {
                    buzz(first ? [14, 40, 22] : 10);
                    later(() => {
                        const row = document.querySelector<HTMLElement>(`.nf-row[data-stat="${e.id}"]`);
                        row?.animate([{ boxShadow: `0 0 0 2px ${def.color}, 0 0 28px ${def.color}88` }, { boxShadow: `0 0 0 0 ${def.color}00, 0 0 0 transparent` }], { duration: 1100, easing: "steps(8)" });
                    }, 80);
                }
            } else if (e.t === "milestone") {
                push({ key: bk++, kind: "milestone", label: "Milestone", title: e.title, sub: e.sub, icon: "spark", color: "#2fd8e8", ms: 2300, first: true });
            } else if (e.t === "ascend") {
                holding.current = true;
                queue.current = [];
                setCur(null);
                setAsc({ gain: e.gain, ap: e.ap, n: e.n, each: e.each });
                if (!rm) buzz([30, 50, 30, 50, 90]);
            }
        };
        subs.add(on);
        return () => { subs.delete(on); };
    }, [reduced, push, later]);

    useEffect(() => () => {
        timers.current.forEach(clearTimeout);
        if (acc.current.timer) clearTimeout(acc.current.timer);
    }, []);

    const closeAsc = useCallback(() => {
        setAsc(null);
        holding.current = false;
        later(next, 400);
    }, [later, next]);

    // banners print in and delete out with the shared code reveal (lib/nodefarm/cx.ts); the timing above is unchanged
    const jb = useRef<HTMLDivElement>(null);
    const curKey = cur?.key ?? 0;
    const curOut = !!cur?.out;
    const curKind = cur?.kind;
    useLayoutEffect(() => {
        if (!curKey) return;
        // The banner is a compact card centered on the board, docked on the game panel's title strip, sized to its text and never wider than the board. It steps down below the admin console when the two would touch.
        // Re-placed on scroll and resize while it shows. (Nate 2026-11-12: the full-width strip "spans way too far".)
        if (!curOut) placeBanner(jb.current);
        codeReveal(jb.current, { dir: curOut ? "out" : "in", style: curKind === "milestone" ? "print" : "decrypt", rows: ".nf-jb-ic, .nf-jb-t > *", sound: false, ms: curOut ? 220 : 420 });
    }, [curKey, curOut, curKind]);
    useEffect(() => {
        if (!curKey) return;
        let raf = 0;
        const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => placeBanner(jb.current)); };
        addEventListener("scroll", on, { passive: true, capture: true });
        addEventListener("resize", on);
        return () => { cancelAnimationFrame(raf); removeEventListener("scroll", on, { capture: true }); removeEventListener("resize", on); };
    }, [curKey]);

    if (!host) return null;
    return createPortal(
        <>
            <div ref={layer} className="nf-pops" aria-hidden="true" />
            {cur && (
                <div ref={jb} className="nf-jb" key={cur.key} data-kind={cur.kind} data-out={cur.out ? "" : undefined} data-first={cur.first ? "" : undefined} role="status" style={{ ["--c" as string]: cur.color, ["--ms" as string]: `${cur.ms}ms` }}>
                    <i className="nf-jb-br" aria-hidden="true" />
                    <span className="nf-jb-ic"><NfIcon name={cur.icon} large={cur.kind !== "tier"} /></span>
                    <div className="nf-jb-t">
                        <small>
                            {cur.label}
                            {cur.pips ? <span className="nf-pips" aria-hidden="true">{Array.from({ length: cur.pips }, (_, i) => <i key={i} />)}</span> : null}
                        </small>
                        <b><Scr text={cur.title} on={!reduced && !calm() && cur.first} /></b>
                        {cur.first && cur.kind === "unlock" ? <span>{cur.sub}</span> : null}
                    </div>
                    <i className="nf-jb-tm" aria-hidden="true" />
                </div>
            )}
            {asc && <AscendSeq data={asc} reduced={reduced || calm()} onClose={closeAsc} />}
        </>,
        host,
    );
}

/** Put the banner at the horizontal centre of the board, on the game panel's title strip (or under the site bar), and
 *  clear of the floating admin console. Writes --jb-x, --jb-y and --jb-max (app/camino/nodefarm/windows.css). */
function placeBanner(el: HTMLElement | null) {
    const board = document.querySelector<HTMLElement>(".ctos .nf") ?? document.querySelector<HTMLElement>(".nf");
    if (!el || !board) return;
    const b = board.getBoundingClientRect();
    const vw = innerWidth;
    const vh = innerHeight;
    const left = Math.max(8, b.left);
    const right = Math.min(vw - 8, b.right);
    el.style.setProperty("--jb-max", `${Math.max(240, Math.min(480, right - left - 24))}px`);
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const cx = Math.round(Math.min(Math.max((left + right) / 2, w / 2 + 8), vw - w / 2 - 8));
    const bar = document.querySelector(".nv-top")?.getBoundingClientRect().bottom ?? 56;
    // dock on the game panel's title strip ("naOS // node.farm ... ready") so the score under it stays readable; once that
    // strip has scrolled under the site bar, sit just below the bar
    const frame = board.closest(".g-frame") ?? board;
    const strip = frame.querySelector(".g-top")?.getBoundingClientRect();
    const fr = frame.getBoundingClientRect();
    const home = strip && strip.top >= bar + 4 ? strip.top : Math.max(bar + 10, fr.top);
    let y = home;
    const ad = document.querySelector(".nf-ad")?.getBoundingClientRect();
    const hits = (x: number, top: number) => !!ad && ad.width > 0 && ad.left < x + w / 2 + 10 && ad.right > x - w / 2 - 10 && ad.top < top + h + 10 && ad.bottom > top - 10;
    let x = cx;
    if (hits(x, y)) y = ad!.bottom + 12;
    const floor = Math.min(fr.bottom, vh) - h - 14;
    if (y > floor) {
        // no room under the console: go back to the top and slide sideways into the wider free side of the board
        y = home;
        if (hits(x, y)) {
            const roomL = ad!.left - left;
            const roomR = right - ad!.right;
            // the console sits above the banner anyway; only move aside when the banner fits beside it
            if (Math.max(roomL, roomR) >= w + 12) x = roomL >= roomR ? Math.max(left + w / 2, ad!.left - 12 - w / 2) : Math.min(right - w / 2, ad!.right + 12 + w / 2);
        }
    }
    const cxFinal = Math.round(Math.min(Math.max(x, w / 2 + 8), vw - w / 2 - 8));
    el.style.setProperty("--jb-x", `${cxFinal}px`);
    el.style.setProperty("--jb-y", `${Math.round(y)}px`);
}

// ---- the Ascend sequence: charge the core, flash, then the report. Click, Enter or Esc skips the charge, then closes.
function AscendSeq({ data, reduced, onClose }: { data: { gain: number; ap: number; n: number; each?: number }; reduced: boolean; onClose: () => void }) {
    // the player's own core (colours and structures); on the first Ascend its gyro ring builds in at the flash
    const look = useRef<ReturnType<typeof coreLook> | null>(null);
    if (!look.current) {
        const probe: { live?: NfLive } = {};
        window.dispatchEvent(new CustomEvent("nf:live", { detail: probe }));
        look.current = probe.live ? coreLook(probe.live.s) : { zone: 0, skin: 0, parts: PART.ring1, drones: 0, glyphs: 0, rigs: [], fw: 0, event: 0 };
    }
    const lk = look.current!;
    const feed = useRef<CoreFeed>({ ...freshCoreFeed(), progress: reduced ? 1 : 0, unlocked: STATS.length, speed: 0.25, reboots: 64, ap: reduced ? data.ap : Math.max(0, data.ap - data.gain), zone: lk.zone, skin: lk.skin, rigs: lk.rigs, fw: lk.fw, parts: reduced || data.n > 1 ? lk.parts : lk.parts & ~PART.ring1, drones: lk.drones, glyphs: lk.glyphs });
    const [phase, setPhase] = useState<"charge" | "show">(reduced ? "show" : "charge");
    const [canClose, setCanClose] = useState(reduced);
    const num = useRef<HTMLElement>(null);
    const t0 = useRef(0);
    const phaseRef = useRef(phase);
    phaseRef.current = phase;
    const ref = useRef<HTMLDivElement>(null);

    const reveal = useCallback(() => {
        const f = feed.current;
        f.progress = 1; f.overclock = false; f.speed = 1; f.ap = data.ap; f.lastPulse = performance.now(); f.parts = look.current?.parts ?? f.parts;
        setPhase("show");
    }, [data.ap]);

    useEffect(() => {
        ref.current?.focus();
        if (reduced) return;
        const start = performance.now();
        let raf = 0;
        let lastP = 0;
        const ramp = (now: number) => {
            if (phaseRef.current !== "charge") return;
            const p = Math.min(1, (now - start) / 1500);
            const f = feed.current;
            f.progress = p * p;
            f.speed = 0.25 + p * 0.75;
            f.overclock = p > 0.72 && Math.floor((now - start) / 90) % 2 === 0;
            if (now - lastP > 260 * (1.2 - p)) { f.lastPulse = now; lastP = now; }
            if (p >= 1) { reveal(); return; }
            raf = requestAnimationFrame(ramp);
        };
        raf = requestAnimationFrame(ramp);
        return () => cancelAnimationFrame(raf);
    }, [reduced, reveal]);

    useEffect(() => {
        if (phase !== "show") return;
        t0.current = performance.now();
        const to = [setTimeout(() => setCanClose(true), reduced ? 0 : 1300), setTimeout(onClose, 14000)];
        let raf = 0;
        if (!reduced && num.current) {
            const el = num.current;
            const tick = (now: number) => {
                const p = Math.min(1, Math.max(0, (now - t0.current - 500) / 1000));
                el.textContent = String(Math.round(data.gain * (1 - Math.pow(1 - p, 3))));
                if (p < 1) raf = requestAnimationFrame(tick);
            };
            el.textContent = "0";
            raf = requestAnimationFrame(tick);
        }
        return () => { to.forEach(clearTimeout); cancelAnimationFrame(raf); };
    }, [phase, reduced, data.gain, onClose]);

    const act = () => { if (phase === "charge") reveal(); else if (canClose) onClose(); };
    useEffect(() => {
        const key = (e: KeyboardEvent) => {
            if (e.key === "Escape" || e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); }
        };
        window.addEventListener("keydown", key, true);
        return () => window.removeEventListener("keydown", key, true);
    });

    return (
        <div ref={ref} tabIndex={-1} className="nf-rx" data-phase={phase} role="dialog" aria-modal="true" aria-label="Ascended" onClick={act}>
            <div className="nf-rx-bar">
                <span>naOS // node.farm // root access</span>
                <span>{phase === "charge" ? "CHARGING CORE" : "ACCESS GRANTED"}</span>
            </div>
            <div className="nf-rx-body">
                <div className="nf-rx-core" aria-hidden="true"><Core feed={feed} reduced={reduced} /></div>
                <div className="nf-rx-out" data-on={phase === "show" ? "" : undefined} aria-hidden={phase !== "show"}>
                    <p className="nf-rx-k">Ascension {data.n}</p>
                    <h2 className="nf-rx-h">Root access granted</h2>
                    <p className="nf-rx-gain"><b ref={num}>{data.gain}</b> <span>Ascension {data.gain === 1 ? "Point" : "Points"}</span></p>
                    <p className="nf-rx-line">{data.ap} AP total. Each one adds {Math.round((data.each ?? TUNE.apBonus) * 100)}% to everything.</p>
                    <p className="nf-rx-line nf-rx-note">{ascendNote(data.n)}</p>
                    <p className="nf-rx-line dim">Wiped: Bytes, Multipliers, Reboots, unmounted materials, Drones, Parts and Intel. Kept: goals, perks, the tree, lab research and stock, scripts, Keys, Firmware, the hangar's postings, rig levels and lifetime stats.</p>
                    <p className="nf-rx-go" data-ready={canClose ? "" : undefined}>{canClose ? "Tap to continue" : "\u00a0"}</p>
                </div>
            </div>
            {phase === "show" && !reduced && <div className="nf-rx-flash" aria-hidden="true" />}
        </div>
    );
}
