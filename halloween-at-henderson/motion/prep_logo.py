"""Henderson Brewing Company wordmark -> layers/logo.png (+ logo_glow.png).

Source: reference/henderson-wordmark.png (the brand's refreshed wordmark,
transparent PNG; the straight version on the right is used). The alpha is
upscaled 5x and re-thresholded so the script edges stay crisp at story size,
then tinted to the poster's bone colour. A matching ember-coloured copy is
used for the glow.

Appends meta["logo"] to layers/meta.json:
  size, center (px in logo.png), radius (= half the wordmark width, so the
  engine's logo(ctx, cx, cy, width) places it by width), h_box (the script H,
  for the carved-H match cut).
Run after prep_layers.py.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
SRC = ROOT.parent / "reference" / "henderson-wordmark.png"
OUT = ROOT / "layers"
UP = 5

BOX = (660, 138, 1053, 258)      # straight wordmark + padding (source px)
MARK = (668, 146, 1045, 250)     # tight bounds of the wordmark
H_BOX = (670, 146, 760, 222)     # the script H

a = np.asarray(Image.open(SRC).convert("RGBA"))[..., 3]
crop = Image.fromarray(a[BOX[1]:BOX[3], BOX[0]:BOX[2]])
big = crop.resize((crop.width * UP, crop.height * UP), Image.BICUBIC)
v = np.asarray(big).astype(np.float32) / 255
alpha = np.clip((v - 0.5) / 0.14 + 0.5, 0, 1)   # crisp edges, ~1.5px AA at 5x


def save(rgb, name):
    img = np.dstack([np.broadcast_to(np.array(rgb, np.float32), alpha.shape + (3,)), alpha * 255])
    Image.fromarray(img.clip(0, 255).astype(np.uint8), "RGBA").save(OUT / name)


save((255, 241, 224), "logo.png")        # bone
save((224, 60, 30), "logo_glow.png")     # ember, blurred at draw time


def up(x, y):
    return [(x - BOX[0]) * UP, (y - BOX[1]) * UP]


cx, cy = (MARK[0] + MARK[2]) / 2, (MARK[1] + MARK[3]) / 2
meta_p = OUT / "meta.json"
meta = json.loads(meta_p.read_text())
meta["logo"] = {
    "size": [alpha.shape[1], alpha.shape[0]],
    "center": up(cx, cy),
    "radius": (MARK[2] - MARK[0]) * UP / 2,
    "h_box": up(H_BOX[0], H_BOX[1]) + up(H_BOX[2], H_BOX[3]),
}
meta_p.write_text(json.dumps(meta, indent=2))
print(json.dumps(meta["logo"]))
