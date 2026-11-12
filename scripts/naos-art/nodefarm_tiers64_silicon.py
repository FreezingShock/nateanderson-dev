"""Silicon (Fab cleanroom) button sprites at 64 px: Die, Wafer, Batch, Cleanroom, Fab, Megafab, plus the zone icon (a wafer).
Palette: blue with deep indigo shadows, gold pads, steel, and a thin-film rainbow sheen that slides across the silicon."""
import math

import numpy as np

from nodefarm_icon_kit import (Canvas, P, X, Y, box, cyl, disc, lin, line, path, poly, radial, rect, ring, shadow, star4, wave)


def sheen(c, mask, p, k=1.0, width=3.0):
    """Thin-film rainbow band sliding diagonally across `mask` (rests off-shape for part of the loop)."""
    pos = -20 + ((p * k) % 1.0) * 130
    d = (X + Y) - pos
    band = mask & (np.abs(d) < width)
    idx = np.clip(((d + width) / (2 * width) * len(P["rainbow"])).astype(int), 0, len(P["rainbow"]) - 1)
    for i, col in enumerate(P["rainbow"]):
        c.set(band & (idx == i), col)


def wafer_disc(c, cx, cy, rx, ry, p, cells=5, thick=2.5, v=0.0):
    side = (disc(cx, cy + thick, rx, ry) | rect(cx - rx, cy, cx + rx, cy + thick)) & ~disc(cx, cy, rx, ry)
    c.fill(side, 0.25 + v, "si")
    top = disc(cx, cy, rx, ry)
    c.fill(top, 0.45 + v + 0.35 * (1 - lin(cx - rx, cy - ry, cx + rx, cy + ry)), "si", outline="si")
    gx = (rx * 2) / cells
    gridm = top & disc(cx, cy, rx - 2, ry - 1.2) & ((((X - cx + rx) % gx) < 0.9) | (((Y - cy + ry) % (gx * ry / rx)) < 0.9))
    c.set(gridm, P["si"][2])
    c.set(rect(cx - 2, cy + ry - 1.5, cx + 2, cy + ry) & top, P["si"][1])  # flat notch
    sheen(c, top & ~gridm, p)
    return top


def die(c, p):
    shadow(c, 32, 13, 50)
    body = poly([(20, 34), (32, 27), (44, 34), (32, 41)])
    edge_ = poly([(20, 34), (32, 41), (44, 34), (44, 37), (32, 44), (20, 37)])
    c.fill(edge_, 0.2, "si", outline="si")
    c.fill(body, 0.45 + 0.4 * (1 - lin(20, 27, 44, 41)), "si")
    inner = poly([(25, 34), (32, 30), (39, 34), (32, 38)])
    c.fill(inner, 0.25, "deep")
    c.set(inner & ((np.floor(X) + np.floor(Y)) % 3 == 0), P["si"][5])
    for k in range(5):
        t = (k + 0.5) / 5
        for (ax, ay), (bx, by) in [((20, 34), (32, 27)), ((32, 27), (44, 34))]:
            x, y = ax + (bx - ax) * t, ay + (by - ay) * t
            c.set(disc(x, y + 1.5, 0.8), P["gold"][4])
    sheen(c, body & ~inner, p, 1.0, 2.5)


def wafer(c, p):
    shadow(c, 32, 21, 52)
    wafer_disc(c, 32, 36, 21, 11, p, cells=6)


def batch(c, p):
    """Batch: a steel carrier cassette holding a stack of wafers, the top one rising out on each loop."""
    shadow(c, 32, 23, 58)
    rise = 4 * wave(p)
    for i in range(4):
        y = 51 - i * 6
        wafer_disc(c, 32, y, 19, 7, (p + i * 0.15) % 1.0, cells=5, thick=1.6, v=-0.05 * (3 - i))
    wafer_disc(c, 32, 26 - rise, 19, 7, p, cells=5, thick=1.6, v=0.08)
    for x in (12, 51):
        c.fill(rect(x, 22, x + 3, 56), 0.55 + 0.25 * (x < 30), "steel", outline="steel")
        for y in range(25, 56, 6):
            c.set(rect(x, y, x + 3, y + 1), P["steel"][1])
    c.fill(rect(12, 55, 54, 58), 0.45, "steel", outline="steel")


def cleanroom(c, p):
    """Cleanroom: a glass bay with an arm placing a wafer under the laminar flow (the air lines fall)."""
    shadow(c, 32, 26, 60)
    f, t, s = box(c, 8, 14, 44, 44, 6, "steel", -0.2)
    glass = rect(11, 17, 49, 55)
    c.fill(glass, 0.15 + 0.2 * (1 - lin(11, 17, 49, 55)), "si")
    flow = glass & ((np.floor(X) % 6) == 2) & ((np.floor(Y - p * 24) % 8) < 3)
    c.set(flow, P["si"][4])
    c.fill(rect(11, 17, 49, 20), 0.8, "steel")
    for x in range(13, 48, 4):
        c.set(rect(x, 18, x + 2, 19), P["si"][6])
    # tool bed + wafer
    c.fill(rect(15, 47, 45, 55), 0.45, "steel", outline="steel")
    wafer_disc(c, 30, 45, 10, 3.4, p, cells=4, thick=1.2)
    # robot arm swinging over the wafer
    sw = math.sin(2 * math.pi * p) * 0.35
    jx, jy = 40, 33
    c.fill(rect(41, 35, 45, 47), 0.6, "steel", outline="steel")
    ex, ey = jx - 10 * math.cos(sw), jy - 4 + 6 * math.sin(sw)
    c.fill(path([(43, 35), (jx, jy), (ex, ey)], 2.6), 0.75, "steel", outline="steel")
    c.fill(rect(ex - 3, ey + 1, ex + 3, ey + 3), 0.9, "si")
    c.set(disc(ex, ey + 4, 0.8), P["si"][7] if wave(p, 2) > 0.5 else P["si"][4])
    c.set(rect(11, 17, 13, 55) | rect(11, 17, 49, 19) & (X < 20), P["white"][1], 120)


def fab(c, p):
    """Fab: a plant with stacks and lit windows; exhaust drifts up and a status light sweeps the roofline."""
    shadow(c, 32, 28, 60)
    for k, x in enumerate((38, 46)):
        cyl(c, x, 12 + k * 3, 36, 3, 1.2, "steel", -0.05)
        q = (p + k * 0.5) % 1.0
        c.set(disc(x + q * 4, 10 + k * 3 - q * 9, 2.2 + q * 1.5) & ~c.alpha, P["si"][6], int(170 * (1 - q)))
    f, t, s = box(c, 6, 30, 40, 26, 7, "si", -0.15)
    f2, t2, s2 = box(c, 12, 22, 20, 8, 4, "steel", 0.05)
    for row in range(3):
        for col in range(6):
            x, y = 9 + col * 6, 34 + row * 7
            lit = ((col * 3 + row * 5 + int(p * 8)) % 7) < 4
            c.set(rect(x, y, x + 4, y + 4), P["si"][6 if lit else 2])
            if lit:
                c.set(rect(x, y, x + 1, y + 1), P["white"][2])
    c.set(rect(22, 46, 30, 56), P["deep"][0])
    sx = 8 + (p % 1.0) * 44
    c.set(disc(sx, 29, 1.0), P["si"][7])


def megafab(c, p):
    """Megafab: twin fab blocks around a lit tower with a beacon, conveyor lights running between them."""
    shadow(c, 32, 31, 61)
    for k, (x, h) in enumerate([(4, 22), (40, 26)]):
        f, t, s = box(c, x, 58 - h, 18, h, 5, "si", -0.15 + 0.05 * k)
        for row in range(h // 6):
            for col in range(3):
                lit = ((col + row * 2 + k * 3 + int(p * 8)) % 5) < 3
                c.set(rect(x + 2 + col * 5.5, 58 - h + 3 + row * 6, x + 5 + col * 5.5, 58 - h + 6 + row * 6), P["si"][6 if lit else 2])
    tf, tt, ts = box(c, 25, 14, 14, 44, 5, "deep", 0.05)
    for y in range(17, 56, 4):
        c.set(rect(27, y, 37, y + 2), P["si"][5] if ((y // 4 + int(p * 8)) % 3) else P["white"][2])
    c.fill(rect(31, 4, 33, 12), 0.7, "steel")
    on = (p % 0.5) < 0.25
    c.fill(star4(32, 4, 4 if on else 2.5), 1.0, "red" if on else "si")
    c.glow(disc(32, 4, 2), P["red"][3] if on else P["si"][4], 3, 120, 1)
    c.fill(rect(22, 50, 25, 53) | rect(39, 50, 42, 53), 0.5, "steel")
    q = (p * 2) % 1.0
    c.set(disc(22 + q * 20, 51, 0.9), P["si"][7])
    sheen(c, tf, p, 1.0, 2.0)


DRAW = [die, wafer, batch, cleanroom, fab, megafab]


def draw(t, p):
    c = Canvas()
    DRAW[t](c, p)
    return c.finish()


def icon(p):
    """Zone icon: a big wafer seen at an angle, a rainbow sheen sliding over its dies."""
    c = Canvas()
    shadow(c, 32, 25, 54)
    wafer_disc(c, 32, 34, 27, 17, p, cells=7, thick=3.5)
    return c.finish()
