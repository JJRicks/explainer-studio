// The studio command line. Run ./studio with no arguments for usage.
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { readFile, mkdir, writeFile, rm, mkdtemp, cp, readdir } from 'node:fs/promises';
import { resolveTime } from '../core/timeexpr.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = `
./studio <command> <video> [options]        <video> is a folder name under videos/

  new <video>                   start a video from videos/_template
  narrate <video>               narration.json -> audio + timeline.json   [--voice af_heart] [--speed 1.0]
  words <video> [cue ...]       list every spoken word with its time (what scenes can sync to)
  still <video> <time ...>      full-size PNG stills                       [--scale 1] [--crop x,y,w,h]
  sheet <video> <time ...>      contact sheet(s) of half-size stills, 8 per image
        ... or instead of times:  --scene <id> [--n 8]   --cues [scene]   --every <seconds>
  check <video>                 find clipped or overlapping text across the whole video  [--step 0.5]
  hear <video>                  transcribe the narration with Whisper, beside the script
  preview <video>               live preview with audio, in your browser
  video <video>                 render out/<video>.mp4                     [--fps 60] [--workers 8] [--from t] [--to t]
  selftest <video>              confirm captured frames land on their exact timestamps  [--at t]

Times are seconds or time expressions:  12.5   4b   '4b$'   4b@leave   4b@the#2   's3$-0.6'   4b@leave+0.5
(quote anything containing $ or # so the shell leaves it alone)
`;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.png': 'image/png',
};
const fail = msg => { console.error(msg); process.exit(1); };

// ------------------------------------------------------------------ plumbing
function flag(args, name, fallback) {
  const i = args.indexOf('--' + name);
  if (i < 0) return fallback;
  const next = args[i + 1];
  if (next === undefined || next.startsWith('--')) { args.splice(i, 1); return true; }
  return args.splice(i, 2)[1];
}
const videoDir = name => path.join(ROOT, 'videos', name);
function needVideo(name) {
  if (!name) fail(USAGE);
  if (!existsSync(videoDir(name))) fail(`no video "${name}" in videos/ (./studio new ${name} to create it)`);
  return name;
}
async function timeline(name) {
  const file = path.join(videoDir(name), 'timeline.json');
  if (!existsSync(file)) fail(`videos/${name} has no timeline yet — run: ./studio narrate ${name}`);
  return JSON.parse(await readFile(file, 'utf8'));
}
function chrome() {
  const found = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].find(p => p && existsSync(p));
  if (!found) fail('Chrome not found. Install Google Chrome, or set CHROME=/path/to/chrome');
  return found;
}
const python = () => (existsSync(path.join(ROOT, '.venv/bin/python')) ? path.join(ROOT, '.venv/bin/python') : 'python3');

function serve(port = 0) {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/favicon.ico') { res.writeHead(204).end(); return; }
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch { res.writeHead(404).end('not found'); }
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server)));
}

async function openPage(port, name, { scale = 1, review = false } = {}) {
  const browser = await puppeteer.launch({
    executablePath: chrome(), headless: true,
    args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--hide-scrollbars', '--force-color-profile=srgb',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: scale },
  });
  const page = await browser.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push(String(e.stack || e)));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) problems.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`); });
  await page.goto(`http://127.0.0.1:${port}/core/index.html?video=${encodeURIComponent(name)}${review ? '&review' : ''}`, { waitUntil: 'load' });
  try { await page.waitForFunction('window.ready === true || window.failed', { timeout: 30000 }); } catch { problems.push('page never became ready'); }
  const failed = await page.evaluate('window.failed || null');
  if (failed || problems.length) {
    await browser.close();
    throw new Error('the video failed to load:\n' + [...new Set([failed, ...problems].filter(Boolean))].join('\n'));
  }
  return { browser, page, problems };
}

function run(cmd, args, { quiet = false } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: ROOT, stdio: ['ignore', quiet ? 'ignore' : 'inherit', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => { err = (err + d).slice(-6000); });
    p.on('error', reject);
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} exited ${code}\n${err}`))));
  });
}
const stamp = t => t.toFixed(2).padStart(7, '0');

/** Turn the time arguments (or --scene / --cues / --every) into seconds. */
function pickTimes(tl, args) {
  const scene = flag(args, 'scene'), n = Number(flag(args, 'n', 8)), cues = flag(args, 'cues'), every = flag(args, 'every');
  if (every) { const out = []; for (let t = 0.5; t < tl.duration; t += Number(every)) out.push(t); return out; }
  if (cues) {
    const only = typeof cues === 'string' ? cues : scene;
    return tl.order.filter(id => !only || tl.cues[id].scene === only).map(id => Math.max(tl.cues[id].start, tl.cues[id].end - 0.15));
  }
  if (scene) {
    const s = tl.scenes[scene] || fail(`no scene "${scene}" (scenes: ${Object.keys(tl.scenes).join(' ')})`);
    return Array.from({ length: n }, (_, i) => s.start + 0.3 + ((s.end - s.start - 0.6) * i) / Math.max(1, n - 1));
  }
  if (!args.length) fail('give some times, or --scene <id>, --cues, or --every <seconds>');
  return args.map(a => resolveTime(tl, a));
}

async function capture(name, times, dir, { scale = 1, crop = null, review = true } = {}) {
  await mkdir(dir, { recursive: true });
  const server = await serve();
  const { browser, page, problems } = await openPage(server.address().port, name, { scale, review });
  const files = [];
  for (const t of times) {
    await page.evaluate(time => window.renderAt(time), t);
    const file = path.join(dir, `t${stamp(t)}.png`);
    await page.screenshot({ path: file, type: 'png', ...(crop ? { clip: crop } : {}) });
    files.push(file);
  }
  await browser.close();
  server.close();
  if (problems.length) throw new Error('page errors:\n' + problems.join('\n'));
  return files;
}

// ------------------------------------------------------------------ commands
const commands = {
  async new([name]) {
    if (!name) fail(USAGE);
    if (existsSync(videoDir(name))) fail(`videos/${name} already exists`);
    await cp(videoDir('_template'), videoDir(name), { recursive: true, filter: src => !/\/(audio|timeline\.json)$/.test(src) });
    console.log(`created videos/${name}/ — edit narration.json, then: ./studio narrate ${name}`);
  },

  async narrate(args) {
    const voice = flag(args, 'voice'), speed = flag(args, 'speed');
    const name = needVideo(args[0]);
    await run(python(), ['tools/synth.py', path.join('videos', name), ...(voice ? ['--voice', voice] : []), ...(speed ? ['--speed', speed] : [])]);
  },

  async words(args) {
    const name = needVideo(args[0]), tl = await timeline(name), only = args.slice(1);
    for (const id of tl.order) {
      if (only.length && !only.includes(id) && !only.includes(tl.cues[id].scene)) continue;
      const c = tl.cues[id];
      console.log(`${id}  [${c.scene}  ${c.start.toFixed(2)}–${c.end.toFixed(2)}]  ` + (c.words.map(w => `${w.w}@${(w.s - c.start).toFixed(1)}`).join(' ') || '(silence)'));
    }
    console.log('\nscenes: ' + Object.entries(tl.scenes).map(([id, s]) => `${id} ${s.start.toFixed(1)}–${s.end.toFixed(1)}`).join('   '));
  },

  async still(args) {
    const scale = Number(flag(args, 'scale', 1)), crop = flag(args, 'crop'), plain = flag(args, 'plain');
    const name = needVideo(args.shift()), tl = await timeline(name);
    const clip = crop ? (([x, y, width, height]) => ({ x, y, width, height }))(crop.split(',').map(Number)) : null;
    const files = await capture(name, pickTimes(tl, args), path.join(ROOT, 'out/review', name), { scale, crop: clip, review: !plain });
    files.forEach(f => console.log(f));
  },

  async sheet(args) {
    const label = flag(args, 'name', 'sheet');
    const name = needVideo(args.shift()), tl = await timeline(name), times = pickTimes(tl, args);
    const dir = await mkdtemp(path.join(os.tmpdir(), 'sheet-'));
    const files = await capture(name, times, dir, { scale: 0.5 });
    const outDir = path.join(ROOT, 'out/review', name);
    await mkdir(outDir, { recursive: true });
    for (let i = 0, k = 1; i < files.length; i += 8, k++) {
      const part = files.slice(i, i + 8), out = path.join(outDir, `${label}${files.length > 8 ? '-' + k : ''}.png`);
      const inputs = part.flatMap(f => ['-i', f]);
      const rows = Math.ceil(part.length / 2);
      const filter = part.length === 1 ? 'null' : `${part.map((_, j) => `[${j}:v]`).join('')}xstack=inputs=${part.length}:layout=${part.map((_, j) => `${(j % 2) * 966}_${Math.floor(j / 2) * 546}`).join('|')}:fill=0x444444`;
      await run('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filter, '-frames:v', '1', out], { quiet: true });
      console.log(`${out}   (${rows} row${rows > 1 ? 's' : ''}: ${part.map(f => path.basename(f, '.png').slice(1).replace(/^0+(?=\d)/, '') + 's').join(', ')})`);
    }
    await rm(dir, { recursive: true, force: true });
  },

  async check(args) {
    const step = Number(flag(args, 'step', 0.5));
    const name = needVideo(args[0]), tl = await timeline(name);
    const server = await serve();
    const { browser, page } = await openPage(server.address().port, name);
    const found = new Map();
    for (let t = 0; t <= tl.duration; t += step) {
      for (const issue of await page.evaluate(time => window.lint(time), t)) {
        const key = `${issue.type}|${issue.kind}|${issue.what}`;
        const e = found.get(key) || found.set(key, { ...issue, spans: [] }).get(key);
        const last = e.spans[e.spans.length - 1];
        if (last && t - last[1] <= step * 1.5) last[1] = t; else e.spans.push([t, t]);
        e.px = Math.max(e.px, issue.px);
      }
    }
    await browser.close(); server.close();
    const rows = [...found.values()].sort((a, b) => a.spans[0][0] - b.spans[0][0]);
    const serious = rows.filter(r => r.kind !== 'chrome' && (r.type === 'clipped' || r.kind === 'panel'));
    for (const r of rows) {
      const level = serious.includes(r) ? 'ERROR' : 'note ';
      const when = r.spans.map(([a, b]) => (a === b ? `${a.toFixed(1)}s` : `${a.toFixed(1)}–${b.toFixed(1)}s`)).join(', ');
      console.log(`${level}  ${r.type === 'clipped' ? `clipped by ${r.px}px` : `overlap ${r.px}%`}  [${r.kind}]  ${when}\n         ${r.what}`);
    }
    console.log(rows.length ? `\n${serious.length} error(s), ${rows.length - serious.length} note(s). Errors: text cut off by the frame, or panel lines colliding. Notes: 3D labels overlapping each other, or axis names/ticks leaving the frame during a camera move — look at those moments and judge.` : 'no layout problems found');
    if (serious.length) process.exit(1);
  },

  async hear(args) {
    const name = needVideo(args[0]);
    await timeline(name);
    await run(python(), ['tools/hear.py', path.join('videos', name)]);
  },

  async preview(args) {
    const name = needVideo(args[0]);
    await timeline(name);
    const server = await serve(Number(flag(args, 'port', 4173)));
    console.log(`http://127.0.0.1:${server.address().port}/core/index.html?video=${name}&play\nclick or space = play/pause, arrow keys = seek 5 s. Ctrl-C to stop.`);
    await new Promise(() => {});
  },

  async video(args) {
    const fps = Number(flag(args, 'fps', 60)), workers = Number(flag(args, 'workers', 8));
    const from = flag(args, 'from', null), to = flag(args, 'to', null), outArg = flag(args, 'out', null);
    const name = needVideo(args[0]), tl = await timeline(name);
    const audio = path.join(videoDir(name), 'audio/narration.wav');
    if (!existsSync(audio)) fail(`no narration audio — run: ./studio narrate ${name}`);
    const out = path.resolve(outArg || path.join(ROOT, 'out', `${name}.mp4`));
    const first = from === null ? 0 : Math.round(resolveTime(tl, from) * fps);
    const last = to === null ? Math.ceil(tl.duration * fps) : Math.round(resolveTime(tl, to) * fps);
    const total = last - first;
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'frames-'));
    const server = await serve(), port = server.address().port, started = Date.now();
    let done = 0;
    const report = setInterval(() => {
      const rate = done / ((Date.now() - started) / 1000);
      console.log(`${done}/${total} frames  ${rate.toFixed(1)} fps  about ${((total - done) / Math.max(rate, 0.01) / 60).toFixed(1)} min left`);
    }, 15000);
    const per = Math.ceil(total / workers);
    const segments = await Promise.all(Array.from({ length: workers }, async (_, w) => {
      const a = first + w * per, b = Math.min(last, a + per);
      if (a >= b) return null;
      const seg = path.join(tmp, `seg${String(w).padStart(2, '0')}.mp4`);
      const { browser, page, problems } = await openPage(port, name);
      const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
        '-vf', 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-g', String(fps * 2),
        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', seg], { stdio: ['pipe', 'ignore', 'inherit'] });
      const closed = once(ff, 'close');
      for (let i = a; i < b; i++) {
        await page.evaluate(time => window.renderAt(time), i / fps);
        const png = await page.screenshot({ type: 'png', optimizeForSpeed: true });
        if (!ff.stdin.write(png)) await once(ff.stdin, 'drain');
        done++;
      }
      ff.stdin.end();
      const [code] = await closed;
      await browser.close();
      if (code !== 0) throw new Error(`ffmpeg segment ${w} exited ${code}`);
      if (problems.length) throw new Error('page errors during render:\n' + problems.join('\n'));
      return seg;
    }));
    clearInterval(report);
    server.close();
    const list = path.join(tmp, 'list.txt');
    await writeFile(list, segments.filter(Boolean).map(s => `file '${s}'`).join('\n'));
    await mkdir(path.dirname(out), { recursive: true });
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-ss', String(first / fps), '-i', audio,
      '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
      '-t', String(total / fps), '-movflags', '+faststart', out], { quiet: true });
    await rm(tmp, { recursive: true, force: true });
    console.log(`wrote ${out}  (${total} frames at ${fps} fps in ${((Date.now() - started) / 60000).toFixed(1)} min)`);
  },

  async selftest(args) {
    const name = needVideo(args[0]), tl = await timeline(name);
    const t0 = Math.floor(resolveTime(tl, flag(args, 'at', tl.duration / 2)));
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'selftest-'));
    const clip = path.join(tmp, 'clip.mp4');
    await commands.video([name, '--from', String(t0), '--to', String(t0 + 1), '--fps', '30', '--workers', '2', '--out', clip]);
    const mid = t0 + 0.5, times = [mid - 1 / 30, mid, mid + 1 / 30];
    const refs = await capture(name, times, tmp, { review: false });
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', clip, '-vf', 'select=eq(n\\,15)', '-frames:v', '1', path.join(tmp, 'frame15.png')], { quiet: true });
    const psnr = [];
    for (const ref of refs) {
      const text = await new Promise(resolve => {
        const p = spawn('ffmpeg', ['-i', path.join(tmp, 'frame15.png'), '-i', ref, '-lavfi', 'psnr', '-f', 'null', '-']);
        let err = ''; p.stderr.on('data', d => { err += d; }); p.on('close', () => resolve(err));
      });
      const m = /average:([\d.]+|inf)/.exec(text);
      psnr.push(m ? (m[1] === 'inf' ? 99 : Number(m[1])) : 0);
    }
    await rm(tmp, { recursive: true, force: true });
    console.log(`frame at ${mid}s vs stills one frame early / on time / one frame late: ${psnr.map(v => v.toFixed(1)).join(' / ')} dB`);
    if (Math.abs(psnr[0] - psnr[1]) < 1 && Math.abs(psnr[2] - psnr[1]) < 1) console.log('INCONCLUSIVE: nothing is moving at that moment — pick one with motion using --at <time>');
    else if (psnr[1] > psnr[0] + 3 && psnr[1] > psnr[2] + 3) console.log('PASS: captured frames land on their exact timestamps');
    else { console.log('FAIL: the captured frame does not match its timestamp'); process.exit(1); }
  },
};

const [command, ...rest] = process.argv.slice(2);
if (!commands[command]) { console.log(USAGE); process.exit(command ? 2 : 0); }
commands[command](rest).then(() => process.exit(0)).catch(e => fail(e.message || String(e)));
