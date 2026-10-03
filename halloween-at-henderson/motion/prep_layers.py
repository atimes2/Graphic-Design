"""Build the animation layers from the designer layer pack (reference/layers/).

Pack (all 1254x1254, same canvas, real alpha):
  01_Title.png                 HALLOWEEN AT / HENDERSON
  03_Returning_October_31st.png
  04_Knife_and_Hand.png        separate knife layer (with a baked tip star)
  05_Pumpkin_with_H.png        complete pumpkin with the carved H

Output: motion/layers/*.png + layers/meta.json (positions in art-box px).
Run prep_logo.py afterwards (it appends the logo to meta.json).
"""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
PACK = ROOT.parent / "reference" / "layers"
OUT = ROOT / "layers"
OUT.mkdir(exist_ok=True)


def load(name):
    a = np.asarray(Image.open(PACK / name).convert("RGBA")).astype(np.float32)
    return a[..., :3], a[..., 3]


title_rgb, title_a = load("01_Title.png")
foot_rgb, foot_a = load("03_Returning_October_31st.png")
knife_rgb, knife_a = load("04_Knife_and_Hand.png")
pump_rgb, pump_a = load("05_Pumpkin_with_H.png")
H, W = title_a.shape

# ---------------------------------------------------------------- regions (canvas px)
ART = (350, 300, 900, 1060)       # pumpkin + knife as composed in the pack
TITLE = (196, 58, 1062, 288)
FOOT = (340, 1108, 920, 1182)
TIP = (668, 992)                  # knife-tip star centre
HILT = (500, 490)                 # where the blade leaves the hand
H_BOX = (635, 490, 822, 775)      # the carved H


def save(rgb, a, box, name):
    img = np.dstack([rgb, a]).clip(0, 255).astype(np.uint8)
    Image.fromarray(img, "RGBA").crop(box).save(OUT / name)


yy, xx = np.mgrid[0:H, 0:W]

# ---- knife: remove the baked star (we draw our own animated sparkle)
r = np.hypot(xx - TIP[0], yy - TIP[1])
cool = (knife_rgb[..., 2] > knife_rgb[..., 0] * 0.72) & (r < 80)
kill = np.clip((r - 7) / 10, 0, 1)
k_a = knife_a.copy()
k_a[cool] *= kill[cool]
# anything below/around the tip that isn't blade goes too
k_a[(r < 80) & (yy > TIP[1] + 4)] = 0
save(knife_rgb, k_a, ART, "knife.png")

# ---- pumpkin (complete; nothing hidden behind the knife any more)
# The poster lets the pumpkin fall into shadow left of the blade, so bake that
# shade in: dark from just behind the blade's left edge outwards, a little light
# kept up by the hand. (BLADE_EDGE: two points on the blade's left edge.)
BLADE_EDGE = ((470, 550), (651, 950))
def smooth(e0, e1, v):
    v = np.clip((v - e0) / (e1 - e0), 0, 1)
    return v * v * (3 - 2 * v)
(ex0, ey0), (ex1, ey1) = BLADE_EDGE
edge_x = ex0 + (yy - ey0) * (ex1 - ex0) / (ey1 - ey0)
left = smooth(-45, 85, edge_x - xx)                 # 0 right of the blade -> 1 well left of it
shade = 1 - left * (0.6 + 0.4 * smooth(500, 760, yy))
pump_shaded = pump_rgb * shade[..., None]
save(pump_shaded, pump_a, ART, "pumpkin.png")

# ---- H carving glow: hot pixels inside the H box
box = np.zeros((H, W), np.float32)
box[H_BOX[1]:H_BOX[3], H_BOX[0]:H_BOX[2]] = 1
hot = np.clip((pump_rgb[..., 1] - 130) / 80, 0, 1) * np.clip((pump_rgb[..., 0] - 190) / 45, 0, 1)
hot *= box * (pump_a / 255)
hot = cv2.GaussianBlur(hot, (0, 0), 0.8)
save(pump_rgb, hot * 255, ART, "h_glow.png")

# ---- full composed art (static use)
comp_a = pump_a / 255 + k_a / 255 * (1 - pump_a / 255)
comp = (pump_shaded * (pump_a / 255)[..., None] * (1 - k_a / 255)[..., None] + knife_rgb * (k_a / 255)[..., None])
comp = comp / np.maximum(comp_a[..., None], 1e-4)
save(comp, comp_a * 255, ART, "art.png")

# ---- title: split bone fill / ember outline for the burn-in
ta = title_a / 255
cream = np.clip((title_rgb.min(2) - 120) / 60, 0, 1) * ta
ember_a = ta * (1 - cream)
fill_rgb = np.dstack([np.full((H, W), 255), np.full((H, W), 242), np.full((H, W), 224)])
save(fill_rgb, cream * 255, TITLE, "title_fill.png")
ember_rgb = title_rgb.copy()
ember_rgb[..., 0] = np.maximum(ember_rgb[..., 0], 200)
save(ember_rgb, ember_a * 255, TITLE, "title_ember.png")
save(title_rgb, title_a, TITLE, "title.png")

spans = {}
for name, (y0, y1) in {"line1": (76, 168), "line2": (171, 269)}.items():
    col = (cream[y0:y1, TITLE[0]:TITLE[2]] > 0.5).sum(0) > 0
    runs, on, start = [], False, 0
    for i, v in enumerate(col):
        if v and not on:
            on, start = True, i
        elif not v and on:
            on = False
            runs.append([start, i])
    if on:
        runs.append([start, len(col)])
    merged = []
    for a, b in runs:
        if merged and a - merged[-1][1] < 3:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    spans[name] = {"y": [y0 - TITLE[1], y1 - TITLE[1]], "cols": merged}

# ---- footer
save(foot_rgb, foot_a, FOOT, "footer.png")

ax, ay = ART[0], ART[1]
meta = {
    "poster": [W, H],
    "art": ART,
    "title": TITLE,
    "footer": FOOT,
    "glint": [TIP[0] - ax, TIP[1] - ay],
    "hilt": [HILT[0] - ax, HILT[1] - ay],
    "h_center": [(H_BOX[0] + H_BOX[2]) / 2 - ax, (H_BOX[1] + H_BOX[3]) / 2 - ay],
    "h_height": H_BOX[3] - H_BOX[1],
    "blade_angle_deg": float(np.degrees(np.arctan2(TIP[1] - HILT[1], TIP[0] - HILT[0]))),
    "title_letters": spans,
}
(OUT / "meta.json").write_text(json.dumps(meta, indent=2))
print(json.dumps({k: v for k, v in meta.items() if k != "title_letters"}))
