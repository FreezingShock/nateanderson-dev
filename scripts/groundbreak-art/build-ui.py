"""Groundbreak menu art: one dithered golden-hour header banner per window, plus the dock's ground strip.

  public/groundbreak/ui/<id>.png   230 x 44 px (shown at 2x, pixelated)
  components/groundbreak-art/ui-art.ts   generated ?v= stamps

Run: python3 scripts/groundbreak-art/build-ui.py [--preview out.png]
"""
import hashlib
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
from gb_kit import P, Canvas  # noqa: E402

W, H = 230, 44
OUT = ROOT / "public/groundbreak/ui"
TS = ROOT / "components/groundbreak-art/ui-art.ts"
INK = P["ink"][0]


def sky(c, sun_x, horizon=H - 8, warm=0.0):
    """Violet overhead into amber at the horizon, a low sun, faint haze bands."""
    t = np.clip(c.Y / horizon, 0, 1) ** 1.25 * 0.92 + warm
    c.fill(np.ones((c.h, c.w), bool), np.clip(t, 0, 1), "sky", dither=1.0)
    glow = np.clip(1 - np.hypot((c.X - sun_x) / 70, (c.Y - horizon) / 26), 0, 1)
    c.thin(glow > 0.35, P["sky"][10], 0.5)
    c.thin(glow > 0.6, P["sky"][11], 0.7)
    c.set(c.disc(sun_x, horizon - 4, 6), P["lamp"][5])
    c.set(c.disc(sun_x, horizon - 4, 4), P["lamp"][6])


def ground(c, y, pal="dirt", v=0.25):
    m = c.Y >= y
    c.fill(m, np.clip(v + (c.Y - y) * -0.02, 0, 1), pal)
    c.set(m & (c.Y < y + 1), P["sand"][5])  # sunlit lip


def sil(c, mask, rim_left=True):
    """Silhouette in warm ink with a one-pixel amber rim on the sun side."""
    c.set(mask, P["roof"][1])
    edge = mask & ~np.roll(mask, 1, 1) if rim_left else mask & ~np.roll(mask, 1, 0)
    c.set(edge, P["hiviz"][4])
    top = mask & ~np.roll(mask, 1, 0)
    c.set(top, P["hiviz"][3])


def boxm(c, x0, y0, x1, y1):
    return c.rect(x0, y0, x1, y1)


def crane(c, x, base, h, jib_l, jib_r):
    m = boxm(c, x, base - h, x + 3, base)
    m |= boxm(c, x - jib_l, base - h - 2, x + jib_r, base - h)
    m |= c.line(x + 1.5, base - h - 7, x - jib_l + 2, base - h - 1, 1) | c.line(x + 1.5, base - h - 7, x + jib_r - 2, base - h - 1, 1)
    m |= boxm(c, x - jib_l + 1, base - h - 4, x - jib_l + 6, base - h)  # counterweight
    hook = x + jib_r - 8
    m |= boxm(c, hook, base - h, hook + 1, base - h + 12) | boxm(c, hook - 2, base - h + 12, hook + 3, base - h + 14)
    return m


def window_lights(c, x0, y0, x1, y1, step=4, seed=0):
    rng = np.random.default_rng(seed)
    for x in range(x0, x1, step):
        for y in range(y0, y1, step):
            if rng.random() < 0.55:
                c.set(boxm(c, x, y, x + 2, y + 2), P["lamp"][rng.integers(3, 6)])


def city(c, base, seed, x0=0, x1=W, hmax=22):
    rng = np.random.default_rng(seed)
    x = x0
    m = np.zeros((c.h, c.w), bool)
    while x < x1:
        w = int(rng.integers(6, 14)); h = int(rng.integers(6, hmax))
        m |= boxm(c, x, base - h, x + w, base)
        x += w + int(rng.integers(0, 3))
    c.thin(m, P["haze"][3], 0.85)
    return m


# ---------------------------------------------------------------- one banner per window
def jobs(c):
    """Next jobs: the site board. Hoarding fence with hazard boards, a crane, the lot waiting."""
    sky(c, 172)
    city(c, H - 10, 3, hmax=18)
    ground(c, H - 8)
    sil(c, crane(c, 64, H - 8, 26, 22, 46))
    fence = np.zeros((c.h, c.w), bool)
    for x in range(0, W, 6):
        fence |= boxm(c, x, H - 15, x + 1, H - 8)
    fence |= boxm(c, 0, H - 14, W, H - 13)
    sil(c, fence)
    for x0 in (112, 140):  # site boards on the fence
        c.set(boxm(c, x0, H - 20, x0 + 22, H - 10), P["white"][2])
        c.set(boxm(c, x0 + 2, H - 18, x0 + 14, H - 17), INK)
        c.set(boxm(c, x0 + 2, H - 15, x0 + 18, H - 14), P["ink"][2])
        c.set(boxm(c, x0, H - 11, x0 + 22, H - 10), P["hiviz"][4])
    stakes = np.zeros((c.h, c.w), bool)
    for x in (184, 200, 216):
        stakes |= boxm(c, x, H - 12, x + 1, H - 8)
    c.set(stakes, P["wood"][5])
    c.set(c.line(184, H - 11, 217, H - 11, 1), P["safety"][4])  # string line


def firm(c):
    """Firm: the site office. A stacked trailer with lit windows, a flag, the skyline you have built behind it."""
    sky(c, 42, warm=0.02)
    city(c, H - 8, 9, x0=90, hmax=26)
    ground(c, H - 8, "concrete", 0.3)
    tr = boxm(c, 120, H - 26, 196, H - 8) | boxm(c, 132, H - 38, 186, H - 26)
    sil(c, tr)
    window_lights(c, 124, H - 23, 194, H - 11, 6, 2)
    window_lights(c, 136, H - 35, 184, H - 29, 6, 5)
    c.set(boxm(c, 200, H - 40, 201, H - 8), P["steel"][5])
    c.set(boxm(c, 201, H - 40, 214, H - 33), P["hiviz"][5])
    c.set(boxm(c, 201, H - 34, 214, H - 33), P["hiviz"][2])
    stair = np.zeros((c.h, c.w), bool)
    for k in range(5):
        stair |= boxm(c, 110 + k * 2, H - 10 - k * 3, 122, H - 9 - k * 3)
    c.set(stair, P["steel"][3])


def current(c):
    """Current job panel: surveyed ground with a level and stakes, the sun low across it."""
    sky(c, 196, warm=0.04)
    hills = c.Y > H - 14 + 4 * np.sin(c.X / 23) + 2 * np.sin(c.X / 7.3)
    c.thin(hills, P["haze"][2], 0.9)
    ground(c, H - 9)
    c.fill(c.rect(20, H - 9, 100, H - 5), 0.35, "gravel")
    c.fill(c.rect(110, H - 9, 170, H - 6), 0.4, "concrete")
    m = c.line(40, H - 9, 46, H - 24, 1) | c.line(52, H - 9, 46, H - 24, 1) | c.line(46, H - 9, 46, H - 24, 1)
    m |= boxm(c, 42, H - 28, 51, H - 23)
    sil(c, m)
    for x in (120, 150, 166):
        c.set(boxm(c, x, H - 15, x + 1, H - 9), P["wood"][5])
        c.set(boxm(c, x, H - 15, x + 3, H - 13), P["safety"][4])


def skyline(c):
    sky(c, 120, warm=-0.02)
    c.thin(city(c, H - 8, 21, hmax=30), P["haze"][4], 0.5)
    ground(c, H - 8, "water", 0.55)
    m = np.zeros((c.h, c.w), bool)
    for tx in (140, 200):  # a suspension span, the campaign's last job
        m |= boxm(c, tx, H - 34, tx + 3, H - 8)
    m |= boxm(c, 100, H - 13, W, H - 11)
    for k in range(100, W):
        y = H - 33 + 16 * (1 - ((k - 170) / 30) ** 2) if 140 <= k <= 200 else None
        if y is not None:
            m |= boxm(c, k, int(y), k + 1, int(y) + 1)
    sil(c, m)


def console(c):
    c.fill(np.ones((c.h, c.w), bool), np.clip(c.Y / H * 0.3, 0, 1), "ink", dither=1.0)
    for y in range(4, H, 3):
        c.thin(c.rect(0, y, W, y + 1), P["roof"][2], 0.5)
    rng = np.random.default_rng(4)
    for k in range(5):
        y = 8 + k * 7
        L = int(rng.integers(30, 150))
        c.set(c.rect(12, y, 16, y + 2), P["hiviz"][5])
        c.set(c.rect(20, y, 20 + L, y + 2), P["hiviz"][3] if k < 4 else P["hiviz"][6])
    c.set(c.rect(20 + 70, 8 + 4 * 7, 24 + 70, 8 + 4 * 7 + 3), P["lamp"][5])


def menu(c):
    """Pegboard in the site shed: tools hung in the low sun."""
    c.fill(np.ones((c.h, c.w), bool), 0.25 + np.clip(c.X / W, 0, 1) * 0.15, "wood", dither=1.0)
    for x in range(4, W, 8):
        for y in range(4, H, 8):
            c.set(c.rect(x, y, x + 1, y + 1), P["wood"][1])
    c.thin(np.clip(1 - np.hypot(c.X - 20, c.Y) / 90, 0, 1) > 0.3, P["sand"][5], 0.3)  # sun through the door
    m = c.line(40, 10, 40, 34, 2) | c.rect(35, 8, 46, 13)  # hammer
    m |= c.line(80, 8, 96, 36, 2) | c.line(96, 8, 80, 36, 2)  # pliers
    m |= c.rect(130, 10, 180, 15) | c.rect(132, 15, 134, 30)  # level and square
    m |= c.disc(204, 22, 9) & ~c.disc(204, 22, 5)  # tape
    sil(c, m)
    c.set(c.rect(138, 11, 150, 14), P["green"][5])


BANNERS = {"jobs": jobs, "firm": firm, "current": current, "skyline": skyline, "console": console, "menu": menu}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    stamps = {}
    ims = []
    for k, fn in BANNERS.items():
        c = Canvas(W, H)
        fn(c)
        im = c.image()
        im.save(OUT / f"{k}.png", optimize=True)
        stamps[k] = hashlib.sha1(im.tobytes()).hexdigest()[:8]
        ims.append(im)
    lines = ["// Generated by scripts/groundbreak-art/build-ui.py. Do not edit by hand.",
             f"export const GB_BANNER_W = {W};", f"export const GB_BANNER_H = {H};",
             "export const GB_BANNERS = {", *[f'  {k}: "/groundbreak/ui/{k}.png?v={v}",' for k, v in stamps.items()],
             "} as const;", "export type GbBannerId = keyof typeof GB_BANNERS;", ""]
    TS.write_text("\n".join(lines))
    if "--preview" in sys.argv:
        pv = Image.new("RGBA", (W * 2 + 20, len(ims) * (H * 2 + 10) + 10), (20, 16, 24, 255))
        for i, im in enumerate(ims):
            pv.alpha_composite(im.resize((W * 2, H * 2), Image.NEAREST), (10, 10 + i * (H * 2 + 10)))
        pv.save(sys.argv[sys.argv.index("--preview") + 1])
    print(f"{len(ims)} banners")


main()
