"""Shared kit for Node Farm staged zone art (one sheet per zone panel).

Contract (also in docs/node-farm.md, "Zone art"):
  sheet  public/naos/nodefarm/zone-<statId>.{png,webp}
  cell   W x H = 288 x 96 art px, transparent background: rows 0-31 are sky/backdrop reaching up to the title bar, the
         sprites live in rows 32-95. The whole cell is always shown (scaled to fit, never cut)
  rows   STAGES = 8: row 0 is the base scene, row n (1..7) shows sprites 1..n, each bigger than the last
  cols   FRAMES = 6: a clean loop at 6 fps, frame 0 doubles as the still (reduced motion, offscreen)
  shown  scaled so the cell fills title bar to spec lines and touches the panel's right edge (about 1.5x to 3x)
  keep   the panel darkens the far left (behind the description) and a pool behind the big number at the top right
  budget WebP lossless <= 30 KB, PNG <= 300 KB

Drawing works like nodefarm-icons.py: flat shapes shaded with a gradient that is quantised to a five-step ramp through a 4x4
Bayer threshold, so shading reads as dither. Every helper here works on the full 288 x 64 grid. A lane script looks like:

    import nodefarm_zone_kit as K
    def draw(stage, frame):
        c = K.Cell()
        ...           # c.fill(K.poly([...]), shade, "cyan")
        return c
    K.save_sheet("bytes", draw)

Run a lane script with python3 scripts/naos-art/<script>.py; it writes the sheet and a contact preview (path printed).
"""
import importlib.util
import math
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "public/naos/nodefarm"
W, H = 288, 96
HEAD = 32  # rows 0..HEAD-1: sky/backdrop up to the title bar
STAGES, FRAMES = 8, 6
FPS = 6
BUDGET = {"webp": 30_000, "png": 300_000}


def _load(name):
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), HERE / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_icons = _load("nodefarm-icons")
RAMPS = _icons.RAMPS
hexc = _icons.hexc
_B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 - 0.5
BAYER = np.tile(_B4, (H // 4, W // 4))
yy, xx = np.mgrid[0:H, 0:W].astype(float)


# ---------------------------------------------------------------- shapes (boolean masks on the W x H grid)
def poly(pts, ss=4):
    """Filled polygon, supersampled then thresholded so edges stay crisp pixels."""
    im = Image.new("L", (W * ss, H * ss), 0)
    ImageDraw.Draw(im).polygon([(x * ss, y * ss) for x, y in pts], fill=255)
    return np.asarray(im.resize((W, H), Image.BOX)) > 127


def disc(cx, cy, r, ry=None):
    ry = ry or r
    return ((xx + .5 - cx) / r) ** 2 + ((yy + .5 - cy) / ry) ** 2 <= 1


def rect(x0, y0, x1, y1):
    return (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)


def line(x0, y0, x1, y1, w=1.0):
    """A straight stroke w px wide."""
    dx, dy = x1 - x0, y1 - y0
    L2 = dx * dx + dy * dy or 1
    t = np.clip(((xx + .5 - x0) * dx + (yy + .5 - y0) * dy) / L2, 0, 1)
    px, py = x0 + t * dx, y0 + t * dy
    return (xx + .5 - px) ** 2 + (yy + .5 - py) ** 2 <= (w / 2) ** 2


def lin(x0, y0, x1, y1):
    """Gradient 0 at (x0, y0) to 1 at (x1, y1), clamped."""
    dx, dy = x1 - x0, y1 - y0
    return np.clip(((xx - x0) * dx + (yy - y0) * dy) / (dx * dx + dy * dy or 1), 0, 1)


def radial(cx, cy, r):
    """1 at the centre fading to 0 at radius r."""
    return np.clip(1 - np.hypot(xx + .5 - cx, yy + .5 - cy) / r, 0, 1)


def wave(f, period=FRAMES):
    """0..1..0 over the loop, for pulses that must loop cleanly."""
    return 0.5 - 0.5 * math.cos(2 * math.pi * f / period)


# ---------------------------------------------------------------- canvas
class Cell:
    def __init__(self):
        self.img = np.zeros((H, W, 4), np.uint8)

    def fill(self, mask, v, rampname, outline=False, dither=0.9):
        """Paint mask with shade v (0 dark .. 1 light, scalar or array) in the named ramp, dithered."""
        r = RAMPS[rampname]
        v = np.broadcast_to(np.asarray(v, float), (H, W))
        idx = np.clip(np.floor(v * (len(r) - 1) + 0.5 + BAYER * dither), 0, len(r) - 1).astype(int)
        for i, c in enumerate(r):
            m = mask & (idx == i)
            self.img[m] = (*c, 255)
        if outline:
            self.outline(mask, rampname)

    def outline(self, mask, rampname, shade=0):
        d = np.zeros_like(mask)
        d[1:, :] |= mask[:-1, :]; d[:-1, :] |= mask[1:, :]; d[:, 1:] |= mask[:, :-1]; d[:, :-1] |= mask[:, 1:]
        ring = d & ~mask & (self.img[..., 3] == 0)
        self.img[ring] = (*RAMPS[rampname][shade], 255)

    def set(self, mask, col, alpha=255):
        self.img[mask] = (*(hexc(col) if isinstance(col, str) else col), alpha)

    def shade(self, mask, rampname, i, alpha=255):
        self.set(mask, RAMPS[rampname][i], alpha)

    def haze(self, mask, v, rampname, alpha=70):
        """Low-contrast backdrop: dark shades only (0..1), partial alpha, only where nothing is drawn yet."""
        r = RAMPS[rampname][:2]
        v = np.broadcast_to(np.asarray(v, float), (H, W))
        on = mask & (self.img[..., 3] == 0) & (v + BAYER * 0.9 > 0.25)
        idx = (v + BAYER * 0.9 > 0.75).astype(int)
        for i, c in enumerate(r):
            m = on & (idx == i)
            self.img[m] = (*c, min(alpha, 90))

    def blit(self, sprite, x, y, scale=1):
        """Paste an RGBA array at (x, y), scaled by a whole number, opaque pixels only."""
        s = np.repeat(np.repeat(sprite, scale, 0), scale, 1)
        h, w = s.shape[:2]
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(W, x + w), min(H, y + h)
        if x1 <= x0 or y1 <= y0:
            return
        sub = s[y0 - y:y1 - y, x0 - x:x1 - x]
        m = sub[..., 3] > 0
        self.img[y0:y1, x0:x1][m] = sub[m]

    def under(self, other):
        """Draw `other` (a Cell) underneath this one."""
        m = (self.img[..., 3] == 0) & (other.img[..., 3] > 0)
        self.img[m] = other.img[m]


def icon(name):
    """The zone's existing 32 x 32 icon as RGBA, for blitting at 1x or 2x."""
    fn = dict(_icons.ICONS)[name]
    return fn().img


# ---------------------------------------------------------------- output
def save_sheet(stat, draw, preview=True):
    """Render every stage x frame with draw(stage, frame) -> Cell and write the sheet (+ a preview)."""
    sheet = np.zeros((H * STAGES, W * FRAMES, 4), np.uint8)
    for s in range(STAGES):
        for f in range(FRAMES):
            img = draw(s, f).img
            sheet[s * H:(s + 1) * H, f * W:(f + 1) * W] = img
    OUT.mkdir(parents=True, exist_ok=True)
    im = Image.fromarray(sheet, "RGBA")
    png, webp = OUT / f"zone-{stat}.png", OUT / f"zone-{stat}.webp"
    im.save(png, optimize=True)
    im.save(webp, lossless=True, quality=100, method=6)
    for p, k in ((png, "png"), (webp, "webp")):
        n = p.stat().st_size
        flag = "" if n <= BUDGET[k] else f"  OVER BUDGET ({BUDGET[k] // 1000} KB)"
        print(f"  {p.name}: {n / 1000:.0f} KB{flag}")
    if preview:
        write_preview(stat, sheet)
    return sheet


def write_preview(stat, sheet, scale=2):
    """Frame 0 of every stage stacked on a panel-coloured background, plus frames of stage 7, for eyeballing."""
    pad = 6
    rows = [sheet[s * H:(s + 1) * H, :W] for s in range(STAGES)]
    rows += [sheet[7 * H:8 * H, f * W:(f + 1) * W] for f in range(1, FRAMES)]
    out = np.zeros(((H + pad) * len(rows), W, 4), np.uint8)
    out[..., :3] = (17, 19, 20)
    out[..., 3] = 255
    for i, r in enumerate(rows):
        y = i * (H + pad)
        a = r[..., 3:4] / 255.0
        out[y:y + H, :, :3] = (r[..., :3] * a + out[y:y + H, :, :3] * (1 - a)).astype(np.uint8)
    im = Image.fromarray(out, "RGBA").resize((W * scale, out.shape[0] * scale), Image.NEAREST)
    d = Path(os.environ.get("NF_PREVIEW_DIR", "/tmp"))
    d.mkdir(parents=True, exist_ok=True)
    p = d / f"zone-{stat}-preview.png"
    im.save(p)
    print(f"  preview: {p}")
