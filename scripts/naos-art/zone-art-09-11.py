"""Node Farm staged zone art for zone 09 Prism Court (Starglass), zone 10 Hollow Forge (Voidsteel) and zone 11 Still Room (Chrono).

Follows the staged zone art contract (docs/node-farm.md, "Zone art"): one sheet per zone at public/naos/nodefarm/zone-<statId>,
cells of 288 x 64 art px, 8 rows (row 0 is the bare backdrop, row n adds sprite n on top of row n-1) by 6 frames across, a
6-frame loop at 6 fps. Sprites grow from about 8 px to 56 px tall; each one is a bigger, richer take on the zone's 32 px icon.

Everything is drawn from flat shapes shaded through the 4x4 Bayer threshold into the ramps in nodefarm-icons.py (zone ramp, two
accents, plus wh/gr), so it reads as the same dither as the small sprites. No anti-aliasing: alpha is 0 or 255, except the
backdrop haze (alpha <= 90, shades 0-1 only).

Layout inside the 288 x 64 cell (bottom anchored at y = 62):
  sprites 1-4 walk up in size from x = 48 to x = 106, sprite 7 (the zone's centrepiece) stands at x ~ 156, then sprite 6 and
  sprite 5 on the right. The top-right 80 x 22 under the big number only ever gets backdrop. Phone shows the right ~180 px, so
  sprites 5-7 are always in view there.

Run: python3 scripts/naos-art/zone-art-09-11.py [starglass|voidsteel|chrono ...]
Writes public/naos/nodefarm/zone-<id>.{png,webp} and a 2x preview to /tmp/zone-art-<id>.png.
"""
import importlib.util
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("nodefarm_icons", HERE / "nodefarm-icons.py")
_nfi = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_nfi)
RAMPS = _nfi.RAMPS
BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 - 0.5

W, H = 288, 64
ROWS, FRAMES = 8, 6
BASE = 62            # ground line for sprites
SS = 4               # supersampling for polygon masks
TAU = math.tau
QUIET = (W - 80, 0, W, 22)   # top-right box under the big number: backdrop only

# x centre of each sprite (index 1..7)
SLOT = {1: 48, 2: 63, 3: 81, 4: 105, 5: 266, 6: 222, 7: 158}


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


class Canvas:
    def __init__(self):
        self.img = np.zeros((H, W, 4), np.uint8)
        self.yy, self.xx = np.mgrid[0:H, 0:W].astype(float) + 0.5
        self.bayer = np.tile(BAYER4, (H // 4, W // 4))

    def empty(self):
        return self.img[..., 3] == 0

    # ---- masks
    def poly(self, pts):
        im = Image.new("L", (W * SS, H * SS), 0)
        ImageDraw.Draw(im).polygon([(x * SS, y * SS) for x, y in pts], fill=255)
        return np.asarray(im.resize((W, H), Image.BOX)) > 127

    def disc(self, cx, cy, r, ry=None):
        ry = ry or r
        return ((self.xx - cx) / r) ** 2 + ((self.yy - cy) / ry) ** 2 <= 1.0

    def ring(self, cx, cy, r, th, ry=None):
        ry = ry if ry is not None else r
        d = np.hypot(self.xx - cx, (self.yy - cy) * r / ry)
        return (d <= r) & (d >= r - th)

    def rect(self, x0, y0, x1, y1):
        return (self.xx >= x0) & (self.xx < x1) & (self.yy >= y0) & (self.yy < y1)

    def line(self, x0, y0, x1, y1, w=1.0):
        im = Image.new("L", (W * SS, H * SS), 0)
        ImageDraw.Draw(im).line([(x0 * SS, y0 * SS), (x1 * SS, y1 * SS)], fill=255, width=max(1, int(w * SS)))
        return np.asarray(im.resize((W, H), Image.BOX)) > 100

    def lin(self, x0, y0, x1, y1):
        dx, dy = x1 - x0, y1 - y0
        t = ((self.xx - x0) * dx + (self.yy - y0) * dy) / (dx * dx + dy * dy + 1e-9)
        return np.clip(t, 0, 1)

    def rad(self, cx, cy, r):
        return np.clip(1 - np.hypot(self.xx - cx, self.yy - cy) / r, 0, 1)

    # ---- paint
    def fill(self, mask, v, rampname, outline=True, lo=0, hi=4, amp=0.9):
        r = RAMPS[rampname]
        v = np.broadcast_to(np.asarray(v, float), (H, W))
        idx = np.clip(np.floor(lo + v * (hi - lo) + 0.5 + self.bayer * amp), lo, hi).astype(int)
        for i, c in enumerate(r):
            m = mask & (idx == i)
            self.img[m] = (*c, 255)
        if outline:
            self.outline(mask, rampname)

    def outline(self, mask, rampname, shade=0):
        d = np.zeros_like(mask)
        d[1:, :] |= mask[:-1, :]; d[:-1, :] |= mask[1:, :]; d[:, 1:] |= mask[:, :-1]; d[:, :-1] |= mask[:, 1:]
        self.img[d & ~mask] = (*RAMPS[rampname][shade], 255)

    def set(self, mask, col, a=255):
        if isinstance(col, str):
            col = hexc(col)
        self.img[mask] = (*col, a)

    def haze(self, mask, rampname, shade, alpha):
        """Backdrop-only translucent wash (contract: alpha <= 90, shades 0-1)."""
        assert alpha <= 90 and shade <= 1
        m = mask & self.empty()
        self.img[m] = (*RAMPS[rampname][shade], alpha)

    def glow(self, cx, cy, r, rampname, strength=1.0, shade=1):
        """Dithered halo: scattered pixels of one dark shade, denser toward the centre, only on empty pixels."""
        v = self.rad(cx, cy, r) * strength
        m = (v > (self.bayer + 0.5) * 0.9 + 0.12) & self.empty()
        self.set(m, RAMPS[rampname][shade])

    def px(self, x, y, col, only_empty=False):
        x, y = int(math.floor(x)), int(math.floor(y))
        if 0 <= x < W and 0 <= y < H:
            if only_empty and self.img[y, x, 3] == 255:
                return
            if isinstance(col, str):
                col = hexc(col)
            self.img[y, x] = (*col, 255)

    def spark(self, x, y, col, size=1, only_empty=False):
        self.px(x, y, col, only_empty)
        if size >= 1:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                self.px(x + dx, y + dy, col, only_empty)


def wave(f, seed=0.0):
    """0..1, one cosine cycle over the loop."""
    return 0.5 + 0.5 * math.cos(TAU * (f / FRAMES + seed))


def tw(f, seed):
    return wave(f, (seed * 0.618) % 1)


def not_quiet(c):
    x0, y0, x1, y1 = QUIET
    return ~c.rect(x0, y0, x1, y1)


# =====================================================================================================================
# zone 09 PRISM COURT  /  Starglass.  Ramps: sg, accents cyan + mag, plus wh / gr
# =====================================================================================================================
def star(c, cx, cy, r, v=0.3, rn="sg", pinch=0.26, rot=0.0, points=4):
    pts = []
    for i in range(points * 2):
        a = rot + i * TAU / (points * 2) - TAU / 4
        rr = r if i % 2 == 0 else r * pinch
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    m = c.poly(pts)
    c.fill(m, v + 0.55 * c.lin(cx - r, cy + r, cx + r, cy - r), rn)
    return m


def crystal(c, cx, base, w, h, v=0.0, lean=0.0, rn="sg"):
    tip = (cx + lean, base - h)
    left = c.poly([(cx - w / 2, base), (cx - w / 2, base - h * 0.62), tip, (cx, base - h * 0.5), (cx, base)])
    right = c.poly([(cx, base), (cx, base - h * 0.5), tip, (cx + w / 2, base - h * 0.62), (cx + w / 2, base)])
    c.fill(left, 0.5 + v + 0.4 * c.lin(cx, base, cx, base - h), rn)
    c.fill(right, 0.1 + v + 0.35 * c.lin(cx, base, cx, base - h), rn)
    if h >= 10:
        c.set(c.line(cx, base - 1, cx, base - h * 0.5, 1) & (left | right), RAMPS[rn][4])
    return left | right


def plinth(c, cx, base, w, h):
    body = c.rect(cx - w / 2 + 1, base - h + 1, cx + w / 2 - 1, base)
    c.fill(body, 0.2 + 0.35 * c.lin(cx - w / 2, 0, cx + w / 2, 0), "gr")
    c.fill(c.rect(cx - w / 2, base - h, cx + w / 2, base - h + 1), 0.9, "gr", outline=False)
    if h >= 4:
        c.set(c.rect(cx - w / 2 + 1, base - h + 2, cx + w / 2 - 1, base - h + 3), RAMPS["cyan"][2])


def orbiters(c, cx, cy, rx, ry, n, f, r, front, rn="sg", phase=0.0):
    """n small stars on an ellipse, advancing 1/n of a lap per loop so frame 5 runs into frame 0."""
    for k in range(n):
        a = phase + TAU * (k + f / FRAMES) / n
        if front != (math.sin(a) >= 0):
            continue
        x, y = cx + rx * math.cos(a), cy + ry * math.sin(a)
        if r < 1.6:
            c.spark(x, y, RAMPS[rn][4], 1)
        else:
            star(c, x, y, r, 0.45, rn)


def spectrum(c, x0, y0, x1, y1s, f, w=1.0):
    """A white beam split into cyan / white / magenta; a bright packet runs down each ray over the loop."""
    for i, (y1, rn) in enumerate(zip(y1s, ["cyan", "sg", "mag"])):
        m = c.line(x0, y0, x1, y1, w) & c.empty()
        c.fill(m, 0.3 + 0.5 * c.lin(x0, y0, x1, y1), rn, outline=False, lo=1, hi=3)
        t = (f / FRAMES + i / 3) % 1
        c.px(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, RAMPS[rn][4])


def sg_1(c, f):
    x = SLOT[1]
    star(c, x, BASE - 4, 4 + (f % 3 == 0) * 0.4, 0.35)


def sg_2(c, f):
    """Pane: a tilted sheet of starglass in a thin frame, a glint sliding across it."""
    x = SLOT[2]
    pane = c.poly([(x - 4, BASE - 1), (x - 2, BASE - 12), (x + 5, BASE - 11), (x + 3, BASE)])
    c.fill(pane, 0.35 + 0.5 * c.lin(x - 4, BASE, x + 5, BASE - 12), "sg", lo=1)
    g = -3 + 9 * (f / FRAMES)
    c.set(pane & (np.abs((c.xx - x) - (c.yy - BASE + 6) * -0.2 - g) < 0.8), RAMPS["sg"][4])
    c.px(x + 1, BASE - 7, RAMPS["cyan"][4])


def sg_3(c, f):
    """Lens: a round lens on a stand, a faint beam focused through it to a bright point."""
    x = SLOT[3]
    c.fill(c.rect(x - 1, BASE - 6, x + 1, BASE), 0.5, "gr", outline=False)
    c.fill(c.rect(x - 4, BASE - 1, x + 4, BASE), 0.8, "gr", outline=False)
    lens = c.disc(x, BASE - 10, 5, 6)
    c.fill(lens, 0.25 + 0.6 * c.lin(x - 5, BASE - 4, x + 5, BASE - 16), "sg", lo=1)
    c.set(c.ring(x, BASE - 10, 5, 1, 6), RAMPS["gr"][3])
    c.px(x - 2, BASE - 13, RAMPS["sg"][4])
    for i, dy in enumerate((-3, 0, 3)):
        m = c.line(x - 12, BASE - 10 + dy * 1.6, x - 5, BASE - 10 + dy, 1) & c.empty() & (((c.xx.astype(int) + f) % 2) == 0)
        c.set(m, RAMPS["sg"][1])
    fx = x + 9
    for dy in (-3, 0, 3):
        c.set(c.line(x + 5, BASE - 10 + dy, fx, BASE - 10, 1) & c.empty(), RAMPS["cyan"][2])
    b = wave(f)
    c.spark(fx, BASE - 10, RAMPS["sg"][4 if b > .5 else 3], 1 if b > .4 else 0)


def sg_4(c, f):
    """Prism: a triangular prism on a plinth, white light in on the left, a little spectrum out on the right."""
    x = SLOT[4]
    plinth(c, x, BASE, 14, 4)
    top, bot = BASE - 20, BASE - 4
    front = c.poly([(x - 7, bot), (x, top), (x + 7, bot)])
    c.fill(front, 0.2 + 0.7 * c.lin(x - 7, bot, x + 3, top), "sg")
    c.set(c.line(x, top + 1, x - 1, bot - 1, 1) & front, RAMPS["sg"][4])
    inner = c.poly([(x - 3, bot - 2), (x, top + 7), (x + 3, bot - 2)])
    c.fill(inner, 0.6, "cyan", outline=False, lo=1, hi=3)
    beam = c.line(x - 15, BASE - 18, x - 3, BASE - 11, 1) & c.empty()
    c.set(beam, RAMPS["sg"][3])
    for i, (dy, rn) in enumerate([(-4, "cyan"), (-1, "sg"), (2, "mag")]):
        m = c.line(x + 3, BASE - 11, x + 14, BASE - 11 + dy * 1.6, 1) & c.empty()
        c.set(m, RAMPS[rn][3])
        t = (f / FRAMES + i / 3) % 1
        c.px(x + 3 + 11 * t, BASE - 11 + dy * 1.6 * t, RAMPS[rn][4])


def sg_5(c, f):
    x = SLOT[5]
    c.glow(x, BASE - 12, 16, "sg", 0.9, 0)
    plinth(c, x, BASE, 22, 4)
    crystal(c, x - 7, BASE - 4, 7, 12, -0.05, -1.5, "qz")
    crystal(c, x + 7, BASE - 4, 6, 10, -0.05, 1.5, "cyan")
    crystal(c, x, BASE - 4, 10, 20)
    star(c, x, BASE - 27, 4 + 0.6 * tw(f, 5), 0.4, "sg")


def sg_6(c, f):
    """Observatory: a starglass dome on a tower, its telescope trained on a turning star, satellites in orbit."""
    x = SLOT[6]
    sx, sy = x + 11, BASE - 32
    c.glow(sx, sy, 11, "cyan", 0.9, 0)
    orbiters(c, sx, sy, 9, 3, 3, f, 1, False, "cyan", 0.3)
    # tower
    tw_ = c.poly([(x - 9, BASE), (x - 8, BASE - 18), (x + 8, BASE - 18), (x + 9, BASE)])
    c.fill(tw_, 0.15 + 0.55 * c.lin(x - 9, 0, x + 9, 0), "gr")
    for y in (BASE - 13, BASE - 7):
        c.set(c.rect(x - 8, y, x + 9, y + 1) & tw_, RAMPS["gr"][1])
    door = c.rect(x - 2, BASE - 6, x + 2, BASE)
    c.set(door, RAMPS["cyan"][2 if f % 3 else 3])
    c.set(c.rect(x - 5, BASE - 16, x - 3, BASE - 14), RAMPS["rn"][3 if f % 2 else 4])
    c.set(c.rect(x + 3, BASE - 16, x + 5, BASE - 14), RAMPS["lime"][3])
    # dome
    dome = c.disc(x, BASE - 18, 11, 9) & (c.yy < BASE - 18)
    c.fill(dome, 0.25 + 0.65 * c.lin(x + 8, BASE - 18, x - 6, BASE - 27), "sg")
    slit = c.line(x - 1, BASE - 26, x + 4, BASE - 19, 2.2) & dome
    c.set(slit, RAMPS["sg"][0])
    for k in (-6, 0, 6):
        c.set(c.line(x + k, BASE - 18, x + k * 0.7, BASE - 26, 1) & dome & ~slit, RAMPS["sg"][1])
    # telescope
    tube = c.line(x + 1, BASE - 22, x + 9, BASE - 31, 2.4)
    c.fill(tube, 0.5 + 0.4 * c.lin(x, BASE - 22, x + 9, BASE - 31), "gr")
    c.set(c.disc(x + 9.5, BASE - 31.5, 1.3), RAMPS["cyan"][4])
    # the star it watches
    rot = (f / FRAMES) * (TAU / 8)
    star(c, sx, sy, 6, 0.1, "cyan", 0.32, rot + TAU / 8)
    star(c, sx, sy, 5, 0.4, "sg", 0.26, rot)
    c.px(sx, sy, RAMPS["sg"][4])
    orbiters(c, sx, sy, 9, 3, 3, f, 1, True, "cyan", 0.3)


def sg_7(c, f):
    """The court itself: two pillars capped with crystals, an arch with a constellation, a hanging starglass, a light beam split
    into a spectrum fanning down to the floor."""
    x = SLOT[7]
    sy = BASE - 34
    c.glow(x, sy, 30, "sg", 1.0, 0)
    c.glow(x, sy, 16, "cyan", 0.8, 1)
    # floor
    floor = c.poly([(x - 32, BASE), (x + 32, BASE), (x + 28, BASE + 2), (x - 28, BASE + 2)])
    c.fill(floor, 0.2, "sg", outline=False, lo=0, hi=1)
    c.set(floor & (((c.xx - x + 64) // 4).astype(int) % 2 == 0), RAMPS["sg"][2])
    # arch: pillars and lintel
    for side in (-1, 1):
        px = x + side * 23
        col = c.rect(px - 3, BASE - 38, px + 3, BASE)
        c.fill(col, 0.15 + 0.6 * c.lin(px - 3, 0, px + 3, 0) * (0.6 + 0.4 * c.lin(0, BASE, 0, BASE - 38)), "sg", hi=3)
        for y in (BASE - 30, BASE - 8):
            c.set(c.rect(px - 3, y, px + 3, y + 1), RAMPS["cyan"][2])
        crystal(c, px, BASE - 38, 7, 12, 0.05, side * 0.5, "qz" if side < 0 else "cyan")
    arch = c.ring(x, BASE - 38, 24, 2, 12) & (c.yy < BASE - 38)
    c.fill(arch, 0.25 + 0.55 * c.lin(x - 24, 0, x + 24, 0), "sg", hi=3)
    # constellation in the arch
    pts = [(x - 15, BASE - 42), (x - 7, BASE - 47), (x + 3, BASE - 45), (x + 12, BASE - 48)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        c.set(c.line(x0, y0, x1, y1, 1) & c.empty() & ((c.xx.astype(int) % 2) == 0), RAMPS["cyan"][1])
    for i, (px, py) in enumerate(pts):
        b = tw(f, i + 7)
        c.spark(px, py, RAMPS["sg"][4 if b > .5 else 3], 1 if b > .7 else 0)
    # light beam from the upper left into the hanging star, split to the floor
    beam = c.line(x - 30, BASE - 62, x - 4, sy, 1.0) & c.empty() & (((c.yy.astype(int) + f) % 2) == 0)
    c.fill(beam, 0.2 + 0.6 * c.lin(x - 30, 0, x, 0), "sg", outline=False, lo=1, hi=3)
    for i, (dx1, rn) in enumerate([(-12, "cyan"), (-4, "sg"), (4, "sg"), (12, "mag")]):
        x1 = x + dx1
        m = c.line(x, sy + 6, x1, BASE - 1, 1) & c.empty()
        c.fill(m, 0.4 + 0.5 * c.lin(x, sy, x1, BASE), rn, outline=False, lo=2, hi=3)
        t = (f / FRAMES + i / 4) % 1
        c.spark(x + dx1 * t, sy + 6 + (BASE - 1 - sy - 6) * t, RAMPS[rn][4], 0)
        c.set(c.rect(x1 - 2, BASE - 1, x1 + 3, BASE), RAMPS[rn][3 if (f + i) % 2 else 4])
    # hanging starglass, turning an eighth per loop
    c.set(c.line(x, BASE - 50, x, sy - 9, 1), RAMPS["gr"][3])
    rot = (f / FRAMES) * (TAU / 8)
    star(c, x, sy, 11, 0.05, "cyan", 0.32, rot + TAU / 8)
    star(c, x, sy, 9, 0.35, "sg", 0.24, rot)
    c.set(c.disc(x, sy, 1.6), RAMPS["sg"][4])
    # small crystals at the pillar feet
    crystal(c, x - 15, BASE, 5, 8, -0.05, -1, "qz")
    crystal(c, x + 16, BASE, 5, 7, -0.05, 1, "mag")
    crystal(c, x - 10, BASE, 3, 5, -0.05, 0, "lime")
    crystal(c, x + 11, BASE, 3, 5, -0.05, 0, "cyan")
    orbiters(c, x, sy, 30, 6, 4, f, 1, True, "mag", 0.2)


# =====================================================================================================================
# zone 10 HOLLOW FORGE  /  Voidsteel.  Ramps: vs, accents mag + rn, plus gr
# =====================================================================================================================
def ingot(c, x, y, w, v=0.0, hot=False):
    """The zone icon's bar: top, front, side. (x, y) = back-left top corner."""
    d = max(1.5, w * 0.15)
    hg = max(2, w * 0.25)
    top = c.poly([(x, y), (x + w, y), (x + w + d, y + d), (x + d, y + d)])
    front = c.rect(x + d, y + d, x + w + d, y + d + hg)
    side = c.poly([(x, y), (x + d, y + d), (x + d, y + d + hg), (x, y + hg)])
    c.fill(side, 0.1 + v, "vs")
    c.fill(front, 0.2 + v + 0.2 * c.lin(x, y, x + w, y + hg), "vs")
    c.fill(top, 0.62 + v, "vs")
    if hot:
        c.set(c.rect(x + d + 1, y + d + hg * 0.5, x + w + d - 1, y + d + hg * 0.5 + 1), RAMPS["mag"][3])


def stack(c, cx, base, w, n, hot_top=False):
    hg = max(2, w * 0.25) + max(1.5, w * 0.15)
    for k in range(n):
        ingot(c, cx - w / 2 - 1 + (k % 2), base - hg - k * (hg - 0.5), w, 0.05 * k, hot_top and k == n - 1)


def anvil(c, cx, base, w):
    h = w * 0.5
    face = c.poly([(cx - w * 0.75, base - h), (cx + w / 2, base - h), (cx + w / 2, base - h * 0.68),
                   (cx + w * 0.2, base - h * 0.55), (cx + w * 0.2, base - h * 0.25), (cx + w * 0.4, base),
                   (cx - w * 0.4, base), (cx - w * 0.22, base - h * 0.25), (cx - w * 0.22, base - h * 0.55),
                   (cx - w / 2, base - h * 0.68)])
    c.fill(face, 0.15 + 0.45 * c.lin(cx - w / 2, base, cx + w / 2, base - h), "gr")
    c.set(c.rect(cx - w * 0.7, base - h, cx + w / 2, base - h + 1), RAMPS["gr"][4])
    return base - h


def sparks(c, cx, cy, n, f, spread, seed, ramps=("rn", "mag")):
    rng = np.random.default_rng(seed)
    for i in range(n):
        a = rng.uniform(-TAU * 0.45, -TAU * 0.05)
        sp = rng.uniform(0.5, 1.0) * spread
        t = (f / FRAMES + i / n) % 1
        x = cx + math.cos(a) * sp * t
        y = cy + math.sin(a) * sp * t + spread * 0.5 * t * t
        rn = ramps[i % len(ramps)]
        c.px(x, y, RAMPS[rn][4 if t < .35 else 3])
        if t < 0.5:
            c.px(x - math.cos(a), y - math.sin(a), RAMPS[rn][2])


def mouth_fire(c, mask, top, bottom, f):
    heat = c.lin(0, bottom, 0, top)
    flick = [0.0, 0.12, 0.04, 0.16, 0.06, 0.1][f]
    c.fill(mask & (heat < 0.55 + flick), 0.6 + 0.4 * (1 - heat), "mag", outline=False)
    c.fill(mask & (heat >= 0.55 + flick), 0.65 + 0.35 * (1 - heat), "rn", outline=False)


def furnace(c, cx, base, w, h, f, chimney=False):
    body = c.rect(cx - w / 2, base - h, cx + w / 2, base)
    c.fill(body, 0.12 + 0.35 * c.lin(cx - w / 2, 0, cx + w / 2, 0) + 0.15 * c.lin(0, base, 0, base - h), "vs", hi=3)
    for y in (base - h + 2, base - 3):
        c.set(c.rect(cx - w / 2, y, cx + w / 2, y + 1), RAMPS["vs"][1])
        for x in np.arange(cx - w / 2 + 2, cx + w / 2 - 1, 4):
            c.px(x, y, RAMPS["vs"][3])
    mw, mh = w * 0.5, h * 0.45
    mouth = c.poly([(cx - mw / 2, base - 3), (cx - mw / 2, base - 3 - mh * 0.6), (cx, base - 3 - mh), (cx + mw / 2, base - 3 - mh * 0.6), (cx + mw / 2, base - 3)])
    mouth_fire(c, mouth, base - 3 - mh, base - 3, f)
    c.outline(mouth, "vs")
    for i, rn in enumerate(("cyan", "lime", "rn")):
        if w >= 16:
            c.px(cx - w / 2 + 2 + i * 2, base - h + 5, RAMPS[rn][4 if (f + i) % 3 == 0 else 2])
    if chimney:
        cw = max(3, w * 0.22)
        x1 = cx + w / 2 - 2
        ch = c.rect(x1 - cw, base - h - h * 0.45, x1, base - h)
        c.fill(ch, 0.15 + 0.35 * c.lin(x1 - cw, 0, x1, 0), "vs", hi=3)
        for i in range(2):  # smoke puffs
            t = (f / FRAMES + i / 2) % 1
            sx = x1 - cw / 2 + math.sin(TAU * t) * 1.5
            sy = base - h - h * 0.45 - 2 - t * 8
            c.glow(sx, sy, 2.5 + t * 2.5, "gr", 1.0 - t * 0.5, 1 if t < .5 else 0)


def void_ring(c, cx, cy, r, f, ry):
    """The hollow: a black core ringed by a turning violet / magenta band, motes spiralling in."""
    k = ry / r
    dy = (c.yy - cy) / k
    d = np.hypot(c.xx - cx, dy)
    ang = (np.arctan2(dy, c.xx - cx) / TAU) % 1
    band = (d <= r) & (d >= r * 0.6)
    swirl = 0.5 + 0.5 * np.sin(TAU * (ang * 3 - f / FRAMES))
    rim = np.clip((d - r * 0.6) / (r * 0.4), 0, 1)
    c.fill(band & (swirl > 0.45), 0.3 + 0.7 * swirl * (1 - rim), "vs", outline=False)
    c.fill(band & (swirl <= 0.45), 0.4 + 0.9 * swirl * (1 - rim), "mag", outline=False, hi=3)
    core = d < r * 0.6
    c.set(core, RAMPS["vs"][0])
    c.set(core & (d > r * 0.52), RAMPS["vs"][4])
    c.outline(band | core, "vs")
    for i in range(5):
        a = TAU * (i / 5 + f / (FRAMES * 5))
        rr = r * (1.35 - 0.06 * ((f + i) % FRAMES))
        c.px(cx + rr * math.cos(a), cy + rr * k * math.sin(a), RAMPS["mag"][4 if i % 2 else 3], True)


def hammer(c, px, py, length, f):
    """Arm pivoting at (px, py); swings down to strike on frame 3."""
    ang = [-1.0, -0.8, -0.45, 0.0, -0.3, -0.7][f]
    hx, hy = px - length * math.cos(ang), py - length * math.sin(ang)
    c.fill(c.line(px, py, hx, hy, 1.6), 0.5, "gr", outline=False)
    head = c.rect(hx - 4, hy - 3, hx + 3, hy + 3)
    c.fill(head, 0.25 + 0.5 * c.lin(hx - 4, hy + 3, hx + 3, hy - 3), "vs")
    c.set(c.disc(px, py, 1.8), RAMPS["gr"][4])
    return hx, hy


def vs_1(c, f):
    x = SLOT[1]
    ingot(c, x - 5, BASE - 5, 8)
    if f in (1, 2):
        c.px(x + 4, BASE - 6, RAMPS["vs"][4])


def vs_2(c, f):
    stack(c, SLOT[2], BASE, 10, 3)


def vs_3(c, f):
    """Plate: three wide plates stacked like the zone icon, the ring on top pulsing."""
    x = SLOT[3]
    for k in range(3):
        y = BASE - 4 - k * 4
        top = c.poly([(x - 8, y), (x + 6, y), (x + 8, y + 1.5), (x - 6, y + 1.5)])
        front = c.rect(x - 6, y + 1.5, x + 8, y + 4)
        side = c.poly([(x - 8, y), (x - 6, y + 1.5), (x - 6, y + 4), (x - 8, y + 2.5)])
        c.fill(side, 0.1, "vs"); c.fill(front, 0.25 + 0.15 * k, "vs"); c.fill(top, 0.65 + 0.08 * k, "vs")
    ring = c.ring(x, BASE - 15, 2.6, 1.1, 1.6)
    c.set(ring, RAMPS["vs"][4] if wave(f) > .5 else RAMPS["mag"][3])


def vs_4(c, f):
    """Anvil: a hot bar on the anvil, the hammer coming down on frame 3 and throwing sparks."""
    x = SLOT[4]
    top = anvil(c, x + 1, BASE, 18)
    ingot(c, x - 6, top - 4, 9, 0.1, hot=True)
    hy = top - [14, 12, 9, 5, 8, 12][f]
    c.fill(c.line(x + 1, hy, x + 10, hy - 6, 1.4), 0.5, "gr", outline=False)
    c.fill(c.rect(x - 3, hy - 2, x + 4, hy + 2), 0.3 + 0.5 * c.lin(x - 3, hy + 2, x + 4, hy - 2), "vs")
    if f in (3, 4):
        sparks(c, x, top - 3, 8, (f - 3) * 3, 9, 4)


def vs_5(c, f):
    """Crucible: a tilted pot on a frame pouring molten voidsteel into a mould, smoke rising."""
    x = SLOT[5]
    c.glow(x, BASE - 8, 18, "mag", 0.7, 0)
    # frame
    for px in (x - 12, x + 2):
        c.fill(c.rect(px, BASE - 26, px + 2, BASE), 0.4 + 0.3 * (px > x), "gr", outline=False)
    c.fill(c.rect(x - 13, BASE - 27, x + 5, BASE - 25), 0.7, "gr", outline=False)
    # pot, tipped toward the right
    pot = c.poly([(x - 10, BASE - 24), (x + 2, BASE - 20), (x - 1, BASE - 11), (x - 10, BASE - 13)])
    c.fill(pot, 0.12 + 0.45 * c.lin(x - 10, BASE - 13, x + 2, BASE - 24), "vs", hi=3)
    c.set(c.line(x - 10, BASE - 24, x + 2, BASE - 20, 1.2), RAMPS["mag"][3])
    # pour
    for y in range(BASE - 20, BASE - 6):
        if (y + f) % 3 != 2:
            c.px(x + 3 + (y > BASE - 18), y, RAMPS["mag"][4 if (y + f) % 3 == 0 else 3])
    mould = c.rect(x - 2, BASE - 6, x + 12, BASE)
    c.fill(mould, 0.15 + 0.3 * c.lin(x - 2, 0, x + 12, 0), "vs", hi=3)
    c.fill(c.rect(x, BASE - 5, x + 10, BASE - 3), 0.5 + 0.4 * wave(f), "mag", outline=False, lo=2)
    sparks(c, x + 4, BASE - 6, 5, f, 7, 5)
    for i in range(2):
        t = (f / FRAMES + i / 2) % 1
        c.glow(x - 4 + math.sin(TAU * t) * 1.5, BASE - 28 - t * 6, 2.5 + 2 * t, "gr", 1 - t * 0.5, 1 if t < .5 else 0)


def vs_6(c, f):
    """Abyss: a riveted gate with a small hollow turning inside it, ingots waiting at its foot."""
    x = SLOT[6]
    cy = BASE - 20
    c.glow(x, cy, 22, "vs", 0.9, 0)
    gate = c.rect(x - 15, BASE - 38, x + 15, BASE) & ~c.disc(x, cy, 14)
    c.fill(gate, 0.12 + 0.4 * c.lin(x - 15, 0, x + 15, 0) + 0.1 * c.lin(0, BASE, 0, BASE - 38), "vs", hi=3)
    for y in (BASE - 36, BASE - 3):
        c.set(c.rect(x - 15, y, x + 15, y + 1), RAMPS["vs"][1])
        for rx in range(int(x - 13), int(x + 14), 4):
            c.px(rx, y, RAMPS["vs"][3])
    lights = [(x - 13, BASE - 30), (x + 13, BASE - 30), (x - 13, BASE - 10), (x + 13, BASE - 10)]
    for i, (lx, ly) in enumerate(lights):
        c.px(lx, ly, RAMPS["mag"][4 if (f + i) % 3 == 0 else 2])
    void_ring(c, x, cy, 13, f, 13)
    stack(c, x - 21, BASE, 6, 2)


def vs_7(c, f):
    """The Hollow Forge: a void ring held over a great cradle furnace by two pylons, beams feeding it, sparks and embers."""
    x = SLOT[7]
    ry = BASE - 38
    c.glow(x, ry, 30, "vs", 1.0, 1)
    c.glow(x, ry, 20, "mag", 0.7, 0)
    # pylons
    for side in (-1, 1):
        px = x + side * 26
        p = c.rect(px - 2, BASE - 46, px + 2, BASE)
        c.fill(p, 0.2 + 0.4 * c.lin(px - 2, 0, px + 2, 0), "gr")
        for y in range(BASE - 44, BASE - 4, 6):
            lit = ((y // 6) + f) % 3 == 0
            c.set(c.rect(px - 2, y, px + 2, y + 1), RAMPS[["cyan", "vs", "lime"][(y // 6) % 3]][4 if lit else 1])
        c.fill(c.rect(px - 3, BASE - 48, px + 3, BASE - 45), 0.7, "vs")
        beam = c.line(px, BASE - 47, x + side * 13, ry - 2, 1) & c.empty()
        c.set(beam, RAMPS["mag"][3 if (f + (side > 0)) % 2 == 0 else 2])
    void_ring(c, x, ry, 16, f, 14)
    # cradle furnace under it
    cr = c.poly([(x - 20, BASE - 18), (x + 20, BASE - 18), (x + 15, BASE), (x - 15, BASE)])
    c.fill(cr, 0.12 + 0.4 * c.lin(x - 20, 0, x + 20, 0), "vs", hi=3)
    c.set(c.rect(x - 20, BASE - 18, x + 20, BASE - 17), RAMPS["vs"][3])
    for rx in range(int(x - 16), int(x + 17), 5):
        c.px(rx, BASE - 15, RAMPS["vs"][3])
    mouth = c.rect(x - 9, BASE - 12, x + 9, BASE - 3) & ~c.disc(x - 9, BASE - 12, 2) & ~c.disc(x + 9, BASE - 12, 2)
    mouth_fire(c, mouth, BASE - 12, BASE - 3, f)
    c.outline(mouth, "vs")
    # stream of molten voidsteel falling from the ring into the cradle
    for y in range(ry + 13, BASE - 18):
        if (y + f) % 3 != 2:
            c.px(x, y, RAMPS["mag"][4 if (y + f) % 3 == 0 else 3])
    sparks(c, x, BASE - 18, 10, f, 14, 31)
    # ingots ready at its feet
    stack(c, x - 18, BASE, 6, 2)
    stack(c, x + 19, BASE, 6, 3, hot_top=True)
    # coolant lines into the cradle
    for side, rn in ((-1, "cyan"), (1, "lime")):
        c.set(c.line(x + side * 26, BASE - 6, x + side * 20, BASE - 10, 1.2), RAMPS[rn][2])
        c.px(x + side * (26 - (f % 3) * 2), BASE - 6 - (f % 3) * 1.3, RAMPS[rn][4])


# =====================================================================================================================
# zone 11 STILL ROOM  /  Chrono.  Ramps: ch, accents rn (brass) + cyan (glass), plus wh
# =====================================================================================================================
def gear(c, cx, cy, r, teeth, f, rn="rn", dirn=1):
    """Chunky pixel gear: square teeth, four spokes, a dark hub. The teeth turn exactly one pitch per loop, so frame 5 runs
    into frame 0. Shaded in flat bands (light top-left, dark bottom-right) so small gears stay crisp."""
    teeth = min(teeth, 8)
    rot = dirn * (TAU / teeth) * (f / FRAMES)
    dx, dy = c.xx - cx, c.yy - cy
    ang = np.arctan2(dy, dx) - rot
    d = np.hypot(dx, dy)
    body = (d <= r * 0.74) | ((d <= r) & (np.cos(ang * teeth) > 0.25))
    if r >= 8:
        win = (d > r * 0.3) & (d < r * 0.56)
        spoke = np.zeros_like(win)
        for k in range(4):
            a = k * TAU / 4 + rot
            ux, uy = math.cos(a), math.sin(a)
            along = dx * ux + dy * uy
            spoke |= (np.abs(-dx * uy + dy * ux) < 0.9) & (along > 0)
        body &= ~(win & ~spoke)
    v = c.lin(cx - r, cy - r, cx + r, cy + r)
    c.fill(body, 1 - v, rn, lo=2, hi=4, amp=0.0)
    c.set(c.disc(cx, cy, max(1.0, r * 0.22)) & body, RAMPS[rn][1])
    c.px(cx, cy, RAMPS[rn][4])
    return body


def hourglass(c, cx, cy, h, f, sand=0.6):
    w = h * 0.56
    cap = max(1.5, round(h * 0.1))
    t0, b1 = cy - h / 2, cy + h / 2
    for p in (cx - w / 2 - 1, cx + w / 2):
        c.fill(c.rect(p, t0 + cap, p + 1, b1 - cap), 0.5, "rn", outline=False)
    gt = c.poly([(cx - w / 2, t0 + cap), (cx + w / 2, t0 + cap), (cx + 0.8, cy), (cx - 0.8, cy)])
    gb = c.poly([(cx - 0.8, cy), (cx + 0.8, cy), (cx + w / 2, b1 - cap), (cx - w / 2, b1 - cap)])
    c.fill(gt | gb, 0.2 + 0.3 * c.lin(cx - w / 2, 0, cx + w / 2, 0), "cyan", outline=False, hi=2)
    lvl = t0 + cap + (h / 2 - cap) * (1 - sand)
    c.fill(gt & (c.yy >= lvl), 0.45 + 0.4 * c.lin(0, cy, 0, lvl), "ch", outline=False)
    ph = (h / 2 - cap) * (1 - sand) * 0.9 + 1
    pile = gb & (c.yy >= b1 - cap - ph) & (np.abs(c.xx - cx) <= (c.yy - (b1 - cap - ph)) * 1.8 + 0.6)
    c.fill(pile, 0.55 + 0.35 * c.lin(0, b1, 0, cy), "ch", outline=False)
    # the stream: one grain shimmers down it each loop
    for y in range(int(cy), int(b1 - cap - ph)):
        if (y - int(cy) + f) % 3 == 0:
            c.px(cx, y, RAMPS["ch"][4])
    c.fill(c.rect(cx - w / 2 - 1.5, t0, cx + w / 2 + 1.5, t0 + cap) | c.rect(cx - w / 2 - 1.5, b1 - cap, cx + w / 2 + 1.5, b1),
           0.45 + 0.45 * c.lin(cx - w / 2, 0, cx + w / 2, 0), "rn")
    c.outline(gt | gb, "ch", 0)
    if h >= 14:
        c.set(c.line(cx - w / 2 + 1.5, t0 + cap + 1.5, cx - 1.5, cy - 2, 1) & gt, RAMPS["cyan"][4])


def dial(c, cx, cy, r, f, ticks=12, ry=None):
    ry = ry or r
    face = c.disc(cx, cy, r, ry)
    c.fill(face, 0.15 * c.rad(cx, cy - r * 0.3, r * 1.5), "ch", outline=False, lo=0, hi=1)
    c.set(c.ring(cx, cy, r, 1.4, ry), RAMPS["rn"][3])
    if r >= 10:
        c.set(c.ring(cx, cy, r - 2.5, 1, ry * (r - 2.5) / r), RAMPS["ch"][2])
    for k in range(ticks):
        a = k * TAU / ticks
        big = k % (ticks // 4) == 0
        d0, d1 = r - 2, r - (5 if big else 3.5)
        c.set(c.line(cx + d0 * math.cos(a), cy + d0 * ry / r * math.sin(a), cx + d1 * math.cos(a), cy + d1 * ry / r * math.sin(a), 1),
              RAMPS["ch"][4 if big else 3])
    # hands held on one instant; the second hand trembles back and forth on it
    c.set(c.line(cx, cy, cx + r * 0.6 * math.cos(-0.5), cy + r * 0.6 * math.sin(-0.5), 1.4), RAMPS["ch"][3])
    c.set(c.line(cx, cy, cx + r * 0.4 * math.cos(-2.1), cy + r * 0.4 * math.sin(-2.1), 1.8), RAMPS["rn"][4])
    sa = 1.15 + [0, .035, .05, .035, 0, -.035][f]
    c.set(c.line(cx, cy, cx + r * 0.78 * math.cos(sa), cy + r * 0.78 * math.sin(sa), 1), RAMPS["wh"][3])
    c.set(c.disc(cx, cy, max(1, r * 0.08)), RAMPS["rn"][4])


def pendulum(c, px, py, length, f, bob_r):
    a = [0.0, 0.05, 0.07, 0.05, 0.0, -0.05][f]  # barely moves: the room holds it
    bx, by = px + length * math.sin(a), py + length * math.cos(a)
    c.set(c.line(px, py, bx, by, 1), RAMPS["rn"][2])
    c.fill(c.disc(bx, by, bob_r), 0.4 + 0.5 * c.lin(bx - bob_r, by + bob_r, bx + bob_r, by - bob_r), "rn")


def motes(c, n, f, seed, box, ramps=("ch", "rn", "cyan")):
    """Dust hanging in the air: each mote blinks where it is instead of drifting."""
    rng = np.random.default_rng(seed)
    x0, y0, x1, y1 = box
    for i in range(n):
        x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
        b = tw(f, i * 1.7 + seed)
        if b > 0.3:
            c.px(x, y, RAMPS[ramps[i % len(ramps)]][2 if b < 0.75 else 4], True)


def ch_1(c, f):
    hourglass(c, SLOT[1], BASE - 4, 8, f, 0.7)


def ch_2(c, f):
    """Minute: a pocket watch on its chain, the second hand ticking round a sixth per frame."""
    x = SLOT[2]
    cy = BASE - 5
    c.fill(c.disc(x, cy, 5), 0.15, "ch", lo=0, hi=1)
    c.set(c.ring(x, cy, 5, 1), RAMPS["rn"][3])
    c.set(c.rect(x - 1, cy - 7, x + 1, cy - 5), RAMPS["rn"][4])
    for k in range(4):
        a = k * TAU / 4
        c.px(x + 3.4 * math.cos(a), cy + 3.4 * math.sin(a), RAMPS["ch"][3])
    a = -TAU / 4 + TAU * f / FRAMES
    c.set(c.line(x, cy, x + 3.2 * math.cos(a), cy + 3.2 * math.sin(a), 1), RAMPS["wh"][4])
    for i in range(4):
        c.px(x + 6 + i, cy - 6 + (i % 2), RAMPS["rn"][2])


def ch_3(c, f):
    x = SLOT[3]
    gear(c, x + 4, BASE - 10, 6, 7, f, "ch", -1)
    hourglass(c, x - 3, BASE - 7, 14, f, 0.62)


def ch_4(c, f):
    """Loop: a ring of track with a bright pulse running one lap per loop, a small hourglass held in the middle."""
    x = SLOT[4]
    cy = BASE - 11
    track = c.ring(x, cy, 10, 1.6)
    ang = (np.arctan2(c.yy - cy, c.xx - x) / TAU - f / FRAMES) % 1
    c.fill(track & (ang < 0.34), 1 - ang * 2, "ch", outline=False, lo=1, hi=4, amp=0.0)
    c.fill(track & (ang >= 0.34) & (ang < 0.67), 1.2 - ang, "rn", outline=False, lo=1, hi=3, amp=0.0)
    c.fill(track & (ang >= 0.67), 1.3 - ang, "cyan", outline=False, lo=1, hi=3, amp=0.0)
    a = TAU * f / FRAMES
    c.spark(x + 9.2 * math.cos(a), cy + 9.2 * math.sin(a), RAMPS["wh"][4], 1)
    for k in range(4):
        t = k * TAU / 4 + TAU / 8
        c.px(x + 12 * math.cos(t), cy + 12 * math.sin(t), RAMPS["rn"][3])
    hourglass(c, x, cy, 10, f, 0.5)


def ch_5(c, f):
    x = SLOT[5]
    c.glow(x, BASE - 14, 18, "ch", 0.8, 0)
    gear(c, x + 10, BASE - 18, 7, 8, f, "rn", 1)
    gear(c, x - 10, BASE - 8, 6, 7, f, "ch", -1)
    gear(c, x + 11, BASE - 5, 4, 6, f, "cyan", -1)
    hourglass(c, x, BASE - 14, 28, f, 0.58)


def ch_6(c, f):
    """Eternity: a clock face on a brass stand, gears turning behind it, a figure-eight orbit with a bead that never stops."""
    x = SLOT[6]
    cy = BASE - 22
    c.glow(x, cy, 24, "cyan", 0.7, 0)
    # lemniscate path behind the dial
    for k in range(80):
        t = k * TAU / 80
        s_ = 1 + math.sin(t) ** 2
        px, py = x + 19 * math.cos(t) / s_, cy - 2 + 19 * math.sin(t) * math.cos(t) / s_
        if k % 2 == 0:
            c.px(px, py, RAMPS["cyan"][1], True)
    gear(c, x - 14, cy - 10, 8, 9, f, "rn", 1)
    gear(c, x + 15, cy + 6, 9, 10, f, "ch", -1)
    stand = c.poly([(x - 3, cy + 12), (x + 3, cy + 12), (x + 8, BASE), (x - 8, BASE)])
    c.fill(stand, 0.3 + 0.5 * c.lin(x - 8, 0, x + 8, 0), "rn")
    dial(c, x, cy, 13, f, 12)
    t = TAU * f / FRAMES
    s_ = 1 + math.sin(t) ** 2
    c.spark(x + 19 * math.cos(t) / s_, cy - 2 + 19 * math.sin(t) * math.cos(t) / s_, RAMPS["cyan"][4], 1)


def ch_7(c, f):
    """The Still Room: a great dial with orrery rings, planets held mid-orbit, an hourglass at its heart, gears turning on both
    sides, a pendulum that barely moves, dust hanging in the air."""
    x = SLOT[7]
    cy = BASE - 30
    c.glow(x, cy, 32, "ch", 1.0, 0)
    c.glow(x, cy, 20, "cyan", 0.6, 1)
    # floor boards
    fl = c.poly([(x - 30, BASE), (x + 30, BASE), (x + 27, BASE + 2), (x - 27, BASE + 2)])
    c.fill(fl, 0.25, "ch", outline=False, lo=0, hi=1)
    c.set(fl & (((c.xx - x + 64) // 5).astype(int) % 2 == 0), RAMPS["ch"][2])
    # side gears
    gear(c, x - 24, BASE - 9, 9, 10, f, "rn", 1)
    gear(c, x - 26, BASE - 26, 6, 7, f, "cyan", -1)
    gear(c, x + 27, BASE - 28, 5, 6, f, "qz", 1)
    gear(c, x + 24, BASE - 11, 10, 11, f, "ch", -1)
    # the dial
    dial(c, x, cy, 20, f, 24)
    # orrery rings over it (dotted), with planets held still that pulse
    for k, (rx, ry, n, rn) in enumerate([(27, 7, 3, "cyan"), (30, 12, 2, "wh")]):
        m = c.ring(x, cy, rx, 1, ry) & c.empty() & ((c.xx.astype(int) % 2) == 0)
        c.set(m, RAMPS[rn][1 + k])
        for j in range(n):
            a = j * TAU / n + 0.5 + k * 1.3
            px, py = x + rx * math.cos(a), cy + ry * math.sin(a)
            c.fill(c.disc(px, py, 2.2 - k * 0.4), 0.45 + 0.4 * tw(f, j + 3 * k), ["cyan", "rn", "ch"][(j + k) % 3])
    # the hourglass at its heart, on a pedestal
    c.fill(c.rect(x - 5, BASE - 4, x + 5, BASE), 0.6, "rn")
    hourglass(c, x, BASE - 14, 20, f, 0.55)
    # pendulum hung from the right gear
    pendulum(c, x + 24, BASE - 46, 22, f, 2.6)
    c.fill(c.rect(x + 20, BASE - 48, x + 28, BASE - 45), 0.6, "rn")
    motes(c, 18, f, 77, (x - 32, BASE - 58, x + 32, BASE - 4), ("ch", "cyan", "wh"))


# =====================================================================================================================
# backdrops (Nate picked "busier, more colour": dense scenery in several palette ramps, kept to dark shades 0-2 so the
# sprites still read on top, bright accents only as small moving points)
# =====================================================================================================================
def quiet_dim(c):
    """Under the big number only dark shades survive."""
    x0, y0, x1, y1 = QUIET
    q = c.rect(x0, y0, x1, y1) & (c.img[..., 3] == 255) & (c.img[..., :3].max(axis=2) > 120)
    c.img[q] = (0, 0, 0, 0)


def ribbon(c, y0, amp, freq, phase, th, rn, alpha, shade=1):
    """An aurora ribbon: translucent haze band with a dotted bright edge, its wave shifting one period per loop."""
    yc = y0 + amp * np.sin(TAU * (c.xx / freq + phase))
    band = (c.yy > yc) & (c.yy < yc + th + 3 * np.sin(TAU * (c.xx / (freq * 0.7) + phase * 2)))
    c.haze(band & ((c.bayer + .5) < 0.75 * c.lin(0, 0, W, 0) + 0.15), rn, shade, alpha)
    edge = (np.abs(c.yy - yc) < 0.6) & (((c.xx.astype(int) + int(phase * 40)) % 5) == 0) & c.empty()
    c.set(edge & ((c.bayer + .5) < 0.1 + 0.5 * c.lin(0, 0, W, 0)), RAMPS[rn][2])


def sg_bg(c, f):
    rng = np.random.default_rng(9)
    hz = BASE - 2
    ph = f / FRAMES
    # a pale ringed planet low in the middle of the sky
    px_, py_ = 150, 18
    pl = c.disc(px_, py_, 9)
    c.fill(pl, 0.25 + 0.5 * c.lin(px_ - 9, py_ + 9, px_ + 9, py_ - 9), "qz", outline=False, lo=0, hi=2)
    c.set(pl & (np.abs(c.yy - py_ - 2 - (c.xx - px_) * 0.15) < 0.6), RAMPS["qz"][1])
    ringm = c.ring(px_, py_, 15, 1, 3.2) & ~(pl & (c.yy < py_ + (c.xx - px_) * 0.0))
    c.set(ringm & c.empty(), RAMPS["cyan"][2])
    # aurora ribbons
    ribbon(c, 6, 3, 90, ph, 5, "cyan", 60)
    ribbon(c, 13, 4, 120, -ph + .3, 4, "qz", 55)
    ribbon(c, 22, 3, 70, ph + .6, 3, "lime", 45, 0)
    # stars in every accent
    for i in range(130):
        x, y = rng.uniform(16, W - 2), rng.uniform(2, hz - 10)
        b = tw(f, i)
        rn = ["sg", "cyan", "mag", "qz", "lime", "rn"][i % 6]
        if b > 0.25:
            c.px(x, y, RAMPS[rn][1 if b < .55 else (2 if b < .85 else 3)], True)
        if b > 0.93 and i % 5 == 0:
            c.spark(x, y, RAMPS[rn][2], 1, True)
    # two constellations
    for pts, rn in (([(70, 30), (84, 24), (98, 28), (110, 20)], "cyan"), ([(178, 8), (192, 14), (204, 6)], "mag")):
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            c.set(c.line(x0, y0, x1, y1, 1) & ((c.xx.astype(int) % 3) == 0) & c.empty(), RAMPS[rn][1])
        for i, (x, y) in enumerate(pts):
            c.px(x, y, RAMPS["sg"][3 if tw(f, i * 2 + y) > .5 else 2])
    # drifting shards (one shard spacing per loop)
    for i in range(14):
        x0 = (i * 37 + 60 * ph * 0) % W
        y0 = 26 + (i * 13) % 26
        x = (x0 + 6 * ph + i * 3) % W
        rn = ["cyan", "qz", "mag", "sg"][i % 4]
        d = c.poly([(x, y0 - 1.5), (x + 1, y0), (x, y0 + 1.5), (x - 1, y0)]) & c.empty()
        c.set(d, RAMPS[rn][2])
    # haze on the horizon, layered
    c.haze(c.rect(0, hz - 20, W, hz + 2) & ((c.bayer + .5) < 0.7 * c.lin(0, hz - 20, 0, hz) * (0.3 + 0.7 * c.lin(0, 0, W, 0))), "cyan", 1, 70)
    # crystal skyline in three ramps, two depths
    for depth, (n, hmin, hmax, shades) in enumerate([(34, 6, 18, (0, 1)), (26, 3, 10, (1, 2))]):
        for i in range(n):
            x = 24 + i * (264 / n) + rng.uniform(-3, 3)
            h = rng.uniform(hmin, hmax) * (0.5 + 0.6 * x / W)
            w = rng.uniform(4, 9) * (1 - depth * 0.3)
            rn = ["sg", "cyan", "qz", "sg", "mag"][(i + depth) % 5]
            m = c.poly([(x - w / 2, hz), (x - w / 2, hz - h * 0.6), (x, hz - h), (x + w / 2, hz - h * 0.6), (x + w / 2, hz)]) & c.empty()
            c.fill(m, c.lin(0, hz, 0, hz - h) * (0.3 + 0.7 * c.lin(0, 0, W, 0)), rn, outline=False, lo=shades[0], hi=shades[1])
            if depth == 1 and i % 3 == 0:
                c.px(x, hz - h + 1, RAMPS[rn][3 if tw(f, i) > .6 else 2])
    # floor lattice with glints running along the rails
    c.set(c.rect(0, hz, W, hz + 1), RAMPS["sg"][1])
    for i in range(-10, 40):
        m = c.line(144 + i * 4, hz, 144 + i * 12, H, 1) & (c.yy > hz + 1) & c.empty()
        c.set(m, RAMPS[["sg", "cyan", "qz"][i % 3]][1 if i % 2 else 0])
    for i in range(10):
        x = (i * 29 + 29 * ph * 0 + f * 5) % W
        c.px(x, hz, RAMPS[["cyan", "mag", "lime"][i % 3]][3])
    quiet_dim(c)


def vs_bg(c, f):
    rng = np.random.default_rng(10)
    ph = f / FRAMES
    # riveted plating
    q = 9
    col = (c.xx // q).astype(int)
    lx = c.xx - col * q
    ly = (c.yy + (col % 2) * q / 2) % q
    seam = ((lx < 1) | (ly < 1)) & (c.yy < BASE - 3)
    c.set(seam & ((c.bayer + .5) < 0.5 * c.lin(20, 0, W, 0)), RAMPS["vs"][0])
    # big pipes: one along the top, two dropping down, joints, valve wheels, a gauge
    def pipe(mask, rn, horiz):
        g = c.lin(0, 0, 0, 1) if False else None
        c.fill(mask & c.empty(), 0.5, rn, outline=False, lo=0, hi=2, amp=0.0)
    top = c.rect(40, 9, W, 13)
    c.fill(top & c.empty(), 0.0, "gr", outline=False, lo=1, hi=1)
    c.set(c.rect(40, 9, W, 10) & c.empty(), RAMPS["gr"][2])
    for x in range(52, W, 26):
        c.set(c.rect(x, 8, x + 3, 14), RAMPS["gr"][2])
    for x, rn in ((96, "cyan"), (136, "rn")):
        d = c.rect(x, 13, x + 4, BASE - 1)
        c.fill(d & c.empty(), 0.0, "gr", outline=False, lo=1, hi=1)
        c.set(c.rect(x, 13, x + 1, BASE - 1) & c.empty(), RAMPS["gr"][2])
        # coolant pulse running down the pipe
        y = 14 + ((f * 7) % (BASE - 16))
        c.set(c.rect(x + 1, y, x + 3, y + 3), RAMPS[rn][3])
        w_ = c.ring(x + 2, 30, 4, 1)
        c.set(w_, RAMPS[rn][2])
        c.set(c.line(x - 1, 30, x + 5, 30, 1) & c.disc(x + 2, 30, 4), RAMPS[rn][2])
    # monitors on the wall with scrolling readouts (code theme)
    for mx, my, rn in ((58, 22, "cyan"), (166, 26, "lime"), (180, 40, "mag")):
        scr = c.rect(mx, my, mx + 12, my + 8)
        c.set(scr, RAMPS["gr"][0])
        c.set(c.ring(mx + 6, my + 4, 7, 1, 5) & False, RAMPS["gr"][1])
        c.outline(scr, "gr", 1)
        for k in range(10):
            hgt = 1 + int(3 * (0.5 + 0.5 * math.sin(k * 1.3 + f * TAU / FRAMES + mx)))
            c.set(c.rect(mx + 1 + k, my + 7 - hgt, mx + 2 + k, my + 7), RAMPS[rn][2 if k % 2 else 3])
    # wall vents breathing heat
    for vx in (210, 240):
        for k in range(3):
            c.set(c.rect(vx, 30 + k * 3, vx + 14, 31 + k * 3), RAMPS["mag" if (f + k) % 3 else "rn"][2])
    # hazard stripe beam
    beam = c.rect(40, 42, 92, 45)
    stripes = ((c.xx + c.yy).astype(int) // 3) % 2 == 0
    c.set(beam & stripes & c.empty(), RAMPS["rn"][2])
    c.set(beam & ~stripes & c.empty(), RAMPS["gr"][1])
    # hanging chains
    for i, x in enumerate([118, 196]):
        ln = 16 + i * 8
        for y in range(14, ln, 2):
            c.px(x, y, RAMPS["gr"][1 if (y // 2) % 2 else 2], True)
        c.set(c.ring(x, ln + 2, 2.2, 1) & (c.yy > ln + 1) & c.empty(), RAMPS["gr"][2])
    # heat haze
    c.haze(c.rect(0, BASE - 22, W, BASE - 2) & ((c.bayer + .5) < c.lin(0, BASE - 22, 0, BASE - 2) * 0.8 * c.lin(0, 0, W, 0)), "mag", 0, 80)
    # molten channel and a conveyor of small ingots sliding right one gap per loop
    chan = c.rect(0, BASE, W, BASE + 2)
    flow = 0.5 + 0.5 * np.sin(TAU * (c.xx / 24 + ph))
    c.fill(chan, (0.25 + 0.7 * flow) * (0.3 + 0.7 * c.lin(0, 0, W, 0)), "mag", outline=False, hi=4)
    c.set(c.rect(0, BASE - 1, W, BASE), RAMPS["vs"][1])
    for k in range(30):
        x = 40 + k * 12 + 12 * ph
        if x < W - 3:
            c.set(c.rect(x, BASE - 3, x + 4, BASE - 1) & c.empty(), RAMPS[["vs", "rn", "cyan"][k % 3]][2])
    # far void ring
    c.set(c.ring(226, 18, 8, 1) & ((c.bayer + .5) < .7) & c.empty(), RAMPS["qz"][1])
    c.set(c.ring(226, 18, 4.5, 1) & ((c.bayer + .5) < .6) & c.empty(), RAMPS["mag"][1])
    # embers in three colours
    for i in range(60):
        x0, y0 = rng.uniform(30, W), rng.uniform(14, BASE - 2)
        t = (ph + rng.uniform()) % 1
        y = y0 - 9 * t
        c.px(x0 + math.sin(TAU * (t + i * .1)), y, RAMPS[["mag", "rn", "qz"][i % 3]][2 if t < .6 else 1], True)
    quiet_dim(c)


def ch_bg(c, f):
    rng = np.random.default_rng(11)
    ph = f / FRAMES
    # window light falling across the room
    for k in range(3):
        x0 = 120 + k * 46
        shaft = c.poly([(x0, 0), (x0 + 16, 0), (x0 - 24, BASE), (x0 - 44, BASE)])
        c.haze(shaft & ((c.bayer + .5) < 0.45), "rn", 1, 50)
    # vast dial arcs in two colours
    cx, cy, r = 190, 92, 80
    for k, (rr, rn) in enumerate([(r, "ch"), (r - 7, "rn"), (r - 18, "cyan"), (r - 34, "ch")]):
        m = c.ring(cx, cy, rr, 1) & ((c.bayer + .5) < [0.7, 0.5, 0.45, 0.35][k]) & (c.yy < BASE - 1)
        c.set(m & c.empty(), RAMPS[rn][1])
    for k in range(60):
        a = k * TAU / 60 + TAU / 2
        big = k % 5 == 0
        d0, d1 = r - 1, r - (6 if big else 3)
        m = c.line(cx + d0 * math.cos(a), cy + d0 * math.sin(a), cx + d1 * math.cos(a), cy + d1 * math.sin(a), 1) & (c.yy < BASE - 1) & c.empty()
        c.set(m, RAMPS["rn" if big else "ch"][2 if big else 1])
    sa = -2.0 + [0, .012, .018, .012, 0, -.012][f]
    c.set(c.line(cx, cy, cx + (r - 8) * math.cos(sa), cy + (r - 8) * math.sin(sa), 1) & (c.yy < BASE - 1) & c.empty(), RAMPS["ch"][2])
    # small clocks hanging on chains, each a different colour, all stopped
    for i, (hx, ln, rr, rn) in enumerate([(60, 18, 5, "cyan"), (88, 10, 4, "qz"), (112, 24, 6, "lime"), (176, 14, 5, "rn"), (204, 30, 4, "mag")]):
        for y in range(0, ln - rr, 2):
            c.px(hx, y, RAMPS["gr"][1], True)
        face = c.disc(hx, ln, rr) & c.empty()
        c.fill(face, 0.3, rn, outline=False, lo=0, hi=1)
        c.set(c.ring(hx, ln, rr, 1) & c.empty() | (c.ring(hx, ln, rr, 1) & face), RAMPS[rn][2])
        c.set(c.line(hx, ln, hx + rr * 0.6 * math.cos(i), ln + rr * 0.6 * math.sin(i), 1), RAMPS[rn][3])
        c.px(hx, ln, RAMPS["wh"][3])
    # a shelf with tiny hourglasses and books
    sy = 40
    c.set(c.rect(30, sy, 96, sy + 1), RAMPS["ch"][2])
    for k in range(9):
        bx = 34 + k * 7
        if k % 3 == 1:
            c.set(c.poly([(bx, sy - 6), (bx + 4, sy - 6), (bx + 2.5, sy - 3), (bx + 4, sy), (bx, sy), (bx + 1.5, sy - 3)]) & c.empty(), RAMPS["cyan"][1])
            c.set(c.rect(bx, sy - 7, bx + 5, sy - 6), RAMPS["rn"][2])
        else:
            hgt = 5 + (k * 3) % 3
            c.set(c.rect(bx, sy - hgt, bx + 3, sy) & c.empty(), RAMPS[["qz", "lime", "mag", "rn"][k % 4]][1])
            c.set(c.rect(bx, sy - hgt + 1, bx + 3, sy - hgt + 2) & c.empty(), RAMPS[["qz", "lime", "mag", "rn"][k % 4]][2])
    # gear outlines turning at the top
    for gx, gy, gr, t, d in [(140, 2, 13, 8, 1), (162, 14, 7, 7, -1)]:
        rot = d * (TAU / t) * ph
        ang = np.arctan2(c.yy - gy, c.xx - gx) - rot
        dd = np.hypot(c.xx - gx, c.yy - gy)
        body = ((dd <= gr * 0.76) | ((dd <= gr) & (np.cos(ang * t) > 0.25))) & ~c.disc(gx, gy, gr * 0.35)
        edge = np.zeros_like(body)
        edge[1:, :] |= ~body[:-1, :]; edge[:-1, :] |= ~body[1:, :]; edge[:, 1:] |= ~body[:, :-1]; edge[:, :-1] |= ~body[:, 1:]
        c.set(body & edge & c.empty(), RAMPS["rn"][1])
    # room haze, checker floor
    c.haze(c.rect(0, BASE - 18, W, BASE) & ((c.bayer + .5) < c.lin(0, BASE - 18, 0, BASE) * 0.7 * c.lin(0, 0, W, 0)), "ch", 1, 60)
    c.set(c.rect(0, BASE, W, BASE + 1), RAMPS["rn"][2])
    fl = c.rect(0, BASE + 1, W, H)
    chk = (((c.xx // 4).astype(int) + (c.yy // 1).astype(int)) % 2) == 0
    c.set(fl & chk & ((c.bayer + .5) < 0.2 + 0.8 * c.lin(0, 0, W, 0)), RAMPS["ch"][1])
    # dust held in the air, in every accent
    motes(c, 110, f, 5, (24, 2, W - 2, BASE - 2), ("ch", "rn", "cyan", "qz", "lime", "wh"))
    quiet_dim(c)



# =====================================================================================================================
ZONES = {
    "starglass": (sg_bg, [sg_1, sg_2, sg_3, sg_4, sg_5, sg_6, sg_7]),
    "voidsteel": (vs_bg, [vs_1, vs_2, vs_3, vs_4, vs_5, vs_6, vs_7]),
    "chrono": (ch_bg, [ch_1, ch_2, ch_3, ch_4, ch_5, ch_6, ch_7]),
}
# draw order inside a cell (back to front) and which sprites a row shows; row n = sprites 1..n
ORDER = [7, 6, 5, 4, 3, 2, 1]


def cell(zone, row, f):
    bg, sprites = ZONES[zone]
    c = Canvas()
    for n in ORDER:
        if n <= row:
            sprites[n - 1](c, f)
    x0, y0, x1, y1 = QUIET
    c.img[y0:y1, x0:x1] = 0
    # backdrop goes underneath: paint it on its own canvas and fill only where the sprites left holes
    b = Canvas()
    bg(b, f)
    holes = c.img[..., 3] == 0
    c.img[holes] = b.img[holes]
    return c.img


def check_quiet(img, zone):
    """Sprites must not reach into the top-right box (backdrop is allowed)."""
    x0, y0, x1, y1 = QUIET
    for row in range(1, ROWS):
        b = Canvas(); ZONES[zone][0](b, 0)
        a = img[row * H + y0: row * H + y1, x0: x1]
        base = b.img[y0:y1, x0:x1]
        diff = np.any(a != base, axis=2).sum()
        if diff:
            print(f"  ! {zone} row {row}: {diff} sprite px in the quiet corner")


def main():
    out = Path(__file__).resolve().parents[2] / "public/naos/nodefarm"
    only = sys.argv[1:] or list(ZONES)
    for zone in only:
        sheet = np.zeros((H * ROWS, W * FRAMES, 4), np.uint8)
        for row in range(ROWS):
            for f in range(FRAMES):
                sheet[row * H:(row + 1) * H, f * W:(f + 1) * W] = cell(zone, row, f)
        a = sheet[..., 3]
        assert np.all((a == 0) | (a == 255) | (a <= 90)), "alpha must be 0, 255 or haze <= 90"
        check_quiet(sheet, zone)
        im = Image.fromarray(sheet, "RGBA")
        png, webp = out / f"zone-{zone}.png", out / f"zone-{zone}.webp"
        im.save(png, optimize=True)
        im.save(webp, lossless=True, quality=100, method=6)
        kb = (png.stat().st_size // 1024, webp.stat().st_size // 1024)
        print(f"{zone}: png {kb[0]} KB, webp {kb[1]} KB" + ("  ! over budget" if kb[0] > 300 or kb[1] > 120 else ""))
        # preview: frame 0 of every row on the panel colour, 2x
        prev = Image.new("RGBA", (W, H * ROWS), (17, 19, 15, 255))
        prev.alpha_composite(im.crop((0, 0, W, H * ROWS)))
        prev.resize((W * 2, H * ROWS * 2), Image.NEAREST).save(f"/tmp/zone-art-{zone}.png")


if __name__ == "__main__":
    main()
