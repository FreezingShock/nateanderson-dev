"use client";

import "@/app/camino/nodefarm-juice.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TUNE, STATS, fmt, isUnlocked, statDef, type ButtonStat, type State, type StatId } from "@/lib/nodefarm/engine";
import { LORE } from "@/lib/nodefarm/lore";
import { ascendNote } from "@/lib/nodefarm/story";
import { Core, type CoreFeed } from "./core";
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

    if (!host) return null;
    return createPortal(
        <>
            <div ref={layer} className="nf-pops" aria-hidden="true" />
            {cur && (
                <div className="nf-jb" key={cur.key} data-kind={cur.kind} data-out={cur.out ? "" : undefined} data-first={cur.first ? "" : undefined} role="status" style={{ ["--c" as string]: cur.color, ["--ms" as string]: `${cur.ms}ms` }}>
                    <i className="nf-jb-br" aria-hidden="true" />
                    <span className="nf-jb-ic"><NfIcon name={cur.icon} large={cur.kind !== "tier"} /></span>
                    <div className="nf-jb-t">
                        <small>
                            {cur.label}
                            {cur.pips ? <span className="nf-pips" aria-hidden="true">{Array.from({ length: cur.pips }, (_, i) => <i key={i} />)}</span> : null}
                        </small>
                        <b><Scr text={cur.title} on={!reduced && !calm() && cur.first} /></b>
                        <span>{cur.sub}</span>
                    </div>
                </div>
            )}
            {asc && <AscendSeq data={asc} reduced={reduced || calm()} onClose={closeAsc} />}
        </>,
        host,
    );
}

// ---- the Ascend sequence: charge the core, flash, then the report. Click, Enter or Esc skips the charge, then closes.
function AscendSeq({ data, reduced, onClose }: { data: { gain: number; ap: number; n: number; each?: number }; reduced: boolean; onClose: () => void }) {
    const feed = useRef<CoreFeed>({ progress: reduced ? 1 : 0, overclock: false, unlocked: STATS.length, speed: 0.25, lastPulse: -1e9, reboots: 64, ap: reduced ? data.ap : Math.max(0, data.ap - data.gain) });
    const [phase, setPhase] = useState<"charge" | "show">(reduced ? "show" : "charge");
    const [canClose, setCanClose] = useState(reduced);
    const num = useRef<HTMLElement>(null);
    const t0 = useRef(0);
    const phaseRef = useRef(phase);
    phaseRef.current = phase;
    const ref = useRef<HTMLDivElement>(null);

    const reveal = useCallback(() => {
        const f = feed.current;
        f.progress = 1; f.overclock = false; f.speed = 1; f.ap = data.ap; f.lastPulse = performance.now();
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
                    <p className="nf-rx-line dim">Wiped: Bytes, Multipliers, Reboots, materials and Drones. Kept: goals, perks and the tree.</p>
                    <p className="nf-rx-go" data-ready={canClose ? "" : undefined}>{canClose ? "Tap to continue" : "\u00a0"}</p>
                </div>
            </div>
            {phase === "show" && !reduced && <div className="nf-rx-flash" aria-hidden="true" />}
        </div>
    );
}
