"""Brasswork menu art: machine portraits and panel decor, on the same naOS dither kit and palette as the icons.

  public/brasswork/art/portraits.{png,webp}   128 px cells, 4 across: every machine and structure on a lamplit bench
  public/brasswork/art/frame.png              48 x 48 corner-bracket frame, CSS border-image slice 16
  public/brasswork/art/header.png             96 x 28 riveted header plate, border-image slice 0 30
  public/brasswork/art/rule.png, gear.png     divider: tiling double rule (8 x 12) and its centre gear (20 x 12)
  public/brasswork/art/gauge.png, needle.png  64 x 64 dial face and its needle (pointing up, pivot at the centre)
  public/brasswork/art/empty.{png,webp}       128 x 96 empty-state scenes, 3 across: crate, blueprint, idle
  lib/automation/art/index.ts                 generated index (cells, sizes, ?v= stamps)

The kit runs at 128 px here (NAOS_KIT_N), so the machine drawings from bw_machines.py are redrawn at twice the detail
rather than scaled up. Run: python3 scripts/brasswork/build-menu-art.py [--preview out.png]
"""
import hashlib
import math
import os
import sys
from pathlib import Path

os.environ["NAOS_KIT_N"] = "128"  # before any kit import

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import bw_items  # noqa: E402
import bw_machines  # noqa: E402
from bw_items import FIT, gear_outline  # noqa: E402
from icon3d import Scene  # noqa: E402
import nodefarm_icon_kit as K  # noqa: E402
from nodefarm_icon_kit import (BAYER8, Canvas, P, X, Y, disc, edge, grow, line, path, poly, rect, ring,  # noqa: E402
                               save_pair, to_image)

N = K.N
assert N == 128
OUT = ROOT / "public/brasswork/art"
TS = ROOT / "lib/automation/art/index.ts"

PORTRAITS = [
    ("drill", "Node drill", "rock"), ("kiln", "Kiln", "glow"), ("furnace", "Furnace", "glow"), ("press", "Press", "brass"),
    ("lathe", "Lathe", "brass"), ("drawer", "Wire drawer", "cu"), ("assembler", "Assembler", "brass"),
    ("fabricator", "Fabricator", "patina"), ("windmill", "Windmill", "patina"), ("spring_winder", "Spring winder", "patina"),
    ("spring_store", "Spring store", "patina"), ("hub", "Hub", "glow"), ("orrery", "Sky orrery", "glow"),
]
ACCENT = {"glow": "#ffa63a", "patina": "#58b09a", "brass": "#e8b85a", "cu": "#e08a48", "rock": "#bcb2a6"}


def hexc(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


# ------------------------------------------------------------------ portraits
def machine_at_128(fn, target=112):
    """Draw fn at double scale, then refit so its larger side spans `target` px, centred a little low."""
    FIT.update(k=2.0, dx=32.0, dy=32.0)
    a = fn().img[..., 3] > 0
    ys, xs = np.nonzero(a)
    w, h = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
    k = 2.0 * min(target / w, target / h, 1.6)
    k = max(k, 1.6)
    bx, by = (xs.max() + xs.min() + 1) / 2, (ys.max() + ys.min() + 1) / 2
    # solve _fx(x) = 32 + (x - 32) k + dx so the drawing's centre lands at (64, 70)
    cx_art = 32 + (bx - 64) / 2  # centre in 64-space
    cy_art = 32 + (by - 64) / 2
    FIT.update(k=k, dx=64 - (32 + (cx_art - 32) * k), dy=70 - (32 + (cy_art - 32) * k))
    out = fn()
    FIT.update(k=1.0, dx=0.0, dy=0.0)
    return out


def backdrop(accent):
    """Lamplit workshop corner: dark panelled wall, warm pool of light behind the machine, plank floor, vignette."""
    c = Canvas()
    wall = Y < 92
    lamp = np.clip(1 - np.hypot((X - 58) / 70, (Y - 50) / 52), 0, 1)
    c.fill(wall, 0.08 + 0.55 * lamp ** 1.4, "wood", bayer=BAYER8)
    # panel seams and a brass picture rail
    for x0 in (20, 64, 108):
        c.set(rect(x0, 0, x0 + 1, 92) & wall, P["wood"][0])
        c.set(rect(x0 + 1, 0, x0 + 2, 92) & wall & (lamp > 0.25), P["wood"][2])
    rail = rect(0, 22, N, 25)
    c.fill(rail, 0.35 + 0.5 * lamp, "brass", bayer=BAYER8)
    c.set(rect(0, 25, N, 26), P["wood"][0])
    # accent halo behind the machine (the thing's own light: furnace glow, patina for power)
    col = hexc(ACCENT[accent])
    halo = disc(64, 62, 40, 30) & wall
    thin = halo & (BAYER8 < -0.1 + 0.45 * np.clip(1 - np.hypot((X - 64) / 40, (Y - 62) / 30), 0, 1))
    c.img[thin] = (*col, 70)
    # floor: planks, lighter near the lamp, grout lines closer together toward the back
    floor = Y >= 92
    c.fill(floor, 0.12 + 0.5 * np.clip(1 - np.hypot((X - 60) / 80, (Y - 96) / 30), 0, 1), "steel", bayer=BAYER8)
    for y0 in (92, 95, 99, 104, 110, 117, 125):
        c.set(rect(0, y0, N, y0 + 1), P["steel"][0])
    c.set(rect(0, 91, N, 92), P["brass"][2])
    # vignette: dithered ink toward the corners
    vig = np.clip(np.hypot((X - 64) / 64, (Y - 60) / 68) - 0.8, 0, 1) * 2.0
    m = BAYER8 + 0.5 < vig
    c.img[m] = (*P["ink"][0], 255)
    return c


def portrait(mid, accent):
    bg = backdrop(accent)
    fn = {**bw_machines.DRAW, **bw_machines.STRUCT}[mid]
    fg = machine_at_128(fn)
    return bg.over(fg)


# ------------------------------------------------------------------ decor (drawn on the 128 canvas, then cropped)
G = np.clip(1 - (X + Y) / 96, 0, 1)


def plate(c, m, pal="brass", lo=0.22, hi=0.95):
    c.fill(m, lo + (hi - lo) * G, pal, dither=0.9)
    c.set(edge(m, 0, -1) | edge(m, -1, 0), P[pal][-2])
    c.set(edge(m, 0, 1) | edge(m, 1, 0), P[pal][1])


def rivet(c, x, y, r=1.6):
    d = disc(x, y, r)
    c.set(d, P["brass"][2])
    c.set(d & (X < x) & (Y < y), P["brass"][-1])
    c.set(edge(d, 1, 0) | edge(d, 0, 1), P["brass"][0])


RARITY = [  # tier id, label, bracket metal, gem colour (None = plain rivet)
    ("common", "Common", "iron", None), ("uncommon", "Uncommon", "cu", None), ("rare", "Rare", "brass", "#5ea2b4"),
    ("epic", "Epic", "patina", "#c996b4"), ("legendary", "Legendary", "brass", "#ffd070"),
]
# Recommended tiers (taste call sent to Nate): by tech stage, the orrery alone at the top.
MACHINE_RARITY = {
    "drill": "common", "kiln": "common", "windmill": "common", "hub": "common",
    "furnace": "uncommon", "press": "uncommon", "drawer": "uncommon", "spring_winder": "uncommon",
    "lathe": "rare", "assembler": "rare", "spring_store": "rare",
    "fabricator": "epic", "orrery": "legendary",
}


def gem(c, x, y, col, r=2.6):
    d = disc(x, y, r)
    rgb = hexc(col)
    c.set(grow(d, 1), P["steel"][0])
    c.set(d, tuple(int(v * 0.6) for v in rgb))
    c.set(d & (X + Y < x + y + 0.5), rgb)
    c.set(disc(x - 0.8, y - 0.8, 0.9), (255, 250, 235))


def frame(metal="brass", gem_col=None, legendary=False):
    """48 x 48: L-shaped brackets in the corners, a fine engraved rail along each side, empty middle."""
    c = Canvas()
    S, T, L = 48, 6, 16  # size, bracket arm thickness, arm length
    rail = (rect(0, 2, S, 4) | rect(0, S - 4, S, S - 2) | rect(2, 0, 4, S) | rect(S - 4, 0, S - 2, S)) & rect(0, 0, S, S)
    c.set(rail, P[metal][2])
    c.set(rect(0, 2, S, 3) | rect(2, 0, 3, S), P[metal][4])
    for fx in (0, 1):
        for fy in (0, 1):
            arm = rect(0, 0, L, T) | rect(0, 0, T, L)
            notch = disc(L, T / 2, 2.2) | disc(T / 2, L, 2.2)  # rounded inner tips cut with a notch
            m = (arm & ~notch)
            if fx:
                m = np.roll(m[:, ::-1], S - N, axis=1)
            if fy:
                m = np.roll(m[::-1, :], S - N, axis=0)
            plate(c, m & rect(0, 0, S, S), metal)
            rx = S - 3.5 if fx else 3.5
            ry = S - 3.5 if fy else 3.5
            if gem_col:
                gem(c, rx + (-1 if fx else 1), ry + (-1 if fy else 1), gem_col, 3.0 if legendary else 2.4)
            else:
                rivet(c, rx, ry)
    if legendary:  # sun rays off each corner
        for fx in (0, 1):
            for fy in (0, 1):
                x, y = (S - 1 if fx else 1), (S - 1 if fy else 1)
                c.set(line(x, y, x + (-9 if fx else 9), y + (-9 if fy else 9), 1.2) & ~c.alpha & rect(0, 0, S, S),
                      P["glow"][4], 200)
    c.finish(P["steel"][0])
    return c.img[:S, :S].copy()


def header():
    """96 x 28: a bevelled brass plate with gear-headed end caps; the middle 36 px tile."""
    c = Canvas()
    W, H = 96, 28
    body = rect(10, 4, W - 10, H - 4)
    plate(c, body, lo=0.3, hi=0.9)
    c.set(rect(12, 6, W - 12, 7), P["brass"][-1])
    c.fill(rect(12, H - 8, W - 12, H - 6), 0.25, "brass")
    for cx in (12, W - 12):
        g = poly([(cx + 11 * math.cos(a) * (1 if i % 2 else 0.78), 14 + 11 * math.sin(a) * (1 if i % 2 else 0.78))
                  for i, a in enumerate(np.linspace(0, 2 * math.pi, 25)[:-1])])
        g = disc(cx, 14, 9.5) | (g & disc(cx, 14, 12))
        plate(c, g & ~disc(cx, 14, 3), "cu", 0.25, 0.9)
        rivet(c, cx, 14, 2.4)
    c.finish(P["steel"][0])
    return c.img[:H, :W].copy()


def divider():
    """Rule tile 8 x 12 (two engraved lines) and a 20 x 12 centre gear."""
    c = Canvas()
    c.set(rect(0, 4, 8, 5), P["brass"][4])
    c.set(rect(0, 5, 8, 6), P["brass"][1])
    c.set(rect(0, 7, 8, 8), P["brass"][3])
    c.set(rect(0, 8, 8, 9), P["brass"][0])
    rule = c.img[:12, :8].copy()
    g = Canvas()
    gear = poly(list(map(lambda q: (10 + q[0], 6 + q[1]), gear_outline(5.8, 4.4, 8))))
    g.set(rect(0, 4, 20, 6) | rect(0, 7, 20, 9), P["brass"][2])
    plate(g, gear & ~disc(10, 6, 1.7), "brass", 0.3, 0.95)
    g.finish(P["steel"][0])
    return rule, g.img[:12, :20].copy()


def gauge():
    """64 x 64 face: brass bezel, cream dial with ticks over 270 degrees, red sector at the top end; plus a needle."""
    c = Canvas()
    cx = cy = 32
    plate(c, disc(cx, cy, 30) & ~disc(cx, cy, 25), "brass")
    dial = disc(cx, cy, 25)
    c.fill(dial, 0.55 + 0.4 * np.clip(1 - np.hypot(X - 26, Y - 24) / 30, 0, 1), "cream", bayer=BAYER8)
    a = (np.degrees(np.arctan2(X - cx, -(Y - cy))))  # 0 up, clockwise positive
    band = ring(cx, cy, 23, 20) & (np.abs(a) <= 135)
    c.set(band & (a > 80), (196, 72, 52))
    c.set(band & (a <= 80) & (a > 30), P["glow"][3])
    for k in range(11):
        t = math.radians(-135 + 27 * k)
        r0 = 17 if k % 5 == 0 else 19
        c.set(line(cx + r0 * math.sin(t), cy - r0 * math.cos(t), cx + 23 * math.sin(t), cy - 23 * math.cos(t),
                   1.6 if k % 5 == 0 else 1.0) & dial, P["steel"][1])
    c.set(disc(cx, cy + 10, 3, 1.4), P["cream"][1])
    face = c.finish(P["steel"][0]).img[:64, :64].copy()
    n = Canvas()
    needle = poly([(cx - 2.2, cy + 4), (cx, cy - 21), (cx + 2.2, cy + 4)])
    n.fill(needle, 0.6, "cu")
    n.set(edge(needle, -1, 0), P["cu"][-1])
    hub = disc(cx, cy, 4)
    plate(n, hub, "brass")
    return face, n.finish(P["steel"][0]).img[:64, :64].copy()


def empty_scene(kind):
    """128 x 96: a small dithered still life on transparent ground for empty lists."""
    c = Canvas()
    c.set(disc(64, 82, 40, 6), P["ink"][0], 110)
    c.set(disc(64, 82, 28, 4), P["ink"][0], 170)
    sc = Scene(cx=64, cy=78, s=2.0)
    if kind == "crate":  # open, empty crate with its lid leaning on it and one stray screw
        sc.box(-14, 14, 0, 3, -10, 10, "wood", -0.05)
        for x0, x1, z0, z1 in [(-14, 14, 8, 10), (-14, 14, -10, -8), (-14, -12, -10, 10), (12, 14, -10, 10)]:
            sc.box(x0, x1, 3, 14, z0, z1, "wood", 0.0)
        sc.box(-14, 14, 13, 15, 9.5, 10.5, "brass", 0.05)
        sc.box(16, 18, 0, 22, -11, 9, "wood", 0.08)
        sc.cylinder((-20, 0.8, 10), (-12, 0.8, 13), 0.9, "iron", 0.1, n=8)
        sc.cylinder((-20, 0.8, 10), (-21, 0.8, 9.6), 1.8, "iron", 0.15, n=8)
        sc.paint(c)
    elif kind == "blueprint":  # a blueprint sheet pinned flat with a brass compass and a rolled spare
        sheet = [(-22, 0.3, 14), (22, 0.3, 14), (22, 0.3, -12), (-22, 0.3, -12)]
        sc.face(sheet, "cell", 0.15, two_sided=True)
        sc.cylinder((-24, 3, -16), (20, 3, -16), 3, "cell", 0.1, n=14)
        sc.paint(c)
        m = poly([sc.pt(q) for q in sheet])
        grid = m & (((X.astype(int) % 6) == 0) | ((Y.astype(int) % 6) == 0))
        c.set(grid, P["cell"][3])
        g = gear_outline(10, 7.5, 8)
        c.set(path([sc.pt((x, 0.4, z)) for x, z in g + g[:1]], 1.0) & m, P["cream"][-1])
        for x in (-20, 20):
            c.fill(disc(*sc.pt((x, 0.5, 12)), 1.8), 0.7, "brass")
        p0 = sc.pt((8, 0.5, 4))
        c.set(line(*p0, *sc.pt((16, 9, -2)), 1.6) | line(*sc.pt((16, 9, -2)), *sc.pt((22, 0.5, 6)), 1.6), P["brass"][4])
        c.fill(disc(*sc.pt((16, 9, -2)), 2.4), 0.8, "brass")
    else:  # idle: a still gear resting on its side with a wrench across it
        sc.extrude(gear_outline(16, 12.5, 10), 4, "brass", 0.0, frame=((0, 0, 0), (1, 0, 0), (0, 0, -1), (0, 1, 0)),
                   holes=[[(4.5 * math.cos(a), 4.5 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 12)[:-1]]])
        sc.box(-22, 18, 4, 6, -2, 2, "iron", 0.05)
        sc.cylinder((18, 4, 0), (18, 6, 0), 5, "iron", 0.08, n=12)
        sc.paint(c)
        hx, hy = sc.pt((18, 6.2, 0))
        c.set(disc(hx, hy, 2.6, 1.6), P["ink"][0])
    c.finish(P["steel"][0])
    return c.img[:96, :128].copy()


# ------------------------------------------------------------------ model sync guard
# Portraits must change whenever a machine's 3D model changes (Nate's rule, 2026-11-14). Each portrait records a hash of
# its model file plus the shared model files; tests/automation/menu-art.test.mjs fails when a model changes and the
# portraits were not redrawn. Fix: update the machine's drawing in bw_machines.py to match, then re-run this script.
MODEL_DIR = ROOT / "lib/automation/models/machines"
MODEL_FILE = {"spring_store": "springstore.ts", "spring_winder": "winder.ts"}
SHARED = ["common.ts", "palette.ts", "builder.ts"]


def model_hash(mid):
    h = hashlib.sha1()
    for f in [MODEL_FILE.get(mid, f"{mid}.ts")] + SHARED:
        h.update((MODEL_DIR / f).read_bytes())
    return h.hexdigest()[:12]


# ------------------------------------------------------------------ round 2: milestones, research, sites, quests
def catalog():
    import json
    import subprocess
    js = ("import('./lib/automation/data/tree.ts').then(m => { const t = m.RECIPE_TREE;"
          "const out = Object.fromEntries(t.recipes.map(r => [r.id, r.output.item]));"
          "console.log(JSON.stringify({ms: t.milestones.map(x => [x.id, x.name, x.deliver.map(d => d.item)]),"
          "rs: t.research.map(n => [n.id, n.name, n.recipes.map(r => out[r]), !!n.note])})); })")
    return json.loads(subprocess.run(["node", "--experimental-strip-types", "--no-warnings", "-e", js], cwd=ROOT,
                                     check=True, capture_output=True, text=True).stdout)


def draw_at(fn, cx, cy, target):
    """Draw an icon function on the 128 canvas with its larger side `target` px, centred on (cx, cy)."""
    FIT.update(k=2.0, dx=32.0, dy=32.0)
    a = fn().img[..., 3] > 0
    ys, xs = np.nonzero(a)
    w, h = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
    k = 2.0 * min(target / w, target / h)
    ax = 32 + ((xs.max() + xs.min() + 1) / 2 - 64) / 2
    ay = 32 + ((ys.max() + ys.min() + 1) / 2 - 64) / 2
    FIT.update(k=k, dx=cx - (32 + (ax - 32) * k), dy=cy - (32 + (ay - 32) * k))
    out = fn()
    FIT.update(k=1.0, dx=0.0, dy=0.0)
    return out


def blueprint_bg(alt=False):
    """Research card ground: blueprint paper with a fine grid, a gear watermark, darker toward the edges."""
    c = Canvas()
    m = rect(0, 0, 128, 96)
    c.fill(m, 0.2 + 0.4 * np.clip(1 - np.hypot((X - 64) / 80, (Y - 46) / 60), 0, 1), "cell", bayer=BAYER8)
    c.set(m & (((X.astype(int) % 8) == 0) | ((Y.astype(int) % 8) == 0)), P["cell"][2])
    g = gear_outline(40, 33, 12)
    c.set(path([(64 + x, 48 + y) for x, y in g + g[:1]], 1.0) & m, P["cell"][3])
    c.set(ring(64, 48, 14, 13), P["cell"][3])
    if alt:  # alternates get a copper corner stamp
        c.fill(poly([(100, 0), (128, 0), (128, 28)]), 0.6, "cu")
    return c


def milestone_bg():
    c = Canvas()
    m = rect(0, 0, 128, 96)
    c.fill(m & (Y < 64), 0.1 + 0.55 * np.clip(1 - np.hypot((X - 64) / 70, (Y - 30) / 50), 0, 1), "wood", bayer=BAYER8)
    c.fill(m & (Y >= 64), 0.15 + 0.4 * np.clip(1 - np.hypot((X - 64) / 80, (Y - 70) / 30), 0, 1), "steel", bayer=BAYER8)
    c.set(rect(0, 63, 128, 64), P["brass"][2])
    for y0 in (68, 74, 82, 92):
        c.set(rect(0, y0, 128, y0 + 1), P["steel"][0])
    # a shipping crate the items sit on
    sc = Scene(cx=64, cy=86, s=1.6)
    sc.box(-24, 24, 0, 10, -8, 8, "wood", 0.0)
    sc.box(-24, 24, 4, 6, 8, 8.6, "brass", 0.1)
    sc.paint(c)
    return c


def milestone_card(items):
    c = milestone_bg()
    n = len(items)
    xs = np.linspace(64 - 13 * (n - 1), 64 + 13 * (n - 1), n) if n > 1 else [64]
    order = sorted(range(n), key=lambda i: abs(i - (n - 1) / 2), reverse=True)  # outer first, centre on top
    for i in order:
        size = 40 if n <= 2 else (34 if n <= 4 else 30)
        y = 54 - (6 if abs(i - (n - 1) / 2) < 0.6 else 0)
        c.over(draw_at(bw_items.DRAW[items[i]], xs[i], y, size))
    vig = np.clip(np.hypot((X - 64) / 64, (Y - 48) / 52) - 0.85, 0, 1) * 2.0
    c.img[(BAYER8 + 0.5 < vig) & rect(0, 0, 128, 96)] = (*P["ink"][0], 255)
    return c.img[:96, :128].copy()


def research_card(items, alt):
    c = blueprint_bg(alt)
    item = items[0]
    fg = draw_at(bw_items.DRAW[item], 64, 48, 62)
    halo = grow(fg.img[..., 3] > 0, 3) & ~(fg.img[..., 3] > 0)
    c.img[halo & (BAYER8 < 0.2)] = (*P["cell"][5], 255)
    c.over(fg)
    return c.img[:96, :128].copy()


# Mastery research has no recipe to show: the card shows the machine it speeds up, a brass rank pip per level and
# rising chevrons, on blueprint paper with brass corner stamps so the six read as their own late-game set.
MASTERY = {
    "deep_seams": ("drill", 1, "ironore"), "deeper_seams": ("drill", 2, "ironore"),
    "tuned_sails": ("windmill", 1, "patina"), "tight_springs": ("spring_winder", 2, "patina"),
    "quick_hands": ("assembler", 1, "glow"), "steady_hands": ("assembler", 2, "glow"),
}


def mastery_card(rid):
    mid, rank, pal = MASTERY[rid]
    c = blueprint_bg(False)
    for tri in (poly([(0, 0), (26, 0), (0, 26)]), poly([(128, 96), (102, 96), (128, 70)])):
        c.fill(tri, 0.55 + 0.35 * np.clip(1 - (X + Y) / 200, 0, 1), "brass")
        c.set(edge(tri, 1, 0) | edge(tri, 0, 1) | edge(tri, -1, 0) | edge(tri, 0, -1), P["brass"][1])
    fg = draw_at(bw_machines.DRAW[mid], 58, 52, 66)
    halo = grow(fg.img[..., 3] > 0, 3) & ~(fg.img[..., 3] > 0)
    c.img[halo & (BAYER8 < 0.2)] = (*P[pal][4], 255)
    c.over(fg)
    # rising chevrons on the right: the speed-up, one stack per rank
    for k in range(3):
        y = 66 - 14 * k
        for j in range(rank):
            x = 104 + 10 * j - 5 * (rank - 1)
            chev = path([(x - 6, y + 5), (x, y - 1), (x + 6, y + 5)], 3.2)
            c.fill(chev, 0.5 + 0.18 * k, pal)
            c.set(edge(chev, 0, -1), P[pal][-1])
    # rank pips: small brass stars in the top-left stamp
    for j in range(rank):
        cx = 8 + 10 * j
        star = poly([(cx + 4.5 * math.cos(-math.pi / 2 + i * math.pi / 5) * (1 if i % 2 == 0 else 0.45),
                      8 + 4.5 * math.sin(-math.pi / 2 + i * math.pi / 5) * (1 if i % 2 == 0 else 0.45)) for i in range(10)])
        c.set(grow(star, 1), P["brass"][0])
        c.fill(star, 0.9, "cream")
    return c.img[:96, :128].copy()


SITES = ["ridge", "cove", "high-bank", "quarry"]


def site_scene(sid):
    """128 x 96 landscape of a prestige site: sky, sea, the island's shape and its ore."""
    c = Canvas()
    m = rect(0, 0, 128, 96)
    c.fill(m & (Y < 50), 0.45 + 0.5 * (1 - Y / 50), "cream", bayer=BAYER8)
    sun = disc(98, 20, 9)
    c.fill(sun, 0.95, "glow")
    c.fill(m & (Y >= 50), 0.2 + 0.35 * (1 - (Y - 50) / 46), "glass", bayer=BAYER8)
    for y0 in (56, 63, 72, 84):
        c.set(rect(0, y0, 128, y0 + 1) & (BAYER8 < 0.1), P["glass"][4])
    rng = np.random.default_rng(len(sid))
    if sid == "ridge":
        hills = poly([(0, 66), (18, 44), (34, 52), (54, 30), (74, 46), (92, 36), (128, 60), (128, 74), (0, 74)])
        c.fill(hills, 0.25 + 0.5 * np.clip(1 - (Y - 30) / 44, 0, 1), "ironore", bayer=BAYER8)
        c.set(edge(hills, 0, -1), P["ironore"][-1])
        for x, y in rng.uniform((20, 54), (100, 68), (9, 2)):
            c.fill(disc(x, y, 2.2) & hills, 0.8, "rust")
    elif sid == "cove":
        land = poly([(0, 46), (30, 40), (52, 48), (46, 62), (60, 72), (128, 66), (128, 80), (0, 80)])
        water = disc(44, 58, 14, 7)
        c.fill(land & ~water, 0.3 + 0.4 * np.clip(1 - (Y - 40) / 40, 0, 1), "patina", bayer=BAYER8)
        c.set(edge(land & ~water, 0, -1), P["patina"][-1])
        c.fill(water & land, 0.5, "glass")
        c.fill(rect(98, 42, 102, 66), 0.45, "wood")
        for a in (0.3, 1.87, 3.44, 5.01):
            c.set(line(100, 42, 100 + 13 * math.cos(a), 42 + 13 * math.sin(a), 2.2), P["cream"][4])
        c.fill(disc(100, 42, 2), 0.7, "brass")
    elif sid == "high-bank":
        cliff = poly([(10, 74), (16, 24), (64, 18), (110, 26), (118, 74)])
        c.fill(cliff, 0.25 + 0.45 * np.clip(1 - (X - 10) / 110, 0, 1), "rock", bayer=BAYER8)
        c.fill(rect(10, 18, 118, 24) & grow(cliff, 1), 0.6, "patina")
        for y0, pal in ((40, "cu"), (56, "coal")):
            c.fill(cliff & (np.abs(Y - y0 - 3 * np.sin(X / 9)) < 2.6), 0.6, pal)
    else:  # quarry: a stepped pit cut into pale stone
        ground = rect(0, 44, 128, 76)
        c.fill(ground, 0.55, "bauxite", bayer=BAYER8)
        for k, (w, h) in enumerate(((50, 9), (38, 7), (26, 5), (14, 3))):
            d = disc(64, 54 + 3 * k, w, h)
            c.fill(d, 0.45 - 0.1 * k, "rock", bayer=BAYER8)
            c.set(edge(d, 0, 1), P["rock"][-2])
        for x, y in rng.uniform((44, 54), (84, 66), (6, 2)):
            c.fill(disc(x, y, 1.6), 0.9, "qz")
    # small dark hub roof on every site, so the workshop's place reads
    c.fill(poly([(58, 40), (64, 35), (70, 40)]) if sid != "quarry" else poly([(60, 47), (64, 43), (68, 47)]), 0.4, "patina")
    vig = np.clip(np.hypot((X - 64) / 64, (Y - 48) / 52) - 0.9, 0, 1) * 2.0
    c.img[(BAYER8 + 0.5 < vig) & m] = (*P["ink"][0], 255)
    return c.img[:96, :128].copy()


def gilt_frame():
    """48 x 48 picture frame for site paintings: thick gilt moulding, inner bead, corner rosettes. slice 16."""
    c = Canvas()
    S = 48
    outer = rect(0, 0, S, S) & ~rect(12, 12, S - 12, S - 12)
    c.fill(outer, 0.3 + 0.6 * np.clip(1 - np.minimum(np.minimum(X, Y), np.minimum(S - X, S - Y)) / 12, 0, 1) ** 0.8,
           "brass")
    c.set(rect(0, 0, S, 1) | rect(0, 0, 1, S), P["brass"][-1])
    c.set(rect(0, S - 1, S, S) | rect(S - 1, 0, S, S), P["brass"][0])
    bead = rect(9, 9, S - 9, S - 9) & ~rect(11, 11, S - 11, S - 11)
    c.set(bead, P["brass"][1])
    c.set(bead & ((X.astype(int) + Y.astype(int)) % 3 == 0), P["brass"][5])
    for x, y in ((6, 6), (S - 6, 6), (6, S - 6), (S - 6, S - 6)):
        r = disc(x, y, 4.5)
        plate(c, r, "brass", 0.4, 1.0)
        c.set(disc(x, y, 1.5), P["glow"][4])
    c.finish(P["steel"][0])
    return c.img[:S, :S].copy()


def quest_frame():
    """48 x 48 quest card: parchment fill with a torn-dither edge, brass corner caps and a wax seal at the top. slice 16
    fill, so the parchment stretches under the text."""
    c = Canvas()
    S = 48
    paper = rect(2, 2, S - 2, S - 2)
    c.fill(paper, 0.55 + 0.35 * np.clip(1 - np.hypot((X - 20) / 40, (Y - 18) / 40), 0, 1), "cream", bayer=BAYER8)
    torn = paper & ~rect(4, 4, S - 4, S - 4) & (BAYER8 > 0.15)
    c.img[torn] = 0
    c.set(rect(5, 5, S - 5, 6) | rect(5, S - 6, S - 5, S - 5), P["cream"][1])
    for fx in (0, 1):
        for fy in (0, 1):
            x0 = S - 12 if fx else 0
            y0 = S - 12 if fy else 0
            tri = poly([(x0 + (12 if fx else 0), y0 + (12 if fy else 0)),
                        (x0 + (0 if fx else 12), y0 + (12 if fy else 0)),
                        (x0 + (12 if fx else 0), y0 + (0 if fy else 12))])
            plate(c, tri, "brass")
    c.finish(P["steel"][0])
    return c.img[:S, :S].copy()


def wax_seal():
    """24 x 24 red wax seal with a gear stamp, to pin on a quest card."""
    c = Canvas()
    blob = disc(12, 12, 10) | disc(5, 15, 4) | disc(19, 6, 3.5)
    c.fill(blob, 0.35 + 0.5 * np.clip(1 - np.hypot(X - 8, Y - 8) / 14, 0, 1), "brick", bayer=K.BAYER)
    g = poly([(12 + x, 12 + y) for x, y in gear_outline(6, 4.6, 8)])
    c.set(edge(g, 1, 0) | edge(g, 0, 1), P["brick"][0])
    c.set(edge(g, -1, 0) | edge(g, 0, -1), P["brick"][-1])
    c.finish(P["steel"][0])
    return c.img[:24, :24].copy()


def round2():
    cat = catalog()
    ms = cat["ms"]
    rs = cat["rs"]
    v = {}
    v["milestones"] = save(np.concatenate([milestone_card(m[2]) for m in ms], axis=1), "milestones", pair=True)
    cols = 6
    rows = (len(rs) + cols - 1) // cols
    sheet = np.zeros((rows * 96, cols * 128, 4), np.uint8)
    for k, (rid, _, items, alt) in enumerate(rs):
        r, cc = divmod(k, cols)
        sheet[r * 96:(r + 1) * 96, cc * 128:(cc + 1) * 128] = mastery_card(rid) if rid in MASTERY else research_card(items, alt)
    v["research"] = save(sheet, "research", pair=True)
    v["sites"] = save(np.concatenate([site_scene(s) for s in SITES], axis=1), "sites", pair=True)
    v["gilt"] = save(gilt_frame(), "frame-gilt")
    v["quest"] = save(quest_frame(), "quest")
    v["seal"] = save(wax_seal(), "seal")
    q = lambda k: k if k.isidentifier() else f'"{k}"'  # noqa: E731
    ms_map = "\n".join(f"    {q(m[0])}: {k}, // {m[1]}" for k, m in enumerate(ms))
    rs_map = "\n".join(f"    {q(r[0])}: {k}, // {r[1]}" for k, r in enumerate(rs))
    st_map = "\n".join(f"    {q(sid)}: {k}," for k, sid in enumerate(SITES))
    return f'''
/** Milestone banners: 128 x 96 cells in one row, the milestone's delivery items piled on a shipping crate. */
export const MILESTONE_SHEET = {{ url: "/brasswork/art/milestones.webp?v={v["milestones"]}", w: 128, h: 96, cols: {len(ms)}, rows: 1 }} as const;
export const MILESTONE_ART: Record<string, number> = {{
{ms_map}
}};

/** Research cards: 128 x 96 blueprint cells, {cols} across; alternates carry a copper corner. */
export const RESEARCH_SHEET = {{ url: "/brasswork/art/research.webp?v={v["research"]}", w: 128, h: 96, cols: {cols}, rows: {rows} }} as const;
export const RESEARCH_ART: Record<string, number> = {{
{rs_map}
}};

/** Prestige site paintings: 128 x 96 cells in one row; hang them in DECOR_EXTRA.gilt. */
export const SITE_SHEET = {{ url: "/brasswork/art/sites.webp?v={v["sites"]}", w: 128, h: 96, cols: {len(SITES)}, rows: 1 }} as const;
export const SITE_ART: Record<string, number> = {{
{st_map}
}};

/** Gilt picture frame (sites), quest card parchment and its wax seal. Frames: border-image slice 16 (quest: fill). */
export const DECOR_EXTRA = {{
    gilt: {{ url: "/brasswork/art/frame-gilt.png?v={v["gilt"]}", w: 48, h: 48, slice: 16 }},
    quest: {{ url: "/brasswork/art/quest.png?v={v["quest"]}", w: 48, h: 48, slice: 16 }},
    seal: {{ url: "/brasswork/art/seal.png?v={v["seal"]}", w: 24, h: 24 }},
}} as const;
'''


# ------------------------------------------------------------------ build
def save(arr, name, pair=False):
    img = to_image(arr)
    if pair:
        save_pair(img, OUT / name)
        return hashlib.sha1((OUT / f"{name}.webp").read_bytes()).hexdigest()[:8]
    img.save(OUT / f"{name}.png", optimize=True)
    return hashlib.sha1((OUT / f"{name}.png").read_bytes()).hexdigest()[:8]


def q2(k):
    return k if k.isidentifier() else f'"{k}"'


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    cols = 4
    rows = (len(PORTRAITS) + cols - 1) // cols
    sheet = np.zeros((rows * 128, cols * 128, 4), np.uint8)
    for k, (mid, _, acc) in enumerate(PORTRAITS):
        r, cc = divmod(k, cols)
        sheet[r * 128:(r + 1) * 128, cc * 128:(cc + 1) * 128] = portrait(mid, acc).img
    v_por = save(sheet, "portraits", pair=True)
    v_frame = save(frame(), "frame")
    v_rar = {}
    for rid, _, metal, g in RARITY:
        v_rar[rid] = save(frame(metal, g, rid == "legendary"), f"frame-{rid}")
    v_head = save(header(), "header")
    rule, gear = divider()
    v_rule, v_gear = save(rule, "rule"), save(gear, "gear")
    face, needle = gauge()
    v_gauge, v_needle = save(face, "gauge"), save(needle, "needle")
    kinds = ["crate", "blueprint", "idle"]
    emp = np.concatenate([empty_scene(k) for k in kinds], axis=1)
    v_emp = save(emp, "empty", pair=True)

    rar = "\n".join(f'    {rid}: {{ label: "{lab}", url: "/brasswork/art/frame-{rid}.png?v={v_rar[rid]}" }},'
                    for rid, lab, _, _ in RARITY)
    mr = "\n".join(f'    {k}: "{v}",' for k, v in MACHINE_RARITY.items())
    extra = round2()
    hashes = ",\n".join(f'    {q2(i)}: "{model_hash(i)}"' for i, _, _ in PORTRAITS)
    extra += f'''
/** Hash of each machine's model source when its portrait was drawn (checked by tests/automation/menu-art.test.mjs). */
export const PORTRAIT_MODEL_HASH: Record<string, string> = {{
{hashes},
}};
'''
    q = lambda k: k if k.isidentifier() else f'"{k}"'  # noqa: E731
    cells = ",\n".join(f"    {q(i)}: {k}, // {name}" for k, (i, name, _) in enumerate(PORTRAITS))
    TS.parent.mkdir(parents=True, exist_ok=True)
    TS.write_text(f'''// Generated by scripts/brasswork/build-menu-art.py. Do not edit; re-run the script after changing the art.

/** Machine portraits: 128 px art cells, {cols} across, each machine on a lamplit workshop bench. */
export const PORTRAIT_SHEET = {{
    url: "/brasswork/art/portraits.webp?v={v_por}",
    png: "/brasswork/art/portraits.png?v={v_por}",
    cell: 128,
    cols: {cols},
    rows: {rows},
}} as const;

/** Sheet cell per machine or structure id (every orrery stage uses "orrery"). */
export const PORTRAITS = {{
{cells},
}} as const;

export type PortraitId = keyof typeof PORTRAITS;

/** Portrait cell for a building id; orrery stages fold into "orrery". */
export function portraitCell(id: string): number | undefined {{
    const key = id.startsWith("orrery") ? "orrery" : id;
    return (PORTRAITS as Record<string, number>)[key];
}}

/** Panel decor. Sizes are art px; draw at 2x with image-rendering: pixelated. */
export const DECOR = {{
    frame: {{ url: "/brasswork/art/frame.png?v={v_frame}", w: 48, h: 48, slice: 16 }},
    header: {{ url: "/brasswork/art/header.png?v={v_head}", w: 96, h: 28, slice: 30 }},
    rule: {{ url: "/brasswork/art/rule.png?v={v_rule}", w: 8, h: 12 }},
    gear: {{ url: "/brasswork/art/gear.png?v={v_gear}", w: 20, h: 12 }},
    gauge: {{ url: "/brasswork/art/gauge.png?v={v_gauge}", w: 64, h: 64 }},
    needle: {{ url: "/brasswork/art/needle.png?v={v_needle}", w: 64, h: 64 }},
}} as const;

/** Empty-state scenes: 128 x 96 art cells in one row. */
export const EMPTY_SHEET = {{
    url: "/brasswork/art/empty.webp?v={v_emp}",
    png: "/brasswork/art/empty.png?v={v_emp}",
    w: 128,
    h: 96,
}} as const;

/** Rarity tiers: a 48 x 48 frame per tier (same slice as DECOR.frame) and the tier of each machine. */
export const RARITY_FRAMES = {{
{rar}
}} as const;
export type Rarity = keyof typeof RARITY_FRAMES;

export const MACHINE_RARITY: Record<string, Rarity> = {{
{mr}
}};

/** Rarity of a building id (orrery stages fold into "orrery"); unknown ids are common. */
export function rarityOf(id: string): Rarity {{
    return MACHINE_RARITY[id.startsWith("orrery") ? "orrery" : id] ?? "common";
}}

export const EMPTY_SCENES = {{ crate: 0, blueprint: 1, idle: 2 }} as const;
export type EmptyScene = keyof typeof EMPTY_SCENES;
''' + extra)
    if "--preview" in sys.argv:
        dst = sys.argv[sys.argv.index("--preview") + 1]
        preview(dst)


def preview(dst):
    """Contact sheet: portraits at 2x, decor at 3x, on the panel wood colour."""
    bg = (36, 22, 12, 255)
    por = Image.open(OUT / "portraits.png")
    emp = Image.open(OUT / "empty.png")
    extra = [Image.open(OUT / f"{n}.png") for n in ("milestones", "research", "sites")]
    parts = [por.resize((por.width * 2, por.height * 2), Image.NEAREST),
             emp.resize((emp.width * 2, emp.height * 2), Image.NEAREST)]
    parts += [e.resize((e.width * 2, e.height * 2), Image.NEAREST) for e in extra]
    row = Image.new("RGBA", (1900, 200), bg)
    x = 16
    for name in ("frame-common", "frame-uncommon", "frame-rare", "frame-epic", "frame-legendary", "frame-gilt", "quest", "seal", "header", "gauge", "needle", "gear", "rule"):
        im = Image.open(OUT / f"{name}.png")
        im = im.resize((im.width * 3, im.height * 3), Image.NEAREST)
        row.alpha_composite(im, (x, 8))
        x += im.width + 24
    parts.append(row)
    W = max(p.width for p in parts)
    H = sum(p.height for p in parts) + 16 * len(parts)
    out = Image.new("RGBA", (W, H), bg)
    y = 0
    for p in parts:
        out.alpha_composite(p, (0, y))
        y += p.height + 16
    out.save(dst)


if __name__ == "__main__":
    main()
