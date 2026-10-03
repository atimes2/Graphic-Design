"""TV ticket QR (reference/tv-qr.png) -> layers/qr.json, a clean module matrix.

The source PNG is resampled to its module grid (finder pattern = 7 modules)
so the TV loop can draw every module as a crisp, pixel-aligned square at any
size instead of scaling a bitmap. The matrix is re-encoded to a test image
and decoded again to prove it still scans.
"""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
SRC = ROOT.parent / "reference" / "tv-qr.png"

g = np.asarray(Image.open(SRC).convert("L")) < 128
ys, xs = np.where(g)
x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
# finder pattern width (first dark run on the top row of the code) = 7 modules
row = g[y0, x0:x1]
run = np.argmax(~row)
mod = run / 7
n = round((x1 - x0) / mod)
mod = (x1 - x0) / n
m = [[int(g[int(y0 + (r + 0.5) * mod), int(x0 + (c + 0.5) * mod)]) for c in range(n)] for r in range(n)]

# verify: re-render with a 4-module quiet zone and decode
px = 10
img = np.full(((n + 8) * px, (n + 8) * px), 255, np.uint8)
for r in range(n):
    for c in range(n):
        if m[r][c]:
            img[(r + 4) * px:(r + 5) * px, (c + 4) * px:(c + 5) * px] = 0
data = cv2.QRCodeDetector().detectAndDecode(img)[0]
assert data, "QR matrix did not decode"
(ROOT / "layers" / "qr.json").write_text(json.dumps({"n": n, "data": data, "m": m}))
print(f"{n}x{n} modules -> {data}")
