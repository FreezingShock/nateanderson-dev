"""Shared kit for the 64 px Node Farm icons: zone (stat) icons and the per-tier button sprites.

Same look as the rest of the naOS art: flat shapes shaded with a gradient that is quantised to a colour ramp through a Bayer
threshold, so shading reads as dither, not as smooth colour. What is new at 64 px:

  * ramps are longer (6 to 8 steps) and hue-shifted (shadows lean cool or deep, highlights lean warm), so one zone reads as
    several shades of its colour instead of one flat hue
  * every stat also has accent ramps (patina on copper, steel on the bobbins, molten metal), drawn from the same palette family
  * rim light on the top-left edges, a dark selective outline, and soft dithered glow halos (partial alpha)
  * motion is drawn per frame from a phase p in [0, 1): spinning parts, travelling pulses, pours, orbiting rings, not only a
    post-effect on a still

Coordinates are in art pixels on a 64 x 64 grid, origin top-left, light from the top-left.
"""
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

N = 64
FRAMES = 8
_B8 = np.array([
    [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26], [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22], [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]]) / 64.0 - 0.5
_B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 - 0.5
BAYER = np.tile(_B4, (N // 4, N // 4))
BAYER8 = np.tile(_B8, (N // 8, N // 8))
yy, xx = np.mgrid[0:N, 0:N].astype(float)
X, Y = xx + 0.5, yy + 0.5


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def ramp(*cols):
    return [hexc(c) for c in cols]


# ---------------------------------------------------------------- palettes (dark -> light, hue-shifted)
P = {
    # shared
    "steel": ramp("#0f1316", "#20282d", "#36434a", "#56666f", "#7d8f98", "#aebdc4", "#e2ecef"),
    "ink": ramp("#08090b", "#14181c", "#232a30"),
    "white": ramp("#7f8a90", "#c4ccd0", "#ffffff"),
    "gold": ramp("#2a1a04", "#6b4508", "#b07a10", "#e8b020", "#ffd85a", "#fff3c0"),
    "ember": ramp("#3a0806", "#8a1a08", "#d8400e", "#ff7a1a", "#ffc040", "#fff2b0"),
    # bytes / cyan
    "cyan": ramp("#04121c", "#08304a", "#0b5a6b", "#1796aa", "#2fd8e8", "#8cf4ff", "#e4feff"),
    "deep": ramp("#0a0a24", "#14194a", "#232f7a", "#3a52b0"),
    # multipliers / lime
    "lime": ramp("#0c1a0a", "#1d3a10", "#3a6112", "#5f9418", "#8cc624", "#b6f04a", "#e2ff9a", "#f8ffe0"),
    "teal": ramp("#04201e", "#0a4a40", "#138470", "#2cc0a0", "#7af0d0"),
    # reboot / magenta
    "mag": ramp("#1c0414", "#45082a", "#7d0f45", "#b8165f", "#ff2d8a", "#ff7ab8", "#ffd2e6"),
    "violet": ramp("#140826", "#2e1257", "#55208f", "#8a3cd0", "#c58aff"),
    # copper
    "cu": ramp("#1a0a0e", "#3f1416", "#6e2614", "#a3441a", "#d0672a", "#f08a3c", "#ffb560", "#ffe0a0"),
    "patina": ramp("#0a2422", "#15463f", "#24705f", "#3fa486", "#82dcbc", "#cffff0"),
    "molten": ramp("#5a1006", "#b0260c", "#ff5a1a", "#ffa02a", "#ffe066", "#fffbe0"),
    # silicon
    "si": ramp("#090c22", "#141c46", "#22327a", "#3552b4", "#5478e6", "#7aa2ff", "#b0c8ff", "#e8f0ff"),
    "rainbow": ramp("#3f2aa0", "#2a8ad8", "#30d8b0", "#c8e850", "#ff9a5a", "#ff6ab0"),
    # quartz
    "qz": ramp("#160628", "#33104f", "#5a1d85", "#8a34b8", "#b65ae0", "#e08cff", "#f4c8ff", "#fff0ff"),
    "rose": ramp("#2a0820", "#5a1640", "#9a2a68", "#e05a9a", "#ffa8cc"),
    # aether
    "ae": ramp("#031a14", "#06362a", "#0f6b52", "#1a9a76", "#25c890", "#6bffc9", "#c4fff0", "#f0fffa"),
    "sky": ramp("#061830", "#0c3a6a", "#1a6aaa", "#40a8e8", "#a0e0ff"),
    # runes
    "rn": ramp("#1c1004", "#3f2808", "#7a5a0c", "#b0820e", "#e0aa1c", "#ffc53a", "#ffe38a", "#fff8d8"),
    "stone": ramp("#121214", "#24242a", "#3a3a44", "#56566a", "#7a7a90", "#a8a8bc"),
    # starglass
    "sg": ramp("#0a1824", "#183448", "#2c5a78", "#4a88aa", "#7cb4d2", "#bfeaff", "#e8f8ff", "#ffffff"),
    "prism": ramp("#ff6ab0", "#ffb84a", "#f0f060", "#60f0a0", "#60c8ff", "#a080ff"),
    # voidsteel
    "vs": ramp("#07050f", "#150f2a", "#2a1f55", "#43338a", "#5d46b0", "#9a7bff", "#c8b4ff", "#efe8ff"),
    "void": ramp("#000000", "#06020e", "#120626", "#28104a"),
    # chrono
    "ch": ramp("#1a0804", "#3f1308", "#7a2a10", "#b0401a", "#e05a28", "#ff7a4a", "#ffb088", "#ffe6d4"),
    "brass": ramp("#1e1404", "#4a3008", "#8a5c10", "#c8901c", "#f0c040", "#fff0a0"),
    # nebula
    "nb": ramp("#1a0618", "#3a0c38", "#6a1a62", "#a03292", "#d04eb8", "#ff8ad8", "#ffc4ec", "#fff0fa"),
    "dusk": ramp("#0c0820", "#1c1448", "#30247a", "#5040b0", "#7a6ae0"),
    # pulsars
    "pu": ramp("#03141c", "#062c3c", "#0f5a74", "#1a86a6", "#2ab4d4", "#64e6ff", "#b8f6ff", "#f0feff"),
    # singularity
    "sn": ramp("#1a0c02", "#3f1e04", "#7a3f0a", "#b05e10", "#e08418", "#ffb14a", "#ffd88a", "#fff6dc"),
    "hole": ramp("#000000", "#050308", "#0e0812"),
    # engrams
    "eg": ramp("#140a06", "#2e1a0e", "#55331c", "#80522e", "#b07a4a", "#e8b98a", "#ffe0bc", "#fff6ea"),
    "film": ramp("#0e0c0a", "#221e1a", "#3a342c", "#5a5044"),
    # paradox
    "px": ramp("#0c0d14", "#1e2030", "#36394f", "#585d7a", "#8a90ad", "#bcc2dc", "#dfe3f5", "#ffffff"),
    "split_r": ramp("#3a0410", "#8a0c28", "#ff2a5a", "#ff9ab0"),
    "split_c": ramp("#03262a", "#0a6070", "#20e0f0", "#a8faff"),
    # origin
    "or": ramp("#02140a", "#052a12", "#0b5a24", "#128a34", "#17b844", "#3dff6e", "#a8ffbc", "#e8fff0"),
    "red": ramp("#2b0808", "#80150f", "#d3341c", "#ff6a3d", "#ffd3a8"),
}


# ---------------------------------------------------------------- shapes (boolean masks on the 64 x 64 grid)
def poly(pts, ss=4):
    im = Image.new("L", (N * ss, N * ss), 0)
    ImageDraw.Draw(im).polygon([(x * ss, y * ss) for x, y in pts], fill=255)
    return np.asarray(im.resize((N, N), Image.BOX)).astype(float) > 127


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
    m = np.zeros((N, N), bool)
    for a, b in zip(pts, pts[1:]):
        m |= line(*a, *b, w)
    return m


def lin(x0, y0, x1, y1):
    dx, dy = x1 - x0, y1 - y0
    return np.clip(((X - x0) * dx + (Y - y0) * dy) / (dx * dx + dy * dy), 0, 1)


def radial(cx, cy, r):
    return np.clip(np.hypot(X - cx, Y - cy) / r, 0, 1)


def angle(cx, cy):
    """Angle of every pixel around (cx, cy) in turns, 0 at +x, increasing clockwise (screen y down)."""
    return (np.arctan2(Y - cy, X - cx) / (2 * math.pi)) % 1.0


def hexagon(cx, cy, R, rot=math.pi / 6, squash=1.0):
    m = np.ones((N, N), bool)
    for k in range(6):
        a = math.pi / 3 * k + rot
        m &= ((X - cx) * math.cos(a) + (Y - cy) / squash * math.sin(a)) <= R
    return m


def rotp(pts, a, cx, cy):
    c, s = math.cos(a), math.sin(a)
    return [(cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c) for x, y in pts]


def shift(m, dx, dy):
    out = np.zeros_like(m)
    H = m.shape[0]
    sx0, sx1 = max(0, -dx), min(H, H - dx)
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
    """Pixels of m whose neighbour in direction (dx, dy) is outside m: the rim facing that way."""
    return m & ~shift(m, -dx, -dy)


def wave(p, k=1, phase=0.0):
    return 0.5 - 0.5 * math.cos(2 * math.pi * (p * k + phase))


# ---------------------------------------------------------------- canvas
class Canvas:
    def __init__(self):
        self.img = np.zeros((N, N, 4), np.uint8)

    @property
    def alpha(self):
        return self.img[..., 3] > 0

    def fill(self, mask, v, pal, outline=None, dither=0.9, bayer=None):
        """Paint `mask` with shade v (0 dark .. 1 light, array or float) quantised into palette `pal` (name or list)."""
        r = P[pal] if isinstance(pal, str) else pal
        v = np.broadcast_to(np.asarray(v, float), (N, N))
        B = BAYER if bayer is None else bayer
        idx = np.clip(np.floor(v * (len(r) - 1) + 0.5 + B * dither), 0, len(r) - 1).astype(int)
        for i, c in enumerate(r):
            m = mask & (idx == i)
            self.img[m] = (*c, 255)
        if outline:
            self.outline(mask, outline)
        return self

    def set(self, mask, col, a=255):
        col = P[col[0]][col[1]] if isinstance(col, tuple) and isinstance(col[0], str) else col
        self.img[mask] = (*col, a)
        return self

    def outline(self, mask, col):
        """Dark outline just outside `mask`, only on empty pixels."""
        col = P[col][0] if isinstance(col, str) else col
        ring_ = grow(mask, 1) & ~mask & ~self.alpha
        self.img[ring_] = (*col, 255)
        return self

    def rim(self, mask, col, dx=-1, dy=-1):
        """Light rim on the edges of mask facing (dx, dy) (default: toward the top-left light)."""
        col = P[col[0]][col[1]] if isinstance(col, tuple) and isinstance(col[0], str) else col
        e = (edge(mask, dx, 0) if dx else np.zeros_like(mask)) | (edge(mask, 0, dy) if dy else np.zeros_like(mask))
        self.img[e & mask] = (*col, 255)
        return self

    def glow(self, mask, col, r=3, a=110, steps=2):
        """Soft halo around mask: dithered partial-alpha pixels on empty space only."""
        col = P[col[0]][col[1]] if isinstance(col, tuple) and isinstance(col[0], str) else col
        prev = mask
        for k in range(1, steps + 1):
            g = grow(mask, max(1, round(r * k / steps))) & ~prev
            alpha = int(a * (1 - (k - 1) / steps))
            thin = g & (BAYER < 0.5 - (k - 1) * 0.3) & ~self.alpha
            self.img[thin] = (*col, alpha)
            prev = prev | g
        return self

    def spark(self, x, y, size, col, core=None):
        """Four-point star; size 0 = single pixel, 1 = plus, 2+ = long arms."""
        col = P[col[0]][col[1]] if isinstance(col, tuple) and isinstance(col[0], str) else col
        x, y = int(round(x)), int(round(y))
        pts = [(x, y)]
        for d in range(1, size + 1):
            pts += [(x + d, y), (x - d, y), (x, y + d), (x, y - d)]
        if size >= 3:
            pts += [(x + 1, y + 1), (x - 1, y - 1), (x + 1, y - 1), (x - 1, y + 1)]
        for px, py in pts:
            if 0 <= px < N and 0 <= py < N:
                self.img[py, px] = (*col, 255)
        if core is not None and 0 <= x < N and 0 <= y < N:
            self.img[y, x] = (*(P[core[0]][core[1]] if isinstance(core, tuple) else core), 255)
        return self

    def over(self, other):
        a = other.img[..., 3:4].astype(float) / 255
        base = self.img.astype(float)
        out = base.copy()
        out[..., :3] = other.img[..., :3] * a + base[..., :3] * (1 - a)
        out[..., 3:4] = np.maximum(base[..., 3:4], other.img[..., 3:4])
        self.img = out.astype(np.uint8)
        return self

    def finish(self, col=(8, 9, 11)):
        """Global selective outline: a dark 1 px edge around every opaque shape (keeps sprites readable on any button)."""
        solid = self.img[..., 3] >= 200
        ring_ = grow(solid, 1) & ~solid
        self.img[ring_ & (self.img[..., 3] < 200)] = (*col, 255)
        return self


# ---------------------------------------------------------------- sheet helpers
def to_image(arr):
    return Image.fromarray(arr, "RGBA")


def contact(img, scale=4, bg=(20, 20, 20, 255)):
    big = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
    out = Image.new("RGBA", big.size, bg)
    out.alpha_composite(big)
    return out


def save_pair(img, stem):
    img.save(f"{stem}.png", optimize=True)
    img.save(f"{stem}.webp", lossless=True, quality=100, method=6)
