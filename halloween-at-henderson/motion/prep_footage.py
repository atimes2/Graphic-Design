"""Archival clips for the collab Reels -> footage/<key>/NNNN.jpg (graded, 30fps).

Reads reel/footage.json. Sources are the archive.org Prelinger films listed in
reel/SOURCES.md, downloaded to $FOOTAGE_SRC (default: footage-src/) as
<identifier>.mp4. Each clip is cut, retimed to 30fps (optionally slowed),
scaled to the Reel's film panel (1000x750) and graded two ways:
  ember  luminance -> black / oxblood / ember / pumpkin / bone, with a little of
         the original colour kept so Kodachrome skin tones still read
  mono   warm black-and-white (the Special Bulletin Reel's old-TV look)
  color  the clip's own colour, lightly lifted (Holographic Realms' event footage)
Output: footage/<key>/<grade>/NNNN.jpg + footage/index.json (frame counts).
"""
import json, os, subprocess, sys
from pathlib import Path

import numpy as np
from PIL import Image
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent
SRC = Path(os.environ.get("FOOTAGE_SRC", ROOT / "footage-src"))
OUT = ROOT / "footage"
FF = imageio_ffmpeg.get_ffmpeg_exe()
W, H = 1000, 750

STOPS = {   # position: rgb
    "ember": [(0.0, (5, 3, 3)), (0.22, (40, 9, 6)), (0.48, (150, 40, 18)), (0.72, (236, 120, 52)), (0.9, (255, 214, 160)), (1.0, (255, 244, 228))],
    "mono":  [(0.0, (5, 3, 3)), (0.3, (42, 30, 26)), (0.65, (170, 140, 120)), (1.0, (255, 241, 224))],
    "blood": [(0.0, (3, 1, 1)), (0.28, (46, 4, 4)), (0.52, (140, 16, 10)), (0.76, (226, 78, 48)), (0.92, (255, 196, 168)), (1.0, (255, 240, 232))],
}
KEEP = {"ember": 0.18, "mono": 0.0, "blood": 0.0}   # share of the original colour mixed back in
# "color" keeps a clip's own colour (the visuals team's footage): only a gentle contrast lift


def lut(stops):
    xs = np.linspace(0, 1, 256)
    out = np.zeros((256, 3), np.float32)
    for c in range(3):
        out[:, c] = np.interp(xs, [p for p, _ in stops], [rgb[c] for _, rgb in stops])
    return out


LUTS = {k: lut(v) for k, v in STOPS.items()}


def grade(frame, kind):
    if kind == "color":
        f = frame.astype(np.float32) / 255
        return np.clip(255 * (f * f * (3 - 2 * f) * 0.35 + f * 0.65), 0, 255).astype(np.uint8)
    f = frame.astype(np.float32)
    lum = f @ np.array([0.3, 0.59, 0.11], np.float32)
    # normalise each clip's exposure a little, then an S-curve
    lo, hi = np.percentile(lum, 1), np.percentile(lum, 99.5)
    x = np.clip((lum - lo) / max(hi - lo, 1), 0, 1)
    x = x * x * (3 - 2 * x) * 0.6 + x * 0.4
    toned = LUTS[kind][np.clip(x * 255, 0, 255).astype(np.uint8)]
    k = KEEP[kind]
    if k:
        sat = f - lum[..., None]
        toned = toned + k * sat * (toned.mean(-1, keepdims=True) / 255 + 0.3)
    return np.clip(toned, 0, 255).astype(np.uint8)


def fetch(ident):
    """Download a film from archive.org if it isn't in SRC yet."""
    dst = SRC / f"{ident}.mp4"
    if dst.exists():
        return
    SRC.mkdir(parents=True, exist_ok=True)
    print(f"downloading {ident} ...")
    subprocess.run(["curl", "-sSL", "--retry", "3", "-o", str(dst), f"https://archive.org/download/{ident}/{ident}.mp4"], check=True)


def main(keys):
    clips = json.loads((ROOT / "reel" / "footage.json").read_text())
    for k, c in clips.items():
        if isinstance(c, dict) and (not keys or k in keys):
            fetch(c["src"])
    for key, c in clips.items():
        if key.startswith("_") or (keys and key not in keys):
            continue
        speed = c.get("speed", 1.0)
        src_dur = c["dur"] * speed
        if "full" in c:   # full-bleed 9:16 crop for the full-screen Reel
            f = c["full"]
            w, h = 1080, 1920
            crop = (f"crop=w='min(iw,ih*9/16)/{f['zoom']}':h='ih/{f['zoom']}'"
                    f":x='(iw-ow)*{f['fx']}':y='(ih-oh)*{f.get('fy', 0.5)}'")
            vf = f"setpts=PTS/{speed},fps=30,{crop},scale={w}:{h}:flags=lanczos,unsharp=5:5:0.8"
        elif "wide" in c:   # 16:9 for the venue TV; a string = crop applied first
            w, h = 1280, 720
            crop = f"{c['wide']}," if isinstance(c["wide"], str) else ""
            vf = f"setpts=PTS/{speed},fps=30,{crop}scale={w}:{h}:flags=lanczos,unsharp=5:5:0.6"
        else:
            w, h = W, H
            crop = f"{c['crop']}," if "crop" in c else ""   # e.g. 16:9 phone video cut to the panel's 4:3
            vf = f"setpts=PTS/{speed},fps=30,{crop}scale={W}:{H}:flags=lanczos,unsharp=5:5:0.6"
        cmd = [FF, "-loglevel", "error", "-ss", str(c["in"]), "-t", str(src_dur + 0.2), "-i", str(SRC / f"{c['src']}.mp4"),
               "-vf", vf, "-frames:v", str(round(c["dur"] * 30)), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
        raw = subprocess.run(cmd, capture_output=True, check=True).stdout
        frames = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)
        for kind in c.get("grades", ["ember", "mono"]):   # each Reel picks one grade
            d = OUT / key / kind
            d.mkdir(parents=True, exist_ok=True)
            for old in d.glob("*.jpg"):
                old.unlink()
            for i, fr in enumerate(frames):
                Image.fromarray(grade(fr, kind)).save(d / f"{i:04d}.jpg", quality=90)
        print(f"{key}: {len(frames)} frames")
    index = {}
    for k, c in clips.items():
        if k.startswith("_"):
            continue
        g = OUT / k / c.get("grades", ["ember"])[0]
        if g.exists():
            index[k] = {"frames": len(list(g.glob("*.jpg")))}
    (OUT / "index.json").write_text(json.dumps(index))


if __name__ == "__main__":
    main(sys.argv[1:])
