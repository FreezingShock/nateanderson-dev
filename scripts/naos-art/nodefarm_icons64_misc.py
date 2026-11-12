"""64 px icons that are not a button zone: Bytes (the HUD cube), Ascend, alert, lock and spark. Same kit and look as the zone
icons; icon_<name>(p) returns the finished Canvas for phase p."""
import math

import numpy as np

from nodefarm_icon_kit import (Canvas, P, X, Y, disc, lin, line, path, poly, radial, rect, ring, shadow, star4, wave)


def icon_bytes(p):
    """Bytes: the data cube, binary scrolling down its faces and a scan line sweeping the top."""
    c = Canvas()
    shadow(c, 32, 24, 60)
    top = poly([(32, 5), (57, 17.5), (32, 30), (7, 17.5)])
    left = poly([(7, 17.5), (32, 30), (32, 58), (7, 45.5)])
    right = poly([(32, 30), (57, 17.5), (57, 45.5), (32, 58)])
    c.fill(left, 0.35 + 0.3 * (1 - lin(7, 18, 32, 58)), "cyan")
    c.fill(right, 0.15 + 0.2 * (1 - lin(32, 18, 57, 58)), "cyan")
    c.fill(top, 0.7 + 0.25 * (1 - lin(7, 5, 57, 30)), "cyan")
    c.outline(top | left | right, "cyan")
    c.set(line(32, 30, 32, 58, 1) | line(7, 17.5, 32, 30, 1) | line(32, 30, 57, 17.5, 1), P["cyan"][6])
    # binary columns sliding down each side face (skewed with the face)
    rng = np.random.default_rng(5)
    bits = rng.integers(0, 2, (8, 12))
    off = int(p * 8)
    for face, x0, slope, pal in [(left, 9, 0.5, 5), (right, 35, -0.5, 4)]:
        for col in range(5):
            x = x0 + col * 4.6
            for row in range(8):
                y = 20 + row * 4.5 + (x - x0) * slope + (p * 4.5) % 4.5
                b = bits[(row - off) % 8, col + (0 if x0 < 30 else 5)]
                m = (rect(x, y, x + 1.2, y + 2.6) if b else (rect(x - 0.4, y, x + 1.8, y + 2.6) & ~rect(x + 0.4, y + 0.8, x + 1, y + 1.8))) & face
                c.set(m, P["cyan"][pal if b else pal - 1])
    sc = (p % 1.0) * 26
    c.set(top & (np.abs((X - 7) * 0.5 + (Y - 17.5) - (sc - 13)) < 0.8), P["cyan"][6])
    c.set(disc(32, 17.5, 1.4), P["white"][2])
    return c.finish()


def icon_ascend(p):
    """Ascend: three chevrons climbing, light running up through them."""
    c = Canvas()
    for k in range(3):
        y = 44 - k * 13
        lit = int(p * 3) == (k + 0) % 3
        m = poly([(32, y - 14), (54, y + 4), (54, y + 12), (32, y - 6), (10, y + 12), (10, y + 4)])
        pal = ["mag", "cyan", "white"][k]
        c.fill(m, (0.85 if lit else 0.55) + 0.2 * (1 - lin(10, y - 14, 54, y + 12)), "cyan" if k < 2 else "mag", outline="cyan" if k < 2 else "mag")
        c.rim(m, P["white"][2] if lit else P["cyan"][5])
    c.glow(disc(32, 10, 4), P["mag"][5], 3, int(80 + 120 * wave(p)), 2)
    c.fill(star4(32, 8, 3 + 2 * wave(p), 1), 1.0, "white")
    return c.finish()


def icon_alert(p):
    """Alert: a warning triangle that flashes."""
    c = Canvas()
    shadow(c, 32, 24, 60)
    on = (p % 0.5) < 0.3
    tri = poly([(32, 5), (60, 55), (4, 55)])
    c.fill(tri, (0.55 if on else 0.35) + 0.4 * (1 - lin(4, 5, 60, 55)), "red", outline="red")
    c.fill(poly([(32, 14), (51, 49), (13, 49)]), 0.25 if on else 0.15, "red")
    c.set(rect(29.5, 23, 34.5, 40) | disc(32, 45, 2.6), P["white"][2] if on else P["red"][4])
    if on:
        c.glow(tri, P["red"][3], 3, 120, 2)
    return c.finish()


def icon_lock(p):
    """Lock: a steel padlock, a scan line passing over the keyhole."""
    c = Canvas()
    shadow(c, 32, 20, 60)
    shackle = ring(32, 24, 14, 9.5) & (Y < 30)
    c.fill(shackle, 0.45 + 0.4 * (1 - lin(18, 10, 46, 30)), "steel", outline="steel")
    body = rect(12, 28, 52, 58)
    c.fill(body, 0.3 + 0.45 * (1 - lin(12, 28, 52, 58)), "steel", outline="steel")
    c.rim(body, P["steel"][6])
    c.fill(disc(32, 40, 4.5) | poly([(30, 42), (34, 42), (35.5, 51), (28.5, 51)]), 0.0, "ink", dither=0)
    sy = 30 + (p % 1.0) * 26
    c.set(body & (np.abs(Y - sy) < 0.8), P["cyan"][4])
    return c.finish()


def icon_spark(p):
    """Spark: a white four-point star that pulses and throws off small glints."""
    c = Canvas()
    g = wave(p, 2)
    s = star4(32, 32, 22 + 4 * g, 4)
    c.fill(s, 0.55 + 0.45 * (1 - radial(32, 32, 26)), "white")
    c.fill(star4(32, 32, 10, 3), 1.0, "white")
    for k, (x, y) in enumerate([(12, 12), (52, 14), (50, 52), (14, 50)]):
        if int(p * 4) == k:
            c.fill(star4(x, y, 5, 1.2), 1.0, "white")
    c.glow(s, P["white"][1], 3, int(60 + 100 * g), 2)
    return c.finish()
