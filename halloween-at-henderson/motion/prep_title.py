"""Updated "HALLOWEEN AT HENDERSON" title -> layers/title*.png.

Source: reference/title-updated.webp (bone fill, red outline, on white).
The white is keyed out by lightness (bone's darkest channel is ~225, the white
is 255, the red outline is far darker), un-blended from white, then split into:
  title_fill.png   the bone letter fill   (burn-in step 2)
  title_ember.png  the red outline        (burn-in step 1, also the glow)
  title.png        both together
The new art is higher resolution than the poster crop, so layers are kept at
that resolution and meta["title_res"] tells the engine the scale factor.
Letter spans for the burn-in are recomputed from the new fill.

Run after prep_layers.py (it overwrites prep_layers' title layers).
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
SRC = ROOT.parent / "reference" / "title-updated.webp"
OUT = ROOT / "layers"

# the old title canvas: 866x230 (poster px), text box inside it
CANVAS = (866, 230)
OLD_TEXT = (12, 6, 858, 227)   # x0, y0, x1, y1 of the lettering in that canvas

src = np.asarray(Image.open(SRC).convert("RGBA")).astype(np.float32)
rgb, a_in = src[..., :3], src[..., 3] / 255

# key: the darkest channel separates white (255) from bone (~225) and red (~40)
mn = rgb.min(2)
alpha = np.clip((250 - mn) / 20, 0, 1) * a_in
# un-blend from white
col = (rgb - (1 - alpha[..., None]) * 255) / np.maximum(alpha[..., None], 1e-3)
col = np.clip(col, 0, 255)

ys, xs = np.where(alpha > 0.5)
bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
k = (bx1 - bx0) / (OLD_TEXT[2] - OLD_TEXT[0])          # resolution factor vs old canvas
W, H = round(CANVAS[0] * k), round(CANVAS[1] * k)
new_h_old_units = (by1 - by0) / k
ox = round(OLD_TEXT[0] * k)
oy = round((OLD_TEXT[1] + ((OLD_TEXT[3] - OLD_TEXT[1]) - new_h_old_units) / 2) * k)

canvas_a = np.zeros((H, W), np.float32)
canvas_c = np.zeros((H, W, 3), np.float32)
ch, cw = min(by1 - by0, H - oy), min(bx1 - bx0, W - ox)
canvas_a[oy:oy + ch, ox:ox + cw] = alpha[by0:by0 + ch, bx0:bx0 + cw]
canvas_c[oy:oy + ch, ox:ox + cw] = col[by0:by0 + ch, bx0:bx0 + cw]

# bone fill vs red outline
cream = np.clip((canvas_c.min(2) - 150) / 50, 0, 1) * canvas_a
ember_a = canvas_a * (1 - cream)


def save(c, a, name):
    img = np.dstack([c, a * 255]).clip(0, 255).astype(np.uint8)
    Image.fromarray(img, "RGBA").save(OUT / name)


bone = np.broadcast_to(np.array([255, 242, 224], np.float32), canvas_c.shape)
save(bone, cream, "title_fill.png")
ember_c = canvas_c.copy()
ember_c[..., 0] = np.maximum(ember_c[..., 0], 200)
save(ember_c, ember_a, "title_ember.png")
save(canvas_c, canvas_a, "title.png")

# ---- line split (blank rows between the two lines) and per-letter column runs
rows = (cream > 0.5).sum(1)
text_rows = np.where(rows > 0)[0]
gaps = [y for y in range(text_rows.min(), text_rows.max()) if rows[y] == 0]
split = int(np.median(gaps)) if gaps else (text_rows.min() + text_rows.max()) // 2
lines = {"line1": (text_rows.min(), split), "line2": (split, text_rows.max() + 1)}

spans = {}
for name, (y0, y1) in lines.items():
    col_on = (cream[y0:y1] > 0.5).sum(0) > 0
    runs, on, start = [], False, 0
    for i, v in enumerate(col_on):
        if v and not on:
            on, start = True, i
        elif not v and on:
            on = False
            runs.append([start, i])
    if on:
        runs.append([start, len(col_on)])
    merged = []
    for s0, s1 in runs:
        if merged and s0 - merged[-1][1] < 2:
            merged[-1][1] = s1
        else:
            merged.append([s0, s1])
    # drop specks
    merged = [r for r in merged if r[1] - r[0] > 4 * k]
    spans[name] = {"y": [int(y0), int(y1)], "cols": [[int(a), int(b)] for a, b in merged]}

meta_p = OUT / "meta.json"
meta = json.loads(meta_p.read_text())
meta["title_letters"] = spans
meta["title_res"] = k
meta_p.write_text(json.dumps(meta, indent=2))
print(f"title canvas {W}x{H}  res x{k:.3f}  letters", {n: len(v["cols"]) for n, v in spans.items()})
