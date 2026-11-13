"""Left skirts for the staged zone art: the scene keeps going past the cell's left edge and fizzles out in dither.

Nate (2026-11-12): the zone panel art "cuts off too abruptly on the left side, so the art itself should extend further and
fizzle out". Each zone sheet (zone-<id>.png, 288 x 96 cells) gets a static companion, zone-<id>-skirt.{png,webp}: SKW x 96
art px, drawn directly left of the cell at the same scale and on the same floor (app/camino/nodefarm/zone-art.css).

How a skirt is made: the stage-0, frame-0 cell's left SKW columns are mirrored, so the join is seamless, then dissolved with
the 4x4 Bayer threshold plus a little ragged noise: every pixel is either kept as it is or dropped (no alpha fade, no new
colours), fully kept at the join, gone by the left edge. Lower rows hold on a little longer than the sky, so the ground
trails off last. The mirrored strip is also stepped one shade darker in its outer half when that shade exists in the ramp.

A zone script may draw its own skirt instead (same size, same rule: opaque pixels only, nothing in the last 8 columns on the
left). List it in HAND so this script leaves it alone.

Run:  python3 scripts/naos-art/zone-art-skirt.py            (every zone sheet)
      python3 scripts/naos-art/zone-art-skirt.py bytes mult (just those)
Then node scripts/nodefarm/stamp-art.mjs.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "public/naos/nodefarm"
CW, CH = 288, 96   # cell
SKW = 128          # skirt width in art px
# skirts drawn by their zone script from the world left of the cell (zone-art-12-17.py)
HAND: set[str] = {"nebula", "pulsars", "singularity", "engrams", "paradox", "origin"}
B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def backdrop(sheet: Image.Image) -> np.ndarray:
    """The cell's left SKW columns with only the backdrop: pixels that stage 0 and stage 7 agree on. Anything that changes
    between them is a sprite or a stage-0 ghost of one, so it is cut out and the hole filled from the backdrop beside it
    (nearest kept pixel in the same row, looking further from the join, so the fill comes from the side that will fade)."""
    full = np.asarray(sheet.convert("RGBA"))
    a = full[:CH, :SKW].copy()
    z = full[CH * 7:CH * 8, :SKW]
    hole = np.any(a != z, axis=2)
    for y in range(CH):
        xs = np.nonzero(~hole[y])[0]
        if not len(xs):
            a[y] = 0
            continue
        for x in np.nonzero(hole[y])[0]:
            right = xs[xs > x]          # mirrored, columns right of x in the cell sit further from the join
            src = right[0] if len(right) else xs[xs < x][-1]
            a[y, x] = a[y, src]
    return a


def skirt(sheet: Image.Image) -> Image.Image:
    a = backdrop(sheet)
    return dissolve(a[:, ::-1], a)                   # mirror: column SKW-1 of the skirt = column 0 of the cell


def dissolve(s: np.ndarray, a: np.ndarray | None = None) -> Image.Image:
    """Fizzle out an SKW x 96 RGBA strip that joins the cell on its right edge. `a` is where the darker shades are looked
    up (default: the strip itself). Zone scripts that draw the real world left of the cell call this directly."""
    a = s if a is None else a
    h, w = s.shape[:2]
    y, x = np.mgrid[0:h, 0:w].astype(float)
    d = 1 - (x + 0.5) / w                            # 0 at the join, 1 at the far left
    d = d - 0.12 * (y / h) ** 2                      # the ground trails off last
    rng = np.random.default_rng(7)
    rag = rng.random((h // 4 + 1, w // 4 + 1)).repeat(4, 0).repeat(4, 1)[:h, :w]   # ragged 4 px blocks
    keep_p = np.clip(1.08 - d * 1.25 + (rag - 0.5) * 0.22, 0, 1)
    th = np.tile(B4, (h // 4 + 1, w // 4 + 1))[:h, :w]
    keep = keep_p > th + 1 / 32
    keep[:, :8] = False
    out = s.copy()
    out[~keep] = 0
    # recede: the outer half drops one shade darker, using a darker colour of the same hue that the cell already uses
    pal = {tuple(c) for c in a[..., :3][a[..., 3] > 0].reshape(-1, 3)}
    if pal:
        cols = np.array(sorted(pal), float)
        lum = cols @ [0.3, 0.59, 0.11]
        outer = keep & (d > 0.5) & (out[..., 3] > 0)
        for yy, xx in zip(*np.nonzero(outer)):
            c = out[yy, xx, :3].astype(float)
            l0 = c @ [0.3, 0.59, 0.11]
            cos = (cols @ c) / (np.linalg.norm(cols, axis=1) * np.linalg.norm(c) + 1e-6)
            cand = np.nonzero((lum < l0 - 4) & (lum > l0 * 0.45) & (cos > 0.985))[0]
            if len(cand):
                dist = np.abs(cols[cand] - c * 0.7).sum(1)
                out[yy, xx, :3] = cols[cand[dist.argmin()]]
    return Image.fromarray(out, "RGBA")


def main(ids):
    sheets = sorted(ART.glob("zone-*.png"))
    for p in sheets:
        zid = p.stem[5:]
        if zid.endswith("-skirt") or (ids and zid not in ids) or zid in HAND:
            continue
        im = Image.open(p)
        if im.size != (CW * 6, CH * 8):
            print(f"skip {zid}: sheet is {im.size}")
            continue
        sk = skirt(im)
        sk.save(ART / f"zone-{zid}-skirt.png", optimize=True)
        sk.save(ART / f"zone-{zid}-skirt.webp", lossless=True, quality=100, method=6)
        print(f"{zid}: skirt {(ART / f'zone-{zid}-skirt.webp').stat().st_size / 1000:.1f} KB")


if __name__ == "__main__":
    main(set(sys.argv[1:]))
