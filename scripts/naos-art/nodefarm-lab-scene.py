"""Exploit Lab panel scene: a staged dither workbench that fills in as research is bought.

Same contract as the zone sheets (scripts/naos-art/nodefarm_zone_kit.py): 288 x 96 cells, 8 stage rows, 6 frames, writes
public/naos/nodefarm/zone-lab.{png,webp}. Stage = research progress (components/nodefarm/workshop/lab.tsx, `labStage`).
  0 bare bench under the blueprint wall      4 virus vats (the "concoctions") bubbling in four colours
  1 a CRT with scrolling code                 5 a wide scope screen with a waveform
  2 a sniffer mast with a blinking router     6 a botnet dish and a swarm of drones in the sky
  3 a server rack with blinking drives        7 the kernel: a floating cube hologram over the bench
Run: python3 scripts/naos-art/nodefarm-lab-scene.py
"""
import math
import random

import numpy as np

import nodefarm_zone_kit as K

W, H = K.W, K.H
FLOOR = 86


def backdrop(c, f):
    # blueprint wall: navy wash, faint grid, a few hanging cables, code rain haze, coloured lamps in the sky band
    c.haze(K.rect(0, 0, W, FLOOR), 0.35 + 0.5 * K.lin(0, 0, 0, FLOOR), "si", alpha=80)
    grid = ((K.xx.astype(int) % 16 == 0) | (K.yy.astype(int) % 16 == 0)) & (K.yy < FLOOR)
    c.haze(grid, np.full((H, W), 0.9), "si", alpha=90)
    rng = random.Random(7)
    for x in (52, 98, 160, 214, 246):
        sag = rng.randint(6, 14)
        for t in np.linspace(0, 1, 60):
            px, py = x + t * 26, 2 + sag * math.sin(math.pi * t)
            c.shade(K.rect(int(px), int(py), int(px) + 1, int(py) + 1), "qz" if x % 2 else "si", 1)
    # code rain columns (scroll by frame)
    for col in range(6, W, 22):
        for k in range(6):
            y = (k * 9 + f * 3 + col) % 40 + 4
            c.shade(K.rect(col, y, col + 1, y + 3), ("cyan", "lime", "mag", "si")[(col // 22 + k) % 4], 1, alpha=255)
    # lamps
    for i, (x, ramp) in enumerate(((70, "cyan"), (128, "mag"), (190, "lime"), (236, "rn"))):
        on = 0.5 + 0.5 * K.wave((f + i) % K.FRAMES)
        c.fill(K.disc(x, 6, 2), np.full((H, W), 0.55 + 0.4 * on), ramp)
        c.haze(K.disc(x, 9, 9, 6), K.radial(x, 9, 9), ramp, alpha=80)
    # pinned blueprint sheets on the wall (left stays backdrop-heavy for the Intel readout)
    for (x0, y0, x1, y1, ramp) in ((6, 34, 40, 66, "si"), (24, 16, 56, 40, "cyan"), (150, 30, 176, 50, "qz")):
        c.fill(K.rect(x0, y0, x1, y1), 0.18 + 0.12 * K.lin(x0, y0, x1, y1), ramp)
        c.outline(K.rect(x0, y0, x1, y1), ramp, 2)
        for k in range(3):
            yy0 = y0 + 4 + k * ((y1 - y0 - 6) // 3)
            c.shade(K.rect(x0 + 3, yy0, x1 - 3 - 5 * k, yy0 + 1), ramp, 3)
        c.fill(K.disc((x0 + x1) / 2, y1 - 7, 4), 0.6, ramp)
        c.shade(K.rect((x0 + x1) // 2, y0 - 1, (x0 + x1) // 2 + 1, y0 + 1), "red", 3)
    # circuit traces across the wall, a pulse runs along each one
    for i, (y, ramp) in enumerate(((44, "cyan"), (58, "qz"), (68, "lime"))):
        path = [(0, y), (60 + i * 8, y), (70 + i * 8, y - 8), (180, y - 8), (190, y), (W, y)]
        for (ax, ay), (bx, by) in zip(path, path[1:]):
            c.haze(K.line(ax, ay, bx, by, 1), np.full((H, W), 0.95), ramp, alpha=90)
        px = (f * 48 + i * 90) % W
        c.shade(K.rect(px, y - (8 if 70 + i * 8 < px < 190 else 0), px + 3, y - (8 if 70 + i * 8 < px < 190 else 0) + 1), ramp, 4)
    # pegboard with tools
    c.fill(K.rect(226, 30, 248, 60), 0.2, "cu")
    for gx in range(229, 247, 4):
        for gy in range(33, 58, 4):
            c.shade(K.rect(gx, gy, gx + 1, gy + 1), "cu", 0)
    c.fill(K.rect(230, 36, 232, 52), 0.6, "cu"); c.fill(K.rect(236, 34, 238, 48), 0.7, "rn"); c.fill(K.rect(242, 38, 244, 56), 0.6, "mag")
    # floor and bench
    c.fill(K.rect(0, FLOOR, W, H), 0.2 + 0.25 * K.lin(0, FLOOR, 0, H), "si")
    for x in range(0, W, 12):
        c.shade(K.rect(x, FLOOR, x + 1, H), "cyan", 1)
    c.fill(K.rect(40, 74, W, 79), 0.45 + 0.4 * K.lin(40, 74, 40, 79), "si", outline=True)
    c.shade(K.rect(40, 74, W, 75), "cyan", 3)
    for x in (48, 150, 276):
        c.fill(K.rect(x, 79, x + 4, FLOOR), 0.3, "wh")


def crt(c, f):
    body = K.rect(66, 46, 108, 74)
    c.fill(body, 0.35 + 0.45 * K.lin(66, 46, 108, 74), "wh", outline=True)
    scr = K.rect(70, 50, 104, 69)
    c.fill(scr, 0.08, "si")
    for i in range(5):
        y = 51 + ((i * 4 + f) % 18)
        w = (7, 18, 12, 24, 9)[(i + f // 2) % 5]
        c.shade(K.rect(72, y, 72 + w, y + 1), ("cyan", "lime", "rn", "mag", "cyan")[i], 3)
    if f % 2 == 0:
        c.shade(K.rect(72 + (f * 5) % 28, 66, 75 + (f * 5) % 28, 68), "cyan", 4)
    c.fill(K.rect(82, 69, 92, 74), 0.4, "wh")


def mast(c, f):
    c.fill(K.rect(116, 14, 118, 74), 0.6, "wh")
    for y in (20, 30, 40):
        c.fill(K.line(110, y + 6, 117, y, 1), 0.5, "wh")
        c.fill(K.line(124, y + 6, 117, y, 1), 0.5, "wh")
    c.fill(K.rect(108, 66, 128, 74), 0.35 + 0.4 * K.lin(108, 66, 108, 74), "si", outline=True)
    for i in range(4):
        lit = (f + i) % 3 != 0
        c.shade(K.rect(111 + i * 4, 69, 113 + i * 4, 71), ("lime", "cyan", "rn", "mag")[i], 4 if lit else 1)
    ring = 3 + (f % 3) * 4
    c.fill(K.disc(117, 14, ring, ring) & ~K.disc(117, 14, ring - 1, ring - 1) & (K.yy < 14), 0.8, "cyan")


def rack(c, f):
    c.fill(K.rect(250, 22, 284, 74), 0.2 + 0.35 * K.lin(250, 22, 284, 22), "si", outline=True)
    for i in range(8):
        y = 25 + i * 6
        c.fill(K.rect(253, y, 281, y + 4), 0.45, "wh")
        for j in range(3):
            on = (f + i * 2 + j) % 4 != 0
            c.shade(K.rect(255 + j * 4, y + 1, 257 + j * 4, y + 3), ("lime", "cyan", "mag", "rn")[(i + j) % 4], 4 if on else 0)
        c.shade(K.rect(270, y + 1, 279, y + 2), "si", 2)


def vats(c, f):
    cols = ("lime", "mag", "qz", "rn")
    for i, ramp in enumerate(cols):
        x = 134 + i * 10
        h = 18 + (i % 2) * 6
        tube = K.rect(x, 74 - h, x + 7, 74) | K.disc(x + 3.5, 74 - h, 3.5, 2)
        c.fill(tube, 0.15, "wh", outline=True)
        liquid = K.rect(x + 1, 74 - h + 6, x + 6, 74)
        c.fill(liquid, 0.45 + 0.5 * K.lin(x, 74, x, 74 - h), ramp)
        for b in range(2):
            by = 72 - ((f * 3 + b * 7 + i * 5) % (h - 6))
            c.shade(K.rect(x + 2 + b * 2, by, x + 3 + b * 2, by + 1), ramp, 4)
        c.haze(K.disc(x + 3.5, 66, 9, 12), K.radial(x + 3.5, 66, 12), ramp, alpha=90)
    c.fill(K.rect(131, 72, 176, 75), 0.45, "si")


def scope(c, f):
    c.fill(K.rect(196, 28, 200, 74), 0.5, "wh")
    c.fill(K.rect(178, 24, 240, 50), 0.3 + 0.4 * K.lin(178, 24, 240, 50), "wh", outline=True)
    c.fill(K.rect(181, 27, 237, 47), 0.06, "qz")
    pts = [(181 + x, 37 + 7 * math.sin((x + f * 4) / 5.0) * math.cos(x / 17.0)) for x in range(0, 56)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        c.shade(K.line(x0, y0, x1, y1, 1.2), "mag", 4)
    c.shade(K.rect(181, 37, 237, 38), "qz", 1)


def dish(c, f):
    c.fill(K.disc(267, 14, 11, 8) & (K.yy < 16), 0.5 + 0.4 * K.lin(256, 6, 278, 16), "wh", outline=True)
    c.fill(K.rect(266, 14, 268, 22), 0.5, "wh")
    c.fill(K.line(267, 10, 258, 3, 1), 0.7, "wh")
    rng = random.Random(3)
    for i in range(12):
        x0, y0 = rng.randint(140, 240), rng.randint(4, 22)
        x = (x0 + f * (2 + i % 3)) % 288
        y = y0 + (1 if (f + i) % 2 else 0)
        c.shade(K.rect(x, y, x + 3, y + 1), "ae" if i % 2 else "lime", 3)
        c.shade(K.rect(x + 1, y + 1, x + 2, y + 2), "wh", 2)


def kernel(c, f):
    cx, cy = 214, 58 - 2 * K.wave(f)
    s = 12
    top = K.poly([(cx, cy - s), (cx + s, cy - s / 2), (cx, cy), (cx - s, cy - s / 2)])
    left = K.poly([(cx - s, cy - s / 2), (cx, cy), (cx, cy + s), (cx - s, cy + s / 2)])
    right = K.poly([(cx + s, cy - s / 2), (cx, cy), (cx, cy + s), (cx + s, cy + s / 2)])
    c.haze(K.disc(cx, cy, 22, 18), K.radial(cx, cy, 22), "cyan", alpha=90)
    c.fill(top, 0.95, "wh")
    c.fill(left, 0.55, "cyan")
    c.fill(right, 0.75, "si")
    c.outline(top | left | right, "cyan", 4)
    for i in range(4):
        a = (f / K.FRAMES + i / 4) * 2 * math.pi
        x, y = cx + 19 * math.cos(a), cy + 6 * math.sin(a)
        c.shade(K.rect(int(x), int(y), int(x) + 2, int(y) + 2), ("cyan", "mag", "lime", "rn")[i], 4)
    c.fill(K.rect(cx - 8, 72, cx + 9, 74), 0.9, "cyan")


SPRITES = [crt, mast, rack, vats, scope, dish, kernel]


def draw(stage, frame):
    c = K.Cell()
    # sprites first (front), the backdrop is drawn underneath
    for fn in reversed(SPRITES[:stage]):
        layer = K.Cell()
        fn(layer, frame)
        layer.under(c)
        c = layer
    back = K.Cell()
    backdrop(back, frame)
    c.under(back)
    return c


if __name__ == "__main__":
    K.save_sheet("lab", draw)
