"""Brasswork UI glyphs: one draw function per HUD action (menus, stage buttons, panel headers), 64 x 64 kit Canvas each.

Same palette and Bayer dither as the item icons (bw_items.py), but drawn flat and front-on with bold strokes, because these
sit on buttons at 24 to 32 CSS px: nothing thinner than 5 art px, one idea per glyph, a dark outline around every shape.
Light from the top-left, a bright rim on the lit edges and a dark rim on the far ones, so each glyph reads as a pressed
brass plate.
"""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFont

import bw_palette  # noqa: F401  (registers the ramps)
from nodefarm_icon_kit import (N, Canvas, P, X, Y, angle, disc, edge, grow, line, path, poly, rect, ring)

UI = {}
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"

# Shade 1 at the top-left corner falling to 0 at the bottom-right: the lamp sits up and to the left.
G = np.clip(1 - ((X - 4) + (Y - 4)) / 112, 0, 1)


def ui(fn):
    UI[fn.__name__.rstrip("_")] = fn
    return fn


def plate(c, m, pal="brass", lo=0.18, hi=0.92, rim=True):
    """Paint mask m as a lit metal plate: dithered top-left gradient, light rim top-left, dark rim bottom-right."""
    r = P[pal]
    c.fill(m, lo + (hi - lo) * G, pal, dither=0.9)
    if rim:
        c.set(edge(m, 0, -1) | edge(m, -1, 0), r[-2])
        c.set(edge(m, 0, 1) | edge(m, 1, 0), r[1])
    return c


def flat(c, m, pal, v):
    c.fill(m, np.clip(v + 0.25 * (G - 0.5), 0, 1), pal, dither=0.9)
    return c


def done(c):
    return c.finish(P["steel"][0])


def text_mask(s, size, cx, cy):
    """Mask of a bold serif glyph string centred on (cx, cy), for ? and i."""
    ss = 4
    im = Image.new("L", (N * ss, N * ss), 0)
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT, size * ss)
    x0, y0, x1, y1 = d.textbbox((0, 0), s, font=f)
    d.text((cx * ss - (x0 + x1) / 2, cy * ss - (y0 + y1) / 2), s, font=f, fill=255)
    return np.asarray(im.resize((N, N), Image.BOX)).astype(float) > 110


def mirror(m):
    return m[:, ::-1]


# ------------------------------------------------------------------ panels and menus
@ui
def research():
    """Round flask of glowing patina with a brass collar."""
    c = Canvas()
    body = disc(32, 41, 19) | rect(25, 8, 39, 26)
    plate(c, body, "glass", 0.25, 0.8)
    liquid = disc(32, 41, 15.5) & (Y > 36 + 2 * np.sin(X * 0.45))
    c.fill(liquid, 0.35 + 0.55 * G + 0.25 * (Y < 42), "patina", dither=0.9)
    c.set(disc(26, 46, 2.2) | disc(35, 41, 1.6) | disc(31, 51, 1.8), P["patina"][-1])
    c.set(disc(23, 32, 3) & ~liquid | rect(28, 12, 30, 24), P["glass"][-1])
    collar = rect(22, 4, 42, 11)
    plate(c, collar)
    return done(c)


@ui
def expedition():
    """Brass compass: ring, cream dial, copper needle pointing north-east."""
    c = Canvas()
    plate(c, disc(32, 34, 27) & ~disc(32, 34, 20))
    plate(c, disc(32, 5.5, 4.5) & ~disc(32, 5.5, 2), "brass")
    flat(c, disc(32, 34, 20), "cream", 0.72)
    for a in range(4):
        t = a * math.pi / 2
        c.set(line(32 + 14 * math.cos(t), 34 + 14 * math.sin(t), 32 + 19 * math.cos(t), 34 + 19 * math.sin(t), 2.6),
              P["cream"][1])
    north = poly([(45, 21), (35, 37), (29, 31)])
    south = poly([(19, 47), (29, 31), (35, 37)])
    plate(c, north, "cu", 0.35, 1.0, rim=False)
    plate(c, south, "gun", 0.3, 0.75, rim=False)
    plate(c, disc(32, 34, 3.2), "brass")
    return done(c)


@ui
def stats():
    """Production stats: three rising bars on a steel base."""
    c = Canvas()
    for (x0, top, pal) in ((5, 36, "cu"), (24, 22, "brass"), (43, 8, "patina")):
        plate(c, rect(x0, top, x0 + 16, 52), pal, 0.25, 0.95)
    plate(c, rect(2, 52, 62, 59), "gun", 0.2, 0.7)
    return done(c)


def gear_mask(cx, cy, ro, ri, teeth, hole, phase=0.0):
    a = angle(cx, cy)
    tooth = (np.cos((a * teeth + phase) * 2 * math.pi) > -0.1)
    d = np.hypot(X - cx, Y - cy)
    return ((d <= ri) | ((d <= ro) & tooth)) & (d > hole)


@ui
def settings():
    """Eight-tooth brass gear with a steel hub."""
    c = Canvas()
    g = gear_mask(32, 32, 29, 21, 8, 9)
    plate(c, g)
    c.set(ring(32, 32, 16, 14.5) & g, P["brass"][2])
    plate(c, disc(32, 32, 9) & ~disc(32, 32, 5), "gun", 0.25, 0.8)
    return done(c)


@ui
def milestones():
    """Copper pennant on a steel pole with a brass finial."""
    c = Canvas()
    plate(c, rect(12, 9, 19, 60), "gun", 0.2, 0.75)
    pts = [(19, 11)] + [(19 + t, 11 + 3 * math.sin(t / 7)) for t in range(0, 42, 3)] + [(61, 22)]
    pts += [(19 + t, 33 + 3 * math.sin(t / 7)) for t in range(42, -1, -3)]
    cloth = poly(pts)
    c.fill(cloth, np.clip(0.3 + 0.55 * G + 0.25 * np.sin(X / 7 + 0.6), 0, 1), "cu", dither=0.9)
    c.set(edge(cloth, 0, -1), P["cu"][-2])
    plate(c, poly([(32, 18), (34, 22), (38, 22.5), (35, 25.5), (36, 30), (32, 27.5), (28, 30), (29, 25.5), (26, 22.5), (30, 22)]),
          "cream", 0.6, 1.0, rim=False)
    plate(c, disc(15.5, 7, 5.5))
    return done(c)


@ui
def prestige():
    """Open a new workshop: a doorway pouring lamplight, the brass door swung open."""
    c = Canvas()
    frame = rect(14, 4, 56, 60) & ~rect(21, 11, 49, 60)
    plate(c, frame, "wood", 0.2, 0.95)
    c.fill(rect(21, 11, 49, 60), np.clip(0.95 - 0.55 * (Y - 11) / 49, 0, 1), "glow", dither=0.9)
    for k in range(3):
        c.set(line(25 + 9 * k, 15, 22 + 12 * k, 58, 1.2) & rect(21, 11, 49, 60), P["glow"][-1])
    leaf = poly([(21, 11), (5, 4), (5, 62), (21, 60)])
    plate(c, leaf, "brass", 0.15, 0.8)
    c.set(disc(9.5, 34, 2.3), P["brass"][-1])
    return done(c)


@ui
def machines():
    """Wrench across the cell: open jaw top right, ring end bottom left."""
    c = Canvas()
    shaft = line(16, 48, 44, 20, 9)
    head = disc(46, 18, 13)
    jaw = poly([(46, 18), (55, 1), (64, 4), (64, 18)]) | disc(48, 16, 5.5)
    eye = disc(15, 49, 11) & ~disc(15, 49, 5)
    m = (shaft | head | eye) & ~jaw
    plate(c, m, "steel", 0.2, 0.95)
    c.set(line(22, 42, 38, 26, 2) & m, P["steel"][-2])
    return done(c)


@ui
def photo():
    """Photo mode: four brass viewfinder brackets round a big glass lens, so it reads as 'frame a shot'."""
    c = Canvas()
    br = np.zeros((N, N), bool)
    for fx, fy in ((0, 0), (1, 0), (0, 1), (1, 1)):
        x0 = 44 if fx else 4
        y0 = 44 if fy else 4
        a = rect(x0, (y0 + 10 if fy else y0), x0 + 16, (y0 + 16 if fy else y0 + 6))
        b = rect((x0 + 10 if fx else x0), y0, (x0 + 16 if fx else x0 + 6), y0 + 16)
        br |= a | b
    plate(c, br)
    plate(c, disc(32, 32, 15), "gun", 0.15, 0.8)
    c.fill(disc(32, 32, 10), np.clip(0.1 + 0.7 * G, 0, 1), "cell", dither=0.9)
    c.set(ring(32, 32, 10, 8.6), P["brass"][4])
    c.set(disc(28, 28, 3), P["glass"][-1])
    return done(c)


@ui
def light():
    """Day and night lighting: a half sun and half moon split down the middle."""
    c = Canvas()
    sun = disc(32, 32, 15) & (X < 32)
    c.glow(sun, P["glow"][3], r=5, a=120)
    for k in range(5):
        a = math.pi / 2 + math.pi * (k + 0.5) / 5
        c.fill(line(32 + 19 * math.cos(a), 32 - 19 * math.sin(a), 32 + 27 * math.cos(a), 32 - 27 * math.sin(a), 5),
               0.85, "glow")
    c.fill(sun, np.clip(0.55 + 0.5 * G, 0, 1), "glow", dither=0.9)
    moon = disc(32, 32, 15) & (X >= 32) & ~disc(40, 26, 10)
    plate(c, moon, "cream", 0.35, 1.0)
    c.set(rect(31, 14, 33, 50), P["steel"][0])
    for x, y in ((50, 14), (56, 26), (46, 50)):
        c.spark(x, y, 1, P["cream"][-1])
    return done(c)


@ui
def codex():
    """Codex: an open book, cream pages with ruled lines and a small gear diagram, brass clasp at the spine."""
    c = Canvas()
    cover = poly([(2, 18), (32, 22), (62, 18), (62, 52), (32, 56), (2, 52)])
    plate(c, cover, "brick", 0.15, 0.7)
    left = poly([(6, 14), (31, 18), (31, 50), (6, 46)])
    right = poly([(33, 18), (58, 14), (58, 46), (33, 50)])
    flat(c, left, "cream", 0.85)
    flat(c, right, "cream", 0.7)
    for k in range(4):
        y = 24 + 6 * k
        c.set(line(10, y - 2, 27, y + 1, 1) , P["cream"][1])
    c.set(gear_mask(46, 31, 8, 6, 6, 2.4), P["brass"][2])
    plate(c, rect(30, 16, 34, 54), "brass")
    return done(c)


@ui
def keys():
    """Key bindings: one large cream keycap in a brass bed, with a bold K on it."""
    c = Canvas()
    plate(c, rect(6, 10, 58, 58), "brass", 0.15, 0.75)
    c.set(rect(12, 14, 52, 50), P["steel"][0])
    cap = rect(13, 13, 51, 47)
    plate(c, cap, "cream", 0.5, 1.0)
    c.set(text_mask("K", 26, 32, 30), P["steel"][1])
    return done(c)


@ui
def power():
    """Lightning bolt, glowing, with a brass edge."""
    c = Canvas()
    bolt = poly([(38, 2), (12, 36), (29, 36), (22, 62), (52, 24), (35, 24), (44, 2)])
    c.glow(bolt, P["glow"][3], r=4, a=110)
    c.fill(bolt, np.clip(0.45 + 0.6 * G, 0, 1), "glow", dither=0.9)
    c.set(edge(bolt, -1, 0) | edge(bolt, 0, -1), P["glow"][-1])
    c.set(edge(bolt, 1, 0) | edge(bolt, 0, 1), P["brass"][3])
    return done(c)


@ui
def logistics():
    """Wooden crate with a cross brace and brass corners."""
    c = Canvas()
    box_ = rect(6, 10, 58, 58)
    plate(c, box_, "wood", 0.25, 1.0)
    inner = rect(13, 17, 51, 51)
    c.fill(inner, np.clip(0.15 + 0.45 * G, 0, 1), "wood", dither=0.9)
    plate(c, (line(14, 50, 50, 18, 7) | line(14, 18, 50, 50, 7) & ~line(14, 50, 50, 18, 9)) & inner, "wood", 0.35, 1.0)
    for (x0, y0) in ((6, 10), (49, 10), (6, 49), (49, 49)):
        plate(c, rect(x0, y0, x0 + 9, y0 + 9))
        c.set(disc(x0 + 4.5, y0 + 4.5, 1.4), P["brass"][1])
    return done(c)


@ui
def blueprints():
    """Blueprint sheet unrolling from a scroll, with a gear drawn in chalk."""
    c = Canvas()
    sheet = rect(9, 16, 55, 59)
    flat(c, sheet, "cell", 0.55)
    for k in range(17, 55, 8):
        c.set(sheet & (np.abs(X - k) < 0.5), P["cell"][3])
    for k in range(24, 59, 8):
        c.set(sheet & (np.abs(Y - k) < 0.5), P["cell"][3])
    g = gear_mask(32, 39, 13, 10, 6, 0)
    c.set(g & ~grow(gear_mask(32, 39, 11, 8, 6, 0), 0) | ring(32, 39, 4.5, 2.8), P["cream"][-1])
    roll = rect(6, 6, 58, 18)
    c.fill(roll, np.clip(0.95 - 0.8 * np.abs(Y - 10) / 8, 0, 1), "cell", dither=0.9)
    plate(c, disc(6, 12, 3, 6) | disc(58, 12, 3, 6), "brass", 0.3, 0.95)
    return done(c)


@ui
def sound():
    """Gramophone horn with two sound arcs."""
    c = Canvas()
    horn = poly([(4, 26), (16, 26), (40, 8), (44, 8), (44, 56), (40, 56), (16, 38), (4, 38)])
    plate(c, horn)
    c.fill(disc(42, 32, 4, 23), np.clip(0.1 + 0.4 * G, 0, 1), "brass", dither=0.9)
    a = (X > 46)
    plate(c, ring(42, 32, 13, 9) & a & (np.abs(Y - 32) < 11), "cream", 0.5, 1.0)
    plate(c, ring(42, 32, 21, 17) & a & (np.abs(Y - 32) < 17), "cream", 0.5, 1.0)
    return done(c)


@ui
def rates():
    """Bold up arrow in patina green."""
    c = Canvas()
    plate(c, poly([(32, 3), (60, 32), (43, 32), (43, 61), (21, 61), (21, 32), (4, 32)]), "patina", 0.25, 1.0)
    return done(c)


def curl(mirrored=False):
    """Undo arrow: an arc over the top, head on the left pointing down."""
    arc = ring(35, 38, 23, 13) & ((Y <= 38) | (X >= 35)) & (Y < 61)
    head = poly([(0, 34), (36, 34), (18, 58)]) & ~rect(0, 0, 64, 34)
    m = arc & ~rect(0, 38, 35, 64) | head
    m &= ~(rect(0, 38, 35, 64) & ~head)
    return mirror(m) if mirrored else m


@ui
def undo():
    c = Canvas()
    plate(c, curl())
    return done(c)


@ui
def redo():
    c = Canvas()
    plate(c, curl(True))
    return done(c)


@ui
def remove():
    """Rust-red cross."""
    c = Canvas()
    plate(c, line(10, 10, 54, 54, 13) | line(54, 10, 10, 54, 13), "rust", 0.2, 1.0)
    return done(c)


# ------------------------------------------------------------------ extras the HUD can use
@ui
def map_():
    """Folded parchment map with a dotted route and a red mark."""
    c = Canvas()
    panels = [poly([(4, 12), (22, 6), (22, 52), (4, 58)]), poly([(22, 6), (42, 12), (42, 58), (22, 52)]),
              poly([(42, 12), (60, 6), (60, 52), (42, 58)])]
    for k, m in enumerate(panels):
        flat(c, m, "cream", (0.85, 0.6, 0.8)[k])
    route = np.zeros_like(panels[0])
    for k, (x, y) in enumerate([(10, 46), (15, 40), (20, 36), (26, 33), (31, 30), (36, 27), (41, 25)]):
        route |= disc(x, y, 1.8)
    c.set(route, P["wood"][1])
    c.set(line(44, 17, 54, 27, 4) | line(54, 17, 44, 27, 4), P["rust"][3])
    return done(c)


@ui
def hammer():
    """Build: a brass-headed hammer on a wooden haft."""
    c = Canvas()
    plate(c, line(16, 56, 40, 26, 8), "wood", 0.3, 1.0)
    head = poly([(22, 14), (44, 0), (62, 22), (40, 36)])
    plate(c, head & ~rect(0, 0, 64, 1), "brass")
    plate(c, poly([(22, 14), (16, 22), (26, 32), (32, 26)]), "gun", 0.25, 0.8)
    return done(c)


@ui
def rotate():
    """Three-quarter circle arrow, clockwise."""
    c = Canvas()
    arc = ring(32, 34, 25, 15) & ~((X > 32) & (Y < 34))
    head = poly([(28, 0), (28, 28), (50, 14)])
    plate(c, arc | head)
    return done(c)


@ui
def time():
    """Pocket watch: brass case, cream dial, two hands."""
    c = Canvas()
    plate(c, disc(32, 36, 26) & ~disc(32, 36, 20))
    plate(c, ring(32, 6, 5.5, 2.4))
    plate(c, rect(29, 9, 35, 12))
    flat(c, disc(32, 36, 20), "cream", 0.75)
    for k in range(12):
        t = k * math.pi / 6
        r0 = 15 if k % 3 else 13
        c.set(line(32 + r0 * math.cos(t), 36 + r0 * math.sin(t), 32 + 18 * math.cos(t), 36 + 18 * math.sin(t), 2),
              P["cream"][1])
    c.set(line(32, 36, 32, 22, 3.2) | line(32, 36, 42, 41, 3.2), P["wood"][1])
    c.set(disc(32, 36, 2.6), P["brass"][2])
    return done(c)


@ui
def pause():
    c = Canvas()
    plate(c, rect(12, 8, 26, 56) | rect(38, 8, 52, 56))
    return done(c)


@ui
def play():
    c = Canvas()
    plate(c, poly([(12, 5), (58, 32), (12, 59)]))
    return done(c)


@ui
def fast():
    c = Canvas()
    plate(c, poly([(2, 10), (32, 32), (2, 54)]) | poly([(30, 10), (62, 32), (30, 54)]))
    return done(c)


@ui
def help_():
    c = Canvas()
    plate(c, disc(32, 32, 29), "brass", 0.15, 0.8)
    plate(c, text_mask("?", 44, 32, 33), "cream", 0.5, 1.0)
    return done(c)


@ui
def info():
    c = Canvas()
    plate(c, disc(32, 32, 29), "patina", 0.15, 0.8)
    plate(c, text_mask("i", 46, 32, 33), "cream", 0.5, 1.0)
    return done(c)


# ------------------------------------------------------------------ added 2026-11-14 (menu art thread)
@ui
def close():
    """Close: a brass X."""
    c = Canvas()
    plate(c, line(14, 14, 50, 50, 10) | line(50, 14, 14, 50, 10))
    return done(c)


@ui
def back():
    """Back: a brass arrow pointing left."""
    c = Canvas()
    plate(c, poly([(6, 32), (28, 10), (28, 23), (58, 23), (58, 41), (28, 41), (28, 54)]))
    return done(c)


@ui
def lock():
    """Locked: an iron padlock with a brass keyhole plate."""
    c = Canvas()
    plate(c, ring(32, 24, 14, 8) & (Y < 30), "iron", 0.3, 0.95)
    body = rect(12, 28, 52, 58)
    plate(c, body, "brass", 0.2, 0.9)
    c.set(disc(32, 39, 4) | rect(30, 40, 34, 50), P["steel"][0])
    return done(c)


@ui
def done_():
    """Done: a patina tick."""
    c = Canvas()
    plate(c, path([(10, 34), (26, 50), (54, 16)], 11), "patina", 0.3, 0.95)
    return done(c)


@ui
def warn():
    """Warning: a cream triangle with a brass rim and a bold !"""
    c = Canvas()
    tri = poly([(32, 4), (61, 58), (3, 58)])
    plate(c, tri, "brass")
    flat(c, poly([(32, 14), (52, 52), (12, 52)]), "cream", 0.8)
    c.set(rect(29, 24, 35, 40) | disc(32, 46, 3.2), P["steel"][0])
    return done(c)


# ------------------------------------------------------------------ keep and leave rows (Expedition)
# One family: a pressed brass plate with the idea cut into it in dark gunmetal. Everything sits inside the 8 to 56 box,
# so the glyphs share scale and margin. Drawn for these rows rather than cropped from the larger menu glyphs.
def cut(c, m):
    """Cut a mark into the plate: dark gunmetal with a light lower lip."""
    c.fill(m, 0.12, "gun", dither=0.0)
    c.set(edge(m, 0, 1) & ~m, P["brass"][-2])
    return c


@ui
def keep_plans():
    """Rolled plan sheet with a gear cut into it."""
    c = Canvas()
    plate(c, rect(12, 14, 52, 54))
    plate(c, rect(8, 10, 56, 20))
    cut(c, gear_mask(32, 38, 12, 9, 6, 3))
    return done(c)


@ui
def keep_designs():
    """Open book: two plates and a dark spine, ruled lines on each page."""
    c = Canvas()
    plate(c, rect(8, 14, 31, 52))
    plate(c, rect(33, 14, 56, 52))
    c.fill(rect(30, 12, 34, 54), 0.15, "gun", dither=0.0)
    for y in (22, 30, 38):
        cut(c, rect(12, y, 27, y + 2))
        cut(c, rect(37, y, 52, y + 2))
    return done(c)


@ui
def keep_routes():
    """Chart with a dotted route ending in a cross."""
    c = Canvas()
    plate(c, rect(8, 12, 56, 52))
    for k in range(4):
        cut(c, disc(16 + k * 7, 42 - k * 6, 2.4))
    cut(c, line(40, 14, 52, 26, 4) | line(40, 26, 52, 14, 4))
    return done(c)


@ui
def keep_free():
    """Gear with a one cut into the middle: one free machine."""
    c = Canvas()
    plate(c, gear_mask(32, 32, 26, 19, 8, 0))
    cut(c, text_mask("1", 30, 32, 33))
    return done(c)


@ui
def keep_records():
    """Five-point star plate: records."""
    c = Canvas()
    pts = []
    for i in range(10):
        r = 26 if i % 2 == 0 else 11
        a = -math.pi / 2 + i * math.pi / 5
        pts.append((32 + r * math.cos(a), 33 + r * math.sin(a)))
    plate(c, poly(pts))
    cut(c, disc(32, 34, 3.5))
    return done(c)


@ui
def leave_machines():
    """Gear sitting on a belt: machines and belts."""
    c = Canvas()
    plate(c, gear_mask(32, 27, 20, 14, 8, 5))
    plate(c, rect(8, 46, 56, 56))
    for x in range(12, 54, 8):
        cut(c, rect(x, 49, x + 4, 53))
    return done(c)


@ui
def leave_stock():
    """Crate with a cross brace: stored stock."""
    c = Canvas()
    plate(c, rect(9, 11, 55, 55))
    cut(c, rect(15, 17, 49, 49) & ~(line(15, 49, 49, 17, 7) | line(15, 17, 49, 49, 7)))
    return done(c)


@ui
def leave_fleets():
    """Little ship: hull, mast and sail. Fleets on expedition."""
    c = Canvas()
    plate(c, poly([(8, 40), (56, 40), (48, 54), (16, 54)]))
    plate(c, rect(30, 8, 34, 42))
    plate(c, poly([(36, 12), (54, 36), (36, 36)]))
    cut(c, poly([(12, 44), (52, 44), (50, 46), (14, 46)]))
    return done(c)
