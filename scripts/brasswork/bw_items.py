"""Brasswork item and machine icons, one draw function per id. Each returns a finished kit Canvas (64 x 64)."""
import math

import numpy as np

import bw_palette  # noqa: F401  (registers the ramps)
from icon3d import Scene
from nodefarm_icon_kit import Canvas, P, X, Y, disc, line, path, poly, rect

DRAW = {}


def item(fn):
    DRAW[fn.__name__.lstrip("_")] = fn
    return fn


def shadow(c, cx=32, cy=54, w=20, h=3.4):
    c.set(disc(cx, cy, w, h), P["ink"][0], 120)
    c.set(disc(cx, cy, w * 0.72, h * 0.7), P["ink"][0], 190)


# Auto-fit: every icon is drawn once, measured, then redrawn scaled about the cell centre so it fills about the same
# box. new() and scene() read FIT, so each drawing is written once at a nominal scale.
FIT = {"k": 1.0, "dx": 0.0, "dy": 0.0}
TARGET = 54  # px the larger side of the drawing should span (shadow included)


def _fx(x):
    return 32 + (x - 32) * FIT["k"] + FIT["dx"]


def _fy(y):
    return 32 + (y - 32) * FIT["k"] + FIT["dy"]


def scene(cy=44, s=1.3):
    return Scene(cx=_fx(32), cy=_fy(cy), s=s * FIT["k"])


def new(cy=44, s=1.3, sh=(32, 53, 22, 3.6)):
    c = Canvas()
    if sh:
        x, y, w, h = sh
        shadow(c, _fx(x), _fy(y), w * FIT["k"], h * FIT["k"])
    return c, scene(cy, s)


def diag(mask, off=0.0, w=1.0, slope=1.0):
    """A diagonal glint stripe across mask, placed relative to the mask's centre so it survives auto-fit."""
    ys, xs = np.nonzero(mask)
    if not len(xs):
        return mask
    cx, cy = xs.mean(), ys.mean()
    return mask & (np.abs((X - cx) - slope * (Y - cy) - off * FIT["k"]) < w * FIT["k"])


def fitted(fn):
    """Draw fn, measure its opaque box, and redraw it scaled and centred."""
    FIT.update(k=1.0, dx=0.0, dy=0.0)
    a = fn().img[..., 3] > 0
    ys, xs = np.nonzero(a)
    w, h = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
    k = max(1.0, min(TARGET / w, TARGET / h, 1.75))
    bx, by = (xs.max() + xs.min() + 1) / 2, (ys.max() + ys.min() + 1) / 2
    FIT.update(k=k, dx=-(bx - 32) * k, dy=-(by - 32) * k + 1)
    out = fn()
    FIT.update(k=1.0, dx=0.0, dy=0.0)
    return out


def done(c):
    return c.finish(P["steel"][0])


def speckle(c, mask, n, seed, pal, v, r=1.4):
    """Scatter n small blobs over mask (seeded), shade v in palette pal."""
    rng = np.random.default_rng(seed)
    ys, xs = np.nonzero(mask)
    if not len(xs):
        return
    for k in rng.choice(len(xs), size=min(n, len(xs)), replace=False):
        c.fill(disc(xs[k] + 0.5, ys[k] + 0.5, r) & mask, v, pal)


def veins(mask, a, b, f=0.5, w=0.16):
    """Wavy diagonal bands across mask."""
    t = np.sin(X * a + Y * b + np.sin(Y * 0.5 + X * 0.2) * 1.6)
    return mask & (np.abs(t - f) < w)


# ------------------------------------------------------------------ raw resources
def ore_pile(sc, pal, seeds, squash=0.72, jitter=0.22):
    rocks = [((-9, 6, -6), 10), ((9, 5, -4), 9), ((0, 6, 7), 10.5)]
    for k, ((pos, r), sd) in enumerate(zip(rocks, seeds)):
        sc.rock(pos, r, pal, sd, squash=squash, jitter=jitter, tag=f"r{k}")


@item
def iron_ore(p=0):
    c, sc = new()
    ore_pile(sc, "rock", (3, 11, 7))
    sc.paint(c)
    body = c.img[..., 3] == 255
    c.fill(veins(body, 0.32, 0.55), 0.5, "rust")
    speckle(c, body, 9, 1, "rust", 0.8, 1.5)
    return done(c)


@item
def copper_ore(p=0):
    c, sc = new()
    ore_pile(sc, "rock", (5, 13, 21))
    sc.paint(c)
    body = c.img[..., 3] == 255
    c.fill(veins(body, -0.3, 0.6, 0.2, 0.22), 0.62, "patina")
    speckle(c, body, 6, 4, "cu", 0.85, 2.0)
    speckle(c, body, 5, 5, "cu", 0.6, 1.2)
    return done(c)


@item
def coal(p=0):
    c, sc = new()
    sc.rock((-8, 5, -5), 9, "coal", 31, squash=0.8, jitter=0.3)
    sc.rock((9, 5, -3), 8, "coal", 32, squash=0.8, jitter=0.3)
    sc.rock((0, 6, 7), 10, "coal", 33, squash=0.85, jitter=0.3)
    sc.rock((2, 14, -1), 6, "coal", 34, squash=0.9, jitter=0.3)
    sc.paint(c, dither=1.0)
    rng = np.random.default_rng(9)
    ys, xs = np.nonzero(c.alpha & (Y < 44))
    for k in rng.choice(len(xs), 5, replace=False):
        c.spark(xs[k], ys[k], 0, P["coal"][7])
    return done(c)


def crystal(sc, base, h, r, tilt, pal, v=0.0, n=6):
    """Hexagonal crystal point: a prism with a pyramid tip, tilted by (ax, az) radians."""
    ax, az = tilt

    def tf(q):
        x, y, z = q
        y1, z1 = y * math.cos(ax) - z * math.sin(ax), y * math.sin(ax) + z * math.cos(ax)
        x2, y2 = x * math.cos(az) - y1 * math.sin(az), x * math.sin(az) + y1 * math.cos(az)
        return np.array([x2, y2, z1]) + np.asarray(base, float)
    ringb = [tf((r * math.cos(2 * math.pi * k / n), 0, r * math.sin(2 * math.pi * k / n))) for k in range(n)]
    ringt = [tf((r * math.cos(2 * math.pi * k / n), h, r * math.sin(2 * math.pi * k / n))) for k in range(n)]
    tip = tf((0, h + r * 1.5, 0))
    sc.prism(ringb, ringt, pal, v, caps=False)
    ctr = tf((0, h * 0.6, 0))
    for k in range(n):
        sc.face([ringt[k], ringt[(k + 1) % n], tip], pal, v + 0.08, out=ctr)
    return tip


@item
def quartz(p=0):
    c, sc = new(cy=46)
    sc.rock((0, 2, 0), 12, "rock", 41, squash=0.38)
    crystal(sc, (-7, 3, -3), 11, 3.4, (0.15, 0.45), "qz")
    crystal(sc, (6, 3, -4), 9, 3.0, (0.1, -0.4), "qz")
    tip = crystal(sc, (0, 3, 2), 15, 4.2, (0.05, 0.05), "qz", 0.05)
    crystal(sc, (-2, 3, 8), 6, 2.4, (-0.4, 0.3), "qz", 0.05)
    sc.paint(c)
    tx, ty = sc.pt(tip)
    c.spark(tx + 2, ty + 5, 2, P["qz"][7], core=[255, 255, 255])
    return done(c)


@item
def aluminium_ore(p=0):
    c, sc = new()
    sc.rock((-9, 6, -4), 9.5, "bauxite", 51, squash=0.65, jitter=0.12)
    sc.rock((9, 5, -5), 8.5, "bauxite", 52, squash=0.65, jitter=0.12)
    sc.rock((0, 6, 7), 10, "bauxite", 53, squash=0.7, jitter=0.12)
    sc.paint(c)
    body = c.img[..., 3] == 255
    c.fill(veins(body, 0.5, 0.2, 0.6, 0.12), 0.35, "bauxite")
    speckle(c, body, 8, 7, "al", 1.0, 1.0)
    return done(c)


# ------------------------------------------------------------------ smelting and forming
def ingot(sc, pal, v=0.0, y=0.0, s=1.0):
    sc.frustum(15 * s, 7 * s, 11.5 * s, 4.5 * s, 8 * s, pal, v, y=y)


def stamp(c, sc, pts3, pal, v):
    c.fill(poly([sc.pt(q) for q in pts3]), v, pal)


@item
def iron_ingot(p=0):
    c, sc = new(cy=46)
    ingot(sc, "iron")
    sc.paint(c)
    return done(c)


@item
def copper_ingot(p=0):
    c, sc = new(cy=46)
    ingot(sc, "cu")
    sc.paint(c)
    return done(c)


@item
def aluminium_ingot(p=0):
    """Notched pig: two blocks joined by a thin web, so its outline differs from the plain ingots."""
    c, sc = new(cy=46)
    sc.frustum(13, 6.5, 10.5, 4.5, 7, "al", 0.0)
    sc.box(-5.5, 5.5, 0, 7.5, -7, 7, "al", -0.05)
    sc.paint(c)
    # stamped mark on the top
    t = [sc.pt((x, 7.6, z)) for x, z in [(-3, -2), (3, -2), (3, 2), (-3, 2)]]
    c.fill(poly(t), 0.35, "al")
    return done(c)


@item
def silicon(p=0):
    """A grown boule cut into a wafer: thick disc with a ground flat and a blue-violet sheen."""
    c, sc = new(cy=44)
    sc.cylinder((0, 0, 0), (0, 6, 0), 15, "si", n=28)
    sc.paint(c)
    top = poly([sc.pt((15 * math.cos(a), 6.05, 15 * math.sin(a))) for a in np.linspace(0, 2 * math.pi, 40)])
    # sheen band across the top face
    c.fill(top, 0.5 - 0.2 * lin(10, 20, 54, 44), "si")
    tx, ty = sc.pt((0, 6.05, 0))
    u = FIT["k"]
    band = top & (np.abs((X - tx) * 0.5 + (Y - ty)) < 3.2 * u)
    c.fill(band, 0.95, "si")
    band2 = top & (np.abs((X - tx) * 0.5 + (Y - ty) + 7 * u) < 1.2 * u)
    c.fill(band2, 0.85, "si")
    # die grid lines
    grid = top & ~band & (((X.astype(int) % 7) == 3) | ((Y.astype(int) % 5) == 2))
    c.fill(grid & ((X.astype(int) + Y.astype(int)) % 2 == 0), 0.45, "si")
    return done(c)


@item
def steel_ingot(p=0):
    """Square billet with chamfered ends, darker and warmer than iron, a heat-tint band and a brass tag."""
    c, sc = new(cy=46)
    sc.frustum(14, 8, 12.5, 6.5, 10, "gun", 0.05)
    sc.paint(c)
    # temper colours along the front edge
    t = [sc.pt((x, 10.1, z)) for x, z in [(-9, -3), (-3, -3), (-3, 3), (-9, 3)]]
    c.fill(poly(t), 0.7, "brass", outline="brass")
    return done(c)


@item
def iron_plate(p=0):
    c, sc = new(cy=44, sh=(32, 52, 24, 3.4))
    sc.box(-15, 15, 0, 3, -13, 13, "iron", 0.05)
    sc.paint(c)
    for x, z in [(-11, -9), (11, -9), (-11, 9), (11, 9)]:
        px, py = sc.pt((x, 3.1, z))
        c.set(disc(px, py, 1.6), P["iron"][1])
        c.set(disc(px - 0.5, py - 0.5, 0.6), P["iron"][7])
    return done(c)


@item
def iron_rod(p=0):
    c, sc = new(cy=48, sh=(32, 51, 20, 3))
    sc.cylinder((-17, 2, 6), (17, 8, -6), 3.6, "iron", n=14)
    sc.paint(c)
    return done(c)


@item
def iron_screw(p=0):
    c, sc = new(cy=47, sh=(30, 53, 16, 3))
    a, b = np.array([-4.0, 0, 8]), np.array([3.0, 26, -5])
    ax = (b - a) / np.linalg.norm(b - a)
    sc.cylinder(a + ax * 2, b - ax * 6, 3.2, "iron", n=14, r2=3.2)
    sc.cylinder(a, a + ax * 2.2, 3.2, "iron", n=14, r2=0.8)
    sc.cylinder(b - ax * 6, b, 7.5, "iron", 0.05, n=18)
    sc.paint(c)
    # thread lines
    for k in range(6):
        q = a + ax * (3.5 + k * 2.6)
        p1, p2 = sc.pt(q + np.array([-3.4, 0.6, 0])), sc.pt(q + np.array([3.4, -0.6, 0]))
        c.set(line(*p1, *p2, 1.0) & c.alpha, P["iron"][1])
    # slot in the head
    hx, hy = sc.pt(b + np.array([0, 0.1, 0]))
    c.set(line(hx - 5, hy + 2, hx + 5, hy - 2, 1.6), P["iron"][0])
    return done(c)


@item
def copper_wire(p=0):
    """A brass bobbin wound with copper wire, a loose end trailing."""
    c, sc = new(cy=44)
    sc.cylinder((-13, 9, 0), (-10, 9, 0), 11, "brass", n=22)
    sc.cylinder((-10, 9, 0), (10, 9, 0), 8.5, "cu", 0.05, n=22)
    sc.cylinder((10, 9, 0), (13, 9, 0), 11, "brass", n=22)
    sc.paint(c)
    wind = c.alpha & np.isin(c.img[..., 0], [q[0] for q in P["cu"]])
    c.fill(wind & ((X + Y * 0.25).astype(int) % 3 == 0), 0.35, "cu")
    tx, ty = sc.pt((8, 1, 8))
    c.fill(path([(tx, ty), (tx + 6, ty + 3), (tx + 10, ty + 1), (tx + 13, ty + 4)], 1.6), 0.7, "cu")
    c.set(disc(tx + 13.5, ty + 4.2, 0.9), P["brass"][7])
    return done(c)


@item
def aluminium_sheet(p=0):
    """Three thin bright sheets stacked a little out of line."""
    c, sc = new(cy=45, sh=(32, 52, 24, 3.2))
    for k, (dx, dz) in enumerate([(-1.5, 1.5), (1.0, -0.5), (0.0, 0.0)]):
        sc.box(-15 + dx, 15 + dx, k * 1.6, k * 1.6 + 1.2, -12 + dz, 12 + dz, "al", -0.12 + k * 0.04)
    sc.paint(c)
    top = poly([sc.pt((x, 4.45, z)) for x, z in [(-15, -12), (15, -12), (15, 12), (-15, 12)]])
    c.set(diag(top, -4, 1.0, 0.9), P["al"][7])
    c.set(diag(top, 0, 0.5, 0.9), P["al"][6])
    return done(c)


# ------------------------------------------------------------------ components
def gear_outline(r_out, r_in, teeth, hole=0.0, n_per=4):
    pts = []
    for t in range(teeth):
        for k, (fr, rr) in enumerate([(0.0, r_in), (0.18, r_out), (0.5, r_out), (0.68, r_in)]):
            a = 2 * math.pi * (t + fr) / teeth
            pts.append((rr * math.cos(a), rr * math.sin(a)))
    return pts


@item
def iron_gear(p=0):
    c, sc = new(cy=42)
    out = gear_outline(17, 13.5, 10)
    sc.extrude(out, 4, "iron", 0.02, frame=((0, 0, 0), (1, 0, 0), (0, 0, -1), (0, 1, 0)))
    sc.cylinder((0, 4, 0), (0, 6, 0), 6, "iron", 0.08, n=18)
    sc.paint(c)
    hx, hy = sc.pt((0, 6.1, 0))
    c.set(disc(hx, hy, 3.2, 2.1), P["iron"][0])
    # spokes cut
    for a in (0.6, 2.2, 3.8, 5.4):
        q = sc.pt((10 * math.cos(a), 4.1, 10 * math.sin(a)))
        c.set(disc(q[0], q[1], 2.3, 1.5), P["iron"][1])
    return done(c)


@item
def steel_beam(p=0):
    c, sc = new(cy=42, sh=(32, 52, 24, 3.2))
    w, h, f, t = 7, 10, 2.2, 2.0
    ib = [(-w, 0), (w, 0), (w, f), (t / 2, f), (t / 2, h - f), (w, h - f), (w, h), (-w, h), (-w, h - f), (-t / 2, h - f),
          (-t / 2, f), (-w, f)]
    nn = np.array([-1.0, 0, 0.35]) / np.linalg.norm([-1.0, 0, 0.35])
    uu = np.cross(np.array([0, 1.0, 0]), nn)
    sc.extrude(ib, 34, "gun", 0.05, frame=((17, 0, -6), uu, (0, 1, 0), nn))
    sc.paint(c)
    return done(c)


@item
def circuit_board(p=0):
    c, sc = new(cy=44, sh=(32, 52, 24, 3.2))
    sc.box(-15, 15, 0, 2, -11, 11, "board", 0.05)
    sc.box(-5, 5, 2, 4.5, -4, 4, "coal", 0.1)
    sc.paint(c)
    top = poly([sc.pt((x, 2.05, z)) for x, z in [(-15, -11), (15, -11), (15, 11), (-15, 11)]])
    chip = poly([sc.pt((x, 4.6, z)) for x, z in [(-5, -4), (5, -4), (5, 4), (-5, 4)]])
    tr = np.zeros_like(top)
    for (x0, z0, x1, z1) in [(-13, -8, -5, -2), (-13, 0, -5, 0), (-13, 8, -5, 2), (13, -8, 5, -2), (13, 8, 5, 2),
                             (0, -10, 0, -4), (13, 0, 5, 0)]:
        tr |= path([sc.pt((x0, 2.05, z0)), sc.pt((x0, 2.05, z1)), sc.pt((x1, 2.05, z1))], 1.2)
    c.fill(tr & top & ~chip, 0.75, "cu")
    for x, z in [(-13, -8), (-13, 0), (-13, 8), (13, -8), (13, 8), (0, -10), (13, 0)]:
        q = sc.pt((x, 2.05, z))
        c.set(disc(*q, 1.5) & top, P["brass"][6])
    c.set(disc(*sc.pt((-3, 4.6, -2)), 0.8), P["brass"][6])
    return done(c)


@item
def aluminium_casing(p=0):
    c, sc = new(cy=46)
    sc.box(-12, 12, 0, 16, -9, 9, "al", 0.0)
    sc.paint(c)
    # vents on the front face, screws on the corners of the top
    for k in range(4):
        y = 4 + k * 3
        p1, p2 = sc.pt((-8, y, 9.05)), sc.pt((2, y, 9.05))
        c.set(line(*p1, *p2, 1.2), P["al"][1])
    for x, z in [(-10, -7), (10, -7), (-10, 7), (10, 7)]:
        q = sc.pt((x, 16.1, z))
        c.set(disc(*q, 1.4), P["iron"][2])
        c.set(disc(q[0] - 0.4, q[1] - 0.4, 0.5), P["iron"][7])
    return done(c)


@item
def frame(p=0):
    """Square open frame of plate, bolted at the corners."""
    c, sc = new(cy=44, sh=(32, 52, 24, 3.2))
    o = 15
    i = 10
    outer = [(-o, -o), (o, -o), (o, o), (-o, o)]
    inner = [(-i, -i), (i, -i), (i, i), (-i, i)]
    fr = ((0, 0, 0), (1, 0, 0), (0, 0, 1), (0, 1, 0))
    # four bars so the hole stays open
    for u0, u1, w0, w1 in [(-o, o, -o, -i), (-o, o, i, o), (-o, -i, -i, i), (i, o, -i, i)]:
        sc.box(u0, u1, 0, 4, w0, w1, "iron", 0.02)
    sc.paint(c)
    for x, z in [(-12.5, -12.5), (12.5, -12.5), (-12.5, 12.5), (12.5, 12.5)]:
        q = sc.pt((x, 4.1, z))
        c.fill(disc(*q, 1.8), 0.85, "brass")
        c.set(disc(q[0] + 0.5, q[1] + 0.5, 0.6), P["brass"][1])
    return done(c)


# ------------------------------------------------------------------ clockworks
@item
def motor(p=0):
    """Dark iron drum on feet with cooling ribs, a copper coil showing through a window, and a brass pinion."""
    c, sc = new(cy=44)
    sc.box(-11, -6, 0, 4, -8, 8, "steel", 0.1)
    sc.box(5, 10, 0, 4, -8, 8, "steel", 0.1)
    sc.cylinder((-13, 11, 0), (11, 11, 0), 8.5, "iron", -0.1, n=20)
    for x in (-10, -6, 6, 10):
        sc.cylinder((x - 0.8, 11, 0), (x + 0.8, 11, 0), 9.4, "iron", 0.0, n=20)
    sc.cylinder((11, 11, 0), (18, 11, 0), 1.8, "steel", 0.2, n=10)
    sc.extrude(gear_outline(5.5, 4.2, 8), 2.2, "brass", 0.05, frame=((16, 11, 0), (0, 0, 1), (0, 1, 0), (1, 0, 0)))
    sc.paint(c)
    win = poly([sc.pt(q) for q in [(-3, 18, 4), (3, 18, 4), (3, 14, 8.2), (-3, 14, 8.2)]])
    c.fill(win, 0.7, "cu")
    c.fill(win & ((X - Y * 0.5).astype(int) % 2 == 0), 0.4, "cu")
    return done(c)


@item
def servo(p=0):
    c, sc = new(cy=46)
    sc.box(-11, 11, 0, 14, -8, 8, "brass", -0.05)
    sc.box(-11.5, 11.5, 5, 7, -8.5, 8.5, "steel", 0.05)
    sc.cylinder((3, 14, 0), (3, 17, 0), 4.5, "iron", n=16)
    sc.box(-12, 5, 17, 19, -2, 2, "cream", 0.0)
    sc.paint(c)
    q = sc.pt((-8, 10, 8.1))
    c.set(disc(*q, 1.4), P["glow"][4])
    c.glow(disc(*q, 1.4), P["glow"][3], 2, 140, 1)
    for x in (-8, -6):
        q = sc.pt((x, 18, 0))
        c.set(disc(q[0] + 4, q[1], 0.7), P["cream"][1])
    return done(c)


@item
def photocell(p=0):
    """A deep blue cell under glass in an aluminium frame, tilted up to the light."""
    c, sc = new(cy=44, sh=(32, 52, 22, 3.2))
    sc.box(-14, 14, 0, 3, -11, 11, "al", 0.0)
    sc.box(-12, 12, 3, 3.6, -9, 9, "cell", 0.15)
    sc.paint(c)
    cell = poly([sc.pt((x, 3.65, z)) for x, z in [(-12, -9), (12, -9), (12, 9), (-12, 9)]])
    grid = np.zeros_like(cell)
    for x in (-6, 0, 6):
        grid |= line(*sc.pt((x, 3.65, -9)), *sc.pt((x, 3.65, 9)), 1.0)
    grid |= line(*sc.pt((-12, 3.65, 0)), *sc.pt((12, 3.65, 0)), 1.0)
    c.set(grid & cell, P["al"][4])
    c.set(diag(cell, -3, 1.4, 1.1), P["cell"][6])
    c.spark(*sc.pt((-7, 3.7, -5)), 1, P["glass"][6])
    return done(c)


@item
def quartz_lens(p=0):
    c, sc = new(cy=48, sh=(32, 53, 16, 3))
    fr = ((0, 18, 0), (1, 0, 0), (0, 1, 0), (0.25, 0, 1))
    ringo = [(14 * math.cos(a), 14 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 28, endpoint=False)]
    sc.extrude(ringo, 4, "brass", 0.0, frame=fr)
    sc.box(-2, 2, 0, 5, -2, 2, "brass", -0.1)
    sc.paint(c)
    o, U, W, Nn = (np.asarray(v, float) for v in fr)
    lens = poly([sc.pt(o + U * 10.5 * math.cos(a) + W * 10.5 * math.sin(a) + Nn * 4.1)
                 for a in np.linspace(0, 2 * math.pi, 32, endpoint=False)])
    ys_, xs_ = np.nonzero(lens)
    cxx, cyy = xs_.mean(), ys_.mean()
    d = np.hypot(X - cxx + 4, Y - cyy + 4) / 16
    c.fill(lens, 1.0 - d, "qz")
    c.set(disc(cxx - 4, cyy - 4, 2.2), P["qz"][7])
    c.spark(cxx - 4, cyy - 4, 2, [255, 255, 255])
    return done(c)


# ------------------------------------------------------------------ megaproject
def sun_glint(c, x, y):
    c.glow(disc(x, y, 1.5), P["glow"][4], 4, 120, 2)
    c.spark(x, y, 3, P["glow"][5], core=[255, 255, 255])


@item
def sail_panel(p=0):
    """Lens array: a brass ring holding a circle of small lenses round a larger centre lens, tilted up to the sun."""
    c, sc = new(cy=50, sh=(32, 54, 18, 3))
    fr = ((0, 18, 0), (1, 0, 0), (0, 0.8, -0.6), (0, 0.6, 0.8))
    sc.box(-3, 3, 0, 4, -3, 3, "brass", -0.1)
    sc.cylinder((0, 4, 0), (0, 12, 0), 1.8, "brass", n=8)
    disc_ = [(16 * math.cos(a), 16 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 30, endpoint=False)]
    sc.extrude(disc_, 3, "brass", -0.05, frame=fr)
    sc.paint(c)
    o, U, W, Nn = (np.asarray(v, float) for v in fr)

    def lens(cu, cw, r, v):
        m = poly([sc.pt(o + U * (cu + r * math.cos(a)) + W * (cw + r * math.sin(a)) + Nn * 3.1)
                  for a in np.linspace(0, 2 * math.pi, 20, endpoint=False)])
        ys, xs = np.nonzero(m)
        if not len(xs):
            return m
        cx_, cy_ = xs.mean(), ys.mean()
        c.fill(m, v - np.hypot(X - cx_ + 1.5, Y - cy_ + 1.5) / (r * 2.2 * FIT["k"]), "glass", outline="brass")
        c.set(disc(cx_ - 1.2 * FIT["k"], cy_ - 1.2 * FIT["k"], 0.8 * FIT["k"]), P["glass"][6])
        return m
    for k in range(6):
        a = math.pi / 3 * k + 0.3
        lens(10.5 * math.cos(a), 10.5 * math.sin(a), 3.6, 0.95)
    m = lens(0, 0, 5.2, 1.1)
    ys, xs = np.nonzero(m)
    sun_glint(c, xs.mean() - 2, ys.mean() - 2)
    return done(c)


from nodefarm_icon_kit import lin  # noqa: E402


@item
def mirror_cell(p=0):
    """Mirror ring: a wide polished annulus in a brass rim, standing in a yoke, the sun running round its face."""
    c, sc = new(cy=50, sh=(32, 54, 18, 3))
    fr = ((0, 19, 0), (1, 0, 0), (0, 1, 0), (0.45, 0, 0.9))
    sc.box(-9, 9, 0, 3, -4, 4, "brass", -0.1)
    for sx in (-1, 1):
        sc.box(sx * 17 - 1.2, sx * 17 + 1.2, 3, 21, -1.2, 1.2, "brass", 0.0)
    ro = [(16 * math.cos(a), 16 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 32, endpoint=False)]
    ri = [(8 * math.cos(a), 8 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 32, endpoint=False)]
    sc.extrude(ro, 3, "brass", 0.0, frame=fr)
    sc.paint(c)
    o, U, W, Nn = (np.asarray(v, float) for v in fr)
    ring_at = lambda r: poly([sc.pt(o + U * r * math.cos(a) + W * r * math.sin(a) + Nn * 3.1)  # noqa: E731
                              for a in np.linspace(0, 2 * math.pi, 40, endpoint=False)])
    face = ring_at(14.5) & ~ring_at(9.5)
    hole = ring_at(8)
    c.fill(face, 1.0 - 0.75 * lin(14, 10, 50, 48), "mirror")
    c.set(diag(face, -4, 1.4), P["mirror"][6])
    c.img[hole & ~face] = 0
    c.fill(ring_at(9.5) & ~hole, 0.45, "brass")
    ys, xs = np.nonzero(face)
    sun_glint(c, xs.min() + 4 * FIT["k"], ys.mean() - 4 * FIT["k"])
    return done(c)


@item
def relay_core(p=0):
    """A glowing core in a brass cage, wound with a copper band."""
    c, sc = new(cy=42)
    sc.cylinder((0, 0, 0), (0, 3, 0), 12, "steel", 0.05, n=20)
    sc.paint(c)
    cx_, cy_ = sc.pt((0, 14, 0))
    core = disc(cx_, cy_, 9)
    c.glow(core, P["glow"][3], 4, 120, 2)
    c.fill(core, 1.05 - np.hypot(X - cx_ + 3, Y - cy_ + 3) / 13, "glow")
    sc2 = scene(42)
    for a in np.linspace(0, math.pi, 4, endpoint=False):
        pts = [(12 * math.cos(t) * math.cos(a), 14 + 12 * math.sin(t), 12 * math.cos(t) * math.sin(a))
               for t in np.linspace(-math.pi / 2, math.pi / 2, 9)]
        for q0, q1 in zip(pts, pts[1:]):
            front = (q0[2] * math.cos(-0.6) + q0[0] * math.sin(-0.6))
            m = line(*sc2.pt(q0), *sc2.pt(q1), 1.8)
            c.fill(m, 0.75 if front > -2 else 0.4, "brass")
    band = poly([sc2.pt((12.4 * math.cos(t), 13 + d, 12.4 * math.sin(t))) for t, d in
                 [(a, 0) for a in np.linspace(0, math.pi, 12)] + [(a, 3) for a in np.linspace(math.pi, 0, 12)]])
    c.fill(band, 0.62 + 0.25 * (1 - lin(10, 0, 54, 0)), "cu")
    c.set(disc(*sc2.pt((0, 27, 0)), 2.2), P["brass"][5])
    return done(c)


@item
def lattice_strut(p=0):
    """Orrery strut: a long brass truss, two chords tied by diagonals, with a ball joint at each end."""
    c, sc = new(cy=42, sh=(32, 52, 24, 3.2))
    a, b = np.array([-15.0, 2, 6]), np.array([15.0, 8, -6])
    ax = b - a
    up = np.array([0, 11.0, 0])
    sc.cylinder(a, b, 2.2, "brass", -0.05, n=8)
    for k in range(6):
        t0, t1, t2 = k / 6, (k + 0.5) / 6, (k + 1) / 6
        sc.cylinder(a + ax * t0, a + up + ax * t1, 0.9, "brass", -0.15, n=6)
        sc.cylinder(a + up + ax * t1, a + ax * t2, 0.9, "brass", -0.15, n=6)
    sc.cylinder(a + up, b + up, 2.2, "brass", 0.1, n=8)
    sc.paint(c)
    for q in (a - ax * 0.03, b + up + ax * 0.03):
        x, y = sc.pt(q)
        m = disc(x, y, 4.2 * FIT["k"])
        c.fill(m, 1.0 - np.hypot(X - x + 1.5, Y - y + 1.5) / (6 * FIT["k"]), "cu", outline="cu")
    return done(c)
