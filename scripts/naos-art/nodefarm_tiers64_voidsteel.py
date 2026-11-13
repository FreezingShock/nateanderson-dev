"""Voidsteel (Hollow forge) button sprites at 64 px: Ingot, Bar, Plate, Anvil, Crucible, Abyss, plus the zone icon.
Palette: violet-black metal with lilac edges, a void sheen that crawls over it, ember sparks from the forge."""
import math

import numpy as np

from nodefarm_icon_kit import (Canvas, P, X, Y, angle, box, disc, lin, line, path, poly, radial, rect, ring, rotp, shadow, star4,
                               wave)


def void_sheen(c, m, p, k=1.0):
    """Purple shimmer: a soft band of lighter violet travelling across, plus scattered void specks twinkling."""
    pos = -20 + ((p * k) % 1.0) * 120
    c.set(m & (np.abs((X * 0.8 + Y) - pos) < 2.2), P["vs"][6])
    tw = m & (((np.floor(X) * 7 + np.floor(Y) * 13 + int(p * 8) * 5) % 37) == 0)
    c.set(tw, P["vs"][7])


def ingot(c, x, y, w, v=0.0):
    top = poly([(x + 3, y), (x + w - 3, y), (x + w, y + 4), (x, y + 4)])
    fr = rect(x, y + 4, x + w, y + 11)
    c.fill(fr, 0.3 + v + 0.3 * (1 - lin(x, y + 4, x + w, y + 11)), "vs", outline="vs")
    c.fill(top, 0.7 + v, "vs", outline="vs")
    c.rim(top, P["vs"][7], 0, -1)
    return fr | top


def ingot_t(c, p):
    shadow(c, 32, 14, 51)
    m = ingot(c, 20, 37, 24)
    void_sheen(c, m, p)


def bar(c, p):
    shadow(c, 32, 22, 55)
    m = ingot(c, 8, 42, 46, -0.05) | ingot(c, 13, 32, 40, 0.05)
    void_sheen(c, m, p)


def plate(c, p):
    """Plate: a riveted armour plate, the rivets catching light in sequence."""
    shadow(c, 32, 21, 59)
    pl = poly([(12, 14), (52, 14), (54, 30), (46, 54), (18, 54), (10, 30)])
    c.fill(pl, 0.25 + 0.5 * (1 - lin(10, 14, 54, 54)), "vs", outline="vs")
    c.rim(pl, P["vs"][6])
    inner = poly([(17, 19), (47, 19), (48, 30), (42, 49), (22, 49), (16, 30)])
    c.fill(inner, 0.15 + 0.3 * (1 - lin(16, 19, 48, 49)), "vs")
    c.set(line(32, 20, 32, 48, 1.4), P["vs"][5])
    rv = [(15, 18), (49, 18), (13, 30), (51, 30), (20, 51), (44, 51)]
    for i, (x, y) in enumerate(rv):
        c.fill(disc(x, y, 1.8), 0.6, "steel")
        if int(p * 6) == i:
            c.spark(x, y, 1, P["vs"][7])
    void_sheen(c, inner, p)


def anvil(c, p):
    """Anvil: a voidsteel anvil, a hammer coming down twice per loop, sparks flying off each strike."""
    shadow(c, 32, 24, 60)
    base = poly([(18, 58), (22, 48), (42, 48), (46, 58)])
    c.fill(base, 0.3, "vs", outline="vs")
    waist = rect(25, 40, 39, 48)
    c.fill(waist, 0.2 + 0.3 * (1 - lin(25, 0, 39, 0)), "vs", outline="vs")
    top = poly([(6, 32), (14, 30), (50, 30), (58, 33), (50, 40), (14, 40)])
    c.fill(top, 0.35 + 0.5 * (1 - lin(6, 30, 58, 40)), "vs", outline="vs")
    c.rim(top, P["vs"][7], 0, -1)
    hot = rect(26, 27, 38, 30)
    q = (p * 2) % 1.0
    c.fill(hot, 0.5 + 0.5 * (1 - q), "ember", outline="ember")
    hy = 26 - 16 * (abs(math.sin(math.pi * q)) if q > 0.2 else 0) - (0 if q > 0.2 else -0)
    hy = 8 + 18 * (1 - math.sin(math.pi * min(1.0, q / 1.0)) ** 2) if q > 0.12 else 26
    head = rect(26, hy - 6, 40, hy)
    c.fill(path([(38, hy - 3), (54, hy - 10)], 2.4), 0.6, "eg", outline="eg")
    c.fill(head, 0.5 + 0.3 * (1 - lin(26, 0, 40, 0)), "steel", outline="steel")
    if q < 0.3:
        rng = np.random.default_rng(3)
        for k in range(8):
            a = math.radians(rng.uniform(-170, -10))
            d = 4 + q * 40 * rng.uniform(0.5, 1)
            c.set(disc(32 + math.cos(a) * d, 27 + math.sin(a) * d * 0.7, 0.7), P["ember"][5 if q < 0.15 else 4])


def crucible(c, p):
    """Crucible: a bowl on legs holding liquid void that swirls, lilac light rising."""
    shadow(c, 32, 24, 60)
    for x in (16, 32, 48):
        c.fill(path([(32, 46), (x, 58)], 2.4), 0.45, "steel", outline="steel")
    bowl = disc(32, 34, 24, 20) & (Y >= 30)
    c.fill(bowl, 0.25 + 0.5 * (1 - lin(8, 30, 56, 54)), "vs", outline="vs")
    c.rim(bowl, P["vs"][6])
    rim = disc(32, 30, 24, 7)
    c.fill(rim, 0.6, "vs", outline="vs")
    liq = disc(32, 30.5, 21, 5.5)
    r = np.hypot((X - 32) / 21, (Y - 30.5) / 5.5)
    a = angle(32, 30.5)
    sw = ((a * 2 + r - p) % 1.0) < 0.4
    c.fill(liq, 0.15 + 0.4 * sw + 0.2 * (1 - r), "vs")
    c.set(liq & (r < 0.25), P["void"][0])
    for k in range(4):
        q = (p + k / 4) % 1.0
        x = 22 + k * 7 + 2 * math.sin(q * 8)
        c.set(disc(x, 28 - q * 22, 0.9), P["vs"][7] if q < 0.5 else P["vs"][5], int(255 * (1 - q * 0.7)))
    c.glow(liq, P["vs"][5], 2, int(60 + 90 * wave(p)), 1)


def abyss(c, p):
    """Abyss: a hole in the world, ringed with voidsteel shards that orbit and fall in."""
    shadow(c, 32, 26, 61)
    disk = disc(32, 34, 28, 14)
    r = np.hypot((X - 32) / 28, (Y - 34) / 14)
    a = angle(32, 34)
    arms = ((a * 4 + r * 1.5 - p) % 1.0) < 0.35
    c.fill(disk, 0.15 + 0.35 * arms + 0.3 * (1 - r), "vs")
    c.fill(disc(32, 34, 13, 6.5), 0.0, "void", dither=0)
    c.set(ring(32, 34, 13.8, 12.6, 0.5), P["vs"][7])
    for k in range(7):
        q = (p + k / 7) % 1.0
        ang = 2 * math.pi * (q * 0.5 + k / 7)
        rr = 1 - q * 0.55
        x, y = 32 + 26 * rr * math.cos(ang), 34 + 13 * rr * math.sin(ang) - 6 * (1 - rr) * 0
        sh = poly(rotp([(x - 2.5, y), (x, y - 2), (x + 2.5, y), (x, y + 2)], ang, x, y))
        if math.sin(ang) < 0 or rr > 0.6:
            c.fill(sh, 0.7 - q * 0.4, "vs", outline="vs")
    c.glow(disk, P["vs"][4], 3, 100, 2)


DRAW = [ingot_t, bar, plate, anvil, crucible, abyss]


def draw(t, p):
    c = Canvas()
    DRAW[t](c, p)
    return c.finish()


def icon(p):
    """Zone icon: a stack of voidsteel ingots with the void sheen crawling over them."""
    c = Canvas()
    shadow(c, 32, 26, 59)
    m = ingot(c, 6, 45, 26, -0.05) | ingot(c, 32, 45, 26, -0.03) | ingot(c, 12, 33, 40, 0.02) | ingot(c, 19, 21, 26, 0.08)
    c.set(rect(26, 25, 39, 26), P["vs"][7])
    void_sheen(c, m, p)
    return c.finish()
