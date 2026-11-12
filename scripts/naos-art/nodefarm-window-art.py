"""Node Farm window banners: one original dithered piece per older window (Map, Goals, Records, Menu).

Run:  python3 scripts/naos-art/nodefarm-window-art.py              (all)
      python3 scripts/naos-art/nodefarm-window-art.py map goals    (just those)
Output: public/naos/nodefarm/win-<name>.{png,webp}, 480 x 150 art pixels, shown 1:1 (pixelated) in the banner at the top of
each window (components/nodefarm/win-banner.tsx). Same palette scheme as the era scenery (index 0 transparent, 1 = the
colour at 55 percent for dither fills, 2 = the colour for lines and lit pixels). Reuses the Canvas from nodefarm-scenes.py.
Everything is procedural; nothing is traced or borrowed.
"""
import importlib.util
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("nf_scenes", os.path.join(HERE, "nodefarm-scenes.py"))
sc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sc)

BW, BH = 480, 150


def mast():
    """Map: a lattice signal mast broadcasting rings, fed by a chain of nodes along the ground."""
    c = sc.Canvas(31)
    r = c.rng
    c.haze(0.0, 0.22, 1.8, BH)
    c.stars(40, sparkle=4)
    cx, top, base = 240, 18, 132
    for k, rr in enumerate((34, 58, 84, 112, 142)):           # broadcast rings, dithered arcs fading outward
        pts = [(cx + rr * np.cos(t), top + 10 + rr * 0.55 * np.sin(t)) for t in np.linspace(np.pi * 1.05, np.pi * 1.95, 40)]
        pts += [(cx + rr * np.cos(t), top + 10 + rr * 0.55 * np.sin(t)) for t in np.linspace(-np.pi * 0.95, -np.pi * 0.05, 40)]
        for i, (x, y) in enumerate(pts):
            if i % (2 + k) == 0:
                c.dot(x, y)
    c.radial(cx, top + 10, 2, 40, peak=0.5)
    # the mast: two legs narrowing to the top, cross bracing
    for y in range(top + 8, base, 2):
        f = (y - top) / (base - top)
        hw = 3 + f * 22
        c.dot(cx - hw, y)
        c.dot(cx + hw, y)
    c.line([(cx - 3, top + 8), (cx - 25, base)])
    c.line([(cx + 3, top + 8), (cx + 25, base)])
    ys = list(range(top + 18, base, 14))
    for i in range(len(ys) - 1):
        y0, y1 = ys[i], ys[i + 1]
        w0, w1 = 3 + (y0 - top) / (base - top) * 22, 3 + (y1 - top) / (base - top) * 22
        c.line([(cx - w0, y0), (cx + w1, y1)])
        c.line([(cx + w0, y0), (cx - w1, y1)])
        c.line([(cx - w0, y0), (cx + w0, y0)])
    c.rect(cx - 4, top - 2, cx + 4, top + 8, 1.0)           # the beacon
    c.line([(cx, top - 12), (cx, top - 2)])
    # ground and the chain of nodes running into the mast from both sides
    c.ground(lambda x: base + 2 * np.sin(x / 40), top=0.36, bottom=0.08)
    for side in (-1, 1):
        prev = (cx + side * 30, base - 4)
        for k in range(1, 6):
            x = cx + side * (30 + k * 40)
            y = base - 6 - int(r.integers(0, 6))
            c.line([prev, (x, prev[1]), (x, y)])
            c.rect(x - 6, y - 10, x + 6, y, 0.45)
            c.rect(x - 2, y - 7, x + 2, y - 3, 1.0, edge=False)
            c.ds.rectangle((x - 2, y - 7, x + 1, y - 4), fill=255)
            prev = (x, y - 5)
    return c


def plinths():
    """Goals: seven medallions on stepped plinths, rising to a crystal in the middle."""
    c = sc.Canvas(32)
    r = c.rng
    c.haze(0.0, 0.2, 1.6, BH)
    c.stars(36, sparkle=6)
    cx, base = 240, 140
    c.ground(lambda x: base, top=0.32, bottom=0.1)
    for i in range(7):
        d = abs(i - 3)
        x = cx + (i - 3) * 62
        h = 64 - d * 14
        w = 22
        c.rect(x - w, base - h, x + w, base, 0.22 + 0.06 * (3 - d))
        for ty in range(base - h + 6, base - 2, 6):
            c.dot(x - w + 4, ty)
            c.dot(x + w - 4, ty)
        my = base - h - 18
        if i == 3:                                            # the crystal
            c.radial(x, my - 14, 4, 46, peak=0.5)
            c.poly([(x, my - 40), (x + 14, my - 14), (x, my + 10), (x - 14, my - 14)], 0.6)
            c.line([(x, my - 40), (x, my + 10)])
            c.line([(x - 14, my - 14), (x + 14, my - 14)])
        else:
            rr = 12 - d
            c.ellipse((x - rr, my - rr, x + rr, my + rr), 0.5 if d < 3 else 0.2)
            if r.random() < 0.7:
                c.ellipse((x - rr + 4, my - rr + 4, x + rr - 4, my + rr - 4), 0.9, edge=False)
            c.line([(x - 4, my + rr), (x - 6, my + rr + 8)])
            c.line([(x + 4, my + rr), (x + 6, my + rr + 8)])
    return c


def archive():
    """Records: an archive wall of tape reels and drawers, a printer feeding a log strip down the middle."""
    c = sc.Canvas(33)
    r = c.rng
    c.haze(0.0, 0.18, 1.6, BH)
    base = 146
    for x0 in (8, 78, 148, 268, 338, 408):
        c.rect(x0, 14, x0 + 64, base, 0.16)
        for k in range(2):                                    # two reels per cabinet
            ex = x0 + 18 + k * 28
            c.ellipse((ex - 11, 24, ex + 11, 46), 0.42)
            c.ellipse((ex - 3, 32, ex + 3, 38), 1.0, edge=False)
            for t in np.linspace(0, 6.28, 4, endpoint=False):
                c.line([(ex + 3 * np.cos(t + k), 35 + 3 * np.sin(t + k)), (ex + 10 * np.cos(t + k), 35 + 10 * np.sin(t + k))])
        for dy in range(56, base - 8, 18):                    # drawers
            c.rect(x0 + 6, dy, x0 + 58, dy + 14, 0.3)
            c.line([(x0 + 26, dy + 7), (x0 + 38, dy + 7)])
            if r.random() < 0.4:
                c.ds.rectangle((x0 + 50, dy + 4, x0 + 52, dy + 6), fill=255)
    cx = 240
    c.rect(cx - 40, 12, cx + 40, 44, 0.5)                     # the printer
    c.line([(cx - 30, 36), (cx + 30, 36)])
    for k in range(4):
        c.ds.rectangle((cx + 20 + k * 4, 18, cx + 21 + k * 4, 19), fill=255)
    c.rect(cx - 24, 44, cx + 24, base + 4, 0.08)              # the paper, with printed lines
    for y in range(52, base, 6):
        ln = int(r.integers(12, 40))
        c.line([(cx - 18, y), (cx - 18 + ln, y)])
    for y in range(48, base, 10):                             # tractor holes
        c.dot(cx - 22, y)
        c.dot(cx + 22, y)
    return c


def desk():
    """Menu: a control desk: a monitor with a prompt, a row of toggle switches, cables to the floor."""
    c = sc.Canvas(34)
    r = c.rng
    c.haze(0.0, 0.2, 1.6, BH)
    for x in r.integers(4, BW - 4, 30):                       # data falling behind
        y0 = int(r.integers(0, 60))
        for y in range(y0, y0 + int(r.integers(10, 40)), 3):
            c.dot(x, y)
    cx = 240
    c.rect(cx - 72, 8, cx + 72, 92, 0.3)                      # monitor
    c.rect(cx - 64, 14, cx + 64, 84, 0.06)
    for k, ln in enumerate((40, 74, 58, 90, 30)):             # config lines
        y = 22 + k * 11
        c.line([(cx - 56, y), (cx - 56 + ln, y)])
        if k % 2 == 0:
            c.ds.rectangle((cx + 34, y - 1, cx + 50, y + 1), fill=255)
    c.rect(cx - 56, 76, cx - 50, 80, 1.0, edge=False)         # cursor
    c.ds.rectangle((cx - 56, 76, cx - 51, 79), fill=255)
    c.rect(cx - 12, 92, cx + 12, 104, 0.4)                    # stand
    c.rect(cx - 210, 104, cx + 210, 150, 0.28)                # the desk with switches
    c.line([(cx - 210, 112), (cx + 210, 112)])
    for k in range(14):
        x = cx - 190 + k * 29
        if abs(x - cx) < 20:
            continue
        on = r.random() < 0.6
        c.rect(x - 5, 120, x + 5, 140, 0.5)
        ky = 122 if on else 132
        c.rect(x - 3, ky, x + 3, ky + 6, 1.0, edge=False)
        c.ds.rectangle((x - 3, ky, x + 2, ky + 5), fill=255)
        if on:
            c.ds.rectangle((x - 1, 116, x, 117), fill=255)
    for sx in (cx - 230, cx + 228):                           # side racks
        c.rect(sx, 20, sx + 12 if sx > cx else sx + 12, 150, 0.2)
    return c


def bench():
    """Stress tests: a server node clamped on a test bench, probes running to a scope that shows a spiking trace, sparks."""
    c = sc.Canvas(35)
    r = c.rng
    c.haze(0.0, 0.2, 1.7, BH)
    c.stars(24, sparkle=3)
    base = 132
    c.rect(20, base, 460, 150, 0.3)                            # the bench top and its edge
    c.line([(20, base), (460, base)])
    for lx in (40, 440):                                       # legs
        c.rect(lx - 4, base, lx + 4, 150, 0.5)
    # the node under test: a rack unit in a clamp frame
    nx = 150
    c.rect(nx - 70, 58, nx + 70, base - 4, 0.22)
    for k, y in enumerate(range(66, base - 10, 12)):
        c.rect(nx - 62, y, nx + 62, y + 8, 0.36)
        for j in range(5):
            if r.random() < 0.55:
                c.ds.rectangle((nx + 30 + j * 6, y + 3, nx + 31 + j * 6, y + 4), fill=255)
    for cx_ in (nx - 78, nx + 78):                             # clamp posts and the screw bar over the top
        c.rect(cx_ - 4, 40, cx_ + 4, base - 4, 0.6)
    c.rect(nx - 82, 36, nx + 82, 44, 0.5)
    c.line([(nx, 44), (nx, 58)])
    c.rect(nx - 6, 22, nx + 6, 36, 0.7)
    # the scope: a screen with a grid and a trace that runs flat, then spikes past the top
    sx0, sy0, sx1, sy1 = 280, 30, 440, 112
    c.rect(sx0, sy0, sx1, sy1, 0.3)
    c.rect(sx0 + 6, sy0 + 6, sx1 - 6, sy1 - 18, 0.05)
    for gx in range(sx0 + 16, sx1 - 6, 16):
        for gy in range(sy0 + 10, sy1 - 18, 4):
            c.dot(gx, gy)
    mid = (sy0 + sy1 - 12) // 2
    pts = []
    for x in range(sx0 + 8, sx1 - 8, 2):
        f = (x - sx0) / (sx1 - sx0)
        amp = 3 if f < 0.55 else 3 + (f - 0.55) * 70
        pts.append((x, mid + amp * np.sin(x * 0.55) * (1 if r.random() < 0.9 else 1.6)))
    c.line([(x, max(sy0 + 7, min(sy1 - 19, y))) for x, y in pts])
    for k in range(5):                                         # knobs under the screen
        kx = sx0 + 20 + k * 28
        c.ellipse((kx - 5, sy1 - 14, kx + 5, sy1 - 4), 0.6)
    c.rect(sx0 + 30, sy1, sx1 - 30, base - 2, 0.25)            # scope stand
    # probe leads from the node to the scope, sagging
    for k, (y0, y1) in enumerate(((80, 92), (98, 100), (114, 106))):
        x0, x1 = nx + 70, sx0
        pts = [(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + 18 * np.sin(np.pi * t)) for t in np.linspace(0, 1, 24)]
        c.line(pts)
        c.rect(x0 - 2, y0 - 2, x0 + 3, y0 + 2, 1.0, edge=False)
    # sparks off the clamp, lightning drawn as a zig-zag
    for sx_, sy_ in ((nx + 78, 50), (nx - 78, 70)):
        x, y = sx_, sy_
        pts = [(x, y)]
        for _ in range(5):
            x += r.integers(-7, 8)
            y -= r.integers(4, 9)
            pts.append((x, y))
        c.line(pts)
        for _ in range(6):
            c.dot(sx_ + r.integers(-12, 13), sy_ + r.integers(-14, 6))
    c.radial(nx + 78, 50, 2, 26, peak=0.4)
    return c


def shelf():
    """Codex: two shelves of entry spines either side, an open book at the centre and a lit bulb over it."""
    c = sc.Canvas(35)
    r = c.rng
    c.haze(0.0, 0.2, 1.6, BH)
    c.stars(30, sparkle=3)
    for x0, x1 in ((6, 150), (330, 474)):                     # spines on two shelves
        for shelf_y in (74, 146):
            x = x0
            while x < x1 - 6:
                w = int(r.integers(6, 12))
                h = int(r.integers(30, 58))
                top = shelf_y - h
                c.rect(x, top, x + w, shelf_y, 0.22 if r.random() < 0.6 else 0.4)
                c.line([(x, top + 8), (x + w, top + 8)])
                if r.random() < 0.5:
                    c.dot(x + w // 2, top + 16)
                x += w + 2
            c.line([(x0, shelf_y + 2), (x1, shelf_y + 2)])
    # the open book, two pages with printed lines and a spine down the middle
    cx = 240
    c.rect(cx - 44, 92, cx - 2, 130, 0.35)
    c.rect(cx + 2, 92, cx + 44, 130, 0.35)
    c.line([(cx, 90), (cx, 132)])
    for y in range(100, 128, 5):
        c.line([(cx - 36, y), (cx - 36 + int(r.integers(14, 30)), y)])
        c.line([(cx + 10, y), (cx + 10 + int(r.integers(14, 30)), y)])
    c.line([(cx - 44, 130), (cx, 136), (cx + 44, 130)])
    # the bulb over the book, with its base and a few rays
    c.ellipse((cx - 9, 24, cx + 9, 50), 1.0)
    c.rect(cx - 5, 50, cx + 5, 60, 0.7)
    c.line([(cx - 4, 56), (cx + 4, 56)])
    c.radial(cx, 38, 2, 44, peak=0.5)
    for ang in (-2.4, -1.9, -1.3, -0.4, 0.4, 1.3, 1.9, 2.4):
        x0, y0 = cx + 22 * np.cos(ang), 38 + 22 * np.sin(ang)
        c.line([(x0, y0), (cx + 34 * np.cos(ang), 38 + 34 * np.sin(ang))])
    c.ground(lambda x: 146 + np.sin(x / 40), top=0.3, bottom=0.06)
    return c


PIECES = {"map": (mast, "#2fd8e8"), "goals": (plinths, "#ffc53a"), "records": (archive, "#f0a53c"), "menu": (desk, "#b6f04a"), "stress": (bench, "#ff2a2a"), "codex": (shelf, "#ff6b57")}

if __name__ == "__main__":
    want = sys.argv[1:] or list(PIECES)
    for key in want:
        fn, color = PIECES[key]
        c = sc.sized(BW, BH, fn)
        sc.sized(BW, BH, lambda: c.save(f"win-{key}", color))
