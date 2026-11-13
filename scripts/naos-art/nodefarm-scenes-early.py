"""Node Farm era scenery for zones 01 to 11, redrawn in colour and in layers to match the six deep eras.

Eras 0..8: 0 Uplink (Uplink Rack + Amp Bay), 1 Foundry (Power Room + Trace Foundry), 2 Wafer (Fab Cleanroom),
3 Lattice (Crystal Vault), 4 Aurora (Signal Void), 5 Monolith (Glyph Hall), 6 Glass (Prism Court), 7 Eclipse (Hollow Forge),
8 Clockwork (Still Room).

Each era keeps the subject of its first flat two-tone drawing (the data city, the smokestacks, the wafer moon, the crystal
spires, the aurora, the rune stones and ringed moon, the floating glass, the black sun over the grid, the great clock and
its gears) and redraws it the way nodefarm-scenes-deep.py draws eras 9..14: a far layer that drifts, an opaque near layer,
an 8-frame fx layer, a flattened still and an animated close-up. All the drawing tools (View, Layer, noise, stars, the
build and save steps) come from that script, so both halves of the game read as one family.

Run:  python3 scripts/naos-art/nodefarm-scenes-early.py           (all nine)
      python3 scripts/naos-art/nodefarm-scenes-early.py 0 4       (just those eras)
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
D = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(D)

View, Layer, noise, rnd, over = D.View, D.Layer, D.noise, D.rnd, D.over
starfield, twinkles, hills, below = D.starfield, D.twinkles, D.hills, D.below
WW, WH, HOR, FRAMES, TAU = D.WW, D.WH, D.HOR, D.FRAMES, D.TAU


def glow(L, v, cx, cy, r, ramp, lo=0, hi=3, ry=None, p=1.4):
    L.gas(v.radial(cx, cy, r, ry) ** p, ramp, lo, hi)


def horizon_glow(L, v, ramp, y0, y1, lo=0, hi=2, field=None, k=1.0):
    """A band of dithered haze that thickens toward y1 (the horizon)."""
    d = v.vgrad(y0, y1) ** 1.6 * k
    if field is not None:
        d = d * (0.55 + 0.6 * v.sample(field))
    L.gas(np.clip(d, 0, 1) * (v.wy < y1 + 2), ramp, lo, hi)


def loop_y(seed, k, f, step, span):
    """Position along a loop of `span` px that advances `step` px a frame; span = step * FRAMES keeps it seamless."""
    return (rnd(seed, k, 9) * span + f * step) % span


def gear(v, cx, cy, r_out, r_in, teeth, rot, hole, spokes=0, s_in=None):
    a, d = v.angle(cx, cy), v.dist(cx, cy)
    tooth = np.cos(teeth * (a - rot)) > 0.05
    m = ((d <= r_in) | ((d <= r_out) & tooth)) & (d > hole)
    if spokes:
        s_in = s_in or hole + 3
        win = (d > s_in) & (d < r_in - 4) & (np.cos(spokes * (a - rot)) < 0.35)
        m &= ~win
    return m


def draw_gear(L, v, cx, cy, r_out, r_in, teeth, rot, hole, ramp, spokes=0, lo=0, hi=3):
    m = gear(v, cx, cy, r_out, r_in, teeth, rot, hole, spokes)
    shade = 0.25 + 0.55 * v.lin(cx + r_out, cy + r_out, cx - r_out, cy - r_out)
    L.fill(m, shade, ramp, 0.9, lo, hi)
    L.shade(m & v.ring(cx, cy, r_in - 2, 1), ramp, max(lo, hi - 2))
    L.edge_top(m, ramp, min(4, hi + 1))
    L.shade(v.disc(cx, cy, max(hole - 1.5, 1.5)), ramp, hi)
    L.shade(v.disc(cx, cy, max(hole - 3, 0.8)), "gr", 0)
    return m


# =====================================================================================================================
# 0 Uplink: the data city at night. A far skyline drifts behind the near towers, whose windows burn cyan, lime and
# magenta (Bytes and Multipliers). An uplink mast with a dish rises over the roofs and pulses signal; data rain falls.
# =====================================================================================================================
UP_HAZE = noise(201, 90, 4, 0.55, 2.0)
UP_FOG = noise(202, 60, 3, 0.5, 2.6)
STREET = 200
UP_MAST = (318, 64)   # x, top


def _city(seed, base, hmin, hmax, wmin, wmax, gap=(1, 7), lit=0.35):
    rng = np.random.default_rng(seed)
    towers, x = [], 2
    while x < WW - wmin - 2:
        w = int(min(rng.integers(wmin, wmax + 1), WW - x - 2))
        h = int(rng.integers(hmin, hmax + 1))
        wins = []
        for cx in range(x + 3, x + w - 3, 4):
            for cy in range(base - h + 5, base - 4, 5):
                r = rng.random()
                col = None
                if r < lit:
                    col = ("cyan", "cyan", "cyan", "lime", "mag", "wh")[int(rng.integers(0, 6))]
                wins.append((cx, cy, col))
        towers.append(dict(x=x, w=w, top=base - h, ant=rng.random() < 0.45, crown=int(rng.integers(0, 3)), wins=wins))
        x += w + int(rng.integers(*gap))
    return towers


UP_FAR = _city(203, STREET - 14, 30, 72, 10, 22, (0, 3), 0.12)
UP_NEAR = [t for t in _city(204, STREET, 44, 116, 16, 34, (3, 12), 0.34) if not (t["x"] < UP_MAST[0] + 10 and t["x"] + t["w"] > UP_MAST[0] - 10)]
UP_SIGNS = [(UP_NEAR[1], "mag"), (UP_NEAR[4], "lime"), (UP_NEAR[-2], "cyan")]


def uplink_far(v):
    L = Layer(v)
    horizon_glow(L, v, "si", 60, STREET - 10, 0, 1, UP_HAZE, 0.9)
    horizon_glow(L, v, "cyan", 120, STREET - 6, 0, 2, UP_FOG, 0.8)
    starfield(L, 0, 90, 6, 120, ["wh", "cyan", "si"], 0.08)
    for t in UP_FAR:
        body = v.rect(t["x"], t["top"], t["x"] + t["w"], STREET)
        L.fill(body, 0.2 + 0.25 * v.vgrad(STREET, t["top"]), "pu", 0.8, 0, 1)
        L.shade(v.rect(t["x"], t["top"], t["x"] + t["w"], t["top"] + 1), "pu", 2)
        for cx, cy, col in t["wins"]:
            if col:
                L.shade(v.rect(cx, cy, cx + 1, cy + 1), col, 2)
        if t["ant"]:
            L.shade(v.rect(t["x"] + t["w"] // 2, t["top"] - 8, t["x"] + t["w"] // 2 + 1, t["top"]), "pu", 1)
    # long cloud bars lit from below by the city
    bars = (v.sample(UP_FOG) > 0.62) & (v.wy > 70) & (v.wy < 110)
    L.speckle(bars, 0.35, "si", 1)
    return L


def uplink_near(v):
    L = Layer(v)
    for t in UP_NEAR:
        x, w, top = t["x"], t["w"], t["top"]
        body = v.rect(x, top, x + w, STREET)
        L.fill(body, 0.08 + 0.32 * v.lin(x + w, 0, x, 0), "cyan", 0.9, 0, 2)
        L.shade(v.rect(x, top, x + 1, STREET), "cyan", 3)                     # rim light from the street side
        L.shade(v.rect(x, top, x + w, top + 1), "cyan", 3)
        L.shade(v.rect(x + w - 1, top, x + w, STREET), "cyan", 0)
        if t["crown"] == 1:                                                   # stepped crown
            L.fill(v.rect(x + 3, top - 5, x + w - 3, top), 0.3, "cyan", 0.9, 0, 2)
            L.shade(v.rect(x + 3, top - 5, x + w - 3, top - 4), "cyan", 3)
        elif t["crown"] == 2:                                                 # slanted roof
            L.fill(v.poly([(x, top), (x + w, top), (x + w, top - 6)]), 0.35, "cyan", 0.9, 0, 2)
        for cx, cy, col in t["wins"]:
            m = v.rect(cx, cy, cx + 2, cy + 2)
            if col:
                L.shade(m, col, 3)
                L.shade(v.rect(cx, cy, cx + 2, cy + 1), col, 4 if col != "wh" else 3)
            else:
                L.shade(m, "cyan", 1)
        if t["ant"]:
            ax = x + w // 2
            L.shade(v.rect(ax, top - 16, ax + 1, top), "gr", 3)
            L.shade(v.rect(ax - 2, top - 11, ax + 3, top - 10), "gr", 2)
            L.shade(v.px(ax, top - 17), "red", 2)
    for t, col in UP_SIGNS:                                                   # vertical neon signs
        sx = t["x"] + t["w"] - 2
        sy = t["top"] + 10
        sign = v.rect(sx, sy, sx + 5, sy + 26)
        L.shade(sign, "gr", 0)
        L.shade(v.rect(sx, sy, sx + 5, sy + 1) | v.rect(sx, sy + 25, sx + 5, sy + 26) | v.rect(sx, sy, sx + 1, sy + 26) | v.rect(sx + 4, sy, sx + 5, sy + 26), col, 2)
        for k in range(4):
            L.shade(v.rect(sx + 2, sy + 3 + k * 6, sx + 3, sy + 7 + k * 6), col, 4)
    # cables slung between rooftops
    for a, b in zip(UP_NEAR[::2], UP_NEAR[2::2]):
        x0, y0, x1, y1 = a["x"] + a["w"] - 2, a["top"] + 6, b["x"] + 2, b["top"] + 6
        pts = [(x0 + (x1 - x0) * s, y0 + (y1 - y0) * s + 7 * math.sin(math.pi * s)) for s in np.linspace(0, 1, 12)]
        L.shade(v.path(pts, 1), "gr", 2)
    # the uplink mast: a lattice of two legs and braces, a dish on top aimed up into the sky
    mx, mt = UP_MAST
    legs = v.line(mx - 9, STREET, mx - 2, mt + 10, 1.2) | v.line(mx + 9, STREET, mx + 2, mt + 10, 1.2)
    braces = np.zeros_like(legs)
    for i, y in enumerate(range(STREET - 8, mt + 12, -9)):
        s0, s1 = (STREET - y) / (STREET - mt - 10), (STREET - y - 9) / (STREET - mt - 10)
        w0, w1 = 9 - 7 * s0, 9 - 7 * min(s1, 1)
        braces |= v.line(mx - w0, y, mx + w1, y - 9, 1) if i % 2 else v.line(mx + w0, y, mx - w1, y - 9, 1)
        braces |= v.line(mx - w0, y, mx + w0, y, 1)
    L.shade(braces, "gr", 2)
    L.shade(legs, "gr", 3)
    dish = v.disc(mx - 4, mt + 4, 13, 6) & (v.lin(mx - 14, mt + 12, mx + 8, mt - 6) > 0.45)
    L.fill(dish, 0.2 + 0.8 * v.radial(mx - 8, mt + 2, 16), "wh", 0.9, 1, 3)
    L.edge_top(dish, "cyan", 4)
    L.shade(v.line(mx - 2, mt + 6, mx - 10, mt - 4, 1), "gr", 3)
    L.shade(v.disc(mx - 10, mt - 4, 1.5), "cyan", 4)
    L.fill(v.rect(mx - 6, mt + 10, mx + 6, mt + 16), 0.4, "gr", 0.9, 0, 3)
    L.shade(v.rect(mx - 4, mt + 12, mx - 2, mt + 14), "lime", 4)
    L.shade(v.rect(mx + 1, mt + 12, mx + 3, mt + 14), "mag", 4)
    # street: kerb, wet road with lane dashes, the towers' light smeared in puddles
    L.fill(v.rect(0, STREET, WW, STREET + 4), 0.5, "gr", 0.7, 1, 3)
    L.shade(v.rect(0, STREET, WW, STREET + 1), "cyan", 3)
    road = v.rect(0, STREET + 4, WW, WH)
    L.fill(road, 0.15 + 0.2 * v.vgrad(STREET + 4, WH), "gr", 0.9, 0, 1)
    for x in range(0, WW, 24):
        L.shade(v.rect(x, 232, x + 10, 233), "gr", 3)
    for t in UP_NEAR:
        for cx, cy, col in t["wins"]:
            if not col:
                continue
            ry = STREET + 4 + (STREET - cy) * 0.55
            if ry < WH - 1 and int(ry) % 3 != 0:
                L.speckle(v.rect(cx - 1, ry, cx + 3, ry + 1), 0.5, col, 2)
    L.shade(v.rect(0, 246, WW, 247) & (v.sample(UP_FOG) > 0.5), "cyan", 1)
    return L


def uplink_fx(v, f):
    L = Layer(v)
    # data rain: short falling streaks, each on a seamless 8-frame loop
    for k in range(70):
        x = int(rnd(210, k) * WW)
        span = 8 * (6 + int(rnd(210, k, 1) * 4))
        y = 10 + loop_y(210, k, f, span // 8, span) + rnd(210, k, 2) * (STREET - 30 - span)
        ln = 3 + int(rnd(210, k, 3) * 5)
        rp = "cyan" if k % 5 else ("lime" if k % 2 else "mag")
        L.shade(v.rect(x, y - ln, x + 1, y), rp, 2)
        L.shade(v.px(x, y), rp, 4)
    # window flicker
    wins = [(cx, cy, col) for t in UP_NEAR for cx, cy, col in t["wins"]]
    for k in range(40):
        cx, cy, col = wins[int(rnd(211, k) * len(wins))]
        if (f + int(rnd(211, k, 1) * 8)) % FRAMES < 3:
            L.shade(v.rect(cx, cy, cx + 2, cy + 2), col or "cyan", 4 if col else 2)
    # aircraft-warning lights on the antennas
    for i, t in enumerate(UP_NEAR):
        if t["ant"] and (f + i) % 4 == 0:
            ax = t["x"] + t["w"] // 2
            L.star(ax, t["top"] - 17, "red", 4, 1, 2)
    # the dish pushes rings of signal up into the sky
    mx, mt = UP_MAST
    for k in range(2):
        r = 6 + ((f + k * 4) % FRAMES) * 7
        ring = v.ring(mx - 10, mt - 4, r, 1) & (v.wy < mt - 4 - r * 0.25)
        L.speckle(ring, 1.0 if r < 30 else 0.55, "cyan", 4 if r < 20 else 3)
    if f % 4 < 2:
        L.star(mx - 10, mt - 4, "cyan", 4, 2, 3)
    # a light-rail car sliding along the kerb
    cx = (f * 60 + 40) % WW
    car = v.rect(cx, STREET - 7, cx + 22, STREET)
    L.fill(car, 0.5, "gr", 0.6, 1, 3)
    for k in range(4):
        L.shade(v.rect(cx + 3 + k * 5, STREET - 5, cx + 6 + k * 5, STREET - 3), "lime", 4)
    L.shade(v.rect(cx, STREET + 6, cx + 22, STREET + 7), "lime", 2)
    return L


# =====================================================================================================================
# 1 Foundry: brick smokestacks at dusk (Reboots and Copper). The sky burns copper behind smog, a blast furnace glows in
# the middle, molten copper runs in a channel at the front; smoke rolls out of every stack.
# =====================================================================================================================
FD_SMOG = noise(301, 100, 4, 0.55, 2.2)
FD_SMOG2 = noise(302, 45, 3, 0.6, 1.6)
FD_GROUND = noise(303, 30, 3, 0.55, 2.5)
FG = 196
STACKS = [(36, 74, 13), (92, 104, 15), (150, 62, 11), (330, 96, 14), (392, 70, 12), (444, 112, 16)]  # x, top, width
FURN = (240, 98, 34)  # x, top of the tower, radius
CHAN = 226


def foundry_far(v):
    L = Layer(v)
    horizon_glow(L, v, "ch", 90, FG, 0, 2, None, 0.85)
    horizon_glow(L, v, "sn", 150, FG, 1, 3, FD_SMOG2, 0.6)
    starfield(L, 1, 50, 6, 70, ["wh", "sn"], 0.05)
    # distant sheds with sawtooth roofs
    for k in range(12):
        x = k * 40 + rnd(304, k) * 14
        w = 22 + rnd(304, k, 1) * 16
        h = 10 + rnd(304, k, 2) * 14
        pts = [(x, FG - 4), (x, FG - h)]
        n = int(w // 7)
        for j in range(n):
            pts += [(x + j * w / n + w / n, FG - h - 5), (x + j * w / n + w / n, FG - h)]
        pts += [(x + w, FG - 4)]
        m = v.poly(pts)
        L.fill(m, 0.3, "cu", 0.7, 0, 1)
        if rnd(304, k, 3) < 0.6:
            wx = x + 4 + rnd(304, k, 4) * (w - 8)
            L.shade(v.rect(wx, FG - h + 3, wx + 2, FG - h + 4), "sn", 3)
    return L


def _stack(L, v, x, top, w):
    base = FG + 2
    tw = w * 0.72
    body = v.poly([(x - w / 2, base), (x - tw / 2, top + 6), (x + tw / 2, top + 6), (x + w / 2, base)])
    shade = 0.15 + 0.5 * v.lin(x + w / 2, 0, x - w / 2, 0)
    L.fill(body, shade, "cu", 0.9, 0, 3)
    for y in range(int(top) + 8, base, 3):                                             # brick courses
        L.shade(body & v.rect(0, y, WW, y + 1), "cu", 0)
        off = 0 if (y // 3) % 2 else 2
        for bx in range(int(x - w), int(x + w), 4):
            L.shade(body & v.rect(bx + off, y - 2, bx + off + 1, y), "cu", 0)
    for by in (top + 14, top + 22):                                                    # painted bands
        L.shade(body & v.rect(0, by, WW, by + 2), "wh", 2)
    L.shade(body & v.rect(0, top + 18, WW, top + 20), "red", 2)
    L.fill(v.rect(x - tw / 2 - 2, top, x + tw / 2 + 2, top + 6), 0.5, "gr", 0.8, 1, 3)  # cap
    L.shade(v.rect(x - tw / 2 - 2, top, x + tw / 2 + 2, top + 1), "sn", 3)
    L.shade(v.rect(x - tw / 2, top + 1, x + tw / 2, top + 3), "sn", 4)                  # glow inside the mouth
    for y in range(int(top) + 10, base - 6, 7):                                         # ladder
        L.shade(v.rect(x + tw / 2 - 3, y, x + tw / 2 - 1, y + 1), "gr", 3)
    L.outline(body, "cu", 0, only_empty=True)


def foundry_near(v):
    L = Layer(v)
    # pipes between the stacks (behind them), with flanges
    for (xa, ta, _), (xb, tb, _) in zip(STACKS, STACKS[1:] + STACKS[:1]):
        if xb < xa:
            xb += WW
        y = FG - 22 - (int(xa) % 3) * 6
        if xb - xa > 120:
            continue
        L.fill(v.rect(xa, y, xb, y + 4), 0.2 + 0.6 * v.vgrad(y + 4, y), "gr", 0.8, 0, 3)
        for fx_ in range(int(xa) + 10, int(xb), 16):
            L.shade(v.rect(fx_, y - 1, fx_ + 2, y + 5), "cu", 2)
    for x, top, w in STACKS:
        _stack(L, v, x, top, w)
    # the blast furnace: a riveted tower with a bell top and a glowing mouth
    fx0, ft, fr = FURN
    tower = v.rect(fx0 - fr * 0.6, ft + 16, fx0 + fr * 0.6, FG)
    L.fill(tower, 0.15 + 0.55 * v.lin(fx0 + fr, 0, fx0 - fr, 0), "gr", 0.9, 0, 3)
    for y in range(ft + 22, FG, 10):
        L.shade(tower & v.rect(0, y, WW, y + 1), "gr", 0)
        for rx in range(int(fx0 - fr * 0.6) + 2, int(fx0 + fr * 0.6), 5):
            L.shade(v.px(rx, y + 2), "gr", 4)
    bell = v.poly([(fx0 - fr * 0.6, ft + 16), (fx0 - 8, ft), (fx0 + 8, ft), (fx0 + fr * 0.6, ft + 16)])
    L.fill(bell, 0.2 + 0.6 * v.lin(fx0 + 20, 0, fx0 - 20, 0), "cu", 0.9, 0, 3)
    L.edge_top(bell, "cu", 4)
    L.fill(v.rect(fx0 - 3, ft - 18, fx0 + 3, ft), 0.4, "gr", 0.8, 0, 3)                # flue
    L.shade(v.rect(fx0 - 4, ft - 20, fx0 + 4, ft - 18), "gr", 4)
    mouth = v.disc(fx0, FG - 18, 12, 10) & (v.wy < FG - 8)
    L.fill(mouth, 0.4 + 0.6 * v.radial(fx0, FG - 12, 12), "sn", 0.9, 2, 4)
    L.outline(mouth, "gr", 1)
    glow(L, v, fx0, FG - 10, 36, "cu", 1, 3, 16)
    L.shade(v.rect(fx0 - 12, FG - 8, fx0 + 12, FG - 6), "gr", 3)
    # side ducts down into the furnace
    for sx in (-1, 1):
        L.shade(v.line(fx0 + sx * 8, ft + 2, fx0 + sx * 34, ft + 32, 4), "gr", 2)
        L.shade(v.line(fx0 + sx * 8, ft + 1, fx0 + sx * 34, ft + 31, 1), "gr", 4)
    # catwalk across the front on a truss
    cw = FG - 40
    L.shade(v.rect(0, cw, WW, cw + 2) & ~v.rect(fx0 - 24, 0, fx0 + 24, WH), "gr", 3)
    for x in range(0, WW, 12):
        if abs(((x - fx0) + WW / 2) % WW - WW / 2) < 26:
            continue
        L.shade(v.rect(x, cw - 7, x + 1, cw), "gr", 2)
    L.shade(v.rect(0, cw - 7, WW, cw - 6) & ~v.rect(fx0 - 24, 0, fx0 + 24, WH), "gr", 2)
    # ground: slag and dirt, scattered ingots, the copper channel
    g = v.sample(FD_GROUND)
    ground = v.rect(0, FG, WW, WH)
    L.fill(ground, 0.1 + 0.3 * g * (1 - v.vgrad(FG, WH) * 0.5), "cu", 0.9, 0, 2)
    L.shade(v.rect(0, FG, WW, FG + 1), "cu", 3)
    for k in range(18):
        x, y = rnd(305, k) * WW, FG + 8 + rnd(305, k, 1) * 60
        if abs(y - CHAN) < 8:
            continue
        L.fill(v.poly([(x, y), (x + 6, y), (x + 5, y - 3), (x + 1, y - 3)]), 0.6, "cu", 0.8, 1, 4)
    chan = v.rect(0, CHAN - 3, WW, CHAN + 3)
    L.shade(chan, "gr", 0)
    L.shade(v.rect(0, CHAN - 4, WW, CHAN - 3) | v.rect(0, CHAN + 3, WW, CHAN + 4), "gr", 2)
    L.fill(v.rect(0, CHAN - 2, WW, CHAN + 2), 0.55 + 0.4 * v.sample(FD_SMOG2), "sn", 0.9, 2, 4)
    L.speckle(v.rect(0, CHAN + 4, WW, CHAN + 14), 0.3 * (1 - v.vgrad(CHAN + 4, CHAN + 14)), "cu", 3)
    return L


def foundry_fx(v, f):
    L = Layer(v)
    # smoke: puffs rise and swell from every stack, each stack on its own phase
    for i, (x, top, w) in enumerate(STACKS):
        for j in range(3):
            t = (f + j * 3 + i) % FRAMES + j * 8
            y = top - 3 - t * 3.2
            r = 3 + t * 0.7
            if y < 26:
                continue
            dens = v.radial(x + t * 1.6, y, r) * (0.95 - t / 30)
            L.gas(dens, "eg" if (i + j) % 2 else "gr", 0, 2)
    # sparks from the furnace mouth, thrown in arcs
    fx0 = FURN[0]
    for k in range(14):
        t = (f + int(rnd(320, k) * 8)) % FRAMES
        vx = (rnd(320, k, 1) - 0.5) * 9
        vy = -3 - rnd(320, k, 2) * 4
        x, y = fx0 + vx * t, FG - 16 + vy * t + 0.55 * t * t
        if y < FG:
            L.shade(v.px(x, y), "sn", 4 if t < 4 else 3)
    # the furnace mouth flickers
    if f % 3 != 1:
        L.speckle(v.disc(fx0, FG - 16, 10, 7) & (v.wy < FG - 8), 0.45, "wh", 4)
    # molten copper creeps along the channel; bright beads advance 4 px a frame
    for k in range(16):
        x = (k * 30 + f * 4) % WW
        L.shade(v.rect(x, CHAN - 1, x + 3, CHAN + 1), "wh", 4)
        L.shade(v.rect(x + 3, CHAN - 1, x + 6, CHAN + 1), "sn", 4)
    # warning lights on the stack caps
    for i, (x, top, w) in enumerate(STACKS):
        if (f + i * 3) % 6 < 2:
            L.star(x, top - 1, "red", 4, 1, 2)
    return L


# =====================================================================================================================
# 2 Wafer: a giant silicon wafer rises over the fab plain like a moon, its dies catching rainbow light. The plain is a
# circuit board: blue traces with gold pads, black chips with silver legs, clean domes and a robot arm.
# =====================================================================================================================
WF_SKY = noise(401, 110, 4, 0.55, 2.0)
WF_GROUND = noise(402, 40, 3, 0.55, 2.2)
WAFER = (240, 112, 64)
WG = 194


def _traces():
    rng = np.random.default_rng(403)
    out = []
    for k in range(18):
        x = rng.integers(0, WW)
        y = int(rng.integers(WG + 6, WH - 6))
        pts = [(x, y)]
        for s in range(int(rng.integers(3, 6))):
            if s % 2 == 0:
                x = x + int(rng.integers(14, 50)) * (1 if rng.random() < 0.5 else -1)
            else:
                y = int(np.clip(y + rng.integers(-14, 15), WG + 6, WH - 4))
            pts.append((x, y))
        out.append(pts)
    return out


TRACES = _traces()
CHIPS = [(40, 222, 22, 12), (118, 246, 28, 14), (176, 210, 16, 9), (318, 214, 18, 10), (372, 244, 30, 15), (440, 216, 20, 11), (250, 256, 24, 10)]


def wafer_far(v):
    L = Layer(v)
    s = v.sample(WF_SKY)
    horizon_glow(L, v, "si", 40, WG, 0, 2, WF_SKY, 0.85)
    horizon_glow(L, v, "vs", 120, WG, 0, 1, None, 0.5)
    starfield(L, 2, 120, 6, 150, ["wh", "si", "pu"], 0.1)
    L.gas(np.clip((s - 0.6) * 2.2, 0, 1) * (v.wy < 120), "vs", 0, 1)
    return L


def wafer_near(v):
    L = Layer(v)
    cx, cy, R = WAFER
    halo = v.radial(cx, cy, R + 26) ** 1.6
    L.gas(halo * (v.dist(cx, cy) > R), "si", 0, 2)
    disc = v.disc(cx, cy, R) & (v.wy < cy + R - 8)                    # flat at the bottom (the wafer's own flat)
    L.fill(disc, 0.15 + 0.35 * v.lin(cx + R, cy + R, cx - R, cy - R), "si", 0.9, 0, 2)
    # dies: a grid of squares, each tinted by its angle around the centre like diffraction
    ang = v.angle(cx - 20, cy - 30)
    hue = (np.sin(ang * 2 + 0.6) + 1) / 2
    for gx in range(-8, 9):
        for gy in range(-8, 9):
            x0, y0 = cx + gx * 8 - 3, cy + gy * 8 - 3
            if math.hypot(gx * 8, gy * 8) > R - 8 or y0 + 6 > cy + R - 10:
                continue
            die = v.rect(x0, y0, x0 + 6, y0 + 6)
            k = rnd(404, gx, gy)
            rp = "si" if k < 0.45 else ("pu" if k < 0.65 else ("qz" if k < 0.82 else "vs"))
            L.fill(die, 0.35 + 0.5 * hue, rp, 0.9, 1, 3)
            L.shade(v.rect(x0, y0, x0 + 6, y0 + 1), rp, 3)
            if rnd(405, gx, gy) < 0.18:
                L.shade(v.rect(x0 + 2, y0 + 2, x0 + 4, y0 + 4), "wh", 4)
    L.shade(v.ring(cx, cy, R, 1) & (v.wy < cy + R - 8), "si", 4)
    L.shade(v.rect(cx - 25, cy + R - 9, cx + 25, cy + R - 8), "si", 4)
    sheen = v.line(cx - 46, cy - 12, cx - 8, cy - 50, 3) & disc
    L.speckle(sheen, 0.6, "wh", 4)
    # cradle the wafer sits in
    L.fill(v.poly([(cx - 40, WG), (cx - 30, cy + R - 4), (cx + 30, cy + R - 4), (cx + 40, WG)]), 0.4, "gr", 0.8, 0, 3)
    L.shade(v.rect(cx - 30, cy + R - 4, cx + 30, cy + R - 3), "si", 3)
    # fab buildings left and right: long low halls with vents and blue strip windows, two clean domes
    for x, w, h in ((16, 70, 20), (100, 40, 30), (330, 46, 26), (392, 74, 18)):
        hall = v.rect(x, WG - h, x + w, WG)
        L.fill(hall, 0.2 + 0.4 * v.vgrad(WG, WG - h), "wh", 0.8, 0, 2)
        L.shade(v.rect(x, WG - h, x + w, WG - h + 1), "wh", 3)
        L.shade(v.rect(x + 3, WG - h + 5, x + w - 3, WG - h + 7), "si", 3)
        for vx in range(x + 6, x + w - 6, 12):
            L.fill(v.rect(vx, WG - h - 6, vx + 4, WG - h), 0.5, "gr", 0.7, 1, 3)
            L.shade(v.rect(vx - 1, WG - h - 7, vx + 5, WG - h - 6), "gr", 4)
    for dx, r in ((160, 14), (306, 11)):
        dome = v.disc(dx, WG, r, r * 0.8) & (v.wy < WG)
        L.fill(dome, 0.15 + 0.85 * v.radial(dx - r * 0.4, WG - r * 0.6, r * 1.4), "wh", 0.9, 0, 3)
        L.shade(v.rect(dx - 1, WG - r * 0.8, dx + 1, WG) & dome, "si", 3)
    # robot arm leaning toward the wafer
    ax = 196
    L.fill(v.rect(ax - 6, WG - 6, ax + 6, WG), 0.4, "gr", 0.8, 1, 3)
    L.shade(v.line(ax, WG - 6, ax - 6, WG - 34, 4), "wh", 2)
    L.shade(v.line(ax - 6, WG - 34, ax + 10, WG - 50, 3), "wh", 3)
    L.shade(v.disc(ax - 6, WG - 34, 3), "gr", 3)
    L.shade(v.line(ax + 10, WG - 50, ax + 15, WG - 46, 1) | v.line(ax + 10, WG - 50, ax + 14, WG - 54, 1), "gr", 4)
    # the board
    g = v.sample(WF_GROUND)
    L.fill(v.rect(0, WG, WW, WH), 0.08 + 0.3 * g * (1 - v.vgrad(WG, WH) * 0.4), "si", 0.9, 0, 1)
    L.shade(v.rect(0, WG, WW, WG + 1), "si", 3)
    for pts in TRACES:
        L.shade(v.path(pts, 1), "si", 2)
        for (x, y) in (pts[0], pts[-1]):
            L.shade(v.rect(x - 1, y - 1, x + 2, y + 2), "rn", 3)
    for x, y, w, h in CHIPS:
        L.fill(v.rect(x, y, x + w, y + h), 0.15 + 0.2 * v.lin(x + w, y + h, x, y), "gr", 0.8, 0, 1)
        L.shade(v.rect(x, y, x + w, y + 1), "gr", 3)
        L.shade(v.disc(x + 3, y + 3, 1), "gr", 3)
        for px in range(x + 2, x + w - 1, 3):
            L.shade(v.rect(px, y - 2, px + 1, y) | v.rect(px, y + h, px + 1, y + h + 2), "wh", 3)
    return L


def wafer_fx(v, f):
    L = Layer(v)
    twinkles(L, f, 420, 30, 8, 140, ["wh", "si", "pu"])
    # packets running along the traces, one segment a frame
    for k, pts in enumerate(TRACES):
        segs = list(zip(pts, pts[1:]))
        tot = sum(abs(b[0] - a[0]) + abs(b[1] - a[1]) for a, b in segs)
        d = ((f / FRAMES) + rnd(421, k)) % 1 * tot
        for (x0, y0), (x1, y1) in segs:
            ln = abs(x1 - x0) + abs(y1 - y0)
            if d <= ln:
                s = d / (ln or 1)
                x, y = x0 + (x1 - x0) * s, y0 + (y1 - y0) * s
                L.shade(v.rect(x - 1, y - 1, x + 2, y + 2), "pu", 4)
                L.shade(v.px(x, y), "wh", 4)
                break
            d -= ln
    # dies light in a wandering pattern
    cx, cy, R = WAFER
    for k in range(10):
        gx, gy = int(rnd(422, k, f // 2) * 13) - 6, int(rnd(423, k, f // 2) * 13) - 6
        x0, y0 = cx + gx * 8 - 3, cy + gy * 8 - 3
        if math.hypot(gx * 8, gy * 8) > R - 8 or y0 + 6 > cy + R - 10:
            continue
        L.shade(v.rect(x0, y0, x0 + 6, y0 + 6), "pu" if k % 2 else "si", 4)
    # a glint slides round the rim
    a = TAU * f / FRAMES - 2.2
    gx, gy = cx + R * math.cos(a), cy + R * math.sin(a)
    if gy < cy + R - 9:
        L.star(gx, gy, "wh", 4, 3, 3)
    if f % 4 < 2:
        L.shade(v.disc(210, WG - 50, 1.5), "lime", 4)
    return L


# =====================================================================================================================
# 3 Lattice: the crystal vault. Faceted quartz spires stand in clusters on dark rock under a violet sky, with cyan and pink
# stones among the purple; loose shards float above and glints run down their faces.
# =====================================================================================================================
LT_SKY = noise(501, 100, 4, 0.55, 1.8)
LT_ROCK = noise(502, 34, 4, 0.6, 1.8)
LG = 200


def _crystals():
    rng = np.random.default_rng(503)
    out = []
    for cl in range(8):
        cx = cl * 60 + rng.integers(0, 30)
        n = int(rng.integers(3, 6))
        for j in range(n):
            x = cx + rng.integers(-22, 23)
            h = int(rng.integers(26, 104)) if j == 0 else int(rng.integers(14, 60))
            w = max(5, int(h * rng.uniform(0.16, 0.24)))
            tilt = rng.uniform(-0.28, 0.28)
            base = LG + int(rng.integers(0, 10))
            rp = "qz" if rng.random() < 0.72 else ("pu" if rng.random() < 0.5 else "nb")
            out.append((x, base, h, w, tilt, rp))
    out.sort(key=lambda c: c[1] + c[2] * 0.01 - c[2] * 0.0)
    return out


CRYSTALS = _crystals()
LT_FLOAT = [(52, 92, 7), (130, 70, 5), (204, 104, 4), (286, 80, 8), (362, 110, 5), (430, 76, 6)]


def crystal(L, v, x, base, h, w, tilt, rp, shade_bias=0.0):
    dx = tilt * h
    tip = (x + dx, base - h)
    sh = base - h + w * 1.3
    l, m, r = (x - w / 2, base), (x + dx * 0.15, base), (x + w / 2, base)
    sl, sr = (x - w / 2 + dx * (1 - (base - sh) / h * 0 - 0.0) * 0.8, sh), (x + w / 2 + dx * 0.8, sh)
    left = v.poly([l, sl, (tip[0] - w * 0.05, tip[1] + w * 0.6), tip, (sl[0] + w * 0.45, sh + 2), (m[0], base)])
    right = v.poly([(m[0], base), (sl[0] + w * 0.45, sh + 2), tip, sr, r])
    L.fill(left, 0.55 + 0.4 * v.vgrad(base, base - h) + shade_bias, rp, 0.9, 1, 4)
    L.fill(right, 0.1 + 0.35 * v.vgrad(base, base - h) + shade_bias, rp, 0.9, 0, 2)
    L.shade(v.line(sl[0] + w * 0.45, sh + 2, tip[0], tip[1], 1), rp, 4)
    L.shade(v.line(m[0], base, sl[0] + w * 0.45, sh + 2, 1), rp, 3)
    L.outline(left | right, rp, 0, only_empty=True)
    return left | right


def lattice_far(v):
    L = Layer(v)
    s = v.sample(LT_SKY)
    horizon_glow(L, v, "qz", 50, LG, 0, 2, LT_SKY, 0.95)
    L.gas(np.clip((s - 0.55) * 2.4, 0, 1) * np.clip(1 - np.abs(v.wy - 90) / 50, 0, 1), "nb", 0, 2)
    starfield(L, 3, 130, 6, 150, ["wh", "qz", "pu", "nb"], 0.1)
    rf = hills(504, 162, 10, (3, 7, 17))
    jag = v.wy >= rf(v.wx % WW) - 14 * np.abs(((v.wx * 0.09) % 2) - 1)
    L.fill(jag & (v.wy < LG + 2), 0.3 * v.vgrad(140, LG), "qz", 0.8, 0, 1)
    L.edge_top(jag, "qz", 2)
    return L


def lattice_near(v):
    L = Layer(v)
    rock = v.sample(LT_ROCK)
    rf = hills(505, LG + 2, 3, (4, 9, 19))
    ground = below(v, rf)
    L.fill(ground, 0.06 + 0.35 * rock * (1 - v.vgrad(LG, WH) * 0.6), "vs", 0.9, 0, 2)
    L.edge_top(ground, "qz", 3)
    for (x, base, h, w, tilt, rp) in CRYSTALS:
        glow(L, v, x, base - h * 0.3, h * 0.55, rp, 0, 1, h * 0.7)
    for (x, base, h, w, tilt, rp) in CRYSTALS:
        crystal(L, v, x, base, h, w, tilt, rp)
    # small crystals studding the ground, and a crystal-lit pool
    for k in range(40):
        x, y = rnd(506, k) * WW, LG + 12 + rnd(506, k, 1) * 56
        h = 4 + rnd(506, k, 2) * 8
        crystal(L, v, x, y, h, max(3, h * 0.35), (rnd(506, k, 3) - 0.5) * 0.6, "qz" if k % 4 else "pu")
    pool = v.disc(250, 244, 52, 7)
    L.fill(pool, 0.2 + 0.5 * v.radial(250, 244, 52, 7), "qz", 0.9, 0, 3)
    L.shade(v.ring(250, 244, 52, 1, 7) & (v.wy < 244), "qz", 4)
    return L


def lattice_fx(v, f):
    L = Layer(v)
    twinkles(L, f, 520, 40, 6, 150, ["wh", "qz", "pu", "nb"])
    # floating shards bob a pixel up and down
    for k, (x, y, s) in enumerate(LT_FLOAT):
        dy = round(1.5 * math.sin(TAU * (f / FRAMES) + k))
        crystal(L, v, x, y + dy + s * 2, s * 2.4, s, 0.15 * (k % 3 - 1), "qz" if k % 3 else "pu")
        L.shade(v.px(x, y + dy + s * 2 + 4), "qz", 2)
    # glints run down the faces of the tallest spires
    tall = sorted(CRYSTALS, key=lambda c: -c[2])[:7]
    for k, (x, base, h, w, tilt, rp) in enumerate(tall):
        t = (f + k * 3) % FRAMES
        if t > 4:
            continue
        s = t / 4
        gx = x + tilt * h * (1 - s) - w * 0.15
        gy = base - h + h * s * 0.85
        L.star(gx, gy, "wh", 4, 1, 4)
    # motes drift up out of the pool
    for k in range(10):
        x = 210 + rnd(521, k) * 80
        y = 240 - loop_y(521, k, f, 3, 24) - rnd(521, k, 2) * 20
        L.shade(v.px(x, y), "nb" if k % 3 == 0 else "qz", 4)
    return L


# =====================================================================================================================
# 4 Aurora: the signal void. Green curtains of aurora with a pink fringe hang over snow peaks; a frozen lake mirrors them
# and a listening station keeps one warm window lit. The curtains drift; rays run through them.
# =====================================================================================================================
AU_CURT = noise(601, 120, 3, 0.5, 2.6)
AU_FINE = noise(602, 30, 3, 0.55, 0.25)
LAKE = 206
STATION = (96, LAKE - 2)


def _curtain(v):
    """Two curtains, each bright along its lower hem and fading upward, broken into vertical rays."""
    x = v.wx
    c1 = 104 + 16 * np.sin(TAU * x / WW * 2 + 0.4) + 9 * np.sin(TAU * x / WW * 5 + 1.3)
    c2 = 132 + 10 * np.sin(TAU * x / WW * 3 + 2.1) + 6 * np.sin(TAU * x / WW * 7)
    rays = np.clip((v.sample(AU_FINE) - 0.18) * 1.5, 0, 1)
    a = np.exp(-np.clip(c1 - v.wy, 0, 300) / 34) * (v.wy <= c1 + 1) * rays
    b = np.exp(-np.clip(c2 - v.wy, 0, 300) / 24) * (v.wy <= c2 + 1) * rays
    return np.clip(a * (0.35 + 0.9 * v.sample(AU_CURT)), 0, 0.95), np.clip(b * (1.2 - v.sample(AU_CURT)), 0, 0.85), c1, c2


def aurora_far(v):
    L = Layer(v)
    starfield(L, 4, 160, 4, 190, ["wh", "ae", "sg"], 0.1)
    a, b, c1, c2 = _curtain(v)
    up = (v.wy < c1 - 40) & (v.wy > c1 - 90)
    L.gas(np.clip(1 - np.abs(v.wy - (c1 - 62)) / 28, 0, 1) * up * 0.55 * v.sample(AU_CURT), "nb", 0, 2)  # pink upper fringe
    L.gas(a, "ae", 0, 4)
    L.gas(b * 0.9, "ae", 0, 3)
    L.gas(np.clip(1 - np.abs(v.wy - c1 - 1) / 2, 0, 1) * v.sample(AU_CURT) * v.sample(AU_FINE) * 0.8, "wh", 2, 3)  # bright hem
    return L


def aurora_near(v):
    L = Layer(v)
    far = hills(603, 168, 12, (3, 7, 15))
    peaks = v.wy >= far(v.wx % WW) - 20 * np.abs(((v.wx * 0.035 + 0.3) % 2) - 1) ** 1.5
    pm = peaks & (v.wy < LAKE)
    L.fill(pm, 0.15 + 0.25 * (1 - v.vgrad(140, LAKE)), "sg", 0.9, 0, 1)
    snow = pm & (v.wy < far(v.wx % WW) - 8)
    L.fill(snow, 0.5 + 0.4 * v.lin(480, 0, 0, 0) * 0, "wh", 0.9, 1, 3)
    L.edge_top(peaks, "ae", 3)
    near = hills(604, LAKE - 8, 6, (2, 5, 13))
    hm = below(v, near) & (v.wy < LAKE)
    L.fill(hm, 0.1, "ae", 0.6, 0, 1)
    # pines along the shore
    for k in range(46):
        x = rnd(605, k) * WW
        h = 8 + rnd(605, k, 1) * 14
        b = near(x % WW) + 2
        tree = v.poly([(x, b - h), (x - h * 0.28, b), (x + h * 0.28, b)])
        L.fill(tree & (v.wy < LAKE), 0.1, "or", 0.6, 0, 1)
        L.shade(v.rect(x, b - h, x + 1, b - h + 2), "ae", 2)
    # the listening station: a hut, a dish and a mast
    sx, sy = STATION
    hut = v.rect(sx - 12, sy - 10, sx + 12, sy)
    L.fill(hut, 0.3, "gr", 0.8, 0, 2)
    L.fill(v.poly([(sx - 14, sy - 10), (sx, sy - 18), (sx + 14, sy - 10)]), 0.7, "wh", 0.8, 1, 3)
    L.shade(v.rect(sx - 6, sy - 7, sx - 2, sy - 3), "rn", 4)
    L.shade(v.rect(sx + 3, sy - 7, sx + 6, sy), "gr", 0)
    L.shade(v.rect(sx + 18, sy - 44, sx + 19, sy), "gr", 3)
    for y in range(sy - 40, sy, 6):
        L.shade(v.line(sx + 15, y, sx + 22, y + 6, 1), "gr", 2)
    dish = v.disc(sx - 22, sy - 14, 7, 4) & (v.lin(sx - 30, sy - 8, sx - 14, sy - 22) > 0.5)
    L.fill(dish, 0.6, "wh", 0.8, 1, 3)
    L.shade(v.rect(sx - 22, sy - 12, sx - 21, sy), "gr", 2)
    # frozen lake: dark ice with the aurora's light lying across it in broken bands
    lake = v.rect(0, LAKE, WW, WH)
    L.fill(lake, 0.08 + 0.15 * v.vgrad(LAKE, WH), "sg", 0.9, 0, 1)
    L.shade(v.rect(0, LAKE, WW, LAKE + 1), "ae", 2)
    fine = v.sample(AU_FINE)
    for y in range(LAKE + 3, WH, 3):
        band = v.rect(0, y, WW, y + 1) & (v.sample(AU_CURT) > 0.45 + (y - LAKE) / 200)
        L.speckle(band, 0.6 * fine + 0.2, "ae", 2 if y < LAKE + 30 else 1)
    L.speckle(v.rect(sx - 8, LAKE + 2, sx - 1, LAKE + 22) & (v.wy.astype(int) % 2 == 0), 0.6, "rn", 2)
    return L


def aurora_fx(v, f):
    L = Layer(v)
    twinkles(L, f, 620, 40, 4, 150, ["wh", "ae", "sg"])
    # bright rays travel through the curtains
    a, b, c1, c2 = _curtain(v)
    for k in range(9):
        x = (rnd(621, k) * WW + f * 6) % WW
        ray = (np.abs(v.dx(x)) < 0.6 + 0.4 * (k % 2)) & (v.wy < c1 + 1) & (v.wy > c1 - 30 - 24 * rnd(621, k, 1))
        L.speckle(ray, 0.75 - (c1 - v.wy) / 70, "ae", 3)
    # shimmer: dots in the lower curtain flicker on alternate frames
    sh = (b > 0.35) & (((v.wx.astype(int) + v.wy.astype(int) + f) % 4) == 0)
    L.shade(sh, "ae", 3)
    # glints sliding across the ice
    for k in range(16):
        x = (rnd(622, k) * WW + f * 3) % WW
        y = LAKE + 4 + rnd(622, k, 1) * 50
        if (f + k) % 4 < 2:
            L.shade(v.rect(x, y, x + 3, y + 1), "ae", 4)
    sx, sy = STATION
    if f % 4 == 0:
        L.star(sx + 18, sy - 45, "red", 4, 1, 2)
    if f in (2, 3, 6):
        L.speckle(v.disc(sx - 4, sy - 5, 6), 0.35, "rn", 3)
    return L


# =====================================================================================================================
# 5 Monolith: the glyph hall in the open. Rune-cut standing stones on a gold dusk plain under a ringed moon, a ring of
# light in the ground between them, braziers burning. Runes light in turn; motes rise.
# =====================================================================================================================
MN_SKY = noise(701, 110, 4, 0.55, 2.2)
MN_GROUND = noise(702, 36, 4, 0.6, 2.2)
MG = 200
MOON = (382, 70, 26)
STONES = [(34, 74, 22, -0.04), (92, 52, 16, 0.05), (150, 92, 24, 0.0), (214, 60, 18, -0.06), (280, 104, 26, 0.03), (346, 64, 18, 0.07), (420, 84, 22, -0.03)]
RING = (240, 236, 120, 16)
BRAZIERS = (124, 254, 316, 388)
GLYPHS = [
    [(0, 0, 0, 4), (0, 0, 3, 0), (0, 2, 2, 2)],
    [(0, 4, 2, 0), (2, 0, 4, 4)],
    [(0, 0, 4, 0), (2, 0, 2, 4)],
    [(0, 0, 0, 4), (0, 4, 3, 4), (3, 4, 3, 1)],
    [(0, 0, 4, 4), (4, 0, 0, 4)],
    [(0, 2, 4, 2), (2, 0, 2, 4), (0, 0, 0, 1)],
]


def _rune_slots():
    out = []
    for i, (x, h, w, t) in enumerate(STONES):
        for j in range(int((h - 14) // 9)):
            y = MG - h + 8 + j * 9
            gx = x - 2 + t * (MG - y)
            out.append((gx, y, (i * 3 + j) % len(GLYPHS)))
    return out


RUNES = _rune_slots()


def glyph(L, v, x, y, g, ramp, sh, w=1):
    for x0, y0, x1, y1 in GLYPHS[g]:
        L.shade(v.line(x + x0, y + y0, x + x1, y + y1, w), ramp, sh)


def monolith_far(v):
    L = Layer(v)
    s = v.sample(MN_SKY)
    horizon_glow(L, v, "sn", 80, MG, 0, 3, MN_SKY, 1.0)
    horizon_glow(L, v, "rn", 130, MG, 1, 3, None, 0.7)
    starfield(L, 5, 80, 4, 110, ["wh", "rn", "sn"], 0.08)
    L.gas(np.clip((s - 0.6) * 2, 0, 1) * np.clip(1 - np.abs(v.wy - 120) / 30, 0, 1), "eg", 0, 2)
    # mesas on the horizon
    for k in range(5):
        x = k * 96 + rnd(703, k) * 40
        w, h = 40 + rnd(703, k, 1) * 40, 14 + rnd(703, k, 2) * 18
        m = v.poly([(x, MG), (x + 6, MG - h), (x + w - 8, MG - h), (x + w, MG)])
        L.fill(m, 0.2 + 0.2 * v.vgrad(MG, MG - h), "eg", 0.8, 0, 1)
        L.edge_top(m, "rn", 2)
    return L


def monolith_near(v):
    L = Layer(v)
    mx, my, mr = MOON
    # ringed moon: crescent lit from the low sun, ring tilted across it
    L.gas(v.radial(mx, my, mr + 20) ** 1.5 * (v.dist(mx, my) > mr), "rn", 0, 1)
    body = v.disc(mx, my, mr)
    lit = v.disc(mx - 9, my + 6, mr)
    L.fill(body, 0.1, "eg", 0.6, 0, 1)
    L.fill(body & ~lit, 0.3 + 0.7 * v.lin(mx + mr, my - mr, mx - mr, my + mr), "rn", 0.9, 1, 4)
    ring_back = v.ring(mx, my, mr + 14, 2, 5) & (v.wy < my) & ~body
    ring_front = v.ring(mx, my, mr + 14, 2, 5) & (v.wy >= my)
    L.shade(ring_back, "sn", 2)
    L.shade(ring_front, "sn", 3)
    L.shade(v.ring(mx, my, mr + 18, 1, 6) & (v.wy >= my - 1), "sn", 1)
    # ground
    g = v.sample(MN_GROUND)
    gr = hills(704, MG, 2, (3, 7, 13))
    ground = below(v, gr)
    L.fill(ground, 0.1 + 0.35 * g * (1 - v.vgrad(MG, WH) * 0.5), "eg", 0.9, 0, 2)
    L.edge_top(ground, "rn", 3)
    # the ring of light set into the ground, with small stones around it
    rx, ry, rw, rh = RING
    L.shade(v.ring(rx, ry, rw, 2, rh), "rn", 2)
    L.shade(v.ring(rx, ry, rw - 10, 1, rh - 4), "rn", 1)
    for k in range(14):
        a = TAU * k / 14
        x, y = rx + (rw + 8) * math.cos(a), ry + (rh + 3) * math.sin(a)
        L.fill(v.rect(x - 2, y - 6, x + 2, y), 0.4, "gr", 0.8, 0, 3)
    # the stones, carved
    for i, (x, h, w, t) in enumerate(STONES):
        top = MG - h
        pts = [(x - w / 2, MG + 2), (x - w / 2 + t * h + 1, top + 3), (x - w / 2 + t * h + 4, top), (x + w / 2 + t * h - 3, top - 1), (x + w / 2 + t * h, top + 4), (x + w / 2, MG + 2)]
        st = v.poly(pts)
        L.fill(st, 0.12 + 0.5 * v.lin(x + w / 2, 0, x - w / 2, 0) + 0.1 * v.sample(MN_GROUND), "gr", 0.9, 0, 3)
        L.shade(st & v.line(x - w / 2, MG, x - w / 2 + t * h + 1, top + 3, 1.5), "rn", 3)   # sunlit edge
        L.edge_top(st, "rn", 3)
        L.outline(st, "eg", 0, only_empty=True)
        for y in range(top + 6, MG, 11):                                                    # cracks and weathering
            if rnd(705, i, y) < 0.4:
                L.shade(st & v.line(x - w / 2 + 2, y, x - w / 2 + 6, y + 3, 1), "gr", 0)
    for gx, y, g in RUNES:
        glyph(L, v, gx, y, g, "rn", 2)
    # braziers
    for x in BRAZIERS:
        L.shade(v.rect(x, MG + 10 - 22, x + 1, MG + 10), "gr", 3)
        L.fill(v.poly([(x - 5, MG - 14), (x + 6, MG - 14), (x + 3, MG - 9), (x - 2, MG - 9)]), 0.5, "eg", 0.8, 1, 3)
        glow(L, v, x + 0.5, MG - 18, 12, "sn", 0, 2)
    return L


def monolith_fx(v, f):
    L = Layer(v)
    twinkles(L, f, 720, 24, 4, 100, ["wh", "rn"])
    # runes catch light in a wave that walks along the stones
    for k, (gx, y, g) in enumerate(RUNES):
        ph = (k * 3 + f) % 12
        if ph < 3:
            glyph(L, v, gx, y, g, "rn", 4)
            if ph == 1:
                L.speckle(v.disc(gx + 2, y + 2, 5) & ~v.rect(gx, y, gx + 5, y + 5), 0.3, "rn", 3)
    # light runs round the ground ring
    rx, ry, rw, rh = RING
    for k in range(3):
        a = TAU * (f / FRAMES + k / 3)
        for j in range(4):
            aa = a - j * 0.06
            L.shade(v.px(rx + rw * math.cos(aa), ry + rh * math.sin(aa), 2), "rn", 4 - min(j, 2))
    # brazier flames
    for i, x in enumerate(BRAZIERS):
        t = (f + i * 2) % FRAMES
        h = 6 + (t % 3) * 2
        flame = v.poly([(x - 4, MG - 14), (x + 0.5 + (t % 2 - 0.5) * 2, MG - 14 - h), (x + 5, MG - 14)])
        L.fill(flame, 0.5 + 0.5 * v.vgrad(MG - 14 - h, MG - 14), "sn", 0.9, 2, 4)
        L.shade(v.px(x + 0.5, MG - 15 - (t % 2)), "wh", 4)
    # glyph motes rise from the ring
    for k in range(12):
        x = rx - rw + rnd(721, k) * rw * 2
        y = ry - 6 - loop_y(721, k, f, 4, 32) - rnd(721, k, 1) * 30
        if (k + f) % 3:
            L.shade(v.px(x, y), "rn", 4 if k % 2 else 3)
    return L


# =====================================================================================================================
# 6 Glass: the prism court. Shards of starglass hang in a night sky over a glass sea; bigger shards break the surface as
# islands, a glass conservatory stands on the largest. Glints run across the shards, sparkles across the water, and a
# shooting star crosses once a loop.
# =====================================================================================================================
GL_SKY = noise(801, 100, 4, 0.55, 2.0)
GL_SEA = noise(802, 40, 3, 0.55, 3.0)
SEA = 196
SKY_SHARDS = [(40, 96, 10, 0.4), (98, 62, 7, -0.3), (156, 112, 6, 0.2), (300, 76, 9, -0.2), (356, 120, 6, 0.5), (420, 84, 11, -0.4), (466, 130, 5, 0.1)]
ISLANDS = [(70, 34, 18, 0.25), (210, 58, 30, -0.1), (250, 30, 16, 0.3), (380, 44, 22, -0.25)]  # x, height, width, tilt
CONS = (214, SEA - 30)


def shard(L, v, x, y, s, rot, ramp="sg", hi=4):
    pts = []
    for k, (r, a) in enumerate(((s * 2.6, -1.57), (s * 0.9, 0.2), (s * 2.2, 1.57), (s * 0.8, 3.0))):
        pts.append((x + r * math.cos(a + rot), y + r * math.sin(a + rot)))
    m = v.poly(pts)
    L.fill(m, 0.2 + 0.6 * v.lin(pts[1][0], pts[1][1], pts[3][0], pts[3][1]), ramp, 0.9, 0, hi - 1)
    L.shade(v.line(pts[0][0], pts[0][1], pts[2][0], pts[2][1], 1) & m, ramp, hi)
    L.outline(m, ramp, 2, only_empty=True)
    return m, pts


def glass_far(v):
    L = Layer(v)
    s = v.sample(GL_SKY)
    horizon_glow(L, v, "sg", 60, SEA, 0, 2, GL_SKY, 0.9)
    L.gas(np.clip((s - 0.55) * 2.2, 0, 1) * np.clip(1 - np.abs(v.wy - 80) / 40, 0, 1), "pu", 0, 1)
    starfield(L, 6, 190, 4, 180, ["wh", "sg", "pu"], 0.14)
    for k in range(18):                                                   # far, dim shards
        x, y = rnd(803, k) * WW, 40 + rnd(803, k, 1) * 120
        shard(L, v, x, y, 2 + rnd(803, k, 2) * 2, rnd(803, k, 3) * 3, "sg", 2)
    return L


def glass_near(v):
    L = Layer(v)
    for x, y, s, rot in SKY_SHARDS:
        glow(L, v, x, y, s * 3.4, "sg", 0, 1)
        shard(L, v, x, y, s, rot)
    sea = v.rect(0, SEA, WW, WH)
    w = v.sample(GL_SEA)
    L.fill(sea, 0.08 + 0.2 * v.vgrad(SEA, WH), "sg", 0.9, 0, 1)
    for y in range(SEA + 2, WH, 3 + (0)):
        gap = 1 + (y - SEA) // 24
        band = v.rect(0, y, WW, y + 1) & (w > 0.55 - (y - SEA) / 300)
        L.speckle(band, 0.7, "sg", 2 if y < SEA + 40 else 1)
    L.shade(v.rect(0, SEA, WW, SEA + 1), "sg", 3)
    # island shards breaking the water, mirrored below in broken rows
    for x, h, wd, t in ISLANDS:
        pts = [(x - wd / 2, SEA + 1), (x - wd * 0.3 + t * h, SEA - h * 0.7), (x + t * h, SEA - h), (x + wd * 0.35 + t * h * 0.8, SEA - h * 0.6), (x + wd / 2, SEA + 1)]
        m = v.poly(pts)
        L.fill(m, 0.2 + 0.7 * v.lin(x + wd / 2, SEA, x - wd / 2, SEA - h), "sg", 0.9, 0, 3)
        L.shade(v.line(x + t * h, SEA - h, x + t * h * 0.2, SEA, 1) & m, "wh", 4)
        L.shade(v.line(x - wd * 0.3 + t * h, SEA - h * 0.7, x - wd / 2, SEA, 1) & m, "sg", 4)
        L.outline(m, "sg", 1, only_empty=True)
        mpts = [(px, 2 * SEA - py) for px, py in pts]
        mm = v.poly(mpts) & (v.wy.astype(int) % 2 == 0)
        L.fill(mm, 0.3, "sg", 0.9, 0, 2)
    # the conservatory on the largest island
    cx, cy = CONS
    dome = v.disc(cx, cy, 16, 13) & (v.wy < cy)
    L.fill(dome, 0.1 + 0.4 * v.radial(cx - 6, cy - 8, 18), "pu", 0.9, 0, 2)
    for a in (-0.6, 0.0, 0.6):
        L.shade(dome & (np.abs(v.dx(cx + a * 12 * 0.7) - 0 * v.wy) < 0.6), "sg", 3)
    L.shade(dome & v.ring(cx, cy, 10, 1, 8), "sg", 3)
    L.shade(v.ring(cx, cy, 16, 1, 13) & (v.wy < cy), "wh", 4)
    L.fill(v.rect(cx - 18, cy, cx + 18, cy + 4), 0.4, "gr", 0.8, 1, 3)
    L.shade(v.rect(cx - 1, cy - 18, cx + 1, cy - 13), "sg", 4)
    L.shade(v.rect(cx - 3, cy - 3, cx + 3, cy), "rn", 3)
    return L


def glass_fx(v, f):
    L = Layer(v)
    twinkles(L, f, 820, 46, 4, 180, ["wh", "sg", "pu"], 3, None, 1)
    # a glint crosses each sky shard in turn
    for k, (x, y, s, rot) in enumerate(SKY_SHARDS):
        t = (f + k * 2) % FRAMES
        if t < 3:
            a = rot - 1.57
            gx, gy = x + s * (1.6 - t * 1.2) * math.cos(a), y + s * (1.6 - t * 1.2) * math.sin(a)
            L.star(gx, gy, "wh", 4, 1 + (t == 1), 3)
    # sparkles on the water slide sideways
    for k in range(34):
        x = (rnd(821, k) * WW - f * 2) % WW
        y = SEA + 3 + int(rnd(821, k, 1) * 22) * 3
        if (f + k) % 3 == 0:
            L.shade(v.rect(x, y, x + 2 + (k % 3), y + 1), "wh", 4)
        else:
            L.shade(v.px(x, y), "sg", 3)
    # one shooting star a loop
    if 1 <= f <= 4:
        t = f - 1
        x0, y0 = 150 + t * 26, 30 + t * 9
        L.shade(v.line(x0 - 16, y0 - 5.5, x0, y0, 1), "sg", 3)
        L.shade(v.line(x0 - 6, y0 - 2, x0, y0, 1), "wh", 4)
    # the conservatory lamp
    cx, cy = CONS
    if f % 4 < 2:
        L.star(cx, cy - 19, "sg", 4, 1, 3)
    return L


# =====================================================================================================================
# 7 Eclipse: the hollow forge. A black sun with a violet corona and a tilted ring hangs over a perspective grid plain;
# slabs of voidsteel float around it and forge towers stand at the edges. Pulses run down the grid toward you.
# =====================================================================================================================
EC_SKY = noise(901, 100, 4, 0.55, 2.0)
EG = 190
SUN = (240, 104, 40)
SLABS = [(70, 70, 26, 7, 4), (126, 128, 18, 5, 3), (360, 62, 30, 8, 5), (406, 130, 20, 6, 3), (172, 44, 14, 4, 3), (322, 150, 14, 4, 2)]
FORGES = [(20, 46, 22), (52, 30, 14), (438, 52, 24), (470, 34, 12)]


def eclipse_far(v):
    L = Layer(v)
    s = v.sample(EC_SKY)
    starfield(L, 7, 160, 4, EG - 6, ["wh", "vs", "qz"], 0.1)
    L.gas(np.clip((s - 0.5) * 1.6, 0, 1) * (1 - v.vgrad(40, EG)) * 0.8, "vs", 0, 1)
    horizon_glow(L, v, "vs", 120, EG, 0, 2, EC_SKY, 0.8)
    return L


def slab(L, v, x, y, w, h, sk):
    top = v.poly([(x, y), (x + w, y), (x + w - sk, y + h), (x - sk, y + h)])
    side = v.poly([(x - sk, y + h), (x + w - sk, y + h), (x + w - sk, y + h + 3), (x - sk, y + h + 3)])
    L.fill(top, 0.3 + 0.6 * v.lin(x + w, y + h, x, y), "vs", 0.9, 1, 3)
    L.fill(side, 0.2, "vs", 0.6, 0, 1)
    L.shade(v.line(x, y, x + w, y, 1), "vs", 4)
    L.shade(v.line(x + w * 0.2, y + h * 0.5, x + w * 0.7, y + h * 0.5, 1) & top, "qz", 3)


def eclipse_near(v):
    L = Layer(v)
    cx, cy, R = SUN
    a, d = v.angle(cx, cy), v.dist(cx, cy)
    streak = 0.5 + 0.5 * np.cos(a * 13) * np.cos(a * 5 + 1)
    corona = np.clip(1 - (d - R) / (26 + 18 * streak), 0, 1) * (d > R)
    L.gas(corona ** 1.3, "vs", 0, 4)
    L.gas(np.clip(1 - (d - R) / 6, 0, 1) * (d > R), "qz", 2, 4)
    L.shade(v.ring(cx, cy, R + 1, 1), "wh", 3)
    disc = v.disc(cx, cy, R)
    L.shade(disc, "vs", 0)
    L.speckle(disc, 0.12 * v.radial(cx + 12, cy + 12, R), "vs", 1)
    ring = v.ring(cx, cy - 6, R + 24, 1.5, 9)
    L.shade(ring & ((v.wy > cy - 6) | ~disc), "vs", 3)
    L.star(cx - R * 0.7, cy - R * 0.72, "wh", 4, 4, 3)                     # the diamond-ring flare
    # forge towers at the edges
    for x, h, w in FORGES:
        m = v.rect(x - w / 2, EG - h, x + w / 2, EG)
        L.fill(m, 0.1 + 0.3 * v.lin(x + w, 0, x - w, 0), "vs", 0.8, 0, 2)
        L.shade(v.rect(x - w / 2, EG - h, x + w / 2, EG - h + 1), "vs", 3)
        L.shade(v.rect(x - 2, EG - h + 6, x + 2, EG - h + 9), "ch", 3)
        L.shade(v.rect(x - w / 2 + 2, EG - h - 6, x - w / 2 + 4, EG - h), "vs", 2)
    for sl in SLABS[4:]:
        slab(L, v, *sl)
    # the grid plain
    plain = v.rect(0, EG, WW, WH)
    L.fill(plain, 0.05 + 0.15 * v.vgrad(EG, WH), "vs", 0.8, 0, 1)
    L.gas(np.clip(1 - np.abs(v.dx(cx)) / 120, 0, 1) * (1 - v.vgrad(EG, EG + 40)) * (v.wy >= EG), "vs", 1, 2)
    L.shade(v.rect(0, EG, WW, EG + 1), "qz", 3)
    for k in range(-14, 15):
        L.shade(v.line(cx + k * 14, EG, cx + k * 70, WH + 20, 1) & plain, "vs", 2 if abs(k) < 6 else 1)
    for j in range(1, 12):
        y = EG + (WH - EG) * (j / 11) ** 1.9
        L.shade(v.rect(0, y, WW, y + 1) & plain, "vs", 2)
    return L


def eclipse_fx(v, f):
    L = Layer(v)
    twinkles(L, f, 920, 40, 4, EG - 10, ["wh", "vs", "qz"])
    cx, cy, R = SUN
    # corona flicker: a few long streamers reach out and pull back
    for k in range(10):
        a = TAU * rnd(921, k)
        ln = 8 + 14 * abs(math.sin(TAU * f / FRAMES + k))
        x0, y0 = cx + (R + 2) * math.cos(a), cy + (R + 2) * math.sin(a)
        x1, y1 = cx + (R + 2 + ln) * math.cos(a), cy + (R + 2 + ln) * math.sin(a)
        L.speckle(v.line(x0, y0, x1, y1, 1), 0.7, "qz", 3)
    if f % 4 < 2:
        L.star(cx - R * 0.7, cy - R * 0.72, "wh", 4, 6, 3)
    # the big slabs float, bobbing a pixel on their own phase
    for k, (x, y, w, h, sk) in enumerate(SLABS[:4]):
        dy = round(1.6 * math.sin(TAU * f / FRAMES + k * 1.7))
        slab(L, v, x, y + dy, w, h, sk)
    # pulses run down the grid toward the viewer
    for k in range(2):
        t = ((f + k * 4) % FRAMES) / FRAMES
        y = EG + (WH - EG) * t ** 1.9
        L.shade(v.rect(0, y, WW, y + 1) & (np.abs(v.dx(cx)) < 40 + 220 * t), "qz", 4)
    # debris orbiting along the ring
    for k in range(5):
        aa = TAU * (f / FRAMES + k / 5)
        x, y = cx + (R + 24) * math.cos(aa), cy - 6 + 9 * math.sin(aa)
        if math.sin(aa) > 0 or abs(x - cx) > R:
            L.shade(v.rect(x - 1, y - 1, x + 1, y + 1), "wh", 4)
    return L


# =====================================================================================================================
# 8 Clockwork: the still room. A great clock face over a brass works at dusk, gears turning beneath it, a pendulum
# swinging, clock towers at either side and a geared track along the ground.
# =====================================================================================================================
CK_SKY = noise(1001, 100, 4, 0.55, 2.2)
CK_GROUND = noise(1002, 34, 3, 0.55, 2.4)
CG = 204
CLOCK = (240, 92, 54)
GEARS = [(150, 170, 34, 28, 14, 7, 1), (196, 196, 18, 14, 8, 4, -1), (330, 168, 38, 31, 16, 8, -1), (382, 198, 20, 16, 9, 4, 1), (70, 186, 22, 18, 10, 5, -1), (440, 182, 26, 21, 12, 6, 1)]
TOWERS = [(30, 92, 22), (452, 100, 24)]


def clockwork_far(v):
    L = Layer(v)
    s = v.sample(CK_SKY)
    horizon_glow(L, v, "ch", 70, CG, 0, 2, CK_SKY, 1.0)
    horizon_glow(L, v, "cu", 140, CG, 1, 3, None, 0.6)
    starfield(L, 8, 70, 4, 80, ["wh", "ch", "cu"], 0.06)
    for k in range(10):                                               # far rooftops and spires
        x = k * 48 + rnd(1003, k) * 20
        w, h = 18 + rnd(1003, k, 1) * 18, 12 + rnd(1003, k, 2) * 22
        m = v.rect(x, CG - h, x + w, CG) | v.poly([(x + w / 2 - 3, CG - h), (x + w / 2, CG - h - 10), (x + w / 2 + 3, CG - h)])
        L.fill(m, 0.25, "ch", 0.7, 0, 1)
    return L


def clockwork_near(v):
    L = Layer(v)
    cx, cy, R = CLOCK
    # gearwork behind the face: one huge still gear
    draw_gear(L, v, cx, cy, R + 16, R + 10, 32, 0.05, R, "cu", 0, 0, 2)
    face = v.disc(cx, cy, R)
    L.fill(face, 0.15 + 0.3 * v.radial(cx - 14, cy - 14, R * 1.3), "eg", 0.9, 0, 2)
    L.shade(v.ring(cx, cy, R - 1, 2), "ch", 3)
    L.shade(v.ring(cx, cy, R - 4, 1), "ch", 2)
    L.shade(v.ring(cx, cy, R - 16, 1), "eg", 2)
    for k in range(60):
        a = TAU * k / 60
        r0 = R - 10 if k % 5 == 0 else R - 7
        L.shade(v.line(cx + r0 * math.cos(a), cy + r0 * math.sin(a), cx + (R - 5) * math.cos(a), cy + (R - 5) * math.sin(a), 1.5 if k % 5 == 0 else 1), "ch", 4 if k % 15 == 0 else 3)
    # numeral blocks at the quarters, a sub-dial at six
    for k in range(4):
        a = TAU * k / 4 - TAU / 4
        x, y = cx + (R - 22) * math.cos(a), cy + (R - 22) * math.sin(a)
        L.shade(v.rect(x - 1, y - 3, x + 1, y + 3), "ch", 4)
        if k in (1, 3):
            L.shade(v.rect(x - 4, y - 3, x - 2, y + 3), "ch", 3)
    L.shade(v.ring(cx, cy + 22, 9, 1), "ch", 3)
    # hands (hour and minute; the seconds tick on the sub-dial in the fx)
    L.shade(v.line(cx, cy, cx + 22, cy - 26, 3), "ch", 4)
    L.shade(v.line(cx, cy, cx - 28, cy - 6, 2.5), "ch", 4)
    L.shade(v.disc(cx, cy, 3.5), "ch", 4)
    L.shade(v.disc(cx, cy, 1.5), "eg", 0)
    L.speckle(v.line(cx - 30, cy - 30, cx - 8, cy - 46, 4) & face, 0.4, "wh", 4)       # glass glint
    # clock towers at the sides
    for x, h, w in TOWERS:
        body = v.rect(x - w / 2, CG - h, x + w / 2, CG)
        L.fill(body, 0.12 + 0.4 * v.lin(x + w, 0, x - w, 0), "ch", 0.9, 0, 2)
        roof = v.poly([(x - w / 2 - 3, CG - h), (x, CG - h - 22), (x + w / 2 + 3, CG - h)])
        L.fill(roof, 0.3 + 0.5 * v.lin(x + w, 0, x - w, 0), "cu", 0.9, 0, 3)
        L.shade(v.rect(x, CG - h - 30, x + 1, CG - h - 22), "cu", 3)
        L.shade(v.disc(x, CG - h + 14, 7), "eg", 1)
        L.shade(v.ring(x, CG - h + 14, 7, 1), "ch", 3)
        L.shade(v.line(x, CG - h + 14, x + 4, CG - h + 10, 1) | v.line(x, CG - h + 14, x, CG - h + 9, 1), "ch", 4)
        for wy in range(CG - h + 28, CG - 10, 12):
            L.shade(v.rect(x - 3, wy, x + 3, wy + 6), "sn", 3)
            L.shade(v.rect(x - 3, wy, x + 3, wy + 1), "sn", 4)
    # ground: brass floor with a toothed track
    g = v.sample(CK_GROUND)
    L.fill(v.rect(0, CG, WW, WH), 0.1 + 0.3 * g * (1 - v.vgrad(CG, WH) * 0.5), "ch", 0.9, 0, 2)
    L.shade(v.rect(0, CG, WW, CG + 1), "ch", 3)
    tr = 232
    L.fill(v.rect(0, tr, WW, tr + 5), 0.5, "cu", 0.8, 1, 3)
    for x in range(0, WW, 6):
        L.shade(v.rect(x, tr - 2, x + 3, tr), "cu", 2)
    for x in range(0, WW, 30):
        L.shade(v.disc(x + 4, tr + 2.5, 1), "sn", 4)
    L.shade(v.rect(0, 254, WW, 255), "ch", 1)
    return L


def clockwork_fx(v, f):
    L = Layer(v)
    twinkles(L, f, 1020, 18, 4, 70, ["wh", "ch"])
    # gears turn: one tooth's worth over the loop, so it wraps without a jump; neighbours turn the other way
    for (x, y, ro, ri, teeth, hole, d) in GEARS:
        rot = d * (TAU / teeth) * f / FRAMES
        draw_gear(L, v, x, y, ro, ri, teeth, rot, hole, "cu" if teeth > 10 else "ch", 5 if ro > 25 else 0, 0, 3)
    # the pendulum swings from under the face
    cx, cy, R = CLOCK
    a = 0.32 * math.sin(TAU * f / FRAMES)
    px, py = cx + 70 * math.sin(a), cy + R + 4 + 70 * math.cos(a)
    L.shade(v.line(cx, cy + R + 2, px, py, 1.5), "cu", 3)
    bob = v.disc(px, py, 7)
    L.fill(bob, 0.3 + 0.7 * v.radial(px - 3, py - 3, 9), "rn", 0.9, 1, 4)
    L.outline(bob, "eg", 0)
    # seconds tick round the sub-dial
    sa = TAU * f / FRAMES - TAU / 4
    L.shade(v.line(cx, cy + 22, cx + 7 * math.cos(sa), cy + 22 + 7 * math.sin(sa), 1), "wh", 4)
    # steam puffs from a vent on each tower
    for i, (x, h, w) in enumerate(TOWERS):
        t = (f + i * 4) % FRAMES
        L.gas(v.radial(x + 8 + t, CG - h - 4 - t * 3, 3 + t * 0.6) * (1 - t / 10), "wh", 0, 2)
    return L


# ---------------------------------------------------------------------------------------------------------------------
# era table: n -> (name, far, near, fx, close-up focus (x, y, scale)). Drift speeds live in lib/nodefarm/zones/scenery.ts.
# ---------------------------------------------------------------------------------------------------------------------
ERAS = {
    0: ("uplink", uplink_far, uplink_near, uplink_fx, (300, 136, 2.0)),
    1: ("foundry", foundry_far, foundry_near, foundry_fx, (240, 170, 2.0)),
    2: ("wafer", wafer_far, wafer_near, wafer_fx, (230, 160, 1.9)),
    3: ("lattice", lattice_far, lattice_near, lattice_fx, (250, 180, 2.0)),
    4: ("aurora", aurora_far, aurora_near, aurora_fx, (110, 136, 2.0)),
    5: ("monolith", monolith_far, monolith_near, monolith_fx, (220, 176, 2.0)),
    6: ("glass", glass_far, glass_near, glass_fx, (220, 160, 2.0)),
    7: ("eclipse", eclipse_far, eclipse_near, eclipse_fx, (240, 120, 1.9)),
    8: ("clockwork", clockwork_far, clockwork_near, clockwork_fx, (250, 150, 1.8)),
}

if __name__ == "__main__":
    D.ERAS = ERAS            # build() and render() in the deep script read the table from their own module
    want = [int(a) for a in sys.argv[1:]] or list(ERAS)
    D.OUT.mkdir(parents=True, exist_ok=True)
    for n in want:
        D.build(n)
