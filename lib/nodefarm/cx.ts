"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { prefersReducedMotion, scrambleNow, settleScramble } from "@/lib/motion/engine";
import "@/app/camino/nodefarm/cx.css";
import { nfx } from "@/lib/nodefarm/sound";

/*
 * Code reveal ("terminal print"): the one open/close animation for every Node Farm window, card and pop-up.
 *
 *   in:  the frame opens out of a thin line, corner brackets snap in, a scan line sweeps down, then each row
 *        marked [data-cx-i] prints left to right (stepped wipe) with a caret riding its edge, top to bottom.
 *        [data-cx-scr] labels decode out of glyphs.
 *   out: rows delete bottom-up, fast, then the frame folds back to a line.
 *
 * Everything is Web Animations on the element itself plus one throwaway overlay, so there is no React state per
 * frame and nothing blocks input (rows stay clickable while they print). A new call on the same element cancels the
 * old one (restart, never queue). Reduced motion resolves at once. A deadline timer always settles the run, so a
 * stalled tab never leaves a half-printed window.
 *
 * Tuning per use: --cx-c on the element (bracket, caret and scan colour; falls back to --c, then cyan).
 * See docs/node-farm.md "Code reveal".
 */

export type CxDir = "in" | "out";
export interface CxOpts {
    dir?: CxDir;
    /** rows to print, inside `el` (default "[data-cx-i]"); order comes from data-cx-i, then DOM order */
    rows?: string;
    /** total time budget in ms (default 280 in, 160 out) */
    ms?: number;
    /** skip the frame line/brackets (for things that sit inline, like a folding panel body) */
    bare?: boolean;
    /** play the print / delete ticks (default: on for framed reveals, off for bare ones) */
    sound?: boolean;
    /** animation style for this use (default print); `nf anim` can override it for testing */
    style?: CxStyle;
}

/**
 * The three looks, each with its own job (Nate, 2026-11-12): "print" for milestones (and tooltips and the tree card),
 * "decrypt" for unlocks and zone events, "crt" for panels (windows, the offline report, folding zones).
 * Callers pass `style`; with none it is "print".
 */
export type CxStyle = "print" | "decrypt" | "crt";
export const CX_STYLES: CxStyle[] = ["print", "decrypt", "crt"];
const STYLE_KEY = "nf-cx-style";
/** A testing override that forces one style everywhere: `?cx=decrypt` or `nf anim decrypt` (per browser). null = each use's own. */
export function cxOverride(): CxStyle | null {
    try {
        const v = new URLSearchParams(location.search).get("cx") || localStorage.getItem(STYLE_KEY);
        return v && CX_STYLES.includes(v as CxStyle) ? (v as CxStyle) : null;
    } catch {
        return null;
    }
}
export function setCxOverride(v: CxStyle | null) {
    try {
        if (v) localStorage.setItem(STYLE_KEY, v);
        else localStorage.removeItem(STYLE_KEY);
    } catch {}
}

export const CX = { inMs: 280, outMs: 160, step: 40, maxStagger: 8 } as const;

interface Run {
    anims: Animation[];
    fx: HTMLElement | null;
    timer: number;
    iv?: number;
    done: () => void;
}
const runs = new WeakMap<HTMLElement, Run>();

const LINE = "inset(calc(50% - 1px) 0 calc(50% - 1px) 0)";
const FULL = "inset(0 0 0 0)";

function stop(el: HTMLElement, settle: boolean) {
    const r = runs.get(el);
    if (!r) return;
    runs.delete(el);
    window.clearTimeout(r.timer);
    window.clearInterval(r.iv);
    for (const a of r.anims) {
        try {
            a.cancel();
        } catch {}
    }
    r.fx?.remove();
    if (settle) el.querySelectorAll<HTMLElement>("[data-cx-scr]").forEach(settleScramble);
    r.done();
}

function rowsOf(el: HTMLElement, sel: string): HTMLElement[] {
    const list = Array.from(el.querySelectorAll<HTMLElement>(sel)).filter((r) => r.offsetParent !== null || r.getClientRects().length > 0);
    return list
        .map((r, k) => ({ r, k, i: Number(r.getAttribute("data-cx-i")) }))
        .sort((a, b) => (Number.isFinite(a.i) && Number.isFinite(b.i) ? a.i - b.i || a.k - b.k : a.k - b.k))
        .map((x) => x.r);
}

/** Only rows on screen animate; the rest just appear (a long window would otherwise print for seconds). */
function onScreen(r: HTMLElement) {
    const b = r.getBoundingClientRect();
    return b.bottom > 0 && b.top < innerHeight && b.width > 0;
}


// ---- the other two looks ------------------------------------------------------------------------------------------

const NOISE = "01<>/\\[]{}#%$&@*+=-_:;|!?";
function noiseText(cols: number, lines: number) {
    let out = "";
    for (let l = 0; l < lines; l++) {
        for (let c = 0; c < cols; c++) out += NOISE[(Math.random() * NOISE.length) | 0];
        if (l < lines - 1) out += "\n";
    }
    return out;
}

function makeFx(el: HTMLElement, color: string, run: Run, inner = "") {
    const fx = document.createElement("i");
    fx.className = "nf-cx-fx";
    fx.setAttribute("aria-hidden", "true");
    fx.style.top = `${el.scrollTop}px`;
    fx.style.height = `${el.clientHeight}px`;
    if (color) fx.style.setProperty("--cx-c", color);
    fx.innerHTML = inner;
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    el.appendChild(fx);
    run.fx = fx;
    return fx;
}

/**
 * Decrypt: every row sits under a block of glyph noise that flickers, then resolves left to right into the real row.
 * Closing re-encrypts the rows bottom-up, then the frame drops out.
 */
function playDecrypt(el: HTMLElement, dir: CxDir, rows: HTMLElement[], total: number, bare: boolean, color: string, run: Run) {
    const anims = run.anims;
    const fx = makeFx(el, color, run);
    fx.style.top = "0px";
    fx.style.height = `${el.scrollHeight}px`;
    const host = el.getBoundingClientRect();
    const list = rows.slice(0, 16);
    const blocks = list.map((r) => {
        const b = r.getBoundingClientRect();
        const u = document.createElement("u");
        u.className = "nf-cx-noise";
        u.style.left = `${b.left - host.left + el.scrollLeft}px`;
        u.style.top = `${b.top - host.top + el.scrollTop}px`;
        u.style.width = `${b.width}px`;
        u.style.height = `${b.height}px`;
        const cols = Math.max(4, Math.ceil(b.width / 7.2));
        const lines = Math.max(1, Math.ceil(b.height / 13));
        u.dataset.c = String(cols);
        u.dataset.l = String(lines);
        u.textContent = noiseText(cols, lines);
        fx.appendChild(u);
        return u;
    });
    run.iv = window.setInterval(() => blocks.forEach((u) => (u.textContent = noiseText(+u.dataset.c!, +u.dataset.l!))), 55);
    const n = Math.min(list.length, CX.maxStagger);
    if (dir === "in") {
        const frameMs = bare ? 0 : Math.round(total * 0.2);
        const rowMs = Math.max(90, Math.round(total * 0.5));
        const step = n > 1 ? Math.min(CX.step, (total - frameMs - rowMs) / (n - 1)) : 0;
        if (!bare) anims.push(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: frameMs, easing: "steps(3, end)" }));
        list.forEach((r, k) => {
            const delay = frameMs + Math.min(k, CX.maxStagger - 1) * step;
            // the row is hidden under its noise until the noise starts to resolve
            anims.push(r.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1, delay, fill: "backwards" }));
            anims.push(blocks[k].animate([{ clipPath: FULL, opacity: 1 }, { clipPath: "inset(0 0 0 100%)", opacity: 1 }], { duration: rowMs, delay, easing: "steps(9, end)", fill: "both" }));
        });
    } else {
        const frameMs = bare ? 0 : Math.round(total * 0.3);
        const rowMs = Math.max(60, Math.round(total * 0.45));
        const span = Math.max(0, total - frameMs - rowMs);
        const step = n > 1 ? span / (n - 1) : 0;
        list.slice().reverse().forEach((r) => {
            const k = list.length - 1 - list.indexOf(r);
            const delay = Math.min(k, CX.maxStagger - 1) * step;
            anims.push(blocks[list.indexOf(r)].animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: FULL }], { duration: rowMs, delay, easing: "steps(7, end)", fill: "both" }));
            anims.push(r.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1, delay: delay + rowMs, fill: "forwards" }));
        });
        anims.push(el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: Math.max(60, frameMs), delay: total - Math.max(60, frameMs), easing: "steps(3, end)", fill: "forwards" }));
    }
}

/**
 * CRT: the window switches on like an old monitor (a bright line stretches out, then opens to full height with a flash
 * and scanlines), and switches off the same way in reverse, collapsing to a line, then a dot. No per-row typing.
 */
function playCrt(el: HTMLElement, dir: CxDir, rows: HTMLElement[], total: number, bare: boolean, color: string, run: Run) {
    const anims = run.anims;
    if (bare) {
        // inline things (folds, tooltips) just flicker on or off, row by row
        rows.slice(0, CX.maxStagger).forEach((r, k) => {
            const kf = dir === "in" ? [{ opacity: 0 }, { opacity: 0.7 }, { opacity: 0.15 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0.2 }, { opacity: 0.6 }, { opacity: 0 }];
            anims.push(r.animate(kf, { duration: total * 0.7, delay: k * 18, easing: "steps(4, end)", fill: dir === "in" ? "backwards" : "forwards" }));
        });
        return;
    }
    const fx = makeFx(el, color, run, "<s></s><em></em>");
    if (dir === "in") {
        anims.push(
            el.animate(
                [
                    { transform: "scale(0.04, 0.006)", filter: "brightness(5)" },
                    { transform: "scale(1, 0.006)", filter: "brightness(4)", offset: 0.35 },
                    { transform: "scale(1, 1)", filter: "brightness(1.8)", offset: 0.75 },
                    { transform: "none", filter: "none" },
                ],
                { duration: total, easing: "cubic-bezier(.2,.7,.3,1)" },
            ),
        );
        anims.push(fx.querySelector("s")!.animate([{ top: "0%", opacity: 0 }, { top: "0%", opacity: 1, offset: 0.5 }, { top: "100%", opacity: 0.2 }], { duration: total * 1.3, fill: "both" }));
        anims.push(fx.querySelector("em")!.animate([{ opacity: 0.9 }, { opacity: 0.9, offset: 0.5 }, { opacity: 0 }], { duration: total * 1.4, fill: "both" }));
    } else {
        anims.push(
            el.animate(
                [
                    { transform: "none", filter: "none", opacity: 1 },
                    { transform: "scale(1, 0.006)", filter: "brightness(3)", opacity: 1, offset: 0.55 },
                    { transform: "scale(0.02, 0.006)", filter: "brightness(6)", opacity: 1, offset: 0.9 },
                    { transform: "scale(0, 0)", filter: "brightness(6)", opacity: 0 },
                ],
                { duration: total * 1.2, easing: "cubic-bezier(.5,0,.8,.4)", fill: "forwards" },
            ),
        );
        anims.push(fx.querySelector("em")!.animate([{ opacity: 0 }, { opacity: 0.9 }], { duration: total * 0.5, fill: "forwards" }));
    }
}

/**
 * Play the code reveal on `el`. Resolves when it has finished (or was replaced by a newer call on the same element).
 * For "out", the element is left hidden (clipped to nothing) until the caller unmounts or hides it; the next "in" or
 * `cxClear(el)` lifts that.
 */
export function codeReveal(el: HTMLElement | null, opts: CxOpts = {}): Promise<void> {
    return new Promise<void>((resolve) => {
        if (!el) return resolve();
        const dir = opts.dir ?? "in";
        stop(el, true);
        cxClear(el);
        el.setAttribute("data-cx", dir);
        if (prefersReducedMotion() || typeof el.animate !== "function") {
            if (dir === "out") el.style.visibility = "hidden";
            return resolve();
        }

        const total = opts.ms ?? (dir === "in" ? CX.inMs : CX.outMs);
        const rows = rowsOf(el, opts.rows ?? "[data-cx-i]").filter(onScreen);
        const anims: Animation[] = [];
        const run: Run = { anims, fx: null, timer: 0, done: resolve };
        runs.set(el, run);
        const color = getComputedStyle(el).getPropertyValue("--cx-c").trim() || "";
        if (opts.sound ?? !opts.bare) nfx(dir === "in" ? "nfPrint" : "nfDelete", rows.length);

        const style = cxOverride() ?? opts.style ?? "print";
        if (style !== "print" && dir === "in") el.querySelectorAll<HTMLElement>("[data-cx-scr]").forEach((t) => scrambleNow(t, Math.min(520, total + 160)));
        if (style === "decrypt") playDecrypt(el, dir, rows, total, !!opts.bare, color, run);
        else if (style === "crt") playCrt(el, dir, rows, total, !!opts.bare, color, run);
        else {
            if (dir === "in") {
                const frameMs = opts.bare ? 0 : Math.round(total * 0.36);
                const rowMs = Math.max(70, Math.round(total * 0.42));
                const n = Math.min(rows.length, CX.maxStagger);
                const step = n > 1 ? Math.min(CX.step, (total - frameMs - rowMs) / (n - 1)) : 0;

                if (!opts.bare) {
                    anims.push(el.animate([{ clipPath: LINE }, { clipPath: FULL }], { duration: frameMs, easing: "steps(4, end)" }));
                    const fx = document.createElement("i");
                    fx.className = "nf-cx-fx";
                    fx.setAttribute("aria-hidden", "true");
                    fx.style.top = `${el.scrollTop}px`;
                    fx.style.height = `${el.clientHeight}px`;
                    if (color) fx.style.setProperty("--cx-c", color);
                    fx.innerHTML = "<b></b><b></b><b></b><b></b><s></s>";
                    if (getComputedStyle(el).position === "static") el.style.position = "relative";
                    el.appendChild(fx);
                    run.fx = fx;
                    const corners = Array.from(fx.querySelectorAll("b"));
                    corners.forEach((c, k) => {
                        const sx = k % 2 ? -1 : 1;
                        const sy = k < 2 ? 1 : -1;
                        anims.push(
                            c.animate(
                                [
                                    { opacity: 0, translate: `${sx * 10}px ${sy * 10}px` },
                                    { opacity: 1, translate: "0 0", offset: 0.6 },
                                    { opacity: 1, translate: "0 0" },
                                ],
                                { duration: frameMs + 60, easing: "steps(3, end)", fill: "both" },
                            ),
                        );
                    });
                    const scan = fx.querySelector("s")!;
                    anims.push(scan.animate([{ top: "0%", opacity: 1 }, { top: "100%", opacity: 0.2 }], { duration: total, easing: "linear", fill: "both" }));
                }

                rows.forEach((r, k) => {
                    const delay = frameMs + Math.min(k, CX.maxStagger - 1) * step;
                    anims.push(
                        r.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: FULL }], {
                            duration: rowMs,
                            delay,
                            easing: "steps(10, end)",
                            fill: "backwards",
                        }),
                    );
                    // the caret: a block that rides the row's printing edge, then blinks out
                    if (run.fx && k < CX.maxStagger) {
                        const b = r.getBoundingClientRect();
                        const host = el.getBoundingClientRect();
                        const car = document.createElement("u");
                        car.style.left = `${b.left - host.left + el.scrollLeft}px`;
                        car.style.top = `${b.top - host.top}px`;
                        car.style.height = `${Math.min(b.height, 22)}px`;
                        run.fx.appendChild(car);
                        anims.push(
                            car.animate(
                                [
                                    { opacity: 1, translate: "0 0" },
                                    { opacity: 1, translate: `${b.width}px 0`, offset: 0.92 },
                                    { opacity: 0, translate: `${b.width}px 0` },
                                ],
                                { duration: rowMs + 30, delay, easing: "steps(10, end)", fill: "both" },
                            ),
                        );
                    }
                });
                el.querySelectorAll<HTMLElement>("[data-cx-scr]").forEach((t) => scrambleNow(t, Math.min(520, total + 160)));
            } else {
                const n = Math.min(rows.length, CX.maxStagger);
                const frameMs = opts.bare ? 0 : Math.round(total * 0.4);
                const rowMs = Math.max(50, Math.round(total * 0.38));
                const span = Math.max(0, total - frameMs - rowMs);
                const step = n > 1 ? span / (n - 1) : 0;
                const rev = rows.slice(-CX.maxStagger).reverse(); // bottom-up
                rev.forEach((r, k) => {
                    anims.push(
                        r.animate([{ clipPath: FULL }, { clipPath: "inset(0 100% 0 0)" }], { duration: rowMs, delay: k * step, easing: "steps(6, end)", fill: "forwards" }),
                    );
                });
                if (!opts.bare) {
                    anims.push(
                        el.animate([{ clipPath: FULL, opacity: 1 }, { clipPath: LINE, opacity: 1, offset: 0.75 }, { clipPath: LINE, opacity: 0 }], {
                            duration: frameMs,
                            delay: total - frameMs,
                            easing: "steps(3, end)",
                            fill: "forwards",
                        }),
                    );
                } else {
                    anims.push(el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 60, delay: Math.max(0, total - 60), fill: "forwards" }));
                }
            }

        }

        const finish = () => {
            if (runs.get(el) !== run) return;
            runs.delete(el);
            window.clearTimeout(run.timer);
            window.clearInterval(run.iv);
            if (dir === "in") {
                for (const a of anims) {
                    try {
                        a.cancel();
                    } catch {}
                }
                run.fx?.remove();
            } else {
                // keep it clipped until the caller hides it, then drop the held animations
                el.style.visibility = "hidden";
                run.fx?.remove();
                for (const a of anims) {
                    try {
                        a.cancel();
                    } catch {}
                }
            }
            resolve();
        };
        Promise.all(anims.map((a) => a.finished.catch(() => undefined))).then(finish);
        // deadline: settle even if frames stall. While the animations are visibly still playing (a slowed devtools
        // timeline, a busy frame) give them a little longer, up to a hard cap.
        let tries = 0;
        const deadline = () => {
            if (runs.get(el) !== run) return;
            if (tries++ < 6 && document.visibilityState === "visible" && anims.some((a) => a.playState === "running")) run.timer = window.setTimeout(deadline, 400);
            else finish();
        };
        run.timer = window.setTimeout(deadline, total + 400);
    });
}

/** Lift anything a finished "out" left behind (hidden state). Call before showing the element again. */
export function cxClear(el: HTMLElement | null) {
    if (!el) return;
    el.style.visibility = "";
    el.removeAttribute("data-cx");
}

/** Replay the open on an element that is already showing (a card whose content changed). Restarts, never queues. */
export function cxPlay(el: HTMLElement | null, opts: Omit<CxOpts, "dir"> = {}) {
    return codeReveal(el, { ...opts, dir: "in" });
}

/** Stop any run on `el` at once and land every scrambled label on its real text. */
export function cxStop(el: HTMLElement | null) {
    if (el) stop(el, true);
}

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Keep something mounted through its exit animation.
 *   const ref = useRef<HTMLDivElement>(null);
 *   const shown = useCodeReveal(ref, open);
 *   return shown && <div ref={ref}>...</div>;
 * Opens with the "in" print once it mounts; when `open` turns false it prints "out", then unmounts.
 */
export function useCodeReveal<T extends HTMLElement>(ref: RefObject<T | null>, open: boolean, opts: Omit<CxOpts, "dir"> = {}): boolean {
    const [shown, setShown] = useState(open);
    const o = useRef(opts);
    o.current = opts;
    useIso(() => {
        if (open) {
            setShown(true);
            return;
        }
        if (!shown) return;
        let live = true;
        codeReveal(ref.current, { ...o.current, dir: "out" }).then(() => {
            if (live) setShown(false);
        });
        return () => {
            live = false;
        };
    }, [open]);
    useIso(() => {
        if (shown && open) codeReveal(ref.current, { ...o.current, dir: "in" });
    }, [shown, open]);
    useEffect(() => () => cxStop(ref.current), [ref]);
    return shown;
}

/**
 * A folding panel body: rows print in when it expands and delete when it folds (no frame, no sound; the fold
 * button already clicks). Skips the first render so a page load does not animate every zone.
 */
export function useFoldReveal<T extends HTMLElement>(ref: RefObject<T | null>, open: boolean, rows = ":scope > *", style: CxStyle = "crt") {
    const first = useRef(true);
    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        const el = ref.current;
        if (!el) return;
        if (open) codeReveal(el, { bare: true, rows, ms: 260, style });
        else codeReveal(el, { dir: "out", bare: true, rows, ms: 260, style });
    }, [open, ref, rows, style]);
}
