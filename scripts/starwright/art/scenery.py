"""Visitors, birth-cloud card art and the nebula backdrops."""
import math
import numpy as np
from common import R, P, pick, dmask, fbm3, vnoise3, grid, rgba, save_sheet, save_still, hexc, thresh

VF = 24


def comet(f):
    c = 48
    x, y = grid(c, c)
    hx, hy = 14.0, 30.0
    # tail streams up and to the right, fanning; it shimmers along its length
    ax, ay = x - hx, y - hy
    along = (ax * 0.83 - ay * 0.56)
    across = (ax * 0.56 + ay * 0.83)
    ion = np.clip(1 - np.abs(across) / (1.2 + along * 0.12), 0, 1) * np.clip(1 - along / 34, 0, 1) * (along > 0)
    sh = vnoise3(along * 0.35 - f * 2 * math.pi / VF * 2, across * 0.6, math.sin(2 * math.pi * f / VF))
    ion = ion * (0.5 + 0.7 * sh)
    bend = across - (along ** 2) * 0.018  # curved dust tail
    dust = np.clip(1 - np.abs(bend - 3) / (1.5 + along * 0.18), 0, 1) * np.clip(1 - along / 26, 0, 1) * (along > 0) * 0.85
    out = np.zeros((c, c, 3), np.uint8); m = np.zeros((c, c), bool)
    dm = dmask(dust)
    out[dm] = pick(R("ember1", "sand", "dune", "pale"), dust)[dm]; m |= dm
    im = dmask(np.clip(ion * 1.2, 0, 1))
    out[im] = pick(R("cobalt", "azure", "sky", "frost"), ion)[im]; m |= im
    d = np.sqrt(ax * ax + ay * ay)
    coma = np.clip(1 - d / 5.5, 0, 1)
    cm = dmask(coma)
    out[cm] = pick(R("sky", "frost", "white"), coma)[cm]; m |= cm
    return rgba(out, m)


def flare(f):
    """A prominence: a loop of plasma lifting off the surface (bottom edge), stretching and snapping back."""
    c = 48
    x, y = grid(c, c)
    t = f / VF
    hgt = 18 + 14 * math.sin(math.pi * t)
    out = np.zeros((c, c, 3), np.uint8); m = np.zeros((c, c), bool)
    # arc: ellipse top half anchored at bottom
    ex, ey = (x - 24) / 13, (y - 47) / hgt
    e = np.sqrt(ex * ex + ey * ey)
    tube = np.clip(1 - np.abs(e - 1) * (9 - 3 * t), 0, 1) * (y < 47)
    flow = vnoise3(np.arctan2(ey, ex) * 5 - f * 1.2, e * 4, 0.5)
    v = tube * (0.55 + 0.6 * flow)
    if t > 0.7:  # the loop tears at the top and lets go
        tear = (np.abs(x - 24) < (t - 0.7) * 30) & (y < 47 - hgt * 0.8)
        v[tear] *= 0.25
    vm = dmask(np.clip(v * 1.3, 0, 1))
    out[vm] = pick(R("rust", "flame", "amber", "gold", "cream"), v)[vm]; m |= vm
    base = (y > 44) & (np.abs(x - 24) < 18) & dmask(np.clip(1 - np.abs(x - 24) / 18, 0, 1) * 0.9)
    out[base] = pick(R("flame", "amber", "gold"), np.clip(1 - np.abs(x - 24) / 18, 0, 1))[base]; m |= base
    return rgba(out, m)


def nebula(f):
    c = 96
    x, y = grid(c, c)
    tau = 2 * math.pi * f / VF
    dx, dy = (x - 47.5) / 44, (y - 47.5) / 34
    d = np.sqrt(dx * dx + dy * dy)
    n = fbm3(dx * 3 + 0.5 * math.cos(tau), dy * 3 + 0.5 * math.sin(tau), 2.0, 5, seed=141)
    v = np.clip((1 - d) * 1.3, 0, 1) * (n * 1.5 - 0.25)
    vm = dmask(np.clip(v * 1.4, 0, 1))
    out = np.zeros((c, c, 3), np.uint8); m = np.zeros((c, c), bool)
    out[vm] = pick(R("deep", "teal0", "teal", "aqua", "mauve", "lilac"), np.clip(v, 0, 1))[vm]; m |= vm
    return rgba(out, m)


def pair(f):
    c = 48
    x, y = grid(c, c)
    tau = 2 * math.pi * f / VF
    sx, sy = 32.0, 20.0
    d = np.sqrt((x - sx) ** 2 + (y - sy) ** 2)
    out = np.zeros((c, c, 3), np.uint8); m = np.zeros((c, c), bool)
    # gas pulled off toward the bottom left (the main star), a curling stream
    t = np.linspace(0, 1, 260)
    for i, tt in enumerate(t):
        px = sx - 6 - tt * 26 + math.sin(tt * 6 + tau) * 2.5
        py = sy + 4 + tt * 20 + tt * tt * 6
        w = 2.2 * (1 - tt) + 0.6
        if ((i * 7 + f * 3) % 11) < 2:
            continue
        yy, xx = int(round(py)), int(round(px + (math.sin(i * 1.7) * w)))
        if 0 <= yy < c and 0 <= xx < c:
            out[yy, xx] = hexc(P["gold"] if tt < 0.35 else (P["amber"] if tt < 0.7 else P["rust"]))
            m[yy, xx] = True
    cor = np.clip(1 - (d - 6) / 5, 0, 1) * (0.6 + 0.4 * vnoise3(np.arctan2(y - sy, x - sx) * 3, tau, 0)) * (d >= 6)
    cm = dmask(cor * 0.8)
    out[cm] = pick(R("rust", "flame", "amber"), cor)[cm]; m |= cm
    body = d < 6
    lit = np.clip(1 - d / 6, 0, 1)
    out[body] = pick(R("amber", "gold", "cream", "white"), lit * 0.8 + 0.25)[body]; m |= body
    return rgba(out, m)


CLOUD = {
    "dense": dict(r=R("ink", "deep", "dusk", "plum", "orchid", "mauve"), k=2.2, cov=0.95, knots=True),
    "hot": dict(r=R("ember0", "ember1", "rose0", "rose", "flame", "amber", "gold"), k=2.6, cov=0.85, stars="cream"),
    "rich": dict(r=R("soot", "sand0", "ash", "sand", "dune", "gold"), k=3.2, cov=0.8, glints=True),
    "thin": dict(r=R("ink", "navy", "cobalt", "azure", "sky"), k=1.6, cov=0.45, wisps=True),
    "dusty": dict(r=R("ember0", "sand0", "rust", "sand", "dune"), k=2.0, cov=0.9, lanes=True),
    "quiet": dict(r=R("ink", "teal0", "teal", "indigo", "violet", "aqua"), k=3.0, cov=0.85, swirl=True),
}


def cloud(cid, f, w=160, h=64, nf=8):
    s = CLOUD[cid]
    x, y = grid(w, h)
    tau = 2 * math.pi * f / nf
    u, v = x / h, y / h
    if s.get("swirl"):
        a = np.arctan2(v - 0.5, u - 1.25)
        u = u + 0.25 * np.sin(a * 2 + tau)
    n = fbm3(u * s["k"] + 0.6 * math.cos(tau), v * s["k"] + 0.6 * math.sin(tau), 3.0, 5, seed=sum(map(ord, cid)))
    if s.get("wisps"):
        n = fbm3(u * 1.2 + 0.4 * math.cos(tau), v * 5 + 0.4 * math.sin(tau), 1.0, 4, seed=7)
    val = np.clip((n - (1 - s["cov"]) * 0.6) * 1.6, 0, 1)
    if s.get("lanes"):
        lane = np.abs(v - 0.55 - 0.15 * np.sin(u * 2.2 + tau * 0.5)) < 0.08
        val = np.where(lane, val * 0.15, val)
    img = pick(s["r"], val)
    # starfield behind, and points inside some clouds
    rng = np.random.default_rng(len(cid) * 31 + 5)
    for _ in range(40):
        sx, sy = rng.integers(0, w), rng.integers(0, h)
        if val[sy, sx] < 0.35:
            img[sy, sx] = hexc(P["bone"] if rng.random() < 0.6 else P["frost"])
    if s.get("stars") or s.get("knots"):
        for i in range(5):
            sx, sy = int(rng.integers(10, w - 10)), int(rng.integers(8, h - 8))
            on = (i + f) % 4 != 0
            col = hexc(P["cream" if s.get("stars") else "lilac"])
            img[sy, sx] = col
            if on:
                for ddx, ddy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    img[sy + ddy, sx + ddx] = hexc(P["amber" if s.get("stars") else "mauve"])
    if s.get("glints"):
        for i in range(14):
            sx, sy = int(rng.integers(2, w - 2)), int(rng.integers(2, h - 2))
            if (i + f) % 3 == 0:
                img[sy, sx] = hexc(P["white"])
            elif val[sy, sx] > 0.4:
                img[sy, sx] = hexc(P["gold"])
    return rgba(img, np.ones((h, w), bool))


SKY = {
    "proto": ("void", "ink", "ember1", "rose0", "plum"),
    "dwarf": ("void", "ink", "deep", "dusk", "plum"),
    "giant": ("void", "ember0", "rose0", "ember1", "rust"),
    "blue": ("void", "ink", "navy", "cobalt", "indigo"),
    "super": ("void", "ink", "deep", "indigo", "violet"),
    "iron": ("void", "ink", "soot", "dusk", "ash"),
    "n1": ("void", "ink", "teal0", "teal", "aqua"),
    "n2": ("void", "ember0", "ember1", "rust", "rose"),
}


ACCENT = {"proto": "rose", "dwarf": "orchid", "giant": "flame", "blue": "azure", "super": "mauve", "iron": "plum", "n1": "mint", "n2": "amber"}
BF = 8


def backdrop(key):
    """A sky: a bright nebula band with dark dust lanes and a second gas colour, far galaxies, three depths of stars and a
    few big four-point stars. 8 frames: the bright stars twinkle and the gas glows a little, so the sky never sits dead still."""
    w, h = 320, 180
    x, y = grid(w, h)
    seed = sum(map(ord, key))
    n = fbm3(x / 70 + 3.1, y / 46, seed * 0.13, 5, seed=seed)
    n2 = fbm3(x / 26, y / 18 + 9, 1.7, 3, seed=seed + 3)
    band = np.clip(1 - np.abs((x / w) * 0.9 + (y / h) * 0.7 - 1.0 - 0.15 * math.sin(seed)) * 2.0, 0, 1)
    v0 = np.clip((n * 0.65 + n2 * 0.35) * band * 1.55 - 0.05, 0, 1)
    lane = fbm3(x / 40, y / 30, 5.5, 4, seed=seed + 9)
    lanes = np.clip(1 - np.abs(lane - 0.5) / 0.06, 0, 1)
    # a second, smaller cloud of another gas colour off to one side
    rng0 = np.random.default_rng(seed + 1)
    gx, gy = rng0.integers(40, w - 40), rng0.integers(30, h - 30)
    blob = np.clip(1 - np.sqrt(((x - gx) / 70) ** 2 + ((y - gy) / 40) ** 2), 0, 1) * fbm3(x / 22, y / 22, 8.0, 4, seed=seed + 5)
    rng = np.random.default_rng(seed)
    stars = [(rng.integers(0, w), rng.integers(0, h), rng.random()) for _ in range(150)]
    big = [(rng.integers(12, w - 12), rng.integers(10, h - 10), rng.random() * 6.28) for _ in range(6)]
    gal = [(rng.integers(30, w - 30), rng.integers(20, h - 20), rng.random() * 3.14) for _ in range(3)]
    frames = []
    for f in range(BF):
        tau = 2 * math.pi * f / BF
        v = v0 * (0.94 + 0.06 * np.sin(tau + x / 50))
        v = v * (1 - 0.7 * lanes)
        img = pick(R(*SKY[key]), v, ox=0, oy=0)
        bm = dmask(np.clip(blob * 1.6 - 0.35, 0, 1) * 0.75)
        img[bm] = pick(R(SKY[key][2], SKY[key][3], ACCENT[key]), np.clip(blob * 1.8, 0, 1))[bm]
        for gx_, gy_, a in gal:  # far galaxies: tilted smudges with a bright core
            dx, dy = x - gx_, y - gy_
            ex = dx * math.cos(a) + dy * math.sin(a)
            ey = -dx * math.sin(a) + dy * math.cos(a)
            g = np.clip(1 - np.sqrt((ex / 7) ** 2 + (ey / 2.2) ** 2), 0, 1)
            gm = dmask(g * 0.9)
            img[gm] = pick(R(SKY[key][3], "bone", "frost"), g)[gm]
        for i, (sx, sy, b) in enumerate(stars):  # dim far stars, some brighter, a few that blink
            if b < 0.55:
                c = "ash" if v0[sy, sx] < 0.3 else "stone"
            elif b < 0.9:
                c = "stone" if (i + f) % 5 else "bone"
            else:
                c = "bone" if (i + f) % 3 else "frost"
            img[sy, sx] = hexc(P[c])
        for i, (sx, sy, ph) in enumerate(big):  # four-point stars that breathe
            k = 0.5 + 0.5 * math.sin(tau + ph)
            arm = 1 + int(round(k * 3))
            img[sy, sx] = hexc(P["white"])
            for dd in range(1, arm + 1):
                c = hexc(P["frost" if dd == 1 else ("sky" if dd == 2 else ACCENT[key])])
                for ddx, ddy in ((dd, 0), (-dd, 0), (0, dd), (0, -dd)):
                    if 0 <= sx + ddx < w and 0 <= sy + ddy < h:
                        img[sy + ddy, sx + ddx] = c
        frames.append(rgba(img, np.ones((h, w), bool)))
    return frames


def run():
    fx_run()
    for name, fn, cell in (("comet", comet, 48), ("flare", flare, 48), ("nebula", nebula, 96), ("pair", pair, 48)):
        save_sheet(f"visitor/{name}", [fn(f) for f in range(VF)], fps=12)
    for cid in CLOUD:
        save_sheet(f"card/cloud-{cid}", [cloud(cid, f) for f in range(8)], fps=6)
    for k in SKY:
        save_sheet(f"bg/nebula-{k}", backdrop(k), fps=3)


def fx_planet_up(f, n=20, c=64):
    """A planet grows a stage: a soft shell of light gathers onto the world, flashes, then a dithered ring and sparks
    blow outward and fade. Centred on the planet, drawn over it."""
    x, y = grid(c, c)
    d = np.sqrt((x - c / 2 + 0.5) ** 2 + (y - c / 2 + 0.5) ** 2)
    ang = np.arctan2(y - c / 2, x - c / 2)
    t = f / (n - 1)
    out = np.zeros((c, c, 3), np.uint8); m = np.zeros((c, c), bool)
    if t < 0.4:  # gather: a ring closing in
        q = t / 0.4
        rr = 30 - 18 * (q * q * (3 - 2 * q))
        ring = np.clip(1 - np.abs(d - rr) / 1.6, 0, 1) * (0.4 + 0.6 * q)
        rm = dmask(ring)
        out[rm] = pick(R("plum", "orchid", "lilac", "frost"), ring)[rm]; m |= rm
    else:  # release: a bright ring out, sparks along rays
        q = (t - 0.4) / 0.6
        e = 1 - (1 - q) ** 3
        rr = 12 + 19 * e
        ring = np.clip(1 - np.abs(d - rr) / (1.2 + 2 * q), 0, 1) * (1 - q)
        rm = dmask(np.clip(ring * 1.4, 0, 1))
        out[rm] = pick(R("orchid", "lilac", "frost", "white"), ring)[rm]; m |= rm
        for i in range(10):
            a = i * 2 * math.pi / 10 + 0.3
            r0 = 10 + 22 * e * (0.8 + 0.3 * ((i * 7) % 3) / 2)
            px_, py_ = int(round(c / 2 + math.cos(a) * r0)), int(round(c / 2 + math.sin(a) * r0))
            if 0 <= px_ < c and 0 <= py_ < c and q < 0.85:
                out[py_, px_] = hexc(P["white" if q < 0.4 else "lilac"]); m[py_, px_] = True
    fl = max(0.0, 1 - abs(t - 0.42) / 0.1)
    if fl > 0:
        core = np.clip(1 - d / 12, 0, 1) * fl
        cm = dmask(core)
        out[cm] = pick(R("white", "frost", "lilac"), 1 - core)[cm]; m |= cm
    return rgba(out, m)


def fx_arrive(f, n=20, c=96):
    """A visitor arrives: space ripples open in a lens-shaped tear, a ring of light spins up and lets the visitor through."""
    x, y = grid(c, c)
    dx, dy = x - c / 2 + 0.5, (y - c / 2 + 0.5) / 0.6
    d = np.sqrt(dx * dx + dy * dy)
    ang = np.arctan2(dy, dx)
    t = f / (n - 1)
    out = np.zeros((c, c, 3), np.uint8); m = np.zeros((c, c), bool)
    open_ = math.sin(math.pi * min(1.0, t * 1.15))
    for k in range(3):  # three ripples running outward
        rr = (t * 60 + k * 14) % 44
        rip = np.clip(1 - np.abs(d - rr) / 1.8, 0, 1) * open_ * (1 - rr / 44)
        rm = dmask(np.clip(rip * 1.6, 0, 1))
        out[rm] = pick(R("teal0", "teal", "aqua", "mint"), rip)[rm]; m |= rm
    spin = np.clip(1 - np.abs(d - 20 * open_) / 2.2, 0, 1) * (0.5 + 0.5 * np.sin(ang * 6 - t * 18)) * open_
    sm = dmask(np.clip(spin * 1.3, 0, 1))
    out[sm] = pick(R("aqua", "mint", "frost", "white"), spin)[sm]; m |= sm
    return rgba(out, m)


def fx_run():
    save_sheet("fx/planet-gone", [fx_planet_gone(f) for f in range(18)], fps=12, loop=False)
    save_sheet("fx/planet-up", [fx_planet_up(f) for f in range(20)], fps=12, loop=False)
    save_sheet("fx/arrive", [fx_arrive(f) for f in range(20)], fps=10, loop=False)


def fx_planet_gone(f, n=18, c=64):
    """A planet stripped away by a blast: it cracks, breaks into glowing chunks that tumble outward and cool from gold to
    ash, leaving a thin dust ring that fades."""
    t = f / (n - 1)
    out = np.zeros((c, c, 3), np.uint8); m = np.zeros((c, c), bool)
    x, y = grid(c, c)
    d = np.sqrt((x - c / 2 + 0.5) ** 2 + (y - c / 2 + 0.5) ** 2)
    rng = np.random.default_rng(5)
    e = 1 - (1 - t) ** 2.2
    cool = ("cream", "gold", "amber", "flame", "rust", "ash")
    for i in range(16):
        a = rng.random() * 2 * math.pi
        sp = 0.5 + rng.random() * 0.7
        size = 1 + int(rng.random() * 2.2 * (1 - t))
        r0 = 3 + 26 * e * sp
        px_, py_ = int(round(c / 2 + math.cos(a) * r0)), int(round(c / 2 + math.sin(a) * r0))
        col = hexc(P[cool[min(5, int(t * 5 + rng.random()))]])
        for ox in range(size):
            for oy in range(size):
                if 0 <= px_ + ox < c and 0 <= py_ + oy < c and t < 0.95:
                    out[py_ + oy, px_ + ox] = col; m[py_ + oy, px_ + ox] = True
    dust = np.clip(1 - np.abs(d - (6 + 22 * e)) / 2.5, 0, 1) * (1 - t) * 0.7
    dm = dmask(dust) & ~m
    out[dm] = pick(R("ember1", "rust", "stone"), dust)[dm]; m |= dm
    if t < 0.2:
        core = np.clip(1 - d / (8 * (1 - t * 4)), 0, 1)
        cm = dmask(core)
        out[cm] = pick(R("white", "gold", "flame"), 1 - core)[cm]; m |= cm
    return rgba(out, m)
