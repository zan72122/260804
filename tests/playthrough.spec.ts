/**
 * A scripted play-through, run at four device sizes.
 *
 * These are not unit tests: they drive the real game with real pointer
 * events and assert that the causal chain actually happens — the water
 * rises when you swipe, fruit surfaces when you drive the reel, the raft
 * packs when you pull the boom, and the truck fills when you hold the pump.
 */

import { test, expect, type Page } from '@playwright/test';

const enum Step {
  Intro,
  Gate,
  Reel,
  Reveal,
  Boom,
  Hose,
  Pump,
  Done,
  Sandbox,
}

const SIZES = [
  { name: 'iphone-portrait', width: 390, height: 844 },
  { name: 'iphone-landscape', width: 844, height: 390 },
  { name: 'ipad-portrait', width: 820, height: 1180 },
  { name: 'ipad-landscape', width: 1180, height: 820 },
];

async function step(page: Page): Promise<number> {
  return page.evaluate(() => window.__game!.step());
}

async function waitStep(page: Page, want: number, timeout = 60000): Promise<void> {
  await expect
    .poll(async () => step(page), { timeout, intervals: [200] })
    .toBe(want);
}

/** A held swipe made of many small moves, like a real finger. */
async function swipe(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 14,
  holdMs = 12,
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
    await page.waitForTimeout(holdMs);
  }
  await page.mouse.up();
}

async function openGate(page: Page, w: number, h: number): Promise<void> {
  for (let i = 0; i < 10; i++) {
    if ((await step(page)) !== Step.Gate) return;
    await swipe(page, { x: w / 2, y: h * 0.78 }, { x: w / 2, y: h * 0.24 }, 12, 10);
    await page.waitForTimeout(120);
  }
}

/** Drive the reel around the bog in a lawnmower pattern. */
async function driveReel(page: Page, w: number, h: number): Promise<void> {
  const cx = w / 2;
  const cy = h * 0.52;
  const rx = w * 0.36;
  const ry = h * 0.2;
  for (let lap = 0; lap < 26; lap++) {
    if ((await step(page)) !== Step.Reel) return;
    const a = lap * 0.9;
    const bx = cx + Math.cos(a) * rx;
    const by = cy + Math.sin(a * 1.3) * ry;
    await swipe(page, { x: cx, y: cy }, { x: bx, y: by }, 8, 16);
    await page.waitForTimeout(120);
  }
}

async function pullBoom(page: Page, w: number, h: number): Promise<void> {
  const cx = w / 2;
  const cy = h * 0.5;
  for (let i = 0; i < 26; i++) {
    if ((await step(page)) !== Step.Boom) return;
    // alternately drag each end toward the middle
    const side = i % 2 === 0 ? -1 : 1;
    const startX = cx + side * w * 0.42;
    const endX = cx + side * w * 0.08;
    await swipe(page, { x: startX, y: cy }, { x: endX, y: cy + (i % 3) * 8 - 8 }, 12, 14);
    await page.waitForTimeout(120);
  }
}

test.describe('ぽこぽこ！クランベリー・ウェットハーベスト', () => {
  for (const size of SIZES) {
    test(`full harvest — ${size.name}`, async ({ page }) => {
      test.setTimeout(240000);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });

      await page.setViewportSize(size);
      await page.goto('/');
      await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 });
      await page.waitForTimeout(900);
      const { width: w, height: h } = size;
      const shot = async (n: string): Promise<void> => {
        await page.screenshot({ path: `test-results/shots/${size.name}-${n}.png` });
      };

      /* --- 1. pre-harvest field --- */
      await shot('01-before');
      expect(await page.evaluate(() => window.__game!.water())).toBeLessThan(0);

      /* --- 2. the gate --- */
      await page.mouse.click(w / 2, h / 2); // skip the establishing shot
      await waitStep(page, Step.Gate, 15000);
      // a half swipe must move the water, but not all the way
      await swipe(page, { x: w / 2, y: h * 0.7 }, { x: w / 2, y: h * 0.55 }, 8, 12);
      await page.waitForTimeout(1200);
      const partial = await page.evaluate(() => window.__game!.water());
      expect(partial).toBeGreaterThan(-0.16);
      await shot('02-filling');

      await openGate(page, w, h);
      await waitStep(page, Step.Reel, 60000);
      const full = await page.evaluate(() => window.__game!.water());
      expect(full).toBeGreaterThan(partial);
      await shot('03-flooded');

      /* --- 3. the reel --- */
      await driveReel(page, w, h);
      await waitStep(page, Step.Reveal, 90000);
      expect(await page.evaluate(() => window.__game!.harvested())).toBeGreaterThan(0.5);
      await shot('04-reel');

      /* --- 4. the reveal --- */
      await page.waitForTimeout(2500);
      await shot('05-surfacing');
      await waitStep(page, Step.Boom, 30000);
      await shot('06-red-water');
      const afloat = await page.evaluate(() => window.__game!.floating());
      expect(afloat).toBeGreaterThan(200);

      /* --- 5/6. the boom --- */
      await pullBoom(page, w, h);
      await waitStep(page, Step.Hose, 60000);
      await shot('07-packed');

      /* --- 7. the hose --- */
      for (let i = 0; i < 14; i++) {
        if ((await step(page)) !== Step.Hose) break;
        await swipe(page, { x: w * 0.3, y: h * 0.7 }, { x: w * 0.5, y: h * 0.45 }, 10, 14);
        await page.waitForTimeout(150);
      }
      await waitStep(page, Step.Pump, 40000);
      await shot('08-hose-connected');

      /* --- 8. the pump --- */
      const pump = page.locator('button[aria-label="すいこむ"]');
      await expect(pump).toBeVisible();
      const box = (await pump.boundingBox())!;
      const px = box.x + box.width / 2;
      const py = box.y + box.height / 2;

      // hold, release, hold again — stopping must never break anything
      await page.mouse.move(px, py);
      await page.mouse.down();
      await page.waitForTimeout(3500);
      await shot('09-hose-flow');
      const midBed = await page.evaluate(() => window.__game!.bed());
      await page.mouse.up();
      await page.waitForTimeout(1200);
      const paused = await page.evaluate(() => window.__game!.bed());
      await page.mouse.down();
      expect(await step(page)).toBe(Step.Pump);

      for (let i = 0; i < 120; i++) {
        if ((await step(page)) !== Step.Pump) break;
        await page.waitForTimeout(500);
      }
      await page.mouse.up();
      expect(midBed).toBeGreaterThan(0);
      expect(paused).toBeGreaterThanOrEqual(midBed);

      await waitStep(page, Step.Done, 40000);
      await page.waitForTimeout(1500);
      await shot('10-truck-full');
      expect(await page.evaluate(() => window.__game!.bed())).toBeGreaterThan(100);

      /* --- 9. replay in two taps --- */
      await page.waitForTimeout(4000);
      await shot('11-done');
      const again = page.locator('button[aria-label="おなじ はたけで もういちど"]');
      await expect(again).toBeVisible();
      await again.click();
      await page.waitForTimeout(800);
      expect(await page.evaluate(() => window.__game!.water())).toBeLessThan(0);
      expect([Step.Intro, Step.Gate]).toContain(await step(page));

      expect(errors, `runtime errors: ${errors.join('\n')}`).toEqual([]);
    });
  }

  test('rotation mid-harvest keeps progress', async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 });
    await page.mouse.click(195, 400);
    await waitStep(page, Step.Gate, 15000);
    await openGate(page, 390, 844);
    await waitStep(page, Step.Reel, 60000);
    await driveReel(page, 390, 844);
    await waitStep(page, Step.Reveal, 90000);
    await waitStep(page, Step.Boom, 30000);

    const before = await page.evaluate(() => ({
      floating: window.__game!.floating(),
      water: window.__game!.water(),
      harvested: window.__game!.harvested(),
    }));
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(900);
    const after = await page.evaluate(() => ({
      step: window.__game!.step(),
      floating: window.__game!.floating(),
      water: window.__game!.water(),
      harvested: window.__game!.harvested(),
    }));
    expect(after.step).toBe(Step.Boom);
    expect(Math.abs(after.water - before.water)).toBeLessThan(0.2);
    expect(after.harvested).toBeCloseTo(before.harvested, 2);
    expect(Math.abs(after.floating - before.floating)).toBeLessThan(40);
    await page.screenshot({ path: 'test-results/shots/rotate-landscape.png' });
  });

  test('low graphics mode still shows the floating raft', async ({ page }) => {
    test.setTimeout(120000);
    await page.addInitScript(() => {
      localStorage.setItem(
        'pokopoko.settings.v1',
        JSON.stringify({ volume: 0, voice: false, reduceMotion: true, lowGraphics: true }),
      );
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 });
    expect(await page.evaluate(() => window.__game!.tier())).toBe('low');
    await page.mouse.click(195, 400);
    await waitStep(page, Step.Gate, 15000);
    await openGate(page, 390, 844);
    await waitStep(page, Step.Reel, 60000);
    await driveReel(page, 390, 844);
    await waitStep(page, Step.Reveal, 90000);
    await waitStep(page, Step.Boom, 30000);
    expect(await page.evaluate(() => window.__game!.floating())).toBeGreaterThan(150);
    await page.screenshot({ path: 'test-results/shots/low-red-water.png' });
    const calls = await page.evaluate(() => window.__game!.drawCalls());
    expect(calls).toBeLessThan(60);
  });

  test('free play keeps producing berries', async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/');
    await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 });
    await page.evaluate(() => window.__game!.restart(true, true));
    await page.waitForTimeout(600);
    expect(await step(page)).toBe(Step.Sandbox);
    expect(await page.evaluate(() => window.__game!.water())).toBeGreaterThan(1);
    await driveReel(page, 844, 390);
    expect(await page.evaluate(() => window.__game!.floating())).toBeGreaterThan(10);
    const pump = page.locator('button[aria-label="すいこむ"]');
    await expect(pump).toBeVisible();
    const box = (await pump.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(4000);
    await page.mouse.up();
    // the crop regrows, so free play never empties out
    expect(await page.evaluate(() => window.__game!.harvested())).toBeLessThan(1);
    await page.screenshot({ path: 'test-results/shots/sandbox.png' });
  });
});

declare global {
  interface Window {
    __game?: {
      step(): number;
      water(): number;
      floating(): number;
      bed(): number;
      harvested(): number;
      setStep(n: number): void;
      restart(same: boolean, sandbox?: boolean): void;
      tier(): string;
      drawCalls(): number;
    };
  }
}
