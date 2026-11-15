"""Brasswork menu window art: header banners, the riveted window frame and the body grain.

  public/brasswork/window/banner-<menu>.png   240 x 22 lamplit scene behind each menu's title row (shown at 3x)
  public/brasswork/window/frame.png           24 x 24 riveted brass frame with corner brackets, border-image slice 8
  public/brasswork/window/grain.png           32 x 32 tiling dark workbench grain for the window body
  public/brasswork/window/rule.png            8 x 6 tiling riveted section rule
  public/brasswork/window/glyphs.png          12 px section glyphs, 8 across, in GLYPHS order

Menus: research (drafting table), expedition (coast chart), production (gear train and dials), settings
(escapement), hub (workshop front), milestones (crates and the delivery flag).

Every pixel is painted here on the Brasswork palette (scripts/brasswork/bw_palette.py) and ordered-dithered with a
Bayer 4x4 matrix, like the rest of the game's art. The left third of each banner fades to the header colour, so the
title reads over it. Run: python3 scripts/brasswork/build-window-art.py
"""
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
from bw_palette import BW  # noqa: E402

OUT = ROOT / "public/brasswork/window"
W, H = 240, 22
BAYER = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) + 0.5) / 16.0


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


EXTRA = {
    "night": [hexc(c) for c in ("#0d0905", "#160f08", "#21170c", "#2e2010", "#3d2b14")],
    "ink": [hexc(c) for c in ("#0e0a06", "#1a1209", "#2a1d0e")],
    "paper": [hexc(c) for c in ("#5a4a30", "#8a7650", "#b8a47a", "#dccaa0", "#f2e4c0")],
    "print": [hexc(c) for c in ("#0e1c1e", "#14302f", "#1d4542", "#2b5e58", "#4a837a", "#86b2a6")],
    "sea": [hexc(c) for c in ("#10161a", "#1a2a2c", "#27403e", "#3a5a52", "#5a7c68")],
    "red": [hexc(c) for c in ("#2a0a06", "#5a160c", "#8e2814", "#c0442a", "#e07050")],
}


def pal(name):
    if name in EXTRA:
        return EXTRA[name]
    return [tuple(c) if not isinstance(c, str) else hexc(c) for c in BW[name]]


class Paint:
    """Each pixel holds a ramp name and a shade from 0 (darkest) to 1 (lightest); render() dithers to the ramp."""

    def __init__(self, w=W, h=H):
        self.w, self.h = w, h
        self.ramp = np.full((h, w), "night", dtype=object)
        self.shade = np.zeros((h, w))
        self.Y, self.X = np.mgrid[0:h, 0:w].astype(float) + 0.5

    def fill(self, mask, ramp, shade):
        sh = np.broadcast_to(np.asarray(shade, dtype=float), (self.h, self.w))
        self.ramp[mask] = ramp
        self.shade[mask] = sh[mask]

    # shapes -------------------------------------------------------------
    def rect(self, x0, y0, x1, y1):
        return (self.X >= x0) & (self.X < x1) & (self.Y >= y0) & (self.Y < y1)

    def disc(self, cx, cy, r):
        return (self.X - cx) ** 2 + (self.Y - cy) ** 2 <= r * r

    def ring(self, cx, cy, r0, r1):
        d = (self.X - cx) ** 2 + (self.Y - cy) ** 2
        return (d <= r1 * r1) & (d >= r0 * r0)

    def gear(self, cx, cy, r, teeth, tooth=1.6, phase=0.0, hole=None):
        a = np.arctan2(self.Y - cy, self.X - cx) + phase
        d = np.hypot(self.X - cx, self.Y - cy)
        lobe = (np.cos(a * teeth) > 0.1).astype(float)
        m = d <= r + lobe * tooth
        if hole:
            m &= d > hole
        return m

    def line(self, x0, y0, x1, y1, t=1.0):
        dx, dy = x1 - x0, y1 - y0
        L2 = dx * dx + dy * dy or 1.0
        u = np.clip(((self.X - x0) * dx + (self.Y - y0) * dy) / L2, 0, 1)
        return np.hypot(self.X - (x0 + u * dx), self.Y - (y0 + u * dy)) <= t / 2

    def poly(self, pts):
        x, y = self.X, self.Y
        inside = np.zeros_like(x, dtype=bool)
        n = len(pts)
        for i in range(n):
            x0, y0 = pts[i]
            x1, y1 = pts[(i + 1) % n]
            cond = ((y0 > y) != (y1 > y))
            xi = (x1 - x0) * (y - y0) / ((y1 - y0) or 1e-9) + x0
            inside ^= cond & (x < xi)
        return inside

    # light ----------------------------------------------------------------
    def lit(self, base, cx, cy, k=0.03):
        """Shade that brightens toward a lamp at (cx, cy)."""
        return np.clip(base - k * np.hypot(self.X - cx, (self.Y - cy) * 1.6) / 4, 0, 1)

    def vgrad(self, top, bottom):
        return top + (bottom - top) * (self.Y / self.h)

    def render(self, fade=True):
        img = np.zeros((self.h, self.w, 3), dtype=np.uint8)
        b = BAYER[(self.Y.astype(int)) % 4, (self.X.astype(int)) % 4]
        for name in set(self.ramp.ravel()):
            m = self.ramp == name
            cols = np.array(pal(name), dtype=np.uint8)
            n = len(cols)
            idx = np.clip(np.floor(self.shade * (n - 1) + b), 0, n - 1).astype(int)
            img[m] = cols[idx[m]]
        if fade:
            # Fade the left third into the header colour, dithered, so the title reads over it.
            head = np.array(pal("night")[1], dtype=float)
            t = np.clip((self.X - 40) / 70, 0, 1)
            keep = t > b
            img[~keep] = head.astype(np.uint8)
        return Image.fromarray(img, "RGB")


def backdrop(p, lamp_x, warm=0.55):
    p.fill(p.rect(0, 0, W, H), "night", p.lit(np.full((H, W), warm + 0.25), lamp_x, -2, 0.07))
    # wall planks and a pegboard row, lit by the lamp
    p.fill(p.rect(0, 0, W, H) & (p.X.astype(int) % 18 == 0), "night", p.lit(np.full((H, W), 0.25), lamp_x, -2, 0.05))
    pegs = ((p.X.astype(int) % 6 == 3) & (p.Y.astype(int) % 6 == 3) & (p.Y < H - 4))
    p.fill(pegs, "night", 0.0)
    # bench edge along the bottom
    p.fill(p.rect(0, H - 3, W, H), "wood", p.lit(np.full((H, W), 0.55), lamp_x, H, 0.05))
    p.fill(p.rect(0, H - 3, W, H - 2), "wood", 0.9)


# ------------------------------------------------------------------ scenes

def research():
    p = Paint()
    backdrop(p, 170)
    # pinned blueprint sheet
    sheet = p.rect(112, 2, 206, 19)
    p.fill(sheet, "print", p.lit(np.full((H, W), 0.55), 160, 4, 0.05))
    grid = sheet & (((p.X.astype(int) - 112) % 6 == 0) | ((p.Y.astype(int) - 2) % 6 == 0))
    p.fill(grid, "print", 0.72)
    # a gear drafted on the sheet
    g = p.gear(140, 10, 5, 8, 1.2) & ~p.gear(140, 10, 4, 8, 1.2) | p.ring(140, 10, 1.4, 2.2)
    p.fill(g & sheet, "print", 1.0)
    p.fill(p.line(150, 6, 196, 6, 1) | p.line(150, 10, 186, 10, 1) | p.line(150, 14, 192, 14, 1), "print", 0.9)
    p.fill(p.line(150, 14, 150, 17.5, 1) | p.line(192, 14, 192, 17.5, 1) | p.line(150, 17, 192, 17, 1), "print", 0.85)
    for x, y in ((114, 4), (204, 4), (114, 17), (204, 17)):
        p.fill(p.disc(x, y, 1.2), "brass", 0.95)
    # rolled plans leaning right
    for i, x in enumerate((214, 220, 226)):
        roll = p.poly([(x, 20), (x + 4, 20), (x + 9, 2 + i * 2), (x + 5, 2 + i * 2)])
        p.fill(roll, "paper", 0.55 + 0.1 * i)
        p.fill(p.disc(x + 7, 3 + i * 2, 2.2), "paper", 0.9)
        p.fill(p.disc(x + 7, 3 + i * 2, 0.9), "paper", 0.25)
    # brass compass / dividers over the sheet
    p.fill(p.line(176, 2, 168, 19, 1.4) | p.line(176, 2, 184, 19, 1.4), "brass", 0.75)
    p.fill(p.disc(176, 3, 1.8), "brass", 1.0)
    # ink bottle and pen
    p.fill(p.rect(92, 13, 100, 19), "ink", 0.6)
    p.fill(p.rect(94, 11, 98, 13), "brass", 0.7)
    p.fill(p.line(97, 10, 106, 2, 1), "wood", 0.8)
    # lamp glow halo
    p.fill(p.disc(76, 7, 3), "glow", 0.85)
    p.fill(p.rect(75, 0, 77, 4), "brass", 0.5)
    return p


def expedition():
    p = Paint()
    backdrop(p, 160)
    chart = p.poly([(100, 3), (226, 1), (230, 19), (104, 20)])
    p.fill(chart, "paper", p.lit(np.full((H, W), 0.85), 170, 6, 0.05))
    # sea and a coast line
    sea = chart & (p.Y > 9 + 4 * np.sin(p.X / 9.0) + 2 * np.sin(p.X / 3.7))
    p.fill(sea, "sea", 0.55 + 0.25 * ((p.X.astype(int) + p.Y.astype(int) * 3) % 7 == 0))
    coast = chart & (np.abs(p.Y - (9 + 4 * np.sin(p.X / 9.0) + 2 * np.sin(p.X / 3.7))) < 0.7)
    p.fill(coast, "wood", 0.3)
    # hills and an island
    for cx, h in ((122, 5), (134, 4), (196, 6)):
        hill = chart & p.poly([(cx - 6, 10), (cx, 10 - h), (cx + 6, 10)]) & ~sea
        p.fill(hill, "paper", 0.45)
    p.fill(p.disc(178, 15, 3) & chart, "paper", 0.7)
    # dotted route
    for i in range(14):
        x = 116 + i * 7
        y = 7 + 6 * math.sin(i / 2.4)
        p.fill(p.disc(x, y, 0.7) & chart, "red", 0.6)
    p.fill(p.line(176, 12, 180, 16, 1) | p.line(180, 12, 176, 16, 1), "red", 0.7)
    # compass rose
    p.fill(p.ring(214, 13, 4, 5), "brass", 0.85)
    p.fill(p.poly([(214, 7), (215.5, 13), (214, 19), (212.5, 13)]), "brass", 1.0)
    p.fill(p.poly([(208, 13), (214, 11.5), (220, 13), (214, 14.5)]), "brass", 0.6)
    # spyglass on the bench
    p.fill(p.poly([(70, 19), (98, 15), (99, 18), (71, 21)]), "brass", 0.65)
    p.fill(p.poly([(86, 17), (98, 15), (99, 18), (87, 19.5)]), "brass", 0.9)
    return p


def production():
    p = Paint()
    backdrop(p, 150)
    # gear train
    for cx, cy, r, t, sh in ((112, 12, 7, 12, 0.7), (128, 7, 4, 8, 0.85), (140, 14, 5, 10, 0.6)):
        p.fill(p.gear(cx, cy, r, t, 1.5, hole=1.6), "brass", p.lit(np.full((H, W), sh + 0.15), cx - 3, cy - 4, 0.12))
        p.fill(p.ring(cx, cy, r * 0.45, r * 0.6), "brass", 0.35)
    # dial bank
    for i, cx in enumerate((164, 184, 204)):
        p.fill(p.disc(cx, 10, 7), "brass", 0.55)
        p.fill(p.disc(cx, 10, 5.6), "cream", p.lit(np.full((H, W), 0.95), cx - 2, 7, 0.15))
        for k in range(5):
            a = math.pi * (0.85 + 0.325 * k)
            p.fill(p.line(cx + 4.2 * math.cos(a), 10 + 4.2 * math.sin(a), cx + 5.2 * math.cos(a), 10 + 5.2 * math.sin(a), 0.9), "ink", 0.4)
        a = math.pi * (1.1 + 0.3 * i)
        p.fill(p.line(cx, 10, cx + 4 * math.cos(a), 10 + 4 * math.sin(a), 1), "red", 0.75)
        p.fill(p.disc(cx, 10, 0.9), "ink", 0.2)
    # pipe and ledger strip
    p.fill(p.rect(150, 18, 232, 19), "brass", 0.5)
    p.fill(p.rect(216, 3, 232, 17), "paper", 0.8)
    for y in (6, 9, 12, 15):
        p.fill(p.rect(218, y, 230 - (y % 4), y + 1), "ink", 0.6)
    return p


def settings():
    p = Paint()
    backdrop(p, 175)
    # escapement wheel, pallet and balance
    p.fill(p.gear(150, 11, 8, 15, 1.8, phase=0.2, hole=2.0), "brass", p.lit(np.full((H, W), 0.8), 146, 6, 0.1))
    p.fill(p.ring(150, 11, 3.5, 4.5) | p.line(150, 3, 150, 19, 1) | p.line(142, 11, 158, 11, 1), "brass", 0.35)
    p.fill(p.poly([(160, 3), (170, 8), (168, 9), (160, 6)]), "steel", 0.75)
    p.fill(p.ring(186, 11, 6, 7.4), "brass", 0.85)
    p.fill(p.line(180, 11, 192, 11, 1) | p.line(186, 5, 186, 17, 1), "brass", 0.6)
    # hairspring
    t = np.arctan2(p.Y - 11, p.X - 186) % (2 * math.pi)
    r = np.hypot(p.X - 186, p.Y - 11)
    spiral = (np.abs(((r - t / (2 * math.pi) * 1.4) % 1.4) - 0.7) < 0.32) & (r < 5) & (r > 1.2)
    p.fill(spiral, "steel", 0.85)
    # screwdriver and screws
    p.fill(p.poly([(204, 19), (226, 11), (227, 13), (205, 20.5)]), "steel", 0.7)
    p.fill(p.poly([(222, 12.5), (232, 9), (233, 11.5), (223, 15)]), "wood", 0.7)
    for x in (98, 106, 114):
        p.fill(p.disc(x, 17, 1.6), "brass", 0.85)
        p.fill(p.line(x - 1.2, 17, x + 1.2, 17, 0.6), "brass", 0.3)
    p.fill(p.gear(124, 13, 3, 6, 1.0, hole=0.8), "brass", 0.6)
    return p


def hub():
    p = Paint()
    # dusk sky, then the workshop front
    p.fill(p.rect(0, 0, W, H), "night", p.vgrad(0.95, 0.4))
    p.fill(p.rect(0, 16, W, H), "board", 0.35)
    body = p.rect(118, 6, 206, 19)
    p.fill(body, "brick", p.lit(np.full((H, W), 0.6), 160, 12, 0.04))
    bricks = body & (((p.Y.astype(int)) % 3 == 0) | (((p.X.astype(int) + (p.Y.astype(int) // 3) * 3) % 6) == 0))
    p.fill(bricks, "brick", 0.25)
    p.fill(p.poly([(112, 7), (162, -2), (212, 7)]), "patina", p.vgrad(0.75, 0.4))
    p.fill(p.rect(112, 6, 212, 7), "patina", 0.25)
    # doors, windows, lamp light
    p.fill(p.rect(152, 10, 168, 19), "wood", 0.45)
    p.fill(p.rect(159.5, 10, 160.5, 19), "wood", 0.15)
    for x in (126, 138, 178, 190):
        p.fill(p.rect(x, 9, x + 7, 14), "glow", 0.75)
        p.fill(p.rect(x + 3, 9, x + 4, 14) | p.rect(x, 11, x + 7, 12), "wood", 0.25)
    # clock over the door
    p.fill(p.disc(160, 2.5, 2.8), "brass", 0.9)
    p.fill(p.disc(160, 2.5, 2), "cream", 0.95)
    p.fill(p.line(160, 2.5, 160, 1, 0.6) | p.line(160, 2.5, 161.3, 2.5, 0.6), "ink", 0.3)
    # chimney and smoke
    p.fill(p.rect(196, 0, 200, 4), "brick", 0.4)
    # windmill to the right
    p.fill(p.poly([(222, 19), (226, 7), (228, 7), (232, 19)]), "wood", 0.5)
    for a in (0.3, 0.3 + math.pi / 2, 0.3 + math.pi, 0.3 + 1.5 * math.pi):
        p.fill(p.line(227, 7, 227 + 7 * math.cos(a), 7 + 7 * math.sin(a), 1.2), "cream", 0.7)
    # belt running in
    p.fill(p.rect(60, 17, 118, 19), "steel", 0.4)
    for x in range(62, 118, 8):
        p.fill(p.rect(x, 15, x + 3, 17), "cu", 0.6)
    return p


def milestones():
    p = Paint()
    backdrop(p, 165)
    # stacked crates
    for x, y, w, h in ((124, 9, 18, 10), (144, 11, 14, 8), (130, 1, 12, 8)):
        c = p.rect(x, y, x + w, y + h)
        p.fill(c, "wood", p.lit(np.full((H, W), 0.7), x + 4, y, 0.08))
        p.fill(c & (p.line(x, y, x + w, y + h, 1) | p.line(x, y + h, x + w, y, 1)), "wood", 0.35)
        p.fill(c & ~p.rect(x + 1, y + 1, x + w - 1, y + h - 1), "wood", 0.2)
    # wax seal on the front crate
    p.fill(p.disc(133, 14, 2.4), "red", 0.75)
    # flag on a pole
    p.fill(p.rect(176, 1, 177, 19), "brass", 0.6)
    p.fill(p.poly([(177, 2), (194, 4), (190, 6.5), (194, 9), (177, 9)]), "red", p.lit(np.full((H, W), 0.85), 180, 3, 0.1))
    p.fill(p.gear(184, 5.5, 1.6, 6, 0.6), "cream", 0.9)
    # medal ribbons
    for x, s in ((206, 0.8), (218, 0.6)):
        p.fill(p.poly([(x - 2, 1), (x + 2, 1), (x + 3, 9), (x - 3, 9)]), "red", s)
        p.fill(p.disc(x, 12, 4), "brass", 0.85)
        p.fill(p.disc(x, 12, 2.4), "brass", 0.55)
    # blueprint scroll
    p.fill(p.rect(96, 15, 118, 19), "print", 0.55)
    p.fill(p.disc(96, 17, 2), "print", 0.8)
    return p


SCENES = {"research": research, "expedition": expedition, "production": production,
          "settings": settings, "hub": hub, "milestones": milestones}


def frame():
    """24 x 24 riveted frame. Corners carry an L bracket; edges are a two-tone brass bar. border-image slice 8."""
    p = Paint(24, 24)
    p.fill(p.rect(0, 0, 24, 24), "night", 0.3)
    bar = ~p.rect(3, 3, 21, 21)
    p.fill(bar, "brass", 0.55)
    p.fill(bar & (p.rect(0, 0, 24, 1) | p.rect(0, 0, 1, 24)), "brass", 0.95)
    p.fill(bar & (p.rect(0, 23, 24, 24) | p.rect(23, 0, 24, 24)), "brass", 0.25)
    p.fill(p.rect(2, 2, 22, 3) | p.rect(2, 2, 3, 22) | p.rect(21, 2, 22, 22) | p.rect(2, 21, 22, 22), "brass", 0.15)
    for cx, cy in ((0, 0), (24, 0), (0, 24), (24, 24)):
        sx = 1 if cx == 0 else -1
        sy = 1 if cy == 0 else -1
        br = (p.rect(min(cx, cx + sx * 8), min(cy, cy + sy * 8), max(cx, cx + sx * 8), max(cy, cy + sy * 8))
              & ~p.rect(min(cx + sx * 5, cx + sx * 8), min(cy + sy * 5, cy + sy * 8),
                        max(cx + sx * 5, cx + sx * 8), max(cy + sy * 5, cy + sy * 8)))
        p.fill(br, "brass", 0.8)
        p.fill(p.disc(cx + sx * 2.5, cy + sy * 2.5, 1.2), "brass", 1.0)
    img = np.array(p.render(fade=False))
    a = np.full(img.shape[:2], 255, np.uint8)
    a[3:21, 3:21] = 0
    return Image.fromarray(np.dstack([img, a]), "RGBA")


def grain():
    p = Paint(32, 32)
    rng = np.random.default_rng(7)
    n = rng.random((32, 32)) * 0.18
    streak = 0.08 * np.sin(p.Y * 1.3 + 2 * np.sin(p.X / 5))
    p.fill(p.rect(0, 0, 32, 32), "night", 0.42 + n + streak)
    return p.render(fade=False)


def rule():
    """8 x 6 tiling section rule: a bright brass line over a dark groove with a rivet every tile."""
    p = Paint(8, 6)
    p.fill(p.rect(0, 0, 8, 6), "night", 0.0)
    p.fill(p.rect(0, 2, 8, 3), "brass", 0.85)
    p.fill(p.rect(0, 3, 8, 4), "brass", 0.2)
    p.fill(p.disc(4, 2.5, 1.3), "brass", 1.0)
    img = np.array(p.render(fade=False))
    a = np.zeros(img.shape[:2], np.uint8)
    a[2:4, :] = 255
    a[1:5, 3:5] = 255
    return Image.fromarray(np.dstack([img, a]), "RGBA")


G = 12
GLYPHS = ["sound", "display", "numbers", "save", "orders", "milestones", "ledger", "power"]


def glyph(name):
    p = Paint(G, G)
    p.fill(p.rect(0, 0, G, G), "night", 0.0)
    keep = np.zeros((G, G), bool)

    def put(m, ramp, sh):
        nonlocal keep
        p.fill(m, ramp, sh)
        keep |= m

    lit = p.lit(np.full((G, G), 0.95), 3, 2, 0.15)
    if name == "sound":  # brass bell
        put(p.poly([(3, 9), (4, 3), (6, 1.5), (8, 3), (9, 9)]), "brass", lit)
        put(p.rect(2, 9, 10, 10.5), "brass", 0.5)
        put(p.disc(6, 11, 1.1), "brass", 0.8)
    elif name == "display":  # oil lamp with flame
        put(p.disc(6, 3.5, 2.2), "glow", 0.85)
        put(p.rect(4, 6, 8, 10), "brass", lit)
        put(p.rect(3, 10, 9, 11.5), "brass", 0.45)
    elif name == "numbers":  # counter wheels
        for x in (1, 4.5, 8):
            put(p.rect(x, 2, x + 3, 10), "cream", 0.85)
            put(p.rect(x, 5.5, x + 3, 6.5), "ink", 0.5)
        put(p.rect(0, 1, 12, 2) | p.rect(0, 10, 12, 11), "brass", 0.6)
    elif name == "save":  # sealed crate
        put(p.rect(1, 3, 11, 11), "wood", lit)
        put(p.rect(1, 3, 11, 11) & (p.line(1, 3, 11, 11, 1) | p.line(1, 11, 11, 3, 1)), "wood", 0.3)
        put(p.disc(6, 7, 1.6), "red", 0.75)
    elif name == "orders":  # work slip on a nail
        put(p.poly([(2, 2), (10, 1.5), (10.5, 11), (2.5, 11)]), "paper", 0.85)
        for y in (5, 7, 9):
            put(p.rect(4, y, 9, y + 1), "ink", 0.6)
        put(p.disc(6, 2.5, 1), "brass", 0.9)
    elif name == "milestones":  # pennant
        put(p.rect(2, 1, 3, 12), "brass", 0.6)
        put(p.poly([(3, 1.5), (11, 3.5), (3, 7)]), "red", lit)
    elif name == "ledger":  # open book
        put(p.poly([(0.5, 3), (6, 4), (6, 11), (0.5, 10)]), "paper", 0.9)
        put(p.poly([(6, 4), (11.5, 3), (11.5, 10), (6, 11)]), "paper", 0.7)
        put(p.rect(5.5, 4, 6.5, 11), "wood", 0.4)
    elif name == "power":  # windmill sails
        for a in (0.4, 0.4 + math.pi / 2, 0.4 + math.pi, 0.4 + 1.5 * math.pi):
            put(p.line(6, 6, 6 + 5 * math.cos(a), 6 + 5 * math.sin(a), 1.6), "cream", 0.8)
        put(p.disc(6, 6, 1.4), "brass", 0.9)
    img = np.array(p.render(fade=False))
    return Image.fromarray(np.dstack([img, np.where(keep, 255, 0).astype(np.uint8)]), "RGBA")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in SCENES.items():
        fn().render().save(OUT / f"banner-{name}.png", optimize=True)
    frame().save(OUT / "frame.png", optimize=True)
    grain().save(OUT / "grain.png", optimize=True)
    rule().save(OUT / "rule.png", optimize=True)
    sheet = Image.new("RGBA", (G * len(GLYPHS), G))
    for i, g in enumerate(GLYPHS):
        sheet.paste(glyph(g), (i * G, 0))
    sheet.save(OUT / "glyphs.png", optimize=True)
    if "--preview" in sys.argv:
        out = sys.argv[sys.argv.index("--preview") + 1]
        sheet = Image.new("RGB", (W * 3, (H * 3 + 6) * len(SCENES)), (0, 0, 0))
        for i, name in enumerate(SCENES):
            im = Image.open(OUT / f"banner-{name}.png").resize((W * 3, H * 3), Image.NEAREST)
            sheet.paste(im, (0, i * (H * 3 + 6)))
        sheet.save(out)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
