"""Ending art (dither, multicolour, original): the end screen banner for Node Farm's final build.

Writes to public/naos/nodefarm/:
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


if __name__ == "__main__":
    scene()
