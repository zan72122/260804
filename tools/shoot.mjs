// Playtest harness: drives the game through its five actions at a given
// viewport and writes a screenshot per beat. Polls game state instead of
// sleeping blindly, so it stays correct on a slow software rasteriser.
//
// usage: node tools/shoot.mjs <name> <width> <height> [dpr]

import { chromium } from 'playwright';
import fs from 'node:fs';

const [, , name = 'iphone', W = '390', H = '844', DPR = '1'] = process.argv;
const width = +W, height = +H;
const outDir = '/tmp/claude-0/-home-user-260804/c2caf621-1ba3-5ecb-919d-f51a9497cada/scratchpad/shots';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: [
    '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox',
  ],
});
const ctx = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: +DPR,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[error] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

await page.goto('http://localhost:8123/index.html', { waitUntil: 'load' });

/** Where a world point lands on screen, in CSS pixels. */
const screenOf = (worldPoint) => page.evaluate((wp) => {
  const g = window.__game;
  const n = g.camera.project(wp);
  const r = g.canvas.getBoundingClientRect();
  return { x: (n[0] * 0.5 + 0.5) * r.width, y: (1 - (n[1] * 0.5 + 0.5)) * r.height };
}, worldPoint);

const state = () => page.evaluate(() => {
  const g = window.__game;
  if (!g) return null;
  return {
    phase: g.phase, hits: g.hits, fps: Math.round(g.fps || 0),
    peel: +(g.peelProgress ?? 0).toFixed(2),
    gusts: g.gusts, landed: !!g.landed,
    wrinkle: +(g.leaf.wrinkleAmountCached ?? 0).toFixed(3),
    adhesion: +g.leaf.adhesion.toFixed(2),
    conform: +g.leaf.conform.toFixed(2),
    leafY: +g.leaf.pos[1].toFixed(3),
    cam: Array.from(g.camPos).map((v) => +v.toFixed(3)),
  };
});

const shot = (tag) => page.screenshot({ path: `${outDir}/${name}-${tag}.png` });

/** Wait until the camera has stopped moving (frames are slow under swiftshader). */
async function settle(maxMs = 30000) {
  const t0 = Date.now();
  let prev = null;
  while (Date.now() - t0 < maxMs) {
    const s = await state();
    if (prev && Math.hypot(...s.cam.map((v, i) => v - prev[i])) < 0.002) return s;
    prev = s.cam;
    await page.waitForTimeout(400);
  }
  return state();
}

async function waitPhase(target, maxMs = 25000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await state();
    if (s && s.phase === target) return s;
    await page.waitForTimeout(250);
  }
  return state();
}

async function drag(x0, y0, x1, y1, steps = 20, holdEnd = 0) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await page.mouse.move(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    await page.waitForTimeout(20);
  }
  if (holdEnd) await page.waitForTimeout(holdEnd);
  await page.mouse.up();
}

const cx = width / 2, cy = height / 2;
const log = [];
const note = async (tag) => {
  const s = await state();
  log.push(`${tag.padEnd(14)} ${JSON.stringify(s)}`);
  return s;
};

await settle();
await shot('0-intro'); await note('intro');

// --- 1. トントン ---------------------------------------------------------
await page.mouse.click(cx, cy);
await settle();
await shot('1-uchi'); await note('uchi');
for (let i = 0; i < 6; i++) {
  if ((await state()).phase !== 'uchi') break;
  await page.mouse.click(cx, cy + 40);
  await page.waitForTimeout(500);
  if (i === 0) await shot('1b-uchi-hit');
}
await waitPhase('peron');
await settle();
await shot('2-peron-closed'); await note('peron');

// --- 2. ペロン (swipe away) ----------------------------------------------
for (let i = 0; i < 6; i++) {
  if ((await state()).phase !== 'peron') break;
  await drag(cx, cy + height * 0.14, cx, cy - height * 0.16, 18);
  await page.waitForTimeout(400);
  if (i === 0) await shot('2b-peron-open');
}
await waitPhase('fuwa');
await settle();
await shot('3-fuwa'); await note('fuwa');

// --- 3. フワッ ------------------------------------------------------------
for (let i = 0; i < 8; i++) {
  if ((await state()).phase !== 'fuwa') break;
  await drag(cx - width * 0.32, cy + (i % 2 ? 24 : -12), cx + width * 0.32, cy + (i % 2 ? -12 : 24), 10);
  await page.waitForTimeout(350);
  if (i === 0) await shot('3b-fuwa-ripple');
}
await waitPhase('peta');
await settle();
await shot('4-peta-start'); await note('peta');

// --- 4. ぺたっ : drag from where the leaf actually is to where the piece is --
for (let i = 0; i < 4; i++) {
  if ((await state()).landed) break;
  const from = await screenOf([0, 0.075, -0.055]);
  const to = await screenOf([0, 0.02, 0.185]);
  await drag(from.x, from.y, to.x, to.y, 24, 600);
  await page.waitForTimeout(700);
  if (i === 0) await shot('4b-peta-carry');
}
await waitPhase('kira');
await settle();
await shot('4c-peta-landed'); await note('landed');

// --- 5. キラッ ------------------------------------------------------------
const piece = await screenOf([0, 0.02, 0.185]);
for (let i = 0; i < 24; i++) {
  if ((await state()).phase !== 'kira') break;
  const y = piece.y + (i % 3 - 1) * height * 0.025;
  await drag(piece.x - width * 0.22, y, piece.x + width * 0.22, y, 10);
  await page.waitForTimeout(120);
  if (i === 2) await shot('5-kira-brush');
}
await shot('5b-kira-flash'); await note('kira-end');
await waitPhase('done');
await settle();
await shot('6-done'); await note('done');

console.log(log.join('\n'));
console.log(errors.length ? 'CONSOLE:\n' + [...new Set(errors)].slice(0, 20).join('\n') : 'console clean');
await browser.close();
