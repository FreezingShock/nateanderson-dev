"""Node Farm window banners in full colour: one original dithered piece per older window (Map, Goals, Records, Menu).

Run:  python3 scripts/naos-art/nodefarm-window-art.py              (all)
      python3 scripts/naos-art/nodefarm-window-art.py map goals    (just those)
Then: node scripts/nodefarm/stamp-art.mjs
Output: public/naos/nodefarm/win-<name>.{png,webp}, 480 x 150 art pixels, shown 1:1 in the banner at the top of each window
(components/nodefarm/windows/win-kit.tsx, app/camino/nodefarm/windows.css). Drawn with nodefarm_wide_kit, the wide-canvas version of the
64 px icon kit, so the banners share the icons' hue-shifted ramps, rim light, outline and glow. Sky and mist are see-through
dither, so the window's own halftone floor still shows. The left third sits under the readout and is faded by the CSS, so
each piece keeps its subject in the middle and right. Everything is procedural; nothing is traced or borrowed.
"""
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nodefarm_wide_kit import Grid, P, box, grow, stars  # noqa: E402

BW, BH = 480, 150
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "naos", "nodefarm")
g = Grid(BW, BH)
X, Y = g.X, g.Y


def sky(c, horizon, pal_hi, pal_lo, dens=0.5, seed=1):
    """Dithered see-through sky: thin at the top, thicker toward the horizon, shifting from one ramp to another."""
    t = np.clip(Y / horizon, 0, 1)
    m = Y < horizon
    lo = (t + g.B8 * 0.6) > 0.62
    c.haze(m & ~lo, 0.2 + 0.35 * t, pal_hi, dens * t * 0.85)
    c.haze(m & lo, 0.12 + 0.4 * np.clip((t - 0.45) / 0.55, 0, 1), pal_lo, dens * t)
    stars(c, 60, seed, int(horizon * 0.8))


def hills(c, base, amp, freq, phase, pal, v0, v1, seed=0):
    h = base - amp * (0.6 * np.sin(X / freq + phase) + 0.4 * np.sin(X / (freq * 0.43) + phase * 2.1))
    m = Y >= h
    c.fill(m, v0 + (v1 - v0) * (1 - g.lin(0, base - amp, 0, BH)), pal)
    c.rim(m, (pal, min(len(P[pal]) - 1, 3)), dx=0, dy=-1)
    return m


# ---------------------------------------------------------------- Map: the signal mast
def mast():
    c = g.canvas()
    sky(c, 120, "deep", "teal", 0.55, seed=31)
    hills(c, 118, 10, 38, 0.4, "deep", 0.15, 0.4)
    hills(c, 128, 6, 24, 2.2, "teal", 0.08, 0.28)
    # ground: a dark plain with a perspective grid fading back
    gnd = Y >= 132
    c.fill(gnd, 0.18 + 0.3 * g.lin(0, 132, 0, BH), "deep")
    for k in range(-12, 13):
        c.set(g.line(240 + k * 8, 132, 240 + k * 40, 150, 1) & gnd & (g.B4 < 0.1), ("cyan", 2))
    for y in (136, 141, 147):
        c.set(g.rect(0, y, BW, y + 1) & (g.B4 < 0.0), ("cyan", 2))
    cx, top, base = 250, 22, 134
    # broadcast rings: elliptical arcs that thin out with distance
    for k, rr in enumerate((30, 52, 76, 102, 130)):
        d = np.hypot((X - cx) / rr, (Y - top) / (rr * 0.5))
        arc = (np.abs(d - 1) < 1.3 / rr) & (Y < top + 40) & (Y > 2)
        c.set(arc & (g.B4 < 0.4 - k * 0.14), ("cyan", 6 - k))
    # the mast: two steel legs narrowing to the top, x-bracing, shaded darker on the right
    legs = g.path([(cx - 3, top + 8), (cx - 26, base)], 2.4) | g.path([(cx + 3, top + 8), (cx + 26, base)], 2.4)
    brace = np.zeros_like(legs)
    ys = list(range(top + 16, base, 13))
    for y0, y1 in zip(ys, ys[1:]):
        w0, w1 = 3 + (y0 - top) / (base - top) * 23, 3 + (y1 - top) / (base - top) * 23
        brace |= g.line(cx - w0, y0, cx + w1, y1, 1.2) | g.line(cx + w0, y0, cx - w1, y1, 1.2) | g.line(cx - w0, y0, cx + w0, y0, 1.4)
    c.fill(brace, 0.35 + 0.35 * (1 - g.lin(cx - 26, top, cx + 26, base)), "steel")
    c.fill(legs, 0.45 + 0.4 * (1 - g.lin(cx - 26, top, cx + 26, base)), "steel", outline="steel")
    c.fill(g.rect(cx - 30, base - 3, cx + 30, base + 1), 0.4, "steel", outline="steel")
    # platform halfway up, with a red warning light
    c.fill(g.rect(cx - 15, 78, cx + 15, 81), 0.55, "steel", outline="steel")
    c.set(g.disc(cx + 15, 76, 1.6), ("red", 3))
    c.glow(g.disc(cx + 15, 76, 1.6), ("red", 2), 3, 120)
    # the beacon
    bea = g.rect(cx - 5, top - 2, cx + 5, top + 9)
    c.fill(bea, 0.75 + 0.2 * (1 - g.lin(cx - 5, top, cx + 5, top + 9)), "cyan", outline="cyan")
    c.set(g.rect(cx - 2, top + 1, cx + 2, top + 6), ("white", 2))
    c.fill(g.line(cx, top - 14, cx, top - 2, 1.4), 0.7, "steel")
    c.spark(cx, top - 15, 2, ("cyan", 6), ("white", 2))
    c.glow(bea, ("cyan", 5), 7, 130, 4)
    c.light(cx, top + 4, 46, ("cyan", 4), 70, 30)
    # chain of nodes feeding the mast from both sides, links lit with travelling packets
    r = np.random.default_rng(7)
    for side in (-1, 1):
        prev = (cx + side * 28, base - 3)
        for k in range(1, 6):
            x = cx + side * (28 + k * 36)
            if x < 4 or x > BW - 6:
                break
            y = base - 2 - int(r.integers(0, 5))
            c.set(g.path([prev, (x, prev[1]), (x, y - 4)], 1), ("cyan", 3))
            if k % 2:
                c.set(g.disc((prev[0] + x) / 2, prev[1], 1.2), ("white", 2))
            f, t, s = box(c, x - 6, y - 9, 12, 9, 4, "steel", -0.05)
            led = ["lime", "cyan", "mag", "cyan", "gold"][k % 5]
            c.set(g.rect(x - 3, y - 6, x + 1, y - 4), (led, 5))
            c.glow(g.rect(x - 3, y - 6, x + 1, y - 4), (led, 4), 2, 110, 1)
            prev = (x, y - 4)
    return c.finish()


# ---------------------------------------------------------------- Goals: the trophy plinths
TROPHIES = [("cu", "patina"), ("si", "deep"), ("qz", "violet"), None, ("ae", "teal"), ("rn", "brass"), ("sg", "sky")]


def plinths():
    c = g.canvas()
    sky(c, 112, "dusk", "ember", 0.42, seed=32)
    # floor: polished stone with a gold inlay line and reflections
    flo = Y >= 132
    c.fill(flo, 0.12 + 0.25 * g.lin(0, 132, 0, BH), "stone")
    c.set(g.rect(0, 132, BW, 133), ("gold", 2))
    cx, base = 250, 132
    # back light behind the centre plinth
    c.light(cx, 50, 90, ("gold", 4), 80, 60)
    for i in range(7):
        d = abs(i - 3)
        x = cx + (i - 3) * 62
        h = 60 - d * 12
        w = 17 - d
        # stepped plinth: plinth body, a cap, a base step
        f, t, s = box(c, x - w, base - h, 2 * w, h, 5, "stone", 0.02)
        c.fill(g.rect(x - w - 3, base - 5, x + w + 3, base), 0.35, "stone", outline="stone")
        c.fill(g.rect(x - w - 2, base - h - 3, x + w + 2, base - h), 0.65, "gold", outline="gold")
        c.set(g.rect(x - 3, base - h + 8, x + 3, base - h + 10), ("gold", 3))  # name plate
        my = base - h - 17
        if TROPHIES[i] is None:
            # the crystal: a faceted gold diamond, floating, with sparks
            dia = g.poly([(x, my - 34), (x + 15, my - 10), (x, my + 12), (x - 15, my - 10)])
            left = dia & (X < x)
            c.fill(dia, 0.55 + 0.4 * (1 - g.lin(x - 15, my - 34, x + 15, my + 12)), "gold", outline="gold")
            c.fill(left & (Y < my - 10), 0.95, "gold")
            c.set(g.line(x, my - 34, x, my + 12, 1) | g.line(x - 15, my - 10, x + 15, my - 10, 1), ("gold", 5))
            c.glow(dia, ("gold", 4), 8, 150, 4)
            for sx, sy, sz in ((x - 26, my - 30, 2), (x + 24, my - 18, 1), (x + 10, my - 44, 1), (x - 20, my + 4, 1)):
                c.spark(sx, sy, sz, ("gold", 5), ("white", 2))
            continue
        pal, acc = TROPHIES[i]
        rr = 11 - d
        orb = g.disc(x, my, rr)
        c.fill(orb, 0.35 + 0.6 * (1 - g.radial(x - rr * 0.35, my - rr * 0.4, rr * 1.6)), pal, outline=pal)
        c.set(g.ring(x, my, rr - 2, rr - 3.2), (acc, 3))
        c.set(g.disc(x - rr * 0.35, my - rr * 0.4, 1.4), ("white", 2))
        c.fill(g.poly([(x - 4, my + rr - 1), (x + 4, my + rr - 1), (x + 6, base - h - 3), (x - 6, base - h - 3)]), 0.6, "gold", outline="gold")
        c.glow(orb, (pal, 4), 3, 90, 2)
        # reflection of the orb on the floor
        c.set(g.disc(x, 140, rr * 0.8, 1.6) & (g.B4 < 0.1), (pal, 3))
    return c.finish()


# ---------------------------------------------------------------- Records: the tape archive
def archive():
    c = g.canvas()
    # back wall: dark ember dither, light falling off at the top
    wall = Y < 146
    c.haze(wall, 0.08 + 0.18 * g.lin(0, 0, 0, 146), "ember", 0.06 + 0.3 * g.lin(0, 0, 0, 146))
    flo = Y >= 144
    c.fill(flo, 0.25, "film")
    cx = 250
    c.light(cx, 40, 110, ("ember", 4), 70, 70)
    r = np.random.default_rng(33)
    for x0 in (2, 58, 114, 170, 280, 336, 392, 448):
        f, t, s = box(c, x0, 22, 46, 122, 6, "steel", -0.08)
        for k in range(2):                                         # two tape reels per cabinet, spokes at different angles
            ex = x0 + 12 + k * 22
            reel = g.disc(ex, 36, 9.5)
            c.fill(reel, 0.35 + 0.45 * (1 - g.radial(ex - 3, 33, 13)), "cu", outline="cu")
            c.set(g.ring(ex, 36, 9.5, 8.2), ("cu", 6))
            a0 = r.random() * math.pi
            for t_ in range(3):
                a = a0 + t_ * 2 * math.pi / 3
                c.set(g.line(ex + 3 * math.cos(a), 36 + 3 * math.sin(a), ex + 7.5 * math.cos(a), 36 + 7.5 * math.sin(a), 1.6), ("film", 1))
            c.fill(g.disc(ex, 36, 2.6), 0.9, "brass")
        c.set(g.line(x0 + 12, 45, x0 + 34, 45, 1), ("film", 2))           # tape path
        for dy in range(54, 138, 15):                              # drawers with labels and status lamps
            dr = g.rect(x0 + 4, dy, x0 + 42, dy + 12)
            c.fill(dr, 0.28 + 0.2 * (1 - g.lin(x0, dy, x0 + 42, dy + 12)), "steel", outline="steel")
            c.set(g.rect(x0 + 15, dy + 4, x0 + 31, dy + 8), ("film", 3))
            c.set(g.rect(x0 + 17, dy + 5, x0 + 17 + int(r.integers(4, 12)), dy + 6), ("ink", 0))
            led = ["lime", "ember", "cyan", "gold"][int(r.integers(0, 4))]
            if r.random() < 0.6:
                c.set(g.rect(x0 + 36, dy + 5, x0 + 39, dy + 7), (led, 5 if led != "ember" else 3))
    # the printer in the middle, feeding a long log strip to the floor
    px0 = cx - 30
    f, t, s = box(c, px0, 16, 60, 26, 6, "steel", 0.0)
    c.set(g.rect(px0 + 6, 34, px0 + 54, 36), ("ink", 0))
    for k in range(4):
        c.set(g.rect(px0 + 40 + k * 4, 21, px0 + 42 + k * 4, 23), (["lime", "lime", "ember", "gold"][k], 5 if k < 2 else 3))
    paper = g.rect(cx - 20, 36, cx + 20, 146)
    c.fill(paper, 0.55 + 0.4 * (1 - g.lin(cx - 20, 36, cx + 20, 146)), "eg")
    c.rim(paper, ("eg", 7))
    for y in range(44, 144, 5):
        ln = int(r.integers(8, 30))
        col = ("ember", 2) if r.random() < 0.15 else ("film", 1)
        c.set(g.rect(cx - 14, y, cx - 14 + ln, y + 1), col)
    for y in range(40, 146, 8):                                    # tractor holes
        c.set(g.disc(cx - 17, y, 1) | g.disc(cx + 17, y, 1), ("eg", 2))
    c.set(g.rect(cx - 20, 142, cx + 26, 146) & (g.B4 < 0.3), ("eg", 4))  # paper pooling on the floor
    c.glow(paper, ("ember", 4), 3, 70, 2)
    return c.finish()


# ---------------------------------------------------------------- Menu: the operator's desk
def desk():
    c = g.canvas()
    r = np.random.default_rng(34)
    # falling data behind the desk, lime and a little teal, brightest at the head of each stream
    for _ in range(70):
        x = int(r.integers(4, BW - 4))
        y0 = int(r.integers(-20, 60))
        n = int(r.integers(6, 16))
        pal = "lime" if r.random() < 0.8 else "teal"
        for k in range(n):
            y = y0 + k * 4
            if 0 <= y < 104:
                c.dot(x, y, (pal, min(len(P[pal]) - 1, 1 + k * 5 // n)), 120 + 135 * k // n)
    cx = 250
    # side racks with blinking lights
    for sx in (cx - 236, cx - 150, cx + 128, cx + 210):
        f, t, s = box(c, sx, 26, 18, 124, 4, "steel", -0.12)
        for k in range(10):
            col = ["lime", "lime", "cyan", "ember", "lime"][int(r.integers(0, 5))]
            if r.random() < 0.7:
                c.set(g.rect(sx + 4, 32 + k * 11, sx + 7, 34 + k * 11), (col, 5 if col != "ember" else 3))
            c.set(g.rect(sx + 10, 32 + k * 11, sx + 15, 33 + k * 11), ("steel", 1))
    # the monitor: a deep CRT in a steel shell, green text, scanlines
    shell = g.rect(cx - 70, 8, cx + 70, 90)
    c.fill(shell, 0.3 + 0.4 * (1 - g.lin(cx - 70, 8, cx + 70, 90)), "steel", outline="steel")
    c.rim(shell, ("steel", 6))
    scr = g.rect(cx - 62, 14, cx + 62, 82)
    c.fill(scr, 0.12 + 0.18 * (1 - g.radial(cx, 48, 70, 40)), "lime")
    c.set(scr & (Y.astype(int) % 2 == 0) & (g.B4 < 0.2), ("lime", 0))
    for k, ln in enumerate((40, 74, 58, 90, 30)):
        y = 22 + k * 11
        c.set(g.rect(cx - 54, y, cx - 54 + ln, y + 2), ("lime", 6))
        if k % 2 == 0:
            c.set(g.rect(cx + 32, y, cx + 50, y + 2), ("gold", 4))
    c.set(g.rect(cx - 54, 76, cx - 48, 80), ("lime", 7))
    c.glow(scr, ("lime", 5), 6, 80, 3, over=True)
    c.light(cx, 70, 120, ("lime", 4), 60, 60)
    c.fill(g.rect(cx - 12, 90, cx + 12, 104), 0.4, "steel", outline="steel")
    # the desk: steel top, a lit edge, toggle switches with coloured caps, a keyboard, a mug
    top_ = g.poly([(cx - 190, 104), (cx + 190, 104), (cx + 200, 112), (cx - 200, 112)])
    c.fill(top_, 0.55 + 0.3 * (1 - g.lin(cx - 200, 104, cx + 200, 112)), "steel", outline="steel")
    front = g.rect(cx - 200, 112, cx + 200, 150)
    c.fill(front, 0.22 + 0.2 * (1 - g.lin(cx - 200, 112, cx + 200, 150)), "steel", outline="steel")
    c.set(g.rect(cx - 200, 112, cx + 200, 113), ("lime", 4))
    caps = ["lime", "gold", "cyan", "mag", "lime", "ember"]
    for k in range(13):
        x = cx - 176 + k * 28
        if abs(x - cx) < 24:
            continue
        on = r.random() < 0.6
        c.fill(g.rect(x - 5, 120, x + 5, 142), 0.3, "steel", outline="steel")
        ky = 122 if on else 133
        cap = caps[k % len(caps)]
        c.fill(g.rect(x - 3, ky, x + 3, ky + 7), 0.75 if on else 0.4, cap, outline=cap)
        if on:
            c.set(g.rect(x - 1, 116, x + 1, 118), (cap, 5 if cap not in ("ember", "mag") else 4))
    kb = g.poly([(cx - 34, 105), (cx + 34, 105), (cx + 38, 111), (cx - 38, 111)])
    c.fill(kb, 0.35, "steel", outline="steel")
    for k in range(10):
        c.set(g.rect(cx - 30 + k * 6, 107, cx - 27 + k * 6, 109), ("steel", 5))
    mug = g.rect(cx + 92, 92, cx + 102, 104)
    c.fill(mug, 0.45 + 0.4 * (1 - g.lin(cx + 92, 92, cx + 102, 104)), "ember", outline="ember")
    c.set(g.ring(cx + 103, 98, 4, 2.4) & (X > cx + 102), ("ember", 2))
    for k in range(3):
        c.dot(cx + 95 + k * 2, 88 - k * 2, ("white", 1), 150)
    return c.finish()


# ---------------------------------------------------------------- Stress tests: the test bench
def bench():
    """A server node clamped on a test bench, probe leads sagging to a scope whose trace runs flat then spikes, sparks."""
    c = g.canvas()
    r = np.random.default_rng(35)
    sky(c, 120, "deep", "red", 0.32, seed=35)
    # bench top and legs
    top_ = g.rect(6, 132, 474, 137)
    c.fill(top_, 0.55 + 0.3 * (1 - g.lin(6, 132, 474, 137)), "steel", outline="steel")
    c.fill(g.rect(6, 137, 474, 150), 0.18, "steel")
    for lx in (30, 450):
        c.fill(g.rect(lx - 4, 137, lx + 4, 150), 0.4, "steel", outline="steel")
    # the node under test: a rack unit with blinking bays, held in a clamp frame
    nx = 150
    f, t, s = box(c, nx - 62, 60, 124, 68, 6, "steel", -0.08)
    for k, y in enumerate(range(66, 124, 11)):
        c.fill(g.rect(nx - 56, y, nx + 56, y + 8), 0.3, "steel", outline="steel")
        c.set(g.rect(nx - 50, y + 3, nx - 20, y + 5), ("ink", 0))
        for j in range(5):
            if r.random() < 0.6:
                col = ("red", 3) if (k + j) % 4 == 0 else ("lime", 5)
                c.set(g.rect(nx + 22 + j * 6, y + 3, nx + 24 + j * 6, y + 5), col)
    for px in (nx - 74, nx + 74):
        c.fill(g.rect(px - 4, 38, px + 4, 132), 0.55 + 0.3 * (1 - g.lin(px - 4, 38, px + 4, 132)), "brass", outline="brass")
    c.fill(g.rect(nx - 80, 33, nx + 82, 41), 0.6, "brass", outline="brass")
    c.fill(g.rect(nx - 2, 41, nx + 2, 60), 0.7, "steel")
    c.fill(g.rect(nx - 7, 20, nx + 7, 33), 0.7, "steel", outline="steel")
    c.set(g.rect(nx - 10, 22, nx + 10, 24), ("steel", 6))
    # the scope
    sx0, sy0, sx1, sy1 = 300, 28, 452, 112
    shell = g.rect(sx0, sy0, sx1, sy1)
    c.fill(shell, 0.3 + 0.35 * (1 - g.lin(sx0, sy0, sx1, sy1)), "steel", outline="steel")
    c.rim(shell, ("steel", 6))
    scr = g.rect(sx0 + 6, sy0 + 6, sx1 - 6, sy1 - 20)
    c.fill(scr, 0.1 + 0.1 * (1 - g.radial((sx0 + sx1) / 2, (sy0 + sy1) / 2, 80, 40)), "teal")
    for gx in range(sx0 + 18, sx1 - 6, 16):
        c.set(g.rect(gx, sy0 + 6, gx + 1, sy1 - 20) & (g.B4 < -0.1), ("teal", 2))
    mid = (sy0 + sy1 - 14) / 2
    pts = []
    for x in range(sx0 + 8, sx1 - 7, 2):
        fx = (x - sx0) / (sx1 - sx0)
        amp = 3 if fx < 0.55 else 3 + (fx - 0.55) * 75
        y = mid + amp * math.sin(x * 0.55) * (1 if r.random() < 0.9 else 1.5)
        pts.append((x, max(sy0 + 8, min(sy1 - 22, y))))
    trace = g.path(pts, 1.4)
    calm = trace & (X < sx0 + 0.55 * (sx1 - sx0))
    c.set(trace, ("red", 3))
    c.set(calm, ("teal", 4))
    c.glow(trace & ~calm, ("red", 3), 2, 120, 1, over=True)
    for k in range(5):
        kx = sx0 + 20 + k * 28
        knob = g.disc(kx, sy1 - 9, 4.5)
        c.fill(knob, 0.5 + 0.4 * (1 - g.radial(kx - 1.5, sy1 - 10.5, 6)), "steel", outline="steel")
    c.fill(g.rect(sx0 + 40, sy1, sx1 - 40, 132), 0.3, "steel", outline="steel")
    # probe leads, red / yellow / black, sagging from the node to the scope
    for k, ((y0, y1), col) in enumerate(zip(((80, 92), (98, 100), (114, 106)), (("red", 3), ("gold", 4), ("steel", 2)))):
        x0, x1 = nx + 62, sx0
        lead = [(x0 + (x1 - x0) * tt, y0 + (y1 - y0) * tt + 18 * math.sin(math.pi * tt)) for tt in np.linspace(0, 1, 24)]
        c.set(g.path(lead, 1.6), col)
        c.fill(g.rect(x0 - 2, y0 - 2, x0 + 4, y0 + 3), 0.8, col[0], outline=col[0])
    # the stress: arcs off the clamp and a hot glow
    for sx_, sy_ in ((nx + 74, 48), (nx - 74, 70)):
        x, y = sx_, sy_
        bolt = [(x, y)]
        for _ in range(5):
            x += int(r.integers(-7, 8))
            y -= int(r.integers(4, 9))
            bolt.append((x, y))
        bm = g.path(bolt, 1.4)
        c.set(bm, ("white", 2))
        c.glow(bm, ("red", 3), 3, 150, 2)
        for _ in range(6):
            c.spark(sx_ + int(r.integers(-12, 13)), sy_ + int(r.integers(-14, 6)), int(r.integers(0, 2)), ("gold", 5), ("white", 2))
    c.light(nx + 74, 48, 34, ("red", 3), 80)
    return c.finish()


# ---------------------------------------------------------------- Codex: the shelves and the open book
def shelf():
    """Two shelves of coloured spines either side, an open book in the middle under a lit bulb."""
    c = g.canvas()
    r = np.random.default_rng(36)
    sky(c, 110, "deep", "dusk", 0.3, seed=36)
    spine_pals = ["red", "cu", "si", "ae", "rn", "qz", "teal", "gold", "nb"]
    for x0, x1 in ((4, 176), (324, 476)):
        for shelf_y in (74, 144):
            plank = g.rect(x0, shelf_y, x1, shelf_y + 4)
            x = x0 + 2
            while x < x1 - 8:
                w = int(r.integers(6, 12))
                h = int(r.integers(32, 58))
                top = shelf_y - h
                pal = spine_pals[int(r.integers(0, len(spine_pals)))]
                lean = r.random() < 0.08
                sp = g.poly([(x, shelf_y), (x + w, shelf_y), (x + w + 6, top + 2), (x + 6, top)]) if lean else g.rect(x, top, x + w, shelf_y)
                c.fill(sp, 0.3 + 0.35 * (1 - g.lin(x, top, x + w, shelf_y)), pal, outline=pal)
                c.set(g.rect(x + 1, top + 6, x + w - 1, top + 8) & sp, ("gold", 4))
                if r.random() < 0.5:
                    c.set(g.rect(x + 1, shelf_y - 10, x + w - 1, shelf_y - 9) & sp, ("gold", 3))
                x += w + (8 if lean else 1)
            c.fill(plank, 0.4 + 0.3 * (1 - g.lin(x0, shelf_y, x1, shelf_y + 4)), "rn", outline="rn")
    # floor
    c.fill(Y >= 146, 0.2, "rn")
    cx = 250
    # the bulb over the book
    c.light(cx, 40, 110, ("gold", 4), 90, 70)
    c.fill(g.line(cx, 0, cx, 22, 1), 0.4, "steel")
    bulb = g.disc(cx, 36, 10, 13)
    c.fill(bulb, 0.75 + 0.25 * (1 - g.radial(cx - 3, 31, 12)), "gold", outline="gold")
    c.set(g.path([(cx - 4, 40), (cx - 2, 33), (cx, 40), (cx + 2, 33), (cx + 4, 40)], 1), ("white", 2))
    c.fill(g.rect(cx - 5, 22, cx + 5, 26), 0.6, "brass", outline="brass")
    c.glow(bulb, ("gold", 4), 8, 160, 4)
    for ang in (-2.6, -2.0, -1.2, -0.5, 0.5, 1.2, 2.0, 2.6):
        x0, y0 = cx + 22 * math.cos(ang), 36 + 22 * math.sin(ang)
        c.set(g.line(x0, y0, cx + 30 * math.cos(ang), 36 + 30 * math.sin(ang), 1) & (g.B4 < 0.3), ("gold", 4))
    # the open book on a small stand
    c.fill(g.poly([(cx - 30, 146), (cx + 30, 146), (cx + 16, 132), (cx - 16, 132)]), 0.4, "rn", outline="rn")
    lp = g.poly([(cx - 48, 96), (cx - 2, 100), (cx - 2, 134), (cx - 50, 130)])
    rp = g.poly([(cx + 2, 100), (cx + 48, 96), (cx + 50, 130), (cx + 2, 134)])
    c.fill(lp, 0.6 + 0.35 * (1 - g.lin(cx - 50, 96, cx, 134)), "eg", outline="eg")
    c.fill(rp, 0.5 + 0.3 * (1 - g.lin(cx, 96, cx + 50, 134)), "eg", outline="eg")
    c.set(g.line(cx, 98, cx, 135, 1.6), ("rn", 2))
    for y in range(106, 128, 5):
        c.set(g.rect(cx - 42, y, cx - 42 + int(r.integers(14, 32)), y + 1), ("film", 1))
        c.set(g.rect(cx + 8, y, cx + 8 + int(r.integers(14, 32)), y + 1), ("film", 1))
    c.set(g.rect(cx + 8, 103, cx + 22, 105), ("red", 3))
    for sx_, sy_ in ((cx - 30, 86), (cx + 34, 80), (cx + 6, 70)):
        c.spark(sx_, sy_, 1, ("gold", 5), ("white", 2))
    return c.finish()


def vignette(c, side=72, top=26):
    """Dither the art out toward the left, right and top edges so it melts into the banner instead of ending in a box."""
    fade = np.minimum.reduce([np.clip(X / side, 0, 1), np.clip((BW - X) / side, 0, 1), np.clip(Y / top, 0, 1)])
    c.img[fade < g.B8 + 0.5] = 0
    return c


PIECES = {"map": mast, "goals": plinths, "records": archive, "menu": desk, "stress": bench, "codex": shelf}

if __name__ == "__main__":
    want = sys.argv[1:] or list(PIECES)
    for key in want:
        im = vignette(PIECES[key]()).image()
        stem = os.path.join(OUT, f"win-{key}")
        im.save(f"{stem}.png", optimize=True)
        im.save(f"{stem}.webp", lossless=True, quality=100, method=6)
        print(f"win-{key}: {im.size}, webp {os.path.getsize(stem + '.webp') / 1000:.1f} KB")
