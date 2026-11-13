"""Contact sheet of the Brasswork belt models (lib/automation/models/items/), each sitting on a strip of belt, drawn
with the same camera as the icons. For review only; the game renders the models in Three.js.

Run: python3 scripts/brasswork/preview-models.py out.png
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
from icon3d import Scene, view  # noqa: E402
from nodefarm_icon_kit import Canvas, to_image  # noqa: E402

JS = ('import("./lib/automation/models/items/index.ts").then(m => { const o = {}; '
      'for (const [k, v] of Object.entries(m.ITEM_MODELS)) { const p = v.parts[0]; '
      'o[k] = { pal: v.palette, pos: [...p.pos], col: [...p.colors], tag: [...p.tags] }; } '
      'console.log(JSON.stringify(o)); })')


def ramp_of(hexv, jit=1.0):
    r, g, b = (hexv >> 16) & 255, (hexv >> 8) & 255, hexv & 255
    out = []
    for f in (0.42, 0.62, 0.82, 1.0, 1.14):
        f *= jit
        out.append(tuple(int(min(255, ch * f + (f - 1) * 40 * (f > 1))) for ch in (r, g, b)))
    return out


def draw(m, s=5.0, belt=True):
    c = Canvas()
    sc = Scene(cx=32, cy=40, s=s)
    if belt:
        sc.box(-5, 5, -1.6, -1, -3.6, 3.6, ramp_of(0x5E5348), 0.0)
        sc.box(-5, 5, -1, 0, -3, 3, ramp_of(0x3A2A1A), 0.0)
    pos = np.array(m["pos"]).reshape(-1, 3)
    rng = np.random.default_rng(1)
    order = sorted(range(len(pos)), key=lambda i: view(pos[i] + 0.5)[2])
    for i in order:
        x, y, z = pos[i]
        col = m["pal"][m["col"][i]]
        glow = m["tag"][i] == 1
        pal = ramp_of(col, 1.0 + rng.uniform(-0.07, 0.07))
        if glow:
            pal = [ramp_of(col)[3]] * 5
        sc.box(x - 0.5, x + 0.5, y, y + 1, z - 0.5, z + 0.5, pal, 0.0)
    sc.paint(c, dither=0.6)
    return c.finish((8, 9, 11))


def main(out):
    data = json.loads(subprocess.run(["node", "--experimental-strip-types", "--no-warnings", "-e", JS], cwd=ROOT,
                                     check=True, capture_output=True, text=True).stdout)
    names = list(data)
    cols, S, PAD, LAB = 7, 3, 14, 18
    cw, ch = 64 * S + PAD, 64 * S + LAB + PAD
    rows = (len(names) + cols - 1) // cols
    W, H = PAD + cols * cw, 44 + rows * ch
    img = Image.new("RGBA", (W, H), (40, 30, 21, 255))
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 13)
    fb = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 15)
    d.text((PAD, 12), "BRASSWORK  belt models  (0.1 voxels, on a strip of belt, no scene dither)", font=fb,
           fill=(210, 154, 60))
    for k, n in enumerate(names):
        x0, y0 = PAD + (k % cols) * cw, 44 + (k // cols) * ch
        d.rectangle((x0 - 4, y0 - 4, x0 + 64 * S + 3, y0 + 64 * S + 3), fill=(52, 40, 28))
        img.alpha_composite(to_image(draw(data[n]).img).resize((64 * S, 64 * S), Image.NEAREST), (x0, y0))
        nv = sum(1 for _ in data[n]["col"])
        d.text((x0, y0 + 64 * S + 3), f"{n}  ({nv})", font=f, fill=(240, 223, 184))
    img.convert("RGB").save(out)
    print(out)


if __name__ == "__main__":
    main(sys.argv[1])
