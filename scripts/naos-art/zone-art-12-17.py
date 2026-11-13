"""Node Farm staged zone art for the six zones past Chrono: deep space (12 Cloud Deck / Nebula, 13 Beacon Spire / Pulsars,
14 Event Horizon / Singularity) and the Origin arc (15 Engram Archive / Engrams, 16 Mirror Stair / Paradox, 17 Root Chamber /
Origin).

Follows the staged zone art contract v4 (docs/node-farm.md, "Zone art"; kit in nodefarm_zone_kit.py): one sheet per zone at
public/naos/nodefarm/zone-<statId>, cells of 288 x 96 art px, 8 rows (row 0 is the bare backdrop, row n adds sprite n on top of
row n-1) by 6 frames across, a 6-frame loop at 6 fps. Rows 0-31 reach up to the panel's title bar; sprites stand on the floor at
row 94. Sprites 1-6 follow the zone's six button tiers (lib/nodefarm/lore.ts), sprite 7 is the zone's namesake.

Backdrop: the zone's own era scene (nodefarm-scenes-deep.py, eras 9 to 14, the same world the page scenery shows) drawn as a
panorama of its lower band at 0.6x, its fx layer stepped in time with the panel, so panel and page read as one place (the way
zone-art-18-25.py builds its panels). Near-black sky gets a dithered wash in the zone ramp's two darkest shades so the panel
reads lit, not empty (art audit 2026-11-13, item 3: these panels read dark next to the lab and the Overgrowth zones).

Sprites are flat shapes shaded through the 4x4 Bayer threshold into the ramps of nodefarm-icons.py, drawn on their own layer
and laid over the backdrop (glows blend). Sprites 1-6 are drawn larger than they are written (SCALE): the drawing grid is
remapped around each sprite's foot, so they come out bigger at full resolution with 1 px outlines and native dither, not
pixel-doubled. LAYOUT spreads them evenly from the description's edge to the hero.

Placement: the far left (about 60 px) sits behind the zone description, so it only gets backdrop; the top right sits under the
big number, so the hero (sprite 7) stands right of centre and low. Sprites walk up in size from left to right.

Skirt: this script also writes zone-<id>-skirt (listed in HAND in zone-art-skirt.py): the 128 px of the same world just left
of the cell, dissolved with that script's rule, so the scene really continues instead of mirroring.

Run: python3 scripts/naos-art/zone-art-12-17.py [nebula|pulsars|singularity|engrams|paradox|origin ...]
     then node scripts/nodefarm/stamp-art.mjs
"""
import importlib.util
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


def ground(c, rn, f, accent="cyan", x0=0, lights=True):
    """Floor line with a seam pattern and a slow light travelling along it. x0 shifts the seams (for the skirt strip)."""
    c.fill(rect(0, FLOOR, W, FLOOR + 2), 0.25, rn)
    c.shade(rect(0, FLOOR, W, FLOOR + 1), rn, 2)
    for x in range(-x0 % 12, W, 12):
        c.shade(rect(x, FLOOR + 1, x + 1, FLOOR + 2), rn, 0)
    if not lights:
        return
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


# =====================================================================================================================
# shared space pieces (stars and gas clouds the nebula sprites use)
# =====================================================================================================================
def starfield(c, f, seed, n=70, ramps=("wh", "pu", "nb")):
    for i in range(n):
        x = rnd(seed, i, 1) * W
        y = rnd(seed, i, 2) * (FLOOR - 4)
        b = rnd(seed, i, 3)
        rn = ramps[i % len(ramps)]
        tw_ = (f + i) % 6
        sh = 1 if b < 0.5 else 2 if b < 0.85 else 3
        if b > 0.85 and tw_ < 2:
            sh = 4
            c.shade(rect(x - 1, y, x, y + 1) | rect(x + 1, y, x + 2, y + 1), rn, 2)
        c.shade(rect(x, y, x + 1, y + 1), rn, sh)


def cloud(c, cx, cy, r, rn, seed, f, alpha=90, drift=1.0):
    """A haze cloud made of overlapping lobes, drifting a little with the frame."""
    m = np.zeros((H, W), bool)
    v = np.zeros((H, W))
    for k in range(7):
        lx = cx + (rnd(seed, k, 1) - 0.5) * r * 2.2 + math.sin(TAU * f / F + k) * drift
        ly = cy + (rnd(seed, k, 2) - 0.5) * r
        lr = r * (0.45 + rnd(seed, k, 3) * 0.5)
        d = disc(lx, ly, lr, lr * 0.75)
        m |= d
        v = np.maximum(v, radial(lx, ly, lr * 1.2))
    c.haze(m, 0.4 + 0.6 * v, rn, alpha=alpha)
    c.shade(m & (v > 0.5) & (((xx * 3 + yy * 7 + f) % 11) == 0) & (((xx + yy) % 2) == 0), rn, 2)
    c.shade(m & (v > 0.75) & (((xx * 5 + yy * 3 + f * 2) % 17) == 0), rn, 3)
    return m


# =====================================================================================================================
# zone 12 CLOUD DECK  /  Nebula.  Ramps: nb (rose), accents pu (blue starlight) + wh, gr for the deck
# =====================================================================================================================
def jar(c, x, base, w, h, f, rn="nb", seed=0):
    body = rect(x - w / 2, base - h, x + w / 2, base - 2)
    c.fill(rect(x - w / 2 - 1, base - 2, x + w / 2 + 1, base), 0.4, "gr")
    c.fill(rect(x - w / 2 + 1, base - h - 3, x + w / 2 - 1, base - h), 0.6, "gr")
    c.fill(body, 0.05, "pu", dither=0.2)
    for k in range(int(w * h / 10)):
        mx = x - w / 2 + 1 + rnd(seed, k, 1) * (w - 2)
        my = base - h + 1 + ((rnd(seed, k, 2) * (h - 3) - f * 0.7) % (h - 3))
        c.shade(rect(mx, my, mx + 1, my + 1), rn, 3 + (k + f) % 2)
    c.shade(rect(x - w / 2, base - h, x - w / 2 + 1, base - 2), "pu", 3)


def nb_1(c, f):
    """Dust: a small jar of glowing dust."""
    jar(c, SLOT[1], FLOOR, 6, 8, f, seed=1)


def nb_2(c, f):
    """Haze: a bell jar with a pink cloud turning inside."""
    x = SLOT[2]
    c.fill(rect(x - 6, FLOOR - 2, x + 6, FLOOR), 0.4, "gr")
    bell = disc(x, FLOOR - 8, 5.5, 8) & (yy < FLOOR - 2)
    c.fill(bell, 0.05, "pu", dither=0.2)
    m = disc(x + math.sin(TAU * f / F) * 1.2, FLOOR - 7, 3.5, 2.5) | disc(x - math.sin(TAU * f / F) * 1.2, FLOOR - 9, 3, 2)
    c.fill(m & bell, 0.6 + 0.3 * wave(f), "nb")
    c.shade(bell & ~disc(x, FLOOR - 8, 4.6, 7.1) & (xx < x), "pu", 3)
    c.shade(rect(x - 1, FLOOR - 17, x + 1, FLOOR - 15), "gr", 3)


def nb_3(c, f):
    """Veil: a sheet of glowing gas strung between two posts, rippling."""
    x = SLOT[3]
    c.fill(rect(x - 9, FLOOR - 20, x - 7, FLOOR), 0.4, "gr", outline=True)
    c.fill(rect(x + 7, FLOOR - 20, x + 9, FLOOR), 0.4, "gr", outline=True)
    for k in range(14):
        xx0 = x - 7 + k
        top = FLOOR - 18 + math.sin(k / 2 + TAU * f / F) * 1.2
        bot = FLOOR - 5 + math.sin(k / 3 + TAU * f / F + 1) * 1.5
        c.fill(rect(xx0, top, xx0 + 1, bot), 0.4 + 0.5 * ((k + f) % 4 == 0), "nb" if k % 3 else "pu", dither=0.6)


def nb_4(c, f):
    """Pillar: a tall glass tube holding a column of gas, a new star lighting in its top."""
    x = SLOT[4]
    h = 30
    c.fill(rect(x - 7, FLOOR - 3, x + 7, FLOOR), 0.4, "gr", outline=True)
    c.fill(rect(x - 6, FLOOR - h - 3, x + 6, FLOOR - h), 0.5, "gr", outline=True)
    tube = rect(x - 5, FLOOR - h, x + 5, FLOOR - 3)
    c.fill(tube, 0.04, "pu", dither=0.2)
    col = np.zeros((H, W), bool)
    for y in range(FLOOR - h + 1, FLOOR - 3):
        wdt = 2 + abs(math.sin(y / 4 + TAU * f / F)) * 2
        col |= rect(x - wdt + math.sin(y / 6) * 1, y, x + wdt + math.sin(y / 6), y + 1)
    c.fill(col & tube, 0.35 + 0.5 * lin(0, FLOOR, 0, FLOOR - h), "nb")
    c.shade(disc(x, FLOOR - h + 5, 1.6 + 0.6 * wave(f)), "wh", 4)
    c.shade(tube & rect(x - 5, 0, x - 4, H), "pu", 3)


def nb_5(c, f):
    """Nursery: a cradle of copper ribs holding five baby stars, each pulsing on its own beat."""
    x = SLOT[5]
    cy = FLOOR - 16
    c.fill(rect(x - 3, FLOOR - 6, x + 3, FLOOR), 0.4, "gr", outline=True)
    cradle = disc(x, cy, 13, 10) & ~disc(x, cy, 11.5, 8.5) & (yy > cy - 2)
    c.fill(cradle, 0.6, "cu")
    for k in range(5):
        a = math.pi * (0.15 + 0.175 * k)
        c.shade(line(x, cy, x + math.cos(a) * 12, cy + math.sin(a) * 9, 1), "cu", 2)
    cloud(c, x, cy - 2, 9, "nb", 55, f, alpha=90)
    for k, (dx, dy) in enumerate([(-6, -1), (-2, 2), (3, -3), (7, 1), (0, -6)]):
        r = 1.2 + 0.8 * wave(f, k / 5)
        c.shade(disc(x + dx, cy + dy, r + 1), "nb", 3)
        c.shade(disc(x + dx, cy + dy, r), "wh", 4)


def nb_6(c, f):
    """Cloud deck telescope: a brass telescope on a tripod pointed up through the window, a cloud caught in its lens."""
    x = SLOT[6]
    for dx in (-10, 0, 10):
        c.shade(line(x, FLOOR - 22, x + dx, FLOOR, 2), "gr", 2)
    tube = poly([(x - 14, FLOOR - 18), (x + 12, FLOOR - 44), (x + 18, FLOOR - 38), (x - 8, FLOOR - 12)])
    c.fill(tube, 0.4 + 0.4 * lin(x - 14, FLOOR - 12, x + 18, FLOOR - 44), "rn", outline=True)
    for k in range(3):
        q = 0.25 + k * 0.25
        bx, by = x - 11 + 26 * q, FLOOR - 15 - 26 * q
        c.shade(line(bx - 3, by - 3, bx + 3, by + 3, 1.5), "rn", 4)
    c.fill(disc(x + 15, FLOOR - 41, 4.5), 0.1, "pu", dither=0.2)
    c.shade(disc(x + 15, FLOOR - 41, 4.5) & ~disc(x + 15, FLOOR - 41, 3.5), "rn", 4)
    c.shade(disc(x + 15 + math.sin(TAU * f / F), FLOOR - 41, 2), "nb", 3)
    c.shade(rect(x - 2, FLOOR - 25, x + 2, FLOOR - 21), "gr", 3)


def nb_7(c, f):
    """Cloud deck: a great glass sphere on a pump stand, full of turning nebula, a star being born at its heart."""
    x, base = SLOT[7], FLOOR
    cy, R = base - 38, 30
    # stand and pipes
    c.fill(poly([(x - 18, base), (x - 10, base - 12), (x + 10, base - 12), (x + 18, base)]), 0.3 + 0.2 * lin(x - 18, base, x + 18, base - 12), "gr", outline=True)
    for k, dx in enumerate((-22, 22)):
        c.fill(rect(x + dx - 2, base - 26, x + dx + 2, base), 0.35, "cu", outline=True)
        c.shade(line(x + dx, base - 26, x + dx * 0.6, cy + 8, 3), "cu", 2)
        c.shade(rect(x + dx - 1, base - 20 + (f + k * 3) % 6 * 3, x + dx + 1, base - 19 + (f + k * 3) % 6 * 3), "nb", 4)
    sphere = disc(x, cy, R)
    c.fill(sphere, 0.03, "pu", dither=0.2)
    # swirling gas: two arms rotating
    for arm in range(2):
        for i in range(60):
            t = i / 60
            a = arm * math.pi + t * 4.0 + TAU * f / F / 2
            rr = 3 + t * (R - 5)
            px_, py_ = x + math.cos(a) * rr, cy + math.sin(a) * rr * 0.8
            c.fill(disc(px_, py_, 2.5 + t * 3) & sphere, 0.3 + 0.6 * (1 - t), "nb" if arm == 0 else "qz", dither=0.7)
    starfield(c, f, 1271, n=25, ramps=("wh", "pu"))
    c.shade(disc(x, cy, 4 + 1.2 * wave(f)), "nb", 4)
    c.shade(disc(x, cy, 2.5), "wh", 4)
    for k in range(4):  # spikes
        a = k * math.pi / 2
        c.shade(line(x, cy, x + math.cos(a) * (7 + 2 * wave(f)), cy + math.sin(a) * (7 + 2 * wave(f)), 1), "wh", 4)
    c.shade(sphere & ~disc(x, cy, R - 1), "pu", 3)
    c.shade(disc(x - 12, cy - 14, 3, 5) & sphere & ~disc(x - 11, cy - 13, 2, 4), "wh", 4)
    c.fill(rect(x - 8, cy - R - 4, x + 8, cy - R + 2), 0.5, "gr", outline=True)
    c.shade(rect(x - 1, cy - R - 8, x + 1, cy - R - 4), "gr", 3)


# =====================================================================================================================
# zone 13 BEACON SPIRE  /  Pulsars.  Ramps: pu (electric blue), accents wh + sn (warm lamp) + mag
# =====================================================================================================================
def beam(c, x, y, angle, length, width, rn="pu", alpha=80):
    a = angle
    ex, ey = x + math.cos(a) * length, y + math.sin(a) * length
    nx, ny = -math.sin(a) * width, math.cos(a) * width
    m = poly([(x, y), (ex + nx, ey + ny), (ex - nx, ey - ny)])
    c.haze(m, 0.95, rn, alpha=alpha)
    c.shade(m & (((xx * 5 + yy * 3) % 7) == 0), rn, 2)
    c.shade(line(x, y, x + math.cos(a) * length * 0.7, y + math.sin(a) * length * 0.7, 1), rn, 3)
    return m


def pu_1(c, f):
    """Blink: a tiny beacon on a stake, blinking on an exact beat."""
    x = SLOT[1]
    c.shade(rect(x, FLOOR - 8, x + 1, FLOOR), "gr", 3)
    on = f % 2 == 0
    c.shade(disc(x + 0.5, FLOOR - 9, 1.6), "pu", 4 if on else 1)
    if on:
        c.haze(disc(x, FLOOR - 9, 5), 0.95, "pu", alpha=90)


def pu_2(c, f):
    """Beat: a metronome ticking left and right."""
    x = SLOT[2]
    c.fill(poly([(x - 6, FLOOR), (x - 3, FLOOR - 14), (x + 3, FLOOR - 14), (x + 6, FLOOR)]), 0.3 + 0.3 * lin(x - 6, FLOOR, x + 6, FLOOR - 14), "rn", outline=True)
    a = math.sin(TAU * f / F) * 0.6
    c.shade(line(x, FLOOR - 3, x + math.sin(a) * 12, FLOOR - 3 - math.cos(a) * 12, 1), "wh", 4)
    c.shade(disc(x + math.sin(a) * 8, FLOOR - 3 - math.cos(a) * 8, 1.4), "pu", 4)


def pu_3(c, f):
    """Beacon: a lamp post with a turning light."""
    x = SLOT[3]
    c.fill(rect(x - 1.5, FLOOR - 18, x + 1.5, FLOOR), 0.4, "gr", outline=True)
    c.fill(rect(x - 4, FLOOR - 2, x + 4, FLOOR), 0.5, "gr")
    lamp = rect(x - 3.5, FLOOR - 24, x + 3.5, FLOOR - 18)
    c.fill(lamp, 0.5, "pu", outline=True)
    c.fill(rect(x - 4.5, FLOOR - 26, x + 4.5, FLOOR - 24), 0.6, "gr")
    a = TAU * f / F
    beam(c, x, FLOOR - 21, a, 16, 2.5, "pu", alpha=70)
    c.shade(rect(x + round(math.cos(a) * 2.5) - 0.5, FLOOR - 22, x + round(math.cos(a) * 2.5) + 0.5, FLOOR - 20), "wh", 4)


def pu_4(c, f):
    """Lighthouse: a small striped lighthouse sweeping its beam across the zone."""
    x = SLOT[4]
    body = poly([(x - 7, FLOOR), (x - 4, FLOOR - 26), (x + 4, FLOOR - 26), (x + 7, FLOOR)])
    c.fill(body, 0.6 + 0.3 * lin(x - 7, 0, x + 7, 0), "wh", outline=True)
    for k in range(3):
        c.fill(body & rect(0, FLOOR - 8 - k * 8, W, FLOOR - 4 - k * 8), 0.6, "mag")
    c.fill(rect(x - 5, FLOOR - 33, x + 5, FLOOR - 26), 0.1, "pu", dither=0.2)
    c.fill(poly([(x - 6, FLOOR - 33), (x, FLOOR - 38), (x + 6, FLOOR - 33)]), 0.5, "mag", outline=True)
    a = math.pi + math.sin(TAU * f / F) * 1.2 - 0.3
    beam(c, x, FLOOR - 30, a, 30, 5, "pu", alpha=80)
    c.shade(disc(x, FLOOR - 30, 2.2), "wh", 4)


def pu_5(c, f):
    """Magnetar: two magnet poles holding a tiny spinning star, field lines looping between them."""
    x = SLOT[5]
    cy = FLOOR - 18
    for side in (-1, 1):
        px0 = x + side * 13
        c.fill(rect(px0 - 3, cy - 12, px0 + 3, FLOOR), 0.35, "gr", outline=True)
        c.fill(rect(px0 - 3, cy - 12, px0 + 3, cy - 6), 0.6, "red" if side < 0 else "si")
    for k in range(4):
        ry = 4 + k * 3
        loop = disc(x, cy, 12, ry) & ~disc(x, cy, 11, ry - 1)
        c.shade(loop & (((xx + yy + f * 2 + k) % 4) == 0), "pu", 2 + (k == f % 4))
    c.shade(disc(x, cy, 3 + 0.8 * wave(f)), "pu", 4)
    c.shade(disc(x, cy, 1.5), "wh", 4)
    a = TAU * f / F / 2
    c.shade(line(x - math.cos(a) * 8, cy - math.sin(a) * 8, x + math.cos(a) * 8, cy + math.sin(a) * 8, 1), "wh", 3)


def pu_6(c, f):
    """Spire: a tall lattice mast with dishes, a light climbing it and a lamp blinking on top."""
    x = SLOT[6]
    h = 52
    top = FLOOR - h
    m = line(x - 9, FLOOR, x - 1, top, 1.5) | line(x + 9, FLOOR, x + 1, top, 1.5)
    for y in range(top + 4, FLOOR, 5):
        q = (y - top) / h
        m |= line(x - 1 - 8 * q, y, x + 1 + 8 * q, y + 5, 1) | line(x + 1 + 8 * q, y, x - 1 - 8 * q, y + 5, 1)
    c.fill(m, 0.45, "gr")
    for k, (dy, side) in enumerate([(14, -1), (26, 1), (36, -1)]):
        dx = x + side * 6
        dish = disc(dx + side * 3, top + dy, 4, 6) & ~disc(dx + side * 5, top + dy, 4, 6)
        c.fill(dish, 0.6, "wh")
    y = FLOOR - (f / F) * h
    c.shade(rect(x - 2, y, x + 2, y + 1), "pu", 4)
    on = f % 3 != 2
    c.shade(rect(x - 1.5, top - 3, x + 1.5, top), "mag", 4 if on else 1)
    if on:
        c.haze(disc(x, top - 2, 6), 0.95, "mag", alpha=80)


def pu_7(c, f):
    """Beacon spire: a pulsar held in a gimbal of rings on a great tower, its two beams sweeping round."""
    x, base = SLOT[7], FLOOR
    cy = base - 46
    # tower
    c.fill(poly([(x - 16, base), (x - 6, cy + 14), (x + 6, cy + 14), (x + 16, base)]), 0.25 + 0.3 * lin(x - 16, base, x + 16, cy), "gr", outline=True)
    for k in range(4):
        y = base - 6 - k * 7
        c.shade(rect(x - 12 + k * 2, y, x + 12 - k * 2, y + 1), "gr", 3)
        c.shade(rect(x - 2, y - 4, x + 2, y - 2), "pu", 4 if (f + k) % 4 == 0 else 2)
    # beams (behind the rings)
    a = TAU * f / F / 2 - 1.1
    beam(c, x, cy, a, 64, 7, "pu", alpha=90)
    beam(c, x, cy, a + math.pi, 64, 7, "pu", alpha=90)
    # gimbal rings
    for k, (rx, ry) in enumerate([(20, 7), (7, 20), (16, 16)]):
        ring = disc(x, cy, rx, ry) & ~disc(x, cy, rx - 1.6, ry - 1.6)
        c.fill(ring, 0.55 + 0.3 * (k == 2), "rn" if k < 2 else "gr")
    # the star
    c.shade(disc(x, cy, 6 + wave(f)), "pu", 3)
    c.shade(disc(x, cy, 4), "pu", 4)
    c.shade(disc(x - 1, cy - 1, 2), "wh", 4)
    twinkle(c, f, 12, 1707, (x - 40, base - 80, x + 40, base - 30), ["pu", "wh", "mag"])


# =====================================================================================================================
# zone 14 EVENT HORIZON  /  Singularity.  Ramps: sn (accretion gold), accents mag + pu, wh
# =====================================================================================================================
def hole(c, x, cy, R, f, tilt=0.32, rn="sn"):
    """A black hole: dark centre, glowing disk turning (bright clumps move round), lensed back of the disk over the top."""
    back = disc(x, cy, R, R * tilt) & ~disc(x, cy, R * 0.45, R * tilt * 0.45) & (yy < cy)
    halo = disc(x, cy - R * 0.05, R * 0.55) & ~disc(x, cy - R * 0.05, R * 0.55 - max(1, R * 0.08)) & (yy < cy)
    c.fill(halo, 0.85, rn)
    c.fill(back, 0.3 + 0.4 * (1 - np.abs(xx - x) / R), rn)
    hl = disc(x, cy - R * 0.05, R * 0.44)
    c.set(hl, (5, 3, 2))
    front = disc(x, cy, R, R * tilt) & ~disc(x, cy, R * 0.45, R * tilt * 0.45) & (yy >= cy)
    c.fill(front, 0.45 + 0.5 * (1 - np.abs(xx - x) / R), rn)
    for k in range(5):
        a = TAU * (f / F / 5 + k / 5)
        bx, by = x + math.cos(a) * R * 0.75, cy + math.sin(a) * R * tilt * 0.75
        if math.sin(a) > -0.2:
            c.shade(disc(bx, by, max(1, R * 0.06)), "wh", 4)
    c.shade(disc(x, cy, R, R * tilt) & ~disc(x, cy, R - 1, R * tilt - 1) & (yy >= cy), rn, 4)


def sn_1(c, f):
    """Mote: a tiny dark sphere with a ring, hovering over a dish."""
    x = SLOT[1]
    c.fill(rect(x - 4, FLOOR - 2, x + 4, FLOOR), 0.5, "gr")
    hole(c, x, FLOOR - 8 - (1 if f % 3 == 0 else 0), 5, f)


def sn_2(c, f):
    """Well: a gravity-well grid sagging into a funnel, a marble circling down."""
    x = SLOT[2]
    for k in range(4):
        r = 7 - k * 1.5
        c.shade(disc(x, FLOOR - 6 + k * 1.4, r, r * 0.35) & ~disc(x, FLOOR - 6 + k * 1.4, r - 0.8, r * 0.35 - 0.6), "sn", 2 + (k == 3))
    a = TAU * f / F
    rr = 6 - (f / F) * 4
    c.shade(disc(x + math.cos(a) * rr, FLOOR - 6 + (6 - rr) * 0.8 + math.sin(a) * rr * 0.35, 1.1), "wh", 4)
    c.fill(rect(x - 8, FLOOR - 1, x + 8, FLOOR), 0.4, "gr")


def sn_3(c, f):
    """Lens: a ring on a stand that bends the starlight behind it into an arc."""
    x = SLOT[3]
    cy = FLOOR - 13
    c.fill(rect(x - 1, cy + 6, x + 1, FLOOR), 0.4, "gr", outline=True)
    c.fill(rect(x - 5, FLOOR - 2, x + 5, FLOOR), 0.5, "gr")
    ring = disc(x, cy, 8) & ~disc(x, cy, 6.3)
    c.fill(ring, 0.6, "rn")
    c.fill(disc(x, cy, 6.3), 0.03, "pu", dither=0.2)
    arc = disc(x, cy, 4.5) & ~disc(x, cy, 3.3) & (yy < cy + 1)
    c.shade(arc & (((xx + f) % 2) == 0), "pu", 3)
    c.shade(arc & (((xx + f) % 2) == 1), "sn", 3)
    c.shade(disc(x, cy, 1.0), "wh", 4 if f % 2 else 2)


def sn_4(c, f):
    """Disk: a small black hole in an orrery stand, its disk turning."""
    x = SLOT[4]
    cy = FLOOR - 16
    c.fill(poly([(x - 8, FLOOR), (x - 2, FLOOR - 7), (x + 2, FLOOR - 7), (x + 8, FLOOR)]), 0.4, "gr", outline=True)
    c.shade(disc(x, cy, 11, 11) & ~disc(x, cy, 10, 10) & (xx < x - 6), "rn", 3)
    c.shade(disc(x, cy, 11, 11) & ~disc(x, cy, 10, 10) & (xx > x + 6), "rn", 3)
    hole(c, x, cy, 10, f)


def sn_5(c, f):
    """Horizon: a ring gate standing on the floor, its centre black, light curling round its edge."""
    x = SLOT[5]
    cy = FLOOR - 17
    gate = disc(x, cy, 15, 17) & ~disc(x, cy, 11, 13)
    c.fill(gate & (yy < FLOOR), 0.3 + 0.4 * lin(x - 15, FLOOR, x + 15, cy - 17), "gr", outline=True)
    c.set(disc(x, cy, 11, 13) & (yy < FLOOR), (5, 3, 2))
    for k in range(8):
        a = TAU * (k / 8 + f / F / 4)
        c.shade(disc(x + math.cos(a) * 12.5, cy + math.sin(a) * 14.5, 1), "sn" if k % 2 else "mag", 4)
    rim = disc(x, cy, 11, 13) & ~disc(x, cy, 10, 12) & (yy < FLOOR)
    c.shade(rim, "sn", 3)
    c.fill(rect(x - 18, FLOOR - 3, x + 18, FLOOR), 0.4, "gr")


def sn_6(c, f):
    """Singularity: a black hole floating free, matter spiralling into it from a nearby cloud."""
    x = SLOT[6]
    cy = FLOOR - 26
    for i in range(30):  # stream
        t = i / 30
        a = t * 5 + TAU * f / F / 3
        rr = 24 * (1 - t) + 9
        c.shade(disc(x + math.cos(a) * rr, cy + math.sin(a) * rr * 0.4, 1 + (1 - t)), "mag" if i % 3 else "sn", 3)
    hole(c, x, cy, 17, f)
    c.haze(disc(x, FLOOR - 3, 12, 3), 0.95, "sn", alpha=60)


def sn_7(c, f):
    """Event horizon: a vast black hole low on the right, its tilted disk blazing, a small probe falling in on a long arc."""
    x, base = SLOT[7], FLOOR
    cy = base - 34
    R = 38
    c.haze(disc(x, cy, R + 10, R * 0.6), 0.9, "sn", alpha=80)
    # jets up and down, behind the hole and its disk
    jets = K.Cell()
    for d in (-1, 1):
        jet = poly([(x - 2, cy), (x + 2, cy), (x + 4 + d, cy + d * 40), (x - 4 + d, cy + d * 40)]) & (yy < base)
        jets.shade(jet & (((yy + f * 3) % 4) == 0), "pu", 3)
    hole(c, x, cy, R, f, tilt=0.3)
    c.under(jets)
    # probe falling in
    t = (f / F)
    px0, py0 = x - 44 + t * 18, cy - 30 + t * 14
    c.shade(rect(px0 - 1, py0 - 1, px0 + 2, py0 + 1), "wh", 4)
    c.shade(rect(px0 - 3, py0, px0 - 1, py0 + 1) | rect(px0 + 2, py0, px0 + 4, py0 + 1), "pu", 3)
    for k in range(4):
        c.shade(rect(px0 - 4 - k * 3, py0 - 2 - k * 2, px0 - 3 - k * 3, py0 - 1 - k * 2), "sn", 2)
    twinkle(c, f, 14, 1707, (x - 50, base - 80, x + 40, base - 10), ["sn", "wh", "mag"])


# =====================================================================================================================
# composing a panel: era scene backdrop, sprites scaled up over it, the floor line
# =====================================================================================================================
def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).resolve().parent / file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


SCN = _load("nodefarm_scenes_deep", "nodefarm-scenes-deep.py")
SKIRT = _load("zone_art_skirt", "zone-art-skirt.py")
VIEW = 0.6  # backdrop scale: the whole 480 px world fits across the cell

# zone: (era, world x offset, world top row). Offsets put each era's centrepiece where it helps: Beacon's lighthouse and
# the Horizon hole left of the sprites, the Root crystal left of centre, and the Mirror stair behind the hero, which then stands in front of it.
BAND = {"nebula": (9, 0, 80), "pulsars": (10, 65, 95), "singularity": (11, 40, 100), "engrams": (12, 0, 100),
        "paradox": (13, -170, 100), "origin": (14, 40, 100)}
# how much of the era scene's brightness the panel keeps (the bright scenes are held back a little more)
DIM = {"nebula": 0.68, "pulsars": 0.95, "singularity": 0.95, "engrams": 0.8, "paradox": 0.95, "origin": 0.95}
# sky wash: ramp, glow centre (x, y) and radius in cell px
WASH = {"nebula": ("nb", 150, 30, 170), "pulsars": ("pu", 120, 40, 150), "singularity": ("sn", 120, 30, 120),
        "engrams": ("eg", 150, 20, 160), "paradox": ("vs", 246, 40, 160), "origin": ("or", 246, 60, 150)}
# sprite prefix, floor ramp, floor light, right edge of the run of sprites 1-6 (where the hero starts)
ZONE = {"nebula": ("nb", "gr", "nb", 222), "pulsars": ("pu", "gr", "pu", 222), "singularity": ("sn", "gr", "sn", 214),
        "engrams": ("eg", "eg", "cyan", 244), "paradox": ("px", "px", "mag", 230), "origin": ("or", "or", "or", 206)}
SCALE = (2.0, 1.85, 1.6, 1.3, 1.15, 1.0)  # sprites 1-6 at most; the hero keeps its size
LEFT = 60  # the run of sprites starts past the description
OVERLAP = 6  # px a sprite may stand in front of the next one
MIN_SMALL = 1.5  # sprites 1-3 never shrink below this: they are the ones that read too small


def backdrop(zone, f, w=W, x0=0):
    """The era scene band, w px wide starting x0 px right of the cell's left edge, frame f of the panel loop. Opaque."""
    era, ox, oy = BAND[zone]
    _, far, near, fx, _ = SCN.ERAS[era]
    v = SCN.View(w, H, VIEW, ox + x0 / VIEW, oy)
    img = SCN.over(SCN.over(far(v).img, near(v).img), fx(v, round(f * SCN.FRAMES / F) % SCN.FRAMES).img)
    out = img.copy()
    out[..., 3] = 255
    rn, cx, cy, r = WASH[zone]
    ramp = np.array(RAMPS[rn])
    gy, gx = np.mgrid[0:H, 0:w].astype(float)
    gx += x0
    sky = (img[..., :3] @ [0.299, 0.587, 0.114] < 24) | (img[..., 3] == 0)
    glow = np.clip(1 - np.hypot((gx - cx) / r, (gy - cy) / (r * 0.55)), 0, 1)
    idx = np.floor(0.25 + 0.35 * gy / H + 0.9 * glow + v.bayer * 0.9).astype(int)  # 0 keeps the sky, 1 and 2 are shades 0, 1
    for i in (1, 2):
        out[sky & (idx == i), :3] = ramp[i - 1]
    out[..., :3] = (out[..., :3] * DIM[zone]).astype(np.uint8)
    return out


class scaled:
    """Inside this block, sprite code written for the cell draws s times larger: the sprite's foot at (ax, FLOOR) lands on
    (tx, FLOOR). It swaps the coordinate grids that the mask helpers read and wraps poly, so every shape is evaluated at
    full resolution (crisp 1 px outlines, native dither)."""

    def __init__(self, s, ax, tx):
        self.s, self.ax, self.tx = s, ax, tx

    def __enter__(self):
        global xx, yy, poly
        self.saved = (K.xx, K.yy, xx, yy, poly)
        s, ax, tx, kpoly = self.s, self.ax, self.tx, self.saved[4]
        K.xx = xx = ax + (self.saved[0] + 0.5 - tx) / s - 0.5
        K.yy = yy = FLOOR + (self.saved[1] + 0.5 - FLOOR) / s - 0.5
        poly = lambda pts, ss=4: kpoly([(tx + (x - ax) * s, FLOOR + (y - FLOOR) * s) for x, y in pts], ss)  # noqa: E731

    def __exit__(self, *exc):
        global xx, yy, poly
        K.xx, K.yy, xx, yy, poly = self.saved


def layout(zone):
    """(sprite fns 1-7, [(scale, source centre x, target centre x) for sprites 1-6]). Each sprite is measured over its whole
    loop by the columns where it has some body (3+ opaque px, so loose sparks and twinkles don't count). 1-6 then spread
    evenly from LEFT to the hero. When they don't fit, 4-6 shrink first (down to 1x), then 1-3 (down to MIN_SMALL), then
    they stand further in front of each other (down to -OVERLAP gaps) and the last ones reach into the hero."""
    pre, _, _, right = ZONE[zone]
    fns = [globals()[f"{pre}_{i}"] for i in range(1, 8)]
    spans = []
    for fn in fns[:6]:
        body = np.zeros(W, bool)
        for f in range(F):
            c = K.Cell()
            fn(c, f)
            body |= (c.img[..., 3] == 255).sum(0) >= 3
        xs = np.nonzero(body)[0]
        spans.append((xs.min(), xs.max() + 1))
    scales = list(SCALE)
    for group, floor in (((3, 4, 5), 1.0), ((0, 1, 2), MIN_SMALL)):
        for _ in range(30):
            widths = [(b - a) * s for (a, b), s in zip(spans, scales)]
            if sum(widths) - 5 * OVERLAP <= right - LEFT:
                break
            for i in group:
                scales[i] = max(floor, scales[i] * 0.96)
    widths = [(b - a) * s for (a, b), s in zip(spans, scales)]
    gap = max(-OVERLAP, (right - LEFT - sum(widths)) / 5)
    x, out = LEFT, []
    for (a, b), s, w in zip(spans, scales, widths):
        out.append((s, (a + b) / 2, x + w / 2))
        x += w + gap
    return fns, out


def blend(dst, src):
    """src over dst: opaque pixels replace, part-alpha glows mix in."""
    a = src[..., 3:4] / 255.0
    m = src[..., 3] > 0
    dst[..., :3] = np.where(m[..., None], src[..., :3] * a + dst[..., :3] * (1 - a), dst[..., :3]).astype(np.uint8)


def panel(zone):
    fns, lay = layout(zone)
    _, floor_rn, light, _ = ZONE[zone]
    bgs = [backdrop(zone, f) for f in range(F)]

    def draw(stage, f):
        fg = K.Cell()
        if stage >= 7:
            fns[6](fg, f)                      # the hero first, so the smaller ones stand in front of its glow
        for i in range(min(stage, 6) - 1, -1, -1):
            s, ax, tx = lay[i]
            with scaled(s, ax, tx):
                fns[i](fg, f)
        ground(fg, floor_rn, f, light)
        out = bgs[f].copy()
        blend(out, fg.img)
        c = K.Cell()
        c.img = out
        return c
    return draw


def skirt(zone):
    """The world just left of the cell (stage 0, frame 0, floor seams lined up), dissolved like every other skirt."""
    sw = SKIRT.SKW
    strip = backdrop(zone, 0, sw, -sw)
    fl = K.Cell()
    ground(fl, ZONE[zone][1], 0, x0=-sw, lights=False)
    blend(strip, fl.img[:, :sw])
    im = SKIRT.dissolve(strip)
    for ext, kw in (("png", {"optimize": True}), ("webp", {"lossless": True, "quality": 100, "method": 6})):
        p = K.OUT / f"zone-{zone}-skirt.{ext}"
        im.save(p, **kw)
    print(f"  zone-{zone}-skirt.webp: {p.stat().st_size / 1000:.1f} KB")


ZONES = ("nebula", "pulsars", "singularity", "engrams", "paradox", "origin")

if __name__ == "__main__":
    for z in sys.argv[1:] or ZONES:
        print(z)
        K.save_sheet(z, panel(z))
        skirt(z)
