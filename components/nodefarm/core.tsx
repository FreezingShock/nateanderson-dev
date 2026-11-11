"use client";

import { useEffect, useRef } from "react";

// The reactor core: a 144 px canvas drawn per pixel (hex field, dithered plasma, rotating ring) and shown pixelated at 2x.
// All state arrives through refs so a render of the parent never restarts it.

export interface CoreFeed {
    /** 0..1 heat from fast tapping */
    heat: number;
    /** true while an intrusion boost is running */
    overclock: boolean;
    /** a speed hint, 0..1, from log10 of Bytes per second */
    speed: number;
    /** performance.now() of the last tap, for the pulse ring */
    lastTap: number;
}

const S = 144;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => n / 16 - 0.5);
const CYAN = [[6, 32, 42], [11, 90, 107], [23, 150, 170], [47, 216, 232], [201, 251, 255]];
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
            const pulse = Math.max(0, 1 - (now - f.lastTap) / 420);
            const pr = 14 + (1 - pulse) * 50;
            for (let y = 0; y < S; y++) {
                for (let x = 0; x < S; x++) {
                    const dx = x - S / 2 + 0.5, dy = y - S / 2 + 0.5;
                    const r = Math.hypot(dx, dy);
                    const a = Math.atan2(dy, dx);
                    let v = -1; // -1 = transparent
                    // hex core body (a hexagon of radius 40, flat-top)
                    const hx = Math.max(Math.abs(dx) * 0.866 + Math.abs(dy) * 0.5, Math.abs(dy));
                    if (hx < 40) {
                        const plasma = 0.5 + 0.5 * Math.sin(r * 0.28 - t * 2.4 + Math.sin(a * 3 + t) * 1.2);
                        v = 0.18 + plasma * (0.42 + f.heat * 0.28) + (1 - r / 52) * 0.22;
                        if (hx > 36) v = 0.9; // bright rim
                        else if (hx > 33) v = 0.12;
                        if (r < 9) v = 0.97 - r * 0.012; // hot centre
                    }
                    // rotating tick ring
                    if (r > 50 && r < 58) {
                        const k = (a + spin) / (Math.PI * 2) * 36;
                        const fr = k - Math.floor(k);
                        if (fr < 0.38) v = r > 55 ? 0.95 : 0.55;
                    }
                    // heat arc (outer gauge)
                    if (r > 61 && r < 64) {
                        const ang = (a + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
                        if (ang < f.heat * Math.PI * 2) v = 0.95;
                        else if (((x + y) & 1) === 0) v = 0.2;
                    }
                    // tap pulse
                    if (pulse > 0 && Math.abs(r - pr) < 1.6) v = Math.max(v, 0.5 + pulse * 0.5);
                    const o = (y * S + x) * 4;
                    if (v < 0) { px[o + 3] = 0; continue; }
                    const idx = Math.max(0, Math.min(4, Math.floor(v * 4 + 0.5 + BAYER[(y & 3) * 4 + (x & 3)] * 0.9)));
                    const c = pal[idx];
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
