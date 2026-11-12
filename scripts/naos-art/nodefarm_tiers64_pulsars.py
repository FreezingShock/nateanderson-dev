"""Pulsars (Beacon spire) button sprites at 64 px: Blink, Beat, Beacon, Lighthouse, Magnetar, Spire, plus the zone icon.
Palette: electric cyan with deep blue shadows, white cores and violet field lines."""
import math

import numpy as np

from nodefarm_icon_kit import (Canvas, P, X, Y, box, disc, lin, line, orb, path, poly, radial, rect, ring, shadow, star4, tilted_ring,
                               wave)


def beam(c, cx, cy, ang, L, w0, w1, a=210):
    """A widening light beam from (cx, cy) at angle ang (radians), dithered so it reads as light, not a solid."""
    dx, dy = math.cos(ang), math.sin(ang)
    nx, ny = -dy, dx
    pts = [(cx + nx * w0, cy + ny * w0), (cx + dx * L + nx * w1, cy + dy * L + ny * w1), (cx + dx * L - nx * w1, cy + dy * L - ny * w1), (cx - nx * w0, cy - ny * w0)]
    m = poly(pts) & ~c.alpha
    t = np.clip(((X - cx) * dx + (Y - cy) * dy) / L, 0, 1)
    chk = (np.floor(X) + np.floor(Y)) % 2 == 0
    c.set(m & (t >= 0.55) & chk, P["pu"][4], a)
    c.set(m & (t >= 0.25) & (t < 0.55), P["pu"][5], a)
    c.set(m & (t >= 0.25) & (t < 0.55) & chk, P["pu"][6], a)
    c.set(m & (t < 0.25), P["pu"][7], min(255, a + 40))
    return m


def blink(c, p):
    on = (p % 0.5) < 0.2
    r = 6 if on else 3.5
    s = star4(32, 34, r * 1.8, 1.6)
    c.fill(s, 0.9, "pu")
    o = orb(c, 32, 34, r, "pu", 0.3)
    if on:
        c.glow(o, P["pu"][5], 4, 150, 2)


def beat(c, p):
    o = orb(c, 32, 34, 7, "pu", 0.25)
    for k in range(2):
        q = (p * 2 + k * 0.5) % 1.0
        rr = 8 + q * 20
        c.set(ring(32, 34, rr + 0.8, rr - 0.6) & ~c.alpha & ((np.floor(X) + np.floor(Y)) % 2 == 0), P["pu"][5], int(255 * (1 - q)))
    c.glow(o, P["pu"][5], 3, 140, 2)


def beacon(c, p):
    """Beacon: a dish on a post sweeping a beam back and forth."""
    shadow(c, 32, 14, 59)
    c.fill(poly([(26, 58), (30, 34), (34, 34), (38, 58)]), 0.5, "steel", outline="steel")
    ang = math.radians(-90 + 55 * math.sin(2 * math.pi * p))
    beam(c, 32, 30, ang, 32, 3, 10)
    c.fill(disc(32, 30, 8, 5), 0.6 + 0.3 * (1 - lin(24, 25, 40, 35)), "steel", outline="steel")
    c.fill(disc(32, 29, 3), 1.0, "pu")


def lighthouse(c, p):
    """Lighthouse: a striped tower whose lamp throws a turning beam."""
    shadow(c, 32, 20, 61)
    tower = poly([(24, 60), (27, 22), (37, 22), (40, 60)])
    stripes = ((np.floor((Y - 22) / 7) % 2) == 0)
    c.fill(tower, 0.3 + 0.5 * (1 - lin(24, 0, 40, 0)) - 0.2 * stripes, "pu", outline="pu")
    c.set(tower & stripes & (X < 31), P["white"][1])
    c.fill(rect(24, 20, 40, 23), 0.6, "steel", outline="steel")
    c.fill(rect(27, 12, 37, 20), 0.15, "deep", outline="steel")
    c.fill(poly([(25, 12), (32, 5), (39, 12)]), 0.55, "steel", outline="steel")
    a = 2 * math.pi * p
    side = math.cos(a)
    if side > 0:
        beam(c, 32, 16, 0, 30 * side, 2, 6 * side + 1)
    else:
        beam(c, 32, 16, math.pi, -30 * side, 2, -6 * side + 1)
    c.fill(disc(32, 16, 2.6), 1.0, "white")


def magnetar(c, p):
    """Magnetar: a star in looping field lines, twin polar beams sweeping like a lighthouse in space."""
    a = 2 * math.pi * p * 0.5
    ang = math.radians(-80) + 0.5 * math.sin(2 * math.pi * p)
    beam(c, 32, 32, ang, 30, 2, 6)
    beam(c, 32, 32, ang + math.pi, 30, 2, 6)
    for k, (rx, ry, t) in enumerate([(14, 26, 0), (12, 22, 0)]):
        for side in (-1, 1):
            m = ring(32 + side * rx * 0.75, 32, rx * 0.8, rx * 0.8 - 1.4, 1.5)
            c.set(m & ~c.alpha & (((np.floor(Y) + int(p * 8)) % 3) != 0), P["violet"][4])
    o = orb(c, 32, 32, 8, "pu", 0.25)
    c.glow(o, P["pu"][5], 3, 160, 2)


def spire(c, p):
    """Spire: a needle tower with stacked emitter rings, pulses racing up and out of the tip."""
    shadow(c, 32, 22, 61)
    c.fill(poly([(14, 60), (24, 50), (40, 50), (50, 60)]), 0.35, "steel", outline="steel")
    needle = poly([(26, 51), (31, 4), (33, 4), (38, 51)])
    c.fill(needle, 0.3 + 0.55 * (1 - lin(26, 0, 38, 0)), "steel", outline="steel")
    for k, y in enumerate((42, 32, 22, 13)):
        w = 9 - k * 1.6
        rm, front = tilted_ring(32, y, w, w * 0.32, 0, 1.6)
        on = int(p * 4) == (3 - k)
        c.fill(rm, 0.95 if on else 0.55, "pu")
    q = (p * 2) % 1.0
    rr = 3 + q * 22
    c.set(ring(32, 5, rr + 0.8, rr - 0.6, 0.6) & ~c.alpha, P["pu"][6], int(240 * (1 - q)))
    c.fill(star4(32, 4, 4 + 2 * wave(p, 2), 1.2), 1.0, "white")


DRAW = [blink, beat, beacon, lighthouse, magnetar, spire]


def draw(t, p):
    c = Canvas()
    DRAW[t](c, p)
    return c.finish()


def icon(p):
    """Zone icon: a pulsar, a bright core with two long beams turning and a pulse ring."""
    c = Canvas()
    ang = math.radians(-55) + 2 * math.pi * p / 2
    beam(c, 32, 32, ang, 31, 2, 7, 200)
    beam(c, 32, 32, ang + math.pi, 31, 2, 7, 200)
    q = (p * 2) % 1.0
    rr = 10 + q * 16
    c.set(ring(32, 32, rr + 0.8, rr - 0.6) & ~c.alpha, P["pu"][5], int(220 * (1 - q)))
    o = orb(c, 32, 32, 10, "pu", 0.25)
    c.set(disc(29, 29, 2), P["white"][2])
    c.glow(o, P["pu"][5], 3, 160, 2)
    return c.finish()
