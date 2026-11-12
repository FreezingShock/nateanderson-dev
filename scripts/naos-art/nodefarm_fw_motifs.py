"""Motifs for the Handover Firmware tree sprites (drawn by nodefarm-tree-sprites.py into the same sheets).

Same rules as nodefarm_tree_motifs.py: a motif draws flat parts in a 0..1 box, the shader adds ramp, outline and shadow.
The Firmware tree is the green phosphor skin: Boot is phosphor green, Memory is amber (old tape and core memory), Relay is
a pale cyan. Every node has its own motif; all art is original. FW_NODES maps a sprite key (the Firmware node id) to
(motif, section, size, accent).
"""
import math

from nodefarm_tree_motifs import motif

PHOS = "#3dff6e"
AMBER = "#ffc53a"
PALE = "#e8fff0"
RED = "#ff5a5a"
CYAN = "#64e6ff"
DEEP = "#08200f"


def _crt(s, x0=0.1, y0=0.12, x1=0.9, y1=0.74):
    s.rect(x0, y0, x1, y1, "metal")
    s.rect(x0 + 0.06, y0 + 0.06, x1 - 0.06, y1 - 0.06, DEEP)


# ---------------------------------------------------------------------------------------------- boot
@motif
def fw_warm(s):
    # a rack fan with warm air lines coming off it
    s.rect(0.12, 0.16, 0.72, 0.84, "metal")
    s.ell(0.18, 0.24, 0.66, 0.76, DEEP)
    for i in range(4):
        a = math.radians(i * 90 + 20)
        s.line([(0.42, 0.5), (0.42 + 0.2 * math.cos(a), 0.5 + 0.2 * math.sin(a))], 0.08, "main")
    s.dot(0.42, 0.5, 0.05, "acc", False)
    for y in (0.3, 0.5, 0.7):
        s.line([(0.78, y), (0.86, y - 0.05), (0.92, y)], 0.04, "acc", True)


@motif
def fw_preinstall(s):
    # a shipping box with a sealed lid and three tools poking out
    s.poly([(0.12, 0.44), (0.88, 0.44), (0.84, 0.9), (0.16, 0.9)], "metal")
    s.rect(0.12, 0.4, 0.88, 0.5, "dark")
    s.line([(0.32, 0.42), (0.26, 0.12)], 0.08, "main")
    s.line([(0.5, 0.42), (0.52, 0.08)], 0.08, "acc")
    s.line([(0.68, 0.42), (0.76, 0.16)], 0.08, "main")
    s.rect(0.42, 0.6, 0.58, 0.74, "acc", True)


@motif
def fw_afterglow(s):
    # a CRT that still glows after the power is off: a fading dot in the middle
    _crt(s, 0.1, 0.14, 0.9, 0.8)
    s.ell(0.3, 0.3, 0.7, 0.64, "#145a26")
    s.ell(0.4, 0.38, 0.6, 0.56, "main")
    s.dot(0.5, 0.47, 0.04, "glow")
    s.rect(0.36, 0.8, 0.64, 0.88, "dark")


@motif
def fw_bootloader(s):
    # a stack of four material chips on a loader tray with an arrow up
    s.rect(0.1, 0.78, 0.9, 0.88, "metal")
    cols = ("#f08a3c", "#7aa2ff", "#e08cff", "#6bffc9")
    for i, c in enumerate(cols):
        x = 0.14 + i * 0.19
        s.rect(x, 0.5, x + 0.15, 0.74, c)
    s.poly([(0.5, 0.08), (0.72, 0.34), (0.58, 0.34), (0.58, 0.44), (0.42, 0.44), (0.42, 0.34), (0.28, 0.34)], "main")


@motif
def fw_fastpath(s):
    # a short cable cutting across a long coiled one
    s.ring(0.14, 0.14, 0.86, 0.86, 0.06, "metal")
    s.ring(0.28, 0.28, 0.72, 0.72, 0.05, "dark")
    s.line([(0.08, 0.84), (0.92, 0.16)], 0.12, "main")
    s.rect(0.04, 0.78, 0.18, 0.92, "acc")
    s.rect(0.82, 0.08, 0.96, 0.22, "acc")


@motif
def fw_shortfuse(s):
    # a stubby fuse with a big spark, about to go
    s.rect(0.22, 0.46, 0.78, 0.86, "metal")
    s.rect(0.3, 0.54, 0.7, 0.78, "main")
    s.line([(0.5, 0.46), (0.5, 0.34), (0.6, 0.26)], 0.06, "dark")
    s.star(0.66, 0.2, 0.05, 0.16, 6, -90, "acc")
    s.dot(0.66, 0.2, 0.04, "glow")
    for x in (0.36, 0.5, 0.64):
        s.rect(x - 0.02, 0.6, x + 0.02, 0.72, "glow", True)


# ---------------------------------------------------------------------------------------------- memory
@motif
def fw_imprint(s):
    # a stamp pressing a five-dot mark onto a plate
    s.rect(0.1, 0.72, 0.9, 0.88, "metal")
    for i in range(5):
        s.dot(0.2 + i * 0.15, 0.8, 0.04, "acc", False)
    s.rect(0.34, 0.12, 0.66, 0.24, "dark")
    s.rect(0.44, 0.24, 0.56, 0.46, "metal")
    s.rect(0.24, 0.46, 0.76, 0.62, "main")


@motif
def fw_perkcache(s):
    # a case lid open with a taped settings card inside
    s.poly([(0.12, 0.3), (0.88, 0.3), (0.84, 0.88), (0.16, 0.88)], "dark")
    s.rect(0.24, 0.4, 0.76, 0.8, PALE)
    for i in range(3):
        s.rect(0.3, 0.48 + i * 0.1, 0.3 + (0.36, 0.28, 0.4)[i], 0.52 + i * 0.1, "main", True)
    s.rect(0.2, 0.36, 0.38, 0.44, "acc")
    s.rect(0.62, 0.36, 0.8, 0.44, "acc")
    s.rect(0.12, 0.12, 0.88, 0.26, "metal")


@motif
def fw_labimage(s):
    # a disk image: a floppy with a little flask on the label
    s.poly([(0.12, 0.1), (0.78, 0.1), (0.9, 0.22), (0.9, 0.9), (0.12, 0.9)], "main")
    s.rect(0.28, 0.1, 0.68, 0.34, "metal")
    s.rect(0.54, 0.14, 0.62, 0.3, "dark")
    s.rect(0.22, 0.48, 0.8, 0.84, PALE)
    s.poly([(0.46, 0.54), (0.56, 0.54), (0.56, 0.62), (0.64, 0.78), (0.38, 0.78), (0.46, 0.62)], "acc")


@motif
def fw_deepimprint(s):
    # three footprints climbing a path, the last one glowing
    s.line([(0.14, 0.86), (0.38, 0.6), (0.6, 0.44), (0.86, 0.14)], 0.1, "dark")
    for i, (x, y) in enumerate(((0.24, 0.74), (0.48, 0.52), (0.72, 0.3))):
        s.ell(x - 0.09, y - 0.07, x + 0.09, y + 0.07, "main" if i < 2 else "acc")
        s.dot(x + 0.06, y - 0.1, 0.03, "main" if i < 2 else "glow", False)


@motif
def fw_droneram(s):
    # a little drone carrying a memory stick
    s.rect(0.24, 0.3, 0.76, 0.52, "metal")
    s.line([(0.1, 0.24), (0.34, 0.3)], 0.06, "dark")
    s.line([(0.9, 0.24), (0.66, 0.3)], 0.06, "dark")
    s.ell(0.02, 0.16, 0.22, 0.26, "main")
    s.ell(0.78, 0.16, 0.98, 0.26, "main")
    s.dot(0.5, 0.41, 0.05, "acc", False)
    s.rect(0.36, 0.6, 0.64, 0.88, "acc")
    for x in (0.42, 0.5, 0.58):
        s.rect(x - 0.02, 0.62, x + 0.02, 0.7, "glow", True)


@motif
def fw_tape(s):
    # a reel-to-reel tape with a handwritten label
    s.rect(0.06, 0.18, 0.94, 0.82, "metal")
    s.ell(0.14, 0.26, 0.46, 0.58, "dark")
    s.ell(0.54, 0.26, 0.86, 0.58, "dark")
    s.ring(0.18, 0.3, 0.42, 0.54, 0.05, "main")
    s.ring(0.58, 0.3, 0.82, 0.54, 0.05, "main")
    s.line([(0.3, 0.56), (0.5, 0.62), (0.7, 0.56)], 0.03, "ink")
    s.rect(0.22, 0.66, 0.78, 0.78, PALE)
    s.line([(0.28, 0.72), (0.4, 0.7), (0.52, 0.73), (0.66, 0.7)], 0.025, "acc", True)


# ---------------------------------------------------------------------------------------------- relay
@motif
def fw_keysmith(s):
    # a key with a second key hanging off the ring
    s.ring(0.08, 0.08, 0.4, 0.4, 0.08, "acc")
    s.line([(0.34, 0.34), (0.82, 0.82)], 0.1, "main")
    s.line([(0.64, 0.64), (0.74, 0.54)], 0.08, "main")
    s.line([(0.74, 0.74), (0.84, 0.64)], 0.08, "main")
    s.line([(0.24, 0.4), (0.22, 0.78)], 0.07, "metal")
    s.rect(0.16, 0.74, 0.3, 0.9, "metal")


@motif
def fw_desk(s):
    # a desk lamp over a chair back
    s.rect(0.1, 0.78, 0.9, 0.86, "metal")
    s.line([(0.24, 0.78), (0.24, 0.5), (0.46, 0.3)], 0.06, "dark")
    s.poly([(0.4, 0.2), (0.62, 0.14), (0.64, 0.36)], "acc")
    s.dot(0.58, 0.32, 0.04, "glow")
    s.rect(0.6, 0.42, 0.8, 0.78, "main")
    s.rect(0.56, 0.4, 0.84, 0.48, "main")


@motif
def fw_standby(s):
    # a power symbol with a slow pulse beside it
    s.arc(0.12, 0.16, 0.72, 0.76, 300, 600, 0.1, "main")
    s.line([(0.42, 0.1), (0.42, 0.44)], 0.1, "acc")
    s.line([(0.62, 0.84), (0.72, 0.84), (0.77, 0.72), (0.83, 0.92), (0.88, 0.84), (0.94, 0.84)], 0.04, "acc", True)


@motif
def fw_dual(s):
    # two terminals side by side sharing one cable
    for x0 in (0.06, 0.52):
        s.rect(x0, 0.14, x0 + 0.42, 0.56, "metal")
        s.rect(x0 + 0.05, 0.19, x0 + 0.37, 0.51, DEEP)
    s.line([(0.14, 0.3), (0.22, 0.36), (0.14, 0.42)], 0.04, "main", True)
    s.line([(0.6, 0.3), (0.68, 0.36), (0.6, 0.42)], 0.04, "acc", True)
    s.line([(0.27, 0.56), (0.27, 0.74), (0.73, 0.74), (0.73, 0.56)], 0.06, "dark")
    s.line([(0.5, 0.74), (0.5, 0.92)], 0.07, "main")


@motif
def fw_rootpath(s):
    # stairs going down to a single small box with one wire
    for i in range(4):
        x = 0.08 + i * 0.16
        s.rect(x, 0.2 + i * 0.14, x + 0.2, 0.3 + i * 0.14, "metal")
    s.rect(0.66, 0.68, 0.88, 0.88, "main")
    s.dot(0.77, 0.78, 0.03, "glow")
    s.line([(0.88, 0.78), (0.96, 0.78), (0.96, 0.4)], 0.04, "acc", True)


@motif
def fw_lineage(s):
    # five small operator marks rising into one bright node, like a family tree
    s.ngon(0.5, 0.2, 0.13, 4, 45, "acc")
    s.dot(0.5, 0.2, 0.04, "glow")
    pts = [(0.1, 0.82), (0.3, 0.86), (0.5, 0.88), (0.7, 0.86), (0.9, 0.82)]
    cols = ("#b6f04a", "#2fd8e8", "#f08a3c", "#ffc53a", "main")
    for (x, y), c in zip(pts, cols):
        s.line([(x, y), (0.5, 0.3)], 0.035, "dark", True)
    for (x, y), c in zip(pts, cols):
        s.rect(x - 0.06, y - 0.06, x + 0.06, y + 0.06, c)
    s.ring(0.3, 0.02, 0.7, 0.38, 0.03, "main", True)


@motif
def fw_corebox(s):
    # node zero: one small box, one wire, a green prompt
    s.ring(0.04, 0.04, 0.96, 0.96, 0.04, "main")
    s.poly([(0.5, 0.2), (0.8, 0.34), (0.5, 0.48), (0.2, 0.34)], PALE)
    s.poly([(0.2, 0.34), (0.5, 0.48), (0.5, 0.8), (0.2, 0.66)], "metal")
    s.poly([(0.8, 0.34), (0.5, 0.48), (0.5, 0.8), (0.8, 0.66)], "main")
    s.line([(0.57, 0.58), (0.64, 0.62), (0.57, 0.66)], 0.035, "glow")
    s.line([(0.5, 0.8), (0.5, 0.9), (0.78, 0.9)], 0.04, "acc")


FW_NODES = {
    "fw_core": ("fw_corebox", "fwcore", "l", AMBER),
    "fw_warm": ("fw_warm", "boot", "s", AMBER),
    "fw_preinstall": ("fw_preinstall", "boot", "s", AMBER),
    "fw_afterglow": ("fw_afterglow", "boot", "s", PALE),
    "fw_bootloader": ("fw_bootloader", "boot", "m", AMBER),
    "fw_fastpath": ("fw_fastpath", "boot", "m", CYAN),
    "fw_shortfuse": ("fw_shortfuse", "boot", "l", RED),
    "fw_imprint": ("fw_imprint", "memory", "s", PHOS),
    "fw_perkcache": ("fw_perkcache", "memory", "s", PHOS),
    "fw_labimage": ("fw_labimage", "memory", "s", "#4aa3ff"),
    "fw_deepimprint": ("fw_deepimprint", "memory", "m", PHOS),
    "fw_droneram": ("fw_droneram", "memory", "m", RED),
    "fw_tape": ("fw_tape", "memory", "l", RED),
    "fw_keysmith": ("fw_keysmith", "relay", "s", AMBER),
    "fw_desk": ("fw_desk", "relay", "s", AMBER),
    "fw_standby": ("fw_standby", "relay", "s", PHOS),
    "fw_dual": ("fw_dual", "relay", "m", AMBER),
    "fw_rootpath": ("fw_rootpath", "relay", "m", PHOS),
    "fw_lineage": ("fw_lineage", "relay", "l", AMBER),
}
