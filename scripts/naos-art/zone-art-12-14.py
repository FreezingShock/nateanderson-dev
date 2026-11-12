"""Node Farm staged zone art for zone 12 Engram Archive (Engrams), zone 13 Mirror Stair (Paradox) and zone 14 Root Chamber (Origin).

Follows the staged zone art contract v4 (docs/node-farm.md, "Zone art"; kit in nodefarm_zone_kit.py): one sheet per zone at
public/naos/nodefarm/zone-<statId>, cells of 288 x 96 art px, 8 rows (row 0 is the bare backdrop, row n adds sprite n on top of
row n-1) by 6 frames across, a 6-frame loop at 6 fps. Rows 0-31 reach up to the panel's title bar; sprites stand on the floor at
row 94. Sprites 1-6 follow the zone's six button tiers (lib/nodefarm/lore.ts), sprite 7 is the zone's namesake.

Everything is flat shapes shaded through the 4x4 Bayer threshold into the ramps of nodefarm-icons.py (the zone ramp, a couple
of accents, plus wh/gr). Alpha is 0 or 255 except the backdrop haze (alpha <= 90, shades 0-1 only).

Placement: the far left (about 60 px) sits behind the zone description, so it only gets backdrop; the top right sits under the
big number, so the hero (sprite 7) stands right of centre and low. Sprites walk up in size from left to right.

Run: python3 scripts/naos-art/zone-art-12-14.py [engrams|paradox|origin ...]
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import numpy as np  # noqa: E402
import nodefarm_zone_kit as K  # noqa: E402

W, H, F = K.W, K.H, K.FRAMES
FLOOR = 94  # sprites stand on this row
TAU = math.tau
RAMPS = K.RAMPS
poly, disc, rect, line, lin, radial = K.poly, K.disc, K.rect, K.line, K.lin, K.radial
yy, xx = K.yy, K.xx

# x centre of each sprite (1..7): small ones on the left past the description, the hero right of centre
SLOT = {1: 70, 2: 86, 3: 106, 4: 132, 5: 162, 6: 198, 7: 246}


def hsh(*a):
    h = 2166136261
    for v in a:
        h = ((h ^ (int(v) & 0xFFFFFFFF)) * 16777619) & 0xFFFFFFFF
    return h


def rnd(*a):
    return (hsh(*a) % 10007) / 10007.0


def wave(f, phase=0.0):
    """0..1..0 over the 6-frame loop, offset by phase (0..1)."""
    return 0.5 - 0.5 * math.cos(TAU * (f / F + phase))


def px(c, x, y, rn, i):
    """One pixel (or a 1 x 1 dot) in a ramp shade."""
    c.shade(rect(round(x), round(y), round(x) + 1, round(y) + 1), rn, i)


def twinkle(c, f, n, seed, box, ramps, alpha=255):
    """Points that blink on a 6-frame loop: each one is lit for a different stretch of frames."""
    x0, y0, x1, y1 = box
    for i in range(n):
        x = x0 + rnd(seed, i, 1) * (x1 - x0)
        y = y0 + rnd(seed, i, 2) * (y1 - y0)
        ph = int(rnd(seed, i, 3) * F)
        lit = (f + ph) % F
        rn = ramps[i % len(ramps)]
        if lit < 2:
            c.shade(rect(round(x), round(y), round(x) + 1, round(y) + 1), rn, 4 if lit == 0 else 3, alpha)
        elif lit < 4:
            c.shade(rect(round(x), round(y), round(x) + 1, round(y) + 1), rn, 2, alpha)


def ground(c, rn, f, accent="cyan"):
    """Floor line with a seam pattern and a slow light travelling along it."""
    c.fill(rect(0, FLOOR, W, FLOOR + 2), 0.25, rn)
    c.shade(rect(0, FLOOR, W, FLOOR + 1), rn, 2)
    for x in range(0, W, 12):
        c.shade(rect(x, FLOOR + 1, x + 1, FLOOR + 2), rn, 0)
    p = (f / F) * 48
    for k in range(6):
        x = int(p + k * 48) % W
        c.shade(rect(x, FLOOR, x + 3, FLOOR + 1), accent, 4)


# =====================================================================================================================
# zone 12 ENGRAM ARCHIVE  /  Engrams.  Ramps: eg (sepia film), accents cyan (projector light) + mag (memory glitch) + rn
# =====================================================================================================================
OP_COLS = ["lime", "cyan", "cu", "rn"]  # four small lights, one per earlier operator of the node (colours from lib/nodefarm/news.ts)


def reel(c, cx, cy, R, f, holes=4, spin=1, rn="eg", film=True):
    """A film reel seen face on: dark coil of film, metal flange with round cut-outs that turn with the frame."""
    if film:
        coil = disc(cx, cy, R)
        c.fill(coil, 0.1 + 0.15 * lin(cx - R, cy - R, cx + R, cy + R), rn)
        for k in range(max(1, int(R / 3))):
            rr = R - 1.4 - k * 1.7
            if rr > R * 0.75:
                c.shade(disc(cx, cy, rr) & ~disc(cx, cy, rr - 0.6), rn, 1)
        fl = R * 0.78
    else:
        fl = R
    flange = disc(cx, cy, fl)
    cut = np.zeros_like(flange)
    a0 = spin * (TAU / holes) * (f / F)
    for k in range(holes):
        a = a0 + k * TAU / holes
        cut |= disc(cx + math.cos(a) * fl * 0.55, cy + math.sin(a) * fl * 0.55, max(1.0, fl * 0.26))
    c.fill(flange & ~cut, 0.5 + 0.45 * lin(cx + fl, cy + fl, cx - fl, cy - fl), rn)
    c.shade(flange & ~disc(cx, cy, fl - 0.9) & ~cut, rn, 4)
    c.shade(disc(cx, cy, max(1.0, fl * 0.16)), rn, 1)


def film_strip(c, x0, y0, x1, y1, f, w=5, lit=("cyan", "mag", "eg"), seed=0, scroll=True):
    """A strip of film from (x0, y0) to (x1, y1): sprocket holes on both edges, frames that flicker with old images."""
    L = math.hypot(x1 - x0, y1 - y0) or 1
    ux, uy = (x1 - x0) / L, (y1 - y0) / L
    nx, ny = -uy * w / 2, ux * w / 2
    body = poly([(x0 + nx, y0 + ny), (x1 + nx, y1 + ny), (x1 - nx, y1 - ny), (x0 - nx, y0 - ny)])
    c.fill(body, 0.02, "eg", dither=0.3)
    off = (f / F) * 6 if scroll else 0
    t = off % 3
    while t < L:
        for s in (-1, 1):
            hx, hy = x0 + ux * t + nx * s * 0.75, y0 + uy * t + ny * s * 0.75
            px(c, hx, hy, "eg", 2)
        t += 3
    k, t = 0, (off % 6) + 1
    while t + 4 < L:
        fx, fy = x0 + ux * (t + 2), y0 + uy * (t + 2)
        rn = lit[(k + seed) % len(lit)]
        on = (hsh(seed, k, f // 2) % 3) != 0
        m = disc(fx, fy, 1.8, max(1.0, w * 0.28))
        c.shade(m & body, rn, 3 if on else 1)
        k += 1
        t += 6


def stacks_bg(c, f):
    """Far wall: archive shelves of reels and boxes, receding into the dark, with blinking index lights on the shelf ends.
    Shelves are haze (dark shades, part alpha) so the sprites read on top; only the index lights and dust are bright."""
    c.haze(rect(0, 0, W, FLOOR), 0.15 + 0.35 * lin(0, 0, 0, FLOOR), "eg", alpha=45)
    units = [(0, 50, 4), (66, 112, 16), (128, 170, 24), (186, 232, 14), (244, 288, 6)]
    for i, (x0, x1, top) in enumerate(units):
        posts = rect(x0, top, x0 + 2, FLOOR) | rect(x1 - 2, top, x1, FLOOR)
        c.shade(posts & ((yy % 2) == 0), "eg", 1)
        for y in range(top + 10, FLOOR, 13):
            c.shade(rect(x0, y, x1, y + 1), "eg", 1)
            x = x0 + 3
            k = 0
            while x < x1 - 6:
                kind = hsh(i, y, k) % 5
                if kind < 2:
                    r = 3 + (hsh(i, y, k, 1) % 3)
                    m = disc(x + r, y - r, r) & ~disc(x + r, y - r, 1)
                    c.haze(m, 0.8 + 0.2 * kind, "eg", alpha=90)
                    c.shade(disc(x + r, y - r, r) & ~disc(x + r, y - r, r - 0.7) & ((xx + yy) % 2 == 0), "eg", 1)
                    x += 2 * r + 1
                elif kind < 4:
                    h = 5 + hsh(i, y, k, 2) % 5
                    c.haze(rect(x, y - h, x + 4, y), 0.7 + 0.2 * (kind - 2), "eg", alpha=90)
                    lab = ["cyan", "mag", "rn", "lime", "eg", "si"][hsh(i, y, k, 3) % 6]
                    c.shade(rect(x + 1, y - h + 1, x + 3, y - h + 2), lab, 2)
                    x += 5
                else:
                    x += 3
                k += 1
            rn = ["cyan", "mag", "rn", "lime", "eg"][(i + y) % 5]
            on = (f + i + y // 13) % 3 != 0
            c.shade(rect(x1 - 5, y + 1, x1 - 4, y + 2), rn, 3 if on else 1)
    # ceiling lamps casting thin cyan cones
    for lx in (58, 178, 238):
        cone = poly([(lx - 2, 0), (lx + 2, 0), (lx + 18, FLOOR), (lx - 18, FLOOR)])
        c.haze(cone, 0.3 + 0.6 * (1 - lin(0, 0, 0, FLOOR)), "cyan", alpha=55)
        c.shade(rect(lx - 2, 0, lx + 3, 2), "cyan", 3)
        c.shade(rect(lx - 1, 2, lx + 2, 3), "cyan", 4)
    # hanging film strips from the ceiling, swaying a little
    for i, (x, length) in enumerate([(14, 30), (40, 18), (122, 24), (150, 14), (208, 22), (270, 28)]):
        sway = math.sin(TAU * (f / F) + i) * 1.2
        film_strip(c, x, 0, x + sway, length, f, w=5, seed=i, scroll=False)
    # dust in the lamp light
    twinkle(c, f, 46, 1201, (0, 0, W, FLOOR - 4), ["eg", "cyan", "mag", "rn"])


def eg_1(c, f):
    """Fragment: a torn photo scrap on a little stand, its picture flickering."""
    x = SLOT[1]
    c.fill(rect(x - 1, FLOOR - 3, x + 1, FLOOR), 0.3, "gr")
    scrap = poly([(x - 4, FLOOR - 3), (x - 3, FLOOR - 10), (x + 3, FLOOR - 11), (x + 4, FLOOR - 4), (x + 1, FLOOR - 5)])
    c.fill(scrap, 0.6 + 0.3 * lin(x - 4, FLOOR, x + 4, FLOOR - 11), "eg", outline=True)
    img = disc(x - 0.5, FLOOR - 7.5, 1.6)
    c.shade(img & scrap, ["cyan", "mag", "cyan", "eg", "cyan", "rn"][f], 3)


def eg_2(c, f):
    """Recall: a pocket tape recorder, the tape window glowing and the REC light blinking."""
    x = SLOT[2]
    body = rect(x - 6, FLOOR - 12, x + 6, FLOOR)
    c.fill(body, 0.25 + 0.3 * lin(x - 6, FLOOR - 12, x + 6, FLOOR), "gr", outline=True)
    win = rect(x - 4, FLOOR - 10, x + 4, FLOOR - 5)
    c.fill(win, 0.75, "eg")
    for dx in (-2, 2):
        a = TAU * f / F + dx
        c.shade(disc(x + dx, FLOOR - 7.5, 1.5) & ~disc(x + dx, FLOOR - 7.5, 0.6), "eg", 1)
        c.shade(rect(x + dx + round(math.cos(a)), FLOOR - 8 + round(math.sin(a)), x + dx + round(math.cos(a)) + 1, FLOOR - 7 + round(math.sin(a))), "eg", 4)
    c.shade(rect(x - 4, FLOOR - 3, x - 2, FLOOR - 2), "red", 4 if f % 2 == 0 else 1)
    c.shade(rect(x + 1, FLOOR - 3, x + 5, FLOOR - 2), "gr", 3)


def eg_3(c, f):
    """Reel: a film reel on a stand, turning, a short strip trailing to the floor."""
    x, cy = SLOT[3], FLOOR - 11
    c.fill(poly([(x - 5, FLOOR), (x, cy + 2), (x + 5, FLOOR)]) & ~poly([(x - 2, FLOOR), (x, cy + 6), (x + 2, FLOOR)]), 0.3, "gr", outline=True)
    film_strip(c, x + 4, cy + 6, x + 13, FLOOR - 1, f, w=4, seed=3)
    reel(c, x, cy, 8.5, f, holes=4)


def eg_4(c, f):
    """Diary: an open book on a lectern, lines of writing appearing on it, letters lifting off the page."""
    x = SLOT[4]
    c.fill(poly([(x - 3, FLOOR), (x - 1, FLOOR - 12), (x + 1, FLOOR - 12), (x + 3, FLOOR)]), 0.3, "gr", outline=True)
    c.fill(rect(x - 6, FLOOR - 1, x + 6, FLOOR), 0.5, "gr")
    top = FLOOR - 25
    left = poly([(x - 12, top + 4), (x, top + 7), (x, top + 15), (x - 12, top + 12)])
    right = poly([(x, top + 7), (x + 12, top + 4), (x + 12, top + 12), (x, top + 15)])
    cover = poly([(x - 13, top + 5), (x, top + 8), (x + 13, top + 5), (x + 13, top + 13), (x, top + 16), (x - 13, top + 13)])
    c.fill(cover, 0.3, "mag", outline=True)
    c.fill(left, 0.75 + 0.2 * lin(x - 12, top, x, top + 10), "eg")
    c.fill(right, 0.85, "eg")
    lines = 1 + f % F
    for k in range(5):
        for side in (-1, 1):
            if k + (side > 0) * 5 >= lines * 2:
                continue
            y0 = top + 7 + k * 1.6
            x0 = x + side * 2 if side > 0 else x - 10
            ln = 6 + (hsh(k, side) % 3)
            c.shade(rect(x0, y0 + (2 if side < 0 else 0) - k * 0.1, x0 + ln, y0 + 1 + (2 if side < 0 else 0) - k * 0.1) & (left | right), "eg", 1)
    for k in range(3):  # letters drifting up
        p = ((f / F) + k / 3) % 1
        lx, ly = x - 4 + k * 4, top + 4 - p * 12
        c.shade(rect(lx, ly, lx + 1, ly + 2), ["cyan", "mag", "rn"][k], 4 if p < 0.6 else 2)
        c.shade(rect(lx + 1, ly, lx + 2, ly + 1), ["cyan", "mag", "rn"][k], 3)


def eg_5(c, f):
    """Archive: a filing cabinet, one drawer pulled out with glowing index cards, reels stacked on top."""
    x = SLOT[5]
    w, h = 22, 30
    x0, top = x - w // 2, FLOOR - h
    side = poly([(x0 + w, top), (x0 + w + 4, top - 3), (x0 + w + 4, FLOOR - 3), (x0 + w, FLOOR)])
    lid = poly([(x0, top), (x0 + 4, top - 3), (x0 + w + 4, top - 3), (x0 + w, top)])
    c.fill(side, 0.1, "gr")
    c.fill(rect(x0, top, x0 + w, FLOOR), 0.28 + 0.2 * lin(x0, top, x0 + w, FLOOR), "gr", outline=True)
    c.fill(lid, 0.6, "gr")
    for k in range(4):
        y = top + 2 + k * 7
        c.shade(rect(x0 + 2, y, x0 + w - 2, y + 6) & ~rect(x0 + 3, y + 1, x0 + w - 3, y + 5), "gr", 1)
        c.shade(rect(x0 + w // 2 - 3, y + 2, x0 + w // 2 + 3, y + 3), "gr", 3)
        c.shade(rect(x0 + 4, y + 1, x0 + 7, y + 3), "eg", 4 if k != 1 else 3)
    # open drawer (row 2), sticking out to the left, cards glowing
    y = top + 9
    c.fill(rect(x0 - 7, y, x0 + 2, y + 6), 0.4, "gr", outline=True)
    for k in range(4):
        cx = x0 - 6 + k * 2
        lift = 1 if (f + k) % 3 == 0 else 0
        c.shade(rect(cx, y - 3 - lift, cx + 1, y + 1), ["eg", "cyan", "eg", "mag"][k], 4 if lift else 3)
    # reels on top
    reel(c, x0 + 6, top - 7, 4.5, f, holes=3, spin=-1)
    reel(c, x0 + 15, top - 6, 3.5, f, holes=3)
    twinkle(c, f, 6, 1505, (x0 - 8, top - 16, x0 + w + 6, top - 2), ["eg", "cyan"])


def eg_6(c, f):
    """Chorus: a tower of old speakers playing back every voice the node kept; rings of sound, four small operator lights."""
    x = SLOT[6]
    w = 22
    x0 = x - w // 2
    heights = [12, 11, 10, 9]
    y = FLOOR
    for k, h in enumerate(heights):
        ww = w - k * 3
        bx = x - ww // 2
        box = rect(bx, y - h, bx + ww, y)
        c.fill(box, 0.2 + 0.2 * lin(bx, y - h, bx + ww, y), "eg", outline=True)
        cone_r = min(h, ww) * 0.36
        pulse = 0.4 * wave(f, k * 0.25)
        c.fill(disc(x, y - h / 2, cone_r + pulse * 0.5), 0.15, "gr")
        c.shade(disc(x, y - h / 2, cone_r + pulse * 0.5) & ~disc(x, y - h / 2, cone_r - 0.8 + pulse * 0.5), "eg", 3)
        c.shade(disc(x, y - h / 2, 1.2), "eg", 4)
        c.shade(rect(bx + 1, y - h + 1, bx + 2, y - h + 2), OP_COLS[k], 4 if (f + k) % 4 else 2)
        y -= h
    top = y
    # antenna and sound rings to both sides
    c.shade(rect(x, top - 6, x + 1, top), "gr", 3)
    c.shade(rect(x - 1, top - 7, x + 2, top - 6), "mag", 4 if f % 2 else 3)
    for k in range(3):
        r = 6 + ((f / F) * 8 + k * 8) % 24
        ring = disc(x, (top + FLOOR) / 2, r + w / 2, r * 0.9 + 14) & ~disc(x, (top + FLOOR) / 2, r + w / 2 - 1, r * 0.9 + 13)
        ring &= (np.abs(xx - x) > w / 2 + 2) & (yy < FLOOR)
        c.shade(ring & (c.img[..., 3] == 0) & ((xx + yy) % 2 == 0), ["cyan", "eg", "mag"][k], 3 if r < 16 else 2)


def eg_7(c, f):
    """Engram archive: a big projector on a tripod, two reels turning on top, throwing an old memory into the air: a figure at
    a desk with a small box and its single wire."""
    x, base = SLOT[7], FLOOR
    # beam up and to the left into the headroom, and the projected picture
    lens = (x - 20, base - 34)
    sx, sy, sw, sh = 154, 6, 54, 34  # screen of light in the air
    beam = poly([lens, (sx + sw, sy + 2), (sx + sw - 4, sy + sh), (lens[0] + 1, lens[1] + 4)])
    c.haze(beam, 0.55 + 0.35 * lin(lens[0], lens[1], sx, sy), "cyan", alpha=80)
    motes = beam & (((xx * 3 + yy * 5 + f * 2) % 11) == 0) & (((xx + yy) % 2) == 0)
    c.shade(motes, "cyan", 2)
    c.shade(beam & (((xx * 7 + yy * 3 + f * 5) % 37) == 0), "cyan", 4)
    flick = [0, 1, 0, 0, 1, 0][f]
    frame = rect(sx, sy, sx + sw, sy + sh)
    c.haze(frame, 0.9, "eg", alpha=90)
    c.shade(frame & ~rect(sx + 1, sy + 1, sx + sw - 1, sy + sh - 1) & ((xx + yy) % 2 == 0), "eg", 3)
    # the memory: a desk, an operator seen from behind, the node box with its wire
    m = rect(sx + 6, sy + 24, sx + sw - 6, sy + 26)  # desk
    m |= rect(sx + 9, sy + 26, sx + 11, sy + sh - 2) | rect(sx + sw - 11, sy + 26, sx + sw - 9, sy + sh - 2)
    person = disc(sx + 18, sy + 11, 3.5) | poly([(sx + 12, sy + 24), (sx + 14, sy + 15), (sx + 22, sy + 15), (sx + 24, sy + 24)])
    box = rect(sx + 32, sy + 17, sx + 41, sy + 24)
    wire = line(sx + 41, sy + 18, sx + 47, sy + 8, 1)
    c.shade(m | person, "eg", 3 if not flick else 2)
    c.shade(box, "eg", 4)
    c.shade(disc(sx + 36.5, sy + 20.5, 1.4), "lime", 4 if f % 3 else 2)
    c.shade(wire, "eg", 4)
    for k in range(4):  # scan lines rolling down the picture
        y = sy + 2 + ((f * 6 + k * 9) % (sh - 3))
        c.shade(rect(sx + 1, y, sx + sw - 1, y + 1) & ((xx % 3) != 0), "cyan", 2)
    # tripod
    for dx in (-12, 0, 12):
        c.shade(line(x, base - 22, x + dx, base, 2), "gr", 2)
    c.shade(rect(x - 3, base - 26, x + 3, base - 21), "gr", 3)
    # projector body
    bx0, by0, bx1, by1 = x - 18, base - 42, x + 18, base - 26
    side = poly([(bx1, by0), (bx1 + 5, by0 - 4), (bx1 + 5, by1 - 4), (bx1, by1)])
    topf = poly([(bx0, by0), (bx0 + 5, by0 - 4), (bx1 + 5, by0 - 4), (bx1, by0)])
    c.fill(side, 0.12, "eg")
    c.fill(rect(bx0, by0, bx1, by1), 0.22 + 0.3 * lin(bx0, by0, bx1, by1), "eg", outline=True)
    c.fill(topf, 0.65, "eg")
    for k in range(5):  # vents
        c.shade(rect(bx0 + 16 + k * 3, by0 + 4, bx0 + 17 + k * 3, by1 - 4), "eg", 0)
    c.shade(rect(bx0 + 3, by1 - 5, bx0 + 7, by1 - 3), "mag", 4 if f % 2 else 3)
    c.shade(rect(bx0 + 9, by1 - 5, bx0 + 11, by1 - 3), "lime", 3)
    # lens barrel pointing up-left
    barrel = poly([(bx0 + 2, by0 + 2), (lens[0] - 3, lens[1] - 5), (lens[0] + 3, lens[1] + 3), (bx0 + 4, by0 + 9)])
    c.fill(barrel, 0.35, "gr", outline=True)
    c.shade(disc(lens[0], lens[1], 3.2), "cyan", 3)
    c.shade(disc(lens[0] - 0.5, lens[1] - 0.5, 1.6), "cyan", 4)
    # two reels on arms
    for (rx, ry, R, sp) in ((x - 9, by0 - 15, 11, 1), (x + 13, by0 - 12, 8.5, 1)):
        c.shade(line(rx, ry, rx + (2 if sp else -2), by0 - 3, 2), "gr", 2)
        reel(c, rx, ry, R, f, holes=5 if R > 10 else 4, spin=sp)
    # film path between the reels and the gate
    c.shade(line(x - 9, by0 - 4, x + 13, by0 - 3.5, 1), "eg", 1)
    c.shade(line(x - 19, by0 - 15, bx0 + 1, by0 + 6, 1), "eg", 1)
    twinkle(c, f, 10, 1707, (x - 30, base - 70, x + 30, base - 40), ["eg", "cyan", "mag"])


def engrams(stage, f):
    c = K.Cell()
    fns = [eg_1, eg_2, eg_3, eg_4, eg_5, eg_6, eg_7]
    # draw sprites back to front: the hero first so the smaller ones stand in front of its beam
    order = [6, 5, 4, 3, 2, 1, 0]
    fg = K.Cell()
    for i in order:
        if i < stage:
            fns[i](fg, f)
    ground(fg, "eg", f, "cyan")
    bg = K.Cell()
    stacks_bg(bg, f)
    fg.under(bg)
    return fg


# =====================================================================================================================
# zone 13 MIRROR STAIR  /  Paradox.  Ramps: px (silver), accents cyan + mag (a chromatic split, things in two places at once)
# =====================================================================================================================
def ghost(c, mask, f, amp=1):
    """Chromatic split: a cyan copy to the left and a magenta copy to the right of a shape, where nothing is drawn yet."""
    d = amp + (1 if f % 3 == 0 else 0)
    c.shade(np.roll(mask, -d, axis=1) & ~mask & (c.img[..., 3] == 0), "cyan", 3)
    c.shade(np.roll(mask, d, axis=1) & ~mask & (c.img[..., 3] == 0), "mag", 3)


def plinth(c, cx, w, h, rn="px"):
    top = FLOOR - h
    c.fill(rect(cx - w / 2, top, cx + w / 2, FLOOR), 0.25 + 0.3 * lin(cx - w / 2, top, cx + w / 2, FLOOR), rn, outline=True)
    c.shade(rect(cx - w / 2, top, cx + w / 2, top + 1), rn, 4)
    return top


def stairs_bg(c, f):
    """Impossible architecture in the dark: flights of stairs that climb into each other, a checker floor, the whole room
    mirrored faintly in the headroom, and shards of mirror drifting with cyan and magenta edges."""
    c.haze(rect(0, 0, W, FLOOR), 0.2 + 0.4 * lin(0, FLOOR, 0, 0), "px", alpha=40)
    # checker floor band in perspective
    for row in range(4):
        y0 = FLOOR - 2 - row * 3
        sz = 12 - row * 2
        off = (row % 2) * sz / 2
        for k in range(int(W / sz) + 2):
            x0 = k * sz - off
            if (k + row) % 2 == 0:
                c.haze(rect(x0, y0 - 3, x0 + sz, y0), 0.95, "px", alpha=70)
    # flights of stairs: each a run of steps, outlined in silver, some upside down in the headroom
    def flight(x0, y0, n, step_w, step_h, dirn=1, flip=False, rn="px", sh=1):
        for k in range(n):
            x = x0 + k * step_w * dirn
            y = y0 - k * step_h if not flip else y0 + k * step_h
            tread = rect(min(x, x + step_w * dirn), y - 1, max(x, x + step_w * dirn), y)
            riser = rect(x, y - step_h, x + 1, y) if not flip else rect(x, y, x + 1, y + step_h)
            c.shade(tread, rn, sh)
            c.shade(riser & ((yy % 2) == 0), rn, sh)
    flight(4, 90, 9, 6, 5, 1, sh=2)
    flight(40, 22, 5, 5, 4, 1, flip=True, rn="si")
    flight(96, 92, 6, 5, 4, 1, rn="si", sh=2)
    flight(200, 40, 5, 5, 4, -1, rn="mag", sh=1)
    flight(26, 50, 5, 5, 4, -1, rn="cyan", sh=1)
    flight(70, 46, 6, 6, 5, -1)
    flight(118, 30, 7, 5, 4, 1, flip=True, rn="si", sh=1)
    flight(170, 88, 8, 5, 5, 1, rn="si")
    flight(282, 60, 7, 6, 4, -1)
    flight(232, 2, 6, 6, 4, -1, flip=True)
    # big faint arches, one the right way up and its mirror hanging from the ceiling
    for ax, ay, r, up in ((100, FLOOR, 30, True), (100, 0, 30, False), (250, FLOOR, 36, True)):
        ring = disc(ax, ay, r, r * 1.1) & ~disc(ax, ay, r - 3, r * 1.1 - 3)
        ring &= (yy <= ay) if up else (yy >= ay)
        c.haze(ring, 0.9, "si", alpha=80)
        c.shade(ring & ((xx * 7 + yy) % 9 == 0), "si", 2)
    # landing lamps in cyan and magenta
    for i, (lx, ly) in enumerate(((52, 60), (112, 14), (176, 66), (228, 22), (270, 52), (20, 30))):
        c.shade(rect(lx, ly, lx + 2, ly + 2), ["cyan", "mag"][i % 2], 4 if (f + i) % 3 else 2)
        c.haze(disc(lx + 1, ly + 1, 6), 0.9, ["cyan", "mag"][i % 2], alpha=60)
    # pillars that do not quite meet
    for x, y0, y1 in ((60, 4, 70), (150, 0, 50), (214, 30, 92)):
        c.haze(rect(x, y0, x + 5, y1), 0.9, "px", alpha=80)
        c.shade(rect(x, y0, x + 1, y1) & ((yy % 3) != 0), "px", 1)
    # drifting mirror shards
    for i in range(9):
        cx = 10 + rnd(1301, i, 1) * 268
        cy = 4 + rnd(1301, i, 2) * 64 + math.sin(TAU * f / F + i) * 1.5
        r = 2 + rnd(1301, i, 3) * 3
        sh = poly([(cx, cy - r), (cx + r * 0.7, cy), (cx, cy + r * 0.8), (cx - r * 0.6, cy + 0.2)])
        c.fill(sh, 0.4 + 0.4 * ((f + i) % 3 == 0), "px", dither=0.5)
        ghost(c, sh, f + i)
    twinkle(c, f, 34, 1302, (0, 0, W, FLOOR - 6), ["px", "cyan", "mag", "si"])


def px_1(c, f):
    """Flicker: a small cube that cannot decide where it is: it jumps between two spots and leaves a ghost."""
    x = SLOT[1]
    for k, dx in enumerate((-3, 3)):
        here = (f % 2) == k
        cube = rect(x + dx - 3, FLOOR - 7, x + dx + 3, FLOOR - 1)
        if here:
            c.fill(cube, 0.5 + 0.4 * lin(x + dx - 3, FLOOR - 7, x + dx + 3, FLOOR), "px", outline=True)
        else:
            c.shade(cube & ((xx + yy) % 2 == 0), "cyan" if k == 0 else "mag", 2)


def px_2(c, f):
    """Mirror: a standing mirror; its glass shows a reflection that is a beat behind."""
    x = SLOT[2]
    c.shade(line(x - 4, FLOOR, x - 1, FLOOR - 6, 1) | line(x + 4, FLOOR, x + 1, FLOOR - 6, 1), "gr", 3)
    frame = disc(x, FLOOR - 10, 5, 7)
    glass = disc(x, FLOOR - 10, 3.8, 5.8)
    c.fill(frame, 0.7, "rn")
    c.fill(glass, 0.35 + 0.5 * lin(x - 4, FLOOR - 16, x + 4, FLOOR - 4), "px")
    g = (f + 3) % F
    c.shade(line(x - 3 + g, FLOOR - 15, x - 5 + g, FLOOR - 6, 1) & glass, "wh", 4)
    ghost(c, frame, f)


def px_3(c, f):
    """Fork: one conduit that splits in two, a packet climbing both branches at once."""
    x = SLOT[3]
    top = FLOOR - 20
    stem = rect(x - 1.5, FLOOR - 8, x + 1.5, FLOOR)
    left = line(x, FLOOR - 7, x - 7, top + 2, 3)
    right = line(x, FLOOR - 7, x + 7, top + 2, 3)
    c.fill(stem | left | right, 0.4, "px", outline=True)
    c.shade(disc(x - 7, top + 2, 2.4), "cyan", 3)
    c.shade(disc(x + 7, top + 2, 2.4), "mag", 3)
    p = (f / F)
    for side, rn in ((-1, "cyan"), (1, "mag")):
        if p < 0.4:
            px(c, x, FLOOR - 1 - p / 0.4 * 6, "wh", 4)
        else:
            q = (p - 0.4) / 0.6
            px(c, x + side * 7 * q, FLOOR - 7 - q * (FLOOR - 9 - top), rn, 4)
    c.fill(rect(x - 5, FLOOR - 2, x + 5, FLOOR), 0.6, "gr")


def px_4(c, f):
    """Knot: a trefoil knot cast in silver on a plinth, a highlight running round it."""
    x = SLOT[4]
    top = plinth(c, x, 16, 4)
    cy, R = top - 12, 8.5
    pts = []
    for i in range(300):
        u = i / 300 * TAU
        pts.append((x + R * (math.sin(u) + 2 * math.sin(2 * u)) / 3, cy + R * (math.cos(u) - 2 * math.cos(2 * u)) / 3, math.sin(3 * u), u))
    hl = (f / F) * TAU
    for layer in (0, 1):
        for X, Y, z, u in pts:
            if (z >= 0) != bool(layer):
                continue
            m = disc(X, Y, 1.8)
            near = abs((u - hl + math.pi) % TAU - math.pi) < 0.35
            c.fill(m, (0.25 + 0.15 * z) if not layer else (0.65 + 0.25 * z), "px", dither=0.4)
            if near:
                c.shade(disc(X, Y, 0.9), "wh", 4)
    ghost(c, (c.img[..., 3] > 0) & rect(x - 10, cy - 10, x + 10, cy + 10), f)


def px_5(c, f):
    """Recursion: a frame that holds a smaller copy of itself, and that one a smaller one, down to a blinking point."""
    x = SLOT[5]
    w, h = 26, 30
    x0, y0 = x - w / 2, FLOOR - h
    c.shade(line(x0 + 4, FLOOR, x0 + 8, FLOOR - 6, 2) | line(x0 + w - 4, FLOOR, x0 + w - 8, FLOOR - 6, 2), "gr", 2)
    for k in range(5):
        s = 0.72 ** k
        ww, hh = w * s, (h - 6) * s
        fx, fy = x - ww / 2, FLOOR - 6 - hh - (h - 6) * (1 - s) * 0.5
        outer = rect(fx, fy, fx + ww, fy + hh)
        inner = rect(fx + max(1, 2 * s), fy + max(1, 2 * s), fx + ww - max(1, 2 * s), fy + hh - max(1, 2 * s))
        rn = ["px", "si", "px", "cyan", "mag"][k]
        c.fill(outer & ~inner, 0.55 + 0.35 * (k == (f % 5)), rn)
        if k == 0:
            c.fill(inner, 0.08, "px", dither=0.3)
    cx, cy = x, FLOOR - 6 - (h - 6) / 2
    c.shade(rect(cx, cy, cx + 1, cy + 1), "wh", 4 if f % 2 == 0 else 2)


def px_6(c, f):
    """Mobius: a big one-sided ribbon on a plinth; a stripe runs along it and comes back on the other face."""
    x = SLOT[6]
    top = plinth(c, x, 24, 5)
    cy, a = top - 17, 15
    pts = []
    for i in range(420):
        u = i / 420 * TAU
        d = 1 + math.sin(u) ** 2
        pts.append((x + a * math.cos(u) / d * 1.3, cy + a * math.sin(u) * math.cos(u) / d * 2.2, math.cos(u + 0.6), u))
    stripe = (f / F) * TAU
    for layer in (0, 1):
        for X, Y, z, u in pts:
            if (z >= 0) != bool(layer):
                continue
            w = 2.6 + 0.8 * abs(math.sin(u))
            c.fill(disc(X, Y, w), (0.15 + 0.15 * z) if not layer else (0.55 + 0.35 * z), "px", dither=0.5)
    for X, Y, z, u in pts:
        if abs((u - stripe + math.pi) % TAU - math.pi) < 0.25 or abs((u - stripe) % TAU - math.pi) < 0.25:
            c.shade(disc(X, Y, 1.0), "cyan" if z < 0 else "mag", 4)
    ghost(c, (c.img[..., 3] > 0) & rect(x - 22, cy - 18, x + 22, cy + 18), f)


def px_7(c, f):
    """Mirror stair: an isometric ring of steps that climbs all the way round a courtyard and arrives back at its own bottom
    step. A small figure keeps walking up it and never gets higher."""
    x, base = SLOT[7], FLOOR
    hw, hh, D, rise = 7.5, 3.75, 9, 3.4
    by = base - 6 * hh - hh - D
    ring = [(0, 0), (1, 0), (2, 0), (3, 0), (3, 1), (3, 2), (3, 3), (2, 3), (1, 3), (0, 3), (0, 2), (0, 1)]
    zs = {cell: k * rise for k, cell in enumerate(ring)}

    def ctr(i, j, z):
        return x + (i - j) * hw, by + (i + j) * hh - z

    # courtyard floor (the hole in the middle), dark
    cx0, cy0 = ctr(1.5, 1.5, 0)
    c.fill(poly([(cx0, cy0 - hh * 1.2), (cx0 + hw * 1.2, cy0), (cx0, cy0 + hh * 1.2), (cx0 - hw * 1.2, cy0)]), 0.02, "px", dither=0.2)
    walker = ring[(f * 2 + 1) % len(ring)]
    for (i, j) in sorted(ring, key=lambda t: (t[0] + t[1], t[0])):
        z = zs[(i, j)]
        tx, ty = ctr(i, j, z)
        bot = by + (i + j) * hh + D
        top = poly([(tx, ty - hh), (tx + hw, ty), (tx, ty + hh), (tx - hw, ty)])
        left = poly([(tx - hw, ty), (tx, ty + hh), (tx, bot + hh), (tx - hw, bot)])
        right = poly([(tx, ty + hh), (tx + hw, ty), (tx + hw, bot), (tx, bot + hh)])
        c.fill(left, 0.32 + 0.1 * lin(0, ty, 0, bot), "px")
        c.fill(right, 0.12 + 0.08 * lin(0, ty, 0, bot), "px")
        c.fill(top, 0.7 + 0.04 * (i + j), "px")
        c.shade(line(tx - hw, ty, tx, ty - hh, 1) | line(tx, ty - hh, tx + hw, ty, 1), "px", 4)
        c.shade(line(tx, ty + hh, tx, bot + hh, 1) & ((yy % 2) == 0), "px", 0)
        # arch window in the left face of the outer cells
        if i == 3 or j == 3:
            c.fill(disc(tx - hw / 2, (ty + bot) / 2 + 3, 1.8, 3) & left, 0.05, "px", dither=0.2)
            c.shade(disc(tx - hw / 2, (ty + bot) / 2 + 4, 0.8, 1.2) & left, "cyan" if (i + j + f) % 2 else "mag", 3)
        if (i, j) == walker:
            fig = rect(tx - 1, ty - 7, tx + 1, ty - 1) | disc(tx, ty - 8.3, 1.4)
            c.shade(fig, "wh", 4)
            c.shade(rect(tx - 1 + (f % 2), ty - 1, tx + (f % 2), ty), "wh", 3)
    hero = (c.img[..., 3] > 0) & rect(x - 40, by - 40, x + 40, base)
    ghost(c, hero & (yy < by + 10), f)
    # a lantern on the highest step and drifting motes
    lx, ly = ctr(0, 1, zs[(0, 1)])
    c.shade(rect(lx - 1, ly - 9, lx + 1, ly - 5), "rn", 4 if f % 2 else 3)
    c.shade(rect(lx, ly - 5, lx + 1, ly - 1), "gr", 3)
    twinkle(c, f, 12, 1707, (x - 40, base - 74, x + 40, base - 40), ["px", "cyan", "mag"])


def paradox(stage, f):
    fns = [px_1, px_2, px_3, px_4, px_5, px_6, px_7]
    fg = K.Cell()
    for i in [6, 5, 4, 3, 2, 1, 0]:
        if i < stage:
            fns[i](fg, f)
    ground(fg, "px", f, "mag")
    bg = K.Cell()
    stairs_bg(bg, f)
    fg.under(bg)
    return fg


# =====================================================================================================================
# zone 14 ROOT CHAMBER  /  Origin.  Ramps: or (phosphor green), accents gr (metal), cyan + rn (old status lights)
# =====================================================================================================================
def root_line(c, pts, w, rn="or", sh=1, glow=None, f=0):
    """A root or cable along a list of points, w px thick; `glow` sends a bright pulse along it."""
    m = np.zeros((H, W), bool)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        m |= line(x0, y0, x1, y1, w)
    c.fill(m, 0.1 + 0.25 * (sh - 1) + 0.15 * lin(0, 0, 0, H), rn, dither=0.6)
    if glow is not None:
        n = len(pts) - 1
        q = ((f / F) + glow) % 1 * n
        k = min(n - 1, int(q))
        (x0, y0), (x1, y1) = pts[k], pts[k + 1]
        t = q - k
        c.shade(disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, max(1.0, w * 0.6)) & m, rn, 4)
    return m


def wiggle(x0, y0, x1, y1, n, amp, seed):
    pts = []
    for k in range(n + 1):
        t = k / n
        pts.append((x0 + (x1 - x0) * t + math.sin(t * 5 + seed) * amp * (1 - abs(2 * t - 1)), y0 + (y1 - y0) * t))
    return pts


def crt(c, x0, y0, w, h, f, seed=0, text=True):
    """A small old monitor with green text scrolling on it."""
    c.fill(rect(x0, y0, x0 + w, y0 + h), 0.3 + 0.2 * lin(x0, y0, x0 + w, y0 + h), "gr", outline=True)
    sc = rect(x0 + 2, y0 + 2, x0 + w - 2, y0 + h - 3)
    c.fill(sc, 0.05, "or", dither=0.3)
    if text:
        for k in range(max(1, (h - 5) // 2)):
            ln = 2 + hsh(seed, k + f) % max(2, w - 6)
            y = y0 + 3 + k * 2
            if y < y0 + h - 4:
                c.shade(rect(x0 + 3, y, x0 + 3 + ln, y + 1) & sc, "or", 3 if k == (f % max(1, (h - 5) // 2)) else 2)
    c.shade(rect(x0 + w - 4, y0 + h - 2, x0 + w - 3, y0 + h - 1), "or", 4 if f % 2 else 2)


def roots_bg(c, f):
    """A cavern under everything: roots and cables coming down from the dark and spreading over the floor, old monitors
    caught in them, green binary drifting down like dust."""
    c.haze(rect(0, 0, W, FLOOR), 0.25 + 0.4 * lin(0, 0, 0, FLOOR), "or", alpha=40)
    # falling binary columns (very faint)
    for i in range(18):
        x = 6 + i * 16 + (i % 3) * 3
        off = (f * 2 + hsh(1401, i) % 30)
        for k in range(6):
            y = (off + k * 14) % (FLOOR - 4)
            bit = hsh(i, k, f // 3) % 2
            m = rect(x, y, x + 1, y + 3) if bit else (rect(x - 1, y, x + 2, y + 1) | rect(x - 1, y + 2, x + 2, y + 3) | rect(x - 1, y, x, y + 3) | rect(x + 1, y, x + 2, y + 3))
            c.shade(m, "or", 1)
    # roots from the ceiling
    for i, (x, length, w) in enumerate([(8, 70, 3), (30, 40, 2), (58, 86, 4), (96, 30, 2), (124, 52, 3), (166, 24, 2), (196, 60, 3), (232, 36, 2), (266, 80, 4), (282, 46, 2)]):
        pts = wiggle(x, -2, x + (hsh(i) % 9) - 4, length, 8, 3 + w, i)
        root_line(c, pts, w, "or", 1, glow=rnd(1402, i), f=f)
        for b in range(2):  # side shoots
            k = 2 + b * 3
            if k < len(pts):
                bx, by = pts[k]
                d = -1 if (i + b) % 2 else 1
                root_line(c, wiggle(bx, by, bx + d * (6 + w * 2), by + 8 + w * 2, 3, 1.5, i + b), max(1, w - 1), "or", 1)
    # floor roots spreading sideways
    for i, (x0, x1) in enumerate([(0, 70), (40, 150), (120, 230), (200, 288)]):
        pts = [(x0 + (x1 - x0) * t / 6, FLOOR - 1 - abs(math.sin(t + i)) * 3) for t in range(7)]
        root_line(c, pts, 2, "or", 1, glow=rnd(1403, i), f=f)
    # monitors caught in the roots
    for i, (x, y, w, h) in enumerate([(14, 40, 14, 11), (100, 18, 12, 10), (176, 32, 13, 11), (246, 12, 12, 9)]):
        crt(c, x, y, w, h, f, seed=i)
    # status lights in the dark
    for i, (lx, ly) in enumerate([(44, 64), (82, 12), (140, 70), (214, 8), (256, 66), (24, 8)]):
        rn = ["cyan", "rn", "or"][i % 3]
        c.shade(rect(lx, ly, lx + 2, ly + 1), rn, 4 if (f + i) % 3 else 1)
    twinkle(c, f, 40, 1404, (0, 0, W, FLOOR - 4), ["or", "or", "cyan", "rn"])


def or_1(c, f):
    """Bit: one bright cube of light on the floor, blinking 1, 0, 1."""
    x = SLOT[1]
    on = f % 3 != 1
    cube = rect(x - 3, FLOOR - 6, x + 3, FLOOR)
    c.fill(cube, 0.75 if on else 0.3, "or", outline=True)
    c.shade(rect(x - 2, FLOOR - 5, x, FLOOR - 4), "or", 4 if on else 2)
    if on:
        c.haze(disc(x, FLOOR - 3, 8), 0.95, "or", alpha=90)


def or_2(c, f):
    """Seed: a seed pod split open, a green wire sprouting from it and swaying."""
    x = SLOT[2]
    pod = disc(x, FLOOR - 4, 5, 4)
    c.fill(pod & (yy < FLOOR), 0.35 + 0.3 * lin(x - 5, FLOOR, x + 5, FLOOR - 8), "rn", outline=True)
    c.fill(disc(x, FLOOR - 6, 2.4, 1.6), 0.1, "rn")
    sway = math.sin(TAU * f / F) * 1.2
    root_line(c, [(x, FLOOR - 6), (x + sway * 0.5, FLOOR - 11), (x + sway, FLOOR - 15)], 1, "or", 2)
    c.shade(disc(x + sway, FLOOR - 16, 1.4), "or", 4)
    c.shade(rect(x + sway + 1, FLOOR - 13, x + sway + 3, FLOOR - 12), "or", 3)


def or_3(c, f):
    """Root: a knot of roots gripping a glowing node, light running down into the floor."""
    x = SLOT[3]
    for k, (dx, dy) in enumerate([(-9, 0), (-5, 1), (0, 1), (5, 1), (9, 0)]):
        root_line(c, wiggle(x, FLOOR - 12, x + dx, FLOOR + dy - 1, 4, 1.2, k), 2, "or", 2, glow=k * 0.2, f=f)
    c.fill(disc(x, FLOOR - 14, 5), 0.25, "gr", outline=True)
    c.shade(disc(x, FLOOR - 14, 2.4), "or", 3)
    c.shade(disc(x - 0.5, FLOOR - 14.5, 1.0), "or", 4)
    c.shade(disc(x, FLOOR - 14, 3.6) & ~disc(x, FLOOR - 14, 2.8), "or", 2 if f % 2 else 1)


def or_4(c, f):
    """Bootstrap: an old terminal on the floor running its boot sequence, cable roots trailing behind."""
    x = SLOT[4]
    root_line(c, wiggle(x + 8, FLOOR - 8, x + 18, FLOOR - 1, 3, 2, 4), 2, "or", 1, glow=0.3, f=f)
    w, h = 22, 18
    x0, y0 = x - w // 2, FLOOR - h - 4
    c.fill(rect(x0 + 3, FLOOR - 4, x0 + w - 3, FLOOR), 0.3, "gr", outline=True)  # keyboard
    for k in range(5):
        c.shade(rect(x0 + 5 + k * 3, FLOOR - 3, x0 + 6 + k * 3, FLOOR - 2), "gr", 4)
    c.fill(poly([(x0 + w, y0), (x0 + w + 3, y0 + 2), (x0 + w + 3, y0 + h - 2), (x0 + w, y0 + h)]), 0.12, "gr")
    crt(c, x0, y0, w, h, f, seed=7, text=False)
    lines = ["BOOT", "NODE", "OK"]
    for k in range(min(3, f // 2 + 1)):
        y = y0 + 3 + k * 4
        ln = len(lines[k]) * 3
        c.shade(rect(x0 + 4, y, x0 + 4 + ln, y + 2) & ((xx % 3) != 2), "or", 3)
    c.shade(rect(x0 + 4 + (f % 4) * 3, y0 + 15, x0 + 6 + (f % 4) * 3, y0 + 16), "or", 4)


def or_5(c, f):
    """Kernel: a server column with a green core in a glass window, rings of light pulsing up it."""
    x = SLOT[5]
    w, h = 18, 36
    x0, top = x - w // 2, FLOOR - h
    c.fill(poly([(x0 + w, top), (x0 + w + 4, top - 3), (x0 + w + 4, FLOOR - 3), (x0 + w, FLOOR)]), 0.1, "gr")
    c.fill(rect(x0, top, x0 + w, FLOOR), 0.25 + 0.25 * lin(x0, top, x0 + w, FLOOR), "gr", outline=True)
    c.fill(poly([(x0, top), (x0 + 4, top - 3), (x0 + w + 4, top - 3), (x0 + w, top)]), 0.6, "gr")
    win = rect(x0 + 4, top + 5, x0 + w - 4, FLOOR - 6)
    c.fill(win, 0.08, "or", dither=0.3)
    core = rect(x - 2, top + 7, x + 2, FLOOR - 8)
    c.fill(core, 0.6 + 0.3 * wave(f), "or")
    for k in range(3):
        y = FLOOR - 8 - ((f / F + k / 3) % 1) * (h - 15)
        c.shade(rect(x0 + 5, y, x0 + w - 5, y + 1) & win, "or", 4)
    for k in range(4):
        c.shade(rect(x0 + 2, top + 4 + k * 7, x0 + 3, top + 5 + k * 7), ["or", "cyan", "or", "rn"][k], 4 if (f + k) % 3 else 2)
    root_line(c, wiggle(x0 - 1, FLOOR - 10, x0 - 9, FLOOR - 1, 3, 1.5, 5), 2, "or", 1, glow=0.6, f=f)
    root_line(c, wiggle(x0 + w + 1, FLOOR - 6, x0 + w + 8, FLOOR - 1, 3, 1, 6), 2, "or", 1)


def or_6(c, f):
    """Node zero: a tall rack terminal reading NODE 00, one thick cable climbing out of its top into the roots above."""
    x = SLOT[6]
    w, h = 26, 46
    x0, top = x - w // 2, FLOOR - h
    root_line(c, wiggle(x + 6, top, x + 14, -2, 8, 3, 9), 3, "or", 2, glow=0.0, f=f)
    c.fill(poly([(x0 + w, top), (x0 + w + 5, top - 4), (x0 + w + 5, FLOOR - 4), (x0 + w, FLOOR)]), 0.1, "gr")
    c.fill(rect(x0, top, x0 + w, FLOOR), 0.22 + 0.25 * lin(x0, top, x0 + w, FLOOR), "gr", outline=True)
    c.fill(poly([(x0, top), (x0 + 5, top - 4), (x0 + w + 5, top - 4), (x0 + w, top)]), 0.6, "gr")
    # display reading 00
    disp = rect(x0 + 4, top + 5, x0 + w - 4, top + 16)
    c.fill(disp, 0.05, "or", dither=0.3)
    for d in (0, 1):
        dx = x0 + 7 + d * 8
        o = rect(dx, top + 7, dx + 5, top + 14) & ~rect(dx + 1, top + 8, dx + 4, top + 13)
        c.shade(o, "or", 4 if (f + d) % 4 else 3)
    # drive bays with lights
    for k in range(5):
        y = top + 20 + k * 5
        c.shade(rect(x0 + 3, y, x0 + w - 3, y + 4) & ~rect(x0 + 4, y + 1, x0 + w - 4, y + 3), "gr", 1)
        c.shade(rect(x0 + w - 7, y + 1, x0 + w - 5, y + 2), "or", 4 if (f + k) % 2 else 1)
        c.shade(rect(x0 + 5, y + 1, x0 + 6, y + 2), ["cyan", "rn", "or", "cyan", "rn"][k], 3)
    c.haze(disc(x, top + 10, 18, 12), 0.9, "or", alpha=70)


def or_7(c, f):
    """Root chamber: a great tree grown out of cables and roots. At its foot, held in the roots, the first node: one small
    box with one wire, glowing. Light climbs the trunk into a canopy that reaches the ceiling."""
    x, base = SLOT[7], FLOOR
    # canopy of roots up into the headroom (behind everything)
    for i in range(9):
        a = -math.pi / 2 + (i - 4) * 0.33
        ex, ey = x + math.cos(a) * 46, base - 50 + math.sin(a) * 46
        root_line(c, wiggle(x + (i - 4) * 1.5, base - 44, ex, ey, 6, 3, i), 2 + (i % 2), "or", 2, glow=rnd(1405, i), f=f)
    for i in range(14):  # leaves of light in the canopy
        lx = x - 40 + rnd(1406, i, 1) * 80
        ly = 4 + rnd(1406, i, 2) * 36
        if (f + i) % 3 != 2:
            c.shade(rect(lx, ly, lx + 2, ly + 2), "or", 4 if (f + i) % 3 == 0 else 3)
    # trunk: braided cables
    for k in range(5):
        dx = (k - 2) * 4
        pts = [(x + dx * (0.6 + (base - y) / 90) + math.sin((base - y) / 9 + k) * 2.5, y) for y in range(base - 4, base - 54, -4)]
        root_line(c, pts, 5, "or", 2 if k % 2 else 1, glow=k * 0.25, f=f)
    # spreading roots on the floor
    for k, (ex, ey) in enumerate([(x - 40, base - 1), (x - 26, base), (x + 22, base), (x + 38, base - 1), (x - 12, base), (x + 10, base)]):
        root_line(c, wiggle(x, base - 10, ex, ey, 4, 2, k), 3, "or", 2, glow=0.5 + k * 0.1, f=f)
    # the first node, held in the roots
    bx, by = x - 6, base - 17
    c.haze(disc(bx + 6, by + 4, 24, 16), 0.95, "or", alpha=90)
    side = poly([(bx + 14, by - 2), (bx + 18, by - 6), (bx + 18, by + 8), (bx + 14, by + 12)])
    lid = poly([(bx - 2, by - 2), (bx + 2, by - 6), (bx + 18, by - 6), (bx + 14, by - 2)])
    face = rect(bx - 2, by - 2, bx + 14, by + 12)
    c.fill(side, 0.15, "gr")
    c.fill(face, 0.35 + 0.3 * lin(bx, by, bx + 14, by + 12), "gr", outline=True)
    c.fill(lid, 0.75, "gr")
    c.shade(disc(bx + 6, by + 5, 4.2 + 0.5 * wave(f)) & ~disc(bx + 6, by + 5, 3.2 + 0.5 * wave(f)), "or", 2)
    c.shade(disc(bx + 6, by + 5, 2.6), "or", 3)
    c.shade(disc(bx + 5.5, by + 4.5, 1.1), "or", 4)
    c.shade(line(bx + 16, by - 6, bx + 21, by - 16, 1), "or", 3)
    c.shade(rect(bx + 20, by - 18, bx + 23, by - 16), "or", 4 if f % 2 else 3)
    for k in range(4):  # roots wrapping the box
        root_line(c, [(bx - 4 + k * 6, by + 14), (bx - 1 + k * 5, by + 9), (bx + 1 + k * 4, by + 13)], 1, "or", 2)
    twinkle(c, f, 14, 1407, (x - 44, 0, x + 44, base - 20), ["or", "or", "cyan"])


def origin(stage, f):
    fns = [or_1, or_2, or_3, or_4, or_5, or_6, or_7]
    fg = K.Cell()
    for i in [6, 5, 4, 3, 2, 1, 0]:
        if i < stage:
            fns[i](fg, f)
    ground(fg, "or", f, "or")
    bg = K.Cell()
    roots_bg(bg, f)
    fg.under(bg)
    return fg


ZONES = {"engrams": engrams, "paradox": paradox, "origin": origin}

if __name__ == "__main__":
    for z in sys.argv[1:] or list(ZONES):
        print(z)
        K.save_sheet(z, ZONES[z])
