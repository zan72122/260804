/**
 * じどう しあそび：さいしょから 「できた！」まで とおしで あそぶ。
 * ヘッドレス（ソフトウェア GL）は とても おそいので、
 * じかんでは なく 「じょうたい」を みて つぎに すすむ。
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = '/tmp/claude-0/-home-user-260804/7dd9874b-0e25-5097-9f7f-9588671b1b69/scratchpad/shots';
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = {
  'iphone-portrait': { width: 390, height: 844 },
  'iphone-landscape': { width: 844, height: 390 },
  'ipad-portrait': { width: 820, height: 1180 },
  'ipad-landscape': { width: 1180, height: 820 },
};
const which = process.argv[2] || 'iphone-landscape';
const vp = VIEWPORTS[which];

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'],
});
const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errs.push(`[console] ${m.text()}`); });

const EXTRA = process.env.GAME_QS || '';
await page.goto('http://127.0.0.1:8123/index.html' + EXTRA, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.click('#startBtn', { force: true });
await page.waitForTimeout(1500);

const info = () => page.evaluate(() => window.__game.info());
const shot = (n) => page.screenshot({ path: `${OUT}/full-${which}-${n}.png` });
const proj = (q) => page.evaluate((v) => window.__game.project(v[0], v[1], v[2]), q);
const rollerPos = () => page.evaluate(() => [window.__game.roller.pos.x, window.__game.roller.pos.y]);

async function holdAt(pt, predicate, maxMs = 30000) {
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.down();
  const t0 = Date.now();
  let ok = false;
  while (Date.now() - t0 < maxMs) {
    await page.mouse.move(pt.x + (Math.random() - 0.5), pt.y + (Math.random() - 0.5)); // すこし ゆらす
    await page.waitForTimeout(250);
    if (await predicate()) { ok = true; break; }
  }
  await page.mouse.up();
  return ok;
}

/* ---------- 1) ほって つむ ---------- */
let loops = 0;
while (loops < 10) {
  const st = await info();
  if (st.state !== 'dig') break;
  loops++;

  const spot = await page.evaluate(() => window.__game.digSpot());
  const a = await proj([spot[0], spot[1] + 0.05, spot[2]]);
  const filled = await holdAt(a, async () => (await info()).load > 0.97, 60000);

  const dp = await page.evaluate(() => window.__game.truckDrop());
  const t = await proj([dp[0], dp[1] + 0.9, dp[2]]);
  await holdAt(t, async () => (await info()).load < 0.02, 40000);

  const now = await info();
  console.log(`loop ${loops} filled=${filled} load=${now.load.toFixed(2)} fill=${now.fill.toFixed(2)} fps=${now.fps}`);
  if (loops === 2) await shot('a-dig');
  if (now.state !== 'dig') break;
}
console.log('after dig:', JSON.stringify(await info()));
await shot('b-after-dig');

/* ---------- 2) ダンプ たいじょう ---------- */
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(500);
  if ((await info()).state === 'roll') break;
}
console.log('roll started:', JSON.stringify(await info()));
await shot('c-roll-start');

/* ---------- 3) ならす ---------- */
let passes = 0;
while (passes < 20) {
  const st = await info();
  if (st.state !== 'roll') break;
  passes++;
  const lane = [-2.2, 0, 2.2][passes % 3];
  const targetX = passes % 2 ? -6.9 : 6.9;
  const pt = await proj([targetX, 0.32, lane]);
  await holdAt(pt, async () => {
    const [rx, rz] = await rollerPos();
    return Math.abs(rx - targetX) < 0.7 && Math.abs(rz - lane) < 0.7;
  }, 40000);
  const now = await info();
  console.log(`pass ${passes} lane=${lane} roll=${now.roll.toFixed(3)} above=${now.above.toFixed(1)}`);
  if (passes === 3) await shot('d-rolling');
}
console.log('after roll:', JSON.stringify(await info()), 'passes', passes);
await shot('e-after-roll');

/* ---------- 4) かんせい ---------- */
let cleared = false;
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(1500);
  if (await page.isVisible('#clear')) { cleared = true; break; }
  if (i === 6) await shot('f-finale');
}
await shot('g-clear');
console.log('cleared:', cleared);
console.log('errors:', errs.length ? errs.join('\n') : 'none');
await browser.close();
process.exit(cleared ? 0 : 1);
