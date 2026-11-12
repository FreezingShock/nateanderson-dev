/**
 * Shared parallax engine for the four tree backdrops (prestige, Exploit Lab, Firmware, Drone hangar).
 *
 * Every tiling layer is its own compositor layer: a box one tile bigger than the view, painted ONCE with its tiles at a
 * whole-pixel tile size, then moved with translate3d + scale. Panning and zooming never repaint it; only the GPU moves it.
 *   - Pans write one transform per layer, snapped to whole pixels while the layer is at 1:1, so pixel art and 1 px grid
 *     lines stay crisp instead of shimmering on half pixels.
 *   - Zoom is a small residual scale on top of the painted tile size. The layer is repainted at the new size only when the
 *     residual leaves 0.8..1.25, or once after the camera settles (so it ends crisp). No 2 % steps, no jumps.
 *   - While the camera moves, the tree menu gets `data-pan`, which pauses the link dash animations (each step repaints the
 *     links layer), so a pan frame is compositor work only.
 * Layer CSS needs: position absolute, left/top 0, transform-origin 0 0, will-change transform,
 * background-size var(--t) var(--t), background-position var(--s) var(--s) (on the layer or its inner tile element).
 */

export interface PView {
    w: number;
    h: number;
    /** the world transform the menu applies: translate(x, y) scale(k) */
    x: number;
    y: number;
    k: number;
}

export interface PLayer {
    el: HTMLElement;
    /** how far the layer follows the camera (0 = fixed to the screen, 1 = glued to the nodes) */
    depth: number;
    /** how much of the zoom it takes */
    zoom: number;
    /** css px per tile at zoom 1 */
    cell: number;
    /** extra tiles of width (room for a sideways drift animation) */
    extraW?: number;
    /** px of slack on every side (room for a sway animation) */
    slack?: number;
    /** painted tile size in px (internal) */
    r?: number;
    /** the view size the box was sized for (internal) */
    vw?: number;
    vh?: number;
}

/** smallest residual scale a painted layer is allowed to show before it is repainted */
const RES_MIN = 0.8;
const RES_MAX = 1.25;

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Place one tiling layer for this view. `settle` repaints at the exact size if the layer is showing any residual scale. */
export function paintLayer(L: PLayer, v: PView, settle = false) {
    const slack = L.slack ?? 0;
    const sEff = Math.max(0.2, 1 + (v.k - 1) * L.zoom);
    const want = L.cell * sEff;
    let r = L.r ?? 0;
    const q = r ? want / r : 0;
    if (!r || q < RES_MIN || q > RES_MAX || (settle && Math.abs(q - 1) > 0.002)) {
        r = Math.max(2, Math.round(want));
        L.r = r;
        L.vw = 0;
        L.el.style.setProperty("--t", `${r}px`);
        L.el.style.setProperty("--s", `${slack}px`);
    }
    if (L.vw !== v.w || L.vh !== v.h) {
        // big enough to cover the view at the smallest residual scale, plus a tile of wrap room (and drift / sway room)
        L.vw = v.w;
        L.vh = v.h;
        L.el.style.width = `${Math.ceil(v.w / RES_MIN + r * (1 + (L.extraW ?? 0)) + slack * 2)}px`;
        L.el.style.height = `${Math.ceil(v.h / RES_MIN + r + slack * 2)}px`;
    }
    const res = want / r;
    const cx = (v.w / 2 - v.x) / v.k;
    const cy = (v.h / 2 - v.y) / v.k;
    let lx = mod(v.w / 2 - cx * L.depth * v.k, want) - want - slack * res;
    let ly = mod(v.h / 2 - cy * L.depth * v.k, want) - want - slack * res;
    const flat = Math.abs(res - 1) < 0.001;
    if (flat) {
        lx = Math.round(lx);
        ly = Math.round(ly);
    }
    L.el.style.transform = flat
        ? `translate3d(${lx}px, ${ly}px, 0)`
        : `translate3d(${lx.toFixed(2)}px, ${ly.toFixed(2)}px, 0) scale(${res.toFixed(5)})`;
}

export interface Parallax {
    view: PView;
    move(x: number, y: number, k: number): void;
    resize(w: number, h: number): void;
    /** repaint every layer (after the layer list changed) */
    paint(): void;
}

/**
 * Drives a set of tiling layers plus one world layer from the menu's camera.
 * `layers()` returns the live layer list; `world()` the element that moves 1:1 with the nodes; `root()` the backdrop root
 * (its `.nf-tm` ancestor gets `data-pan` while the camera moves). `after` runs after each paint (extra layers, flags).
 */
export function createParallax(o: {
    layers: () => PLayer[];
    world: () => HTMLElement | null;
    root: () => HTMLElement | null;
    after?: (v: PView, settle: boolean) => void;
}): Parallax {
    const view: PView = { w: 0, h: 0, x: 0, y: 0, k: 1 };
    let timer = 0;
    let menu: HTMLElement | null = null;
    const paint = (settle = false) => {
        if (!view.w || !view.h) return;
        for (const L of o.layers()) paintLayer(L, view, settle);
        const w = o.world();
        if (w) w.style.transform = `translate3d(${view.x.toFixed(2)}px, ${view.y.toFixed(2)}px, 0) scale(${view.k.toFixed(4)})`;
        o.after?.(view, settle);
    };
    const settle = () => {
        timer = 0;
        if (menu) delete menu.dataset.pan;
        paint(true);
    };
    return {
        view,
        move(x, y, k) {
            const moved = x !== view.x || y !== view.y || k !== view.k;
            view.x = x;
            view.y = y;
            view.k = k;
            paint();
            if (!moved || typeof window === "undefined") return;
            if (!menu || !menu.isConnected) menu = o.root()?.closest<HTMLElement>(".nf-tm") ?? null;
            if (menu && menu.dataset.pan === undefined) menu.dataset.pan = "";
            if (timer) window.clearTimeout(timer);
            timer = window.setTimeout(settle, 180);
        },
        resize(w, h) {
            if (w === view.w && h === view.h) return;
            view.w = w;
            view.h = h;
            paint(true);
        },
        paint: () => paint(),
    };
}

/** A tiling layer spec for the grid backdrops (Lab, Firmware, Hangar): cell 0 = half a tree unit, glued to the nodes. */
export interface GridSpec {
    depth: number;
    zoom: number;
    cell: number;
    slack?: number;
}

/**
 * The camera handle shared by the grid backdrops. `els` is the ref array of layer elements (index = spec index).
 * Same shape as TreeBackdropHandle, so the tree menu drives any backdrop the same way.
 */
export function gridHandle(
    specs: GridSpec[],
    unit: number,
    els: { current: (HTMLElement | null)[] },
    world: { current: HTMLElement | null },
    root: { current: HTMLElement | null },
) {
    const ls: (PLayer | null)[] = specs.map(() => null);
    const px = createParallax({
        layers: () => {
            const out: PLayer[] = [];
            specs.forEach((sp, i) => {
                const el = els.current[i];
                if (!el) return;
                if (!ls[i] || ls[i]!.el !== el) ls[i] = { el, depth: sp.depth, zoom: sp.zoom, cell: sp.cell || unit / 2, slack: sp.slack ?? 0 };
                out.push(ls[i]!);
            });
            return out;
        },
        world: () => world.current,
        root: () => root.current,
    });
    return {
        move: px.move,
        resize: px.resize,
        focus(branch: string | null) {
            const r = root.current;
            if (!r) return;
            if (branch) r.dataset.focus = branch;
            else delete r.dataset.focus;
        },
    };
}
