"""Generate the naOS 1-bit dithered art (original, procedural; no third-party art).

Run: python3 scripts/naos-art/generate.py
Output: public/naos/*.png (1-bit palette PNG, index 0 transparent, index 1 = ink #f4f4f2).
Each art pixel is drawn at 2 CSS px in the page (image-rendering: pixelated).
"""
import os
import numpy as np
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "naos")
INK = (244, 244, 242)

# 4x4 Bayer threshold matrix, normalised to (0, 1)
BAYER4 = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) + 0.5) / 16.0

# Face codes written into the ID buffer
TOP, LEFT, RIGHT, EDGE = 1, 2, 3, 4
BTOP, BLEFT, BRIGHT = 5, 6, 7  # built structures: solid top, brighter sides


def dither(intensity, ids):
    """intensity: float array 0..1, ids: face codes. Returns a bool ink mask."""
    h, w = intensity.shape
    tile = np.tile(BAYER4, (h // 4 + 1, w // 4 + 1))[:h, :w]
    ink = intensity > tile
    ink[ids == EDGE] = True
    ink[ids == 0] = False
    return ink


def save_1bit(ink, path):
    idx = ink.astype(np.uint8)
    img = Image.fromarray(idx, "P")
    pal = [0, 0, 0] + list(INK) + [0] * (256 - 2) * 3
    img.putpalette(pal[: 256 * 3])
    img.save(path, transparency=0, optimize=True)
    print("wrote", os.path.normpath(path), img.size, os.path.getsize(path), "bytes")


# ---------------------------------------------------------------------------------------------
# 1. Floating voxel islands (hero). Isometric columns, painter order, dithered shading.
# ---------------------------------------------------------------------------------------------
def islands():
    W, H = 300, 200
    CW, CH, VH = 5.0, 2.6, 3.2
    ox, oy = W / 2 - 10, 46.0
    ids_img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(ids_img)

    def P(x, y, z):
        return (ox + (x - y) * CW, oy + (x + y) * CH - z * VH)

    # Two islands: a large one and a smaller one higher and to the right (Fractured Islands echo).
    islands_def = [
        dict(cx=19, cy=19, r=12.0, top=6, base=-11, lift=0, dx=0, dy=0,
             # (x0, y0, w, h, extra height): a house, a tower and two trees on the big island.
             boxes=[(14, 15, 3, 2, 3), (25, 23, 1, 1, 8), (11, 24, 1, 1, 2), (24, 11, 1, 1, 2)]),
        dict(cx=10, cy=10, r=5.0, top=3, base=-4, lift=9, dx=0, dy=0,
             boxes=[(9, 9, 2, 1, 2)]),
    ]
    cols = []
    for isl in islands_def:
        cx, cy, R = isl["cx"], isl["cy"], isl["r"]
        extra = {}
        for x0, y0, w, h, eh in isl.get("boxes", []):
            for x in range(x0, x0 + w):
                for y in range(y0, y0 + h):
                    extra[(x, y)] = eh
        for x in range(0, 44):
            for y in range(0, 44):
                dx, dy = x - cx, y - cy
                r = (dx * dx + dy * dy) ** 0.5 / R
                if r >= 1.0:
                    continue
                # Terraced top: integer steps so every layer reads as a ledge.
                ztop = int(round(isl["top"] * (1 - r * r) ** 0.6))
                zbase = int(round(isl["base"] * (1 - r) ** 1.4))
                zbase = min(zbase, ztop - 1)
                zb, zt = zbase + isl["lift"], ztop + isl["lift"]
                cols.append((x, y, zb, zt, r, False))
                if (x, y) in extra:
                    cols.append((x, y, zt, zt + extra[(x, y)], r, True))

    cols.sort(key=lambda c: (c[0] + c[1], c[3]))
    for x, y, zb, zt, _, boxed in cols:
        # Side faces first (they sit under the top), then the top face.
        # Right face (+x side) and left face (+y side), running from the base to the top.
        rc, lc, tc = (BRIGHT, BLEFT, BTOP) if boxed else (RIGHT, LEFT, TOP)
        if zt > zb:
            d.polygon([P(x + 1, y, zb), P(x + 1, y + 1, zb), P(x + 1, y + 1, zt), P(x + 1, y, zt)], fill=rc)
            d.polygon([P(x, y + 1, zb), P(x + 1, y + 1, zb), P(x + 1, y + 1, zt), P(x, y + 1, zt)], fill=lc)
        top = [P(x, y, zt), P(x + 1, y, zt), P(x + 1, y + 1, zt), P(x, y + 1, zt)]
        d.polygon(top, fill=tc)
        if boxed:
            d.line(top + [top[0]], fill=EDGE, width=1)

    arr = np.array(ids_img)
    yy, xx = np.mgrid[0:H, 0:W]
    # Shade by face. Tops get a radial falloff so the dither reads as a light source from above-left.
    lx, ly = W * 0.42, H * 0.36
    dist = np.sqrt(((xx - lx) / (W * 0.55)) ** 2 + ((yy - ly) / (H * 0.6)) ** 2)
    inten = np.zeros((H, W))
    inten[arr == TOP] = np.clip(0.62 - 0.5 * dist, 0.08, 0.62)[arr == TOP]
    inten[arr == LEFT] = 0.46
    inten[arr == RIGHT] = 0.2
    inten[arr == BTOP] = 1.0          # solid white roofs read as blocks, like the ctOS title cards
    inten[arr == BLEFT] = 0.72
    inten[arr == BRIGHT] = 0.42
    ink = dither(inten, arr)
    return ink


# ---------------------------------------------------------------------------------------------
# 2. Lane track (section break). Top-down stadium, lanes as dither bands, finish tape.
# ---------------------------------------------------------------------------------------------
def track():
    W, H = 320, 96
    L, R = 72.0, 30.0           # half straight length, radius (outer edge)
    cx, cy = W / 2, H / 2
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    x = xx + 0.5 - cx
    y = yy + 0.5 - cy
    # Signed distance to a stadium with outer radius R (negative inside). Only the band matters here.
    qx = np.maximum(np.abs(x) - L, 0.0)
    dist = np.sqrt(qx * qx + y * y) - R  # 0 at outer edge, -band at the inside edge
    band = 26.0
    inside = dist < 0
    in_band = (dist < 0) & (dist >= -band)
    lane_idx = np.floor(-dist / 4.4).astype(int)
    inten = np.zeros((H, W))
    inten[in_band] = np.where(lane_idx[in_band] % 2 == 0, 0.16, 0.34)
    inten[(dist < -band) & inside] = 0.06
    # Lane boundary lines, solid enough to read.
    edge_line = np.abs(dist + 0.0) < 0.6
    lane_line = np.zeros_like(edge_line)
    for k in (2, 4, 6):
        lane_line |= np.abs(dist + 4.4 * k) < 0.5
    ids = np.zeros((H, W), dtype=int)
    ids[in_band] = TOP
    ids[edge_line | (np.abs(dist + band) < 0.6)] = EDGE
    ids[lane_line & in_band] = EDGE
    # Finish tape across the top straight, inside the band.
    tape = (np.abs(x - 46) < 0.8) & in_band
    ids[tape] = EDGE
    # Infield: a sparse halftone so the centre is not empty.
    ids[(dist < -band) & inside] = TOP
    centre = np.clip(0.12 * (1 - np.hypot(x, y) / (L + R)), 0.0, 0.12)
    inten[(dist < -band) & inside] = centre[(dist < -band) & inside]
    # Keep only the ring and infield dither; hide the outside.
    ink = dither(inten, ids)
    return ink


# ---------------------------------------------------------------------------------------------
# 3. Dithered halftone wash (section break accent): a soft gradient band with one hard edge.
# ---------------------------------------------------------------------------------------------
def wash():
    W, H = 320, 40
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    inten = np.clip(1.0 - (xx / W) * 1.1, 0, 1) * np.clip(1.0 - (yy / H), 0.15, 1)
    ids = np.full((H, W), TOP)
    ids[(yy > H - 2)] = EDGE
    return dither(inten, ids)

# ---------------------------------------------------------------------------------------------
# 4. Timeline route (Timeline page header): a staircase of voxel terraces climbing toward the
#    launch block, with a dashed route line and a diamond station on each step. Same dither
#    language as the islands; the final step is a solid white block (the launch title card).
# ---------------------------------------------------------------------------------------------
def timeline_route():
    W, H = 320, 220
    CW, CH, VH = 5.0, 2.6, 4.2
    ox, oy = 75.0, 74.0
    ids_img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(ids_img)

    def P(x, y, z):
        return (ox + (x - y) * CW, oy + (x + y) * CH - z * VH)

    STEPS = 6
    boxes = []
    for i in range(STEPS):
        x0 = 2 + i * 7
        x1 = x0 + 6
        zb = -2
        zt = 1 + i * 3
        boxes.append((x0, x1, 0, 7, zb, zt, i == STEPS - 1))

    # Painter order: nearer (larger x + y) last.
    boxes.sort(key=lambda b: (b[0] + b[2], b[5]))
    for x0, x1, y0, y1, zb, zt, last in boxes:
        rc, lc, tc = (BRIGHT, BLEFT, BTOP) if last else (RIGHT, LEFT, TOP)
        d.polygon([P(x1, y0, zb), P(x1, y1, zb), P(x1, y1, zt), P(x1, y0, zt)], fill=rc)
        d.polygon([P(x0, y1, zb), P(x1, y1, zb), P(x1, y1, zt), P(x0, y1, zt)], fill=lc)
        top = [P(x0, y0, zt), P(x1, y0, zt), P(x1, y1, zt), P(x0, y1, zt)]
        d.polygon(top, fill=tc)
        d.line(top + [top[0]], fill=EDGE, width=1)

    # Dashed route across the terrace tops, one diamond station per step.
    centres = []
    for x0, x1, y0, y1, zb, zt, last in boxes:
        centres.append(P((x0 + x1) / 2, (y0 + y1) / 2, zt + 0.2))
    for (ax, ay), (bx, by) in zip(centres, centres[1:]):
        n = int(max(abs(bx - ax), abs(by - ay)) // 1)
        for k in range(0, n, 4):
            t0, t1 = k / n, min(k + 2, n) / n
            d.line([(ax + (bx - ax) * t0, ay + (by - ay) * t0), (ax + (bx - ax) * t1, ay + (by - ay) * t1)], fill=EDGE, width=1)
    for cx, cy in centres:
        d.polygon([(cx, cy - 3), (cx + 3, cy), (cx, cy + 3), (cx - 3, cy)], fill=EDGE)

    arr = np.array(ids_img)
    yy, xx = np.mgrid[0:H, 0:W]
    lx, ly = W * 0.30, H * 0.30
    dist = np.sqrt(((xx - lx) / (W * 0.6)) ** 2 + ((yy - ly) / (H * 0.7)) ** 2)
    inten = np.zeros((H, W))
    inten[arr == TOP] = np.clip(0.66 - 0.5 * dist, 0.1, 0.66)[arr == TOP]
    inten[arr == LEFT] = 0.46
    inten[arr == RIGHT] = 0.2
    inten[arr == BTOP] = 1.0
    inten[arr == BLEFT] = 0.72
    inten[arr == BRIGHT] = 0.42
    return dither(inten, arr)


# ---------------------------------------------------------------------------------------------
# 4. About page field: a dithered isometric plane with white block nodes joined by dashed conduit
#    lines ("how it connects"). Original drawing; reuses the islands face codes and shading.
# ---------------------------------------------------------------------------------------------
GROUND, GRID = 8, 9


def about_field():
    W, H = 360, 220
    CW, CH, VH = 11.0, 5.6, 7.2
    ox, oy = W / 2, 118.0

    def P(gx, gy, z):
        return (ox + (gx - gy) * CW, oy + (gx + gy) * CH - z * VH)

    # (gx, gy, height, kind): "b" = solid white block, "t" = thin dithered tower.
    nodes = [
        (-3, -2, 5, "b"), (-1, -4, 2, "t"), (1, -1, 9, "b"), (3, -3, 3, "t"),
        (-4, 1, 3, "t"), (-1, 2, 6, "b"), (2, 3, 2, "t"), (4, 0, 5, "b"),
    ]
    # Pairs of nodes joined by an L-shaped conduit along the ground plane.
    links = [(0, 2), (2, 1), (2, 5), (5, 6), (6, 7), (7, 3), (3, 2), (4, 0), (4, 5)]
    R = 4

    ids_img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(ids_img)

    # Ground plane: filled tiles, then tile outlines as a finer dithered grid.
    for gx in range(-R, R):
        for gy in range(-R, R):
            d.polygon([P(gx, gy, 0), P(gx + 1, gy, 0), P(gx + 1, gy + 1, 0), P(gx, gy + 1, 0)], fill=GROUND)
    for gx in range(-R, R + 1):
        d.line([P(gx, -R, 0), P(gx, R, 0)], fill=GRID, width=1)
    for gy in range(-R, R + 1):
        d.line([P(-R, gy, 0), P(R, gy, 0)], fill=GRID, width=1)

    # Dashed conduit lines: one dash pattern per link, routed x first, then y.
    def dashed(p0, p1, on=5, gap=3):
        (x0, y0), (x1, y1) = p0, p1
        L = max(((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5, 1e-6)
        step = on + gap
        k = 0
        while k * step < L:
            t0 = k * step / L
            t1 = min((k * step + on) / L, 1.0)
            d.line([(x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0), (x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1)],
                   fill=EDGE, width=1)
            k += 1

    for a, b in links:
        ax, ay = nodes[a][0], nodes[a][1]
        bx, by = nodes[b][0], nodes[b][1]
        dashed(P(ax, ay, 0), P(bx, ay, 0))
        dashed(P(bx, ay, 0), P(bx, by, 0))

    # A ring on the ground under each node: the node's "signal" footprint.
    for gx, gy, _, _ in nodes:
        pts = [P(gx + 0.9 * np.cos(t), gy + 0.9 * np.sin(t), 0) for t in np.linspace(0, 2 * np.pi, 48)]
        d.line(pts + [pts[0]], fill=EDGE, width=1)

    # Columns, painter order, same face logic as the islands.
    cols = [(gx, gy, 0, h, kind == "b") for gx, gy, h, kind in nodes]
    cols.sort(key=lambda c: (c[0] + c[1], c[3]))
    for gx, gy, zb, zt, boxed in cols:
        x, y = gx, gy
        rc, lc, tc = (BRIGHT, BLEFT, BTOP) if boxed else (RIGHT, LEFT, TOP)
        d.polygon([P(x + 1, y, zb), P(x + 1, y + 1, zb), P(x + 1, y + 1, zt), P(x + 1, y, zt)], fill=rc)
        d.polygon([P(x, y + 1, zb), P(x + 1, y + 1, zb), P(x + 1, y + 1, zt), P(x, y + 1, zt)], fill=lc)
        top = [P(x, y, zt), P(x + 1, y, zt), P(x + 1, y + 1, zt), P(x, y + 1, zt)]
        d.polygon(top, fill=tc)
        d.line(top + [top[0]], fill=EDGE, width=1)

    arr = np.array(ids_img)
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    # The plane fades out toward the edges, so the field melts into the page ground.
    fall = np.clip(1.0 - np.sqrt(((xx - W * 0.5) / (W * 0.5)) ** 2 + ((yy - H * 0.55) / (H * 0.6)) ** 2), 0, 1)
    inten = np.zeros((H, W))
    inten[arr == GROUND] = (0.22 * fall)[arr == GROUND]
    inten[arr == GRID] = (0.5 * fall)[arr == GRID]
    lx, ly = W * 0.42, H * 0.36
    dist = np.sqrt(((xx - lx) / (W * 0.55)) ** 2 + ((yy - ly) / (H * 0.6)) ** 2)
    inten[arr == TOP] = np.clip(0.62 - 0.5 * dist, 0.08, 0.62)[arr == TOP]
    inten[arr == LEFT] = 0.46
    inten[arr == RIGHT] = 0.2
    inten[arr == BTOP] = 1.0
    inten[arr == BLEFT] = 0.72
    inten[arr == BRIGHT] = 0.42
    return dither(inten, arr)


# ---------------------------------------------------------------------------------------------
# 4. History backdrop: a dithered isometric commit terrain. A square grid of voxel cells, each one a stretch of
#    work: the cells climb toward the top right where the latest commits sit. Original, deterministic.
# ---------------------------------------------------------------------------------------------
def history():
    W, H = 420, 220
    N = 16
    CW, CH, VH = 9.0, 4.4, 5.0
    ox, oy = W / 2, 34.0

    def P(x, y, z):
        return (ox + (x - y) * CW, oy + (x + y) * CH - z * VH)

    # Activity grows toward the newest corner (high x, low y); a sine term keeps it from looking like a ramp.
    heights = {}
    for x in range(N):
        for y in range(N):
            t = ((x + (N - 1 - y)) / (2 * (N - 1))) ** 1.7
            hgt = int(round(t * 7 + 1.2 * np.sin(x * 1.3 + y * 0.7) + 0.8 * np.sin(y * 2.1)))
            heights[(x, y)] = max(0, hgt)

    ids_img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(ids_img)
    order = sorted(heights.keys(), key=lambda k: (k[0] + k[1], heights[k]))
    for x, y in order:
        zt = heights[(x, y)]
        recent = (x + (N - 1 - y)) >= (2 * (N - 1)) * 0.78
        rc, lc, tc = (BRIGHT, BLEFT, BTOP) if recent else (RIGHT, LEFT, TOP)
        if zt > 0:
            d.polygon([P(x + 1, y, 0), P(x + 1, y + 1, 0), P(x + 1, y + 1, zt), P(x + 1, y, zt)], fill=rc)
            d.polygon([P(x, y + 1, 0), P(x + 1, y + 1, 0), P(x + 1, y + 1, zt), P(x, y + 1, zt)], fill=lc)
        d.polygon([P(x, y, zt), P(x + 1, y, zt), P(x + 1, y + 1, zt), P(x, y + 1, zt)], fill=tc)
        if zt > 0:
            # Thin edge on the top outline so each stacked cell reads as its own block.
            top = [P(x, y, zt), P(x + 1, y, zt), P(x + 1, y + 1, zt), P(x, y + 1, zt)]
            d.line(top + [top[0]], fill=EDGE, width=1)

    arr = np.array(ids_img)
    yy, xx = np.mgrid[0:H, 0:W]
    lx, ly = W * 0.8, H * 0.16
    dist = np.sqrt(((xx - lx) / (W * 0.6)) ** 2 + ((yy - ly) / (H * 0.8)) ** 2)
    inten = np.zeros((H, W))
    inten[arr == TOP] = np.clip(0.6 - 0.5 * dist, 0.05, 0.6)[arr == TOP]
    inten[arr == LEFT] = 0.42
    inten[arr == RIGHT] = 0.16
    inten[arr == BTOP] = 1.0
    inten[arr == BLEFT] = 0.7
    inten[arr == BRIGHT] = 0.38
    return dither(inten, arr)


# 4. Studies pathway (Studies page header): six voxel terraces climbing away to the upper right, one
#    per senior-year class, with a dotted trace running up to floating checkpoint blocks. Same
#    painter-order isometric method as the islands, over a faint dotted tracking grid.
# ---------------------------------------------------------------------------------------------
GRID = 8  # dotted tracking grid under the scene (dithered at half intensity)


def studies():
    W, H = 320, 200
    CW, CH, VH = 13.0, 6.5, 10.0
    heights = [1, 2, 3, 4, 5, 6]        # one terrace per class, each one voxel taller than the last
    tread = 2                           # treads are two cells wide (x), each step one cell deep (y)

    def P(x, y, z):
        return (x - y) * CW, (x + y) * CH - z * VH

    pts = []
    for i, h in enumerate(heights):
        for x in (0, tread):
            for y in (-i - 1, -i):
                for z in (0, h):
                    pts.append(P(x, y, z))
    for (x, y, z) in [(1, -7, 9), (1, -9, 10)]:
        for dx in (0, 1):
            for dy in (0, 1):
                pts.append(P(x + dx, y + dy, z + 1))
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    ox = W / 2 - (min(xs) + max(xs)) / 2
    oy = H / 2 - (min(ys) + max(ys)) / 2

    def Q(x, y, z):
        px, py = P(x, y, z)
        return (ox + px, oy + py)

    ids_img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(ids_img)

    # Dotted tracking grid on the ground plane, drawn first so the terraces cover it.
    for g in range(-1, 9, 2):
        d.line([Q(g, -11, 0), Q(g, 1, 0)], fill=GRID, width=1)
        d.line([Q(-1, g - 11, 0), Q(8, g - 11, 0)], fill=GRID, width=1)

    # Painter order: farthest first (smallest x + y), so nearer, shorter steps cover the taller ones behind.
    boxes = []
    for i, h in enumerate(heights):
        boxes.append((0, -i - 1, 0, tread, 1, h, i == len(heights) - 1))
    for (x, y, z) in [(1, -7, 9), (1, -9, 10)]:
        boxes.append((x, y, z, 1, 1, 1, True))
    boxes.sort(key=lambda b: b[0] + b[1])

    for (x, y, z0, w, dd, h, roof) in boxes:
        zt = z0 + h
        rc, lc, tc = (BRIGHT, BLEFT, BTOP) if roof else (RIGHT, LEFT, TOP)
        # +x face (right), +y face (left), then the top.
        d.polygon([Q(x + w, y, z0), Q(x + w, y + dd, z0), Q(x + w, y + dd, zt), Q(x + w, y, zt)], fill=rc)
        d.polygon([Q(x, y + dd, z0), Q(x + w, y + dd, z0), Q(x + w, y + dd, zt), Q(x, y + dd, zt)], fill=lc)
        top = [Q(x, y, zt), Q(x + w, y, zt), Q(x + w, y + dd, zt), Q(x, y + dd, zt)]
        d.polygon(top, fill=tc)
        if roof:
            d.line(top + [top[0]], fill=EDGE, width=1)

    # Dotted trace: one ink dot every other step, from the first tread up to the highest checkpoint.
    trace = [Q(tread / 2, -i - 0.5, h + 0.4) for i, h in enumerate(heights)]
    trace.append(Q(1.5, -8, 10.4))
    for (ax, ay), (bx, by) in zip(trace, trace[1:]):
        n = int(max(abs(bx - ax), abs(by - ay)) / 2.5)
        for s in range(n + 1):
            t = s / max(1, n)
            d.point((ax + (bx - ax) * t, ay + (by - ay) * t), fill=EDGE)

    arr = np.array(ids_img)
    yy, xx = np.mgrid[0:H, 0:W]
    lx, ly = W * 0.72, H * 0.22
    dist = np.sqrt(((xx - lx) / (W * 0.6)) ** 2 + ((yy - ly) / (H * 0.7)) ** 2)
    inten = np.zeros((H, W))
    inten[arr == TOP] = np.clip(0.7 - 0.55 * dist, 0.12, 0.7)[arr == TOP]
    inten[arr == LEFT] = 0.46
    inten[arr == RIGHT] = 0.18
    inten[arr == BTOP] = 1.0
    inten[arr == BLEFT] = 0.72
    inten[arr == BRIGHT] = 0.42
    inten[arr == GRID] = 0.34
    ink = dither(inten, arr)
    ink[arr == GRID] = ink[arr == GRID] & (((xx + yy) % 2) == 0)[arr == GRID]
    return ink


# ---------------------------------------------------------------------------------------------
# 4. Blog manuscript (blog index hero, and the post header with progress=True). Isometric voxels like islands():
#    a flat sheet, text lines rising off it (solid heading bar, dithered body bars), a block cursor at the end of
#    the last line, and small tiles drifting off the sheet. progress=True adds a reading strip along the front edge.
# ---------------------------------------------------------------------------------------------
SHEET, BODY, TILE = 8, 9, 10


def manuscript(seed=7, W=300, H=200, progress=False):
    rng = np.random.default_rng(seed)
    CW, CH, VH = 5.0, 2.6, 3.2
    ox, oy = W / 2 - 4, 40.0

    def P(x, y, z):
        return (ox + (x - y) * CW, oy + (x + y) * CH - z * VH)

    SX, SY = 20, 26
    cols = []  # (x, y, zb, zt, code)
    for x in range(SX):
        for y in range(SY):
            cols.append((x, y, 0, 1, SHEET))

    # Text lines: the first is a heading (solid bar), the rest are body bars with the odd gap and short last line.
    row, first = 3, True
    last = None
    while row < SY - 3:
        if not first and rng.random() < 0.16:
            row += 2
            continue
        if first:
            length = int(rng.integers(12, 16))
            for x in range(2, 2 + length):
                cols.append((x, row, 1, 3, BTOP))
            last = (2 + length, row)
        else:
            length = int(rng.integers(8, SX - 4))
            if rng.random() < 0.3:
                length = int(rng.integers(3, 6))
            for x in range(2, 2 + length):
                cols.append((x, row, 1, 2, BODY))
            last = (2 + length, row)
        first = False
        row += 2
    # Block cursor at the end of the last line.
    if last:
        cx, cy = last
        cols.append((cx, cy, 1, 5, BTOP))
        cols.append((cx + 1, cy, 1, 5, BTOP))

    # Drifting tiles: small lifted blocks above the sheet, a few in front of it.
    for _ in range(9):
        tx = int(rng.integers(-3, SX + 2))
        ty = int(rng.integers(-2, SY + 2))
        if 0 <= tx < SX and 0 <= ty < SY:
            continue
        z = int(rng.integers(3, 7))
        cols.append((tx, ty, z, z + 1, TILE))
        if rng.random() < 0.5:
            cols.append((tx + 1, ty, z, z + 1, TILE))
        if rng.random() < 0.35:
            cols.append((tx, ty, z + 1, z + 2, TILE))

    # Reading strip on the front edge (post header): filled part is solid, the rest is sheet.
    if progress:
        filled = int(SX * 0.42)
        for x in range(SX):
            code = BTOP if x < filled else SHEET
            cols.append((x, SY, 0, 1, code))

    cols.sort(key=lambda c: (c[0] + c[1], c[3]))
    ids_img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(ids_img)
    # Face codes per column kind: (right side, left side, top)
    faces = {
        SHEET: (RIGHT, LEFT, SHEET),
        BODY: (RIGHT, LEFT, BODY),
        TILE: (RIGHT, LEFT, TILE),
        BTOP: (BRIGHT, BLEFT, BTOP),
    }
    for x, y, zb, zt, code in cols:
        rc, lc, tc = faces[code]
        if zt > zb:
            d.polygon([P(x + 1, y, zb), P(x + 1, y + 1, zb), P(x + 1, y + 1, zt), P(x + 1, y, zt)], fill=rc)
            d.polygon([P(x, y + 1, zb), P(x + 1, y + 1, zb), P(x + 1, y + 1, zt), P(x, y + 1, zt)], fill=lc)
        top = [P(x, y, zt), P(x + 1, y, zt), P(x + 1, y + 1, zt), P(x, y + 1, zt)]
        d.polygon(top, fill=tc)
        if code in (BTOP, TILE):
            d.line(top + [top[0]], fill=EDGE, width=1)

    arr = np.array(ids_img)
    yy, xx = np.mgrid[0:H, 0:W]
    lx, ly = W * 0.4, H * 0.3
    dist = np.sqrt(((xx - lx) / (W * 0.6)) ** 2 + ((yy - ly) / (H * 0.7)) ** 2)
    inten = np.zeros((H, W))
    inten[arr == SHEET] = np.clip(0.13 - 0.1 * dist, 0.03, 0.13)[arr == SHEET]  # dark sheet, faint light from above-left
    inten[arr == RIGHT] = 0.16
    inten[arr == LEFT] = 0.34
    inten[arr == BODY] = np.clip(0.95 - 0.35 * dist, 0.55, 0.95)[arr == BODY]  # body bars read as dense ink
    inten[arr == TILE] = 0.36
    inten[arr == BTOP] = 1.0                                                   # solid heading bar and cursor
    inten[arr == BRIGHT] = 0.46
    inten[arr == BLEFT] = 0.74
    return dither(inten, arr)


# ---------------------------------------------------------------------------------------------
# 4. Assembly field (Creations hub backdrop). A dithered floor grid, a solid stepped build, two blocks still floating
#    above the floor on dotted drop lines, and two wireframe placeholders that are not built yet. Same isometric
#    projection and dither as the islands, so the set reads as one system.
# ---------------------------------------------------------------------------------------------
FLOOR = 8  # floor tile: top face only, very low ink


def assembly():
    W, H = 280, 170
    CW, CH, VH = 7.2, 3.6, 4.6
    ox, oy = W / 2, 22.0
    ids_img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(ids_img)
    inten_pts = []  # reserved for clarity; intensity is set per face code below

    def P(x, y, z):
        return (ox + (x - y) * CW, oy + (x + y) * CH - z * VH)

    def cube(x, y, z0, z1, kind):
        """Solid unit box from z0 to z1 (kind: FLOOR, TOP or BTOP). Painter order is handled by the caller's sort."""
        if kind == FLOOR:
            top = [P(x, y, z1), P(x + 1, y, z1), P(x + 1, y + 1, z1), P(x, y + 1, z1)]
            d.polygon(top, fill=FLOOR)
            return
        rc, lc, tc = (BRIGHT, BLEFT, BTOP) if kind == BTOP else (RIGHT, LEFT, TOP)
        d.polygon([P(x + 1, y, z0), P(x + 1, y + 1, z0), P(x + 1, y + 1, z1), P(x + 1, y, z1)], fill=rc)
        d.polygon([P(x, y + 1, z0), P(x + 1, y + 1, z0), P(x + 1, y + 1, z1), P(x, y + 1, z1)], fill=lc)
        top = [P(x, y, z1), P(x + 1, y, z1), P(x + 1, y + 1, z1), P(x, y + 1, z1)]
        d.polygon(top, fill=tc)
        d.line(top + [top[0]], fill=EDGE, width=1)

    def dashed(a, b, step=3):
        (x0, y0), (x1, y1) = a, b
        n = int(max(abs(x1 - x0), abs(y1 - y0)))
        for i in range(0, n + 1, step):
            t = i / max(1, n)
            d.point((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t), fill=EDGE)
            d.point((x0 + (x1 - x0) * t + 1, y0 + (y1 - y0) * t), fill=EDGE)

    def outline(x, y, z0, z1):
        """Wireframe placeholder: only the edges, nothing filled."""
        b = [P(x, y, z1), P(x + 1, y, z1), P(x + 1, y + 1, z1), P(x, y + 1, z1)]
        d.line(b + [b[0]], fill=EDGE, width=1)
        for cx, cy in [(x + 1, y), (x + 1, y + 1), (x, y + 1)]:
            d.line([P(cx, cy, z0), P(cx, cy, z1)], fill=EDGE, width=1)
        d.line([P(x + 1, y, z0), P(x + 1, y + 1, z0), P(x, y + 1, z0)], fill=EDGE, width=1)

    # 1) floor grid: flat tiles, painter order by x+y
    cells = [(x, y) for x in range(12) for y in range(12)]
    for x, y in sorted(cells, key=lambda c: c[0] + c[1]):
        cube(x, y, -1, 0, FLOOR)
    # grid seams every 7 tiles so the floor reads as a plan, not a blank plane
    for k in (0, 6, 12):
        d.line([P(k, 0, 0), P(k, 12, 0)], fill=EDGE, width=1)
        d.line([P(0, k, 0), P(12, k, 0)], fill=EDGE, width=1)

    # 2) the solid build: a stepped stack (three tiers) in the right half
    solid = []
    for x in range(8, 12):
        for y in range(5, 9):
            solid.append((x, y, 0, 1, BTOP))
    for x in range(9, 11):
        for y in range(6, 8):
            solid.append((x, y, 1, 2, BTOP))
    solid.append((9, 6, 2, 3, BTOP))
    # 3) two pieces still floating above the floor, on dotted drop lines
    floating = [(4, 10, 4, 5), (11, 11, 3, 4)]
    # 4) wireframe placeholders: planned, not built
    planned = [(2, 2, 0, 3), (5, 2, 0, 2)]

    for x, y, z0, z1 in planned:
        outline(x, y, z0, z1)
    for x, y, z0, z1 in floating:
        dashed(P(x + 0.5, y + 0.5, 0), P(x + 0.5, y + 0.5, z0))
    items = [(x + y, z0, x, y, z0, z1, BTOP) for x, y, z0, z1, _ in solid] + [
        (x + y, z0, x, y, z0, z1, TOP) for x, y, z0, z1 in floating
    ]
    for _, _, x, y, z0, z1, kind in sorted(items, key=lambda t: (t[0], t[1])):
        cube(x, y, z0, z1, kind)

    arr = np.array(ids_img)
    yy, xx = np.mgrid[0:H, 0:W]
    lx, ly = W * 0.6, H * 0.3
    dist = np.sqrt(((xx - lx) / (W * 0.6)) ** 2 + ((yy - ly) / (H * 0.7)) ** 2)
    inten = np.zeros((H, W))
    inten[arr == FLOOR] = 0.10
    inten[arr == TOP] = np.clip(0.55 - 0.4 * dist, 0.1, 0.55)[arr == TOP]
    inten[arr == LEFT] = 0.42
    inten[arr == RIGHT] = 0.18
    inten[arr == BTOP] = 1.0
    inten[arr == BLEFT] = 0.7
    inten[arr == BRIGHT] = 0.4
    ink = dither(inten, arr)
    # Fill the floor tiles with a sparse dot lattice so the plan reads even though the floor is so dim.
    yy2, xx2 = np.mgrid[0:H, 0:W]
    lattice = (xx2 % 6 == 0) & (yy2 % 6 == 0) & (arr == FLOOR)
    ink[lattice] = True
    return ink


# 9. Full-bleed page backdrops, one per page. A dithered topographic field: a fractal height map lit from
#    the upper left, with solid contour lines that fade into the dither. Ink is pushed toward one side of the
#    frame (the side without body copy), so the reading column stays clear. Placed by <NaosBackdrop>.
# ---------------------------------------------------------------------------------------------
BG_W, BG_H = 720, 480  # drawn at 2 css px per art pixel on desktop; covers the whole page


def _fractal(rng, W, H, octaves=5, base=3):
    h = np.zeros((H, W))
    amp, cells = 1.0, base
    for _ in range(octaves):
        g = rng.random((cells + 1, cells + 1))
        img = Image.fromarray((g * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
        h += amp * (np.asarray(img, dtype=float) / 255.0)
        amp *= 0.5
        cells *= 2
    return (h - h.min()) / (h.max() - h.min())


def _shape(h, style, steps):
    """Turn the fractal height map into one of three landforms, so pages differ in more than their seed."""
    if style == "ridge":                     # sharp crests, like a folded range
        h = 1 - np.abs(2 * h - 1)
        return (h - h.min()) / (h.max() - h.min())
    if style == "terrace":                   # flat plateaus with thin risers, the voxel stepping in smooth form
        q = np.floor(h * steps)
        frac = h * steps - q
        h = (q + 0.12 * frac) / steps
        return (h - h.min()) / (h.max() - h.min())
    return h                                 # "terrain": the rolling default


def backdrop(seed, side="right", base=3, contours=12, style="terrain", angle=135, steps=6, cover=0.3):
    rng = np.random.default_rng(seed)
    h = _shape(_fractal(rng, BG_W, BG_H, base=base), style, steps)
    gy, gx = np.gradient(h)
    t = np.deg2rad(angle)                    # light direction; 135 is the upper left
    slope = -(gx * np.cos(t) + gy * np.sin(t))
    slope = slope / (np.percentile(np.abs(slope), 98) + 1e-9)
    # Lit slopes carry the dither, shadowed slopes stay mostly empty, so the field reads as light on terrain.
    if style == "terrace":                   # flat tops take a light dither; the risers catch the most light
        inten = 0.14 + np.clip(slope, 0, 1) ** 1.2 * 0.8
    else:
        inten = np.clip(0.5 + 0.5 * slope, 0, 1) ** 2 * 0.8

    # Ink reaches across the whole frame; the open side is denser so the copy side stays calmer.
    xn = np.linspace(0, 1, BG_W)[None, :].repeat(BG_H, 0)
    yn = np.linspace(0, 1, BG_H)[:, None].repeat(BG_W, 1)
    if side == "left":
        xn = 1 - xn
    keep = cover + (1 - cover) * np.clip(0.25 + 0.75 * (0.8 * xn + 0.45 * yn), 0, 1) ** 1.4

    # Contour lines: a band edge wherever the quantised height changes between neighbours.
    band = np.floor(h * contours)
    edge = (band != np.roll(band, 1, axis=1)) | (band != np.roll(band, 1, axis=0))
    edge_ink = edge & (keep > rng.random((BG_H, BG_W)))

    ids = np.ones((BG_H, BG_W), dtype=np.uint8)
    field = dither(inten * keep, ids)
    return field | edge_ink


# One unique look per page: its own seed, landform, light and side. Subpages reuse their section's piece.
BACKDROPS = {
    "home": dict(seed=11, side="right", base=3, contours=7, style="terrain", angle=135),
    "studies": dict(seed=23, side="right", base=3, contours=8, style="terrace", steps=7, angle=120),
    "about": dict(seed=37, side="right", base=4, contours=8, style="ridge", angle=200),
    "history": dict(seed=41, side="right", base=5, contours=10, style="terrain", angle=60),
    "timeline": dict(seed=53, side="right", base=2, contours=5, style="terrace", steps=5, angle=225),
    "blog": dict(seed=67, side="right", base=5, contours=6, style="ridge", angle=300),
    "games": dict(seed=79, side="right", base=2, contours=12, style="terrain", angle=45),
    "default": dict(seed=97, side="right", base=3, contours=7, style="terrain", angle=110),
}


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    save_1bit(islands(), os.path.join(OUT, "islands.png"))
    save_1bit(track(), os.path.join(OUT, "track.png"))
    save_1bit(wash(), os.path.join(OUT, "wash.png"))
    save_1bit(assembly(), os.path.join(OUT, "assembly.png"))
    save_1bit(about_field(), os.path.join(OUT, "about-field.png"))
    save_1bit(timeline_route(), os.path.join(OUT, "timeline-route.png"))
    save_1bit(history(), os.path.join(OUT, "history.png"))




    save_1bit(studies(), os.path.join(OUT, "studies.png"))
    save_1bit(manuscript(seed=7), os.path.join(OUT, "blog.png"))
    save_1bit(manuscript(seed=21, progress=True), os.path.join(OUT, "post.png"))
    for name, cfg in BACKDROPS.items():
        save_1bit(backdrop(**cfg), os.path.join(OUT, f"bg-{name}.png"))
