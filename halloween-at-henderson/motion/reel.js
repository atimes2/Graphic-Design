/* Collab Reels with Henderson Brewing Co.: three ~42s variations, 1080x1920.
 *
 * Each cuts public-domain archival film (Prelinger collection, see
 * reel/SOURCES.md) into the poster's world, then ends on the same poster card.
 *   A  Feature Presentation  a 1950s movie trailer
 *   B  Rules of the Night    a 1950s classroom etiquette film
 *   C  Special Bulletin      a vintage TV news interruption (black-and-white)
 *
 * The film plays in a 4:3 panel inside the 4:5 centre of the frame, so the
 * feed and grid crops keep every word. Footage frames are pre-graded by
 * prep_footage.py; each card's prepare(t) loads the frame it needs before the
 * renderer draws it. Hard cuts land on the 124 BPM grid used by the stories.
 */
(function () {
  const {
    W, H, clamp, lerp, prog, ease, flicker, neon, hash, vnoise, A, canvas, glint, sparkle, setFont, fit,
    emberText, label, kicker, revealText, neonLabel, art, artTip, artH, logo, title, scene, shakeAt, flash, register,
  } = window.HH;
  const P = () => window.HH_PARTS;
  const BONE = '#FFF1E0';
  const FPS = 30;
  const BEAT = 60 / 124;
  const PANEL = { x: 40, y: 590, w: 1000, h: 750, r: 14 };
  const DUR = 42;

  // --------------------------------------------------------------- footage
  const FOOT = { index: null, cache: new Map() };
  async function footIndex() {
    if (!FOOT.index) FOOT.index = await (await fetch('footage/index.json')).json();
    return FOOT.index;
  }
  function getImg(url) {
    let e = FOOT.cache.get(url);
    if (!e) {
      const im = new Image();
      e = { im, ok: false };
      e.p = new Promise((res) => { im.onload = () => { e.ok = true; res(); }; im.onerror = res; });
      im.src = url;
      FOOT.cache.set(url, e);
      if (FOOT.cache.size > 120) FOOT.cache.delete(FOOT.cache.keys().next().value);
    }
    return e;
  }
  const frameURL = (shot, grade, lt) => {
    const n = FOOT.index[shot.clip].frames;
    const i = clamp(Math.floor((lt + (shot.at || 0)) * FPS), 0, n - 1);
    return `footage/${shot.clip}/${grade}/${String(i).padStart(4, '0')}.jpg`;
  };
  const shotAt = (shots, t) => {
    for (let i = shots.length - 1; i >= 0; i--) if (t >= shots[i].t0) return t < shots[i].t1 + 0.9 ? shots[i] : null;
    return null;
  };
  function footImg(v, t) {
    const s = shotAt(v.shots, t);
    if (!s || !FOOT.index) return null;
    const e = getImg(frameURL(s, v.grade, t - s.t0));
    return e.ok ? { im: e.im, shot: s } : null;
  }

  // ---------------------------------------------------------- film panel
  function dust(ctx, t, p, amt = 1) {
    const f = Math.round(t * FPS);
    ctx.save();
    for (let i = 0; i < 7; i++) {
      const h1 = hash(f * 13.1 + i * 7.7), h2 = hash(f * 3.7 + i * 1.3), h3 = hash(f * 9.3 + i * 4.1);
      if (h3 > 0.55) continue;
      ctx.globalAlpha = 0.25 * amt * (0.4 + h3);
      ctx.fillStyle = h1 > 0.5 ? 'rgba(255,241,224,1)' : 'rgba(5,3,3,1)';
      ctx.beginPath();
      ctx.ellipse(p.x + h1 * p.w, p.y + h2 * p.h, 1 + h3 * 3, 1 + h1 * 2.5, h2 * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (hash(f * 0.37 + 11) < 0.35) {   // a hairline scratch
      const x = p.x + hash(Math.floor(f / 4) * 5.3) * p.w;
      ctx.globalAlpha = 0.12 * amt;
      ctx.fillStyle = BONE;
      ctx.fillRect(x, p.y, 1.2, p.h);
    }
    ctx.restore();
  }

  function scanlines(ctx, p) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#000';
    for (let y = p.y; y < p.y + p.h; y += 4) ctx.fillRect(p.x, y, p.w, 1.6);
    ctx.restore();
  }

  function panelPath(ctx, p, r = p.r) { ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, r); }

  // the projected frame: weave, exposure flicker, slow push, dust, vignette
  function drawPanel(ctx, t, img, o = {}) {
    const p = PANEL, a = o.alpha ?? 1;
    if (a <= 0.001) return;
    const r = o.crt ? 46 : p.r;
    ctx.save();
    ctx.globalAlpha = a;
    panelPath(ctx, p, r);
    ctx.clip();
    ctx.fillStyle = '#050303';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    if (img) {
      const wx = (vnoise(t * 7.3) - 0.5) * 3, wy = (vnoise(t * 5.1 + 30) - 0.5) * 4;
      const ex = (o.exposure ?? 1) * (0.95 + 0.07 * vnoise(t * 22 + 3));
      const z = 1.03 + (o.push ?? 0.04) * (o.lt ?? 0) / 2;
      const dw = p.w * z, dh = p.h * z;
      ctx.filter = `brightness(${ex.toFixed(3)})`;
      ctx.drawImage(img, p.x + (p.w - dw) / 2 + wx, p.y + (p.h - dh) / 2 + wy, dw, dh);
      ctx.filter = 'none';
    }
    dust(ctx, t, p, o.dust ?? 1);
    if (o.crt) scanlines(ctx, p);
    const v = ctx.createRadialGradient(p.x + p.w / 2, p.y + p.h / 2, p.h * 0.32, p.x + p.w / 2, p.y + p.h / 2, p.w * 0.7);
    v.addColorStop(0, 'rgba(5,3,3,0)');
    v.addColorStop(1, `rgba(5,3,3,${o.crt ? 0.75 : 0.5})`);
    ctx.fillStyle = v;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.restore();
    // hairline frame
    ctx.save();
    ctx.globalAlpha = a * (o.crt ? 0.35 : 0.22);
    ctx.strokeStyle = BONE;
    ctx.lineWidth = o.crt ? 2.5 : 1.5;
    panelPath(ctx, p, r);
    ctx.stroke();
    ctx.restore();
  }

  // a splice flash on a cut, and an ember light leak drifting across the panel
  function spliceFlash(ctx, t, t0, k = 0.3) {
    const d = t - t0;
    if (d < 0 || d > 0.2) return;
    const p = PANEL;
    ctx.save();
    panelPath(ctx, p);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,190,140,${k * Math.exp(-d * 30)})`;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.restore();
  }
  function leak(ctx, t, t0, dur, k = 0.5, fromLeft = true) {
    const q = prog(t, t0, t0 + dur);
    if (q <= 0 || q >= 1) return;
    const p = PANEL, a = Math.sin(q * Math.PI) * k;
    const x = fromLeft ? lerp(p.x - 200, p.x + p.w + 200, q) : lerp(p.x + p.w + 200, p.x - 200, q);
    const y = p.y + p.h * (0.3 + 0.4 * q);
    ctx.save();
    panelPath(ctx, p);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 10, x, y, 520);
    g.addColorStop(0, `rgba(255,150,70,${a})`);
    g.addColorStop(0.4, `rgba(230,70,25,${a * 0.5})`);
    g.addColorStop(1, 'rgba(200,40,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.restore();
  }

  // the film burns through from a hot spot, revealing black
  const burnBuf = canvas(W, H);
  function burnOut(ctx, t, t0, dur, drawFn) {
    const q = ease.in2(prog(t, t0, t0 + dur));
    const p = PANEL;
    const cx = p.x + p.w * 0.58, cy = p.y + p.h * 0.46;
    const R = q * 1100;
    const b = burnBuf.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalCompositeOperation = 'source-over';
    b.globalAlpha = 1;
    b.clearRect(0, 0, W, H);
    drawFn(b);
    if (R > 0) {
      b.globalCompositeOperation = 'destination-out';
      const hole = b.createRadialGradient(cx, cy, R * 0.6, cx, cy, R);
      hole.addColorStop(0, 'rgba(0,0,0,1)');
      hole.addColorStop(1, 'rgba(0,0,0,0)');
      b.fillStyle = hole;
      b.fillRect(0, 0, W, H);
    }
    ctx.drawImage(burnBuf, 0, 0);
    if (q > 0 && q < 1) {   // glowing edge of the burn
      ctx.save();
      panelPath(ctx, p);
      ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      const ring = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 1.05);
      ring.addColorStop(0, 'rgba(255,120,40,0)');
      ring.addColorStop(0.7, `rgba(255,170,90,${0.9 * (1 - q)})`);
      ring.addColorStop(0.85, `rgba(255,90,30,${0.6 * (1 - q)})`);
      ring.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.fillStyle = ring;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.restore();
    }
  }

  // ------------------------------------------------------------- captions
  // cap = { t0, t1, k (kicker), h (headline, \n = two lines), s (line under the panel), style }
  function caption(ctx, t, cap, o = {}) {
    if (t < cap.t0 || t > cap.t1) return;
    const out = 1 - ease.in2(prog(t, cap.t1 - 0.25, cap.t1));
    ctx.save();
    ctx.globalAlpha = out;
    const lines = cap.h ? cap.h.split('\n') : [];
    const size = Math.min(...lines.map((l) => fit(ctx, l, lines.length > 1 ? 92 : 118, 980)));
    const base = 548;
    const ys = lines.length > 1 ? [base - size * 1.02, base] : [base];
    const ky = (ys[0] - size * 0.95) - 18;
    if (cap.k) kicker(ctx, cap.k, ky, (o.kickerAlpha ?? 1) * neon(prog(t, cap.t0, cap.t0 + 0.35)), { size: 38, tracking: 12, glow: 22 });
    lines.forEach((l, i) => {
      if (cap.instant) emberText(ctx, l, W / 2, ys[i], size, { glow: 0.9 + 0.1 * flicker(t, 3 + i) });   // the hook: fully on screen at frame 0
      else revealText(ctx, l, W / 2, ys[i], size, t, cap.t0 + 0.12 + i * 0.22, cap.style || 'fade', { dur: 0.6, step: 0.04, seed: i + 3 });
    });
    if (cap.s) {
      const sz = fit(ctx, cap.s, 40, 980, 'Figtree', 6, '800');
      label(ctx, cap.s, W / 2, PANEL.y + PANEL.h + 78, sz, { tracking: 6, color: BONE, alpha: ease.out2(prog(t, cap.t0 + 0.5, cap.t0 + 1.0)) * out, weight: '800' });
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ end card
  // knife stabs in, pumpkin ignites, title burns, lasers fire, the details land
  const END = { title: { y: 290, s: 0.92 }, art: { x: 540 - 272 * 0.74, y: 520, s: 0.74 } };
  function endCard(ctx, t, t0) {
    const { stab, ignite, titleBurn, lasers } = P();
    const lt = t - t0;
    if (lt < 0) return;
    const hit = 0.3;
    const [dx, dy] = shakeAt(lt, [hit], 10);
    ctx.save();
    ctx.translate(dx, dy);
    const Ar = END.art;
    const off = stab(lt, hit - 0.22, hit, 800);
    const glow = ctx.createRadialGradient(540, 820, 40, 540, 820, 760);
    glow.addColorStop(0, `rgba(226,74,22,${0.22 * ease.out2(prog(lt, hit, hit + 0.6)) * flicker(lt, 4)})`);
    glow.addColorStop(1, 'rgba(226,74,22,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    art(ctx, Ar.x, Ar.y, Ar.s, { pumpkin: ignite(lt, hit + 0.05), h: ignite(lt, hit + 0.05, 3) * 1.05, knifeAlpha: lt >= hit - 0.22 ? 1 : 0, knifeOffset: off });
    const [gx, gy] = artTip(Ar.x, Ar.y, Ar.s, off);
    sparkle(ctx, gx, gy, 300, lt, hit, { hold: 0.2 });
    [5.5, 9.0].forEach((s0) => sparkle(ctx, gx, gy, 300, lt, s0, { hold: 0.2 }));
    const [hx, hy] = artH(Ar.x, Ar.y, Ar.s);
    const on = ease.out2(prog(lt, 1.1, 1.4));
    if (on > 0) lasers(ctx, lt, on, { origin: [hx, hy], t0: 1.1, spread: 1.15, n: 7, haze: 0.08 });
    // shade so the title reads over the beams
    ctx.save();
    ctx.translate(W / 2, 400);
    ctx.scale(1, 0.42);
    const sh = ctx.createRadialGradient(0, 0, 60, 0, 0, 600);
    sh.addColorStop(0, `rgba(5,3,3,${0.6 * on})`);
    sh.addColorStop(0.6, `rgba(5,3,3,${0.4 * on})`);
    sh.addColorStop(1, 'rgba(5,3,3,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(-W, -1400, W * 2, 2800);
    ctx.restore();
    titleBurn(ctx, W / 2 - 433 * END.title.s, END.title.y, END.title.s, lt, 0.6, 0.03);
    const c = A.content.reel.end;
    revealText(ctx, c.date, W / 2, 1200, fit(ctx, c.date, 100, 960), lt, 1.7, 'burn', { step: 0.045 });
    kicker(ctx, c.time, 1268, ease.out2(prog(lt, 2.3, 2.9)), { size: 34, tracking: 12 });
    neonLabel(ctx, c.tickets, 1365, lt, 2.8, { size: 54, tracking: 14 });
    const la = ease.out2(prog(lt, 3.3, 4.1));
    logo(ctx, W / 2, 1490, 290, la, 0.12 + 0.05 * flicker(lt, 2));
    ctx.restore();
    flash(ctx, lt, hit, 0.16);
  }

  // ---------------------------------------------------------- the variants
  // dance montage: cuts every two beats
  const montage = (t0, clips) => clips.map((clip, i) => ({ t0: t0 + i * 2 * BEAT, t1: t0 + (i + 1) * 2 * BEAT, clip }));

  const VARIANTS = {};

  // ---- A · FEATURE PRESENTATION: a 1950s movie trailer
  {
    // the hook is on screen from frame 0: no logo card, no fade-in
    const m0 = 9.4, mEnd = m0 + 8 * 2 * BEAT;
    VARIANTS.a = {
      id: 'reel-a-feature-presentation',
      grade: 'ember',
      dur: 38, introEnd: 0,
      burn: 25.0, end: 25.8,
      shots: [
        { t0: 0.0, t1: 2.4, clip: 'pour_spot', dim: [1.9, 2.4] },
        { t0: 2.4, t1: 3.6, clip: 'jive_a' },
        { t0: 3.6, t1: 4.9, clip: 'coney_sunburst' },
        { t0: 4.9, t1: 6.2, clip: 'fair_fountain' },
        { t0: 6.2, t1: 7.8, clip: 'car_night' },
        { t0: 7.8, t1: m0, clip: 'car_couples' },
        ...montage(m0, ['jive_b', 'dance_band', 'jive_c', 'dance_twirl', 'horns', 'jive_d', 'dance_close', 'dance_curtain']),
        { t0: mEnd, t1: 18.4, clip: 'mask_crowd' },
        { t0: 18.4, t1: 19.6, clip: 'mask_red' },
        { t0: 19.6, t1: 20.8, clip: 'mask_group' },
        { t0: 20.8, t1: 22.0, clip: 'mask_group2' },
        { t0: 22.0, t1: 23.5, clip: 'bar_toast' },
        { t0: 23.5, t1: 25.8, clip: 'bar_smile' },
      ],
      lasers: [2.4, mEnd],
      laserSnap: true,
      leaks: [[5.9, 1.4, 0.5], [mEnd - 0.2, 1.2, 0.5], [21.8, 1.4, 0.45]],
      caps: (c) => [
        { t0: 0.0, t1: 2.4, h: c[0], instant: true },
        { t0: 2.4, t1: 6.2, h: c[1], style: 'neon' },
        { t0: 6.3, t1: m0, k: c[2], h: c[3] },
        { t0: m0, t1: m0 + 4 * 2 * BEAT, k: c[4], h: c[5], style: 'neon' },
        { t0: m0 + 4 * 2 * BEAT, t1: mEnd, k: c[5], h: c[6], style: 'neon' },
        { t0: mEnd, t1: 19.6, h: c[7] },
        { t0: 19.6, t1: 22.0, h: c[8] },
        { t0: 22.0, t1: 25.1, k: c[9], h: c[10] },
      ],
      bug: true,
    };
  }

  // ---- B · RULES OF THE NIGHT: a 1950s classroom etiquette film
  {
    const r4 = 19.4, r4End = r4 + 6 * 2 * BEAT;
    VARIANTS.b = {
      id: 'reel-b-rules-of-the-night',
      grade: 'ember',
      dur: 44, introEnd: 4.6,
      audio: 'reel/audio/reel-b-rules-of-the-night.wav',   // narrator + Funeral March of a Marionette (reel_audio.py)
      burn: 30.6, end: 31.4,
      shots: [
        { t0: 4.6, t1: 6.6, clip: 'gown' },
        { t0: 6.6, t1: 8.6, clip: 'mask_man' },
        { t0: 8.6, t1: 10.6, clip: 'arrive_door' },
        { t0: 10.6, t1: 12.2, clip: 'arrive_group' },
        { t0: 12.2, t1: 13.8, clip: 'mask_group' },
        { t0: 13.8, t1: 15.6, clip: 'car_night' },
        { t0: 15.6, t1: 17.4, clip: 'tap_pour' },
        { t0: 17.4, t1: r4, clip: 'bar_toast' },
        ...montage(r4, ['jive_a', 'dance_band', 'jive_b', 'dance_twirl', 'jive_c', 'dance_close']),
        { t0: r4End, t1: 27.0, clip: 'phone_boy' },
        { t0: 27.0, t1: 28.8, clip: 'phone_girl' },
        { t0: 28.8, t1: 31.4, clip: 'coney_sunburst' },
      ],
      lasers: [r4, r4End],
      leaks: [[4.4, 1.4, 0.5], [8.4, 1.2, 0.4], [13.6, 1.2, 0.4], [r4End - 0.2, 1.2, 0.45]],
      caps: (c) => [
        { t0: 4.7, t1: 8.6, k: c[0], h: c[1], s: c[2], style: 'burn' },
        { t0: 8.7, t1: 13.8, k: c[3], h: c[4], s: c[5], style: 'burn' },
        { t0: 13.9, t1: r4, k: c[6], h: c[7], s: c[8], style: 'burn' },
        { t0: r4, t1: r4End, k: c[9], h: c[10], s: c[11], style: 'burn' },
        { t0: r4End + 0.05, t1: 30.7, k: c[12], h: c[13], s: c[14], style: 'burn' },
      ],
      intro(ctx, t) {   // title card of a classroom film
        const c = A.content.reel.b;
        const a = 1 - ease.in2(prog(t, 4.1, 4.6));
        ctx.save();
        ctx.globalAlpha = a;
        kicker(ctx, c.presents, 700, ease.out2(prog(t, 0.2, 0.8)), { size: 34, tracking: 24 });
        const rule = (y, t0) => {
          const q = ease.inOut2(prog(t, t0, t0 + 0.7));
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = 'rgba(232,98,28,0.8)';
          ctx.fillRect(540 - 400 * q, y, 800 * q, 2);
          ctx.fillRect(540 - 400 * q, y + 8, 800 * q, 1);
          ctx.restore();
        };
        rule(760, 0.4);
        const s = Math.min(fit(ctx, c.title[0], 170, 960), fit(ctx, c.title[1], 170, 960));
        revealText(ctx, c.title[0], W / 2, 920, s, t, 0.6, 'burn', { step: 0.05 });
        revealText(ctx, c.title[1], W / 2, 920 + s * 1.02, s, t, 0.95, 'burn', { step: 0.05 });
        rule(920 + s * 1.02 + 70, 1.2);
        kicker(ctx, c.sub, 920 + s * 1.02 + 150, ease.out2(prog(t, 1.6, 2.3)), { size: 34, tracking: 8, color: BONE, glow: 0 });
        ctx.restore();
      },
    };
  }

  // ---- C · SPECIAL BULLETIN: a vintage TV news interruption
  {
    const j0 = 21.6, jEnd = j0 + 5 * 2 * BEAT;
    VARIANTS.c = {
      id: 'reel-c-special-bulletin',
      grade: 'mono',
      crt: true,
      off: 30.0, end: 30.8,
      shots: [
        { t0: 3.2, t1: 4.8, clip: 'news_phones' },
        { t0: 4.8, t1: 6.6, clip: 'news_editor' },
        { t0: 6.6, t1: 8.0, clip: 'news_desk' },
        { t0: 8.0, t1: 9.6, clip: 'crowd_street' },
        { t0: 9.6, t1: 11.0, clip: 'coney_crowd' },
        { t0: 11.0, t1: 12.4, clip: 'mask_crowd' },
        { t0: 12.4, t1: 14.0, clip: 'coney_luna' },
        { t0: 14.0, t1: 15.6, clip: 'fair_radial' },
        { t0: 15.6, t1: 17.2, clip: 'fair_fountain' },
        { t0: 17.2, t1: 18.7, clip: 'mask_man' },
        { t0: 18.7, t1: 20.2, clip: 'mask_red' },
        { t0: 20.2, t1: j0, clip: 'mask_group' },
        ...montage(j0, ['jive_a', 'jive_b', 'horns', 'jive_c', 'jive_d']),
        { t0: jEnd, t1: 28.2, clip: 'news_editor2' },
        { t0: 28.2, t1: 30.0, clip: 'news_phones', at: 0.6 },
      ],
      lasers: [12.6, 17.2],
      leaks: [],
      caps: (c) => [
        { t0: 3.3, t1: 8.0, k: c[0], h: c[1] },
        { t0: 8.1, t1: 12.4, k: c[0], h: c[2] },
        { t0: 12.5, t1: 17.2, k: c[0], h: c[3] },
        { t0: 17.3, t1: j0, k: c[0], h: c[4] },
        { t0: j0, t1: jEnd, k: c[0], h: c[5] },
        { t0: jEnd + 0.05, t1: 30.0, k: c[0], h: c[6] },
      ],
      intro(ctx, t) {   // the set warms up from a dot, static, then the slide
        const c = A.content.reel.c;
        tvShape(ctx, t, 0, 0.7, false, (b) => {
          const st = 1 - ease.in2(prog(t, 0.9, 1.25));
          drawPanel(b, t, null, { crt: true, dust: 0 });
          staticNoise(b, t, st);
          const a = ease.out2(prog(t, 1.15, 1.5)) * (1 - ease.in2(prog(t, 2.9, 3.2)));
          if (a > 0) {
            b.save();
            b.globalAlpha = a;
            const L = c.interrupt;
            const s = Math.min(...L.map((l) => fit(b, l, 104, 860)));
            L.forEach((l, i) => emberText(b, l, W / 2, PANEL.y + PANEL.h / 2 - (L.length - 1) * s * 0.55 + i * s * 1.1 + s * 0.35, s, { glow: 0.5 + 0.1 * flicker(t, 3) }));
            b.restore();
          }
        });
        kicker(ctx, c.bulletin, 470, neon(prog(t, 1.2, 1.6)) * (0.75 + 0.25 * (Math.floor(t * 2) % 2)), { size: 46, tracking: 20, glow: 26 });
      },
    };
  }

  // TV switching on (dir false) / off (dir true) between t0 and t1
  const tvBuf = canvas(W, H);
  function tvShape(ctx, t, t0, t1, off, drawFn) {
    const q = prog(t, t0, t1);
    const p = PANEL;
    const b = tvBuf.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalAlpha = 1;
    b.globalCompositeOperation = 'source-over';
    b.clearRect(0, 0, W, H);
    drawFn(b);
    const k = off ? q : 1 - q;   // 0 = fully on, 1 = collapsed
    if (k <= 0.001) { ctx.drawImage(tvBuf, 0, 0); return; }
    const sy = Math.max(0.004, 1 - ease.in2(clamp(k / 0.6)));
    const sx = k < 0.6 ? 1 : Math.max(0.004, 1 - ease.in2((k - 0.6) / 0.4));
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx, sy);
    ctx.translate(-cx, -cy);
    ctx.drawImage(tvBuf, 0, 0);
    ctx.restore();
    if (k > 0.3 && k < 1) {   // the bright line / dot
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const w = p.w * sx, a = Math.sin(clamp((k - 0.3) / 0.7) * Math.PI) * 0.9;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(30, w / 2));
      g.addColorStop(0, `rgba(255,248,236,${a})`);
      g.addColorStop(1, 'rgba(255,200,150,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - w / 2 - 40, cy - 60, w + 80, 120);
      ctx.fillStyle = `rgba(255,250,240,${a})`;
      ctx.fillRect(cx - w / 2, cy - 2, w, 4);
      ctx.restore();
    }
  }
  const noiseBuf = canvas(250, 188);
  function staticNoise(ctx, t, a) {
    if (a <= 0.001) return;
    const x = noiseBuf.getContext('2d');
    const d = x.createImageData(250, 188);
    const f = Math.round(t * FPS);
    let s = (f * 9301 + 49297) % 233280;
    for (let i = 0; i < d.data.length; i += 4) {
      s = (s * 9301 + 49297) % 233280;
      const v = (s / 233280) * 255;
      d.data[i] = v; d.data[i + 1] = v * 0.95; d.data[i + 2] = v * 0.9; d.data[i + 3] = 255;
    }
    x.putImageData(d, 0, 0);
    const p = PANEL;
    ctx.save();
    panelPath(ctx, p, 46);
    ctx.clip();
    ctx.globalAlpha = a * 0.55;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(noiseBuf, p.x, p.y, p.w, p.h);
    ctx.restore();
  }

  // news ticker under the screen
  function ticker(ctx, t, a) {
    if (a <= 0.001) return;
    const c = A.content.reel.c;
    const y = PANEL.y + PANEL.h + 40, h = 72;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(190,40,18,0.95)';
    ctx.fillRect(PANEL.x, y, 230, h);
    ctx.fillStyle = 'rgba(255,241,224,0.08)';
    ctx.fillRect(PANEL.x + 230, y, PANEL.w - 230, h);
    label(ctx, c.tickerTag, PANEL.x + 115, y + 48, 30, { tracking: 6, color: BONE, weight: '800' });
    ctx.beginPath();
    ctx.rect(PANEL.x + 240, y, PANEL.w - 250, h);
    ctx.clip();
    setFont(ctx, 'Figtree', 32, '800');
    ctx.letterSpacing = '6px';
    const str = c.ticker + '   ·   ';
    const w = ctx.measureText(str).width;
    const x0 = PANEL.x + 260 - ((t * 110) % w);
    for (let i = 0; i < 4; i++) label(ctx, str, x0 + i * w, y + 49, 32, { tracking: 6, color: BONE, align: 'left', weight: '800' });
    ctx.restore();
  }

  // ---------------------------------------------------------- the card
  function build(v) {
    const caps = () => v.caps(A.content.reel[v.id.split('-')[1]].caps);
    const footEnd = v.burn ?? v.off;
    function film(ctx, t) {
      const f = footImg(v, t);
      const s = f && f.shot;
      let exposure = 1;
      if (s && s.dim) exposure *= 1 - 0.95 * ease.in2(prog(t, s.dim[0], s.dim[1]));
      if (s && s.rise) exposure *= ease.out2(prog(t, s.rise[0], s.rise[1]));
      drawPanel(ctx, t, f && f.im, { crt: v.crt, exposure, lt: s ? t - s.t0 : 0 });
      v.shots.forEach((sh, i) => { if (i && !sh.rise && v.shots[i - 1].t1 === sh.t0) spliceFlash(ctx, t, sh.t0, v.crt ? 0.12 : 0.22); });
      v.leaks.forEach(([t0, d, k], i) => leak(ctx, t, t0, d, k, i % 2 === 0));
      if (v.lasers && t > v.lasers[0] && t < v.lasers[1] + 0.5) {
        const amt = ease.out2(prog(t, v.lasers[0], v.lasers[0] + (v.laserSnap ? 0.08 : 0.6))) * (1 - ease.in2(prog(t, v.lasers[1], v.lasers[1] + 0.5)));
        P().lasers(ctx, t, amt * 0.85, { origin: [540, PANEL.y + PANEL.h + 30], t0: v.lasers[0], spread: 1.3, n: 7, haze: 0.06 });
      }
    }
    return {
      id: v.id,
      duration: v.dur ?? DUR,
      audio: v.audio,
      silent: true,
      cues: [],
      async prepare(t) {
        await footIndex();
        const s = shotAt(v.shots, t);
        if (s) await getImg(frameURL(s, v.grade, t - s.t0)).p;
      },
      draw(ctx, t) {
        if (v.intro && t < (v.introEnd ?? 3.6)) v.intro(ctx, t);
        const firstShot = v.shots[0].t0;
        if (t >= firstShot && t < footEnd + 1.0) {
          const inA = firstShot <= 0 ? 1 : ease.out2(prog(t, firstShot, firstShot + 0.25));
          const drawFilm = (c) => { c.save(); c.globalAlpha = inA; film(c, t); c.restore(); };
          if (v.burn != null && t >= v.burn) burnOut(ctx, t, v.burn, v.end - v.burn, drawFilm);
          else if (v.off != null && t >= v.off) tvShape(ctx, t, v.off, v.end, true, drawFilm);
          else drawFilm(ctx);
        }
        if (t < footEnd + 0.1) {
          caps().forEach((cap) => caption(ctx, t, cap));
          if (v.bug && t > firstShot) kicker(ctx, A.content.reel.a.bug, 1440, 0.6 * ease.out2(prog(t, firstShot, firstShot + 0.6)) * (1 - prog(t, footEnd - 0.3, footEnd)), { size: 28, tracking: 14, color: BONE, glow: 0 });
          if (v.crt) ticker(ctx, t, ease.out2(prog(t, firstShot, firstShot + 0.4)) * (1 - prog(t, v.off - 0.2, v.off)));
        }
        endCard(ctx, t, v.end);
      },
    };
  }

  Object.values(VARIANTS).forEach((v) => register(build(v)));
})();
