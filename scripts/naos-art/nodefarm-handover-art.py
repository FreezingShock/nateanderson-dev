"""Handover art (dither, multicolour, original): the Firmware tree backdrop and the Handover window banner.

Writes to public/naos/nodefarm/:
  fw-bg-0        256 px tile, opaque: green phosphor glass, dithered mist in amber and cyan, memory-dump columns
  fw-bg-2        256 px tile, transparent: near layer of glowing motes and key glyphs
  fw-sec-*       384 px, transparent: one plate per Firmware section (boot / memory / relay / field)
  handover-cut   320 x 180, opaque, 8 frames stacked: the Handover moment (an empty desk, the lamp going out, the next boot)
  fw-core        384 px, transparent: phosphor rings round node zero
  scene-handover 480 x 160, opaque, 4 frames stacked: the Root Chamber, one small box with one wire at the foot of the
                 mirror stair, the four operator lamps on the wall and a key turning in the air
The tree menu (components/nodefarm/fw-backdrop.tsx) tiles the first two and places the plates; the Handover window
(components/nodefarm/handover.tsx) steps through the banner frames. Shares the Canvas and noise helpers of
nodefarm-lab-bg.py. Run: python3 scripts/naos-art/nodefarm-handover-art.py
"""
import importlib.util
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("labbg", HERE / "nodefarm-lab-bg.py")
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
Canvas, noise, glyph, OUT, hexc = lab.Canvas, lab.noise, lab.glyph, lab.OUT, lab.hexc

lab.RAMP.update({
    "glass": ["#010803", "#03140a", "#062012", "#0a2e1a", "#0f3d22"],
    "phos": ["#062a12", "#0e5a26", "#1fae46", "#3dff6e", "#c8ffd6"],
    "amber": ["#2a1804", "#6b420e", "#c0801a", "#ffc53a", "#fff0c4"],
    "cyan": ["#04262e", "#0b5560", "#1fa8bc", "#64e6ff", "#d6f9ff"],
    "red": ["#2a0606", "#6b1414", "#c02a2a", "#ff5a5a", "#ffd0d0"],
    "lime": ["#0e2606", "#2a5a10", "#5aa81c", "#b6f04a", "#e6ffc8"],
    "orange": ["#2a1004", "#6b2a0e", "#c0581a", "#f08a3c", "#ffe0c4"],
    "tcyan": ["#04222a", "#0a4a58", "#1590a8", "#2fd8e8", "#cff6ff"],
    "rose": ["#2a0614", "#6b1438", "#c02a6a", "#ff7ab6", "#ffd6ea"],
    "room": ["#030504", "#070c09", "#0c140f", "#121d16", "#1a2a20"],
    "wood": ["#140a04", "#2a170a", "#4a2a12", "#6b4220", "#8f5e34"],
})
HEX = {  # 3x5 pixel digits for the memory dumps
    "0": ["###", "#.#", "#.#", "#.#", "###"], "1": [".#.", "##.", ".#.", ".#.", "###"], "7": ["###", "..#", ".#.", ".#.", ".#."],
    "a": [".#.", "#.#", "###", "#.#", "#.#"], "f": ["###", "#..", "##.", "#..", "#.."], "3": ["###", "..#", ".##", "..#", "###"],
    "e": ["###", "#..", "##.", "#..", "###"], "c": ["###", "#..", "#..", "#..", "###"], "9": ["###", "#.#", "###", "..#", "###"],
}


def digit(cv, ch, x, y, ramp, shade, alpha=255):
    for j, row in enumerate(HEX[ch]):
        for i, c in enumerate(row):
            if c == "#":
                cv.dot(x + i, y + j, ramp, shade, alpha)


def glass():
    n = 256
    cv = Canvas(n, opaque=True)
    nz = 0.6 * noise(n, 4, 41) + 0.4 * noise(n, 16, 42)
    cv.fill(np.ones((n, n), bool), 0.15 + 0.6 * nz, "glass")
    for ramp, seed, cut in (("amber", 45, 0.6), ("cyan", 46, 0.58), ("phos", 47, 0.5)):
        m = noise(n, 4, seed)
        cv.fill(m > cut, np.clip((m - cut) * 0.9, 0, 0.24), ramp, dither=0.6)
    rng = random.Random(51)
    # memory dump columns: rows of hex pairs, mostly in the darkest shades
    for _ in range(9):
        x, y = rng.randrange(0, n, 4), rng.randrange(0, n, 8)
        ramp = rng.choice(("phos", "phos", "amber", "cyan"))
        for row in range(rng.randint(3, 8)):
            for col in range(rng.randint(2, 4)):
                for k in range(2):
                    digit(cv, rng.choice(list(HEX)), x + col * 10 + k * 4, y + row * 7, ramp, 1)
    for _ in range(14):
        x, y = rng.randrange(0, n, 8), rng.randrange(0, n, 8)
        glyph(cv, rng.choice(("chip", "brk", "arr", "gnd")), x, y, rng.choice(("phos", "amber", "cyan", "red")), 1)
    cv.save("fw-bg-0")


def near():
    n = 256
    cv = Canvas(n)
    rng = random.Random(61)
    for _ in range(36):
        x, y = rng.randrange(n), rng.randrange(n)
        ramp = rng.choice(("phos", "phos", "amber", "cyan", "lime", "orange"))
        k = rng.random()
        if k < 0.5:
            cv.dot(x, y, ramp, 4)
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                cv.dot(x + dx, y + dy, ramp, 2)
        elif k < 0.8:
            digit(cv, rng.choice(list(HEX)), x, y, ramp, 3)
        else:  # a tiny key
            for d in range(3):
                cv.dot(x + d, y, ramp, 3)
                cv.dot(x, y + d, ramp, 3)
                cv.dot(x + 2, y + d, ramp, 3)
                cv.dot(x + d, y + 2, ramp, 3)
            for d in range(5):
                cv.dot(x + 3 + d, y + 3 + d, ramp, 3)
            cv.dot(x + 6, y + 8, ramp, 3)
    cv.save("fw-bg-2")


def plate(name, ramp, accent, motif, seed):
    n = 384
    cv = Canvas(n)
    r = np.hypot(cv.x - n / 2, cv.y - n / 2) / (n / 2)
    nz = noise(n, 6, seed)
    neb = np.clip(1 - r, 0, 1) ** 1.8 * (0.45 + 0.7 * nz)
    cv.fill(neb > 0, neb * 0.6, ramp, dither=1.0)
    a2 = np.clip(1 - np.hypot(cv.x - n * 0.38, cv.y - n * 0.6) / (n * 0.3), 0, 1) ** 1.5 * noise(n, 8, seed + 1)
    cv.fill(a2 > 0, a2 * 0.55, accent, dither=1.0)
    motif(cv, random.Random(seed), ramp, accent)
    cv.save(f"fw-sec-{name}")


def m_boot(cv, rng, ramp, accent):
    # POST lines: short bars of boot text marching out, each ending in an OK block
    for _ in range(16):
        x, y = rng.randrange(60, 300, 4), rng.randrange(60, 320, 6)
        L = rng.randrange(12, 40, 4)
        for k in range(0, L, 4):
            cv.dot(x + k, y, ramp, 3, w=3, h=2)
        cv.dot(x + L + 2, y - 1, accent, 4, w=4, h=4)


def m_memory(cv, rng, ramp, accent):
    # core memory: a lattice of small rings threaded by wires
    ox, oy = rng.randrange(90, 120), rng.randrange(90, 120)
    for j in range(7):
        for i in range(7):
            if rng.random() < 0.25:
                continue
            x, y = ox + i * 28, oy + j * 28
            for k in range(16):
                a = k / 16 * 2 * math.pi
                cv.dot(x + 4 * math.cos(a), y + 4 * math.sin(a), accent if (i + j) % 3 == 0 else ramp, 3)
            for t in range(-12, 13, 3):
                cv.dot(x + t, y + t, ramp, 1)


def m_relay(cv, rng, ramp, accent):
    # radio rings from a few masts
    for _ in range(4):
        x, y = rng.uniform(100, 290), rng.uniform(100, 290)
        for rad in (8, 16, 26):
            for k in range(int(rad * 3)):
                a = k / (rad * 3) * 2 * math.pi
                if math.sin(a * 2) > -0.2:
                    cv.dot(x + rad * math.cos(a), y + rad * math.sin(a), ramp, 3)
        for t in range(12):
            cv.dot(x, y + t, accent, 3)
        cv.dot(x - 1, y - 1, accent, 4, w=3, h=3)


def m_field(cv, rng, ramp, accent):
    # a floor plan: zone rooms as dotted boxes, a walking route threading them, small bolts where the weather hits
    rooms = [(rng.randrange(70, 250, 4), rng.randrange(70, 250, 4), rng.randrange(36, 70, 4), rng.randrange(28, 56, 4)) for _ in range(6)]
    for x, y, w, h in rooms:
        for t in range(0, w, 3):
            cv.dot(x + t, y, ramp, 3)
            cv.dot(x + t, y + h, ramp, 2)
        for t in range(0, h, 3):
            cv.dot(x, y + t, ramp, 2)
            cv.dot(x + w, y + t, ramp, 3)
    pts = [(x + w // 2, y + h // 2) for x, y, w, h in rooms]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        steps = int(max(abs(x1 - x0), abs(y1 - y0)))
        for k in range(0, steps, 4):
            cv.dot(x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps, accent, 3, w=2, h=2)
    for x, y in pts[::2]:
        for k, (dx, dy) in enumerate(((0, 0), (-3, 5), (2, 5), (-2, 10))):
            cv.dot(x + dx, y - 22 + dy, "amber", 4 if k % 2 == 0 else 3, w=2, h=4)


def core():
    n = 384
    cv = Canvas(n)
    r = np.hypot(cv.x - n / 2, cv.y - n / 2)
    glow = np.clip(1 - r / 150, 0, 1) ** 2
    cv.fill(glow > 0, glow * 0.7, "phos", dither=1.0)
    ang = (np.degrees(np.arctan2(cv.y - n / 2, cv.x - n / 2)) + 360) % 360
    for rad, ramp, step in ((66, "phos", 8), (104, "amber", 5), (146, "cyan", 4)):
        ring = (np.abs(r - rad) < 0.7) & ((ang // step) % 2 == 0)
        cv.fill(ring, np.full(ring.shape, 0.7), ramp)
        for k in range(16):
            a = k / 16 * 2 * math.pi
            for t in range(5 if k % 4 == 0 else 2):
                cv.dot(n / 2 + (rad + 2 + t) * math.cos(a), n / 2 + (rad + 2 + t) * math.sin(a), ramp, 3)
    cv.save("fw-core")


def scene():
    """The Root Chamber banner, 4 frames: the stair, the operator lamps, node zero and a turning key."""
    W, H, F = 480, 160, 4
    frames = []
    for f in range(F):
        cv = Canvas(W if W > H else H)  # square canvas; cropped below
        cv.img[..., 3] = 255
        n = cv.n
        y, x = cv.y, cv.x
        # back wall: dark glass with a vertical phosphor gradient and noise
        nz = noise(n, 8, 71)
        wall = 0.1 + 0.25 * (1 - y / H) + 0.2 * nz
        cv.fill(np.ones((n, n), bool), np.clip(wall, 0, 1), "glass")
        # a glow pooling round node zero at the bottom centre
        gx, gy = 228, 132
        g = np.clip(1 - np.hypot((x - gx) / 1.8, y - gy) / 90, 0, 1) ** 1.6 * (0.9 + 0.1 * math.sin(f * math.pi / 2))
        cv.fill((g > 0) & (y < H), g * 0.75, "phos", dither=1.0)
        # floor: a perspective grid
        floor = (y >= 128) & (y < H)
        cv.fill(floor, np.full(floor.shape, 0.12), "glass")
        for k in range(-12, 13):
            for t in range(32):
                yy = 128 + t
                xx = gx + k * (8 + t * 1.6)
                if 0 <= xx < W:
                    cv.dot(xx, yy, "phos", 1)
        for yy in (131, 136, 143, 152):
            for xx in range(0, W, 2):
                cv.dot(xx, yy, "phos", 1)
        # the mirror stair, coming down from the top right, mirrored faintly above
        for i in range(9):
            sx, sy = 452 - i * 22, 22 + i * 12
            for xx in range(sx - 24, sx):
                for t in range(3):
                    cv.dot(xx, sy + t, "cyan" if t == 0 else "glass", 3 if t == 0 else 4)
                cv.dot(xx, sy + 3, "cyan", 1)
            for yy in range(sy, sy + 12):
                cv.dot(sx - 24, yy, "cyan", 2)
        for i in range(6):  # the reflection, going up from the same landing
            sx, sy = 452 - i * 22, 20 - i * 3
            for xx in range(sx - 24, sx, 2):
                cv.dot(xx, sy, "cyan", 1)
        # four operator lamps on the left wall, in their own colours, with name plates
        for i, ramp in enumerate(("lime", "tcyan", "orange", "amber")):
            lx, ly = 34 + i * 34, 46
            on = (f + i) % 4 != 3 or i == 3
            cv.dot(lx - 6, ly - 10, "glass", 4, w=13, h=22)
            cv.dot(lx - 4, ly - 8, ramp, 3 if on else 1, w=9, h=9)
            cv.dot(lx - 2, ly - 6, ramp, 4 if on else 2, w=5, h=5)
            if on:
                for d in range(1, 5):
                    cv.dot(lx, ly - 4 + 8 + d * 3, ramp, 1)
            cv.dot(lx - 5, ly + 6, ramp, 2, w=11, h=3)
        # node zero: one small box, one wire
        bx, by = gx - 14, 104
        cv.dot(bx, by, "phos", 2, w=28, h=20)
        cv.dot(bx + 1, by + 1, "phos", 3, w=26, h=4)
        cv.dot(bx + 2, by + 6, "glass", 0, w=24, h=12)
        cv.dot(bx + 5, by + 9, "phos", 4 if f % 2 == 0 else 3, w=3, h=1)
        cv.dot(bx + 9, by + 10, "phos", 4, w=2 if f % 2 == 0 else 0 or 1, h=2)
        cv.dot(bx + 20, by + 14, "red", 4 if f < 2 else 2, w=2, h=2)
        for k in range(70):  # the wire: out of the back, along the floor, up to the stair
            cv.dot(bx + 28 + k, by + 16 + min(8, k // 4), "amber", 4 if (k + f * 6) % 24 < 3 else 2)
        for k in range(30):
            cv.dot(bx + 98 + k * 2, by + 24 - k * 1.4, "amber", 4 if (k + f * 3) % 12 < 2 else 2)
        # a key turning in the air above the box (4 angles)
        kx, ky = gx, 58
        ang = [0, 0.5, 1.0, 0.5][f] * math.pi / 2
        w = abs(math.cos(ang))
        for rr, sh in ((7, 3), (6, 4), (5, 3)):
            for k in range(32):
                a = k / 32 * 2 * math.pi
                cv.dot(kx + rr * math.cos(a) * max(0.25, w), ky + rr * math.sin(a), "amber", sh)
        for t in range(18):
            cv.dot(kx, ky + 7 + t, "amber", 3)
        for t in (12, 16):
            cv.dot(kx + 1, ky + 7 + t, "amber", 3, w=int(4 * max(0.3, w)) or 1, h=2)
        for k in range(12):  # sparkle round it
            a = k / 12 * 2 * math.pi + f * 0.4
            if k % 3 == f % 3:
                cv.dot(kx + 18 * math.cos(a), ky + 10 + 14 * math.sin(a), "amber", 2)
        frames.append(cv.img[:H, :W].copy())
    sheet = np.concatenate(frames, axis=0)
    im = Image.fromarray(sheet, "RGBA")
    im.save(OUT / "scene-handover.png", optimize=True)
    im.save(OUT / "scene-handover.webp", lossless=True, quality=100, method=6)
    print("  scene-handover", im.size)


def cut():
    """The Handover moment, 320 x 180, 8 frames stacked: an operator's desk seen from behind in a dark room. 0-2 the lamp is
    on and the terminal scrolls; 3 the lamp flickers; 4-5 the room goes dark and the screen holds one key; 6-7 the screen
    boots bright green for the next operator. components/nodefarm/handover-cut.tsx steps through it."""
    W, H, F = 320, 180, 8
    frames = []
    for f in range(F):
        cv = Canvas(W)
        cv.img[..., 3] = 255
        n = cv.n
        y, x = cv.y, cv.x
        lamp = 1.0 if f < 3 else (0.45 if f == 3 else 0.0)
        boot = 0.0 if f < 6 else (0.55 if f == 6 else 1.0)
        nz = noise(n, 8, 301)
        cv.fill(np.ones((n, n), bool), np.clip(0.1 + 0.25 * nz + 0.2 * lamp * (1 - y / H), 0, 1), "room")
        # lamp pool on the wall, warm
        if lamp:
            g = np.clip(1 - np.hypot((x - 92) / 1.3, y - 60) / 80, 0, 1) ** 1.7 * lamp
            cv.fill((g > 0) & (y < H), g * 0.7, "amber", dither=1.0)
        # screen glow, green, grows when the next operator boots
        sg = 0.35 + 0.65 * boot if f >= 4 else 0.45
        g2 = np.clip(1 - np.hypot((x - 176) / 1.4, y - 78) / (70 + 50 * boot), 0, 1) ** 1.8 * sg
        cv.fill((g2 > 0) & (y < H), g2 * 0.8, "phos", dither=1.0)
        # desk
        cv.dot(0, 128, "wood", 2, w=W, h=6)
        cv.dot(0, 134, "wood", 1, w=W, h=46)
        for xx in range(0, W, 2):
            cv.dot(xx, 128, "wood", 3 + (1 if lamp and 60 < xx < 140 else 0))
        # the terminal (a CRT box) on the desk
        tx, ty, tw, th = 136, 46, 82, 72
        cv.dot(tx, ty, "room", 4, w=tw, h=th)
        cv.dot(tx + 2, ty + 2, "phos", 1, w=tw - 4, h=2)
        sx, sy, sw, sh = tx + 8, ty + 8, tw - 16, th - 22
        cv.dot(sx, sy, "glass", 0, w=sw, h=sh)
        if f < 4:
            for row in range(7):  # scrolling log lines
                L = (7 + ((row + f * 3) * 37) % 40)
                cv.dot(sx + 4, sy + 4 + row * 6, "phos", 3 if row != 6 or f % 2 == 0 else 2, w=min(L, sw - 8), h=2)
        elif f < 6:
            kx, ky = sx + sw // 2, sy + sh // 2 - 6  # one key, held on the screen
            for k in range(24):
                a = k / 24 * 2 * math.pi
                cv.dot(kx + 5 * math.cos(a), ky + 5 * math.sin(a), "amber", 4)
            cv.dot(kx - 1, ky + 5, "amber", 4, w=2, h=12)
            cv.dot(kx + 1, ky + 12, "amber", 3, w=3, h=2)
            cv.dot(kx + 1, ky + 15, "amber", 3, w=2, h=2)
            if f == 5:
                cv.dot(sx + 4, sy + sh - 8, "phos", 4, w=4, h=4)
        else:
            fill = int(sh * (0.5 if f == 6 else 1))
            cv.dot(sx, sy + sh - fill, "phos", 1, w=sw, h=fill)
            for row in range(0, fill - 6, 6):
                cv.dot(sx + 4, sy + sh - fill + 4 + row, "phos", 4, w=8 + (row * 13) % 30, h=2)
            cv.dot(sx + 4, sy + 4, "phos", 4, w=4, h=4)
        cv.dot(tx + tw - 14, ty + th - 9, "red" if f < 4 else ("amber" if f < 6 else "phos"), 4, w=3, h=3)
        cv.dot(tx + 30, ty + th, "room", 3, w=22, h=10)  # neck and foot
        # keyboard
        cv.dot(138, 122, "room", 3, w=78, h=6)
        for k in range(18):
            cv.dot(140 + k * 4, 123, "phos" if f >= 6 else "room", 2 if f >= 6 else 4, w=3, h=2)
        # the desk lamp on the left
        cv.dot(70, 124, "room", 4, w=26, h=4)
        for t in range(40):
            cv.dot(80 + t * 0.35, 124 - t, "room", 4, w=2, h=1)
        for t in range(22):
            cv.dot(94 - t * 0.6, 84 - t * 0.3, "room", 4, w=2, h=1)
        cv.dot(68, 72, "amber" if lamp else "room", 4 if lamp == 1 else (2 if lamp else 3), w=16, h=6)
        cv.dot(70, 78, "amber" if lamp else "room", 3 if lamp else 2, w=12, h=2)
        # the chair back, empty, in silhouette
        # the cable from the terminal off the edge of the desk, a pulse running along it
        for k in range(60):
            cv.dot(176 + k * 2, 132 + min(20, k // 2), "amber", 4 if (k + f * 8) % 30 < 3 else 1)
        # the chair back, empty, in silhouette: a rounded back with a seam, a lumbar bar, the gas lift and a star base
        cx0, cy0, cw, ch = 198, 100, 40, 54
        back = ((x - (cx0 + cw / 2)) / (cw / 2)) ** 2 + ((np.maximum(y - (cy0 + 12), 0) / (ch - 12)) ** 6) + ((np.minimum(y - (cy0 + 12), 0) / 12) ** 2) <= 1
        cv.fill(back & (y < H), np.full(back.shape, 0.2), "room", dither=0)
        inner = ((x - (cx0 + cw / 2)) / (cw / 2 - 4)) ** 2 + ((np.maximum(y - (cy0 + 14), 0) / (ch - 18)) ** 6) + ((np.minimum(y - (cy0 + 14), 0) / 10) ** 2) <= 1
        cv.fill(inner & (y < H), np.full(back.shape, 0.45), "room", dither=0)
        for yy in range(cy0 + 8, cy0 + ch - 6, 2):
            cv.dot(cx0 + cw // 2, yy, "room", 0)
        cv.dot(cx0 + 4, cy0 + 34, "room", 0, w=cw - 8, h=4)
        if lamp:  # the lamp catches the edge of the backrest
            for yy in range(cy0 + 10, cy0 + 40):
                cv.dot(cx0 + 2 + max(0, (yy - cy0 - 30) // 6), yy, "amber", 1)
        cv.dot(cx0 + cw // 2 - 3, cy0 + ch, "room", 0, w=6, h=18)
        cv.dot(cx0 + cw // 2 - 3, cy0 + ch + 2, "room", 2, w=1, h=14)
        for dx in (-18, -8, 2, 12):
            cv.dot(cx0 + cw // 2 + dx, 176, "room", 0, w=8, h=3)
        # four operator mugs along the back of the desk, the last one still warm while the lamp is on
        for i, ramp in enumerate(("lime", "tcyan", "orange", "amber")):
            mx = 248 + i * 17
            cv.dot(mx, 118, ramp, 2 if lamp or f >= 6 else 1, w=10, h=10)
            cv.dot(mx + 10, 121, ramp, 1, w=3, h=4)
            if i == 3 and lamp == 1:
                for k in range(6):
                    cv.dot(mx + 3 + (k + f) % 3, 112 - k * 2, "amber", 2)
        frames.append(cv.img[:H, :W].copy())
    sheet = np.concatenate(frames, axis=0)
    im = Image.fromarray(sheet, "RGBA")
    im.save(OUT / "handover-cut.png", optimize=True)
    im.save(OUT / "handover-cut.webp", lossless=True, quality=100, method=6)
    print("  handover-cut", im.size)


if __name__ == "__main__":
    glass()
    near()
    plate("boot", "phos", "amber", m_boot, 91)
    plate("memory", "amber", "phos", m_memory, 92)
    plate("relay", "cyan", "phos", m_relay, 93)
    plate("field", "rose", "phos", m_field, 94)
    core()
    scene()
    cut()
