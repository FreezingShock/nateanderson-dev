"use client";

/*
 * Preview switch for the prestige tree's open taste calls (2026-11-12). Every option from Nate's four cards is built,
 * and localStorage "nf-tree-try" picks which one plays, e.g. {"anim":"scan","type":"serif","frame":"bounds","open":"iris"}.
 * Defaults are the recommended options. Once Nate picks, the losers and this file go.
 */
import { codeReveal } from "@/lib/nodefarm/cx";

export type TreeTry = {
    anim: "term" | "scan" | "glitch";
    type: "split" | "mono" | "serif";
    frame: "corners" | "bounds" | "full";
    open: "boot" | "iris" | "zoom";
};
export const TRY_DEFAULT: TreeTry = { anim: "glitch", type: "split", frame: "corners", open: "boot" };

export function readTry(): TreeTry {
    try {
        const raw = localStorage.getItem("nf-tree-try");
        if (raw) return { ...TRY_DEFAULT, ...(JSON.parse(raw) as Partial<TreeTry>) };
    } catch { /* storage blocked */ }
    return TRY_DEFAULT;
}

const reduce = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const runs = new WeakMap<HTMLElement, Animation[]>();
function cancel(el: HTMLElement) {
    for (const a of runs.get(el) ?? []) { try { a.cancel(); } catch { /* gone */ } }
    runs.delete(el);
    el.querySelectorAll(":scope > .nf-try-fx").forEach((n) => n.remove());
}
const done = (anims: Animation[]) => Promise.all(anims.map((a) => a.finished.catch(() => undefined))).then(() => undefined);

/** Scanline decode: a bright bar sweeps down, dither noise above it turns into the card below it. Out sweeps back up. */
function scan(el: HTMLElement, dir: "in" | "out"): Promise<void> {
    const ms = dir === "in" ? 300 : 180;
    const fx = document.createElement("i");
    fx.className = "nf-try-fx nf-try-scan";
    fx.setAttribute("aria-hidden", "true");
    fx.innerHTML = "<s></s><b></b>";
    el.appendChild(fx);
    const a = dir === "in" ? ["0%", "100%"] : ["100%", "0%"];
    const anims = [
        el.animate([{ clipPath: dir === "in" ? "inset(0 0 100% 0)" : "inset(0 0 0 0)" }, { clipPath: dir === "in" ? "inset(0 0 0 0)" : "inset(0 0 100% 0)" }], { duration: ms, easing: "steps(12, end)", fill: dir === "out" ? "forwards" : "none" }),
        fx.querySelector("b")!.animate([{ top: a[0] }, { top: a[1] }], { duration: ms, easing: "steps(12, end)", fill: "both" }),
        fx.querySelector("s")!.animate([{ height: dir === "in" ? "0%" : "100%" }, { height: dir === "in" ? "100%" : "0%" }, { height: dir === "in" ? "100%" : "0%", opacity: 0 }], { duration: ms + 80, easing: "steps(12, end)", fill: "both" }),
    ];
    runs.set(el, anims);
    return done(anims).then(() => { fx.remove(); if (dir === "out") el.style.visibility = "hidden"; });
}

/** Glitch slice: the card tears in as offset horizontal slices that settle; out glitches and blinks off. */
function glitch(el: HTMLElement, dir: "in" | "out"): Promise<void> {
    const kf: Keyframe[] = [
        { clipPath: "inset(0 0 72% 0)", translate: "-14px 0", opacity: 1 },
        { clipPath: "inset(30% 0 40% 0)", translate: "12px 0" },
        { clipPath: "inset(62% 0 8% 0)", translate: "-8px 0" },
        { clipPath: "inset(10% 0 52% 0)", translate: "6px 0" },
        { clipPath: "inset(0 0 22% 0)", translate: "-3px 0" },
        { clipPath: "inset(0 0 0 0)", translate: "0 0", opacity: 1 },
    ];
    const ms = dir === "in" ? 280 : 170;
    const anims = [el.animate(dir === "in" ? kf : [...kf].reverse().concat([{ clipPath: "inset(50% 0 50% 0)", opacity: 0 }]), { duration: ms, easing: "steps(6, end)", fill: dir === "out" ? "forwards" : "none" })];
    // an RGB-split ghost rides the tear
    const fx = document.createElement("i");
    fx.className = "nf-try-fx nf-try-ghost";
    fx.setAttribute("aria-hidden", "true");
    el.appendChild(fx);
    anims.push(fx.animate([{ opacity: 1, translate: "8px 0" }, { opacity: .6, translate: "-6px 0" }, { opacity: 0, translate: "0 0" }], { duration: ms, easing: "steps(4, end)", fill: "both" }));
    runs.set(el, anims);
    return done(anims).then(() => { fx.remove(); if (dir === "out") el.style.visibility = "hidden"; });
}

/** The card's reveal in the chosen style. Restarts, never queues. */
export function cardReveal(el: HTMLElement | null, dir: "in" | "out", anim: TreeTry["anim"]): Promise<void> {
    if (!el) return Promise.resolve();
    if (anim === "term") return codeReveal(el, { dir });
    cancel(el);
    if (dir === "in") el.style.removeProperty("visibility");
    if (reduce() || typeof el.animate !== "function") { if (dir === "out") el.style.visibility = "hidden"; return Promise.resolve(); }
    return anim === "scan" ? scan(el, dir) : glitch(el, dir);
}

// where the player last pressed, so the dither iris can grow out of the button that opened the tree
let last = { x: -1, y: -1 };
if (typeof window !== "undefined") window.addEventListener("pointerdown", (e) => { last = { x: e.clientX, y: e.clientY }; }, true);
export function irisFrom(): { x: number; y: number } | null {
    const at = typeof document !== "undefined" ? document.body.dataset.nfTreeFrom : undefined;
    if (at) { const [x, y] = at.split(",").map(Number); if (Number.isFinite(x) && Number.isFinite(y)) return { x, y }; }
    return last.x >= 0 ? last : null;
}
