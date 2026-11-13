"""Node Farm era scenery for Undersun, zones 26 to 29 (after the ending), drawn in colour and in layers like the other arcs.

Eras 23..26: 23 Rim (Solar rim, Corona), 24 Spin (Plasma field, Plasma), 25 Hold (Lattice hall, Lattice),
26 Glow (Glow shelf, Radiance). The sun's light leaves the last clamp, is spun into a field, held on a grid and thrown back as
curtains over the dark.

Built on the arc kit in nodefarm-scenes-arc.py (which loads the deep kit), so the View, Layer, noise and the 480-wide seamless
loop all match. Each era keeps to its zone's ramp plus an accent, and keeps busy parts below row 70 (the page fades the top).

Run:  python3 scripts/naos-art/nodefarm-scenes-undersun.py          (all four)
      python3 scripts/naos-art/nodefarm-scenes-undersun.py 25       (one era)
Then run node scripts/nodefarm/stamp-art.mjs so the CSS picks up the new files.
"""
import importlib.util
import math
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("nodefarm_scenes_arc", HERE / "nodefarm-scenes-arc.py")
A = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(A)
K = A.K

View, Layer, noise, rnd, over = K.View, K.Layer, K.noise, K.rnd, K.over
WW, WH, FRAMES, TAU, HOR = K.WW, K.WH, K.FRAMES, K.TAU, K.HOR
starfield, twinkles, hills, below = K.starfield, K.twinkles, K.hills, K.below
rack = A.rack

# =====================================================================================================================
# 23 Rim: the sun's bright edge with nothing holding it now. A huge gold half-disc at the top, racks on a dark floor,
# and flares that throw long streaks off the rim on a clock.
# =====================================================================================================================
RIM_X, RIM_Y, RIM_R = 300, 150, 120
RIM_FIELD = noise(231, 90, 3, 0.55)


def rim_far(v):
    L = Layer(v)
    glow = v.radial(RIM_X, RIM_Y, 260, 170)
    L.gas(glow ** 1.3, "rn", 0, 3, v.wy < HOR)
    L.gas(v.radial(RIM_X, RIM_Y, 150, 110) ** 1.5, "cu", 1, 3, v.wy < HOR)
    for r, ry in ((180, 60), (230, 80)):
        L.shade(v.ring(RIM_X, RIM_Y, r, 1, ry) & (v.wy < 120), "cu", 2)
    return L


def rim_near(v):
    L = Layer(v)
    floor = v.wy >= HOR
    L.fill(floor, 0.15 + 0.2 * v.sample(RIM_FIELD), "wh", 0.9, 0, 2)
    L.shade(v.rect(0, HOR, WW, HOR + 1), "rn", 4)
    # the rim: a bright half-disc over the horizon, lit on its top edge
    disc = v.disc(RIM_X, RIM_Y, RIM_R) & (v.wy < HOR + 4)
    L.fill(disc, 0.2 + 0.6 * v.radial(RIM_X - 24, RIM_Y - 24, RIM_R * 1.2), "rn", 0.9, 1, 3)
    L.shade(v.disc(RIM_X - 20, RIM_Y - 22, 22) & disc, "rn", 4)
    # the last clamp, a dark bar across the rim
    L.shade(v.rect(RIM_X - RIM_R - 10, HOR - 8, RIM_X + RIM_R + 10, HOR - 6), "wh", 1)
    # racks on the floor, under the rim
    for x0, h in ((30, 46), (70, 34), (360, 40), (420, 54)):
        rack(L, v, x0, HOR - h, 24, h, "cu", 232)
    return L


FLARES = [(120, 70, -1, 0.5), (210, 60, -1, 0.8), (380, 74, 1, 0.6), (430, 62, 1, 0.3)]


def rim_fx(v, f):
    L = Layer(v)
    t = f / FRAMES
    for k, (x0, y0, side, ph) in enumerate(FLARES):
        u = (t + ph) % 1
        if u > 0.5:
            continue                     # a flare burns for half the loop, then dies back
        u = u * 2
        ln = 10 + 36 * math.sin(math.pi * u)
        x1 = RIM_X + side * (RIM_R + ln) * math.cos(0.3 + k * 0.25)
        y1 = RIM_Y - (RIM_R + ln) * math.sin(0.3 + k * 0.25) * 0.55
        pts = [(RIM_X + side * RIM_R * 0.9 * math.cos(0.3 + k * 0.25), RIM_Y - RIM_R * 0.9 * math.sin(0.3 + k * 0.25) * 0.55), (x1, y1)]
        L.shade(v.path(pts, 2), "rn", 4 if u < 0.6 else 3)
        L.shade(v.disc(x1, y1, 1.4), "wh", 4)
    # embers drifting off the rim
    for k in range(14):
        x = rnd(2311, k) * WW
        y = 110 + rnd(2311, k, 1) * 60 - ((f * 3 + k * 7) % 40)
        L.shade(v.px(x, y), "cu", 3 if (f + k) % 2 else 2)
    return L


# =====================================================================================================================
# 24 Spin: the plasma spun into a field. Pink gas and rings of charge around a wire coil, and sparks running the coil.
# =====================================================================================================================
SP_X, SP_Y = 240, 120


def spin_far(v):
    L = Layer(v)
    gas = v.radial(SP_X, SP_Y, 240, 160) ** 1.3
    L.gas(gas, "nb", 0, 3, v.wy < HOR)
    for r, ry in ((70, 26), (110, 42), (150, 60)):
        L.shade(v.ring(SP_X, SP_Y, r, 2, ry) & (v.wy < HOR), "ch", 2)
    return L


def spin_near(v):
    L = Layer(v)
    floor = v.wy >= HOR
    L.fill(floor, 0.2 + 0.25 * v.vgrad(HOR, WH), "nb", 0.9, 0, 2)
    L.shade(v.rect(0, HOR, WW, HOR + 1), "ch", 4)
    # the coil: two tilted rings of wire, front and back, around the core
    back = v.ring(SP_X, SP_Y, 90, 2, 28) & (v.wy < SP_Y + 6)
    front = v.ring(SP_X, SP_Y, 90, 2, 28) & (v.wy >= SP_Y + 6)
    L.shade(back, "wh", 2)
    L.shade(front, "wh", 4)
    core = v.disc(SP_X, SP_Y, 26)
    L.fill(core, 0.5 + 0.5 * v.radial(SP_X - 8, SP_Y - 8, 36), "nb", 0.9, 2, 4)
    L.shade(v.disc(SP_X - 8, SP_Y - 9, 6) & core, "wh", 4)
    for x0, h in ((26, 50), (60, 36), (380, 44), (424, 58)):
        rack(L, v, x0, HOR - h, 24, h, "nb", 241)
    return L


def spin_fx(v, f):
    L = Layer(v)
    # sparks running round the coil's front ring, one at a time
    for k in range(3):
        u = (f / FRAMES + k / 3) % 1
        a = u * TAU
        x = SP_X + math.cos(a) * 90
        y = SP_Y + math.sin(a) * 28
        if y >= SP_Y + 6:
            L.shade(v.disc(x, y, 2.2), "wh", 4)
            L.shade(v.disc(x, y, 4.2) & ~v.disc(x, y, 2.2), "nb", 4)
    # a rotating spoke of light through the core
    for k in range(4):
        a = (f / FRAMES) * TAU + k * math.pi / 4
        pts = [(SP_X + math.cos(a) * 14, SP_Y + math.sin(a) * 14 * 0.45), (SP_X + math.cos(a) * 70, SP_Y + math.sin(a) * 70 * 0.45)]
        L.shade(v.path(pts, 1), "ch", 4 if k % 2 == 0 else 3)
    return L


# =====================================================================================================================
# 25 Hold: the lattice hall. A grid of lit cells on the floor and a perspective grid on the back wall; a pulse walks the
# cells, and the cells it crosses light up for a moment.
# =====================================================================================================================
CELL = 24


def hold_far(v):
    L = Layer(v)
    wall = v.wy < HOR
    L.fill(wall, 0.12 + 0.1 * v.vgrad(60, HOR), "sg", 0.9, 0, 2)
    for x in range(0, WW + 1, CELL):
        L.shade(v.line(x, 60, x, HOR), "sg", 2)
    for y in range(60, HOR, 16):
        L.shade(v.rect(0, y, WW, y + 1), "sg", 1)
    return L


def hold_near(v):
    L = Layer(v)
    floor = v.wy >= HOR
    L.fill(floor, 0.1 + 0.1 * v.vgrad(HOR, WH), "si", 0.9, 0, 2)
    # the floor grid: cells that brighten toward the centre of the hall
    cx = (v.wx % WW) // CELL
    cy = (v.wy - HOR) // 12
    h = np.array([[rnd(2501, int(a), int(b)) for b in range(40)] for a in range(WW // CELL + 1)])
    base = h[(cx.astype(int)) % (WW // CELL + 1), np.clip(cy.astype(int), 0, 39)]
    edge = ((v.wx % CELL) < 2) | (((v.wy - HOR) % 12) < 1)
    L.fill(floor & ~edge, 0.2 + 0.3 * base, "si", 0.9, 0, 3)
    L.shade(floor & edge, "sg", 1)
    L.shade(v.rect(0, HOR, WW, HOR + 1), "sg", 4)
    # three racks standing in the grid, lit at the top
    for x0, h_ in ((40, 56), (210, 44), (400, 60)):
        rack(L, v, x0, HOR - h_, 24, h_, "sg", 251)
    return L


def hold_fx(v, f):
    L = Layer(v)
    # a pulse walks the floor left to right every loop; cells under it light up
    px = (f / FRAMES) * (WW + 60) - 30
    band = (np.abs(v.wx - px) < 12) & (v.wy >= HOR + 4)
    L.shade(band & ((v.wx // CELL + v.wy // 12) % 2 == 0), "sg", 4)
    L.shade(band & ((v.wx // CELL + v.wy // 12) % 2 == 1), "si", 4)
    # the wall grid answers with a line of light at the same x
    L.shade((np.abs(v.wx - px) < 2) & (v.wy < HOR) & (v.wy > 60), "sg", 4)
    return L


# =====================================================================================================================
# 26 Glow: the glow shelf. Stars and hills over a dark floor, and curtains of light that move across the sky.
# =====================================================================================================================
GLOW_HILLS = hills(262, 150, 14)


def glow_far(v):
    L = Layer(v)
    sky = v.wy < 190
    L.gas(v.radial(WW / 2, 60, 340, 200) ** 1.6, "ae", 0, 2, sky)
    starfield(L, 263, 140, 0, 120, ["sg", "ae"], 0.08)
    return L


def glow_near(v):
    L = Layer(v)
    ridge = v.wy >= GLOW_HILLS(v.wx % WW)
    L.fill(ridge, 0.15 + 0.2 * v.vgrad(150, WH), "vs", 0.9, 0, 2)
    floor = v.wy >= HOR + 6
    L.fill(floor, 0.1 + 0.25 * v.vgrad(HOR, WH), "ae", 0.9, 0, 2)
    L.shade(v.rect(0, HOR + 6, WW, HOR + 7), "ae", 4)
    # the curtains: soft vertical folds of light hanging from a high edge, dithered out at their sides
    for k in range(4):
        xc = 70 + k * 118
        for x in range(xc - 34, xc + 35):
            top = 96 + 6 * math.sin(x * 0.11 + k)
            bot = 150 + 14 * math.sin(x * 0.07 + k * 2)
            fold = 0.55 + 0.45 * math.sin(x * 0.9 + k)
            edge = 1 - abs(x - xc) / 34.0
            m = (np.floor(v.wx) == x) & (v.wy > top) & (v.wy < bot)
            L.fill(m, fold * edge, "ae", 0.9, 1, 4)
    return L


def glow_fx(v, f):
    L = Layer(v)
    t = f / FRAMES
    # a shimmer runs down each curtain: a brighter band that moves through the folds
    for k in range(4):
        x0 = 60 + k * 120
        u = (t + k / 4) % 1
        y = 96 + u * 70
        m = (np.abs(v.wx - (x0 + 14 * math.sin(TAU * t + k))) < 6) & (np.abs(v.wy - y) < 2)
        L.shade(m, "ae", 4)
    twinkles(L, f, 264, 16, 10, 80, ["sg", "vs"], 3)
    return L


# ---------------------------------------------------------------------------------------------------------------------
# era table, merged into the arc kit's so its build() handles the files
# ---------------------------------------------------------------------------------------------------------------------
UNDERSUN = {
    23: ("rim", rim_far, rim_near, rim_fx, (260, 140, 1.9)),
    24: ("spin", spin_far, spin_near, spin_fx, (240, 130, 2.0)),
    25: ("hold", hold_far, hold_near, hold_fx, (240, 150, 2.0)),
    26: ("glow", glow_far, glow_near, glow_fx, (240, 120, 1.9)),
}
K.ERAS.update(UNDERSUN)

if __name__ == "__main__":
    want = [int(a) for a in sys.argv[1:]] or list(UNDERSUN)
    K.OUT.mkdir(parents=True, exist_ok=True)
    for n in want:
        K.build(n)
