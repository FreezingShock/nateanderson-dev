"""Kit for the zone rig machines (96 x 64 px, 6 frames, 4 fill states). Same look as nodefarm_icon_kit (Bayer-dithered
ramps, rim light from the top-left, dark selective outline), on a wider grid. Each rig is drawn by a function
draw(c, p, f): p is the loop phase in [0, 1), f the rig's meter in [0, 1] (0, 1/3, 2/3, 1 for the four states).
"""
import math

import numpy as np
from PIL import Image, ImageDraw

from nodefarm_icon_kit import P, hexc, ramp  # noqa: F401  (palettes are shared)

W, H = 96, 64
FRAMES = 6
STATES = 4
_B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 - 0.5
BAYER = np.tile(_B4, (H // 4, W // 4))
yy, xx = np.mgrid[0:H, 0:W].astype(float)
X, Y = xx + 0.5, yy + 0.5


def poly(pts, ss=4):
    im = Image.new("L", (W * ss, H * ss), 0)
    ImageDraw.Draw(im).polygon([(x * ss, y * ss) for x, y in pts], fill=255)
    return np.asarray(im.resize((W, H), Image.BOX)).astype(float) > 127


def disc(cx, cy, r, ry=None):
    ry = ry or r
    return ((X - cx) / r) ** 2 + ((Y - cy) / ry) ** 2 <= 1


def ring(cx, cy, ro, ri, ry_ratio=1.0):
    d = np.hypot(X - cx, (Y - cy) / ry_ratio)
    return (d <= ro) & (d >= ri)


def rect(x0, y0, x1, y1):
    return (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)


def line(x0, y0, x1, y1, w=1.0):
    dx, dy = x1 - x0, y1 - y0
    L2 = dx * dx + dy * dy or 1
    t = np.clip(((X - x0) * dx + (Y - y0) * dy) / L2, 0, 1)
    return np.hypot(X - (x0 + t * dx), Y - (y0 + t * dy)) <= w / 2


def path(pts, w=1.0):
    m = np.zeros((H, W), bool)
    for a, b in zip(pts, pts[1:]):
        m |= line(*a, *b, w)
    return m


def lin(x0, y0, x1, y1):
    dx, dy = x1 - x0, y1 - y0
    return np.clip(((X - x0) * dx + (Y - y0) * dy) / (dx * dx + dy * dy), 0, 1)


def radial(cx, cy, r):
    return np.clip(np.hypot(X - cx, Y - cy) / r, 0, 1)


def angle(cx, cy):
    return (np.arctan2(Y - cy, X - cx) / (2 * math.pi)) % 1.0


def shift(m, dx, dy):
    out = np.zeros_like(m)
    sx0, sx1 = max(0, -dx), min(W, W - dx)
    sy0, sy1 = max(0, -dy), min(H, H - dy)
    out[sy0 + dy:sy1 + dy, sx0 + dx:sx1 + dx] = m[sy0:sy1, sx0:sx1]
    return out


def grow(m, r=1):
    out = m.copy()
    for dx in range(-r, r + 1):
        for dy in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r + r:
                out |= shift(m, dx, dy)
    return out


def edge(m, dx, dy):
    return m & ~shift(m, -dx, -dy)


def wave(p, k=1, phase=0.0):
    return 0.5 - 0.5 * math.cos(2 * math.pi * (p * k + phase))


def zig(x0, y0, x1, y1, n, amp, seed, w=1.0):
    """A lightning bolt from (x0, y0) to (x1, y1) with n kinks."""
    rnd = np.random.default_rng(seed)
    pts = [(x0, y0)]
    for i in range(1, n):
        t = i / n
        nx, ny = -(y1 - y0), (x1 - x0)
        L = math.hypot(nx, ny) or 1
        o = (rnd.random() - 0.5) * 2 * amp
        pts.append((x0 + (x1 - x0) * t + nx / L * o, y0 + (y1 - y0) * t + ny / L * o))
    pts.append((x1, y1))
    return path(pts, w)


class Canvas:
    def __init__(self):
        self.img = np.zeros((H, W, 4), np.uint8)

    @property
    def alpha(self):
        return self.img[..., 3] > 0

    def _col(self, col):
        if isinstance(col, tuple) and isinstance(col[0], str):
            return P[col[0]][col[1]]
        return col

    def fill(self, mask, v, pal, outline=None, dither=0.9):
        r = P[pal] if isinstance(pal, str) else pal
        v = np.broadcast_to(np.asarray(v, float), (H, W))
        idx = np.clip(np.floor(v * (len(r) - 1) + 0.5 + BAYER * dither), 0, len(r) - 1).astype(int)
        for i, c in enumerate(r):
            self.img[mask & (idx == i)] = (*c, 255)
        if outline:
            self.outline(mask, outline)
        return self

    def set(self, mask, col, a=255):
        self.img[mask] = (*self._col(col), max(0, min(255, int(a))))
        return self

    def outline(self, mask, col):
        col = P[col][0] if isinstance(col, str) else col
        r = grow(mask, 1) & ~mask & ~self.alpha
        self.img[r] = (*col, 255)
        return self

    def rim(self, mask, col, dx=-1, dy=-1):
        col = self._col(col)
        e = (edge(mask, dx, 0) if dx else np.zeros_like(mask)) | (edge(mask, 0, dy) if dy else np.zeros_like(mask))
        self.img[e & mask] = (*col, 255)
        return self

    def glow(self, mask, col, r=3, a=110, steps=2):
        col = self._col(col)
        prev = mask
        for k in range(1, steps + 1):
            g = grow(mask, max(1, round(r * k / steps))) & ~prev
            thin = g & (BAYER < 0.5 - (k - 1) * 0.3) & ~self.alpha
            self.img[thin] = (*col, int(a * (1 - (k - 1) / steps)))
            prev = prev | g
        return self

    def spark(self, x, y, size, col):
        col = self._col(col)
        x, y = int(round(x)), int(round(y))
        pts = [(x, y)] + [(x + d, y) for d in range(1, size + 1)] + [(x - d, y) for d in range(1, size + 1)] + [(x, y + d) for d in range(1, size + 1)] + [(x, y - d) for d in range(1, size + 1)]
        for px, py in pts:
            if 0 <= px < W and 0 <= py < H:
                self.img[py, px] = (*col, 255)
        return self

    def finish(self, col=(8, 9, 11)):
        solid = self.img[..., 3] >= 200
        r = grow(solid, 1) & ~solid
        self.img[r & (self.img[..., 3] < 200)] = (*col, 255)
        return self


def box(c, x, y, w, h, d, pal, v=0.0):
    front = rect(x, y, x + w, y + h)
    top = poly([(x, y), (x + d, y - d * 0.6), (x + w + d, y - d * 0.6), (x + w, y)])
    side = poly([(x + w, y), (x + w + d, y - d * 0.6), (x + w + d, y + h - d * 0.6), (x + w, y + h)])
    c.fill(side, 0.22 + v, pal)
    c.fill(front, 0.42 + v + 0.22 * (1 - lin(x, y, x + w, y + h)), pal)
    c.fill(top, 0.74 + v, pal)
    c.outline(front | top | side, pal)
    c.rim(top, P[pal][-1] if isinstance(pal, str) else pal[-1], 0, -1)
    return front, top, side


def cyl(c, cx, top, bot, rx, ry, pal, v=0.0, cap=True):
    body = rect(cx - rx, top, cx + rx, bot) | disc(cx, bot, rx, ry)
    shade = 0.12 + v + 0.8 * np.clip(1 - np.abs((X - (cx - rx * 0.35)) / (rx * 1.25)), 0, 1)
    c.fill(body, shade, pal)
    capm = disc(cx, top, rx, ry)
    if cap:
        c.fill(capm, 0.7 + v + 0.2 * (1 - lin(cx - rx, top - ry, cx + rx, top + ry)), pal)
    c.outline(body | capm, pal)
    return body, capm


def orb(c, cx, cy, r, pal, v=0.0, hx=-0.35, hy=-0.4):
    m = disc(cx, cy, r)
    d = np.hypot(X - (cx + hx * r), Y - (cy + hy * r)) / (r * 1.7)
    c.fill(m, 1.0 - d * 1.15 + v, pal)
    return m


def floor_plate(c, pal="steel", y=56):
    """The shared base every rig stands on: a low steel plinth with a coloured status strip."""
    top = poly([(6, y), (12, y - 4), (90, y - 4), (84, y)])
    front = rect(6, y, 84, y + 5)
    side = poly([(84, y), (90, y - 4), (90, y + 1), (84, y + 5)])
    c.fill(side, 0.15, pal)
    c.fill(front, 0.3, pal)
    c.fill(top, 0.55 + 0.15 * (1 - lin(6, y - 4, 90, y)), pal)
    c.outline(front | top | side, "ink")
    return top


def status_strip(c, f, pal, y=58):
    """Lights along the plinth front: how full the rig's meter is (one lit block per quarter)."""
    for i in range(4):
        m = rect(12 + i * 18, y, 26 + i * 18, y + 2)
        c.set(m, P[pal][-2] if f > i / 4 + 0.01 else P["ink"][2])


def sheet(rows, out_stem, preview=None):
    """rows: list of (name, draw). Writes a sheet of len(rows) rows by STATES*FRAMES columns."""
    img = Image.new("RGBA", (W * STATES * FRAMES, H * len(rows)), (0, 0, 0, 0))
    for r, (_, draw) in enumerate(rows):
        for s in range(STATES):
            f = s / (STATES - 1)
            for k in range(FRAMES):
                c = Canvas()
                draw(c, k / FRAMES, f)
                c.finish()
                img.paste(Image.fromarray(c.img, "RGBA"), ((s * FRAMES + k) * W, r * H))
    img.save(f"{out_stem}.png", optimize=True)
    img.save(f"{out_stem}.webp", lossless=True, quality=100, method=6)
    if preview:
        # first frame of each state, 3x, on the panel colour
        pv = Image.new("RGBA", (W * STATES * 3 + 8 * (STATES - 1), H * 3 * len(rows) + 8 * (len(rows) - 1)), (11, 11, 11, 255))
        for r in range(len(rows)):
            for s in range(STATES):
                cell = img.crop(((s * FRAMES) * W, r * H, (s * FRAMES + 1) * W, (r + 1) * H)).resize((W * 3, H * 3), Image.NEAREST)
                pv.alpha_composite(cell, (s * (W * 3 + 8), r * (H * 3 + 8)))
        pv.save(preview)
    return img
