"""Quartz (Crystal vault) button sprites at 64 px: Shard, Crystal, Cluster, Lattice, Geode, Cavern, plus the zone icon.
Palette: violet quartz with rose highlights, grey stone, white glints."""
import math

import numpy as np

from nodefarm_icon_kit import (Canvas, P, X, Y, disc, lin, line, path, poly, radial, rect, rotp, shadow, star4, wave)


def crystal(c, cx, base, w, h, v=0.0, lean=0.0, pal="qz"):
    """Hex prism crystal standing on `base`, pointed tip, three visible faces shaded left-light, right-dark."""
    tipx = cx + lean
    shoulder = base - h * 0.72
    left = poly([(cx - w / 2, base), (cx - w / 2 + lean * 0.7, shoulder), (tipx, base - h), (cx - w * 0.08 + lean * 0.75, shoulder + 1), (cx - w * 0.1, base)])
    mid = poly([(cx - w * 0.1, base), (cx - w * 0.08 + lean * 0.75, shoulder + 1), (tipx, base - h), (cx + w * 0.18 + lean * 0.75, shoulder + 1), (cx + w * 0.16, base)])
    right = poly([(cx + w * 0.16, base), (cx + w * 0.18 + lean * 0.75, shoulder + 1), (tipx, base - h), (cx + w / 2 + lean * 0.7, shoulder), (cx + w / 2, base)])
    c.fill(left, 0.72 + v + 0.15 * lin(0, base - h, 0, base), pal)
    c.fill(mid, 0.5 + v + 0.15 * lin(0, base - h, 0, base), pal)
    c.fill(right, 0.25 + v + 0.1 * lin(0, base - h, 0, base), pal)
    m = left | mid | right
    c.outline(m, pal)
    c.set(line(cx - w / 2 + 1 + lean * 0.7, shoulder + 2, cx - w / 2 + 1, base - 2, 1) & left, P[pal][-1])
    return m


def glint(c, m, p, k=1.0, w=1.2):
    pos = -10 + ((p * k) % 1.0) * 100
    c.set(m & (np.abs((X * 0.6 + Y) - pos) < w), P["white"][2])


def rock(c, cx, cy, rx, ry, v=0.0):
    m = disc(cx, cy, rx, ry) & (Y < cy + ry * 0.55)
    c.fill(m, 0.25 + v + 0.45 * (1 - lin(cx - rx, cy - ry, cx + rx, cy + ry)), "stone", outline="stone")
    return m


def shard(c, p):
    shadow(c, 32, 10, 52)
    m = crystal(c, 32, 51, 10, 24, lean=4)
    glint(c, m, p)
    if 0.4 < p < 0.6:
        c.spark(38, 26, 1, P["white"][2])


def crystal_t(c, p):
    shadow(c, 32, 12, 56)
    rock(c, 32, 55, 13, 5)
    m = crystal(c, 32, 54, 15, 40, lean=1)
    glint(c, m, p)
    c.glow(m, P["qz"][4], 2, int(50 + 70 * wave(p)), 1)


def cluster(c, p):
    shadow(c, 32, 21, 58)
    rock(c, 32, 56, 22, 7)
    ms = []
    for (cx, w, h, lean, v) in [(20, 10, 26, -5, -0.05), (44, 10, 24, 5, -0.05), (27, 12, 36, -2, 0.0), (38, 12, 32, 3, 0.02), (32, 13, 44, 0, 0.06)]:
        ms.append(crystal(c, cx, 55, w, h, v, lean, "qz" if cx != 38 else "rose"))
    allm = ms[0] | ms[1] | ms[2] | ms[3] | ms[4]
    glint(c, allm, p, 1.0)
    for k, (x, y) in enumerate([(14, 26), (50, 22), (40, 14)]):
        if int(p * 3) == k:
            c.spark(x, y, 2, P["white"][2])


def lattice(c, p):
    """Lattice: a turning cube of crystal nodes joined by glowing bonds."""
    shadow(c, 32, 22, 60)
    a = math.pi / 6 + 2 * math.pi * p / 4  # quarter turn per loop: the cube is symmetric, so it loops cleanly
    pts = []
    for x in (-1, 1):
        for y in (-1, 1):
            for z in (-1, 1):
                X3 = x * math.cos(a) - z * math.sin(a)
                Z3 = x * math.sin(a) + z * math.cos(a)
                Y3 = y * 0.95 + Z3 * 0.28
                pts.append((32 + X3 * 15, 32 + Y3 * 15, Z3))
    edges = [(i, j) for i in range(8) for j in range(i + 1, 8) if bin(i ^ j).count("1") == 1]
    for i, j in sorted(edges, key=lambda e: pts[e[0]][2] + pts[e[1]][2]):
        back = pts[i][2] + pts[j][2] < 0
        m = line(pts[i][0], pts[i][1], pts[j][0], pts[j][1], 1.4 if back else 2.0)
        c.set(m, P["qz"][3 if back else 5])
    # centre node
    c.fill(disc(32, 32, 4.5), 0.95, "rose", outline="qz")
    for (x, y, z) in sorted(pts, key=lambda q: q[2]):
        r = 3.2 + 0.9 * z
        c.fill(disc(x, y, r), 0.35 + 0.25 * z + 0.4 * (1 - radial(x - 1, y - 1, r * 1.6)), "qz", outline="qz")
    q = (p * 2) % 1.0
    i, j = edges[int(p * 2 * 3) % len(edges)]
    x, y = pts[i][0] + (pts[j][0] - pts[i][0]) * q, pts[i][1] + (pts[j][1] - pts[i][1]) * q
    c.set(disc(x, y, 1.3), P["white"][2])


def geode(c, p):
    """Geode: a split stone, the hollow lined with crystal teeth glowing from inside."""
    shadow(c, 32, 25, 59)
    shell = disc(32, 36, 26, 21)
    c.fill(shell, 0.2 + 0.5 * (1 - lin(6, 15, 58, 57)), "stone", outline="stone")
    band = shell & ~disc(32, 36, 22, 17)
    c.fill(band & ((np.floor(np.hypot(X - 32, (Y - 36) * 1.2)) % 3) == 0), 0.55, "stone")
    hollow = disc(32, 36, 19, 14.5)
    c.fill(hollow, 0.08 + 0.35 * (1 - radial(32, 38, 18)), "qz")
    pulse = wave(p)
    for k in range(18):
        ang = 2 * math.pi * k / 18
        bx, by = 32 + 19 * math.cos(ang), 36 + 14.5 * math.sin(ang)
        tx, ty = 32 + (9 + 2 * (k % 3)) * math.cos(ang), 36 + (7 + 1.5 * (k % 3)) * math.sin(ang)
        nx, ny = -math.sin(ang) * 2.4, math.cos(ang) * 2.4
        tooth = poly([(bx + nx, by + ny), (tx, ty), (bx - nx, by - ny)])
        c.fill(tooth & hollow, 0.4 + 0.45 * (1 - (k % 4) / 4) + 0.15 * pulse, "qz" if k % 5 else "rose")
    core = disc(32, 37, 5 + pulse, 3.8 + pulse)
    c.fill(core, 0.9, "rose")
    c.set(disc(31, 36, 1.2), P["white"][2])
    for k, (x, y) in enumerate([(22, 30), (41, 41), (36, 27)]):
        if int(p * 3) == k:
            c.spark(x, y, 1, P["white"][2])


def cavern(c, p):
    """Cavern: a cave mouth in a stone hill, spires of quartz inside, light breathing out of it."""
    shadow(c, 32, 30, 61)
    hill = poly([(1, 60), (6, 34), (16, 18), (30, 8), (44, 12), (56, 24), (62, 42), (63, 60)])
    c.fill(hill, 0.2 + 0.55 * (1 - lin(4, 8, 60, 60)), "stone", outline="stone")
    c.set(hill & ((np.floor(X * 0.5 + Y) % 7) == 0), P["stone"][1])
    mouth = poly([(14, 60), (18, 40), (26, 28), (36, 26), (46, 34), (51, 60)])
    glow = wave(p)
    c.fill(mouth, 0.05 + (0.35 + 0.15 * glow) * (1 - lin(32, 24, 32, 62)), "qz")
    for (cx, w, h, lean) in [(22, 7, 18, -2), (30, 9, 27, 0), (38, 8, 22, 2), (45, 6, 14, 3), (26, 5, 12, -3)]:
        m = crystal(c, cx, 60, w, h, 0.05, lean, "qz" if cx != 38 else "rose")
        glint(c, m, (p + cx * 0.01) % 1.0)
    for (cx, h) in [(24, 7), (33, 10), (42, 6)]:  # stalactites
        c.fill(poly([(cx - 2.5, 28 + (cx == 33) * -2), (cx, 28 + h), (cx + 2.5, 28 + (cx == 33) * -2)]) & mouth, 0.3, "stone")
    for k in range(5):
        q = (p + k / 5) % 1.0
        x = 20 + k * 6 + 2 * math.sin(q * 6 + k)
        y = 52 - q * 30
        c.set(disc(x, y, 0.7), P["qz"][7] if q < 0.5 else P["qz"][5], int(255 * (1 - q * 0.6)))


DRAW = [shard, crystal_t, cluster, lattice, geode, cavern]


def draw(t, p):
    c = Canvas()
    DRAW[t](c, p)
    return c.finish()


def icon(p):
    """Zone icon: a three-crystal cluster with a rose heart, a glint climbing the faces."""
    c = Canvas()
    shadow(c, 32, 20, 59)
    rock(c, 32, 57, 20, 6)
    m = crystal(c, 19, 56, 12, 28, -0.04, -5) | crystal(c, 45, 56, 12, 30, -0.02, 5, "rose") | crystal(c, 32, 56, 16, 50, 0.06, 0)
    glint(c, m, p)
    c.glow(m, P["qz"][4], 2, int(40 + 80 * wave(p)), 1)
    return c.finish()
