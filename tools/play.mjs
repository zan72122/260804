/*
 * Logic playtest: drives the full falconry loop with real touch gestures and
 * asserts the state machine gets all the way round, twice. Runs in the low
 * quality mode with a debug time scale because the CI browser rasterises in
 * software at a few frames a second.
 *
 *   node tools/play.mjs [device]
 */
import { chromium } from 'playwright';

const DEVICE = process.argv[2] || 'iphone-portrait';
const DEVICES = {
  'iphone-portrait': { width: 393, height: 852, dpr: 2 },
  'iphone-landscape': { width: 852, height: 393, dpr: 2 },
  'iphone-se-portrait': { width: 375, height: 667, dpr: 2 },
  'ipad-portrait': { width: 820, height: 1180, dpr: 1 },
  'ipad-landscape': { width: 1180, height: 820, dpr: 1 },
};
const d = DEVICES[DEVICE];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const ctx = await browser.newContext({
  viewport: { width: d.width, height: d.height },
  deviceScaleFactor: d.dpr,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto('http://127.0.0.1:4173/?quality=low', { waitUntil: 'load' });
await page.waitForTimeout(2500);
await page.evaluate(() => { window.__timeScale = 8; });

const W = d.width, H = d.height;
const state = () => page.evaluate(() => window.__takajo?.state);
const info = () => page.evaluate(() => window.__takajo?._force.info());
let failures = 0;

async function until(states, ms = 45000, label = '') {
  const t0 = Date.now();
  let s;
  while (Date.now() - t0 < ms) {
    s = await state();
    if (states.includes(s)) {
      console.log(`  ok   ${label} -> ${s}`);
      return s;
    }
    await page.waitForTimeout(150);
  }
  console.log(`  FAIL ${label} -> stuck in ${s} (wanted ${states})`);
  failures++;
  return s;
}

async function tap(x, y) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.up();
}
async function swipeUp(x, y) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(x + Math.sin(i) * 3, y - i * 21); await page.waitForTimeout(18); }
  await page.mouse.up();
}
/** A deliberately sloppy circle — what a four-year-old actually draws. */
async function scribble(cx, cy, r, turns, steps = 30) {
  await page.mouse.move(cx + r, cy);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2 * turns;
    const wob = r * (0.66 + 0.42 * Math.sin(a * 2.3) + 0.12 * Math.sin(a * 5.1));
    await page.mouse.move(cx + Math.cos(a) * wob, cy + Math.sin(a) * wob * 0.86);
    await page.waitForTimeout(25);
  }
  await page.mouse.up();
}
async function swipeIn(fx, fy, tx, ty) {
  await page.mouse.move(fx, fy);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(fx + ((tx - fx) * i) / 12, fy + ((ty - fy) * i) / 12); await page.waitForTimeout(16); }
  await page.mouse.up();
}

console.log(`\n=== ${DEVICE} ${W}x${H} ===`);
console.log('  start:', await state());

for (let round = 1; round <= 2; round++) {
  console.log(` -- round ${round} --`);
  if (round === 1) {
    await tap(W * 0.5, H * 0.62);
    await until(['donning', 'stepUp', 'tethered'], 10000, 'tap glove');
    await until(['tethered'], 45000, 'hawk steps to fist');
    await tap(W * 0.5, H * 0.5);
    await until(['unclipping', 'ready'], 12000, 'tap clasp');
    await until(['ready'], 25000, 'leash off');
  }
  await swipeUp(W * 0.5, H * 0.62);
  await until(['casting', 'launch'], 12000, 'swipe up = cast');
  await until(['soar'], 40000, 'climb out');
  await until(['lure'], 40000, 'lure offered');
  for (let i = 0; i < 3; i++) {
    await scribble(W * 0.5, H * 0.58, Math.min(W, H) * 0.15, 3);
    const d = await info();
    console.log(`       circling: passes=${d.lurePasses} armed=${d.recallArmed}`);
    if (d.recallArmed) break;
  }
  const armed = (await info()).recallArmed;
  if (!armed) { console.log('  FAIL recall never armed by circling'); failures++; }
  await swipeIn(W * 0.86, H * 0.42, W * 0.42, H * 0.56);
  await until(['recall'], 12000, 'swipe in = recall');
  await until(['landed'], 60000, 'hawk lands on fist');
  await until(['ready'], 30000, 'ready to fly again');
}

const perf = await page.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now();
  const f = () => { n++; performance.now() - t0 > 1500 ? res((n / (performance.now() - t0)) * 1000) : requestAnimationFrame(f); };
  requestAnimationFrame(f);
}));
console.log('  swiftshader fps:', perf.toFixed(1));
console.log('  errors:', errors.length ? errors.slice(0, 5) : 'none');
console.log(failures ? `  RESULT: ${failures} FAILURE(S)` : '  RESULT: all steps passed');
await browser.close();
process.exit(failures ? 1 : 0);
