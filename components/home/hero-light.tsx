"use client";

// A soft light in the home hero that follows the pointer. Fine pointers only: a finger never drags it, and with reduced
// motion (or on touch) it sits still at a rest point, so nothing moves for people who ask it not to. The light moves
// by transform on its own layer, in one rAF loop that sleeps once it has caught up with the pointer.
import { useEffect, useRef } from "react";
import { useMotionOn } from "@/lib/motion/engine";

/** Share of the remaining distance covered each frame: close to 1 is snappy, close to 0 is floaty. */
const CATCH_UP = 0.14;

export function HeroLight() {
    const ref = useRef<HTMLSpanElement>(null);
    const on = useMotionOn();

    useEffect(() => {
        const light = ref.current;
        const hero = light?.parentElement;
        if (!light || !hero) return;

        const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
        const rest = { x: 0, y: 0 };
        const aim = { x: 0, y: 0 };
        const at = { x: 0, y: 0 };
        let frame = 0;

        const paint = () => {
            light.style.transform = `translate3d(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px, 0)`;
        };
        const tick = () => {
            frame = 0;
            at.x += (aim.x - at.x) * CATCH_UP;
            at.y += (aim.y - at.y) * CATCH_UP;
            paint();
            if (Math.abs(aim.x - at.x) > 0.3 || Math.abs(aim.y - at.y) > 0.3) {
                frame = window.requestAnimationFrame(tick);
            }
        };
        const glide = (to: { x: number; y: number }) => {
            aim.x = to.x;
            aim.y = to.y;
            if (!frame) frame = window.requestAnimationFrame(tick);
        };
        const measure = () => {
            rest.x = hero.clientWidth * 0.72;
            rest.y = hero.clientHeight * 0.34;
        };
        const settleAtRest = () => {
            light.dataset.state = "rest";
            glide(rest);
        };

        measure();
        at.x = aim.x = rest.x;
        at.y = aim.y = rest.y;
        paint();
        settleAtRest();

        const live = () => on && fine.matches;

        const onMove = (e: PointerEvent) => {
            if (!live() || e.pointerType === "touch" || e.pointerType === "pen") return;
            const r = hero.getBoundingClientRect();
            light.dataset.state = "follow";
            glide({ x: e.clientX - r.left, y: e.clientY - r.top });
        };
        const onLeave = () => {
            if (live()) settleAtRest();
        };
        const onResize = () => {
            measure();
            if (light.dataset.state !== "follow") {
                at.x = aim.x = rest.x;
                at.y = aim.y = rest.y;
                paint();
            }
        };

        hero.addEventListener("pointermove", onMove, { passive: true });
        hero.addEventListener("pointerleave", onLeave);
        window.addEventListener("resize", onResize, { passive: true });

        return () => {
            hero.removeEventListener("pointermove", onMove);
            hero.removeEventListener("pointerleave", onLeave);
            window.removeEventListener("resize", onResize);
            if (frame) window.cancelAnimationFrame(frame);
            light.style.transform = "";
            light.dataset.state = "idle";
        };
    }, [on]);

    return <span ref={ref} className="hero-light" data-state="idle" aria-hidden="true" />;
}
