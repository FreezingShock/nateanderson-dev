"""Node Farm prestige tree backdrop: parallax dither layers, the core halo and one nebula per section.

Run:  python3 scripts/naos-art/nodefarm-tree-bg.py            (everything)
      python3 scripts/naos-art/nodefarm-tree-bg.py layers      (just the four tiles)
      python3 scripts/naos-art/nodefarm-tree-bg.py core secs   (just the halo, just the section nebulae)
      python3 scripts/naos-art/nodefarm-tree-bg.py --variant circuit   (alternate far layer, used for the taste sheet)
Output (public/naos/nodefarm/):
  tree-bg-0..2.{png,webp}   far to near. 512 x 512 art px, each tiles seamlessly on both axes, drawn 2 css px per pixel.
                            0 is opaque (deep space with the nebula baked in); 1 (stars) and 2 (near motes) are transparent.
  tree-dust.{png,webp}      the nearest layer, drawn in front of the nodes (TreeDust). Transparent, very sparse.
  tree-core.{png,webp}      the halo behind the core, 400 x 400 art px, transparent, drawn in world space.
  tree-sec-<branch>.{png,webp}  one 256 x 256 transparent nebula per section, drawn in world space behind that arm.
Palette PNGs (index 0 is transparent on 1 to 3 and the world pieces). Everything is procedural: Bayer 4 x 4 dither over
periodic FFT noise, hand-placed shapes, no traced or borrowed art. components/nodefarm/tree/tree-backdrop.tsx moves them.
"""
import math
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "public", "naos", "nodefarm")
BAYER = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) + 0.5) / 16.0
T = 512
# Section colours, in the order of BRANCHES in lib/nodefarm/engine.ts. Keep in step with SEC_COLORS in tree-backdrop.tsx.
SECS = [("signal", "#2fd8e8"), ("forge", "#ffc53a"), ("systems", "#6bffc9"), ("drones", "#ff4d6d"), ("anomaly", "#9a7bff")]
BASE = "#04060b"


def rgb(h):
    return tuple(int(h[i : i + 2], 16) for i in (1, 3, 5))


def mix(a, b, t):
    a, b = (rgb(a) if isinstance(a, str) else a), (rgb(b) if isinstance(b, str) else b)
    return tuple(int(round(a[i] * (1 - t) + b[i] * t)) for i in range(3))


def bayer(h, w):
    return np.tile(BAYER, (h // 4 + 1, w // 4 + 1))[:h, :w]


def pnoise(rng, n, scale, power=2.2):
    """Periodic value noise on an n x n torus: white noise shaped in frequency space, so it wraps without a seam."""
    f = np.fft.fftfreq(n)
    fx, fy = np.meshgrid(f, f)
    r = np.sqrt(fx * fx + fy * fy) * scale
    amp = 1.0 / (1.0 + r ** power)
    amp[0, 0] = 0
    spec = np.fft.fft2(rng.standard_normal((n, n))) * amp
    out = np.real(np.fft.ifft2(spec))
    out -= out.min()
    return out / max(out.max(), 1e-9)


def wrap_put(idx, x, y, v):
    idx[y % idx.shape[0], x % idx.shape[1]] = v


def save(idx, pal, stem, transparent=True):
    """idx: uint8 array of palette indices; pal: list of rgb tuples (index 0 first)."""
    im = Image.fromarray(idx.astype(np.uint8), "P")
    flat = []
    for c in pal:
        flat += list(c)
    im.putpalette(flat + [0] * (768 - len(flat)))
    png = os.path.join(OUT, stem + ".png")
    if transparent:
        im.info["transparency"] = 0
        im.save(png, transparency=0, optimize=True)
    else:
        im.save(png, optimize=True)
    im.convert("RGBA").save(os.path.join(OUT, stem + ".webp"), lossless=True, quality=100, method=6)
    print("wrote", stem, idx.shape[1], "x", idx.shape[0])


# ------------------------------------------------------------------------------------------- star shapes
def star(idx, x, y, kind, core, glow):
    """kind 0: one px. 1: plus. 2: plus with a long cross. 3: big twinkle with diagonal sparks."""
    if kind == 0:
        wrap_put(idx, x, y, core)
        return
    wrap_put(idx, x, y, core)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        wrap_put(idx, x + dx, y + dy, glow if kind == 1 else core)
    if kind >= 2:
        for d in (2, 3):
            for dx, dy in ((d, 0), (-d, 0), (0, d), (0, -d)):
                wrap_put(idx, x + dx, y + dy, glow)
    if kind >= 3:
        for d in (4, 5):
            for dx, dy in ((d, 0), (-d, 0), (0, d), (0, -d)):
                if d == 4 or (x + y) % 2 == 0:
                    wrap_put(idx, x + dx, y + dy, glow)
        for dx, dy in ((2, 2), (-2, 2), (2, -2), (-2, -2)):
            wrap_put(idx, x + dx, y + dy, glow)


# ------------------------------------------------------------------------------------------- layer 0: deep space
def layer0(variant="space"):
    rng = np.random.default_rng(11)
    pal = [rgb(BASE), mix(BASE, "#1b2a44", 0.55), mix(BASE, "#2b3d63", 0.8), (88, 104, 140)]
    # section tints, very low, for the far nebula: 4..8
    pal += [mix(BASE, c, 0.22) for _, c in SECS]
    idx = np.zeros((T, T), np.uint8)
    b = bayer(T, T)
    if variant == "circuit":
        return layer0_circuit(rng, pal)
    # two scales of cloud: broad, plus a finer ridge so the dither has grain
    broad = pnoise(rng, T, 9, 2.4)
    fine = pnoise(rng, T, 40, 2.0)
    d = np.clip((broad - 0.45) * 1.8 + (fine - 0.5) * 0.15, 0, 1) ** 1.5
    idx[d * 0.5 > b] = 1
    idx[(d * 0.5 - 0.26) > b] = 2
    # far section tints in big soft blobs: each colour owns a region of a hue field
    hue = pnoise(rng, T, 5, 2.6)
    hue_b = np.floor(np.clip(hue, 0, 0.999) * len(SECS)).astype(int)
    tint = np.clip((pnoise(rng, T, 7, 2.4) - 0.6) * 2.5, 0, 1) ** 1.8
    m = (tint * 0.12) > b
    idx[m] = 4 + hue_b[m]
    # dust: lots of single dim stars
    for _ in range(380):
        x, y = rng.integers(0, T, 2)
        idx[y, x] = 2 if rng.random() < 0.75 else 3
    save(idx, pal, "tree-bg-0", transparent=False)


def layer0_circuit(rng, pal):
    """Alternate far layer for the taste sheet: a vast dark circuit board far below the tree."""
    idx = np.zeros((T, T), np.uint8)
    b = bayer(T, T)
    broad = pnoise(rng, T, 7, 2.4)
    idx[(np.clip(broad - 0.45, 0, 1) * 0.9) > b] = 1
    grid = 32
    for gy in range(0, T, grid):
        for gx in range(0, T, grid):
            r = rng.random()
            if r < 0.35:
                # a trace that runs right then turns down
                L = int(rng.integers(1, 4)) * grid
                for k in range(L):
                    wrap_put(idx, gx + k, gy, 2)
                for k in range(int(rng.integers(1, 3)) * grid // 2):
                    wrap_put(idx, gx + L, gy + k, 2)
                wrap_put(idx, gx, gy, 3)
            elif r < 0.5:
                # a chip with pins
                w, h = int(rng.integers(8, 20)), int(rng.integers(6, 14))
                for yy in range(h):
                    for xx in range(w):
                        if yy in (0, h - 1) or xx in (0, w - 1):
                            wrap_put(idx, gx + xx + 6, gy + yy + 6, 2)
                for xx in range(1, w, 3):
                    wrap_put(idx, gx + xx + 6, gy + 4, 1)
                    wrap_put(idx, gx + xx + 6, gy + h + 7, 1)
    for _ in range(500):
        x, y = rng.integers(0, T, 2)
        idx[y, x] = 3 if rng.random() < 0.3 else 2
    save(idx, pal, "tree-bg-0", transparent=False)


# ------------------------------------------------------------------------------------------- nebula (baked into layer 0)
def layer1():
    rng = np.random.default_rng(23)
    # per section: 3 shades (dim dither, mid dither, bright rim) -> indices 1 + s*3 + k
    pal = [(0, 0, 0)]
    for _, c in SECS:
        pal += [mix(BASE, c, 0.28), mix(BASE, c, 0.5), mix(BASE, c, 0.85)]
    idx = np.zeros((T, T), np.uint8)
    b = bayer(T, T)
    hue = pnoise(rng, T, 4, 2.8)
    sec = np.floor(np.clip(hue, 0, 0.999) * len(SECS)).astype(int)
    cloud = pnoise(rng, T, 12, 2.2)
    wisp = pnoise(rng, T, 46, 1.8)
    d = np.clip((cloud - 0.5) * 2.2 + (wisp - 0.5) * 0.3, 0, 1) ** 1.6
    lo = (d * 0.36) > b
    mid = (d * 0.36 - 0.2) > b
    idx[lo] = (1 + sec * 3)[lo]
    idx[mid] = (2 + sec * 3)[mid]
    save(idx, pal, "_tree-bg-mid")


# ------------------------------------------------------------------------------------------- layer 1: coloured stars
def layer2():
    rng = np.random.default_rng(37)
    pal = [(0, 0, 0), (234, 242, 255), (150, 168, 200)]
    for _, c in SECS:
        pal += [rgb(c), mix(BASE, c, 0.55)]
    idx = np.zeros((T, T), np.uint8)
    for _ in range(260):
        x, y = (int(v) for v in rng.integers(0, T, 2))
        r = rng.random()
        if r < 0.45:
            idx[y, x] = 1 if rng.random() < 0.5 else 2
            continue
        s = int(rng.integers(0, len(SECS)))
        core, glow = (1, 3 + s * 2 + 1) if rng.random() < 0.4 else (3 + s * 2, 3 + s * 2 + 1)
        star(idx, x, y, 1 if r < 0.85 else 2, core, glow)
    save(idx, pal, "tree-bg-1")


# ------------------------------------------------------------------------------------------- layer 2: near motes
def layer3():
    """Sparse, big, close: dithered discs (out of focus), a few big twinkles and hex data motes. Sells the depth."""
    rng = np.random.default_rng(53)
    pal = [(0, 0, 0), (234, 242, 255)]
    for _, c in SECS:
        pal += [rgb(c), mix(BASE, c, 0.42)]
    idx = np.zeros((T, T), np.uint8)
    b = bayer(T, T)
    yy, xx = np.indices((T, T))
    placed = []
    for _ in range(9):
        for _try in range(40):
            cx, cy = (int(v) for v in rng.integers(0, T, 2))
            if all(min(abs(cx - px), T - abs(cx - px)) ** 2 + min(abs(cy - py), T - abs(cy - py)) ** 2 > 110 ** 2 for px, py in placed):
                break
        placed.append((cx, cy))
        r = int(rng.integers(10, 26))
        s = int(rng.integers(0, len(SECS)))
        dx = np.minimum(abs(xx - cx), T - abs(xx - cx))
        dy = np.minimum(abs(yy - cy), T - abs(yy - cy))
        dist = np.sqrt(dx * dx + dy * dy) / r
        dens = np.clip(1 - dist, 0, 1) ** 0.7 * 0.4
        m = (dens > b) & (dist < 1)
        idx[m] = 3 + s * 2
        ring = (np.abs(dist - 1) < 0.06) & ((xx + yy) % 3 == 0)
        idx[ring] = 3 + s * 2
    for _ in range(14):
        x, y = (int(v) for v in rng.integers(0, T, 2))
        s = int(rng.integers(0, len(SECS)))
        star(idx, x, y, 3, 1, 2 + s * 2)
    # hex motes: tiny outlined hexagons, the naOS touch
    for _ in range(10):
        x, y = (int(v) for v in rng.integers(0, T, 2))
        s = int(rng.integers(0, len(SECS)))
        for px, py in ((1, -3), (2, -3), (3, -2), (4, -1), (4, 0), (4, 1), (3, 2), (2, 3), (1, 3), (0, 3), (-1, 3), (-2, 2), (-3, 1), (-3, 0), (-3, -1), (-2, -2), (-1, -3), (0, -3)):
            wrap_put(idx, x + px, y + py, 2 + s * 2)
        wrap_put(idx, x, y, 1)
        wrap_put(idx, x + 1, y, 1)
    save(idx, pal, "tree-bg-2")


# ------------------------------------------------------------------------------------------- world pieces
def core_halo():
    """A reactor halo behind the core: dithered glow, two broken rings with tick marks, faint spokes toward the arms."""
    N = 400
    c = N / 2
    yy, xx = np.indices((N, N))
    dx, dy = xx - c + 0.5, yy - c + 0.5
    r = np.sqrt(dx * dx + dy * dy)
    a = (np.degrees(np.arctan2(dy, dx)) + 360) % 360
    b = bayer(N, N)
    pal = [(0, 0, 0), (60, 74, 96), (130, 150, 180), (220, 232, 250)]
    idx = np.zeros((N, N), np.uint8)
    glow = np.clip(1 - r / 190, 0, 1) ** 2.2
    idx[(glow * 0.75) > b] = 1
    idx[(glow * 0.75 - 0.35) > b] = 2
    for R, gaps, w in ((88, 6, 1.2), (128, 10, 1.0), (176, 18, 0.8)):
        ring = np.abs(r - R) < w
        seg = (np.floor(a / (360 / gaps)) % 2 == 0) | (R == 128)
        idx[ring & seg & ((xx + yy) % (1 if R < 120 else 2) == 0)] = 3 if R == 88 else 2
        # tick marks every 6 degrees
        tick = (np.abs(r - (R + 5)) < 3) & ((a % 6) < 0.9)
        idx[tick] = 2
    # five spokes, one per section, matching the arm angles (first arm points up)
    for i in range(5):
        th = -90 + i * 72
        da = np.abs(((a - th + 180) % 360) - 180)
        sp = (da < 0.9) & (r > 92) & (r < 190) & ((r.astype(int) % 4) < 2)
        idx[sp] = 2
    save(idx, pal, "tree-core")


def sec_piece(name, col, seed):
    """One section nebula: a soft cloud in the section colour with a motif that says what the section is about."""
    N = 256
    rng = np.random.default_rng(seed)
    c = N / 2
    yy, xx = np.indices((N, N))
    dx, dy = xx - c + 0.5, yy - c + 0.5
    r = np.sqrt(dx * dx + dy * dy) / (N / 2)
    b = bayer(N, N)
    # forge (amber) and systems (mint) sink into the dark base far more than the cool hues at the same mix, so they get a
    # brighter ramp; without it they read as a faint smudge on the live tree (art audit, item 9)
    lift = 1.4 if name in ("forge", "systems") else 1.0
    pal = [(0, 0, 0), mix(BASE, col, 0.22 * lift), mix(BASE, col, 0.4 * lift), mix(BASE, col, min(1.0, 0.7 * lift))]
    idx = np.zeros((N, N), np.uint8)
    n = pnoise(rng, N, 6, 2.3)
    d = np.clip((1 - r) * 1.3 * (0.4 + n * 1.0) - 0.08, 0, 1) ** 1.5
    idx[(d * 0.5) > b] = 1
    idx[(d * 0.5 - 0.2) > b] = 2
    # motif lines fade out toward the rim through the dither, unevenly, so the piece reads as a cloud, not a disc
    edge = (np.clip((0.95 - r) / 0.55, 0, 1) * (0.55 + 0.7 * n)) > b
    on = (xx + yy) % 2 == 0
    if name == "signal":  # interference rings
        for R in range(18, 120, 14):
            ring = (np.abs(r * N / 2 - R) < 0.8) & on & edge
            idx[ring] = 3 if R < 60 else 2
    elif name == "forge":  # rising heat columns and sparks
        for k in range(9):
            x0 = int(28 + k * 25 + rng.integers(-5, 6))
            for y in range(40, 220):
                x = int(x0 + 3 * math.sin(y / 9 + k))
                if 0 <= x < N and edge[y, x] and y % 3:
                    idx[y, x] = 3 if r[y, x] < 0.5 else 2
        for _ in range(90):
            x, y = (int(v) for v in rng.integers(30, N - 30, 2))
            if edge[y, x]:
                idx[y, x] = 3
    elif name == "systems":  # isometric lattice
        lat = (((xx + 2 * yy) % 22 == 0) | ((xx - 2 * yy) % 22 == 0)) & edge
        idx[lat & on] = 2
        idx[lat & (r < 0.55)] = 3  # solid lines in the middle so the lattice still reads when the plate is smoothed
        nodes = (((xx + 2 * yy) % 22 == 0) & ((xx - 2 * yy) % 22 == 0)) & edge
        idx[nodes] = 3
    elif name == "drones":  # honeycomb
        s = 13
        for row in range(-1, N // s + 2):
            for col in range(-1, N // (s * 2) + 2):
                cx = col * s * 3 // 1 + (s * 3 // 2 if row % 2 else 0)
                cy = row * s
                for t in range(6):
                    a0 = math.radians(60 * t)
                    a1 = math.radians(60 * (t + 1))
                    for u in np.linspace(0, 1, 10):
                        x = int(cx + s * ((1 - u) * math.cos(a0) + u * math.cos(a1)))
                        y = int(cy + s * ((1 - u) * math.sin(a0) + u * math.sin(a1)))
                        if 0 <= x < N and 0 <= y < N and edge[y, x]:
                            idx[y, x] = 2
    elif name == "anomaly":  # glitch slices: horizontal bands shifted sideways
        src = idx.copy()
        for y in range(0, N, 1):
            band = (y // 7) % 5
            if band in (1, 3):
                shift = int(rng.integers(-14, 15))
                idx[y] = np.roll(src[y], shift)
        for _ in range(16):
            x, y = (int(v) for v in rng.integers(30, N - 30, 2))
            w = int(rng.integers(6, 30))
            if edge[y, x]:
                idx[y, max(0, x - w) : x] = 3
    save(idx, pal, f"tree-sec-{name}")


def dust():
    """The nearest layer, drawn in front of the nodes: a few big out-of-focus dither discs and short streaks. Very sparse
    and see-through, so it passes over the tree without hiding a node for long."""
    rng = np.random.default_rng(71)
    pal = [(0, 0, 0), (200, 214, 240), (120, 136, 170)]
    for _, c in SECS:
        pal += [mix(BASE, c, 0.7)]
    idx = np.zeros((T, T), np.uint8)
    b = bayer(T, T)
    yy, xx = np.indices((T, T))
    placed = []
    for _ in range(5):
        for _try in range(60):
            cx, cy = (int(v) for v in rng.integers(0, T, 2))
            if all(min(abs(cx - px), T - abs(cx - px)) ** 2 + min(abs(cy - py), T - abs(cy - py)) ** 2 > 180 ** 2 for px, py in placed):
                break
        placed.append((cx, cy))
        r = int(rng.integers(26, 48))
        col = 3 + int(rng.integers(0, len(SECS))) if rng.random() < 0.6 else 2
        dx = np.minimum(abs(xx - cx), T - abs(xx - cx))
        dy = np.minimum(abs(yy - cy), T - abs(yy - cy))
        dist = np.sqrt(dx * dx + dy * dy) / r
        # a bokeh disc: thin in the middle, a brighter rim, all through a sparse dither
        dens = np.where(dist < 1, 0.1 + 0.22 * dist ** 3, 0)
        idx[(dens > b) & (dist < 1)] = col
    for _ in range(16):
        x, y = (int(v) for v in rng.integers(0, T, 2))
        L = int(rng.integers(3, 9))
        for k in range(L):
            wrap_put(idx, x + k, y + k // 3, 1 if k < L - 2 else 2)
    save(idx, pal, "tree-dust")


def merge_far():
    """Bake the nebula into the deep-space tile: one opaque far layer instead of two (each full-screen layer costs a
    composite per frame while panning)."""
    far = Image.open(os.path.join(OUT, "tree-bg-0.png")).convert("RGBA")
    mid = Image.open(os.path.join(OUT, "_tree-bg-mid.png")).convert("RGBA")
    far.alpha_composite(mid)
    out = far.convert("RGB").quantize(colors=255, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    out.save(os.path.join(OUT, "tree-bg-0.png"), optimize=True)
    out.convert("RGB").save(os.path.join(OUT, "tree-bg-0.webp"), lossless=True, quality=100, method=6)
    for ext in ("png", "webp"):
        os.remove(os.path.join(OUT, "_tree-bg-mid." + ext))
    print("merged the nebula into tree-bg-0")


def main(args):
    variant = "space"
    if "--variant" in args:
        variant = args[args.index("--variant") + 1]
        args = [a for a in args if a not in ("--variant", variant)]
    want = set(args) or {"layers", "core", "secs"}
    if "layers" in want:
        layer0(variant)
        layer1()
        merge_far()
        layer2()
        layer3()
        dust()
    if "core" in want:
        core_halo()
    if "secs" in want:
        for i, (n, col) in enumerate(SECS):
            sec_piece(n, col, 100 + i)


if __name__ == "__main__":
    main(sys.argv[1:])
