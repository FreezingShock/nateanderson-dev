"""Node Farm staged zone art for Undersun (zones 26 to 29, after the ending).

Same contract as zone-art-18-25.py (docs/node-farm.md, "Zone art"): one sheet per zone at public/naos/nodefarm/zone-<id>,
288 x 96 cells, 8 rows (row 0 is the bare backdrop, row n adds sprite n) by 6 frames, a 6-frame loop at 6 fps.

  * backdrop: the zone's era scene (nodefarm-scenes-undersun.py, eras 23..26) drawn as a panorama of its lower band, slightly
    dimmed, with its animated overlay stepped in time with the panel
  * sprites 1-5: the zone's first five 64 px button sprites (nodefarm_arc64_undersun.py), walking up in size to the right;
    6 is the namesake (tier 6) at three quarters size, and at 7 it grows to full size in the same place

Run: python3 scripts/naos-art/zone-art-26-29.py [corona|plasma|lattice|radiance ...]   then node scripts/nodefarm/stamp-art.mjs
"""
import importlib.util
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

import nodefarm_zone_kit as ZK  # noqa: E402
from nodefarm_arc64_undersun import make  # noqa: E402

_spec = importlib.util.spec_from_file_location("nodefarm_scenes_undersun", HERE / "nodefarm-scenes-undersun.py")
SC = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(SC)

W, H, F = ZK.W, ZK.H, ZK.FRAMES
FLOOR = 95
ERA = {"corona": 23, "plasma": 24, "lattice": 25, "radiance": 26}
# the band of the era world shown in the panel (world x offset, top world row) and scale; chosen so the scene's floor line
# sits near the panel floor and its centrepiece falls right of centre, behind the hero
BAND = {23: (60, 110), 24: (40, 100), 25: (60, 120), 26: (30, 100)}
SCALE = 0.6
# sprite n: (centre x, size in px). 1-4 at half size, 5-6 at three quarters, 7 (6 grown) at full size
SLOT = {1: (70, 32), 2: (100, 32), 3: (130, 32), 4: (160, 32), 5: (196, 48), 6: (250, 48), 7: (250, 64)}
DIM = 0.72


class Cell:
    def __init__(self, img):
        self.img = img


def backdrop(era, f):
    ox, oy = BAND[era]
    v = SC.View(W, H, SCALE, ox, oy)
    _, far, near, fx, _ = SC.K.ERAS[era]
    img = SC.over(SC.over(far(v).img, near(v).img), fx(v, round(f * SC.FRAMES / F) % SC.FRAMES).img)
    out = img.copy()
    out[..., :3] = (img[..., :3] * DIM).astype(np.uint8)
    # a dark floor strip so sprites read as standing on something
    out[FLOOR - 1:, :, :3] = (out[FLOOR - 1:, :, :3] * 0.6).astype(np.uint8)
    return out


def sprite(stat, tier, f, size):
    draw, icon = make(stat)
    a = draw(tier, f / F).img
    if size != 64:
        a = np.asarray(Image.fromarray(a, "RGBA").resize((size, size), Image.NEAREST))
    return a


def paste(dst, src, cx, bottom):
    h, w = src.shape[:2]
    x0, y0 = int(round(cx - w / 2)), int(bottom - h)
    xs0, ys0 = max(0, -x0), max(0, -y0)
    x1, y1 = min(W, x0 + w), min(H, y0 + h)
    region = src[ys0:ys0 + (y1 - max(0, y0)), xs0:xs0 + (x1 - max(0, x0))]
    m = region[..., 3] >= 128
    d = dst[max(0, y0):y1, max(0, x0):x1]
    d[m] = region[m]
    d[m, 3] = 255


def build(stat):
    era = ERA[stat]
    bgs = [backdrop(era, f) for f in range(F)]

    def draw(stage, f):
        img = bgs[f].copy()
        for n in range(1, stage + 1):
            if n == 6 and stage >= 7:
                continue                      # the namesake grows into sprite 7 in the same place
            cx, size = SLOT[n]
            # 1-5 are tiers 1-5; 6 is the namesake (tier 6) arriving at three quarters size; 7 is it at full size
            tier = min(n - 1, 5)
            paste(img, sprite(stat, tier, (f + n) % F, size), cx, FLOOR + (2 if size < 64 else 1))
        return Cell(img)

    print(f"zone-{stat}")
    ZK.save_sheet(stat, draw)


if __name__ == "__main__":
    for s in sys.argv[1:] or list(ERA):
        build(s)
