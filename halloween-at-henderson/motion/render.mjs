// Render the story cards to MP4 (1080x1920, 30fps, H.264 + AAC).
//
//   node render.mjs                      # all cards
//   node render.mjs 01-the-return        # one card (prefix match)
//   node render.mjs --stills 01 0,2.5,7  # review stills -> review/
//   node render.mjs --sheet              # contact sheets -> review/
//   AUDIO=1 node render.mjs              # also synthesize + mux sound (default: silent)
//
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(ROOT, '..', 'videos');
const REVIEW = path.resolve(ROOT, 'review');
const FPS = 30;
const PARALLEL = Number(process.env.PARALLEL || 3);
const AUDIO = process.env.AUDIO === '1';

const FFMPEG = process.env.FFMPEG ||
  execFileSync('python3', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', (e) => console.error('pageerror', e));
  page.on('console', (m) => { if (m.type() === 'error') console.error('console', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html?render=1`);
  await page.waitForFunction(() => window.HH_ready === true, null, { timeout: 60000 });
  return page;
}

const frameJpeg = async (page, id, t) => {
  const url = await page.evaluate(([id, t]) => window.HH_frame(id, t, 0.95), [id, t]);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
};

function run(cmd, args) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} exited ${c}`))));
  });
}

async function renderCard(page, card) {
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = path.join(ROOT, '.tmp');
  fs.mkdirSync(tmp, { recursive: true });
  let audioIn = [], audioOut = ['-an'];
  if (AUDIO) {
    const cuesPath = path.join(tmp, `${card.id}.cues.json`);
    const wav = path.join(tmp, `${card.id}.wav`);
    fs.writeFileSync(cuesPath, JSON.stringify({ cues: [], ...card }));
    await run('python3', [path.join(ROOT, 'audio.py'), cuesPath, wav]);
    audioIn = ['-i', wav];
    audioOut = ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest'];
  }

  const mp4 = path.join(OUT, `${card.id}.mp4`);
  const ff = spawn(FFMPEG, [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    ...audioIn,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-maxrate', '14M', '-bufsize', '28M',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(FPS),
    ...audioOut, '-movflags', '+faststart', mp4,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));

  const N = Math.round(card.duration * FPS);
  const t0 = Date.now();
  let cover = null;
  for (let f = 0; f < N; f++) {
    const buf = await frameJpeg(page, card.id, f / FPS);
    if (f === N - 1) cover = buf;
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 60 === 0) process.stdout.write(`  ${card.id} ${f}/${N}\n`);
  }
  ff.stdin.end();
  await done;
  fs.writeFileSync(path.join(OUT, `${card.id}-cover.jpg`), cover);
  console.log(`✓ ${card.id}.mp4  (${N} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}

async function main() {
  const args = process.argv.slice(2);
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM || undefined,
    args: ['--disable-web-security', '--font-render-hinting=none'],
  });
  try {
    const probe = await openPage(browser, port);
    const cards = await probe.evaluate(() => window.HH_cards());

    if (args[0] === '--stills') {
      fs.mkdirSync(REVIEW, { recursive: true });
      const ids = cards.filter((c) => c.id.startsWith(args[1]));
      const times = (args[2] || '').split(',').filter(Boolean).map(Number);
      for (const c of ids) {
        const ts = times.length ? times : Array.from({ length: Math.ceil(c.duration * 2) }, (_, i) => i * 0.5);
        for (const t of ts) fs.writeFileSync(path.join(REVIEW, `${c.id}@${t.toFixed(2)}.jpg`), await frameJpeg(probe, c.id, t));
      }
      console.log('stills ->', REVIEW);
      return;
    }

    if (args[0] === '--sheet') {
      fs.mkdirSync(REVIEW, { recursive: true });
      for (const c of cards.filter((c) => !args[1] || c.id.startsWith(args[1]))) {
        const mp4 = path.join(OUT, `${c.id}.mp4`);
        if (!fs.existsSync(mp4)) continue;
        const cols = 6, n = Math.ceil(c.duration * 2), rows = Math.ceil(n / cols);
        await run(FFMPEG, ['-y', '-loglevel', 'error', '-i', mp4, '-vf', `fps=2,scale=240:-1,tile=${cols}x${rows}:padding=4`, '-frames:v', '1', path.join(REVIEW, `${c.id}-sheet.jpg`)]);
      }
      console.log('sheets ->', REVIEW);
      return;
    }

    const todo = cards.filter((c) => !args.length || args.some((a) => c.id.startsWith(a)));
    const pages = [probe];
    for (let i = 1; i < Math.min(PARALLEL, todo.length); i++) pages.push(await openPage(browser, port));
    const queue = [...todo];
    await Promise.all(pages.map(async (pg) => {
      while (queue.length) await renderCard(pg, queue.shift());
    }));
  } finally {
    await browser.close();
    srv.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
