// Dev helper: freeze-frame the moments that only exist mid-animation.
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
await new Promise((r) => server.listen(8096, r));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: false,
  args: ['--headless=new', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:8096/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.mouse.click(500, 320);
await page.waitForTimeout(1000);

const out = path.join(ROOT, 'tools', 'shots');
fs.mkdirSync(out, { recursive: true });
const shot = (n) => page.screenshot({ path: path.join(out, `m-${n}.png`) });

const round = Number((process.argv.find((a) => a.startsWith('--round=')) || '').split('=')[1] || 0);
if (round) {
  await page.evaluate((n) => window.__workshop.game().startRound(n), round);
  await page.waitForTimeout(700);
}

// mid unfurl — cloth in the air
for (const u of [0.25, 0.5, 0.75]) {
  await page.evaluate((v) => {
    const g = window.__workshop.game();
    g.cloth.mode = 'unfurl';
    g.cloth.unfurl = v;
  }, u);
  await page.waitForTimeout(2200);
  await shot(`unfurl-${Math.round(u * 100)}`);
}

// settle flat, then jump to cutting and capture the offcut falling away
await page.evaluate(() => {
  const g = window.__workshop.game();
  g.cloth.unfurl = 1.0;
  g.cloth.mode = 'flat';
  for (let i = 0; i < 90; i++) g.cloth.step(1 / 60);
  g._setPhase(2);
  g.progress = 0.5;
});
await page.waitForTimeout(600);
await shot('cut-half');

await page.evaluate(() => {
  const g = window.__workshop.game();
  g.progress = 1;
  g.locked = 0.001;
});
await page.waitForTimeout(450);
await shot('offcut-falling');
await page.waitForTimeout(700);
await shot('offcut-gone');

// sewing, with the machine part way round
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const g = window.__workshop.game();
  g._setPhase(3);
  g.progress = 0.45;
  g.stitches.setProgress(0.45);
});
await page.waitForTimeout(700);
await shot('sewing');

// the turn, frame by frame
await page.evaluate(() => {
  const g = window.__workshop.game();
  g.stitches.setProgress(1);
  g._setPhase(4);
});
await page.waitForTimeout(400);
for (const t of [0.25, 0.5, 0.75]) {
  await page.evaluate((v) => {
    const g = window.__workshop.game();
    g.cloth.turn = v;
    g.locked = 99;   // hold it here
  }, t);
  await page.waitForTimeout(700);
  await shot(`turn-${Math.round(t * 100)}`);
}

console.log('done');
await browser.close();
server.close();
