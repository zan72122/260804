import { test, expect } from '@playwright/test';
import {
  setup,
  playTo,
  phase,
  waitPhase,
  signals,
  hotspot,
  tapHot,
  expectNoErrors,
  luminance,
  driveSwipe,
} from './helpers';

/**
 * The complete toy loop on every required viewport, driven purely through
 * real pointer gestures. Also verifies the acceptance invariants that are
 * observable along the way (A1, A4–A8, A11, A12, A14).
 */

test('full play loop with signature actions', async ({ page }, testInfo) => {
  const ctx = await setup(page, testInfo);
  await ctx.shot('title');

  // A11: every hotspot the child can touch is at least 64 px
  const checkTargets = async (): Promise<void> => {
    const spots = await page.evaluate(() => (window as any).__railGameTest.getHotspots());
    for (const [name, r] of Object.entries<any>(spots)) {
      expect(r.w, `${name} width`).toBeGreaterThanOrEqual(64);
      expect(r.h, `${name} height`).toBeGreaterThanOrEqual(64);
    }
  };
  await checkTargets();

  // ---- arrive: rough rail must audibly/visibly shake the car (A8 pre-state)
  await tapHot(page, 'play');
  let arriveShake = 0;
  for (let i = 0; i < 30 && (await phase(page)) === 'arrive'; i++) {
    const s = await signals(page);
    arriveShake = Math.max(arriveShake, s.shake);
    await page.waitForTimeout(120);
  }
  expect(arriveShake).toBeGreaterThan(0.5);
  await waitPhase(page, 'scanBefore', 25000);
  await checkTargets();

  // ---- scan before (サーッ): reveals the corrugation
  const initialRms = await page.evaluate(() => (window as any).__railGameTest.getInitialRms());
  expect(initialRms).toBeGreaterThan(0.3);
  await playTo(page, 'prepUnits', ctx);
  expect((await signals(page)).revealedBefore).toBe(true);
  await checkTargets();

  // ---- dock units, lower with the big lever (ガコン)
  await playTo(page, 'lower', ctx);
  await checkTargets();
  // A6: no sparks before the units lock onto the rail
  expect(await page.evaluate(() => (window as any).__railGameTest.getSparkCount())).toBe(0);
  await playTo(page, 'grind', ctx);
  expect((await signals(page)).locked).toBe(true);

  // ---- grind (シャーッ): sparks stream, rail smooths in sync with the car
  const zone = await page.evaluate(() => (window as any).__railGameTest.getZone());
  let sawSparks = false;
  let flickerMax = 0;
  let prevLum = await luminance(page);
  let aheadCheckDone = false;
  const deadline = Date.now() + 120000;
  while ((await phase(page)) === 'grind') {
    if (Date.now() > deadline) throw new Error('grind timeout');
    await driveSwipe(page);
    const sp = await page.evaluate(() => (window as any).__railGameTest.getSparkCount());
    if (sp > 0) sawSparks = true;
    // A12: no full-screen flashing — frame-to-frame mean luminance stays calm
    const lum = await luminance(page);
    flickerMax = Math.max(flickerMax, Math.abs(lum - prevLum));
    prevLum = lum;
    const car = await page.evaluate(() => (window as any).__railGameTest.getCarPos());
    if (!aheadCheckDone && car > zone.start + 1 && car - 2.6 < zone.end - 5.5) {
      // A7: track ahead of the grinder is still untouched while behind smooths
      const aheadRms = await page.evaluate(
        ([a, b]) => (window as any).__railGameTest.getRailRmsSpan(a, b),
        [zone.end - 4, zone.end - 1]
      );
      expect(aheadRms).toBeGreaterThan(0.3);
      await ctx.shot('grind-mid-sync');
      aheadCheckDone = true;
    }
  }
  expect(sawSparks).toBe(true);
  expect(aheadCheckDone).toBe(true);
  expect(flickerMax).toBeLessThan(0.18);

  // ---- scan after: the wave is measurably and visibly gone (A5)
  await waitPhase(page, 'scanAfter', 20000);
  const rmsAfter = await page.evaluate(() => (window as any).__railGameTest.getRailRms());
  expect(rmsAfter).toBeLessThan(initialRms * 0.4);
  await playTo(page, 'testRun', ctx);

  // ---- test run (スーッ): quiet whoosh, no bouncing plush (A8 post-state)
  await ctx.shot('test-run-ready');
  await driveSwipe(page, false);
  await page.waitForTimeout(900);
  await ctx.shot('test-run-gliding');
  let maxWhoosh = 0;
  let maxBob = 0;
  for (let i = 0; i < 40 && (await phase(page)) === 'testRun'; i++) {
    const s = await signals(page);
    maxWhoosh = Math.max(maxWhoosh, s.whoosh);
    maxBob = Math.max(maxBob, s.trainBob);
    await page.waitForTimeout(150);
  }
  expect(maxWhoosh).toBeGreaterThan(0.25);
  expect(maxBob).toBeLessThan(0.8);
  await waitPhase(page, 'replay', 40000);
  await ctx.shot('replay');

  // ---- A14: back into the signature loop within 2 taps
  await tapHot(page, 'replaySame');
  expect(await phase(page)).toBe('arrive');
  await waitPhase(page, 'scanBefore', 25000);
  await expect(page.evaluate(() => (window as any).__railGameTest.getHotspots().scan)).resolves.toBeTruthy();
  const rmsReset = await page.evaluate(() => (window as any).__railGameTest.getRailRms());
  expect(rmsReset).toBeGreaterThan(0.3); // same rough track again
  await ctx.shot('replayed-scan-ready');

  // A4: zero console errors / unhandled exceptions across the whole loop
  expectNoErrors(ctx.errors);
});
