"""Node Farm animated sprites: four-frame loops for every icon, every button tier and every Drone.

Takes the static art from nodefarm-icons.py and nodefarm-tier-icons.py and adds small per-stat motion (a glint sweeping across a
crystal, a flicker through carved runes, a pulse in the Voidsteel, a bob on Aether). Higher button tiers get more motion than
lower ones, so the sixth button of a stat is visibly the lively one. The six Drones are drawn here (hovering body, spinning rotors,
blinking lens, a thruster flame) and grow parts per tier.

Writes public/naos/nodefarm/{icons-anim,tiers-anim,drones}.{png,webp}. Layout (CSS steps the frames down the sheet):
  icons-anim   15 icons across, 4 frames down        (480 x 128)
  tiers-anim   6 tiers across, 10 stats x 4 frames   (192 x 1280, frame f of row r is at y = f * 320 + r * 32)
  drones       6 tiers across, 4 frames down         (192 x 128)
Run: python3 scripts/naos-art/nodefarm-sprites.py
"""
import importlib.util
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent


def load(name):
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), HERE / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


nfi = load("nodefarm-icons")
nft = load("nodefarm-tier-icons")
N, RAMPS, Canvas = nfi.N, nfi.RAMPS, nfi.Canvas
rect, disc, yy, xx = nfi.rect, nfi.disc, nfi.yy, nfi.xx
FRAMES = 4


# ------------------------------------------------------------------ effects: (rgba image, frame) -> rgba image
def lighten(img, mask, amt):
    out = img.astype(float)
    out[mask, :3] = out[mask, :3] + (255 - out[mask, :3]) * amt
    return out.astype(np.uint8)


def pulse(img, f, amt=0.22):
    k = [0.0, 0.5, 1.0, 0.5][f] * amt
    return lighten(img, img[..., 3] > 0, k)


def glint(img, f, width=3):
    """A diagonal highlight band sweeping top-left to bottom-right; it rests on frame 3."""
    pos = [-4, 8, 22, 46][f]
    band = np.abs((xx + yy) - pos) <= width / 2
    return lighten(img, band & (img[..., 3] > 0), 0.55)


def bob(img, f):
    dy = [0, -1, 0, 1][f]
    out = np.zeros_like(img)
    if dy < 0:
        out[:dy] = img[-dy:]
    elif dy > 0:
        out[dy:] = img[:-dy]
    else:
        out = img.copy()
    return out


def flicker(img, f):
    """A few scattered pixels brighten, a few dim, shifting each frame, like a terminal or a carved rune catching light."""
    live = img[..., 3] > 0
    h = (xx * 7 + yy * 13 + f * 5).astype(int) % 11
    out = lighten(img, live & (h == 0), 0.6)
    dim = live & (h == 5)
    out = out.astype(float)
    out[dim, :3] *= 0.7
    return out.astype(np.uint8)


def sparkle(img, f, seed):
    """One four-point white glint that blinks on and moves between frames, placed on opaque pixels."""
    rng = np.random.default_rng(seed)
    live = np.argwhere(img[..., 3] > 0)
    out = img.copy()
    if len(live) == 0:
        return out
    # one fixed spot per frame (frames 0 and 2 are rest frames with a dim star, 1 and 3 a bright one)
    spots = live[rng.integers(0, len(live), FRAMES)]
    y, x = spots[f]
    arm = 2 if f in (1, 3) else 1
    for d in range(-arm, arm + 1):
        for (px, py) in ((x + d, y), (x, y + d)):
            if 0 <= px < N and 0 <= py < N:
                out[py, px] = (255, 255, 255, 255)
    return out


def blink(img, f):
    out = img.copy()
    if f in (1, 3):
        out[..., :3] = (out[..., :3] * 0.45).astype(np.uint8)
    return out


# effect recipes per stat; `lvl` (0 to 5) scales how much a button tier does
def animate(name, base, lvl, seed):
    kinds = {
        "bytes": ["glint"], "mult": ["pulse"], "reboot": ["pulse", "spark"], "copper": ["glint"], "silicon": ["flicker"],
        "quartz": ["glint", "spark"], "aether": ["bob", "pulse"], "ascend": ["bob", "pulse"], "alert": ["blink"], "lock": [],
        "spark": ["spark"], "runes": ["flicker"], "starglass": ["glint", "spark"], "voidsteel": ["pulse", "bob"],
        "chrono": ["pulse", "flicker"],
    }[name]
    frames = []
    for f in range(FRAMES):
        im = base
        for k in kinds:
            if k == "pulse":
                im = pulse(im, f, 0.12 + 0.05 * lvl)
            elif k == "glint" and lvl >= 1:
                im = glint(im, f)
            elif k == "flicker" and lvl >= 1:
                im = flicker(im, f)
            elif k == "spark" and lvl >= 3:
                im = sparkle(im, f, seed)
            elif k == "bob" and lvl >= 2:
                im = bob(im, f)
            elif k == "blink":
                im = blink(im, f)
        frames.append(im)
    return frames


# ------------------------------------------------------------------ drones
DRONE_RAMPS = ["cyan", "lime", "cu", "si", "qz", "rn"]


def drone(t, f):
    """Drone for button tier t (0 to 5), animation frame f. Hovering hull, spinning rotor bars, a lens that blinks, a thruster flame."""
    c = Canvas()
    ramp = DRONE_RAMPS[t]
    dy = [0, -1, 0, 1][f]
    cx, cy = 16, 16 + dy
    # rotor bars: the bar length cycles so it reads as a blur of spinning blades
    blade = [11, 6, 2, 6][f]
    arms = [(8, 2), (8, 2), (9, 2), (9, 3), (10, 3), (11, 3)][t]  # (arm reach, arm count: 2 = left+right)
    reach = arms[0]
    spots = [(-reach, -4), (reach, -4)]
    if t >= 4:
        spots += [(-reach + 1, 5), (reach - 1, 5)]
    for (ox, oy) in spots:
        c.fill(rect(cx + ox - 1, cy + oy + 1, cx + ox + 1, cy + oy + 5), 0.45, ramp, outline=False)  # strut
        bx0 = cx + ox - blade / 2
        c.fill(rect(bx0, cy + oy, bx0 + blade, cy + oy + 1.6), 0.95, "wh", outline=False)
        c.set(rect(cx + ox - 0.5, cy + oy - 1, cx + ox + 1.5, cy + oy + 2.6), RAMPS[ramp][2])
    # hull
    hull = disc(cx, cy + 2, 6.5 + (1 if t >= 3 else 0), 5)
    c.fill(hull, 0.35 + 0.5 * nfi.lin(cx - 6, cy - 3, cx + 6, cy + 8), ramp)
    c.set(rect(cx - 6, cy + 2, cx + 6, cy + 3), RAMPS[ramp][1])  # seam
    # lens (blinks closed on frames 1 and 3 at low tiers; stays lit and pulses at high tiers)
    lens_open = t >= 3 or f in (0, 2)
    if lens_open:
        c.set(disc(cx, cy + 1.5, 2.6), RAMPS["wh"][0])
        c.set(disc(cx, cy + 1.5, 1.6), RAMPS["wh"][4] if f in (0, 2) else RAMPS[ramp][3])
    else:
        c.set(rect(cx - 2, cy + 1, cx + 2, cy + 2), RAMPS["wh"][3])
    # tier parts
    if t >= 1:  # antenna with a blinking tip
        c.set(rect(cx, cy - 7, cx + 1, cy - 3), RAMPS["wh"][2])
        c.set(rect(cx - 1, cy - 9, cx + 1, cy - 7), RAMPS[ramp][4] if f in (1, 3) else RAMPS[ramp][2])
    if t >= 2:  # thruster flame under the hull, flickering in length
        ln = [3, 5, 4, 6][f]
        c.set(rect(cx - 2, cy + 8, cx + 2, cy + 8 + ln), RAMPS["red"][3])
        c.set(rect(cx - 1, cy + 8, cx + 1, cy + 7 + ln), RAMPS["red"][4])
    if t >= 3:  # side cargo pods
        c.fill(rect(cx - 10, cy + 3, cx - 7, cy + 8), 0.5, ramp, outline=False)
        c.fill(rect(cx + 7, cy + 3, cx + 10, cy + 8), 0.5, ramp, outline=False)
    if t >= 5:  # halo that shimmers
        r = np.hypot(xx + .5 - cx, yy + .5 - (cy - 9))
        halo = (r <= 5) & (r >= 4) & (((xx + f * 2) % 4) < 3)
        c.set(halo & (c.img[..., 3] == 0), RAMPS[ramp][4])
    return c


def main():
    out = HERE.parents[1] / "public/naos/nodefarm"
    out.mkdir(parents=True, exist_ok=True)

    # --- icons: 15 across, 4 frames down
    sheet = np.zeros((N * FRAMES, N * len(nfi.ICONS), 4), np.uint8)
    for i, (name, fn) in enumerate(nfi.ICONS):
        for f, img in enumerate(animate(name, fn().img, 3, 10 + i)):
            sheet[f * N:(f + 1) * N, i * N:(i + 1) * N] = img
    save(Image.fromarray(sheet, "RGBA"), out / "icons-anim", "/tmp/nf-anim-icons.png")

    # --- tier icons: 6 across, (10 stats x 4 frames) down, frame blocks stacked
    rows = nft.ROWS
    sheet = np.zeros((N * len(rows) * FRAMES, N * nft.TIERS, 4), np.uint8)
    for r, (name, fn) in enumerate(rows):
        for t in range(nft.TIERS):
            base = fn(Canvas(), t).img
            for f, img in enumerate(animate(name, base, t, 100 + r * 10 + t)):
                y = f * N * len(rows) + r * N
                sheet[y:y + N, t * N:(t + 1) * N] = img
    save(Image.fromarray(sheet, "RGBA"), out / "tiers-anim", "/tmp/nf-anim-tiers.png")

    # --- drones: 6 across, 4 frames down
    sheet = np.zeros((N * FRAMES, N * 6, 4), np.uint8)
    for t in range(6):
        for f in range(FRAMES):
            sheet[f * N:(f + 1) * N, t * N:(t + 1) * N] = drone(t, f).img
    save(Image.fromarray(sheet, "RGBA"), out / "drones", "/tmp/nf-anim-drones.png")


def save(im, stem, contact):
    im.save(f"{stem}.png", optimize=True)
    im.save(f"{stem}.webp", lossless=True, quality=100, method=6)
    big = im.resize((im.width * 3, im.height * 3), Image.NEAREST)
    bg = Image.new("RGBA", big.size, (19, 19, 19, 255))
    bg.alpha_composite(big)
    bg.save(contact)  # for eyeballing, not shipped
    print("wrote", stem.name, im.size)


if __name__ == "__main__":
    main()
