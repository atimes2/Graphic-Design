/* Halloween at Henderson: tiny deterministic motion engine.
 *
 * Every frame is a pure function of time: renderFrame(cardId, t) draws the
 * frame for time t (seconds). No wall-clock, no Math.random, so renders are
 * repeatable and the Playwright renderer can step frame by frame.
 */
(function () {
  const W = 1080, H = 1920, FPS = 30;

  const COLOR = {
    void: '#050303', bone: '#FFF1E0', ember: '#E0301E', pumpkin: '#E8621C',
    rind: '#8A2A0A', candle: '#FFD9A0', glint: '#EAF4FF',
  };

  // ------------------------------------------------------------ math / easing
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const ease = {
    linear: (t) => t,
    in2: (t) => t * t,
    out2: (t) => 1 - (1 - t) * (1 - t),
    inOut2: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    inOut3: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
    // spring-ish settle with <=3% overshoot
    outSoft: (t) => {
      if (t >= 1) return 1;
      const e = 1 - Math.pow(2, -9 * t);
      return e + 0.03 * Math.sin(t * Math.PI) * Math.pow(1 - t, 1.5) * 4 * t;
    },
  };

  // --------------------------------------------------------- deterministic noise
  const hash = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const vnoise = (x) => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return lerp(hash(i), hash(i + 1), u);
  };
  // candle flicker: ~0.8..1 with occasional dips
  const flicker = (t, seed = 0) => {
    const a = vnoise(t * 6 + seed) * 0.5 + vnoise(t * 13.7 + seed * 3.1) * 0.3 +
      vnoise(t * 31 + seed * 7.3) * 0.2;
    const dip = Math.pow(Math.max(0, vnoise(t * 2.1 + seed * 11) - 0.7) / 0.3, 2);
    return 0.8 + 0.2 * a - 0.28 * dip;
  };
  // periodic flicker (loops seamlessly every `period` seconds)
  const pflicker = (t, period, seed = 0) => {
    const w = (2 * Math.PI) / period;
    const ks = [5, 11, 17, 29, 43, 61];
    let s = 0;
    ks.forEach((k, i) => { s += Math.sin(w * k * t + hash(seed + i) * 6.28) / (1 + i * 0.6); });
    return 0.88 + 0.055 * s;
  };
  // neon/ember "warm up": flickers on over p in 0..1
  const neon = (p) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    const steps = [0.0, 0.85, 0.1, 0.55, 0.0, 0.9, 0.6, 1.0];
    const i = Math.floor(p * steps.length);
    return steps[Math.min(i, steps.length - 1)];
  };

  // ------------------------------------------------------------------- assets
  const A = { img: {}, meta: null, blur: new Map(), content: null };
  const IMAGES = ['knife', 'pumpkin', 'art', 'h_glow', 'title', 'title_fill', 'title_ember', 'footer', 'logo'];

  function loadImage(src) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = src;
    });
  }

  async function load() {
    A.meta = await (await fetch('layers/meta.json')).json();
    A.content = await (await fetch('content.json')).json();
    await Promise.all(IMAGES.map(async (n) => { A.img[n] = await loadImage(`layers/${n}.png`); }));
    await Promise.all([
      document.fonts.load('100px "Bowlby One"'),
      document.fonts.load('700 100px "Figtree"'),
      document.fonts.load('800 100px "Figtree"'),
      document.fonts.load('100px "Lobster"'),
    ]);
    buildGrain();
  }

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // cached blurred copy of an image or canvas: returns {c, pad}
  function blurred(key, src, px) {
    const k = `${key}:${px}`;
    if (A.blur.has(k)) return A.blur.get(k);
    const pad = Math.ceil(px * 3);
    const c = canvas(src.width + pad * 2, src.height + pad * 2);
    const x = c.getContext('2d');
    x.filter = `blur(${px}px)`;
    x.drawImage(src, pad, pad);
    const v = { c, pad };
    A.blur.set(k, v);
    return v;
  }

  // ------------------------------------------------------------- film texture
  const GRAIN = [];
  function buildGrain() {
    let seed = 1;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let n = 0; n < 8; n++) {
      const c = canvas(540, 960);
      const x = c.getContext('2d');
      const d = x.createImageData(540, 960);
      for (let i = 0; i < d.data.length; i += 4) {
        const v = (rnd() + rnd() + rnd()) / 3 * 255;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
        d.data[i + 3] = 255;
      }
      x.putImageData(d, 0, 0);
      GRAIN.push(c);
    }
  }

  function post(ctx, t, opts = {}) {
    const f = Math.round(t * FPS);
    // grain: overlay for mids, a whisper of screen so the blacks breathe
    const g = GRAIN[f % GRAIN.length];
    const ox = -Math.floor(hash(f) * 40), oy = -Math.floor(hash(f + 99) * 40);
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = opts.grain ?? 0.16;
    ctx.drawImage(g, ox, oy, W + 80, H + 80);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.035;
    ctx.drawImage(g, ox, oy, W + 80, H + 80);
    ctx.restore();
    // vignette
    ctx.save();
    const v = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.28, W / 2, H * 0.48, H * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, `rgba(0,0,0,${opts.vignette ?? 0.6})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ------------------------------------------------------------ draw helpers
  function drawImg(ctx, im, x, y, s = 1, alpha = 1, op = 'source-over') {
    if (alpha <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = clamp(alpha);
    ctx.globalCompositeOperation = op;
    ctx.drawImage(im, x, y, im.width * s, im.height * s);
    ctx.restore();
  }

  // additive bloom from a cached blur
  function bloom(ctx, key, im, x, y, s, px, alpha) {
    if (alpha <= 0.001) return;
    const b = blurred(key, im, px);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(alpha);
    ctx.drawImage(b.c, x - b.pad * s, y - b.pad * s, b.c.width * s, b.c.height * s);
    ctx.restore();
  }

  // procedural knife-tip star glint
  function glint(ctx, x, y, size, intensity, rot = -0.1) {
    if (intensity <= 0.001 || size <= 0.5) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(intensity);
    // halo
    let g = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.55);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.12, 'rgba(225,240,255,0.55)');
    g.addColorStop(0.45, 'rgba(255,170,90,0.12)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, size * 0.55, 0, Math.PI * 2); ctx.fill();
    // rays
    const ray = (ang, len, wid) => {
      ctx.save();
      ctx.rotate(ang);
      const lg = ctx.createLinearGradient(0, 0, len, 0);
      lg.addColorStop(0, 'rgba(255,255,255,1)');
      lg.addColorStop(0.35, 'rgba(220,236,255,0.6)');
      lg.addColorStop(1, 'rgba(200,225,255,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(0, -wid); ctx.lineTo(len, 0); ctx.lineTo(0, wid); ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    for (let i = 0; i < 4; i++) ray(rot + (i * Math.PI) / 2, size * (i % 2 ? 1.15 : 0.72), size * 0.035);
    for (let i = 0; i < 4; i++) ray(rot + Math.PI / 4 + (i * Math.PI) / 2, size * 0.42, size * 0.022);
    // core
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.09);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, size * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // glint envelope: quick flare then decay to a pinpoint
  const flare = (t, t0, dur = 1.1, base = 0.25) => {
    const p = (t - t0) / dur;
    if (p < 0) return 0;
    if (p < 0.12) return ease.out2(p / 0.12);
    return base + (1 - base) * Math.exp(-(p - 0.12) * 5);
  };

  // --------------------------------------------------------------- text
  function setFont(ctx, family, size, weight = '') {
    ctx.font = `${weight} ${size}px "${family}"`.trim();
  }

  // Poster-style type: bone fill, thin ember outline + ember glow
  function emberText(ctx, str, x, y, size, o = {}) {
    const a = o.alpha ?? 1;
    if (a <= 0.001) return;
    ctx.save();
    setFont(ctx, o.family || 'Bowlby One', size, o.weight);
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.letterSpacing = `${o.tracking ?? 0}px`;
    const glowA = (o.glow ?? 1) * a;
    ctx.globalAlpha = clamp(glowA);
    ctx.shadowColor = 'rgba(224,48,30,0.95)';
    ctx.shadowBlur = size * 0.32;
    ctx.strokeStyle = '#E0301E';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.075;
    ctx.strokeText(str, x, y);
    ctx.shadowBlur = size * 0.1;
    ctx.strokeText(str, x, y);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = clamp(a * (o.fill ?? 1));
    ctx.fillStyle = o.color || COLOR.bone;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  // same, but each letter gets its own progress (for burn-ins)
  function emberTextLetters(ctx, str, x, y, size, letterFn, o = {}) {
    ctx.save();
    setFont(ctx, o.family || 'Bowlby One', size, o.weight);
    ctx.letterSpacing = `${o.tracking ?? 0}px`;
    const total = ctx.measureText(str).width;
    const align = o.align || 'center';
    let x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    ctx.restore();
    const n = str.length;
    for (let i = 0; i < n; i++) {
      ctx.save();
      setFont(ctx, o.family || 'Bowlby One', size, o.weight);
      ctx.letterSpacing = `${o.tracking ?? 0}px`;
      const before = ctx.measureText(str.slice(0, i)).width;
      ctx.restore();
      const ch = str[i];
      if (ch === ' ') continue;
      const { ember, fill } = letterFn(i, n);
      emberText(ctx, ch, x0 + before, y, size, { ...o, align: 'left', alpha: 1, glow: ember, fill });
    }
  }

  function label(ctx, str, x, y, size, o = {}) {
    const a = o.alpha ?? 1;
    if (a <= 0.001) return;
    ctx.save();
    setFont(ctx, o.family || 'Figtree', size, o.weight || '800');
    ctx.textAlign = o.align || 'center';
    ctx.letterSpacing = `${o.tracking ?? 0}px`;
    ctx.globalAlpha = clamp(a);
    if (o.glow) {
      ctx.shadowColor = o.glowColor || 'rgba(224,48,30,0.8)';
      ctx.shadowBlur = o.glow;
    }
    ctx.fillStyle = o.color || COLOR.bone;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  // ------------------------------------------------------ poster building blocks
  // The standard 9:16 lockup (title / art / footer) in canvas px.
  const LOCK = {
    title: { x: 72, y: 272, s: 1.08 },
    art: { x: 212, y: 548, s: 1.12 },
    footer: { x: 250, y: 1472, s: 1.0 },
  };

  // knife rendered into an offscreen canvas with brightness + light sweep
  let knifeBuf = null;
  function knifeLayer(bright = 1, sweep = -1) {
    const im = A.img.knife;
    if (!knifeBuf) knifeBuf = canvas(im.width, im.height);
    const x = knifeBuf.getContext('2d');
    x.globalCompositeOperation = 'source-over';
    x.globalAlpha = 1;
    x.clearRect(0, 0, im.width, im.height);
    x.drawImage(im, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    if (bright < 1) {
      x.globalAlpha = 1 - clamp(bright);
      x.fillStyle = '#000';
      x.fillRect(0, 0, im.width, im.height);
      x.globalAlpha = 1;
    }
    if (sweep > -0.5 && sweep < 1.5) {
      // highlight band travelling down the blade axis (hand -> tip)
      const [gx, gy] = A.meta.glint;
      const sx = 190, sy = 210;
      const px = lerp(sx, gx, sweep), py = lerp(sy, gy, sweep);
      const dx = gx - sx, dy = gy - sy, L = Math.hypot(dx, dy);
      const ux = dx / L, uy = dy / L;
      const g = x.createLinearGradient(px - ux * 70, py - uy * 70, px + ux * 70, py + uy * 70);
      g.addColorStop(0, 'rgba(255,245,230,0)');
      g.addColorStop(0.5, 'rgba(255,248,238,0.75)');
      g.addColorStop(1, 'rgba(255,245,230,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, im.width, im.height);
    }
    return knifeBuf;
  }

  /* Draw the key art (pumpkin, H glow, knife) at (x, y, s).
   * o.pumpkin: pumpkin brightness 0..1 (already includes flicker if wanted)
   * o.h:       H-carving glow 0..1
   * o.knife:   knife brightness 0..1, o.knifeAlpha, o.knifeOffset [dx,dy] in art px
   * o.sweep:   blade light sweep position 0..1 (or -1 off)
   */
  function art(ctx, x, y, s, o = {}) {
    const P = A.img.pumpkin, Hh = A.img.h_glow;
    const pb = o.pumpkin ?? 1;
    drawImg(ctx, P, x, y, s, pb, 'screen');
    if (pb > 0.02) bloom(ctx, 'pumpkin', P, x, y, s, 26, 0.32 * pb * (o.bloom ?? 1));
    const h = o.h ?? 1;
    if (h > 0.001) {
      drawImg(ctx, Hh, x, y, s, 0.55 * h, 'lighter');
      bloom(ctx, 'h1', Hh, x, y, s, 10, 0.8 * h);
      bloom(ctx, 'h2', Hh, x, y, s, 34, 0.75 * h);
    }
    const kb = o.knife ?? 1;
    const ka = o.knifeAlpha ?? 1;
    if (ka > 0.001) {
      const [dx, dy] = o.knifeOffset || [0, 0];
      const k = knifeLayer(kb, o.sweep ?? -1);
      drawImg(ctx, k, x + dx * s, y + dy * s, s, ka);
    }
  }

  /* Henderson Brewing Co. roundel (keyed from the can in prep_logo.py).
   * Placed by its circle centre (cx, cy) at a given circle diameter. */
  function logo(ctx, cx, cy, diameter, alpha = 1, glow = 0.25) {
    if (alpha <= 0.001) return;
    const L = A.meta.logo, im = A.img.logo;
    const s = diameter / (2 * L.radius);
    const x = cx - L.center[0] * s, y = cy - L.center[1] * s;
    drawImg(ctx, im, x, y, s, alpha);
    if (glow > 0) bloom(ctx, 'logo', im, x, y, s, 36, glow * alpha);
  }
  // same, but positioned by the centre of the logo's H at a given H height (for match cuts)
  function logoByH(ctx, hx, hy, hHeight, alpha = 1, glow = 0.25) {
    const L = A.meta.logo;
    const [x0, y0, x1, y1] = L.h_box;
    const s = hHeight / (y1 - y0);
    const hcx = (x0 + x1) / 2, hcy = (y0 + y1) / 2;
    logo(ctx, hx + (L.center[0] - hcx) * s, hy + (L.center[1] - hcy) * s, 2 * L.radius * s, alpha, glow);
  }

  function artTip(x, y, s, off = [0, 0]) {
    const [gx, gy] = A.meta.glint;
    return [x + (gx + off[0]) * s, y + (gy + off[1]) * s];
  }

  /* Poster title with per-letter control.
   * letterFn(lineIdx, i, n) -> {ember, fill}  (0..1 each)
   */
  function title(ctx, x, y, s, letterFn, o = {}) {
    const meta = A.meta.title_letters;
    const imE = A.img.title_ember, imF = A.img.title_fill;
    const lines = [meta.line1, meta.line2];
    const glowBoost = o.bloom ?? 1;
    lines.forEach((ln, li) => {
      const cols = ln.cols;
      const y0 = li === 0 ? 0 : ln.y[0] - 2;
      const y1 = li === 0 ? ln.y[1] + 1 : imE.height;
      cols.forEach((c, i) => {
        const left = i === 0 ? 0 : Math.floor((cols[i - 1][1] + c[0]) / 2);
        const right = i === cols.length - 1 ? imE.width : Math.floor((c[1] + cols[i + 1][0]) / 2);
        const { ember, fill } = letterFn(li, i, cols.length);
        const w = right - left, h = y1 - y0;
        if (ember > 0.001) {
          ctx.save();
          ctx.globalAlpha = clamp(ember);
          ctx.drawImage(imE, left, y0, w, h, x + left * s, y + y0 * s, w * s, h * s);
          const b = blurred('titleE', imE, 9);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = clamp(ember * 0.9 * glowBoost);
          ctx.drawImage(b.c, left + b.pad, y0 + b.pad, w, h, x + left * s, y + y0 * s, w * s, h * s);
          ctx.restore();
        }
        if (fill > 0.001) {
          ctx.save();
          ctx.globalAlpha = clamp(fill);
          ctx.drawImage(imF, left, y0, w, h, x + left * s, y + y0 * s, w * s, h * s);
          ctx.restore();
        }
      });
    });
  }

  const titleAll = (a) => () => ({ ember: a, fill: a });

  // --------------------------------------------------------------- transitions
  const scenes = [canvas(W, H), canvas(W, H), canvas(W, H)];
  function scene(i, fn, transparent = false) {
    const c = scenes[i];
    const x = c.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, W, H);
    if (!transparent) {
      x.fillStyle = COLOR.void;
      x.fillRect(0, 0, W, H);
    }
    fn(x);
    return c;
  }

  /* Knife-slash wipe from scene A to scene B.
   * p 0..1: 0-0.28 the cut races across; 0.28-1 the halves part along the
   * cut's normal and fall away, revealing B.
   */
  function slashWipe(ctx, A_, B_, p, o = {}) {
    const ang = ((o.angle ?? 62) * Math.PI) / 180;
    const cx = o.cx ?? W / 2, cy = o.cy ?? H / 2;
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const nx = -uy, ny = ux;
    const R = 2600;
    const cut = ease.inOut2(prog(p, 0, 0.28));
    const part = ease.inOut3(prog(p, 0.24, 1));
    ctx.drawImage(B_, 0, 0);
    if (part < 1) {
      [1, -1].forEach((side) => {
        ctx.save();
        const d = part * 620 * side;
        const drift = part * 180 * side;
        ctx.translate(nx * d + ux * drift, ny * d + uy * drift);
        ctx.beginPath();
        ctx.moveTo(cx - ux * R, cy - uy * R);
        ctx.lineTo(cx + ux * R, cy + uy * R);
        ctx.lineTo(cx + ux * R + nx * R * side, cy + uy * R + ny * R * side);
        ctx.lineTo(cx - ux * R + nx * R * side, cy - uy * R + ny * R * side);
        ctx.closePath();
        ctx.clip();
        ctx.globalAlpha = 1 - ease.in2(part);
        ctx.drawImage(A_, 0, 0);
        ctx.restore();
      });
    }
    // the cut itself: a white-hot line with ember glow
    const lineA = cut * (1 - ease.out2(prog(p, 0.3, 0.7)));
    if (lineA > 0.001) {
      const L = 1400;
      const x0 = cx - ux * L, y0 = cy - uy * L;
      const x1 = lerp(x0, cx + ux * L, cut), y1 = lerp(y0, cy + uy * L, cut);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = lineA;
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(255,90,40,1)';
      ctx.shadowBlur = 40;
      ctx.strokeStyle = 'rgba(255,120,60,0.9)';
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.shadowBlur = 12;
      ctx.shadowColor = 'rgba(255,240,220,1)';
      ctx.strokeStyle = 'rgba(255,250,240,1)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.restore();
      if (cut < 1) glint(ctx, x1, y1, 170, lineA);
    }
  }

  // ------------------------------------------------------------------ frame
  const CARDS = {};
  function register(card) { CARDS[card.id] = card; }

  function renderFrame(ctx, id, t) {
    const card = CARDS[id];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = COLOR.void;
    ctx.fillRect(0, 0, W, H);
    // gate weave: ±1px drift
    ctx.save();
    ctx.translate((vnoise(t * 9) - 0.5) * 2, (vnoise(t * 7 + 50) - 0.5) * 2.4);
    card.draw(ctx, t);
    ctx.restore();
    post(ctx, t, card.post || {});
  }

  window.HH = {
    W, H, FPS, COLOR, clamp, lerp, prog, ease, hash, vnoise, flicker, pflicker, neon, flare,
    A, load, canvas, blurred, drawImg, bloom, glint, setFont, emberText, emberTextLetters, label,
    LOCK, art, artTip, logo, logoByH, title, titleAll, scene, slashWipe, register, CARDS, renderFrame,
  };
})();
