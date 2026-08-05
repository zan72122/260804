// Dev helper: inspect live scene state / isolate rendering artifacts.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(8098, r));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: false,
  args: ['--headless=new', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:8098/', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.mouse.click(500, 320);
await page.waitForTimeout(1200);

// jump straight into the trace phase with the cloth flat
await page.evaluate(() => {
  const g = window.__workshop.game();
  g.cloth.unfurl = 1.06;
  g.cloth.mode = 'flat';
  for (let i = 0; i < 90; i++) g.cloth.step(1 / 60);
  g._setPhase(1);
});
await page.waitForTimeout(900);

const outDir = path.join(ROOT, 'tools', 'shots');
fs.mkdirSync(outDir, { recursive: true });

const sets = [
  ['all', []],
  ['no-hand', ['hand']],
  ['no-hand-chalkrig', ['hand', 'chalkRig']],
  ['no-hand-chalkrig-guide', ['hand', 'chalkRig', 'guide']],
  ['cloth-only', ['hand', 'chalkRig', 'guide', 'chalkLine', 'sparks', 'dust', 'bits', 'confetti']],
];
for (const [name, hide] of sets) {
  await page.evaluate((hideList) => {
    const g = window.__workshop.game();
    const nodes = {
      hand: g.hand, chalkRig: g.chalkRig, guide: g.guide.mesh, chalkLine: g.chalkLine.mesh,
      sparks: g.sparks.points, dust: g.dust.points, bits: g.bits.mesh, confetti: g.confetti.mesh,
    };
    for (const k of Object.keys(nodes)) nodes[k].visible = true;
    for (const k of hideList) nodes[k].visible = false;
  }, hide);
  await page.waitForTimeout(320);
  await page.screenshot({ path: path.join(outDir, `diag-${name}.png`) });
}

console.log(await page.evaluate(() => {
  const g = window.__workshop.game();
  const nan = (arr) => { for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) return i; return -1; };
  return JSON.stringify({
    phase: g.phase,
    handVisible: g.hand.visible,
    handPos: g.hand.position.toArray().map((v) => +v.toFixed(2)),
    chalkPos: g.chalkRig.position.toArray().map((v) => +v.toFixed(2)),
    guideCount: g.guide.mesh.count,
    S: +g.S.toFixed(3),
    posNaN: nan(g.cloth.pos),
    vposNaN: nan(g.cloth.vpos),
    chalkNaN: nan(g.chalkLine.arr),
    outlineLen: g.pattern.outline.length,
    seam: [g.pattern.seamStart, g.pattern.seamEnd],
  }, null, 1);
}));

await browser.close();
server.close();
