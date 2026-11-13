"""Motifs for the drone tree sprites (drawn by nodefarm-tree-sprites.py into the same sheets as the other trees).

Same rules as nodefarm_tree_motifs.py: a motif draws flat parts in a 0..1 box, the shader adds ramp, outline and shadow.
The drone tree's sections are warm hangar colours (flight amber, dispatch mint, salvage rust) so it reads as its own
place next to the white prestige tree and the blue lab. Every node has its own motif; all art is original.
DRONE_NODES maps a sprite key (the drone tree node id) to (motif, section, size, accent).
"""
import math

from nodefarm_tree_motifs import motif

HAZ = "#ffd23a"
RED = "#ff4d5e"
MINT = "#6bffc9"
SKY = "#7ad8ff"
PALE = "#fff3dc"


def _quad(s, cx=0.5, cy=0.5, r=0.3, body="main", rot="metal"):
    """A small quadcopter seen from above: four rotors on arms round a body."""
    for dx, dy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        s.line([(cx, cy), (cx + dx * r, cy + dy * r)], 0.07, "dark")
    for dx, dy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        x, y = cx + dx * r, cy + dy * r
        s.ring(x - 0.12, y - 0.12, x + 0.12, y + 0.12, 0.04, rot)
        s.dot(x, y, 0.03, "glow")
    s.rect(cx - 0.12, cy - 0.12, cx + 0.12, cy + 0.12, body)
    s.dot(cx, cy, 0.04, "acc")


# ---------------------------------------------------------------------------------------------- core
@motif
def dx_bay(s):
    # the hangar door: a bay frame with hazard stripes and a drone parked inside
    s.rect(0.08, 0.12, 0.92, 0.9, "dark")
    s.rect(0.14, 0.2, 0.86, 0.84, "ink")
    for i in range(5):
        x = 0.1 + i * 0.18
        s.poly([(x, 0.9), (x + 0.08, 0.9), (x + 0.16, 0.8), (x + 0.08, 0.8)], "acc", True)
    s.rect(0.08, 0.08, 0.92, 0.16, "metal")
    _quad(s, 0.5, 0.5, 0.2)
    s.dot(0.18, 0.12, 0.03, RED)
    s.dot(0.82, 0.12, 0.03, MINT)


# ---------------------------------------------------------------------------------------------- flight
@motif
def dx_burner(s):
    # a jet nozzle with a flame plume
    s.poly([(0.12, 0.34), (0.5, 0.26), (0.5, 0.74), (0.12, 0.66)], "metal")
    s.rect(0.5, 0.3, 0.62, 0.7, "main")
    s.poly([(0.62, 0.34), (0.94, 0.5), (0.62, 0.66)], "acc")
    s.poly([(0.62, 0.42), (0.82, 0.5), (0.62, 0.58)], "glow", True)
    for y in (0.4, 0.5, 0.6):
        s.line([(0.18, y), (0.44, y)], 0.03, "dark")


@motif
def dx_formation(s):
    # a V of five drone dots with a lead light
    pts = [(0.5, 0.22), (0.32, 0.44), (0.68, 0.44), (0.16, 0.68), (0.84, 0.68)]
    s.line([pts[3], pts[1], pts[0], pts[2], pts[4]], 0.04, "dark")
    for i, (x, y) in enumerate(pts):
        s.ngon(x, y, 0.1 if i else 0.13, 4, 45, "main" if i else "acc")
        s.dot(x, y, 0.03, "glow")
    s.dot(0.5, 0.86, 0.04, "acc")


@motif
def dx_night(s):
    # a crescent moon over a drone running lights-off
    s.ell(0.12, 0.08, 0.6, 0.56, "acc")
    s.ell(0.26, 0.04, 0.72, 0.5, "ink", True)
    _quad(s, 0.6, 0.68, 0.16, "main", "dark")
    s.dot(0.86, 0.22, 0.025, "glow")
    s.dot(0.74, 0.12, 0.02, "glow")


@motif
def dx_overdrive(s):
    # a servo gear with a red needle past the line
    s.ngon(0.5, 0.52, 0.36, 10, 0, "metal")
    s.ell(0.24, 0.26, 0.76, 0.78, "main")
    s.arc(0.3, 0.32, 0.7, 0.72, 200, 340, 0.06, "dark")
    s.line([(0.5, 0.52), (0.72, 0.34)], 0.06, RED)
    s.dot(0.5, 0.52, 0.06, "acc")
    s.dot(0.74, 0.3, 0.035, "glow")


@motif
def dx_slipstream(s):
    # three chevrons riding a wake line
    for i, x in enumerate((0.2, 0.44, 0.68)):
        s.poly([(x, 0.3), (x + 0.16, 0.5), (x, 0.7), (x + 0.06, 0.5)], "main" if i < 2 else "acc")
    for y in (0.22, 0.78):
        s.line([(0.06, y), (0.94, y)], 0.03, "metal", True)
    s.dot(0.9, 0.5, 0.04, "glow")


@motif
def dx_hivemind(s):
    # six frames round one glowing node, linked
    cx, cy, r = 0.5, 0.5, 0.33
    pts = [(cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))) for a in range(-90, 270, 60)]
    for p in pts:
        s.line([(cx, cy), p], 0.04, "dark")
    s.line(pts + [pts[0]], 0.035, "metal")
    for p in pts:
        s.ngon(p[0], p[1], 0.085, 4, 45, "main")
        s.dot(p[0], p[1], 0.025, "glow")
    s.ngon(cx, cy, 0.15, 6, 0, "acc")
    s.dot(cx, cy, 0.06, "glow")


# ---------------------------------------------------------------------------------------------- dispatch
@motif
def dx_orders(s):
    # a clipboard of orders with a zone pin
    s.rect(0.2, 0.14, 0.8, 0.9, "metal")
    s.rect(0.26, 0.22, 0.74, 0.84, PALE)
    s.rect(0.38, 0.08, 0.62, 0.2, "dark")
    for y in (0.36, 0.5, 0.64):
        s.line([(0.32, y), (0.56, y)], 0.035, "ink", True)
    s.poly([(0.64, 0.5), (0.74, 0.5), (0.69, 0.66)], "acc")
    s.dot(0.69, 0.5, 0.05, "main")


@motif
def dx_patrol(s):
    # a patrol route: dashed loop past three waypoints
    s.ring(0.12, 0.2, 0.88, 0.84, 0.05, "metal")
    for a in range(0, 360, 40):
        x = 0.5 + 0.38 * math.cos(math.radians(a))
        y = 0.52 + 0.32 * math.sin(math.radians(a))
        s.dot(x, y, 0.02, "dark")
    for (x, y) in ((0.16, 0.52), (0.5, 0.2), (0.84, 0.52)):
        s.rect(x - 0.06, y - 0.06, x + 0.06, y + 0.06, "main")
    s.poly([(0.42, 0.78), (0.6, 0.84), (0.42, 0.9)], "acc")


@motif
def dx_tour(s):
    # a service stripe badge with a clock face
    s.poly([(0.2, 0.1), (0.8, 0.1), (0.8, 0.7), (0.5, 0.9), (0.2, 0.7)], "main")
    for i in range(3):
        y = 0.18 + i * 0.1
        s.poly([(0.26, y + 0.06), (0.5, y), (0.74, y + 0.06), (0.74, y + 0.1), (0.5, y + 0.04), (0.26, y + 0.1)], "acc", True)
    s.ell(0.36, 0.48, 0.64, 0.76, PALE)
    s.line([(0.5, 0.62), (0.5, 0.53)], 0.03, "ink", True)
    s.line([(0.5, 0.62), (0.58, 0.62)], 0.03, "ink", True)


@motif
def dx_fieldops(s):
    # crossed wrenches over a rank chevron
    s.line([(0.18, 0.2), (0.82, 0.8)], 0.09, "metal")
    s.line([(0.82, 0.2), (0.18, 0.8)], 0.09, "metal")
    for (x, y) in ((0.18, 0.2), (0.82, 0.2), (0.18, 0.8), (0.82, 0.8)):
        s.ring(x - 0.09, y - 0.09, x + 0.09, y + 0.09, 0.05, "dark")
    s.poly([(0.3, 0.5), (0.5, 0.36), (0.7, 0.5), (0.7, 0.62), (0.5, 0.48), (0.3, 0.62)], "main")
    s.dot(0.5, 0.7, 0.05, "acc")


@motif
def dx_relay(s):
    # a lattice mast with signal arcs to both sides
    s.poly([(0.42, 0.9), (0.48, 0.24), (0.52, 0.24), (0.58, 0.9)], "metal")
    for y in (0.4, 0.56, 0.72):
        s.line([(0.45, y), (0.55, y + 0.1)], 0.025, "dark")
    s.dot(0.5, 0.2, 0.07, "acc")
    for r in (0.2, 0.32):
        s.arc(0.5 - r, 0.2 - r, 0.5 + r, 0.2 + r, 200, 250, 0.04, "main")
        s.arc(0.5 - r, 0.2 - r, 0.5 + r, 0.2 + r, 290, 340, 0.04, "main")


@motif
def dx_garrison(s):
    # a fort tower with a drone over the battlement
    s.rect(0.22, 0.46, 0.78, 0.92, "metal")
    for x in (0.22, 0.4, 0.58):
        s.rect(x, 0.38, x + 0.12, 0.48, "metal")
    s.rect(0.42, 0.66, 0.58, 0.92, "ink")
    s.rect(0.22, 0.56, 0.78, 0.6, "acc", True)
    _quad(s, 0.5, 0.2, 0.13, "main", "dark")


# ---------------------------------------------------------------------------------------------- salvage
@motif
def dx_scrap(s):
    # a pile of bolts, plates and a spring
    s.poly([(0.08, 0.88), (0.3, 0.6), (0.6, 0.66), (0.92, 0.88)], "dark")
    s.rect(0.24, 0.46, 0.5, 0.64, "metal")
    s.ngon(0.68, 0.6, 0.12, 6, 0, "main")
    s.dot(0.68, 0.6, 0.04, "ink")
    s.line([(0.36, 0.22), (0.44, 0.3), (0.36, 0.38), (0.44, 0.46)], 0.04, "acc")
    s.dot(0.82, 0.36, 0.03, "glow")


@motif
def dx_refit(s):
    # a workbench vice holding a rotor blade
    s.rect(0.08, 0.66, 0.92, 0.76, "metal")
    s.rect(0.14, 0.76, 0.22, 0.92, "dark")
    s.rect(0.78, 0.76, 0.86, 0.92, "dark")
    s.rect(0.3, 0.42, 0.44, 0.66, "main")
    s.rect(0.56, 0.42, 0.7, 0.66, "main")
    s.poly([(0.46, 0.12), (0.54, 0.12), (0.56, 0.58), (0.44, 0.58)], "acc")
    s.line([(0.7, 0.5), (0.86, 0.5)], 0.04, "metal")


@motif
def dx_credit(s):
    # an Aether credit chip with a hangar stamp
    s.rect(0.12, 0.24, 0.88, 0.78, "main")
    s.rect(0.2, 0.36, 0.42, 0.56, "acc")
    for x in (0.24, 0.31, 0.38):
        s.line([(x, 0.36), (x, 0.56)], 0.02, "dark", True)
    s.ring(0.54, 0.34, 0.8, 0.66, 0.05, "metal")
    s.dot(0.67, 0.5, 0.05, "glow")
    s.line([(0.2, 0.68), (0.5, 0.68)], 0.03, "dark", True)


@motif
def dx_blackbox(s):
    # the flight recorder: orange box, reflective tape, a heartbeat trace
    s.rect(0.16, 0.2, 0.84, 0.84, "acc")
    s.rect(0.16, 0.2, 0.84, 0.3, "metal")
    s.rect(0.16, 0.74, 0.84, 0.84, "metal")
    s.line([(0.22, 0.52), (0.36, 0.52), (0.44, 0.36), (0.52, 0.66), (0.6, 0.48), (0.78, 0.48)], 0.04, "ink", True)
    s.rect(0.44, 0.08, 0.56, 0.2, "dark")


@motif
def dx_frames(s):
    # a rack of three chassis, one lit
    s.rect(0.1, 0.1, 0.9, 0.92, "dark")
    for i, y in enumerate((0.16, 0.42, 0.68)):
        s.rect(0.16, y, 0.84, y + 0.2, "main" if i == 1 else "metal")
        s.dot(0.24, y + 0.1, 0.03, "acc" if i == 1 else "ink")
        s.line([(0.36, y + 0.1), (0.76, y + 0.1)], 0.03, "glow" if i == 1 else "dark", True)


@motif
def dx_foundry(s):
    # a crucible pouring into a rotor mould, sparks above
    s.poly([(0.16, 0.18), (0.5, 0.18), (0.44, 0.42), (0.22, 0.42)], "metal")
    s.poly([(0.44, 0.3), (0.62, 0.36), (0.62, 0.42)], "acc")
    s.line([(0.6, 0.42), (0.6, 0.62)], 0.05, "glow")
    s.rect(0.2, 0.62, 0.88, 0.9, "dark")
    s.ell(0.42, 0.66, 0.78, 0.86, "acc")
    s.dot(0.6, 0.76, 0.05, "glow")
    for (x, y) in ((0.74, 0.18), (0.84, 0.28), (0.7, 0.08)):
        s.dot(x, y, 0.025, "acc")


# ---------------------------------------------------------------------------------------------- late pair (slots 6 and 7)
@motif
def dx_redline(s):
    # a rev gauge with the needle pinned in the red
    s.arc(0.06, 0.1, 0.94, 0.98, 180, 360, 0.09, "metal")
    s.arc(0.6, 0.1, 0.94, 0.98, 300, 360, 0.09, RED)
    s.line([(0.5, 0.62), (0.8, 0.22)], 0.05, "glow")
    s.dot(0.5, 0.62, 0.07, "dark")
    s.rect(0.14, 0.82, 0.86, 0.9, "dark", True)


@motif
def dx_wingmen(s):
    # two rotors flying in tight formation
    for cx in (0.3, 0.7):
        for dx, dy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
            s.line([(cx, 0.5), (cx + dx * 0.12, 0.5 + dy * 0.12)], 0.05, "dark")
            s.ring(cx + dx * 0.12 - 0.07, 0.5 + dy * 0.12 - 0.07, cx + dx * 0.12 + 0.07, 0.5 + dy * 0.12 + 0.07, 0.03, "metal")
        s.rect(cx - 0.07, 0.43, cx + 0.07, 0.57, "main")
        s.dot(cx, 0.5, 0.025, "acc")
    s.line([(0.3, 0.14), (0.7, 0.14)], 0.03, "glow", True)
    s.poly([(0.46, 0.14), (0.54, 0.14), (0.5, 0.06)], HAZ, True)


@motif
def dx_groundcrew(s):
    # a hard hat on a clipboard
    s.rect(0.2, 0.22, 0.8, 0.9, "dark")
    s.rect(0.28, 0.3, 0.72, 0.8, PALE)
    for i in range(3):
        s.rect(0.34, 0.4 + i * 0.12, 0.66, 0.44 + i * 0.12, "dark", True)
    s.ell(0.22, 0.12, 0.78, 0.4, MINT)
    s.rect(0.14, 0.34, 0.86, 0.4, MINT)


@motif
def dx_fullmast(s):
    # two masts joined by a full-width beam: the posting carries everything next door
    s.rect(0.1, 0.22, 0.26, 0.92, "metal")
    s.rect(0.74, 0.22, 0.9, 0.92, "metal")
    s.line([(0.18, 0.3), (0.82, 0.3)], 0.06, RED)
    s.line([(0.18, 0.5), (0.82, 0.5)], 0.04, "dark")
    s.rect(0.34, 0.6, 0.66, 0.74, "main")
    s.dot(0.18, 0.2, 0.05, RED, True)
    s.dot(0.82, 0.2, 0.05, RED, True)


@motif
def dx_sparebin(s):
    # a bin of nuts and bolts
    s.poly([(0.14, 0.4), (0.86, 0.4), (0.78, 0.9), (0.22, 0.9)], "dark")
    s.rect(0.14, 0.34, 0.86, 0.44, "metal")
    for x, y in ((0.3, 0.2), (0.52, 0.14), (0.7, 0.24)):
        s.ngon(x, y, 0.1, 6, 0, HAZ)
        s.dot(x, y, 0.035, "dark", True)
    s.rect(0.36, 0.56, 0.64, 0.66, "acc", True)


@motif
def dx_modbay(s):
    # a rack with three mod cards slotted in
    s.rect(0.08, 0.08, 0.92, 0.92, "dark")
    for i in range(3):
        x = 0.14 + i * 0.27
        s.rect(x, 0.16, x + 0.2, 0.84, "metal")
        s.rect(x + 0.04, 0.24, x + 0.16, 0.5, SKY)
        s.dot(x + 0.1, 0.7, 0.04, "acc")
        s.line([(x + 0.04, 0.6), (x + 0.16, 0.6)], 0.02, "ink", True)


# ---------------------------------------------------------------------------------------------- tail (slots 8 and 9)
@motif
def dx_vector(s):
    # a rotor with its thrust nozzle angled down, a little flame underneath
    s.ring(0.14, 0.14, 0.86, 0.86, 0.06, "metal")
    s.ngon(0.5, 0.5, 0.2, 6, 0, "dark")
    s.dot(0.5, 0.5, 0.06, RED)
    s.poly([(0.4, 0.7), (0.6, 0.7), (0.5, 0.94)], HAZ, True)
    s.line([(0.5, 0.2), (0.5, 0.04)], 0.04, "glow", True)


@motif
def dx_thrust(s):
    # three stacked thrust bars climbing up, each one brighter
    for i, (w, col) in enumerate(((0.5, "dark"), (0.66, "main"), (0.82, HAZ))):
        y = 0.76 - i * 0.24
        s.rect(0.5 - w / 2, y, 0.5 + w / 2, y + 0.16, col)
        s.rect(0.5 - w / 2, y, 0.5 + w / 2, y + 0.03, "glow", True)
    s.dot(0.5, 0.14, 0.05, MINT, True)


@motif
def dx_depot(s):
    # a small hangar depot: roof, bay door and a crate ready to go
    s.poly([(0.08, 0.44), (0.5, 0.14), (0.92, 0.44)], "metal")
    s.rect(0.14, 0.44, 0.86, 0.9, "dark")
    s.rect(0.32, 0.56, 0.68, 0.9, "ink")
    s.rect(0.36, 0.62, 0.64, 0.7, MINT, True)
    s.rect(0.14, 0.82, 0.3, 0.9, "acc", True)


@motif
def dx_barrage(s):
    # two posting beams fanning out from one launcher
    s.rect(0.36, 0.7, 0.64, 0.92, "metal")
    s.line([(0.5, 0.7), (0.12, 0.2)], 0.06, MINT)
    s.line([(0.5, 0.7), (0.88, 0.2)], 0.06, MINT)
    for x, y in ((0.12, 0.2), (0.88, 0.2)):
        s.ring(x - 0.1, y - 0.1, x + 0.1, y + 0.1, 0.04, "main")
        s.dot(x, y, 0.04, "glow")
    s.dot(0.5, 0.6, 0.05, HAZ)


@motif
def dx_forge(s):
    # an anvil with a rotor blank on it and sparks
    s.poly([(0.14, 0.7), (0.86, 0.7), (0.7, 0.9), (0.3, 0.9)], "dark")
    s.rect(0.22, 0.54, 0.78, 0.7, "metal")
    s.ell(0.3, 0.3, 0.7, 0.56, HAZ)
    s.ring(0.3, 0.3, 0.7, 0.56, 0.04, "main")
    for x, y in ((0.12, 0.2), (0.88, 0.16), (0.8, 0.04)):
        s.dot(x, y, 0.03, HAZ, True)


@motif
def dx_vault(s):
    # a parts vault door with a bolt bar across it
    s.rect(0.1, 0.1, 0.9, 0.9, "dark")
    s.rect(0.16, 0.16, 0.84, 0.84, "metal")
    s.ring(0.3, 0.3, 0.7, 0.7, 0.05, "main")
    s.rect(0.22, 0.46, 0.78, 0.54, "dark")
    s.rect(0.44, 0.44, 0.56, 0.56, SKY)
    s.dot(0.5, 0.5, 0.03, "glow", True)


DRONE_NODES = {
    "dx_core": ("dx_bay", "hangarcore", "l", HAZ),
    "dx_burner": ("dx_burner", "flight", "s", RED),
    "dx_formation": ("dx_formation", "flight", "s", HAZ),
    "dx_night": ("dx_night", "flight", "s", PALE),
    "dx_overdrive": ("dx_overdrive", "flight", "m", HAZ),
    "dx_slipstream": ("dx_slipstream", "flight", "m", SKY),
    "dx_hivemind": ("dx_hivemind", "flight", "l", PALE),
    "dx_orders": ("dx_orders", "dispatch", "s", RED),
    "dx_patrol": ("dx_patrol", "dispatch", "s", HAZ),
    "dx_tour": ("dx_tour", "dispatch", "s", HAZ),
    "dx_fieldops": ("dx_fieldops", "dispatch", "m", HAZ),
    "dx_relay": ("dx_relay", "dispatch", "m", RED),
    "dx_garrison": ("dx_garrison", "dispatch", "l", HAZ),
    "dx_scrap": ("dx_scrap", "salvage", "s", HAZ),
    "dx_refit": ("dx_refit", "salvage", "s", SKY),
    "dx_credit": ("dx_credit", "salvage", "s", MINT),
    "dx_blackbox": ("dx_blackbox", "salvage", "m", "#ff8a2a"),
    "dx_frames": ("dx_frames", "salvage", "m", MINT),
    "dx_foundry": ("dx_foundry", "salvage", "l", HAZ),
    "dx_redline": ("dx_redline", "flight", "s", RED),
    "dx_wingmen": ("dx_wingmen", "flight", "m", HAZ),
    "dx_groundcrew": ("dx_groundcrew", "dispatch", "s", MINT),
    "dx_fullmast": ("dx_fullmast", "dispatch", "m", RED),
    "dx_sparebin": ("dx_sparebin", "salvage", "s", HAZ),
    "dx_modbay": ("dx_modbay", "salvage", "m", SKY),
    "dx_vector": ("dx_vector", "flight", "s", HAZ),
    "dx_thrust": ("dx_thrust", "flight", "m", PALE),
    "dx_depot": ("dx_depot", "dispatch", "s", MINT),
    "dx_barrage": ("dx_barrage", "dispatch", "m", HAZ),
    "dx_forge": ("dx_forge", "salvage", "s", RED),
    "dx_vault": ("dx_vault", "salvage", "m", MINT),
}
