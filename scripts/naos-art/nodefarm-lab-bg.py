"""Exploit Lab research tree backdrop art (dither, multicolour, original).

Writes to public/naos/nodefarm/:
  lab-bg-0     256 px tile, opaque: blueprint paper, dithered navy-to-indigo noise, faint schematic symbols in four colours
  lab-bg-2     256 px tile, transparent: near layer of floating hex bytes and motes that drifts in front of the paper
  lab-sec-*    384 px, transparent: one plate per section (exploits / malware / infra), a coloured dither nebula with that
               section's motif (bracket code, virus cells, circuit traces)
  lab-core     384 px, transparent: drafting rings, ticks and a glow around the root
The menu (components/nodefarm/lab-backdrop.tsx) tiles the first two at camera depths and places the plates in the world.
Run: python3 scripts/naos-art/nodefarm-lab-bg.py
"""
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[2] / "public/naos/nodefarm"
B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 - 0.5


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


RAMP = {
    "paper": ["#020a1c", "#041633", "#06204a", "#0a2c63", "#103a7d"],
    "blue": ["#06204a", "#0f4a9a", "#2f7fe0", "#59b8ff", "#bfe4ff"],
    "violet": ["#160a3a", "#33207a", "#5b47c4", "#8f9bff", "#d6dbff"],
    "teal": ["#04262e", "#0b5560", "#13a3a8", "#5ff0e8", "#cffffb"],
    "pink": ["#2a0628", "#6b1460", "#c02a9e", "#ff6ad5", "#ffd0f2"],
    "gold": ["#2a1a04", "#6b4a0e", "#c08a1a", "#f9d46a", "#fff2c4"],
    "lime": ["#0e2606", "#2a5a10", "#5aa81c", "#a6f04a", "#e6ffc8"],
}


class Canvas:
    def __init__(self, n, opaque=False):
        self.n = n
        self.img = np.zeros((n, n, 4), np.uint8)
        self.bay = np.tile(B4, (n // 4, n // 4))
        self.y, self.x = np.mgrid[0:n, 0:n].astype(float)
        if opaque:
            self.img[..., 3] = 255

    def fill(self, mask, v, ramp, alpha=255, dither=1.0):
        r = RAMP[ramp]
        v = np.broadcast_to(np.asarray(v, float), mask.shape)
        idx = np.floor(v * (len(r) - 1) + 0.5 + self.bay * dither).astype(int)
        # soft edges: a pixel shows only where the value beats the Bayer threshold, so shapes dissolve into dots
        on = mask & (v * 3 + self.bay * 1.6 > 0.35)
        idx = np.clip(idx, 0, len(r) - 1)
        for i, c in enumerate(r):
            m = on & (idx == i)
            self.img[m] = (*hexc(c), alpha)

    def dot(self, x, y, ramp, i, alpha=255, w=1, h=1):
        x, y = int(x) % self.n, int(y) % self.n
        self.img[y:y + h, x:x + w] = (*hexc(RAMP[ramp][int(i)]), alpha)

    def save(self, name):
        im = Image.fromarray(self.img, "RGBA")
        im.save(OUT / f"{name}.png", optimize=True)
        im.save(OUT / f"{name}.webp", lossless=True, quality=100, method=6)
        print(f"  {name}: {(OUT / f'{name}.webp').stat().st_size / 1000:.0f} KB webp")


def noise(n, scale, seed):
    """Smooth tileable value noise in 0..1."""
    rng = np.random.default_rng(seed)
    g = rng.random((scale, scale))
    y, x = np.mgrid[0:n, 0:n] / n * scale
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = x - x0, y - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a = g[y0 % scale, x0 % scale]; b = g[y0 % scale, (x0 + 1) % scale]
    c = g[(y0 + 1) % scale, x0 % scale]; d = g[(y0 + 1) % scale, (x0 + 1) % scale]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


SYMBOLS = {
    # tiny schematic glyphs, 7x5, drawn as 1 px strokes
    "res": [".......", "#.#.#.#", "##.#.##", ".......", "......."],
    "chip": [".#.#.#.", "#######", "#.....#", "#######", ".#.#.#."],
    "cap": ["...#...", "...#...", ".#####.", ".#####.", "...#..."],
    "gnd": ["...#...", "#######", ".#####.", "..###..", "...#..."],
    "brk": ["##...##", "#.....#", "#.....#", "#.....#", "##...##"],
    "arr": ["..#....", ".##....", "#######", ".##....", "..#...."],
}


def glyph(cv, name, x, y, ramp, shade, alpha=255):
    for j, row in enumerate(SYMBOLS[name]):
        for i, ch in enumerate(row):
            if ch == "#":
                cv.dot(x + i, y + j, ramp, shade, alpha)


def paper():
    n = 256
    cv = Canvas(n, opaque=True)
    nz = 0.6 * noise(n, 4, 1) + 0.4 * noise(n, 16, 2)
    cv.fill(np.ones((n, n), bool), 0.15 + 0.55 * nz, "paper")
    # coloured mist: big soft patches of violet, teal and blue, only the darkest two shades so text stays readable
    for ramp, seed, cut in (("violet", 5, 0.55), ("teal", 6, 0.6), ("pink", 7, 0.68)):
        m = noise(n, 4, seed)
        cv.fill(m > cut, np.clip((m - cut) * 0.9, 0, 0.22), ramp, dither=0.6)
    # schematic symbols and traces
    rng = random.Random(11)
    cols = ("blue", "violet", "teal", "pink", "gold")
    for _ in range(26):
        x, y = rng.randrange(0, n, 8), rng.randrange(0, n, 8)
        ramp = rng.choice(cols)
        glyph(cv, rng.choice(list(SYMBOLS)), x, y, ramp, rng.choice((1, 2)))
        # a trace leaving the symbol
        L = rng.choice((16, 24, 40))
        if rng.random() < 0.5:
            for k in range(L):
                cv.dot(x + 7 + k, y + 2, ramp, 1)
        else:
            for k in range(L):
                cv.dot(x + 3, y + 5 + k, ramp, 1)
    # hex dump fragments in the darkest shades
    for _ in range(10):
        x, y = rng.randrange(0, n, 4), rng.randrange(0, n, 6)
        ramp = rng.choice(cols)
        for k in range(rng.randint(3, 7)):
            if rng.random() < 0.7:
                cv.dot(x + k * 4, y, ramp, 1, w=3, h=3)
    cv.save("lab-bg-0")


def near():
    n = 256
    cv = Canvas(n)
    rng = random.Random(21)
    cols = ("blue", "violet", "teal", "pink", "gold", "lime")
    for _ in range(34):
        x, y = rng.randrange(n), rng.randrange(n)
        ramp = rng.choice(cols)
        kind = rng.random()
        if kind < 0.45:  # a mote with a dithered halo
            cv.dot(x, y, ramp, 4)
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                cv.dot(x + dx, y + dy, ramp, 2)
        elif kind < 0.8:  # a byte: two small pixel digits
            for k in range(2):
                for j in range(3):
                    if rng.random() < 0.7:
                        cv.dot(x + k * 3, y + j, ramp, 3)
        else:  # a plus mark
            for d in range(-2, 3):
                cv.dot(x + d, y, ramp, 3)
                cv.dot(x, y + d, ramp, 3)
    cv.save("lab-bg-2")


def plate(name, ramp, accent, motif, seed):
    n = 384
    cv = Canvas(n)
    r = np.hypot(cv.x - n / 2, cv.y - n / 2) / (n / 2)
    nz = noise(n, 6, seed)
    neb = np.clip(1 - r, 0, 1) ** 1.8 * (0.45 + 0.7 * nz)
    cv.fill(neb > 0, neb * 0.6, ramp, alpha=255, dither=1.0)
    a2 = np.clip(1 - np.hypot(cv.x - n * 0.62, cv.y - n * 0.4) / (n * 0.3), 0, 1) ** 1.5 * noise(n, 8, seed + 1)
    cv.fill(a2 > 0, a2 * 0.55, accent, dither=1.0)
    rng = random.Random(seed)
    motif(cv, rng, ramp, accent)
    cv.save(f"lab-sec-{name}")


def m_exploits(cv, rng, ramp, accent):
    # code brackets and strings drifting out from the centre
    for _ in range(18):
        a = rng.random() * 2 * math.pi
        d = rng.uniform(40, 160)
        x, y = 192 + d * math.cos(a), 192 + d * math.sin(a)
        glyph(cv, "brk", x, y, ramp, 3)
        for k in range(rng.randint(2, 5)):
            cv.dot(x + 9 + k * 4, y + 2, accent if k % 2 else ramp, 3, w=3, h=1)


def m_malware(cv, rng, ramp, accent):
    # virus cells: hexagon rings with spikes
    for _ in range(9):
        x, y, s = rng.uniform(70, 314), rng.uniform(70, 314), rng.randint(6, 13)
        for k in range(36):
            a = k / 36 * 2 * math.pi
            cv.dot(x + s * math.cos(a), y + s * math.sin(a), ramp, 3)
        for k in range(6):
            a = k / 6 * 2 * math.pi + 0.3
            for t in range(3):
                cv.dot(x + (s + 1 + t) * math.cos(a), y + (s + 1 + t) * math.sin(a), accent, 3)
        cv.dot(x - 1, y - 1, accent, 4, w=3, h=3)


def m_infra(cv, rng, ramp, accent):
    # circuit traces with vias, right angles only
    for _ in range(14):
        x, y = rng.randrange(60, 320, 4), rng.randrange(60, 320, 4)
        for seg in range(rng.randint(2, 4)):
            L = rng.randrange(12, 48, 4)
            dx, dy = rng.choice(((1, 0), (-1, 0), (0, 1), (0, -1)))
            for k in range(L):
                cv.dot(x + dx * k, y + dy * k, ramp, 3)
            x, y = x + dx * L, y + dy * L
            cv.dot(x - 1, y - 1, accent, 4, w=3, h=3)
        glyph(cv, "chip", x - 3, y + 3, accent, 3)


def core():
    n = 384
    cv = Canvas(n)
    r = np.hypot(cv.x - n / 2, cv.y - n / 2)
    glow = np.clip(1 - r / 150, 0, 1) ** 2
    cv.fill(glow > 0, glow * 0.7, "blue", dither=1.0)
    for rad, ramp in ((70, "blue"), (110, "teal"), (150, "violet")):
        ring = np.abs(r - rad) < 0.7
        ang = (np.degrees(np.arctan2(cv.y - n / 2, cv.x - n / 2)) + 360) % 360
        dash = (ang // 6) % 2 == 0
        cv.fill(ring & dash, np.full(ring.shape, 0.7), ramp)
        for k in range(24):
            a = k / 24 * 2 * math.pi
            for t in range(4 if k % 6 == 0 else 2):
                cv.dot(n / 2 + (rad + 2 + t) * math.cos(a), n / 2 + (rad + 2 + t) * math.sin(a), ramp, 3)
    cv.save("lab-core")


if __name__ == "__main__":
    paper()
    near()
    plate("exploits", "blue", "teal", m_exploits, 31)
    plate("malware", "violet", "pink", m_malware, 32)
    plate("infra", "teal", "gold", m_infra, 33)
    core()
