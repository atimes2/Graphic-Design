"""Cut the Henderson Brewing Co. roundel out of the can photo.

Keeps the white (text ring, inner ring, H, side stripes) and the orange disc,
drops the teal and the silver can. Masks are upscaled 4x and re-thresholded so
edges stay crisp at story size. White is tinted to the poster's bone colour.

Output: layers/logo.png, layers/logo_mono.png (all bone) + logo meta in meta.json
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
SRC = ROOT.parent / "reference" / "henderson-brewing-can.jpg"
OUT = ROOT / "layers"
UP = 4

im = np.asarray(Image.open(SRC).convert("RGB")).astype(np.float32)
R, G, B = im[..., 0], im[..., 1], im[..., 2]
Hh, Ww = R.shape

# ---- find the teal roundel: fit a circle to its outline above the teal band
teal = (B > R + 40) & (G > R + 20) & (B > 70)
rows = np.where(teal[245:, 380:580].sum(1) > 40)[0] + 245  # skip the teal text above
y_top = rows.min()
band_top = next(y for y in range(y_top, Hh) if teal[y, 285:340].mean() > 0.8)
pts = []
for y in range(y_top + 3, band_top - 3):
    xs = np.where(teal[y, 250:710])[0] + 250
    if len(xs):
        pts += [(xs.min(), y), (xs.max(), y)]
P = np.array(pts, np.float64)
A_ = np.c_[2 * P[:, 0], 2 * P[:, 1], np.ones(len(P))]
b_ = (P ** 2).sum(1)
cx, cy, c = np.linalg.lstsq(A_, b_, rcond=None)[0]
r = float(np.sqrt(c + cx ** 2 + cy ** 2))
print(f"roundel centre=({cx:.1f},{cy:.1f}) r={r:.1f} band_top={band_top}")

# ---- stripes: white bars in the band left/right of the circle
yy, xx = np.mgrid[0:Hh, 0:Ww]
white_raw = np.clip((np.minimum(np.minimum(R, G), B) - 125) / 60, 0, 1)
side = (np.abs(xx - cx) > r - 4) & (np.abs(xx - cx) < r + 92)
# stripe rows: white in a window just outside the circle
win = (np.abs(xx - cx) > r + 10) & (np.abs(xx - cx) < r + 40)
band = slice(band_top, band_top + 120)
row_white = (white_raw * win).sum(1) / np.maximum(win.sum(1), 1)
stripe_row = np.zeros(Hh, bool)
stripe_row[band] = row_white[band] > 0.5
sr = np.where(stripe_row)[0]
s0, s1 = sr.min(), sr.max()
# valid columns: the band between the stripes is still teal (not can highlight)
gap_rows = np.zeros(Hh, bool)
gap_rows[s0:s1 + 1] = ~stripe_row[s0:s1 + 1]
col_ok = teal[gap_rows].mean(0) > 0.6
print("stripes rows", s0, s1)

# ---- crop box around roundel + stripes
x0, x1 = int(cx - r - 96), int(cx + r + 96)
y0, y1 = int(cy - r - 4), int(cy + r + 4)
crop = lambda a: a[y0:y1, x0:x1]

inside = np.hypot(xx - cx, yy - cy) < r - 1.2
stripes = side & col_ok[None, :] & (yy >= s0 - 2) & (yy <= s1 + 2)
keep = inside | stripes

white = white_raw * keep
orange = np.clip((R - B - 80) / 60, 0, 1) * (1 - white_raw) * inside
# inside the orange disc, everything that isn't the white H is orange (no dark fringe)
dist = np.hypot(xx - cx, yy - cy)
r_disc = np.percentile(dist[orange > 0.8], 99.5)
in_disc = dist < r_disc - 1.0
orange = np.where(in_disc, 1 - white_raw, orange)


def up(a):
    img = Image.fromarray((crop(a) * 255).astype(np.uint8))
    img = img.resize((img.width * UP, img.height * UP), Image.BICUBIC)
    v = np.asarray(img).astype(np.float32) / 255
    # re-threshold for crisp edges (about 1.5px of AA at 4x)
    return np.clip((v - 0.5) / 0.16 + 0.5, 0, 1)


w, o = up(white), up(orange)
o = o * (1 - w)
alpha = np.clip(w + o, 0, 1)
bone = np.array([255, 241, 224], np.float32)
org = np.array([226, 84, 36], np.float32)
rgb = (w[..., None] * bone + o[..., None] * org) / np.maximum(alpha[..., None], 1e-4)
Image.fromarray(np.dstack([rgb, alpha * 255]).clip(0, 255).astype(np.uint8), "RGBA").save(OUT / "logo.png")
Image.fromarray(np.dstack([np.broadcast_to(bone, rgb.shape), alpha * 255]).clip(0, 255).astype(np.uint8), "RGBA").save(OUT / "logo_mono.png")

# the logo's H: bounding box of white inside the orange disc (for the match cut)
disc = np.hypot(xx - cx, yy - cy) < r * 0.52
hm = (white_raw > 0.5) & disc
hy, hx = np.where(hm)
h_box = [(hx.min() - x0) * UP, (hy.min() - y0) * UP, (hx.max() - x0) * UP, (hy.max() - y0) * UP]

meta_p = OUT / "meta.json"
meta = json.loads(meta_p.read_text())
meta["logo"] = {
    "size": [alpha.shape[1], alpha.shape[0]],
    "center": [(cx - x0) * UP, (cy - y0) * UP],
    "radius": r * UP,
    "h_box": [float(v) for v in h_box],
}
meta_p.write_text(json.dumps(meta, indent=2))
print(json.dumps(meta["logo"]))
