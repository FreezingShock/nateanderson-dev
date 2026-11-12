"""Node Farm staged zone art for zones 02 to 04: Amp Bay (Multipliers), Power Room (Reboots), Trace Foundry (Copper).

Follows the zone art contract (docs/node-farm.md, "Zone art"): one sheet per zone, 8 rows (stages) by 6 columns (frames), each cell
288 x 64 art px on a transparent background. Row 0 is the empty bay: a faint backdrop haze. Rows 1 to 7 are cumulative: stage n shows
sprites 1..n, each a bigger and richer version of the zone's 32 px icon (heights about 8, 12, 16, 22, 30, 40, 56 px), plus the
links between them. Sprites sit bottom-anchored on a floor line; the biggest (stage 7) sits left of the top-right 80 x 22 corner,
which stays quiet for the big number, and stages 5 to 7 sit in the right 180 px that phones show.

Same drawing recipe as nodefarm-icons.py (its RAMPS and Bayer threshold): flat shapes shaded by a gradient quantised to a 5-step
ramp through a 4 x 4 Bayer matrix, dark outline, alpha 0 or 255 except the backdrop haze. Each zone uses its own ramp plus up to
two accent ramps and wh/gr. Every effect is periodic in the frame index, so the 6-frame loop is seamless; frame 0 is the still.

Writes public/naos/nodefarm/zone-<stat>.{png,webp}. Run: python3 scripts/naos-art/nodefarm-zone-art.py [stat ...] [--preview DIR]
"""
import importlib.util
import math
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("nodefarm_icons", HERE / "nodefarm-icons.py")
_icons = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_icons)
RAMPS = _icons.RAMPS

W, H = 288, 96          # contract v3: rows 0-31 are headroom backdrop up to the title bar (cut to the panel's height)
HEAD = 32               # sprites live in rows 32-95
TOP = 42                # no sprite pixel above this row
OY = H - 64             # offset of the old 64-row layout
FRAMES, STAGES = 6, 8
GY = H - 3                      # floor line: sprites stand on it
HAZE = 80                    # backdrop alpha
OUT = HERE.parents[1] / "public" / "naos" / "nodefarm"

B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
BAYER = np.tile(B4, (H // 4, W // 4))
yy, xx = np.mgrid[0:H, 0:W].astype(float)


def col(r, i):
    return RAMPS[r][i]


def tri(f):
    """0 -> 1 -> 0 over the loop."""
    p = (f % FRAMES) / FRAMES
    return 1 - abs(2 * p - 1)


def wave(f, k=0.0):
    return 0.5 + 0.5 * math.sin((f / FRAMES + k) * 2 * math.pi)


# ------------------------------------------------------------------ canvas
class Art:
    def __init__(self):
        self.img = np.zeros((H, W, 4), np.uint8)

    def opaque(self):
        return self.img[..., 3] == 255

    def fill(self, mask, v, r, outline=True, lo=0):
        rr = RAMPS[r]
        v = np.broadcast_to(np.asarray(v, float), (H, W))
        idx = np.clip(np.floor(v * (len(rr) - 1) + BAYER * 0.95), lo, len(rr) - 1).astype(int)
        for i, c in enumerate(rr):
            m = mask & (idx == i)
            self.img[m] = (*c, 255)
        if outline:
            self.outline(mask, r)

    def outline(self, mask, r):
        d = np.zeros_like(mask)
        d[1:, :] |= mask[:-1, :]; d[:-1, :] |= mask[1:, :]; d[:, 1:] |= mask[:, :-1]; d[:, :-1] |= mask[:, 1:]
        self.img[d & ~mask] = (*RAMPS[r][0], 255)

    def set(self, mask, c):
        self.img[mask] = (*c, 255)

    def dots(self, mask, c, density, over=False):
        """Sparse dithered pixels (glow, halo, sparks) at full alpha."""
        m = mask & (BAYER < np.broadcast_to(density, (H, W)))
        if not over:
            m &= ~self.opaque()
        self.img[m] = (*c, 255)

    def haze(self, mask, c, density=1.0):
        """Backdrop haze: low alpha, never over existing pixels."""
        m = mask & (BAYER < np.broadcast_to(density, (H, W))) & (self.img[..., 3] == 0)
        self.img[m] = (*c, HAZE)


# ------------------------------------------------------------------ shapes
def rect(x0, y0, x1, y1):
    return (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)


def disc(cx, cy, r, ry=None):
    ry = ry or r
    return ((xx + .5 - cx) / r) ** 2 + ((yy + .5 - cy) / ry) ** 2 <= 1


def ring(cx, cy, r0, r1, sy=1.0):
    d = np.hypot(xx + .5 - cx, (yy + .5 - cy) / sy)
    return (d <= r1) & (d >= r0)


def poly(pts):
    im = Image.new("L", (W * 4, H * 4), 0)
    ImageDraw.Draw(im).polygon([(x * 4, y * 4) for x, y in pts], fill=255)
    return np.asarray(im.resize((W, H), Image.BOX)) > 127


def line(x0, y0, x1, y1, w=1.0):
    dx, dy = x1 - x0, y1 - y0
    L2 = dx * dx + dy * dy or 1
    t = np.clip(((xx + .5 - x0) * dx + (yy + .5 - y0) * dy) / L2, 0, 1)
    return np.hypot(xx + .5 - (x0 + t * dx), yy + .5 - (y0 + t * dy)) <= w / 2


def path_mask(pts, w=1.0):
    m = np.zeros((H, W), bool)
    for a, b in zip(pts, pts[1:]):
        m |= line(a[0], a[1], b[0], b[1], w)
    return m


def lin(x0, y0, x1, y1):
    dx, dy = x1 - x0, y1 - y0
    return np.clip(((xx - x0) * dx + (yy - y0) * dy) / (dx * dx + dy * dy), 0, 1)


def hexm(cx, cy, r):
    """Pointy-sided hexagon like the Multiplier icon (flat top and bottom); r = centre to corner."""
    m = np.ones((H, W), bool)
    for k in range(6):
        a = math.pi / 3 * k + math.pi / 6
        m &= ((xx + .5 - cx) * math.cos(a) + (yy + .5 - cy) * math.sin(a)) <= r * 0.866
    return m


def iso(cx, ty, a, b, h):
    T = (cx, ty); R = (cx + a, ty + a / 2); F = (cx + a - b, ty + a / 2 + b / 2); L = (cx - b, ty + b / 2)
    return (poly([T, R, F, L]), poly([L, F, (F[0], F[1] + h), (L[0], L[1] + h)]),
            poly([F, R, (R[0], R[1] + h), (F[0], F[1] + h)]), dict(T=T, R=R, F=F, L=L))


def box(art, cx, ty, a, b, h, r, lit=(0.85, 0.55, 0.25)):
    top, left, right, P = iso(cx, ty, a, b, h)
    art.fill(left, lit[1] + 0.15 * (1 - lin(P["L"][0], P["L"][1], P["F"][0], P["F"][1] + h)), r, outline=False)
    art.fill(right, lit[2] + 0.12 * lin(P["F"][0], P["F"][1], P["R"][0], P["R"][1] + h), r, outline=False)
    art.fill(top, lit[0] + 0.12 * (1 - lin(P["L"][0], 0, P["R"][0], 0)), r, outline=False)
    art.outline(top | left | right, r)
    return P


def pulses(art, pts, f, n, c_head, c_tail, length=2.0, phase=0.0):
    """Bright packets travelling along a polyline; one lap per loop so it repeats cleanly."""
    segs = list(zip(pts, pts[1:]))
    lens = [math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in segs]
    tot = sum(lens)
    for k in range(n):
        d0 = ((f / FRAMES) + k / n + phase) % 1.0 * tot
        for back, c in ((0, c_head), (length, c_tail)):
            d = (d0 - back) % tot
            for (a, b), L in zip(segs, lens):
                if d <= L:
                    t = d / max(L, 1e-6)
                    x, y = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
                    art.set(rect(x - .5, y - .5, x + 1, y + 1), c)
                    break
                d -= L


def floor(art, r, x0=0):
    """Shared backdrop floor: a line and a fading strip under it."""
    art.haze(rect(x0, GY, W, GY + 1), col(r, 1))
    art.haze(rect(x0, GY + 1, W, H), col(r, 0), 0.55)
    # floor seams
    for x in range(int(x0) + 6, W, 12):
        art.haze(line(x, GY + 1, x - 3, H, 1), col(r, 1), 0.8)


# ====================================================================================== 02 AMP BAY, lime (+ cyan, rn)
def hexmod(art, cx, cy, r, f, ph=0.0, detail=0):
    """A Multiplier module: bevelled hex with a bright rim and the X. `detail` 0..6 adds depth, bevel, core, light."""
    k = wave(f, ph)
    if detail >= 2:
        depth = max(1.0, r * 0.22)
        art.fill(hexm(cx, cy + depth, r), 0.1, "lime", outline=False)
    face = hexm(cx, cy, r)
    art.fill(face, 0.2 + 0.4 * (1 - lin(cx - r, cy - r, cx + r, cy + r)), "lime", outline=False)
    inner = hexm(cx, cy, r * (0.74 if r > 6 else 0.6))
    art.fill(face & ~inner, 0.62 + 0.38 * k * (1 if detail else 0.3) + 0.2 * (1 - lin(cx - r, cy - r, cx + r, cy + r)), "lime", outline=False)
    if detail >= 2:
        art.outline(face | hexm(cx, cy + max(1.0, r * 0.22), r), "lime")
    else:
        art.outline(face, "lime")
    if r >= 4:
        bx = rect(cx - r * .48, cy - r * .48, cx + r * .48, cy + r * .48)
        w = max(0.9, r * 0.17)
        x1 = inner & bx & (np.abs((xx + .5 - cx) - (yy + .5 - cy)) < w)
        x2 = inner & bx & (np.abs((xx + .5 - cx) + (yy + .5 - cy)) < w)
        art.set(x1 | x2, col("lime", 4 if k > .45 or detail == 0 else 3))
        if detail >= 3:
            art.set(inner & bx & (np.abs((xx + .5 - cx) - (yy + .5 - cy)) < w * .45) & disc(cx, cy, r * .3), col("wh", 4))
    if 1 <= detail <= 5 and r >= 6:
        a_ = tri(f + detail)
        art.set(hexm(cx, cy, 1.6 + r * .08), col("cyan", 4 if a_ > .5 else 3))
    if detail >= 4:
        # concentric inner rings that step outward
        for j in range(1, 3 + (detail >= 6)):
            s = r * (0.74 - j * 0.14)
            band = hexm(cx, cy, s) & ~hexm(cx, cy, s - 1)
            on = (f + j) % 3 == 0
            art.set(band & ~(rect(cx - r * .48, cy - r * .48, cx + r * .48, cy + r * .48) & (np.abs(np.abs(xx + .5 - cx) - np.abs(yy + .5 - cy)) < r * .17)),
                    col("lime", 4 if on else 2))
    if detail >= 5:
        # specular glint sweeping the rim
        pos = (f / FRAMES) * 4 * r - 2 * r
        g = face & ~inner & (np.abs((xx + .5 - cx) + (yy + .5 - cy) * 0.6 - pos) < 1.3)
        art.set(g, col("wh", 4))


def meter(art, x0, y1, n, f, seed, w=2):
    """Column VU meter, lime to amber at the top, bouncing."""
    rng = np.random.default_rng(seed)
    lv = rng.integers(max(1, n // 3), n + 1, FRAMES)
    art.fill(rect(x0 - 1, y1 - n * 2 - 1, x0 + w + 1, y1 + 1), 0.05, "gr")
    for i in range(n):
        y = y1 - (i + 1) * 2 + 1
        c = "lime" if i < n - 2 else "rn"
        art.set(rect(x0, y, x0 + w, y + 1), col(c, 3 if i < lv[f] else 1))


def lamps(a, pts, f, ramps):
    """Tiny full-colour status lamps on the back wall, each blinking on its own phase."""
    for k, (x, y) in enumerate(pts):
        r = ramps[k % len(ramps)]
        on = (f + k * 2) % FRAMES < 3
        a.set(rect(x, y, x + 1, y + 1), col(r, 4 if on else 2))


def busy(x, y):
    """Contract v1 kept a quiet corner for the big number; v2 stops the art short of it, so nothing is reserved now."""
    return False


def mult_backdrop(a, f):
    floor(a, "lime")
    # cyan carriers and lime harmonics running the full height of the bay
    for j, (y, amp, cyc) in enumerate([(6, 1.5, 6), (OY + 27, 2, 7), (OY + 40, 1.5, 9)]):
        wv = np.sin(xx / W * cyc * 2 * math.pi - j - f / FRAMES * 2 * math.pi) * amp
        a.haze(np.abs(yy + .5 - (y + wv)) < .6, col("cyan", 1))
    # rack rails with lit ports along the wall, one high and one low
    for ry in (OY - 8, OY + 52):
        a.haze(rect(0, ry, W, ry + 1), col("lime", 1))
        a.haze(rect(0, ry, W, ry + 4) & (xx.astype(int) % 5 == 0), col("lime", 0))
        lamps(a, [(x + (ry % 7), ry + 2) for x in range(9, W, 15)], f + ry, ["lime", "cyan", "rn"])
    for j, (y, amp, cyc) in enumerate([(14, 2, 4), (OY + 20, 3, 3), (OY + 34, 2, 5), (OY + 46, 2.5, 4)]):
        wv = np.sin(xx / W * cyc * 2 * math.pi + j) * amp
        a.haze(np.abs(yy + .5 - (y + wv)) < .6, col("lime", 1))
    # honeycomb outline wall, top to floor
    for cy in range(-6, GY - 4, 14):
        for cx in range(6 + ((cy + 14) // 14 % 2) * 12, W, 24):
            if (cx * 7 + cy * 3) % 5 < 3:
                a.haze(hexm(cx, cy, 6) & ~hexm(cx, cy, 5), col("lime", 1), 0.7)


MULT = [  # (cx, cy-from-floor, r) per stage; heights ~ 8, 12, 16, 22, 30, 40, 56
    (18, 4, 4.4), (38, 6, 6.6), (62, 8, 8.8), (90, 11, 12), (256, 15, 16), (204, 20, 21), (142, 24, 26),
]


def mult_stage(stage, f):
    a = Art()
    if stage >= 1:
        # bus line along the floor joining every module, packets flow toward the biggest
        xs = [MULT[i][0] for i in range(stage)]
        if len(xs) > 1:
            pts = [(x, GY - 1) for x in sorted(xs)]
            a.set(path_mask(pts, 1), col("lime", 1))
            pulses(a, pts, f, len(xs), col("lime", 4), col("lime", 3))
    for i in range(stage):
        cx, up, r = MULT[i]
        cy = GY - up - 1
        if i >= 3:
            # stand under the hex
            a.fill(poly([(cx - r * .5, GY), (cx + r * .5, GY), (cx + r * .3, cy + r * .6), (cx - r * .3, cy + r * .6)]), 0.25, "gr")
        if i == 6:
            # pulse rings radiating from the reactor, behind it
            for k in range(2):
                p = (f / FRAMES + k / 2) % 1
                rr = r + 2 + p * 14
                a.dots(ring(cx, cy, rr - .8, rr + .2, 0.8) & (yy < GY), col("lime", 3 if p < .5 else 2), 0.9 - p * 0.7)
            a.dots(disc(cx, cy, r * 1.5, r * 1.2) & (yy < GY), col("lime", 1), 0.2)
        if i == 5:
            # six petal cells around the module (honeycomb), lit in a chase
            for k in range(6):
                ang = math.pi / 3 * k
                px, py = cx + math.cos(ang) * r * 1.42, cy + math.sin(ang) * r * 1.42
                if py + 5 > GY:
                    continue
                a.set(line(cx, cy, px, py, 1.2), col("lime", 1))
                on = (f % 6) == k
                a.fill(hexm(px, py, 5), 0.85 if on else 0.3, "lime")
                a.set(hexm(px, py, 2.2), col("cyan", 4) if on else col("lime", 1))
        hexmod(a, cx, cy, r, f, ph=i * 0.17, detail=i)
        if i == 6:
            # cyan core where the X crosses, breathing
            a.fill(hexm(cx, cy, 4.5 + tri(f) * 1.5), 0.6 + 0.4 * tri(f), "cyan")
            a.set(hexm(cx, cy, 1.6), col("wh", 4))
        if i == 4:
            meter(a, cx - r - 6, GY - 1, 7, f, 11)
            meter(a, cx + r + 3, GY - 1, 5, f, 12)
        if i == 6:
            # cyan status strip and amber meters on the plinth
            meter(a, cx - r - 10, GY - 1, 9, f, 21)
            meter(a, cx - r - 6, GY - 1, 11, f, 22)
            meter(a, cx + r + 4, GY - 1, 10, f, 23)
            meter(a, cx + r + 8, GY - 1, 8, f, 24)
            for k in range(5):
                on = (f + k) % 3 == 0
                a.set(rect(cx - 6 + k * 3, GY - 3, cx - 4 + k * 3, GY - 2), col("cyan", 4 if on else 2))
            # signal wave threading from the reactor to the right modules
            ph = f / FRAMES * 2 * math.pi
            span = (xx > cx + r + 12) & (xx < 280)
            wv = GY - 34 + np.sin((xx - cx) / 9 - ph) * 3
            a.dots(span & (np.abs(yy + .5 - wv) < .7), col("cyan", 3), 1.0)
    return a


# ====================================================================================== 03 POWER ROOM, mag (+ rn, wh)
def power(art, cx, cy, r, f, detail=0, ph=0.0):
    """The Reboot glyph: a ring open at the top with a bar through the gap."""
    d = np.hypot(xx + .5 - cx, yy + .5 - cy)
    ang = np.degrees(np.arctan2(yy + .5 - cy, xx + .5 - cx))
    gap = (ang < -55) & (ang > -125)
    th = max(1.5, r * 0.36)
    rm = (d <= r) & (d >= r - th) & ~gap
    art.fill(rm, 0.25 + 0.55 * (1 - lin(cx - r, cy - r, cx + r, cy + r)), "mag")
    bar = rect(cx - th * .5, cy - r - th * .35, cx + th * .5, cy + r * 0.05)
    art.fill(bar, 0.95, "mag")
    art.set(rect(cx - th * .2, cy - r - th * .1, cx + th * .25, cy - r * .1), col("mag", 4))
    if detail >= 2:
        # a bright charge segment running around the ring
        a0 = (f / FRAMES) * 360 + ph * 360
        seg = rm & (np.abs(((ang - a0 + 180) % 360) - 180) < 26)
        art.set(seg, col("mag", 4))
    if detail >= 4:
        art.set(rm & (d >= r - 1) & (np.abs(((ang + 160) % 360) - 180) < 40), col("wh", 4))
    return rm


def spark4(art, x, y, big):
    arm = 2 if big else 1
    for dd in range(-arm, arm + 1):
        art.set(rect(x + dd, y, x + dd + 1, y + 1) | rect(x, y + dd, x + 1, y + dd + 1), col("wh", 4) if abs(dd) < arm or not big else col("mag", 4))


def bolt(art, x0, y0, x1, y1, f, seed, halo=True):
    rng = np.random.default_rng(seed * 101 + f)
    n = 5
    pts = [(x0, y0)] + [(x0 + (x1 - x0) * i / n + rng.uniform(-1.5, 1.5), y0 + (y1 - y0) * i / n + rng.uniform(-2.5, 2.5)) for i in range(1, n)] + [(x1, y1)]
    if halo:
        art.dots(path_mask(pts, 3.4), col("mag", 2), 0.4, over=False)
    art.set(path_mask(pts, 1), col("wh", 4))


def hazard(art, x0, x1, y0, y1):
    m = rect(x0, y0, x1, y1)
    art.set(m & (((xx - yy) // 2) % 2 == 0), col("rn", 3))
    art.set(m & (((xx - yy) // 2) % 2 == 1), col("gr", 0))


def cell_bar(art, x0, y1, w, n, f, ph):
    """Charge column that fills over the loop."""
    art.fill(rect(x0 - 1, y1 - n * 2 - 2, x0 + w + 1, y1 + 1), 0.1, "gr")
    lvl = int(round((f / (FRAMES - 1)) * n + ph * n)) % (n + 1)
    for i in range(n):
        y = y1 - (i + 1) * 2
        c = "mag" if i < n - 2 else "rn"
        art.set(rect(x0, y, x0 + w, y + 1), col(c, 3 if i < lvl else 1))


def reboot_backdrop(a, f):
    floor(a, "mag")
    # breaker panels in two banks on the wall, with amber/cyan status lamps
    for by in (OY - 26, OY + 30):
        for x in range(4 + (by % 18), W, 36):
            a.haze(rect(x + 6, by, x + 24, by + 16) & ~rect(x + 7, by + 1, x + 23, by + 15), col("mag", 1))
            a.haze(rect(x + 8, by + 3, x + 22, by + 13) & ((xx.astype(int) % 3) == 0), col("mag", 0))
        lamps(a, [(x + 14, by + 18) for x in range(4 + (by % 18), W, 36)], f + by, ["rn", "cyan", "mag"])
    # conduit pipes along the back wall, risers up to the ceiling
    for y in (2, OY - 6, OY + 16, OY + 22):
        a.haze(rect(0, y, W, y + 1), col("mag", 1))
    for x in range(10, W, 36):
        a.haze(rect(x, 0, x + 2, GY), col("mag", 1), 0.5)
        a.haze(rect(x - 1, OY + 14, x + 3, OY + 24), col("mag", 0))
    # hazard band under the ceiling and diagonal hazard wash along the floor
    a.haze(rect(0, OY - 3, W, OY - 1) & (((xx - yy) // 3) % 2 == 0), col("rn", 1))
    a.haze(rect(0, GY + 1, W, H) & (((xx - yy) // 3) % 2 == 0), col("rn", 1), 0.7)


REBOOT = [(16, 4), (36, 6), (60, 8), (90, 11), (256, 15), (204, 20), (142, 21)]  # (cx, radius-ish)


def reboot_stage(stage, f):
    a = Art()
    # power bus along the floor
    if stage >= 2:
        xs = sorted(REBOOT[i][0] for i in range(stage))
        pts = [(x, GY - 1) for x in xs]
        a.set(path_mask(pts, 1), col("mag", 1))
        pulses(a, pts, f, stage, col("mag", 4), col("mag", 3))
    for i in range(stage):
        cx, r = REBOOT[i]
        if i <= 2:
            cy = GY - r - 1
            power(a, cx, cy, r, f, detail=i, ph=i * .2)
            if i == 2:
                spark4(a, cx - r - 2, cy - r, f % 3 == 0)
                spark4(a, cx + r + 2, cy - r + 2, f % 3 == 1)
        elif i == 3:
            # console: the glyph on a lit panel with a hazard base
            cab = rect(cx - 10, GY - 22, cx + 10, GY - 2)
            a.fill(cab, 0.25 + 0.3 * (1 - lin(cx - 10, GY - 22, cx + 10, GY)), "gr")
            scr = rect(cx - 7, GY - 19, cx + 7, GY - 7)
            a.set(scr, col("mag", 0))
            a.set(scr & ((yy.astype(int) + f) % 3 == 0), (40, 8, 22))
            power(a, cx, GY - 13, 4.6, f, detail=2, ph=.4)
            for k in range(3):
                a.set(rect(cx - 7 + k * 3, GY - 5, cx - 5 + k * 3, GY - 4), col("rn", 4) if (f + k) % 3 == 0 else col("mag", 2))
            a.set(rect(cx + 4, GY - 5, cx + 7, GY - 4), col("cyan", 3 if f % 2 else 1))
            hazard(a, cx - 12, cx + 12, GY - 2, GY)
        elif i == 4:
            # battery tower: charge column under a glyph
            cell_bar(a, cx - 3, GY - 1, 6, 8, f, .3)
            cell_bar(a, cx + 7, GY - 1, 4, 6, f, .6)
            cell_bar(a, cx - 11, GY - 1, 4, 5, f, .1)
            power(a, cx, GY - 26, 8, f, detail=3, ph=.1)
            if f % 2 == 0:
                spark4(a, cx + 11, GY - 28, True)
        elif i == 5:
            # coil pylon: stacked rings with the glyph as its head, arcing to the ground
            for j in range(6):
                y = GY - 3 - j * 3.3
                rw = 7 - j * 0.6
                a.fill(disc(cx, y, rw, 1.7), 0.35 + 0.4 * ((j + f) % 2), "mag" if j % 2 else "gr")
            hazard(a, cx - 10, cx + 10, GY - 2, GY)
            power(a, cx, GY - 32, 9, f, detail=4, ph=.6)
            if f % 3 != 2:
                bolt(a, cx + 9, GY - 32, cx + 18, GY - 1, f, 5)
            if f % 3 != 0:
                bolt(a, cx - 9, GY - 30, cx - 17, GY - 1, f, 6)
        elif i == 6:
            # the power core: big glyph inside a stator ring, on a hazard plinth, arcs to the coil and battery
            cy = GY - r - 6
            a.dots(disc(cx, cy, r * 1.6, r * 1.15) & (yy < GY - 4), col("mag", 1), 0.22)
            a.fill(poly([(cx - r * .8, GY), (cx + r * .8, GY), (cx + r * .5, cy + r * .7), (cx - r * .5, cy + r * .7)]), 0.25, "gr")
            hazard(a, cx - r * .8, cx + r * .8, GY - 3, GY)
            for k in range(16):
                ang = (k / 16 + f / FRAMES / 8) * 2 * math.pi
                x, y = cx + math.cos(ang) * (r + 3.5), cy + math.sin(ang) * (r + 3.5)
                if y < GY - 4:
                    a.set(rect(x - .5, y - .5, x + 1, y + 1), col("mag", 4 if k % 4 == f % 4 else 2))
            power(a, cx, cy, r, f, detail=6)
            # inner core glow
            a.dots(disc(cx, cy + 2, r * .45), col("mag", 2), 0.5 + 0.3 * tri(f))
            if f % 2 == 0:
                bolt(a, cx + r + 3, cy - 4, REBOOT[5][0] - 9, GY - 33, f, 9)
            else:
                bolt(a, cx - r - 3, cy + 2, REBOOT[3][0] + 8, GY - 22, f, 10)
    return a


# ====================================================================================== 04 TRACE FOUNDRY, cu (+ red, rn)
def ingot(art, x0, y1, w, f=0, ph=0.0, shine=False):
    """One copper bar seen from the front like the icon: a front face, a lighter bevelled top and a little end face."""
    h = max(2.0, round(w * 0.36))
    d = max(1.0, round(h * 0.6))
    front = rect(x0, y1 - h, x0 + w, y1)
    top = poly([(x0, y1 - h), (x0 + w, y1 - h), (x0 + w + d - .01, y1 - h - d), (x0 + d, y1 - h - d)])
    end = poly([(x0 + w, y1 - h), (x0 + w + d, y1 - h - d), (x0 + w + d, y1 - d), (x0 + w, y1)])
    art.fill(front, 0.5 + 0.25 * (1 - lin(0, y1 - h, 0, y1)), "cu", outline=False)
    art.fill(top, 0.88, "cu", outline=False)
    art.fill(end, 0.3, "cu", outline=False)
    art.outline(front | top | end, "cu")
    if w >= 8:
        # stamped mark and a speck of shine like the tier sprites
        art.set(rect(x0 + 2, y1 - h + 1, x0 + 3, y1 - h + 2), col("cu", 4))
        art.set(rect(x0 + w - 3, y1 - 2, x0 + w - 2, y1 - 1), col("cu", 1))
    if shine:
        pos = ((f / FRAMES + ph) % 1) * (w + 12) - 6
        art.set(top & (np.abs(xx - x0 - pos) < 1.1), col("wh", 4))
    return h, d


def pile(art, cx, by, w, rows, f=0, shine=False):
    """Pyramid of bars, bottom-centre at (cx, by), each row half a bar in."""
    h = max(2.0, round(w * 0.36))
    for r in range(rows):
        n = rows - r
        for i in range(n):
            x0 = cx - n * (w + 1) / 2 + i * (w + 1) + r * 0.0
            ingot(art, round(x0), by - r * h, w, f, ph=(i + r) * .23, shine=shine and r == rows - 1)


def spool(art, cx, cy, r, f):
    rim_l = disc(cx - r * .55, cy, r * .3, r)
    body = rect(cx - r * .55, cy - r * .78, cx + r * .55, cy + r * .78)
    art.fill(body, 0.55 + 0.3 * (1 - lin(0, cy - r, 0, cy + r)), "cu", outline=False)
    art.set(body & (((yy - f / FRAMES * 2) % 2) < 1), col("cu", 2))
    art.fill(disc(cx + r * .55, cy, r * .3, r), 0.3, "gr")
    art.fill(rim_l, 0.5 + 0.3 * (1 - lin(cx - r, cy - r, cx, cy + r)), "gr")
    art.set(disc(cx - r * .55, cy, r * .1, r * .25), col("gr", 0))
    art.outline(body | rim_l | disc(cx + r * .55, cy, r * .3, r), "cu")
    # loose wire running off the spool to the floor
    art.set(path_mask([(cx + r * .5, cy + r * .6), (cx + r * .9, GY - 1)], 1), col("cu", 3))


def crucible(art, cx, by, w, h, f, tilt=0.0):
    """Copper-banded crucible with a molten top; tilt > 0 leans it right to pour. Returns the lip point."""
    sk = tilt * h
    body = poly([(cx - w / 2 + sk, by - h), (cx + w / 2 + sk, by - h), (cx + w * .36, by), (cx - w * .36, by)])
    art.fill(body, 0.2 + 0.4 * (1 - lin(cx - w / 2, 0, cx + w / 2, 0)), "gr", outline=False)
    for k in (0.3, 0.7):
        y = by - h * k
        art.set(body & rect(0, y, W, y + 1), col("cu", 3))
    art.outline(body, "gr")
    melt = poly([(cx - w / 2 + sk + 1.5, by - h - 1), (cx + w / 2 + sk - 1, by - h - 1 - tilt * 3), (cx + w / 2 + sk - 1, by - h + 1), (cx - w / 2 + sk + 1.5, by - h + 1)])
    art.fill(melt, 0.72 + 0.25 * tri(f), "red", outline=False)
    art.set(melt & (BAYER < 0.15 + 0.25 * tri(f)), col("rn", 4))
    art.dots(disc(cx + sk, by - h - 3, w * .8, 6) & (yy < by - h - 1), col("red", 2), 0.12 + 0.15 * tri(f))
    return (cx + w / 2 + sk, by - h - tilt * 3)


def sparks(art, cx, cy, f, n, seed, spread=8.0):
    rng = np.random.default_rng(seed)
    for k in range(n):
        vx, vy = rng.uniform(-1, 1) * spread, rng.uniform(-1.3, -0.5) * spread
        t = ((f / FRAMES) + k / n) % 1
        x, y = cx + vx * t, cy + vy * t + 12 * t * t
        if y < GY:
            art.set(rect(x, y, x + 1, y + 1), col("rn", 4) if t < .35 else col("red", 3 if t < .7 else 2))


def furnace(art, cx, f):
    """Stage 7: a squat foundry with a chimney, a molten mouth and a pour channel."""
    s = 22
    P = box(art, cx, GY - 40, s, s * .8, 25, "gr", lit=(0.55, 0.35, 0.15))
    L, F, R = P["L"], P["F"], P["R"]
    # copper roof and riveted copper plates on the shaded side
    top = iso(cx, GY - 40, s, s * .8, 25)[0]
    art.fill(top, 0.55 + 0.3 * (1 - lin(L[0], 0, R[0], 0)), "cu", outline=False)
    rside = iso(cx, GY - 40, s, s * .8, 25)[2]
    art.fill(rside & ((xx.astype(int) % 7) != 0), 0.22 + 0.15 * lin(F[0], 0, R[0], 0), "cu", outline=False, lo=1)
    for k in range(4):
        x = F[0] + 3 + k * 6
        y = F[1] - (x - F[0]) * .5 + 4
        art.set(rect(x, y, x + 1, y + 1), col("cu", 4))
        art.set(rect(x, y + 16, x + 1, y + 17), col("cu", 4))
    art.outline(top | rside | iso(cx, GY - 40, s, s * .8, 25)[1], "gr")
    for k in (0.3, 0.75):
        y = L[1] + 25 * k
        art.set(path_mask([(L[0], y), (F[0], y + (F[1] - L[1])), (R[0], y + (R[1] - F[1]) + (F[1] - L[1]))], 1.2), col("cu", 3))
    # chimney on the back corner
    box(art, cx + 6, GY - 50, 4, 3, 10, "gr", lit=(0.6, 0.4, 0.2))
    art.set(rect(cx + 5, GY - 50, cx + 8, GY - 49), col("red", 3 if f % 2 else 2))
    # mouth on the left face, flickering
    mx0, mx1 = L[0] + 4, F[0] - 4
    y0 = L[1] + 9
    mouth = poly([(mx0, y0 + (mx0 - L[0]) * .5), (mx1, y0 + (mx1 - L[0]) * .5), (mx1, y0 + (mx1 - L[0]) * .5 + 9), (mx0, y0 + (mx0 - L[0]) * .5 + 9)])
    art.fill(mouth, 0.55 + 0.35 * (1 - lin(0, y0, 0, y0 + 14)) + 0.12 * wave(f), "red", outline=False)
    art.set(mouth & (BAYER < 0.12 + 0.12 * wave(f, .25)), col("rn", 4))
    art.dots(disc((mx0 + mx1) / 2, y0 + 12, 20, 9) & (yy < GY), col("red", 1), 0.18 + 0.1 * tri(f))
    # molten channel from the mouth down to the floor trace
    chx = (mx0 + mx1) / 2 - 3
    ch_top = y0 + (chx - L[0]) * .5 + 11
    chan = rect(chx, ch_top, chx + 2, GY)
    art.set(chan, col("red", 2))
    art.set(chan & ((yy.astype(int) - f * 2) % 4 < 2), col("rn", 4))
    # smoke from the chimney, drifting into the quiet corner only as haze-dark puffs
    for k in range(3):
        p = (f / FRAMES + k / 3) % 1
        art.dots(disc(cx + 6 - p * 8, GY - 52 - p * 4, 1.5 + p * 2), col("gr", 2 if p < .5 else 1), 0.6 - p * 0.45)
    return P


def copper_backdrop(a, f):
    floor(a, "cu")
    # warm glow seams in the floor and pads that pulse amber
    a.haze(rect(0, GY + 2, W, GY + 3) & ((xx.astype(int) // 6) % 3 == 0), col("red", 1))
    # PCB trace network on the back wall: right-angle runs with pads
    rng = np.random.default_rng(4)
    for k in range(26):
        x = rng.integers(0, W - 40)
        y = rng.integers(3, GY - 8)
        L1 = rng.integers(16, 60)
        d = rng.choice([-1, 1])
        pts = [(x, y), (x + L1, y), (x + L1 + 6, y + 6 * d), (x + L1 + 6 + rng.integers(10, 40), y + 6 * d)]
        if any(busy(px, py) for px, py in pts):
            continue  # keep the number corner clear
        a.haze(path_mask(pts, 1), col("cu", 1) if k % 3 else col("rn", 1))
        for p in (pts[0], pts[-1]):
            a.haze(disc(p[0], p[1], 1.5), col("cu", 1))
        lamps(a, [pts[-1]], f + k, ["rn", "red", "cu"])


COPPER = [(16, 8), (38, 7), (64, 9), (94, 0), (260, 0), (204, 14), (126, 0)]  # (cx, ingot size); 0 = special


def trace_path(stage):
    """The glowing copper trace that ties the built stations together along the floor."""
    xs = sorted(COPPER[i][0] for i in range(stage))
    pts = []
    for j, x in enumerate(xs):
        y = GY - 1 if j % 2 == 0 else GY + 1
        pts += [(x, y)]
    return pts


def copper_stage(stage, f):
    a = Art()
    if stage >= 2:
        pts = trace_path(stage)
        a.set(path_mask(pts, 1), col("cu", 2))
        for p in pts:
            a.set(disc(p[0], p[1], 1.2), col("cu", 3))
        pulses(a, pts, f, stage, col("rn", 4), col("red", 3))
    for i in range(stage):
        cx, s = COPPER[i]
        if i == 0:
            ingot(a, cx - 4, GY, 8)
        elif i == 1:
            pile(a, cx, GY, 7, 2)
        elif i == 2:
            pile(a, cx, GY, 9, 2)
        elif i == 3:
            spool(a, cx, GY - 11, 10, f)
        elif i == 4:
            # crucible pouring into a mould, sparks
            # crucible on a frame, tipped to pour a glowing stream into a bar mould
            a.fill(rect(cx - 14, GY - 16, cx - 12, GY) | rect(cx + 2, GY - 16, cx + 4, GY) | rect(cx - 14, GY - 17, cx + 4, GY - 15), 0.35, "gr")
            lx, ly = crucible(a, cx - 6, GY - 15, 18, 13, f, tilt=0.25)
            stream = rect(lx, ly, lx + 2, GY - 4)
            a.set(stream & ((yy.astype(int) - f) % 3 != 0), col("red", 3))
            a.set(stream & ((yy.astype(int) - f) % 3 == 0), col("rn", 4))
            a.fill(rect(lx - 6, GY - 4, lx + 12, GY), 0.25, "gr")
            a.set(rect(lx - 4, GY - 3, lx + 10, GY - 2), col("red", 3 + (f % 2)))
            a.set(rect(lx - 4, GY - 3, lx - 4 + 2 + f * 2, GY - 2), col("rn", 4))
            sparks(a, lx + 1, GY - 4, f, 7, 7)
        elif i == 5:
            pile(a, cx, GY, s, 5, f, shine=True)
        elif i == 6:
            furnace(a, cx, f)
            sparks(a, cx - 18, GY - 26, f, 5, 9, 6)
    return a


ZONES = {
    "mult": (mult_backdrop, mult_stage),
    "reboot": (reboot_backdrop, reboot_stage),
    "copper": (copper_backdrop, copper_stage),
}


def cell(name, stage, f):
    back, draw = ZONES[name]
    a = draw(stage, f)
    a.img[:TOP] = 0       # sprites (and their glow) stay below row TOP; the headroom is backdrop only
    back(a, f)            # haze only fills empty pixels, so it sits behind the art
    return a.img


def sheet(name):
    out = np.zeros((STAGES * H, FRAMES * W, 4), np.uint8)
    for s in range(STAGES):
        for f in range(FRAMES):
            out[s * H:(s + 1) * H, f * W:(f + 1) * W] = cell(name, s, f)
    return Image.fromarray(out, "RGBA")


def preview(name, im, d, scale=3):
    panel = (17, 19, 21, 255)
    st = Image.new("RGBA", (W, H * STAGES), panel)
    st.alpha_composite(im.crop((0, 0, W, H * STAGES)))
    st.resize((W * scale, H * STAGES * scale), Image.NEAREST).save(d / f"{name}-stages.png")
    frames = []
    for f in range(FRAMES):
        b = Image.new("RGBA", (W, H), panel)
        b.alpha_composite(im.crop((f * W, 7 * H, (f + 1) * W, 8 * H)))
        frames.append(b.resize((W * scale, H * scale), Image.NEAREST).convert("RGB"))
    frames[0].save(d / f"{name}-s7.gif", save_all=True, append_images=frames[1:], duration=167, loop=0)


def main():
    args = sys.argv[1:]
    pdir = None
    if "--preview" in args:
        pdir = Path(args[args.index("--preview") + 1]); pdir.mkdir(parents=True, exist_ok=True)
    names = [n for n in args if n in ZONES] or list(ZONES)
    for name in names:
        im = sheet(name)
        if pdir:
            preview(name, im, pdir)
            continue
        png, webp = OUT / f"zone-{name}.png", OUT / f"zone-{name}.webp"
        im.save(png, optimize=True)
        im.save(webp, lossless=True, method=6, quality=100)
        kb = (png.stat().st_size / 1024, webp.stat().st_size / 1024)
        print(f"{name}: {im.size} png {kb[0]:.0f} KB webp {kb[1]:.0f} KB")
        assert kb[1] <= 120 and kb[0] <= 300, f"{name} over the size budget"


if __name__ == "__main__":
    main()
