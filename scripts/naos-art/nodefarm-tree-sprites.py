"""Node Farm prestige tree sprites: one shaded pixel icon per node, with locked and hidden versions and a 4-frame glint.

Run:  python3 scripts/naos-art/nodefarm-tree-sprites.py            (sheets + the sprite map)
      python3 scripts/naos-art/nodefarm-tree-sprites.py --sample   (a labelled preview sheet in /tmp)
Output (public/naos/nodefarm/):
  tree-spr-s.{png,webp}   minor nodes, 32 px cells
  tree-spr-m.{png,webp}   notable nodes, 40 px cells
  tree-spr-l.{png,webp}   keystones and the core, 64 px cells
  Each sheet has one row per sprite and 6 columns: glint frames 0..3 (frame 0 is the plain icon), locked, hidden.
  lib/nodefarm/tree-sprites.ts  the sprite map (key -> sheet, row), generated; do not edit by hand.

How a sprite is made: a motif (a small function) draws flat parts, each with a material (the section colour, an accent
colour, metal, glow or ink). The shader then gives every part a hue-shifted 4-tone ramp lit from the top left, a dark
outline and a 1 to 2 px drop shadow, so every icon reads as a small raised object. Motifs draw in a 0..1 box so one motif
works at all three sizes. Everything is procedural and original; nothing is traced or borrowed.
"""
import colorsys
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
OUT = os.path.join(ROOT, "public", "naos", "nodefarm")
BAYER = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) + 0.5) / 16.0
SIZES = {"s": 32, "m": 40, "l": 64}
SECS = {"signal": "#2fd8e8", "forge": "#ffc53a", "systems": "#6bffc9", "drones": "#ff4d6d", "anomaly": "#9a7bff", "core": "#e6f0ff"}
# the Exploit Lab research tree (nodefarm_lab_motifs.py): blues, so the research tree reads as one blueprint
SECS.update({"exploits": "#59b8ff", "malware": "#8f9bff", "infra": "#5ff0e8", "labcore": "#4aa3ff"})


def hx(h):
    return tuple(int(h[i : i + 2], 16) / 255 for i in (1, 3, 5))


def ramp(col):
    """4 tones lit from the top left: shadows drift toward blue-violet, highlights toward warm white (hue shifting)."""
    r, g, b = hx(col) if isinstance(col, str) else col
    h, s, v = colorsys.rgb_to_hsv(r, g, b)

    def shift(dh, ds, dv):
        # move hue toward 0.68 (blue-violet) for shadow, toward 0.14 (warm) for light
        return tuple(int(round(c * 255)) for c in colorsys.hsv_to_rgb((h + dh) % 1, min(1, max(0, s + ds)), min(1, max(0, v + dv))))

    def toward(target, amt):
        d = ((target - h + 0.5) % 1) - 0.5
        return d * amt

    return [
        shift(toward(0.7, 0.18), 0.12, -0.42),  # deep shadow
        shift(toward(0.7, 0.08), 0.05, -0.2),  # shadow
        shift(0, 0, 0),  # base
        shift(toward(0.14, 0.1), -0.32, 0.25),  # light
    ]


MAT = {
    "metal": "#8fa3c4",
    "dark": "#3a4766",
    "glow": "#f2fbff",
    "ink": "#141a2a",
}
OUTLINE = (8, 10, 18)


class Spr:
    """A motif draws parts into masks. Coordinates are 0..1 inside the cell."""

    def __init__(self, n, main, acc):
        self.n = n
        self.parts = []  # (mask array bool, material colour, flat?)
        self.main = main
        self.acc = acc

    def _P(self, x, y):
        return (x * (self.n - 1), y * (self.n - 1))

    def _w(self, w):
        return max(1, int(round(w * self.n)))

    def _part(self, mat, flat=False):
        im = Image.new("L", (self.n, self.n), 0)
        col = {"main": self.main, "acc": self.acc}.get(mat, MAT.get(mat, mat))
        self.parts.append((im, col, flat))
        return ImageDraw.Draw(im)

    # shapes ----------------------------------------------------------------------------------
    def poly(self, pts, mat="main", flat=False):
        self._part(mat, flat).polygon([self._P(*p) for p in pts], fill=255)

    def rect(self, x0, y0, x1, y1, mat="main", flat=False):
        self._part(mat, flat).rectangle([self._P(x0, y0), self._P(x1, y1)], fill=255)

    def ell(self, x0, y0, x1, y1, mat="main", flat=False):
        self._part(mat, flat).ellipse([self._P(x0, y0), self._P(x1, y1)], fill=255)

    def ring(self, x0, y0, x1, y1, w=0.08, mat="main", flat=False):
        self._part(mat, flat).ellipse([self._P(x0, y0), self._P(x1, y1)], outline=255, width=self._w(w))

    def arc(self, x0, y0, x1, y1, a0, a1, w=0.08, mat="main", flat=False):
        self._part(mat, flat).arc([self._P(x0, y0), self._P(x1, y1)], a0, a1, fill=255, width=self._w(w))

    def line(self, pts, w=0.08, mat="main", flat=False):
        self._part(mat, flat).line([self._P(*p) for p in pts], fill=255, width=self._w(w), joint="curve")

    def dot(self, x, y, r=0.05, mat="glow", flat=True):
        self.ell(x - r, y - r, x + r, y + r, mat, flat)

    def star(self, cx, cy, r0, r1, k=5, rot=-90, mat="main", flat=False):
        pts = []
        for i in range(k * 2):
            a = math.radians(rot + i * 180 / k)
            r = r1 if i % 2 == 0 else r0
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        self.poly(pts, mat, flat)

    def ngon(self, cx, cy, r, k=6, rot=0, mat="main", flat=False):
        self.poly([(cx + r * math.cos(math.radians(rot + i * 360 / k)), cy + r * math.sin(math.radians(rot + i * 360 / k))) for i in range(k)], mat, flat)

    # render ----------------------------------------------------------------------------------
    def render(self):
        """-> RGBA array n x n x 4 (plain icon), and the union mask."""
        n = self.n
        rgb = np.zeros((n, n, 3), np.uint8)
        part = np.full((n, n), -1, int)
        for i, (im, col, flat) in enumerate(self.parts):
            m = np.asarray(im) > 0
            part[m] = i
        filled = part >= 0
        yy, xx = np.indices((n, n))
        bay = np.tile(BAYER, (n // 4 + 1, n // 4 + 1))[:n, :n]
        # a global light gradient across the icon (top-left bright, bottom-right dark), applied per part
        for i, (im, col, flat) in enumerate(self.parts):
            m = part == i
            if not m.any():
                continue
            R = ramp(col)
            if flat:
                rgb[m] = R[3] if col == MAT["glow"] else R[2]
                continue
            up = np.roll(part, 1, 0) != i
            left = np.roll(part, 1, 1) != i
            down = np.roll(part, -1, 0) != i
            right = np.roll(part, -1, 1) != i
            ys, xs = np.nonzero(m)
            cy, cx = ys.mean(), xs.mean()
            span = max(ys.max() - ys.min(), xs.max() - xs.min(), 1)
            # position inside the part, -1 top-left .. +1 bottom-right
            g = ((xx - cx) + (yy - cy)) / span
            tone = np.full((n, n), 2)
            tone[(g > 0.18) & (g * 1.4 > bay + 0.1)] = 1
            tone[(g < -0.3) & (-g * 1.2 > bay + 0.25)] = 3
            tone[up | left] = 3
            tone[down | right] = 1
            tone[(down & right)] = 0
            # thin parts (lines) look better with simpler shading
            thin = ~(np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1)) & m
            if thin.sum() > 0.8 * m.sum():
                tone[m] = np.where((xx + yy)[m] < cx + cy, 3, 2)
            for t in range(4):
                rgb[m & (tone == t)] = R[t]
        out = np.zeros((n, n, 4), np.uint8)
        # drop shadow (down-right), then outline, then the icon
        sh = np.zeros((n, n), bool)
        for d in (1, 2):
            s = np.zeros_like(filled)
            s[d:, d:] = filled[:-d, :-d]
            sh |= s
        ol = np.zeros_like(filled)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ol |= np.roll(np.roll(filled, dy, 0), dx, 1)
        out[sh] = (0, 0, 0, 120)
        out[ol] = (*OUTLINE, 255)
        out[filled, :3] = rgb[filled]
        out[filled, 3] = 255
        # keep the 1 px border of the cell clear
        out[0, :] = out[-1, :] = 0
        out[:, 0] = out[:, -1] = 0
        return out, filled


def glint(img, filled, f):
    """Frame f of 4: a bright diagonal band sweeps across the icon (frame 0 = no band)."""
    if f == 0:
        return img.copy()
    n = img.shape[0]
    yy, xx = np.indices((n, n))
    pos = (f - 0.5) / 3 * 2.2 * n - 0.6 * n
    band = np.abs((xx + yy) - pos - n * 0.5) < max(1.5, n / 14)
    out = img.copy()
    m = band & filled
    out[m, :3] = np.minimum(255, out[m, :3].astype(int) * 0.45 + 255 * 0.55).astype(np.uint8)
    return out


def locked(img, filled):
    """Locked: the same shape in two cold greys, so it still reads but clearly is not yours."""
    out = img.copy()
    lum = img[..., :3].astype(float) @ np.array([0.3, 0.55, 0.15])
    n = img.shape[0]
    bay = np.tile(BAYER, (n // 4 + 1, n // 4 + 1))[:n, :n]
    hi = (lum / 255) * 1.1 > bay + 0.25
    out[filled & hi, :3] = (92, 104, 128)
    out[filled & ~hi, :3] = (46, 54, 72)
    return out


def hidden(img, filled):
    """Hidden: a dark silhouette with a dotted rim, nothing inside."""
    n = img.shape[0]
    out = np.zeros_like(img)
    ol = np.zeros_like(filled)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ol |= np.roll(np.roll(filled, dy, 0), dx, 1)
    rim = ol & ~filled
    yy, xx = np.indices((n, n))
    out[filled] = (18, 22, 34, 255)
    out[rim & ((xx + yy) % 2 == 0)] = (70, 84, 110, 255)
    out[0, :] = out[-1, :] = 0
    out[:, 0] = out[:, -1] = 0
    return out


sys.path.insert(0, HERE)
from nodefarm_tree_motifs import MOTIFS, NODES  # noqa: E402  (motif library and the node -> motif table)
from nodefarm_lab_motifs import LAB_NODES  # noqa: E402  (research tree sprites; their motifs register into MOTIFS)

NODES = {**NODES, **LAB_NODES}


def build_sheet(size_key, rows):
    n = SIZES[size_key]
    sheet = np.zeros((n * max(1, len(rows)), n * 6, 4), np.uint8)
    for r, (key, motif, sec, acc) in enumerate(rows):
        s = Spr(n, SECS[sec], acc)
        MOTIFS[motif](s)
        img, filled = s.render()
        for f in range(4):
            sheet[r * n : (r + 1) * n, f * n : (f + 1) * n] = glint(img, filled, f)
        sheet[r * n : (r + 1) * n, 4 * n : 5 * n] = locked(img, filled)
        sheet[r * n : (r + 1) * n, 5 * n : 6 * n] = hidden(img, filled)
    return sheet


def save(arr, stem):
    im = Image.fromarray(arr, "RGBA")
    im.save(os.path.join(OUT, stem + ".png"), optimize=True)
    im.save(os.path.join(OUT, stem + ".webp"), lossless=True, quality=100, method=6)
    print("wrote", stem, im.size)


def main(args):
    by = {"s": [], "m": [], "l": []}
    for key, (motif, sec, size, acc) in NODES.items():
        if motif not in MOTIFS:
            raise SystemExit(f"{key}: no motif named {motif}")
        by[size].append((key, motif, sec, acc))
    seen = {}
    for key, (motif, *_rest) in NODES.items():
        if motif in seen:
            raise SystemExit(f"{key} and {seen[motif]} share motif {motif}; every node needs its own")
        seen[motif] = key
    if "--sample" in args:
        return
    lines = []
    for k in ("s", "m", "l"):
        save(build_sheet(k, by[k]), f"tree-spr-{k}")
        for r, (key, *_r) in enumerate(by[k]):
            lines.append(f'    "{key}": ["{k}", {r}],')
    ts = os.path.join(ROOT, "lib", "nodefarm", "tree-sprites.ts")
    with open(ts, "w") as f:
        f.write("// Generated by scripts/naos-art/nodefarm-tree-sprites.py. Do not edit by hand; edit the motif table and re-run.\n")
        f.write("/** sprite key -> [sheet size key, row]. Sheets: public/naos/nodefarm/tree-spr-{s,m,l}.webp, 6 columns per row. */\n")
        f.write("export const SPRITE_CELLS: Record<string, [\"s\" | \"m\" | \"l\", number]> = {\n")
        f.write("\n".join(lines) + "\n};\n")
        f.write(f"export const SPRITE_PX = {{ s: {SIZES['s']}, m: {SIZES['m']}, l: {SIZES['l']} }} as const;\n")
        f.write("export const SPRITE_ROWS = { " + ", ".join(f"{k}: {len(by[k])}" for k in ("s", "m", "l")) + " } as const;\n")
    print("wrote lib/nodefarm/tree-sprites.ts with", len(lines), "sprites")


if __name__ == "__main__":
    sys.path.insert(0, HERE)
    main(sys.argv[1:])
