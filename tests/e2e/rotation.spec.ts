import { test, expect } from '@playwright/test';
import { setup, playTo, phase, signals, driveSwipe, expectNoErrors } from './helpers';

/**
 * A3: rotating the device mid-work keeps every bit of work state —
 * the ground rail stays ground, no double audio, touch targets remap.
 * Runs both phone and tablet dimension pairs.
 */

const PAIRS = [
  { name: 'iphone', a: { width: 390, height: 844 }, b: { width: 844, height: 390 } },
  { name: 'ipad', a: { width: 820, height: 1180 }, b: { width: 1180, height: 820 } },
];

for (const pair of PAIRS) {
  test(`rotation mid-grind preserves work state (${pair.name})`, async ({ page }, testInfo) => {
    await page.setViewportSize(pair.a);
    const ctx = await setup(page, testInfo, `rotation-${pair.name}`);
    await playTo(page, 'grind', ctx);

    // grind partway through the zone
    const zone = await page.evaluate(() => (window as any).__railGameTest.getZone());
    const deadline = Date.now() + 90000;
    while (true) {
      const car = await page.evaluate(() => (window as any).__railGameTest.getCarPos());
      if (car > zone.start + 2) break;
      if (Date.now() > deadline) throw new Error('could not reach zone');
      await driveSwipe(page);
    }
    // wait for the car to coast to a stop (its own inertia, not rotation)
    await page.waitForFunction(() => (window as any).__railGameTest.getCarSpeed() === 0, undefined, {
      timeout: 10000,
    });
    const before = {
      phase: await phase(page),
      car: await page.evaluate(() => (window as any).__railGameTest.getCarPos()),
      rms: await page.evaluate(() => (window as any).__railGameTest.getRailRms()),
      audioStarts: (await signals(page)).audioStarts,
    };
    expect(before.phase).toBe('grind');
    await ctx.shot('before-rotation');

    // rotate
    await page.setViewportSize(pair.b);
    await page.waitForTimeout(300);
    await ctx.shot('after-rotation');

    const after = {
      phase: await phase(page),
      car: await page.evaluate(() => (window as any).__railGameTest.getCarPos()),
      rms: await page.evaluate(() => (window as any).__railGameTest.getRailRms()),
      audioStarts: (await signals(page)).audioStarts,
    };
    expect(after.phase).toBe(before.phase);
    expect(after.car).toBeCloseTo(before.car, 4);
    expect(after.rms).toBeCloseTo(before.rms, 4); // ground rail stays ground
    // no double audio: the context was created at most once, ever
    expect(after.audioStarts).toBeLessThanOrEqual(1);
    expect(after.audioStarts).toBe(before.audioStarts);

    // touch coordinates remap: all hotspots inside the new viewport
    const spots = await page.evaluate(() => (window as any).__railGameTest.getHotspots());
    for (const [name, r] of Object.entries<any>(spots)) {
      expect(r.x, `${name} x`).toBeGreaterThanOrEqual(-1);
      expect(r.y, `${name} y`).toBeGreaterThanOrEqual(-1);
      expect(r.x + r.w, `${name} right`).toBeLessThanOrEqual(pair.b.width + 1);
      expect(r.y + r.h, `${name} bottom`).toBeLessThanOrEqual(pair.b.height + 1);
    }

    // and the game keeps playing in the new orientation
    await driveSwipe(page);
    await page.waitForTimeout(400);
    const carAfterDrive = await page.evaluate(() => (window as any).__railGameTest.getCarPos());
    expect(carAfterDrive).toBeGreaterThan(after.car);

    // rotate back mid-everything, still alive
    await page.setViewportSize(pair.a);
    await page.waitForTimeout(300);
    expect(await phase(page)).toBe('grind');
    await ctx.shot('rotated-back');
    expectNoErrors(ctx.errors);
  });
}
