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



if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    save_1bit(islands(), os.path.join(OUT, "islands.png"))
    save_1bit(track(), os.path.join(OUT, "track.png"))
    save_1bit(wash(), os.path.join(OUT, "wash.png"))
    save_1bit(assembly(), os.path.join(OUT, "assembly.png"))
