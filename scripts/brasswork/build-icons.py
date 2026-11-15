"""Brasswork icon sheet: every item and machine in lib/automation/data/tree.ts at 64 px, one sheet.

  public/brasswork/icons/items.{png,webp}   8 columns, 64 px cells, items in catalog order then machines
  lib/automation/icons/index.ts              generated index (cell per id, content-hash ?v= stamp, iconStyle helper)

Art: scripts/brasswork/bw_items.py (items) and bw_machines.py (machines), drawn with the tiny 3D painter in icon3d.py on
top of the naOS dither kit. Run: python3 scripts/brasswork/build-icons.py [--preview out.png]
Fails if an id in the catalog has no drawing.
"""
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

os.environ["NAOS_KIT_N"] = "128"  # before any kit import: icons are drawn at 128 px, twice the old detail

import numpy as np  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import bw_items  # noqa: E402
import bw_machines  # noqa: E402
import bw_logistics  # noqa: E402
from bw_items import FIT  # noqa: E402
import nodefarm_icon_kit as K  # noqa: E402
from nodefarm_icon_kit import grow, save_pair, to_image  # noqa: E402

COLS, N, SMALL = 8, 128, 64
assert K.N == N
# Dither in 2 x 2 blocks: shapes and edges get the 128 px detail, but the shading still reads as the chunky naOS dither
# at the sizes the HUD shows (48 and 32 px), instead of fading into flat colour.
K.BAYER = np.kron(np.tile(np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 - 0.5,
                          (N // 8, N // 8)), np.ones((2, 2)))
INK = (30, 18, 6)  # warm outline shared by every icon in the set
TARGET = 114  # px the larger side of every drawing spans, so items and machines read at one size
OUT = ROOT / "public/brasswork/icons"
TS = ROOT / "lib/automation/icons/index.ts"


def catalog():
    js = ("import('./lib/automation/data/tree.ts').then(m => console.log(JSON.stringify({"
          "items: m.RECIPE_TREE.items.map(i => [i.id, i.name, i.stage]),"
          "machines: m.RECIPE_TREE.machines.map(i => [i.id, i.name]),"
          "structures: (m.RECIPE_TREE.structures ?? []).map(i => [i.id, i.name])})))")
    out = subprocess.run(["node", "--experimental-strip-types", "--no-warnings", "-e", js], cwd=ROOT, check=True,
                         capture_output=True, text=True).stdout
    return json.loads(out)


def fit128(fn):
    """Draw fn at double scale (the 64 px drawings are vector-ish, so this is real extra detail, not an upscale), then
    refit it so its larger side spans TARGET px, centred a touch low so the ground shadow sits on one line."""
    FIT.update(k=2.0, dx=32.0, dy=32.0)
    a = fn().img[..., 3] > 0
    ys, xs = np.nonzero(a)
    w, h = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
    k = 2.0 * min(TARGET / w, TARGET / h, 1.9)
    bx, by = (xs.max() + xs.min() + 1) / 2, (ys.max() + ys.min() + 1) / 2
    ax, ay = 32 + (bx - 64) / 2, 32 + (by - 64) / 2
    FIT.update(k=k, dx=64 - (32 + (ax - 32) * k), dy=66 - (32 + (ay - 32) * k))
    out = fn()
    FIT.update(k=1.0, dx=0.0, dy=0.0)
    return out.img


def finish(img):
    """Set-wide finish: one warm 2 px outline round the solid shape (soft glows stay soft) and a cream catch-light on
    the top-left edge, so every icon has the same frame and light no matter who drew it."""
    img = img.copy()
    solid = img[..., 3] >= 200
    ring1 = grow(solid, 1) & ~solid
    ring2 = grow(solid, 2) & ~solid & ~ring1
    img[ring1] = (*INK, 255)
    img[ring2 & (img[..., 3] < 60)] = (*INK, 150)
    top = solid & ~np.roll(solid, 1, 0)
    left = solid & ~np.roll(solid, 1, 1)
    lit = (top | left) & (img[..., :3].sum(-1) > 150)
    img[lit, :3] = np.minimum(255, img[lit, :3].astype(int) * 5 // 4 + 18).astype(np.uint8)
    return img


def downsample(sheet):
    """64 px sheet for small HUD sizes: a 2x2 box average, alpha-weighted, so the dither averages into clean tones
    instead of the browser dropping every other pixel."""
    a = sheet[..., 3:4].astype(float) / 255
    rgb = sheet[..., :3].astype(float) * a
    h, w = sheet.shape[0] // 2, sheet.shape[1] // 2
    pool = lambda m: m.reshape(h, 2, w, 2, -1).sum((1, 3))  # noqa: E731
    sa, srgb = pool(a), pool(rgb)
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = np.clip(srgb / np.maximum(sa, 1e-6), 0, 255)
    out[..., 3:4] = np.clip(sa / 4 * 255, 0, 255)
    return out


def main():
    cat = catalog()
    # Structures: one icon per art id; every orrery build stage shares the orrery icon.
    struct_art = {s[0]: ("orrery" if s[0].startswith("orrery") else s[0]) for s in cat["structures"]}
    struct_ids = sorted(set(struct_art.values()), key=list(struct_art.values()).index)
    belts = ["belt", "belt-copper", "belt-steel"]  # belt tiers are sim building types, not catalog structures
    extras = ["clockworks"]  # group icons that are not catalog items (append-only, keeps every other cell)
    ids = [i[0] for i in cat["items"]] + [m[0] for m in cat["machines"]] + struct_ids + belts + extras
    draw = {**bw_items.DRAW, **bw_machines.DRAW, **bw_machines.STRUCT, **bw_logistics.LOG}
    missing = [i for i in ids if i not in draw]
    if missing:
        sys.exit(f"no drawing for: {', '.join(missing)}")
    rows = (len(ids) + COLS - 1) // COLS
    sheet = np.zeros((rows * N, COLS * N, 4), np.uint8)
    for k, i in enumerate(ids):
        r, c = divmod(k, COLS)
        sheet[r * N:(r + 1) * N, c * N:(c + 1) * N] = finish(fit128(draw[i]))
    OUT.mkdir(parents=True, exist_ok=True)
    img = to_image(sheet)
    save_pair(img, OUT / "items")
    save_pair(to_image(downsample(sheet)), OUT / "items-64")
    v = hashlib.sha1((OUT / "items.webp").read_bytes() + (OUT / "items-64.webp").read_bytes()).hexdigest()[:8]
    n_items = len(cat["items"])
    item_map = ",\n".join(f'    {i}: {k}' for k, i in enumerate(ids[:n_items]))
    n_mach = len(cat["machines"])
    mach_map = ",\n".join(f'    {i}: {k + n_items}' for k, i in enumerate(ids[n_items:n_items + n_mach]))
    q = lambda k: k if k.isidentifier() else f'"{k}"'  # noqa: E731
    struct_map = ",\n".join(f'    {q(sid)}: {ids.index(art)}' for sid, art in struct_art.items())
    extra_map = ",\n".join(f'    {q(e)}: {ids.index(e)}' for e in extras)
    belt_map = ",\n".join(f'    {q(b)}: {ids.index(b)}' for b in belts)
    TS.parent.mkdir(parents=True, exist_ok=True)
    TS.write_text(f'''// Generated by scripts/brasswork/build-icons.py. Do not edit; re-run the script after changing the art.
import type {{ CSSProperties }} from "react";

/** One sheet holds every item and machine icon: {N} px art cells, {COLS} across, row by row. */
export const ICON_SHEET = {{
    url: "/brasswork/icons/items.webp?v={v}",
    png: "/brasswork/icons/items.png?v={v}",
    cell: {N},
    cols: {COLS},
    rows: {rows},
}} as const;

/** The same sheet averaged down to {SMALL} px cells, used for icons shown at {SMALL} CSS px or smaller. */
export const ICON_SHEET_SMALL = {{
    url: "/brasswork/icons/items-64.webp?v={v}",
    cell: {SMALL},
}} as const;

/** Sheet cell of each item, keyed by the item ids in lib/automation/data/tree.ts. */
export const ITEM_ICONS = {{
{item_map},
}} as const;

/** Sheet cell of each machine (build palette), keyed by the machine ids in lib/automation/data/tree.ts. */
export const MACHINE_ICONS = {{
{mach_map},
}} as const;

/** Sheet cell of each structure (hub, orrery build stages share one orrery icon), keyed by structure id. */
export const STRUCTURE_ICONS = {{
{struct_map},
}} as const;

/** Sheet cell of each belt tier (sim building types belt, belt-copper, belt-steel). */
export const BELT_ICONS = {{
{belt_map},
}} as const;

/** Group icons that are not catalog items, such as the Clockworks stage on the resource strip. */
export const GROUP_ICONS = {{
{extra_map},
}} as const;

export type ItemIconId = keyof typeof ITEM_ICONS;
export type MachineIconId = keyof typeof MACHINE_ICONS;
export type StructureIconId = keyof typeof STRUCTURE_ICONS;
export type BeltIconId = keyof typeof BELT_ICONS;
export type GroupIconId = keyof typeof GROUP_ICONS;
export type IconId = ItemIconId | MachineIconId | StructureIconId | BeltIconId | GroupIconId;

const CELLS: Record<string, number> = {{ ...ITEM_ICONS, ...MACHINE_ICONS, ...STRUCTURE_ICONS, ...BELT_ICONS, ...GROUP_ICONS }};

/** Sheet cell for an item or machine id, or undefined if the id has no icon. */
export function iconCell(id: string): number | undefined {{
    return CELLS[id];
}}

/** Sheet url that suits an icon shown at `px` CSS pixels: the {N} px art for large icons, the {SMALL} px average below. */
export function iconSheetUrl(px: number): string {{
    return px > ICON_SHEET_SMALL.cell ? ICON_SHEET.url : ICON_SHEET_SMALL.url;
}}

/**
 * Inline style that shows one icon as a background at `px` CSS pixels (48 for cards, 32 for HUD rows and tooltips,
 * 24 minimum). Large icons scale the {N} px art with pixelated sampling so the dither stays crisp; small ones use the
 * pre-averaged {SMALL} px sheet with smooth sampling, so shrinking never drops pixels.
 */
export function iconStyle(id: string, px = 48): CSSProperties {{
    const k = CELLS[id] ?? 0;
    const col = k % ICON_SHEET.cols;
    const row = Math.floor(k / ICON_SHEET.cols);
    return {{
        width: px,
        height: px,
        backgroundImage: `url(${{iconSheetUrl(px)}})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${{ICON_SHEET.cols * px}}px ${{ICON_SHEET.rows * px}}px`,
        backgroundPosition: `${{-col * px}}px ${{-row * px}}px`,
        imageRendering: px > ICON_SHEET_SMALL.cell || px === ICON_SHEET_SMALL.cell ? "pixelated" : "auto",
    }};
}}
''')
    print(f"items: {img.size}, webp {(OUT / 'items.webp').stat().st_size / 1024:.1f} KB, {len(ids)} icons, v={v}")
    if "--preview" in sys.argv:
        preview(sheet, ids, {**{i[0]: i[1] for i in cat["items"] + [m[:2] for m in cat["machines"]] + [st[:2] for st in cat["structures"]]},
                 "orrery": "Sky orrery", "belt": "Brass belt", "belt-copper": "Copper belt", "belt-steel": "Steel belt", "clockworks": "Clockworks"},
                {i[0]: i[2] for i in cat["items"]}, sys.argv[sys.argv.index("--preview") + 1])


def preview(sheet, ids, names, stages, path):
    """Labelled contact sheet for review: each icon at 2x (128 px) with its name, grouped by stage, plus a strip of
    every icon at real HUD sizes 48 and 32."""
    S, PAD, LAB = 1, 18, 18
    bg, ink, dim, brass = (40, 30, 21), (240, 223, 184), (150, 128, 96), (210, 154, 60)
    f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 13)
    fb = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 15)
    groups = [("Raw", 0), ("Smelting", 1), ("Forming", 2), ("Components", 3), ("Clockworks", 4), ("Megaproject", 5)]
    rowsets = [(t, [i for i in ids if stages.get(i) == s]) for t, s in groups] + \
        [("Machines and structures", [i for i in ids if i not in stages])]
    cw, ch = N * S + PAD, N * S + LAB + PAD
    cols = 9
    H = 40 + sum(30 + ((len(r) + cols - 1) // cols) * ch for _, r in rowsets) + 200
    W = PAD + cols * cw
    out = Image.new("RGBA", (W, H), bg + (255,))
    d = ImageDraw.Draw(out)
    cells = {i: to_image(sheet[(k // COLS) * N:(k // COLS + 1) * N, (k % COLS) * N:(k % COLS + 1) * N])
             for k, i in enumerate(ids)}
    d.text((PAD, 12), "BRASSWORK  item and machine icons  (128 px art)", font=fb, fill=brass)
    y = 40
    for title, row in rowsets:
        d.text((PAD, y + 6), title.upper(), font=fb, fill=dim)
        d.line((PAD + 130, y + 15, W - PAD, y + 15), fill=(70, 54, 38), width=1)
        y += 30
        for k, i in enumerate(row):
            x0 = PAD + (k % cols) * cw
            y0 = y + (k // cols) * ch
            d.rectangle((x0 - 4, y0 - 4, x0 + N * S + 3, y0 + N * S + 3), fill=(52, 40, 28))
            out.alpha_composite(cells[i].resize((N * S, N * S), Image.NEAREST), (x0, y0))
            d.text((x0, y0 + N * S + 4), names[i], font=f, fill=ink)
        y += ((len(row) + cols - 1) // cols) * ch
    d.text((PAD, y + 4), "AT REAL SIZE: 48 px (cards) and 32 px (HUD rows)", font=fb, fill=dim)
    y += 30
    x = PAD
    for i in ids:
        ic = cells[i].resize((48, 48), Image.NEAREST)
        if x + 52 > W:
            break
        out.alpha_composite(ic, (x, y))
        out.alpha_composite(cells[i].resize((32, 32), Image.BOX), (x + 8, y + 56))
        x += 52
    x = PAD
    y += 100
    out = out.crop((0, 0, W, y + 10))
    out.convert("RGB").save(path)
    print("preview:", path)


if __name__ == "__main__":
    main()
