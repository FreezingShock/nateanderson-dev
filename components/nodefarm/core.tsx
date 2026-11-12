"use client";

import { useEffect, useRef } from "react";
import { STATS } from "@/lib/nodefarm/engine";
import { CORE_S, PART_ORDER, makeCoreRenderer, type CoreFrame } from "@/lib/nodefarm/core-art";

// The reactor core: a 144 px canvas drawn by lib/nodefarm/core-art.ts and shown pixelated at 2x.
// All state arrives through refs so a render of the parent never restarts it.

export interface CoreFeed {
    /** 0..1 progress toward the cheapest Reboot, drawn as the outer arc */
    progress: number;
    /** true while an intrusion boost is running */
    overclock: boolean;
    /** how many stats are unlocked; the tick ring shows one coloured sector for each */
    unlocked: number;
    /** a speed hint, 0..1, from log10 of Bytes per second */
    speed: number;
    /** performance.now() of the last button press, for the pulse ring */
    lastPulse: number;
    /** stat index of the last press: the pulse ring wears that zone's colour */
    pulseStat: number;
    /** Reboots owned: each doubling adds a spoke to the hot centre (up to 8) */
    reboots: number;
    /** Ascension Points: each lights a segment of the outer halo (up to 24) */
    ap: number;
    /** stat index of the zone whose colours the core wears (lib/nodefarm/core-look.ts) */
    zone: number;
    chroma: boolean;
    /** structures bolted on (PART bitmask), -1 until the game has loaded */
    parts: number;
    drones: number;
    glyphs: number;
}

export const freshCoreFeed = (): CoreFeed => ({ progress: 0, overclock: false, unlocked: 1, speed: 0, lastPulse: -1e9, pulseStat: 0, reboots: 0, ap: 0, zone: 0, chroma: false, parts: -1, drones: 0, glyphs: 0 });

const BUILD_MS = 1600; // a new structure bolts on over this long
const DISSOLVE_MS = 900; // a zone change dithers across over this long

export function Core({ feed, reduced }: { feed: React.MutableRefObject<CoreFeed>; reduced: boolean }) {
    const ref = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const cv = ref.current;
        if (!cv) return;
        const ctx = cv.getContext("2d");
        if (!ctx) return;
        const img = ctx.createImageData(CORE_S, CORE_S);
        const R = makeCoreRenderer(STATS.map((x) => x.color));
        let raf = 0;
        let visible = true;
        const io = new IntersectionObserver((e) => (visible = e[0]?.isIntersecting ?? true));
        io.observe(cv);

        // structures already there when the game loads are simply there; ones that arrive later build in
        const born: number[] = PART_ORDER.map(() => -1e9);
        let primed = false;
        let zone = 0, prevZone = 0, zoneAt = -1e9;
        const frame: CoreFrame = { progress: 0, overclock: false, unlocked: 1, speed: 0, pulse: 0, pulseStat: 0, reboots: 0, ap: 0, zone, prevZone, zoneMix: 1, chroma: false, parts: 0, build: PART_ORDER.map(() => 1), drones: 0, glyphs: 0 };
        let lastDraw = -1e9, lastCheck = -1e9;
        let sig = "";
        const draw = (now: number) => {
            raf = requestAnimationFrame(draw);
            if (!visible || document.hidden || document.body.classList.contains("nf-tm-open")) return; // the full-screen tree covers the core
            const f = feed.current;
            // 30 fps is plenty for a 144 px dithered core, and a press pulse still redraws at once. Calm motion draws a
            // still frame, and only again when something it shows changes.
            if (f.parts < 0) return; // the save hasn't loaded yet
            if (!primed) {
                primed = true;
                zone = prevZone = f.zone;
                for (let k = 0; k < PART_ORDER.length; k++) born[k] = f.parts & (1 << k) ? -1e9 : 0;
            }
            if (reduced) {
                if (now - lastCheck < 500) return;
                lastCheck = now;
                const s = `${f.zone}|${f.chroma}|${f.parts}|${f.overclock}|${f.unlocked}|${Math.round(f.progress * 40)}|${Math.min(24, f.ap)}|${Math.min(8, Math.floor(Math.log2(1 + f.reboots)))}`;
                if (s === sig && now - lastDraw < 4000) return;
                sig = s;
            } else if (now - lastDraw < (document.body.classList.contains("nf-lowfx") ? 80 : 33) && !(now - f.lastPulse < 40)) return;
            lastDraw = now;
            if (f.zone !== zone) {
                prevZone = zone;
                zone = f.zone;
                zoneAt = now;
            }
            for (let k = 0; k < PART_ORDER.length; k++) {
                const on = (f.parts & (1 << k)) !== 0;
                if (on && born[k] === 0) born[k] = now;
                if (!on) born[k] = 0;
                frame.build[k] = on ? (reduced ? 1 : Math.min(1, (now - born[k]) / BUILD_MS)) : 0;
            }
            frame.progress = f.progress;
            frame.overclock = f.overclock;
            frame.unlocked = f.unlocked;
            frame.speed = f.speed;
            frame.pulse = reduced ? 0 : Math.max(0, 1 - (now - f.lastPulse) / 420);
            frame.pulseStat = f.pulseStat;
            frame.reboots = f.reboots;
            frame.ap = f.ap;
            frame.zone = zone;
            frame.prevZone = prevZone;
            frame.zoneMix = reduced ? 1 : Math.min(1, (now - zoneAt) / DISSOLVE_MS);
            frame.chroma = f.chroma;
            frame.parts = f.parts;
            frame.drones = f.drones;
            frame.glyphs = f.glyphs;
            R.draw(img.data, frame, reduced ? 0 : now / 1000);
            ctx.putImageData(img, 0, 0);
        };
        raf = requestAnimationFrame(draw);
        return () => {
            cancelAnimationFrame(raf);
            io.disconnect();
        };
    }, [feed, reduced]);

    return <canvas ref={ref} width={CORE_S} height={CORE_S} className="nf-core-cv" aria-hidden="true" />;
}
