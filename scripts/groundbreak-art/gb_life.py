"""Groundbreak site life: crew sprites, site vehicles and effect sheets, drawn at one art pixel per pixel.

Everything uses the golden-hour palette from gb_kit (violet shadows, amber light from the low sun on the left), so the
sprites sit in the same light as the job strips. Each sheet is a grid of equal frames; site-life.tsx steps through them.
"""
import math

import numpy as np

from gb_kit import P, Canvas

INK = P["ink"][0]

# ------------------------------------------------------------------------------------------------------------- crew
CW, CH = 24, 30  # crew frame; feet on y = 27 (rows below stay clear so the outline never wraps), body centred on x = 10
FOOT = 27

# Variants: hat ramp, vest ramp, skin index, trousers ramp
CREW_VARIANTS = [
    {"hat": "hiviz", "vest": "safety", "skin": 4, "pants": "steel", "hatv": 5},
    {"hat": "white", "vest": "hiviz", "skin": 2, "pants": "roof", "hatv": 3},
    {"hat": "safety", "vest": "hiviz", "skin": 5, "pants": "dirt", "hatv": 4},
    {"hat": "hiviz", "vest": "safety", "skin": 3, "pants": "duct", "hatv": 6},
]

# action -> number of frames, in sheet order
CREW_ACTIONS = [("walk", 6), ("carry", 6), ("hammer", 4), ("shovel", 4), ("weld", 4), ("cheer", 2), ("idle", 2)]


class Px:
    """Tiny pixel painter over a Canvas frame, with an offset."""

    def __init__(self, c, ox, oy):
        self.c, self.ox, self.oy = c, ox, oy

    def put(self, x, y, col):
        x, y = int(round(x)) + self.ox, int(round(y)) + self.oy
        if 0 <= x < self.c.w and 0 <= y < self.c.h:
            self.c.img[y, x] = (*col, 255)

    def rect(self, x0, y0, x1, y1, col):
        for y in range(int(y0), int(y1)):
            for x in range(int(x0), int(x1)):
                self.put(x, y, col)

    def line(self, x0, y0, x1, y1, col, w=1):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(n + 1):
            t = i / n
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            for d in range(w):
                self.put(x + (d if abs(y1 - y0) > abs(x1 - x0) else 0), y + (d if abs(y1 - y0) <= abs(x1 - x0) else 0), col)


def person(px, v, pose):
    """One crew member facing right. pose keys: lf, rf (foot x offsets, back/front leg), lift (front foot lift),
    bob (body drop), crouch, back_hand, front_hand (x, y relative to shoulder), tool."""
    hat, vest, pants = P[v["hat"]], P[v["vest"]], P[v["pants"]]
    skin = P["skin"]
    sk, skd = skin[v["skin"]], skin[max(0, v["skin"] - 2)]
    bob = pose.get("bob", 0)
    cr = pose.get("crouch", 0)
    hip_y = 17 + bob + cr
    sh_x, sh_y = 10, 10 + bob + cr
    boot, bootl = P["ink"][1], P["dirt"][3]

    def leg(fx, lift, col, cold):
        # hip -> knee -> ankle; the knee pushes forward when crouched
        hx, ax, ay = 10, 10 + fx, FOOT - 1 - lift
        kx, ky = (hx + ax) / 2 + (2 if cr else 0.6), (hip_y + ay) / 2 + (0 if cr else 0)
        px.line(hx, hip_y, kx, ky, col, 2)
        px.line(kx, ky, ax, ay - 1, col, 2)
        px.put(kx + 1, ky, cold)
        px.rect(ax - 1, ay, ax + 3, ay + 2, boot)
        px.put(ax + 2, ay, bootl)

    # back leg darker, front leg lit
    leg(pose.get("lf", -2), pose.get("llift", 0), pants[2], pants[1])
    # back arm (behind body)
    bh = pose.get("back_hand", (-2, 6))
    px.line(sh_x - 1, sh_y + 1, sh_x - 1 + bh[0], sh_y + bh[1], vest[2], 2)
    px.rect(sh_x - 1 + bh[0], sh_y + bh[1], sh_x + 1 + bh[0], sh_y + bh[1] + 1, skd)
    leg(pose.get("rf", 2), pose.get("lift", 0), pants[3], pants[2])

    # torso: vest over a dark shirt, belt, reflective stripe
    ty0, ty1 = sh_y, hip_y + 1
    px.rect(8, ty0, 13, ty1, vest[4])
    px.rect(8, ty0, 9, ty1, vest[3])          # back edge in shade
    px.rect(12, ty0 + 1, 13, ty1, vest[5])    # sunlit front edge
    px.rect(8, ty0 + 4, 13, ty0 + 5, P["white"][3])
    px.put(8, ty0 + 4, P["white"][2])
    px.rect(8, ty1 - 1, 13, ty1, P["ink"][2])   # belt
    px.put(12, ty1 - 1, P["hiviz"][5])          # buckle
    px.rect(9, ty0 - 1, 12, ty0, P["roof"][3])  # collar

    # head and hard hat
    hy = ty0 - 5
    px.rect(9, hy, 13, hy + 4, sk)
    px.put(9, hy + 1, skd)
    px.put(9, hy + 2, skd)
    px.put(12, hy + 1, P["ink"][1])            # eye
    px.put(13, hy + 2, sk)                     # nose
    px.put(11, hy + 3, skd)                    # jaw shade
    px.rect(8, hy - 2, 13, hy, hat[v["hatv"]])
    px.rect(9, hy - 3, 12, hy - 2, hat[v["hatv"]])
    px.put(11, hy - 3, hat[min(len(hat) - 1, v["hatv"] + 1)])
    px.rect(8, hy, 15, hy + 1, hat[max(0, v["hatv"] - 1)])  # brim
    if pose.get("visor"):
        px.rect(11, hy, 14, hy + 3, P["ink"][2])
        px.put(13, hy + 1, P["lamp"][5])

    # front arm and tool
    fh = pose.get("front_hand", (2, 6))
    hx, hy2 = sh_x + 1 + fh[0], sh_y + fh[1]
    tool = pose.get("tool")
    if tool == "plank":
        # plank on the shoulder, front hand steadying it
        py = sh_y - 2
        px.rect(0, py, 22, py + 2, P["wood"][4])
        px.rect(0, py, 22, py + 1, P["wood"][5])
        px.put(0, py + 1, P["wood"][2])
        px.put(21, py + 1, P["wood"][2])
        hx, hy2 = 12, py + 2
    px.line(sh_x + 1, sh_y + 1, hx, hy2, vest[3], 2)
    px.rect(hx, hy2, hx + 2, hy2 + 2, sk)
    if tool == "hammer":
        a = pose["ang"]
        ex, ey = hx + 1 + math.cos(a) * 6, hy2 + 1 + math.sin(a) * 6
        px.line(hx + 1, hy2 + 1, ex, ey, P["wood"][5])
        nx, ny = -math.sin(a), math.cos(a)
        px.line(ex - nx * 2, ey - ny * 2, ex + nx * 2, ey + ny * 2, P["steel"][6], 2)
    elif tool == "shovel":
        a = pose["ang"]
        ex, ey = hx + 1 + math.cos(a) * 9, hy2 + 1 + math.sin(a) * 9
        px.line(hx + 1 - math.cos(a) * 3, hy2 + 1 - math.sin(a) * 3, ex, ey, P["wood"][4])
        px.rect(ex - 1, ey - 1, ex + 2, ey + 2, P["steel"][5])
        px.put(ex + 1, ey - 1, P["steel"][7])
        if pose.get("load"):
            px.rect(ex - 1, ey - 2, ex + 2, ey - 1, P["dirt"][5])
    elif tool == "torch":
        px.line(hx + 1, hy2 + 1, hx + 5, hy2 + 3, P["steel"][6])
        px.put(hx + 5, hy2 + 3, P["copper"][6])
        if pose.get("arc"):
            for dx, dy, c in [(6, 3, 6), (7, 2, 5), (7, 4, 5), (6, 5, 4), (8, 3, 4)]:
                px.put(hx + dx, hy2 + dy, P["lamp"][c])
    elif tool == "bucket":
        px.rect(hx - 1, hy2 + 2, hx + 3, hy2 + 6, P["duct"][4])
        px.rect(hx - 1, hy2 + 2, hx + 3, hy2 + 3, P["cement"][5])


def crew_pose(action, f):
    if action in ("walk", "carry"):
        ph = f / 6 * 2 * math.pi
        s = math.sin(ph)
        pose = {"lf": round(-3 * s), "rf": round(3 * s), "lift": 1 if s < -0.5 else 0, "llift": 1 if s > 0.5 else 0,
                "bob": 0 if abs(s) > 0.5 else -1,
                "back_hand": (round(-2 * s) - 1, 6), "front_hand": (round(2 * s), 6)}
        if action == "carry":
            pose["tool"] = "plank"
            pose["back_hand"] = (-1, 5)
        return pose
    if action == "hammer":
        ang = [-1.9, -1.2, 0.3, 0.9][f]
        return {"lf": -3, "rf": 3, "crouch": 2, "tool": "hammer", "ang": ang,
                "front_hand": (round(3 + math.cos(ang + 0.6) * 2), round(4 + math.sin(ang + 0.6) * 3)), "back_hand": (1, 7)}
    if action == "shovel":
        ang = [1.0, 0.7, -0.4, 0.5][f]
        return {"lf": -3, "rf": 2, "crouch": 1 if f < 2 else 0, "tool": "shovel", "ang": ang, "load": f in (2, 3),
                "front_hand": (2, 5 if f < 2 else 3), "back_hand": (0, 6)}
    if action == "weld":
        return {"lf": -2, "rf": 3, "crouch": 3, "tool": "torch", "visor": True, "arc": f % 2 == 0,
                "front_hand": (3, 4), "back_hand": (1, 6)}
    if action == "cheer":
        return {"lf": -2, "rf": 2, "bob": -1 if f else 0, "lift": f, "llift": f,
                "front_hand": (2, -5 - f), "back_hand": (-3, -4 - f)}
    # idle: hand on hip, small breath
    return {"lf": -2, "rf": 2, "bob": f, "front_hand": (2, 5), "back_hand": (-1, 6)}


G = 2  # transparent gutter around every frame, so scaled sampling never bleeds a neighbour in


def grid(rows, fw, fh):
    cols = max(len(r) for r in rows)
    c = Canvas(cols * (fw + 2 * G), len(rows) * (fh + 2 * G))
    for y, r in enumerate(rows):
        for x, fr in enumerate(r):
            c.over(fr, x * (fw + 2 * G) + G, y * (fh + 2 * G) + G)
    return c


def crew_sheet():
    rows = []
    for v in CREW_VARIANTS:
        row = []
        for action, n in CREW_ACTIONS:
            for f in range(n):
                fr = Canvas(CW, CH)
                person(Px(fr, 0, 0), v, crew_pose(action, f))
                fr.outline(INK)
                row.append(fr)
        rows.append(row)
    c = grid(rows, CW, CH)
    return c


# ---------------------------------------------------------------------------------------------------------- vehicles
VW, VH = 96, 46  # vehicle frame; wheels touch y = 43, clear rows below; vehicles face LEFT (they drive in from the right)
VGROUND = 43


def wheel(px, cx, f, r=5):
    tyre, rim, hub = P["ink"][1], P["steel"][4], P["steel"][6]
    for y in range(-r, r + 1):
        for x in range(-r, r + 1):
            d = math.hypot(x, y)
            if d <= r + 0.2:
                px.put(cx + x, VGROUND - r + y, tyre)
            if d <= r - 2.2:
                px.put(cx + x, VGROUND - r + y, rim)
    a = f * math.pi / 4
    for k in range(2):
        ang = a + k * math.pi / 2
        px.put(cx + round(math.cos(ang) * 2), VGROUND - r + round(math.sin(ang) * 2), hub)
        px.put(cx - round(math.cos(ang) * 2), VGROUND - r - round(math.sin(ang) * 2), hub)
    px.put(cx, VGROUND - r, P["ink"][2])
    px.put(cx - 2, VGROUND - r - 3, P["steel"][3])  # tyre shine


def cab(px, x0, body):
    """Cab at the front (left), x0 = its left edge. 22 wide, 20 tall above the chassis."""
    b = P[body] + [P[body][-1]] * 4
    top = VGROUND - 30
    px.rect(x0 + 4, top, x0 + 22, VGROUND - 8, b[4])
    px.rect(x0, top + 8, x0 + 4, VGROUND - 8, b[4])            # bonnet slope
    px.rect(x0 + 1, top + 7, x0 + 4, top + 8, b[5])
    px.rect(x0 + 4, top, x0 + 22, top + 1, b[6])                # sunlit roof
    px.rect(x0 + 21, top, x0 + 22, VGROUND - 8, b[2])           # back edge in shade
    px.rect(x0 + 6, top + 2, x0 + 13, top + 8, P["glass"][3])   # windscreen
    px.rect(x0 + 6, top + 2, x0 + 8, top + 4, P["sunglass"][5])
    px.rect(x0 + 14, top + 2, x0 + 20, top + 8, P["glass"][2])  # side window
    px.put(x0 + 15, top + 3, P["sunglass"][4])
    px.rect(x0 + 15, top + 10, x0 + 19, top + 11, b[2])         # door handle line
    px.rect(x0, VGROUND - 11, x0 + 3, VGROUND - 9, P["lamp"][5])  # headlight
    px.rect(x0, VGROUND - 9, x0 + 6, VGROUND - 7, P["steel"][5])  # bumper
    px.rect(x0 + 10, top - 2, x0 + 14, top, P["safety"][4])      # beacon
    px.put(x0 + 11, top - 2, P["safety"][5])


def chassis(px, x0, x1):
    px.rect(x0, VGROUND - 9, x1, VGROUND - 6, P["steel"][2])
    px.rect(x0, VGROUND - 9, x1, VGROUND - 8, P["steel"][3])


def dump_truck(f, tip=0.0, load=True):
    c = Canvas(VW, VH)
    px = Px(c, 0, 0)
    chassis(px, 6, 86)
    cab(px, 6, "hiviz")
    # bed: hinged at the back (x = 86), front lifts by tip
    lift = tip * 14
    bed = [(30, VGROUND - 10 - lift), (86, VGROUND - 10), (86, VGROUND - 26), (32, VGROUND - 26 - lift * 1.1)]
    m = c.poly(bed)
    c.fill(m, np.clip(0.35 + (c.Y - (VGROUND - 26)) / -60, 0, 1), "safety", 0.6)
    edge = c.grow(m, 0) & ~np.roll(m, 1, 0)
    c.set(edge, P["safety"][5])
    for i in range(4):
        x = 38 + i * 12
        rib = c.line(x, VGROUND - 25 - lift * (86 - x) / 56, x, VGROUND - 11 - lift * (86 - x) / 56, 1)
        c.set(rib & m, P["safety"][2])
    if load:
        heap = c.poly([(34, VGROUND - 26 - lift), (50, VGROUND - 33 - lift * 0.9), (66, VGROUND - 32 - lift * 0.6),
                       (84, VGROUND - 26), (84, VGROUND - 25), (34, VGROUND - 25 - lift)])
        c.fill(heap & ~m, np.clip(0.75 - (c.X - 34) / 120, 0, 1), "dirt", 0.9)
    if tip > 0.4:
        # dirt pouring off the back
        for i in range(int(tip * 10)):
            y = VGROUND - 22 + i * 2
            px.rect(86 + (i % 3), y, 89 + (i % 2), y + 2, P["dirt"][4 - i % 3])
    wheel(px, 20, f)
    wheel(px, 62, f)
    wheel(px, 76, f)
    c.outline(INK)
    return c


def mixer(f):
    c = Canvas(VW, VH)
    px = Px(c, 0, 0)
    chassis(px, 6, 88)
    cab(px, 6, "cement")
    # drum: an egg tilted up toward the back, with spiral fins that turn with f
    cx, cy, rx, ry = 56, VGROUND - 22, 28, 11
    m = ((c.X - cx) / rx) ** 2 + ((c.Y - cy) / ry) ** 2 <= 1
    m &= c.Y < VGROUND - 9
    shade = np.clip(0.85 - (c.Y - (cy - ry)) / (2.4 * ry) - (c.X - cx) / 160, 0, 1)
    c.fill(m, shade, "cement", 0.7)
    for k in range(4):
        x = cx - rx + ((k * 14 + f * 3.5) % 56)
        stripe = c.line(x, cy - ry, x + 8, cy + ry, 2) & m
        c.fill(stripe, np.clip(shade + 0.15, 0, 1), "safety", 0.5)
    chute = c.line(84, VGROUND - 22, 92, VGROUND - 14, 2)
    c.set(chute, P["steel"][4])
    px.rect(80, VGROUND - 36, 86, VGROUND - 31, P["steel"][3])   # hopper
    px.rect(80, VGROUND - 36, 86, VGROUND - 35, P["steel"][5])
    px.rect(34, VGROUND - 14, 82, VGROUND - 9, P["steel"][3])    # drum cradle
    wheel(px, 20, f)
    wheel(px, 64, f)
    wheel(px, 78, f)
    c.outline(INK)
    return c


CARGO = ["steel", "glass", "pallets", "rebar"]


def flatbed(f, cargo):
    c = Canvas(VW, VH)
    px = Px(c, 0, 0)
    chassis(px, 6, 92)
    cab(px, 6, "safety")
    px.rect(30, VGROUND - 12, 92, VGROUND - 9, P["wood"][3])
    px.rect(30, VGROUND - 12, 92, VGROUND - 11, P["wood"][5])
    top = VGROUND - 12
    if cargo == "steel":
        for k in range(3):
            y = top - 4 * (k + 1)
            px.rect(32, y, 90, y + 4, P["steel"][3 + k])
            px.rect(32, y, 90, y + 1, P["steel"][5 + (k > 0)])
            px.rect(32, y + 3, 90, y + 4, P["steel"][2])
            px.put(32, y + 1, P["ink"][2])
            px.put(32, y + 2, P["ink"][2])
    elif cargo == "glass":
        for k in range(4):
            x = 36 + k * 13
            px.rect(x, top - 18, x + 11, top, P["glass"][3 + k % 2])
            px.line(x + 2, top - 16, x + 6, top - 4, P["sunglass"][5])
            px.rect(x, top - 18, x + 11, top - 17, P["steel"][6])
        px.rect(34, top - 19, 36, top, P["wood"][2])            # A-frame rack
    elif cargo == "pallets":
        for k in range(3):
            x = 34 + k * 19
            px.rect(x, top - 2, x + 16, top, P["wood"][3])
            px.rect(x + 1, top - 13, x + 15, top - 2, P["precast"][4 + k % 2])
            px.rect(x + 1, top - 13, x + 15, top - 12, P["precast"][6])
            px.rect(x + 7, top - 13, x + 9, top - 2, P["hiviz"][5])   # strap
    elif cargo == "rebar":
        for k in range(3):
            y = top - 3 * (k + 1)
            px.rect(32, y, 91, y + 2, P["rebar"][3 + k])
            for x in range(34, 90, 3):
                px.put(x, y, P["rebar"][5])
            px.rect(48, y - 1, 50, y + 3, P["hiviz"][4])
            px.rect(74, y - 1, 76, y + 3, P["hiviz"][4])
    wheel(px, 20, f)
    wheel(px, 70, f)
    wheel(px, 82, f)
    c.outline(INK)
    return c


def vehicle_sheet():
    """Rows: dump (drive 2, tip 4, empty drive 2), mixer (4 drum frames), flatbed x 4 cargo (2 frames each, + empty)."""
    rows = []
    rows.append([dump_truck(0), dump_truck(1)] + [dump_truck(0, t) for t in (0.3, 0.6, 0.85, 1.0)] +
                [dump_truck(0, 0, False), dump_truck(1, 0, False)])
    rows.append([mixer(f) for f in range(8)])
    for cg in CARGO:
        rows.append([flatbed(0, cg), flatbed(1, cg)] + [flatbed(f % 2, None) for f in range(2)])
    c = grid(rows, VW, VH)
    return c


# ------------------------------------------------------------------------------------------------------------ effects
FW, FH = 48, 40


def puff(f, n=6, col="sand"):
    """Dust cloud that blooms and thins out over n frames, sitting on the frame bottom."""
    c = Canvas(FW, FH)
    t = (f + 1) / n
    rng = np.random.default_rng(7)
    for k in range(9):
        a = -0.15 + k * (math.pi + 0.3) / 8 + rng.uniform(-0.15, 0.15)
        d = (4 + 14 * t * rng.uniform(0.6, 1.0)) * (0.35 if k % 3 == 1 else 1)
        cx, cy = FW / 2 + math.cos(a) * d * 1.3, FH - 6 - math.sin(a) * d * 0.7 - t * 6
        r = 3 + 6 * t * rng.uniform(0.6, 1.0)
        m = ((c.X - cx) / r) ** 2 + ((c.Y - cy) / (r * 0.8)) ** 2 <= 1
        cover = max(0.0, 1.0 - t * 0.9)
        lit = np.clip(0.75 - (c.Y - cy) / (3 * r) - (c.X - cx) / (5 * r), 0, 1)
        sel = m & (c.B < cover - 0.5)
        c.fill(sel, lit, col, 0.6)
    return c


def sparks(f):
    c = Canvas(FW, FH)
    px = Px(c, 0, 0)
    rng = np.random.default_rng(11 + f)
    ox, oy = FW // 2, 8
    for k in range(14):
        a = rng.uniform(0.15, math.pi - 0.15)
        v = rng.uniform(4, 11)
        t = (f + rng.uniform(0.4, 1.0)) / 4
        x = ox + math.cos(a) * v * t * 2
        y = oy - math.sin(a) * v * t + 22 * t * t
        px.put(x, y, P["lamp"][6 - int(t * 3)])
        px.put(x - math.cos(a), y + math.sin(a) * 0.5, P["lamp"][3])
    if f % 2 == 0:
        for dx, dy, cc in [(0, 0, 6), (1, 0, 5), (-1, 0, 5), (0, 1, 5), (0, -1, 5)]:
            px.put(ox + dx, oy + dy, P["lamp"][cc])
    return c


def burst(f, n=8):
    """Golden stage-done burst: a ring of rays and a few rising sparkles."""
    c = Canvas(FW, FH)
    px = Px(c, 0, 0)
    t = (f + 1) / n
    cx, cy = FW / 2, FH / 2
    for k in range(12):
        a = k * math.pi / 6 + (0.26 if k % 2 else 0)
        r0, r1 = 3 + 14 * t, 6 + 16 * t
        if t > 0.85 and k % 2:
            continue
        for s in np.linspace(r0, r1, 6):
            px.put(cx + math.cos(a) * s, cy + math.sin(a) * s * 0.85, P["lamp"][6 if s < (r0 + r1) / 2 else 4])
    if t < 0.4:
        for dx in range(-2, 3):
            for dy in range(-2, 3):
                if abs(dx) + abs(dy) <= 2:
                    px.put(cx + dx, cy + dy, P["lamp"][6 - abs(dx) - abs(dy)])
    rng = np.random.default_rng(3)
    for k in range(6):
        x = cx + rng.uniform(-16, 16)
        y = cy + 6 - t * rng.uniform(14, 22)
        if (k + f) % 3:
            px.put(x, y, P["rep"][6])
            px.put(x + 1, y, P["rep"][4])
            px.put(x - 1, y, P["rep"][4])
            px.put(x, y - 1, P["rep"][4])
            px.put(x, y + 1, P["rep"][4])
    return c


def fx_sheet():
    rows = [[puff(f) for f in range(6)], [puff(f, col="cement") for f in range(6)], [sparks(f) for f in range(4)],
            [burst(f) for f in range(8)]]
    c = grid(rows, FW, FH)
    return c
