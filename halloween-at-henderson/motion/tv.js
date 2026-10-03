/* Halloween at Henderson: 60s venue TV loop (1920x1080, silent, seamless).
 *
 * Layout: a stage on the left (x 0..1335) cycles through seven scenes from the
 * story set; a fixed column on the right keeps the ticket QR code, the date and
 * the Henderson wordmark on screen the whole time.
 *  - the QR is drawn as clean pixel-aligned modules in the card overlay, above
 *    the grain and vignette, so it always scans
 *  - everything in the column runs on 60s-periodic motion, and scene 1 opens
 *    with a transition from scene 7, so the file loops with no visible seam
 *  - scenes favour holds and small movement (candle flicker, drift, sparkles)
 *    over constant animation, since it plays on repeat for weeks
 */
(function () {
  const {
    W, H, clamp, lerp, prog, ease, flicker, pflicker, neon, flare,
    A, canvas, blurred, drawImg, camera, glint, sparkle, setFont, fit, emberText, label, kicker,
    revealText, neonLabel, art, artTip, artH, title, scene, slashWipe, register, logo,
  } = window.HH;
  const P = () => window.HH_PARTS;
  const C = () => A.content;
  const BONE = '#FFF1E0';

  const DUR = 60;
  const STAGE_W = 1335;   // stage clip; the column starts here
  const SX = 660;         // stage centre
  const COL = 1600;       // column centre
  const QR = { cx: COL, cy: 445, mod: 12, pad: 30 };
  const TR = 0.6;         // scene transition length

  const TV = { qr: null };
  async function load() {
    TV.qr = await (await fetch('layers/qr.json')).json();
  }

  // ------------------------------------------------------------- shared bits
  const neonA = (t, t0, d = 0.4) => neon(prog(t, t0, t0 + d));
  const fadeA = (t, t0, d = 0.7) => ease.out2(prog(t, t0, t0 + d));
  const drift = (ctx, lt, dur, amt = 0.03, cy = H / 2) => camera(ctx, lerp(1, 1 + amt, ease.inOut2(clamp(lt / dur))), SX, cy);
  const sk = (o = {}) => ({ x: SX, maxW: 1150, ...o });   // kicker / neonLabel on the stage

  // a thin ember rule drawn out from its centre
  function rule(ctx, t, x, y, half, t0) {
    const p = ease.inOut2(prog(t, t0, t0 + 0.6));
    if (p <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(255,90,30,1)';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = `rgba(232,98,28,${0.7 * (0.9 + 0.1 * flicker(t, 11))})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x - half * p, y); ctx.lineTo(x + half * p, y); ctx.stroke();
    ctx.restore();
    if (p < 1) { glint(ctx, x - half * p, y, 90, 0.8); glint(ctx, x + half * p, y, 90, 0.8); }
  }

  // carved Lobster numeral, cached; revealed left to right by a sparkle, then lit
  const numCache = {};
  function numeralImg(str, size) {
    const key = `${str}@${size}`;
    if (numCache[key]) return numCache[key];
    const c = canvas(Math.ceil(size * (0.62 * str.length + 0.5)), Math.ceil(size * 1.35));
    const x = c.getContext('2d');
    x.font = `${size}px "Lobster"`;
    x.textAlign = 'center';
    const cx = c.width / 2, base = size * 1.02, cy = base - size * 0.36;
    const g = x.createRadialGradient(cx, cy - size * 0.05, 30, cx, cy, Math.max(size * 0.5, c.width * 0.45));
    g.addColorStop(0, '#FFF6D8');
    g.addColorStop(0.45, '#FFD27A');
    g.addColorStop(0.8, '#F28A2C');
    g.addColorStop(1, '#C8461A');
    x.fillStyle = g;
    x.fillText(str, cx, base);
    x.globalCompositeOperation = 'source-atop';
    x.filter = `blur(${Math.round(size / 70)}px)`;
    x.strokeStyle = 'rgba(150,40,8,0.85)';
    x.lineWidth = size / 26;
    x.strokeText(str, cx, base);
    numCache[key] = { c, ax: cx, ay: base };
    return numCache[key];
  }
  function bigNumber(ctx, t, str, x, base, size, t0) {
    const n = numeralImg(str, size);
    const ox = x - n.ax, oy = base - n.ay;
    const r0 = t0, r1 = t0 + 0.8, ig = r1 + 0.05;
    const rev = ease.inOut2(prog(t, r0, r1));
    if (rev <= 0) return;
    const on = ease.out2(prog(t, ig, ig + 0.5));
    const fl = flicker(t, size);
    const edge = ox + rev * n.c.width;
    const glow = on * fl;
    if (glow > 0.001) {
      const b1 = blurred(`tvn1${str}`, n.c, 14), b2 = blurred(`tvn2${str}`, n.c, 48);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(0.32 * glow);
      ctx.drawImage(b1.c, ox - b1.pad, oy - b1.pad);
      ctx.globalAlpha = clamp(0.3 * glow);
      ctx.drawImage(b2.c, ox - b2.pad, oy - b2.pad);
      ctx.restore();
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, edge, H);
    ctx.clip();
    ctx.globalAlpha = lerp(0.7, 1, on) * lerp(1, fl, on);
    ctx.drawImage(n.c, ox, oy);
    ctx.restore();
    if (rev < 1) glint(ctx, edge, base - size * 0.4, 260, 1, { spin: 0.4 });
  }

  // =============================================================== scenes
  // each: { dur, into: 'slash' | 'fade', draw(ctx, lt) } where lt is local time

  // 1 · the poster lockup: knife stabs, pumpkin catches, title burns in
  const L1 = { ax: 90, ay: 170, as: 0.92, tx: 600, ty: 300, ts: 0.78 };
  function sLockup(ctx, lt) {
    const { ignite, stab, titleBurn } = P();
    ctx.save();
    drift(ctx, lt, 9, 0.03);
    const off = stab(lt, 0.1, 0.35, 900);
    art(ctx, L1.ax, L1.ay, L1.as, { pumpkin: ignite(lt, 0.6), h: ignite(lt, 0.6, 3), knifeAlpha: lt >= 0.1 ? 1 : 0, knifeOffset: off });
    const [gx, gy] = artTip(L1.ax, L1.ay, L1.as, off);
    sparkle(ctx, gx, gy, 300, lt, 0.35, { hold: 0.2 });
    [4.0, 7.0].forEach((s0) => sparkle(ctx, gx, gy, 320, lt, s0, { hold: 0.2 }));
    titleBurn(ctx, L1.tx, L1.ty, L1.ts, lt, 1.0, 0.03);
    const mid = L1.tx + 433 * L1.ts;
    const fs = 0.95, fw = A.img.footer.width * fs;
    drawImg(ctx, A.img.footer, mid - fw / 2, 515, fs, neonA(lt, 2.3));
    kicker(ctx, C().night.kicker, 645, neonA(lt, 2.7), { x: mid, maxW: 640, size: 34 });
    ctx.restore();
  }

  // 2 · last year we sold out -> so we're taking over Henderson Brewing Co.
  function sMoreRoom(ctx, lt) {
    const c = C().moreRoom;
    const out = ease.inOut2(prog(lt, 3.3, 3.8));
    if (out < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - out;
      camera(ctx, lerp(1, 0.9, out), SX, 470);
      kicker(ctx, c.k1, 330, neonA(lt, 0.25), sk({ size: 38 }));
      revealText(ctx, c.big1, SX, 520, fit(ctx, c.big1, 170, 1100), lt, 0.45, 'neon', { seed: 3 });
      kicker(ctx, c.sub1, 610, fadeA(lt, 1.3), sk({ color: BONE, glow: 0, size: 36, tracking: 12 }));
      ctx.restore();
    }
    if (lt < 3.7) return;
    ctx.save();
    drift(ctx, lt - 3.7, 5.3, 0.025, 480);
    kicker(ctx, c.k3, 330, neonA(lt, 3.75), sk({ size: 38 }));
    revealText(ctx, 'HENDERSON', SX, 540, fit(ctx, 'HENDERSON', 220, 1100), lt, 4.0, 'fade');
    revealText(ctx, c.venue2, SX, 680, fit(ctx, c.venue2, 130, 900), lt, 4.4, 'sweep');
    ctx.restore();
    setFont(ctx, 'Copperplate', fit(ctx, 'HENDERSON', 220, 1100));
    const hw = ctx.measureText('HENDERSON').width;
    [6.3, 8.0].forEach((s0) => sparkle(ctx, SX + hw / 2 - 10, 400, 260, lt, s0));
  }

  // 3 · DJs all night, beat-synced lasers out of the carved H
  const N3 = { s: 0.5, hx: SX, hy: 905 };
  const G0 = 1.2;
  function sNight(ctx, lt) {
    const { lasers, ignite, BEAT } = P();
    const c = C().night;
    const ax = N3.hx - A.meta.h_center[0] * N3.s, ay = N3.hy - A.meta.h_center[1] * N3.s;
    const on = ease.out2(prog(lt, 0.1, 0.4));
    const beat = (lt - 0.1) / BEAT, inBeat = (((beat % 1) + 1) % 1) * BEAT;
    const kick = lt > 0.1 ? Math.exp(-inBeat * 7) : 0;
    art(ctx, ax, ay, N3.s, { pumpkin: ignite(lt, 0.1) * (0.85 + 0.15 * kick), h: ignite(lt, 0.1, 3) * (0.8 + 0.35 * kick) });
    lasers(ctx, lt, on, { origin: [N3.hx, N3.hy], t0: 0.1, spread: 1.35, n: 9 });
    glint(ctx, N3.hx, N3.hy, 200, on * (0.35 + 0.65 * kick), { spin: 0.8 });
    ctx.save();   // soft shade behind the type
    ctx.translate(SX, 380);
    ctx.scale(1.5, 0.62);
    const shade = ctx.createRadialGradient(0, 0, 60, 0, 0, 520);
    shade.addColorStop(0, 'rgba(5,3,3,0.66)');
    shade.addColorStop(0.55, 'rgba(5,3,3,0.45)');
    shade.addColorStop(1, 'rgba(5,3,3,0)');
    ctx.fillStyle = shade;
    ctx.fillRect(-W, -1200, W * 2, 2400);
    ctx.restore();
    kicker(ctx, c.kicker, 170, neonA(lt, 0.8), sk({ size: 34 }));
    revealText(ctx, c.head, SX, 320, fit(ctx, c.head, 160, 1100), lt, 0.3, 'neon', { seed: 2, step: 0.05 });
    const gi = Math.floor((lt - G0) / (2 * BEAT));
    if (lt >= G0 && gi < c.genres.length) {
      const str = c.genres[gi], g0 = G0 + gi * 2 * BEAT;
      emberText(ctx, str, SX, 490, fit(ctx, str, 120, 1100), { alpha: neon(prog(lt, g0, g0 + 0.22)), glow: 0.9 + 0.3 * kick });
    }
    const listT = G0 + c.genres.length * 2 * BEAT;
    c.lines.forEach((ln, i) => {
      kicker(ctx, ln, 430 + i * 64, neonA(lt, listT + i * 0.25, 0.4),
        sk({ color: i === 0 ? BONE : '#E8621C', size: 38, tracking: 8, glow: i === 0 ? 0 : 18 }));
    });
  }

  // 4 · the first 100 guests get a free drink ticket
  function sFirst100(ctx, lt) {
    const c = C().first100;
    ctx.save();
    drift(ctx, lt, 7, 0.03);
    const g = ctx.createRadialGradient(380, 560, 30, 380, 560, 620);
    g.addColorStop(0, `rgba(232,98,28,${0.3 * fadeA(lt, 1.1, 0.5) * flicker(lt, 2)})`);
    g.addColorStop(1, 'rgba(160,40,12,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, STAGE_W, H);
    kicker(ctx, c.kicker, 300, neonA(lt, 0.1), { x: 380, size: 40, tracking: 14 });
    bigNumber(ctx, lt, c.num, 380, 740, 370, 0.3);
    revealText(ctx, c.line, 985, 560, fit(ctx, c.line, 150, 540), lt, 1.3, 'burn', { step: 0.07 });
    const sub = 'GET A FREE', sub2 = 'DRINK TICKET';
    revealText(ctx, sub, 985, 650, fit(ctx, sub2, 54, 540, 'Figtree', 8, '800'), lt, 1.9, 'fade', { family: 'Figtree', weight: '800', tracking: 8, glow: 0.4 });
    revealText(ctx, sub2, 985, 720, fit(ctx, sub2, 54, 540, 'Figtree', 8, '800'), lt, 2.1, 'fade', { family: 'Figtree', weight: '800', tracking: 8, glow: 0.4 });
    [3.6, 5.8].forEach((s0) => sparkle(ctx, 560, 450, 260, lt, s0));
    ctx.restore();
  }

  // 5 · best group costume contest, neon costume signs
  const COST = [{ x: 330, y: 760, s: 1.0 }, { x: 660, y: 735, s: 1.25 }, { x: 990, y: 770, s: 1.0 }];
  function sContest(ctx, lt) {
    const { neonShape, COSTUMES } = P();
    const c = C().contest;
    ctx.save();
    drift(ctx, lt, 8, 0.025, 600);
    COSTUMES.forEach((p, i) => {
      const L = COST[i];
      const a = neon(prog(lt, p.t0, p.t0 + 0.5)) * (0.9 + 0.1 * flicker(lt, i + 20));
      const [rot, dy] = p.sway(lt);
      const g = ctx.createRadialGradient(L.x, L.y, 10, L.x, L.y, 260 * L.s);
      g.addColorStop(0, `rgba(255,90,30,${0.18 * a})`);
      g.addColorStop(1, 'rgba(255,90,30,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, STAGE_W, H);
      neonShape(ctx, L.x, L.y + dy, L.s, rot, a, p.color, p.path);
      [4.2, 6.6].forEach((s0) => sparkle(ctx, L.x + 60 * L.s, L.y - 130 * L.s + dy, 160, lt, s0 + i * 0.3));
    });
    const head = `${c.l1} ${c.l2}`;
    revealText(ctx, head, SX, 250, fit(ctx, head, 130, 1150), lt, 0.9, 'burn', { step: 0.04 });
    neonLabel(ctx, c.l3, 350, lt, 1.6, sk({ size: 84, tracking: 30, dur: 0.6 }));
    kicker(ctx, c.prize, 420, fadeA(lt, 2.1), sk({ color: BONE, glow: 0, size: 34, tracking: 8 }));
    ctx.restore();
  }

  // 6 · the details, as a two-column invitation card
  const DET = [[380, 345], [940, 345], [380, 520], [940, 520], [SX, 695]];
  function sDetails(ctx, lt) {
    const { titleBurn } = P();
    const items = C().details;
    ctx.save();
    drift(ctx, lt, 9, 0.02);
    titleBurn(ctx, SX - 433 * 0.62, 62, 0.62, lt, 0.2, 0.03);
    rule(ctx, lt, SX, 262, 500, 0.8);
    items.forEach((it, i) => {
      const [x, y] = DET[i];
      const t0 = 1.2 + i * 0.45;
      kicker(ctx, it.kicker, y, neonA(lt, t0, 0.35), { x, size: 28, tracking: 10, glow: 16, maxW: 520 });
      revealText(ctx, it.value, x, y + 72, fit(ctx, it.value, 66, i === 4 ? 900 : 520), lt, t0 + 0.15, 'sweep', { dur: 0.6 });
    });
    const tEnd = 1.2 + 5 * 0.45;
    rule(ctx, lt, SX, 838, 500, tEnd);
    kicker(ctx, C().detailsFooter, 905, neonA(lt, tEnd + 0.4), sk({ color: BONE, glow: 0, size: 28, tracking: 6 }));
    [5.5, 7.6].forEach((s0, i) => sparkle(ctx, SX + (i ? -500 : 500), i ? 838 : 262, 180, lt, s0));
    ctx.restore();
  }

  // 7 · get your tickets: chevrons point at the QR code
  function chevrons(ctx, lt, x, y, a) {
    if (a <= 0.001) return;
    for (let i = 0; i < 3; i++) {
      const ph = (((lt - 1.4) / 1.1 - i * 0.18) % 1 + 1) % 1;
      const k = 0.25 + 0.75 * Math.exp(-ph * 6);
      const cx = x + i * 62;
      ctx.save();
      ctx.globalAlpha = a * k;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(255,80,30,1)';
      ctx.shadowBlur = 26;
      ctx.strokeStyle = '#FF7A3E';
      ctx.lineWidth = 14;
      ctx.beginPath(); ctx.moveTo(cx - 22, y - 50); ctx.lineTo(cx + 22, y); ctx.lineTo(cx - 22, y + 50); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,238,222,0.9)';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }
  }
  function sCta(ctx, lt) {
    const { hGlowBack } = P();
    const c = C().tv;
    const tx = 590;
    ctx.save();
    drift(ctx, lt, 9, 0.025);
    hGlowBack(ctx, lt, tx, 560, 0.6 * fadeA(lt, 0.3, 1.0), 3.6);
    kicker(ctx, c.ctaKicker, 260, neonA(lt, 0.15), { x: tx, size: 38, tracking: 14 });
    const s1 = fit(ctx, c.cta1, 160, 900), s2 = fit(ctx, c.cta2, 230, 900);
    revealText(ctx, c.cta1, tx, 430, s1, lt, 0.4, 'burn', { step: 0.06 });
    revealText(ctx, c.cta2, tx, 430 + s2 * 0.98, s2, lt, 0.8, 'burn', { step: 0.07 });
    kicker(ctx, c.ctaSub, 770, fadeA(lt, 1.8), sk({ color: BONE, glow: 0, size: 30, tracking: 6 }));
    ctx.restore();
    chevrons(ctx, lt, 1130, 520, neonA(lt, 1.4, 0.4));
    setFont(ctx, 'Copperplate', s2);
    const w2 = ctx.measureText(c.cta2).width;
    [2.6, 6.0].forEach((s0) => sparkle(ctx, tx + w2 / 2 - 20, 430 + s2 * 0.98 - s2 * 0.7, 300, lt, s0));
  }

  const SCENES = [
    { dur: 9, into: 'slash', draw: sLockup },
    { dur: 9, into: 'fade', draw: sMoreRoom },
    { dur: 9, into: 'slash', draw: sNight },
    { dur: 7, into: 'fade', draw: sFirst100 },
    { dur: 8, into: 'slash', draw: sContest },
    { dur: 9, into: 'fade', draw: sDetails },
    { dur: 9, into: 'slash', draw: sCta },
  ];
  let acc = 0;
  SCENES.forEach((s) => { s.start = acc; acc += s.dur; });
  if (Math.abs(acc - DUR) > 1e-6) console.error(`tv scenes add up to ${acc}s, not ${DUR}s`);

  function stage(ctx, t) {
    const i = SCENES.findIndex((s) => t >= s.start && t < s.start + s.dur);
    const cur = SCENES[i], prev = SCENES[(i + SCENES.length - 1) % SCENES.length];
    const lt = t - cur.start;
    if (lt >= TR) return cur.draw(ctx, lt);
    // the outgoing scene keeps holding past its end while the new one arrives
    const a = scene(0, (c) => prev.draw(c, prev.dur + lt));
    const b = scene(1, (c) => cur.draw(c, lt));
    const p = lt / TR;
    if (cur.into === 'slash') return slashWipe(ctx, a, b, p, { cx: SX, cy: H / 2, angle: 64 });
    ctx.save();
    ctx.globalAlpha = 1 - ease.in2(p);
    camera(ctx, lerp(1, 1.06, p), SX, H / 2);
    ctx.drawImage(a, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = ease.out2(p);
    ctx.drawImage(b, 0, 0);
    ctx.restore();
  }

  // =============================================================== column
  const ctaBoost = (t) => {
    const s = SCENES[6];
    return ease.inOut2(prog(t, s.start + 1.0, s.start + 1.8)) * (1 - ease.inOut2(prog(t, s.start + s.dur - 0.4, s.start + s.dur + 0.3)));
  };
  // a periodic sparkle (fires every `every` seconds at phase `at`, loops cleanly)
  const pSparkle = (ctx, x, y, size, t, every, at) => sparkle(ctx, x, y, size, t, Math.floor((t - at) / every) * every + at);

  function qrBox() {
    const n = TV.qr.n, s = n * QR.mod + QR.pad * 2;
    return { n, s, x: Math.round(QR.cx - s / 2), y: Math.round(QR.cy - s / 2) };
  }

  function column(ctx, t) {
    const c = C().tv;
    const boost = ctaBoost(t);
    const fl = pflicker(t, DUR, 3);
    // panel + divider
    const bg = ctx.createLinearGradient(STAGE_W, 0, W, 0);
    bg.addColorStop(0, 'rgba(40,10,4,0.55)');
    bg.addColorStop(1, 'rgba(20,6,3,0.35)');
    ctx.fillStyle = bg;
    ctx.fillRect(STAGE_W, 0, W - STAGE_W, H);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const dv = ctx.createLinearGradient(0, 80, 0, H - 80);
    dv.addColorStop(0, 'rgba(232,98,28,0)');
    dv.addColorStop(0.5, `rgba(232,98,28,${0.7 * fl})`);
    dv.addColorStop(1, 'rgba(232,98,28,0)');
    ctx.fillStyle = dv;
    ctx.shadowColor = 'rgba(255,90,30,1)';
    ctx.shadowBlur = 12;
    ctx.fillRect(STAGE_W - 1, 80, 2.5, H - 160);
    ctx.restore();
    // ember glow behind the QR tile (the tile itself is in the overlay)
    const q = qrBox();
    ctx.save();
    ctx.shadowColor = 'rgba(255,70,25,1)';
    ctx.shadowBlur = 40 + 40 * boost;
    ctx.fillStyle = `rgba(255,90,40,${0.55 + 0.35 * boost})`;
    ctx.globalAlpha = 0.75 * fl + 0.25 * boost;
    ctx.beginPath();
    ctx.roundRect(q.x - 6, q.y - 6, q.s + 12, q.s + 12, 24);
    ctx.fill();
    ctx.restore();
    // sparkle peeking from behind the tile's corners now and then
    pSparkle(ctx, q.x + q.s + 2, q.y - 2, 170, t, 12, 5.5);
    pSparkle(ctx, q.x - 2, q.y + q.s + 2, 150, t, 15, 11.0);
    // "scan for tickets" neon, which re-flickers on every 15s
    const blink = neon(clamp((t % 15) / 0.75));
    neonLabel(ctx, c.scan, 178, 1, 0, { x: COL, size: 46, tracking: 10, maxW: 470, color: '#FF9A5C', glow: 38, alpha: (0.85 + 0.15 * fl) * (0.4 + 0.6 * blink) });
    // date, time, pricing note, wordmark
    emberText(ctx, c.date, COL, 760, fit(ctx, c.date, 66, 470), { glow: 0.85 + 0.15 * pflicker(t, DUR, 7) });
    kicker(ctx, c.time, 815, 1, { x: COL, size: 30, tracking: 8, maxW: 470 });
    kicker(ctx, c.cheaper, 862, 0.9, { x: COL, size: 21, tracking: 5, color: BONE, glow: 0, maxW: 470 });
    logo(ctx, COL, 950, 320, 1, 0.16 + 0.06 * pflicker(t, DUR, 11));
  }

  // crisp QR modules on a white tile, drawn after grain/vignette
  function qrOverlay(ctx) {
    const q = qrBox(), m = TV.qr.m;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(q.x, q.y, q.s, q.s, 18);
    ctx.fill();
    ctx.fillStyle = '#0B0605';
    const ox = q.x + QR.pad, oy = q.y + QR.pad;
    for (let r = 0; r < q.n; r++) {
      for (let c = 0; c < q.n; c++) if (m[r][c]) ctx.fillRect(ox + c * QR.mod, oy + r * QR.mod, QR.mod, QR.mod);
    }
    ctx.restore();
  }

  register({
    id: 'tv-loop',
    duration: DUR,
    silent: true,
    weave: false,                 // static screen: no gate weave (keeps the loop seam-free too)
    post: { grain: 0.12, vignette: 0.4 },
    draw(ctx, t) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, STAGE_W, H);
      ctx.clip();
      stage(ctx, t);
      ctx.restore();
      column(ctx, t);
    },
    overlay(ctx) { qrOverlay(ctx); },
  });

  window.HH_TV = { load, SCENES };
})();
