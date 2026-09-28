"""Cut the flat poster into animatable layers.

Everything in the poster sits on near-black, so most layers are drawn with
additive/screen blending. The knife + hand is cut out with a hand-drawn
polygon so it can move independently of the pumpkin, and the area behind it
is inpainted.

Output: motion/layers/*.png (+ layers/meta.json with positions in poster px)
"""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
SRC = ROOT.parent / "reference" / "poster-01.png"
OUT = ROOT / "layers"
OUT.mkdir(exist_ok=True)

poster = Image.open(SRC).convert("RGB")
P = np.asarray(poster).astype(np.float32)
W, H = poster.size

# ---------------------------------------------------------------- regions
ART = (330, 285, 910, 1070)       # knife + pumpkin
TITLE = (196, 58, 1062, 288)      # HALLOWEEN AT / HENDERSON
FOOT = (340, 1108, 920, 1182)     # Returning October 31st
GLINT = (682, 1006)               # knife-tip star centre

KNIFE_POLY = [
    (395, 318), (440, 306), (478, 316), (500, 343), (538, 350), (553, 385),
    (557, 440), (549, 470), (546, 500), (575, 560), (620, 670), (655, 770),
    (678, 860), (690, 940), (691, 998), (684, 1012), (676, 1000), (640, 930),
    (590, 840), (540, 750), (495, 660), (460, 590), (452, 562), (430, 566),
    (400, 560), (372, 522), (358, 470), (370, 410), (384, 360),
]


def save_rgba(arr_rgb, alpha, box, name):
    img = np.dstack([arr_rgb, alpha]).clip(0, 255).astype(np.uint8)
    Image.fromarray(img, "RGBA").crop(box).save(OUT / name)


def save_rgb(arr_rgb, box, name):
    Image.fromarray(arr_rgb.clip(0, 255).astype(np.uint8)).crop(box).save(OUT / name)


# ---------------------------------------------------------------- knife mask
mask_img = Image.new("L", (W, H), 0)
ImageDraw.Draw(mask_img).polygon(KNIFE_POLY, fill=255)
mask_hard = np.asarray(mask_img)
mask_soft = np.asarray(mask_img.filter(ImageFilter.GaussianBlur(1.6))).astype(np.float32)

# Kill the baked glint rays everywhere (we draw our own animated glint).
yy, xx = np.mgrid[0:H, 0:W]
r = np.hypot(xx - GLINT[0], yy - GLINT[1])
cool = (P[..., 2] > P[..., 0] * 0.75) & (r < 70)       # bluish-white rays
ray_kill = np.clip((r - 6) / 10, 0, 1)                   # keep a tiny core
dimmed = P.copy()
dimmed[cool] *= ray_kill[cool][:, None]
# outside the blade, fade the whole neighbourhood of the tip to black
outside = (mask_hard == 0) & (r < 70) & (yy > 960)
dimmed[outside] *= 0.0

# knife layer (RGBA). Over black (left of the pumpkin) let the alpha follow
# luminance so the hand's glow haze falls off softly instead of a cut edge.
lum_a = np.clip(dimmed.max(2) / 70, 0, 1) * 255
left = np.clip((470 - xx) / 25, 0, 1)
knife_a = mask_soft * (1 - left) + np.minimum(mask_soft, lum_a) * left
save_rgba(dimmed, knife_a, ART, "knife.png")

# pumpkin layer: inpaint where the knife was, then darken the patch a little
dil = cv2.dilate(mask_hard, np.ones((23, 23), np.uint8))
src_for_inp = dimmed.copy()
src_for_inp[dil > 0] = 0
bgr = cv2.cvtColor(src_for_inp.clip(0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR)
inp = cv2.inpaint(bgr, dil, 15, cv2.INPAINT_TELEA)
inp = cv2.cvtColor(inp, cv2.COLOR_BGR2RGB).astype(np.float32)
shade = 1 - 0.55 * (cv2.GaussianBlur(dil.astype(np.float32), (0, 0), 6) / 255)
pumpkin = inp * shade[..., None]
# the hand region hangs over black: make sure nothing of it remains
save_rgb(pumpkin, ART, "pumpkin.png")

# full art (for static lockups)
save_rgb(dimmed, ART, "art.png")

# "H" carving glow: the hot yellow pixels in the H area
hx0, hy0, hx1, hy1 = 590, 470, 860, 800
region = np.zeros((H, W), np.float32)
region[hy0:hy1, hx0:hx1] = 1
hot = np.clip((P[..., 1] - 120) / 90, 0, 1) * np.clip((P[..., 0] - 180) / 50, 0, 1)
hot *= region * (1 - mask_hard / 255.0)
hot = cv2.GaussianBlur(hot, (0, 0), 0.8)
save_rgba(P, hot * 255, ART, "h_glow.png")

# ---------------------------------------------------------------- title
t = P
cream = np.clip((t.min(2) - 120) / 60, 0, 1)            # bright neutral pixels
lum = t.max(2)
ember_a = np.clip(lum / 200, 0, 1) * (1 - cream)
fill_rgb = np.dstack([np.full((H, W), 255), np.full((H, W), 242), np.full((H, W), 224)])
save_rgba(fill_rgb, cream * 255, TITLE, "title_fill.png")
ember_rgb = t.copy()
ember_rgb[..., 0] = np.maximum(ember_rgb[..., 0], 200)
save_rgba(ember_rgb, ember_a * 255, TITLE, "title_ember.png")
save_rgba(t, np.clip(lum / 140, 0, 1) * 255, TITLE, "title.png")

# per-letter column spans for the burn-in, found from the fill mask
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
    # merge runs separated by <3px (e.g. inside a single glyph)
    merged = []
    for a, b in runs:
        if merged and a - merged[-1][1] < 3:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    spans[name] = {"y": [y0 - TITLE[1], y1 - TITLE[1]], "cols": merged}

# ---------------------------------------------------------------- footer
foot_a = np.clip((P.max(2) - 40) / 160, 0, 1)
save_rgba(P, foot_a * 255, FOOT, "footer.png")

meta = {
    "poster": [W, H],
    "art": ART,
    "title": TITLE,
    "footer": FOOT,
    "glint": [GLINT[0] - ART[0], GLINT[1] - ART[1]],
    "h_center": [715 - ART[0], 640 - ART[1]],
    "blade_angle_deg": float(np.degrees(np.arctan2(1006 - 505, 682 - 548))),
    "title_letters": spans,
}
(OUT / "meta.json").write_text(json.dumps(meta, indent=2))
print(json.dumps({k: v for k, v in meta.items() if k != "title_letters"}))
print({k: len(v["cols"]) for k, v in spans.items()})
