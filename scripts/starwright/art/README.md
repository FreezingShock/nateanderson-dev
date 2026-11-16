# Starwright art

Generator for every Starwright sprite sheet. `python3 scripts/starwright/art/build.py` writes `public/starwright/**.png` and `public/starwright/manifest.json` (needs Pillow and numpy). `python3 scripts/starwright/art/preview.py OUT` writes contact sheets.

Format: horizontal strips, fixed cells, frames left to right, 4x4 Bayer dither through the shared palette in `common.py`, alpha 0 or 255. The manifest lists `{src, w, h, frames, fps, loop}` per sheet and a `v` stamp; bump `VERSION` in `build.py` when art changes. Planet sheets also carry `body` (the body radius in px).

Files: `stars.py` (stages, transitions, implode, nova, hole), `planets.py` (8 worlds x 4 stages, Orbit icons), `scenery.py` (visitors, birth-cloud cards, backdrops), `icons.py` (element tiles, dock, menu, medal, panel bits). All art is original and procedural.

The site loads WebP. `build.py` writes a lossless `.webp` next to each sheet and points the manifest at it. The UI sheets under `public/starwright/ui` are PNG sources too: after changing one, run `python3 scripts/starwright/to-webp.py` to refresh its `.webp`.
