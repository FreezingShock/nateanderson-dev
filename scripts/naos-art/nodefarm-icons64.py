"""Node Farm 64 px button sprites: one sheet per stat, every button tier, eight animation frames.

  public/naos/nodefarm/tic-<stat>.{png,webp}   6 tiers across x 8 frames down, 64 x 64 cells (384 x 512)

Each stat's art lives in its own module, nodefarm_tiers64_<stat>.py, exposing draw(t, p) -> Canvas for tier t (0..5) at phase
p in [0, 1). Sprites draw the tier's name (Copper: Wire, Trace, Coil, Busbar, Spool, Foundry) and grow in size, parts and
motion up the tiers. components/nodefarm/icon.tsx lists the stats that have a sheet (TIC64); scripts/nodefarm/stamp-art.mjs
checks that every listed stat has a sheet of the right size.

Run: python3 scripts/naos-art/nodefarm-icons64.py [stat ...]   (no args = every stat with a module), then
     node scripts/nodefarm/stamp-art.mjs
Writes a contact sheet and an animated preview to /tmp/nf64-<stat>.{png,gif} for eyeballing (not shipped).
"""
import importlib
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import nodefarm_icon_kit as K  # noqa: E402

OUT = HERE.parents[1] / "public/naos/nodefarm"
TIERS = 6


def stats_with_art():
    return sorted(p.stem.replace("nodefarm_tiers64_", "") for p in HERE.glob("nodefarm_tiers64_*.py"))


def build(stat):
    mod = importlib.import_module(f"nodefarm_tiers64_{stat}")
    N, F = K.N, K.FRAMES
    sheet = np.zeros((N * F, N * TIERS, 4), np.uint8)
    for f in range(F):
        for t in range(TIERS):
            sheet[f * N:(f + 1) * N, t * N:(t + 1) * N] = mod.draw(t, f / F).img
    img = K.to_image(sheet)
    K.save_pair(img, OUT / f"tic-{stat}")
    K.contact(img, 3).save(f"/tmp/nf64-{stat}.png")
    frames = [K.contact(K.to_image(sheet[f * N:(f + 1) * N]), 3, (24, 24, 24, 255)).convert("RGB") for f in range(F)]
    frames[0].save(f"/tmp/nf64-{stat}.gif", save_all=True, append_images=frames[1:], duration=125, loop=0)
    size = (OUT / f"tic-{stat}.webp").stat().st_size
    print(f"tic-{stat}: {img.size}, webp {size / 1024:.1f} KB")


# Zone/stat icon sheet: same order as ORDER in components/nodefarm/icon.tsx, eight frames down.
ICON_ORDER = ["bytes", "mult", "reboot", "copper", "silicon", "quartz", "aether", "ascend", "alert", "lock", "spark", "runes",
              "starglass", "voidsteel", "chrono", "engrams", "paradox", "origin", "nebula", "pulsars", "singularity"]


def icon_fn(name):
    """A module's icon(p), or None while that icon still uses the 32 px art (upscaled 2x so the sheet is complete)."""
    for mod in (f"nodefarm_tiers64_{name}", "nodefarm_icons64_misc"):
        try:
            m = importlib.import_module(mod)
        except ModuleNotFoundError:
            continue
        fn = getattr(m, "icon", None) if mod.endswith(name) else getattr(m, f"icon_{name}", None)
        if fn:
            return fn
    return None


def build_icons():
    from PIL import Image
    N, F = K.N, K.FRAMES
    old = np.asarray(Image.open(OUT / "icons-anim.png").convert("RGBA"))
    sheet = np.zeros((N * F, N * len(ICON_ORDER), 4), np.uint8)
    for i, name in enumerate(ICON_ORDER):
        fn = icon_fn(name)
        for f in range(F):
            if fn:
                cell = fn(f / F).img
            else:
                o = old[(f // 2) * 32:(f // 2 + 1) * 32, i * 32:(i + 1) * 32]
                cell = o.repeat(2, 0).repeat(2, 1)
            sheet[f * N:(f + 1) * N, i * N:(i + 1) * N] = cell
    img = K.to_image(sheet)
    K.save_pair(img, OUT / "icons64")
    K.contact(img, 2).save("/tmp/nf64-icons.png")
    print(f"icons64: {img.size}, webp {(OUT / 'icons64.webp').stat().st_size / 1024:.1f} KB,",
          "drawn:", [n for n in ICON_ORDER if icon_fn(n)])


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or "icons" in args:
        build_icons()
    for s in [a for a in args if a != "icons"] or ([] if args else stats_with_art()):
        build(s)
