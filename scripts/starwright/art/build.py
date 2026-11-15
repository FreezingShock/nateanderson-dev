"""Build every Starwright art sheet into public/starwright/ and write manifest.json. Run: python3 scripts/starwright/art/build.py"""
import time
import common, stars, planets, scenery, icons
VERSION = 1

if __name__ == "__main__":
    t = time.time()
    for mod in (stars, planets, scenery, icons):
        mod.run()
    common.write_manifest(VERSION)
    print(f"{len(common.MANIFEST)} sheets in {time.time() - t:.1f}s")
