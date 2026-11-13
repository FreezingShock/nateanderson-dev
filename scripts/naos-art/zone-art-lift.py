"""Lift the dim staged zone sheets so they read as a lit room, like the lab and sched zones.

The 2026-11-12 art audit (item 3) found silicon, quartz, runes, voidsteel, reboot and copper dark, with small sprites on a faint
backdrop: their backdrops follow the old contract rule "shades 0-1 at alpha <= 90", so on the dark board they nearly vanish.
Nate's standing pick is "busier, more colour". This pass, run on a finished sheet, keeps every sprite pixel as drawn and:

  1. turns each faint backdrop pixel (0 < alpha < 255) opaque at shade 1 of its own ramp (shade-1 pixels get a light
     scatter of shade 2), so the structures behind the sprites (fab windows, crystal spires, rune rows, reboot grid,
     voidsteel girders) read clearly without outshining the sprites;
  2. fills the empty pixels behind them with a room: the zone's darkest shade, dithered up a step toward the floor, with
     panel seams every 24 px, and dithered away over the top 14 rows so it meets the title bar softly;
  3. adds a lit floor: a bright edge on the row the sprites stand on and a dithered spill under it.

Same palette (RAMPS from nodefarm-icons.py), 4x4 Bayer, opaque or empty pixels only. Idempotent: a lifted sheet has no
faint or empty room pixels left, so running it twice changes nothing.

Order after regenerating a zone sheet: its own script, then this (if the zone is listed in ZONES), then
zone-art-skirt.py, then node scripts/nodefarm/stamp-art.mjs.

Run:  python3 scripts/naos-art/zone-art-lift.py              (every zone in ZONES)
      python3 scripts/naos-art/zone-art-lift.py quartz       (just those)
"""
import importlib.util
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ART = HERE.parents[1] / "public/naos/nodefarm"
_spec = importlib.util.spec_from_file_location("nodefarm_icons", HERE / "nodefarm-icons.py")
_icons = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_icons)
RAMPS = {k: np.array(v, int) for k, v in _icons.RAMPS.items()}
CW, CH, COLS, ROWS = 288, 96, 6, 8
B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0

# zone -> (room ramp, floor ramp, floor row in the cell: where the sprites stand)
ZONES = {
    "reboot": ("mag", "mag", 94),
    "silicon": ("si", "si", 94),
    "quartz": ("qz", "qz", 94),
    "runes": ("rn", "rn", 94),
    "voidsteel": ("vs", "vs", 94),
    "copper": ("cu", "cu", 94),
}
ALL = np.concatenate([v for v in RAMPS.values()])          # every palette colour, for "one step up"
IDX = [(k, i) for k, v in RAMPS.items() for i in range(len(v))]


def step_up(rgb: np.ndarray, th: np.ndarray) -> np.ndarray:
    """Shade 0 becomes shade 1; shade 1 becomes shade 1 with a light Bayer scatter of shade 2, so the structures read
    clearly against the room without outshining the sprites."""
    d = np.abs(ALL[None, :, :] - rgb[:, None, :]).sum(2)
    out = rgb.copy()
    for n, j in enumerate(d.argmin(1)):
        k, i = IDX[j]
        out[n] = RAMPS[k][2] if (i >= 1 and th[n] < 0.3) else RAMPS[k][1]
    return out


def floor_row(cell_alpha: np.ndarray, default: int) -> int:
    """The lowest row that holds sprite pixels at stage 7 (so the floor sits under what the zone actually draws)."""
    rows = np.nonzero((cell_alpha == 255).sum(1) > CW * 0.25)[0]
    return int(rows.max()) if len(rows) else default


def lift(path: Path, room: str, flo: str, default_floor: int) -> bool:
    a = np.asarray(Image.open(path).convert("RGBA")).copy()
    faint = (a[..., 3] > 0) & (a[..., 3] < 255)
    empty = a[..., 3] == 0
    if not faint.any() and not empty.any():
        return False
    # 1. faint backdrop -> opaque, one shade up
    H0, W0 = a.shape[:2]
    th0 = np.tile(B4, (H0 // 4 + 1, W0 // 4 + 1))[:H0, :W0]
    if faint.any():
        a[faint, :3] = step_up(a[faint, :3].astype(int), th0[faint])
        a[faint, 3] = 255
    # 2 + 3. the room and the floor, per cell (same for every cell so the stage rows still differ only by sprites)
    H, W = a.shape[:2]
    y, x = np.mgrid[0:H, 0:W]
    cy, cx = y % CH, x % CW
    fl = floor_row(a[CH * 7:CH * 8, :CW, 3], default_floor)
    th = np.tile(B4, (H // 4 + 1, W // 4 + 1))[:H, :W]
    rr, fr = RAMPS[room], RAMPS[flo]
    # wall: shade 0, dithering up to shade 1 over the lower half, seams every 24 px
    up = np.clip((cy - CH * 0.55) / (fl - CH * 0.55), 0, 1) * 0.3
    wall = np.where((up > th)[..., None], rr[1], rr[0])
    seam = (cx % 24 == 0) & (cy < fl)
    wall[seam] = rr[1]
    # top 14 rows dissolve so the room meets the title bar softly
    top_keep = np.clip((cy + 0.5) / 14, 0, 1) > th
    # floor: bright edge, dithered spill below
    edge = cy == fl + 1
    below = cy > fl + 1
    spill = below & ((1 - (cy - fl - 2) / 3) * 0.7 > th)
    fill = empty & top_keep
    a[fill, :3] = wall[fill]
    a[fill, 3] = 255
    m = empty & edge
    a[m, :3] = fr[2]
    a[m, 3] = 255
    m = empty & spill
    a[m, :3] = fr[1]
    a[m, 3] = 255
    Image.fromarray(a.astype(np.uint8), "RGBA").save(path, optimize=True)
    Image.fromarray(a.astype(np.uint8), "RGBA").save(path.with_suffix(".webp"), lossless=True, quality=100, method=6)
    return True


if __name__ == "__main__":
    want = sys.argv[1:] or list(ZONES)
    for z in want:
        room, flo, fl = ZONES[z]
        p = ART / f"zone-{z}.png"
        print(f"{z}: {'lifted' if lift(p, room, flo, fl) else 'already lifted'}, {p.with_suffix('.webp').stat().st_size / 1000:.1f} KB")
