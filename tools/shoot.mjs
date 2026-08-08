// Headless play-through: drives the game with synthetic touches and captures
// screenshots so the visuals can be reviewed without a device.
// Usage: node tools/shoot.mjs [outDir] [w] [h]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const out = resolve(root, process.argv[2] || 'shots');
const W = parseInt(process.argv[3] || '1280', 10);
const H = parseInt(process.argv[4] || '720', 10);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--ignore-gpu-blocklist', '--enable-webgl', '--disable-lcd-text'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
page.on('pageerror', (e) => console.log('[error]', e.message));

await page.goto('file://' + resolve(root, 'index.html'));
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
console.log('booted');

const shot = async (name) => {
  await page.screenshot({ path: resolve(out, name + '.png') });
  console.log('  shot', name, await page.evaluate(() => window.__game.state));
};
const wait = (ms) => page.waitForTimeout(ms);

// Touch helpers driving real pointer events.
const down = (x, y) => page.mouse.move(x, y).then(() => page.mouse.down());
const move = (x, y) => page.mouse.move(x, y);
const up = () => page.mouse.up();
async function swipeDown(px, from, to, steps = 14, pause = 16) {
  await down(px, from);
  for (let i = 1; i <= steps; i++) { await move(px, from + (to - from) * i / steps); await wait(pause); }
  await up();
}

await wait(1500);
await shot('01-title');

// Start the way a player does: tap the title bubble.
await page.mouse.click(W / 2, H / 2);
await wait(1800);
await shot('02-harness');

// Tap each buckle by projecting its world position to the screen.
for (let i = 0; i < 3; i++) {
  const p = await page.evaluate(() => {
    const g = window.__game;
    const idx = g.rig.buckles.findIndex((b) => b < 0.5);
    if (idx < 0) return null;
    const v = g.rig.buckleMeshes[idx].getWorldPosition(new (Object.getPrototypeOf(g.camera.position).constructor)());
    v.project(g.camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  });
  if (!p) break;
  await page.mouse.click(p.x, p.y);
  await wait(500);
}
await wait(900);
await shot('03-connect');

for (let i = 0; i < 8; i++) { await swipeDown(W / 2, H * 0.62, H * 0.30, 8, 14); await wait(120); }
await wait(1500);
await shot('04-edge');

for (let i = 0; i < 10; i++) { await swipeDown(W / 2, H * 0.30, H * 0.72, 10, 16); await wait(90); }
await wait(900);
await shot('05-overedge');

// Descend to the first pane.
for (let i = 0; i < 14; i++) {
  if (await page.evaluate(() => window.__game.state) !== 'descend') break;
  await swipeDown(W * 0.5, H * 0.28, H * 0.78, 12, 14);
  await wait(120);
}
await wait(600);
await shot('06-atpane');

// Play the spray + squeegee loop for every stop.
for (let stop = 0; stop < 5; stop++) {
  // spray: scrub the pane in a lawnmower pattern
  for (let pass = 0; pass < 26; pass++) {
    const st = await page.evaluate(() => window.__game.state);
    if (st !== 'spray') break;
    const y = H * (0.30 + (pass % 8) * 0.055);
    await down(W * 0.30, y);
    for (let i = 1; i <= 8; i++) { await move(W * (0.30 + 0.36 * i / 8), y); await wait(14); }
    await up();
    await wait(30);
  }
  if (stop === 0) await shot('07-sprayed');
  for (let pass = 0; pass < 40; pass++) {
    const st = await page.evaluate(() => window.__game.state);
    if (st !== 'wipe') break;
    const y = H * (0.28 + (pass % 10) * 0.05);
    await down(W * 0.28, y);
    for (let i = 1; i <= 10; i++) { await move(W * (0.28 + 0.40 * i / 10), y); await wait(12); }
    await up();
    await wait(25);
    if (stop === 0 && pass === 6) await shot('08-wiping');
  }
  if (stop === 0) { await wait(700); await shot('09-reveal'); }
  await wait(2600);
  if (await page.evaluate(() => window.__game.state) === 'finale') break;
  for (let i = 0; i < 16; i++) {
    if (await page.evaluate(() => window.__game.state) !== 'descend') break;
    await swipeDown(W * 0.5, H * 0.28, H * 0.78, 12, 14);
    await wait(120);
  }
  if (stop === 1) await shot('10-descend2');
}

await wait(1500);
await shot('11-finale-a');
await wait(3500);
await shot('12-finale-b');

console.log('final state:', await page.evaluate(() => window.__game.state));
console.log('fps sample:', await page.evaluate(() => new Promise((r) => {
  let n = 0; const t0 = performance.now();
  const f = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else r((n / ((performance.now() - t0) / 1000)).toFixed(1)); };
  requestAnimationFrame(f);
})));

await browser.close();
