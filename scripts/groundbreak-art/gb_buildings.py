"""Groundbreak buildings as side-on cutaways that rise stage by stage.

Every job is one horizontal strip of frames (same size, same ground line), so the UI can show frame i for the current
phase and blend to the next. The front wall is cut away: every floor, column, slab, duct and room stays visible.

Frame list per framed building: lot, dig, foundation, frame 1..F (sampled), envelope, fit-out, done.
Specials (sidewalk, driveway, water tower, footbridge, stadium, bridge) have their own sequences.
"""
import math

import numpy as np

from gb_kit import P, Canvas

UG = 44  # px of ground cross-section under grade


def rng(seed):
    return np.random.default_rng(seed)


# ------------------------------------------------------------------ shared pieces
def ground(c, gy, seed=1, top="grass"):
    W, H = c.w, c.h
    r = rng(seed)
    soil = c.rect(0, gy, W, H)
    depth = np.clip((c.Y - gy) / max(1, H - gy), 0, 1)
    c.fill(soil, 0.62 - 0.5 * depth, "dirt", 0.8)
    # strata: a gravel band and scattered stones
    band = soil & (np.abs(c.Y - (gy + 0.55 * (H - gy)) - 2 * np.sin(c.X / 23)) < 3)
    c.fill(band, 0.45, "gravel", 1.0)
    for _ in range(W // 6):
        x, y = r.uniform(0, W), r.uniform(gy + 4, H)
        c.fill(c.disc(x, y, r.uniform(0.8, 2.0), r.uniform(0.6, 1.4)) & soil, 0.35 + r.uniform(0, 0.3), "gravel", 0.4)
    if top == "grass":
        c.fill(c.rect(0, gy - 2, W, gy + 2), 0.55 + 0.1 * np.sin(c.X / 3), "green", 0.9)
        for _ in range(W // 3):
            x = r.uniform(0, W)
            c.set(c.rect(x, gy - 2 - r.integers(1, 3), x + 1, gy - 1), P["green"][r.integers(4, 7)])
    elif top == "walk":
        c.fill(c.rect(0, gy - 2, W, gy + 2), 0.6, "concrete", 0.4)


def stake(c, x, gy):
    c.set(c.rect(x, gy - 9, x + 1, gy), P["wood"][4])
    c.set(c.rect(x - 1, gy - 9, x + 2, gy - 7), P["hiviz"][5])


def fence(c, x0, x1, gy, h=12):
    for x in range(int(x0), int(x1) + 1, 12):
        c.set(c.rect(x, gy - h, x + 1, gy), P["steel"][5])
    mesh = c.rect(x0, gy - h + 1, x1, gy) & (((c.X + c.Y) % 4 < 1) | ((c.X - c.Y) % 4 < 1))
    c.set(mesh, P["steel"][3], 200)
    c.set(c.rect(x0, gy - h, x1, gy - h + 1), P["steel"][5])


def cone(c, x, gy):
    c.fill(c.poly([(x - 2.5, gy), (x + 2.5, gy), (x + 0.8, gy - 7), (x - 0.8, gy - 7)]), 0.7, "safety", 0.5)
    c.set(c.rect(x - 1.5, gy - 4, x + 1.5, gy - 3), P["white"][3])


def person(c, x, gy, vest="hiviz", lit=False, seed=0):
    """6 px worker: hard hat, vest, legs."""
    r = rng(seed)
    c.set(c.rect(x, gy - 3, x + 1, gy), P["steel"][2])
    c.set(c.rect(x + 2, gy - 3, x + 3, gy), P["steel"][2])
    c.fill(c.rect(x, gy - 6, x + 3, gy - 3), 0.75, vest, 0.4)
    c.set(c.rect(x + 0.5, gy - 8, x + 2.5, gy - 6), P["skin"][r.integers(1, 5)])
    if vest == "hiviz":
        c.set(c.rect(x, gy - 9, x + 3, gy - 8), P["hiviz"][6])


def excavator(c, x, gy, flip=False, arm=0.0):
    s = -1 if flip else 1
    c.fill(c.rect(x - 12, gy - 5, x + 12, gy), 0.3, "steel", 0.6)
    for k in range(-10, 11, 5):
        c.set(c.disc(x + k, gy - 2.5, 2), P["ink"][2])
    c.fill(c.rect(x - 10, gy - 12, x + 9, gy - 5), 0.72, "hiviz", 0.7)
    cx0 = x - 9 if not flip else x + 1
    c.fill(c.rect(cx0, gy - 20, cx0 + 8, gy - 12), 0.7, "hiviz", 0.7)
    c.fill(c.rect(cx0 + 1, gy - 19, cx0 + 7, gy - 14), 0.4, "glass", 0.6)
    bx, by = x + s * 8, gy - 11
    ex, ey = x + s * 26, gy - 26 + arm * 6
    tx, ty = x + s * 34, gy - 6 + arm * 10
    c.set(c.line(bx, by, ex, ey, 3.2), P["hiviz"][4])
    c.set(c.line(ex, ey, tx, ty, 2.4), P["hiviz"][3])
    c.fill(c.poly([(tx - 3 * s, ty - 2), (tx + 4 * s, ty - 2), (tx + 3 * s, ty + 4), (tx - 2 * s, ty + 4)]), 0.4, "steel")


def tower_crane(c, x, gy, top, jib_l, jib_r, hook_x=None, hook_y=None, load="steel"):
    """Lattice tower crane, mast from grade up to top."""
    m0, m1 = x - 3, x + 3
    c.fill(c.rect(x - 7, gy - 3, x + 7, gy + 6), 0.5, "concrete", 0.5)
    c.set(c.rect(m0, top, m0 + 1, gy - 3), P["hiviz"][4])
    c.set(c.rect(m1 - 1, top, m1, gy - 3), P["hiviz"][3])
    for y in range(int(top), int(gy - 3), 6):
        c.set(c.line(m0, y, m1, y + 6, 0.9), P["hiviz"][3])
        c.set(c.rect(m0, y, m1, y + 1), P["hiviz"][4])
    jy = top - 4
    c.fill(c.rect(x - jib_l, jy, x + jib_r, jy + 4), 0.8, "hiviz", 0.6)
    for xx in range(int(x - jib_l), int(x + jib_r), 5):
        c.set(c.line(xx, jy + 4, xx + 2.5, jy, 0.8), P["hiviz"][2])
    c.fill(c.rect(x - jib_l, jy - 2, x - jib_l + 10, jy + 6), 0.4, "concrete", 0.6)  # counterweight
    c.set(c.rect(x - 1, jy - 12, x + 1, jy), P["hiviz"][4])
    c.set(c.line(x, jy - 12, x + jib_r * 0.9, jy, 0.7), P["steel"][4])
    c.set(c.line(x, jy - 12, x - jib_l + 4, jy, 0.7), P["steel"][4])
    c.fill(c.rect(x + 3, jy + 4, x + 9, jy + 9), 0.6, "hiviz", 0.6)
    c.set(c.rect(x + 4, jy + 5, x + 8, jy + 8), P["glass"][4])
    if hook_x is not None:
        c.set(c.rect(hook_x - 3, jy + 3, hook_x + 3, jy + 5), P["steel"][3])
        c.set(c.rect(hook_x, jy + 5, hook_x + 1, hook_y), P["ink"][2])
        c.set(c.rect(hook_x - 1, hook_y, hook_x + 2, hook_y + 2), P["safety"][3])
        if load:
            c.fill(c.rect(hook_x - 14, hook_y + 4, hook_x + 15, hook_y + 7), 0.55, load, 0.6)
            c.set(c.line(hook_x, hook_y + 2, hook_x - 12, hook_y + 4, 0.6), P["ink"][2])
            c.set(c.line(hook_x + 1, hook_y + 2, hook_x + 13, hook_y + 4, 0.6), P["ink"][2])


def tree(c, x, gy, h=18, seed=0):
    r = rng(seed)
    c.set(c.rect(x, gy - h * 0.45, x + 2, gy), P["wood"][2])
    for k in range(5):
        cx, cy = x + 1 + r.uniform(-h * 0.25, h * 0.25), gy - h * 0.6 - r.uniform(0, h * 0.3)
        rr = h * r.uniform(0.18, 0.3)
        d = c.disc(cx, cy, rr)
        c.fill(d, np.clip(0.75 - (c.Y - cy + rr) / (2.6 * rr) - (c.X - cx) / (6 * rr), 0, 1), "green", 0.9)


def lamp_glow(c, x0, y0, x1, y1, k=0.9):
    """Warm interior light falling off from the ceiling centre."""
    m = c.rect(x0, y0, x1, y1)
    cx = (x0 + x1) / 2
    d = np.hypot((c.X - cx) / max(8, (x1 - x0) * 0.6), (c.Y - y0) / max(4, (y1 - y0) * 1.1))
    c.fill(m, np.clip(k - d * 0.7, 0.05, 1), "lamp", 0.9)


# ------------------------------------------------------------------ framed building model
class Spec:
    def __init__(self, key, name, floors, bays, fh, struct, skin, roof="flat", bay_w=28, W=None, H=None,
                 ground_top="grass", crane=True, deep=1, ground_use="rooms", step=1):
        self.key, self.name, self.floors, self.bays, self.fh = key, name, floors, bays, fh
        self.struct, self.skin, self.roof, self.bay_w = struct, skin, roof, bay_w
        self.bw = bays * bay_w
        self.W = W or max(240, self.bw + 140)
        roof_h = 16 if roof in ("gable", "truss") else 6
        self.H = H or (UG + floors * fh + roof_h + 60 + (40 if crane else 0))
        self.ground_top, self.crane, self.deep, self.ground_use, self.step = ground_top, crane, deep, ground_use, step


def frames_for(sp):
    ks = list(range(1, sp.floors + 1, sp.step))
    if ks[-1] != sp.floors:
        ks.append(sp.floors)
    return ["lot", "dig", "foundation"] + [f"frame{k}" for k in ks] + ["envelope", "fitout", "done"]


STRUCT_PAL = {"wood": "wood", "cmu": "precast", "steel": "steel", "concrete": "concrete", "precast": "precast"}


def floor_y(sp, gy, k):
    return gy - k * sp.fh


def draw_framed(sp, frame):
    c = Canvas(sp.W, sp.H)
    gy = sp.H - UG
    x0 = (sp.W - sp.bw) // 2 + (12 if sp.crane else 0)
    x1 = x0 + sp.bw
    ground(c, gy, seed=len(sp.key), top=sp.ground_top)
    order = frames_for(sp)
    i = order.index(frame)
    fi = order.index("foundation")
    built = sp.floors if i > order.index(f"frame{sp.floors}") else (int(frame[5:]) if frame.startswith("frame") else 0)
    envelope, fitout, done = i >= order.index("envelope"), i >= order.index("fitout"), frame == "done"
    sp_pal = STRUCT_PAL[sp.struct]
    pit = 10 + 8 * sp.deep

    if frame == "lot":
        for x in (x0, x1):
            stake(c, x, gy)
        c.set(c.rect(x0, gy - 6, x1, gy - 5), P["safety"][4], 220)
        fence(c, x0 - 40, x0 - 12, gy)
        excavator(c, x1 + 40, gy, flip=True, arm=1)
        for k in range(3):
            cone(c, x0 - 8 + k * 6, gy)
        person(c, x0 + sp.bw // 2, gy, seed=3)
        person(c, x0 + sp.bw // 2 + 6, gy, seed=4)
        return c

    # excavation pit (open in dig, filled by foundation)
    pitm = c.rect(x0 - 4, gy - 1, x1 + 4, gy + pit)
    if i == order.index("dig"):
        c.fill(pitm, 0.18 + 0.15 * (c.Y - gy) / pit, "dirt", 0.8)
        c.fill(c.rect(x0 - 6, gy - 1, x0 - 4, gy + pit) | c.rect(x1 + 4, gy - 1, x1 + 6, gy + pit), 0.5, "wood", 0.6)
        c.fill(c.poly([(x1 + 12, gy), (x1 + 50, gy), (x1 + 36, gy - 13), (x1 + 24, gy - 14)]), 0.45, "dirt", 0.9)
        excavator(c, x0 + 14, gy + pit, flip=False, arm=0.6)
        for k in range(3):
            stake(c, x0 - 18 - k * 9, gy)
        person(c, x1 - 20, gy + pit, seed=5)
        fence(c, x0 - 60, x0 - 24, gy)
        return c

    # foundation: footings under every column line, slab on grade
    cols = [x0 + b * sp.bay_w for b in range(sp.bays + 1)]
    c.fill(c.rect(x0 - 4, gy - 1, x1 + 4, gy + pit), 0.38, "gravel", 0.7)
    for x in cols:
        if sp.deep > 1:
            c.fill(c.rect(x - 2, gy, x + 3, gy + UG - 4), 0.5, "concrete", 0.6)
        c.fill(c.rect(x - 6, gy + pit - 6, x + 7, gy + pit), 0.55, "concrete", 0.5)
    slab = c.rect(x0 - 2, gy - 3, x1 + 3, gy + 1)
    c.fill(slab, 0.62, "concrete", 0.5)
    if i == fi:
        for x in range(int(x0), int(x1), 4):
            c.set(c.rect(x, gy - 6, x + 1, gy - 3), P["rebar"][4])
        person(c, x0 + 20, gy - 3, seed=6)
        person(c, x1 - 30, gy - 3, seed=7)
        c.fill(c.rect(x1 + 20, gy - 16, x1 + 52, gy - 4), 0.5, "steel", 0.5)  # mixer truck
        c.fill(c.poly([(x1 + 22, gy - 12), (x1 + 30, gy - 22), (x1 + 44, gy - 22), (x1 + 46, gy - 12)]), 0.6, "cement")
        for k in (26, 46):
            c.set(c.disc(x1 + k, gy - 3, 3), P["ink"][2])
        fence(c, x0 - 60, x0 - 24, gy)
        return c

    # structure
    top_built = floor_y(sp, gy, built)
    # back wall (interior side) appears with the envelope
    if envelope:
        for k in range(sp.floors):
            ya, yb = floor_y(sp, gy, k + 1) + 2, floor_y(sp, gy, k) - 3
            room = c.rect(x0, ya, x1, yb)
            if fitout:
                lamp_glow(c, x0, ya, x1, yb, 0.62 if done else 0.38)
            else:
                c.fill(room, 0.25 + 0.15 * (c.Y - ya) / max(1, yb - ya), "roof", 0.6)
            # windows in the back wall show the sky behind
            for b in range(sp.bays):
                wx0 = x0 + b * sp.bay_w + 5
                wx1 = wx0 + sp.bay_w - 10
                if sp.skin in ("curtain", "glass"):
                    wx0, wx1 = x0 + b * sp.bay_w + 2, x0 + (b + 1) * sp.bay_w - 2
                wy0, wy1 = ya + 2, ya + (yb - ya) * 0.62
                if sp.ground_use == "parking":
                    continue
                win = c.rect(wx0, wy0, wx1, wy1)
                c.fill(win, 0.45 + 0.4 * (c.Y - wy0) / max(1, wy1 - wy0), "glass", 0.8)
    for k in range(1, built + 1):
        ya = floor_y(sp, gy, k)
        yb = floor_y(sp, gy, k - 1)
        partial = (k == built and not envelope and frame.startswith("frame"))
        for x in cols:
            if sp.struct == "steel":
                c.fill(c.rect(x - 1, ya, x + 2, yb - 2), 0.55, "steel", 0.4)
                c.set(c.rect(x - 2, ya, x + 3, ya + 1), P["steel"][5])
            elif sp.struct == "wood":
                c.fill(c.rect(x - 1, ya, x + 1, yb - 2), 0.6, "wood", 0.4)
            else:
                c.fill(c.rect(x - 2, ya, x + 3, yb - 2), 0.55, sp_pal, 0.4)
        if sp.struct == "wood" and not envelope:
            for x in range(int(x0), int(x1), 5):
                c.set(c.rect(x, ya + 1, x + 1, yb - 2), P["wood"][3])
        if sp.struct == "cmu" and not envelope:
            wall = c.rect(x0, ya + 1, x1, yb - 2) & ~c.rect(x0 + 6, ya + 3, x1 - 6, yb - 2)
            c.fill(wall, 0.5 + 0.12 * ((c.Y // 3 + (c.X // 6 + (c.Y // 3) % 2)) % 2), "precast", 0.3)
        # slab / beam line at the top of the floor
        if sp.struct == "steel":
            c.fill(c.rect(x0 - 1, ya - 1, x1 + 2, ya + 2), 0.5, "steel", 0.4)
            if partial:
                for x in range(int(x0), int(x1), 7):
                    c.set(c.line(x, yb - 2, x + 6, ya + 2, 0.7), P["steel"][3])  # temporary bracing
            if not partial:
                c.fill(c.rect(x0 - 2, ya - 3, x1 + 3, ya - 1), 0.62, "concrete", 0.4)
        else:
            c.fill(c.rect(x0 - 2, ya - 2, x1 + 3, ya + 1), 0.6 if sp.struct != "wood" else 0.5,
                   "concrete" if sp.struct != "wood" else "wood", 0.4)
        if partial and sp.struct in ("concrete", "precast"):
            for x in cols:
                c.set(c.rect(x - 1, ya - 7, x, ya - 2), P["rebar"][4])
                c.set(c.rect(x + 1, ya - 7, x + 2, ya - 2), P["rebar"][4])
        # MEP and rooms
        if fitout:
            c.fill(c.rect(x0 + 2, ya + 2, x1 - 2, ya + 4), 0.6, "duct", 0.4)
            c.set(c.rect(x0 + 2, ya + 4, x1 - 2, ya + 5) & ((c.X // 7) % 3 == 0), P["copper"][5])
            r = rng(k * 7 + len(sp.key))
            if sp.ground_use == "parking":
                for b in range(sp.bays):
                    if r.random() < (0.8 if done else 0.2):
                        cx = x0 + b * sp.bay_w + 6
                        col = ["safety", "glass", "white", "hiviz", "cash"][r.integers(0, 5)]
                        c.fill(c.rect(cx, yb - 8, cx + sp.bay_w - 12, yb - 4), 0.6, col, 0.5)
                        c.fill(c.rect(cx + 3, yb - 11, cx + sp.bay_w - 16, yb - 8), 0.45, "glass", 0.5)
                        c.set(c.disc(cx + 3, yb - 3, 1.6) | c.disc(cx + sp.bay_w - 15, yb - 3, 1.6), P["ink"][1])
            else:
                for b in range(1, sp.bays):
                    if r.random() < 0.55:
                        px = x0 + b * sp.bay_w
                        c.fill(c.rect(px - 1, ya + 5, px + 1, yb - 2), 0.75, "white", 0.3)
                if done:
                    for b in range(sp.bays):
                        if r.random() < 0.6:
                            fx = x0 + b * sp.bay_w + r.integers(4, max(5, sp.bay_w - 12))
                            c.fill(c.rect(fx, yb - 6, fx + 8, yb - 3), 0.55, "wood", 0.4)  # desk / bed
                        if r.random() < 0.5:
                            person(c, x0 + b * sp.bay_w + r.integers(3, max(4, sp.bay_w - 6)), yb - 2,
                                   vest=["glass", "safety", "cash", "charter"][r.integers(0, 4)], seed=k * 31 + b)
                else:
                    if r.random() < 0.7:
                        person(c, x0 + r.integers(4, sp.bw - 8), yb - 2, seed=k * 13)
    # end walls (cladding) after envelope
    if envelope:
        top = floor_y(sp, gy, sp.floors)
        pal = {"brick": "brick", "precast": "precast", "curtain": "glass", "glass": "glass", "siding": "wood",
               "cmu": "precast", "open": "concrete"}[sp.skin]
        for xa, xb in ((x0 - 5, x0), (x1, x1 + 6)):
            wall = c.rect(xa, top - 2, xb, gy)
            c.fill(wall, 0.55 + (0.15 if xa < x0 else -0.1), pal, 0.6)
            if sp.skin in ("curtain", "glass"):
                for k in range(sp.floors):
                    c.set(c.rect(xa, floor_y(sp, gy, k) - 2, xb, floor_y(sp, gy, k) - 1), P["steel"][3])
        # roof
        if sp.roof == "gable":
            mid = (x0 + x1) / 2
            c.fill(c.poly([(x0 - 9, top), (x1 + 10, top), (mid + 0.5, top - 22)]), 0.35 + 0.15 * (c.X < mid), "roof")
            c.fill(c.poly([(x0 - 9, top), (x1 + 10, top), (x1 + 8, top + 2), (x0 - 7, top + 2)]), 0.2, "roof")
        elif sp.roof == "truss":
            c.fill(c.rect(x0 - 4, top - 14, x1 + 5, top - 11), 0.5, "roof", 0.5)
            for x in range(int(x0), int(x1), 8):
                c.set(c.line(x, top, x + 4, top - 11, 0.9) | c.line(x + 4, top - 11, x + 8, top, 0.9), P["steel"][4])
        else:
            c.fill(c.rect(x0 - 5, top - 5, x1 + 6, top - 2), 0.45, "roof", 0.5)
            if done:
                c.fill(c.rect(x0 + 10, top - 11, x0 + 26, top - 5), 0.5, "duct", 0.5)  # rooftop unit
    # site dressing
    if not done:
        fence(c, x0 - 70, x0 - 30, gy)
        if sp.crane and built:
            cx = x0 - 18
            ctop = min(floor_y(sp, gy, built) - 26, gy - 70)
            hook_y = floor_y(sp, gy, built) - 26
            tower_crane(c, cx, gy, ctop, 34, min(sp.bw + 20, 150), hook_x=x0 + sp.bw * 0.6,
                        hook_y=max(ctop + 6, hook_y) if not envelope else ctop + 20,
                        load=("steel" if sp.struct == "steel" else "precast") if not envelope else "glass")
        if not envelope and built:
            # scaffold up the right side
            st = floor_y(sp, gy, built)
            for x in (x1 + 7, x1 + 14):
                c.set(c.rect(x, st, x + 1, gy), P["steel"][5])
            for y in range(int(st), int(gy), 7):
                c.set(c.rect(x1 + 6, y, x1 + 16, y + 1), P["wood"][4])
        for k in range(2):
            cone(c, x1 + 26 + k * 7, gy)
        person(c, x1 + 40, gy, seed=99)
    else:
        for k, tx in enumerate((x0 - 28, x0 - 14, x1 + 16, x1 + 32)):
            tree(c, tx, gy, 16 + 6 * (k % 2), seed=k + len(sp.key))
        c.fill(c.rect(x0 + 4, gy - 1, x0 + 34, gy + 1), 0.7, "concrete", 0.3)  # walk
    return c


# ------------------------------------------------------------------ specials
def flat_job(key, kind):
    """Sidewalk / driveway: forms, base, pour, cure, done (wide and low)."""
    W, H = 320, 130
    frames = ["lot", "forms", "base", "pour", "done"]
    out = []
    for f in frames:
        c = Canvas(W, H)
        gy = H - UG
        ground(c, gy, seed=3 if kind == "walk" else 5)
        x0, x1 = 50, 270
        if kind == "drive":
            c.fill(c.rect(250, gy - 46, 316, gy), 0.4, "brick", 0.6)  # house edge
            c.fill(c.poly([(244, gy - 46), (320, gy - 46), (320, gy - 56)]), 0.3, "roof")
            c.fill(c.rect(262, gy - 36, 300, gy), 0.5, "white", 0.6)  # garage door
            for y in range(int(gy - 34), int(gy), 5):
                c.set(c.rect(262, y, 300, y + 1), P["white"][1])
            x0, x1 = 40, 260
        dug = f != "lot"
        if dug:
            c.fill(c.rect(x0, gy - 2, x1, gy + 8), 0.25, "dirt", 0.8)
        if f in ("forms", "base", "pour"):
            for x in (x0 - 2, x1):
                c.fill(c.rect(x, gy - 4, x + 2, gy + 8), 0.6, "wood", 0.4)
            for x in range(x0 + 20, x1, 40):
                stake(c, x, gy - 1)
        if f in ("base", "pour", "done"):
            c.fill(c.rect(x0, gy + 2, x1, gy + 8), 0.5, "gravel", 1.0)
            if kind == "drive":
                for x in range(x0 + 4, x1, 6):
                    c.set(c.rect(x, gy + 1, x + 4, gy + 2), P["rebar"][3])
        if f == "pour":
            c.fill(c.rect(x0, gy - 2, (x0 + x1) // 2, gy + 2), 0.38, "cement", 0.7)  # wet
            mx = (x0 + x1) // 2 + 20
            c.fill(c.rect(mx, gy - 18, mx + 36, gy - 4), 0.5, "steel", 0.5)
            c.fill(c.poly([(mx + 2, gy - 14), (mx + 9, gy - 26), (mx + 26, gy - 26), (mx + 30, gy - 14)]), 0.6, "cement")
            c.fill(c.rect(mx + 30, gy - 24, mx + 42, gy - 4), 0.7, "safety", 0.5)
            c.set(c.line(mx, gy - 10, mx - 16, gy - 2, 2), P["steel"][4])
            for k in (6, 26):
                c.set(c.disc(mx + k, gy - 3, 3), P["ink"][2])
            person(c, x0 + 40, gy - 2, seed=1)
            person(c, x0 + 70, gy - 2, seed=2)
        if f == "done":
            c.fill(c.rect(x0, gy - 2, x1, gy + 2), 0.66, "concrete", 0.4)
            for x in range(x0 + (24 if kind == "walk" else 55), x1, 24 if kind == "walk" else 55):
                c.set(c.rect(x, gy - 2, x + 1, gy + 2), P["concrete"][2])
            tree(c, 20, gy - 2, 22, seed=9)
            if kind == "walk":
                person(c, 140, gy - 2, vest="glass", seed=10)
                person(c, 190, gy - 2, vest="charter", seed=11)
        if f in ("lot", "forms"):
            cone(c, x0 - 10, gy)
            cone(c, x1 + 10, gy)
            person(c, (x0 + x1) // 2, gy, seed=4)
        out.append(c)
    return frames, out


def water_tower():
    W, H = 260, 300
    frames = ["lot", "foundation", "legs1", "legs2", "tank", "paint", "done"]
    out = []
    for f in frames:
        c = Canvas(W, H)
        gy = H - UG
        ground(c, gy, seed=8)
        cx = W // 2
        i = frames.index(f)
        legs_top = gy - (60 if f == "legs1" else 150)
        if f == "lot":
            for x in (cx - 50, cx + 50):
                stake(c, x, gy)
            excavator(c, cx + 70, gy, flip=True, arm=1)
        if i >= 1:
            c.fill(c.rect(cx - 56, gy - 3, cx + 57, gy + 14), 0.55, "concrete", 0.5)  # pile cap
            for x in (cx - 46, cx - 16, cx + 16, cx + 46):
                c.fill(c.rect(x - 2, gy + 14, x + 3, gy + UG - 2), 0.45, "concrete", 0.5)
        if i >= 2:
            lt = legs_top
            for xb, xt in ((cx - 50, cx - 30), (cx + 50, cx + 30), (cx - 18, cx - 10), (cx + 18, cx + 10)):
                t = (gy - lt) / 150
                c.fill(c.line(xb, gy - 3, xb + (xt - xb) * t, lt, 3.4), 0.5, "steel", 0.4)
            for y in range(int(gy - 30), int(lt), -30):
                t = (gy - y) / 150
                xl, xr = cx - 50 + 20 * t, cx + 50 - 20 * t
                c.set(c.rect(xl, y, xr, y + 2), P["steel"][4])
                c.set(c.line(xl, y, xr, y - 30, 0.8) & (c.Y > lt), P["steel"][3])
        if i >= 4:
            ty = gy - 150
            tank = c.disc(cx, ty - 26, 48, 30) & (c.Y < ty - 10) | c.rect(cx - 48, ty - 30, cx + 49, ty - 10)
            tank |= c.disc(cx, ty - 10, 48, 14)
            pal = "steel" if f == "tank" else "white"
            c.fill(tank, np.clip(0.75 - (c.X - cx + 40) / 160, 0, 1), pal, 0.8)
            c.fill(c.disc(cx, ty - 56, 26, 8) | c.rect(cx - 2, ty - 66, cx + 3, ty - 56), 0.4, "roof", 0.6)
            c.set(c.rect(cx - 50, ty - 10, cx + 51, ty - 8), P["steel"][4])  # catwalk
            if f == "tank":
                for k in range(3):
                    c.spark = None
                    c.set(c.disc(cx - 30 + k * 26, ty - 20, 1.5), P["lamp"][5])
            if f in ("paint", "done"):
                c.fill(c.rect(cx - 34, ty - 36, cx + 35, ty - 22), 0.6, "glass", 0.5)  # fictional town band
        if f in ("legs1", "legs2", "tank", "paint"):
            tower_crane(c, 28, gy, 40 if i >= 3 else 120, 20, 90, hook_x=cx + 10, hook_y=60 if i >= 3 else 140,
                        load="steel")
            person(c, cx + 70, gy, seed=i)
        if f == "done":
            tree(c, 20, gy, 26, 1)
            tree(c, W - 30, gy, 22, 2)
        out.append(c)
    return frames, out


def bridge(key, span, tower_h, W, H, deck_h, suspension):
    frames = ["lot", "piers", "towers", "cables", "deck1", "deck2", "done"]
    out = []
    for f in frames:
        c = Canvas(W, H)
        gy = H - UG
        i = frames.index(f)
        # water channel between banks
        ground(c, gy, seed=12)
        wl = gy + 4
        chan = c.rect(60, gy - 2, W - 60, H)
        c.fill(chan & (c.Y < wl), 0.0, "water", 0)
        c.fill(chan & (c.Y >= wl), np.clip(0.75 - (c.Y - wl) / 50, 0, 1) + 0.04 * np.sin(c.X / 4), "water", 0.9)
        c.fill(c.rect(60, gy + 30, W - 60, H), 0.3, "dirt", 0.8)
        towers = [W // 2 - span // 2, W // 2 + span // 2]
        dy = gy - deck_h
        if f == "lot":
            for x in towers:
                c.fill(c.rect(x - 9, wl - 2, x + 10, wl + 1), 0.5, "hiviz", 0.5)  # survey barge
                stake(c, x, wl - 2)
        if i >= 1:
            for x in towers:
                c.fill(c.rect(x - 10, gy + 2, x + 11, gy + 30), 0.55, "concrete", 0.5)  # caisson
        if i >= 2:
            th = tower_h if i >= 3 else tower_h * 0.55
            for x in towers:
                for dx in (-7, 5):
                    c.fill(c.rect(x + dx, gy + 2 - th, x + dx + 4, gy + 2), 0.65 - 0.2 * (dx > 0), "safety", 0.5)
                for y in range(int(gy - th + 6), int(dy), 34):
                    c.fill(c.rect(x - 7, y, x + 9, y + 4), 0.5, "safety", 0.5)
        if i >= 3:
            top = gy + 2 - tower_h
            l, r = towers
            if suspension:
                xs = np.linspace(l, r, 120)
                sag = top + 2 + (dy - 10 - top) * (1 - ((xs - (l + r) / 2) / ((r - l) / 2)) ** 2)
                for a, b, ya, yb in zip(xs[:-1], xs[1:], sag[:-1], sag[1:]):
                    c.set(c.line(a, ya, b, yb, 1.4), P["safety"][2])
                for a, b in ((l, 0), (r, W)):
                    c.set(c.line(a, top + 2, b, gy - 4, 1.4), P["safety"][2])
                if i >= 4:
                    for x, ys in zip(xs[::3], sag[::3]):
                        if f == "deck1" and abs(x - (l + r) / 2) > (r - l) * 0.3:
                            continue
                        c.set(c.rect(x, ys, x + 0.7, dy), P["steel"][4])
            else:
                for x in towers:
                    for k in range(1, 6):
                        c.set(c.line(x, top + 4 + k * 2, x - k * 15, dy, 0.8), P["white"][2])
                        c.set(c.line(x, top + 4 + k * 2, x + k * 15, dy, 0.8), P["white"][2])
        if i >= 4:
            if f == "deck1":
                spans = [(W // 2 - span * 0.3, W // 2 + span * 0.3)]
                c.set(c.rect(W // 2 - 10, dy + 6, W // 2 + 10, wl - 3), P["ink"][1], 120)
                c.fill(c.rect(W // 2 - 26, wl - 4, W // 2 + 26, wl + 1), 0.45, "steel", 0.5)  # lift barge
            else:
                spans = [(0, W)]
            for a, b in spans:
                c.fill(c.rect(a, dy, b, dy + 6), 0.55, "steel", 0.5)
                c.fill(c.rect(a, dy - 2, b, dy), 0.6, "concrete", 0.4)
                for x in range(int(a), int(b), 8):
                    c.set(c.line(x, dy + 6, x + 4, dy, 0.6), P["steel"][2])
        if f == "done":
            r = rng(4)
            for k in range(14):
                x = r.uniform(0, W)
                col = ["safety", "glass", "white", "hiviz"][r.integers(0, 4)]
                c.fill(c.rect(x, dy - 6, x + 9, dy - 2), 0.6, col, 0.5)
            for x in range(0, W, 30):
                c.set(c.rect(x, dy - 12, x + 1, dy - 2), P["steel"][5])
                c.set(c.rect(x - 1, dy - 13, x + 2, dy - 12), P["lamp"][5])
        if 1 <= i <= 5:
            c.fill(c.rect(W // 2 + span // 2 - 70, wl - 6, W // 2 + span // 2 - 30, wl + 1), 0.4, "steel", 0.5)
            tower_crane(c, W // 2 + span // 2 - 50, wl - 5, wl - 5 - tower_h - 30, 14, 40,
                        hook_x=W // 2 + span // 2 - 20, hook_y=wl - tower_h, load=None)
        out.append(c)
    return frames, out


def stadium():
    W, H = 560, 260
    frames = ["lot", "dig", "foundation", "rakers", "seats", "truss", "roof", "done"]
    out = []
    for f in frames:
        c = Canvas(W, H)
        gy = H - UG
        i = frames.index(f)
        ground(c, gy, seed=20)
        L, R = 40, W - 40
        mid = W / 2
        if f == "lot":
            for x in (L, R, mid):
                stake(c, x, gy)
            excavator(c, mid, gy, arm=1)
        if f == "dig":
            c.fill(c.rect(L + 60, gy - 1, R - 60, gy + 16), 0.2, "dirt", 0.8)
            excavator(c, mid, gy + 16, arm=0.6)
        if i >= 2:
            c.fill(c.rect(L + 60, gy - 2, R - 60, gy + 3), 0.55, "green", 0.6)  # pitch
            for x in range(int(L + 60), int(R - 60), 20):
                c.set(c.rect(x, gy - 2, x + 10, gy), P["green"][6])
            for x in (L, L + 60, R - 60, R):
                c.fill(c.rect(x - 4, gy, x + 5, gy + 16), 0.5, "concrete", 0.5)
        if i >= 3:
            for side in (0, 1):
                a, b = (L, L + 60) if side == 0 else (R, R - 60)
                pts = [(a, gy - 90), (b, gy - 8), (b, gy), (a, gy)]
                c.set(c.line(a, gy - 90, b, gy - 8, 3), P["concrete"][4])
                c.fill(c.rect(min(a, b) + (0 if side == 0 else 0), gy - 90, min(a, b) + 4, gy), 0.5, "concrete", 0.5)
                if i >= 4:
                    tri = c.poly(pts)
                    c.fill(tri, 0.32, "concrete", 0.6)
                    for k in range(12):
                        t = k / 12
                        x = a + (b - a) * t
                        y = gy - 90 + 82 * t
                        r = rng(k + side * 50)
                        c.set(c.rect(min(x, x + (b - a) / 12), y - 2, max(x, x + (b - a) / 12), y),
                              P[["safety", "glass", "hiviz"][k % 3]][3])
                        if f == "done":
                            for q in range(3):
                                if r.random() < 0.8:
                                    px = x + (b - a) / 12 * (q / 3)
                                    c.set(c.rect(px, y - 4, px + 1.4, y - 2), P[["glass", "safety", "white", "cash"][r.integers(0, 4)]][3])
        if i >= 5:
            ty = gy - 128
            if f == "truss":
                ty = gy - 100
            l, r_ = L - 6, R + 6
            c.fill(c.rect(l, ty, r_, ty + 4), 0.6, "steel", 0.5)
            c.fill(c.rect(l, ty + 14, r_, ty + 17), 0.5, "steel", 0.5)
            for x in range(int(l), int(r_), 10):
                c.set(c.line(x, ty + 17, x + 5, ty + 4, 0.9) | c.line(x + 5, ty + 4, x + 10, ty + 17, 0.9), P["steel"][4])
            for x in (L, R):
                c.fill(c.rect(x - 2, ty + 17, x + 3, gy), 0.5, "steel", 0.5)
            if f == "truss":
                for x in (L + 80, R - 80):
                    c.set(c.rect(x, ty + 17, x + 1, gy), P["ink"][2])
                    c.fill(c.rect(x - 6, gy - 30, x + 7, gy), 0.5, "hiviz", 0.5)  # strand jacks
        if i >= 6:
            ty = gy - 128
            c.fill(c.rect(L - 8, ty - 3, R + 9, ty), 0.45, "roof", 0.5)
            c.fill(c.rect(L - 8, ty - 3, L + 70, ty), 0.5, "white", 0.5)
            c.fill(c.rect(R - 70, ty - 3, R + 9, ty), 0.5, "white", 0.5)
        if f == "done":
            for x in (L + 20, R - 20):
                c.set(c.rect(x, gy - 160, x + 1, gy - 128), P["steel"][5])
                c.fill(c.rect(x - 6, gy - 168, x + 7, gy - 160), 0.9, "lamp", 0.5)
            for k in range(10):
                person(c, L + 80 + k * 38, gy - 2, vest=["safety", "glass"][k % 2], seed=k)
        out.append(c)
    return frames, out


# ------------------------------------------------------------------ catalog (campaign order)
SPECS = [
    Spec("house", "Two-storey house", 2, 4, 20, "wood", "siding", roof="gable", bay_w=24, crane=False),
    Spec("firestation", "Fire station", 2, 5, 22, "cmu", "brick", bay_w=28, crane=False),
    Spec("clinic", "Harbor clinic", 6, 6, 16, "steel", "curtain", bay_w=26),
    Spec("parking", "Parking deck", 5, 7, 14, "precast", "open", bay_w=30, ground_use="parking"),
    Spec("school", "School", 3, 9, 20, "steel", "brick", roof="truss", bay_w=28),
    Spec("office", "Mid-rise office", 14, 6, 14, "concrete", "curtain", bay_w=26, step=2, deep=2),
    Spec("tower", "40-storey tower", 40, 6, 9, "concrete", "curtain", bay_w=22, step=5, deep=3),
]


KEYMAP = {}


def build_all():
    """Returns ordered dict key -> (name, frames, [Canvas])."""
    jobs = {}
    f, cs = flat_job("sidewalk", "walk")
    jobs["sidewalk"] = ("Sidewalk run", f, cs)
    f, cs = flat_job("driveway", "drive")
    jobs["driveway"] = ("Driveway", f, cs)
    for sp in SPECS[:2]:
        fr = frames_for(sp)
        jobs[KEYMAP.get(sp.key, sp.key)] = (sp.name, fr, [draw_framed(sp, x) for x in fr])
    for sp in SPECS[2:5]:
        fr = frames_for(sp)
        jobs[KEYMAP.get(sp.key, sp.key)] = (sp.name, fr, [draw_framed(sp, x) for x in fr])
    sp = SPECS[5]
    fr = frames_for(sp)
    jobs["midrise"] = (sp.name, fr, [draw_framed(sp, x) for x in fr])
    f, cs = water_tower()
    jobs["watertower"] = ("Water tower", f, cs)
    f, cs = bridge("footbridge", 200, 90, 420, 230, 26, suspension=False)
    jobs["footbridge"] = ("Footbridge", f, cs)
    sp = SPECS[6]
    fr = frames_for(sp)
    jobs["tower"] = (sp.name, fr, [draw_framed(sp, x) for x in fr])
    f, cs = stadium()
    jobs["stadium"] = ("Stadium", f, cs)
    f, cs = bridge("bridge", 420, 190, 760, 340, 60, suspension=True)
    jobs["bridge"] = ("Suspension bridge", f, cs)
    return jobs
