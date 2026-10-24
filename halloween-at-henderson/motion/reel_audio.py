"""Soundtracks for the collab Reels -> reel/audio/<reel id>.wav (48 kHz stereo).

Spec: reel/audio.json. For each Reel:
  narration  lines are generated with Kokoro-82M (Apache-2.0, run locally via
             kokoro-onnx; model + voices from huggingface.co/onnx-community/
             Kokoro-82M-v1.0-ONNX, cached in $KOKORO_DIR) unless the WAV is
             already in reel/audio/vo/<reel>/<key>.wav, then given an old
             optical-soundtrack voice: band-limited, a little warmth, a small room
  clips      short lines of dialogue from public-domain films (reel/audio/clips/)
  music      slices of public-domain recordings from archive.org (downloaded to
             $MUSIC_SRC on first use), de-clicked and band-limited, ducked
             under the narration
Mixed to about -14 LUFS (Instagram's target) with a -1 dBFS ceiling.
"""
import json, os, subprocess, sys
from pathlib import Path

import numpy as np
from scipy import signal
import soundfile as sf
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent
SPEC = json.loads((ROOT / "reel" / "audio.json").read_text())
OUT = ROOT / "reel" / "audio"
MUSIC_SRC = Path(os.environ.get("MUSIC_SRC", ROOT / "music-src"))
KOKORO_DIR = Path(os.environ.get("KOKORO_DIR", ROOT / "kokoro"))
FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 48000


def load(path):
    raw = subprocess.run([FF, "-loglevel", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def bandpass(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return signal.sosfiltfilt(sos, x)


def declick(x):
    """Replace impulsive crackle (samples far above the local level) with the local median."""
    env = np.sqrt(signal.convolve(x * x, np.ones(480) / 480, mode="same")) + 1e-6
    spikes = np.abs(x) > 5 * env
    spikes = signal.convolve(spikes.astype(float), np.ones(24), mode="same") > 0
    med = signal.medfilt(x, 31)
    return np.where(spikes, med, x)


def level(x, win=1.2, lo=0.25, hi=8.0):
    """Slow automatic gain: even out a recording's loud and quiet passages."""
    a = np.exp(-1 / (win * SR))
    env = np.sqrt(signal.lfilter([1 - a], [1, -a], x * x) + 1e-12)
    env = signal.filtfilt([1 - a], [1, -a], env)
    target = np.sqrt(np.mean(x * x))
    return x * np.clip(target / env, lo, hi)


def vintage_voice(v):
    v = bandpass(v, 140, 5600)
    presence = bandpass(v, 1800, 3200)
    v = v + 0.35 * presence
    v = np.tanh(2.0 * v / (np.abs(v).max() + 1e-9)) / np.tanh(2.0)
    rng = np.random.default_rng(7)
    ir = rng.standard_normal(int(0.22 * SR)) * np.exp(-np.linspace(0, 9, int(0.22 * SR)))
    room = signal.fftconvolve(v, ir)[: len(v)]
    room /= np.abs(room).max() + 1e-9
    return v + 0.12 * room


def tts(lines, voice, speed, outdir):
    outdir.mkdir(parents=True, exist_ok=True)
    todo = [l for l in lines if not (outdir / f"{l['key']}.wav").exists()]
    if not todo:
        return
    from kokoro_onnx import Kokoro
    model, voices = KOKORO_DIR / "model.onnx", KOKORO_DIR / "voices.npz"
    if not model.exists():
        KOKORO_DIR.mkdir(parents=True, exist_ok=True)
        base = "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main"
        subprocess.run(["curl", "-sSL", "-o", str(model), f"{base}/onnx/model.onnx"], check=True)
        vb = KOKORO_DIR / f"{voice}.bin"
        subprocess.run(["curl", "-sSL", "-o", str(vb), f"{base}/voices/{voice}.bin"], check=True)
        np.savez(voices, **{voice: np.fromfile(vb, dtype=np.float32).reshape(-1, 1, 256)})
    k = Kokoro(str(model), str(voices))
    for l in todo:
        s, sr = k.create(l["text"], voice=voice, speed=speed, lang="en-us")
        sf.write(outdir / f"{l['key']}.wav", s, sr)
        print(f"  vo {l['key']}: {len(s) / sr:.2f}s")


def music_file(ident):
    MUSIC_SRC.mkdir(parents=True, exist_ok=True)
    p = MUSIC_SRC / f"{ident}.mp3"
    if not p.exists():
        meta = json.loads(subprocess.run(["curl", "-sSL", f"https://archive.org/metadata/{ident}"], capture_output=True, check=True).stdout)
        name = next(f["name"] for f in meta["files"] if f["name"].endswith(".mp3"))
        subprocess.run(["curl", "-sSL", "-o", str(p), f"https://archive.org/download/{ident}/{name}"], check=True)
    return p


def fade(n, fi, fo):
    g = np.ones(n)
    a, b = int(fi * SR), int(fo * SR)
    if a: g[:a] = np.linspace(0, 1, a)
    if b: g[-b:] = np.minimum(g[-b:], np.linspace(1, 0, b))
    return g


def build(rid, spec):
    n = int(spec["duration"] * SR)
    vo = np.zeros(n)
    vodir = OUT / "vo" / rid
    tts(spec.get("vo", []), spec.get("voice", "am_michael"), spec.get("speed", 1.0), vodir)
    for l in spec.get("vo", []):
        v = vintage_voice(load(vodir / f"{l['key']}.wav"))
        i = int(l["t"] * SR)
        vo[i:i + len(v)] += v[: n - i]
    # lines lifted from the films' own soundtracks (reel/audio/clips/, see SOURCES.md),
    # each cleaned and brought to the same speech level; the music ducks under them too
    for c in spec.get("clips", []):
        x = bandpass(declick(load(OUT / "clips" / c["file"])), 120, 6000)
        active = np.abs(x) > 0.1 * np.abs(x).max()
        x = x / (np.sqrt(np.mean(x[active] ** 2)) + 1e-9) * 0.25 * c.get("gain", 1.0)
        x = x * fade(len(x), 0.01, 0.06)
        i = int(c["t"] * SR)
        vo[i:i + len(x)] += x[: n - i]
    music = np.zeros(n)
    cache = {}
    for m in spec.get("music", []):
        if m["src"] not in cache:
            x = declick(load(music_file(m["src"])))
            x = level(bandpass(x, 70, 7500))
            cache[m["src"]] = x / (np.sqrt(np.mean(x ** 2)) + 1e-9)
        x = cache[m["src"]]
        a, d = int(m["from"] * SR), int(m["dur"] * SR)
        seg = x[a:a + d] * fade(len(x[a:a + d]), m.get("fadeIn", 0.05), m.get("fadeOut", 0.3)) * m.get("gain", 1.0)
        i = int(m["at"] * SR)
        music[i:i + len(seg)] += seg[: n - i]
    # duck the music under the narration: per-10ms peak, held, then a slow release
    if vo.any():
        blk = 480
        pk = np.abs(np.pad(vo, (0, -len(vo) % blk))).reshape(-1, blk).max(1)
        talk = (pk > 0.05 * pk.max()).astype(float)
        talk = np.convolve(talk, np.ones(25), mode="same") > 0           # bridge gaps under 0.25s
        r = np.exp(-1 / 30)                                               # ~0.3s release per block
        g = signal.lfilter([1 - r], [1, -r], talk.astype(float))
        g = np.maximum(g, talk)
        duck = 1 - 0.7 * np.repeat(g, blk)[:n]
    else:
        duck = np.ones(n)
    vo_n = vo / (np.sqrt(np.mean(vo[vo != 0] ** 2)) + 1e-9) if vo.any() else vo
    mus_n = music / (np.sqrt(np.mean(music ** 2)) + 1e-9)
    mix = 1.0 * vo_n + spec.get("musicLevel", 0.55) * mus_n * duck
    import pyloudnorm as pyln
    meter = pyln.Meter(SR)
    st = np.stack([mix, mix], 1)
    st = pyln.normalize.loudness(st, meter.integrated_loudness(st), -14.0)
    ceil = 10 ** (-1 / 20)
    st = np.tanh(st / ceil) * ceil
    out = OUT / f"{rid}.wav"
    sf.write(out, st.astype(np.float32), SR, subtype="PCM_16")
    print(f"{rid}: {out.relative_to(ROOT)}  {spec['duration']}s")


if __name__ == "__main__":
    for rid, spec in SPEC.items():
        if rid.startswith("_") or (sys.argv[1:] and not any(rid.startswith(a) for a in sys.argv[1:])):
            continue
        build(rid, spec)
