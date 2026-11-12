"""Origin (Root chamber) button sprites at 64 px: Bit, Seed, Root, Bootstrap, Kernel, Node zero, plus the zone icon.
Palette: terminal green with deep shadow greens, steel, and a warm earth brown for soil and roots."""
import math

import numpy as np

from nodefarm_icon_kit import (Canvas, P, X, Y, angle, box, disc, lin, line, orb, path, poly, radial, rect, ring, shadow, star4,
                               wave)


def soil(c, x0, x1, y, h=6):
    m = rect(x0, y, x1, y + h) | disc((x0 + x1) / 2, y, (x1 - x0) / 2, 3)
    c.fill(m, 0.25 + 0.3 * (1 - lin(x0, y - 3, x1, y + h)), "eg", outline="eg")
    c.set(m & (((np.floor(X) * 3 + np.floor(Y) * 7) % 11) == 0), P["eg"][1])
    return m


def bit(c, p):
    """Bit: one glowing pixel-cube flipping between 0 and 1."""
    shadow(c, 32, 11, 50)
    f, t, s = box(c, 24, 30, 15, 15, 5, "or", -0.1)
    one = (p % 0.5) < 0.25
    if one:
        c.set(rect(31, 33, 33, 42) | rect(29.5, 33, 31, 35) | rect(29, 41, 35, 43), P["or"][7])
    else:
        c.set(ring(32, 37.5, 4, 2.6, 1.4), P["or"][7])
    c.glow(f | t | s, P["or"][4], 2, 120 if one else 60, 1)


def seed(c, p):
    """Seed: a green-lit seed in soil, its first shoot uncurling."""
    shadow(c, 32, 17, 57)
    soil(c, 14, 50, 48)
    seedm = disc(32, 46, 7, 5)
    c.fill(seedm, 0.35 + 0.5 * (1 - radial(29, 43, 9)), "or", outline="or")
    g = wave(p)
    h = 10 + 6 * g
    stem = path([(32, 43), (31, 43 - h * 0.5), (33, 43 - h)], 2)
    c.fill(stem, 0.75, "or")
    leaf = disc(36 + g, 43 - h, 4, 2) | disc(28 - g, 43 - h + 2, 3.4, 1.8)
    c.fill(leaf, 0.85, "or", outline="or")
    c.set(disc(32, 46, 1.6), P["or"][7])


def root(c, p):
    """Root: a sprout above the soil and a branching root system below, a signal running down the roots."""
    shadow(c, 32, 22, 62)
    soil(c, 6, 58, 26, 34)
    c.fill(path([(32, 26), (32, 12)], 2.4), 0.7, "or")
    c.fill(disc(37, 12, 5, 2.4) | disc(27, 15, 4, 2), 0.85, "or", outline="or")
    branches = [[(32, 27), (30, 38), (22, 46), (14, 54)], [(32, 27), (34, 40), (44, 48), (52, 56)], [(30, 38), (32, 52), (30, 60)], [(22, 46), (26, 56)], [(44, 48), (40, 58)]]
    for b in branches:
        c.fill(path(b, 1.8), 0.55, "or")
    for k, b in enumerate(branches[:3]):
        q = (p + k * 0.33) % 1.0
        i = q * (len(b) - 1)
        a_, b_ = b[int(i)], b[min(int(i) + 1, len(b) - 1)]
        f = i - int(i)
        c.set(disc(a_[0] + (b_[0] - a_[0]) * f, a_[1] + (b_[1] - a_[1]) * f, 1.6), P["or"][7])


def bootstrap(c, p):
    """Bootstrap: a boot with a pull-strap, circuit lines lighting up the leather as it loads."""
    shadow(c, 30, 22, 61)
    boot = poly([(18, 10), (36, 10), (36, 38), (52, 46), (54, 54), (54, 58), (12, 58), (14, 46), (18, 40)])
    c.fill(boot, 0.25 + 0.4 * (1 - lin(12, 10, 54, 58)), "film", outline="film")
    c.fill(rect(12, 54, 54, 58), 0.6, "or", outline="or")
    strap = path([(26, 10), (24, 3), (31, 2), (30, 10)], 2.2)
    c.fill(strap, 0.7, "eg", outline="eg")
    lines = [[(22, 16), (22, 30), (28, 36), (40, 42)], [(30, 14), (30, 26), (34, 30)], [(18, 46), (30, 46), (46, 50)]]
    prog = p
    for k, l in enumerate(lines):
        m = path(l, 1.2) & boot
        c.set(m, P["or"][2])
        segs = list(zip(l, l[1:]))
        lens = [math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in segs]
        total = sum(lens)
        d = prog * total
        for (a, b), L in zip(segs, lens):
            if d <= 0:
                break
            f = min(1.0, d / L)
            c.set(path([a, (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)], 1.2) & boot, P["or"][6])
            d -= L
    for (x, y) in [(22, 16), (30, 14), (18, 46)]:
        c.set(disc(x, y, 1.4), P["or"][7])


def kernel(c, p):
    """Kernel: a processor core in a socket, rings of light pulsing out from the green die."""
    shadow(c, 32, 24, 61)
    for k in range(6):
        for side in range(4):
            x = 14 + k * 7
            pins = [rect(x, 6, x + 2, 12), rect(x, 52, x + 2, 58), rect(6, x, 12, x + 2), rect(52, x, 58, x + 2)][side]
            c.fill(pins, 0.75, "brass")
    pkg = rect(11, 11, 53, 53)
    c.fill(pkg, 0.2 + 0.3 * (1 - lin(11, 11, 53, 53)), "steel", outline="steel")
    die = rect(21, 21, 43, 43)
    c.fill(die, 0.35 + 0.3 * (1 - lin(21, 21, 43, 43)), "or", outline="or")
    q = p
    for k in range(2):
        s = 3 + ((q + k * 0.5) % 1.0) * 10
        m = rect(32 - s, 32 - s, 32 + s, 32 + s) & ~rect(32 - s + 1, 32 - s + 1, 32 + s - 1, 32 + s - 1)
        c.set(m & die, P["or"][6])
    c.fill(disc(32, 32, 3), 1.0, "or")
    c.set(disc(32, 32, 1.2), P["white"][2])
    c.set(rect(12, 12, 14, 14), P["or"][7])


def node_zero(c, p):
    """Node zero: the first node, an old terminal box with one green eye, its roots reaching into the dark, a halo above."""
    shadow(c, 32, 26, 62)
    for k in range(5):
        x0 = 18 + k * 7
        pts = [(x0, 46), (x0 + (k - 2) * 2, 52), (x0 + (k - 2) * 5, 58), (x0 + (k - 2) * 7, 63)]
        c.fill(path(pts, 2), 0.45, "or")
        q = (p + k * 0.2) % 1.0
        i = q * 3
        a_, b_ = pts[int(i)], pts[min(int(i) + 1, 3)]
        f = i - int(i)
        c.set(disc(a_[0] + (b_[0] - a_[0]) * f, a_[1] + (b_[1] - a_[1]) * f, 1.2), P["or"][7])
    f, t, s = box(c, 14, 22, 32, 26, 7, "steel", -0.1)
    eye = disc(30, 35, 8)
    c.fill(eye, 0.1, "or")
    g = wave(p)
    c.fill(disc(30, 35, 5 + g * 1.5), 0.6 + 0.4 * g, "or")
    c.set(disc(30, 35, 2), P["white"][2])
    c.set(rect(17, 25, 21, 27), P["or"][6])
    c.set(rect(36, 44, 44, 45), P["or"][4])
    c.fill(path([(40, 16), (42, 6)], 1.4), 0.7, "steel")
    c.set(disc(42, 5, 1.4), P["or"][7] if (p % 0.5) < 0.25 else P["or"][3])
    for k in range(3):
        q = (p + k / 3) % 1.0
        rr = 4 + q * 12
        c.set(ring(42, 5, rr + 0.7, rr - 0.5, 0.6) & ~c.alpha & (Y < 20), P["or"][5], int(220 * (1 - q)))
    c.glow(eye, P["or"][4], 3, 110, 2)


DRAW = [bit, seed, root, bootstrap, kernel, node_zero]


def draw(t, p):
    c = Canvas()
    DRAW[t](c, p)
    return c.finish()


def icon(p):
    """Zone icon: the root node, a green eye in a box with roots below."""
    c = Canvas()
    node_zero(c, p)
    return c.finish()
