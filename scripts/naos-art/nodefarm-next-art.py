"""Node Farm "next step" console art: animated scene plates and a small icon set, all original pixel dither in colour.

Run:  python3 scripts/naos-art/nodefarm-next-art.py
Output:
  public/naos/nodefarm/next-plates.{png,webp}  PW x PH art pixels per plate, FRAMES columns (animation), one row per plate
                                                (order: PLATES below, must match PLATES in components/nodefarm/guide.tsx)
  public/naos/nodefarm/next-icons.{png,webp}   IC x IC per icon, one row (order: ICONS below, must match NX_ICONS there)

Shading works like nodefarm-icons.py: flat shapes with a gradient, quantised to a 5-step colour ramp through a Bayer 4x4
threshold, so it reads as dither rather than smooth colour. Everything is procedural; nothing is traced or borrowed.
"""
import importlib.util
import math
import os

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "public", "naos", "nodefarm")
_spec = importlib.util.spec_from_file_location("nf_icons", os.path.join(HERE, "nodefarm-icons.py"))
ic = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ic)

RAMPS = dict(ic.RAMPS)
RAMPS["lab"] = ic.ramp("#0a1a2a", "#1d4a73", "#3f86c0", "#9fd0ff", "#e8f6ff")
RAMPS["vi"] = ic.ramp("#140c2b", "#3b2a7a", "#6d55c9", "#a98bff", "#e9e0ff")
B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 - 0.5

PW, PH, FRAMES = 80, 56, 4
IC = 24


class Cv:
    """A small RGBA canvas with dithered fills in the shared ramps."""

    def __init__(self, w, h, seed=1):
        self.w, self.h = w, h
        self.img = np.zeros((h, w, 4), np.uint8)
        self.yy, self.xx = np.mgrid[0:h, 0:w].astype(float)
        self.bayer = np.tile(B4, (h // 4 + 1, w // 4 + 1))[:h, :w]
        self.rng = np.random.default_rng(seed)

    def fill(self, mask, v, rp, outline=False):
        r = RAMPS[rp]
        v = np.broadcast_to(v, (self.h, self.w))
        idx = np.floor(v * (len(r) - 1) + 0.5 + self.bayer * 0.9).astype(int)
        for i, c in enumerate(r):
            m = mask & (idx == i)
            self.img[m] = (*c, 255)
        if outline:
            d = np.zeros_like(mask)
            d[1:, :] |= mask[:-1, :]; d[:-1, :] |= mask[1:, :]; d[:, 1:] |= mask[:, :-1]; d[:, :-1] |= mask[:, 1:]
            ring = d & ~mask
            self.img[ring] = (*r[0], 255)

    def set(self, mask, rp, i):
        self.img[mask] = (*RAMPS[rp][i], 255)

    def px(self, x, y, rp, i):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.w and 0 <= y < self.h:
            self.img[y, x] = (*RAMPS[rp][i], 255)

    # shapes -> boolean masks
    def rect(self, x0, y0, x1, y1):
        return (self.xx >= x0) & (self.xx < x1) & (self.yy >= y0) & (self.yy < y1)

    def disc(self, cx, cy, r, ry=None):
        ry = ry or r
        return ((self.xx + .5 - cx) / r) ** 2 + ((self.yy + .5 - cy) / ry) ** 2 <= 1

    def ring(self, cx, cy, r0, r1):
        d = np.hypot(self.xx + .5 - cx, self.yy + .5 - cy)
        return (d <= r1) & (d >= r0)

    def poly(self, pts):
        im = Image.new("L", (self.w * 4, self.h * 4), 0)
        ImageDraw.Draw(im).polygon([(x * 4, y * 4) for x, y in pts], fill=255)
        return np.asarray(im.resize((self.w, self.h), Image.BOX)) > 127

    def line(self, pts, width=1):
        im = Image.new("L", (self.w, self.h), 0)
        ImageDraw.Draw(im).line([(round(x), round(y)) for x, y in pts], fill=255, width=width)
        return np.asarray(im) > 0

    def lin(self, x0, y0, x1, y1):
        dx, dy = x1 - x0, y1 - y0
        return np.clip(((self.xx - x0) * dx + (self.yy - y0) * dy) / (dx * dx + dy * dy), 0, 1)

    def rad(self, cx, cy, r):
        return np.clip(1 - np.hypot(self.xx + .5 - cx, self.yy + .5 - cy) / r, 0, 1)


# ---------------------------------------------------------------- plates
def backdrop(c, rp, cx=40, cy=30, glow=0.55):
    """Near-black screen, a dithered glow in the plate's colour and a faint dot grid."""
    c.img[...] = (7, 9, 10, 255)
    g = c.rad(cx, cy, 46) * glow
    m = g + c.bayer * 0.35 > 0.32
    c.fill(m, g * 0.55, rp)
    grid = ((c.xx % 8) == 0) & ((c.yy % 8) == 0)
    c.set(grid & (c.img[..., 0] < 20), "gr", 1)
    # ground line
    c.set(c.rect(0, 50, c.w, 51), rp, 1)
    for x in range(0, c.w, 3):
        c.px(x, 52 + (x // 3) % 2, rp, 1)


def p_grow(c, t):
    backdrop(c, "lime", 30, 34)
    for k in range(3):                                      # three multiplier chips stacked
        y = 44 - k * 9
        top = c.poly([(30, y - 6), (44, y - 1), (30, y + 4), (16, y - 1)])
        side = c.poly([(16, y - 1), (30, y + 4), (44, y - 1), (44, y + 2), (30, y + 7), (16, y + 2)])
        c.fill(side, 0.25 + 0.2 * c.lin(16, 0, 44, 0), "lime")
        c.fill(top, 0.55 + 0.4 * c.lin(16, y - 6, 44, y + 4), "lime", outline=True)
        c.set(c.rect(28, y - 2, 33, y), "wh", 4)
    for i in range(7):                                      # bytes rise off the stack
        x = 52 + (i * 11) % 22
        y = 46 - ((i * 13 + t * 6) % 40)
        cube = c.rect(x, y, x + 3, y + 3)
        c.fill(cube, 0.7 + 0.3 * (i % 2), "cyan")
    c.set(c.line([(46, 20), (66, 20)]), "lime", 2)
    c.px(46 + (t * 5) % 20, 20, "wh", 4)


def p_reboot(c, t):
    backdrop(c, "mag", 40, 28, 0.7)
    r = np.hypot(c.xx + .5 - 40, c.yy + .5 - 27)
    ang = np.degrees(np.arctan2(c.yy + .5 - 27, c.xx + .5 - 40))
    ring = (r <= 19) & (r >= 13) & ~((ang < -60) & (ang > -120))
    c.fill(ring, 0.3 + 0.4 * c.lin(20, 8, 60, 46), "mag", outline=True)
    a0 = -90 + 90 * t                                       # a hot arc runs around the ring
    hot = ring & (((ang - a0) % 360) < 70)
    c.fill(hot, 0.95, "mag")
    c.fill(c.rect(38, 4, 43, 24), 0.9, "mag", outline=True)
    c.set(c.rect(39, 5, 41, 22), "wh", 4)
    for k in range(4):                                      # shards of the wiped cache scatter outward
        a = math.radians(k * 90 + 45 + t * 12)
        d = 23 + t * 2
        c.fill(c.rect(40 + d * math.cos(a), 27 + d * 0.8 * math.sin(a), 42 + d * math.cos(a), 29 + d * 0.8 * math.sin(a)), 0.8, "lime")


def p_decrypt(c, t):
    backdrop(c, "cyan", 22, 28)
    for gy in range(4):                                     # the cipher grid, being swept
        for gx in range(5):
            x, y = 38 + gx * 8, 8 + gy * 10
            lit = (gx + gy * 2 + t) % 5 == 0
            c.fill(c.rect(x, y, x + 6, y + 7), 0.85 if lit else 0.25, "rn" if lit else "cyan")
    sx = 37 + ((t * 11) % 42)
    c.set(c.rect(sx, 6, sx + 1, 48), "wh", 4)
    c.fill(c.rect(sx - 3, 6, sx, 48) & (c.bayer > 0.1), 0.6, "cyan")
    body = c.rect(10, 26, 30, 44)                           # the padlock
    c.fill(body, 0.35 + 0.5 * c.lin(10, 26, 30, 44), "rn", outline=True)
    sh = c.ring(20, 26, 6, 9) & (c.yy < 26)
    lift = 2 if t % 2 else 0
    sh = np.roll(sh, -lift, axis=0)
    c.fill(sh, 0.7, "wh", outline=True)
    c.set(c.rect(19, 32, 22, 38), "rn", 0)


def p_build(c, t):
    backdrop(c, "cu", 40, 30)
    rack = c.rect(14, 8, 46, 50)
    c.fill(rack, 0.18 + 0.2 * c.lin(14, 8, 46, 50), "gr", outline=True)
    for k in range(4):                                      # node slots, lights blinking
        y = 12 + k * 9
        c.fill(c.rect(17, y, 43, y + 6), 0.4, "si")
        on = (k + t) % 3 != 0
        c.set(c.rect(38, y + 2, 40, y + 4), "lime" if on else "red", 3)
        c.set(c.rect(19, y + 2, 32, y + 3), "si", 3)
    y = 16 + (3 - t) * 3                                    # a new node slides in
    chip = c.rect(50, y, 68, y + 8)
    c.fill(chip, 0.55 + 0.35 * c.lin(50, y, 68, y + 8), "cu", outline=True)
    c.set(c.rect(52, y + 3, 66, y + 4), "cu", 4)
    for x in range(52, 67, 3):
        c.set(c.rect(x, y + 8, x + 1, y + 10), "rn", 3)
    c.set(c.line([(46, y + 4), (49, y + 4)]), "wh", 4)


def p_drone(c, t):
    backdrop(c, "ae", 40, 22)
    bob = [0, -1, -2, -1][t]
    cy = 20 + bob
    c.fill(c.disc(40, cy, 9, 5), 0.5 + 0.4 * c.lin(31, cy - 5, 49, cy + 5), "ae", outline=True)
    c.set(c.disc(40, cy, 3, 2), "wh", 4)
    for dx in (-17, 17):                                    # rotors, spinning
        c.set(c.line([(40 + dx * 0.55, cy), (40 + dx, cy - 3)]), "gr", 3)
        w = [7, 3, 7, 3][t]
        c.fill(c.rect(40 + dx - w, cy - 4, 40 + dx + w, cy - 3), 0.9, "ae")
    beam = c.poly([(37, cy + 5), (43, cy + 5), (52, 46), (28, 46)])
    c.fill(beam & (c.bayer > -0.1), 0.35 + 0.3 * c.lin(0, cy, 0, 46), "ae")
    c.fill(c.rect(30, 44, 50, 49), 0.6 if t % 2 else 0.9, "lime", outline=True)


def p_ascend(c, t):
    backdrop(c, "mag", 40, 30, 0.8)
    col = c.rect(33, 0, 47, 50)
    c.fill(col, 0.25 + 0.35 * c.lin(0, 50, 0, 0) + 0.25 * c.rad(40, 25, 30), "vi")
    c.fill(c.rect(37, 0, 43, 50), 0.6 + 0.4 * c.lin(0, 50, 0, 0), "mag")
    for k in range(3):                                      # chevrons climbing
        y = 44 - ((k * 14 + t * 4) % 42)
        chev = c.line([(32, y + 6), (40, y), (48, y + 6)], width=2)
        c.set(chev, "wh", 4 if k == 0 else 3)
    c.fill(c.disc(40, 49, 18, 4) & ~c.disc(40, 49, 13, 2.5), 0.85, "cyan", outline=True)
    for i in range(10):
        x = 8 + (i * 17) % 64
        y = (i * 23 - t * 3) % 48
        c.px(x, y, ["cyan", "mag", "vi"][i % 3], 4)


def p_tree(c, t):
    backdrop(c, "vi", 40, 40)
    nodes = [(40, 46), (24, 34), (56, 34), (14, 20), (34, 20), (48, 20), (66, 20), (24, 8), (56, 8)]
    links = [(0, 1), (0, 2), (1, 3), (1, 4), (2, 5), (2, 6), (4, 7), (5, 8)]
    lit = 1 + t * 2
    for a, b in links:
        (x0, y0), (x1, y1) = nodes[a], nodes[b]
        c.set(c.line([(x0, y0), (x0, (y0 + y1) / 2), (x1, (y0 + y1) / 2), (x1, y1)]), "vi", 3 if b <= lit else 1)
    for i, (x, y) in enumerate(nodes):
        m = c.rect(x - 3, y - 3, x + 4, y + 4)
        if i == 0:
            c.fill(c.disc(x, y, 5), 0.9, "rn", outline=True)
            c.set(c.rect(x - 1, y - 1, x + 1, y + 1), "wh", 4)
        else:
            c.fill(m, 0.85 if i <= lit else 0.2, "vi", outline=True)
            if i == lit:
                c.set(c.rect(x - 1, y - 1, x + 2, y + 2), "wh", 4)


def p_lab(c, t):
    backdrop(c, "lab", 40, 28)
    bp = (((c.xx % 6) == 0) | ((c.yy % 6) == 0)) & c.rect(4, 4, 76, 48)
    c.set(bp & (c.bayer > 0.1), "lab", 1)
    win = c.rect(10, 10, 52, 44)
    c.fill(win, 0.08, "lab", outline=True)
    c.set(c.rect(10, 10, 52, 13), "lab", 3)
    for k, w in enumerate((26, 18, 30, 12)):
        c.set(c.rect(14, 17 + k * 6, 14 + w, 19 + k * 6), "lab", 2 if k != 3 else 3)
    if t % 2 == 0:
        c.set(c.rect(28, 35, 31, 38), "wh", 4)
    pts = [(64, 12), (58, 24), (70, 24), (58, 36), (70, 36)]  # a small research tree beside the terminal
    for a, b in ((0, 1), (0, 2), (1, 3), (2, 4)):
        c.set(c.line([pts[a], pts[b]]), "lab", 2)
    for i, (x, y) in enumerate(pts):
        c.fill(c.rect(x - 2, y - 2, x + 3, y + 3), 0.9 if i <= t + 1 else 0.3, "lab" if i else "cyan", outline=True)


def p_compile(c, t):
    backdrop(c, "lab", 40, 26)
    cap = c.disc(40, 24, 22, 10)
    c.fill(cap, 0.25 + 0.5 * c.lin(18, 14, 62, 34), "si", outline=True)
    c.fill(c.disc(40, 24, 16, 6), 0.1, "lab")
    w = 6 + t * 7
    c.fill(c.rect(26, 22, 26 + w, 27), 0.9, "cyan")
    c.set(c.rect(26 + w, 22, 27 + w, 27), "wh", 4)
    for k in range(4):
        x = 16 + k * 16
        c.fill(c.rect(x, 42, x + 10, 48), 0.85 if k < t + 1 else 0.25, "mag" if k == 3 else "lab", outline=True)


def p_goal(c, t):
    backdrop(c, "rn", 40, 26)
    c.fill(c.poly([(26, 50), (54, 50), (50, 42), (30, 42)]), 0.3 + 0.3 * c.lin(26, 0, 54, 0), "gr", outline=True)
    c.fill(c.poly([(34, 6), (40, 18), (46, 6)]), 0.6, "mag", outline=True)
    c.fill(c.disc(40, 28, 11), 0.4 + 0.55 * c.lin(29, 17, 51, 39), "rn", outline=True)
    c.fill(c.disc(40, 28, 6), 0.95, "rn")
    c.set(c.rect(39, 24, 41, 32) | c.rect(36, 27, 44, 29), "wh", 4)
    for k in range(4):
        a = math.radians(t * 22 + k * 90)
        x, y = 40 + 18 * math.cos(a), 28 + 15 * math.sin(a)
        c.set(c.rect(x - 1, y, x + 2, y + 1) | c.rect(x, y - 1, x + 1, y + 2), "rn", 4)


def p_done(c, t):
    backdrop(c, "cyan", 40, 28, 0.7)
    c.fill(c.disc(40, 27, 10), 0.4 + 0.6 * c.rad(37, 24, 10), "cyan", outline=True)
    c.set(c.disc(40, 27, 3), "wh", 4)
    for k, rp in enumerate(("mag", "lime", "rn", "vi", "ae")):
        a = math.radians(t * 18 + k * 72)
        x, y = 40 + 24 * math.cos(a), 27 + 14 * math.sin(a)
        c.fill(c.rect(x - 2, y - 2, x + 2, y + 2), 0.9, rp, outline=True)
    c.set(c.ring(40, 27, 23.5, 24.3) & (c.bayer > 0.2), "cyan", 1)


PLATES = [("grow", p_grow), ("reboot", p_reboot), ("decrypt", p_decrypt), ("build", p_build), ("drone", p_drone),
          ("ascend", p_ascend), ("tree", p_tree), ("lab", p_lab), ("compile", p_compile), ("goal", p_goal), ("done", p_done)]


# ---------------------------------------------------------------- icons (24 x 24)
def i_target(c):
    c.fill(c.ring(12, 12, 7, 9.5), 0.8, "cyan", outline=True)
    c.fill(c.disc(12, 12, 3), 0.95, "mag", outline=True)
    for m in (c.rect(11, 0, 13, 5), c.rect(11, 19, 13, 24), c.rect(0, 11, 5, 13), c.rect(19, 11, 24, 13)):
        c.set(m, "wh", 4)


def i_map(c):
    for k, rp in enumerate(("cyan", "lime", "rn")):
        x = 3 + k * 6
        c.fill(c.poly([(x, 4 + (k % 2) * 2), (x + 6, 2 + ((k + 1) % 2) * 2), (x + 6, 20 + ((k + 1) % 2) * 2), (x, 22 - (k % 2) * 2)]), 0.4 + 0.3 * k / 2, rp, outline=True)
    c.set(c.line([(5, 16), (10, 10), (15, 13), (20, 6)]), "wh", 4)


def i_ascend(c):
    for k in range(3):
        y = 3 + k * 6
        c.set(c.line([(4, y + 7), (12, y), (20, y + 7)], width=3), "mag", 3 - k)
    c.set(c.line([(6, 10), (12, 5), (18, 10)]), "wh", 4)
    c.fill(c.rect(4, 21, 20, 23), 0.7, "vi")


def i_ap(c):
    c.fill(c.poly([(12, 2), (21, 7), (21, 17), (12, 22), (3, 17), (3, 7)]), 0.35 + 0.55 * c.lin(3, 2, 21, 22), "vi", outline=True)
    c.fill(c.poly([(12, 6), (17, 9), (17, 15), (12, 18), (7, 15), (7, 9)]), 0.95, "rn")
    c.set(c.rect(11, 9, 13, 15) | c.rect(9, 11, 15, 13), "wh", 4)


def i_key(c):
    c.fill(c.ring(8, 12, 3, 6.5), 0.8, "rn", outline=True)
    c.fill(c.rect(13, 11, 22, 14), 0.75, "rn", outline=True)
    c.set(c.rect(17, 14, 19, 18) | c.rect(20, 14, 22, 17), "rn", 3)
    c.set(c.rect(6, 10, 8, 12), "wh", 4)


def i_goal(c):
    c.fill(c.rect(5, 2, 7, 22), 0.6, "gr", outline=True)
    c.fill(c.poly([(7, 3), (20, 6), (16, 9), (20, 12), (7, 14)]), 0.45 + 0.5 * c.lin(7, 3, 20, 14), "rn", outline=True)
    c.fill(c.rect(2, 20, 11, 22), 0.5, "gr")


def i_lab(c):
    c.fill(c.rect(2, 4, 22, 20), 0.12, "lab", outline=True)
    c.set(c.rect(2, 4, 22, 7), "lab", 3)
    c.set(c.line([(5, 10), (8, 12), (5, 14)]), "cyan", 4)
    c.set(c.rect(10, 14, 16, 15), "lab", 3)


def i_drone(c):
    c.fill(c.disc(12, 13, 6, 4), 0.55 + 0.4 * c.lin(6, 9, 18, 17), "ae", outline=True)
    c.set(c.disc(12, 13, 1.6), "wh", 4)
    for x in (2, 15):
        c.fill(c.rect(x, 6, x + 7, 8), 0.9, "ae")
        c.set(c.rect(x + 3, 8, x + 4, 11), "gr", 3)


def i_clock(c):
    c.fill(c.disc(12, 12, 9.5), 0.2 + 0.4 * c.lin(3, 3, 21, 21), "cyan", outline=True)
    c.set(c.rect(11, 5, 13, 13) | c.rect(11, 11, 17, 13), "wh", 4)


def i_tree(c):
    pts = [(12, 20), (6, 13), (18, 13), (4, 5), (12, 5), (20, 5)]
    for a, b in ((0, 1), (0, 2), (1, 3), (1, 4), (2, 5)):
        c.set(c.line([pts[a], pts[b]]), "vi", 3)
    for i, (x, y) in enumerate(pts):
        c.fill(c.rect(x - 2, y - 2, x + 2, y + 2), 0.9, "rn" if i == 0 else "vi", outline=True)


def i_intel(c):
    c.fill(c.disc(12, 12, 10, 6), 0.25, "lab", outline=True)
    c.fill(c.disc(12, 12, 5), 0.8, "cyan", outline=True)
    c.set(c.disc(12, 12, 2), "lab", 0)
    c.set(c.rect(13, 9, 15, 11), "wh", 4)


def i_play(c):
    c.fill(c.poly([(6, 3), (20, 12), (6, 21)]), 0.5 + 0.45 * c.lin(6, 3, 20, 21), "lime", outline=True)


def i_lock(c):
    c.fill(c.rect(5, 11, 19, 21), 0.3 + 0.3 * c.lin(5, 11, 19, 21), "gr", outline=True)
    c.fill(c.ring(12, 11, 4, 6.5) & (c.yy < 11), 0.6, "gr", outline=True)
    c.set(c.rect(11, 14, 13, 18), "gr", 0)


ICONS = [("target", i_target), ("map", i_map), ("ascend", i_ascend), ("ap", i_ap), ("key", i_key), ("goal", i_goal), ("lab", i_lab),
         ("drone", i_drone), ("clock", i_clock), ("tree", i_tree), ("intel", i_intel), ("play", i_play), ("lock", i_lock)]


def save(img, name):
    im = Image.fromarray(img, "RGBA")
    im.save(os.path.join(OUT, f"{name}.png"), optimize=True)
    im.save(os.path.join(OUT, f"{name}.webp"), lossless=True, quality=100, method=6)


def main():
    sheet = np.zeros((PH * len(PLATES), PW * FRAMES, 4), np.uint8)
    for r, (name, fn) in enumerate(PLATES):
        for t in range(FRAMES):
            c = Cv(PW, PH, seed=r)
            fn(c, t)
            sheet[r * PH:(r + 1) * PH, t * PW:(t + 1) * PW] = c.img
    save(sheet, "next-plates")
    icons = np.zeros((IC, IC * len(ICONS), 4), np.uint8)
    for k, (name, fn) in enumerate(ICONS):
        c = Cv(IC, IC, seed=k)
        fn(c)
        icons[:, k * IC:(k + 1) * IC] = c.img
    save(icons, "next-icons")
    print("plates", [n for n, _ in PLATES])
    print("icons", [n for n, _ in ICONS])


if __name__ == "__main__":
    main()
