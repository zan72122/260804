// Feel probes at 844x390 landscape: spark response to speed, lever stages,
// lever early release, reverse swipe during grind.
import { launch, flow, shot, phase, signals, hotspots, center, waitPhase, sparkCount, carPos, tap, apiErrors } from './helpers.mjs';

const { browser, page, errors } = await launch({ width: 844, height: 390 });
const log = (...a) => console.log(...a);
try {
  await flow.titleToScan(page);
  await flow.doScan(page);
  await flow.prep(page);

  // ---- lever probes (phase: lower)
  await waitPhase(page, 'lower', 15000);
  const hs = await hotspots(page);
  const lv = hs.lever;
  const cx = lv.x + lv.w / 2;
  // 1. partial pull (to 50%) then release -> expect spring back, no lock
  await page.mouse.move(cx, lv.y + 20);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(cx, lv.y + 20 + (lv.h * 0.5 * i) / 8);
    await page.waitForTimeout(30);
  }
  const midSig = await signals(page);
  await page.mouse.up();
  await page.waitForTimeout(1200);
  const afterRelease = await signals(page);
  log('lever mid pull: progress=', midSig.leverProgress.toFixed(2), 'after release:', afterRelease.leverProgress.toFixed(2), 'locked:', afterRelease.locked);
  // 2. reverse swipe up from lever (wrong direction)
  await page.mouse.move(cx, lv.y + lv.h - 20);
  await page.mouse.down();
  await page.mouse.move(cx, lv.y - 100, { steps: 8 });
  await page.mouse.up();
  const afterReverse = await signals(page);
  log('lever after reverse swipe: progress=', afterReverse.leverProgress.toFixed(2), 'locked:', afterReverse.locked);
  // 3. pull to 85% and release -> expect auto-complete + gakon
  await page.mouse.move(cx, lv.y + 20);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(cx, lv.y + 20 + (lv.h * 0.62 * i) / 10);
    await page.waitForTimeout(25);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);
  let maxShake = 0;
  for (let i = 0; i < 20; i++) {
    const s = await signals(page);
    maxShake = Math.max(maxShake, s.shake);
    if (s.locked) break;
    await page.waitForTimeout(100);
  }
  const lockSig = await signals(page);
  log('lever 85% release -> locked:', lockSig.locked, 'maxShake around lock:', maxShake.toFixed(2));
  await shot(page, 'feel-lever-autolock');

  // ---- grind probes
  await waitPhase(page, 'grind', 15000);
  await page.waitForTimeout(500);
  const vp = page.viewportSize();
  const sx = vp.width * 0.4, sy = vp.height * 0.45;

  // reverse swipe (leftwards): car should not move backwards
  const p0 = await carPos(page);
  await page.mouse.move(sx + 200, sy);
  await page.mouse.down();
  await page.mouse.move(sx - 60, sy, { steps: 10 });
  await page.waitForTimeout(600);
  await page.mouse.up();
  const p1 = await carPos(page);
  log('reverse swipe: carPos', p0.toFixed(2), '->', p1.toFixed(2));

  // slow creep: press & hold only
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  let slow = [];
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(300);
    slow.push({ sparks: await sparkCount(page), g: +(await signals(page)).grindIntensity.toFixed(2) });
  }
  await page.mouse.up();
  log('slow creep samples:', JSON.stringify(slow));
  await shot(page, 'feel-grind-slow');

  // fast swipe + hold
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) { await page.mouse.move(sx + (260 * i) / 6, sy); await page.waitForTimeout(10); }
  let fast = [];
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(300);
    fast.push({ sparks: await sparkCount(page), g: +(await signals(page)).grindIntensity.toFixed(2) });
    if ((await phase(page)) !== 'grind') break;
  }
  await page.mouse.up();
  log('fast swipe samples:', JSON.stringify(fast));
  await shot(page, 'feel-grind-fast');

  // diagonal swipe
  if ((await phase(page)) === 'grind') {
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx + 150, sy + 150, { steps: 8 });
    await page.mouse.up();
    log('diagonal swipe ok, phase:', await phase(page));
  }

  // mist boost
  if ((await phase(page)) === 'grind') {
    const hs2 = await hotspots(page);
    if (hs2.mist) {
      await tap(page, center(hs2.mist).x, center(hs2.mist).y);
      await page.waitForTimeout(200);
      log('mist after tap:', (await signals(page)).mistLevel);
      await shot(page, 'feel-mist-boost');
    }
  }
  log('final phase:', await phase(page));
} finally {
  log('page errors:', JSON.stringify(errors));
  log('api errors:', JSON.stringify(await apiErrors(page).catch(() => 'n/a')));
  await browser.close();
}
