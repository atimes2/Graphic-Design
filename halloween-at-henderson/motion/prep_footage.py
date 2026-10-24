"""Archival clips for the collab Reels -> footage/<key>/NNNN.jpg (graded, 30fps).

Reads reel/footage.json. Sources are the archive.org Prelinger films listed in
reel/SOURCES.md, downloaded to $FOOTAGE_SRC (default: footage-src/) as
<identifier>.mp4. Each clip is cut, retimed to 30fps (optionally slowed),
scaled to the Reel's film panel (1000x750) and graded two ways:
  ember  luminance -> black / oxblood / ember / pumpkin / bone, with a little of
         the original colour kept so Kodachrome skin tones still read
  mono   warm black-and-white (the Special Bulletin Reel's old-TV look)
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
}
KEEP = {"ember": 0.18, "mono": 0.0}   # share of the original colour mixed back in


def lut(stops):
    xs = np.linspace(0, 1, 256)
    out = np.zeros((256, 3), np.float32)
    for c in range(3):
        out[:, c] = np.interp(xs, [p for p, _ in stops], [rgb[c] for _, rgb in stops])
    return out


LUTS = {k: lut(v) for k, v in STOPS.items()}


def grade(frame, kind):
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
    for c in clips.values():
        if isinstance(c, dict):
            fetch(c["src"])
    for key, c in clips.items():
        if key.startswith("_") or (keys and key not in keys):
            continue
        speed = c.get("speed", 1.0)
        src_dur = c["dur"] * speed
        vf = f"setpts=PTS/{speed},fps=30,scale={W}:{H}:flags=lanczos,unsharp=5:5:0.6"
        cmd = [FF, "-loglevel", "error", "-ss", str(c["in"]), "-t", str(src_dur + 0.2), "-i", str(SRC / f"{c['src']}.mp4"),
               "-vf", vf, "-frames:v", str(round(c["dur"] * 30)), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
        raw = subprocess.run(cmd, capture_output=True, check=True).stdout
        frames = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
        for kind in STOPS:   # every clip in both grades; each Reel picks one
            d = OUT / key / kind
            d.mkdir(parents=True, exist_ok=True)
            for old in d.glob("*.jpg"):
                old.unlink()
            for i, fr in enumerate(frames):
                Image.fromarray(grade(fr, kind)).save(d / f"{i:04d}.jpg", quality=90)
        print(f"{key}: {len(frames)} frames")
    index = {k: {"frames": len(list((OUT / k / "ember").glob('*.jpg')))} for k in clips
             if not k.startswith("_") and (OUT / k / "ember").exists()}
    (OUT / "index.json").write_text(json.dumps(index))


if __name__ == "__main__":
    main(sys.argv[1:])
