# Halloween at Henderson: Instagram Story Motion Plan

Format: 9:16 vertical, 1080×1920, 30fps, H.264 MP4. Each story is 15s or shorter (IG's per-card limit).
Reference: `reference/poster-01.png` (the knife, pumpkin and glowing "H" key art).

---

## 1. Research: what makes a strong motion-design prompt

The viral clips were mostly **not** made from a single prompt. Here is what the good ones had in common:

| Practice | Why it matters |
|---|---|
| **Render through a code-to-video framework** (HyperFrames or Remotion, animated with GSAP or CSS) | Each scene is written as code and rendered straight to MP4, so the output is a video and not a web page. |
| **Give a reference, and name the style** ("Linear launch video", "Apple keynote bumper") | Without one, the model falls back to its default look: centered text, a gradient background, everything fading in. A reference supplies the pacing, type and transitions to copy. |
| **Build a context stack before the prompt**: brand tokens, fonts, assets, 1–2 reference videos | The difference between good and average results was what people fed the model *before* prompting, and what they said *after* the first render. |
| **Spell out the exact states and beats**, with times in seconds | The popular "UI morphing" template first asks for 8–12 target states. Specific beats beat vague vibes. |
| **Ban the template tells**: "springs with a tiny overshoot at most, no bouncy easing" | This avoids the stock-template look. |
| **Loop: render, check frames, fix** | Render stills or a contact sheet, have the model inspect its own frames, then run 2–3 correction rounds. |
| **Let audio drive the timing** when there's sound | Hits and cuts land on the beat. Some pipelines use the voiceover or music timestamps as the timeline's clock. |

Well-known short prompts that get shared:
- *"make a dynamic 15-second motion graphics video that shows what an incredible motion designer you are, like it's your showreel for a résumé. go all out."*
- *"create a motion design video of a poster breaking out of its own frame."*
- *"make a 30s film where the camera keeps zooming into letters, and every letter reveals a new word."*

Short prompts like these impress because they're open-ended. For a branded event series, the better approach is the **context stack plus a beat sheet** described below.

### What the Twitter/X examples teach

| Creator | Prompt / method | What to steal |
|---|---|---|
| [Pankaj Kumar](https://x.com/pankajkumar_dev/status/2103502614134718609) | "create a motion design video of a poster breaking out of its own frame." | **Start from your own poster.** It gives a concept plus built-in art direction. The model also scored the piece and synced hits to the beat. |
| [Pankaj Kumar](https://x.com/pankajkumar_dev/status/2103549082585489413) | "make a 30s film where the camera keeps zooming into letters, and every letter reveals a new word…" | **One strong camera idea**, repeated with variations, beats a pile of effects. |
| [1LittleCoder](https://x.com/1littlecoder/status/2103587706999914649) | "…Avoid the frames and texts on the corners which are typical ai made giveaways!" | **Ban the tells by name.** |
| [Himanshu](https://x.com/himanshutwtxs/status/2103495232637882858) / [Ajith](https://x.com/ajith_io/status/2103449416325890146) | "make a dynamic 15-second motion graphics video that shows what an incredible motion designer you are, like it's your showreel… go all out." | **Stakes framing** ("it's your résumé") pushes quality. |
| [Martijn Verbove](https://x.com/verbove/status/2103483957266268381) | Showed one viral motion post: "explain MakerMap, but make it insane." | **A reference video plus a one-line brief**, and one shape morphing through the whole story. |
| [twoclipping](https://x.com/twoclipping/status/2103273003555402193) | Open-sourced a template that first asks for "8 to 12 UI states I want the shape to become". | **List the states up front.** |
| [Charlie Hills](https://x.com/charliejhills/status/2103893708550914076) | 3 steps: pick one motion, show a reference and name every state, ask for HTML/SVG and fix it round by round. | **Name every state, then iterate.** |
| [Alex Prompter](https://x.com/alex_prompter/status/2103499977632997524) | "Adopt the role of an expert motion designer. Build a 30-second…", giving the scenes, length and pace. | **Direct it like a film:** scenes, runtime, pacing. |
| [Rexan Wong](https://x.com/rexan_wong/status/2103707054108299437) | His "one prompt" try looked average. The fix: 1–2 reference videos, HyperFrames/Remotion, and a real component kit. | **Context beats cleverness.** |

This series applies all of these. The poster is the reference, the motion rules name what's banned, every card has a beat sheet with exact states, and the cards were built as code, rendered, reviewed frame by frame from contact sheets, then fixed.

---

## 2. Creative direction: the "1978" system

The poster is a clear homage to Carpenter's 1978 *Halloween* one-sheet. The motion should work the same way: **slow, patient, and lit from inside.** It's horror pacing, not hype-reel pacing.

**Named style references to give the model**
- The 1978 *Halloween* opening title sequence: a slow push-in on a glowing jack-o'-lantern against black, with credits fading in at the side.
- 80s airbrushed horror one-sheets, with a painted glow, film grain and a slight gate weave.
- Stranger Things title cards, for the red-rim glowing type.

**Palette (approximate; confirm against the source file)**
| Token | Hex | Use |
|---|---|---|
| `--void` | `#050303` | background, always |
| `--bone` | `#FFF1E0` | title fill, body text |
| `--ember` | `#E0301E` | title outline / outer glow |
| `--pumpkin` | `#E8621C` | pumpkin midtone, accent |
| `--rind` | `#8A2A0A` | shadow orange |
| `--candle` | `#FFD9A0` | "H" carving glow |
| `--glint` | `#EAF4FF` | knife-tip star flare |

**Motion rules (include these in every prompt)**
- Default easing: `power2.inOut` / `expo.out`. Nothing bounces, and springs overshoot by 3% at most.
- The camera moves slowly: push-ins of 3–8% scale over the whole clip.
- Light is the main animated element: the candle flickers inside the pumpkin, the "H" breathes, the title glows like embers, and the knife glint flares.
- The **knife-tip star glint** is the signature accent. Use it as the transition between cards and as the "button" moment.
- A **knife-slash wipe** (a diagonal cut following the blade's angle, about 62°) is the only hard transition.
- Texture over everything: animated film grain (about 6% opacity), a subtle vignette and ±1px gate weave.
- No confetti, particles, emoji, gradients or bouncy type.

**Instagram safe zones:** keep all text between y=250 and y=1580. The top 250px sits under the profile bar, and the bottom ~340px sits under the reply bar and stickers.

**Layering the key art:** the flat poster art should be separated into layers (hand+knife, pumpkin, "H" glow, title, glint) so each can move with parallax. A layered source file (PSD or separate PNGs) would help most. Otherwise I can cut masks from the flat image.

---

## 3. The story set (6 cards)

| # | Name | Length | When to post | Job |
|---|---|---|---|---|
| 1 | **The Return** | 12s | Launch day | Announce that it's back |
| 2 | **The Details** | 15s | Launch day, right after #1 | Date, time, place, dress code |
| 3 | **Countdown** (template) | 6s | 7, 3 and 1 day(s) out | Keep it visible |
| 4 | **Costume Code** | 10s | ~5 days out | Push costumes / contest *(needs info)* |
| 5 | **RSVP** | 8s, loops | Pair with any card | CTA with space for a link sticker |
| 6 | **Tonight.** | 7s | Oct 31, afternoon | Night-of hype |

### Card 1: The Return (12s)
| Time | Beat |
|---|---|
| 0.0–1.5s | Pure black. One knife-tip **star glint** flares in the lower third, then fades to a pinpoint. |
| 1.5–4.5s | The candlelight comes up **inside** the pumpkin with an irregular flicker. The pumpkin emerges from black and the carved "H" glows last. |
| 4.5–7.0s | The hand and knife slide in from upper left along the blade's axis with a slow parallax drift. The glint travels down the blade edge to the tip. |
| 7.0–9.5s | "HALLOWEEN AT / HENDERSON" burns in letter by letter, the ember outline first and then the bone fill, like a neon tube warming up. |
| 9.5–12s | "Returning October 31st" fades up. The tip glint flares once more and holds. Slow 5% push-in across the whole clip. |

### Card 2: The Details (15s)
This card is a nod to the 1978 opening credits. The pumpkin sits off-center to the right, cropped and flickering, while the camera slowly pushes in. The information fades in on the left as quiet credits:
`SATURDAY, OCTOBER 31` → `[TIME]` → `[VENUE / NEIGHBORHOOD]` → `COSTUMES [REQUIRED/ENCOURAGED]` → `[OTHER: DJ, FOOD, CONTEST…]`.
Each line gets about 2s, and the lines stack rather than replace each other. It ends with a knife-slash wipe to the title lockup.

### Card 3: Countdown template (6s, re-rendered per number)
The black screen shows a close crop of the pumpkin surface. A large numeral (**7**, then **3**, then **1**) is *carved* in the same script style as the "H": its glow outlines the stroke and then fills, and the candle flickers through it. Below it reads "NIGHTS UNTIL HENDERSON" in small bone caps. The last 0.5s is a glint flare that works as the out-transition. The number is a single variable, so all three versions come from one render call.

### Card 4: Costume Code (10s)
*Wording to be confirmed.* The knife drops into frame and **slashes** diagonally, splitting the screen along the blade's line. The two halves slide apart to reveal "COSTUMES MANDATORY" in the title face with an ember glow. The halves settle back and the prize line fades in, e.g. "Best costume wins [PRIZE]".

### Card 5: RSVP (8s, seamless loop)
The pumpkin sits centered in the top half, breathing in the candlelight. "RSVP" (or "GET ON THE LIST") appears in the title face. A glint travels around an outlined empty box in the lower middle, which marks where the link sticker goes, and the box is kept above the bottom safe zone. The first and last frames match so the loop is invisible.

### Card 6: Tonight. (7s)
0–2s: black, with the candle flicker lighting the frame from the edges only. 2–4s: "TONIGHT." slams in. This is the one fast cut in the series, and it lands on a sound hit if the story has audio. 4–7s: a knife-slash wipe to the full poster lockup with "Doors at [TIME]".

---

## 4. Build pipeline

1. **Assets:** layered key art, the title and body fonts, and the exact colors.
2. **Scaffold:** a Remotion (or HyperFrames) project with one composition per card at 1080×1920@30 and a shared `theme.ts` for tokens, easing and grain.
3. **Shared components:** `<Grain/>`, `<Vignette/>`, `<CandleFlicker/>` (seeded noise so it's repeatable), `<Glint/>`, `<KnifeSlashWipe/>`, `<EmberType/>`.
4. **Render, then review:** export a contact sheet (every 0.5s) and check it against the poster, then run 2–3 rounds of fixes.
5. **Export:** MP4 H.264 at about 12–16 Mbps, plus a still frame from each card for the cover.

## 5. Master prompt (context stack plus beat sheet)

Paste this once at the top of the build session, then add a card's beat sheet from section 3:

```text
You are the motion designer for "Halloween at Henderson", a Halloween party.
Deliverable: Instagram Story videos, 1080x1920, 30fps, MP4, each ≤15s.
Build with Remotion + GSAP-style easing; every scene is code; render to mp4.

REFERENCE: reference/poster-01.png is the key art and the source of truth for
look. Layers in /assets/layers. Match its lighting, palette and type exactly.
STYLE: Carpenter's 1978 "Halloween" opening titles (slow push-in on a glowing
jack-o'-lantern in black void) + 80s airbrushed horror one-sheets. Horror
pacing: patient, lit-from-within, never hype-reel.

TOKENS: void #050303, bone #FFF1E0, ember #E0301E, pumpkin #E8621C,
rind #8A2A0A, candle #FFD9A0, glint #EAF4FF. Fonts: [TITLE FONT], [BODY FONT].

MOTION RULES:
- easing power2.inOut / expo.out; no bounce; springs ≤3% overshoot
- camera: slow push-ins 3–8% scale over the clip
- light is the main animated element: seeded irregular candle flicker,
  breathing "H" glow, ember-burn title reveals, knife-tip star glint
- only hard transition: knife-slash diagonal wipe at the blade angle (~62°)
- always-on film grain ~6%, vignette, ±1px gate weave
- BANNED: gradients, confetti/particles, emoji, centered-fade-everything,
  bouncy type, stock "motion template" moves
- all text inside y=250..1580 (IG UI safe zone)

PROCESS: build → render contact sheet (every 0.5s) → compare against the
poster and critique your own frames honestly → fix → repeat until it would
pass as the poster's own title sequence. Then render final mp4.

Now build CARD [N]: [paste beat sheet]
```

---

## Status: rendered (v2, real event details, silent)

The event details are now in: Sat Oct 31, 10PM–2AM at Henderson Brewing Co., 19+, DJs, lasers, a full bar, a free drink for the first 100 and a group costume contest. The final pre-party set (silent MP4s in `videos/`, and music can be added in Instagram) is:

| # | File | Length | Post when |
|---|---|---|---|
| 1 | `01-the-return` | 12s | Launch day |
| 2 | `02-more-room`: "Last year we sold out Halloween at Paros → we needed more room → so we're taking over Henderson Brewing Co." The camera then pushes into the pumpkin's carved H, which **match-cuts into the Henderson Brewing Co. logo's H** and pulls back to the full roundel | 14s | Launch day |
| 3 | `03-the-details`: night, hours, place, dress code, 19+; the summary card carries the brewery logo | 15s | Launch day |
| 4 | `04-the-night`: DJs all night, with lasers firing out of the carved H on a 124 BPM grid and the genres cut on the beat | 10s | Week of |
| 5 | `05-dress-to-kill`: costumes encouraged, best group costume wins drinks | 10s | ~5 days out |
| 6 | `06-first-100`: the first 100 guests get a free drink ticket | 7s | Any time; drives early arrival |
| 7 | `07-countdown-7/3/1` | 6s | 7, 3 and 1 days out |
| 8 | `08-tickets`: seamless loop, "cheaper the earlier you buy", slot for the link sticker | 8s | Pair with any story |
| 9 | `09-tonight`: doors 10PM plus the brewery logo, ending on "See you on the dance floor." | 7s | Oct 31, afternoon |

## Still useful (optional)
- A higher-resolution poster file would give sharper art (the current source is 1254px).
- If you ever want sound baked in, `AUDIO=1 node motion/render.mjs` adds the original synthesized score.
