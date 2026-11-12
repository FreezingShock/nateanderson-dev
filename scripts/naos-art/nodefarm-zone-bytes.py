"""Zone 01, Uplink rack (Bytes): staged panel art, the pilot for the zone art system.

The Bytes icon is an isometric data cube, so the panel grows a skyline of them: seven cubes, each bigger than the last, rising
out of a dim rack room with a packet bus running along the floor. Cubes carry flickering bit marks; bigger cubes get more
detail (a lit seam, a status light, a pulsing core on the biggest). Uses cyan for the faces, the Silicon blue for shadow faces,
white for highlights and a touch of magenta and lime for status lights.

Writes public/naos/nodefarm/zone-bytes.{png,webp}. Run: python3 scripts/naos-art/nodefarm-zone-bytes.py
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import numpy as np  # noqa: E402
import nodefarm_zone_kit as K  # noqa: E402

BASE = K.H - 3  # floor line (rows 0-31 are headroom that reaches up to the title bar)
Y = K.HEAD  # sprite rows start here

# stage -> (centre x, base y, height). Everything sits in the right 180 px so phones see every stage.
CUBES = [
    (170, BASE + 2, 8),    # 1: small, in front of the big one
    (114, BASE, 12),  # 2
    (131, BASE, 16),  # 3
    (152, BASE, 22),  # 4
    (270, BASE, 30),  # 5
    (236, BASE, 37),  # 6
    (188, BASE, 50),  # 7: the hero (its top stays below row 10, which can sit under the title bar)
]
# draw order: back to front (the hero sits behind the small front cube)
ORDER = [1, 2, 3, 6, 5, 4, 0]


def hsh(*a):
    h = 2166136261
    for v in a:
        h = ((h ^ (int(v) & 0xFFFFFFFF)) * 16777619) & 0xFFFFFFFF
    return h


LED_RAMPS = ["cyan", "cyan", "lime", "mag", "si", "wh", "rn"]


def backdrop(c, f):
    rng = np.random.default_rng(7)
    # overhead cable runs sagging between racks (drawn first, racks sit in front)
    for k, (y0, ramp) in enumerate(((4, "si"), (11, "cyan"), (18, "mag"), (Y + 9, "si"), (Y + 15, "lime"))):
        for x0 in range(-20 + k * 13, K.W, 58):
            x1 = x0 + 58
            for x in range(max(0, x0), min(K.W, x1)):
                t = (x - x0) / 58
                y = int(y0 + 5 * 4 * t * (1 - t))
                c.set(K.rect(x, y, x + 1, y + 1), K.RAMPS[ramp][1], 150)
    # distant racks: a dense haze skyline, each rack fitted with blinking status lights in several colours
    x = 0
    while x < K.W:
        w = int(rng.integers(12, 22))
        top = int(rng.integers(6, Y + 20))
        rack = K.rect(x, top, x + w - 2, BASE)
        c.img[rack] = 0
        c.haze(rack, 0.45 + 0.5 * K.lin(0, BASE, 0, top), "cyan", alpha=85)
        c.set(K.rect(x, top, x + w - 2, top + 1), K.RAMPS["cyan"][1], 200)  # lit top edge
        for ly in range(top + 3, BASE - 3, 4):
            for lx in range(x + 2, x + w - 4, 3):
                hv = hsh(lx, ly)
                if hv % 3:
                    continue
                ramp = LED_RAMPS[hv % len(LED_RAMPS)]
                on = ((hv >> 5) + f * (1 + hv % 2)) % 4 != 0
                c.set(K.rect(lx, ly, lx + 1, ly + 1), K.RAMPS[ramp][2 if on else 1], 230 if on else 120)
        x += w
    # the floor: a lit line, a perspective grid and a dithered glow under it
    c.shade(K.rect(0, BASE, K.W, BASE + 1), "cyan", 1)
    c.haze(K.rect(0, BASE + 1, K.W, K.H), 0.9 - 0.6 * K.lin(0, BASE, 0, K.H), "cyan", alpha=80)
    for gx in range(-40, K.W + 40, 16):
        c.set(K.line(gx, BASE + 1, gx + (gx - K.W / 2) * 0.15, K.H, 1.0) & (c.img[..., 3] < 255), K.RAMPS["si"][1], 160)
    # packets riding the bus to the right, 8 px per frame on a 48 px spacing, so the loop is seamless
    for x0 in range(-48, K.W, 48):
        px = x0 + f * 8 + (hsh(x0) % 7)
        ramp = ["cyan", "cyan", "lime", "cyan", "mag", "cyan", "wh"][(x0 // 48) % 7]
        c.shade(K.rect(px, BASE, px + 3, BASE + 1), ramp, 4)
        c.shade(K.rect(px - 3, BASE, px, BASE + 1), ramp, 2)


def face_pt(o, a, b, u, v):
    return (o[0] + u * (a[0] - o[0]) + v * (b[0] - o[0]), o[1] + u * (a[1] - o[1]) + v * (b[1] - o[1]))


def cube(c, i, cx, base, h, f):
    w = 0.92 * h
    hw, q = w / 2, 0.25 * h
    tip, right, mid, left = (cx, base - h), (cx + hw, base - h + q), (cx, base - h + 2 * q), (cx - hw, base - h + q)
    lb, bot, rb = (cx - hw, base - q), (cx, base), (cx + hw, base - q)
    top_m = K.poly([tip, right, mid, left])
    left_m = K.poly([left, mid, bot, lb])
    right_m = K.poly([mid, right, rb, bot])
    shape = top_m | left_m | right_m
    # glow on the floor under it
    c.haze(K.disc(cx, base, hw * 1.3, 2.5), 1.0, "cyan", alpha=90)
    c.img[shape] = 0
    c.fill(left_m, 0.30 + 0.28 * K.lin(lb[0], lb[1], mid[0], mid[1]), "cyan")
    c.fill(right_m, 0.08 + 0.3 * K.lin(rb[0], rb[1], mid[0], mid[1]), "si")
    c.fill(top_m, 0.72 + 0.3 * K.lin(mid[0], mid[1], tip[0], tip[1]), "cyan")
    c.outline(shape, "cyan", 0)
    # lit seam down the front edge on cubes 4+
    if i >= 3:
        c.shade(K.line(mid[0], mid[1] + 1, bot[0], bot[1] - 1, 1.0) & shape, "cyan", 4)
    # bit marks on both side faces, a few flip each frame
    px = 1 if h < 30 else 2
    rows = max(1, int(h / 9))
    cols = max(2, int(h / 6))
    # each cube's bits take one accent, so the skyline is not one flat cyan
    accent = [("cyan", 4), ("lime", 3), ("wh", 4), ("cyan", 4), ("mag", 3), ("lime", 3), ("wh", 4)][i]
    for face, (o, a, b), ramp, lit in ((0, (left, mid, lb), accent[0], accent[1]), (1, (mid, right, bot), "si", 3)):
        for r in range(rows):
            for k in range(cols):
                u = (k + 0.7) / (cols + 0.4)
                v = (r + 0.8) / (rows + 0.9)
                if face == 1:
                    v = (r + 0.8) / (rows + 0.9)
                x, y = face_pt(o, a, b, u, v)
                hv = hsh(i, face, r, k)
                on = (hv % 3) != 0
                if hv % 5 == 0:  # flickering bit
                    on = ((hv >> 4) + f) % 3 != 0
                if on:
                    shade = lit
                    c.shade(K.rect(round(x), round(y), round(x) + px, round(y) + 1) & shape, ramp, shade)
    # status light on cubes 5+, blinking magenta / lime
    if i >= 4:
        lx, ly = face_pt(mid, right, bot, 0.78, 0.2)
        col = ("mag", 3) if (f + i) % 3 else ("lime", 3)
        c.shade(K.rect(round(lx), round(ly), round(lx) + 2, round(ly) + 1), *col)
    # the hero: a core pulsing in the top face, and a scan glint sweeping it
    if i == 6:
        k = K.wave(f)
        core = K.poly([(cx, tip[1] + q * 0.55), (cx + hw * 0.45, tip[1] + q), (cx, tip[1] + q * 1.45), (cx - hw * 0.45, tip[1] + q)])
        c.fill(core, 0.6 + 0.4 * k * (1 - K.radial(cx, tip[1] + q, hw * 0.45)) + 0.4 * K.radial(cx, tip[1] + q, hw * 0.45), "cyan")
        c.outline(core, "si", 1)
        # glint band along the top face, moving across over the loop
        pos = -20 + f * 14
        band = (np.abs((K.xx - cx) - (K.yy - tip[1]) * 1.8 - pos) <= 1.5) & top_m & ~core
        c.shade(band, "cyan", 4)
        # two packets orbiting the base
        for j in range(2):
            a = 2 * math.pi * (f / K.FRAMES + j / 2)
            ox, oy = cx + math.cos(a) * hw * 1.15, base - q + math.sin(a) * q * 0.9
            if math.sin(a) > -0.2 or not shape[int(min(oy, K.H - 1)), int(min(max(ox, 0), K.W - 1))]:
                c.shade(K.rect(round(ox), round(oy), round(ox) + 2, round(oy) + 1), "wh", 4)


def draw(stage, f):
    c = K.Cell()
    for i in ORDER:
        if i < stage:
            cx, base, h = CUBES[i]
            if 1 <= i <= 5:
                base -= 1 + (1 if (f + i) % K.FRAMES < 3 else 0)
            fg = K.Cell()
            fg.img[...] = c.img
            cube(fg, i, cx, base, h, f)
            c = fg
    bg = K.Cell()
    backdrop(bg, f)
    c.under(bg)
    return c


if __name__ == "__main__":
    K.save_sheet("bytes", draw)
