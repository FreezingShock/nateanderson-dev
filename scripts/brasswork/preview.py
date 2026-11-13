import sys
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
import bw_items as B
import bw_machines as M
from nodefarm_icon_kit import to_image, contact
D = {**B.DRAW, **M.DRAW}
names = sys.argv[2:] or list(D)
cols = 8
rows = (len(names) + cols - 1) // cols
sheet = np.zeros((rows * 64, cols * 64, 4), np.uint8)
for i, n in enumerate(names):
    r, cc = divmod(i, cols)
    sheet[r*64:(r+1)*64, cc*64:(cc+1)*64] = D[n]().img
contact(to_image(sheet), 4, (58, 44, 30, 255)).save(sys.argv[1])
