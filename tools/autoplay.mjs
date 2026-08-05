/**
 * Automated playtest: drives the whole game with synthetic taps / swipes /
 * drags (the only gestures the game accepts), asserts the game state after
 * every task, and captures screenshots.
 *
 *   node tools/autoplay.mjs <width> <height> <label> [shotDir]
 *   e.g. node tools/autoplay.mjs 390 844 iphone-portrait
 *
 * Requires `playwright` (npm i playwright) and the game served at
 * http://localhost:8611 (python3 -m http.server 8611).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [W, H, LABEL, SHOTDIR] = [
  parseInt(process.argv[2] || '390'),
  parseInt(process.argv[3] || '844'),
  process.argv[4] || 'run',
  process.argv[5] || 'shots',
];
const URL = process.env.GAME_URL || 'http://localhost:8611/index.html';
const dir = `${SHOTDIR}/${LABEL}`;
fs.mkdirSync(dir, { recursive: true });

const T0 = Date.now();
const stamp = () => `${((Date.now() - T0) / 1000).toFixed(0)}s`;
const fail = (msg) => { console.error(`❌ ${stamp()} [${LABEL}] ${msg}`); process.exitCode = 1; };
const ok = (msg) => console.log(`✅ ${stamp()} [${LABEL}] ${msg}`);
const log = (msg) => console.log(`   ${stamp()} [${LABEL}] ${msg}`);
setTimeout(() => { console.error(`❌ [${LABEL}] global timeout`); process.exit(2); }, 420000);

const browser = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium')
    ? { executablePath: '/opt/pw-browsers/chromium' }
    : {}
);
const page = await browser.newPage({
  viewport: { width: W, height: H },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL);
await page.waitForTimeout(800);

const dbg = (expr) => page.evaluate(`PARK_DEBUG.${expr}`);
const shot = (name) => page.screenshot({ path: `${dir}/${name}.png` });

async function waitPhase(name, timeout = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if ((await dbg('phase()')) === name) return true;
    await page.waitForTimeout(200);
  }
  fail(`timed out waiting for phase "${name}" (now: ${await dbg('phase()')})`);
  return false;
}

async function drag(from, to, steps = 14, stepDelay = 16) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * i) / steps,
      from.y + ((to.y - from.y) * i) / steps
    );
    await page.waitForTimeout(stepDelay);
  }
  await page.mouse.up();
}

/* ---- title ---- */
await shot('00-title');
await page.click('#start-btn', { force: true });
await page.waitForTimeout(600);
await shot('01-intro-dry-park');
await dbg('skipIntro()');
await waitPhase('leaves');
await page.waitForTimeout(1600); // let the camera settle

/* ---- 1. leaves (swipe) ---- */
for (let iter = 0; iter < 40; iter++) {
  const st = await dbg('state()');
  if (st.leaves.collected >= st.leaves.total) break;
  if (iter % 5 === 0) log(`leaves ${st.leaves.collected}/${st.leaves.total}`);
  const remaining = st.leaves.total - st.leaves.collected;
  const p = await dbg(`screen('leaf',${iter % Math.max(remaining, 1)})`);
  if (!p) break;
  if (p.x < 5 || p.x > W - 5 || p.y < 5 || p.y > H - 5) continue;
  await drag({ x: p.x - 20, y: p.y }, { x: p.x + 20, y: p.y }, 5, 10);
  await page.waitForTimeout(60);
}
{
  const st = await dbg('state()');
  st.leaves.collected >= st.leaves.total
    ? ok(`leaves collected ${st.leaves.collected}/${st.leaves.total}`)
    : fail(`leaves stuck at ${st.leaves.collected}/${st.leaves.total}`);
}
await shot('02-leaves-done');
await waitPhase('till');
await page.waitForTimeout(1600);

/* ---- 2. till the beds (swipe) ---- */
for (let bi = 0; bi < 3; bi++) {
  for (let iter = 0; iter < 30; iter++) {
    const st = await dbg('state()');
    if (st.beds[bi].tilled) break;
    if (iter % 5 === 0) log(`bed ${bi} progress ${st.beds[bi].progress.toFixed(2)}`);
    const c = await dbg(`screen('bed',${bi})`);
    await drag({ x: c.x - 55, y: c.y - 8 }, { x: c.x + 55, y: c.y + 8 }, 10, 12);
  }
  const st = await dbg('state()');
  st.beds[bi].tilled ? ok(`bed ${bi} tilled`) : fail(`bed ${bi} not tilled (${st.beds[bi].progress})`);
}
await shot('03-tilled');
await waitPhase('plant');
await page.waitForTimeout(1600);

/* ---- 3. plant seeds (tap) ---- */
for (let bi = 0; bi < 3; bi++) {
  for (let j = 0; j < 3; j++) {
    const p = await dbg(`screen('bedPoint',${bi},${j})`);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(180);
  }
}
{
  const st = await dbg('state()');
  st.planted >= 9 ? ok(`planted ${st.planted} seeds`) : fail(`only planted ${st.planted}`);
}
await shot('04-planted');
await waitPhase('channel');
await page.waitForTimeout(1600);

/* ---- 4. connect the channel (drag) ---- */
for (let round = 0; round < 3; round++) {
  let done = false;
  for (let attempt = 0; attempt < 5 && !done; attempt++) {
    const st = await dbg('state()');
    const gi = st.gaps.findIndex((g) => !g);
    if (gi === -1) { done = true; break; }
    const pi = !st.pieces[gi] ? gi : st.pieces.findIndex((s) => !s);
    await page.waitForTimeout(1300); // camera glides to the active pair
    const from = await dbg(`screen('piece',${pi})`);
    const to = await dbg(`screen('gap',${gi})`);
    log(`drag piece ${pi} (${from.x | 0},${from.y | 0}) -> gap ${gi} (${to.x | 0},${to.y | 0})`);
    await drag(from, to, 18, 20);
    await page.waitForTimeout(300);
    const st2 = await dbg('state()');
    done = st2.gaps.filter(Boolean).length > st.gaps.filter(Boolean).length;
  }
  done ? ok(`channel round ${round} snapped`) : fail(`channel round ${round} did not snap`);
}
await shot('05-channels-connected');
await waitPhase('nozzle');
await page.waitForTimeout(1600);

/* ---- 5. fix the nozzles (tap) ---- */
for (let ni = 0; ni < 3; ni++) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const st = await dbg('state()');
    if (st.nozzles[ni]) break;
    const p = await dbg(`screen('nozzle',${ni})`);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(300);
  }
}
{
  const st = await dbg('state()');
  st.nozzles.every(Boolean) ? ok('all nozzles fixed') : fail(`nozzles: ${st.nozzles}`);
}
await shot('06-nozzles-fixed');
await waitPhase('gate');
await page.waitForTimeout(1700);

/* ---- 6. open the sluice gate (drag up) ---- */
await shot('07-gate-before');
for (let attempt = 0; attempt < 6; attempt++) {
  const st = await dbg('state()');
  if (st.gateOpen >= 1) break;
  const p = await dbg("screen('gate')");
  await drag(p, { x: p.x, y: p.y - H * 0.4 }, 16, 18);
  await page.waitForTimeout(200);
}
{
  const st = await dbg('state()');
  st.gateOpen >= 1 ? ok('gate fully open') : fail(`gate stuck at ${st.gateOpen}`);
}

/* ---- finale (camera tour: water → fountain → wheel → beds → overview) ---- */
await waitPhase('finale', 5000);
const waitClock = async (target) => {
  for (let i = 0; i < 200; i++) {
    const f = (await dbg('state()')).finale;
    if (f.clock >= target || f.done) return;
    await page.waitForTimeout(250);
  }
};
await waitClock(2.0); await shot('08-water-rushing');
await waitClock(7.0); await shot('09-fountain');
await waitClock(9.5); await shot('10-wheel');
await waitClock(12.8); await shot('11-beds-bloom');
await waitPhase('free', 90000);
await page.waitForTimeout(4000);
await shot('12-park-alive');

const st = await dbg('state()');
const f = st.finale;
const checks = [
  ['junction reached', f.junction],
  ['fountain on', f.fountainOn],
  ['wheel spinning', f.wheelOn && st.wheelSpeed > 1.5],
  ['pond filled', f.pond],
  ['west pool filled', f.westPool],
  ['park fully alive (life=1)', f.life >= 1],
  ['creatures released', f.creatures],
  ['all 9 planted flowers bloomed', st.bloomedPlants >= 9],
  ['ambient flowers bloomed', st.ambientBloomed > 120],
  ['gate open', st.gateOpen >= 1],
];
for (const [name, cond] of checks) (cond ? ok : fail)(name);

const fps = await dbg('fps()');
console.log(`ℹ️  [${LABEL}] fps=${fps.toFixed(1)} drawCalls=${st.draws} ambientBloomed=${st.ambientBloomed}`);
// headless CI renders on a software GPU; real devices are far faster
if (fps < 14) fail(`fps too low even for software rendering: ${fps}`);
if (errors.length) fail(`console errors:\n${errors.join('\n')}`);
else ok('no console errors');

await browser.close();
console.log(process.exitCode ? `[${LABEL}] FAILED` : `[${LABEL}] ALL CHECKS PASSED`);
