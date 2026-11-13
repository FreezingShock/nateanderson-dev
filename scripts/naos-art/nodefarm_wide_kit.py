"""Wide-canvas version of nodefarm_icon_kit for banner art (any W x H): same palettes, Bayer-dithered ramps, rim light,
selective outline and dithered glow, so the window banners match the 64 px icons and tier sprites.

Use:  g = Grid(480, 150); c = g.canvas(); c.fill(g.rect(...), v, "steel", outline="steel"); c.finish()
Masks are boolean arrays (H, W); shade values v are floats or (H, W) arrays in 0..1."""
import math

import numpy as np
from PIL import Image, ImageDraw

from nodefarm_icon_kit import P, _B4, _B8  # noqa: F401  (P is re-exported for the art files)


class Grid:
    def __init__(self, w, h):
        self.W, self.H = w, h
        self.yy, self.xx = np.mgrid[0:h, 0:w].astype(float)
        self.X, self.Y = self.xx + 0.5, self.yy + 0.5
        self.B4 = np.tile(_B4, (h // 4 + 1, w // 4 + 1))[:h, :w]
        self.B8 = np.tile(_B8, (h // 8 + 1, w // 8 + 1))[:h, :w]

    # ---- shapes
    def poly(self, pts, ss=3):
        im = Image.new("L", (self.W * ss, self.H * ss), 0)
        ImageDraw.Draw(im).polygon([(x * ss, y * ss) for x, y in pts], fill=255)
        return np.asarray(im.resize((self.W, self.H), Image.BOX)).astype(float) > 127

    def disc(self, cx, cy, r, ry=None):
        ry = ry or r
        return ((self.X - cx) / r) ** 2 + ((self.Y - cy) / ry) ** 2 <= 1

    def ring(self, cx, cy, ro, ri, ry_ratio=1.0):
        d = np.hypot(self.X - cx, (self.Y - cy) / ry_ratio)
        return (d <= ro) & (d >= ri)

    def rect(self, x0, y0, x1, y1):
        return (self.xx >= x0) & (self.xx < x1) & (self.yy >= y0) & (self.yy < y1)

    def line(self, x0, y0, x1, y1, w=1.0):
        dx, dy = x1 - x0, y1 - y0
        L2 = dx * dx + dy * dy or 1
        t = np.clip(((self.X - x0) * dx + (self.Y - y0) * dy) / L2, 0, 1)
        return np.hypot(self.X - (x0 + t * dx), self.Y - (y0 + t * dy)) <= w / 2

    def path(self, pts, w=1.0):
        m = np.zeros((self.H, self.W), bool)
        for a, b in zip(pts, pts[1:]):
            m |= self.line(*a, *b, w)
        return m

    def lin(self, x0, y0, x1, y1):
        dx, dy = x1 - x0, y1 - y0
        return np.clip(((self.X - x0) * dx + (self.Y - y0) * dy) / (dx * dx + dy * dy), 0, 1)

    def radial(self, cx, cy, r, ry=None):
        return np.clip(np.hypot(self.X - cx, (self.Y - cy) * (r / (ry or r))) / r, 0, 1)

    def canvas(self):
        return WideCanvas(self)


def _shift(m, dx, dy):
    out = np.zeros_like(m)
    H, W = m.shape
    out[max(0, dy):H + min(0, dy), max(0, dx):W + min(0, dx)] = m[max(0, -dy):H - max(0, dy), max(0, -dx):W - max(0, dx)]
    return out


def grow(m, r=1):
    out = m.copy()
    for dx in range(-r, r + 1):
        for dy in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r + r:
                out |= _shift(m, dx, dy)
    return out


def edge(m, dx, dy):
    return m & ~_shift(m, -dx, -dy)


def _col(col):
    return P[col[0]][col[1]] if isinstance(col, tuple) and isinstance(col[0], str) else col


class WideCanvas:
    def __init__(self, g):
        self.g = g
        self.img = np.zeros((g.H, g.W, 4), np.uint8)

    @property
    def alpha(self):
        return self.img[..., 3] > 0

    def fill(self, mask, v, pal, outline=None, dither=0.9):
        r = P[pal] if isinstance(pal, str) else pal
        v = np.broadcast_to(np.asarray(v, float), mask.shape)
        idx = np.clip(np.floor(v * (len(r) - 1) + 0.5 + self.g.B4 * dither), 0, len(r) - 1).astype(int)
        for i, c in enumerate(r):
            self.img[mask & (idx == i)] = (*c, 255)
        if outline:
            self.outline(mask, outline)
        return self

    def haze(self, mask, v, pal, density):
        """Dithered see-through fill: a pixel is painted only where `density` (0..1, array or float) beats the Bayer
        threshold, so sky and mist read as dither over the window's own background instead of a solid block."""
        dens = np.broadcast_to(np.asarray(density, float), mask.shape)
        keep = mask & (dens > self.g.B8 + 0.5)
        r = P[pal] if isinstance(pal, str) else pal
        v = np.broadcast_to(np.asarray(v, float), mask.shape)
        idx = np.clip(np.floor(v * (len(r) - 1) + 0.5 + self.g.B4 * 0.9), 0, len(r) - 1).astype(int)
        for i, c in enumerate(r):
            self.img[keep & (idx == i)] = (*c, 255)
        return self

    def set(self, mask, col, a=255):
        self.img[mask] = (*_col(col), a)
        return self

    def outline(self, mask, col):
        col = P[col][0] if isinstance(col, str) else col
        self.img[grow(mask, 1) & ~mask & ~self.alpha] = (*col, 255)
        return self

    def rim(self, mask, col, dx=-1, dy=-1):
        e = (edge(mask, dx, 0) if dx else np.zeros_like(mask)) | (edge(mask, 0, dy) if dy else np.zeros_like(mask))
        self.img[e & mask] = (*_col(col), 255)
        return self

    def glow(self, mask, col, r=4, a=120, steps=3, over=False):
        """Soft halo: dithered partial-alpha pixels around mask (on empty space only, unless over=True)."""
        col = _col(col)
        prev = mask
        for k in range(1, steps + 1):
            g = grow(mask, max(1, round(r * k / steps))) & ~prev
            thin = g & (self.g.B4 < 0.5 - (k - 1) * 0.25)
            if not over:
                thin &= ~self.alpha
            self.img[thin] = (*col, int(a * (1 - (k - 1) / steps)))
            prev = prev | g
        return self

    def light(self, cx, cy, r, col, a=90, ry=None):
        """A pool of light: dithered partial-alpha pixels laid over whatever is there, densest at the centre."""
        d = self.g.radial(cx, cy, r, ry)
        m = (1 - d) > self.g.B8 + 0.5
        out = self.img.astype(float)
        c = np.array(_col(col), float)
        k = (a / 255) * (1 - d)[..., None]
        out[..., :3] = np.where(m[..., None], out[..., :3] * (1 - k) + c * k, out[..., :3])
        out[..., 3] = np.where(m & (out[..., 3] == 0), a * (1 - d), out[..., 3])
        self.img = out.astype(np.uint8)
        return self

    def dot(self, x, y, col, a=255):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.g.W and 0 <= y < self.g.H:
            self.img[y, x] = (*_col(col), a)
        return self

    def spark(self, x, y, size, col, core=None):
        col = _col(col)
        x, y = int(round(x)), int(round(y))
        pts = [(x, y)] + [(x + d * sx, y + d * sy) for d in range(1, size + 1) for sx, sy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
        for px, py in pts:
            self.dot(px, py, col)
        if core is not None:
            self.dot(x, y, core)
        return self

    def finish(self, col=(8, 9, 11)):
        solid = self.img[..., 3] >= 200
        ring_ = grow(solid, 1) & ~solid
        self.img[ring_ & (self.img[..., 3] < 200)] = (*col, 255)
        return self

    def image(self):
        return Image.fromarray(self.img, "RGBA")


def box(c, x, y, w, h, d, pal, v=0.0, outline=True):
    """Front, top and right side of a box (depth d going up-right); same shading rule as the icon kit."""
    g = c.g
    front = g.rect(x, y, x + w, y + h)
    top = g.poly([(x, y), (x + d, y - d * 0.6), (x + w + d, y - d * 0.6), (x + w, y)])
    side = g.poly([(x + w, y), (x + w + d, y - d * 0.6), (x + w + d, y + h - d * 0.6), (x + w, y + h)])
    c.fill(side, 0.18 + v + 0.12 * (1 - g.lin(x + w, y, x + w + d, y + h)), pal)
    c.fill(front, 0.38 + v + 0.25 * (1 - g.lin(x, y, x + w, y + h)), pal)
    c.fill(top, 0.72 + v + 0.18 * (1 - g.lin(x, y - d, x + w + d, y)), pal)
    if outline:
        c.outline(front | top | side, pal)
    return front, top, side


def stars(c, n, seed, y_max, cols=(("white", 1), ("cyan", 5), ("violet", 4), ("gold", 4))):
    r = np.random.default_rng(seed)
    for _ in range(n):
        x, y = r.integers(0, c.g.W), r.integers(0, y_max)
        col = cols[int(r.integers(0, len(cols)))]
        if r.random() < 0.12:
            c.spark(x, y, 1, col, ("white", 2))
        else:
            c.dot(x, y, col, int(r.integers(140, 255)))
