/**
 * A fast visual sweep: jump straight to each authored moment and capture it.
 * This is the harness used to *look* at the game, not to assert on it.
 */

import { test, type Page } from '@playwright/test';

const SIZES = [
  { name: 'p', width: 390, height: 844 },
  { name: 'l', width: 844, height: 390 },
];

async function boot(page: Page, w: number, h: number, tier = 'mid'): Promise<void> {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`/?tier=${tier}`);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
}

/**
 * Wait for simulated seconds, not wall-clock seconds. The software renderer
 * here runs far below 20fps, and the loop clamps dt so the game slows down
 * rather than teleporting — which is correct behaviour, but it means fixed
 * sleeps in a test would land in the wrong place.
 */
async function waitGame(page: Page, seconds: number): Promise<void> {
  await page
    .waitForFunction((s) => (window.__game?.stepTime() ?? 0) >= s, seconds, {
      timeout: 120000,
      polling: 250,
    })
    .catch(() => undefined);
}

test.describe('visual sweep', () => {
  for (const s of SIZES) {
    test(`moments — ${s.name}`, async ({ page }) => {
      test.setTimeout(900000);
      await boot(page, s.width, s.height);
      const shot = (n: string) => page.screenshot({ path: `test-results/sweep/${s.name}-${n}.png` });

      await shot('a-intro');

      await page.evaluate(() => window.__game!.setStep(1));
      await page.waitForTimeout(900);
      await shot('b-gate');

      // half-open the gate and watch the front spread
      await page.mouse.move(s.width / 2, s.height * 0.75);
      await page.mouse.down();
      for (let i = 0; i < 10; i++) {
        await page.mouse.move(s.width / 2, s.height * (0.75 - i * 0.03));
        await page.waitForTimeout(30);
      }
      await page.mouse.up();
      await page.waitForTimeout(2500);
      await shot('c-filling');

      await page.evaluate(() => window.__game!.setStep(2));
      await page.waitForTimeout(2500);
      // drive for a while
      for (let i = 0; i < 8; i++) {
        await page.mouse.move(s.width / 2, s.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(s.width * (0.3 + 0.4 * ((i % 2) === 0 ? 1 : 0)), s.height * 0.35, {
          steps: 8,
        });
        await page.waitForTimeout(240);
        await page.mouse.up();
      }
      await shot('d-reel');

      await page.evaluate(() => window.__game!.setStep(3));
      await waitGame(page, 1.6);
      await shot('e-surfacing');
      await waitGame(page, 6.4);
      await shot('f-red-water');
      await waitGame(page, 8.4);
      await page.evaluate(() => window.__game!.setStep(4));
      await page.waitForTimeout(1600);
      await shot('g-boom-open');

      for (let i = 0; i < 14; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        await page.mouse.move(s.width / 2 + side * s.width * 0.42, s.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(s.width / 2 + side * s.width * 0.07, s.height * 0.5, { steps: 10 });
        await page.waitForTimeout(200);
        await page.mouse.up();
      }
      await page.waitForTimeout(600);
      await shot('h-packed');

      await page.evaluate(() => window.__game!.setStep(5));
      await page.waitForTimeout(1500);
      await shot('i-hose');

      await page.evaluate(() => window.__game!.setStep(6));
      await page.waitForTimeout(1200);
      const pump = page.locator('button[aria-label="すいこむ"]');
      const box = (await pump.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await waitGame(page, 5);
      await shot('j-flow');
      await page
        .waitForFunction(() => (window.__game?.suction() ?? 0) > 0.8, null, {
          timeout: 600000,
          polling: 400,
        })
        .catch(() => undefined);
      await page.waitForTimeout(1200);
      await shot('k-truck');
      await page.mouse.up();

      await page.evaluate(() => window.__game!.setStep(7));
      await waitGame(page, 4.5);
      await shot('l-done');
    });
  }
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
