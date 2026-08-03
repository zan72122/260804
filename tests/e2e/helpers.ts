import { Page, TestInfo, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const ART_DIR = path.resolve(process.cwd(), 'artifacts/playtest');

export interface Ctx {
  page: Page;
  errors: string[];
  dir: string;
  shot(name: string): Promise<void>;
}

export async function setup(page: Page, testInfo: TestInfo, sub?: string): Promise<Ctx> {
  const dir = path.join(ART_DIR, sub ?? testInfo.project.name);
  fs.mkdirSync(dir, { recursive: true });
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__railGameTest?.getPhase() === 'title');
  let n = 0;
  return {
    page,
    errors,
    dir,
    async shot(name: string) {
      n++;
      await page.screenshot({ path: path.join(dir, `${String(n).padStart(2, '0')}-${name}.png`) });
    },
  };
}

export const phase = (page: Page): Promise<string> =>
  page.evaluate(() => (window as any).__railGameTest.getPhase());

export const waitPhase = (page: Page, ph: string, timeout = 30000): Promise<unknown> =>
  page.waitForFunction((p) => (window as any).__railGameTest.getPhase() === p, ph, { timeout });

export const signals = (page: Page): Promise<any> =>
  page.evaluate(() => (window as any).__railGameTest.getSignals());

export async function hotspot(page: Page, name: string): Promise<{ x: number; y: number; w: number; h: number }> {
  const r = await page.evaluate((n) => (window as any).__railGameTest.getHotspots()[n], name);
  if (!r) throw new Error(`hotspot ${name} not available in phase ${await phase(page)}`);
  return r;
}

export const center = (r: { x: number; y: number; w: number; h: number }): { x: number; y: number } => ({
  x: r.x + r.w / 2,
  y: r.y + r.h / 2,
});

export async function tapHot(page: Page, name: string): Promise<void> {
  const c = center(await hotspot(page, name));
  await page.mouse.click(c.x, c.y);
}

export async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 14,
  stepMs = 16
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let k = 1; k <= steps; k++) {
    await page.mouse.move(from.x + ((to.x - from.x) * k) / steps, from.y + ((to.y - from.y) * k) / steps);
    await page.waitForTimeout(stepMs);
  }
  await page.mouse.up();
}

async function isPortrait(page: Page): Promise<boolean> {
  const v = await page.evaluate(() => (window as any).__railGameTest.getViewport());
  return v.h >= v.w;
}

/** One forward drive swipe (portrait: up, landscape: right). */
export async function driveSwipe(page: Page, long = true): Promise<void> {
  const v = await page.evaluate(() => (window as any).__railGameTest.getViewport());
  const portrait = v.h >= v.w;
  const from = portrait
    ? { x: v.w * 0.5, y: v.h * 0.68 }
    : { x: v.w * 0.35, y: v.h * 0.45 };
  const to = portrait
    ? { x: v.w * 0.5, y: v.h * 0.68 - (long ? 330 : 120) }
    : { x: v.w * 0.35 + (long ? 420 : 150), y: v.h * 0.45 };
  await drag(page, from, to, 22, 16);
}

/** Drive the real UI from the current phase up to (and including) `target`. */
export async function playTo(page: Page, target: string, ctx?: Ctx): Promise<void> {
  const order = ['title', 'arrive', 'scanBefore', 'prepUnits', 'lower', 'grind', 'scanAfter', 'testRun', 'replay'];
  const want = order.indexOf(target);
  const at = async (): Promise<number> => order.indexOf(await phase(page));

  if ((await at()) === 0 && want >= 1) {
    await tapHot(page, 'play');
    await ctx?.shot('after-play-tap');
  }
  if ((await at()) <= 1 && want >= 2) await waitPhase(page, 'scanBefore', 25000);
  if ((await at()) === 2 && want >= 3) {
    await tapHot(page, 'scan');
    await page.waitForTimeout(1600);
    await ctx?.shot('scan-before-mid');
    await waitPhase(page, 'prepUnits', 15000);
  }
  if ((await at()) === 3 && want >= 4) {
    await ctx?.shot('prep-units');
    for (const i of [0, 1]) {
      const from = center(await hotspot(page, `tray${i}`));
      const to = center(await hotspot(page, `socket${i}`));
      await drag(page, from, to, 12);
      await page.waitForTimeout(120);
    }
    await waitPhase(page, 'lower', 10000);
  }
  if ((await at()) === 4 && want >= 5) {
    await ctx?.shot('lower-ready');
    const lever = await hotspot(page, 'lever');
    const cx = lever.x + lever.w / 2;
    await drag(page, { x: cx, y: lever.y + 34 }, { x: cx, y: lever.y + lever.h - 20 }, 20);
    await waitPhase(page, 'grind', 10000);
  }
  if ((await at()) === 5 && want >= 6) {
    await ctx?.shot('grind-start');
    const deadline = Date.now() + 120000;
    let midShot = false;
    while ((await phase(page)) === 'grind') {
      if (Date.now() > deadline) throw new Error('grind did not finish in time');
      await driveSwipe(page);
      if (!midShot) {
        const car = await page.evaluate(() => (window as any).__railGameTest.getCarPos());
        const zone = await page.evaluate(() => (window as any).__railGameTest.getZone());
        if (car > zone.start + 2) {
          await ctx?.shot('grind-sparks');
          midShot = true;
        }
      }
    }
    await waitPhase(page, 'scanAfter', 20000);
  }
  if ((await at()) === 6 && want >= 7) {
    await tapHot(page, 'scan');
    await page.waitForTimeout(1800);
    await ctx?.shot('scan-after-overlay');
    await waitPhase(page, 'testRun', 15000);
  }
  if ((await at()) === 7 && want >= 8) {
    await ctx?.shot('test-run-ready');
    await driveSwipe(page, false);
    await page.waitForTimeout(1200);
    await ctx?.shot('test-run-gliding');
    await waitPhase(page, 'replay', 40000);
    await ctx?.shot('replay-choice');
  }
}

export function expectNoErrors(errors: string[]): void {
  expect(errors, `console/page errors: ${errors.join(' | ')}`).toEqual([]);
}

/** Mean of several luminance samples — averages out slow glow pulsing. */
export async function avgLuminance(page: Page, samples = 10, gapMs = 160): Promise<number> {
  let sum = 0;
  for (let i = 0; i < samples; i++) {
    sum += await luminance(page);
    await page.waitForTimeout(gapMs);
  }
  return sum / samples;
}

/** Mean luminance (0..1) of the canvas, sampled coarsely in-page. */
export async function luminance(page: Page): Promise<number> {
  return page.evaluate(() => {
    const cv = document.getElementById('game') as HTMLCanvasElement;
    const c2 = cv.getContext('2d')!;
    const { width, height } = cv;
    const step = Math.max(8, Math.floor(width / 60));
    const img = c2.getImageData(0, 0, width, height);
    let sum = 0;
    let n = 0;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const i = (y * width + x) * 4;
        sum += 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
        n++;
      }
    }
    return sum / n / 255;
  });
}
