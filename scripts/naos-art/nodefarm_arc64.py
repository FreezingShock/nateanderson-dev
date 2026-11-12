"""64 px button sprites and zone icons for the two arcs past Root Chamber (shared by the nodefarm_tiers64_<stat>.py stubs).

Overgrowth: Spores (Spore cellar), Mycelium (Mycel web), Pollen (Canopy hall), Bloom (Bloom core).
Descent: Basalt (Bedrock shaft), Magma (Magma line), Geodes (Geode vault), Sunstone (The buried sun).

Tier names come from lib/nodefarm/lore.ts. Each tier grows in size, parts and motion; tier 5 is the zone's namesake and also
serves as the zone icon. Same kit and rules as the other tiers64 modules (draw(t, p) -> Canvas, phase p in [0, 1)).
"""
import math

import numpy as np

from nodefarm_icon_kit import (P, X, Y, Canvas, box, disc, grow, hexagon, lin, path, poly, radial, ramp, rect, ring, shadow,
                               star4, tilted_ring, wave)

# arc palettes, dark -> light, hue-shifted like the kit's
P.update({
    "sp": ramp("#031410", "#062a24", "#0e5a4c", "#178a72", "#1fb894", "#5cf0c0", "#b4ffe4", "#effffa"),
    "my": ramp("#0c0818", "#1c1638", "#3f3470", "#5e50a0", "#7d6fc0", "#a898e8", "#d4caff", "#f6f2ff"),
    "po": ramp("#141204", "#2e2a08", "#5a520e", "#8a7e14", "#bfae1c", "#f2e44a", "#fff49a", "#fffde6"),
    "bl": ramp("#1a040e", "#3e0a22", "#7c1240", "#a81e56", "#d2306c", "#ff7aa0", "#ffb8cc", "#fff0f4"),
    "leaf": ramp("#0a1606", "#18300c", "#2c5214", "#44781c", "#64a026", "#8ccc3a", "#c4f07a"),
    "ba": ramp("#08090c", "#121418", "#20242c", "#2e3440", "#434b58", "#5e6878", "#8e99a8", "#d2d9e2"),
    "mg": ramp("#1a0602", "#3e0e04", "#7a2006", "#b03808", "#d4500e", "#ff7a1a", "#ffb04a", "#fff1b0"),
    "ge": ramp("#0e0618", "#1e0c34", "#38145e", "#5a2290", "#8a3ad0", "#b064f0", "#d6a2ff", "#f6e8ff"),
    "co": ramp("#1a1002", "#3e2604", "#80460a", "#b8660c", "#e08a10", "#ffb42a", "#ffd04a", "#fffbe0"),
})


def soft_glow(c, cx, cy, r, col, a=150):
    """Dithered round halo on empty pixels only."""
    from nodefarm_icon_kit import BAYER
    d = np.hypot(X - cx, Y - cy) / r
    m = (d < 1) & ~c.alpha & (BAYER + 0.5 < (1 - d) * 1.2)
    c.img[m] = (*P[col[0]][col[1]], a)


def mushroom(c, cx, base, rw, h, pal="sp", stem="my", spots=True, tilt=0.0):
    """A mushroom: stem, domed cap with a lit rim, gill line and pale spots."""
    sw = max(1.6, rw * 0.22)
    st = poly([(cx - sw * 1.25, base), (cx - sw + tilt, base - h), (cx + sw + tilt, base - h), (cx + sw * 1.25, base)])
    c.fill(st, 0.55 + 0.4 * (1 - lin(cx - sw, 0, cx + sw, 0)), stem, outline=stem)
    top = disc(cx + tilt, base - h, rw, rw * 0.62) & (Y < base - h + 1)
    c.fill(top, 0.25 + 0.75 * (1 - np.clip(np.hypot(X - (cx + tilt - rw * 0.35), Y - (base - h - rw * 0.4)) / (rw * 1.4), 0, 1)), pal, outline=pal)
    c.set(rect(cx + tilt - rw + 1, base - h, cx + tilt + rw - 1, base - h + 1.2) & disc(cx + tilt, base - h, rw, rw), P[pal][2])
    c.rim(top, P[pal][-1], -1, -1)
    if spots and rw >= 5:
        for j, (fx, fy) in enumerate(((-0.45, -0.25), (0.15, -0.45), (0.5, -0.15), (-0.1, -0.15))[: 2 + int(rw / 6)]):
            c.set(disc(cx + tilt + fx * rw, base - h + fy * rw * 0.62 - 0.5, max(0.8, rw * 0.11)), P["white"][2])
    return top


def spore_dots(c, p, pts, pal="sp", rise=10):
    for k, (x, y) in enumerate(pts):
        q = (p + k * 0.37) % 1.0
        yy = y - q * rise
        c.set(disc(x + math.sin(q * 6 + k) * 1.5, yy, 0.9), P[pal][7 if q < 0.5 else 5], int(255 * (1 - q * 0.6)))


# ===================================================================================================== Spores
def speck(c, p):
    """Speck: one spore drifting, glowing teal, with a faint trail."""
    y = 30 - 4 * math.sin(p * math.tau)
    x = 32 + 3 * math.sin(p * math.tau * 2)
    soft_glow(c, x, y, 13, ("sp", 4), 90)
    m = disc(x, y, 5.5)
    c.fill(m, 0.35 + 0.65 * (1 - np.clip(np.hypot(X - x + 2, Y - y + 2) / 8, 0, 1)), "sp", outline="sp")
    for k in range(8):
        a = k / 8 * math.tau + p * math.tau * 0.5
        c.set(disc(x + math.cos(a) * 6.8, y + math.sin(a) * 6.8, 0.8), P["sp"][6])
    for k in range(4):
        c.set(disc(x - 2 - k * 2.5, y + 4 + k * 2.4, 0.7), P["sp"][4], 200 - k * 40)


def puff(c, p):
    """Puff: a puffball on moss, breathing out a cloud of spores."""
    shadow(c, 32, 16, 56)
    c.fill(disc(32, 54, 18, 4), 0.5, "leaf", outline="leaf")
    g = wave(p)
    m = disc(32, 42, 12 - g * 1.2, 10 - g)
    c.fill(m, 0.3 + 0.6 * (1 - np.clip(np.hypot(X - 28, Y - 37) / 16, 0, 1)), "my", outline="my")
    c.set(disc(32, 33 + g, 2.2), P["sp"][2])
    for k in range(10):
        q = (p + k * 0.1) % 1.0
        a = -math.pi / 2 + (k - 4.5) * 0.18
        r = 3 + q * 22
        c.set(disc(32 + math.cos(a) * r, 32 + math.sin(a) * r, 1.2 - q * 0.6), P["sp"][6 if q < 0.4 else 4], int(255 * (1 - q)))


def cap1(c, p):
    """Cap: one big teal mushroom, its rim lighting up in a running loop."""
    shadow(c, 32, 18, 58)
    top = mushroom(c, 32, 57, 21, 28, "sp", "my")
    a = p * math.pi
    c.set(disc(32 - math.cos(a) * 19, 29 - math.sin(a) * 11, 1.6), P["sp"][7])
    soft_glow(c, 32, 22, 30, ("sp", 4), 60)
    spore_dots(c, p, [(20, 18), (40, 14), (30, 10)])


def ring_(c, p):
    """Ring: a fairy ring of small caps around a glowing patch, each lighting up in turn."""
    shadow(c, 32, 26, 50, 9)
    c.fill(disc(32, 48, 24, 8), 0.35, "leaf")
    c.set(disc(32, 48, 12, 3.5), P["sp"][3], 160)
    n = 7
    pts = sorted([(32 + math.cos(k / n * math.tau) * 20, 48 + math.sin(k / n * math.tau) * 7, k) for k in range(n)], key=lambda t: t[1])
    for x, y, k in pts:
        lit = int(p * n) % n == k
        mushroom(c, x, y, 5.5, 8 + (k % 3), "sp" if k % 3 else "bl", "my", spots=False)
        if lit:
            soft_glow(c, x, y - 10, 8, ("sp", 6), 160)
            c.set(disc(x, y - 10, 1.2), P["sp"][7])


def colony(c, p):
    """Colony: a cluster of caps of every size sprouting from a fallen log, spores rising."""
    shadow(c, 32, 26, 58)
    log = rect(6, 46, 58, 56) | disc(6, 51, 3, 5) | disc(58, 51, 3, 5)
    c.fill(log, 0.25 + 0.4 * (1 - lin(0, 46, 0, 56)), "eg", outline="eg")
    c.set(ring(58, 51, 3.2, 1.6, 1.6), P["eg"][5])
    for x, h, w, pal in ((14, 12, 7, "bl"), (26, 22, 12, "sp"), (42, 16, 9, "sp"), (52, 9, 5, "my"), (35, 8, 5, "bl")):
        mushroom(c, x, 47, w, h, pal, "my")
    spore_dots(c, p, [(20, 26), (30, 18), (44, 24), (36, 12), (24, 10)], rise=12)


def cellar(c, p):
    """Cellar: a stone arch with a rack inside, half eaten by teal caps, the haze glowing."""
    arch = (disc(32, 22, 26, 20) & (Y < 22)) | rect(6, 22, 58, 60)
    inner = (disc(32, 24, 19, 14) & (Y < 24)) | rect(13, 24, 51, 60)
    c.fill(arch & ~inner, 0.25 + 0.3 * (1 - lin(0, 0, 0, 60)), "stone", outline="stone")
    for y in (14, 26, 38, 50):
        c.set(rect(6, y, 13, y + 1) | rect(51, y, 58, y + 1), P["stone"][0])
    c.fill(inner, 0.12 + 0.25 * (1 - np.clip(np.hypot(X - 32, Y - 50) / 30, 0, 1)), "sp")
    f, t, s = box(c, 24, 28, 14, 30, 4, "steel", -0.15)
    for k, y in enumerate(range(31, 56, 5)):
        c.set(rect(26, y, 36, y + 1), P["steel"][0])
        c.set(rect(27, y + 2, 29, y + 3), P["sp"][7] if (int(p * 8) + k) % 3 else P["bl"][5])
    mushroom(c, 18, 60, 9, 16, "sp", "my")
    mushroom(c, 46, 60, 12, 22, "sp", "my")
    mushroom(c, 34, 30, 6, 6, "bl", "my")
    spore_dots(c, p, [(18, 40), (46, 34), (34, 20), (26, 30)], rise=14)


SPORES = [speck, puff, cap1, ring_, colony, cellar]


# ===================================================================================================== Mycelium
def thread(c, p):
    """Thread: one pale hypha curling across, a packet running along it."""
    pts = [(8 + i * 3, 34 + 10 * math.sin(i * 0.45 + 0.5) + 3 * math.sin(i * 1.3)) for i in range(17)]
    c.fill(path(pts, 2.4), 0.55, "my", outline="my")
    c.set(path([(x, y - 0.8) for x, y in pts], 1), P["my"][6])
    i = p * (len(pts) - 1)
    a, b = pts[int(i)], pts[min(int(i) + 1, len(pts) - 1)]
    x, y = a[0] + (b[0] - a[0]) * (i % 1), a[1] + (b[1] - a[1]) * (i % 1)
    soft_glow(c, x, y, 7, ("sp", 5), 170)
    c.set(disc(x, y, 1.8), P["white"][2])
    c.set(disc(*pts[0], 2.4), P["my"][5])
    c.set(disc(*pts[-1], 2.4), P["my"][5])


def strand(c, p):
    """Strand: three threads braided into one cable, light running down the braid."""
    shadow(c, 32, 14, 60)
    for k in range(3):
        pts = [(32 + 7 * math.sin(y * 0.16 + k * 2.1), y) for y in range(6, 60, 3)]
        c.fill(path(pts, 2.4), 0.4 + k * 0.15, "my", outline="my")
    q = p
    y = 6 + q * 52
    for k in range(3):
        c.set(disc(32 + 7 * math.sin(y * 0.16 + k * 2.1), y, 1.6), P["sp" if k == 0 else "my"][7])


def mat(c, p):
    """Mat: a dense pad of threads on the floor, little fruiting knobs pulsing."""
    shadow(c, 32, 26, 56)
    m = disc(32, 46, 26, 11)
    c.fill(m, 0.3 + 0.3 * (1 - lin(0, 36, 0, 57)), "my", outline="my")
    rng = np.random.default_rng(7)
    for k in range(22):
        x0, y0 = 10 + rng.random() * 44, 38 + rng.random() * 16
        c.set(path([(x0, y0), (x0 + rng.random() * 6 - 3, y0 + rng.random() * 3 - 1.5), (x0 + rng.random() * 8 - 4, y0 + rng.random() * 3)], 1) & m, P["my"][6 if k % 3 else 3])
    for k, (x, y) in enumerate(((20, 40), (34, 36), (46, 42), (28, 48), (40, 50))):
        g = wave(p, 1, k * 0.2)
        c.fill(disc(x, y - 2 - g, 2.4 + g * 0.6), 0.7 + 0.3 * g, "sp", outline="sp")


def knot(c, p):
    """Knot: a hub where six threads meet, wrapped tight and glowing, pulses arriving."""
    arms = [(32 + math.cos(a) * 28, 32 + math.sin(a) * 24) for a in np.linspace(0, math.tau, 7)[:-1] + 0.3]
    for k, (x, y) in enumerate(arms):
        pts = [(32 + (x - 32) * t + math.sin(t * 8 + k) * 1.5, 32 + (y - 32) * t) for t in np.linspace(0, 1, 10)]
        c.fill(path(pts, 2), 0.45, "my", outline="my")
        q = 1 - ((p + k / 6) % 1.0)
        c.set(disc(32 + (x - 32) * q, 32 + (y - 32) * q, 1.4), P["sp"][7])
    g = wave(p, 2)
    soft_glow(c, 32, 32, 16 + g * 3, ("my", 6), 120)
    m = disc(32, 32, 10)
    c.fill(m, 0.4 + 0.6 * (1 - np.clip(np.hypot(X - 29, Y - 29) / 13, 0, 1)), "my", outline="my")
    for k in range(3):
        c.set(ring(32, 32, 10 - k * 0.3, 9.2 - k * 0.3, 0.45 + k * 0.25) & m, P["my"][3])
    c.set(disc(32, 32, 3 + g), P["sp"][6])
    c.set(disc(32, 32, 1.4), P["white"][2])


def mesh(c, p):
    """Mesh: a small network of hubs and threads, packets hopping from hub to hub."""
    hubs = [(12, 18), (32, 12), (52, 20), (18, 40), (40, 34), (54, 50), (28, 54)]
    edges = [(0, 1), (1, 2), (0, 3), (1, 4), (2, 4), (3, 4), (4, 5), (3, 6), (6, 5), (4, 6)]
    for i, j in edges:
        (a, b), (x, y) = hubs[i], hubs[j]
        pts = [(a + (x - a) * t, b + (y - b) * t + 3 * math.sin(t * math.pi)) for t in np.linspace(0, 1, 8)]
        c.fill(path(pts, 1.6), 0.5, "my")
    for k, (i, j) in enumerate(edges[::2]):
        (a, b), (x, y) = hubs[i], hubs[j]
        t = (p * 2 + k * 0.3) % 1.0
        c.set(disc(a + (x - a) * t, b + (y - b) * t + 3 * math.sin(t * math.pi), 1.3), P[("sp", "bl", "po")[k % 3]][6])
    for k, (x, y) in enumerate(hubs):
        c.fill(disc(x, y, 4), 0.5 + 0.4 * wave(p, 1, k / 7), "my", outline="my")
        c.set(disc(x - 1, y - 1, 1.2), P["my"][7])


def web(c, p):
    """Web: a radial network of threads spun between racks, a bright hub, packets racing in and out."""
    for x in (6, 50):
        box(c, x, 22, 8, 38, 3, "steel", -0.2)
        for y in range(26, 58, 6):
            c.set(rect(x + 2, y, x + 4, y + 1), P["sp"][6] if (y // 6 + int(p * 8)) % 2 else P["my"][5])
    cx, cy = 32, 30
    spokes = [(cx + math.cos(a) * 26, cy + math.sin(a) * 22) for a in np.linspace(0, math.tau, 9)[:-1]]
    for x, y in spokes:
        c.set(path([(cx, cy), (x, y)], 1.2), P["my"][4])
    for r in (8, 14, 20):
        pts = [(cx + math.cos(a) * r * 1.15, cy + math.sin(a) * r) for a in np.linspace(0, math.tau, 9)]
        c.set(path(pts, 1), P["my"][5])
    for k, (x, y) in enumerate(spokes):
        q = (p + k / 8) % 1.0
        q = q if k % 2 else 1 - q
        c.set(disc(cx + (x - cx) * q, cy + (y - cy) * q, 1.3), P[("sp", "po", "bl")[k % 3]][6])
    g = wave(p, 2)
    soft_glow(c, cx, cy, 10 + g * 3, ("my", 6), 150)
    c.fill(disc(cx, cy, 5), 0.8, "my", outline="my")
    c.set(disc(cx, cy, 2), P["white"][2])


MYCELIUM = [thread, strand, mat, knot, mesh, web]


# ===================================================================================================== Pollen
def grain_at(c, x, y, r, rot, pal="po"):
    m = disc(x, y, r)
    c.fill(m, 0.4 + 0.6 * (1 - np.clip(np.hypot(X - x + r * 0.35, Y - y + r * 0.35) / (r * 1.5), 0, 1)), pal, outline=pal)
    for k in range(10):
        a = rot + k / 10 * math.tau
        c.set(disc(x + math.cos(a) * (r + 1.3), y + math.sin(a) * (r + 1.3), 0.7), P[pal][6])
    for k in range(4):
        a = rot * 0.5 + k / 4 * math.tau
        c.set(disc(x + math.cos(a) * r * 0.45, y + math.sin(a) * r * 0.45, 0.8), P[pal][3])
    return m


def grain(c, p):
    """Grain: one spiky gold pollen grain, slowly turning."""
    soft_glow(c, 32, 32, 22, ("po", 5), 80)
    grain_at(c, 32, 32, 13, p * math.tau / 3)


def drift(c, p):
    """Drift: grains drifting down a shaft of light."""
    shaft = poly([(18, 0), (36, 0), (54, 64), (30, 64)])
    from nodefarm_icon_kit import BAYER
    c.img[shaft & (BAYER < -0.15)] = (*P["po"][5], 90)
    for k, (x0, r) in enumerate(((22, 5), (38, 4), (30, 6), (46, 3.5))):
        q = (p + k * 0.27) % 1.0
        y = -6 + q * 76
        grain_at(c, x0 + q * 8 + math.sin(q * 6 + k) * 2, y, r, q * 4 + k)


def sprig(c, p):
    """Sprig: a green sprig in a seed tray with one gold flower, dusting pollen."""
    shadow(c, 32, 16, 58)
    c.fill(rect(16, 48, 48, 58), 0.45, "cu", outline="cu")
    c.fill(rect(16, 48, 48, 50), 0.3, "eg")
    sway = math.sin(p * math.tau) * 1.5
    stem = path([(32, 49), (31 + sway * 0.3, 38), (33 + sway, 24)], 2)
    c.fill(stem, 0.6, "leaf")
    for (x, y, rx) in ((26, 40, 6), (38, 34, 6)):
        c.fill(disc(x + sway * 0.4, y, rx, 2.6), 0.6, "leaf", outline="leaf")
    for k in range(5):
        a = k / 5 * math.tau + p
        c.fill(disc(33 + sway + math.cos(a) * 4.5, 22 + math.sin(a) * 4.5, 3), 0.8, "po", outline="po")
    c.set(disc(33 + sway, 22, 2.2), P["co"][5])
    spore_dots(c, p, [(28, 18), (38, 16), (33, 12)], "po", 10)


def bough(c, p):
    """Bough: a branch heavy with leaves and glowing seed pods that swing."""
    br = path([(4, 20), (20, 24), (36, 22), (58, 30)], 3)
    c.fill(br, 0.4, "eg", outline="eg")
    c.fill(path([(20, 24), (28, 14)], 2) | path([(36, 22), (44, 12)], 2), 0.45, "eg")
    for x, y, a in ((10, 16, -0.4), (28, 12, -0.2), (44, 10, 0.3), (52, 24, 0.4), (16, 30, 0.6), (40, 28, -0.6)):
        c.fill(disc(x, y, 6, 3.2), 0.4 + 0.4 * (1 - lin(x - 6, y - 3, x + 6, y + 3)), "leaf", outline="leaf")
    for k, x in enumerate((18, 30, 46)):
        sw = math.sin(p * math.tau + k) * 2.5
        y0 = 26
        c.set(path([(x, y0), (x + sw, y0 + 12)], 1), P["leaf"][2])
        c.fill(disc(x + sw, y0 + 16, 4, 5), 0.6 + 0.4 * wave(p, 1, k / 3), "po", outline="po")
        soft_glow(c, x + sw, y0 + 16, 8, ("po", 5), 110)


def tree(c, cx, base, h, cr, p, k=0):
    c.fill(poly([(cx - 2.5, base), (cx - 1.5, base - h), (cx + 1.5, base - h), (cx + 3, base)]), 0.45, "eg", outline="eg")
    can = disc(cx, base - h - cr * 0.3, cr, cr * 0.75) | disc(cx - cr * 0.6, base - h + 1, cr * 0.6, cr * 0.5) | disc(cx + cr * 0.6, base - h + 1, cr * 0.6, cr * 0.5)
    c.fill(can, 0.25 + 0.7 * (1 - np.clip(np.hypot(X - cx + cr * 0.4, Y - (base - h - cr * 0.8)) / (cr * 2), 0, 1)), "leaf", outline="leaf")
    c.rim(can, P["po"][5], -1, -1)
    for j in range(3):
        a = j * 2.1 + k
        c.set(disc(cx + math.cos(a) * cr * 0.6, base - h + math.sin(a) * cr * 0.3, 1), P["po"][6 if (int(p * 4) + j) % 2 else 4])


def grove(c, p):
    """Grove: three young trees on a mound, pollen lifting off the crowns."""
    shadow(c, 32, 28, 58)
    c.fill(disc(32, 58, 30, 8) & (Y < 60), 0.4, "leaf", outline="leaf")
    tree(c, 14, 54, 14, 8, p, 0)
    tree(c, 50, 54, 12, 7, p, 1)
    tree(c, 32, 56, 22, 11, p, 2)
    spore_dots(c, p, [(14, 26), (32, 14), (50, 30), (24, 20)], "po", 10)


def canopy(c, p):
    """Canopy: a tree grown out of a server rack, roots through the case, the crown full of gold light."""
    shadow(c, 32, 18, 61)
    f, t, s = box(c, 20, 40, 22, 20, 5, "steel", -0.15)
    for k, y in enumerate(range(43, 58, 4)):
        c.set(rect(22, y, 40, y + 1), P["steel"][0])
        c.set(rect(23, y + 2, 25, y + 3), P["leaf"][6] if (int(p * 8) + k) % 2 else P["po"][6])
    c.fill(path([(30, 44), (24, 52), (20, 60)], 1.6) | path([(32, 44), (40, 54)], 1.6), 0.5, "eg")
    c.fill(poly([(28, 42), (29, 22), (34, 22), (35, 42)]), 0.45, "eg", outline="eg")
    c.fill(path([(31, 28), (18, 18)], 2) | path([(33, 26), (46, 16)], 2), 0.4, "eg")
    can = disc(32, 14, 20, 11) | disc(14, 20, 10, 7) | disc(50, 19, 10, 7)
    c.fill(can, 0.2 + 0.75 * (1 - np.clip(np.hypot(X - 24, Y - 6) / 34, 0, 1)), "leaf", outline="leaf")
    c.rim(can, P["po"][6], -1, -1)
    for k in range(7):
        a = k * 0.9
        x, y = 32 + math.cos(a) * 15, 16 + math.sin(a) * 6
        c.set(disc(x, y, 1.3), P["po"][7 if (int(p * 8) + k) % 3 else 5])
    spore_dots(c, p, [(16, 10), (30, 4), (46, 8)], "po", 8)


POLLEN = [grain, drift, sprig, bough, grove, canopy]


# ===================================================================================================== Bloom
def petal_m(cx, cy, ang, ln, wd):
    ca, sa = math.cos(ang), math.sin(ang)
    u = (X - cx) * ca + (Y - cy) * sa
    w = -(X - cx) * sa + (Y - cy) * ca
    t = np.clip(u / ln, 0, 1)
    return (u >= 0) & (u <= ln) & (np.abs(w) <= wd * np.sin(math.pi * t) ** 0.8)


def flower(c, cx, cy, r, n, p, pal="bl", open_=1.0, heart="po"):
    for k in range(n):
        a = k / n * math.tau - math.pi / 2 + 0.2
        m = petal_m(cx, cy, a, r * open_, r * 0.42)
        c.fill(m, 0.35 + 0.65 * (1 - np.clip(np.hypot(X - cx, Y - cy) / (r * 1.2), 0, 1)), pal, outline=pal)
    c.fill(disc(cx, cy, r * 0.3), 0.75 + 0.25 * wave(p, 2), heart, outline=heart)


def bud(c, p):
    """Bud: a closed coral bud on a stem, swelling and easing."""
    shadow(c, 32, 10, 60)
    c.fill(path([(32, 60), (31, 40), (32, 30)], 2.4), 0.55, "leaf")
    c.fill(disc(24, 46, 7, 3) | disc(40, 42, 7, 3), 0.55, "leaf", outline="leaf")
    g = wave(p)
    m = poly([(32, 8 - g), (40 + g, 22), (36, 32), (28, 32), (24 - g, 22)])
    c.fill(m, 0.35 + 0.6 * (1 - lin(24, 8, 40, 32)), "bl", outline="bl")
    c.fill(poly([(26, 26), (32, 34), (38, 26), (36, 32), (28, 32)]), 0.5, "leaf")
    c.set(path([(32, 10), (32, 28)], 1), P["bl"][3])
    soft_glow(c, 32, 20, 16, ("bl", 5), 70 + int(60 * g))


def petal1(c, p):
    """Petal: one petal falling and turning in the air."""
    y = 6 + p * 46
    x = 32 + math.sin(p * math.tau) * 10
    a = -0.8 + math.sin(p * math.tau) * 0.9
    m = petal_m(x - math.cos(a) * 12, y - math.sin(a) * 12, a, 24, 8)
    c.fill(m, 0.4 + 0.6 * (1 - lin(x - 12, y - 8, x + 12, y + 8)), "bl", outline="bl")
    c.set(petal_m(x - math.cos(a) * 12, y - math.sin(a) * 12, a, 22, 0.8), P["bl"][3])
    c.set(disc(32, 60, 10, 2), P["ink"][0], 130)


def flower1(c, p):
    """Flower: a five-petal coral flower opening and closing a little, gold heart."""
    shadow(c, 32, 12, 60)
    c.fill(path([(32, 60), (32, 36)], 2.4), 0.55, "leaf")
    c.fill(disc(24, 50, 7, 3), 0.55, "leaf", outline="leaf")
    flower(c, 32, 26, 18, 5, p, "bl", 0.9 + 0.1 * wave(p))
    soft_glow(c, 32, 26, 26, ("bl", 5), 60)


def crown(c, p):
    """Crown: a layered bloom, outer petals deep, inner ones bright, standing up like a crown."""
    shadow(c, 32, 16, 60)
    c.fill(path([(32, 60), (32, 40)], 2.6), 0.55, "leaf")
    for k in range(7):
        a = -math.pi + (k + 0.5) / 7 * math.pi
        c.fill(petal_m(32, 38, a, 24, 7), 0.25 + 0.35 * (k % 2), "bl", outline="bl")
    for k in range(5):
        a = -math.pi + (k + 0.5) / 5 * math.pi
        c.fill(petal_m(32, 40, a, 17 + 2 * wave(p, 1, k / 5), 6), 0.6 + 0.4 * (1 - abs(k - 2) / 3), "bl", outline="bl")
    c.fill(disc(32, 38, 5, 3), 0.8, "po", outline="po")
    for k in range(5):
        a = -math.pi * (0.15 + 0.7 * k / 4)
        c.set(disc(32 + math.cos(a) * 9, 36 + math.sin(a) * 8, 1), P["po"][7])


def garden(c, p):
    """Garden: a planter of blooms in three colours, a bee-light visiting each."""
    shadow(c, 32, 26, 61)
    c.fill(rect(6, 46, 58, 60), 0.4 + 0.2 * (1 - lin(0, 46, 0, 60)), "cu", outline="cu")
    c.fill(rect(6, 46, 58, 49), 0.3, "eg")
    spots = [(14, 30, "bl", 8), (32, 22, "po", 9), (50, 30, "my", 8), (24, 38, "bl", 6), (42, 38, "sp", 6)]
    for x, y, pal, r in spots:
        c.fill(path([(x, 47), (x, y)], 1.6), 0.5, "leaf")
    for x, y, pal, r in spots:
        flower(c, x, y, r, 5, p, pal, 1.0, "po" if pal != "po" else "co")
    k = int(p * len(spots)) % len(spots)
    x, y, _, r = spots[k]
    soft_glow(c, x, y - r - 3, 6, ("po", 6), 200)
    c.set(disc(x, y - r - 3, 1.3), P["white"][2])


def bloom(c, p):
    """Bloom: the great flower open around a reactor heart, light pulsing up through the petals."""
    g = wave(p)
    soft_glow(c, 32, 30, 32, ("bl", 5), 70 + int(40 * g))
    c.fill(path([(32, 63), (33, 50), (31, 40)], 3), 0.5, "or")
    for side in (-1, 1):
        c.fill(petal_m(32, 52, math.pi * (0.95 if side < 0 else 0.05), 20, 5), 0.55, "leaf", outline="leaf")
    for k in range(8):
        a = -math.pi * (k + 0.5) / 8 - 0.0
        c.fill(petal_m(32, 32, a, 29, 8), 0.2 + 0.3 * (k % 2), "bl", outline="bl")
    for k in range(5):
        a = -math.pi * (k + 0.5) / 5
        c.fill(petal_m(32, 34, a, 21, 7.5), 0.55 + 0.45 * (1 - abs(k - 2) / 3), "bl", outline="bl")
    for a in (math.pi * 0.12, math.pi * 0.88):
        c.fill(petal_m(32, 34, a, 18, 6), 0.45, "bl", outline="bl")
    c.fill(disc(32, 33, 8, 6), 0.35, "steel", outline="steel")
    c.set(ring(32, 33, 8, 7, 0.75), P["steel"][5])
    c.fill(disc(32, 33, 5 + g, 3.6 + g * 0.7), 0.7 + 0.3 * g, "po")
    c.set(disc(31, 32, 1.6), P["white"][2])
    for k in range(3):
        q = (p + k / 3) % 1.0
        c.set(disc(32 + (k - 1) * 8 * q, 26 - q * 20, 1), P["po"][7], int(255 * (1 - q)))


BLOOM = [bud, petal1, flower1, crown, garden, bloom]


# ===================================================================================================== Basalt
def rock(c, pts, v=0.0, pal="ba"):
    m = poly(pts)
    xs, ys = [q[0] for q in pts], [q[1] for q in pts]
    c.fill(m, 0.25 + v + 0.5 * (1 - lin(min(xs), min(ys), max(xs), max(ys))), pal, outline=pal)
    c.rim(m, P[pal][6], -1, -1)
    return m


def hexcol(c, cx, top, bot, R, p=0.0, seam=None):
    """A basalt column: hexagon top, faceted sides."""
    body = rect(cx - R, top, cx + R, bot)
    left = body & (X < cx - R * 0.35)
    mid = body & (X >= cx - R * 0.35) & (X < cx + R * 0.35)
    c.fill(left, 0.55, "ba")
    c.fill(mid, 0.38, "ba")
    c.fill(body & (X >= cx + R * 0.35), 0.22, "ba")
    capm = hexagon(cx, top, R, math.pi / 6, 0.45)
    c.fill(capm, 0.8, "ba", outline="ba")
    c.outline(body | capm, "ba")
    if seam is not None:
        c.set(path([(cx - R * 0.2, top + 4), (cx + R * 0.1, (top + bot) / 2), (cx - R * 0.1, bot - 2)], 1) & body, P[seam][5 + int(wave(p) * 2)])
    return body | capm


def chip(c, p):
    """Chip: a sharp flake of basalt with a glinting edge."""
    shadow(c, 32, 14, 54)
    m = rock(c, [(16, 44), (26, 22), (44, 18), (50, 34), (40, 50), (22, 52)])
    c.set(path([(26, 22), (44, 18)], 1), P["ba"][7])
    x = 26 + (p % 1.0) * 18
    c.spark(x, 22 - (x - 26) * 0.22, 2 if (p * 8) % 2 < 1 else 1, P["white"][2])


def slab(c, p):
    """Slab: a squared slab on rollers, cut lines lit."""
    shadow(c, 32, 24, 58)
    f, t, s = box(c, 10, 26, 40, 22, 8, "ba", -0.05)
    for x in (16, 28, 40):
        c.fill(disc(x, 52, 3), 0.6, "steel", outline="steel")
    c.set(path([(10, 36), (50, 36)], 1), P["mg"][4 + int(wave(p) * 3)])


def column(c, p):
    """Column: one hexagonal basalt column, a hot seam pulsing inside."""
    shadow(c, 32, 14, 60)
    hexcol(c, 32, 14, 58, 12, p, "mg")


def strata(c, p):
    """Strata: a cut block showing bands of rock, a glint of ore in the seam."""
    shadow(c, 32, 26, 60)
    f, t, s = box(c, 8, 18, 40, 38, 8, "ba", -0.1, outline=True)
    for k, (y, v) in enumerate(((24, 0.6), (31, 0.3), (37, 0.55), (44, 0.25), (50, 0.5))):
        band = rect(8, y, 48, y + 5 + (k % 2)) & f
        c.fill(band, v, "ba")
        c.set(rect(8, y, 48, y + 1) & f, P["ba"][1])
    for k, (x, y, pal) in enumerate(((16, 34, "ge"), (34, 47, "co"), (40, 27, "sp"))):
        c.set(disc(x, y, 1.6), P[pal][6 if (int(p * 6) + k) % 2 else 4])


def bore(c, p):
    """Bore: a drill head boring down into rock, chips flying."""
    shadow(c, 32, 26, 62)
    rock(c, [(4, 44), (60, 40), (62, 63), (2, 63)], -0.05)
    c.fill(rect(26, 4, 38, 18), 0.45, "steel", outline="steel")
    c.fill(rect(29, 0, 35, 6), 0.6, "brass", outline="brass")
    bit = poly([(22, 18), (42, 18), (32, 46)])
    c.fill(bit, 0.4 + 0.4 * (1 - lin(22, 18, 42, 18)), "steel", outline="steel")
    for k in range(4):
        y = 20 + ((k * 7 + p * 28) % 26)
        hw = 10 * (1 - (y - 18) / 28)
        c.set(path([(32 - hw, y), (32 + hw, y + 3)], 1) & bit, P["steel"][1])
    for k in range(6):
        a = math.pi * (1.1 + 0.8 * ((k * 0.37 + p) % 1.0))
        r = 6 + ((p * 3 + k * 0.4) % 1.0) * 14
        c.set(disc(32 + math.cos(a) * r, 44 + math.sin(a) * r * 0.6, 1), P["mg" if k % 2 else "ba"][6])
    soft_glow(c, 32, 46, 8, ("mg", 5), 140)


def bedrock(c, p):
    """Bedrock: a cluster of basalt columns, a molten seam running up the tallest."""
    shadow(c, 32, 28, 62)
    for cx, top, R in ((14, 26, 8), (50, 22, 9), (40, 34, 8), (24, 36, 8)):
        hexcol(c, cx, top, 60, R)
    hexcol(c, 32, 8, 60, 10, p, "mg")
    soft_glow(c, 32, 30, 16, ("mg", 4), 70)
    q = p
    c.set(disc(31, 58 - q * 46, 1.4), P["mg"][7])


BASALT = [chip, slab, column, strata, bore, bedrock]


# ===================================================================================================== Magma
def lava(c, m, p, k=0.0, lo=0.3):
    v = lo + (1 - lo) * (0.5 + 0.5 * np.sin(X * 0.4 + Y * 0.25 - p * math.tau + k) * np.cos(Y * 0.3 + p * math.tau))
    c.fill(m, v, "mg")


def ember(c, p):
    """Ember: a glowing coal, cracks breathing light, a spark lifting off."""
    g = wave(p)
    soft_glow(c, 32, 36, 22, ("mg", 5), 60 + int(70 * g))
    m = rock(c, [(18, 44), (22, 28), (36, 24), (46, 32), (44, 46), (28, 50)], -0.2)
    cracks = path([(22, 34), (30, 38), (38, 32)], 1.4) | path([(30, 38), (34, 46)], 1.2) | path([(36, 28), (38, 32), (44, 36)], 1)
    c.set(cracks & m, P["mg"][5 + int(g * 2)])
    q = p
    c.set(disc(34 + math.sin(q * 6) * 2, 24 - q * 20, 1.2), P["mg"][7], int(255 * (1 - q)))


def vent(c, p):
    """Vent: a crack in the ground puffing hot gas, the rim glowing."""
    shadow(c, 32, 24, 58, 4)
    m = rock(c, [(6, 50), (20, 40), (44, 40), (58, 50), (54, 58), (10, 58)], -0.1)
    c.fill(disc(32, 44, 9, 3), 0.6 + 0.4 * wave(p, 2), "mg")
    for k in range(4):
        q = (p + k / 4) % 1.0
        r = 3 + q * 9
        c.set(disc(32 + math.sin(q * 5 + k) * 4, 40 - q * 34, r, r * 0.8), P["ba"][5 - int(q * 3)], int(200 * (1 - q)))


def seep(c, p):
    """Seep: magma bleeding out of a split boulder, pooling at its foot."""
    shadow(c, 32, 26, 58)
    rock(c, [(8, 54), (12, 26), (28, 14), (30, 54)], -0.05)
    rock(c, [(34, 54), (36, 16), (52, 22), (58, 54)], 0.0)
    gap = rect(29, 18, 35, 54) & ~disc(32, 14, 3)
    lava(c, gap, p)
    pool = disc(32, 56, 14 + wave(p) * 2, 4)
    lava(c, pool, p, 1.0)
    c.outline(pool, "mg")


def flow(c, p):
    """Flow: a lava river winding between rocks, crust plates riding it."""
    riv = np.abs(X - (32 + 10 * np.sin(Y * 0.12))) < 7 + Y * 0.08
    rock(c, [(0, 0), (20, 0), (14, 30), (24, 64), (0, 64)], -0.1)
    rock(c, [(44, 0), (64, 0), (64, 64), (50, 64), (42, 30)], -0.05)
    lava(c, riv & ~c.alpha, p)
    for k in range(4):
        y = (k * 16 + p * 64) % 64
        x = 32 + 10 * math.sin(y * 0.12)
        c.fill(disc(x + (k % 2) * 3 - 1.5, y, 3, 1.6), 0.3, "ba")


def lake(c, p):
    """Lake: a crater pool of magma with a crust skin cracking and a bubble popping."""
    shadow(c, 32, 30, 54, 8)
    rim = disc(32, 42, 30, 14)
    c.fill(rim, 0.35, "ba", outline="ba")
    c.rim(rim, P["ba"][6], -1, -1)
    pool = disc(32, 43, 24, 10)
    lava(c, pool, p)
    c.fill(pool & (np.sin(X * 0.5) * np.cos(Y * 0.7) > 0.55), 0.25, "ba")
    q = p
    if q < 0.7:
        c.set(ring(26, 42, 1.5 + q * 5, 0.5 + q * 4, 0.6), P["mg"][7])
    soft_glow(c, 32, 30, 20, ("mg", 5), 60)


def caldera(c, p):
    """Caldera: a small volcano throwing up fire, lava running down its flank."""
    shadow(c, 32, 30, 62)
    hill = poly([(2, 62), (24, 22), (40, 22), (62, 62)])
    c.fill(hill, 0.25 + 0.45 * (1 - lin(2, 22, 62, 62)), "ba", outline="ba")
    c.fill(disc(32, 22, 8, 3), 0.8, "mg")
    run = (np.abs(X - (30 - (Y - 22) * 0.25 + 2 * np.sin(Y * 0.3))) < 2.2) & (Y > 22) & (Y < 60)
    lava(c, run, p)
    g = wave(p, 2)
    plume = poly([(26, 22), (32, 2 + 4 * g), (38, 22)])
    c.fill(plume & ~c.alpha, 0.6 + 0.4 * (1 - lin(32, 0, 32, 22)), "mg")
    soft_glow(c, 32, 14, 18, ("mg", 5), 90)
    for k in range(5):
        q = (p + k / 5) % 1.0
        a = -math.pi / 2 + (k - 2) * 0.5
        c.set(disc(32 + math.cos(a) * q * 26, 20 + math.sin(a) * q * 22 + q * q * 18, 1.2), P["mg"][7 if q < 0.5 else 5])


MAGMA = [ember, vent, seep, flow, lake, caldera]


# ===================================================================================================== Geodes
def crystal(c, cx, cy, ang, ln, wd, pal="ge", v=0.0):
    ca, sa = math.cos(ang), math.sin(ang)
    nx, ny = -sa, ca
    a, b = (cx + nx * wd, cy + ny * wd), (cx - nx * wd, cy - ny * wd)
    a2, b2 = (a[0] + ca * ln * 0.7, a[1] + sa * ln * 0.7), (b[0] + ca * ln * 0.7, b[1] + sa * ln * 0.7)
    tip = (cx + ca * ln, cy + sa * ln)
    full = poly([a, a2, tip, b2, b])
    lit = poly([(cx, cy), a2 if nx < 0 else b2, tip])
    c.fill(full, 0.35 + v, pal, outline=pal)
    c.fill(lit & full, 0.75 + v, pal)
    return full


def pebble(c, p):
    """Pebble: a plain grey stone with a violet glint in a chip."""
    shadow(c, 32, 16, 52)
    m = disc(32, 38, 17, 13)
    c.fill(m, 0.3 + 0.55 * (1 - np.clip(np.hypot(X - 26, Y - 32) / 22, 0, 1)), "ba", outline="ba")
    c.fill(disc(38, 34, 4, 3), 0.7, "ge")
    if (p * 8) % 4 < 1:
        c.spark(39, 33, 2, P["white"][2])


def nodule(c, p):
    """Nodule: a lumpy round stone, a hairline crack leaking violet light."""
    shadow(c, 32, 20, 58)
    m = disc(32, 36, 22, 20) | disc(20, 44, 10) | disc(44, 26, 9)
    c.fill(m, 0.25 + 0.55 * (1 - np.clip(np.hypot(X - 24, Y - 26) / 30, 0, 1)), "ba", outline="ba")
    cr = path([(18, 24), (28, 34), (26, 42), (36, 52)], 1.2) & m
    c.set(cr, P["ge"][5 + int(wave(p) * 2)])
    soft_glow(c, 28, 38, 14, ("ge", 5), int(50 + 60 * wave(p)))


def druse(c, p):
    """Druse: a stone split open, a crust of small violet points inside."""
    shadow(c, 32, 22, 58)
    shell = disc(32, 38, 24, 20)
    c.fill(shell, 0.3, "ba", outline="ba")
    inner = disc(32, 38, 18, 14)
    c.fill(inner, 0.15, "ge")
    for k in range(14):
        a = k / 14 * math.tau
        x, y = 32 + math.cos(a) * 16, 38 + math.sin(a) * 12
        crystal(c, x, y, a + math.pi, 6 + (k % 3) * 2, 2, "ge", 0.05 * (k % 2))
    k = int(p * 14)
    a = k / 14 * math.tau
    c.spark(32 + math.cos(a) * 10, 38 + math.sin(a) * 7, 2, P["white"][2])


def cavity(c, p):
    """Cavity: half a geode on its back, a bowl of big crystals catching light."""
    shadow(c, 32, 28, 60)
    bowl = disc(32, 36, 28, 22) & (Y > 30)
    c.fill(bowl, 0.3 + 0.3 * lin(0, 30, 0, 58), "ba", outline="ba")
    lip = disc(32, 36, 28, 8)
    c.fill(lip, 0.2, "ge", outline="ba")
    c.set(ring(32, 36, 28, 25, 8 / 28), P["ba"][5])
    for k in range(9):
        x = 10 + k * 5.5
        h = 8 + 6 * math.sin(k * 1.3) ** 2
        crystal(c, x, 38, -math.pi / 2 + (k - 4) * 0.12, h, 2.2, "ge" if k % 4 else "sp")
    t = p
    c.spark(10 + t * 44, 26 + 4 * math.sin(t * 7), 2, P["white"][2])


def vault(c, p):
    """Vault: a great geode cut open on its stand, crystal walls lit from within."""
    shadow(c, 32, 26, 62)
    c.fill(rect(22, 54, 42, 62), 0.4, "steel", outline="steel")
    shell = disc(32, 30, 27, 25)
    c.fill(shell, 0.3, "ba", outline="ba")
    inner = disc(32, 30, 21, 19)
    c.fill(inner, 0.12 + 0.3 * (1 - np.clip(np.hypot(X - 32, Y - 30) / 22, 0, 1)), "ge")
    for k in range(18):
        a = k / 18 * math.tau
        crystal(c, 32 + math.cos(a) * 19, 30 + math.sin(a) * 17, a + math.pi, 7 + (k % 3) * 2.5, 2.4, "ge" if k % 5 else "sp", 0.05)
    g = wave(p)
    soft_glow(c, 32, 30, 8 + g * 3, ("ge", 7), 200)
    c.set(disc(32, 30, 2 + g), P["white"][2])


def cathedral(c, p):
    """Cathedral: crystal spires rising in a cluster, light running up the tallest."""
    shadow(c, 32, 28, 62)
    c.fill(disc(32, 58, 28, 6), 0.3, "ba", outline="ba")
    spires = [(-0.5, 28, 5, "ge"), (0.45, 30, 5, "ge"), (-0.25, 40, 6, "ge"), (0.2, 44, 6.5, "ge"), (0, 54, 8, "ge"), (-0.8, 18, 4, "sp"), (0.8, 20, 4, "sp")]
    for ang, ln, wd, pal in sorted(spires, key=lambda s: -abs(s[0])):
        crystal(c, 32 + ang * 14, 58, -math.pi / 2 + ang * 0.6, ln, wd, pal)
    y = 58 - p * 52
    c.set(disc(32, y, 1.8), P["white"][2])
    soft_glow(c, 32, y, 6, ("ge", 7), 160)


GEODES = [pebble, nodule, druse, cavity, vault, cathedral]


# ===================================================================================================== Core
def spark1(c, p):
    """Spark: a white-gold spark, flaring and settling."""
    g = wave(p, 2)
    soft_glow(c, 32, 32, 16 + g * 6, ("co", 5), 120)
    c.fill(star4(32, 32, 14 + g * 6, 3), 0.8, "co", outline="co")
    c.fill(disc(32, 32, 4), 1.0, "co")
    c.set(disc(32, 32, 2), P["white"][2])


def ingot(c, p):
    """Ingot: a bar still glowing from the pour, heat shimmering off the top."""
    shadow(c, 32, 22, 54)
    f, t, s = box(c, 12, 34, 34, 14, 8, "co", 0.05)
    c.fill(t, 0.85 + 0.15 * wave(p), "co")
    for k in range(3):
        q = (p + k / 3) % 1.0
        x = 22 + k * 8
        c.set(path([(x + math.sin(q * 6) * 1.5, 26 - q * 18), (x + math.sin(q * 6 + 1) * 1.5, 22 - q * 18)], 1), P["co"][6], int(200 * (1 - q)))


def furnace(c, p):
    """Furnace: a squat furnace, its open mouth roaring gold, sparks spat out."""
    shadow(c, 32, 26, 61)
    body = poly([(10, 60), (14, 18), (50, 18), (54, 60)])
    c.fill(body, 0.25 + 0.4 * (1 - lin(10, 18, 54, 60)), "ba", outline="ba")
    for y in range(24, 58, 7):
        c.set(rect(12, y, 52, y + 1) & body, P["ba"][1])
    c.fill(rect(26, 2, 38, 18), 0.4, "ba", outline="ba")
    mouth = disc(32, 46, 11, 9) & (Y < 54)
    g = wave(p, 2)
    c.fill(mouth, 0.55 + 0.45 * (1 - np.clip(np.hypot(X - 32, Y - 50) / 12, 0, 1)) * (0.8 + 0.2 * g), "co")
    soft_glow(c, 32, 46, 18, ("co", 5), 110)
    for k in range(3):
        q = (p + k / 3) % 1.0
        c.set(disc(32 + (k - 1) * 10 * q, 46 + q * 14 - q * q * 4, 1), P["co"][7])


def mantle(c, p):
    """Mantle: a cutaway globe, rock crust over the glowing layers down to the bright middle."""
    shadow(c, 32, 22, 60)
    g = disc(32, 32, 26)
    c.fill(g, 0.3 + 0.4 * (1 - np.clip(np.hypot(X - 24, Y - 24) / 34, 0, 1)), "ba", outline="ba")
    cut = g & (X > 32) & (Y < 32)
    c.img[cut] = 0
    for r, pal, v in ((24, "mg", 0.5), (16, "co", 0.6), (8, "co", 0.95)):
        c.fill(disc(32, 32, r) & (X >= 32) & (Y <= 32), v + 0.1 * wave(p), pal)
    c.set(path([(32, 6), (32, 32), (58, 32)], 1), P["ba"][6])
    soft_glow(c, 40, 24, 16, ("co", 5), 70)


def star(c, p):
    """Star: a small sun, the corona flickering in loops."""
    g = wave(p)
    for k in range(10):
        a = k / 10 * math.tau + p * 0.6
        ln = 22 + 6 * math.sin(k * 2.7 + p * math.tau * 2)
        c.fill(path([(32 + math.cos(a) * 14, 32 + math.sin(a) * 14), (32 + math.cos(a + 0.15) * ln, 32 + math.sin(a + 0.15) * ln)], 2), 0.7, "co")
    soft_glow(c, 32, 32, 28, ("co", 5), 90)
    s = disc(32, 32, 15 + g)
    c.fill(s, 0.55 + 0.45 * (1 - np.clip(np.hypot(X - 28, Y - 28) / 20, 0, 1)), "co", outline="co")
    c.set(disc(28, 28, 4), P["white"][2])


def core(c, p):
    """Core: the white-gold sun held in a cage of tilted rings and clamps, arcs leaping to the clamps."""
    g = wave(p)
    soft_glow(c, 32, 32, 30, ("co", 5), 80)
    back, front = tilted_ring(32, 32, 27, 9, -12, 2.2)
    c.set(back & ~front, P["steel"][3])
    s = disc(32, 32, 14 + g)
    c.fill(s, 0.6 + 0.4 * (1 - np.clip(np.hypot(X - 28, Y - 28) / 18, 0, 1)), "co", outline="co")
    c.set(disc(28, 28, 3.5), P["white"][2])
    vr, vf = tilted_ring(32, 32, 6, 25, 0, 2.2)
    c.set(vr & ~s, P["steel"][4])
    c.set(back & front, P["steel"][5])
    for k, a in enumerate((-12, 168)):
        x = 32 + math.cos(math.radians(a)) * 27
        y = 32 + math.sin(math.radians(a)) * 27 * 9 / 27
        c.fill(rect(x - 3, y - 3, x + 3, y + 3), 0.6, "steel", outline="steel")
        if int(p * 8) % 4 == k * 2:
            pts = [(32 + (x - 32) * t + (0.5 - ((t * 37 + p * 11) % 1)) * 4, 32 + (y - 32) * t) for t in np.linspace(0.45, 0.95, 6)]
            c.set(path(pts, 1), P["white"][2])


CORE = [spark1, ingot, furnace, mantle, star, core]


ARCS = {"spores": SPORES, "mycelium": MYCELIUM, "pollen": POLLEN, "bloom": BLOOM,
        "basalt": BASALT, "magma": MAGMA, "geodes": GEODES, "sunstone": CORE}


def make(stat):
    fns = ARCS[stat]

    def draw(t, p):
        c = Canvas()
        fns[t](c, p)
        return c.finish()

    def icon(p):
        c = Canvas()
        fns[5](c, p)
        return c.finish()

    return draw, icon
