"""Brasswork logistics icons: belts, splitter, merger, tunnels, loaders and storage, each belt piece in three tiers.

Tiers share one drawing and change the trim: brass (stage 2), copper (stage 3), steel (stage 4), so the build palette
reads the tier at a glance. Same camera, light and dither as the item icons."""
import math

import numpy as np

from bw_items import FIT, done, new
from bw_machines import plinth
from nodefarm_icon_kit import P, X, Y, disc, poly

TRIM = {"brass": "brass", "copper": "cu", "steel": "gun"}
TRIM_PAL = {v: v for v in TRIM.values()}
BELT = ["#0e0a06", "#1c140c", "#2c2014", "#3e2e1e", "#54402a"]  # look spec belt 0x1c140c
LOG = {}


def _hex(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


BELT_RAMP = [_hex(h) for h in BELT]


def belt_bed(sc, x0, x1, z0, z1, trim, y=0.0, h=3.0):
    """A belt run along x from x0 to x1: dark bed, slats and trim-coloured side rails."""
    sc.box(x0, x1, y, y + h, z0 + 1.5, z1 - 1.5, BELT_RAMP, 0.0)
    sc.box(x0, x1, y, y + h + 1.2, z0, z0 + 1.5, trim, 0.0)
    sc.box(x0, x1, y, y + h + 1.2, z1 - 1.5, z1, trim, 0.0)


def slats(c, sc, x0, x1, z0, z1, y, step=3.0):
    for x in np.arange(x0 + 1.5, x1, step):
        a, b = sc.pt((x, y + 0.05, z0 + 1.7)), sc.pt((x, y + 0.05, z1 - 1.7))
        from nodefarm_icon_kit import line
        c.set(line(*a, *b, 1.0), BELT_RAMP[3])


def arrow(c, sc, at, d, y, size=4.0, col=None):
    """Flat cream arrow lying on the surface at height y, pointing along direction d = (dx, dz)."""
    x, z = at
    dx, dz = d
    nx, nz = -dz, dx
    s = size
    pts = [(x + dx * s, z + dz * s), (x + nx * s * 0.8, z + nz * s * 0.8), (x + nx * s * 0.3, z + nz * s * 0.3),
           (x - dx * s, z - dz * s), (x - nx * s * 0.3 - dx * s, z - nz * s * 0.3 - dz * s) if False else
           (x - nx * s * 0.3 - dx * s, z - nz * s * 0.3 - dz * s), (x - nx * s * 0.3, z - nz * s * 0.3),
           (x - nx * s * 0.8, z - nz * s * 0.8)]
    pts = [(x + dx * s, z + dz * s), (x + nx * s * 0.8, z + nz * s * 0.8), (x + nx * s * 0.3, z + nz * s * 0.3),
           (x + nx * s * 0.3 - dx * s, z + nz * s * 0.3 - dz * s), (x - nx * s * 0.3 - dx * s, z - nz * s * 0.3 - dz * s),
           (x - nx * s * 0.3, z - nz * s * 0.3), (x - nx * s * 0.8, z - nz * s * 0.8)]
    m = poly([sc.pt((px, y + 0.1, pz)) for px, pz in pts])
    c.fill(m, 0.85, col or "cream")
    return m


def logi(name):
    def wrap(fn):
        for tier in ("brass", "copper", "steel"):
            key = name if tier == "brass" else f"{name}-{tier}"
            LOG[key] = (lambda t: (lambda p=0: fn(TRIM[t])))(tier)
        return fn
    return wrap


@logi("belt")
def belt(trim):
    """A straight belt run with slats and a direction arrow."""
    c, sc = new(cy=44, s=1.25, sh=(32, 50, 25, 3.2))
    belt_bed(sc, -16, 16, -7, 7, trim)
    sc.paint(c)
    slats(c, sc, -16, 16, -7, 7, 3.0)
    arrow(c, sc, (2, 0), (1, 0), 3.0, 4.0)
    return done(c)


def junction_box(sc, trim):
    plinth(sc, 12, 12, 2)
    sc.box(-10, 10, 2, 8, -10, 10, BELT_RAMP, 0.0)
    for sx in (-1, 1):
        for sz in (-1, 1):
            sc.box(sx * 10 - (1.5 if sx > 0 else 0), sx * 10 + (1.5 if sx < 0 else 0), 2, 10,
                   sz * 10 - (1.5 if sz > 0 else 0), sz * 10 + (1.5 if sz < 0 else 0), trim, 0.05)


def flow(c, sc, y, lanes, heads, pal="glow", w=2.2):
    """Glowing lanes on a junction top: polylines in (x, z), arrowheads at the given (x, z, dx, dz)."""
    from nodefarm_icon_kit import path
    k = FIT["k"]
    for lane in lanes:
        c.fill(path([sc.pt((x, y + 0.1, z)) for x, z in lane], w * k), 0.8, pal)
    for x, z, dx, dz in heads:
        nx, nz = -dz, dx
        tri = [(x + dx * 3.2, z + dz * 3.2), (x + nx * 3, z + nz * 3), (x - nx * 3, z - nz * 3)]
        c.fill(poly([sc.pt((px, y + 0.1, pz)) for px, pz in tri]), 0.9, pal)


@logi("belt-splitter")
def splitter(trim):
    """Junction: one lane in from the back, splitting to the front and both sides."""
    c, sc = new(cy=46, s=1.2, sh=(32, 53, 24, 3.2))
    junction_box(sc, trim)
    sc.paint(c)
    flow(c, sc, 8.0, [[(0, -9), (0, 0)]], [], "patina", 2.0)
    flow(c, sc, 8.0, [[(0, 0), (0, 5)], [(0, 0), (5, 0)], [(0, 0), (-5, 0)]], [(0, 5, 0, 1), (5, 0, 1, 0), (-5, 0, -1, 0)], "ember")
    return done(c)


@logi("belt-merger")
def merger(trim):
    """Junction: lanes in from both sides and the back, joining into one out the front."""
    c, sc = new(cy=46, s=1.2, sh=(32, 53, 24, 3.2))
    junction_box(sc, trim)
    sc.paint(c)
    flow(c, sc, 8.0, [[(-9, 0), (0, 0)], [(9, 0), (0, 0)], [(0, -9), (0, 0)]], [], "patina", 2.0)
    flow(c, sc, 8.0, [[(0, 0), (0, 5)]], [(0, 5, 0, 1)], "ember", 2.6)
    return done(c)


def tunnel(trim, entering):
    c, sc = new(cy=46, s=1.15, sh=(32, 53, 25, 3.2))
    belt_bed(sc, -16, 2, -7, 7, trim)
    # hooded mouth: an arch of trim over a dark opening
    sc.box(2, 14, 0, 12, -8, 8, trim, -0.05)
    sc.box(14, 16, 0, 13, -9, 9, trim, 0.1)
    sc.paint(c)
    slats(c, sc, -16, 2, -7, 7, 3.0)
    mouth = poly([sc.pt((2 - 0.05, y, z)) for y, z in [(3, -5.5), (3, 5.5), (8.5, 5.5), (10, 0), (8.5, -5.5)]])
    c.fill(mouth, 0.05, "coal")
    arrow(c, sc, (-6, 0), (1, 0) if entering else (-1, 0), 3.0, 4.0)
    q = sc.pt((8, 12.1, 0))
    k = FIT["k"]
    # chevron on the hood: down for an entrance, up for an exit
    d = 1 if entering else -1
    from nodefarm_icon_kit import path
    c.fill(path([(q[0] - 3 * k, q[1] - 1.5 * k * d), (q[0], q[1] + 1.5 * k * d), (q[0] + 3 * k, q[1] - 1.5 * k * d)], 1.6 * k),
           0.85, "cream")
    return done(c)


@logi("belt-underground-in")
def tunnel_in(trim):
    return tunnel(trim, True)


@logi("belt-underground-out")
def tunnel_out(trim):
    return tunnel(trim, False)


def loader_piece(trim, loading):
    c, sc = new(cy=48, s=1.15, sh=(32, 54, 25, 3.2))
    belt_bed(sc, -16, 0, -7, 7, trim)
    sc.box(0, 14, 0, 14, -9, 9, "wood", 0.0)
    sc.box(-1, 15, 13, 15, -10, 10, trim, 0.05)
    sc.box(-2, 2, 3, 9, -6, 6, trim, -0.05)
    sc.paint(c)
    slats(c, sc, -16, 0, -7, 7, 3.0)
    arrow(c, sc, (-8, 0), (1, 0) if loading else (-1, 0), 3.0, 4.0, "glow" if loading else "patina")
    return done(c)


@logi("belt-loader")
def loader(trim):
    return loader_piece(trim, True)


@logi("belt-unloader")
def unloader(trim):
    return loader_piece(trim, False)


@logi("belt-crate")
def crate(trim):
    """Timber crate with plank lines and two iron bands (single tier)."""
    c, sc = new(cy=48, s=1.2, sh=(32, 54, 22, 3.2))
    sc.box(-11, 11, 0, 18, -11, 11, "wood", 0.05)
    sc.paint(c)
    from nodefarm_icon_kit import line
    for y in (3, 15):
        for a, b in [((-11, y, 11.05), (11, y, 11.05)), ((11.05, y, 11), (11.05, y, -11))]:
            c.fill(line(*sc.pt(a), *sc.pt(b), 2.4 * FIT["k"]), 0.55, "iron")
    for y in (6.5, 11):
        for a, b in [((-11, y, 11.05), (11, y, 11.05)), ((11.05, y, 11), (11.05, y, -11))]:
            c.set(line(*sc.pt(a), *sc.pt(b), 0.9), P["wood"][1])
    for x in (-3.7, 3.7):
        c.set(line(*sc.pt((x, 18.05, -11)), *sc.pt((x, 18.05, 11)), 0.9), P["wood"][2])
    return done(c)


@logi("belt-strongbox")
def strongbox(trim):
    """Aluminium strongbox with riveted brass corners and a lock."""
    c, sc = new(cy=50, s=1.05, sh=(32, 56, 25, 3.2))
    sc.box(-15, 15, 0, 18, -13, 13, "al", -0.05)
    sc.box(-15.5, 15.5, 18, 20, -13.5, 13.5, "brass", 0.05)
    for sx in (-1, 1):
        sc.box(sx * 15 - 1, sx * 15 + 1, 0, 18, 12, 14, "brass", 0.0)
    sc.paint(c)
    q = sc.pt((0, 10, 13.1))
    k = FIT["k"]
    c.fill(disc(*q, 3 * k), 0.8, "brass", outline="brass")
    c.set(disc(q[0], q[1] - 0.4 * k, 0.9 * k), P["brass"][0])
    return done(c)


@logi("belt-dock")
def dock(trim):
    """Dock: a timber platform with a brass crane arm and a waiting crate."""
    c, sc = new(cy=50, s=1.0, sh=(32, 56, 27, 3.4))
    plinth(sc, 18, 18, 3)
    sc.box(-17, 17, 3, 6, -17, 17, "wood", 0.05)
    sc.box(-14, -6, 6, 14, -4, 4, "wood", -0.1)
    sc.cylinder((9, 6, -9), (9, 34, -9), 1.8, "brass", 0.0, n=8)
    sc.cylinder((9, 33, -9), (-4, 30, 3), 1.4, "brass", 0.1, n=8)
    sc.cylinder((-4, 30, 3), (-4, 18, 3), 0.5, "steel", 0.1, n=6)
    sc.box(-7, -1, 12, 18, 0, 6, "wood", 0.1)
    sc.paint(c)
    arrow(c, sc, (8, 9), (0, 1), 6.0, 3.4, "glow")
    return done(c)


# crate, strongbox and dock have one tier: drop the generated tier variants
for _k in [k for k in LOG if k.startswith(("belt-crate-", "belt-strongbox-", "belt-dock-"))]:
    del LOG[_k]
