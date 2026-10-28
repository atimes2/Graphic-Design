/* 20 · TURN BACK THE CLOCKS (14s story, 1080x1920)
 *
 * The clocks go back an hour on the night of the party (2am becomes 1am), so
 * Halloween gets an extra hour. Told like the collab Reels, as an old movie:
 *   0.0  one continuous take of Harold Lloyd hanging off the clock in Safety
 *        Last! (1923), ember grade: TURN BACK / THE CLOCKS from frame 0, then
 *        EXTRA HOUR / OF HALLOWEEN at 2.2s while the clock face gives way under him
 *   4.8  the midnight tower clock from The Phantom Carriage (1921), its hands
 *        redrawn (prep_clock.py): it ticks to 2:00, the film slips in the gate
 *        and the hands wind back a full hour to 1:00, the reading underneath
 *   7.2  the poster, held to the end and fully built by ~9s: knife, pumpkin
 *        ignites, title burns, lasers, the date, PRICES GO UP TOMORROW on an
 *        ember bar, the Henderson wordmark. The ticket-link sticker slot is on
 *        screen the whole time. No header strip: Instagram's bar covers the top.
 * Footage: reel/footage.json → clock_hang, _excerpts.pc_clock (prep_footage.py).
 */
(function () {
  const {
    W, clamp, lerp, prog, ease, flicker, hash, vnoise, A, canvas, setFont, fit,
    emberText, label, kicker, revealText, stickerSlot, glint, sparkle, shakeAt, flash,
    art, artTip, artH, logo, register,
  } = window.HH;
  const R = window.HH_REEL;
  const { BONE, FPS, footIndex, getImg, frameURL, dust } = R;
  const P = () => window.HH_PARTS;
  const C = () => A.content.clocks;
  const EMBER = '#E0301E', PUMPKIN = '#FF8A4C', VOID = '#050303';

  const BOX = { x: 0, y: 300, w: 1080, h: 1060 };   // the film, below Instagram's header
  const ML = 70;                                     // left margin for the big words
  const SLOT_Y = 1425, SLOT_H = 120;                 // ticket-link sticker slot (inside the bottom safe zone)
  const T = { words2: 2.2, clock: 4.8, end: 7.2, dur: 14 };   // the message is in by 2.2s; the poster holds 6.8s
  const GRADE = 'ember';
  const SHOT = { t0: 0, t1: T.clock, clip: 'clock_hang', at: 0 };
  // the tower clock, in seconds after T.clock
  const CK = { ticks: [0.3, 0.65], rw0: 0.95, rw1: 1.95 };   // 1:58 → 1:59 → 2:00, then winds back to 1:00
  const STRIKE = CK.ticks[CK.ticks.length - 1];

  // ------------------------------------------------------------ the film
  // the projected frame: cover-fit, slow push, gate weave, exposure flicker, dust, vignette
  function film(ctx, t, s) {
    const e = getImg(frameURL(s, GRADE, t - s.t0));
    const r = BOX;
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.fillStyle = '#070404';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    if (e.ok) {
      const im = e.im;
      const z = Math.max(r.w / im.width, r.h / im.height) * (1.03 + 0.02 * (t - s.t0));
      const wx = (vnoise(t * 7.3) - 0.5) * 4, wy = (vnoise(t * 5.1 + 30) - 0.5) * 5;
      ctx.filter = `brightness(${(0.94 + 0.08 * vnoise(t * 21 + 3)).toFixed(3)})`;
      ctx.drawImage(im, r.x + (r.w - im.width * z) / 2 + wx, r.y + (r.h - im.height * z) / 2 + wy, im.width * z, im.height * z);
      ctx.filter = 'none';
    }
    dust(ctx, t, r, 1.1);
    const v = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, r.h * 0.3, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.75);
    v.addColorStop(0, 'rgba(5,3,3,0)');
    v.addColorStop(1, 'rgba(5,3,3,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    // darken the foot so the words read over any frame
    const g = ctx.createLinearGradient(0, r.y + r.h * 0.45, 0, r.y + r.h);
    g.addColorStop(0, 'rgba(5,3,3,0)');
    g.addColorStop(1, 'rgba(5,3,3,0.82)');
    ctx.fillStyle = g;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }

  // two big words in the poster's Copperplate on the foot of the film; in at t0, out at t1
  function bigWords(ctx, t, words, t0, t1, o = {}) {
    if (t < t0 || t > t1) return;
    const out = 1 - ease.in2(prog(t, t1 - 0.15, t1));
    const size = Math.min(...words.map((w) => fit(ctx, w, 196, 940, 'Copperplate', 1)));
    const base = BOX.y + BOX.h - 50;
    words.forEach((w, i) => {
      const st = t0 + i * 0.16;
      if (t < st) return;
      const p = o.instant ? 1 : ease.out3(prog(t, st, st + 0.22));
      label(ctx, w, ML, base - (words.length - 1 - i) * size * 1.0 + (1 - p) * 16, size, {
        family: 'Copperplate', weight: '', tracking: 1, align: 'left', color: i ? PUMPKIN : BONE, alpha: p * out,
      });
    });
  }

  // ------------------------------------------------------- the tower clock
  // (the 1921 dial with its painted hands removed; the hands drawn here keep the
  // film's measured profile so they turn like the real ones)
  const DIAL = { cy: 470, s: 0.74 };   // dial centre inside the box, scale of the 1142px dial image
  // minutes past midnight at clock time lt
  function clockT(lt) {
    if (lt >= CK.rw0) return 120 - 60 * ease.inOut3(prog(lt, CK.rw0, CK.rw1));
    return 118 + CK.ticks.reduce((m, k) => m + ease.out3(prog(lt, k, k + 0.12)), 0);
  }
  let HAND = null;
  function handShape() {
    if (HAND) return HAND;
    const raw = A.meta.clock.hand.filter(([d]) => d <= 0.54);
    HAND = raw.map((_, i) => {
      const win = raw.slice(Math.max(0, i - 9), i + 10);
      return [raw[i][0], win.reduce((s, p) => s + p[1], 0) / win.length];
    });
    return HAND;
  }
  // a hand along angle a (0 = XII, clockwise), len in dial px
  function hand(c, a, len, widthK, alpha) {
    const prof = handShape();
    const d0 = prof[prof.length - 1][0];
    const sc = len / 0.86;
    const side = prof.map(([d, hw]) => [d * sc, hw * widthK]);
    const wEnd = prof[prof.length - 1][1] * widthK, dEnd = d0 * sc;
    [[0.25, 0.55], [0.55, 0.42], [0.72, 0.95], [0.8, 0.6], [0.92, 0.22], [1.0, 0]].forEach(([q, k]) => side.push([lerp(dEnd, len, q), wEnd * k]));
    c.save();
    c.rotate(a);
    c.globalAlpha = alpha;
    c.beginPath();
    side.forEach(([d, hw], i) => (i ? c.lineTo(hw, -d) : c.moveTo(hw, -d)));
    for (let i = side.length - 1; i >= 0; i--) c.lineTo(-side[i][1], -side[i][0]);
    c.closePath();
    c.fill();
    c.restore();
  }
  const clockBuf = canvas(BOX.w, BOX.h);
  function clockScene(lt) {
    const M = A.meta.clock, im = A.img.clock_dial;
    const c = clockBuf.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.filter = 'none';
    c.fillStyle = VOID;
    c.fillRect(0, 0, BOX.w, BOX.h);
    const s = DIAL.s * lerp(0.96, 1.04, ease.inOut2(prog(lt, 0, T.end - T.clock)));   // looms a little closer
    // the film slips in the gate while the hands wind back: the frame rolls
    const slip = prog(lt, CK.rw0 - 0.05, CK.rw1 + 0.05);
    const roll = slip > 0 && slip < 1 ? ((ease.inOut2(slip) * 3.0) % 1) * BOX.h : 0;
    const shake = lt >= STRIKE ? Math.exp(-(lt - STRIKE) * 12) * 6 : 0;
    const draw = (oy) => {
      c.save();
      c.translate(BOX.w / 2 + (vnoise(lt * 31) - 0.5) * shake, DIAL.cy + oy + (vnoise(lt * 29 + 7) - 0.5) * shake);
      c.scale(s, s);
      c.drawImage(im, -M.center[0], -M.center[1]);
      const [rx, ry] = M.radius;
      c.scale(1, ry / rx);
      c.translate(M.offset * rx, 0);
      c.fillStyle = `rgb(${M.ink.join(',')})`;
      c.filter = 'blur(1.4px)';
      const winding = lt > CK.rw0 && lt < CK.rw1;
      const ghosts = winding ? 7 : 1;
      for (let g = ghosts - 1; g >= 0; g--) {
        const Tg = clockT(lt - g * 0.01);
        const a = g ? 0.16 : 1;
        hand(c, (Tg / 720) * Math.PI * 2, 0.52 * rx, 0.78 * rx, a);
        hand(c, (Tg / 60) * Math.PI * 2, 0.84 * rx, 0.72 * rx, a);
      }
      c.beginPath();
      c.arc(0, 0, 0.06 * rx, 0, Math.PI * 2);
      c.fill();
      c.restore();
    };
    if (roll) {
      draw(roll - BOX.h);
      draw(roll);
      c.fillStyle = VOID;   // the frame line rolling through
      c.fillRect(0, roll - 22, BOX.w, 44);
    } else draw(0);
    return clockBuf;
  }
  // the clock scene through the projector: weave, exposure, dust, vignette
  function clockFilm(ctx, t, lt) {
    const r = BOX;
    const ex = 1.05 + (lt >= STRIKE ? 0.25 * Math.exp(-(lt - STRIKE) * 6) : 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    const wx = (vnoise(t * 7.3) - 0.5) * 3, wy = (vnoise(t * 5.1 + 30) - 0.5) * 4;
    ctx.filter = `brightness(${(ex * (0.93 + 0.1 * vnoise(t * 22 + 3))).toFixed(3)})`;
    ctx.drawImage(clockScene(lt), r.x + wx, r.y + wy);
    ctx.filter = 'none';
    dust(ctx, t, r, lt > CK.rw0 && lt < CK.rw1 ? 2.2 : 1);
    const v = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, r.h * 0.3, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.7);
    v.addColorStop(0, 'rgba(5,3,3,0)');
    v.addColorStop(1, 'rgba(5,3,3,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }
  // the clock's reading under the dial: 1:58 AM ... 2:00 AM ... back to 1:00 AM
  function readout(ctx, lt, a) {
    if (a <= 0.001) return;
    const Tm = Math.round(clockT(lt) * 1000) / 1000;
    const hh = Math.floor(Tm / 60) % 12 || 12, mm = Math.floor(Tm % 60);
    const str = `${hh}:${String(mm).padStart(2, '0')}`;
    const y = BOX.y + 985, size = 92, adv = size * 0.62;
    ctx.save();
    ctx.globalAlpha = a;
    const chars = [...str], step = (ch) => (ch === ':' ? adv * 0.45 : adv);   // fixed advances so the digits don't jitter
    const total = chars.reduce((w, ch) => w + step(ch), 0);
    let x = W / 2 - 95 - total / 2;
    const glow = 0.9 + 0.1 * flicker(lt, 4);
    chars.forEach((ch) => { emberText(ctx, ch, x + step(ch) / 2, y, size, { glow }); x += step(ch); });
    emberText(ctx, C().am, x + 26, y, size, { align: 'left', glow });
    ctx.restore();
  }
  function clockCard(ctx, t) {
    const lt = t - T.clock;
    // flickers on like a projector starting
    const on = ease.out2(prog(lt, 0, 0.25)) * (lt < 0.25 ? 0.6 + 0.4 * hash(Math.round(t * FPS)) : 1);
    ctx.save();
    ctx.globalAlpha = on;
    clockFilm(ctx, t, lt);
    ctx.restore();
    readout(ctx, lt, ease.out2(prog(lt, 0.05, 0.3)));
    flash(ctx, lt, STRIKE, 0.2);    // 2:00 strikes
    flash(ctx, lt, CK.rw1, 0.22);   // ... and it's 1:00 again
    if (lt > CK.rw1 - 0.05) {       // the knife-tip glint on the minute hand
      const M = A.meta.clock;
      const s = DIAL.s * lerp(0.96, 1.04, ease.inOut2(prog(lt, 0, T.end - T.clock)));
      glint(ctx, W / 2 + M.offset * M.radius[0] * s, BOX.y + DIAL.cy - 0.86 * M.radius[1] * s, 300, Math.exp(-Math.max(0, lt - CK.rw1) * 3.5), { spin: 0.6 });
    }
  }

  // ------------------------------------------------------------ end card
  const E = {
    title: { y: 222, s: 0.8 }, art: { x: 540 - 272 * 0.66, y: 420, s: 0.66 },
    date: 1140, bar: { y: 1186, h: 74 }, logo: { y: 1332, w: 240 },
  };
  // PRICES GO UP TOMORROW on an ember bar that wipes in, then breathes
  function priceBar(ctx, lt, t0) {
    const q = ease.out3(prog(lt, t0, t0 + 0.45));
    if (q <= 0) return;
    const str = C().urgency;
    const size = fit(ctx, str, 58, 880, 'Copperplate', 2);
    ctx.save();
    setFont(ctx, 'Copperplate', size);
    ctx.letterSpacing = '2px';
    const tw = ctx.measureText(str).width;
    ctx.restore();
    const bw = tw + 60, bh = E.bar.h, bx = W / 2 - bw / 2, by = E.bar.y;
    const pulse = 0.5 + 0.5 * Math.sin((lt - t0) * 4.2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx - 40, by - 40, (bw + 80) * q, bh + 80);
    ctx.clip();
    ctx.shadowColor = 'rgba(224,48,30,0.85)';
    ctx.shadowBlur = 26 + 18 * pulse * prog(lt, t0 + 0.6, t0 + 1.2);
    ctx.fillStyle = EMBER;
    ctx.fillRect(bx, by, bw, bh);
    ctx.shadowBlur = 0;
    label(ctx, str, W / 2, by + bh / 2 + size * 0.36, size, { family: 'Copperplate', weight: '', tracking: 2, color: BONE });
    ctx.restore();
  }
  function endCard(ctx, t) {
    const { stab, ignite, titleBurn, lasers } = P();
    const lt = t - T.end;
    if (lt < 0) return;
    const hit = 0.25;
    const [dx, dy] = shakeAt(lt, [hit], 10);
    ctx.save();
    ctx.translate(dx, dy);
    const Ar = E.art;
    const off = stab(lt, hit - 0.22, hit, 800);
    const glow = ctx.createRadialGradient(540, 760, 40, 540, 760, 760);
    glow.addColorStop(0, `rgba(226,74,22,${0.22 * ease.out2(prog(lt, hit, hit + 0.6)) * flicker(lt, 4)})`);
    glow.addColorStop(1, 'rgba(226,74,22,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, 1920);
    art(ctx, Ar.x, Ar.y, Ar.s, { pumpkin: ignite(lt, hit + 0.05), h: ignite(lt, hit + 0.05, 3) * 1.05, knifeAlpha: lt >= hit - 0.22 ? 1 : 0, knifeOffset: off });
    const [gx, gy] = artTip(Ar.x, Ar.y, Ar.s, off);
    [hit, 2.8, 5.6].forEach((s0) => sparkle(ctx, gx, gy, 300, lt, s0, { hold: 0.2 }));
    const [hx, hy] = artH(Ar.x, Ar.y, Ar.s);
    const on = ease.out2(prog(lt, 0.7, 1.0));
    if (on > 0) lasers(ctx, lt, on, { origin: [hx, hy], t0: 0.7, spread: 1.15, n: 7, haze: 0.08 });
    ctx.save();   // shade so the title reads over the beams
    ctx.translate(W / 2, 320);
    ctx.scale(1, 0.42);
    const sh = ctx.createRadialGradient(0, 0, 60, 0, 0, 600);
    sh.addColorStop(0, `rgba(5,3,3,${0.6 * on})`);
    sh.addColorStop(0.6, `rgba(5,3,3,${0.4 * on})`);
    sh.addColorStop(1, 'rgba(5,3,3,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(-W, -1400, W * 2, 2800);
    ctx.restore();
    titleBurn(ctx, W / 2 - 433 * E.title.s, E.title.y, E.title.s, lt, 0.4, 0.018);
    const c = C();
    if (c.already) kicker(ctx, c.already, E.date - 72, ease.out2(prog(lt, 0.8, 1.2)), { size: 26, tracking: 10, color: BONE, glow: 0 });
    revealText(ctx, c.date, W / 2, E.date, fit(ctx, c.date, 88, 940), lt, 0.9, 'burn', { step: 0.025 });
    priceBar(ctx, lt, 1.25);
    logo(ctx, W / 2, E.logo.y, E.logo.w, ease.out2(prog(lt, 1.6, 2.1)), 0.12 + 0.05 * flicker(lt, 2));
    ctx.restore();
    flash(ctx, lt, hit, 0.16);
  }

  register({
    id: '20-turn-back-the-clocks',
    duration: T.dur,
    cues: [],
    async prepare(t) {
      await footIndex();
      if (t < SHOT.t1) await getImg(frameURL(SHOT, GRADE, t - SHOT.t0)).p;
    },
    draw(ctx, t) {
      stickerSlot(ctx, t, SLOT_Y, 1, { h: SLOT_H });   // the ticket link goes here, from the first frame
      if (t >= T.end) { endCard(ctx, t); return; }
      if (t < T.clock) {
        film(ctx, t, SHOT);
        bigWords(ctx, t, C().turn, 0, T.words2, { instant: true });
        bigWords(ctx, t, C().extra, T.words2, T.clock);
      } else {
        clockCard(ctx, t);
      }
    },
  });
})();
