"""Aether (Signal void) button sprites at 64 px: Spark, Wisp, Current, Stream, Vortex, Rift, plus the zone icon (the ringed orb).
Palette: mint aether with deep green shadows and sky-blue accents. Everything here floats, so no ground shadows on the
lower tiers, just a faint glow pool."""
import math

import numpy as np

from nodefarm_icon_kit import (Canvas, P, X, Y, angle, disc, lin, line, orb, path, poly, radial, rect, shadow, star4, tilted_ring,
                               wave)


def pool(c, cx, y, w):
    c.set(disc(cx, y, w, 2.2) & ((np.floor(X) + np.floor(Y)) % 2 == 0), P["ae"][2], 140)


def spark(c, p):
    pool(c, 32, 52, 10)
    bob = 2 * math.sin(2 * math.pi * p)
    r = 9 + 3 * wave(p, 2)
    s = star4(32, 32 + bob, r, 2.2)
    c.fill(s, 0.6 + 0.4 * (1 - radial(32, 32 + bob, r)), "ae")
    c.set(disc(32, 32 + bob, 1.6), P["white"][2])
    c.glow(s, P["ae"][4], 3, 120, 2)
    for k in range(3):
        q = (p + k / 3) % 1.0
        c.set(disc(32 + 10 * math.cos(2 * math.pi * (q + k / 3)), 32 + bob + 10 * math.sin(2 * math.pi * (q + k / 3)), 0.8), P["ae"][6])


def wisp(c, p):
    """Wisp: a flame-like spirit drifting, its tail curling behind it."""
    pool(c, 32, 56, 12)
    bob = 2.5 * math.sin(2 * math.pi * p)
    pts = []
    for i in range(14):
        s = i / 13
        pts.append((36 - s * 18 + 4 * math.sin(2 * math.pi * (p * 2 - s * 1.2)) * s, 30 + bob + s * 14 + 3 * s * s))
    tail = np.zeros((64, 64), bool)
    for i, (a, b) in enumerate(zip(pts, pts[1:])):
        tail |= line(*a, *b, 9 * (1 - i / 13) + 1)
    c.fill(tail, 0.35 + 0.4 * (1 - lin(36, 30, 14, 50)), "ae", outline="ae")
    head = orb(c, 37, 28 + bob, 9, "ae", 0.15)
    c.glow(head | tail, P["ae"][4], 3, 110, 2)


def current(c, p):
    """Current: a bright pulse riding a sine wave between two node posts."""
    shadow(c, 32, 24, 56)
    for x in (8, 56):
        c.fill(rect(x - 2, 30, x + 2, 56), 0.5, "steel", outline="steel")
        c.fill(disc(x, 30, 4), 0.85, "ae", outline="ae")
    pts = [(8 + i * 2, 36 + 8 * math.sin(2 * math.pi * (i / 24 * 1.5 - p))) for i in range(25)]
    m = path(pts, 2)
    c.fill(m, 0.6, "ae")
    c.glow(m, P["ae"][3], 2, 100, 1)
    for k in range(2):
        q = (p + k * 0.5) % 1.0
        i = int(q * 24)
        x, y = pts[i]
        c.set(disc(x, y, 2.4), P["ae"][7])
        c.set(disc(x, y, 1.1), P["white"][2])


def stream(c, p):
    """Stream: a river of signal flowing out of a ring portal and into another."""
    shadow(c, 32, 26, 58)
    pts = [(12, 22), (22, 18), (34, 26), (44, 36), (52, 42)]
    body = path(pts, 9)
    flow = ((np.floor(X * 0.6 - Y * 0.4 - p * 16) % 8) < 4)
    c.fill(body, 0.35 + 0.35 * flow + 0.2 * (1 - lin(10, 18, 54, 44)), "ae", outline="ae")
    c.fill(path(pts, 3) & flow, 0.9, "sky")
    for (cx, cy, rot) in [(12, 22, 0.4), (52, 42, 0.4)]:
        rm, front = tilted_ring(cx, cy, 9, 11, 25, 2.4)
        c.fill(rm, 0.55 + 0.4 * front, "sky", outline="sky")
    for k in range(4):
        q = (p + k / 4) % 1.0
        i = q * (len(pts) - 1)
        a, b = pts[int(i)], pts[min(int(i) + 1, len(pts) - 1)]
        f = i - int(i)
        c.set(disc(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - 6, 0.8), P["white"][2])


def vortex(c, p):
    """Vortex: a spiral of aether turning around a dark eye."""
    shadow(c, 32, 22, 60)
    r = np.hypot(X - 32, (Y - 32) * 1.25)
    a = angle(32, 32)
    arms = ((a * 3 - np.log1p(r) * 1.1 + p) % 1.0) < 0.45
    disk = r < 25
    c.fill(disk & arms, 0.35 + 0.6 * (1 - r / 25), "ae")
    c.fill(disk & ~arms & (r < 23), 0.15 + 0.25 * (1 - r / 23), "sky")
    c.outline(disk, "ae")
    c.fill(disc(32, 32, 5, 4), 0.0, "hole", dither=0)
    c.set(disc(32, 32, 6, 5) & ~disc(32, 32, 5, 4), P["ae"][7])
    c.glow(disk, P["ae"][3], 2, 90, 1)


def rift(c, p):
    """Rift: a tear in space, light pouring out of it, shards of the edges drifting."""
    shadow(c, 32, 18, 61)
    sway = math.sin(2 * math.pi * p)
    outer = poly([(32, 2), (38 + sway, 16), (35, 30), (41 - sway, 44), (32, 62), (26 + sway, 46), (29, 32), (23 - sway, 18)])
    inner = poly([(32, 8), (35.5 + sway, 17), (33, 30), (37.5 - sway, 44), (32, 56), (28.5 + sway, 45), (31, 32), (26.5 - sway, 19)])
    c.glow(outer, P["ae"][4], 4, 120, 3)
    c.fill(outer, 0.55 + 0.4 * (1 - np.abs(X - 32) / 9), "ae")
    c.fill(inner, 0.6 + 0.4 * wave(p, 2), "white")
    c.set(inner & (np.abs(X - 32 - 0.5 * np.sin(Y * 0.4 + p * 6.28)) < 0.8), P["sky"][4])
    for k in range(6):
        q = (p + k / 6) % 1.0
        side = 1 if k % 2 else -1
        x = 32 + side * (8 + q * 18)
        y = 10 + k * 8 + math.sin(q * 6) * 2
        m = poly([(x, y - 2), (x + 1.6, y), (x, y + 2), (x - 1.6, y)])
        c.fill(m, 0.9 - q * 0.6, "ae")


DRAW = [spark, wisp, current, stream, vortex, rift]


def draw(t, p):
    c = Canvas()
    DRAW[t](c, p)
    return c.finish()


def icon(p):
    """Zone icon: the aether orb in two orbits; the orbiting motes go round once per loop."""
    c = Canvas()
    pool(c, 32, 58, 16)
    bob = 1.5 * math.sin(2 * math.pi * p)
    rings = [(27, 8, -18), (26, 7, 30)]
    masks = [tilted_ring(32, 31 + bob, rx, ry, t, 1.8) for rx, ry, t in rings]
    for m, front in masks:
        c.fill(m & ~front, 0.45, "ae")
    o = orb(c, 32, 31 + bob, 15, "ae", 0.1)
    c.set(disc(26, 25 + bob, 2.2), P["white"][2])
    for (m, front), pal in zip(masks, ("ae", "sky")):
        c.fill(m & front, 0.85, pal)
    for k, (rx, ry, tilt) in enumerate(rings):
        ang = 2 * math.pi * (p + k * 0.5)
        u, v = rx * math.cos(ang), ry * math.sin(ang)
        tt = math.radians(tilt)
        c.set(disc(32 + u * math.cos(tt) - v * math.sin(tt), 31 + bob + u * math.sin(tt) + v * math.cos(tt), 2), P["white"][2])
    c.glow(o, P["ae"][4], 2, 90, 1)
    return c.finish()
