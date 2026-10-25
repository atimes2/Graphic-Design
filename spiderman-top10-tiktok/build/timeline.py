"""Shared timeline: segment start/end times, caption chunks and SFX cue points.

Both audio.py and render.py import this so picture and sound stay locked.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FPS = 30
W, H = 1080, 1920

# Tail padding after each VO clip (the beat before the next card slams in).
PAD = {"hook": 0.12, "bridge": 0.18, "cta": 1.0}
RANK_PAD = 0.22

# Caption display overrides (spoken word -> on-screen word, "" merges into the previous word).
# The spoken rank number that opens each ranked segment is shown as "#N".
DISPLAY = {"ten": "10", "twenty": "2099", "ninety-nine.": "", "eight?": "8?", "one?": "#1?", "two.": "2"}
NUMWORDS = {1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten"}


def _norm(w):
    return re.sub(r"[^\w'-]", "", w).lower()


def _chunks(seg, words):
    """Group words into 1-3 word caption chunks, breaking on punctuation."""
    tokens = seg["vo"].split()
    if len(tokens) != len(words):
        tokens = [w["text"] for w in words]
    emph = {_norm(e) for e in seg.get("emphasis", [])}
    items = []
    for i, (tok, w) in enumerate(zip(tokens, words)):
        disp = DISPLAY.get(tok.lower(), tok.strip(",").upper())
        if i < 3 and "rank" in seg and _norm(tok) == NUMWORDS[seg["rank"]]:
            disp = f"#{seg['rank']}"
        if disp == "" and items:
            items[-1]["end"] = w["end"]
            items[-1]["brk"] = tok[-1] in ".,?!"
            continue
        items.append({"text": disp, "start": w["start"], "end": w["end"],
                      "emph": _norm(tok) in emph, "brk": tok[-1] in ".,?!"})
    chunks, cur = [], []
    for it in items:
        cur.append(it)
        if it["brk"] or len(cur) == 3:
            chunks.append(cur)
            cur = []
    if cur:
        chunks.append(cur)
    return chunks


def build():
    script = json.loads((ROOT / "script" / "script.json").read_text())
    timings = {t["id"]: t for t in json.loads((ROOT / "build" / "vo" / "timings.json").read_text())}
    segs, t = [], 0.0
    for seg in script["segments"]:
        tm = timings[seg["id"]]
        dur = tm["duration"] + PAD.get(seg["id"], RANK_PAD)
        s = dict(seg)
        s.update(start=t, end=t + dur, dur=dur, vo_dur=tm["duration"], words=tm["words"],
                 chunks=_chunks(seg, tm["words"]))
        segs.append(s)
        t += dur
    return segs, t


def word_time(seg, spoken, nth=0):
    """Local time of the nth occurrence of a spoken word in a segment."""
    hits = [w["start"] for w in seg["words"] if _norm(w["text"]) == _norm(spoken)]
    return hits[min(nth, len(hits) - 1)] if hits else None


if __name__ == "__main__":
    segs, total = build()
    for s in segs:
        print(f"{s['id']:>7} {s['start']:6.2f} -> {s['end']:6.2f}  " +
              " | ".join(" ".join(i["text"] for i in c) for c in s["chunks"]))
    print("total", round(total, 2))
