"""Generate the naOS 1-bit dithered art (original, procedural; no third-party art).

Run: python3 scripts/naos-art/generate.py
Output: public/naos/*.png (1-bit palette PNG, index 0 transparent, index 1 = ink #f4f4f2).
Each art pixel is drawn at 2 CSS px in the page (image-rendering: pixelated).
"""
import os
import numpy as np
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "naos")
INK = (244, 244, 242)

# 4x4 Bayer threshold matrix, normalised to (0, 1)
BAYER4 = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) + 0.5) / 16.0

# Face codes written into the ID buffer
TOP, LEFT, RIGHT, EDGE = 1, 2, 3, 4
BTOP, BLEFT, BRIGHT = 5, 6, 7  # built structures: solid top, brighter sides


def dither(intensity, ids):
    """intensity: float array 0..1, ids: face codes. Returns a bool ink mask."""
    h, w = intensity.shape
    tile = np.tile(BAYER4, (h // 4 + 1, w // 4 + 1))[:h, :w]
    ink = intensity > tile
    ink[ids == EDGE] = True
    ink[ids == 0] = False
    return ink


def save_1bit(ink, path):
    idx = ink.astype(np.uint8)
    img = Image.fromarray(idx, "P")
    pal = [0, 0, 0] + list(INK) + [0] * (256 - 2) * 3
    img.putpalette(pal[: 256 * 3])
    img.save(path, transparency=0, optimize=True)
    print("wrote", os.path.normpath(path), img.size, os.path.getsize(path), "bytes")


# ---------------------------------------------------------------------------------------------
# 1. Floating voxel islands (hero). Isometric columns, painter order, dithered shading.
# ---------------------------------------------------------------------------------------------
def islands():
    W, H = 300, 200
    CW, CH, VH = 5.0, 2.6, 3.2
    ox, oy = W / 2 - 10, 46.0
    ids_img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(ids_img)

    def P(x, y, z):
        return (ox + (x - y) * CW, oy + (x + y) * CH - z * VH)

    # Two islands: a large one and a smaller one higher and to the right (Fractured Islands echo).
    islands_def = [
        dict(cx=19, cy=19, r=12.0, top=6, base=-11, lift=0, dx=0, dy=0,
             # (x0, y0, w, h, extra height): a house, a tower and two trees on the big island.
             boxes=[(14, 15, 3, 2, 3), (25, 23, 1, 1, 8), (11, 24, 1, 1, 2), (24, 11, 1, 1, 2)]),
        dict(cx=10, cy=10, r=5.0, top=3, base=-4, lift=9, dx=0, dy=0,
             boxes=[(9, 9, 2, 1, 2)]),
    ]
    cols = []
    for isl in islands_def:
        cx, cy, R = isl["cx"], isl["cy"], isl["r"]
        extra = {}
        for x0, y0, w, h, eh in isl.get("boxes", []):
            for x in range(x0, x0 + w):
                for y in range(y0, y0 + h):
                    extra[(x, y)] = eh
        for x in range(0, 44):
            for y in range(0, 44):
                dx, dy = x - cx, y - cy
                r = (dx * dx + dy * dy) ** 0.5 / R
                if r >= 1.0:
                    continue
                # Terraced top: integer steps so every layer reads as a ledge.
                ztop = int(round(isl["top"] * (1 - r * r) ** 0.6))
                zbase = int(round(isl["base"] * (1 - r) ** 1.4))
                zbase = min(zbase, ztop - 1)
                zb, zt = zbase + isl["lift"], ztop + isl["lift"]
                cols.append((x, y, zb, zt, r, False))
                if (x, y) in extra:
                    cols.append((x, y, zt, zt + extra[(x, y)], r, True))

    cols.sort(key=lambda c: (c[0] + c[1], c[3]))
    for x, y, zb, zt, _, boxed in cols:
        # Side faces first (they sit under the top), then the top face.
        # Right face (+x side) and left face (+y side), running from the base to the top.
        rc, lc, tc = (BRIGHT, BLEFT, BTOP) if boxed else (RIGHT, LEFT, TOP)
        if zt > zb:
            d.polygon([P(x + 1, y, zb), P(x + 1, y + 1, zb), P(x + 1, y + 1, zt), P(x + 1, y, zt)], fill=rc)
            d.polygon([P(x, y + 1, zb), P(x + 1, y + 1, zb), P(x + 1, y + 1, zt), P(x, y + 1, zt)], fill=lc)
        top = [P(x, y, zt), P(x + 1, y, zt), P(x + 1, y + 1, zt), P(x, y + 1, zt)]
        d.polygon(top, fill=tc)
        if boxed:
            d.line(top + [top[0]], fill=EDGE, width=1)

    arr = np.array(ids_img)
    yy, xx = np.mgrid[0:H, 0:W]
    # Shade by face. Tops get a radial falloff so the dither reads as a light source from above-left.
    lx, ly = W * 0.42, H * 0.36
    dist = np.sqrt(((xx - lx) / (W * 0.55)) ** 2 + ((yy - ly) / (H * 0.6)) ** 2)
    inten = np.zeros((H, W))
    inten[arr == TOP] = np.clip(0.62 - 0.5 * dist, 0.08, 0.62)[arr == TOP]
    inten[arr == LEFT] = 0.46
    inten[arr == RIGHT] = 0.2
    inten[arr == BTOP] = 1.0          # solid white roofs read as blocks, like the ctOS title cards
    inten[arr == BLEFT] = 0.72
    inten[arr == BRIGHT] = 0.42
    ink = dither(inten, arr)
    return ink


# ---------------------------------------------------------------------------------------------
# 2. Lane track (section break). Top-down stadium, lanes as dither bands, finish tape.
# ---------------------------------------------------------------------------------------------
# 4. Assembly field (Creations hub backdrop). A dithered floor grid, a solid stepped build, two blocks still floating
#    above the floor on dotted drop lines, and two wireframe placeholders that are not built yet. Same isometric
#    projection and dither as the islands, so the set reads as one system.
# ---------------------------------------------------------------------------------------------
FLOOR = 8  # floor tile: top face only, very low ink


def assembly():
    W, H = 280, 170
    CW, CH, VH = 7.2, 3.6, 4.6
    ox, oy = W / 2, 22.0
    ids_img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(ids_img)
    inten_pts = []  # reserved for clarity; intensity is set per face code below

    def P(x, y, z):
        return (ox + (x - y) * CW, oy + (x + y) * CH - z * VH)

    def cube(x, y, z0, z1, kind):
        """Solid unit box from z0 to z1 (kind: FLOOR, TOP or BTOP). Painter order is handled by the caller's sort."""
        if kind == FLOOR:
            top = [P(x, y, z1), P(x + 1, y, z1), P(x + 1, y + 1, z1), P(x, y + 1, z1)]
            d.polygon(top, fill=FLOOR)
            return
        rc, lc, tc = (BRIGHT, BLEFT, BTOP) if kind == BTOP else (RIGHT, LEFT, TOP)
        d.polygon([P(x + 1, y, z0), P(x + 1, y + 1, z0), P(x + 1, y + 1, z1), P(x + 1, y, z1)], fill=rc)
        d.polygon([P(x, y + 1, z0), P(x + 1, y + 1, z0), P(x + 1, y + 1, z1), P(x, y + 1, z1)], fill=lc)
        top = [P(x, y, z1), P(x + 1, y, z1), P(x + 1, y + 1, z1), P(x, y + 1, z1)]
        d.polygon(top, fill=tc)
        d.line(top + [top[0]], fill=EDGE, width=1)

    def dashed(a, b, step=3):
        (x0, y0), (x1, y1) = a, b
        n = int(max(abs(x1 - x0), abs(y1 - y0)))
        for i in range(0, n + 1, step):
            t = i / max(1, n)
            d.point((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t), fill=EDGE)
            d.point((x0 + (x1 - x0) * t + 1, y0 + (y1 - y0) * t), fill=EDGE)

    def outline(x, y, z0, z1):
        """Wireframe placeholder: only the edges, nothing filled."""
        b = [P(x, y, z1), P(x + 1, y, z1), P(x + 1, y + 1, z1), P(x, y + 1, z1)]
        d.line(b + [b[0]], fill=EDGE, width=1)
        for cx, cy in [(x + 1, y), (x + 1, y + 1), (x, y + 1)]:
            d.line([P(cx, cy, z0), P(cx, cy, z1)], fill=EDGE, width=1)
        d.line([P(x + 1, y, z0), P(x + 1, y + 1, z0), P(x, y + 1, z0)], fill=EDGE, width=1)

    # 1) floor grid: flat tiles, painter order by x+y
    cells = [(x, y) for x in range(12) for y in range(12)]
    for x, y in sorted(cells, key=lambda c: c[0] + c[1]):
        cube(x, y, -1, 0, FLOOR)
    # grid seams every 7 tiles so the floor reads as a plan, not a blank plane
    for k in (0, 6, 12):
        d.line([P(k, 0, 0), P(k, 12, 0)], fill=EDGE, width=1)
        d.line([P(0, k, 0), P(12, k, 0)], fill=EDGE, width=1)

    # 2) the solid build: a stepped stack (three tiers) in the right half
    solid = []
    for x in range(8, 12):
        for y in range(5, 9):
            solid.append((x, y, 0, 1, BTOP))
    for x in range(9, 11):
        for y in range(6, 8):
            solid.append((x, y, 1, 2, BTOP))
    solid.append((9, 6, 2, 3, BTOP))
    # 3) two pieces still floating above the floor, on dotted drop lines
    floating = [(4, 10, 4, 5), (11, 11, 3, 4)]
    # 4) wireframe placeholders: planned, not built
    planned = [(2, 2, 0, 3), (5, 2, 0, 2)]

    for x, y, z0, z1 in planned:
        outline(x, y, z0, z1)
    for x, y, z0, z1 in floating:
        dashed(P(x + 0.5, y + 0.5, 0), P(x + 0.5, y + 0.5, z0))
    items = [(x + y, z0, x, y, z0, z1, BTOP) for x, y, z0, z1, _ in solid] + [
        (x + y, z0, x, y, z0, z1, TOP) for x, y, z0, z1 in floating
    ]
    for _, _, x, y, z0, z1, kind in sorted(items, key=lambda t: (t[0], t[1])):
        cube(x, y, z0, z1, kind)

    arr = np.array(ids_img)
    yy, xx = np.mgrid[0:H, 0:W]
    lx, ly = W * 0.6, H * 0.3
    dist = np.sqrt(((xx - lx) / (W * 0.6)) ** 2 + ((yy - ly) / (H * 0.7)) ** 2)
    inten = np.zeros((H, W))
    inten[arr == FLOOR] = 0.10
    inten[arr == TOP] = np.clip(0.55 - 0.4 * dist, 0.1, 0.55)[arr == TOP]
    inten[arr == LEFT] = 0.42
    inten[arr == RIGHT] = 0.18
    inten[arr == BTOP] = 1.0
    inten[arr == BLEFT] = 0.7
    inten[arr == BRIGHT] = 0.4
    ink = dither(inten, arr)
    # Fill the floor tiles with a sparse dot lattice so the plan reads even though the floor is so dim.
    yy2, xx2 = np.mgrid[0:H, 0:W]
    lattice = (xx2 % 6 == 0) & (yy2 % 6 == 0) & (arr == FLOOR)
    ink[lattice] = True
    return ink


# 9. Full-bleed page backdrops, one per page. A dithered topographic field: a fractal height map lit from
#    the upper left, with solid contour lines that fade into the dither. Ink is pushed toward one side of the
#    frame (the side without body copy), so the reading column stays clear. Placed by <NaosBackdrop>.
# ---------------------------------------------------------------------------------------------
BG_W, BG_H = 720, 480  # drawn at 2 css px per art pixel on desktop; covers the whole page


def _fractal(rng, W, H, octaves=5, base=3):
    h = np.zeros((H, W))
    amp, cells = 1.0, base
    for _ in range(octaves):
        g = rng.random((cells + 1, cells + 1))
        img = Image.fromarray((g * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
        h += amp * (np.asarray(img, dtype=float) / 255.0)
        amp *= 0.5
        cells *= 2
    return (h - h.min()) / (h.max() - h.min())


def _shape(h, style, steps):
    """Turn the fractal height map into one of three landforms, so pages differ in more than their seed."""
    if style == "ridge":                     # sharp crests, like a folded range
        h = 1 - np.abs(2 * h - 1)
        return (h - h.min()) / (h.max() - h.min())
    if style == "terrace":                   # flat plateaus with thin risers, the voxel stepping in smooth form
        q = np.floor(h * steps)
        frac = h * steps - q
        h = (q + 0.12 * frac) / steps
        return (h - h.min()) / (h.max() - h.min())
    return h                                 # "terrain": the rolling default


def backdrop(seed, side="right", base=3, contours=12, style="terrain", angle=135, steps=6, cover=0.3):
    rng = np.random.default_rng(seed)
    h = _shape(_fractal(rng, BG_W, BG_H, base=base), style, steps)
    gy, gx = np.gradient(h)
    t = np.deg2rad(angle)                    # light direction; 135 is the upper left
    slope = -(gx * np.cos(t) + gy * np.sin(t))
    slope = slope / (np.percentile(np.abs(slope), 98) + 1e-9)
    # Lit slopes carry the dither, shadowed slopes stay mostly empty, so the field reads as light on terrain.
    if style == "terrace":                   # flat tops take a light dither; the risers catch the most light
        inten = 0.14 + np.clip(slope, 0, 1) ** 1.2 * 0.8
    else:
        inten = np.clip(0.5 + 0.5 * slope, 0, 1) ** 2 * 0.8

    # Ink reaches across the whole frame; the open side is denser so the copy side stays calmer.
    xn = np.linspace(0, 1, BG_W)[None, :].repeat(BG_H, 0)
    yn = np.linspace(0, 1, BG_H)[:, None].repeat(BG_W, 1)
    if side == "left":
        xn = 1 - xn
    keep = cover + (1 - cover) * np.clip(0.25 + 0.75 * (0.8 * xn + 0.45 * yn), 0, 1) ** 1.4

    # Contour lines: a band edge wherever the quantised height changes between neighbours.
    band = np.floor(h * contours)
    edge = (band != np.roll(band, 1, axis=1)) | (band != np.roll(band, 1, axis=0))
    edge_ink = edge & (keep > rng.random((BG_H, BG_W)))

    ids = np.ones((BG_H, BG_W), dtype=np.uint8)
    field = dither(inten * keep, ids)
    return field | edge_ink


# One unique look per page: its own seed, landform, light and side. Subpages reuse their section's piece.
BACKDROPS = {
    "home": dict(seed=11, side="right", base=3, contours=7, style="terrain", angle=135),
    "studies": dict(seed=23, side="right", base=3, contours=8, style="terrace", steps=7, angle=120),
    "about": dict(seed=37, side="right", base=4, contours=8, style="ridge", angle=200),
    "history": dict(seed=41, side="right", base=5, contours=10, style="terrain", angle=60),
    "timeline": dict(seed=53, side="right", base=2, contours=5, style="terrace", steps=5, angle=225),
    "blog": dict(seed=67, side="right", base=5, contours=6, style="ridge", angle=300),
    "games": dict(seed=79, side="right", base=2, contours=12, style="terrain", angle=45),
    "default": dict(seed=97, side="right", base=3, contours=7, style="terrain", angle=110),
}


# ---------------------------------------------------------------------------------------------
# 5. Header bands and section washes. A track-shaped band sits behind a page title; a wash is a
#    dither gradient that fades across a section. Both are 1-bit, original, and placed by CSS (app/camino).
# ---------------------------------------------------------------------------------------------
BAND_W, BAND_H = 480, 96   # drawn at 2 css px per art pixel on desktop


def band(seed, variant="track", W=BAND_W, H=BAND_H):
    """A stadium-shaped dither band. Variants: 'track' (dense left, solid outline), 'rail' (dense left, tick marks
    along the top and bottom), 'seam' (ramp from the right, with contour lines)."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    r = H / 2.0
    cy = H / 2.0 - 0.5
    cx = np.clip(xx, r, W - r - 1)
    d = np.hypot(xx - cx, yy - cy)
    inside = d <= r - 2.5
    outline = (d <= r - 0.5) & (d > r - 2.0)
    h = _fractal(rng, W, H, base=4, octaves=4)
    t = xx / (W - 1)
    ids = np.ones((H, W), dtype=np.uint8)
    if variant == "seam":
        dens = 0.1 + 0.9 * t ** 0.9
    else:
        dens = (1.0 - t) ** 0.8          # a smooth ramp: dense on the left, gone by the right end
    lit = np.clip(0.2 + 0.8 * h, 0, 1) ** 1.4 * dens
    ink = dither(lit, ids) & inside
    bands = np.floor(h * (10 if variant == "seam" else 9))
    edge = (bands != np.roll(bands, 1, axis=1)) | (bands != np.roll(bands, 1, axis=0))
    ink |= edge & inside & (dens > rng.random((H, W)))   # contours thin out with the ramp, no hard cut
    if variant == "rail":
        ink |= inside & (xx % 12 == 0) & (np.abs(yy - cy) > r * 0.55)
    else:
        ink |= outline
    return ink


def section_wash(seed, angle=90, W=360, H=240, base=3):
    """A dither gradient: dense on the side the angle points away from, empty at the far edge. 90 is dense at
    the top, 270 at the bottom, 180 at the right, 0 at the left."""
    rng = np.random.default_rng(seed)
    h = _fractal(rng, W, H, base=base, octaves=4)
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    t = np.deg2rad(angle)
    p = (xx / (W - 1) - 0.5) * np.cos(t) + (yy / (H - 1) - 0.5) * np.sin(t)
    p = (p - p.min()) / (p.max() - p.min())   # 0 on the dense side, 1 on the far side
    dens = (1 - p) ** 1.7
    inten = np.clip(0.25 + 0.75 * h, 0, 1) * dens * 0.85
    return dither(inten, np.ones((H, W), dtype=np.uint8))


# ---------------------------------------------------------------------------------------------
# Registry. Every committed piece is listed here, so `python3 generate.py` rebuilds the whole set and
# `python3 generate.py bg-home band-track` rebuilds just those. Each piece is written as a 1-bit PNG and
# a lossless WebP (pixel-identical, about 15 to 20 percent smaller); pages point at the WebP.
# ---------------------------------------------------------------------------------------------
PIECES = {
    "islands": (islands, {}),
    "assembly": (assembly, {}),
    **{f"bg-{name}": (backdrop, cfg) for name, cfg in BACKDROPS.items()},
    "band-track": (band, dict(seed=101, variant="track")),
    "band-rail": (band, dict(seed=113, variant="rail")),
    "band-seam": (band, dict(seed=127, variant="seam")),
    "wash-a": (section_wash, dict(seed=201, angle=90)),
    "wash-b": (section_wash, dict(seed=213, angle=45)),
    "wash-c": (section_wash, dict(seed=227, angle=270)),
    "wash-d": (section_wash, dict(seed=239, angle=180)),
}


def save_webp(png_path):
    Image.open(png_path).convert("RGBA").save(png_path[:-4] + ".webp", lossless=True, quality=100, method=6)
    print("wrote", os.path.normpath(png_path[:-4] + ".webp"))


def build(names=None):
    os.makedirs(OUT, exist_ok=True)
    for name, (fn, kwargs) in PIECES.items():
        if names and name not in names:
            continue
        png = os.path.join(OUT, f"{name}.png")
        save_1bit(fn(**kwargs), png)
        save_webp(png)


if __name__ == "__main__":
    import sys
    unknown = [a for a in sys.argv[1:] if a not in PIECES]
    if unknown:
        raise SystemExit(f"unknown piece(s): {', '.join(unknown)}; known: {', '.join(PIECES)}")
    build(sys.argv[1:] or None)
