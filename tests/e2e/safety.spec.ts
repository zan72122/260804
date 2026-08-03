import { test, expect } from '@playwright/test';
import { setup, playTo, phase, waitPhase, hotspot, center, tapHot, drag, expectNoErrors, signals } from './helpers';

/**
 * A9/A10: toddler chaos — mashing, reverse swipes, offset swipes, mid-gesture
 * lifts and out-of-bounds touches must never corrupt the state machine.
 */

const PHASES = ['title', 'arrive', 'scanBefore', 'prepUnits', 'lower', 'grind', 'scanAfter', 'testRun', 'replay'];

test('mashed scan button produces exactly one sweep', async ({ page }, testInfo) => {
  const ctx = await setup(page, testInfo, 'safety');
  await playTo(page, 'scanBefore');
  const c = center(await hotspot(page, 'scan'));
  for (let i = 0; i < 20; i++) await page.mouse.click(c.x, c.y, { delay: 5 });
  await waitPhase(page, 'prepUnits', 15000);
  expect((await signals(page)).revealedBefore).toBe(true);
  expectNoErrors(ctx.errors);
});

test('offset and diagonal lever swipes still lock (forgiving input)', async ({ page }, testInfo) => {
  const ctx = await setup(page, testInfo, 'safety');
  await playTo(page, 'lower');
  const lever = await hotspot(page, 'lever');
  // start 40px left of the lever centre, drift diagonally while descending
  const cx = lever.x + lever.w / 2 - 40;
  await drag(
    page,
    { x: cx, y: lever.y + 30 },
    { x: cx + 65, y: lever.y + lever.h + 30 },
    20
  );
  await waitPhase(page, 'grind', 10000);
  expect((await signals(page)).locked).toBe(true);
  expectNoErrors(ctx.errors);
});

test('reverse lever swipe, early lift and unit mis-drop are harmless', async ({ page }, testInfo) => {
  const ctx = await setup(page, testInfo, 'safety');
  await playTo(page, 'prepUnits');
  // drop a unit far from its socket → it floats back, nothing breaks
  const tray = await hotspot(page, 'tray0');
  const t = center(tray);
  await drag(page, t, { x: t.x, y: Math.max(60, t.y - 220) }, 8);
  expect((await signals(page)).unitsDocked[0]).toBe(false);
  await playTo(page, 'lower');
  const lever = await hotspot(page, 'lever');
  const cx = lever.x + lever.w / 2;
  // reverse (upward) swipe from the knob: nothing moves
  await drag(page, { x: cx, y: lever.y + 40 }, { x: cx, y: Math.max(20, lever.y - 160) }, 10);
  expect((await signals(page)).locked).toBe(false);
  // early lift at ~40%: springs back without locking
  await drag(page, { x: cx, y: lever.y + 30 }, { x: cx, y: lever.y + lever.h * 0.4 }, 8);
  await page.waitForTimeout(1500);
  const s = await signals(page);
  expect(s.locked).toBe(false);
  expect(s.leverProgress).toBeLessThan(0.15);
  expect(await phase(page)).toBe('lower');
  expectNoErrors(ctx.errors);
});

test('random mash across every phase never leaves the legal state set', async ({ page }, testInfo) => {
  const ctx = await setup(page, testInfo, 'safety');
  const v = await page.evaluate(() => (window as any).__railGameTest.getViewport());
  const mash = async (): Promise<void> => {
    const ph = await phase(page);
    for (let i = 0; i < 12; i++) {
      // pseudo-random but deterministic positions, including screen edges
      const x = ((i * 97) % 100) / 100 * v.w;
      const y = ((i * 53) % 100) / 100 * v.h;
      if ((await phase(page)) !== ph) break; // keep mash within the target phase
      await page.mouse.click(x, y, { delay: 3 });
    }
    // a couple of wild drags too
    await drag(page, { x: 5, y: v.h - 5 }, { x: v.w - 5, y: 5 }, 6, 8);
    expect(PHASES).toContain(await phase(page));
    // close settings if the mash happened to open the gear
    if ((await signals(page)).settingsOpen) await tapHot(page, 'closeSettings');
  };
  await mash(); // title
  await playTo(page, 'scanBefore');
  await mash();
  await playTo(page, 'prepUnits');
  await mash();
  await playTo(page, 'lower');
  await mash();
  await playTo(page, 'grind');
  await mash();
  // reverse drive swipes: car must never move backwards
  const car0 = await page.evaluate(() => (window as any).__railGameTest.getCarPos());
  await drag(page, { x: v.w * 0.5, y: v.h * 0.3 }, { x: v.w * 0.5, y: v.h * 0.8 }, 12); // downward = backwards in portrait
  await page.waitForTimeout(500);
  const car1 = await page.evaluate(() => (window as any).__railGameTest.getCarPos());
  expect(car1).toBeGreaterThanOrEqual(car0 - 1e-6);
  await ctx.shot('after-mash-grind');
  expectNoErrors(ctx.errors);
});
