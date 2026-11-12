"""Node Farm Drones at 64 px: six distinct frames, eight animation frames each, on the 64 px icon kit.

Run:  python3 scripts/naos-art/nodefarm-drones64.py            (writes the sheet)
      python3 scripts/naos-art/nodefarm-drones64.py --sample   (also a 4x contact sheet in /tmp/nf-drones64.png)
Output: public/naos/nodefarm/drones.{png,webp}, 6 tiers across, 8 frames down (384 x 512). CSS steps the frames down the
sheet (`.nf-sp-d`, `nfDroneFrame` in app/camino/nodefarm.css). Then run scripts/nodefarm/stamp-art.mjs.

Each tier is its own machine, not the same hull with parts added:
  T1 Probe      cyan scout pod under one top rotor, a scanning lens and a feeler antenna
  T2 Courier    lime quadcopter with a cargo crate on a winch line that sways
  T3 Sweeper    wide copper hull on two side rotors, sweeping a scan fan over the ground
  T4 Warden     armoured blue hexagon with four ducted fans and a shield ring that turns
  T5 Cascade    violet tandem twin-rotor with a crystal core that throws off sparks
  T6 Sovereign  gold crowned hull, four rotors, a halo and a down beam that pulses
Everything is drawn per frame from a phase p in [0, 1): rotors spin, hulls bob, lights travel. All art is original.
"""
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from nodefarm_icon_kit import (FRAMES, N, P, X, Y, Canvas, angle, contact, disc, hexagon, lin, line, orb, path, poly, radial,  # noqa: E402
                               rect, ring, rotp, save_pair, shadow, star4, to_image, wave)

OUT = HERE.parents[1] / "public" / "naos" / "nodefarm"
PALS = ["cyan", "lime", "cu", "si", "qz", "rn"]


def rotor(c, cx, cy, r, p, pal, spin=1.0, ry=0.32, phase=0.0):
    """A rotor seen from slightly above: a faint dithered disc of blur, two blades at the current angle, a hub."""
    blur = disc(cx, cy, r, r * ry) & ~disc(cx, cy, r * 0.25, r * ry * 0.25)
    thin = blur & (((np.floor(X) + np.floor(Y)) % 3) == 0) & ~c.alpha
    c.img[thin] = (*P[pal][-2], 110)
    a = 2 * math.pi * (p * spin * 2 + phase)
    for k in (0, math.pi):
        ex, ey = cx + r * math.cos(a + k), cy + r * ry * math.sin(a + k)
        c.set(line(cx, cy, ex, ey, 1.6), P["steel"][5])
        c.set(line(cx + 0.4 * (ex - cx), cy + 0.4 * (ey - cy), ex, ey, 1.0), P["white"][2])
    c.fill(disc(cx, cy, 1.8, 1.2), 0.8, "steel")


def strut(c, x0, y0, x1, y1):
    c.fill(line(x0, y0, x1, y1, 2.2), 0.55, "steel")
    c.set(line(x0, y0 - 0.6, x1, y1 - 0.6, 0.8), P["steel"][5])


def lens(c, cx, cy, r, p, pal, look=True):
    """A lens with an iris that looks left and right."""
    c.fill(disc(cx, cy, r), 0.15, "ink")
    off = (math.sin(2 * math.pi * p) * r * 0.35) if look else 0
    c.fill(disc(cx + off, cy, r * 0.62), 0.55 + 0.4 * (1 - radial(cx + off - 1, cy - 1, r)), pal)
    c.set(disc(cx + off - r * 0.25, cy - r * 0.3, max(0.7, r * 0.2)), P["white"][2])


def probe(c, p):
    pal = "cyan"
    dy = round(1.6 * math.sin(2 * math.pi * p))
    cx, cy = 32, 32 + dy
    shadow(c, 32, 9 - dy * 0.5, 58)
    # mast and rotor
    c.fill(rect(31, cy - 15, 33, cy - 8), 0.6, "steel")
    rotor(c, 32, cy - 15, 15, p, pal)
    # pod
    pod = disc(cx, cy, 11, 10)
    orb(c, cx, cy, 11, pal, -0.05)
    c.fill(pod & (Y > cy + 3), 0.25, pal)
    c.set(rect(cx - 10, cy + 3, cx + 10, cy + 4) & pod, P[pal][1])
    c.outline(pod, pal)
    lens(c, cx, cy - 1, 4.5, p, pal)
    # feeler antenna, tip blinks
    c.set(path([(cx + 8, cy - 6), (cx + 13, cy - 12), (cx + 15, cy - 12)], 1.0), P["steel"][4])
    c.set(disc(cx + 16, cy - 12, 1.4), P[pal][6] if (p * 4) % 1 < 0.5 else P[pal][3])
    # scan line under the pod
    sw = (p * 2) % 1
    c.set(line(cx - 6 + sw * 12, cy + 11, cx - 6 + sw * 12, cy + 17, 1.0) & ~c.alpha, P[pal][5], 170)


def courier(c, p):
    pal = "lime"
    dy = round(1.4 * math.sin(2 * math.pi * p + 1))
    cx, cy = 32, 22 + dy
    shadow(c, 32, 12, 59)
    for sx in (-1, 1):
        strut(c, cx + sx * 5, cy, cx + sx * 15, cy - 4)
        rotor(c, cx + sx * 16, cy - 6, 8, p, pal, phase=0.25 * sx)
    body = poly([(cx - 9, cy - 4), (cx + 9, cy - 4), (cx + 11, cy + 3), (cx - 11, cy + 3)])
    c.fill(body, 0.4 + 0.5 * (1 - lin(cx - 9, cy - 5, cx + 9, cy + 4)), pal, outline=pal)
    c.set(rect(cx - 8, cy - 4, cx + 8, cy - 3), P[pal][6])
    lens(c, cx, cy - 0.5, 2.6, p, pal)
    # winch line and swaying crate
    sway = 3.0 * math.sin(2 * math.pi * p)
    bx, by = cx + sway, cy + 20
    c.set(line(cx, cy + 3, bx, by - 6, 1.0), P["steel"][4])
    crate = rotp([(bx - 7, by - 6), (bx + 7, by - 6), (bx + 7, by + 6), (bx - 7, by + 6)], math.radians(sway * 3), bx, by)
    cm = poly(crate)
    c.fill(cm, 0.35 + 0.45 * (1 - lin(bx - 7, by - 6, bx + 7, by + 6)), "rn", outline="rn")
    c.set(line(crate[0][0], crate[0][1], crate[2][0], crate[2][1], 1.0) & cm, P["rn"][2])
    c.set(line(crate[1][0], crate[1][1], crate[3][0], crate[3][1], 1.0) & cm, P["rn"][2])
    c.set(disc(bx, by, 1.5) & cm, P["lime"][6])


def sweeper(c, p):
    pal = "cu"
    dy = round(1.2 * math.sin(2 * math.pi * p + 2))
    cx, cy = 32, 26 + dy
    # scan fan on the ground, sweeping left to right and back
    t = wave(p)
    fx = 14 + t * 36
    fan = poly([(cx - 4, cy + 6), (cx + 4, cy + 6), (fx + 6, 58), (fx - 6, 58)])
    thin = fan & (((np.floor(X) + np.floor(Y) * 2) % 3) == 0) & ~c.alpha
    c.img[thin] = (*P["molten"][4], 120)
    c.set(rect(fx - 6, 57, fx + 6, 59), P["molten"][4])
    for sx in (-1, 1):
        strut(c, cx + sx * 10, cy - 1, cx + sx * 20, cy - 5)
        rotor(c, cx + sx * 21, cy - 7, 9, p, pal, phase=0.5 if sx > 0 else 0)
    hull = poly([(cx - 15, cy - 3), (cx - 9, cy - 7), (cx + 9, cy - 7), (cx + 15, cy - 3), (cx + 12, cy + 6), (cx - 12, cy + 6)])
    c.fill(hull, 0.35 + 0.55 * (1 - lin(cx - 15, cy - 7, cx + 15, cy + 6)), pal, outline=pal)
    c.fill(hull & (Y > cy + 2), 0.3, "patina")
    # brush arms
    for sx in (-1, 1):
        c.set(line(cx + sx * 9, cy + 5, cx + sx * 13, cy + 10, 1.4), P["steel"][4])
        for k in range(3):
            c.set(rect(cx + sx * 13 - 1 + k * sx, cy + 10, cx + sx * 13 + k * sx, cy + 12), P["rn"][5])
    # light bar travelling across the front
    for i in range(6):
        on = int(p * 6) % 6 == i
        c.set(rect(cx - 9 + i * 3, cy - 2, cx - 7 + i * 3, cy), P["molten"][5] if on else P[pal][2])


def warden(c, p):
    pal = "si"
    dy = round(1.0 * math.sin(2 * math.pi * p + 3))
    cx, cy = 32, 32 + dy
    shadow(c, 32, 14, 59)
    # shield ring turning around the hull (back half first)
    a = angle(cx, cy)
    sh = ring(cx, cy, 22, 20.4, 0.42)
    seg = ((a + p) * 8) % 1 < 0.6
    back = sh & (Y < cy) & seg
    c.set(back, P["sky"][3], 200)
    # ducted fans on four corners
    for sx, sy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        fx, fy = cx + sx * 15, cy + sy * 9
        c.fill(ring(fx, fy, 6, 4.4, 0.5), 0.5, "steel")
        rotor(c, fx, fy, 4.4, p, pal, spin=1.5, ry=0.45, phase=(sx + sy) * 0.13)
    hexm = hexagon(cx, cy, 11, squash=0.9)
    c.fill(hexm, 0.3 + 0.6 * (1 - lin(cx - 11, cy - 11, cx + 11, cy + 11)), pal, outline=pal)
    inner = hexagon(cx, cy, 7, squash=0.9)
    c.fill(inner, 0.2, "deep")
    lens(c, cx, cy, 4, p, "sky")
    # rivets
    for k in range(6):
        ang = math.pi / 3 * k
        c.set(disc(cx + 9 * math.cos(ang), cy + 8.1 * math.sin(ang), 0.8), P[pal][7])
    front = sh & (Y >= cy) & seg & ~hexm
    c.set(front, P["sky"][4])


def cascade(c, p):
    pal = "qz"
    dy = round(1.5 * math.sin(2 * math.pi * p + 4))
    cx, cy = 32, 32 + dy
    shadow(c, 32, 13, 59)
    # tandem frame
    c.fill(rect(cx - 18, cy - 2, cx + 18, cy + 2), 0.5, "steel")
    for sx in (-1, 1):
        c.fill(rect(cx + sx * 18 - 1, cy - 12, cx + sx * 18 + 1, cy), 0.6, "steel")
        rotor(c, cx + sx * 18, cy - 13, 11, p, pal, spin=1.0 if sx < 0 else -1.0)
        pod = disc(cx + sx * 18, cy + 2, 5, 4)
        c.fill(pod, 0.35 + 0.5 * (1 - lin(cx + sx * 18 - 5, cy - 2, cx + sx * 18 + 5, cy + 6)), pal, outline=pal)
    # crystal core with a pulsing glow
    core = poly([(cx, cy - 13), (cx + 7, cy - 2), (cx, cy + 12), (cx - 7, cy - 2)])
    glow = 0.5 + 0.5 * wave(p, 2)
    c.glow(core, P["qz"][6], r=3, a=int(80 + 80 * glow))
    c.fill(core, 0.45 + 0.5 * (1 - lin(cx - 7, cy - 13, cx + 7, cy + 12)), "qz", outline="qz")
    c.set(poly([(cx, cy - 13), (cx + 2, cy - 2), (cx, cy + 12), (cx - 2, cy - 2)]), P["rose"][4] if glow > 0.6 else P["qz"][6])
    # sparks falling in a cascade
    for i in range(4):
        q = (p + i / 4) % 1
        sx = cx + (i - 1.5) * 4 + math.sin(q * 6 + i) * 2
        sy = cy + 12 + q * 16
        if sy < 60:
            c.spark(sx, sy, 1 if q < 0.5 else 0, P["qz"][7] if q < 0.6 else P["qz"][4])


def sovereign(c, p):
    pal = "rn"
    dy = round(1.2 * math.sin(2 * math.pi * p + 5))
    cx, cy = 32, 30 + dy
    # down beam, pulsing
    b = wave(p, 2)
    beam = poly([(cx - 5, cy + 9), (cx + 5, cy + 9), (cx + 10, 60), (cx - 10, 60)])
    thin = beam & (((np.floor(X) + np.floor(Y)) % 2) == 0) & ~c.alpha
    c.img[thin] = (*P["rn"][6], int(70 + 90 * b))
    c.set(rect(cx - 10, 58, cx + 10, 60), P["rn"][6])
    for sx, sy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        strut(c, cx + sx * 8, cy + sy * 2, cx + sx * 19, cy + sy * 7 - 4)
        rotor(c, cx + sx * 20, cy + sy * 7 - 6, 8, p, pal, phase=0.17 * (sx + 2 * sy))
    hull = disc(cx, cy + 1, 13, 9)
    orb(c, cx, cy + 1, 13, pal, -0.05)
    c.fill(hull & (Y > cy + 5), 0.3, pal)
    c.outline(hull, pal)
    # crown
    crown = poly([(cx - 8, cy - 6), (cx - 6, cy - 14), (cx - 3, cy - 8), (cx, cy - 16), (cx + 3, cy - 8), (cx + 6, cy - 14), (cx + 8, cy - 6)])
    c.fill(crown, 0.55 + 0.4 * (1 - lin(cx - 8, cy - 16, cx + 8, cy - 6)), "gold", outline="gold")
    for gx, col in ((cx - 6, "red"), (cx, "cyan"), (cx + 6, "ae")):
        c.set(disc(gx, cy - 8, 1.1), P[col][-2])
    # halo, travelling glint
    hm = ring(cx, cy - 20, 9, 7.8, 0.3)
    c.set(hm & ~c.alpha, P["gold"][4])
    g = (angle(cx, cy - 20) - p) % 1 < 0.15
    c.set(hm & g, P["gold"][5])
    lens(c, cx, cy + 2, 4, p, "ember")
    # running lights round the rim, chasing
    for i in range(8):
        a = 2 * math.pi * i / 8
        on = int(p * 8) % 8 == i
        c.set(disc(cx + 12 * math.cos(a), cy + 1 + 8 * math.sin(a), 0.9), P["ember"][4] if on else P[pal][3])


DRAW = [probe, courier, sweeper, warden, cascade, sovereign]


def main(args):
    sheet = np.zeros((N * FRAMES, N * 6, 4), np.uint8)
    for t, fn in enumerate(DRAW):
        for f in range(FRAMES):
            c = Canvas()
            fn(c, f / FRAMES)
            c.finish()
            sheet[f * N:(f + 1) * N, t * N:(t + 1) * N] = c.img
    im = to_image(sheet)
    save_pair(im, str(OUT / "drones"))
    print("wrote drones", im.size)
    if "--sample" in args:
        contact(im, 3).save("/tmp/nf-drones64.png")


if __name__ == "__main__":
    main(sys.argv[1:])
