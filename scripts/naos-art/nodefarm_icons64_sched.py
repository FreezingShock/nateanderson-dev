"""Scripts zone icons at 64 px, one per script (ROW order in components/nodefarm/scripts.tsx), eight frames each.
Each is drawn in its script's colour so the crontab rows read at a glance. Built by nodefarm-icons64.py (target `sched`)
into public/naos/nodefarm/sched-icons64.{png,webp}: eight frames across, nine rows down (512 x 576)."""
import math

import numpy as np

from nodefarm_icon_kit import (Canvas, P, X, Y, box, disc, lin, line, path, poly, radial, rect, ring, shadow, star4, wave)


def buy(c, p):
    """Auto-buy: a little robot arm pressing a lime key, again and again, a coin of light popping off each press."""
    shadow(c, 32, 24, 60)
    f, t, s = box(c, 8, 44, 40, 11, 7, "steel", -0.05)
    keys = [rect(12 + i * 9, 46, 19 + i * 9, 51) for i in range(4)]
    for k in keys:
        c.fill(k, 0.3, "steel", outline="steel")
    press = (p * 2) % 1.0
    down = press < 0.3
    key = rect(30, 46 + (1.2 if down else 0), 37, 51)
    c.fill(key, 0.85 if down else 0.6, "lime", outline="lime")
    # arm: base on the right, elbow, finger over the lit key
    c.fill(rect(48, 30, 55, 46), 0.45 + 0.3 * (1 - lin(48, 30, 55, 46)), "steel", outline="steel")
    ey = 18 + (3 if down else 0)
    fy = 36 + (8 if down else 0) - (0 if down else 2 * wave(p, 2))
    c.fill(path([(51, 30), (44, ey)], 4), 0.6, "steel", outline="steel")
    c.fill(path([(44, ey), (34, ey + 2), (34, fy)], 3.2), 0.65, "lime", outline="lime")
    c.fill(disc(44, ey, 3.2), 0.8, "steel", outline="steel")
    c.fill(rect(31.5, fy - 1, 36.5, fy + 2), 0.9, "white")
    if down:
        c.glow(key, P["lime"][5], 2, 140, 1)
        c.set(disc(26, 40 - press * 18, 1.6), P["lime"][6])
    c.set(rect(50, 33, 53, 35), P["lime"][6] if down else P["lime"][3])


def reboot(c, p):
    """Auto-Reboot: a breaker lever thrown down and back up, its lamp going red then green."""
    shadow(c, 32, 20, 60)
    cab = rect(12, 8, 52, 56)
    c.fill(cab, 0.18 + 0.3 * (1 - lin(12, 8, 52, 56)), "mag", outline="mag")
    c.fill(rect(16, 12, 48, 52), 0.08, "violet")
    c.rim(cab, P["mag"][4])
    k = int(p * 8)
    pos = [0, 0, 0.45, 1, 1, 1, 0.6, 0.2][k]  # 0 = lever up (on), 1 = thrown down (off)
    cx, cy = 32, 36
    ex, ey = 40, 20 + 32 * pos
    c.fill(rect(26, 30, 38, 42), 0.35, "steel", outline="steel")
    c.fill(path([(cx, cy), (ex, ey)], 3.4), 0.85, "white")
    c.fill(disc(ex, ey, 4.4), 0.9, "mag", outline="mag")
    off = 2 <= k <= 5
    lamp = disc(21, 18, 3.2)
    c.fill(lamp, 0.55 if off else 0.7, "red" if off else "lime")
    c.glow(lamp, P["red"][3] if off else P["lime"][5], 2, 150, 1)
    for i in range(3):
        c.set(rect(36 + i * 4, 17, 38 + i * 4, 19), P["mag"][5] if (k + i) % 3 == 0 else P["mag"][2])


def compile_(c, p):
    """Auto-compile: a press stamping a blue chip out of a strip, the strip feeding left each stroke."""
    shadow(c, 32, 26, 60)
    # press frame
    c.fill(rect(10, 6, 54, 13), 0.5 + 0.3 * (1 - lin(10, 6, 54, 13)), "si", outline="si")
    c.fill(rect(12, 13, 17, 50) | rect(47, 13, 52, 50), 0.35, "si", outline="si")
    stroke = 1 - abs((p * 2) % 1.0 - 0.5) * 2  # 0 up, 1 down
    ram_y = 18 + stroke * 14
    c.fill(rect(28, 13, 36, ram_y), 0.6, "steel", outline="steel")
    c.fill(rect(22, ram_y, 42, ram_y + 5), 0.7, "si", outline="si")
    # strip of chips on the bed, sliding left
    c.fill(rect(6, 44, 58, 50), 0.25, "steel", outline="steel")
    off = (p * 2 % 1.0) * 12
    for i in range(6):
        x = 4 + i * 12 - off
        chip = rect(x, 40, x + 8, 44) & rect(6, 0, 58, 64)
        c.fill(chip, 0.75, "si", outline="si")
        c.set(rect(x + 2, 41, x + 6, 43) & rect(6, 0, 58, 64), P["si"][6])
    if stroke > 0.85:
        for dx in (-12, 12):
            c.spark(32 + dx, 38, 3, ("si", 6), ("white", 2))
    c.fill(rect(12, 50, 52, 56), 0.4, "si", outline="si")


def deploy(c, p):
    """Auto-deploy: a payload capsule shooting up a launch rail, trailing violet exhaust, then the next one loading."""
    shadow(c, 26, 22, 60)
    rail = path([(10, 56), (50, 10)], 3)
    c.fill(rail, 0.4, "steel", outline="steel")
    c.fill(rect(4, 52, 22, 58), 0.45, "vs", outline="vs")
    t = (p * 1.25) % 1.25
    if t <= 1.0:
        x, y = 12 + t * 36, 50 - t * 41
        cap = poly([(x - 7, y + 5), (x + 2, y - 6), (x + 10, y - 9), (x + 7, y - 1), (x - 3, y + 9)]) | poly([(x - 7, y + 5), (x - 11, y + 2), (x - 6, y + 1)]) | poly([(x - 3, y + 9), (x - 1, y + 13), (x - 1, y + 7)])
        for k in range(1, 5):
            tx, ty = x - k * 3.6, y + k * 4.1
            c.set(disc(tx - 3, ty + 3, 4.6 - k * 0.8), P["vs"][7 - k], 235 - k * 40)
        c.fill(cap, 0.8, "vs", outline="vs")
        c.set(disc(x + 5, y - 5, 1.6), P["white"][2])
        c.glow(cap, P["vs"][5], 2, 120, 1)
    else:
        c.fill(rect(10, 46, 18, 52), 0.7, "vs", outline="vs")
    c.set(disc(13, 55, 1.2), P["vs"][6] if (p * 4) % 1 < 0.5 else P["vs"][3])


def drop(c, p):
    """Auto-collect: a gold dead-drop box; a package drops in, the lid snaps shut and the lamp blinks."""
    shadow(c, 32, 22, 60)
    f, t, s = box(c, 12, 30, 34, 26, 8, "gold", -0.1)
    c.fill(rect(16, 36, 42, 38), 0.2, "gold")
    k = int(p * 8)
    lid_open = k < 5
    lid = poly([(12, 30), (46, 30), (54, 25), (20, 25)]) if not lid_open else poly([(12, 30), (20, 25), (24, 8), (16, 13)])
    c.fill(lid, 0.6 if lid_open else 0.8, "gold", outline="gold")
    if k < 4:
        y = 2 + k * 7
        pk = rect(26, y, 36, y + 8)
        c.fill(pk, 0.55, "brass", outline="brass")
        c.set(rect(30.5, y, 31.5, y + 8) | rect(26, y + 3.5, 36, y + 4.5), P["brass"][5])
    lamp = disc(40, 44, 2.6)
    on = k >= 5 and k % 2 == 1
    c.fill(lamp, 0.7 if on else 0.3, "lime" if on else "gold")
    if on:
        c.glow(lamp, P["lime"][5], 2, 150, 1)


def ascend(c, p):
    """Auto-Ascend: a mint antenna mast throwing signal rings upward, the tip flashing as each ring leaves."""
    shadow(c, 32, 18, 60)
    c.fill(poly([(20, 58), (44, 58), (36, 50), (28, 50)]), 0.45, "ae", outline="ae")
    c.fill(rect(29.5, 10, 34.5, 52), 0.75, "ae", outline="ae")
    for y in (20, 32, 44):
        c.fill(path([(26, y + 4), (32, y), (38, y + 4)], 1.4), 0.6, "steel")
    for i in range(3):
        q = (p + i / 3) % 1.0
        y = 46 - q * 40
        rx, ry = 7 + q * 9, 2.2 + q * 1.4
        m = (((X - 32) / rx) ** 2 + ((Y - y) / ry) ** 2 <= 1) & (((X - 32) / (rx - 2.6)) ** 2 + ((Y - y) / max(0.6, ry - 1.2)) ** 2 > 1)
        c.set(m, P["ae"][7 if q < 0.3 else 5], int(255 * (1 - q * 0.75)))
    tip = disc(32, 8, 2.8)
    c.fill(tip, 1.0, "ae")
    c.glow(tip, P["ae"][5], 3, int(80 + 140 * wave(p, 3)), 2)
    c.fill(star4(32, 8, 3 + 2 * wave(p, 3), 1), 1.0, "white")


def rig(c, p):
    """Auto-rig: an orange pumpjack nodding over a well head, the counterweight swinging, a drop of ore glowing at the pipe."""
    shadow(c, 32, 24, 60)
    c.fill(rect(8, 52, 56, 57), 0.45, "steel", outline="steel")
    c.fill(poly([(26, 52), (30, 26), (34, 26), (38, 52)]), 0.5, "cu", outline="cu")
    a = 0.32 * math.sin(2 * math.pi * p)
    cx, cy = 32, 26
    hx, hy = cx - 20 * math.cos(a), cy - 20 * math.sin(a)
    tx, ty = cx + 18 * math.cos(a), cy + 18 * math.sin(a)
    c.fill(path([(hx, hy), (tx, ty)], 4), 0.75, "cu", outline="cu")
    head = poly([(hx - 2, hy - 6), (hx + 4, hy - 4), (hx + 4, hy + 4), (hx - 2, hy + 7)])
    c.fill(head, 0.85, "cu", outline="cu")
    c.fill(path([(hx - 1, hy + 6), (hx - 1, 50)], 1.2), 0.6, "steel")
    c.fill(disc(cx, cy, 2.6), 0.9, "steel", outline="steel")
    # crank and counterweight on the right
    c.fill(disc(46, 44, 7), 0.4, "steel", outline="steel")
    cwx, cwy = 46 + 5 * math.cos(2 * math.pi * p), 44 + 5 * math.sin(2 * math.pi * p)
    c.fill(disc(cwx, cwy, 3.4), 0.85, "ember", outline="ember")
    c.fill(path([(tx, ty), (cwx, cwy)], 1.4), 0.6, "steel")
    c.fill(rect(10, 46, 18, 52), 0.5, "steel", outline="steel")
    ore = disc(14, 43, 2.2 + wave(p) * 0.8)
    c.fill(ore, 1.0, "gold")
    c.glow(ore, P["gold"][4], 2, 140, 1)


def event(c, p):
    """Auto-answer: a pickaxe swinging into a gold vein in dark rock, nuggets and sparks flying on each strike."""
    shadow(c, 32, 26, 60)
    rock = poly([(6, 58), (8, 34), (20, 26), (34, 30), (48, 24), (58, 34), (58, 58)])
    c.fill(rock, 0.25 + 0.3 * (1 - lin(6, 24, 58, 58)), "stone", outline="stone")
    vein = path([(10, 52), (22, 44), (30, 46), (42, 38), (54, 40)], 3)
    c.fill(vein & rock, 0.7 + 0.25 * wave(p, 2), "gold")
    c.glow(vein & rock, P["gold"][4], 2, 90, 1)
    hit = (p * 2) % 1.0
    # swing: raised (handle up) to struck (head in the vein), pivoting at the grip
    k = min(1.0, hit / 0.45) if hit < 0.45 else 1 - (hit - 0.45) / 0.55
    th = math.radians(-70 - 92 * k * k)
    gx, gy = 54, 52
    hx, hy = gx + 30 * math.cos(th), gy + 30 * math.sin(th)
    c.fill(path([(gx, gy), (hx, hy)], 3.4), 0.3 + 0.15 * (1 - lin(gx, gy, hx, hy)), "eg", outline="eg")
    nx, ny = -math.sin(th), math.cos(th)
    dx, dy = math.cos(th), math.sin(th)
    head = path([(hx + 12 * nx - 3 * dx, hy + 12 * ny - 3 * dy), (hx + 1 * dx, hy + 1 * dy), (hx - 12 * nx - 3 * dx, hy - 12 * ny - 3 * dy)], 4)
    c.fill(head, 0.5 + 0.4 * (1 - lin(hx - 12, hy - 12, hx + 12, hy + 12)), "steel", outline="steel")
    c.rim(head, P["steel"][6])
    if 0.4 < hit < 0.75:
        q = (hit - 0.4) / 0.35
        tip = (hx + 12 * nx - 3 * dx, hy + 12 * ny - 3 * dy)
        for ddx, ddy in ((-5, -8), (3, -11), (8, -5), (-9, -3)):
            c.spark(tip[0] + ddx * (0.4 + q), tip[1] + ddy * (0.4 + q), 1, ("gold", 5), ("white", 2))
        c.fill(disc(tip[0] - 5 - 7 * q, tip[1] - 4 - 9 * q + 12 * q * q, 2), 1.0, "gold")

def restore(c, p):
    """Auto-restore: a small prestige-tree node being rebuilt inside a lime restore arrow that runs round it."""
    shadow(c, 32, 20, 60)
    tile = poly([(32, 20), (44, 32), (32, 44), (20, 32)])
    lit = (p * 4) % 1.0
    c.fill(tile, 0.3 + 0.5 * (1 - lin(20, 20, 44, 44)), "violet", outline="violet")
    c.fill(disc(32, 32, 4.5), 0.6 + 0.4 * lit, "lime", outline="lime")
    for k, (x, y) in enumerate(((32, 10), (54, 32), (32, 54), (10, 32))):
        done = k < int(p * 4) + 1
        c.fill(path([(32, 32), (x, y)], 1.2) & ~tile, 0.8 if done else 0.3, "lime" if done else "steel")
        c.fill(disc(x, y, 3.2), 0.8 if done else 0.3, "lime" if done else "steel", outline="lime" if done else "steel")
    a0 = 2 * math.pi * p
    m = ring(32, 32, 27, 24) & (((np.arctan2(Y - 32, X - 32) - a0) % (2 * math.pi)) < 4.6)
    c.fill(m, 0.75, "lime")
    ex, ey = 32 + 25.5 * math.cos(a0 + 4.6), 32 + 25.5 * math.sin(a0 + 4.6)
    tx, ty = -math.sin(a0 + 4.6), math.cos(a0 + 4.6)
    nx, ny = math.cos(a0 + 4.6), math.sin(a0 + 4.6)
    c.fill(poly([(ex + 6 * tx, ey + 6 * ty), (ex - 5 * nx, ey - 5 * ny), (ex + 5 * nx, ey + 5 * ny)]), 0.95, "lime", outline="lime")
    c.glow(m, P["lime"][5], 2, 90, 1)


DRAW = [buy, reboot, compile_, deploy, drop, ascend, rig, event, restore]  # ROW order in components/nodefarm/scripts.tsx
