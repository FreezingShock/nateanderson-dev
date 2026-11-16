"""Expedition site previews: one original pixel-art terrain per island site, in the brass palette (no cyan).

  public/brasswork/sites/<id>.webp   512 x 384 (4:3), the picture on each Expedition card and the workshop selection screen

Each site has its own land (iron ridge, copper cove, high bank, old quarry), its own sky tint and sun, and the ore it
really holds: the outcrops drawn on it match the site's nodes in lib/automation/sim/data.ts. The hub tower marks where
the workshop lands. The scene is drawn at 128 x 96 with the naOS kit, then scaled 4x with nearest-neighbour, so every
dither step stays a crisp pixel.

Run: python3 scripts/brasswork/build-site-previews.py [--preview out.png]
"""
import os
import sys
from pathlib import Path

os.environ["NAOS_KIT_N"] = "128"  # the kit draws on a 128 px canvas, scene size 128 x 96

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import bw_palette  # noqa: E402,F401  (brass ramps on top of the naOS palette)
from nodefarm_icon_kit import BAYER8, Canvas, P, X, Y, disc, edge, grow, line, poly, rect  # noqa: E402

W, H = 128, 96
SCALE = 4
OUT = ROOT / "public/brasswork/sites"

# Ore colour names from the brass palette, one per raw ore in the real tree.
ORE_PAL = {"iron_ore": "ironore", "copper_ore": "cu", "coal": "coal", "quartz": "qz", "aluminium_ore": "bauxite"}


def sky(c, top, bottom, pal, sun=None, sun_r=7, sun_pal="glow", sun_v=0.95):
    """Sky band from top to bottom (0 to 50), dithered from `top` to `bottom` shade, with an optional sun disc."""
    m = rect(0, 0, W, 50)
    c.fill(m, top + (bottom - top) * np.clip(Y / 50, 0, 1), pal, bayer=BAYER8)
    if sun:
        sx, sy = sun
        c.fill(disc(sx, sy, sun_r), sun_v, sun_pal)
        c.glow(disc(sx, sy, sun_r), P[sun_pal][3], r=4, a=70)
    return m


def outcrop(c, x, y, item, pure):
    """A small ore outcrop: a squat dithered mound, a bright glint on pure nodes."""
    pal = ORE_PAL[item]
    m = disc(x, y, 2.9 if pure else 2.2, 1.9)
    c.fill(m, 0.6, pal, bayer=BAYER8)
    c.set(edge(m, 0, -1) & m, P[pal][-1])
    c.set(edge(m, 0, 1) & m, P[pal][0])
    if pure:
        c.set(disc(x - 1, y - 1, 0.7), P[pal][-1])
        c.set(disc(x + 1.2, y + 0.4, 0.4), P["cream"][-1])


def tower(c, x, y):
    """Hub marker: a small brass stack with a patina cap and one lit window, standing on (x, y)."""
    stack = rect(x - 2, y - 11, x + 2, y)
    c.fill(stack, np.clip(1.0 - (X - (x - 2)) / 4.0, 0, 1) * 0.55 + 0.25, "cu", bayer=BAYER8)
    roof = poly([(x - 3, y - 11), (x, y - 17), (x + 3, y - 11)])
    c.fill(roof, 0.7, "patina")
    c.set(rect(x - 1, y - 8, x + 1, y - 6), P["glow"][4])
    c.set(rect(x - 3, y, x + 3, y + 1), P["ink"][0])
    c.outline(stack | roof, "ink")


def scene_ridge(c, rng):
    """Iron ridge: a dusk over a rust-red ridge of striated iron, with scree and an ore-dark face."""
    sky(c, 0.25, 0.85, "glow", sun=(36, 36), sun_r=6)
    far = poly([(0, 60), (18, 42), (36, 52), (58, 34), (84, 50), (104, 40), (128, 56), (128, 96), (0, 96)])
    c.fill(far, 0.25 + 0.2 * np.clip(1 - (Y - 34) / 40, 0, 1), "rock", bayer=BAYER8)
    ridge = poly([(0, 72), (14, 56), (30, 62), (52, 46), (72, 58), (92, 48), (114, 60), (128, 66), (128, 96), (0, 96)])
    c.fill(ridge, 0.3 + 0.5 * np.clip(1 - (Y - 46) / 40, 0, 1), "ironore", bayer=BAYER8)
    # strata: diagonal bands across the face
    bands = ridge & (np.abs(((Y + 0.35 * X) % 9) - 4.5) < 0.7) & (BAYER8 < 0.5)
    c.set(bands, P["ironore"][-3])
    c.set(edge(ridge, 0, -1) & ridge, P["glow"][3])  # sunlit crest
    for x, y in rng.uniform((6, 74), (122, 92), (26, 2)):
        if ridge[int(y), int(x)] or y > 80:
            c.fill(disc(x, y, 1.2), 0.8, "rust")
    terrace = rect(50, 52, 68, 55)
    c.fill(terrace, 0.45, "rock", bayer=BAYER8)
    c.set(edge(terrace, 0, 1) & terrace, P["rock"][0])
    tower(c, 59, 52)
    for item, x, y, pure in (("iron_ore", 16, 70, True), ("coal", 30, 80, False), ("copper_ore", 44, 70, False),
                             ("quartz", 78, 74, False), ("aluminium_ore", 102, 84, False)):
        outcrop(c, x, y, item, pure)


def scene_cove(c, rng):
    """Copper cove: a pale morning over a green-patina inlet, a sand spit and a windmill on the headland."""
    sky(c, 0.55, 0.92, "cream", sun=(104, 16), sun_r=6)
    sea = rect(0, 50, W, H)
    c.fill(sea, 0.22 + 0.26 * np.clip((Y - 50) / 40, 0, 1), "patina", bayer=BAYER8)
    # sheen: broken horizontal lines across the water
    sheen = sea & (np.sin(Y * 1.4 + X * 0.06) > 0.82) & (BAYER8 < 0.6)
    c.set(sheen, P["patina"][-2])
    left = poly([(0, 42), (30, 38), (48, 48), (42, 58), (26, 64), (10, 66), (0, 68)])
    right = poly([(92, 46), (112, 42), (128, 44), (128, 64), (110, 60), (98, 56)])
    spit = poly([(44, 58), (58, 56), (70, 62), (58, 66), (44, 64)])
    for land, v in ((left, 0.45), (right, 0.35), (spit, 0.7)):
        c.fill(land, v + 0.25 * np.clip(1 - (Y - 40) / 30, 0, 1), "patina" if land is not spit else "bauxite", bayer=BAYER8)
        c.set(edge(land, 0, 1) & land, P["cream"][1])
    c.set(edge(left, 1, 0) & left, P["cream"][4])  # foam line on the shore
    c.set(edge(right, -1, 0) & right, P["cream"][4])
    # windmill on the right headland
    c.fill(rect(109, 34, 111, 47), 0.45, "wood", bayer=BAYER8)
    hub = (110, 33)
    for a in (0.3, 1.87, 3.44, 5.01):
        c.set(line(hub[0], hub[1], hub[0] + 11 * np.cos(a), hub[1] + 11 * np.sin(a), 1.6), P["cream"][4])
    c.fill(disc(hub[0], hub[1], 1.8), 0.7, "brass")
    tower(c, 26, 52)
    for item, x, y, pure in (("copper_ore", 8, 58, True), ("aluminium_ore", 16, 50, False), ("iron_ore", 4, 64, False),
                             ("coal", 52, 62, False), ("quartz", 118, 52, False)):
        outcrop(c, x, y, item, pure)


def scene_high_bank(c, rng):
    """High bank: a tall hazy bluff of banded stone with copper, coal and quartz seams and a plateau for the hub."""
    sky(c, 0.5, 0.95, "bauxite", sun=(102, 14), sun_r=6, sun_pal="cream", sun_v=1.0)
    c.fill(rect(0, 50, W, H), 0.5, "bauxite", bayer=BAYER8)  # ground behind the bluff, so no gaps show at the sides
    cliff = poly([(12, 74), (18, 24), (64, 16), (110, 24), (118, 74)])
    c.fill(cliff, 0.2 + 0.5 * np.clip(1 - (X - 12) / 106, 0, 1), "rock", bayer=BAYER8)
    top = rect(12, 16, 118, 24) & grow(cliff, 1)
    c.fill(top, 0.6, "patina", bayer=BAYER8)
    for y0, pal in ((38, "cu"), (54, "wood"), (68, "qz")):
        seam = cliff & (np.abs(Y - y0 - 3 * np.sin(X / 9)) < 2.0)
        c.fill(seam, 0.6, pal)
    # ledges: a lighter band under each seam
    for y0 in (44, 60):
        c.set(cliff & (np.abs(Y - y0 - 3 * np.sin(X / 9)) < 0.7), P["rock"][-1])
    talus = rect(0, 74, W, H)
    c.fill(talus, 0.45 + 0.2 * np.clip((Y - 74) / 22, 0, 1), "bauxite", bayer=BAYER8)
    for x, y in rng.uniform((4, 78), (124, 94), (34, 2)):
        c.fill(disc(x, y, 1.1), 0.25, "rock")
    tower(c, 62, 22)
    for item, x, y, pure in (("quartz", 26, 48, True), ("aluminium_ore", 40, 44, False), ("iron_ore", 88, 46, False),
                             ("copper_ore", 98, 62, False), ("coal", 36, 62, False)):
        outcrop(c, x, y, item, pure)


def scene_quarry(c, rng):
    """Old quarry: a stepped pit in pale stone, lit by one lamp at the bottom, with the hub on the rim."""
    sky(c, 0.6, 0.97, "cream", sun=(24, 14), sun_r=6, sun_pal="glow", sun_v=0.92)
    ground = rect(0, 42, W, H)
    c.fill(ground, 0.5 + 0.12 * np.clip((Y - 42) / 40, 0, 1), "bauxite", bayer=BAYER8)
    steps = ((46, 14, 0.62), (30, 10, 0.5), (19, 7, 0.4), (11, 4.5, 0.3))
    for k, (rx, ry, v) in enumerate(steps):
        d = disc(64, 54 + 5 * k, rx, ry)
        c.fill(d, v, "rock", bayer=BAYER8)
        c.set(edge(d, 0, -1) & d, P["cream"][3])  # lit lip on the far wall
        c.set(edge(d, 0, 1) & d, P["rock"][1])
    for x, y in rng.uniform((30, 46), (98, 70), (10, 2)):
        if disc(64, 54, 46, 14)[int(y), int(x)]:
            c.set(disc(x, y, 0.8), P["qz"][-2])
    lamp = disc(64, 72, 5, 2.4)
    c.glow(lamp, P["glow"][3], r=6, a=90)
    c.fill(lamp, 0.95, "glow")
    tower(c, 22, 50)
    for item, x, y, pure in (("iron_ore", 44, 58, True), ("copper_ore", 84, 58, False), ("coal", 52, 66, False),
                             ("quartz", 78, 66, False), ("aluminium_ore", 98, 54, False)):
        outcrop(c, x, y, item, pure)


SCENES = {"ridge": scene_ridge, "cove": scene_cove, "high-bank": scene_high_bank, "quarry": scene_quarry}


def draw(site_id, seed):
    c = Canvas()
    rng = np.random.default_rng(seed)
    SCENES[site_id](c, rng)
    vig = np.clip(np.hypot((X - 64) / 64, (Y - 48) / 52) - 1.0, 0, 1) * 1.1
    c.img[BAYER8 + 0.5 < vig] = (*P["ink"][0], 255)
    return c.img[:H, :W].copy()


def render(site_id, seed):
    img = Image.fromarray(draw(site_id, seed), "RGBA")
    return img.resize((W * SCALE, H * SCALE), Image.NEAREST)


def main():
    preview = None
    if "--preview" in sys.argv:
        preview = Path(sys.argv[sys.argv.index("--preview") + 1])
    OUT.mkdir(parents=True, exist_ok=True)
    tiles = []
    for seed, site_id in enumerate(SCENES):
        img = render(site_id, seed + 7)
        tiles.append(img)
        if preview is None:
            img.convert("RGB").save(OUT / f"{site_id}.webp", "WEBP", lossless=True, method=6)
            print("wrote", OUT / f"{site_id}.webp")
    if preview is not None:
        sheet = Image.new("RGBA", (W * SCALE * 2, H * SCALE * 2), (20, 14, 8, 255))
        for i, t in enumerate(tiles):
            sheet.alpha_composite(t, ((i % 2) * W * SCALE, (i // 2) * H * SCALE))
        sheet.convert("RGB").save(preview)
        print("preview", preview)


if __name__ == "__main__":
    main()
