// Dev helper: verify one tap == one decoration.
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
await new Promise((r) => server.listen(8097, r));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: false,
  args: ['--headless=new', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:8097/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.mouse.click(450, 300);
await page.waitForTimeout(1000);

// force the round straight to the finished, hanging garment
await page.evaluate(() => {
  const g = window.__workshop.game();
  g.cloth.unfurl = 1.06; g.cloth.mode = 'flat';
  for (let i = 0; i < 60; i++) g.cloth.step(1 / 60);
  g.cloth.cut();
  g.cloth.snapT = 1;
  for (let i = 0; i < 30; i++) g.cloth.step(1 / 60);
  g._setPhase(4);
  g.cloth.turn = 1;
  g.cloth.step(1 / 60);
  g.cloth.pinTop();
  g.cloth.mode = 'hang';
  g._placeHanger();
  g.locked = 0;
  g._setPhase(5);
});
await page.waitForTimeout(1200);

const counts = [];
for (let i = 0; i < 4; i++) {
  await page.mouse.click(450, 260 + i * 12);
  await page.waitForTimeout(600);
  counts.push(await page.evaluate(() => window.__workshop.game().decorations.length));
}
console.log('decorations after each of 4 taps:', counts.join(' -> '));

// press and hold for a second: should still be a single decoration
const before = counts[counts.length - 1];
await page.mouse.move(430, 300);
await page.mouse.down();
await page.waitForTimeout(1200);
await page.mouse.up();
await page.waitForTimeout(400);
const after = await page.evaluate(() => window.__workshop.game().decorations.length);
console.log(`hold for 1.2s added ${after - before} decoration(s)`);

await browser.close();
server.close();
