"""Groundbreak art kit: palette ramps, a Bayer-dithered canvas of any size, and a small 3D face painter.

Same technique as the naOS / Brasswork kits (lambert shade per face, quantised to a hue-shifted ramp through an 8x8
Bayer threshold), but with its own golden-hour construction-site palette and canvases larger than 64 px, so buildings
and backdrops can be authored big enough to hold up when the scene is zoomed.
"""
import math

import numpy as np
from PIL import Image, ImageDraw


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def ramp(*cols):
    return [hexc(c) for c in cols]


# ---------------------------------------------------------------- palette (dark -> light; shadows violet, lights amber)
P = {
    "ink": ramp("#0b0910", "#16121c", "#231c2a"),
    "concrete": ramp("#1c1820", "#2e2a30", "#46403f", "#5f5852", "#7c7469", "#9c9384", "#bfb4a0", "#e4d8c0"),
    "cement": ramp("#24222a", "#3c3a42", "#5a5860", "#7c7a80", "#a19ea0", "#c6c2bc", "#ece6dc"),
    "gravel": ramp("#1a1414", "#30261f", "#4a3b2f", "#685442", "#8a7058", "#ab8f72", "#ccb292", "#ecdcc0"),
    "sand": ramp("#2c1c10", "#523418", "#7c5226", "#a67236", "#c9944c", "#e2b468", "#f4d494", "#fff0cc"),
    "dirt": ramp("#140c0c", "#261612", "#3c2418", "#55341f", "#704628", "#8c5c34", "#ab7a48"),
    "rebar": ramp("#1c0a08", "#3a140c", "#6a2412", "#963818", "#bc5424", "#d8763a", "#eea062"),
    "steel": ramp("#10121c", "#1e2232", "#2e3448", "#43495e", "#5c6276", "#7c8090", "#a4a4b0", "#d4d0d0"),
    "glass": ramp("#0e1024", "#1a1e40", "#2a305e", "#3e4a80", "#5a6aa0", "#8a90bc", "#c4bcd4", "#fde4c8"),
    "sunglass": ramp("#3a1a2c", "#6a2a3a", "#a8443c", "#dc6c3c", "#f89a48", "#ffc66c", "#ffe8a8"),
    "copper": ramp("#1e0a08", "#401610", "#72281a", "#a64424", "#d0682e", "#ee9046", "#ffbc70", "#ffe2b0"),
    "duct": ramp("#1a1a22", "#2c2e38", "#444852", "#60666e", "#848a90", "#aeb2b2", "#dcdcd4"),
    "precast": ramp("#2a201e", "#463630", "#664f44", "#88705e", "#a8907a", "#c6ae94", "#e2ceb2"),
    "hiviz": ramp("#2a1404", "#5a2e06", "#9a5208", "#d27c0c", "#f4a414", "#ffc838", "#ffe27c", "#fff6c8"),
    "safety": ramp("#2c0806", "#5e120a", "#9a2410", "#d03c18", "#ee6428", "#ff9452"),
    "green": ramp("#0c1410", "#16241a", "#223824", "#304e2c", "#446a34", "#5e8a3e", "#86a852"),
    "brick": ramp("#1e0a0c", "#3c1414", "#62221c", "#863424", "#a64a30", "#c26842", "#da8c5e"),
    "roof": ramp("#121018", "#1e1a26", "#2c2634", "#3c3444", "#4e4456", "#665a6a"),
    "wood": ramp("#1a0e08", "#36200e", "#5a3618", "#7c4e22", "#9c6a32", "#bc8a48", "#d8ac6a"),
    "water": ramp("#0e0c22", "#1c1838", "#2c2650", "#40386a", "#5c4c80", "#8a6890", "#c88a8a", "#f6b47c"),
    "lamp": ramp("#5a2406", "#a8460c", "#e8781c", "#ffa83a", "#ffd070", "#fff0b8", "#fffbe8"),
    "cash": ramp("#0e1a0c", "#1c3214", "#2e5018", "#467020", "#64922c", "#8ab43e", "#bcd870", "#eef8c0"),
    "rep": ramp("#2a1404", "#5a2e06", "#9a5a08", "#d48c10", "#f4b424", "#ffd458", "#fff0a8"),
    "charter": ramp("#14081e", "#2a1040", "#481c64", "#6c2c86", "#9446a4", "#bc6cbc", "#e09cd0", "#ffd8ec"),
    "skin": ramp("#2a140e", "#4e2618", "#7a3e26", "#a25a36", "#c27c4c", "#dca070"),
    "white": ramp("#5e5868", "#9a94a0", "#d4ccc8", "#fff6ea"),
    # sky (top -> horizon)
    "sky": ramp("#120c24", "#1e1234", "#2e1840", "#44204a", "#5e2a50", "#7e3650", "#a2464c", "#c45c44", "#e07c40",
                "#f29e48", "#fcc062", "#ffdc8a"),
    "haze": ramp("#2a1834", "#3e2240", "#58304a", "#764050", "#985454", "#b86c58"),
}

_B8 = np.array([[0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26], [12, 44, 4, 36, 14, 46, 6, 38],
                [60, 28, 52, 20, 62, 30, 54, 22], [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
                [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]], float) / 64 - 0.5


class Canvas:
    """RGBA canvas of any size. Masks are boolean arrays of the same (H, W)."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.img = np.zeros((h, w, 4), np.uint8)
        self.B = np.tile(_B8, (h // 8 + 1, w // 8 + 1))[:h, :w]
        yy, xx = np.mgrid[0:h, 0:w].astype(float)
        self.X, self.Y = xx + 0.5, yy + 0.5

    # shapes
    def poly(self, pts, ss=3):
        im = Image.new("L", (self.w * ss, self.h * ss), 0)
        ImageDraw.Draw(im).polygon([(x * ss, y * ss) for x, y in pts], fill=255)
        return np.asarray(im.resize((self.w, self.h), Image.BOX)) >= 128

    def rect(self, x0, y0, x1, y1):
        return (self.X >= x0) & (self.X < x1) & (self.Y >= y0) & (self.Y < y1)

    def disc(self, cx, cy, r, ry=None):
        ry = r if ry is None else ry
        return ((self.X - cx) / r) ** 2 + ((self.Y - cy) / ry) ** 2 <= 1

    def line(self, x0, y0, x1, y1, w=1.0):
        dx, dy = x1 - x0, y1 - y0
        L2 = dx * dx + dy * dy or 1e-9
        t = np.clip(((self.X - x0) * dx + (self.Y - y0) * dy) / L2, 0, 1)
        return np.hypot(self.X - (x0 + t * dx), self.Y - (y0 + t * dy)) <= w / 2

    # paint
    def fill(self, mask, v, pal, dither=0.9, a=255):
        r = P[pal] if isinstance(pal, str) else pal
        v = np.broadcast_to(np.asarray(v, float), (self.h, self.w))
        idx = np.clip(np.floor(v * (len(r) - 1) + 0.5 + self.B * dither), 0, len(r) - 1).astype(int)
        for i, c in enumerate(r):
            m = mask & (idx == i)
            self.img[m] = (*c, a)
        return self

    def set(self, mask, col, a=255):
        if isinstance(col, tuple) and isinstance(col[0], str):
            col = P[col[0]][col[1]]
        self.img[mask] = (*col, a)
        return self

    def thin(self, mask, col, frac=0.5, a=255):
        """Dithered partial coverage (for haze, dust, glow)."""
        return self.set(mask & (self.B < frac - 0.5), col, a)

    def grow(self, m, r=1):
        out = m.copy()
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                out |= np.roll(np.roll(m, dy, 0), dx, 1)
        return out

    def outline(self, col=(11, 9, 16)):
        solid = self.img[..., 3] >= 200
        ring = self.grow(solid, 1) & ~solid
        self.img[ring & (self.img[..., 3] < 200)] = (*col, 255)
        return self

    def over(self, other, x=0, y=0):
        """Alpha-composite another canvas (or RGBA array) at (x, y)."""
        src = other.img if isinstance(other, Canvas) else other
        h, w = src.shape[:2]
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(self.w, x + w), min(self.h, y + h)
        if x1 <= x0 or y1 <= y0:
            return self
        s = src[y0 - y:y1 - y, x0 - x:x1 - x].astype(float)
        d = self.img[y0:y1, x0:x1].astype(float)
        a = s[..., 3:4] / 255
        d[..., :3] = s[..., :3] * a + d[..., :3] * (1 - a)
        d[..., 3:4] = np.maximum(d[..., 3:4], s[..., 3:4])
        self.img[y0:y1, x0:x1] = d.astype(np.uint8)
        return self

    def image(self):
        return Image.fromarray(self.img, "RGBA")


# ---------------------------------------------------------------- 3D face painter (orthographic)
LIGHT = np.array([-0.62, 0.62, 0.48])  # low golden-hour sun from the left
LIGHT = LIGHT / np.linalg.norm(LIGHT)


class Scene:
    def __init__(self, cx, cy, s, yaw=-28, pitch=14):
        self.cx, self.cy, self.s = cx, cy, s
        self.yaw, self.pitch = math.radians(yaw), math.radians(pitch)
        self.faces = []
        self.group = 0
        self.order = 0

    def view(self, v):
        x, y, z = v
        cy_, sy = math.cos(self.yaw), math.sin(self.yaw)
        cp, sp = math.cos(self.pitch), math.sin(self.pitch)
        x1 = x * cy_ + z * sy
        z1 = -x * sy + z * cy_
        return np.array([x1, y * cp - z1 * sp, y * sp + z1 * cp])

    def to2d(self, v):
        w = self.view(v)
        return (self.cx + w[0] * self.s, self.cy - w[1] * self.s, w[2])

    def pt(self, v):
        x, y, _ = self.to2d(v)
        return (x, y)

    def face(self, pts, pal, v=0.0, out=None, two_sided=False, flat=None, glow=None):
        pts = [np.asarray(p, float) for p in pts]
        cen = sum(pts) / len(pts)
        n = np.zeros(3)
        for i in range(len(pts)):
            a, b = pts[i], pts[(i + 1) % len(pts)]
            n += np.array([(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])])
        ln = np.linalg.norm(n)
        if ln < 1e-9:
            return
        n /= ln
        if out is not None and n @ (cen - np.asarray(out, float)) < 0:
            n = -n
        nv = self.view(n)
        if nv[2] <= 1e-4:
            if not two_sided:
                return
            nv = -nv
            n = -n
        shade = flat if flat is not None else 0.16 + 0.84 * max(0.0, float(n @ LIGHT))
        p2 = [self.to2d(p) for p in pts]
        depth = sum(q[2] for q in p2) / len(p2)
        self.order += 1
        self.faces.append((self.group, depth, self.order, [(q[0], q[1]) for q in p2], shade + v, pal, glow))

    def box(self, x0, x1, y0, y1, z0, z1, pal, v=0.0, top=None, front=None):
        """Axis box. top / front override the palette of the +y / +z faces (e.g. a slab edge in another colour)."""
        self.group += 1
        c = [(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
        ctr = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
        q = lambda a, b, cc, d, p=pal: self.face([c[a], c[b], c[cc], c[d]], p, v, out=ctr)  # noqa: E731
        q(0, 1, 3, 2)
        q(4, 6, 7, 5)
        q(0, 4, 5, 1)
        q(2, 3, 7, 6, top or pal)
        q(0, 2, 6, 4)
        q(1, 5, 7, 3, front or pal)

    def cylinder(self, a, b, r, pal, v=0.0, n=14, r2=None):
        self.group += 1
        a, b = np.asarray(a, float), np.asarray(b, float)
        ax = (b - a) / np.linalg.norm(b - a)
        t = np.array([0, 1, 0]) if abs(ax[1]) < 0.9 else np.array([1, 0, 0])
        u = np.cross(ax, t)
        u /= np.linalg.norm(u)
        w = np.cross(ax, u)
        r2 = r if r2 is None else r2
        ra = [a + (u * math.cos(2 * math.pi * k / n) + w * math.sin(2 * math.pi * k / n)) * r for k in range(n)]
        rb = [b + (u * math.cos(2 * math.pi * k / n) + w * math.sin(2 * math.pi * k / n)) * r2 for k in range(n)]
        mid = (a + b) / 2
        for i in range(n):
            j = (i + 1) % n
            self.face([ra[i], ra[j], rb[j], rb[i]], pal, v, out=mid)
        self.face(rb, pal, v, out=mid)
        self.face(ra, pal, v, out=mid)

    def beam(self, a, b, t, pal, v=0.0):
        """Square-section member from a to b (thickness t), for frames, trusses and cables."""
        a, b = np.asarray(a, float), np.asarray(b, float)
        if abs(a[0] - b[0]) < 1e-6 and abs(a[2] - b[2]) < 1e-6 or \
                abs(a[1] - b[1]) < 1e-6 and (abs(a[0] - b[0]) < 1e-6 or abs(a[2] - b[2]) < 1e-6):
            lo, hi = np.minimum(a, b) - t / 2, np.maximum(a, b) + t / 2
            self.box(lo[0], hi[0], lo[1], hi[1], lo[2], hi[2], pal, v)
        else:
            self.cylinder(a, b, t / 2, pal, v, n=4)

    def paint(self, c, dither=0.9, sort="group"):
        """Paint faces. sort='group' paints solids in insertion order (faces inside a solid back to front);
        sort='depth' sorts every face by depth (for scenes of many separate small solids)."""
        key = (lambda f: (f[0], f[1])) if sort == "group" else (lambda f: (f[1], f[0], f[2]))
        for _, _, _, pts, shade, pal, glow in sorted(self.faces, key=key):
            m = c.poly(pts)
            if not m.any():
                continue
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            h = max(1.0, max(ys) - min(ys))
            g = 0.07 * (1 - np.clip((c.Y - min(ys)) / h, 0, 1))  # faint top-lit gradient per face
            c.fill(m, np.clip(shade + g, 0, 1), pal, dither=dither)
        self.faces = []
        return c


def save_pair(img, stem):
    img.save(f"{stem}.png", optimize=True)
    img.save(f"{stem}.webp", lossless=True, quality=100, method=6)


def rock(sc, c, r, pal, seed, squash=0.75, jitter=0.22, v=0.0):
    """Faceted rock (jittered icosahedron) added to Scene sc."""
    sc.group += 1
    rng = np.random.default_rng(seed)
    g = (1 + 5 ** 0.5) / 2
    vs = np.array([(-1, g, 0), (1, g, 0), (-1, -g, 0), (1, -g, 0), (0, -1, g), (0, 1, g), (0, -1, -g), (0, 1, -g),
                   (g, 0, -1), (g, 0, 1), (-g, 0, -1), (-g, 0, 1)], float)
    vs /= np.linalg.norm(vs[0])
    fs = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6),
          (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10),
          (8, 6, 7), (9, 8, 1)]
    rad = 1 + rng.uniform(-jitter, jitter, len(vs))
    pts = [np.asarray(c, float) + vv * rr * r * np.array([1.0, squash, 1.0]) for vv, rr in zip(vs, rad)]
    for f in fs:
        sc.face([pts[f[0]], pts[f[1]], pts[f[2]]], pal, v + rng.uniform(-0.07, 0.07), out=c)
