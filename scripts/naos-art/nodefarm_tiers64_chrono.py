"""Chrono (Still room) button sprites at 64 px: Tick, Minute, Hour, Loop, Epoch, Eternity, plus the zone icon (an hourglass).
Palette: ember-orange with brass fittings, cream clock faces, deep red shadows."""
import math

import numpy as np

from nodefarm_icon_kit import (Canvas, P, X, Y, angle, box, disc, lin, line, path, poly, radial, rect, ring, shadow, star4,
                               tilted_ring, wave)


def face(c, cx, cy, R, p, hands=((1.0, 0.8, 1.6),), ticks=12, rim_pal="brass"):
    """Clock face; hands = (turns per loop, length fraction, width)."""
    c.fill(disc(cx, cy, R), 0.5 + 0.4 * (1 - lin(cx - R, cy - R, cx + R, cy + R)), rim_pal, outline=rim_pal)
    c.fill(disc(cx, cy, R - 2.2), 0.82 + 0.15 * (1 - radial(cx - 2, cy - 2, R)), "eg")
    for k in range(ticks):
        a = 2 * math.pi * k / ticks
        c.set(disc(cx + (R - 4) * math.cos(a), cy + (R - 4) * math.sin(a), 0.8 if k % 3 else 1.1), P["ch"][2])
    for (turns, frac, w) in hands:
        a = 2 * math.pi * (p * turns) - math.pi / 2
        c.set(line(cx, cy, cx + (R - 3) * frac * math.cos(a), cy + (R - 3) * frac * math.sin(a), w), P["ch"][1])
    c.set(disc(cx, cy, 1.4), P["ch"][5])


def hourglass(c, cx, top, bot, w, p, frame="brass"):
    mid = (top + bot) / 2
    c.fill(rect(cx - w / 2 - 3, top - 3, cx + w / 2 + 3, top) | rect(cx - w / 2 - 3, bot, cx + w / 2 + 3, bot + 3), 0.7, frame, outline=frame)
    for x in (cx - w / 2 - 2, cx + w / 2 + 1):
        c.fill(rect(x, top, x + 1.6, bot), 0.55, frame)
    g_top = poly([(cx - w / 2, top), (cx + w / 2, top), (cx + 1.2, mid), (cx - 1.2, mid)])
    g_bot = poly([(cx - 1.2, mid), (cx + 1.2, mid), (cx + w / 2, bot), (cx - w / 2, bot)])
    c.fill(g_top | g_bot, 0.15, "sg")
    lvl_t = mid - (mid - top - 2) * (1 - p)
    lvl_b = bot - (bot - mid - 2) * p
    c.fill(g_top & (Y >= lvl_t), 0.55 + 0.35 * (1 - lin(cx - w / 2, 0, cx + w / 2, 0)), "ch")
    c.fill(g_bot & (Y >= lvl_b), 0.55 + 0.35 * (1 - lin(cx - w / 2, 0, cx + w / 2, 0)), "ch")
    c.set(rect(cx - 0.5, mid, cx + 0.5, bot - 1) & (((np.floor(Y) + int(p * 16)) % 3) != 0) & ~(Y >= lvl_b), P["ch"][6])
    c.set(line(cx - w / 2 + 2, top + 1, cx - 2, mid - 2, 1) & g_top, P["white"][1])


def tick(c, p):
    """Tick: a metronome, its arm swinging."""
    shadow(c, 32, 13, 56)
    body = poly([(23, 55), (28, 26), (36, 26), (41, 55)])
    c.fill(body, 0.3 + 0.5 * (1 - lin(23, 26, 41, 55)), "ch", outline="ch")
    c.fill(rect(26, 40, 38, 52), 0.85, "eg")
    a = math.radians(-90 + 28 * math.sin(2 * math.pi * p))
    tx, ty = 32 + 36 * math.cos(a), 48 + 36 * math.sin(a)
    c.set(line(32, 48, tx, ty, 1.8), P["brass"][5])
    c.fill(rect(tx - 2.5 + (32 - tx) * 0.35, ty + 6, tx + 2.5 + (32 - tx) * 0.35, ty + 10), 0.8, "brass", outline="brass")
    c.set(disc(32, 48, 1.6), P["brass"][5])


def minute(c, p):
    """Minute: a stopwatch, its hand sweeping one turn per loop."""
    shadow(c, 32, 16, 59)
    c.fill(rect(29, 8, 35, 13) | rect(27, 6, 37, 9), 0.7, "brass", outline="brass")
    c.fill(rect(43, 12, 47, 16), 0.6, "brass", outline="brass")
    face(c, 32, 35, 20, p, hands=((1.0, 0.95, 1.6),), ticks=12, rim_pal="ch")
    c.fill(disc(32, 35, 20) & ~disc(32, 35, 18), 0.7 + 0.25 * (1 - lin(12, 15, 52, 55)), "ch")


def hour(c, p):
    shadow(c, 32, 16, 61)
    hourglass(c, 32, 9, 56, 22, p)


def loop(c, p):
    """Loop: a ring of clockwork gears turning around a glowing ouroboros arrow."""
    shadow(c, 32, 22, 60)
    def gear(cx, cy, R, teeth, rot, pal, v):
        a = angle(cx, cy)
        r = np.hypot(X - cx, Y - cy)
        tooth = ((a * teeth + rot) % 1.0) < 0.5
        m = (r <= R - 2) | ((r <= R) & tooth)
        c.fill(m, v + 0.4 * (1 - lin(cx - R, cy - R, cx + R, cy + R)), pal, outline=pal)
        c.fill(disc(cx, cy, R * 0.45), 0.15, pal)
        c.fill(disc(cx, cy, 2), 0.8, "brass")
    gear(20, 22, 12, 10, p, "brass", 0.4)
    gear(42, 27, 14, 12, -p * 10 / 12, "ch", 0.35)
    gear(27, 44, 11, 9, -p * 10 / 9, "brass", 0.3)
    arc = ring(32, 33, 25, 22.5) & ((((angle(32, 33) - p) % 1.0)) < 0.78)
    c.fill(arc, 0.9, "ember")
    a = 2 * math.pi * (p + 0.78)
    hx, hy = 32 + 23.7 * math.cos(a), 33 + 23.7 * math.sin(a)
    c.fill(disc(hx, hy, 3), 1.0, "ember")
    c.glow(arc, P["ember"][3], 2, 110, 1)


def epoch(c, p):
    """Epoch: a clock tower, the big face's hands turning, a pendulum light swinging in the arch."""
    shadow(c, 32, 22, 61)
    f, t, s = box(c, 18, 26, 26, 34, 5, "ch", -0.15)
    c.fill(poly([(16, 26), (31, 6), (48, 24), (48, 26)]), 0.4 + 0.3 * (1 - lin(16, 6, 48, 26)), "brass", outline="brass")
    c.set(line(31, 2, 31, 7, 1.2), P["brass"][5])
    face(c, 31, 36, 10, p, hands=((1.0, 0.9, 1.4), (1 / 12, 0.6, 2.0)), ticks=12)
    arch = disc(31, 54, 5, 6) & (Y < 60)
    c.fill(arch, 0.05, "ch")
    sx = 31 + 3 * math.sin(2 * math.pi * p)
    c.set(line(31, 49, sx, 56, 1) & arch, P["brass"][4])
    c.set(disc(sx, 56.5, 1.3), P["ember"][4])
    for y in (28, 46):
        c.set(rect(20, y, 42, y + 1), P["ch"][1])


def eternity(c, p):
    """Eternity: an hourglass held in two orbits that never stop, motes of sand circling it."""
    shadow(c, 32, 20, 61)
    rings = [(28, 8, -20), (26, 9, 25)]
    masks = [tilted_ring(32, 33, rx, ry, t, 1.6) for rx, ry, t in rings]
    for m, front in masks:
        c.fill(m & ~front, 0.4, "ch")
    hourglass(c, 32, 12, 54, 18, (p * 2) % 1.0, frame="brass")
    for (m, front), pal in zip(masks, ("ember", "brass")):
        c.fill(m & front, 0.85, pal)
    for k in range(6):
        rx, ry, tilt = rings[k % 2]
        ang = 2 * math.pi * (p + k / 6)
        u, v = rx * math.cos(ang), ry * math.sin(ang)
        tt = math.radians(tilt)
        c.set(disc(32 + u * math.cos(tt) - v * math.sin(tt), 33 + u * math.sin(tt) + v * math.cos(tt), 1.1), P["ember"][5])
    c.glow(disc(32, 33, 10), P["ch"][5], 3, int(40 + 60 * wave(p)), 1)


DRAW = [tick, minute, hour, loop, epoch, eternity]


def draw(t, p):
    c = Canvas()
    DRAW[t](c, p)
    return c.finish()


def icon(p):
    """Zone icon: the hourglass inside a broken clock ring, sand running."""
    c = Canvas()
    shadow(c, 32, 18, 61)
    r = ring(32, 33, 27, 24) & ~(np.abs(Y - 33) < 3)
    c.fill(r, 0.45 + 0.4 * (1 - lin(5, 6, 59, 60)), "ch", outline="ch")
    for k in range(12):
        a = 2 * math.pi * k / 12
        on = k == int(p * 12)
        c.set(disc(32 + 25.5 * math.cos(a), 33 + 25.5 * math.sin(a), 1.2), P["ember"][5] if on else P["ch"][2])
    hourglass(c, 32, 11, 55, 22, p)
    return c.finish()
