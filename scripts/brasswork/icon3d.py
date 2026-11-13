"""Tiny orthographic 3D painter for the Brasswork 64 px icons.

Items are built from a few solids (boxes, frustums, cylinders, extruded outlines, faceted rocks), viewed from the same
three-quarter camera the game uses (yaw -35 deg, looking down 28 deg), lit from the top-left, and painted face by face
with the naOS dither kit (scripts/naos-art/nodefarm_icon_kit.py): each face gets a lambert shade that is quantised to a
palette ramp through a Bayer threshold, so every icon reads as dithered pixel art with consistent lighting.
"""
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "naos-art"))
import nodefarm_icon_kit as K  # noqa: E402
from nodefarm_icon_kit import P, X, Y, lin, poly  # noqa: E402,F401

YAW = math.radians(-35)
PITCH = math.radians(28)
LIGHT = np.array([-0.5, 0.78, 0.42])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


def view(v):
    """World (x right, y up, z toward the viewer) to view space (x right, y up, z toward the viewer)."""
    x, y, z = v
    x1 = x * math.cos(YAW) + z * math.sin(YAW)
    z1 = -x * math.sin(YAW) + z * math.cos(YAW)
    y2 = y * math.cos(PITCH) - z1 * math.sin(PITCH)
    z2 = y * math.sin(PITCH) + z1 * math.cos(PITCH)
    return np.array([x1, y2, z2])


class Scene:
    """Collects faces in world units, then paints them back to front onto a kit Canvas."""

    def __init__(self, cx=32, cy=38, s=1.0):
        self.cx, self.cy, self.s = cx, cy, s
        self.faces = []  # (group, depth, pts2d, shade, pal, tag)
        self.group = 0  # solids paint in the order they are added; faces inside one solid sort back to front

    def to2d(self, v):
        w = view(v)
        return (self.cx + w[0] * self.s, self.cy - w[1] * self.s, w[2])

    def face(self, pts, pal, v=0.0, two_sided=False, flat=None, tag=None, out=None):
        """One planar polygon. `out` is a point inside the solid: the normal is turned to face away from it, so winding
        never matters for closed solids."""
        pts = [np.asarray(p, float) for p in pts]
        cen = sum(pts) / len(pts)
        n = np.zeros(3)
        for i in range(len(pts)):  # Newell normal, robust for any planar polygon
            a, b = pts[i], pts[(i + 1) % len(pts)]
            n += np.array([(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])])
        ln = np.linalg.norm(n)
        if ln < 1e-9:
            return
        n = n / ln
        if out is not None and n @ (cen - np.asarray(out, float)) < 0:
            n = -n
        nv = view(n)
        if nv[2] <= 1e-4:
            if not two_sided:
                return
            nv = -nv
        shade = flat if flat is not None else 0.18 + 0.82 * max(0.0, float(nv @ LIGHT))
        p2 = [self.to2d(p) for p in pts]
        depth = sum(q[2] for q in p2) / len(p2)
        self.faces.append((self.group, depth, [(q[0], q[1]) for q in p2], shade + v, pal, tag))

    # ------------------------------------------------------------ solids
    def box(self, x0, x1, y0, y1, z0, z1, pal, v=0.0, tag=None):
        self.group += 1
        c = [(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
        ctr = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
        q = lambda a, b, cc, d: self.face([c[a], c[b], c[cc], c[d]], pal, v, tag=tag, out=ctr)  # noqa: E731
        # index = xi*4 + yi*2 + zi ; counter-clockwise seen from outside
        q(0, 1, 3, 2)  # x0
        q(4, 6, 7, 5)  # x1
        q(0, 4, 5, 1)  # y0
        q(2, 3, 7, 6)  # y1
        q(0, 2, 6, 4)  # z0
        q(1, 5, 7, 3)  # z1

    def prism(self, bottom, top, pal, v=0.0, caps=True, tag=None):
        """Faces between two rings of points (same count, bottom ring counter-clockwise from above)."""
        self.group += 1
        n = len(bottom)
        ctr = (sum(np.asarray(p, float) for p in bottom) + sum(np.asarray(p, float) for p in top)) / (2 * n)
        for i in range(n):
            j = (i + 1) % n
            self.face([bottom[i], bottom[j], top[j], top[i]], pal, v, tag=tag, out=ctr)
        if caps:
            self.face(list(bottom), pal, v, tag=tag, out=ctr)
            self.face(list(top), pal, v, tag=tag, out=ctr)

    def frustum(self, w0, d0, w1, d1, h, pal, v=0.0, y=0.0, tag=None):
        b = [(-w0, y, d0), (w0, y, d0), (w0, y, -d0), (-w0, y, -d0)]
        t = [(-w1, y + h, d1), (w1, y + h, d1), (w1, y + h, -d1), (-w1, y + h, -d1)]
        # ring above must run counter-clockwise seen from above: (x,z) order (-,+),(+,+),(+,-),(-,-) is clockwise from
        # above with z toward the viewer, so reverse
        self.prism(b[::-1], t[::-1], pal, v, tag=tag)

    def extrude(self, outline, depth, pal, v=0.0, frame=None, cap_pal=None, tag=None, holes=()):
        """Extrude a 2D outline (u, w) along the local n axis from 0 to depth. frame = (origin, U, W, N) maps local to
        world. Caps are drawn as polygons (holes are cut by painting them afterwards in the hole colour)."""
        self.group += 1
        o, U, W, Nn = frame if frame else ((0, 0, 0), (1, 0, 0), (0, 1, 0), (0, 0, 1))
        o, U, W, Nn = map(np.asarray, (o, U, W, Nn))
        P3 = lambda u, w, n: o + U * u + W * w + Nn * n  # noqa: E731
        ring0 = [P3(u, w, 0) for u, w in outline]
        ring1 = [P3(u, w, depth) for u, w in outline]
        m = len(outline)
        for i in range(m):
            j = (i + 1) % m
            self.face([ring0[i], ring0[j], ring1[j], ring1[i]], pal, v, two_sided=True, tag=tag)
        self.face(ring1, cap_pal or pal, v, two_sided=True, tag=tag)
        for hole in holes:
            h1 = [P3(u, w, depth) for u, w in hole]
            for i in range(len(hole)):
                j = (i + 1) % len(hole)
                self.face([P3(*hole[i], 0), P3(*hole[j], 0), h1[j], h1[i]], pal, v - 0.15, two_sided=True, tag=tag)

    def cylinder(self, a, b, r, pal, v=0.0, n=18, caps=True, r2=None, tag=None):
        """Cylinder (or cone frustum with r2) from point a to point b."""
        self.group += 1
        a, b = np.asarray(a, float), np.asarray(b, float)
        ax = b - a
        ax = ax / np.linalg.norm(ax)
        t = np.array([0, 1, 0]) if abs(ax[1]) < 0.9 else np.array([1, 0, 0])
        u = np.cross(ax, t)
        u /= np.linalg.norm(u)
        w = np.cross(ax, u)
        r2 = r if r2 is None else r2
        ring_a = [a + (u * math.cos(2 * math.pi * k / n) + w * math.sin(2 * math.pi * k / n)) * r for k in range(n)]
        ring_b = [b + (u * math.cos(2 * math.pi * k / n) + w * math.sin(2 * math.pi * k / n)) * r2 for k in range(n)]
        mid = (a + b) / 2
        for i in range(n):
            j = (i + 1) % n
            self.face([ring_a[i], ring_a[j], ring_b[j], ring_b[i]], pal, v, tag=tag, out=mid)
        if caps:
            self.face(ring_b, pal, v, tag=tag, out=mid)
            self.face(ring_a, pal, v, tag=tag, out=mid)

    def rock(self, c, r, pal, seed, squash=0.75, jitter=0.22, v=0.0, tag=None):
        """Faceted rock: an icosahedron with jittered radii, flattened."""
        self.group += 1
        rng = np.random.default_rng(seed)
        g = (1 + 5 ** 0.5) / 2
        vs = np.array([(-1, g, 0), (1, g, 0), (-1, -g, 0), (1, -g, 0), (0, -1, g), (0, 1, g), (0, -1, -g), (0, 1, -g),
                       (g, 0, -1), (g, 0, 1), (-g, 0, -1), (-g, 0, 1)], float)
        vs /= np.linalg.norm(vs[0])
        fs = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6),
              (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10),
              (8, 6, 7), (9, 8, 1)]
        rad = 1 + rng.uniform(-jitter, jitter, len(vs))
        pts = [np.asarray(c) + vv * rr * r * np.array([1.0, squash, 1.0]) for vv, rr in zip(vs, rad)]
        for f in fs:
            self.face([pts[f[0]], pts[f[1]], pts[f[2]]], pal, v + rng.uniform(-0.06, 0.06), tag=tag, out=c)
        return pts

    # ------------------------------------------------------------ paint
    def paint(self, c, dither=0.9):
        """Paint faces back to front. Returns dict tag -> union mask of that tag's painted faces."""
        tags = {}
        for _, depth, pts, shade, pal, tag in sorted(self.faces, key=lambda f: (f[0], f[1])):
            m = poly(pts)
            if not m.any():
                continue
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            g = 0.08 * (1 - lin(min(xs), min(ys), max(xs), max(ys)))
            c.fill(m, np.clip(shade + g, 0, 1), pal, dither=dither)
            if tag:
                tags[tag] = tags.get(tag, np.zeros_like(m)) | m
        return tags

    def pt(self, v):
        x, y, _ = self.to2d(v)
        return (x, y)
