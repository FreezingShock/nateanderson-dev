"use client";

import { useEffect, useRef } from "react";
import { motionOn, subscribeMotion } from "@/lib/motion/engine";

// Animated sprite band behind the homepage Play section. This stub is all that ships with the page: it waits until the
// section is near the screen and the browser is idle, then loads the renderer (games-band-engine.ts) and the three
// small sprite sheets. The canvas is absolutely positioned inside the section, so nothing moves when it arrives.
// Motion off (OS reduced motion) draws one still frame; the loop also stops off screen and on hidden tabs.

type Band = { setMotion(on: boolean): void; stop(): void };

export function GamesBand() {
    const anchor = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const section = anchor.current?.closest("section");
        if (!section || typeof IntersectionObserver !== "function") return;
        let band: Band | null = null;
        let dead = false;
        let idle = 0;
        const ric: (cb: () => void) => number =
            typeof requestIdleCallback === "function" ? (cb) => requestIdleCallback(cb, { timeout: 1500 }) : (cb) => window.setTimeout(cb, 200);
        const cic = (id: number) => (typeof cancelIdleCallback === "function" ? cancelIdleCallback(id) : clearTimeout(id));

        const boot = () => {
            idle = ric(async () => {
                const { startBand } = await import("./games-band-engine");
                if (dead) return;
                band = startBand(section as HTMLElement, motionOn());
            });
        };
        // Start once the section is within a screen of the viewport, and never before the page has loaded.
        const io = new IntersectionObserver(
            (entries) => {
                if (!entries.some((e) => e.isIntersecting)) return;
                io.disconnect();
                if (document.readyState === "complete") boot();
                else addEventListener("load", boot, { once: true });
            },
            { rootMargin: "100% 0px" },
        );
        io.observe(section);
        const unsub = subscribeMotion(() => band?.setMotion(motionOn()));
        return () => {
            dead = true;
            io.disconnect();
            removeEventListener("load", boot);
            cic(idle);
            unsub();
            band?.stop();
        };
    }, []);

    return <span ref={anchor} hidden />;
}
