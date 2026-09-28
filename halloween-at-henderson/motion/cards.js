/* The six Instagram Story cards. Each card:
 *   id, duration (s), cues [{t, type, ...}] (drive the sound design), draw(ctx, t)
 * Beat sheets live in ../STORIES_PLAN.md.
 */
(function () {
  const {
    W, H, COLOR, clamp, lerp, prog, ease, vnoise, flicker, pflicker, neon, flare,
    A, canvas, blurred, drawImg, bloom, glint, setFont, emberText, emberTextLetters, label,
    LOCK, art, artTip, title, titleAll, scene, slashWipe, register,
  } = window.HH;

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

  // the full lit poster lockup (used as an end frame)
  function lockup(ctx, t, o = {}) {
    const L = LOCK;
    art(ctx, L.art.x, L.art.y, L.art.s, {
      pumpkin: flicker(t, 1), h: flicker(t + 0.4, 3), knife: 0.96, sweep: o.sweep ?? -1,
    });
    title(ctx, L.title.x, L.title.y, L.title.s, () => ({ ember: 0.92 + 0.08 * flicker(t, 9), fill: 1 }));
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
      { t: 0.5, type: 'glint', gain: 0.7 },
      { t: 1.6, type: 'ignite' },
      { t: 3.0, type: 'swell' },
      { t: 4.2, type: 'blade' },
      { t: 6.7, type: 'glint' },
      { t: 7.0, type: 'burn', dur: 2.0 },
      { t: 9.4, type: 'pad' },
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

  // ======================================================= 02 · THE DETAILS (15s)
  const DET = { x: 330, y: 190, s: 1.5 };
  const CREDIT_T0 = 1.6, CREDIT_STEP = 2.2;

  function detailsArt(ctx, t) {
    ctx.save();
    const push = lerp(1.0, 1.07, ease.inOut2(t / 11));
    camera(ctx, push, 900, 700);
    art(ctx, DET.x, DET.y, DET.s, {
      pumpkin: ease.inOut2(prog(t, 0, 1.4)) * flicker(t, 1),
      h: ease.inOut2(prog(t, 0.4, 1.8)) * flicker(t + 0.37, 3),
      knife: 0.9 * ease.inOut2(prog(t, 0.2, 1.6)),
    });
    ctx.restore();
    // darkness pools on the left so the credits sit on black
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
    const items = A.content.details;
    items.forEach((it, i) => {
      const t0 = CREDIT_T0 + i * CREDIT_STEP;
      const inP = ease.out2(prog(t, t0, t0 + 0.6));
      const outP = ease.in2(prog(t, t0 + CREDIT_STEP - 0.45, t0 + CREDIT_STEP));
      const a = inP * (1 - outP);
      if (a <= 0.001) return;
      const rise = 14 * (1 - inP);
      label(ctx, it.kicker, 84, 1372 + rise, 30, { align: 'left', tracking: 9, color: '#E8621C', alpha: a, glow: 18 });
      const size = fit(ctx, it.value, 84, 912);
      emberText(ctx, it.value, 84, 1470 + rise, size, { align: 'left', alpha: a, glow: 0.9 });
    });
  }

  function detailsSummary(ctx, t, t0) {
    title(ctx, 173, 292, 0.85, () => ({ ember: 0.92 + 0.08 * flicker(t, 9), fill: 1 }));
    // warm pumpkin light rising from below
    const gl = ctx.createRadialGradient(W / 2, 1750, 50, W / 2, 1750, 900);
    gl.addColorStop(0, `rgba(232,98,28,${0.26 * flicker(t, 2)})`);
    gl.addColorStop(1, 'rgba(232,98,28,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, W, H);
    A.content.details.forEach((it, i) => {
      const a = ease.out2(prog(t, t0 + 0.35 + i * 0.18, t0 + 0.95 + i * 0.18));
      const y = 700 + i * 200;
      label(ctx, it.kicker, W / 2, y, 28, { tracking: 10, color: '#E8621C', alpha: a, glow: 16 });
      const size = fit(ctx, it.value, 70, 900);
      emberText(ctx, it.value, W / 2, y + 84, size, { alpha: a });
    });
  }

  register({
    id: '02-the-details',
    duration: 15,
    cues: [
      { t: 0.0, type: 'ignite' },
      ...[0, 1, 2, 3].map((i) => ({ t: CREDIT_T0 + i * CREDIT_STEP, type: 'credit', i })),
      { t: 10.6, type: 'slash' },
      { t: 13.6, type: 'glint', gain: 0.6 },
    ],
    draw(ctx, t) {
      const WIPE = 10.6;
      if (t < WIPE) {
        detailsArt(ctx, t);
        detailsCredits(ctx, t);
        return;
      }
      const a = scene(0, (c) => { detailsArt(c, t); detailsCredits(c, t); });
      const b = scene(1, (c) => { camera(c, lerp(1.0, 1.03, prog(t, WIPE, 15)), W / 2, 960); detailsSummary(c, t, WIPE); });
      slashWipe(ctx, a, b, prog(t, WIPE, WIPE + 1.0), { angle: 62 });
      glint(ctx, 540 + 330, 700 + 3 * 200 + 40, 200, flare(t, 13.6, 1.3, 0.0));
    },
  });

  // ======================================================= 03 · COUNTDOWN (6s each)
  const numCache = {};
  function numeral(n) {
    if (numCache[n]) return numCache[n];
    const c = canvas(W, H);
    const x = c.getContext('2d');
    const str = String(n);
    x.font = '880px "Lobster"';
    x.textAlign = 'center';
    x.textBaseline = 'alphabetic';
    const base = 1250;
    // candle-lit interior: hot centre, orange rind at the edges
    const g = x.createRadialGradient(540, 900, 40, 540, 930, 420);
    g.addColorStop(0, '#FFF6D8');
    g.addColorStop(0.45, '#FFD27A');
    g.addColorStop(0.8, '#F28A2C');
    g.addColorStop(1, '#C8461A');
    x.fillStyle = g;
    x.fillText(str, 540, base);
    // carved edge: darken the inner rim
    x.globalCompositeOperation = 'source-atop';
    x.filter = 'blur(12px)';
    x.strokeStyle = 'rgba(150,40,8,0.85)';
    x.lineWidth = 34;
    x.strokeText(str, 540, base);
    x.filter = 'none';
    // pumpkin-flesh texture from the H carving
    x.globalAlpha = 0.35;
    x.globalCompositeOperation = 'source-atop';
    const hg = A.img.h_glow;
    x.drawImage(hg, 0, 0, hg.width, hg.height, -300, -200, hg.width * 3.2, hg.height * 3.2);
    numCache[n] = c;
    return c;
  }

  const revealBuf = canvas(W, H);
  function countdownCard(n) {
    const plural = n === 1 ? 'NIGHT LEFT' : 'NIGHTS LEFT';
    return {
      id: `03-countdown-${n}`,
      duration: 6,
      cues: [
        { t: 0.3, type: 'carve', dur: 1.2 },
        { t: 1.45, type: 'hit', gain: 0.8 },
        { t: 1.45, type: 'ignite' },
        { t: 2.3, type: 'burn', dur: 1.0 },
        { t: 5.1, type: 'glint', gain: 0.7 },
      ],
      draw(ctx, t) {
        ctx.save();
        camera(ctx, lerp(1.04, 1.0, ease.out2(t / 6)), W / 2, 960);
        const num = numeral(n);
        const ign = ease.inOut2(prog(t, 1.45, 2.4));
        const fl = flicker(t, n);
        const bright = lerp(0.75, 1, ign) * lerp(1, fl, ign);

        // candlelight pooling behind the numeral
        const cg = ctx.createRadialGradient(540, 930, 30, 540, 930, 760);
        cg.addColorStop(0, `rgba(232,98,28,${0.3 * ign * fl})`);
        cg.addColorStop(0.5, `rgba(160,40,12,${0.14 * ign * fl})`);
        cg.addColorStop(1, 'rgba(120,20,8,0)');
        ctx.fillStyle = cg;
        ctx.fillRect(0, 0, W, H);

        // carve reveal: a diagonal front sweeps down the numeral
        const rev = ease.inOut2(prog(t, 0.3, 1.5));
        const ang = (70 * Math.PI) / 180, ux = Math.cos(ang), uy = Math.sin(ang);
        const span = 820;
        const cx = 540, cy = 930;
        const fx = cx + ux * lerp(-span / 2, span / 2, rev), fy = cy + uy * lerp(-span / 2, span / 2, rev);
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
        const nb1 = blurred(`num${n}a`, num, 14), nb2 = blurred(`num${n}b`, num, 48);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.55 * ign * fl;
        ctx.drawImage(nb1.c, -nb1.pad, -nb1.pad);
        ctx.globalAlpha = 0.5 * ign * fl;
        ctx.drawImage(nb2.c, -nb2.pad, -nb2.pad);
        ctx.restore();
        // knife-tip glint riding the carving front
        if (t > 0.25 && t < 1.7) glint(ctx, fx + uy * 60, fy - ux * 60, 230, (1 - ease.in2(prog(t, 1.4, 1.7))) * 0.95);

        // NIGHTS LEFT burns in
        const size = fit(ctx, plural, 96, 900);
        emberTextLetters(ctx, plural, W / 2, 1452, size, (i) => {
          const st = 2.3 + i * 0.06;
          return { ember: neon(prog(t, st, st + 0.45)), fill: ease.out2(prog(t, st + 0.3, st + 0.7)) };
        });
        // title
        const ta = ease.out2(prog(t, 3.2, 4.0));
        title(ctx, 272, 292, 0.62, () => ({ ember: ta * 0.9, fill: ta }));
        label(ctx, 'OCTOBER 31', W / 2, 1540, 34, { tracking: 14, alpha: ease.out2(prog(t, 3.5, 4.3)) * 0.9 });
        glint(ctx, 740, 470, 260, flare(t, 5.1, 1.0, 0.1));
        ctx.restore();
      },
    };
  }
  window.HH_COUNTDOWN = countdownCard;

  // ======================================================= 04 · DRESS TO KILL (10s)
  const KN = { x: 169, y: 170, s: 1.9 };
  function knifeHero(ctx, t) {
    const drop = ease.outExpo(prog(t, 0.3, 0.95));
    const d = (1 - drop) * 1500;
    const jolt = t > 0.9 ? Math.sin((t - 0.9) * 60) * 10 * Math.exp(-(t - 0.9) * 10) : 0;
    ctx.save();
    ctx.translate(0, jolt);
    // ember back-light
    const gl = ctx.createRadialGradient(560, 900, 60, 560, 900, 760);
    gl.addColorStop(0, `rgba(224,70,30,${0.28 * drop * flicker(t, 4)})`);
    gl.addColorStop(1, 'rgba(224,70,30,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, W, H);
    const k = A.img.knife;
    drawImg(ctx, k, KN.x - BLADE[0] * d, KN.y - BLADE[1] * d, KN.s, 1);
    const [gx, gy] = artTip(KN.x, KN.y, KN.s, [-BLADE[0] * d / KN.s, -BLADE[1] * d / KN.s]);
    glint(ctx, gx, gy, 340, flare(t, 0.9, 1.1, 0.3));
    ctx.restore();
  }

  function dressType(ctx, t, t0) {
    const c = A.content.dress;
    const settle = ease.outSoft(prog(t, t0, t0 + 0.9));
    const s = lerp(1.06, 1.0, settle);
    // warm light from the carving
    const hb = blurred('hdress', A.img.h_glow, 40);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45 * flicker(t, 6);
    const hs = 3.2;
    ctx.drawImage(hb.c, 540 - 385 * hs - hb.pad * hs, 1000 - 355 * hs - hb.pad * hs, hb.c.width * hs, hb.c.height * hs);
    ctx.restore();
    ctx.save();
    camera(ctx, s, W / 2, 1000);
    const s1 = fit(ctx, c.line1, 250, 920), s2 = fit(ctx, c.line2, 250, 920);
    const sz = Math.min(s1, s2);
    emberText(ctx, c.line1, W / 2, 960, sz, { glow: 0.9 + 0.1 * flicker(t, 8) });
    emberText(ctx, c.line2, W / 2, 960 + sz * 1.02, sz, { glow: 0.9 + 0.1 * flicker(t, 8) });
    ctx.restore();
    label(ctx, c.sub, W / 2, 1330, 44, { tracking: 12, alpha: ease.out2(prog(t, 4.4, 5.2)), glow: 20 });
    const ta = ease.out2(prog(t, 6.0, 6.8));
    title(ctx, 302, 1418, 0.55, () => ({ ember: ta * 0.9, fill: ta }));
  }

  register({
    id: '04-dress-to-kill',
    duration: 10,
    cues: [
      { t: 0.3, type: 'whoosh' },
      { t: 0.9, type: 'hit' },
      { t: 0.9, type: 'glint', gain: 0.8 },
      { t: 1.9, type: 'slash' },
      { t: 4.4, type: 'credit', i: 2 },
      { t: 6.0, type: 'pad' },
      { t: 8.6, type: 'glint', gain: 0.6 },
    ],
    draw(ctx, t) {
      const WIPE = 1.9;
      if (t < WIPE) return knifeHero(ctx, t);
      if (t < WIPE + 1.0) {
        const a = scene(0, (c) => knifeHero(c, t));
        const b = scene(1, (c) => dressType(c, t, WIPE + 0.2));
        slashWipe(ctx, a, b, prog(t, WIPE, WIPE + 1.0), { angle: 62 });
        return;
      }
      dressType(ctx, t, WIPE + 0.2);
      // glint on the full stop
      ctx.save();
      const c = A.content.dress;
      const sz = Math.min(fit(ctx, c.line1, 250, 920), fit(ctx, c.line2, 250, 920));
      setFont(ctx, 'Bowlby One', sz);
      const w = ctx.measureText(c.line2).width;
      ctx.restore();
      glint(ctx, W / 2 + w / 2 - sz * 0.16, 960 + sz * 1.02 - sz * 0.1, 260, flare(t, 8.6, 1.2, 0.0));
    },
  });

  // ======================================================= 05 · RSVP (8s loop)
  const LOOP = 8;
  register({
    id: '05-rsvp',
    duration: LOOP,
    loop: true,
    cues: [{ t: 6.2, type: 'glint', gain: 0.6 }],
    draw(ctx, t) {
      const pf = (s) => pflicker(t, LOOP, s);
      title(ctx, 237, 285, 0.7, () => ({ ember: 0.9 + 0.1 * (pf(9) - 0.88) * 8, fill: 1 }));
      const AX = 312, AY = 500, AS = 0.78;
      const sweepP = (t - 5.2) / 1.0;
      art(ctx, AX, AY, AS, { pumpkin: pf(1), h: pf(3), knife: 0.95, sweep: sweepP > -0.2 && sweepP < 1.05 ? sweepP : -1 });
      const [gx, gy] = artTip(AX, AY, AS);
      glint(ctx, gx, gy, 200, flare(t, 6.2, 1.0, 0.0));

      const head = A.content.rsvp.headline;
      const size = fit(ctx, head, 190, 860);
      emberText(ctx, head, W / 2, 1300, size, { glow: 0.9 + 0.1 * (pf(8) - 0.88) * 8, tracking: 6 });

      // link-sticker slot with a glint running around its edge (2 laps per loop)
      const bx = 240, by = 1360, bw = 600, bh = 150, r = 30;
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

  // ======================================================= 06 · TONIGHT (7s)
  function tonightA(ctx, t) {
    const c = A.content.tonight;
    const beat = (t0) => Math.exp(-Math.max(0, t - t0) * 7) * (t >= t0 ? 1 : 0);
    const pulse = 0.12 * (beat(0.4) + beat(0.72) + beat(1.2) + beat(1.52));
    const lit = ease.inOut2(prog(t, 0.1, 1.9)) * flicker(t, 5) + pulse;
    // candlelight creeping in from the frame edges
    [[W / 2, H + 120, 1100], [-150, 1300, 800], [W + 150, 700, 800]].forEach(([x, y, r], i) => {
      const g = ctx.createRadialGradient(x, y, 20, x, y, r);
      g.addColorStop(0, `rgba(226,74,22,${0.55 * lit * (i ? 0.6 : 1)})`);
      g.addColorStop(1, 'rgba(232,98,28,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    });
    if (t >= 2.0) {
      const p = prog(t, 2.0, 2.35);
      const s = 1 + 0.14 * (1 - ease.outExpo(p));
      const shake = Math.sin(t * 73) * 16 * Math.exp(-(t - 2.0) * 9);
      ctx.save();
      camera(ctx, s, W / 2, 980, shake, shake * 0.4);
      const size = fit(ctx, c.headline, 230, 960);
      emberText(ctx, c.headline, W / 2, 1040, size, { glow: 0.92 + 0.08 * flicker(t, 8) });
      ctx.restore();
      label(ctx, c.sub, W / 2, 1170, 40, { tracking: 16, alpha: ease.out2(prog(t, 2.6, 3.3)), glow: 18 });
      const flash = 0.3 * Math.exp(-(t - 2.0) * 20);
      ctx.fillStyle = `rgba(255,200,160,${flash})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  register({
    id: '06-tonight',
    duration: 7,
    cues: [
      { t: 0.4, type: 'heart' },
      { t: 1.2, type: 'heart' },
      { t: 1.1, type: 'riser', dur: 0.9 },
      { t: 2.0, type: 'hit', gain: 1.0 },
      { t: 4.4, type: 'slash' },
      { t: 6.0, type: 'glint', gain: 0.8 },
    ],
    draw(ctx, t) {
      const WIPE = 4.4;
      const lock = (c) => lockup(c, t, { footerText: A.content.tonight.footer });
      if (t < WIPE) return tonightA(ctx, t);
      if (t < WIPE + 1.0) {
        const a = scene(0, (c) => tonightA(c, t));
        const b = scene(1, lock);
        slashWipe(ctx, a, b, prog(t, WIPE, WIPE + 1.0), { angle: 62 });
        return;
      }
      lock(ctx);
      const [gx, gy] = artTip(LOCK.art.x, LOCK.art.y, LOCK.art.s);
      glint(ctx, gx, gy, 300, Math.max(0.25, flare(t, 6.0, 1.0, 0.25)));
    },
  });

  window.HH_registerCountdowns = () => {
    A.content.countdown.forEach((n) => register(countdownCard(n)));
  };
})();
