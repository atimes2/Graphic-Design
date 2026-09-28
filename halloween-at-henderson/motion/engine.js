/* Halloween at Henderson: tiny deterministic motion engine.
 *
 * Every frame is a pure function of time: renderFrame(ctx, cardId, t) draws
 * the frame for time t (seconds). No wall-clock, no Math.random, so renders
 * are repeatable and the Playwright renderer can step frame by frame.
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
    out3: (t) => 1 - Math.pow(1 - t, 3),
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
  // neon "warm up": flickers on over p in 0..1
  const neon = (p) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    const steps = [0.0, 0.85, 0.1, 0.55, 0.0, 0.9, 0.6, 1.0];
    return steps[Math.min(Math.floor(p * steps.length), steps.length - 1)];
  };

  // ------------------------------------------------------------------- assets
  const A = { img: {}, meta: null, blur: new Map(), content: null };
  const IMAGES = ['knife', 'pumpkin', 'art', 'h_glow', 'title', 'title_fill', 'title_ember', 'footer', 'logo', 'logo_glow'];

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
      document.fonts.load('100px "Rammetto One"'),
    ]);
    buildGrain();
    buildSparkle();
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
        const v = ((rnd() + rnd() + rnd()) / 3) * 255;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
        d.data[i + 3] = 255;
      }
      x.putImageData(d, 0, 0);
      GRAIN.push(c);
    }
  }

  function post(ctx, t, opts = {}) {
    const f = Math.round(t * FPS);
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

  function bloom(ctx, key, im, x, y, s, px, alpha) {
    if (alpha <= 0.001) return;
    const b = blurred(key, im, px);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(alpha);
    ctx.drawImage(b.c, x - b.pad * s, y - b.pad * s, b.c.width * s, b.c.height * s);
    ctx.restore();
  }

  const camera = (ctx, s, cx = W / 2, cy = H / 2, dx = 0, dy = 0) => {
    ctx.translate(cx + dx, cy + dy);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
  };

  // ============================================================ SPARKLE (v2)
  // Pre-rendered sprites: a tapered ray with a soft glow, and a spectral ring.
  const SPR = {};
  function buildSparkle() {
    const L = 1024, h = 128;
    const ray = canvas(L, h);
    const x = ray.getContext('2d');
    const shape = (w0, alpha, blur, color) => {
      x.save();
      x.filter = blur ? `blur(${blur}px)` : 'none';
      const g = x.createLinearGradient(0, 0, L, 0);
      g.addColorStop(0, `rgba(${color},${alpha})`);
      g.addColorStop(0.25, `rgba(${color},${alpha * 0.55})`);
      g.addColorStop(0.7, `rgba(${color},${alpha * 0.12})`);
      g.addColorStop(1, `rgba(${color},0)`);
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(0, h / 2 - w0);
      x.quadraticCurveTo(L * 0.25, h / 2 - w0 * 0.18, L, h / 2);
      x.quadraticCurveTo(L * 0.25, h / 2 + w0 * 0.18, 0, h / 2 + w0);
      x.closePath();
      x.fill();
      x.restore();
    };
    x.globalCompositeOperation = 'lighter';
    shape(22, 0.35, 14, '150,190,255');    // cool outer glow
    shape(9, 0.6, 4, '210,228,255');       // mid
    shape(3.2, 1.0, 0, '255,255,255');     // hot core line
    SPR.ray = ray;

    const R = 256;
    const ring = canvas(R * 2, R * 2);
    const rx = ring.getContext('2d');
    const cg = rx.createConicGradient(0, R, R);
    ['255,80,80', '255,200,80', '120,255,160', '90,170,255', '200,110,255', '255,80,80']
      .forEach((c, i, a) => cg.addColorStop(i / (a.length - 1), `rgba(${c},0.9)`));
    rx.filter = 'blur(6px)';
    rx.strokeStyle = cg;
    rx.lineWidth = 10;
    rx.beginPath(); rx.arc(R, R, R * 0.62, 0, Math.PI * 2); rx.stroke();
    SPR.ring = ring;
  }

  let NOW = 0; // current frame time, for twinkle

  function ray(ctx, ang, len, thick) {
    ctx.save();
    ctx.rotate(ang);
    ctx.drawImage(SPR.ray, 0, -64 * thick, len, 128 * thick);
    ctx.restore();
  }

  /* Anamorphic 4-point star with twinkle, a secondary diagonal cross, a warm
   * halo, a faint spectral ring and a white-hot core.
   * size ~ length of the long rays in px; intensity 0..1 (a little over is ok). */
  function glint(ctx, x, y, size, intensity, o = {}) {
    if (intensity <= 0.002 || size <= 1) return;
    const I = Math.min(intensity, 1.4);
    const t = o.t ?? NOW;
    const rot = (o.rot ?? -0.12) + (o.spin ?? 0.35) * Math.sin(t * 0.9 + x * 0.01);
    const tw = (i) => 1 + 0.16 * Math.sin(t * 17 + i * 1.9) + 0.08 * Math.sin(t * 41 + i * 3.1);
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(I);
    let g = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.5);
    g.addColorStop(0, 'rgba(255,245,230,0.55)');
    g.addColorStop(0.15, 'rgba(255,190,120,0.22)');
    g.addColorStop(1, 'rgba(255,110,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2); ctx.fill();
    // anamorphic horizontal streak
    ctx.globalAlpha = clamp(I * 0.5);
    ray(ctx, 0, size * 1.5, 0.5);
    ray(ctx, Math.PI, size * 1.5, 0.5);
    // main cross (vertical long, like the poster), twinkling
    ctx.globalAlpha = clamp(I);
    ray(ctx, rot - Math.PI / 2, size * 1.05 * tw(0), 1);
    ray(ctx, rot + Math.PI / 2, size * 1.05 * tw(1), 1);
    ray(ctx, rot, size * 0.72 * tw(2), 0.85);
    ray(ctx, rot + Math.PI, size * 0.72 * tw(3), 0.85);
    // secondary diagonal cross
    ctx.globalAlpha = clamp(I * 0.6);
    for (let i = 0; i < 4; i++) ray(ctx, rot + Math.PI / 4 + (i * Math.PI) / 2, size * 0.34 * tw(4 + i), 0.55);
    // spectral ring
    ctx.globalAlpha = clamp(I * 0.14);
    const rr = size * 0.42;
    ctx.drawImage(SPR.ring, -rr, -rr, rr * 2, rr * 2);
    // white-hot core
    ctx.globalAlpha = clamp(I);
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.11);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(235,245,255,0.8)');
    g.addColorStop(1, 'rgba(200,225,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, size * 0.11, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // glint envelope: snap in with a slight overshoot, decay to a hold level
  const flare = (t, t0, dur = 0.9, base = 0.25) => {
    const d = t - t0;
    if (d < 0) return 0;
    if (d < 0.06) return ease.out2(d / 0.06) * 1.25;
    return base + (1.25 - base) * Math.exp(-(d - 0.06) / (dur * 0.28));
  };
  // a one-shot sparkle event (size punches with it)
  function sparkle(ctx, x, y, size, t, t0, o = {}) {
    const I = flare(t, t0, o.dur ?? 0.9, o.hold ?? 0);
    if (I <= 0.002) return;
    glint(ctx, x, y, size * (0.75 + 0.25 * Math.min(I, 1.2)), I, { t, rot: o.rot, spin: o.spin });
  }

  // ------------------------------------------------------------- impacts
  // camera shake summed over a list of hit times
  const shakeAt = (t, hits, amp = 14) => {
    let dx = 0, dy = 0;
    hits.forEach((h0, i) => {
      const d = t - h0;
      if (d < 0 || d > 0.6) return;
      const e = amp * Math.exp(-d * 11);
      dx += e * Math.sin(d * 83 + i);
      dy += e * 0.55 * Math.sin(d * 67 + i * 2);
    });
    return [dx, dy];
  };
  function flash(ctx, t, t0, a = 0.3, color = '255,200,160') {
    const d = t - t0;
    if (d < 0 || d > 0.5) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(${color},${a * Math.exp(-d * 18)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  const slamScale = (t, t0, from = 0.2, dur = 0.16) => 1 + from * (1 - ease.outExpo(prog(t, t0, t0 + dur)));

  // candlelight creeping in from the frame edges (atmosphere for type cards)
  function edgeLight(ctx, t, amt, seed = 5) {
    if (amt <= 0.001) return;
    const lit = amt * flicker(t, seed);
    [[W / 2, H + 120, 1100, 1], [-150, 1300, 800, 0.6], [W + 150, 700, 800, 0.6]].forEach(([x, y, r, k]) => {
      const g = ctx.createRadialGradient(x, y, 20, x, y, r);
      g.addColorStop(0, `rgba(226,74,22,${0.5 * lit * k})`);
      g.addColorStop(1, 'rgba(226,74,22,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    });
  }

  // --------------------------------------------------------------- text
  function setFont(ctx, family, size, weight = '') {
    ctx.font = `${weight} ${size}px "${family}"`.trim();
  }

  function fit(ctx, str, size, maxW, family = 'Bowlby One', tracking = 0, weight = '') {
    ctx.save();
    setFont(ctx, family, size, weight);
    ctx.letterSpacing = `${tracking}px`;
    const w = ctx.measureText(str).width;
    ctx.restore();
    return w > maxW ? Math.floor((size * maxW) / w) : size;
  }

  // Poster-style type: bone fill, thin ember outline + ember glow
  function emberText(ctx, str, x, y, size, o = {}) {
    const a = o.alpha ?? 1;
    if (a <= 0.001) return;
    ctx.save();
    const ga = ctx.globalAlpha;   // respect any alpha the caller already set
    setFont(ctx, o.family || 'Bowlby One', size, o.weight);
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.letterSpacing = `${o.tracking ?? 0}px`;
    ctx.globalAlpha = clamp((o.glow ?? 1) * a) * ga;
    ctx.shadowColor = o.glowColor || 'rgba(224,48,30,0.95)';
    ctx.shadowBlur = size * 0.32;
    ctx.strokeStyle = o.stroke || '#E0301E';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.075;
    ctx.strokeText(str, x, y);
    ctx.shadowBlur = size * 0.1;
    ctx.strokeText(str, x, y);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = clamp(a * (o.fill ?? 1)) * ga;
    ctx.fillStyle = o.color || COLOR.bone;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  function emberTextLetters(ctx, str, x, y, size, letterFn, o = {}) {
    ctx.save();
    setFont(ctx, o.family || 'Bowlby One', size, o.weight);
    ctx.letterSpacing = `${o.tracking ?? 0}px`;
    const total = ctx.measureText(str).width;
    const align = o.align || 'center';
    const x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    const offs = [];
    for (let i = 0; i < str.length; i++) offs.push(ctx.measureText(str.slice(0, i)).width);
    ctx.restore();
    for (let i = 0; i < str.length; i++) {
      if (str[i] === ' ') continue;
      const { ember, fill } = letterFn(i, str.length);
      emberText(ctx, str[i], x0 + offs[i], y, size, { ...o, align: 'left', alpha: 1, glow: ember, fill });
    }
  }

  function label(ctx, str, x, y, size, o = {}) {
    const a = o.alpha ?? 1;
    if (a <= 0.001) return;
    ctx.save();
    const ga = ctx.globalAlpha;
    setFont(ctx, o.family || 'Figtree', size, o.weight || '800');
    ctx.textAlign = o.align || 'center';
    ctx.letterSpacing = `${o.tracking ?? 0}px`;
    ctx.globalAlpha = clamp(a) * ga;
    if (o.glow) {
      ctx.shadowColor = o.glowColor || 'rgba(224,48,30,0.8)';
      ctx.shadowBlur = o.glow;
    }
    ctx.fillStyle = o.color || COLOR.bone;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  // small tracked caps line, auto-fitted
  function kicker(ctx, str, y, a, o = {}) {
    const tr = o.tracking ?? 10;
    const size = fit(ctx, str, o.size ?? 32, o.maxW ?? 940, 'Figtree', tr, '800');
    label(ctx, str, o.x ?? W / 2, y, size, { tracking: tr, color: o.color ?? COLOR.pumpkin, alpha: a, glow: o.glow ?? 18, align: o.align });
  }

  /* Slam a headline in at t0: scale punch plus a hot glow that settles.
   * Pair with shakeAt() + flash() in the card for the full "hit". */
  function slamText(ctx, str, x, y, size, t, t0, o = {}) {
    if (t < t0) return;
    const s = slamScale(t, t0, o.from ?? 0.22, o.dur ?? 0.14);
    const glow = 0.92 + 0.08 * flicker(t, o.seed ?? 8);
    ctx.save();
    camera(ctx, s, x, y - size * 0.35);
    emberText(ctx, str, x, y, size, { ...o, glow: glow + 0.6 * Math.exp(-(t - t0) * 9), alpha: o.alpha ?? 1 });
    ctx.restore();
  }

  /* Gentle, varied text reveals (no slams):
   *  'burn'  letters warm up left→right: ember outline first, then bone fill
   *  'neon'  letters flicker on in scrambled order, like a sign warming up
   *  'fade'  soft blur-to-sharp with the tracking easing in
   *  'sweep' a sparkle travels along the line, revealing it behind
   * After the reveal the glow keeps a slow candle flicker. */
  function revealText(ctx, str, x, y, size, t, t0, style = 'burn', o = {}) {
    if (t < t0) return;
    const idle = 0.9 + 0.1 * flicker(t, o.seed ?? 8);
    const family = o.family || 'Bowlby One';
    if (style === 'burn' || style === 'neon') {
      const step = o.step ?? (style === 'burn' ? 0.055 : 0.06);
      const n = str.length;
      const order = [...Array(n).keys()].sort((a, b) => hash(a * 7.3 + (o.seed ?? 1)) - hash(b * 7.3 + (o.seed ?? 1)));
      const rank = {};
      order.forEach((k, r) => { rank[k] = r; });
      emberTextLetters(ctx, str, x, y, size, (i) => {
        if (style === 'burn') {
          const st = t0 + i * step;
          return { ember: neon(prog(t, st, st + 0.45)) * idle, fill: ease.out2(prog(t, st + 0.3, st + 0.8)) };
        }
        const st = t0 + rank[i] * step;
        const a = neon(prog(t, st, st + 0.5));
        return { ember: a * idle, fill: a };
      }, { ...o, family });
      return;
    }
    if (style === 'fade') {
      const a = ease.out3(prog(t, t0, t0 + (o.dur ?? 0.9)));
      ctx.save();
      if (a < 1) ctx.filter = `blur(${(1 - a) * 16}px)`;
      emberText(ctx, str, x, y, size, { ...o, family, alpha: a * (o.alpha ?? 1), glow: idle, tracking: (o.tracking ?? 0) + (1 - a) * size * 0.22 });
      ctx.restore();
      return;
    }
    if (style === 'sweep') {
      ctx.save();
      setFont(ctx, family, size, o.weight);
      ctx.letterSpacing = `${o.tracking ?? 0}px`;
      const w = ctx.measureText(str).width;
      ctx.restore();
      const align = o.align || 'center';
      const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
      const p = ease.inOut2(prog(t, t0, t0 + (o.dur ?? 0.8)));
      const edge = lerp(x0 - 40, x0 + w + 40, p);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, y - size * 1.6, edge, size * 2.4);
      ctx.clip();
      emberText(ctx, str, x, y, size, { ...o, family, glow: idle + 0.5 * (1 - prog(t, t0 + 0.6, t0 + 1.4)) });
      ctx.restore();
      if (p > 0 && p < 1) glint(ctx, edge, y - size * 0.35, size * 2.2, 1, { spin: 0.2 });
    }
  }

  // neon tube caps that flicker on
  function neonLabel(ctx, str, y, t, t0, o = {}) {
    const a = neon(prog(t, t0, t0 + (o.dur ?? 0.4))) * (o.alpha ?? 1);
    if (a <= 0) return;
    const tr = o.tracking ?? 10;
    const size = fit(ctx, str, o.size ?? 56, o.maxW ?? 960, 'Figtree', tr, '800');
    label(ctx, str, o.x ?? W / 2, y, size, { tracking: tr, color: o.color ?? '#FF8A4C', alpha: a, glow: o.glow ?? 30, glowColor: 'rgba(255,90,30,1)' });
    label(ctx, str, o.x ?? W / 2, y, size, { tracking: tr, color: '#FFE2CC', alpha: a * 0.45 });
  }

  // dashed slot for an Instagram sticker (link / question), sparkle orbiting it
  function stickerSlot(ctx, t, y, a, o = {}) {
    if (a <= 0.001) return;
    const bw = o.w ?? 620, bh = o.h ?? 150, bx = W / 2 - bw / 2, r = 30;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = 'rgba(255,241,224,0.5)';
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 12]);
    ctx.lineDashOffset = -t * 30;
    ctx.beginPath();
    ctx.roundRect(bx, y, bw, bh, r);
    ctx.stroke();
    ctx.restore();
    const per = 2 * (bw + bh);
    const d = ((t / (o.lap ?? 2.4)) % 1) * per;
    let px, py;
    if (d < bw) { px = bx + d; py = y; }
    else if (d < bw + bh) { px = bx + bw; py = y + (d - bw); }
    else if (d < 2 * bw + bh) { px = bx + bw - (d - bw - bh); py = y + bh; }
    else { px = bx; py = y + bh - (d - 2 * bw - bh); }
    glint(ctx, px, py, 90, 0.6 * a, { spin: 1.2 });
  }

  // ------------------------------------------------------ poster building blocks
  const LOCK = {
    title: { x: 72, y: 272, s: 1.08 },
    art: { x: 225, y: 548, s: 1.16 },
    footer: { x: 250, y: 1472, s: 1.0 },
  };

  // brightness-controlled copies of RGBA layers (offscreen, reused per key)
  const litBufs = {};
  function litLayer(key, im, bright = 1, sweep = -1) {
    let c = litBufs[key];
    if (!c) c = litBufs[key] = canvas(im.width, im.height);
    const x = c.getContext('2d');
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
      const [gx, gy] = A.meta.glint, [sx, sy] = A.meta.hilt;
      const px = lerp(sx, gx, sweep), py = lerp(sy, gy, sweep);
      const dx = gx - sx, dy = gy - sy, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      const g = x.createLinearGradient(px - ux * 70, py - uy * 70, px + ux * 70, py + uy * 70);
      g.addColorStop(0, 'rgba(255,245,230,0)');
      g.addColorStop(0.5, 'rgba(255,248,238,0.8)');
      g.addColorStop(1, 'rgba(255,245,230,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, im.width, im.height);
    }
    return c;
  }

  /* Key art at (x, y, s).
   *  o.pumpkin brightness (0..1.4; >1 = ignition overshoot), o.pumpkinAlpha,
   *  o.pumpkinOffset [dx,dy] art px, o.pumpkinScale (about the H), o.h (H glow)
   *  o.knife brightness, o.knifeAlpha, o.knifeOffset [dx,dy] art px, o.sweep 0..1 */
  function art(ctx, x, y, s, o = {}) {
    const P = A.img.pumpkin, Hh = A.img.h_glow;
    const pb = o.pumpkin ?? 1, pa = o.pumpkinAlpha ?? 1;
    const [pdx, pdy] = o.pumpkinOffset || [0, 0];
    const ps = o.pumpkinScale ?? 1;
    const [hcx, hcy] = A.meta.h_center;
    if (pa > 0.001 && pb > 0.001) {
      ctx.save();
      ctx.translate(x + (pdx + hcx) * s, y + (pdy + hcy) * s);
      ctx.scale(ps, ps);
      ctx.translate(-(x + hcx * s), -(y + hcy * s));
      drawImg(ctx, litLayer('pumpkin', P, Math.min(pb, 1)), x, y, s, pa);
      if (pb > 1) drawImg(ctx, P, x, y, s, (pb - 1) * pa, 'lighter');
      bloom(ctx, 'pumpkin', P, x, y, s, 26, 0.3 * Math.min(pb, 1.4) * pa * (o.bloom ?? 1));
      const h = (o.h ?? 1) * pa;
      if (h > 0.001) {
        drawImg(ctx, Hh, x, y, s, 0.5 * h, 'lighter');
        bloom(ctx, 'h1', Hh, x, y, s, 10, 0.75 * h);
        bloom(ctx, 'h2', Hh, x, y, s, 34, 0.7 * h);
      }
      ctx.restore();
    }
    const ka = o.knifeAlpha ?? 1;
    if (ka > 0.001) {
      const [dx, dy] = o.knifeOffset || [0, 0];
      drawImg(ctx, litLayer('knife', A.img.knife, o.knife ?? 1, o.sweep ?? -1), x + dx * s, y + dy * s, s, ka);
    }
  }

  function artTip(x, y, s, off = [0, 0]) {
    const [gx, gy] = A.meta.glint;
    return [x + (gx + off[0]) * s, y + (gy + off[1]) * s];
  }
  function artH(x, y, s) {
    const [hx, hy] = A.meta.h_center;
    return [x + hx * s, y + hy * s];
  }
  const bladeDir = () => {
    const a = (A.meta.blade_angle_deg * Math.PI) / 180;
    return [Math.cos(a), Math.sin(a)];
  };

  /* Henderson Brewing Company wordmark, placed by its centre at a given width
   * (bone, with an ember glow behind it). */
  function logo(ctx, cx, cy, width, alpha = 1, glow = 0.25) {
    if (alpha <= 0.001) return;
    const L = A.meta.logo, im = A.img.logo;
    const s = width / (2 * L.radius);
    const x = cx - L.center[0] * s, y = cy - L.center[1] * s;
    if (glow > 0) {
      bloom(ctx, 'logoG1', A.img.logo_glow, x, y, s, 30, glow * 1.6 * alpha);
      bloom(ctx, 'logoG2', A.img.logo_glow, x, y, s, 8, glow * 1.2 * alpha);
    }
    drawImg(ctx, im, x, y, s, alpha);
  }
  function logoByH(ctx, hx, hy, hHeight, alpha = 1, glow = 0.25) {
    const L = A.meta.logo;
    const [x0, y0, x1, y1] = L.h_box;
    const s = hHeight / (y1 - y0);
    const hcx = (x0 + x1) / 2, hcy = (y0 + y1) / 2;
    logo(ctx, hx + (L.center[0] - hcx) * s, hy + (L.center[1] - hcy) * s, 2 * L.radius * s, alpha, glow);
  }

  /* Poster title with per-letter control. letterFn(lineIdx, i, n) -> {ember, fill} */
  function title(ctx, x, y, s, letterFn, o = {}) {
    // the title art may be higher-res than the 866x230 layout box; s is in layout units
    const res = A.meta.title_res || 1;
    s = s / res;
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
          const b = blurred('titleE', imE, Math.round(9 * res));
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

  /* Knife-slash wipe from scene A to scene B (p 0..1). */
  function slashWipe(ctx, A_, B_, p, o = {}) {
    const ang = ((o.angle ?? 62) * Math.PI) / 180;
    const cx = o.cx ?? W / 2, cy = o.cy ?? H / 2;
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const nx = -uy, ny = ux;
    const R = 2600;
    const cut = ease.out3(prog(p, 0, 0.3));
    const part = ease.inOut3(prog(p, 0.22, 1));
    ctx.drawImage(B_, 0, 0);
    if (part < 1) {
      [1, -1].forEach((side) => {
        ctx.save();
        const d = part * 700 * side;
        const drift = part * 200 * side;
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
      ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.shadowBlur = 12;
      ctx.shadowColor = 'rgba(255,240,220,1)';
      ctx.strokeStyle = 'rgba(255,250,240,1)';
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.restore();
      if (cut < 1) glint(ctx, x1, y1, 200, lineA);
    }
  }

  // ------------------------------------------------------------------ frame
  const CARDS = {};
  function register(card) { CARDS[card.id] = card; }

  function renderFrame(ctx, id, t) {
    const card = CARDS[id];
    NOW = t;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = COLOR.void;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate((vnoise(t * 9) - 0.5) * 2, (vnoise(t * 7 + 50) - 0.5) * 2.4);  // gate weave
    card.draw(ctx, t);
    ctx.restore();
    post(ctx, t, card.post || {});
  }

  window.HH = {
    W, H, FPS, COLOR, clamp, lerp, prog, ease, hash, vnoise, flicker, pflicker, neon, flare,
    A, load, canvas, blurred, drawImg, bloom, camera, glint, sparkle, shakeAt, flash, slamScale, edgeLight,
    setFont, fit, emberText, emberTextLetters, label, kicker, slamText, revealText, neonLabel, stickerSlot,
    LOCK, art, artTip, artH, bladeDir, logo, logoByH, title, scene, slashWipe, register, CARDS, renderFrame,
  };
})();
