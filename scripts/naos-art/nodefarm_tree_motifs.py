"""Motif library for the prestige tree sprites (used by nodefarm-tree-sprites.py).

A motif is a function of one Spr (see that script). It draws flat parts in a 0..1 box; the shader adds the ramp, outline
and drop shadow. Materials: "main" (the section colour), "acc" (the node's accent colour), "metal", "dark", "glow", "ink",
or any "#rrggbb". Keep shapes inside about 0.08..0.92 so the outline and the shadow fit in the cell.

NODES maps a sprite key (the node id for now) to (motif, section, size, accent). size: s minor, m notable, l keystone/core.
Every node has its own motif: the build fails if two nodes share one.
"""
import math

FIRE = "#ff7a3c"
HOT = "#ff4d6d"
VOID = "#9a7bff"
ICE = "#bfeaff"
GOLD = "#ffc53a"
LEAF = "#7dff8a"
CYAN = "#2fd8e8"
MINT = "#6bffc9"
PINK = "#ff2d8a"
COPPER = "#f08a3c"
MOTIFS = {}


def motif(fn):
    MOTIFS[fn.__name__] = fn
    return fn


# ---------------------------------------------------------------------------------------------- signal
@motif
def linecode(s):
    s.rect(0.1, 0.62, 0.9, 0.78, "dark")
    s.line([(0.12, 0.52), (0.26, 0.52), (0.26, 0.24), (0.44, 0.24), (0.44, 0.52), (0.56, 0.52), (0.56, 0.24), (0.74, 0.24), (0.74, 0.52), (0.88, 0.52)], 0.09)
    s.dot(0.26, 0.24, 0.05)


@motif
def gainknob(s):
    s.arc(0.08, 0.08, 0.92, 0.92, 140, 400, 0.08, "acc")
    s.ell(0.24, 0.24, 0.76, 0.76, "metal")
    s.ell(0.32, 0.32, 0.68, 0.68)
    s.line([(0.5, 0.5), (0.68, 0.3)], 0.09, "glow")


@motif
def warmcache(s):
    s.rect(0.12, 0.5, 0.88, 0.82, "main")
    for i in range(4):
        s.rect(0.18 + i * 0.18, 0.58, 0.28 + i * 0.18, 0.72, "dark")
    for i in range(3):
        x = 0.28 + i * 0.22
        s.line([(x, 0.42), (x + 0.05, 0.32), (x - 0.03, 0.22), (x + 0.03, 0.12)], 0.07, "acc")


@motif
def bus(s):
    for i in range(4):
        y0 = 0.36 + i * 0.09
        y1 = 0.14 + i * 0.24
        s.line([(0.1, y0), (0.42, y0), (0.62, y1), (0.9, y1)], 0.07, "main" if i % 2 == 0 else "acc")
    s.rect(0.08, 0.3, 0.2, 0.7, "metal")


@motif
def feedback(s):
    s.arc(0.12, 0.12, 0.88, 0.88, 200, 500, 0.12)
    s.poly([(0.08, 0.38), (0.32, 0.38), (0.2, 0.58)], "main")
    s.ell(0.36, 0.36, 0.64, 0.64, "acc")
    s.dot(0.45, 0.45, 0.05)


@motif
def burst(s):
    s.star(0.5, 0.5, 0.18, 0.44, 8, -90, "acc")
    s.ell(0.3, 0.3, 0.7, 0.7)
    for i, h in enumerate((0.12, 0.22, 0.16)):
        s.rect(0.38 + i * 0.09, 0.6 - h, 0.44 + i * 0.09, 0.6, "glow", True)


@motif
def overdrive(s):
    s.arc(0.1, 0.16, 0.9, 0.96, 180, 360, 0.12)
    s.arc(0.1, 0.16, 0.9, 0.96, 300, 360, 0.12, HOT)
    s.rect(0.12, 0.58, 0.88, 0.7, "dark")
    s.line([(0.5, 0.56), (0.78, 0.3)], 0.08, "glow")
    s.ell(0.42, 0.48, 0.58, 0.64, "metal")


@motif
def parity(s):
    s.poly([(0.5, 0.08), (0.88, 0.22), (0.82, 0.62), (0.5, 0.92), (0.18, 0.62), (0.12, 0.22)])
    s.poly([(0.5, 0.18), (0.78, 0.28), (0.74, 0.58), (0.5, 0.8), (0.26, 0.58), (0.22, 0.28)], "dark")
    s.line([(0.32, 0.5), (0.45, 0.63), (0.7, 0.34)], 0.1, "acc")


@motif
def carrier(s):
    s.poly([(0.44, 0.38), (0.56, 0.38), (0.7, 0.9), (0.3, 0.9)], "metal")
    s.line([(0.37, 0.64), (0.63, 0.64)], 0.05, "dark")
    s.ell(0.42, 0.24, 0.58, 0.4, "acc")
    s.arc(0.2, 0.06, 0.8, 0.58, 200, 340, 0.06)
    s.arc(0.06, -0.06, 0.94, 0.7, 210, 330, 0.06)


@motif
def clockx2(s):
    s.rect(0.42, 0.06, 0.58, 0.16, "metal")
    s.ell(0.12, 0.14, 0.88, 0.9)
    s.ell(0.2, 0.22, 0.8, 0.82, "ink")
    s.line([(0.5, 0.52), (0.5, 0.3)], 0.07, "glow")
    s.line([(0.5, 0.52), (0.68, 0.6)], 0.07, "acc")


@motif
def phaselock(s):
    s.ring(0.08, 0.2, 0.64, 0.8, 0.1)
    s.ring(0.36, 0.2, 0.92, 0.8, 0.1, "acc")
    s.rect(0.42, 0.42, 0.58, 0.62, "metal")
    s.arc(0.42, 0.3, 0.58, 0.52, 180, 360, 0.05, "metal")


@motif
def redline(s):
    s.ell(0.06, 0.06, 0.94, 0.94, "dark")
    s.arc(0.12, 0.12, 0.88, 0.88, 150, 330, 0.1, "main")
    s.arc(0.12, 0.12, 0.88, 0.88, 330, 390, 0.1, HOT)
    for i in range(7):
        a = math.radians(150 + i * 40)
        s.line([(0.5 + 0.28 * math.cos(a), 0.5 + 0.28 * math.sin(a)), (0.5 + 0.34 * math.cos(a), 0.5 + 0.34 * math.sin(a))], 0.04, "glow")
    s.line([(0.5, 0.5), (0.84, 0.42)], 0.07, HOT)
    s.ell(0.4, 0.4, 0.6, 0.6, "metal")
    s.poly([(0.3, 0.92), (0.38, 0.72), (0.46, 0.84), (0.54, 0.68), (0.62, 0.84), (0.7, 0.74), (0.74, 0.92)], FIRE)


# ---------------------------------------------------------------------------------------------- forge
@motif
def furnace(s):
    s.rect(0.14, 0.24, 0.86, 0.9, "metal")
    s.rect(0.3, 0.08, 0.46, 0.24, "dark")
    s.poly([(0.28, 0.86), (0.28, 0.56), (0.5, 0.42), (0.72, 0.56), (0.72, 0.86)], "ink")
    s.poly([(0.36, 0.86), (0.42, 0.66), (0.5, 0.76), (0.56, 0.58), (0.64, 0.86)], "acc")


@motif
def cleanroom(s):
    s.arc(0.14, 0.12, 0.86, 0.9, 180, 360, 0.06, ICE)
    s.rect(0.08, 0.74, 0.92, 0.88, "metal")
    s.ell(0.28, 0.42, 0.72, 0.72)
    s.line([(0.36, 0.56), (0.64, 0.56)], 0.03, "dark", True)
    s.line([(0.5, 0.46), (0.5, 0.68)], 0.03, "dark", True)
    s.dot(0.3, 0.3, 0.04)


@motif
def ingot(s):
    s.poly([(0.08, 0.86), (0.18, 0.62), (0.58, 0.62), (0.68, 0.86)], "acc")
    s.poly([(0.34, 0.6), (0.44, 0.36), (0.84, 0.36), (0.92, 0.6)], "acc")
    s.poly([(0.2, 0.34), (0.3, 0.12), (0.62, 0.12), (0.7, 0.34)])


@motif
def runestone(s):
    s.poly([(0.22, 0.92), (0.16, 0.3), (0.34, 0.08), (0.7, 0.1), (0.84, 0.34), (0.8, 0.92)], "metal")
    s.line([(0.5, 0.22), (0.5, 0.8)], 0.08, "acc")
    s.line([(0.5, 0.34), (0.66, 0.46), (0.5, 0.58)], 0.08, "acc")
    s.line([(0.5, 0.58), (0.34, 0.7)], 0.08, "acc")


@motif
def beaker(s):
    s.poly([(0.36, 0.08), (0.64, 0.08), (0.64, 0.36), (0.88, 0.88), (0.12, 0.88), (0.36, 0.36)], ICE)
    s.poly([(0.24, 0.62), (0.76, 0.62), (0.88, 0.88), (0.12, 0.88)], "acc")
    s.rect(0.3, 0.06, 0.7, 0.14, "metal")
    s.dot(0.42, 0.52, 0.05)
    s.dot(0.56, 0.42, 0.04)


@motif
def slagpile(s):
    s.poly([(0.06, 0.9), (0.26, 0.56), (0.42, 0.66), (0.6, 0.48), (0.94, 0.9)], "dark")
    s.poly([(0.56, 0.12), (0.92, 0.18), (0.82, 0.42), (0.6, 0.38)], "metal")
    s.line([(0.62, 0.4), (0.5, 0.58)], 0.08, "acc")
    s.dot(0.32, 0.7, 0.05, "acc")
    s.dot(0.7, 0.72, 0.05, "acc")


@motif
def gemcut(s):
    s.poly([(0.22, 0.32), (0.36, 0.14), (0.64, 0.14), (0.78, 0.32), (0.5, 0.9)], "acc")
    s.poly([(0.22, 0.32), (0.78, 0.32), (0.5, 0.9)], "main")
    s.star(0.76, 0.18, 0.03, 0.12, 4, -90, "glow", True)


@motif
def seed(s):
    s.rect(0.1, 0.8, 0.9, 0.9, "dark")
    s.poly([(0.44, 0.82), (0.36, 0.3), (0.48, 0.1), (0.58, 0.3), (0.54, 0.82)])
    s.poly([(0.26, 0.82), (0.18, 0.5), (0.28, 0.4), (0.38, 0.6), (0.38, 0.82)], "acc")
    s.poly([(0.6, 0.82), (0.66, 0.46), (0.78, 0.38), (0.84, 0.56), (0.74, 0.82)], "acc")


@motif
def voidanvil(s):
    s.ell(0.2, 0.06, 0.8, 0.5, "acc")
    s.ell(0.36, 0.18, 0.64, 0.4, "ink")
    s.poly([(0.06, 0.5), (0.94, 0.5), (0.8, 0.62), (0.62, 0.62), (0.62, 0.74), (0.78, 0.9), (0.22, 0.9), (0.38, 0.74), (0.38, 0.62), (0.2, 0.62)], "metal")


@motif
def pickaxe(s):
    s.poly([(0.08, 0.92), (0.4, 0.74), (0.62, 0.86), (0.92, 0.92)], "dark")
    s.line([(0.62, 0.7), (0.62, 0.84)], 0.06, "acc")
    s.line([(0.24, 0.78), (0.7, 0.24)], 0.09, COPPER)
    s.arc(0.3, 0.06, 0.98, 0.64, 190, 290, 0.1, "metal")


@motif
def hourglass(s):
    s.rect(0.2, 0.08, 0.8, 0.16, "metal")
    s.rect(0.2, 0.84, 0.8, 0.92, "metal")
    s.poly([(0.28, 0.16), (0.72, 0.16), (0.54, 0.5), (0.72, 0.84), (0.28, 0.84), (0.46, 0.5)], ICE)
    s.poly([(0.36, 0.22), (0.64, 0.22), (0.5, 0.46)], "acc")
    s.poly([(0.5, 0.6), (0.68, 0.82), (0.32, 0.82)], "acc")


@motif
def boiler(s):
    s.rect(0.14, 0.3, 0.86, 0.9, "metal")
    s.rect(0.14, 0.46, 0.86, 0.54, "dark")
    s.rect(0.14, 0.7, 0.86, 0.76, "dark")
    s.ell(0.3, 0.06, 0.7, 0.46, "main")
    s.ell(0.36, 0.12, 0.64, 0.4, "ink")
    s.line([(0.5, 0.26), (0.6, 0.16)], 0.05, HOT)
    s.poly([(0.28, 0.9), (0.36, 0.76), (0.44, 0.86), (0.5, 0.7), (0.56, 0.86), (0.64, 0.76), (0.72, 0.9)], "acc")
    s.line([(0.86, 0.36), (0.94, 0.28), (0.94, 0.14)], 0.05, ICE)


# ---------------------------------------------------------------------------------------------- systems
@motif
def moonplus(s):
    s.ell(0.1, 0.12, 0.78, 0.8)
    s.ell(0.3, 0.04, 0.92, 0.66, "ink")
    s.rect(0.62, 0.62, 0.9, 0.72, "acc")
    s.rect(0.71, 0.52, 0.81, 0.82, "acc")


@motif
def heatsink(s):
    s.rect(0.1, 0.7, 0.9, 0.88, "acc")
    for i in range(5):
        s.rect(0.14 + i * 0.15, 0.14, 0.24 + i * 0.15, 0.7)


@motif
def ram(s):
    s.rect(0.06, 0.3, 0.94, 0.7, "dark")
    for i in range(3):
        s.rect(0.12 + i * 0.28, 0.36, 0.32 + i * 0.28, 0.58)
    for i in range(8):
        s.rect(0.1 + i * 0.105, 0.7, 0.15 + i * 0.105, 0.8, "acc", True)


@motif
def tape(s):
    s.rect(0.08, 0.2, 0.92, 0.8, "metal")
    s.rect(0.18, 0.3, 0.82, 0.58, "ink")
    s.ell(0.24, 0.34, 0.44, 0.54)
    s.ell(0.56, 0.34, 0.76, 0.54)
    s.rect(0.32, 0.64, 0.68, 0.8, "acc")


@motif
def blackhole(s):
    s.ell(0.06, 0.06, 0.94, 0.94, "acc")
    s.ell(0.16, 0.16, 0.84, 0.84)
    s.arc(0.0, 0.32, 1.0, 0.68, 0, 360, 0.06, "glow")
    s.ell(0.3, 0.3, 0.7, 0.7, "ink")


@motif
def mesh(s):
    pts = [(0.14, 0.2), (0.5, 0.1), (0.86, 0.2), (0.3, 0.52), (0.7, 0.52), (0.14, 0.86), (0.5, 0.9), (0.86, 0.86)]
    for a, b in ((0, 1), (1, 2), (0, 3), (1, 3), (1, 4), (2, 4), (3, 4), (3, 5), (3, 6), (4, 6), (4, 7), (5, 6), (6, 7)):
        s.line([pts[a], pts[b]], 0.05, "main")
    for x, y in pts:
        s.ell(x - 0.07, y - 0.07, x + 0.07, y + 0.07, "acc")


@motif
def pod(s):
    s.ell(0.14, 0.06, 0.86, 0.94, "metal")
    s.ell(0.24, 0.16, 0.76, 0.6, ICE)
    s.rect(0.26, 0.68, 0.74, 0.74, "dark")
    s.dot(0.36, 0.82, 0.05, "acc")
    s.dot(0.52, 0.82, 0.05)
    s.line([(0.4, 0.36), (0.48, 0.3), (0.56, 0.36)], 0.04, "dark", True)


@motif
def coil(s):
    s.rect(0.24, 0.8, 0.76, 0.92, "metal")
    s.rect(0.4, 0.36, 0.6, 0.8, "dark")
    for i in range(4):
        s.rect(0.32, 0.4 + i * 0.1, 0.68, 0.45 + i * 0.1, COPPER)
    s.ell(0.28, 0.12, 0.72, 0.38, "metal")
    s.line([(0.72, 0.22), (0.82, 0.12), (0.78, 0.28), (0.92, 0.2)], 0.05, "acc")
    s.line([(0.28, 0.22), (0.14, 0.14), (0.2, 0.3), (0.08, 0.26)], 0.05, "acc")


@motif
def fan(s):
    s.rect(0.08, 0.08, 0.92, 0.92, "dark")
    for i in range(4):
        a = math.radians(i * 90 + 20)
        b = math.radians(i * 90 + 70)
        s.poly([(0.5, 0.5), (0.5 + 0.38 * math.cos(a), 0.5 + 0.38 * math.sin(a)), (0.5 + 0.36 * math.cos(b), 0.5 + 0.36 * math.sin(b))])
    s.ell(0.4, 0.4, 0.6, 0.6, "acc")


@motif
def ledger(s):
    s.poly([(0.06, 0.24), (0.48, 0.3), (0.48, 0.88), (0.06, 0.8)])
    s.poly([(0.52, 0.3), (0.94, 0.24), (0.94, 0.8), (0.52, 0.88)])
    for i in range(3):
        s.line([(0.14, 0.42 + i * 0.12), (0.4, 0.45 + i * 0.12)], 0.04, "dark", True)
    s.line([(0.6, 0.45), (0.86, 0.42)], 0.04, "dark", True)
    s.line([(0.66, 0.6), (0.72, 0.66), (0.86, 0.5)], 0.06, "acc")


@motif
def horizon(s):
    s.ell(0.22, 0.22, 0.78, 0.78, "acc")
    s.poly([(0.22, 0.5), (0.78, 0.5), (0.7, 0.68), (0.3, 0.68)], "main")
    s.arc(0.02, 0.36, 0.98, 0.66, 160, 380, 0.07, "glow")


@motif
def vault(s):
    s.rect(0.06, 0.06, 0.94, 0.94, "metal")
    s.ell(0.16, 0.16, 0.84, 0.84, "dark")
    s.ell(0.22, 0.22, 0.78, 0.78)
    for i in range(6):
        a = math.radians(i * 60)
        s.line([(0.5, 0.5), (0.5 + 0.22 * math.cos(a), 0.5 + 0.22 * math.sin(a))], 0.06, "metal")
    s.ell(0.42, 0.42, 0.58, 0.58, "acc")
    for x, y in ((0.12, 0.12), (0.88, 0.12), (0.12, 0.88), (0.88, 0.88)):
        s.star(x, y, 0.02, 0.07, 4, -90, ICE, True)


# ---------------------------------------------------------------------------------------------- drones
@motif
def alarm(s):
    s.ell(0.16, 0.2, 0.84, 0.88)
    s.ell(0.24, 0.28, 0.76, 0.8, "ink")
    s.ell(0.08, 0.06, 0.32, 0.3, "acc")
    s.ell(0.68, 0.06, 0.92, 0.3, "acc")
    s.line([(0.5, 0.54), (0.5, 0.36)], 0.06, "glow")
    s.line([(0.5, 0.54), (0.64, 0.58)], 0.06, "glow")


@motif
def oilcan(s):
    s.poly([(0.16, 0.48), (0.64, 0.48), (0.7, 0.9), (0.1, 0.9)])
    s.poly([(0.6, 0.56), (0.94, 0.24), (0.96, 0.3), (0.66, 0.66)], "metal")
    s.rect(0.3, 0.36, 0.5, 0.48, "metal")
    s.ell(0.86, 0.36, 0.94, 0.5, "acc")


@motif
def battery(s):
    s.rect(0.4, 0.06, 0.6, 0.16, "metal")
    s.rect(0.24, 0.14, 0.76, 0.92, "metal")
    s.rect(0.3, 0.2, 0.7, 0.86, "ink")
    for i in range(3):
        s.rect(0.34, 0.62 - i * 0.2, 0.66, 0.8 - i * 0.2, "acc" if i < 2 else "main")


@motif
def gyro(s):
    s.ring(0.08, 0.08, 0.92, 0.92, 0.07, "metal")
    s.ring(0.26, 0.08, 0.74, 0.92, 0.07)
    s.ring(0.08, 0.32, 0.92, 0.68, 0.07, "acc")
    s.ell(0.4, 0.4, 0.6, 0.6, "glow")


@motif
def hive(s):
    for (x, y), m in zip(((0.32, 0.3), (0.68, 0.3), (0.5, 0.62), (0.14, 0.62), (0.86, 0.62)), ("main", "main", "acc", "main", "main")):
        s.ngon(x, y, 0.17, 6, 30, m)
    s.line([(0.32, 0.3), (0.5, 0.62), (0.68, 0.3)], 0.04, "glow", True)


@motif
def crate(s):
    s.poly([(0.1, 0.3), (0.5, 0.12), (0.9, 0.3), (0.5, 0.48)], "acc")
    s.poly([(0.1, 0.3), (0.5, 0.48), (0.5, 0.92), (0.1, 0.74)])
    s.poly([(0.9, 0.3), (0.5, 0.48), (0.5, 0.92), (0.9, 0.74)], "dark")
    s.line([(0.16, 0.42), (0.44, 0.8)], 0.04, "metal", True)


@motif
def wing(s):
    s.poly([(0.04, 0.4), (0.4, 0.46), (0.4, 0.58), (0.06, 0.52)], "acc")
    s.poly([(0.96, 0.4), (0.6, 0.46), (0.6, 0.58), (0.94, 0.52)], "acc")
    s.ell(0.34, 0.34, 0.66, 0.7)
    s.ell(0.42, 0.44, 0.58, 0.6, "glow")
    s.line([(0.42, 0.7), (0.36, 0.84)], 0.05, "metal")
    s.line([(0.58, 0.7), (0.64, 0.84)], 0.05, "metal")


@motif
def servo(s):
    for i in range(8):
        a = math.radians(i * 45)
        s.rect(0.44 + 0.3 * math.cos(a) - 0.07, 0.56 + 0.3 * math.sin(a) - 0.07, 0.44 + 0.3 * math.cos(a) + 0.07, 0.56 + 0.3 * math.sin(a) + 0.07, "metal")
    s.ell(0.16, 0.28, 0.72, 0.84, "metal")
    s.ell(0.32, 0.44, 0.56, 0.68, "dark")
    s.poly([(0.66, 0.36), (0.72, 0.16), (0.8, 0.26), (0.86, 0.06), (0.94, 0.3), (0.86, 0.42)], "acc")


@motif
def nightdrone(s):
    s.ell(0.5, 0.04, 0.94, 0.48, "acc")
    s.ell(0.62, 0.0, 1.0, 0.36, "ink")
    s.rect(0.08, 0.56, 0.68, 0.62, "metal")
    s.ell(0.24, 0.5, 0.52, 0.82)
    s.dot(0.38, 0.66, 0.05)


@motif
def brain(s):
    s.ell(0.1, 0.16, 0.56, 0.78)
    s.ell(0.44, 0.16, 0.9, 0.78)
    s.line([(0.5, 0.2), (0.5, 0.78)], 0.04, "dark", True)
    s.arc(0.18, 0.3, 0.42, 0.5, 200, 360, 0.04, "dark", True)
    s.arc(0.58, 0.44, 0.82, 0.64, 0, 180, 0.04, "dark", True)
    for x, y in ((0.12, 0.88), (0.5, 0.92), (0.88, 0.88)):
        s.dot(x, y, 0.06, "acc", False)


@motif
def flag(s):
    s.rect(0.14, 0.06, 0.22, 0.94, "metal")
    s.poly([(0.22, 0.1), (0.9, 0.16), (0.76, 0.34), (0.9, 0.52), (0.22, 0.52)])
    s.ngon(0.5, 0.3, 0.1, 6, 30, "acc")


@motif
def swarm(s):
    s.ell(0.3, 0.38, 0.7, 0.78)
    s.poly([(0.04, 0.5), (0.32, 0.52), (0.32, 0.62), (0.06, 0.62)], "acc")
    s.poly([(0.96, 0.5), (0.68, 0.52), (0.68, 0.62), (0.94, 0.62)], "acc")
    s.ell(0.42, 0.5, 0.58, 0.66, "glow")
    for x, y in ((0.18, 0.18), (0.5, 0.1), (0.82, 0.18)):
        s.ell(x - 0.08, y - 0.06, x + 0.08, y + 0.08, "main")
        s.line([(x - 0.13, y), (x + 0.13, y)], 0.03, "acc")
    s.line([(0.4, 0.78), (0.34, 0.92)], 0.05, "metal")
    s.line([(0.6, 0.78), (0.66, 0.92)], 0.05, "metal")


# ---------------------------------------------------------------------------------------------- anomaly
@motif
def static(s):
    s.rect(0.08, 0.16, 0.92, 0.8, "metal")
    s.rect(0.16, 0.24, 0.84, 0.72, "ink")
    for i in range(5):
        y = 0.3 + i * 0.09
        s.rect(0.2 + (i * 0.13) % 0.3, y, 0.5 + (i * 0.17) % 0.3, y + 0.04, "main" if i % 2 else "acc", True)
    s.line([(0.36, 0.8), (0.28, 0.92)], 0.05, "metal")
    s.line([(0.64, 0.8), (0.72, 0.92)], 0.05, "metal")


@motif
def echo(s):
    s.poly([(0.08, 0.38), (0.24, 0.38), (0.42, 0.2), (0.42, 0.8), (0.24, 0.62), (0.08, 0.62)], "metal")
    s.arc(0.3, 0.24, 0.66, 0.76, -50, 50, 0.07)
    s.arc(0.3, 0.12, 0.84, 0.88, -50, 50, 0.07, "acc")
    s.arc(0.3, 0.02, 1.0, 0.98, -45, 45, 0.06)


@motif
def eye(s):
    s.poly([(0.04, 0.5), (0.24, 0.26), (0.5, 0.18), (0.76, 0.26), (0.96, 0.5), (0.76, 0.74), (0.5, 0.82), (0.24, 0.74)], ICE)
    s.ell(0.3, 0.3, 0.7, 0.7)
    s.ell(0.42, 0.42, 0.58, 0.58, "ink")
    s.dot(0.4, 0.4, 0.05)


@motif
def ghost(s):
    s.poly([(0.18, 0.9), (0.18, 0.38), (0.3, 0.14), (0.5, 0.08), (0.7, 0.14), (0.82, 0.38), (0.82, 0.9), (0.7, 0.78), (0.6, 0.9), (0.5, 0.78), (0.4, 0.9), (0.3, 0.78)])
    s.ell(0.3, 0.32, 0.44, 0.5, "ink")
    s.ell(0.56, 0.32, 0.7, 0.5, "ink")
    s.line([(0.04, 0.62), (0.16, 0.62)], 0.04, "acc", True)
    s.line([(0.84, 0.5), (0.96, 0.5)], 0.04, "acc", True)


@motif
def bleed(s):
    s.rect(0.14, 0.08, 0.86, 0.46, "metal")
    s.rect(0.24, 0.16, 0.76, 0.38, "dark")
    for i in range(5):
        s.rect(0.18 + i * 0.14, 0.46, 0.24 + i * 0.14, 0.54, "metal")
    s.poly([(0.5, 0.56), (0.66, 0.78), (0.6, 0.92), (0.4, 0.92), (0.34, 0.78)], "acc")
    s.dot(0.3, 0.66, 0.04, "acc", False)


@motif
def compass(s):
    s.ell(0.08, 0.08, 0.92, 0.92, "metal")
    s.ell(0.16, 0.16, 0.84, 0.84, "ink")
    s.poly([(0.5, 0.18), (0.6, 0.5), (0.5, 0.82), (0.4, 0.5)])
    s.poly([(0.5, 0.18), (0.6, 0.5), (0.4, 0.5)], "acc")
    s.dot(0.5, 0.5, 0.04)


@motif
def tuningfork(s):
    s.line([(0.5, 0.92), (0.5, 0.56)], 0.08, "metal")
    s.line([(0.34, 0.1), (0.34, 0.5), (0.5, 0.6), (0.66, 0.5), (0.66, 0.1)], 0.09)
    s.arc(0.1, 0.06, 0.9, 0.5, 200, 240, 0.05, "acc")
    s.arc(0.1, 0.06, 0.9, 0.5, 300, 340, 0.05, "acc")


@motif
def blackbox(s):
    s.poly([(0.1, 0.3), (0.5, 0.1), (0.9, 0.3), (0.5, 0.5)], "dark")
    s.poly([(0.1, 0.3), (0.5, 0.5), (0.5, 0.92), (0.1, 0.72)], "ink")
    s.poly([(0.9, 0.3), (0.5, 0.5), (0.5, 0.92), (0.9, 0.72)], "#1e2335")
    s.line([(0.62, 0.56), (0.62, 0.72), (0.78, 0.64)], 0.05, "acc")
    s.line([(0.1, 0.3), (0.5, 0.1), (0.9, 0.3)], 0.04, "main")


@motif
def mask(s):
    s.poly([(0.12, 0.18), (0.88, 0.18), (0.84, 0.56), (0.5, 0.9), (0.16, 0.56)], ICE)
    s.poly([(0.22, 0.34), (0.42, 0.34), (0.42, 0.44), (0.24, 0.46)], "ink")
    s.poly([(0.58, 0.34), (0.78, 0.34), (0.76, 0.46), (0.58, 0.44)], "ink")
    s.line([(0.36, 0.66), (0.5, 0.6), (0.64, 0.66)], 0.04, "acc")
    s.line([(0.12, 0.18), (0.04, 0.1)], 0.04, "main")


@motif
def floppy(s):
    s.poly([(0.1, 0.1), (0.78, 0.1), (0.9, 0.22), (0.9, 0.9), (0.1, 0.9)])
    s.rect(0.26, 0.1, 0.68, 0.36, "metal")
    s.rect(0.52, 0.14, 0.62, 0.32, "dark")
    s.rect(0.2, 0.52, 0.8, 0.9, ICE)
    s.line([(0.28, 0.64), (0.72, 0.64)], 0.03, "acc", True)
    s.line([(0.28, 0.76), (0.6, 0.76)], 0.03, "acc", True)


@motif
def quietroom(s):
    s.rect(0.16, 0.06, 0.84, 0.94, "dark")
    s.rect(0.24, 0.14, 0.76, 0.94)
    s.rect(0.32, 0.22, 0.68, 0.5, "acc")
    s.ell(0.6, 0.58, 0.7, 0.68, GOLD)
    s.line([(0.06, 0.94), (0.94, 0.94)], 0.04, "metal")


@motif
def spike(s):
    s.poly([(0.5, 0.02), (0.64, 0.42), (0.98, 0.5), (0.64, 0.58), (0.5, 0.98), (0.36, 0.58), (0.02, 0.5), (0.36, 0.42)], "acc")
    s.poly([(0.5, 0.16), (0.6, 0.44), (0.5, 0.84), (0.4, 0.56)])
    s.poly([(0.56, 0.24), (0.4, 0.52), (0.52, 0.52), (0.44, 0.78), (0.62, 0.46), (0.5, 0.46)], "glow", True)


# ---------------------------------------------------------------------------------------------- core
@motif
def reactor(s):
    s.ngon(0.5, 0.5, 0.46, 6, 30, "metal")
    s.ngon(0.5, 0.5, 0.36, 6, 30, "dark")
    s.ell(0.26, 0.26, 0.74, 0.74, CYAN)
    s.ell(0.34, 0.34, 0.66, 0.66, "glow")
    for i in range(6):
        a = math.radians(i * 60 + 30)
        s.dot(0.5 + 0.41 * math.cos(a), 0.5 + 0.41 * math.sin(a), 0.035, "acc", True)


# ---------------------------------------------------------------------------------------------- added for the 40-node tree
@motif
def receipt(s):
    for i in range(3):
        o = (2 - i) * 0.08
        s.rect(0.2 + o, 0.08 + o, 0.72 + o, 0.62 + o, "metal" if i < 2 else ICE)
    for i in range(3):
        s.line([(0.32, 0.4 + i * 0.1), (0.76, 0.4 + i * 0.1)], 0.035, "dark", True)
    s.poly([(0.56, 0.7), (0.92, 0.7), (0.74, 0.92)], "acc")
    s.rect(0.68, 0.56, 0.8, 0.72, "acc")


@motif
def kitbag(s):
    s.arc(0.34, 0.08, 0.66, 0.4, 180, 360, 0.07, "dark")
    s.rect(0.08, 0.26, 0.92, 0.88)
    s.rect(0.08, 0.44, 0.92, 0.52, "dark")
    s.rect(0.42, 0.38, 0.58, 0.58, "metal")
    s.poly([(0.4, 0.62), (0.4, 0.84), (0.62, 0.73)], "acc")


@motif
def watchdog(s):
    s.poly([(0.16, 0.38), (0.22, 0.06), (0.4, 0.28)], "dark")
    s.poly([(0.84, 0.38), (0.78, 0.06), (0.6, 0.28)], "dark")
    s.poly([(0.14, 0.34), (0.5, 0.2), (0.86, 0.34), (0.82, 0.7), (0.5, 0.9), (0.18, 0.7)], "metal")
    s.poly([(0.36, 0.62), (0.64, 0.62), (0.5, 0.86)], "main")
    s.ell(0.42, 0.62, 0.58, 0.74, "ink")
    s.rect(0.26, 0.4, 0.42, 0.5, "acc")
    s.rect(0.58, 0.4, 0.74, 0.5, "acc")


@motif
def pricetag(s):
    s.poly([(0.08, 0.5), (0.36, 0.14), (0.9, 0.14), (0.9, 0.86), (0.36, 0.86)])
    s.ell(0.24, 0.42, 0.36, 0.58, "ink")
    s.line([(0.46, 0.36), (0.8, 0.36)], 0.07, "acc")
    s.line([(0.46, 0.64), (0.8, 0.64)], 0.07, "acc")


def _drive(s, marks):
    s.rect(0.08, 0.2, 0.92, 0.8, "metal")
    s.ell(0.2, 0.26, 0.62, 0.74, "dark")
    s.ell(0.34, 0.4, 0.48, 0.6, "main")
    s.line([(0.41, 0.5), (0.72, 0.34)], 0.05, "acc")
    for x, y in ((0.14, 0.26), (0.86, 0.26), (0.14, 0.74), (0.86, 0.74)):
        s.dot(x, y, 0.035, "dark", True)
    for i in range(marks):
        s.rect(0.7 + i * 0.09, 0.54, 0.75 + i * 0.09, 0.72, "glow", True)


@motif
def drive1(s):
    _drive(s, 1)


@motif
def drive2(s):
    _drive(s, 2)


def _carrier(s, n):
    s.poly([(0.42, 0.42), (0.58, 0.42), (0.74, 0.92), (0.26, 0.92)], "metal")
    s.line([(0.34, 0.7), (0.66, 0.7)], 0.05, "dark")
    s.ell(0.4, 0.26, 0.6, 0.46, "acc")
    for i in range(n):
        r = 0.2 + i * 0.13
        s.arc(0.5 - r, 0.36 - r, 0.5 + r, 0.36 + r, 205, 335, 0.065, "main" if i < 2 else "glow")


@motif
def carrier_1(s):
    _carrier(s, 1)


@motif
def carrier_2(s):
    _carrier(s, 2)


@motif
def carrier_3(s):
    _carrier(s, 3)


@motif
def forecast(s):
    s.poly([(0.06, 0.62), (0.3, 0.38), (0.72, 0.38), (0.72, 0.9), (0.3, 0.9)], "acc")
    s.ell(0.18, 0.58, 0.28, 0.68, "ink")
    s.ell(0.44, 0.06, 0.94, 0.56)
    s.ell(0.5, 0.12, 0.88, 0.5, "ink")
    s.line([(0.69, 0.31), (0.69, 0.18)], 0.05, "glow")
    s.line([(0.69, 0.31), (0.8, 0.36)], 0.05, "glow")


@motif
def orders(s):
    s.rect(0.08, 0.14, 0.62, 0.92, "metal")
    s.rect(0.26, 0.08, 0.44, 0.2, "dark")
    for i in range(3):
        s.line([(0.16, 0.36 + i * 0.18), (0.24, 0.44 + i * 0.18), (0.34, 0.3 + i * 0.18)], 0.05, "acc")
        s.line([(0.4, 0.38 + i * 0.18), (0.54, 0.38 + i * 0.18)], 0.04, "dark", True)
    s.ell(0.62, 0.5, 0.92, 0.8)
    s.line([(0.56, 0.56), (0.98, 0.56)], 0.05, "acc")
    s.dot(0.77, 0.66, 0.05)


@motif
def cache(s):
    s.poly([(0.08, 0.3), (0.5, 0.14), (0.92, 0.3), (0.5, 0.46)], "dark")
    s.poly([(0.08, 0.3), (0.5, 0.46), (0.5, 0.92), (0.08, 0.76)], "metal")
    s.poly([(0.92, 0.3), (0.5, 0.46), (0.5, 0.92), (0.92, 0.76)])
    for i in range(3):
        s.poly([(0.58, 0.78 - i * 0.12), (0.84, 0.68 - i * 0.12), (0.84, 0.72 - i * 0.12), (0.58, 0.82 - i * 0.12)], "acc" if i < 2 else "dark", True)
    s.rect(0.16, 0.48, 0.42, 0.56, "dark")


@motif
def fuse(s):
    s.arc(0.08, 0.3, 0.6, 0.82, 90, 360, 0.08, "metal")
    s.arc(0.3, 0.1, 0.76, 0.56, 180, 450, 0.08, "metal")
    s.rect(0.06, 0.74, 0.3, 0.92, "main")
    s.star(0.74, 0.14, 0.04, 0.13, 6, -90, "acc")
    s.dot(0.74, 0.14, 0.04)


@motif
def duck(s):
    s.ell(0.12, 0.44, 0.84, 0.88, GOLD)
    s.ell(0.42, 0.12, 0.8, 0.5, GOLD)
    s.poly([(0.78, 0.3), (0.96, 0.34), (0.78, 0.42)], FIRE)
    s.dot(0.62, 0.26, 0.04, "ink", True)
    s.arc(0.22, 0.5, 0.58, 0.76, 20, 160, 0.05, "#e0a020")
    s.rect(0.06, 0.86, 0.94, 0.92, "main")


@motif
def opendoor(s):
    s.rect(0.2, 0.06, 0.8, 0.94, "dark")
    s.rect(0.26, 0.12, 0.74, 0.94, "glow", True)
    s.poly([(0.26, 0.12), (0.5, 0.2), (0.5, 0.98), (0.26, 0.94)])
    s.dot(0.44, 0.56, 0.035, GOLD, True)
    s.poly([(0.74, 0.94), (0.96, 0.98), (0.6, 0.98)], "acc")


# ---------------------------------------------------------------------------------------------- node table
# key: (motif, section, size, accent). Size: s minor, m notable, l keystone. Keys are node ids in lib/nodefarm/engine.ts.

# ---------------------------------------------------------------------------------------------- the deeper tree (2026-11-12)
# Junctions, forks and ranked nodes. Most reuse motifs that were drawn but never placed; these four are new.
@motif
def jar(s):
    s.rect(0.3, 0.1, 0.7, 0.2, "metal")
    s.poly([(0.22, 0.26), (0.78, 0.26), (0.84, 0.4), (0.84, 0.86), (0.16, 0.86), (0.16, 0.4)], "dark")
    s.poly([(0.22, 0.48), (0.78, 0.48), (0.78, 0.8), (0.22, 0.8)], "main")
    for x, y in [(0.34, 0.6), (0.52, 0.56), (0.66, 0.68), (0.42, 0.72)]:
        s.dot(x, y, 0.05, "acc", flat=False)
    s.line([(0.26, 0.32), (0.26, 0.42)], 0.05, "glow")


@motif
def spear(s):
    s.poly([(0.5, 0.06), (0.68, 0.34), (0.56, 0.34), (0.56, 0.4), (0.44, 0.4), (0.44, 0.34), (0.32, 0.34)], "acc")
    s.rect(0.46, 0.4, 0.54, 0.9, "metal")
    for i, y in enumerate((0.58, 0.72, 0.86)):
        w = 0.12 + i * 0.06
        s.poly([(0.5, y - 0.1), (0.5 + w, y), (0.5 - w, y)], "main")
    s.dot(0.5, 0.2, 0.04)


@motif
def manifest(s):
    s.rect(0.2, 0.14, 0.8, 0.9, "metal")
    s.rect(0.36, 0.08, 0.64, 0.2, "dark")
    for i in range(4):
        y = 0.3 + i * 0.15
        s.rect(0.28, y, 0.38, y + 0.08, "acc")
        s.rect(0.44, y + 0.02, 0.72, y + 0.06, "ink")


@motif
def siren(s):
    s.rect(0.2, 0.74, 0.8, 0.88, "dark")
    s.poly([(0.3, 0.74), (0.3, 0.42), (0.38, 0.3), (0.62, 0.3), (0.7, 0.42), (0.7, 0.74)], "main")
    s.rect(0.38, 0.42, 0.62, 0.66, "acc")
    s.arc(0.04, 0.12, 0.38, 0.62, 200, 250, 0.06, "glow")
    s.arc(0.62, 0.12, 0.96, 0.62, 290, 340, 0.06, "glow")
    s.line([(0.5, 0.06), (0.5, 0.2)], 0.06, "glow")

NODES = {
    "core": ("reactor", "core", "l", MINT),
    # signal
    "linecode": ("linecode", "signal", "s", GOLD),
    "batchjob": ("receipt", "signal", "s", GOLD),
    "echocancel": ("feedback", "signal", "s", PINK),
    "headstart": ("kitbag", "signal", "s", LEAF),
    "hotswap": ("warmcache", "signal", "s", FIRE),
    "watchdog": ("watchdog", "signal", "m", HOT),
    "flatrate": ("pricetag", "signal", "m", GOLD),
    "overdrive": ("redline", "signal", "l", GOLD),
    # forge
    "furnace": ("furnace", "forge", "s", FIRE),
    "prospect": ("pickaxe", "forge", "s", GOLD),
    "assay": ("beaker", "forge", "s", LEAF),
    "mount1": ("drive1", "forge", "m", CYAN),
    "deepvein": ("seed", "forge", "s", "#e08cff"),
    "mount2": ("drive2", "forge", "s", CYAN),
    "crosstalk": ("phaselock", "forge", "m", VOID),
    "overpress": ("boiler", "forge", "l", FIRE),
    # systems
    "standby": ("moonplus", "systems", "s", GOLD),
    "carrier1": ("carrier_1", "systems", "s", CYAN),
    "forecast": ("forecast", "systems", "s", GOLD),
    "carrier2": ("carrier_2", "systems", "m", PINK),
    "ledger": ("ledger", "systems", "s", PINK),
    "carrier3": ("carrier_3", "systems", "s", VOID),
    "deaddrop": ("cache", "systems", "m", GOLD),
    "coldstore": ("vault", "systems", "l", CYAN),
    # drones
    "wake": ("alarm", "drones", "s", GOLD),
    "sparecell": ("battery", "drones", "s", LEAF),
    "orders": ("orders", "drones", "s", CYAN),
    "overwatch": ("wing", "drones", "s", CYAN),
    "bulkorder": ("crate", "drones", "s", COPPER),
    "graveyard": ("nightdrone", "drones", "m", GOLD),
    "hivemem": ("brain", "drones", "m", CYAN),
    "swarm": ("swarm", "drones", "l", CYAN),
    # anomaly
    "static": ("static", "anomaly", "s", CYAN),
    "longfuse": ("fuse", "anomaly", "s", GOLD),
    "duck": ("duck", "anomaly", "s", GOLD),
    "resonant": ("tuningfork", "anomaly", "s", CYAN),
    "ghostline": ("ghost", "anomaly", "s", CYAN),
    "echo": ("echo", "anomaly", "m", PINK),
    "zeroday": ("opendoor", "anomaly", "m", PINK),
    "spike": ("spike", "anomaly", "l", PINK),
    # the deeper tree: forks (m), ranked tips (l) and the five junctions (m, coloured by their first section)
    "coldstart": ("burst", "signal", "m", FIRE),
    "longhaul": ("hourglass", "signal", "m", GOLD),
    "clockskew": ("clockx2", "signal", "l", PINK),
    "specialist": ("gemcut", "forge", "m", PINK),
    "generalist": ("ingot", "forge", "m", COPPER),
    "alloy": ("voidanvil", "forge", "l", VOID),
    "hoarder": ("jar", "systems", "m", GOLD),
    "investor": ("mesh", "systems", "m", CYAN),
    "archive": ("tape", "systems", "l", PINK),
    "widenet": ("hive", "drones", "m", GOLD),
    "spearhead": ("spear", "drones", "m", CYAN),
    "firmware": ("floppy", "drones", "l", CYAN),
    "storm": ("eye", "anomaly", "m", CYAN),
    "patient": ("quietroom", "anomaly", "m", GOLD),
    "afterimage": ("bleed", "anomaly", "l", PINK),
    "busbar": ("bus", "signal", "m", GOLD),
    "manifest": ("manifest", "forge", "m", MINT),
    "nightcrew": ("pod", "systems", "m", HOT),
    "swarmalarm": ("siren", "drones", "m", VOID),
    "feedback": ("gainknob", "anomaly", "m", CYAN),
}
