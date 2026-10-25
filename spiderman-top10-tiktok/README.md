# Top 10 Most Powerful Spider-Men: TikTok video

A vertical 53.8s countdown video built from the "Top 10 Most Powerful Versions of Spider-Man" infographic.

**Deliverable:** `output/spiderman_top10_tiktok.mp4`. See `output/POSTING_KIT.md` for captions, hashtags and ad notes, and `research/RESEARCH.md` for the trend research behind each choice.

## Structure (beat sheet)
| Time | Beat | Retention device |
|---|---|---|
| 0.0–2.3s | "TOP 10 MOST POWERFUL SPIDER-MEN EVER" over a flashing card montage | The topic is clear on frame 1, even with the sound off |
| 2.3–4.0s | "Number one can rewrite reality", with #1 as a silhouette and "???" | Open loop |
| 4.0–30.7s | #10 Kaine → #5 Spiders-Man | 10→1 tracker with #1 locked; power bar counts up on each card |
| 12.5–18.1s | #8 Miles: "Only number eight? Fight me in the comments" plus a fake comment card | Comment bait |
| 26.8–30.7s | #5: "He IS spiders", with spiders crawling across the screen | Halloween-week pattern interrupt |
| 30.7–32.8s | "But the top four? Whole different level", 4 locked silhouettes | Mid-video re-hook, with a music break and riser |
| 32.8–45.1s | #4 Beyonder → #2 Spider-Hulk | The beat drops back in |
| 45.1–49.8s | Music cuts to silence on "And number…", then #1 Cosmic Spider-Man is revealed with god-rays and the power bar reads ∞ | Payoff |
| 49.8–53.8s | "Who's YOUR #1? Comment below, follow for part 2", over the 10-card grid | CTA, and a clean loop back to frame 1 |

## Rebuild
```bash
cd spiderman-top10-tiktok/build
pip install edge-tts            # neural TTS (also needs ffmpeg, numpy, pillow)
python3 voiceover.py            # script/script.json -> vo/*.wav + word timings
python3 audio.py                # original score + SFX + ducked mix -> audio/mix.wav (-14 LUFS)
python3 render.py --stills      # QA frames -> output/stills/
python3 render.py               # -> output/spiderman_top10_tiktok.mp4 (~3 min on 4 cores)
```
To change the voice, wording, rankings, colors or power levels, edit `script/script.json` and re-run all three steps. Timing, captions and SFX cues re-sync automatically.

## Folder
- `source/`: the original infographic. The character art is cropped from it.
- `script/script.json`: VO lines, names, colors, power levels and tags.
- `build/`: the pipeline (`voiceover.py`, `audio.py`, `timeline.py`, `render.py`), fonts (Anton, Bebas Neue, Montserrat; all OFL), VO clips and audio stems.
- `output/`: final MP4, cover, QA stills and the posting kit.
