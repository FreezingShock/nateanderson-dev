"""Runes (Glyph hall) button sprites at 64 px: Mark, Sigil, Glyph, Seal, Canon, Grimoire, plus the zone icon (a rune tablet).
Palette: gold rune light carved into grey-violet stone, with ember accents."""
import math

import numpy as np

from nodefarm_icon_kit import (Canvas, P, X, Y, box, disc, lin, line, path, poly, radial, rect, ring, shadow, star4, wave)

# a small alphabet of original rune strokes, in unit coordinates (0..1)
RUNES = [
    [((0.5, 0), (0.5, 1)), ((0.5, 0.3), (0.85, 0.1)), ((0.5, 0.55), (0.15, 0.35))],
    [((0.2, 0), (0.2, 1)), ((0.2, 0.2), (0.8, 0.5)), ((0.8, 0.5), (0.2, 0.8))],
    [((0.5, 0), (0.15, 0.5)), ((0.15, 0.5), (0.5, 1)), ((0.5, 1), (0.85, 0.5)), ((0.85, 0.5), (0.5, 0))],
    [((0.3, 0), (0.3, 1)), ((0.7, 0), (0.7, 1)), ((0.3, 0.5), (0.7, 0.5))],
    [((0.5, 0), (0.5, 1)), ((0.15, 0.25), (0.85, 0.25)), ((0.15, 0.75), (0.85, 0.75))],
    [((0.15, 0), (0.85, 1)), ((0.85, 0), (0.15, 1)), ((0.5, 0), (0.5, 0.3))],
]


def rune(i, x, y, w, h, lw=1.6):
    m = np.zeros((64, 64), bool)
    for (a, b) in RUNES[i % len(RUNES)]:
        m |= line(x + a[0] * w, y + a[1] * h, x + b[0] * w, y + b[1] * h, lw)
    return m


def lit(c, m, p, phase=0.0, k=1):
    """Carved rune light: a glow that brightens and dims, with a hot pixel line through the stroke."""
    g = wave(p, k, phase)
    c.fill(m, 0.55 + 0.4 * g, "rn")
    c.glow(m, P["rn"][4], 2, int(60 + 110 * g), 1)


def stone(c, m, v=0.0):
    c.fill(m, 0.25 + v + 0.5 * (1 - lin(0, 0, 64, 64)), "stone", outline="stone")
    c.rim(m, P["stone"][5])


def mark(c, p):
    shadow(c, 32, 14, 54)
    s = poly([(22, 53), (20, 36), (26, 26), (38, 25), (44, 34), (43, 53)])
    stone(c, s)
    lit(c, rune(0, 27, 31, 10, 18, 2), p)


def sigil(c, p):
    shadow(c, 32, 17, 56)
    d = disc(32, 36, 17, 16)
    stone(c, d)
    c.set(ring(32, 36, 14, 13), P["stone"][1])
    lit(c, rune(2, 25, 28, 14, 16, 2) | (ring(32, 36, 12.8, 11.6) & (((np.floor(np.degrees(np.arctan2(Y - 36, X - 32))) + 360 + p * 360) % 40) < 22)), p)


def glyph(c, p):
    shadow(c, 32, 18, 58)
    t = poly([(16, 57), (16, 18), (20, 12), (44, 12), (48, 18), (48, 57)])
    stone(c, t, 0.05)
    for i, (x, y) in enumerate([(21, 17), (34, 17), (21, 37), (34, 37)]):
        lit(c, rune(i + 1, x, y, 9, 15, 1.6), p, phase=i * 0.25)


def seal(c, p):
    """Seal: a wax seal pressed with a rune, two ribbon tails, the seal's rim glinting."""
    shadow(c, 32, 19, 59)
    for side in (-1, 1):
        rib = poly([(32 + side * 4, 44), (32 + side * 13, 60), (32 + side * 9, 58), (32 + side * 7, 62), (32 + side * 1, 46)])
        c.fill(rib, 0.4 + 0.2 * (side < 0), "ember", outline="ember")
    blob = disc(32, 32, 20, 19) | disc(18, 25, 6) | disc(46, 40, 6) | disc(44, 18, 5) | disc(20, 44, 5)
    c.fill(blob, 0.35 + 0.5 * (1 - lin(10, 10, 54, 54)), "rn", outline="rn")
    inner = disc(32, 32, 14)
    c.fill(inner, 0.2 + 0.25 * radial(28, 28, 16), "rn")
    c.set(ring(32, 32, 14.5, 13.5), P["rn"][6])
    lit(c, rune(5, 25, 24, 14, 16, 2.2), p)
    pos = (p * 360) % 360
    a = (np.degrees(np.arctan2(Y - 32, X - 32)) + 360) % 360
    c.set(ring(32, 32, 19.5, 18) & (np.abs(a - pos) < 14), P["rn"][7])


def canon(c, p):
    """Canon: an obelisk covered in runes, lines lighting from base to tip in sequence."""
    shadow(c, 32, 18, 60)
    c.fill(poly([(14, 60), (18, 52), (46, 52), (50, 60)]), 0.4, "stone", outline="stone")
    ob = poly([(22, 53), (25, 12), (32, 4), (39, 12), (42, 53)])
    side = poly([(32, 4), (39, 12), (42, 53), (35, 53), (34, 12)])
    stone(c, ob, 0.05)
    c.fill(side, 0.25, "stone")
    for i in range(5):
        y = 44 - i * 8
        on = (int(p * 6) >= i) and p < 0.85
        m = rune(i, 26.5, y, 7, 6, 1.2)
        if on:
            c.fill(m, 0.85, "rn")
            c.glow(m, P["rn"][4], 1, 140, 1)
        else:
            c.set(m, P["stone"][1])
    if p >= 0.7:
        c.spark(32, 4, 2, P["rn"][7])


def grimoire(c, p):
    """Grimoire: an open book, pages turning, runes lifting off the page and orbiting."""
    shadow(c, 32, 26, 60)
    cover = poly([(4, 46), (30, 54), (34, 54), (60, 46), (60, 50), (34, 58), (30, 58), (4, 50)])
    c.fill(cover, 0.35, "ember", outline="ember")
    lp = poly([(6, 44), (8, 30), (30, 36), (31, 52)])
    rp = poly([(33, 52), (34, 36), (56, 30), (58, 44)])
    c.fill(lp, 0.82 + 0.15 * lin(6, 30, 31, 52), "eg", outline="eg")
    c.fill(rp, 0.72 + 0.15 * (1 - lin(33, 30, 58, 52)), "eg", outline="eg")
    for k in range(4):
        c.set(line(10, 36 + k * 3.5, 27, 40 + k * 3.5, 1) & lp, P["eg"][3])
        c.set(line(37, 40 + k * 3.5, 54, 36 + k * 3.5, 1) & rp, P["eg"][3])
    # a page turning over the spine
    q = p
    ang = math.pi * q
    tipx = 32 + 22 * math.cos(ang)
    tipy = 33 - 12 * math.sin(ang)
    page = poly([(32, 52), (32, 36), (tipx, tipy), (tipx + (0 if q < 0.5 else 0), tipy + 14)])
    c.fill(page, 0.9, "eg", outline="eg")
    # runes rising and circling
    for k in range(4):
        rq = (p + k / 4) % 1.0
        x = 32 + 18 * math.cos(2 * math.pi * rq) * (0.5 + rq * 0.5)
        y = 30 - rq * 20
        m = rune(k, x - 3, y - 4, 6, 8, 1.2)
        c.fill(m, 0.95, "rn")
        c.glow(m, P["rn"][4], 1, int(200 * (1 - rq)), 1)


DRAW = [mark, sigil, glyph, seal, canon, grimoire]


def draw(t, p):
    c = Canvas()
    DRAW[t](c, p)
    return c.finish()


def icon(p):
    """Zone icon: a framed rune tablet, the rune breathing gold light."""
    c = Canvas()
    shadow(c, 32, 20, 60)
    frame = rect(10, 6, 54, 58)
    c.fill(frame, 0.55 + 0.35 * (1 - lin(10, 6, 54, 58)), "rn", outline="rn")
    t = rect(14, 10, 50, 54)
    c.fill(t, 0.2 + 0.4 * (1 - lin(14, 10, 50, 54)), "stone")
    for (x, y) in [(13, 9), (51, 9), (13, 55), (51, 55)]:
        c.set(disc(x, y, 1.3), P["rn"][7])
    lit(c, rune(2, 21, 14, 22, 36, 3), p)
    return c.finish()
