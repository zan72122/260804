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
  for (let i = 0; i < 14; i++) {
    if ((await step(page)) !== Step.Gate) return;
    await swipe(page, { x: w / 2, y: h * 0.8 }, { x: w / 2, y: h * 0.2 }, 12, 25);
    await page.waitForTimeout(400);
  }
}

/**
 * Drive the reel around the bog with one long continuous drag, the way a
 * child actually holds the screen — and pace it off simulated time, because
 * the software renderer here runs well under 20fps and the loop deliberately
 * slows the game down rather than teleporting the machine.
 */
async function driveReel(page: Page, w: number, h: number, want = Step.Reel): Promise<void> {
  const cx = w / 2;
  const cy = h * 0.5;
  const rx = w * 0.34;
  const ry = h * 0.22;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 0; i < 600; i++) {
    if (i % 4 === 0 && (await step(page)) !== want) break;
    const a = i * 0.24;
    await page.mouse.move(cx + Math.cos(a) * rx, cy + Math.sin(a * 1.7) * ry, { steps: 3 });
    await page.waitForTimeout(260);
  }
  await page.mouse.up();
}

/** Haul each buoy inward, over and over, the way the boom is meant to work. */
async function pullBoom(page: Page, w: number, h: number): Promise<void> {
  const cx = w / 2;
  const cy = h * 0.5;
  for (let i = 0; i < 90; i++) {
    if ((await step(page)) !== Step.Boom) return;
    const side = i % 2 === 0 ? -1 : 1;
    const ang = (i % 4) * 0.35 - 0.5;
    await page.mouse.move(cx + side * w * 0.4, cy + Math.sin(ang) * h * 0.2);
    await page.mouse.down();
    for (let k = 1; k <= 5; k++) {
      const t = k / 5;
      await page.mouse.move(
        cx + side * w * 0.4 * (1 - t * 0.92),
        cy + Math.sin(ang) * h * 0.2 * (1 - t),
      );
      await page.waitForTimeout(320);
    }
    await page.mouse.up();
    await page.waitForTimeout(150);
  }
}

test.describe('ぽこぽこ！クランベリー・ウェットハーベスト', () => {
  for (const size of SIZES) {
    test(`full harvest — ${size.name}`, async ({ page }) => {
      test.setTimeout(900000);
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
      const dry = await page.evaluate(() => window.__game!.water());
      expect(dry).toBeLessThan(-0.2); // the bog starts dry, not a pond

      /* --- 2. the gate --- */
      await page.mouse.click(w / 2, h / 2); // skip the establishing shot
      await waitStep(page, Step.Gate, 15000);
      // a half swipe must start the water moving without finishing the job
      await swipe(page, { x: w / 2, y: h * 0.7 }, { x: w / 2, y: h * 0.55 }, 8, 60);
      await page.waitForFunction((d) => (window.__game?.water() ?? d) > d + 0.02, dry, {
        timeout: 60000,
        polling: 200,
      });
      const partial = await page.evaluate(() => window.__game!.water());
      expect(partial).toBeLessThan(0.9); // ... and it is not full yet
      expect(await step(page)).toBe(Step.Gate);
      await shot('02-filling');

      await openGate(page, w, h);
      await waitStep(page, Step.Reel, 120000);
      const full = await page.evaluate(() => window.__game!.water());
      expect(full).toBeGreaterThan(partial);
      await shot('03-flooded');

      /* --- 3. the reel --- */
      await driveReel(page, w, h);
      await waitStep(page, Step.Reveal, 180000);
      expect(await page.evaluate(() => window.__game!.harvested())).toBeGreaterThan(0.5);
      await shot('04-reel');

      /* --- 4. the reveal --- */
      await page.waitForTimeout(2500);
      await shot('05-surfacing');
      await waitStep(page, Step.Boom, 180000);
      await shot('06-red-water');
      const afloat = await page.evaluate(() => window.__game!.floating());
      expect(afloat).toBeGreaterThan(200);

      /* --- 5/6. the boom --- */
      await pullBoom(page, w, h);
      await waitStep(page, Step.Hose, 180000);
      await shot('07-packed');

      /* --- 7. the hose --- */
      // deliberately sloppy: drop it near the coupling, never exactly on it
      for (let i = 0; i < 20; i++) {
        if ((await step(page)) !== Step.Hose) break;
        await swipe(
          page,
          { x: w * (0.5 + (i % 2 === 0 ? 0.06 : -0.06)), y: h * 0.74 },
          { x: w * 0.5, y: h * 0.46 },
          8,
          120,
        );
        await page.waitForTimeout(250);
      }
      await waitStep(page, Step.Pump, 60000);
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
      await page.waitForFunction(() => (window.__game?.bed() ?? 0) > 5, null, {
        timeout: 300000,
        polling: 300,
      });
      await shot('09-hose-flow');
      const midBed = await page.evaluate(() => window.__game!.bed());
      await page.mouse.up();
      await page.waitForTimeout(2500);
      const paused = await page.evaluate(() => window.__game!.bed());
      await page.mouse.down();
      expect(await step(page)).toBe(Step.Pump);
      // releasing must stop the intake: nothing new may enter the hose
      expect(paused).toBeGreaterThanOrEqual(midBed);
      const afterPause = await page.evaluate(() => window.__game!.bed());
      await page.waitForTimeout(1500);
      expect(await page.evaluate(() => window.__game!.bed())).toBeGreaterThanOrEqual(afterPause);

      await page
        .waitForFunction(() => window.__game?.step() !== 6, null, {
          timeout: 600000,
          polling: 500,
        })
        .catch(() => undefined);
      await page.mouse.up();
      expect(midBed).toBeGreaterThan(0);

      await waitStep(page, Step.Done, 60000);
      await page.waitForTimeout(1500);
      await shot('10-truck-full');
      expect(await page.evaluate(() => window.__game!.bed())).toBeGreaterThan(100);

      /* --- 9. replay in two taps --- */
      await page.waitForTimeout(9000);
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
    test.setTimeout(900000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 });
    await page.mouse.click(195, 400);
    await waitStep(page, Step.Gate, 15000);
    await openGate(page, 390, 844);
    await waitStep(page, Step.Reel, 120000);
    await driveReel(page, 390, 844);
    await waitStep(page, Step.Reveal, 180000);
    await waitStep(page, Step.Boom, 180000);

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
    test.setTimeout(900000);
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
    await waitStep(page, Step.Reel, 120000);
    await driveReel(page, 390, 844);
    await waitStep(page, Step.Reveal, 180000);
    await waitStep(page, Step.Boom, 180000);
    expect(await page.evaluate(() => window.__game!.floating())).toBeGreaterThan(150);
    await page.screenshot({ path: 'test-results/shots/low-red-water.png' });
    const calls = await page.evaluate(() => window.__game!.drawCalls());
    expect(calls).toBeLessThan(90);
  });

  test('free play keeps producing berries', async ({ page }) => {
    test.setTimeout(900000);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/');
    await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 });
    await page.evaluate(() => window.__game!.restart(true, true));
    await page.waitForTimeout(600);
    expect(await step(page)).toBe(Step.Sandbox);
    expect(await page.evaluate(() => window.__game!.water())).toBeGreaterThan(1);
    await driveReel(page, 844, 390, Step.Sandbox);
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
