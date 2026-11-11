"use client";

import { useEffect, useRef } from "react";

// The reactor core: a 144 px canvas drawn per pixel (hex field, dithered plasma, rotating ring) and shown pixelated at 2x.
// All state arrives through refs so a render of the parent never restarts it.

export interface CoreFeed {
    /** 0..1 progress toward the cheapest Reboot, drawn as the outer arc */
    progress: number;
    /** true while an intrusion boost is running */
    overclock: boolean;
    /** how many stats are unlocked (1..7); the tick ring shows one coloured sector for each */
    unlocked: number;
    /** a speed hint, 0..1, from log10 of Bytes per second */
    speed: number;
    /** performance.now() of the last button press, for the pulse ring */
    lastPulse: number;
    /** Reboots owned: each doubling adds a spoke to the hot centre (up to 8) */
    reboots: number;
    /** Ascension Points: each lights a segment of the outer halo (up to 24) */
    ap: number;
}

// Stages: the body changes shape as stats unlock (hexagon, then an octagon with an inner rotor, then an eight-pointed
// crystal once Quartz opens). Between those, every unlocked stat past the second adds an orbiting node in its colour, every
// doubling of Reboots adds a spoke to the centre, and each Ascension Point lights a segment of an outer halo.
const S = 144;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => n / 16 - 0.5);
const CYAN = [[6, 32, 42], [11, 90, 107], [23, 150, 170], [47, 216, 232], [201, 251, 255]];
const SECT = ["#2fd8e8", "#b6f04a", "#ff2d8a", "#f08a3c", "#7aa2ff", "#e08cff", "#6bffc9"].map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const MAG = [[43, 5, 23], [125, 15, 69], [196, 28, 108], [255, 45, 138], [255, 194, 222]];

export function Core({ feed, reduced }: { feed: React.MutableRefObject<CoreFeed>; reduced: boolean }) {
    const ref = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const cv = ref.current;
        if (!cv) return;
        const ctx = cv.getContext("2d");
        if (!ctx) return;
        const img = ctx.createImageData(S, S);
        const px = img.data;
        let raf = 0;
        let visible = true;
        const io = new IntersectionObserver((e) => (visible = e[0]?.isIntersecting ?? true));
        io.observe(cv);

        const draw = (now: number) => {
            raf = requestAnimationFrame(draw);
            if (!visible || document.hidden) return;
            const f = feed.current;
            const t = reduced ? 0 : now / 1000;
            const pal = f.overclock ? MAG : CYAN;
            const spin = t * (0.25 + f.speed * 0.9);
            const pulse = Math.max(0, 1 - (now - f.lastPulse) / 420);
            const stage = f.unlocked >= 6 ? 2 : f.unlocked >= 4 ? 1 : 0;
            const sides = stage === 1 ? 8 : 6;
            const seg = (Math.PI * 2) / sides;
            const spokes = Math.min(8, Math.floor(Math.log2(1 + f.reboots)));
            const nodes: { x: number; y: number; c: number }[] = [];
            for (let k = 2; k < f.unlocked; k++) {
                const na = t * (0.5 + k * 0.17) * (k % 2 ? 1 : -1) + k * 1.7;
                nodes.push({ x: Math.cos(na) * 45, y: Math.sin(na) * 45, c: k });
            }
            const lit = Math.min(24, f.ap);
            const pr = 14 + (1 - pulse) * 50;
            for (let y = 0; y < S; y++) {
                for (let x = 0; x < S; x++) {
                    const dx = x - S / 2 + 0.5, dy = y - S / 2 + 0.5;
                    const r = Math.hypot(dx, dy);
                    const a = Math.atan2(dy, dx);
                    let v = -1; // -1 = transparent
                    let sect = -1;
                    // hex core body (a hexagon of radius 40, flat-top)
                    let hx: number;
                    if (stage === 2) hx = (r * 40) / (40 * (0.74 + 0.26 * Math.cos(8 * (a + t * 0.12))) + 0.001);
                    else {
                        const m = (((a + (stage === 1 ? t * 0.04 : 0)) % seg) + seg) % seg;
                        hx = (r * Math.cos(m - seg / 2)) / Math.cos(seg / 2);
                    }
                    if (hx < 40) {
                        const plasma = 0.5 + 0.5 * Math.sin(r * 0.28 - t * 2.4 + Math.sin(a * 3 + t) * 1.2);
                        v = 0.18 + plasma * (0.42 + f.progress * 0.28) + (1 - r / 52) * 0.22;
                        if (hx > 36) v = 0.9; // bright rim
                        else if (hx > 33) v = 0.12;
                        if (stage >= 1 && r > 17 && r < 21 && Math.sin(a * 6 - t * 1.6) > -0.2) v = 0.85; // inner rotor
                        if (spokes > 0 && r < 24 && r > 6) {
                            const sp = ((a - t * 0.35) / (Math.PI * 2)) * spokes;
                            if (Math.abs(sp - Math.round(sp)) * (r / 4) < 0.5) v = Math.max(v, 0.88);
                        }
                        if (r < 9) v = 0.97 - r * 0.012; // hot centre
                    }
                    // rotating tick ring
                    if (r > 50 && r < 58) {
                        const k = (a + spin) / (Math.PI * 2) * 36;
                        const fr = k - Math.floor(k);
                        if (fr < 0.38) { v = r > 55 ? 0.95 : 0.55; const si = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 7) % 7; if (si < f.unlocked) sect = si; }
                    }
                    // Reboot progress arc (outer gauge)
                    if (r > 61 && r < 64) {
                        const ang = (a + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
                        if (ang < f.progress * Math.PI * 2) v = 0.95;
                        else if (((x + y) & 1) === 0) v = 0.2;
                    }
                    // orbiting nodes, one per stat unlocked past the second
                    let nc = -1;
                    for (const n of nodes) if (Math.hypot(dx - n.x, dy - n.y) < 2.6) nc = n.c;
                    if (nc >= 0) { v = 1; sect = nc; }
                    // ascension halo
                    if (r > 66 && r < 70) {
                        const hseg = (((a + Math.PI) / (Math.PI * 2)) * 24 + (reduced ? 0 : t * 0.4)) % 24;
                        const si = Math.floor((hseg + 24) % 24);
                        if (((hseg + 24) % 1) < 0.8) v = si < lit ? 0.95 : 0.22;
                    }
                    // press pulse
                    if (pulse > 0 && Math.abs(r - pr) < 1.6) v = Math.max(v, 0.5 + pulse * 0.5);
                    const o = (y * S + x) * 4;
                    if (v < 0) { px[o + 3] = 0; continue; }
                    const idx = Math.max(0, Math.min(4, Math.floor(v * 4 + 0.5 + BAYER[(y & 3) * 4 + (x & 3)] * 0.9)));
                    const c = sect >= 0 && !f.overclock ? (idx >= 3 ? SECT[sect] : SECT[sect].map((n) => n * 0.45)) : pal[idx];
                    px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
                }
            }
            ctx.putImageData(img, 0, 0);
            if (reduced) cancelAnimationFrame(raf);
        };
        raf = requestAnimationFrame(draw);
        return () => {
            cancelAnimationFrame(raf);
            io.disconnect();
        };
    }, [feed, reduced]);

    return <canvas ref={ref} width={S} height={S} className="nf-core-cv" aria-hidden="true" />;
}
