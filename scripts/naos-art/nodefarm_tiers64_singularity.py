"""Singularity (Event horizon) button sprites at 64 px: Mote, Well, Lens, Disk, Horizon, Singularity, plus the zone icon.
Palette: amber accretion light around pure black, with cyan-white photon rings."""
import math

import numpy as np

from nodefarm_icon_kit import (Canvas, P, X, Y, angle, disc, lin, line, path, poly, radial, rect, ring, star4, wave)


def accretion(c, cx, cy, rx, ry, inner, p, k=1.0, pal="sn"):
    """A tilted accretion disk: swirl bands turning, brighter on the approaching (left) side."""
    r = np.hypot((X - cx) / rx, (Y - cy) / ry)
    a = angle(cx, cy)
    m = (r <= 1) & (r >= inner)
    sw = ((a * 3 + r * 2 - p * k) % 1.0) < 0.5
    doppler = 0.25 * (1 - lin(cx - rx, 0, cx + rx, 0))
    c.fill(m, 0.3 + 0.35 * sw + 0.35 * (1 - r) + doppler, pal)
    return m


def hole(c, cx, cy, r, ring_pal="pu"):
    c.fill(disc(cx, cy, r), 0.0, "hole", dither=0)
    c.set(ring(cx, cy, r + 0.9, r - 0.1) & ~disc(cx, cy, r - 0.1), P[ring_pal][6])


def mote(c, p):
    g = wave(p)
    c.set(ring(32, 34, 7 + g, 5.5 + g), P["sn"][5])
    hole(c, 32, 34, 4.5, "sn")
    for k in range(3):
        a = 2 * math.pi * (p + k / 3)
        c.set(disc(32 + 11 * math.cos(a), 34 + 5 * math.sin(a), 0.9), P["sn"][6])


def well(c, p):
    """Well: a gravity-well grid funnelling down to a point, a mote spiralling in."""
    for k in range(6):
        rr = 4 + k * 4.5
        dy = 9 / (1 + k * 0.6)
        m = ring(32, 30 + dy, rr + 0.6, rr - 0.6, 0.38)
        c.set(m, P["sn"][2 + min(k, 3)] if k < 4 else P["sn"][2])
    for a in range(0, 360, 30):
        ang = math.radians(a)
        pts = [(32 + rr * math.cos(ang), 30 + 9 / (1 + (rr - 4) / 4.5 * 0.6) + rr * 0.38 * math.sin(ang)) for rr in np.linspace(4, 26.5, 10)]
        c.set(path(pts, 0.9), P["sn"][2])
    hole(c, 32, 39, 3, "sn")
    q = p
    rr = 24 * (1 - q) + 3
    a = 2 * math.pi * q * 2
    c.fill(disc(32 + rr * math.cos(a), 30 + 9 / (1 + (rr - 4) / 4.5 * 0.6) + rr * 0.38 * math.sin(a), 2.2), 0.9, "sn")


def lens(c, p):
    """Lens: an Einstein ring, a background star smeared into an arc around the dark core, shimmering."""
    for k, (x, y) in enumerate([(8, 10), (56, 14), (52, 54), (10, 50), (20, 30)]):
        c.fill(star4(x, y, 1.6 + (int(p * 5) == k) * 1.6), 1.0, "pu" if k % 2 else "sn")
    r = np.hypot(X - 32, Y - 33)
    a = angle(32, 33)
    shimmer = 0.15 * np.sin(a * 2 * math.pi * 3 - p * 2 * math.pi)
    m = (r <= 17) & (r >= 12)
    c.fill(m, 0.55 + 0.35 * (1 - np.abs(r - 14.5) / 2.5) + shimmer, "sn")
    c.set((r <= 15) & (r >= 14) & (((a + p) % 0.25) < 0.1), P["white"][2])
    hole(c, 32, 33, 9, "pu")
    c.glow(m, P["sn"][4], 3, 120, 2)


def disk(c, p):
    m = accretion(c, 32, 34, 28, 9, 0.32, p)
    hole(c, 32, 33, 8, "sn")
    front = m & (Y > 34)
    c.fill(front & (np.hypot((X - 32) / 28, (Y - 34) / 9) > 0.32), 0.55 + 0.4 * (((angle(32, 34) * 3 + np.hypot((X - 32) / 28, (Y - 34) / 9) * 2 - p) % 1.0) < 0.5), "sn")
    c.glow(m, P["sn"][4], 2, 90, 1)


def horizon(c, p):
    """Horizon: a black hole with the disk bent over its top (the lensed far side) and a thin photon ring."""
    arc = (np.hypot(X - 32, (Y - 33) * 1.0) <= 17) & (np.hypot(X - 32, (Y - 33) * 1.0) >= 12.5) & (Y < 33)
    c.fill(arc, 0.5 + 0.4 * (((angle(32, 33) * 3 + p) % 1.0) < 0.5), "sn")
    m = accretion(c, 32, 35, 30, 8, 0.38, p)
    hole(c, 32, 33, 11, "pu")
    front = m & (Y > 35)
    c.fill(front, 0.55 + 0.4 * (((angle(32, 35) * 3 - p) % 1.0) < 0.5) + 0.2 * (1 - lin(2, 0, 62, 0)), "sn")
    c.glow(m | arc, P["sn"][4], 3, 110, 2)


def singularity(c, p):
    """Singularity: the full thing, disk, lensed arc, photon ring and two jets firing from the poles."""
    for sgn in (-1, 1):
        L = 22 + 6 * wave(p, 2)
        jet = poly([(30.5, 33), (32 - 2.5, 33 + sgn * L), (32 + 2.5, 33 + sgn * L), (33.5, 33)])
        c.fill(jet, 0.6 + 0.35 * (((Y * sgn - p * 32) % 8) < 4), "pu")
        c.glow(jet, P["pu"][5], 2, 120, 1)
    arc = (np.hypot(X - 32, Y - 33) <= 18) & (np.hypot(X - 32, Y - 33) >= 13) & (Y < 33) & (np.abs(X - 32) > 3)
    c.fill(arc, 0.5 + 0.4 * (((angle(32, 33) * 3 + p) % 1.0) < 0.5), "sn")
    m = accretion(c, 32, 35, 31, 9, 0.38, p, 1.0)
    hole(c, 32, 33, 11.5, "pu")
    front = m & (Y > 35)
    c.fill(front, 0.55 + 0.4 * (((angle(32, 35) * 3 - p) % 1.0) < 0.5) + 0.2 * (1 - lin(1, 0, 63, 0)), "sn")
    c.glow(m | arc, P["sn"][4], 3, 130, 2)


DRAW = [mote, well, lens, disk, horizon, singularity]


def draw(t, p):
    c = Canvas()
    DRAW[t](c, p)
    return c.finish()


def icon(p):
    """Zone icon: the event horizon with its turning disk."""
    c = Canvas()
    horizon(c, p)
    return c.finish()
