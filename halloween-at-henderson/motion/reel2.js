/* Collab Reels E-G (1080x1920): three more concepts on the same engine.
 *
 *   E · A FIELD GUIDE TO HALLOWEEN   nature-documentary parody: specimen plates
 *       of silent-era monsters and party-goers, field notes typed in, rubber
 *       stamps; British narrator over Grieg's In the Hall of the Mountain King
 *   F · THE GRID    Swiss editorial grid cut to the beat of Skeleton Jangle
 *       (1918): film strips, footage inside giant type
 *   G · THE INVITATION   an engraved invitation read by a British narrator,
 *       ballroom footage in an oval cameo, Sibelius' Valse triste
 *
 * Footage comes from prep_footage.py like the other Reels; soundtracks from
 * reel_audio.py (reel/audio.json). Shared helpers live in reel.js (HH_REEL).
 */
(function () {
  const {
    W, H, clamp, lerp, prog, ease, flicker, neon, hash, vnoise, A, setFont, fit,
    emberText, label, kicker, revealText, register,
  } = window.HH;
  const R = window.HH_REEL;
  const { BONE, footIndex, getImg, frameURL, dust, endCard } = R;
  const EMBER = '#E0301E', PUMPKIN = '#FF8A4C';

  // ------------------------------------------------------------- helpers
  // a footage frame drawn into any rectangle (cover-fit), with weave and a slow push
  const CAPTURE = { on: null };   // when set, filmRect only lists the frames it would draw
  function filmRect(ctx, t, r, shot, grade, o = {}) {
    const url = shot && (shot.still || frameURL(shot, grade, t - shot.t0));
    if (CAPTURE.on) { if (shot) CAPTURE.on.push(url); return; }
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.fillStyle = '#070404';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    if (shot) {
      const e = getImg(url);
      if (e.ok) {
        const im = e.im;
        const s = Math.max(r.w / im.width, r.h / im.height) * (1.03 + 0.025 * (t - shot.t0) + (o.zoom ?? 0));
        const ex = (o.exposure ?? 1) * (shot.exposure ?? 1);
        const wx = (vnoise(t * 7.3) - 0.5) * 3, wy = (vnoise(t * 5.1 + 30) - 0.5) * 4;
        ctx.filter = `brightness(${(ex * (0.94 + 0.08 * vnoise(t * 21 + 3))).toFixed(3)})`;
        ctx.drawImage(im, r.x + (r.w - im.width * s) / 2 + wx, r.y + (r.h - im.height * s) / 2 + wy, im.width * s, im.height * s);
        ctx.filter = 'none';
      }
    }
    dust(ctx, t, r, o.dust ?? 1);
    const v = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) * 0.3, r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 0.72);
    v.addColorStop(0, 'rgba(5,3,3,0)');
    v.addColorStop(1, `rgba(5,3,3,${o.vignette ?? 0.55})`);
    ctx.fillStyle = v;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }
  const shotIn = (shots, t) => {
    for (let i = shots.length - 1; i >= 0; i--) if (t >= shots[i].t0) return shots[i];
    return shots[0];
  };
  // type a string on, character by character
  function typed(str, t, t0, cps = 38) {
    const n = Math.floor(clamp((t - t0) * cps, 0, str.length));
    return str.slice(0, n);
  }
  function hair(ctx, x0, y, x1, a, color = BONE) {
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = color;
    ctx.fillRect(x0, y, x1 - x0, 1.5);
    ctx.restore();
  }

  // ======================================================================
  // E · A FIELD GUIDE TO HALLOWEEN
  // ======================================================================
  const E = (() => {
    const id = 'reel-e-field-guide';
    const grade = 'mono';
    const PLATE = { x: 120, y: 560, w: 840, h: 630 };
    const COVER = { x: 120, y: 690, w: 840, h: 630 };
    const HY = 250;   // header baseline (below Instagram's top bar)
    const END = 34.0, SLIDE = 0.5;
    // page start times (cover + five plates); each page's shots in absolute time
    const pages = [
      { t0: 0.0, shots: [['e_skull', 0]] },
      { t0: 3.5, shots: [['e_orlok_win', 3.5], ['e_orlok', 6.1], ['e_orlok_win', 8.3, 0.8]] },
      { t0: 10.15, shots: [['e_stairs', 10.15], ['e_ball', 12.35], ['e_ball_b', 13.55], ['e_red_death', 14.75]] },
      { t0: 15.5, shots: [['e_devil', 15.5], ['e_cauldron', 16.7, 0, 1.5], ['mask_group', 18.3], ['mask_group2', 19.6]] },
      { t0: 20.85, shots: [['tap_pour', 20.85], ['bar_toast', 22.85], ['bar_smile', 25.05]] },
      { t0: 26.6, shots: [['phone_boy', 26.6], ['news_phones', 28.8], ['phone_girl', 31.2]] },
    ];
    pages.forEach((p, i) => {
      p.t1 = i + 1 < pages.length ? pages[i + 1].t0 : END;
      p.shots = p.shots.map(([clip, t0, at, exposure]) => ({ clip, t0, at: at || 0, exposure: exposure || 1 }));
      p.shots.forEach((s, j) => { s.t1 = j + 1 < p.shots.length ? p.shots[j + 1].t0 : p.t1 + SLIDE; });
    });
    const C = () => A.content.reel.e;

    function grid(ctx, a) {
      if (a <= 0) return;
      ctx.save();
      ctx.fillStyle = BONE;
      for (let x = 30; x < W; x += 60) { ctx.globalAlpha = a * (x % 300 === 30 ? 0.06 : 0.028); ctx.fillRect(x, 0, 1, H); }
      for (let y = 0; y < H; y += 60) { ctx.globalAlpha = a * (y % 300 === 0 ? 0.06 : 0.028); ctx.fillRect(0, y, W, 1); }
      ctx.restore();
    }
    // registration ticks at the plate's corners
    function ticks(ctx, r, a) {
      ctx.save();
      ctx.globalAlpha *= a;
      ctx.strokeStyle = BONE;
      ctx.lineWidth = 2;
      const L = 26, g = 12;
      [[r.x, r.y, -1, -1], [r.x + r.w, r.y, 1, -1], [r.x, r.y + r.h, -1, 1], [r.x + r.w, r.y + r.h, 1, 1]].forEach(([x, y, sx, sy]) => {
        ctx.beginPath();
        ctx.moveTo(x + sx * g, y + sy * (g + L)); ctx.lineTo(x + sx * g, y + sy * g); ctx.lineTo(x + sx * (g + L), y + sy * g);
        ctx.stroke();
      });
      ctx.globalAlpha *= 0.35;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.restore();
    }
    // a rubber stamp pressed onto the plate (gentle: it fades and settles)
    function stamp(ctx, str, x, y, t, t0) {
      if (t < t0) return;
      const p = ease.out3(prog(t, t0, t0 + 0.35));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.16);
      ctx.scale(1.12 - 0.12 * p, 1.12 - 0.12 * p);
      ctx.globalAlpha *= 0.92 * p;
      const size = fit(ctx, str, 44, 420, 'Figtree', 6, '800');
      setFont(ctx, 'Figtree', size, '800');
      ctx.letterSpacing = '6px';
      const w = ctx.measureText(str).width + 50, h = size + 40;
      ctx.strokeStyle = EMBER;
      ctx.lineWidth = 5;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.lineWidth = 2;
      ctx.strokeRect(-w / 2 + 9, -h / 2 + 9, w - 18, h - 18);
      ctx.fillStyle = EMBER;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(str, 3, 3);
      // worn ink: knock holes out of the stamp
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 70; i++) {
        const hx = (hash(i * 3.1 + str.length) - 0.5) * w, hy = (hash(i * 7.7 + 2) - 0.5) * h;
        ctx.globalAlpha = 0.5 * hash(i * 1.9);
        ctx.beginPath();
        ctx.arc(hx, hy, 1 + 3 * hash(i * 5.3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    function header(ctx, t, i) {
      const a = 0.85;
      label(ctx, C().guide, PLATE.x, HY, 20, { tracking: 7, align: 'left', alpha: a * 0.75 });
      const no = i === 0 ? 'COVER' : `PLATE ${String(i).padStart(2, '0')} / 05`;
      label(ctx, no, PLATE.x + PLATE.w, HY, 20, { tracking: 7, align: 'right', color: PUMPKIN, alpha: a });
      hair(ctx, PLATE.x, HY + 24, PLATE.x + PLATE.w, 0.35);
    }
    function cover(ctx, t) {
      const c = C().cover;
      kicker(ctx, c.kicker, 400, 1, { size: 40, tracking: 14, glow: 20 });
      const lines = c.title.split('\n');
      const size = Math.min(...lines.map((l) => fit(ctx, l, 120, 860)));
      lines.forEach((l, k) => emberText(ctx, l, W / 2, 520 + k * size * 1.04, size, { glow: 0.9 + 0.1 * flicker(t, 3 + k) }));
      filmRect(ctx, t, COVER, shotIn(pages[0].shots, t), grade);
      ticks(ctx, COVER, 1);
      label(ctx, 'FIG. 00', COVER.x, COVER.y + COVER.h + 44, 22, { tracking: 8, align: 'left', alpha: 0.6 });
      kicker(ctx, c.sub, COVER.y + COVER.h + 110, ease.out2(prog(t, 0.6, 1.2)), { size: 30, tracking: 8, glow: 0, color: BONE });
    }
    function plate(ctx, t, i) {
      const pg = pages[i], c = C().plates[i - 1], lt = t - pg.t0;
      const size = fit(ctx, c.name, 124, 860);
      revealText(ctx, c.name, W / 2, 448, size, t, pg.t0 + 0.2, 'burn', { step: 0.035, seed: i });
      label(ctx, c.latin, W / 2, 506, 28, { tracking: 12, color: PUMPKIN, alpha: ease.out2(prog(lt, 0.6, 1.1)), weight: '700' });
      filmRect(ctx, t, PLATE, shotIn(pg.shots, t), grade);
      ticks(ctx, PLATE, 1);
      const fy = PLATE.y + PLATE.h + 44;
      label(ctx, `FIG. ${String(i).padStart(2, '0')}`, PLATE.x, fy, 22, { tracking: 8, align: 'left', alpha: 0.6 });
      label(ctx, c.fig, PLATE.x + PLATE.w, fy, 22, { tracking: 6, align: 'right', alpha: 0.6 });
      // field notes, typed in row by row
      c.notes.forEach(([k, v], r) => {
        const y = 1318 + r * 76, r0 = 0.9 + r * 0.5;
        const a = ease.out2(prog(lt, r0, r0 + 0.3));
        hair(ctx, PLATE.x, y + 26, PLATE.x + PLATE.w, 0.22 * a);
        label(ctx, k, PLATE.x, y, 24, { tracking: 8, align: 'left', color: PUMPKIN, alpha: a });
        const vs = fit(ctx, v, 38, 600, 'Figtree', 3, '800');
        label(ctx, typed(v, lt, r0 + 0.1), PLATE.x + 230, y, vs, { tracking: 3, align: 'left', alpha: a });
      });
      stamp(ctx, c.stamp, PLATE.x + PLATE.w - 200, PLATE.y + PLATE.h - 110, lt, 2.6);
    }
    function page(ctx, t, i) {
      if (i === 0) cover(ctx, t); else plate(ctx, t, i);
    }
    return {
      id,
      duration: 44,
      audio: 'reel/audio/reel-e-field-guide.wav',
      silent: true,
      cues: [],
      async prepare(t) {
        await footIndex();
        const ps = pages.filter((p) => t >= p.t0 - 0.01 && t < p.t1 + SLIDE);
        await Promise.all(ps.map((p) => { const s = shotIn(p.shots, t); return getImg(frameURL(s, grade, t - s.t0)).p; }));
      },
      draw(ctx, t) {
        const out = ease.inOut2(prog(t, END, END + 0.6));
        grid(ctx, 1 - out);
        if (t < END + SLIDE) {
          const cur = pages.findIndex((p) => t >= p.t0 && t < p.t1);
          ctx.save();
          ctx.globalAlpha = 1 - prog(t, END, END + 0.4);
          header(ctx, t, Math.max(cur, 0));
          ctx.restore();
          pages.forEach((p, i) => {
            // pages slide in from the right and off to the left, like turning a plate
            const inP = i === 0 ? 1 : ease.inOut2(prog(t, p.t0, p.t0 + SLIDE));
            const outP = ease.inOut2(prog(t, p.t1, p.t1 + SLIDE));
            if (inP <= 0 || outP >= 1) return;
            const dx = (1 - inP) * W * 0.6 - outP * W * 0.6;
            ctx.save();
            ctx.translate(dx, 0);
            ctx.globalAlpha = Math.min(inP, 1 - outP);
            page(ctx, t, i);
            ctx.restore();
          });
        }
        endCard(ctx, t, END);
      },
    };
  })();

  // ======================================================================
  // G · THE INVITATION
  // ======================================================================
  const G = (() => {
    const id = 'reel-g-the-invitation';
    const grade = 'ember';
    const END = 30.2, XF = 0.45;   // end card; cross-dissolve between cameo shots
    const CAM = { cx: 540, cy: 760, rx: 300, ry: 410 };
    const cardT = [0, 2.0, 5.6, 10.4, 12.9, 17.9, 21.2, 25.2, END];
    const shots = [
      ['e_stairs', 0], ['gown', 2.0], ['dance_curtain', 4.3], ['car_night', 5.9], ['mask_red', 8.3], ['mask_man', 10.4],
      ['e_ball', 12.9], ['dance_twirl', 14.0], ['e_ball_b', 15.4], ['jive_a', 16.5], ['bar_smile', 17.9], ['bar_toast', 19.6],
      ['mask_group', 21.2], ['arrive_group', 23.2], ['phone_girl', 25.2], ['e_unmask', 27.6],
    ].map(([clip, t0], i, a) => ({ clip, t0, t1: i + 1 < a.length ? a[i + 1][1] : END + 0.6 }));
    const C = () => A.content.reel.g;

    function ovalPath(ctx, k = 0) {
      ctx.beginPath();
      ctx.ellipse(CAM.cx, CAM.cy, CAM.rx + k, CAM.ry + k, 0, 0, Math.PI * 2);
    }
    function shotFrame(ctx, t, s, a) {
      const e = getImg(frameURL(s, grade, t - s.t0));
      if (!e.ok || a <= 0) return;
      const im = e.im, bw = CAM.rx * 2, bh = CAM.ry * 2;
      const z = Math.max(bw / im.width, bh / im.height) * (1.04 + 0.02 * (t - s.t0));
      ctx.save();
      ctx.globalAlpha *= a;
      ctx.filter = `brightness(${(0.95 + 0.08 * flicker(t, 6)).toFixed(3)})`;   // candlelight
      ctx.drawImage(im, CAM.cx - im.width * z / 2, CAM.cy - im.height * z / 2, im.width * z, im.height * z);
      ctx.restore();
    }
    function cameo(ctx, t, a) {
      if (a <= 0) return;
      ctx.save();
      ctx.globalAlpha = a;
      ovalPath(ctx);
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#070404';
      ctx.fillRect(0, 0, W, H);
      // current shot, dissolving in over the previous one
      const i = shots.findIndex((s) => t >= s.t0 && t < s.t1);
      if (i >= 0) {
        if (i > 0 && t < shots[i].t0 + XF) shotFrame(ctx, t, shots[i - 1], 1);
        shotFrame(ctx, t, shots[i], i === 0 ? 1 : ease.inOut2(prog(t, shots[i].t0, shots[i].t0 + XF)));
      }
      dust(ctx, t, { x: CAM.cx - CAM.rx, y: CAM.cy - CAM.ry, w: CAM.rx * 2, h: CAM.ry * 2 }, 0.8);
      const v = ctx.createRadialGradient(CAM.cx, CAM.cy, CAM.rx * 0.55, CAM.cx, CAM.cy, CAM.ry * 1.02);
      v.addColorStop(0, 'rgba(5,3,3,0)');
      v.addColorStop(1, 'rgba(5,3,3,0.85)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      // a double rule around the cameo: hairline bone, ember outside
      ctx.strokeStyle = BONE;
      ctx.globalAlpha = a * 0.55;
      ctx.lineWidth = 1.5;
      ovalPath(ctx, 10);
      ctx.stroke();
      ctx.strokeStyle = EMBER;
      ctx.globalAlpha = a * 0.5;
      ctx.shadowColor = 'rgba(224,48,30,0.9)';
      ctx.shadowBlur = 16;
      ovalPath(ctx, 22);
      ctx.stroke();
      ctx.restore();
    }
    // the invitation's border: a double rule with diamond corners
    function border(ctx, t) {
      const a = ease.out2(prog(t, 0, 0.01)) * (0.9 + 0.1 * flicker(t, 2));
      ctx.save();
      ctx.strokeStyle = BONE;
      ctx.globalAlpha = 0.32 * a;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(56, 56, W - 112, H - 112);
      ctx.globalAlpha = 0.5 * a;
      ctx.strokeStyle = EMBER;
      ctx.strokeRect(70, 70, W - 140, H - 140);
      ctx.fillStyle = PUMPKIN;
      [[70, 70], [W - 70, 70], [70, H - 70], [W - 70, H - 70]].forEach(([x, y]) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.globalAlpha = 0.8 * a;
        ctx.fillRect(-7, -7, 14, 14);
        ctx.restore();
      });
      ctx.restore();
    }
    // engraved-feeling type: bone with a soft ember halo, focusing in from a blur
    function engraved(ctx, str, y, size, t, t0, t1, o = {}) {
      const a = ease.out3(prog(t, t0, t0 + 0.8)) * (1 - ease.in2(prog(t, t1 - 0.3, t1)));
      if (a <= 0.001) return;
      ctx.save();
      if (a < 1) ctx.filter = `blur(${((1 - ease.out3(prog(t, t0, t0 + 0.8))) * 10).toFixed(2)}px)`;
      label(ctx, str, W / 2, y, size, {
        family: o.family || 'Copperplate', weight: o.weight || '', tracking: (o.tracking ?? 3) + (1 - a) * 6,
        color: o.color || BONE, alpha: a, glow: o.glow ?? 18, glowColor: 'rgba(224,48,30,0.55)',
      });
      ctx.restore();
    }
    function card(ctx, t, i) {
      const c = C().cards[i], t0 = cardT[i], t1 = cardT[i + 1];
      const lines = c.h.split('\n');
      const size = Math.min(...lines.map((l) => fit(ctx, l, 84, 860, 'Copperplate', 3)));
      const y0 = 1300;
      if (c.k) engraved(ctx, c.k, y0 - size * 1.15, fit(ctx, c.k, 30, 760, 'Figtree', 10, '800'), t, t0 + 0.05, t1, { family: 'Figtree', weight: '800', tracking: 10, color: PUMPKIN, glow: 10 });
      lines.forEach((l, k) => {
        // frame 0 shows the hook fully: no fade on the first card
        if (i === 0) label(ctx, l, W / 2, y0 + k * size * 1.08, size, { family: 'Copperplate', weight: '', tracking: 3, glow: 18, glowColor: 'rgba(224,48,30,0.55)', alpha: 1 - ease.in2(prog(t, t1 - 0.3, t1)) });
        else engraved(ctx, l, y0 + k * size * 1.08, size, t, t0 + 0.2 + k * 0.25, t1);
      });
      if (c.s) engraved(ctx, c.s, y0 + lines.length * size * 1.08 + 30, 28, t, t0 + 0.8, t1, { family: 'Figtree', weight: '800', tracking: 8, glow: 0 });
    }
    // embers drifting up past the cameo
    function motes(ctx, t, a) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 26; i++) {
        const sp = 40 + 60 * hash(i * 2.3), x = 120 + hash(i * 9.1) * 840 + Math.sin(t * 0.8 + i) * 20;
        const y = H - ((t * sp + hash(i * 4.7) * H) % H);
        const r = 1.2 + 2.2 * hash(i * 1.7);
        ctx.globalAlpha = a * 0.5 * (0.4 + 0.6 * flicker(t, i));
        ctx.fillStyle = i % 3 ? PUMPKIN : '#FFD2A8';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    return {
      id,
      duration: 40,
      audio: 'reel/audio/reel-g-the-invitation.wav',
      silent: true,
      cues: [],
      async prepare(t) {
        await footIndex();
        const i = shots.findIndex((s) => t >= s.t0 && t < s.t1);
        if (i < 0) return;
        const need = [shots[i]];
        if (i > 0 && t < shots[i].t0 + XF) need.push(shots[i - 1]);
        await Promise.all(need.map((s) => getImg(frameURL(s, grade, t - s.t0)).p));
      },
      draw(ctx, t) {
        border(ctx, t);
        const out = 1 - ease.inOut2(prog(t, END, END + 0.6));
        motes(ctx, t, out);
        if (t < END + 0.6) {
          cameo(ctx, t, out);
          ctx.save();
          ctx.globalAlpha = out;
          label(ctx, C().ornament, W / 2, 250, 22, { tracking: 12, color: BONE, alpha: 0.6 });
          ctx.restore();
          for (let i = 0; i < cardT.length - 1; i++) if (t >= cardT[i] && t < cardT[i + 1]) card(ctx, t, i);
        }
        endCard(ctx, t, END);
      },
    };
  })();

  // ======================================================================
  // F · THE GRID
  // ======================================================================
  // the grid Reels share one system; each cut is a list of sections, eight beats apiece by default
  function makeGrid(cfg) {
    const BOX = { x: 40, y: 200, w: 1000, h: 1400 }, GUT = 14;
    const BEATS = { list: null };
    const beatsReady = fetch('reel/beats-f.json').then((r) => r.json()).then((j) => { BEATS.list = j.beats; });
    const b = (n) => BEATS.list[n];
    const beatAt = (t) => { const L = BEATS.list; let i = 0; while (i + 1 < L.length && L[i + 1] <= t) i++; return i; };
    // sections run eight beats unless given as [name, beats]
    const SECS = cfg.sections.map((x) => (Array.isArray(x) ? { name: x[0], beats: x[1] } : { name: x, beats: 8 }));
    SECS.reduce((n, sc) => { sc.n0 = n; return n + sc.beats; }, 0);
    const END_BEAT = SECS.reduce((n, sc) => n + sc.beats, 0);
    const C = () => A.content.reel.f;
    const buf = window.HH.canvas(W, H);
    // big type: the heavy grotesk, or the poster's Copperplate
    const COPPER = cfg.font === 'copperplate';
    const FONT = COPPER ? 'Copperplate' : 'Figtree', WEIGHT = COPPER ? '' : '800', TRACK = COPPER ? 1 : -2;
    const big = (ctx, str, size, maxW, plain) => (plain ? fit(ctx, str, size, maxW, 'Figtree', -2, '800') : fit(ctx, str, size, maxW, FONT, TRACK, WEIGHT));

    // a cell's footage at time t: pool rotates every `every` beats from beat n0;
    // grade 'hr' = a still photo from reel/hr/, shown in its own colour
    function pick(pool, t, n0, every = 2, off = 0) {
      const bi = beatAt(t);
      const k = Math.max(0, Math.floor((bi - n0) / every));
      const [clip, grade] = pool[(k + off) % pool.length];
      const t0 = b(n0 + k * every);
      return grade === 'hr' ? { shot: { still: `reel/hr/${clip}.jpg`, t0 }, grade } : { shot: { clip, t0, at: 0.2 }, grade };
    }
    function cell(ctx, t, r, pool, n0, o = {}) {
      const f = pick(pool, t, n0, o.every ?? 2, o.off ?? 0);
      filmRect(ctx, t, r, f.shot, f.grade, { vignette: o.vignette ?? 0.45, dust: f.grade === 'hr' ? 0.3 : 0.7, exposure: o.exposure });
      return f;
    }
    // light from the visuals team's footage laid over the film (screen blend), kicking on each beat
    function lights(ctx, t, r, n0, amt = 0.6) {
      const bi = beatAt(t);
      const k = Math.max(0, Math.floor((bi - n0) / 2));
      const shot = { clip: P.over[(k + n0) % P.over.length], t0: b(n0 + k * 2), at: 0.3 };
      const url = frameURL(shot, 'color', t - shot.t0);
      if (CAPTURE.on) { CAPTURE.on.push(url); return; }
      const e = getImg(url);
      if (!e.ok) return;
      const kick = Math.exp(-(t - b(bi)) * 5);
      const im = e.im, z = Math.max(r.w / im.width, r.h / im.height) * (1.05 + 0.04 * kick);
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = amt * (0.55 + 0.45 * kick);
      ctx.drawImage(im, r.x + (r.w - im.width * z) / 2, r.y + (r.h - im.height * z) / 2, im.width * z, im.height * z);
      ctx.restore();
    }
    const rows = (n, r = BOX) => [...Array(n)].map((_, i) => ({ x: r.x, y: r.y + i * (r.h - GUT * (n - 1)) / n + i * GUT, w: r.w, h: (r.h - GUT * (n - 1)) / n }));
    const grid4 = (r = BOX) => {
      const w = (r.w - GUT) / 2, h = (r.h - GUT) / 2;
      return [[0, 0], [1, 0], [0, 1], [1, 1]].map(([i, j]) => ({ x: r.x + i * (w + GUT), y: r.y + j * (h + GUT), w, h }));
    };
    // big words, a soft rise on entry (no slams)
    function word(ctx, str, x, y, size, t, t0, o = {}) {
      if (t < t0) return;
      const p = o.instant ? 1 : ease.out3(prog(t, t0, t0 + 0.18));
      const small = o.small;   // kickers and info lines stay in Figtree
      const plain = small || o.plain;   // o.plain: a big word set in Figtree (the hook, for legibility)
      label(ctx, str, x, y + (1 - p) * 18, size, {
        family: plain ? 'Figtree' : FONT, weight: plain ? '800' : WEIGHT, tracking: o.tracking ?? (small ? 0 : plain ? -2 : TRACK),
        align: o.align || 'left', color: o.color || BONE, alpha: p * (o.alpha ?? 1), glow: o.glow ?? 0,
      });
    }
    // footage seen through the letters of a huge word
    function filmType(ctx, t, str, cx, base, maxW, pool, n0) {
      const tr = COPPER ? 2 : -8;
      const size = fit(ctx, str, 520, maxW, FONT, tr, WEIGHT);
      const top = base - size * 0.74;
      const r = { x: 0, y: top - 20, w: W, h: size * 0.78 + 40 };
      if (CAPTURE.on) { cell(ctx, t, r, pool, n0); return size; }
      const g = buf.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, W, H);
      cell(g, t, r, pool, n0, { vignette: 0.15, exposure: 1.25 });
      g.globalCompositeOperation = 'destination-in';
      setFont(g, FONT, size, WEIGHT);
      g.letterSpacing = `${tr}px`;
      g.textAlign = 'center';
      g.fillStyle = '#000';
      g.fillText(str, cx, base);
      // a thin ember keyline under the film so the letters hold their shape on dark frames
      ctx.save();
      setFont(ctx, FONT, size, WEIGHT);
      ctx.letterSpacing = `${tr}px`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = EMBER;
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(224,48,30,0.8)';
      ctx.shadowBlur = 24;
      ctx.strokeText(str, cx, base);
      ctx.restore();
      ctx.drawImage(buf, 0, 0);
      return size;
    }
    const block = (ctx, r, color) => { ctx.fillStyle = color; ctx.fillRect(r.x, r.y, r.w, r.h); };
    // darken the foot of a strip so its word reads over any frame
    function foot(ctx, r) {
      const g = ctx.createLinearGradient(0, r.y + r.h * 0.35, 0, r.y + r.h);
      g.addColorStop(0, 'rgba(5,3,3,0)');
      g.addColorStop(1, 'rgba(5,3,3,0.78)');
      ctx.fillStyle = g;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }

    const P = {
      hook: [['sk_line', 'ember'], ['jive_a', 'ember'], ['e_ball', 'ember'], ['dance_twirl', 'ember'], ['sk_pairs', 'ember'], ['mask_red', 'ember'], ['sk_solo', 'ember'], ['e_stairs', 'ember']],
      // the visuals team's lasers and mapped walls inside the 10.31
      date: [['v_laserfan', 'color'], ['v_pinkwall', 'color'], ['v_octagon', 'color'], ['v_beams4', 'color']],
      dead: [['sk_rise', 'ember'], ['sk_line', 'ember'], ['sk_pairs', 'ember'], ['sk_solo', 'ember']],
      dance: [['dance_band', 'mono'], ['sk_pairs', 'ember'], ['jive_c', 'ember'], ['e_ball_b', 'mono'], ['sk_solo', 'mono'], ['dance_close', 'ember'], ['jive_d', 'mono'], ['sk_line', 'ember'], ['dance_smile', 'ember'], ['dance_twirl', 'mono']],
      genres: [['horns', 'ember'], ['sk_line', 'mono'], ['coney_sunburst', 'ember']],
      // Holographic Realms' own event footage, in its own colour
      light: [['v_warehouse2', 'color'], ['v_dj', 'color'], ['v_crowdbeams', 'color'], ['v_pinkwall', 'color']],
      lightStrips: [['v_beams', 'color'], ['v_octagon', 'color'], ['v_booth', 'color'], ['v_beams4', 'color'], ['v_warehouse3', 'color'], ['v_crowdbeams2', 'color'],
        ['v_octagon2', 'color'], ['v_dj2', 'color'], ['v_beams3', 'color'], ['v_lasercrowd', 'color'], ['v_fog', 'color']],
      danceReal: [['v_dj', 'color'], ['v_crowdbeams', 'color'], ['v_beams3', 'color'], ['v_lasercrowd', 'color'], ['v_dj2', 'color'], ['v_beams4', 'color']],
      over: ['v_laserfan', 'v_beams', 'v_crowdbeams2', 'v_octagon', 'v_laserpink', 'v_booth'],
      masks: [['mask_red', 'ember'], ['cal_wake', 'mono'], ['e_unmask', 'ember'], ['v_costume', 'color'], ['jek_face', 'ember'], ['mask_crowd', 'mono'], ['h_devil', 'blood'], ['cal_jane', 'ember'], ['mask_group2', 'ember'], ['jek_claw', 'mono']],
      group: [['mask_group', 'ember'], ['sk_line', 'ember'], ['mask_crowd', 'ember'], ['e_ball', 'mono']],
      drink: [['bar_toast', 'ember'], ['tap_pour', 'ember'], ['pour_spot', 'ember'], ['bar_smile', 'ember']],
    };

    const SEC = {
      hook(ctx, t, n0) {   // HALLOWEEN / AT / HENDERSON on three strips of film; on screen at frame 0
        const rs = rows(3);
        C().hook.forEach((w, i) => {
          cell(ctx, t, rs[i], P.hook, n0, { off: i * 2 });
          foot(ctx, rs[i]);
          word(ctx, w, rs[i].x + 28, rs[i].y + rs[i].h - 34, big(ctx, w, 240, rs[i].w - 60, true), t, 0, { instant: true, plain: true });
        });
      },
      date(ctx, t, n0) {   // 10.31 in film
        const d = C().date;
        word(ctx, d.k, W / 2, 600, 64, t, b(n0), { align: 'center', tracking: 14, color: PUMPKIN, small: true });
        filmType(ctx, t, d.n, W / 2, 1060, 1000, P.date, n0);
        word(ctx, d.s, W / 2, 1270, 96, t, b(n0 + 2), { align: 'center', small: true });
      },
      dead(ctx, t, n0) {   // THE DEAD / WILL DANCE over the skeletons, light from the visuals on top
        cell(ctx, t, BOX, P.dead, n0, { vignette: 0.55 });
        lights(ctx, t, BOX, n0, 0.45);
        foot(ctx, BOX);
        C().dead.forEach((w, i) => {
          const s = big(ctx, C().dead[1], 210, 930);
          word(ctx, w, BOX.x + 36, BOX.y + BOX.h - 60 - (1 - i) * s * 0.98, s, t, b(n0 + i * 2), { color: i ? PUMPKIN : BONE });
        });
      },
      dance(ctx, t, n0) {   // four dance cells cutting on alternate beats, the visuals' light over them, DJS ALL NIGHT across
        // old film and the visuals team's real nights, dancing side by side
        grid4().forEach((r, i) => cell(ctx, t, r, i === 1 || i === 2 ? P.danceReal : P.dance, n0 + (i % 2), { off: i * 2 }));
        lights(ctx, t, BOX, n0, 0.3);
        const bar = { x: BOX.x, y: BOX.y + BOX.h / 2 - 95, w: BOX.w, h: 190 };
        if (t >= b(n0 + 1)) {
          block(ctx, bar, EMBER);
          const s = big(ctx, C().djs, 150, 940);
          word(ctx, C().djs, W / 2, bar.y + bar.h / 2 + s * 0.36, s, t, b(n0 + 1), { align: 'center', color: '#0A0505' });
        }
      },
      genres(ctx, t, n0) {   // BASS / TECHNO / POP REMIXES, one strip per two beats
        rows(3).forEach((r, i) => {
          const t0 = b(n0 + i * 2);
          if (t < t0) { ctx.save(); ctx.strokeStyle = BONE; ctx.globalAlpha = 0.2; ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.restore(); return; }
          cell(ctx, t, r, P.genres, n0 + i * 2, { every: 99, off: i });
          lights(ctx, t, r, n0 + i, 0.4);
          foot(ctx, r);
          const w = C().genres[i];
          word(ctx, w, r.x + 28, r.y + r.h - 34, big(ctx, w, 230, r.w - 60), t, t0);
        });
      },
      light(ctx, t, n0) {   // the room: Holographic Realms' visuals full frame, in colour
        const c = C().light;
        cell(ctx, t, BOX, P.light, n0, { vignette: 0.35 });
        foot(ctx, BOX);
        word(ctx, c.k, BOX.x + 36, BOX.y + 70, 26, t, b(n0), { tracking: 8, color: BONE, alpha: 0.85, small: true });
        const s = Math.min(...c.h.map((w) => big(ctx, w, 190, 930)));
        c.h.forEach((w, i) => {
          word(ctx, w, BOX.x + 36, BOX.y + BOX.h - 60 - (c.h.length - 1 - i) * s * 0.98, s, t, b(n0 + 1 + i * 2), { color: i ? PUMPKIN : BONE });
        });
      },
      lightStrips(ctx, t, n0) {   // VISUALS / LIGHTS / ALL NIGHT on three strips of the visuals
        rows(3).forEach((r, i) => {
          const t0 = b(n0 + i * 2);
          if (t < t0) { ctx.save(); ctx.strokeStyle = BONE; ctx.globalAlpha = 0.2; ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.restore(); return; }
          cell(ctx, t, r, P.lightStrips, n0 + i * 2, { off: i * 4 });
          foot(ctx, r);
          const w = C().lights[i];
          word(ctx, w, r.x + 28, r.y + r.h - 34, big(ctx, w, 230, r.w - 60), t, t0);
        });
      },
      costume(ctx, t, n0) {   // masks grid, COME IN / COSTUME on a bone band
        grid4().forEach((r, i) => cell(ctx, t, r, P.masks, n0 + (i % 2), { off: i * 2 }));
        const band = { x: BOX.x, y: BOX.y + BOX.h / 2 - 190, w: BOX.w, h: 380 };
        if (t >= b(n0 + 2)) {
          block(ctx, band, BONE);
          C().costume.forEach((w, i) => {
            const s = big(ctx, C().costume[1], 170, 920);
            word(ctx, w, W / 2, band.y + 170 + i * s * 0.98, s, t, b(n0 + 2 + i), { align: 'center', color: '#0A0505' });
          });
        }
      },
      group(ctx, t, n0) {   // one big frame, BEST GROUP / COSTUME WINS
        cell(ctx, t, BOX, P.group, n0, { vignette: 0.6 });
        const sh = ctx.createLinearGradient(0, BOX.y, 0, BOX.y + 520);
        sh.addColorStop(0, 'rgba(5,3,3,0.8)');
        sh.addColorStop(1, 'rgba(5,3,3,0)');
        ctx.fillStyle = sh;
        ctx.fillRect(BOX.x, BOX.y, BOX.w, 520);
        C().group.forEach((w, i) => {
          const s = big(ctx, C().group[1], 200, 930);
          word(ctx, w, BOX.x + 36, BOX.y + 40 + s * (0.8 + i * 0.98), s, t, b(n0 + i * 2), { color: i ? PUMPKIN : BONE });
        });
      },
      drink(ctx, t, n0) {   // 100 in film
        const d = C().drink;
        word(ctx, d.k, W / 2, 560, 64, t, b(n0), { align: 'center', tracking: 14, color: PUMPKIN, small: true });
        filmType(ctx, t, d.n, W / 2, 1090, 1000, P.drink, n0);
        const s = fit(ctx, d.s, 70, 980, 'Figtree', 0, '800');
        word(ctx, d.s, W / 2, 1280, s, t, b(n0 + 2), { align: 'center', small: true });
      },
      early(ctx, t, n0) {   // THE EARLIER / YOU BUY, / THE LESS / YOU PAY. on blocks, a line per two beats
        rows(4).forEach((r, i) => {
          const t0 = b(n0 + i * 2);
          if (t < t0) return;
          const col = [EMBER, BONE, EMBER, BONE][i];
          ctx.save();
          ctx.globalAlpha = ease.out3(prog(t, t0, t0 + 0.12));
          block(ctx, r, col);
          ctx.restore();
          const w = C().early[i], s = big(ctx, w, 220, r.w - 60);
          word(ctx, w, r.x + 28, r.y + r.h / 2 + s * 0.36, s, t, t0, { color: '#0A0505' });
        });
      },
    };

    function chrome(ctx, t, a) {
      if (a <= 0) return;
      const [h1, h2] = C().head, [f1, f2] = C().foot;
      label(ctx, h1, BOX.x, 160, 22, { tracking: 8, align: 'left', alpha: 0.75 * a });
      label(ctx, h2, BOX.x + BOX.w, 160, 22, { tracking: 8, align: 'right', color: PUMPKIN, alpha: a });
      label(ctx, f1, BOX.x, BOX.y + BOX.h + 56, 22, { tracking: 8, align: 'left', alpha: 0.75 * a });
      label(ctx, f2, BOX.x + BOX.w, BOX.y + BOX.h + 56, 22, { tracking: 8, align: 'right', color: PUMPKIN, alpha: a });
      hair(ctx, BOX.x, 184, BOX.x + BOX.w, 0.3 * a);
    }
    const section = (t) => { const bi = beatAt(t); let k = 0; while (k + 1 < SECS.length && SECS[k + 1].n0 <= bi) k++; return bi < END_BEAT ? k : SECS.length; };

    return {
      id: cfg.id,
      duration: cfg.duration,
      audio: `reel/audio/${cfg.id}.wav`,
      silent: true,
      cues: [],
      async prepare(t) {
        await Promise.all([footIndex(), beatsReady]);
        // draw once off-screen to learn which frames this moment needs, then wait for them
        const want = [];
        const k = section(t);
        if (k < SECS.length) {
          try { CAPTURE.on = want; SEC[SECS[k].name](window.HH.canvas(8, 8).getContext('2d'), t, SECS[k].n0); } finally { CAPTURE.on = null; }
        }
        await Promise.all(want.map((u) => getImg(u).p));
      },
      draw(ctx, t) {
        const k = section(t);
        const endT = b(END_BEAT);
        chrome(ctx, t, 1 - prog(t, endT, endT + 0.3));
        if (k < SECS.length) SEC[SECS[k].name](ctx, t, SECS[k].n0);
        endCard(ctx, t, endT);
      },
    };
  }
  // F: the main collab post; F-long: the extended cut. Big words in the poster's Copperplate,
  // except the opening HALLOWEEN / AT / HENDERSON, kept in Figtree so it reads instantly
  const F = makeGrid({ id: 'reel-f-the-grid', duration: 28, font: 'copperplate', sections: ['hook', 'date', 'dance', 'genres', 'light', 'costume', 'group', 'early'] });
  const FL = makeGrid({
    id: 'reel-f-the-grid-long', duration: 37, font: 'copperplate',
    sections: ['hook', 'date', 'dead', 'dance', 'genres', 'light', ['lightStrips', 16], 'costume', 'group', 'early'],
  });

  [E, F, FL, G].forEach(register);
})();
