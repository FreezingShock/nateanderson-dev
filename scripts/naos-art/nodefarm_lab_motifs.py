"""Motifs for the Exploit Lab research tree sprites (drawn by nodefarm-tree-sprites.py into the same sheets).

Same rules as nodefarm_tree_motifs.py: a motif draws flat parts in a 0..1 box, the shader adds ramp, outline and shadow.
The lab's section colours are blues (exploits ice blue, malware periwinkle, infra aqua) so the research tree reads as one
blue blueprint, with warm accents kept for the parts that should pop. Every node has its own motif; all art is original.
LAB_NODES maps a sprite key (the research node id) to (motif, section, size, accent).
"""
import math

from nodefarm_tree_motifs import motif

PALE = "#e8f4ff"
WARN = "#ffd65a"
RED = "#ff5a7a"
LIME = "#9dff7a"
AQUA = "#5ff0e8"
NAVY = "#12305e"


def _screen(s, x0=0.1, y0=0.14, x1=0.9, y1=0.72):
    s.rect(x0, y0, x1, y1, "metal")
    s.rect(x0 + 0.06, y0 + 0.06, x1 - 0.06, y1 - 0.06, NAVY)


# ---------------------------------------------------------------------------------------------- exploits
@motif
def rx_sniffer(s):
    # a probe clip biting a wire, with a packet trace
    s.line([(0.06, 0.74), (0.94, 0.74)], 0.08, "metal")
    s.poly([(0.36, 0.2), (0.62, 0.2), (0.6, 0.62), (0.38, 0.62)])
    s.poly([(0.38, 0.62), (0.44, 0.78), (0.5, 0.62)], "dark")
    s.poly([(0.5, 0.62), (0.56, 0.78), (0.6, 0.62)], "dark")
    s.rect(0.44, 0.08, 0.54, 0.22, "acc")
    for i, x in enumerate((0.14, 0.26, 0.74, 0.86)):
        s.rect(x - 0.03, 0.82, x + 0.03, 0.9, "glow", True)


@motif
def rx_worm(s):
    # a segmented worm made of little chips
    pts = [(0.14, 0.72), (0.28, 0.6), (0.42, 0.66), (0.56, 0.54), (0.7, 0.42), (0.82, 0.26)]
    for i, (x, y) in enumerate(pts):
        r = 0.09 if i < 5 else 0.12
        s.rect(x - r, y - r, x + r, y + r, "main" if i % 2 else "acc")
    s.dot(0.8, 0.22, 0.03, "ink", True)
    s.dot(0.86, 0.24, 0.03, "ink", True)


@motif
def rx_logicbomb(s):
    s.ell(0.12, 0.3, 0.76, 0.94, "dark")
    s.ell(0.2, 0.38, 0.52, 0.66, "metal")
    s.rect(0.52, 0.2, 0.7, 0.4, "metal")
    s.arc(0.6, 0.04, 0.92, 0.36, 180, 300, 0.06, "acc")
    s.star(0.84, 0.12, 0.03, 0.1, 5, -90, WARN)
    s.rect(0.3, 0.7, 0.58, 0.8, "acc", True)


@motif
def rx_obfuscate(s):
    # a block of code with scrambled lines and a mask band
    _screen(s, 0.08, 0.1, 0.92, 0.9)
    for i in range(5):
        w = (0.3, 0.55, 0.42, 0.6, 0.36)[i]
        s.rect(0.2, 0.22 + i * 0.12, 0.2 + w, 0.27 + i * 0.12, "main" if i % 2 else "acc", True)
    s.poly([(0.08, 0.5), (0.92, 0.36), (0.92, 0.5), (0.08, 0.64)], "dark")
    s.dot(0.36, 0.52, 0.04, "glow")
    s.dot(0.64, 0.47, 0.04, "glow")


@motif
def rx_ransom(s):
    s.rect(0.14, 0.42, 0.86, 0.9, "acc")
    s.arc(0.28, 0.1, 0.72, 0.62, 180, 360, 0.1, "metal")
    s.line([(0.28, 0.36), (0.28, 0.44)], 0.1, "metal")
    s.line([(0.72, 0.36), (0.72, 0.44)], 0.1, "metal")
    s.ell(0.42, 0.54, 0.58, 0.7, "ink")
    s.rect(0.47, 0.66, 0.53, 0.8, "ink")


@motif
def rx_kernel(s):
    # a chip with a ring-zero mark in its heart
    s.rect(0.2, 0.2, 0.8, 0.8, "dark")
    for i in range(5):
        t = 0.26 + i * 0.12
        for a, b, c, d in ((t, 0.06, t + 0.05, 0.2), (t, 0.8, t + 0.05, 0.94), (0.06, t, 0.2, t + 0.05), (0.8, t, 0.94, t + 0.05)):
            s.rect(a, b, c, d, "metal", True)
    s.rect(0.28, 0.28, 0.72, 0.72)
    s.ring(0.36, 0.36, 0.64, 0.64, 0.07, "glow")
    s.dot(0.5, 0.5, 0.05, "acc")


# ---------------------------------------------------------------------------------------------- malware
@motif
def rx_rootkit(s):
    s.rect(0.06, 0.18, 0.94, 0.36, "metal")
    s.line([(0.5, 0.36), (0.5, 0.62), (0.3, 0.8), (0.24, 0.94)], 0.08, "main")
    s.line([(0.5, 0.56), (0.7, 0.72), (0.78, 0.92)], 0.07, "main")
    s.line([(0.36, 0.72), (0.18, 0.66)], 0.05, "acc")
    s.line([(0.66, 0.68), (0.84, 0.62)], 0.05, "acc")
    s.dot(0.5, 0.27, 0.05, "acc")


@motif
def rx_trojan(s):
    s.rect(0.12, 0.38, 0.88, 0.9, "acc")
    s.rect(0.44, 0.38, 0.56, 0.9, "main")
    s.rect(0.08, 0.3, 0.92, 0.42, "main")
    s.ell(0.26, 0.08, 0.5, 0.32, "main")
    s.ell(0.5, 0.08, 0.74, 0.32, "main")
    s.dot(0.68, 0.64, 0.05, "ink", True)


@motif
def rx_botnet(s):
    pts = [(0.5, 0.2), (0.2, 0.5), (0.8, 0.5), (0.32, 0.84), (0.68, 0.84)]
    for a in range(len(pts)):
        for b in range(a + 1, len(pts)):
            if (a, b) in ((0, 1), (0, 2), (1, 3), (2, 4), (3, 4), (1, 2)):
                s.line([pts[a], pts[b]], 0.04, "dark")
    for i, (x, y) in enumerate(pts):
        r = 0.12 if i == 0 else 0.09
        s.ell(x - r, y - r, x + r, y + r, "acc" if i == 0 else "main")
        s.dot(x, y, 0.03, "glow")


@motif
def rx_mutate(s):
    # a double helix of bits
    for i in range(7):
        t = i / 6
        y = 0.1 + t * 0.8
        a = math.sin(t * math.pi * 2)
        x0, x1 = 0.5 - 0.3 * a, 0.5 + 0.3 * a
        s.line([(x0, y), (x1, y)], 0.04, "dark")
        s.dot(x0, y, 0.07, "main", False)
        s.dot(x1, y, 0.07, "acc", False)


@motif
def rx_zeroclick(s):
    # a cursor that never clicked: pointer with a struck-through ring
    s.ring(0.08, 0.08, 0.92, 0.92, 0.07, "acc")
    s.poly([(0.32, 0.2), (0.32, 0.76), (0.46, 0.62), (0.56, 0.84), (0.66, 0.8), (0.56, 0.58), (0.74, 0.58)], PALE)
    s.line([(0.2, 0.84), (0.84, 0.18)], 0.06, "acc")


@motif
def rx_polymorph(s):
    # three shapes melting into each other
    s.ngon(0.32, 0.36, 0.22, 3, -90, "main")
    s.rect(0.46, 0.18, 0.86, 0.58, "acc")
    s.ell(0.2, 0.46, 0.7, 0.94, AQUA)
    s.ngon(0.5, 0.56, 0.12, 6, 0, "glow")


# ---------------------------------------------------------------------------------------------- infra
@motif
def rx_tap(s):
    s.line([(0.04, 0.5), (0.96, 0.5)], 0.12, "dark")
    s.line([(0.04, 0.5), (0.96, 0.5)], 0.05, "main")
    s.rect(0.36, 0.34, 0.64, 0.66, "metal")
    s.line([(0.5, 0.34), (0.5, 0.06)], 0.08, "acc")
    s.dot(0.5, 0.08, 0.06, "glow")
    s.dot(0.5, 0.5, 0.05, "glow")


@motif
def rx_flags(s):
    s.line([(0.16, 0.92), (0.16, 0.08)], 0.07, "metal")
    s.poly([(0.2, 0.1), (0.86, 0.18), (0.68, 0.32), (0.86, 0.46), (0.2, 0.42)], "acc")
    s.rect(0.32, 0.6, 0.86, 0.88, NAVY)
    s.line([(0.38, 0.68), (0.46, 0.74), (0.38, 0.8)], 0.04, "glow")
    s.rect(0.52, 0.78, 0.7, 0.81, "glow", True)


@motif
def rx_crashlog(s):
    s.poly([(0.16, 0.06), (0.66, 0.06), (0.86, 0.26), (0.86, 0.94), (0.16, 0.94)], PALE)
    s.poly([(0.66, 0.06), (0.66, 0.26), (0.86, 0.26)], "metal")
    for i in range(4):
        s.rect(0.26, 0.36 + i * 0.12, 0.26 + (0.5, 0.36, 0.44, 0.28)[i], 0.4 + i * 0.12, "dark", True)
    s.star(0.66, 0.74, 0.06, 0.16, 6, -90, RED)


@motif
def rx_socket(s):
    s.rect(0.08, 0.2, 0.92, 0.8, "metal")
    for x in (0.18, 0.56):
        s.rect(x, 0.32, x + 0.26, 0.68, "dark")
        for j in range(3):
            s.rect(x + 0.04 + j * 0.07, 0.42, x + 0.07 + j * 0.07, 0.58, "acc", True)
    s.rect(0.56, 0.32, 0.82, 0.68, "main")


@motif
def rx_cron(s):
    s.ell(0.08, 0.08, 0.92, 0.92, "metal")
    s.ell(0.16, 0.16, 0.84, 0.84, NAVY)
    for i in range(12):
        a = math.radians(i * 30)
        s.dot(0.5 + 0.28 * math.cos(a), 0.5 + 0.28 * math.sin(a), 0.025, "main", True)
    s.line([(0.5, 0.5), (0.5, 0.24)], 0.06, "glow")
    s.line([(0.5, 0.5), (0.68, 0.58)], 0.06, "acc")
    s.arc(0.02, 0.02, 0.98, 0.98, 300, 350, 0.06, "acc")


@motif
def rx_rootshell(s):
    _screen(s, 0.06, 0.12, 0.94, 0.86)
    s.line([(0.2, 0.32), (0.34, 0.44), (0.2, 0.56)], 0.06, "acc")
    # a hash: two bars each way
    for x in (0.48, 0.62):
        s.line([(x + 0.03, 0.3), (x - 0.03, 0.62)], 0.045, "glow")
    for y in (0.4, 0.52):
        s.line([(0.4, y), (0.74, y)], 0.045, "glow")
    s.rect(0.2, 0.68, 0.36, 0.73, "main", True)


@motif
def rx_corelab(s):
    # the lab's core: a terminal cube with a blinking prompt, ringed by a blueprint compass
    s.ring(0.04, 0.04, 0.96, 0.96, 0.04, "main")
    s.poly([(0.5, 0.14), (0.84, 0.32), (0.5, 0.5), (0.16, 0.32)], PALE)
    s.poly([(0.16, 0.32), (0.5, 0.5), (0.5, 0.88), (0.16, 0.7)], "metal")
    s.poly([(0.84, 0.32), (0.5, 0.5), (0.5, 0.88), (0.84, 0.7)], "main")
    s.line([(0.58, 0.58), (0.66, 0.64), (0.58, 0.7)], 0.04, "glow")
    s.rect(0.68, 0.68, 0.76, 0.71, "acc", True)


LAB_NODES = {
    "rx_core": ("rx_corelab", "labcore", "l", WARN),
    "rx_sniffer": ("rx_sniffer", "exploits", "s", WARN),
    "rx_worm": ("rx_worm", "exploits", "s", LIME),
    "rx_logicbomb": ("rx_logicbomb", "exploits", "s", RED),
    "rx_obfuscate": ("rx_obfuscate", "exploits", "m", PALE),
    "rx_ransom": ("rx_ransom", "exploits", "s", WARN),
    "rx_kernel": ("rx_kernel", "exploits", "l", RED),
    "rx_rootkit": ("rx_rootkit", "malware", "s", LIME),
    "rx_trojan": ("rx_trojan", "malware", "s", WARN),
    "rx_botnet": ("rx_botnet", "malware", "s", RED),
    "rx_mutate": ("rx_mutate", "malware", "m", LIME),
    "rx_zeroclick": ("rx_zeroclick", "malware", "s", RED),
    "rx_polymorph": ("rx_polymorph", "malware", "l", WARN),
    "rx_tap": ("rx_tap", "infra", "s", WARN),
    "rx_flags": ("rx_flags", "infra", "s", WARN),
    "rx_crashlog": ("rx_crashlog", "infra", "s", PALE),
    "rx_socket": ("rx_socket", "infra", "m", LIME),
    "rx_cron": ("rx_cron", "infra", "m", WARN),
    "rx_rootshell": ("rx_rootshell", "infra", "l", LIME),
}
