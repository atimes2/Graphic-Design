"""Generate per-segment voiceover clips + word timings with edge-tts.

Output: build/vo/<id>.mp3 and build/vo/timings.json
"""
import asyncio
import json
import ssl
import subprocess
from pathlib import Path

import edge_tts
import edge_tts.communicate
import numpy as np

# Trust the environment's CA bundle (outbound TLS is proxied) in addition to certifi.
_CA = Path("/root/.ccr/ca-bundle.crt")
if _CA.exists():
    edge_tts.communicate._SSL_CTX = ssl.create_default_context(cafile=str(_CA))

ROOT = Path(__file__).resolve().parent.parent
VO_DIR = ROOT / "build" / "vo"
SR = 44100

# TikTok pacing: jump-cut the natural sentence pauses down to a short breath.
MAX_GAP = 0.16   # seconds of silence kept where a longer pause was
EDGE_PAD = 0.03  # silence kept at the head and tail of each clip


def read_wav(path):
    raw = subprocess.check_output(["ffmpeg", "-loglevel", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"])
    return np.frombuffer(raw, dtype=np.float32).copy()


def write_wav(path, x):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", str(path)],
                   input=x.astype(np.float32).tobytes(), check=True)


def tighten(x, words):
    """Shorten silences longer than MAX_GAP and remap word timings onto the cut audio."""
    hop = int(SR * 0.01)
    n = len(x) // hop
    rms = np.sqrt((x[: n * hop].reshape(n, hop) ** 2).mean(1))
    voiced = rms > max(0.012, rms.max() * 0.03)
    idx = np.flatnonzero(voiced)
    first, last = idx[0], idx[-1]
    # keep-ranges in seconds on the source timeline
    keep, t = [], max(0, first * 0.01 - EDGE_PAD)
    i = first
    while i <= last:
        if voiced[i]:
            i += 1
            continue
        j = i
        while j <= last and not voiced[j]:
            j += 1
        gap = (j - i) * 0.01
        if gap > MAX_GAP:
            cut0 = i * 0.01 + MAX_GAP / 2
            cut1 = j * 0.01 - MAX_GAP / 2
            keep.append((t, cut0))
            t = cut1
        i = j
    keep.append((t, min(len(x) / SR, (last + 1) * 0.01 + EDGE_PAD)))

    out = np.concatenate([x[int(a * SR): int(b * SR)] for a, b in keep])

    def remap(ts):
        acc = 0.0
        for a, b in keep:
            if ts < a:
                return acc
            if ts <= b:
                return acc + ts - a
            acc += b - a
        return acc

    for w in words:
        w["start"], w["end"] = remap(w["start"]), remap(w["end"])
    return out, words


async def synth(seg, voice, rate, pitch):
    comm = edge_tts.Communicate(seg["vo"], voice, rate=rate, pitch=pitch, boundary="WordBoundary")
    audio = bytearray()
    words = []
    async for chunk in comm.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            words.append({
                "text": chunk["text"],
                "start": chunk["offset"] / 1e7,
                "end": (chunk["offset"] + chunk["duration"]) / 1e7,
            })
    mp3 = VO_DIR / f"{seg['id']}.mp3"
    mp3.write_bytes(audio)
    x, words = tighten(read_wav(mp3), words)
    write_wav(VO_DIR / f"{seg['id']}.wav", x)
    return {"id": seg["id"], "duration": len(x) / SR, "words": words}


async def main():
    VO_DIR.mkdir(parents=True, exist_ok=True)
    script = json.loads((ROOT / "script" / "script.json").read_text())
    out = []
    for seg in script["segments"]:
        res = await synth(seg, script["voice"], script["rate"], script["pitch"])
        print(f"{res['id']:>7}  {res['duration']:.2f}s  {len(res['words'])} words")
        out.append(res)
    (VO_DIR / "timings.json").write_text(json.dumps(out, indent=1))


if __name__ == "__main__":
    asyncio.run(main())
