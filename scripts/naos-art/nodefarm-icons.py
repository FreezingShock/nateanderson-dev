"""Node Farm icon sheet: 32 x 32 original pixel-dither sprites in colour, one row, written to public/naos/nodefarm/icons.{png,webp}.

Every icon is built from flat shapes shaded with a gradient that is quantised to a 5-step colour ramp through a Bayer 4x4
threshold, so the shading reads as dither, not as smooth colour. Run: python3 scripts/naos-art/nodefarm-icons.py
Order of the cells is ICONS below; the React side (components/nodefarm/icon.tsx) uses the same order.
"""
import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

N = 32
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 - 0.5


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def ramp(*cols):
    return [hexc(c) for c in cols]


# dark -> light, five steps each
RAMPS = {
    "cyan": ramp("#06202a", "#0b5a6b", "#1796aa", "#2fd8e8", "#c9fbff"),
    "lime": ramp("#14230a", "#3a6112", "#74a81f", "#b6f04a", "#efffc2"),
    "mag": ramp("#2b0517", "#7d0f45", "#c41c6c", "#ff2d8a", "#ffc2de"),
    "cu": ramp("#2b1306", "#7a3412", "#c2611f", "#f08a3c", "#ffd9a8"),
    "si": ramp("#0e1430", "#2b3f8a", "#4f72d8", "#7aa2ff", "#d6e4ff"),
    "qz": ramp("#25083a", "#6a1f95", "#a64ed0", "#e08cff", "#f9dcff"),
    "ae": ramp("#04261d", "#0f6b52", "#25b88b", "#6bffc9", "#e0fff4"),
    "wh": ramp("#1a1f22", "#4a555b", "#8b979d", "#d9e1e4", "#ffffff"),
    "rn": ramp("#2a1c04", "#7a5a0c", "#c28f16", "#ffc53a", "#fff0b8"),
    "sg": ramp("#102532", "#3a6a84", "#7cb4d2", "#bfeaff", "#f4fcff"),
    "vs": ramp("#0c0818", "#2a1f55", "#5d46b0", "#9a7bff", "#e0d4ff"),
    "ch": ramp("#2b0f05", "#7a2a10", "#c9501f", "#ff7a4a", "#ffd8b8"),
    "nb": ramp("#2a0a22", "#7a1f62", "#c94aa3", "#ff8ad8", "#ffe0f4"),
    "pu": ramp("#061f2a", "#0f5a74", "#2aa6c8", "#64e6ff", "#e0faff"),
    "sn": ramp("#2a1504", "#7a3f0a", "#c97418", "#ffb14a", "#fff0cc"),
    "eg": ramp("#24160b", "#6b4424", "#b07a4a", "#e8b98a", "#fff0dc"),
    "px": ramp("#15161f", "#454a63", "#8a90ad", "#dfe3f5", "#ffffff"),
    "or": ramp("#03200b", "#0b5a24", "#17a33f", "#3dff6e", "#d4ffe0"),
    "red": ramp("#2b0808", "#80150f", "#d3341c", "#ff6a3d", "#ffd3a8"),
    "gr": ramp("#141719", "#2b3236", "#48535a", "#6f7d85", "#a6b3ba"),
}

yy, xx = np.mgrid[0:N, 0:N].astype(float)
BAYER = np.tile(BAYER, (N // 4, N // 4))


class Canvas:
    def __init__(self):
        self.img = np.zeros((N, N, 4), np.uint8)

    def fill(self, mask, v, rampname, outline=True):
        """Paint `mask` with shade `v` (0 dark .. 1 light, array or float) in the named ramp."""
        r = RAMPS[rampname]
        v = np.broadcast_to(v, (N, N))
        idx = np.clip(np.floor(v * (len(r) - 1) + 0.5 + BAYER * 0.9), 0, len(r) - 1).astype(int)
        for i, c in enumerate(r):
            m = mask & (idx == i)
            self.img[m] = (*c, 255)
        if outline:
            self.outline(mask, rampname)

    def outline(self, mask, rampname):
        d = np.zeros_like(mask)
        d[1:, :] |= mask[:-1, :]; d[:-1, :] |= mask[1:, :]; d[:, 1:] |= mask[:, :-1]; d[:, :-1] |= mask[:, 1:]
        ring = d & ~mask & (self.img[..., 3] == 0)
        self.img[ring] = (*RAMPS[rampname][0], 255)

    def set(self, mask, col):
        self.img[mask] = (*col, 255)


def poly(pts):
    im = Image.new("L", (N * 4, N * 4), 0)
    ImageDraw.Draw(im).polygon([(x * 4, y * 4) for x, y in pts], fill=255)
    a = np.asarray(im.resize((N, N), Image.BOX)).astype(float)
    return a > 127


def disc(cx, cy, r, ry=None):
    ry = ry or r
    return ((xx + .5 - cx) / r) ** 2 + ((yy + .5 - cy) / ry) ** 2 <= 1


def lin(x0, y0, x1, y1):
    dx, dy = x1 - x0, y1 - y0
    return np.clip(((xx - x0) * dx + (yy - y0) * dy) / (dx * dx + dy * dy), 0, 1)


def rect(x0, y0, x1, y1):
    return (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)


# ---------------------------------------------------------------- icons
def bytes_():
    c = Canvas()
    top = poly([(16, 3), (28, 9.5), (16, 16), (4, 9.5)])
    left = poly([(4, 9.5), (16, 16), (16, 29), (4, 22.5)])
    right = poly([(16, 16), (28, 9.5), (28, 22.5), (16, 29)])
    c.fill(left, 0.30 + 0.25 * lin(4, 10, 16, 29), "cyan")
    c.fill(right, 0.12 + 0.2 * lin(16, 16, 28, 26), "cyan")
    c.fill(top, 0.78 + 0.22 * lin(4, 10, 28, 10) * 0.0 + 0.2 * lin(16, 16, 16, 3), "cyan")
    # binary marks on the two side faces
    for (x, y) in [(6, 15), (8, 17), (10, 19), (12, 21)]:
        c.set(rect(x, y, x + 1, y + 2), RAMPS["cyan"][4])
    for (x, y) in [(19, 20), (22, 18), (24, 20)]:
        c.set(rect(x, y, x + 2, y + 1), RAMPS["cyan"][3])
    return c


def mult():
    c = Canvas()
    cx = cy = 16
    hexm = np.ones((N, N), bool)
    for k in range(6):
        a = math.pi / 3 * k + math.pi / 6
        hexm &= ((xx + .5 - cx) * math.cos(a) + (yy + .5 - cy) * math.sin(a)) <= 13.2
    c.fill(hexm, 0.18 + 0.5 * lin(6, 4, 26, 28), "lime")
    inner = np.ones((N, N), bool)
    for k in range(6):
        a = math.pi / 3 * k + math.pi / 6
        inner &= ((xx + .5 - cx) * math.cos(a) + (yy + .5 - cy) * math.sin(a)) <= 10.2
    ring = hexm & ~inner
    c.fill(ring, 0.9, "lime", outline=False)
    d1 = np.abs((xx - yy)) < 1.9
    d2 = np.abs((xx + yy) - 31) < 1.9
    box = rect(9, 9, 23, 23)
    c.set(inner & box & (d1 | d2), RAMPS["lime"][4])
    c.set(inner & box & (np.abs(xx - yy) < 1.0) , RAMPS["wh"][4])
    return c


def reboot():
    c = Canvas()
    r = np.hypot(xx + .5 - 16, yy + .5 - 17)
    ang = np.degrees(np.arctan2(yy + .5 - 17, xx + .5 - 16))  # 0 = right, -90 = up
    ring = (r <= 12.2) & (r >= 7.6) & ~((ang < -52) & (ang > -128))
    c.fill(ring, 0.25 + 0.55 * lin(6, 6, 26, 28), "mag")
    c.fill(rect(14.5, 3, 17.5, 15), 0.95, "mag")
    c.set(rect(15.3, 4, 16.7, 14), RAMPS["mag"][4])
    # a bright shoulder where the ring opens
    return c


def copper():
    c = Canvas()
    def ingot(ox, oy, s=1.0):
        top = poly([(ox + 4, oy + 5), (ox + 20, oy + 5), (ox + 25, oy + 9), (ox + 9, oy + 9)])
        front = poly([(ox + 9, oy + 9), (ox + 25, oy + 9), (ox + 25, oy + 15), (ox + 9, oy + 15)])
        side = poly([(ox + 4, oy + 5), (ox + 9, oy + 9), (ox + 9, oy + 15), (ox + 4, oy + 11)])
        c.fill(side, 0.2 + 0.2 * lin(0, oy + 5, 0, oy + 15), "cu")
        c.fill(front, 0.38 + 0.3 * lin(9, oy + 9, 25, oy + 15), "cu")
        c.fill(top, 0.85 + 0.15 * lin(ox + 4, oy + 5, ox + 25, oy + 9), "cu")
    ingot(1, 14)
    ingot(5, 3)
    return c


def silicon():
    c = Canvas()
    side = disc(16, 17, 13, 7.2) | disc(16, 13, 13, 7.2) | rect(3, 13, 29, 17)
    c.fill(side & ~disc(16, 13, 13, 7.2), 0.2 + 0.25 * lin(3, 0, 29, 0), "si")
    top = disc(16, 13, 13, 7.2)
    c.fill(top, 0.55 + 0.4 * lin(4, 20, 26, 6), "si")
    grid = top & ((((xx + 1) % 5) < 1) | (((yy + 1) % 4) < 1))
    c.set(grid & disc(16, 13, 11.2, 5.6), RAMPS["si"][1])
    c.set(rect(10, 10, 12, 12) | rect(17, 12, 19, 14) | rect(21, 9, 23, 11), RAMPS["si"][4])
    return c


def quartz():
    c = Canvas()
    def crystal(ox, oy, w, h, shades):
        top = oy; mid = oy + h * 0.26; bot = oy + h
        xs = [ox, ox + w * 0.30, ox + w * 0.5, ox + w * 0.72, ox + w]
        for i in range(4):
            x0, x1 = xs[i], xs[i + 1]
            ap = ox + w / 2
            def edge_top(x):
                return top if abs(x - ap) < 1 else mid - (mid - top) * (1 - abs(x - ap) / (w / 2)) * 0 + (mid - top) * (abs(x - ap) / (w / 2)) * 0
            pts = [(x0, mid + (top - mid) * 0 if False else mid), (x1, mid), (x1, bot - (abs(x1 - ap) / (w / 2)) * h * 0.1), (x0, bot - (abs(x0 - ap) / (w / 2)) * h * 0.1)]
            face = poly(pts)
            c.fill(face, shades[i] + 0.12 * lin(0, mid, 0, bot) * -1, "qz")
        cap = poly([(ox, mid), (ox + w / 2, top), (ox + w, mid)])
        c.fill(cap, 0.95, "qz")
        c.set(poly([(ox + w / 2, top + 1), (ox + w * 0.62, mid - 1), (ox + w / 2, mid - 1)]), RAMPS["qz"][3])
    crystal(9, 2, 15, 27, [0.28, 0.62, 0.84, 0.4])
    crystal(2, 15, 9, 15, [0.3, 0.5, 0.7, 0.35])
    c.set(rect(14, 12, 15, 24), RAMPS["qz"][4])
    return c


def aether():
    c = Canvas()
    orb = disc(16, 16, 9.5)
    d = np.hypot(xx + .5 - 12.5, yy + .5 - 12.5) / 15.0
    # back half of the orbit ring first (behind the orb)
    ring_out = ((xx + .5 - 16) / 14.6) ** 2 + ((yy + .5 - 17) / 5.2) ** 2
    ring = (ring_out <= 1) & (ring_out >= 0.62)
    c.fill(ring & ~orb, 0.55, "ae", outline=False)
    c.fill(orb, 1 - d * 1.25, "ae")
    c.set(disc(12.5, 12, 2.4), RAMPS["ae"][4])
    front = ring & (yy > 17)
    c.fill(front, 0.85, "ae", outline=False)
    for (x, y) in [(4, 5), (27, 8), (26, 26), (5, 25)]:
        c.set(rect(x, y - 1, x + 1, y + 2) | rect(x - 1, y, x + 2, y + 1), RAMPS["ae"][4])
    return c


def ascend():
    c = Canvas()
    dia = (np.abs(xx + .5 - 16) + np.abs(yy + .5 - 16)) <= 14.5
    c.fill(dia, 0.12 + 0.3 * lin(16, 30, 16, 2), "wh")
    for k, oy in enumerate([19, 12, 5]):
        pts = [(16, oy), (25, oy + 8), (25, oy + 11), (16, oy + 3), (7, oy + 11), (7, oy + 8)]
        c.fill(poly(pts), 0.5 + 0.2 * k, "cyan" if k < 2 else "wh")
    return c


def alert():
    c = Canvas()
    tri = poly([(16, 3), (30, 28), (2, 28)])
    c.fill(tri, 0.4 + 0.4 * lin(16, 28, 16, 4), "red")
    c.set(rect(15, 11, 17, 21), RAMPS["red"][4])
    c.set(rect(15, 23, 17, 25), RAMPS["red"][4])
    return c


def lock():
    c = Canvas()
    sh = (disc(16, 12, 7.5) & ~disc(16, 12, 4.5)) | rect(8.5, 12, 11.5, 15) | rect(20.5, 12, 23.5, 15)
    c.fill(sh & (yy < 15) , 0.7, "gr")
    c.fill(rect(6, 15, 26, 28), 0.3 + 0.3 * lin(6, 15, 26, 28), "gr")
    c.set(rect(15, 19, 17, 24), RAMPS["gr"][0])
    c.set(disc(16, 20, 1.8), RAMPS["gr"][0])
    return c


def spark():
    c = Canvas()
    pts = [(16, 2), (19.5, 12.5), (30, 16), (19.5, 19.5), (16, 30), (12.5, 19.5), (2, 16), (12.5, 12.5)]
    c.fill(poly(pts), 0.5 + 0.5 * lin(2, 30, 30, 2), "wh")
    return c


# ---- the deep materials (Runes, Starglass, Voidsteel, Chrono). Each takes a tier t (0..5) so the tier sheet can reuse them;
# the plain icon sheet shows tier 4 (index 4).
def runes_t(c, t):
    w = 7 + t * 0.9
    slab = rect(16 - w, 16 - w - 2, 16 + w, 16 + w + 2)
    c.fill(slab, 0.28 + 0.3 * lin(4, 4, 28, 28), "gr")
    glow = [(0, 1), (1, 1), (2, 1), (3, 1), (4, 1), (5, 1)][: t + 1]
    segs = [rect(15, 8, 17, 24), rect(10, 15, 22, 17), poly([(16, 9), (22, 16), (16, 23), (10, 16)]) & ~poly([(16, 12), (19, 16), (16, 20), (13, 16)]),
            rect(10, 9, 12, 12) | rect(20, 9, 22, 12), rect(10, 20, 12, 23) | rect(20, 20, 22, 23), disc(16, 16, 3.2) & ~disc(16, 16, 1.6)]
    order = [0, 1, 2, 3, 4, 5]
    for k in order[: t + 1]:
        c.set(segs[k] & slab, RAMPS["rn"][3 if k % 2 else 4])
    if t >= 3:
        c.set(slab & ~rect(16 - w + 1, 16 - w - 1, 16 + w - 1, 16 + w + 1), RAMPS["rn"][2])
    return c


def starglass_t(c, t):
    def star(cx, cy, r, v):
        pts = [(cx, cy - r), (cx + r * .26, cy - r * .26), (cx + r, cy), (cx + r * .26, cy + r * .26), (cx, cy + r), (cx - r * .26, cy + r * .26), (cx - r, cy), (cx - r * .26, cy - r * .26)]
        c.fill(poly(pts), v + 0.5 * lin(cx - r, cy + r, cx + r, cy - r), "sg")
    sizes = [(16, 16, 11), (7, 8, 5), (25, 9, 5), (8, 25, 4), (25, 24, 5), (16, 3.5, 2.5)]
    use = [0] + list(range(1, t + 1))
    if t == 0:
        sizes[0] = (16, 16, 8)
    for i in sorted(use, key=lambda k: -sizes[k][2]):
        cx, cy, r = sizes[i]
        star(cx, cy, r + (0.35 * t if i == 0 else 0), 0.3)
    c.set(disc(16, 16, 1.4), RAMPS["sg"][4])
    return c


def voidsteel_t(c, t):
    n = 1 + t // 2 + (1 if t >= 4 else 0)
    for i in range(n):
        y = 24 - i * 7
        top = poly([(5, y), (25, y), (28, y + 3), (8, y + 3)])
        front = rect(8, y + 3, 28, y + 8)
        side = poly([(5, y), (8, y + 3), (8, y + 8), (5, y + 5)])
        c.fill(side, 0.12, "vs")
        c.fill(front, 0.2 + 0.2 * lin(8, y, 28, y + 8), "vs")
        c.fill(top, 0.6 + 0.08 * i, "vs")
    ring = disc(16, 24 - (n - 1) * 7 + 4.5, 2.4 + t * 0.35) & ~disc(16, 24 - (n - 1) * 7 + 4.5, 1.2 + t * 0.15)
    c.set(ring, RAMPS["vs"][4])
    return c


def chrono_t(c, t):
    c.fill(rect(8, 3, 24, 6), 0.7, "ch")
    c.fill(rect(8, 26, 24, 29), 0.7, "ch")
    top = poly([(9, 6), (23, 6), (16.5, 15.5)])
    bot = poly([(16, 16.5), (9.5, 26), (22.5, 26)])
    c.fill(top, 0.2 + 0.15 * lin(0, 6, 0, 16), "ch")
    c.fill(bot, 0.35 + 0.1 * t + 0.4 * lin(0, 26, 0, 17), "ch")
    c.set(rect(15.3, 15, 16.7, 18), RAMPS["ch"][4])
    for k in range(1 + t // 2):
        ro = 14.5 - k * 1.8
        r = np.hypot(xx + .5 - 16, yy + .5 - 16)
        ang = np.degrees(np.arctan2(yy + .5 - 16, xx + .5 - 16)) + k * 40
        gap = (ang % 90) < 60
        c.set((r <= ro) & (r >= ro - 1.0) & gap & ~rect(7, 3, 25, 6) & ~rect(7, 26, 25, 29), RAMPS["ch"][3 if k == 0 else 2])
    if t >= 4:
        c.set(rect(14, 10, 18, 13), RAMPS["ch"][4])
    return c


# ---- deep space (Nebula, Pulsars, Singularity), same tier convention as above.
def nebula_t(c, t):
    """A cloud of star-nursery gas: soft lobes that grow and stack, with new stars lit inside."""
    lobes = [(16, 18, 7), (10, 20, 5), (22, 20, 5.5), (13, 13, 5), (21, 13, 4.5), (7, 15, 3.5), (25, 15, 3.5)][: 3 + min(4, t)]
    k = 1 + t * 0.08
    m = np.zeros((N, N), bool)
    for x, y, r in lobes:
        m |= disc(16 + (x - 16) * k, 17 + (y - 17) * k, r * k)
    c.fill(m, 0.25 + 0.55 * lin(4, 28, 26, 6), "nb")
    core = disc(16, 17, 3 + t * 0.4)
    c.fill(core & m, 0.85, "nb", outline=False)
    for i, (x, y) in enumerate([(12, 15), (20, 19), (17, 12), (9, 19), (23, 14), (15, 21)][: 1 + t]):
        c.set(rect(x, y, x + 1, y + 1), RAMPS["wh"][4])
        if i < t - 1:
            c.set(rect(x - 1, y, x, y + 1) | rect(x + 1, y, x + 2, y + 1), RAMPS["pu"][3])
    return c


def pulsars_t(c, t):
    """A spinning dead star: a bright core with two beams that get longer and sharper, and rings of field lines."""
    cx, cy = 16, 16
    L = 7 + t * 1.7
    beam = poly([(cx - 1.3, cy), (cx - 3.5 - L * 0.35, cy - L), (cx + 0.5 - L * 0.25, cy - L - 1), (cx + 1.3, cy)])
    beam |= poly([(cx + 1.3, cy), (cx + 3.5 + L * 0.35, cy + L), (cx - 0.5 + L * 0.25, cy + L + 1), (cx - 1.3, cy)])
    c.fill(beam, 0.4 + 0.5 * (1 - np.hypot(xx - cx, yy - cy) / (L + 2)), "pu", outline=False)
    for k in range(min(2, t // 2 + 1)):
        rr = 5 + k * 3 + t * 0.3
        ring = disc(cx, cy, rr, rr * 0.45) & ~disc(cx, cy, rr - 1, rr * 0.45 - 1)
        c.set(ring & ~disc(cx, cy, 3), RAMPS["pu"][2 + (k == 0)])
    c.fill(disc(cx, cy, 3 + t * 0.25), 0.9, "pu")
    c.set(disc(cx - 0.5, cy - 0.5, 1.2), RAMPS["wh"][4])
    return c


def singularity_t(c, t):
    """A black hole: a dark centre with a glowing accretion disk that widens and brightens, and a lensed halo above."""
    cx, cy = 16, 16
    R = 9 + t * 0.9
    disk = disc(cx, cy, R, R * 0.32) & ~disc(cx, cy, R * 0.45, R * 0.15)
    halo = disc(cx, cy - 0.5, R * 0.6) & ~disc(cx, cy - 0.5, R * 0.6 - 1.2 - t * 0.15)
    c.fill(halo & (yy < cy), 0.6 + 0.08 * t, "sn", outline=False)
    c.fill(disk & (yy >= cy - 0.5), 0.35 + 0.55 * (1 - np.abs(xx - cx) / R), "sn")
    hole = disc(cx, cy - 0.5, R * 0.42)
    c.set(hole, (6, 4, 2))
    c.fill(disk & (yy < cy - 0.5) & ~hole, 0.25 + 0.4 * (1 - np.abs(xx - cx) / R), "sn", outline=False)
    c.set(disc(cx, cy - 0.5, R * 0.42 + 0.9) & ~hole & (yy < cy), RAMPS["sn"][4])
    if t >= 3:
        for x, y in [(cx - R - 1, cy - 4), (cx + R, cy + 3), (cx + 3, cy - R * 0.6 - 3)][: t - 2]:
            c.set(rect(x, y, x + 1, y + 1), RAMPS["wh"][4])
    return c


# ---- the last three materials (Engrams, Paradox, Origin), same tier convention as above.
def engrams_t(c, t):
    """A film reel of recorded memory: a metal flange with cut-outs over a dark coil of film. The reel grows, more frames
    light up, and a strip unspools from it at higher tiers."""
    R = 8.5 + t * 0.7
    cx, cy = 14 - t * 0.3, 15 - t * 0.2
    if t >= 2:  # film strip unspooling to the lower right, with sprocket holes and lit frames
        y0 = 23.5 - t * 0.6
        strip = poly([(cx + 3, y0 - 1), (31, y0 - 1), (31, y0 + 5), (cx + 3, y0 + 5)])
        c.fill(strip, 0.12, "eg")
        for k in range(8):
            x = cx + 4 + k * 2.4
            if x < 30:
                c.set(rect(x, y0 - 0.5, x + 1, y0 + 0.5) | rect(x, y0 + 3.5, x + 1, y0 + 4.5), RAMPS["eg"][2])
        for k in range(min(t - 1, 4)):
            x = cx + R * 0.2 + 5 + k * 4.2
            if x + 3 < 31:
                c.set(rect(x, y0 + 1, x + 3, y0 + 3), RAMPS["eg"][4 if k == min(t - 1, 4) - 1 else 3])
    coil = disc(cx, cy, R)
    c.fill(coil, 0.1 + 0.15 * lin(cx - R, cy - R, cx + R, cy + R), "eg")
    for k in range(2 + t // 2):  # wound film rings
        rr = R - 1.5 - k * 1.6
        c.set(disc(cx, cy, rr) & ~disc(cx, cy, rr - 0.7), RAMPS["eg"][1])
    fl = R * 0.72  # metal flange with cut-outs
    flange = disc(cx, cy, fl)
    holes = 3 + (1 if t >= 3 else 0) + (1 if t >= 5 else 0)
    cut = np.zeros_like(flange)
    for k in range(holes):
        a = -math.pi / 2 + k * 2 * math.pi / holes
        cut |= disc(cx + math.cos(a) * fl * 0.55, cy + math.sin(a) * fl * 0.55, fl * 0.27)
    c.fill(flange & ~cut, 0.55 + 0.4 * lin(cx + fl, cy + fl, cx - fl, cy - fl), "eg", outline=False)
    c.set(flange & ~disc(cx, cy, fl - 0.9) & ~cut, RAMPS["eg"][4])
    c.set(disc(cx, cy, 1.7), RAMPS["eg"][1])
    c.set(disc(cx, cy, 0.8), RAMPS["eg"][4])
    if t >= 4:  # a second, smaller reel behind
        r2 = 3.5 + (t - 4) * 1.2
        back = disc(26, 6.5, r2) & ~coil
        c.fill(back, 0.5, "eg")
        c.set(disc(26, 6.5, 0.9) & back, RAMPS["eg"][0])
    return c


def paradox_t(c, t):
    """A looped ribbon (a lemniscate with a twist): the back half dark, the front half light, crossing over itself. Higher
    tiers widen the loop and add a chromatic split (cyan and magenta ghost edges), as if it sits in two places at once."""
    a = 6.8 + t * 0.55
    wid = 1.7 + t * 0.16
    cx, cy = 16, 16
    pts = []
    for i in range(240):
        u = i / 240 * 2 * math.pi
        d = 1 + math.sin(u) ** 2
        pts.append((cx + a * math.cos(u) / d * 1.4, cy + a * math.sin(u) * math.cos(u) / d * 2.0, math.cos(u + 0.6)))
    back = np.zeros((N, N), bool); front = np.zeros((N, N), bool); vb = np.zeros((N, N)); vf = np.zeros((N, N))
    for x, y, depth in pts:
        m = disc(x, y, wid)
        if depth < 0:
            back |= m; vb[m] = 0.15 + 0.2 * (1 + depth)
        else:
            front |= m; vf[m] = 0.55 + 0.4 * depth
    if t >= 5:
        for dx, rn in ((-1, "cyan"), (1, "mag")):
            g = np.roll(back | front, dx, axis=1) & ~(back | front)
            c.set(g, RAMPS[rn][3])
    c.fill(back & ~front, vb, "px", outline=False)
    c.fill(front, vf, "px", outline=False)
    c.outline(back | front, "px")
    if t >= 1:
        c.set(disc(cx, cy, 1.2), RAMPS["px"][4])
    if t >= 3:
        for k, (x, y) in enumerate([(cx - a * 1.4, cy - 4), (cx + a * 1.4, cy + 4)]):
            c.set(rect(x - 0.5, y - 0.5, x + 0.5, y + 0.5), RAMPS["cyan" if k == 0 else "mag"][4])
    return c


def origin_t(c, t):
    """The first node: a small box with one green core, roots running down out of it. Roots, light and rays grow with tier."""
    w = 5.5 + t * 0.9
    top = 15 - t * 0.6
    cx = 16
    nroots = 1 + t
    for k in range(nroots):  # roots
        fx = (k - (nroots - 1) / 2) * (2.6 + t * 0.2)
        x0, y0 = cx + fx * 0.3, top + w * 1.1
        x1, y1 = cx + fx * 1.4, min(30.5, y0 + 6 + t + (k % 2) * 2)
        for j in range(12):
            q = j / 11
            x = x0 + (x1 - x0) * q + math.sin(q * 3 + k) * 0.8
            y = y0 + (y1 - y0) * q
            c.set(rect(x, y, x + 1, y + 1), RAMPS["or"][2 if q < 0.6 else 1])
    face = rect(cx - w, top, cx + w, top + w * 1.15)
    lid = poly([(cx - w, top), (cx - w + 2.5, top - 2.5), (cx + w + 2.5, top - 2.5), (cx + w, top)])
    side = poly([(cx + w, top), (cx + w + 2.5, top - 2.5), (cx + w + 2.5, top + w * 1.15 - 2.5), (cx + w, top + w * 1.15)])
    c.fill(side, 0.12, "gr")
    c.fill(face, 0.25 + 0.25 * lin(cx - w, top, cx + w, top + w), "gr")
    c.fill(lid, 0.7, "gr")
    core_y = top + w * 0.58
    if t >= 2:  # glow ring
        ring = disc(cx, core_y, 2.6 + t * 0.45) & ~disc(cx, core_y, 1.6 + t * 0.4)
        c.set(ring & face, RAMPS["or"][2])
    c.set(disc(cx, core_y, 1.5 + t * 0.3), RAMPS["or"][3])
    c.set(disc(cx - 0.4, core_y - 0.4, 0.8), RAMPS["or"][4])
    if t >= 1:  # the one wire
        c.set(rect(cx + w + 2, top - 6 - t, cx + w + 3, top - 1.5), RAMPS["or"][2])
        c.set(rect(cx + w + 1.5, top - 7 - t, cx + w + 3.5, top - 6 - t), RAMPS["or"][4])
    if t >= 3:  # rays
        for k, (dx, dy) in enumerate([(-1, -1), (1, -1.2), (-1.3, 0.1), (1.4, 0.2)][: t - 1]):
            x, y = cx + dx * (w + 3.5), top - 3 + dy * 4
            c.set(rect(x, y, x + 1, y + 1), RAMPS["or"][4 if k % 2 == 0 else 3])
    return c


ICONS = [("bytes", bytes_), ("mult", mult), ("reboot", reboot), ("copper", copper), ("silicon", silicon), ("quartz", quartz),
         ("aether", aether), ("ascend", ascend), ("alert", alert), ("lock", lock), ("spark", spark),
         ("runes", lambda: runes_t(Canvas(), 4)), ("starglass", lambda: starglass_t(Canvas(), 4)),
         ("voidsteel", lambda: voidsteel_t(Canvas(), 4)), ("chrono", lambda: chrono_t(Canvas(), 4)),
         ("engrams", lambda: engrams_t(Canvas(), 4)), ("paradox", lambda: paradox_t(Canvas(), 4)), ("origin", lambda: origin_t(Canvas(), 4)),
         ("nebula", lambda: nebula_t(Canvas(), 4)), ("pulsars", lambda: pulsars_t(Canvas(), 4)), ("singularity", lambda: singularity_t(Canvas(), 4))]


def main():
    out = Path(__file__).resolve().parents[2] / "public/naos/nodefarm"
    out.mkdir(parents=True, exist_ok=True)
    sheet = np.zeros((N, N * len(ICONS), 4), np.uint8)
    for i, (name, fn) in enumerate(ICONS):
        sheet[:, i * N:(i + 1) * N] = fn().img
    im = Image.fromarray(sheet, "RGBA")
    im.save(out / "icons.png", optimize=True)
    im.save(out / "icons.webp", lossless=True, quality=100, method=6)
    # contact sheet for eyeballing (not shipped)
    big = im.resize((im.width * 4, im.height * 4), Image.NEAREST)
    bg = Image.new("RGBA", big.size, (19, 19, 19, 255)); bg.alpha_composite(big)
    bg.save("/tmp/nf-contact.png")
    print("cells", [n for n, _ in ICONS])


if __name__ == "__main__":
    main()
