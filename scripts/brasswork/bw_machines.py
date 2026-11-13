"""Brasswork machine icons for the build palette, in the same camera and light as the items. Machines share one
material language: steel plinth, copper body (look spec 0xc4682f), brass trim, glowing windows where there is heat."""
import math

import numpy as np

from bw_items import FIT, done, gear_outline, new  # noqa: F401
from icon3d import Scene  # noqa: F401
from nodefarm_icon_kit import P, X, Y, disc, line, lin, path, poly

DRAW = {}  # machines; STRUCT below holds hub and orrery


def machine(fn):
    DRAW[fn.__name__] = fn
    return fn


def plinth(sc, w, d, h=3):
    sc.box(-w, w, 0, h, -d, d, "steel", 0.05)


def window(c, sc, pts3, lit=True):
    m = poly([sc.pt(q) for q in pts3])
    if lit:
        c.glow(m, P["glow"][3], 3, 120, 2)
        c.fill(m, 0.95 - 0.5 * lin(0, 20, 0, 50), "glow")
    else:
        c.fill(m, 0.3, "coal")
    return m


@machine
def drill(p=0):
    """Node drill: a brass derrick over a copper gearbox, the bit biting into an ore rock."""
    c, sc = new(cy=50, s=1.15, sh=(32, 56, 24, 3.2))
    sc.rock((0, 1, 0), 13, "rock", 61, squash=0.3)
    plinth(sc, 11, 11, 4)
    sc.box(-6, 6, 4, 12, -6, 6, "cu", 0.0)
    sc.cylinder((0, 12, 0), (0, 2, 0), 2.4, "iron", 0.1, n=10, r2=0.6)
    for x, z in [(-9, -9), (9, -9), (-9, 9), (9, 9)]:
        sc.cylinder((x, 4, z), (0, 34, 0), 1.0, "brass", 0.0, n=6)
    sc.extrude(gear_outline(6, 4.6, 9), 2, "brass", 0.05, frame=((0, 20, 0), (1, 0, 0), (0, 0, -1), (0, 1, 0)))
    sc.cylinder((0, 30, 0), (0, 35, 0), 2.5, "brass", 0.1, n=10)
    sc.paint(c)
    return done(c)


@machine
def kiln(p=0):
    """Kiln: a brick dome with a glowing mouth and a short flue."""
    c, sc = new(cy=50, s=1.15, sh=(32, 56, 24, 3.2))
    plinth(sc, 13, 13)
    sc.cylinder((0, 3, 0), (0, 10, 0), 12, "brick", 0.0, n=20)
    rings = [(12 * math.cos(math.pi / 2 * k / 5), 10 + 12 * math.sin(math.pi / 2 * k / 5)) for k in range(6)]
    for (r0, y0), (r1, y1) in zip(rings, rings[1:]):
        sc.cylinder((0, y0, 0), (0, y1, 0), max(r0, 0.5), "brick", 0.0, n=20, r2=max(r1, 0.5), caps=False)
    sc.cylinder((5, 16, -5), (5, 26, -5), 2.4, "steel", 0.1, n=10)
    sc.cylinder((5, 26, -5), (5, 27.5, -5), 3.2, "brass", 0.1, n=10)
    sc.paint(c)
    body = c.img[..., 3] == 255
    c.fill(body & ((Y.astype(int) % 4) == 0) & (Y > 18) & (Y < 46), 0.25, "brick")
    window(c, sc, [(-6, 4, 11.5), (2, 4, 11.5), (2, 10, 11.5), (-2, 12, 11.5), (-6, 10, 11.5)])
    return done(c)


@machine
def furnace(p=0):
    """Furnace: a tall copper-clad block with a coal hopper, a firebox window and a tall stack."""
    c, sc = new(cy=50, s=1.05, sh=(32, 56, 25, 3.2))
    plinth(sc, 12, 16)
    sc.box(-10, 10, 3, 22, -14, 14, "cu", 0.0)
    sc.box(-11, 11, 21, 23, -15, 15, "brass", 0.05)
    sc.frustum(5, 5, 7, 7, 5, "steel", 0.05, y=23)
    sc.cylinder((4, 23, -9), (4, 44, -9), 2.6, "steel", 0.0, n=10)
    sc.cylinder((4, 44, -9), (4, 46, -9), 3.6, "brass", 0.1, n=10)
    sc.paint(c)
    window(c, sc, [(-7, 6, 14.1), (7, 6, 14.1), (7, 13, 14.1), (-7, 13, 14.1)])
    for x in (-5, 0, 5):
        q0, q1 = sc.pt((x, 6, 14.2)), sc.pt((x, 13, 14.2))
        c.set(line(*q0, *q1, 1.0), P["steel"][1])
    return done(c)


@machine
def press(p=0):
    """Stamp press: two steel columns, a brass crosshead and a heavy ram over an anvil with a plate on it."""
    c, sc = new(cy=52, s=1.05, sh=(32, 57, 25, 3.2))
    plinth(sc, 14, 11)
    sc.box(-8, 8, 3, 8, -7, 7, "steel", 0.15)
    sc.box(-7, 7, 8, 9, -6, 6, "iron", 0.15)
    for x in (-12, 12):
        sc.box(x - 2.5, x + 2.5, 3, 38, -3, 3, "cu", 0.0)
    sc.box(-15, 15, 36, 42, -5, 5, "brass", 0.0)
    sc.box(-6, 6, 18, 36, -5, 5, "steel", 0.0)
    sc.box(-8, 8, 15, 18, -7, 7, "brass", -0.05)
    sc.paint(c)
    return done(c)


@machine
def lathe(p=0):
    """Lathe: a long bed, a headstock with a turning chuck and a rod in the jaws."""
    c, sc = new(cy=46, s=1.05, sh=(32, 54, 26, 3.2))
    sc.box(-20, 20, 0, 4, -6, 6, "steel", 0.05)
    sc.box(-18, 18, 4, 8, -4, 4, "iron", 0.0)
    sc.box(-20, -9, 8, 22, -7, 7, "cu", 0.0)
    sc.cylinder((-9, 15, 0), (-5, 15, 0), 5.5, "brass", 0.05, n=16)
    sc.cylinder((-5, 15, 0), (14, 15, 0), 1.8, "iron", 0.2, n=10)
    sc.box(12, 18, 8, 19, -4, 4, "cu", -0.05)
    sc.paint(c)
    q = sc.pt((-3, 15, 2))
    c.spark(q[0] + 4, q[1] + 1, 1, P["glow"][5])
    return done(c)


@machine
def drawer(p=0):
    """Wire drawer: a die block on a bench pulling copper wire onto a turning brass drum."""
    c, sc = new(cy=48, s=1.05, sh=(32, 55, 26, 3.2))
    sc.box(-20, 20, 0, 5, -8, 8, "steel", 0.05)
    sc.box(-18, -8, 5, 15, -6, 6, "cu", 0.0)
    sc.cylinder((8, 14, -8), (8, 14, 8), 9, "brass", 0.0, n=20)
    sc.cylinder((8, 14, -6), (8, 14, 6), 7.5, "cu", 0.05, n=20, caps=False)
    sc.paint(c)
    a, b = sc.pt((-8, 11, 0)), sc.pt((2, 18, 0))
    c.fill(line(*a, *b, 1.4), 0.8, "cu")
    die = sc.pt((-12, 15.2, 0))
    c.set(disc(*die, 1.6, 1.0), P["brass"][5])
    return done(c)


@machine
def assembler(p=0):
    """Assembler: a wide brass-trimmed bench with two jointed arms over a part, and a gauge."""
    c, sc = new(cy=50, s=1.0, sh=(32, 56, 27, 3.4))
    plinth(sc, 17, 15)
    sc.box(-15, 15, 3, 12, -13, 13, "cu", 0.0)
    sc.box(-16, 16, 12, 14, -14, 14, "brass", 0.05)
    sc.box(-5, 5, 14, 17, -4, 4, "al", 0.05)
    for sx in (-1, 1):
        base = (sx * 12, 14, -8)
        sc.cylinder(base, (sx * 12, 18, -8), 2.6, "steel", 0.05, n=10)
        elbow = (sx * 11, 30, -3)
        sc.cylinder((sx * 12, 18, -8), elbow, 1.5, "brass", 0.0, n=8)
        hand = (sx * 4, 22, 0)
        sc.cylinder(elbow, hand, 1.3, "brass", 0.05, n=8)
        sc.cylinder(hand, (sx * 4, 18.5, 0), 0.7, "iron", 0.1, n=6)
    sc.paint(c)
    g = sc.pt((-10, 8, 13.1))
    c.fill(disc(*g, 3, 2.6), 0.8, "cream", outline="brass")
    c.set(line(g[0], g[1], g[0] + 2, g[1] - 1.5, 0.9), P["brick"][2])
    for x in (2, 6, 10):
        q = sc.pt((x, 8, 13.1))
        c.set(disc(*q, 0.8), P["glow"][4] if x != 10 else P["patina"][4])
    return done(c)


@machine
def fabricator(p=0):
    """Fabricator: a big brass dome on a copper drum, a ring of glowing ports and a crown gear."""
    c, sc = new(cy=52, s=0.95, sh=(32, 57, 27, 3.4))
    plinth(sc, 20, 20, 4)
    sc.cylinder((0, 4, 0), (0, 16, 0), 18, "cu", 0.0, n=26)
    sc.cylinder((0, 16, 0), (0, 18, 0), 19, "brass", 0.05, n=26)
    rings = [(17 * math.cos(math.pi / 2 * k / 6), 18 + 15 * math.sin(math.pi / 2 * k / 6)) for k in range(7)]
    for (r0, y0), (r1, y1) in zip(rings, rings[1:]):
        sc.cylinder((0, y0, 0), (0, y1, 0), max(r0, 0.5), "brass", 0.0, n=26, r2=max(r1, 0.5), caps=False)
    sc.extrude(gear_outline(7, 5.4, 10), 2.4, "brass", 0.1, frame=((0, 32, 0), (1, 0, 0), (0, 0, -1), (0, 1, 0)))
    sc.cylinder((0, 34, 0), (0, 38, 0), 2.0, "steel", 0.1, n=10)
    sc.paint(c)
    for k in range(5):
        a = math.pi * (0.15 + 0.7 * k / 4)
        q = sc.pt((18.2 * math.cos(a) * 0.98, 10, 18.2 * math.sin(a)))
        m = disc(*q, 1.9, 2.4)
        c.glow(m, P["glow"][3], 2, 110, 1)
        c.fill(m, 0.9, "glow")
    tip = sc.pt((0, 38.5, 0))
    c.spark(*tip, 2, P["glow"][5], core=[255, 255, 255])
    return done(c)


@machine
def windmill(p=0):
    """Windmill: a timber-and-copper tower on a steel plinth, four canvas sails on a brass hub."""
    c, sc = new(cy=54, s=0.95, sh=(32, 58, 22, 3.2))
    plinth(sc, 12, 12)
    sc.frustum(9, 9, 5.5, 5.5, 30, "wood", 0.0, y=3)
    sc.frustum(6.5, 6.5, 3, 3, 6, "cu", 0.0, y=33)
    sc.cylinder((0, 34, 4), (0, 34, 9), 1.6, "iron", 0.1, n=8)
    sc.paint(c)
    hx, hy = sc.pt((0, 34, 9))
    k = FIT["k"] * 0.95
    for i in range(4):
        a = math.pi / 4 + math.pi / 2 * i
        dx, dy = math.cos(a), math.sin(a)
        nx, ny = -dy, dx
        p0 = (hx + dx * 3 * k, hy + dy * 3 * k)
        p1 = (hx + dx * 24 * k, hy + dy * 24 * k)
        sail = poly([(p0[0] + nx * 1 * k, p0[1] + ny * 1 * k), (p1[0] + nx * 1 * k, p1[1] + ny * 1 * k),
                     (p1[0] + nx * 6 * k, p1[1] + ny * 6 * k), (p0[0] + nx * 4 * k + dx * 4 * k, p0[1] + ny * 4 * k + dy * 4 * k)])
        c.fill(sail, 0.75 - 0.2 * i % 2 * 0.5, "cream")
        c.fill(sail & (((X * dx + Y * dy) / (3 * k)).astype(int) % 2 == 0), 0.5, "cream")
        c.fill(line(*p0, *p1, 1.4 * k), 0.4, "wood")
    c.fill(disc(hx, hy, 2.6 * k), 0.85, "brass", outline="brass")
    window(c, sc, [(-2, 18, 7.1), (2, 18, 7.1), (2, 23, 6.6), (-2, 23, 6.6)])
    return done(c)


@machine
def spring_winder(p=0):
    """Spring winder: a steel cradle holding a big wound brass mainspring, a crank and a copper drive gear."""
    c, sc = new(cy=52, s=1.0, sh=(32, 57, 25, 3.2))
    plinth(sc, 15, 13)
    sc.box(-14, 14, 3, 7, -11, 11, "cu", 0.0)
    for x in (-12, 12):
        sc.box(x - 1.5, x + 1.5, 7, 27, -2, 2, "steel", 0.05)
    sc.cylinder((-10.5, 20, 0), (10.5, 20, 0), 1.6, "iron", 0.1, n=10)
    sc.cylinder((-6, 20, 0), (6, 20, 0), 11, "steel", -0.15, n=26)
    sc.extrude(gear_outline(6.5, 5, 10), 2.2, "cu", 0.05, frame=((13.5, 20, 0), (0, 0, 1), (0, 1, 0), (1, 0, 0)))
    sc.paint(c)
    # the spiral mainspring on the near face of the drum
    k = FIT["k"]
    cx, cy = sc.pt((-6.1, 20, 0))
    pts = [(cx + math.cos(t) * (1 + t * 0.62) * k * 0.55, cy + math.sin(t) * (1 + t * 0.62) * k)
           for t in np.linspace(0, 5.6 * math.pi, 220)]
    c.fill(path(pts, 1.3 * k), 0.85, "brass")
    q = sc.pt((-14, 26, 0))
    c.fill(line(cx, cy, *q, 1.6 * k), 0.6, "iron")
    c.fill(disc(*q, 2 * k), 0.85, "brass", outline="brass")
    return done(c)


@machine
def spring_store(p=0):
    """Spring store: a squat brass drum banded in steel, the coiled mainspring showing through a window, a charge gauge."""
    c, sc = new(cy=52, s=1.0, sh=(32, 57, 24, 3.2))
    plinth(sc, 14, 14)
    sc.cylinder((0, 3, 0), (0, 22, 0), 12, "brass", -0.05, n=24)
    for y in (6, 18):
        sc.cylinder((0, y, 0), (0, y + 2, 0), 12.6, "gun", 0.05, n=24)
    sc.cylinder((0, 22, 0), (0, 25, 0), 9, "gun", 0.1, n=20)
    sc.cylinder((0, 25, 0), (0, 29, 0), 2.2, "iron", 0.1, n=10)
    sc.paint(c)
    k = FIT["k"]
    win = poly([sc.pt((x, y, 12.3)) for x, y in [(-5, 9), (5, 9), (5, 17), (-5, 17)]])
    c.fill(win, 0.15, "coal")
    ys, xs = np.nonzero(win)
    cx, cy = xs.mean(), ys.mean()
    pts = [(cx + math.cos(t) * (0.6 + t * 0.4) * k, cy + math.sin(t) * (0.6 + t * 0.4) * k * 0.8)
           for t in np.linspace(0, 4.4 * math.pi, 160)]
    c.fill(path(pts, 1.1 * k) & win, 0.9, "brass")
    g = sc.pt((9, 13, 8.6))
    c.fill(disc(*g, 2.6 * k), 0.8, "cream", outline="brass")
    c.set(line(g[0], g[1], g[0] + 1.6 * k, g[1] - 1.6 * k, 0.9), P["patina"][2])
    return done(c)


STRUCT = {}


def structure(fn):
    STRUCT[fn.__name__] = fn
    return fn


@structure
def hub(p=0):
    """Hub: the workshop core, a brick-and-copper hall with a brass clock gable and a lit door."""
    c, sc = new(cy=52, s=0.95, sh=(32, 57, 26, 3.4))
    plinth(sc, 17, 15)
    sc.box(-15, 15, 3, 20, -12, 12, "brick", 0.0)
    roof_b = [(-16, 20, 13), (16, 20, 13), (16, 20, -13), (-16, 20, -13)]
    roof_t = [(-16, 30, 0.5), (16, 30, 0.5), (16, 30, -0.5), (-16, 30, -0.5)]
    sc.prism(roof_b, roof_t, "cu", 0.0)
    sc.cylinder((0, 22, 13.2), (0, 22, 14.4), 4.5, "brass", 0.05, n=18)
    sc.paint(c)
    window(c, sc, [(-4, 3, 12.1), (4, 3, 12.1), (4, 13, 12.1), (-4, 13, 12.1)])
    k = FIT["k"]
    q = sc.pt((0, 22, 14.5))
    c.fill(disc(*q, 3.2 * k * 0.95), 0.85, "cream")
    c.set(line(q[0], q[1], q[0], q[1] - 2.4 * k, 0.9), P["steel"][1])
    c.set(line(q[0], q[1], q[0] + 1.8 * k, q[1], 0.9), P["steel"][1])
    for x in (-11, 11):
        window(c, sc, [(x - 2, 9, 12.1), (x + 2, 9, 12.1), (x + 2, 14, 12.1), (x - 2, 14, 12.1)])
    return done(c)


@structure
def orrery(p=0):
    """Sky orrery: brass armillary rings round a glowing sun on a stepped pedestal, a small planet on one ring."""
    c, sc = new(cy=52, s=0.95, sh=(32, 57, 22, 3.2))
    sc.cylinder((0, 0, 0), (0, 4, 0), 13, "gun", 0.05, n=24)
    sc.cylinder((0, 4, 0), (0, 8, 0), 8, "brass", -0.05, n=20)
    sc.cylinder((0, 8, 0), (0, 16, 0), 2, "brass", 0.0, n=10)
    sc.paint(c)
    k = FIT["k"] * 0.95
    cx, cy = sc.pt((0, 30, 0))
    sun = disc(cx, cy, 6.5 * k)
    c.glow(sun, P["glow"][3], 4, 130, 2)
    c.fill(sun, 1.05 - np.hypot(X - cx + 2, Y - cy + 2) / (9 * k), "glow")
    from nodefarm_icon_kit import tilted_ring
    for rx, ry, tilt, v in [(19, 6, -18, 0.8), (16, 9, 35, 0.65), (13, 13, 0, 0.5)]:
        m, front = tilted_ring(cx, cy, rx * k, ry * k, tilt, 1.8 * k)
        c.fill(m & ~(front) & ~sun, v - 0.25, "brass")
        c.fill(m & front, v, "brass")
    px, py = cx + 18 * k * math.cos(0.5), cy + 6 * k * math.sin(0.5)
    c.fill(disc(px, py, 2.6 * k), 0.7, "patina", outline="patina")
    return done(c)
