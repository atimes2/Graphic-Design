/* Instagram Story cards for Halloween at Henderson (v4).
 *
 * Motion language:
 *  - hard hits (shake + flash) only for the knife: stabs, slash cuts, the stamp
 *  - text arrives gently and varies card to card: ember burn, neon flicker-on,
 *    blur fade, sparkle sweep (see revealText in engine.js)
 *  - the important animation happens in the first ~2-4s, then the final frame
 *    lingers with candle flicker, slow camera drift and occasional sparkles
 *  - sticker slots (ticket links / questions) are on screen from frame 0
 * Each card: id, duration (s), cues [{t, type, ...}] for the SFX, draw(ctx, t).
 */
(function () {
  const {
    W, H, clamp, lerp, prog, ease, flicker, neon, flare,
    A, canvas, blurred, drawImg, camera, glint, sparkle, shakeAt, flash, edgeLight,
    setFont, fit, emberText, label, kicker, revealText, neonLabel, stickerSlot,
    LOCK, art, artTip, artH, bladeDir, logo, logoByH, title, scene, slashWipe, register,
  } = window.HH;

  const BONE = '#FFF1E0';
  const C = () => A.content;

  // shake the whole card for knife hits, draw, then flash on top
  function withHits(ctx, t, hits, fn, o = {}) {
    const [dx, dy] = shakeAt(t, hits.map((h) => (Array.isArray(h) ? h[0] : h)), o.amp ?? 12);
    ctx.save();
    ctx.translate(dx, dy);
    fn();
    ctx.restore();
    hits.forEach((h) => {
      const [t0, a] = Array.isArray(h) ? h : [h, 0.18];
      flash(ctx, t, t0, a);
    });
  }
  // lingering camera drift for the whole card
  const drift = (ctx, t, dur, cy = 960, amt = 0.035) => camera(ctx, lerp(1.0, 1.0 + amt, ease.inOut2(clamp(t / dur))), W / 2, cy);

  // knife stab: offset (art px) that arrives along the blade axis at t1
  const stab = (t, t0, t1, dist = 900) => {
    const [bx, by] = bladeDir();
    const d = (1 - ease.outExpo(prog(t, t0, t1))) * dist;
    return [-bx * d, -by * d];
  };
  // pumpkin ignition: 0 before t0, a warm burst, then candle flicker
  const ignite = (t, t0, seed = 1) => (t < t0 ? 0 : ease.out2(prog(t, t0, t0 + 0.25)) * (1 + 0.3 * Math.exp(-(t - t0) * 4)) * flicker(t, seed));
  const titleLit = (t, a = 1) => () => ({ ember: a * (0.92 + 0.08 * flicker(t, 9)), fill: a });
  const neonA = (t, t0, d = 0.4) => neon(prog(t, t0, t0 + d));
  const fadeA = (t, t0, d = 0.7) => ease.out2(prog(t, t0, t0 + d));

  // poster title burning in letter by letter (the v1 reveal)
  function titleBurn(ctx, x, y, s, t, t0, step = 0.06) {
    title(ctx, x, y, s, (li, i) => {
      const st = t0 + (li === 0 ? 0 : 0.35) + i * step;
      return { ember: neon(prog(t, st, st + 0.45)) * (0.9 + 0.1 * flicker(t, 9)), fill: ease.out2(prog(t, st + 0.3, st + 0.8)) };
    });
  }
  const miniTitle = (ctx, t, t0, y = 280, s = 0.62) => {
    const a = neonA(t, t0, 0.5);
    if (a > 0) title(ctx, W / 2 - 433 * s, y, s, titleLit(t, a));
  };

  function lockup(ctx, t, o = {}) {
    const L = LOCK;
    art(ctx, L.art.x, L.art.y, L.art.s, { pumpkin: flicker(t, 1), h: flicker(t + 0.4, 3), sweep: o.sweep ?? -1 });
    title(ctx, L.title.x, L.title.y, L.title.s, titleLit(t));
    if (o.footerText) label(ctx, o.footerText, W / 2, L.footer.y + 54, 50, { weight: '700', alpha: o.footerAlpha ?? 1 });
    else drawImg(ctx, A.img.footer, L.footer.x, L.footer.y, L.footer.s, o.footerAlpha ?? 1);
  }

  function hGlowBack(ctx, t, cx, cy, amt, scale = 3.2) {
    if (amt <= 0.001) return;
    const hb = blurred('hback', A.img.h_glow, 40);
    const [hx, hy] = A.meta.h_center;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(0.42 * amt * flicker(t, 6));
    ctx.drawImage(hb.c, cx - (hx + hb.pad) * scale, cy - (hy + hb.pad) * scale, hb.c.width * scale, hb.c.height * scale);
    ctx.restore();
  }

  // cue helpers for the reveal sounds
  const burnCue = (t, str, step = 0.055) => ({ t, type: 'burn', dur: str.length * step + 0.3 });
  const neonCue = (t, dur = 0.5) => ({ t, type: 'buzz', dur });
  const airCue = (t) => ({ t, type: 'air' });

  // ======================================================= 01 · THE RETURN (12s)
  register({
    id: '01-the-return',
    duration: 12,
    cues: [
      { t: 0.4, type: 'whoosh', dur: 0.3 }, { t: 0.4, type: 'stab' }, { t: 0.4, type: 'glint', gain: 0.6 },
      { t: 0.8, type: 'ignite' }, burnCue(1.3, 'HALLOWEEN AT HENDERSON', 0.03), neonCue(2.9, 0.4),
      { t: 3.6, type: 'glint' }, { t: 7.5, type: 'glint', gain: 0.5 }, { t: 10.5, type: 'glint', gain: 0.5 },
    ],
    draw(ctx, t) {
      const L = LOCK;
      withHits(ctx, t, [[0.4, 0.18]], () => {
        ctx.save();
        drift(ctx, t, 12, 900);
        const off = stab(t, 0.12, 0.4);
        const sweep = lerp(-0.2, 1.05, prog(t, 3.1, 3.6));
        art(ctx, L.art.x, L.art.y, L.art.s, {
          pumpkin: ignite(t, 0.8), h: ignite(t, 0.8, 3) * 1.05,
          knifeAlpha: t >= 0.12 ? 1 : 0, knifeOffset: off, sweep: t > 3.1 && t < 3.65 ? sweep : -1,
        });
        const [gx, gy] = artTip(L.art.x, L.art.y, L.art.s, off);
        sparkle(ctx, gx, gy, 330, t, 0.4, { hold: 0.22 });
        [3.6, 7.5, 10.5].forEach((s0) => sparkle(ctx, gx, gy, 360, t, s0, { hold: 0.22 }));
        titleBurn(ctx, L.title.x, L.title.y, L.title.s, t, 1.3);
        drawImg(ctx, A.img.footer, L.footer.x, L.footer.y, L.footer.s, neonA(t, 2.9));
        ctx.restore();
      });
    },
  });

  // ======================================================= 02 · MORE ROOM (14s)
  const MC = { AX: 328, AY: 980, AS: 0.78 };
  const MC_LOGO = { x: 540, y: 1250, d: 660 };   // d = wordmark width
  const RAM = 'Copperplate';   // HENDERSON / BREWING CO. in the headline face

  function moreA(ctx, t) {
    const c = C().moreRoom;
    kicker(ctx, c.k1, 820, neonA(t, 0.15));
    revealText(ctx, c.big1, W / 2, 975, fit(ctx, c.big1, 150, 940), t, 0.4, 'neon', { seed: 3 });
    kicker(ctx, c.sub1, 1070, fadeA(t, 1.3), { color: BONE, glow: 0, size: 36, tracking: 12 });
  }
  function moreB(ctx, t) {
    const c = C().moreRoom;
    kicker(ctx, c.k2, 780, neonA(t, 2.9));
    const sz = Math.min(fit(ctx, c.big2a, 170, 940), fit(ctx, c.big2b, 170, 940));
    revealText(ctx, c.big2a, W / 2, 950, sz, t, 3.1, 'burn');
    revealText(ctx, c.big2b, W / 2, 950 + sz * 1.05, sz, t, 3.6, 'burn');
  }
  function moreC(ctx, t) {
    const c = C().moreRoom;
    const push = ease.inOut3(prog(t, 7.1, 7.8));
    const s = lerp(1, 2.0, push);
    const [hx, hy] = artH(MC.AX, MC.AY, MC.AS);
    const Cx = lerp(hx, MC_LOGO.x, push), Cy = lerp(hy, MC_LOGO.y, push);
    const cut = ease.inOut2(prog(t, 7.65, 7.95));
    if (t >= 6.3 && cut < 1) {
      ctx.save();
      ctx.translate(Cx, Cy);
      ctx.scale(s, s);
      ctx.translate(-hx, -hy);
      art(ctx, MC.AX, MC.AY, MC.AS, {
        pumpkin: ignite(t, 6.55) * (1 - cut), h: (ignite(t, 6.55, 3) + 0.6 * push) * (1 - cut),
        knifeOffset: stab(t, 6.3, 6.55, 700), knifeAlpha: 1 - cut,
      });
      ctx.restore();
    }
    if (cut > 0) {
      const back = ease.inOut3(prog(t, 7.8, 8.7));
      const Lm = A.meta.logo;
      const k1 = MC_LOGO.d / (2 * Lm.radius);
      const hH0 = A.meta.h_height * MC.AS * 2.0;
      const hH1 = (Lm.h_box[3] - Lm.h_box[1]) * k1;
      const hcx = (Lm.h_box[0] + Lm.h_box[2]) / 2, hcy = (Lm.h_box[1] + Lm.h_box[3]) / 2;
      const endHx = MC_LOGO.x + (hcx - Lm.center[0]) * k1, endHy = MC_LOGO.y + (hcy - Lm.center[1]) * k1;
      logoByH(ctx, lerp(MC_LOGO.x, endHx, back), lerp(MC_LOGO.y, endHy, back), lerp(hH0, hH1, back), cut, 0.22 + 0.06 * flicker(t, 2));
    }
    sparkle(ctx, Cx, Cy, 560, t, 7.7);
    [9.8, 12.6].forEach((s0) => sparkle(ctx, MC_LOGO.x + MC_LOGO.d * 0.46, MC_LOGO.y - MC_LOGO.d * 0.1, 240, t, s0));
    // type in the headline face (Copperplate: the closest match to the poster's title)
    kicker(ctx, c.k3, 640, neonA(t, 5.2));
    revealText(ctx, 'HENDERSON', W / 2, 800, fit(ctx, 'HENDERSON', 170, 940, RAM), t, 5.45, 'fade', { family: RAM });
    revealText(ctx, c.venue2, W / 2, 935, fit(ctx, c.venue2, 118, 820, RAM), t, 5.8, 'sweep', { family: RAM });
  }

  register({
    id: '02-more-room',
    duration: 14,
    cues: [
      neonCue(0.15, 0.3), neonCue(0.4, 0.7), airCue(1.3), { t: 2.6, type: 'slash' },
      neonCue(2.9, 0.3), burnCue(3.1, 'WE NEEDED'), burnCue(3.6, 'MORE ROOM.'),
      { t: 5.0, type: 'whoosh', dur: 0.5 }, neonCue(5.2, 0.3), airCue(5.45), { t: 5.8, type: 'glint', gain: 0.6 },
      { t: 6.55, type: 'stab' }, { t: 6.55, type: 'ignite' },
      { t: 7.7, type: 'riser', dur: 0.6 }, { t: 7.7, type: 'hit', gain: 0.9 }, { t: 7.7, type: 'glint' },
      { t: 9.8, type: 'glint', gain: 0.5 }, { t: 12.6, type: 'glint', gain: 0.5 },
    ],
    draw(ctx, t) {
      withHits(ctx, t, [[2.6, 0.15], [6.55, 0.18], [7.7, 0.4]], () => {
        if (t < 2.6) return moreA(ctx, t);
        if (t < 3.2) return slashWipe(ctx, scene(0, (c) => moreA(c, t)), scene(1, (c) => moreB(c, t)), prog(t, 2.6, 3.2));
        if (t < 4.8) return moreB(ctx, t);
        const p = ease.inOut3(prog(t, 4.8, 5.4));
        if (p >= 1) {
          ctx.save();
          drift(ctx, t - 5.4, 8.6, 1000, 0.025);
          moreC(ctx, t);
          ctx.restore();
          return;
        }
        // "more room": the old frame falls away as the new one opens up
        const b = scene(0, (c) => moreB(c, t), true);
        const cc = scene(1, (c) => moreC(c, t), true);
        ctx.save();
        ctx.globalAlpha = ease.out2(p);
        camera(ctx, lerp(1.35, 1, p), W / 2, 960);
        ctx.drawImage(cc, 0, 0);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = 1 - ease.in2(p);
        camera(ctx, lerp(1, 0.2, p), W / 2, 960);
        ctx.drawImage(b, 0, 0);
        ctx.restore();
      });
    },
  });

  // ======================================================= 03 · THE DETAILS (14s)
  // Built to be read: the knife cuts the screen open onto one clean card, then
  // the five details arrive one at a time and STAY, stacked like an invitation,
  // and the finished card holds for ~8s.
  const DROW_Y0 = 590, DROW_STEP = 158, DR_T0 = 2.0, DR_STEP = 0.7, D_CUT = 0.95;
  const D_END = DR_T0 + 5 * DR_STEP;   // after the last row

  // a thin ember rule that draws out from the centre, a sparkle riding each end
  function divider(ctx, t, y, t0, half = 380) {
    const p = ease.inOut2(prog(t, t0, t0 + 0.6));
    if (p <= 0) return;
    const h = half * p;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(255,90,30,1)';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = `rgba(232,98,28,${0.75 * (0.9 + 0.1 * flicker(t, 11))})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(W / 2 - h, y); ctx.lineTo(W / 2 + h, y); ctx.stroke();
    ctx.restore();
    if (p < 1) { glint(ctx, W / 2 - h, y, 110, 0.8); glint(ctx, W / 2 + h, y, 110, 0.8); }
  }

  function detailsCard(ctx, t) {
    const items = C().details;
    hGlowBack(ctx, t, W / 2, 920, 0.7 * fadeA(t, 1.0, 1.2), 4.4);
    edgeLight(ctx, t, 0.3);
    titleBurn(ctx, W / 2 - 433 * 0.72, 262, 0.72, t, 1.25, 0.035);
    divider(ctx, t, 490, 1.8);
    items.forEach((it, i) => {
      const t0 = DR_T0 + i * DR_STEP;
      const y = DROW_Y0 + i * DROW_STEP;
      kicker(ctx, it.kicker, y, neonA(t, t0, 0.35), { size: 30, tracking: 10, glow: 16 });
      revealText(ctx, it.value, W / 2, y + 78, fit(ctx, it.value, 74, 960), t, t0 + 0.15, 'sweep', { dur: 0.6 });
    });
    divider(ctx, t, 1338, D_END);
    const la = fadeA(t, D_END + 0.3, 0.9);
    logo(ctx, W / 2, 1420, 340, la, 0.15 + 0.3 * la * Math.exp(-(t - D_END - 0.3) * 2));
    kicker(ctx, C().detailsFooter, 1530, neonA(t, D_END + 0.7), { color: BONE, glow: 0, size: 26, tracking: 5 });
  }

  register({
    id: '03-the-details',
    duration: 14,
    cues: [
      { t: 0.35, type: 'whoosh', dur: 0.25 }, { t: 0.35, type: 'stab' }, { t: 0.35, type: 'glint', gain: 0.6 },
      { t: D_CUT, type: 'slash' }, burnCue(1.25, 'HALLOWEEN AT HENDERSON', 0.035), { t: 1.8, type: 'glint', gain: 0.35 },
      ...[0, 1, 2, 3, 4].map((i) => neonCue(DR_T0 + i * DR_STEP, 0.3)),
      ...[0, 1, 2, 3, 4].map((i) => ({ t: DR_T0 + i * DR_STEP + 0.15, type: 'glint', gain: 0.3 })),
      airCue(D_END + 0.3), neonCue(D_END + 0.7, 0.4),
      { t: 8.5, type: 'glint', gain: 0.45 }, { t: 11.5, type: 'glint', gain: 0.45 },
    ],
    draw(ctx, t) {
      withHits(ctx, t, [0.35, [D_CUT, 0.12]], () => {
        if (t < D_CUT) return knifeHero(ctx, t);
        if (t < D_CUT + 0.6) {
          return slashWipe(ctx, scene(0, (c) => knifeHero(c, t)), scene(1, (c) => detailsCard(c, t)), prog(t, D_CUT, D_CUT + 0.6));
        }
        ctx.save();
        drift(ctx, t - D_CUT - 0.6, 12.4, 900, 0.02);
        detailsCard(ctx, t);
        [8.5, 11.5].forEach((s0, i) => sparkle(ctx, W / 2 + (i ? -380 : 380), i ? 1338 : 490, 200, t, s0));
        ctx.restore();
      });
    },
  });

  // ======================================================= 04 · EARLY BIRD ON SALE (12s)
  const SMALL_ART = { x: 540 - 272 * 0.36, y: 450, s: 0.36 };
  register({
    id: '04-early-bird-on-sale',
    duration: 12,
    cues: [
      { t: 0.35, type: 'stab' }, { t: 0.45, type: 'ignite' }, neonCue(0.3, 0.4),
      neonCue(0.7, 0.7), burnCue(1.3, 'TICKETS'), neonCue(2.0, 0.5), airCue(2.5),
      { t: 3.2, type: 'glint', gain: 0.6 }, { t: 7.5, type: 'glint', gain: 0.5 }, { t: 10.5, type: 'glint', gain: 0.5 },
    ],
    draw(ctx, t) {
      const c = C().earlyBird;
      withHits(ctx, t, [[0.35, 0.15]], () => {
        stickerSlot(ctx, t, 1265, 1);   // ticket link sits here from the first frame
        ctx.save();
        drift(ctx, t, 12, 900, 0.025);
        edgeLight(ctx, t, 0.6 * fadeA(t, 0.2, 0.8));
        hGlowBack(ctx, t, W / 2, 1000, fadeA(t, 0.6, 1.0));
        miniTitle(ctx, t, 0.3);
        const off = stab(t, 0.15, 0.35, 700);
        art(ctx, SMALL_ART.x, SMALL_ART.y, SMALL_ART.s, { pumpkin: ignite(t, 0.45), h: ignite(t, 0.45, 3), knifeOffset: off, knifeAlpha: t >= 0.15 ? 1 : 0 });
        revealText(ctx, c.l1, W / 2, 870, fit(ctx, c.l1, 140, 900), t, 0.7, 'neon', { seed: 5 });
        revealText(ctx, c.l2, W / 2, 1060, fit(ctx, c.l2, 220, 960), t, 1.3, 'burn', { step: 0.07 });
        neonLabel(ctx, c.status, 1150, t, 2.0, { size: 64, tracking: 12 });
        kicker(ctx, c.sub, 1215, fadeA(t, 2.5), { color: BONE, glow: 0, size: 30, tracking: 6 });
        const [gx, gy] = artTip(SMALL_ART.x, SMALL_ART.y, SMALL_ART.s, off);
        sparkle(ctx, gx, gy, 180, t, 0.35, { hold: 0.2 });
        [3.2, 7.5, 10.5].forEach((s0) => sparkle(ctx, gx, gy, 220, t, s0, { hold: 0.2 }));
        ctx.restore();
      });
    },
  });

  // ======================================================= 05 · COUNTDOWN (10s each)
  const numCache = {};
  function numeral(key, str, size, base) {
    if (numCache[key]) return numCache[key];
    const c = canvas(W, H);
    const x = c.getContext('2d');
    x.font = `${size}px "Lobster"`;
    x.textAlign = 'center';
    const cy = base - size * 0.36;
    const tw = x.measureText(str).width;
    const g = x.createRadialGradient(540, cy - size * 0.05, 40, 540, cy, Math.max(size * 0.48, tw * 0.62));
    g.addColorStop(0, '#FFF6D8');
    g.addColorStop(0.45, '#FFD27A');
    g.addColorStop(0.8, '#F28A2C');
    g.addColorStop(1, '#C8461A');
    x.fillStyle = g;
    x.fillText(str, 540, base);
    x.globalCompositeOperation = 'source-atop';
    x.filter = `blur(${Math.round(size / 70)}px)`;
    x.strokeStyle = 'rgba(150,40,8,0.85)';
    x.lineWidth = size / 26;
    x.strokeText(str, 540, base);
    x.filter = 'none';
    x.globalAlpha = 0.35;
    const hg = A.img.h_glow;
    x.drawImage(hg, 0, 0, hg.width, hg.height, -300, cy - 1130, hg.width * 3.2, hg.height * 3.2);
    numCache[key] = c;
    return c;
  }
  const revealBuf = canvas(W, H);
  /* carve with a travelling sparkle (r0..r1), then the candle catches at ig */
  function carved(ctx, t, o) {
    const r0 = o.r0 ?? 0.2, r1 = o.r1 ?? 0.95, ig = o.ig ?? 1.0;
    const num = numeral(o.key, o.str, o.size, o.base);
    const cy = o.base - o.size * 0.36;
    const on = ease.out2(prog(t, ig, ig + 0.5));
    const fl = flicker(t, o.size);
    const bright = lerp(0.75, 1, on) * lerp(1, fl, on) + (t >= ig ? 0.25 * Math.exp(-(t - ig) * 3) : 0);
    const cg = ctx.createRadialGradient(540, cy, 30, 540, cy, 760);
    cg.addColorStop(0, `rgba(232,98,28,${0.32 * on * fl})`);
    cg.addColorStop(0.5, `rgba(160,40,12,${0.15 * on * fl})`);
    cg.addColorStop(1, 'rgba(120,20,8,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, W, H);
    const rev = ease.inOut2(prog(t, r0, r1));
    const ang = (70 * Math.PI) / 180, ux = Math.cos(ang), uy = Math.sin(ang);
    const span = Math.max(820, o.size * 1.6);
    const fx = 540 + ux * lerp(-span / 2, span / 2, rev), fy = cy + uy * lerp(-span / 2, span / 2, rev);
    const r = revealBuf.getContext('2d');
    r.globalCompositeOperation = 'source-over';
    r.globalAlpha = 1;
    r.clearRect(0, 0, W, H);
    r.drawImage(num, 0, 0);
    if (on < 1) {
      r.globalCompositeOperation = 'source-atop';
      r.fillStyle = `rgba(150,26,10,${0.8 * (1 - on)})`;
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
    ctx.globalAlpha = clamp(bright);
    ctx.drawImage(revealBuf, 0, 0);
    if (bright > 1) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(bright - 1);
      ctx.drawImage(revealBuf, 0, 0);
    }
    ctx.restore();
    const nb1 = blurred(`${o.key}a`, num, 14), nb2 = blurred(`${o.key}b`, num, 48);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(0.55 * on * fl * bright);
    ctx.drawImage(nb1.c, -nb1.pad, -nb1.pad);
    ctx.globalAlpha = clamp(0.5 * on * fl * bright);
    ctx.drawImage(nb2.c, -nb2.pad, -nb2.pad);
    ctx.restore();
    if (t >= r0 && t < r1 + 0.12) glint(ctx, fx + uy * 60, fy - ux * 60, 260, 1 - prog(t, r1, r1 + 0.12), { spin: 1.5 });
  }

  function countdownCard(n) {
    const lab = n === 1 ? C().countdownLabel.one : C().countdownLabel.many;
    const str = String(n);
    return {
      id: `05-countdown-${String(n).padStart(2, '0')}`,
      duration: 10,
      cues: [
        { t: 0.2, type: 'carve', dur: 0.75 }, { t: 1.0, type: 'ignite' }, burnCue(1.4, lab, 0.06),
        neonCue(2.1, 0.4), airCue(2.5), { t: 4.5, type: 'glint', gain: 0.6 }, { t: 8.0, type: 'glint', gain: 0.5 },
      ],
      draw(ctx, t) {
        ctx.save();
        camera(ctx, lerp(1.0, 1.03, ease.inOut2(t / 10)), W / 2, 960);
        const size = Math.min(880, fit(ctx, str, 880, 840, 'Lobster'));
        carved(ctx, t, { key: `c${n}`, str, size, base: 1250 });
        revealText(ctx, lab, W / 2, 1452, fit(ctx, lab, 110, 900), t, 1.4, 'burn', { step: 0.06 });
        miniTitle(ctx, t, 2.1, 292);
        kicker(ctx, C().countdownSub, 1535, fadeA(t, 2.5), { color: BONE, glow: 0, size: 30, tracking: 8 });
        [4.5, 8.0].forEach((s0) => sparkle(ctx, 760, 470, 300, t, s0));
        ctx.restore();
      },
    };
  }

  // ======================================================= 06 · THE NIGHT (12s)
  const BEAT = 60 / 124;
  const NX = 540 - 272 * 0.85, NY = 1010, NS = 0.85;
  const LT0 = 0.1;

  function lasers(ctx, t, amt) {
    if (amt <= 0.001) return;
    const beat = (t - LT0) / BEAT, bar = Math.floor(beat / 4), inBeat = (((beat % 1) + 1) % 1) * BEAT;
    const kick = 0.5 + 0.5 * Math.exp(-inBeat * 7);
    const n = 7;
    const [ox, oy] = artH(NX, NY, NS);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const k = i - (n - 1) / 2;
      let ang;
      if (bar % 2 === 0) ang = -90 + k * 13 + 26 * Math.sin((2 * Math.PI * beat) / 8);
      else ang = -90 + (i % 2 ? 1 : -1) * (6 + 34 * Math.abs(Math.sin((Math.PI * beat) / 2))) + k * 4;
      const on = (Math.floor(beat * 2) % 2 === 1 && i % 2 === 1) ? 0.25 : 1;
      const I = amt * kick * on;
      const a = (ang * Math.PI) / 180;
      const ex = ox + Math.cos(a) * 2600, ey = oy + Math.sin(a) * 2600;
      const col = i % 3 !== 1 ? [255, 46, 26] : [255, 168, 60];
      [[40, 0.09], [13, 0.26], [4, 0.95]].forEach(([w, al]) => {
        const g = ctx.createLinearGradient(ox, oy, ex, ey);
        g.addColorStop(0, `rgba(${col},${al * I})`);
        g.addColorStop(0.5, `rgba(${col},${al * I * 0.45})`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.strokeStyle = g;
        ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();
      });
    }
    const hz = ctx.createRadialGradient(ox, oy - 500, 50, ox, oy - 500, 1100);
    hz.addColorStop(0, `rgba(255,70,30,${0.12 * amt * kick})`);
    hz.addColorStop(1, 'rgba(255,70,30,0)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  const G0 = 1.3;
  register({
    id: '06-the-night',
    duration: 12,
    cues: [
      ...Array.from({ length: Math.floor((12 - LT0) / BEAT) }, (_, i) => ({ t: LT0 + i * BEAT, type: 'laser', i })),
      neonCue(0.35, 0.7), neonCue(0.9, 0.3),
      ...[0, 1, 2, 3].map((i) => neonCue(G0 + i * 2 * BEAT, 0.25)),
      airCue(G0 + 8 * BEAT),
    ],
    draw(ctx, t) {
      const c = C().night;
      const on = ease.out2(prog(t, LT0, LT0 + 0.3));
      const beat = (t - LT0) / BEAT, inBeat = (((beat % 1) + 1) % 1) * BEAT;
      const kick = t > LT0 ? Math.exp(-inBeat * 7) : 0;
      art(ctx, NX, NY, NS, { pumpkin: ignite(t, LT0) * (0.85 + 0.15 * kick), h: ignite(t, LT0, 3) * (0.8 + 0.35 * kick) });
      lasers(ctx, t, on);
      const [ox, oy] = artH(NX, NY, NS);
      glint(ctx, ox, oy, 220, on * (0.35 + 0.65 * kick), { spin: 0.8 });
      const band = ctx.createLinearGradient(0, 220, 0, 960);
      band.addColorStop(0, 'rgba(5,3,3,0.55)');
      band.addColorStop(0.75, 'rgba(5,3,3,0.45)');
      band.addColorStop(1, 'rgba(5,3,3,0)');
      ctx.fillStyle = band;
      ctx.fillRect(0, 220, W, 740);
      revealText(ctx, c.head, W / 2, 510, fit(ctx, c.head, 130, 960), t, 0.35, 'neon', { seed: 2, step: 0.05 });
      kicker(ctx, c.kicker, 360, neonA(t, 0.9), { size: 34 });
      // genres flicker on with the beat, two beats each
      const gi = Math.floor((t - G0) / (2 * BEAT));
      if (t >= G0 && gi < c.genres.length) {
        const str = c.genres[gi];
        const g0 = G0 + gi * 2 * BEAT;
        const a = neon(prog(t, g0, g0 + 0.22));
        emberText(ctx, str, W / 2, 700, fit(ctx, str, 104, 940), { alpha: a, glow: 0.9 + 0.3 * kick });
      }
      const listT = G0 + c.genres.length * 2 * BEAT;
      c.lines.forEach((ln, i) => {
        kicker(ctx, ln, 640 + i * 62, neonA(t, listT + i * 0.25, 0.4),
          { color: i === 0 ? BONE : '#E8621C', size: 34, tracking: 8, glow: i === 0 ? 0 : 18 });
      });
    },
  });

  // ======================================================= 07 · FIRST 100 (10s)
  register({
    id: '07-first-100',
    duration: 10,
    cues: [
      neonCue(0.15, 0.35), { t: 0.3, type: 'carve', dur: 0.7 }, { t: 1.1, type: 'ignite' },
      burnCue(1.5, 'GUESTS', 0.07), airCue(2.1), neonCue(2.5, 0.4),
      { t: 4.5, type: 'glint', gain: 0.6 }, { t: 8.0, type: 'glint', gain: 0.5 },
    ],
    draw(ctx, t) {
      const c = C().first100;
      ctx.save();
      camera(ctx, lerp(1.0, 1.03, ease.inOut2(t / 10)), W / 2, 960);
      const size = fit(ctx, c.num, 700, 760, 'Lobster');
      carved(ctx, t, { key: `n${c.num}`, str: c.num, size, base: 1150, r0: 0.3, r1: 1.0, ig: 1.1 });
      miniTitle(ctx, t, 2.5);
      kicker(ctx, c.kicker, 600, neonA(t, 0.15), { size: 40, tracking: 14 });
      revealText(ctx, c.line, W / 2, 1330, fit(ctx, c.line, 120, 900), t, 1.5, 'burn', { step: 0.07 });
      revealText(ctx, c.sub, W / 2, 1415, fit(ctx, c.sub, 40, 900, 'Figtree', 8, '800'), t, 2.1, 'fade', { family: 'Figtree', weight: '800', tracking: 8, glow: 0.4 });
      [4.5, 8.0].forEach((s0) => sparkle(ctx, 760, 458, 300, t, s0));
      ctx.restore();
    },
  });

  // ======================================================= 08 · DRESS TO KILL (10s)
  const KN = { x: 540 - 200 * 1.9, y: 150, s: 1.9 };
  function knifeHero(ctx, t) {
    const off = stab(t, 0.1, 0.35, 900);
    const gl = ctx.createRadialGradient(560, 900, 60, 560, 900, 760);
    gl.addColorStop(0, `rgba(224,70,30,${0.3 * ease.out2(prog(t, 0.1, 0.35)) * flicker(t, 4)})`);
    gl.addColorStop(1, 'rgba(224,70,30,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, W, H);
    art(ctx, KN.x, KN.y, KN.s, { pumpkinAlpha: 0, knifeOffset: off });
    const [gx, gy] = artTip(KN.x, KN.y, KN.s, off);
    sparkle(ctx, gx, gy, 380, t, 0.35, { hold: 0.3 });
  }
  const DRESS_Y = 880;
  const dressSize = (ctx) => Math.min(fit(ctx, C().dress.line1, 250, 920), fit(ctx, C().dress.line2, 250, 920));
  function dressType(ctx, t) {
    const c = C().dress;
    hGlowBack(ctx, t, W / 2, 940, fadeA(t, 1.0, 0.8));
    edgeLight(ctx, t, 0.5);
    const sz = dressSize(ctx);
    revealText(ctx, c.line1, W / 2, DRESS_Y, sz, t, 1.3, 'burn', { step: 0.08 });
    revealText(ctx, c.line2, W / 2, DRESS_Y + sz * 1.02, sz, t, 1.75, 'burn', { step: 0.08 });
    neonLabel(ctx, c.sub, 1255, t, 2.6, { size: 44, tracking: 12, color: BONE });
    kicker(ctx, c.contest, 1318, fadeA(t, 3.0), { size: 34, tracking: 8 });
    miniTitle(ctx, t, 3.4, 1390, 0.55);
  }
  register({
    id: '08-dress-to-kill',
    duration: 10,
    cues: [
      { t: 0.35, type: 'whoosh', dur: 0.25 }, { t: 0.35, type: 'stab' }, { t: 0.35, type: 'glint', gain: 0.7 },
      { t: 1.0, type: 'slash' }, burnCue(1.3, 'DRESS', 0.08), burnCue(1.75, 'TO KILL.', 0.08),
      neonCue(2.6, 0.4), airCue(3.0), { t: 5.0, type: 'glint', gain: 0.6 }, { t: 8.3, type: 'glint', gain: 0.5 },
    ],
    draw(ctx, t) {
      withHits(ctx, t, [0.35, [1.0, 0.12]], () => {
        if (t < 1.0) return knifeHero(ctx, t);
        if (t < 1.6) return slashWipe(ctx, scene(0, (c) => knifeHero(c, t)), scene(1, (c) => dressType(c, t)), prog(t, 1.0, 1.6));
        ctx.save();
        drift(ctx, t - 1.6, 8.4, 960, 0.025);
        dressType(ctx, t);
        const sz = dressSize(ctx);
        ctx.save();
        setFont(ctx, 'Copperplate', sz);
        const w = ctx.measureText(C().dress.line2).width;
        ctx.restore();
        [5.0, 8.3].forEach((s0) => sparkle(ctx, W / 2 + w / 2 - sz * 0.16, DRESS_Y + sz * 1.02 - sz * 0.1, 300, t, s0));
        ctx.restore();
      });
    },
  });

  // ======================================================= 09 · COSTUME CONTEST (12s)
  // A "group" of costumes as neon signs: witch hat, ghost, masquerade mask.
  function neonShape(ctx, x, y, s, rot, a, color, pathFn) {
    if (a <= 0.001) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(s, s);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    pathFn(ctx);
    ctx.globalAlpha = a * 0.45;
    ctx.shadowColor = color;
    ctx.shadowBlur = 55;
    ctx.strokeStyle = color;
    ctx.lineWidth = 16;
    ctx.stroke();
    ctx.globalAlpha = a;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,238,222,0.95)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
  const COSTUMES = [
    {   // witch hat
      x: 220, y: 1275, s: 0.95, t0: 0.2, color: '#FF7A2E', sway: (t) => [0.05 * Math.sin(t * 1.3), 0],
      path: (c) => {
        c.beginPath();
        c.moveTo(-72, 80); c.quadraticCurveTo(-30, -20, 0, -140);
        c.quadraticCurveTo(22, -168, 64, -150);
        c.moveTo(12, -122); c.quadraticCurveTo(36, -30, 72, 80);
        c.moveTo(150, 88); c.ellipse(0, 88, 150, 24, 0, 0, Math.PI * 2);
        c.moveTo(-62, 50); c.lineTo(62, 50);
        c.rect(-15, 38, 30, 26);
      },
    },
    {   // ghost
      x: 540, y: 1225, s: 1.2, t0: 0.45, color: '#FFB27A', sway: (t) => [0, 10 * Math.sin(t * 1.7)],
      path: (c) => {
        c.beginPath();
        c.moveTo(-100, 110); c.lineTo(-100, -20);
        c.arc(0, -20, 100, Math.PI, 0);
        c.lineTo(100, 110);
        const xs = [100, 50, 0, -50, -100];
        for (let i = 0; i < 4; i++) c.quadraticCurveTo((xs[i] + xs[i + 1]) / 2, i % 2 ? 80 : 142, xs[i + 1], 110);
        c.closePath();
        c.moveTo(-22, -25); c.ellipse(-35, -25, 13, 20, 0, 0, Math.PI * 2);
        c.moveTo(48, -25); c.ellipse(35, -25, 13, 20, 0, 0, Math.PI * 2);
        c.moveTo(15, 32); c.ellipse(0, 32, 15, 22, 0, 0, Math.PI * 2);
      },
    },
    {   // masquerade mask on a stick
      x: 860, y: 1255, s: 0.95, t0: 0.7, color: '#FF3A22', sway: (t) => [0.06 * Math.sin(t * 1.1 + 1), 0],
      path: (c) => {
        c.beginPath();
        c.moveTo(0, -5);
        c.bezierCurveTo(35, -45, 120, -55, 150, -20);
        c.bezierCurveTo(165, 5, 130, 45, 80, 45);
        c.bezierCurveTo(45, 45, 25, 22, 0, 28);
        c.bezierCurveTo(-25, 22, -45, 45, -80, 45);
        c.bezierCurveTo(-130, 45, -165, 5, -150, -20);
        c.bezierCurveTo(-120, -55, -35, -45, 0, -5);
        c.closePath();
        c.moveTo(-36, 2); c.ellipse(-72, 2, 36, 17, -0.15, 0, Math.PI * 2);
        c.moveTo(108, 2); c.ellipse(72, 2, 36, 17, 0.15, 0, Math.PI * 2);
        c.moveTo(138, 32); c.lineTo(178, 175);
      },
    },
  ];
  register({
    id: '09-costume-contest',
    duration: 12,
    cues: [
      ...COSTUMES.map((p) => neonCue(p.t0, 0.5)),
      burnCue(1.1, 'BEST GROUP'), burnCue(1.6, 'COSTUME'), neonCue(2.2, 0.6), airCue(2.8), neonCue(3.3, 0.4),
      ...COSTUMES.map((p, i) => ({ t: 4.5 + i * 0.35, type: 'glint', gain: 0.45 })),
      ...COSTUMES.map((p, i) => ({ t: 8.5 + i * 0.35, type: 'glint', gain: 0.4 })),
    ],
    draw(ctx, t) {
      const c = C().contest;
      ctx.save();
      drift(ctx, t, 12, 1000, 0.025);
      edgeLight(ctx, t, 0.4);
      COSTUMES.forEach((p, i) => {
        const a = neon(prog(t, p.t0, p.t0 + 0.5)) * (0.9 + 0.1 * flicker(t, i + 20));
        const [rot, dy] = p.sway(t);
        // warm pool of light under each sign
        const g = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 260 * p.s);
        g.addColorStop(0, `rgba(255,90,30,${0.18 * a})`);
        g.addColorStop(1, 'rgba(255,90,30,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        neonShape(ctx, p.x, p.y + dy, p.s, rot, a, p.color, p.path);
        [4.5, 8.5].forEach((s0) => sparkle(ctx, p.x + 60 * p.s, p.y - 130 * p.s + dy, 170, t, s0 + i * 0.35));
      });
      miniTitle(ctx, t, 3.6);
      const sz = Math.min(fit(ctx, c.l1, 150, 940), fit(ctx, c.l2, 150, 940));
      revealText(ctx, c.l1, W / 2, 620, sz, t, 1.1, 'burn');
      revealText(ctx, c.l2, W / 2, 620 + sz * 1.02, sz, t, 1.6, 'burn');
      neonLabel(ctx, c.l3, 620 + sz * 1.02 + 118, t, 2.2, { size: 104, tracking: 26, dur: 0.6 });
      kicker(ctx, c.prize, 620 + sz * 1.02 + 190, fadeA(t, 2.8), { color: BONE, glow: 0, size: 34, tracking: 8 });
      const pa = neonA(t, 3.3, 0.4);
      if (pa > 0) {
        const pulse = 1 + 0.025 * Math.sin(t * 5);
        ctx.save();
        camera(ctx, pulse, W / 2, 1515);
        ctx.globalAlpha = pa;
        ctx.strokeStyle = '#FF8A4C';
        ctx.lineWidth = 4;
        ctx.shadowColor = 'rgba(255,90,30,1)';
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.roundRect(W / 2 - 250, 1475, 500, 84, 42);
        ctx.stroke();
        ctx.restore();
        label(ctx, c.cta, W / 2, 1531, 40, { tracking: 10, alpha: pa, glow: 16, color: BONE });
      }
      ctx.restore();
    },
  });

  // ======================================================= 10 · EARLY BIRD SOLD OUT (12s)
  register({
    id: '10-early-bird-sold-out',
    duration: 12,
    cues: [
      neonCue(0.2, 0.6), neonCue(0.6, 0.6), { t: 1.5, type: 'slash' }, { t: 1.65, type: 'stamp' },
      neonCue(2.4, 0.4), { t: 4.0, type: 'glint', gain: 0.6 }, { t: 8.5, type: 'glint', gain: 0.5 },
    ],
    draw(ctx, t) {
      const c = C().earlyBirdSoldOut;
      withHits(ctx, t, [[1.5, 0.12], [1.65, 0.22]], () => {
        stickerSlot(ctx, t, 1265, 1);   // ticket link sits here from the first frame
        edgeLight(ctx, t, 0.5 * fadeA(t, 0, 0.6));
        miniTitle(ctx, t, 2.8);
        const dim = t < 1.5 ? 1 : lerp(1, 0.16, ease.out2(prog(t, 1.5, 1.8)));
        const s1 = fit(ctx, c.l1, 150, 900), s2 = fit(ctx, c.l2, 230, 960);
        ctx.save();
        ctx.globalAlpha = dim;
        revealText(ctx, c.l1, W / 2, 820, s1, t, 0.2, 'neon', { seed: 4, step: 0.05 });
        revealText(ctx, c.l2, W / 2, 1020, s2, t, 0.6, 'neon', { seed: 9, step: 0.06 });
        ctx.restore();
        // the knife cuts through the old offer
        const cut = ease.out3(prog(t, 1.5, 1.62));
        if (cut > 0) {
          const la = 1 - 0.6 * ease.out2(prog(t, 1.7, 2.3));
          const x0 = 60, y0 = 1060, x1 = 1020, y1 = 760;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = la;
          ctx.lineCap = 'round';
          ctx.shadowColor = 'rgba(255,90,40,1)';
          ctx.shadowBlur = 36;
          ctx.strokeStyle = 'rgba(255,120,60,0.95)';
          ctx.lineWidth = 12;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(lerp(x0, x1, cut), lerp(y0, y1, cut)); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,250,240,1)';
          ctx.lineWidth = 4;
          ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(lerp(x0, x1, cut), lerp(y0, y1, cut)); ctx.stroke();
          ctx.restore();
          if (cut < 1) glint(ctx, lerp(x0, x1, cut), lerp(y0, y1, cut), 240, 1);
        }
        // SOLD OUT! stamp presses down
        if (t >= 1.65) {
          const s = 1 + 0.3 * (1 - ease.out3(prog(t, 1.65, 1.85)));
          const sa = ease.out2(prog(t, 1.65, 1.75));
          const ss = fit(ctx, c.stamp, 170, 780);
          // centre on the real glyph bounds, over the middle of the old offer
          ctx.save();
          setFont(ctx, 'Copperplate', s1);
          const top = 820 - ctx.measureText(c.l1).actualBoundingBoxAscent;
          setFont(ctx, 'Copperplate', ss);
          ctx.textAlign = 'center';
          const m = ctx.measureText(c.stamp);
          ctx.restore();
          const gw = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
          const gh = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
          const gx = (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;   // glyph centre vs anchor
          const gy = (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2;
          const scx = W / 2, scy = (top + 1020) / 2;
          const padX = ss * 0.32, padY = ss * 0.26;
          ctx.save();
          ctx.translate(scx, scy);
          ctx.rotate(-0.12);
          ctx.scale(s, s);
          ctx.globalAlpha = sa;
          ctx.beginPath();
          ctx.roundRect(-gw / 2 - padX, -gh / 2 - padY, gw + padX * 2, gh + padY * 2, 22);
          ctx.fillStyle = 'rgba(12,3,2,0.88)';
          ctx.fill();
          ctx.shadowColor = 'rgba(255,40,20,0.9)';
          ctx.shadowBlur = 30;
          ctx.strokeStyle = '#FF3A22';
          ctx.lineWidth = 12;
          ctx.stroke();
          ctx.restore();
          ctx.save();
          ctx.translate(scx, scy);
          ctx.rotate(-0.12);
          ctx.scale(s, s);
          emberText(ctx, c.stamp, -gx, -gy, ss, { color: '#FF4A2E', stroke: '#FFF1E0', glow: 0.9 + 0.1 * flicker(t, 3), alpha: sa });
          ctx.restore();
        }
        neonLabel(ctx, c.sub, 1200, t, 2.4, { size: 44, tracking: 8, color: BONE });
        [4.0, 8.5].forEach((s0) => sparkle(ctx, 880, 780, 260, t, s0));
      }, { amp: 8 });
    },
  });

  // ======================================================= 11 · TICKETS ON SALE (10s)
  const TK = { x: 540 - 272 * 0.62, y: 430, s: 0.62 };
  register({
    id: '11-tickets-on-sale',
    duration: 10,
    cues: [
      { t: 0.3, type: 'whoosh', dur: 0.2 }, { t: 0.3, type: 'stab' }, { t: 0.45, type: 'ignite' },
      neonCue(0.6, 0.5), burnCue(0.9, 'TICKETS', 0.07), neonCue(1.6, 0.5), airCue(2.1),
      { t: 3.5, type: 'glint' }, { t: 7.5, type: 'glint', gain: 0.5 },
    ],
    draw(ctx, t) {
      const c = C().tickets;
      withHits(ctx, t, [[0.3, 0.18]], () => {
        stickerSlot(ctx, t, 1300, 1);   // ticket link sits here from the first frame
        ctx.save();
        drift(ctx, t, 10, 800, 0.025);
        edgeLight(ctx, t, 0.45 * fadeA(t, 0, 0.6));
        miniTitle(ctx, t, 0.6);
        const off = stab(t, 0.1, 0.3, 800);
        art(ctx, TK.x, TK.y, TK.s, { pumpkin: ignite(t, 0.45), h: ignite(t, 0.45, 3), knifeOffset: off, knifeAlpha: t >= 0.1 ? 1 : 0 });
        const [gx, gy] = artTip(TK.x, TK.y, TK.s, off);
        sparkle(ctx, gx, gy, 260, t, 0.3, { hold: 0.2 });
        [3.5, 7.5].forEach((s0) => sparkle(ctx, gx, gy, 320, t, s0, { hold: 0.2 }));
        revealText(ctx, c.l1, W / 2, 1100, fit(ctx, c.l1, 210, 960), t, 0.9, 'burn', { step: 0.07 });
        neonLabel(ctx, c.status, 1185, t, 1.6, { size: 64, tracking: 12 });
        kicker(ctx, c.cta, 1250, fadeA(t, 2.1), { color: BONE, glow: 0, size: 34, tracking: 8 });
        ctx.restore();
      });
    },
  });

  // ======================================================= 12 · WHAT ARE YOU GOING AS? (10s)
  const QA = { x: 540 - 272 * 0.55, y: 820, s: 0.55 };
  register({
    id: '12-what-are-you-going-as',
    duration: 10,
    cues: [
      neonCue(0.2, 0.7), burnCue(0.8, 'GOING AS?', 0.07), { t: 1.5, type: 'stab' }, { t: 1.6, type: 'ignite' },
      airCue(2.2), neonCue(2.6, 0.4), { t: 4.5, type: 'glint', gain: 0.6 }, { t: 8.0, type: 'glint', gain: 0.5 },
    ],
    draw(ctx, t) {
      const c = C().question;
      withHits(ctx, t, [[1.5, 0.15]], () => {
        stickerSlot(ctx, t, 1360, 1);   // question sticker sits here from the first frame
        ctx.save();
        drift(ctx, t, 10, 900, 0.025);
        edgeLight(ctx, t, 0.45 * fadeA(t, 0, 0.6));
        miniTitle(ctx, t, 2.6);
        const off = stab(t, 1.3, 1.5, 700);
        art(ctx, QA.x, QA.y, QA.s, { pumpkin: ignite(t, 1.6), h: ignite(t, 1.6, 3), knifeOffset: off, knifeAlpha: t >= 1.3 ? 1 : 0 });
        const sz = Math.min(fit(ctx, c.l1, 150, 940), fit(ctx, c.l2, 150, 940));
        revealText(ctx, c.l1, W / 2, 620, sz, t, 0.2, 'neon', { seed: 6, step: 0.05 });
        revealText(ctx, c.l2, W / 2, 620 + sz * 1.05, sz, t, 0.8, 'burn', { step: 0.07 });
        revealText(ctx, c.sub, W / 2, 1320, fit(ctx, c.sub, 42, 900, 'Figtree', 10, '800'), t, 2.2, 'fade', { family: 'Figtree', weight: '800', tracking: 10, glow: 0.4 });
        const [gx, gy] = artTip(QA.x, QA.y, QA.s, off);
        [4.5, 8.0].forEach((s0) => sparkle(ctx, gx, gy, 260, t, s0));
        ctx.restore();
      });
    },
  });

  // ======================================================= 13 · LAST CALL (10s)
  register({
    id: '13-last-call',
    duration: 10,
    cues: [
      { t: 0.05, type: 'heart' }, neonCue(0.5, 0.8), neonCue(1.5, 0.4), airCue(2.0),
      { t: 3.4, type: 'heart' }, { t: 4.5, type: 'glint', gain: 0.6 }, { t: 6.6, type: 'heart' }, { t: 8.3, type: 'glint', gain: 0.5 },
    ],
    draw(ctx, t) {
      const c = C().lastCall;
      const beat = (t0) => (t >= t0 ? Math.exp(-(t - t0) * 7) : 0);
      const pulse = 0.3 * (beat(0.05) + beat(0.31) + beat(3.4) + beat(3.66) + beat(6.6) + beat(6.86));
      stickerSlot(ctx, t, 1230, 1);   // ticket link sits here from the first frame
      ctx.save();
      drift(ctx, t, 10, 1000, 0.03);
      edgeLight(ctx, t, ease.inOut2(prog(t, 0, 0.5)) * 0.8 + pulse);
      miniTitle(ctx, t, 2.4);
      revealText(ctx, c.l1, W / 2, 1000, fit(ctx, c.l1, 230, 960), t, 0.5, 'neon', { seed: 7, step: 0.07 });
      neonLabel(ctx, c.l2, 1100, t, 1.5, { size: 62, tracking: 16 });
      kicker(ctx, c.sub, 1170, fadeA(t, 2.0), { color: BONE, glow: 0, size: 34, tracking: 6 });
      [4.5, 8.3].forEach((s0) => sparkle(ctx, 900, 820, 280, t, s0));
      ctx.restore();
    },
  });

  // ======================================================= 14 · TONIGHT (12s)
  function tonightA(ctx, t) {
    const c = C().tonight;
    const beat = (t0) => (t >= t0 ? Math.exp(-(t - t0) * 7) : 0);
    const pulse = 0.3 * (beat(0.05) + beat(0.31));
    edgeLight(ctx, t, ease.inOut2(prog(t, 0, 0.5)) + pulse);
    revealText(ctx, c.headline, W / 2, 1040, fit(ctx, c.headline, 230, 960), t, 0.45, 'burn', { step: 0.08 });
    neonLabel(ctx, c.sub, 1165, t, 1.4, { size: 48, tracking: 16, color: BONE });
    kicker(ctx, c.place, 1230, fadeA(t, 1.8), { size: 32, tracking: 10 });
    const la = fadeA(t, 2.2, 0.8);
    logo(ctx, W / 2, 1380, 400, la, 0.2 + 0.3 * la * Math.exp(-(t - 2.2) * 2));
  }
  register({
    id: '14-tonight',
    duration: 12,
    cues: [
      { t: 0.05, type: 'heart' }, burnCue(0.45, 'TONIGHT.', 0.08), neonCue(1.4, 0.4), airCue(1.8), airCue(2.2),
      { t: 3.8, type: 'slash' }, { t: 4.6, type: 'glint' }, { t: 7.5, type: 'glint', gain: 0.5 }, { t: 10.5, type: 'glint', gain: 0.5 },
    ],
    draw(ctx, t) {
      const lock = (c) => lockup(c, t, { footerText: C().tonight.footer });
      withHits(ctx, t, [[3.8, 0.15]], () => {
        if (t < 3.8) return tonightA(ctx, t);
        if (t < 4.4) return slashWipe(ctx, scene(0, (c) => tonightA(c, t)), scene(1, lock), prog(t, 3.8, 4.4));
        ctx.save();
        drift(ctx, t - 4.4, 7.6, 900, 0.03);
        lock(ctx);
        const [gx, gy] = artTip(LOCK.art.x, LOCK.art.y, LOCK.art.s);
        glint(ctx, gx, gy, 330, Math.max(0.25, flare(t, 4.6, 0.9, 0.25), flare(t, 7.5, 0.9, 0.25), flare(t, 10.5, 0.9, 0.25)));
        ctx.restore();
      });
    },
  });

  // countdowns register after content.json loads; keep ids in story order
  window.HH_registerCountdowns = () => {
    const all = Object.assign({}, window.HH.CARDS);
    Object.keys(window.HH.CARDS).forEach((k) => delete window.HH.CARDS[k]);
    const cds = C().countdown.map(countdownCard);
    Object.keys(all).sort().forEach((k) => {
      if (k > '05' && cds.length) while (cds.length) register(cds.shift());
      register(all[k]);
    });
    cds.forEach(register);
  };
})();
