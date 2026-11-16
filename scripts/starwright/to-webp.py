#!/usr/bin/env python3
"""Write a lossless WebP next to every Starwright PNG sprite and check that the pixels match exactly.

The site loads the .webp files (about 43% of the PNG bytes, identical pixels). Keep the PNGs as the art source:
after drawing or changing a PNG, run this again. Needs Pillow (`pip install pillow`).

    python3 scripts/starwright/to-webp.py
"""
import glob
import io
import os
import sys

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "starwright")

def main() -> int:
    png_bytes = webp_bytes = 0
    count = 0
    for path in sorted(glob.glob(os.path.join(ROOT, "**", "*.png"), recursive=True)):
        src = Image.open(path)
        buf = io.BytesIO()
        src.save(buf, "WEBP", lossless=True, method=6, quality=100)
        data = buf.getvalue()
        # Lossless means lossless: decode what we wrote and compare every RGBA byte with the PNG.
        if Image.open(io.BytesIO(data)).convert("RGBA").tobytes() != src.convert("RGBA").tobytes():
            print("pixel mismatch, not written:", path, file=sys.stderr)
            return 1
        with open(path[:-4] + ".webp", "wb") as f:
            f.write(data)
        png_bytes += os.path.getsize(path)
        webp_bytes += len(data)
        count += 1
    print(f"{count} sprites: PNG {png_bytes // 1024} KB -> WebP {webp_bytes // 1024} KB")
    return 0

if __name__ == "__main__":
    sys.exit(main())
