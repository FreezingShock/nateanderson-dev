"""Star art: six life stages as 16-frame boiling loops, dissolve transitions between stages, the supernova and the hole."""
import math
import numpy as np
from common import R, P, pick, dmask, fbm3, vnoise3, grid, rgba, save_sheet, thresh, ramp, hexc

C = 128  # cell
FR = 24

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


PROM = {
    "dwarf": [(-2.2, 0.32, 0.0), (0.7, 0.24, 2.0), (2.6, 0.28, 4.1)],
    "blue": [(-1.0, 0.22, 1.0), (1.9, 0.3, 3.0)],
    "giant": [(-2.6, 0.16, 0.5), (0.3, 0.12, 2.5), (1.6, 0.18, 4.5)],
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
    # the surface turns: sample features on a rotating sphere so spots and cells slide across the face and loop
    rc, rs = math.cos(tau), math.sin(tau)
    X, Z = nx * rc + nz * rs, -nx * rs + nz * rc
    if stage in ("dwarf", "blue", "giant", "super"):
        gran = fbm3(X * k * 2.2 + 40, ny * k * 2.2, Z * k * 2.2, 2, seed=13)
        v = v * (0.86 + 0.28 * gran)
        spot = fbm3(X * 1.8 + 7, ny * 1.8, Z * 1.8, 3, seed=17)
        lim, dark = {"dwarf": (0.66, 0.35), "giant": (0.72, 0.55), "blue": (0.7, 0.62), "super": (0.7, 0.6)}[stage]
        sp = (spot > lim) & (Z > -0.2)
        v = np.where(sp, v * dark, v)
        v = np.where((spot > lim - 0.04) & ~sp & (Z > -0.2), v * (0.5 + dark * 0.5), v)
    if stage == "giant":  # slow pulsation brightens and dims the whole face
        v = v * (0.92 + 0.08 * math.sin(tau))
    if stage == "giant":
        v = v * 0.92 + 0.05
    body = pick(s["body"], np.clip(v, 0, 1))
    layer(body, inside, out, m)

    if stage in ("dwarf", "blue", "giant"):  # little loops of plasma standing on the limb, rising and falling
        pr = PROM[stage]
        for i, (a0, hgt, ph) in enumerate(pr):
            a = a0 + tau * 0.15
            life = 0.5 + 0.5 * math.sin(tau * (1 + i % 2) + ph)
            # an arch: points at distance about r + h from the centre, within an angular span
            span = 0.22
            da = np.angle(np.exp(1j * (ang - a)))
            h = (hgt * r * (0.4 + 0.6 * life)) * np.sqrt(np.clip(1 - (da / span) ** 2, 0, 1))
            tube = np.clip(1 - np.abs(d - (r + h)) / 1.4, 0, 1) * (np.abs(da) < span) * (d > r - 1)
            tm = dmask(np.clip(tube * (0.6 + 0.5 * life), 0, 1)) & ~(d < edge)
            layer(pick(s["cor"], np.clip(0.6 + 0.4 * tube, 0, 1)), tm, out, m)
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
    """Each stage into the next, 24 frames: the old star tightens and flickers, its core flashes, a shell of the old gas is
    thrown off while the new star opens from the centre outward through the dither, and the shell drifts away and thins."""
    n = 24
    x, y = grid(C, C)
    d = np.sqrt((x - 63.5) ** 2 + (y - 63.5) ** 2)
    ang = np.arctan2(y - 63.5, x - 63.5)
    th = thresh(C, C)
    for i in range(len(STAGES) - 1):
        a, b = STAGES[i], STAGES[i + 1]
        ra, rb = SPEC[a]["r"], SPEC[b]["r"]
        frames = []
        for f in range(n):
            t = f / (n - 1)
            # 0..0.3 the old star tightens; 0.3..0.45 the flash; 0.45..1 the new star opens and settles
            if t < 0.3:
                k = t / 0.3
                fr = star_frame(a, f, scale=1 - 0.12 * k + 0.03 * math.sin(k * 20) * k)
            else:
                e = min(1.0, (t - 0.3) / 0.55)
                e = e * e * (3 - 2 * e)
                r_now = ra * 0.88 + (rb - ra * 0.88) * e
                fa = star_frame(a, f, scale=0.88 * (1 - 0.5 * e))
                fb = star_frame(b, f, scale=max(0.2, r_now / rb) * (1 + 0.06 * math.sin(math.pi * e)))
                # the new star wins from the centre outward
                front = (d / (rb * 1.9 + 1)) - e * 1.25 + th * 0.3
                fr = np.where((front < 0)[..., None], fb, fa)
            fr = fr.copy()
            # the flash: a white core that blooms and fades
            fl = max(0.0, 1 - abs(t - 0.36) / 0.12)
            if fl > 0:
                core = np.clip(1 - d / (ra * (0.6 + 1.1 * fl)), 0, 1) * fl
                cm = dmask(np.clip(core * 1.6, 0, 1))
                fr[cm, :3] = pick(R("white", "cream", "frost"), 1 - core)[cm]; fr[cm, 3] = 255
            # the thrown-off shell: old-star colours, torn by noise, drifting out and thinning
            if t > 0.32:
                st = (t - 0.32) / 0.68
                sr = ra * 0.9 + (C * 0.48 - ra * 0.9) * (st ** 0.7)
                tear = fbm3(np.cos(ang) * 5, np.sin(ang) * 5, 3.0 + st * 2, 3, seed=31 + i)
                band = np.clip(1 - np.abs(d - sr) / (1.5 + 4 * st), 0, 1) * (0.3 + 1.0 * tear) * (1 - st) ** 0.8
                bm = dmask(np.clip(band * 1.3, 0, 1)) & (d > rb * 0.9)
                fr[bm, :3] = pick(SPEC[a]["cor"], np.clip(band + 0.2, 0, 1))[bm]; fr[bm, 3] = 255
                # a hairline ring in the new star's colour runs ahead of the shell
                ring = (np.abs(d - sr * 1.12) < 0.7) & dmask(np.full(d.shape, 0.75 * (1 - st)))
                fr[ring, :3] = pick(SPEC[b]["body"], np.full(d.shape, 0.9))[ring]; fr[ring, 3] = 255
            frames.append(fr)
        save_sheet(f"star/trans-{a}-{b}", frames, fps=16, loop=False)


def gridwh(w, h):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    return x, y


def nova(kind):
    """Full-scene blast, 320x180, 16 frames; frame 0 is the white flash. Warm for a supernova, cold with a hard ring for a neutron star."""
    w, h, n = 320, 180, 24
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
        # bright knots of debris flung out along rays, ahead of the shell, trailing short streaks
        rng = np.random.default_rng(7 if kind == "supernova" else 9)
        for j in range(42):
            a = rng.random() * 2 * math.pi
            sp = 0.75 + rng.random() * 0.55
            r0 = rr * sp
            if r0 > 230: continue
            for k in range(4):
                rk = r0 - k * (2 + 6 * t)
                px_, py_ = int(round(cx + math.cos(a) * rk)), int(round(cy + math.sin(a) * rk))
                if 0 <= px_ < w and 0 <= py_ < h and (k == 0 or (j + k + f) % 3):
                    c = ("white", "gold", "amber", "rust") if kind == "supernova" else ("white", "frost", "sky", "azure")
                    if fade > 0.15 or k == 0:
                        out[py_, px_] = hexc(P[c[k]]); m[py_, px_] = True
        if t > 0.35:  # a fainter second shock, reflected inward wake
            r2 = rr * 0.55
            sec = (np.abs(d - r2) < 1.2) & dmask(np.full(d.shape, 0.5 * fade)) & (fil > 0.45)
            out[sec] = pick(hot, np.full(d.shape, 0.35))[sec]; m |= sec
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
    rng = np.random.default_rng(3)
    sparks = [(rng.random() * 2 * math.pi, 0.6 + rng.random() * 1.4, rng.integers(0, FR)) for _ in range(26)]
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
        # thin jets out of the poles, flickering knots travelling up and down
        jx = np.abs(x - cx)
        for sgn in (-1, 1):
            along = (cy - y) * sgn - RH * 0.9
            jw = 1.3 + along * 0.03
            jet = (along > 0) & (along < 80) & (jx < jw)
            knot = 0.5 + 0.5 * np.sin(along * 0.35 - tau * 3)
            jv = np.clip((1 - along / 80) * (0.4 + 0.7 * knot), 0, 1)
            jm = jet & dmask(jv)
            out[jm] = pick(R("indigo", "violet", "periwinkle", "frost"), jv)[jm]; m |= jm
        front = ring & (y >= cy)
        out[front] = col[front]; m |= front
        # sparks spiralling in over the disc
        for a0, r0, ph in sparks:
            q = ((f + ph) % FR) / FR
            rr_ = (RH * 1.6) + (RH * 3.0 * r0) * (1 - q)
            a = a0 + q * 5.0
            px_, py_ = int(round(cx + math.cos(a) * rr_)), int(round(cy + math.sin(a) * rr_ * 0.24))
            if 0 <= px_ < w and 0 <= py_ < h and not (dd[py_, px_] <= RH):
                if py_ >= cy or dd[py_, px_] > RH * 1.6:
                    out[py_, px_] = hexc(P["cream" if q > 0.6 else "gold"]); m[py_, px_] = True
        frames.append(rgba(out, m))
    save_sheet("star/hole", frames, fps=10)


def implode():
    """The old star shrinking into the blast, 96px, 8 frames: surface collapses, then a white point."""
    for st in STAGES:
        frames = []
        n = 12
        base_r = SPEC[st]["r"]
        for f in range(n):
            t = f / (n - 1)
            k = max(0.06, (1 - t) ** 1.8) * min(1.0, 40 / base_r)
            fr = star_frame(st, (f * 2) % FR, scale=k, cell=96)
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
    star_sheets(); transitions(); nova("supernova"); nova("neutron"); hole(); implode(); iron_ready(); birth()


def birth():
    """A new star from the wreck of the old one, 320x180, 24 frames, played once over the star's first seconds: the glowing
    remnant shell of the last star drifts outward and thins, while a knot of gas spirals in, flattens into a disc and lights
    at the centre in a white point."""
    w, h, n = 320, 180, 24
    x, y = gridwh(w, h)
    cx, cy = w / 2 - 0.5, h / 2 - 2.5
    dx, dy = x - cx, y - cy
    d = np.sqrt(dx * dx + dy * dy)
    ang = np.arctan2(dy, dx)
    rem = R("deep", "rose0", "rose", "flame", "amber", "gold")
    gas = R("ink", "dusk", "plum", "orchid", "mauve", "lilac")
    frames = []
    for f in range(n):
        t = f / (n - 1)
        out = np.zeros((h, w, 3), np.uint8)
        m = np.zeros((h, w), bool)
        # remnant: torn filaments on a wide shell, cooling from gold to rose as it spreads
        rr = 95 + 55 * t
        fil = fbm3(np.cos(ang) * 7, np.sin(ang) * 7, d / 18 + t * 0.8, 4, seed=61)
        shell = np.clip(1 - np.abs(d - rr) / (10 + 14 * t), 0, 1) * np.clip(fil * 1.7 - 0.45, 0, 1) * (1 - 0.75 * t)
        sm = dmask(np.clip(shell * 1.5, 0, 1))
        out[sm] = pick(rem, np.clip(shell * (1.2 - 0.6 * t), 0, 1))[sm]; m |= sm
        # infall: a spiral of gas winding inward and flattening into a disc
        k = t ** 0.8
        flat = 1 - 0.72 * k
        ddy = dy / max(flat, 0.2)
        dd = np.sqrt(dx * dx + ddy * ddy)
        a2 = np.arctan2(ddy, dx)
        spiral = np.sin(a2 * 2 + np.log(dd + 1) * 3.2 - t * 9)
        reach = 80 - 46 * k
        cloud = np.clip(1 - dd / reach, 0, 1) * (0.5 + 0.5 * spiral) * (0.5 + 0.8 * fbm3(dx / 14, ddy / 14, t * 2, 3, seed=63))
        gm = dmask(np.clip(cloud * 1.4, 0, 1)) & ~sm
        out[gm] = pick(gas, np.clip(cloud * 1.3, 0, 1))[gm]; m |= gm
        # ignition: a core that brightens, then a white point with a short cross flare
        if t > 0.35:
            q = (t - 0.35) / 0.65
            core = np.clip(1 - d / (3 + 9 * q), 0, 1) * q
            cm = dmask(np.clip(core * 1.8, 0, 1))
            out[cm] = pick(R("white", "cream", "gold", "amber"), 1 - core)[cm]; m |= cm
            arm = int(4 + 22 * q * (1 - max(0, q - 0.8) * 3))
            for s_ in range(-arm, arm + 1):
                for (px_, py_) in ((int(cx) + s_, int(cy)), (int(cx), int(cy) + s_ // 2)):
                    if dmask(np.array([[1 - abs(s_) / (arm + 1)]]))[0, 0]:
                        out[py_, px_] = hexc(P["frost"]); m[py_, px_] = True
        frames.append(rgba(out, m))
    save_sheet("star/birth", frames, fps=10, loop=False)
