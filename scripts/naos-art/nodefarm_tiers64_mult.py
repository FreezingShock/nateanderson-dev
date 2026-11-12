"""Multiplier (Amp bay) button sprites at 64 px: Relay, Booster, Amp, Rack, Array, Grid, plus the zone icon (the gain hex).
Palette: lime with teal shadows, steel housings, white-hot highlights."""
import math

import numpy as np

from nodefarm_icon_kit import (Canvas, P, X, Y, box, cyl, disc, hexagon, lin, line, path, poly, radial, rect, ring, rotp, shadow,
                               star4, wave)


def relay(c, p):
    """A small relay: steel-capped lime case, a switch arm that clicks shut, a spark when it closes."""
    shadow(c, 32, 15, 52)
    for x in (24, 30, 36, 40):
        c.fill(rect(x, 45, x + 2, 52), 0.65, "steel")
    f, t, s = box(c, 20, 30, 22, 15, 6, "lime", -0.05)
    c.fill(rect(23, 34, 39, 42), 0.18, "lime")  # window
    closed = (p * 2) % 1.0 < 0.5
    ang = 0 if closed else -22
    arm = rotp([(26, 37), (37, 37)], math.radians(ang), 26, 37)
    c.set(path([(24, 39), (26, 37)], 1.6) | line(*arm[0], *arm[1], 1.6), P["steel"][5])
    c.set(disc(37, 38.5, 1.2), P["steel"][6])
    if closed and (p % 0.5) < 0.18:
        c.spark(37, 37, 1, P["lime"][7])
    c.set(rect(26, 26, 30, 27), P["lime"][7])  # label
    c.set(disc(39, 27.5, 1.2), P["lime"][7] if closed else P["lime"][2])


def booster(c, p):
    """Booster: a lime power cell on a steel base, charge bars filling, a bolt on the label."""
    shadow(c, 32, 16, 56)
    c.fill(rect(19, 50, 45, 55), 0.45, "steel", outline="steel")
    body, cap = cyl(c, 32, 18, 49, 11, 4, "lime", -0.05)
    c.fill(rect(29, 12, 35, 18) | disc(32, 12, 3, 1.4), 0.7, "steel", outline="steel")
    lvl = int(p * 5) % 5 + 1
    for i in range(5):
        y = 45 - i * 5
        c.fill(rect(26, y, 38, y + 3), 0.95 if i < lvl else 0.2, "teal" if i < lvl else "lime")
    bolt = poly([(33, 22), (27, 32), (31, 32), (29, 40), (36, 29), (32, 29), (34, 22)])
    c.fill(bolt, 1.0, "white")
    if lvl == 5:
        c.glow(body, P["lime"][5], 3, 120, 2)


def amp(c, p):
    """Amp: a head with knobs and a VU needle on top of a two-speaker cabinet; both cones pump on the beat."""
    shadow(c, 31, 24, 58)
    f, t, s = box(c, 7, 30, 44, 26, 6, "steel", -0.14)
    grille = rect(9, 32, 49, 54)
    c.fill(grille, 0.1 + 0.12 * ((np.floor(X) + np.floor(Y)) % 2), "steel")
    pump = wave(p, 2)
    for cx in (19, 39):
        c.fill(disc(cx, 43, 9.4), 0.1, "steel")
        R = 8.2 + pump * 0.6
        c.fill(disc(cx, 43, R), 0.25 + 0.6 * (1 - radial(cx - 2.5, 40.5, R * 1.4)), "lime")
        c.set(ring(cx, 43, 5.4, 4.6), P["lime"][2])
        c.fill(disc(cx, 43, 2.2 + pump * 0.8), 0.9, "lime")
    # amp head
    hf, ht, hs = box(c, 11, 17, 36, 11, 5, "steel", 0.0)
    c.fill(rect(13, 19, 45, 26), 0.12, "steel")
    for i in range(4):
        c.fill(disc(16 + i * 4.5, 22.5, 1.6), 0.8, "steel")
        c.set(disc(16 + i * 4.5, 21.8, 0.6), P["lime"][6])
    vu = rect(35, 19.5, 44, 25.5)
    c.fill(vu, 0.95, "lime")
    ang = math.radians(-150 + 120 * wave(p, 2))
    c.set(line(39.5, 25.5, 39.5 + 4.5 * math.cos(ang), 25.5 + 4.5 * math.sin(ang), 1), P["ink"][0])
    c.set(disc(32.5, 22.5, 1.0), P["lime"][7] if pump > 0.5 else P["lime"][3])
    # sound rings leaving the cabinet
    q = (p * 2) % 1.0
    rr = 6 + q * 8
    arc = ring(52, 43, rr + 0.7, rr - 0.7) & (X > 53)
    c.set(arc & ((np.floor(Y) % 2) == 0), P["lime"][6], int(230 * (1 - q)))


def rack(c, p):
    """Rack: a 4-unit server rack, every unit's lights chasing."""
    shadow(c, 31, 20, 59)
    f, t, s = box(c, 14, 10, 30, 48, 6, "steel", -0.15)
    for u in range(4):
        y = 13 + u * 11
        unit = rect(16, y, 42, y + 9)
        c.fill(unit, 0.35 + 0.25 * (1 - lin(16, y, 42, y + 9)), "steel")
        c.set(rect(16, y + 8, 42, y + 9), P["steel"][1])
        c.fill(rect(18, y + 2, 28, y + 7), 0.15, "lime")  # vent
        for k in range(5):
            on = ((int(p * 8) + k + u * 2) % 5) < 2
            c.set(rect(30 + k * 2.4, y + 3, 31.5 + k * 2.4, y + 5), P["lime"][7] if on else P["lime"][2])
        c.set(rect(19, y + 3, 27, y + 4) & ((np.floor(X) % 2) == 0), P["lime"][3])
    c.glow(f, P["lime"][4], 2, 70, 1)


def array(c, p):
    """Array: a honeycomb of gain cells on a teal backplate, lighting in a sweep."""
    shadow(c, 32, 26, 58)
    plate = hexagon(32, 34, 25)
    c.fill(plate, 0.2 + 0.25 * (1 - lin(8, 10, 56, 58)), "teal", outline="teal")
    cells = [(32, 34)] + [(32 + 13 * math.cos(math.pi / 3 * k + math.pi / 6), 34 + 13 * math.sin(math.pi / 3 * k + math.pi / 6)) for k in range(6)]
    for i, (x, y) in enumerate(cells):
        h = hexagon(x, y, 5.8)
        a = (math.atan2(y - 34, x - 32) / (2 * math.pi)) % 1.0 if i else 0
        lit = i == 0 or ((p - a) % 1.0) < 0.3
        c.fill(h, (0.75 if lit else 0.35) + 0.25 * (1 - lin(x - 6, y - 6, x + 6, y + 6)), "lime", outline="lime")
        if lit:
            c.set(disc(x - 1.5, y - 1.5, 1.1), P["lime"][7])
    c.glow(plate, P["lime"][4], 2, 90, 1)


def grid(c, p):
    """Grid: a power pylon carrying gain lines to the edges, pulses running down every line, a hex field glowing behind."""
    shadow(c, 32, 22, 60)
    field = hexagon(32, 28, 27) & ~hexagon(32, 28, 25)
    c.set(field & ((np.floor(X) + np.floor(Y)) % 2 == 0), P["lime"][3], 160)
    # wires from the arms out to both edges
    wires = [((15, 18), (0, 26)), ((49, 18), (63, 26)), ((19, 28), (0, 36)), ((45, 28), (63, 36))]
    for (a, b) in wires:
        c.set(path([a, ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 3), b], 1.0), P["lime"][4])
    # pylon lattice
    legs = path([(22, 58), (29, 10)], 2) | path([(42, 58), (35, 10)], 2)
    cross = np.zeros((64, 64), bool)
    for y in range(16, 58, 8):
        w = 3 + (y - 10) * 0.21
        cross |= line(32 - w, y, 32 + w, y + 8, 1.0) | line(32 + w, y, 32 - w, y + 8, 1.0)
    arms = rect(14, 17, 50, 19.6) | rect(18, 27, 46, 29.6)
    c.fill(legs | arms, 0.62, "steel", outline="steel")
    c.fill(cross & ~legs, 0.45, "steel")
    for x, y in [(15, 20), (49, 20), (19, 30), (45, 30)]:
        c.fill(rect(x - 1, y, x + 1, y + 3), 0.9, "lime")
    c.fill(star4(32, 7, 5), 1.0, "lime")
    c.set(disc(32, 7, 1.2), P["white"][2])
    for i, (a, b) in enumerate(wires):
        q = (p * 2 + i * 0.25) % 1.0
        x, y = a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q + 3 * math.sin(math.pi * q)
        c.set(disc(x, y, 1.4), P["lime"][7])


DRAW = [relay, booster, amp, rack, array, grid]


def draw(t, p):
    c = Canvas()
    DRAW[t](c, p)
    return c.finish()


def icon(p):
    """Zone icon: the gain hex, rim pulsing, an X of light turning slowly inside it."""
    c = Canvas()
    shadow(c, 32, 22, 59)
    outer = hexagon(32, 31, 26)
    c.fill(outer, 0.3 + 0.55 * (1 - lin(8, 6, 56, 58)), "lime", outline="lime")
    inner = hexagon(32, 31, 20)
    c.fill(inner, 0.12 + 0.2 * (1 - lin(12, 10, 52, 54)), "teal")
    c.fill(outer & ~hexagon(32, 31, 23.5), 0.75 + 0.2 * wave(p), "lime")
    a = math.radians(45 + 90 * p / 4 * 0)
    k = 13
    xm = np.zeros((64, 64), bool)
    for ang in (a, a + math.pi / 2):
        xm |= line(32 - k * math.cos(ang), 31 - k * math.sin(ang), 32 + k * math.cos(ang), 31 + k * math.sin(ang), 4.5)
    c.fill(xm & inner, 0.85 + 0.15 * (1 - radial(32, 31, 14)), "lime")
    c.set(xm & inner & (np.abs((X - 32) - (Y - 31)) < 0.8) & (np.hypot(X - 32, Y - 31) < 10), P["white"][2])
    for k2 in range(6):
        ang = math.pi / 3 * k2 + math.pi / 6
        on = int(p * 6) == k2
        c.set(disc(32 + 23 * math.cos(ang), 31 + 23 * math.sin(ang), 1.6), P["lime"][7] if on else P["lime"][3])
    return c.finish()
