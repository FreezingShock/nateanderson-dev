"""Star art: six life stages as 16-frame boiling loops, dissolve transitions between stages, the supernova and the hole."""
import math
import numpy as np
from common import R, P, pick, dmask, fbm3, vnoise3, grid, rgba, save_sheet, thresh, ramp, hexc

C = 128  # cell
FR = 16

STAGES = ["proto", "dwarf", "giant", "blue", "super", "iron"]
SPEC = {
    # radius, surface ramp, corona ramp, cell noise scale, limb darkening, corona reach (in R)
    "proto": dict(r=20, body=R("ember0", "ember1", "rust", "flame", "amber", "gold"), cor=R("ink", "ember1", "rust", "flame"), k=3.0, limb=0.7, reach=0.9),
    "dwarf": dict(r=24, body=R("ember1", "rust", "flame", "amber", "gold", "cream"), cor=R("ember1", "rust", "flame", "amber"), k=6.5, limb=0.55, reach=0.55),
    "giant": dict(r=44, body=R("ember0", "ember1", "rust", "flame", "amber", "gold"), cor=R("ember0", "ember1", "rust"), k=2.1, limb=0.85, reach=0.3),
    "blue": dict(r=30, body=R("navy", "cobalt", "azure", "sky", "frost", "white"), cor=R("navy", "cobalt", "azure", "sky"), k=5.0, limb=0.5, reach=0.75),
    "super": dict(r=36, body=R("indigo", "violet", "periwinkle", "frost", "white"), cor=R("deep", "indigo", "violet", "periwinkle"), k=3.6, limb=0.55, reach=0.9),
    "iron": dict(r=17, body=R("void", "soot", "ash", "stone", "bone"), cor=R("ink", "dusk", "plum", "mauve"), k=2.4, limb=0.6, reach=0.7),
}


def layer(rgb, mask, out_rgb, out_m):
    out_rgb[mask] = rgb[mask]
    out_m |= mask


def star_frame(stage, f, nfr=FR, scale=1.0, cell=C, ready=False):
    s = SPEC[stage]
    tau = 2 * math.pi * f / nfr
    x, y = grid(cell, cell)
    cx = cy = cell / 2 - 0.5
    dx, dy = x - cx, y - cy
    r = s["r"] * scale
    d = np.sqrt(dx * dx + dy * dy)
    ang = np.arctan2(dy, dx)
    out = np.zeros((cell, cell, 3), np.uint8)
    m = np.zeros((cell, cell), bool)
    ca, sa = 0.9 * math.cos(tau), 0.9 * math.sin(tau)

    # wobbly outline for the giant, a breathing one for the iron core
    edge = r
    if stage == "giant":
        edge = r * (1 + 0.05 * (vnoise3(np.cos(ang) * 2 + ca, np.sin(ang) * 2 + sa, 3.3) - 0.5) * 2)
    if stage == "iron":
        edge = r * (1 + 0.08 * math.sin(tau * 2))
    if stage == "proto":
        edge = r * (1 + 0.04 * math.sin(tau))

    # corona: rays of angular noise that boil with tau
    reach = s["reach"]
    rays = fbm3(np.cos(ang) * 3 + ca, np.sin(ang) * 3 + sa, d / r * 1.5, 3, seed=5)
    cor_v = np.clip(1 - (d - edge) / (r * reach + 1e-6), 0, 1) ** 1.6 * (0.55 + 0.75 * rays)
    if stage == "super":  # spikes
        spikes = np.abs(np.cos(ang * 4 + tau * 0.25)) ** 30 * np.clip(1 - (d - edge) / (r * 1.6), 0, 1)
        cor_v = np.maximum(cor_v, spikes * 1.1)
    cmask = (d > edge) & dmask(np.clip(cor_v * 1.3, 0, 1))
    layer(pick(s["cor"], cor_v * 0.95), cmask, out, m)

    if stage == "super":  # an ejected shell of gas, drifting outward and looping
        sh = 1.55 + 0.12 * ((f / nfr) % 1.0)
        band = np.clip(1 - np.abs(d / r - sh) * 7, 0, 1) * (0.4 + 0.8 * fbm3(np.cos(ang) * 4, np.sin(ang) * 4, 7.0 + f * 0.05, 3, 9))
        bm = dmask(band * 0.9)
        layer(pick(R("deep", "plum", "orchid", "mauve"), band), bm & ~m, out, m)

    # body
    inside = d < edge
    nz = np.sqrt(np.clip(1 - (d / np.maximum(edge, 1e-6)) ** 2, 0, 1))
    nx, ny = dx / r, dy / r
    k = s["k"]
    g = fbm3(nx * k + ca, ny * k + sa, nz * k, 4, seed=11)
    cells = np.where(g > 0.56, 1.0, np.where(g > 0.44, 0.8, 0.58))
    if stage == "iron":
        cells = 0.35 + 0.5 * g
    v = (1 - s["limb"] + s["limb"] * nz) * cells
    if stage == "giant":
        v = v * 0.92 + 0.05
    body = pick(s["body"], np.clip(v, 0, 1))
    layer(body, inside, out, m)

    if stage == "iron":  # hot cracks in the dead shell, glowing brighter as it breathes
        cr = np.abs(fbm3(nx * 2.2, ny * 2.2, nz * 2.2 + 0.3 * math.sin(tau), 3, seed=21) - 0.5)
        glow = 0.5 + 0.5 * math.sin(tau * 2)
        if ready:
            glow = 1.0
        cm = inside & (cr < (0.06 if ready else 0.035) + 0.02 * glow)
        layer(pick(R("rust", "flame", "amber", "gold", "cream"), np.clip(0.4 + 0.6 * glow - cr * 6, 0, 1)), cm, out, m)
    if stage == "proto":  # dust disc across the face and two flickering jets
        ex, ey = dx / (r * 2.4), dy / (r * 0.42)
        e = np.sqrt(ex * ex + ey * ey)
        swirl = fbm3(np.cos(np.arctan2(ey, ex) * 1) * 2 + ca * 1.4, np.sin(np.arctan2(ey, ex)) * 2 + sa * 1.4, e * 3, 3, seed=33)
        disc = np.clip(1 - np.abs(e - 0.72) * 3.2, 0, 1) * (0.4 + 0.9 * swirl)
        front = dy > -r * 0.05
        dm = dmask(np.clip(disc * 1.2, 0, 1)) & (front | ~inside)
        layer(pick(R("ink", "dusk", "plum", "rust", "amber"), disc), dm, out, m)
        jet_w = np.clip(1 - np.abs(dx) / (2.2 + 0.6 * math.sin(tau * 3)), 0, 1)
        jet_l = np.clip(1 - (np.abs(dy) - edge) / (r * 1.7), 0, 1) * (np.abs(dy) > edge * 0.9)
        jv = jet_w * jet_l * (0.6 + 0.4 * vnoise3(dx * 0.3, np.abs(dy) * 0.25 - f * 0.9, 1.0))
        layer(pick(R("plum", "orchid", "lilac", "frost"), jv), dmask(jv) & ~inside, out, m)
    return rgba(out, m)


def star_sheets():
    for st in STAGES:
        save_sheet(f"star/{st}", [star_frame(st, f) for f in range(FR)], fps=8)


def dissolve(a, b, k, cell=C):
    """Bayer dissolve from frame a to frame b, k 0..1."""
    th = thresh(cell, cell)
    use_b = th < k
    out = np.where(use_b[..., None], b, a)
    return out


def transitions():
    # each stage into the next: the old star flares, swells or shrinks, then dissolves into the new one through the dither
    for i in range(len(STAGES) - 1):
        a, b = STAGES[i], STAGES[i + 1]
        ra, rb = SPEC[a]["r"], SPEC[b]["r"]
        frames = []
        n = 14
        for f in range(n):
            t = f / (n - 1)
            e = t * t * (3 - 2 * t)
            r_now = ra + (rb - ra) * e
            fa = star_frame(a, f, scale=r_now / ra)
            fb = star_frame(b, f, scale=r_now / rb)
            fr = dissolve(fa, fb, e)
            # a bright pulse ring at the midpoint
            x, y = grid(C, C)
            d = np.sqrt((x - 63.5) ** 2 + (y - 63.5) ** 2)
            ring_r = r_now * (1.0 + 1.2 * t)
            ring = np.clip(1 - np.abs(d - ring_r) / 2.2, 0, 1) * math.sin(math.pi * t)
            rm = dmask(ring)
            col = pick(SPEC[b]["body"], np.full_like(ring, 0.95))
            fr[rm, :3] = col[rm]
            fr[rm, 3] = 255
            frames.append(fr)
        save_sheet(f"star/trans-{a}-{b}", frames, fps=12, loop=False)


def gridwh(w, h):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    return x, y


def nova(kind):
    """Full-scene blast, 320x180, 16 frames; frame 0 is the white flash. Warm for a supernova, cold with a hard ring for a neutron star."""
    w, h, n = 320, 180, 16
    if kind == "supernova":
        hot = R("white", "cream", "gold", "amber", "flame", "rose", "plum", "dusk")
        core_c = "frost"
    else:
        hot = R("white", "frost", "sky", "azure", "violet", "indigo", "dusk", "deep")
        core_c = "white"
    x, y = gridwh(w, h)
    cx, cy = w / 2 - 0.5, h / 2 - 2.5
    d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    ang = np.arctan2(y - cy, x - cx)
    frames = []
    for f in range(n):
        t = f / (n - 1)
        out = np.zeros((h, w, 3), np.uint8)
        m = np.zeros((h, w), bool)
        if f == 0:
            fl = np.clip(1.25 - d / 140, 0, 1)
            vis = dmask(fl)
            out[vis] = pick(hot, 1 - fl)[vis]; m |= vis
            frames.append(rgba(out, m)); continue
        rr = 10 + 190 * t ** 0.55
        fil = fbm3(np.cos(ang) * 6, np.sin(ang) * 6, d / 22 - t * 2.5, 4, seed=41 if kind == "supernova" else 43)
        width = (5 + 26 * t) if kind == "supernova" else (2.5 + 6 * t)
        shell = np.clip(1 - np.abs(d - rr) / width, 0, 1) * (0.35 + 0.9 * fil)
        inner = np.clip(1 - d / max(rr, 1), 0, 1) * (1 - t) * (1.2 if kind == "supernova" else 0.6) * (0.6 + 0.6 * fil)
        v = np.clip(np.maximum(shell, inner), 0, 1)
        fade = 1 - max(0, t - 0.55) / 0.45
        vis = dmask(np.clip(v * 1.4, 0, 1) * fade)
        col = pick(hot, 1 - v * (1 - t * 0.5))
        out[vis] = col[vis]; m |= vis
        if kind == "neutron" and t > 0.15:  # beams from the new pulsar
            beam = (np.abs(np.sin(ang - 0.6 - t * 3)) < 0.03) & (d < 40 + 120 * t) & dmask(np.full(d.shape, 0.8 * fade + 0.2))
            out[beam] = hexc(P["frost"]); m |= beam
        core = d < (2.5 if kind == "supernova" else 1.6) + (t > 0.5)
        out[core] = hexc(P[core_c]); m |= core
        frames.append(rgba(out, m))
    save_sheet(f"star/nova-{kind}", frames, fps=10, loop=False)


def hole():
    w, h = 320, 180
    x, y = gridwh(w, h)
    cx, cy = w / 2 - 0.5, h / 2 - 2.5
    dx, dy = x - cx, (y - cy) / 0.24
    d = np.sqrt(dx * dx + dy * dy)
    dd = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    ang = np.arctan2(dy, dx)
    disc_r = R("ember0", "rust", "flame", "amber", "gold", "cream")
    RH = 24
    frames = []
    for f in range(FR):
        tau = 2 * math.pi * f / FR
        sw = fbm3(np.cos(ang - tau) * 3, np.sin(ang - tau) * 3, d / 16, 4, seed=51)
        u = (d - RH * 1.5) / (RH * 3.2)
        v = np.clip((1 - u) * (0.45 + 0.8 * sw) * np.where(dx > 0, 1.15, 0.8), 0, 1)
        ring = (u >= 0) & (u <= 1) & dmask(np.clip(v * 1.5, 0, 1))
        out = np.zeros((h, w, 3), np.uint8)
        m = np.zeros((h, w), bool)
        col = pick(disc_r, v)
        back = ring & (y < cy)
        out[back] = col[back]; m |= back
        lens = np.clip(1 - np.abs(dd - RH * 1.5) / 3.5, 0, 1) * (0.5 + 0.6 * sw) * (y < cy + 3)
        lm = dmask(lens)
        out[lm] = pick(disc_r, lens * 0.9 + 0.1)[lm]; m |= lm
        ph = (dd > RH) & (dd <= RH + 1.5)
        out[ph] = hexc(P["cream"]); m |= ph
        hole_m = dd <= RH
        out[hole_m] = hexc(P["void"]); m |= hole_m
        front = ring & (y >= cy)
        out[front] = col[front]; m |= front
        frames.append(rgba(out, m))
    save_sheet("star/hole", frames, fps=8)


def implode():
    """The old star shrinking into the blast, 96px, 8 frames: surface collapses, then a white point."""
    for st in STAGES:
        frames = []
        n = 8
        base_r = SPEC[st]["r"]
        for f in range(n):
            t = f / (n - 1)
            k = max(0.06, (1 - t) ** 1.8) * min(1.0, 40 / base_r)
            fr = star_frame(st, f * 2, scale=k, cell=96)
            if t > 0.7:
                x, y = grid(96, 96)
                d = np.sqrt((x - 47.5) ** 2 + (y - 47.5) ** 2)
                pt = d < 2 + (t - 0.7) * 10
                fr[pt, :3] = hexc(P["white"]); fr[pt, 3] = 255
            frames.append(fr)
        save_sheet(f"star/implode-{st}", frames, fps=12, loop=False)


def iron_ready():
    frames = []
    for f in range(FR):
        fr = star_frame("iron", f, ready=True)
        frames.append(fr)
    save_sheet("star/iron-ready", frames, fps=10)


def run():
    star_sheets(); transitions(); nova("supernova"); nova("neutron"); hole(); implode(); iron_ready()
