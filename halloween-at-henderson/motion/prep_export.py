"""Export the pumpkin + knife artwork as standalone transparent PNGs -> ../exports/.

  pumpkin-knife-clean.png  the full, evenly lit pumpkin + knife and hand with a
                           crisp knife-tip star; no glow; sits on any background
  pumpkin-knife-glow.png   the poster look: the pumpkin's left side shaded
                           darker (solid, never see-through), ember halo and
                           the same star; best on dark backgrounds

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


# The poster's shading, recovered from the motion pumpkin (which has it baked in)
# as a 0..1 factor. The glow export uses a softened version of it as solid
# darkening; the clean export skips it.
shaded = rgba(LAYERS / "pumpkin.png")
orig = rgba(PACK / "05_Pumpkin_with_H.png")[ART[1]:ART[3], ART[0]:ART[2]]
lum = lambda x: x[..., :3] @ np.array([0.3, 0.59, 0.11], np.float32)
shade = np.clip(lum(shaded) / np.maximum(lum(orig), 1e-3), 0, 1)
shade = cv2.GaussianBlur(np.where(orig[..., 3] > 0.5, shade, 1), (0, 0), 3)   # smooth out per-pixel noise
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
# the very point sits under the star's white core; clear it so no chip pokes out
knife_clean[..., 3] *= 1 - ((yy > tip[1] - 12) & (np.abs(xx - tip[0]) < 45))

def star(size, ss=3):
    """A crisp four-point sparkle like the poster's knife-tip star, RGBA in 0..1.
    Long vertical rays, shorter horizontal ones, small diagonals, white-hot core
    and a faint cool bloom; anti-aliased by supersampling."""
    n = size * ss
    c = (n - 1) / 2
    yy, xx = (np.mgrid[0:n, 0:n].astype(np.float32) - c) / ss
    a = np.zeros((n, n), np.float32)
    for ang, length, width in [(90, 0.48, 3.4), (270, 0.42, 3.4), (0, 0.36, 2.8), (180, 0.36, 2.8),
                               (45, 0.16, 1.8), (135, 0.16, 1.8), (225, 0.16, 1.8), (315, 0.16, 1.8)]:
        L = length * size
        t = np.deg2rad(ang)
        u = xx * np.cos(t) + yy * np.sin(t)            # along the ray
        v = -xx * np.sin(t) + yy * np.cos(t)           # across it
        k = np.clip(1 - u / L, 0, 1) * (u >= 0)
        half = width * k + 0.35                       # tapers to a point
        a = np.maximum(a, np.clip(half - np.abs(v), 0, 1) * k ** 0.9)
    r = np.hypot(xx, yy)
    core = np.exp(-(r / (0.05 * size)) ** 2)
    bloom = 0.5 * np.exp(-(r / (0.13 * size)) ** 2)
    alpha = np.clip(np.maximum(a, core) + bloom * (1 - a), 0, 1)
    # white core and rays, cooling to a pale blue in the bloom
    cool = np.clip(1 - np.maximum(a, core), 0, 1)[..., None]
    rgb = (1 - cool) * np.array([1.0, 1.0, 1.0]) + cool * np.array([0.78, 0.88, 1.0])
    img = np.dstack([rgb, alpha]).astype(np.float32)
    return cv2.resize(img, (size, size), interpolation=cv2.INTER_AREA)


def add_star(img, x, y, size):
    st = star(size)
    out = img.copy()
    x0, y0 = int(round(x - size / 2)), int(round(y - size / 2))
    out[y0:y0 + size, x0:x0 + size] = over(st, out[y0:y0 + size, x0:x0 + size])
    return out


P = 140   # canvas margin: room for the star and the halo
SIZE = 190
tx, ty = tip[0] + P, tip[1] + P - 2

# 1 · clean: the full, evenly lit pumpkin, knife and hand, and a crisp tip star
clean = add_star(padded(over(knife_clean, orig), P), tx, ty, SIZE)
crop_save(clean, "pumpkin-knife-clean.png", pad=4)

# 2 · glow: the poster's shading as solid darkening (never see-through, never
# fully black), an ember halo from the silhouette, and the same star
soft = 0.3 + 0.7 * shade
pumpkin_shaded = np.dstack([orig[..., :3] * soft[..., None], orig[..., 3]])
art = padded(over(knife_clean, pumpkin_shaded), P)
sil = art[..., 3]
halo = 0.55 * cv2.GaussianBlur(sil, (0, 0), 16) + 0.45 * cv2.GaussianBlur(sil, (0, 0), 48)
halo = np.clip(halo * 0.75, 0, 1)
glow = np.dstack([np.broadcast_to(np.array([0.92, 0.30, 0.10], np.float32), sil.shape + (3,)), halo])
crop_save(add_star(over(art, glow), tx, ty, SIZE), "pumpkin-knife-glow.png", pad=0)
