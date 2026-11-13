"""Ending art (dither, multicolour, original): the end screen banner for Node Farm's final build.

Writes to public/naos/nodefarm/:
  end-build     320 x 140, opaque, 6 frames stacked (0 to 5 stages built): the final build as a cut-away. The buried
                sun under the floor, five conduits rising to five sockets in an arc round node zero, each socket with its
                own glyph and colour. A built stage's conduit runs gold and its socket burns; at 5 a light column rises.
  end-lamps     24 x 40 cells, transparent, 5 columns (wren, tamsin, osk, vael, you) x 2 rows (off, lit): wall lamps
                for the end screen's operator roll.
  scene-ending  480 x 160, opaque, 4 frames stacked: node zero awake. The buried sun glows under the floor, a column of
                light rises through the box, rings pulse out, the wire runs gold, and five lamps burn on the wall: the
                four past operators in their protocol colours and a fifth, white-cyan, for you.
The end screen (components/nodefarm/ending.tsx) steps through the frames. Reuses the Canvas, noise and ramps of
nodefarm-handover-art.py. Run: python3 scripts/naos-art/nodefarm-ending-art.py
"""
import importlib.util
import math
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("handart", HERE / "nodefarm-handover-art.py")
ha = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ha)
lab = ha.lab
Canvas, noise, OUT = ha.Canvas, ha.noise, ha.OUT

lab.RAMP.update({
    "sun": ["#2a1402", "#7a3a06", "#d07a10", "#ffd04a", "#fff6d0"],
    "dusk": ["#05040a", "#0c0a18", "#141026", "#1e1836", "#2a2248"],
    "you": ["#0a2a30", "#1c6070", "#5ac8d8", "#c8f6ff", "#ffffff"],
})


def scene():
    W, H, F = 480, 160, 4
    frames = []
    gx, floor_y = 240, 126
    for f in range(F):
        cv = Canvas(W)
        cv.img[..., 3] = 255
        n = cv.n
        y, x = cv.y, cv.x
        pulse = 0.5 + 0.5 * math.sin(f * math.pi / 2)
        # back wall: dusk glass, warmer toward the floor
        nz = noise(n, 8, 171)
        cv.fill(np.ones((n, n), bool), np.clip(0.12 + 0.3 * (y / H) + 0.2 * nz, 0, 1), "dusk")
        # the buried sun: a huge disc under the floor, only its top showing as heat through the boards
        r = np.hypot((x - gx) / 1.6, y - (floor_y + 90))
        sun = np.clip(1 - r / 150, 0, 1) ** 1.4 * (0.85 + 0.15 * pulse)
        cv.fill((sun > 0) & (y < H), sun * 0.95, "sun", dither=1.0)
        # light column through node zero, flickering width per frame
        cw = 9 + f % 2 * 2
        col = (np.abs(x - gx) < cw) & (y < floor_y)
        cv.fill(col, np.clip(0.35 + 0.4 * (y / floor_y), 0, 1) * np.clip(1 - np.abs(x - gx) / cw, 0, 1) ** 0.6, "you", dither=1.0)
        # rings pulsing out from the box, one new ring each frame
        rr = np.hypot((x - gx) / 1.9, y - 112)
        for k in range(4):
            rad = 18 + ((k * 22 + f * 5.5) % 88)
            ring = (np.abs(rr - rad) < 0.6) & (y < floor_y)
            cv.fill(ring, np.full(ring.shape, 0.75 - rad / 180), "sun" if k % 2 else "you", dither=0.7)
        # floor: perspective grid in gold
        floor = (y >= floor_y) & (y < H)
        for k in range(-14, 15):
            for t in range(H - floor_y):
                xx = gx + k * (8 + t * 1.7)
                if 0 <= xx < W:
                    cv.dot(xx, floor_y + t, "sun", 2 if abs(k) < 3 else 1)
        for yy in (floor_y + 3, floor_y + 8, floor_y + 15, floor_y + 25):
            for xx in range(0, W, 2):
                cv.dot(xx, yy, "sun", 1)
        # five lamps on the left wall: four operators and you, all burning
        for i, ramp in enumerate(("lime", "tcyan", "orange", "amber", "you")):
            lx, ly = 30 + i * 30, 44
            cv.dot(lx - 6, ly - 10, "dusk", 4, w=13, h=22)
            cv.dot(lx - 4, ly - 8, ramp, 3, w=9, h=9)
            cv.dot(lx - 2, ly - 6, ramp, 4, w=5, h=5)
            for d in range(1, 6):
                cv.dot(lx, ly + 4 + d * 3, ramp, 2 if (d + f + i) % 3 else 3)
            cv.dot(lx - 5, ly + 6, ramp, 2, w=11, h=3)
        # the stair down from the Root Chamber, top right, now dark: nobody needs to come down it any more
        for i in range(8):
            sx, sy = 470 - i * 20, 18 + i * 11
            for xx in range(sx - 22, sx):
                cv.dot(xx, sy, "tcyan", 2)
                cv.dot(xx, sy + 1, "dusk", 4)
            for yy in range(sy, sy + 11):
                cv.dot(sx - 22, yy, "tcyan", 1)
        # node zero: one small box, one wire, now lit
        bx, by = gx - 14, 100
        cv.dot(bx, by, "sun", 3, w=28, h=20)
        cv.dot(bx + 1, by + 1, "sun", 4, w=26, h=4)
        cv.dot(bx + 2, by + 6, "dusk", 1, w=24, h=12)
        for k in range(5):  # status lights, all green-cyan, chasing
            cv.dot(bx + 4 + k * 4, by + 10, "you", 4 if (k + f) % 5 < 3 else 2, w=2, h=2)
        for k in range(110):  # the wire, gold, running both ways along the floor
            on = (k + f * 7) % 20 < 4
            cv.dot(bx + 28 + k, by + 16 + min(10, k // 4), "sun", 4 if on else 3)
            cv.dot(bx - 1 - k, by + 16 + min(10, k // 4), "sun", 4 if on else 3)
        # motes rising in the column
        for k in range(14):
            yy = (floor_y - ((k * 17 + f * 9) % floor_y))
            cv.dot(gx + ((k * 5) % 11) - 5, yy, "you", 4 if k % 3 == 0 else 3)
        frames.append(cv.img[:H, :W].copy())
    sheet = np.concatenate(frames, axis=0)
    im = Image.fromarray(sheet, "RGBA")
    im.save(OUT / "scene-ending.png", optimize=True)
    im.save(OUT / "scene-ending.webp", lossless=True, quality=100, method=6)
    print("  scene-ending", im.size)


# stage sockets: glyph (7 x 7), ramp, position on the arc
GLYPHS = {
    "power": ["...#...", "..##...", ".##....", "#######", "....##.", "...##..", "...#..."],
    "clock": [".#####.", "#..#..#", "#..#..#", "#..###.", "#.....#", "#.....#", ".#####."],
    "memory": ["#.#.#.#", "#######", "#.....#", "#.###.#", "#.....#", "#######", "#.#.#.#"],
    "voice": ["...#...", ".#.#.#.", "##.#.##", "#######", "##.#.##", ".#.#.#.", "...#..."],
    "wake": ["..###..", ".#...#.", "#..#..#", "#.###.#", "#..#..#", ".#...#.", "..###.."],
}
STAGES = [("power", "sun"), ("clock", "tcyan"), ("memory", "lime"), ("voice", "orange"), ("wake", "you")]


def build():
    W, H, F = 320, 140, 6
    gx, sun_y, box_y = 160, 176, 8
    frames = []
    # sockets on an arc above the floor, left to right
    sockets = [(gx + math.cos(math.radians(a)) * 118, 90 - math.sin(math.radians(a)) * 40) for a in (168, 132, 90, 48, 12)]
    for f in range(F):
        cv = Canvas(W)
        cv.img[..., 3] = 255
        n = cv.n
        y, x = cv.y, cv.x
        nz = noise(n, 8, 271)
        cv.fill(np.ones((n, n), bool), np.clip(0.1 + 0.26 * (y / H) + 0.18 * nz, 0, 1), "dusk")
        # the buried sun: brighter with every stage
        r = np.hypot((x - gx) / 1.5, y - sun_y)
        heat = 0.45 + 0.11 * f
        sun = np.clip(1 - r / 120, 0, 1) ** 1.5 * heat
        cv.fill((sun > 0) & (y < H), sun, "sun", dither=1.0)
        # floor line and rock strata
        for xx in range(0, W):
            cv.dot(xx, 112, "sun", 2 if f else 1)
        for k, yy in enumerate((118, 125, 133)):
            for xx in range(k * 3, W, 5 + k):
                cv.dot(xx, yy, "dusk", 4)
        # node zero
        lit_box = f >= 5
        bx, by = gx - 14, box_y
        cv.dot(bx, by, "sun" if lit_box else "dusk", 3 if lit_box else 4, w=28, h=20)
        cv.dot(bx + 1, by + 1, "sun" if lit_box else "tcyan", 4 if lit_box else 1, w=26, h=3)
        cv.dot(bx + 2, by + 6, "dusk", 0, w=24, h=12)
        for k in range(5):
            on = k < f
            cv.dot(bx + 4 + k * 4, by + 10, STAGES[k][1], 4 if on else 1, w=2, h=2)
        if lit_box:
            col = (np.abs(x - gx) < 7) & (y < box_y)
            cv.fill(col, np.clip(0.4 + 0.6 * (1 - np.abs(x - gx) / 7), 0, 1), "you", dither=1.0)
            for rad in (30, 44):
                ring = (np.abs(np.hypot((x - gx) / 1.6, y - (box_y + 10)) - rad) < 0.6) & (y < 112)
                cv.fill(ring, np.full(ring.shape, 0.6), "sun", dither=0.6)
        # conduits: from the sun's crown up to each socket, then a short lead into node zero
        for i, (sx, sy) in enumerate(sockets):
            built = i < f
            ramp, base = ("sun", 4) if built else ("dusk", 4)
            x0, y0 = gx + (i - 2) * 9, 112
            steps = 60
            for t in range(steps + 1):
                u = t / steps
                cx = (1 - u) ** 2 * x0 + 2 * (1 - u) * u * (x0 + (sx - x0) * 0.1) + u * u * sx
                cy = (1 - u) ** 2 * y0 + 2 * (1 - u) * u * (sy + 20) + u * u * (sy + 6)
                shade = base if not built else (4 if (t // 3) % 3 == 0 else 3)
                cv.dot(cx, cy, ramp, shade, w=2, h=1)
                if not built:
                    cv.dot(cx, cy + 1, "dusk", 3)
            for t in range(24):  # lead from socket to node zero
                u = t / 23
                lx = sx + (gx + (i - 2) * 4 - sx) * u
                ly = sy - 6 + (box_y + 18 - (sy - 6)) * u
                cv.dot(lx, ly, "sun" if built else "dusk", 3 if built else 3)
            # socket housing
            glyph, gr = STAGES[i]
            cv.dot(sx - 7, sy - 7, "dusk", 4, w=15, h=15)
            cv.dot(sx - 6, sy - 6, "dusk", 1, w=13, h=13)
            for j, row in enumerate(GLYPHS[glyph]):
                for k, ch in enumerate(row):
                    if ch == "#":
                        cv.dot(sx - 3 + k, sy - 3 + j, gr if built else "dusk", 4 if built else 3)
            if built:
                halo = (np.abs(np.hypot(x - sx, y - sy) - 10) < 0.7)
                cv.fill(halo, np.full(halo.shape, 0.7), gr, dither=0.6)
        frames.append(cv.img[:H, :W].copy())
    im = Image.fromarray(np.concatenate(frames, axis=0), "RGBA")
    im.save(OUT / "end-build.png", optimize=True)
    im.save(OUT / "end-build.webp", lossless=True, quality=100, method=6)
    print("  end-build", im.size)


def lamps():
    CW, CH = 24, 40
    ramps = ("lime", "tcyan", "orange", "amber", "you")
    sheet = np.zeros((CH * 2, CW * 5, 4), np.uint8)
    for row in range(2):
        for i, ramp in enumerate(ramps):
            cv = Canvas(48)
            on = row == 1
            cx = 12
            if on:
                glow = np.clip(1 - np.hypot(cv.x - cx, cv.y - 13) / 13, 0, 1) ** 1.4
                cv.fill(glow > 0.05, glow * 0.55, ramp, dither=1.0)
            cv.dot(cx - 7, 2, "dusk", 4, w=15, h=24)  # housing
            cv.dot(cx - 6, 3, "dusk", 2, w=13, h=22)
            cv.dot(cx - 5, 5, ramp, 3 if on else 0, w=11, h=11)  # lens
            cv.dot(cx - 3, 7, ramp, 4 if on else 1, w=7, h=7)
            if on:
                cv.dot(cx - 1, 8, "you", 4, w=2, h=2)
            cv.dot(cx - 5, 18, ramp, 2 if on else 0, w=11, h=3)  # name plate
            cv.dot(cx - 1, 26, "dusk", 3, w=3, h=10)  # stem
            for d in range(4):
                cv.dot(cx, 27 + d * 3, ramp, 3 if on else 0)
            cv.dot(cx - 6, 36, "dusk", 4, w=13, h=3)  # foot
            sheet[row * CH:(row + 1) * CH, i * CW:(i + 1) * CW] = cv.img[:CH, :CW]
    im = Image.fromarray(sheet, "RGBA")
    im.save(OUT / "end-lamps.png", optimize=True)
    im.save(OUT / "end-lamps.webp", lossless=True, quality=100, method=6)
    print("  end-lamps", im.size)


if __name__ == "__main__":
    scene()
    build()
    lamps()
