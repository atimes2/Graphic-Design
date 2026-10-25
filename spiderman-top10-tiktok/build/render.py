"""Frame renderer: 1080x1920 @30fps, piped to ffmpeg with the audio mix.

Usage: python3 render.py            -> output/spiderman_top10_tiktok.mp4
       python3 render.py --stills   -> output/stills/*.png (QA frames)
"""
import math
import subprocess
import sys
from functools import lru_cache
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from timeline import FPS, H, NUMWORDS, ROOT, W, build, word_time

SRC = ROOT / "source" / "infographic.jpg"
FONTS = ROOT / "build" / "fonts"
OUT = ROOT / "output"

# Card art crops in the source infographic (x0, y0, x1, y1), keyed by rank.
_XS = [(4, 410), (428, 817), (835, 1225), (1244, 1640), (1659, 2044)]
CROPS = {r + 1: (_XS[r % 5][0], (204, 998)[r // 5], _XS[r % 5][1], (640, 1420)[r // 5]) for r in range(10)}

CARD_W, CARD_H = 830, 892
CARD_X, CARD_Y = (W - CARD_W) // 2, 330
YELLOW = (255, 226, 40)
RED = (235, 30, 45)

SEGS, TOTAL = build()
BY = {s["id"]: s for s in SEGS}


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# ---------- easing ----------

def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def ease_back(x, s=1.9):
    x = clamp(x) - 1
    return 1 + (s + 1) * x ** 3 + s * x ** 2


def prog(t, t0, d):
    return clamp((t - t0) / d)


# ---------- fonts / text sprites ----------

@lru_cache(None)
def font(name, size):
    if name == "anton":
        return ImageFont.truetype(str(FONTS / "Anton-Regular.ttf"), size)
    if name == "bebas":
        return ImageFont.truetype(str(FONTS / "BebasNeue-Regular.ttf"), size)
    f = ImageFont.truetype(str(FONTS / "Montserrat%5Bwght%5D.ttf"), size)
    f.set_variation_by_name("Black")
    return f


@lru_cache(4096)
def text_sprite(text, fname, size, fill, stroke=0, stroke_fill=(0, 0, 0), glow=None, glow_r=18, max_w=None):
    """Render text to a tight RGBA sprite (optionally with outer glow); auto-shrinks to max_w."""
    f = font(fname, size)
    if max_w:
        while f.getlength(text) + 2 * stroke > max_w and size > 20:
            size -= 4
            f = font(fname, size)
    l, t, r, b = f.getbbox(text, stroke_width=stroke)
    pad = glow_r * 2 if glow else 4
    w, h = r - l + 2 * pad, b - t + 2 * pad
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if glow:
        g = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(g).text((pad - l, pad - t), text, font=f, fill=glow + (255,), stroke_width=stroke + 6,
                               stroke_fill=glow + (255,))
        g = g.filter(ImageFilter.GaussianBlur(glow_r))
        img.alpha_composite(g)
        img.alpha_composite(g)
    d.text((pad - l, pad - t), text, font=f, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
    return img


def paste_center(canvas, sprite, cx, cy, scale=1.0, alpha=1.0, rot=0.0):
    if scale <= 0.01 or alpha <= 0.01:
        return
    sp = sprite
    if abs(scale - 1) > 1e-3:
        sp = sp.resize((max(1, int(sp.width * scale)), max(1, int(sp.height * scale))), Image.BILINEAR)
    if rot:
        sp = sp.rotate(rot, Image.BILINEAR, expand=True)
    if alpha < 1:
        sp = sp.copy()
        sp.putalpha(sp.getchannel("A").point(lambda v: int(v * alpha)))
    canvas.alpha_composite(sp, (int(cx - sp.width / 2), int(cy - sp.height / 2))) if _fits(canvas, sp, cx, cy) else \
        _paste_clipped(canvas, sp, int(cx - sp.width / 2), int(cy - sp.height / 2))


def _fits(c, sp, cx, cy):
    x, y = int(cx - sp.width / 2), int(cy - sp.height / 2)
    return x >= 0 and y >= 0 and x + sp.width <= c.width and y + sp.height <= c.height


def _paste_clipped(canvas, sp, x, y):
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(canvas.width, x + sp.width), min(canvas.height, y + sp.height)
    if x1 <= x0 or y1 <= y0:
        return
    canvas.alpha_composite(sp.crop((x0 - x, y0 - y, x1 - x, y1 - y)), (x0, y0))


# ---------- static assets ----------

@lru_cache(None)
def source():
    return Image.open(SRC).convert("RGB")


@lru_cache(None)
def art(rank):
    im = source().crop(CROPS[rank]).resize((CARD_W, CARD_H), Image.LANCZOS)
    return im.filter(ImageFilter.UnsharpMask(radius=2.2, percent=90, threshold=2)).convert("RGBA")


@lru_cache(None)
def silhouette(rank):
    a = np.asarray(art(rank).convert("RGB")).astype(float)
    lum = a.mean(2, keepdims=True)
    edge = np.asarray(art(rank).convert("L").filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(2))).astype(float)[..., None]
    out = lum * 0.07 + edge * np.array([0.9, 0.25, 0.3]) * 1.4
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).convert("RGBA")


@lru_cache(None)
def bg_plate(rank, dark=0.38):
    im = source().crop(CROPS[rank])
    im = im.resize((int(W * 1.25), int(W * 1.25 * im.height / im.width)), Image.BILINEAR)
    side = max(int(H * 1.25), im.height)
    im = im.resize((int(im.width * side / im.height), side), Image.BILINEAR)
    im = im.filter(ImageFilter.GaussianBlur(38))
    a = np.asarray(im).astype(float) * dark
    return Image.fromarray(a.astype(np.uint8)).convert("RGBA")


@lru_cache(None)
def card_mask():
    m = Image.new("L", (CARD_W, CARD_H), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, CARD_W - 1, CARD_H - 1), 34, fill=255)
    return m


@lru_cache(None)
def card_frame(color):
    pad = 60
    img = Image.new("RGBA", (CARD_W + 2 * pad, CARD_H + 2 * pad), (0, 0, 0, 0))
    g = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(g).rounded_rectangle((pad - 6, pad - 6, pad + CARD_W + 5, pad + CARD_H + 5), 40, outline=color + (255,), width=16)
    img.alpha_composite(g.filter(ImageFilter.GaussianBlur(22)))
    img.alpha_composite(g.filter(ImageFilter.GaussianBlur(8)))
    ImageDraw.Draw(img).rounded_rectangle((pad - 3, pad - 3, pad + CARD_W + 2, pad + CARD_H + 2), 38, outline=color + (255,), width=6)
    return img


@lru_cache(None)
def card_shade():
    """Bottom gradient on the card so captions read over art."""
    a = np.zeros((CARD_H, CARD_W), np.uint8)
    ramp = np.clip((np.arange(CARD_H) - CARD_H * 0.55) / (CARD_H * 0.45), 0, 1) ** 1.3 * 200
    a[:] = ramp[:, None].astype(np.uint8)
    img = Image.new("RGBA", (CARD_W, CARD_H), (0, 0, 0, 255))
    img.putalpha(Image.fromarray(a))
    return img


@lru_cache(None)
def web_overlay():
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = W + 40, -60
    angles = np.linspace(math.radians(95), math.radians(265), 12)
    for a in angles:
        d.line((cx, cy, cx + math.cos(a) * 2600, cy - math.sin(a) * 2600), fill=(255, 255, 255, 26), width=3)
    for r in range(160, 2600, 170):
        pts = [(cx + math.cos(a) * r * (0.94 if i % 2 else 1), cy - math.sin(a) * r * (0.94 if i % 2 else 1))
               for i, a in enumerate(angles)]
        d.line(pts, fill=(255, 255, 255, 20), width=2)
    return img


@lru_cache(None)
def vignette(color=(0, 0, 0), strength=230):
    y, x = np.mgrid[0:H, 0:W]
    r = np.sqrt(((x - W / 2) / (W * 0.62)) ** 2 + ((y - H / 2) / (H * 0.58)) ** 2)
    a = (np.clip(r - 0.55, 0, 1) / 0.45) ** 1.6 * strength
    img = Image.new("RGBA", (W, H), color + (255,))
    img.putalpha(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)))
    return img


@lru_cache(None)
def spider_sprite(size=70, rot=0):
    s = size * 4
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = s / 2
    for pass_, (colr, wd) in enumerate((((255, 60, 60, 200), 0.07), ((10, 10, 10, 255), 0.03))):
      for side in (-1, 1):
        for i, ang in enumerate((-50, -18, 18, 50)):
            a = math.radians(ang)
            kx, ky = c + side * math.cos(a) * s * 0.22, c + math.sin(a) * s * 0.18 - s * 0.06
            fx, fy = c + side * math.cos(a) * s * 0.42, c + math.sin(a) * s * 0.36 + s * 0.04
            d.line((c, c, kx, ky, fx, fy), fill=colr, width=int(s * wd), joint="curve")
    d.ellipse((c - s * .11, c - s * .04, c + s * .11, c + s * .22), fill=(255, 60, 60, 200))
    d.ellipse((c - s * .09, c - s * .02, c + s * .09, c + s * .2), fill=(12, 12, 12, 255))
    d.ellipse((c - s * .06, c - s * .12, c + s * .06, c + s * .01), fill=(20, 20, 20, 255))
    d.ellipse((c - s * .035, c - s * .1, c - s * .01, c - s * .07), fill=(255, 40, 40, 255))
    d.ellipse((c + s * .01, c - s * .1, c + s * .035, c - s * .07), fill=(255, 40, 40, 255))
    img = img.resize((size, size), Image.LANCZOS)
    return img.rotate(rot, Image.BILINEAR, expand=True)


# ---------- reusable layers ----------

def draw_bg(canvas, rank, lt, color, tint=0.22):
    plate = bg_plate(rank)
    z = 1.0 + 0.05 * lt
    cw, ch = int(W * 1.18 / z), int(H * 1.18 / z)
    cx, cy = plate.width / 2 + math.sin(lt * 0.7) * 30, plate.height / 2
    crop = plate.crop((int(cx - cw / 2), int(cy - ch / 2), int(cx + cw / 2), int(cy + ch / 2))).resize((W, H), Image.BILINEAR)
    canvas.alpha_composite(crop)
    t = Image.new("RGBA", (W, H), color + (int(255 * tint),))
    canvas.alpha_composite(t)
    canvas.alpha_composite(web_overlay())


def draw_particles(canvas, lt, color, seed, n=34, speed=1.0, size=1.0):
    rs = np.random.default_rng(seed)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(n):
        x0, y0 = rs.uniform(0, W), rs.uniform(0, H)
        sp = rs.uniform(80, 260) * speed
        r = rs.uniform(2, 7) * size
        ph = rs.uniform(0, 6.28)
        y = (y0 - sp * lt) % (H + 40) - 20
        x = x0 + math.sin(lt * 1.5 + ph) * 26
        a = int(140 + 110 * math.sin(lt * 4 + ph))
        d.ellipse((x - r, y - r, x + r, y + r), fill=color + (max(0, a),))
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(1.2)))


def draw_card(canvas, rank, color, lt, dx=0, dy=0, scale=1.0, rot=0.0, zoom=1.0, img=None, shade=True):
    a = img or art(rank)
    if zoom != 1.0:
        zw, zh = int(CARD_W / zoom), int(CARD_H / zoom)
        x0, y0 = (CARD_W - zw) // 2, int((CARD_H - zh) * 0.35)
        a = a.crop((x0, y0, x0 + zw, y0 + zh)).resize((CARD_W, CARD_H), Image.BILINEAR)
    card = Image.new("RGBA", (CARD_W, CARD_H), (0, 0, 0, 0))
    card.paste(a, (0, 0), card_mask())
    if shade:
        sh = card_shade().copy()
        sh.putalpha(Image.composite(sh.getchannel("A"), Image.new("L", sh.size, 0), card_mask()))
        card.alpha_composite(sh)
    fr = card_frame(color)
    full = fr.copy()
    full.alpha_composite(card, (60, 60))
    paste_center(full_canvas := canvas, full, CARD_X + CARD_W / 2 + dx, CARD_Y + CARD_H / 2 + dy, scale, 1.0, rot)
    return full_canvas


def draw_tracker(canvas, current, revealed_one, color):
    """Header: title + countdown pills (10 ... 1), #1 hidden until revealed."""
    title = text_sprite("THE 10 MOST POWERFUL SPIDER-MEN", "anton", 50, (255, 255, 255), 3, (0, 0, 0))
    paste_center(canvas, title, W / 2, 196)
    pw, gap = 74, 10
    x0 = (W - (10 * pw + 9 * gap)) / 2
    layer = Image.new("RGBA", (W, 80), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i, r in enumerate(range(10, 0, -1)):
        x = x0 + i * (pw + gap)
        done = current is not None and r > current
        cur = r == current
        fill = color + (255,) if cur else ((255, 255, 255, 60) if done else (0, 0, 0, 150))
        d.rounded_rectangle((x, 8, x + pw, 66), 14, fill=fill, outline=(255, 255, 255, 200 if cur else 90), width=3)
        label = "?" if (r == 1 and not revealed_one) else str(r)
        f = font("anton", 40)
        tw = f.getlength(label)
        d.text((x + (pw - tw) / 2, 10), label, font=f, fill=(0, 0, 0, 255) if cur else (255, 255, 255, 120 if done else 235))
        if done:
            d.line((x + 10, 60, x + pw - 10, 14), fill=(255, 255, 255, 140), width=4)
    canvas.alpha_composite(layer, (0, 232))


def draw_captions(canvas, seg, lt, color, cy=1110):
    chunks = seg["chunks"]
    cur = None
    for i, ch in enumerate(chunks):
        nxt = chunks[i + 1][0]["start"] if i + 1 < len(chunks) else seg["dur"]
        if ch[0]["start"] - 0.03 <= lt < nxt - 0.03:
            cur = ch
    if not cur:
        return
    size = 92
    f = font("mont", size)
    words = [w["text"] for w in cur]
    space = f.getlength(" ") + 6
    actives = [w["start"] - 0.02 <= lt < w["end"] + 0.06 for w in cur]
    boosts = [((1.16 if w["emph"] else 1.08) if a else 1.0) for w, a in zip(cur, actives)]
    widths = [(f.getlength(w) + 18) * b for w, b in zip(words, boosts)]
    total = sum(widths) + space * (len(words) - 1)
    scale_fit = min(1.0, 960 / total)
    x = W / 2 - total * scale_fit / 2
    pop_in = ease_back(prog(lt, cur[0]["start"] - 0.03, 0.12), 2.2)
    for w, wd, a, b in zip(cur, widths, actives, boosts):
        fill = (color if w["emph"] else YELLOW) if a else (255, 255, 255)
        sp = text_sprite(w["text"], "mont", size, fill, 9, (0, 0, 0))
        s = scale_fit * (0.85 + 0.15 * pop_in) * b
        paste_center(canvas, sp, x + wd * scale_fit / 2, cy - (8 if a else 0), s)
        x += (wd + space) * scale_fit


def draw_power(canvas, lt, power, color, t0=0.55, is_one=False):
    y = 1530
    x0, x1 = 150, 930
    label = text_sprite("POWER LEVEL", "bebas", 46, (255, 255, 255), 2, (0, 0, 0))
    canvas.alpha_composite(label, (x0 - 4, y - 58))
    p = ease_out(prog(lt, t0, 0.9))
    val = power * p
    layer = Image.new("RGBA", (W, 60), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle((x0, 6, x1, 46), 20, fill=(0, 0, 0, 170), outline=(255, 255, 255, 120), width=3)
    fx = x0 + (x1 - x0) * val / 100
    if fx > x0 + 20:
        d.rounded_rectangle((x0 + 4, 10, fx - 4, 42), 16, fill=color + (255,))
        for k in range(int(x0) + 30, int(fx) - 10, 34):  # segment notches
            d.line((k, 12, k - 10, 40), fill=(255, 255, 255, 70), width=4)
    canvas.alpha_composite(layer, (0, y - 10))
    if is_one and lt > t0 + 1.0:
        num = "∞" if int(lt * 12) % 5 else "100"
        sp = text_sprite("MAX", "anton", 64, YELLOW, 4, (0, 0, 0))
        sp2 = text_sprite("∞", "mont", 70, YELLOW, 4, (0, 0, 0)) if num == "∞" else sp
        paste_center(canvas, sp2, x1 - 30, y - 40, 1.0 + 0.08 * math.sin(lt * 20))
    else:
        sp = text_sprite(f"{int(round(val))}", "anton", 64, (255, 255, 255), 4, (0, 0, 0))
        paste_center(canvas, sp, x1 - 40, y - 40)


def rgb_split(img, amt):
    if amt < 1:
        return img
    a = np.asarray(img).copy()
    a[..., 0] = np.roll(a[..., 0], int(amt), axis=1)
    a[..., 2] = np.roll(a[..., 2], -int(amt), axis=1)
    return Image.fromarray(a)


def flash(canvas, alpha, color=(255, 255, 255)):
    if alpha > 0.01:
        canvas.alpha_composite(Image.new("RGBA", (W, H), color + (int(255 * clamp(alpha)),)))


def shake(t, t0, dur=0.35, amp=26):
    p = (t - t0) / dur
    if not 0 <= p <= 1:
        return 0, 0
    a = amp * (1 - p) ** 2
    return a * math.sin(t * 97), a * math.cos(t * 83)


# ---------- segment painters ----------

def paint_hook(c, s, lt):
    t_num = word_time(s, "Number") or 2.3
    if lt < t_num:
        order = [10, 9, 8, 7, 6, 5, 4, 3, 2]
        idx = min(len(order) - 1, int(lt / 0.22))
        rank = order[idx]
        col = hexrgb(BY[f"r{rank}"]["color"])
        draw_bg(c, rank, lt, col, 0.25)
        k = (lt % 0.22) / 0.22
        draw_card(c, rank, col, lt, scale=1.04 - 0.04 * ease_out(k), rot=(-2.5 if idx % 2 else 2.5) * (1 - ease_out(k)))
        c.alpha_composite(vignette())
        # Headline (visible from frame 1)
        top = text_sprite("TOP 10", "anton", 290, YELLOW, 10, (0, 0, 0), glow=(255, 30, 40), glow_r=26)
        paste_center(c, top, W / 2, 640, 1.0 + 0.05 * math.sin(lt * 9), rot=-3)
        l2 = text_sprite("MOST POWERFUL", "anton", 132, (255, 255, 255), 7, (0, 0, 0), glow=(220, 20, 30), glow_r=20)
        paste_center(c, l2, W / 2, 870, rot=-3)
        l3 = text_sprite("SPIDER-MEN EVER", "anton", 132, RED, 7, (0, 0, 0))
        paste_center(c, l3, W / 2, 1020, rot=-3)
        draw_tracker(c, None, False, RED)
        draw_captions(c, s, lt, YELLOW, cy=1420)
        return 7 if k < 0.2 else 0
    # "Number one can rewrite reality" -> hidden #1 tease
    q = lt - t_num
    col = (255, 210, 61)
    draw_bg(c, 1, lt, (40, 20, 90), 0.5)
    draw_particles(c, lt, col, 11, n=40)
    draw_card(c, 1, col, lt, dx=0, dy=0, scale=0.96 + 0.04 * ease_back(prog(q, 0, 0.25)), img=silhouette(1),
              zoom=1.0 + 0.04 * q)
    c.alpha_composite(vignette())
    num = text_sprite("#1", "anton", 380, col, 12, (0, 0, 0), glow=(255, 150, 0), glow_r=30)
    paste_center(c, num, W / 2, 720, 2.4 - 1.4 * ease_out(prog(q, 0, 0.22)))
    qm = text_sprite("???", "anton", 170, (255, 255, 255), 8, (0, 0, 0))
    paste_center(c, qm, W / 2, 980, ease_back(prog(q, 0.15, 0.25)))
    draw_tracker(c, None, False, col)
    draw_captions(c, s, lt, col, cy=1420)
    flash(c, 0.8 * (1 - prog(q, 0, 0.18)))
    return 14 * (1 - prog(q, 0, 0.3))


def paint_rank(c, s, lt):
    rank, col = s["rank"], hexrgb(s["color"])
    hit = word_time(s, NUMWORDS[rank]) or 0.0
    q = lt - hit  # time since the rank number is spoken
    is_one = rank == 1
    if is_one and q < 0:
        # "And number..." — black, heartbeat on the hidden silhouette
        c.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, 255)))
        beat = 1 + 0.03 * math.sin(lt * 18)
        draw_card(c, 1, (90, 70, 20), lt, scale=0.9 * beat, img=silhouette(1))
        c.alpha_composite(vignette())
        draw_tracker(c, 2, False, col)
        draw_captions(c, s, lt, col)
        return 0
    draw_bg(c, rank, lt, col)
    if is_one:  # rotating god-rays
        rays = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(rays)
        cx, cy = W / 2, CARD_Y + CARD_H * 0.4
        for k in range(18):
            a = math.radians(k * 20 + lt * 25)
            d.polygon([(cx, cy), (cx + math.cos(a) * 1800, cy + math.sin(a) * 1800),
                       (cx + math.cos(a + 0.12) * 1800, cy + math.sin(a + 0.12) * 1800)], fill=col + (38,))
        c.alpha_composite(rays.filter(ImageFilter.GaussianBlur(6)))
    draw_particles(c, lt, col, rank, n=50 if is_one else 30, speed=1.4 if is_one else 1.0)
    # card: whip in from the right, punch-in on impact, slow Ken Burns after
    e = ease_back(prog(q, -0.04, 0.26), 1.4)
    dx = (1 - e) * 1100
    rot = (1 - e) * 10
    zoom = 1.0 + 0.07 * prog(lt, 0, s["dur"]) + 0.08 * (1 - ease_out(prog(q, 0.05, 0.35)))
    sx, sy = shake(lt, hit + 0.05, 0.4 if not is_one else 0.7, 24 if not is_one else 40)
    draw_card(c, rank, col, lt, dx=dx + sx, dy=sy, rot=rot, zoom=zoom)
    c.alpha_composite(vignette(strength=170))

    # Rank badge slams onto the card corner (covers the source badge)
    bs = ease_out(prog(q, 0, 0.2))
    plate = text_sprite(f"#{rank}", "anton", 230, col, 12, (0, 0, 0), glow=col, glow_r=24)
    paste_center(c, plate, CARD_X + 150 + sx, CARD_Y + 120 + sy, 3.0 - 2.0 * bs, alpha=clamp(bs * 3), rot=-6)

    # Name + subtitle
    ny = CARD_Y + CARD_H + 72
    name = text_sprite(s["name"], "anton", 124, (255, 255, 255), 6, (0, 0, 0), glow=col, glow_r=16, max_w=960)
    ns = ease_back(prog(q, 0.18, 0.28), 2.0)
    paste_center(c, name, W / 2 + sx * 0.5, ny, ns)
    sub = text_sprite(s["sub"], "bebas", 60, col, 3, (0, 0, 0))
    paste_center(c, sub, W / 2, ny + 92, 1.0, alpha=prog(q, 0.35, 0.2))

    # Power tags on the card top-right
    for i, tag in enumerate(s.get("tags", [])):
        tp = ease_back(prog(q, 0.6 + i * 0.15, 0.25), 2.0)
        sp = tag_sprite(tag, col)
        paste_center(c, sp, CARD_X + CARD_W - sp.width / 2 - 20 + (1 - tp) * 500 + sx, CARD_Y + 290 + i * 80 + sy)

    draw_power(c, q, s["power"], col, is_one=is_one)
    draw_tracker(c, rank, rank == 1, col)
    draw_captions(c, s, lt, col)

    # Segment specials
    if rank == 8:
        tf = word_time(s, "Fight") or 4.3
        p = prog(lt, tf, 0.25)
        if p > 0:
            paste_center(c, comment_bubble(), W / 2 + 20, CARD_Y + 560, ease_back(p, 2.4), rot=4)
    if rank == 5:
        ts = word_time(s, "He", 1) or 2.6
        draw_spiders(c, lt - ts)
    if is_one:
        paste_center(c, pill("MAXIMUM POWER", 70, (0, 0, 0), col), W / 2, CARD_Y - 10 + sy, ease_back(prog(q, 0.9, 0.3), 2))

    fl = 1 - prog(q, 0, 0.5 if is_one else 0.16)
    flash(c, (1.0 if is_one else 0.55) * fl)
    return (16 if is_one else 9) * (1 - prog(q, 0, 0.25))


def paint_bridge(c, s, lt):
    c.alpha_composite(Image.new("RGBA", (W, H), (8, 0, 4, 255)))
    pulse = 0.5 + 0.5 * math.sin(lt * 14)
    c.alpha_composite(vignette((200, 0, 20), int(150 + 90 * pulse)))
    sx, sy = shake(lt, 0.0, s["dur"], 10)
    gw, gh = 400, 430
    for i, rank in enumerate((4, 3, 2, 1)):
        p = ease_back(prog(lt, 0.08 * i, 0.25), 1.8)
        tile = silhouette(rank).resize((gw, gh), Image.BILINEAR)
        m = Image.new("L", (gw, gh), 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, gw - 1, gh - 1), 26, fill=255)
        t2 = Image.new("RGBA", (gw + 12, gh + 12), (0, 0, 0, 0))
        ImageDraw.Draw(t2).rounded_rectangle((0, 0, gw + 11, gh + 11), 30, fill=(255, 40, 50, 255))
        t2.paste(tile, (6, 6), m)
        qm = text_sprite("?", "anton", 220, (255, 255, 255), 8, (0, 0, 0))
        t2.alpha_composite(qm, ((t2.width - qm.width) // 2, (t2.height - qm.height) // 2))
        n = text_sprite(f"#{rank}", "anton", 90, (255, 255, 255), 6, (0, 0, 0))
        t2.alpha_composite(n, (10, 0))
        cx = W / 2 + (-1 if i % 2 == 0 else 1) * (gw / 2 + 14) + sx
        cy = 820 + (-1 if i < 2 else 1) * (gh / 2 + 14) + sy
        paste_center(c, t2, cx, cy, p)
    warn = text_sprite("TOP 4", "anton", 230, (255, 255, 255), 10, (0, 0, 0), glow=(255, 0, 30), glow_r=30)
    paste_center(c, warn, W / 2 + sx, 410, 1.0 + 0.06 * pulse, rot=-4)
    lvl = text_sprite("DIFFERENT LEVEL", "anton", 100, RED, 6, (0, 0, 0))
    paste_center(c, lvl, W / 2, 1330, ease_back(prog(lt, word_time(s, "Whole") or 1.0, 0.25), 2))
    draw_tracker(c, 5, False, RED)
    draw_captions(c, s, lt, RED, cy=1470)
    return 8 + 6 * pulse


def paint_cta(c, s, lt):
    c.alpha_composite(Image.new("RGBA", (W, H), (6, 6, 14, 255)))
    c.alpha_composite(web_overlay())
    draw_particles(c, lt, (255, 40, 50), 99, n=30)
    tw, th = 190, 204
    for i, rank in enumerate(range(1, 11)):
        p = ease_back(prog(lt, 0.03 * i, 0.25), 1.8)
        col = hexrgb(BY[f"r{rank}"]["color"])
        tile = art(rank).resize((tw, th), Image.BILINEAR)
        t2 = Image.new("RGBA", (tw + 8, th + 8), col + (255,))
        t2.paste(tile, (4, 4))
        n = text_sprite(f"#{rank}", "anton", 54, col, 4, (0, 0, 0))
        t2.alpha_composite(n, (2, -6))
        cx = W / 2 + (i % 5 - 2) * (tw + 14)
        cy = 640 + (i // 5) * (th + 16)
        paste_center(c, t2, cx, cy, p * (1.06 if rank == 1 else 1.0))
    head = text_sprite("WHO'S YOUR #1?", "anton", 150, YELLOW, 8, (0, 0, 0), glow=(255, 30, 40), glow_r=24)
    paste_center(c, head, W / 2, 330, 1 + 0.04 * math.sin(lt * 8), rot=-3)
    tc = word_time(s, "Comment") or 1.3
    tf = word_time(s, "follow") or 2.4
    com = pill("COMMENT BELOW", 84, (255, 255, 255), (235, 30, 45))
    paste_center(c, com, W / 2, 1180, ease_back(prog(lt, tc, 0.25), 2))
    if lt > tc:  # bouncing arrow
        b = abs(math.sin(lt * 7)) * 26
        d = ImageDraw.Draw(c)
        d.polygon([(W / 2 - 50, 1260 + b), (W / 2 + 50, 1260 + b), (W / 2, 1330 + b)], fill=(255, 255, 255, 255))
    fol = pill("FOLLOW FOR PART 2", 76, (0, 0, 0), YELLOW)
    paste_center(c, fol, W / 2, 1420, ease_back(prog(lt, tf, 0.25), 2))
    draw_tracker(c, 0, True, YELLOW)
    flash(c, 0.5 * (1 - prog(lt, 0, 0.15)))
    return 0


@lru_cache(None)
def tag_sprite(text, col):
    t = text_sprite(text, "bebas", 50, (255, 255, 255), 0)
    img = Image.new("RGBA", (t.width + 40, t.height + 14), (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle((0, 0, img.width - 1, img.height - 1), 16, fill=(0, 0, 0, 200), outline=col + (255,), width=4)
    img.alpha_composite(t, (20, 7))
    return img


@lru_cache(None)
def pill(text, size, fg, col):
    t = text_sprite(text, "anton", size, fg, 0)
    img = Image.new("RGBA", (t.width + 70, t.height + 30), (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle((0, 0, img.width - 1, img.height - 1), img.height // 2, fill=col + (255,),
                                          outline=(0, 0, 0, 255), width=5)
    img.alpha_composite(t, (35, 15))
    return img


@lru_cache(None)
def comment_bubble():
    w, h = 800, 200
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, w - 1, h - 1), 36, fill=(255, 255, 255, 250), outline=(0, 0, 0, 255), width=5)
    d.ellipse((26, 40, 116, 130), fill=(34, 211, 238, 255))
    d.text((48, 50), "M", font=font("anton", 58), fill=(0, 0, 0, 255))
    d.text((140, 26), "@milesfan_1610", font=font("bebas", 44), fill=(120, 120, 120, 255))
    d.text((140, 72), "MILES AT #8?? NAH", font=font("mont", 46), fill=(0, 0, 0, 255))
    d.text((140, 142), "38.2K  ·  Reply", font=font("bebas", 40), fill=(140, 140, 140, 255))
    # heart
    hx, hy = w - 70, 92
    d.ellipse((hx - 22, hy - 16, hx + 2, hy + 8), fill=(255, 40, 80, 255))
    d.ellipse((hx - 2, hy - 16, hx + 22, hy + 8), fill=(255, 40, 80, 255))
    d.polygon([(hx - 22, hy - 2), (hx + 22, hy - 2), (hx, hy + 26)], fill=(255, 40, 80, 255))
    return img


def draw_spiders(c, t):
    if t <= 0:
        return
    rs = np.random.default_rng(5)
    for i in range(28):
        side = rs.integers(0, 4)
        start = rs.uniform(0, 1)
        delay = rs.uniform(0, 0.6)
        sp = rs.uniform(500, 900)
        size = int(rs.uniform(50, 110))
        tt = t - delay
        if tt <= 0:
            continue
        if side == 0:
            x, y, ang = start * W, -60 + sp * tt, 180
        elif side == 1:
            x, y, ang = start * W, H + 60 - sp * tt, 0
        elif side == 2:
            x, y, ang = -60 + sp * tt, start * H, -90
        else:
            x, y, ang = W + 60 - sp * tt, start * H, 90
        wob = 8 * math.sin(tt * 30 + i)
        sprite = spider_sprite(size, int(ang + wob) // 5 * 5)
        paste_center(c, sprite, x + wob, y)


PAINTERS = {"hook": paint_hook, "bridge": paint_bridge, "cta": paint_cta}


def frame(i):
    t = i / FPS
    seg = next((s for s in SEGS if s["start"] <= t < s["end"]), SEGS[-1])
    lt = t - seg["start"]
    c = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    glitch = PAINTERS.get(seg["id"], paint_rank)(c, seg, lt)
    out = c.convert("RGB")
    if glitch:
        out = rgb_split(out, glitch)
    return out.tobytes()


def stills():
    d = OUT / "stills"
    d.mkdir(parents=True, exist_ok=True)
    picks = {"00_first_frame": 0.0, "01_hook_tease": BY["hook"]["start"] + 3.2}
    for s in SEGS:
        picks[f"{s['id']}"] = s["start"] + min(s["dur"] - 0.1, 1.8)
    picks["r8_comment"] = BY["r8"]["start"] + 5.0
    picks["r5_spiders"] = BY["r5"]["start"] + 3.3
    picks["r1_pre"] = BY["r1"]["start"] + 0.2
    for name, t in picks.items():
        Image.frombytes("RGB", (W, H), frame(int(t * FPS))).save(d / f"{name}.png")
        print("still", name, round(t, 2))


def render():
    OUT.mkdir(parents=True, exist_ok=True)
    n = int(TOTAL * FPS)
    target = OUT / "spiderman_top10_tiktok.mp4"
    ff = subprocess.Popen([
        "ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
        "-i", "-", "-i", str(ROOT / "build" / "audio" / "mix.wav"),
        "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-profile:v", "high",
        "-c:a", "aac", "-b:a", "256k", "-ar", "44100", "-movflags", "+faststart", "-shortest", str(target)],
        stdin=subprocess.PIPE)
    with Pool(4) as pool:
        for k, buf in enumerate(pool.imap(frame, range(n), chunksize=6)):
            ff.stdin.write(buf)
            if k % 150 == 0:
                print(f"frame {k}/{n}", flush=True)
    ff.stdin.close()
    ff.wait()
    print("wrote", target)


if __name__ == "__main__":
    stills() if "--stills" in sys.argv else render()
