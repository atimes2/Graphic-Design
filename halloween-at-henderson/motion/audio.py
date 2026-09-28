"""Original sound design for each card, synthesized from the card's cue list.

Nothing sampled or licensed: a low drone bed, an original 7/8 piano ostinato
(deliberately not the Carpenter theme), and synthesized SFX (knife "shing",
candle ignition, ember sizzle, slash, impacts, heartbeat).

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
def piano(freq, d=2.4, vel=0.5):
    t = t_axis(d)
    y = np.zeros_like(t)
    for k, amp in enumerate([1, 0.5, 0.3, 0.18, 0.1, 0.06], start=1):
        f = freq * k * (1 + 0.0004 * k * k)
        y += amp * np.sin(2 * np.pi * f * t) * np.exp(-t * (1.6 + 0.9 * k))
    y *= env(len(t), 0.004, d, 1.0)
    hammer = hp(noise(0.02), 2000) * np.linspace(1, 0, int(0.02 * SR)) * 0.08
    y[: len(hammer)] += hammer
    return y * vel


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


def credit(i=0):
    notes = [82.41, 77.78, 82.41, 73.42]
    f = notes[i % 4]
    return (piano(f, 3.0, 0.5) + piano(f * 2, 3.0, 0.25)) * 0.8


def slash():
    d = 1.8
    n = noise(d)
    sw = sweep_bp(n, 7000, 900, q=1.5) * env(len(n), 0.03, 0.35, 4.0)
    return sw * 0.9 + shing(0.6) [: len(sw)] * 0.7 + hit(0.4)[: len(sw)]


def whoosh():
    d = 0.9
    n = noise(d)
    t = t_axis(d)
    e = (t / d) ** 2.5
    return sweep_bp(n, 250, 2400, q=1.0) * e * 0.8


def hit(gain=1.0):
    d = 2.5
    t = t_axis(d)
    f = 35 + 60 * np.exp(-t * 9)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * env(len(t), 0.003, 1.6, 3.0)
    y += lp(noise(d), 1500) * np.exp(-t * 30) * 0.6
    for fr in [41.2, 43.65, 61.7]:
        y += piano(fr, d, 0.35)[: len(t)]
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
    rough = np.repeat(rng.uniform(0.2, 1, int((dur + 0.2) * 60)), SR // 60)[: len(n)]
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
    "credit": lambda c: credit(c.get("i", 0)),
    "slash": lambda c: slash(),
    "whoosh": lambda c: whoosh(),
    "hit": lambda c: hit(c.get("gain", 1.0)),
    "heart": lambda c: heart(),
    "riser": lambda c: riser(c.get("dur", 0.9)),
    "carve": lambda c: carve(c.get("dur", 1.2)),
}


# ------------------------------------------------------------------- the bed
def drone(d, loop_period=None):
    t = t_axis(d)
    if loop_period:
        # every modulation is periodic in loop_period so the loop is seamless
        m = lambda k, ph=0: np.sin(2 * np.pi * k * t / loop_period + ph)
        fs = [41.2, 61.875, 82.5]  # tuned to integer cycles over 8s
        fs = [round(f * loop_period) / loop_period for f in fs]
        y = sum(np.sin(2 * np.pi * f * t) * (0.6 + 0.4 * m(1, i)) for i, f in enumerate(fs))
        wind = lp(np.tile(noise(loop_period), int(np.ceil(d / loop_period)) + 1)[: len(t)], 380) * (0.6 + 0.4 * m(2))
    else:
        y = sum(np.sin(2 * np.pi * f * t + i) * (0.7 + 0.3 * np.sin(2 * np.pi * t / (5 + i))) for i, f in enumerate([41.2, 61.7, 82.4]))
        wind = lp(noise(d), 380) * (0.6 + 0.4 * np.sin(2 * np.pi * t / 7))
    return y * 0.05 + wind * 0.05


def ostinato(d, start, eighth=0.2, gain=1.0):
    """original 7/8 figure in E phrygian: restless, not the film theme"""
    hi = [659.3, 493.9, 659.3, 493.9, 698.5, 493.9, 587.3]
    lo = [82.41, 82.41, 87.31, 73.42]
    out = np.zeros(int(d * SR) + SR * 3)
    k = 0
    tt = start
    while tt < d - 0.05:
        i = int(tt * SR)
        note = piano(hi[k % 7], 1.2, 0.16 if k % 7 else 0.22)
        out[i:i + len(note)] += note
        if k % 7 == 0:
            bass = piano(lo[(k // 7) % 4], 2.6, 0.4) + piano(lo[(k // 7) % 4] * 2, 2.6, 0.14)
            out[i:i + len(bass)] += bass
        k += 1
        tt += eighth
    return out * gain


def reverb(x, secs=2.6, wet=0.28):
    n = int(secs * SR)
    t = np.arange(n) / SR
    irl = rng.standard_normal(n) * np.exp(-t * 6.5 / secs)
    irr = rng.standard_normal(n) * np.exp(-t * 6.5 / secs)
    irl, irr = lp(irl, 5000), lp(irr, 5000)
    irl /= np.sqrt((irl ** 2).sum())
    irr /= np.sqrt((irr ** 2).sum())
    return fftconvolve(x, irl)[: len(x)] * wet, fftconvolve(x, irr)[: len(x)] * wet


MUSIC_START = {
    "01-the-return": 1.6,
    "02-the-details": 0.0,
    "03-countdown": 1.45,
    "04-dress-to-kill": 2.9,
    "05-rsvp": 0.0,
    "06-tonight": 2.0,
}


def add_cues(mono, cues, offset=0.0):
    for c in cues:
        fn = SFX.get(c["type"])
        if not fn:
            continue
        s = fn(c)
        i = int((c["t"] + offset) * SR)
        j = min(len(mono), i + len(s))
        if j > i:
            mono[i:j] += s[: j - i]


def main(cues_path, out_path):
    card = json.load(open(cues_path))
    cid, d, loop = card["id"], card["duration"], card.get("loop", False)
    L = int(d * SR)
    tail = 4 * SR

    if loop:
        # Everything is periodic in d: render three cycles (with reverb) and
        # keep the middle one, so ringing notes and reverb wrap seamlessly.
        n = 3 * L + tail
        mono = np.zeros(n)
        o = ostinato(3 * d, 0.0, d / 35) * 0.75  # 5 bars of 7/8 per loop
        mono[: min(len(o), n)] += o[:n]
        mono[: 3 * L] += drone(3 * d, loop_period=d)
        for k in range(3):
            add_cues(mono, card["cues"], k * d)
        wl, wr = reverb(mono)
        st = np.stack([mono + wl, mono * 0.98 + wr], 1)[L:2 * L]
    else:
        mono = np.zeros(L + tail)
        mono[:L] += drone(d)
        key = next((k for k in MUSIC_START if cid.startswith(k)), None)
        ms = MUSIC_START.get(key, 0.0)
        o = ostinato(d, ms, 0.17 if cid.startswith("06") else 0.2) * 0.7
        ramp = np.clip((np.arange(len(o)) / SR - ms) / 2.5, 0, 1)  # music creeps in
        o *= ramp
        k = min(len(o), len(mono))
        mono[:k] += o[:k]
        add_cues(mono, card["cues"])
        wl, wr = reverb(mono)
        st = np.stack([mono + wl, mono * 0.98 + wr], 1)[:L]
        fade = int(0.35 * SR)
        st[-fade:] *= np.linspace(1, 0, fade)[:, None]
        st[:240] *= np.linspace(0, 1, 240)[:, None]

    # loudness: -16 LUFS integrated, soft-limited to about -1.5 dBFS peak
    import pyloudnorm as pyln
    meter = pyln.Meter(SR)
    st = pyln.normalize.loudness(st, meter.integrated_loudness(st), -16.0)
    ceil = 10 ** (-1.5 / 20)
    st = np.tanh(st / ceil) * ceil
    wavfile.write(out_path, SR, (st * 32767).astype(np.int16))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
