"""Zone rig machines: one 96 x 64 dither machine per rig, 6 frames x 4 fill states, drawn from the rig's meter.
Writes public/naos/nodefarm/rigs.{png,webp} (row order = RIG_ORDER, shared with components/nodefarm/rig.tsx) and a
preview. Run: python3 scripts/naos-art/nodefarm-rigs.py [ids...]
"""
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from nodefarm_rig_kit import (  # noqa: E402
    P, Canvas, X, Y, angle, box, cyl, disc, floor_plate, lin, line, orb, path, poly, radial, rect, ring, sheet, status_strip, wave, zig,
)

ROOT = Path(__file__).resolve().parents[2]


# ---------------------------------------------------------------- 03 Power room: Capacitor
def capacitor(c, p, f):
    floor_plate(c)
    for i, cx in enumerate((28, 62)):
        body, cap = cyl(c, cx, 14, 46, 10, 3.5, "mag", v=-0.15)
        # glass window with the charge rising inside
        win = rect(cx - 4, 20, cx + 4, 46)
        c.fill(win, 0.08, "ink")
        lvl = 46 - 26 * f
        ch = win & (Y >= lvl)
        if f > 0:
            c.fill(ch, 0.55 + 0.35 * (1 - lin(cx, lvl, cx, 46)) + 0.1 * wave(p, 1, i * 0.5), "mag")
            c.set(win & (Y >= lvl) & (Y < lvl + 1), P["mag"][-1])
        # tick marks on the glass
        for t in range(4):
            c.set(rect(cx + 4, 22 + t * 6, cx + 6, 23 + t * 6), P["steel"][4])
        # terminal post
        c.fill(rect(cx - 2, 8, cx + 2, 14), 0.6, "steel")
        c.set(disc(cx, 8, 2.4, 1.2), P["steel"][6])
    # bus bar between the terminals
    c.fill(rect(28, 6, 62, 8), 0.7, "steel")
    if f >= 0.99:
        for k in range(2):
            b = zig(30, 10, 60, 10 + 6 * wave(p, 2, k * 0.3), 6, 4, seed=int(p * 60) * 7 + k, w=1.0)
            c.set(b, P["mag"][-1])
            c.glow(b, ("mag", 5), r=2, a=120)
        c.spark(45, 4 + 3 * wave(p, 3), 1, P["white"][2])
    elif f > 0:
        if (p * 6) % 2 < 1:
            c.spark(28 + 34 * (p % 1), 7, 0, P["mag"][-2])
    status_strip(c, f, "mag")


# ---------------------------------------------------------------- 04 Trace foundry: Batch pour
def pour(c, p, f):
    floor_plate(c)
    # mould
    mf, mt, ms = box(c, 46, 42, 34, 10, 6, "steel", v=-0.15)
    cav = rect(50, 39, 78, 42) | poly([(50, 42), (52, 38.6), (80, 38.6), (78, 42)])
    lvl = f
    if f > 0:
        c.fill(poly([(50, 42), (51.5 + 0.0, 39.5), (80, 39.5), (78, 42)]) & (X < 50 + 30 * lvl), 0.75 + 0.2 * wave(p, 2), "molten")
    # stacked casts (ingots) on the left plinth, one per third
    for i in range(int(round(f * 3))):
        x0 = 10 + i * 9
        box(c, x0, 47 - (i % 2) * 0, 7, 4, 2, "cu", v=0.1)
    # crucible on a gantry, tipping
    c.fill(rect(16, 6, 18, 48), 0.45, "steel")
    c.fill(rect(16, 6, 46, 8), 0.65, "steel")
    tip = 0.25 + 0.15 * wave(p, 1)
    cx, cy = 40, 18
    pts = [(-8, -7), (8, -7), (6, 7), (-6, 7)]
    a = tip
    rp = [(cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)) for x, y in pts]
    cru = poly(rp)
    c.fill(cru, 0.35 + 0.4 * (1 - lin(cx - 8, cy - 7, cx + 8, cy + 7)), "cu")
    c.outline(cru, "cu")
    c.fill(rect(39, 8, 41, 12), 0.5, "steel")
    lip = rp[1]
    c.fill(disc(cx, cy - 6, 6, 1.6), 0.8, "molten")
    # the stream
    sx = lip[0] + 1
    sw = path([(sx, lip[1]), (sx + 3 + 0.8 * math.sin(p * 6.28), (lip[1] + 40) / 2), (sx + 4, 40)], 2.0)
    c.fill(sw, 0.85, "molten")
    c.glow(sw, ("molten", 3), r=2, a=90)
    for k in range(3):
        t = (p + k / 3) % 1
        c.spark(sx + 4 + (k - 1) * 4 * t, 39 - 6 * math.sin(math.pi * t), 0, P["molten"][-1])
    status_strip(c, f, "cu")


# ---------------------------------------------------------------- 12 Cloud deck: Weather
def weather(c, p, f):
    floor_plate(c)
    # observation window
    frame = rect(8, 4, 88, 50)
    sky = rect(10, 6, 86, 48)
    c.fill(frame, 0.4, "steel")
    storm = f
    c.fill(sky, 0.15 + 0.5 * (1 - lin(48, 6, 48, 48)) * (1 - 0.6 * storm), "dusk")
    # stars on clear nights
    if storm < 0.5:
        for i, (sx, sy) in enumerate([(18, 12), (30, 9), (52, 14), (70, 10), (80, 20), (40, 20), (24, 26)]):
            if (i + int(p * 6)) % 3:
                c.set(rect(sx, sy, sx + 1, sy + 1), P["nb"][-1])
    # clouds drifting left to right, thicker with the storm
    n = 2 + int(storm * 4)
    for i in range(n):
        x = 10 + ((i * 23 + p * 76) % 90) - 6
        y = 18 + (i * 7) % 16 - storm * 6
        cl = (disc(x, y, 8, 3.2) | disc(x + 6, y - 2, 6, 3) | disc(x - 6, y + 1, 5, 2.4)) & sky
        c.fill(cl, 0.75 - 0.5 * storm + 0.2 * (1 - lin(x, y - 4, x, y + 3)), "nb")
    if storm >= 0.99:
        # rain
        for i in range(14):
            rx = 12 + (i * 11 + int(p * 66)) % 72
            ry = 26 + (i * 5 + int(p * 36)) % 18
            c.set(line(rx, ry, rx - 1, ry + 3, 0.8) & sky, P["dusk"][-1])
        if (p * 6) % 3 < 1:
            b = zig(40 + 10 * math.sin(p * 9), 14, 34 + 12 * math.cos(p * 7), 46, 5, 3, seed=int(p * 60), w=1.0) & sky
            c.set(b, P["white"][2])
            c.glow(b, ("nb", 6), r=2, a=140)
    # window mullions
    c.fill(rect(47, 6, 49, 48), 0.55, "steel")
    c.fill(rect(10, 26, 86, 27), 0.5, "steel")
    status_strip(c, f, "nb")


# ---------------------------------------------------------------- 01 Uplink rack: Packet cache
def cache(c, p, f):
    floor_plate(c)
    box(c, 10, 14, 22, 38, 5, "steel", v=-0.2)  # the rack
    for i in range(6):
        y = 18 + i * 5
        c.set(rect(13, y, 29, y + 3), P["ink"][1])
        on = (i + int(p * 6)) % 3 == 0
        c.set(rect(14, y + 1, 16, y + 2), P["cyan"][5] if on else P["cyan"][2])
        c.set(rect(18, y + 1, 27, y + 2), P["steel"][3])
    # pipe across to the cache tank
    c.fill(rect(32, 22, 50, 26), 0.5, "steel")
    for k in range(3):
        x = 32 + ((p + k / 3) % 1) * 18
        c.set(rect(x, 23, x + 2, 25), P["cyan"][5])
    tank, capm = cyl(c, 66, 12, 46, 15, 4, "deep", v=0.05)
    glass = rect(56, 18, 76, 46)
    c.fill(glass, 0.1, "ink")
    lvl = 46 - 27 * f
    fill = glass & (Y >= lvl)
    if f > 0:
        c.fill(fill, 0.45 + 0.35 * (1 - lin(66, lvl, 66, 46)), "cyan")
        # packets settling as little blocks
        for i in range(int(f * 10)):
            bx, by = 58 + (i * 7) % 16, 44 - (i * 3) % max(1, int(27 * f))
            c.set(rect(bx, by, bx + 2, by + 2), P["cyan"][6])
        c.set(glass & (Y >= lvl) & (Y < lvl + 1), P["cyan"][-1])
    if f >= 0.99:
        c.glow(tank | capm, ("cyan", 4), r=3, a=90)
    status_strip(c, f, "cyan")


# ---------------------------------------------------------------- 02 Amp bay: Gain staging
def staging(c, p, f):
    floor_plate(c)
    lit = int(round(f * 6))
    for i in range(6):
        x = 10 + i * 13
        h = 16 + i * 4
        top = 52 - h
        box(c, x, top, 10, h, 3, "lime" if i < lit else "steel", v=-0.25 if i < lit else -0.3)
        # speaker cone
        c.fill(disc(x + 5, top + 6, 3.2), 0.2, "ink")
        c.set(disc(x + 5, top + 6, 1.3), P["lime"][5] if i < lit else P["steel"][3])
        # VU needle bar
        if i < lit:
            v = int(3 + 6 * wave(p, 2, i * 0.17))
            for j in range(v):
                c.set(rect(x + 2, top + h - 3 - j * 2, x + 8, top + h - 2 - j * 2), P["lime"][4 + (j > 5)])
    if lit >= 6:
        b = path([(15, 10), (48, 6 + 3 * wave(p, 2)), (82, 10)], 1)
        c.set(b, P["lime"][-1])
        c.glow(b, ("lime", 5), r=2, a=110)
    status_strip(c, f, "lime")


# ---------------------------------------------------------------- 05 Fab cleanroom: Air scrubbers (meter = dust)
def scrubbers(c, p, f):
    floor_plate(c)
    room = rect(10, 8, 86, 52)
    c.fill(room, 0.55 - 0.3 * f + 0.2 * (1 - lin(48, 8, 48, 52)), "si")
    c.outline(room, "ink")
    # wafer racks
    for i in range(3):
        x = 16 + i * 12
        c.fill(rect(x, 30, x + 8, 50), 0.35, "steel")
        for j in range(4):
            c.set(rect(x + 1, 32 + j * 4, x + 7, 33 + j * 4), P["rainbow"][(i + j) % 6])
    # fan unit on the right
    fan = disc(70, 28, 12)
    c.fill(fan, 0.2, "steel")
    spin = (1 - f) * 0.9 + 0.1
    a = angle(70, 28)
    blades = fan & ~disc(70, 28, 3) & (((a + p * spin) * 4) % 1 < 0.45)
    c.fill(blades, 0.75, "steel")
    c.set(disc(70, 28, 2.5), P["si"][5])
    # dust motes: more as dust settles
    rng = np.random.default_rng(5)
    for i in range(int(4 + f * 40)):
        dx, dy = rng.random() * 74 + 11, rng.random() * 42 + 9
        dy = (dy + p * 8 * (1 + i % 3)) % 42 + 9
        c.set(rect(dx, dy, dx + 1, dy + 1), P["stone"][4 if i % 2 else 3])
    if f > 0.6:
        c.fill(rect(11, 44, 85, 51), 0.45, "stone", dither=1.4)
    status_strip(c, f, "red" if f > 0.3 else "si")


# ---------------------------------------------------------------- 06 Crystal vault: Crystal growth
def crystals(c, p, f):
    floor_plate(c)
    rock = poly([(14, 52), (22, 40), (40, 36), (60, 38), (78, 42), (84, 52)])
    c.fill(rock, 0.3 + 0.3 * (1 - lin(48, 36, 48, 52)), "stone")
    c.outline(rock, "ink")
    spots = [(30, 42, 0), (48, 38, 1), (66, 41, 2), (40, 41, 3), (58, 40, 4)]
    for x, y, k in spots:
        if k > f * 5 + 0.5 and k > 0:
            continue
        hgt = 6 + f * 22 * (1 - 0.15 * k)
        w = 3 + f * 3
        tilt = (k - 2) * 2
        sh = poly([(x - w, y), (x - w * 0.8 + tilt, y - hgt * 0.8), (x + tilt, y - hgt), (x + w * 0.8 + tilt, y - hgt * 0.8), (x + w, y)])
        c.fill(sh, 0.45 + 0.45 * (1 - lin(x - w, y - hgt, x + w, y)), "qz")
        c.outline(sh, "qz")
        c.rim(sh, P["qz"][-1])
        if (int(p * 6) + k) % 4 == 0:
            c.spark(x + tilt - 1, y - hgt + 3, 1, P["qz"][-1])
    if f >= 0.99:
        c.glow(rock, ("qz", 5), r=3, a=70)
    status_strip(c, f, "qz")


# ---------------------------------------------------------------- 07 Signal void: Afterglow
def afterglow(c, p, f):
    floor_plate(c)
    # a dish on a mast catching what is left of the signal
    c.fill(rect(46, 30, 50, 52), 0.5, "steel")
    dish = disc(48, 26, 20, 9) & (Y > 22)
    c.fill(dish, 0.35 + 0.4 * (1 - lin(28, 22, 68, 34)), "steel")
    c.outline(dish, "ink")
    c.fill(line(48, 26, 48, 12, 1.4), 0.6, "steel")
    core = disc(48, 10, 3 + 2 * f)
    c.fill(core, 0.6 + 0.4 * f, "ae")
    if f > 0:
        for k in range(3):
            r = 4 + ((p + k / 3) % 1) * (10 + 18 * f)
            rr = ring(48, 10, r + 0.7, r - 0.3) & (Y < 34)
            c.set(rr & (np.asarray((X.astype(int) + Y.astype(int)) % 2) == 0), P["ae"][5 if k == 0 else 4], int(220 * (1 - (r - 4) / (28 * max(f, 0.3)))) if r < 32 else 0)
        c.glow(core, ("ae", 5), r=3, a=140)
    status_strip(c, f, "ae")


# ---------------------------------------------------------------- 08 Glyph hall: Carvings
def carvings(c, p, f):
    floor_plate(c)
    slab = poly([(14, 52), (16, 10), (80, 8), (82, 52)])
    c.fill(slab, 0.35 + 0.25 * (1 - lin(14, 8, 82, 52)), "stone")
    c.outline(slab, "ink")
    c.rim(slab, P["stone"][-1])
    glyphs = [
        [(22, 20), (34, 20), (28, 30), (22, 40), (34, 40)],
        [(48, 18), (48, 42), (40, 30), (56, 30)],
        [(62, 40), (68, 18), (74, 40), (64, 32), (72, 32)],
    ]
    lit = int(round(f * 3))
    for i, g in enumerate(glyphs):
        m = path(g, 2.2)
        if i < lit:
            c.set(m, P["rn"][5 + (int(p * 6) + i) % 2])
            c.glow(m, ("rn", 4), r=2, a=110)
        else:
            c.set(m, P["stone"][1])
    # chisel dust at the next glyph
    if lit < 3:
        x0 = [28, 48, 68][lit]
        for k in range(3):
            c.set(rect(x0 + k * 2 - 2, 46 + ((p * 3 + k) % 1) * 4, x0 + k * 2 - 1, 47 + ((p * 3 + k) % 1) * 4), P["rn"][3])
    status_strip(c, f, "rn")


# ---------------------------------------------------------------- 09 Prism court: Prism beam
def prism(c, p, f):
    floor_plate(c)
    c.fill(rect(44, 40, 52, 52), 0.5, "steel")
    tri = poly([(36, 40), (48, 14), (60, 40)])
    beam_in = line(4, 30, 42, 30, 2)
    c.set(beam_in, P["sg"][6])
    c.fill(tri, 0.5 + 0.45 * (1 - lin(36, 14, 60, 40)), "sg")
    c.outline(tri, "sg")
    c.rim(tri, P["white"][2])
    w = 0.6 + f * 2.6
    cols = P["prism"]
    for i, col in enumerate(cols):
        y1 = 14 + i * (5 + 2 * f)
        bm = line(56, 28 + i * 0.6, 92, y1 + 2 * math.sin(p * 6.28 + i), w) & ~tri
        c.set(bm, col, 255 if f > 0 else 110)
    if f > 0:
        c.spark(48, 28, 1 + int(f * 2), P["white"][2])
    status_strip(c, f, "sg")


# ---------------------------------------------------------------- 10 Hollow forge: Void draw
def voiddraw(c, p, f):
    floor_plate(c)
    # pipe from the Starglass side
    c.fill(rect(4, 26, 40, 32), 0.55, "sg")
    c.outline(rect(4, 26, 40, 32), "ink")
    w = 1 + f * 4
    for k in range(4):
        x = 4 + ((p + k / 4) % 1) * 36
        c.set(rect(x, 29 - w / 2, x + 3, 29 + w / 2), P["sg"][6] if f > 0 else P["sg"][3])
    # the forge: a dark ring with a turning vortex
    body = disc(62, 30, 20, 18)
    c.fill(body, 0.3 + 0.3 * (1 - lin(42, 12, 82, 48)), "vs")
    c.outline(body, "ink")
    hole = disc(62, 30, 12, 11)
    a = angle(62, 30)
    r = radial(62, 30, 12)
    sw = ((a + r * 0.8 - p * (0.5 + f)) * 3) % 1
    c.fill(hole, 0.1 + 0.7 * (sw < 0.4) * (1 - r) * (0.4 + 0.6 * f), "vs")
    c.set(disc(62, 30, 3), P["void"][0])
    if f > 0.5:
        c.glow(hole, ("vs", 5), r=2, a=100)
    status_strip(c, f, "vs")


# ---------------------------------------------------------------- 11 Still room: Stillness
def stillness(c, p, f):
    floor_plate(c)
    # hourglass in a brass frame; sand gathers below as stillness builds, and the stream slows to nothing
    c.fill(rect(30, 8, 66, 11), 0.7, "brass")
    c.fill(rect(30, 49, 66, 52), 0.6, "brass")
    for x in (32, 62):
        c.fill(rect(x, 11, x + 2, 49), 0.55, "brass")
    glass = poly([(36, 12), (60, 12), (50, 30), (60, 48), (36, 48), (46, 30)])
    c.fill(glass, 0.12, "ink")
    c.outline(glass, "brass")
    top = glass & (Y < 30) & (Y > 12 + 16 * f)
    c.fill(top, 0.6, "ch")
    bot = glass & (Y > 48 - 16 * f) & (Y < 48)
    c.fill(bot, 0.55 + 0.2 * (1 - lin(48, 30, 48, 48)), "ch")
    if f < 0.99:
        if int(p * 6) % 2 == 0 or f < 0.5:
            c.set(line(48, 30, 48, 47 - 16 * f, 1), P["ch"][6])
    else:
        c.glow(glass, ("ch", 5), r=2, a=90)
        c.spark(48, 30, 1, P["ch"][-1])
    # a clock face that slows
    face = disc(78, 22, 7)
    c.fill(face, 0.75, "steel")
    c.outline(face, "ink")
    ang = (p * (1 - f) * 2) * 2 * math.pi
    c.set(line(78, 22, 78 + 5 * math.sin(ang), 22 - 5 * math.cos(ang), 1), P["ch"][3])
    status_strip(c, f, "ch")


# ---------------------------------------------------------------- 13 Beacon spire: Beacon
def beacon(c, p, f):
    floor_plate(c)
    tower = poly([(40, 52), (44, 14), (52, 14), (56, 52)])
    c.fill(tower, 0.35 + 0.3 * (1 - lin(40, 14, 56, 52)), "pu")
    c.outline(tower, "ink")
    for i in range(5):
        c.set(rect(43 + i * 0.4, 20 + i * 6, 53 - i * 0.4, 21 + i * 6), P["pu"][2])
    lamp = disc(48, 11, 5)
    c.fill(lamp, 0.85, "pu")
    a = (p * 1.0) % 1
    bx = 48 + 50 * math.cos(a * 2 * math.pi)
    by = 11 + 6 * math.sin(a * 2 * math.pi)
    beam = poly([(48, 10), (bx, by - 4), (bx, by + 4), (48, 12)])
    c.set(beam & ~lamp, P["pu"][5], 160)
    # pulse lights round the base: one per quarter of the count
    for i in range(8):
        x = 14 + i * 9 if i < 4 else 50 + (i - 4) * 9
        on = i < int(f * 8)
        c.set(rect(x, 47, x + 4, 50), P["pu"][6] if on else P["ink"][2])
    if f >= 0.99 and int(p * 6) % 2 == 0:
        c.glow(lamp, ("white", 2), r=5, a=160, steps=3)
    status_strip(c, f, "pu")


# ---------------------------------------------------------------- 14 Event horizon: Gravity well
def well(c, p, f):
    floor_plate(c)
    cx, cy = 48, 28
    for k in range(3):
        rx = 14 + 12 * f + k * 4
        rr = ring(cx, cy, rx, rx - 2.2, 0.32)
        a = angle(cx, cy)
        c.fill(rr, 0.4 + 0.5 * (((a - p * (0.5 + 0.3 * k)) % 1) < 0.5), "sn")
    hole = disc(cx, cy, 6 + 4 * f)
    c.set(hole, P["hole"][0])
    c.set(ring(cx, cy, 7 + 4 * f, 6 + 4 * f), P["sn"][6])
    # matter falling in
    for k in range(4):
        t = (p + k / 4) % 1
        ang = k * 1.7 + t * 4
        r = (1 - t) * (30 + 6 * f) + 6
        c.set(rect(cx + r * math.cos(ang), cy + r * math.sin(ang) * 0.4, cx + r * math.cos(ang) + 1, cy + r * math.sin(ang) * 0.4 + 1), P["sn"][5])
    status_strip(c, f, "sn")


# ---------------------------------------------------------------- 15 Engram archive: Index
def index(c, p, f):
    floor_plate(c)
    # filing cabinet with drawers that light as records are filed, and a reel turning on top
    box(c, 14, 14, 40, 38, 5, "eg", v=-0.2)
    n = int(round(f * 8))
    for i in range(8):
        x, y = 17 + (i % 2) * 18, 17 + (i // 2) * 9
        c.fill(rect(x, y, x + 15, y + 7), 0.35, "film")
        c.set(rect(x + 5, y + 3, x + 10, y + 4), P["eg"][6] if i < n else P["eg"][2])
    for k, (rx, ry) in enumerate(((70, 20), (70, 40))):
        reel = disc(rx, ry, 9)
        c.fill(reel, 0.3, "film")
        a = angle(rx, ry)
        spokes = reel & (((a + p * (1 if k else -1)) * 3) % 1 < 0.2)
        c.set(spokes, P["eg"][5])
        c.set(disc(rx, ry, 2), P["eg"][6])
    c.set(line(62, 20, 62, 40, 1), P["eg"][4])
    status_strip(c, f, "eg")


# ---------------------------------------------------------------- 16 Mirror stair: Mirror
def mirror(c, p, f):
    floor_plate(c)
    for side, x0 in ((-1, 14), (1, 52)):
        frame = rect(x0, 8, x0 + 30, 50)
        c.fill(frame, 0.55, "px")
        glass = rect(x0 + 2, 10, x0 + 28, 48)
        c.fill(glass, 0.2 + 0.3 * (1 - lin(x0, 10, x0 + 28, 48)), "px")
        # a stair, mirrored
        for i in range(5):
            sx = x0 + 4 + i * 4 if side < 0 else x0 + 24 - i * 4
            c.set(rect(min(sx, sx + 4 * side), 44 - i * 6, max(sx, sx + 4 * side) + 1, 45 - i * 6), P["px"][6])
    split = "split_r", "split_c"
    off = int(1 + 2 * f * wave(p, 2))
    for k, col in enumerate(split):
        fig = disc(29 + (off if k else -off), 24, 3) | rect(27 + (off if k else -off), 27, 31 + (off if k else -off), 36)
        fig2 = disc(67 - (off if k else -off), 24, 3) | rect(65 - (off if k else -off), 27, 69 - (off if k else -off), 36)
        c.set(fig | fig2, P[col][2], 200)
    if f > 0.5:
        c.glow(rect(52, 8, 82, 50), ("px", 6), r=2, a=80)
    status_strip(c, f, "px")


# ---------------------------------------------------------------- 17 Root chamber: Rewrite
def rewrite(c, p, f):
    floor_plate(c)
    term = rect(10, 8, 52, 46)
    c.fill(term, 0.2, "ink")
    c.outline(term, "or")
    lines_n = 1 + int(f * 6)
    for i in range(lines_n):
        w = 8 + (i * 13) % 26
        if i == lines_n - 1:
            w = int(w * ((p * 6) % 6) / 6) + 2
        c.set(rect(13, 11 + i * 5, 13 + w, 13 + i * 5), P["or"][5 if i == lines_n - 1 else 3])
    if int(p * 6) % 2 == 0:
        c.set(rect(13, 11 + lines_n * 5, 16, 13 + lines_n * 5), P["or"][6])
    # a root growing out of the terminal into the plate
    stem = path([(52, 30), (60, 28 - 6 * f), (68, 30), (74, 22 - 8 * f), (82, 26)], 2)
    c.fill(stem, 0.55, "or")
    for i in range(int(1 + f * 4)):
        lx, ly = 58 + i * 6, 28 - 6 * f + (i % 2) * 2
        c.fill(disc(lx, ly - 3, 2.4, 1.6), 0.8, "or")
    roots = path([(66, 30), (64, 40), (66, 52)], 1.2) | path([(74, 26), (78, 40), (76, 52)], 1.2)
    c.set(roots, P["or"][2])
    if f >= 0.99:
        c.glow(stem, ("or", 5), r=2, a=110)
    status_strip(c, f, "or")

RIG_ORDER = ["bytes", "mult", "reboot", "copper", "silicon", "quartz", "aether", "runes", "starglass", "voidsteel", "chrono",
             "nebula", "pulsars", "singularity", "engrams", "paradox", "origin"]
DRAW = {"bytes": cache, "mult": staging, "reboot": capacitor, "copper": pour, "silicon": scrubbers, "quartz": crystals, "aether": afterglow, "runes": carvings,
        "starglass": prism, "voidsteel": voiddraw, "chrono": stillness, "nebula": weather, "pulsars": beacon, "singularity": well, "engrams": index,
        "paradox": mirror, "origin": rewrite}


def blank(c, p, f):
    floor_plate(c)
    status_strip(c, f, "steel")


if __name__ == "__main__":
    only = sys.argv[1:]
    rows = [(z, DRAW.get(z, blank)) for z in RIG_ORDER]
    out = ROOT / "public/naos/nodefarm/rigs"
    sheet(rows, str(out))
    pv_rows = [(z, DRAW[z]) for z in (only or [z for z in RIG_ORDER if z in DRAW])]
    sheet(pv_rows, "/tmp/claude-0/rig-preview-sheet", preview=str(ROOT.parent / "rig-preview.png"))
    print("ok", len(rows))
