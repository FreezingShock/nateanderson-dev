"""Engrams (Engram archive) button sprites at 64 px: Fragment, Recall, Reel, Diary, Archive, Chorus, plus the zone icon.
Palette: sepia film and leather with warm cream highlights, brass fittings, faded cyan memory light."""
import math

import numpy as np

from nodefarm_icon_kit import (Canvas, P, X, Y, angle, box, disc, lin, line, path, poly, radial, rect, ring, rotp, shadow, star4,
                               wave)


def frame_strip(c, x0, y0, w, h, frames, p, v=0.0, scroll=0.0):
    strip = rect(x0, y0, x0 + w, y0 + h)
    c.fill(strip, 0.12 + v, "film", outline="film")
    holes = strip & ((np.floor(X - x0 + scroll) % 4) < 2) & ((Y < y0 + 2.2) | (Y >= y0 + h - 2.2)) & ((Y >= y0 + 0.8) & (Y < y0 + h - 0.8))
    c.set(holes, P["eg"][6])
    fw = w / frames
    for k in range(frames):
        fx = x0 + k * fw + 1 - (scroll % fw)
        cell = rect(fx, y0 + 3, fx + fw - 2, y0 + h - 3) & strip
        c.fill(cell, 0.45 + 0.35 * (1 - lin(fx, y0, fx + fw, y0 + h)) + 0.1 * (k % 2), "eg")
    return strip


def fragment(c, p):
    """Fragment: a torn piece of film, one frame flickering with a remembered face of light."""
    shadow(c, 32, 13, 52)
    pts = [(18, 26), (44, 22), (47, 40), (42, 41), (40, 45), (21, 47), (19, 40), (16, 38)]
    m = poly(rotp(pts, math.radians(-8), 32, 34))
    c.fill(m, 0.15, "film", outline="film")
    cell = poly(rotp([(23, 29), (40, 27), (41, 40), (24, 42)], math.radians(-8), 32, 34))
    on = (p % 0.5) < 0.3
    c.fill(cell, (0.6 if on else 0.4) + 0.3 * (1 - lin(22, 26, 42, 42)), "eg")
    c.set(cell & ((np.floor(Y) + int(p * 8)) % 5 == 0), P["eg"][3])
    for k in range(5):
        x, y = rotp([(20 + k * 5.5, 25)], math.radians(-8), 32, 34)[0]
        c.set(rect(x, y, x + 2, y + 1.5), P["eg"][6])


def recall(c, p):
    """Recall: a photograph rising out of a faded memory haze, coming into focus then fading."""
    shadow(c, 32, 15, 58)
    g = wave(p)
    bob = -2 * g
    photo = poly(rotp([(18, 18), (46, 18), (46, 48), (18, 48)], math.radians(6), 32, 33))
    photo = np.roll(photo, int(bob), 0)
    c.fill(photo, 0.85, "eg", outline="eg")
    img = poly(rotp([(21, 21), (43, 21), (43, 41), (21, 41)], math.radians(6), 32, 31))
    img = np.roll(img, int(bob), 0)
    c.fill(img, 0.25 + 0.45 * g + 0.25 * (1 - lin(20, 20, 44, 42)), "pu" if g > 0.5 else "eg")
    hill = img & (Y > 33 + bob + 0.15 * (X - 32))
    c.fill(hill, 0.3 + 0.2 * g, "eg")
    c.set(disc(37, 27 + bob, 2.2) & img, P["eg"][7])
    for k in range(4):
        q = (p + k / 4) % 1.0
        c.set(disc(16 + k * 10, 56 - q * 14, 0.9), P["pu"][5], int(220 * (1 - q)))


def reel(c, p):
    """Reel: a film reel turning, film feeding off it."""
    shadow(c, 30, 20, 60)
    cx, cy = 28, 30
    c.fill(disc(cx, cy, 22), 0.45 + 0.4 * (1 - lin(6, 8, 50, 52)), "eg", outline="eg")
    c.fill(disc(cx, cy, 18), 0.12, "film")
    c.fill(ring(cx, cy, 18, 9), 0.25 + 0.15 * ((np.floor(np.hypot(X - cx, Y - cy)) % 2) == 0), "film")
    rot = p / 3
    for k in range(3):
        a = 2 * math.pi * (rot + k / 3)
        c.fill(disc(cx + 12 * math.cos(a), cy + 12 * math.sin(a), 4.6), 0.7, "eg", outline="eg")
    c.fill(disc(cx, cy, 4), 0.85, "brass", outline="brass")
    c.set(disc(cx, cy, 1.4), P["film"][0])
    frame_strip(c, 30, 46, 33, 10, 3, p, 0.0, p * 12)


def diary(c, p):
    """Diary: a leather book with a brass clasp, its pages glowing faintly when it's read."""
    shadow(c, 32, 22, 60)
    pages = poly([(14, 20), (48, 14), (52, 50), (18, 56)])
    c.fill(pages, 0.85, "eg", outline="eg")
    c.set(pages & ((np.floor(Y + X * 0.18) % 2) == 0) & (X > 47), P["eg"][4])
    cover = poly([(10, 18), (46, 12), (48, 48), (14, 54)])
    c.fill(cover, 0.2 + 0.45 * (1 - lin(10, 12, 48, 54)), "eg", outline="eg")
    c.set(line(14, 20, 17, 52, 1.6), P["eg"][1])
    c.fill(poly([(42, 28), (52, 26), (52, 34), (42, 36)]), 0.75, "brass", outline="brass")
    c.set(disc(48, 30, 1.3), P["brass"][1])
    emb = poly([(24, 26), (36, 24), (37, 38), (25, 40)])
    g = wave(p)
    c.set(emb & ~poly([(26, 28), (34, 26.5), (35, 36), (27, 37.5)]), P["brass"][3 + int(g * 2)])
    c.fill(star4(30.5, 32, 3 + g, 1), 0.9, "brass")
    q = (p * 2) % 1.0
    c.set(line(46 + q * 2, 15 + q, 50, 50 - q * 2, 1) & pages, P["pu"][5], int(140 * wave(p)))


def archive(c, p):
    """Archive: shelves of tape cases, a reading arm sliding along and lighting the one it picks."""
    shadow(c, 32, 26, 61)
    f, t, s = box(c, 6, 10, 46, 50, 6, "film", 0.05)
    for row in range(3):
        y = 13 + row * 15
        c.fill(rect(8, y + 12, 50, y + 14), 0.5, "eg")
        for k in range(8):
            x = 9 + k * 5.1
            hue = ["eg", "ch", "eg", "brass", "eg", "pu", "eg", "ch"][(k + row * 3) % 8]
            pick = int(p * 8) == k and row == 1
            c.fill(rect(x, y + 1 + (k % 3), x + 4, y + 12), (0.85 if pick else 0.4) + 0.2 * (1 - lin(x, 0, x + 4, 0)), hue)
            c.set(rect(x + 1, y + 4 + (k % 3), x + 3, y + 5 + (k % 3)), P["eg"][7])
    ax = 11 + (p * 8 % 8) * 5.1
    c.fill(rect(6, 26, 52, 28), 0.7, "steel")
    c.fill(rect(ax - 1, 26, ax + 4, 30), 0.85, "steel", outline="steel")
    c.set(disc(ax + 1.5, 31, 1), P["pu"][6])


def chorus(c, p):
    """Chorus: a gramophone horn singing recorded voices, rings of sound and floating notes."""
    shadow(c, 26, 22, 61)
    f, t, s = box(c, 6, 44, 30, 14, 5, "eg", -0.1)
    c.fill(disc(20, 43, 13, 3.4), 0.3, "film", outline="film")
    c.set(ring(20, 43, 10, 9, 0.26), P["film"][3])
    c.fill(path([(22, 42), (28, 30), (34, 24)], 2.6), 0.6, "brass", outline="brass")
    horn = poly([(32, 26), (52, 4), (62, 18), (36, 30)])
    c.fill(horn, 0.45 + 0.45 * (1 - lin(32, 4, 62, 30)), "brass", outline="brass")
    c.fill(disc(57, 11, 5, 8) , 0.2, "brass")
    for k in range(3):
        q = (p * 1.5 + k / 3) % 1.0
        rr = 8 + q * 14
        c.set(ring(57, 11, rr + 0.7, rr - 0.5) & ~c.alpha & (X < 64), P["pu"][5], int(220 * (1 - q)))
    for k in range(3):
        q = (p + k / 3) % 1.0
        x, y = 44 - q * 30 + k * 4, 12 + 6 * math.sin(q * 6 + k) - q * 4
        note = disc(x, y + 3, 1.8, 1.4) | rect(x + 1, y - 3, x + 2, y + 3)
        c.fill(note, 0.9, "eg" if k % 2 else "pu")


DRAW = [fragment, recall, reel, diary, archive, chorus]


def draw(t, p):
    c = Canvas()
    DRAW[t](c, p)
    return c.finish()


def icon(p):
    """Zone icon: a film reel with a strip curling off it, the frames ticking past."""
    c = Canvas()
    shadow(c, 30, 22, 60)
    cx, cy = 26, 26
    c.fill(disc(cx, cy, 22), 0.45 + 0.4 * (1 - lin(4, 4, 48, 48)), "eg", outline="eg")
    c.fill(disc(cx, cy, 18), 0.12, "film")
    rot = p / 3
    for k in range(3):
        a = 2 * math.pi * (rot + k / 3)
        c.fill(disc(cx + 11 * math.cos(a), cy + 11 * math.sin(a), 5), 0.7, "eg", outline="eg")
    c.fill(disc(cx, cy, 4), 0.85, "brass", outline="brass")
    frame_strip(c, 22, 44, 41, 12, 3, p, 0.0, p * 13.6)
    return c.finish()
