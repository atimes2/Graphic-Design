"""Export the pumpkin + knife artwork as standalone transparent PNGs -> ../exports/.

  pumpkin-knife-clean.png  the full, evenly lit pumpkin + knife and hand; no
                           glow, no tip star; sits on any background
  pumpkin-knife-glow.png   the poster look for dark backgrounds: the pumpkin's
                           left side falls away into shadow (as transparency,
                           so it matches the poster on black), ember halo and
                           knife-tip star

Built from the motion layers (run after prep_layers.py), at the layer pack's
native resolution, cropped tight with a margin.
"""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
LAYERS = ROOT / "layers"
PACK = ROOT.parent / "reference" / "layers"
OUT = ROOT.parent / "exports"
OUT.mkdir(exist_ok=True)
ART = (350, 300, 900, 1060)   # same crop as prep_layers.py


def rgba(path):
    return np.asarray(Image.open(path).convert("RGBA")).astype(np.float32) / 255


def over(top, bottom):
    ta, ba = top[..., 3:], bottom[..., 3:]
    a = ta + ba * (1 - ta)
    rgb = (top[..., :3] * ta + bottom[..., :3] * ba * (1 - ta)) / np.maximum(a, 1e-6)
    return np.dstack([rgb, a])


def crop_save(img, name, pad):
    ys, xs = np.where(img[..., 3] > 2 / 255)
    x0, y0 = max(xs.min() - pad, 0), max(ys.min() - pad, 0)
    x1, y1 = min(xs.max() + 1 + pad, img.shape[1]), min(ys.max() + 1 + pad, img.shape[0])
    out = (img[y0:y1, x0:x1] * 255).round().clip(0, 255).astype(np.uint8)
    Image.fromarray(out, "RGBA").save(OUT / name, optimize=True)
    print(f"{name}: {x1 - x0}x{y1 - y0}")


def padded(img, p):
    return np.pad(img, ((p, p), (p, p), (0, 0)))


# The motion pumpkin has the poster's shading baked in as darkness. For the glow
# export, turn that shading into transparency instead (original colours, alpha
# scaled by the shade factor): identical on black, and it fades into any dark
# colour rather than leaving a black smudge. The clean export skips the shading.
shaded = rgba(LAYERS / "pumpkin.png")
orig = rgba(PACK / "05_Pumpkin_with_H.png")[ART[1]:ART[3], ART[0]:ART[2]]
lum = lambda x: x[..., :3] @ np.array([0.3, 0.59, 0.11], np.float32)
shade = np.clip(lum(shaded) / np.maximum(lum(orig), 1e-3), 0, 1)
shade = cv2.GaussianBlur(np.where(orig[..., 3] > 0.5, shade, 1), (0, 0), 3)   # smooth out per-pixel noise
pumpkin_fade = np.dstack([orig[..., :3], orig[..., 3] * shade])
knife_clean = rgba(LAYERS / "knife.png")                                           # tip star removed
# faint star rays survive beside the tip (the videos hide them under the animated
# sparkle). For the logo, fit the blade's two edges just above the tip and keep
# only the wedge between them near the tip.
ka = knife_clean[..., 3]
tip = (668 - ART[0], 992 - ART[1])
rows = np.arange(tip[1] - 150, tip[1] - 40)
L, R = [], []
for y in rows:
    xs = np.where(ka[y, tip[0] - 160:tip[0] + 60] > 0.5)[0] + tip[0] - 160
    if len(xs):
        L.append(xs.min()); R.append(xs.max())
fl, fr = np.polyfit(rows[:len(L)], L, 1), np.polyfit(rows[:len(R)], R, 1)   # x = m*y + c per edge
yy, xx = np.mgrid[0:ka.shape[0], 0:ka.shape[1]].astype(np.float32)
inside = np.minimum(xx - (fl[0] * yy + fl[1]), (fr[0] * yy + fr[1]) - xx) + 1.5   # px inside the wedge
wedge = np.clip(inside / 1.5, 0, 1) * (yy <= tip[1] + 2)
zone = yy > tip[1] - 150
knife_clean[..., 3] = np.where(zone, np.minimum(ka, wedge), ka)

knife_star = rgba(PACK / "04_Knife_and_Hand.png")[ART[1]:ART[3], ART[0]:ART[2]]   # with the baked star

# 1 · clean
crop_save(over(knife_clean, orig), "pumpkin-knife-clean.png", pad=4)

# 2 · glow: ember halo built from the art's silhouette, under the art
P = 140   # room for the halo
art = padded(over(knife_star, pumpkin_fade), P)
sil = art[..., 3]
halo = 0.55 * cv2.GaussianBlur(sil, (0, 0), 16) + 0.45 * cv2.GaussianBlur(sil, (0, 0), 48)
halo = np.clip(halo * 0.75, 0, 1)
glow = np.dstack([np.broadcast_to(np.array([0.92, 0.30, 0.10], np.float32), sil.shape + (3,)), halo])
crop_save(over(art, glow), "pumpkin-knife-glow.png", pad=0)
