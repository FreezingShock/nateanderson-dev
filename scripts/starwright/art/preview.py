"""Contact sheets for review: python3 preview.py OUTDIR. Shows each sheet's frames enlarged on the space colour."""
import json, os, sys
from PIL import Image, ImageDraw
from common import OUT, P, hexc

out_dir = sys.argv[1]
os.makedirs(out_dir, exist_ok=True)
man = json.load(open(os.path.join(OUT, "manifest.json")))["sheets"]
GROUPS = {"stars": ["star/"], "planets": ["planet/"], "scenery": ["visitor/", "card/", "bg/"], "ui": ["icon/", "panel/"]}


def contact(name, prefixes, scale, maxframes, width=1440):
    keys = [k for k in sorted(man) if any(k.startswith(p) for p in prefixes)]
    rows = []
    for k in keys:
        m = man[k]
        sheet = Image.open(os.path.join(OUT, k + ".png"))
        sc = scale if m["w"] <= 64 else (2 if m["w"] <= 192 else 1)
        if k.startswith("icon/") or k.startswith("panel/"):
            sc = 4
        n = min(m["frames"], maxframes)
        step = max(1, m["frames"] // n)
        tiles = [sheet.crop((i * m["w"], 0, (i + 1) * m["w"], m["h"])).resize((m["w"] * sc, m["h"] * sc), Image.NEAREST) for i in range(0, m["frames"], step)][:n]
        rows.append((k, tiles))
    # flow layout
    bg = hexc(P["void"])
    y, x, rowh, placed = 10, 10, 0, []
    for k, tiles in rows:
        wtot = sum(t.width + 4 for t in tiles)
        if x + wtot > width - 10:
            x, y, rowh = 10, y + rowh + 24, 0
        placed.append((x, y, k, tiles))
        x += wtot + 18
        rowh = max(rowh, max(t.height for t in tiles))
    img = Image.new("RGB", (width, y + rowh + 30), bg)
    dr = ImageDraw.Draw(img)
    for x, y, k, tiles in placed:
        dr.text((x, y), k, fill=hexc(P["stone"]))
        xx = x
        for t in tiles:
            img.paste(t, (xx, y + 12), t)
            xx += t.width + 4
    img.save(os.path.join(out_dir, f"sheet-{name}.png"))


contact("stars", ["star/proto", "star/dwarf", "star/giant", "star/blue", "star/super", "star/iron"], 2, 8)
contact("transitions", ["star/trans", "star/implode"], 2, 14)
contact("collapse", ["star/nova", "star/hole"], 1, 8, width=2700)
contact("planets", ["planet/"], 3, 4)
contact("scenery", ["visitor/", "card/"], 3, 6)
contact("backdrops", ["bg/"], 2, 1, width=2700)
contact("ui", ["icon/", "panel/"], 4, 1)
