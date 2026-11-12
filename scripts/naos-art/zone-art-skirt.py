"""Left skirts for the staged zone art: the scene keeps going past the cell's left edge and fizzles out in dither.

Nate (2026-11-12): the zone panel art "cuts off too abruptly on the left side, so the art itself should extend further and
fizzle out". Each zone sheet (zone-<id>.png, 288 x 96 cells) gets a static companion, zone-<id>-skirt.{png,webp}: SKW x 96
art px, drawn directly left of the cell at the same scale and on the same floor (app/camino/nodefarm-zone-art.css).

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
HAND: set[str] = set()
B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def skirt(sheet: Image.Image) -> Image.Image:
    a = np.asarray(sheet.convert("RGBA"))[:CH, :SKW].copy()
    s = a[:, ::-1]                                   # mirror: column SKW-1 of the skirt = column 0 of the cell
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
