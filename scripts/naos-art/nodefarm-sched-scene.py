"""Scripts (scheduler) panel scene and script icons for Node Farm.

Scene: same contract as the zone sheets (scripts/naos-art/nodefarm_zone_kit.py): 288 x 96 cells, 8 stage rows, 6 frames,
writes public/naos/nodefarm/zone-sched.{png,webp}. Stage = scripts learned (lib/nodefarm/scripts.ts, `schedStage`).
  0 the cron room: an amber terminal wall with a crontab scrolling, a wall clock, a server floor
  1 buy.sh      a pick arm over a conveyor, dropping lime blocks
  2 reboot.sh   a magenta breaker panel whose lever throws and sparks
  3 compile.sh  a blue press stamping punch cards
  4 deploy.sh   a violet launch rail firing packets off to the right
  5 drop.sh     a yellow chute that drops a crate
  6 ascend.sh   a green lift beam with rings climbing it
  7 buy.sh v3   the daemon: an amber clock-face drone keeping time over the room
Icons: public/naos/nodefarm/sched-icons.{png,webp}, 32 px cells, one row per script (SCRIPTS order), 4 frames.
Run: python3 scripts/naos-art/nodefarm-sched-scene.py
"""
import math

import numpy as np
from PIL import Image

import nodefarm_zone_kit as K

W, H = K.W, K.H
FLOOR = 84
F = K.FRAMES


def backdrop(c, f):
    # amber phosphor wall: dark wash, scanlines, a crontab listing that scrolls, a wall clock
    c.haze(K.rect(0, 0, W, FLOOR), 0.3 + 0.55 * K.lin(0, 0, 0, FLOOR), "sn", alpha=80)
    scan = (K.yy.astype(int) % 3 == 0) & (K.yy < FLOOR)
    c.haze(scan, np.full((H, W), 0.5), "rn", alpha=60)
    # crontab lines: "* * * * *  cmd" as dashes, scrolling up a line per frame, brighter near the caret
    for row in range(9):
        y = 8 + ((row * 8 - f * 8 / F * 2) % 64)
        y = int(y)
        if y > FLOOR - 14:
            continue
        x = 6
        for k in range(5):
            c.shade(K.rect(x, y, x + 2, y + 2), "sn", 2 + (row == 4))
            x += 5
        w = 18 + (row * 13) % 30
        c.shade(K.rect(x + 3, y, x + 3 + w, y + 2), "sn", 1 + (row % 3 == 0))
    # caret blink
    if f % 2 == 0:
        c.shade(K.rect(6, 44, 10, 48), "sn", 4)
    # wall clock (cron) up high, hands turn
    cx, cy, r = 150, 16, 11
    c.fill(K.disc(cx, cy, r), 0.25 + 0.3 * K.radial(cx, cy, r), "sn")
    c.outline(K.disc(cx, cy, r), "sn", 3)
    for i in range(12):
        a = i / 12 * 2 * math.pi
        c.shade(K.rect(int(cx + 8 * math.sin(a)), int(cy - 8 * math.cos(a)), int(cx + 8 * math.sin(a)) + 1, int(cy - 8 * math.cos(a)) + 1), "sn", 4)
    a = f / F * 2 * math.pi
    c.fill(K.line(cx, cy, cx + 7 * math.sin(a), cy - 7 * math.cos(a), 1.2), 0.95, "wh", outline=False)
    c.fill(K.line(cx, cy, cx + 4 * math.sin(a / 12 + 1), cy - 4 * math.cos(a / 12 + 1), 1.6), 0.8, "sn", outline=False)
    # cable trays along the ceiling with a pulse
    for y, ramp in ((30, "sn"), (34, "rn")):
        c.haze(K.rect(40, y, W, y + 1), np.full((H, W), 0.95), ramp, alpha=90)
        px = 40 + (f * 40 + (y - 30) * 70) % (W - 40)
        c.shade(K.rect(px, y, px + 4, y + 1), ramp, 4)
    # floor: a server floor with tiles and a lit seam
    c.fill(K.rect(0, FLOOR, W, H), 0.18 + 0.25 * K.lin(0, FLOOR, 0, H), "gr")
    for x in range(0, W, 16):
        c.shade(K.rect(x, FLOOR, x + 1, H), "sn", 1)
    c.shade(K.rect(0, FLOOR, W, FLOOR + 1), "sn", 3)


def conveyor(c, f):
    # belt
    c.fill(K.rect(56, 74, 122, 80), 0.35 + 0.3 * K.lin(56, 74, 56, 80), "gr", outline=True)
    for i in range(9):
        x = 56 + (i * 8 + f * 8 // F * 1 + f) % 66
        c.shade(K.rect(x, 74, x + 2, 75), "lime", 2)
    for x in (60, 118):
        c.fill(K.disc(x, 77, 3), 0.6, "wh")
    c.fill(K.rect(62, 80, 66, FLOOR), 0.3, "gr"); c.fill(K.rect(112, 80, 116, FLOOR), 0.3, "gr")
    # blocks riding the belt
    for i in range(3):
        x = 64 + ((i * 22 + f * 22 // F * 2) % 52)
        c.fill(K.rect(x, 67, x + 7, 74), 0.5 + 0.4 * K.lin(x, 67, x + 7, 74), "lime", outline=True)
    # the arm: base, upper arm swinging, a claw holding a block
    bx, by = 74, 74
    c.fill(K.rect(bx - 5, 64, bx + 5, by), 0.45, "wh", outline=True)
    sw = math.sin(f / F * 2 * math.pi) * 0.5
    ex, ey = bx + 14 * math.cos(-1.1 + sw), 64 + 14 * math.sin(-1.1 + sw) * 1.0
    c.fill(K.line(bx, 64, ex, ey, 3), 0.7, "lime")
    hx, hy = ex + 12, ey + 6
    c.fill(K.line(ex, ey, hx, hy, 2.4), 0.8, "lime")
    c.fill(K.disc(ex, ey, 2.5), 0.9, "wh")
    c.fill(K.rect(int(hx) - 3, int(hy), int(hx) + 4, int(hy) + 2), 0.9, "wh")
    c.fill(K.rect(int(hx) - 2, int(hy) + 2, int(hx) + 3, int(hy) + 7), 0.75, "lime", outline=True)


def breaker(c, f):
    x0, y0, x1, y1 = 124, 50, 146, 80
    c.fill(K.rect(x0, y0, x1, y1), 0.28 + 0.3 * K.lin(x0, y0, x1, y1), "mag", outline=True)
    c.shade(K.rect(x0 + 2, y0 + 2, x1 - 2, y0 + 4), "mag", 3)
    for i in range(3):
        c.shade(K.rect(x0 + 3 + i * 6, y0 + 7, x0 + 7 + i * 6, y0 + 9), "lime" if (f + i) % 3 else "red", 4)
    # lever: up for half the loop, thrown down for the rest
    down = f >= F // 2
    px, py = (x0 + x1) / 2, y0 + 19
    tip = (px + 7, py + 8) if down else (px + 7, py - 8)
    c.fill(K.line(px, py, *tip, 2.5), 0.85, "wh")
    c.fill(K.disc(*tip, 2.6), 0.9, "mag")
    c.fill(K.disc(px, py, 2.5), 0.5, "wh")
    if f == F // 2:
        for a in range(6):
            t = a / 6 * 2 * math.pi
            c.shade(K.rect(int(px + 9 * math.cos(t)), int(py + 9 * math.sin(t)), int(px + 9 * math.cos(t)) + 1, int(py + 9 * math.sin(t)) + 1), "mag", 4)
    c.fill(K.rect(x0 + 2, y1, x0 + 5, FLOOR), 0.4, "gr"); c.fill(K.rect(x1 - 5, y1, x1 - 2, FLOOR), 0.4, "gr")


def press_(c, f):
    x0, x1 = 150, 182
    c.fill(K.rect(x0, 46, x0 + 4, FLOOR), 0.4, "si", outline=True)
    c.fill(K.rect(x1 - 4, 46, x1, FLOOR), 0.4, "si", outline=True)
    c.fill(K.rect(x0, 44, x1, 50), 0.6, "si", outline=True)
    ph = 4 + 8 * K.wave(f)
    c.fill(K.rect(x0 + 6, 50, x1 - 6, int(50 + ph)), 0.5 + 0.3 * K.lin(x0, 50, x1, 60), "si", outline=True)
    c.fill(K.rect(x0 + 8, int(50 + ph), x1 - 8, int(52 + ph)), 0.9, "wh")
    # card on the anvil with punched holes, and a finished stack
    c.fill(K.rect(x0 + 6, 70, x1 - 6, 74), 0.85, "wh")
    for i in range(5):
        if (i + f) % 2:
            c.shade(K.rect(x0 + 8 + i * 4, 71, x0 + 10 + i * 4, 73), "si", 1)
    c.fill(K.rect(x0 + 4, 74, x1 - 4, 80), 0.5, "si", outline=True)
    for i in range(3):
        c.fill(K.rect(x1 + 2, 76 - i * 2, x1 + 12, 77 - i * 2), 0.8, "wh", outline=False)


def rail(c, f):
    # an angled launch rail and packets flying off to the right
    c.fill(K.line(188, 74, 222, 50, 3), 0.55, "vs")
    c.fill(K.line(188, 77, 222, 53, 1.5), 0.35, "vs")
    c.fill(K.rect(186, 72, 194, FLOOR), 0.4, "vs", outline=True)
    for i in range(3):
        t = ((f / F) + i / 3) % 1
        x, y = 190 + t * 60, 70 - t * 44
        if x > W - 4:
            continue
        c.fill(K.rect(int(x), int(y), int(x) + 5, int(y) + 4), 0.85, "vs", outline=True)
        c.haze(K.line(x - 10, y + 7, x, y + 2, 1.5), np.full((H, W), 0.95), "qz", alpha=90)
    c.shade(K.rect(220, 48, 224, 52), "qz", 4 if f % 2 else 3)


def chute(c, f):
    c.fill(K.poly([(226, 30), (242, 30), (240, 58), (228, 58)]), 0.35 + 0.35 * K.lin(226, 30, 242, 58), "rn", outline=True)
    c.shade(K.rect(228, 34, 240, 35), "rn", 4)
    # a crate falls out of the chute into a pile
    y = 58 + int(16 * (f / (F - 1)) ** 2)
    c.fill(K.rect(230, min(y, 72), 238, min(y, 72) + 8), 0.65, "rn", outline=True)
    c.shade(K.rect(233, min(y, 72) + 2, 235, min(y, 72) + 6), "rn", 1)
    c.fill(K.rect(222, 78, 232, FLOOR), 0.55, "rn", outline=True)
    c.fill(K.rect(236, 76, 246, FLOOR), 0.45, "rn", outline=True)


def lift(c, f):
    cx = 266
    c.haze(K.rect(cx - 8, 0, cx + 8, FLOOR), 1 - np.abs(K.xx - cx) / 9, "ae", alpha=90)
    c.fill(K.rect(cx - 1, 6, cx + 1, FLOOR - 4), 0.95, "ae", outline=False)
    c.fill(K.rect(cx - 12, FLOOR - 6, cx + 12, FLOOR), 0.5, "ae", outline=True)
    for i in range(3):
        t = ((f / F) + i / 3) % 1
        y = FLOOR - 10 - t * 70
        ring = K.disc(cx, y, 9, 2.6) & ~K.disc(cx, y, 6.5, 1.4)
        c.fill(ring, 0.6 + 0.35 * (1 - t), "ae", outline=False)


def daemon(c, f):
    cx, cy = 104, 22 + 2 * K.wave(f)
    c.haze(K.disc(cx, cy, 18, 14), K.radial(cx, cy, 18), "sn", alpha=90)
    face = K.disc(cx, cy, 9)
    c.fill(face, 0.35 + 0.55 * K.radial(cx - 2, cy - 3, 10), "sn", outline=True)
    c.outline(K.disc(cx, cy, 10), "sn", 4)
    a = f / F * 2 * math.pi
    c.fill(K.line(cx, cy, cx + 6 * math.sin(a), cy - 6 * math.cos(a), 1.3), 0.95, "wh", outline=False)
    c.fill(K.line(cx, cy, cx + 3.5 * math.sin(-a / 2), cy - 3.5 * math.cos(-a / 2), 1.6), 0.95, "wh", outline=False)
    # little rotor arms and running lights
    for side in (-1, 1):
        c.fill(K.line(cx + side * 9, cy - 4, cx + side * 17, cy - 8, 1.4), 0.6, "gr", outline=False)
        blade = (cx + side * 17 + (3 if f % 2 else -3), cy - 9)
        c.fill(K.rect(int(blade[0]) - 4, int(blade[1]), int(blade[0]) + 4, int(blade[1]) + 1), 0.9, "wh", outline=False)
    c.shade(K.rect(int(cx) - 1, int(cy) + 11, int(cx) + 2, int(cy) + 13), "red" if f % 2 else "sn", 4)


SPRITES = [conveyor, breaker, press_, rail, chute, lift, daemon]


def draw(stage, frame):
    c = K.Cell()
    for fn in reversed(SPRITES[:stage]):
        layer = K.Cell()
        fn(layer, frame)
        layer.under(c)
        c = layer
    back = K.Cell()
    backdrop(back, frame)
    c.under(back)
    return c


# ---------------------------------------------------------------- icons (32 px, 4 frames, one row per script)
IF = 4


def icon_buy(c, f):
    c.fill(K.rect(3, 22, 29, 27), 0.4, "gr", outline=True)
    for i in range(4):
        x = 4 + (i * 7 + f * 2) % 24
        c.shade(K.rect(x, 22, x + 2, 23), "lime", 3)
    c.fill(K.rect(8 + f, 15, 15 + f, 22), 0.7, "lime", outline=True)
    c.fill(K.line(22, 22, 22, 9, 2.5), 0.6, "wh")
    c.fill(K.line(22, 9, 15 + f, 9, 2.2), 0.75, "lime")
    c.fill(K.rect(13 + f, 9, 18 + f, 13), 0.9, "wh")


def icon_reboot(c, f):
    c.fill(K.rect(6, 4, 26, 28), 0.3, "mag", outline=True)
    down = f >= 2
    c.fill(K.line(16, 16, 22, 23 if down else 9, 2.6), 0.85, "wh")
    c.fill(K.disc(22, 23 if down else 9, 2.6), 0.9, "mag")
    c.shade(K.rect(9, 7, 12, 9), "lime" if not down else "red", 4)


def icon_compile(c, f):
    c.fill(K.rect(5, 6, 27, 10), 0.6, "si", outline=True)
    h = 2 + 3 * (1 - abs(f - 1.5) / 1.5)
    c.fill(K.rect(10, 10, 22, int(10 + h + 3)), 0.55, "si", outline=True)
    c.fill(K.rect(7, 20, 25, 24), 0.9, "wh")
    for i in range(4):
        if (i + f) % 2:
            c.shade(K.rect(9 + i * 4, 21, 11 + i * 4, 23), "si", 1)
    c.fill(K.rect(5, 24, 27, 28), 0.45, "si", outline=True)


def icon_deploy(c, f):
    c.fill(K.line(4, 27, 22, 12, 2.6), 0.55, "vs")
    t = f / IF
    x, y = 8 + t * 18, 22 - t * 16
    c.fill(K.rect(int(x), int(y), int(x) + 6, int(y) + 5), 0.85, "vs", outline=True)
    c.shade(K.rect(int(x) - 4, int(y) + 6, int(x) - 1, int(y) + 7), "qz", 3)


def icon_drop(c, f):
    c.fill(K.poly([(8, 3), (24, 3), (22, 13), (10, 13)]), 0.5, "rn", outline=True)
    y = 13 + f * 3
    c.fill(K.rect(12, y, 20, y + 7), 0.7, "rn", outline=True)
    c.shade(K.rect(15, y + 2, 17, y + 5), "rn", 1)


def icon_ascend(c, f):
    c.fill(K.rect(15, 3, 17, 29), 0.95, "ae", outline=False)
    for i in range(2):
        t = ((f / IF) + i / 2) % 1
        y = 26 - t * 22
        ring = K.disc(16, y, 9, 2.6) & ~K.disc(16, y, 6.5, 1.4)
        c.fill(ring, 0.5 + 0.4 * (1 - t), "ae", outline=False)
    c.fill(K.rect(7, 27, 25, 30), 0.5, "ae", outline=True)


ICONS = [icon_buy, icon_reboot, icon_compile, icon_deploy, icon_drop, icon_ascend]


def save_icons():
    N = 32
    sheet = np.zeros((N * len(ICONS), N * IF, 4), np.uint8)
    for r, fn in enumerate(ICONS):
        for f in range(IF):
            c = K.Cell()
            fn(c, f)
            sheet[r * N:(r + 1) * N, f * N:(f + 1) * N] = c.img[:N, :N]
    im = Image.fromarray(sheet, "RGBA")
    for ext, kw in (("png", {"optimize": True}), ("webp", {"lossless": True, "quality": 100, "method": 6})):
        p = K.OUT / f"sched-icons.{ext}"
        im.save(p, **kw)
        print(f"  {p.name}: {p.stat().st_size / 1000:.1f} KB")


if __name__ == "__main__":
    K.save_sheet("sched", draw)
    save_icons()
