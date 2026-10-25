"""Original score + SFX + voiceover mix (no licensed audio, safe for ads).

Output: build/audio/mix.wav (stereo 44.1k) plus stems for re-editing.
"""
import subprocess
from pathlib import Path

import numpy as np

from timeline import NUMWORDS, ROOT, build, word_time

SR = 44100
OUT = ROOT / "build" / "audio"
rng = np.random.default_rng(7)

BPM = 140
BEAT = 60 / BPM
BAR = 4 * BEAT
# A minor epic: Am | F | Dm | E  (root midi notes)
PROG = [(57, [0, 3, 7]), (53, [0, 4, 7]), (50, [0, 3, 7]), (52, [0, 4, 7])]


def midi(n):
    return 440 * 2 ** ((n - 69) / 12)


def env_exp(n, decay):
    return np.exp(-np.arange(n) / SR / decay)


def onepole_lp(x, cutoff):
    """One-pole low-pass; cutoff may be a scalar or per-sample array."""
    c = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = 1 - np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def add(buf, sig, t):
    i = int(t * SR)
    if i < 0:
        sig, i = sig[-i:], 0
    j = min(len(buf), i + len(sig))
    if j > i:
        buf[i:j] += sig[: j - i]


# ---------- instruments ----------

def kick():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t / 0.035)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.16)
    s[:200] += rng.uniform(-1, 1, 200) * np.linspace(0.6, 0, 200)
    return np.tanh(s * 1.8) * 0.9


def bass808(note, length):
    n = int(length * SR)
    t = np.arange(n) / SR
    f0 = midi(note - 24)
    f = f0 * (1 + 0.9 * np.exp(-t / 0.03))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.55)
    return np.tanh(s * 2.2) * 0.55


def clap():
    n = int(0.25 * SR)
    noise = rng.uniform(-1, 1, n)
    e = env_exp(n, 0.06)
    for d in (0.0, 0.011, 0.022):  # flam
        k = int(d * SR)
        e[k:] += env_exp(n - k, 0.012) * 0.6
    s = noise * e
    s = s - onepole_lp(s, 900)  # high-pass-ish
    return s * 0.45


def hat(open_=False):
    n = int((0.18 if open_ else 0.04) * SR)
    s = rng.uniform(-1, 1, n)
    s = s - onepole_lp(s, 6000)
    return s * env_exp(n, 0.06 if open_ else 0.012) * 0.22


def pluck(note, length=0.32):
    n = int(length * SR)
    t = np.arange(n) / SR
    f = midi(note)
    s = sum(np.sign(np.sin(2 * np.pi * f * d * t)) for d in (1.0, 1.004)) / 2
    s = onepole_lp(s * env_exp(n, 0.09), 2600 * np.exp(-t / 0.08) + 400)
    return s * 0.16


def pad_chord(root, ivs, length):
    n = int(length * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for iv in ivs + [12]:
        f = midi(root + iv - 12)
        for d in (-0.08, 0, 0.08):
            ph = rng.uniform(0, 1)
            s += ((t * f * 2 ** (d / 12) + ph) % 1) * 2 - 1
    s = onepole_lp(s / 12, 1100)
    att = np.minimum(1, t / 0.25)
    rel = np.minimum(1, (length - t) / 0.2)
    return s * att * rel * 0.28


def bell(note, length=1.4):
    n = int(length * SR)
    t = np.arange(n) / SR
    f = midi(note)
    s = sum(a * np.sin(2 * np.pi * f * r * t) for a, r in ((1, 1), (0.5, 2.76), (0.3, 5.4)))
    return s * env_exp(n, 0.5) * 0.12


# ---------- music sections ----------

def beat_section(dur, intensity=1.0, arp=True):
    """Half-time trap groove over the progression for `dur` seconds."""
    buf = np.zeros(int(dur * SR) + SR)
    k, c = kick(), clap()
    nbars = int(np.ceil(dur / BAR))
    for b in range(nbars):
        t0 = b * BAR
        root, ivs = PROG[b % 4]
        add(buf, pad_chord(root, ivs, BAR + 0.05), t0)
        for kb in (0, 1.75, 2.5) if b % 2 == 0 else (0, 1.75, 3.25, 3.5):
            add(buf, k * intensity, t0 + kb * BEAT)
        add(buf, bass808(root, BEAT * 1.7), t0)
        add(buf, bass808(root + (3 if b % 2 else 0), BEAT * 1.4), t0 + 2.5 * BEAT)
        add(buf, c * intensity, t0 + 2 * BEAT)
        for h in range(8):
            add(buf, hat(open_=(h == 7 and b % 2 == 1)), t0 + h * BEAT / 2)
        if b % 2 == 1:  # hat roll
            for r in range(6):
                add(buf, hat() * 0.8, t0 + 3 * BEAT + r * BEAT / 6)
        if arp:
            notes = [root + 12 + iv for iv in ivs] + [root + 24]
            for a in range(8):
                add(buf, pluck(notes[(a * 3) % 4]), t0 + a * BEAT / 2)
    return buf[: int(dur * SR)]


def break_section(dur):
    buf = np.zeros(int(dur * SR))
    add(buf, pad_chord(52, [0, 4, 7], dur), 0)
    return buf


# ---------- SFX ----------

def whoosh(length=0.38, up=True):
    n = int(length * SR)
    t = np.linspace(0, 1, n)
    shape = np.sin(np.pi * t) ** 2
    cut = 300 + 5000 * (t if up else 1 - t) ** 1.5
    s = onepole_lp(rng.uniform(-1, 1, n), cut)
    return s * shape * 0.9


def impact(big=False):
    n = int((1.6 if big else 0.9) * SR)
    t = np.arange(n) / SR
    f = 32 + 70 * np.exp(-t / 0.08)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.45 if big else 0.28)
    crack = onepole_lp(rng.uniform(-1, 1, n), 2500) * env_exp(n, 0.05)
    metal = sum(np.sin(2 * np.pi * fr * t) for fr in (183, 297, 431, 612)) * env_exp(n, 0.18) * 0.08
    return np.tanh((sub * 1.2 + crack * 0.9 + metal) * 1.5) * (0.95 if big else 0.75)


def riser(length):
    n = int(length * SR)
    t = np.linspace(0, 1, n)
    noise = onepole_lp(rng.uniform(-1, 1, n), 400 + 7000 * t ** 2)
    f = 180 + 900 * t ** 2
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    return (noise * 0.7 + tone) * t ** 1.8 * 0.7


def tick():
    n = int(0.018 * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * 2100 * t) * env_exp(n, 0.004) * 0.18


def pop():
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    f = 500 + 900 * (t / t[-1])
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.03) * 0.5


def skitter(length):
    buf = np.zeros(int(length * SR))
    for _ in range(int(length * 90)):
        n = int(0.004 * SR)
        click = rng.uniform(-1, 1, n) * env_exp(n, 0.001)
        add(buf, click * rng.uniform(0.1, 0.3), rng.uniform(0, length - 0.01))
    return buf - onepole_lp(buf, 1500)


def glitch(length=0.12):
    n = int(length * SR)
    t = np.arange(n) / SR
    f = rng.choice([220, 330, 880, 1320])
    return np.sign(np.sin(2 * np.pi * f * t)) * 0.12 * (rng.uniform(size=n) > 0.3)


def reverse_swell(length=0.7):
    s = impact(big=True)[: int(length * SR)][::-1].copy()
    return s * np.linspace(0, 1, len(s)) ** 2


# ---------- mix ----------

def read_wav(path):
    raw = subprocess.check_output(["ffmpeg", "-loglevel", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"])
    return np.frombuffer(raw, dtype=np.float32).astype(float)


def write_wav(path, x):
    ch = 1 if x.ndim == 1 else x.shape[1]
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", str(ch), "-i", "-",
                    "-c:a", "pcm_s16le", str(path)], input=x.astype(np.float32).tobytes(), check=True)


def reveal_time(seg):
    """Absolute time the rank number is spoken (the slam)."""
    return seg["start"] + (word_time(seg, NUMWORDS[seg["rank"]]) or 0.0)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    segs, total = build()
    by = {s["id"]: s for s in segs}
    N = int(total * SR) + SR
    vo, music, sfx = np.zeros(N), np.zeros(N), np.zeros(N)

    for s in segs:
        add(vo, read_wav(ROOT / "build" / "vo" / f"{s['id']}.wav"), s["start"])

    # Music: groove from frame 1 -> break on "top four" -> drop at #4 -> cut before #1 -> big drop.
    br, r4, r1 = by["bridge"], by["r4"], by["r1"]
    add(music, beat_section(br["start"]), 0)
    add(music, break_section(br["dur"]), br["start"])
    r1_hit = reveal_time(r1)
    add(music, beat_section(r1["start"] - r4["start"], intensity=1.1), r4["start"])
    add(music, beat_section(total - r1_hit, intensity=1.2), r1_hit)
    # short fade at the very end so the loop restart is clean
    fade = int(0.25 * SR)
    end = int(total * SR)
    music[end - fade:end] *= np.linspace(1, 0, fade)
    music[end:] = 0

    # SFX cues
    add(sfx, whoosh() * 0.6, 0.0)
    add(sfx, impact() * 0.8, 0.02)
    hook = by["hook"]
    for i in range(9):  # montage flicker ticks
        add(sfx, glitch(0.05), 0.12 + i * 0.22)
    t_num = hook["start"] + (word_time(hook, "Number") or 2.3)
    add(sfx, impact() * 0.7, t_num)
    for s in segs:
        if "rank" not in s:
            continue
        hit = reveal_time(s)
        big = s["rank"] == 1
        add(sfx, whoosh(), hit - 0.3)
        add(sfx, impact(big=big) * (1.0 if big else 0.75), hit)
        fill0 = hit + 0.55
        for k in range(14):
            add(sfx, tick(), fill0 + k * 0.065)
    add(sfx, riser(br["dur"]) * 0.9, br["start"])
    add(sfx, glitch(0.2), br["start"] + 0.05)
    add(sfx, reverse_swell(0.7), r1_hit - 0.7)
    r8 = by["r8"]
    add(sfx, pop(), r8["start"] + (word_time(r8, "Fight") or 4.3))
    r5 = by["r5"]
    t_sp = r5["start"] + (word_time(r5, "He", 1) or 2.6)
    add(sfx, skitter(r5["end"] - t_sp) * 0.9, t_sp)
    cta = by["cta"]
    add(sfx, whoosh(up=False) * 0.6, cta["start"] - 0.2)
    add(sfx, pop(), cta["start"] + (word_time(cta, "Comment") or 1.3))
    add(sfx, pop(), cta["start"] + (word_time(cta, "follow") or 2.4))

    # Sidechain-duck the music under the voice.
    env = np.abs(vo)
    win = int(0.04 * SR)
    env = np.convolve(env, np.ones(win) / win, mode="same")
    env = np.minimum(1, env / (np.percentile(env[env > 1e-4], 90) + 1e-9))
    rel = int(0.25 * SR)
    env = np.maximum(env, np.convolve(env, np.ones(rel) / rel, mode="same"))
    duck = 1 - 0.45 * env

    music_n = music / (np.abs(music).max() + 1e-9)
    sfx_n = sfx / (np.abs(sfx).max() + 1e-9)
    vo_n = vo / (np.abs(vo).max() + 1e-9)
    mix = vo_n * 1.0 + music_n * 0.30 * duck + sfx_n * 0.42

    # Light stereo width: music/sfx slightly decorrelated.
    d = int(0.012 * SR)
    side = np.zeros(N)
    side[d:] = (music_n * 0.30 * duck + sfx_n * 0.2)[:-d]
    L = mix + 0.12 * side
    R = mix - 0.12 * side
    st = np.stack([L, R], 1)[: int(total * SR)]
    st = np.tanh(st * 1.1) / np.tanh(1.1)  # soft clip
    st *= 0.93 / np.abs(st).max()

    write_wav(OUT / "mix_pre.wav", st)
    write_wav(OUT / "stem_vo.wav", vo_n[: int(total * SR)])
    write_wav(OUT / "stem_music.wav", music_n[: int(total * SR)] * 0.9)
    write_wav(OUT / "stem_sfx.wav", sfx_n[: int(total * SR)] * 0.9)
    # Loudness-normalise to TikTok-ish -14 LUFS.
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(OUT / "mix_pre.wav"),
                    "-af", "loudnorm=I=-14:TP=-1.0:LRA=9", "-ar", str(SR), str(OUT / "mix.wav")], check=True)
    print("audio done", round(total, 2), "s")


if __name__ == "__main__":
    main()
