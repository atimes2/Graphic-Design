"""Sound effects for each card, synthesized from the card's cue list.

SFX only, no music: knife "shing", stab, slash, impacts, candle ignition,
neon buzz, laser zaps, stamp, heartbeat, risers. Nothing sampled or licensed.

usage: python3 audio.py cues.json out.wav
"""
import json
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
rng = np.random.default_rng(31)


def t_axis(d):
    return np.arange(int(d * SR)) / SR


def env(n, a, d, curve=5.0):
    """attack seconds a, exponential decay time-constant-ish d"""
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), np.exp(-(t - a) * curve / max(d, 1e-4)))
    return e


def bp(x, lo, hi, order=2):
    sos = butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return sosfilt(sos, x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)


def sweep_bp(x, f0, f1, q=1.2, segs=48):
    """band-pass whose centre glides f0->f1 (overlap-add of static filters)"""
    n = len(x)
    out = np.zeros(n)
    hop = n // segs + 1
    win = np.hanning(hop * 2)
    for i in range(segs + 1):
        s = i * hop - hop
        a, b = max(0, s), min(n, s + 2 * hop)
        if b <= a:
            continue
        fc = f0 * (f1 / f0) ** (i / segs)
        lo, hi = fc / (1 + 1 / q), min(fc * (1 + 1 / q), SR / 2 - 100)
        y = bp(x[a:b], lo, hi)
        w = win[(a - s):(b - s)]
        out[a:b] += y * w
    return out


def noise(d):
    return rng.standard_normal(int(d * SR))


# --------------------------------------------------------------------- sounds
def shing(gain=1.0):
    d = 2.2
    t = t_axis(d)
    y = np.zeros_like(t)
    for f, a, dec in [(2870, 0.5, 1.4), (4130, 0.4, 1.1), (6310, 0.3, 0.9), (8940, 0.25, 0.7), (11700, 0.15, 0.5), (1720, 0.25, 1.8)]:
        y += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t / dec * 2.2)
    y *= env(len(t), 0.006, d, 1.0)
    y += hp(noise(d), 5000) * np.exp(-t * 18) * 0.35
    return y * 0.28 * gain


def ignite():
    d = 2.2
    n = noise(d)
    y = sweep_bp(n, 180, 1400, q=0.8) * env(len(n), 0.18, 1.6, 3.0)
    t = t_axis(d)
    y += 0.5 * np.sin(2 * np.pi * 58 * t) * env(len(t), 0.05, 1.0, 4.0)
    return y * 0.35


def swell():
    d = 3.0
    t = t_axis(d)
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    y = (np.sin(2 * np.pi * 55 * t) + 0.5 * np.sin(2 * np.pi * 82.4 * t)) * e
    y += lp(noise(d), 300) * e * 0.8
    return y * 0.22


def blade():
    d = 1.6
    n = noise(d)
    y = sweep_bp(n, 1800, 6000, q=3) * env(len(n), 0.25, 1.2, 4.0)
    t = t_axis(d)
    y += 0.2 * np.sin(2 * np.pi * 3320 * t) * env(len(t), 0.4, 1.2, 3.0)
    return y * 0.22


def burn(dur=1.5):
    d = dur + 0.8
    n = hp(noise(d), 3000) * 0.15
    crack = np.zeros(int(d * SR))
    for _ in range(int(dur * 28)):
        i = rng.integers(0, int(dur * SR))
        L = rng.integers(40, 240)
        crack[i:i + L] += rng.standard_normal(L) * np.exp(-np.arange(L) / 30) * rng.uniform(0.3, 1)
    y = n + hp(crack, 1200) * 0.5
    t = t_axis(d)
    y *= np.clip(t / 0.2, 0, 1) * np.clip((d - t) / 0.8, 0, 1)
    return y * 0.3


def pad(d=6.0):
    t = t_axis(d)
    y = np.zeros_like(t)
    for f in [164.8, 196.0, 246.9, 82.4]:
        for det in (-0.6, 0.6):
            y += np.sin(2 * np.pi * (f + det) * t)
    y = lp(y, 900) * np.clip(t / 1.4, 0, 1) * np.clip((d - t) / 1.0, 0, 1)
    return y * 0.035


def slash():
    d = 1.8
    n = noise(d)
    sw = sweep_bp(n, 7000, 900, q=1.5) * env(len(n), 0.03, 0.35, 4.0)
    return sw * 0.9 + shing(0.6) [: len(sw)] * 0.7 + hit(0.4)[: len(sw)]


def whoosh(dur=0.6):
    """rises for `dur` seconds and peaks at the end (placed to end on the cue)"""
    d = dur + 0.15
    n = noise(d)
    t = t_axis(d)
    e = np.where(t < dur, (t / dur) ** 2.2, np.exp(-(t - dur) * 30))
    return sweep_bp(n, 300, 3000, q=1.0, segs=24) * e * 0.9


def stab():
    d = 1.4
    t = t_axis(d)
    y = hit(0.75)[: len(t)]
    ring = sum(a * np.sin(2 * np.pi * f * t) for f, a in [(2150, 0.5), (3470, 0.35), (5200, 0.2)])
    y += ring * np.exp(-t * 7) * 0.12
    y += hp(noise(d), 4000) * np.exp(-t * 45) * 0.3
    return y


def tick(gain=1.0):
    d = 0.35
    t = t_axis(d)
    f = 60 + 110 * np.exp(-t * 40)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 16)
    y += hp(noise(d), 2500) * np.exp(-t * 90) * 0.4
    return np.tanh(y * 1.5) * 0.4 * gain


def buzz(dur=0.35):
    """neon tube catching: gated mains buzz + crackle, gating follows the flicker-on"""
    d = dur + 0.1
    t = t_axis(d)
    y = sum(np.sin(2 * np.pi * 120 * k * t) / k for k in range(1, 12))
    steps = [0.0, 0.85, 0.1, 0.55, 0.0, 0.9, 0.6, 1.0]
    idx = np.minimum((t / dur * len(steps)).astype(int), len(steps) - 1)
    gate = np.array(steps)[idx]
    gate = np.convolve(gate, np.ones(200) / 200, mode="same")
    y = bp(y, 150, 3500) * gate * np.clip((d - t) / 0.08, 0, 1)
    y += hp(noise(d), 3000) * (np.abs(np.diff(gate, prepend=0)) > 0.0005) * 0.6
    return y * 0.12


def laser(i=0):
    d = 0.32
    t = t_axis(d)
    f0 = [2600, 2200, 2900, 2400][i % 4]
    f = 260 + (f0 - 260) * np.exp(-t * 26)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph + 2.5 * np.sin(ph * 0.5)) * np.exp(-t * 11)
    return bp(y, 200, 6000) * 0.16


def air():
    """soft breathy swell under a fade-in"""
    d = 1.2
    t = t_axis(d)
    e = np.where(t < 0.35, (t / 0.35) ** 2, np.exp(-(t - 0.35) * 4))
    return bp(noise(d), 500, 2600) * e * 0.12


def stamp():
    d = 1.6
    t = t_axis(d)
    f = 38 + 50 * np.exp(-t * 14)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.5)
    y += lp(noise(d), 900) * np.exp(-t * 25) * 0.9
    y += hp(noise(d), 1800) * np.exp(-t * 70) * 0.5
    return np.tanh(y * 1.8) * 0.6


def hit(gain=1.0):
    d = 2.5
    t = t_axis(d)
    f = 35 + 60 * np.exp(-t * 9)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * env(len(t), 0.003, 1.6, 3.0)
    y += lp(noise(d), 1500) * np.exp(-t * 30) * 0.6
    y += hp(noise(d), 3000) * np.exp(-t * 60) * 0.25          # transient crack
    return np.tanh(y * 1.4) * 0.55 * gain


def heart():
    d = 0.8
    t = t_axis(d)
    y = np.zeros_like(t)
    for o, a in [(0, 1), (0.26, 0.7)]:
        tt = np.clip(t - o, 0, None)
        y += a * np.sin(2 * np.pi * 48 * tt) * np.exp(-tt * 16) * (t >= o)
    return lp(y, 200) * 0.7


def riser(dur=0.9):
    t = t_axis(dur)
    f = 180 * (4.5 ** (t / dur))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / dur) ** 2 * 0.25
    y += hp(noise(dur), 2000) * (t / dur) ** 3 * 0.25
    return y


def carve(dur=1.2):
    n = noise(dur + 0.2)
    rough = np.repeat(rng.uniform(0.2, 1, int(np.ceil(len(n) / (SR // 60))) + 1), SR // 60)[: len(n)]
    y = bp(n, 1400, 3600) * rough
    t = t_axis(dur + 0.2)
    y *= np.clip(t / 0.05, 0, 1) * np.clip((dur + 0.2 - t) / 0.3, 0, 1)
    return y * 0.25


SFX = {
    "glint": lambda c: shing(c.get("gain", 1.0)),
    "ignite": lambda c: ignite(),
    "swell": lambda c: swell(),
    "blade": lambda c: blade(),
    "burn": lambda c: burn(c.get("dur", 1.5)),
    "slash": lambda c: slash(),
    "whoosh": lambda c: whoosh(c.get("dur", 0.6)),
    "stab": lambda c: stab(),
    "tick": lambda c: tick(c.get("gain", 1.0)),
    "buzz": lambda c: buzz(c.get("dur", 0.35)),
    "laser": lambda c: laser(c.get("i", 0)),
    "stamp": lambda c: stamp(),
    "air": lambda c: air(),
    "hit": lambda c: hit(c.get("gain", 1.0)),
    "heart": lambda c: heart(),
    "riser": lambda c: riser(c.get("dur", 0.9)),
    "carve": lambda c: carve(c.get("dur", 1.2)),
}


def reverb(x, secs=2.6, wet=0.28):
    n = int(secs * SR)
    t = np.arange(n) / SR
    irl = rng.standard_normal(n) * np.exp(-t * 6.5 / secs)
    irr = rng.standard_normal(n) * np.exp(-t * 6.5 / secs)
    irl, irr = lp(irl, 5000), lp(irr, 5000)
    irl /= np.sqrt((irl ** 2).sum())
    irr /= np.sqrt((irr ** 2).sum())
    return fftconvolve(x, irl)[: len(x)] * wet, fftconvolve(x, irr)[: len(x)] * wet


def add_cues(mono, cues, offset=0.0):
    for c in cues:
        fn = SFX.get(c["type"])
        if not fn:
            continue
        s = fn(c) * c.get("level", 1.0)
        t0 = c["t"] - (c.get("dur", 0.6) if c["type"] == "whoosh" else 0)   # whooshes end on the cue
        i = max(0, int((t0 + offset) * SR))
        j = min(len(mono), i + len(s))
        if j > i:
            mono[i:j] += s[: j - i]


def main(cues_path, out_path):
    card = json.load(open(cues_path))
    d = card["duration"]
    L = int(d * SR)
    mono = np.zeros(L + 3 * SR)
    add_cues(mono, card.get("cues", []))
    wl, wr = reverb(mono, secs=1.8, wet=0.2)
    st = np.stack([mono + wl, mono * 0.98 + wr], 1)[:L]
    fade = int(0.25 * SR)
    st[-fade:] *= np.linspace(1, 0, fade)[:, None]
    st[:120] *= np.linspace(0, 1, 120)[:, None]

    # loudness: -16 LUFS integrated, soft-limited to about -1.5 dBFS peak
    import pyloudnorm as pyln
    meter = pyln.Meter(SR)
    lufs = meter.integrated_loudness(st)
    if np.isfinite(lufs):
        st = pyln.normalize.loudness(st, lufs, -16.0)
    ceil = 10 ** (-1.5 / 20)
    st = np.tanh(st / ceil) * ceil
    wavfile.write(out_path, SR, (st * 32767).astype(np.int16))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
