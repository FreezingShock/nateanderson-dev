"""Starglass (Prism court) button sprites at 64 px: Chip, Pane, Lens, Prism, Facet, Observatory, plus the zone icon (a star).
Palette: pale ice-blue glass with prism rainbow accents and white glints."""
import math

import numpy as np

from nodefarm_icon_kit import (Canvas, P, X, Y, angle, box, cyl, disc, lin, line, path, poly, radial, rect, ring, shadow, star4,
                               wave)


def glass(c, m, v=0.0, pal="sg"):
    c.fill(m, 0.35 + v + 0.55 * (1 - lin(0, 0, 64, 64)) * 0.9, pal, outline=pal)
    c.rim(m, P["white"][2])


def sweep(c, m, p, k=1.0, w=1.6, col=None):
    pos = -20 + ((p * k) % 1.0) * 120
    c.set(m & (np.abs((X + Y) - pos) < w), col or P["white"][2])


def rainbow_band(c, m, x0, y0, x1, y1, n=None):
    """Colour `m` in prism bands across the direction (x0,y0)->(x1,y1)."""
    t = lin(x0, y0, x1, y1)
    cols = P["prism"]
    idx = np.clip((t * len(cols)).astype(int), 0, len(cols) - 1)
    for i, col in enumerate(cols):
        c.set(m & (idx == i), col)


def chip(c, p):
    shadow(c, 32, 12, 50)
    m = poly([(22, 46), (25, 34), (35, 28), (43, 36), (40, 47)])
    glass(c, m)
    c.fill(poly([(25, 34), (35, 28), (33, 38)]), 0.85, "sg")
    sweep(c, m, p)
    if 0.45 < p < 0.6:
        c.spark(36, 30, 2, P["white"][2])


def pane(c, p):
    shadow(c, 32, 18, 58)
    frame = rect(13, 12, 51, 56)
    c.fill(frame, 0.45 + 0.3 * (1 - lin(13, 12, 51, 56)), "steel", outline="steel")
    for (x0, y0, x1, y1) in [(16, 15, 31, 33), (33, 15, 48, 33), (16, 35, 31, 53), (33, 35, 48, 53)]:
        g = rect(x0, y0, x1, y1)
        c.fill(g, 0.3 + 0.4 * (1 - lin(x0, y0, x1, y1)), "sg")
        sweep(c, g, p, 1.0, 1.4)
        c.set(rect(x0 + 1, y0 + 1, x0 + 3, y0 + 2), P["white"][2])


def lens(c, p):
    """Lens: a round lens in a brass ring on a stand, focusing a beam to a bright point."""
    shadow(c, 30, 18, 59)
    c.fill(rect(22, 50, 32, 58) | rect(25, 40, 29, 52), 0.5, "brass", outline="brass")
    c.fill(disc(27, 28, 15), 0.6 + 0.3 * (1 - lin(12, 13, 42, 43)), "brass", outline="brass")
    l = disc(27, 28, 12)
    c.fill(l, 0.25 + 0.6 * (1 - radial(23, 24, 16)), "sg")
    c.set(ring(27, 28, 9, 8) & (angle(27, 28) > 0.55) & (angle(27, 28) < 0.8), P["white"][2])
    # beam converging to a focal point on the right
    beam = poly([(39, 20), (58, 28), (39, 36)])
    c.set(beam & ((np.floor(X) + np.floor(Y)) % 2 == 0), P["sg"][6], 170)
    on = wave(p, 2)
    c.fill(star4(58, 28, 3 + 2 * on), 1.0, "white")
    c.glow(disc(58, 28, 2), P["sg"][5], 3, 140, 2)


def prism(c, p):
    """Prism: a triangular glass prism splitting a white beam into a fanned rainbow."""
    shadow(c, 32, 22, 58)
    c.set(line(0, 40, 22, 36, 2), P["white"][2])
    front = poly([(32, 12), (48, 50), (16, 50)])
    side = poly([(32, 12), (40, 9), (55, 46), (48, 50)])
    c.fill(side, 0.4, "sg", outline="sg")
    c.fill(front, 0.5 + 0.4 * (1 - lin(16, 12, 48, 50)), "sg", outline="sg")
    c.rim(front, P["white"][2])
    shift_ = 4 * math.sin(2 * math.pi * p)
    fan = poly([(41, 34), (64, 22 + shift_), (64, 50 + shift_)]) & ~front & ~side
    rainbow_band(c, fan, 64, 22 + shift_, 64, 50 + shift_)
    c.set(fan & ((np.floor(X) % 2) == 0) & (X > 58), P["ink"][0], 0)
    inside = poly([(22, 37), (41, 34), (36, 40)]) & front
    c.set(inside, P["white"][2])
    sweep(c, front, p, 1.0, 1.2)


def facet(c, p):
    """Facet: a brilliant-cut gem turning, facets catching light in turn, a rainbow fire glint."""
    shadow(c, 32, 20, 60)
    crown = poly([(12, 26), (20, 16), (44, 16), (52, 26)])
    pav = poly([(12, 26), (52, 26), (32, 56)])
    c.fill(crown, 0.75, "sg", outline="sg")
    c.fill(pav, 0.45, "sg", outline="sg")
    c.fill(rect(22, 16, 42, 26) & crown, 0.95, "sg")
    k = int(p * 8)
    facets_c = [poly([(12, 26), (20, 16), (22, 26)]), poly([(20, 16), (32, 16), (27, 26), (22, 26)]), poly([(32, 16), (44, 16), (42, 26), (37, 26)]), poly([(44, 16), (52, 26), (42, 26)])]
    facets_p = [poly([(12, 26), (22, 26), (32, 56)]), poly([(22, 26), (32, 26), (32, 56)]), poly([(32, 26), (42, 26), (32, 56)]), poly([(42, 26), (52, 26), (32, 56)])]
    for i, f in enumerate(facets_c):
        c.fill(f, 0.6 + 0.35 * (((i + k) % 4) == 0), "sg")
    for i, f in enumerate(facets_p):
        c.fill(f, 0.25 + 0.15 * i + 0.4 * (((i + k) % 4) == 1), "sg")
    for x0, y0, x1, y1 in [(12, 26, 52, 26), (22, 26, 32, 56), (42, 26, 32, 56), (32, 26, 32, 56)]:
        c.set(line(x0, y0, x1, y1, 1), P["sg"][2])
    fire = disc(30 + 6 * math.sin(2 * math.pi * p), 36, 3)
    rainbow_band(c, fire & pav, 26, 32, 36, 40)
    c.spark(20 + (k % 4) * 8, 18, 2 if k % 2 else 1, P["white"][2])


def observatory(c, p):
    """Observatory: a dome with its slit open, a telescope tracking, stars wheeling overhead."""
    shadow(c, 32, 28, 61)
    for k in range(6):
        a = 2 * math.pi * (p / 6 + k / 6)
        x, y = 32 + 28 * math.cos(a), 30 + 26 * math.sin(a) * 0.5 - 14
        if 0 <= x < 64 and 0 <= y < 64 and y < 24:
            c.fill(star4(x, y, 2.5 if k % 2 else 1.5), 1.0, "sg")
    f, t, s = box(c, 10, 40, 40, 18, 5, "stone", 0.0)
    for x in range(13, 48, 7):
        c.set(rect(x, 44, x + 3, 48), P["sg"][6] if (x + int(p * 8)) % 3 else P["rn"][5])
    dome = disc(30, 40, 19, 18) & (Y <= 40)
    c.fill(dome, 0.35 + 0.55 * (1 - lin(11, 22, 49, 40)), "sg", outline="sg")
    for k in range(-2, 3):
        c.set(dome & (np.abs((X - 30) - k * 7 * (1 - (40 - Y) / 22)) < 0.5), P["sg"][2])
    slit = dome & (np.abs(X - 30) < 3)
    c.fill(slit, 0.05, "deep")
    ang = math.radians(-60 + 12 * math.sin(2 * math.pi * p))
    tx, ty = 30 + 22 * math.cos(ang), 30 + 22 * math.sin(ang)
    c.fill(path([(30, 32), (tx, ty)], 4), 0.75, "brass", outline="brass")
    c.set(disc(tx, ty, 1.6), P["sg"][7])


DRAW = [chip, pane, lens, prism, facet, observatory]


def draw(t, p):
    c = Canvas()
    DRAW[t](c, p)
    return c.finish()


def icon(p):
    """Zone icon: a fused glass star with four satellite glints that blink in turn."""
    c = Canvas()
    s = star4(32, 32, 26, 6)
    c.fill(s, 0.35 + 0.6 * (1 - radial(28, 28, 26)), "sg", outline="sg")
    inner = star4(32, 32, 14, 4)
    c.fill(inner, 0.9, "sg")
    c.set(disc(32, 32, 2), P["white"][2])
    sweep(c, s, p, 1.0, 1.3)
    for k, (x, y) in enumerate([(14, 14), (50, 14), (50, 50), (14, 50)]):
        on = int(p * 4) == k
        c.fill(star4(x, y, 6 if on else 4, 1.5), 1.0 if on else 0.6, "sg")
    c.glow(s, P["sg"][5], 2, int(50 + 90 * wave(p)), 1)
    return c.finish()
