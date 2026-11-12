/**
 * Parallax engine for the tree backdrops (prestige, Exploit Lab, Firmware, Drone hangar).
 *
 * The bug it fixes: the old backdrops were CSS background layers. Lab, Firmware and Hangar repainted five full-screen
 * layers on every pan or zoom frame, and every backdrop left the browser to raster tiles of layers far bigger than the
 * screen while the camera moved. On a busy machine the raster fell behind, so parts of the background showed blank or as
 * black blocks for a moment and then came back.
 *
 * Now every tiling layer is a <canvas> that is drawn ONCE (a pattern fill, one tile of wrap room larger than the view) and
 * then only slid around by the GPU with translate3d + scale:
 *   - A canvas is one whole texture: there are no tiles for the browser to fall behind on, so it cannot blank mid-pan.
 *   - Pans write one transform per layer, snapped to whole pixels at 1:1 so pixel art and 1 px grid lines stay crisp.
 *   - Zoom is a small residual scale on top of the drawn tile size. A layer is redrawn at the new size only when the
 *     residual leaves 0.9..1.2, or once after the camera settles so it ends crisp. Zooming never jumps in steps.
 *   - Ambient motion (drift, sway, the core pulse, the radar sweep) is CSS animation: compositor work only.
 *   - While the camera moves, the tree menu gets `data-pan`, which pauses the link dash steps (each step repaints the
 *     links), so a pan frame is GPU work only.
 * Layers draw at css-pixel resolution (the art is 2x or 3x pixel art, shown with image-rendering: pixelated), which keeps the
 * canvases small on high-density phones.
 */

/** A tiling image layer (pixel art). cell = css px per tile at zoom 1. */
export interface ImgLayer {
    kind: "img";
    src: string;
    cell: number;
    depth: number;
    zoom: number;
    alpha: number;
    /** sideways drift by one tile per loop: seconds per tile, direction (-1 left, 1 right) */
    drift?: { s: number; dir: 1 | -1 };
    /** a slow sway loop (CSS keyframes `nfBdl<name>`, alternate), `slack` px of room on every side */
    sway?: { name: string; s: number; slack: number };
    /** hidden in low-effects mode */
    lowHide?: boolean;
}
/** A grid of lines along the top and left edge of each cell (like `linear-gradient(color Npx, transparent Npx)`). */
export interface GridLayer {
    kind: "grid";
    color: string;
    line: number;
    /** css px per cell at zoom 1; 0 = half a tree unit */
    cell: number;
    depth: number;
    zoom: number;
    alpha: number;
}
/** One dot in the middle of each cell (the grid the nodes sit on). */
export interface DotLayer {
    kind: "dots";
    color: string;
    r: number;
    cell: number;
    depth: number;
    zoom: number;
    alpha: number;
}
export type Layer = ImgLayer | GridLayer | DotLayer;

/** A world plate centred on (x, y), `size` css px square at zoom 1: an image, or a soft glow in `glow`. */
export interface Plate {
    kind: "plate";
    x: number;
    y: number;
    size: number;
    src?: string;
    glow?: string;
    alpha: number;
    /** section id: brightens when focused, dims to the spec's `dim` when another section is */
    sec?: string;
    /** opacity breathing [low, high, seconds] */
    pulse?: [number, number, number];
    /** clipped to a circle */
    round?: boolean;
}
/** A circle round the origin: diameter `d` (border box), dashed or solid. */
export interface Ring {
    kind: "ring";
    d: number;
    color: string;
    width: number;
    dash?: boolean;
}
/** A radar sweep: a conic wedge turning round the origin. */
export interface Sweep {
    kind: "sweep";
    d: number;
    color: string;
    /** where the wedge has faded out, as a fraction of the turn */
    tail: number;
    period: number;
}
export type WorldItem = Plate | Ring | Sweep;

export interface BackdropSpec {
    layers: Layer[];
    world: WorldItem[];
    /** opacity of the other sections' plates while one is focused */
    dim: number;
    /** below this zoom, world plates are smoothed instead of pixelated (dither would alias into moire) */
    softBelow?: number;
    /** layers drawn in front of the nodes (the prestige dust) */
    front?: ImgLayer[];
}

export interface PView {
    w: number;
    h: number;
    /** the world transform the menu applies: translate(x, y) scale(k) */
    x: number;
    y: number;
    k: number;
}

/** smallest and largest residual scale a drawn layer may show before it is redrawn */
const RES_MIN = 0.9;
const RES_MAX = 1.2;
const mod = (n: number, m: number) => ((n % m) + m) % m;

const images = new Map<string, HTMLImageElement>();
function loadImg(src: string, onload: () => void): HTMLImageElement | null {
    let im = images.get(src);
    if (!im) {
        im = new Image();
        im.decoding = "async";
        im.src = src;
        images.set(src, im);
    }
    if (im.complete && im.naturalWidth) return im;
    im.addEventListener("load", onload, { once: true });
    return null;
}

/** One tiling layer on its own canvas. */
export class LayerCanvas {
    private r = 0; // drawn tile size, css px
    private vw = 0;
    private vh = 0;
    private drawn = false;
    private last: PView | null = null;
    constructor(readonly el: HTMLCanvasElement, readonly spec: Layer, private unit: number) {}

    private get slack() { return this.spec.kind === "img" ? this.spec.sway?.slack ?? 0 : 0; }
    private get extraW() { return this.spec.kind === "img" && this.spec.drift ? 1 : 0; }

    /** draw the tiles into the canvas at tile size r (css px); the canvas is sized for view v */
    private draw(v: PView) {
        const r = this.r, slack = this.slack;
        const W = Math.ceil(v.w / RES_MIN + r * (1 + this.extraW) + slack * 2);
        const H = Math.ceil(v.h / RES_MIN + r + slack * 2);
        const c = this.el;
        if (c.width !== W) c.width = W;
        if (c.height !== H) c.height = H;
        c.style.width = `${W}px`;
        c.style.height = `${H}px`;
        c.style.setProperty("--t", `${r}px`);
        this.vw = v.w;
        this.vh = v.h;
        const g = c.getContext("2d");
        if (!g) return;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, W, H);
        g.imageSmoothingEnabled = false;
        let src: CanvasImageSource;
        let sc = 1;
        const l = this.spec;
        if (l.kind === "img") {
            const im = loadImg(l.src, () => { if (this.last) this.draw(this.last); });
            if (!im) return;
            src = im;
            sc = r / im.naturalWidth;
        } else {
            // a grid or dot tile at a whole number of px, so lines and dots stay crisp
            const t = document.createElement("canvas");
            t.width = t.height = r;
            const tg = t.getContext("2d")!;
            tg.fillStyle = l.color;
            if (l.kind === "grid") {
                tg.fillRect(0, 0, r, l.line);
                tg.fillRect(0, 0, l.line, r);
            } else {
                tg.beginPath();
                tg.arc(r / 2, r / 2, l.r, 0, Math.PI * 2);
                tg.fill();
            }
            src = t;
        }
        const pat = g.createPattern(src, "repeat");
        if (!pat) return;
        // tiles start at (slack, slack); a dot sits mid-cell, so its grid point is half a cell in
        const off = l.kind === "dots" ? -r / 2 : 0;
        pat.setTransform(new DOMMatrix([sc, 0, 0, sc, slack + off, slack + off]));
        g.fillStyle = pat;
        g.fillRect(0, 0, W, H);
        this.drawn = true;
    }

    /** place the layer for this view; `settle` redraws at the exact size if it is showing a residual scale */
    place(v: PView, settle = false) {
        this.last = v;
        const l = this.spec;
        const sEff = Math.max(0.2, 1 + (v.k - 1) * l.zoom);
        const want = (l.cell || this.unit / 2) * sEff;
        const q = this.r ? want / this.r : 0;
        if (!this.r || q < RES_MIN || q > RES_MAX || (settle && Math.abs(q - 1) > 0.002)) {
            this.r = Math.max(3, Math.round(want));
            this.drawn = false;
        }
        if (!this.drawn || this.vw !== v.w || this.vh !== v.h) this.draw(v);
        const res = want / this.r;
        const cx = (v.w / 2 - v.x) / v.k;
        const cy = (v.h / 2 - v.y) / v.k;
        const slack = this.slack * res;
        let lx = mod(v.w / 2 - cx * l.depth * v.k, want) - want - slack;
        let ly = mod(v.h / 2 - cy * l.depth * v.k, want) - want - slack;
        const flat = Math.abs(res - 1) < 0.001;
        if (flat) {
            lx = Math.round(lx);
            ly = Math.round(ly);
        }
        this.el.style.transform = flat
            ? `translate3d(${lx}px, ${ly}px, 0)`
            : `translate3d(${lx.toFixed(2)}px, ${ly.toFixed(2)}px, 0) scale(${res.toFixed(5)})`;
    }
}

/** Drives the layer canvases and the world element from the menu's camera. `front` layers (the dust) can attach later. */
export class Parallax {
    readonly view: PView = { w: 0, h: 0, x: 0, y: 0, k: 1 };
    private layers: LayerCanvas[] = [];
    private front: LayerCanvas[] = [];
    private timer: ReturnType<typeof setTimeout> | 0 = 0;
    private dead = false;

    constructor(private root: HTMLElement, private world: HTMLElement | null, private soft?: number) {}

    setLayers(ls: LayerCanvas[]) { this.layers = ls; this.paint(true); }
    setFront(ls: LayerCanvas[]) { this.front = ls; this.paint(true); }

    private paint(settle = false) {
        const v = this.view;
        if (!v.w || !v.h || this.dead) return;
        for (const L of this.layers) L.place(v, settle);
        for (const L of this.front) L.place(v, settle);
        if (this.world) this.world.style.transform = `translate3d(${v.x.toFixed(2)}px, ${v.y.toFixed(2)}px, 0) scale(${v.k.toFixed(4)})`;
        if (this.soft !== undefined) {
            const s = v.k < this.soft;
            if (s !== (this.root.dataset.soft !== undefined)) {
                if (s) this.root.dataset.soft = "";
                else delete this.root.dataset.soft;
            }
        }
    }

    move(x: number, y: number, k: number) {
        const v = this.view;
        if (x === v.x && y === v.y && k === v.k) return;
        v.x = x;
        v.y = y;
        v.k = k;
        this.paint();
        const menu = this.root.closest<HTMLElement>(".nf-tm");
        if (menu && menu.dataset.pan === undefined) menu.dataset.pan = "";
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            this.timer = 0;
            if (menu) delete menu.dataset.pan;
            this.paint(true);
        }, 180);
    }

    resize(w: number, h: number) {
        if (w === this.view.w && h === this.view.h) return;
        this.view.w = w;
        this.view.h = h;
        this.paint(true);
    }

    focus(sec: string | null) {
        if (sec) this.root.dataset.focus = sec;
        else delete this.root.dataset.focus;
    }

    destroy() {
        this.dead = true;
        if (this.timer) clearTimeout(this.timer);
        delete this.root.closest<HTMLElement>(".nf-tm")?.dataset.pan;
    }
}
