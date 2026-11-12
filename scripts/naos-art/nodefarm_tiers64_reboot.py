"""Reboot (Power room) button sprites at 64 px: Warm boot, Cold boot, Flush, Wipe, Purge, Genesis, plus the zone icon (power
symbol). Palette: magenta with violet shadows, steel, frost and ember accents."""
import math

import numpy as np

from nodefarm_icon_kit import (Canvas, P, X, Y, angle, box, disc, lin, line, orb, path, poly, radial, rect, ring, shadow, star4,
                               tilted_ring, wave)


def power(c, cx, cy, R, w, pal="mag", fill=1.0, gap=0.16, v=0.0):
    """Power symbol: an open ring (gap at the top) and a bar; `fill` lights the ring clockwise from the gap."""
    r = np.hypot(X - cx, Y - cy)
    a = (angle(cx, cy) + 0.25) % 1.0  # 0 at the top, clockwise
    ringm = (r <= R) & (r >= R - w) & (a > gap / 2) & (a < 1 - gap / 2)
    lit = ringm & ((a - gap / 2) / (1 - gap) <= fill)
    c.fill(ringm, 0.25 + v + 0.25 * (1 - lin(cx - R, cy - R, cx + R, cy + R)), pal, outline=pal)
    c.fill(lit, 0.75 + v + 0.2 * (1 - lin(cx - R, cy - R, cx + R, cy + R)), pal)
    bar = rect(cx - w / 2, cy - R - 2, cx + w / 2, cy + 1)
    c.fill(bar, 0.9 + v, pal, outline=pal)
    c.set(rect(cx - 0.5, cy - R - 1, cx + 0.5, cy - 1), P[pal][-1])
    return ringm | bar


def warm(c, p):
    """Warm boot: a lit power button, its ring filling once per loop with a warm glow."""
    shadow(c, 32, 14, 54)
    c.fill(disc(32, 37, 16), 0.45 + 0.4 * (1 - lin(16, 21, 48, 53)), "steel", outline="steel")
    c.fill(disc(32, 37, 13.5), 0.12, "violet")
    m = power(c, 32, 37, 10, 3.2, fill=p)
    c.set(ring(32, 37, 16, 15.2) & (Y < 31), P["steel"][6])
    c.glow(m, P["mag"][4], 2, int(60 + 100 * p), 1)


def cold(c, p):
    shadow(c, 32, 15, 54)
    c.fill(disc(32, 36, 17), 0.25, "sky", outline="sky")
    c.fill(disc(32, 36, 15), 0.1, "sky")
    m = power(c, 32, 36, 11, 3.4, pal="violet", fill=1.0)
    # frost creeping over the button
    rng = np.random.default_rng(4)
    for k in range(9):
        a = rng.uniform(0, 2 * math.pi)
        x, y = 32 + 15 * math.cos(a), 36 + 15 * math.sin(a)
        L = 3 + rng.uniform(0, 3)
        c.set(line(x, y, x - L * math.cos(a), y - L * math.sin(a), 1), P["sky"][4])
    for k, (x, y) in enumerate([(16, 22), (47, 24), (49, 47), (14, 46)]):
        on = int(p * 4) == k
        c.fill(star4(x, y, 4 if on else 2.5), 1.0, "sky")
    if blink := (p % 0.5) < 0.25:
        c.set(disc(32, 24, 1.4), P["mag"][6])


def flush(c, p):
    """Flush: a vortex draining down a magenta ring, the spiral turning."""
    shadow(c, 32, 19, 56)
    c.fill(disc(32, 38, 21, 13), 0.35 + 0.4 * (1 - lin(10, 26, 54, 50)), "steel", outline="steel")
    bowl = disc(32, 38, 18, 10.5)
    c.fill(bowl, 0.1, "violet")
    r = np.hypot((X - 32) / 18, (Y - 38) / 10.5)
    a = angle(32, 38)
    sw = ((a * 3 + r * 1.6 - p) % 1.0) < 0.42
    c.fill(bowl & sw, 0.45 + 0.5 * (1 - r), "mag")
    c.fill(bowl & ~sw, 0.15 + 0.35 * (1 - r), "violet")
    c.fill(disc(32, 38, 3.5, 2), 0.0, "ink", dither=0)
    c.set(ring(32, 38, 21, 19.6, 13 / 21) & (Y < 36), P["steel"][6])
    # bubbles getting pulled in
    for k in range(3):
        q = (p + k / 3) % 1.0
        ang = 2 * math.pi * (q * 1.2 + k / 3)
        c.set(disc(32 + 15 * (1 - q) * math.cos(ang), 38 + 9 * (1 - q) * math.sin(ang), 1.0), P["mag"][6])


def wipe(c, p):
    """Wipe: a CRT whose lines are erased by a bright bar sweeping down, then retyped."""
    shadow(c, 31, 22, 59)
    f, t, s = box(c, 9, 14, 40, 34, 6, "steel", -0.1)
    c.fill(rect(23, 48, 35, 54) | rect(17, 54, 41, 57), 0.45, "steel", outline="steel")
    scr = rect(12, 17, 46, 45)
    c.fill(scr, 0.1 + 0.15 * (1 - radial(29, 31, 24)), "violet")
    bar_y = 17 + p * 30
    for i in range(6):
        y = 20 + i * 4
        L = [22, 16, 26, 12, 20, 18][i]
        if y > bar_y or p < 0.02:
            c.set(rect(15, y, 15 + L, y + 2), P["mag"][4] if i % 2 == 0 else P["mag"][3])
    c.set(scr & (np.abs(Y - bar_y) < 1.2), P["mag"][6])
    c.set(scr & (np.abs(Y - bar_y + 2) < 0.8), P["mag"][4])
    c.set(scr & ((np.floor(Y) % 2) == 0), P["violet"][0], 90)
    c.set(disc(44, 47, 1.0), P["mag"][5])


def purge(c, p):
    """Purge: an incinerator grate with magenta flame licking out of it."""
    shadow(c, 32, 22, 58)
    f, t, s = box(c, 12, 36, 38, 20, 6, "steel", -0.08)
    hatch = rect(15, 39, 47, 53)
    c.fill(hatch, 0.05, "violet")
    for x in range(17, 46, 4):
        c.fill(rect(x, 39, x + 1.6, 53), 0.55, "steel")
    # flames: three tongues whose height and sway animate
    flame = np.zeros((64, 64), bool)
    cores = []
    heat = np.zeros((64, 64))
    for k, cx in enumerate([22, 31, 40]):
        h = 22 + 6 * wave(p, 2, k * 0.33)
        sway = 2.5 * math.sin(2 * math.pi * (p * 2 + k * 0.3))
        pts = [(cx - 6, 38), (cx - 4 + sway * 0.3, 38 - h * 0.45), (cx + sway, 38 - h), (cx + 3 + sway * 0.5, 38 - h * 0.5), (cx + 6, 38)]
        m = poly(pts)
        flame |= m
        core = poly([(cx - 3, 38), (cx - 1.5 + sway * 0.3, 38 - h * 0.35), (cx + sway * 0.7, 38 - h * 0.62), (cx + 1.5 + sway * 0.4, 38 - h * 0.3), (cx + 3, 38)])
        cores.append(core)
        heat = np.maximum(heat, m * (1 - np.clip((38 - Y) / h, 0, 1)))
    c.fill(flame, 0.35 + 0.65 * heat, "mag")
    for core in cores:
        c.fill(core, 0.75 + 0.25 * (Y > 30), "ember")
    c.glow(flame, P["mag"][3], 3, 110, 2)
    # glow through the grate
    c.set(hatch & ((np.floor(X) - 17) % 4 >= 2) & (Y > 44), P["mag"][4 if wave(p, 2) > 0.5 else 3])
    for k in range(4):
        q = (p + k / 4) % 1.0
        c.set(disc(20 + k * 7 + 3 * math.sin(q * 6), 30 - q * 26, 0.8), P["mag"][6] if q < 0.6 else P["mag"][4])


def genesis(c, p):
    """Genesis: a newborn star with the power mark at its heart, two orbits and rays turning."""
    shadow(c, 32, 16, 60)
    # rays
    a = angle(32, 31)
    rays = (((a * 12 + p) % 1.0) < 0.22) & (np.hypot(X - 32, Y - 31) < 30) & (np.hypot(X - 32, Y - 31) > 15)
    c.set(rays & ((np.floor(X) + np.floor(Y)) % 2 == 0), P["mag"][4], 150)
    ring1, front1 = tilted_ring(32, 31, 27, 8, -20, 1.6)
    ring2, front2 = tilted_ring(32, 31, 25, 7, 30, 1.6)
    c.fill(ring1 & ~front1, 0.45, "violet")
    c.fill(ring2 & ~front2, 0.45, "violet")
    core = orb(c, 32, 31, 14, "mag", 0.15)
    power(c, 32, 33, 7, 2.6, pal="white", fill=1.0, v=0.2)
    c.fill(ring1 & front1, 0.85, "mag")
    c.fill(ring2 & front2, 0.85, "violet")
    for k, (rx, ry, tilt) in enumerate([(27, 8, -20), (25, 7, 30)]):
        q = (p + k * 0.5) % 1.0
        ang = 2 * math.pi * q
        u, v = rx * math.cos(ang), ry * math.sin(ang)
        tt = math.radians(tilt)
        x, y = 32 + u * math.cos(tt) - v * math.sin(tt), 31 + u * math.sin(tt) + v * math.cos(tt)
        c.set(disc(x, y, 1.8), P["white"][2])
    c.glow(core, P["mag"][4], 3, 120, 2)


DRAW = [warm, cold, flush, wipe, purge, genesis]


def draw(t, p):
    c = Canvas()
    DRAW[t](c, p)
    return c.finish()


def icon(p):
    """Zone icon: the power mark, its ring filling and the bar flaring each loop."""
    c = Canvas()
    shadow(c, 32, 18, 60)
    m = power(c, 32, 34, 22, 6.5, fill=min(1.0, p * 1.4), gap=0.2)
    c.glow(m, P["mag"][4], 3, int(60 + 120 * wave(p)), 2)
    return c.finish()
