# Halloween at Henderson: story motion source

Every frame is code: HTML canvas, rendered headless in Chromium via Playwright and encoded with ffmpeg. Videos render **silent**. `AUDIO=1` adds an optional synthesized SFX track from each card's cue list (`audio.py`).

| File | What it does |
|---|---|
| `prep_layers.py` | Builds `layers/` from the designer layer pack in `../reference/layers/`: separate knife and pumpkin (the baked tip star is removed so the animated sparkle replaces it), H-carving glow, title ember and fill, footer |
| `prep_title.py` | Builds the title layers from the updated lettering in `../reference/title-updated.webp` (keys out the white, splits cream fill from red outline for the burn-in, keeps its higher resolution via `title_res`); run after `prep_layers.py` |
| `prep_logo.py` | Builds the Henderson Brewing Company wordmark from `../reference/henderson-wordmark.png` (transparent PNG, rebuilt at 5× with crisp edges, cream with an ember glow) → `layers/logo.png` + `logo_glow.png` (run after `prep_layers.py`) |
| `engine.js` | Timing and easing, candle flicker, film grain and vignette, knife-tip glint, ember type, knife-slash wipe |
| `cards.js` | The 19 story designs (the countdown renders once per number; list in `../STORIES_PLAN.md`) |
| `tv.js` + `tv.html` | The 70s venue TV loop (1920×1080, silent, seamless): nine scenes on the left, the ticket QR, date and wordmark fixed on the right |
| `reel.js` + `reel/` | Collab Reels A–D (archival film, 1080×1920): timelines and copy in `reel.js` / `content.json` → `reel`, clip list in `reel/footage.json`, rights in `reel/SOURCES.md` |
| `reel2.js` | Collab Reels E (field guide), F (beat-cut grid; beats in `reel/beats-f.json`) and G (invitation), using the helpers `reel.js` shares as `HH_REEL` |
| `reel_audio.py` | Reel soundtracks → `reel/audio/<id>.wav` from `reel/audio.json`: Kokoro TTS narration, film-dialogue clips, public-domain 78s (downloaded to `music-src/`), ducking, −14 LUFS |
| `prep_footage.py` | Downloads the archive.org films (if missing) and cuts + grades the Reel clips into `footage/` (ember and mono grades; not committed, about 600 MB) |
| `prep_export.py` | Exports the pumpkin + knife art as transparent PNGs to `../exports/`, both with a crisp drawn knife-tip star: clean (evenly lit, any background), glow (poster shading as solid darkening + ember halo) and poster (left side fades away completely, as on the poster) |
| `prep_qr.py` | Turns `../reference/tv-qr.png` into a module grid (`layers/qr.json`) so the TV draws the QR pixel-sharp, and checks it still decodes |
| `content.json` | **All the copy.** Edit here, then re-render |
| `audio.py` | Optional synthesized SFX per card (off by default; `AUDIO=1`), −16 LUFS |
| `render.mjs` | Renders MP4s to `../videos/`, plus review stills and contact sheets |
| `index.html` | Live preview with a scrubber |

## Use

```bash
pip install pillow numpy scipy opencv-python-headless imageio-ffmpeg pyloudnorm soundfile kokoro-onnx
npm install                       # playwright (uses the preinstalled Chromium)
python3 prep_layers.py && python3 prep_title.py && python3 prep_logo.py && python3 prep_qr.py   # only if the source art changes
node render.mjs                   # all cards  -> ../videos/*.mp4 + *-cover.jpg
node render.mjs 05-countdown      # just the countdowns
node render.mjs --stills 01 0,4,8 # review frames -> review/
node render.mjs --sheet           # contact sheets of rendered videos -> review/
python3 prep_footage.py && python3 reel_audio.py && node render.mjs reel   # the collab Reels (needs archive.org + huggingface access)
node render.mjs --tv              # the venue TV loop -> ../videos/tv-loop.mp4 (silent)
npm run preview                   # open http://localhost:8080 to scrub cards live
```

Output: 1080×1920, 30fps, H.264 High, yuv420p, silent, faststart, 10–14s each.
All text sits between y=250 and y=1580 so Instagram's UI never covers it.

To change the countdown numbers, edit `"countdown": [31, 21, 14, 7, 3, 1]` in `content.json`.
