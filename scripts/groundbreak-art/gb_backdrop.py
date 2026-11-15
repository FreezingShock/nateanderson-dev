"""Groundbreak backdrop: the San Francisco Bay at golden hour, as parallax layers for a zoomable side-on view.

Layers (back to front), all W x H native px, transparent where the layer behind shows:
  sky       gradient, low sun, cloud bands
  hills     ridges across the bay with fog spilling over them, a long red suspension bridge
  bay       water with sun glitter and boats
  city-0..4 a hilly city skyline that grows with each Incorporate (more and taller towers)
  shore     the near shoreline: port gantry cranes, pilings, rail line, the job site's ground strip
Generic shapes only: no named landmarks, logos or real buildings are reproduced.
"""
import math

import numpy as np

from gb_kit import P, Canvas

W, H = 1600, 600
HORIZON = 372  # water line
SUN = (1500, 330)


def rng(s):
    return np.random.default_rng(s)


def sky():
    c = Canvas(W, H)
    t = np.clip(c.Y / HORIZON, 0, 1) ** 1.25
    sun_d = np.hypot((c.X - SUN[0]) / 1.6, c.Y - SUN[1])
    v = np.clip(t + 0.22 * np.exp(-sun_d / 170), 0, 1)
    c.fill(c.rect(0, 0, W, H), v, "sky", 0.95)
    c.fill(c.disc(*SUN, 26), 0.9, "lamp", 0.4)
    c.thin(c.disc(*SUN, 40) & ~c.disc(*SUN, 26), P["lamp"][5], 0.35)
    c.thin(c.disc(*SUN, 110, 70), P["lamp"][3], 0.18, 200)  # wide halo
    r = rng(3)
    # high cirrus: short tapered wisps, lit pink-gold from below
    for _ in range(26):
        cx, cy, L = r.uniform(0, W), r.uniform(40, 170), r.uniform(30, 110)
        wisp = c.disc(cx, cy, L, r.uniform(1.2, 2.6)) & (c.B < 0.35 - np.abs(c.X - cx) / (2 * L))
        c.set(wisp, P["sky"][r.integers(6, 9)], 230)
    # cumulus banks: clusters of puffs, dark violet tops, glowing amber undersides toward the sun
    for _ in range(14):
        cx, cy = r.uniform(-60, W + 60), r.uniform(150, 300)
        n = r.integers(5, 11)
        sz = r.uniform(10, 22) * (0.6 + cy / 300)
        mask = np.zeros_like(c.B, bool)
        for k in range(n):
            ox = (k - n / 2) * sz * 0.9 + r.uniform(-4, 4)
            rr = sz * r.uniform(0.6, 1.1) * (1 - abs(k - n / 2) / (n * 0.9))
            mask |= c.disc(cx + ox, cy - rr * 0.4, rr * 1.2, rr) & (c.Y < cy + 2)
        warm = 1 - np.clip(np.abs(c.X - SUN[0]) / 900, 0, 1)
        v = np.clip(0.15 + (c.Y - cy + sz) / (sz * 2.2) * (0.5 + 0.5 * warm), 0, 1)
        c.fill(mask, v, "haze", 0.9)
        rim = mask & ~np.roll(mask, -2, 0)
        c.set(rim & (c.B < 0.3), P["sky"][10 if warm.mean() > 0 else 9])
    # birds heading home
    for _ in range(9):
        x, y = r.uniform(900, 1450), r.uniform(200, 300)
        c.set(c.line(x - 3, y - 1.5, x, y, 0.8) | c.line(x, y, x + 3, y - 1.5, 0.8), P["ink"][1])
    for _ in range(70):  # first stars in the dark top
        x, y = r.uniform(0, W), r.uniform(0, 90)
        c.set(c.rect(x, y, x + 1, y + 1), P["white"][3], 180)
    return c


def ridge(c, base, amp, seed, pal, lo, hi, x_from=0, x_to=W, peak=None):
    r = rng(seed)
    xs = np.arange(W)
    y = np.full(W, float(base))
    for k in range(5):
        f = r.uniform(0.002, 0.012) * (k + 1)
        y -= amp / (k + 1.4) * (0.5 + 0.5 * np.sin(xs * f + r.uniform(0, 6)))
    if peak:
        px, ph, pw = peak
        y -= ph * np.exp(-((xs - px) / pw) ** 2)
    top = y[np.clip(c.X.astype(int), 0, W - 1)]
    m = (c.Y >= top) & (c.Y < HORIZON + 2) & (c.X >= x_from) & (c.X < x_to)
    shade = np.clip(lo + (hi - lo) * (1 - np.clip(np.abs(c.X - SUN[0]) / 900, 0, 1)) - (c.Y - top) / 300, 0, 1)
    c.fill(m, shade, pal, 0.9)
    c.set(m & (c.Y < top + 1.2), P[pal][-1] if pal != "haze" else P["sky"][9], 200)
    return y


def hills():
    c = Canvas(W, H)
    ridge(c, HORIZON - 40, 70, 7, "haze", 0.2, 0.6, peak=(300, 70, 160))   # far headlands
    # fog pouring over the saddle
    r = rng(9)
    for k in range(40):
        x = 120 + k * 14 + r.uniform(-6, 6)
        y = HORIZON - 70 + 0.8 * abs(k - 18) + r.uniform(-3, 3)
        c.thin(c.disc(x, y, r.uniform(16, 30), r.uniform(5, 9)), P["white"][2], 0.16, 150)
    ytop = ridge(c, HORIZON - 8, 34, 21, "roof", 0.25, 0.55, x_from=0, x_to=W)  # nearer ridge, East Bay style
    near = (c.Y > ytop[np.clip(c.X.astype(int), 0, W - 1)] + 1) & (c.Y < HORIZON)
    c.set(near & (c.B > 0.38) & (np.sin(c.X * 0.7) * np.sin(c.Y * 1.3) > 0.2), P["green"][1])  # oak scrub
    r2 = rng(31)
    for _ in range(140):  # hillside houses, some windows lit
        x = r2.uniform(560, W)
        y = ytop[int(x)] + r2.uniform(3, max(4, HORIZON - ytop[int(x)] - 4))
        c.set(c.rect(x, y, x + 3, y + 2), P["roof"][4])
        if r2.random() < 0.55:
            c.set(c.rect(x + 1, y + 1, x + 2, y + 2), P["lamp"][r2.integers(3, 6)])
    # long suspension bridge across the left of the bay
    l, r_ = 70, 560
    deck = HORIZON - 14
    towers = (190, 440)
    th = 82
    col = P["safety"][2]
    for tx in towers:
        c.set(c.rect(tx - 3, deck - th, tx - 1, HORIZON), col)
        c.set(c.rect(tx + 2, deck - th, tx + 4, HORIZON), col)
        for y in (deck - th + 8, deck - th + 34, deck - th + 58):
            c.set(c.rect(tx - 3, y, tx + 4, y + 2), col)
    xs = np.linspace(*towers, 140)
    mid = sum(towers) / 2
    sag = deck - th + 2 + (th - 8) * (1 - ((xs - mid) / ((towers[1] - towers[0]) / 2)) ** 2)
    for a, b, ya, yb in zip(xs[:-1], xs[1:], sag[:-1], sag[1:]):
        c.set(c.line(a, ya, b, yb, 1.2), col)
    for x, y in zip(xs[::4], sag[::4]):
        c.set(c.rect(x, y, x + 1, deck), P["safety"][1], 200)
    c.set(c.line(towers[0], deck - th + 2, l, deck, 1.2) | c.line(towers[1], deck - th + 2, r_, deck, 1.2), col)
    c.set(c.rect(l - 20, deck, r_ + 20, deck + 3), P["safety"][1])
    for x in range(l, r_, 4):
        c.set(c.rect(x, deck - 1, x + 1, deck), P["lamp"][4] if (x // 4) % 3 == 0 else P["safety"][1])
    return c


def bay():
    c = Canvas(W, H)
    m = c.rect(0, HORIZON, W, H)
    d = np.clip((c.Y - HORIZON) / (H - HORIZON), 0, 1)
    c.fill(m, np.clip(0.55 - 0.45 * d + 0.06 * np.sin(c.X / 7 + c.Y / 2), 0, 1), "water", 0.95)
    # sun glitter column
    g = m & (np.abs(c.X - SUN[0]) < 40 + 140 * d) & (np.sin(c.Y * 2.3 + np.sin(c.X * 0.09) * 3) > 0.6) & \
        (c.B < 0.25 - 0.6 * np.abs(c.X - SUN[0]) / (40 + 140 * d))
    c.set(g, P["lamp"][5])
    rows = m & (np.sin(c.Y * 1.7 + np.sin(c.X * 0.05) * 2) > 0.92 - 0.1 * d)  # wave crests
    c.set(rows & (c.B < 0.1), P["water"][5])
    refl = m & (c.Y < HORIZON + 60) & (c.X > 640) & (c.X < 1460) & (np.sin(c.X * 0.37 + np.sin(c.Y * 1.9) * 2.5) > 0.75) & \
        (c.B < 0.05 - (c.Y - HORIZON) / 70) & (np.sin(c.Y * 2.2) > 0.1)
    c.set(refl, P["lamp"][3], 200)  # city lights trembling on the water
    r = rng(5)
    for k in range(5):  # sailboats
        x, y = r.uniform(420, 1400), HORIZON + r.uniform(8, 50)
        c.fill(c.poly([(x, y), (x + 14, y), (x + 12, y + 3), (x + 2, y + 3)]), 0.6, "white", 0.4)
        c.fill(c.poly([(x + 7, y - 1), (x + 7, y - 18), (x + 14, y - 1)]), 0.75, "white", 0.5)
        c.fill(c.poly([(x + 6, y - 1), (x + 6, y - 14), (x + 1, y - 1)]), 0.5, "sunglass", 0.5)
    # a ferry with its wake
    fx, fy = 1180, HORIZON + 30
    c.fill(c.rect(fx, fy, fx + 46, fy + 5), 0.7, "white", 0.4)
    c.fill(c.rect(fx + 6, fy - 5, fx + 38, fy), 0.55, "white", 0.4)
    c.set(c.rect(fx + 8, fy - 4, fx + 36, fy - 2) & ((c.X % 3) < 2), P["lamp"][4])
    c.thin(c.rect(fx + 46, fy + 3, fx + 160, fy + 6) & (c.Y < fy + 4 + (c.X - fx - 46) / 40), P["white"][2], 0.35)
    for k in range(6):  # small boats and a container ship
        x, y = r.uniform(600, 1500), HORIZON + r.uniform(6, 40)
        c.set(c.rect(x, y, x + 8, y + 2), P["white"][2])
        c.set(c.rect(x + 3, y - 6, x + 4, y), P["white"][3])
    x, y = 760, HORIZON + 18
    c.fill(c.poly([(x, y), (x + 110, y), (x + 104, y + 7), (x + 4, y + 7)]), 0.2, "steel", 0.5)
    for k in range(9):
        c.fill(c.rect(x + 12 + k * 9, y - 5 - (k % 3) * 2, x + 20 + k * 9, y), 0.5,
               ["safety", "glass", "hiviz", "cash"][k % 4], 0.6)
    c.fill(c.rect(x + 96, y - 14, x + 104, y), 0.5, "white", 0.5)
    return c


def city(level):
    """Skyline on the city hills across the water. level 0..4 adds towers; seeds are stable so a higher level keeps
    every tower of the levels before it."""
    c = Canvas(W, H)
    base = HORIZON - 2
    ridge(c, base + 4, 26, 41, "roof", 0.12, 0.3, x_from=600, x_to=1520, peak=(980, 20, 180))
    r = rng(77)
    towers = []
    for k in range(60):
        x = r.uniform(640, 1460)
        cen = 1 - abs(x - 1000) / 470
        h = r.uniform(18, 60) + 120 * cen ** 2 * r.uniform(0.3, 1.0)
        w = r.uniform(10, 24)
        towers.append((r.integers(0, 5), x, w, h, r.integers(0, 4), r.random()))
    for lvl, x, w, h, kind, q in sorted(towers, key=lambda t: -t[3]):
        if lvl > level:
            continue
        h = h * (1 + 0.12 * level)
        top = base - h
        body = c.rect(x, top, x + w, base + 6)
        shade = np.clip(0.42 - (c.X - x) / (w * 3) + 0.25 * (1 - np.clip(abs(x - SUN[0]) / 700, 0, 1)), 0, 1)
        pal = ["steel", "glass", "precast", "concrete"][kind]
        c.fill(body, shade * 0.8, pal, 0.9)
        c.set(body & (c.X < x + 1.2), P["sky"][9], 230)  # sunlit edge toward the sun? left rim
        lit = body & ((c.Y - top) % 5 < 1) & ((c.X - x) % 3 < 1) & (c.B < (q - 0.3))
        c.set(lit, P["lamp"][4])
        if kind == 1 and h > 90:  # tapered crown
            c.fill(c.poly([(x, top), (x + w, top), (x + w / 2, top - w * 1.3)]), 0.3, pal, 0.8)
        if q > 0.75:
            c.set(c.rect(x + w / 2, top - 10, x + w / 2 + 1, top), P["steel"][4])
            c.set(c.rect(x + w / 2 - 1, top - 11, x + w / 2 + 2, top - 10), P["safety"][5])
    landmarks(c, base, level)
    # a radio mast on the high hill
    c.set(c.rect(1210, base - 70, 1212, base - 6), P["safety"][3])
    for y in range(int(base - 70), int(base - 6), 12):
        c.set(c.rect(1206, y, 1216, y + 1), P["safety"][3])
    return c


def _glass_body(c, m, x0, w, top, pal="glass"):
    shade = np.clip(0.5 - (c.X - x0) / (w * 2.5) + 0.25 * (1 - np.clip(abs(x0 - SUN[0]) / 700, 0, 1)), 0, 1)
    c.fill(m, shade, pal, 0.9)
    c.set(m & (c.X < x0 + 1.2), P["sunglass"][5], 230)  # sunset rim
    c.set(m & ((c.Y - top) % 4 < 1) & ((c.X - x0) % 3 < 1) & (c.B < 0.1), P["lamp"][4])


def _crane(c, x, top):
    c.set(c.rect(x, top - 22, x + 1, top + 2), P["hiviz"][4])
    c.set(c.rect(x - 8, top - 22, x + 22, top - 21), P["hiviz"][5])
    c.set(c.rect(x - 8, top - 22, x - 5, top - 19), P["concrete"][4])
    c.set(c.rect(x + 15, top - 21, x + 16, top - 12), P["ink"][2])
    c.set(c.disc(x + 0.5, top - 24, 1), P["safety"][5])


def landmarks(c, base, level):
    """One signature tower per Incorporate, each in its own style; the newest still has cranes on its crown."""
    builds = [
        # level 1: stepped setback pair
        lambda: [(_glass_body(c, c.rect(x, base - h + k * 22, x + w - 2 * k * 3, base + 6), x + 3 * k, w, base - h, "precast"))
                 for x, w, h in ((860, 26, 150), (895, 20, 118)) for k in range(4)] and (895 + 10, base - 118),
        # level 2: tapered pyramid tower
        lambda: (_glass_body(c, c.poly([(1060, base + 6), (1092, base + 6), (1084, base - 190), (1068, base - 190)]), 1060, 32, base - 190),
                 c.fill(c.poly([(1068, base - 190), (1084, base - 190), (1076, base - 228)]), 0.75, "sunglass", 0.6),
                 (1076, base - 228))[-1],
        # level 3: twin slabs joined by a sky bridge
        lambda: ([_glass_body(c, c.rect(x, base - 205, x + 16, base + 6), x, 16, base - 205) for x in (780, 806)],
                 c.fill(c.rect(796, base - 130, 806, base - 122), 0.6, "steel", 0.5),
                 (788, base - 205))[-1],
        # level 4: the supertall, curved shoulders and a spire
        lambda: (_glass_body(c, c.rect(990, base - 250, 1022, base + 6) | (c.disc(1006, base - 250, 16, 22) & (c.Y < base - 250)),
                             990, 32, base - 272),
                 c.set(c.rect(1005, base - 320, 1007, base - 270), P["steel"][6]),
                 c.set(c.rect(1004, base - 322, 1008, base - 320), P["safety"][5]),
                 (1006, base - 272))[-1],
    ]
    for lvl in range(1, level + 1):
        top = builds[lvl - 1]()
        if lvl == level:
            _crane(c, top[0] - 4, top[1])


def shore():
    c = Canvas(W, H)
    top = HORIZON + 120
    m = c.rect(0, top, W, H)
    c.fill(m, np.clip(0.55 - (c.Y - top) / 200, 0, 1), "dirt", 0.8)
    # soil profile: topsoil, a clay band, a sand lens, gravel, then fractured bedrock fading into the dark
    wav = 2.5 * np.sin(c.X / 37) + 1.5 * np.sin(c.X / 11)
    c.fill(m & (np.abs(c.Y - (top + 26) - wav) < 5), 0.3, "brick", 0.8)
    c.fill(m & (np.abs(c.Y - (top + 44) + wav) < 2 + 2.5 * np.sin(c.X / 90)), 0.3, "sand", 0.8)
    c.fill(m & (np.abs(c.Y - (top + 58) - wav * 0.6) < 4), 0.4, "gravel", 1.0)
    rock = m & (c.Y > top + 66 + wav)
    c.fill(rock, np.clip(0.45 - (c.Y - top - 66) / 60, 0, 1), "dirt", 0.9)
    c.set(rock & (np.abs(np.sin(c.X / 13 + c.Y / 7) ) < 0.04), P["ink"][1])
    c.set(m & (np.abs(c.Y - (top + 38)) < 0.6) & (c.B < 0), P["water"][3], 160)  # water table seep
    pipe = c.rect(0, top + 32, W, top + 36)  # utility main under the street
    c.fill(pipe, 0.5, "duct", 0.5)  # runs straight under the site; a dug pit is drawn over it
    c.fill(c.rect(0, top, W, top + 4), 0.5, "concrete", 0.6)  # seawall cap
    for x in range(0, W, 9):  # pilings
        c.fill(c.rect(x, top - 10, x + 3, top), 0.4, "wood", 0.5)
    c.fill(c.rect(0, top - 12, 520, top - 9), 0.45, "wood", 0.5)  # pier deck
    # port gantry cranes
    for k, x in enumerate((90, 200, 310)):
        col = "safety" if k != 1 else "hiviz"
        c.fill(c.rect(x, top - 120, x + 4, top - 12) | c.rect(x + 44, top - 120, x + 48, top - 12), 0.6, col, 0.5)
        c.fill(c.rect(x - 60, top - 124, x + 90, top - 118), 0.7, col, 0.5)
        c.fill(c.rect(x - 4, top - 140, x + 52, top - 124), 0.5, col, 0.5)
        c.set(c.line(x + 24, top - 140, x - 60, top - 124, 1) | c.line(x + 24, top - 140, x + 90, top - 124, 1),
              P[col][3])
        c.set(c.rect(x + 60, top - 118, x + 61, top - 70), P["ink"][2])
        c.fill(c.rect(x + 50, top - 70, x + 72, top - 62), 0.5, ["glass", "cash", "safety"][k], 0.5)
    for k in range(18):  # container stacks
        x = 30 + k * 26
        for j in range(1 + (k * 7) % 3):
            c.fill(c.rect(x, top - 20 - j * 8, x + 24, top - 13 - j * 8), 0.55,
                   ["safety", "glass", "hiviz", "cash", "rebar"][(k + j) % 5], 0.6)
    # rail line along the shore
    c.set(c.rect(0, top + 10, W, top + 11), P["steel"][5])
    for x in range(0, W, 6):
        c.set(c.rect(x, top + 11, x + 3, top + 13), P["wood"][2])
    # street lamps toward the job site
    for x in range(640, W, 70):
        c.set(c.rect(x, top - 28, x + 1, top), P["steel"][4])
        c.set(c.rect(x - 1, top - 30, x + 4, top - 28), P["lamp"][5])
        c.thin(c.disc(x + 1, top - 26, 9, 6), P["lamp"][5], 0.25, 180)
    return c


def all_layers():
    out = {"sky": sky(), "hills": hills(), "bay": bay(), "shore": shore()}
    for lvl in range(5):
        out[f"city-{lvl}"] = city(lvl)
    return out
