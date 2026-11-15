"""Starwright GUI art: icons, element tiles, panel frames and textures, all 4x4 Bayer dither.

Run: python3 scripts/starwright/ui-art/build.py
Writes public/starwright/ui/*.png (alpha 0 or 255) and public/starwright/ui/sheet-preview.png (8x contact sheet).
Every icon is drawn as a value field (0..1) plus a coverage field, then pushed through a short ramp built from one colour,
so the whole set shares one light direction (top left), one outline weight and one palette.
"""
import math, os
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUT = os.path.join(ROOT, "public", "starwright", "ui")
os.makedirs(OUT, exist_ok=True)

B4 = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float32) + 0.5) / 16.0
INK = np.array([5, 4, 14], np.float32)
WHITE = np.array([255, 255, 255], np.float32)


def hexc(h):
    return np.array([int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)], np.float32)


def ramp(c):
    c = hexc(c) if isinstance(c, str) else c
    mix = lambda a, b, t: a + (b - a) * t
    return np.array([mix(c, INK, .88), mix(c, INK, .66), mix(c, INK, .38), mix(c, INK, .12), c, mix(c, WHITE, .5), mix(c, WHITE, .85)], np.uint8)


def bayer(h, w):
    return np.tile(B4, (h // 4 + 1, w // 4 + 1))[:h, :w]


class Canvas:
    """A value field v (0..1, -1 = empty) on an n x n grid. Shapes add coverage; light comes from the top left."""

    def __init__(self, w, h=None):
        self.w, self.h = w, h or w
        yy, xx = np.mgrid[0:self.h, 0:self.w].astype(np.float32)
        self.x, self.y = xx + .5, yy + .5
        self.v = np.full((self.h, self.w), -1.0, np.float32)
        self.col = np.zeros((self.h, self.w), np.int32)  # which ramp each pixel uses
        self.ramps = []

    def use(self, c):
        self.ramps.append(ramp(c))
        return len(self.ramps) - 1

    def put(self, mask, val, r=0):
        val = np.broadcast_to(np.asarray(val, np.float32), self.v.shape)
        self.v = np.where(mask, val, self.v)
        self.col = np.where(mask, r, self.col)

    # shapes -------------------------------------------------------------------------------------------------
    def ball(self, cx, cy, rad, r=0, lo=.18, hi=1.0, light=True):
        d = np.hypot(self.x - cx, self.y - cy)
        m = d <= rad
        lx, ly = cx - rad * .45, cy - rad * .45
        sh = 1 - np.clip(np.hypot(self.x - lx, self.y - ly) / (rad * 1.7), 0, 1) if light else np.ones_like(d)
        self.put(m, lo + (hi - lo) * sh, r)
        return m

    def glow(self, cx, cy, rad, r=0, peak=.55):
        d = np.hypot(self.x - cx, self.y - cy)
        g = np.clip(1 - d / rad, 0, 1) ** 1.6 * peak
        m = (g > bayer(self.h, self.w) * .5) & (self.v < 0)
        self.put(m, g, r)

    def ring(self, cx, cy, rx, ry, th, r=0, val=.7, front=None):
        d = np.abs(np.hypot((self.x - cx) / rx, (self.y - cy) / ry) - 1) * min(rx, ry)
        m = d <= th / 2
        if front is not None:
            m &= (self.y >= cy) if front else (self.y < cy)
        self.put(m, val, r)

    def line(self, x0, y0, x1, y1, th, r=0, val=.8):
        px, py = self.x - x0, self.y - y0
        dx, dy = x1 - x0, y1 - y0
        L = dx * dx + dy * dy or 1
        t = np.clip((px * dx + py * dy) / L, 0, 1)
        d = np.hypot(px - t * dx, py - t * dy)
        m = d <= th / 2
        self.put(m, val, r)
        return m

    def poly(self, pts, r=0, lo=.25, hi=.95):
        m = np.zeros(self.v.shape, bool)
        n = len(pts)
        for i in range(n):  # even-odd fill
            (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % n]
            cond = ((y0 > self.y) != (y1 > self.y))
            xi = (x1 - x0) * (self.y - y0) / ((y1 - y0) or 1e-6) + x0
            m ^= cond & (self.x < xi)
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        t = ((self.x - min(xs)) / (max(xs) - min(xs) + 1e-6) + (self.y - min(ys)) / (max(ys) - min(ys) + 1e-6)) / 2
        self.put(m, hi - (hi - lo) * t, r)
        return m

    def rect(self, x0, y0, x1, y1, r=0, val=.6):
        m = (self.x >= x0) & (self.x < x1) & (self.y >= y0) & (self.y < y1)
        self.put(m, val, r)
        return m

    def dot(self, x, y, r=0, val=1.0):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.v[int(y), int(x)] = val
            self.col[int(y), int(x)] = r

    def outline(self, r=0, val=.02):
        """A 1px dark rim around everything drawn so far, so icons read on any background."""
        filled = self.v >= 0
        p = np.pad(filled, 1)
        near = p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
        m = near & ~filled
        self.put(m, val, r)

    def image(self):
        th = bayer(self.h, self.w)
        out = np.zeros((self.h, self.w, 4), np.uint8)
        filled = self.v >= 0
        for i, rp in enumerate(self.ramps):
            m = filled & (self.col == i)
            idx = np.clip(np.floor(np.clip(self.v, 0, 1) * (len(rp) - 1) + th), 0, len(rp) - 1).astype(np.int32)
            out[m, :3] = rp[idx][m]
        out[filled, 3] = 255
        return Image.fromarray(out, "RGBA")


def save(img, name):
    img.save(os.path.join(OUT, name + ".png"), optimize=True)
    SAVED.append((name, img))


SAVED = []

# ---- element tiles: 24 x 24, framed, art filling the frame ------------------------------------------------------------
ELEMENTS = [("h", "#5fb4ff"), ("he", "#ffc94d"), ("c", "#b4b9c4"), ("o", "#3fe0a0"), ("ne", "#ff5fc8"),
            ("mg", "#ff9a4d"), ("si", "#a98bff"), ("fe", "#e8e2d6"), ("au", "#ffd75e"), ("u", "#9dff6a")]


def frame(c, k, lit=True):
    """The shared tile: dark well, dithered inner wash, 1px rim, bright top-left bracket, dim bottom-right bracket."""
    n = c.w
    edge = (c.x < 1) | (c.y < 1) | (c.x > n - 1) | (c.y > n - 1)
    inner = ~edge
    wash = .1 + .14 * (1 - (c.x + c.y) / (2 * n))
    c.put(inner, wash, k)
    c.put(edge, .3, k)
    if lit:
        c.put(((c.x < 1) | (c.y < 1)) & (c.x < 7) & (c.y < 7), 1.0, k)
        c.put(((c.x > n - 1) | (c.y > n - 1)) & (c.x > n - 6) & (c.y > n - 6), .55, k)


T = 0.0  # animation phase 0..1, read by the element drawings


def el_h(c, k):
    pulse = .5 + .5 * math.sin(T * 2 * math.pi)
    c.glow(12, 12, 9 + 3 * pulse, k, .4 + .2 * pulse)
    c.ball(12, 12, 4.4 + .5 * pulse, k, .45, 1.0)
    c.dot(10, 10, k, 1.0)
    for a in range(4):  # a slowly turning four-point glint
        ang = a * math.pi / 2 + .4 + T * math.pi / 2
        c.line(12 + 6 * math.cos(ang), 12 + 6 * math.sin(ang), 12 + (8 + pulse) * math.cos(ang), 12 + (8 + pulse) * math.sin(ang), .9, k, .6)


def el_he(c, k):
    c.ring(12, 12, 9.2, 4, 1.1, k, .55, front=False)
    c.ball(9.8, 12.6, 3.6, k, .35, .95)
    c.ball(14.2, 11.4, 3.6, k, .4, 1.0)
    c.ring(12, 12, 9.2, 4, 1.1, k, .75, front=True)
    a = T * 2 * math.pi
    ex, ey = 12 + 9.2 * math.cos(a), 12 + 4 * math.sin(a)
    if math.sin(a) < 0 and abs(ex - 12) < 6:
        pass  # behind the nucleus
    else:
        c.ball(ex, ey, 1.4, k, .9, 1.0, light=False)


def el_c(c, k):
    pts = [(12 + 8.5 * math.cos(a), 12 + 8.5 * math.sin(a)) for a in [math.pi / 6 + i * math.pi / 3 for i in range(6)]]
    c.poly(pts, k, .18, .7)
    cx, cy = 12, 12
    for i in range(6):  # lattice spokes and rim nodes
        x, y = pts[i]
        c.line(cx, cy, x, y, 1, k, .55)
        c.line(x, y, *pts[(i + 1) % 6], 1, k, .8)
    for i, (x, y) in enumerate(pts):
        lit = (i - T * 6) % 6 < 1
        c.ball(x, y, 1.6 + .4 * lit, k, .7 if not lit else .95, 1.0)
    c.ball(cx, cy, 2.2, k, .6, 1.0)


def el_o(c, k):
    c.ball(12, 13, 7.2, k, .2, .95)
    c.put(np.hypot(c.x - 12, c.y - 13) < 4.2, .12, k)  # hollow bubble
    c.ball(12, 13, 2.2, k, .5, .95)
    c.ball(18.5, 6.5 - 3 * T, 2.2, k, .3, 1.0)
    c.ball(5.5, 6 - 3 * ((T + .5) % 1), 1.4, k, .3, 1.0)
    c.dot(8, 9, k, 1.0); c.dot(9, 8, k, 1.0)


def el_ne(c, k):
    pts = [(5, 7), (10, 7), (10, 17), (14, 17), (14, 7), (19, 7), (19, 17)]
    for a, b in zip(pts, pts[1:]):
        c.line(*a, *b, 4.2, k, .25)
    f = int(T * 8)
    bright = .45 if f in (5,) else (.75 if f == 6 else 1.0)  # a neon flicker
    for a, b in zip(pts, pts[1:]):
        c.line(*a, *b, 1.6, k, bright)
    c.rect(3, 5, 7, 9, k, .55); c.rect(17, 15, 21, 19, k, .55)


def el_mg(c, k):
    c.glow(12, 12, 11, k, .55)
    swap = int(T * 4) % 2
    for i in range(8):
        a = i * math.pi / 4
        L = 9.5 if (i + swap) % 2 == 0 else 6
        c.line(12, 12, 12 + L * math.cos(a), 12 + L * math.sin(a), 1.6 if (i + swap) % 2 == 0 else 1.1, k, .9)
    c.ball(12, 12, 3.4, k, .8, 1.0, light=False)


def el_si(c, k):
    c.poly([(8, 20), (6, 9), (10, 3), (13, 9), (12, 20)], k, .3, 1.0)
    c.poly([(13, 20), (14, 11), (18, 6), (20, 12), (18, 20)], k, .2, .8)
    c.poly([(4, 20), (3, 15), (6, 13), (7, 20)], k, .15, .6)
    c.line(10, 4, 10, 18, .9, k, 1.0)
    c.rect(3, 20, 21, 21, k, .35)
    y = 22 - T * 22  # a light band climbing the crystals
    c.v = np.where((c.v > .28) & (np.abs(c.y - y + (c.x - 12) * .3) < 1.2) & (c.x > 2) & (c.x < 22) & (c.y > 1) & (c.y < 20), 1.0, c.v)


def el_fe(c, k):
    # an isometric ingot
    c.poly([(4, 10), (12, 6), (20, 10), (12, 14)], k, .75, 1.0)
    c.poly([(4, 10), (12, 14), (12, 20), (4, 16)], k, .35, .55)
    c.poly([(12, 14), (20, 10), (20, 16), (12, 20)], k, .12, .3)
    c.line(6, 10, 12, 7.5, .8, k, 1.0)
    gx = 4 + T * 22
    c.v = np.where((c.v > .26) & (np.abs(c.x - gx - (c.y - 10) * .5) < 1) & (c.y > 5) & (c.y < 21) & (c.x > 3) & (c.x < 21), 1.0, c.v)


def el_au(c, k):
    c.poly([(5, 15), (7, 9), (12, 6), (17, 8), (20, 13), (17, 18), (10, 19)], k, .3, 1.0)
    c.ball(10, 11, 1.6, k, .85, 1.0, light=False)
    c.ball(15, 14, 1.2, k, .5, .7, light=False)
    f = int(T * 8)
    for (x, y, L) in [(19, 5, 3 if f < 4 else 1), (5, 19, 2 if f >= 4 else 1)]:  # sparkles take turns
        c.line(x - L, y, x + L, y, .9, k, 1.0); c.line(x, y - L, x, y + L, .9, k, 1.0)


def el_u(c, k):
    c.glow(12, 12, 11.5, k, .6)
    d = np.hypot(c.x - 12, c.y - 12)
    ang = (np.arctan2(c.y - 12, c.x - 12) + math.pi / 2 + math.pi / 6 - T * 2 * math.pi / 3) % (2 * math.pi / 3)
    blade = (d > 3.4) & (d < 9) & (ang < math.pi / 3)
    c.put(blade, .95 - (d - 3.4) / 12, k)
    c.ball(12, 12, 2, k, .9, 1.0, light=False)


DRAW_EL = [el_h, el_he, el_c, el_o, el_ne, el_mg, el_si, el_fe, el_au, el_u]
for (sym, col), fn in zip(ELEMENTS, DRAW_EL):
    c = Canvas(24)
    k = c.use(col)
    frame(c, k)
    fn(c, k)
    save(c.image(), f"el-{sym}")
    frames = []
    for f in range(8):
        T = f / 8
        c = Canvas(24); k = c.use(col); frame(c, k); fn(c, k); frames.append(c.image())
    T = 0.0
    strip = Image.new("RGBA", (24 * 8, 24))
    for f, im in enumerate(frames):
        strip.paste(im, (24 * f, 0))
    strip.save(os.path.join(OUT, f"el-{sym}-anim.png"), optimize=True)

# locked tile: frame only, with a dim keyhole
c = Canvas(24); k = c.use("#6b6f8a"); frame(c, k, lit=False)
c.ball(12, 10, 3, k, .3, .45); c.poly([(10.5, 11), (13.5, 11), (14.5, 17), (9.5, 17)], k, .3, .4)
save(c.image(), "el-locked")

# ---- 16 x 16 icons: dock, menu, stats, small marks -----------------------------------------------------------------
CY = "#5fe3ff"
GOLD = "#ffd27a"
WARM = "#ffb24d"


def icon(name, col, fn, outline=True):
    c = Canvas(16)
    k = c.use(col)
    fn(c, k)
    if outline:
        c.outline(c.use("#05040c"), .0)
    save(c.image(), name)


def stars(c, k):
    pts = [(2.5, 13), (6, 6), (11.5, 8), (13.5, 14)]
    for a, b in zip(pts, pts[1:]):
        c.line(*a, *b, 1, k, .45)
    for (x, y) in (pts[0], pts[2], pts[3]):
        c.ball(x, y, 1.7, k, .75, 1.0, light=False)
    c.poly([(6, 1), (7.2, 4.8), (11, 6), (7.2, 7.2), (6, 11), (4.8, 7.2), (1, 6), (4.8, 4.8)], k, .7, 1.0)


def pulsar(c, k):
    c.poly([(8, 8), (3, 0.5), (7, 0.5)], k, .55, .95)
    c.poly([(8, 8), (13, 15.5), (9, 15.5)], k, .55, .95)
    c.ring(8, 8, 6.6, 6.6, .9, k, .35)
    c.ball(8, 8, 3.4, k, .55, 1.0)


def orbit(c, k):
    c.ring(8, 9, 7, 2.6, 1, k, .5, front=False)
    c.ball(8, 8, 4.2, k, .3, 1.0)
    c.ring(8, 9, 7, 2.6, 1, k, .85, front=True)
    c.ball(13.5, 3, 1.3, k, .8, 1.0, light=False)


def almanac(c, k):
    c.poly([(2, 3), (8, 4.5), (8, 14.5), (2, 13)], k, .55, .95)
    c.poly([(8, 4.5), (14, 3), (14, 13), (8, 14.5)], k, .25, .6)
    for y in (6.5, 8.5, 10.5):
        c.line(3.5, y, 6.5, y + .6, .7, k, .25)
    c.line(8, 4.5, 8, 14.5, .9, k, 1.0)


def menu(c, k):
    d = np.hypot(c.x - 8, c.y - 8)
    a = np.arctan2(c.y - 8, c.x - 8)
    teeth = (np.cos(a * 8) > .2) & (d < 7.4)
    body = (d < 5.6) | teeth
    c.put(body & (d > 2.2), .95 - (c.x + c.y) / 40, k)


def m_pause(c, k):
    c.rect(4, 3, 7, 13, k, .9); c.rect(9, 3, 12, 13, k, .7)


def m_play(c, k):
    c.poly([(4.5, 2.5), (13, 8), (4.5, 13.5)], k, .5, 1.0)


def m_full(c, k):
    for sx, sy in [(1, 1), (-1, 1), (1, -1), (-1, -1)]:
        x0, y0 = 8 - sx * 6, 8 - sy * 6
        c.line(x0, y0, x0 + sx * 4, y0, 1.6, k, .9); c.line(x0, y0, x0, y0 + sy * 4, 1.6, k, .9)
    c.rect(6, 6, 10, 10, k, .55)


def speaker(c, k):
    c.rect(2, 6, 5, 10, k, .7)
    c.poly([(5, 6), (9, 2.5), (9, 13.5), (5, 10)], k, .5, .95)


def m_sound(c, k):
    speaker(c, k)
    right = Canvas(16); right.ring(9, 8, 3, 3, 1, 0, .9); right.ring(9, 8, 5.8, 5.8, 1, 0, .6)
    m = (right.v >= 0) & (c.x > 10)
    c.put(m, right.v, k)


def m_mute(c, k):
    speaker(c, k)
    c.line(11, 5.5, 15, 10.5, 1.3, k, .9); c.line(15, 5.5, 11, 10.5, 1.3, k, .9)


def m_export(c, k):
    c.line(8, 10, 8, 2, 1.6, k, 1.0); c.line(8, 1.5, 4.5, 5, 1.5, k, 1.0); c.line(8, 1.5, 11.5, 5, 1.5, k, 1.0)
    c.rect(2, 9, 3.6, 14, k, .6); c.rect(12.4, 9, 14, 14, k, .6); c.rect(2, 12.4, 14, 14, k, .6)


def m_import(c, k):
    c.line(8, 1.5, 8, 9.5, 1.6, k, 1.0); c.line(8, 10, 4.5, 6.5, 1.5, k, 1.0); c.line(8, 10, 11.5, 6.5, 1.5, k, 1.0)
    c.rect(2, 9, 3.6, 14, k, .6); c.rect(12.4, 9, 14, 14, k, .6); c.rect(2, 12.4, 14, 14, k, .6)


def s_mass(c, k):
    c.poly([(3, 14), (5, 6), (11, 6), (13, 14)], k, .35, .95)
    c.ring(8, 4.2, 2.2, 1.8, 1.1, k, .9)


def s_heat(c, k):
    c.poly([(8, 1), (12.5, 8), (12, 12.5), (8, 15), (4, 12.5), (3.5, 8)], k, .45, 1.0)
    c.poly([(8, 7), (10, 11), (8, 13.5), (6, 11)], k, .9, 1.0)


def s_age(c, k):
    c.ring(8, 8, 6, 6, 1.3, k, .9)
    c.line(8, 8, 8, 4, 1.3, k, 1.0); c.line(8, 8, 11, 9.5, 1.2, k, .8)


def s_dust(c, k):
    c.poly([(8, 1), (9.5, 6.5), (15, 8), (9.5, 9.5), (8, 15), (6.5, 9.5), (1, 8), (6.5, 6.5)], k, .5, 1.0)
    c.dot(13, 2, k, 1.0); c.dot(2, 13, k, .8)


def s_neutron(c, k):
    c.ball(8, 8, 3, k, .5, 1.0)
    c.ring(8, 8, 6.6, 2.2, .9, k, .8)
    c.ring(8, 8, 2.2, 6.6, .9, k, .6)


def s_burst(c, k):
    for i in range(8):
        a = i * math.pi / 4 + math.pi / 8
        L = 7.4 if i % 2 == 0 else 5
        c.line(8, 8, 8 + L * math.cos(a), 8 + L * math.sin(a), 1.4, k, .85)
    c.ball(8, 8, 2.6, k, .8, 1.0, light=False)


def s_back(c, k):
    c.line(13, 8, 3, 8, 1.6, k, 1.0); c.line(2.8, 8, 7, 3.8, 1.6, k, 1.0); c.line(2.8, 8, 7, 12.2, 1.6, k, 1.0)


def s_cross(c, k):
    c.line(3, 3, 13, 13, 1.8, k, 1.0); c.line(13, 3, 3, 13, 1.8, k, 1.0)


def medal(c, k):
    c.poly([(4, 1), (7, 1), (8, 6), (6, 6)], k, .3, .5); c.poly([(9, 1), (12, 1), (10, 6), (8, 6)], k, .3, .5)
    c.ball(8, 10, 4.6, k, .3, 1.0)
    c.poly([(8, 7), (9, 9.4), (11, 9.6), (9.4, 11), (10, 13), (8, 11.8), (6, 13), (6.6, 11), (5, 9.6), (7, 9.4)], k, .95, 1.0)


def lock(c, k):
    c.ring(8, 6.5, 3.4, 3.6, 1.6, k, .7, front=False)
    c.rect(4.6, 6.5, 6.2, 8, k, .7); c.rect(9.8, 6.5, 11.4, 8, k, .7)
    c.rect(3, 8, 13, 15, k, .6)
    c.rect(7.4, 10, 8.6, 13, k, .05)


def tier(n):
    def f(c, k):
        for i in range(n):
            y = 12 - i * 4 - (3 - n) * 2
            c.line(3, y + 2, 8, y - 2.5, 1.7, k, 1 - i * .15); c.line(8, y - 2.5, 13, y + 2, 1.7, k, 1 - i * .15)
    return f


def planet_slot(c, k):
    c.ring(8, 8, 6, 6, 1, k, .5)
    c.put((np.hypot(c.x - 8, c.y - 8) < 5.4) & (bayer(16, 16) > .7), .3, k)


def swipe(c, k):
    for i, x in enumerate((4, 8, 12)):
        c.line(x - 2, 4, x + 1.5, 8, 1.6, k, .4 + i * .3); c.line(x + 1.5, 8, x - 2, 12, 1.6, k, .4 + i * .3)


ICONS = [
    ("dock-stars", CY, stars), ("dock-pulsar", "#b4b6ff", pulsar), ("dock-orbit", "#7fd0e8", orbit),
    ("dock-almanac", GOLD, almanac), ("dock-menu", "#c9cee0", menu),
    ("menu-pause", CY, m_pause), ("menu-play", CY, m_play), ("menu-full", CY, m_full), ("menu-sound", CY, m_sound),
    ("menu-mute", "#ff8a7e", m_mute), ("menu-export", GOLD, m_export), ("menu-import", GOLD, m_import),
    ("stat-mass", "#c9b8ff", s_mass), ("stat-heat", "#f08a4a", s_heat), ("stat-age", "#8cc8ff", s_age),
    ("stat-dust", GOLD, s_dust), ("stat-neutron", "#b4b6ff", s_neutron), ("stat-burst", WARM, s_burst),
    ("ui-back", "#e9ecf6", s_back), ("ui-cross", "#e9ecf6", s_cross), ("ui-swipe", "#e9ecf6", swipe),
    ("medal", "#6b6f8a", medal), ("medal-lit", GOLD, medal), ("lock", "#8a90a8", lock), ("slot", "#8a90a8", planet_slot),
    ("tier-1", "#e9ecf6", tier(1)), ("tier-2", "#e9ecf6", tier(2)), ("tier-3", "#e9ecf6", tier(3)),
]
for name, col, fn in ICONS:
    icon(name, col, fn)

# ---- panel pieces --------------------------------------------------------------------------------------------------
# frame.png: 24 x 24, 8px slices for border-image. Dithered two-tone rim, corner brackets in cyan, transparent middle.
c = Canvas(24); kr = c.use("#8a90a8"); kc = c.use(CY)
edge = (c.x < 2) | (c.y < 2) | (c.x > 22) | (c.y > 22)
c.put(edge & ((c.x < 1) | (c.y < 1) | (c.x > 23) | (c.y > 23)), .32, kr)
c.put(edge & ~((c.x < 1) | (c.y < 1) | (c.x > 23) | (c.y > 23)) & (bayer(24, 24) > .5), .12, kr)
for cx, cy in [(0, 0), (1, 0), (0, 1), (1, 1)]:
    bx = (c.x < 7) if cx == 0 else (c.x > 17)
    by = (c.y < 7) if cy == 0 else (c.y > 17)
    arm = ((c.y < 2) if cy == 0 else (c.y > 22)) | ((c.x < 2) if cx == 0 else (c.x > 22))
    c.put(bx & by & arm, .85 if (cx, cy) == (0, 0) else .62, kc)
c.v[0, 0] = -1; c.v[0, 23] = -1; c.v[23, 0] = -1; c.v[23, 23] = -1
save(c.image(), "frame")

# frame-warm and frame-void for the collapse panel's states and the black hole confirm
for nm, col in [("frame-warm", WARM), ("frame-void", "#c9b8ff")]:
    c = Canvas(24); kr = c.use(col); kc = c.use(col)
    outer = (c.x < 1) | (c.y < 1) | (c.x > 23) | (c.y > 23)
    c.put(outer, .45, kr)
    c.put(((c.x < 2) | (c.y < 2) | (c.x > 22) | (c.y > 22)) & ~outer & (bayer(24, 24) > .5), .2, kr)
    for cx, cy in [(0, 0), (1, 0), (0, 1), (1, 1)]:
        bx = (c.x < 7) if cx == 0 else (c.x > 17)
        by = (c.y < 7) if cy == 0 else (c.y > 17)
        arm = ((c.y < 2) if cy == 0 else (c.y > 22)) | ((c.x < 2) if cx == 0 else (c.x > 22))
        c.put(bx & by & arm, .9, kc)
    c.v[0, 0] = c.v[0, 23] = c.v[23, 0] = c.v[23, 23] = -1
    save(c.image(), nm)

# panel fill: 32 x 32 tile, a dark dithered nebula wash with a few cold specks (opaque, sits under the panel copy)
c = Canvas(32); k = c.use("#2a2350")
rng = np.random.default_rng(7)
w = .07 + .07 * (np.sin(c.x / 32 * 2 * math.pi) * np.cos(c.y / 32 * 2 * math.pi * 2) * .5 + .5)
c.put(np.ones((32, 32), bool), w, k)
save(c.image(), "fill")

# head: 8 x 20 header band gradient (top bright to dark), repeat-x
c = Canvas(8, 20); k = c.use("#3b2f78")
c.put(np.ones((20, 8), bool), np.clip(.5 - c.y / 30, 0, 1), k)
save(c.image(), "head")

# rule: 16 x 4 divider, a dotted rail with a brighter tick every 16px
c = Canvas(16, 4); k = c.use("#8a90a8")
c.put((c.y > 1) & (c.y < 3) & (bayer(4, 16) > .45), .3, k)
c.put((c.x < 2) & (c.y > 0) & (c.y < 4), .9, c.use(CY))
save(c.image(), "rule")

# bar: 8 x 8 fill tile for the collapse bar, diagonal heat bands
c = Canvas(8); k = c.use("#f08a4a")
c.put(np.ones((8, 8), bool), .45 + .45 * (((c.x + c.y) % 8) < 4), k)
save(c.image(), "bar")

# bar-full: the same in gold
c = Canvas(8); k = c.use("#ffd27a")
c.put(np.ones((8, 8), bool), .55 + .45 * (((c.x + c.y) % 8) < 4), k)
save(c.image(), "bar-full")

# btn tiers: 8 x 8 textures for the three burner buttons (sparse, medium, dense)
for i, dens in enumerate((.2, .45, .72)):
    c = Canvas(8); k = c.use("#ffffff")
    c.put(bayer(8, 8) < dens * .5, .18, k)
    save(c.image(), f"btn-{i + 1}")

# scrim: 8 x 8 checker for overlay backdrops
c = Canvas(8); k = c.use("#000000")
c.put(bayer(8, 8) < .5, .0, k)
save(c.image(), "scrim")


# ---- star chart nodes: 32 x 32, one per constellation colour and state ----------------------------------------------------
CONS = [("lantern", "#5fb4ff"), ("kiln", "#ff9a4d"), ("anvil", "#e8e2d6"), ("loom", "#a98bff"), ("pulsar", "#9fd0ff")]


def star4(c, k, R, r, lo, hi, cx=16, cy=16):
    pts = []
    for i in range(8):
        a = i * math.pi / 4 - math.pi / 2
        L = R if i % 2 == 0 else r
        pts.append((cx + L * math.cos(a), cy + L * math.sin(a)))
    return c.poly(pts, k, lo, hi)


for cid, col in CONS:
    # own: lit star, soft dithered glow, diagonal glints
    c = Canvas(32); k = c.use(col)
    c.glow(16, 16, 15, k, .55)
    for a in (1, 3, 5, 7):
        ang = a * math.pi / 4
        c.line(16 + 5 * math.cos(ang), 16 + 5 * math.sin(ang), 16 + 8 * math.cos(ang), 16 + 8 * math.sin(ang), .9, k, .7)
    star4(c, k, 12, 3.2, .7, 1.0)
    c.ball(16, 16, 3, k, 1.0, 1.0, light=False)
    c.outline(c.use("#05040c"), 0)
    save(c.image(), f"node-{cid}-own")
    # buy: a ready star, ringed by a dotted bracket ring
    c = Canvas(32); k = c.use(col)
    ring = np.abs(np.hypot(c.x - 16, c.y - 16) - 13) < .8
    ang = np.arctan2(c.y - 16, c.x - 16)
    c.put(ring & (np.cos(ang * 4) > -.2), .75, k)
    star4(c, k, 9, 2.6, .35, .85)
    c.outline(c.use("#05040c"), 0)
    save(c.image(), f"node-{cid}-buy")
    # near: hollow outline star, the cost is in reach later
    c = Canvas(32); k = c.use(col)
    m = star4(c, k, 9, 2.6, .3, .3)
    p = np.pad(m, 1)
    inner = p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:] & m
    c.v = np.where(inner, -1, c.v)
    c.ball(16, 16, 1.2, k, .5, .5, light=False)
    save(c.image(), f"node-{cid}-near")
    # lock: a dim cross-shaped speck
    c = Canvas(32); k = c.use("#6b6f8a")
    c.line(16, 12, 16, 20, 1, k, .35); c.line(12, 16, 20, 16, 1, k, .35)
    c.ball(16, 16, 1.6, k, .45, .45, light=False)
    save(c.image(), f"node-{cid}-lock")

# ---- contact sheet (not shipped to the page; used for reviews) --------------------------------------------------------
cell = 26 * 6
cols = 10
rows = math.ceil(len(SAVED) / cols)
sheet = Image.new("RGBA", (cols * cell, rows * cell), (12, 10, 26, 255))
for i, (nm, im) in enumerate(SAVED):
    s = max(1, min(6, 144 // max(im.size)))
    big = im.resize((im.width * s, im.height * s), Image.NEAREST)
    sheet.alpha_composite(big, ((i % cols) * cell + (cell - big.width) // 2, (i // cols) * cell + (cell - big.height) // 2))
prev = os.path.join(ROOT, "scripts", "starwright", "ui-art", "preview.png")
sheet.save(prev)
print(f"wrote {len(SAVED)} images to {OUT}; preview {prev}")
