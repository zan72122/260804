// Dev helper: load the game headlessly, play a full round, capture screenshots.
// node tools/shot.mjs [--portrait] [--round=N]
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('nope'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const portrait = process.argv.includes('--portrait');
const roundArg = Number((process.argv.find((a) => a.startsWith('--round=')) || '').split('=')[1] || 0);
const outDir = path.join(ROOT, 'tools', 'shots');
fs.mkdirSync(outDir, { recursive: true });

await new Promise((r) => server.listen(8099, r));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: false,
  args: ['--headless=new', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
});
const W = portrait ? 420 : 1000;
const H = portrait ? 860 : 640;
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[error] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack}`));

await page.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

const tag = (portrait ? 'p' : 'l') + (roundArg ? `r${roundArg}` : '');
const shot = (name) => page.screenshot({ path: path.join(outDir, `${tag}-${name}.png`) });

await shot('00-veil');
await page.mouse.click(W / 2, H / 2);
await page.waitForTimeout(1200);

if (roundArg) {
  await page.evaluate((n) => window.__workshop.game().startRound(n), roundArg);
  await page.waitForTimeout(900);
}
await shot('01-folded');

async function drag(points, stepMs = 18) {
  if (!points.length) return;
  await page.mouse.move(points[0][0], points[0][1]);
  await page.mouse.down();
  for (const [x, y] of points) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(stepMs);
  }
  await page.mouse.up();
}

/** Screen-space samples of the current phase's guide path. */
const pathPoints = (from, to, n) => page.evaluate(({ from, to, n }) => {
  const g = window.__workshop.game();
  const w = window.__workshop.world;
  const track = g.phase === 3 ? g.sewPath : g.tracePath;
  if (!track) return [];
  const a = { x: 0, y: 0 };
  const out = [];
  for (let i = 0; i <= n; i++) {
    track.at(from + ((to - from) * i) / n, a);
    g.cloth.sampleSurface(a.x, a.y, g.sample);
    const v = g.sample.pos.clone().project(w.camera);
    out.push([(v.x * 0.5 + 0.5) * window.innerWidth, (-v.y * 0.5 + 0.5) * window.innerHeight]);
  }
  return out;
}, { from, to, n });

const getPhase = () => page.evaluate(() => {
  const g = window.__workshop.game();
  return { phase: g.phase, progress: +g.progress.toFixed(3), locked: +g.locked.toFixed(2) };
});

const cx = W / 2, cy = H / 2;

// ---- phase 0: swipe the folds open
for (let k = 0; k < 4; k++) {
  await drag([[cx - 150, cy + 30], [cx - 60, cy - 30], [cx + 70, cy - 10], [cx + 165, cy + 40]], 16);
  const s = await getPhase();
  if (s.phase !== 0) break;
}
await page.waitForTimeout(1700);
await shot('02-spread');

// ---- phases 1..3: follow the real outline
async function followPath(label) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const s = await getPhase();
    if (s.locked > 0) { await page.waitForTimeout(400); continue; }
    const pts = await pathPoints(Math.max(0, s.progress - 0.01), 1, 90);
    if (!pts.length) break;
    await drag(pts, 14);
    const after = await getPhase();
    if (after.phase !== s.phase) break;
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(1500);
  await shot(label);
}

await followPath('03-traced');
await followPath('04-cut');
await followPath('05-sewn');

// ---- phase 4: swirl it right side out
for (let k = 0; k < 6; k++) {
  const s = await getPhase();
  if (s.phase !== 4) break;
  await drag([[cx - 110, cy + 70], [cx - 20, cy - 50], [cx + 110, cy + 60], [cx, cy + 130]], 16);
}
await page.waitForTimeout(3000);
await shot('06-turned');

// ---- phase 5: decorate
const spots = [[-55, -70], [55, -40], [0, 30], [-45, 100], [50, 110]];
for (let i = 0; i < spots.length; i++) {
  if (i === 2) {
    await page.evaluate(() => document.querySelectorAll('#deco-bar button')[1]?.click());
    await page.waitForTimeout(200);
  }
  await page.mouse.click(cx + spots[i][0], cy + spots[i][1]);
  await page.waitForTimeout(500);
}
await page.waitForTimeout(1000);
await shot('07-decorated');

const state = await page.evaluate(() => {
  const g = window.__workshop.game();
  return {
    round: g.round, garment: g.pattern.id, phase: g.phase,
    decorations: g.decorations.length, mode: g.cloth.mode,
    isCut: g.cloth.isCut, turn: +g.cloth.turn.toFixed(2),
    bundleReady: !!g.bundleReady, stitches: g.stitches.mesh.count,
  };
});
console.log('STATE', JSON.stringify(state));

if (errors.length) console.log('--- issues ---\n' + [...new Set(errors)].slice(0, 20).join('\n'));
else console.log('no console errors');

await browser.close();
server.close();
