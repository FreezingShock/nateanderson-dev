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


ICONS = [("bytes", bytes_), ("mult", mult), ("reboot", reboot), ("copper", copper), ("silicon", silicon), ("quartz", quartz),
         ("aether", aether), ("ascend", ascend), ("alert", alert), ("lock", lock), ("spark", spark),
         ("runes", lambda: runes_t(Canvas(), 4)), ("starglass", lambda: starglass_t(Canvas(), 4)),
         ("voidsteel", lambda: voidsteel_t(Canvas(), 4)), ("chrono", lambda: chrono_t(Canvas(), 4))]


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
