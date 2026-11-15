// Starwright sprite sheets: the drawn dither art in public/starwright, listed in manifest.json. Sheets are horizontal strips of
// square (or fixed-size) cells. This loads them once, lazily measures the size of each sheet's body, and hands them to the scene
// renderer. Anything that is missing, or not loaded yet, returns null and the renderer draws it in code instead.

interface Entry { src: string; w: number; h: number; frames: number; fps: number; loop: boolean; body?: number }

export interface Sheet {
    id: string;
    img: HTMLImageElement;
    w: number;
    h: number;
    frames: number;
    fps: number;
    loop: boolean;
    /** diameter in px of what the first frame shows, by area (used to size the sprite to the star or planet it replaces) */
    body: number;
}

export interface SpriteSet {
    get(id: string): Sheet | null;
}

const sheets = new Map<string, Sheet>();
let entries: Record<string, Entry> | null = null;
let started = false;
let version = "";
const PREFIXES = ["star/", "planet/", "visitor/", "bg/", "fx/"];
/** background load order: skies, stars and their transitions, then planets, then visitors, then effects */
const ORDER = ["bg/", "star/", "planet/", "visitor/", "fx/"];

function measure(img: HTMLImageElement, w: number, h: number): number {
    try {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const g = c.getContext("2d", { willReadFrequently: true });
        if (!g) return Math.min(w, h);
        g.drawImage(img, 0, 0, w, h, 0, 0, w, h);
        const d = g.getImageData(0, 0, w, h).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 127) n++;
        return Math.max(4, 2 * Math.sqrt(n / Math.PI));
    } catch {
        return Math.min(w, h);
    }
}

const requested = new Set<string>();

function loadSheet(id: string) {
    const e = entries?.[id];
    if (!e || requested.has(id)) return;
    requested.add(id);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
        sheets.set(id, { id, img, w: e.w, h: e.h, frames: Math.max(1, e.frames), fps: e.fps, loop: e.loop, body: e.body ?? measure(img, e.w, e.h) });
        pump();
    };
    img.onerror = () => pump();
    inflight++;
    img.src = `${e.src}${version ? `?v=${version}` : ""}`;
}

// Sheets the scene asks for load at once. Everything else (other stages, transitions, planets not yet owned) trickles in
// two at a time once the game is running, so opening the page does not fire ~100 requests and decodes in one burst.
let inflight = 0;
let queue: string[] = [];
function pump() {
    if (inflight > 0) inflight--;
    while (inflight < 2 && queue.length) {
        const id = queue.shift()!;
        if (!requested.has(id)) loadSheet(id);
    }
}

import { fetchManifest } from "./manifest";

/** Start loading the manifest. Sheets load when the scene first asks for them, and the rest follow in the background. Safe to call more than once. */
export function initSprites(): void {
    if (started || typeof window === "undefined") return;
    started = true;
    fetchManifest()
        .then((m0) => { const m = m0 as { v?: number | string; sheets?: Record<string, Entry> };
            entries = m.sheets ?? {};
            version = String(m.v ?? "");
            queue = Object.keys(entries)
                .filter((id) => PREFIXES.some((p) => id.startsWith(p)))
                .sort((a, b) => ORDER.findIndex((p) => a.startsWith(p)) - ORDER.findIndex((p) => b.startsWith(p)));
            const idle = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
            const go = () => { inflight++; pump(); };
            window.setTimeout(() => (idle ? idle(go, { timeout: 3000 }) : go()), 1500);
        })
        .catch(() => { /* no sheets: the scene draws everything in code */ });
}

export const sprites: SpriteSet = {
    get: (id) => {
        const hit = sheets.get(id);
        if (hit) return hit;
        if (entries && !requested.has(id)) loadSheet(id);
        return null;
    },
};

/** Frame index for a sheet at time t (seconds), or at progress p (0..1) for a one-shot sheet. */
export const frameAt = (s: Sheet, t: number) => (s.loop ? Math.floor(t * s.fps) % s.frames : Math.min(s.frames - 1, Math.floor(t * s.fps)));
export const frameAtProgress = (s: Sheet, p: number) => Math.max(0, Math.min(s.frames - 1, Math.floor(p * s.frames)));

/** Draw one frame centred on (cx, cy) at a scale, optionally rotated, with nearest-neighbour scaling. */
export function drawFrame(ctx: CanvasRenderingContext2D, s: Sheet, frame: number, cx: number, cy: number, scale = 1, alpha = 1, rot = 0): void {
    if (alpha <= 0) return;
    // never let a bad scale (NaN, negative, huge) stall the canvas: sprites are at most 8x their cell
    if (!Number.isFinite(scale) || scale <= 0) return;
    scale = Math.min(scale, 8);
    const dw = s.w * scale, dh = s.h * scale;
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.translate(Math.round(cx), Math.round(cy));
    if (rot) ctx.rotate(rot);
    ctx.drawImage(s.img, frame * s.w, 0, s.w, s.h, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
}
