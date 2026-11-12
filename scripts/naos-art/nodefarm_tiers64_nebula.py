"""Nebula (Cloud deck) button sprites at 64 px: Dust, Haze, Veil, Pillar, Nursery, Cloud deck, plus the zone icon.
Palette: pink gas with dusk-violet shadows and cyan-white young stars."""
import math

import numpy as np

from nodefarm_icon_kit import (Canvas, P, X, Y, box, disc, lin, line, path, poly, radial, rect, shadow, star4, wave)


def puff(c, blobs, p, v=0.0, drift=1.0, pal="nb"):
    """A cloud made of overlapping discs; the gas is shaded top-left and its dither drifts slowly."""
    m = np.zeros((64, 64), bool)
    for (x, y, r) in blobs:
        m |= disc(x + drift * math.sin(2 * math.pi * p + x * 0.1), y, r)
    noise = 0.12 * np.sin((X + p * 8) * 0.5) * np.cos(Y * 0.45)
    c.fill(m, 0.3 + v + 0.5 * (1 - lin(4, 4, 60, 60)) + noise, pal, outline="dusk")
    return m


def twinkle(c, pts, p, big=False):
    for k, (x, y) in enumerate(pts):
        on = int(p * len(pts)) == k
        c.fill(star4(x, y, (4 if big else 3) if on else 1.6), 1.0, "pu" if k % 2 else "nb")


def dust(c, p):
    rng = np.random.default_rng(1)
    for k in range(14):
        a = 2 * math.pi * k / 14
        r = 6 + rng.uniform(0, 12)
        x = 32 + r * math.cos(a + p * 2 * math.pi * 0.25)
        y = 34 + r * 0.7 * math.sin(a + p * 2 * math.pi * 0.25)
        c.set(disc(x, y, 1.0 + (k % 3) * 0.4), P["nb"][5 if k % 3 else 6])
    c.set(disc(32, 34, 5) & ((np.floor(X) + np.floor(Y)) % 2 == 0), P["nb"][3], 180)


def haze(c, p):
    m = puff(c, [(26, 36, 9), (36, 33, 10), (42, 38, 7), (31, 41, 8)], p)
    twinkle(c, [(36, 30)], p)


def veil(c, p):
    """Veil: long ribbons of gas hanging like a curtain, rippling."""
    m = np.zeros((64, 64), bool)
    for k in range(5):
        x0 = 14 + k * 9
        pts = [(x0 + 4 * math.sin(2 * math.pi * (p + y / 40 + k * 0.2)), y) for y in range(10, 58, 4)]
        ribbon = path(pts, 5 - abs(k - 2) * 0.6)
        c.fill(ribbon & ~m, 0.35 + 0.15 * k + 0.25 * (1 - lin(0, 10, 0, 58)), "nb" if k % 2 == 0 else "dusk")
        m |= ribbon
    c.outline(m, "dusk")
    twinkle(c, [(24, 22), (44, 40)], p)


def pillar(c, p):
    """Pillar: three tall columns of gas, lit at their crowns, a newborn star flaring at each tip."""
    cols = [(18, 30, 7), (33, 12, 8.5), (48, 24, 6.5)]
    allm = np.zeros((64, 64), bool)
    for k, (cx, top, w) in enumerate(cols):
        sway = 1.2 * math.sin(2 * math.pi * p + k)
        lump = 1.4 * np.sin(Y * 0.55 + k * 2) + 0.8 * np.sin(Y * 1.3 + k)
        m = (np.abs(X - cx - sway * (60 - Y) / 50 - lump) < w * (0.55 + 0.45 * (Y - top) / (62 - top))) & (Y >= top) & (Y < 62)
        m |= disc(cx + sway, top + 1, w * 0.55)
        c.fill(m & ~allm, 0.2 + 0.25 * (1 - lin(0, top, 0, 62)) + 0.2 * (X < cx), "nb" if k != 1 else "nb")
        crown = m & (Y < top + 6)
        c.fill(crown, 0.8, "nb")
        allm |= m
    c.outline(allm, "dusk")
    for k, (cx, top, w) in enumerate(cols):
        on = int(p * 3) == k
        c.fill(star4(cx, top - 2, 4 if on else 2, 1.2), 1.0, "pu")


def nursery(c, p):
    """Nursery: a glowing cloud bed with young stars switching on inside it one by one."""
    m = puff(c, [(18, 40, 12), (32, 34, 15), (46, 40, 12), (32, 48, 11)], p, 0.05)
    hearts = [(24, 38), (34, 30), (42, 42), (30, 46)]
    for k, (x, y) in enumerate(hearts):
        g = wave(p, 1, k * 0.25)
        c.set(disc(x, y, 3 + 2 * g) & m, P["nb"][6])
        c.fill(star4(x, y, 2 + 3 * g, 1.2), 1.0, "pu")
    c.glow(m, P["nb"][4], 2, 80, 1)


def deck(c, p):
    """Cloud deck: a flat cloud shelf with a small observation platform riding on it, stars wheeling above."""
    for k in range(6):
        a = 2 * math.pi * (p / 6 + k / 6)
        x, y = 32 + 26 * math.cos(a), 12 + 6 * math.sin(a)
        c.fill(star4(x, y, 2.4 if k % 2 else 1.4), 1.0, "pu" if k % 2 else "nb")
    m = puff(c, [(10, 46, 9), (22, 42, 11), (36, 44, 12), (50, 42, 10), (58, 47, 6), (32, 52, 12)], p, 0.0, 0.6)
    f, t, s = box(c, 22, 26, 18, 8, 4, "dusk", 0.2)
    c.fill(rect(24, 18, 38, 26), 0.25, "dusk", outline="dusk")
    for x in range(26, 37, 4):
        c.set(rect(x, 20, x + 2, 23), P["nb"][6] if (x // 4 + int(p * 4)) % 2 else P["pu"][5])
    c.fill(rect(30, 10, 32, 18), 0.6, "steel")
    on = (p % 0.5) < 0.25
    c.set(disc(31, 9, 1.5), P["nb"][7] if on else P["nb"][3])
    for x in (25, 37):
        c.fill(rect(x, 34, x + 2, 42), 0.4, "dusk")
    c.glow(m, P["nb"][4], 2, 70, 1)


DRAW = [dust, haze, veil, pillar, nursery, deck]


def draw(t, p):
    c = Canvas()
    DRAW[t](c, p)
    return c.finish()


def icon(p):
    """Zone icon: a pink cloud with a bright young star at its heart."""
    c = Canvas()
    m = puff(c, [(18, 36, 12), (32, 28, 15), (46, 34, 13), (30, 44, 12), (44, 46, 9)], p, 0.0, 0.8)
    g = wave(p)
    c.set(disc(32, 34, 5 + 2 * g) & m, P["nb"][6])
    c.fill(star4(32, 34, 6 + 3 * g, 1.6), 1.0, "pu")
    twinkle(c, [(14, 24), (50, 22), (52, 52)], p)
    c.glow(m, P["nb"][4], 2, 70, 1)
    return c.finish()
