# Halloween at Henderson: story motion source

Every frame is code: HTML canvas, rendered headless in Chromium via Playwright and encoded with ffmpeg. Sound is **SFX only (no music)**, synthesized in `audio.py` from each card's cue list. `AUDIO=0` renders silent.

| File | What it does |
|---|---|
| `prep_layers.py` | Builds `layers/` from the designer layer pack in `../reference/layers/`: separate knife and pumpkin (the baked tip star is removed so the animated sparkle replaces it), H-carving glow, title ember and fill, footer |
| `prep_title.py` | Builds the title layers from the updated lettering in `../reference/title-updated.webp` (keys out the white, splits cream fill from red outline for the burn-in, keeps its higher resolution via `title_res`); run after `prep_layers.py` |
| `prep_logo.py` | Builds the Henderson Brewing Company wordmark from `../reference/henderson-wordmark.png` (transparent PNG, rebuilt at 5× with crisp edges, cream with an ember glow) → `layers/logo.png` + `logo_glow.png` (run after `prep_layers.py`) |
| `engine.js` | Timing and easing, candle flicker, film grain and vignette, knife-tip glint, ember type, knife-slash wipe |
| `cards.js` | The 18 story designs (the countdown renders once per number; list in `../STORIES_PLAN.md`) |
| `tv.js` + `tv.html` | The 70s venue TV loop (1920×1080, silent, seamless): nine scenes on the left, the ticket QR, date and wordmark fixed on the right |
| `prep_export.py` | Exports the pumpkin + knife art as transparent PNGs to `../exports/`, both with a crisp drawn knife-tip star: clean (evenly lit, any background), glow (poster shading as solid darkening + ember halo) and poster (left side fades away completely, as on the poster) |
| `prep_qr.py` | Turns `../reference/tv-qr.png` into a module grid (`layers/qr.json`) so the TV draws the QR pixel-sharp, and checks it still decodes |
| `content.json` | **All the copy.** Edit here, then re-render |
| `audio.py` | Synthesized SFX per card (no music), −16 LUFS |
| `render.mjs` | Renders MP4s to `../videos/`, plus review stills and contact sheets |
| `index.html` | Live preview with a scrubber |

## Use

```bash
pip install pillow numpy scipy opencv-python-headless imageio-ffmpeg pyloudnorm
npm install                       # playwright (uses the preinstalled Chromium)
python3 prep_layers.py && python3 prep_title.py && python3 prep_logo.py && python3 prep_qr.py   # only if the source art changes
node render.mjs                   # all cards  -> ../videos/*.mp4 + *-cover.jpg
node render.mjs 05-countdown      # just the countdowns
node render.mjs --stills 01 0,4,8 # review frames -> review/
node render.mjs --sheet           # contact sheets of rendered videos -> review/
node render.mjs --tv              # the venue TV loop -> ../videos/tv-loop.mp4 (silent)
npm run preview                   # open http://localhost:8080 to scrub cards live
```

Output: 1080×1920, 30fps, H.264 High, yuv420p, AAC 48kHz SFX track, faststart, 10–14s each.
All text sits between y=250 and y=1580 so Instagram's UI never covers it.

To change the countdown numbers, edit `"countdown": [31, 21, 14, 7, 3, 1]` in `content.json`.
