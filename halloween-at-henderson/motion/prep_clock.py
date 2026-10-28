"""The tower clock for story 20 (Extra Hour) -> layers/clock_dial.png + meta["clock"].

Source: the midnight clock in The Phantom Carriage (1921, dir. Victor Sjostrom,
public domain; see reel/SOURCES.md), cut to footage-src/pc_clock.mp4 (the
segment in reel/footage.json -> _segments). A few frames of the held close-up
are median-stacked, graded to the Reels' warm black-and-white, and the painted
hands (both at XII) are removed (the dial is cloned onto itself) so the story
can draw its own hands turning back from 2:00 to 1:00.

The hand silhouette is measured before it is removed: meta["clock"]["hand"] is
its half-width profile (pivot -> tip, in dial radii), so the drawn hands keep
the film's ornate shape. The XII the hands covered is rebuilt from the dial's
own painted X and I.
"""
import json, subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
import imageio_ffmpeg

from prep_footage import grade, fetch, SRC

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "layers"
FF = imageio_ffmpeg.get_ffmpeg_exe()
AT, N = 86.75, 7          # the held close-up (seconds into pc_clock.mp4), frames stacked
UP = 2.4                  # upscale so the dial is ~1000px across

# frames -> median
fetch("pc_clock", json.loads((ROOT / "reel" / "footage.json").read_text())["_segments"])
w, h = 1472, 1072
raw = subprocess.run([FF, "-loglevel", "error", "-ss", str(AT), "-i", str(SRC / "pc_clock.mp4"),
                      "-frames:v", str(N), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                     capture_output=True, check=True).stdout
frames = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3).astype(np.float32)
img = np.median(frames, axis=0)
lum = img @ np.array([0.3, 0.59, 0.11], np.float32)

# the dial: the largest bright blob
bright = (lum > 0.45 * np.percentile(lum, 99.5)).astype(np.uint8)
bright = cv2.morphologyEx(bright, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
n, lab, stats, cent = cv2.connectedComponentsWithStats(bright)
k = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
x0, y0, bw, bh = stats[k, :4]
cx, cy = x0 + bw / 2, y0 + bh / 2
rx, ry = bw / 2, bh / 2

# hand mask: dark pixels in a column above the pivot, plus the thin stray line right of centre
yy, xx = np.mgrid[0:h, 0:w]
inside = ((xx - cx) / (rx * 0.985)) ** 2 + ((yy - cy) / (ry * 0.985)) ** 2 < 1
dial_lum = np.median(lum[inside])
dark = lum < 0.55 * dial_lum
col = inside & (np.abs(xx - cx) < 0.17 * rx) & (yy > cy - 0.99 * ry) & (yy < cy + 0.22 * ry)
line = inside & (xx > cx) & (xx < cx + 0.55 * rx) & (yy > cy - 0.24 * ry) & (yy < cy + 0.08 * ry) & (lum < 0.85 * dial_lum)
mask = ((dark & col) | line).astype(np.uint8)
mask = cv2.dilate(mask, np.ones((7, 7), np.uint8))

# hand profile below the numerals (rows where the column is unambiguous)
hand_rows = []
for y in range(int(cy - 0.62 * ry), int(cy + 0.22 * ry)):
    xs = np.where(dark[y] & col[y])[0]
    if len(xs) > 2:
        hand_rows.append((y, xs.min(), xs.max()))
ys = np.array([r[0] for r in hand_rows])
mid = np.median([(r[1] + r[2]) / 2 for r in hand_rows])
tail = ys.max()                                   # the bottom point of the hand
pivot_y = cy                                      # it turns on the dial's centre
prof = [[round((pivot_y - y) / ry, 4), round((r2 - r1) / 2 / rx, 4)] for y, r1, r2 in hand_rows]
prof.sort()

# remove the hands by cloning the dial onto itself. Work on a circular copy (the
# dial is slightly elliptical in the shot) so rotations about the centre are exact.
sq = ry / rx
circ = cv2.resize(img, (w, int(round(h / sq))), interpolation=cv2.INTER_CUBIC)
ccx0, ccy0 = cx, cy / sq
R = rx


def rot(deg):   # the dial turned clockwise by deg
    M = cv2.getRotationMatrix2D((ccx0, ccy0), -deg, 1.0)
    return cv2.warpAffine(circ, M, (circ.shape[1], circ.shape[0]), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)


m = cv2.resize(mask, (w, circ.shape[0]), interpolation=cv2.INTER_NEAREST).astype(bool)
Y, X = np.mgrid[0:circ.shape[0], 0:w]
rr = np.hypot(X - ccx0, Y - ccy0) / R
ang = np.degrees(np.arctan2(X - ccx0, -(Y - ccy0)))          # 0 at XII, clockwise
out = circ.copy()
lumc = circ @ np.array([0.3, 0.59, 0.11], np.float32)


def paste(region, src):
    """src into region, matched row by row to the dial on either side (the light
    falls off across the face, so one level for the whole patch reads as a ghost)"""
    reg8 = region.astype(np.uint8)
    band = cv2.dilate(reg8, np.ones((1, 41), np.uint8)).astype(bool) & ~cv2.dilate(reg8, np.ones((1, 11), np.uint8)).astype(bool)
    band &= (rr < 0.98) & ~m
    ls = src @ np.array([0.3, 0.59, 0.11], np.float32)
    rows = np.where(region.any(1))[0]
    k = np.ones(circ.shape[0], np.float32)
    for y in rows:
        t, s_ = lumc[y][band[y]], ls[y][region[y]]
        if len(t) > 4 and len(s_):
            k[y] = np.clip(np.median(t) / max(np.median(s_), 1), 0.75, 1.35)
    k[rows] = cv2.GaussianBlur(k[rows].reshape(-1, 1), (1, 0), 6).ravel() if len(rows) > 1 else k[rows]
    out[region] = (src * k[:, None, None])[region]


# the face: near the pivot the hand covers every rotation of itself, so that part is
# lifted from beside it; further out the dial is turned so IX's side fills the gap
shift = np.roll(circ, int(0.4 * R), axis=1)
colm = np.abs(X - ccx0) < 0.2 * R
paste(m & colm & (rr < 0.36), shift)
paste(m & colm & (rr >= 0.36) & (rr < 0.66), rot(90))
paste(m & ~colm & (rr < 0.66), rot(150))                    # the stray line, from the dial below X
# the numeral ring under the hands: blank dial from two gaps (I-II, X-XI), then XII
# rebuilt from the painted X (X o'clock) and I (I o'clock), each turned up to the top
ring = (rr >= 0.6) & (rr < 1.0)
paste(ring & (ang >= -12) & (ang < 1), rot(-43.5 + -5.5))
paste(ring & (ang >= 1) & (ang < 14), rot(314 - 360 + 7.5))
pieces = [(+60, -5.6, 6.6), (-30, 3.6, 2.7), (-30, 9.0, 2.7)]   # (turn, target angle, half-width deg)
for turn, at, hw in pieces:
    src = rot(turn + at)
    win = (rr > 0.64) & (rr < 0.99) & (np.abs(ang - at) < hw)
    out[win] = np.minimum(out[win], src[win])
inner = m & (rr < 0.66)
ring = ring & (ang >= -12) & (ang < 14)
# soften the seams a little
seam = cv2.dilate((inner | ring).astype(np.uint8), np.ones((9, 9), np.uint8)) - cv2.erode((inner | ring).astype(np.uint8), np.ones((9, 9), np.uint8))
blur = cv2.GaussianBlur(out, (0, 0), 2.0)
out[seam.astype(bool)] = blur[seam.astype(bool)]
# what is left of the hands at the pivot gets inpainted (the drawn hands cover it)
pv = (m & (rr < 0.3)).astype(np.uint8)
left = (pv.astype(bool) & ((out @ np.array([0.3, 0.59, 0.11], np.float32)) < 0.7 * dial_lum)).astype(np.uint8)
left = cv2.dilate(left, np.ones((9, 9), np.uint8))
bgr = cv2.cvtColor(out.clip(0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR)
bgr = cv2.inpaint(bgr, left, 9, cv2.INPAINT_TELEA)
clean = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
clean = cv2.resize(clean, (w, h), interpolation=cv2.INTER_AREA)

# crop square around the dial, upscale, grade
half = int(max(rx, ry) * 1.12)
X0, Y0 = int(cx - half), int(cy - half)
crop = clean[max(Y0, 0):Y0 + 2 * half, max(X0, 0):X0 + 2 * half]
size = int(2 * half * UP)
big = Image.fromarray(crop).resize((size, size), Image.LANCZOS)
g = grade(np.asarray(big), "mono")
dial = Image.fromarray(g)
s = UP
ccx, ccy = (cx - X0) * s, (cy - Y0) * s
ink_rgb = tuple(int(v) for v in np.percentile(g.reshape(-1, 3), 3, axis=0))

# soft round alpha so the dial sits on black like the film
a = np.zeros((size, size), np.float32)
Y, X = np.mgrid[0:size, 0:size]
e = ((X - ccx) / (rx * s * 1.04)) ** 2 + ((Y - ccy) / (ry * s * 1.04)) ** 2
a = np.clip((1.18 - e) / 0.18, 0, 1)
rgba = np.dstack([np.asarray(dial), (a * 255).astype(np.uint8)])
Image.fromarray(rgba, "RGBA").save(OUT / "clock_dial.png")

meta_p = OUT / "meta.json"
meta = json.loads(meta_p.read_text())
meta["clock"] = {
    "size": size,
    "center": [round(ccx, 1), round(ccy, 1)],
    "radius": [round(rx * s, 1), round(ry * s, 1)],
    "ink": list(ink_rgb),
    "hand": prof,                     # [distance from pivot, half-width], both in dial radii
    "tail": round((tail - pivot_y) / ry, 4),
    "offset": round((mid - cx) / rx, 4),
}
meta_p.write_text(json.dumps(meta, indent=2))
print(json.dumps({k: v for k, v in meta["clock"].items() if k != "hand"}), len(prof), "profile rows")
