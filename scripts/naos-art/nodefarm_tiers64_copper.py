"""Copper button sprites at 64 px: Wire, Trace, Coil, Busbar, Spool, Foundry. Each draw(t, p) returns a Canvas for tier t
(0..5) at animation phase p in [0, 1)."""
import math

import numpy as np

from nodefarm_icon_kit import (Canvas, P, X, Y, angle, disc, edge, grow, lin, line, path, poly, radial, rect, ring, rotp,
                               shift, wave)


def shadow(c, cx, w, y=58, h=2.6):
    c.set(disc(cx, y, w, h), P["ink"][0], 150)
    c.set(disc(cx, y, w * 0.7, h * 0.7), P["ink"][0], 210)


def wire(c, p):
    """A coiled hank of copper wire, tied off, one stripped end trailing; a pulse runs round the loops."""
    shadow(c, 31, 17, 53)
    cx, cy, rx, ry = 30, 40, 14, 7.5
    pts = []
    for i in range(241):
        s = i / 240
        a = 2 * math.pi * s * 3 - 0.6
        pts.append((cx + rx * math.cos(a) + (s - 0.5) * 3, cy + ry * math.sin(a) - (s - 0.5) * 4, math.sin(a)))
    back = np.zeros((64, 64), bool)
    front = np.zeros((64, 64), bool)
    for a, b in zip(pts, pts[1:]):
        m = line(a[0], a[1], b[0], b[1], 2.2)
        (front if a[2] > 0 else back).__ior__(m)
    c.fill(back & ~front, 0.3 + 0.2 * (1 - lin(0, 30, 0, 44)), "cu")
    c.fill(front, 0.5 + 0.4 * (1 - lin(16, 36, 44, 50)), "cu", outline="cu")
    c.rim(front, ("cu", 7), 0, -1)
    # twist tie
    c.fill(rect(15, 37, 19, 45), 0.55, "patina", outline="patina")
    c.set(rect(15, 38, 19, 39), P["patina"][5])
    # trailing end with a stripped bright tip
    lx, ly = pts[-1][0], pts[-1][1]
    tail = path([(lx, ly), (48, 30), (53, 24), (55, 19)], 2.2)
    c.fill(tail, 0.62, "cu", outline="cu")
    c.set(path([(54.6, 20), (56, 16)], 1.4), P["gold"][5])
    # current pulse riding the loops, then up the tail and off the tip
    k = int(p * 240)
    hx, hy, _ = pts[min(k, 240)]
    c.set((np.hypot(X - hx, Y - hy) <= 2.0) & (front | back | tail), P["gold"][5])
    if p >= 0.75:
        c.spark(56, 14, 1 if p < 0.875 else 2, P["gold"][5])


def board(c, x0, y0, x1, y1):
    b = poly([(x0 + 3, y0), (x1, y0), (x1, y1 - 3), (x1 - 3, y1), (x0, y1), (x0, y0 + 3)])
    c.fill(b, 0.25 + 0.3 * (1 - lin(x0, y0, x1, y1)), "patina", outline="patina")
    c.rim(b, ("patina", 4))
    # under-edge thickness
    c.set(rect(x0 + 1, y1, x1 - 2, y1 + 2) & ~c.alpha, P["patina"][0])
    return b


def trace(c, p):
    shadow(c, 32, 20, 56)
    b = board(c, 13, 20, 51, 50)
    routes = [[(16, 26), (24, 26), (28, 30), (28, 35)], [(48, 25), (40, 25), (37, 28)], [(16, 45), (22, 45), (27, 40)],
              [(48, 46), (42, 46), (38, 42)], [(32, 22), (32, 29)]]
    tr = np.zeros((64, 64), bool)
    for r in routes:
        tr |= path(r, 1.6)
    c.fill(tr & b, 0.62, "cu")
    for (x, y) in [(16, 26), (48, 25), (16, 45), (48, 46), (32, 22)]:
        pad = disc(x, y, 2.2)
        c.fill(pad, 0.8, "cu")
        c.set(disc(x, y, 0.8), P["patina"][0])
    chip = rect(26, 29, 39, 42)
    c.fill(chip, 0.3 + 0.4 * (1 - lin(26, 29, 39, 42)), "steel")
    for i in range(4):
        c.set(rect(24, 31 + i * 3, 26, 32 + i * 3) | rect(39, 31 + i * 3, 41, 32 + i * 3), P["steel"][5])
    c.set(rect(28, 31, 30, 33), P["cu"][6])
    # signals running inward along every trace
    for i, r in enumerate(routes):
        segs = list(zip(r, r[1:]))
        lens = [math.hypot(b_[0] - a_[0], b_[1] - a_[1]) for a_, b_ in segs]
        L = sum(lens)
        d = ((p + i * 0.23) % 1.0) * L
        for (a_, b_), l in zip(segs, lens):
            if d <= l:
                px = a_[0] + (b_[0] - a_[0]) * d / l
                py = a_[1] + (b_[1] - a_[1]) * d / l
                c.set(disc(px, py, 1.3), P["gold"][5])
                break
            d -= l
    led = disc(45, 36, 1.6)
    c.set(led, P["patina"][5] if p < 0.5 else P["patina"][3])


def coil(c, p):
    shadow(c, 32, 17, 57)
    cx, top, bot, rx = 32, 17, 47, 13
    # field lines pulsing outward
    for k in range(2):
        q = (p + k * 0.5) % 1.0
        rr = 15 + q * 12
        f = ring(cx, 32, rr + 0.8, rr - 0.6, 1.25) & ~rect(cx - 15, 12, cx + 15, 52)
        dots = f & ((np.floor(X) + np.floor(Y)) % 2 == 0)
        a = int(200 * (1 - q))
        if a > 30:
            c.set(dots & ~c.alpha, P["patina"][4], a)
    # back flange
    c.fill(disc(cx, top, rx + 3, 4.2), 0.35, "steel", outline="steel")
    # winding: cylinder shaded across, striped turns
    body = rect(cx - rx, top, cx + rx, bot) | disc(cx, bot, rx, 3.6)
    shade = 0.15 + 0.85 * np.clip(1 - np.abs((X - (cx - 4)) / (rx + 2)), 0, 1)
    turns = ((np.floor(Y + 0.6 * np.sin((X - cx) / rx * 1.2)) % 3) == 0)
    c.fill(body, shade - 0.18 * turns, "cu")
    # glint sliding down the winding
    gy = top + 2 + ((p * 1.0) % 1.0) * (bot - top - 2)
    c.set(body & (np.abs(Y - gy) < 1) & (np.abs(X - (cx - 5)) < 3), P["cu"][7])
    # front flanges
    tf = disc(cx, top, rx + 3, 4.2) & ~disc(cx, top - 1, rx - 1, 2.6)
    c.fill(disc(cx, top, rx + 3, 4.2), 0.55 + 0.4 * (1 - lin(cx - rx, top, cx + rx, top)), "steel")
    c.fill(disc(cx, top - 0.6, rx - 2, 2.4), 0.3, "steel")
    bf = disc(cx, bot + 1, rx + 3, 4.6) & ~shift(body, 0, -1)
    c.fill(bf, 0.42 + 0.3 * (1 - lin(cx - rx, 0, cx + rx, 0)), "steel")
    # leads + an arc between the terminals
    c.fill(path([(cx - 7, bot + 4), (cx - 9, 55)], 1.8) | path([(cx + 7, bot + 4), (cx + 9, 55)], 1.8), 0.7, "cu")
    if p < 0.5:
        zig = [(cx - 6, top - 6), (cx - 2, top - 9), (cx + 1, top - 5), (cx + 6, top - 8)]
        if p >= 0.25:
            zig = [(cx - 6, top - 6), (cx - 3, top - 4), (cx + 2, top - 9), (cx + 6, top - 8)]
        c.set(path(zig, 1.0), P["patina"][5])
        c.glow(path(zig, 1.0), P["patina"][3], 2, 140, 1)
    c.set(disc(cx - 6, top - 6, 1.3) | disc(cx + 6, top - 8, 1.3), P["steel"][6])


def bar(c, x0, y0, L, h, d, v=0.0):
    """Isometric-ish copper bar: front face L x h, top face depth d (going up-right)."""
    front = rect(x0, y0, x0 + L, y0 + h)
    top = poly([(x0, y0), (x0 + d, y0 - d * 0.55), (x0 + L + d, y0 - d * 0.55), (x0 + L, y0)])
    end = poly([(x0 + L, y0), (x0 + L + d, y0 - d * 0.55), (x0 + L + d, y0 + h - d * 0.55), (x0 + L, y0 + h)])
    c.fill(end, 0.25 + v, "cu")
    c.fill(front, 0.42 + v + 0.25 * (1 - lin(x0, y0, x0 + L, y0 + h)), "cu")
    c.fill(top, 0.78 + v, "cu")
    c.rim(top, ("cu", 7), 0, -1)
    return front | top | end


def busbar(c, p):
    shadow(c, 32, 24, 57)
    bars = [(8, 44, 40, 8, 6), (12, 33, 40, 8, 6), (16, 22, 38, 8, 6)]
    masks = []
    for i, (x0, y0, L, h, d) in enumerate(bars):
        # insulator blocks under each bar
        for bx in (x0 + 4, x0 + L - 9):
            blk = rect(bx, y0 + h, bx + 5, y0 + h + 3)
            c.fill(blk, 0.4, "mag" if False else "stone" if False else "steel")
        masks.append(bar(c, x0, y0, L, h, d, 0.04 * (2 - i)))
        for bx in (x0 + 6, x0 + L - 7):
            c.fill(disc(bx, y0 + 4, 2.2), 0.6, "steel")
            c.set(disc(bx - 0.5, y0 + 3.5, 0.8), P["steel"][6])
    allm = masks[0] | masks[1] | masks[2]
    # glint sweeping across all three bars, top bar first
    pos = -10 + p * 90
    band = np.abs((X + Y * 0.6) - pos) < 1.1
    c.set(band & allm & (c.img[..., 3] > 0), P["cu"][6])
    # arc between the two lower bars
    if 0.5 <= p < 0.75:
        z = path([(46, 41), (48, 38), (46, 36), (49, 33)], 1.0)
        c.set(z, P["gold"][5])
        c.glow(z, P["gold"][3], 2, 150, 1)
    c.spark(52, 18, 1 if p < 0.5 else 2, P["gold"][5]) if (p * 8) % 4 < 1 else None


def spool(c, p):
    shadow(c, 32, 27, 58)
    cx, cy = 30, 31
    # back flange
    c.fill(disc(cx + 6, cy - 2, 21, 23), 0.2, "steel", outline="steel")
    # copper drum between the flanges (side band)
    drum = poly([(cx - 2, cy - 19), (cx + 6, cy - 21), (cx + 6, cy + 19), (cx - 2, cy + 21)])
    drum |= disc(cx + 2, cy, 6, 21) & (X > cx - 2)
    turns = (np.floor(Y) % 2 == 0)
    c.fill(drum, 0.55 - 0.2 * turns + 0.2 * (1 - lin(0, cy - 20, 0, cy + 20)), "cu")
    # front flange (steel) with spokes that turn
    fl = disc(cx, cy, 21, 23)
    c.fill(fl, 0.35 + 0.45 * (1 - lin(cx - 20, cy - 20, cx + 20, cy + 20)), "steel", outline="steel")
    inner = disc(cx, cy, 17, 19)
    c.fill(inner, 0.12, "steel")
    # copper visible through the flange windows
    a = angle(cx, cy)
    rot = p / 4  # quarter turn per loop (4 spokes, so it loops cleanly)
    spokes = np.zeros((64, 64), bool)
    for k in range(4):
        ang = 2 * math.pi * (rot + k / 4)
        spokes |= line(cx, cy, cx + 18 * math.cos(ang), cy + 19.5 * math.sin(ang), 4.2)
    windows = inner & ~spokes & ~disc(cx, cy, 5)
    turns_f = (np.floor(np.hypot(X - cx, (Y - cy) * 0.92)) % 2 == 0)
    c.fill(windows, 0.35 + 0.35 * (1 - radial(cx, cy, 17)) - 0.15 * turns_f, "cu")
    c.fill(spokes & inner, 0.62, "steel")
    c.fill(disc(cx, cy, 5), 0.7, "steel")
    c.fill(disc(cx, cy, 2.4), 0.15, "steel")
    c.rim(fl, ("steel", 6))
    # bolts on the rim
    for k in range(8):
        ang = 2 * math.pi * (rot + k / 8)
        c.set(disc(cx + 19 * math.cos(ang), cy + 21 * math.sin(ang), 0.9), P["steel"][6])
    # cable paying out to a plug
    cable = path([(cx + 8, cy + 20), (44, 54), (54, 54), (58, 50)], 2.4)
    c.fill(cable, 0.6, "cu", outline="cu")
    c.fill(rect(55, 46, 61, 51), 0.6, "steel", outline="steel")
    c.set(rect(61, 47, 63, 48) | rect(61, 49, 63, 50), P["gold"][4])
    k = (p * 4) % 1.0
    c.set(disc(44 + 10 * k, 54, 1.2) & cable, P["gold"][5])


def foundry(c, p):
    shadow(c, 33, 29, 59, 3)
    # cooled ingots stacked on the left
    def ingot(x, y, v):
        top = poly([(x + 2, y), (x + 10, y), (x + 12, y + 3), (x, y + 3)])
        fr = rect(x, y + 3, x + 12, y + 8)
        c.fill(fr, 0.4 + v + 0.3 * (1 - lin(x, y + 3, x + 12, y + 8)), "cu", outline="cu")
        c.fill(top, 0.85 + v, "cu", outline="cu")
        c.set(rect(x + 2, y + 4, x + 4, y + 5), P["patina"][4])
    for (x, y, v) in [(1, 50, -0.05), (12, 50, 0.0), (6.5, 42, 0.05)]:
        ingot(x, y, v)
    # tilting furnace: crucible on a trunnion between A-frame legs, pouring right into a mould tray
    cx, cy = 24, 27
    tilt = math.radians(34 + 3 * math.sin(2 * math.pi * p))
    body = [(-12, -10), (12, -10), (9, 11), (-9, 11)]
    mouth = rotp([(cx - 12, cy - 10), (cx + 12, cy - 10)], tilt, cx, cy)
    lx, ly = max(mouth, key=lambda q: q[0] + q[1] * 0.2)
    lx, ly = mouth[1]
    tx = int(round(lx + 3))  # the filling cell sits under the stream
    tray = poly([(tx - 18, 50), (63, 50), (62, 57), (tx - 16, 57)])
    c.fill(tray, 0.3 + 0.35 * (1 - lin(tx - 18, 50, 63, 57)), "steel", outline="steel")
    c.rim(tray, ("steel", 5), 0, -1)
    for i, x in enumerate([tx - 14, tx - 4]):
        cell = rect(x, 51.5, x + 8, 55.5)
        c.fill(cell, 0.1, "steel")
        if i == 0:
            c.fill(cell & (Y > 52.5), 0.5, "cu")
        else:
            lvl = 55 - 3 * p
            c.fill(cell & (Y > lvl), 0.55 + 0.4 * (1 - lin(0, 51, 0, 56)), "molten")
    # back leg of the A-frame
    c.fill(path([(cx + 9, 52), (cx, cy)], 3), 0.25, "steel", outline="steel")
    cr = poly(rotp([(cx + x, cy + y) for x, y in body], tilt, cx, cy))
    c.fill(cr, 0.18 + 0.6 * (1 - lin(cx - 12, cy - 12, cx + 12, cy + 12)), "steel", outline="steel")
    for off in (-5, 4):
        band = poly(rotp([(cx - 11.5, cy + off), (cx + 11.5, cy + off), (cx + 11, cy + off + 2), (cx - 11, cy + off + 2)], tilt, cx, cy))
        c.fill(band & cr, 0.62, "steel")
    a = tilt
    mx, my = (mouth[0][0] + mouth[1][0]) / 2, (mouth[0][1] + mouth[1][1]) / 2
    u = (X - mx) * math.cos(a) + (Y - my) * math.sin(a)
    v = -(X - mx) * math.sin(a) + (Y - my) * math.cos(a)
    surf = ((u / 11.0) ** 2 + (v / 3.4) ** 2 <= 1)
    c.fill(surf, 0.62 + 0.3 * wave(p) * (1 - radial(mx, my, 10)), "molten")
    c.set(line(*mouth[0], *mouth[1], 1.2) & ~surf, P["steel"][6])
    # stream: falls from the low lip in a short arc into the cell
    pts = [(lx + 3.0 * s ** 0.5, ly + (53 - ly) * s) for s in [i / 12 for i in range(13)]]
    stream = path(pts, 2.6)
    flow = (np.floor(Y - p * 16) % 8) < 4
    c.fill(stream, 0.5 + 0.45 * flow, "molten")
    c.set(path(pts, 0.9) & flow, P["molten"][5])
    # front leg + trunnion pin
    c.fill(path([(cx - 10, 52), (cx, cy)], 3.2), 0.5 + 0.3 * (1 - lin(cx - 10, 0, cx, 0)), "steel", outline="steel")
    c.fill(disc(cx, cy, 2.8), 0.75, "steel", outline="steel")
    c.set(disc(cx - 0.6, cy - 0.6, 0.9), P["steel"][6])
    c.glow(stream | surf, P["ember"][3], 3, 130, 2)
    # sparks spray from the splash
    rng = np.random.default_rng(7)
    sx, sy = pts[-1]
    for k in range(8):
        ph = (p + k / 8) % 1.0
        ang = math.radians(-170 + rng.uniform(0, 160))
        sp = 5 + rng.uniform(0, 7)
        x = sx + math.cos(ang) * sp * ph * 1.6
        y = sy - 2 + math.sin(ang) * sp * ph * 2.2 + 16 * ph * ph
        if 0 <= x < 63 and 0 <= y < 63 and ph < 0.85:
            c.set(disc(x, y, 0.75), P["ember"][5 if ph < 0.3 else 4 if ph < 0.6 else 3])


DRAW = [wire, trace, coil, busbar, spool, foundry]


def draw(t, p):
    c = Canvas()
    DRAW[t](c, p)
    return c.finish()


def icon(p):
    """Zone icon: three cast ingots stacked, with a glint that sweeps over them and patina flecks."""
    c = Canvas()
    shadow(c, 32, 26, 57, 3)

    def ingot(x, y, w=26, v=0.0):
        top = poly([(x + 4, y), (x + w - 4, y), (x + w, y + 6), (x, y + 6)])
        fr = rect(x, y + 6, x + w, y + 15)
        side = fr & (X > x + w - 4)
        c.fill(fr, 0.38 + v + 0.35 * (1 - lin(x, y + 6, x + w, y + 15)), "cu", outline="cu")
        c.fill(side, 0.25 + v, "cu")
        c.fill(top, 0.8 + v + 0.15 * (1 - lin(x, y, x + w, y + 6)), "cu", outline="cu")
        c.rim(top, ("cu", 7), 0, -1)
        c.set(rect(x + 3, y + 9, x + 9, y + 10), P["cu"][2])  # stamped mark
        c.set(rect(x + 3, y + 11, x + 6, y + 12), P["cu"][2])
        return fr | top

    m = ingot(4, 40, 27, -0.04) | ingot(33, 40, 27, -0.02) | ingot(18, 25, 28, 0.04)
    # patina flecks
    for (x, y) in [(8, 50), (26, 52), (50, 49), (40, 53), (22, 34), (40, 36)]:
        c.set(rect(x, y, x + 2, y + 1), P["patina"][3])
        c.set(rect(x, y + 1, x + 1, y + 2), P["patina"][4])
    pos = -20 + p * 120
    band = (np.abs((X + Y * 0.7) - pos) < 1.4) & m
    c.set(band, P["cu"][7])
    if 0.55 < p < 0.8:
        c.spark(45, 26, 2 if p < 0.68 else 1, P["gold"][5])
    return c.finish()
