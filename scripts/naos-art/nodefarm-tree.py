"""Node Farm prestige tree art: one dither sprite per node, the core, and the tree menu background.

Run:  python3 scripts/naos-art/nodefarm-tree.py
Output (public/naos/nodefarm/): tree-nodes.{png,webp}  (sheet of 32 px cells, 8 per row, cell = arm * 12 + slot, cell 60 = the core)
                                tree-bg.{png,webp}     (a 640 x 360 tile of dithered deep space, drawn 3 css px per pixel)
Palette PNGs. Node sheet: 0 clear, 1 dither (colour at 55%), 2 colour, 3 panel fill (colour at 16%), 4 highlight (colour lightened).
The sheet is neutral about owned or locked; the menu dims locked cells with CSS. Everything is procedural and original.
Cell order and colours must match ARMS in lib/nodefarm/engine.ts (signal, forge, systems, drones, anomaly; slot 11 and an11 are keystones).
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "public", "naos", "nodefarm")
BAYER = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) + 0.5) / 16.0
C = 32
COLS = 8
ARMS = [("signal", "#2fd8e8"), ("forge", "#ffc53a"), ("systems", "#6bffc9"), ("drones", "#ff4d6d"), ("anomaly", "#9a7bff")]


def rgb(h):
    return tuple(int(h[i : i + 2], 16) for i in (1, 3, 5))


def mix(a, b, t):
    return tuple(int(round(a[i] * (1 - t) + b[i] * t)) for i in range(3))


class Cell:
    def __init__(self):
        self.im = Image.new("P", (C, C), 0)
        self.d = ImageDraw.Draw(self.im)

    def p(self, x, y, i=4):
        if 0 <= x < C and 0 <= y < C:
            self.im.putpixel((x, y), i)

    def line(self, x0, y0, x1, y1, i=4):
        self.d.line([(x0, y0), (x1, y1)], fill=i)

    def rect(self, x0, y0, x1, y1, i=4, fill=False):
        (self.d.rectangle if fill else self.d.rectangle)([x0, y0, x1, y1], fill=i if fill else None, outline=i)

    def ell(self, x0, y0, x1, y1, i=4, fill=False):
        self.d.ellipse([x0, y0, x1, y1], fill=i if fill else None, outline=i)

    def poly(self, pts, i=4, fill=True):
        self.d.polygon(pts, fill=i if fill else None, outline=i)

    def arc(self, box, a0, a1, i=4):
        self.d.arc(box, a0, a1, fill=i)

    def dith(self, mask_fn, dens, i=1):
        for y in range(C):
            for x in range(C):
                if mask_fn(x, y) and dens(x, y) > BAYER[y % 4, x % 4]:
                    self.im.putpixel((x, y), i)


# ---------------------------------------------------------------- glyphs (drawn inside about 8..24)
def g_wave(c):
    pts = [(8 + x, 16 - int(round(5 * math.sin(x / 16 * math.tau)))) for x in range(17)]
    c.d.line(pts, fill=4, width=2)
    c.line(8, 21, 24, 21, 2)


def g_bars(c):
    for k, h in enumerate([4, 8, 6, 10, 7]):
        c.rect(8 + k * 4, 22 - h, 10 + k * 4, 22, 4, True)


def g_chev(c):
    for k in range(3):
        y = 10 + k * 5
        c.d.line([(9, y + 4), (16, y), (23, y + 4)], fill=4 if k == 0 else 2, width=2)


def g_coil(c):
    for k in range(4):
        c.arc([9, 7 + k * 4, 23, 13 + k * 4], 0, 180, 4)
        c.arc([9, 9 + k * 4, 23, 15 + k * 4], 180, 360, 2)


def g_bolt(c):
    c.poly([(18, 7), (11, 17), (16, 17), (14, 25), (22, 14), (17, 14)], 4)
    c.poly([(18, 7), (11, 17), (16, 17), (14, 25), (22, 14), (17, 14)], 2, False)


def g_cycle(c):
    c.arc([8, 8, 24, 24], 40, 300, 4)
    c.d.line([(8, 16), (6, 12), (11, 12)], fill=4)
    c.poly([(23, 12), (26, 17), (20, 17)], 4)


def g_stack(c):
    for k in range(3):
        y = 9 + k * 5
        c.poly([(16, y), (24, y + 3), (16, y + 6), (8, y + 3)], 4 if k == 0 else 2, True)
        c.poly([(16, y), (24, y + 3), (16, y + 6), (8, y + 3)], 3, False) if False else None


def g_gear(c):
    for a in range(8):
        t = a * math.pi / 4
        c.line(16 + int(round(6 * math.cos(t))), 16 + int(round(6 * math.sin(t))), 16 + int(round(9 * math.cos(t))), 16 + int(round(9 * math.sin(t))), 4)
    c.ell(10, 10, 22, 22, 4)
    c.ell(14, 14, 18, 18, 2, True)


def g_flame(c):
    c.poly([(16, 6), (22, 16), (20, 23), (12, 23), (10, 16), (14, 13)], 2)
    c.poly([(16, 12), (19, 18), (18, 23), (14, 23), (13, 18)], 4)


def g_crystal(c):
    c.poly([(16, 6), (22, 12), (22, 20), (16, 26), (10, 20), (10, 12)], 2)
    c.poly([(16, 6), (22, 12), (16, 15), (10, 12)], 4)
    c.line(16, 15, 16, 26, 3)


def g_flask(c):
    c.poly([(13, 7), (19, 7), (19, 13), (24, 23), (8, 23), (13, 13)], 2)
    c.rect(13, 7, 19, 9, 4, True)
    c.poly([(11, 19), (21, 19), (23, 23), (9, 23)], 4)


def g_vein(c):
    c.poly([(8, 22), (13, 10), (18, 16), (24, 8), (24, 22)], 2)
    c.d.line([(8, 22), (13, 10), (18, 16), (24, 8)], fill=4, width=2)


def g_anvil(c):
    c.poly([(7, 11), (25, 11), (22, 15), (18, 15), (18, 20), (22, 22), (10, 22), (14, 20), (14, 15), (10, 15)], 4)


def g_chip(c):
    c.rect(10, 10, 22, 22, 4, True)
    c.rect(13, 13, 19, 19, 3, True)
    for k in range(4):
        c.line(11 + k * 3, 7, 11 + k * 3, 9, 2)
        c.line(11 + k * 3, 23, 11 + k * 3, 25, 2)
        c.line(7, 11 + k * 3, 9, 11 + k * 3, 2)
        c.line(23, 11 + k * 3, 25, 11 + k * 3, 2)


def g_snow(c):
    for a in range(3):
        t = a * math.pi / 3
        c.line(16 - int(8 * math.cos(t)), 16 - int(8 * math.sin(t)), 16 + int(8 * math.cos(t)), 16 + int(8 * math.sin(t)), 4)
    c.ell(14, 14, 18, 18, 2, True)


def g_clock(c):
    c.ell(8, 8, 24, 24, 4)
    c.line(16, 16, 16, 10, 4)
    c.line(16, 16, 21, 18, 4)
    c.p(16, 8, 2)
    c.p(16, 24, 2)


def g_moon(c):
    c.ell(8, 8, 24, 24, 4, True)
    c.ell(12, 6, 28, 22, 3, True)


def g_hour(c):
    c.poly([(9, 7), (23, 7), (16, 16)], 4)
    c.poly([(9, 25), (23, 25), (16, 16)], 2)
    c.line(9, 7, 23, 7, 4)
    c.line(9, 25, 23, 25, 4)


def g_batt(c):
    c.rect(8, 11, 23, 21, 4)
    c.rect(24, 14, 26, 18, 4, True)
    for k in range(3):
        c.rect(10 + k * 4, 13, 12 + k * 4, 19, 2, True)


def g_key(c):
    c.ell(8, 11, 16, 19, 4)
    c.line(16, 15, 25, 15, 4)
    c.line(22, 15, 22, 19, 4)
    c.line(25, 15, 25, 18, 4)


def g_eye(c):
    c.poly([(6, 16), (16, 8), (26, 16), (16, 24)], 2, False)
    c.ell(12, 12, 20, 20, 4, True)
    c.ell(15, 15, 17, 17, 3, True)


def g_drone(c):
    c.rect(13, 13, 19, 19, 4, True)
    for dx, dy in [(-1, -1), (1, -1), (-1, 1), (1, 1)]:
        cx, cy = 16 + dx * 8, 16 + dy * 8
        c.line(16 + dx * 3, 16 + dy * 3, cx, cy, 2)
        c.ell(cx - 3, cy - 2, cx + 3, cy + 2, 4)


def g_wing(c):
    c.poly([(7, 21), (12, 9), (24, 7), (19, 13), (23, 14), (17, 19), (20, 22)], 4)
    c.line(9, 20, 21, 9, 3)


def g_hive(c):
    for cx, cy in [(16, 12), (11, 20), (21, 20)]:
        pts = [(cx + int(5 * math.cos(math.pi / 6 + k * math.pi / 3)), cy + int(5 * math.sin(math.pi / 6 + k * math.pi / 3))) for k in range(6)]
        c.poly(pts, 2)
        c.poly(pts, 4, False)


def g_wrench(c):
    c.d.line([(10, 22), (20, 12)], fill=4, width=3)
    c.ell(17, 6, 25, 14, 4)
    c.rect(21, 6, 25, 10, 3, True)


def g_target(c):
    c.ell(7, 7, 25, 25, 4)
    c.ell(11, 11, 21, 21, 2)
    c.ell(15, 15, 17, 17, 4, True)
    c.line(16, 5, 16, 9, 4)
    c.line(16, 23, 16, 27, 4)
    c.line(5, 16, 9, 16, 4)
    c.line(23, 16, 27, 16, 4)


def g_star(c):
    pts = []
    for k in range(10):
        r = 10 if k % 2 == 0 else 4
        t = -math.pi / 2 + k * math.pi / 5
        pts.append((16 + int(round(r * math.cos(t))), 16 + int(round(r * math.sin(t)))))
    c.poly(pts, 4)
    c.poly(pts, 2, False)


def g_arcs(c):
    for r in (4, 8, 12):
        c.arc([16 - r, 16 - r, 16 + r, 16 + r], 200, 340, 4 if r == 8 else 2)
    c.ell(15, 17, 17, 19, 4, True)


def g_ghost(c):
    c.poly([(9, 24), (9, 14), (12, 8), (20, 8), (23, 14), (23, 24), (20, 21), (16, 24), (12, 21)], 4)
    c.rect(12, 13, 14, 16, 3, True)
    c.rect(18, 13, 20, 16, 3, True)


def g_warn(c):
    c.poly([(16, 7), (25, 23), (7, 23)], 2, False)
    c.d.polygon([(16, 7), (25, 23), (7, 23)], outline=4)
    c.line(16, 13, 16, 18, 4)
    c.p(16, 20, 4)


def g_graph(c):
    pts = [(9, 10), (23, 9), (16, 17), (9, 23), (24, 23)]
    for a, b in [(0, 2), (1, 2), (2, 3), (2, 4)]:
        c.line(*pts[a], *pts[b], 2)
    for x, y in pts:
        c.ell(x - 2, y - 2, x + 2, y + 2, 4, True)


def g_lock(c):
    c.rect(9, 14, 23, 24, 4, True)
    c.arc([11, 6, 21, 20], 180, 360, 4)
    c.rect(15, 18, 17, 21, 3, True)


def g_disk(c):
    c.rect(8, 8, 24, 24, 4)
    c.rect(11, 8, 21, 13, 2, True)
    c.rect(12, 17, 20, 24, 4, True)


def g_bell(c):
    c.poly([(16, 7), (21, 10), (22, 19), (25, 22), (7, 22), (10, 19), (11, 10)], 4)
    c.rect(14, 23, 18, 25, 2, True)


def g_dice(c):
    c.rect(8, 8, 24, 24, 4)
    for x, y in [(12, 12), (20, 12), (16, 16), (12, 20), (20, 20)]:
        c.rect(x - 1, y - 1, x + 1, y + 1, 2, True)


def g_radar(c):
    c.ell(7, 7, 25, 25, 2)
    c.ell(11, 11, 21, 21, 2)
    c.poly([(16, 16), (24, 11), (24, 16)], 4)
    c.p(21, 20, 4)


def g_plus(c):
    c.rect(13, 8, 19, 24, 4, True)
    c.rect(8, 13, 24, 19, 4, True)


def g_tag(c):
    c.poly([(8, 8), (18, 8), (25, 16), (17, 24), (8, 15)], 4)
    c.ell(11, 11, 14, 14, 3, True)
    c.line(14, 20, 20, 14, 3)


def g_coin(c):
    c.ell(8, 8, 24, 24, 4)
    c.ell(11, 11, 21, 21, 2)
    c.rect(15, 12, 17, 20, 4, True)


def g_spiral(c):
    pts = []
    for k in range(60):
        r = 1 + k * 0.15
        t = k * 0.35
        pts.append((16 + int(round(r * math.cos(t))), 16 + int(round(r * math.sin(t)))))
    c.d.line(pts, fill=4, width=2)


def g_door(c):
    c.rect(9, 7, 23, 25, 4)
    c.rect(12, 10, 20, 25, 3, True)
    c.p(18, 17, 4)
    c.line(9, 25, 23, 25, 4)


def g_sword(c):
    c.d.line([(9, 23), (23, 9)], fill=4, width=2)
    c.line(9, 17, 15, 23, 2)
    c.line(21, 7, 25, 11, 2)


def g_slash(c):
    c.d.line([(10, 24), (22, 8)], fill=4, width=3)
    c.d.line([(8, 14), (16, 6)], fill=2, width=1)


def g_mask(c):
    c.poly([(8, 9), (24, 9), (23, 18), (16, 24), (9, 18)], 4)
    c.rect(11, 13, 14, 15, 3, True)
    c.rect(18, 13, 21, 15, 3, True)


def g_ring2(c):
    c.ell(8, 8, 24, 24, 4)
    c.ell(12, 12, 20, 20, 2)
    c.line(8, 16, 12, 16, 4)
    c.line(20, 16, 24, 16, 4)


# per node: (glyph, variant)  [variant 0 plain, 1 two pips above, 2 bar below]
GLYPHS = {
    "signal": [("wave", 0), ("bars", 0), ("clock", 1), ("tag", 0), ("cycle", 0), ("wave", 1), ("star", 0), ("tag", 2), ("arcs", 0), ("chev", 0), ("ring2", 1), ("slash", 2)],
    "forge": [("flame", 0), ("flask", 0), ("anvil", 0), ("crystal", 1), ("flask", 2), ("stack", 0), ("crystal", 0), ("snow", 0), ("vein", 0), ("vein", 1), ("hour", 0), ("gear", 2)],
    "systems": [("moon", 0), ("bolt", 0), ("clock", 0), ("batt", 0), ("star", 2), ("tag", 1), ("moon", 1), ("bolt", 1), ("disk", 0), ("key", 0), ("eye", 1), ("lock", 2)],
    "drones": [("wrench", 0), ("gear", 0), ("batt", 1), ("coil", 0), ("hive", 0), ("coin", 0), ("wing", 0), ("bolt", 2), ("moon", 2), ("hive", 1), ("drone", 1), ("drone", 2)],
    "anomaly": [("warn", 0), ("arcs", 1), ("eye", 0), ("ghost", 0), ("clock", 2), ("target", 0), ("radar", 0), ("dice", 0), ("spiral", 0), ("graph", 0), ("plus", 2), ("door", 2)],
}
G = {k[2:]: v for k, v in globals().items() if k.startswith("g_")}
KEYSTONES = {11, 10}  # slot 10 only in the anomaly arm (an11, Quiet room)


def kind_of(arm, slot):
    if slot == 11 or (arm == "anomaly" and slot == 10):
        return "keystone"
    return "notable" if slot in (4, 10) else "minor"


def frame(c, kind):
    cx = cy = 16
    if kind == "minor":
        c.ell(2, 2, 29, 29, 2)
        c.ell(3, 3, 28, 28, 3, True)
        c.dith(lambda x, y: (x - cx) ** 2 + (y - cy) ** 2 < 12 ** 2, lambda x, y: 0.5 * (1 - math.hypot(x - cx, y - cy) / 13), 1)
        c.ell(2, 2, 29, 29, 2)
    elif kind == "notable":
        pts = [(cx + int(round(14.5 * math.cos(math.pi / 8 + k * math.pi / 4))), cy + int(round(14.5 * math.sin(math.pi / 8 + k * math.pi / 4)))) for k in range(8)]
        c.poly(pts, 3)
        c.dith(lambda x, y: math.hypot(x - cx, y - cy) < 12, lambda x, y: 0.55 * (1 - math.hypot(x - cx, y - cy) / 13), 1)
        c.poly(pts, 2, False)
        c.poly([(cx + int(round(12.5 * math.cos(math.pi / 8 + k * math.pi / 4))), cy + int(round(12.5 * math.sin(math.pi / 8 + k * math.pi / 4)))) for k in range(8)], 2, False)
    else:
        pts = []
        for k in range(16):
            r = 15.5 if k % 2 == 0 else 10.5
            t = -math.pi / 2 + k * math.pi / 8
            pts.append((cx + int(round(r * math.cos(t))), cy + int(round(r * math.sin(t)))))
        c.poly(pts, 3)
        c.dith(lambda x, y: math.hypot(x - cx, y - cy) < 13, lambda x, y: 0.7 * (1 - math.hypot(x - cx, y - cy) / 14), 1)
        c.poly(pts, 2, False)
        c.ell(5, 5, 26, 26, 2)


def node_cell(arm, slot):
    g, v = GLYPHS[arm][slot]
    c = Cell()
    kind = kind_of(arm, slot)
    frame(c, kind)
    G[g](c)
    if v == 1:
        for x in (11, 20):
            c.rect(x, 4, x + 1, 5, 4, True)
    elif v == 2:
        c.rect(11, 27, 20, 27, 4, True)
    return c.im


def core_cell():
    c = Cell()
    cx = cy = 16
    pts = [(cx + int(round(15 * math.cos(k * math.pi / 3))), cy + int(round(15 * math.sin(k * math.pi / 3)))) for k in range(6)]
    c.poly(pts, 3)
    c.dith(lambda x, y: math.hypot(x - cx, y - cy) < 13, lambda x, y: 0.8 * (1 - math.hypot(x - cx, y - cy) / 14), 1)
    c.poly(pts, 2, False)
    c.ell(9, 9, 22, 22, 4)
    c.ell(13, 13, 18, 18, 4, True)
    c.line(16, 2, 16, 8, 2)
    c.line(16, 23, 16, 29, 2)
    return c.im


def palette(col):
    base = rgb(col)
    pal = [(0, 0, 0)] * 256
    pal[1] = mix((0, 0, 0), base, 0.55)
    pal[2] = base
    pal[3] = mix((8, 8, 8), base, 0.16)
    pal[4] = mix(base, (255, 255, 255), 0.55)
    return pal


def save(im, stem):
    im.save(os.path.join(OUT, stem + ".png"), optimize=True)
    im.save(os.path.join(OUT, stem + ".webp"), lossless=True, quality=100, method=6)


def sheet():
    # a single palette can't hold five colours at index 2, so the sheet is RGBA built from per-arm palettes
    n = 61
    rows = math.ceil(n / COLS)
    out = Image.new("RGBA", (COLS * C, rows * C), (0, 0, 0, 0))
    cells = []
    for ai, (arm, col) in enumerate(ARMS):
        for slot in range(12):
            cells.append((node_cell(arm, slot), col))
    cells.append((core_cell(), "#ffffff"))
    for i, (im, col) in enumerate(cells):
        pal = palette(col)
        a = np.asarray(im)
        rgba = np.zeros((C, C, 4), np.uint8)
        for idx in (1, 2, 3, 4):
            m = a == idx
            rgba[m, :3] = pal[idx]
            rgba[m, 3] = 255
        out.paste(Image.fromarray(rgba, "RGBA"), ((i % COLS) * C, (i // COLS) * C))
    save(out, "tree-nodes")
    return out


def background():
    W, H = 640, 360
    rng = np.random.default_rng(11)
    yy, xx = np.mgrid[0:H, 0:W]
    f = np.zeros((H, W))
    # periodic haze (tiles both ways): sums of sines with whole periods
    for k in range(7):
        fx, fy = rng.integers(1, 5), rng.integers(1, 4)
        ph = rng.uniform(0, math.tau, 2)
        f += np.sin(xx / W * math.tau * fx + ph[0]) * np.sin(yy / H * math.tau * fy + ph[1]) * rng.uniform(0.4, 1)
    f = (f - f.min()) / (f.max() - f.min())
    dens = np.clip((f - 0.45) * 1.1, 0, 0.5)
    th = np.tile(BAYER, (H // 4, W // 4))
    mask = dens > th
    stars = rng.random((H, W)) < 0.0035
    grid = ((xx % 80 == 0) & (yy % 2 == 0)) | ((yy % 80 == 0) & (xx % 2 == 0))
    idx = np.zeros((H, W), np.uint8)
    idx[mask] = 1
    idx[grid & ~stars] = np.where(mask[grid & ~stars], 1, 1)
    idx[stars] = 2
    im = Image.fromarray(idx, "P")
    pal = [(0, 0, 0)] * 256
    pal[1] = (38, 52, 66)
    pal[2] = (150, 200, 230)
    im.putpalette([c for p in pal for c in p])
    im.info["transparency"] = 0
    save(im, "tree-bg")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    sheet()
    background()
    print("ok")
