"""Shared helpers for Starwright's dither art: palette, Bayer dither, value noise, sheet writing.

Everything is drawn as a float value field (0..1) per object and pushed through a short colour ramp with a 4x4 Bayer
threshold, so every sprite, backdrop and icon shares one look. Alpha is dithered too (0 or 255 only).
"""
import json, os
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUT = os.path.join(ROOT, "public", "starwright")

B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float32)
B4 = (B4 + 0.5) / 16.0


def hexc(h):
    return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16))


def ramp(*hs):
    return np.array([hexc(h) for h in hs], dtype=np.uint8)


# ---- the Starwright palette: one ink set, every ramp is drawn from it -------------------------------------------------
P = {
    # space
    "void": "#05030c", "ink": "#0b0718", "deep": "#140c2c", "dusk": "#24144a", "plum": "#3b1f6b", "orchid": "#6a3a9c",
    "mauve": "#a066c4", "lilac": "#d6a8ec",
    # hot
    "ember0": "#1c0810", "ember1": "#4a1420", "rust": "#8c2a1c", "flame": "#d4531e", "amber": "#f29a2e",
    "gold": "#ffd36a", "cream": "#fff4c8", "white": "#ffffff",
    # cool
    "navy": "#0a1438", "cobalt": "#1d3f8f", "azure": "#3a7fe0", "sky": "#8cc8ff", "frost": "#e8f6ff",
    "indigo": "#2a1f8a", "violet": "#6a5cf0", "periwinkle": "#b4b6ff",
    # earth
    "soot": "#1a1614", "ash": "#4a4440", "stone": "#8a8478", "bone": "#cfc6b4",
    "teal0": "#0a2a30", "teal": "#1f6f78", "aqua": "#5fd0d8", "mint": "#bff4ec",
    "moss0": "#14200f", "moss": "#3f6a2a", "lime": "#9dd65a",
    "sand0": "#3a2410", "sand": "#a87a3a", "dune": "#e2b86a", "pale": "#f6e2b0",
    "rose0": "#2a0a1e", "rose": "#a02a6a", "pink": "#ff6fb8",
}


def R(*names):
    return ramp(*[P[n] for n in names])


def pick(rmp, v, ox=0, oy=0):
    """Map a value field to ramp colours with an ordered dither. v: HxW float 0..1."""
    h, w = v.shape
    th = np.tile(B4, (h // 4 + 2, w // 4 + 2))[oy % 4: oy % 4 + h, ox % 4: ox % 4 + w]
    idx = np.clip(np.floor(np.clip(v, 0, 1) * (len(rmp) - 1) + th), 0, len(rmp) - 1).astype(np.int32)
    return rmp[idx]


def dmask(a, ox=0, oy=0):
    """Dithered alpha: coverage 0..1 to a boolean mask."""
    h, w = a.shape
    th = np.tile(B4, (h // 4 + 2, w // 4 + 2))[oy % 4: oy % 4 + h, ox % 4: ox % 4 + w]
    return a > th


def thresh(h, w):
    return np.tile(B4, (h // 4 + 2, w // 4 + 2))[:h, :w]


# ---- noise ---------------------------------------------------------------------------------------------------------
def _hash3(x, y, z, seed=0):
    h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 1442695041) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    h = h ^ (h >> 16)
    return (h & 0xFFFFFF).astype(np.float32) / float(0xFFFFFF)


def vnoise3(x, y, z, seed=0):
    xi, yi, zi = np.floor(x).astype(np.int64), np.floor(y).astype(np.int64), np.floor(z).astype(np.int64)
    xf, yf, zf = x - xi, y - yi, z - zi
    u, v, w = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf), zf * zf * (3 - 2 * zf)
    xi, yi, zi = xi + 4096, yi + 4096, zi + 4096
    def c(a, b, d):
        return _hash3(xi + a, yi + b, zi + d, seed)
    x00 = c(0, 0, 0) + (c(1, 0, 0) - c(0, 0, 0)) * u
    x10 = c(0, 1, 0) + (c(1, 1, 0) - c(0, 1, 0)) * u
    x01 = c(0, 0, 1) + (c(1, 0, 1) - c(0, 0, 1)) * u
    x11 = c(0, 1, 1) + (c(1, 1, 1) - c(0, 1, 1)) * u
    y0 = x00 + (x10 - x00) * v
    y1 = x01 + (x11 - x01) * v
    return y0 + (y1 - y0) * w


def fbm3(x, y, z, oct=4, seed=0):
    s, a, tot = 0.0, 1.0, 0.0
    for i in range(oct):
        s = s + vnoise3(x, y, z, seed + i * 17) * a
        tot += a
        x, y, z, a = x * 2.03, y * 2.03, z * 2.03, a * 0.5
    return s / tot


def grid(w, h):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    return x, y


# ---- output --------------------------------------------------------------------------------------------------------
MANIFEST = {}


def rgba(rgb, mask):
    h, w = mask.shape
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = rgb
    out[..., 3] = np.where(mask, 255, 0)
    out[~mask, :3] = 0
    return out


def save_sheet(key, frames, fps=8, loop=True, **meta):
    """frames: list of HxWx4 uint8. Writes a horizontal strip and records it in the manifest."""
    h, w = frames[0].shape[:2]
    sheet = np.concatenate(frames, axis=1)
    path = os.path.join(OUT, key + ".png")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(sheet, "RGBA").save(path, optimize=True)
    # The site loads the lossless WebP (same pixels, about 43% of the bytes); the PNG stays as the source.
    Image.fromarray(sheet, "RGBA").save(path[:-4] + ".webp", "WEBP", lossless=True, method=6, quality=100)
    MANIFEST[key] = {"src": f"/starwright/{key}.webp", "w": w, "h": h, "frames": len(frames), "fps": fps, "loop": loop, **meta}
    return sheet


def save_still(key, img, **meta):
    return save_sheet(key, [img], fps=0, loop=False, **meta)


def write_manifest(version):
    path = os.path.join(OUT, "manifest.json")
    with open(path, "w") as f:
        json.dump({"v": version, "sheets": MANIFEST}, f, indent=1, sort_keys=True)
