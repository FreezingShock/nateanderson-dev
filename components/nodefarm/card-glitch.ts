"use client";

/*
 * The prestige tree card's open and close: "glitch slice" (Nate's pick, 2026-11-12). The card tears in as offset
 * horizontal slices that settle, with an RGB-split ghost riding the tear; closing glitches back out and blinks off.
 * About 280 ms in, 170 ms out. A new call on the same card cancels the old one (restart, never queue). Reduced motion
 * shows or hides at once. After "out" the card is left visibility:hidden until it unmounts or plays "in" again.
 */
const runs = new WeakMap<HTMLElement, Animation[]>();

const TEAR: Keyframe[] = [
    { clipPath: "inset(0 0 72% 0)", translate: "-14px 0", opacity: 1 },
    { clipPath: "inset(30% 0 40% 0)", translate: "12px 0" },
    { clipPath: "inset(62% 0 8% 0)", translate: "-8px 0" },
    { clipPath: "inset(10% 0 52% 0)", translate: "6px 0" },
    { clipPath: "inset(0 0 22% 0)", translate: "-3px 0" },
    { clipPath: "inset(0 0 0 0)", translate: "0 0", opacity: 1 },
];

export function cardGlitch(el: HTMLElement | null, dir: "in" | "out"): Promise<void> {
    if (!el) return Promise.resolve();
    for (const a of runs.get(el) ?? []) { try { a.cancel(); } catch { /* gone */ } }
    runs.delete(el);
    el.querySelectorAll(":scope > .nf-tm-ghost").forEach((n) => n.remove());
    if (dir === "in") el.style.removeProperty("visibility");
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof el.animate !== "function") {
        if (dir === "out") el.style.visibility = "hidden";
        return Promise.resolve();
    }
    const ms = dir === "in" ? 280 : 170;
    const anims = [
        el.animate(dir === "in" ? TEAR : [...TEAR].reverse().concat([{ clipPath: "inset(50% 0 50% 0)", opacity: 0 }]), { duration: ms, easing: "steps(6, end)", fill: dir === "out" ? "forwards" : "none" }),
    ];
    const ghost = document.createElement("i");
    ghost.className = "nf-tm-ghost";
    ghost.setAttribute("aria-hidden", "true");
    el.appendChild(ghost);
    anims.push(ghost.animate([{ opacity: 1, translate: "8px 0" }, { opacity: 0.6, translate: "-6px 0" }, { opacity: 0, translate: "0 0" }], { duration: ms, easing: "steps(4, end)", fill: "both" }));
    runs.set(el, anims);
    return Promise.all(anims.map((a) => a.finished.catch(() => undefined))).then(() => {
        ghost.remove();
        if (runs.get(el) !== anims) return;
        runs.delete(el);
        if (dir === "out") el.style.visibility = "hidden";
    });
}
