"""Groundbreak icons: every material, currency, piece of equipment and system glyph, 64 px, one consistent 3D dither
set (same camera, same low golden-hour light, same outline and ground shadow). One draw function per id."""
import math

import numpy as np

from gb_kit import P, Canvas, Scene, rock

N = 64
DRAW = {}
ORDER = []


def icon(fn):
    k = fn.__name__.rstrip("_")
    DRAW[k] = fn
    ORDER.append(k)
    return fn


def ring_pts(cx, cy, cz, r, n=16, axis="y"):
    out = []
    for k in range(n):
        a = 2 * math.pi * k / n
        u, w = r * math.cos(a), r * math.sin(a)
        out.append((cx + u, cy, cz + w) if axis == "y" else (cx, cy + u, cz + w) if axis == "x" else (cx + u, cy + w, cz))
    return out


# ------------------------------------------------------------------ materials (chain order)
@icon
def gravel(s):
    spots = [(-9, 4, 2, 6), (0, 4, -3, 7), (9, 4, 1, 6), (-4, 4, 8, 5.5), (5, 4, 8, 5), (-3, 11, 0, 6), (5, 10, -1, 5),
             (0, 16, 2, 5)]
    for i, (x, y, z, r) in enumerate(spots):
        rock(s, (x, y, z), r, "gravel", 11 + i, squash=0.7, v=0.04 * (i % 3) - 0.04)


@icon
def sand(s):
    s.cylinder((0, 0, 0), (0, 15, 0), 20, "sand", r2=2, n=20)
    s.cylinder((-2, 14.5, 0), (-2, 17, 0), 3, "sand", r2=0.5, n=10)


@icon
def cement(s):
    s.box(-13, 13, 0, 8, -8, 8, "cement", -0.05)
    s.box(-12, 12, 8, 17, -7, 7, "cement")
    s.box(-12.4, 12.4, 10, 13, -7.4, 7.4, "hiviz")  # printed band
    s.box(-6, -2, 17, 19, -2, 2, "cement", 0.1)  # folded corner


@icon
def concrete(s):
    s.box(-14, 6, 0, 16, -8, 8, "concrete")
    s.box(-13, 5, 16, 17, -7, 7, "concrete", -0.12)  # wet top
    s.cylinder((12, 0, 4), (12, 13, 4), 5, "cement")  # test cylinder
    s.cylinder((12, 13, 4), (12, 13.6, 4), 5.2, "hiviz", -0.05)


@icon
def rebar(s):
    for i, (y, z) in enumerate([(2, -5), (2, 0), (2, 5), (6.5, -2.5), (6.5, 2.5), (11, 0)]):
        s.cylinder((-22, y + i * 0.6, z), (20, y + 4 + i * 0.6, z), 1.9, "rebar", 0.02 * (i % 2), n=6)
    s.cylinder((-4, 7, 0), (-3.4, 7.1, 0), 8.6, "steel", 0.2, n=12)  # tie wire band
    s.cylinder((10, 9.5, 0), (10.6, 9.6, 0), 8.6, "steel", 0.2, n=12)
    for i, (y, z) in enumerate([(2, -5), (2, 5), (11, 0)]):
        y1 = y + 4 + [0, 1, 5][i] * 0.6
        s.cylinder((20, y1, z), (21, y1 + 7, z), 1.9, "rebar", 0.08, n=6)  # bent hooks


@icon
def steel(s):
    L = 22
    s.box(-L, L, 0, 2.5, -8, 8, "steel")
    s.box(-L, L, 2.5, 15.5, -1.6, 1.6, "steel", -0.05)
    s.box(-L, L, 15.5, 18, -8, 8, "steel")


@icon
def glass(s):
    s.box(-16, 16, 0, 3, -4, 4, "steel", -0.1)
    s.box(-15, 15, 3, 30, -1.6, 1.6, "steel")
    s.box(-13, 13, 5, 28, 1.3, 1.9, "glass")

    def post(c, sc):
        a, b = sc.pt((-6, 26, 2)), sc.pt((4, 8, 2))
        c.set(c.line(*a, *b, 2) & (c.img[..., 3] > 0), P["sunglass"][5])
        a, b = sc.pt((2, 27, 2)), sc.pt((9, 15, 2))
        c.set(c.line(*a, *b, 1) & (c.img[..., 3] > 0), P["sunglass"][4])
    return post


@icon
def wire(s):
    s.cylinder((0, 13, -9), (0, 13, -7), 14, "wood", -0.05, n=22)
    s.cylinder((0, 13, -7), (0, 13, 7), 10.5, "copper", n=22)
    s.cylinder((0, 13, 7), (0, 13, 9), 14, "wood", n=22)
    s.cylinder((0, 13, 9), (0, 13, 9.6), 4, "steel", 0.1, n=12)  # hub
    s.beam((10, 6, 0), (20, 0.8, 4), 2.2, "copper", 0.1)  # loose tail

    def post(c, sc):
        hub = sc.pt((0, 13, 9.8))
        c.set(c.disc(*hub, 1.6), P["ink"][1])
    return post


@icon
def duct(s):
    s.cylinder((-20, 7, 0), (2, 7, 0), 7, "duct", n=18)
    for x in (-15, -8, -1):
        s.cylinder((x, 7, 0), (x + 0.8, 7, 0), 7.6, "duct", 0.14, n=18)
    s.cylinder((2, 7, 0), (8, 9, 0), 7, "duct", -0.03, n=18, r2=7)
    s.cylinder((8, 9, 0), (11, 15, 0), 7, "duct", 0.02, n=18)
    s.cylinder((11, 15, 0), (11, 30, 0), 7, "duct", n=18)
    s.cylinder((11, 22, 0), (11, 22.8, 0), 7.6, "duct", 0.14, n=18)
    s.cylinder((11, 30, 0), (11, 31.2, 0), 7.8, "hiviz", 0.05, n=18)  # tagged end


@icon
def precast(s):
    s.box(-15, 15, 0, 6, -3, 3, "precast")
    s.box(-15, -5, 6, 20, -3, 3, "precast")
    s.box(5, 15, 6, 20, -3, 3, "precast")
    s.box(-15, 15, 20, 30, -3, 3, "precast")
    s.box(-5, 5, 6, 20, -1.5, -1, "glass", -0.1)
    for x in (-9, 9):
        s.cylinder((x - 2, 30, 0), (x + 2, 30, 0), 1.2, "steel", 0.15, n=6)
        s.box(x - 2.4, x - 1.6, 30, 33, -0.4, 0.4, "steel", 0.15)
        s.box(x + 1.6, x + 2.4, 30, 33, -0.4, 0.4, "steel", 0.15)


@icon
def curtain(s):
    s.box(-15, 15, 0, 33, -2, 2, "steel", -0.08)
    for i in range(2):
        for j in range(3):
            x0, y0 = -13.5 + i * 14, 1.5 + j * 10.5
            s.box(x0, x0 + 13, y0, y0 + 9.5, 1.6, 2.4, "glass", 0.05 * ((i + j) % 2))

    def post(c, sc):
        a, b = sc.pt((-12, 31, 2.5)), sc.pt((10, 3, 2.5))
        c.set(c.line(*a, *b, 2) & (c.img[..., 3] > 0), P["sunglass"][5])
    return post


@icon
def floors(s):
    for k in range(3):
        y = k * 11
        s.box(-17, 17, y, y + 3, -11, 11, "concrete", 0.03 * k)
        if k < 2:
            for x in (-14, 14):
                for z in (-8, 8):
                    s.box(x - 1.3, x + 1.3, y + 3, y + 11, z - 1.3, z + 1.3, "steel")
    s.box(-6, 6, 33, 34.5, -4, 4, "hiviz")


# ------------------------------------------------------------------ currencies and people
@icon
def cash(s):
    for k in range(4):
        s.box(-14 + k * 0.6, 14 + k * 0.6, k * 3, k * 3 + 3, -8, 8, "cash", 0.04 * k)
    s.box(-3, 3.6, 0, 12.4, -8.4, 8.4, "hiviz")


@icon
def rep(s):
    s.box(-6, -1, 12, 30, -0.6, 0.6, "safety", -0.05)
    s.box(1, 6, 12, 30, -0.6, 0.6, "safety")
    s.cylinder((0, 12, -1.6), (0, 12, 1.6), 12, "rep", n=20)

    def post(c, sc):
        cx, cy = sc.pt((0, 12, 1.7))
        r = 7.5 * sc.s
        pts = []
        for k in range(10):
            a = -math.pi / 2 + k * math.pi / 5
            rr = r if k % 2 == 0 else r * 0.45
            pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
        c.fill(c.poly(pts), 0.9, "rep", 0.6)
    return post


@icon
def charter(s):
    s.box(-15, 15, 0, 1.4, -11, 7, "white", 0.1)
    s.cylinder((-15, 2.5, -11), (15, 2.5, -11), 2.6, "white", 0.05)
    s.cylinder((-15, 2.5, 7), (15, 2.5, 7), 2.6, "white", -0.05)
    s.box(-3, 3, 1.4, 1.6, -9, 9, "safety", -0.1)
    s.cylinder((0, 1.5, 2), (0, 3.4, 2), 5.2, "charter", n=16)

    def post(c, sc):
        for k in range(4):
            a, b = sc.pt((-12, 1.5, -7 + k * 3)), sc.pt((-5, 1.5, -7 + k * 3))
            c.set(c.line(*a, *b, 1), P["ink"][2])
    return post


@icon
def crew(s):
    s.cylinder((0, 0, 0), (0, 1.6, 0), 19, "hiviz", -0.08, n=24)
    s.cylinder((0, 1.6, 0), (0, 9, 0), 13, "hiviz", n=24, r2=12)
    s.cylinder((0, 9, 0), (0, 14, 0), 12, "hiviz", n=24, r2=8.5)
    s.cylinder((0, 14, 0), (0, 16.2, 0), 8.5, "hiviz", 0.06, n=24, r2=4)
    s.box(-1.6, 1.6, 2, 16.6, -13.4, 13.4, "hiviz", 0.14)  # ridge


# ------------------------------------------------------------------ equipment
def wheels(s, xs, z, r=5, w=3):
    for x in xs:
        s.cylinder((x, r, z - w), (x, r, z + w), r, "roof", 0.05, n=14)
        s.cylinder((x, r, z + w), (x, r, z + w + 0.4), r * 0.55, "hiviz", -0.05, n=10)  # painted rim


@icon
def excavator(s):
    s.box(-16, 10, 0, 5, -10, -4, "steel", -0.1)
    s.box(-16, 10, 0, 5, 4, 10, "steel", -0.1)
    s.box(-14, 8, 5, 12, -8, 8, "hiviz")
    s.box(-12, -2, 12, 22, -7, 2, "hiviz", 0.05)
    s.box(-11.5, -2.5, 14, 20, 1.6, 2.2, "glass")
    s.beam((4, 11, 0), (16, 26, 0), 3.4, "hiviz", 0.1)
    s.beam((16, 26, 0), (22, 10, 0), 2.8, "hiviz", 0.05)
    s.box(18, 25, 3, 10, -4, 4, "steel")


@icon
def loader(s):
    s.box(-16, 6, 4, 13, -7, 7, "hiviz")
    s.box(-12, -2, 13, 24, -6, 6, "hiviz", 0.05)
    s.box(-11.5, -2.5, 15, 22, 5.6, 6.2, "glass")
    wheels(s, (-11, 2), -8, 6, 2.5)
    wheels(s, (-11, 2), 8, 6, 2.5)
    s.beam((4, 10, 0), (14, 6, 0), 2.6, "steel")
    s.box(13, 21, 0, 10, -9, 9, "steel", 0.05)


@icon
def mixer(s):
    s.box(-18, 18, 3, 7, -7, 7, "steel", -0.08)
    wheels(s, (-12, 0, 12), -7.5, 4, 1.5)
    wheels(s, (-12, 0, 12), 7.5, 4, 1.5)
    s.box(10, 19, 7, 18, -7, 7, "safety")
    s.box(17.5, 19.5, 11, 16, -6, 6, "glass")
    s.cylinder((-16, 11, 0), (8, 18, 0), 8.5, "cement", n=16, r2=5)
    s.cylinder((-19, 10, 0), (-16, 11, 0), 6, "cement", -0.1, n=16, r2=8.5)

    def post(c, sc):
        for k in range(3):
            a, b = sc.pt((-12 + k * 7, 4 + k * 2, 8)), sc.pt((-9 + k * 7, 20 + k * 2, 3))
            c.set(c.line(*a, *b, 1.4) & (c.img[..., 3] > 0), P["hiviz"][5])
    return post


@icon
def kiln(s):
    for x in (-10, 8):
        s.box(x - 3, x + 3, 0, 8 + (x + 10) * 0.12, -6, 6, "concrete")
    s.cylinder((-22, 9, 0), (20, 14, 0), 7.5, "rebar", -0.05, n=16)
    for x in (-10, 8):
        s.cylinder((x - 1, 9 + (x + 22) * 0.12, 0), (x + 1, 9 + (x + 22) * 0.12, 0), 8.6, "steel", 0.1, n=16)

    def post(c, sc):
        p = sc.pt((-22.3, 9, 0))
        c.fill(c.disc(*p, 4.2 * sc.s, 6 * sc.s), np.clip(1 - np.hypot(c.X - p[0], c.Y - p[1]) / (6 * sc.s), 0, 1), "lamp")
    return post


@icon
def bender(s):
    s.box(-16, 16, 0, 12, -9, 9, "hiviz", -0.05)
    s.box(-17, 17, 12, 14, -10, 10, "steel")
    s.cylinder((4, 14, 0), (4, 17, 0), 6, "steel", 0.1, n=16)
    s.cylinder((4, 17, 0), (4, 20, 0), 1.6, "steel", 0.2, n=8)
    s.beam((-22, 16, 6), (4, 16, 6), 2, "rebar")
    s.beam((10, 16, 0), (10, 16, -14), 2, "rebar")
    s.cylinder((4, 16, 6), (10, 16, 0), 1, "rebar", n=6)


@icon
def mill(s):
    for x in (-12, 12):
        s.box(x - 3, x + 3, 0, 28, -6, 6, "steel")
    s.cylinder((-9, 9, 0), (9, 9, 0), 5, "duct", 0.1, n=16)
    s.cylinder((-9, 19.5, 0), (9, 19.5, 0), 5, "duct", 0.1, n=16)
    s.box(-15, 15, 28, 31, -7, 7, "hiviz")
    s.box(-6, 6, 13.6, 15, -2, 22, "lamp", 0.2)


@icon
def float_(s):
    s.box(-20, 20, 0, 9, -10, 10, "steel", -0.05)
    s.box(-18, 18, 9, 9.4, -8, 8, "lamp", 0.2)
    s.box(-18, 18, 9.4, 10, -6, 6, "sunglass", 0.25)
    for x in (-12, 0, 12):
        s.box(x - 1, x + 1, 9, 22, -10, -8.5, "steel")
        s.box(x - 1, x + 1, 9, 22, 8.5, 10, "steel")
        s.box(x - 1, x + 1, 22, 24, -10, 10, "hiviz", 0.05)


@icon
def drawer(s):
    s.box(-18, 18, 0, 10, -8, 8, "duct", -0.08)
    for i, x in enumerate((-10, 1, 12)):
        s.cylinder((x, 10, 0), (x, 15, 0), 5.5 - i * 0.6, "steel", n=16)
        s.cylinder((x, 15, 0), (x, 16, 0), 4.6 - i * 0.6, "copper", 0.15, n=16)
    s.beam((-22, 14, 6), (-10, 14, 5.6), 1, "copper", 0.2)
    s.beam((-10, 14, -5.6), (1, 14, 5), 1, "copper", 0.2)
    s.beam((1, 14, -4.6), (12, 14, 4.5), 1, "copper", 0.2)


@icon
def brake(s):
    s.box(-20, 20, 0, 18, -4, 4, "steel")
    s.box(-21, 21, 18, 26, -6, 6, "hiviz")
    s.box(-18, 18, 12, 13, 4, 16, "duct", 0.15)
    for x in (-16, 16):
        s.box(x - 2.4, x + 2.4, 0, 3, -9, 9, "steel", -0.1)


@icon
def yard(s):
    s.box(-20, 20, 0, 4, -11, 11, "concrete", -0.05)
    s.box(-15, 15, 4, 7, -7, 7, "precast")
    s.box(-5, 5, 4.4, 7.4, -2.5, 2.5, "dirt")
    for x in (-18, 18):
        s.box(x - 1.4, x + 1.4, 4, 28, -11, -8.6, "hiviz")
        s.box(x - 1.4, x + 1.4, 4, 28, 8.6, 11, "hiviz")
    s.box(-20, 20, 28, 31, -11, 11, "hiviz", 0.08)
    s.beam((2, 28, 0), (2, 12, 0), 0.7, "ink")
    s.box(-1, 5, 10, 12, -2, 2, "safety")


@icon
def rig(s):
    s.box(-14, 6, 0, 6, -8, 8, "safety", -0.05)
    s.cylinder((-4, 6, 0), (-4, 9, 0), 6, "steel", n=14)
    s.beam((-4, 9, 0), (12, 30, 0), 3, "hiviz")
    s.beam((12, 30, 0), (12, 22, 0), 0.8, "ink")
    s.box(6, 18, 6, 22, 0.5, 1.3, "glass", 0.05)
    s.box(9, 15, 19, 22, 1.3, 2.6, "steel", 0.1)

    def post(c, sc):
        a, b = sc.pt((8, 20, 1.4)), sc.pt((14, 9, 1.4))
        c.set(c.line(*a, *b, 1.5) & (c.img[..., 3] > 0), P["sunglass"][5])
    return post


@icon
def crane(s):
    s.box(-6, 6, 0, 3, -6, 6, "concrete")
    for x in (-3, 3):
        for z in (-3, 3):
            s.beam((x, 3, z), (x, 42, z), 1.1, "hiviz")
    for y in range(3, 42, 6):
        s.beam((-3, y, 3), (3, y + 6, 3), 0.8, "hiviz", 0.08)
        s.beam((3, y, -3), (3, y + 6, 3), 0.8, "hiviz", -0.05)
    s.box(-4, 4, 40, 45, -4, 4, "hiviz", 0.05)
    s.box(-3, 2, 41, 45, 4, 4.5, "glass")
    s.beam((-14, 46, 0), (30, 46, 0), 2.2, "hiviz", 0.08)
    s.box(-16, -9, 42, 47, -2.5, 2.5, "concrete")
    s.beam((0, 46, 0), (0, 52, 0), 1.4, "hiviz")
    s.beam((0, 52, 0), (26, 46.5, 0), 0.6, "ink")
    s.beam((22, 45, 0), (22, 30, 0), 0.6, "ink")
    s.box(20, 24, 28, 30, -1.5, 1.5, "safety")


@icon
def pump(s):
    s.box(-18, 16, 3, 8, -7, 7, "steel", -0.08)
    wheels(s, (-12, 2, 10), -7.5, 4, 1.5)
    wheels(s, (-12, 2, 10), 7.5, 4, 1.5)
    s.box(8, 17, 8, 18, -7, 7, "hiviz")
    s.box(15.5, 17.5, 11, 16, -6, 6, "glass")
    s.box(-16, 6, 8, 13, -6, 6, "cement")
    s.cylinder((-8, 13, 0), (-8, 17, 0), 4, "steel", n=12)
    s.beam((-8, 17, 0), (6, 34, 0), 2.4, "hiviz", 0.05)
    s.beam((6, 34, 0), (24, 30, 0), 2, "hiviz", 0.1)
    s.beam((24, 30, 0), (25, 20, 0), 1.6, "ink")


# ------------------------------------------------------------------ system glyphs
@icon
def method(s):
    s.box(-16, 16, 0, 1.2, -12, 10, "glass", 0.05)
    s.cylinder((-16, 2.2, -12), (16, 2.2, -12), 2.4, "glass", -0.08)

    def post(c, sc):
        col = P["white"][2]
        for a, b in [((-12, -8), (12, -8)), ((-12, -8), (-12, 7)), ((-12, 7), (12, 7)), ((12, -8), (12, 7)),
                     ((0, -8), (0, 2)), ((-12, 2), (6, 2))]:
            p, q = sc.pt((a[0], 1.3, a[1])), sc.pt((b[0], 1.3, b[1]))
            c.set(c.line(*p, *q, 1), col)
    return post


@icon
def permit(s):
    s.box(-13, 13, 0, 1, -15, 13, "white", 0.15)
    s.cylinder((5, 1, 5), (5, 2.2, 5), 6, "safety", n=16)

    def post(c, sc):
        for k in range(5):
            a, b = sc.pt((-10, 1.1, -12 + k * 3.4)), sc.pt((6 if k else 9, 1.1, -12 + k * 3.4))
            c.set(c.line(*a, *b, 1), P["ink"][2])
    return post


@icon
def inspection(s):
    s.box(-12, 12, 0, 1.6, -15, 13, "wood")
    s.box(-10.5, 10.5, 1.6, 2.2, -12, 12, "white", 0.15)
    s.box(-5, 5, 1.6, 4, -16, -12, "steel", 0.15)

    def post(c, sc):
        a, b, d = sc.pt((-6, 2.3, 0)), sc.pt((-1, 2.3, 6)), sc.pt((8, 2.3, -6))
        c.set(c.line(*a, *b, 2.4) | c.line(*b, *d, 2.4), P["cash"][4])
    return post


@icon
def overtime(s):
    s.cylinder((0, 15, -2), (0, 15, 2), 15, "hiviz", n=24)
    s.cylinder((0, 15, 2), (0, 15, 2.4), 12.5, "white", 0.2, n=24)
    s.box(-2, 2, 30, 33, -1.5, 1.5, "steel")

    def post(c, sc):
        o = sc.pt((0, 15, 2.5))
        a = sc.pt((0, 24, 2.5))
        b = sc.pt((6, 15, 2.5))
        c.set(c.line(*o, *a, 1.6) | c.line(*o, *b, 1.6), P["ink"][1])
        c.set(c.disc(*o, 1.3), P["safety"][3])
    return post


# ------------------------------------------------------------------ UI glyphs (same camera and light)
@icon
def equip(s):
    s.beam((-16, 2, 6), (12, 26, -6), 3.2, "steel", 0.1)
    s.box(8, 20, 22, 30, -8, -2, "steel", 0.15)
    s.beam((-14, 2, -6), (12, 22, 6), 3, "wood")
    s.box(8, 22, 18, 26, 2, 9, "hiviz")


@icon
def bid(s):
    s.box(-12, 12, 0, 1.6, -15, 13, "hiviz", -0.1)
    s.box(-10.5, 10.5, 1.6, 2.2, -12, 12, "white", 0.15)
    s.box(-5, 5, 1.6, 4, -16, -12, "steel", 0.15)

    def post(c, sc):
        for k in range(5):
            a, b = sc.pt((-8, 2.3, -8 + k * 4)), sc.pt((k % 2 and 4 or 8, 2.3, -8 + k * 4))
            c.set(c.line(*a, *b, 1), P["ink"][2])
    return post


@icon
def skyline(s):
    for x, h, pal in ((-16, 22, "concrete"), (-6, 38, "glass"), (5, 30, "precast"), (14, 18, "steel")):
        s.box(x - 4.5, x + 4.5, 0, h, -4.5, 4.5, pal)
    s.box(-7, -5, 38, 46, -1, 1, "steel", 0.2)


@icon
def firm(s):
    s.box(-14, 14, 0, 22, -9, 9, "precast")
    s.box(-15, 15, 22, 25, -10, 10, "roof", 0.1)
    for x in (-9, 0, 9):
        for y in (5, 14):
            s.box(x - 3, x + 3, y, y + 5, 9, 9.6, "glass", 0.1)
    s.box(10, 11, 25, 40, 4, 5, "steel", 0.2)
    s.box(11, 20, 34, 40, 4.4, 4.6, "hiviz", 0.1)


@icon
def console(s):
    s.box(-17, 17, 0, 24, -6, 6, "ink", 0.2)
    s.box(-15, 15, 2, 22, 6, 6.5, "roof", -0.1)

    def post(c, sc):
        for k, w in enumerate((10, 16, 7)):
            a, b = sc.pt((-12, 18 - k * 5, 6.6)), sc.pt((-12 + w, 18 - k * 5, 6.6))
            c.set(c.line(*a, *b, 1.4), P["hiviz"][5 - k])
    return post


@icon
def menu(s):
    s.box(-16, 16, 0, 13, -8, 8, "safety")
    s.box(-16.4, 16.4, 11, 13.6, -8.4, 8.4, "safety", 0.12)  # lid
    s.box(-3, 3, 7, 10, 8, 8.8, "steel", 0.2)  # latch
    s.box(-9, -7, 13.6, 20, -1, 1, "steel", 0.1)
    s.box(7, 9, 13.6, 20, -1, 1, "steel", 0.1)
    s.box(-9, 9, 19, 21, -1, 1, "steel", 0.2)  # handle
    s.box(-15, 15, 4, 5, 8, 8.4, "safety", -0.15)


@icon
def zoomin(s):
    s.beam((6, 4, 0), (16, -6, 0), 4, "wood")
    s.cylinder((-4, 14, -2), (-4, 14, 2), 12, "steel", n=20)
    s.cylinder((-4, 14, 2), (-4, 14, 2.3), 9.5, "glass", 0.25, n=20)

    def post(c, sc):
        o = sc.pt((-4, 14, 2.4))
        c.set(c.line(o[0] - 5 * sc.s, o[1], o[0] + 5 * sc.s, o[1], 2) | c.line(o[0], o[1] - 5 * sc.s, o[0], o[1] + 5 * sc.s, 2),
              P["white"][3])
    return post


@icon
def reset(s):
    for a in (0, 2.1, 4.2):
        s.beam((0, 20, 0), (11 * math.cos(a), 0, 11 * math.sin(a)), 2, "wood", 0.05)
    s.box(-5, 5, 20, 22, -5, 5, "steel", 0.1)
    s.box(-5, 5, 22, 31, -3.5, 3.5, "hiviz")
    s.cylinder((-4, 27, 0), (-9, 27, 0), 2.6, "steel", 0.15, n=10)  # scope
    s.cylinder((-9, 27, 0), (-9.6, 27, 0), 2.2, "glass", 0.3, n=10)


@icon
def lock(s):
    s.box(-12, 12, 0, 18, -5, 5, "hiviz")
    s.cylinder((-7, 18, 0), (-7, 26, 0), 2, "steel", 0.2, n=8)
    s.cylinder((7, 18, 0), (7, 26, 0), 2, "steel", 0.2, n=8)
    s.box(-7, 7, 25, 29, -2, 2, "steel", 0.2)
    s.box(-2, 2, 6, 12, 5, 5.6, "ink", 0.3)


@icon
def zoomout(s):
    s.beam((6, 4, 0), (16, -6, 0), 4, "wood")
    s.cylinder((-4, 14, -2), (-4, 14, 2), 12, "steel", n=20)
    s.cylinder((-4, 14, 2), (-4, 14, 2.3), 9.5, "glass", 0.25, n=20)

    def post(c, sc):
        o = sc.pt((-4, 14, 2.4))
        c.set(c.line(o[0] - 5 * sc.s, o[1], o[0] + 5 * sc.s, o[1], 2), P["white"][3])
    return post


# ------------------------------------------------------------------ build phases (job panel)
@icon
def prep(s):
    s.box(-18, 18, 0, 4, -10, 10, "dirt")
    rock(s, (8, 6, -2), 6, "dirt", 3, squash=0.6)
    s.beam((-10, 4, 0), (-2, 30, 0), 2, "wood", 0.05)  # shovel handle
    s.box(-4.5, -0.5, 29, 31, -1, 1, "wood", 0.1)
    s.box(-13, -7, 1, 9, -3.5, 3.5, "steel", 0.15)  # blade
    s.box(12, 13, 0, 18, -0.5, 0.5, "wood", 0.1)  # survey stake
    s.box(12.2, 18, 14, 17, -0.3, 0.3, "safety", 0.1)


@icon
def foundation(s):
    s.box(-18, 18, 0, 5, -11, 11, "concrete")
    s.box(-8, 8, 5, 12, -6, 6, "concrete", 0.05)
    for x in (-5, 0, 5):
        s.box(x - 0.8, x + 0.8, 12, 26, -0.8, 0.8, "rebar", 0.1)
    s.box(-6, 6, 22, 23.2, -0.9, 0.9, "rebar", 0.15)


@icon
def structure(s):
    for x in (-13, 13):
        for z in (-9, 9):
            s.box(x - 1.4, x + 1.4, 0, 30, z - 1.4, z + 1.4, "steel")
    for y in (14, 28):
        s.box(-14, 14, y, y + 2.4, -9.6, -8.4, "steel", 0.05)
        s.box(-14, 14, y, y + 2.4, 8.4, 9.6, "steel", 0.05)
        s.box(12.4, 13.6, y, y + 2.4, -9, 9, "steel", 0.05)
    s.beam((-13, 2, 9), (13, 14, 9), 1.4, "hiviz", 0.05)  # brace


@icon
def envelope(s):
    s.box(-15, 15, 0, 30, -2, 2, "precast")
    for x in (-8, 6):
        for y in (5, 18):
            s.box(x - 4, x + 4, y, y + 8, 1.8, 2.4, "glass", 0.1)
    s.box(-16, 16, 30, 32, -3, 3, "steel", 0.15)

    def post(c, sc):
        a, b = sc.pt((-11, 12, 2.5)), sc.pt((-6, 6, 2.5))
        c.set(c.line(*a, *b, 1) & (c.img[..., 3] > 0), P["sunglass"][5])
    return post


@icon
def mep(s):
    s.cylinder((-18, 6, -4), (18, 6, -4), 3.4, "copper", n=12)
    s.cylinder((-6, 6, -4), (-6, 26, -4), 3.4, "copper", 0.05, n=12)
    s.cylinder((-6, 18, -4), (-6, 19, -4), 4.2, "steel", 0.2, n=12)
    s.box(4, 16, 0, 22, 2, 7, "steel", -0.05)  # panel box
    s.box(5, 15, 2, 21, 7, 7.6, "concrete", 0.1)
    s.box(8, 12, 12, 16, 7.6, 8.2, "hiviz", 0.1)


@icon
def fitout(s):
    s.box(-18, 4, 0, 4, -10, 10, "steel", -0.05)  # paint tray
    s.box(-17, 3, 4, 4.6, -9, 9, "hiviz", 0.05)  # paint
    s.cylinder((-6, 9, -9), (-6, 9, 9), 5, "hiviz", 0.1, n=14)  # loaded roller
    s.beam((-6, 9, 9), (-6, 9, 12), 1.6, "steel", 0.1)
    s.beam((-6, 9, 12), (8, 18, 12), 1.6, "steel", 0.1)
    s.beam((8, 18, 12), (20, 26, 12), 3.2, "safety")


# ------------------------------------------------------------------ render
CAM = dict(yaw=-35, pitch=26)
TARGET = 50


def render(k):
    fn = DRAW[k]
    probe = Scene(32, 40, 1.0, **CAM)
    fn(probe)
    xs = [p[0] for f in probe.faces for p in f[3]]
    ys = [p[1] for f in probe.faces for p in f[3]]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    s = TARGET / max(w, h * 1.04)
    s = min(s, 2.2)
    cx = 32 - ((min(xs) + max(xs)) / 2 - 32) * s
    cy = 30 - ((min(ys) + max(ys)) / 2 - 40) * s
    c = Canvas(N, N)
    # ground shadow under the drawing
    sh_y = min(61, cy + (max(ys) - 40) * s - 1)
    c.set(c.disc(32, sh_y, w * s * 0.42, 2.8), P["ink"][0], 110)
    c.set(c.disc(32, sh_y, w * s * 0.3, 1.9), P["ink"][0], 170)
    sc = Scene(cx, cy, s, **CAM)
    post = fn(sc)
    sc.paint(c)
    if post:
        post(c, sc)
    finish(c)
    c.outline(col=(20, 11, 22))
    return c


SUN = np.array([255, 196, 108], float)
BOUNCE = np.array([98, 52, 112], float)


def finish(c):
    """Same light on every icon: a warm rim where the low sun from the left catches an edge, a violet bounce on the
    shadow side. This is what makes the set read as one family at small sizes."""
    a = c.img[..., 3] >= 200
    left = np.roll(a, 1, 1) & np.roll(a, 1, 0)
    rim = a & ~(np.roll(a, 1, 1) & np.roll(a, 1, 0) & np.roll(np.roll(a, 1, 1), 1, 0))
    shade = a & ~np.roll(a, -1, 1) & ~rim
    rgb = c.img[..., :3].astype(float)
    lum = rgb.mean(-1, keepdims=True) / 255
    k_rim = (0.55 * (0.4 + lum))[..., 0]
    rgb[rim] = rgb[rim] * (1 - k_rim[rim, None]) + SUN * k_rim[rim, None]
    rgb[shade] = rgb[shade] * 0.6 + BOUNCE * 0.4
    c.img[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    del left
