"""Node Farm era scenery: one original dithered landscape per era, plus the Ascend piece.

Run:  python3 scripts/naos-art/nodefarm-scenes.py                (all)
      python3 scripts/naos-art/nodefarm-scenes.py 3 ascend d3    (just those; dN = the close-up for era N)
Output: public/naos/nodefarm/scene-<n>.{png,webp} (n = 0..8, era order below), scene-ascend.{png,webp}, and detail-<n> (360 x 144
close-ups for the scene window).

Each file is 480 x 270 art pixels, drawn at 3 css px (2 on phones) with image-rendering: pixelated. Palette PNG:
index 0 transparent, 1 = the era colour at 55 percent, 2 = the era colour. Dither fills use index 1, solid lines and
lit pixels use index 2. Every piece repeats sideways without a seam (ground and haze are periodic, shapes stay inside
the tile), so the page can tile it across a wide board. Everything is procedural; nothing is traced or borrowed.
Reuses the Bayer dither and fractal helpers from generate.py.
"""
import importlib.util
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "public", "naos", "nodefarm")
_spec = importlib.util.spec_from_file_location("naos_generate", os.path.join(HERE, "generate.py"))
gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gen)

W, H = 480, 270
HOR = 188  # horizon row

# Era order = order the chain opens. Colours are the stat colours in lib/nodefarm/engine.ts.
ERAS = [
    ("uplink", "#2fd8e8"),     # 0 Bytes, Multipliers
    ("foundry", "#f08a3c"),    # 1 Reboots, Copper
    ("wafer", "#7aa2ff"),      # 2 Silicon
    ("lattice", "#e08cff"),    # 3 Quartz
    ("aurora", "#6bffc9"),     # 4 Aether
    ("monolith", "#ffc53a"),   # 5 Runes
    ("glass", "#bfeaff"),      # 6 Starglass
    ("eclipse", "#9a7bff"),    # 7 Voidsteel
    ("clockwork", "#ff7a4a"),  # 8 Chrono
]
ASCEND = ("ascend", "#ff2d8a")


def rgb(h):
    return tuple(int(h[i : i + 2], 16) for i in (1, 3, 5))


class Canvas:
    """f = dither density (0..255), s = solid lit pixels. Shapes are opaque: they overwrite what is behind them."""

    def __init__(self, seed):
        self.rng = np.random.default_rng(seed)
        self.f = Image.new("L", (W, H), 0)
        self.s = Image.new("L", (W, H), 0)
        self.df = ImageDraw.Draw(self.f)
        self.ds = ImageDraw.Draw(self.s)

    # -- atmosphere ---------------------------------------------------------------------------
    def haze(self, top=0.0, bottom=0.3, power=2.0, y1=HOR):
        a = np.asarray(self.f, dtype=float) / 255
        y = np.arange(H)[:, None] / y1
        a = np.maximum(a, np.clip(top + (bottom - top) * np.clip(y, 0, 1) ** power, 0, 1).repeat(W, 1))
        self.f = Image.fromarray((a * 255).astype(np.uint8))
        self.df = ImageDraw.Draw(self.f)

    def stars(self, n, sparkle=0):
        for _ in range(n):
            x, y = int(self.rng.integers(3, W - 3)), int(self.rng.integers(3, HOR - 20))
            self.ds.point((x, y), fill=255)
        for _ in range(sparkle):
            x, y = int(self.rng.integers(8, W - 8)), int(self.rng.integers(8, HOR - 40))
            r = int(self.rng.integers(2, 5))
            self.ds.line([(x - r, y), (x + r, y)], fill=255)
            self.ds.line([(x, y - r), (x, y + r)], fill=255)

    def ground(self, fn, top=0.55, bottom=0.12, scan=0):
        """Everything below fn(x) is ground: dithered, fading downward, with a solid skyline edge."""
        f = np.asarray(self.f, dtype=float) / 255
        s = np.asarray(self.s).copy()
        for x in range(W):
            g = int(round(fn(x)))
            span = max(1, H - g)
            for y in range(max(g, 0), H):
                f[y, x] = top + (bottom - top) * ((y - g) / span) ** 0.8
                s[y, x] = 0
            if 0 <= g < H:
                s[g, x] = 255
        if scan:
            s[HOR + 20 :: scan, :] = np.maximum(s[HOR + 20 :: scan, :], 0)
        self.f = Image.fromarray((f * 255).astype(np.uint8))
        self.s = Image.fromarray(s.astype(np.uint8))
        self.df, self.ds = ImageDraw.Draw(self.f), ImageDraw.Draw(self.s)

    # -- shapes -------------------------------------------------------------------------------
    def poly(self, pts, dens, edge=True):
        pts = [(float(x), float(y)) for x, y in pts]
        self.df.polygon(pts, fill=int(dens * 255))
        self.ds.polygon(pts, fill=0)
        if edge:
            self.ds.line(pts + [pts[0]], fill=255, width=1)

    def rect(self, x0, y0, x1, y1, dens, edge=True):
        self.poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], dens, edge)

    def ellipse(self, box, dens, edge=True):
        self.df.ellipse(box, fill=int(dens * 255))
        self.ds.ellipse(box, fill=0)
        if edge:
            self.ds.ellipse(box, outline=255)

    def line(self, pts, w=1):
        self.ds.line([(float(x), float(y)) for x, y in pts], fill=255, width=w)

    def dot(self, x, y):
        if 0 <= x < W and 0 <= y < H:
            self.ds.point((int(x), int(y)), fill=255)

    def radial(self, cx, cy, r0, r1, peak=0.45, power=1.6):
        """A dithered halo: dense at r0, gone at r1."""
        a = np.asarray(self.f, dtype=float) / 255
        yy, xx = np.mgrid[0:H, 0:W]
        d = np.hypot(xx - cx, yy - cy)
        k = np.clip(1 - (d - r0) / max(1, r1 - r0), 0, 1) ** power * peak
        k[d < r0] = 0
        self.f = Image.fromarray((np.maximum(a, k) * 255).astype(np.uint8))
        self.df = ImageDraw.Draw(self.f)

    def save(self, name, color):
        f = np.asarray(self.f, dtype=float) / 255
        lo = gen.dither(f, np.ones((H, W), dtype=np.uint8))
        hi = np.asarray(self.s) > 0
        idx = np.zeros((H, W), dtype=np.uint8)
        idx[lo] = 1
        idx[hi] = 2
        img = Image.fromarray(idx, "P")
        c = rgb(color)
        dim = tuple(int(v * 0.55) for v in c)
        img.putpalette(([0, 0, 0] + list(dim) + list(c) + [0] * 3 * 253)[: 256 * 3])
        for ext, kw in (("png", dict(transparency=0, optimize=True)),):
            p = os.path.join(OUT, f"{name}.{ext}")
            img.save(p, **kw)
        rgba = Image.open(os.path.join(OUT, f"{name}.png")).convert("RGBA")
        rgba.save(os.path.join(OUT, f"{name}.webp"), lossless=True, quality=100, method=6)
        print("wrote", name, os.path.getsize(os.path.join(OUT, f"{name}.webp")), "bytes (webp)")


def hills(seed, amp=7):
    """A periodic skyline: whole numbers of cycles across the tile, so the edges meet."""
    r = np.random.default_rng(seed)
    ph = r.random(4) * 6.28
    return lambda x: HOR + amp * np.sin(2 * np.pi * 2 * x / W + ph[0]) + amp * 0.5 * np.sin(2 * np.pi * 5 * x / W + ph[1]) + amp * 0.25 * np.sin(2 * np.pi * 11 * x / W + ph[2])


# ---------------------------------------------------------------------------------------------
# 0. Uplink: server racks standing like a city, windows lit, data falling between them.
# ---------------------------------------------------------------------------------------------
def uplink():
    c = Canvas(1)
    r = c.rng
    c.haze(0.0, 0.28, 2.2)
    for x in r.integers(6, W - 6, 46):                       # data streams
        y0, ln = int(r.integers(8, 120)), int(r.integers(14, 60))
        for y in range(y0, y0 + ln, 3):
            c.dot(x, y)
    g = hills(11, 3)
    for layer, (dens, n, hmin, hmax, wins) in enumerate([(0.16, 18, 30, 80, False), (0.34, 15, 40, 120, True)]):
        x = 6
        while x < W - 30:
            w = int(r.integers(14, 30))
            h = int(r.integers(hmin, hmax))
            b = int(g(x + w / 2)) + 3
            c.rect(x, b - h, x + w, b, dens, edge=layer == 1)
            if wins:
                for wy in range(b - h + 5, b - 6, 5):
                    for wx in range(x + 3, x + w - 3, 4):
                        if r.random() < 0.42:
                            c.dot(wx, wy)
                if r.random() < 0.5:                         # antenna
                    ax = x + w // 2
                    c.line([(ax, b - h), (ax, b - h - int(r.integers(8, 22)))])
                    c.dot(ax, b - h - 24)
            x += w + int(r.integers(2, 9))
    c.ground(g, 0.5, 0.1)
    for gx in range(10, W - 10, 24):                         # floor tiles: short lit seams
        c.line([(gx, HOR + 10 + (gx // 24 % 3) * 6), (gx + 8, HOR + 10 + (gx // 24 % 3) * 6)])
    return c


# ---------------------------------------------------------------------------------------------
# 1. Foundry: chimneys and pipework, smoke drifting up, circuit traces across the ground.
# ---------------------------------------------------------------------------------------------
def foundry():
    c = Canvas(2)
    r = c.rng
    c.haze(0.02, 0.3, 1.8)
    g = hills(12, 2)
    xs = [28, 92, 160, 236, 306, 372, 436]
    for i, x in enumerate(xs):
        h = int(r.integers(70, 130))
        w = int(r.integers(12, 19))
        b = int(g(x)) + 3
        c.poly([(x - w, b), (x - w + 3, b - h), (x + w - 3, b - h), (x + w, b)], 0.38)
        for by in range(b - h + 10, b - 4, 11):             # bands
            c.line([(x - w + 2, by), (x + w - 2, by)])
        c.rect(x - w + 1, b - h - 5, x + w - 1, b - h, 0.7)
        for k in range(4):                                   # smoke puffs, fading as they rise
            px, py, pr = x + 6 * k + int(r.integers(-3, 4)), b - h - 14 - 20 * k, 6 + 4 * k
            c.ellipse((px - pr, py - pr, px + pr, py + pr), max(0.05, 0.42 - 0.1 * k), edge=False)
    for x0, x1 in zip(xs[:-1], xs[1:]):                      # pipes between the stacks
        py = int(r.integers(150, 168))
        c.rect(x0 + 10, py, x1 - 10, py + 6, 0.5)
        for jx in range(x0 + 20, x1 - 14, 18):
            c.line([(jx, py - 2), (jx, py + 8)])
    c.ground(g, 0.5, 0.1)
    for _ in range(11):                                      # circuit traces, right angles with vias
        x, y = int(r.integers(8, W - 8)), int(r.integers(HOR + 12, H - 10))
        pts = [(x, y)]
        for _k in range(3):
            if _k % 2 == 0:
                x = int(np.clip(x + r.integers(-60, 60), 6, W - 6))
            else:
                y = int(np.clip(y + r.integers(-14, 14), HOR + 8, H - 6))
            pts.append((x, y))
        c.line(pts)
        c.ellipse((x - 2, y - 2, x + 2, y + 2), 0.0)
    for _ in range(36):                                      # sparks
        c.dot(int(r.integers(4, W - 4)), int(r.integers(60, HOR)))
    return c


# ---------------------------------------------------------------------------------------------
# 2. Wafer: a gridded disc rising like a moon, packages with pins along the ground.
# ---------------------------------------------------------------------------------------------
def wafer():
    c = Canvas(3)
    r = c.rng
    c.haze(0.0, 0.22, 2.0)
    cx, cy, R = 240, 118, 78
    c.radial(cx, cy, R, R + 40, 0.3)
    c.ellipse((cx - R, cy - R, cx + R, cy + R), 0.22)
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).ellipse((cx - R + 3, cy - R + 3, cx + R - 3, cy + R - 3), fill=255)
    grid = Image.new("L", (W, H), 0)
    dg = ImageDraw.Draw(grid)
    for gx in range(cx - R, cx + R, 13):
        dg.line([(gx, cy - R), (gx, cy + R)], fill=255)
    for gy in range(cy - R, cy + R, 11):
        dg.line([(gx0 := cx - R, gy), (cx + R, gy)], fill=255)
    for _ in range(40):                                      # lit dice
        gx = cx - R + 13 * int(r.integers(0, 2 * R // 13))
        gy = cy - R + 11 * int(r.integers(0, 2 * R // 11))
        dg.rectangle((gx + 2, gy + 2, gx + 10, gy + 8), fill=255)
    self_s = np.asarray(c.s).copy()
    self_s = np.maximum(self_s, (np.asarray(grid) > 0) & (np.asarray(mask) > 0)).astype(np.uint8) * 255
    c.s = Image.fromarray(self_s)
    c.ds = ImageDraw.Draw(c.s)
    c.ds.pieslice((cx - 14, cy + R - 14, cx + 14, cy + R + 14), 180, 360, fill=0)  # the flat notch
    g = hills(13, 2)
    c.ground(g, 0.55, 0.1)
    x = 8
    while x < W - 44:                                        # IC packages, pins on both sides
        w, h = int(r.integers(22, 42)), int(r.integers(9, 15))
        y = HOR + 8 + int(r.integers(0, 40))
        c.rect(x, y, x + w, y + h, 0.3)
        for px in range(x + 3, x + w - 2, 4):
            c.line([(px, y - 3), (px, y)])
            c.line([(px, y + h), (px, y + h + 3)])
        c.dot(x + 3, y + 3)
        x += w + int(r.integers(6, 22))
    return c


# ---------------------------------------------------------------------------------------------
# 3. Lattice: quartz spires in clusters, floating chips of crystal.
# ---------------------------------------------------------------------------------------------
def lattice():
    c = Canvas(4)
    r = c.rng
    c.haze(0.0, 0.26, 2.0)
    c.stars(50)
    g = hills(14, 3)

    def spire(x, h, w, lean, dens_l=0.22, dens_r=0.68):
        b = int(g(x)) + 4
        tip = (x + lean, b - h)
        c.poly([(x - w, b), (x - w, b - h * 0.68), tip, (x, b)], dens_l)
        c.poly([(x, b), tip, (x + w, b - h * 0.68), (x + w, b)], dens_r)
        c.line([tip, (x, b - h * 0.62)])

    for cluster in (44, 130, 222, 318, 408):
        for k, (dx, h, w) in enumerate([(0, 120, 12), (-18, 78, 9), (17, 94, 10), (-32, 44, 7), (30, 52, 7)]):
            spire(cluster + dx, h * float(r.uniform(0.7, 1.1)), w, int(r.integers(-6, 7)))
    for _ in range(14):                                      # floating chips
        x, y, s = int(r.integers(10, W - 10)), int(r.integers(14, 120)), int(r.integers(3, 8))
        c.poly([(x, y - s * 1.6), (x + s, y), (x, y + s * 1.6), (x - s, y)], 0.5)
        c.line([(x, y - s * 1.6), (x, y + s * 1.6)])
    c.ground(g, 0.5, 0.1)
    return c


# ---------------------------------------------------------------------------------------------
# 4. Aurora: layered ribbons of signal over soft dunes.
# ---------------------------------------------------------------------------------------------
def aurora():
    c = Canvas(5)
    r = c.rng
    c.haze(0.0, 0.14, 2.4)
    f = np.asarray(c.f, dtype=float) / 255
    s = np.asarray(c.s).copy()
    xs = np.arange(W)
    for k in range(7):
        m1, m2 = int(r.integers(1, 4)), int(r.integers(4, 9))
        p1, p2 = r.random() * 6.28, r.random() * 6.28
        base = 40 + k * 18
        thick = 20 + 4 * k
        cy = base + 18 * np.sin(2 * np.pi * m1 * xs / W + p1) + 6 * np.sin(2 * np.pi * m2 * xs / W + p2)
        for x in xs:
            for y in range(int(cy[x]) - thick, int(cy[x]) + 3):
                if 0 <= y < HOR:
                    t = (y - (cy[x] - thick)) / thick       # 0 at the trailing edge, 1 at the bright crest
                    f[y, x] = max(f[y, x], 0.62 * max(t, 0.0) ** 1.5)
            if 0 <= int(cy[x]) < HOR:
                s[int(cy[x]), x] = 255
    c.f = Image.fromarray((f * 255).astype(np.uint8))
    c.s = Image.fromarray(s)
    c.df, c.ds = ImageDraw.Draw(c.f), ImageDraw.Draw(c.s)
    for _ in range(60):                                      # motes
        c.dot(int(r.integers(3, W - 3)), int(r.integers(6, HOR - 10)))
    g = hills(15, 5)
    c.ground(g, 0.5, 0.1)
    for dy in (HOR + 18, HOR + 38, HOR + 58):                # dune ridges
        ph = r.random() * 6.28
        c.line([(x, dy + 4 * np.sin(2 * np.pi * 3 * x / W + ph)) for x in range(0, W, 4)])
    return c


# ---------------------------------------------------------------------------------------------
# 5. Monolith: standing stones with carved glyphs under a ringed moon.
# ---------------------------------------------------------------------------------------------
def monolith():
    c = Canvas(6)
    r = c.rng
    c.haze(0.0, 0.2, 2.0)
    cx, cy, R = 330, 70, 36
    c.radial(cx, cy, R, R + 44, 0.3)
    c.ellipse((cx - R, cy - R, cx + R, cy + R), 0.5)
    c.ellipse((cx - R + 12, cy - R - 2, cx + R + 4, cy + R - 14), 0.12, edge=False)   # shadowed crescent
    c.ellipse((cx - R - 20, cy - 8, cx + R + 20, cy + 8), 0.0, edge=False)
    c.line([(cx - R - 20 + 2 * i, cy + 8 * np.sin(np.pi * i / (R + 20))) for i in range(0, 2 * (R + 20))])
    g = hills(16, 3)
    stones = [(40, 118, 20), (104, 82, 15), (168, 136, 22), (236, 100, 17), (396, 128, 21), (452, 78, 14)]
    for x, h, w in stones:
        b = int(g(x)) + 3
        c.poly([(x - w, b), (x - w + 3, b - h), (x + w - 5, b - h - 5), (x + w, b)], 0.3)
        for _ in range(int(h / 14)):                         # carved glyph strokes
            gx, gy = x + int(r.integers(-w + 6, w - 8)), b - int(r.integers(14, h - 6))
            kind = int(r.integers(0, 4))
            if kind == 0:
                c.line([(gx, gy), (gx, gy + 7)])
            elif kind == 1:
                c.line([(gx - 3, gy), (gx + 3, gy)])
                c.line([(gx, gy), (gx, gy + 6)])
            elif kind == 2:
                c.line([(gx - 3, gy + 6), (gx, gy), (gx + 3, gy + 6)])
            else:
                c.ellipse((gx - 3, gy, gx + 3, gy + 6), 0.0)
    for _ in range(9):                                       # floating runes with a faint halo
        x, y = int(r.integers(20, W - 20)), int(r.integers(14, 110))
        c.ellipse((x - 8, y - 8, x + 8, y + 8), 0.14, edge=False)
        c.line([(x - 3, y + 4), (x, y - 4), (x + 3, y + 4)])
        c.line([(x - 2, y + 1), (x + 2, y + 1)])
    c.ground(g, 0.5, 0.1)
    for rr in (60, 86):                                      # summoning rings on the ground
        c.line([(240 + rr * np.cos(a), HOR + 38 + rr * 0.16 * np.sin(a)) for a in np.linspace(0, 6.4, 120)])
    return c


# ---------------------------------------------------------------------------------------------
# 6. Glass: a starfield and slow tilted shards over a mirror plain.
# ---------------------------------------------------------------------------------------------
def glass():
    c = Canvas(7)
    r = c.rng
    c.haze(0.0, 0.12, 2.0)
    c.stars(110, sparkle=22)
    for _ in range(11):
        x, y = int(r.integers(14, W - 14)), int(r.integers(24, 150))
        h, w = int(r.integers(16, 46)), int(r.integers(4, 9))
        tilt = int(r.integers(-10, 11))
        top, bot = (x + tilt, y - h), (x - tilt, y + h)
        c.poly([top, (x + w, y), bot, (x - w, y)], 0.22)
        c.poly([top, (x + w, y), bot, (x, y)], 0.62)
        c.line([top, bot])
    g = lambda x: HOR + 2
    c.ground(g, 0.34, 0.06)
    for i, dy in enumerate(range(HOR + 8, H, 7)):             # reflection lines, wider toward the viewer
        for sx in range(int(r.integers(0, 20)), W, 36 + 4 * i):
            c.line([(sx, dy), (sx + 6 + 2 * i, dy)])
    return c


# ---------------------------------------------------------------------------------------------
# 7. Eclipse: a dark disc with a burning rim and a flat ring, metal slabs adrift.
# ---------------------------------------------------------------------------------------------
def eclipse():
    c = Canvas(8)
    r = c.rng
    c.haze(0.0, 0.1, 2.0)
    c.stars(60)
    cx, cy, R = 240, 112, 58
    c.radial(cx, cy, R, R + 62, 0.62, 1.3)
    c.ellipse((cx - R, cy - R, cx + R, cy + R), 0.0)
    c.line([(cx + (R + 22) * np.cos(a), cy + (R + 22) * 0.2 * np.sin(a)) for a in np.linspace(0, 6.3, 160)])
    c.line([(cx + (R + 46) * np.cos(a), cy + (R + 46) * 0.2 * np.sin(a)) for a in np.linspace(0.2, 6.1, 160)])
    # the front half of the disc hides the ring behind it
    c.ellipse((cx - R + 1, cy - R + 1, cx + R - 1, cy + R - 1), 0.0, edge=False)
    c.ellipse((cx - R, cy - R, cx + R, cy + R), 0.0)
    for _ in range(12):                                      # floating slabs
        x, y = int(r.integers(14, W - 40)), int(r.integers(20, 160))
        if abs(x - cx) < R + 30 and abs(y - cy) < R + 20:
            continue
        w, h = int(r.integers(12, 34)), int(r.integers(4, 9))
        sk = int(r.integers(3, 9))
        c.poly([(x, y), (x + w, y), (x + w - sk, y + h), (x - sk, y + h)], 0.5)
        c.line([(x - sk, y + h), (x - sk, y + h + 3), (x + w - sk, y + h + 3), (x + w - sk, y + h)])
    g = hills(18, 2)
    c.ground(g, 0.34, 0.06)
    for k in range(7):                                       # perspective lines to the eclipse
        c.line([(240 + (k - 3) * 14, HOR + 2), (240 + (k - 3) * 78, H)])
    return c


# ---------------------------------------------------------------------------------------------
# 8. Clockwork: a vast dial with a hand and cogs, over a flat floor of gear teeth.
# ---------------------------------------------------------------------------------------------
def cog(c, cx, cy, ro, ri, teeth, dens, rot=0.0):
    pts = []
    for i in range(teeth * 4):
        a = rot + 2 * np.pi * i / (teeth * 4)
        rr = ro if i % 4 in (1, 2) else ri
        pts.append((cx + rr * np.cos(a), cy + rr * np.sin(a)))
    c.poly(pts, dens)
    c.ellipse((cx - ri * 0.45, cy - ri * 0.45, cx + ri * 0.45, cy + ri * 0.45), 0.0)


def clockwork():
    c = Canvas(9)
    r = c.rng
    c.haze(0.0, 0.12, 2.0)
    cx, cy = 240, 120
    c.radial(cx, cy, 96, 150, 0.3)
    for rr, dens in ((96, 0.2), (78, 0.0)):
        c.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), dens)
    c.ellipse((cx - 56, cy - 56, cx + 56, cy + 56), 0.0)
    for i in range(60):                                      # minute ticks, longer on the hours
        a = 2 * np.pi * i / 60 - np.pi / 2
        r0 = 82 if i % 5 else 78
        c.line([(cx + r0 * np.cos(a), cy + r0 * np.sin(a)), (cx + 92 * np.cos(a), cy + 92 * np.sin(a))])
    ha = r.random() * 6.28
    c.line([(cx, cy), (cx + 70 * np.cos(ha), cy + 70 * np.sin(ha))], 2)
    c.line([(cx, cy), (cx + 44 * np.cos(ha + 2.4), cy + 44 * np.sin(ha + 2.4))], 2)
    c.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), 0.6)
    for (x, y, ro, ri, t, rot) in [(70, 150, 40, 33, 12, 0.0), (160, 190, 24, 19, 9, 0.3), (392, 160, 46, 38, 14, 0.2), (452, 70, 24, 19, 9, 0.6), (40, 54, 20, 16, 8, 0.1)]:
        cog(c, x, y, ro, ri, t, 0.34, rot)
    g = lambda x: HOR + 4 + 2 * np.sin(2 * np.pi * 8 * x / W)
    c.ground(g, 0.5, 0.1)
    for x in range(3, W - 6, 12):                            # a floor of teeth
        c.rect(x, HOR + 12, x + 6, HOR + 18, 0.5)
        c.line([(x, HOR + 30), (x + 8, HOR + 30)])
    return c


# ---------------------------------------------------------------------------------------------
# Ascend: stepped plates rising to a gate, a beam of dither climbing out of it.
# ---------------------------------------------------------------------------------------------
def ascend():
    c = Canvas(10)
    r = c.rng
    c.haze(0.0, 0.16, 2.0)
    c.stars(70, sparkle=10)
    cx = 240
    for k in range(10):                                      # the beam, widest at the base
        w = 22 - k * 2
        c.rect(cx - w, 0, cx + w, 140, 0.0, edge=False)
    a = np.asarray(c.f, dtype=float) / 255
    for y in range(0, 150):
        w = 26
        a[y, cx - w : cx + w] = np.maximum(a[y, cx - w : cx + w], 0.55 * (y / 150) ** 1.4)
    c.f = Image.fromarray((a * 255).astype(np.uint8))
    c.df = ImageDraw.Draw(c.f)
    c.line([(cx - 26, 0), (cx - 26, 150)])
    c.line([(cx + 26, 0), (cx + 26, 150)])
    for rr in range(1, 6):                                   # rings rising up the beam
        y = 150 - rr * 26
        c.line([(cx - 26 - rr, y), (cx - 26 - rr, y)])
        c.ellipse((cx - 40, y - 6, cx + 40, y + 6), 0.0, edge=False)
        c.line([(cx + 40 * np.cos(t), y + 6 * np.sin(t)) for t in np.linspace(0, 6.4, 60)])
    base = HOR + 52
    for i in range(7):                                       # stepped plates, each a little wider than the one above
        w = 46 + i * 30
        y0 = 150 + i * 14
        c.rect(cx - w, y0, cx + w, min(H, y0 + 14), 0.18 + 0.05 * (6 - i))
        c.line([(cx - w, y0), (cx + w, y0)])
        for tx in range(cx - w + 6, cx + w - 4, 10):
            c.dot(tx, y0 + 7)
    c.rect(cx - 26, 118, cx + 26, 150, 0.0)                  # the gate
    c.line([(cx - 14, 150), (cx - 14, 126), (cx, 114), (cx + 14, 126), (cx + 14, 150)])
    return c


# ---------------------------------------------------------------------------------------------
# Close-ups: one big object per era for the scene window in the core rail (360 x 144, shown 1:1), so the window
# is not a crop of the backdrop. Same colours as the era.
# ---------------------------------------------------------------------------------------------
DW, DH = 360, 144


def sized(w, h, fn):
    """Run a drawing function with the canvas size set to w x h (the Canvas helpers read the module size)."""
    global W, H
    old = (W, H)
    W, H = w, h
    try:
        return fn()
    finally:
        W, H = old


def d_uplink():
    c = Canvas(21)
    r = c.rng
    c.haze(0.0, 0.2, 1.6, DH)
    for x0, x1, top in ((18, 96, 30), (264, 342, 22)):       # racks at the sides, dim
        c.rect(x0, top, x1, DH, 0.14)
        for y in range(top + 10, DH, 12):
            c.line([(x0 + 4, y), (x1 - 4, y)])
    x0, x1 = 112, 248                                        # the rack in front
    c.rect(x0, 6, x1, DH + 4, 0.3)
    for u in range(7):
        y = 12 + u * 18
        c.rect(x0 + 6, y, x1 - 6, y + 14, 0.5)
        for vx in range(x0 + 12, x0 + 62, 4):                 # vents
            c.line([(vx, y + 3), (vx, y + 11)])
        for k in range(5):                                    # status lights
            if r.random() < 0.6:
                c.rect(x1 - 52 + k * 8, y + 4, x1 - 48 + k * 8, y + 8, 1.0, edge=False)
                c.ds.rectangle((x1 - 52 + k * 8, y + 4, x1 - 49 + k * 8, y + 7), fill=255)
        c.line([(x0 + 70, y + 7), (x0 + 82, y + 7)])
    for cx in (130, 180, 226):                                # cables
        pts = [(cx, 0)]
        for k in range(1, 9):
            pts.append((cx + 6 * np.sin(k * 0.9 + cx), k * 18))
        c.line(pts)
    return c


def d_foundry():
    c = Canvas(22)
    r = c.rng
    c.haze(0.04, 0.34, 1.4, DH)
    cx = 180
    c.poly([(cx - 78, 52), (cx + 78, 52), (cx + 52, 128), (cx - 52, 128)], 0.4)        # crucible
    for yy in (68, 84, 100, 116):
        w = 78 - (yy - 52) * 0.34
        c.line([(cx - w, yy), (cx + w, yy)])
    c.ellipse((cx - 78, 44, cx + 78, 60), 0.95)                                           # molten surface
    for _ in range(40):
        c.dot(int(r.integers(cx - 70, cx + 70)), int(r.integers(47, 57)))
    c.poly([(cx - 8, 60), (cx + 8, 60), (cx + 6, 140), (cx - 6, 140)], 0.8, edge=False)  # pour
    c.line([(cx - 20, 20), (cx - 20, 52)])                                                # chain
    c.line([(cx + 20, 20), (cx + 20, 52)])
    c.line([(cx - 20, 20), (cx + 20, 20)], 2)
    for _ in range(46):                                                                   # sparks
        c.dot(int(r.integers(30, 330)), int(r.integers(4, 134)))
    return c


def d_wafer():
    c = Canvas(23)
    r = c.rng
    c.haze(0.0, 0.16, 1.6, DH)
    x0, y0, x1, y1 = 100, 12, 260, 132
    c.rect(x0, y0, x1, y1, 0.22)
    c.rect(x0 + 14, y0 + 14, x1 - 14, y1 - 14, 0.36)
    for gx in range(x0 + 14, x1 - 14, 10):                    # core grid
        c.line([(gx, y0 + 14), (gx, y1 - 14)])
    for gy in range(y0 + 14, y1 - 14, 10):
        c.line([(x0 + 14, gy), (x1 - 14, gy)])
    for _ in range(26):
        gx = x0 + 14 + 10 * int(r.integers(0, 14))
        gy = y0 + 14 + 10 * int(r.integers(0, 9))
        c.ds.rectangle((gx + 2, gy + 2, gx + 8, gy + 8), fill=255)
    for px in range(x0 + 8, x1 - 6, 14):                      # bond pads and traces out to the edge
        c.ds.rectangle((px, y0 + 3, px + 5, y0 + 8), fill=255)
        c.ds.rectangle((px, y1 - 8, px + 5, y1 - 3), fill=255)
    for py in range(y0 + 10, y1 - 8, 14):
        c.ds.rectangle((x0 + 3, py, x0 + 8, py + 5), fill=255)
        c.ds.rectangle((x1 - 8, py, x1 - 3, py + 5), fill=255)
    for k in range(6):                                        # traces leaving the die
        y = 24 + k * 18
        c.line([(x0, y), (40 + k * 6, y), (40 + k * 6, y + 10), (4, y + 10)])
        c.line([(x1, y + 6), (320 - k * 6, y + 6), (320 - k * 6, y - 4), (356, y - 4)])
    return c


def d_lattice():
    c = Canvas(24)
    r = c.rng
    c.haze(0.0, 0.2, 1.4, DH)
    b = 140

    def spire(x, h, w, lean, dl, dr):
        tip = (x + lean, b - h)
        c.poly([(x - w, b), (x - w, b - h * 0.66), tip, (x, b)], dl)
        c.poly([(x, b), tip, (x + w, b - h * 0.66), (x + w, b)], dr)
        c.line([tip, (x, b - h * 0.6)])

    for x, h, w, l in ((70, 70, 16, -4), (290, 62, 15, 5), (120, 96, 20, -6), (244, 90, 19, 6)):
        spire(x, h, w, l, 0.16, 0.42)
    spire(182, 136, 34, 0, 0.22, 0.72)
    for k in range(9):                                        # light fanning out of the big crystal
        a = -np.pi / 2 + (k - 4) * 0.28
        c.line([(182 + 20 * np.cos(a), 40 + 20 * np.sin(a)), (182 + 90 * np.cos(a), 40 + 90 * np.sin(a))])
    for _ in range(12):
        x, y = int(r.integers(8, 352)), int(r.integers(6, 100))
        c.dot(x, y); c.dot(x - 1, y); c.dot(x + 1, y); c.dot(x, y - 1); c.dot(x, y + 1)
    return c


def d_aurora():
    c = Canvas(25)
    r = c.rng
    c.haze(0.0, 0.1, 1.6, DH)
    for gx in range(0, DW, 24):                               # scope graticule
        c.line([(gx, 0), (gx, DH)])
    for gy in range(0, DH, 24):
        c.line([(0, gy), (DW, gy)])
    c.rect(0, 0, DW, DH, 0.0, edge=False)                     # clear it, keep as a faint dither grid only
    a = np.asarray(c.f, dtype=float) / 255
    s = np.zeros((DH, DW), dtype=np.uint8)
    xs = np.arange(DW)
    for k in range(5):
        m, ph, amp = 2 + k, r.random() * 6.28, 14 + 6 * k
        cy = 72 + (k - 2) * 8 + amp * np.sin(2 * np.pi * m * xs / DW + ph)
        for x in xs:
            yc = int(cy[x])
            for y in range(max(0, yc - 12), min(DH, yc + 2)):
                a[y, x] = max(a[y, x], 0.5 * (1 - (yc - y) / 12) ** 1.4)
            if 0 <= yc < DH:
                s[yc, x] = 255
    for gx in range(0, DW, 24):
        s[:, gx] = np.maximum(s[:, gx], 0)
    for bx in range(10, DW - 10, 9):                          # spectrum bars along the bottom
        h = int(4 + 22 * abs(np.sin(bx * 0.13)) * r.random() + 4)
        s[DH - h : DH, bx : bx + 5] = 255
    c.f = Image.fromarray((a * 255).astype(np.uint8))
    c.s = Image.fromarray(s)
    c.df, c.ds = ImageDraw.Draw(c.f), ImageDraw.Draw(c.s)
    return c


def d_monolith():
    c = Canvas(26)
    r = c.rng
    c.haze(0.0, 0.2, 1.4, DH)
    cx = 180
    c.radial(cx, 66, 54, 110, 0.4)
    c.poly([(cx - 40, 144), (cx - 34, 6), (cx + 34, 0), (cx + 42, 144)], 0.3)
    c.poly([(cx + 42, 144), (cx + 34, 0), (cx + 52, 8), (cx + 60, 144)], 0.6)             # lit side
    for k in range(4):                                        # carved rows
        y = 18 + k * 28
        for gx in range(cx - 26, cx + 22, 18):
            kind = int(r.integers(0, 4))
            if kind == 0:
                c.line([(gx, y), (gx, y + 16)]); c.line([(gx - 5, y + 4), (gx + 5, y + 4)])
            elif kind == 1:
                c.line([(gx - 6, y + 16), (gx, y), (gx + 6, y + 16)])
            elif kind == 2:
                c.ellipse((gx - 6, y, gx + 6, y + 16), 0.0)
            else:
                c.line([(gx - 6, y), (gx + 6, y), (gx, y + 16), (gx - 6, y)])
    for side in (-1, 1):                                      # floating runes either side
        for k in range(3):
            x, y = cx + side * (84 + 24 * (k % 2)), 26 + k * 38
            c.ellipse((x - 10, y - 10, x + 10, y + 10), 0.18, edge=False)
            c.line([(x - 4, y + 5), (x, y - 5), (x + 4, y + 5)])
    return c


def d_glass():
    c = Canvas(27)
    r = c.rng
    c.haze(0.0, 0.1, 1.4, DH)
    c.stars(50)
    cx, cy = 180, 74
    top, mid = cy - 56, cy
    pts = [(cx - 70, cy - 20), (cx - 36, top), (cx + 36, top), (cx + 70, cy - 20), (cx, cy + 62)]   # a cut gem, front view
    c.poly(pts, 0.24)
    c.poly([pts[0], pts[1], (cx - 16, cy - 20)], 0.55)
    c.poly([pts[1], pts[2], (cx + 16, cy - 20), (cx - 16, cy - 20)], 0.14)
    c.poly([pts[2], pts[3], (cx + 16, cy - 20)], 0.7)
    c.poly([pts[0], (cx - 16, cy - 20), pts[4]], 0.4)
    c.poly([(cx - 16, cy - 20), (cx + 16, cy - 20), pts[4]], 0.2)
    c.poly([(cx + 16, cy - 20), pts[3], pts[4]], 0.62)
    c.line([pts[0], pts[3]])
    for _ in range(7):                                        # sparkles
        x, y = int(r.integers(20, 340)), int(r.integers(10, 130))
        s = int(r.integers(3, 7))
        c.line([(x - s, y), (x + s, y)]); c.line([(x, y - s), (x, y + s)])
    return c


def d_eclipse():
    c = Canvas(28)
    r = c.rng
    c.haze(0.0, 0.08, 1.4, DH)
    c.stars(40)
    cx, cy, R = 120, 188, 150                                 # a huge dark disc rising past the bottom edge
    c.radial(cx, cy, R, R + 46, 0.7, 1.2)
    c.ellipse((cx - R, cy - R, cx + R, cy + R), 0.0)
    c.line([(cx + (R + 18) * np.cos(a), cy + (R + 18) * 0.3 * np.sin(a) - 30) for a in np.linspace(3.3, 6.1, 80)])
    for _ in range(10):                                       # slabs and debris
        x, y = int(r.integers(190, 330)), int(r.integers(8, 120))
        w, h, sk = int(r.integers(14, 40)), int(r.integers(5, 11)), int(r.integers(3, 8))
        c.poly([(x, y), (x + w, y), (x + w - sk, y + h), (x - sk, y + h)], 0.5)
        c.line([(x - sk, y + h), (x - sk, y + h + 3), (x + w - sk, y + h + 3), (x + w - sk, y + h)])
    return c


def d_clockwork():
    c = Canvas(29)
    c.haze(0.0, 0.1, 1.4, DH)
    cog(c, 118, 76, 66, 54, 14, 0.36, 0.0)
    cog(c, 236, 52, 46, 38, 11, 0.5, 0.2)
    cog(c, 288, 118, 34, 28, 9, 0.28, 0.4)
    c.line([(180, 0), (180, 20)])                             # pendulum
    c.line([(180, 20), (210, 100)])
    c.ellipse((200, 96, 224, 120), 0.7)
    return c


DETAILS = [d_uplink, d_foundry, d_wafer, d_lattice, d_aurora, d_monolith, d_glass, d_eclipse, d_clockwork]


def save_detail(i):
    c = sized(DW, DH, DETAILS[i])
    # Canvas.save reads the module size, so save at the close-up size too
    sized(DW, DH, lambda: c.save(f"detail-{i}", ERAS[i][1]))


PIECES = {str(i): (fn, ERAS[i]) for i, fn in enumerate([uplink, foundry, wafer, lattice, aurora, monolith, glass, eclipse, clockwork])}
PIECES["ascend"] = (ascend, ASCEND)

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    want = sys.argv[1:] or list(PIECES) + [f"d{i}" for i in range(9)]
    bad = [w for w in want if w not in PIECES and not (w.startswith("d") and w[1:].isdigit() and int(w[1:]) < 9)]
    if bad:
        raise SystemExit(f"unknown: {bad}; known: {list(PIECES)}")
    for key in want:
        if key.startswith("d"):
            save_detail(int(key[1:]))
            continue
        fn, (_, color) = PIECES[key]
        fn().save(f"scene-{key}", color)
