// Framing check: boots the game at a given viewport, steps it through every
// phase and captures one screenshot each. Much cheaper than driving the whole
// interaction, and it is what you want when checking composition and layout.
//
// usage: node tools/frames.mjs <name> <width> <height>

import { chromium } from 'playwright';
import fs from 'node:fs';

const [, , name = 'frames', W = '820', H = '1180'] = process.argv;
const outDir = '/tmp/claude-0/-home-user-260804/c2caf621-1ba3-5ecb-919d-f51a9497cada/scratchpad/shots';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: +W, height: +H }, hasTouch: true, isMobile: true });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:8123/index.html', { waitUntil: 'load' });
await page.waitForTimeout(4000);

// Camera damping is frame-driven, so wait for it to stop rather than guessing.
async function settle(maxMs = 40000) {
  const t0 = Date.now();
  let prev = null;
  while (Date.now() - t0 < maxMs) {
    const cam = await page.evaluate(() => Array.from(window.__game.camPos));
    if (prev && Math.hypot(...cam.map((v, i) => v - prev[i])) < 0.003) return;
    prev = cam;
    await page.waitForTimeout(500);
  }
}

const STAGES = [
  ['intro', () => { }],
  ['uchi0', (g) => { g.started = true; g.setPhase('uchi'); }],
  ['uchi1', (g) => { g.strike(); }],
  ['uchi3', (g) => { g.hits = 2; g.strike(); }],
  ['peron', (g) => { g.setPhase('peron'); g.peelProgress = 0.45; g.peelSnap = false; }],
  ['fuwa', (g) => { g.setPhase('fuwa'); g.peelProgress = 1; g.leaf.gust([0, 0.08, -0.115], [1, 0, 0], 0.08, 0.05); }],
  ['kiri', (g) => { g.setPhase('kiri'); }],
  ['kiri-cut', (g) => { g.kiriT = 1.5; }],
  ['urushi', (g) => { g.setPhase('urushi'); }],
  ['peta', (g) => { g.setPhase('peta'); g.leaf.place(0, 0.08, 0.02); }],
  ['kira', (g) => { g.setPhase('kira'); g.landed = true; g.landFrom = [0, 0.02, 0.185]; g.leaf.place(0, 0, 0.185); g.leaf.conform = 1; g.leaf.adhesion = 0.6; g.leaf.bond = 1.4; }],
  ['done', (g) => { g.finish(); }],
];

for (const [tag, fn] of STAGES) {
  await page.evaluate(`(${fn.toString()})(window.__game)`);
  await settle();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${outDir}/${name}-${tag}.png` });
  const s = await page.evaluate(() => ({ phase: window.__game.phase, fps: Math.round(window.__game.fps || 0) }));
  console.log(tag.padEnd(7), JSON.stringify(s));
}
console.log(errors.length ? 'CONSOLE: ' + [...new Set(errors)].slice(0, 8).join(' | ') : 'console clean');
await browser.close();
