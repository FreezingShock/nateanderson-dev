"""Node Farm era scenery for the Overgrowth arc past Root Chamber, drawn in colour and in layers like the deep eras.

Overgrowth, eras 15..18: 15 Cellar (Spore Cellar, Spores), 16 Web (Mycel Web, Mycelium), 17 Canopy (Canopy Hall,
Pollen), 18 Bloom (Bloom Core, Bloom). The roots that met node zero in Root Chamber keep growing, up through the farm,
and the farm turns into a living one.
Descent, eras 19..22: 19 Shaft (Bedrock Shaft, Basalt), 20 Magma (Magma Line, Magma), 21 Geode (Geode Vault, Geodes),
22 Core (The Core, Core). The farm follows its roots down instead, to the heat at the bottom.

Uses the kit in nodefarm-scenes-deep.py (View, Layer, noise, the far / near / fx / detail split, the 480-wide seamless
tile and the output files), so read that script's docstring first. Each era keeps to its zone's ramp plus a couple of
accents, and keeps the busy parts below row 70 (the page fades the top of the stage).

Run:  python3 scripts/naos-art/nodefarm-scenes-arc.py            (all eight)
      python3 scripts/naos-art/nodefarm-scenes-arc.py 15 17       (just those eras)
Then run node scripts/nodefarm/stamp-art.mjs so the CSS picks up the new files.
Set NF_PREVIEW_DIR to also write an enlarged contact sheet per era there.
"""
import importlib.util
import math
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("nodefarm_scenes_deep", HERE / "nodefarm-scenes-deep.py")
K = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(K)

RAMPS, View, Layer, noise, rnd, over = K.RAMPS, K.View, K.Layer, K.noise, K.rnd, K.over
WW, WH, FRAMES, TAU = K.WW, K.WH, K.FRAMES, K.TAU
starfield, twinkles, hills, below = K.starfield, K.twinkles, K.hills, K.below
for _k in ("sp", "my", "po", "bl"):
    assert _k in RAMPS, f"ramp {_k} missing from nodefarm-icons.py"


def petal(v, cx, cy, ang, ln, wd):
    """A pointed oval from (cx, cy) outward along ang: length ln, half-width wd."""
    ca, sa = math.cos(ang), math.sin(ang)
    dx, dy = v.dx(cx), v.wy - cy
    u = dx * ca + dy * sa
    w = -dx * sa + dy * ca
    t = np.clip(u / ln, 0, 1)
    return (u >= 0) & (u <= ln) & (np.abs(w) <= wd * np.sin(math.pi * t) ** 0.8)


def crystal(v, cx, cy, ang, ln, wd, side=False):
    """A crystal point from (cx, cy) along ang: straight sides to 70% of ln, then a tip. side=True gives the lit half."""
    ca, sa = math.cos(ang), math.sin(ang)
    nx, ny = -sa, ca
    pts = [(cx + nx * wd, cy + ny * wd), (cx + ca * ln * 0.7 + nx * wd, cy + sa * ln * 0.7 + ny * wd), (cx + ca * ln, cy + sa * ln)]
    if side:
        pts += [(cx, cy)]
    else:
        pts += [(cx + ca * ln * 0.7 - nx * wd, cy + sa * ln * 0.7 - ny * wd), (cx - nx * wd, cy - ny * wd)]
    return v.poly(pts)


def cap(L, v, x, base, rw, h, rp, stem="my", dots=True, seed=0):
    """A mushroom: stem from base up h, a domed cap rw wide with a lit rim, gills underneath and pale spots."""
    sw = max(1.5, rw * 0.16)
    st = v.poly([(x - sw * 1.3, base), (x - sw, base - h), (x + sw, base - h), (x + sw * 1.3, base)])
    L.fill(st, 0.45 + 0.45 * v.lin(x - sw, 0, x + sw, 0), stem, 0.9, 1, 4)
    top = v.disc(x, base - h, rw, rw * 0.62) & (v.wy < base - h + 1)
    L.fill(top, 0.2 + 0.8 * v.radial(x - rw * 0.35, base - h - rw * 0.45, rw * 1.25), rp, 0.9, 1, 4)
    L.edge_top(top, rp, 4)
    gill = v.disc(x, base - h + 1, rw * 0.96, 2.2) & (v.wy >= base - h + 1)
    L.fill(gill, 0.3, rp, 0.6, 0, 1)
    if rw >= 8:
        for j in range(-int(rw * 0.8), int(rw * 0.8) + 1, 3):
            L.shade(v.line(x, base - h + 1, x + j, base - h + 2.5, 1) & gill, rp, 2)
    if dots:
        for j in range(max(1, int(rw / 5))):
            a = 0.35 + rnd(seed, x, j) * 2.4
            r = 0.35 + rnd(seed, x, j, 1) * 0.5
            L.shade(v.disc(x + math.cos(a) * rw * r, base - h - math.sin(a) * rw * 0.5 * r - 1, 1.1 if rw > 10 else 0.6), "wh", 4)
    return top


def rack(L, v, x0, y0, w, h, led="sp", seed=0, moss=None):
    r = v.rect(x0, y0, x0 + w, y0 + h)
    L.fill(r, 0.22 + 0.2 * v.lin(x0, 0, x0 + w, 0), "gr", 0.9, 0, 2)
    L.outline(r, "gr", 0)
    for y in range(int(y0 + 4), int(y0 + h - 2), 6):
        L.shade(v.rect(x0 + 2, y, x0 + w - 2, y + 1), "gr", 0)
        if rnd(seed, x0, y) < 0.7:
            L.shade(v.rect(x0 + 3, y + 2, x0 + 5, y + 3), led, 3)
        if rnd(seed, x0, y, 1) < 0.35:
            L.shade(v.rect(x0 + 7, y + 2, x0 + 8, y + 3), "bl" if led != "bl" else "po", 3)
    if moss:
        L.speckle(r, np.clip(1 - (v.wy - y0) / (h * 0.5), 0, 1) * 0.45, moss, 1)
        L.edge_top(r, moss, 2)
        for j in range(int(w / 4)):                                       # moss tufts hanging over the top edge
            L.shade(v.rect(x0 + 1 + j * 4, y0 - 1, x0 + 3 + j * 4, y0 + 1 + int(rnd(seed, x0, j, 7) * 4)), moss, 2)
    return r


# =====================================================================================================================
# 15 Cellar: the old stone cellar under the farm, where the roots first broke through. Teal mushrooms the size of racks
# grow out of the floor and the spore haze glows; the racks down here still run, half buried in moss.
# =====================================================================================================================
SC_FOG = noise(151, 100, 4, 0.55, 1.8)
SC_STONE = noise(152, 26, 3, 0.6)
SC_FLOOR = 204
SC_CAPS = [(40, SC_FLOOR + 2, 24, 44, "sp"), (74, SC_FLOOR + 4, 11, 20, "sp"), (148, SC_FLOOR + 1, 15, 30, "bl"),
           (300, SC_FLOOR + 3, 30, 56, "sp"), (346, SC_FLOOR + 5, 10, 16, "my"), (420, SC_FLOOR + 2, 18, 34, "sp"),
           (446, SC_FLOOR + 6, 8, 12, "bl"), (178, SC_FLOOR + 6, 7, 10, "sp")]
SC_RACKS = [(92, 132, 26, 72), (122, 150, 20, 54), (372, 140, 24, 64)]


def cellar_far(v):
    L = Layer(v)
    stone = v.sample(SC_STONE)
    # back wall: barrel vaults of dark stone, one per 120 px, with pillars between
    wall = v.wy < SC_FLOOR
    L.fill(wall, 0.12 + 0.18 * stone * v.vgrad(40, SC_FLOOR), "gr", 0.9, 0, 1)
    for k in range(4):
        cx = k * 120 + 60
        inner = (v.disc(cx, 110, 50, 54) & (v.wy < 110)) | v.rect(cx - 50, 110, cx + 50, SC_FLOOR)
        L.fill(inner, 0.1 + 0.25 * v.sample(SC_FOG) * v.vgrad(70, SC_FLOOR), "sp", 0.9, 0, 1)
        L.shade(v.ring(cx, 110, 50, 1, 54) & (v.wy < 110), "gr", 2)
        # stone courses on the pillars
        pil = v.rect(cx + 50, 56, cx + 70, SC_FLOOR)
        for y in range(60, SC_FLOOR, 9):
            L.shade(v.rect(cx + 50, y, cx + 70, y + 1) & pil, "gr", 0)
            L.shade(v.rect(cx + 60 + (4 if (y // 9) % 2 else -4), y, cx + 61 + (4 if (y // 9) % 2 else -4), y + 9) & pil, "gr", 0)
        # far racks, dim, inside each vault
        for j in range(3):
            x0 = cx - 40 + j * 28
            h = 40 + rnd(153, k, j) * 30
            r = v.rect(x0, SC_FLOOR - h, x0 + 16, SC_FLOOR)
            L.fill(r, 0.18, "gr", 0.6, 0, 1)
            for y in range(int(SC_FLOOR - h + 3), SC_FLOOR - 2, 5):
                if rnd(154, k, j, y) < 0.5:
                    L.shade(v.rect(x0 + 2, y, x0 + 3, y + 1), "sp", 2)
    # spore haze in the vaults
    fog = v.sample(SC_FOG)
    L.gas(np.clip(fog * 1.3 - 0.45, 0, 1) * np.clip((v.wy - 70) / 120, 0, 1), "sp", 0, 2, wall)
    # roots hanging from the vault crowns
    rng = np.random.default_rng(155)
    for k in range(22):
        x, y = rng.random() * WW, 52.0
        pts = [(x, y)]
        end = 80 + rng.random() * 70
        while y < end:
            x += (rng.random() - 0.5) * 5
            y += 5
            pts.append((x, y))
        L.shade(v.path(pts, 2), "or", 0)
        L.shade(v.path(pts, 1), "or", 1)
        if k % 3 == 0:
            L.shade(v.disc(pts[-1][0], pts[-1][1] + 1, 1.2), "sp", 3)
    return L


def cellar_near(v):
    L = Layer(v)
    stone = v.sample(SC_STONE)
    fog = v.sample(SC_FOG)
    # flagstone floor with puddles that catch the teal light
    fl = v.wy >= SC_FLOOR
    L.fill(fl, 0.1 + 0.3 * (1 - v.vgrad(SC_FLOOR, WH)) + (stone - 0.5) * 0.2, "gr", 0.9, 0, 2)
    for y in (214, 228, 246):
        L.shade(v.rect(0, y, WW, y + 1) & fl, "gr", 0)
    for x in range(0, WW, 34):
        L.shade(v.line(x, SC_FLOOR, x + (x - 240) * 0.3, WH, 1) & fl, "gr", 0)
    pud = fl & (fog > 0.8) & (v.wy > SC_FLOOR + 10)
    L.fill(pud, 0.2 + (fog - 0.8) * 2.5, "sp", 0.9, 0, 2)
    L.edge_top(pud, "sp", 3)
    L.edge_top(fl, "sp", 2)
    # moss creeping out from the mushrooms across the floor
    for x, base, rw, h, rp in SC_CAPS:
        L.speckle(fl & (v.wy < base + 8), v.radial(x, base, rw * 2.2, 8) * 0.9, "sp", 1)
    # racks, mossed over
    for x0, y0, w, h in SC_RACKS:
        rack(L, v, x0, y0, w, h, "sp", 156, "lime")
    # a cable run along the wall, sagging, with roots wound round it
    pts = [(x, 120 + 8 * math.sin(TAU * x / 120)) for x in np.linspace(0, WW, 61)]
    L.shade(v.path(pts, 2), "gr", 1)
    L.shade(v.path([(x, y - 0.6) for x, y in pts], 1), "gr", 3)
    for k in range(0, 60, 2):
        x, y = pts[k]
        L.shade(v.px(x, y + (1 if k % 4 else -1)), "or", 2)
    # the stair down on the right, with a caged lamp
    for k in range(6):
        L.fill(v.rect(454 + k * 4, SC_FLOOR - 4 - k * 6, 480, SC_FLOOR - k * 6), 0.3 + 0.1 * k, "gr", 0.9, 0, 3)
        L.edge_top(v.rect(454 + k * 4, SC_FLOOR - 4 - k * 6, 480, SC_FLOOR - k * 6), "gr", 4)
    L.shade(v.rect(468, 136, 469, 150), "gr", 2)
    L.fill(v.rect(464, 150, 473, 160), 0.8, "po", 0.9, 2, 4)
    L.shade(v.rect(464, 150, 473, 160) & ((np.floor(v.wx) % 3) == 0), "gr", 1)
    # mushrooms, back to front by size
    for x, base, rw, h, rp in sorted(SC_CAPS, key=lambda c: c[2]):
        cap(L, v, x, base, rw, h, rp, "my", True, 157)
    # small clusters at the feet of the big ones
    for k in range(18):
        x = rnd(158, k) * WW
        b = SC_FLOOR + 4 + rnd(158, k, 1) * 10
        cap(L, v, x, b, 2.5 + rnd(158, k, 2) * 2.5, 3 + rnd(158, k, 3) * 4, ["sp", "bl", "my"][k % 3], "my", False)
    return L


def cellar_fx(v, f):
    L = Layer(v)
    # spores rise in slow spirals out of every big cap
    for k in range(64):
        c = SC_CAPS[k % len(SC_CAPS)]
        x0 = c[0] + (rnd(1501, k) - 0.5) * c[2] * 1.6
        t = (f + int(rnd(1501, k, 1) * FRAMES)) % FRAMES
        y = c[1] - c[3] - 4 - t * 3 - rnd(1501, k, 2) * 40
        x = x0 + math.sin(t * 0.8 + k) * 2
        L.shade(v.px(x, y), "sp" if k % 4 else "bl", 4 if t < 3 else (3 if t < 6 else 2))
    # the cap rims glow in turn, a light running round the edge
    for i, (x, base, rw, h, rp) in enumerate(SC_CAPS):
        if rw < 10:
            continue
        a = ((f + i * 3) % FRAMES) / FRAMES * math.pi
        L.shade(v.disc(x - math.cos(a) * rw * 0.92, base - h - math.sin(a) * rw * 0.45, 1.5), rp, 4)
        halo = v.radial(x, base - h, rw * 1.6, rw) * (v.wy < base - h - 2)
        if (f + i) % 4 < 2:
            L.speckle(halo > 0, halo * 0.35, rp, 3)
    # puddle ripples
    for k, (x, y) in enumerate(((60, 236), (210, 250), (330, 230), (400, 258))):
        r = 1 + ((f + k * 2) % FRAMES) * 1.4
        L.shade(v.ring(x, y, r * 2, 1, r * 0.6) & (v.wy > SC_FLOOR + 4), "sp", 3 if r < 6 else 2)
    # rack lights and the lamp flicker
    for x0, y0, w, h in SC_RACKS:
        y = int(y0 + 4 + 6 * ((f * 3 + x0) % max(1, int(h / 6) - 1)))
        L.shade(v.rect(x0 + 3, y + 2, x0 + 5, y + 3), "wh", 4)
    if f not in (3, 4):
        L.speckle(v.disc(468, 155, 14, 12), v.radial(468, 155, 14, 12) * 0.45, "po", 3)
    return L


# =====================================================================================================================
# 16 Web: a cavern where the mycelium has become the network. Pale threads run between knots of light like cables
# between switches, the racks are wired into it, and packets travel along the strands.
# =====================================================================================================================
MW_FLOOR = 206
MW_GLOW = noise(161, 80, 4, 0.55, 1.5)
MW_MAT = noise(162, 30, 3, 0.6, 2.0)


def _web():
    """Hubs (x, y, r) and strands between them (wiggly polylines). The near web sits low; the far web fills the cave."""
    rng = np.random.default_rng(163)
    hubs = [(36, 150, 5), (104, 118, 7), (170, 160, 4), (238, 132, 9), (300, 170, 4), (352, 112, 6), (414, 150, 5), (470, 126, 4)]
    strands = []
    for i, (x, y, r) in enumerate(hubs):
        for j in (i + 1, i + 2):
            x2, y2, _ = hubs[j % len(hubs)]
            if j >= len(hubs):
                x2 += WW
            if j == i + 2 and rng.random() < 0.5:
                continue
            n = 18
            sag = 10 + rng.random() * 16
            ph = rng.random() * TAU
            pts = [(x + (x2 - x) * t + math.sin(t * 9 + ph) * 2, y + (y2 - y) * t + sag * math.sin(math.pi * t) + math.sin(t * 13 + ph) * 1.5) for t in np.linspace(0, 1, n)]
            strands.append(pts)
        # strands down to the floor, like roots
        for k in range(2):
            fx = x + (rng.random() - 0.5) * 50
            pts = [(x + (fx - x) * t + math.sin(t * 7 + k) * 3, y + (MW_FLOOR + 2 - y) * t) for t in np.linspace(0, 1, 12)]
            strands.append(pts)
    return hubs, strands


MW_HUBS, MW_STRANDS = _web()
MW_RACKS = [(18, 160, 20, 46), (196, 166, 22, 40), (386, 156, 22, 50)]


def web_far(v):
    L = Layer(v)
    glow = v.sample(MW_GLOW)
    # the cave: black with a faint violet glow where the far web is thick
    L.gas(np.clip(glow * 1.2 - 0.5, 0, 1) * np.clip((v.wy - 50) / 110, 0, 1), "my", 0, 1)
    # the far web: a fine net of strands between many small knots
    rng = np.random.default_rng(164)
    knots = [(rng.random() * WW, 60 + rng.random() * 130) for _ in range(46)]
    for i, (x, y) in enumerate(knots):
        for j in range(2):
            x2, y2 = knots[int(rng.random() * len(knots))]
            if abs(x2 - x) > 90 or abs(y2 - y) > 70:
                continue
            pts = [(x + (x2 - x) * t, y + (y2 - y) * t + 4 * math.sin(math.pi * t)) for t in np.linspace(0, 1, 8)]
            L.shade(v.path(pts, 1), "my", 1)
        L.shade(v.disc(x, y, 1.2), "my", 2 if i % 3 else 3)
    # stalactites
    for k in range(16):
        x = k * 30 + rnd(165, k) * 12
        ln = 20 + rnd(165, k, 1) * 40
        L.fill(v.poly([(x - 6, 40), (x + 6, 40), (x + 1, 40 + ln), (x - 1, 40 + ln)]), 0.2, "gr", 0.9, 0, 1)
    L.fill(v.wy < 44 + 4 * np.sin(v.wx * 0.1), 0.15, "gr", 0.9, 0, 1)
    return L


def web_near(v):
    L = Layer(v)
    mat = v.sample(MW_MAT)
    # fungal mat floor, soft and lumpy, glowing faintly where it is thick
    fl = v.wy >= MW_FLOOR + 3 * np.sin(v.wx * 0.07) + 2 * np.sin(v.wx * 0.23)
    L.fill(fl, 0.15 + 0.35 * mat * (1 - v.vgrad(MW_FLOOR, WH)), "my", 0.9, 0, 2)
    L.edge_top(fl, "my", 3)
    L.speckle(fl, np.clip(mat - 0.55, 0, 1) * 1.6 * (1 - v.vgrad(MW_FLOOR, WH)), "my", 3)
    # rock pillars that frame the tile
    for x, w in ((140, 14), (330, 18)):
        half = w + 4 * np.sin(v.wy * 0.08 + x) + 6 * np.clip((v.wy - 170) / 40, 0, 1)
        pil = (np.abs(v.dx(x)) < half) & (v.wy < MW_FLOOR + 4)
        L.fill(pil, 0.2 + 0.2 * mat, "gr", 0.9, 0, 2)
        L.shade(pil & ~np.roll(pil, -1, 1), "my", 1)
    # racks wired into the web
    for x0, y0, w, h in MW_RACKS:
        rack(L, v, x0, y0, w, h, "my", 166)
    # the strands: thick near the hubs, a lit core line
    for k, pts in enumerate(MW_STRANDS):
        L.shade(v.path(pts, 3), "my", 1)
        L.shade(v.path(pts, 1.4), "my", 3)
        L.shade(v.path([(x, y - 0.7) for x, y in pts], 1), "my", 4 if k % 3 == 0 else 3)
    # hubs: knots of light wrapped in threads
    for x, y, r in MW_HUBS:
        L.fill(v.disc(x, y, r + 2), 0.2, "my", 0.9, 0, 2)
        L.fill(v.disc(x, y, r), 0.4 + 0.6 * v.radial(x - r * 0.3, y - r * 0.3, r * 1.3), "my", 0.9, 2, 4)
        for a in range(4):
            L.shade(v.ring(x, y, r + 1, 1, r * 0.5 + a) & (v.dx(x) * (1 if a % 2 else -1) > 0), "my", 2)
        L.shade(v.disc(x, y, max(1, r * 0.3)), "sp" if x % 2 else "bl", 4)
    # small mushrooms at the pillar feet
    for k in range(12):
        x = (140, 330)[k % 2] + (rnd(167, k) - 0.5) * 40
        cap(L, v, x, MW_FLOOR + 3 + rnd(167, k, 1) * 6, 3 + rnd(167, k, 2) * 3, 4 + rnd(167, k, 3) * 5, "my", "my", False)
    return L


def web_fx(v, f):
    L = Layer(v)
    # packets run along the strands, two per strand at different speeds
    for k, pts in enumerate(MW_STRANDS):
        n = len(pts) - 1
        for lap in range(1 if k % 2 else 2):
            t = (((f + k * 3) % FRAMES) / FRAMES + lap * 0.5) % 1.0
            if k % 3 == 1:
                t = 1 - t
            pos = t * n
            j = min(int(pos), n - 1)
            u = pos - j
            (a, b), (c, d) = pts[j], pts[j + 1]
            x, y = a + (c - a) * u, b + (d - b) * u
            col = ("sp", "bl", "po")[k % 3]
            L.shade(v.disc(x, y, 1.5), col, 4)
            L.shade(v.px(x, y), "wh", 4)
    # hubs flash when a packet lands
    for i, (x, y, r) in enumerate(MW_HUBS):
        if (f + i * 3) % FRAMES == 0:
            h = v.radial(x, y, r * 3)
            L.speckle(h > 0, h * 0.8, "my", 4)
        elif (f + i * 3) % FRAMES == 1:
            L.shade(v.ring(x, y, r * 2.2, 1), "my", 3)
    # the far knots twinkle
    twinkles(L, f, 1601, 30, 60, 190, ["my", "sp"], 2, None, 0)
    # spores falling from the ceiling
    for k in range(24):
        x = rnd(1602, k) * WW
        t = (f + int(rnd(1602, k, 1) * FRAMES)) % FRAMES
        y = 50 + rnd(1602, k, 2) * 120 + t * 2
        L.shade(v.px(x + math.sin(t + k) * 1.5, y), "my", 3)
    return L


# =====================================================================================================================
# 17 Canopy: the roots reach daylight. A greenhouse hall of iron and glass, with trees grown out of the old racks, gold
# pollen hanging in the light shafts, and a morning sky drifting past the panes.
# =====================================================================================================================
CH_FLOOR = 210
CH_CLOUD = noise(171, 90, 4, 0.55, 2.4)
CH_LEAF = noise(172, 14, 3, 0.6)
CH_TREES = [(70, 52, 34), (250, 72, 46), (410, 58, 36)]  # x, canopy height above the rack, canopy radius
CH_RACK_H = 46


def canopy_far(v):
    L = Layer(v)
    # morning sky: deep teal at the top to warm gold at the horizon
    sky = v.wy < CH_FLOOR
    t = v.vgrad(20, CH_FLOOR)
    L.fill(sky & (t < 0.55), 0.2 + t * 0.6, "sg", 0.9, 0, 2)
    L.fill(sky & (t >= 0.55), 0.2 + (t - 0.55) * 1.4, "cu", 0.9, 0, 2)
    # clouds lit from below
    c = v.sample(CH_CLOUD)
    band = np.clip(1 - np.abs(v.wy - 120) / 60, 0, 1)
    L.gas(np.clip((c - 0.45) * 2.4, 0, 1) * band, "cu", 2, 4, sky)
    L.gas(np.clip((c - 0.7) * 3, 0, 1) * band, "wh", 2, 4, sky)
    # a far tree line
    tl = below(v, hills(173, 182, 6, (3, 7, 17))) & sky
    L.fill(tl, 0.2 + 0.2 * v.sample(CH_LEAF), "lime", 0.9, 0, 2)
    L.edge_top(tl, "lime", 3)
    return L


def canopy_near(v):
    L = Layer(v)
    leaf = v.sample(CH_LEAF)
    # the greenhouse frame: an arch per 160 px, mullions and transoms over the sky
    for k in range(3):
        cx = k * 160 + 80
        L.shade(v.ring(cx, 112, 80, 2, 70) & (v.wy < 112), "gr", 2)
        L.shade(v.ring(cx, 112, 80, 1, 70) & (v.wy < 112) & (v.wy > 50), "gr", 4)
        L.shade(v.ring(cx, 112, 60, 1, 52) & (v.wy < 112), "gr", 2)
        for a in np.linspace(0.15, math.pi - 0.15, 7):
            L.shade(v.line(cx + math.cos(a) * 60, 112 - math.sin(a) * 52, cx + math.cos(a) * 80, 112 - math.sin(a) * 70, 1), "gr", 2)
    for x in range(0, WW, 40):
        L.shade(v.rect(x, 112, x + 2, CH_FLOOR), "gr", 2)
        L.shade(v.rect(x, 112, x + 1, CH_FLOOR), "gr", 3)
    for y in (112, 150):
        L.shade(v.rect(0, y, WW, y + 2), "gr", 2)
    # a glint on some panes
    for k in range(12):
        x = k * 40 + 6
        if rnd(174, k) < 0.6:
            L.shade(v.line(x, 160, x + 8, 152, 1), "wh", 3)
    # the floor: a tiled walk between beds of soil
    fl = v.wy >= CH_FLOOR
    L.fill(fl, 0.2 + 0.2 * (1 - v.vgrad(CH_FLOOR, WH)), "eg", 0.9, 0, 2)
    for x in range(0, WW, 16):
        L.shade(v.line(x, CH_FLOOR, x + (x - 240) * 0.5, WH, 1) & fl, "eg", 0)
    L.edge_top(fl, "lime", 2)
    # planters along the walk
    for k in range(10):
        x = k * 48 + 20
        L.fill(v.rect(x, CH_FLOOR - 8, x + 14, CH_FLOOR), 0.4, "cu", 0.9, 0, 3)
        L.edge_top(v.rect(x, CH_FLOOR - 8, x + 14, CH_FLOOR), "cu", 4)
        for j in range(4):
            L.fill(v.disc(x + 3 + j * 3, CH_FLOOR - 10 - rnd(175, k, j) * 3, 3, 2.5), 0.4 + 0.4 * rnd(175, k, j, 1), "lime", 0.9, 1, 4)
        if k % 3 == 0:
            L.shade(v.disc(x + 7, CH_FLOOR - 14, 1.6), "bl", 4)
    # trees grown out of racks: the rack is the pot, the trunk splits it, the canopy fills the arch
    for x, ch, cr in CH_TREES:
        y0 = CH_FLOOR - CH_RACK_H
        rack(L, v, x - 14, y0, 28, CH_RACK_H, "lime", 176, "lime")
        trunk = v.poly([(x - 4, y0 + 10), (x - 3, y0 - ch + 10), (x + 3, y0 - ch + 10), (x + 5, y0 + 10)])
        L.fill(trunk, 0.3 + 0.4 * v.lin(x - 4, 0, x + 5, 0), "eg", 0.9, 0, 3)
        L.shade(v.line(x, y0 + 6, x - 9, y0 + 18, 2) | v.line(x, y0 + 6, x + 10, y0 + 20, 2), "eg", 1)   # roots through the rack
        for a in (-0.9, -0.4, 0.5, 1.0):                                   # branches
            L.shade(v.line(x, y0 - ch * 0.4, x + math.sin(a) * cr * 0.8, y0 - ch + 8 - abs(a) * 4, 2), "eg", 2)
        can = np.zeros_like(trunk)
        for j in range(9):
            a = j / 9 * TAU
            bx = x + math.cos(a) * cr * 0.55
            by = y0 - ch + math.sin(a) * cr * 0.28
            can |= v.disc(bx, by, cr * 0.5, cr * 0.36)
        can |= v.disc(x, y0 - ch - 4, cr * 0.6, cr * 0.4)
        L.fill(can, 0.15 + 0.6 * v.radial(x - cr * 0.3, y0 - ch - cr * 0.4, cr * 1.4) + (leaf - 0.5) * 0.4, "lime", 0.9, 0, 4)
        L.edge_top(can, "po", 3)
        L.outline(can, "lime", 0, True)
        # fruit: little glowing pods
        for j in range(6):
            a = rnd(177, x, j) * TAU
            L.shade(v.disc(x + math.cos(a) * cr * 0.6, y0 - ch + math.sin(a) * cr * 0.3 + 6, 1.3), "po", 4)
    # hanging baskets on chains
    for x, ln in ((150, 40), (330, 30), (470, 46)):
        L.shade(v.rect(x, 112, x + 1, 112 + ln), "gr", 3)
        L.fill(v.disc(x, 116 + ln, 6, 4) & (v.wy > 114 + ln), 0.45, "cu", 0.9, 0, 3)
        for j in range(5):
            L.shade(v.line(x - 5 + j * 2.5, 116 + ln, x - 6 + j * 3, 126 + ln + j % 2 * 4, 1), "lime", 2 + j % 2)
    return L


def canopy_fx(v, f):
    L = Layer(v)
    # light shafts through the panes, slanted, breathing slowly
    k = [0.32, 0.36, 0.4, 0.42, 0.4, 0.36, 0.32, 0.3][f]
    for x in (40, 200, 360):
        sh = v.poly([(x, 112), (x + 26, 112), (x + 96, CH_FLOOR), (x + 60, CH_FLOOR)], 2)
        L.speckle(sh, k * (0.5 + 0.5 * v.vgrad(112, CH_FLOOR)), "po", 3)
    # pollen drifting down and sideways through the shafts
    for j in range(70):
        x = rnd(1701, j) * WW
        t = (f + int(rnd(1701, j, 1) * FRAMES)) % FRAMES
        y = 70 + rnd(1701, j, 2) * 130 + t * 1.5
        L.shade(v.px(x + t * 1.2 + math.sin(t + j) * 1.2, y), "po", 4 if (t + j) % 3 else 3)
    # canopies sway: a handful of leaf pixels flick lighter on the windward side
    for i, (x, ch, cr) in enumerate(CH_TREES):
        y0 = CH_FLOOR - CH_RACK_H
        for j in range(10):
            a = rnd(1702, i, j) * TAU
            px = x + math.cos(a) * cr * 0.7 + (1 if f % 4 < 2 else -1)
            py = y0 - ch + math.sin(a) * cr * 0.34
            L.shade(v.px(px, py), "lime", 4)
    # birds? no. a drone of pollinator light crosses the hall each loop
    bx = (f / FRAMES) * WW
    L.shade(v.disc(bx, 96 + 6 * math.sin(f), 1.5), "po", 4)
    L.shade(v.px(bx - 3, 96 + 6 * math.sin(f)), "po", 2)
    return L


# =====================================================================================================================
# 18 Bloom: the end of the roots. A flower as tall as the farm opens over a still pool, with the reactor that feeds it
# in its heart. Petals fall into the water, and the dusk sky glows coral behind it.
# =====================================================================================================================
BL_X, BL_Y = 240, 128      # the flower's heart
BL_POOL = 204
BL_SKY = noise(181, 100, 4, 0.55, 2.0)
BL_PETALS = [(a, 92 - 14 * abs(math.sin(a)), 22) for a in np.linspace(-math.pi * 0.95, -math.pi * 0.05, 9)]


def bloom_far(v):
    L = Layer(v)
    sky = v.wy < BL_POOL
    t = v.vgrad(30, BL_POOL)
    L.fill(sky & (t < 0.5), 0.15 + t * 0.7, "qz", 0.9, 0, 2)
    L.fill(sky & (t >= 0.5), 0.2 + (t - 0.5) * 1.6, "bl", 0.9, 0, 3)
    starfield(L, 182, 90, 20, 110, ["wh", "bl", "my"])
    c = v.sample(BL_SKY)
    band = np.clip(1 - np.abs(v.wy - 150) / 40, 0, 1)
    L.gas(np.clip((c - 0.5) * 2.4, 0, 1) * band, "bl", 2, 4, sky)
    # distant hills of blossom
    for seed, base, rp, lo, hi in ((183, 184, "qz", 0, 2), (184, 194, "bl", 0, 2)):
        m = below(v, hills(seed, base, 5, (2, 5, 13))) & sky
        L.fill(m, 0.2 + 0.4 * (1 - v.vgrad(base - 10, BL_POOL)), rp, 0.9, lo, hi)
        L.edge_top(m, rp, hi + 1)
    for k in range(26):                                                 # far blossoms dotting the hills
        x = rnd(188, k) * WW
        y = 188 + rnd(188, k, 1) * 12
        L.shade(v.disc(x, y, 1.6, 1.2), "bl" if k % 3 else "po", 4 if k % 2 else 3)
    return L


def bloom_near(v):
    L = Layer(v)
    # the pool, mirroring the coral sky with ripples of darker water
    pool = v.wy >= BL_POOL
    rip = 0.5 + 0.5 * np.sin(v.wy * 0.9 + np.sin(v.wx * 0.05) * 3)
    L.fill(pool, 0.1 + 0.3 * (1 - v.vgrad(BL_POOL, WH)) * rip, "bl", 0.9, 0, 2)
    L.shade(v.rect(0, BL_POOL, WW, BL_POOL + 1), "bl", 3)
    # reflection of the flower in the pool: a dim smear under it
    for k in range(14):                                                 # broken horizontal streaks, wider near the bank
        y = BL_POOL + 3 + k * 4
        hw = 70 * (1 - k / 16) * (0.7 + 0.3 * rnd(187, k))
        L.shade(v.rect(BL_X - hw, y, BL_X + hw, y + 1) & ((np.floor(v.wx / 3) + k) % 4 != 0), "bl" if k % 3 else "po", 3 if k < 6 else 2)
    # lily pads with small blooms
    for k in range(12):
        x = rnd(185, k) * WW
        if abs(((x - BL_X + WW / 2) % WW) - WW / 2) < 40:
            continue
        y = BL_POOL + 8 + rnd(185, k, 1) * 50
        r = 4 + rnd(185, k, 2) * 6
        pad = v.disc(x, y, r, r * 0.35) & ~petal(v, x, y, -0.3, r, r * 0.3)
        L.fill(pad, 0.3 + 0.4 * v.radial(x - r * 0.3, y - 1, r), "lime", 0.9, 0, 3)
        if k % 3 == 0:
            for a in (-2.2, -1.57, -0.9):
                L.fill(petal(v, x, y - 1, a, r * 0.6, r * 0.22), 0.8, "bl", 0.9, 2, 4)
    # the stem: a braid of roots rising from the water to the heart
    for k in range(3):
        pts = [(BL_X + math.sin(t * 7 + k * 2.1) * 6, BL_POOL + 6 - t * (BL_POOL + 6 - BL_Y - 10)) for t in np.linspace(0, 1, 24)]
        L.shade(v.path(pts, 4), "or", 1)
        L.shade(v.path([(x - 1, y) for x, y in pts], 1), "or", 3)
    # leaves off the stem
    for side, y in ((-1, 184), (1, 170)):
        L.fill(petal(v, BL_X, y, math.pi * (0.92 if side < 0 else 0.08) - 0.25 * side, 60, 12), 0.25 + 0.5 * v.lin(BL_X, 0, BL_X + side * 44, 0), "lime", 0.9, 0, 4)
        L.shade(v.line(BL_X, y, BL_X + side * 40, y - 8, 1), "lime", 1)
    # back petals (darker), then front petals, opening upward like a crown
    for i, (a, ln, wd) in enumerate(BL_PETALS):
        m = petal(v, BL_X, BL_Y, a, ln * 1.05, wd * 1.1)
        L.fill(m, 0.15 + 0.4 * v.radial(BL_X, BL_Y, ln), "qz" if i % 2 else "bl", 0.9, 0, 2)
    for i, (a, ln, wd) in enumerate(BL_PETALS):
        if i % 2 == 0:
            continue
        aa = a + 0.22
        m = petal(v, BL_X, BL_Y + 4, aa, ln * 0.82, wd)
        L.fill(m, 0.25 + 0.75 * v.radial(BL_X, BL_Y, ln * 0.9), "bl", 0.9, 1, 4)
        L.outline(m, "bl", 0, False)
        L.shade(v.line(BL_X, BL_Y + 4, BL_X + math.cos(aa) * ln * 0.7, BL_Y + 4 + math.sin(aa) * ln * 0.7, 1) & m, "bl", 2)
    # lower petals curling down toward the water
    for a in (math.pi * 0.15, math.pi * 0.85):
        m = petal(v, BL_X, BL_Y + 6, a, 58, 16)
        L.fill(m, 0.3 + 0.5 * v.radial(BL_X, BL_Y + 6, 40), "bl", 0.9, 0, 3)
        L.outline(m, "bl", 0, True)
    # the heart: a reactor ring holding a bright core
    L.fill(v.disc(BL_X, BL_Y, 20, 15), 0.3, "gr", 0.9, 0, 3)
    L.shade(v.ring(BL_X, BL_Y, 19, 1, 14), "gr", 4)
    for k in range(8):
        a = k / 8 * TAU
        L.shade(v.rect(BL_X + math.cos(a) * 16 - 1, BL_Y + math.sin(a) * 12 - 1, BL_X + math.cos(a) * 16 + 1, BL_Y + math.sin(a) * 12 + 1), "po", 3)
    L.fill(v.disc(BL_X, BL_Y, 11, 8), 0.4 + 0.6 * v.radial(BL_X - 2, BL_Y - 2, 10), "po", 0.9, 2, 4)
    # stamens around the heart
    for k in range(9):
        a = -math.pi * (0.1 + 0.8 * k / 8)
        x2, y2 = BL_X + math.cos(a) * 34, BL_Y + math.sin(a) * 30
        L.shade(v.line(BL_X + math.cos(a) * 12, BL_Y + math.sin(a) * 9, x2, y2, 1), "po", 2)
        L.shade(v.disc(x2, y2, 1.6), "po", 4)
    # a ring of old racks half sunk in the pool, the last of the farm
    for x0, h in ((40, 30), (84, 22), (370, 26), (420, 34)):
        rack(L, v, x0, BL_POOL - h + 8, 20, h, "bl", 186, "lime")
        L.clear(v.rect(x0 - 1, BL_POOL + 2, x0 + 22, BL_POOL + 9))
        L.fill(v.rect(x0 - 1, BL_POOL + 2, x0 + 22, BL_POOL + 9), 0.15, "bl", 0.9, 0, 1)
    return L


def bloom_fx(v, f):
    L = Layer(v)
    # the core pulses and throws light up through the petals
    r = 20 + 6 * math.sin(TAU * f / FRAMES)
    h = v.radial(BL_X, BL_Y, r * 1.6, r) * (v.dist(BL_X, BL_Y) > 11)
    L.speckle(h > 0, h * 0.85, "po", 4)
    # petals fall in slow arcs into the pool
    for k in range(14):
        x0 = BL_X + (rnd(1801, k) - 0.5) * 220
        t = (f + int(rnd(1801, k, 1) * FRAMES)) % FRAMES
        y = 80 + rnd(1801, k, 2) * 60 + t * 9
        if y > BL_POOL:
            continue
        x = x0 + math.sin(t * 0.9 + k) * 6
        L.fill(petal(v, x, y, 0.6 + t * 0.5, 4, 1.4), 0.8, "bl", 0.9, 2, 4)
    # rings where they land
    for k, x in enumerate((180, 300, 120, 360)):
        rr = 1 + ((f + k * 2) % FRAMES) * 1.6
        L.shade(v.ring(x, BL_POOL + 10 + k * 6, rr * 2, 1, rr * 0.5) & (v.wy > BL_POOL), "bl", 3 if rr < 7 else 2)
    # pollen lifting from the stamens
    for k in range(20):
        a = -math.pi * (0.1 + 0.8 * rnd(1802, k))
        t = (f + int(rnd(1802, k, 1) * FRAMES)) % FRAMES
        x = BL_X + math.cos(a) * (26 + t * 4)
        y = BL_Y + math.sin(a) * (22 + t * 4) - t * 2
        L.shade(v.px(x, y), "po", 4 if t < 5 else 2)
    twinkles(L, f, 1803, 24, 20, 110, ["wh", "bl"])
    return L


# =====================================================================================================================
# 19 Shaft: the Descent arc starts where the roots stop. A bored shaft through banded basalt, a lift cage on its cables,
# work lamps strung down the walls and seams of ore catching the light.
# =====================================================================================================================
BS_ROCK = noise(191, 30, 4, 0.6, 3.0)
BS_X = 240
BS_W = 92  # half width of the shaft at the floor


def shaft_far(v):
    L = Layer(v)
    rock = v.sample(BS_ROCK)
    # strata: bands of basalt that wobble across the tile
    band = (v.wy + 8 * np.sin(v.wx * TAU / WW * 2) + rock * 10) / 14
    L.fill(np.ones_like(rock, bool), 0.08 + 0.18 * (np.floor(band) % 3) / 2 + (rock - 0.5) * 0.2, "ba", 0.9, 0, 1)
    L.shade((np.abs(band - np.round(band)) < 0.05), "ba", 0)
    # the far shaft wall glows faintly from below
    L.speckle(np.ones_like(rock, bool), v.vgrad(120, 270) * 0.35 * v.radial(BS_X, 270, 200, 160), "mg", 1)
    # ore seams
    for k in range(40):
        x, y = rnd(192, k) * WW, 60 + rnd(192, k, 1) * 180
        L.shade(v.line(x, y, x + 3 + rnd(192, k, 2) * 8, y + (rnd(192, k, 3) - 0.5) * 4, 1), ["co", "ge", "sp"][k % 3], 3)
    return L


def shaft_near(v):
    L = Layer(v)
    rock = v.sample(BS_ROCK)
    # the shaft: near walls left and right of a wide opening that narrows as it falls
    edge = BS_W + 30 - (v.wy - 40) * 0.12 + 10 * (rock - 0.5) + 4 * np.sin(v.wy * 0.2)
    wall = np.abs(v.dx(BS_X)) > edge
    band = (v.wy + rock * 8) / 10
    L.fill(wall, 0.12 + 0.22 * (np.floor(band) % 2) + (rock - 0.5) * 0.3, "ba", 0.9, 0, 2)
    for k in range(30):                                                 # crystals and ore studding the walls
        x, y = rnd(194, k) * WW, 50 + rnd(194, k, 1) * 210
        if abs(((x - BS_X + WW / 2) % WW) - WW / 2) < edge_at(y) + 6:
            continue
        L.fill(crystal(v, x, y, -math.pi / 2 + (rnd(194, k, 2) - 0.5), 6 + rnd(194, k, 3) * 6, 2), 0.7, ["ge", "co", "sp"][k % 3], 0.9, 1, 4)
    L.shade(wall & ~np.roll(wall, 1, 1) & (v.dx(BS_X) > 0), "co", 1)
    L.shade(wall & ~np.roll(wall, -1, 1) & (v.dx(BS_X) < 0), "co", 1)
    # timbers bracing the walls
    for y in range(70, 260, 38):
        L.fill(v.rect(BS_X - 150, y, BS_X - edge_at(y) + 6, y + 5), 0.4, "eg", 0.9, 0, 3)
        L.fill(v.rect(BS_X + edge_at(y) - 6, y, BS_X + 150, y + 5), 0.4, "eg", 0.9, 0, 3)
    # cables down the middle and the lift cage hung on them
    for dx in (-26, 26):
        L.shade(v.rect(BS_X + dx, 0, BS_X + dx + 1, 150), "gr", 3)
    cage = v.rect(BS_X - 30, 150, BS_X + 30, 196)
    L.fill(cage, 0.2, "gr", 0.6, 0, 1)
    L.outline(cage, "gr", 3)
    for x in range(BS_X - 26, BS_X + 30, 6):
        L.shade(v.rect(x, 152, x + 1, 194), "gr", 2)
    L.fill(v.rect(BS_X - 32, 146, BS_X + 32, 152), 0.5, "gr", 0.9, 1, 3)
    L.fill(v.rect(BS_X - 32, 194, BS_X + 32, 200), 0.5, "gr", 0.9, 1, 3)
    # a rack riding the cage down
    rack(L, v, BS_X - 12, 160, 24, 34, "co", 193)
    # work lamps strung on a sagging wire down each wall
    for side in (-1, 1):
        pts = [(BS_X + side * (edge_at(y) - 4), y) for y in np.linspace(40, 250, 12)]
        L.shade(v.path(pts, 1), "gr", 2)
        for x, y in pts[1::2]:
            L.fill(v.disc(x, y + 3, 2.4), 0.9, "co", 0.9, 2, 4)
    # a pool of light far below
    L.speckle(np.abs(v.dx(BS_X)) < edge, v.vgrad(200, 270) * 0.5, "mg", 2)
    return L


def edge_at(y):
    return BS_W + 30 - (y - 40) * 0.12


def shaft_fx(v, f):
    L = Layer(v)
    # dust and grit falling down the shaft
    for k in range(50):
        x = BS_X + (rnd(1901, k) - 0.5) * 220
        t = (f + int(rnd(1901, k, 1) * FRAMES)) % FRAMES
        y = (rnd(1901, k, 2) * 260 + t * 7) % 270
        L.shade(v.px(x, y), "ba", 4 if k % 4 == 0 else 3)
    # lamps swing a little: their glow flickers in turn
    for side in (-1, 1):
        for i, y in enumerate(np.linspace(40, 250, 12)[1::2]):
            x = BS_X + side * (edge_at(y) - 4)
            if (f + i + (side > 0) * 3) % FRAMES < 5:
                h = v.radial(x, y + 3, 12)
                L.speckle(h > 0, h * 0.5, "co", 3)
    # cage signal light and a spark where the cables run over the sheave
    if f % 2 == 0:
        L.shade(v.rect(BS_X - 2, 141, BS_X + 2, 145), "red", 4)
    L.shade(v.disc(BS_X + (26 if f % 4 < 2 else -26), 30 + (f % 4) * 2, 1.2), "co", 4)
    return L


# =====================================================================================================================
# 20 Magma: a cavern cut by a river of magma, crossed by the farm's last pipeline. Heat bends the air, crust plates
# drift on the flow, and embers climb toward the roof.
# =====================================================================================================================
MG_FLOW = noise(201, 40, 4, 0.6, 3.0)
MG_RIVER = 214
MG_ROCK = noise(202, 50, 4, 0.6)


def magma_far(v):
    L = Layer(v)
    rock = v.sample(MG_ROCK)
    L.fill(v.wy < MG_RIVER, 0.1 + 0.3 * rock * v.vgrad(40, MG_RIVER) + 0.25 * v.vgrad(120, MG_RIVER), "ba", 0.9, 0, 2)
    L.speckle(v.wy < MG_RIVER, v.vgrad(130, MG_RIVER) ** 1.5 * 0.7, "mg", 1)
    # far ledges, rim lit from the river below
    for seed, base in ((203, 168), (204, 186)):
        m = below(v, hills(seed, base, 10, (3, 7, 19))) & (v.wy < MG_RIVER)
        L.fill(m, 0.15 + 0.2 * rock, "ba", 0.9, 0, 2)
        L.edge_top(m, "mg", 2)
    # far lavafalls
    for x in (70, 330):
        fall = v.rect(x - 6, 96, x + 14, MG_RIVER) & (np.abs(v.dx(x + 4) + np.sin(v.wy * 0.2) * 1.5) < 4 + (v.wy - 96) * 0.06)
        L.fill(fall, 0.3 + 0.7 * v.sample(MG_FLOW) * (1 - np.abs(v.dx(x + 4)) / 10), "mg", 0.9, 1, 4)
        L.speckle(v.radial(x + 4, MG_RIVER, 30, 14) > 0, v.radial(x + 4, MG_RIVER, 30, 14) * 0.8, "mg", 3)
    return L


def magma_near(v):
    L = Layer(v)
    flow = v.sample(MG_FLOW)
    # the river: bright cracks between dark crust
    riv = v.wy >= MG_RIVER
    L.fill(riv, 0.45 + 0.55 * flow, "mg", 0.9, 1, 4)
    crust = riv & (flow < 0.5)
    L.fill(crust, 0.15 + flow * 0.4, "ba", 0.9, 0, 2)
    L.outline(crust, "mg", 3, False)
    L.shade(v.rect(0, MG_RIVER, WW, MG_RIVER + 1), "co", 4)
    # banks in the foreground corners
    for x0, x1 in ((-20, 70), (400, 500)):
        bank = v.poly([(x0, WH), (x0, MG_RIVER - 10), (x0 + 30, MG_RIVER - 16), (x1, MG_RIVER + 4), (x1 + 20, WH)])
        L.fill(bank, 0.2 + 0.25 * v.sample(MG_ROCK), "ba", 0.9, 0, 3)
        L.edge_top(bank, "mg", 2)
    # the pipeline: a trestle bridge with a fat insulated pipe
    py = 150
    L.fill(v.rect(0, py, WW, py + 10), 0.35 + 0.4 * v.vgrad(py, py + 10) * 0, "gr", 0.9, 1, 3)
    L.shade(v.rect(0, py, WW, py + 1), "gr", 4)
    L.shade(v.rect(0, py + 9, WW, py + 10), "gr", 0)
    for x in range(0, WW, 30):
        L.shade(v.rect(x, py - 1, x + 3, py + 11), "co", 2)
    L.fill(v.rect(0, py + 12, WW, py + 15), 0.4, "gr", 0.9, 0, 2)
    for x in range(10, WW, 60):                                         # trestle legs down into the flow
        L.shade(v.line(x, py + 15, x - 12, MG_RIVER + 6, 2) | v.line(x, py + 15, x + 12, MG_RIVER + 6, 2), "gr", 2)
        L.shade(v.line(x - 6, py + 34, x + 6, py + 34, 1), "gr", 2)
    # a pump house on the bank
    ph = v.rect(420, 168, 466, MG_RIVER - 2)
    L.fill(ph, 0.3 + 0.2 * v.lin(420, 0, 466, 0), "gr", 0.9, 0, 3)
    L.outline(ph, "gr", 0)
    L.fill(v.poly([(416, 168), (444, 154), (470, 168)]), 0.4, "gr", 0.9, 0, 3)
    for x in (426, 446):
        L.fill(v.rect(x, 176, x + 10, 186), 0.8, "co", 0.9, 2, 4)
    L.shade(v.rect(454, 136, 460, 156), "gr", 2)
    return L


def magma_fx(v, f):
    L = Layer(v)
    # crust plates drift: bright flecks crawl along the river
    for k in range(40):
        x = rnd(2001, k) * WW + f * 2
        y = MG_RIVER + 4 + rnd(2001, k, 1) * 50
        L.shade(v.rect(x, y, x + 3, y + 1), "co", 4 if k % 3 == 0 else 3)
    # bubbles swell and pop
    for k in range(10):
        x, y = rnd(2002, k) * WW, MG_RIVER + 6 + rnd(2002, k, 1) * 40
        t = (f + k) % FRAMES
        if t < 4:
            L.shade(v.ring(x, y, 1 + t, 1, 0.6 + t * 0.5), "co", 4)
    # embers climb
    for k in range(40):
        x = rnd(2003, k) * WW + math.sin(f + k) * 2
        t = (f + int(rnd(2003, k, 1) * FRAMES)) % FRAMES
        y = MG_RIVER - 6 - t * 6 - rnd(2003, k, 2) * 60
        L.shade(v.px(x, y), "mg", 4 if t < 4 else 3)
    # heat shimmer over the river: a band of speckle that walks
    sh = (v.wy > MG_RIVER - 20) & (v.wy < MG_RIVER) & (((np.floor(v.wx / 2) + np.floor(v.wy) + f) % 7) == 0)
    L.shade(sh, "mg", 2)
    # pump house windows pulse
    if f % 4 < 2:
        for x in (426, 446):
            L.speckle(v.disc(x + 5, 181, 12, 9), 0.4, "co", 3)
    return L


# =====================================================================================================================
# 21 Geode: a hollow stone the size of a hall, lined with violet crystal. Racks stand on the crystal floor, and light
# runs through the points like a signal down a cable.
# =====================================================================================================================
GV_X, GV_Y, GV_RX, GV_RY = 240, 150, 214, 128


def _crystals():
    rng = np.random.default_rng(211)
    out = []
    for k in range(120):
        a = rng.random() * TAU
        r = 0.86 + rng.random() * 0.1
        x = GV_X + math.cos(a) * GV_RX * r
        y = GV_Y + math.sin(a) * GV_RY * r
        ln = 10 + rng.random() * 26
        wd = 3 + rng.random() * 5
        ang = math.atan2(GV_Y - y, (GV_X - x) * 0.6) + (rng.random() - 0.5) * 0.6
        out.append((x, y, ang, ln, wd, rng.random()))
    return out


GV_CRYS = _crystals()


def geode_far(v):
    L = Layer(v)
    rock = v.sample(MG_ROCK)
    L.fill(np.ones_like(rock, bool), 0.1 + 0.15 * rock, "ba", 0.9, 0, 1)
    inside = ((v.dx(GV_X) / GV_RX) ** 2 + ((v.wy - GV_Y) / GV_RY) ** 2) < 1
    L.fill(inside, 0.12 + 0.35 * (1 - v.radial(GV_X, GV_Y, GV_RX, GV_RY)), "ge", 0.9, 0, 2)
    L.shade(v.ring(GV_X, GV_Y, GV_RX, 3, GV_RY), "ba", 3)
    L.shade(v.ring(GV_X, GV_Y, GV_RX - 3, 2, GV_RY - 3), "ge", 1)
    for k, (x, y, ang, ln, wd, r) in enumerate(GV_CRYS[::2]):
        L.fill(crystal(v, x, y, ang, ln * 0.7, wd * 0.6), 0.3 + 0.4 * r, "ge", 0.9, 0, 2)
    return L


def geode_near(v):
    L = Layer(v)
    for k, (x, y, ang, ln, wd, r) in enumerate(GV_CRYS[1::2]):
        m = crystal(v, x, y, ang, ln, wd)
        half = crystal(v, x, y, ang, ln, wd, side=True)
        rp = "ge" if k % 5 else "sp"
        L.fill(m, 0.25 + 0.5 * v.lin(x, y, x + math.cos(ang) * ln, y + math.sin(ang) * ln), rp, 0.9, 1, 3)
        L.fill(half, 0.5 + 0.5 * v.lin(x, y, x + math.cos(ang) * ln, y + math.sin(ang) * ln), rp, 0.9, 2, 4)
        L.outline(m, "ge", 0, True)
        L.shade(v.line(x, y, x + math.cos(ang) * ln * 0.8, y + math.sin(ang) * ln * 0.8, 1) & m, "wh", 3)
    # the floor: a shelf of crystal rubble
    fl = v.wy >= 218 + 3 * np.sin(v.wx * 0.11)
    L.fill(fl, 0.15 + 0.3 * v.sample(MG_ROCK), "ge", 0.9, 0, 2)
    L.edge_top(fl, "ge", 3)
    # racks standing on the shelf, wired with violet light
    for x0, h in ((140, 44), (176, 30), (296, 38), (330, 52)):
        rack(L, v, x0, 218 - h, 22, h, "ge", 212)
    pts = [(151, 174), (187, 188), (240, 196), (307, 180), (341, 166)]
    L.shade(v.path([(x, y) for x, y in pts], 1), "ge", 3)
    # a big cluster in the middle, the thing the racks are reading
    for k, (ang, ln) in enumerate(((-1.57, 60), (-1.9, 44), (-1.2, 48), (-2.3, 30), (-0.8, 34))):
        m = crystal(v, 240, 222, ang, ln, 9 if k == 0 else 6)
        L.fill(m, 0.3 + 0.4 * v.radial(240, 220 - ln * 0.6, ln * 0.6), "ge", 0.9, 1, 3)
        L.fill(crystal(v, 240, 222, ang, ln, 9 if k == 0 else 6, side=True), 0.6 + 0.4 * v.radial(240, 220 - ln * 0.6, ln * 0.6), "ge", 0.9, 2, 4)
        L.outline(m, "ge", 0, True)
        L.shade(v.line(240, 220, 240 + math.cos(ang) * ln * 0.9, 220 + math.sin(ang) * ln * 0.9, 1) & m, "wh", 4)
    return L


def geode_fx(v, f):
    L = Layer(v)
    # a glint walks round the crystal ring
    for k, (x, y, ang, ln, wd, r) in enumerate(GV_CRYS):
        if int(r * FRAMES) == f:
            tx, ty = x + math.cos(ang) * ln * 0.8, y + math.sin(ang) * ln * 0.8
            L.star(tx, ty, "wh", 4, 2, 3)
    # the central cluster hums: light runs up it
    t = f / FRAMES
    y = 220 - t * 60
    L.shade(v.disc(240, y, 2), "wh", 4)
    h = v.radial(240, 186, 40, 34)
    L.speckle(h > 0, h * (0.3 + 0.25 * math.sin(TAU * t)), "ge", 4)
    # packets along the rack wire
    pts = [(151, 174), (187, 188), (240, 196), (307, 180), (341, 166)]
    u = (f / FRAMES) * (len(pts) - 1)
    j = min(int(u), len(pts) - 2)
    (a, b), (c, d) = pts[j], pts[j + 1]
    L.shade(v.disc(a + (c - a) * (u - j), b + (d - b) * (u - j), 1.4), "sp", 4)
    twinkles(L, f, 2101, 40, 20, 260, ["ge", "wh", "sp"], 2, None, 0)
    return L


# =====================================================================================================================
# 22 Core: the bottom of everything. A white-gold sun held in a cage of rings and clamps over a molten sea, with the
# farm's deepest racks bolted to the gantry around it.
# =====================================================================================================================
CO_X, CO_Y, CO_R = 240, 118, 34
CO_SEA = 220


def core_far(v):
    L = Layer(v)
    rock = v.sample(MG_ROCK)
    L.fill(v.wy < CO_SEA, 0.08 + 0.15 * rock, "ba", 0.9, 0, 1)
    glow = v.radial(CO_X, CO_Y, 210, 150)
    L.gas(glow ** 1.4, "mg", 0, 3, v.wy < CO_SEA)
    L.gas(v.radial(CO_X, CO_Y, 120, 90) ** 1.6, "co", 1, 3, v.wy < CO_SEA)
    # far rings of the cage, tilted
    for r, ry in ((110, 34), (140, 46)):
        L.shade(v.ring(CO_X, CO_Y, r, 1, ry), "ba", 3)
    return L


def core_near(v):
    L = Layer(v)
    flow = v.sample(MG_FLOW)
    sea = v.wy >= CO_SEA
    L.fill(sea, 0.4 + 0.6 * flow * (1 - v.vgrad(CO_SEA, WH) * 0.5), "mg", 0.9, 1, 4)
    L.fill(sea & (flow < 0.38), 0.2, "ba", 0.9, 0, 2)
    L.shade(v.rect(0, CO_SEA, WW, CO_SEA + 1), "co", 4)
    # the sun: a dithered ball, white at the centre
    sun = v.disc(CO_X, CO_Y, CO_R)
    L.fill(sun, 0.35 + 0.65 * v.radial(CO_X - 8, CO_Y - 8, CO_R * 1.3), "co", 0.9, 2, 4)
    L.shade(v.disc(CO_X - 8, CO_Y - 9, 9) & sun, "wh", 4)
    # the cage: a front ring and a vertical ring, with clamps
    front = v.ring(CO_X, CO_Y, 56, 4, 18) & (v.wy > CO_Y - 2)
    L.fill(front, 0.5, "gr", 0.9, 1, 4)
    vert = v.ring(CO_X, CO_Y, 14, 4, 54) & ~sun
    L.fill(vert & (v.dx(CO_X) > 0), 0.5, "gr", 0.9, 1, 3)
    for a in (0, math.pi, 0.5, math.pi - 0.5):
        x, y = CO_X + math.cos(a) * 56, CO_Y + math.sin(a) * 18
        L.fill(v.rect(x - 4, y - 4, x + 4, y + 4), 0.6, "gr", 0.9, 1, 4)
        L.shade(v.rect(x - 1, y - 1, x + 1, y + 1), "co", 4)
    # gantry: a walkway at the level of the sun, on pylons down into the sea
    gy = 168
    L.fill(v.rect(0, gy, WW, gy + 5), 0.45, "gr", 0.9, 0, 3)
    L.shade(v.rect(0, gy, WW, gy + 1), "gr", 4)
    for x in range(0, WW, 20):
        L.shade(v.line(x, gy + 5, x + 10, gy + 14, 1) | v.line(x + 20, gy + 5, x + 10, gy + 14, 1), "gr", 2)
    L.shade(v.rect(0, gy + 14, WW, gy + 15), "gr", 2)
    for x in (30, 150, 330, 450):
        L.fill(v.rect(x - 4, gy + 15, x + 4, CO_SEA + 4), 0.4, "gr", 0.9, 0, 3)
    for x0, h in ((20, 40), (64, 30), (380, 34), (420, 46)):
        rack(L, v, x0, gy - h, 24, h, "co", 221)
    # cables from the racks to the clamps
    for x0, side in ((44, -1), (420, 1)):
        pts = [(x0 + (CO_X + side * 56 - x0) * t, gy - 30 - 30 * math.sin(math.pi * t) * 0.3 - (gy - 30 - CO_Y) * t) for t in np.linspace(0, 1, 20)]
        L.shade(v.path(pts, 2), "gr", 1)
        L.shade(v.path(pts, 1), "co", 2)
    return L


def core_fx(v, f):
    L = Layer(v)
    t = f / FRAMES
    # corona breathes
    r = CO_R + 6 + 6 * math.sin(TAU * t)
    h = v.radial(CO_X, CO_Y, r + 14) * (v.dist(CO_X, CO_Y) > CO_R)
    L.speckle(h > 0, h * 0.9, "co", 4)
    # arcs leap between the sun and the clamps
    for i, a in enumerate((0, math.pi, 0.5, math.pi - 0.5)):
        if (f + i * 2) % FRAMES < 2:
            x2, y2 = CO_X + math.cos(a) * 56, CO_Y + math.sin(a) * 18
            pts = [(CO_X + (x2 - CO_X) * u + (rnd(2201, f, i, k) - 0.5) * 6, CO_Y + (y2 - CO_Y) * u + (rnd(2202, f, i, k) - 0.5) * 6) for k, u in enumerate(np.linspace(0.5, 1, 6))]
            L.shade(v.path(pts, 1), "wh", 4)
    # a pulse runs along each cable
    for x0, side in ((44, -1), (420, 1)):
        u = (t + (0.5 if side > 0 else 0)) % 1
        x = x0 + (CO_X + side * 56 - x0) * u
        y = 138 - 30 * math.sin(math.pi * u) * 0.3 - (138 - CO_Y) * u
        L.shade(v.disc(x, y, 1.5), "wh", 4)
    # the sea glows and spits
    for k in range(30):
        x = rnd(2203, k) * WW - f * 2
        y = CO_SEA + 4 + rnd(2203, k, 1) * 46
        L.shade(v.rect(x, y, x + 3, y + 1), "co", 4)
    for k in range(20):
        x = rnd(2204, k) * WW
        tt = (f + int(rnd(2204, k, 1) * FRAMES)) % FRAMES
        L.shade(v.px(x, CO_SEA - 2 - tt * 5), "mg", 4 if tt < 4 else 3)
    return L


# ---------------------------------------------------------------------------------------------------------------------
# era table, merged into the deep kit's so its build() and preview() handle the files
# ---------------------------------------------------------------------------------------------------------------------
ARC = {
    15: ("cellar", cellar_far, cellar_near, cellar_fx, (300, 160, 2.0)),
    16: ("web", web_far, web_near, web_fx, (238, 150, 2.0)),
    17: ("canopy", canopy_far, canopy_near, canopy_fx, (250, 150, 1.9)),
    18: ("bloom", bloom_far, bloom_near, bloom_fx, (240, 160, 1.9)),
    19: ("shaft", shaft_far, shaft_near, shaft_fx, (240, 170, 2.0)),
    20: ("magma", magma_far, magma_near, magma_fx, (200, 180, 2.0)),
    21: ("geode", geode_far, geode_near, geode_fx, (240, 190, 2.0)),
    22: ("core", core_far, core_near, core_fx, (240, 140, 1.9)),
}
K.ERAS.update(ARC)

if __name__ == "__main__":
    want = [int(a) for a in sys.argv[1:]] or list(ARC)
    K.OUT.mkdir(parents=True, exist_ok=True)
    for n in want:
        K.build(n)
