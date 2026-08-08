/*
 * Beauty pass: full quality, the game's own camera, captured at the moments
 * that matter — the level arm, the cast, the long way home, the flare, the
 * landing. Run for one screen size at a time.
 *
 *   node tools/shots.mjs <outDir> [device]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = process.argv[2];
const DEVICE = process.argv[3] || 'iphone-portrait';
const DEVICES = {
  'iphone-portrait': { width: 393, height: 852, dpr: 2 },
  'iphone-landscape': { width: 852, height: 393, dpr: 2 },
  'iphone-se-portrait': { width: 375, height: 667, dpr: 2 },
  'ipad-portrait': { width: 820, height: 1180, dpr: 1 },
  'ipad-landscape': { width: 1180, height: 820, dpr: 1 },
};
const d = DEVICES[DEVICE];
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await browser.newContext({
  viewport: { width: d.width, height: d.height },
  deviceScaleFactor: 1, isMobile: true, hasTouch: true,
})).newPage();
page.on('pageerror', (e) => console.log('ERR', e.message));

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'load' });
await page.waitForTimeout(3500);
await page.evaluate(() => { window.__timeScale = 4; });

const STOP = process.env.STOP || '';
/** Wait until the camera stops moving, so frames are never caught mid-cut. */
async function settle(ms = 40000) {
  const t0 = Date.now();
  let prev = null;
  while (Date.now() - t0 < ms) {
    const s = (await page.evaluate(() => window.__takajo._force.info())).shot;
    const k = s.look.join(',') + s.fitH + s.minW;
    if (prev === k) return;
    prev = k;
    await page.waitForTimeout(400);
  }
}
const shot = async (n, wait = true) => {
  if (wait) await settle();
  await page.screenshot({ path: `${OUT}/${DEVICE}-${n}.png`, timeout: 90000 });
  console.log('  shot', n);
  if (STOP && n.startsWith(STOP)) { await browser.close(); process.exit(0); }
};
const state = () => page.evaluate(() => window.__takajo?.state);
const force = (fn) => page.evaluate((f) => window.__takajo._force[f](), fn);
async function until(states, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (states.includes(await state())) return true; await page.waitForTimeout(150); }
  console.log('  timeout waiting for', states, 'in', await state());
  return false;
}
/** Drop to real time for a beat so a captured frame is not a blur of big steps. */
const slow = async () => page.evaluate(() => { window.__timeScale = 2; });
const fast = async () => page.evaluate(() => { window.__timeScale = 4; });

console.log(`\n== beauty ${DEVICE} ==`);
await slow(); await shot('a-open');
await fast();

await force('don');
await until(['tethered']);
await slow(); await page.waitForTimeout(1200); await shot('b-on-fist');

await force('unclip');
await until(['ready']);
await page.waitForTimeout(600); await shot('c-ready');

await force('cast');
await page.waitForTimeout(900); await shot('d-cast', false);
await page.waitForTimeout(1600); await shot('e-climb', false);
await fast();

await until(['soar']);
await page.waitForTimeout(2000);
await slow(); await shot('f-soar'); await fast();

await until(['lure']);
await page.waitForTimeout(1500);
await slow(); await shot('g-lure'); await fast();

await force('armRecall');
await force('recall');
// Wall-clock waits are useless here: the software rasteriser advances game
// time far slower than real time, so wait on the return's own progress.
const recallAt = async (test, ms = 120000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const r = (await page.evaluate(() => window.__takajo._force.info())).recall;
    if (test(r)) return r;
    await page.waitForTimeout(200);
  }
  console.log('  timeout waiting on recall phase');
};
await recallAt((r) => r.phase === 'glide' && r.u > 0.12);
await shot('h-return-far', false);
await recallAt((r) => r.phase === 'glide' && r.u > 0.6);
await shot('i-return-near', false);
await recallAt((r) => r.phase === 'flare' || r.phase === 'done');
await shot('j-flare', false);
await until(['landed', 'ready'], 40000);
await page.waitForTimeout(500); await shot('k-landed');

await browser.close();
