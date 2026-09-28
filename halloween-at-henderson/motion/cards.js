/* Instagram Story cards for Halloween at Henderson. Each card:
 *   id, duration (s), draw(ctx, t)
 * (cues are optional and only used if rendering with --audio)
 * Beat sheets live in ../STORIES_PLAN.md; copy lives in content.json.
 */
(function () {
  const {
    W, H, clamp, lerp, prog, ease, vnoise, flicker, pflicker, neon, flare,
    A, canvas, blurred, drawImg, glint, setFont, emberText, emberTextLetters, label,
    LOCK, art, artTip, title, scene, slashWipe, register,
  } = window.HH;

  const EMBER_ORANGE = '#E8621C';

  // blade axis in art px (hand -> tip), used for stab/slide moves
  const BLADE = (() => { const a = (75 * Math.PI) / 180; return [Math.cos(a), Math.sin(a)]; })();

  const camera = (ctx, s, cx = W / 2, cy = H / 2, dx = 0, dy = 0) => {
    ctx.translate(cx + dx, cy + dy);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
  };

  // fit text size so the string is at most maxW wide
  function fit(ctx, str, size, maxW, family = 'Bowlby One', tracking = 0, weight = '') {
    ctx.save();
    setFont(ctx, family, size, weight);
    ctx.letterSpacing = `${tracking}px`;
    const w = ctx.measureText(str).width;
    ctx.restore();
    return w > maxW ? Math.floor((size * maxW) / w) : size;
  }

  // small tracked caps line in Figtree, auto-fitted
  function kicker(ctx, str, y, a, o = {}) {
    const tr = o.tracking ?? 10;
    const size = fit(ctx, str, o.size ?? 32, o.maxW ?? 940, 'Figtree', tr, '800');
    label(ctx, str, o.x ?? W / 2, y, size, { tracking: tr, color: o.color ?? EMBER_ORANGE, alpha: a, glow: o.glow ?? 18, align: o.align });
  }

  // burn-in: letters warm up like neon, left to right
  const burn = (t, t0, step = 0.07) => (i) => {
    const st = t0 + i * step;
    return { ember: neon(prog(t, st, st + 0.45)), fill: ease.out2(prog(t, st + 0.3, st + 0.7)) };
  };

  const titleLit = (t, a = 1) => () => ({ ember: a * (0.92 + 0.08 * flicker(t, 9)), fill: a });

  // the full lit poster lockup (used as an end frame)
  function lockup(ctx, t, o = {}) {
    const L = LOCK;
    art(ctx, L.art.x, L.art.y, L.art.s, {
      pumpkin: flicker(t, 1), h: flicker(t + 0.4, 3), knife: 0.96, sweep: o.sweep ?? -1,
    });
    title(ctx, L.title.x, L.title.y, L.title.s, titleLit(t));
    if (o.footerText) {
      label(ctx, o.footerText, W / 2, L.footer.y + 54, 50, { weight: '700', alpha: o.footerAlpha ?? 1 });
    } else {
      drawImg(ctx, A.img.footer, L.footer.x, L.footer.y, L.footer.s, o.footerAlpha ?? 1);
    }
  }

  // ======================================================= 01 · THE RETURN (12s)
  register({
    id: '01-the-return',
    duration: 12,
    cues: [
      { t: 0.5, type: 'glint', gain: 0.7 }, { t: 1.6, type: 'ignite' }, { t: 3.0, type: 'swell' },
      { t: 4.2, type: 'blade' }, { t: 6.7, type: 'glint' }, { t: 7.0, type: 'burn', dur: 2.0 },
      { t: 10.6, type: 'glint', gain: 0.8 },
    ],
    draw(ctx, t) {
      const L = LOCK;
      ctx.save();
      camera(ctx, lerp(1.0, 1.045, ease.inOut2(t / 12)), W / 2, 900);

      // candle catches, sputters, then burns steady
      const ign = prog(t, 1.6, 4.2);
      const sputter = lerp(0.35 + 0.65 * vnoise(t * 22), flicker(t, 1), ease.in2(ign));
      const pumpkin = ease.inOut2(ign) * sputter;
      const h = ease.inOut2(prog(t, 3.0, 4.8)) * flicker(t + 0.37, 3);

      // knife slides in along the blade axis (stab), then a light sweep runs down it
      const kIn = prog(t, 4.2, 5.8);
      const slide = (1 - ease.outExpo(kIn)) * 90;
      const knifeOffset = [-BLADE[0] * slide, -BLADE[1] * slide];
      const knifeAlpha = ease.out2(prog(t, 4.2, 5.2));
      const knife = ease.inOut2(prog(t, 4.2, 6.2)) * (0.85 + 0.15 * flicker(t, 1));
      const sweep = lerp(-0.2, 1.05, prog(t, 5.7, 6.75));

      art(ctx, L.art.x, L.art.y, L.art.s, { pumpkin, h, knife, knifeAlpha, knifeOffset, sweep: t > 5.7 && t < 6.8 ? sweep : -1 });

      // glint: lone star in the dark -> pinpoint -> flare when the sweep lands -> final flare
      const [gx, gy] = artTip(L.art.x, L.art.y, L.art.s, knifeOffset);
      const intro = flare(t, 0.5, 1.5, 0.28) * (1 - ease.inOut2(prog(t, 4.0, 5.0)));
      const g = Math.max(intro, flare(t, 6.7, 1.3, 0.22) * (t < 10.6 ? 1 : 0), flare(t, 10.6, 1.4, 0.3));
      glint(ctx, gx, gy, 300, g);

      // title burns in letter by letter, ember outline first then bone fill
      title(ctx, L.title.x, L.title.y, L.title.s, (li, i) => {
        const st = 7.0 + (li === 0 ? 0 : 0.42) + i * 0.085;
        return {
          ember: neon(prog(t, st, st + 0.5)) * (0.9 + 0.1 * flicker(t, 9)),
          fill: ease.out2(prog(t, st + 0.35, st + 0.85)),
        };
      });

      const f = ease.out2(prog(t, 9.4, 10.4));
      drawImg(ctx, A.img.footer, L.footer.x, L.footer.y + 16 * (1 - f), L.footer.s, f);
      ctx.restore();
    },
  });

  // ======================================================= 02 · MORE ROOM (12s)
  // "Last year we sold out Halloween at Paros. This year we needed more room.
  //  So we're taking over Henderson Brewing Co."
  function moreA(ctx, t) {
    const c = A.content.moreRoom;
    kicker(ctx, c.k1, 800, ease.out2(prog(t, 0.3, 0.9)));
    const sz = fit(ctx, c.big1, 150, 940);
    emberTextLetters(ctx, c.big1, W / 2, 975, sz, burn(t, 0.6, 0.06));
    kicker(ctx, c.sub1, 1070, ease.out2(prog(t, 1.7, 2.3)), { color: '#FFF1E0', glow: 0, size: 36, tracking: 12 });
  }

  function moreB(ctx, t) {
    const c = A.content.moreRoom;
    kicker(ctx, c.k2, 760, ease.out2(prog(t, 3.5, 4.1)));
    const sz = Math.min(fit(ctx, c.big2a, 170, 940), fit(ctx, c.big2b, 170, 940));
    emberTextLetters(ctx, c.big2a, W / 2, 940, sz, burn(t, 3.8, 0.06));
    emberTextLetters(ctx, c.big2b, W / 2, 940 + sz * 1.05, sz, burn(t, 4.4, 0.06));
  }

  function moreC(ctx, t) {
    const c = A.content.moreRoom;
    kicker(ctx, c.k3, 600, ease.out2(prog(t, 7.6, 8.2)));
    // "HENDERSON" in the poster's own lettering (title line 2)
    const s = 1.12;
    const tx = W / 2 - 433 * s, ty = 650 - 113 * s;
    ctx.save();
    ctx.beginPath();
    ctx.rect(tx + 40 * s, ty + 112 * s, 780 * s, 120 * s);  // line 2 only
    ctx.clip();
    title(ctx, tx, ty, s, (li, i) => {
      if (li === 0) return { ember: 0, fill: 0 };
      const st = 7.9 + i * 0.07;
      return { ember: neon(prog(t, st, st + 0.45)) * (0.92 + 0.08 * flicker(t, 9)), fill: ease.out2(prog(t, st + 0.3, st + 0.7)) };
    });
    ctx.restore();
    const sz = fit(ctx, c.venue2, 120, 760);
    emberTextLetters(ctx, c.venue2, W / 2, 900, sz, burn(t, 8.6, 0.06));
    // the key art lights up underneath
    const AX = 314, AY = 970, AS = 0.78;
    const ign = ease.inOut2(prog(t, 8.8, 10.2));
    art(ctx, AX, AY, AS, { pumpkin: ign * flicker(t, 1), h: ign * flicker(t + 0.4, 3), knife: ign * 0.95, knifeAlpha: ign });
    const [gx, gy] = artTip(AX, AY, AS);
    glint(ctx, gx, gy, 240, flare(t, 10.6, 1.2, 0.25));
  }

  register({
    id: '02-more-room',
    duration: 12,
    draw(ctx, t) {
      if (t < 3.0) return moreA(ctx, t);
      if (t < 4.0) {
        const a = scene(0, (c) => moreA(c, t));
        const b = scene(1, (c) => moreB(c, t));
        return slashWipe(ctx, a, b, prog(t, 3.0, 4.0), { angle: 62 });
      }
      if (t < 7.0) return moreB(ctx, t);
      // "more room": the old frame falls away into the distance as the new one opens
      const p = ease.inOut3(prog(t, 7.0, 8.2));
      if (p >= 1) return moreC(ctx, t);
      const b = scene(0, (c) => moreB(c, t), true);
      const cc = scene(1, (c) => moreC(c, t), true);
      ctx.save();
      ctx.globalAlpha = ease.out2(p);
      camera(ctx, lerp(1.35, 1, p), W / 2, 960);
      ctx.drawImage(cc, 0, 0);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 1 - ease.in2(p);
      camera(ctx, lerp(1, 0.22, p), W / 2, 960);
      ctx.drawImage(b, 0, 0);
      ctx.restore();
    },
  });

  // ======================================================= 03 · THE DETAILS (15s)
  const DET = { x: 330, y: 190, s: 1.5 };
  const CREDIT_T0 = 1.4, CREDIT_STEP = 1.85, DET_WIPE = 10.8;

  function detailsArt(ctx, t) {
    ctx.save();
    camera(ctx, lerp(1.0, 1.07, ease.inOut2(t / 11)), 900, 700);
    art(ctx, DET.x, DET.y, DET.s, {
      pumpkin: ease.inOut2(prog(t, 0, 1.4)) * flicker(t, 1),
      h: ease.inOut2(prog(t, 0.4, 1.8)) * flicker(t + 0.37, 3),
      knife: 0.9 * ease.inOut2(prog(t, 0.2, 1.6)),
    });
    ctx.restore();
    // darkness pools on the left and bottom so the credits sit on black
    const g = ctx.createLinearGradient(0, 0, 640, 0);
    g.addColorStop(0, 'rgba(5,3,3,0.9)');
    g.addColorStop(1, 'rgba(5,3,3,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 640, H);
    const g2 = ctx.createLinearGradient(0, 1150, 0, 1500);
    g2.addColorStop(0, 'rgba(5,3,3,0)');
    g2.addColorStop(1, 'rgba(5,3,3,0.92)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 1150, W, H - 1150);
  }

  function detailsCredits(ctx, t) {
    A.content.details.forEach((it, i) => {
      const t0 = CREDIT_T0 + i * CREDIT_STEP;
      const inP = ease.out2(prog(t, t0, t0 + 0.55));
      const outP = ease.in2(prog(t, t0 + CREDIT_STEP - 0.4, t0 + CREDIT_STEP));
      const a = inP * (1 - outP);
      if (a <= 0.001) return;
      const rise = 14 * (1 - inP);
      kicker(ctx, it.kicker, 1372 + rise, a, { x: 84, align: 'left', size: 30, tracking: 9 });
      emberText(ctx, it.value, 84, 1470 + rise, fit(ctx, it.value, 84, 912), { align: 'left', alpha: a, glow: 0.9 });
    });
  }

  function detailsSummary(ctx, t, t0) {
    title(ctx, 173, 280, 0.85, titleLit(t));
    const gl = ctx.createRadialGradient(W / 2, 1750, 50, W / 2, 1750, 900);
    gl.addColorStop(0, `rgba(232,98,28,${0.26 * flicker(t, 2)})`);
    gl.addColorStop(1, 'rgba(232,98,28,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, W, H);
    const rows = A.content.details;
    rows.forEach((it, i) => {
      const a = ease.out2(prog(t, t0 + 0.35 + i * 0.16, t0 + 0.95 + i * 0.16));
      const y = 600 + i * 168;
      kicker(ctx, it.kicker, y, a, { size: 26, tracking: 10, glow: 16 });
      emberText(ctx, it.value, W / 2, y + 76, fit(ctx, it.value, 64, 900), { alpha: a });
    });
    kicker(ctx, A.content.detailsFooter, 1520, ease.out2(prog(t, t0 + 1.4, t0 + 2.0)), { color: '#FFF1E0', glow: 0, size: 26, tracking: 5 });
  }

  register({
    id: '03-the-details',
    duration: 15,
    draw(ctx, t) {
      if (t < DET_WIPE) {
        detailsArt(ctx, t);
        detailsCredits(ctx, t);
        return;
      }
      const a = scene(0, (c) => { detailsArt(c, t); detailsCredits(c, t); });
      const b = scene(1, (c) => { camera(c, lerp(1.0, 1.03, prog(t, DET_WIPE, 15)), W / 2, 960); detailsSummary(c, t, DET_WIPE); });
      slashWipe(ctx, a, b, prog(t, DET_WIPE, DET_WIPE + 1.0), { angle: 62 });
    },
  });

  // ======================================================= 04 · THE NIGHT (10s)
  // Horror meets rave: lasers fire out of the carved H on a 124 BPM grid.
  const BEAT = 60 / 124;
  const NX = 293, NY = 1010, NS = 0.85;             // key art placement
  const LASER_O = [NX + 385 * NS, NY + 330 * NS];    // origin: the carved H

  function lasers(ctx, t, amt) {
    if (amt <= 0.001) return;
    const beat = t / BEAT, bar = Math.floor(beat / 4), inBeat = (beat % 1) * BEAT;
    const kick = 0.5 + 0.5 * Math.exp(-inBeat * 7);
    const n = 7;
    const [ox, oy] = LASER_O;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const k = i - (n - 1) / 2;
      let ang;
      if (bar % 2 === 0) ang = -90 + k * 13 + 26 * Math.sin((2 * Math.PI * beat) / 8);          // fan sweep
      else ang = -90 + (i % 2 ? 1 : -1) * (6 + 34 * Math.abs(Math.sin((Math.PI * beat) / 2))) + k * 4; // scissor
      // on the off-beats half the beams drop out
      const on = (Math.floor(beat * 2) % 2 === 1 && i % 2 === 1) ? 0.25 : 1;
      const I = amt * kick * on;
      const a = (ang * Math.PI) / 180;
      const ex = ox + Math.cos(a) * 2600, ey = oy + Math.sin(a) * 2600;
      const red = i % 3 !== 1;
      const col = red ? [255, 46, 26] : [255, 168, 60];
      const grad = (alpha) => {
        const g = ctx.createLinearGradient(ox, oy, ex, ey);
        g.addColorStop(0, `rgba(${col},${alpha})`);
        g.addColorStop(0.5, `rgba(${col},${alpha * 0.45})`);
        g.addColorStop(1, `rgba(${col},0)`);
        return g;
      };
      [[40, 0.09], [13, 0.26], [4, 0.95]].forEach(([w, al]) => {
        ctx.strokeStyle = grad(al * I);
        ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();
      });
    }
    // haze catching the light
    const hz = ctx.createRadialGradient(ox, oy - 500, 50, ox, oy - 500, 1100);
    hz.addColorStop(0, `rgba(255,70,30,${0.12 * amt * kick})`);
    hz.addColorStop(1, 'rgba(255,70,30,0)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  register({
    id: '04-the-night',
    duration: 10,
    draw(ctx, t) {
      const c = A.content.night;
      const on = ease.out2(prog(t, 0.8, 1.2));
      const beat = t / BEAT, inBeat = (beat % 1) * BEAT;
      const kick = t > 0.8 ? Math.exp(-inBeat * 7) : 0;

      // the pumpkin sits at the bottom, pulsing with the kick; beams fire out of the H
      const ign = ease.inOut2(prog(t, 0, 0.9));
      art(ctx, NX, NY, NS, { pumpkin: ign * (0.85 + 0.15 * kick), h: ign * (0.8 + 0.35 * kick), knife: ign * 0.9, knifeAlpha: ign });
      lasers(ctx, t, on);
      glint(ctx, LASER_O[0], LASER_O[1], 200, on * (0.35 + 0.65 * kick));

      // keep the type legible over the beams
      const band = ctx.createLinearGradient(0, 220, 0, 960);
      band.addColorStop(0, 'rgba(5,3,3,0.55)');
      band.addColorStop(0.75, 'rgba(5,3,3,0.45)');
      band.addColorStop(1, 'rgba(5,3,3,0)');
      ctx.fillStyle = band;
      ctx.fillRect(0, 220, W, 740);

      kicker(ctx, c.kicker, 360, ease.out2(prog(t, 0.9, 1.5)), { size: 34 });
      const hs = fit(ctx, c.head, 130, 960);
      emberTextLetters(ctx, c.head, W / 2, 510, hs, burn(t, 1.1, 0.05));

      // genres cut on the beat, two beats each
      const g0 = 2.9;
      const gi = Math.floor((t - g0) / (2 * BEAT));
      if (t >= g0 && gi < c.genres.length) {
        const local = t - g0 - gi * 2 * BEAT;
        const s = lerp(1.07, 1, ease.outSoft(clamp(local / 0.18)));
        const str = c.genres[gi];
        ctx.save();
        camera(ctx, s, W / 2, 660);
        emberText(ctx, str, W / 2, 700, fit(ctx, str, 104, 940), {});
        ctx.restore();
      }
      const listT = g0 + c.genres.length * 2 * BEAT;
      c.lines.forEach((ln, i) => {
        kicker(ctx, ln, 640 + i * 62, ease.out2(prog(t, listT + i * 0.25, listT + 0.5 + i * 0.25)),
          { color: i === 0 ? '#FFF1E0' : EMBER_ORANGE, size: 34, tracking: 8, glow: i === 0 ? 0 : 18 });
      });
    },
  });

  // ======================================================= 05 · DRESS TO KILL (10s)
  const KN = { x: 169, y: 170, s: 1.9 };
  function knifeHero(ctx, t) {
    const drop = ease.outExpo(prog(t, 0.3, 0.95));
    const d = (1 - drop) * 1500;
    const jolt = t > 0.9 ? Math.sin((t - 0.9) * 60) * 10 * Math.exp(-(t - 0.9) * 10) : 0;
    ctx.save();
    ctx.translate(0, jolt);
    const gl = ctx.createRadialGradient(560, 900, 60, 560, 900, 760);
    gl.addColorStop(0, `rgba(224,70,30,${0.28 * drop * flicker(t, 4)})`);
    gl.addColorStop(1, 'rgba(224,70,30,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, W, H);
    drawImg(ctx, A.img.knife, KN.x - BLADE[0] * d, KN.y - BLADE[1] * d, KN.s, 1);
    const [gx, gy] = artTip(KN.x, KN.y, KN.s, [-BLADE[0] * d / KN.s, -BLADE[1] * d / KN.s]);
    glint(ctx, gx, gy, 340, flare(t, 0.9, 1.1, 0.3));
    ctx.restore();
  }

  const DRESS_Y = 880;
  const dressSize = (ctx) => {
    const c = A.content.dress;
    return Math.min(fit(ctx, c.line1, 250, 920), fit(ctx, c.line2, 250, 920));
  };

  function dressType(ctx, t, t0) {
    const c = A.content.dress;
    const s = lerp(1.06, 1.0, ease.outSoft(prog(t, t0, t0 + 0.9)));
    const hb = blurred('hdress', A.img.h_glow, 40);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45 * flicker(t, 6);
    const hs = 3.2;
    ctx.drawImage(hb.c, 540 - 385 * hs - hb.pad * hs, 940 - 355 * hs - hb.pad * hs, hb.c.width * hs, hb.c.height * hs);
    ctx.restore();
    ctx.save();
    camera(ctx, s, W / 2, 940);
    const sz = dressSize(ctx);
    emberText(ctx, c.line1, W / 2, DRESS_Y, sz, { glow: 0.9 + 0.1 * flicker(t, 8) });
    emberText(ctx, c.line2, W / 2, DRESS_Y + sz * 1.02, sz, { glow: 0.9 + 0.1 * flicker(t, 8) });
    ctx.restore();
    kicker(ctx, c.sub, 1255, ease.out2(prog(t, 4.2, 5.0)), { color: '#FFF1E0', size: 42, tracking: 12, glow: 20 });
    kicker(ctx, c.contest, 1318, ease.out2(prog(t, 5.0, 5.8)), { size: 34, tracking: 8 });
    const ta = ease.out2(prog(t, 6.4, 7.2));
    title(ctx, 302, 1390, 0.55, () => ({ ember: ta * 0.9, fill: ta }));
  }

  register({
    id: '05-dress-to-kill',
    duration: 10,
    cues: [{ t: 0.3, type: 'whoosh' }, { t: 0.9, type: 'hit' }, { t: 1.9, type: 'slash' }, { t: 8.6, type: 'glint', gain: 0.6 }],
    draw(ctx, t) {
      const WIPE = 1.9;
      if (t < WIPE) return knifeHero(ctx, t);
      if (t < WIPE + 1.0) {
        const a = scene(0, (c) => knifeHero(c, t));
        const b = scene(1, (c) => dressType(c, t, WIPE + 0.2));
        return slashWipe(ctx, a, b, prog(t, WIPE, WIPE + 1.0), { angle: 62 });
      }
      dressType(ctx, t, WIPE + 0.2);
      // glint on the full stop
      const c = A.content.dress;
      const sz = dressSize(ctx);
      ctx.save();
      setFont(ctx, 'Bowlby One', sz);
      const w = ctx.measureText(c.line2).width;
      ctx.restore();
      glint(ctx, W / 2 + w / 2 - sz * 0.16, DRESS_Y + sz * 1.02 - sz * 0.1, 260, flare(t, 8.6, 1.2, 0.0));
    },
  });

  // ======================================================= carved numerals (06, 07)
  const numCache = {};
  function numeral(key, str, size, base) {
    if (numCache[key]) return numCache[key];
    const c = canvas(W, H);
    const x = c.getContext('2d');
    x.font = `${size}px "Lobster"`;
    x.textAlign = 'center';
    x.textBaseline = 'alphabetic';
    const cy = base - size * 0.36;
    const tw = x.measureText(str).width;
    const g = x.createRadialGradient(540, cy - size * 0.05, 40, 540, cy, Math.max(size * 0.48, tw * 0.62));
    g.addColorStop(0, '#FFF6D8');
    g.addColorStop(0.45, '#FFD27A');
    g.addColorStop(0.8, '#F28A2C');
    g.addColorStop(1, '#C8461A');
    x.fillStyle = g;
    x.fillText(str, 540, base);
    // carved edge: darken the inner rim
    x.globalCompositeOperation = 'source-atop';
    x.filter = `blur(${Math.round(size / 70)}px)`;
    x.strokeStyle = 'rgba(150,40,8,0.85)';
    x.lineWidth = size / 26;
    x.strokeText(str, 540, base);
    x.filter = 'none';
    // pumpkin-flesh texture borrowed from the H carving
    x.globalAlpha = 0.35;
    const hg = A.img.h_glow;
    x.drawImage(hg, 0, 0, hg.width, hg.height, -300, cy - 1130, hg.width * 3.2, hg.height * 3.2);
    numCache[key] = c;
    return c;
  }

  const revealBuf = canvas(W, H);
  /* Carve a numeral with a travelling glint, then light it like a candle.
   * o: {key, str, size, base, extras(ctx, t)} */
  function carved(ctx, t, o) {
    const num = numeral(o.key, o.str, o.size, o.base);
    const cy = o.base - o.size * 0.36;
    const ign = ease.inOut2(prog(t, 1.45, 2.4));
    const fl = flicker(t, o.size);
    const bright = lerp(0.75, 1, ign) * lerp(1, fl, ign);

    const cg = ctx.createRadialGradient(540, cy, 30, 540, cy, 760);
    cg.addColorStop(0, `rgba(232,98,28,${0.3 * ign * fl})`);
    cg.addColorStop(0.5, `rgba(160,40,12,${0.14 * ign * fl})`);
    cg.addColorStop(1, 'rgba(120,20,8,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, W, H);

    // reveal: a diagonal front sweeps across the numeral
    const rev = ease.inOut2(prog(t, 0.3, 1.5));
    const ang = (70 * Math.PI) / 180, ux = Math.cos(ang), uy = Math.sin(ang);
    const span = Math.max(820, o.size * 1.6);
    const fx = 540 + ux * lerp(-span / 2, span / 2, rev), fy = cy + uy * lerp(-span / 2, span / 2, rev);
    const r = revealBuf.getContext('2d');
    r.globalCompositeOperation = 'source-over';
    r.globalAlpha = 1;
    r.clearRect(0, 0, W, H);
    r.drawImage(num, 0, 0);
    if (ign < 1) {
      r.globalCompositeOperation = 'source-atop';
      r.fillStyle = `rgba(150,26,10,${0.8 * (1 - ign)})`;
      r.fillRect(0, 0, W, H);
    }
    if (rev < 1) {
      r.globalCompositeOperation = 'destination-in';
      const mg = r.createLinearGradient(fx - ux * 30, fy - uy * 30, fx + ux * 30, fy + uy * 30);
      mg.addColorStop(0, 'rgba(0,0,0,1)');
      mg.addColorStop(1, 'rgba(0,0,0,0)');
      r.fillStyle = mg;
      r.fillRect(0, 0, W, H);
    }
    ctx.save();
    ctx.globalAlpha = bright;
    ctx.drawImage(revealBuf, 0, 0);
    ctx.restore();
    const nb1 = blurred(`${o.key}a`, num, 14), nb2 = blurred(`${o.key}b`, num, 48);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55 * ign * fl;
    ctx.drawImage(nb1.c, -nb1.pad, -nb1.pad);
    ctx.globalAlpha = 0.5 * ign * fl;
    ctx.drawImage(nb2.c, -nb2.pad, -nb2.pad);
    ctx.restore();
    if (t > 0.25 && t < 1.7) glint(ctx, fx + uy * 60, fy - ux * 60, 230, (1 - ease.in2(prog(t, 1.4, 1.7))) * 0.95);
  }

  // ======================================================= 06 · FIRST 100 (7s)
  register({
    id: '06-first-100',
    duration: 7,
    draw(ctx, t) {
      const c = A.content.first100;
      ctx.save();
      camera(ctx, lerp(1.04, 1.0, ease.out2(t / 7)), W / 2, 960);
      const size = fit(ctx, c.num, 700, 760, 'Lobster');
      carved(ctx, t, { key: `n${c.num}`, str: c.num, size, base: 1150 });
      title(ctx, 272, 280, 0.62, titleLit(t, ease.out2(prog(t, 3.4, 4.2))));
      kicker(ctx, c.kicker, 600, ease.out2(prog(t, 0.2, 0.8)), { size: 40, tracking: 14 });
      const ls = fit(ctx, c.line, 120, 900);
      emberTextLetters(ctx, c.line, W / 2, 1330, ls, burn(t, 2.2, 0.07));
      kicker(ctx, c.sub, 1415, ease.out2(prog(t, 2.9, 3.6)), { color: '#FFF1E0', size: 40, tracking: 8, glow: 16 });
      glint(ctx, 740, 458, 260, flare(t, 5.8, 1.0, 0.1));
      ctx.restore();
    },
  });

  // ======================================================= 07 · COUNTDOWN (6s each)
  function countdownCard(n) {
    const plural = n === 1 ? 'NIGHT LEFT' : 'NIGHTS LEFT';
    return {
      id: `07-countdown-${n}`,
      duration: 6,
      draw(ctx, t) {
        ctx.save();
        camera(ctx, lerp(1.04, 1.0, ease.out2(t / 6)), W / 2, 960);
        carved(ctx, t, { key: `c${n}`, str: String(n), size: 880, base: 1250 });
        const size = fit(ctx, plural, 96, 900);
        emberTextLetters(ctx, plural, W / 2, 1452, size, burn(t, 2.3, 0.06));
        title(ctx, 272, 292, 0.62, titleLit(t, ease.out2(prog(t, 3.2, 4.0))));
        kicker(ctx, A.content.countdownSub, 1535, ease.out2(prog(t, 3.5, 4.3)) * 0.95, { color: '#FFF1E0', glow: 0, size: 30, tracking: 8 });
        glint(ctx, 740, 470, 260, flare(t, 5.1, 1.0, 0.1));
        ctx.restore();
      },
    };
  }

  // ======================================================= 08 · TICKETS (8s loop)
  const LOOP = 8;
  register({
    id: '08-tickets',
    duration: LOOP,
    loop: true,
    draw(ctx, t) {
      const c = A.content.tickets;
      const pf = (s) => pflicker(t, LOOP, s);
      title(ctx, 237, 280, 0.7, () => ({ ember: 0.9 + 0.1 * (pf(9) - 0.88) * 8, fill: 1 }));
      const AX = 312, AY = 480, AS = 0.78;
      const sweepP = (t - 5.2) / 1.0;
      art(ctx, AX, AY, AS, { pumpkin: pf(1), h: pf(3), knife: 0.95, sweep: sweepP > -0.2 && sweepP < 1.05 ? sweepP : -1 });
      const [gx, gy] = artTip(AX, AY, AS);
      glint(ctx, gx, gy, 200, flare(t, 6.2, 1.0, 0.0));

      const size = fit(ctx, c.headline, 170, 900);
      emberText(ctx, c.headline, W / 2, 1255, size, { glow: 0.9 + 0.1 * (pf(8) - 0.88) * 8, tracking: 4 });
      kicker(ctx, c.sub, 1318, 1, { size: 32, tracking: 8 });

      // link-sticker slot with a glint running around its edge (2 laps per loop)
      const bx = 240, by = 1365, bw = 600, bh = 150, r = 30;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,241,224,0.42)';
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 12]);
      ctx.lineDashOffset = -t * 13;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, r);
      ctx.stroke();
      ctx.restore();
      const per = 2 * (bw + bh);
      const d = ((t / (LOOP / 2)) % 1) * per;
      let px, py;
      if (d < bw) { px = bx + d; py = by; }
      else if (d < bw + bh) { px = bx + bw; py = by + (d - bw); }
      else if (d < 2 * bw + bh) { px = bx + bw - (d - bw - bh); py = by + bh; }
      else { px = bx; py = by + bh - (d - 2 * bw - bh); }
      glint(ctx, px, py, 90, 0.75);
    },
  });

  // ======================================================= 09 · TONIGHT (7s)
  function tonightA(ctx, t) {
    const c = A.content.tonight;
    const beat = (t0) => Math.exp(-Math.max(0, t - t0) * 7) * (t >= t0 ? 1 : 0);
    const pulse = 0.12 * (beat(0.4) + beat(0.72) + beat(1.2) + beat(1.52));
    const lit = ease.inOut2(prog(t, 0.1, 1.9)) * flicker(t, 5) + pulse;
    // candlelight creeping in from the frame edges
    [[W / 2, H + 120, 1100], [-150, 1300, 800], [W + 150, 700, 800]].forEach(([x, y, r], i) => {
      const g = ctx.createRadialGradient(x, y, 20, x, y, r);
      g.addColorStop(0, `rgba(226,74,22,${0.55 * lit * (i ? 0.6 : 1)})`);
      g.addColorStop(1, 'rgba(226,74,22,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    });
    if (t >= 2.0) {
      const p = prog(t, 2.0, 2.35);
      const s = 1 + 0.14 * (1 - ease.outExpo(p));
      const shake = Math.sin(t * 73) * 16 * Math.exp(-(t - 2.0) * 9);
      ctx.save();
      camera(ctx, s, W / 2, 980, shake, shake * 0.4);
      emberText(ctx, c.headline, W / 2, 1040, fit(ctx, c.headline, 230, 960), { glow: 0.92 + 0.08 * flicker(t, 8) });
      ctx.restore();
      kicker(ctx, c.sub, 1165, ease.out2(prog(t, 2.6, 3.2)), { color: '#FFF1E0', size: 44, tracking: 16, glow: 18 });
      kicker(ctx, c.place, 1230, ease.out2(prog(t, 2.9, 3.5)), { size: 32, tracking: 10 });
      const flash = 0.3 * Math.exp(-(t - 2.0) * 20);
      ctx.fillStyle = `rgba(255,200,160,${flash})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  register({
    id: '09-tonight',
    duration: 7,
    draw(ctx, t) {
      const WIPE = 4.4;
      const lock = (c) => lockup(c, t, { footerText: A.content.tonight.footer });
      if (t < WIPE) return tonightA(ctx, t);
      if (t < WIPE + 1.0) {
        const a = scene(0, (c) => tonightA(c, t));
        const b = scene(1, lock);
        return slashWipe(ctx, a, b, prog(t, WIPE, WIPE + 1.0), { angle: 62 });
      }
      lock(ctx);
      const [gx, gy] = artTip(LOCK.art.x, LOCK.art.y, LOCK.art.s);
      glint(ctx, gx, gy, 300, Math.max(0.25, flare(t, 6.0, 1.0, 0.25)));
    },
  });

  // countdowns are registered after content.json loads; keep ids in story order
  window.HH_registerCountdowns = () => {
    const all = Object.assign({}, window.HH.CARDS);
    Object.keys(window.HH.CARDS).forEach((k) => delete window.HH.CARDS[k]);
    const cds = A.content.countdown.map(countdownCard);
    Object.keys(all).sort().forEach((k) => {
      if (k > '07' && cds.length) while (cds.length) register(cds.shift());
      register(all[k]);
    });
    cds.forEach(register);
  };
})();
