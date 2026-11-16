#!/usr/bin/env python3
"""Sprite sheets for the animated band behind the homepage Play section.

Original art, drawn procedurally: every sprite is a height map lit from the upper left, then mapped onto a short
colour ramp from its game's palette with an 8x8 Bayer dither. Nothing is traced or sampled from anywhere.

    python3 scripts/home-band/generate.py

Writes public/home/band/<game>.webp (lossless) and components/home/band-atlas.ts (frame rectangles).
Needs Pillow and numpy.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "home" / "band"
ATLAS = ROOT / "components" / "home" / "band-atlas.ts"

B8 = np.array(
    [
        [0, 32, 8, 40, 2, 34, 10, 42],
        [48, 16, 56, 24, 50, 18, 58, 26],
        [12, 44, 4, 36, 14, 46, 6, 38],
        [60, 28, 52, 20, 62, 30, 54, 22],
        [3, 35, 11, 43, 1, 33, 9, 41],
        [51, 19, 59, 27, 49, 17, 57, 25],
        [15, 47, 7, 39, 13, 45, 5, 37],
        [63, 31, 55, 23, 61, 29, 53, 21],
    ],
    dtype=np.float32,
) / 64.0


def hexes(*hs: str) -> np.ndarray:
    return np.array([[int(h[i : i + 2], 16) for i in (1, 3, 5)] for h in hs], dtype=np.uint8)


# ---- palettes ---------------------------------------------------------------------------------------------------------
BRASS = hexes("#120d07", "#2a1d0e", "#4a3214", "#7a5220", "#a8722a", "#d9a441", "#f3cf82", "#fff4d6")
COPPER = hexes("#1a0c07", "#3d1a0e", "#6e2f18", "#a24a26", "#cf6e3a", "#f0a070", "#ffd2a8")
IRON = hexes("#120f0b", "#241e17", "#3c3428", "#5c5242", "#857a64", "#b4a88c")
STEAM = hexes("#2e271f", "#4a4034", "#6e6252", "#968872", "#bcae94")
GRASS = hexes("#1c2410", "#33421a", "#526a24", "#7a9230", "#a8bc4c", "#d0dc80")
DIRT = hexes("#1e1009", "#3a2212", "#5a361c", "#7c5028", "#a06c38")
STONE = hexes("#17130f", "#2c261f", "#463d32", "#665a4a", "#8a7c66")
WOOD = hexes("#24140a", "#432612", "#66401e", "#8c5c2c", "#b47e42")
CLOTH = hexes("#3a2a1a", "#6e5638", "#a88c62", "#d8c49a", "#f6ead0")

STAR = hexes("#3d1208", "#7a2a10", "#c4481c", "#ff8a5c", "#ffc2a1", "#fff3e0", "#ffffff")
ROCK = hexes("#140f24", "#2c1f3a", "#4e3048", "#7a4a50", "#a86c5c", "#d49a7a")
ICE = hexes("#140f24", "#2a2350", "#4a4486", "#7a74c0", "#b4aee8", "#e6e2ff")
GAS = hexes("#1a0e1c", "#3d1a2c", "#7a2f3a", "#c4583a", "#f09a54", "#ffd2a0")
VIOLET = hexes("#22183d", "#4a3a8a", "#8f75e6", "#c4b4ff", "#f0eaff")

CRANE = hexes("#1a1008", "#4a2e10", "#8a5a16", "#d2921e", "#f6c040", "#fff0a0")
DUSK = hexes("#1e1626", "#3a2440", "#6a3456", "#a8486a", "#e07060", "#f6a86a", "#ffe0b0")
SIL = hexes("#120e18", "#1e1626", "#2c2034")
BIRD = hexes("#120e18", "#2c2034")
STEEL = hexes("#2a1410", "#5a2a1a", "#9a4628", "#d06a3a", "#f6a060")


# ---- core helpers -----------------------------------------------------------------------------------------------------
def bayer(w: int, h: int, ox: int = 0, oy: int = 0) -> np.ndarray:
    ys = (np.arange(h)[:, None] + oy) % 8
    xs = (np.arange(w)[None, :] + ox) % 8
    return B8[ys, xs]


def to_ramp(v: np.ndarray, ramp: np.ndarray) -> np.ndarray:
    """v in [0,1] -> RGB from ramp, ordered-dithered between neighbouring steps."""
    h, w = v.shape
    n = len(ramp)
    t = np.clip(v, 0, 1) * (n - 1)
    lo = np.floor(t)
    idx = (lo + ((t - lo) > bayer(w, h)).astype(np.float32)).astype(int)
    return ramp[np.clip(idx, 0, n - 1)]


def lit(height: np.ndarray, strength: float = 2.2, light=(-0.62, -0.7, 0.55)) -> np.ndarray:
    """Lambert + a little specular from a height map. Returns light in [0, 1.4]."""
    gy, gx = np.gradient(height.astype(np.float32))
    nx, ny, nz = -gx * strength, -gy * strength, np.ones_like(gx)
    ln = math.sqrt(sum(c * c for c in light))
    lx, ly, lz = (c / ln for c in light)
    norm = np.sqrt(nx * nx + ny * ny + nz * nz)
    d = (nx * lx + ny * ly + nz * lz) / norm
    spec = np.clip(d, 0, 1) ** 18
    return np.clip(d, 0, 1) * 0.85 + 0.18 + spec * 0.5


def blur(a: np.ndarray, k: int = 1) -> np.ndarray:
    out = a.astype(np.float32)
    for _ in range(k):
        p = np.pad(out, 1, mode="edge")
        out = (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:] + p[1:-1, 1:-1] * 2) / 6
    return out


def outline(rgba: np.ndarray, color) -> np.ndarray:
    """Dark 1px outline around opaque pixels (outside only)."""
    a = rgba[..., 3] > 0
    p = np.pad(a, 1)
    ring = (p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]) & ~a
    out = rgba.copy()
    out[ring] = (*color, 255)
    return out


def rgba_from(rgb: np.ndarray, mask: np.ndarray) -> np.ndarray:
    h, w = mask.shape
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = rgb
    out[..., 3] = np.where(mask, 255, 0)
    return out


def over(dst: np.ndarray, src: np.ndarray, x: int = 0, y: int = 0) -> None:
    h, w = src.shape[:2]
    region = dst[y : y + h, x : x + w]
    m = src[..., 3] > 0
    region[m] = src[m]


def grid(w: int, h: int, cx: float, cy: float):
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    return xs - cx + 0.5, ys - cy + 0.5


def hash2(x, y, seed=0):
    v = np.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
    return v - np.floor(v)


def vnoise(x, y, seed=0):
    xi, yi = np.floor(x), np.floor(y)
    xf, yf = x - xi, y - yi
    u, v = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf)
    a, b = hash2(xi, yi, seed), hash2(xi + 1, yi, seed)
    c, d = hash2(xi, yi + 1, seed), hash2(xi + 1, yi + 1, seed)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v


def fbm(x, y, seed=0, octaves=4):
    s, amp, f = 0.0, 0.5, 1.0
    for i in range(octaves):
        s = s + vnoise(x * f, y * f, seed + i * 13) * amp
        amp *= 0.5
        f *= 2.03
    return s


# ---- Brasswork ---------------------------------------------------------------------------------------------------------
def gear(size: int, teeth: int, rot: float, ramp=BRASS, rivets: int | None = None, hub_ramp=None) -> np.ndarray:
    R = size / 2 - 1.5
    tooth_h = max(3.0, R * 0.16)
    root = R - tooth_h
    rim_in = root - max(3.0, R * 0.16)
    hub = R * 0.3
    x, y = grid(size, size, size / 2, size / 2)
    r = np.hypot(x, y)
    th = np.arctan2(y, x) + rot
    ph = (th * teeth / (2 * math.pi)) % 1.0
    # trapezoid tooth: flat top 36%, flanks 14% each
    prof = np.clip(np.minimum((ph - 0.08) / 0.14, (0.72 - ph) / 0.14), 0, 1)
    outer = root + tooth_h * prof
    solid = r <= outer
    h = np.zeros_like(r)
    h[solid] = 1.0
    web = (r < rim_in) & (r > hub + 2)
    h[web] = 0.55
    # web cut-outs between spokes (same count as teeth so the frames loop on one tooth pitch)
    n_holes = rivets or teeth
    hp = (th * n_holes / (2 * math.pi)) % 1.0
    mid_r = (rim_in + hub) / 2
    hole = web & (np.abs(hp - 0.5) < 0.30) & (np.abs(r - mid_r) < (rim_in - hub) * 0.32)
    if size >= 60:
        h[hole] = 0.12
    # hub, collar, axle
    h[r <= hub + 2] = 1.15
    h[r <= hub] = 1.3
    axle = r <= max(2.5, hub * 0.38)
    h[axle] = 0.15
    # rivets on the rim
    if size >= 40:
        rv = (np.abs(((th * n_holes / (2 * math.pi)) % 1.0) - 0.5) * (2 * math.pi * (rim_in + root) / 2 / n_holes))
        dot = np.hypot(rv, r - (rim_in + root) / 2) < 1.6
        h[dot & solid] = 1.25
    light = lit(blur(h, 1), 2.6)
    # ambient occlusion inside the web and holes
    shade = light * (0.55 + 0.45 * np.clip(h, 0, 1.2) / 1.2)
    shade[hole & (size >= 60)] *= 0.4
    shade[axle] = 0.05
    rgb = to_ramp(shade / 1.25, ramp)
    out = rgba_from(rgb, solid)
    return outline(out, ramp[0])


def windmill_island() -> np.ndarray:
    W, H = 104, 96
    img = np.zeros((H, W, 4), np.uint8)
    rng = np.random.default_rng(7)
    top = 58
    # block columns, 4px voxels
    for bx in range(4, W - 4, 4):
        c = (bx - W / 2) / (W / 2 - 4)
        depth = int((1 - c * c) ** 0.7 * 30 + rng.integers(0, 3) * 4)
        depth = max(4, depth - depth % 4)
        for vy in range(top, top + depth + 8, 4):
            k = (vy - top) // 4
            if k == 0:
                ramp, base = GRASS, 0.75
            elif k == 1:
                ramp, base = DIRT, 0.62
            else:
                ramp, base = (STONE if k > 3 else DIRT), 0.5 - 0.04 * k
            for yy in range(4):
                for xx in range(4):
                    px, py = bx + xx, vy + yy
                    if px >= W or py >= H:
                        continue
                    v = base + (0.22 if xx == 0 else 0) + (0.12 if yy == 0 else 0) - (0.2 if xx == 3 else 0) - (0.12 if yy == 3 else 0)
                    v += (rng.random() - 0.5) * 0.12
                    t = np.clip(v, 0, 1) * (len(ramp) - 1)
                    lo = int(t)
                    idx = min(len(ramp) - 1, lo + (1 if (t - lo) > B8[py % 8, px % 8] else 0))
                    img[py, px] = (*ramp[idx], 255)
    # grass tufts on top and dangling roots
    for _ in range(26):
        gx = int(rng.integers(6, W - 6))
        for k in range(int(rng.integers(1, 4))):
            img[top - 1 - k, gx] = (*GRASS[4 if k == 0 else 3], 255)
    for _ in range(9):
        gx = int(rng.integers(20, W - 20))
        col = np.where(img[:, gx, 3] > 0)[0]
        if len(col):
            y0 = col.max() + 1
            for k in range(int(rng.integers(3, 9))):
                if y0 + k < H:
                    img[y0 + k, gx + (k // 3) % 2 - 0] = (*DIRT[1], 255)
    # windmill tower: tapered brass and timber, door, cap
    cx = 62
    for y in range(18, top):
        t = (y - 18) / (top - 18)
        half = 5 + t * 6
        for x in range(int(cx - half), int(cx + half) + 1):
            u = (x - (cx - half)) / (2 * half)
            v = 0.85 - u * 0.55 + (0.12 if (y // 5) % 2 == 0 else 0)
            ramp = WOOD if (y - 18) % 10 < 8 else BRASS
            if abs(x - (cx - half)) < 1 or abs(x - (cx + half)) < 1:
                ramp, v = BRASS, 0.75 - u * 0.4
            tt = np.clip(v, 0, 1) * (len(ramp) - 1)
            lo = int(tt)
            idx = min(len(ramp) - 1, lo + (1 if (tt - lo) > B8[y % 8, x % 8] else 0))
            img[y, x] = (*ramp[idx], 255)
    for y in range(top - 9, top):
        for x in range(cx - 2, cx + 3):
            img[y, x] = (*WOOD[0], 255)
    img[top - 6, cx + 1] = (*BRASS[6], 255)
    # cap
    for y in range(10, 19):
        half = (y - 9) * 1.1 + 2
        for x in range(int(cx - half), int(cx + half) + 1):
            v = 0.9 - (x - (cx - half)) / (2 * half) * 0.6
            tt = np.clip(v, 0, 1) * (len(COPPER) - 1)
            lo = int(tt)
            idx = min(len(COPPER) - 1, lo + (1 if (tt - lo) > B8[y % 8, x % 8] else 0))
            img[y, x] = (*COPPER[idx], 255)
    # little workshop shed on the left, glowing window
    for y in range(top - 12, top):
        for x in range(18, 38):
            u = (x - 18) / 20
            v = 0.7 - u * 0.4
            tt = np.clip(v, 0, 1) * (len(WOOD) - 1)
            lo = int(tt)
            idx = min(len(WOOD) - 1, lo + (1 if (tt - lo) > B8[y % 8, x % 8] else 0))
            img[y, x] = (*WOOD[idx], 255)
    for y in range(top - 18, top - 11):
        for x in range(16 + (y - (top - 18)) * 0, 40):
            if abs(x - 28) <= (y - (top - 19)) * 1.8:
                v = 0.85 - (x - 16) / 24 * 0.5
                tt = np.clip(v, 0, 1) * (len(COPPER) - 1)
                lo = int(tt)
                idx = min(len(COPPER) - 1, lo + (1 if (tt - lo) > B8[y % 8, x % 8] else 0))
                img[y, x] = (*COPPER[idx], 255)
    for y in range(top - 9, top - 4):
        for x in range(23, 28):
            img[y, x] = (*BRASS[7 if (x + y) % 3 else 6], 255)
    # chimney
    for y in range(top - 24, top - 14):
        for x in range(32, 35):
            img[y, x] = (*IRON[3 if x == 32 else 1], 255)
    return outline(img, BRASS[0])


def blades(size: int, rot: float) -> np.ndarray:
    img = np.zeros((size, size, 4), np.uint8)
    c = size / 2 - 0.5
    L = size / 2 - 1
    for k in range(4):
        a = rot + k * math.pi / 2
        ca, sa = math.cos(a), math.sin(a)
        for s in np.linspace(2, L, int(L * 3)):
            # spar
            x, y = c + ca * s, c + sa * s
            img[int(round(y)), int(round(x))] = (*WOOD[1], 255)
            # sail: a strip trailing the spar
            if s > L * 0.3:
                for w in np.linspace(1, 5.5, 10):
                    px, py = x - sa * w, y + ca * w
                    ix, iy = int(round(px)), int(round(py))
                    if 0 <= ix < size and 0 <= iy < size:
                        lat = 0.85 - 0.35 * (w / 5.5) + (0.12 if int(s) % 6 == 0 else 0)
                        tt = np.clip(lat, 0, 1) * (len(CLOTH) - 1)
                        lo = int(tt)
                        idx = min(len(CLOTH) - 1, lo + (1 if (tt - lo) > B8[iy % 8, ix % 8] else 0))
                        if int(s) % 6 == 0:
                            idx = 1
                        img[iy, ix] = (*CLOTH[idx], 255)
    ci = int(round(c))
    img[ci - 2 : ci + 3, ci - 2 : ci + 3] = (*BRASS[5], 255)
    img[ci - 1 : ci + 1, ci - 1 : ci + 1] = (*BRASS[7], 255)
    return outline(img, BRASS[0])


def airship(frame: int) -> np.ndarray:
    W, H = 84, 46
    x, y = grid(W, H, 40, 17)
    env = (x / 34) ** 2 + (y / 14) ** 2 <= 1
    # tail fins
    fin = ((x > 24) & (x < 38) & (np.abs(y) < 4 + (x - 24) * 0.75) & (np.abs(y) > 2)) & ((x / 38) ** 2 + (y / 15) ** 2 > 0.6)
    h = np.where(env, np.sqrt(np.clip(1 - (x / 34) ** 2 - (y / 14) ** 2, 0, 1)), 0) * 6
    seams = env & ((np.abs(((x + 34) % 9) - 0) < 0.7))
    light = lit(h, 1.0)
    rgb = to_ramp(light / 1.15, COPPER)
    # brass bands on the envelope
    band = env & (np.abs(y) < 1.2)
    rgb[band] = to_ramp(light / 1.0, BRASS)[band]
    rgb[seams] = COPPER[2]
    finrgb = to_ramp(0.55 - y * 0.03, BRASS)
    out = rgba_from(rgb, env)
    f = rgba_from(finrgb, fin)
    over(f, out)
    out = f
    # gondola with lit windows
    g = (np.abs(x + 2) < 13) & (y > 15) & (y < 23)
    grgb = to_ramp(np.clip(0.75 - (x + 15) / 26 * 0.4 - (y - 15) * 0.03, 0, 1), WOOD)
    gw = g & (y > 17) & (y < 20) & (((x.astype(int) + 40) % 5) < 2) & (np.abs(x + 2) < 10)
    grgb[gw] = BRASS[7]
    gimg = rgba_from(grgb, g)
    over(out, gimg)
    # rigging
    for gx in (-12, 8):
        for yy in range(12, 16):
            out[17 + yy - 1, 40 + gx] = (*IRON[2], 255)
    # cargo crate hanging
    for yy in range(23, 31):
        out[yy, 38] = (*IRON[2], 255)
    for yy in range(31, 38):
        for xx in range(33, 44):
            v = 0.7 - (xx - 33) * 0.04 + (0.15 if yy == 31 else 0)
            idx = int(np.clip(v, 0, 1) * (len(WOOD) - 1) + (B8[yy % 8, xx % 8] > 0.5))
            out[yy, xx] = (*WOOD[min(idx, len(WOOD) - 1)], 255)
    for xx in range(33, 44):
        out[34, xx] = (*BRASS[4], 255)
    # propeller at the stern
    px, py = 77, 17
    for yy in range(14, 21):
        out[yy, 75] = (*IRON[3], 255)
    if frame == 0:
        for k in range(-6, 7):
            out[py + k, px] = (*BRASS[6 if abs(k) < 4 else 4], 255)
    else:
        for k in range(-2, 3):
            out[py + k, px - 1] = (*BRASS[5], 255)
            out[py + k, px + 1] = (*BRASS[3], 255)
        out[py - 5, px] = (*BRASS[3], 255)
        out[py + 5, px] = (*BRASS[3], 255)
    return outline(out, BRASS[0])


def puff(size: int, t: float, ramp=STEAM) -> np.ndarray:
    """A steam puff; t 0..1 grows it and thins it."""
    x, y = grid(size, size, size / 2, size / 2)
    rr = size / 2 * (0.35 + 0.6 * t)
    n = fbm((x + 40) / 4.0, (y + 40) / 4.0, 3, 3)
    d = np.hypot(x, y * 1.1) / rr + (n - 0.5) * 0.6
    dens = np.clip(1 - d, 0, 1) * 1.6 * (1.15 - t)
    mask = dens > bayer(size, size) * 0.9 + 0.04
    shade = 0.45 + 0.45 * np.clip(-(x + y) / (rr * 2) + 0.5, 0, 1) + dens * 0.3
    rgb = to_ramp(shade, ramp)
    return rgba_from(rgb, mask)


def spark() -> np.ndarray:
    frames = []
    for k in range(4):
        img = np.zeros((5, 5, 4), np.uint8)
        cols = [BRASS[7], BRASS[6], COPPER[5], COPPER[4]]
        img[2, 2] = (*cols[k], 255)
        if k < 2:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                img[2 + dy, 2 + dx] = (*cols[k + 1], 255)
        frames.append(img)
    return frames


# ---- Starwright -------------------------------------------------------------------------------------------------------
def star(size: int, f: int, frames: int) -> np.ndarray:
    x, y = grid(size, size, size / 2, size / 2)
    r = np.hypot(x, y)
    th = np.arctan2(y, x)
    R = size * 0.2
    t = f / frames * 2 * math.pi
    pulse = 1 + 0.04 * math.sin(t)
    core = r <= R * pulse
    # limb darkening + granulation that drifts in a loop
    mu = np.sqrt(np.clip(1 - (r / (R * pulse)) ** 2, 0, 1))
    gran = fbm(x / 3.2 + math.cos(t) * 1.5, y / 3.2 + math.sin(t) * 1.5, 5, 3)
    v = 0.3 + 0.42 * mu ** 0.7 + (gran - 0.5) * 0.4 - (x + y) / (R * 10)
    rgb = to_ramp(v, STAR)
    # corona: angular rays that breathe
    ray = 0.5 + 0.5 * np.sin(th * 7 + math.sin(t) * 0.8) * np.sin(th * 3 - t)
    cor = np.clip(1 - (r - R) / (R * (1.1 + 0.6 * ray)), 0, 1) ** 1.6
    halo = np.clip(1 - (r - R) / (R * 2.3), 0, 1) ** 2.6 * 0.42
    dens = np.maximum(cor, halo)
    cmask = (~core) & (dens > bayer(size, size) * 1.05 + 0.06)
    crgb = to_ramp(0.12 + dens * 0.6, STAR)
    out = rgba_from(crgb, cmask)
    over(out, rgba_from(rgb, core))
    # prominence arc that grows and falls back over the loop
    a0 = -2.2
    hgt = 0.35 + 0.45 * (0.5 + 0.5 * math.sin(t))
    for s in np.linspace(0, 1, 60):
        ang = a0 + s * 0.7
        rad = R * (1 + hgt * math.sin(s * math.pi))
        px, py = size / 2 + math.cos(ang) * rad, size / 2 + math.sin(ang) * rad
        ix, iy = int(px), int(py)
        if 0 <= ix < size and 0 <= iy < size:
            out[iy, ix] = (*STAR[4], 255)
    return out


def planet(size: int, ramp, bands=False, ring=False, seed=1) -> np.ndarray:
    W = size + (size if ring else 0)
    H = size + (4 if ring else 0)
    x, y = grid(W, H, W / 2, H / 2)
    R = size / 2 - 1
    r = np.hypot(x, y)
    body = r <= R
    nz = np.sqrt(np.clip(1 - (r / R) ** 2, 0, 1))
    lam = np.clip((-x * 0.75 - y * 0.35) / R + nz * 0.55, 0, 1.2)
    tex = fbm(x / 2.5 + seed, y / 2.5, seed, 3)
    if bands:
        tex = 0.5 + 0.5 * np.sin(y * 1.3 + tex * 3)
    v = lam * 0.8 + (tex - 0.5) * 0.3 + 0.05
    out = rgba_from(to_ramp(v, ramp), body)
    if ring:
        ex = (x / (R * 1.9)) ** 2 + (y / (R * 0.42)) ** 2
        rm = (ex <= 1) & (ex >= 0.55)
        front = rm & ((y > 0) | ~body)
        rr = to_ramp(0.55 - x / (R * 6) + 0.2 * (ex < 0.75), VIOLET)
        ri = rgba_from(rr, front)
        over(out, ri)
    return outline(out, ramp[0])


def twinkle(k: int) -> np.ndarray:
    img = np.zeros((7, 7, 4), np.uint8)
    c = 3
    arm = [1, 2, 3, 2][k]
    col = [VIOLET[3], VIOLET[4], (255, 255, 255), VIOLET[4]][k]
    img[c, c] = (*((255, 255, 255) if k else VIOLET[4]), 255)
    for i in range(1, arm + 1):
        cc = VIOLET[3] if i == arm else col
        for dx, dy in ((i, 0), (-i, 0), (0, i), (0, -i)):
            img[c + dy, c + dx] = (*cc, 255)
    return img


# ---- Groundbreak ------------------------------------------------------------------------------------------------------
def crane() -> np.ndarray:
    """Tower crane: lattice mast, slewing unit, cab, long jib to the left, counter-jib and weights to the right."""
    W, H = 176, 150
    img = np.zeros((H, W, 4), np.uint8)
    mx = 132  # mast left edge
    mw = 9
    jib_y = 18

    def put(x, y, col):
        if 0 <= x < W and 0 <= y < H:
            img[y, x] = (*col, 255)

    # mast lattice
    for y in range(jib_y + 8, H):
        put(mx, y, CRANE[3])
        put(mx + mw, y, CRANE[1])
        k = (y - jib_y) % 10
        put(mx + int(k * mw / 10), y, CRANE[2])
        put(mx + mw - int(k * mw / 10), y, CRANE[2])
        if k == 0:
            for x in range(mx, mx + mw + 1):
                put(x, y, CRANE[3] if x < mx + mw // 2 else CRANE[2])
    # slewing unit and cab
    for y in range(jib_y + 2, jib_y + 9):
        for x in range(mx - 2, mx + mw + 3):
            put(x, y, CRANE[4] if y < jib_y + 4 else CRANE[2])
    for y in range(jib_y + 4, jib_y + 12):
        for x in range(mx - 9, mx - 1):
            v = CRANE[3] if x < mx - 6 else CRANE[2]
            put(x, y, v)
    for y in range(jib_y + 5, jib_y + 8):
        for x in range(mx - 8, mx - 3):
            put(x, y, (255, 226, 160))
    # tower top (A-frame) and pendant lines
    apex = (mx + mw // 2, 0)
    for y in range(0, jib_y + 2):
        put(apex[0] - (y // 4), y, CRANE[3])
        put(apex[0] + (y // 4), y, CRANE[2])
    for s in np.linspace(0, 1, 140):
        put(int(apex[0] + (8 - apex[0]) * s * 0.75), int(apex[1] + (jib_y - apex[1]) * s * 0.75 + 0.5), CRANE[1])
        put(int(apex[0] + (W - 4 - apex[0]) * s), int(apex[1] + (jib_y - apex[1]) * s + 0.5), CRANE[1])
    # jib (left) lattice, triangular section seen side on
    for x in range(2, mx):
        put(x, jib_y, CRANE[4])
        put(x, jib_y + 6, CRANE[2])
        k = (x - 2) % 8
        yy = jib_y + (k if k <= 6 else 12 - k)
        put(x, min(yy, jib_y + 6), CRANE[3])
        if k == 0:
            for y in range(jib_y, jib_y + 7):
                put(x, y, CRANE[3])
    for y in range(jib_y, jib_y + 7):
        put(2, y, CRANE[2])
    # counter-jib and concrete weights (right)
    for x in range(mx + mw, W - 2):
        put(x, jib_y + 1, CRANE[4])
        put(x, jib_y + 5, CRANE[2])
        if (x - mx) % 6 == 0:
            for y in range(jib_y + 1, jib_y + 6):
                put(x, y, CRANE[3])
    for y in range(jib_y + 6, jib_y + 18):
        for x in range(W - 22, W - 4):
            v = 0.75 - (x - (W - 22)) / 18 * 0.45 + (0.1 if y == jib_y + 6 else 0) - (0.08 if (y - jib_y) % 4 == 0 else 0)
            tt = np.clip(v, 0, 1) * (len(DUSK) - 2)
            lo = int(tt)
            idx = lo + (1 if (tt - lo) > B8[y % 8, x % 8] else 0)
            put(x, y, [SIL[2], DUSK[1], DUSK[2], DUSK[3], DUSK[4], DUSK[5]][min(idx, 5)])
    # warning light at the tip
    put(3, jib_y - 1, (255, 90, 60))
    put(apex[0], 0, (255, 90, 60))
    return outline(img, SIL[0])


def cloud(w: int, h: int, seed: int) -> np.ndarray:
    x, y = grid(w, h, w / 2, h * 0.62)
    n = fbm((x + seed * 30) / 7, (y + seed * 11) / 4, seed, 4)
    body = ((x / (w / 2)) ** 2 + (y / (h * 0.62)) ** 2 * 1.6) + (0.5 - n) * 0.9
    m = body < 0.95
    m &= y < h * 0.28  # flat-ish base
    lift = np.clip((y + h * 0.6) / h, 0, 1)  # lit from below by the low sun
    v = 0.35 + lift * 0.55 + (n - 0.5) * 0.3 - x / (w * 4)
    return rgba_from(to_ramp(v, DUSK[1:]), m)


def bird(k: int) -> np.ndarray:
    img = np.zeros((5, 9, 4), np.uint8)
    shapes = [
        ["#.......#", ".#.....#.", "..#.#.#..", "...###...", "........."],
        [".........", "##.....##", "..#.#.#..", "...###...", "........."],
        [".........", ".........", "###.#.###", "...###...", "........."],
        [".........", ".........", "...###...", ".##.#.##.", "#.......#"],
    ]
    for yy, row in enumerate(shapes[k]):
        for xx, ch in enumerate(row):
            if ch == "#":
                img[yy, xx] = (*BIRD[0], 255)
    return img


def sun(size: int) -> np.ndarray:
    x, y = grid(size, size, size / 2, size / 2)
    r = np.hypot(x, y)
    R = size * 0.2
    disk = r <= R
    glow = np.clip(1 - (r - R) / (size / 2 - R), 0, 1) ** 1.8
    gm = (~disk) & (glow > bayer(size, size) * 0.9 + 0.06)
    out = rgba_from(to_ramp(0.45 + glow * 0.4, DUSK), gm)
    band = (np.floor((y + R) / 3) % 3 == 0) & (y > 0)
    core = to_ramp(0.92 - (y + R) / (R * 8), DUSK)
    core[band & disk] = DUSK[5]
    over(out, rgba_from(core, disk))
    return out


def beam() -> np.ndarray:
    W, H = 26, 5
    img = np.zeros((H, W, 4), np.uint8)
    for x in range(W):
        img[0, x] = (*STEEL[4], 255)
        img[4, x] = (*STEEL[1], 255)
        for y in (1, 2, 3):
            img[y, x] = (*STEEL[2 if y != 2 else 3], 255) if x in (0, 1, W - 2, W - 1) or y == 2 else (*STEEL[1], 255)
    return outline(img, SIL[0])


# ---- packing ----------------------------------------------------------------------------------------------------------
def pack(game: str, sprites: dict[str, list[np.ndarray]]) -> dict:
    """Row packer: each sprite's frames sit side by side on one row, rows stacked."""
    width = max(sum(f.shape[1] + 1 for f in fr) for fr in sprites.values())
    height = sum(max(f.shape[0] for f in fr) + 1 for fr in sprites.values())
    sheet = np.zeros((height, width, 4), np.uint8)
    atlas = {}
    y = 0
    for name, frames in sprites.items():
        x = 0
        rects = []
        for f in frames:
            h, w = f.shape[:2]
            sheet[y : y + h, x : x + w] = f
            rects.append([x, y, w, h])
            x += w + 1
        atlas[name] = rects
        y += max(f.shape[0] for f in frames) + 1
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{game}.webp"
    Image.fromarray(sheet, "RGBA").save(path, "WEBP", lossless=True, quality=100, method=6)
    print(f"{path.relative_to(ROOT)}: {width}x{height}, {path.stat().st_size / 1024:.1f} KiB")
    return atlas


def main() -> None:
    atlases = {}
    atlases["brasswork"] = pack(
        "brasswork",
        {
            "gearL": [gear(104, 12, i * (2 * math.pi / 12) / 8) for i in range(8)],
            "gearM": [gear(64, 8, -i * (2 * math.pi / 8) / 8, COPPER) for i in range(8)],
            "gearS": [gear(42, 6, i * (2 * math.pi / 6) / 8) for i in range(8)],
            "island": [windmill_island()],
            "blades": [blades(44, i * (math.pi / 2) / 6) for i in range(6)],
            "airship": [airship(0), airship(1)],
            "puff": [puff(26, i / 5) for i in range(6)],
            "spark": spark(),
        },
    )
    atlases["starwright"] = pack(
        "starwright",
        {
            "star": [star(104, i, 8) for i in range(8)],
            "rock": [planet(16, ROCK, seed=3)],
            "ice": [planet(20, ICE, seed=9)],
            "gas": [planet(26, GAS, bands=True, ring=True, seed=5)],
            "twinkle": [twinkle(k) for k in range(4)],
        },
    )
    atlases["groundbreak"] = pack(
        "groundbreak",
        {
            "crane": [crane()],
            "sun": [sun(64)],
            "cloud": [cloud(72, 18, 1), cloud(56, 14, 2), cloud(88, 20, 3)],
            "bird": [bird(k) for k in range(4)],
            "beam": [beam()],
        },
    )
    body = json.dumps(atlases, separators=(",", ":"))
    ATLAS.write_text(
        "// Generated by scripts/home-band/generate.py. Do not edit by hand.\n"
        "// Frame rectangles [x, y, w, h] in public/home/band/<game>.webp.\n"
        f"export const BAND_ATLAS = {body} as const;\n"
    )
    print(f"{ATLAS.relative_to(ROOT)} written")


if __name__ == "__main__":
    main()
