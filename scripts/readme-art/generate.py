#!/usr/bin/env python3
"""Draws the README art in docs/readme/ (naOS style, original, no third-party art).

Run:  python3 scripts/readme-art/generate.py          (rebuilds everything)
      python3 scripts/readme-art/generate.py hero card-brasswork   (only those names)

Each piece is drawn on a small pixel grid (flat palette shapes plus Bayer 8x8
ordered dither for gradients and fields), then scaled 2x with nearest-neighbour
so every art pixel stays crisp. Needs numpy and Pillow, plus Inter (Bold) and
DejaVu Sans Mono for the baked-in labels. Set NAOS_FONT_DIR to point at other
copies of those fonts.
"""

import glob
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "docs", "readme")
SCALE = 2  # every logical art pixel becomes a 2x2 block

# ---------------------------------------------------------------- palettes
NAOS = {
    "ground": "#1a1a1a",
    "paper": "#f4f4f2",
    "ink": "#1a1a1a",
    "cyan": "#2fd8e8",
    "cyan_ink": "#0a6f7c",  # cyan for the paper theme (contrast on light)
}
BRASS = {
    "ink": "#140d08", "wood": "#3a2616", "wood_hi": "#4d3320", "copper": "#c4682f",
    "copper_lo": "#7a3a18", "brass": "#d29a3c", "brass_lo": "#8a5a1e",
    "brass_hi": "#f4cf7e", "cream": "#f0dfb8", "steel": "#5e5348",
}
STAR = {
    "ink": "#05040c", "plum": "#1d0f22", "plum_hi": "#3a1a2a", "magenta": "#ff2d8a",
    "coral": "#ff6b57", "gold": "#ffc53a", "white": "#fff3c4", "lime": "#b6f04a",
    "dim": "#8a90a8", "text": "#e9ecf6",
}
GOLD = {
    "dusk": "#2a1a2e", "dusk_hi": "#4a2440", "rose": "#7a3046", "ember": "#c2552e",
    "amber": "#f0a030", "hi": "#ffd36a", "bg": "#120e0b", "ink": "#f2e9d6",
    "steel": "#8fa0b4",
}
NODE = {
    "ground": "#0e0e0e", "dot": "#16292b", "dim": "#1d4a4f", "cyan": "#2fd8e8",
    "ink": "#f4f4f2",
}


def hx(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# ---------------------------------------------------------------- dither + noise
def _bayer_raw(n):
    if n == 1:
        return np.zeros((1, 1))
    m = _bayer_raw(n // 2)
    return np.block([[4 * m, 4 * m + 2], [4 * m + 3, 4 * m + 1]])


BAYER = (_bayer_raw(8) + 0.5) / 64.0


def threshold(h, w):
    return np.tile(BAYER, (h // 8 + 1, w // 8 + 1))[:h, :w]


def dither(field, ramp):
    """Map a 0..1 field onto a colour ramp (low to high) with ordered dither."""
    cols = np.array([hx(c) for c in ramp], dtype=np.uint8)
    n = len(ramp)
    h, w = field.shape
    v = np.clip(field, 0, 1) * (n - 1)
    lo = np.clip(np.floor(v).astype(int), 0, n - 1)
    hi = np.minimum(lo + 1, n - 1)
    frac = v - lo
    pick = np.where(frac > threshold(h, w), hi, lo)
    return cols[pick]


def fbm(h, w, seed, cell=32, octaves=4):
    """Smooth value noise, summed over octaves. Returns 0..1."""
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w))
    total = 0.0
    amp = 1.0
    for o in range(octaves):
        c = max(cell // (2 ** o), 2)
        g = rng.random((h // c + 3, w // c + 3))
        ys = np.arange(h) / c
        xs = np.arange(w) / c
        y0 = np.floor(ys).astype(int)
        x0 = np.floor(xs).astype(int)
        ty = ys - y0
        tx = xs - x0
        ty = ty * ty * (3 - 2 * ty)
        tx = tx * tx * (3 - 2 * tx)
        a = g[np.ix_(y0, x0)]
        b = g[np.ix_(y0, x0 + 1)]
        c_ = g[np.ix_(y0 + 1, x0)]
        d = g[np.ix_(y0 + 1, x0 + 1)]
        TY = ty[:, None]
        TX = tx[None, :]
        layer = (a * (1 - TX) + b * TX) * (1 - TY) + (c_ * (1 - TX) + d * TX) * TY
        out += amp * layer
        total += amp
        amp *= 0.5
    out /= total
    return (out - out.min()) / (out.max() - out.min() + 1e-9)


def grid(h, w):
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    return yy, xx


def to_image(arr):
    return Image.fromarray(arr.astype(np.uint8), "RGB")


def upscale(im):
    return im.resize((im.width * SCALE, im.height * SCALE), Image.NEAREST)


# ---------------------------------------------------------------- fonts
def font(size, mono=False):
    fdir = os.environ.get("NAOS_FONT_DIR", "")
    if mono:
        cands = [os.path.join(fdir, "DejaVuSansMono-Bold.ttf"),
                 "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
                 "C:/Windows/Fonts/consolab.ttf", "/System/Library/Fonts/Menlo.ttc"]
    else:
        cands = [os.path.join(fdir, "Inter-Bold.otf"),
                 "/usr/share/fonts/opentype/inter/Inter-Bold.otf",
                 "C:/Windows/Fonts/arialbd.ttf", "/System/Library/Fonts/Helvetica.ttc"]
    for path in cands:
        if path and os.path.exists(path):
            return ImageFont.truetype(path, size)
    matches = glob.glob("/usr/share/fonts/**/*Bold*.*", recursive=True)
    if matches:
        return ImageFont.truetype(matches[0], size)
    raise SystemExit("No bold font found; set NAOS_FONT_DIR to a folder with Inter-Bold.otf")


def text_size(draw, text, f):
    box = draw.textbbox((0, 0), text, font=f)
    return box[2] - box[0], box[3] - box[1], box[0], box[1]


def plate(draw, x, y, text, f, fill, ink, pad=(18, 10), border=None):
    tw, th, ox, oy = text_size(draw, text, f)
    w, h = tw + pad[0] * 2, th + pad[1] * 2
    draw.rectangle([x, y, x + w, y + h], fill=fill)
    if border:
        draw.rectangle([x, y, x + w, y + h], outline=border, width=2)
    draw.text((x + pad[0] - ox, y + pad[1] - oy), text, font=f, fill=ink)
    return x + w, y + h


# ---------------------------------------------------------------- hero
def hero(light=False):
    W, H = 600, 180
    yy, xx = grid(H, W)
    land = fbm(H, W, seed=7, cell=72, octaves=3)

    def blob(cx, cy, rx, ry):
        return np.exp(-(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2))

    mask = np.maximum(blob(440, 104, 170, 82), blob(190, 136, 84, 40))
    height = 0.7 * land + 0.95 * mask - 0.42
    gy, gx = np.gradient(height)
    shade = np.clip(0.5 + 14 * (-gx - gy), 0, 1)
    contour = ((height * 7) % 1 < 0.035) & (height > 0.02)
    sea = 0.14 + 0.06 * np.sin(yy * 1.1 + xx * 0.03)
    field = np.where(height > 0, 0.18 + 0.7 * shade, sea)
    field = np.where(contour, 0.95, field)
    field = np.clip(field, 0, 1)
    # Scanlines: every third row a touch darker.
    field = field * np.where(np.arange(H)[:, None] % 3 == 2, 0.86, 1.0) * np.ones((H, W))

    if light:
        ramp = ["#f4f4f2", "#dcdcd8", "#b4b4b0", "#7c7c78", "#3c3c3a", "#1a1a1a"]
        accent = NAOS["cyan_ink"]
        rgb = dither(1 - field * 0.85 - 0.05, ramp)
    else:
        ramp = ["#1a1a1a", "#2c2c2c", "#4c4c4c", "#7e7e7c", "#b8b8b5", "#f4f4f2"]
        accent = NAOS["cyan"]
        rgb = dither(field, ramp)

    im = to_image(rgb)
    d = ImageDraw.Draw(im)
    # Sun ring and dot in accent colour.
    cx, cy = 118, 46
    d.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], outline=hx(accent), width=1)
    d.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=hx(accent))
    # Baseline rule.
    d.line([0, H - 4, W, H - 4], fill=hx(accent), width=1)
    im = upscale(im)
    d = ImageDraw.Draw(im)

    if light:
        block, blockink = NAOS["ink"], NAOS["paper"]
        sub_fill, sub_ink = NAOS["paper"], NAOS["ink"]
    else:
        block, blockink = NAOS["paper"], NAOS["ink"]
        sub_fill, sub_ink = NAOS["ground"], NAOS["paper"]
    title = font(104)
    x, y = 46, 52
    x2, y2 = plate(d, x, y, "naOS", title, block, blockink, pad=(26, 8))
    small = font(30, mono=True)
    plate(d, x, y2 + 16, "NATE ANDERSON OS  //  GAMES, RENDERS, SYSTEMS", small,
          sub_fill, sub_ink, pad=(12, 7))
    return im


# ---------------------------------------------------------------- dividers
def divider(number, label, light=False):
    W, H = 600, 56
    yy, xx = grid(H, W)
    wash = 0.6 * (1 - xx / W) + 0.3 * fbm(H, W, 21 + number, 10, 2)
    ramp = (["#f4f4f2", "#dcdcd8", "#b4b4b0", "#7c7c78", "#3c3c3a", "#1a1a1a"] if light
            else ["#1a1a1a", "#262626", "#3c3c3c", "#606060", "#8a8a88", "#b8b8b5"])
    rgb = dither(np.clip(wash, 0, 1), ramp)
    im = upscale(to_image(rgb))
    d = ImageDraw.Draw(im)
    accent = hx(NAOS["cyan_ink"] if light else NAOS["cyan"])
    d.rectangle([0, im.height - 6, im.width, im.height], fill=accent)
    mono = font(34, mono=True)
    f = font(54)
    block, blockink = (NAOS["ink"], NAOS["paper"]) if light else (NAOS["paper"], NAOS["ink"])
    x2, _ = plate(d, 0, 10, f"{number:02d}", mono, block, blockink, pad=(16, 8))
    plate(d, x2 + 10, 10, label, f, block, blockink, pad=(18, 8))
    return im


# ---------------------------------------------------------------- game cards
def gear(d, cx, cy, r, teeth, phase, body, lit, shade, hole):
    pts = []
    step = 2 * math.pi / teeth
    for k in range(teeth):
        a = phase + k * step
        w1 = step * 0.30
        w2 = step * 0.16
        ri = r * 0.82
        pts += [
            (cx + ri * math.cos(a - w1), cy + ri * math.sin(a - w1)),
            (cx + r * math.cos(a - w2), cy + r * math.sin(a - w2)),
            (cx + r * math.cos(a + w2), cy + r * math.sin(a + w2)),
            (cx + ri * math.cos(a + w1), cy + ri * math.sin(a + w1)),
        ]
    d.polygon(pts, fill=hx(body))
    hub = r * 0.62
    d.ellipse([cx - hub, cy - hub, cx + hub, cy + hub], fill=hx(shade))
    d.ellipse([cx - hub + 2, cy - hub + 2, cx + hub - 2, cy + hub - 2], fill=hx(lit))
    d.ellipse([cx - hole, cy - hole, cx + hole, cy + hole], fill=hx(BRASS["ink"]))
    for k in range(6):  # spokes
        a = k * math.pi / 3 + phase
        d.line([cx + hole * math.cos(a), cy + hole * math.sin(a),
                cx + hub * math.cos(a), cy + hub * math.sin(a)], fill=hx(body), width=2)


def iso_cube(d, cx, cy, w, h, top, left, right):
    T = (cx, cy - h)
    UR = (cx + w, cy - h / 2)
    LR = (cx + w, cy + h / 2)
    B = (cx, cy + h)
    LL = (cx - w, cy + h / 2)
    UL = (cx - w, cy - h / 2)
    C = (cx, cy)
    d.polygon([T, UR, C, UL], fill=hx(top))
    d.polygon([UL, C, B, LL], fill=hx(left))
    d.polygon([C, UR, LR, B], fill=hx(right))


def card_brasswork():
    W, H = 480, 270
    yy, xx = grid(H, W)
    field = 0.18 + 0.32 * (yy / H) + 0.14 * fbm(H, W, 3, 24, 3)
    rgb = dither(field, [BRASS["ink"], "#1f140b", BRASS["wood"], BRASS["wood_hi"],
                         BRASS["brass_lo"], BRASS["copper"]])
    im = to_image(rgb)
    d = ImageDraw.Draw(im)
    gear(d, 330, 112, 84, 18, 0.1, BRASS["brass"], BRASS["brass_hi"], BRASS["brass_lo"], 20)
    gear(d, 176, 178, 40, 12, 0.4, BRASS["copper"], BRASS["brass"], BRASS["copper_lo"], 11)
    gear(d, 418, 34, 28, 10, 0.0, BRASS["steel"], "#8a7d70", "#3a3128", 8)
    # Voxel stack, top left.
    for (i, j, k) in [(0, 0, 0), (1, 0, 0), (0, 1, 0), (1, 1, 0), (0, 0, 1), (1, 0, 1)]:
        cx = 70 + (i - j) * 9
        cy = 66 + (i + j) * 5 - k * 10
        iso_cube(d, cx, cy, 9, 5, BRASS["brass_hi"], BRASS["brass"], BRASS["brass_lo"])
    # Belt along the base with rivets.
    d.rectangle([0, 226, W, 242], fill=hx(BRASS["wood_hi"]))
    for x in range(0, W, 12):
        d.line([x, 242, x + 8, 226], fill=hx("#2a1b0e"), width=2)
    for x in range(6, W, 24):
        d.rectangle([x, 230, x + 2, 232], fill=hx(BRASS["brass_hi"]))
    d.rectangle([0, 242, W, H], fill=hx(BRASS["ink"]))
    im = upscale(im)
    d = ImageDraw.Draw(im)
    plate(d, 30, 300, "BRASSWORK", font(68), BRASS["ink"], BRASS["brass_hi"], pad=(20, 10),
          border=hx(BRASS["brass"]))
    plate(d, 30, 396, "3D voxel clockwork automation", font(30, mono=True), BRASS["ink"],
          BRASS["cream"], pad=(12, 7))
    return im


def card_starwright():
    W, H = 480, 270
    cx, cy = 300, 112
    yy, xx = grid(H, W)
    dist = np.hypot(xx - cx, yy - cy)
    glow_field = np.clip(1 - dist / 104, 0, 1) ** 1.8
    field = 0.1 + 0.16 * fbm(H, W, 11, 40, 4) + 0.9 * glow_field
    rgb = dither(np.clip(field, 0, 1), [STAR["ink"], STAR["plum"], STAR["plum_hi"], "#4a1f3f",
                                        "#5a1f3a", STAR["magenta"], STAR["coral"], STAR["gold"],
                                        STAR["white"]])
    im = to_image(rgb)
    d = ImageDraw.Draw(im)
    rng = np.random.default_rng(5)
    for _ in range(150):
        x, y = int(rng.integers(0, W)), int(rng.integers(0, H))
        if math.hypot(x - cx, y - cy) < 100:
            continue
        d.point((x, y), fill=hx(STAR["text"] if rng.random() < 0.4 else STAR["dim"]))
    # Star: core disc with spikes.
    d.ellipse([cx - 15, cy - 15, cx + 15, cy + 15], fill=hx(STAR["gold"]))
    d.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], fill=hx(STAR["white"]))
    for dx, dy, L in [(1, 0, 62), (-1, 0, 62), (0, 1, 62), (0, -1, 62)]:
        for k in range(L):
            if k > 16:
                d.point((cx + dx * k, cy + dy * k), fill=hx(STAR["gold"]))
    # Ringed planet, upper left, ring drawn in front half only.
    px, py, pr = 110, 98, 26
    d.ellipse([px - 46, py - 9, px + 46, py + 9], outline=hx(STAR["gold"]), width=2)
    d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=hx(STAR["coral"]))
    d.ellipse([px - pr + 8, py - pr + 6, px + pr + 4, py + pr + 4], fill=hx("#8a2a3a"))
    d.ellipse([px - pr + 14, py - pr + 10, px + pr - 4, py + pr - 4], fill=hx(STAR["coral"]))
    d.arc([px - 46, py - 9, px + 46, py + 9], 0, 180, fill=hx(STAR["gold"]), width=2)
    # Small magenta planet.
    qx, qy, qr = 404, 200, 14
    d.ellipse([qx - qr, qy - qr, qx + qr, qy + qr], fill=hx(STAR["magenta"]))
    d.ellipse([qx - 2, qy + 2, qx + qr, qy + qr], fill=hx("#7a1040"))
    # Constellation: dotted lime path with node squares.
    nodes = [(56, 246), (112, 236), (172, 252), (232, 234), (300, 246)]
    for (ax, ay), (bx, by) in zip(nodes, nodes[1:]):
        steps = 26
        for s in range(steps):
            if s % 2:
                continue
            t = s / steps
            d.point((ax + (bx - ax) * t, ay + (by - ay) * t), fill=hx(STAR["lime"]))
    for nx, ny in nodes:
        d.rectangle([nx - 2, ny - 2, nx + 2, ny + 2], outline=hx(STAR["lime"]), width=1)
    im = upscale(im)
    d = ImageDraw.Draw(im)
    plate(d, 30, 300, "STARWRIGHT", font(68), STAR["ink"], STAR["gold"], pad=(20, 10),
          border=hx(STAR["gold"]))
    plate(d, 30, 396, "star fusion idle, one element at a time", font(30, mono=True),
          STAR["ink"], STAR["text"], pad=(12, 7))
    return im


def card_groundbreak():
    W, H = 480, 270
    yy, xx = grid(H, W)
    horizon = 0.66 * H
    sky_t = np.clip(yy / horizon, 0, 1) ** 1.4
    sky = dither(0.02 + 0.98 * sky_t + 0.08 * fbm(H, W, 4, 30, 3),
                 [GOLD["dusk"], GOLD["dusk_hi"], GOLD["rose"], GOLD["ember"],
                  GOLD["amber"], GOLD["hi"]])
    water_t = np.clip(1 - (yy - horizon) / (H - horizon), 0, 1)
    refl = 0.6 * np.exp(-((xx - 300) / 110) ** 2) * water_t + 0.12
    water = dither(refl + 0.1 * fbm(H, W, 6, 6, 2), [GOLD["dusk"], GOLD["rose"], GOLD["ember"],
                                                     GOLD["amber"], GOLD["hi"]])
    rgb = np.where((yy >= horizon)[..., None], water, sky)
    im = to_image(rgb)
    d = ImageDraw.Draw(im)
    # Sun: flat disc, sitting on the horizon.
    d.ellipse([300 - 30, 124 - 30, 300 + 30, 124 + 30], fill=hx(GOLD["hi"]))
    d.ellipse([300 - 22, 124 - 22, 300 + 22, 124 + 22], fill=hx("#ffe9a8"))
    # Far city, then near city, with lit windows.
    rng = np.random.default_rng(12)
    for layer, colour, base, hmin, hmax in [(0, "#4a2440", horizon, 14, 42),
                                            (1, GOLD["dusk"], horizon + 2, 18, 58)]:
        x = 0
        while x < W:
            bw = int(rng.integers(10, 22))
            bh = int(rng.integers(hmin, hmax))
            d.rectangle([x, base - bh, x + bw, H], fill=hx(colour))
            if layer == 1:
                for wy in range(int(base - bh) + 4, int(base) - 4, 6):
                    for wx in range(x + 3, x + bw - 2, 5):
                        if rng.random() < 0.28:
                            d.point((wx, wy), fill=hx(GOLD["hi"]))
            x += bw + int(rng.integers(0, 4))
    # Bridge towers and deck across the bay.
    deck = 152
    d.line([40, deck, 440, deck], fill=hx(GOLD["dusk"]), width=2)
    for tx in (120, 200):
        d.rectangle([tx - 2, deck - 40, tx + 2, deck + 6], fill=hx(GOLD["dusk"]))
    for k in range(0, 80):
        t = k / 79
        xq = 40 + t * 80
        yq = deck - 40 * (1 - (2 * t - 1) ** 2) * 0 - 22 * (1 - (2 * t - 1) ** 2)
        d.point((xq, yq + 14), fill=hx(GOLD["dusk"]))
    # Tower under construction with scaffold and a crane.
    tx = 250
    d.rectangle([tx, 92, tx + 20, horizon + 4], outline=hx(GOLD["steel"]), width=1)
    for yy_ in range(96, int(horizon), 10):
        d.line([tx, yy_, tx + 20, yy_], fill=hx(GOLD["steel"]))
    for yy_ in range(96, int(horizon) - 4, 10):
        d.line([tx, yy_, tx + 20, yy_ + 10], fill=hx(GOLD["steel"]))
    cr = 404
    d.line([cr, 52, cr, horizon + 4], fill=hx(GOLD["dusk"]), width=3)
    d.line([cr - 90, 60, cr + 26, 52], fill=hx(GOLD["dusk"]), width=2)
    d.line([cr - 60, 60, cr - 60, 92], fill=hx(GOLD["steel"]), width=1)
    d.rectangle([cr - 4, horizon - 36, cr + 4, horizon - 20], fill=hx(GOLD["dusk"]))
    im = upscale(im)
    d = ImageDraw.Draw(im)
    plate(d, 30, 300, "GROUNDBREAK", font(68), GOLD["bg"], GOLD["ink"], pad=(20, 10),
          border=hx(GOLD["hi"]))
    plate(d, 30, 396, "idle construction company, bay area", font(30, mono=True), GOLD["bg"],
          GOLD["hi"], pad=(12, 7))
    return im


def card_node_farm():
    W, H = 480, 270
    yy, xx = grid(H, W)
    rgb = dither(0.08 + 0.16 * fbm(H, W, 13, 36, 3) + 0.06 * np.sin(yy / 9),
                 [NODE["ground"], NODE["dot"], "#132a2d", NODE["dim"]])
    im = to_image(rgb)
    d = ImageDraw.Draw(im)
    for gy in range(6, H, 12):
        for gx in range(6, W, 12):
            d.point((gx, gy), fill=hx(NODE["dim"]))
    core = (240, 118)
    nodes = [(92, 60), (150, 34), (360, 44), (410, 120), (352, 190), (60, 118), (214, 238),
             (120, 240), (318, 84), (440, 240), (196, 88)]
    for (nx, ny) in nodes:
        for s in range(0, 100, 4):
            t = s / 100
            x = core[0] + (nx - core[0]) * t
            y = core[1] + (ny - core[1]) * t
            d.point((x, y), fill=hx(NODE["dim"]))
    for i, (nx, ny) in enumerate(nodes):
        size = 7 if i % 3 else 9
        d.rectangle([nx - size, ny - size, nx + size, ny + size], outline=hx(NODE["cyan"]), width=1)
        d.rectangle([nx - 2, ny - 2, nx + 2, ny + 2], fill=hx(NODE["cyan"]))
    for r, w in [(40, 2), (28, 1)]:
        d.ellipse([core[0] - r, core[1] - r, core[0] + r, core[1] + r], outline=hx(NODE["cyan"]),
                  width=w)
    d.rectangle([core[0] - 10, core[1] - 10, core[0] + 10, core[1] + 10], fill=hx(NODE["cyan"]))
    d.rectangle([core[0] - 4, core[1] - 4, core[0] + 4, core[1] + 4], fill=hx(NODE["ground"]))
    im = upscale(im)
    d = ImageDraw.Draw(im)
    plate(d, 30, 300, "NODE FARM", font(68), NODE["ground"], NODE["cyan"], pad=(20, 10),
          border=hx(NODE["cyan"]))
    plate(d, 30, 396, "idle incremental, grown from one hacked node", font(30, mono=True),
          NODE["ground"], NODE["ink"], pad=(12, 7))
    return im


def footer(light=False):
    W, H = 600, 40
    yy, xx = grid(H, W)
    ramp = (["#f4f4f2", "#dcdcd8", "#b4b4b0", "#7c7c78", "#3c3c3a", "#1a1a1a"] if light
            else ["#1a1a1a", "#262626", "#3c3c3c", "#606060", "#8a8a88", "#b8b8b5"])
    wash = 0.2 + 0.7 * (xx / W) * fbm(H, W, 77, 12, 2)
    im = upscale(to_image(dither(np.clip(wash, 0, 1), ramp)))
    d = ImageDraw.Draw(im)
    accent = hx(NAOS["cyan_ink"] if light else NAOS["cyan"])
    d.rectangle([0, 0, im.width, 4], fill=accent)
    block, blockink = (NAOS["ink"], NAOS["paper"]) if light else (NAOS["paper"], NAOS["ink"])
    plate(d, 24, 16, "// end of transmission", font(30, mono=True), block, blockink, pad=(12, 6))
    return im


# ---------------------------------------------------------------- link tiles
TILE_W, TILE_H = 240, 120
CYAN = "#2fd8e8"
PAPER = "#f4f4f2"


def _icon(d, name, cx, cy, col):
    """Small line icons on the logical grid, centred on (cx, cy)."""
    c = hx(col)
    L = lambda *p: d.line(list(p), fill=c, width=1)
    if name == "home":
        d.polygon([(cx - 12, cy), (cx, cy - 12), (cx + 12, cy)], outline=c)
        d.rectangle([cx - 9, cy, cx + 9, cy + 12], outline=c)
        d.rectangle([cx - 3, cy + 5, cx + 3, cy + 12], fill=c)
    elif name == "about":
        d.ellipse([cx - 5, cy - 12, cx + 5, cy - 2], fill=c)
        d.pieslice([cx - 11, cy - 1, cx + 11, cy + 21], 180, 360, fill=c)
    elif name == "creations":
        for ox, oy in [(-10, -10), (1, -10), (-10, 1), (1, 1)]:
            d.rectangle([cx + ox, cy + oy, cx + ox + 9, cy + oy + 9], outline=c)
    elif name == "studies":
        d.rectangle([cx - 11, cy - 11, cx + 11, cy + 11], outline=c)
        L(cx - 4, cy - 11, cx - 4, cy + 11)
        L(cx, cy - 5, cx + 7, cy - 5)
        L(cx, cy, cx + 7, cy)
        L(cx, cy + 5, cx + 5, cy + 5)
    elif name == "timeline":
        L(cx - 12, cy, cx + 12, cy)
        d.ellipse([cx - 13, cy - 1, cx - 9, cy + 3], fill=c)
        d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], outline=c)
        d.ellipse([cx + 9, cy - 3, cx + 14, cy + 2], fill=c)
        L(cx - 13, cy - 8, cx - 13, cy - 4)
        L(cx + 11, cy + 4, cx + 11, cy + 9)
    elif name == "history":
        d.ellipse([cx - 11, cy - 11, cx + 11, cy + 11], outline=c)
        L(cx, cy, cx, cy - 6)
        L(cx, cy, cx + 5, cy)
    elif name == "blog":
        L(cx - 11, cy - 8, cx + 11, cy - 8)
        L(cx - 11, cy - 2, cx + 11, cy - 2)
        L(cx - 11, cy + 4, cx + 3, cy + 4)
        L(cx - 11, cy + 10, cx + 6, cy + 10)
    elif name == "all":
        L(cx - 10, cy, cx + 8, cy)
        d.polygon([(cx + 2, cy - 7), (cx + 10, cy), (cx + 2, cy + 7)], fill=c)
    elif name == "workflow":
        d.arc([cx - 11, cy - 11, cx + 11, cy + 11], 30, 300, fill=c)
        d.polygon([(cx + 6, cy - 13), (cx + 13, cy - 5), (cx + 4, cy - 2)], fill=c)
    elif name == "index":
        for oy in (-8, 0, 8):
            d.rectangle([cx - 11, cy + oy - 1, cx - 9, cy + oy + 1], fill=c)
            L(cx - 6, cy + oy, cx + 11, cy + oy)
    elif name == "owners":
        d.ellipse([cx - 11, cy - 5, cx - 1, cy + 5], outline=c)
        L(cx - 1, cy, cx + 11, cy)
        L(cx + 6, cy, cx + 6, cy + 5)
        L(cx + 10, cy, cx + 10, cy + 4)
    elif name == "ci":
        d.ellipse([cx - 11, cy - 11, cx + 11, cy + 11], outline=c)
        L(cx - 5, cy, cx - 1, cy + 4)
        L(cx - 1, cy + 4, cx + 6, cy - 4)
    elif name == "naos":
        for off in (-6, 0, 6):
            pts = [(cx - 12 + x, cy + off + 2 * math.sin(x * 0.7)) for x in range(25)]
            d.line(pts, fill=c, width=1)
    elif name == "games":
        d.rounded_rectangle([cx - 12, cy - 6, cx + 12, cy + 6], radius=3, outline=c)
        L(cx - 7, cy, cx - 3, cy)
        L(cx - 5, cy - 2, cx - 5, cy + 2)
        d.ellipse([cx + 4, cy - 2, cx + 6, cy], fill=c)
        d.ellipse([cx + 7, cy, cx + 9, cy + 2], fill=c)
    elif name == "rules":
        L(cx, cy - 11, cx, cy + 11)
        L(cx - 11, cy - 7, cx + 11, cy - 7)
        L(cx - 11, cy - 7, cx - 11, cy + 1)
        L(cx + 11, cy - 7, cx + 11, cy + 1)
        d.arc([cx - 15, cy - 1, cx - 7, cy + 7], 0, 180, fill=c)
        d.arc([cx + 7, cy - 1, cx + 15, cy + 7], 0, 180, fill=c)
    elif name == "site":
        d.ellipse([cx - 11, cy - 11, cx + 11, cy + 11], outline=c)
        d.ellipse([cx - 5, cy - 11, cx + 5, cy + 11], outline=c)
        L(cx - 11, cy, cx + 11, cy)


def _frame(name_art=None):
    """Dark plate with a faint dither wash and cyan corner brackets (logical grid)."""
    yy, xx = grid(TILE_H, TILE_W)
    wash = 0.02 + 0.07 * fbm(TILE_H, TILE_W, 31, 24, 2) + 0.05 * (xx / TILE_W)
    rgb = dither(np.clip(wash, 0, 1), ["#141414", "#181818", "#202020", "#2a2a2a"])
    im = to_image(rgb)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, TILE_W - 1, TILE_H - 1], outline=hx("#2a2a2a"))
    c = hx(CYAN)
    for x, y, dx, dy in [(0, 0, 1, 1), (TILE_W - 1, 0, -1, 1),
                         (0, TILE_H - 1, 1, -1), (TILE_W - 1, TILE_H - 1, -1, -1)]:
        d.line([x, y, x + dx * 12, y], fill=c)
        d.line([x, y, x, y + dy * 12], fill=c)
    return im, d


def _tile_text(im, title, tag, text_x, cy=60, title_size=44, tag_size=30):
    """Title and tag block centred on the row at logical cy, drawn at 2x.

    Either part can span lines with a newline. The tag is sized for phone
    widths, where the tile is about 170 css px wide."""
    im = upscale(im)
    d = ImageDraw.Draw(im)
    tf = font(title_size)
    gf = font(tag_size, mono=True)
    title_lines = title.split("\n")
    tag_lines = tag.split("\n") if tag else []
    lh = int(title_size * 1.0)
    tag_lh = int(tag_size * 1.2)
    gap = 14 if tag_lines else 0
    block_h = lh * len(title_lines) + gap + tag_lh * len(tag_lines)
    top = cy * SCALE - block_h // 2
    for i, line in enumerate(title_lines):
        d.text((text_x, top + i * lh), line, font=tf, fill=hx(PAPER))
    ty = top + lh * len(title_lines) + gap
    for i, line in enumerate(tag_lines):
        d.text((text_x, ty + i * tag_lh), line, font=gf, fill=hx("#9aa7af"))
    return im


def tile_page(icon, title, tag):
    im, d = _frame()
    _icon(d, icon, 34, 60, CYAN)
    return _tile_text(im, title, tag, text_x=112)


def tile_doc(icon, title, tag):
    im, d = _frame()
    _icon(d, icon, 34, 60, CYAN)
    return _tile_text(im, title, tag, text_x=112)


def tile_outline_guesser():
    im, d = _frame()
    # Dotted grid behind the art.
    for gy in range(10, TILE_H, 10):
        for gx in range(120, TILE_W, 10):
            d.point((gx, gy), fill=hx("#2a2a2a"))
    # An original landmass: a jagged closed outline with a dithered inside.
    cx, cy = 198, 62
    pts = []
    for k in range(48):
        t = 2 * math.pi * k / 48
        r = 27 + 5 * math.sin(3 * t + 1) + 2.5 * math.sin(7 * t) + 1.5 * math.cos(11 * t)
        pts.append((cx + r * math.cos(t) * 0.92, cy + r * math.sin(t) * 0.78))
    mask = Image.new("L", (TILE_W, TILE_H), 0)
    ImageDraw.Draw(mask).polygon(pts, fill=255)
    m = np.array(mask) > 0
    yy, xx = grid(TILE_H, TILE_W)
    field = np.clip(0.35 + 0.5 * (1 - np.hypot(xx - cx, (yy - cy) * 1.2) / 44), 0, 1)
    fill = dither(field, ["#0e2a2e", "#1d4a4f", "#2fd8e8", "#dffaff"])
    arr = np.array(im)
    arr[m] = fill[m]
    im = Image.fromarray(arr)
    d = ImageDraw.Draw(im)
    d.line(pts + [pts[0]], fill=hx(PAPER), width=1)
    # Guess marker.
    mx, my = 190, 58
    d.rectangle([mx - 2, my - 2, mx + 2, my + 2], fill=hx(PAPER))
    d.rectangle([mx - 1, my - 1, mx + 1, my + 1], fill=hx(CYAN))
    return _tile_text(im, "outline\nguesser", "daily +\nunlimited", text_x=36)


def tile_flag_guesser():
    im, d = _frame()
    palette = [CYAN, PAPER, "#1a1a1a", "#0a6f7c"]
    cells = [
        ("h", 0, 1), ("v", 1, 2), ("q", 2, 3),
        ("d", 0, 1), ("c", 1, 2), ("h", 3, 0),
    ]
    x0, y0, cw, ch, gap = 148, 24, 27, 34, 4
    for i, (kind, a, b) in enumerate(cells):
        col, row = i % 3, i // 3
        x = x0 + col * (cw + gap)
        y = y0 + row * (ch + gap)
        flip = i == 4  # one cell is mid-flip, drawn narrower
        w = 7 if flip else cw
        ox = x + (cw - w) // 2
        c1, c2, c3 = palette[a], palette[b], palette[(a + b) % 4]
        if kind == "h":
            d.rectangle([ox, y, ox + w, y + ch // 2], fill=hx(c1))
            d.rectangle([ox, y + ch // 2, ox + w, y + ch], fill=hx(c2))
        elif kind == "v":
            d.rectangle([ox, y, ox + w // 3, y + ch], fill=hx(c1))
            d.rectangle([ox + w // 3, y, ox + 2 * w // 3, y + ch], fill=hx(c2))
            d.rectangle([ox + 2 * w // 3, y, ox + w, y + ch], fill=hx(c3))
        elif kind == "q":
            d.rectangle([ox, y, ox + w, y + ch], fill=hx(c1))
            d.rectangle([ox + w // 2, y + ch // 2, ox + w, y + ch], fill=hx(c2))
        elif kind == "d":
            d.rectangle([ox, y, ox + w, y + ch], fill=hx(c1))
            d.polygon([(ox, y + ch), (ox + w, y), (ox + w, y + ch)], fill=hx(c2))
        else:
            d.rectangle([ox, y, ox + w, y + ch], fill=hx(c1))
            d.ellipse([ox + w // 4, y + ch // 4, ox + 3 * w // 4, y + 3 * ch // 4], fill=hx(c2))
        d.rectangle([ox, y, ox + w, y + ch], outline=hx("#0e0e0e"))
    return _tile_text(im, "flag\nguesser", "daily +\nunlimited", text_x=36)


PAGE_TILES = {
    "tile-page-home": ("home", "home", "/"),
    "tile-page-about": ("about", "about", "/about"),
    "tile-page-creations": ("creations", "creations", "/creations"),
    "tile-page-studies": ("studies", "studies", "/studies"),
    "tile-page-timeline": ("timeline", "timeline", "/timeline"),
    "tile-page-history": ("history", "history", "/history"),
    "tile-page-blog": ("blog", "blog", "/blog"),
    "tile-page-all": ("all", "all pages", "nateanderson.dev"),
}
DOC_TILES = {
    "tile-doc-workflow": ("workflow", "workflow", "docs/WORKFLOW.md"),
    "tile-doc-index": ("index", "index", "docs/README.md"),
    "tile-doc-owners": ("owners", "owners", "docs/OWNERS.md"),
    "tile-doc-ci": ("ci", "ci", "docs/ci.md"),
    "tile-doc-naos": ("naos", "naos", "docs/naos.md"),
    "tile-doc-games": ("games", "games", "docs/games/"),
    "tile-doc-rules": ("rules", "rule changes", "docs/rule-changes/"),
    "tile-doc-site": ("site", "site", "docs/site/"),
}

# ---------------------------------------------------------------- section art
def _shade(h, f):
    return "#" + "".join(f"{int(c * f):02x}" for c in hx(h))


def _dither_face(im, poly, ramp, tex):
    """Dither a texture onto one polygon only (keeps painter order for stacked faces)."""
    arr = np.array(im)
    m = Image.new("L", (im.width, im.height), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    mask = np.array(m) > 0
    arr[mask] = dither(0.6 + 0.4 * tex, ramp)[mask]
    return Image.fromarray(arr)


def stack_art():
    """Layered slabs, one per part of the stack, bottom (base) to top (deploy)."""
    W, H = 600, 160
    yy, xx = grid(H, W)
    field = 0.04 + 0.1 * fbm(H, W, 91, 30, 3) + 0.08 * (xx / W)
    im = to_image(dither(np.clip(field, 0, 1), ["#141414", "#181818", "#202020", "#2a2a2a", "#333333"]))
    d = ImageDraw.Draw(im)
    for gy in range(8, H, 12):
        for gx in range(8, W, 12):
            d.point((gx, gy), fill=hx("#262626"))
    tex = fbm(H, W, 92, cell=6, octaves=2)
    layers = [  # label, top, left face, right face
        ("camino base", "#3a3a3a", "#2a2a2a", "#1f1f1f"),
        ("next.js 16", "#4c4c4c", "#353535", "#262626"),
        ("react 19 + tailwind v4", "#6a6a6a", "#4a4a4a", "#333333"),
        ("three.js + supabase", "#8a8a88", "#666664", "#4a4a48"),
        ("vercel + github actions", CYAN, "#0a6f7c", "#064a52"),
    ]
    cx, w, h, t, step, base = 180, 100, 26, 10, 20, 124
    labels = []
    for k, (label, top_c, left_c, right_c) in enumerate(layers):
        top_y = base - k * step
        T = (cx, top_y)
        UR = (cx + w, top_y + h / 2)
        B = (cx, top_y + h)
        UL = (cx - w, top_y + h / 2)
        d.polygon([UL, B, (B[0], B[1] + t), (UL[0], UL[1] + t)], fill=hx(left_c))
        d.polygon([B, UR, (UR[0], UR[1] + t), (B[0], B[1] + t)], fill=hx(right_c))
        top = [T, UR, B, UL]
        d.polygon(top, fill=hx(top_c))
        im = _dither_face(im, top, [_shade(top_c, 0.55), top_c], tex)
        d = ImageDraw.Draw(im)
        labels.append((label, UR[0], UR[1]))
    im = upscale(im)
    d = ImageDraw.Draw(im)
    f = font(26, mono=True)
    for label, x, y in labels:
        d.line([x * 2 + 4, y * 2, x * 2 + 16, y * 2], fill=hx("#6a6a6a"), width=2)
        d.text((x * 2 + 22, y * 2), label, font=f, fill=hx(PAPER), anchor="lm")
    return im


def workflow_art():
    """pull request -> integration (solid), integration -> release (gated, dashed)."""
    W, H = 600, 140
    yy, xx = grid(H, W)
    field = 0.03 + 0.09 * fbm(H, W, 57, 28, 3) + 0.05 * (yy / H)
    im = to_image(dither(np.clip(field, 0, 1), ["#141414", "#181818", "#202020", "#2a2a2a"]))
    d = ImageDraw.Draw(im)
    for gy in range(8, H, 12):
        for gx in range(8, W, 12):
            d.point((gx, gy), fill=hx("#262626"))
    top, bot, mid = 36, 116, 76
    boxes = [
        ("pull request", "small and reviewed", 24, 176),
        ("integration", "merging deploys nothing", 222, 378),
        ("release", "vercel builds only this", 424, 576),
    ]
    c = hx(CYAN)
    for _, _, x0, x1 in boxes:
        d.rectangle([x0, top, x1, bot], fill=hx("#141414"), outline=hx("#2a2a2a"))
        for x, y, dx, dy in [(x0, top, 1, 1), (x1, top, -1, 1), (x0, bot, 1, -1), (x1, bot, -1, -1)]:
            d.line([x, y, x + dx * 10, y], fill=c)
            d.line([x, y, x, y + dy * 10], fill=c)
    # Solid arrow: pull request into integration.
    d.line([176, mid, 212, mid], fill=c, width=1)
    d.polygon([(222, mid), (212, mid - 4), (212, mid + 4)], fill=c)
    # Gated, dashed arrow: integration to release.
    for x in range(380, 414, 7):
        d.line([x, mid, x + 4, mid], fill=c)
    d.line([401, 60, 401, 92], fill=c, width=2)
    d.polygon([(424, mid), (414, mid - 4), (414, mid + 4)], fill=c)
    im = upscale(im)
    d = ImageDraw.Draw(im)
    tf, sf = font(34), font(18, mono=True)
    for title, sub, x0, _ in boxes:
        d.text((2 * (x0 + 16), 2 * (top + 12)), title, font=tf, fill=hx(PAPER))
        d.text((2 * (x0 + 16), 2 * (top + 56)), sub, font=sf, fill=hx("#9aa7af"))
    d.text((2 * 401, 2 * 24), "deploy only when asked", font=sf, fill=c, anchor="mm")
    d.text((2 * 300, 2 * 130), "release moves forward only on a deploy", font=sf,
           fill=hx("#6a6a6a"), anchor="mm")
    return im


# ---------------------------------------------------------------- registry
PIECES = {
    "hero-dark": lambda: hero(light=False),
    "hero-light": lambda: hero(light=True),
    "divider-01": lambda: divider(1, "what it is"),
    "divider-02": lambda: divider(2, "games"),
    "divider-03": lambda: divider(3, "stack"),
    "divider-04": lambda: divider(4, "workflow"),
    "divider-01-light": lambda: divider(1, "what it is", light=True),
    "divider-02-light": lambda: divider(2, "games", light=True),
    "divider-03-light": lambda: divider(3, "stack", light=True),
    "divider-04-light": lambda: divider(4, "workflow", light=True),
    "card-brasswork": card_brasswork,
    "card-starwright": card_starwright,
    "card-groundbreak": card_groundbreak,
    "card-node-farm": card_node_farm,
    "tile-outline-guesser": tile_outline_guesser,
    "tile-flag-guesser": tile_flag_guesser,
    **{k: (lambda v=v: tile_page(*v)) for k, v in PAGE_TILES.items()},
    **{k: (lambda v=v: tile_doc(*v)) for k, v in DOC_TILES.items()},
    "stack-art": stack_art,
    "workflow-art": workflow_art,
    "footer": lambda: footer(light=False),
    "footer-light": lambda: footer(light=True),
}


def main(names):
    os.makedirs(OUT, exist_ok=True)
    todo = names or list(PIECES)
    for name in todo:
        if name not in PIECES:
            sys.exit(f"unknown piece: {name}")
        im = PIECES[name]()
        path = os.path.join(OUT, f"{name}.png")
        im.save(path, optimize=True)
        print(f"wrote {os.path.relpath(path, ROOT)} {im.width}x{im.height}")


if __name__ == "__main__":
    main(sys.argv[1:])
