"""Planets: 8 worlds x 4 growth stages (forming, molten, settled, finished), each a 16-frame turning loop.
Lit from the upper left. Also writes the 32x32 Orbit-menu icons from each finished world's first frame."""
import math
import numpy as np
from common import R, P, pick, dmask, fbm3, vnoise3, grid, rgba, save_sheet, save_still, hexc

FR = 24
LOOK = {
    "ember": ("rock", 14, R("ember0", "rust", "flame", "amber"), R("moss0", "sand0", "sand", "dune", "pale")),
    "cinder": ("ash", 14, R("ember0", "ember1", "rust", "flame"), R("soot", "ash", "stone", "bone")),
    "glass": ("glass", 15, R("ember0", "rust", "flame", "gold"), R("teal0", "teal", "aqua", "mint", "white")),
    "thule": ("ice", 14, R("navy", "cobalt", "azure", "sky"), R("navy", "cobalt", "sky", "frost", "white")),
    "ironclad": ("metal", 12, R("ember0", "rust", "flame", "amber", "gold"), R("soot", "ash", "stone", "bone", "frost")),
    "orrery": ("moons", 9, R("dusk", "plum", "orchid"), R("dusk", "plum", "orchid", "mauve", "lilac")),
    "haze": ("gas", 20, R("sand0", "sand", "dune"), R("ember1", "sand0", "sand", "dune", "pale", "cream")),
    "seer": ("ringed", 18, R("sand0", "sand", "dune"), R("sand0", "sand", "dune", "pale", "cream")),
}


def sphere(cell, r, cx=None, cy=None):
    x, y = grid(cell, cell)
    cx = cell / 2 - 0.5 if cx is None else cx
    cy = cell / 2 - 0.5 if cy is None else cy
    dx, dy = (x - cx) / r, (y - cy) / r
    d2 = dx * dx + dy * dy
    inside = d2 < 1
    nz = np.sqrt(np.clip(1 - d2, 0, 1))
    light = np.clip(-0.62 * dx - 0.5 * dy + 0.6 * nz, 0, 1)  # from the upper left
    return dx, dy, nz, inside, light


def lon_noise(dx, dy, nz, rot, k, seed, oct=4):
    # turn the sphere about the vertical axis by rot radians, sample 3D noise on its surface: loops seamlessly
    c, s = math.cos(rot), math.sin(rot)
    X, Z = dx * c + nz * s, -dx * s + nz * c
    return fbm3(X * k + 10, dy * k + 10, Z * k + 10, oct, seed)


def debris(cell, f, tint, gas=False):
    """Stage 0: a swirling ring of dust (rocky) or a soft knot of gas (giants) that loops."""
    x, y = grid(cell, cell)
    cx = cy = cell / 2 - 0.5
    dx, dy = (x - cx), (y - cy) / 0.55
    d = np.sqrt(dx * dx + dy * dy) / (cell * 0.42)
    ang = np.arctan2(dy, dx) - 2 * math.pi * f / FR
    n = fbm3(np.cos(ang) * 2.5, np.sin(ang) * 2.5, d * 3, 3, seed=61)
    if gas:
        v = np.clip(1 - d * 1.1, 0, 1) * (0.5 + 0.8 * n)
    else:
        v = np.clip(1 - np.abs(d - 0.55) * 2.6, 0, 1) * (0.3 + 1.0 * n) + np.clip(1 - d * 4, 0, 1) * 0.9
    # a clump gathering at the centre, brightening as it pulls the dust in
    core = np.clip(1 - np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / (2.6 if not gas else 4.0), 0, 1)
    v = np.maximum(v, core * (0.85 + 0.15 * math.sin(2 * math.pi * f / FR * 2)))
    m = dmask(np.clip(v * 1.2, 0, 1))
    img = pick(tint, v)
    # three moonlets sweeping the ring, each leaving a short gap behind it
    for i in range(3):
        a = 2 * math.pi * (f / FR) * (1 + i * 0.5) + i * 2.1
        rr = cell * 0.42 * (0.5 + 0.12 * i)
        px_, py_ = int(round(cx + math.cos(a) * rr)), int(round(cy + math.sin(a) * rr * 0.55))
        if 0 <= px_ < cell and 0 <= py_ < cell:
            img[py_, px_] = hexc(P["white"] if i == 0 else P["bone"]); m[py_, px_] = True
    return rgba(img, m)


def world(pid, stage, f, cell=32):
    look, r, hot, cool = LOOK[pid]
    rot = 2 * math.pi * f / FR
    out = np.zeros((cell, cell, 3), np.uint8)
    m = np.zeros((cell, cell), bool)
    if stage == 0:
        tint = cool
        return debris(cell, f, tint, gas=look in ("gas", "ringed"))
    if look == "moons":
        # stage 1 to 3 = 1, 2, 3 moons about a small dark body, plus the dust it came from
        dx, dy, nz, ins, light = sphere(cell, r)
        n = lon_noise(dx, dy, nz, rot, 3, 71)
        v = light * (0.6 + 0.5 * n)
        out[ins] = pick(cool, v)[ins]; m |= ins
        for i in range(stage + (1 if stage == 3 else 0)):
            a = rot * (1 + i * 0.5) + i * 2.1
            orb = r + 6 + i * 4.8
            mx, my = cell / 2 - 0.5 + math.cos(a) * orb, cell / 2 - 0.5 + math.sin(a) * orb * 0.45
            if math.sin(a) < 0 and abs(math.cos(a) * orb) < r:  # behind the body
                continue
            mr = 3.3 - i * 0.45
            ddx, ddy, mnz, mins, ml = sphere(cell, mr, mx, my)
            mc = pick(R("dusk", "orchid", "lilac", "white"), ml * 0.9 + 0.1)
            out[mins] = mc[mins]; m |= mins
        return rgba(out, m)
    dx, dy, nz, ins, light = sphere(cell, r)
    if look == "ringed":  # back half of the ring first
        ring_draw(cell, r, stage, rot, out, m, front=False)
    if stage == 1 and look not in ("gas", "ringed"):
        n = lon_noise(dx, dy, nz, rot, 3.5, 81)
        # dark crust plates floating on lava: the seams glow, widest and brightest at their middle
        seam = np.clip(1 - np.abs(n - 0.5) / 0.09, 0, 1)
        pulse = 0.85 + 0.15 * math.sin(rot * 2)
        base = pick(R("void", "soot", "ember0", "ember1"), light * 0.85 + 0.1)
        lava = pick(hot, np.clip(seam * pulse * (0.6 + 0.4 * light) + 0.2, 0, 1))
        col = np.where((seam > 0.25)[..., None], lava, base)
        out[ins] = col[ins]; m |= ins
    elif look in ("gas", "ringed"):
        bands = np.sin(dy * (3 + stage * 2.2) * math.pi / 2 + 1.3 * (lon_noise(dx, dy, nz, rot, 2, 91, 3) - 0.5)) * 0.5 + 0.5
        strength = [0, 0.25, 0.6, 0.8][stage]
        v = light * (0.7 + 0.3 * (1 - strength) + strength * 0.45 * (bands - 0.5)) + 0.1
        col = pick(cool if stage > 1 else R("ember0", "ember1", "rust", "flame", "amber"), np.clip(v, 0, 1))
        if stage == 1:  # still hot and contracting: churning glowing bands
            churn = lon_noise(dx, dy, nz, rot * 2, 4, 93, 3)
            hotb = (np.abs(np.sin(dy * 7 + churn * 3)) < 0.25) & (light > 0.25)
            col[hotb] = hexc(P["gold"])
        if stage == 3:  # a storm eye turning into view
            c, s = math.cos(rot), math.sin(rot)
            X, Z = dx * c + nz * s, -dx * s + nz * c
            storm = ((X - 0.1) ** 2 / 0.05 + (dy - 0.3) ** 2 / 0.012 < 1) & (Z > 0)
            col[storm & ins] = hexc(P["rust"] if look == "gas" else P["flame"])
        out[ins] = col[ins]; m |= ins
    else:
        n = lon_noise(dx, dy, nz, rot, 3.6, 101 + len(pid), 5)
        if look == "rock":
            land = n > 0.5
            sea = R("navy", "cobalt", "azure", "sky") if stage == 3 else R("soot", "ash", "stone")
            lc = pick(cool if stage == 3 else R("soot", "ash", "stone", "bone"), light * (0.7 + 0.4 * n))
            sc = pick(sea, light * 0.9)
            col = np.where(land[..., None], lc, sc)
            if stage == 3:  # clouds
                cl = lon_noise(dx, dy, nz, rot * 1.6, 4, 131, 3) > 0.62
                col[cl] = pick(R("stone", "bone", "white"), light)[cl]
        elif look == "ash":
            v = light * (0.55 + 0.6 * n)
            col = pick(cool, v)
            if stage == 2:
                glow = np.abs(n - 0.5) < 0.03
                col[glow] = hexc(P["flame"])
        elif look == "glass":
            col = pick(cool, light * (0.6 + 0.5 * n))
            facets = (np.floor(n * 7) % 2 == 0) & (light > 0.55)
            col[facets] = pick(R("aqua", "mint", "white"), light)[facets]
            if stage == 3:  # sun glint on the mirror sea
                g = ((dx + 0.35) ** 2 + (dy + 0.3) ** 2) < 0.05
                col[g] = hexc(P["white"])
        elif look == "ice":
            v = light * (0.75 + 0.3 * n)
            col = pick(cool, v)
            cr = np.abs(n - 0.5) < (0.03 if stage >= 2 else 0.0)
            col[cr] = hexc(P["cobalt"])
            if stage == 3:
                ocean = n < 0.4
                col[ocean] = pick(R("navy", "cobalt", "azure"), light)[ocean]
        else:  # metal
            v = light * (0.6 + 0.5 * n)
            col = pick(cool, v)
            if stage == 3:  # strip-mine terraces
                ter = (np.floor((dy + n * 0.3) * 6) % 2 == 0) & (n > 0.55)
                col[ter] = pick(R("rust", "flame", "amber"), light)[ter]
        # hard rim on the night side so the world reads against space
        out[ins] = col[ins]; m |= ins
    finish(pid, look, stage, f, cell, r, rot, out, m)
    if look == "ringed":
        ring_draw(cell, r, stage, rot, out, m, front=True)
    return rgba(out, m)


AIR = {"ember": "sky", "thule": "frost", "glass": "mint", "haze": "pale", "seer": "cream"}


def finish(pid, look, stage, f, cell, r, rot, out, m):
    """Per-stage finishing touches: a glow around molten worlds, craters on settled rock, air on finished worlds, lights."""
    x, y = grid(cell, cell)
    cx = cy = cell / 2 - 0.5
    dx, dy = (x - cx) / r, (y - cy) / r
    d = np.sqrt(dx * dx + dy * dy)
    tau = 2 * math.pi * f / FR
    if stage == 1 and look not in ("gas", "ringed"):
        hal = (d >= 1) & (d < 1 + 1.6 / r) & dmask(np.full(d.shape, 0.55 + 0.25 * math.sin(tau * 2)))
        out[hal] = hexc(P["flame"]); m |= hal
        # bright spurts of lava on the limb
        for i in range(2):
            a = tau + i * math.pi
            px_, py_ = int(round(cx + math.cos(a) * (r + 1))), int(round(cy + math.sin(a) * (r + 1)))
            if 0 <= px_ < cell and 0 <= py_ < cell:
                out[py_, px_] = hexc(P["gold"]); m[py_, px_] = True
    nz = np.sqrt(np.clip(1 - d * d, 0, 1))
    c, s_ = math.cos(rot), math.sin(rot)
    X, Z = dx * c + nz * s_, -dx * s_ + nz * c
    if stage >= 2 and look in ("rock", "ash", "metal", "glass"):
        cr = fbm3(X * 5 + 3, dy * 5, Z * 5, 2, seed=171 + len(pid))
        crater = (d < 0.92) & (Z > 0) & (cr > 0.72)
        rim = (d < 0.92) & (Z > 0) & (cr > 0.66) & ~crater
        light = np.clip(-0.62 * dx - 0.5 * dy + 0.6 * nz, 0, 1)
        out[crater] = (out[crater] * 0.55).astype(np.uint8)
        lit = rim & (light > 0.5)
        out[lit] = np.minimum(255, out[lit].astype(np.int32) + 28).astype(np.uint8)
    if stage == 3 and pid in AIR:
        light = -0.62 * dx - 0.5 * dy
        air = (d >= 0.93) & (d < 1 + 1.2 / r) & (light > -0.1) & dmask(np.clip(0.5 + light, 0, 1))
        out[air] = hexc(P[AIR[pid]]); m |= air
    if stage == 3 and pid in ("ironclad", "ember", "glass"):
        light = -0.62 * dx - 0.5 * dy + 0.6 * nz
        city = fbm3(X * 8, dy * 8, Z * 8, 2, seed=181 + len(pid))
        lights = (d < 0.95) & (light < 0.12) & (Z > -0.3) & (city > 0.64) & ((x.astype(int) + y.astype(int) + f) % 2 == 0)
        out[lights] = hexc(P["gold"] if pid != "glass" else P["aqua"]); m |= lights


def ring_draw(cell, r, stage, rot, out, m, front):
    if stage < 2:
        return
    x, y = grid(cell, cell)
    cx = cy = cell / 2 - 0.5
    dx, dy = x - cx, (y - cy) / 0.28
    d = np.sqrt(dx * dx + dy * dy)
    band = (d > r * 1.35) & (d < r * 1.85) & ~((d > r * 1.58) & (d < r * 1.64))
    side = (y >= cy) if front else (y < cy)
    hidden = (not front) & ((x - cx) ** 2 + (y - cy) ** 2 < r * r)
    v = 0.4 + 0.5 * np.clip(1 - np.abs(dx) / (r * 1.9), 0, 1) + 0.15 * np.sin(np.arctan2(dy, dx) * 9 + rot)
    sel = band & side & ~hidden & dmask(np.full(d.shape, 0.88 if stage == 3 else 0.7))
    out[sel] = pick(R("sand", "dune", "pale", "cream"), v)[sel]
    m |= sel


def run():
    for pid in LOOK:
        cell = 72 if pid == "seer" else 48
        for st in range(4):
            save_sheet(f"planet/{pid}-s{st}", [world(pid, st, f, cell) for f in range(FR)], fps=10, body=LOOK[pid][1])
        icon = world(pid, 3, 2, 48 if pid == "seer" else 32)
        if pid == "seer":
            icon = icon[8:40, 8:40]
            # re-render the ringed giant smaller so it fits a 32 tile
            LOOK["seer"] = ("ringed", 12, LOOK["seer"][2], LOOK["seer"][3])
            icon = world("seer", 3, 2, 32)
            LOOK["seer"] = ("ringed", 20, LOOK["seer"][2], LOOK["seer"][3])
        save_still(f"icon/planet-{pid}", icon)
