# Halloween at Henderson: story motion source

Every frame is code: HTML canvas, rendered headless in Chromium via Playwright and encoded with ffmpeg. Output is **silent by default** so music can be added in Instagram. `AUDIO=1` adds the optional synthesized score from `audio.py`.

| File | What it does |
|---|---|
| `prep_layers.py` | Builds `layers/` from the designer layer pack in `../reference/layers/` (falls back to keying `poster-01.png`). The pack merges pumpkin and knife, so the knife and hand are still cut out here (edge feathered by brightness) and the pumpkin behind is inpainted. Also produces the H-carving glow, title ember and fill, and footer |
| `prep_logo.py` | Keys the Henderson Brewing Co. roundel out of `../reference/henderson-brewing-can.jpg` → `layers/logo.png` (run after `prep_layers.py`) |
| `engine.js` | Timing and easing, candle flicker, film grain and vignette, knife-tip glint, ember type, knife-slash wipe |
| `cards.js` | The nine cards (the countdown renders once per number; list in `../STORIES_PLAN.md`) |
| `content.json` | **All the copy.** Edit here, then re-render |
| `audio.py` | Optional (`AUDIO=1`): synthesized score and SFX, −16 LUFS |
| `render.mjs` | Renders MP4s to `../videos/`, plus review stills and contact sheets |
| `index.html` | Live preview with a scrubber |

## Use

```bash
pip install pillow numpy scipy opencv-python-headless imageio-ffmpeg   # + pyloudnorm for AUDIO=1
npm install                       # playwright (uses the preinstalled Chromium)
python3 prep_layers.py && python3 prep_logo.py   # only if the source art changes
node render.mjs                   # all cards  -> ../videos/*.mp4 + *-cover.jpg
node render.mjs 07-countdown      # just the countdowns
node render.mjs --stills 01 0,4,8 # review frames -> review/
node render.mjs --sheet           # contact sheets of rendered videos -> review/
npm run preview                   # open http://localhost:8080 to scrub cards live
```

Output: 1080×1920, 30fps, H.264 High, yuv420p, faststart, no audio track, each ≤15s.
All text sits between y=250 and y=1580 so Instagram's UI never covers it.

To change the countdown numbers, edit `"countdown": [7, 3, 1]` in `content.json`.
