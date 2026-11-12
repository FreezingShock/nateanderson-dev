"""Node Farm era scenery for the six zones past Chrono, drawn in colour and in layers.

Eras 9..14: 9 Nursery (Cloud Deck, Nebula), 10 Beacon (Beacon Spire, Pulsars), 11 Horizon (Event Horizon, Singularity),
12 Archive (Engram Archive, Engrams), 13 Mirror (Mirror Stair, Paradox), 14 Root (Root Chamber, Origin).

The first nine eras (nodefarm-scenes.py) are one flat two-tone image each. These are built as layers so the ground can move:
  scene-<n>-far   480 x 270, the sky or back wall. The page drifts it sideways on the compositor (parallax behind the near layer).
  scene-<n>-near  480 x 270, the landscape. Opaque dark fills, so the far layer never shows through solid shapes.
  scene-<n>-fx    480 x 270 x FRAMES stacked top to bottom: the moving bits (twinkles, beams, pulses), mostly transparent.
  scene-<n>       far + near + fx frame 0 flattened, for the surfaces that show one still image (standby report, Ascend).
  detail-<n>      360 x 144 x FRAMES stacked: the close-up for the rail window, the same world drawn larger, animated.

Every piece tiles sideways without a seam: shapes are drawn in world coordinates on a 480-wide loop (discs, lines and
gradients measure distance around the loop, polygons are drawn three times), and the noise is periodic.

Colour: flat shapes shaded through the 4x4 Bayer threshold into the five-step ramps of nodefarm-icons.py, like the zone
panel art, so the new eras read as the same family as their zone sprites. Each era keeps to its zone's ramp plus a couple
of accents. Keep the busy parts below row 70: the page fades the top of the stage out.

Run:  python3 scripts/naos-art/nodefarm-scenes-deep.py           (all six)
      python3 scripts/naos-art/nodefarm-scenes-deep.py 9 12       (just those eras)
Then run node scripts/nodefarm/stamp-art.mjs so the CSS picks up the new files.
Set NF_PREVIEW_DIR to also write an enlarged contact sheet per era there.
"""
import importlib.util
import math
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "public/naos/nodefarm"
_spec = importlib.util.spec_from_file_location("nodefarm_icons", HERE / "nodefarm-icons.py")
_icons = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_icons)
RAMPS = _icons.RAMPS
hexc = _icons.hexc

WW, WH = 480, 270  # world size (the scene tile)
HOR = 188          # horizon row, same as the older eras
FRAMES = 8         # fx loop length; the CSS steps through them
DW, DH = 360, 144  # rail window close-up
TAU = math.tau
_B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 - 0.5


def hsh(*a):
    h = 2166136261
    for v in a:
        h = ((h ^ (int(v) & 0xFFFFFFFF)) * 16777619) & 0xFFFFFFFF
    return h


def rnd(*a):
    return (hsh(*a) % 100003) / 100003.0


# ---------------------------------------------------------------------------------------------------------------------
# View: maps output pixels to world coordinates (scale s, top-left world point ox, oy). Shapes come back as boolean masks.
# ---------------------------------------------------------------------------------------------------------------------
class View:
    def __init__(self, w, h, s=1.0, ox=0.0, oy=0.0, wrap=True):
        self.w, self.h, self.s, self.ox, self.oy, self.wrap = w, h, s, ox, oy, wrap
        py, px = np.mgrid[0:h, 0:w].astype(float)
        self.wx = ox + (px + 0.5) / s
        self.wy = oy + (py + 0.5) / s
        self.bayer = np.tile(_B4, (h // 4 + 1, w // 4 + 1))[:h, :w]

    def dx(self, cx):
        d = self.wx - cx
        return (d + WW / 2) % WW - WW / 2 if self.wrap else d

    def disc(self, cx, cy, r, ry=None):
        ry = ry or r
        return (self.dx(cx) / r) ** 2 + ((self.wy - cy) / ry) ** 2 <= 1

    def ring(self, cx, cy, r, w=1.0, ry=None):
        ry = ry or r
        d = np.hypot(self.dx(cx) / r, (self.wy - cy) / ry) * r
        return np.abs(d - r) <= max(w, 1 / self.s) / 2 + 0.5 / self.s * 0

    def rect(self, x0, y0, x1, y1):
        if self.wrap:
            d = (self.wx - x0) % WW
            return (d < (x1 - x0)) & (self.wy >= y0) & (self.wy < y1)
        return (self.wx >= x0) & (self.wx < x1) & (self.wy >= y0) & (self.wy < y1)

    def line(self, x0, y0, x1, y1, w=1.0):
        w = max(w, 1.0 / self.s)
        ddx, ddy = x1 - x0, y1 - y0
        L2 = ddx * ddx + ddy * ddy or 1
        rx = self.dx(x0)
        ry = self.wy - y0
        t = np.clip((rx * ddx + ry * ddy) / L2, 0, 1)
        return (rx - t * ddx) ** 2 + (ry - t * ddy) ** 2 <= (w / 2) ** 2

    def path(self, pts, w=1.0):
        m = np.zeros((self.h, self.w), bool)
        for (a, b), (c, d) in zip(pts, pts[1:]):
            m |= self.line(a, b, c, d, w)
        return m

    def poly(self, pts, ss=3):
        shifts = (-WW, 0, WW) if self.wrap else (0,)
        im = Image.new("L", (self.w * ss, self.h * ss), 0)
        dr = ImageDraw.Draw(im)
        for sh in shifts:
            dr.polygon([((x + sh - self.ox) * self.s * ss, (y - self.oy) * self.s * ss) for x, y in pts], fill=255)
        return np.asarray(im.resize((self.w, self.h), Image.BOX)) > 127

    def lin(self, x0, y0, x1, y1):
        ddx, ddy = x1 - x0, y1 - y0
        return np.clip((self.dx(x0) * ddx + (self.wy - y0) * ddy) / (ddx * ddx + ddy * ddy or 1), 0, 1)

    def vgrad(self, y0, y1):
        return np.clip((self.wy - y0) / (y1 - y0), 0, 1)

    def radial(self, cx, cy, r, ry=None):
        ry = ry or r
        return np.clip(1 - np.hypot(self.dx(cx) / r, (self.wy - cy) / ry), 0, 1)

    def dist(self, cx, cy):
        return np.hypot(self.dx(cx), self.wy - cy)

    def angle(self, cx, cy):
        return np.arctan2(self.wy - cy, self.dx(cx))

    def sample(self, field):
        """Bilinear sample of a periodic world field (WH x WW array) at this view's world points."""
        fx = (self.wx - 0.5) % WW
        fy = np.clip(self.wy - 0.5, 0, WH - 1.001)
        x0, y0 = np.floor(fx).astype(int), np.floor(fy).astype(int)
        tx, ty = fx - x0, fy - y0
        x1 = (x0 + 1) % WW
        y1 = np.minimum(y0 + 1, WH - 1)
        return (field[y0, x0] * (1 - tx) * (1 - ty) + field[y0, x1] * tx * (1 - ty) + field[y1, x0] * (1 - tx) * ty + field[y1, x1] * tx * ty)

    def px(self, x, y, size=1.0):
        """A single world point as a mask (at least one output pixel)."""
        r = max(size, 1.0 / self.s) / 2
        return (np.abs(self.dx(x)) < r + 1e-6) & (np.abs(self.wy - y) < r + 1e-6) if self.s <= 1 else \
            (np.abs(self.dx(x + 0.5)) < r) & (np.abs(self.wy - (y + 0.5)) < r)


def noise(seed, scale=40.0, octaves=4, rough=0.55, stretch=1.0):
    """Periodic (in x) fractal value noise in 0..1 on the WH x WW world grid. scale = size of the biggest blobs in world px;
    stretch > 1 makes them wider than tall."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:WH, 0:WW].astype(float)
    acc = np.zeros((WH, WW))
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        cx = max(2, round(WW / (scale * stretch / 2 ** o)))     # whole cells across, so it wraps
        cw = WW / cx
        ch = scale / 2 ** o
        cy = int(math.ceil(WH / ch)) + 2
        g = rng.random((cy, cx))
        gx, gy = x / cw, y / ch
        x0, y0 = np.floor(gx).astype(int), np.floor(gy).astype(int)
        tx, ty = gx - x0, gy - y0
        tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
        x1 = (x0 + 1) % cx
        x0 %= cx
        a = g[y0, x0] * (1 - tx) + g[y0, x1] * tx
        b = g[y0 + 1, x0] * (1 - tx) + g[y0 + 1, x1] * tx
        acc += amp * (a * (1 - ty) + b * ty)
        tot += amp
        amp *= rough
    acc /= tot
    lo, hi = np.percentile(acc, 2), np.percentile(acc, 98)
    return np.clip((acc - lo) / (hi - lo), 0, 1)


# ---------------------------------------------------------------------------------------------------------------------
# Layer: an RGBA image painted with ramp shades.
# ---------------------------------------------------------------------------------------------------------------------
class Layer:
    def __init__(self, v):
        self.v = v
        self.img = np.zeros((v.h, v.w, 4), np.uint8)

    def fill(self, mask, val, ramp, dither=0.9, lo=0, hi=4, solid=True):
        """Shade mask with val (0 dark .. 1 light) quantised through Bayer into ramp shades lo..hi."""
        r = RAMPS[ramp]
        val = np.broadcast_to(np.asarray(val, float), mask.shape)
        idx = np.clip(np.floor(lo + val * (hi - lo) + 0.5 + self.v.bayer * dither), lo, hi).astype(int)
        for i in range(lo, hi + 1):
            m = mask & (idx == i)
            self.img[m] = (*r[i], 255)

    def speckle(self, mask, dens, ramp, shade, extra_dither=1.0):
        """Ordered-dither dots: lit where dens beats the Bayer threshold. Transparent elsewhere (for haze and gas)."""
        dens = np.broadcast_to(np.asarray(dens, float), mask.shape)
        m = mask & (dens > (self.v.bayer + 0.5) * extra_dither)
        self.img[m] = (*RAMPS[ramp][shade], 255)

    def gas(self, dens, ramp, lo=0, hi=3, mask=None):
        """Nebula-style gas: transparent where thin, dithered dots that step up the ramp where thick."""
        if mask is None:
            mask = np.ones(dens.shape, bool)
        b = self.v.bayer + 0.5
        on = mask & (dens > b)
        lvl = np.clip(np.floor(lo + (dens * 1.25 - 0.15) * (hi - lo) + (b - 0.5) * 0.9 + 0.5), lo, hi).astype(int)
        r = RAMPS[ramp]
        for i in range(lo, hi + 1):
            m = on & (lvl == i)
            self.img[m] = (*r[i], 255)

    def shade(self, mask, ramp, i):
        self.img[mask] = (*RAMPS[ramp][i], 255)

    def col(self, mask, c):
        self.img[mask] = (*hexc(c), 255)

    def clear(self, mask):
        self.img[mask] = 0

    def outline(self, mask, ramp, i, only_empty=False):
        d = np.zeros_like(mask)
        d[1:, :] |= mask[:-1, :]; d[:-1, :] |= mask[1:, :]; d[:, 1:] |= mask[:, :-1]; d[:, :-1] |= mask[:, 1:]
        ring = d & ~mask
        if only_empty:
            ring &= self.img[..., 3] == 0
        self.img[ring] = (*RAMPS[ramp][i], 255)

    def edge_top(self, mask, ramp, i):
        """Light the top edge pixels of a shape (rim light)."""
        up = np.zeros_like(mask)
        up[1:, :] = mask[:-1, :]
        self.img[mask & ~up] = (*RAMPS[ramp][i], 255)

    def star(self, x, y, ramp, i=4, arm=0, arm_shade=None):
        v = self.v
        self.shade(v.px(x, y), ramp, i)
        for k in range(1, arm + 1):
            sh = arm_shade if arm_shade is not None else max(1, i - k)
            for ax, ay in ((k, 0), (-k, 0), (0, k), (0, -k)):
                self.shade(v.px(x + ax, y + ay), ramp, sh)


def over(a, b):
    """b drawn over a (opaque pixels win)."""
    out = a.copy()
    m = b[..., 3] > 0
    out[m] = b[m]
    return out


# ---------------------------------------------------------------------------------------------------------------------
# shared bits
# ---------------------------------------------------------------------------------------------------------------------
def starfield(L, seed, n, y0, y1, ramps, bright=0.12, mask=None):
    v = L.v
    for k in range(n):
        x, y = rnd(seed, k, 1) * WW, y0 + rnd(seed, k, 2) * (y1 - y0)
        rp = ramps[int(rnd(seed, k, 3) * len(ramps))]
        b = rnd(seed, k, 4)
        sh = 4 if b < bright else (3 if b < 0.45 else 2)
        m = v.px(x, y)
        if mask is not None:
            m &= mask
        L.shade(m, rp, sh)
        if b < bright * 0.4 and v.s >= 1:
            L.star(x, y, rp, 4, 1)


def twinkles(L, f, seed, n, y0, y1, ramps, phase_len=3, mask=None, size=1):
    """Stars that light up for a few frames of the loop, each at its own point in the cycle."""
    v = L.v
    for k in range(n):
        x, y = rnd(seed, k, 1) * WW, y0 + rnd(seed, k, 2) * (y1 - y0)
        start = int(rnd(seed, k, 3) * FRAMES)
        t = (f - start) % FRAMES
        if t >= phase_len:
            continue
        rp = ramps[k % len(ramps)]
        m = v.px(x, y)
        if mask is not None:
            m &= mask
        if t == 1 and size:
            L.star(x, y, rp, 4, size)
        else:
            L.shade(m, rp, 3 if t == 0 else 2)


def hills(seed, base, amp, k=(2, 5, 11)):
    r = np.random.default_rng(seed)
    ph = r.random(4) * TAU
    return lambda x: base + amp * np.sin(TAU * k[0] * x / WW + ph[0]) + amp * 0.5 * np.sin(TAU * k[1] * x / WW + ph[1]) + amp * 0.25 * np.sin(TAU * k[2] * x / WW + ph[2])


def below(v, fn):
    return v.wy >= fn(v.wx % WW)


# =====================================================================================================================
# 9 Nursery: an observation deck above a sea of star-nursery cloud. Pink gas with violet and cyan pockets, young stars
# burning inside it, a railed walkway with an observatory dome, lamps, and a telescope.
# =====================================================================================================================
NB_GAS = noise(91, 110, 5, 0.55, 1.7)
NB_GAS2 = noise(92, 55, 4, 0.6, 1.3)
NB_DUST = noise(94, 70, 4, 0.5, 2.2)
NB_SEA = noise(93, 40, 3, 0.5, 1.5)
NB_STARS = [(58, 112), (172, 88), (304, 128), (402, 100)]
NB_PILLARS = [(80, 176, 74, 16), (122, 176, 46, 10), (338, 176, 86, 18)]  # x, base, height, width
DECK = 222


def nursery_far(v):
    L = Layer(v)
    g, g2, dust = v.sample(NB_GAS), v.sample(NB_GAS2), v.sample(NB_DUST)
    band = np.clip(1 - np.abs(v.wy - 128) / 86, 0, 1) ** 0.7          # the gas sits in a broad band across the sky
    lane = np.clip((dust - 0.7) * 3, 0, 0.8)                             # dark dust lanes cut through it
    body = np.clip((g - 0.25) * 1.9, 0, 1) * band * (1 - lane)
    L.gas(body, "qz", 0, 2)                                      # violet body
    pink = np.clip((g * 0.6 + g2 * 0.6 - 0.55) * 2.6, 0, 1) * band * (1 - lane)
    L.gas(pink, "nb", 0, 3)
    core = np.clip((g + g2 * 0.5 - 1.15) * 3, 0, 1) * band * (1 - lane)
    L.gas(core, "nb", 2, 4)                                             # bright cores
    cy = np.clip((g2 - 0.78) * 4, 0, 1) * band * (g < 0.55)
    L.gas(cy * 0.8, "pu", 1, 3)                                         # cyan pockets in the gaps
    starfield(L, 9, 170, 10, HOR - 20, ["wh", "nb", "pu", "sg"])
    for x, y in NB_STARS:                                               # young stars burning in the gas
        L.gas(v.radial(x, y, 14) ** 1.3, "nb", 1, 4)
        L.star(x, y, "wh", 4, 3, 2)
    return L


def nursery_near(v):
    L = Layer(v)
    sea = v.sample(NB_SEA)
    # cloud banks: rows of round tops, lit from above, dark underneath, the front rows brighter
    rows = [(150, 5, "qz", 1, 2), (160, 6, "qz", 1, 3), (172, 7, "nb", 1, 3), (186, 6, "nb", 1, 3), (200, 7, "nb", 2, 4), (236, 6, "nb", 1, 3)]
    for row, (base, amp, rp, lo, hi) in enumerate(rows):
        tops = np.full(v.wx.shape, 1e9 if row < 4 else base + amp + 4.0)
        for k in range(16 + row * 2):
            n = 16 + row * 2
            cx = (k / n + rnd(row, k) * (0.05 if row < 4 else 0.01)) * WW + row * 11
            rr = (9 if row < 4 else 16) + rnd(row, k, 2) * (14 + row * 2)
            cy = base + amp * math.sin(k * 1.7 + row)
            d = np.abs(v.dx(cx))
            top = np.where(d < rr, cy - np.sqrt(np.maximum(rr * rr - d * d, 0)) * 0.5, 1e9)
            tops = np.minimum(tops, top)
        m = (v.wy >= tops)
        shade = np.clip(1 - (v.wy - tops) / 22, 0, 1) ** 1.3 * 0.9 + (sea - 0.5) * 0.35
        L.fill(m, shade, rp, 0.9, 0, hi)
        L.edge_top(m, rp, min(4, hi + 1))
        if row == 2:
            # a cyan lining where the gas catches the starlight, under the second pink row
            L.speckle(m & (v.wy - tops < 3) & (sea > 0.6), 0.6, "pu", 3)
    # the deck: a walkway across the whole tile on a truss, a rail above it
    dk = DECK
    under = v.rect(0, dk + 4, WW, dk + 14)
    L.fill(v.rect(0, dk, WW, dk + 4), 0.45, "gr", 0.6, 0, 2)
    L.shade(v.rect(0, dk, WW, dk + 1), "gr", 4)
    for x in range(0, WW, 8):                                           # truss under the walkway
        L.shade(v.line(x, dk + 4, x + 4, dk + 13, 1) & under, "gr", 1)
        L.shade(v.line(x + 8, dk + 4, x + 4, dk + 13, 1) & under, "gr", 1)
    L.shade(v.rect(0, dk + 13, WW, dk + 14), "gr", 2)
    for x in range(0, WW, 24):                                          # posts
        L.shade(v.rect(x + 2, dk - 14, x + 4, dk), "gr", 2)
        L.shade(v.rect(x + 2, dk - 15, x + 4, dk - 14), "gr", 4)
        L.shade(v.rect(x, dk + 1, x + 1, dk + 4), "gr", 1)
    L.shade(v.rect(0, dk - 14, WW, dk - 13), "gr", 3)                   # top rail
    L.shade(v.rect(0, dk - 13, WW, dk - 12), "nb", 1)
    L.shade(v.rect(0, dk - 7, WW, dk - 6), "gr", 1)                     # mid rail
    # observatory domes
    for cx, r in ((110, 26), (352, 18)):
        body = v.rect(cx - r, dk - 12, cx + r, dk)
        dome = v.disc(cx, dk - 12, r, r * 0.9) & (v.wy < dk - 12)
        L.fill(body, 0.3 + 0.35 * v.lin(cx - r, 0, cx + r, 0), "gr", 0.9, 0, 3)
        L.fill(dome, 0.15 + 0.8 * v.radial(cx - r * 0.4, dk - 12 - r * 0.6, r * 1.6), "si", 0.9, 0, 3)
        L.outline(dome | body, "vs", 0)
        for rib in (-0.5, 0.5):                                         # ribs on the dome
            L.shade(v.ring(cx, dk - 12, r * abs(rib) * 1.4, 1, r * 0.9) & dome & (v.dx(cx) * rib > 0), "si", 1)
        L.shade(v.rect(cx - 2, dk - 12 - r * 0.9, cx + 2, dk - 12) & dome, "vs", 0)   # slit
        L.shade(v.rect(cx - r + 4, dk - 8, cx - r + 7, dk - 5), "nb", 3)               # windows
        L.shade(v.rect(cx + r - 8, dk - 8, cx + r - 5, dk - 5), "pu", 3)
        L.shade(v.rect(cx - 3, dk - 9, cx + 3, dk), "vs", 0)                           # door
    # the telescope on the big dome, pointed into the gas
    L.shade(v.line(118, dk - 34, 148, dk - 54, 4), "rn", 2)
    L.shade(v.line(118, dk - 35, 148, dk - 55, 1), "rn", 4)
    L.shade(v.disc(149, dk - 55, 3), "rn", 3)
    L.shade(v.disc(149, dk - 55, 1.2), "pu", 4)
    # lamps on the rail
    for x in NB_LAMPS:
        L.shade(v.rect(x, dk - 30, x + 1, dk - 14), "gr", 2)
        L.shade(v.rect(x - 2, dk - 32, x + 3, dk - 30), "gr", 3)
        L.shade(v.rect(x - 1, dk - 30, x + 2, dk - 28), "nb", 4)
    # glass tanks of bottled gas, and a mast with a pennant
    for cx, col in ((226, "nb"), (300, "pu"), (440, "qz")):
        tank = v.rect(cx - 6, dk - 26, cx + 6, dk - 2)
        L.fill(tank, 0.2, "si", 0.5, 0, 1)
        gm = v.rect(cx - 5, dk - 18, cx + 5, dk - 2)
        L.fill(gm, 0.35 + 0.65 * v.vgrad(dk - 2, dk - 18), col, 0.9, 1, 4)
        L.outline(tank, "sg", 2)
        L.shade(v.rect(cx - 5, dk - 25, cx - 4, dk - 4), "sg", 4)
        L.shade(v.rect(cx - 7, dk - 29, cx + 7, dk - 26), "gr", 3)
        L.shade(v.rect(cx - 7, dk - 2, cx + 7, dk), "gr", 2)
    L.shade(v.rect(184, dk - 60, 185, dk), "gr", 3)
    L.fill(v.poly([(185, dk - 60), (199, dk - 56), (185, dk - 52)]), 0.7, "nb", 0.9, 1, 4)
    return L


NB_LAMPS = (40, 164, 262, 404)


def nursery_fx(v, f):
    L = Layer(v)
    twinkles(L, f, 901, 46, 20, 175, ["wh", "nb", "pu", "qz"])
    # sparks drifting up out of the cloud sea, one art px a frame, each on its own loop
    for k in range(26):
        x = rnd(902, k) * WW
        y0 = 160 + rnd(902, k, 1) * 50
        t = (f + int(rnd(902, k, 2) * FRAMES)) % FRAMES
        y = y0 - t * 2
        L.shade(v.px(x + math.sin(t + k) * 0.8, y), "nb" if k % 3 else "pu", 4 if t < 4 else 2)
    # lamp glow breathes
    for i, x in enumerate(NB_LAMPS):
        if (f + i * 2) % FRAMES < 5:
            L.speckle(v.disc(x + 0.5, DECK - 29, 6) & ~v.rect(x - 2, DECK - 32, x + 3, DECK - 28), 0.4, "nb", 2)
    # the young stars pulse
    for k, (x, y) in enumerate(NB_STARS):
        ph = (f + k * 2) % FRAMES
        if ph in (0, 1):
            L.star(x, y, "nb", 4, 5 if ph == 0 else 4, 2)
    # the gas in the tanks bubbles
    for cx in (226, 300, 440):
        for j in range(3):
            y = DECK - 4 - ((f * 2 + j * 6) % 14)
            L.shade(v.px(cx - 2 + j * 2, y), "wh", 4)
    return L


# =====================================================================================================================
# 10 Beacon: lattice spires on a ridge under a pulsar. The pulsar's twin beams sweep, rings of signal ride outward, and the
# spire lights answer in a wave.
# =====================================================================================================================
PU_X, PU_Y = 300, 96
SPIRES = [(26, 70, 10), (64, 46, 7), (98, 92, 12), (142, 58, 8), (186, 40, 6), (276, 52, 7), (330, 84, 11), (372, 44, 6), (414, 104, 13), (456, 56, 8)]
LIGHTHOUSE = (232, 96)  # x, height
PU_FIELD = noise(101, 90, 3, 0.55)


def ridge(x):
    return 190 + 6 * np.sin(TAU * 2 * x / WW + 1.1) + 3 * np.sin(TAU * 7 * x / WW + 0.4) + 1.5 * np.sin(TAU * 17 * x / WW)


def beacon_far(v):
    L = Layer(v)
    field = v.sample(PU_FIELD)
    band = np.clip(1 - np.abs(v.wy - 140) / 80, 0, 1)
    L.gas(np.clip((field - 0.5) * 2.4, 0, 1) * band * 0.85, "si", 0, 2)
    L.gas(np.clip((field - 0.7) * 3.2, 0, 1) * band * 0.9, "pu", 0, 2)
    starfield(L, 10, 170, 8, 186, ["wh", "pu", "si", "sg"], 0.1)
    return L


def beacon_near(v):
    L = Layer(v)
    # the pulsar itself sits in the near layer so it stays put while the stars drift
    for k, rr in enumerate((40, 30, 21)):                                   # magnetic field loops, dotted
        for side in (-1, 1):
            m = v.ring(PU_X + side * rr * 0.9, PU_Y, rr, 1, rr * 0.55) & (np.abs(v.dx(PU_X)) > 3)
            m &= ((np.floor(v.wx) + np.floor(v.wy)) % 3 == 0)
            L.shade(m, "si" if k else "pu", 1 + (k == 2))
    halo = v.radial(PU_X, PU_Y, 18)
    L.fill(halo > 0.05, halo, "pu", 0.9, 0, 4)
    L.shade(v.disc(PU_X, PU_Y, 2.5), "wh", 4)
    # ridge, rock and the far ridge behind it
    far = v.wy >= (178 + 5 * np.sin(TAU * 3 * v.wx / WW + 2) + 3 * np.sin(TAU * 8 * v.wx / WW))
    L.fill(far, 0.25 * (1 - v.vgrad(178, 200)), "si", 0.9, 0, 1)
    L.edge_top(far, "si", 2)
    # spires
    for i, (x, h, w) in enumerate(SPIRES):
        g = float(ridge(x))
        top = g - h
        legs = v.line(x - w / 2, g, x - 1, top, 1) | v.line(x + w / 2, g, x + 1, top, 1)
        braces = np.zeros_like(legs)
        n = max(3, h // 9)
        for j in range(n):
            ya, yb = g - h * j / n, g - h * (j + 1) / n
            wa, wb = (w / 2) * (1 - j / n) + 1 * (j / n), (w / 2) * (1 - (j + 1) / n) + 1 * ((j + 1) / n)
            braces |= v.line(x - wa, ya, x + wb, yb, 1) | v.line(x + wa, ya, x - wb, yb, 1)
            braces |= v.line(x - wb, yb, x + wb, yb, 1)
        sil = v.poly([(x - w / 2, g), (x - 1, top), (x + 1, top), (x + w / 2, g)])
        L.fill(sil, 0.0, "pu", 0, 0, 0)
        L.shade(braces, "pu", 1)
        L.shade(legs, "pu", 2)
        L.shade(v.line(x, top, x, top - 6, 1), "gr", 3)
        if h > 80:                                                          # the tall ones carry a dish or a lamp house
            L.fill(v.rect(x - 4, top - 2, x + 4, top + 6), 0.4, "gr", 0.9, 0, 2)
            L.shade(v.rect(x - 3, top + 1, x + 3, top + 3), "pu", 3)
            dish = v.disc(x + 9, top + 12, 6, 3) & (v.wy < top + 12 + 0.5 * v.dx(x + 9))
            L.fill(dish, 0.6, "wh", 0.9, 1, 3)
    # the lighthouse: a striped tapering tower with a lamp room, the zone's top tier
    lx, lh = LIGHTHOUSE
    g = float(ridge(lx))
    body = v.poly([(lx - 9, g), (lx - 5, g - lh), (lx + 5, g - lh), (lx + 9, g)])
    band = (np.floor((v.wy - (g - lh)) / 9) % 2 == 0)
    shade = 0.25 + 0.6 * v.lin(lx - 9, 0, lx + 9, 0)
    L.fill(body & band, shade, "wh", 0.9, 1, 4)
    L.fill(body & ~band, shade, "mag", 0.9, 1, 3)
    L.outline(body, "pu", 0)
    L.fill(v.rect(lx - 8, g - lh - 3, lx + 8, g - lh), 0.5, "gr", 0.9, 1, 3)        # gallery
    L.shade(v.rect(lx - 8, g - lh - 6, lx + 8, g - lh - 5), "gr", 3)
    L.fill(v.rect(lx - 5, g - lh - 14, lx + 5, g - lh - 3), 0.7, "pu", 0.9, 2, 4)  # lamp room
    for xx_ in (lx - 3, lx, lx + 3):
        L.shade(v.rect(xx_, g - lh - 14, xx_ + 1, g - lh - 3), "gr", 1)
    L.fill(v.poly([(lx - 6, g - lh - 14), (lx, g - lh - 20), (lx + 6, g - lh - 14)]), 0.4, "gr", 0.9, 1, 3)
    L.shade(v.rect(lx - 2, g - 14, lx + 2, g), "vs", 0)                             # door
    # cables slung between spire tops
    for (x0, h0, _), (x1, h1, _) in zip(SPIRES, SPIRES[1:] + [(SPIRES[0][0] + WW, SPIRES[0][1], 0)]):
        y0, y1 = float(ridge(x0)) - h0 * 0.6, float(ridge(x1 % WW)) - h1 * 0.6
        pts = [(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + 7 * math.sin(math.pi * t)) for t in np.linspace(0, 1, 12)]
        L.shade(v.path(pts, 1) & ((np.floor(v.wx) % 2) == 0), "si", 1)
    # ground
    gm = v.wy >= ridge(v.wx % WW)
    rock = v.sample(PU_FIELD)
    # terraced rock: ledges step down toward the viewer, each lit along its lip and shaded darker underneath
    rx = v.wx % WW
    base = ridge(rx)
    L.fill(gm, 0.25 + (rock - 0.5) * 0.3, "si", 0.9, 0, 1)
    for t in range(6):
        lip = base + 9 + t * 12 + 4 * np.sin(TAU * (3 + t) * rx / WW + t * 1.9) + 2 * np.sin(TAU * 13 * rx / WW + t)
        band = gm & (v.wy >= lip) & (v.wy < lip + 9)
        L.fill(band, np.clip(0.55 - (v.wy - lip) / 14, 0, 1) * (1 - t * 0.08) + (rock - 0.5) * 0.25, "si", 0.9, 0, 2)
        edge = gm & (np.abs(v.wy - lip) < 0.5 + 0.5 / v.s)
        if t >= 2:
            edge &= (np.floor(v.wx * v.s) % (t) != 0)                   # lower lips break up as they come forward
        L.shade(edge, "pu" if t < 2 else "si", 2 if t < 2 else 1)
    L.edge_top(gm, "pu", 3)
    for x in range(8, WW, 37):                                          # little dishes on the ground
        g = float(ridge(x)) + 6 + (x * 7 % 11)
        L.fill(v.disc(x, g, 4, 2) & (v.wy < g + 0.3), 0.7, "wh", 0.9, 1, 3)
        L.shade(v.rect(x, g, x + 1, g + 3), "gr", 2)
    return L


def beacon_fx(v, f):
    L = Layer(v)
    # twin beams: they swing a little each frame and flare on frames 0-1
    a = -0.35 + 0.7 * (f / FRAMES)
    strong = f in (0, 1)
    for side in (0, math.pi):
        ang = a + side - math.pi / 2
        d = v.dist(PU_X, PU_Y)
        th = v.angle(PU_X, PU_Y)
        diff = np.abs((th - ang + math.pi) % TAU - math.pi)
        width = 0.035 + 0.02 * strong
        sky = v.wy < ridge(v.wx % WW) - 2
        cone = (diff < width) & (d > 4) & (d < (170 if strong else 120)) & sky
        fade = np.clip(1 - d / (170 if strong else 120), 0, 1)
        L.speckle(cone, fade * (0.95 if strong else 0.55), "pu", 3 if strong else 2)
        core = (diff < 0.012) & (d > 3) & (d < 70) & sky
        L.shade(core, "pu", 4 if strong else 3)
    # rings of signal: each one grows outward over the loop
    for k in range(2):
        r = 8 + ((f + k * 4) % FRAMES) * 9
        ring = v.ring(PU_X, PU_Y, r, 1) & ((np.floor(v.angle(PU_X, PU_Y) * r) % 3) == 0)
        L.shade(ring, "pu", max(1, 4 - ((f + k * 4) % FRAMES) // 2))
    # the lighthouse lamp turns: a short beam swings left and right of the lamp room
    lx, lh = LIGHTHOUSE
    ly = float(ridge(lx)) - lh - 9
    sw = math.sin(TAU * f / FRAMES)
    for side in (-1, 1):
        if side * sw > 0.2:
            ln = 40 * abs(sw)
            L.speckle(v.poly([(lx + side * 5, ly - 2), (lx + side * (5 + ln), ly - 6), (lx + side * (5 + ln), ly + 4), (lx + side * 5, ly + 2)]), 0.55, "pu", 3)
    L.shade(v.rect(lx - 3, ly - 3, lx + 3, ly + 3), "wh", 4 if f % 2 == 0 else 3)
    # spire lights travel in a wave from left to right
    for i, (x, h, _) in enumerate(SPIRES):
        top = float(ridge(x)) - h
        lit = (f - i) % FRAMES < 2
        L.shade(v.disc(x + 0.5, top - 6.5, 1.5 if lit else 0.8), "nb" if i % 2 else "mag", 4 if lit else 2)
    twinkles(L, f, 1001, 30, 15, 175, ["wh", "pu", "si"])
    return L


# =====================================================================================================================
# 11 Horizon: an amber accretion disk around a black hole that fills the sky, its far side bent up over the top by the
# lensing. Shattered plates of ground tip toward it, debris streams in, a thin jet climbs out of the pole.
# =====================================================================================================================
BH_X, BH_Y, BH_R = 240, 132, 34
DISK_RX, DISK_RY = 150, 20


def horizon_far(v):
    L = Layer(v)
    # stars, bent into short arcs near the hole
    for k in range(220):
        x, y = rnd(11, k, 1) * WW, 6 + rnd(11, k, 2) * 180
        d = math.hypot(((x - BH_X + WW / 2) % WW) - WW / 2, y - BH_Y)
        rp = ["wh", "sn", "vs", "sg"][k % 4]
        sh = 4 if rnd(11, k, 3) < 0.12 else 2 + (rnd(11, k, 4) < 0.4)
        if d < 140:
            a0 = math.atan2(y - BH_Y, x - BH_X)
            span = 0.4 * (1 - d / 140)
            pts = [(BH_X + d * math.cos(a0 + t), BH_Y + d * math.sin(a0 + t)) for t in np.linspace(-span, span, 6)]
            L.shade(v.path(pts, 1), rp, max(1, sh - 1))
        else:
            L.shade(v.px(x, y), rp, sh)
    halo = v.radial(BH_X, BH_Y, 150, 100)
    L.gas(halo ** 1.4 * 0.9, "vs", 0, 2)
    return L


def disk_mask(v, rx, ry, r_in):
    e = (v.dx(BH_X) / rx) ** 2 + ((v.wy - BH_Y) / ry) ** 2
    e_in = (v.dx(BH_X) / (r_in * 1.4)) ** 2 + ((v.wy - BH_Y) / (r_in * 0.3)) ** 2
    return (e <= 1) & (e_in > 1)


def horizon_near(v):
    L = Layer(v)
    d = v.dist(BH_X, BH_Y)
    # lensed far side of the disk: an arc over the top of the hole
    arc = (np.abs(d - BH_R - 7) < 6) & (v.wy < BH_Y + 2)
    L.fill(arc, np.clip(1 - np.abs(d - BH_R - 7) / 6, 0, 1) * 0.95, "sn", 0.9, 1, 4)
    L.fill((np.abs(d - BH_R - 15) < 3) & (v.wy < BH_Y - 2), 0.5, "ch", 0.9, 0, 2)
    # the hole
    hole = d <= BH_R
    L.fill(hole, 0, "vs", 0, 0, 0)
    L.shade(hole & (d > BH_R - 1.2), "sn", 4)                              # photon ring
    # the disk in front: brightest near the hole, cooler out to the rim, banded
    dm = disk_mask(v, DISK_RX, DISK_RY, BH_R)
    front = dm & ((v.wy >= BH_Y - 1) | (d > BH_R))
    r_norm = np.hypot(v.dx(BH_X) / DISK_RX, (v.wy - BH_Y) / DISK_RY)
    band = 0.5 + 0.5 * np.sin(r_norm * 38)
    heat = np.clip(1.05 - r_norm, 0, 1) * 0.8 + band * 0.2
    behind = dm & (v.wy < BH_Y) & hole
    L.fill(front & ~behind, heat, "sn", 0.9, 0, 4)
    hot = front & ~behind & (r_norm < 0.36)
    L.fill(hot, heat, "sn", 0.9, 3, 4)
    L.speckle(hot & (r_norm < 0.3), 0.5, "wh", 4)
    L.fill(front & ~behind & (r_norm > 0.8), heat, "ch", 0.9, 0, 3)
    # jet: a thin line out of the pole
    L.speckle(v.rect(BH_X - 1, 20, BH_X + 2, BH_Y - BH_R - 14), 1 - v.vgrad(BH_Y - BH_R - 14, 20) * 0.8, "sg", 3)
    # the plain under it: dark rock lit amber where it faces the disk, split by glowing fissures that run toward the hole
    g = hills(111, 196, 3)
    gm = below(v, g)
    glow = v.radial(BH_X, 200, 230, 60)
    L.fill(gm, (1 - v.vgrad(190, WH)) * 0.35 + glow * 0.35, "vs", 0.9, 0, 2)
    L.speckle(gm, glow ** 1.5 * 0.9 * (1 - v.vgrad(200, 250)), "sn", 1)
    rng = np.random.default_rng(116)
    for k in range(16):
        x0 = (k + 0.5) / 16 * WW + rng.random() * 8
        pts = [(x0, WH + 2)]
        x, y = x0, WH + 2.0
        while y > 199:
            tx = BH_X + ((x0 - BH_X + WW / 2) % WW - WW / 2) * 0.25
            x += (tx - x) * 0.12 + (rng.random() - 0.5) * 4
            y -= 4 + rng.random() * 3
            pts.append((x, y))
        hot = abs(((x0 - BH_X) + WW / 2) % WW - WW / 2) < 140
        L.shade(v.path(pts, 1) & gm, "sn" if hot else "ch", 3 if hot else 2)
    # shattered plates of ground, tipping toward the hole
    for k in range(18):
        x = (k + rng.random() * 0.6) * WW / 18
        y = 204 + rng.random() * 50
        w = 10 + rng.random() * 20
        h = 3 + rng.random() * 4
        lean = ((((BH_X - x) + WW / 2) % WW) - WW / 2) * 0.05
        pts = [(x, y), (x + w, y - lean * 0.4 - 2), (x + w - 2, y + h), (x + 2, y + h + 1)]
        pm = v.poly(pts)
        facing = np.clip(1 - abs(((BH_X - x - w / 2) + WW / 2) % WW - WW / 2) / 240, 0, 1)
        L.fill(pm, 0.1 + 0.3 * facing, "gr", 0.9, 0, 2)
        L.edge_top(pm, "sn", 2 + int(facing * 2))
    L.edge_top(gm, "sn", 2)
    # an outpost on the left: a mast and a dish turned to the hole
    ox_, oy_ = 70, float(g(70))
    L.fill(v.rect(ox_ - 10, oy_ - 8, ox_ + 10, oy_ + 1), 0.35, "gr", 0.9, 0, 2)
    L.shade(v.rect(ox_ - 6, oy_ - 6, ox_ - 3, oy_ - 4) | v.rect(ox_ + 2, oy_ - 6, ox_ + 5, oy_ - 4), "sn", 3)
    L.shade(v.line(ox_ + 4, oy_ - 8, ox_ + 10, oy_ - 30, 1), "gr", 3)
    dish = v.disc(ox_ + 13, oy_ - 33, 9, 4) & (v.wy < oy_ - 33 + 0.4 * v.dx(ox_ + 13))
    L.fill(dish, 0.6, "wh", 0.9, 1, 3)
    L.shade(v.rect(ox_ - 4, oy_ - 40, ox_ - 3, oy_ - 8), "gr", 2)
    L.shade(v.rect(ox_ - 5, oy_ - 42, ox_ - 2, oy_ - 40), "red", 4)
    # floating debris near the disk
    for k in range(30):
        a = rnd(113, k) * TAU
        rr = 1.05 + rnd(113, k, 1) * 0.5
        x = BH_X + math.cos(a) * DISK_RX * rr
        y = BH_Y + math.sin(a) * DISK_RY * rr * 1.6 - 4
        s = 1 + (rnd(113, k, 2) < 0.3)
        L.shade(v.rect(x, y, x + s, y + s), "gr", 2)
        L.shade(v.rect(x, y, x + s, y + 1), "sn", 3)
    return L


def horizon_fx(v, f):
    L = Layer(v)
    # hot spots orbit the disk (only on the front half so they never cross the hole)
    for k in range(9):
        rr = 0.45 + 0.5 * rnd(114, k)
        a = rnd(114, k, 1) * TAU + (f / FRAMES) * TAU * (0.25 / rr) * (1 if k % 2 else 1)
        a = a % TAU
        if math.sin(a) < 0.05:
            continue
        x = BH_X + math.cos(a) * DISK_RX * rr
        y = BH_Y + math.sin(a) * DISK_RY * rr
        L.shade(v.rect(x - 1, y, x + 2, y + 1), "wh", 4)
        L.shade(v.px(x - 2 * (1 if math.sin(a) > 0 else -1), y), "sn", 4)
    # infalling streams: specks sliding along spirals into the hole
    for k in range(14):
        a0 = rnd(115, k) * TAU
        t = ((f + rnd(115, k, 1) * FRAMES) % FRAMES) / FRAMES
        r = 150 - t * 105
        a = a0 + t * 1.6
        x, y = BH_X + math.cos(a) * r, BH_Y + math.sin(a) * r * 0.35 + 30 * (1 - t) * (k % 2)
        L.shade(v.px(x, y), "sn" if k % 3 else "ch", 4 if t > 0.5 else 3)
        L.shade(v.px(x - math.cos(a + 1.5) * 2, y - math.sin(a + 1.5) * 1), "sn", 2)
    # the photon ring flickers round
    seg = (v.angle(BH_X, BH_Y) + math.pi) / TAU * 16
    on = (np.floor(seg) % 4 == (f % 4)) & (np.abs(v.dist(BH_X, BH_Y) - BH_R - 1) < 1.2)
    L.shade(on, "wh", 4)
    # jet knots climb
    for k in range(3):
        y = (BH_Y - BH_R - 16) - ((f * 5 + k * 26) % 78)
        L.shade(v.rect(BH_X - 1, y, BH_X + 2, y + 2), "wh", 4)
    twinkles(L, f, 1101, 26, 10, 180, ["wh", "sn", "sg"])
    return L


# =====================================================================================================================
# 12 Archive: a reading hall of the node's memory. Shelves of reels and drawers run back into the dark under vaulted
# arches; a projector throws a beam onto a screen of old log lines; reels turn, dust hangs in the light.
# =====================================================================================================================
def archive_far(v):
    L = Layer(v)
    # vaults: repeating arches along the back wall
    for k in range(6):
        cx = k * 80 + 40
        arch = v.disc(cx, 70, 36, 46) & (v.wy < 70) | v.rect(cx - 36, 70, cx + 36, 200)
        inner = v.disc(cx, 74, 30, 40) & (v.wy < 74) | v.rect(cx - 30, 74, cx + 30, 200)
        L.fill(arch & ~inner, 0.5 - 0.3 * v.vgrad(30, 200), "eg", 0.9, 0, 2)
        # back shelves inside each arch: rows of spines
        for row in range(10):
            y = 80 + row * 11
            shelf = v.rect(cx - 28, y, cx + 28, y + 1) & inner
            L.shade(shelf, "eg", 1)
            sp = v.rect(cx - 28, y + 1, cx + 28, y + 10) & inner
            spine_h = v.sample(ARCH_SPINES)
            L.fill(sp & (spine_h > 0.35), spine_h * 0.6, "eg", 0.9, 0, 1)
    return L


ARCH_SPINES = None


def _arch_spines():
    """Periodic field of book/reel spines: vertical stripes of random heights."""
    f = np.zeros((WH, WW))
    rng = np.random.default_rng(121)
    x = 0
    while x < WW:
        w = int(rng.integers(1, 4))
        f[:, x:x + w] = rng.random()
        x += w + (1 if rng.random() < .3 else 0)
    return f


ARCH_SPINES = _arch_spines()
REELS = [(64, 164, 9), (88, 164, 9), (392, 158, 11), (420, 158, 11)]
PROJ = (150, 150)
SCREEN = (250, 92, 330, 146)


def archive_near(v):
    L = Layer(v)
    # floor: long boards with a warm reflection
    fl = v.wy >= 200
    L.fill(fl, 0.35 * (1 - v.vgrad(200, WH)) + 0.1, "eg", 0.9, 0, 2)
    for k in range(0, WW, 30):
        L.shade(v.line(k, 200, k - 60 + (k - 240) * 0.3, WH, 1) & fl, "eg", 0)
    L.edge_top(fl, "eg", 3)
    # tall foreground stacks at both ends of the tile and the middle
    for x0, w in ((0, 40), (196, 22), (448, 32)):
        st = v.rect(x0, 40, x0 + w, 200)
        L.fill(st, 0.1, "eg", 0.6, 0, 1)
        for y in range(48, 200, 12):
            L.shade(v.rect(x0, y, x0 + w, y + 2), "eg", 2)
            L.shade(v.rect(x0, y, x0 + w, y + 1), "eg", 3)
            for j in range(int(w / 3)):                                  # spines and reel ends
                h = 4 + int(rnd(122, x0, y, j) * 6)
                c = ["eg", "cu", "sn", "eg", "red"][int(rnd(123, x0, y, j) * 5)]
                L.shade(v.rect(x0 + 1 + j * 3, y + 12 - h, x0 + 3 + j * 3, y + 12), c, 1 + int(rnd(124, x0, y, j) * 2))
        L.outline(st, "eg", 0)
    # a rolling ladder on the middle stack
    L.shade(v.line(222, 60, 236, 200, 1) | v.line(228, 60, 242, 200, 1), "cu", 3)
    for y in range(66, 200, 9):
        t = (y - 60) / 140
        L.shade(v.line(222 + 14 * t, y, 228 + 14 * t, y, 1), "cu", 2)
    # reading desk with lamps
    L.fill(v.rect(90, 186, 180, 191), 0.5, "cu", 0.9, 0, 3)
    L.shade(v.rect(96, 191, 99, 200) | v.rect(170, 191, 173, 200), "cu", 1)
    for x in (112, 158):
        L.shade(v.rect(x, 176, x + 1, 186), "rn", 2)
        L.fill(v.poly([(x - 4, 178), (x + 5, 178), (x + 3, 173), (x - 2, 173)]), 0.8, "rn", 0.9, 2, 4)
        L.speckle(v.disc(x + 0.5, 186, 12, 5) & (v.wy < 186) & (v.wy > 179), 0.25, "rn", 2)
    # reel-to-reel machines
    for cx, cy, r in REELS:
        L.fill(v.disc(cx, cy, r), 0.25, "gr", 0.9, 0, 2)
        L.shade(v.ring(cx, cy, r - 0.5, 1), "eg", 3)
        L.shade(v.disc(cx, cy, 2), "eg", 4)
    L.fill(v.rect(52, 174, 100, 200), 0.3, "gr", 0.9, 0, 2)
    L.fill(v.rect(378, 170, 434, 200), 0.3, "gr", 0.9, 0, 2)
    for x in (58, 64, 70, 384, 390, 396, 402):
        L.shade(v.rect(x, 180, x + 3, 182), "pu" if x % 2 else "nb", 3)
    L.shade(v.line(64, 164, 88, 164, 1) & (v.wy > 170), "eg", 2)
    # the projector and its stand
    px, py = PROJ
    L.shade(v.line(px, py + 10, px - 8, 200, 1) | v.line(px, py + 10, px + 8, 200, 1) | v.line(px, py + 10, px, 200, 1), "gr", 2)
    L.fill(v.rect(px - 12, py - 4, px + 8, py + 10), 0.35, "eg", 0.9, 0, 2)
    L.fill(v.disc(px - 8, py - 9, 6), 0.4, "eg", 0.9, 0, 3)
    L.fill(v.disc(px + 4, py - 9, 6), 0.4, "eg", 0.9, 0, 3)
    L.shade(v.rect(px + 8, py, px + 12, py + 6), "wh", 3)
    # the screen, with a few lines of old log on it
    x0, y0, x1, y1 = SCREEN
    L.fill(v.rect(x0, y0, x1, y1), 0.15 + 0.2 * v.radial((x0 + x1) / 2, (y0 + y1) / 2, 60), "eg", 0.9, 0, 2)
    L.outline(v.rect(x0, y0, x1, y1), "eg", 3)
    for k, ln in enumerate((52, 40, 58, 30, 46)):
        L.shade(v.rect(x0 + 6, y0 + 8 + k * 8, x0 + 6 + ln, y0 + 10 + k * 8) & ((np.floor(v.wx) % 4) != 3), "eg", 3)
    L.shade(v.rect(x0 + 10, y1, x0 + 11, 200) | v.rect(x1 - 11, y1, x1 - 10, 200), "gr", 2)
    # film strips hanging from above
    for x, ln in ((120, 50), (176, 30), (356, 64), (438, 36)):
        m = v.rect(x, 0, x + 7, ln)
        L.fill(m, 0.1, "gr", 0.5, 0, 1)
        holes = m & ((np.floor(v.wy) % 3) == 0) & ((np.floor(v.wx) == x + 1) | (np.floor(v.wx) == x + 5))
        L.shade(holes, "eg", 3)
        for fy in range(2, ln - 4, 8):                                  # frames with a faint picture in each
            L.fill(v.rect(x + 2, fy, x + 5, fy + 6), 0.4 + 0.4 * rnd(125, x, fy), "eg", 0.9, 1, 3)
    return L


def archive_fx(v, f):
    L = Layer(v)
    # projector beam flickers: density changes per frame, a cone from the lens to the screen
    px, py = PROJ
    x0, y0, x1, y1 = SCREEN
    beam = v.poly([(px + 12, py + 1), (px + 12, py + 5), (x0 + 2, y1 - 2), (x0 + 2, y0 + 2)])
    k = [0.3, 0.38, 0.26, 0.4, 0.33, 0.22, 0.37, 0.3][f]
    L.speckle(beam, k * (0.6 + 0.4 * v.lin(px, 0, x0, 0)), "rn", 2)
    # dust drifting in the beam and the lamp light
    for j in range(30):
        bx = px + 16 + rnd(1201, j) * (x0 - px - 18)
        by = py - 20 + rnd(1201, j, 1) * 40
        t = (f + int(rnd(1201, j, 2) * FRAMES)) % FRAMES
        x, y = bx + t * 0.8, by - t * 0.5 + math.sin(t * 0.8 + j)
        L.shade(v.px(x, y) & beam, "rn", 4 if t % 3 else 3)
    # reels turn: two spokes sweep round
    for i, (cx, cy, r) in enumerate(REELS):
        a = (f / FRAMES) * TAU * (1 if i % 2 else -1) * 0.5
        for s in range(3):
            aa = a + s * TAU / 3
            L.shade(v.line(cx, cy, cx + math.cos(aa) * (r - 2), cy + math.sin(aa) * (r - 2), 1), "eg", 4)
    # the screen picks a line and lights it
    k = f % 5
    L.shade(v.rect(x0 + 6, y0 + 8 + k * 8, x0 + 6 + (52, 40, 58, 30, 46)[k], y0 + 10 + k * 8) & ((np.floor(v.wx) % 4) != 3), "rn", 4)
    # cursor
    if f % 2 == 0:
        L.shade(v.rect(x0 + 8 + (52, 40, 58, 30, 46)[k], y0 + 7 + k * 8, x0 + 10 + (52, 40, 58, 30, 46)[k], y0 + 11 + k * 8), "wh", 4)
    # machine lights blink
    for j, x in enumerate((58, 64, 70, 384, 390, 396, 402)):
        if (f + j * 3) % FRAMES < 3:
            L.shade(v.rect(x, 180, x + 3, 182), "pu" if x % 2 else "nb", 4)
    return L


# =====================================================================================================================
# 13 Mirror: stairs that climb into themselves over a still mirror floor. The floor reflects the stairs upside down;
# glass shards hang in the air, and the edges split into red and cyan like a misaligned print.
# =====================================================================================================================
MIR_Y = 200  # mirror line
MX_FIELD = noise(131, 100, 3, 0.55)
ISO_U = 5    # one iso cube: 2u wide, u tall top diamond, u tall sides


def iso_pt(i, j, k, ox, oy, rot=None):
    x, y = ox + (i - j) * ISO_U, oy + (i + j) * ISO_U / 2 - k * ISO_U
    if rot:
        cx, cy = rot
        x, y = 2 * cx - x, 2 * cy - y
    return x, y


def iso_draw(L, cubes, ox, oy, faces, rot=None, accents=None):
    """Paint unit cubes (i, j, k) in painter's order with PIL, solid face colours. faces = (top, right, left) RGB tuples or a
    function (i, j, k) -> that triple. accents maps a cube to a door colour drawn on its left face. Wraps sideways."""
    v = L.v
    im = Image.new("RGBA", (v.w, v.h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    order = sorted(set(cubes), key=lambda c: (c[0] + c[1] + c[2], c[2]))
    occupied = set(order)
    for (i, j, k) in order:
        top, right, left = faces(i, j, k) if callable(faces) else faces
        P = lambda a, b, c: iso_pt(a, b, c, ox, oy, rot)
        polys = []
        if (i, j, k + 1) not in occupied:
            polys.append(([P(i, j, k + 1), P(i + 1, j, k + 1), P(i + 1, j + 1, k + 1), P(i, j + 1, k + 1)], top))
        if (i + 1, j, k) not in occupied:
            polys.append(([P(i + 1, j, k), P(i + 1, j + 1, k), P(i + 1, j + 1, k + 1), P(i + 1, j, k + 1)], right))
        if (i, j + 1, k) not in occupied:
            polys.append(([P(i, j + 1, k), P(i + 1, j + 1, k), P(i + 1, j + 1, k + 1), P(i, j + 1, k + 1)], left))
        for pts, col in polys:
            for sh in ((-WW, 0, WW) if v.wrap else (0,)):
                q = [((x + sh - v.ox) * v.s, (y - v.oy) * v.s) for x, y in pts]
                d.polygon(q, fill=(*col, 255))
        if accents and (i, j, k) in accents:
            col = accents[(i, j, k)]
            a, b = P(i + 0.3, j + 1, k), P(i + 0.7, j + 1, k + 0.8)
            for sh in ((-WW, 0, WW) if v.wrap else (0,)):
                q = [((a[0] + sh - v.ox) * v.s, (a[1] - v.oy) * v.s), ((b[0] + sh - v.ox) * v.s, (b[1] - v.oy) * v.s)]
                x0, x1 = sorted((q[0][0], q[1][0]))
                y0, y1 = sorted((q[0][1], q[1][1]))
                d.rectangle([x0, y0, x1, y1], fill=(*col, 255))
    arr = np.asarray(im)
    m = arr[..., 3] > 0
    L.img[m] = arr[m]
    return m


def stair_complex():
    """The stair block in cube coordinates: a platform, a tall tower at the back, flights climbing both front faces to a
    landing, a bridge to a short tower, and a flight that runs off the front edge down toward the mirror."""
    c = set()
    for i in range(9):
        for j in range(9):
            c.add((i, j, 0))
    for i in range(2):                                  # tall tower at the back corner
        for j in range(2):
            for k in range(1, 11):
                c.add((i, j, k))
    for i in range(6, 8):                               # short tower on the right
        for k in range(1, 7):
            c.add((i, 0, k))
    for k in range(1, 5):                               # short tower on the left
        c.add((0, 6, k))
        c.add((0, 7, k))
    for n, i in enumerate(range(8, 3, -1)):             # flight up the right front face to the landing
        for j in range(4, 6):
            for k in range(1, n + 2):
                c.add((i, j, k))
    for n, j in enumerate(range(8, 3, -1)):             # flight up the left front face
        for i in range(4, 6):
            for k in range(1, n + 2):
                c.add((i, j, k))
    for i in range(2, 4):                               # landing at the foot of the tower
        for j in range(2, 4):
            for k in range(1, 7):
                c.add((i, j, k))
    for i in range(2, 6):                               # bridge from the tall tower to the right tower
        c.add((i, 0, 7))
    return c


STAIRS = stair_complex()
ST_OX, ST_OY = 240, MIR_Y - 45        # screen point of cube corner (0, 0, 0)
TWIN = (240, 100)                      # the twin is the block turned 180 degrees about this point
DOORS = {(1, 1, 1): "nb", (0, 7, 1): "pu", (7, 0, 4): "nb", (1, 1, 8): "pu", (3, 3, 5): "nb"}
SIDE_BLOCKS = [(70, MIR_Y - 22, 4), (400, MIR_Y - 26, 5), (140, 120, 2), (346, 96, 2)]


def mirror_faces(ramp, dim=0):
    r = RAMPS[ramp]
    def f(i, j, k):
        lift = min(1, k / 10)
        t = 4 - dim if lift > 0.3 else 3 - dim
        return r[max(0, t)], r[max(0, 2 - dim)], r[max(0, 1 - dim)]
    return f


def mirror_far(v):
    L = Layer(v)
    field = v.sample(MX_FIELD)
    band = np.clip(1 - np.abs(v.wy - 110) / 80, 0, 1)
    L.gas(np.clip((field - 0.45) * 2.2, 0, 1) * band * 0.75, "vs", 0, 2)
    L.gas(np.clip((field - 0.75) * 3, 0, 1) * band * 0.6, "nb", 0, 1)
    starfield(L, 13, 110, 10, 190, ["wh", "px", "vs", "nb"], 0.08)
    # far floating fragments: small iso slabs with a stair on them, drifting with the sky
    for k, (x, y, n) in enumerate(((30, 70, 2), (130, 50, 3), (300, 78, 2), (430, 56, 3))):
        cubes = {(i, j, 0) for i in range(n + 1) for j in range(2)} | {(i, 0, kk) for i in range(n) for kk in range(1, n - i + 1)}
        iso_draw(L, cubes, x, y, mirror_faces("vs", 1))
    return L


def mirror_scene(L, v, mirror=False):
    """The stair complex and its twin. mirror=True draws everything flipped about MIR_Y for the reflection."""
    def rot_for(base):
        return base
    oy = ST_OY if not mirror else 2 * MIR_Y - ST_OY
    if not mirror:
        iso_draw(L, STAIRS, ST_OX, ST_OY, mirror_faces("px"), accents={k: RAMPS[c][3] for k, c in DOORS.items()})
        iso_draw(L, STAIRS, ST_OX, ST_OY, mirror_faces("vs"), rot=TWIN, accents={k: RAMPS[c][3] for k, c in DOORS.items()})
        for x, y, n in SIDE_BLOCKS:
            cubes = {(i, j, kk) for i in range(n) for j in range(n) for kk in range(1)} | {(i, n - 1, kk) for i in range(n) for kk in range(1, i + 2)}
            iso_draw(L, cubes, x, y - n * ISO_U, mirror_faces("px"))
    else:
        # reflection: the same block, flipped vertically about the mirror line (the PIL pass draws it upright, then we flip)
        tmp = Layer(View(v.w, v.h, v.s, v.ox, 2 * MIR_Y - v.oy - v.h / v.s, v.wrap))
        iso_draw(tmp, STAIRS, ST_OX, ST_OY, mirror_faces("px"))
        for x, y, n in SIDE_BLOCKS[:2]:
            cubes = {(i, j, kk) for i in range(n) for j in range(n) for kk in range(1)} | {(i, n - 1, kk) for i in range(n) for kk in range(1, i + 2)}
            iso_draw(tmp, cubes, x, y - n * ISO_U, mirror_faces("px"))
        flipped = tmp.img[::-1]
        m = flipped[..., 3] > 0
        L.img[m] = flipped[m]


def mirror_near(v):
    L = Layer(v)
    fl = v.wy >= MIR_Y
    L.fill(fl, 0.05 + 0.12 * (1 - v.vgrad(MIR_Y, WH)), "vs", 0.9, 0, 1)
    refl = Layer(v)
    mirror_scene(refl, v, mirror=True)
    m = (refl.img[..., 3] > 0) & fl
    rip = (np.floor(v.wy) % 6 == 0) | (np.floor(v.wy) % 9 == 4)
    keep = m & ~rip & (v.wy < MIR_Y + 64)
    lum = refl.img[..., :3].astype(float).mean(-1) / 255
    dim = np.clip(1 - v.vgrad(MIR_Y, MIR_Y + 64), 0, 1)
    L.fill(keep, np.clip(lum * 1.1, 0, 1) * (0.35 + 0.65 * dim), "vs", 0.9, 0, 3)
    L.shade(v.rect(0, MIR_Y, WW, MIR_Y + 1), "px", 3)
    mirror_scene(L, v)
    # misprint: a red copy of every edge one pixel left, a cyan copy one pixel right (above the mirror line only)
    solid = (L.img[..., 3] > 0) & (v.wy < MIR_Y)
    solid &= ~((L.img[..., 0] < 30) & (L.img[..., 1] < 30))
    sx = max(1, int(round(v.s)))
    left_edge = solid & ~np.roll(solid, sx, 1)
    right_edge = solid & ~np.roll(solid, -sx, 1)
    empty = L.img[..., 3] == 0
    L.img[np.roll(left_edge, -sx, 1) & empty] = (*RAMPS["red"][3], 255)
    L.img[np.roll(right_edge, sx, 1) & empty] = (*RAMPS["pu"][3], 255)
    # a seam of light where the tower meets its twin
    return L


SHARDS = [(30, 120, 8), (96, 150, 5), (118, 100, 6), (170, 128, 4), (318, 100, 7), (356, 150, 5), (382, 112, 6), (452, 134, 7)]


def mirror_fx(v, f):
    L = Layer(v)
    # shards bob up and down a pixel or two and catch the light in turn
    for k, (x, y, s) in enumerate(SHARDS):
        dy = round(2 * math.sin(TAU * (f / FRAMES) + k))
        pts = [(x, y + dy - s), (x + s * 0.6, y + dy), (x, y + dy + s * 0.8), (x - s * 0.5, y + dy)]
        m = v.poly(pts)
        lit = (f + k) % FRAMES == 0
        L.fill(m, 0.85 if lit else 0.5, "px", 0.9, 1, 4)
        L.shade(v.line(pts[0][0], pts[0][1], pts[2][0], pts[2][1], 1) & m, "wh", 4 if lit else 3)
        # its reflection, faint
        rm = v.poly([(px_, 2 * MIR_Y - py_) for px_, py_ in pts])
        L.speckle(rm & (v.wy > MIR_Y + 1), 0.45, "vs", 2)
        if lit:
            L.star(x, y + dy - s - 2, "wh", 4, 2)
    # ripple lines slide down the mirror
    for k in range(4):
        y = MIR_Y + 3 + ((f * 3 + k * 17) % 64)
        L.speckle(v.rect(0, y, WW, y + 1), 0.5 * (1 - (y - MIR_Y) / 70), "px", 2)
    # a misprint: one band of the stairs glows red or cyan for a frame
    if f in (2, 5):
        y0 = 120 + (f * 13) % 40
        L.speckle(v.rect(150, y0, 330, y0 + 2), 0.35, "red" if f == 2 else "pu", 3)
    twinkles(L, f, 1301, 22, 10, 180, ["wh", "px", "vs"])
    return L


# =====================================================================================================================
# 14 Root: the chamber under everything. Roots and cables come down out of the rock ceiling and gather into node zero,
# a squat glowing core on the floor. Old racks are sunk into the walls. Light runs down the roots into the core.
# =====================================================================================================================
OR_X, OR_Y = 240, 196
RACKS = ((40, 30, 66), (78, 22, 44), (384, 24, 50), (414, 32, 72))


def _roots():
    """Root paths from the ceiling to the core: wandering walks that only bend hard toward it in their last third, plus
    short side roots that split off and stop. Returns lists of world points; the first MAIN reach the core."""
    rng = np.random.default_rng(147)
    paths, side = [], []
    xs = np.linspace(OR_X - 190, OR_X + 190, MAIN) + rng.normal(0, 8, MAIN)
    for k, x in enumerate(xs):
        y = 16 + rng.random() * 16
        pts = [(x, y)]
        vx = (rng.random() - 0.5) * 2
        ty = OR_Y - 26
        while y < ty:
            t = y / ty
            tx = OR_X + (k - MAIN / 2) * 2.2
            vx = vx * 0.75 + (tx - x) * (0.012 + 0.2 * t ** 3) + math.sin(y * 0.09 + k * 1.7) * 1.1
            x += vx
            y += 5 + rng.random() * 3
            pts.append((x, y))
            if rng.random() < 0.12 and t < 0.75:                       # a side root splits off here
                sx, sy = x, y
                sp = [(sx, sy)]
                d = 1 if rng.random() < 0.5 else -1
                for _ in range(int(3 + rng.random() * 5)):
                    sx += d * (3 + rng.random() * 4)
                    sy += 3 + rng.random() * 5
                    sp.append((sx, sy))
                side.append(sp)
        pts.append((OR_X + (k - MAIN / 2) * 1.2, OR_Y - 22))
        paths.append(pts)
    return paths + side


MAIN = 11
ROOTS = _roots()
ROCK = noise(142, 50, 4, 0.6)


def root_far(v):
    L = Layer(v)
    rock = v.sample(ROCK)
    # back wall: rock with faint seams of glowing ore
    wall = v.wy < 200
    L.fill(wall, np.clip((rock - 0.55) * 0.9, 0, 1), "or", 0.9, 0, 1)
    for k in range(40):                                                 # flecks of ore in the rock
        L.shade(v.px(rnd(145, k) * WW, 30 + rnd(145, k, 1) * 160), "ae", 2)
    # far roots: thin, dim
    rng = np.random.default_rng(143)
    for k in range(18):
        x, y = rng.random() * WW, 10.0
        pts = [(x, y)]
        while y < 60 + rng.random() * 130:
            x += (rng.random() - 0.5) * 7
            y += 6
            pts.append((x, y))
        L.shade(v.path(pts, 2), "or", 0)
        L.shade(v.path([(a - 0.5, b) for a, b in pts], 1), "or", 1)
    # spores hanging
    for k in range(60):
        L.shade(v.px(rnd(144, k) * WW, 40 + rnd(144, k, 1) * 150), "ae" if k % 3 else "or", 2)
    return L


def root_near(v):
    L = Layer(v)
    rock = v.sample(ROCK)
    # ceiling: heavy rock with a jagged lower edge
    ceil = v.wy < (18 + 6 * np.sin(TAU * 3 * v.wx / WW) + 4 * np.sin(TAU * 11 * v.wx / WW + 1) + (rock - 0.5) * 10)
    L.fill(ceil, 0.25 + (rock - 0.5) * 0.4, "gr", 0.9, 0, 2)
    # rock pillars at the tile seam frame the chamber, so each tile reads as one room
    half = 20 + 8 * np.abs(np.sin(v.wy * 0.05)) + 4 * (rock - 0.5) + 10 * (1 - np.clip(np.minimum(v.wy - 10, OR_Y - v.wy) / 40, 0, 1))
    pil = (np.abs(v.dx(0)) < half) & (v.wy < OR_Y + 4)
    L.fill(pil, 0.25 + (rock - 0.5) * 0.6, "gr", 0.9, 0, 2)
    L.shade(pil & ~np.roll(pil, -1, 1) & (v.dx(0) > 0), "or", 1)
    L.shade(pil & ~np.roll(pil, 1, 1) & (v.dx(0) < 0), "or", 1)
    # walls: racks sunk into the rock on both sides of the core
    for x0, w, h in RACKS:
        r = v.rect(x0, OR_Y - h, x0 + w, OR_Y)
        L.fill(r, 0.25 + 0.2 * v.lin(x0, 0, x0 + w, 0), "gr", 0.9, 0, 2)
        L.outline(r, "gr", 0)
        for y in range(int(OR_Y - h + 4), OR_Y - 3, 6):
            L.shade(v.rect(x0 + 3, y, x0 + w - 3, y + 1), "gr", 0)
            L.shade(v.rect(x0 + 4, y + 2, x0 + 6, y + 3), "or", 3)
        # a terminal screen on the tall ones
        if h > 60:
            sc = v.rect(x0 + 5, OR_Y - h + 8, x0 + w - 5, OR_Y - h + 20)
            L.fill(sc, 0.3, "or", 0.9, 0, 2)
            L.shade(v.rect(x0 + 7, OR_Y - h + 11, x0 + w - 10, OR_Y - h + 12) | v.rect(x0 + 7, OR_Y - h + 15, x0 + w - 14, OR_Y - h + 16), "or", 4)
    # roots (thick near the ceiling, thinning toward the core)
    for k, pts in enumerate(ROOTS):
        n = len(pts)
        main = k < MAIN
        for j, ((a, b), (c, d)) in enumerate(zip(pts, pts[1:])):
            t = j / max(1, n - 1)
            w = (6.5 - 4.5 * t) if main else (3 - 1.8 * t)
            seg = v.line(a, b, c, d, w)
            bark = 0.5 + 0.5 * np.sin(v.wy * 1.3 + v.wx * 0.4 + k)
            L.fill(seg, 0.3 + 0.3 * bark, "gr" if not main else "or", 0.9, 0, 3)
            L.shade(v.line(a - w * 0.3, b, c - w * 0.3, d, 1), "or", 3 if main else 2)
            if main and w > 3:
                L.shade(v.line(a + w * 0.35, b, c + w * 0.35, d, 1), "or", 0)
    # floor
    fl = v.wy >= OR_Y
    L.fill(fl, (1 - v.vgrad(OR_Y, WH)) * 0.3 + (rock - 0.5) * 0.25, "gr", 0.9, 0, 2)
    L.speckle(fl, v.radial(OR_X, OR_Y + 6, 120, 30) * 0.8, "or", 1)
    L.edge_top(fl, "or", 2)
    # surface roots spreading out from the core across the floor
    for k in range(10):
        a = (k + 0.5) / 10 * math.pi
        pts = [(OR_X + math.cos(a) * r * 2.4, OR_Y + 3 + math.sin(a) * r * 0.25 + (r / 50) ** 2 * 10) for r in np.linspace(14, 90, 10)]
        L.shade(v.path(pts, 2 - 0 * k), "or", 1)
        L.shade(v.path([(x, y - 0.6) for x, y in pts], 1), "or", 2)
    # node zero: a stepped plinth and the core on it
    L.fill(v.rect(OR_X - 30, OR_Y - 8, OR_X + 30, OR_Y), 0.35, "gr", 0.9, 0, 3)
    L.fill(v.rect(OR_X - 22, OR_Y - 14, OR_X + 22, OR_Y - 8), 0.45, "gr", 0.9, 0, 3)
    L.edge_top(v.rect(OR_X - 30, OR_Y - 8, OR_X + 30, OR_Y), "or", 3)
    L.edge_top(v.rect(OR_X - 22, OR_Y - 14, OR_X + 22, OR_Y - 8), "or", 3)
    core = v.poly([(OR_X, OR_Y - 44), (OR_X + 14, OR_Y - 28), (OR_X, OR_Y - 14), (OR_X - 14, OR_Y - 28)])
    L.fill(core, 0.4 + 0.6 * v.radial(OR_X - 3, OR_Y - 33, 18), "or", 0.9, 1, 4)
    L.outline(core, "ae", 1)
    L.shade(v.line(OR_X, OR_Y - 44, OR_X, OR_Y - 14, 1) & core, "or", 4)
    return L


def root_fx(v, f):
    L = Layer(v)
    # pulses run down the main roots into the core
    for k, pts in enumerate(ROOTS[:MAIN]):
        n = len(pts) - 1
        for lap in range(2):
            t = (((f + k * 3) % FRAMES) / FRAMES + lap * 0.5) % 1.0
            pos = t * n
            j = min(int(pos), n - 1)
            u = pos - j
            (a, b), (c, d) = pts[j], pts[j + 1]
            x, y = a + (c - a) * u, b + (d - b) * u
            L.shade(v.disc(x, y, 1.6), "or", 4)
            L.shade(v.px(x, y), "wh", 4)
    # the core throbs: a halo that grows and shrinks over the loop
    r = 22 + 6 * math.sin(TAU * f / FRAMES)
    halo = v.radial(OR_X, OR_Y - 29, r) * (v.dist(OR_X, OR_Y - 29) > 15)
    L.speckle(halo > 0, halo * 0.9, "or", 3)
    # spores rise from the floor
    for k in range(24):
        x = rnd(1401, k) * WW
        t = (f + int(rnd(1401, k, 1) * FRAMES)) % FRAMES
        y = OR_Y - 4 - t * 4 - rnd(1401, k, 2) * 60
        L.shade(v.px(x + math.sin(t * 0.9 + k) * 1.2, y), "ae" if k % 2 else "or", 3 if t < 5 else 2)
    # terminal cursors blink
    for x0, w, h in (RACKS[0], RACKS[3]):
        if f % 2 == 0:
            L.shade(v.rect(x0 + w - 9, OR_Y - h + 15, x0 + w - 7, OR_Y - h + 17), "or", 4)
    return L


# ---------------------------------------------------------------------------------------------------------------------
# era table: n -> (name, far, near, fx, drift seconds per tile (0 = still), close-up focus (x, y, scale))
# ---------------------------------------------------------------------------------------------------------------------
ERAS = {
    9: ("nursery", nursery_far, nursery_near, nursery_fx, (130, 150, 2.0)),
    10: ("beacon", beacon_far, beacon_near, beacon_fx, (290, 130, 2.0)),
    11: ("horizon", horizon_far, horizon_near, horizon_fx, (240, 140, 1.9)),
    12: ("archive", archive_far, archive_near, archive_fx, (230, 140, 2.0)),
    13: ("mirror", mirror_far, mirror_near, mirror_fx, (240, 150, 1.9)),
    14: ("root", root_far, root_near, root_fx, (240, 150, 2.0)),
}


def render(n, v):
    _, far, near, fx, _ = ERAS[n]
    return far(v).img, near(v).img, [fx(v, f).img for f in range(FRAMES)]


def save(img, name):
    im = Image.fromarray(img, "RGBA")
    p = OUT / f"{name}.webp"
    im.save(p, lossless=True, quality=100, method=6)
    return p.stat().st_size


def build(n):
    name = ERAS[n][0]
    v = View(WW, WH)
    far, near, fx = render(n, v)
    sizes = {}
    sizes["far"] = save(far, f"scene-{n}-far")
    sizes["near"] = save(near, f"scene-{n}-near")
    sizes["fx"] = save(np.concatenate(fx, 0), f"scene-{n}-fx")
    flat = over(over(far, near), fx[0])
    sizes["flat"] = save(flat, f"scene-{n}")
    Image.fromarray(flat, "RGBA").save(OUT / f"scene-{n}.png", optimize=True)
    # close-up: the same world drawn larger around the focus point, still layered, flattened per frame
    cx, cy, s = ERAS[n][4]
    dv = View(DW, DH, s, cx - DW / s / 2, cy - DH / s / 2)
    dfar, dnear, dfx = render(n, dv)
    base = over(dfar, dnear)
    det = np.concatenate([over(base, fr) for fr in dfx], 0)
    sizes["detail"] = save(det, f"detail-{n}")
    print(f"era {n} {name}: " + ", ".join(f"{k} {v_ / 1000:.1f} KB" for k, v_ in sizes.items()))
    pd = os.environ.get("NF_PREVIEW_DIR")
    if pd:
        preview(n, far, near, fx, det, Path(pd))


def preview(n, far, near, fx, det, d):
    """Contact sheet: the composite at 2x on the page colour at the ground's opacity, plus three fx frames and the close-up."""
    d.mkdir(parents=True, exist_ok=True)
    bg = np.zeros((WH, WW, 3), float) + 12

    def comp(img, a=0.55):
        al = img[..., 3:4] / 255.0 * a
        return (img[..., :3] * al + bg * (1 - al)).astype(np.uint8)

    full = [comp(over(over(far, near), fx[f]), 1.0) for f in (0, 3, 6)]
    rows = [np.concatenate([comp(over(over(far, near), fx[0])), full[0]], 1)]
    rows.append(np.concatenate(full[1:], 1))
    top = np.concatenate(rows, 0)
    im = Image.fromarray(top).resize((top.shape[1] * 2, top.shape[0] * 2), Image.NEAREST)
    im.save(d / f"era{n}-preview.png")
    dt = det[:DH, :, :]
    al = dt[..., 3:4] / 255.0
    dd = (dt[..., :3] * al + 10 * (1 - al)).astype(np.uint8)
    Image.fromarray(dd).resize((DW * 2, DH * 2), Image.NEAREST).save(d / f"era{n}-detail.png")


if __name__ == "__main__":
    want = [int(a) for a in sys.argv[1:]] or list(ERAS)
    OUT.mkdir(parents=True, exist_ok=True)
    for n in want:
        build(n)
