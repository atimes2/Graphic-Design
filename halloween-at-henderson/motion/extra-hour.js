/* Story 20 · EXTRA HOUR (13s, 1080x1920): the clocks fall back at 2am on
 * Halloween night, so the party gets an hour twice.
 *
 *   0.0-2.35 the midnight tower clock from The Phantom Carriage (1921), its
 *            painted hands replaced by drawn ones (prep_clock.py): it jumps
 *            to 1:59, strikes 2:00, then the film slips in the gate and the
 *            hands wind back a full hour to 1:00
 *   2.35-11  the ballroom of The Merry Widow (1925) in black and white, under
 *            EXTRA HOUR of Halloween, the details and PRICES GO UP TOMORROW,
 *            all in by ~3.6s so the final screen holds ~7s for the ticket-link
 *            sticker slot (on screen from the first frame)
 *
 * Footage is cut and graded by prep_footage.py (clips xh_*), copy lives in
 * content.json -> extraHour. Rights notes: reel/SOURCES.md.
 */
(function () {
  const {
    W, clamp, lerp, prog, ease, flicker, hash, vnoise, A, canvas, glint, setFont, fit,
    emberText, label, kicker, revealText, neonLabel, stickerSlot, register,
  } = window.HH;
  const R = window.HH_REEL;
  const { BONE, FPS, footIndex, getImg, frameURL, dust } = R;
  const EMBER = '#E0301E';
  const C = () => A.content.extraHour;

  const XH = {
    dur: 11,
    panel: { x: 90, y: 540, w: 900, h: 675, r: 14 },
    ticks: [0.35, 0.75],             // the minute hand jumps 1:58 -> 1:59 -> 2:00
    rw0: 1.0, rw1: 2.0,              // winds back to 1:00
    cut: 2.35,                       // into the ballroom; everything is on screen by ~3.6s
    slot: 1440,
  };
  const STRIKE = XH.ticks[XH.ticks.length - 1];
  // ballroom shots (t0..t1 in story time)
  const SHOTS = [
    { clip: 'xh_hall', t0: 2.35, t1: 3.95 },
    { clip: 'xh_waltz', t0: 3.95, t1: 6.3 },
    { clip: 'xh_floor', t0: 6.3, t1: 7.9 },
    { clip: 'xh_waltz2', t0: 7.9, t1: 11.0 },
  ];
  const shotAt = (t) => SHOTS.find((s) => t >= s.t0 && t < s.t1) || null;

  // --------------------------------------------------------------- the clock
  // minutes past midnight at story time t
  function clockT(t) {
    if (t >= XH.rw0) return 120 - 60 * ease.inOut3(prog(t, XH.rw0, XH.rw1));
    return 118 + XH.ticks.reduce((m, k) => m + ease.outSoft(prog(t, k, k + 0.12)), 0);
  }

  // the film's hand: its measured half-width profile, smoothed, then tapered to a point
  let HAND = null;
  function handShape() {
    if (HAND) return HAND;
    const raw = A.meta.clock.hand.filter(([d]) => d <= 0.54);
    const sm = raw.map((_, i) => {
      const win = raw.slice(Math.max(0, i - 9), i + 10);
      return [raw[i][0], win.reduce((s, p) => s + p[1], 0) / win.length];
    });
    HAND = sm;
    return HAND;
  }
  // a hand along angle a (0 = XII, clockwise), len in dial radii
  function hand(ctx, a, len, widthK, alpha) {
    const prof = handShape();
    const d0 = prof[prof.length - 1][0];
    const sc = len / 0.86;                      // the profile is the minute hand's
    const side = [];
    prof.forEach(([d, hw]) => side.push([d * sc, hw * widthK]));
    const wEnd = prof[prof.length - 1][1] * widthK;
    // tip: a narrowing shaft with a small spade, as on the film's hands
    const dEnd = d0 * sc;
    [[0.25, 0.55], [0.55, 0.42], [0.72, 0.95], [0.8, 0.6], [0.92, 0.22], [1.0, 0]].forEach(([q, k]) => {
      side.push([lerp(dEnd, len, q), wEnd * k]);
    });
    ctx.save();
    ctx.rotate(a);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    side.forEach(([d, hw], i) => (i ? ctx.lineTo(hw, -d) : ctx.moveTo(hw, -d)));
    for (let i = side.length - 1; i >= 0; i--) ctx.lineTo(-side[i][1], -side[i][0]);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  const clockBuf = canvas(XH.panel.w, XH.panel.h);
  // the clock scene, drawn into the panel's own canvas so it gets the film treatment
  function clockScene(t) {
    const P = XH.panel, M = A.meta.clock, im = A.img.clock_dial;
    const c = clockBuf.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.filter = 'none';
    c.fillStyle = '#050303';
    c.fillRect(0, 0, P.w, P.h);
    // the clock looms closer, as in the film
    const s = lerp(0.54, 0.62, ease.inOut2(prog(t, 0, XH.cut)));
    // the film slips in the gate while the hands wind back: the frame rolls
    const slip = prog(t, XH.rw0 - 0.05, XH.rw1 + 0.05);
    const roll = slip > 0 && slip < 1 ? ((ease.inOut2(slip) * 3.0) % 1) * P.h : 0;
    const shake = Math.exp(-Math.max(0, t - STRIKE) * 12) * (t >= STRIKE ? 6 : 0);
    const draw = (oy) => {
      c.save();
      c.translate(P.w / 2 + (vnoise(t * 31) - 0.5) * shake, P.h / 2 + oy + (vnoise(t * 29 + 7) - 0.5) * shake);
      c.scale(s, s);
      c.drawImage(im, -M.center[0], -M.center[1]);
      // hands, squashed to the dial's slight perspective
      const [rx, ry] = M.radius;
      c.scale(1, ry / rx);
      c.translate(M.offset * rx, 0);
      c.fillStyle = `rgb(${M.ink.join(',')})`;
      c.filter = 'blur(1.4px)';
      const winding = t > XH.rw0 && t < XH.rw1;
      const ghosts = winding ? 7 : 1;
      for (let g = ghosts - 1; g >= 0; g--) {
        const Tg = clockT(t - g * 0.01);
        const a = g ? 0.16 : 1;
        hand(c, (Tg / 720) * Math.PI * 2, 0.52 * rx, 0.78 * rx, a);
        hand(c, (Tg / 60) * Math.PI * 2, 0.84 * rx, 0.72 * rx, a);
      }
      // the boss the hands turn on
      c.beginPath();
      c.arc(0, 0, 0.06 * rx, 0, Math.PI * 2);
      c.fill();
      c.restore();
    };
    if (roll) {
      draw(roll - P.h);
      draw(roll);
      c.fillStyle = '#050303';             // the frame line rolling through
      c.fillRect(0, roll - 22, P.w, 44);
    } else draw(0);
    return clockBuf;
  }

  // ----------------------------------------------------------- film panel
  const panelPath = (ctx, p, r = p.r) => { ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, r); };
  function drawPanel(ctx, t, img, o = {}) {
    const p = XH.panel;
    ctx.save();
    panelPath(ctx, p);
    ctx.clip();
    ctx.fillStyle = '#050303';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    if (img) {
      const wx = (vnoise(t * 7.3) - 0.5) * 3, wy = (vnoise(t * 5.1 + 30) - 0.5) * 4;
      const ex = (o.exposure ?? 1) * (0.93 + 0.1 * vnoise(t * 22 + 3));
      const z = 1.03 + 0.04 * (o.lt ?? 0) / 2;
      const dw = p.w * z, dh = p.h * z;
      ctx.filter = `brightness(${ex.toFixed(3)})`;
      ctx.drawImage(img, p.x + (p.w - dw) / 2 + wx, p.y + (p.h - dh) / 2 + wy, dw, dh);
      ctx.filter = 'none';
    }
    dust(ctx, t, p, o.dust ?? 1);
    const v = ctx.createRadialGradient(p.x + p.w / 2, p.y + p.h / 2, p.h * 0.3, p.x + p.w / 2, p.y + p.h / 2, p.w * 0.7);
    v.addColorStop(0, 'rgba(5,3,3,0)');
    v.addColorStop(1, 'rgba(5,3,3,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = BONE;
    ctx.lineWidth = 1.5;
    panelPath(ctx, p);
    ctx.stroke();
    ctx.restore();
  }
  function panelFlash(ctx, t, t0, k = 0.3, rgb = '255,190,140') {
    const d = t - t0;
    if (d < 0 || d > 0.25) return;
    const p = XH.panel;
    ctx.save();
    panelPath(ctx, p);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(${rgb},${k * Math.exp(-d * 24)})`;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.restore();
  }

  // ------------------------------------------------------------------ type
  // the clock's reading under the panel: 1:58 AM ... 2:00 AM ... back to 1:00 AM
  function readout(ctx, t, a) {
    if (a <= 0.001) return;
    const T = Math.round(clockT(t) * 1000) / 1000;
    const hh = Math.floor(T / 60) % 12 || 12, mm = Math.floor(T % 60);
    const str = `${hh}:${String(mm).padStart(2, '0')}`;
    const y = 1325, size = 92, adv = size * 0.62;
    ctx.save();
    ctx.globalAlpha = a;
    // fixed advances so the digits don't jitter as they roll; the colon is narrower
    const chars = [...str], step = (ch) => (ch === ':' ? adv * 0.45 : adv);
    const total = chars.reduce((w, ch) => w + step(ch), 0);
    let x = W / 2 - 95 - total / 2;
    const glow = 0.9 + 0.1 * flicker(t, 4);
    chars.forEach((ch) => { emberText(ctx, ch, x + step(ch) / 2, y, size, { glow }); x += step(ch); });
    emberText(ctx, C().am, x + 26, y, size, { align: 'left', glow });
    ctx.restore();
  }

  // PRICES GO UP TOMORROW on an ember bar that wipes in
  function priceBar(ctx, t, t0) {
    const q = ease.out3(prog(t, t0, t0 + 0.45));
    if (q <= 0) return;
    const str = C().urgent;
    const size = fit(ctx, str, 56, 860);
    ctx.save();
    setFont(ctx, 'Copperplate', size);
    ctx.letterSpacing = '2px';
    const tw = ctx.measureText(str).width;
    ctx.restore();
    const bw = tw + 56, bh = 70, bx = W / 2 - bw / 2, by = 1325;
    const pulse = 0.5 + 0.5 * Math.sin((t - t0) * 4.2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by - 10, bw * q, bh + 20);
    ctx.clip();
    ctx.shadowColor = 'rgba(224,48,30,0.8)';
    ctx.shadowBlur = 24 + 16 * pulse * prog(t, t0 + 0.6, t0 + 1.2);
    ctx.fillStyle = EMBER;
    ctx.fillRect(bx, by, bw, bh);
    ctx.shadowBlur = 0;
    label(ctx, str, W / 2, by + bh / 2 + size * 0.36, size, { family: 'Copperplate', weight: '', tracking: 2, color: BONE });
    ctx.restore();
  }

  // ------------------------------------------------------------------ card
  register({
    id: '20-extra-hour',
    duration: XH.dur,
    cues: [],
    async prepare(t) {
      await footIndex();
      const s = shotAt(t);
      if (s) await getImg(frameURL(s, 'mono', t - s.t0)).p;
    },
    draw(ctx, t) {
      const c = C();
      stickerSlot(ctx, t, XH.slot, 1, { h: 130 });   // ticket link sits here from the first frame

      // ---- the panel: clock, then the ballroom
      const on = ease.out2(prog(t, 0.05, 0.35)) * (t < 0.35 ? 0.6 + 0.4 * hash(Math.round(t * FPS)) : 1);
      ctx.save();
      ctx.globalAlpha = on;
      if (t < XH.cut) {
        drawPanel(ctx, t, clockScene(t), { exposure: 1.05 + 0.25 * Math.exp(-Math.max(0, t - STRIKE) * 6) * (t >= STRIKE ? 1 : 0), dust: t > XH.rw0 && t < XH.rw1 ? 2.2 : 1 });
      } else {
        const s = shotAt(t);
        const e = s ? getImg(frameURL(s, 'mono', t - s.t0)) : null;
        drawPanel(ctx, t, e && e.ok ? e.im : null, { lt: s ? t - s.t0 : 0 });
        SHOTS.forEach((sh) => panelFlash(ctx, t, sh.t0, sh.t0 === XH.cut ? 0.45 : 0.18));
      }
      ctx.restore();
      panelFlash(ctx, t, STRIKE, 0.32);                       // 2:00 strikes
      panelFlash(ctx, t, XH.rw1, 0.38);                            // ... and it's 1:00 again
      if (t > XH.rw1 - 0.05 && t < XH.cut) {                       // the knife-tip glint on the minute hand
        const M = A.meta.clock, P = XH.panel;
        const s = lerp(0.54, 0.62, ease.inOut2(prog(t, 0, XH.cut)));
        const tipY = P.y + P.h / 2 - 0.86 * M.radius[1] * s;
        glint(ctx, P.x + P.w / 2, tipY, 300, Math.exp(-Math.max(0, t - XH.rw1) * 3.5), { spin: 0.6 });
      }

      // ---- scene A type: TURN BACK THE CLOCKS + the reading
      const outA = 1 - ease.in2(prog(t, XH.cut - 0.2, XH.cut));
      if (outA > 0) {
        ctx.save();
        ctx.globalAlpha = outA;
        const [l1, l2] = [c.kicker.split(' ').slice(0, 2).join(' '), c.kicker.split(' ').slice(2).join(' ')];
        const size = Math.min(fit(ctx, l1, 140, 960), fit(ctx, l2, 140, 960));
        revealText(ctx, l1, W / 2, 370, size, t, 0.0, 'burn', { step: 0.025 });
        revealText(ctx, l2, W / 2, 500, size, t, 0.12, 'burn', { step: 0.025 });
        readout(ctx, t, ease.out2(prog(t, 0.05, 0.3)));
        ctx.restore();
      }

      // ---- scene B type: EXTRA HOUR of Halloween, details, prices
      if (t >= XH.cut) {
        revealText(ctx, c.big, W / 2, 420, fit(ctx, c.big, 172, 960), t, XH.cut + 0.05, 'burn', { step: 0.035 });
        neonLabel(ctx, c.sub, 494, t, XH.cut + 0.45, { size: 50, tracking: 18 });
        kicker(ctx, c.details, 1285, ease.out2(prog(t, XH.cut + 0.7, XH.cut + 1.1)), { size: 33, tracking: 5, color: BONE, glow: 0, maxW: 880 });
        priceBar(ctx, t, XH.cut + 0.95);
      }
    },
  });
})();
