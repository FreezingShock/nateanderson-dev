"""Node Farm tier icon sheet: one 32 x 32 original pixel-dither sprite for every button tier of every stat.

Sixteen rows (Multipliers to Chrono, then Nebula, Pulsars, Singularity, Engrams, Paradox, Origin) by six columns (tier 1 to 6), written to
public/naos/nodefarm/tiers.{png,webp}. Each stat has one motif that grows with the tier (bigger, more parts, brighter), so
the sixth button of a stat clearly looks like the final form of the first. Reuses the drawing helpers of nodefarm-icons.py.
To add a stat: write a function (canvas, t) like the ones below and append it to ROWS; components/nodefarm/icon.tsx reads
the same row order. Run: python3 scripts/naos-art/nodefarm-tier-icons.py
"""
import importlib.util
import math
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("nfi", HERE / "nodefarm-icons.py")
nfi = importlib.util.module_from_spec(spec)
spec.loader.exec_module(nfi)
Canvas, RAMPS, poly, disc, lin, rect, xx, yy, N = nfi.Canvas, nfi.RAMPS, nfi.poly, nfi.disc, nfi.lin, nfi.rect, nfi.xx, nfi.yy, nfi.N

TIERS = 6


def hexmask(cx, cy, R):
    m = np.ones((N, N), bool)
    for k in range(6):
        a = math.pi / 3 * k + math.pi / 6
        m &= ((xx + .5 - cx) * math.cos(a) + (yy + .5 - cy) * math.sin(a)) <= R
    return m


def mult(c, t):
    R = [8.5, 9.5, 10.5, 11.5, 12.5, 13.5][t]
    body = hexmask(16, 16, R)
    c.fill(body, 0.16 + 0.04 * t + 0.45 * lin(6, 4, 26, 28), "lime")
    for i in range(1 + t // 2):  # nested rims
        edge = hexmask(16, 16, R - 1.2 - i * 3.2) & ~hexmask(16, 16, R - 2.4 - i * 3.2)
        c.set(edge & body, RAMPS["lime"][4 if i == 0 else 3])
    k = R * 0.42
    d1 = np.abs(xx - yy) < 1.0 + t * 0.2
    d2 = np.abs((xx + yy) - 31) < 1.0 + t * 0.2
    box = rect(16 - k, 16 - k, 16 + k, 16 + k)
    c.set(body & box & (d1 | d2), RAMPS["wh"][4])
    for i in range(t // 2 + (1 if t == 5 else 0)):  # bright studs on the corners
        a = math.pi / 3 * i + math.pi / 6
        c.set(disc(16 + math.cos(a) * (R - 2), 16 + math.sin(a) * (R - 2), 1.2), RAMPS["lime"][4])
    return c


def reboot(c, t):
    for i in range(1 + t // 2):
        ro = [8, 11, 13.2][i] + (0.8 if t >= 1 and i == 0 else 0)
        ri = ro - (3.0 if i == 0 else 1.6)
        r = np.hypot(xx + .5 - 16, yy + .5 - 17)
        ang = np.degrees(np.arctan2(yy + .5 - 17, xx + .5 - 16))
        gap = 52 - i * 10
        ring = (r <= ro) & (r >= ri) & ~((ang < -90 + gap) & (ang > -90 - gap))
        c.fill(ring, 0.22 + 0.06 * t + 0.5 * lin(6, 6, 26, 28), "mag", outline=(i == 0))
    w = 1.6 + t * 0.25
    c.fill(rect(16 - w, 3 + (5 - t) * 0.0, 16 + w, 15), 0.95, "mag")
    c.set(rect(15.4, 4, 16.6, 14), RAMPS["mag"][4])
    for i in range(max(0, t - 1)):  # sparks that fly off at the higher tiers
        sx, sy = [(4, 6), (27, 7), (3, 26), (28, 25)][i]
        c.set(rect(sx, sy - 1, sx + 1, sy + 2) | rect(sx - 1, sy, sx + 2, sy + 1), RAMPS["mag"][4])
    return c


def ingot(c, ox, oy):
    top = poly([(ox + 2, oy), (ox + 8, oy), (ox + 10, oy + 3), (ox, oy + 3)])
    front = rect(ox, oy + 3, ox + 10, oy + 8)
    c.fill(front, 0.36 + 0.3 * lin(ox, oy + 3, ox + 10, oy + 8), "cu")
    c.fill(top, 0.9, "cu")
    c.set(rect(ox + 2, oy + 4, ox + 4, oy + 5), RAMPS["cu"][4])


def copper(c, t):
    rows = [[1], [2], [2, 1], [3, 1], [3, 2], [3, 2, 1]][t]
    total = 8 + (len(rows) - 1) * 6
    base = int((32 - total) / 2) + (len(rows) - 1) * 6
    for ri, n in enumerate(rows):
        y = base - ri * 6
        x0 = 16 - n * 5
        for k in range(n):
            ingot(c, int(round(x0 + k * 10)), y)
    return c


def wafer(c, cy, dens, shade):
    top = disc(16, cy, 13, 6.6)
    side = (disc(16, cy + 3, 13, 6.6) | rect(3, cy, 29, cy + 3)) & ~top
    c.fill(side, 0.18 + 0.2 * lin(3, 0, 29, 0), "si")
    c.fill(top, shade + 0.35 * lin(4, 20, 26, 6), "si")
    grid = top & disc(16, cy, 11.4, 5.2) & ((((xx + 1) % dens) < 1) | (((yy + 1) % max(3, dens - 1)) < 1))
    c.set(grid, RAMPS["si"][1])


def silicon(c, t):
    n = 1 + t // 2
    dens = [6, 5, 5, 4, 4, 3][t]
    for i in range(n):
        cy = 24 - i * 7 - (3 if n == 1 else 0) + (2 if n == 3 else 0)
        wafer(c, cy, dens, 0.5 + 0.08 * i)
    top = 24 - (n - 1) * 7 - (3 if n == 1 else 0) + (2 if n == 3 else 0)
    for i in range(1 + t):
        c.set(rect(8 + (i * 5) % 16, top - 2 + (i * 3) % 4, 10 + (i * 5) % 16, top - 1 + (i * 3) % 4), RAMPS["si"][4])
    return c


def crystal(c, cx, base, w, h, v):
    l = poly([(cx - w / 2, base - h * 0.72), (cx, base - h), (cx, base), (cx - w / 2, base)])
    r = poly([(cx + w / 2, base - h * 0.72), (cx, base - h), (cx, base), (cx + w / 2, base)])
    c.fill(l, v + 0.12 * lin(0, base - h, 0, base) + 0.12, "qz")
    c.fill(r, v - 0.2 + 0.12 * lin(0, base - h, 0, base), "qz")
    c.set(poly([(cx - 0.2, base - h + 1.5), (cx - w * 0.3, base - h * 0.7), (cx - 0.2, base - h * 0.5)]), RAMPS["qz"][4])


def quartz(c, t):
    spec = [[(16, 29, 10, 22)],
            [(16, 29, 12, 25)],
            [(20, 29, 11, 24), (9, 29, 8, 14)],
            [(16, 29, 12, 27), (7, 29, 8, 15), (25, 29, 8, 12)],
            [(18, 29, 12, 28), (8, 29, 8, 18), (26, 29, 7, 13), (3, 29, 5, 9)],
            [(16, 29, 12, 29), (7, 29, 9, 20), (25, 29, 9, 17), (2, 29, 5, 11), (30, 29, 5, 9)]][t]
    for i in sorted(range(len(spec)), key=lambda k: spec[k][3]):
        cx, base, w, h = spec[i]
        crystal(c, cx, base, w, h, 0.42 + 0.05 * (i % 2))
    return c


def aether(c, t):
    R = [5.5, 6.5, 7.5, 8.5, 9.5, 10.5][t]
    tilts = [0, 62, -62][: 1 + t // 2]
    def ring(tilt, rx, ry):
        a = math.radians(tilt)
        u = (xx + .5 - 16) * math.cos(a) + (yy + .5 - 16) * math.sin(a)
        v = -(xx + .5 - 16) * math.sin(a) + (yy + .5 - 16) * math.cos(a)
        e = (u / rx) ** 2 + (v / ry) ** 2
        return (e <= 1) & (e >= 0.66), v
    rings = [ring(tl, 14.8, 5.2) for tl in tilts]
    orb = disc(16, 16, R)
    for m, v in rings:
        c.fill(m & ~orb & (v < 0), 0.5, "ae", outline=False)
    d = np.hypot(xx + .5 - 12.5, yy + .5 - 12.5) / (R * 1.6)
    c.fill(orb, 1 - d * 1.2 + 0.03 * t, "ae")
    c.set(disc(13, 12.5, 1.6 + t * 0.25), RAMPS["ae"][4])
    for m, v in rings:
        c.fill(m & (v >= 0), 0.88, "ae", outline=False)
    sp = [(4, 4), (27, 5), (26, 27), (5, 26), (16, 2)][: max(0, t)]
    for x, y in sp:
        c.set(rect(x, y - 1, x + 1, y + 2) | rect(x - 1, y, x + 2, y + 1), RAMPS["ae"][4])
    return c


ROWS = [("mult", mult), ("reboot", reboot), ("copper", copper), ("silicon", silicon), ("quartz", quartz), ("aether", aether),
        ("runes", nfi.runes_t), ("starglass", nfi.starglass_t), ("voidsteel", nfi.voidsteel_t), ("chrono", nfi.chrono_t),
        ("nebula", nfi.nebula_t), ("pulsars", nfi.pulsars_t), ("singularity", nfi.singularity_t),
        ("engrams", nfi.engrams_t), ("paradox", nfi.paradox_t), ("origin", nfi.origin_t)]


def main():
    out = HERE.parents[1] / "public/naos/nodefarm"
    out.mkdir(parents=True, exist_ok=True)
    sheet = np.zeros((N * len(ROWS), N * TIERS, 4), np.uint8)
    for r, (_, fn) in enumerate(ROWS):
        for t in range(TIERS):
            sheet[r * N:(r + 1) * N, t * N:(t + 1) * N] = fn(Canvas(), t).img
    im = Image.fromarray(sheet, "RGBA")
    im.save(out / "tiers.png", optimize=True)
    im.save(out / "tiers.webp", lossless=True, quality=100, method=6)
    big = im.resize((im.width * 4, im.height * 4), Image.NEAREST)
    bg = Image.new("RGBA", big.size, (19, 19, 19, 255)); bg.alpha_composite(big)
    bg.save("/tmp/nf-tiers-contact.png")
    print("rows", [n for n, _ in ROWS])


if __name__ == "__main__":
    main()
