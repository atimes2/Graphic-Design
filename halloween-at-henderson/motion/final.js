/* Day-of final push (Oct 31): two stories, pick one.
 *
 *  22 · FINAL CALL: TONIGHT  the Tonight card's opening, a knife-slash cut, then
 *       a counter drops fast from 99 and lands on 50 as LESS THAN 50 TICKETS
 *       REMAINING. A heartbeat that keeps speeding up drives the light, the
 *       numeral's glow and a small camera bump; the details scroll in a marquee.
 *  23 · FINAL CALL: EXTRA    the archival cut. A 1950 newsboy shouts, the presses
 *       roll, and a front page spins in: LESS THAN 50 TICKETS LEFT, then an
 *       ALMOST SOLD OUT stamp lands on it. Footage: Newspaper Story (1950,
 *       Prelinger, public domain; reel/SOURCES.md), clips ns_* in reel/footage.json.
 *
 * Both are 1080x1920 stories with the ticket-link slot on screen from frame 0.
 * Copy lives in content.json -> finalTonight / finalExtra.
 */
(function () {
  const {
    W, H, clamp, lerp, prog, ease, flicker, neon, hash, vnoise, A, canvas, glint, sparkle, setFont, fit,
    emberText, label, kicker, revealText, neonLabel, stickerSlot, title, scene, slashWipe, shakeAt, flash,
    edgeLight, camera, register,
  } = window.HH;
  const R = window.HH_REEL;
  const BONE = '#FFF1E0';
  const C = () => A.content;
  const fadeA = (t, t0, d = 0.7) => ease.out2(prog(t, t0, t0 + d));
  const neonA = (t, t0, d = 0.4) => neon(prog(t, t0, t0 + d));
  const titleLit = (t, a = 1) => () => ({ ember: a * (0.92 + 0.08 * flicker(t, 9)), fill: a });
  const miniTitle = (ctx, t, t0, y, s = 0.62) => {
    const a = neonA(t, t0, 0.5);
    if (a > 0) title(ctx, W / 2 - 433 * s, y, s, titleLit(t, a));
  };
  const SLOT = { y: 1400, h: 150 };

  // heartbeat: double pulses, each gap shorter than the last (start, first gap, floor)
  function beats(t0, gap0, floor, end) {
    const out = [];
    for (let t = t0, gap = gap0; t < end; t += gap, gap = Math.max(floor, gap * 0.9)) out.push(t, t + 0.24);
    return out;
  }
  const pulseAt = (t, list, k = 7) => list.reduce((s, b) => s + (t >= b ? Math.exp(-(t - b) * k) : 0), 0);

  // ================================================== 22 · FINAL CALL: TONIGHT (13s)
  const FT = {
    cut: 2.3, cutDur: 0.5,
    l1: 2.55, roll0: 2.7, roll1: 3.85, land: 3.85, l2: 3.95, l3: 4.5, marquee: 4.6, title: 4.8,
    y: { title: 272, band: 452, l1: 652, base: 1118, l2: 1262, l3: 1338 },
    num: 540,
  };
  const FT_BEATS = [0.05, 0.29, ...beats(FT.land, 1.25, 0.62, 13)];

  function tonightOpen(ctx, t) {
    const c = C().finalTonight;
    const pulse = 0.3 * pulseAt(t, [0.05, 0.29, 1.3, 1.54]);
    edgeLight(ctx, t, ease.inOut2(prog(t, 0, 0.4)) + pulse);
    revealText(ctx, c.headline, W / 2, 1010, fit(ctx, c.headline, 240, 960), t, 0.15, 'burn', { step: 0.06 });
    neonLabel(ctx, c.sub, 1132, t, 0.9, { size: 50, tracking: 16, color: BONE });
    kicker(ctx, c.place, 1200, fadeA(t, 1.2), { size: 32, tracking: 10 });
  }

  // the counter: Lobster numerals, candle-gold, glowing harder as it lands
  function numeral(ctx, str, size, base, heat, alpha = 1) {
    if (alpha <= 0.001) return;
    ctx.save();
    setFont(ctx, 'Lobster', size);
    ctx.textAlign = 'center';
    const cy = base - size * 0.36;
    const g = ctx.createRadialGradient(540, cy - size * 0.05, 30, 540, cy, size * 0.62);
    g.addColorStop(0, `rgba(255,246,216,${alpha})`);
    g.addColorStop(0.45, `rgba(255,210,122,${alpha})`);
    g.addColorStop(0.8, `rgba(242,138,44,${alpha})`);
    g.addColorStop(1, `rgba(200,70,26,${alpha})`);
    ctx.shadowColor = 'rgba(255,96,30,1)';
    ctx.shadowBlur = size * (0.06 + 0.12 * heat);
    ctx.fillStyle = g;
    ctx.fillText(str, 540, base);
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-atop';
    ctx.lineWidth = size / 30;
    ctx.strokeStyle = `rgba(150,40,8,${0.7 * alpha})`;
    ctx.strokeText(str, 540, base);
    ctx.restore();
    if (heat > 0.05) {   // bloom
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(0.4 * heat * alpha);
      ctx.filter = `blur(${Math.round(size / 14)}px)`;
      setFont(ctx, 'Lobster', size);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FF7A2E';
      ctx.fillText(str, 540, base);
      ctx.restore();
    }
  }

  function counter(ctx, t, beatK) {
    const c = C().finalTonight;
    if (t < FT.roll0) return;
    const p = ease.out3(prog(t, FT.roll0, FT.roll1));
    const v = Math.round(lerp(c.from, c.num, p));
    const size = Math.min(FT.num, fit(ctx, String(c.from), FT.num, 760, 'Lobster'));
    const rolling = t < FT.roll1;
    // each new number drops in from above; the last one leaves a ghost
    const stepP = rolling ? (lerp(c.from, c.num, p) - v + 0.5) : 0;
    const dy = rolling ? -stepP * size * 0.1 : 0;
    const land = t >= FT.land ? Math.exp(-(t - FT.land) * 3) : 0;
    const heat = rolling ? 0.35 : 0.75 + 0.15 * flicker(t, 21) + 0.6 * land + 0.35 * beatK;
    if (rolling) numeral(ctx, String(v + 1), size, FT.y.base - size * 0.16 + dy, 0.2, 0.18);
    ctx.save();
    const s = 1 + 0.06 * land + 0.012 * beatK;
    camera(ctx, s, 540, FT.y.base - size * 0.36);
    numeral(ctx, String(v), size, FT.y.base + dy, heat, rolling ? 0.85 : 1);
    ctx.restore();
    return size;
  }

  // details scrolling between two hairlines
  function marquee(ctx, t, y, a) {
    if (a <= 0.001) return;
    const c = C().finalTonight;
    const h = 62;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(255,241,224,0.25)';
    ctx.fillRect(60, y, W - 120, 1.5);
    ctx.fillRect(60, y + h, W - 120, 1.5);
    ctx.beginPath();
    ctx.rect(60, y, W - 120, h);
    ctx.clip();
    setFont(ctx, 'Figtree', 28, '800');
    ctx.letterSpacing = '9px';
    const unit = `${c.marquee}  ·  `;
    const uw = ctx.measureText(unit).width;
    let x = 60 - ((t * 110) % uw);
    ctx.fillStyle = '#FF8A4C';
    ctx.shadowColor = 'rgba(255,90,30,0.9)';
    ctx.shadowBlur = 14;
    ctx.textBaseline = 'middle';
    for (; x < W; x += uw) ctx.fillText(unit, x, y + h / 2 + 1);
    ctx.restore();
  }

  function tonightMain(ctx, t) {
    const c = C().finalTonight;
    const beatK = pulseAt(t, FT_BEATS.filter((b) => b >= FT.land));
    edgeLight(ctx, t, 0.5 + 0.3 * pulseAt(t, FT_BEATS));
    neonLabel(ctx, c.l1, FT.y.l1, t, FT.l1, { size: 92, tracking: 14, color: BONE });
    const size = counter(ctx, t, beatK);
    revealText(ctx, c.l2, W / 2, FT.y.l2, fit(ctx, c.l2, 150, 900), t, FT.l2, 'burn', { step: 0.06, color: '#FF4A2E', stroke: '#FFF1E0' });
    neonLabel(ctx, c.l3, FT.y.l3, t, FT.l3, { size: 54, tracking: 22 });
    marquee(ctx, t, FT.y.band, fadeA(t, FT.marquee, 0.5));
    miniTitle(ctx, t, FT.title, FT.y.title);
    if (size) [FT.land, 7.5, 10.8].forEach((s0) => sparkle(ctx, 760, FT.y.base - size * 0.68, 300, t, s0, { hold: 0.15 }));
  }

  register({
    id: '22-final-call-tonight',
    duration: 13,
    cues: [],
    draw(ctx, t) {
      stickerSlot(ctx, t, SLOT.y, 1, { h: SLOT.h });   // ticket link sits here from the first frame
      const [dx, dy] = shakeAt(t, [FT.cut], 9);
      ctx.save();
      ctx.translate(dx, dy);
      if (t < FT.cut) tonightOpen(ctx, t);
      else if (t < FT.cut + FT.cutDur) {
        slashWipe(ctx, scene(0, (c) => tonightOpen(c, t), true), scene(1, (c) => tonightMain(c, t), true), prog(t, FT.cut, FT.cut + FT.cutDur));
      } else {
        ctx.save();
        camera(ctx, lerp(1.0, 1.03, ease.inOut2(prog(t, FT.cut, 13))), W / 2, 960);
        tonightMain(ctx, t);
        ctx.restore();
      }
      ctx.restore();
      flash(ctx, t, FT.cut, 0.12);
      flash(ctx, t, FT.land, 0.1, '255,140,60');
    },
  });

  // ================================================== 23 · FINAL CALL: EXTRA (14s)
  const EX = {
    shots: [
      { t0: 0.0, t1: 1.8, clip: 'ns_shout', push: 0.06 },
      { t0: 1.8, t1: 2.35, clip: 'ns_rollers' },
      { t0: 2.35, t1: 2.9, clip: 'ns_run' },
      { t0: 2.9, t1: 3.45, clip: 'ns_fly' },
      { t0: 3.45, t1: 4.0, clip: 'ns_line' },
      { t0: 4.0, t1: 4.65, clip: 'ns_stack', at: 0.3 },
      { t0: 4.65, t1: 6.4, clip: 'ns_wave', at: 0.5, push: 0.05 },
    ],
    spin0: 6.4, land: 7.3, stamp: 8.3,
    paper: { w: 900, h: 1180, cx: 540, cy: 832, s: 0.9, rot: -3.2 },
  };
  const EX_FOOT_END = EX.shots[EX.shots.length - 1].t1;
  const exShot = (t) => EX.shots.find((s) => t >= s.t0 && t < s.t1) || null;
  const exURL = (s, t) => R.frameURL(s, 'mono', t - s.t0);

  // captions over the film: a dark band, then big ember type
  function exCaption(ctx, t, cap) {
    if (t < cap.t0 || t > cap.t1) return;
    const out = 1 - ease.in2(prog(t, cap.t1 - 0.12, cap.t1));
    const lines = cap.h.split('\n');
    const size = Math.min(...lines.map((l) => fit(ctx, l, cap.size ?? 170, 940)));
    const base = cap.base ?? 1300;
    const ys = lines.map((_, i) => base - (lines.length - 1 - i) * size * 1.0);
    ctx.save();
    ctx.globalAlpha = out;
    R.textBand(ctx, ys[0] - size * 1.6, base + 70, 0.66);
    if (cap.k) kicker(ctx, cap.k, ys[0] - size * 0.98, neonA(t, cap.t0, 0.3), { size: 36, tracking: 12, glow: 22 });
    lines.forEach((l, i) => {
      if (cap.instant) {
        const st = cap.t0 + i * (cap.gap ?? 0);
        if (t < st) return;
        const k = Math.exp(-(t - st) * 9);
        ctx.save();
        camera(ctx, 1 + 0.18 * k, W / 2, ys[i] - size * 0.35);
        emberText(ctx, l, W / 2, ys[i], size, { glow: 0.95 + 0.6 * k });
        ctx.restore();
      } else revealText(ctx, l, W / 2, ys[i], size, t, cap.t0 + 0.05 + i * 0.15, cap.style || 'neon', { step: 0.02, seed: i + 5, dur: 0.3 });
    });
    ctx.restore();
  }

  // ---- the front page, drawn once into its own canvas
  let paperC = null;
  const INK = '#1C1612', RED = '#B4261C';
  function paperText(x, str, px, py, size, o = {}) {
    setFont(x, o.family || 'Copperplate', size, o.weight || '');
    x.letterSpacing = `${o.tracking ?? 0}px`;
    x.textAlign = o.align || 'center';
    x.fillStyle = o.color || INK;
    x.fillText(str, px, py);
    x.letterSpacing = '0px';
  }
  function fauxLines(x, x0, y0, w, n, seed) {
    x.fillStyle = 'rgba(28,22,18,0.34)';
    for (let i = 0; i < n; i++) {
      const lw = i === n - 1 ? w * (0.35 + 0.4 * hash(seed + i)) : w * (0.9 + 0.1 * hash(seed + i * 3.3));
      x.fillRect(x0, y0 + i * 17, lw, 7);
    }
  }
  function buildPaper() {
    const c = C().finalExtra;
    const { w: PW, h: PH } = EX.paper;
    const cv = canvas(PW, PH);
    const x = cv.getContext('2d');
    // newsprint: warm stock, fibre noise, darker edges
    x.fillStyle = '#EDE3CE';
    x.fillRect(0, 0, PW, PH);
    const d = x.getImageData(0, 0, PW, PH);
    for (let i = 0; i < d.data.length; i += 4) {
      const n = (hash(i * 0.37) - 0.5) * 18;
      d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n;
    }
    x.putImageData(d, 0, 0);
    const v = x.createRadialGradient(PW / 2, PH / 2, PH * 0.3, PW / 2, PH / 2, PH * 0.75);
    v.addColorStop(0, 'rgba(90,60,30,0)');
    v.addColorStop(1, 'rgba(90,60,30,0.32)');
    x.fillStyle = v;
    x.fillRect(0, 0, PW, PH);
    const M = 46, CW = PW - M * 2;
    // ears + masthead
    paperText(x, c.earL, M, 58, 16, { family: 'Figtree', weight: '800', tracking: 3, align: 'left' });
    paperText(x, c.earR, PW - M, 58, 16, { family: 'Figtree', weight: '800', tracking: 3, align: 'right' });
    setFont(x, 'Copperplate', 92);
    const mh = Math.min(92, Math.floor(92 * (CW - 20) / x.measureText(c.masthead).width));
    paperText(x, c.masthead, PW / 2, 138, mh);
    x.fillStyle = INK;
    x.fillRect(M, 152, CW, 5);
    x.fillRect(M, 162, CW, 1.5);
    paperText(x, c.dateline, PW / 2, 190, 17, { family: 'Figtree', weight: '800', tracking: 4 });
    x.fillRect(M, 205, CW, 1.5);
    // headline: LESS THAN [50] / TICKETS LEFT!
    const hs = Math.min(fit(x, `${c.h1a}${c.h1b}`, 170, CW), fit(x, c.h2, 170, CW));
    setFont(x, 'Copperplate', hs);
    const wa = x.measureText(c.h1a).width, wb = x.measureText(c.h1b).width;
    const hx = PW / 2 - (wa + wb) / 2;
    paperText(x, c.h1a, hx, 222 + hs * 0.82, hs, { align: 'left' });
    paperText(x, c.h1b, hx + wa, 222 + hs * 0.82, hs, { align: 'left', color: RED });
    paperText(x, c.h2, PW / 2, 222 + hs * 1.72, hs);
    const yS = 222 + hs * 1.72 + 52;
    const ss = fit(x, c.sub, 30, CW, 'Figtree', 1, '800');
    paperText(x, c.sub, PW / 2, yS, ss, { family: 'Figtree', weight: '800', tracking: 1 });
    x.fillRect(M, yS + 22, CW, 1.5);
    // photo: the poster art, in halftone-ish grey
    const top = yS + 44, colW = 430, ph = 470;
    x.fillStyle = '#17110D';
    x.fillRect(M, top, colW, ph);
    x.save();
    x.beginPath(); x.rect(M, top, colW, ph); x.clip();
    x.filter = 'grayscale(1) contrast(1.35) brightness(1.15)';
    const art = A.img.art, as = (ph * 1.02) / art.height;
    x.drawImage(art, M + colW / 2 - (art.width * as) / 2, top - 4, art.width * as, art.height * as);
    x.filter = 'none';
    x.fillStyle = 'rgba(237,227,206,0.18)';   // coarse screen
    for (let yy = top; yy < top + ph; yy += 5) x.fillRect(M, yy, colW, 1.2);
    x.restore();
    paperText(x, c.photo, M, top + ph + 26, 14, { family: 'Figtree', weight: '800', tracking: 2, align: 'left' });
    // right column: the night in subheads
    const rx = M + colW + 30, rw = CW - colW - 30;
    let ry = top + 26;
    c.items.forEach((it, i) => {
      const sz = fit(x, it, 30, rw);
      paperText(x, it, rx, ry, sz, { align: 'left' });
      fauxLines(x, rx, ry + 18, rw, i === 0 ? 4 : 3, i * 17);
      ry += i === 0 ? 112 : 96;
    });
    // foot
    const fy = top + ph + 62;
    x.fillStyle = INK;
    x.fillRect(M, fy, CW, 1.5);
    const fs = fit(x, c.foot, 48, CW);
    paperText(x, c.foot, PW / 2, fy + 60, fs);
    fauxLines(x, M, fy + 92, CW / 2 - 15, 5, 91);
    fauxLines(x, PW / 2 + 15, fy + 92, CW / 2 - 15, 5, 47);
    // the fold
    const fold = x.createLinearGradient(0, PH / 2 - 14, 0, PH / 2 + 14);
    fold.addColorStop(0, 'rgba(60,40,20,0)');
    fold.addColorStop(0.5, 'rgba(60,40,20,0.14)');
    fold.addColorStop(1, 'rgba(255,250,240,0)');
    x.fillStyle = fold;
    x.fillRect(0, PH / 2 - 14, PW, 28);
    return cv;
  }

  // rotating newsreel sunburst behind the paper
  function sunburst(ctx, t, a) {
    if (a <= 0.001) return;
    ctx.save();
    ctx.translate(EX.paper.cx, EX.paper.cy);
    ctx.rotate(t * 0.12);
    ctx.globalCompositeOperation = 'lighter';
    const n = 24;
    for (let i = 0; i < n; i += 2) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      const g = ctx.createRadialGradient(0, 0, 80, 0, 0, 1300);
      g.addColorStop(0, `rgba(226,74,22,${0.22 * a})`);
      g.addColorStop(1, 'rgba(226,74,22,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 1400, a0, a1); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // ALMOST SOLD OUT, inked in red at an angle, slammed onto the page
  function stamp(ctx, t, x, y) {
    const c = C().finalExtra;
    if (t < EX.stamp) return;
    const k = 1 - ease.outExpo(prog(t, EX.stamp, EX.stamp + 0.14));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.21);
    ctx.scale(1 + 0.9 * k, 1 + 0.9 * k);
    ctx.globalAlpha = 0.88 * (1 - 0.6 * k);
    const sw = 380, sh = 168;
    ctx.strokeStyle = RED;
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.roundRect(-sw / 2, -sh / 2, sw, sh, 14); ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(-sw / 2 + 12, -sh / 2 + 12, sw - 24, sh - 24, 8); ctx.stroke();
    const ss = Math.min(fit(ctx, c.stamp1, 66, sw - 60), fit(ctx, c.stamp2, 66, sw - 60));
    setFont(ctx, 'Copperplate', ss);
    ctx.textAlign = 'center';
    ctx.fillStyle = RED;
    ctx.fillText(c.stamp1, 0, -6);
    ctx.fillText(c.stamp2, 0, ss * 0.95 - 6);
    // worn ink: knock a few specks out of the stamp
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 70; i++) {
      ctx.globalAlpha = 0.5 * hash(i * 3.1);
      ctx.fillRect((hash(i * 1.7) - 0.5) * sw, (hash(i * 2.9) - 0.5) * sh, 3 + 6 * hash(i), 2 + 3 * hash(i * 5));
    }
    ctx.restore();
  }

  function frontPage(ctx, t) {
    if (!paperC) paperC = buildPaper();
    const P = EX.paper;
    const p = ease.out3(prog(t, EX.spin0, EX.land));
    const lt = t - EX.land;
    edgeLight(ctx, t, 0.35 + 0.45 * fadeA(t, EX.land, 0.5));
    sunburst(ctx, t, fadeA(t, EX.spin0, 0.8));
    const s = lerp(0.04, P.s, p) * (1 + 0.035 * ease.inOut2(clamp(lt / 6.5)));
    const rot = lerp(-720, P.rot, p) * (Math.PI / 180);
    ctx.save();
    ctx.translate(P.cx, P.cy);
    ctx.rotate(rot);
    ctx.scale(s, s);
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 20;
    ctx.drawImage(paperC, -P.w / 2, -P.h / 2);
    ctx.shadowColor = 'transparent';
    stamp(ctx, t, 225, 300);
    ctx.restore();
    if (t >= EX.land) {
      const tx = P.cx + (P.w / 2 - 30) * P.s, ty = P.cy - (P.h / 2 - 30) * P.s;
      [EX.land, 10.0, 12.6].forEach((s0) => sparkle(ctx, tx, ty, 300, t, s0, { hold: 0.15 }));
    }
  }

  register({
    id: '23-final-call-extra',
    duration: 14,
    cues: [],
    async prepare(t) {
      await R.footIndex();
      const s = exShot(t);
      if (s) await R.getImg(exURL(s, t)).p;
    },
    draw(ctx, t) {
      const c = C().finalExtra;
      const hits = [EX.land, EX.stamp];
      const [dx, dy] = shakeAt(t, hits, 11);
      ctx.save();
      ctx.translate(dx, dy);
      if (t < EX_FOOT_END) {
        const s = exShot(t);
        const e = s && R.getImg(exURL(s, t));
        R.drawFull(ctx, t, e && e.ok ? e.im : null, { lt: t - s.t0, push: s.push ?? 0.08, exposure: 1.05 });
        EX.shots.forEach((sh) => { if (sh.t0 > 0) flash(ctx, t, sh.t0, 0.16, '255,236,210'); });
        c.caps.forEach((cap) => exCaption(ctx, t, cap));
        // the whip out of the footage into the spinning page
        if (t > EX_FOOT_END - 0.25) {
          ctx.fillStyle = `rgba(5,3,3,${ease.in2(prog(t, EX_FOOT_END - 0.25, EX_FOOT_END))})`;
          ctx.fillRect(0, 0, W, H);
        }
      } else frontPage(ctx, t);
      ctx.restore();
      hits.forEach((h, i) => flash(ctx, t, h, i ? 0.12 : 0.2));
      stickerSlot(ctx, t, SLOT.y + 20, 1, { h: SLOT.h - 20 });   // ticket link sits here from the first frame
    },
  });
})();
