/**
 * The awkward things a real device does to a running game: getting
 * backgrounded and restored, and a parent changing the quality setting
 * halfway through a harvest.
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

async function boot(page: Page, w: number, h: number, query = ''): Promise<void> {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`/${query}`);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
}

test.describe('lifecycle', () => {
  test('surviving a background/restore keeps the harvest', async ({ page }) => {
    test.setTimeout(900000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await boot(page, 390, 844);

    await page.evaluate((n) => window.__game!.setStep(n), Step.Boom);
    await page.waitForTimeout(2500);
    const before = await page.evaluate(() => ({
      step: window.__game!.step(),
      floating: window.__game!.floating(),
      water: window.__game!.water(),
    }));
    expect(before.floating).toBeGreaterThan(100);

    // Safari suspends the tab
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(2000);

    // ...and hands it back much later
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(2500);

    const after = await page.evaluate(() => ({
      step: window.__game!.step(),
      floating: window.__game!.floating(),
      water: window.__game!.water(),
    }));
    expect(after.step).toBe(before.step);
    expect(Math.abs(after.water - before.water)).toBeLessThan(0.15);
    // the raft must not have been teleported by one enormous catch-up frame
    expect(Math.abs(after.floating - before.floating)).toBeLessThan(60);
    await page.screenshot({ path: 'test-results/lifecycle/after-resume.png' });
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('switching to low graphics mid-harvest keeps the step', async ({ page }) => {
    test.setTimeout(900000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await boot(page, 844, 390, '?tier=high');
    expect(await page.evaluate(() => window.__game!.tier())).toBe('high');

    await page.evaluate((n) => window.__game!.setStep(n), Step.Boom);
    await page.waitForTimeout(2500);
    const beforeCount = await page.evaluate(() => window.__game!.floating());

    // open the gear, flip "かるい モード"
    await page.locator('button[aria-label="せってい"]').click();
    const toggle = page.locator('.sheet .row', { hasText: 'かるい モード' }).locator('.toggle');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await page.locator('.sheet-close').click();
    await page.waitForTimeout(3000);

    expect(await page.evaluate(() => window.__game!.tier())).toBe('low');
    expect(await page.evaluate(() => window.__game!.step())).toBe(Step.Boom);
    const afterCount = await page.evaluate(() => window.__game!.floating());
    // fewer berries, but the raft is still there — the signature moment
    // must survive every quality step-down
    expect(afterCount).toBeGreaterThan(150);
    expect(afterCount).toBeLessThan(beforeCount);
    expect(await page.evaluate(() => window.__game!.drawCalls())).toBeLessThan(90);
    await page.screenshot({ path: 'test-results/lifecycle/low-mid-harvest.png' });
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('muted play still reaches the floating raft', async ({ page }) => {
    test.setTimeout(900000);
    await page.addInitScript(() => {
      localStorage.setItem(
        'pokopoko.settings.v1',
        JSON.stringify({ volume: 0, voice: false, reduceMotion: true, lowGraphics: false }),
      );
    });
    await boot(page, 390, 844);
    await page.evaluate((n) => window.__game!.setStep(n), Step.Pump);
    await page.waitForTimeout(1500);
    const pump = page.locator('button[aria-label="すいこむ"]');
    await expect(pump).toBeVisible();
    const box = (await pump.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForFunction(() => (window.__game?.bed() ?? 0) > 3, null, {
      timeout: 300000,
      polling: 300,
    });
    await page.mouse.up();
    expect(await page.evaluate(() => window.__game!.bed())).toBeGreaterThan(3);
    await page.screenshot({ path: 'test-results/lifecycle/muted.png' });
  });
});

declare global {
  interface Window {
    __game?: {
      step(): number;
      stepTime(): number;
      suction(): number;
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
