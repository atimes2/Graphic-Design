/* Halloween at Henderson: venue TV loop v2 (1920x1080, silent, seamless, 66s).
 *
 * The collab Reel's editorial grid, rebuilt for a landscape screen. A stage on
 * the left (48..1400) runs fourteen sections on a steady 120 BPM grid (cuts on
 * the beat): film strips spelling HALLOWEEN AT HENDERSON, 10.31 with footage
 * inside the numerals, silent-film intertitles before Nosferatu and Caligari,
 * Skeleton Dance (1929) skeletons, Holographic Realms' own event footage, the
 * horror-icon costume grid, and the knife-and-pumpkin poster.
 *
 * A fixed column on the right keeps the ticket QR code, date and wordmark on
 * screen the whole time. The QR is drawn as crisp pixel-aligned modules above
 * the grain and vignette so it always scans. Column motion is periodic in the
 * loop length and the last section cuts to the first, so the file loops with
 * no seam. Footage comes from prep_footage.py (reel/footage.json); copy is in
 * content.json under tv2.
 */
(function () {
  const {
    W, H, clamp, prog, ease, flicker, pflicker, neon, hash, vnoise,
    A, canvas, sparkle, setFont, fit, emberText, label, kicker, revealText, neonLabel,
    art, artTip, artH, logo, register,
  } = window.HH;
  const P = () => window.HH_PARTS;
  const C = () => A.content.tv2;
  const BONE = '#FFF1E0', EMBER = '#E0301E', PUMPKIN = '#FF8A4C', INK = '#0A0505';
  const FPS = 30;

  const BEAT = 0.5;
  const STAGE = { x: 48, y: 96, w: 1352, h: 888 }, GUT = 14;
  const COLX = 1660;                       // column centre
  const QR = { cx: COLX, cy: 430, mod: 11, pad: 28 };

  // the running order: [section, beats, options]
  const SECTIONS = [
    ['hook', 8],
    ['date', 8],
    ['title', 8, { i: 0, clip: 'w_orlok_win', grade: 'mono' }],
    ['dead', 8],
    ['dance', 8],
    ['genres', 8],
    ['light', 8],
    ['lightStrips', 16],
    ['title', 4, { i: 1 }],
    ['costume', 12],
    ['group', 8],
    ['title', 8, { i: 2, clip: 'w_cal_wake', grade: 'mono' }],
    ['early', 8],
    ['poster', 20],
  ].map(([name, beats, o]) => ({ name, beats, o: o || {} }));
  SECTIONS.reduce((n, s) => { s.n0 = n; return n + s.beats; }, 0);
  const BEATS = SECTIONS.reduce((n, s) => n + s.beats, 0);
  const DUR = BEATS * BEAT;
  const b = (n) => n * BEAT;
  const beatAt = (t) => Math.floor(t / BEAT + 1e-6);
  const sectionAt = (t) => { const bi = beatAt(t); let k = 0; while (k + 1 < SECTIONS.length && SECTIONS[k + 1].n0 <= bi) k++; return k; };

  // ------------------------------------------------------------- footage
  const FOOT = { index: null, cache: new Map(), qr: null };
  async function load() {
    FOOT.qr = await (await fetch('layers/qr.json')).json();
    FOOT.index = await (await fetch('footage/index.json')).json();
  }
  function getImg(url) {
    let e = FOOT.cache.get(url);
    if (!e) {
      const im = new Image();
      e = { im, ok: false };
      e.p = new Promise((res) => { im.onload = () => { e.ok = true; res(); }; im.onerror = res; });
      im.src = url;
      FOOT.cache.set(url, e);
      if (FOOT.cache.size > 160) FOOT.cache.delete(FOOT.cache.keys().next().value);
    }
    return e;
  }
  const frameURL = (shot, grade, lt) => {
    const n = FOOT.index[shot.clip].frames;
    const i = clamp(Math.floor((lt + (shot.at || 0)) * FPS), 0, n - 1);
    return `footage/${shot.clip}/${grade}/${String(i).padStart(4, '0')}.jpg`;
  };
  const CAPTURE = { on: null };   // when set, drawing only lists the frames it needs

  function dust(ctx, t, r, amt = 1) {
    const f = Math.round(t * FPS);
    ctx.save();
    for (let i = 0; i < 6; i++) {
      const h1 = hash(f * 13.1 + i * 7.7), h2 = hash(f * 3.7 + i * 1.3), h3 = hash(f * 9.3 + i * 4.1);
      if (h3 > 0.55) continue;
      ctx.globalAlpha = 0.22 * amt * (0.4 + h3);
      ctx.fillStyle = h1 > 0.5 ? BONE : '#050303';
      ctx.beginPath();
      ctx.ellipse(r.x + h1 * r.w, r.y + h2 * r.h, 1 + h3 * 3, 1 + h1 * 2.5, h2 * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (hash(f * 0.37 + 11) < 0.3) {
      ctx.globalAlpha = 0.1 * amt;
      ctx.fillStyle = BONE;
      ctx.fillRect(r.x + hash(Math.floor(f / 4) * 5.3) * r.w, r.y, 1.2, r.h);
    }
    ctx.restore();
  }
  // a footage frame cover-fitted into a rectangle, with a slow push and weave
  function filmRect(ctx, t, r, shot, grade, o = {}) {
    const url = frameURL(shot, grade, t - shot.t0);
    if (CAPTURE.on) { CAPTURE.on.push(url); return; }
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.fillStyle = '#070404';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    const e = getImg(url);
    if (e.ok) {
      const im = e.im;
      const s = Math.max(r.w / im.width, r.h / im.height) * (1.03 + 0.02 * (t - shot.t0));
      const wx = (vnoise(t * 7.3) - 0.5) * 3, wy = (vnoise(t * 5.1 + 30) - 0.5) * 3;
      ctx.filter = `brightness(${((o.exposure ?? 1) * (0.95 + 0.07 * vnoise(t * 21 + 3))).toFixed(3)})`;
      ctx.drawImage(im, r.x + (r.w - im.width * s) / 2 + wx, r.y + (r.h - im.height * s) / 2 + wy, im.width * s, im.height * s);
      ctx.filter = 'none';
    }
    dust(ctx, t, r, grade === 'color' ? 0.3 : 0.7);
    const v = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) * 0.3, r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 0.72);
    v.addColorStop(0, 'rgba(5,3,3,0)');
    v.addColorStop(1, `rgba(5,3,3,${o.vignette ?? 0.45})`);
    ctx.fillStyle = v;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }
  // a cell's footage: the pool rotates every `every` beats from beat n0
  function cell(ctx, t, r, pool, n0, o = {}) {
    const every = o.every ?? 2;
    const k = Math.max(0, Math.floor((beatAt(t) - n0) / every));
    const [clip, grade] = pool[(k + (o.off ?? 0)) % pool.length];
    filmRect(ctx, t, r, { clip, t0: b(n0 + k * every), at: 0.2 }, grade, o);
  }
  // the visuals team's light laid over the film (screen blend), kicking on each beat
  function lights(ctx, t, r, n0, amt) {
    const bi = beatAt(t), k = Math.max(0, Math.floor((bi - n0) / 2));
    const shot = { clip: POOL.over[(k + n0) % POOL.over.length], t0: b(n0 + k * 2), at: 0.3 };
    const url = frameURL(shot, 'color', t - shot.t0);
    if (CAPTURE.on) { CAPTURE.on.push(url); return; }
    const e = getImg(url);
    if (!e.ok) return;
    const kick = Math.exp(-(t - b(bi)) * 5);
    const im = e.im, z = Math.max(r.w / im.width, r.h / im.height) * (1.04 + 0.03 * kick);
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = amt * (0.55 + 0.45 * kick);
    ctx.drawImage(im, r.x + (r.w - im.width * z) / 2, r.y + (r.h - im.height * z) / 2, im.width * z, im.height * z);
    ctx.restore();
  }

  const POOL = {
    hook: [['w_sk_line', 'ember'], ['e_ball', 'ember'], ['sk_pairs', 'ember'], ['jive_a', 'ember'], ['w_sk_pairs', 'ember'], ['mask_red', 'ember'], ['sk_solo', 'ember'], ['e_stairs', 'ember']],
    date: [['w_laserfan', 'color'], ['w_pinkwall', 'color'], ['w_octagon', 'color'], ['w_beams4', 'color']],
    dead: [['w_sk_line', 'ember'], ['w_sk_rise', 'ember'], ['w_sk_pairs', 'ember'], ['w_sk_line', 'ember']],
    dance: [['dance_band', 'mono'], ['sk_pairs', 'ember'], ['jive_c', 'ember'], ['e_ball_b', 'mono'], ['sk_solo', 'mono'], ['dance_close', 'ember'], ['jive_d', 'mono'], ['sk_line', 'ember'], ['dance_smile', 'ember'], ['dance_twirl', 'mono']],
    danceReal: [['w_dj', 'color'], ['w_crowdbeams', 'color'], ['w_lasercrowd', 'color'], ['w_dj2', 'color'], ['w_beams4', 'color'], ['w_crowdbeams2', 'color']],
    genres: [['horns', 'ember'], ['sk_line', 'mono'], ['coney_sunburst', 'ember']],
    light: [['w_warehouse2', 'color'], ['w_dj', 'color'], ['w_crowdbeams', 'color'], ['w_pinkwall', 'color']],
    lightStrips: [['w_beams', 'color'], ['w_octagon', 'color'], ['w_booth', 'color'], ['w_beams4', 'color'], ['w_warehouse3', 'color'], ['w_crowdbeams2', 'color'],
      ['w_laserfan', 'color'], ['w_dj2', 'color'], ['w_beams3', 'color'], ['w_lasercrowd', 'color'], ['w_fog', 'color']],
    over: ['w_laserfan', 'w_beams', 'w_crowdbeams2', 'w_octagon', 'w_booth', 'w_beams4'],
    masks: [['cal_wake', 'mono'], ['e_unmask', 'ember'], ['w_costume', 'color'], ['jek_face', 'ember'], ['mask_red', 'ember'], ['e_orlok_win', 'mono'],
      ['h_devil', 'blood'], ['jek_claw', 'mono'], ['mask_man', 'mono'], ['e_skull', 'ember'], ['cal_jane', 'ember'], ['mask_group2', 'ember']],
    group: [['w_sk_line', 'ember'], ['w_sk_pairs', 'ember']],
  };

  // ---------------------------------------------------------------- type
  const COPPER = { family: 'Copperplate', weight: '', tracking: 1 };
  const FIG = { family: 'Figtree', weight: '800', tracking: -2 };
  const big = (ctx, str, size, maxW, f = COPPER) => fit(ctx, str, size, maxW, f.family, f.tracking, f.weight);
  // a big word with a soft rise on entry (gentle: no slams)
  function word(ctx, str, x, y, size, t, t0, o = {}) {
    if (t < t0) return;
    const f = o.font || COPPER;
    const p = o.instant ? 1 : ease.out3(prog(t, t0, t0 + 0.2));
    label(ctx, str, x, y + (1 - p) * 16, size, { family: f.family, weight: f.weight, tracking: o.tracking ?? f.tracking, align: o.align || 'left', color: o.color || BONE, alpha: p * (o.alpha ?? 1) });
  }
  const small = (ctx, str, x, y, size, t, t0, o = {}) => word(ctx, str, x, y, size, t, t0, { ...o, font: FIG, tracking: o.tracking ?? 8 });
  const block = (ctx, r, color) => { ctx.fillStyle = color; ctx.fillRect(r.x, r.y, r.w, r.h); };
  function foot(ctx, r, a = 0.78) {
    const g = ctx.createLinearGradient(0, r.y + r.h * 0.35, 0, r.y + r.h);
    g.addColorStop(0, 'rgba(5,3,3,0)');
    g.addColorStop(1, `rgba(5,3,3,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  function hair(ctx, x0, y, x1, a) {
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = BONE;
    ctx.fillRect(x0, y, x1 - x0, 1.5);
    ctx.restore();
  }
  const rows = (n, r = STAGE) => [...Array(n)].map((_, i) => ({ x: r.x, y: r.y + i * ((r.h - GUT * (n - 1)) / n + GUT), w: r.w, h: (r.h - GUT * (n - 1)) / n }));
  const grid = (cols, rws, r = STAGE) => {
    const w = (r.w - GUT * (cols - 1)) / cols, h = (r.h - GUT * (rws - 1)) / rws, out = [];
    for (let j = 0; j < rws; j++) for (let i = 0; i < cols; i++) out.push({ x: r.x + i * (w + GUT), y: r.y + j * (h + GUT), w, h });
    return out;
  };

  // footage seen through the letters of a huge word
  const buf = canvas(W, H);
  function filmType(ctx, t, str, cx, base, maxW, pool, n0) {
    const tr = 2;
    const size = fit(ctx, str, 560, maxW, 'Copperplate', tr, '');
    const r = { x: STAGE.x, y: base - size * 0.78, w: STAGE.w, h: size * 0.82 + 20 };
    if (CAPTURE.on) { cell(ctx, t, r, pool, n0); return; }
    const g = buf.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    cell(g, t, r, pool, n0, { vignette: 0.1, exposure: 1.2 });
    g.globalCompositeOperation = 'destination-in';
    setFont(g, 'Copperplate', size, '');
    g.letterSpacing = `${tr}px`;
    g.textAlign = 'center';
    g.fillStyle = '#000';
    g.fillText(str, cx, base);
    ctx.save();
    setFont(ctx, 'Copperplate', size, '');
    ctx.letterSpacing = `${tr}px`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = EMBER;
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(224,48,30,0.8)';
    ctx.shadowBlur = 26;
    ctx.strokeText(str, cx, base);
    ctx.restore();
    ctx.drawImage(buf, 0, 0);
  }

  // ------------------------------------------------------------ sections
  const SX = STAGE.x + STAGE.w / 2;
  const SEC = {
    hook(ctx, t, n0) {   // HALLOWEEN / AT / HENDERSON on three strips of film (Figtree, so it reads at a glance)
      rows(3).forEach((r, i) => {
        cell(ctx, t, r, POOL.hook, n0, { off: i * 2 });
        foot(ctx, r);
        const w = C().hook[i];
        word(ctx, w, r.x + 30, r.y + r.h - 32, big(ctx, w, 230, r.w - 60, FIG), t, 0, { instant: true, font: FIG });
      });
    },
    date(ctx, t, n0) {   // SATURDAY / 10.31 with the lights inside the numerals
      const d = C().date2;
      small(ctx, d.k, SX, 290, 56, t, b(n0), { align: 'center', tracking: 16, color: PUMPKIN });
      filmType(ctx, t, d.n, SX, 760, 1260, POOL.date, n0);
      small(ctx, d.s, SX, 900, 70, t, b(n0 + 2), { align: 'center', tracking: 4 });
    },
    title(ctx, t, n0, o) {   // a silent-film intertitle, then the film it introduces
      const lt = t - b(n0);
      const cardEnd = o.clip ? 4 * BEAT : 99;
      if (lt < cardEnd || !o.clip) {
        const a = ease.out2(prog(lt, 0, 0.35)) * (0.93 + 0.07 * flicker(t, 4));
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = BONE;
        ctx.lineWidth = 2;
        ctx.globalAlpha = a * 0.55;
        ctx.strokeRect(STAGE.x + 60, STAGE.y + 60, STAGE.w - 120, STAGE.h - 120);
        ctx.lineWidth = 1;
        ctx.strokeRect(STAGE.x + 74, STAGE.y + 74, STAGE.w - 148, STAGE.h - 148);
        ctx.fillStyle = PUMPKIN;
        ctx.globalAlpha = a * 0.9;
        [[STAGE.x + 60, STAGE.y + 60], [STAGE.x + STAGE.w - 60, STAGE.y + 60], [STAGE.x + 60, STAGE.y + STAGE.h - 60], [STAGE.x + STAGE.w - 60, STAGE.y + STAGE.h - 60]].forEach(([x, y]) => {
          ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-7, -7, 14, 14); ctx.restore();
        });
        ctx.restore();
        const lines = C().titles[o.i].split('\n');
        const size = Math.min(...lines.map((l) => big(ctx, l, 120, 1100)));
        const y0 = STAGE.y + STAGE.h / 2 - ((lines.length - 1) * size * 1.12) / 2 + size * 0.36;
        lines.forEach((l, k) => emberText(ctx, l, SX, y0 + k * size * 1.12, size, { family: 'Copperplate', tracking: 3, alpha: a, glow: 0.55 }));
        const oy = y0 + (lines.length - 1) * size * 1.12 + 70;
        ctx.save();
        ctx.globalAlpha = a * 0.7;
        ctx.fillStyle = PUMPKIN;
        ctx.fillRect(SX - 90, oy, 70, 2);
        ctx.fillRect(SX + 20, oy, 70, 2);
        ctx.translate(SX, oy + 1); ctx.rotate(Math.PI / 4); ctx.fillRect(-6, -6, 12, 12);
        ctx.restore();
        dust(ctx, t, STAGE, 1.2);
        return;
      }
      filmRect(ctx, t, STAGE, { clip: o.clip, t0: b(n0) + cardEnd, at: 0 }, o.grade, { vignette: 0.6 });
    },
    dead(ctx, t, n0) {   // THE DEAD / WILL DANCE over the skeletons, the visuals' light on top
      cell(ctx, t, STAGE, POOL.dead, n0, { every: 2, vignette: 0.5 });
      lights(ctx, t, STAGE, n0, 0.4);
      foot(ctx, STAGE, 0.8);
      const s = Math.min(...C().dead.map((w) => big(ctx, w, 180, 1150)));
      C().dead.forEach((w, i) => word(ctx, w, STAGE.x + 44, STAGE.y + STAGE.h - 50 - (1 - i) * s * 0.98, s, t, b(n0 + i * 2), { color: i ? PUMPKIN : BONE }));
    },
    dance(ctx, t, n0) {   // archival dancers beside the visuals team's real nights, DJS ALL NIGHT across
      grid(3, 2).forEach((r, i) => cell(ctx, t, r, i % 2 ? POOL.danceReal : POOL.dance, n0 + (i % 2), { off: i * 2 }));
      lights(ctx, t, STAGE, n0, 0.25);
      const bar = { x: STAGE.x, y: STAGE.y + STAGE.h / 2 - 85, w: STAGE.w, h: 170 };
      if (t >= b(n0 + 1)) {
        block(ctx, bar, EMBER);
        const s = big(ctx, C().djs, 140, 1250);
        word(ctx, C().djs, SX, bar.y + bar.h / 2 + s * 0.36, s, t, b(n0 + 1), { align: 'center', color: INK });
      }
    },
    genres(ctx, t, n0) {   // BASS / TECHNO / POP REMIXES, a strip per two beats
      rows(3).forEach((r, i) => {
        const t0 = b(n0 + i * 2);
        if (t < t0) { ctx.save(); ctx.strokeStyle = BONE; ctx.globalAlpha = 0.18; ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.restore(); return; }
        cell(ctx, t, r, POOL.genres, n0 + i * 2, { every: 99, off: i });
        lights(ctx, t, r, n0 + i, 0.35);
        foot(ctx, r);
        const w = C().genres[i];
        word(ctx, w, r.x + 30, r.y + r.h - 32, big(ctx, w, 210, r.w - 60), t, t0);
      });
    },
    light(ctx, t, n0) {   // the real rooms, full stage
      const c = C().light;
      cell(ctx, t, STAGE, POOL.light, n0, { vignette: 0.35 });
      foot(ctx, STAGE, 0.8);
      small(ctx, c.k, STAGE.x + 44, STAGE.y + 64, 24, t, b(n0), { alpha: 0.85 });
      const s = Math.min(...c.h.map((w) => big(ctx, w, 150, 1150)));
      c.h.forEach((w, i) => word(ctx, w, STAGE.x + 44, STAGE.y + STAGE.h - 50 - (c.h.length - 1 - i) * s * 0.98, s, t, b(n0 + 1 + i * 2), { color: i ? PUMPKIN : BONE }));
    },
    lightStrips(ctx, t, n0) {   // VISUALS / LIGHTS / ALL NIGHT on three strips of the real footage
      rows(3).forEach((r, i) => {
        const t0 = b(n0 + i * 2);
        if (t < t0) { ctx.save(); ctx.strokeStyle = BONE; ctx.globalAlpha = 0.18; ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.restore(); return; }
        cell(ctx, t, r, POOL.lightStrips, n0 + i * 2, { off: i * 4 });
        foot(ctx, r);
        const w = C().lights[i];
        word(ctx, w, r.x + 30, r.y + r.h - 32, big(ctx, w, 210, r.w - 60), t, t0);
      });
    },
    costume(ctx, t, n0) {   // eight horror faces (and one real witch hat), COME IN COSTUME on a bone band
      grid(4, 2).forEach((r, i) => cell(ctx, t, r, POOL.masks, n0 + (i % 4), { every: 4, off: i * 3 }));
      const band = { x: STAGE.x, y: STAGE.y + STAGE.h / 2 - 160, w: STAGE.w, h: 320 };
      if (t >= b(n0 + 2)) {
        block(ctx, band, BONE);
        const s = big(ctx, C().costume[1], 150, 1200);
        C().costume.forEach((w, i) => word(ctx, w, SX, band.y + 145 + i * s * 0.98, s, t, b(n0 + 2 + i), { align: 'center', color: INK }));
      }
    },
    group(ctx, t, n0) {   // a line of skeletons: BEST GROUP / COSTUME WINS
      cell(ctx, t, STAGE, POOL.group, n0, { every: 4, vignette: 0.55 });
      const sh = ctx.createLinearGradient(0, STAGE.y, 0, STAGE.y + 400);
      sh.addColorStop(0, 'rgba(5,3,3,0.85)');
      sh.addColorStop(1, 'rgba(5,3,3,0)');
      ctx.fillStyle = sh;
      ctx.fillRect(STAGE.x, STAGE.y, STAGE.w, 400);
      const s = Math.min(...C().group.map((w) => big(ctx, w, 150, 1150)));
      C().group.forEach((w, i) => word(ctx, w, STAGE.x + 44, STAGE.y + 40 + s * (0.8 + i * 0.98), s, t, b(n0 + i * 2), { color: i ? PUMPKIN : BONE }));
    },
    early(ctx, t, n0) {   // THE EARLIER / YOU BUY, / THE LESS / YOU PAY. then an arrow to the QR code
      rows(4).forEach((r, i) => {
        const t0 = b(n0 + i * 2);
        if (t < t0) return;
        ctx.save();
        ctx.globalAlpha = ease.out3(prog(t, t0, t0 + 0.12));
        block(ctx, r, i % 2 ? BONE : EMBER);
        ctx.restore();
        const w = C().early[i];
        word(ctx, w, r.x + 30, r.y + r.h / 2 + big(ctx, w, 170, 900) * 0.36, big(ctx, w, 170, 900), t, t0, { color: INK });
      });
      // SCAN THE CODE → pointing across to the column
      const r = rows(4)[3], t0 = b(n0 + 6) + 0.25;
      if (t >= t0) {
        const p = ease.out3(prog(t, t0, t0 + 0.3)), nudge = 10 * Math.sin((t - t0) * Math.PI * 2);
        label(ctx, `${C().scanArrow}  →`, r.x + r.w - 34 + nudge * p, r.y + r.h / 2 + 14, 40, { family: 'Figtree', weight: '800', tracking: 6, align: 'right', color: EMBER, alpha: p });
      }
    },
    poster(ctx, t, n0) {   // the knife stabs in, the pumpkin ignites, the title burns, lasers fire
      const { stab, ignite, titleBurn, lasers } = P();
      const lt = t - b(n0), hit = 0.3;
      const s = 0.58, ax = SX - 272 * s, ay = 330;
      const glow = ctx.createRadialGradient(SX, 560, 40, SX, 560, 700);
      glow.addColorStop(0, `rgba(226,74,22,${0.22 * ease.out2(prog(lt, hit, hit + 0.6)) * flicker(t, 4)})`);
      glow.addColorStop(1, 'rgba(226,74,22,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(STAGE.x, STAGE.y, STAGE.w, STAGE.h);
      const [hx, hy] = artH(ax, ay, s);
      const on = ease.out2(prog(lt, 1.1, 1.4));
      if (on > 0) lasers(ctx, t, on * 0.9, { origin: [hx, hy], t0: b(n0) + 1.1, spread: 1.5, n: 9, haze: 0.08 });
      const off = stab(lt, hit - 0.22, hit, 700);
      art(ctx, ax, ay, s, { pumpkin: ignite(lt, hit + 0.05), h: ignite(lt, hit + 0.05, 3) * 1.05, knifeAlpha: lt >= hit - 0.22 ? 1 : 0, knifeOffset: off });
      const [gx, gy] = artTip(ax, ay, s, off);
      sparkle(ctx, gx, gy, 220, lt, hit, { hold: 0.2 });
      [4.5, 8.0].forEach((s0) => sparkle(ctx, gx, gy, 220, lt, s0, { hold: 0.2 }));
      // shade behind the title so it reads over the beams
      const sh = ctx.createRadialGradient(SX, 220, 40, SX, 220, 560);
      sh.addColorStop(0, `rgba(5,3,3,${0.7 * on})`);
      sh.addColorStop(1, 'rgba(5,3,3,0)');
      ctx.fillStyle = sh;
      ctx.fillRect(STAGE.x, STAGE.y, STAGE.w, 500);
      titleBurn(ctx, SX - 433 * 0.9, 120, 0.9, lt, 0.6, 0.03);
      const c = C();
      revealText(ctx, c.posterDate, SX, 880, fit(ctx, c.posterDate, 76, 1100), lt, 1.7, 'burn', { step: 0.04 });
      kicker(ctx, c.posterTime, 940, ease.out2(prog(lt, 2.3, 2.9)), { x: SX, size: 30, tracking: 12, maxW: 1100 });
      // the stage dims for the cut back to the top
      ctx.fillStyle = `rgba(5,3,3,${ease.in2(prog(lt, b(20) - 0.35, b(20)))})`;
      ctx.fillRect(STAGE.x, STAGE.y, STAGE.w, STAGE.h);
    },
  };

  // ------------------------------------------------------------- column
  const qrBox = () => {
    const n = FOOT.qr.n, s = n * QR.mod + QR.pad * 2;
    return { n, s, x: Math.round(QR.cx - s / 2), y: Math.round(QR.cy - s / 2) };
  };
  // the code glows hotter while the stage is asking people to buy
  const ctaBoost = (t) => {
    const e = SECTIONS.find((s) => s.name === 'early'), p = SECTIONS.find((s) => s.name === 'poster');
    return ease.inOut2(prog(t, b(e.n0 + 6), b(e.n0 + 7))) * (1 - ease.inOut2(prog(t, b(p.n0 + p.beats) - 0.8, b(p.n0 + p.beats))));
  };
  const pSparkle = (ctx, x, y, size, t, every, at) => sparkle(ctx, x, y, size, t, Math.floor((t - at) / every) * every + at);

  function chrome(ctx, t) {
    const c = C();
    label(ctx, c.head[0], STAGE.x, 70, 20, { family: 'Figtree', weight: '800', tracking: 8, align: 'left', alpha: 0.75 });
    label(ctx, c.head[1], STAGE.x + STAGE.w, 70, 20, { family: 'Figtree', weight: '800', tracking: 8, align: 'right', color: PUMPKIN });
    hair(ctx, STAGE.x, 82, STAGE.x + STAGE.w, 0.3);
    label(ctx, c.foot[0], STAGE.x, STAGE.y + STAGE.h + 46, 20, { family: 'Figtree', weight: '800', tracking: 8, align: 'left', alpha: 0.75 });
    label(ctx, c.foot[1], STAGE.x + STAGE.w, STAGE.y + STAGE.h + 46, 20, { family: 'Figtree', weight: '800', tracking: 8, align: 'right', color: PUMPKIN });
  }
  function column(ctx, t) {
    const c = C(), boost = ctaBoost(t), fl = pflicker(t, DUR, 3);
    const bg = ctx.createLinearGradient(1424, 0, W, 0);
    bg.addColorStop(0, 'rgba(40,10,4,0.5)');
    bg.addColorStop(1, 'rgba(20,6,3,0.3)');
    ctx.fillStyle = bg;
    ctx.fillRect(1424, 0, W - 1424, H);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const dv = ctx.createLinearGradient(0, STAGE.y, 0, STAGE.y + STAGE.h);
    dv.addColorStop(0, 'rgba(232,98,28,0)');
    dv.addColorStop(0.5, `rgba(232,98,28,${0.7 * fl})`);
    dv.addColorStop(1, 'rgba(232,98,28,0)');
    ctx.fillStyle = dv;
    ctx.shadowColor = 'rgba(255,90,30,1)';
    ctx.shadowBlur = 12;
    ctx.fillRect(1423, STAGE.y, 2.5, STAGE.h);
    ctx.restore();
    // ember glow behind the QR tile (the tile itself is drawn in the overlay)
    const q = qrBox();
    ctx.save();
    ctx.shadowColor = 'rgba(255,70,25,1)';
    ctx.shadowBlur = 40 + 50 * boost;
    ctx.fillStyle = `rgba(255,90,40,${0.55 + 0.35 * boost})`;
    ctx.globalAlpha = 0.7 * fl + 0.3 * boost;
    ctx.beginPath();
    ctx.roundRect(q.x - 6, q.y - 6, q.s + 12, q.s + 12, 24);
    ctx.fill();
    ctx.restore();
    pSparkle(ctx, q.x + q.s + 2, q.y - 2, 160, t, DUR / 5, 5.5);
    pSparkle(ctx, q.x - 2, q.y + q.s + 2, 140, t, DUR / 6, 8.0);
    // SCAN FOR TICKETS re-flickers on a few times per loop (periods divide the loop)
    const blink = neon(clamp((t % (DUR / 6)) / 0.75));
    neonLabel(ctx, c.scan, 150, 1, 0, { x: COLX, size: 40, tracking: 9, maxW: 410, color: '#FF9A5C', glow: 36, alpha: (0.85 + 0.15 * fl) * (0.45 + 0.55 * Math.max(blink, boost)) });
    emberText(ctx, c.date, COLX, 760, fit(ctx, c.date, 70, 410), { glow: 0.85 + 0.15 * pflicker(t, DUR, 7) });
    kicker(ctx, c.time, 812, 1, { x: COLX, size: 28, tracking: 8, maxW: 410 });
    kicker(ctx, c.cheaper, 858, 0.9, { x: COLX, size: 19, tracking: 5, color: BONE, glow: 0, maxW: 410 });
    logo(ctx, COLX, 950, 290, 1, 0.16 + 0.06 * pflicker(t, DUR, 11));
  }
  function qrOverlay(ctx) {
    const q = qrBox(), m = FOOT.qr.m;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(q.x, q.y, q.s, q.s, 16);
    ctx.fill();
    ctx.fillStyle = '#0B0605';
    const ox = q.x + QR.pad, oy = q.y + QR.pad;
    for (let r = 0; r < q.n; r++) for (let c = 0; c < q.n; c++) if (m[r][c]) ctx.fillRect(ox + c * QR.mod, oy + r * QR.mod, QR.mod, QR.mod);
    ctx.restore();
  }

  function stage(ctx, t) {
    const k = sectionAt(t), s = SECTIONS[k];
    SEC[s.name](ctx, t, s.n0, s.o);
  }

  register({
    id: 'tv-loop-v2',
    duration: DUR,
    silent: true,
    weave: false,                 // a still screen: no gate weave (keeps the loop seam-free too)
    post: { grain: 0.12, vignette: 0.35 },
    async prepare(t) {
      const want = [];
      try { CAPTURE.on = want; stage(canvas(8, 8).getContext('2d'), t); } finally { CAPTURE.on = null; }
      await Promise.all(want.map((u) => getImg(u).p));
    },
    draw(ctx, t) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(STAGE.x, STAGE.y, STAGE.w, STAGE.h);
      ctx.clip();
      stage(ctx, t);
      ctx.restore();
      chrome(ctx, t);
      column(ctx, t);
    },
    overlay(ctx) { qrOverlay(ctx); },
  });

  window.HH_TV = { load, SECTIONS, DUR };
})();
