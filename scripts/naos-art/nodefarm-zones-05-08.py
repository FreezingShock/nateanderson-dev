"""Node Farm staged zone art for zones 05 to 08: Fab Cleanroom (silicon), Crystal Vault (quartz), Signal Void (aether) and
Glyph Hall (runes). Follows the zone art contract v1 (see docs/node-farm.md, "Zone art").

Each zone gets one sheet: 8 rows (stage 0..7) by 6 columns (animation frames), 288 x 64 art pixels per cell. Row 0 is the
backdrop alone. Row n adds sprite n to row n-1, so a stage change reads as "something new appeared". Sprite n is a bigger,
richer version of the zone's 32 px icon: tiers 1..6 follow the zone's button names (Die, Wafer, Batch...) and sprite 7 is
the capstone. Sprites sit on one floor line, small ones on the left, big ones on the right; sprite 7 stands left of the
quiet top-right corner (the big number sits there) and sprite 6 takes the far right.

Everything is procedural and original: flat shapes shaded through a 4x4 Bayer threshold into five-step colour ramps. Zone
ramps come from nodefarm-icons.py; each zone adds two deeper or hotter shade ramps of its own hue (ZONE_RAMPS below), so a
zone stays in one colour family with several saturations. Backdrop pixels use only the two darkest shades at alpha <= 90.

Run:  python3 scripts/naos-art/nodefarm-zones-05-08.py              (all four zones)
      python3 scripts/naos-art/nodefarm-zones-05-08.py silicon      (one zone)
      python3 scripts/naos-art/nodefarm-zones-05-08.py --preview    (also writes contact sheets + GIFs to $NF_ZONE_PREVIEW)
Output: public/naos/nodefarm/zone-<statId>.{png,webp}
"""
import importlib.util
import math
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / "public" / "naos" / "nodefarm"
PREVIEW = Path(os.environ.get("NF_ZONE_PREVIEW", "/tmp/nf-zone-preview"))

_spec = importlib.util.spec_from_file_location("nodefarm_icons", HERE / "nodefarm-icons.py")
nfi = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(nfi)

CW, CH = 288, 64      # one cell, art pixels
FRAMES = 6            # 6 fps loop
STAGES = 7            # rows 1..7 (row 0 is the backdrop)
BY = CH - 1           # floor row: every sprite stands on it
QUIET = (252, 0, 288, 30)  # top-right box under the big number and its two sub-lines: backdrop only


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def ramp(*cols):
    return [hexc(c) for c in cols]


RAMPS = dict(nfi.RAMPS)
# Extra shade ramps, two per zone, each inside the zone's own hue family.
ZONE_RAMPS = {
    "si2": ramp("#0a0f22", "#1b2756", "#35509e", "#5f86f0", "#a9c3ff"),   # silicon: deep steel blue
    "sic": ramp("#081a2a", "#13456a", "#2a82b0", "#56c4f0", "#cdf2ff"),   # silicon: laser blue
    "qz2": ramp("#1a0a2e", "#45207a", "#7a3fc0", "#b07cf0", "#e6d4ff"),   # quartz: violet
    "qzp": ramp("#2e0726", "#7a1a63", "#c03a9a", "#f07ad0", "#ffd8f2"),   # quartz: rose
    "ae2": ramp("#03201f", "#0b5560", "#1f9aa8", "#55e0e0", "#d4ffff"),   # aether: teal
    "aey": ramp("#0e2410", "#2a6a24", "#5cb83a", "#a8f06b", "#efffd6"),   # aether: lime
    "rno": ramp("#2a1204", "#7a3a0c", "#c26416", "#ff9a3a", "#ffe0b8"),   # runes: ember
    "st": ramp("#16140f", "#2e2a22", "#4a4438", "#6e6655", "#a39a85"),    # runes: warm stone
}
RAMPS.update(ZONE_RAMPS)
BAYER4 = nfi.BAYER[:4, :4] if nfi.BAYER.shape[0] >= 4 else nfi.BAYER
WHITE = (255, 255, 255)


class Canvas:
    """RGBA art buffer with dithered ramp fills. Shapes paint over what is under them; glow only paints empty pixels."""

    def __init__(self, w=CW, h=CH):
        self.w, self.h = w, h
        self.img = np.zeros((h, w, 4), np.uint8)
        self.yy, self.xx = np.mgrid[0:h, 0:w].astype(float)
        self.bay = np.tile(BAYER4, (h // 4 + 1, w // 4 + 1))[:h, :w]

    # ---- masks
    def poly(self, pts):
        s = 4
        im = Image.new("L", (self.w * s, self.h * s), 0)
        ImageDraw.Draw(im).polygon([(x * s, y * s) for x, y in pts], fill=255)
        return np.asarray(im.resize((self.w, self.h), Image.BOX)) > 127

    def disc(self, cx, cy, r, ry=None):
        ry = ry or r
        return ((self.xx + .5 - cx) / r) ** 2 + ((self.yy + .5 - cy) / ry) ** 2 <= 1

    def ring(self, cx, cy, r, ry=None, w=1.0):
        ry = ry or r
        d = ((self.xx + .5 - cx) / r) ** 2 + ((self.yy + .5 - cy) / ry) ** 2
        inner = ((self.xx + .5 - cx) / max(r - w, .5)) ** 2 + ((self.yy + .5 - cy) / max(ry - w, .5)) ** 2
        return (d <= 1) & (inner > 1)

    def rect(self, x0, y0, x1, y1):
        return (self.xx >= x0) & (self.xx < x1) & (self.yy >= y0) & (self.yy < y1)

    def seg(self, x0, y0, x1, y1, w=1.0):
        dx, dy = x1 - x0, y1 - y0
        L2 = dx * dx + dy * dy or 1
        t = np.clip(((self.xx + .5 - x0) * dx + (self.yy + .5 - y0) * dy) / L2, 0, 1)
        return np.hypot(self.xx + .5 - (x0 + t * dx), self.yy + .5 - (y0 + t * dy)) <= w / 2 + 0.25

    def lin(self, x0, y0, x1, y1):
        dx, dy = x1 - x0, y1 - y0
        return np.clip(((self.xx - x0) * dx + (self.yy - y0) * dy) / (dx * dx + dy * dy or 1), 0, 1)

    def ang(self, cx, cy):
        return np.arctan2(self.yy + .5 - cy, self.xx + .5 - cx)

    # ---- paint
    def fill(self, mask, v, rampname, outline=True, dith=0.9):
        r = RAMPS[rampname]
        v = np.broadcast_to(np.asarray(v, float), mask.shape)
        idx = np.clip(np.floor(v * (len(r) - 1) + 0.5 + self.bay * dith), 0, len(r) - 1).astype(int)
        for i, c in enumerate(r):
            self.img[mask & (idx == i)] = (*c, 255)
        if outline:
            self.outline(mask, rampname)

    def outline(self, mask, rampname, idx=0):
        d = np.zeros_like(mask)
        d[1:, :] |= mask[:-1, :]; d[:-1, :] |= mask[1:, :]; d[:, 1:] |= mask[:, :-1]; d[:, :-1] |= mask[:, 1:]
        self.img[d & ~mask & (self.img[..., 3] == 0)] = (*RAMPS[rampname][idx], 255)

    def set(self, mask, col):
        if isinstance(col, str):
            col = hexc(col)
        self.img[mask] = (*col, 255)

    def glow(self, cx, cy, r, rampname, peak=0.5, power=1.4, idx=1, ry=None):
        """Dithered halo behind the art, only on empty pixels: dense near the centre, gone at r."""
        # Strong halo (Nate's pick, 2026-11-12): wider and denser, with a brighter inner ring of the next shade up.
        r, ry = r * 1.25, (ry or r) * 1.25
        peak = min(0.95, peak * 1.6)
        d = np.clip(np.hypot((self.xx + .5 - cx) / r, (self.yy + .5 - cy) / ry), 0, 1)
        dens = peak * (1 - d) ** power
        empty = self.img[..., 3] == 0
        m = (dens > self.bay + 0.5) & empty
        self.img[m] = (*RAMPS[rampname][idx], 255)
        inner = m & (d < 0.42) & ((dens - 0.35) > self.bay + 0.5)
        self.img[inner] = (*RAMPS[rampname][idx + 1], 255)

    def haze(self, mask, dens, rampname, idx=1):
        m = mask & (np.broadcast_to(dens, mask.shape) > self.bay + 0.5) & (self.img[..., 3] == 0)
        self.img[m] = (*RAMPS[rampname][idx], 255)

    def px(self, x, y, col):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.w and 0 <= y < self.h:
            self.img[y, x] = (*(hexc(col) if isinstance(col, str) else col), 255)

    def star(self, x, y, arm, col, core=WHITE):
        for d in range(-arm, arm + 1):
            if d:
                self.px(x + d, y, col)
                self.px(x, y + d, col)
        self.px(x, y, core)

    def lighten(self, mask, amt):
        out = self.img.astype(float)
        m = mask & (self.img[..., 3] > 0)
        out[m, :3] += (255 - out[m, :3]) * amt
        self.img = out.astype(np.uint8)

    def shadow(self, cx, cy, rx, ry, rampname, idx=0):
        d = ((self.xx + .5 - cx) / rx) ** 2 + ((self.yy + .5 - cy) / ry) ** 2
        m = (d <= 1) & ((1 - d) * 0.9 > self.bay + 0.5) & (self.img[..., 3] == 0)
        self.img[m] = (*RAMPS[rampname][idx], 255)


class Backdrop:
    """Faint layer under the sprites: only shades 0 and 1 of a ramp, alpha <= 90."""

    def __init__(self):
        self.img = np.zeros((CH, CW, 4), np.uint8)
        self.c = Canvas()

    def put(self, mask, rampname, idx=1, alpha=70):
        self.img[mask] = (*RAMPS[rampname][min(idx, 1)], min(alpha, 90))

    def dens(self, dens, rampname, idx=1, alpha=70, mask=None):
        m = np.broadcast_to(dens, (CH, CW)) > self.c.bay + 0.5
        if mask is not None:
            m = m & mask
        self.put(m, rampname, idx, alpha)


def tw(f, phase=0.0):
    """0..1..0 triangle over the 6-frame loop."""
    p = ((f / FRAMES) + phase) % 1.0
    return 1 - abs(2 * p - 1)


def sn(f, phase=0.0, cycles=1):
    return math.sin(2 * math.pi * (cycles * f / FRAMES + phase))


def floor_glow(c, cx, w, rampname, f=0, h=3):
    """A dithered pool of light on the floor under a sprite."""
    c.shadow(cx, BY + 0.5, w, h, rampname, 1)


# =============================================================================================== 05 FAB CLEANROOM (silicon)
def wafer(c, cx, cy, r, f, scan=True, tilt=0.42, thick=2, lit=True):
    """A silicon wafer: dithered top face with a die grid, a thin edge, and a laser line that sweeps the grid."""
    ry = r * tilt
    edge = c.disc(cx, cy + thick, r, ry) | c.rect(cx - r, cy, cx + r, cy + thick + .5)
    top = c.disc(cx, cy, r, ry)
    c.fill(edge & ~top, 0.18 + 0.25 * c.lin(cx - r, 0, cx + r, 0), "si2")
    c.fill(top, 0.5 + 0.42 * c.lin(cx - r * .8, cy + ry, cx + r * .6, cy - ry), "si")
    if r >= 5:
        gx = max(3, int(r / 3.0))
        gy = max(2, int(gx * tilt + .6))
        grid = top & ((((c.xx - cx) % gx) < 1) | (((c.yy - cy) % gy) < 1)) & c.disc(cx, cy, r - 1.5, max(ry - 1, 1))
        c.set(grid, RAMPS["si"][1])
    else:
        grid = np.zeros_like(top)
    if scan:
        sx = cx - r + 2 * r * ((f % FRAMES) / (FRAMES - 1))
        c.set(top & (np.abs(c.xx + .5 - sx) < 1.0), RAMPS["sic"][4])
        c.lighten(top & (c.xx + .5 < sx - 1) & ~grid, 0.15)
    if lit and r >= 6:
        c.px(cx - r * .45, cy - ry * .3, RAMPS["si"][4])


def die(c, cx, cy, s, f, pins=True, core=True):
    """One chip die at three quarters: diamond top, two lit sides, a core that pulses, pins on both front edges."""
    h = s * 0.55
    top = c.poly([(cx, cy - h), (cx + s, cy), (cx, cy + h), (cx - s, cy)])
    d = max(1.5, s * 0.35)
    side_l = c.poly([(cx - s, cy), (cx, cy + h), (cx, cy + h + d), (cx - s, cy + d)])
    side_r = c.poly([(cx + s, cy), (cx, cy + h), (cx, cy + h + d), (cx + s, cy + d)])
    c.fill(side_l, 0.2, "si2")
    c.fill(side_r, 0.42, "si2")
    c.fill(top, 0.45 + 0.42 * c.lin(cx - s, cy + h, cx + s * .5, cy - h), "si")
    if s >= 6:
        inner = c.poly([(cx, cy - h * .45), (cx + s * .45, cy), (cx, cy + h * .45), (cx - s * .45, cy)])
        c.fill(inner, 0.15, "si2", outline=False)
    if core:
        k = tw(f)
        c.px(cx, cy, RAMPS["sic"][4] if k > .4 else RAMPS["sic"][2])
        if s >= 6 and k > .6:
            c.px(cx - 1, cy, RAMPS["sic"][3]); c.px(cx + 1, cy, RAMPS["sic"][3])
    if pins:
        n = max(2, int(s / 2.4))
        for i in range(1, n + 1):
            t = i / (n + 1)
            for x0, y0 in ((cx - s + s * t, cy + h * t + d), (cx + s - s * t, cy + h * t + d)):
                c.set(c.rect(x0, y0, x0 + 1, y0 + 1.5), RAMPS["wh"][2])


def chuck(c, cx, top, w, h):
    body = c.poly([(cx - w, top), (cx + w, top), (cx + w * .75, top + h), (cx - w * .75, top + h)])
    c.fill(body, 0.15 + 0.4 * c.lin(cx - w, 0, cx + w, 0), "gr")
    c.set(c.rect(cx - w + 1, top, cx + w - 1, top + 1), RAMPS["gr"][3])


def leds(c, x, y, n, f, step=2):
    cols = [RAMPS["si"][4], RAMPS["sic"][4], hexc("#6bffc9")]
    for i in range(n):
        on = ((f + i * 2) % FRAMES) < 3
        c.px(x + i * step, y, cols[i % 3] if on else RAMPS["si2"][1])


def cassette(c, x, y, w, h, f):
    """An open wafer cassette: a frame with wafers seen edge-on in its slots; one slot flashes as it is loaded."""
    inner = c.rect(x + 2, y + 2, x + w - 2, y + h - 1)
    c.fill(c.rect(x, y, x + w, y + h) & ~inner, 0.3 + 0.35 * c.lin(x, y, x + w, y), "gr")
    c.fill(inner, 0.05, "si2", outline=False)
    slots = max(1, (h - 4) // 3)
    hot = f % slots
    for i in range(slots):
        yy = y + 3 + i * 3
        c.set(c.rect(x + 3, yy, x + w - 3, yy + 1), RAMPS["sic"][4] if i == hot else RAMPS["si"][3])
        c.set(c.rect(x + 3, yy + 1, x + w - 3, yy + 2), RAMPS["si"][1])


def beam(c, x, y0, y1, f, w=2):
    """A vertical litho beam: bright core, dithered fringe that breathes."""
    k = tw(f)
    dens = 0.6 * (1 - np.abs(c.xx + .5 - x) / (w + 1)) * (0.65 + 0.35 * k)
    m = c.rect(x - w, y0, x + w + 1, y1) & (dens > c.bay + 0.5)
    c.img[m] = (*RAMPS["sic"][2], 255)
    c.set(c.rect(x - .5, y0, x + .5, y1), RAMPS["sic"][4])


def stepper(c, x, y, w, h, f, colh=None):
    """A lithography tool: housing, lens column, a viewport with the wafer under the beam, status LEDs."""
    cx = x + w // 2
    colw = max(3, w // 6)
    colh = colh or h * 0.45
    col = c.rect(cx - colw, y - colh, cx + colw, y + 1)
    c.fill(col, 0.25 + 0.45 * c.lin(cx - colw, 0, cx + colw, 0), "gr")
    for k in range(int(colh // 4)):
        yy = y - colh + 3 + k * 4
        c.set(c.rect(cx - colw - 1, yy, cx + colw + 1, yy + 1), RAMPS["gr"][4])
    c.fill(c.rect(cx - colw - 2, y - colh - 3, cx + colw + 2, y - colh), 0.55, "gr")
    c.px(cx, y - colh - 2, hexc("#ff2d8a") if f % 3 == 0 else RAMPS["gr"][4])
    body = c.rect(x, y, x + w, y + h)
    c.fill(body, 0.3 + 0.3 * (1 - c.lin(x, y, x + w, y + h)), "si2")
    c.set(c.rect(x, y, x + w, y + 1), RAMPS["si2"][4])
    vx0, vy0, vx1, vy1 = x + 3, y + 3, x + w - 3, y + h - 5
    vp = c.rect(vx0, vy0, vx1, vy1)
    c.set(vp, RAMPS["si2"][0])
    c.set(c.rect(vx0, vy0, vx1, vy0 + 1) | c.rect(vx0, vy1 - 1, vx1, vy1), RAMPS["gr"][2])
    r = min((vx1 - vx0) / 2 - 2, (vy1 - vy0 - 4) / (2 * 0.42))
    wy = vy1 - r * 0.42 - 3
    beam(c, cx, vy0 + 1, wy, f, w=1)
    wafer(c, cx, wy, r, f, scan=True, thick=1)
    leds(c, x + 3, y + h - 3, max(2, (w - 6) // 2), f)


def arm(c, bx, by, ang, l1, l2, f, wr=4):
    """Two-joint wafer robot. ang (radians) for the first link; the second bends back; it carries a wafer."""
    jx, jy = bx + math.cos(ang) * l1, by - math.sin(ang) * l1
    a2 = ang - 1.9
    hx, hy = jx + math.cos(a2) * l2, jy - math.sin(a2) * l2
    c.fill(c.rect(bx - 3, by, bx + 4, BY + 1), 0.35, "gr")
    c.fill(c.seg(bx, by, jx, jy, 2.5), 0.62, "gr")
    c.fill(c.seg(jx, jy, hx, hy, 2), 0.75, "gr")
    c.set(c.disc(bx + .5, by + .5, 1.6), RAMPS["gr"][4])
    c.set(c.disc(jx, jy, 1.2), RAMPS["sic"][4])
    wafer(c, hx, hy - 1, wr, f, scan=False, thick=1)


def si_tower(c, x, y, w, h, f):
    """The fab tower: floors of windows that flicker on in turn, roof plant, a beacon."""
    c.fill(c.rect(x, y, x + w, y + h), 0.2 + 0.3 * c.lin(x, 0, x + w, 0), "si2")
    c.set(c.rect(x, y, x + w, y + 1), RAMPS["si2"][4])
    c.set(c.rect(x + w - 1, y, x + w, y + h), RAMPS["si2"][1])
    rows, cols = (h - 4) // 4, (w - 3) // 3
    rng = np.random.default_rng(55)
    lit = rng.random((rows, cols))
    for i in range(rows):
        for j in range(cols):
            wx, wy = x + 2 + j * 3, y + 3 + i * 4
            on = lit[i, j] < 0.5 or ((i * 5 + j * 2 - f) % FRAMES) == 0
            col = (RAMPS["sic"][3] if (i + j) % 4 else RAMPS["si"][4]) if on else RAMPS["si2"][1]
            c.set(c.rect(wx, wy, wx + 2, wy + 2), col)
    # a band where the line runs, scanning down the tower
    band = y + 3 + ((f * (rows * 4)) // FRAMES)
    c.lighten(c.rect(x + 1, band, x + w - 1, band + 1), 0.35)
    c.fill(c.rect(x + w * .2, y - 4, x + w * .55, y), 0.45, "gr")
    c.fill(c.rect(x + w * .65, y - 7, x + w * .8, y), 0.6, "gr")
    c.set(c.rect(x + w * .62, y - 8, x + w * .83, y - 7), RAMPS["gr"][4])
    on = (f % 3) == 0
    c.set(c.disc(x + w * .38, y - 5.5, 1.3), hexc("#ff2d8a") if on else RAMPS["gr"][2])


def annex(c, x, y, w, h, f, seed):
    c.fill(c.rect(x, y, x + w, y + h), 0.18 + 0.25 * c.lin(x, 0, x + w, 0), "si2")
    c.set(c.rect(x, y, x + w, y + 1), RAMPS["si2"][3])
    for j in range((w - 2) // 3):
        on = ((j + seed + f) % 4) != 0
        c.set(c.rect(x + 2 + j * 3, y + 3, x + 4 + j * 3, y + 4), RAMPS["sic"][3] if on else RAMPS["si2"][1])
    for k in range(0, w - 3, 5):
        c.set(c.rect(x + 2 + k, y - 2, x + 4 + k, y), RAMPS["gr"][2])


def conveyor(c, x0, x1, y, f, items=4):
    c.fill(c.rect(x0, y, x1, y + 2), 0.3, "gr", outline=False)
    span = x1 - x0
    for k in range(span // 3):
        xx = x0 + ((k * 3 + f) % span)
        c.px(xx, y + 1, RAMPS["gr"][1])
    for i in range(items):
        px_ = x0 + 2 + ((i * span / items + f * span / (items * FRAMES)) % (span - 4))
        c.set(c.rect(px_ - 1.5, y - 1, px_ + 1.5, y), RAMPS["si"][3])


def si_sprite(c, n, cx, f):
    if n == 1:      # DIE
        c.glow(cx, BY - 4, 9, "si", 0.4)
        die(c, cx, BY - 5, 5, f, pins=False)
    elif n == 2:    # WAFER on a chuck
        c.glow(cx, BY - 6, 13, "si", 0.4)
        chuck(c, cx, BY - 3, 5, 3)
        wafer(c, cx, BY - 7, 8, f)
    elif n == 3:    # BATCH: stacked wafers and a loose die
        c.glow(cx, BY - 8, 16, "si", 0.4)
        chuck(c, cx - 2, BY - 2, 8, 2)
        for i in range(3):
            wafer(c, cx - 2, BY - 5 - i * 4, 10, f + i * 2, scan=(i == 2))
        die(c, cx + 12, BY - 3, 3, f + 2, pins=False)
    elif n == 4:    # CLEANROOM: cassette, wafer under a lamp arm
        c.glow(cx, BY - 11, 20, "si", 0.4)
        cassette(c, cx - 15, BY - 20, 11, 20, f)
        c.fill(c.rect(cx + 14, BY - 21, cx + 16, BY + 1), 0.5, "gr")
        c.fill(c.rect(cx + 1, BY - 22, cx + 16, BY - 20), 0.6, "gr")
        c.fill(c.rect(cx + 2, BY - 20, cx + 9, BY - 19), 0.85, "sic", outline=False)
        cone = c.poly([(cx + 2, BY - 19), (cx + 9, BY - 19), (cx + 13, BY - 7), (cx - 2, BY - 7)])
        c.haze(cone, 0.32 + 0.12 * tw(f), "sic", 1)
        chuck(c, cx + 5, BY - 4, 6, 4)
        wafer(c, cx + 5, BY - 8, 8, f)
        for k in range(3):
            c.px(cx + 3 + k * 3, BY - 18 + ((k * 4 + f * 2) % 9), RAMPS["si"][3])
    elif n == 5:    # FAB: one stepper fed by a cassette
        c.glow(cx, BY - 15, 26, "si", 0.4)
        stepper(c, cx - 13, BY - 17, 26, 17, f, colh=9)
        cassette(c, cx + 14, BY - 12, 8, 12, f + 3)
        die(c, cx - 17, BY - 3, 3, f, pins=False)
    elif n == 6:    # MEGAFAB: a big stepper, a robot arm swinging a wafer, an exhaust stack
        c.glow(cx, BY - 20, 32, "si", 0.4)
        stepper(c, cx - 8, BY - 22, 30, 22, f, colh=11)
        c.fill(c.rect(cx + 17, BY - 39, cx + 21, BY - 22), 0.35 + 0.35 * c.lin(cx + 17, 0, cx + 21, 0), "gr")
        c.set(c.rect(cx + 16, BY - 40, cx + 22, BY - 38), RAMPS["gr"][3])
        for k in range(3):   # steam puffs rising
            py = BY - 41 - ((f + k * 2) % FRAMES) * 0.0 - k * 2 - (f % 2)
            px_ = cx + 19 + (k - 1) * 2 + sn(f, k / 3)
            c.haze(c.disc(px_, BY - 43 - k * 3 + (f % 3) * -0.5, 2.5 - k * .4), 0.45 - k * .1, "si", 1)
        hx, hy = cx + 7, BY - 40
        c.haze(c.poly([(cx + 5, BY - 33), (cx + 9, BY - 33), (hx + 12, hy + 1), (hx - 12, hy + 1)]), 0.35, "sic", 1)
        holo = c.disc(hx, hy, 12, 5)
        c.set(holo & ((((c.xx - hx) % 3) < 1) | (((c.yy - hy) % 2) < 1)), RAMPS["sic"][2])
        c.set(c.ring(hx, hy, 12, 5, 1), RAMPS["sic"][3])
        sx = hx - 12 + 24 * (f / (FRAMES - 1))
        c.set(holo & (np.abs(c.xx + .5 - sx) < 1), RAMPS["sic"][4])
        a = math.pi / 2 + 0.65 * sn(f)
        arm(c, cx - 16, BY - 6, a, 11, 9, f)
        cassette(c, cx - 25, BY - 13, 8, 13, f)
    elif n == 7:    # FAB TOWER: the whole plant
        c.glow(cx, BY - 28, 34, "si", 0.38, ry=36)
        si_tower(c, cx - 10, BY - 46, 20, 46, f)
        annex(c, cx - 27, BY - 16, 17, 16, f, 0)
        annex(c, cx + 10, BY - 20, 16, 20, f, 2)
        beam(c, cx - 2.5, BY - 61, BY - 54, f, w=1)
        conveyor(c, cx - 27, cx + 26, BY - 2, f, items=4)


def si_backdrop(b, f):
    """Circuit traces with a pulse running along them, a faint die grid on the floor."""
    c = b.c
    rng = np.random.default_rng(5)
    traces = np.zeros((CH, CW), bool)
    paths = []
    for k in range(18):
        y = int(rng.integers(4, 54))
        x0 = int(rng.integers(0, 200)); x1 = x0 + int(rng.integers(30, 90))
        y2 = y + int(rng.choice([-8, -5, 5, 8]))
        xm = (x0 + x1) // 2
        pts = [(x0, y), (xm, y), (xm + abs(y2 - y), y2), (x1, y2)]
        paths.append(pts)
        for a, bpt in zip(pts, pts[1:]):
            traces |= c.seg(*a, *bpt, 1)
        pads = c.rect(x0 - 1, y - 1, x0 + 2, y + 2) | c.rect(x1 - 1, y2 - 1, x1 + 2, y2 + 2)
        traces |= pads
        b.put(pads, "sic", 1, 80)
    b.put(traces & ~(b.img[..., 3] > 0), "si", 0, 85)
    sweep = int((f / FRAMES) * CH * 1.5) % CH
    b.dens(0.5, "sic", 1, 70, mask=c.rect(0, sweep, CW, sweep + 1) & ~traces)
    for k, pts in enumerate(paths):
        L = [math.dist(a, q) for a, q in zip(pts, pts[1:])]
        t = ((f / FRAMES + k * 0.37) % 1.0) * sum(L)
        for (a, q), l in zip(zip(pts, pts[1:]), L):
            if t <= l:
                x = a[0] + (q[0] - a[0]) * t / l; y = a[1] + (q[1] - a[1]) * t / l
                b.put(c.rect(x - 1, y, x + 2, y + 1), "sic" if k % 2 else "si", 1, 90)
                break
            t -= l
    grid = ((c.xx % 6) < 1) | ((c.yy % 3) < 1)
    b.dens(0.35 * c.lin(0, CH - 10, 0, CH), "si2", 1, 60, mask=grid & (c.yy > CH - 10))


# =============================================================================================== 06 CRYSTAL VAULT (quartz)
def crystal(c, cx, by, w, h, f, rp="qz", lean=0.0, glint=True, phase=0.0):
    """A pointed prism: four faces shaded left to right, a bright cap, a lit edge; a glint slides up it on part of the loop."""
    top = by - h
    sh = top + max(2, w * 0.55)
    xs = [cx - w / 2, cx - w * .18, cx + w * .12, cx + w / 2]
    lx = lambda y: lean * (by - y) / h
    shades = [0.3, 0.62, 0.86, 0.45]
    faces = []
    for i in range(3):
        x0, x1 = xs[i], xs[i + 1]
        pts = [(x0 + lx(sh), sh), (x1 + lx(sh), sh), (x1, by), (x0, by)]
        m = c.poly(pts)
        faces.append(m)
        c.fill(m, shades[i] - 0.15 * c.lin(0, sh, 0, by), rp, outline=False)
    cap = c.poly([(xs[0] + lx(sh), sh), (cx + lx(top), top), (xs[3] + lx(sh), sh)])
    capl = c.poly([(xs[0] + lx(sh), sh), (cx + lx(top), top), (xs[1] + lx(sh), sh)])
    c.fill(cap, 0.95, rp, outline=False)
    c.fill(capl, 0.6, rp, outline=False)
    allm = cap | faces[0] | faces[1] | faces[2]
    c.outline(allm, rp)
    if w >= 4:
        c.set(c.seg(xs[1] + lx(sh) + .5, sh + 1, xs[1] + .5, by - 1, 1) & allm, RAMPS[rp][4])
    if glint and h >= 8:
        p = ((f / FRAMES) + phase) % 1.0
        if p < 0.5:
            gy = by - (h + 4) * (p / 0.5)
            band = allm & (np.abs((c.yy + .5 - gy) + (c.xx + .5 - cx) * 0.6) < 1.0)
            c.set(band, RAMPS[rp][4])
    return allm


def rock(c, cx, by, w, h, rp="gr", seed=0):
    rng = np.random.default_rng(seed)
    n = 9
    pts = []
    for i in range(n + 1):
        a = math.pi * i / n
        r = 1 - 0.18 * rng.random()
        pts.append((cx - math.cos(a) * w * r, by - math.sin(a) * h * r))
    m = c.poly(pts + [(cx + w, by), (cx - w, by)])
    c.fill(m, 0.2 + 0.4 * (1 - c.lin(cx - w, by - h, cx + w, by)), rp)
    return m


def ring_pulse(c, cx, cy, f, maxr, rp, ry_k=0.32, n=2):
    """Resonance rings expanding along the floor."""
    for k in range(n):
        p = ((f / FRAMES) + k / n) % 1.0
        r = 3 + p * maxr
        m = c.ring(cx, cy, r, r * ry_k, 1) & (c.img[..., 3] == 0)
        c.set(m & ((c.xx.astype(int) + c.yy.astype(int)) % 2 == 0) if p > .6 else m, RAMPS[rp][3 if p < .5 else 2])


def qz_sprite(c, n, cx, f):
    if n == 1:      # SHARD
        c.glow(cx, BY - 4, 8, "qz", 0.4)
        crystal(c, cx, BY, 3, 8, f, glint=False)
    elif n == 2:    # CRYSTAL
        c.glow(cx, BY - 6, 11, "qz", 0.45)
        crystal(c, cx, BY, 5, 12, f, phase=.2)
        crystal(c, cx + 4, BY, 2, 5, f, rp="qz2", glint=False, lean=1)
    elif n == 3:    # CLUSTER
        c.glow(cx, BY - 8, 15, "qz", 0.45)
        crystal(c, cx - 6, BY, 5, 10, f, rp="qz2", lean=-2, phase=.5)
        crystal(c, cx + 6, BY, 5, 9, f, rp="qz2", lean=2, phase=.7)
        crystal(c, cx, BY, 7, 16, f, phase=.1)
    elif n == 4:    # LATTICE: a cluster held in a glowing wire lattice
        c.glow(cx, BY - 11, 20, "qz", 0.45)
        nodes = [(cx - 12, BY - 4), (cx - 8, BY - 15), (cx, BY - 21), (cx + 8, BY - 15), (cx + 12, BY - 4), (cx, BY - 9)]
        for i, a in enumerate(nodes):
            for b in nodes[i + 1:]:
                if math.dist(a, b) < 14:
                    c.set(c.seg(*a, *b, 1) & (c.img[..., 3] == 0) & (((c.xx + c.yy) % 2) == 0), RAMPS["qz2"][2])
        crystal(c, cx - 5, BY, 5, 12, f, rp="qz2", lean=-2, phase=.4)
        crystal(c, cx + 5, BY, 5, 13, f, rp="qz2", lean=2, phase=.6)
        crystal(c, cx, BY, 7, 20, f)
        for i, (x, y) in enumerate(nodes[:5]):
            on = (f + i) % FRAMES < 2
            c.set(c.rect(x - 1, y - 1, x + 1, y + 1), RAMPS["qzp"][4] if on else RAMPS["qz"][3])
    elif n == 5:    # GEODE: a split stone, crystals inside
        c.glow(cx, BY - 14, 26, "qzp", 0.4)
        shell = rock(c, cx, BY, 17, 29, "gr", seed=3)
        cav = c.disc(cx, BY - 2, 13, 24)
        c.fill(cav & shell, 0.1 + 0.25 * c.lin(0, BY - 26, 0, BY), "qz2", outline=False)
        c.set(c.ring(cx, BY - 2, 13.5, 24.5, 1) & shell, RAMPS["gr"][4])
        for i, (dx, w, h, lean) in enumerate([(-8, 4, 10, -2), (8, 4, 11, 2), (-4, 5, 16, -1), (4, 5, 15, 1), (0, 6, 22, 0)]):
            crystal(c, cx + dx, BY, w, h, f, rp=["qzp", "qzp", "qz2", "qz2", "qz"][i], lean=lean, phase=i * .17)
        for k, (dx, dy) in enumerate([(-6, -20), (6, -18), (0, -25)]):   # roof crystals point down
            pts = [(cx + dx - 2, BY + dy - 2), (cx + dx + 2, BY + dy - 2), (cx + dx, BY + dy + 3)]
            c.fill(c.poly(pts) & cav, 0.75, "qzp", outline=False)
        if f % 3 == 1:
            c.star(cx + 7, BY - 15, 1, RAMPS["qzp"][4])
    elif n == 6:    # CAVERN: a stone arch, crystals up from the floor and down from the roof, resonance rings
        c.glow(cx, BY - 18, 30, "qz", 0.4)
        ring_pulse(c, cx, BY - 1, f, 24, "qz2")
        arch = c.poly([(cx - 25, BY), (cx - 24, BY - 26), (cx - 16, BY - 38), (cx, BY - 40), (cx + 16, BY - 37), (cx + 24, BY - 27), (cx + 25, BY),
                       (cx + 16, BY), (cx + 15, BY - 24), (cx + 8, BY - 31), (cx - 8, BY - 32), (cx - 15, BY - 24), (cx - 16, BY)])
        c.fill(arch, 0.22 + 0.35 * c.lin(cx - 25, BY - 40, cx + 25, BY), "gr")
        c.set(c.seg(cx - 22, BY - 28, cx - 12, BY - 36, 1) & arch, RAMPS["gr"][3])
        for i, (dx, w, h, lean, rp) in enumerate([(-11, 5, 10, -2, "qzp"), (11, 5, 12, 2, "qzp"), (-5, 6, 20, -1, "qz2"), (5, 6, 18, 1, "qz2"), (0, 8, 28, 0, "qz")]):
            crystal(c, cx + dx, BY, w, h, f, rp=rp, lean=lean, phase=i * .19)
        for dx, h in [(-9, 6), (-3, 5), (4, 7), (10, 4)]:
            pts = [(cx + dx - 2, BY - 31), (cx + dx + 2, BY - 31), (cx + dx, BY - 31 + h)]
            c.fill(c.poly(pts), 0.7, "qzp")
        crystal(c, cx - 21, BY, 3, 6, f, rp="qz2", glint=False)
        crystal(c, cx + 21, BY, 3, 7, f, rp="qz2", glint=False)
        for k, (sx, sy) in enumerate([(cx - 6, BY - 26), (cx + 7, BY - 22), (cx, BY - 34)]):
            if (f + k * 2) % FRAMES < 2:
                c.star(sx, sy, 1, RAMPS["qzp"][4])
    elif n == 7:    # RESONANCE SPIRE: one huge crystal with shards orbiting it
        c.glow(cx, BY - 28, 32, "qz", 0.42, ry=34)
        ring_pulse(c, cx, BY - 1, f, 26, "qz", n=3)
        for i, (dx, w, h, lean, rp) in enumerate([(-15, 6, 16, -4, "qzp"), (15, 6, 18, 4, "qzp"), (-8, 8, 30, -2, "qz2"), (8, 8, 32, 2, "qz2")]):
            crystal(c, cx + dx, BY, w, h, f, rp=rp, lean=lean, phase=i * .2)
        crystal(c, cx, BY, 13, 54, f, phase=0.0)
        for k in range(4):     # orbiting shards: in front on the low half of the orbit, behind on the top half
            a = 2 * math.pi * (f / FRAMES + k / 4)
            sx = cx + math.cos(a) * 20
            sy = BY - 30 + math.sin(a) * 5
            pts = [(sx, sy - 3), (sx + 1.5, sy), (sx, sy + 3), (sx - 1.5, sy)]
            m = c.poly(pts)
            if math.sin(a) < 0:
                m &= c.img[..., 3] == 0
            c.fill(m, 0.8, "qzp" if k % 2 else "qz", outline=False)
        if f % 3 == 0:
            c.star(cx - 2, BY - 44, 2, RAMPS["qz"][4])


def qz_backdrop(b, f):
    """A faint diamond lattice with nodes that wake in turn."""
    c = b.c
    a = (c.xx + c.yy * 2) % 16
    d = (c.xx - c.yy * 2) % 16
    lines = (a < 1) | (d < 1)
    b.dens(0.15 + 0.55 * c.lin(0, 0, 0, CH), "qz", 0, 75, mask=lines)
    nodes = (a < 1) & (d < 1)
    k = (((c.xx // 12).astype(int) * 3 + (c.yy // 6).astype(int) * 5 + f) % FRAMES) == 0
    b.put(nodes & k, "qzp", 1, 90)
    b.put(nodes & ~k, "qz2", 1, 80)
    rng = np.random.default_rng(13)
    for i in range(26):
        x, y = int(rng.integers(0, CW)), int(rng.integers(0, CH - 6))
        y = (y - (f + i) % FRAMES) % CH
        if (i + f) % 3:
            b.put(c.rect(x, y, x + 1, y + 2) if i % 2 else c.rect(x, y, x + 1, y + 1), ["qz", "qzp", "qz2"][i % 3], 1, 90)
    b.put(c.rect(0, CH - 2, CW, CH) & (((c.xx.astype(int)) % 2) == 0), "qz2", 1, 60)


# =============================================================================================== 07 SIGNAL VOID (aether)
def orb(c, cx, cy, r, f, rp="ae"):
    m = c.disc(cx, cy, r)
    d = np.hypot(c.xx + .5 - (cx - r * .35), c.yy + .5 - (cy - r * .35)) / (r * 1.7)
    c.fill(m, 1 - d * 1.2 + 0.08 * tw(f), rp)
    if r >= 3:
        c.px(cx - r * .4, cy - r * .4, RAMPS[rp][4])
    return m


def orbit(c, cx, cy, rx, ry, f, rp, front, speed=1, dots=1, w=1.0, phase=0.0):
    """An elliptical ring. front=False draws only the back half (call before the orb), True the front half; a bright dot rides it."""
    m = c.ring(cx, cy, rx, ry, w)
    m &= (c.yy + .5 >= cy) if front else (c.yy + .5 < cy)
    c.set(m & (c.img[..., 3] == 0) if not front else m, RAMPS[rp][3 if front else 2])
    for k in range(dots):
        a = 2 * math.pi * (speed * f / FRAMES + k / dots + phase)
        x, y = cx + math.cos(a) * rx, cy + math.sin(a) * ry
        if (math.sin(a) >= 0) == front:
            c.px(x, y, RAMPS[rp][4]); c.px(x + 1, y, RAMPS[rp][4])


def motes(c, cx, cy, rx, ry, f, n, rp, seed=0):
    rng = np.random.default_rng(seed)
    for k in range(n):
        x = cx + (rng.random() * 2 - 1) * rx
        y0 = cy + (rng.random() * 2 - 1) * ry
        y = y0 - ((f + k) % FRAMES) * 1.0
        if (f + k * 2) % 3:
            c.px(x, y, RAMPS[rp][3 + (k % 2)])


def ae_sprite(c, n, cx, f):
    bob = round(sn(f) * 1)
    if n == 1:      # SPARK
        c.glow(cx, BY - 5, 7, "ae", 0.45)
        arm_ = 2 if f % 3 == 1 else 1
        c.star(cx, BY - 4 + bob, arm_, RAMPS["ae"][3], RAMPS["ae"][4])
        c.px(cx - 3, BY - 1, RAMPS["ae"][2]); c.px(cx + 3, BY - 7 - bob, RAMPS["ae"][2])
    elif n == 2:    # WISP: a small orb with a curling tail
        cy = BY - 7 + bob
        c.glow(cx, cy, 10, "ae", 0.45)
        for k in range(6):
            tx = cx + 2 + k * 1.2
            ty = cy + 1 + k * 0.7 + sn(f, k / 6) * 1.0
            c.px(tx, ty, RAMPS["ae2"][3 if k < 3 else 2])
        orb(c, cx, cy, 3.2, f)
    elif n == 3:    # CURRENT: orb with a tilted ring
        cy = BY - 8 + bob
        c.glow(cx, cy, 13, "ae", 0.45)
        orbit(c, cx, cy, 9, 3, f, "ae2", False)
        orb(c, cx, cy, 5, f)
        orbit(c, cx, cy, 9, 3, f, "ae2", True)
    elif n == 4:    # STREAM: an emitter on the floor feeding an orb with two rings and a moon
        cy = BY - 13 + bob
        c.glow(cx, cy, 17, "ae", 0.45)
        c.fill(c.poly([(cx - 5, BY), (cx + 5, BY), (cx + 3, BY - 3), (cx - 3, BY - 3)]), 0.45, "gr")
        for k in range(4):
            y = BY - 4 - ((k * 2 + f) % 5)
            c.px(cx, y, RAMPS["ae"][3]); c.px(cx, y - 1, RAMPS["ae2"][3])
        orbit(c, cx, cy, 11, 3.5, f, "ae2", False)
        orbit(c, cx, cy, 8, 5, f, "aey", False, speed=-1, phase=.3)
        orb(c, cx, cy, 6, f)
        orbit(c, cx, cy, 11, 3.5, f, "ae2", True)
        orbit(c, cx, cy, 8, 5, f, "aey", True, speed=-1, phase=.3)
    elif n == 5:    # VORTEX: three arms of signal turning around a core on a plinth
        cy = BY - 16
        c.glow(cx, cy, 22, "ae", 0.45, ry=17)
        rot = 2 * math.pi * f / FRAMES / 3   # a third of a turn over the loop; three arms make it seamless
        for arm_i in range(3):
            for k in range(70):
                t = k / 69
                a = rot + arm_i * 2 * math.pi / 3 + t * 4.2
                r = 4 + t * 15
                x, y = cx + math.cos(a) * r, cy + math.sin(a) * r * 0.6
                rp = ["ae", "ae2", "aey"][arm_i] if t > .3 else "ae"
                c.px(x, y, RAMPS[rp][4 if t < .2 else 3 if t < .65 else 2])
                if t < .7:
                    c.px(x, y + 1, RAMPS[rp][2 if t < .4 else 1])
        orb(c, cx, cy, 5, f)
        motes(c, cx, cy, 17, 10, f, 8, "aey", seed=7)
        c.fill(c.poly([(cx - 7, BY), (cx + 7, BY), (cx + 3, BY - 4), (cx - 3, BY - 4)]), 0.4, "gr")
        c.set(c.rect(cx - .5, BY - 9, cx + .5, BY - 4), RAMPS["ae"][3 if f % 2 else 2])
    elif n == 6:    # RIFT: a tear in the air, edges crackling, stars inside, debris lifting off the floor
        cy = BY - 21
        c.glow(cx, cy, 22, "ae", 0.5, ry=22)
        rx, ry = 10, 19
        lens = c.disc(cx, cy, rx, ry)
        rng = np.random.default_rng(11 + f)
        # crackle: short bolts off the rim, new ones every frame
        for k in range(7):
            a = rng.random() * 2 * math.pi
            x0, y0 = cx + math.cos(a) * rx, cy + math.sin(a) * ry
            x1, y1 = x0 + math.cos(a) * (2 + rng.random() * 4) + rng.normal() * 1.5, y0 + math.sin(a) * (2 + rng.random() * 4)
            c.set(c.seg(x0, y0, x1, y1, 1), RAMPS["aey" if k % 2 else "ae"][3])
        halo = c.disc(cx, cy, rx + 2, ry + 2) & ~lens
        c.set(halo & (((c.yy.astype(int) + c.xx.astype(int) + f) % 2) == 0), RAMPS["ae"][2])
        c.set(lens, RAMPS["ae2"][0])
        ang = c.ang(cx, cy)
        rr = np.hypot((c.xx + .5 - cx) / rx, (c.yy + .5 - cy) / ry)
        inner = (np.sin(ang * 2 - rr * 6 + 2 * math.pi * f / FRAMES) + 1) / 2 * (1 - rr)
        c.fill(lens & (inner > 0.18), 0.1 + inner * 0.6, "ae2", outline=False, dith=1.0)
        c.set(c.ring(cx, cy, rx, ry, 1), RAMPS["ae"][4])
        srng = np.random.default_rng(11)
        for k in range(16):
            sx = cx + (srng.random() * 2 - 1) * 7
            sy = cy + (srng.random() * 2 - 1) * 15
            if c.disc(cx, cy, rx - 2, ry - 2)[int(sy), int(sx)] and (k + f) % 3:
                c.px(sx, sy, RAMPS["ae2" if k % 2 else "aey"][4])
        for k, (dx, sz) in enumerate([(-16, 2), (14, 3), (-11, 2), (18, 2)]):
            y = BY - 2 - ((f + k * 2) % FRAMES) * 2.5
            c.fill(c.rect(cx + dx, y - sz, cx + dx + sz, y), 0.4, "gr", outline=False)
        c.fill(c.poly([(cx - 13, BY), (cx + 13, BY), (cx + 7, BY - 2), (cx - 7, BY - 2)]), 0.3, "gr")
    elif n == 7:    # SIGNAL GATE: a ring portal on a stand, the void turning inside, motes orbiting
        cy = BY - 30
        c.glow(cx, cy, 30, "ae", 0.42, ry=32)
        inside = c.disc(cx, cy, 20, 23)
        ang = c.ang(cx, cy)
        rr = np.hypot((c.xx + .5 - cx) / 20, (c.yy + .5 - cy) / 23)
        swirl = (np.sin(ang * 3 + rr * 9 - 2 * math.pi * f / FRAMES) + 1) / 2
        c.fill(inside, 0.08 + 0.42 * swirl * (1 - rr) + 0.15 * (1 - rr), "ae2", outline=False, dith=1.0)
        frame = c.ring(cx, cy, 24, 27, 4)
        c.fill(frame, 0.25 + 0.4 * c.lin(cx - 24, cy - 27, cx + 24, cy + 27) * -1 + 0.4, "gr")
        segs = 16
        for k in range(segs):
            a = 2 * math.pi * k / segs
            x, y = cx + math.cos(a) * 22, cy + math.sin(a) * 25
            on = (k - f * 2) % 4 == 0 or (k % 2 == 0)
            c.set(c.rect(x - .5, y - .5, x + 1, y + 1), RAMPS["ae"][4] if (k - f * 2) % 4 == 0 else RAMPS["ae"][2])
        c.fill(c.poly([(cx - 18, BY), (cx + 18, BY), (cx + 10, BY - 5), (cx - 10, BY - 5)]), 0.35, "gr")
        orb(c, cx, cy + sn(f) * 1, 6, f)
        for k in range(5):
            a = 2 * math.pi * (f / FRAMES + k / 5)
            x, y = cx + math.cos(a) * 13, cy + math.sin(a) * 15
            c.px(x, y, RAMPS["aey" if k % 2 else "ae"][4])
        for k in range(3):
            a = -2 * math.pi * (f / FRAMES + k / 3)
            c.star(cx + math.cos(a) * 28, cy + math.sin(a) * 9, 1, RAMPS["ae"][3], RAMPS["ae"][4])


def ae_backdrop(b, f):
    """Ripples spreading from the gate's side of the panel, a faint starfield."""
    c = b.c
    ox, oy = 250, 70
    r = np.hypot(c.xx + .5 - ox, (c.yy + .5 - oy) * 1.6)
    wave = ((r - f * 18 / FRAMES * 1.0) % 18) < 1
    b.dens(0.35 + 0.6 * (1 - np.clip(r / 300, 0, 1)), "ae", 1, 80, mask=wave)
    ox2, oy2 = 40, -10
    r2 = np.hypot(c.xx + .5 - ox2, (c.yy + .5 - oy2) * 1.4)
    wave2 = ((r2 + f * 12 / FRAMES) % 12) < 1
    b.dens(0.45, "ae2", 1, 70, mask=wave2 & ~wave)
    rng = np.random.default_rng(21)
    for k in range(80):
        x, y = int(rng.integers(0, CW)), int(rng.integers(0, CH - 8))
        if (k + f) % 4:
            b.put(c.rect(x, y, x + 1, y + 1), ["ae", "aey", "ae2"][k % 3], 1, 90)


# =============================================================================================== 08 GLYPH HALL (runes)
GLYPHS = [  # normalised segments (x0, y0, x1, y1) in a unit box; each tier adds strokes, like the 32 px tier icons
    [(.5, .12, .5, .88)],
    [(.5, .12, .5, .88), (.18, .5, .82, .5)],
    [(.5, .1, .85, .5), (.85, .5, .5, .9), (.5, .9, .15, .5), (.15, .5, .5, .1), (.5, .3, .5, .7)],
]


def glyph(c, x0, y0, w, h, kind, col, wpx=1):
    m = np.zeros((CH, CW), bool)
    for (a, b_, cc, d) in GLYPHS[kind]:
        m |= c.seg(x0 + a * w, y0 + b_ * h, x0 + cc * w, y0 + d * h, wpx)
    c.set(m, col)
    return m


def tablet(c, cx, by, w, h, kind, f, border=False, rp="rn"):
    x0, y0 = cx - w / 2, by - h
    slab = c.rect(x0, y0, x0 + w, by)
    c.fill(slab, 0.25 + 0.35 * c.lin(x0, y0, x0 + w, by) * -1 + 0.3, "st")
    c.set(c.rect(x0, y0, x0 + w, y0 + 1), RAMPS["st"][3])
    k = tw(f)
    col = RAMPS[rp][4] if k > .55 else RAMPS[rp][3]
    pad = max(1.5, w * 0.2)
    glyph(c, x0 + pad, y0 + pad, w - 2 * pad, h - 2 * pad, kind, col, 1 if w < 14 else 1.5)
    if border:
        inner = c.rect(x0 + 1, y0 + 1, x0 + w - 1, by - 1) & ~c.rect(x0 + 2, y0 + 2, x0 + w - 2, by - 2)
        c.set(inner, RAMPS[rp][2])
        for (px_, py_) in [(x0 + 3, y0 + 3), (x0 + w - 4, y0 + 3), (x0 + 3, by - 4), (x0 + w - 4, by - 4)]:
            c.px(px_, py_, RAMPS[rp][4] if k > .3 else RAMPS[rp][2])
    return slab


def pillar(c, cx, by, w, h, f, rows, phase=0.0):
    """A standing stone with a column of carved glyphs; light runs down the carvings."""
    x0, y0 = cx - w / 2, by - h
    c.fill(c.rect(x0 - 1, y0 - 2, x0 + w + 1, y0 + 1), 0.55, "st")
    c.fill(c.rect(x0, y0 + 1, x0 + w, by - 2), 0.18 + 0.4 * (1 - c.lin(x0, 0, x0 + w, 0)), "st")
    c.fill(c.rect(x0 - 1, by - 2, x0 + w + 1, by + 1), 0.45, "st")
    gh = (h - 6) / rows
    hot = int(((f / FRAMES) + phase) * rows) % rows
    for i in range(rows):
        kind = i % 3
        col = RAMPS["rn"][4] if i == hot else RAMPS["rn"][2] if abs(i - hot) > 1 else RAMPS["rn"][3]
        glyph(c, x0 + 2, y0 + 3 + i * gh, w - 4, gh - 1.5, kind, col)


def rn_sprite(c, n, cx, f):
    if n == 1:      # MARK
        c.glow(cx, BY - 4, 8, "rn", 0.35)
        tablet(c, cx, BY + 1, 6, 9, 0, f)
    elif n == 2:    # SIGIL
        c.glow(cx, BY - 6, 11, "rn", 0.4)
        tablet(c, cx, BY + 1, 9, 12, 1, f)
    elif n == 3:    # GLYPH on a low plinth
        c.glow(cx, BY - 8, 14, "rn", 0.4)
        c.fill(c.rect(cx - 8, BY - 2, cx + 8, BY + 1), 0.4, "st")
        tablet(c, cx, BY - 2, 12, 14, 2, f)
    elif n == 4:    # SEAL: gold-framed tablet, two candles
        c.glow(cx, BY - 11, 18, "rn", 0.42)
        c.fill(c.rect(cx - 11, BY - 2, cx + 11, BY + 1), 0.4, "st")
        tablet(c, cx, BY - 2, 16, 20, 2, f, border=True)
        for dx in (-14, 14):
            c.fill(c.rect(cx + dx - 1, BY - 6, cx + dx + 2, BY + 1), 0.8, "wh", outline=False)
            fl = (f + (dx > 0) * 3) % FRAMES
            c.px(cx + dx, BY - 7, RAMPS["rno"][4]); c.px(cx + dx, BY - 8 - (fl % 2), RAMPS["rno"][3 if fl % 3 else 4])
    elif n == 5:    # CANON: standing stone with carved verses, light running down
        c.glow(cx, BY - 15, 22, "rn", 0.42, ry=20)
        pillar(c, cx, BY, 12, 30, f, 4)
        tablet(c, cx - 11, BY + 1, 6, 8, 0, f + 2)
        tablet(c, cx + 11, BY + 1, 7, 10, 1, f + 4)
    elif n == 6:    # GRIMOIRE: a lectern, an open book floating above it, glyphs lifting off the pages
        c.glow(cx, BY - 22, 28, "rn", 0.42, ry=24)
        c.fill(c.poly([(cx - 10, BY), (cx + 10, BY), (cx + 6, BY - 3), (cx - 6, BY - 3)]), 0.4, "st")
        c.fill(c.rect(cx - 3, BY - 15, cx + 3, BY - 3), 0.3 + 0.3 * (1 - c.lin(cx - 3, 0, cx + 3, 0)), "st")
        c.fill(c.poly([(cx - 13, BY - 15), (cx + 13, BY - 15), (cx + 10, BY - 19), (cx - 10, BY - 19)]), 0.5, "st")
        hov = BY - 23 + round(sn(f) * 1.2)
        c.haze(c.rect(cx - 12, BY - 19, cx + 12, hov + 1), 0.3 + 0.15 * tw(f), "rn", 1)
        cover = c.poly([(cx - 17, hov + 1), (cx, hov + 3), (cx + 17, hov + 1), (cx + 16, hov - 9), (cx, hov - 7), (cx - 16, hov - 9)])
        c.fill(cover, 0.35, "rno")
        left = c.poly([(cx - 15, hov), (cx, hov + 2), (cx, hov - 8), (cx - 14, hov - 10)])
        right = c.poly([(cx + 15, hov), (cx, hov + 2), (cx, hov - 8), (cx + 14, hov - 10)])
        c.fill(left, 0.72, "rn", outline=False)
        c.fill(right, 0.9, "rn", outline=False)
        for k in range(4):
            c.set(c.seg(cx - 12, hov - 7 + k * 2, cx - 2, hov - 5 + k * 2, 1) & left, RAMPS["rno"][1])
            c.set(c.seg(cx + 2, hov - 5 + k * 2, cx + 12, hov - 7 + k * 2, 1) & right, RAMPS["rno"][1])
        c.set(c.rect(cx - .5, hov - 8, cx + .5, hov + 2), RAMPS["rno"][2])
        for k in range(5):   # glyphs rising off the book
            p = ((f / FRAMES) + k / 5) % 1.0
            gx = cx - 10 + k * 5 + sn(f, k / 5) * 1.5
            gy = hov - 11 - p * 16
            col = RAMPS["rn"][4] if p < .45 else RAMPS["rn"][3] if p < .8 else RAMPS["rno"][2]
            glyph(c, gx - 2, gy - 2, 4, 4, k % 3, col)
    elif n == 7:    # HALL GATE: two carved pillars, a lintel with a glyph band, a sigil hanging in the arch
        c.glow(cx, BY - 30, 32, "rn", 0.4, ry=34)
        c.fill(c.rect(cx - 27, BY - 3, cx + 27, BY + 1), 0.35, "st")
        c.fill(c.rect(cx - 23, BY - 6, cx + 23, BY - 3), 0.45, "st")
        pillar(c, cx - 17, BY - 6, 9, 42, f, 5, 0.0)
        pillar(c, cx + 17, BY - 6, 9, 42, f, 5, 0.5)
        lint = c.rect(cx - 25, BY - 55, cx + 25, BY - 48)
        c.fill(lint, 0.35 + 0.3 * (1 - c.lin(0, BY - 55, 0, BY - 48)), "st")
        c.set(c.rect(cx - 25, BY - 55, cx + 25, BY - 54), RAMPS["st"][3])
        for k in range(8):
            gx = cx - 22 + k * 5.6
            hot = (k - f) % 4 == 0
            glyph(c, gx, BY - 53, 4, 4, k % 3, RAMPS["rn"][4] if hot else RAMPS["rn"][2])
        sy = BY - 30 + sn(f) * 1.5
        c.glow(cx, sy, 11, "rno", 0.55)
        dia = c.poly([(cx, sy - 9), (cx + 7, sy), (cx, sy + 9), (cx - 7, sy)])
        c.fill(dia, 0.55 + 0.35 * c.lin(cx - 7, sy + 9, cx + 7, sy - 9), "rn")
        glyph(c, cx - 3.5, sy - 5, 7, 10, 2, RAMPS["rno"][1])
        c.px(cx, sy, RAMPS["rn"][4])
        for k in range(4):
            a = 2 * math.pi * (f / FRAMES + k / 4)
            c.px(cx + math.cos(a) * 11, sy + math.sin(a) * 11, RAMPS["rn"][4 if k % 2 else 3])


def rn_backdrop(b, f):
    """Carved floor tiles and faint wall glyphs; dust motes drifting up."""
    c = b.c
    tiles = ((c.xx % 16) < 1) | ((c.yy % 8) < 1)
    b.dens(0.2 + 0.6 * c.lin(0, 20, 0, CH), "rn", 0, 70, mask=tiles)
    rng = np.random.default_rng(31)
    for k in range(34):
        x, y = int(rng.integers(4, CW - 8)) // 16 * 16 + 6, int(rng.integers(0, 6)) * 8 + 2
        kind = int(rng.integers(0, 3))
        m = np.zeros((CH, CW), bool)
        for (a, b_, cc, d) in GLYPHS[kind]:
            m |= c.seg(x + a * 4, y + b_ * 4, x + cc * 4, y + d * 4, 1)
        b.put(m, ("rno" if k % 3 == 0 else "rn"), 1 if (k + f) % 3 == 0 else 0, 90)
    for k in range(40):
        x = int(rng.integers(0, CW))
        y = (int(rng.integers(0, CH)) - f * 2) % CH
        if k % 3:
            b.put(c.rect(x, y, x + 1, y + 1), "rno" if k % 2 else "rn", 1, 90)


# ------------------------------------------------------------------------------------------- layout and output
# Sprite centres on the 288 px floor. Sprite 7 stands centre-right; sprite 6 ends before the big number (x 252+), which keeps the top-right quiet.
X = {1: 46, 2: 59, 3: 75, 4: 97, 5: 125, 6: 233, 7: 174}
ZONES = {
    "silicon": (si_sprite, si_backdrop),
    "quartz": (qz_sprite, qz_backdrop),
    "aether": (ae_sprite, ae_backdrop),
    "runes": (rn_sprite, rn_backdrop),
}


def cell(zone, stage, f):
    sprite, backdrop = ZONES[zone]
    b = Backdrop()
    backdrop(b, f)
    c = Canvas()
    for n in range(stage, 0, -1):   # newest first, so its glow sits under nothing and older sprites stay crisp
        layer = Canvas()
        sprite(layer, n, X[n], f)
        m = (layer.img[..., 3] > 0) & (c.img[..., 3] == 0)
        c.img[m] = layer.img[m]
    qx0, qy0, qx1, qy1 = QUIET
    c.img[qy0:qy1, qx0:qx1] = 0   # halos fade out under the big number; no sprite body reaches this box
    out = b.img.copy()
    m = c.img[..., 3] > 0
    out[m] = c.img[m]
    return out


def sheet(zone):
    im = np.zeros((CH * (STAGES + 1), CW * FRAMES, 4), np.uint8)
    for s in range(STAGES + 1):
        for f in range(FRAMES):
            im[s * CH:(s + 1) * CH, f * CW:(f + 1) * CW] = cell(zone, s, f)
    return Image.fromarray(im, "RGBA")


def preview(zone, sh):
    PREVIEW.mkdir(parents=True, exist_ok=True)
    bg = Image.new("RGBA", sh.size, (17, 19, 21, 255))
    bg.alpha_composite(sh)
    col = bg.crop((0, 0, CW, sh.height))
    col.resize((col.width * 3, col.height * 3), Image.NEAREST).save(PREVIEW / f"{zone}-stages.png")
    frames = []
    for f in range(FRAMES):
        fr = bg.crop((f * CW, STAGES * CH, (f + 1) * CW, (STAGES + 1) * CH))
        frames.append(fr.resize((fr.width * 3, fr.height * 3), Image.NEAREST).convert("P", palette=Image.ADAPTIVE))
    frames[0].save(PREVIEW / f"{zone}.gif", save_all=True, append_images=frames[1:], duration=167, loop=0, disposal=2)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    OUT.mkdir(parents=True, exist_ok=True)
    for zone in args or list(ZONES):
        sh = sheet(zone)
        png, webp = OUT / f"zone-{zone}.png", OUT / f"zone-{zone}.webp"
        sh.save(png, optimize=True)
        sh.save(webp, lossless=True, quality=100, method=6)
        kb = (png.stat().st_size / 1024, webp.stat().st_size / 1024)
        flag = "" if kb[0] <= 300 and kb[1] <= 120 else "  OVER BUDGET"
        print(f"{zone}: {sh.size}  png {kb[0]:.0f} KB  webp {kb[1]:.0f} KB{flag}")
        if "--preview" in sys.argv:
            preview(zone, sh)


if __name__ == "__main__":
    main()
