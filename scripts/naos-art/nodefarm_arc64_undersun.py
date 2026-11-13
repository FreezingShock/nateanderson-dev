"""64 px button sprites and zone icons for Undersun, zones 26 to 29 (after the ending): Corona, Plasma, Lattice, Radiance.

Same kit and rules as nodefarm_arc64.py (which this module registers its motifs into, so nodefarm_tiers64_<stat>.py stubs can
call its make()). Each zone has six tiers, each drawn from one motif: tiers grow in size, parts and motion, and tier 5 (the
namesake) is also the zone icon. Light comes from the top-left. draw(t, p) -> Canvas, phase p in [0, 1).

Palettes run dark to light, hue-shifted: gold-white for the rim, magenta for the plasma, teal for the grid, mint for the glow.
"""
import math

import numpy as np

import nodefarm_arc64 as A
from nodefarm_icon_kit import (P, X, Y, Canvas, box, disc, grow, hexagon, lin, path, poly, radial, ramp, rect, ring, shadow,
                               star4, tilted_ring, wave)

P.update({
    "cn": ramp("#1a1404", "#40300a", "#806012", "#b8900e", "#e8b422", "#ffe27a", "#fff4c0", "#fffdf0"),
    "pl": ramp("#1a0418", "#40083a", "#7a1270", "#b02aa8", "#e050d0", "#ff5ad0", "#ffa8e6", "#fff0fb"),
    "lt": ramp("#031a1c", "#063a3e", "#0f6e72", "#1a9ea0", "#2fc8c4", "#7afff0", "#c4fff9", "#f0fffe"),
    "rd": ramp("#041a08", "#0a3a16", "#166a2a", "#25a046", "#3dd164", "#8dff9a", "#c8ffd0", "#f2fff4"),
})


def halo(c, cx, cy, r, pal, a=120):
    """Dithered round halo on empty pixels only."""
    from nodefarm_icon_kit import BAYER
    d = np.hypot(X - cx, Y - cy) / r
    m = (d < 1) & ~c.alpha & (BAYER + 0.5 < (1 - d) * 1.2)
    c.img[m] = (*P[pal][5], a)


# ---------------------------------------------------------------- 26 Corona: the bright rim
def glint(c, p):
    """Glint: one bright point that swells and fades, with a faint halo."""
    g = wave(p)
    halo(c, 32, 32, 12 + 6 * g, "cn", 90)
    c.spark(32, 32, 1 + int(g * 2), ("cn", 6), core=("cn", 7))
    c.set(disc(32, 32, 3 + 2 * g), P["cn"][5], 255)
    c.set(disc(31, 31, 1.4), P["cn"][7])


def streamer(c, p):
    """Streamer: a bright lick of light that flows along an arc off the rim."""
    g = wave(p)
    halo(c, 32, 40, 24, "cn", 70)
    for k, off in enumerate((0.0, 0.5)):
        pts = []
        for t in np.linspace(0, 1, 18):
            a = math.pi * (0.15 + 0.7 * t)
            r = 24 + 4 * math.sin(math.pi * t * 2 + 2 * math.pi * (p + off))
            pts.append((32 + math.cos(a) * r, 46 - math.sin(a) * r * 0.9))
        c.set(path(pts, 2 + k), P["cn"][5 - k])
    c.set(disc(32 + 20 * math.cos(math.pi * (0.15 + 0.7 * g)), 46 - 20 * math.sin(math.pi * (0.15 + 0.7 * g)), 2), P["cn"][7])
    c.fill(disc(32, 50, 9), 0.5 + 0.2 * g, "cn", outline="cn")


def loop(c, p):
    """Loop: a tilted ring of light with a bead running round it."""
    back, front = tilted_ring(32, 32, 24, 9, -18, 2.4)
    c.set(back & ~front, P["cn"][3])
    s = disc(32, 32, 9)
    c.fill(s, 0.7 + 0.2 * wave(p), "cn", outline="cn")
    c.set(disc(30, 30, 2.5), P["cn"][7])
    a = 2 * math.pi * p
    t = math.radians(-18)
    bx = 32 + math.cos(a) * 24 * math.cos(t) - math.sin(a) * 9 * math.sin(t)
    by = 32 + math.cos(a) * 24 * math.sin(t) + math.sin(a) * 9 * math.cos(t)
    c.set(disc(bx, by, 2.2), P["cn"][7])
    c.set(back & front & ~s, P["cn"][5])


def arc(c, p):
    """Arc: a bright arc leaping between two clamps, flickering."""
    g = wave(p)
    for side in (-1, 1):
        c.fill(rect(32 + side * 18 - 3, 44, 32 + side * 18 + 3, 52), 0.7, "cn", outline="cn")
    pts = [(32 - 18 + 36 * t + (0.5 - ((t * 37 + p * 11) % 1)) * 5, 42 - 14 * math.sin(math.pi * t)) for t in np.linspace(0, 1, 14)]
    c.set(path(pts, 2), P["cn"][5])
    pts2 = [(x, y + 3 + 2 * g) for x, y in pts]
    c.set(path(pts2, 1), P["cn"][7])
    halo(c, 32, 36, 24, "cn", 60)


def crown(c, p):
    """Crown: a disc with a ring of spikes that turn and breathe."""
    g = wave(p)
    halo(c, 32, 32, 28, "cn", 70)
    for k in range(10):
        a = 2 * math.pi * k / 10 + p * math.pi / 5
        ln = 20 + 5 * wave(p, 1, k / 10)
        pts = [(32 + math.cos(a) * 12, 32 + math.sin(a) * 12), (32 + math.cos(a) * ln, 32 + math.sin(a) * ln)]
        c.set(path(pts, 2), P["cn"][4 if k % 2 else 5])
    s = disc(32, 32, 12)
    c.fill(s, 0.55 + 0.4 * (1 - np.clip(np.hypot(X - 28, Y - 28) / 18, 0, 1)), "cn", outline="cn")
    c.set(disc(28, 28, 3.5 + g), P["cn"][7])


def corona(c, p):
    """Corona: the namesake. A bright disc in a ring of rays, with a loop of light round it."""
    g = wave(p)
    halo(c, 32, 32, 30, "cn", 80)
    back, front = tilted_ring(32, 32, 27, 8, -10, 2.2)
    c.set(back & ~front, P["cn"][4])
    for k in range(12):
        a = 2 * math.pi * k / 12 - p * math.pi / 6
        ln = 22 + (4 if k % 3 == 0 else 0) + 3 * wave(p, 1, k / 12)
        pts = [(32 + math.cos(a) * 14, 32 + math.sin(a) * 14), (32 + math.cos(a) * ln, 32 + math.sin(a) * ln)]
        c.set(path(pts, 1), P["cn"][6])
    s = disc(32, 32, 14 + g)
    c.fill(s, 0.6 + 0.4 * (1 - np.clip(np.hypot(X - 28, Y - 28) / 20, 0, 1)), "cn", outline="cn")
    c.set(disc(28, 28, 4), P["cn"][7])
    c.set(back & front & ~s, P["cn"][6])


CORONA = [glint, streamer, loop, arc, crown, corona]


# ---------------------------------------------------------------- 27 Plasma: charged gas in a field
def wisp(c, p):
    """Wisp: three soft specks of plasma drifting on a loop."""
    for k in range(3):
        a = 2 * math.pi * (p + k / 3)
        x, y = 32 + math.cos(a) * 14, 32 + math.sin(a) * 7
        c.fill(disc(x, y, 3), 0.7, "pl", outline="pl")
        halo(c, x, y, 7, "pl", 70)
    c.set(disc(32, 32, 1.5), P["pl"][7])


def filament(c, p):
    """Filament: a wavy thread of plasma that ripples along its length."""
    pts = []
    for t in np.linspace(0, 1, 26):
        x = 10 + 44 * t
        y = 34 + 8 * math.sin(2 * math.pi * (2 * t - p)) * (0.4 + 0.6 * t)
        pts.append((x, y))
    c.set(path(pts, 3), P["pl"][3])
    c.set(path(pts, 1), P["pl"][6])
    x, y = pts[int(p * 24) + 1]
    c.set(disc(x, y, 2), P["pl"][7])


def plume(c, p):
    """Plume: a column of charged gas lifting off, its specks rising and fading."""
    base = 56
    c.fill(disc(32, base, 10, 3), 0.5, "pl", outline="pl")
    for k in range(10):
        t = (p + k / 10) % 1
        x = 32 + math.sin(k * 1.7 + t * 4) * (3 + 8 * t)
        y = base - 2 - t * 44
        c.set(disc(x, y, 1.6 * (1 - t) + 0.6), P["pl"][int(6 - 3 * t)])


def torus(c, p):
    """Torus: a thick ring of plasma, spinning in a tilted plane, with a hot spot that runs round it."""
    ring_, near = tilted_ring(32, 32, 22, 15, 20, 5)
    c.fill(ring_ & ~near, 0.4, "pl", outline="pl")
    c.fill(ring_ & near, 0.6, "pl", outline="pl")
    a = 2 * math.pi * p
    x, y = 32 + math.cos(a) * 22 * math.cos(math.radians(20)) - math.sin(a) * 15 * math.sin(math.radians(20)), 32 + math.cos(a) * 22 * math.sin(math.radians(20)) + math.sin(a) * 15 * math.cos(math.radians(20))
    c.set(disc(x, y, 3), P["pl"][7])
    halo(c, x, y, 7, "pl", 80)


def stream(c, p):
    """Stream: a run of plasma arcs flowing left to right, each one brightening as it passes the middle."""
    for k in range(4):
        u = (p + k / 4) % 1
        x0 = 6 + 46 * u
        pts = [(x0 + t * 14, 40 - 8 * math.sin(math.pi * t) - 4 * t) for t in np.linspace(0, 1, 8)]
        c.set(path(pts, 2), P["pl"][int(3 + 3 * (1 - abs(u - 0.5) * 2))])
    c.set(disc(32, 32, 0.5), P["pl"][7])


def plasma(c, p):
    """Plasma: the namesake. A ball of magenta gas with swirling bands and a bright core."""
    s = disc(32, 32, 22)
    d = np.hypot(X - 32, Y - 32) / 22
    ang = np.arctan2(Y - 32, X - 32)
    band = 0.5 + 0.5 * np.sin(ang * 3 + p * 2 * math.pi * 2 - d * 4)
    c.fill(s, 0.25 + 0.5 * band * (1 - d) + 0.2 * (1 - d), "pl", outline="pl")
    halo(c, 32, 32, 32, "pl", 80)
    c.set(disc(27, 27, 5), P["pl"][7])
    ring_, near = tilted_ring(32, 32, 28, 6, 0, 1.6)
    c.set(ring_ & near & ~s, P["pl"][6])


PLASMA = [wisp, filament, plume, torus, stream, plasma]


# ---------------------------------------------------------------- 28 Lattice: a grid of light that holds still
def pin(c, p):
    """Pin: one node with crosshair arms that blink."""
    g = wave(p)
    c.fill(disc(32, 32, 5), 0.6 + 0.3 * g, "lt", outline="lt")
    c.set(disc(31, 31, 1.5), P["lt"][7])
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        c.set(path([(32 + dx * 7, 32 + dy * 7), (32 + dx * 18, 32 + dy * 18)], 1), P["lt"][5 if g > 0.5 else 3])


def strut(c, p):
    """Strut: a diagonal beam set with nodes, a light running down it."""
    c.set(path([(10, 54), (54, 10)], 3), P["lt"][3])
    c.set(path([(10, 54), (54, 10)], 1), P["lt"][5])
    for t in (0.0, 0.5, 1.0):
        x, y = 10 + 44 * t, 54 - 44 * t
        c.fill(disc(x, y, 4), 0.7, "lt", outline="lt")
    u = p
    c.set(disc(10 + 44 * u, 54 - 44 * u, 2.2), P["lt"][7])


def truss(c, p):
    """Truss: a triangle of struts in a grid, nodes lighting in turn."""
    pts = [(32, 8), (56, 54), (8, 54)]
    for a, b in ((pts[0], pts[1]), (pts[1], pts[2]), (pts[2], pts[0])):
        c.set(path([a, b], 2), P["lt"][3])
    c.set(path([(32, 8), (32, 54)], 1), P["lt"][2])
    c.set(path([(20, 31), (44, 31)], 1), P["lt"][2])
    for k, (x, y) in enumerate([(32, 8), (56, 54), (8, 54), (32, 31), (20, 31), (44, 31)]):
        c.fill(disc(x, y, 3.2), 0.85 if k == int(p * 6) % 6 else 0.35, "lt", outline="lt")


def cell(c, p):
    """Cell: one square cell whose corners light up in turn."""
    g = wave(p)
    c.fill(rect(14, 14, 50, 50), 0.3 + 0.3 * g, "lt", outline="lt")
    for k, (x, y) in enumerate(((14, 14), (50, 14), (50, 50), (14, 50))):
        on = int(p * 8) % 4 == k
        c.fill(disc(x, y, 3), 0.95 if on else 0.5, "lt", outline="lt")
    c.set(rect(31, 31, 33, 33), P["lt"][7])


def frame(c, p):
    """Frame: a 3 by 3 grid of cells, the light walking through them in a loop."""
    for i in range(3):
        for j in range(3):
            x0, y0 = 10 + i * 16, 10 + j * 16
            on = ((i + j) - int(p * 5)) % 5 == 0
            c.fill(rect(x0, y0, x0 + 12, y0 + 12), 0.9 if on else 0.35, "lt", outline="lt")


def lattice(c, p):
    """Lattice: the namesake. An isometric grid of nodes with a pulse walking across it."""
    for i in range(4):
        for j in range(4):
            x = 16 + (i - j) * 9
            y = 14 + (i + j) * 6
            d = ((i + j) - p * 7) % 7
            lit = d < 1.5
            c.fill(disc(x, y, 2.8), 0.95 if lit else 0.45, "lt", outline="lt")
    halo(c, 32, 32, 30, "lt", 60)
    c.set(disc(32, 32, 2), P["lt"][7])


LATTICE = [pin, strut, truss, cell, frame, lattice]


# ---------------------------------------------------------------- 29 Radiance: the light thrown back at the dark
def glimmer(c, p):
    """Glimmer: a few sparks drifting round a faint ring."""
    for k in range(4):
        a = 2 * math.pi * (p * 0.5 + k / 4)
        x, y = 32 + math.cos(a) * 18, 32 + math.sin(a) * 18
        c.spark(x, y, 2 if (p * 4 + k) % 2 < 1 else 1, ("rd", 5), core=("rd", 7))
        halo(c, x, y, 5, "rd", 60)


def ribbon(c, p):
    """Ribbon: a band of light that waves across the sprite."""
    for k in range(2):
        pts = [(6 + 52 * t, 30 + 8 * math.sin(2 * math.pi * (t - p + k * 0.3))) for t in np.linspace(0, 1, 24)]
        c.set(path(pts, 3 - k), P["rd"][3 + k])
        c.set(path([(x, y - 1.5) for x, y in pts], 1), P["rd"][6])


def curtain(c, p):
    """Curtain: three vertical folds of light, their bottoms rippling."""
    for k in range(3):
        xc = 16 + 16 * k
        for x in range(xc - 6, xc + 7):
            bot = 46 + 4 * math.sin(x * 0.7 + p * 2 * math.pi + k)
            m = (np.floor(X) == x) & (Y > 16) & (Y < bot)
            c.fill(m, 0.5 + 0.4 * (1 - abs(x - xc) / 6.0), "rd", outline=None)


def fold(c, p):
    """Fold: two curtains folding over each other, one shifting with the phase."""
    shift = 6 * math.sin(2 * math.pi * p)
    for k, (cx, col) in enumerate(((22 + shift, 3), (42 - shift, 5))):
        m = (np.abs(X - cx) < 8) & (Y > 14) & (Y < 50 + 3 * np.sin(X * 0.5 + k))
        c.fill(m, 0.4 + 0.3 * (1 - np.abs(X - cx) / 8.0), "rd")
    c.set(path([(10, 52), (54, 52)], 1), P["rd"][4])


def veil(c, p):
    """Veil: a dome of light with striations radiating from its top."""
    m = disc(32, 46, 24, 26) & (Y < 46)
    d = np.hypot(X - 32, (Y - 46) * 1.0) / 24
    ang = np.arctan2(Y - 46, X - 32)
    stripe = 0.5 + 0.5 * np.sin(ang * 8 + p * 2 * math.pi)
    c.fill(m, 0.3 + 0.4 * stripe * (1 - d), "rd", outline="rd")
    halo(c, 32, 40, 30, "rd", 60)


def radiance(c, p):
    """Radiance: the namesake. A bright orb with curtains of light falling from it."""
    g = wave(p)
    halo(c, 32, 30, 30, "rd", 80)
    for k in range(8):
        a = math.pi * (0.1 + 0.8 * k / 7)
        pts = [(32 + math.cos(a) * 14, 30 - math.sin(a) * 14), (32 + math.cos(a) * (20 + 3 * g), 30 - math.sin(a) * (20 + 3 * g))]
        c.set(path(pts, 1), P["rd"][5])
    s = disc(32, 30, 12)
    c.fill(s, 0.55 + 0.4 * (1 - np.clip(np.hypot(X - 28, Y - 26) / 16, 0, 1)), "rd", outline="rd")
    c.set(disc(28, 26, 3), P["rd"][7])
    for k, x0 in enumerate((14, 32, 48)):
        for x in range(x0 - 2, x0 + 3):
            bot = 52 + 4 * math.sin(x * 0.8 + p * 2 * math.pi)
            m = (np.floor(X) == x) & (Y > 42) & (Y < bot)
            c.fill(m, 0.6, "rd")


RADIANCE = [glimmer, ribbon, curtain, fold, veil, radiance]

# Register the four zones with the shared arc table, so make(stat) and the sheet builder find them.
A.ARCS.update({"corona": CORONA, "plasma": PLASMA, "lattice": LATTICE, "radiance": RADIANCE})
make = A.make
