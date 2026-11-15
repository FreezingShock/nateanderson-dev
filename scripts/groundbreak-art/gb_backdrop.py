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
    r = rng(3)
    for k in range(9):  # long flat cloud bands, lit underneath
        cy = r.uniform(60, 280)
        cx = r.uniform(0, W)
        L = r.uniform(140, 380)
        band = c.disc(cx, cy, L, r.uniform(7, 15)) & (c.Y < cy + 4)
        lit = np.clip(0.3 + (c.Y - cy) / 14 + 0.35 * (1 - np.clip(np.abs(c.X - SUN[0]) / 700, 0, 1)), 0, 1)
        c.fill(band, lit, "haze", 0.9)
        c.set(band & (c.Y > cy + 1) & (c.Y < cy + 3), P["sky"][10])
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
        c.thin(c.disc(x, y, r.uniform(16, 30), r.uniform(5, 9)), P["white"][2], 0.3, 190)
    ridge(c, HORIZON - 8, 34, 21, "roof", 0.25, 0.55, x_from=0, x_to=W)  # nearer ridge, East Bay style
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
    r = rng(5)
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
    # a radio mast on the high hill
    c.set(c.rect(1210, base - 70, 1212, base - 6), P["safety"][3])
    for y in range(int(base - 70), int(base - 6), 12):
        c.set(c.rect(1206, y, 1216, y + 1), P["safety"][3])
    return c


def shore():
    c = Canvas(W, H)
    top = HORIZON + 120
    m = c.rect(0, top, W, H)
    c.fill(m, np.clip(0.55 - (c.Y - top) / 200, 0, 1), "dirt", 0.8)
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
