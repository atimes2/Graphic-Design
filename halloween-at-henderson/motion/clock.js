/* 20 · TURN BACK THE CLOCKS (14s story, 1080x1920)
 *
 * The clocks go back an hour on the night of the party (2am becomes 1am), so
 * Halloween gets an extra hour. Told like the collab Reels, as an old movie:
 *   0.0  Harold Lloyd hanging off the clock in Safety Last! (1923), ember grade,
 *        TURN BACK / THE CLOCKS on the foot of the film from frame 0
 *   3.4  a silent-film intertitle: a drawn dial at 2:00 winds back to 1:00,
 *        EXTRA HOUR / OF HALLOWEEN burns in
 *   7.6  Lloyd dangling from the hands as the face pulls out of the wall,
 *        PRICES GO UP / TOMORROW.
 *  10.4  the poster: knife, pumpkin ignites, title burns, lasers, date, the
 *        Henderson wordmark. The ticket-link sticker slot sits under the film
 *        the whole time.
 * Footage: reel/footage.json → clock_hang, clock_face (prep_footage.py).
 */
(function () {
  const {
    W, clamp, lerp, prog, ease, flicker, neon, vnoise, A, setFont, fit,
    label, kicker, revealText, neonLabel, stickerSlot, glint, sparkle, shakeAt, flash,
    art, artTip, artH, logo, register,
  } = window.HH;
  const R = window.HH_REEL;
  const { BONE, footIndex, getImg, frameURL, dust } = R;
  const P = () => window.HH_PARTS;
  const C = () => A.content.clocks;
  const EMBER = '#E0301E', PUMPKIN = '#FF8A4C', VOID = '#050303';

  const BOX = { x: 0, y: 300, w: 1080, h: 1060 };   // the film, below Instagram's header
  const ML = 70;                                     // left margin for the big words
  const SLOT_Y = 1400;                               // ticket-link sticker slot (inside the bottom safe zone)
  const T = { cut1: 3.4, wind: 4.0, cut2: 7.6, end: 10.4, dur: 14 };
  const GRADE = 'ember';
  const SHOTS = [
    { t0: 0, t1: T.cut1, clip: 'clock_hang', at: 0 },
    { t0: T.cut2, t1: T.end, clip: 'clock_face', at: 0 },
  ];
  const shotAt = (t) => SHOTS.find((s) => t >= s.t0 && t < s.t1) || null;

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
      const z = Math.max(r.w / im.width, r.h / im.height) * (1.03 + 0.03 * (t - s.t0));
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

  // two big words in the poster's Copperplate on the foot of the film
  function bigWords(ctx, t, words, t0, o = {}) {
    const size = Math.min(...words.map((w) => fit(ctx, w, 196, 940, 'Copperplate', 1)));
    const base = BOX.y + BOX.h - 50;
    words.forEach((w, i) => {
      const st = t0 + i * 0.16;
      if (t < st) return;
      const p = o.instant ? 1 : ease.out3(prog(t, st, st + 0.22));
      label(ctx, w, ML, base - (words.length - 1 - i) * size * 1.0 + (1 - p) * 16, size, {
        family: 'Copperplate', weight: '', tracking: 1, align: 'left', color: i ? PUMPKIN : BONE, alpha: p,
      });
    });
  }

  // the header strip over the film (event left, date right) and a hairline
  function chrome(ctx, a = 1) {
    const [h1, h2] = C().head;
    label(ctx, h1, ML, 272, 22, { tracking: 8, align: 'left', alpha: 0.75 * a });
    label(ctx, h2, W - ML, 272, 22, { tracking: 8, align: 'right', color: PUMPKIN, alpha: a });
    ctx.save();
    ctx.globalAlpha = 0.3 * a;
    ctx.fillStyle = BONE;
    ctx.fillRect(ML, 286, W - 2 * ML, 1.5);
    ctx.restore();
  }

  // ------------------------------------------------------------ the dial
  const DIAL = { cx: 540, cy: 745, r: 305 };
  function hand(ctx, ang, len, wid, color, alpha = 1, glow = 18) {
    ctx.save();
    ctx.translate(DIAL.cx, DIAL.cy);
    ctx.rotate(ang);
    ctx.globalAlpha *= alpha;
    ctx.shadowColor = 'rgba(224,48,30,0.9)';
    ctx.shadowBlur = glow;
    ctx.fillStyle = color;
    ctx.beginPath();
    // a spade-shaped hand: narrow tail, wide shoulder, tapering tip
    ctx.moveTo(-wid * 0.35, len * 0.14);
    ctx.lineTo(-wid * 0.5, -len * 0.18);
    ctx.lineTo(-wid * 0.22, -len * 0.3);
    ctx.lineTo(0, -len);
    ctx.lineTo(wid * 0.22, -len * 0.3);
    ctx.lineTo(wid * 0.5, -len * 0.18);
    ctx.lineTo(wid * 0.35, len * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  const NUM = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  function dial(ctx, t, a) {
    if (a <= 0.001) return;
    const { cx, cy, r } = DIAL;
    ctx.save();
    ctx.globalAlpha = a;
    // ember glow behind the face
    const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.5);
    g.addColorStop(0, `rgba(226,74,22,${0.16 * flicker(t, 4)})`);
    g.addColorStop(1, 'rgba(226,74,22,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, 1920);
    // the ring
    ctx.strokeStyle = BONE;
    ctx.shadowColor = 'rgba(224,48,30,0.8)';
    ctx.shadowBlur = 22;
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r - 16, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    // minute ticks
    for (let i = 0; i < 60; i++) {
      const q = (i / 60) * Math.PI * 2, big = i % 5 === 0;
      const r0 = r - (big ? 40 : 30), r1 = r - 22;
      ctx.lineWidth = big ? 4 : 2;
      ctx.globalAlpha = a * (big ? 1 : 0.6);
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(q) * r0, cy - Math.cos(q) * r0);
      ctx.lineTo(cx + Math.sin(q) * r1, cy - Math.cos(q) * r1);
      ctx.stroke();
    }
    ctx.globalAlpha = a;
    // numerals
    setFont(ctx, 'Copperplate', 54);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = BONE;
    ctx.shadowColor = 'rgba(224,48,30,0.7)';
    ctx.shadowBlur = 14;
    NUM.forEach((n, i) => {
      const q = (i / 12) * Math.PI * 2, rr = r - 82;
      ctx.fillText(n, cx + Math.sin(q) * rr, cy - Math.cos(q) * rr + 3);
    });
    ctx.restore();
  }
  // hands at 2:00, winding back to 1:00 from T.wind; the old position stays as an ember ghost
  function hands(ctx, t, a) {
    if (a <= 0.001) return;
    const p = ease.inOut3(prog(t, T.wind, T.wind + 1.3));
    const h2 = (2 / 12) * Math.PI * 2, h1 = (1 / 12) * Math.PI * 2;
    const hourA = lerp(h2, h1, p), minA = -p * Math.PI * 2;
    ctx.save();
    ctx.globalAlpha = a;
    if (p > 0) {   // the ghost of two o'clock
      hand(ctx, h2, DIAL.r * 0.52, 30, EMBER, 0.28 * Math.min(1, p * 3), 0);
      hand(ctx, 0, DIAL.r * 0.8, 20, EMBER, 0.28 * Math.min(1, p * 3), 0);
    }
    hand(ctx, hourA, DIAL.r * 0.52, 30, BONE);
    hand(ctx, minA, DIAL.r * 0.8, 20, BONE);
    // centre cap
    ctx.fillStyle = BONE;
    ctx.shadowColor = 'rgba(224,48,30,0.9)';
    ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(DIAL.cx, DIAL.cy, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = VOID;
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(DIAL.cx, DIAL.cy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // a glint rides the minute hand's tip while it turns
    if (p > 0 && p < 1) {
      const tipX = DIAL.cx + Math.sin(minA) * DIAL.r * 0.8, tipY = DIAL.cy - Math.cos(minA) * DIAL.r * 0.8;
      glint(ctx, tipX, tipY, 170, Math.sin(p * Math.PI), { spin: 1.4 });
    }
    // and settles with a flare at one o'clock
    sparkle(ctx, DIAL.cx + Math.sin(h1) * DIAL.r * 0.52, DIAL.cy - Math.cos(h1) * DIAL.r * 0.52, 220, t, T.wind + 1.3, { hold: 0.15 });
  }
  // the intertitle: a double hairline frame, the dial, the words
  function intertitle(ctx, t) {
    const a = ease.out2(prog(t, T.cut1, T.cut1 + 0.2));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = BONE;
    ctx.globalAlpha = 0.35 * a;
    ctx.lineWidth = 2;
    ctx.strokeRect(BOX.x + 36, BOX.y + 24, BOX.w - 72, BOX.h - 48);
    ctx.lineWidth = 1;
    ctx.strokeRect(BOX.x + 46, BOX.y + 34, BOX.w - 92, BOX.h - 68);
    ctx.restore();
    dial(ctx, t, a);
    hands(ctx, t, a);
    const c = C().extra;
    const size = Math.min(...c.map((w) => fit(ctx, w, 150, 900, 'Copperplate', 1)));
    revealText(ctx, c[0], W / 2, 1190, size, t, T.wind + 1.0, 'burn', { family: 'Copperplate', step: 0.05, tracking: 1 });
    const a2 = ease.out2(prog(t, T.wind + 1.7, T.wind + 2.3));
    label(ctx, c[1], W / 2, 1190 + size * 0.92, size * 0.78, { family: 'Copperplate', weight: '', tracking: 2, color: PUMPKIN, alpha: a2 });
  }

  // ------------------------------------------------------------ end card
  const E = {
    title: { y: 232, s: 0.86 }, art: { x: 540 - 272 * 0.76, y: 450, s: 0.76 },
    date: 1205, urgency: 1282, logo: { y: 1350, w: 280 },
  };
  function endCard(ctx, t) {
    const { stab, ignite, titleBurn, lasers } = P();
    const lt = t - T.end;
    if (lt < 0) return;
    const hit = 0.3;
    const [dx, dy] = shakeAt(lt, [hit], 10);
    ctx.save();
    ctx.translate(dx, dy);
    const Ar = E.art;
    const off = stab(lt, hit - 0.22, hit, 800);
    const glow = ctx.createRadialGradient(540, 800, 40, 540, 800, 760);
    glow.addColorStop(0, `rgba(226,74,22,${0.22 * ease.out2(prog(lt, hit, hit + 0.6)) * flicker(lt, 4)})`);
    glow.addColorStop(1, 'rgba(226,74,22,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, 1920);
    art(ctx, Ar.x, Ar.y, Ar.s, { pumpkin: ignite(lt, hit + 0.05), h: ignite(lt, hit + 0.05, 3) * 1.05, knifeAlpha: lt >= hit - 0.22 ? 1 : 0, knifeOffset: off });
    const [gx, gy] = artTip(Ar.x, Ar.y, Ar.s, off);
    sparkle(ctx, gx, gy, 300, lt, hit, { hold: 0.2 });
    sparkle(ctx, gx, gy, 300, lt, 2.8, { hold: 0.2 });
    const [hx, hy] = artH(Ar.x, Ar.y, Ar.s);
    const on = ease.out2(prog(lt, 1.1, 1.4));
    if (on > 0) lasers(ctx, lt, on, { origin: [hx, hy], t0: 1.1, spread: 1.15, n: 7, haze: 0.08 });
    ctx.save();   // shade so the title reads over the beams
    ctx.translate(W / 2, 330);
    ctx.scale(1, 0.42);
    const sh = ctx.createRadialGradient(0, 0, 60, 0, 0, 600);
    sh.addColorStop(0, `rgba(5,3,3,${0.6 * on})`);
    sh.addColorStop(0.6, `rgba(5,3,3,${0.4 * on})`);
    sh.addColorStop(1, 'rgba(5,3,3,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(-W, -1400, W * 2, 2800);
    ctx.restore();
    titleBurn(ctx, W / 2 - 433 * E.title.s, E.title.y, E.title.s, lt, 0.6, 0.03);
    const c = C();
    revealText(ctx, c.date, W / 2, E.date, fit(ctx, c.date, 96, 940), lt, 1.6, 'burn', { step: 0.04 });
    if (c.already) kicker(ctx, c.already, E.urgency - 58, ease.out2(prog(lt, 2.1, 2.6)), { size: 28, tracking: 10, color: BONE, glow: 0 });
    neonLabel(ctx, c.urgency, E.urgency, lt, 2.3, { size: 52, tracking: 12 });
    logo(ctx, W / 2, E.logo.y, E.logo.w, ease.out2(prog(lt, 2.9, 3.6)), 0.12 + 0.05 * flicker(lt, 2));
    ctx.restore();
    flash(ctx, lt, hit, 0.16);
  }

  register({
    id: '20-turn-back-the-clocks',
    duration: T.dur,
    cues: [],
    async prepare(t) {
      await footIndex();
      const s = shotAt(t);
      if (s) await getImg(frameURL(s, GRADE, t - s.t0)).p;
    },
    draw(ctx, t) {
      stickerSlot(ctx, t, SLOT_Y, 1);   // the ticket link goes here, from the first frame
      if (t >= T.end) { endCard(ctx, t); return; }
      chrome(ctx, 1 - prog(t, T.end - 0.3, T.end));
      const s = shotAt(t);
      if (s) {
        film(ctx, t, s);
        if (s.clip === 'clock_hang') bigWords(ctx, t, C().turn, 0, { instant: true });
        else bigWords(ctx, t, C().prices, T.cut2 + 0.1);
      } else {
        intertitle(ctx, t);
      }
      // a splice flash on each cut
      [T.cut1, T.cut2].forEach((c) => flash(ctx, t, c, 0.22));
    },
  });
})();
