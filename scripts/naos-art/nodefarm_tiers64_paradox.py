"""Paradox (Mirror stair) button sprites at 64 px: Flicker, Mirror, Fork, Knot, Recursion, Mobius, plus the zone icon.
Palette: pale silver-lilac, with a red/cyan channel split that slips in and out like a glitch."""
import math

import numpy as np

from nodefarm_icon_kit import (Canvas, P, X, Y, angle, box, disc, lin, line, path, poly, radial, rect, ring, rotp, shadow, shift,
                               wave)


def split(c, m, p, amt=1, on=None):
    """Chromatic split: red ghost left, cyan ghost right of mask m, only on glitch frames."""
    if on is None:
        on = int(p * 8) in (2, 5)
    if not on:
        return
    c.set(shift(m, -amt, 0) & ~m, P["split_r"][2])
    c.set(shift(m, amt, 0) & ~m, P["split_c"][2])


def flicker(c, p):
    """Flicker: a small cube that can't decide where it is: it jumps, splits into red and cyan, and scan lines tear it."""
    shadow(c, 32, 12, 51)
    k = int(p * 8)
    dx = [0, 0, 3, 0, 0, -2, 0, 0][k]
    f, t, s = box(c, 25 + dx, 32, 14, 14, 5, "px", 0.05)
    c.set(edge_l := (f & ~shift(f, 1, 0)), P["split_r"][2])
    c.set(s & ~shift(s, -1, 0), P["split_c"][2])
    split(c, f | t | s, p, 2)
    if k in (2, 3, 5):
        y = [0, 0, 37, 42, 0, 35, 0, 0][k]
        c.set(rect(21, y, 47, y + 1) & ~rect(25 + dx, 32, 39 + dx, 46), P["split_c"][2])
        c.set(rect(25 + dx, y, 39 + dx, y + 1), P["px"][7])


def mirror(c, p):
    """Mirror: a hand mirror whose reflection lags a frame behind (the glint moves the wrong way)."""
    shadow(c, 30, 14, 60)
    c.fill(path([(30, 46), (30, 58)], 4), 0.5, "brass", outline="brass")
    c.fill(disc(30, 28, 16, 19), 0.55 + 0.35 * (1 - lin(14, 9, 46, 47)), "brass", outline="brass")
    g = disc(30, 28, 13, 16)
    c.fill(g, 0.45 + 0.4 * (1 - lin(17, 12, 43, 44)), "px")
    pos = 60 - p * 80
    c.set(g & (np.abs((X + Y) - pos) < 1.6), P["px"][7])
    c.set(g & (np.abs((X + Y) - pos - 6) < 0.8), P["px"][7])
    split(c, g, p, 1)


def fork(c, p):
    """Fork: one path splitting in two, a pulse taking both branches at once."""
    shadow(c, 32, 22, 60)
    trunk = [(32, 58), (32, 36)]
    left = [(32, 36), (18, 22), (14, 10)]
    right = [(32, 36), (46, 22), (50, 10)]
    for pts, pal in [(trunk, "px"), (left, "split_r"), (right, "split_c")]:
        c.fill(path(pts, 3), 0.55 if pal == "px" else 0.7, pal if pal != "px" else "px", outline="px")
    for (x, y), pal in [((14, 9), "split_r"), ((50, 9), "split_c"), ((32, 36), "px")]:
        c.fill(disc(x, y, 4), 0.8, pal, outline="px")
    q = p
    if q < 0.4:
        y = 58 - (q / 0.4) * 22
        c.set(disc(32, y, 1.8), P["white"][2])
    else:
        t = (q - 0.4) / 0.6
        for (pts) in (left, right):
            (ax, ay), (bx, by), (cx_, cy_) = pts
            if t < 0.6:
                tt = t / 0.6
                x, y = ax + (bx - ax) * tt, ay + (by - ay) * tt
            else:
                tt = (t - 0.6) / 0.4
                x, y = bx + (cx_ - bx) * tt, by + (cy_ - by) * tt
            c.set(disc(x, y, 1.8), P["white"][2])


def knot(c, p):
    """Knot: a trefoil knot turning, over-and-under shaded so it reads as one tied loop."""
    shadow(c, 32, 22, 61)
    rot = 2 * math.pi * p / 3
    pts = []
    for i in range(241):
        t = 2 * math.pi * i / 240
        x = math.sin(t) + 2 * math.sin(2 * t)
        y = math.cos(t) - 2 * math.cos(2 * t)
        z = -math.sin(3 * t)
        xr, yr = x * math.cos(rot) - y * math.sin(rot), x * math.sin(rot) + y * math.cos(rot)
        pts.append((32 + xr * 8.5, 32 + yr * 8.5, z, i / 240))
    for i in sorted(range(240), key=lambda i: pts[i][2]):
        a, b = pts[i], pts[i + 1]
        m = line(a[0], a[1], b[0], b[1], 4.6)
        c.fill(m, 0.3 + 0.35 * (a[2] + 1) / 2 + 0.25 * (1 - lin(10, 10, 54, 54)), "px")
        c.set(line(a[0], a[1], b[0], b[1], 1.0), P["split_c"][3] if a[3] < 0.5 else P["split_r"][3])
    hp = pts[int(p * 240) % 240]
    c.set(disc(hp[0], hp[1], 1.8), P["white"][2])


def recursion(c, p):
    """Recursion: frames inside frames zooming in forever (the loop hands each frame to the next one)."""
    shadow(c, 32, 24, 61)
    for k in range(6):
        s = 26 * (0.62 ** (k - p))
        if s < 1.6:
            continue
        m = rect(32 - s, 32 - s, 32 + s, 32 + s) & ~rect(32 - s + 1.8, 32 - s + 1.8, 32 + s - 1.8, 32 + s - 1.8)
        if s > 27:
            continue
        pal = ["px", "split_c", "px", "split_r"][k % 4]
        c.fill(m, 0.75 - 0.08 * k, pal if pal != "px" else "px")
    c.outline(rect(6, 6, 58, 58) & ~rect(7.8, 7.8, 56.2, 56.2), "px")
    c.set(disc(32, 32, 1.6), P["white"][2])


def mobius(c, p):
    """Mobius: a one-sided band turning, a runner going round it twice to come back where it started."""
    shadow(c, 32, 24, 61)
    rot = 2 * math.pi * p / 2
    segs = []
    for i in range(180):
        t = 2 * math.pi * i / 180
        for w in np.linspace(-1, 1, 7):
            x = (1 + w / 2 * math.cos(t / 2)) * math.cos(t)
            y = (1 + w / 2 * math.cos(t / 2)) * math.sin(t)
            z = w / 2 * math.sin(t / 2)
            xr = x * math.cos(rot) - y * math.sin(rot)
            yr = x * math.sin(rot) + y * math.cos(rot)
            sy = yr * 0.45 - z * 0.9
            segs.append((32 + xr * 22, 32 + sy * 22 + 2, yr, w, t))
    img = c.img
    zbuf = np.full((64, 64), -9.0)
    for (x, y, zz, w, t) in segs:
        xi, yi = int(round(x)), int(round(y))
        for dx in (0, 1):
            for dy in (0, 1):
                X_, Y_ = xi + dx - 1, yi + dy - 1
                if 0 <= X_ < 64 and 0 <= Y_ < 64 and zz > zbuf[Y_, X_]:
                    zbuf[Y_, X_] = zz
                    edge_ = abs(w) > 0.8
                    shade = 0.35 + 0.45 * (zz + 1) / 2 + (0.2 if edge_ else 0)
                    pal = P["split_c"] if math.cos(t / 2) > 0 else P["split_r"]
                    ramp = P["px"]
                    col = pal[2] if edge_ else ramp[min(len(ramp) - 1, int(shade * (len(ramp) - 1) + ((X_ + Y_) % 2) * 0.4))]
                    img[Y_, X_] = (*col, 255)
    q = (p * 1.0) % 1.0
    t = 4 * math.pi * q
    x = math.cos(t)
    y = math.sin(t)
    z = 0
    xr, yr = x * math.cos(rot) - y * math.sin(rot), x * math.sin(rot) + y * math.cos(rot)
    c.set(disc(32 + xr * 22, 32 + (yr * 0.45) * 22 + 2, 1.8), P["white"][2])


DRAW = [flicker, mirror, fork, knot, recursion, mobius]


def draw(t, p):
    c = Canvas()
    DRAW[t](c, p)
    return c.finish()


def icon(p):
    """Zone icon: an infinity loop drawn as two halves that don't quite agree (red and cyan), glitching."""
    c = Canvas()
    shadow(c, 32, 22, 56)
    pts = []
    for i in range(121):
        t = 2 * math.pi * i / 120
        pts.append((32 + 24 * math.cos(t) / (1 + math.sin(t) ** 2), 32 + 24 * math.sin(t) * math.cos(t) / (1 + math.sin(t) ** 2)))
    m = path(pts, 6)
    c.fill(m, 0.4 + 0.5 * (1 - lin(8, 18, 56, 46)), "px", outline="px")
    left = m & (X < 32)
    c.set(path(pts[30:91], 1.4) & (X < 32), P["split_r"][2])
    c.set(path(pts[:31] + pts[90:], 1.4) & (X >= 32), P["split_c"][2])
    hp = pts[int(p * 120) % 120]
    c.set(disc(hp[0], hp[1], 2), P["white"][2])
    split(c, m, p, 2)
    return c.finish()
