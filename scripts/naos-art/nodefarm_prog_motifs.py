"""Motifs for the capstone and doctrine sprites (2026-11-17): five prestige capstones and three Exploit Lab doctrines.

Same rules as nodefarm_tree_motifs.py: a motif draws flat parts in a 0..1 box, the shader adds ramp, outline and shadow.
PROG_NODES maps a sprite key to (motif, section, size, accent). Appended last in nodefarm-tree-sprites.py so older rows never move.
"""
from nodefarm_tree_motifs import motif, CYAN, GOLD, MINT, HOT, VOID, FIRE, ICE
from nodefarm_lab_motifs import PALE, WARN, LIME, AQUA, NAVY


# ---------------------------------------------------------------------------------------------- prestige capstones
@motif
def synclock(s):
    # a clock whose tick marks are small zones
    s.ring(0.1, 0.1, 0.9, 0.9, 0.1, "metal")
    s.ell(0.2, 0.2, 0.8, 0.8, NAVY)
    s.line([(0.5, 0.5), (0.5, 0.26)], 0.07, "main")
    s.line([(0.5, 0.5), (0.68, 0.58)], 0.06, "acc")
    for x, y in [(0.5, 0.15), (0.85, 0.5), (0.5, 0.85), (0.15, 0.5)]:
        s.dot(x, y, 0.045)
    s.dot(0.5, 0.5, 0.06, "metal")


@motif
def foundry(s):
    # a crucible pouring into a mould
    s.poly([(0.12, 0.14), (0.62, 0.14), (0.56, 0.5), (0.2, 0.5)], "metal")
    s.rect(0.1, 0.1, 0.64, 0.18, "main")
    s.line([(0.56, 0.5), (0.56, 0.7)], 0.07, "acc")
    s.poly([(0.3, 0.7), (0.9, 0.7), (0.84, 0.9), (0.36, 0.9)], "main")
    s.rect(0.4, 0.74, 0.8, 0.8, "acc", True)
    s.dot(0.36, 0.32, 0.05)


@motif
def loadtest(s):
    # a gauge with the needle in the red, on a weight stack
    s.arc(0.08, 0.1, 0.92, 0.94, 180, 360, 0.12, "metal")
    s.arc(0.08, 0.1, 0.92, 0.94, 300, 360, 0.12, "acc")
    s.line([(0.5, 0.54), (0.74, 0.3)], 0.07, "main")
    s.dot(0.5, 0.54, 0.07, "metal")
    s.rect(0.22, 0.66, 0.78, 0.76, "main")
    s.rect(0.3, 0.78, 0.7, 0.88, "metal")


@motif
def hangarlink(s):
    # a Drone on a cable
    s.line([(0.5, 0.62), (0.5, 0.96)], 0.05, "metal")
    s.ell(0.3, 0.4, 0.7, 0.66, "main")
    s.line([(0.32, 0.46), (0.1, 0.3)], 0.05, "metal")
    s.line([(0.68, 0.46), (0.9, 0.3)], 0.05, "metal")
    s.ell(0.0, 0.2, 0.28, 0.3, "acc")
    s.ell(0.72, 0.2, 1.0, 0.3, "acc")
    s.dot(0.5, 0.53, 0.06)


@motif
def horizon(s):
    # an accretion disc round a dark centre
    s.ell(0.04, 0.34, 0.96, 0.66, "acc")
    s.ell(0.3, 0.3, 0.7, 0.7, NAVY)
    s.arc(0.12, 0.12, 0.88, 0.88, 200, 340, 0.08, "main")
    s.arc(0.12, 0.12, 0.88, 0.88, 20, 160, 0.05, "glow")
    s.dot(0.5, 0.5, 0.05, "metal")


# ---------------------------------------------------------------------------------------------- lab doctrines
@motif
def rx_livefire(s):
    # a flame inside a targeting bracket
    s.poly([(0.5, 0.1), (0.7, 0.4), (0.66, 0.74), (0.5, 0.88), (0.34, 0.74), (0.3, 0.4)], "acc")
    s.poly([(0.5, 0.36), (0.6, 0.6), (0.5, 0.78), (0.4, 0.6)], WARN)
    for x0, y0, x1, y1 in [(0.06, 0.06, 0.2, 0.2), (0.8, 0.06, 0.94, 0.2), (0.06, 0.8, 0.2, 0.94), (0.8, 0.8, 0.94, 0.94)]:
        s.rect(x0, y0, x1, y1, "metal")


@motif
def rx_botfarm(s):
    # three little bots in a row, one antenna each
    for i, x in enumerate((0.04, 0.37, 0.7)):
        s.rect(x, 0.42, x + 0.26, 0.78, "main" if i != 1 else "acc")
        s.rect(x + 0.05, 0.5, x + 0.21, 0.6, NAVY)
        s.dot(x + 0.09, 0.55, 0.025)
        s.dot(x + 0.17, 0.55, 0.025)
        s.line([(x + 0.13, 0.42), (x + 0.13, 0.28)], 0.04, "metal")
        s.dot(x + 0.13, 0.26, 0.04, "glow")
    s.rect(0.04, 0.82, 0.96, 0.9, "metal")


@motif
def rx_hotdeploy(s):
    # an arrow leaving a rack on its own
    s.rect(0.14, 0.58, 0.86, 0.92, "metal")
    s.rect(0.22, 0.66, 0.78, 0.72, NAVY)
    s.rect(0.22, 0.78, 0.78, 0.84, NAVY)
    s.dot(0.7, 0.69, 0.03, "glow")
    s.dot(0.7, 0.81, 0.03, "glow")
    s.poly([(0.5, 0.06), (0.74, 0.34), (0.58, 0.34), (0.58, 0.52), (0.42, 0.52), (0.42, 0.34), (0.26, 0.34)], "acc")


PROG_NODES = {
    "synclock": ("synclock", "signal", "l", CYAN),
    "foundry": ("foundry", "forge", "l", FIRE),
    "loadtest": ("loadtest", "systems", "l", HOT),
    "hangarlink": ("hangarlink", "drones", "l", GOLD),
    "horizon": ("horizon", "anomaly", "l", VOID),
    "rx_livefire": ("rx_livefire", "exploits", "l", WARN),
    "rx_botfarm": ("rx_botfarm", "malware", "l", LIME),
    "rx_hotdeploy": ("rx_hotdeploy", "infra", "l", AQUA),
}
