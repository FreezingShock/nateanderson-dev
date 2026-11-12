"""Drone hangar art (dither, multicolour, original).

Writes to public/naos/nodefarm/:
  hangar-bg-0   256 px tile, opaque: steel deck plates seen from above, seams, rivets, oil and coolant stains, paint
  hangar-pad    384 px, transparent: the landing pad under the drone tree's core, hazard ring, guide lights
  hangar-bay    360 x 84, opaque: the board's hangar strip, six berths (one per Drone tier) under a crane rail; berth i is
                centred at (i + 0.5) / 6 of the width so the live Drone sprites (components/nodefarm/drones.tsx) line up
Run: python3 scripts/naos-art/nodefarm-hangar-art.py
"""
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[2] / "public/naos/nodefarm"
B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 - 0.5
DRONE = ["#2fd8e8", "#b6f04a", "#f08a3c", "#7aa2ff", "#e08cff", "#ffc53a"]  # same order as drones.tsx


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def ramp_of(col, n=5, lo=0.08, hi=1.25):
    """A dark-to-bright ramp around one colour, shadows drifting toward blue."""
    r, g, b = [c / 255 for c in hexc(col)]
    out = []
    for i in range(n):
        t = lo + (hi - lo) * i / (n - 1)
        rr, gg, bb = r * t, g * t, b * t
        cool = (1 - i / (n - 1)) * 0.25
        rr, gg, bb = rr * (1 - cool), gg * (1 - cool * 0.5), min(1, bb + cool * 0.08)
        out.append("#%02x%02x%02x" % tuple(int(max(0, min(1, v)) * 255) for v in (rr, gg, bb)))
    return out


RAMP = {
    "steel": ["#07090d", "#0e1219", "#151b25", "#1d2532", "#283244"],
    "amber": ramp_of("#ffb14a"),
    "mint": ramp_of("#6bffc9"),
    "rust": ramp_of("#ff7a4a"),
    "haz": ["#141008", "#5a3c06", "#c8900e", "#ffd23a", "#fff1b0"],
    "sky": ramp_of("#7ad8ff"),
    "violet": ramp_of("#a98bff"),
}
for i, c in enumerate(DRONE):
    RAMP[f"d{i}"] = ramp_of(c)


class Canvas:
    def __init__(self, w, h, opaque=False):
        self.w, self.h = w, h
        self.img = np.zeros((h, w, 4), np.uint8)
        self.bay = np.tile(B4, (h // 4 + 1, w // 4 + 1))[:h, :w]
        self.y, self.x = np.mgrid[0:h, 0:w].astype(float)
        if opaque:
            self.img[..., 3] = 255

    def fill(self, mask, v, ramp, alpha=255, dither=1.0, soft=True):
        r = RAMP[ramp]
        v = np.broadcast_to(np.asarray(v, float), mask.shape)
        idx = np.clip(np.floor(v * (len(r) - 1) + 0.5 + self.bay * dither).astype(int), 0, len(r) - 1)
        on = mask & ((v * 3 + self.bay * 1.6 > 0.35) if soft else True)
        for i, c in enumerate(r):
            m = on & (idx == i)
            self.img[m] = (*hexc(c), alpha)

    def px(self, x, y, col, a=255):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h:
            self.img[y, x] = (*hexc(col), a)

    def rect(self, x0, y0, x1, y1, col, a=255):
        x0, y0 = max(0, int(x0)), max(0, int(y0))
        self.img[y0:int(y1), x0:int(x1)] = (*hexc(col), a)

    def save(self, stem):
        im = Image.fromarray(self.img, "RGBA")
        im.save(OUT / f"{stem}.png", optimize=True)
        im.save(OUT / f"{stem}.webp", lossless=True, quality=100, method=6)
        print("wrote", stem, im.size)


def deck():
    rnd = random.Random(7)
    n = 256
    c = Canvas(n, n, True)
    P = 64
    # plates: each its own tone, lit from the top left, tileable because plates align to the tile
    for py in range(0, n, P):
        for px in range(0, n, P):
            m = (c.x >= px) & (c.x < px + P) & (c.y >= py) & (c.y < py + P)
            base = 0.35 + rnd.random() * 0.25
            v = base + 0.25 * (1 - ((c.x - px) + (c.y - py)) / (2 * P))
            c.fill(m, np.clip(v, 0, 1), "steel", soft=False)
            # tread pattern on some plates
            if rnd.random() < 0.45:
                tm = m & (((c.x - px) + 2 * (c.y - py)) % 8 < 2) & (((c.x - px) // 8 + (c.y - py) // 8) % 2 == 0)
                c.fill(tm, 0.95, "steel", soft=False)
            # seams and rivets
            c.rect(px, py, px + P, py + 1, "#05070a")
            c.rect(px, py, px + 1, py + P, "#05070a")
            c.rect(px + 1, py + 1, px + P, py + 2, "#2a3446")
            for rx, ry in ((4, 4), (P - 5, 4), (4, P - 5), (P - 5, P - 5)):
                c.px(px + rx, py + ry, "#3c4a60")
                c.px(px + rx + 1, py + ry + 1, "#05070a")
    # stains: amber oil, mint coolant, rust, violet ion scorch (wrapping)
    for ramp, k in (("amber", 2), ("mint", 1), ("rust", 2)):
        for _ in range(k):
            cx, cy, r = rnd.random() * n, rnd.random() * n, 10 + rnd.random() * 22
            dx = np.minimum(abs(c.x - cx), n - abs(c.x - cx))
            dy = np.minimum(abs(c.y - cy), n - abs(c.y - cy))
            d = np.sqrt(dx * dx + (dy * 1.3) ** 2) / r
            m = d < 1
            c.fill(m, np.clip((1 - d) * 0.55, 0, 1), ramp, dither=1.4)
    # a painted taxi line along one seam: solid hazard paint, a few chipped pixels
    m = (c.y >= 126) & (c.y < 130)
    chip = np.random.default_rng(3).random(m.shape) < 0.08
    c.fill(m & ~chip, 0.6, "haz", soft=False)
    c.save("hangar-bg-0")


def pad():
    n = 384
    c = Canvas(n, n)
    cx = cy = n / 2
    d = np.hypot(c.x - cx, c.y - cy)
    a = np.arctan2(c.y - cy, c.x - cx)
    # outer glow wash
    m = d < 190
    c.fill(m & (d > 150), np.clip((190 - d) / 40 * 0.35, 0, 1), "amber", alpha=255, dither=1.6)
    # hazard ring: stripes rotate with the angle
    ring = (d > 132) & (d < 150)
    stripe = ((a / (2 * math.pi) * 36 + (d - 132) / 9) % 2) < 1
    c.fill(ring & stripe, 0.75, "haz", soft=False)
    c.fill(ring & ~stripe, 0.1, "steel", soft=False)
    # pad face
    face = d <= 132
    c.fill(face, np.clip(0.55 - d / 132 * 0.35, 0, 1), "steel", soft=False)
    c.fill((d > 124) & (d <= 132), 0.9, "steel", soft=False)
    # inner circle and cross in mint paint
    c.fill((d > 70) & (d < 76), 0.7, "mint", soft=False)
    arm = ((abs(c.x - cx) < 4) | (abs(c.y - cy) < 4)) & (d < 60) & (d > 20)
    c.fill(arm, 0.75, "mint", soft=False)
    # warm core glow
    c.fill(d < 26, np.clip(1 - d / 26, 0, 1) * 0.9 + 0.1, "amber", dither=1.2)
    # guide lights round the ring, each a drone colour
    for i in range(24):
        t = i / 24 * 2 * math.pi
        x, y = cx + 141 * math.cos(t), cy + 141 * math.sin(t)
        col = DRONE[i % 6]
        for ox, oy in ((0, 0), (1, 0), (0, 1), (1, 1)):
            c.px(x + ox, y + oy, col)
    c.save("hangar-pad")


def bay():
    W, H = 360, 84
    rnd = random.Random(11)
    c = Canvas(W, H, True)
    # back wall: vertical gradient, panel lines
    v = 0.15 + 0.5 * (1 - c.y / H)
    c.fill(np.ones((H, W), bool), np.clip(v * 0.7, 0, 1), "steel", soft=False)
    for x in range(0, W, 20):
        c.rect(x, 8, x + 1, 62, "#05070a")
    # crane rail along the top with a hook trolley
    c.rect(0, 4, W, 8, "#2a3446")
    c.rect(0, 8, W, 9, "#05070a")
    for x in range(0, W, 10):
        c.rect(x, 4, x + 4, 5, "#3c4a60")
    tx = 238
    c.rect(tx, 9, tx + 12, 13, "#c8900e")
    c.rect(tx + 5, 13, tx + 7, 22, "#3c4a60")
    # berths
    bw = W / 6
    for i in range(6):
        x0 = int(i * bw + 6)
        x1 = int((i + 1) * bw - 6)
        cxm = (x0 + x1) / 2
        # recess with coloured back glow in the drone's colour
        m = (c.x >= x0) & (c.x < x1) & (c.y >= 14) & (c.y < 62)
        glow = np.clip(1 - np.hypot((c.x - cxm) / (bw * 0.45), (c.y - 40) / 26), 0, 1)
        c.fill(m, 0.12 + glow * 0.45, f"d{i}", dither=1.3, soft=False)
        # arch frame
        c.rect(x0 - 2, 12, x1 + 2, 14, "#2a3446")
        c.rect(x0 - 2, 12, x0, 62, "#2a3446")
        c.rect(x1, 12, x1 + 2, 62, "#1d2532")
        # berth tag T1..T6 as a lit plate
        c.rect(cxm - 7, 15, cxm + 7, 20, "#05070a")
        for k in range(i + 1):
            c.rect(cxm - 6 + k * 2, 16, cxm - 5 + k * 2, 19, DRONE[i])
        # charging cradle
        c.rect(cxm - 12, 56, cxm + 12, 59, "#3c4a60")
        c.rect(cxm - 2, 52, cxm + 2, 56, "#2a3446")
        # cable down from the rail
        cx = x0 + 3 + rnd.randrange(4)
        for y in range(14, 30):
            c.px(cx + (1 if (y // 5) % 2 else 0), y, "#0e1219")
    # floor: hazard stripe lip and plates
    c.fill((c.y >= 62) & (c.y < 66), (((c.x + c.y) // 4) % 2) * 0.75, "haz", soft=False)
    fv = 0.2 + 0.25 * (c.y - 66) / (H - 66)
    c.fill(c.y >= 66, np.clip(fv, 0, 1), "steel", soft=False)
    for x in range(0, W, 30):
        c.rect(x, 66, x + 1, H, "#05070a")
    # floor lights: a dot under each berth in its colour
    for i in range(6):
        cxm = (i + 0.5) * bw
        c.rect(cxm - 3, 72, cxm + 3, 74, DRONE[i])
    c.save("hangar-bay")


if __name__ == "__main__":
    deck()
    pad()
    bay()
