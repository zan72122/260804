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

/**
 * Wait for simulated seconds. The software renderer used here runs far below
 * 20fps and the loop clamps dt, so wall-clock sleeps land in the wrong place.
 */
async function waitGame(page: Page, seconds: number): Promise<void> {
  const from = await page.evaluate(() => window.__game!.stepTime());
  await page
    .waitForFunction(
      (a: { from: number; secs: number }) =>
        (window.__game?.stepTime() ?? 0) >= a.from + a.secs,
      { from, secs: seconds },
      { timeout: 300000, polling: 200 },
    )
    .catch(() => undefined);
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

/**
 * Regression: the machine used to shiver left and right whenever the finger
 * sat near it. It drove at the fingertip, overshot, and the bearing to the
 * finger then swung about — which jittered the heading, rocked the hull, and
 * shook the whole frame because the chase camera hangs off that heading.
 */
test.describe('the reel holds still', () => {
  test('a fingertip resting on the machine does not make it shiver', async ({ page }) => {
    test.setTimeout(900000);
    await boot(page, 844, 390, '?tier=low');
    await page.evaluate((n) => window.__game!.setStep(n), Step.Reel);
    await page.waitForTimeout(1500);

    // park the finger right where the machine is and hold it there
    await page.mouse.move(422, 230);
    await page.mouse.down();
    await waitGame(page, 4); // let it settle under the finger first

    const samples: Array<{ heading: number; view: number; speed: number }> = [];
    for (let i = 0; i < 30; i++) {
      samples.push(await page.evaluate(() => window.__game!.reel()));
      await page.waitForTimeout(120);
    }
    await page.mouse.up();

    const unwrap = (a: number, b: number): number => {
      let d = b - a;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return d;
    };

    // total heading travel while the finger is stationary
    let travel = 0;
    let reversals = 0;
    let prevSign = 0;
    for (let i = 1; i < samples.length; i++) {
      const d = unwrap(samples[i - 1].heading, samples[i].heading);
      travel += Math.abs(d);
      const sign = Math.sign(d);
      if (Math.abs(d) > 0.004 && sign !== 0) {
        if (prevSign !== 0 && sign !== prevSign) reversals++;
        prevSign = sign;
      }
    }
    // a settled machine drifts a little; a shivering one racks up radians
    // and flips direction on almost every sample
    expect(travel).toBeLessThan(0.35);
    expect(reversals).toBeLessThan(6);

    // and it must actually have come to rest under the finger
    expect(samples[samples.length - 1].speed).toBeLessThan(0.35);

    // the camera's heading must be at least as steady as the machine's
    let viewTravel = 0;
    for (let i = 1; i < samples.length; i++) {
      viewTravel += Math.abs(unwrap(samples[i - 1].view, samples[i].view));
    }
    expect(viewTravel).toBeLessThanOrEqual(travel + 0.05);
  });

  test('it still turns and drives when the finger moves away', async ({ page }) => {
    test.setTimeout(900000);
    await boot(page, 844, 390, '?tier=low');
    await page.evaluate((n) => window.__game!.setStep(n), Step.Reel);
    await page.waitForTimeout(1500);
    const before = await page.evaluate(() => window.__game!.reel());

    await page.mouse.move(422, 230);
    await page.mouse.down();
    await page.mouse.move(140, 300, { steps: 10 });
    let topSpeed = 0;
    for (let i = 0; i < 16; i++) {
      topSpeed = Math.max(topSpeed, (await page.evaluate(() => window.__game!.reel())).speed);
      await page.waitForTimeout(250);
    }
    const after = await page.evaluate(() => window.__game!.reel());
    await page.mouse.up();

    // the dead zone must not have turned the machine into a statue
    expect(topSpeed).toBeGreaterThan(1.0);
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(1.0);
    expect(await page.evaluate(() => window.__game!.harvested())).toBeGreaterThan(0.02);
  });
});

declare global {
  interface Window {
    __game?: {
      reel(): { x: number; z: number; heading: number; view: number; speed: number };
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
